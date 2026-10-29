// Çevrimdışı oynama için service worker.
// Sayfa (index.html) önce ağdan gelir (güncellemeler hemen görünsün), diğer dosyalar önbellekten.
const CACHE = 'nfstars-v45';
const CORE = ['./', './index.html', './manifest.webmanifest', './logo.webp', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Bulut kayıt API'si her zaman ağdan (önbellek eski kayıt döndürmesin); Unity 3B derlemesi çok büyük, önbelleğe alınmaz
  if (url.pathname.includes('/api/') || url.pathname.includes('/unity/') || url.pathname.includes('/media/')) return; // video: tarayıcı parça parça (Range) ister

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }),
    ),
  );
});

// ── BİLDİRİMLER ──
// Günlük hatırlatma (Android'de ana ekrana eklenmiş uygulama: Periodic Background Sync). Sayfa son
// durumun kısa özetini 'krampon-meta' önbelleğine yazar; oyuncu 18 saattir açmadıysa hatırlatılır.
async function dailyReminder() {
  try {
    const c = await caches.open('krampon-meta');
    const r = await c.match('./__krampon_meta');
    if (!r) return;
    const m = await r.json();
    if (!m.on || Date.now() - (m.ts || 0) < 18 * 3600 * 1000) return;
    await self.registration.showNotification(m.title || 'New Football Stars ⚽', {
      body: m.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'krampon-daily', data: { url: './' },
    });
  } catch { /* özet yok */ }
}
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'krampon-daily') e.waitUntil(dailyReminder());
});
// Sunucu bildirimi (ileride bulut kayıt açıldığında): { title, body, url }
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data?.text?.() || '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'New Football Stars ⚽', {
    body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || 'krampon', data: { url: d.url || './' },
  }));
});
// Bildirime dokununca açık oyunu öne getir, yoksa aç
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    for (const w of ws) if ('focus' in w) return w.focus();
    return self.clients.openWindow ? self.clients.openWindow(url) : undefined;
  }));
});
