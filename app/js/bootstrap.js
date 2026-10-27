// Static controls use trusted callbacks; no inline script or handler evaluation.
dtmRegisterEvent('static-0', function(event) { sifremiUnuttumModalAc() });
dtmRegisterEvent('static-1', function(event) { toggleLoginPwd(this) });
dtmRegisterEvent('static-2', function(event) { doLogin() });
dtmRegisterEvent('static-3', function(event) { sifremiUnuttumModalKapat() });
dtmRegisterEvent('static-4', function(event) { sifremiUnuttumModalKapat() });
dtmRegisterEvent('static-5', function(event) { sifremiUnuttumGonder(this) });
dtmRegisterEvent('static-6', function(event) { document.querySelector('.sidebar').classList.toggle('open') });
dtmRegisterEvent('static-7', function(event) { toggleTheme() });
dtmRegisterEvent('static-8', function(event) { doLogout() });
dtmRegisterEvent('static-9', function(event) { duyurularSayfasinaGit() });
dtmRegisterEvent('static-10', function(event) { closeDuyuruPopup() });

// Same-origin PDF reader and worker. No third-party script is fetched at runtime.
const dtmBootstrapUrl = document.currentScript ? document.currentScript.src : window.location.href;
window.pdfStandardFontDataUrl = new URL('./vendor/standard_fonts/', dtmBootstrapUrl).href;
const dtmPdfModuleUrl = new URL('./vendor/pdf.min.mjs?v=20261009a', dtmBootstrapUrl).href;
window.pdfjsReady = import(dtmPdfModuleUrl).then(lib => {
  lib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs?v=20261009a', dtmBootstrapUrl).href;
  window.pdfjsLib = lib;
  return lib;
});
// Keep a rejected import handled until a PDF operation reports the failure.
window.pdfjsReady.catch(err => {
  console.error('PDF.js modül yükleme hatası:', err);
});
// Yeni sürüm gelince sayfa kendiliğinden yenilenmez (doldurulan form kaybolmasın);
// kullanıcıya "Yenile" düğmesi gösterilir.
function dtmYeniSurumBildirimiGoster() {
  if (document.getElementById('dtmYeniSurumBildirimi')) return;
  const kutu = document.createElement('div');
  kutu.id = 'dtmYeniSurumBildirimi';
  kutu.setAttribute('role', 'status');
  kutu.style.cssText = 'position:fixed;left:0;right:0;bottom:20px;margin:0 auto;width:max-content;z-index:100000;display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 32px);background:#1e3a5f;color:#fff;padding:12px 16px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);font-size:14px';
  const metin = document.createElement('span');
  metin.textContent = 'Uygulamanın yeni sürümü hazır. Kaydetmediğiniz bilgi varsa önce kaydedin.';
  const yenile = document.createElement('button');
  yenile.type = 'button';
  yenile.textContent = 'Yenile';
  yenile.style.cssText = 'background:#fff;color:#1e3a5f;border:0;border-radius:6px;padding:6px 14px;font-weight:700;cursor:pointer';
  yenile.addEventListener('click', () => window.location.reload());
  const sonra = document.createElement('button');
  sonra.type = 'button';
  sonra.textContent = 'Sonra';
  sonra.style.cssText = 'background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:6px;padding:6px 12px;cursor:pointer';
  sonra.addEventListener('click', () => kutu.remove());
  kutu.append(metin, yenile, sonra);
  document.body.appendChild(kutu);
}

if (!window.dtmDisableServiceWorker && 'serviceWorker' in navigator) {
  // İlk ziyarette de controller değişir; bu bir güncelleme değildir.
  let dtmSwIlkKurulum = !navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (dtmSwIlkKurulum) {
      dtmSwIlkKurulum = false;
      return;
    }
    dtmYeniSurumBildirimiGoster();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(reg => {
        const guncellemeKontrol = () => reg.update().catch(() => {});
        guncellemeKontrol();
        setInterval(guncellemeKontrol, 30 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') guncellemeKontrol();
        });
      })
      .catch(error => console.error('Service Worker:', error));
  });
}
