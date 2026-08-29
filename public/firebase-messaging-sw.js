/* eslint-disable no-undef */
// Service worker for Firebase Cloud Messaging (Web Push)
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Public client Firebase Configuration (No secret/private keys)
const firebaseConfig = {
  apiKey: "AIzaSyCIuMvTI7CkpQI-AhhuBpHwb18wAwBceZo",
  authDomain: "buildtoshipproject.firebaseapp.com",
  projectId: "buildtoshipproject",
  storageBucket: "buildtoshipproject.firebasestorage.app",
  messagingSenderId: "274231692642",
  appId: "1:274231692642:web:4cf84dfbd12345d91e303b",
  measurementId: "G-TFCB5K6YX0"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Immediate activation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'HELIX Study Alert';
  const targetRoute = payload.data?.route || payload.data?.url || '/today';

  // Only allow valid internal HELIX routes for security
  const safeRoute = targetRoute.startsWith('/') ? targetRoute : '/today';

  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have an upcoming study session or task reminder.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.entityId || 'helix-notification',
    data: {
      route: safeRoute,
      entityId: payload.data?.entityId,
      type: payload.data?.type || 'study_session',
      timestamp: Date.now()
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click: Focus active tab or open window and navigate
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawRoute = event.notification.data?.route || '/today';
  const targetUrl = new URL(rawRoute, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if HELIX window is already open
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      // If not open, launch new window with the destination route
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
