const CACHE_NAME = 'dtm-v96';
const STATIC_ASSETS = [
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/bootstrap.js',
  './js/html2pdf.bundle.min.js',
  './js/vendor/pdf.min.mjs',
  './js/vendor/pdf.worker.min.mjs',
  './js/vendor/pdf-export-46aeb002f85cf8335343.js',
  './js/vendor/standard_fonts/FoxitDingbats.pfb',
  './js/vendor/standard_fonts/FoxitFixed.pfb',
  './js/vendor/standard_fonts/FoxitFixedBold.pfb',
  './js/vendor/standard_fonts/FoxitFixedBoldItalic.pfb',
  './js/vendor/standard_fonts/FoxitFixedItalic.pfb',
  './js/vendor/standard_fonts/FoxitSerif.pfb',
  './js/vendor/standard_fonts/FoxitSerifBold.pfb',
  './js/vendor/standard_fonts/FoxitSerifBoldItalic.pfb',
  './js/vendor/standard_fonts/FoxitSerifItalic.pfb',
  './js/vendor/standard_fonts/FoxitSymbol.pfb',
  './js/vendor/standard_fonts/LiberationSans-Bold.ttf',
  './js/vendor/standard_fonts/LiberationSans-BoldItalic.ttf',
  './js/vendor/standard_fonts/LiberationSans-Italic.ttf',
  './js/vendor/standard_fonts/LiberationSans-Regular.ttf',
  './js/firebase.js',
  './js/utils.js',
  './js/data.js',
  './js/calculations.js',
  './js/documents.js',
  './js/excel.js',
  './js/word.js',
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

  // blob: ve data: URL'lerini (SheetJS Excel indirme, PDF vb.) ASLA yakalama
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return;
  }

  // Firebase ve CDN isteklerini geçir
  if (url.includes('firebaseio.com') ||
      url.includes('googleapis.com') ||
      url.includes('gstatic.com') ||
      url.includes('firestore.googleapis.com') ||
      url.includes('cdn.jsdelivr.net') ||
      url.includes('cdnjs.cloudflare.com') ||
      url.includes('fonts.googleapis.com') ||
      url.includes('fonts.gstatic.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic' && url.includes('/js/vendor/tesseract/')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
