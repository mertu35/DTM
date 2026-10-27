const CACHE_NAME = 'dtm-v130';
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
  './js/icons.js',
  './js/config.js',
  './js/vendor/tesseract/tesseract.min.js',
  './js/vendor/tesseract/worker.min.js',
  './js/vendor/tesseract/tesseract-core-lstm.wasm.js',
  './js/vendor/tesseract/tesseract-core-lstm.wasm',
  './js/vendor/tesseract/lang-data/tur.traineddata.gz',
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

// Kurulum: statik dosyaları HTTP önbelleğini atlayarak cache'e al
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        STATIC_ASSETS.map(asset =>
          fetch(asset, { cache: 'no-cache' })
            .then(res => (res && res.ok ? cache.put(asset, res) : null))
            .catch(() => null)
        )
      )
    )
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

// Fetch: uygulama kodları (HTML/JS/CSS) için önce güncel Network (offline ise cache);
// büyük sabit kütüphaneler (vendor/font/icon) için önce cache
self.addEventListener('fetch', event => {
  const parsed = new URL(event.request.url);
  if (event.request.method !== 'GET' || parsed.origin !== self.location.origin) return;
  const url = parsed.href;

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

  const isStaticVendor =
    url.includes('/js/vendor/') ||
    url.includes('html2pdf.bundle.min.js') ||
    url.includes('/icons/');

  if (isStaticVendor) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => cache.match(event.request, { ignoreSearch: true })).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Uygulama dosyaları (index.html, app.js, documents.js, style.css vb.): Network-First
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        if (event.request.mode === 'navigate') return (await caches.match('./index.html')) || Response.error();
        return Response.error();
      })
  );
});
