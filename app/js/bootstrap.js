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
const dtmPdfModuleUrl = new URL('./vendor/pdf.min.mjs', dtmBootstrapUrl).href;
window.pdfjsReady = import(dtmPdfModuleUrl).then(lib => {
  lib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', dtmBootstrapUrl).href;
  window.pdfjsLib = lib;
  return lib;
});
// Keep a rejected import handled until a PDF operation reports the failure.
window.pdfjsReady.catch(err => {
  console.error('PDF.js modül yükleme hatası:', err);
});
if (!window.dtmDisableServiceWorker && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => console.error('Service Worker:', error));
  });
}
