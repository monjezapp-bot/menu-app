// sw.js — Dashboard Service Worker
// الوظيفة: Push Notifications فقط، بدون أي كاش أو تدخل في الـ requests

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

// ══ Network-Only: كل request يروح للشبكة مباشرة، مفيش كاش ══
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// ══ Push Notifications ══
self.addEventListener('push', (event) => {
  const data  = event.data?.json?.() ?? {};
  const title = data.title ?? 'طلب جديد 🍽️';
  const body  = data.body  ?? 'لديك طلب جديد في المطعم';
  const url   = data.url   ?? '/dashboard.html';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:             '/icon-192.png',
      badge:            '/icon-192.png',
      data:             { url },
      requireInteraction: true,
      dir:  'rtl',
      lang: 'ar'
    })
  );
});

// ══ Notification Click ══
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? '/dashboard.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('dashboard') && 'focus' in client)
          return client.focus();
      }
      return clients.openWindow(target);
    })
  );
});
