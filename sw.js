// عامل الخدمة: يحفظ هيكل التطبيق فقط، ويستقبل تنبيهات الجوال حتى لو كان التطبيق مغلقاً أو الجهاز مقفلاً.
// بيانات الحضور لا تُخزَّن هنا أبداً وتُجلب دائماً من الخادم.
const CACHE = 'attendance-v11';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'favicon-48.png', 'apple-touch-icon.png', 'logo-ta.png', 'logo-ib.jpg'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // طلبات الخادم والخطوط تمرّ مباشرة
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(function (r) {
      const cp = r.clone();
      if (r.ok) caches.open(CACHE).then(function (c) { c.put(e.request, cp); });
      return r;
    }).catch(function () {
      return caches.match(e.request).then(function (m) { return m || caches.match('index.html'); });
    })
  );
});
// ---------- تنبيهات الجوال ----------
self.addEventListener('push', function (e) {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'بصمة مجمع ابن تيمية';
  const opts = {
    body: d.body || 'لديك تذكير جديد',
    icon: 'icon-192.png',
    badge: 'favicon-48.png',
    dir: 'rtl', lang: 'ar',
    tag: d.tag || 'att',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [400, 150, 400, 150, 400],
    timestamp: Date.now(),
    data: { url: d.url || './' }
  };
  e.waitUntil(self.registration.showNotification(title, opts).then(function () {
    // إن كان التطبيق مفتوحاً: تنبيه صوتي داخله أيضاً
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
      cs.forEach(function (c) { c.postMessage({ type: 'push', title: title, body: opts.body }); });
    });
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (let i = 0; i < cs.length; i++) if ('focus' in cs[i]) { try { cs[i].postMessage({ type: 'refresh' }); } catch (x) { } return cs[i].focus(); }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
