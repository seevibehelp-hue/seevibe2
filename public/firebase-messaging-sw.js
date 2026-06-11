/* Firebase Cloud Messaging Service Worker for See Vibe
 * Handles background push notifications from FCM.
 */
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAQWdlIJZo6bxl0jJx5lDQq3ZU50XMUB9w',
  projectId: 'seevibe-352e3',
  messagingSenderId: '530405655071',
  appId: '1:530405655071:android:4e35686ac90f8b0cf5cb2a',
  storageBucket: 'seevibe-352e3.firebasestorage.app',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'See Vibe';
  const options = {
    body: (payload.notification && payload.notification.body) || '',
    icon: (payload.notification && payload.notification.icon) || '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {},
    tag: (payload.data && payload.data.tag) || 'seevibe-notification',
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
