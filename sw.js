const CACHE_NAME = 'warehouseweb-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://unpkg.com/vue@3.4.21/dist/vue.global.prod.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      try { await cache.addAll(urlsToCache); } catch(e) { console.warn('SW cache install parcial:', e); }
    })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      var req = event.request.clone();
      return fetch(req).then(response => {
        if (!response || response.status !== 200) return response;
        if (response.type !== 'basic' && response.type !== 'cors') return response;
        var toCache = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => {
          if (event.request.url.startsWith('http')) cache.put(event.request, toCache);
        }));
        return response;
      }).catch(() => Response.error());
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
    ))
  );
  self.clients.claim();
});

// Auto-update: notifica a todos los clientes cuando hay nueva versión
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
