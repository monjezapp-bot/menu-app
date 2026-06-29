// Service Worker — لوحة تحكم التاجر (إشعارات الطلبات الجديدة)

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// استقبال إشعار Push جديد (طلب جديد من العميل)
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'طلب جديد', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || '🛎️ طلب جديد'
  const options = {
    body: data.body || 'لديك طلب جديد في انتظار التأكيد',
    icon: './dash-icon-192.png',
    badge: './dash-icon-192.png',
    tag: data.tag || 'new-order',
    data: { url: data.url || './dashboard.html' },
    vibrate: [200, 100, 200],
    requireInteraction: true
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// عند الضغط على الإشعار: افتح الداش بورد (أو ركّز على نافذة مفتوحة بالفعل)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || './dashboard.html'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if (client.url.includes('dashboard.html') && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})
