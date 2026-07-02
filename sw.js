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
