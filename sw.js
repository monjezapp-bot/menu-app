// منجز — Service Worker لإشعارات الطلبات (Web Push)
const SW_VERSION = 'v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// استقبال إشعار Push من السيرفر عند وصول طلب جديد
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = { title: 'طلب جديد', body: event.data ? event.data.text() : '' } }

  const title = data.title || '🔔 طلب جديد!'
  const options = {
    body: data.body || 'لديك طلب جديد في انتظار الموافقة',
    icon: data.icon || './icon-192.png',
    badge: './icon-192.png',
    vibrate: [300, 150, 300, 150, 300, 150, 500], // نمط اهتزاز متكرر وواضح
    tag: 'monjez-new-order', // إشعار جديد يستبدل القديم بدل تكديسه
    renotify: true,          // يهتز/يصوت تاني حتى لو فيه إشعار سابق بنفس tag
    requireInteraction: true, // الإشعار يفضل ظاهر لحد ما التاجر يتعامل معه (مدعوم على أندرويد)
    data: { orderId: data.orderId || null, url: data.url || './dashboard.html' }
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// عند الضغط على الإشعار: فتح الداشبورد أو التركيز على نافذة مفتوحة بالفعل
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || './dashboard.html'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if (client.url.includes('dashboard.html') && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})
