import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { firebaseApp } from '../lib/firebase';
import { supabase } from '../lib/supabaseClient';
import { notificationService } from './notificationService';

export type NotificationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

export interface DeviceRegistration {
  id?: string;
  userId: string;
  installationId: string;
  deviceType: string;
  browser: string;
  platform: string;
  isActive: boolean;
  lastSeenAt?: string;
}

export interface HelixNotificationPayload {
  type?: 'task_reminder' | 'deadline_reminder' | 'study_session' | 'project_deadline' | 'replanning' | 'system';
  title: string;
  body: string;
  route?: string;
  entityId?: string;
}

class FirebaseMessagingService {
  private messaging: Messaging | null = null;
  private isInitialized = false;
  private currentToken: string | null = null;
  private unsubscribeForegroundMessage: (() => void) | null = null;

  /**
   * Check if Firebase Messaging & Notification API are supported by the current browser
   */
  async isMessagingSupported(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;
    if (!('serviceWorker' in navigator)) return false;
    try {
      return await isSupported();
    } catch {
      return false;
    }
  }

  /**
   * Get current browser notification permission status
   */
  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    const supported = await this.isMessagingSupported();
    if (!supported) return 'unsupported';
    return Notification.permission as NotificationPermissionStatus;
  }

  /**
   * Initialize Firebase Messaging instance & foreground message listener
   */
  async init(): Promise<Messaging | null> {
    if (this.isInitialized && this.messaging) {
      return this.messaging;
    }

    const supported = await this.isMessagingSupported();
    if (!supported || !firebaseApp) {
      return null;
    }

    try {
      this.messaging = getMessaging(firebaseApp);
      this.isInitialized = true;
      this.setupForegroundMessageListener();
      return this.messaging;
    } catch (err) {
      console.warn('[FirebaseMessaging] Initialization error:', err);
      return null;
    }
  }

  /**
   * Listen for foreground messages when the HELIX tab is actively open
   */
  private setupForegroundMessageListener() {
    if (!this.messaging) return;

    if (this.unsubscribeForegroundMessage) {
      this.unsubscribeForegroundMessage();
    }

    this.unsubscribeForegroundMessage = onMessage(this.messaging, (payload) => {
      console.log('[FirebaseMessaging] Received foreground message:', payload);

      const title = payload.notification?.title || payload.data?.title || 'HELIX Study Alert';
      const body = payload.notification?.body || payload.data?.body || 'You have an upcoming study session or task.';
      const actionUrl = payload.data?.route || payload.data?.url || '/today';

      // Dispatch to HELIX in-app notification center
      notificationService.sendInAppReminder(title, body, actionUrl);
    });
  }

  /**
   * Request browser permission & register the device with FCM + Supabase
   * ONLY triggered upon explicit user action.
   */
  async enableNotifications(userId: string): Promise<{ success: boolean; token?: string; error?: string }> {
    if (!userId) {
      return { success: false, error: 'Authenticated user ID is required.' };
    }

    const supported = await this.isMessagingSupported();
    if (!supported) {
      return {
        success: false,
        error: 'Browser notifications are not supported on this browser or device.',
      };
    }

    const msgInstance = await this.init();
    if (!msgInstance) {
      return { success: false, error: 'Firebase Messaging is not available.' };
    }

    try {
      // 1. Explicitly request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return {
          success: false,
          error: permission === 'denied'
            ? 'Notifications are blocked in your browser. Please enable them from your browser site settings.'
            : 'Notification permission was not granted.',
        };
      }

      // 2. Register or retrieve Service Worker and wait for it to be active
      let swRegistration: ServiceWorkerRegistration | undefined;
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/',
          });
          // Wait until service worker is active and ready
          swRegistration = await navigator.serviceWorker.ready;
        } catch (swErr) {
          console.warn('[FirebaseMessaging] Service worker registration error:', swErr);
        }
      }

      // 3. Obtain Firebase Cloud Messaging Registration Token
      const rawVapid = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      const vapidKey = (rawVapid && rawVapid.trim().length > 0) ? rawVapid.trim() : undefined;

      const token = await getToken(msgInstance, {
        vapidKey,
        serviceWorkerRegistration: swRegistration,
      });

      if (!token) {
        return { success: false, error: 'Failed to generate Firebase registration token.' };
      }

      this.currentToken = token;
      localStorage.setItem('helix_fcm_token', token);
      localStorage.setItem('helix_fcm_user_id', userId);

      // 4. Associate token with the Supabase User in notification_devices table
      await this.saveDeviceRegistration(userId, token);

      return { success: true, token };
    } catch (err: any) {
      console.error('[FirebaseMessaging] Registration failed:', err);
      return {
        success: false,
        error: err.message || 'An unexpected error occurred during notification registration.',
      };
    }
  }

  /**
   * Save or update the device registration in Supabase (with offline local storage fallback)
   */
  private async saveDeviceRegistration(userId: string, token: string): Promise<void> {
    const browserInfo = this.getBrowserInfo();
    const platformInfo = this.getPlatformInfo();

    try {
      // Upsert into Supabase notification_devices table
      const { error } = await supabase
        .from('notification_devices')
        .upsert(
          {
            user_id: userId,
            installation_id: token,
            device_type: 'browser',
            browser: browserInfo,
            platform: platformInfo,
            is_active: true,
            updated_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,installation_id' }
        );

      if (error) {
        console.warn('[FirebaseMessaging] Supabase device registration note:', error.message);
      }
    } catch (e) {
      console.warn('[FirebaseMessaging] Storage note:', e);
    }
  }

  /**
   * Disable browser notifications and deactivate device registration
   */
  async disableNotifications(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const storedToken = this.currentToken || localStorage.getItem('helix_fcm_token');
      if (storedToken && userId) {
        try {
          await supabase
            .from('notification_devices')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('installation_id', storedToken);
        } catch (e) {
          // Ignore
        }
      }

      this.currentToken = null;
      localStorage.removeItem('helix_fcm_token');
      localStorage.removeItem('helix_fcm_user_id');

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to disable notifications.' };
    }
  }

  /**
   * Check if notifications are currently registered and enabled on this device for the user
   */
  async isEnabledForUser(userId: string): Promise<boolean> {
    if (!userId) return false;
    const permission = await this.getPermissionStatus();
    if (permission !== 'granted') return false;

    const storedToken = localStorage.getItem('helix_fcm_token');
    const storedUserId = localStorage.getItem('helix_fcm_user_id');

    // Make sure the stored token strictly belongs to the current user
    if (!storedToken || storedUserId !== userId) {
      return false;
    }

    return true;
  }

  /**
   * Handle user logout: clean up local device association to avoid cross-user notification delivery
   */
  async handleLogoutCleanup(userId: string): Promise<void> {
    try {
      const storedToken = localStorage.getItem('helix_fcm_token');
      if (storedToken && userId) {
        await supabase
          .from('notification_devices')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('installation_id', storedToken);
      }
    } catch (e) {
      // Ignore
    } finally {
      this.currentToken = null;
      localStorage.removeItem('helix_fcm_token');
      localStorage.removeItem('helix_fcm_user_id');
    }
  }

  /**
   * Send a test push notification to this user's registered browser via backend verification
   */
  async sendTestNotification(userId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const storedToken = this.currentToken || localStorage.getItem('helix_fcm_token');
    if (!storedToken) {
      return {
        success: false,
        error: 'No active browser push registration found. Please click "Enable Browser Notifications" first.',
      };
    }

    try {
      // Call secure backend endpoint
      const response = await fetch('/api/notifications/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          installationId: storedToken,
          title: '🔔 HELIX Study Notification',
          body: 'Success! Real Firebase Web Push notifications are active on this device.',
          route: '/today',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test push notification from server.');
      }

      return { success: true, message: data.message || 'Test push notification sent successfully!' };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to dispatch test notification.',
      };
    }
  }

  private getBrowserInfo(): string {
    if (typeof navigator === 'undefined') return 'Unknown Browser';
    const ua = navigator.userAgent;
    if (ua.includes('Edg/')) return 'Microsoft Edge';
    if (ua.includes('Chrome/')) return 'Google Chrome';
    if (ua.includes('Firefox/')) return 'Mozilla Firefox';
    if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Apple Safari';
    return 'Web Browser';
  }

  private getPlatformInfo(): string {
    if (typeof navigator === 'undefined') return 'Unknown Platform';
    const ua = navigator.userAgent;
    if (ua.includes('Win')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Desktop/Mobile';
  }
}

export const firebaseMessaging = new FirebaseMessagingService();
