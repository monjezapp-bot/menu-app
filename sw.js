// sw.js — Dashboard Service Worker
// الوظيفة: Push Notifications فقط، بدون أي كاش أو تدخل في الـ requests

const SW_VERSION = 'v2'; // ← غيّر الرقم دا عند كل تحديث للـ SW

// ══ Install: خد السيطرة فوراً بدون انتظار ══
self.addEventListener('install', (event) => {
  self.skipWaiting(); // يستبدل الـ SW القديم فوراً بدون انتظار إغلاق الـ tabs
});

// ══ Activate: احذف أي كاش قديم وخد السيطرة على كل الـ tabs ══
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key))) // حذف كل كاش قديم
    ).then(() => self.clients.claim()) // سيطر على كل tabs مفتوحة فوراً
  );
});

// ══ Network-Only: كل request يروح للشبكة مباشرة، مفيش كاش على الإطلاق ══
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
      icon:               '/icon-192.png',
      badge:              '/icon-192.png',
      vibrate:            [300, 150, 300, 150, 300],
      tag:                'menus-new-order',
      renotify:           true,
      requireInteraction: true,
      data:               { url },
      dir:                'rtl',
      lang:               'ar'
    })
  );
});

// ══ Notification Click ══
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? '/dashboard.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('dashboard') && 'focus' in client)
          return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
