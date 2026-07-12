const CACHE_NAME = 'menus-customer-v3';
const CORE_ASSETS = ['./manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first لكل ملفات التطبيق (HTML + JS + CSS) — عشان أي تحديث يوصل فوراً
// من غير ما المستخدم يفضل شغال بنسخة قديمة كاش من الجهاز، خصوصاً إن المشروع
// لسه بيتطور بسرعة. Cache-first بس للأيقونات/manifest اللي نادراً ما تتغير.
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (url.includes('supabase.co')) return; // never cache live data

  const isAppShell = event.request.mode === 'navigate' ||
                      url.endsWith('.html') || url.endsWith('.js') || url.endsWith('.css');
  if (isAppShell) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// ── PUSH NOTIFICATIONS ───────────────────────────────────────────────
// استقبال إشعار Push فعلي من السيرفر وعرضه للمستخدم — كان ناقص بالكامل
// وده سبب أساسي إن الإشعارات ما كانتش بتظهر حتى لو السيرفر بعتها فعلاً.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'إشعار جديد', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'إشعار جديد';
  const options = {
    body: data.body || '',
    icon: data.icon || './dash-icon-192.png',
    badge: data.icon || './dash-icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [300, 150, 300, 150, 300, 150, 300],
    requireInteraction: true, // يفضل ظاهر لحد ما التاجر يتفاعل معاه، مش بيختفي لوحده بسرعة
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || './dashboard.html', kind: data.kind || 'general' }
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // لو التطبيق شغال فعلاً في الخلفية (مش مقفول تماماً)، نبعتله رسالة يشغّل
      // صوت التنبيه العالي (WebAudio) اللي جوه الصفحة، لأن نظام أندرويد نفسه
      // مش بيسمح بصوت مخصص للإشعار من برّه — ده أقرب حل ممكن لصوت عالي فعلي.
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
        clientsArr.forEach((c) => c.postMessage({ type: 'PLAY_LOUD_ALERT', kind: data.kind || 'general' }));
      })
    ])
  );
});

// الضغط على الإشعار: يفتح نفس نافذة التطبيق لو مفتوحة، وإلا يفتح نافذة جديدة
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = event.notification.data?.url || './dashboard.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(targetPath.replace('./', '')));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetPath);
    })
  );
});

// ── PUSH SUBSCRIPTION CHANGE ─────────────────────────────────────────
// المتصفح (خصوصاً كروم) ممكن يلغي/يجدد الاشتراك من تلقاء نفسه من وقت للتاني
// (مش حاجة إحنا بنتحكم فيها)، والحدث ده بيتفعل حتى لو التطبيق مقفول تمامًا.
// من غير الاستماع له، الاشتراك القديم بيبقى عاطل بصمت والإشعارات بتقف من غير
// ما حد ياخد باله، لحد ما يفتح التطبيق تاني ويلاحظ بنفسه إن التفعيل اتلغى.
const VAPID_PUBLIC_KEY = 'BHpeyTZ57ZxBaWldVJ2qNWqrwWZMUSsLFIzOGvtl0suELxgRqoiZ8oLXNQNQEoTIv_4dYzelHMGG3llLWV_FMaE'
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    }).then((newSub) =>
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
        // مبعرفش هنا لوحدي لو الجهاز ده تاجر ولا عميل ولا فرع معيّن — فبنسيب صفحة
        // التطبيق نفسها (core.js أو dashboard.html) تحفظ الاشتراك الجديد بالتفاصيل
        // الصح بتاعتها (customer_id أو restaurant_id/branch_id)
        clientsArr.forEach((c) => c.postMessage({ type: 'PUSH_SUBSCRIPTION_RENEWED', subscription: newSub.toJSON() }))
      })
    ).catch(() => {})
  );
});
