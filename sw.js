// Service Worker — Asistencia Docente CENS
const CACHE = 'asistencia-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Para Firebase y APIs externas — siempre red
  if (e.request.url.includes('firestore') || e.request.url.includes('googleapis') ||
      e.request.url.includes('gstatic') || e.request.url.includes('fonts')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
