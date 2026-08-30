import type { IncomingMessage, ServerResponse } from 'http';
import admin from 'firebase-admin';

// Interface for extended Node HTTP response in serverless environments
interface ServerlessResponse extends ServerResponse {
  status: (code: number) => ServerlessResponse;
  json: (body: any) => void;
  send: (body: any) => void;
}

interface ServerlessRequest extends IncomingMessage {
  body?: any;
  query?: Record<string, string | string[]>;
  method?: string;
}

/**
 * Safe Firebase Admin singleton initialization for serverless runtime (handles cold & warm starts)
 */
function getFirebaseAdminApp() {
  if (admin.apps.length > 0 && admin.apps[0]) {
    return admin.apps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'buildtoshipproject';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && rawPrivateKey) {
    // Handle both literal newlines and escaped \n sequences from environment variables
    const formattedPrivateKey = rawPrivateKey.replace(/\\n/g, '\n');

    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey,
      }),
    });
  }

  // Fallback to project ID only if service account credentials are not provided
  return admin.initializeApp({
    projectId,
  });
}

/**
 * Vercel Serverless Function Handler for POST /api/notifications/test-push
 */
export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  // Always ensure JSON content type
  res.setHeader('Content-Type', 'application/json');

  // Handle CORS preflight if needed
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 200;
    res.end();
    return;
  }

  // Enforce POST method
  if (req.method !== 'POST') {
    res.statusCode = 405;
    const errorBody = JSON.stringify({ error: 'Method Not Allowed. Use POST.' });
    if (typeof res.json === 'function') {
      res.json({ error: 'Method Not Allowed. Use POST.' });
    } else {
      res.end(errorBody);
    }
    return;
  }

  try {
    // Parse body if passed as string or stream
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        res.statusCode = 400;
        const errPayload = { error: 'Invalid JSON payload in request body.' };
        if (typeof res.json === 'function') {
          res.json(errPayload);
        } else {
          res.end(JSON.stringify(errPayload));
        }
        return;
      }
    } else if (!body) {
      body = {};
    }

    const { userId, installationId, title, body: messageBody, route } = body;

    // Validate required fields
    if (!userId || !installationId) {
      res.statusCode = 400;
      const validationError = {
        error: 'User ID and Device Installation ID (FCM Token) are required.',
      };
      if (typeof res.json === 'function') {
        res.json(validationError);
      } else {
        res.end(JSON.stringify(validationError));
      }
      return;
    }

    const payloadTitle = title || '🔔 HELIX Study Notification';
    const payloadBody =
      messageBody || 'Success! Real Firebase Web Push notifications are active on this device.';
    const payloadRoute = typeof route === 'string' && route.startsWith('/') ? route : '/today';

    // Initialize or retrieve Firebase Admin instance
    const app = getFirebaseAdminApp();

    // Dispatch real Firebase Cloud Message
    const messageId = await admin.messaging(app).send({
      token: installationId,
      notification: {
        title: payloadTitle,
        body: payloadBody,
      },
      data: {
        route: payloadRoute,
        type: 'study_session',
        entityId: `test_${Date.now()}`,
      },
    });

    console.log('[Vercel API /notifications/test-push] Successfully dispatched FCM message:', messageId);

    const successResponse = {
      success: true,
      messageId,
      message: 'Test notification delivered to your browser via Firebase Cloud Messaging!',
    };

    res.statusCode = 200;
    if (typeof res.json === 'function') {
      res.json(successResponse);
    } else {
      res.end(JSON.stringify(successResponse));
    }
  } catch (error: any) {
    console.error('[Vercel API /notifications/test-push] Dispatch error:', error);

    res.statusCode = 500;
    const errorPayload = {
      error: error.message || 'Failed to dispatch test notification.',
    };

    if (typeof res.json === 'function') {
      res.json(errorPayload);
    } else {
      res.end(JSON.stringify(errorPayload));
    }
  }
}
