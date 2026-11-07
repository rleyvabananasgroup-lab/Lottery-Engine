// Offline support for the installed app. The app itself and its results file are always
// fetched fresh when there's a connection and served from the phone's cache when there isn't.
const VERSION = 'lie-1.4.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './data/feed.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const CDN = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|tessdata\.projectnaptha\.com)\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'lie-cdn').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
async function networkFirst(req, key) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res.ok) cache.put(key || req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(key || req, { ignoreSearch: true });
    if (hit) return hit;
    throw e;
  }
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open('lie-cdn');
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === 'navigate') { e.respondWith(networkFirst(req, './index.html')); return; }
    if (url.pathname.endsWith('/data/feed.json') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/sw.js')) { e.respondWith(networkFirst(req)); return; }
    e.respondWith(caches.match(req).then(hit => hit || networkFirst(req)));
    return;
  }
  if (CDN.test(req.url)) e.respondWith(staleWhileRevalidate(req));
  // Everything else (live lottery data sources) goes straight to the network.
});
