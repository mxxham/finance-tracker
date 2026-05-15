// FinTrack Service Worker — handles push notifications and background sync

const CACHE_NAME = 'fintrack-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push notifications (sent from server)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'FinTrack', body: event.data.text() }; }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-72.png',
    tag: payload.tag || 'fintrack',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    renotify: true,
    requireInteraction: payload.requireInteraction || false,
    actions: payload.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'FinTrack', options)
  );
});

// Handle notification click — open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If app is already open, focus it
      for (const client of clients) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// Handle notification dismiss
self.addEventListener('notificationclose', () => {
  // Could log dismissal analytics here
});
