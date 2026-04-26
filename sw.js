const CACHE = 'financas-pro-v1';
const ASSETS = [
  '/financas-pro/',
  '/financas-pro/index.html',
  '/financas-pro/style.css',
  '/financas-pro/config.js',
  '/financas-pro/utils.js',
  '/financas-pro/db-models.js',
  '/financas-pro/pages.js',
  '/financas-pro/icon-192.png',
  '/financas-pro/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Supabase e CDN: sempre rede
  if (e.request.url.includes('supabase.co') || e.request.url.includes('cdn.jsdelivr')) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
