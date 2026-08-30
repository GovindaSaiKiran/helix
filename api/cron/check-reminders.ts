import type { IncomingMessage, ServerResponse } from 'http';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface ServerlessResponse extends ServerResponse {
  status?: (code: number) => ServerlessResponse;
  json?: (body: any) => void;
  send?: (body: any) => void;
}

interface ServerlessRequest extends IncomingMessage {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  query?: Record<string, string>;
  url?: string;
}

function getFirebaseAdminApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    return existingApps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'buildtoshipproject';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && rawPrivateKey) {
    const formattedPrivateKey = rawPrivateKey.replace(/\\n/g, '\n');
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey,
      }),
      projectId,
    });
  }

  return initializeApp({ projectId });
}

/**
 * Check if task scheduled start time is within the active reminder window (15 mins prior up to start time).
 */
export function isTaskDueForReminder(
  scheduledStartTime: string | undefined | null,
  currentHours: number,
  currentMinutes: number,
  windowMinutes: number = 15
): boolean {
  if (!scheduledStartTime || typeof scheduledStartTime !== 'string') {
    return false;
  }

  const clean = scheduledStartTime.trim();
  const parts = clean.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    return false;
  }

  const [taskHour, taskMin] = parts;
  const taskTotalMinutes = taskHour * 60 + taskMin;
  const currentTotalMinutes = currentHours * 60 + currentMinutes;

  // diff is positive when the task is in the upcoming future (e.g. task at 20:00, now 19:45 -> diff = +15)
  const diff = taskTotalMinutes - currentTotalMinutes;

  // Eligible if starting within windowMinutes (e.g. 15 min before) up to 2 minutes after start time
  return diff <= windowMinutes && diff >= -2;
}

/**
 * Attempt to atomically claim a task reminder delivery.
 * Returns true ONLY if this invocation successfully acquired the claim.
 */
