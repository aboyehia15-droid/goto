// عامل الخدمة: يحفظ هيكل التطبيق فقط، ويستقبل تنبيهات الجوال حتى لو كان التطبيق مغلقاً أو الجهاز مقفلاً.
// بيانات الحضور لا تُخزَّن هنا أبداً وتُجلب دائماً من الخادم.
const CACHE = 'attendance-v12';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'favicon-48.png', 'apple-touch-icon.png', 'logo-ta.png', 'logo-ib.jpg'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// فتح فوري: تُعرض النسخة المحفوظة على الجهاز مباشرة، وتُجلب النسخة الأحدث في الخلفية.
// إن تغيّرت الواجهة يُبلَّغ التطبيق ليحدّث نفسه بهدوء (دون حذف أو إعادة تثبيت).
self.addEventListener('fetch', function (e) {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin) return;   // طلبات الخادم والخطوط تمرّ مباشرة
  const nav = req.mode === 'navigate', key = nav ? 'index.html' : req;
  const cacheP = caches.open(CACHE);
  const hitP = cacheP.then(function (c) { return c.match(key, { ignoreSearch: nav }); });
  const netP = fetch(req, { cache: 'no-cache' });
  // تحديث النسخة المحفوظة في الخلفية، وإبلاغ التطبيق إن تغيّرت الواجهة
  e.waitUntil(Promise.all([cacheP, hitP, netP]).then(function (a) {
    const c = a[0], hit = a[1], r = a[2];
    if (!r.ok || r.type !== 'basic') return;
    return r.clone().text().then(function (txt) {
      return (hit ? hit.clone().text() : Promise.resolve(null)).then(function (old) {
        return c.put(key, new Response(txt, { headers: r.headers })).then(function () {
          if (old !== null && old !== txt && (nav || /(index\.html|\/)$/.test(u.pathname)))
            return notifyUpdated_(e.resultingClientId);
        });
      });
    });
  }).catch(function () { }));
  e.respondWith(hitP.then(function (hit) {
    if (hit) return hit.clone();
    return netP.then(function (r) { return r.clone(); }).catch(function () { return cacheP.then(function (c) { return c.match('index.html'); }); });
  }));
});
function notifyUpdated_(rid) {
  const send = function (cl) { if (cl) cl.postMessage({ type: 'updated' }); };
  const tryRid = function (n) {
    return (rid ? self.clients.get(rid) : Promise.resolve(null)).then(function (cl) {
      if (cl || !rid || n <= 0) return cl;
      return new Promise(function (r) { setTimeout(r, 400); }).then(function () { return tryRid(n - 1); });
    });
  };
  return Promise.all([tryRid(10), self.clients.matchAll({ type: 'window', includeUncontrolled: true })]).then(function (a) {
    const seen = {};
    [a[0]].concat(a[1]).forEach(function (cl) { if (cl && !seen[cl.id]) { seen[cl.id] = 1; send(cl); } });
  });
}
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
