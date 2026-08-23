// ===================== APP.JS =====================
let proje = getDefaultProje();
let referans = loadReferans();
let currentPage = 'anasayfa';
let saveTimeout = null;
let projeAktif = false;
let currentProjeKilitli = false;
let currentProjeBaskaKullanici = false;
let currentProjeStatus = 'taslak';
let currentProjeKazananBasitUsul = false; // gönderim anında dondurulan Basit Usul (KDV muafiyet) durumu
let okunmamiDuyuruSayisi = 0;
let currentBelgelerProjeId = null;
let currentGerceklestirmeciBelgelerProjeId = null;
let currentGerceklestirmeciBelge = 'dt-onay-belgesi'; // varsayılan: D.T. Onay Belgesi
let currentGerceklestirmeciTab = 'projeler';
let currentGerceklestirmeciReadOnly = false;
let currentOnayliBelgelerProjeId = null;
let lastSavedProjeSnapshot = null;

function hasUnsavedChanges() {
  if (currentPage !== 'veri-giris' || !proje || currentProjeKilitli) return false;
  // Eğer proje henüz boşsa (iş adı vs girilmemişse) uyarı verme
  if (!proje.isAdi?.trim() && !proje.isKalemleri?.some(k => k.ad?.trim())) return false;
  if (!lastSavedProjeSnapshot) return true;
  return JSON.stringify(proje) !== lastSavedProjeSnapshot;
}

// ===== ROL YARDIMCISI =====
function getRoleLabel(role) {
  const labels = { superadmin: 'Sistem Yöneticisi', admin: 'Yönetici', gerceklestirmeci: 'Gerçekleştirme Görevlisi', user: 'Kullanıcı' };
  return labels[role] || 'Kullanıcı';
}

function getStatusBadge(status) {
  const map = {
    taslak:          { label: 'Taslak',          bg: '#f3f4f6', color: '#6b7280' },
    gonderildi:      { label: 'Gönderildi',       bg: '#dbeafe', color: '#1e40af' },
    geri_gonderildi: { label: 'Geri Gönderildi',  bg: '#fee2e2', color: '#991b1b' },
    onaylandi:       { label: 'Onaylandı',         bg: '#d1fae5', color: '#065f46' },
    arsivlendi:      { label: 'Arşivlendi',        bg: '#f3f4f6', color: '#374151' }
  };
  const s = map[status] || map.taslak;
  return `<span style="font-size:11px;background:${s.bg};color:${s.color};padding:2px 7px;border-radius:4px;font-weight:600">${s.label}</span>`;
}

function getIsTuruBadge(isTuru) {
  const tur = isTuru || 'Yapım İşi';
  const map = {
    'Yapım İşi':    { label: 'Yapım İşi',    bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
    'Mal Alımı':    { label: 'Mal Alımı',    bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
    'Hizmet Alımı': { label: 'Hizmet Alımı', bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    'Danışmanlık':  { label: 'Danışmanlık',  bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' }
  };
  const t = map[tur] || map['Yapım İşi'];
  return `<span style="font-size:11px;background:${t.bg};color:${t.color};border:1px solid ${t.border};padding:2px 8px;border-radius:5px;font-weight:600;display:inline-flex;align-items:center;gap:3px">🏷️ ${t.label}</span>`;
}

// ===== TOAST BİLDİRİM SİSTEMİ =====
function showToast(mesaj, tip = 'success', sure = 3000) {
  const renkler = {
    success: { bg: '#065f46', border: '#059669', icon: typeof getIcon === 'function' ? getIcon('check', 16) : '✓' },
    error:   { bg: '#991b1b', border: '#dc2626', icon: typeof getIcon === 'function' ? getIcon('x', 16) : '✕' },
    warning: { bg: '#92400e', border: '#d97706', icon: typeof getIcon === 'function' ? getIcon('alertTriangle', 16) : '⚠' },
    info:    { bg: '#1e3a5f', border: '#1a56db', icon: typeof getIcon === 'function' ? getIcon('info', 16) : 'ℹ' }
  };
  const r = renkler[tip] || renkler.success;

  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `background:${r.bg};border:1px solid ${r.border};color:#fff;padding:12px 18px;border-radius:10px;
    font-size:14px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,0.25);display:flex;align-items:center;gap:10px;
    max-width:360px;animation:toastIn 0.25s ease;`;
  toast.innerHTML = `<span style="font-size:16px;font-weight:700">${r.icon}</span><span>${mesaj}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.25s ease forwards';
    setTimeout(() => toast.remove(), 250);
  }, sure);
}

if (!document.getElementById('toastStyle')) {
  const s = document.createElement('style');
  s.id = 'toastStyle';
  s.textContent = `@keyframes toastIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
    @keyframes toastOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(40px)}}`;
  document.head.appendChild(s);
}

// ===== ÖZEL ONAY MODAL =====
function showPrompt(baslik, placeholder = '') {
  return new Promise(resolve => {
    const mevcut = document.getElementById('dtmPromptModal');
    if (mevcut) mevcut.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dtmPromptModal';
    overlay.className = 'dtm-modal-overlay';
    overlay.innerHTML = `
      <div class="dtm-modal" style="max-width:420px">
        <div class="dtm-modal-body">
          <p style="margin:0 0 14px">${escHtml(baslik)}</p>
          <textarea id="dtmPromptInput" placeholder="${escAttr(placeholder)}" rows="4"
            style="width:100%;box-sizing:border-box;border:1px solid var(--gray-200);border-radius:8px;padding:10px;font-size:14px;resize:vertical;font-family:inherit"></textarea>
        </div>
        <div class="dtm-modal-footer">
          <button id="dtmPromptIptal" class="btn btn-outline">İptal</button>
          <button id="dtmPromptOnay" class="btn btn-danger">Geri Gönder</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    function kapat(sonuc) { overlay.remove(); resolve(sonuc); }
    document.getElementById('dtmPromptOnay').onclick = () => {
      const val = document.getElementById('dtmPromptInput').value.trim();
      kapat(val);
    };
    document.getElementById('dtmPromptIptal').onclick = () => kapat(null);
    overlay.addEventListener('click', e => { if (e.target === overlay) kapat(null); });
    setTimeout(() => document.getElementById('dtmPromptInput')?.focus(), 50);
  });
}

function showConfirm(mesaj, onayBtn = 'Evet', iptalBtn = 'İptal') {
  return new Promise(resolve => {
    const mevcut = document.getElementById('dtmConfirmModal');
    if (mevcut) mevcut.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dtmConfirmModal';
    overlay.className = 'dtm-modal-overlay';
    overlay.innerHTML = `
      <div class="dtm-modal" style="max-width:380px">
        <div class="dtm-modal-body">${mesaj}</div>
        <div class="dtm-modal-footer">
          <button id="dtmConfirmIptal" class="btn btn-outline">${escHtml(iptalBtn)}</button>
          <button id="dtmConfirmOnay" class="btn btn-danger">${escHtml(onayBtn)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    function kapat(sonuc) { overlay.remove(); resolve(sonuc); }
    document.getElementById('dtmConfirmOnay').onclick = () => kapat(true);
    document.getElementById('dtmConfirmIptal').onclick = () => kapat(false);
    overlay.addEventListener('click', e => { if (e.target === overlay) kapat(false); });
  });
}

function acBelgeIndirModal() {
  if (!proje || !currentBelgelerProjeId) return;

  const mevcut = document.getElementById('dtmBelgeIndirModal');
  if (mevcut) mevcut.remove();

  const isMalVeyaHizmet = proje.isTuru === 'Mal Alımı' || proje.isTuru === 'Hizmet Alımı' || proje.isTuru === 'Danışmanlık';
  const sonTutanakId = isMalVeyaHizmet ? 'muayene-kabul' : 'bitti-tutanagi';
  const sonTutanakAd = isMalVeyaHizmet ? 'Muayene ve Kabul' : 'Bitti Tutanağı';

  const belgeler = [
    { id: 'yaklasik-maliyet', ad: 'Yaklaşık Maliyet', excel: true, word: false },
    { id: 'teklif-tutanagi', ad: 'Teklif Tutanağı', excel: true, word: false },
    { id: 'teknik-sartname', ad: 'Teknik Şartname', excel: false, word: true },
    ...(isMalVeyaHizmet ? [] : [{ id: 'sozlesme', ad: 'Sözleşme', excel: false, word: true }]),
    { id: sonTutanakId, ad: sonTutanakAd, excel: false, word: true },
    { id: 'hakedis-raporu', ad: 'Hakediş Raporu', excel: false, word: true }
  ];

  const checkboxler = belgeler.map(b => `
    <label style="display:flex;align-items:center;gap:10px;padding:9px 0;cursor:pointer;border-bottom:1px solid var(--gray-100);">
      <input type="checkbox" class="belge-indir-cb" value="${b.id}" data-excel="${b.excel}" data-word="${b.word}" checked
        style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary)">
      <span style="font-size:14px;color:var(--gray-800);flex:1">${b.ad}</span>
      ${b.excel ? '<span style="font-size:10px;background:#10b981;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600">XLSX</span>' : ''}
      ${b.word ? '<span style="font-size:10px;background:#2563eb;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600">DOC</span>' : ''}
    </label>`).join('');

  const overlay = document.createElement('div');
  overlay.id = 'dtmBelgeIndirModal';
  overlay.className = 'dtm-modal-overlay';
  overlay.innerHTML = `
    <div class="dtm-modal" style="max-width:420px">
      <div class="dtm-modal-header">
        <h3>&#128196; Belge İndir</h3>
      </div>
      <div class="dtm-modal-body">
        <p style="margin:0 0 14px;font-size:13px;color:var(--gray-500)">İndirilecek belgeleri işaretleyin</p>
        <label style="display:flex;align-items:center;gap:10px;padding:9px 0;cursor:pointer;border-bottom:2px solid var(--gray-200);margin-bottom:2px;font-weight:600;">
          <input type="checkbox" id="hepsiniSecCb" checked
            style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary)">
          <span style="font-size:14px;color:var(--gray-700)">Tümünü Seç</span>
        </label>
        ${checkboxler}
      </div>
      <div class="dtm-modal-footer">
        <button id="dtmBelgeIndirIptal" class="btn btn-outline">İptal</button>
        <button id="dtmBelgeIndirWord" class="btn" style="background:#2563eb;color:#fff" title="Sadece DOC işaretli belgeler">&#128196; Word</button>
        <button id="dtmBelgeIndirExcel" class="btn" style="background:#10b981;color:#fff" title="Sadece XLSX işaretli belgeler">&#128202; Excel</button>
        <button id="dtmBelgeIndirOnay" class="btn btn-primary">&#128196; PDF</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const hepsiniCb = document.getElementById('hepsiniSecCb');
  const cbList = overlay.querySelectorAll('.belge-indir-cb');

  hepsiniCb.addEventListener('change', () => {
    cbList.forEach(cb => cb.checked = hepsiniCb.checked);
  });
  cbList.forEach(cb => cb.addEventListener('change', () => {
    const hepsi = [...cbList].every(c => c.checked);
    const hicbiri = [...cbList].every(c => !c.checked);
    hepsiniCb.checked = hepsi;
    hepsiniCb.indeterminate = !hepsi && !hicbiri;
  }));

  document.getElementById('dtmBelgeIndirIptal').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('dtmBelgeIndirOnay').onclick = async () => {
    const secilen = [...overlay.querySelectorAll('.belge-indir-cb:checked')].map(cb => cb.value);
    if (!secilen.length) { showToast('En az bir belge seçin', 'warning'); return; }
    overlay.remove();
    await cokluBelgeIndir(secilen);
  };

  document.getElementById('dtmBelgeIndirExcel').onclick = () => {
    const secilen = [...overlay.querySelectorAll('.belge-indir-cb:checked')]
      .filter(cb => cb.dataset.excel === 'true')
      .map(cb => cb.value);
    if (!secilen.length) { showToast('Excel desteği olan belge seçilmedi (Yaklaşık Maliyet veya Teklif Tutanağı)', 'warning'); return; }
    overlay.remove();
    secilen.forEach(belgeId => belgeIdindenExcelUret(belgeId, proje, referans));
    showToast(`${secilen.length} belge Excel olarak indirildi.`, 'success');
  };

  document.getElementById('dtmBelgeIndirWord').onclick = () => {
    const secilen = [...overlay.querySelectorAll('.belge-indir-cb:checked')]
      .filter(cb => cb.dataset.word === 'true')
      .map(cb => cb.value);
    if (!secilen.length) { showToast('Word desteği olan belge seçilmedi', 'warning'); return; }
    overlay.remove();
    secilen.forEach(belgeId => belgeIdindenWordUret(belgeId, proje, referans));
    showToast(`${secilen.length} belge Word olarak indirildi.`, 'success');
  };
}

async function cokluBelgeIndir(secilen) {
  if (!proje || !currentBelgelerProjeId) { showToast('Proje bulunamadı', 'error'); return; }

  const belgeMap = {
    'yaklasik-maliyet': { render: () => renderYaklasikMaliyet(proje, referans), landscape: true },
    'teklif-tutanagi':  { render: () => renderTeklifTutanagi(proje, referans), landscape: true },
    'teknik-sartname':  { render: () => renderTeknikSartname(proje, referans), landscape: false },
    'sozlesme':         { render: () => renderSozlesme(proje, referans), landscape: false, sozlesme: true },
    'bitti-tutanagi':   { render: () => renderBittiTutanagi(proje, referans), landscape: false },
    'muayene-kabul':    { render: () => renderMuayeneKabulTutanagi(proje, referans), landscape: false },
    'hakedis-raporu':   { render: () => renderHakedisRaporu(proje, referans), landscape: false }
  };

  const parts = [];
  for (const belgeId of secilen) {
    const b = belgeMap[belgeId];
    if (!b) continue;
    parts.push({ html: b.render(), landscape: b.landscape || false });
  }
  if (!parts.length) return;

  const win = window.open('', '_blank');
  if (!win) { showToast('Açılır pencere engellendi. Tarayıcı ayarlarından izin verin.', 'error'); return; }

  const sections = parts.map(b =>
    `<div class="belge-bolum ${b.landscape ? 'pg-yatay' : 'pg-dikey'}">${b.html}</div>`
  ).join('');

  const css = `
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: "Times New Roman", serif; font-size:9pt; color:#000; background:#fff; }
    .belge-bolum { padding:10mm 14mm; }
    .pg-yatay { padding:8mm 10mm; }
    .belge { width:100%; }
    .belge-ust { text-align:center; margin-bottom:10px; }
    .belge-baslik { text-align:center; font-size:13pt; margin:8px 0; font-weight:bold; }
    .bilgi-tablo { width:100%; border-collapse:collapse; margin-bottom:8px; }
    .bilgi-tablo td { padding:2px 5px; vertical-align:top; }
    .bilgi-tablo .etiket { font-weight:bold; }
    .veri-tablo { width:100%; border-collapse:collapse; margin-bottom:8px; border:0.5mm solid #000; }
    .veri-tablo th, .veri-tablo td { border:0.5mm solid #000; padding:2px 4px; text-align:left; font-size:9pt; }
    .veri-tablo th { background:#f0f0f0; text-align:center; font-weight:bold; }
    .rakam { text-align:right !important; } .merkez { text-align:center !important; } .bold { font-weight:bold; }
    .toplam-satir td { font-weight:bold; background:#f9f9f9; }
    .aciklama-metin { margin:12px 0; line-height:1.5; text-align:justify; }
    .imzalar-yan { display:flex; justify-content:space-around; gap:30px; }
    .imza-kutu, .imza-kutu-inline { text-align:center; min-width:150px; }
    .imza-ad { font-weight:bold; margin-top:30px; } .imza-unvan { font-size:9pt; }
    .madde { margin-bottom:10px; line-height:1.45; page-break-inside:avoid; break-inside:avoid; }
    .madde p { margin-top:4px; text-align:justify; }
    .sozlesme .madde p, .sozlesme .madde { font-size:11pt; }
    .sozlesme .madde { margin-bottom:6px; line-height:1.3; }
    .tutanak { font-size:10.5pt; }
    .tutanak .bilgi-tablo td { font-size:10.5pt; padding:3px 5px; }
    .tutanak .belge-baslik { font-size:12.5pt; }
    .sozlesme-imza { margin-top:15px; }
    .hakedis-tablo td:first-child { width:30px; text-align:center; font-weight:bold; }
    small { font-size:8pt; }
    .sozlesme-sayfa-tablo { width:100%; border-collapse:collapse; }
    .sozlesme-sayfa-tablo > tbody > tr > td { padding:0; }
    .sozlesme-sayfa-header { display:block; text-align:center; font-weight:bold; font-size:9.5pt; line-height:1.4; padding:3px 0 5px; margin-bottom:4px; }
    @page dikey  { size: A4 portrait;  margin: 10mm 14mm; }
    @page yatay  { size: A4 landscape; margin: 8mm 10mm; }
    @media print {
      body { 
        padding:0 !important; 
        zoom: 0.95;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .belge-bolum { padding:0 !important; }
      .pg-dikey { page: dikey; break-before: page; }
      .pg-yatay { page: yatay; break-before: page; }
      .pg-dikey:first-child, .pg-yatay:first-child { break-before: avoid; }
      .sozlesme-sayfa-tablo thead { display:table-header-group; }
      .sozlesme-sayfa-tablo tbody { display:table-row-group; }
    }`;

  win.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${proje.isAdi || 'Belgeler'}</title><style>${css}</style></head><body>${sections}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 800);
}

function acGerceklestirmeciIndirModal() {
  if (!proje || !currentGerceklestirmeciBelgelerProjeId) return;

  const mevcut = document.getElementById('dtmBelgeIndirModal');
  if (mevcut) mevcut.remove();

  const isMalVeyaHizmet = proje.isTuru === 'Mal Alımı' || proje.isTuru === 'Hizmet Alımı' || proje.isTuru === 'Danışmanlık';
  const sonTutanakId = isMalVeyaHizmet ? 'muayene-kabul' : 'bitti-tutanagi';
  const sonTutanakAd = isMalVeyaHizmet ? 'Muayene ve Kabul' : 'Bitti Tutanağı';

  const belgeler = [
    { id: 'dt-onay-belgesi', ad: 'D.T. Onay Belgesi', excel: false, word: false },
    { id: 'yaklasik-maliyet', ad: 'Yaklaşık Maliyet', excel: true, word: false },
    { id: 'teklif-tutanagi', ad: 'Teklif Tutanağı', excel: true, word: false },
    { id: 'teknik-sartname', ad: 'Teknik Şartname', excel: false, word: true },
    ...(isMalVeyaHizmet ? [] : [{ id: 'sozlesme', ad: 'Sözleşme', excel: false, word: true }]),
    { id: sonTutanakId, ad: sonTutanakAd, excel: false, word: true },
    { id: 'hakedis-raporu', ad: 'Hakediş Raporu', excel: false, word: true }
  ];

  const checkboxler = belgeler.map(b => `
    <label style="display:flex;align-items:center;gap:10px;padding:9px 0;cursor:pointer;border-bottom:1px solid var(--gray-100);">
      <input type="checkbox" class="belge-indir-cb" value="${b.id}" data-excel="${b.excel}" data-word="${b.word}" checked
        style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary)">
      <span style="font-size:14px;color:var(--gray-800);flex:1">${b.ad}</span>
      ${b.excel ? '<span style="font-size:10px;background:#10b981;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600">XLSX</span>' : ''}
      ${b.word ? '<span style="font-size:10px;background:#2563eb;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600">DOC</span>' : ''}
    </label>`).join('');

  const overlay = document.createElement('div');
  overlay.id = 'dtmBelgeIndirModal';
  overlay.className = 'dtm-modal-overlay';
  overlay.innerHTML = `
    <div class="dtm-modal" style="max-width:420px">
      <div class="dtm-modal-header">
        <h3>&#128196; Belge İndir</h3>
      </div>
      <div class="dtm-modal-body">
        <p style="margin:0 0 14px;font-size:13px;color:var(--gray-500)">İndirilecek belgeleri işaretleyin</p>
        <label style="display:flex;align-items:center;gap:10px;padding:9px 0;cursor:pointer;border-bottom:2px solid var(--gray-200);margin-bottom:2px;font-weight:600;">
          <input type="checkbox" id="hepsiniSecCb2" checked style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary)">
          <span style="font-size:14px;color:var(--gray-700)">Tümünü Seç</span>
        </label>
        ${checkboxler}
      </div>
      <div class="dtm-modal-footer">
        <button id="gcIndirIptal" class="btn btn-outline">İptal</button>
        <button id="gcIndirWord" class="btn" style="background:#2563eb;color:#fff" title="Sadece DOC işaretli belgeler">&#128196; Word</button>
        <button id="gcIndirExcel" class="btn" style="background:#10b981;color:#fff" title="Sadece XLSX işaretli belgeler">&#128202; Excel</button>
        <button id="gcIndirOnay" class="btn btn-primary">&#128196; PDF</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const hepsiniCb = document.getElementById('hepsiniSecCb2');
  const cbList = overlay.querySelectorAll('.belge-indir-cb');
  hepsiniCb.addEventListener('change', () => cbList.forEach(cb => cb.checked = hepsiniCb.checked));
  cbList.forEach(cb => cb.addEventListener('change', () => {
    hepsiniCb.checked = [...cbList].every(c => c.checked);
    hepsiniCb.indeterminate = !hepsiniCb.checked && [...cbList].some(c => c.checked);
  }));

  document.getElementById('gcIndirIptal').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('gcIndirOnay').onclick = () => {
    const secilen = [...overlay.querySelectorAll('.belge-indir-cb:checked')].map(cb => cb.value);
    if (!secilen.length) { showToast('En az bir belge seçin', 'warning'); return; }
    overlay.remove();
    cokluGerceklestirmeciBelgeIndir(secilen);
  };

  document.getElementById('gcIndirExcel').onclick = () => {
    const secilen = [...overlay.querySelectorAll('.belge-indir-cb:checked')]
      .filter(cb => cb.dataset.excel === 'true')
      .map(cb => cb.value);
    if (!secilen.length) { showToast('Excel desteği olan belge seçilmedi (Yaklaşık Maliyet veya Teklif Tutanağı)', 'warning'); return; }
    overlay.remove();
    secilen.forEach(belgeId => belgeIdindenExcelUret(belgeId, proje, referans));
    showToast(`${secilen.length} belge Excel olarak indirildi.`, 'success');
  };

  document.getElementById('gcIndirWord').onclick = () => {
    const secilen = [...overlay.querySelectorAll('.belge-indir-cb:checked')]
      .filter(cb => cb.dataset.word === 'true')
      .map(cb => cb.value);
    if (!secilen.length) { showToast('Word desteği olan belge seçilmedi', 'warning'); return; }
    overlay.remove();
    secilen.forEach(belgeId => belgeIdindenWordUret(belgeId, proje, referans));
    showToast(`${secilen.length} belge Word olarak indirildi.`, 'success');
  };
}

function cokluGerceklestirmeciBelgeIndir(secilen) {
  if (!proje || !currentGerceklestirmeciBelgelerProjeId) return;

  const belgeMap = {
    'dt-onay-belgesi':  { render: () => renderDogrudanTeminOnayBelgesi(proje), landscape: false },
    'yaklasik-maliyet': { render: () => renderYaklasikMaliyet(proje, referans), landscape: true },
    'teklif-tutanagi':  { render: () => renderTeklifTutanagi(proje, referans), landscape: true },
    'teknik-sartname':  { render: () => renderTeknikSartname(proje, referans), landscape: false },
    'sozlesme':         { render: () => renderSozlesme(proje, referans), landscape: false },
    'bitti-tutanagi':   { render: () => renderBittiTutanagi(proje, referans), landscape: false },
    'muayene-kabul':    { render: () => renderMuayeneKabulTutanagi(proje, referans), landscape: false },
    'hakedis-raporu':   { render: () => renderHakedisRaporu(proje, referans), landscape: false }
  };

  const parts = [];
  for (const belgeId of secilen) {
    const b = belgeMap[belgeId];
    if (!b) continue;
    parts.push({ html: b.render(), landscape: b.landscape });
  }
  if (!parts.length) return;

  const win = window.open('', '_blank');
  if (!win) { showToast('Açılır pencere engellendi. Tarayıcı ayarlarından izin verin.', 'error'); return; }

  const sections = parts.map(b =>
    `<div class="belge-bolum ${b.landscape ? 'pg-yatay' : 'pg-dikey'}">${b.html}</div>`
  ).join('');

  const css = `
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: "Times New Roman", serif; font-size:9pt; color:#000; background:#fff; }
    .belge-bolum { padding:10mm 14mm; }
    .pg-yatay { padding:8mm 10mm; }
    .belge { width:100%; }
    .belge-ust { text-align:center; margin-bottom:10px; }
    .belge-baslik { text-align:center; font-size:13pt; margin:8px 0; font-weight:bold; }
    .bilgi-tablo { width:100%; border-collapse:collapse; margin-bottom:8px; }
    .bilgi-tablo td { padding:2px 5px; vertical-align:top; }
    .bilgi-tablo .etiket { font-weight:bold; }
    .veri-tablo { width:100%; border-collapse:collapse; margin-bottom:8px; border:0.5mm solid #000; }
    .veri-tablo th, .veri-tablo td { border:0.5mm solid #000; padding:2px 4px; text-align:left; font-size:9pt; }
    .veri-tablo th { background:#f0f0f0; text-align:center; font-weight:bold; }
    .rakam { text-align:right !important; } .merkez { text-align:center !important; } .bold { font-weight:bold; }
    .toplam-satir td { font-weight:bold; background:#f9f9f9; }
    .aciklama-metin { margin:12px 0; line-height:1.5; text-align:justify; }
    .imzalar-yan { display:flex; justify-content:space-around; gap:30px; }
    .imza-kutu, .imza-kutu-inline { text-align:center; min-width:150px; }
    .imza-ad { font-weight:bold; margin-top:30px; } .imza-unvan { font-size:9pt; }
    .madde { margin-bottom:10px; line-height:1.45; page-break-inside:avoid; break-inside:avoid; }
    .madde p { margin-top:4px; text-align:justify; }
    .sozlesme .madde p, .sozlesme .madde { font-size:11pt; }
    .sozlesme .madde { margin-bottom:6px; line-height:1.3; }
    .tutanak { font-size:10.5pt; }
    .tutanak .bilgi-tablo td { font-size:10.5pt; padding:3px 5px; }
    .tutanak .belge-baslik { font-size:12.5pt; }
    .sozlesme-imza { margin-top:15px; }
    .hakedis-tablo td:first-child { width:30px; text-align:center; font-weight:bold; }
    small { font-size:8pt; }
    .sozlesme-sayfa-tablo { width:100%; border-collapse:collapse; }
    .sozlesme-sayfa-tablo > tbody > tr > td { padding:0; }
    .sozlesme-sayfa-header { display:block; text-align:center; font-weight:bold; font-size:9.5pt; line-height:1.4; padding:3px 0 5px; margin-bottom:4px; }
    @page dikey  { size: A4 portrait;  margin: 10mm 14mm; }
    @page yatay  { size: A4 landscape; margin: 8mm 10mm; }
    @media print {
      body { 
        padding:0 !important; 
        zoom: 0.95;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .belge-bolum { padding:0 !important; }
      .pg-dikey { page: dikey; break-before: page; }
      .pg-yatay { page: yatay; break-before: page; }
      .pg-dikey:first-child, .pg-yatay:first-child { break-before: avoid; }
      .sozlesme-sayfa-tablo thead { display:table-header-group; }
      .sozlesme-sayfa-tablo tbody { display:table-row-group; }
    }`;

  win.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${proje.isAdi || 'Belgeler'}</title><style>${css}</style></head><body>${sections}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 800);
}

const AVATARS = [
  'avatar1','avatar2','avatar3','avatar4','avatar5','avatar6'
];

function avatarSrc(name) {
  return name ? `icons/avatars/${name}.png` : null;
}

function updateSidebarAvatar() {
  const el = document.getElementById('sidebarUserAvatar');
  if (!el) return;
  const src = avatarSrc(currentDTMUser?.avatar);
  if (src) {
    el.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
  } else {
    el.innerHTML = '&#128100;';
  }
}

// ===== AUTH =====
async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  const errDiv = document.getElementById('loginError');
  if (!username || !password) { showLoginError('Kullanıcı adı ve şifre gerekli.'); return; }
  btn.disabled = true;
  btn.innerHTML = '<span>Giriş yapılıyor...</span>';
  errDiv.style.display = 'none';
  try {
    await dtmLogin(username, password);
  } catch(e) {
    // Ağ/sistem hatası: spesifik mesaj. Kimlik hatası: generic mesaj (güvenlik).
    const ozelKodlar = ['auth/network-request-failed', 'auth/too-many-requests', 'auth/requires-recent-login'];
    const mesaj = ozelKodlar.includes(e?.code) ? hataMesaji(e) : 'Kullanıcı adı veya şifre hatalı.';
    showLoginError(mesaj);
    btn.disabled = false;
    btn.innerHTML = '<span>Giriş Yap</span><span class="login-btn-arrow">&#8594;</span>';
  }
}

function toggleLoginPwd(btn) {
  const input = document.getElementById('loginPassword');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.innerHTML = isHidden ? '&#128584;' : '&#128065;';
  btn.classList.toggle('visible', isHidden);
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = 'block';
}

// ===== ŞİFREMİ UNUTTUM MODAL HANDLERS =====
window.sifremiUnuttumModalAc = function() {
  const modal = document.getElementById('sifremiUnuttumModal');
  const input = document.getElementById('sifreSifirlamaInput');
  const msg = document.getElementById('sifreSifirlamaMsg');
  const btn = document.getElementById('btnSifreSifirla');
  const loginUser = document.getElementById('loginUsername')?.value.trim();
  if (input) input.value = loginUser || '';
  if (msg) { msg.style.display = 'none'; msg.textContent = ''; }
  if (btn) { btn.style.display = 'inline-flex'; btn.disabled = false; btn.innerHTML = '<span>Sıfırlama Bağlantısı Gönder</span>'; }
  if (modal) modal.style.display = 'flex';
};

window.sifremiUnuttumModalKapat = function() {
  const modal = document.getElementById('sifremiUnuttumModal');
  if (modal) modal.style.display = 'none';
};

window.sifremiUnuttumGonder = async function(btn) {
  const input = document.getElementById('sifreSifirlamaInput');
  const msg = document.getElementById('sifreSifirlamaMsg');
  const val = (input?.value || '').trim();

  if (!val) {
    if (msg) {
      msg.style.display = 'block';
      msg.style.background = '#fef2f2';
      msg.style.border = '1px solid #fecaca';
      msg.style.color = '#991b1b';
      msg.textContent = 'Lütfen kullanıcı adınızı veya e-posta adresinizi giriniz.';
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Gönderiliyor...</span>';
  }

  try {
    const masked = await sifreSifirlamaGonder(val);
    if (msg) {
      msg.style.display = 'block';
      msg.style.background = '#f0fdf4';
      msg.style.border = '1px solid #bbf7d0';
      msg.style.color = '#166534';
      msg.innerHTML = `✅ <strong>Şifre sıfırlama bağlantısı gönderildi!</strong><br><span style="font-size:12px;opacity:0.9">Bağlantı <strong>${escHtml(masked)}</strong> adresine iletildi. Lütfen gelen kutunuzu (ve spam klasörünü) kontrol ediniz.</span>`;
    }
    if (btn) {
      btn.style.display = 'none';
    }
  } catch(e) {
    if (msg) {
      msg.style.display = 'block';
      msg.style.background = '#fef2f2';
      msg.style.border = '1px solid #fecaca';
      msg.style.color = '#991b1b';
      msg.textContent = e.message || 'Şifre sıfırlama talebi iletilemedi.';
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>Sıfırlama Bağlantısı Gönder</span>';
    }
  }
};

async function doLogout() {
  if (!await showConfirm('Çıkış yapmak istediğinize emin misiniz?', 'Çıkış Yap')) return;
  await dtmLogout();
}

async function onAuthReady(user) {
  const lo = document.getElementById('loadingOverlay');
  if (lo) lo.style.display = 'none';
  if (user && currentDTMUser) {
    // Referansı buluttan yükle (kullanıcı + global)
    // Vision API key'i Remote Config'den yükle
    loadVisionApiKey().catch(e => console.warn('[Vision API] Key yüklenemedi:', e?.code, e?.message));
    try {
      const [cloudRef, globalRef] = await Promise.all([
        loadReferansFromCloud(),
        loadGlobalReferansFromCloud().catch(() => null)
      ]);
      referans = Object.assign(getDefaultReferans(), cloudRef || {});
      if (!cloudRef) await saveReferansToCloud(referans);
      // Global alanları birleştir (globalReferans varsa üzerine yaz)
      if (globalRef) {
        GLOBAL_REF_FIELDS.forEach(f => { if (globalRef[f]) referans[f] = globalRef[f]; });
      }
    } catch(e) {
      referans = loadReferans();
    }
    // Rol bazlı menü görünürlüğü
    const role = currentDTMUser.role;
    document.querySelectorAll('[data-rol]').forEach(el => {
      const roles = el.dataset.rol.split(',');
      el.style.display = roles.includes(role) ? '' : 'none';
    });
    // Duyurular nav item her zaman flex (badge için)
    const duyuruNav = document.querySelector('[data-page="duyurular"]');
    if (duyuruNav) duyuruNav.style.display = 'flex';
    // Kullanıcı bilgisi
    document.getElementById('sidebarUserName').textContent = currentDTMUser.displayName || currentDTMUser.username;
    document.getElementById('sidebarUserRole').textContent = getRoleLabel(currentDTMUser.role);
    updateSidebarAvatar();
    // Ekranları göster/gizle
    // Her oturumda temiz başla
    proje = getDefaultProje();
    currentCloudProjeId = null;
    currentPage = 'anasayfa';
    localStorage.removeItem(STORAGE_KEY);
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('appLayout').style.display = '';
    updateLastLogin();
    init();
    checkDuyurular();
    checkForUpdates(); // Otomatik güncelleme badge kontrolü
    if (currentDTMUser.role === 'gerceklestirmeci') {
      checkGonderilenProjeler();
      setInterval(checkGonderilenProjeler, 30000);
    }
    if (['admin', 'superadmin'].includes(currentDTMUser.role)) {
      checkOnayliProjeler();
      setInterval(checkOnayliProjeler, 30000);
    }
    if (currentDTMUser.role === 'user') checkGeriGonderiend();
  } else {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('appLayout').style.display = 'none';
    const btn = document.getElementById('loginBtn');
    if (btn) { btn.disabled = false; btn.innerHTML = '<span>Giriş Yap</span><span class="login-btn-arrow">&#8594;</span>'; }
    const err = document.getElementById('loginError');
    if (err) err.style.display = 'none';
  }
}

// Tema değiştirme (açık/koyu)
function applyTheme(tema) {
  document.body.classList.toggle('dark', tema === 'dark');
  const label = document.getElementById('themeToggleLabel');
  if (label) label.textContent = tema === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  const yeni = document.body.classList.contains('dark') ? 'light' : 'dark';
  try { localStorage.setItem('dtmTheme', yeni); } catch(e) {}
  applyTheme(yeni);
}
// İlk yükleme — body yoksa hata vermesin diye try
try {
  const kayitli = localStorage.getItem('dtmTheme');
  if (kayitli === 'dark') document.documentElement.classList.add('dark-preload');
} catch(e) {}

// Enter tuşu ile login
document.addEventListener('DOMContentLoaded', () => {
  try {
    const kayitli = localStorage.getItem('dtmTheme') || 'light';
    applyTheme(kayitli);
  } catch(e) {}

  document.getElementById('loginPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('loginUsername').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('loginPassword').focus();
  });
  // Firebase auth state dinleyici
  auth.onAuthStateChanged(async user => {
    if (user) {
      if (!currentDTMUser) {
        const snap = await db.collection('users').doc(user.uid).get();
        if (snap.exists) currentDTMUser = { uid: user.uid, ...snap.data() };
      }
      onAuthReady(user);
    } else {
      onAuthReady(null);
    }
  });

  // Sayfa kapatılırken veya yenilenirken tarayıcı uyarısı göster
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges()) {
      saveProje(proje); // debounce'un yetişemediği son anlık değişikliği de yerel depoya yaz
      e.preventDefault();
      e.returnValue = 'Girdiğiniz verileri henüz kaydetmediniz. Çıkmak istediğinize emin misiniz?';
      return e.returnValue;
    }
  });
});

// Proje gerektiren menüler
const PROJE_GEREKEN_SAYFALAR = ['veri-giris'];

function updateNavLock() {
  document.querySelectorAll('.nav-item').forEach(item => {
    const page = item.dataset.page;
    if (PROJE_GEREKEN_SAYFALAR.includes(page)) {
      item.style.opacity = projeAktif ? '' : '0.35';
      item.style.pointerEvents = projeAktif ? '' : 'none';
      item.title = projeAktif ? '' : 'Önce bir proje oluşturun veya açın.';
    }
  });
}

function init() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      const targetPage = item.dataset.page;
      if (currentPage === targetPage) return;

      // Eğer kaydedilmemiş değişiklikler varsa kullanıcıyı uyar
      if (hasUnsavedChanges()) {
        saveProje(proje); // debounce'un yetişemediği son anlık değişikliği de yerel depoya yaz
        const onay = await showConfirm(
          '⚠️ <strong>Kaydedilmemiş Değişiklikler Var!</strong><br><br>Girdiğiniz bilgileri henüz kaydetmediniz. Başka bir sayfaya geçerseniz son değişiklikler kaybolabilir.<br><br>Yine de devam etmek istiyor musunuz?',
          'Sayfadan Ayrıl'
        );
        if (!onay) return;
      }

      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      currentPage = targetPage;
      currentOnayliBelgelerProjeId = null;
      renderPage();
      updateNavLock();
    });
  });
  // Başlangıç aktif nav item
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-page="${currentPage}"]`)?.classList.add('active');
  updateNavLock();
  renderPage();
}

function autoSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveProje(proje), 300);
}

function renderPage() {
  const main = document.getElementById('mainContent');
  switch (currentPage) {
    case 'anasayfa': renderAnaSayfaPage(); break;
    case 'veri-giris': main.innerHTML = renderVeriGirisPage(); bindVeriGiris(); break;
    case 'belgeler': renderBelgelerPage(); break;
    case 'veri-merkezi': main.innerHTML = renderVeriMerkeziPage(); bindVeriMerkezi(); break;
    case 'dashboard': renderDashboardPage(); break;
    case 'kaydet-yukle': renderKaydetYuklePage(); break;
    case 'kullanici-yonetimi': renderKullaniciYonetimiPage(); break;
    case 'duyurular': renderDuyurularPage(); break;
    case 'projelerim': renderProjelerimPage(); break;
    case 'gonderilen-projeler': renderGonderilenProjelerPage(); break;
    case 'gerceklestirmeci-belgeler': renderGerceklestirmeciBelgelerPage(); break;
    case 'gerceklestirmeci-veri-merkezi': renderGerceklestirmeciVeriMerkeziPageLoader(); break;
    case 'onayli-belgeler': renderOnayliBelgelerPage(); break;
    case 'proje-ozet': renderProjeOzetPage(); break;
    case 'onay-belgesi': renderOnayBelgesiPage(); break;
    case 'profil': main.innerHTML = renderProfilPage(); bindProfil(); break;
    case 'hakkinda': renderHakkindaPage(); break;
  }
}

// ===================== ANA SAYFA =====================
async function renderAnaSayfaPage() {
  const main = document.getElementById('mainContent');
  const ad = currentDTMUser?.displayName?.split(' ')[0] || 'Hoş Geldiniz';
  const saat = new Date().getHours();
  const selamlama = saat < 12 ? 'Günaydın' : saat < 18 ? 'İyi Günler' : 'İyi Akşamlar';

  const userRole = currentDTMUser?.role;
  const roleInfoMap = {
    gerceklestirmeci: { icon: typeof getIcon === 'function' ? getIcon('clipboardCheck', 40) : '📋', mesaj: 'Sol menüden <strong>Gönderilen Projeler</strong> bölümüne giderek size iletilen projeleri görüntüleyebilirsiniz.' },
    admin: { icon: typeof getIcon === 'function' ? getIcon('archive', 40) : '📁', mesaj: 'Sol menüden <strong>Proje Arşivi</strong> bölümüne giderek onaylanmış tüm projeleri görüntüleyebilirsiniz.' },
    superadmin: { icon: typeof getIcon === 'function' ? getIcon('database', 40) : '⚙️', mesaj: 'Sol menüden <strong>Kullanıcı Yönetimi</strong> bölümüne giderek sistemi yönetebilirsiniz.' }
  };
  const roleInfo = roleInfoMap[userRole];

  main.innerHTML = `
    <div style="max-width:700px;margin:0 auto;padding:32px 16px">
      <div style="text-align:center;margin-bottom:40px">
        <img src="icons/Birim Arması.png" style="width:160px;display:block;margin:0 auto 12px" alt="Birim Arması">
        <h1 style="font-size:26px;font-weight:700;color:var(--gray-800);margin-bottom:6px">${selamlama}, ${ad}!</h1>
        <p style="color:var(--gray-500);font-size:14px">Doğrudan Temin Modülü'ne Hoş Geldiniz.</p>
      </div>

      ${roleInfo ? `
      <div class="home-role-card" style="margin-bottom:32px">
        <div style="margin-bottom:12px;color:var(--primary);display:flex;justify-content:center">${roleInfo.icon}</div>
        <p style="color:var(--gray-700);font-size:14px;line-height:1.6">${roleInfo.mesaj}</p>
      </div>` : `
      <div class="home-action-grid">
        <div class="home-action-card primary" onclick="yeniProjeBaslat()">
          <div style="margin-bottom:10px;display:flex;justify-content:center">${typeof getIcon === 'function' ? getIcon('plusCircle', 36) : '📋'}</div>
          <div style="font-weight:700;font-size:16px;margin-bottom:4px">Yeni Proje</div>
          <div style="font-size:12px;opacity:0.85">Yeni bir proje oluştur</div>
        </div>
        <div class="home-action-card outline" onclick="projeAcSayfasinaGit()">
          <div style="margin-bottom:10px;display:flex;justify-content:center;color:var(--primary)">${typeof getIcon === 'function' ? getIcon('folder', 36) : '📂'}</div>
          <div style="font-weight:700;font-size:16px;margin-bottom:4px;color:var(--gray-800)">Proje Aç</div>
          <div style="font-size:12px;color:var(--gray-500)">Kayıtlı projeleri görüntüle</div>
        </div>
      </div>

      <div class="home-recent-card">
        <div style="padding:16px 20px;border-bottom:1px solid var(--gray-100);font-weight:600;font-size:14px;color:var(--gray-700);display:flex;align-items:center;gap:8px">
          ${typeof getIcon === 'function' ? getIcon('calendar', 16) : '⏱'} Son Projeler
        </div>
        <div id="sonProjelerList" style="padding:16px 20px;color:var(--gray-400);font-size:13px;text-align:center">
          Yükleniyor...
        </div>
      </div>`}
    </div>

    <!-- Yeni Proje Modal -->
    <div id="yeniProjeModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;align-items:center;justify-content:center">
      <div style="background:#fff;border-radius:12px;padding:32px;width:460px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.2)">
        <h3 style="margin-bottom:8px;font-size:18px;color:var(--gray-800)">📋 Yeni Proje Oluştur</h3>
        <p style="font-size:13px;color:var(--gray-500);margin-bottom:24px">Nasıl oluşturmak istersiniz?</p>

        <!-- Adım 1: Seçim -->
        <div id="yeniProjeAdim1" style="display:flex;flex-direction:column;gap:12px">
          <button onclick="document.getElementById('yeniProjeAdim1').style.display='none';document.getElementById('yeniProjeAdim2Manuel').style.display='block';setTimeout(()=>document.getElementById('yeniProjeAdi')?.focus(),50)"
            style="padding:16px;border:2px solid var(--gray-200);border-radius:10px;background:#fff;cursor:pointer;text-align:left;font-size:14px;transition:border-color 0.15s"
            onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--gray-200)'">
            <div style="font-weight:600;color:var(--gray-800)">✏️ Manuel Oluştur</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:4px">İş adını kendiniz yazarak başlayın</div>
          </button>
          <button onclick="document.getElementById('yeniProjeAdim1').style.display='none';document.getElementById('yeniProjeAdim2Olur').style.display='block'"
            style="padding:16px;border:2px solid var(--gray-200);border-radius:10px;background:#fff;cursor:pointer;text-align:left;font-size:14px;transition:border-color 0.15s"
            onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--gray-200)'">
            <div style="font-weight:600;color:var(--gray-800)">📄 Olur Dosyasından Oluştur</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:4px">Onay belgesi yükleyerek iş adını otomatik doldurun</div>
          </button>
          <button onclick="document.getElementById('yeniProjeModal').style.display='none'" style="padding:8px;border:none;background:none;cursor:pointer;font-size:13px;color:var(--gray-400)">İptal</button>
        </div>

        <!-- Adım 2a: Manuel -->
        <div id="yeniProjeAdim2Manuel" style="display:none">
          <label style="font-size:13px;font-weight:600;color:var(--gray-700);display:block;margin-bottom:6px">İş / Hizmet Adı</label>
          <input id="yeniProjeAdi" type="text" placeholder="Örn: Çatı Onarım İşi" style="width:100%;padding:10px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:14px;margin-bottom:20px;box-sizing:border-box"
            onkeydown="if(event.key==='Enter')yeniProjeOlustur()">
          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button onclick="document.getElementById('yeniProjeAdim2Manuel').style.display='none';document.getElementById('yeniProjeAdim1').style.display='flex'" style="padding:8px 20px;border:1px solid var(--gray-300);background:#fff;border-radius:6px;cursor:pointer;font-size:13px">← Geri</button>
            <button onclick="yeniProjeOlustur()" class="btn btn-primary" style="padding:8px 20px">Oluştur</button>
          </div>
        </div>

        <!-- Adım 2b: Olur belgesi -->
        <div id="yeniProjeAdim2Olur" style="display:none">
          <p style="font-size:13px;color:var(--gray-600);margin-bottom:16px">Onay belgelerini yükleyin, alanlar otomatik doldurulacak. İkisini birden veya yalnızca birini yükleyebilirsiniz.</p>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
            <!-- YM Belgesi -->
            <div style="padding:14px 18px;background:#eff6ff;border:1.5px dashed #93c5fd;border-radius:8px;display:flex;align-items:center;gap:12px">
              <span style="font-size:13px;color:#1e40af;flex:1;font-weight:500">📄 Y.M. Onay Belgesi</span>
              <span id="ymDosyaAdi" style="font-size:12px;color:#374151;flex:2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
              <label style="cursor:pointer;padding:6px 16px;background:#2563eb;color:#fff;border-radius:6px;font-size:12px;display:inline-block;white-space:nowrap;flex-shrink:0">
                PDF Seç
                <input type="file" accept=".pdf" id="ymPdfInput" style="display:none" onchange="document.getElementById('ymDosyaAdi').textContent=this.files[0]?this.files[0].name:''">
              </label>
            </div>
            <!-- DT Belgesi -->
            <div style="padding:14px 18px;background:#f0fdf4;border:1.5px dashed #86efac;border-radius:8px;display:flex;align-items:center;gap:12px">
              <span style="font-size:13px;color:#166534;flex:1;font-weight:500">📄 D.T. Onay Belgesi</span>
              <span id="dtDosyaAdi" style="font-size:12px;color:#374151;flex:2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
              <label style="cursor:pointer;padding:6px 16px;background:#16a34a;color:#fff;border-radius:6px;font-size:12px;display:inline-block;white-space:nowrap;flex-shrink:0">
                PDF Seç
                <input type="file" accept=".pdf" id="dtPdfInput" style="display:none" onchange="document.getElementById('dtDosyaAdi').textContent=this.files[0]?this.files[0].name:''">
              </label>
            </div>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button onclick="document.getElementById('yeniProjeAdim2Olur').style.display='none';document.getElementById('yeniProjeAdim1').style.display='flex'" style="padding:8px 20px;border:1px solid var(--gray-300);background:#fff;border-radius:6px;cursor:pointer;font-size:13px">← Geri</button>
            <button onclick="parseIkiOlurBelgesi()" style="padding:8px 24px;background:#2563eb;color:#fff;border-radius:6px;font-size:13px;border:none;cursor:pointer;font-weight:600">Oku ve Devam Et →</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Son projeleri sadece kullanıcı rolünde yükle
  if (roleInfo) return;
  try {
    const projeler = await getUserProjeler();
    const listEl = document.getElementById('sonProjelerList');
    if (!listEl) return;
    if (projeler.length === 0) {
      listEl.innerHTML = '<span>Henüz kayıtlı proje yok.</span>';
    } else {
      const son5 = projeler.slice(0, 5);
      listEl.innerHTML = son5.map(p => {
        const tarih = p.updatedAt?.toDate ? p.updatedAt.toDate().toLocaleDateString('tr-TR') : '-';
        return `<div class="home-recent-row" onclick="cloudProjeAc('${p.id}')" style="border-bottom:1px solid var(--gray-100)">
          <span style="font-weight:500;font-size:13px">${p.locked ? '🔒 ' : ''}${escHtml(p.isAdi || '(İsimsiz)')}</span>
          <span style="font-size:12px;color:var(--gray-400)">${tarih}</span>
        </div>`;
      }).join('');
    }
  } catch(e) {
    const listEl = document.getElementById('sonProjelerList');
    if (listEl) listEl.innerHTML = '<span>Projeler yüklenemedi.</span>';
  }
}

function yeniProjeBaslat() {
  let modal = document.getElementById('yeniProjeModal');
  if (!modal) {
    // Modal sadece Ana Sayfa'da render ediliyor; önce oraya git, sonra aç
    currentPage = 'anasayfa';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-page="anasayfa"]')?.classList.add('active');
    renderPage();
    setTimeout(() => {
      const m = document.getElementById('yeniProjeModal');
      if (m) { yeniProjeModalSifirla(m); m.style.display = 'flex'; }
    }, 400);
    return;
  }
  yeniProjeModalSifirla(modal);
  modal.style.display = 'flex';
}

function yeniProjeModalSifirla(modal) {
  // Her açılışta adım 1'e döndür, input temizle
  const adim1 = modal.querySelector('#yeniProjeAdim1');
  const adim2m = modal.querySelector('#yeniProjeAdim2Manuel');
  const adim2o = modal.querySelector('#yeniProjeAdim2Olur');
  if (adim1) adim1.style.display = 'flex';
  if (adim2m) adim2m.style.display = 'none';
  if (adim2o) adim2o.style.display = 'none';
  const inp = modal.querySelector('#yeniProjeAdi');
  if (inp) inp.value = '';
  // Dosya seçimlerini temizle
  const ymInput = modal.querySelector('#ymPdfInput');
  const dtInput = modal.querySelector('#dtPdfInput');
  if (ymInput) ymInput.value = '';
  if (dtInput) dtInput.value = '';
  const ymLabel = modal.querySelector('#ymDosyaAdi');
  const dtLabel = modal.querySelector('#dtDosyaAdi');
  if (ymLabel) ymLabel.textContent = '';
  if (dtLabel) dtLabel.textContent = '';
}

function yeniProjeOlustur() {
  const isAdiEl = document.getElementById('yeniProjeAdi');
  const isAdi = isAdiEl?.value.trim();
  if (!isAdi) { markError(isAdiEl); showToast('Lütfen bir proje adı girin.', 'warning'); return; }
  proje = getDefaultProje();
  proje.isAdi = isAdi;
  currentCloudProjeId = null;
  currentProjeKilitli = false;
  currentProjeBaskaKullanici = false;
  lastSavedProjeSnapshot = JSON.stringify(proje);
  document.getElementById('yeniProjeModal').style.display = 'none';
  projeAktif = true;
  currentPage = 'veri-giris';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('[data-page="veri-giris"]')?.classList.add('active');
  updateNavLock();
  renderPage();
}

function projeAcSayfasinaGit() {
  currentPage = 'projelerim';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('[data-page="projelerim"]')?.classList.add('active');
  renderPage();
}

// ===================== VERİ GİRİŞ SAYFASI =====================
function renderVeriGirisPage() {
  const ymSayisi = proje.ymGorevliSayisi || 1;
  const ymSeciliAdlar = (proje.ymGorevliler || []).slice(0, ymSayisi).map(g => g.ad).filter(Boolean);
  const ymGorevliRows = proje.ymGorevliler.slice(0, ymSayisi).map((g, i) => `
    <div class="form-grid" style="position:relative">
      <div class="form-group">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <label style="margin-bottom:0">Y.M. Görevlisi ${i + 1}</label>
          ${i > 0 ? `<button type="button" onclick="onGorevliSil('ym', ${i})" title="Bu görevliyi kaldır" style="background:none;border:none;color:#ef4444;font-size:12px;cursor:pointer;padding:2px 6px;border-radius:4px" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='none'">✕ Sil</button>` : ''}
        </div>
        <select data-field="ymGorevliler" data-index="${i}" data-sub="ad" onchange="onGorevliChange(this, 'ym')">
          <option value="">-- Seçin --</option>
          ${referans.muhendisList.map(m => {
            const baskaSecili = g.ad !== m.ad && ymSeciliAdlar.includes(m.ad);
            return `<option value="${escAttr(m.ad)}" ${g.ad === m.ad ? 'selected' : ''} ${baskaSecili ? 'disabled style="color:#9ca3af"' : ''}>${escHtml(m.ad)}${baskaSecili ? ' (Seçildi)' : ''}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Ünvanı</label>
        <input type="text" value="${escAttr(g.unvan || getUnvanByAd(g.ad, referans))}" readonly>
      </div>
    </div>`).join('');
  const ymEkleBtn = ymSayisi < 3 ? `<button class="btn btn-outline btn-sm" onclick="onGorevliEkle('ym')" style="margin-top:6px;">+ Y.M. Görevlisi Ekle</button>` : '';

  const dtSayisi = proje.dtGorevliSayisi || 1;
  const dtSeciliAdlar = (proje.dtGorevliler || []).slice(0, dtSayisi).map(g => g.ad).filter(Boolean);
  const dtGorevliRows = proje.dtGorevliler.slice(0, dtSayisi).map((g, i) => `
    <div class="form-grid" style="position:relative">
      <div class="form-group">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <label style="margin-bottom:0">D.T. Görevlisi ${i + 1} ${proje.dtGorevlilerYmIleAyni ? '<span style="font-weight:400;color:var(--primary);font-size:11px">(Y.M. Görevlisi ' + (i+1) + ')</span>' : ''}</label>
          ${i > 0 && !proje.dtGorevlilerYmIleAyni ? `<button type="button" onclick="onGorevliSil('dt', ${i})" title="Bu görevliyi kaldır" style="background:none;border:none;color:#ef4444;font-size:12px;cursor:pointer;padding:2px 6px;border-radius:4px" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='none'">✕ Sil</button>` : ''}
        </div>
        <select data-field="dtGorevliler" data-index="${i}" data-sub="ad" onchange="onGorevliChange(this, 'dt')" ${proje.dtGorevlilerYmIleAyni ? 'disabled style="background:#f8fafc;cursor:not-allowed"' : ''}>
          <option value="">-- Seçin --</option>
          ${referans.muhendisList.map(m => {
            const baskaSecili = g.ad !== m.ad && dtSeciliAdlar.includes(m.ad);
            return `<option value="${escAttr(m.ad)}" ${g.ad === m.ad ? 'selected' : ''} ${baskaSecili ? 'disabled style="color:#9ca3af"' : ''}>${escHtml(m.ad)}${baskaSecili ? ' (Seçildi)' : ''}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Ünvanı</label>
        <input type="text" value="${escAttr(g.unvan || getUnvanByAd(g.ad, referans))}" readonly ${proje.dtGorevlilerYmIleAyni ? 'style="background:#f8fafc"' : ''}>
      </div>
    </div>`).join('');
  const dtEkleBtn = dtSayisi < 3 ? `<button class="btn btn-outline btn-sm" onclick="onGorevliEkle('dt')" style="margin-top:6px;">+ D.T. Görevlisi Ekle</button>` : '';

  if (!proje.mkGorevliler) proje.mkGorevliler = [{ad:'', unvan:''}, {ad:'', unvan:''}, {ad:'', unvan:''}];
  const mkSayisi = proje.mkGorevliSayisi || 1;
  const mkSeciliAdlar = (proje.mkGorevliler || []).slice(0, mkSayisi).map(g => g.ad).filter(Boolean);
  const mkGorevliRows = proje.mkGorevliler.slice(0, mkSayisi).map((g, i) => `
    <div class="form-grid" style="position:relative">
      <div class="form-group">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <label style="margin-bottom:0">Muayene Kabul Görevlisi ${i + 1}</label>
          ${i > 0 ? `<button type="button" onclick="onGorevliSil('mk', ${i})" title="Bu görevliyi kaldır" style="background:none;border:none;color:#ef4444;font-size:12px;cursor:pointer;padding:2px 6px;border-radius:4px" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='none'">✕ Sil</button>` : ''}
        </div>
        <select data-field="mkGorevliler" data-index="${i}" data-sub="ad" onchange="onGorevliChange(this, 'mk')">
          <option value="">-- Seçin --</option>
          ${referans.muhendisList.map(m => {
            const baskaSecili = g.ad !== m.ad && mkSeciliAdlar.includes(m.ad);
            return `<option value="${escAttr(m.ad)}" ${g.ad === m.ad ? 'selected' : ''} ${baskaSecili ? 'disabled style="color:#9ca3af"' : ''}>${escHtml(m.ad)}${baskaSecili ? ' (Seçildi)' : ''}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Ünvanı</label>
        <input type="text" value="${escAttr(g.unvan || getUnvanByAd(g.ad, referans))}" readonly>
      </div>
    </div>`).join('');
  const mkEkleBtn = mkSayisi < 3 ? `<button class="btn btn-outline btn-sm" onclick="onGorevliEkle('mk')" style="margin-top:6px;">+ Muayene Kabul Görevlisi Ekle</button>` : '';

  const kalemler = proje.isTuru === 'Yapım İşi' ? '' : proje.isKalemleri.map((k, i) => `
    <tr>
      <td class="merkez">${i + 1}</td>
      <td><input type="text" value="${k.ad}" data-field="isKalemleri" data-index="${i}" data-sub="ad" onchange="onKalemChange(this)"></td>
      <td><input type="number" value="${k.miktar}" data-field="isKalemleri" data-index="${i}" data-sub="miktar" onchange="onKalemChange(this)" style="width:80px"></td>
      <td><select data-field="isKalemleri" data-index="${i}" data-sub="birim" onchange="onKalemChange(this)">
        <option value="">--</option>
        ${referans.birimList.map(b => `<option value="${b}" ${k.birim === b ? 'selected' : ''}>${b}</option>`).join('')}
      </select></td>
    </tr>`).join('');

  const kalemlerSection = proje.isTuru === 'Yapım İşi' ? `
    <div class="card-body">
      <p style="color:var(--gray-500)">Yapım İşi seçildiğinde iş kalemi otomatik olarak iş adı ve miktar 1 olarak belirlenir.</p>
    </div>` : `
    <div class="card-body">
      <table class="data-table">
        <thead><tr><th>S.No</th><th>Kalem Adı</th><th>Miktar</th><th>Birim</th></tr></thead>
        <tbody>${kalemler}</tbody>
      </table>
    </div>`;

  // YM Firma tabloları
  const aktifKalemler = getKalemler(proje);
  const ymFirmaRows = proje.ymFirmalar.map((f, fi) => `
    <div class="card" style="margin-bottom:12px">
      <div class="card-body" style="padding:12px">
        <div class="form-group" style="margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <label style="margin:0">${fi + 1}. Firma</label>
            <label title="PDF'den oku" style="cursor:pointer;padding:3px 8px;background:#eff6ff;border:1px solid #93c5fd;border-radius:5px;font-size:11px;color:#1e40af;white-space:nowrap">
              📄 PDF'den Oku
              <input type="file" accept=".pdf" style="display:none" onchange="parseTeklifPDF(this.files[0],'ym',${fi});this.value=''">
            </label>
          </div>
          <select data-field="ymFirmalar" data-index="${fi}" data-sub="ad" onchange="onFirmaChange(this, 'ym')">
            <option value="">-- Firma Seçin --</option>
            ${[...referans.firmaList].sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(fr => `<option value="${fr.ad}" ${f.ad === fr.ad ? 'selected' : ''}>${fr.ad}</option>`).join('')}
          </select>
        </div>
        <table class="data-table">
          <thead><tr><th>Kalem</th><th>Birim Fiyat (TL)</th><th>Toplam (TL)</th></tr></thead>
          <tbody>
            ${aktifKalemler.map((k, ki) => {
              const bf = f.fiyatlar[ki] || 0;
              const toplam = bf * (parseFloat(k.miktar) || 0);
              return `<tr>
                <td>${k.ad || '-'}</td>
                <td><input type="number" value="${bf || ''}" data-firma="ym" data-fi="${fi}" data-ki="${ki}" onchange="onFiyatChange(this)" style="width:120px"></td>
                <td class="rakam">${toplam > 0 ? formatCurrency(toplam) : '-'}</td>
              </tr>`;
            }).join('')}
            <tr class="toplam-row">
              <td colspan="2"><strong>TOPLAM</strong></td>
              <td class="rakam"><strong>${formatCurrency(hesaplaYMFirmaToplam(f, aktifKalemler))}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`).join('');

  const yaklasikMaliyet = hesaplaYaklasikMaliyet(proje);
  const ymSinirAsildi = (() => {
    if (!proje.ymOnayTarihi) return false;
    const yil = new Date(proje.ymOnayTarihi).getFullYear();
    const sinirObj = (referans.dtSinirlari || []).find(s => s.yil === yil);
    return sinirObj && sinirObj.sinir > 0 && yaklasikMaliyet > sinirObj.sinir;
  })();

  // Teklif Firma tabloları
  const teklifFirmaRows = proje.teklifFirmalar.map((f, fi) => {
    const kazananIdx = proje.kazananFirmaIndex >= 0 ? proje.kazananFirmaIndex : hesaplaKazananFirma(proje);
    const isKazanan = fi === kazananIdx;
    return `
    <div class="card" style="margin-bottom:12px;${isKazanan ? 'border:2px solid var(--success)' : ''}">
      <div class="card-body" style="padding:12px">
        <div class="form-group" style="margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <label style="margin:0">${fi + 1}. Firma ${isKazanan ? '(KAZANAN)' : ''}</label>
            <label title="PDF'den oku" style="cursor:pointer;padding:3px 8px;background:#f0fdf4;border:1px solid #86efac;border-radius:5px;font-size:11px;color:#166534;white-space:nowrap">
              📄 PDF'den Oku
              <input type="file" accept=".pdf" style="display:none" onchange="parseTeklifPDF(this.files[0],'teklif',${fi});this.value=''">
            </label>
          </div>
          <select data-field="teklifFirmalar" data-index="${fi}" data-sub="ad" onchange="onFirmaChange(this, 'teklif')">
            <option value="">-- Firma Seçin --</option>
            ${[...referans.firmaList].sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(fr => `<option value="${fr.ad}" ${f.ad === fr.ad ? 'selected' : ''}>${fr.ad}</option>`).join('')}
          </select>
        </div>
        <table class="data-table">
          <thead><tr><th>Kalem</th><th>Birim Fiyat (TL)</th><th>Toplam (TL)</th></tr></thead>
          <tbody>
            ${aktifKalemler.map((k, ki) => {
              const bf = f.fiyatlar[ki] || 0;
              const toplam = bf * (parseFloat(k.miktar) || 0);
              return `<tr>
                <td>${k.ad || '-'}</td>
                <td><input type="number" value="${bf || ''}" data-firma="teklif" data-fi="${fi}" data-ki="${ki}" onchange="onFiyatChange(this)" style="width:120px"></td>
                <td class="rakam">${toplam > 0 ? formatCurrency(toplam) : '-'}</td>
              </tr>`;
            }).join('')}
            <tr class="toplam-row">
              <td colspan="2"><strong>TOPLAM</strong></td>
              <td class="rakam"><strong>${formatCurrency(hesaplaTeklifFirmaToplam(f, aktifKalemler))}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  const kilitBanner = currentProjeBaskaKullanici ? `
    <div style="background:#eff6ff;border:1.5px solid #3b82f6;border-radius:8px;padding:12px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
      <span style="font-size:20px">👁️</span>
      <div>
        <strong style="color:#1e40af;font-size:14px">İzleme Modu.</strong>
        <span style="color:#1e3a8a;font-size:13px"> Bu proje başka bir kullanıcıya ait. Sadece görüntüleyebilirsiniz.</span>
      </div>
    </div>` : currentProjeKilitli ? `
    <div style="background:#fef3c7;border:1.5px solid #f59e0b;border-radius:8px;padding:12px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
      <span style="font-size:20px">🔒</span>
      <div>
        <strong style="color:#92400e;font-size:14px">Bu proje kilitli.</strong>
        <span style="color:#78350f;font-size:13px"> Düzenleme yapılamaz. Kilidi kaldırmak için Kaydet / Yükle sayfasına gidin.</span>
      </div>
    </div>` : '';

  return `
    ${kilitBanner}
    <div class="page-header">
      <h2>Veri Giriş Formu</h2>
      <p>Proje bilgilerini girin, belgeler otomatik oluşturulacaktır.</p>
    </div>

    <!-- PROJE BİLGİLERİ -->
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Proje Bilgileri</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label>İdare Adı</label>
            <select id="idareAdi" onchange="onFieldChange('idareAdi', this.value)">
              ${referans.idareList.map(i => `<option value="${i}" ${proje.idareAdi === i ? 'selected' : ''}>${i}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Müdürlük</label>
            <select id="mudurluk" onchange="onFieldChange('mudurluk', this.value)">
              ${referans.mudurlukler.map(m => `<option value="${m}" ${proje.mudurluk === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <div class="form-group full-width">
            <label>Yapılan İş / Hizmet Adı</label>
            <input type="text" id="isAdi" value="${escAttr(proje.isAdi)}" onchange="onFieldChange('isAdi', this.value)">
          </div>
          <div class="form-group full-width" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:16px">
            <div class="form-group">
              <label>İş Türü</label>
              <select id="isTuru" onchange="onFieldChange('isTuru', this.value); renderPage();">
                ${referans.isTurleri.map(t => {
                  const aktif = t === 'Yapım İşi' || t === 'Mal Alımı';
                  return `<option value="${t}" ${proje.isTuru === t ? 'selected' : ''} ${!aktif ? 'disabled style="color:#9ca3af"' : ''}>${t}${!aktif ? ' (yakında)' : ''}</option>`;
                }).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>KDV Oranı (%)</label>
              <select id="kdvOrani" onchange="onFieldChange('kdvOrani', parseFloat(this.value))">
                ${referans.kdvOranlari.map(k => `<option value="${k}" ${proje.kdvOrani == k ? 'selected' : ''}>${k}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Şehir</label>
              <input type="text" id="sehir" value="${escAttr(proje.sehir)}" onchange="onFieldChange('sehir', this.value)">
            </div>
            <div class="form-group">
              <label>İlçe</label>
              <select id="ilce" onchange="onFieldChange('ilce', this.value)">
                <option value="">-- Seçin --</option>
                ${referans.ilceler.map(i => `<option value="${i}" ${proje.ilce === i ? 'selected' : ''}>${i}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- GÖREVLİLER -->
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Y.M. Görevlileri</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div style="margin-bottom:14px;padding:10px 14px;background:#eff6ff;border:1.5px dashed #93c5fd;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <span style="font-size:13px;color:#1e40af;">📄 Olur belgesinden otomatik doldur</span>
          <label style="cursor:pointer;padding:6px 16px;background:#2563eb;color:#fff;border-radius:6px;font-size:13px;white-space:nowrap;user-select:none">
            PDF Seç
            <input type="file" accept=".pdf" style="display:none" onchange="parseYMOluru(this.files[0]);this.value=''">
          </label>
        </div>
        ${ymGorevliRows}
        ${ymEkleBtn}
        <div class="form-grid" style="margin-top:12px">
          <div class="form-group">
            <label>Y.M. Onay Tarihi</label>
            <input type="date" id="ymOnayTarihi" value="${proje.ymOnayTarihi}" onchange="onFieldChange('ymOnayTarihi', this.value)">
          </div>
          <div class="form-group">
            <label>Onay Sayısı</label>
            <input type="text" id="ymOnayNo" value="${escAttr(proje.ymOnayNo)}" onchange="onFieldChange('ymOnayNo', this.value)">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Y.M. Tutanak Tarihi</label>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:normal;font-size:13px">
                <input type="checkbox" ${proje.ymTutanakTarihiAyni !== false ? 'checked' : ''} onchange="onFieldChange('ymTutanakTarihiAyni', this.checked);renderPage()">
                Onay tarihi ile aynı
              </label>
              ${proje.ymTutanakTarihiAyni !== false
                ? `<span style="font-size:13px;color:var(--gray-500)">${proje.ymOnayTarihi ? formatDate(proje.ymOnayTarihi) : '(Önce onay tarihi girin)'}</span>`
                : `<input type="date" value="${proje.ymTutanakTarihi || ''}" onchange="onFieldChange('ymTutanakTarihi', this.value)">`
              }
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>D.T. Görevlileri</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div style="margin-bottom:14px;padding:10px 14px;background:#eff6ff;border:1.5px dashed #93c5fd;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <span style="font-size:13px;color:#1e40af;">📄 Olur belgesinden otomatik doldur</span>
          <label style="cursor:pointer;padding:6px 16px;background:#2563eb;color:#fff;border-radius:6px;font-size:13px;white-space:nowrap;user-select:none">
            PDF Seç
            <input type="file" accept=".pdf" style="display:none" onchange="parseDTOluru(this.files[0]);this.value=''">
          </label>
        </div>

        <div style="margin-bottom:14px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;color:#1e293b;user-select:none">
            <input type="checkbox" id="dtGorevliAyniCb" ${proje.dtGorevlilerYmIleAyni ? 'checked' : ''} onchange="onDtGorevliAyniToggle(this.checked)" style="width:16px;height:16px;accent-color:var(--primary);cursor:pointer">
            <span>👥 Yaklaşık Maliyet Görevlileri ile aynı kişiler</span>
          </label>
          ${proje.dtGorevlilerYmIleAyni ? '<p style="margin:4px 0 0 24px;font-size:12px;color:#64748b">Y.M. görevlilerinde yapılan değişiklikler otomatik olarak buraya yansıtılır.</p>' : ''}
        </div>

        ${dtGorevliRows}
        ${!proje.dtGorevlilerYmIleAyni ? dtEkleBtn : ''}
        <div class="form-grid" style="margin-top:12px">
          <div class="form-group">
            <label>D.T. Onay Tarihi</label>
            <input type="date" id="dtOnayTarihi" value="${proje.dtOnayTarihi}" onchange="onFieldChange('dtOnayTarihi', this.value)">
          </div>
          <div class="form-group">
            <label>Onay Sayısı</label>
            <input type="text" id="dtOnayNo" value="${escAttr(proje.dtOnayNo)}" onchange="onFieldChange('dtOnayNo', this.value)">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Teklif Tutanağı Tarihi</label>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:normal;font-size:13px">
                <input type="checkbox" ${proje.dtTutanakTarihiAyni !== false ? 'checked' : ''} onchange="onFieldChange('dtTutanakTarihiAyni', this.checked);renderPage()">
                Onay tarihi ile aynı
              </label>
              ${proje.dtTutanakTarihiAyni !== false
                ? `<span style="font-size:13px;color:var(--gray-500)">${proje.dtOnayTarihi ? formatDate(proje.dtOnayTarihi) : '(Önce onay tarihi girin)'}</span>`
                : `<input type="date" value="${proje.dtTutanakTarihi || ''}" onchange="onFieldChange('dtTutanakTarihi', this.value)">`
              }
            </div>
          </div>
        </div>
      </div>
    </div>

    ${currentDTMUser?.role === 'gerceklestirmeci' ? `<div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Onay Belgesi Bilgileri</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Kullanılabilir Ödenek Tutarı (TL)</label>
            <input type="number" id="odenek" value="${proje.odenek}" oninput="onFieldChange('odenek', this.value)" placeholder="0.00">
          </div>
          <div class="form-group">
            <label>Yatırım Proje Numarası</label>
            <input type="text" id="yatirimProjeNo" value="${escAttr(proje.yatirimProjeNo)}" oninput="onFieldChange('yatirimProjeNo', this.value)" placeholder="Varsa giriniz">
          </div>
          <div class="form-group">
            <label>Bütçe Tertibi</label>
            <input type="text" id="butceTertibi" value="${escAttr(proje.butceTertibi)}" oninput="onFieldChange('butceTertibi', this.value)" placeholder="Örn: 09.1.2.00.000/05/03.8">
          </div>
          <div class="form-group">
            <label>İşin Miktarı</label>
            <input type="text" id="isMiktari" value="${proje.isTuru === 'Yapım İşi' ? '1 Adet' : escAttr(proje.isMiktari || '')}"
              ${proje.isTuru === 'Yapım İşi' ? 'readonly style="background:#f3f4f6"' : ''}
              oninput="onFieldChange('isMiktari', this.value)" placeholder="Örn: 5 Adet">
          </div>
          <div class="form-group">
            <label>Avans Verilecek mi</label>
            <select id="avansVar" onchange="onFieldChange('avansVar', this.value)">
              <option value="Hayır" ${(proje.avansVar||'Hayır')==='Hayır'?'selected':''}>Hayır</option>
              <option value="Evet" ${proje.avansVar==='Evet'?'selected':''}>Evet</option>
            </select>
          </div>
          <div class="form-group">
            <label>Fiyat Farkı Uygulanacak mı</label>
            <select id="fiyatFarkiVar" onchange="onFieldChange('fiyatFarkiVar', this.value)">
              <option value="Hayır" ${(proje.fiyatFarkiVar||'Hayır')==='Hayır'?'selected':''}>Hayır</option>
              <option value="Evet" ${proje.fiyatFarkiVar==='Evet'?'selected':''}>Evet</option>
            </select>
          </div>
          <div class="form-group">
            <label>Şartname Düzenlenecek mi</label>
            <select id="sartnameVar" onchange="onFieldChange('sartnameVar', this.value)">
              <option value="Düzenlenecek" ${(proje.sartnameVar||'Düzenlenecek')==='Düzenlenecek'?'selected':''}>Düzenlenecek</option>
              <option value="Düzenlenmeyecek" ${proje.sartnameVar==='Düzenlenmeyecek'?'selected':''}>Düzenlenmeyecek</option>
            </select>
          </div>
          <div class="form-group">
            <label>Sözleşme Düzenlenecek mi</label>
            <select id="sozlesmeVar" onchange="onFieldChange('sozlesmeVar', this.value)">
              <option value="Düzenlenecek" ${(proje.sozlesmeVar||'Düzenlenecek')==='Düzenlenecek'?'selected':''}>Düzenlenecek</option>
              <option value="Düzenlenmeyecek" ${proje.sozlesmeVar==='Düzenlenmeyecek'?'selected':''}>Düzenlenmeyecek</option>
            </select>
          </div>
        </div>
        <div style="margin-top:12px;font-size:13px;font-weight:600;color:#374151;margin-bottom:8px">Gerçekleştirme Görevlisi</div>
        <div class="form-grid">
          <div class="form-group">
            <label>Adı Soyadı</label>
            <input type="text" id="gerceklestirmeAd" value="${escAttr(proje.gerceklestirmeGorevlisi?.ad||'')}"
              oninput="onFieldChange('gerceklestirmeGorevlisi', {ad:this.value,unvan:document.getElementById('gerceklestirmeUnvan').value})">
          </div>
          <div class="form-group">
            <label>Ünvanı</label>
            <input type="text" id="gerceklestirmeUnvan" value="${escAttr(proje.gerceklestirmeGorevlisi?.unvan||'Gerçekleştirme Görevlisi')}"
              oninput="onFieldChange('gerceklestirmeGorevlisi', {ad:document.getElementById('gerceklestirmeAd').value,unvan:this.value})">
          </div>
        </div>
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Onaylayan Amir</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Amir Adı</label>
            <select id="onaylayanAmir" onchange="onAmirChange(this)">
              <option value="">-- Seçin --</option>
              ${referans.onaylayanList.filter(o=>o.ad).map(o => `<option value="${escAttr(o.ad)}" ${proje.onaylayanAmir.ad === o.ad ? 'selected' : ''}>${escHtml(o.ad)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Ünvanı</label>
            <input type="text" id="onaylayanUnvan" value="${escAttr(proje.onaylayanAmir.unvan)}" readonly>
          </div>
        </div>
      </div>
    </div>

    ${proje.isTuru === 'Yapım İşi' ? `
    <!-- TARİHLER -->
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Sözleşme ve Tarihler</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Sözleşme Tarihi</label>
            <input type="date" id="sozlesmeTarihi" value="${proje.sozlesmeTarihi}" onchange="onFieldChange('sozlesmeTarihi', this.value)">
          </div>
          <div class="form-group">
            <label>İş Süresi (Takvim Günü)</label>
            <input type="number" id="isSuresi" value="${proje.isSuresi}" oninput="onFieldChange('isSuresi', this.value)">
          </div>
          <div class="form-group">
            <label>İşin Bitirilmesi Gereken Tarih</label>
            <div style="display:flex;align-items:center;gap:8px">
              <input type="text" id="bitisTarihi" value="${formatDate(calculateEndDate(proje.sozlesmeTarihi, proje.isSuresi))}" readonly style="flex:1">
              <button type="button" onclick="(function(){ document.getElementById('bitisTarihi').value = formatDate(calculateEndDate(proje.sozlesmeTarihi, proje.isSuresi)); })()" title="Tarihi Güncelle" style="padding:6px 10px;background:#fff;color:#555;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;font-size:14px;white-space:nowrap;transition:all 0.15s" onmouseover="this.style.borderColor='#1a56db';this.style.color='#1a56db'" onmouseout="this.style.borderColor='#d1d5db';this.style.color='#555'">&#x21BB;</button>
            </div>
          </div>
          <div class="form-group">
            <label>İşin Fiili Bitim Tarihi</label>
            <input type="date" id="fiiliBitimTarihi" value="${proje.fiiliBitimTarihi}" onchange="onFieldChange('fiiliBitimTarihi', this.value)">
          </div>
          <div class="form-group">
            <label>Bitti Tutanağı Ekleri <span style="font-weight:400;color:var(--gray-400);font-size:11px">(opsiyonel)</span></label>
            <div id="bittiEkleriList">
              ${(Array.isArray(proje.bittiEkleri) ? proje.bittiEkleri : proje.bittiEkleri ? [proje.bittiEkleri] : []).map((ek, i) => `
                <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
                  <span style="min-width:20px;font-size:13px;color:var(--gray-500);font-weight:600">${i + 1}-</span>
                  <input type="text" value="${escHtml(ek)}" data-ek-index="${i}" placeholder="Ek açıklaması"
                    style="flex:1" onchange="onBittiEkChange(this)">
                  <button type="button" onclick="onBittiEkSil(${i})"
                    style="padding:5px 9px;background:#fff;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;color:#6b7280;font-size:14px;line-height:1;transition:all 0.15s"
                    onmouseover="this.style.borderColor='#ef4444';this.style.color='#ef4444'"
                    onmouseout="this.style.borderColor='#d1d5db';this.style.color='#6b7280'">✕</button>
                </div>`).join('')}
            </div>
            <button type="button" onclick="onBittiEkEkle()"
              class="btn btn-outline btn-sm" style="margin-top:4px">+ Ek Ekle</button>
          </div>
        </div>
      </div>
    </div>` : ''}

    ${proje.isTuru !== 'Yapım İşi' ? `
    <!-- MUAYENE VE KABUL KOMİSYONU / HEYETİ -->
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Muayene ve Kabul Komisyonu (Heyeti)</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        ${mkGorevliRows}
        ${mkEkleBtn}
        <div class="form-grid" style="margin-top:14px">
          <div class="form-group">
            <label>Muayene Kabul Tarihi</label>
            <input type="date" id="mkKabulTarihi" value="${proje.mkKabulTarihi || ''}" onchange="onFieldChange('mkKabulTarihi', this.value)">
          </div>
          <div class="form-group">
            <label>Komisyon Atama Tarihi</label>
            <input type="date" id="mkAtamaTarihi" value="${proje.mkAtamaTarihi || ''}" onchange="onFieldChange('mkAtamaTarihi', this.value)">
          </div>
          <div class="form-group">
            <label>Komisyon Atama Olur / Karar Sayısı</label>
            <input type="text" id="mkAtamaSayisi" value="${escAttr(proje.mkAtamaSayisi || '')}" oninput="onFieldChange('mkAtamaSayisi', this.value)" placeholder="Örn: E-12345678-xxx-987">
          </div>
        </div>
      </div>
    </div>` : ''}

    <!-- İŞ KALEMLERİ -->
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>İş Kalemleri</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      ${kalemlerSection}
    </div>

    <!-- YAKLAŞIK MALİYET FİRMALARI -->
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Yaklaşık Maliyet - Firma Teklifleri</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        ${ymFirmaRows}
        <div style="margin-top:12px; padding:12px; background:${ymSinirAsildi ? '#fef2f2' : 'var(--primary-light)'}; border-radius:6px; border:${ymSinirAsildi ? '1px solid #fca5a5' : 'none'}">
          <strong>Yaklaşık Maliyet: ${formatCurrency(yaklasikMaliyet)} TL</strong>
          <span style="color:var(--gray-500); margin-left:10px;">(${sayidanYaziya(yaklasikMaliyet)})</span>
          ${ymSinirAsildi ? '<div style="color:#dc2626;font-size:12px;margin-top:4px;font-weight:600">⚠️ Doğrudan Temin sınırı aşıldı!</div>' : ''}
        </div>
      </div>
    </div>

    <!-- TEKLİF FİRMALARI -->
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Resmi Teklif - Firma Teklifleri</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        ${teklifFirmaRows}
      </div>
    </div>

    <!-- HAKEDİŞ KESİNTİLERİ -->
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Hakediş Kesintileri</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Önceki Hakediş Tutarı (TL)</label>
            <input type="number" value="${proje.oncekiHakedisTutar}" onchange="onFieldChange('oncekiHakedisTutar', parseFloat(this.value)||0)">
          </div>
          <div class="form-group">
            <label>Fiyat Farkı (TL)</label>
            <input type="number" value="${proje.fiyatFarki}" onchange="onFieldChange('fiyatFarki', parseFloat(this.value)||0)">
          </div>
          <div class="form-group">
            <label>Sözleşme Damga Vergisi (TL)</label>
            <input type="number" value="${proje.sozlesmeDamgaVergisi}" onchange="onFieldChange('sozlesmeDamgaVergisi', parseFloat(this.value)||0)">
          </div>
          <div class="form-group">
            <label>SGK Kesintisi (TL)</label>
            <input type="number" value="${proje.sgkKesintisi}" onchange="onFieldChange('sgkKesintisi', parseFloat(this.value)||0)">
          </div>
          <div class="form-group">
            <label>Vergi Borcu (TL)</label>
            <input type="number" value="${proje.vergiBorcu}" onchange="onFieldChange('vergiBorcu', parseFloat(this.value)||0)">
          </div>
          <div class="form-group">
            <label>Gecikme Cezası (TL)</label>
            <input type="number" value="${proje.gecikmeCezasi}" onchange="onFieldChange('gecikmeCezasi', parseFloat(this.value)||0)">
          </div>
          <div class="form-group">
            <label>Avans Mahsubu (TL)</label>
            <input type="number" value="${proje.avansMahsubu}" onchange="onFieldChange('avansMahsubu', parseFloat(this.value)||0)">
          </div>
        </div>
      </div>
    </div>

    ${!currentProjeKilitli ? `
    <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid #e5e7eb;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:100;box-shadow:0 -2px 8px rgba(0,0,0,0.06)">
      <span style="font-size:13px;color:#6b7280">
        ${currentCloudProjeId ? '💡 Değişikliklerinizi kaydetmeyi unutmayın.' : '💡 Proje henüz kaydedilmedi.'}
      </span>
      <button class="btn btn-primary" onclick="cloudKaydet()" style="min-width:140px">
        💾 Kaydet
      </button>
    </div>` : ''}
  `;
}

function bindVeriGiris() {
  if (currentProjeKilitli) {
    document.querySelectorAll('#mainContent input, #mainContent select, #mainContent button').forEach(el => {
      el.disabled = true;
    });
  }
}

function onFieldChange(field, value) {
  const eskiDeger = proje[field];
  proje[field] = value;

  // Gelecek tarih kontrolü
  if (['ymOnayTarihi', 'dtOnayTarihi', 'sozlesmeTarihi'].includes(field) && value) {
    const bugun = new Date().toISOString().slice(0, 10);
    if (value > bugun) {
      showToast('Tarih bugünden ileri bir tarih olamaz.', 'warning');
      proje[field] = eskiDeger;
      const el = document.getElementById(field);
      if (el) el.value = eskiDeger || '';
      return;
    }
  }

  // Tarih sırası kontrolü: ymOnayTarihi <= dtOnayTarihi olmalı
  if (field === 'ymOnayTarihi' || field === 'dtOnayTarihi') {
    const ym = proje.ymOnayTarihi;
    const dt = proje.dtOnayTarihi;
    if (ym && dt && ym > dt) {
      showToast('Y.M. Onay Tarihi, D.T. Onay Tarihinden sonra olamaz.', 'warning');
      proje[field] = eskiDeger;
      const el = document.getElementById(field);
      if (el) el.value = eskiDeger || '';
      return;
    }
  }

  // Sözleşme tarihi: dtOnayTarihinden önce olamaz
  if (field === 'sozlesmeTarihi' || field === 'dtOnayTarihi') {
    const dt = proje.dtOnayTarihi;
    const sozlesme = proje.sozlesmeTarihi;
    if (dt && sozlesme && sozlesme < dt) {
      showToast('Sözleşme Tarihi, D.T. Onay Tarihinden önce olamaz.', 'warning');
      proje[field] = eskiDeger;
      const el = document.getElementById(field);
      if (el) el.value = eskiDeger || '';
      return;
    }
  }

  // DT sınırı kontrolü: ymOnayTarihi değişince yıla göre sınır kontrol et
  if (field === 'ymOnayTarihi' && value) {
    checkDtSiniri();
  }

  autoSave();
}

function onGorevliEkle(tip) {
  if (tip === 'ym') {
    const yeniSayi = Math.min((proje.ymGorevliSayisi || 1) + 1, 3);
    proje.ymGorevliSayisi = yeniSayi;
    if (!proje.ymGorevliler[yeniSayi - 1]) proje.ymGorevliler[yeniSayi - 1] = { ad: '', unvan: '' };
    if (proje.dtGorevlilerYmIleAyni) {
      proje.dtGorevliSayisi = yeniSayi;
      proje.dtGorevliler = JSON.parse(JSON.stringify(proje.ymGorevliler));
    }
  } else if (tip === 'dt') {
    const yeniSayi = Math.min((proje.dtGorevliSayisi || 1) + 1, 3);
    proje.dtGorevliSayisi = yeniSayi;
    if (!proje.dtGorevliler[yeniSayi - 1]) proje.dtGorevliler[yeniSayi - 1] = { ad: '', unvan: '' };
  } else if (tip === 'mk') {
    if (!proje.mkGorevliler) proje.mkGorevliler = [{ad:'', unvan:''}, {ad:'', unvan:''}, {ad:'', unvan:''}];
    const yeniSayi = Math.min((proje.mkGorevliSayisi || 1) + 1, 3);
    proje.mkGorevliSayisi = yeniSayi;
    if (!proje.mkGorevliler[yeniSayi - 1]) proje.mkGorevliler[yeniSayi - 1] = { ad: '', unvan: '' };
  }
  autoSave();
  renderPage();
}

function onGorevliSil(tip, idx) {
  if (tip === 'ym') {
    if (proje.ymGorevliSayisi <= 1) return;
    proje.ymGorevliler.splice(idx, 1);
    proje.ymGorevliler.push({ ad: '', unvan: '' });
    proje.ymGorevliSayisi = Math.max(1, proje.ymGorevliSayisi - 1);
    if (proje.dtGorevlilerYmIleAyni) {
      proje.dtGorevliSayisi = proje.ymGorevliSayisi;
      proje.dtGorevliler = JSON.parse(JSON.stringify(proje.ymGorevliler));
    }
  } else if (tip === 'dt') {
    if (proje.dtGorevliSayisi <= 1) return;
    proje.dtGorevliler.splice(idx, 1);
    proje.dtGorevliler.push({ ad: '', unvan: '' });
    proje.dtGorevliSayisi = Math.max(1, proje.dtGorevliSayisi - 1);
  } else if (tip === 'mk') {
    if (proje.mkGorevliSayisi <= 1) return;
    proje.mkGorevliler.splice(idx, 1);
    proje.mkGorevliler.push({ ad: '', unvan: '' });
    proje.mkGorevliSayisi = Math.max(1, proje.mkGorevliSayisi - 1);
  }
  autoSave();
  renderPage();
}

function onGorevliChange(el, type) {
  const idx = parseInt(el.dataset.index);
  const ad = el.value;
  const unvan = getUnvanByAd(ad, referans);

  // Aynı komisyon/liste içinde mükerrer kişi kontrolü
  if (ad) {
    let mevcutlar = [];
    if (type === 'ym') mevcutlar = (proje.ymGorevliler || []).slice(0, proje.ymGorevliSayisi || 1);
    else if (type === 'dt') mevcutlar = (proje.dtGorevliler || []).slice(0, proje.dtGorevliSayisi || 1);
    else if (type === 'mk') mevcutlar = (proje.mkGorevliler || []).slice(0, proje.mkGorevliSayisi || 1);

    const digerIndex = mevcutlar.findIndex((g, i) => i !== idx && g.ad === ad);
    if (digerIndex >= 0) {
      showToast(`"${ad}" zaten bu komisyonda seçilmiş. Aynı kişiyi tekrar ekleyemezsiniz.`, 'warning');
      el.value = (type === 'ym' ? proje.ymGorevliler[idx]?.ad : type === 'dt' ? proje.dtGorevliler[idx]?.ad : proje.mkGorevliler[idx]?.ad) || '';
      return;
    }
  }

  if (type === 'ym') {
    proje.ymGorevliler[idx] = { ad, unvan };
    if (proje.dtGorevlilerYmIleAyni) {
      proje.dtGorevliler[idx] = { ad, unvan };
      proje.dtGorevliSayisi = proje.ymGorevliSayisi;
    }
  } else if (type === 'dt') {
    proje.dtGorevliler[idx] = { ad, unvan };
  } else if (type === 'mk') {
    if (!proje.mkGorevliler) proje.mkGorevliler = [{ad:'', unvan:''}, {ad:'', unvan:''}, {ad:'', unvan:''}];
    proje.mkGorevliler[idx] = { ad, unvan };
  }
  autoSave();
  renderPage();
}

function onDtGorevliAyniToggle(checked) {
  proje.dtGorevlilerYmIleAyni = checked;
  if (checked) {
    proje.dtGorevliSayisi = proje.ymGorevliSayisi || 1;
    proje.dtGorevliler = JSON.parse(JSON.stringify(proje.ymGorevliler || [{ad:'', unvan:''}, {ad:'', unvan:''}, {ad:'', unvan:''}]));
  }
  autoSave();
  renderPage();
}

function onAmirChange(el) {
  const ad = el.value;
  const amir = referans.onaylayanList.find(o => o.ad === ad);
  proje.onaylayanAmir = { ad, unvan: amir ? amir.unvan : '' };
  autoSave();
  renderPage();
}

function onKalemChange(el) {
  const idx = parseInt(el.dataset.index);
  const sub = el.dataset.sub;
  if (!proje.isKalemleri) proje.isKalemleri = [];
  if (!proje.isKalemleri[idx]) proje.isKalemleri[idx] = { ad: '', miktar: '', birim: '' };
  proje.isKalemleri[idx][sub] = el.value;
  autoSave();
  renderPage();
}

function onBittiEkChange(el) {
  const idx = parseInt(el.dataset.ekIndex);
  if (!Array.isArray(proje.bittiEkleri)) proje.bittiEkleri = [];
  proje.bittiEkleri[idx] = el.value;
  autoSave();
}

function onBittiEkEkle() {
  if (!Array.isArray(proje.bittiEkleri)) proje.bittiEkleri = [];
  proje.bittiEkleri.push('');
  autoSave();
  renderPage();
  // Yeni eklenen input'a focus
  setTimeout(() => {
    const list = document.getElementById('bittiEkleriList');
    const inputs = list?.querySelectorAll('input');
    inputs?.[inputs.length - 1]?.focus();
  }, 50);
}

function onBittiEkSil(idx) {
  if (!Array.isArray(proje.bittiEkleri)) return;
  proje.bittiEkleri.splice(idx, 1);
  autoSave();
  renderPage();
}

async function parseDTOluru(file) {
  if (!file) return;
  if (typeof pdfjsLib === 'undefined') { showToast('PDF okuyucu yüklenemedi.', 'error'); return; }
  try {
    showToast('PDF okunuyor...', 'info');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }

    // Sayı + Tarih: "Sayı : E-xxx-xxx-79656 08.04.2026"
    // PDF.js bazen araya boşluk ekler, bu yüzden ayrı ayrı arıyoruz
    const sayiIdx = fullText.search(/Sayı\s*:/);
    if (sayiIdx >= 0) {
      const satirMetni = fullText.substring(sayiIdx, sayiIdx + 100);
      const sayiMatch = satirMetni.match(/Sayı\s*:\s*(.+?)\s+(\d{2}\.\d{2}\.\d{4})/);
      if (sayiMatch) {
        const sayiKisim = sayiMatch[1].replace(/\s+/g, ''); // boşlukları temizle
        const parts = sayiKisim.split('-');
        proje.dtOnayNo = parts[parts.length - 1];
      }
      const tarihMatch = satirMetni.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (tarihMatch) {
        proje.dtOnayTarihi = `${tarihMatch[3]}-${tarihMatch[2]}-${tarihMatch[1]}`;
      }
    }

    // Görevli: "ilgili [Ünvan] [Ad SOYAD]'xx doğrudan temin"
    // \S* yerine kullanıyoruz çünkü Türkçe ü,ş gibi harfler \w ile eşleşmez
    const gorevliMatch = fullText.match(/ilgili\s+([A-Za-zÇŞĞÜÖİçşğüöı ]+?)\s*['\u2018\u2019\u02BC]\S*\s+doğrudan\s+temin/i);
    if (gorevliMatch) {
      const tamMetin = gorevliMatch[1].trim();
      const kelimeler = tamMetin.split(/\s+/);
      let idx = kelimeler.length - 1;
      const soyadlar = [];
      while (idx >= 0 && /^[A-ZÇŞĞÜÖİ]+$/.test(kelimeler[idx])) {
        soyadlar.unshift(kelimeler[idx--]);
      }
      const adlar = (idx >= 0 && /^[A-ZÇŞĞÜÖİ][a-zçşğüöı]/.test(kelimeler[idx])) ? [kelimeler[idx--]] : [];
      proje.dtGorevliler[0].ad = [...adlar, ...soyadlar].join(' ');
      proje.dtGorevliler[0].unvan = kelimeler.slice(0, idx + 1).join(' ');
      proje.dtGorevliSayisi = 1;
    }

    autoSave();
    renderPage();
    showToast('Olur belgesi okundu, alanlar dolduruldu!', 'success');
  } catch(e) {
    showToast('PDF okunamadı: ' + e.message, 'error');
  }
}

async function parseYMOluru(file) {
  if (!file) return;
  if (typeof pdfjsLib === 'undefined') { showToast('PDF okuyucu yüklenemedi.', 'error'); return; }
  try {
    showToast('PDF okunuyor...', 'info');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }

    // Sayı + Tarih
    const sayiIdx = fullText.search(/Sayı\s*:/);
    if (sayiIdx >= 0) {
      const satirMetni = fullText.substring(sayiIdx, sayiIdx + 100);
      const sayiMatch = satirMetni.match(/Sayı\s*:\s*(.+?)\s+(\d{2}\.\d{2}\.\d{4})/);
      if (sayiMatch) {
        const sayiKisim = sayiMatch[1].replace(/\s+/g, '');
        const parts = sayiKisim.split('-');
        proje.ymOnayNo = parts[parts.length - 1];
      }
      const tarihMatch = satirMetni.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (tarihMatch) {
        proje.ymOnayTarihi = `${tarihMatch[3]}-${tarihMatch[2]}-${tarihMatch[1]}`;
      }
    }

    // Görevli: "olarak [Ünvan] [Ad SOYAD]'xx görevlendirilmesi"
    const gorevliMatch = fullText.match(/olarak\s+([A-Za-zÇŞĞÜÖİçşğüöı ]+?)\s*['\u2018\u2019\u02BC]\S*\s+görevlendirilmesi/i);
    if (gorevliMatch) {
      const tamMetin = gorevliMatch[1].trim();
      const kelimeler = tamMetin.split(/\s+/);
      let idx = kelimeler.length - 1;
      const soyadlar = [];
      while (idx >= 0 && /^[A-ZÇŞĞÜÖİ]+$/.test(kelimeler[idx])) {
        soyadlar.unshift(kelimeler[idx--]);
      }
      const adlar = (idx >= 0 && /^[A-ZÇŞĞÜÖİ][a-zçşğüöı]/.test(kelimeler[idx])) ? [kelimeler[idx--]] : [];
      proje.ymGorevliler[0].ad = [...adlar, ...soyadlar].join(' ');
      proje.ymGorevliler[0].unvan = kelimeler.slice(0, idx + 1).join(' ');
      proje.ymGorevliSayisi = 1;
    }

    autoSave();
    renderPage();
    showToast('Olur belgesi okundu, alanlar dolduruldu!', 'success');
  } catch(e) {
    showToast('PDF okunamadı: ' + e.message, 'error');
  }
}

async function parseIkiOlurBelgesi() {
  const ymInput = document.getElementById('ymPdfInput');
  const dtInput = document.getElementById('dtPdfInput');
  const ymFile = ymInput && ymInput.files[0] ? ymInput.files[0] : null;
  const dtFile = dtInput && dtInput.files[0] ? dtInput.files[0] : null;

  if (!ymFile && !dtFile) {
    showToast('En az bir PDF dosyası seçin.', 'warning');
    return;
  }

  if (typeof pdfjsLib === 'undefined') { showToast('PDF okuyucu yüklenemedi.', 'error'); return; }

  showToast('PDF(ler) okunuyor...', 'info');

  // Tek belgeden bilgileri çıkar
  function belgeyiAnaliz(fullText) {
    const isDT = /doğrudan\s+temin/i.test(fullText);
    const isYM = /yaklaşık\s+maliyet/i.test(fullText);

    let isAdi = null;
    const tirnakMatch = fullText.match(/[\u201C\u201E\u0022\u00AB]([^\u201D\u201C\u0022\u00BB\n]{5,120})[\u201D\u201F\u0022\u00BB]/);
    if (tirnakMatch) isAdi = tirnakMatch[1].replace(/\s+/g, ' ').trim();
    if (!isAdi) {
      const konusuMatch = fullText.match(/(?:konusu|İşin\s+Adı|Hizmetin\s+Adı)\s*[:\-]?\s*([A-Za-zÇŞĞÜÖİçşğüöı0-9 \/\-]{5,100}?)(?:\s{2,}|\n|$)/i);
      if (konusuMatch) isAdi = konusuMatch[1].replace(/\s+/g, ' ').trim();
    }

    let onayNo = null, onayTarihi = null, gorevliAd = null, gorevliUnvan = null;
    const sayiIdx = fullText.search(/Sayı\s*:/);
    if (sayiIdx >= 0) {
      const satirMetni = fullText.substring(sayiIdx, sayiIdx + 100);
      const sayiMatch = satirMetni.match(/Sayı\s*:\s*(.+?)\s+(\d{2}\.\d{2}\.\d{4})/);
      if (sayiMatch) {
        const parts = sayiMatch[1].replace(/\s+/g, '').split('-');
        onayNo = parts[parts.length - 1];
      }
      const tarihMatch = satirMetni.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (tarihMatch) onayTarihi = `${tarihMatch[3]}-${tarihMatch[2]}-${tarihMatch[1]}`;
    }

    const gorevliMatchDT = fullText.match(/ilgili\s+([A-Za-zÇŞĞÜÖİçşğüöı ]+?)\s*['\u2018\u2019\u02BC]\S*\s+doğrudan\s+temin/i);
    const gorevliMatchYM = fullText.match(/olarak\s+([A-Za-zÇŞĞÜÖİçşğüöı ]+?)\s*['\u2018\u2019\u02BC]\S*\s+görevlendirilmesi/i);
    const gorevliMatch = isDT ? gorevliMatchDT : (isYM ? gorevliMatchYM : (gorevliMatchDT || gorevliMatchYM));
    if (gorevliMatch) {
      const tamMetin = gorevliMatch[1].trim();
      const kelimeler = tamMetin.split(/\s+/);
      let idx = kelimeler.length - 1;
      const soyadlar = [];
      while (idx >= 0 && /^[A-ZÇŞĞÜÖİ]+$/.test(kelimeler[idx])) soyadlar.unshift(kelimeler[idx--]);
      const adlar = (idx >= 0 && /^[A-ZÇŞĞÜÖİ][a-zçşğüöı]/.test(kelimeler[idx])) ? [kelimeler[idx--]] : [];
      gorevliAd = [...adlar, ...soyadlar].join(' ');
      gorevliUnvan = kelimeler.slice(0, idx + 1).join(' ');
    }

    // Onaylayan amir: DT belgesinde OLUR bölümünden çek
    // Format: "OLUR [tarih?] Sinan ÖZYER Yatırım ve İnşaat Müdür V."
    // Dikkat: "OLUR'larınıza", "OLUR'unuza" gibi ekli halleri atla — kesme işareti veya harf geliyorsa geç
    let onaylayanAd = null, onaylayanUnvan = null;
    const olurPattern = /\bOLUR(?![''\u2018\u2019\u02BCa-zçşğüöıA-ZÇŞĞÜÖİ])/g;
    let olurMatch2, lastOlurIdx = -1;
    while ((olurMatch2 = olurPattern.exec(fullText)) !== null) lastOlurIdx = olurMatch2.index;
    if (lastOlurIdx >= 0) {
      const olurSonrasi = fullText.substring(lastOlurIdx, lastOlurIdx + 300).replace(/\s+/g, ' ');
      // İsim: büyük harfle başlayan kelime(ler) + TAM BÜYÜK soyadı (Sinan ÖZYER, Ahmet Mehmet YILMAZ)
      const isimMatch = olurSonrasi.match(/\b([A-ZÇŞĞÜÖİ][a-zçşğüöı]+(?:\s+[A-ZÇŞĞÜÖİ][a-zçşğüöı]+)?\s+[A-ZÇŞĞÜÖİ]{2,}(?:\s+[A-ZÇŞĞÜÖİ]{2,})?)/);
      if (isimMatch) onaylayanAd = isimMatch[1].trim();
      // Ünvan: isimden sonraki kısımda Müdür/Genel Sekreter/Vali/Başkan/Kaymakam içeren cümle
      if (onaylayanAd) {
        const isimSonrasi = olurSonrasi.substring(olurSonrasi.indexOf(onaylayanAd) + onaylayanAd.length);
        const unvanMatch = isimSonrasi.match(/^\s*((?:[A-Za-zÇŞĞÜÖİçşğüöı]+\s+){0,6}(?:Müdür|Genel\s+Sekreter|Vali|Başkan|Kaymakam)[A-Za-zÇŞĞÜÖİçşğüöı\.\s]*?)(?:\s{2,}|\d|$)/);
        if (unvanMatch) onaylayanUnvan = unvanMatch[1].replace(/\s+/g, ' ').trim();
      }
    }

    return { isDT, isYM, isAdi, onayNo, onayTarihi, gorevliAd, gorevliUnvan, onaylayanAd, onaylayanUnvan };
  }

  try {
    // Her iki dosyayı da oku
    const ymSonuc = ymFile ? belgeyiAnaliz(await readPdfText(ymFile)) : null;
    const dtSonuc = dtFile ? belgeyiAnaliz(await readPdfText(dtFile)) : null;

    // İş adını belirle (YM öncelikli, yoksa DT'den al)
    const isAdi = (ymSonuc && ymSonuc.isAdi) || (dtSonuc && dtSonuc.isAdi);
    if (!isAdi) {
      showToast('İş adı PDF içinde bulunamadı. Manuel girin.', 'warning');
      const modal = document.getElementById('yeniProjeModal');
      if (modal) {
        modal.querySelector('#yeniProjeAdim2Olur').style.display = 'none';
        modal.querySelector('#yeniProjeAdim2Manuel').style.display = 'block';
        setTimeout(() => modal.querySelector('#yeniProjeAdi')?.focus(), 50);
      }
      return;
    }

    // YM belgesi ayrı onay
    let ymKabul = false;
    if (ymSonuc) {
      const ymSatirlar = [
        `📋 İş Adı: ${ymSonuc.isAdi || isAdi}`,
        ymSonuc.onayNo     ? `🔢 Sayı: ${ymSonuc.onayNo}` : null,
        ymSonuc.onayTarihi ? `📅 Tarih: ${ymSonuc.onayTarihi.split('-').reverse().join('.')}` : null,
        ymSonuc.gorevliAd  ? `👤 Görevli: ${ymSonuc.gorevliAd}` : null,
      ].filter(Boolean).join('\n');
      ymKabul = await showConfirm(`📘 Y.M. Onay Belgesi bilgileri:\n\n${ymSatirlar}\n\nBu belgeyi aktaralım mı?`, 'Evet, Aktar', 'Bu Belgeyi Atla');
    }

    // DT belgesi ayrı onay
    let dtKabul = false;
    if (dtSonuc) {
      const dtSatirlar = [
        `📋 İş Adı: ${dtSonuc.isAdi || isAdi}`,
        dtSonuc.onayNo      ? `🔢 Sayı: ${dtSonuc.onayNo}` : null,
        dtSonuc.onayTarihi  ? `📅 Tarih: ${dtSonuc.onayTarihi.split('-').reverse().join('.')}` : null,
        dtSonuc.gorevliAd   ? `👤 Görevli: ${dtSonuc.gorevliAd}` : null,
        dtSonuc.onaylayanAd ? `✅ Onaylayan: ${dtSonuc.onaylayanAd}${dtSonuc.onaylayanUnvan ? ' / ' + dtSonuc.onaylayanUnvan : ''}` : null,
      ].filter(Boolean).join('\n');
      dtKabul = await showConfirm(`📗 D.T. Onay Belgesi bilgileri:\n\n${dtSatirlar}\n\nBu belgeyi aktaralım mı?`, 'Evet, Aktar', 'Bu Belgeyi Atla');
    }

    // İkisi de reddedildiyse iptal
    if (!ymKabul && !dtKabul) {
      const modal = document.getElementById('yeniProjeModal');
      if (modal) {
        modal.querySelector('#yeniProjeAdim2Olur').style.display = 'none';
        modal.querySelector('#yeniProjeAdim2Manuel').style.display = 'block';
        const inp = modal.querySelector('#yeniProjeAdi');
        if (inp) { inp.value = isAdi; setTimeout(() => inp.focus(), 50); }
      }
      return;
    }

    // Proje oluştur ve kabul edilen belgeleri aktar
    document.getElementById('yeniProjeModal').style.display = 'none';
    proje = getDefaultProje();
    proje.isAdi = isAdi;

    if (ymKabul && ymSonuc) {
      if (ymSonuc.onayNo)     proje.ymOnayNo = ymSonuc.onayNo;
      if (ymSonuc.onayTarihi) proje.ymOnayTarihi = ymSonuc.onayTarihi;
      if (ymSonuc.gorevliAd)  { proje.ymGorevliler[0].ad = ymSonuc.gorevliAd; proje.ymGorevliler[0].unvan = ymSonuc.gorevliUnvan || ''; proje.ymGorevliSayisi = 1; }
    }
    if (dtKabul && dtSonuc) {
      if (dtSonuc.onayNo)      proje.dtOnayNo = dtSonuc.onayNo;
      if (dtSonuc.onayTarihi)  proje.dtOnayTarihi = dtSonuc.onayTarihi;
      if (dtSonuc.gorevliAd)   { proje.dtGorevliler[0].ad = dtSonuc.gorevliAd; proje.dtGorevliler[0].unvan = dtSonuc.gorevliUnvan || ''; proje.dtGorevliSayisi = 1; }
      if (dtSonuc.onaylayanAd) {
        const refMatch = referans.onaylayanList.find(o => o.ad === dtSonuc.onaylayanAd);
        proje.onaylayanAmir = { ad: dtSonuc.onaylayanAd, unvan: refMatch ? refMatch.unvan : (dtSonuc.onaylayanUnvan || '') };
      }
    }

    currentCloudProjeId = null;
    currentProjeKilitli = false;
    currentProjeBaskaKullanici = false;
    projeAktif = true;
    currentPage = 'veri-giris';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-page="veri-giris"]')?.classList.add('active');
    renderPage();
    showToast('Proje oluşturuldu, alanlar dolduruldu!', 'success');
  } catch(e) {
    showToast('PDF okunamadı: ' + e.message, 'error');
  }
}

async function parseOnayBelgesiIsAdi(file) {
  if (!file) return;
  if (typeof pdfjsLib === 'undefined') { showToast('PDF okuyucu yüklenemedi.', 'error'); return; }
  try {
    showToast('PDF okunuyor...', 'info');
    const fullText = await readPdfText(file);

    // Belge tipini tespit et
    const isDT = /doğrudan\s+temin/i.test(fullText);
    const isYM = /yaklaşık\s+maliyet/i.test(fullText);

    // İş adını tırnak içinden bul
    let isAdi = null;
    const tirnakMatch = fullText.match(/[\u201C\u201E\u0022\u00AB]([^\u201D\u201C\u0022\u00BB\n]{5,120})[\u201D\u201F\u0022\u00BB]/);
    if (tirnakMatch) {
      isAdi = tirnakMatch[1].replace(/\s+/g, ' ').trim();
    }
    if (!isAdi) {
      const konusuMatch = fullText.match(/(?:konusu|İşin\s+Adı|Hizmetin\s+Adı)\s*[:\-]?\s*([A-Za-zÇŞĞÜÖİçşğüöı0-9 \/\-]{5,100}?)(?:\s{2,}|\n|$)/i);
      if (konusuMatch) {
        isAdi = konusuMatch[1].replace(/\s+/g, ' ').trim();
      }
    }

    if (!isAdi) {
      showToast('İş adı PDF içinde bulunamadı. Manuel girin.', 'warning');
      const modal = document.getElementById('yeniProjeModal');
      if (modal) {
        modal.querySelector('#yeniProjeAdim2Olur').style.display = 'none';
        modal.querySelector('#yeniProjeAdim2Manuel').style.display = 'block';
        setTimeout(() => modal.querySelector('#yeniProjeAdi')?.focus(), 50);
      }
      return;
    }

    // Sayı ve tarih çek
    let onayNo = null, onayTarihi = null, gorevliAd = null, gorevliUnvan = null;
    const sayiIdx = fullText.search(/Sayı\s*:/);
    if (sayiIdx >= 0) {
      const satirMetni = fullText.substring(sayiIdx, sayiIdx + 100);
      const sayiMatch = satirMetni.match(/Sayı\s*:\s*(.+?)\s+(\d{2}\.\d{2}\.\d{4})/);
      if (sayiMatch) {
        const parts = sayiMatch[1].replace(/\s+/g, '').split('-');
        onayNo = parts[parts.length - 1];
      }
      const tarihMatch = satirMetni.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (tarihMatch) {
        onayTarihi = `${tarihMatch[3]}-${tarihMatch[2]}-${tarihMatch[1]}`;
      }
    }

    // Görevliyi çek (DT veya YM pattern)
    const gorevliMatchDT = fullText.match(/ilgili\s+([A-Za-zÇŞĞÜÖİçşğüöı ]+?)\s*['\u2018\u2019\u02BC]\S*\s+doğrudan\s+temin/i);
    const gorevliMatchYM = fullText.match(/olarak\s+([A-Za-zÇŞĞÜÖİçşğüöı ]+?)\s*['\u2018\u2019\u02BC]\S*\s+görevlendirilmesi/i);
    const gorevliMatch = isDT ? gorevliMatchDT : (isYM ? gorevliMatchYM : (gorevliMatchDT || gorevliMatchYM));
    if (gorevliMatch) {
      const tamMetin = gorevliMatch[1].trim();
      const kelimeler = tamMetin.split(/\s+/);
      let idx = kelimeler.length - 1;
      const soyadlar = [];
      while (idx >= 0 && /^[A-ZÇŞĞÜÖİ]+$/.test(kelimeler[idx])) soyadlar.unshift(kelimeler[idx--]);
      const adlar = (idx >= 0 && /^[A-ZÇŞĞÜÖİ][a-zçşğüöı]/.test(kelimeler[idx])) ? [kelimeler[idx--]] : [];
      gorevliAd = [...adlar, ...soyadlar].join(' ');
      gorevliUnvan = kelimeler.slice(0, idx + 1).join(' ');
    }

    // Özet onay mesajı oluştur
    const tip = isDT ? 'D.T. Onay Belgesi' : (isYM ? 'Y.M. Onay Belgesi' : 'Onay Belgesi');
    const satirlar = [
      `📄 Belge Türü: ${tip}`,
      `📋 İş Adı: ${isAdi}`,
      onayNo    ? `🔢 Sayı: ${onayNo}` : null,
      onayTarihi ? `📅 Tarih: ${onayTarihi.split('-').reverse().join('.')}` : null,
      gorevliAd  ? `👤 Görevli: ${gorevliAd}` : null,
    ].filter(Boolean).join('\n');

    const onaylandi = await showConfirm(`Aşağıdaki bilgiler okundu:\n\n${satirlar}\n\nForma aktaralım mı?`, 'Evet, Aktar', 'Hayır');
    if (!onaylandi) {
      const modal = document.getElementById('yeniProjeModal');
      if (modal) {
        modal.querySelector('#yeniProjeAdim2Olur').style.display = 'none';
        modal.querySelector('#yeniProjeAdim2Manuel').style.display = 'block';
        const inp = modal.querySelector('#yeniProjeAdi');
        if (inp) { inp.value = isAdi; setTimeout(() => inp.focus(), 50); }
      }
      return;
    }

    // Proje oluştur ve alanları doldur
    document.getElementById('yeniProjeModal').style.display = 'none';
    proje = getDefaultProje();
    proje.isAdi = isAdi;
    if (isDT || (!isYM && gorevliMatchDT)) {
      if (onayNo)     proje.dtOnayNo = onayNo;
      if (onayTarihi) proje.dtOnayTarihi = onayTarihi;
      if (gorevliAd)  { proje.dtGorevliler[0].ad = gorevliAd; proje.dtGorevliler[0].unvan = gorevliUnvan || ''; proje.dtGorevliSayisi = 1; }
    } else {
      if (onayNo)     proje.ymOnayNo = onayNo;
      if (onayTarihi) proje.ymOnayTarihi = onayTarihi;
      if (gorevliAd)  { proje.ymGorevliler[0].ad = gorevliAd; proje.ymGorevliler[0].unvan = gorevliUnvan || ''; proje.ymGorevliSayisi = 1; }
    }
    currentCloudProjeId = null;
    currentProjeKilitli = false;
    currentProjeBaskaKullanici = false;
    projeAktif = true;
    currentPage = 'veri-giris';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-page="veri-giris"]')?.classList.add('active');
    renderPage();
    showToast('Proje oluşturuldu, alanlar dolduruldu!', 'success');
  } catch(e) {
    showToast('PDF okunamadı: ' + e.message, 'error');
  }
}

// PDF sayfasını canvas'a render edip Vision API'ye gönder
const VISION_AYLIK_LIMIT = 500;

async function visionKullanımKontrol() {
  const ayAnahtar = new Date().toISOString().slice(0, 7); // "2026-04"
  const ref = db.collection('visionUsage').doc(ayAnahtar);
  const snap = await ref.get();
  const mevcutSayfa = snap.exists ? (snap.data().sayfaSayisi || 0) : 0;
  if (mevcutSayfa >= VISION_AYLIK_LIMIT) {
    throw new Error(`Aylık Vision API limiti (${VISION_AYLIK_LIMIT} sayfa) doldu. Yönetici ile iletişime geçin.`);
  }
  return { ref, mevcutSayfa };
}

async function visionKullanımArtir(ref, sayfaSayisi) {
  await ref.set({
    sayfaSayisi: firebase.firestore.FieldValue.increment(sayfaSayisi),
    sonGuncelleme: firebase.firestore.FieldValue.serverTimestamp(),
    sonKullanici: currentDTMUser?.displayName || currentDTMUser?.username || ''
  }, { merge: true });
}

async function readPdfWithVision(file) {
  if (!visionApiKey) throw new Error('Vision API anahtarı yüklenmedi.');
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF okuyucu yüklenemedi.');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Limit kontrolü
  const { ref, mevcutSayfa } = await visionKullanımKontrol();
  const kalanSayfa = VISION_AYLIK_LIMIT - mevcutSayfa;
  if (pdf.numPages > kalanSayfa) {
    throw new Error(`Bu ay kalan Vision API kotası (${kalanSayfa} sayfa) bu belge için yetersiz.`);
  }

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const b64 = canvas.toDataURL('image/png').split(',')[1];
    const resp = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: b64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            imageContext: { languageHints: ['tr'] }
          }]
        })
      }
    );
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    fullText += (data.responses?.[0]?.fullTextAnnotation?.text || '') + '\n';
  }

  // Kullanımı kaydet
  await visionKullanımArtir(ref, pdf.numPages);
  return fullText;
}

// PDF metnini önce PDF.js ile dene, boş gelirse Vision API'ye düş
async function readPdfText(file) {
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF okuyucu yüklenemedi.');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(item => item.str).join(' ') + '\n';
  }
  // Metin kalitesini kontrol et:
  // Çok boşluk (3+) → bozuk OCR katmanı (örn: "T.C,   KARAMAN   trOznr")
  const cokBosluk = (fullText.match(/\s{3,}/g) || []).length;
  const harfOrani = (fullText.match(/[a-zA-ZçşğüöıÇŞĞÜÖİ]/g) || []).length / Math.max(fullText.replace(/\s/g, '').length, 1);
  const kaliteliMetin = fullText.replace(/\s/g, '').length > 50 && cokBosluk < 15 && harfOrani > 0.45;
  if (kaliteliMetin) return fullText;
  // Bozuk OCR veya taranmış belge — Vision API'ye düş
  if (visionApiKey) {
    showToast('Taranmış/düşük kaliteli belge algılandı, Vision API ile okunuyor...', 'info');
    return await readPdfWithVision(file);
  }
  return fullText;
}

function parseTLTutar(str) {
  let s = str.replace(/[TLtl\s₺]/g, '');
  // Türkçe format: nokta binler ayırıcısı, virgül ondalık ayırıcısı → "12.500,00" = 12500.00
  s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s) || 0;
}

async function parseTeklifPDF(file, type, fi) {
  if (!file) return;
  if (typeof pdfjsLib === 'undefined') { showToast('PDF okuyucu yüklenemedi.', 'error'); return; }
  showToast('PDF okunuyor...', 'info');
  try {
    const fullText = await readPdfText(file);

    // Tutar: önce "Tutarı [sayı]" kalıbını ara (en güvenilir)
    // Vision API bazen "TL" harflerini yanlış okur, bu yüzden TL'ye bağımlı olmuyoruz
    let tutar = 0;
    const tutariMatch = fullText.match(/Tutar[ıi]\s*[\n\r ]*([0-9]+[.,]\d{3})/i);
    if (tutariMatch) {
      tutar = parseTLTutar(tutariMatch[1]);
    } else {
      // Yedek: "sayı TL" kalıplarını bul, en büyüğünü al
      const tlEslesmeler = [...fullText.matchAll(/([0-9]+[.,][0-9.,]*|[0-9]{4,})\s*TL/gi)];
      const tutarlar = tlEslesmeler.map(m => parseTLTutar(m[1])).filter(t => t > 100);
      tutar = tutarlar.length > 0 ? Math.max(...tutarlar) : 0;
    }

    // Firma adı: büyük/küçük harf duyarsız, taahhüt sonrası + tam metin arama
    let firmaAdi = '';
    const norm = s => s?.toLowerCase().replace(/\s+/g, ' ').trim();
    const taahhutIdx = fullText.search(/taahhüt\s+ederiz/i);
    const aramaMetni = taahhutIdx >= 0 ? fullText.substring(taahhutIdx, taahhutIdx + 800) : fullText.slice(-800);
    const eslesen = referans.firmaList.find(fr => fr.ad && norm(aramaMetni).includes(norm(fr.ad)))
      || referans.firmaList.find(fr => fr.ad && norm(fullText).includes(norm(fr.ad)));
    if (eslesen) firmaAdi = eslesen.ad;

    // Onay
    const satirlar = [
      firmaAdi ? `🏢 Firma: ${firmaAdi}` : '🏢 Firma: (bulunamadı — listede kayıtlı değil)',
      tutar > 0  ? `💰 Tutar: ${formatCurrency(tutar)} TL` : '💰 Tutar: (bulunamadı)',
    ].join('\n');
    const onaylandi = await showConfirm(`PDF'den okunan bilgiler:\n\n${satirlar}\n\nAktaralım mı?`, 'Evet, Aktar', 'Hayır');
    if (!onaylandi) return;

    const liste = type === 'ym' ? proje.ymFirmalar : proje.teklifFirmalar;
    if (firmaAdi) liste[fi].ad = firmaAdi;
    if (tutar > 0) {
      const aktifKi = proje.isKalemleri.findIndex(k => k.ad?.trim());
      const ki = aktifKi >= 0 ? aktifKi : 0;
      const miktar = parseFloat(proje.isKalemleri[ki]?.miktar) || 1;
      liste[fi].fiyatlar[ki] = Math.round((tutar / miktar) * 100) / 100;
    }
    saveProje(proje);
    renderPage();
    showToast('Firma bilgileri aktarıldı!', 'success');
  } catch(e) {
    showToast('PDF okunamadı: ' + e.message, 'error');
  }
}

function onFirmaChange(el, type) {
  const idx = parseInt(el.dataset.index);
  const yeniFirma = el.value;
  const liste = type === 'ym' ? proje.ymFirmalar : proje.teklifFirmalar;

  if (yeniFirma && liste.some((f, i) => i !== idx && f.ad === yeniFirma)) {
    showToast('Bu firma zaten eklenmiş. Farklı bir firma seçin.', 'warning');
    el.value = liste[idx].ad || '';
    return;
  }

  liste[idx].ad = yeniFirma;
  autoSave();
  renderPage();
}

function checkDtSiniri() {
  if (!proje.ymOnayTarihi) return;
  const yil = new Date(proje.ymOnayTarihi).getFullYear();
  const sinirObj = (referans.dtSinirlari || []).find(s => s.yil === yil);
  if (!sinirObj || !sinirObj.sinir) return;
  const ym = hesaplaYaklasikMaliyet(proje);
  if (ym > sinirObj.sinir) {
    showToast(`Yaklaşık maliyet (${formatCurrencyInt(ym)} TL), ${yil} D.T. sınırını (${formatCurrencyInt(sinirObj.sinir)} TL) aşıyor!`, 'warning');
  }
}

function onFiyatChange(el) {
  const type = el.dataset.firma;
  const fi = parseInt(el.dataset.fi);
  const ki = parseInt(el.dataset.ki);
  const val = parseFloat(el.value) || 0;
  if (type === 'ym') {
    proje.ymFirmalar[fi].fiyatlar[ki] = val;
    checkDtSiniri();
  } else {
    proje.teklifFirmalar[fi].fiyatlar[ki] = val;
  }
  autoSave();
  renderPage();
}

function toggleCard(header) {
  header.classList.toggle('collapsed');
  header.nextElementSibling.classList.toggle('collapsed');
}

// ===================== BELGELER SAYFASI =====================
let currentBelge = 'yaklasik-maliyet';

async function renderBelgelerPage() {
  const main = document.getElementById('mainContent');

  // DURUM 1: Proje seçilmedi → proje listesini göster
  if (!currentBelgelerProjeId) {
    main.innerHTML = `
      <div class="page-header">
        <h2>&#128196; Belgeler</h2>
        <p>Belge oluşturmak istediğiniz projeyi seçin.</p>
      </div>
      <div id="belgelerProjeList">
        <div style="text-align:center;padding:40px;color:var(--gray-400)">Yükleniyor...</div>
      </div>`;
    try {
      const projeler = await getUserProjeler();
      const listEl = document.getElementById('belgelerProjeList');
      if (!listEl) return;
      if (projeler.length === 0) {
        listEl.innerHTML = `
          <div class="dtm-empty">
            <div class="dtm-empty-icon">&#128196;</div>
            <div class="dtm-empty-title">Henüz proje yok</div>
            <div class="dtm-empty-desc">Belge oluşturmak için önce bir proje oluşturun.</div>
            <div class="dtm-empty-action">
              <button class="btn btn-primary" onclick="yeniProjeBaslat()">Yeni Proje</button>
            </div>
          </div>`;
        return;
      }
      listEl.innerHTML = `<div class="ky-proje-grid">
        ${projeler.map(p => {
          const tarih = p.updatedAt?.toDate ? p.updatedAt.toDate().toLocaleDateString('tr-TR') : '-';
          return `<div class="ky-proje-item">
            <div class="ky-proje-info">
              <div class="ky-proje-name">${escHtml(p.isAdi || '(İsimsiz)')}</div>
              <div class="ky-proje-meta">
                <span class="ky-proje-date">&#128197; ${tarih}</span>
                ${getIsTuruBadge(p.isTuru)}
              </div>
            </div>
            <div class="ky-proje-actions">
              <button class="ky-btn-open" onclick="belgelerProjeAc('${p.id}')">Belge Oluştur</button>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    } catch(e) {
      const listEl = document.getElementById('belgelerProjeList');
      if (listEl) listEl.innerHTML = `<div style="color:red;padding:20px">Projeler yüklenemedi: ${e.message}</div>`;
    }
    return;
  }

  // DURUM 2: Proje seçili → belge tab'larını göster
  const isMalVeyaHizmet = proje.isTuru === 'Mal Alımı' || proje.isTuru === 'Hizmet Alımı' || proje.isTuru === 'Danışmanlık';
  const sonTutanakId = isMalVeyaHizmet ? 'muayene-kabul' : 'bitti-tutanagi';
  const sonTutanakAd = isMalVeyaHizmet ? 'Muayene ve Kabul' : 'Bitti Tutanağı';

  const belgeler = [
    { id: 'yaklasik-maliyet', ad: 'Yaklaşık Maliyet' },
    { id: 'teklif-tutanagi', ad: 'Teklif Tutanağı' },
    { id: 'teknik-sartname', ad: 'Teknik Şartname' },
    ...(isMalVeyaHizmet ? [] : [{ id: 'sozlesme', ad: 'Sözleşme' }]),
    { id: sonTutanakId, ad: sonTutanakAd },
    { id: 'hakedis-raporu', ad: 'Hakediş Raporu' }
  ];

  if (currentBelge === 'bitti-tutanagi' && isMalVeyaHizmet) currentBelge = 'muayene-kabul';
  if (currentBelge === 'muayene-kabul' && !isMalVeyaHizmet) currentBelge = 'bitti-tutanagi';
  if (currentBelge === 'sozlesme' && isMalVeyaHizmet) currentBelge = 'yaklasik-maliyet';

  const tabs = belgeler.map(b =>
    `<div class="belge-tab ${currentBelge === b.id ? 'active' : ''}" onclick="currentBelge='${b.id}'; renderPage();">${b.ad}</div>`
  ).join('');

  let belgeHTML = '';
  switch (currentBelge) {
    case 'yaklasik-maliyet': belgeHTML = renderYaklasikMaliyet(proje, referans); break;
    case 'teklif-tutanagi': belgeHTML = renderTeklifTutanagi(proje, referans); break;
    case 'teknik-sartname': belgeHTML = renderTeknikSartname(proje, referans); break;
    case 'sozlesme': belgeHTML = renderSozlesme(proje, referans); break;
    case 'bitti-tutanagi': belgeHTML = renderBittiTutanagi(proje, referans); break;
    case 'muayene-kabul': belgeHTML = renderMuayeneKabulTutanagi(proje, referans); break;
    case 'hakedis-raporu': belgeHTML = renderHakedisRaporu(proje, referans); break;
  }

  main.innerHTML = `
    <div class="page-header" style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <button onclick="currentBelgelerProjeId=null; renderPage();"
        style="background:none;border:1px solid var(--gray-300);border-radius:6px;padding:6px 12px;
               cursor:pointer;font-size:13px;color:var(--gray-600);white-space:nowrap;margin-top:4px">
        &#8592; Proje Listesi
      </button>
      <div>
        <h2>&#128196; Belgeler</h2>
        <p style="display:flex;align-items:center;gap:8px">${escHtml(proje.isAdi || '')} ${getStatusBadge(currentProjeStatus)}</p>
      </div>
    </div>
    <div class="belge-tabs">${tabs}</div>
    <div class="action-bar" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      ${currentBelge === 'teknik-sartname' ? `
        <button onclick="acTeknikSartnameDuzenleModal()"
          style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#f59e0b;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(245,158,11,0.35)"
          onmouseover="this.style.background='#d97706'" onmouseout="this.style.background='#f59e0b'">
          <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Şartname Metnini Düzenle
        </button>
      ` : ''}
      ${currentBelge === 'sozlesme' ? `
        <button onclick="acSozlesmeMaddeleriDuzenleModal()"
          style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#f59e0b;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(245,158,11,0.35)"
          onmouseover="this.style.background='#d97706'" onmouseout="this.style.background='#f59e0b'">
          <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Sözleşme Maddelerini Düzenle
        </button>
      ` : ''}
      <button onclick="yazdirBelge()"
        style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;background:#3b82f6;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(59,130,246,0.35)"
        onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
        <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
        Yazdır
      </button>
      <button onclick="acBelgeIndirModal()"
        style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;background:#10b981;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(16,185,129,0.35)"
        onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
        <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        İndir
      </button>
      <button onclick="pdfIndirBelge()" style="display:none">PDF İndir</button>
    </div>
    <div class="belge-preview${['yaklasik-maliyet','teklif-tutanagi'].includes(currentBelge) ? ' landscape' : ''}">${belgeHTML}</div>
  `;
}

async function belgelerProjeAc(projeId) {
  try {
    const doc = await getProjeFromCloud(projeId);
    proje = Object.assign(getDefaultProje(), doc.data);
    currentCloudProjeId = projeId;
    currentProjeStatus = doc.status || 'taslak';
    currentProjeKazananBasitUsul = doc.kazananBasitUsul === true;
    currentBelgelerProjeId = projeId;
    currentBelge = 'yaklasik-maliyet';
    renderPage();
  } catch(e) {
    showToast('Proje yüklenemedi: ' + e.message, 'error');
  }
}

function acSozlesmeMaddeleriDuzenleModal() {
  if (!proje) return;
  if (!proje.sozlesmeOzelMaddeleri) proje.sozlesmeOzelMaddeleri = {};
  const o = proje.sozlesmeOzelMaddeleri;

  const mevcut = document.getElementById('dtmSozlesmeModal');
  if (mevcut) mevcut.remove();

  const overlay = document.createElement('div');
  overlay.id = 'dtmSozlesmeModal';
  overlay.className = 'dtm-modal-overlay';
  overlay.innerHTML = `
    <div class="dtm-modal" style="max-width:720px;width:95%">
      <div class="dtm-modal-header" style="display:flex;justify-content:space-between;align-items:center">
        <h3>✏️ Sözleşme Maddelerini Düzenle</h3>
        <button type="button" class="btn btn-ghost btn-sm" id="dtmSozlesmeKapatX" style="font-size:18px">&times;</button>
      </div>
      <div class="dtm-modal-body" style="padding:16px 20px;max-height:75vh;overflow-y:auto">
        <p style="font-size:12px;color:var(--gray-500);margin-bottom:14px">
          Sözleşmedeki özel şartları ve ilgili maddeleri ihtiyacınıza göre düzenleyebilirsiniz. (Boş bırakılan veya 'x' olan maddeler standart kalır).
        </p>

        <div class="form-group" style="margin-bottom:12px">
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px">Madde 11 - Montaj, İşletmeye Alma, Eğitim, Bakım-Onarım Şartları</label>
          <input type="text" id="sz_m11" value="${escAttr(o.madde11 || 'x')}" style="width:100%;padding:8px;border:1px solid var(--gray-300);border-radius:6px">
        </div>

        <div class="form-group" style="margin-bottom:12px">
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px">Madde 12 - Kesin Teminat Miktarı Ve İadesine İlişkin Şartlar</label>
          <input type="text" id="sz_m12" value="${escAttr(o.madde12 || 'x')}" style="width:100%;padding:8px;border:1px solid var(--gray-300);border-radius:6px">
        </div>

        <div class="form-group" style="margin-bottom:12px">
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px">Madde 13 - Garanti Ve Bakım, Onarım</label>
          <input type="text" id="sz_m13" value="${escAttr(o.madde13 || 'x')}" style="width:100%;padding:8px;border:1px solid var(--gray-300);border-radius:6px">
        </div>

        <div class="form-group" style="margin-bottom:12px">
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px">Madde 14 - Teslim Etme Ve Teslim Alma Şekil Ve Şartları</label>
          <input type="text" id="sz_m14" value="${escAttr(o.madde14 || 'x')}" style="width:100%;padding:8px;border:1px solid var(--gray-300);border-radius:6px">
        </div>

        <div class="form-group" style="margin-bottom:12px">
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px">Madde 15 - Gecikme Halinde Alınacak Cezalar</label>
          <textarea id="sz_m15" style="width:100%;height:90px;padding:8px;border:1px solid var(--gray-300);border-radius:6px;font-family:inherit;font-size:12.5px;line-height:1.5">${escHtml(o.madde15 || 'İdare tarafından sözleşmenin 17 nci maddesinde belirtilen süre uzatımı halleri hariç, iş zamanında bitirilmediği/mal teslim edilmediği takdirde geçen her takvim günü için Yükleniciye yapılacak ödemelerden sözleşme bedeli üzerinden binde 3 oranında gecikme cezası kesilecektir. Kesilecek toplam ceza tutarı hiçbir şekilde ihale bedelini aşamaz. Gecikme cezası Yükleniciye ayrıca protesto çekmeye gerek kalmaksızın ödemelerden kesilir. Bu cezanın ödemelerden karşılanamaması halinde Yükleniciden ayrıca tahsil edilir. Bu gecikme ihtarın Yükleniciye tebliğinden itibaren 20 günü geçtiği takdirde İdare Sözleşmeyi fesih edecektir.')}</textarea>
        </div>

        <div class="form-group" style="margin-bottom:12px">
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:4px">Madde 20 - Diğer Hususlar</label>
          <textarea id="sz_m20" style="width:100%;height:70px;padding:8px;border:1px solid var(--gray-300);border-radius:6px;font-family:inherit;font-size:12.5px;line-height:1.5">${escHtml(o.madde20 || 'x')}</textarea>
        </div>
      </div>
      <div class="dtm-modal-footer" style="padding:14px 20px;display:flex;justify-content:flex-end;gap:10px">
        <button id="dtmSozlesmeIptalBtn" class="btn btn-outline">İptal</button>
        <button id="dtmSozlesmeKaydetBtn" class="btn btn-primary">Kaydet & Güncelle</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const kapat = () => overlay.remove();
  document.getElementById('dtmSozlesmeKapatX').onclick = kapat;
  document.getElementById('dtmSozlesmeIptalBtn').onclick = kapat;

  document.getElementById('dtmSozlesmeKaydetBtn').onclick = async () => {
    proje.sozlesmeOzelMaddeleri = {
      madde11: document.getElementById('sz_m11').value.trim() || 'x',
      madde12: document.getElementById('sz_m12').value.trim() || 'x',
      madde13: document.getElementById('sz_m13').value.trim() || 'x',
      madde14: document.getElementById('sz_m14').value.trim() || 'x',
      madde15: document.getElementById('sz_m15').value.trim(),
      madde20: document.getElementById('sz_m20').value.trim() || 'x'
    };
    saveProje(proje);
    if (currentCloudProjeId) {
      try {
        await saveProjeToCloud(currentCloudProjeId, proje, currentProjeStatus);
      } catch(e) {
        console.warn('Buluta kaydedilemedi:', e);
      }
    }
    showToast("Sözleşme maddeleri başarıyla güncellendi.", "success");
    kapat();
    renderPage();
  };
}

function acTeknikSartnameDuzenleModal() {
  if (!proje) return;
  const mevcutMetin = (proje.teknikSartnameMetni && proje.teknikSartnameMetni.trim()) 
    ? proje.teknikSartnameMetni 
    : getDefaultTeknikSartnameMetni(proje);

  const mevcut = document.getElementById('dtmTeknikSartnameModal');
  if (mevcut) mevcut.remove();

  const overlay = document.createElement('div');
  overlay.id = 'dtmTeknikSartnameModal';
  overlay.className = 'dtm-modal-overlay';
  overlay.innerHTML = `
    <div class="dtm-modal" style="max-width:680px;width:95%">
      <div class="dtm-modal-header" style="display:flex;justify-content:space-between;align-items:center">
        <h3>✏️ Teknik Şartname Maddelerini Düzenle</h3>
        <button type="button" class="btn btn-ghost btn-sm" id="dtmSartnameKapatX" style="font-size:18px">&times;</button>
      </div>
      <div class="dtm-modal-body" style="padding:16px 20px">
        <p style="font-size:12px;color:var(--gray-500);margin-bottom:10px">
          Şartnameye eklenecek teknik hükümleri, malzeme standartlarını veya özel şartları aşağıda maddeler halinde düzenleyebilirsiniz.
        </p>
        <textarea id="dtmSartnameTextarea" style="width:100%;height:320px;padding:12px;border:1.5px solid var(--gray-300);border-radius:8px;font-family:inherit;font-size:13px;line-height:1.6;box-sizing:border-box;resize:vertical">${escHtml(mevcutMetin)}</textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <button type="button" class="btn btn-outline btn-sm" id="dtmSartnameSifirlaBtn">Varsayılan Şablona Dön</button>
        </div>
      </div>
      <div class="dtm-modal-footer" style="padding:14px 20px;display:flex;justify-content:flex-end;gap:10px">
        <button id="dtmSartnameIptalBtn" class="btn btn-outline">İptal</button>
        <button id="dtmSartnameKaydetBtn" class="btn btn-primary">Kaydet & Güncelle</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const textarea = document.getElementById('dtmSartnameTextarea');
  document.getElementById('dtmSartnameSifirlaBtn').onclick = () => {
    textarea.value = getDefaultTeknikSartnameMetni(proje);
  };

  const kapat = () => overlay.remove();
  document.getElementById('dtmSartnameKapatX').onclick = kapat;
  document.getElementById('dtmSartnameIptalBtn').onclick = kapat;

  document.getElementById('dtmSartnameKaydetBtn').onclick = async () => {
    proje.teknikSartnameMetni = textarea.value.trim();
    saveProje(proje);
    if (currentCloudProjeId) {
      try {
        await saveProjeToCloud(currentCloudProjeId, proje, currentProjeStatus);
      } catch(e) {
        console.warn('Buluta kaydedilemedi:', e);
      }
    }
    showToast("Teknik Şartname metni başarıyla güncellendi.", "success");
    kapat();
    renderPage();
  };
}

function yazdirBelge() {
  let html = '';
  let landscape = false;
  switch (currentBelge) {
    case 'yaklasik-maliyet':
      html = renderYaklasikMaliyet(proje, referans);
      landscape = true;
      break;
    case 'teklif-tutanagi':
      html = renderTeklifTutanagi(proje, referans);
      landscape = true;
      break;
    case 'teknik-sartname': html = renderTeknikSartname(proje, referans); break;
    case 'sozlesme': html = renderSozlesme(proje, referans); belgeYazdir(html, false, true); return;
    case 'bitti-tutanagi': html = renderBittiTutanagi(proje, referans); break;
    case 'muayene-kabul': html = renderMuayeneKabulTutanagi(proje, referans); break;
    case 'hakedis-raporu': html = renderHakedisRaporu(proje, referans); break;
  }
  belgeYazdir(html, landscape);
}

function pdfIndirBelge() {
  const belgeAdlari = {
    'yaklasik-maliyet': 'Yaklaşık Maliyet Tutanağı',
    'teklif-tutanagi': 'Teklif Tutanağı',
    'teknik-sartname': 'Teknik Şartname',
    'sozlesme': 'Sözleşme',
    'bitti-tutanagi': 'Bitti Tutanağı',
    'muayene-kabul': 'Muayene ve Kabul Tutanağı',
    'hakedis-raporu': 'Hakediş Raporu'
  };
  let html = '';
  let landscape = false;
  let sozlesme = false;
  switch (currentBelge) {
    case 'yaklasik-maliyet': html = renderYaklasikMaliyet(proje, referans); landscape = true; break;
    case 'teklif-tutanagi':  html = renderTeklifTutanagi(proje, referans);  landscape = true; break;
    case 'teknik-sartname':  html = renderTeknikSartname(proje, referans);  break;
    case 'sozlesme':         html = renderSozlesme(proje, referans);        sozlesme = true;  break;
    case 'bitti-tutanagi':   html = renderBittiTutanagi(proje, referans);   break;
    case 'muayene-kabul':    html = renderMuayeneKabulTutanagi(proje, referans); break;
    case 'hakedis-raporu':   html = renderHakedisRaporu(proje, referans);   break;
  }
  const dosyaAdi = `${proje.isAdi || 'Belge'} - ${belgeAdlari[currentBelge] || currentBelge}`;
  belgePdfIndir(html, landscape, sozlesme, dosyaAdi);
}

// ===================== VERİ MERKEZİ SAYFASI =====================
const DTM_DISIPLIN_LISTESI = [
  'İnşaat Mühendisi',
  'Elektrik Elektronik Mühendisi',
  'Makine Mühendisi',
  'Harita Mühendisi',
  'Jeoloji Mühendisi',
  'Çevre Mühendisi',
  'Maden Mühendisi',
  'Ziraat Mühendisi',
  'Şehir Plancısı',
  'İnşaat Teknikeri',
  'Elektrik Teknikeri',
  'Makine Teknikeri',
  'Harita Teknikeri',
  'Tekniker',
  'Teknisyen'
];

function renderVeriMerkeziPage() {
  const isSuperAdmin = currentDTMUser?.role === 'superadmin';

  // Geçmişte kaydedilmiş boş/isimsiz mühendis ve personelleri otomatik temizle ve alfabetik sırala
  if (referans.muhendisList && Array.isArray(referans.muhendisList)) {
    const oncekiAdet = referans.muhendisList.length;
    referans.muhendisList = referans.muhendisList.filter(m => m && m.ad && m.ad.trim());
    referans.muhendisList.sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr-TR'));
    if (referans.muhendisList.length !== oncekiAdet) {
      saveReferans(referans);
    }
  }

  const sortedMuhendis = (referans.muhendisList || []).map((m, i) => ({ m, i }));

  const onaylayanRows = referans.onaylayanList.map((o, i) => `
    <tr>
      <td style="width:46%"><input type="text" class="ref-input" value="${escAttr(o.ad)}" placeholder="Ad Soyad giriniz" onchange="onRefChange('onaylayanList', ${i}, 'ad', this.value)"></td>
      <td style="width:46%"><input type="text" class="ref-input" value="${escAttr(o.unvan)}" placeholder="Ünvan (Örn: Şube Müdürü)" onchange="onRefChange('onaylayanList', ${i}, 'unvan', this.value)"></td>
      <td style="width:8%; text-align:center;">
        <button class="btn-icon-danger" onclick="onRefDelete('onaylayanList', ${i})" title="Amiri Sil">
          ${typeof getIcon === 'function' ? getIcon('trash', 16) : '✕'}
        </button>
      </td>
    </tr>`).join('');

  // Geçmişte kaydedilmiş boş/isimsiz firmaları otomatik temizle
  if (referans.firmaList && Array.isArray(referans.firmaList)) {
    const oncekiAdet = referans.firmaList.length;
    referans.firmaList = referans.firmaList.filter(f => f && f.ad && f.ad.trim() && f.ad.trim() !== 'Yeni Firma' && f.ad.trim() !== '(İsimsiz Firma)');
    if (referans.firmaList.length !== oncekiAdet) {
      saveReferans(referans);
    }
  }

  const sortedFirms = (referans.firmaList || []).map((f, i) => ({f, i})).sort((a, b) => (a.f.ad || '').localeCompare(b.f.ad || '', 'tr-TR'));
  const ilceRows = referans.ilceler.map((il, i) => `
    <span class="ref-tag-pill">
      ${escHtml(il)} 
      <button onclick="onRefDelete('ilceler', ${i})" title="İlçeyi Sil">
        ${typeof getIcon === 'function' ? getIcon('x', 14) : '×'}
      </button>
    </span>`).join('');

  return `
    <div class="vm-page-header">
      <div class="vm-header-title">
        <div class="vm-header-icon">
          ${typeof getIcon === 'function' ? getIcon('database', 22) : '⚙️'}
        </div>
        <div>
          <h2>Veri Merkezi & Tanımlamalar</h2>
          <p>Projelerde ve resmi belgelerde kullanılan personel, kurum ve firma rehberini yönetin.</p>
        </div>
      </div>
      ${isSuperAdmin ? `<button class="btn btn-primary" onclick="forceMergeYukleniciHavuzu()" style="display:flex;align-items:center;gap:6px">${typeof getIcon === 'function' ? getIcon('sliders', 16) : '🔄'} Tüm Firmaları Havuza Çek</button>` : ''}
    </div>

    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3 style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('users', 18) : ''}</span>
          Görevli Personel Rehberi
          <span style="font-size:11px;background:#e8eefb;color:var(--primary);padding:2px 8px;border-radius:12px;font-weight:600;margin-left:4px">${sortedMuhendis.length} Personel</span>
        </h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div style="display:flex; gap:10px; margin-bottom:16px; align-items:center;">
          <select class="ref-input" style="flex:1; height:40px; padding:0 12px; font-size:13px; border-radius:8px;" onchange="onMuhendisSelect(this.value)">
            <option value="-1">🔍 Kayıtlı personellerden seçin veya düzenleyin...</option>
            ${sortedMuhendis.map(item => `<option value="${item.i}" ${dtmSeciliMuhendisIndex === item.i ? 'selected' : ''}>${escHtml(item.m.ad)} — ${escHtml(item.m.unvan || 'Belirtilmedi')}</option>`).join('')}
          </select>
          <button class="btn-icon-primary" style="height:40px; padding:0 14px; font-size:13px; font-weight:600; border-radius:8px; white-space:nowrap;" onclick="acMuhendisModal()">
            ${typeof getIcon === 'function' ? getIcon('plus', 15) : '+'} Yeni Görevli
          </button>
        </div>

        ${(dtmSeciliMuhendisIndex >= 0 && referans.muhendisList && referans.muhendisList[dtmSeciliMuhendisIndex]) ? (() => {
          const m = referans.muhendisList[dtmSeciliMuhendisIndex];
          const initials = (m.ad || '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'GP';
          return `
          <div style="background:var(--gray-50); padding:16px 20px; border-radius:12px; border:1px solid var(--gray-200); display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:14px;">
              <div style="width:44px; height:44px; border-radius:50%; background:#e8eefb; color:var(--primary); font-size:14px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:inset 0 0 0 1px rgba(26,86,219,0.15)">
                ${escHtml(initials)}
              </div>
              <div>
                <div style="font-size:15px; font-weight:700; color:var(--gray-900);">${escHtml(m.ad)}</div>
                <div style="display:inline-flex; align-items:center; gap:6px; margin-top:4px; background:#fff; color:var(--gray-700); padding:3px 10px; border-radius:6px; font-size:12px; font-weight:500; border:1px solid #e2e8f0;">
                  ${escHtml(m.unvan || 'Belirtilmedi')}
                </div>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn-icon-primary" style="height:36px; padding:0 14px;" onclick="acMuhendisModal(${dtmSeciliMuhendisIndex})" title="Düzenle">
                ${typeof getIcon === 'function' ? getIcon('edit', 14) : '✏️'} Bilgileri Düzenle
              </button>
              <button class="btn-icon-danger" style="height:36px; padding:0 12px;" onclick="onRefDelete('muhendisList', ${dtmSeciliMuhendisIndex}); onMuhendisSelect(-1);" title="Sil">
                ${typeof getIcon === 'function' ? getIcon('trash', 14) : '🗑️'} Personeli Sil
              </button>
            </div>
          </div>`;
        })() : `
          <div style="text-align:center; padding:16px 20px; background:var(--gray-50); border:1px dashed var(--gray-300); border-radius:10px; color:var(--gray-500); font-size:13px;">
            Personel detayını görüntülemek veya düzenlemek için yukarıdaki listeden bir personel seçin ya da <strong>+ Yeni Görevli</strong> butonuna tıklayın.
          </div>
        `}
      </div>
    </div>

    ${!isSuperAdmin ? `
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3 style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('building', 18) : ''}</span>
          Firma & Yüklenici Rehberi
          <span style="font-size:11px;background:#e8eefb;color:var(--primary);padding:2px 8px;border-radius:12px;font-weight:600;margin-left:4px">${sortedFirms.length} Kayıtlı</span>
        </h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div style="display:flex; gap:10px; margin-bottom:16px; align-items:center;">
          <select class="ref-input" style="flex:1; height:40px; padding:0 12px; font-size:13px; border-radius:8px;" onchange="onFirmaListeSelect(this.value)">
            <option value="-1">🔍 Kayıtlı firmalardan seçin veya düzenleyin...</option>
            ${dtmYeniEklenenFirma ? `<option value="NEW" selected>➕ Yeni Firma (Kaydedilmedi)</option>` : ''}
            ${sortedFirms.map(item => `<option value="${item.i}" ${!dtmYeniEklenenFirma && dtmSeciliFirmaIndex === item.i ? 'selected' : ''}>${escHtml(item.f.ad)}</option>`).join('')}
          </select>
          <button class="btn-icon-primary" style="height:40px; padding:0 14px; font-size:13px; font-weight:600; border-radius:8px; white-space:nowrap;" onclick="onFirmaListeEkle()">
            ${typeof getIcon === 'function' ? getIcon('plus', 15) : '+'} Yeni Firma
          </button>
        </div>
        
        ${(dtmYeniEklenenFirma || (dtmSeciliFirmaIndex >= 0 && referans.firmaList && referans.firmaList[dtmSeciliFirmaIndex])) ? (() => {
          const isNew = !!dtmYeniEklenenFirma;
          const f = isNew ? dtmYeniEklenenFirma : referans.firmaList[dtmSeciliFirmaIndex];
          const i = isNew ? 'NEW' : dtmSeciliFirmaIndex;
          return `
          <div style="background:var(--gray-50); padding:18px 20px; border-radius:12px; border:1px solid var(--gray-200);">
            <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:14px;">
              <div class="form-group"><label>Firma / Kişi Adı <span style="color:var(--danger)">*</span></label><input type="text" class="ref-input" id="firmaInputAd" value="${escAttr(f.ad || '')}" placeholder="Firma / Kişi Adı Giriniz" onchange="onFirmaFieldChange('firmaList', '${i}', 'ad', this.value)" oninput="onFirmaFieldChange('firmaList', '${i}', 'ad', this.value)"></div>
              <div class="form-group"><label>Tür <span style="color:var(--danger)">*</span></label><select class="ref-input" id="firmaInputTur" onchange="onFirmaFieldChange('firmaList', '${i}', 'tur', this.value); renderPage('veri-merkezi');">
                  <option value="Kişi" ${f.tur === 'Kisi' || f.tur === 'Kişi' ? 'selected' : ''}>Kişi</option>
                  <option value="Şirket" ${f.tur === 'Şirket' ? 'selected' : ''}>Şirket</option>
              </select></div>
              <div class="form-group" style="grid-column: span 2;"><label>Adres</label><input type="text" class="ref-input" value="${escAttr(f.adres || '')}" placeholder="Açık adres giriniz" onchange="onFirmaFieldChange('firmaList', '${i}', 'adres', this.value)"></div>
              <div class="form-group"><label>Telefon</label><input type="text" class="ref-input" value="${escAttr(f.tel || '')}" placeholder="Örn: 05xx xxx xx xx" onchange="onFirmaFieldChange('firmaList', '${i}', 'tel', this.value)"></div>
              <div class="form-group"><label>Faks</label><input type="text" class="ref-input" value="${escAttr(f.faks || '')}" placeholder="Faks no giriniz" onchange="onFirmaFieldChange('firmaList', '${i}', 'faks', this.value)"></div>
              <div class="form-group"><label>E-Posta</label><input type="text" class="ref-input" value="${escAttr(f.eposta || '')}" placeholder="ornek@domain.com" onchange="onFirmaFieldChange('firmaList', '${i}', 'eposta', this.value)"></div>
              ${f.tur === 'Şirket' ? '' : `<div class="form-group"><label>Doğum Tarihi</label><input type="date" class="ref-input" value="${escAttr(f.dogumTarihi || '')}" onchange="onFirmaFieldChange('firmaList', '${i}', 'dogumTarihi', this.value)"></div>`}
              <div class="form-group" style="grid-column: span 2; display: flex; flex-direction: row; align-items: center; justify-content: flex-start; gap: 8px; margin-top: 5px;">
                <input type="checkbox" id="basitUsul_${i}" ${f.basitUsul ? 'checked' : ''} onchange="onFirmaFieldChange('firmaList', '${i}', 'basitUsul', this.checked)">
                <label for="basitUsul_${i}" style="margin:0; cursor:pointer; font-weight:600; color:var(--primary)">Bu Firma / Kişi Basit Usule Tabiidir</label>
              </div>
            </div>
            <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--gray-200); display:flex; justify-content:space-between; align-items:center;">
              <button class="btn btn-primary" onclick="kaydetFirmaFormu('${i}')" style="display:inline-flex;align-items:center;gap:6px">
                ${typeof getIcon === 'function' ? getIcon('check', 16) : '✓'} Bilgileri Kaydet
              </button>
              ${isNew ? `
                <button class="btn btn-outline btn-sm" onclick="vazgecFirmaFormu()">Vazgeç</button>
              ` : `
                <button class="btn btn-danger btn-sm" style="display:inline-flex;align-items:center;gap:4px" onclick="onRefDelete('firmaList', ${i}); onFirmaListeSelect(-1);">
                  ${typeof getIcon === 'function' ? getIcon('trash', 14) : ''} Firmayı Sil
                </button>
              `}
            </div>
          </div>
          `;
        })() : ''}
      </div>
    </div>
    ` : ''}

    ${isSuperAdmin ? `
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3 style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('userCheck', 18) : ''}</span>
          Onaylayan Amir Listesi
          <span style="font-size:11px;background:#e8eefb;color:var(--primary);padding:2px 8px;border-radius:12px;font-weight:600;margin-left:4px">${referans.onaylayanList.length} Amir</span>
        </h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <table class="ref-table">
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>Ünvan</th>
              <th style="text-align:center;width:80px">İşlem</th>
            </tr>
          </thead>
          <tbody>${onaylayanRows}</tbody>
        </table>
        <div style="margin-top:14px">
          <button class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:6px" onclick="onRefAdd('onaylayanList', {ad:'', unvan:''})">
            ${typeof getIcon === 'function' ? getIcon('plus', 15) : '+'} Yeni Amir Ekle
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3 style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('home', 18) : ''}</span>
          İdare Tanımları
        </h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">
          ${referans.idareList.map((il, i) => `
            <span class="ref-tag-pill">
              ${escHtml(il)} 
              <button onclick="onRefDelete('idareList', ${i})" title="Sil">
                ${typeof getIcon === 'function' ? getIcon('x', 14) : '×'}
              </button>
            </span>`).join('')}
        </div>
        <div style="display:flex;gap:8px;max-width:480px">
          <input type="text" class="ref-input" id="yeniIdare" placeholder="Yeni idare adı giriniz">
          <button class="btn btn-outline btn-sm" style="white-space:nowrap" onclick="const v=document.getElementById('yeniIdare').value;if(v){referans.idareList.push(v);saveGlobalReferans(referans);renderPage();}">+ Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3 style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('briefcase', 18) : ''}</span>
          Müdürlük Tanımları
        </h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">
          ${referans.mudurlukler.map((m, i) => `
            <span class="ref-tag-pill">
              ${escHtml(m)} 
              <button onclick="onRefDelete('mudurlukler', ${i})" title="Sil">
                ${typeof getIcon === 'function' ? getIcon('x', 14) : '×'}
              </button>
            </span>`).join('')}
        </div>
        <div style="display:flex;gap:8px;max-width:480px">
          <input type="text" class="ref-input" id="yeniMudurluk" placeholder="Yeni müdürlük adı giriniz">
          <button class="btn btn-outline btn-sm" style="white-space:nowrap" onclick="const v=document.getElementById('yeniMudurluk').value;if(v){referans.mudurlukler.push(v);saveGlobalReferans(referans);renderPage();}">+ Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3 style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('mapPin', 18) : ''}</span>
          İlçe Tanımları
        </h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">
          ${ilceRows}
        </div>
        <div style="display:flex;gap:8px;max-width:480px">
          <input type="text" class="ref-input" id="yeniIlce" placeholder="Yeni ilçe adı giriniz">
          <button class="btn btn-outline btn-sm" style="white-space:nowrap" onclick="const v=document.getElementById('yeniIlce').value;if(v){referans.ilceler.push(v);saveGlobalReferans(referans);renderPage();}">+ Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3 style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('chart', 18) : ''}</span>
          D.T. Yıllık Sınır Tutarları
        </h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <p style="font-size:13px;color:var(--gray-500);margin-bottom:14px">Yıllara göre KİK Doğrudan Temin parasal sınır tutarlarını girin (KDV hariç, TL).</p>
        <table class="ref-table" style="max-width:420px">
          <thead><tr><th>Yıl</th><th>Sınır Tutarı (TL)</th></tr></thead>
          <tbody>
            ${(referans.dtSinirlari || []).map((s, i) => `
              <tr>
                <td style="font-weight:600;padding-left:14px">${s.yil}</td>
                <td><input type="number" class="ref-input" value="${s.sinir}" min="0" placeholder="0" onchange="onRefChange('dtSinirlari', ${i}, 'sinir', parseFloat(this.value)||0)"></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" id="visionUsageCard">
      <div class="card-header" onclick="toggleCard(this)">
        <h3 style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('fileText', 18) : ''}</span>
          Vision API Belge Tarama Kotası
        </h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div id="visionUsageIcerik" style="font-size:13px;color:var(--gray-600)">Yükleniyor...</div>
      </div>
    </div>
    ` : ''}
  `;
}

function bindVeriMerkezi() {
  if (currentDTMUser?.role !== 'superadmin') return;
  const ayAnahtar = new Date().toISOString().slice(0, 7);
  db.collection('visionUsage').doc(ayAnahtar).get().then(snap => {
    const el = document.getElementById('visionUsageIcerik');
    if (!el) return;
    const sayfa = snap.exists ? (snap.data().sayfaSayisi || 0) : 0;
    const sonKullanici = snap.exists ? (snap.data().sonKullanici || '-') : '-';
    const yuzde = Math.min(100, Math.round(sayfa / VISION_AYLIK_LIMIT * 100));
    const renk = yuzde >= 80 ? '#ef4444' : yuzde >= 50 ? '#f59e0b' : '#22c55e';
    const bar = `<div style="background:#e5e7eb;border-radius:4px;height:8px;margin:6px 0">
      <div style="background:${renk};width:${yuzde}%;height:8px;border-radius:4px;transition:width .3s"></div>
    </div>`;
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span><strong>${ayAnahtar}</strong></span>
        <span style="color:${renk};font-weight:600">${sayfa} / ${VISION_AYLIK_LIMIT} sayfa</span>
      </div>
      ${bar}
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--gray-500);margin-top:4px">
        <span>%${yuzde} kullanıldı</span>
        <span>Son: ${escHtml(sonKullanici)}</span>
      </div>
    `;
  }).catch(err => {
    console.error('[visionUsage] Firestore hatası:', err?.code, err?.message);
    const el = document.getElementById('visionUsageIcerik');
    if (el) el.innerHTML = `<span style="color:var(--gray-400)">Veri alınamadı. (${err?.code || 'bilinmiyor'})</span>`;
  });
}

function onRefChange(list, index, field, value) {
  if (typeof referans[list][index] === 'object') {
    referans[list][index][field] = value;
  } else {
    referans[list][index] = value;
  }
  GLOBAL_REF_FIELDS.includes(list) ? saveGlobalReferans(referans) : saveReferans(referans);
}

let dtmYeniEklenenFirma = null;

function onFirmaFieldChange(list, index, field, value) {
  if (index === 'NEW' || index === 'NEW_YUKLENICI') {
    if (list === 'firmaList' && dtmYeniEklenenFirma) {
      dtmYeniEklenenFirma[field] = value;
    } else if (list === 'yukleniciList' && dtmYeniEklenenYuklenici) {
      dtmYeniEklenenYuklenici[field] = value;
    }
    return;
  }
  const idx = parseInt(index, 10);
  if (!isNaN(idx) && referans[list] && referans[list][idx]) {
    if (typeof referans[list][idx] === 'object') {
      referans[list][idx][field] = value;
    } else {
      referans[list][idx] = value;
    }
  }
}

window.vazgecFirmaFormu = function() {
  dtmYeniEklenenFirma = null;
  dtmSeciliFirmaIndex = -1;
  renderPage('veri-merkezi');
};

window.kaydetFirmaFormu = function(index) {
  const isNew = index === 'NEW' || !!dtmYeniEklenenFirma;
  const f = isNew ? dtmYeniEklenenFirma : (referans.firmaList && referans.firmaList[parseInt(index, 10)]);
  
  if (!f || !f.ad || !f.ad.trim()) {
    showToast("Firma / Kişi Adı boş bırakılamaz!", "error");
    const inputAd = document.getElementById('firmaInputAd');
    if (inputAd) markError(inputAd);
    return;
  }

  if(!referans.firmaList) referans.firmaList = [];

  if (isNew) {
    referans.firmaList.push({...dtmYeniEklenenFirma, ad: dtmYeniEklenenFirma.ad.trim()});
    dtmSeciliFirmaIndex = referans.firmaList.length - 1;
    dtmYeniEklenenFirma = null;
  } else {
    f.ad = f.ad.trim();
  }

  const isSuperAdmin = currentDTMUser?.role === 'superadmin';
  saveReferans(referans);
  if (isSuperAdmin) {
    saveGlobalReferans(referans);
  }
  showToast("Firma / Kişi bilgileri başarıyla kaydedildi.", "success");
  renderPage('veri-merkezi');
};

function onRefDelete(list, index) {
  referans[list].splice(index, 1);
  GLOBAL_REF_FIELDS.includes(list) ? saveGlobalReferans(referans) : saveReferans(referans);
  renderPage();
}

function onRefAdd(list, item) {
  referans[list].push(item);
  GLOBAL_REF_FIELDS.includes(list) ? saveGlobalReferans(referans) : saveReferans(referans);
  renderPage();
}

// ===================== DASHBOARD SAYFASI =====================
async function renderDashboardPage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="vm-page-header">
      <div class="vm-header-title">
        <div class="vm-header-icon">
          ${typeof getIcon === 'function' ? getIcon('chart', 22) : '📊'}
        </div>
        <div>
          <h2>Dashboard & Harcama İstatistikleri</h2>
          <p>Projelerin genel durumu, finansal gerçekleşme oranları ve iş türü dağılımı.</p>
        </div>
      </div>
    </div>
    <div style="text-align:center;padding:60px;color:var(--gray-400)">
      <div style="font-size:32px;margin-bottom:12px">⏳</div>
      İstatistikler hesaplanıyor...
    </div>`;

  try {
    const projeler = await getUserProjeler();

    let toplamOnaylananTutar = 0;
    let toplamBekleyenTutar = 0;
    const toplamSayi     = projeler.length;
    const onaylananSayi  = projeler.filter(p => p.status === 'onaylandi').length;
    const bekleyenSayi   = projeler.filter(p => p.status === 'taslak' || p.status === 'gonderildi').length;
    const geriGonderSayi = projeler.filter(p => p.status === 'geri_gonderildi').length;

    const turStats = {
      'Yapım İşi': { adet: 0, tutar: 0, onayliAdet: 0, icon: 'building', color: '#ea580c', bg: '#fff7ed' },
      'Mal Alımı': { adet: 0, tutar: 0, onayliAdet: 0, icon: 'box', color: '#0284c7', bg: '#f0f9ff' },
      'Hizmet Alımı': { adet: 0, tutar: 0, onayliAdet: 0, icon: 'briefcase', color: '#16a34a', bg: '#f0fdf4' },
      'Danışmanlık': { adet: 0, tutar: 0, onayliAdet: 0, icon: 'pieChart', color: '#9333ea', bg: '#faf5ff' }
    };

    const onaylananlar = projeler.filter(p => p.status === 'onaylandi');

    projeler.forEach(p => {
      const projData = p.data ? Object.assign(getDefaultProje(), p.data) : getDefaultProje();
      const kalemler = getKalemler(projData);
      const ym = hesaplaYaklasikMaliyet(projData);
      const kazananIdx = projData.kazananFirmaIndex >= 0 ? projData.kazananFirmaIndex : hesaplaKazananFirma(projData);
      const kazananFirma = kazananIdx >= 0 && projData.teklifFirmalar ? projData.teklifFirmalar[kazananIdx] : null;
      const kazananToplam = kazananFirma ? hesaplaTeklifFirmaToplam(kazananFirma, kalemler) : 0;
      
      const tutar = p.status === 'onaylandi' && kazananToplam > 0 ? kazananToplam : (ym > 0 ? ym : 0);
      const tur = projData.isTuru && turStats[projData.isTuru] ? projData.isTuru : 'Yapım İşi';

      if (p.status === 'onaylandi') {
        toplamOnaylananTutar += tutar;
        turStats[tur].onayliAdet += 1;
      } else if (p.status === 'taslak' || p.status === 'gonderildi') {
        toplamBekleyenTutar += (ym > 0 ? ym : 0);
      }

      turStats[tur].adet += 1;
      turStats[tur].tutar += tutar;
    });

    const toplamHacimTutar = toplamOnaylananTutar + toplamBekleyenTutar;

    const onayliSatirlar = onaylananlar.map(p => {
      const projData = p.data ? Object.assign(getDefaultProje(), p.data) : getDefaultProje();
      const kalemler = getKalemler(projData);
      const ym = hesaplaYaklasikMaliyet(projData);
      const kazananIdx = projData.kazananFirmaIndex >= 0 ? projData.kazananFirmaIndex : hesaplaKazananFirma(projData);
      const kazananFirma = kazananIdx >= 0 && projData.teklifFirmalar ? projData.teklifFirmalar[kazananIdx] : null;
      const kazananToplam = kazananFirma ? hesaplaTeklifFirmaToplam(kazananFirma, kalemler) : 0;
      const isTuru = projData.isTuru || 'Yapım İşi';
      const tarih = p.onaylandiAt?.toDate
        ? p.onaylandiAt.toDate().toLocaleDateString('tr-TR')
        : (p.updatedAt?.toDate ? p.updatedAt.toDate().toLocaleDateString('tr-TR') : '-');
      return `<tr onclick="dashboardProjeAc('${p.id}')" style="cursor:pointer"
        onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background=''">
        <td style="font-weight:600;color:var(--gray-900)">${escHtml(p.isAdi || '(İsimsiz)')}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:4px;background:#f1f5f9;color:var(--gray-700);padding:3px 8px;border-radius:6px;font-size:11.5px;font-weight:500;">
            ${escHtml(isTuru)}
          </span>
        </td>
        <td>${tarih}</td>
        <td class="rakam" style="font-weight:500">${ym > 0 ? formatCurrency(ym) + ' TL' : '-'}</td>
        <td>${kazananFirma ? escHtml(kazananFirma.ad) : '<span style="color:var(--gray-400)">-</span>'}</td>
        <td class="rakam" style="font-weight:700;color:var(--primary)">${kazananToplam > 0 ? formatCurrency(kazananToplam) + ' TL' : '-'}</td>
      </tr>`;
    }).join('');

    main.innerHTML = `
      <div class="vm-page-header">
        <div class="vm-header-title">
          <div class="vm-header-icon">
            ${typeof getIcon === 'function' ? getIcon('chart', 22) : '📊'}
          </div>
          <div>
            <h2>Dashboard & Harcama İstatistikleri</h2>
            <p>Projelerin genel durumu, finansal gerçekleşme oranları ve iş türü dağılımı.</p>
          </div>
        </div>
      </div>

      <div class="stat-grid" style="margin-bottom:24px;">
        <div class="stat-card success" style="border-left:4px solid var(--success, #16a34a);">
          <div class="stat-label">Gerçekleşen Harcama</div>
          <div class="stat-value" style="font-size:22px;">${toplamOnaylananTutar > 0 ? formatCurrencyInt(toplamOnaylananTutar) + ' TL' : '0 TL'}</div>
          <div class="stat-sub" style="font-weight:600;color:#16a34a;">${onaylananSayi} Onaylanan Proje</div>
        </div>
        <div class="stat-card warning" style="border-left:4px solid var(--warning, #eab308);">
          <div class="stat-label">Süreçteki Tutar (Bekleyen)</div>
          <div class="stat-value" style="font-size:22px;">${toplamBekleyenTutar > 0 ? formatCurrencyInt(toplamBekleyenTutar) + ' TL' : '0 TL'}</div>
          <div class="stat-sub" style="font-weight:600;color:#d97706;">${bekleyenSayi} Taslak & Gönderildi</div>
        </div>
        <div class="stat-card primary" style="border-left:4px solid var(--primary, #1a56db);">
          <div class="stat-label">Toplam Proje Sayısı</div>
          <div class="stat-value" style="font-size:22px;">${toplamSayi}</div>
          <div class="stat-sub">Sistemdeki tüm dosyalar</div>
        </div>
        <div class="stat-card" style="border-left:4px solid var(--gray-400);">
          <div class="stat-label">Revizyon Bekleyen</div>
          <div class="stat-value" style="font-size:22px;color:var(--danger, #dc2626);">${geriGonderSayi}</div>
          <div class="stat-sub">Geri gönderilen işlemler</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:24px;">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
          <h3 style="display:flex;align-items:center;gap:8px;font-size:15px;margin:0;">
            <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('sliders', 18) : ''}</span>
            İş Türü & Kategori Dağılımı
          </h3>
          <span style="font-size:12px;color:var(--gray-500);font-weight:500;">${toplamSayi} Toplam Dosya</span>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;">
            ${Object.keys(turStats).map(turKey => {
              const item = turStats[turKey];
              const yuzde = toplamHacimTutar > 0 ? ((item.tutar / toplamHacimTutar) * 100).toFixed(1) : '0.0';
              return `
              <div style="background:${item.bg};border:1px solid rgba(0,0,0,0.06);border-radius:12px;padding:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                  <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px;color:${item.color};">
                    <span style="display:inline-flex">${typeof getIcon === 'function' ? getIcon(item.icon, 18) : ''}</span>
                    ${turKey}
                  </div>
                  <span style="font-size:11px;font-weight:700;background:#fff;color:${item.color};padding:2px 8px;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,0.05);">${item.adet} Dosya</span>
                </div>
                <div style="font-size:18px;font-weight:800;color:var(--gray-900);margin-bottom:4px;">
                  ${item.tutar > 0 ? formatCurrencyInt(item.tutar) + ' TL' : '0 TL'}
                </div>
                <div style="font-size:11.5px;color:var(--gray-600);margin-bottom:8px;">
                  ${item.onayliAdet} onaylanan işlem
                </div>
                <div style="background:rgba(0,0,0,0.06);height:6px;border-radius:3px;overflow:hidden;">
                  <div style="background:${item.color};width:${yuzde}%;height:100%;border-radius:3px;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--gray-500);margin-top:4px;">
                  <span>Hacim Payı</span>
                  <span style="font-weight:600;color:${item.color}">%${yuzde}</span>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 style="display:flex;align-items:center;gap:8px;font-size:15px;margin:0;">
            <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('clipboardCheck', 18) : ''}</span>
            Onaylanan Projeler & Sözleşme Bedelleri (${onaylananSayi})
          </h3>
        </div>
        <div class="card-body">
          ${onaylananlar.length === 0
            ? `<div style="text-align:center;padding:40px;color:var(--gray-400);font-size:13px">
                 Henüz onaylanmış bir proje bulunmamaktadır.
               </div>`
            : `<table class="data-table">
                 <thead>
                   <tr>
                     <th style="width:35%">Proje / İş Adı</th>
                     <th style="width:12%">İş Türü</th>
                     <th style="width:12%">Onay Tarihi</th>
                     <th style="width:14%;text-align:right">Yaklaşık Maliyet</th>
                     <th style="width:14%">Yüklenici Firma</th>
                     <th style="width:13%;text-align:right">Sözleşme / Teklif</th>
                   </tr>
                 </thead>
                 <tbody>${onayliSatirlar}</tbody>
               </table>`}
        </div>
      </div>
    `;
  } catch(e) {
    main.innerHTML = `
      <div class="page-header"><h2>Dashboard</h2></div>
      <div style="color:red;padding:20px">Hata: ${e.message}</div>`;
  }
}

// ===================== KAYDET / YÜKLE SAYFASI =====================
let currentCloudProjeId = null; // Açık olan cloud proje ID'si

async function renderKaydetYuklePage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-header">
      <h2>📁 Dosya İşlemleri</h2>
      <p>Onaylı projeleri indirin veya bilgisayarınızdan proje yükleyin.</p>
    </div>

    <!-- DOSYA GETİR (bilgisayardan sisteme) -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><h3>📥 Dosya Getir</h3></div>
      <div class="card-body">
        <p style="font-size:13px;color:#6b7280;margin-bottom:16px">
          Bilgisayarınızdaki JSON proje dosyasını seçerek sisteme getirin.<br>
          Getirilen proje <strong>Projelerim → Devam Edenler</strong> listesinde taslak olarak görünür.
        </p>
        <div class="ky-upload-area" style="margin-bottom:12px">
          <label class="ky-file-label" id="kyFileLabel">
            <span class="ky-file-icon">📄</span>
            <span class="ky-file-text">Dosya seçmek için tıklayın</span>
            <input type="file" id="fileInput" accept=".json"
              onchange="if(this.files[0]){document.getElementById('kyFileLabel').querySelector('.ky-file-text').textContent=this.files[0].name;document.getElementById('kyFileLabel').classList.add('ky-file-selected')}">
          </label>
        </div>
        <button class="btn btn-primary" onclick="yukleProjeCloud()">📥 Getir</button>
      </div>
    </div>

    <!-- DOSYA İNDİR (sistemden bilgisayara) -->
    <div class="card">
      <div class="card-header"><h3>📥 Dosya İndir</h3></div>
      <div class="card-body">
        <p style="font-size:13px;color:#6b7280;margin-bottom:16px">Onaylanan projelerinizi bilgisayarınıza JSON dosyası olarak indirin.</p>
        <div id="dosyaGetirList">
          <div style="text-align:center;padding:30px;color:var(--gray-400)">Yükleniyor...</div>
        </div>
      </div>
    </div>
  `;

  // Onaylı projeleri yükle
  try {
    const projeler = await getUserProjeler();
    const onaylananlar = projeler.filter(p => p.status === 'onaylandi');
    const listEl = document.getElementById('dosyaGetirList');
    if (!listEl) return;
    if (onaylananlar.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:30px;color:#9ca3af;font-size:13px">
          Henüz onaylanmış proje yok.
        </div>`;
    } else {
      listEl.innerHTML = `<div class="ky-proje-grid">
        ${onaylananlar.map(p => {
          const tarih = p.onaylandiAt?.toDate ? p.onaylandiAt.toDate().toLocaleDateString('tr-TR')
                      : (p.updatedAt?.toDate ? p.updatedAt.toDate().toLocaleDateString('tr-TR') : '-');
          return `<div class="ky-proje-item">
            <div class="ky-proje-info">
              <div class="ky-proje-name">${escHtml(p.isAdi || '(İsimsiz)')}</div>
              <div class="ky-proje-meta">
                <span class="ky-proje-date">📅 ${tarih}</span>
                ${getStatusBadge('onaylandi')}
              </div>
            </div>
            <div class="ky-proje-actions">
              <button class="ky-btn-open" onclick="dosyaGetir('${p.id}')">📥 İndir</button>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    }
  } catch(e) {
    const listEl = document.getElementById('dosyaGetirList');
    if (listEl) listEl.innerHTML = `<div style="color:red;padding:12px">Projeler yüklenemedi: ${e.message}</div>`;
  }
}

async function dosyaGetir(projeId) {
  try {
    const doc = await getProjeFromCloud(projeId);
    const projData = Object.assign(getDefaultProje(), doc.data);
    exportProjeJSON(projData);
  } catch(e) {
    showToast('İndirme hatası: ' + e.message, 'error');
  }
}

async function yukleProjeCloud() {
  const input = document.getElementById('fileInput');
  if (!input?.files.length) { showToast('Önce bir dosya seçin.', 'warning'); return; }
  importProjeJSON(input.files[0], async (err, data) => {
    if (err) { showToast('Dosya okunamadı: ' + err.message, 'error'); return; }
    try {
      const yeniProjeData = Object.assign(getDefaultProje(), data);
      const projeId = await saveProjeToCloud(yeniProjeData);
      showToast('Proje yüklendi! Projelerim sayfasında görünür.');
      currentPage = 'projelerim';
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelector('[data-page="projelerim"]')?.classList.add('active');
      renderPage();
    } catch(e) {
      showToast('Kayıt hatası: ' + e.message, 'error');
    }
  });
}


async function cloudKaydet() {
  if (currentProjeBaskaKullanici) { showToast('Bu proje başka bir kullanıcıya ait.', 'warning'); return; }
  if (currentProjeKilitli) { showToast('Bu proje kilitli. Değişiklikler kaydedilemez.', 'warning'); return; }
  try {
    if (currentCloudProjeId) {
      await updateProjeInCloud(currentCloudProjeId, proje);
      // Geri gönderildi ise taslağa al ve notu temizle
      const extraUpdate = { geriGonderNot: null, geriGonderAt: null, geriGonderBy: null };
      if (currentProjeStatus === 'geri_gonderildi') {
        extraUpdate.status = 'taslak';
        currentProjeStatus = 'taslak';
      }
      await db.collection('projeler').doc(currentCloudProjeId).update(extraUpdate).catch(e => console.warn('[proje] Durum güncellenemedi:', e?.code, e?.message));
      lastSavedProjeSnapshot = JSON.stringify(proje);
      showToast('Proje başarıyla kaydedildi!');
    } else {
      currentCloudProjeId = await saveProjeToCloud(proje);
      lastSavedProjeSnapshot = JSON.stringify(proje);
      showToast('Proje başarıyla kaydedildi!');
    }
    renderPage();
  } catch(e) {
    showToast('Hata: ' + hataMesaji(e), 'error');
  }
}

async function dashboardProjeAc(projeId) {
  try {
    const doc = await getProjeFromCloud(projeId);
    proje = Object.assign(getDefaultProje(), doc.data);
    currentCloudProjeId = projeId;
    currentProjeStatus = doc.status || 'taslak';
    currentProjeKazananBasitUsul = doc.kazananBasitUsul === true;
    currentProjeKilitli = true;
    currentProjeBaskaKullanici = false;
    lastSavedProjeSnapshot = JSON.stringify(proje);
    saveProje(proje);
    projeAktif = true;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    currentPage = 'proje-ozet';
    updateNavLock();
    renderPage();
  } catch(e) {
    showToast('Hata: ' + hataMesaji(e), 'error');
  }
}

async function cloudProjeAc(projeId) {
  try {
    const doc = await getProjeFromCloud(projeId);
    proje = Object.assign(getDefaultProje(), doc.data);
    currentCloudProjeId = projeId;
    currentProjeBaskaKullanici = ['admin','superadmin'].includes(currentDTMUser?.role) && doc.userId !== currentDTMUser.uid;
    currentProjeStatus = doc.status || 'taslak';
    currentProjeKazananBasitUsul = doc.kazananBasitUsul === true;
    const gonderildi = doc.status === 'gonderildi' || doc.status === 'onaylandi';
    currentProjeKilitli = doc.locked === true || currentProjeBaskaKullanici || gonderildi;
    lastSavedProjeSnapshot = JSON.stringify(proje);
    saveProje(proje);
    projeAktif = true;
    // Gerçekleştirmeci özet ekranına git, diğerleri veri girişe
    if (currentDTMUser?.role === 'gerceklestirmeci') {
      currentPage = 'proje-ozet';
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    } else {
      currentPage = 'veri-giris';
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelector('[data-page="veri-giris"]')?.classList.add('active');
    }
    updateNavLock();
    renderPage();
  } catch(e) {
    showToast('Hata: ' + hataMesaji(e), 'error');
  }
}

function projeValidasyon(p) {
  const eksikler = [];
  if (!p.isAdi?.trim())                                         eksikler.push('İş Adı');
  if (!p.idareAdi?.trim())                                      eksikler.push('İdare Adı');
  if (!p.mudurluk?.trim())                                      eksikler.push('Müdürlük');
  if (!p.ymGorevliler?.slice(0, p.ymGorevliSayisi||1).some(g => g.ad?.trim()))
                                                                 eksikler.push('Y.M. Görevlisi');
  if (!p.dtGorevliler?.slice(0, p.dtGorevliSayisi||1).some(g => g.ad?.trim()))
                                                                 eksikler.push('D.T. Görevlisi');
  if (!p.onaylayanAmir?.ad?.trim())                             eksikler.push('Onaylayan Amir');
  if (p.isTuru !== 'Yapım İşi' && !p.isKalemleri?.some(k => k.ad?.trim()))
                                                                 eksikler.push('En az 1 İş Kalemi');
  if (!p.ymFirmalar?.some(f => f.ad?.trim()))                   eksikler.push('En az 1 Y.M. Firması');
  if (!p.teklifFirmalar?.some(f => f.ad?.trim()))               eksikler.push('En az 1 Teklif Firması');
  if (!p.sozlesmeTarihi?.trim())                                 eksikler.push('Sözleşme Tarihi');
  if (!p.isSuresi || parseInt(p.isSuresi) <= 0)                 eksikler.push('İş Süresi');
  if (!p.ymOnayTarihi?.trim())                                   eksikler.push('Y.M. Onay Tarihi');
  if (!p.ymOnayNo?.trim())                                       eksikler.push('Y.M. Onay Sayısı');
  if (!p.dtOnayTarihi?.trim())                                   eksikler.push('D.T. Onay Tarihi');
  if (!p.dtOnayNo?.trim())                                       eksikler.push('D.T. Onay Sayısı');
  return eksikler;
}

async function gonderiClick(projeId, isAdi) {
  // Validasyon: önce projeyi cloud'dan çek, kontrol et
  let projeDoc;
  try {
    projeDoc = await getProjeFromCloud(projeId);
  } catch(e) {
    showToast('Proje yüklenemedi: ' + e.message, 'error'); return;
  }
  const projeData = Object.assign(getDefaultProje(), projeDoc.data);
  const eksikler = projeValidasyon(projeData);
  if (eksikler.length > 0) {
    showToast('Eksik alanlar: ' + eksikler.join(', '), 'warning', 5000);
    return;
  }

  // Gerçekleştirmecileri yükle
  let gerceklestirmeciler;
  try {
    gerceklestirmeciler = await getGerceklestirmeciler();
  } catch(e) {
    showToast('Gerçekleştirmeciler yüklenemedi.', 'error'); return;
  }
  if (gerceklestirmeciler.length === 0) {
    showToast('Sistemde kayıtlı gerçekleştirmeci bulunamadı.', 'warning'); return;
  }

  // Modal oluştur
  const modalHtml = `
    <div id="gonderiModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center">
      <div style="background:#fff;border-radius:14px;padding:32px 28px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2)">
        <h3 style="font-size:17px;font-weight:700;color:#1f2937;margin-bottom:6px">📤 Gerçekleştirmeciye Gönder</h3>
        <p style="font-size:13px;color:#6b7280;margin-bottom:20px"><strong>${isAdi}</strong> projesi seçtiğiniz kişiye gönderilecek. Bu işlem geri alınamaz.</p>
        <div style="margin-bottom:20px">
          <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:8px">Gerçekleştirmeci Seçin</label>
          <select id="gerceklestirmeciSelect" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px">
            <option value="">-- Seçin --</option>
            ${gerceklestirmeciler.map(g => `<option value="${g.uid}" data-ad="${escAttr(g.displayName)}">${escHtml(g.displayName)}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button onclick="document.getElementById('gonderiModal').remove()" style="padding:9px 20px;border:1px solid #d1d5db;background:#fff;border-radius:7px;cursor:pointer;font-size:13px">İptal</button>
          <button id="gonderiOnaylaBtn" onclick="gonderiOnayla('${projeId}', this)" style="padding:9px 20px;background:#16a34a;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:13px;font-weight:600">Gönder</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function gonderiOnayla(projeId, btn) {
  const select = document.getElementById('gerceklestirmeciSelect');
  const uid = select.value;
  const ad = select.options[select.selectedIndex]?.dataset?.ad || '';
  if (!uid) { showToast('Lütfen bir gerçekleştirmeci seçin.', 'warning'); return; }
  await butonKilitli(btn, 'Gönderiliyor...', async () => {
    try {
      // Kazanan firmanın basit usul durumunu, gönderilen projeye ait veriden yakala
      const projeDoc = await getProjeFromCloud(projeId);
      const p = Object.assign(getDefaultProje(), projeDoc.data);
      const kIdx = p.kazananFirmaIndex >= 0 ? p.kazananFirmaIndex : hesaplaKazananFirma(p);
      const kFirma = p.teklifFirmalar[kIdx];
      const basitUsul = kFirma ? isFirmaBasitUsul(kFirma.ad, referans) : false;

      await gonderiProje(projeId, uid, ad, basitUsul);
      document.getElementById('gonderiModal')?.remove();
      if (currentCloudProjeId === projeId) currentProjeKilitli = true;
      renderPage();
    } catch(e) {
      showToast('Hata: ' + hataMesaji(e), 'error');
    }
  });
}


async function arsivleClick(projeId, isAdi) {
  if (!await showConfirm(`"${escHtml(isAdi)}" projesi arşive kaldırılacak.`, 'Arşivle')) return;
  try {
    await db.collection('projeler').doc(projeId).update({ status: 'arsivlendi', arsivlendiAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('Proje arşive kaldırıldı.', 'success');
    renderPage();
  } catch(e) { showToast('Hata: ' + hataMesaji(e), 'error'); }
}

async function arsivdenCikarClick(projeId, isAdi) {
  try {
    const doc = await db.collection('projeler').doc(projeId).get();
    const data = doc.data();
    const sahipAd = data.userDisplayName || 'Proje Sahibi';
    const gcAd = data.atananGerceklestirmeciAd || null;

    // Kime gönderileceğini soran modal
    const hedef = await new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999';
      overlay.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:28px 32px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
          <h3 style="margin:0 0 8px;font-size:17px;color:#111">Arşivden Çıkar</h3>
          <p style="margin:0 0 20px;font-size:13px;color:#6b7280">Proje kime gönderilsin?</p>
          <div style="display:flex;flex-direction:column;gap:10px">
            <button id="arsivHedefSahip" style="padding:12px 16px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;text-align:left;font-size:14px;transition:border-color 0.15s">
              <div style="font-weight:600;color:#111">👤 ${sahipAd}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px">Proje sahibine geri gönder</div>
            </button>
            ${gcAd ? `<button id="arsivHedefGc" style="padding:12px 16px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;text-align:left;font-size:14px;transition:border-color 0.15s">
              <div style="font-weight:600;color:#111">👷 ${gcAd}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px">Gerçekleştirmeciye geri gönder</div>
            </button>` : ''}
          </div>
          <button id="arsivHedefIptal" style="margin-top:16px;width:100%;padding:10px;border:1px solid #d1d5db;border-radius:8px;background:#f9fafb;cursor:pointer;font-size:13px;color:#6b7280">İptal</button>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#arsivHedefSahip').onclick = () => { document.body.removeChild(overlay); resolve('sahip'); };
      if (gcAd) overlay.querySelector('#arsivHedefGc').onclick = () => { document.body.removeChild(overlay); resolve('gerceklestirmeci'); };
      overlay.querySelector('#arsivHedefIptal').onclick = () => { document.body.removeChild(overlay); resolve(null); };
    });

    if (!hedef) return;

    const guncelleme = hedef === 'sahip'
      ? { status: 'geri_gonderildi', arsivlendiAt: null, geriGonderNot: 'Arşivden çıkarıldı.', geriGonderBy: currentDTMUser?.displayName || 'Yönetici' }
      : { status: 'gonderildi', arsivlendiAt: null };

    await db.collection('projeler').doc(projeId).update(guncelleme);
    showToast('Proje arşivden çıkarıldı.', 'success');
    renderPage();
  } catch(e) { showToast('Hata: ' + hataMesaji(e), 'error'); }
}

async function adminGeriGonderClick(projeId, isAdi) {
  try {
    const doc = await db.collection('projeler').doc(projeId).get();
    const data = doc.data();
    const sahipAd = data.userDisplayName || 'Proje Sahibi';
    const gcAd = data.atananGerceklestirmeciAd || null;

    // Kime gönderileceğini sor
    const hedef = await new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999';
      overlay.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:28px 32px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
          <h3 style="margin:0 0 8px;font-size:17px;color:#111">Geri Gönder</h3>
          <p style="margin:0 0 20px;font-size:13px;color:#6b7280">Proje kime gönderilsin?</p>
          <div style="display:flex;flex-direction:column;gap:10px">
            <button id="ggHedefSahip" style="padding:12px 16px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;text-align:left;font-size:14px">
              <div style="font-weight:600;color:#111">👤 ${sahipAd}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px">Proje sahibine geri gönder</div>
            </button>
            ${gcAd ? `<button id="ggHedefGc" style="padding:12px 16px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;text-align:left;font-size:14px">
              <div style="font-weight:600;color:#111">👷 ${gcAd}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px">Gerçekleştirmeciye geri gönder</div>
            </button>` : ''}
          </div>
          <button id="ggHedefIptal" style="margin-top:16px;width:100%;padding:10px;border:1px solid #d1d5db;border-radius:8px;background:#f9fafb;cursor:pointer;font-size:13px;color:#6b7280">İptal</button>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#ggHedefSahip').onclick = () => { document.body.removeChild(overlay); resolve('sahip'); };
      if (gcAd) overlay.querySelector('#ggHedefGc').onclick = () => { document.body.removeChild(overlay); resolve('gerceklestirmeci'); };
      overlay.querySelector('#ggHedefIptal').onclick = () => { document.body.removeChild(overlay); resolve(null); };
    });

    if (!hedef) return;

    const not = await showPrompt(`Geri gönderme nedeninizi yazın:`, 'Nedeninizi buraya yazın...');
    if (not === null) return;
    if (!not.trim()) { showToast('Lütfen bir not ekleyin.', 'warning'); return; }

    const guncelleme = hedef === 'sahip'
      ? { status: 'geri_gonderildi', geriGonderNot: not.trim(), geriGonderBy: currentDTMUser?.displayName || 'Yönetici', onaylandiAt: null, onaylandiBy: null }
      : { status: 'gonderildi', geriGonderNot: not.trim(), geriGonderBy: currentDTMUser?.displayName || 'Yönetici', onaylandiAt: null, onaylandiBy: null };

    await db.collection('projeler').doc(projeId).update(guncelleme);
    showToast('Proje geri gönderildi.', 'success');
    renderPage();
  } catch(e) { showToast('Hata: ' + hataMesaji(e), 'error'); }
}


async function gonderilenOnaylaClick(projeId, isAdi) {
  try {
    const doc = await getProjeFromCloud(projeId);
    const data = Object.assign(getDefaultProje(), doc.data);
    if (!data.odenek || !data.butceTertibi) {
      showToast('Onay belgesi bilgileri eksik! Gerçekleştirme görevlisi önce ödenek ve bütçe tertibi bilgilerini girmelidir.', 'warning');
      return;
    }
    if (!await showConfirm(`"${escHtml(isAdi)}" projesi onaylanacak.<br><br>Bu işlem geri alınamaz. Emin misiniz?`, 'Onayla')) return;
    await onaylaProje(projeId);
    renderPage();
  } catch(e) {
    showToast('Hata: ' + hataMesaji(e), 'error');
  }
}

async function onaylaClick(projeId, isAdi) {
  // Onay belgesi bilgileri doldurulmuş mu kontrol et
  if (!proje.odenek || !proje.butceTertibi) {
    showToast('Onay belgesi bilgileri eksik! Lütfen gerçekleştirme görevlisinin önce ödenek ve bütçe tertibi bilgilerini girmesini bekleyin.', 'warning');
    return;
  }
  if (!await showConfirm(`"${escHtml(isAdi)}" projesi onaylanacak.<br><br>Bu işlem geri alınamaz. Emin misiniz?`, 'Onayla')) return;
  try {
    await onaylaProje(projeId);
    // Belge oluşturma sayfasına yönlendir
    currentPage = 'onay-belgesi';
    renderPage();
  } catch(e) {
    showToast('Hata: ' + hataMesaji(e), 'error');
  }
}

async function geriGonderClick(projeId, isAdi) {
  const not = await showPrompt(`"${isAdi}" projesini geri gönderiyorsunuz.<br>Geri gönderme nedeninizi yazın:`, 'Nedeninizi buraya yazın...');
  if (not === null) return;
  if (!not.trim()) { showToast('Not boş olamaz.', 'warning'); return; }
  try {
    await geriGonderProje(projeId, not.trim());
    renderPage();
  } catch(e) {
    showToast('Hata: ' + hataMesaji(e), 'error');
  }
}

async function cloudProjeSil(projeId, isAdi, kilitli) {
  if (kilitli) { showToast(`"${isAdi}" projesi kilitli. Silmek için önce kilidi açın.`, 'warning'); return; }
  if (!await showConfirm(`"${escHtml(isAdi)}" projesi kalıcı olarak silinecek. Emin misiniz?`, 'Sil')) return;
  try {
    await deleteProjeFromCloud(projeId);
    if (currentCloudProjeId === projeId) { currentCloudProjeId = null; currentProjeKilitli = false; }
    renderPage();
  } catch(e) {
    showToast('Hata: ' + hataMesaji(e), 'error');
  }
}

async function cloudProjeKilitle(projeId, kilitle) {
  try {
    await toggleProjeLock(projeId, kilitle);
    if (currentCloudProjeId === projeId) currentProjeKilitli = kilitle;
    renderPage();
  } catch(e) {
    showToast('Hata: ' + hataMesaji(e), 'error');
  }
}

async function yeniProje() {
  if (!await showConfirm('Mevcut proje silinecek. Emin misiniz?', 'Sil')) return;
  localStorage.removeItem(STORAGE_KEY);
  proje = getDefaultProje();
  currentCloudProjeId = null;
  currentProjeKilitli = false;
  currentProjeBaskaKullanici = false;
  renderPage();
}

function yukleProje() {
  const input = document.getElementById('fileInput');
  if (!input.files.length) { showToast('Dosya seçin.', 'warning'); return; }
  importProjeJSON(input.files[0], (err, data) => {
    if (err) { showToast('Dosya okunamadı: ' + err.message, 'error'); return; }
    proje = Object.assign(getDefaultProje(), data);
    saveProje(proje);
    showToast('Proje yüklendi!');
    renderPage();
  });
}

function exportRefJSON() {
  const blob = new Blob([JSON.stringify(referans, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = generateDosyaAdi() + '_REF.json';
  a.click();
  URL.revokeObjectURL(url);
}

function yukleReferans() {
  const input = document.getElementById('refFileInput');
  if (!input.files.length) { showToast('Dosya seçin.', 'warning'); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      referans = Object.assign(getDefaultReferans(), JSON.parse(e.target.result));
      saveReferans(referans);
      showToast('Referans verileri yüklendi!');
      renderPage();
    } catch(err) {
      showToast('Dosya okunamadı: ' + err.message, 'error');
    }
  };
  reader.readAsText(input.files[0]);
}

// ===================== KULLANICI YÖNETİMİ (ADMIN) =====================
async function renderKullaniciYonetimiPage() {
  const main = document.getElementById('mainContent');
  if (!['admin', 'superadmin'].includes(currentDTMUser?.role)) {
    main.innerHTML = `<div style="text-align:center;padding:60px;color:var(--gray-400)">Bu sayfaya erişim yetkiniz bulunmamaktadır.</div>`;
    return;
  }
  main.innerHTML = `
    <div class="vm-page-header">
      <div class="vm-header-title">
        <div class="vm-header-icon">
          ${typeof getIcon === 'function' ? getIcon('users', 22) : '👥'}
        </div>
        <div>
          <h2>Kullanıcı Yönetimi</h2>
          <p>Sisteme erişim yetkisi olan kullanıcıları, rolleri ve e-posta durumlarını yönetin.</p>
        </div>
      </div>
    </div>
    <div style="text-align:center;padding:40px;color:var(--gray-400)">Kullanıcılar yükleniyor...</div>
  `;
  try {
    const users = await getAllUsers();
    main.innerHTML = `
      <div class="vm-page-header">
        <div class="vm-header-title">
          <div class="vm-header-icon">
            ${typeof getIcon === 'function' ? getIcon('users', 22) : '👥'}
          </div>
          <div>
            <h2>Kullanıcı Yönetimi</h2>
            <p>Sisteme erişim yetkisi olan kullanıcıları, rolleri ve e-posta durumlarını yönetin.</p>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="card-header" style="display:flex;align-items:center;gap:8px;">
          <span style="color:var(--primary);display:inline-flex;">${typeof getIcon === 'function' ? getIcon('userCheck', 18) : ''}</span>
          <h3 style="font-size:15px;margin:0;font-weight:700;">Yeni Kullanıcı Ekle</h3>
        </div>
        <div class="card-body">
          <div class="form-grid" style="max-width:720px">
            <div class="form-group">
              <label>Ad Soyad</label>
              <input type="text" id="yeniAd" placeholder="Ad Soyad">
            </div>
            <div class="form-group">
              <label>Kullanıcı Adı</label>
              <input type="text" id="yeniUsername" placeholder="kullaniciadi">
            </div>
            <div class="form-group">
              <label>E-Posta (Opsiyonel)</label>
              <input type="email" id="yeniEmail" placeholder="ornek@karaman.gov.tr">
            </div>
            <div class="form-group">
              <label>Şifre</label>
              <input type="password" id="yeniSifre" placeholder="En az 6 karakter">
            </div>
            <div class="form-group">
              <label>Rol</label>
              <select id="yeniRol">
                <option value="user">Kullanıcı</option>
                <option value="gerceklestirmeci">Gerçekleştirme Görevlisi</option>
                <option value="admin">Yönetici</option>
                <option value="superadmin">Sistem Yöneticisi</option>
              </select>
            </div>
          </div>
          <div id="kullaniciMsg" style="margin:8px 0;font-size:13px"></div>
          <button class="btn btn-primary" onclick="kullaniciEkle(this)">+ Kullanıcı Ekle</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="display:flex;align-items:center;gap:8px;">
          <span style="color:var(--primary);display:inline-flex;">${typeof getIcon === 'function' ? getIcon('users', 18) : ''}</span>
          <h3 style="font-size:15px;margin:0;font-weight:700;">Mevcut Kullanıcılar & E-Posta Durumu (${users.length})</h3>
        </div>
        <div class="card-body" style="padding:0;overflow-x:auto;">
          <table class="data-table" style="width:100%;margin:0;">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>Kullanıcı Adı</th>
                <th>E-Posta & Doğrulama</th>
                <th>Şifre</th>
                <th>Rol</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td style="font-weight:600;color:var(--gray-900);">${escHtml(u.displayName || '-')}</td>
                  <td><span style="font-family:monospace;background:var(--gray-100);padding:2px 6px;border-radius:4px;font-size:12.5px;">@${escHtml(u.username || '-')}</span></td>
                  <td>
                    ${u.email ? `
                      <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-size:13px;color:var(--gray-800);">${escHtml(u.email)}</span>
                        ${u.emailVerified ? `
                          <span title="E-Posta Doğrulandı" style="background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:10px;display:inline-flex;align-items:center;gap:3px;">
                            ${typeof getIcon === 'function' ? getIcon('checkCircle', 12) : '✓'} Doğrulandı
                          </span>
                        ` : `
                          <span title="Doğrulama Bekliyor" style="background:#fffbeb;color:#92400e;border:1px solid #fde68a;font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:10px;">
                            ⏳ Bekliyor
                          </span>
                        `}
                      </div>
                    ` : (u.pendingEmail ? `
                      <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-size:13px;color:var(--gray-500);">${escHtml(u.pendingEmail)}</span>
                        <span title="Doğrulama Bekliyor" style="background:#fffbeb;color:#92400e;border:1px solid #fde68a;font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:10px;">⏳ Bekliyor</span>
                      </div>
                    ` : `
                      <span style="color:var(--gray-400);font-size:12px;">(Tanımlanmadı)</span>
                    `)}
                  </td>
                  <td><span class="password-mask" style="font-family:monospace;background:var(--gray-100);padding:3px 6px;border-radius:4px;cursor:pointer;font-size:13px;user-select:none" onclick="this.textContent = this.textContent === '••••••••' ? '${escAttr(u.sifre || 'Bilinmiyor')}' : '••••••••'" title="Görmek için tıkla">••••••••</span></td>
                  <td>${u.uid !== currentDTMUser.uid ? `
                    <select onchange="kullaniciRolDegistir('${u.uid}', this.value)" style="padding:4px 8px;border:1px solid var(--gray-300);border-radius:5px;font-size:12px;cursor:pointer">
                      <option value="user" ${u.role === 'user' ? 'selected' : ''}>Kullanıcı</option>
                      <option value="gerceklestirmeci" ${u.role === 'gerceklestirmeci' ? 'selected' : ''}>Gerçekleştirme Görevlisi</option>
                      <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Yönetici</option>
                      <option value="superadmin" ${u.role === 'superadmin' ? 'selected' : ''}>Sistem Yöneticisi</option>
                    </select>` : `<span class="badge badge-admin">${getRoleLabel(u.role)}</span>`}
                  </td>
                  <td>
                    ${u.uid !== currentDTMUser.uid ? `<button class="btn btn-danger btn-sm" onclick="kullaniciSil('${u.uid}', '${escAttr(u.displayName)}')">Sil</button>` : '<span style="color:var(--gray-400);font-size:12px">(Aktif oturum)</span>'}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch(e) {
    main.innerHTML = `<div class="vm-page-header"><h2>Kullanıcı Yönetimi</h2></div>
      <div style="color:red;padding:20px">Hata: ${e.message}</div>`;
  }
}

async function kullaniciEkle(btn) {
  const adEl = document.getElementById('yeniAd');
  const usernameEl = document.getElementById('yeniUsername');
  const emailEl = document.getElementById('yeniEmail');
  const sifreEl = document.getElementById('yeniSifre');
  const ad = adEl.value.trim();
  const username = usernameEl.value.trim();
  const email = emailEl ? emailEl.value.trim() : '';
  const sifre = sifreEl.value;
  const rol = document.getElementById('yeniRol').value;
  const msg = document.getElementById('kullaniciMsg');

  if (!ad || !username || !sifre) {
    markError(...[!ad && adEl, !username && usernameEl, !sifre && sifreEl].filter(Boolean));
    msg.style.color = 'red'; msg.textContent = 'Tüm zorunlu alanları doldurun.'; return;
  }
  if (sifre.length < 6) { markError(sifreEl); msg.style.color = 'red'; msg.textContent = 'Şifre en az 6 karakter olmalı.'; return; }

  msg.style.color = 'var(--gray-500)'; msg.textContent = 'Kullanıcı oluşturuluyor...';
  await butonKilitli(btn, 'Oluşturuluyor...', async () => {
    try {
      await createDTMUser(username, sifre, ad, rol, email);
      msg.style.color = 'green'; msg.textContent = `✓ "${escHtml(ad)}" kullanıcısı başarıyla oluşturuldu.`;
      document.getElementById('yeniAd').value = '';
      document.getElementById('yeniUsername').value = '';
      if (document.getElementById('yeniEmail')) document.getElementById('yeniEmail').value = '';
      document.getElementById('yeniSifre').value = '';
      renderKullaniciYonetimiPage();
    } catch(e) {
      msg.style.color = 'red';
      if (e.code === 'auth/email-already-in-use') msg.textContent = 'Bu kullanıcı adı veya e-posta zaten kullanımda.';
      else msg.textContent = 'Hata: ' + hataMesaji(e);
    }
  });
}

async function kullaniciRolDegistir(uid, yeniRol) {
  try {
    await changeUserRole(uid, yeniRol);
    renderKullaniciYonetimiPage();
  } catch(e) {
    showToast('Hata: ' + hataMesaji(e), 'error');
  }
}

async function kullaniciSil(uid, ad) {
  if (!await showConfirm(`"${escHtml(ad)}" kullanıcısı kalıcı olarak silinecek. Emin misiniz?`, 'Sil')) return;
  try {
    await db.collection('users').doc(uid).collection('secret').doc('info').delete();
    await db.collection('users').doc(uid).delete();
    renderKullaniciYonetimiPage();
  } catch(e) {
    showToast('Hata: ' + hataMesaji(e), 'error');
  }
}

// ===================== PROJELERİM SAYFASI (KULLANICI) =====================
async function renderProjelerimPage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `<div class="page-header"><h2>Projelerim</h2><p>Tüm projeleriniz ve durumları.</p></div>
    <div style="text-align:center;padding:40px;color:var(--gray-400)">Yükleniyor...</div>`;
  try {
    const projeler = await getUserProjeler();

    // Geri gönderildi badge sıfırla ve görüldü olarak işaretle
    const geriGonderilenler = projeler.filter(p => p.status === 'geri_gonderildi');
    if (geriGonderilenler.length > 0) {
      const ids = geriGonderilenler.map(p => p.id);
      db.collection('users').doc(currentDTMUser.uid).update({
        gorulenGeriGonderilenler: firebase.firestore.FieldValue.arrayUnion(...ids)
      }).catch(e => console.warn('[geriGonder] İşaretlenemedi:', e?.code, e?.message));
    }
    const badge = document.getElementById('geriGonderBadge');
    if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }

    const bolumler = [
      { keys: ['taslak'],          baslik: '📂 Devam Edenler (Taslak)',   renk: '#f9fafb', kenar: '#e5e7eb', yaziRenk: '#374151' },
      { keys: ['geri_gonderildi'], baslik: '⏳ İşlem Bekleyenler',        renk: '#fef2f2', kenar: '#fecaca', yaziRenk: '#991b1b' },
      { keys: ['gonderildi'],      baslik: '📤 Gönderilenler',            renk: '#eff6ff', kenar: '#bfdbfe', yaziRenk: '#1e40af' },
      { keys: ['onaylandi'],       baslik: '✅ Onaylananlar',              renk: '#f0fdf4', kenar: '#bbf7d0', yaziRenk: '#15803d' }
    ];

    const projeKart = (p) => {
      const tarih = p.updatedAt?.toDate ? p.updatedAt.toDate().toLocaleDateString('tr-TR') : '-';
      const isAdiSafe = escAttr(p.isAdi);
      const kilitli = p.locked === true;
      const gonderildi = p.status === 'gonderildi' || p.status === 'onaylandi';

      let durmBilgisi = '';
      if (p.status === 'gonderildi') {
        durmBilgisi = `<div style="font-size:12px;color:#1e40af;margin-top:4px">⏳ Gerçekleştirmecinin onayı bekleniyor</div>`;
      } else if (p.status === 'onaylandi') {
        durmBilgisi = `<div style="font-size:12px;color:#15803d;margin-top:4px;font-weight:600">✅ Onaylandı</div>`;
      }

      const aktif = p.status === 'taslak' || p.status === 'geri_gonderildi';
      return `<div class="ky-proje-item">
        <div class="ky-proje-info">
          <div class="ky-proje-name">
            ${kilitli ? '<span style="margin-right:4px">🔒</span>' : ''}
            ${escHtml(p.isAdi || '(İsimsiz)')}
          </div>
          <div class="ky-proje-meta">
            <span class="ky-proje-date">📅 ${tarih}</span>
            ${getIsTuruBadge(p.isTuru)}
            ${p.atananGerceklestirmeciAd ? `<span class="ky-proje-user">👷 ${p.atananGerceklestirmeciAd}</span>` : ''}
          </div>
          ${durmBilgisi}
          ${p.status === 'geri_gonderildi' && p.geriGonderNot ? `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:7px 10px;margin-top:6px;font-size:12px;color:#991b1b">
              <strong>Not:</strong> ${escHtml(p.geriGonderNot)}
            </div>` : ''}
        </div>
        <div class="ky-proje-actions">
          <button class="ky-btn-open" onclick="cloudProjeAc('${p.id}')">Aç</button>
          ${aktif && !kilitli ? `<button class="ky-btn-lock" onclick="gonderiClick('${p.id}', '${isAdiSafe}')" style="background:#16a34a;color:#fff;border-color:#16a34a">📤 Gönder</button>` : ''}
          ${aktif ? `<button class="ky-btn-lock ${kilitli ? 'ky-btn-lock-active' : ''}" onclick="cloudProjeKilitle('${p.id}', ${!kilitli})">${kilitli ? '🔓 Kilidi Aç' : '🔒 Kilitle'}</button>` : ''}
          ${aktif && !kilitli ? `<button class="ky-btn-delete" onclick="cloudProjeSil('${p.id}', '${isAdiSafe}', ${kilitli})">Sil</button>` : ''}
        </div>
      </div>`;
    };

    const renderProjelerimListe = (aramaMetni, durumFiltre) => {
      const ara = aramaMetni.trim().toLocaleLowerCase('tr');
      return bolumler.map(b => {
        if (durumFiltre !== 'hepsi' && !b.keys.includes(durumFiltre)) return '';
        let grup = projeler.filter(p => b.keys.includes(p.status || 'taslak'));
        if (ara) grup = grup.filter(p => (p.isAdi || '').toLocaleLowerCase('tr').includes(ara));
        return `<div class="ky-bolum-kart" style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:16px;overflow:hidden">
          <div class="ky-bolum-baslik" style="padding:12px 16px;background:${b.renk};border-bottom:1px solid ${b.kenar};font-weight:700;font-size:13px;color:${b.yaziRenk}">
            ${b.baslik} (${grup.length})
          </div>
          ${grup.length === 0
            ? `<div class="ky-bolum-empty" style="text-align:center;padding:20px;color:#9ca3af;font-size:13px">${ara ? 'Arama ile eşleşen proje yok.' : 'Bu kategoride proje yok.'}</div>`
            : `<div class="ky-proje-grid">${grup.map(projeKart).join('')}</div>`}
        </div>`;
      }).join('');
    };

    main.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div><h2>Projelerim</h2><p>Tüm projeleriniz ve durumları.</p></div>
        <button class="btn btn-primary" onclick="yeniProjeBaslat()">&#43; Yeni Proje</button>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <input id="projelerimArama" type="text" placeholder="🔍 Proje adına göre ara..." oninput="projelerimFiltrele()"
          style="flex:1;min-width:200px;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none">
        <select id="projelerimDurum" onchange="projelerimFiltrele()"
          style="padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;background:#fff;cursor:pointer;outline:none">
          <option value="hepsi">Tüm Durumlar</option>
          <option value="taslak">Devam Edenler</option>
          <option value="geri_gonderildi">İşlem Bekleyenler</option>
          <option value="gonderildi">Onaylananlar</option>
        </select>
      </div>
      <div id="projelerimListe">${renderProjelerimListe('', 'hepsi')}</div>`;

    window.projelerimFiltrele = () => {
      const ara = document.getElementById('projelerimArama').value;
      const durum = document.getElementById('projelerimDurum').value;
      document.getElementById('projelerimListe').innerHTML = renderProjelerimListe(ara, durum);
    };
  } catch(e) {
    main.innerHTML = `<div class="page-header"><h2>Projelerim</h2></div><div style="color:red;padding:20px">Hata: ${e.message}</div>`;
  }
}

// ===================== GERÇEKLEŞTİRMECİ SAYFASI =====================
async function renderGonderilenProjelerPage() {
  checkGonderilenProjeler(); // Sayfaya her girişte badge güncelle
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-header">
      <h2>Gönderilen Projeler</h2>
      <p>Kullanıcılar tarafından onayınıza gönderilen projeler.</p>
    </div>
    <div style="text-align:center;padding:40px;color:var(--gray-400)">Yükleniyor...</div>
  `;
  try {
    const projeler = await getUserProjeler();
    const bekleyenler = projeler.filter(p => p.status === 'gonderildi');
    const onaylananlar = projeler.filter(p => ['onaylandi', 'arsivlendi'].includes(p.status));

    // Projeler sayfası ziyaret zamanını kaydet → badge sıfırlanır
    db.collection('users').doc(currentDTMUser.uid).update({
      lastGonderilenVisit: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(e => console.warn('[lastGonderilenVisit] Güncellenemedi:', e?.code, e?.message));
    const badge = document.getElementById('gonderilenBadge');
    if (badge) badge.style.display = 'none';

    const projeKart = (p, butonlar) => {
      const tarih = p.gonderildiAt?.toDate ? p.gonderildiAt.toDate().toLocaleDateString('tr-TR') :
                    p.onaylandiAt?.toDate ? p.onaylandiAt.toDate().toLocaleDateString('tr-TR') : '-';
      const isAdiSafe = escAttr(p.isAdi);
      return `<div class="ky-proje-item">
        <div class="ky-proje-info">
          <div class="ky-proje-name"><span class="ky-proje-dot"></span>${escHtml(p.isAdi || '(İsimsiz)')}</div>
          <div class="ky-proje-meta">
            <span class="ky-proje-user">👤 ${escHtml(p.userDisplayName || '-')}</span>
            <span class="ky-proje-date">📅 ${tarih}</span>
            ${getIsTuruBadge(p.isTuru)}
            ${getStatusBadge(p.status)}
          </div>
          ${p.geriGonderNot ? `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:7px 10px;margin-top:6px;font-size:12px;color:#991b1b">
              <strong>${escHtml(p.geriGonderBy || 'Yönetici')}:</strong> ${escHtml(p.geriGonderNot)}
            </div>` : ''}
        </div>
        <div class="ky-proje-actions">${butonlar(p.id, isAdiSafe)}</div>
      </div>`;
    };

    const renderGonderilenListe = (aramaMetni) => {
      const ara = aramaMetni.trim().toLocaleLowerCase('tr');
      const filtrele = (liste) => ara
        ? liste.filter(p => (p.isAdi||'').toLocaleLowerCase('tr').includes(ara) || (p.userDisplayName||'').toLocaleLowerCase('tr').includes(ara))
        : liste;

      const bek = filtrele(bekleyenler);
      const ona = filtrele(onaylananlar);

      const bHTML = bek.length === 0
        ? `<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px">${ara ? 'Arama ile eşleşen proje yok.' : 'Bekleyen proje yok.'}</div>`
        : `<div class="ky-proje-grid">${bek.map(p => projeKart(p, (id, ad) => `
            <button class="ky-btn-open" onclick="cloudProjeAc('${id}')">Aç</button>
            <button class="ky-btn-open" onclick="gonderilenOnaylaClick('${id}', '${ad}')" style="background:#16a34a;color:#fff;border-color:#16a34a">✓ Onayla</button>
            <button class="ky-btn-delete" onclick="geriGonderClick('${id}', '${ad}')" style="background:#dc2626;color:#fff;border-color:#dc2626">↩ Geri Gönder</button>
          `)).join('')}</div>`;

      const oHTML = ona.length === 0
        ? `<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px">${ara ? 'Arama ile eşleşen proje yok.' : 'Henüz onaylanan proje yok.'}</div>`
        : `<div class="ky-proje-grid">${ona.map(p => projeKart(p, (id, ad) => `
            <button class="ky-btn-open" onclick="cloudProjeAc('${id}')">Görüntüle</button>
          `)).join('')}</div>`;

      return `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:16px;overflow:hidden">
          <div style="padding:12px 16px;background:#fef9c3;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;color:#854d0e">
            ⏳ Onay Bekleyenler (${bek.length})
          </div>
          ${bHTML}
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
          <div style="padding:12px 16px;background:#f0fdf4;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;color:#15803d">
            ✅ Onaylananlar (${ona.length})
          </div>
          ${oHTML}
        </div>`;
    };

    main.innerHTML = `
      <div class="page-header"><h2>Projeler</h2><p>Size iletilen projeler.</p></div>
      <div style="margin-bottom:16px">
        <input id="gonderilenArama" type="text" placeholder="🔍 Proje adı veya kullanıcıya göre ara..." oninput="gonderilenFiltrele()"
          style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none">
      </div>
      <div id="gonderilenListe">${renderGonderilenListe('')}</div>`;

    window.gonderilenFiltrele = () => {
      const ara = document.getElementById('gonderilenArama').value;
      document.getElementById('gonderilenListe').innerHTML = renderGonderilenListe(ara);
    };
  } catch(e) {
    main.innerHTML = `<div class="page-header"><h2>Projeler</h2></div><div style="color:red;padding:20px">Hata: ${e.message}</div>`;
  }
}

// ===================== GERÇEKLEŞTİRMECİ BELGELER SAYFASI =====================
function renderGerceklestirmeciVeriMerkeziPage() {
  const liste = (referans.butceTertibiList || []).map(bt =>
    typeof bt === 'string' ? { no: bt, aciklama: '' } : bt
  );
  const rows = liste.map((bt, i) => `
    <tr>
      <td style="width:40%"><input type="text" class="ref-input" value="${escAttr(bt.no || '')}" onchange="btGuncelle(${i},'no',this.value)" placeholder="Tertip No"></td>
      <td><input type="text" class="ref-input" value="${escAttr(bt.aciklama || '')}" onchange="btGuncelle(${i},'aciklama',this.value)" placeholder="Açıklama (Örn: Yapım İşleri)"></td>
      <td style="width:60px;text-align:center">
        <button class="btn-icon-danger" onclick="onRefDelete('butceTertibiList', ${i})" title="Sil">
          ${typeof getIcon === 'function' ? getIcon('trash', 16) : '✕'}
        </button>
      </td>
    </tr>`).join('');

  // Geçmişte kaydedilmiş boş/isimsiz yüklenicileri otomatik temizle
  if (referans.yukleniciList && Array.isArray(referans.yukleniciList)) {
    const oncekiAdet = referans.yukleniciList.length;
    referans.yukleniciList = referans.yukleniciList.filter(f => f && f.ad && f.ad.trim() && f.ad.trim() !== 'Yeni Firma' && f.ad.trim() !== '(İsimsiz Firma)');
    if (referans.yukleniciList.length !== oncekiAdet) {
      saveGlobalReferans(referans);
    }
  }

  const sortedYuklenici = (referans.yukleniciList || []).map((f, i) => ({f, i})).sort((a, b) => (a.f.ad || '').localeCompare(b.f.ad || '', 'tr-TR'));

  return `
    <div class="vm-page-header">
      <div class="vm-header-title">
        <div class="vm-header-icon">
          ${typeof getIcon === 'function' ? getIcon('database', 22) : '⚙️'}
        </div>
        <div>
          <h2>Veri Merkezi & Tanımlamalar</h2>
          <p>Projelerde ve belgelerde kullanılan bütçe tertiplerini ve ortak yüklenici havuzunu yönetin.</p>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3 style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('chart', 18) : ''}</span>
          Bütçe Tertibi Listesi
          <span style="font-size:11px;background:#e8eefb;color:var(--primary);padding:2px 8px;border-radius:12px;font-weight:600;margin-left:4px">${liste.length} Tertip</span>
        </h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <table class="ref-table">
          <thead><tr><th style="width:40%">Bütçe Tertibi No</th><th>Açıklama</th><th style="text-align:center;width:60px">İşlem</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:14px;display:flex;gap:8px;max-width:600px">
          <input type="text" class="ref-input" id="yeniBtNo" placeholder="Örn: 09.1.2.00.000/05/03.8" style="flex:1">
          <input type="text" class="ref-input" id="yeniBtAciklama" placeholder="Açıklama (Örn: Yol Yapım)" style="flex:1">
          <button class="btn btn-outline btn-sm" style="white-space:nowrap" onclick="
            const no=document.getElementById('yeniBtNo').value.trim();
            const ac=document.getElementById('yeniBtAciklama').value.trim();
            if(no){if(!referans.butceTertibiList)referans.butceTertibiList=[];referans.butceTertibiList.push({no,aciklama:ac});saveReferans(referans);renderPage();}
          ">+ Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3 style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('building', 18) : ''}</span>
          Ortak Yüklenici & Firma Havuzu
          <span style="font-size:11px;background:#e8eefb;color:var(--primary);padding:2px 8px;border-radius:12px;font-weight:600;margin-left:4px">${sortedYuklenici.length} Kayıtlı</span>
        </h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div style="display:flex; gap:10px; margin-bottom:16px; align-items:center;">
          <select class="ref-input" style="flex:1; height:40px; padding:0 12px; font-size:13px; border-radius:8px;" onchange="onYukleniciSelect(this.value)">
            <option value="-1">🔍 Kayıtlı firmalardan seçin veya düzenleyin...</option>
            ${dtmYeniEklenenYuklenici ? `<option value="NEW_YUKLENICI" selected>➕ Yeni Firma (Kaydedilmedi)</option>` : ''}
            ${sortedYuklenici.map(item => `<option value="${item.i}" ${!dtmYeniEklenenYuklenici && dtmSeciliYukleniciIndex === item.i ? 'selected' : ''}>${escHtml(item.f.ad)}</option>`).join('')}
          </select>
          <button class="btn-icon-primary" style="height:40px; padding:0 14px; font-size:13px; font-weight:600; border-radius:8px; white-space:nowrap;" onclick="onYukleniciEkle()">
            ${typeof getIcon === 'function' ? getIcon('plus', 15) : '+'} Yeni Firma
          </button>
        </div>
        
        ${(dtmYeniEklenenYuklenici || (dtmSeciliYukleniciIndex >= 0 && referans.yukleniciList && referans.yukleniciList[dtmSeciliYukleniciIndex])) ? (() => {
          const isNew = !!dtmYeniEklenenYuklenici;
          const f = isNew ? dtmYeniEklenenYuklenici : referans.yukleniciList[dtmSeciliYukleniciIndex];
          const i = isNew ? 'NEW_YUKLENICI' : dtmSeciliYukleniciIndex;
          return `
          <div style="background:var(--gray-50); padding:18px 20px; border-radius:12px; border:1px solid var(--gray-200);">
            <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:14px;">
              <div class="form-group"><label>Firma / Kişi Adı <span style="color:var(--danger)">*</span></label><input type="text" class="ref-input" id="yukleniciInputAd" value="${escAttr(f.ad || '')}" placeholder="Firma / Kişi Adı Giriniz" onchange="onFirmaFieldChange('yukleniciList', '${i}', 'ad', this.value)" oninput="onFirmaFieldChange('yukleniciList', '${i}', 'ad', this.value)"></div>
              <div class="form-group"><label>Tür <span style="color:var(--danger)">*</span></label><select class="ref-input" id="yukleniciInputTur" onchange="onFirmaFieldChange('yukleniciList', '${i}', 'tur', this.value); document.getElementById('mainContent').innerHTML = renderGerceklestirmeciVeriMerkeziPage();">
                  <option value="Kişi" ${f.tur === 'Kisi' || f.tur === 'Kişi' ? 'selected' : ''}>Kişi</option>
                  <option value="Şirket" ${f.tur === 'Şirket' ? 'selected' : ''}>Şirket</option>
              </select></div>
              <div class="form-group" style="grid-column: span 2;"><label>Adres</label><input type="text" class="ref-input" value="${escAttr(f.adres || '')}" placeholder="Açık adres giriniz" onchange="onFirmaFieldChange('yukleniciList', '${i}', 'adres', this.value)"></div>
              <div class="form-group"><label>Telefon</label><input type="text" class="ref-input" value="${escAttr(f.tel || '')}" placeholder="Örn: 05xx xxx xx xx" onchange="onFirmaFieldChange('yukleniciList', '${i}', 'tel', this.value)"></div>
              <div class="form-group"><label>Faks</label><input type="text" class="ref-input" value="${escAttr(f.faks || '')}" placeholder="Faks no giriniz" onchange="onFirmaFieldChange('yukleniciList', '${i}', 'faks', this.value)"></div>
              <div class="form-group"><label>E-Posta</label><input type="text" class="ref-input" value="${escAttr(f.eposta || '')}" placeholder="ornek@domain.com" onchange="onFirmaFieldChange('yukleniciList', '${i}', 'eposta', this.value)"></div>
              ${f.tur === 'Şirket' ? '' : `<div class="form-group"><label>Doğum Tarihi</label><input type="date" class="ref-input" value="${escAttr(f.dogumTarihi || '')}" onchange="onFirmaFieldChange('yukleniciList', '${i}', 'dogumTarihi', this.value)"></div>`}
              <div class="form-group" style="grid-column: span 2; display: flex; flex-direction: row; align-items: center; justify-content: flex-start; gap: 8px; margin-top: 5px;">
                <input type="checkbox" id="basitUsul_${i}" ${f.basitUsul ? 'checked' : ''} onchange="onFirmaFieldChange('yukleniciList', '${i}', 'basitUsul', this.checked)">
                <label for="basitUsul_${i}" style="margin:0; cursor:pointer; font-weight:600; color:var(--primary)">Bu Firma / Kişi Basit Usule Tabiidir</label>
              </div>
            </div>
            <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--gray-200); display:flex; justify-content:space-between; align-items:center;">
              <button class="btn btn-primary" onclick="kaydetYukleniciFormu('${i}')" style="display:inline-flex;align-items:center;gap:6px">
                ${typeof getIcon === 'function' ? getIcon('check', 16) : '✓'} Bilgileri Kaydet
              </button>
              ${isNew ? `
                <button class="btn btn-outline btn-sm" onclick="vazgecYukleniciFormu()">Vazgeç</button>
              ` : `
                <button class="btn btn-danger btn-sm" style="display:inline-flex;align-items:center;gap:4px" onclick="onRefDelete('yukleniciList', ${i}); onYukleniciSelect(-1);">
                  ${typeof getIcon === 'function' ? getIcon('trash', 14) : ''} Firmayı Sil
                </button>
              `}
            </div>
          </div>
          `;
        })() : ''}
      </div>
    </div>
  `;
}

let dtmSeciliYukleniciIndex = -1;
let dtmYeniEklenenYuklenici = null;

window.onYukleniciSelect = function(val) {
  if (val === 'NEW_YUKLENICI') return;
  dtmYeniEklenenYuklenici = null;
  dtmSeciliYukleniciIndex = parseInt(val, 10);
  document.getElementById('mainContent').innerHTML = renderGerceklestirmeciVeriMerkeziPage();
};

window.vazgecYukleniciFormu = function() {
  dtmYeniEklenenYuklenici = null;
  dtmSeciliYukleniciIndex = -1;
  document.getElementById('mainContent').innerHTML = renderGerceklestirmeciVeriMerkeziPage();
};

window.onYukleniciEkle = function() {
  dtmYeniEklenenYuklenici = {ad:'', adres:'', tur:'Kisi', tel:'', faks:'', eposta:'', dogumTarihi:'', basitUsul:false};
  dtmSeciliYukleniciIndex = -1;
  document.getElementById('mainContent').innerHTML = renderGerceklestirmeciVeriMerkeziPage();
  setTimeout(() => {
    const el = document.getElementById('yukleniciInputAd');
    if (el) el.focus();
  }, 50);
};

window.kaydetYukleniciFormu = function(index) {
  const isNew = index === 'NEW_YUKLENICI' || !!dtmYeniEklenenYuklenici;
  const f = isNew ? dtmYeniEklenenYuklenici : (referans.yukleniciList && referans.yukleniciList[parseInt(index, 10)]);

  if (!f || !f.ad || !f.ad.trim()) {
    showToast("Firma / Kişi Adı boş bırakılamaz!", "error");
    const inputAd = document.getElementById('yukleniciInputAd');
    if (inputAd) markError(inputAd);
    return;
  }

  if (!referans.yukleniciList) referans.yukleniciList = [];

  if (isNew) {
    referans.yukleniciList.push({...dtmYeniEklenenYuklenici, ad: dtmYeniEklenenYuklenici.ad.trim()});
    dtmSeciliYukleniciIndex = referans.yukleniciList.length - 1;
    dtmYeniEklenenYuklenici = null;
  } else {
    f.ad = f.ad.trim();
  }

  saveGlobalReferans(referans);
  showToast("Firma / Kişi bilgileri başarıyla kaydedildi.", "success");
  document.getElementById('mainContent').innerHTML = renderGerceklestirmeciVeriMerkeziPage();
};

let dtmSeciliFirmaIndex = -1;
window.onFirmaListeSelect = function(val) {
  if (val === 'NEW') return;
  dtmYeniEklenenFirma = null;
  dtmSeciliFirmaIndex = parseInt(val, 10);
  renderPage('veri-merkezi');
};

window.onFirmaListeEkle = function() {
  dtmYeniEklenenFirma = {ad:'', adres:'', tur:'Kisi', tel:'', faks:'', eposta:'', dogumTarihi:'', basitUsul:false};
  dtmSeciliFirmaIndex = -1;
  renderPage('veri-merkezi');
  setTimeout(() => {
    const el = document.getElementById('firmaInputAd');
    if (el) el.focus();
  }, 50);
};

let dtmSeciliMuhendisIndex = -1;
window.onMuhendisSelect = function(val) {
  dtmSeciliMuhendisIndex = parseInt(val, 10);
  renderPage('veri-merkezi');
};

window.acMuhendisModal = function(index = null) {
  const isEdit = index !== null && index !== undefined && index >= 0;
  const mevcut = isEdit ? referans.muhendisList[index] : { ad: '', unvan: DTM_DISIPLIN_LISTESI[0] };
  
  const modalId = 'muhendisEkleModal';
  let modal = document.getElementById(modalId);
  if (modal) modal.remove();

  const unvanOptions = DTM_DISIPLIN_LISTESI.map(u => 
    `<option value="${escAttr(u)}" ${mevcut.unvan === u ? 'selected' : ''}>${escHtml(u)}</option>`
  ).join('');

  modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'dtm-modal-overlay';
  modal.innerHTML = `
    <div class="dtm-modal" style="max-width:520px; width:92%; padding:28px 32px; border-radius:14px;">
      <div class="dtm-modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:12px; border-bottom:1px solid var(--gray-200);">
        <h3 style="display:flex; align-items:center; gap:10px; font-size:18px; font-weight:700; color:var(--gray-900); margin:0;">
          <span style="color:var(--primary); display:inline-flex">${typeof getIcon === 'function' ? getIcon('users', 22) : ''}</span>
          ${isEdit ? 'Görevli Personeli Düzenle' : 'Yeni Görevli Personel Ekle'}
        </h3>
        <button onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:var(--gray-400); cursor:pointer; font-size:18px; padding:4px;" title="Kapat">
          ${typeof getIcon === 'function' ? getIcon('x', 18) : '✕'}
        </button>
      </div>
      <div class="dtm-modal-body" style="padding:0;">
        <div class="form-group" style="margin-bottom:20px;">
          <label style="display:block; font-size:14px; font-weight:600; color:var(--gray-800); margin-bottom:8px;">
            Adı Soyadı <span style="color:var(--danger)">*</span>
          </label>
          <input type="text" id="muhendisModalAd" class="ref-input" value="${escAttr(mevcut.ad || '')}" 
            placeholder="Örn: Aziz AÇIKGÖZ"
            style="padding:12px 16px; font-size:14px; border-radius:8px; width:100%; box-sizing:border-box;"
            oninput="this.value = this.value.replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ\\s]/g, '');"
            onkeydown="if(event.key==='Enter') kaydetMuhendisModal(${isEdit ? index : 'null'})">
          <small style="color:var(--gray-500); font-size:12px; margin-top:6px; display:block;">Sadece harf ve boşluk girilebilir (Rakam kabul edilmez).</small>
        </div>
        <div class="form-group" style="margin-bottom:8px;">
          <label style="display:block; font-size:14px; font-weight:600; color:var(--gray-800); margin-bottom:8px;">
            Disiplin / Ünvan <span style="color:var(--danger)">*</span>
          </label>
          <select id="muhendisModalUnvan" class="ref-input" style="padding:12px 16px; font-size:14px; border-radius:8px; width:100%; box-sizing:border-box;">
            <option value="">-- Disiplin / Ünvan Seçiniz --</option>
            ${unvanOptions}
          </select>
        </div>
      </div>
      <div class="dtm-modal-footer" style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px; padding-top:16px; border-top:1px solid var(--gray-200);">
        <button class="btn btn-outline" style="padding:10px 20px; font-size:14px; border-radius:8px;" onclick="document.getElementById('${modalId}').remove()">Vazgeç</button>
        <button class="btn btn-primary" onclick="kaydetMuhendisModal(${isEdit ? index : 'null'})" style="display:inline-flex; align-items:center; gap:8px; padding:10px 24px; font-size:14px; font-weight:600; border-radius:8px;">
          ${typeof getIcon === 'function' ? getIcon('check', 16) : '✓'} ${isEdit ? 'Güncelle' : 'Kaydet'}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => {
    const el = document.getElementById('muhendisModalAd');
    if (el) el.focus();
  }, 50);
};

window.kaydetMuhendisModal = function(index = null) {
  const adEl = document.getElementById('muhendisModalAd');
  const unvanEl = document.getElementById('muhendisModalUnvan');
  const ad = (adEl?.value || '').trim();
  const unvan = (unvanEl?.value || '').trim();

  if (!ad) {
    showToast('Lütfen personelin Adını ve Soyadını giriniz.', 'error');
    if (adEl) markError(adEl);
    return;
  }

  if (ad.length < 3 || ad.split(' ').filter(Boolean).length < 2) {
    showToast('Lütfen en az Ad ve Soyad olarak tam isim giriniz.', 'warning');
    if (adEl) markError(adEl);
    return;
  }

  if (!unvan) {
    showToast('Lütfen listeden bir disiplin/ünvan seçiniz.', 'error');
    if (unvanEl) markError(unvanEl);
    return;
  }

  if (!referans.muhendisList) referans.muhendisList = [];

  if (index !== null && index !== undefined && index >= 0) {
    referans.muhendisList[index] = { ad, unvan };
    showToast('Görevli bilgileri güncellendi.', 'success');
  } else {
    referans.muhendisList.push({ ad, unvan });
    showToast('Yeni görevli personel başarıyla eklendi.', 'success');
  }

  referans.muhendisList.sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr-TR'));
  dtmSeciliMuhendisIndex = referans.muhendisList.findIndex(m => m.ad === ad);

  saveReferans(referans);
  const modal = document.getElementById('muhendisEkleModal');
  if (modal) modal.remove();
  renderPage('veri-merkezi');
};

async function renderGerceklestirmeciVeriMerkeziPageLoader() {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">Yüklenici Havuzu senkronize ediliyor...</div>';
  await syncYukleniciHavuzu();
  main.innerHTML = renderGerceklestirmeciVeriMerkeziPage();
}

async function syncYukleniciHavuzu() {
  try {
    const globalSnap = await db.collection('globalReferans').doc('default').get();
    let globalFirms = globalSnap.exists && globalSnap.data().yukleniciList ? globalSnap.data().yukleniciList : [];
    globalFirms.sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'));
    referans.yukleniciList = globalFirms;
  } catch(e) {
    console.error('Yüklenici havuzu yüklenemedi:', e);
  }
}

async function forceMergeYukleniciHavuzu() {
  try {
    const usersRefSnap = await db.collection('referans').get();
    const globalSnap = await db.collection('globalReferans').doc('default').get();
    let globalFirms = globalSnap.exists && globalSnap.data().yukleniciList ? globalSnap.data().yukleniciList : [];
    
    let changed = false;
    
    usersRefSnap.forEach(doc => {
      const data = doc.data();
      if (data.firmaList && Array.isArray(data.firmaList)) {
        data.firmaList.forEach(firma => {
          if(!firma.ad) return;
          const mevcut = globalFirms.find(gf => gf.ad.trim().toLowerCase() === firma.ad.trim().toLowerCase());
          if (!mevcut) {
            globalFirms.push({...firma});
            changed = true;
          } else {
            ['adres', 'tur', 'tel', 'faks', 'eposta', 'dogumTarihi'].forEach(fld => {
              if (!mevcut[fld] && firma[fld]) {
                mevcut[fld] = firma[fld];
                changed = true;
              }
            });
          }
        });
      }
    });

    if (changed) {
      globalFirms.sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr'));
      await db.collection('globalReferans').doc('default').set({ yukleniciList: globalFirms }, { merge: true });
      alert("Havuz başarıyla güncellendi ve eksik firmalar eklendi!");
      window.location.reload();
    } else {
      alert("Havuz zaten güncel, eklenecek yeni firma bulunamadı.");
    }
  } catch(e) {
    console.error('Havuz birleştirme hatası:', e);
    alert("Birleştirme başarısız: " + e.message);
  }
}


function btGuncelle(i, alan, deger) {
  if (!referans.butceTertibiList) return;
  const bt = referans.butceTertibiList[i];
  if (typeof bt === 'string') referans.butceTertibiList[i] = { no: bt, aciklama: '' };
  referans.butceTertibiList[i][alan] = deger;
  saveReferans(referans);
}

async function renderGerceklestirmeciBelgelerPage() {
  const main = document.getElementById('mainContent');

  // Proje seçiliyse belgeler görünümünü göster
  if (currentGerceklestirmeciBelgelerProjeId) {
    renderGerceklestirmeciBelgelerView(main);
    return;
  }

  // Proje listesi
  main.innerHTML = `
    <div class="page-header">
      <h2>&#128196; Belgeler</h2>
      <p>Belge oluşturmak istediğiniz onaylı projeyi seçin.</p>
    </div>
    <div id="gerceklestirmeciBelgeList">
      <div style="text-align:center;padding:40px;color:var(--gray-400)">Yükleniyor...</div>
    </div>`;

  try {
    const tumProjeler = await getUserProjeler();
    const aktif = tumProjeler.filter(p => p.status === 'gonderildi');
    const onaylananlar = tumProjeler.filter(p => ['onaylandi', 'arsivlendi'].includes(p.status));
    const listEl = document.getElementById('gerceklestirmeciBelgeList');
    if (!listEl) return;

    const projeKarti = (p, readOnly) => {
      const tarih = p.onaylandiAt?.toDate ? p.onaylandiAt.toDate().toLocaleDateString('tr-TR') : (p.gonderildiAt?.toDate ? p.gonderildiAt.toDate().toLocaleDateString('tr-TR') : '-');
      const btn = readOnly
        ? `<button class="ky-btn-open" style="background:#6b7280" onclick="gerceklestirmeciBelgelerProjeAc('${p.id}',true)">Belgeleri Gör</button>`
        : `<button class="ky-btn-open" onclick="gerceklestirmeciBelgelerProjeAc('${p.id}')">Belge Oluştur</button>`;
      return `<div class="ky-proje-item">
        <div class="ky-proje-info">
          <div class="ky-proje-name">${escHtml(p.isAdi || '(İsimsiz)')}</div>
          <div class="ky-proje-meta">
            <span class="ky-proje-user">&#128100; ${escHtml(p.userDisplayName || '-')}</span>
            <span class="ky-proje-date">&#128197; ${tarih}</span>
            ${getIsTuruBadge(p.isTuru)}
            ${getStatusBadge(p.status)}
          </div>
        </div>
        <div class="ky-proje-actions">${btn}</div>
      </div>`;
    };

    if (aktif.length === 0 && onaylananlar.length === 0) {
      listEl.innerHTML = `
        <div class="dtm-empty">
          <div class="dtm-empty-icon">&#128196;</div>
          <div class="dtm-empty-title">Henüz gönderilen proje yok</div>
          <div class="dtm-empty-desc">Belge oluşturmak için size gönderilmiş bir proje bulunmalıdır.</div>
        </div>`;
      return;
    }

    let html = '';
    if (aktif.length > 0) {
      html += `<h3 style="font-size:14px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px">Aktif Projeler</h3>
        <div class="ky-proje-grid" style="margin-bottom:28px">${aktif.map(p => projeKarti(p, false)).join('')}</div>`;
    }
    if (onaylananlar.length > 0) {
      html += `<h3 style="font-size:14px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px">Onayladıklarım</h3>
        <div class="ky-proje-grid">${onaylananlar.map(p => projeKarti(p, true)).join('')}</div>`;
    }
    listEl.innerHTML = html;
  } catch(e) {
    const listEl = document.getElementById('gerceklestirmeciBelgeList');
    if (listEl) listEl.innerHTML = `<div style="color:red;padding:20px">Projeler yüklenemedi: ${e.message}</div>`;
  }
}

function renderGerceklestirmeciBelgelerView(main) {
  // Gerçekleştirme görevlisini oturum açan kullanıcıdan otomatik doldur
  if (!proje.gerceklestirmeGorevlisi?.ad) {
    proje.gerceklestirmeGorevlisi = {
      ad: currentDTMUser?.displayName || currentDTMUser?.username || '',
      unvan: currentDTMUser?.unvan || 'Gerçekleştirme Görevlisi'
    };
  }

  const isMalVeyaHizmet = proje.isTuru === 'Mal Alımı' || proje.isTuru === 'Hizmet Alımı' || proje.isTuru === 'Danışmanlık';
  const sonTutanakId = isMalVeyaHizmet ? 'muayene-kabul' : 'bitti-tutanagi';
  const sonTutanakAd = isMalVeyaHizmet ? 'Muayene ve Kabul' : 'Bitti Tutanağı';

  const belgeler = [
    { id: 'dt-onay-belgesi', ad: 'D.T. Onay Belgesi' },
    { id: 'yaklasik-maliyet', ad: 'Yaklaşık Maliyet' },
    { id: 'teklif-tutanagi', ad: 'Teklif Tutanağı' },
    { id: 'teknik-sartname', ad: 'Teknik Şartname' },
    ...(isMalVeyaHizmet ? [] : [{ id: 'sozlesme', ad: 'Sözleşme' }]),
    { id: sonTutanakId, ad: sonTutanakAd },
    { id: 'hakedis-raporu', ad: 'Hakediş Raporu' }
  ];

  if (currentGerceklestirmeciBelge === 'bitti-tutanagi' && isMalVeyaHizmet) currentGerceklestirmeciBelge = 'muayene-kabul';
  if (currentGerceklestirmeciBelge === 'muayene-kabul' && !isMalVeyaHizmet) currentGerceklestirmeciBelge = 'bitti-tutanagi';
  if (currentGerceklestirmeciBelge === 'sozlesme' && isMalVeyaHizmet) currentGerceklestirmeciBelge = 'dt-onay-belgesi';

  const tabs = belgeler.map(b =>
    `<div class="belge-tab ${currentGerceklestirmeciBelge === b.id ? 'active' : ''}"
      onclick="currentGerceklestirmeciBelge='${b.id}';renderPage();">${b.ad}</div>`
  ).join('');

  let belgeHTML = '';
  switch (currentGerceklestirmeciBelge) {
    case 'dt-onay-belgesi': belgeHTML = renderDogrudanTeminOnayBelgesi(proje); break;
    case 'yaklasik-maliyet': belgeHTML = renderYaklasikMaliyet(proje, referans); break;
    case 'teklif-tutanagi': belgeHTML = renderTeklifTutanagi(proje, referans); break;
    case 'teknik-sartname': belgeHTML = renderTeknikSartname(proje, referans); break;
    case 'sozlesme': belgeHTML = renderSozlesme(proje, referans); break;
    case 'bitti-tutanagi': belgeHTML = renderBittiTutanagi(proje, referans); break;
    case 'muayene-kabul': belgeHTML = renderMuayeneKabulTutanagi(proje, referans); break;
    case 'hakedis-raporu': belgeHTML = renderHakedisRaporu(proje, referans); break;
  }

  main.innerHTML = `
    <div class="page-header" style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <button onclick="currentGerceklestirmeciBelgelerProjeId=null;currentGerceklestirmeciReadOnly=false;renderPage();"
        style="background:none;border:1px solid var(--gray-300);border-radius:6px;padding:6px 12px;
               cursor:pointer;font-size:13px;color:var(--gray-600);white-space:nowrap;margin-top:4px">
        ← Proje Listesi
      </button>
      <div>
        <h2>📄 Belgeler${currentGerceklestirmeciReadOnly ? ' <span style="font-size:12px;font-weight:600;color:#6b7280;background:#f3f4f6;padding:3px 8px;border-radius:6px;vertical-align:middle">Salt Okunur</span>' : ''}</h2>
        <p style="display:flex;align-items:center;gap:8px">${escHtml(proje.isAdi || '')} ${getStatusBadge(currentProjeStatus || 'onaylandi')}</p>
      </div>
    </div>
    <div class="belge-tabs">${tabs}</div>
    <div class="action-bar" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      ${currentGerceklestirmeciBelge === 'teknik-sartname' && !currentGerceklestirmeciReadOnly ? `
        <button onclick="acTeknikSartnameDuzenleModal()"
          style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#f59e0b;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(245,158,11,0.35)"
          onmouseover="this.style.background='#d97706'" onmouseout="this.style.background='#f59e0b'">
          <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Şartname Metnini Düzenle
        </button>
      ` : ''}
      <button onclick="gerceklestirmeciBelgeYazdir()"
        style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;background:#3b82f6;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(59,130,246,0.35)"
        onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
        <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
        Yazdır
      </button>
      <button onclick="acGerceklestirmeciIndirModal()"
        style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;background:#10b981;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(16,185,129,0.35)"
        onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
        <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        İndir
      </button>
      <button onclick="gerceklestirmeciBelgePdfIndir()" style="display:none">PDF İndir</button>
    </div>
    <div class="belge-preview${['yaklasik-maliyet','teklif-tutanagi'].includes(currentGerceklestirmeciBelge) ? ' landscape' : ''}">${belgeHTML}</div>
  `;
}

async function gcOnayBilgiKaydet() {
  proje.odenek = document.getElementById('gc_odenek')?.value || '';
  proje.yatirimProjeNo = document.getElementById('gc_yatirimProjeNo')?.value || '';
  proje.butceTertibi = document.getElementById('gc_butceTertibi')?.value || '';
  proje.isMiktari = document.getElementById('gc_isMiktari')?.value || '';
  proje.avansVar = document.getElementById('gc_avansVar')?.value || 'Hayır';
  proje.fiyatFarkiVar = document.getElementById('gc_fiyatFarkiVar')?.value || 'Hayır';
  proje.sartnameVar = document.getElementById('gc_sartnameVar')?.value || 'Düzenlenecek';
  proje.sozlesmeVar = document.getElementById('gc_sozlesmeVar')?.value || 'Düzenlenecek';
  proje.gerceklestirmeGorevlisi = {
    ad: currentDTMUser?.displayName || currentDTMUser?.username || '',
    unvan: currentDTMUser?.unvan || 'Gerçekleştirme Görevlisi'
  };
  const projeId = currentGerceklestirmeciBelgelerProjeId || currentCloudProjeId;
  try {
    if (projeId) {
      await updateProjeInCloud(projeId, proje);
    } else {
      saveProje(proje);
    }
    showToast('Kaydedildi', 'success');
    renderPage();
  } catch(e) {
    showToast('Kayıt hatası: ' + e.message, 'error');
  }
}

async function gerceklestirmeciBelgelerProjeAc(projeId, readOnly = false) {
  try {
    const doc = await getProjeFromCloud(projeId);
    if (doc.atananGerceklestirmeciUid !== auth.currentUser?.uid) {
      showToast('Bu projeye erişim yetkiniz yok.', 'error'); return;
    }
    proje = Object.assign(getDefaultProje(), doc.data);
    currentCloudProjeId = projeId;
    currentProjeStatus = doc.status || 'onaylandi';
    currentProjeKazananBasitUsul = doc.kazananBasitUsul === true;
    currentGerceklestirmeciBelgelerProjeId = projeId;
    currentGerceklestirmeciBelge = 'dt-onay-belgesi';
    currentGerceklestirmeciReadOnly = readOnly;
    currentGerceklestirmeciTab = 'belgeler';
    currentPage = 'gerceklestirmeci-belgeler';
    renderPage();
  } catch(e) {
    showToast('Proje yüklenemedi: ' + e.message, 'error');
  }
}

function gerceklestirmeciBelgeYazdir() {
  let html = '';
  let landscape = false;
  switch (currentGerceklestirmeciBelge) {
    case 'dt-onay-belgesi': html = renderDogrudanTeminOnayBelgesi(proje); break;
    case 'yaklasik-maliyet': html = renderYaklasikMaliyet(proje, referans); landscape = true; break;
    case 'teklif-tutanagi': html = renderTeklifTutanagi(proje, referans); landscape = true; break;
    case 'teknik-sartname': html = renderTeknikSartname(proje, referans); break;
    case 'sozlesme': html = renderSozlesme(proje, referans); belgeYazdir(html, false, true); return;
    case 'bitti-tutanagi': html = renderBittiTutanagi(proje, referans); break;
    case 'muayene-kabul': html = renderMuayeneKabulTutanagi(proje, referans); break;
    case 'hakedis-raporu': html = renderHakedisRaporu(proje, referans); break;
  }
  belgeYazdir(html, landscape);
}

function gerceklestirmeciBelgePdfIndir() {
  const belgeAdlari = {
    'dt-onay-belgesi': 'DT Onay Belgesi',
    'yaklasik-maliyet': 'Yaklaşık Maliyet Tutanağı',
    'teklif-tutanagi': 'Teklif Tutanağı',
    'teknik-sartname': 'Teknik Şartname',
    'sozlesme': 'Sözleşme',
    'bitti-tutanagi': 'Bitti Tutanağı',
    'muayene-kabul': 'Muayene ve Kabul Tutanağı',
    'hakedis-raporu': 'Hakediş Raporu'
  };
  let html = '';
  let landscape = false;
  let sozlesme = false;
  switch (currentGerceklestirmeciBelge) {
    case 'dt-onay-belgesi':  html = renderDogrudanTeminOnayBelgesi(proje);  break;
    case 'yaklasik-maliyet': html = renderYaklasikMaliyet(proje, referans); landscape = true; break;
    case 'teklif-tutanagi':  html = renderTeklifTutanagi(proje, referans);  landscape = true; break;
    case 'teknik-sartname':  html = renderTeknikSartname(proje, referans);  break;
    case 'sozlesme':         html = renderSozlesme(proje, referans);        sozlesme = true;  break;
    case 'bitti-tutanagi':   html = renderBittiTutanagi(proje, referans);   break;
    case 'muayene-kabul':    html = renderMuayeneKabulTutanagi(proje, referans); break;
    case 'hakedis-raporu':   html = renderHakedisRaporu(proje, referans);   break;
  }
  const dosyaAdi = `${proje.isAdi || 'Belge'} - ${belgeAdlari[currentGerceklestirmeciBelge] || currentGerceklestirmeciBelge}`;
  belgePdfIndir(html, landscape, sozlesme, dosyaAdi);
}

// ===================== PROJE ÖZET SAYFASI (GERÇEKLEŞTİRMECİ) =====================
function renderProjeOzetPage() {
  const main = document.getElementById('mainContent');
  const p = proje;
  const kalemler = getKalemler(p);
  const ymMaliyet = hesaplaYaklasikMaliyet(p);
  const kazananIndex = p.kazananFirmaIndex >= 0 ? p.kazananFirmaIndex : hesaplaKazananFirma(p);
  const kazananFirma = p.teklifFirmalar[kazananIndex];
  const sozlesmeKdvsiz = kazananFirma ? kazananFirma.fiyatlar.reduce((t, f, i) => {
    const miktar = parseFloat(kalemler[i]?.miktar) || 1;
    return t + (parseFloat(f) || 0) * miktar;
  }, 0) : 0;
  const basitUsul = currentProjeKazananBasitUsul === true || (kazananFirma && typeof isFirmaBasitUsul === 'function' ? isFirmaBasitUsul(kazananFirma.ad, referans) : false);
  const kdvTutar = basitUsul ? 0 : sozlesmeKdvsiz * (p.kdvOrani / 100);
  const sozlesmeToplamKdvli = sozlesmeKdvsiz + kdvTutar;

  const satir = (label, value) => value ? `<tr><td style="color:#6b7280;padding:8px 12px;font-size:13px;width:45%">${label}</td><td style="padding:8px 12px;font-size:13px;font-weight:500">${value}</td></tr>` : '';
  const kart = (baslik, icerik) => `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:16px;overflow:hidden"><div style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;color:#374151">${baslik}</div>${icerik}</div>`;

  const ymGorevliler = p.ymGorevliler.slice(0, p.ymGorevliSayisi || 1).filter(g => g.ad).map(g => `<tr><td style="padding:6px 12px;font-size:13px">${g.ad}</td><td style="padding:6px 12px;font-size:13px;color:#6b7280">${g.unvan}</td></tr>`).join('');
  const dtGorevliler = p.dtGorevliler.slice(0, p.dtGorevliSayisi || 1).filter(g => g.ad).map(g => `<tr><td style="padding:6px 12px;font-size:13px">${g.ad}</td><td style="padding:6px 12px;font-size:13px;color:#6b7280">${g.unvan}</td></tr>`).join('');

  const ymFirmalar = p.ymFirmalar.filter(f => f.ad);
  const ymFirmaRows = ymFirmalar.map(f => {
    const toplam = hesaplaYMFirmaToplam(f, kalemler);
    return `<tr>
      <td style="padding:7px 12px;font-size:13px">${f.ad}</td>
      <td style="padding:7px 12px;font-size:13px;text-align:right">${formatCurrency(toplam)} TL</td>
    </tr>`;
  }).join('');

  const teklifFirmalar = p.teklifFirmalar.filter(f => f.ad);
  const firmaTeklifRows = teklifFirmalar.map((f, fi) => {
    const gercekIndex = p.teklifFirmalar.indexOf(f);
    const toplam = hesaplaTeklifFirmaToplam(f, kalemler);
    const kazanan = gercekIndex === kazananIndex;
    return `<tr style="${kazanan ? 'background:#f0fdf4;font-weight:600' : ''}">
      <td style="padding:7px 12px;font-size:13px">${kazanan ? '✓ ' : ''}${f.ad}</td>
      <td style="padding:7px 12px;font-size:13px;text-align:right">${formatCurrency(toplam)} TL</td>
    </tr>`;
  }).join('');

  main.innerHTML = `
    <div style="max-width:800px;margin:0 auto;padding:24px 16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <button onclick="${currentOnayliBelgelerProjeId ? 'currentOnayliBelgelerProjeId=null' : "currentPage='gonderilen-projeler'"};renderPage();" style="padding:7px 14px;border:1px solid #d1d5db;background:#fff;border-radius:7px;cursor:pointer;font-size:13px">← Geri</button>
        <div>
          <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0">${escHtml(p.isAdi || '(İsimsiz Proje)')}</h2>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">${getStatusBadge(currentProjeStatus || 'gonderildi')} Proje Özeti</div>
        </div>
      </div>

      ${kart('📋 Proje Bilgileri', `<table style="width:100%;border-collapse:collapse">
        ${satir('İdare', p.idareAdi)}
        ${satir('Müdürlük', p.mudurluk)}
        ${satir('İş / Hizmet Adı', escHtml(p.isAdi))}
        ${satir('İş Türü', p.isTuru)}
        ${satir('KDV Oranı', '%' + p.kdvOrani)}
        ${satir('Şehir / İlçe', [p.sehir, p.ilce].filter(Boolean).join(' / '))}
      </table>`)}

      ${kart('👷 Y.M. Görevlileri', `<table style="width:100%;border-collapse:collapse">${ymGorevliler || '<tr><td style="padding:10px 12px;color:#9ca3af;font-size:13px">Bilgi girilmemiş</td></tr>'}</table>`) }
      ${kart('👷 D.T. Görevlileri', `<table style="width:100%;border-collapse:collapse">${dtGorevliler || '<tr><td style="padding:10px 12px;color:#9ca3af;font-size:13px">Bilgi girilmemiş</td></tr>'}</table>`)}

      ${kart('📅 Onay ve Sözleşme Bilgileri', `<table style="width:100%;border-collapse:collapse">
        ${satir('Y.M. Onay Tarihi', formatDate(p.ymOnayTarihi))}
        ${satir('Y.M. Onay Sayısı', p.ymOnayNo)}
        ${satir('D.T. Onay Tarihi', formatDate(p.dtOnayTarihi))}
        ${satir('D.T. Onay Sayısı', p.dtOnayNo)}
        ${satir('Onaylayan Amir', p.onaylayanAmir?.ad ? p.onaylayanAmir.ad + ' / ' + p.onaylayanAmir.unvan : '')}
        ${satir('Sözleşme Tarihi', formatDate(p.sozlesmeTarihi))}
        ${satir('İş Süresi', p.isSuresi ? p.isSuresi + ' Takvim Günü' : '')}
        ${satir('Fiili Bitim Tarihi', formatDate(p.fiiliBitimTarihi))}
      </table>`)}

      ${ymFirmalar.length > 0 ? kart('📊 Yaklaşık Maliyete Esas Teklifler', `
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280">Firma</th><th style="padding:8px 12px;font-size:12px;text-align:right;color:#6b7280">Teklif Tutarı</th></tr></thead>
          <tbody>${ymFirmaRows}</tbody>
          ${ymMaliyet > 0 ? `<tfoot><tr style="background:#f9fafb;border-top:2px solid #e5e7eb"><td style="padding:8px 12px;font-size:13px;font-weight:700">Yaklaşık Maliyet</td><td style="padding:8px 12px;font-size:13px;font-weight:700;text-align:right">${formatCurrency(ymMaliyet)} TL</td></tr></tfoot>` : ''}
        </table>`) : ''}

      ${teklifFirmalar.length > 0 ? kart('🏢 Teklifler', `
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280">Firma</th><th style="padding:8px 12px;font-size:12px;text-align:right;color:#6b7280">Teklif Tutarı</th></tr></thead>
          <tbody>${firmaTeklifRows}</tbody>
          ${kazananFirma?.ad ? `<tfoot><tr style="background:#f0fdf4;border-top:2px solid #bbf7d0"><td style="padding:8px 12px;font-size:13px;font-weight:700;color:#15803d">✓ Kazanan Firma</td><td style="padding:8px 12px;font-size:13px;font-weight:700;color:#15803d;text-align:right">${kazananFirma.ad}</td></tr></tfoot>` : ''}
        </table>`) : ''}

      ${kart('💰 Mali Özet', `<table style="width:100%;border-collapse:collapse">
        ${satir(basitUsul ? 'Sözleşme Tutarı' : 'Sözleşme Tutarı (KDV Hariç)', sozlesmeKdvsiz > 0 ? formatCurrency(sozlesmeKdvsiz) + ' TL' : '')}
        ${basitUsul ? satir('KDV Durumu', '<span style="color:#16a34a;font-weight:600">Basit Usul (KDV Muaf)</span>') : satir('KDV Tutarı (%' + p.kdvOrani + ')', kdvTutar > 0 ? formatCurrency(kdvTutar) + ' TL' : '0,00 TL')}
        ${!basitUsul ? satir('Sözleşme Tutarı (KDV Dahil)', sozlesmeToplamKdvli > 0 ? formatCurrency(sozlesmeToplamKdvli) + ' TL' : '') : ''}
      </table>`)}

      ${currentDTMUser?.role === 'gerceklestirmeci' ? (() => {
        const ro = currentProjeStatus !== 'gonderildi';
        const dis = ro ? 'disabled style="background:#f3f4f6;color:#6b7280;cursor:not-allowed"' : '';
        const roInp = ro ? 'readonly style="background:#f3f4f6;color:#6b7280"' : '';
        return `
      <div style="background:#fff;border:1px solid ${ro ? '#d1fae5' : '#e5e7eb'};border-radius:12px;margin-bottom:16px;overflow:hidden">
        <div style="padding:12px 16px;background:${ro ? '#f0fdf4' : '#f9fafb'};border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;color:${ro ? '#15803d' : '#374151'};display:flex;align-items:center;gap:8px">
          📝 Onay Belgesi Bilgileri ${ro ? '<span style="font-size:11px;font-weight:500;background:#bbf7d0;color:#166534;padding:2px 8px;border-radius:10px">✓ Onaylandı — Salt Okunur</span>' : ''}
        </div>
        <div style="padding:16px">
          <div class="form-grid">
            <div class="form-group">
              <label>Kullanılabilir Ödenek Tutarı (TL)</label>
              <input type="number" id="gc_odenek" value="${p.odenek || ''}" placeholder="0.00" ${roInp}>
            </div>
            <div class="form-group">
              <label>Yatırım Proje Numarası</label>
              <input type="text" id="gc_yatirimProjeNo" value="${p.yatirimProjeNo || ''}" placeholder="Varsa giriniz" ${roInp}>
            </div>
            <div class="form-group">
              <label>Bütçe Tertibi</label>
              <select id="gc_butceTertibi" ${dis}>
                <option value="">-- Seçin --</option>
                ${(referans.butceTertibiList || []).map(bt => { const no = typeof bt === 'string' ? bt : bt.no; const ac = typeof bt === 'string' ? '' : bt.aciklama; return `<option value="${no}" ${p.butceTertibi === no ? 'selected' : ''}>${no}${ac ? ' — ' + ac : ''}</option>`; }).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>İşin Miktarı</label>
              <input type="text" id="gc_isMiktari"
                value="${p.isTuru === 'Yapım İşi' ? '1 Adet' : (p.isMiktari || '')}"
                ${ro || p.isTuru === 'Yapım İşi' ? 'readonly style="background:#f3f4f6;color:#6b7280"' : ''}
                placeholder="Örn: 5 Adet">
            </div>
            <div class="form-group">
              <label>Avans Verilecek mi</label>
              <select id="gc_avansVar" ${dis}>
                <option value="Hayır" ${(p.avansVar || 'Hayır') === 'Hayır' ? 'selected' : ''}>Hayır</option>
                <option value="Evet" ${p.avansVar === 'Evet' ? 'selected' : ''}>Evet</option>
              </select>
            </div>
            <div class="form-group">
              <label>Fiyat Farkı Uygulanacak mı</label>
              <select id="gc_fiyatFarkiVar" ${dis}>
                <option value="Hayır" ${(p.fiyatFarkiVar || 'Hayır') === 'Hayır' ? 'selected' : ''}>Hayır</option>
                <option value="Evet" ${p.fiyatFarkiVar === 'Evet' ? 'selected' : ''}>Evet</option>
              </select>
            </div>
            <div class="form-group">
              <label>Şartname Düzenlenecek mi</label>
              <select id="gc_sartnameVar" ${dis}>
                <option value="Düzenlenecek" ${(p.sartnameVar || 'Düzenlenecek') === 'Düzenlenecek' ? 'selected' : ''}>Düzenlenecek</option>
                <option value="Düzenlenmeyecek" ${p.sartnameVar === 'Düzenlenmeyecek' ? 'selected' : ''}>Düzenlenmeyecek</option>
              </select>
            </div>
            <div class="form-group">
              <label>Sözleşme Düzenlenecek mi</label>
              <select id="gc_sozlesmeVar" ${dis}>
                <option value="Düzenlenecek" ${(p.sozlesmeVar || 'Düzenlenecek') === 'Düzenlenecek' ? 'selected' : ''}>Düzenlenecek</option>
                <option value="Düzenlenmeyecek" ${p.sozlesmeVar === 'Düzenlenmeyecek' ? 'selected' : ''}>Düzenlenmeyecek</option>
              </select>
            </div>
          </div>
          ${!ro ? `<div style="margin-top:14px"><button class="btn btn-primary" onclick="gcOnayBilgiKaydet()">💾 Kaydet</button></div>` : ''}
        </div>
      </div>`;
      })() : ''}

      ${currentDTMUser?.role === 'admin' || currentDTMUser?.role === 'superadmin' ? (() => {
        const bt = (referans.butceTertibiList || []).find(b => (typeof b === 'string' ? b : b.no) === p.butceTertibi);
        const btLabel = bt ? (typeof bt === 'string' ? bt : bt.no + (bt.aciklama ? ' — ' + bt.aciklama : '')) : (p.butceTertibi || '-');
        const odenek = p.odenek ? Number(p.odenek).toLocaleString('tr-TR', {minimumFractionDigits:2}) + ' TL' : '-';
        return kart('💳 Ödenek ve Bütçe Bilgileri', `<table style="width:100%;border-collapse:collapse">
          ${satir('Kullanılabilir Ödenek', odenek)}
          ${satir('Bütçe Tertibi', btLabel)}
          ${satir('Yatırım Proje No', p.yatirimProjeNo || '')}
          ${satir('İşin Miktarı', p.isMiktari || '')}
          ${satir('Avans', p.avansVar || '')}
          ${satir('Fiyat Farkı', p.fiyatFarkiVar || '')}
        </table>`);
      })() : ''}

      ${currentDTMUser?.role !== 'gerceklestirmeci' && !currentOnayliBelgelerProjeId && !['onaylandi','arsivlendi'].includes(currentProjeStatus) ? `
      <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px;padding-bottom:32px">
        <button onclick="geriGonderClick('${currentCloudProjeId}', '${escAttr(p.isAdi)}')"
          style="padding:10px 24px;background:#fff;border:1px solid #dc2626;color:#dc2626;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">
          ↩ Geri Gönder
        </button>
        <button onclick="onaylaClick('${currentCloudProjeId}', '${escAttr(p.isAdi)}')"
          style="padding:10px 24px;background:#16a34a;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">
          ✓ Onayla
        </button>
      </div>` : '<div style="padding-bottom:32px"></div>'}
    </div>`;
}

// ===================== ONAY BELGESİ SAYFASI (GERÇEKLEŞTİRMECİ) =====================
function renderOnayBelgesiPage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div style="max-width:800px;margin:0 auto;padding:24px 16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <button onclick="currentPage='gonderilen-projeler';renderPage();" style="padding:7px 14px;border:1px solid #d1d5db;background:#fff;border-radius:7px;cursor:pointer;font-size:13px">← Geri</button>
        <div>
          <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0">Onay Belgesi Oluştur</h2>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">${escHtml(proje.isAdi || '(İsimsiz Proje)')}</div>
        </div>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:32px;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">✅</div>
        <div style="font-size:16px;font-weight:700;color:#15803d;margin-bottom:8px">Proje Onaylandı</div>
        <div style="font-size:13px;color:#166534;margin-bottom:24px">Belge formatı tamamlandıktan sonra buradan Doğrudan Temin Onay Belgesi oluşturabileceksiniz.</div>
        <button onclick="currentPage='gonderilen-projeler';renderPage();" style="padding:10px 24px;background:#16a34a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">Proje Listesine Dön</button>
      </div>
    </div>`;
}

// ===================== YÖNETİCİ ARŞİV SAYFASI =====================
async function renderOnayliBelgelerPage() {
  const main = document.getElementById('mainContent');

  // Proje seçiliyse proje özeti görünümüne geç
  if (currentOnayliBelgelerProjeId) {
    renderProjeOzetPage();
    return;
  }

  // Ziyaret zamanını kaydet, badge sıfırla
  if (currentDTMUser?.uid) {
    db.collection('users').doc(currentDTMUser.uid).update({
      lastOnayliVisit: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(e => console.warn('[lastOnayliVisit] Güncellenemedi:', e?.code, e?.message));
    const badge = document.getElementById('onayliBadge');
    if (badge) badge.style.display = 'none';
  }

  // Proje listesi
  main.innerHTML = `
    <div class="page-header">
      <h2>&#128193; Proje Arşivi</h2>
      <p>Gerçekleştirme görevlilerinin onayladığı tüm projeler.</p>
    </div>
    <div id="onayliBelgelerContent">
      <div style="text-align:center;padding:40px;color:var(--gray-400)">Yükleniyor...</div>
    </div>
  `;

  try {
    const tumProjeler = await getUserProjeler();
    const bekleyenler  = tumProjeler.filter(p => p.status === 'onaylandi');
    const arsivdekiler = tumProjeler.filter(p => p.status === 'arsivlendi');
    const el = document.getElementById('onayliBelgelerContent');
    if (!el) return;

    let aktifSekme = 'bekleyenler'; // 'bekleyenler' | 'arsiv'

    const filtrele = (kaynak, ara, tarih, kullanici, siralama, bas, bit) => {
      const simdi = new Date();
      let liste = kaynak.filter(p => {
        if (ara && !(
          (p.isAdi||'').toLocaleLowerCase('tr').includes(ara) ||
          (p.userDisplayName||'').toLocaleLowerCase('tr').includes(ara) ||
          (p.atananGerceklestirmeciAd||'').toLocaleLowerCase('tr').includes(ara)
        )) return false;
        if (kullanici !== 'hepsi' && p.userDisplayName !== kullanici) return false;
        const t = p.onaylandiAt?.toDate ? p.onaylandiAt.toDate() : null;
        if (tarih === 'bu-ay') { if (!t || t.getMonth()!==simdi.getMonth()||t.getFullYear()!==simdi.getFullYear()) return false; }
        else if (tarih === 'bu-yil') { if (!t||t.getFullYear()!==simdi.getFullYear()) return false; }
        else if (tarih === 'aralik') {
          if (!t) return false;
          if (bas && t < new Date(bas)) return false;
          if (bit && t > new Date(bit+'T23:59:59')) return false;
        }
        return true;
      });
      if (siralama === 'az') liste = [...liste].sort((a,b)=>(a.isAdi||'').localeCompare(b.isAdi||'','tr'));
      else if (siralama === 'za') liste = [...liste].sort((a,b)=>(b.isAdi||'').localeCompare(a.isAdi||'','tr'));
      else if (siralama === 'eski') liste = [...liste].sort((a,b)=>(a.onaylandiAt?.toMillis?.()??0)-(b.onaylandiAt?.toMillis?.()??0));
      return liste;
    };

    const renderListe = () => {
      const ara      = (el.querySelector('#onayliArama')?.value||'').trim().toLocaleLowerCase('tr');
      const tarih    = el.querySelector('#onayliTarih')?.value||'hepsi';
      const kullanici= el.querySelector('#onayliKullanici')?.value||'hepsi';
      const siralama = el.querySelector('#onayliSiralama')?.value||'yeni';
      const bas      = el.querySelector('#onayliBaslangic')?.value||'';
      const bit      = el.querySelector('#onayliBitis')?.value||'';

      const kaynak = aktifSekme === 'arsiv' ? arsivdekiler : bekleyenler;
      const liste  = filtrele(kaynak, ara, tarih, kullanici, siralama, bas, bit);

      const listeEl = el.querySelector('#onayliListe');
      const sonucEl = el.querySelector('#onayliSonucBilgi');
      if (sonucEl) sonucEl.textContent = `${liste.length} proje listeleniyor`;
      if (!listeEl) return;

      if (liste.length === 0) {
        listeEl.innerHTML = `<div class="dtm-empty">
          <div class="dtm-empty-icon">${aktifSekme==='arsiv'?'🗃️':'📥'}</div>
          <div class="dtm-empty-title">${ara?'Arama ile eşleşen proje bulunamadı.':aktifSekme==='arsiv'?'Arşivde proje yok.':'İşlem bekleyen proje yok.'}</div>
        </div>`;
        return;
      }

      listeEl.innerHTML = `<div class="ky-proje-grid">${liste.map(p => {
        const tarihStr = p.onaylandiAt?.toDate ? p.onaylandiAt.toDate().toLocaleDateString('tr-TR') : '-';
        const adSafe   = escAttr(p.isAdi||'(İsimsiz)');
        const aksiyonlar = aktifSekme === 'arsiv' ? `
          <button class="ky-btn-open" onclick="event.stopPropagation();onayliBelgelerProjeAc('${p.id}')">&#128196; Belgeleri Gör</button>
          <button class="ky-btn" onclick="event.stopPropagation();arsivdenCikarClick('${p.id}','${adSafe}')"
            style="background:#f59e0b;color:#fff;border-color:#f59e0b;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid">
            ↩ Arşivden Çıkar
          </button>` : `
          <button class="ky-btn-open" onclick="event.stopPropagation();onayliBelgelerProjeAc('${p.id}')">&#128196; Belgeleri Gör</button>
          <button class="ky-btn" onclick="event.stopPropagation();adminGeriGonderClick('${p.id}','${adSafe}')"
            style="background:#f59e0b;color:#fff;border-color:#f59e0b;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid">
            ↩ Geri Gönder
          </button>
          <button class="ky-btn" onclick="event.stopPropagation();arsivleClick('${p.id}','${adSafe}')"
            style="background:#6b7280;color:#fff;border-color:#6b7280;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid">
            🗃️ Arşivle
          </button>`;
        return `<div class="ky-proje-item" style="cursor:pointer" onclick="onayliBelgelerProjeAc('${p.id}')">
          <div class="ky-proje-info">
            <div class="ky-proje-name"><span class="ky-proje-dot" style="background:${aktifSekme==='arsiv'?'#9ca3af':'#16a34a'}"></span>${escHtml(p.isAdi||'(İsimsiz)')}</div>
            <div class="ky-proje-meta">
              <span class="ky-proje-user">&#128100; ${escHtml(p.userDisplayName||'-')}</span>
              <span class="ky-proje-user" style="color:#0f766e">&#9989; ${escHtml(p.atananGerceklestirmeciAd||p.onaylandiBy||'-')}</span>
              <span class="ky-proje-date">&#128197; ${tarihStr}</span>
              ${getIsTuruBadge(p.isTuru)}
              ${getStatusBadge(p.status)}
            </div>
          </div>
          <div class="ky-proje-actions">${aksiyonlar}</div>
        </div>`;
      }).join('')}</div>`;
    };

    const tumKullanicilar = [...new Set([...bekleyenler,...arsivdekiler].map(p=>p.userDisplayName).filter(Boolean))].sort();

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
        <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:700;color:#b45309">${bekleyenler.length}</div>
          <div style="font-size:12px;color:#92400e;font-weight:600;margin-top:2px">İşlem Bekleyen</div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:700;color:#16a34a">${arsivdekiler.length}</div>
          <div style="font-size:12px;color:#15803d;font-weight:600;margin-top:2px">Arşivlenen</div>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:700;color:#2563eb">${bekleyenler.length+arsivdekiler.length}</div>
          <div style="font-size:12px;color:#1d4ed8;font-weight:600;margin-top:2px">Toplam Proje</div>
        </div>
      </div>

      <div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid #e5e7eb">
        <button id="sekmeBekleyen" onclick="switchSekme('bekleyenler')"
          style="padding:10px 20px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:3px solid #f59e0b;color:#b45309;margin-bottom:-2px">
          📥 İşlem Bekleyenler <span style="background:#fef3c7;color:#92400e;font-size:11px;padding:2px 7px;border-radius:10px;margin-left:4px">${bekleyenler.length}</span>
        </button>
        <button id="sekmeArsiv" onclick="switchSekme('arsiv')"
          style="padding:10px 20px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;color:#6b7280;margin-bottom:-2px">
          🗃️ Arşiv <span style="background:#f3f4f6;color:#374151;font-size:11px;padding:2px 7px;border-radius:10px;margin-left:4px">${arsivdekiler.length}</span>
        </button>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;align-items:center">
        <input type="text" id="onayliArama" placeholder="🔍 Proje adı, kullanıcı veya gerçekleştirmeci ara..."
          style="flex:1;min-width:220px;box-sizing:border-box;padding:9px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none">
        <select id="onayliTarih" style="padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;background:#fff;cursor:pointer">
          <option value="hepsi">📅 Tüm Tarihler</option>
          <option value="bu-ay">Bu Ay</option>
          <option value="bu-yil">Bu Yıl</option>
          <option value="aralik">📆 Tarih Aralığı...</option>
        </select>
        <select id="onayliKullanici" style="padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;background:#fff;cursor:pointer">
          <option value="hepsi">👤 Tüm Kullanıcılar</option>
          ${tumKullanicilar.map(u=>`<option value="${escAttr(u)}">${escHtml(u)}</option>`).join('')}
        </select>
        <select id="onayliSiralama" style="padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;background:#fff;cursor:pointer">
          <option value="yeni">↓ En Yeni</option>
          <option value="eski">↑ En Eski</option>
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
        </select>
      </div>
      <div id="onayliAralikWrap" style="display:none;flex-wrap:wrap;gap:8px;margin-bottom:10px;align-items:center">
        <span style="font-size:13px;color:#374151;font-weight:500">Başlangıç:</span>
        <input type="date" id="onayliBaslangic" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;background:#fff">
        <span style="font-size:13px;color:#374151;font-weight:500">Bitiş:</span>
        <input type="date" id="onayliBitis" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;background:#fff">
        <button onclick="el.querySelector('#onayliTarih').value='hepsi';el.querySelector('#onayliAralikWrap').style.display='none';renderListe()"
          style="padding:7px 12px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:7px;font-size:12px;cursor:pointer;color:#374151">✕ Temizle</button>
      </div>
      <div id="onayliSonucBilgi" style="font-size:12px;color:#6b7280;margin-bottom:8px"></div>
      <div id="onayliListe"></div>
    `;

    window.switchSekme = (sekme) => {
      aktifSekme = sekme;
      el.querySelector('#sekmeBekleyen').style.cssText = `padding:10px 20px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;margin-bottom:-2px;${sekme==='bekleyenler'?'border-bottom:3px solid #f59e0b;color:#b45309;':'color:#6b7280;border-bottom:none'}`;
      el.querySelector('#sekmeArsiv').style.cssText = `padding:10px 20px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;margin-bottom:-2px;${sekme==='arsiv'?'border-bottom:3px solid #6b7280;color:#374151;':'color:#6b7280;border-bottom:none'}`;
      renderListe();
    };

    el.querySelector('#onayliTarih').addEventListener('change', () => {
      el.querySelector('#onayliAralikWrap').style.display = el.querySelector('#onayliTarih').value==='aralik'?'flex':'none';
      renderListe();
    });
    ['#onayliArama','#onayliKullanici','#onayliSiralama','#onayliBaslangic','#onayliBitis'].forEach(sel => {
      const elem = el.querySelector(sel);
      if (elem) elem.addEventListener('input', renderListe);
    });

    renderListe();

  } catch(e) {
    const el = document.getElementById('onayliBelgelerContent');
    if (el) el.innerHTML = `<div style="color:red;padding:20px">Projeler yüklenemedi: ${e.message}</div>`;
  }
}

async function onayliBelgelerProjeAc(projeId) {
  try {
    const doc = await getProjeFromCloud(projeId);
    proje = Object.assign(getDefaultProje(), doc.data);
    currentCloudProjeId = projeId;
    currentProjeStatus = doc.status || 'onaylandi';
    currentProjeKazananBasitUsul = doc.kazananBasitUsul === true;
    currentOnayliBelgelerProjeId = projeId;
    renderPage();
  } catch(e) {
    showToast('Proje yüklenemedi: ' + e.message, 'error');
  }
}

// ===================== PROFİL SAYFASI =====================
function renderProfilPage() {
  const u = currentDTMUser || {};
  const lastLogin = auth.currentUser?.metadata?.lastSignInTime
    ? new Date(auth.currentUser.metadata.lastSignInTime).toLocaleString('tr-TR')
    : '-';
  const createdAt = auth.currentUser?.metadata?.creationTime
    ? new Date(auth.currentUser.metadata.creationTime).toLocaleString('tr-TR')
    : '-';

  return `
    <div style="max-width:860px;margin:0 auto">
      <div class="vm-page-header">
        <div class="vm-header-title">
          <div class="vm-header-icon">
            ${typeof getIcon === 'function' ? getIcon('userCheck', 22) : '👤'}
          </div>
          <div>
            <h2>Profilim & Hesap Ayarları</h2>
            <p>Kişisel hesap bilgilerinizi, profil avatarınızı ve güvenlik ayarlarınızı yönetin.</p>
          </div>
        </div>
      </div>

      <!-- Kurumsal Profil Başlık Banner -->
      <div style="background:linear-gradient(135deg,#1e3a5f 0%,#1e40af 50%,#2563eb 100%);border-radius:16px;padding:28px 32px;color:#fff;margin-bottom:24px;position:relative;overflow:hidden;box-shadow:0 10px 25px -5px rgba(30,58,95,0.25);">
        <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:rgba(255,255,255,0.06);border-radius:50%"></div>
        <div style="position:absolute;bottom:-30px;right:80px;width:100px;height:100px;background:rgba(255,255,255,0.04);border-radius:50%"></div>
        <div style="display:flex;align-items:center;gap:24px;position:relative;z-index:1;">
          
          <!-- Avatar - hover ile düzenle -->
          <div onclick="openAvatarPicker()" title="Profil resmini değiştir"
               onmouseover="document.getElementById('avatarEditOverlay').style.opacity='1'"
               onmouseout="document.getElementById('avatarEditOverlay').style.opacity='0'"
               style="position:relative;width:80px;height:80px;cursor:pointer;flex-shrink:0;border-radius:50%;box-shadow:0 4px 14px rgba(0,0,0,0.25);">
            <div id="profilAvatarCircle" style="width:80px;height:80px;background:rgba(255,255,255,0.18);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;overflow:hidden;border:3px solid rgba(255,255,255,0.85);backdrop-filter:blur(4px);">
              ${u.avatar
                ? `<img src="icons/avatars/${u.avatar}.png" style="width:100%;height:100%;object-fit:cover" />`
                : (typeof getIcon === 'function' ? getIcon('user', 40) : '👤')}
            </div>
            <div id="avatarEditOverlay" style="position:absolute;inset:0;background:rgba(15,23,42,0.65);border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:0;transition:all 0.2s ease;pointer-events:none;color:#fff;">
              ${typeof getIcon === 'function' ? getIcon('camera', 22) : '📷'}
            </div>
            <div style="position:absolute;bottom:0;right:0;background:var(--primary,#1a56db);color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,0.2);">
              ${typeof getIcon === 'function' ? getIcon('edit', 12) : '✎'}
            </div>
          </div>
          
          <div>
            <div style="font-size:22px;font-weight:700;letter-spacing:-0.3px;display:flex;align-items:center;gap:10px;">
              <span>${escHtml(u.displayName || '-')}</span>
            </div>
            <div style="font-size:14px;opacity:0.85;margin-top:4px;display:flex;align-items:center;gap:6px;">
              <span>@${escHtml(u.username || '-')}</span>
            </div>
            <div style="margin-top:10px;display:flex;align-items:center;gap:8px;">
              <span style="background:rgba(255,255,255,0.2);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.3);font-size:12px;font-weight:600;padding:4px 14px;border-radius:20px;display:inline-flex;align-items:center;gap:6px;">
                ${typeof getIcon === 'function' ? getIcon('shieldCheck', 14) : ''}
                ${getRoleLabel(u.role)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Avatar Seçici Modal -->
      <div id="avatarPickerModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;align-items:center;justify-content:center;backdrop-filter:blur(3px);">
        <div style="background:#fff;border-radius:16px;padding:24px;max-width:400px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.25);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;border-bottom:1px solid var(--gray-100);padding-bottom:12px;">
            <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:var(--gray-900);font-size:16px;">
              <span style="color:var(--primary);display:inline-flex;">${typeof getIcon === 'function' ? getIcon('camera', 18) : '📷'}</span>
              <span>Profil Resmi Seç</span>
            </div>
            <button onclick="closeAvatarPicker()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--gray-400);line-height:1;padding:4px 8px;border-radius:6px;">&times;</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;">
            ${AVATARS.map(a => `
              <div onclick="avatarSec('${a}')" style="cursor:pointer;border-radius:50%;overflow:hidden;width:48px;height:48px;border:3px solid ${u.avatar===a ? 'var(--primary, #1a56db)' : 'transparent'};transition:all .2s;box-shadow:${u.avatar===a ? '0 0 0 2px rgba(26,86,219,0.3)' : 'none'};margin:auto;" id="avatarOpt_${a}">
                <img src="icons/avatars/${a}.png" style="width:100%;height:100%;object-fit:cover;" />
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- 2 Kolonlu Kurumsal Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:20px;">
        
        <!-- Sol Kolon: Hesap Bilgileri -->
        <div class="card" style="margin:0;box-shadow:0 2px 10px rgba(0,0,0,0.04);border:1px solid var(--gray-200);">
          <div class="card-header" style="display:flex;align-items:center;gap:8px;padding:16px 20px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);">
            <span style="color:var(--primary);display:inline-flex;">${typeof getIcon === 'function' ? getIcon('userCheck', 18) : ''}</span>
            <h3 style="font-size:15px;margin:0;font-weight:700;color:var(--gray-900);">Hesap Bilgileri</h3>
          </div>
          <div class="card-body" style="padding:18px 20px;">
            <div style="display:flex;flex-direction:column;gap:14px;">
              
              <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--gray-100);">
                <div style="display:flex;align-items:center;gap:8px;color:var(--gray-500);font-size:13.5px;">
                  <span style="display:inline-flex;color:var(--gray-400);">${typeof getIcon === 'function' ? getIcon('user', 16) : ''}</span>
                  <span>Ad Soyad</span>
                </div>
                <span style="font-weight:600;color:var(--gray-900);font-size:14px;">${escHtml(u.displayName || '-')}</span>
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--gray-100);">
                <div style="display:flex;align-items:center;gap:8px;color:var(--gray-500);font-size:13.5px;">
                  <span style="display:inline-flex;color:var(--gray-400);">${typeof getIcon === 'function' ? getIcon('atSign', 16) : ''}</span>
                  <span>Kullanıcı Adı</span>
                </div>
                <span style="font-family:monospace;font-weight:600;color:var(--gray-700);background:var(--gray-100);padding:2px 8px;border-radius:6px;font-size:13px;">${escHtml(u.username || '-')}</span>
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--gray-100);">
                <div style="display:flex;align-items:center;gap:8px;color:var(--gray-500);font-size:13.5px;">
                  <span style="display:inline-flex;color:var(--gray-400);">${typeof getIcon === 'function' ? getIcon('shieldCheck', 16) : ''}</span>
                  <span>Yetki Rolü</span>
                </div>
                <span class="ref-tag-pill" style="font-size:12px;">${getRoleLabel(u.role)}</span>
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--gray-100);">
                <div style="display:flex;align-items:center;gap:8px;color:var(--gray-500);font-size:13.5px;">
                  <span style="display:inline-flex;color:var(--gray-400);">${typeof getIcon === 'function' ? getIcon('clock', 16) : ''}</span>
                  <span>Son Giriş</span>
                </div>
                <span style="font-size:13px;color:var(--gray-700);font-weight:500;">${lastLogin}</span>
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:8px;color:var(--gray-500);font-size:13.5px;">
                  <span style="display:inline-flex;color:var(--gray-400);">${typeof getIcon === 'function' ? getIcon('calendar', 16) : ''}</span>
                  <span>Hesap Oluşturma</span>
                </div>
                <span style="font-size:13px;color:var(--gray-700);font-weight:500;">${createdAt}</span>
              </div>

            </div>
          </div>
        </div>

        <!-- Sağ Kolon: Şifre Değiştir -->
        <div class="card" style="margin:0;box-shadow:0 2px 10px rgba(0,0,0,0.04);border:1px solid var(--gray-200);">
          <div class="card-header" style="display:flex;align-items:center;gap:8px;padding:16px 20px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);">
            <span style="color:var(--primary);display:inline-flex;">${typeof getIcon === 'function' ? getIcon('key', 18) : ''}</span>
            <h3 style="font-size:15px;margin:0;font-weight:700;color:var(--gray-900);">Şifre Değiştir</h3>
          </div>
          <div class="card-body" style="padding:20px;">
            <div class="form-group" style="margin-bottom:14px;">
              <label style="font-size:13px;font-weight:600;color:var(--gray-700);margin-bottom:6px;display:block;">Mevcut Şifre</label>
              <input type="password" id="mevcutSifre" placeholder="Mevcut şifrenizi girin" style="width:100%;padding:10px 14px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div class="form-group" style="margin-bottom:14px;">
              <label style="font-size:13px;font-weight:600;color:var(--gray-700);margin-bottom:6px;display:block;">Yeni Şifre</label>
              <input type="password" id="yeniSifre" placeholder="En az 6 karakter" style="width:100%;padding:10px 14px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div class="form-group" style="margin-bottom:16px;">
              <label style="font-size:13px;font-weight:600;color:var(--gray-700);margin-bottom:6px;display:block;">Yeni Şifre (Tekrar)</label>
              <input type="password" id="yeniSifreTekrar" placeholder="Yeni şifrenizi tekrar girin" style="width:100%;padding:10px 14px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div id="sifreMsg" style="font-size:13px;margin-bottom:12px;min-height:18px;"></div>
            <button class="btn btn-primary" onclick="sifreDegistir()" style="width:100%;padding:11px 16px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:600;border-radius:8px;">
              <span style="display:inline-flex;">${typeof getIcon === 'function' ? getIcon('shieldCheck', 16) : ''}</span>
              <span>Şifreyi Güncelle</span>
            </button>
          </div>
        </div>

      </div>

      <!-- Alt Kart: E-Posta & Güvenlik Doğrulaması -->
      <div class="card" style="margin-top:20px;box-shadow:0 2px 10px rgba(0,0,0,0.04);border:1px solid var(--gray-200);">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="color:var(--primary);display:inline-flex;">${typeof getIcon === 'function' ? getIcon('mail', 18) : ''}</span>
            <h3 style="font-size:15px;margin:0;font-weight:700;color:var(--gray-900);">E-Posta & Güvenlik Doğrulaması</h3>
          </div>
          <button onclick="epostaDurumYenile(this)" title="Doğrulama durumunu sunucudan yenile" class="btn btn-sm btn-secondary" style="padding:5px 10px;font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;">
            <span>🔄 Durumu Yenile</span>
          </button>
        </div>
        <div class="card-body" style="padding:20px;">
          <div style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <label style="font-size:13px;font-weight:600;color:var(--gray-700);margin:0;">Kayıtlı E-Posta Adresiniz</label>
              <div id="epostaDurumBadge">
                ${u.email && u.emailVerified ? `
                  <span style="background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;font-size:12px;font-weight:700;padding:3px 12px;border-radius:14px;display:inline-flex;align-items:center;gap:4px;">
                    ${typeof getIcon === 'function' ? getIcon('checkCircle', 13) : '✓'} Doğrulandı
                  </span>
                ` : (u.pendingEmail ? `
                  <span style="background:#fffbeb;color:#92400e;border:1px solid #fde68a;font-size:12px;font-weight:600;padding:3px 12px;border-radius:14px;display:inline-flex;align-items:center;gap:4px;">
                    ⏳ Onay Bekliyor
                  </span>
                ` : `
                  <span style="background:var(--gray-100);color:var(--gray-600);border:1px solid var(--gray-200);font-size:12px;font-weight:600;padding:3px 12px;border-radius:14px;">
                    ⚪ E-Posta Tanımsız
                  </span>
                `)}
              </div>
            </div>
            <input type="email" id="profilEmailInput" value="${escAttr(u.email || u.pendingEmail || '')}" placeholder="örn: ad.soyad@karaman.gov.tr" style="width:100%;padding:11px 14px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:14px;box-sizing:border-box;">
            <p style="font-size:12.5px;color:var(--gray-500);margin:8px 0 0;line-height:1.5;">
              ℹ️ Şifrenizi unuttuğunuzda yeni şifre belirleme bağlantısı bu adrese iletilir. E-posta adresinizi girip butona bastığınızda posta kutunuza resmi bir doğrulama bağlantısı gönderilir.
            </p>
          </div>
          <div id="epostaMsg" style="font-size:13px;margin-bottom:14px;min-height:16px;"></div>
          <button class="btn btn-secondary" onclick="epostaDogrulamaIstegiGonder(this)" style="padding:11px 20px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;border-radius:8px;cursor:pointer;">
            <span style="display:inline-flex;">${typeof getIcon === 'function' ? getIcon('send', 15) : ''}</span>
            <span>Doğrulama Bağlantısı Gönder / E-Postayı Güncelle</span>
          </button>
        </div>
      </div>

    </div>
  `;
}

function bindProfil() {
  // Profil açılınca arka planda doğrulama durumunu senkronize et
  epostaDurumunuGuncelle().catch(() => {});
}

window.epostaDogrulamaIstegiGonder = async function(btn) {
  const input = document.getElementById('profilEmailInput');
  const msg = document.getElementById('epostaMsg');
  const val = (input?.value || '').trim();

  if (!val) {
    if (msg) {
      msg.style.color = '#dc2626';
      msg.textContent = 'Lütfen geçerli bir e-posta adresi giriniz.';
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Doğrulama Gönderiliyor...</span>';
  }
  if (msg) {
    msg.style.color = 'var(--gray-500)';
    msg.textContent = 'İşleniyor, lütfen bekleyiniz...';
  }

  try {
    await epostaDogrulamaGonder(val);
    if (msg) {
      msg.style.color = '#16a34a';
      msg.innerHTML = `✅ <strong>Doğrulama bağlantısı ${escHtml(val)} adresine iletildi!</strong><br><span style="font-size:12px;color:var(--gray-600)">Lütfen gelen kutunuzdaki onay linkine tıklayınız. Ardından yukarıdaki "🔄 Durumu Yenile" butonuna basarak onaylayabilirsiniz.</span>`;
    }
    showToast('Doğrulama e-postası başarıyla gönderildi.', 'success');
    const badge = document.getElementById('epostaDurumBadge');
    if (badge) {
      badge.innerHTML = `<span style="background:#fffbeb;color:#92400e;border:1px solid #fde68a;font-size:12px;font-weight:600;padding:3px 12px;border-radius:14px;">⏳ Onay Bekliyor</span>`;
    }
  } catch(e) {
    if (msg) {
      msg.style.color = '#dc2626';
      msg.textContent = 'Hata: ' + (e.message || 'E-posta doğrulama gönderilemedi.');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>${typeof getIcon === 'function' ? getIcon('send', 15) : ''} Doğrulama Bağlantısı Gönder / E-Postayı Güncelle</span>`;
    }
  }
};

window.epostaDurumYenile = async function(btn) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Denetleniyor...</span>';
  }
  try {
    const res = await epostaDurumunuGuncelle();
    if (res?.emailVerified) {
      showToast('Tebrikler! E-posta adresiniz başarıyla doğrulandı.', 'success');
      const badge = document.getElementById('epostaDurumBadge');
      if (badge) {
        badge.innerHTML = `<span style="background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;font-size:12px;font-weight:700;padding:3px 12px;border-radius:14px;display:inline-flex;align-items:center;gap:4px;">${typeof getIcon === 'function' ? getIcon('checkCircle', 13) : '✓'} Doğrulandı</span>`;
      }
      const msg = document.getElementById('epostaMsg');
      if (msg) {
        msg.style.color = '#16a34a';
        msg.textContent = '✓ E-posta adresiniz doğrulandı ve hesabınızla tam olarak eşleştirildi.';
      }
    } else if (res?.pendingEmail) {
      showToast('E-posta henüz onaylanmamış. Lütfen gelen kutunuzdaki bağlantıya tıklayınız.', 'warning');
    } else {
      showToast('Tanımlı doğrulanmış bir e-posta bulunamadı.', 'info');
    }
  } catch(e) {
    showToast('Durum kontrol hatası: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🔄 Durumu Yenile</span>';
    }
  }
};

function openAvatarPicker() {
  const modal = document.getElementById('avatarPickerModal');
  if (modal) { modal.style.display = 'flex'; }
}

function closeAvatarPicker() {
  const modal = document.getElementById('avatarPickerModal');
  if (modal) { modal.style.display = 'none'; }
}

async function avatarSec(avatarName) {
  if (!AVATARS.includes(avatarName)) return;
  try {
    await setAvatar(avatarName);
    const circle = document.getElementById('profilAvatarCircle');
    if (circle) circle.innerHTML = `<img src="icons/avatars/${avatarName}.png" style="width:100%;height:100%;object-fit:cover" />`;
    AVATARS.forEach(a => {
      const el = document.getElementById('avatarOpt_' + a);
      if (el) el.style.borderColor = a === avatarName ? 'var(--primary, #1a56db)' : 'transparent';
    });
    closeAvatarPicker();
    updateSidebarAvatar();
    showToast('Profil resmi güncellendi.', 'success');
  } catch (e) {
    showToast('Güncelleme başarısız: ' + e.message, 'error');
  }
}

async function sifreDegistir() {
  const mevcutEl = document.getElementById('mevcutSifre');
  const yeniEl = document.getElementById('yeniSifre');
  const tekrarEl = document.getElementById('yeniSifreTekrar');
  const mevcut = mevcutEl.value;
  const yeni = yeniEl.value;
  const tekrar = tekrarEl.value;
  const msg = document.getElementById('sifreMsg');

  if (!mevcut || !yeni || !tekrar) {
    markError(...[!mevcut && mevcutEl, !yeni && yeniEl, !tekrar && tekrarEl].filter(Boolean));
    msg.style.color = 'red'; msg.textContent = 'Tüm alanları doldurun.'; return;
  }
  if (yeni.length < 6) { markError(yeniEl); msg.style.color = 'red'; msg.textContent = 'Yeni şifre en az 6 karakter olmalı.'; return; }
  if (yeni !== tekrar) { markError(tekrarEl); msg.style.color = 'red'; msg.textContent = 'Yeni şifreler eşleşmiyor.'; return; }

  msg.style.color = 'var(--gray-500)'; msg.textContent = 'Güncelleniyor...';
  try {
    await changePassword(mevcut, yeni);
    msg.style.color = 'green'; msg.textContent = '✓ Şifreniz başarıyla güncellendi!';
    document.getElementById('mevcutSifre').value = '';
    document.getElementById('yeniSifre').value = '';
    document.getElementById('yeniSifreTekrar').value = '';
  } catch(e) {
    msg.style.color = 'red';
    if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      msg.textContent = 'Mevcut şifre hatalı.';
    } else {
      msg.textContent = 'Hata: ' + e.message;
    }
  }
}

// ===================== DUYURULAR =====================
async function checkGeriGonderiend() {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const [snap, userData] = await Promise.all([
      db.collection('projeler').where('userId', '==', user.uid).where('status', '==', 'geri_gonderildi').get(),
      db.collection('users').doc(currentDTMUser.uid).get()
    ]);
    const gorulenler = userData.data()?.gorulenGeriGonderilenler || [];
    const yeniSayi = snap.docs.filter(d => !gorulenler.includes(d.id)).length;
    const badge = document.getElementById('geriGonderBadge');
    if (badge) {
      badge.textContent = yeniSayi;
      badge.style.display = yeniSayi > 0 ? 'inline-flex' : 'none';
    }
  } catch(e) {}
}

async function checkGonderilenProjeler() {
  try {
    const uid = currentDTMUser?.uid;
    if (!uid) return;
    const [snap, userSnap] = await Promise.all([
      db.collection('projeler').where('atananGerceklestirmeciUid', '==', uid).get(),
      db.collection('users').doc(uid).get()
    ]);
    const lastVisit = userSnap.data()?.lastGonderilenVisit?.toMillis?.() || 0;
    const yeniSayi = snap.docs.filter(d => {
      const data = d.data();
      if (data.status !== 'gonderildi') return false;
      const gonderildiAt = data.gonderildiAt?.toMillis?.() || 0;
      return gonderildiAt > lastVisit;
    }).length;
    const badge = document.getElementById('gonderilenBadge');
    if (badge) {
      badge.textContent = yeniSayi;
      badge.style.display = yeniSayi > 0 ? 'inline-flex' : 'none';
    }
  } catch(e) {}
}

async function checkOnayliProjeler() {
  try {
    const uid = currentDTMUser?.uid;
    if (!uid) return;
    const [snap, userSnap] = await Promise.all([
      db.collection('projeler').where('status', '==', 'onaylandi').get(),
      db.collection('users').doc(uid).get()
    ]);
    const lastVisit = userSnap.data()?.lastOnayliVisit?.toMillis?.() || 0;
    const yeniSayi = snap.docs.filter(d => {
      const onaylandiAt = d.data().onaylandiAt?.toMillis?.() || 0;
      return onaylandiAt > lastVisit;
    }).length;
    const badge = document.getElementById('onayliBadge');
    if (badge) {
      badge.textContent = yeniSayi;
      badge.style.display = yeniSayi > 0 ? 'inline-flex' : 'none';
    }
  } catch(e) {}
}

async function checkDuyurular() {
  try {
    const [duyurular, okunanlar] = await Promise.all([getDuyurular(), getOkunanDuyurular()]);
    const okunmamilar = duyurular.filter(d => !okunanlar.includes(d.id));
    okunmamiDuyuruSayisi = okunmamilar.length;
    updateDuyuruBadge();
    if (okunmamilar.length > 0) showDuyuruPopup(okunmamilar.length);
  } catch(e) {}
}

function updateDuyuruBadge() {
  const badge = document.getElementById('duyuruBadge');
  if (!badge) return;
  badge.textContent = okunmamiDuyuruSayisi;
  badge.style.display = okunmamiDuyuruSayisi > 0 ? 'inline-flex' : 'none';
}

function showDuyuruPopup(sayi) {
  const popup = document.getElementById('duyuruPopup');
  if (!popup) return;
  document.getElementById('duyuruPopupCount').textContent = sayi === 1 ? '1 yeni duyurunuz var.' : `${sayi} yeni duyurunuz var.`;
  popup.style.display = 'flex';
}

function closeDuyuruPopup() {
  document.getElementById('duyuruPopup').style.display = 'none';
}

function duyurularSayfasinaGit() {
  closeDuyuruPopup();
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('[data-page="duyurular"]')?.classList.add('active');
  currentPage = 'duyurular';
  renderPage();
}

async function renderDuyurularPage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="page-header"><h2>Duyurular</h2><p>Yönetici tarafından paylaşılan duyurular.</p></div>
    <div style="text-align:center;padding:40px;color:var(--gray-400)">Yükleniyor...</div>`;
  try {
    const [duyurular, okunanlar] = await Promise.all([getDuyurular(), getOkunanDuyurular()]);
    const canManage = ['admin', 'superadmin'].includes(currentDTMUser?.role);
    const adminForm = canManage ? `
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><h3>Yeni Duyuru Yayınla</h3></div>
        <div class="card-body">
          <div class="form-group"><label>Başlık</label><input type="text" id="duyuruBaslik" placeholder="Duyuru başlığı"></div>
          <div class="form-group"><label>Mesaj</label><textarea id="duyuruMesaj" rows="4" placeholder="Duyuru içeriği..." style="width:100%;padding:8px;border:1px solid var(--gray-200);border-radius:6px;font-size:14px;resize:vertical"></textarea></div>
          <div id="duyuruMsg" style="margin:8px 0;font-size:13px"></div>
          <button class="btn btn-primary" onclick="duyuruOlustur(this)">Yayınla</button>
        </div>
      </div>` : '';
    const listHTML = duyurular.length === 0
      ? `<div style="text-align:center;padding:40px;color:var(--gray-400)">Henüz duyuru yok.</div>`
      : duyurular.map(d => {
          const okundu = okunanlar.includes(d.id);
          const tarih = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString('tr-TR') : '-';
          return `
            <div class="duyuru-item ${okundu ? 'duyuru-okundu' : 'duyuru-okunmadi'}">
              <div class="duyuru-ust">
                <div class="duyuru-baslik">
                  ${!okundu ? '<span class="duyuru-yeni">Yeni</span>' : ''}
                  ${escHtml(d.baslik)}
                </div>
                <div class="duyuru-meta">${escHtml(d.createdBy || '')} &middot; ${tarih}</div>
              </div>
              <div class="duyuru-mesaj">${escHtml(d.mesaj)}</div>
              <div class="duyuru-actions">
                ${!okundu ? `<button class="btn btn-sm btn-outline" onclick="duyuruOku('${d.id}')">Okundu</button>` : '<span style="color:var(--gray-400);font-size:12px">Okundu</span>'}
                ${['admin', 'superadmin'].includes(currentDTMUser?.role) ? `<button class="btn btn-sm btn-danger" onclick="duyuruSil('${d.id}')">Sil</button>` : ''}
              </div>
            </div>`;
        }).join('');
    main.innerHTML = `
      <div class="page-header"><h2>Duyurular</h2><p>Yönetici tarafından paylaşılan duyurular.</p></div>
      ${adminForm}
      <div class="card"><div class="card-header"><h3>Tüm Duyurular</h3></div><div class="card-body" style="padding:0">${listHTML}</div></div>`;
  } catch(e) {
    main.innerHTML = `<div class="page-header"><h2>Duyurular</h2></div><div style="color:red;padding:20px">Yüklenemedi: ${e.message}</div>`;
  }
}

async function duyuruOlustur(btn) {
  const baslikEl = document.getElementById('duyuruBaslik');
  const mesajEl = document.getElementById('duyuruMesaj');
  const baslik = baslikEl.value.trim();
  const mesaj = mesajEl.value.trim();
  const msg = document.getElementById('duyuruMsg');
  if (!baslik || !mesaj) {
    markError(...[!baslik && baslikEl, !mesaj && mesajEl].filter(Boolean));
    msg.style.color = 'red'; msg.textContent = 'Başlık ve mesaj zorunlu.'; return;
  }
  await butonKilitli(btn, 'Yayınlanıyor...', async () => {
    try {
      await createDuyuru(baslik, mesaj);
      msg.style.color = 'green'; msg.textContent = 'Duyuru yayınlandı!';
      document.getElementById('duyuruBaslik').value = '';
      document.getElementById('duyuruMesaj').value = '';
      renderDuyurularPage();
    } catch(e) { msg.style.color = 'red'; msg.textContent = 'Hata: ' + hataMesaji(e); }
  });
}

async function duyuruOku(duyuruId) {
  try {
    await duyuruOkunduIsaretle(duyuruId);
    okunmamiDuyuruSayisi = Math.max(0, okunmamiDuyuruSayisi - 1);
    updateDuyuruBadge();
    renderDuyurularPage();
  } catch(e) { showToast('Hata: ' + hataMesaji(e), 'error'); }
}

async function duyuruSil(duyuruId) {
  if (!await showConfirm('Bu duyuru silinecek. Emin misiniz?', 'Sil')) return;
  try {
    await deleteDuyuru(duyuruId);
    renderDuyurularPage();
  } catch(e) { showToast('Hata: ' + hataMesaji(e), 'error'); }
}

// ===================== HAKKINDA SAYFASI =====================
const APP_CURRENT_VERSION = '2.1.0';

async function checkForUpdates(showLoading = false) {
  try {
    const doc = await db.collection('appConfig').doc('version').get();
    const latestVersion = doc.exists ? (doc.data().latest || APP_CURRENT_VERSION) : APP_CURRENT_VERSION;
    const hasUpdate = latestVersion !== APP_CURRENT_VERSION;

    // Badge güncelle
    const badge = document.getElementById('guncellemeBadge');
    if (badge) {
      badge.style.display = hasUpdate ? 'inline-flex' : 'none';
    }

    return { latestVersion, hasUpdate };
  } catch(e) {
    return { latestVersion: APP_CURRENT_VERSION, hasUpdate: false };
  }
}

async function renderHakkindaPage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="vm-page-header">
      <div class="vm-header-title">
        <div class="vm-header-icon">
          ${typeof getIcon === 'function' ? getIcon('clipboardCheck', 22) : 'ℹ️'}
        </div>
        <div>
          <h2>Hakkında & Sürüm Bilgileri</h2>
          <p>Uygulama bilgileri, sistem durumu ve güncelleme denetimi.</p>
        </div>
      </div>
    </div>
    <div style="max-width:640px;margin:0 auto;">

      <!-- Uygulama Kartı -->
      <div style="background:linear-gradient(135deg,#1e3a5f,#1a56db);border-radius:16px;padding:32px;color:#fff;margin-bottom:20px;text-align:center;position:relative;overflow:hidden;box-shadow:0 8px 24px rgba(26,86,219,0.2);">
        <div style="position:absolute;top:-30px;right:-30px;width:130px;height:130px;background:rgba(255,255,255,0.06);border-radius:50%"></div>
        <div style="display:flex;justify-content:center;margin-bottom:12px;">
          ${typeof getIcon === 'function' ? getIcon('fileText', 48) : '📄'}
        </div>
        <div style="font-size:24px;font-weight:700;margin-bottom:4px;">Doğrudan Temin Modülü</div>
        <div style="font-size:13px;opacity:0.8;margin-bottom:16px;">Karaman İl Özel İdaresi &middot; Yatırım ve İnşaat Müdürlüğü</div>
        <div style="display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);border-radius:20px;padding:6px 22px;font-size:15px;font-weight:700;letter-spacing:1px;">
          v${APP_CURRENT_VERSION}
        </div>
      </div>

      <!-- Güncelleme Kontrol Kartı -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><h3 style="font-size:15px;">🔄 Güncelleme Kontrolü</h3></div>
        <div class="card-body">
          <div id="guncellemeDurum" style="margin-bottom:16px;padding:12px 16px;border-radius:8px;background:var(--gray-50);border:1px solid var(--gray-200);font-size:14px;color:var(--gray-600);">
            Güncelleme durumu kontrol ediliyor...
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="guncellemeyiKontrolEt()">🔍 Güncellemeleri Denetle</button>
            <button id="guncellemeyiUygulaBttn" class="btn btn-success" onclick="uygulamaGuncelle()" style="display:none;">🔄 Güncellemeyi Uygula</button>
          </div>
        </div>
      </div>

      <!-- v2.1.0 Yenilikler -->
      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--primary);">
        <div class="card-header"><h3 style="font-size:15px;color:var(--primary);">🚀 v2.1.0 Sürüm Notları (En Son)</h3></div>
        <div class="card-body">
          <ul style="margin:0;padding-left:20px;font-size:13.5px;line-height:2;color:var(--gray-800);">
            <li>✨ <strong>Modern Kurumsal SVG İkon Mimarisi:</strong> Tüm sistem Lucide/Heroicons vektörel SVG ikon setine geçirildi.</li>
            <li>👥 <strong>Veri Merkezi & Personel Rehberi:</strong> Açılır liste (dropdown) + profil kartı mimarisi, klavye seviyesinde rakam engeli ve açılır listeden disiplin seçimi.</li>
            <li>🔤 <strong>Akıllı Türkçe Alfabetik Sıralama:</strong> Tüm personel ve firma listeleri Türkçe karakter duyarlı otomatik sıralandı.</li>
            <li>📊 <strong>Finansal Dashboard & Kategori Dağılımı:</strong> Gerçekleşen harcama (onaylı), süreçteki yük (bekleyen) ve Yapım/Mal/Hizmet/Danışmanlık hacim barları.</li>
            <li>🧹 <strong>Otomatik Boşluk & Hayalet Satır Temizliği:</strong> Boşluk kirliliği ve isimsiz kayıtlar tamamen engellendi.</li>
          </ul>
        </div>
      </div>

      <!-- Teknik Bilgiler -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><h3 style="font-size:15px;">🛠️ Teknik Bilgiler</h3></div>
        <div class="card-body" style="padding:0;">
          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            <tbody>
              <tr style="border-bottom:1px solid var(--gray-100);">
                <td style="padding:10px 16px;color:var(--gray-500);width:50%">Mevcut Sürüm</td>
                <td style="padding:10px 16px;font-weight:600;color:var(--primary);">v${APP_CURRENT_VERSION}</td>
              </tr>
              <tr style="border-bottom:1px solid var(--gray-100);">
                <td style="padding:10px 16px;color:var(--gray-500)">Platform</td>
                <td style="padding:10px 16px;font-weight:600;">Web (Firebase)</td>
              </tr>
              <tr style="border-bottom:1px solid var(--gray-100);">
                <td style="padding:10px 16px;color:var(--gray-500)">Tarayıcı</td>
                <td style="padding:10px 16px;font-weight:600;font-size:12px;">${navigator.userAgent.split(') ').pop().split(' ')[0] || navigator.userAgent}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:var(--gray-500)">Son Giriş</td>
                <td style="padding:10px 16px;font-weight:600;">${new Date().toLocaleDateString('tr-TR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- v2.0.0 Değişiklikler -->
      <div class="card">
        <div class="card-header"><h3 style="font-size:15px;">📝 v2.0.0 Sürüm Notları</h3></div>
        <div class="card-body">
          <ul style="margin:0;padding-left:20px;font-size:13.5px;line-height:2;color:var(--gray-600);">
            <li>✅ <strong>Teknik Şartname Modülü:</strong> Özel şablon, modal ile madde düzenleme ve otomatik Y.M. görevlileri imza bloğu</li>
            <li>✅ <strong>Muayene ve Kabul Komisyonu Tutanağı:</strong> Mal/Hizmet alımları için dinamik komisyon heyeti, atama oluru ve resmi kabul şablonu</li>
            <li>✅ <strong>Akıllı İş Türü Ayrımı:</strong> Mal/Hizmet alımı ve Yapım İşi için otomatik değişen form alanları ve belge sekmeleri</li>
            <li>✅ <strong>Sözleşme Maddelerini Düzenleme:</strong> Madde 11, 12, 13, 14, 15 ve 20 için dinamik özelleştirme modalı</li>
            <li>✅ <strong>Yazdırma & Ölçekleme Optimizasyonu:</strong> Çıktıların tek sayfaya tam sığması için %95 zoom ve kenar boşluğu ince ayarı</li>
            <li>✅ <strong>Word (.doc) ve PDF İndirme:</strong> Tüm yeni belgelerde tam uyumlu dışa aktarım desteği</li>
          </ul>
        </div>
      </div>
    </div>`;

  // Sayfa açılınca otomatik kontrol et
  guncellemeyiKontrolEt();
}

window.guncellemeyiKontrolEt = async function() {
  const durumEl = document.getElementById('guncellemeDurum');
  const btnUygula = document.getElementById('guncellemeyiUygulaBttn');
  if (durumEl) {
    durumEl.style.background = 'var(--gray-50)';
    durumEl.style.borderColor = 'var(--gray-200)';
    durumEl.style.color = 'var(--gray-500)';
    durumEl.textContent = '⏳ Önbellek temizleniyor ve sunucu denetleniyor...';
  }

  try {
    // Service Worker update'ini tetikle
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update();
      }
    }
  } catch(e) {
    console.warn('SW güncelleme hatası:', e);
  }

  const { latestVersion, hasUpdate } = await checkForUpdates(true);
  if (durumEl) {
    if (hasUpdate) {
      durumEl.style.background = '#fef3c7';
      durumEl.style.borderColor = '#f59e0b';
      durumEl.style.color = '#92400e';
      durumEl.innerHTML = `&#9888;&#65039; <strong>Yeni sürüm mevcut: v${latestVersion}</strong><br><span style="font-size:12px">Mevcut sürümünüz: v${APP_CURRENT_VERSION}. Güncellemeyi uygulamak için butona tıklayın.</span>`;
      if (btnUygula) btnUygula.style.display = 'inline-flex';
    } else {
      durumEl.style.background = '#f0fdf4';
      durumEl.style.borderColor = '#86efac';
      durumEl.style.color = '#166534';
      durumEl.innerHTML = `&#9989; <strong>Uygulamanız güncel: v${APP_CURRENT_VERSION}</strong><br><span style="font-size:12px;color:var(--gray-500)">Yine de önbelleği sıfırlayıp baştan yüklemek isterseniz aşağıdaki butonu kullanabilirsiniz.</span>`;
      if (btnUygula) {
        btnUygula.style.display = 'inline-flex';
        btnUygula.innerHTML = '🔄 Önbelleği Temizle & Yeniden Yükle';
      }
    }
  }
};

window.uygulamaGuncelle = async function() {
  showToast('Önbellek temizleniyor, uygulama güncelleniyor...', 'info');
  
  try {
    // 1. Tüm Cache Storage'ı sil
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
    // 2. Service worker unregister
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
  } catch(e) {
    console.warn('Cache temizleme hatası:', e);
  }

  // 3. Tarayıcıyı zorla network'ten yeniden yükle
  setTimeout(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('t', Date.now());
    window.location.href = url.toString();
  }, 500);
};

// ===== ACİL KURTAR: Global'e taşınan firmaList'i kullanıcıya geri yaz =====
async function kurtarFirmaListesi() {
  try {
    const globalSnap = await db.collection('globalReferans').doc('default').get();
    if (!globalSnap.exists) {
      showToast('globalReferans bulunamadı.', 'error'); return;
    }
    const globalData = globalSnap.data();
    const firmaListKurtar = globalData.firmaList;
    if (!firmaListKurtar || firmaListKurtar.length === 0) {
      showToast('globalReferans içinde firmaList boş veya yok.', 'warning'); return;
    }

    // Kullanıcının mevcut referansını çek
    const user = auth.currentUser;
    const userSnap = await db.collection('referans').doc(user.uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};

    // firmaList'i kullanıcı referansına ekle
    await db.collection('referans').doc(user.uid).set({
      ...userData,
      firmaList: firmaListKurtar,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Bellekteki referansı da güncelle
    referans.firmaList = firmaListKurtar;

    showToast(`✅ ${firmaListKurtar.length} firma başarıyla geri yüklendi!`, 'success', 4000);
    renderPage();
  } catch(e) {
    showToast('Kurtarma hatası: ' + (e?.message || e), 'error');
    console.error('[kurtarFirmaListesi]', e);
  }
}