export async function attemptAtomicReminderClaim(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
  scheduledDate: string
): Promise<{ claimed: boolean; claimId?: string; usedFallback?: boolean }> {
  const deliveryKey = `task_${taskId}_${scheduledDate}`;

  try {
    // 1. Primary Strategy: Atomic insert into public.reminder_deliveries
    const { data: inserted, error: insertErr } = await supabase
      .from('reminder_deliveries')
      .insert({
        delivery_key: deliveryKey,
        task_id: taskId,
        user_id: userId,
        status: 'claimed',
        channel: 'fcm',
        claimed_at: new Date().toISOString(),
        attempt_count: 1,
      })
      .select('id')
      .single();

    if (!insertErr && inserted) {
      return { claimed: true, claimId: inserted.id };
    }

    // If duplicate key error (PostgreSQL 23505), check status for retryability (if previous attempt failed)
    if (insertErr && (insertErr.code === '23505' || insertErr.message?.includes('duplicate key') || insertErr.message?.includes('unique'))) {
      const { data: existing } = await supabase
        .from('reminder_deliveries')
        .select('id, status, claimed_at, attempt_count')
        .eq('delivery_key', deliveryKey)
        .single();

      if (existing) {
        // If already successfully sent, never retry
        if (existing.status === 'sent') {
          return { claimed: false };
        }

        // If previously failed, or claimed > 5 mins ago (stale/abandoned in-flight worker), allow retry
        const claimedTime = new Date(existing.claimed_at).getTime();
        const isStale = Date.now() - claimedTime > 5 * 60 * 1000;

        if (existing.status === 'failed' || isStale) {
          const { data: updated, error: updateErr } = await supabase
            .from('reminder_deliveries')
            .update({
              status: 'claimed',
              claimed_at: new Date().toISOString(),
              attempt_count: (existing.attempt_count || 1) + 1,
            })
            .eq('id', existing.id)
            .eq('status', existing.status) // optimistic concurrency check
            .select('id')
            .single();

          if (!updateErr && updated) {
            return { claimed: true, claimId: updated.id };
          }
        }
      }

      return { claimed: false };
    }

    // If table doesn't exist yet (before migration applied), fallback to notifications table
    if (insertErr && (insertErr.code === '42P01' || insertErr.message?.includes('does not exist'))) {
      const actionUrl = `/today?taskId=${taskId}`;
      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('channel', 'fcm')
        .eq('type', 'reminder')
        .eq('action_url', actionUrl)
        .gte('created_at', `${scheduledDate}T00:00:00Z`)
        .limit(1);

      if (existingNotif && existingNotif.length > 0) {
        return { claimed: false, usedFallback: true };
      }

      return { claimed: true, usedFallback: true };
    }

    return { claimed: false };
  } catch (err) {
    console.warn('[attemptAtomicReminderClaim] Note:', err);
    return { claimed: false };
  }
}

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  res.setHeader('Content-Type', 'application/json');

  // 1. CRON Endpoint Security (Authorization Check)
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (expectedSecret) {
    if (!authHeader || typeof authHeader !== 'string' || authHeader.trim() !== `Bearer ${expectedSecret}`) {
      res.statusCode = 401;
      const unauthPayload = { error: 'Unauthorized: Invalid or missing authorization token.' };
      if (typeof res.json === 'function') res.json(unauthPayload);
      else res.end(JSON.stringify(unauthPayload));
      return;
    }
  } else if (process.env.NODE_ENV === 'production') {
    res.statusCode = 401;
    const missingSecretPayload = { error: 'CRON_SECRET is not configured in server environment.' };
    if (typeof res.json === 'function') res.json(missingSecretPayload);
    else res.end(JSON.stringify(missingSecretPayload));
    return;
  }

  // 2. Initialize Supabase Client
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.statusCode = 200;
    const msg = { success: true, checked: 0, due: 0, sent: 0, failed: 0, message: 'Supabase credentials not configured.' };
    if (typeof res.json === 'function') res.json(msg);
    else res.end(JSON.stringify(msg));
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Timezone & Reference Time Determination
    const urlObj = new URL(req.url || '/', 'http://localhost');
    const customTimeParam = urlObj.searchParams.get('currentTime');
    const customDateParam = urlObj.searchParams.get('currentDate');

    const now = new Date();
    let currentHours = now.getHours();
    let currentMinutes = now.getMinutes();
    let todayStr = now.toISOString().split('T')[0];

    if (customTimeParam && customTimeParam.includes(':')) {
      const [h, m] = customTimeParam.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        currentHours = h;
        currentMinutes = m;
      }
    }

    if (customDateParam && /^\d{4}-\d{2}-\d{2}$/.test(customDateParam)) {
      todayStr = customDateParam;
    }

    // 4. Query Active Tasks Scheduled for Today
    const { data: allTasks, error: taskErr } = await supabase
      .from('tasks')
      .select('id, user_id, title, scheduled_date, scheduled_start_time, status')
      .eq('scheduled_date', todayStr)
      .in('status', ['pending', 'in_progress']);

    if (taskErr || !allTasks || allTasks.length === 0) {
      res.statusCode = 200;
      const resp = { success: true, checked: 0, due: 0, sent: 0, failed: 0, timestamp: now.toISOString() };
      if (typeof res.json === 'function') res.json(resp);
      else res.end(JSON.stringify(resp));
      return;
    }

    // 5. Time-Window Filtering: 15-minute lead window
    const dueTasks = allTasks.filter(t => isTaskDueForReminder(t.scheduled_start_time, currentHours, currentMinutes, 15));

    if (dueTasks.length === 0) {
      res.statusCode = 200;
      const resp = {
        success: true,
        checked: allTasks.length,
        due: 0,
        sent: 0,
        failed: 0,
        timestamp: now.toISOString(),
      };
      if (typeof res.json === 'function') res.json(resp);
      else res.end(JSON.stringify(resp));
      return;
    }

    // 6. Query Active Registered Devices
    const targetUserIds = [...new Set(dueTasks.map(t => t.user_id).filter(Boolean))];
    const { data: devices } = await supabase
      .from('notification_devices')
      .select('id, user_id, installation_id, is_active')
      .in('user_id', targetUserIds)
      .eq('is_active', true);

    const devicesByUser = new Map<string, Array<{ id: string; installation_id: string }>>();
    (devices || []).forEach(d => {
      const list = devicesByUser.get(d.user_id) || [];
      list.push({ id: d.id, installation_id: d.installation_id });
      devicesByUser.set(d.user_id, list);
    });

    let sentCount = 0;
    let failedCount = 0;

    const app = getFirebaseAdminApp();
    const messaging = getMessaging(app);

    // 7. Atomic Claim and Dispatch Loop
    for (const task of dueTasks) {
      // ATOMIC CLAIM: Only the single worker that acquires the database claim may proceed
      const claimResult = await attemptAtomicReminderClaim(supabase, task.id, task.user_id, todayStr);
      if (!claimResult.claimed) {
        // Another concurrent worker claimed or delivered this task reminder
        continue;
      }

      const userDevices = devicesByUser.get(task.user_id) || [];
      if (userDevices.length === 0) {
        // No active devices registered for this user
        if (claimResult.claimId) {
          await supabase
            .from('reminder_deliveries')
            .update({ status: 'failed', failed_at: new Date().toISOString(), error_message: 'No active devices registered.' })
            .eq('id', claimResult.claimId);
        }
        continue;
      }

      let deliverySucceeded = false;
      let lastErrorMessage = '';

      for (const device of userDevices) {
        try {
          await messaging.send({
            token: device.installation_id,
            notification: {
              title: '🔔 HELIX Task Reminder',
              body: `Upcoming Focus Session: "${task.title}" at ${task.scheduled_start_time || 'soon'}.`,
            },
            data: {
              route: '/today',
              type: 'study_session',
              entityId: task.id,
            },
          });

          sentCount++;
          deliverySucceeded = true;
        } catch (fcmErr: any) {
          failedCount++;
          lastErrorMessage = fcmErr.message;
          console.warn(`[Vercel Cron] Push dispatch error for user ${task.user_id}:`, fcmErr.message);

          if (
            fcmErr.code === 'messaging/registration-token-not-registered' ||
            fcmErr.code === 'messaging/invalid-registration-token' ||
            fcmErr.message?.includes('not registered') ||
            fcmErr.message?.includes('invalid token')
          ) {
            await supabase
              .from('notification_devices')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('id', device.id);
          }
        }
      }

      // 8. Update Delivery State
      if (deliverySucceeded) {
        if (claimResult.claimId) {
          await supabase
            .from('reminder_deliveries')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', claimResult.claimId);
        }

        // Insert into in-app notification center
        await supabase.from('notifications').insert({
          user_id: task.user_id,
          title: '🔔 HELIX Task Reminder',
          message: `Upcoming Focus Session: "${task.title}" at ${task.scheduled_start_time || 'soon'}.`,
          channel: 'fcm',
          type: 'reminder',
          read: false,
          action_url: `/today?taskId=${task.id}`,
        });
      } else {
        // FCM failed -> mark delivery as failed so it remains retryable on subsequent runs
        if (claimResult.claimId) {
          await supabase
            .from('reminder_deliveries')
            .update({
              status: 'failed',
              failed_at: new Date().toISOString(),
              error_message: lastErrorMessage || 'FCM push delivery failed',
            })
            .eq('id', claimResult.claimId);
        }
      }
    }

    res.statusCode = 200;
    const responsePayload = {
      success: true,
      checked: allTasks.length,
      due: dueTasks.length,
      sent: sentCount,
      failed: failedCount,
      timestamp: now.toISOString(),
    };

    if (typeof res.json === 'function') {
      res.json(responsePayload);
    } else {
      res.end(JSON.stringify(responsePayload));
    }
  } catch (error: any) {
    console.error('[Vercel Cron /check-reminders] Uncaught error:', error);
    res.statusCode = 500;
    const errPayload = { error: error.message || 'Cron execution failed' };
    if (typeof res.json === 'function') res.json(errPayload);
    else res.end(JSON.stringify(errPayload));
  }
}
