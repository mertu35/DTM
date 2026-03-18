const CACHE_NAME = 'dtm-v1';
const STATIC_ASSETS = [
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/firebase.js',
  './js/utils.js',
  './js/data.js',
  './js/calculations.js',
  './js/documents.js',
  './icons/icon.svg',
  './manifest.json'
];

// Kurulum: statik dosyaları cache'e al
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Aktivasyon: eski cache'leri temizle
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: önce cache, sonra network
// Firebase istekleri (firestore/googleapis) her zaman network'ten gider
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Firebase ve CDN isteklerini geçir
  if (url.includes('firebaseio.com') ||
      url.includes('googleapis.com') ||
      url.includes('gstatic.com') ||
      url.includes('firestore.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(() => caches.match('./index.html'));
    })
  );
});
