// ===================== APP.JS =====================
let proje = getDefaultProje();
let referans = loadReferans();
let currentPage = 'anasayfa';
let saveTimeout = null;
let projeAktif = false;
let currentProjeKilitli = false;
let currentProjeBaskaKullanici = false;
let currentProjeStatus = 'taslak';
let okunmamiDuyuruSayisi = 0;
let currentBelgelerProjeId = null;
let currentGerceklestirmeciBelgelerProjeId = null;
let currentGerceklestirmeciBelge = 'dt-onay-belgesi'; // varsayılan: D.T. Onay Belgesi
let currentGerceklestirmeciTab = 'projeler';
let currentGerceklestirmeciReadOnly = false;
let currentOnayliBelgelerProjeId = null;

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

// ===== TOAST BİLDİRİM SİSTEMİ =====
function showToast(mesaj, tip = 'success', sure = 3000) {
  const renkler = {
    success: { bg: '#065f46', border: '#059669', icon: '✓' },
    error:   { bg: '#991b1b', border: '#dc2626', icon: '✕' },
    warning: { bg: '#92400e', border: '#d97706', icon: '⚠' },
    info:    { bg: '#1e3a5f', border: '#1a56db', icon: 'ℹ' }
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
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:14px;padding:28px 24px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
        <p style="font-size:15px;color:#1f2937;line-height:1.6;margin:0 0 14px">${baslik}</p>
        <textarea id="dtmPromptInput" placeholder="${placeholder}" rows="4"
          style="width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:8px;padding:10px;font-size:14px;resize:vertical;font-family:inherit"></textarea>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
          <button id="dtmPromptIptal" style="background:#f3f4f6;color:#374151;border:none;border-radius:7px;padding:9px 18px;font-size:14px;font-weight:600;cursor:pointer">İptal</button>
          <button id="dtmPromptOnay" style="background:#dc2626;color:#fff;border:none;border-radius:7px;padding:9px 18px;font-size:14px;font-weight:600;cursor:pointer">Geri Gönder</button>
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
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:14px;padding:28px 24px;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
        <p style="font-size:15px;color:#1f2937;line-height:1.6;margin:0 0 22px">${mesaj}</p>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="dtmConfirmIptal" style="background:#f3f4f6;color:#374151;border:none;border-radius:7px;padding:9px 18px;font-size:14px;font-weight:600;cursor:pointer">${iptalBtn}</button>
          <button id="dtmConfirmOnay" style="background:#dc2626;color:#fff;border:none;border-radius:7px;padding:9px 18px;font-size:14px;font-weight:600;cursor:pointer">${onayBtn}</button>
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

  const belgeler = [
    { id: 'yaklasik-maliyet', ad: 'Yaklaşık Maliyet' },
    { id: 'teklif-tutanagi', ad: 'Teklif Tutanağı' },
    { id: 'sozlesme', ad: 'Sözleşme' },
    { id: 'bitti-tutanagi', ad: 'Bitti Tutanağı' },
    { id: 'hakedis-raporu', ad: 'Hakediş Raporu' }
  ];

  const checkboxler = belgeler.map(b => `
    <label style="display:flex;align-items:center;gap:10px;padding:9px 0;cursor:pointer;border-bottom:1px solid #f3f4f6;">
      <input type="checkbox" class="belge-indir-cb" value="${b.id}" checked
        style="width:16px;height:16px;cursor:pointer;accent-color:#2563eb">
      <span style="font-size:14px;color:#1f2937">${b.ad}</span>
    </label>`).join('');

  const overlay = document.createElement('div');
  overlay.id = 'dtmBelgeIndirModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:28px 24px;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <h3 style="margin:0 0 4px;font-size:16px;color:#1f2937">&#128196; Belge İndir</h3>
      <p style="margin:0 0 14px;font-size:13px;color:#6b7280">İndirilecek belgeleri işaretleyin</p>
      <label style="display:flex;align-items:center;gap:10px;padding:9px 0;cursor:pointer;border-bottom:2px solid #e5e7eb;margin-bottom:2px;font-weight:600;">
        <input type="checkbox" id="hepsiniSecCb" checked
          style="width:16px;height:16px;cursor:pointer;accent-color:#2563eb">
        <span style="font-size:14px;color:#374151">Tümünü Seç</span>
      </label>
      ${checkboxler}
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
        <button id="dtmBelgeIndirIptal" style="background:#f3f4f6;color:#374151;border:none;border-radius:7px;padding:9px 18px;font-size:14px;font-weight:600;cursor:pointer">İptal</button>
        <button id="dtmBelgeIndirOnay" style="background:#2563eb;color:#fff;border:none;border-radius:7px;padding:9px 18px;font-size:14px;font-weight:600;cursor:pointer">&#128196; İndir</button>
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
}

async function cokluBelgeIndir(secilen) {
  if (!proje || !currentBelgelerProjeId) { showToast('Proje bulunamadı', 'error'); return; }

  const belgeMap = {
    'yaklasik-maliyet': { render: () => renderYaklasikMaliyet(proje, referans), landscape: true },
    'teklif-tutanagi':  { render: () => renderTeklifTutanagi(proje, referans), landscape: true },
    'sozlesme':         { render: () => renderSozlesme(proje, referans), landscape: false, sozlesme: true },
    'bitti-tutanagi':   { render: () => renderBittiTutanagi(proje, referans), landscape: false },
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
    body { font-family: "Times New Roman", serif; font-size:9.5pt; color:#000; background:#fff; }
    .belge-bolum { padding:15mm 20mm; }
    .pg-yatay { padding:10mm 15mm; }
    .belge { width:100%; }
    .belge-ust { text-align:center; margin-bottom:15px; }
    .belge-baslik { text-align:center; font-size:13.5pt; margin:10px 0; font-weight:bold; }
    .bilgi-tablo { width:100%; border-collapse:collapse; margin-bottom:10px; }
    .bilgi-tablo td { padding:2px 6px; vertical-align:top; }
    .bilgi-tablo .etiket { font-weight:bold; }
    .veri-tablo { width:100%; border-collapse:collapse; margin-bottom:10px; border:0.5mm solid #000; }
    .veri-tablo th, .veri-tablo td { border:0.5mm solid #000; padding:2px 4px; text-align:left; font-size:9.5pt; }
    .veri-tablo th { background:#f0f0f0; text-align:center; font-weight:bold; }
    .rakam { text-align:right !important; } .merkez { text-align:center !important; } .bold { font-weight:bold; }
    .toplam-satir td { font-weight:bold; background:#f9f9f9; }
    .aciklama-metin { margin:15px 0; line-height:1.6; text-align:justify; }
    .imzalar-yan { display:flex; justify-content:space-around; gap:30px; }
    .imza-kutu, .imza-kutu-inline { text-align:center; min-width:150px; }
    .imza-ad { font-weight:bold; margin-top:40px; } .imza-unvan { font-size:9.5pt; }
    .madde { margin-bottom:12px; line-height:1.5; page-break-inside:avoid; break-inside:avoid; }
    .madde p { margin-top:5px; text-align:justify; }
    .sozlesme .madde p, .sozlesme .madde { font-size:12pt; }
    .sozlesme .madde { margin-bottom:7px; line-height:1.35; }
    .tutanak { font-size:11pt; }
    .tutanak .bilgi-tablo td { font-size:11pt; padding:4px 6px; }
    .tutanak .belge-baslik { font-size:13pt; }
    .sozlesme-imza { margin-top:20px; }
    .hakedis-tablo td:first-child { width:30px; text-align:center; font-weight:bold; }
    small { font-size:8.5pt; }
    .sozlesme-sayfa-tablo { width:100%; border-collapse:collapse; }
    .sozlesme-sayfa-tablo > tbody > tr > td { padding:0; }
    .sozlesme-sayfa-header { display:block; text-align:center; font-weight:bold; font-size:10pt; line-height:1.5; padding:4px 0 6px; margin-bottom:6px; }
    @page dikey  { size: A4 portrait;  margin: 15mm 20mm; }
    @page yatay  { size: A4 landscape; margin: 10mm 15mm; }
    @media print {
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

  const belgeler = [
    { id: 'dt-onay-belgesi', ad: 'D.T. Onay Belgesi' },
    { id: 'yaklasik-maliyet', ad: 'Yaklaşık Maliyet' },
    { id: 'teklif-tutanagi', ad: 'Teklif Tutanağı' },
    { id: 'sozlesme', ad: 'Sözleşme' },
    { id: 'bitti-tutanagi', ad: 'Bitti Tutanağı' },
    { id: 'hakedis-raporu', ad: 'Hakediş Raporu' }
  ];

  const checkboxler = belgeler.map(b => `
    <label style="display:flex;align-items:center;gap:10px;padding:9px 0;cursor:pointer;border-bottom:1px solid #f3f4f6;">
      <input type="checkbox" class="belge-indir-cb" value="${b.id}" checked
        style="width:16px;height:16px;cursor:pointer;accent-color:#2563eb">
      <span style="font-size:14px;color:#1f2937">${b.ad}</span>
    </label>`).join('');

  const overlay = document.createElement('div');
  overlay.id = 'dtmBelgeIndirModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:28px 24px;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
      <h3 style="margin:0 0 4px;font-size:16px;color:#1f2937">&#128196; Belge İndir</h3>
      <p style="margin:0 0 14px;font-size:13px;color:#6b7280">İndirilecek belgeleri işaretleyin</p>
      <label style="display:flex;align-items:center;gap:10px;padding:9px 0;cursor:pointer;border-bottom:2px solid #e5e7eb;margin-bottom:2px;font-weight:600;">
        <input type="checkbox" id="hepsiniSecCb2" checked style="width:16px;height:16px;cursor:pointer;accent-color:#2563eb">
        <span style="font-size:14px;color:#374151">Tümünü Seç</span>
      </label>
      ${checkboxler}
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
        <button id="gcIndirIptal" style="background:#f3f4f6;color:#374151;border:none;border-radius:7px;padding:9px 18px;font-size:14px;font-weight:600;cursor:pointer">İptal</button>
        <button id="gcIndirOnay" style="background:#2563eb;color:#fff;border:none;border-radius:7px;padding:9px 18px;font-size:14px;font-weight:600;cursor:pointer">&#128196; İndir</button>
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
}

function cokluGerceklestirmeciBelgeIndir(secilen) {
  if (!proje || !currentGerceklestirmeciBelgelerProjeId) return;

  const belgeMap = {
    'dt-onay-belgesi':  { render: () => renderDogrudanTeminOnayBelgesi(proje), landscape: false },
    'yaklasik-maliyet': { render: () => renderYaklasikMaliyet(proje, referans), landscape: true },
    'teklif-tutanagi':  { render: () => renderTeklifTutanagi(proje, referans), landscape: true },
    'sozlesme':         { render: () => renderSozlesme(proje, referans), landscape: false },
    'bitti-tutanagi':   { render: () => renderBittiTutanagi(proje, referans), landscape: false },
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
    body { font-family: "Times New Roman", serif; font-size:9.5pt; color:#000; background:#fff; }
    .belge-bolum { padding:15mm 20mm; }
    .pg-yatay { padding:10mm 15mm; }
    .belge { width:100%; }
    .belge-ust { text-align:center; margin-bottom:15px; }
    .belge-baslik { text-align:center; font-size:13.5pt; margin:10px 0; font-weight:bold; }
    .bilgi-tablo { width:100%; border-collapse:collapse; margin-bottom:10px; }
    .bilgi-tablo td { padding:2px 6px; vertical-align:top; }
    .bilgi-tablo .etiket { font-weight:bold; }
    .veri-tablo { width:100%; border-collapse:collapse; margin-bottom:10px; border:0.5mm solid #000; }
    .veri-tablo th, .veri-tablo td { border:0.5mm solid #000; padding:2px 4px; text-align:left; font-size:9.5pt; }
    .veri-tablo th { background:#f0f0f0; text-align:center; font-weight:bold; }
    .rakam { text-align:right !important; } .merkez { text-align:center !important; } .bold { font-weight:bold; }
    .toplam-satir td { font-weight:bold; background:#f9f9f9; }
    .aciklama-metin { margin:15px 0; line-height:1.6; text-align:justify; }
    .imzalar-yan { display:flex; justify-content:space-around; gap:30px; }
    .imza-kutu, .imza-kutu-inline { text-align:center; min-width:150px; }
    .imza-ad { font-weight:bold; margin-top:40px; } .imza-unvan { font-size:9.5pt; }
    .madde { margin-bottom:12px; line-height:1.5; page-break-inside:avoid; break-inside:avoid; }
    .madde p { margin-top:5px; text-align:justify; }
    .sozlesme .madde p, .sozlesme .madde { font-size:12pt; }
    .sozlesme .madde { margin-bottom:7px; line-height:1.35; }
    .tutanak { font-size:11pt; }
    .tutanak .bilgi-tablo td { font-size:11pt; padding:4px 6px; }
    .tutanak .belge-baslik { font-size:13pt; }
    .sozlesme-imza { margin-top:20px; }
    .hakedis-tablo td:first-child { width:30px; text-align:center; font-weight:bold; }
    small { font-size:8.5pt; }
    .sozlesme-sayfa-tablo { width:100%; border-collapse:collapse; }
    .sozlesme-sayfa-tablo > tbody > tr > td { padding:0; }
    .sozlesme-sayfa-header { display:block; text-align:center; font-weight:bold; font-size:10pt; line-height:1.5; padding:4px 0 6px; margin-bottom:6px; }
    @page dikey  { size: A4 portrait;  margin: 15mm 20mm; }
    @page yatay  { size: A4 landscape; margin: 10mm 15mm; }
    @media print {
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
    showLoginError('Kullanıcı adı veya şifre hatalı.');
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

async function doLogout() {
  if (!await showConfirm('Çıkış yapmak istediğinize emin misiniz?', 'Çıkış Yap')) return;
  await dtmLogout();
}

async function onAuthReady(user) {
  const lo = document.getElementById('loadingOverlay');
  if (lo) lo.style.display = 'none';
  if (user && currentDTMUser) {
    // Referansı buluttan yükle (kullanıcı + global)
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

// Enter tuşu ile login
document.addEventListener('DOMContentLoaded', () => {
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
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      currentPage = item.dataset.page;
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
    case 'gerceklestirmeci-veri-merkezi': main.innerHTML = renderGerceklestirmeciVeriMerkeziPage(); break;
    case 'onayli-belgeler': renderOnayliBelgelerPage(); break;
    case 'proje-ozet': renderProjeOzetPage(); break;
    case 'onay-belgesi': renderOnayBelgesiPage(); break;
    case 'profil': main.innerHTML = renderProfilPage(); bindProfil(); break;
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
    gerceklestirmeci: { icon: '📋', mesaj: 'Sol menüden <strong>Gönderilen Projeler</strong> bölümüne giderek size iletilen projeleri görüntüleyebilirsiniz.' },
    admin: { icon: '📁', mesaj: 'Sol menüden <strong>Proje Arşivi</strong> bölümüne giderek onaylanmış tüm projeleri görüntüleyebilirsiniz.' },
    superadmin: { icon: '⚙️', mesaj: 'Sol menüden <strong>Kullanıcı Yönetimi</strong> bölümüne giderek sistemi yönetebilirsiniz.' }
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
      <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:12px;padding:28px 24px;text-align:center;margin-bottom:32px">
        <div style="font-size:42px;margin-bottom:12px">${roleInfo.icon}</div>
        <p style="color:var(--gray-700);font-size:14px;line-height:1.6">${roleInfo.mesaj}</p>
      </div>` : `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:32px">
        <div onclick="yeniProjeBaslat()" style="background:var(--primary);color:#fff;border-radius:12px;padding:28px 24px;cursor:pointer;transition:opacity 0.15s;text-align:center" onmouseover="this.style.opacity='.88'" onmouseout="this.style.opacity='1'">
          <div style="font-size:36px;margin-bottom:10px">📋</div>
          <div style="font-weight:700;font-size:16px;margin-bottom:4px">Yeni Proje</div>
          <div style="font-size:12px;opacity:0.85">Yeni bir proje oluştur</div>
        </div>
        <div onclick="projeAcSayfasinaGit()" style="background:#fff;border:2px solid var(--gray-200);border-radius:12px;padding:28px 24px;cursor:pointer;transition:border-color 0.15s;text-align:center" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--gray-200)'">
          <div style="font-size:36px;margin-bottom:10px">📂</div>
          <div style="font-weight:700;font-size:16px;margin-bottom:4px;color:var(--gray-800)">Proje Aç</div>
          <div style="font-size:12px;color:var(--gray-500)">Kayıtlı projeleri görüntüle</div>
        </div>
      </div>

      <div style="background:#fff;border:1px solid var(--gray-200);border-radius:12px;overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--gray-100);font-weight:600;font-size:14px;color:var(--gray-700)">
          ⏱ Son Projeler
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
        return `<div onclick="cloudProjeAc('${p.id}')" style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--gray-100);cursor:pointer" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color=''">
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
  const isAdi = document.getElementById('yeniProjeAdi')?.value.trim();
  if (!isAdi) { showToast('Lütfen bir proje adı girin.', 'warning'); return; }
  proje = getDefaultProje();
  proje.isAdi = isAdi;
  currentCloudProjeId = null;
  currentProjeKilitli = false;
  currentProjeBaskaKullanici = false;
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
  const ymGorevliRows = proje.ymGorevliler.slice(0, ymSayisi).map((g, i) => `
    <div class="form-grid">
      <div class="form-group">
        <label>Y.M. Görevlisi ${i + 1}</label>
        <select data-field="ymGorevliler" data-index="${i}" data-sub="ad" onchange="onGorevliChange(this, 'ym')">
          <option value="">-- Seçin --</option>
          ${referans.muhendisList.map(m => `<option value="${m.ad}" ${g.ad === m.ad ? 'selected' : ''}>${m.ad}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Ünvanı</label>
        <input type="text" value="${g.unvan || getUnvanByAd(g.ad, referans)}" readonly>
      </div>
    </div>`).join('');
  const ymEkleBtn = ymSayisi < 3 ? `<button class="btn btn-outline btn-sm" onclick="onGorevliEkle('ym')" style="margin-top:6px;">+ Y.M. Görevlisi Ekle</button>` : '';

  const dtSayisi = proje.dtGorevliSayisi || 1;
  const dtGorevliRows = proje.dtGorevliler.slice(0, dtSayisi).map((g, i) => `
    <div class="form-grid">
      <div class="form-group">
        <label>D.T. Görevlisi ${i + 1}</label>
        <select data-field="dtGorevliler" data-index="${i}" data-sub="ad" onchange="onGorevliChange(this, 'dt')">
          <option value="">-- Seçin --</option>
          ${referans.muhendisList.map(m => `<option value="${m.ad}" ${g.ad === m.ad ? 'selected' : ''}>${m.ad}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Ünvanı</label>
        <input type="text" value="${g.unvan || getUnvanByAd(g.ad, referans)}" readonly>
      </div>
    </div>`).join('');
  const dtEkleBtn = dtSayisi < 3 ? `<button class="btn btn-outline btn-sm" onclick="onGorevliEkle('dt')" style="margin-top:6px;">+ D.T. Görevlisi Ekle</button>` : '';

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
          <label>${fi + 1}. Firma</label>
          <select data-field="ymFirmalar" data-index="${fi}" data-sub="ad" onchange="onFirmaChange(this, 'ym')">
            <option value="">-- Firma Seçin --</option>
            ${referans.firmaList.map(fr => `<option value="${fr.ad}" ${f.ad === fr.ad ? 'selected' : ''}>${fr.ad}</option>`).join('')}
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
          <label>${fi + 1}. Firma ${isKazanan ? '(KAZANAN)' : ''}</label>
          <select data-field="teklifFirmalar" data-index="${fi}" data-sub="ad" onchange="onFirmaChange(this, 'teklif')">
            <option value="">-- Firma Seçin --</option>
            ${referans.firmaList.map(fr => `<option value="${fr.ad}" ${f.ad === fr.ad ? 'selected' : ''}>${fr.ad}</option>`).join('')}
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
            <input type="text" id="isAdi" value="${proje.isAdi}" onchange="onFieldChange('isAdi', this.value)">
          </div>
          <div class="form-group full-width" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:16px">
            <div class="form-group">
              <label>İş Türü</label>
              <select id="isTuru" onchange="onFieldChange('isTuru', this.value); renderPage();">
                ${referans.isTurleri.map(t => {
                  const aktif = t === 'Yapım İşi';
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
              <input type="text" id="sehir" value="${proje.sehir}" onchange="onFieldChange('sehir', this.value)">
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
            <input type="text" id="ymOnayNo" value="${proje.ymOnayNo}" onchange="onFieldChange('ymOnayNo', this.value)">
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
        ${dtGorevliRows}
        ${dtEkleBtn}
        <div class="form-grid" style="margin-top:12px">
          <div class="form-group">
            <label>D.T. Onay Tarihi</label>
            <input type="date" id="dtOnayTarihi" value="${proje.dtOnayTarihi}" onchange="onFieldChange('dtOnayTarihi', this.value)">
          </div>
          <div class="form-group">
            <label>Onay Sayısı</label>
            <input type="text" id="dtOnayNo" value="${proje.dtOnayNo}" onchange="onFieldChange('dtOnayNo', this.value)">
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
            <input type="text" id="yatirimProjeNo" value="${proje.yatirimProjeNo}" oninput="onFieldChange('yatirimProjeNo', this.value)" placeholder="Varsa giriniz">
          </div>
          <div class="form-group">
            <label>Bütçe Tertibi</label>
            <input type="text" id="butceTertibi" value="${proje.butceTertibi}" oninput="onFieldChange('butceTertibi', this.value)" placeholder="Örn: 09.1.2.00.000/05/03.8">
          </div>
          <div class="form-group">
            <label>İşin Miktarı</label>
            <input type="text" id="isMiktari" value="${proje.isTuru === 'Yapım İşi' ? '1 Adet' : (proje.isMiktari || '')}"
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
            <input type="text" id="gerceklestirmeAd" value="${proje.gerceklestirmeGorevlisi?.ad||''}"
              oninput="onFieldChange('gerceklestirmeGorevlisi', {ad:this.value,unvan:document.getElementById('gerceklestirmeUnvan').value})">
          </div>
          <div class="form-group">
            <label>Ünvanı</label>
            <input type="text" id="gerceklestirmeUnvan" value="${proje.gerceklestirmeGorevlisi?.unvan||'Gerçekleştirme Görevlisi'}"
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
              ${referans.onaylayanList.filter(o=>o.ad).map(o => `<option value="${o.ad}" ${proje.onaylayanAmir.ad === o.ad ? 'selected' : ''}>${o.ad}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Ünvanı</label>
            <input type="text" id="onaylayanUnvan" value="${proje.onaylayanAmir.unvan}" readonly>
          </div>
        </div>
      </div>
    </div>

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
    </div>

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
    proje.ymGorevliSayisi = Math.min((proje.ymGorevliSayisi || 1) + 1, 3);
  } else {
    proje.dtGorevliSayisi = Math.min((proje.dtGorevliSayisi || 1) + 1, 3);
  }
  saveProje(proje);
  renderPage();
}

function onGorevliChange(el, type) {
  const idx = parseInt(el.dataset.index);
  const ad = el.value;
  const unvan = getUnvanByAd(ad, referans);
  if (type === 'ym') {
    proje.ymGorevliler[idx] = { ad, unvan };
  } else {
    proje.dtGorevliler[idx] = { ad, unvan };
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
  proje.isKalemleri[idx][sub] = el.value;
  autoSave();
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

  // PDF metnini oku
  async function readPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    return text;
  }

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

    return { isDT, isYM, isAdi, onayNo, onayTarihi, gorevliAd, gorevliUnvan };
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

    // Özet oluştur
    const satirlar = [];
    satirlar.push(`📋 İş Adı: ${isAdi}`);
    if (ymSonuc) {
      satirlar.push('');
      satirlar.push('📘 Y.M. Onay Belgesi:');
      if (ymSonuc.onayNo)     satirlar.push(`  🔢 Sayı: ${ymSonuc.onayNo}`);
      if (ymSonuc.onayTarihi) satirlar.push(`  📅 Tarih: ${ymSonuc.onayTarihi.split('-').reverse().join('.')}`);
      if (ymSonuc.gorevliAd)  satirlar.push(`  👤 Görevli: ${ymSonuc.gorevliAd}`);
    }
    if (dtSonuc) {
      satirlar.push('');
      satirlar.push('📗 D.T. Onay Belgesi:');
      if (dtSonuc.onayNo)     satirlar.push(`  🔢 Sayı: ${dtSonuc.onayNo}`);
      if (dtSonuc.onayTarihi) satirlar.push(`  📅 Tarih: ${dtSonuc.onayTarihi.split('-').reverse().join('.')}`);
      if (dtSonuc.gorevliAd)  satirlar.push(`  👤 Görevli: ${dtSonuc.gorevliAd}`);
    }

    const onaylandi = await showConfirm(`Aşağıdaki bilgiler okundu:\n\n${satirlar.join('\n')}\n\nForma aktaralım mı?`, 'Evet, Aktar', 'Hayır');
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

    if (ymSonuc) {
      if (ymSonuc.onayNo)     proje.ymOnayNo = ymSonuc.onayNo;
      if (ymSonuc.onayTarihi) proje.ymOnayTarihi = ymSonuc.onayTarihi;
      if (ymSonuc.gorevliAd)  { proje.ymGorevliler[0].ad = ymSonuc.gorevliAd; proje.ymGorevliler[0].unvan = ymSonuc.gorevliUnvan || ''; proje.ymGorevliSayisi = 1; }
    }
    if (dtSonuc) {
      if (dtSonuc.onayNo)     proje.dtOnayNo = dtSonuc.onayNo;
      if (dtSonuc.onayTarihi) proje.dtOnayTarihi = dtSonuc.onayTarihi;
      if (dtSonuc.gorevliAd)  { proje.dtGorevliler[0].ad = dtSonuc.gorevliAd; proje.dtGorevliler[0].unvan = dtSonuc.gorevliUnvan || ''; proje.dtGorevliSayisi = 1; }
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
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }

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
          <div style="text-align:center;padding:60px 20px;color:var(--gray-400)">
            <div style="font-size:48px;margin-bottom:16px">&#128196;</div>
            <div style="font-size:15px;font-weight:600;margin-bottom:8px">Henüz proje yok</div>
            <div style="font-size:13px">Önce bir proje oluşturun.</div>
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
                ${getStatusBadge(p.status || 'taslak')}
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
  const belgeler = [
    { id: 'yaklasik-maliyet', ad: 'Yaklaşık Maliyet' },
    { id: 'teklif-tutanagi', ad: 'Teklif Tutanağı' },
    { id: 'sozlesme', ad: 'Sözleşme' },
    { id: 'bitti-tutanagi', ad: 'Bitti Tutanağı' },
    { id: 'hakedis-raporu', ad: 'Hakediş Raporu' }
  ];

  const tabs = belgeler.map(b =>
    `<div class="belge-tab ${currentBelge === b.id ? 'active' : ''}" onclick="currentBelge='${b.id}'; renderPage();">${b.ad}</div>`
  ).join('');

  let belgeHTML = '';
  switch (currentBelge) {
    case 'yaklasik-maliyet': belgeHTML = renderYaklasikMaliyet(proje, referans); break;
    case 'teklif-tutanagi': belgeHTML = renderTeklifTutanagi(proje, referans); break;
    case 'sozlesme': belgeHTML = renderSozlesme(proje, referans); break;
    case 'bitti-tutanagi': belgeHTML = renderBittiTutanagi(proje, referans); break;
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
        <p style="display:flex;align-items:center;gap:8px">${proje.isAdi || ''} ${getStatusBadge(currentProjeStatus)}</p>
      </div>
    </div>
    <div class="belge-tabs">${tabs}</div>
    <div class="action-bar">
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
    currentBelgelerProjeId = projeId;
    currentBelge = 'yaklasik-maliyet';
    renderPage();
  } catch(e) {
    showToast('Proje yüklenemedi: ' + e.message, 'error');
  }
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
    case 'sozlesme': html = renderSozlesme(proje, referans); belgeYazdir(html, false, true); return;
    case 'bitti-tutanagi': html = renderBittiTutanagi(proje, referans); break;
    case 'hakedis-raporu': html = renderHakedisRaporu(proje, referans); break;
  }
  belgeYazdir(html, landscape);
}

function pdfIndirBelge() {
  const belgeAdlari = {
    'yaklasik-maliyet': 'Yaklaşık Maliyet Tutanağı',
    'teklif-tutanagi': 'Teklif Tutanağı',
    'sozlesme': 'Sözleşme',
    'bitti-tutanagi': 'Bitti Tutanağı',
    'hakedis-raporu': 'Hakediş Raporu'
  };
  let html = '';
  let landscape = false;
  let sozlesme = false;
  switch (currentBelge) {
    case 'yaklasik-maliyet': html = renderYaklasikMaliyet(proje, referans); landscape = true; break;
    case 'teklif-tutanagi':  html = renderTeklifTutanagi(proje, referans);  landscape = true; break;
    case 'sozlesme':         html = renderSozlesme(proje, referans);        sozlesme = true;  break;
    case 'bitti-tutanagi':   html = renderBittiTutanagi(proje, referans);   break;
    case 'hakedis-raporu':   html = renderHakedisRaporu(proje, referans);   break;
  }
  const dosyaAdi = `${proje.isAdi || 'Belge'} - ${belgeAdlari[currentBelge] || currentBelge}`;
  belgePdfIndir(html, landscape, sozlesme, dosyaAdi);
}

// ===================== VERİ MERKEZİ SAYFASI =====================
function renderVeriMerkeziPage() {
  const isSuperAdmin = currentDTMUser?.role === 'superadmin';

  const muhendisRows = referans.muhendisList.map((m, i) => `
    <tr>
      <td><input type="text" value="${m.ad}" onchange="onRefChange('muhendisList', ${i}, 'ad', this.value)"></td>
      <td><input type="text" value="${m.unvan}" onchange="onRefChange('muhendisList', ${i}, 'unvan', this.value)"></td>
      <td><button class="btn btn-danger btn-sm" onclick="onRefDelete('muhendisList', ${i})">Sil</button></td>
    </tr>`).join('');

  const onaylayanRows = referans.onaylayanList.map((o, i) => `
    <tr>
      <td><input type="text" value="${o.ad}" onchange="onRefChange('onaylayanList', ${i}, 'ad', this.value)"></td>
      <td><input type="text" value="${o.unvan}" onchange="onRefChange('onaylayanList', ${i}, 'unvan', this.value)"></td>
      <td><button class="btn btn-danger btn-sm" onclick="onRefDelete('onaylayanList', ${i})">Sil</button></td>
    </tr>`).join('');

  const firmaRows = referans.firmaList.map((f, i) => `
    <tr>
      <td><input type="text" value="${f.ad}" onchange="onRefChange('firmaList', ${i}, 'ad', this.value)"></td>
      <td><input type="text" value="${f.adres}" onchange="onRefChange('firmaList', ${i}, 'adres', this.value)"></td>
      <td><select onchange="onRefChange('firmaList', ${i}, 'tur', this.value)">
        <option value="Kişi" ${f.tur === 'Kisi' ? 'selected' : ''}>Kişi</option>
        <option value="Şirket" ${f.tur === 'Şirket' ? 'selected' : ''}>Şirket</option>
      </select></td>
      <td><input type="text" value="${f.tel}" onchange="onRefChange('firmaList', ${i}, 'tel', this.value)"></td>
      <td><input type="text" value="${f.faks || ''}" placeholder="Faks" onchange="onRefChange('firmaList', ${i}, 'faks', this.value)"></td>
      <td><input type="text" value="${f.eposta || ''}" placeholder="E-Posta" onchange="onRefChange('firmaList', ${i}, 'eposta', this.value)"></td>
      <td><button class="btn btn-danger btn-sm" onclick="onRefDelete('firmaList', ${i})">Sil</button></td>
    </tr>`).join('');

  const ilceRows = referans.ilceler.map((il, i) => `
    <span style="display:inline-flex;align-items:center;gap:4px;margin:3px;padding:4px 8px;background:var(--gray-100);border-radius:4px;">
      ${il} <button class="btn btn-danger btn-sm" onclick="onRefDelete('ilceler', ${i})" style="padding:1px 5px">&times;</button>
    </span>`).join('');

  return `
    <div class="page-header">
      <h2>Veri Merkezi</h2>
      <p>Dropdown listelerini ve referans verilerini yönetin.</p>
    </div>

    ${!isSuperAdmin ? `
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Mühendis / Görevli Listesi</h3><span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <table class="ref-table">
          <thead><tr><th>Ad Soyad</th><th>Ünvan</th><th></th></tr></thead>
          <tbody>${muhendisRows}</tbody>
        </table>
        <button class="btn btn-outline btn-sm" style="margin-top:8px" onclick="onRefAdd('muhendisList', {ad:'', unvan:''})">+ Ekle</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Firma Listesi</h3><span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <table class="ref-table">
          <thead><tr><th>Ad</th><th>Adres</th><th>Tur</th><th>Telefon</th><th>Faks</th><th>E-Posta</th><th></th></tr></thead>
          <tbody>${firmaRows}</tbody>
        </table>
        <button class="btn btn-outline btn-sm" style="margin-top:8px" onclick="onRefAdd('firmaList', {ad:'', adres:'', tur:'Kisi', tel:'', faks:'', eposta:''})">+ Ekle</button>
      </div>
    </div>
    ` : ''}

    ${isSuperAdmin ? `
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Onaylayan Amir Listesi</h3><span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <table class="ref-table">
          <thead><tr><th>Ad Soyad</th><th>Ünvan</th><th></th></tr></thead>
          <tbody>${onaylayanRows}</tbody>
        </table>
        <button class="btn btn-outline btn-sm" style="margin-top:8px" onclick="onRefAdd('onaylayanList', {ad:'', unvan:''})">+ Ekle</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>İdare Listesi</h3><span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        ${referans.idareList.map((il, i) => `
          <span style="display:inline-flex;align-items:center;gap:4px;margin:3px;padding:4px 8px;background:var(--gray-100);border-radius:4px;">
            ${il} <button class="btn btn-danger btn-sm" onclick="onRefDelete('idareList', ${i})" style="padding:1px 5px">&times;</button>
          </span>`).join('')}
        <div style="margin-top:8px;display:flex;gap:6px">
          <input type="text" id="yeniIdare" placeholder="Yeni idare adı" style="padding:4px 8px;border:1px solid var(--gray-300);border-radius:4px;flex:1">
          <button class="btn btn-outline btn-sm" onclick="const v=document.getElementById('yeniIdare').value;if(v){referans.idareList.push(v);saveGlobalReferans(referans);renderPage();}">Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Müdürlük Listesi</h3><span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        ${referans.mudurlukler.map((m, i) => `
          <span style="display:inline-flex;align-items:center;gap:4px;margin:3px;padding:4px 8px;background:var(--gray-100);border-radius:4px;">
            ${m} <button class="btn btn-danger btn-sm" onclick="onRefDelete('mudurlukler', ${i})" style="padding:1px 5px">&times;</button>
          </span>`).join('')}
        <div style="margin-top:8px;display:flex;gap:6px">
          <input type="text" id="yeniMudurluk" placeholder="Yeni müdürlük adı" style="padding:4px 8px;border:1px solid var(--gray-300);border-radius:4px;flex:1">
          <button class="btn btn-outline btn-sm" onclick="const v=document.getElementById('yeniMudurluk').value;if(v){referans.mudurlukler.push(v);saveGlobalReferans(referans);renderPage();}">Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>İlçeler</h3><span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        ${ilceRows}
        <div style="margin-top:8px;display:flex;gap:6px">
          <input type="text" id="yeniIlce" placeholder="Yeni ilçe adı" style="padding:4px 8px;border:1px solid var(--gray-300);border-radius:4px">
          <button class="btn btn-outline btn-sm" onclick="const v=document.getElementById('yeniIlce').value;if(v){referans.ilceler.push(v);saveGlobalReferans(referans);renderPage();}">Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>D.T. Sınır Tutarları</h3><span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <p style="font-size:13px;color:var(--gray-500);margin-bottom:12px">Yıllara göre Doğrudan Temin sınır tutarlarını girin (KDV hariç, TL).</p>
        <table class="ref-table">
          <thead><tr><th>Yıl</th><th>Sınır Tutarı (TL)</th></tr></thead>
          <tbody>
            ${(referans.dtSinirlari || []).map((s, i) => `
              <tr>
                <td style="font-weight:600">${s.yil}</td>
                <td><input type="number" value="${s.sinir}" min="0" placeholder="0" onchange="onRefChange('dtSinirlari', ${i}, 'sinir', parseFloat(this.value)||0)"></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : ''}
  `;
}

function bindVeriMerkezi() {}

function onRefChange(list, index, field, value) {
  if (typeof referans[list][index] === 'object') {
    referans[list][index][field] = value;
  } else {
    referans[list][index] = value;
  }
  GLOBAL_REF_FIELDS.includes(list) ? saveGlobalReferans(referans) : saveReferans(referans);
}

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
    <div class="page-header">
      <h2>&#128202; Dashboard</h2>
      <p>Projelerinizin genel özeti.</p>
    </div>
    <div style="text-align:center;padding:60px;color:var(--gray-400)">
      <div style="font-size:32px;margin-bottom:12px">&#128202;</div>
      Yükleniyor...
    </div>`;

  try {
    const projeler = await getUserProjeler();

    const toplamSayi     = projeler.length;
    const onaylananSayi  = projeler.filter(p => p.status === 'onaylandi').length;
    const bekleyenSayi   = projeler.filter(p => p.status === 'taslak' || p.status === 'gonderildi').length;
    const geriGonderSayi = projeler.filter(p => p.status === 'geri_gonderildi').length;

    const onaylananlar = projeler.filter(p => p.status === 'onaylandi');

    const onayliSatirlar = onaylananlar.map(p => {
      const projData = p.data ? Object.assign(getDefaultProje(), p.data) : getDefaultProje();
      const kalemler = getKalemler(projData);
      const ym = hesaplaYaklasikMaliyet(projData);
      const kazananIdx = projData.kazananFirmaIndex >= 0 ? projData.kazananFirmaIndex : hesaplaKazananFirma(projData);
      const kazananFirma = kazananIdx >= 0 ? projData.teklifFirmalar[kazananIdx] : null;
      const kazananToplam = kazananFirma ? hesaplaTeklifFirmaToplam(kazananFirma, kalemler) : 0;
      const tasarruf = ym > 0 && kazananToplam > 0 ? ym - kazananToplam : 0;
      const tasarrufOran = ym > 0 && tasarruf > 0 ? (tasarruf / ym * 100).toFixed(1) : null;
      const tarih = p.onaylandiAt?.toDate
        ? p.onaylandiAt.toDate().toLocaleDateString('tr-TR')
        : (p.updatedAt?.toDate ? p.updatedAt.toDate().toLocaleDateString('tr-TR') : '-');
      return `<tr onclick="dashboardProjeAc('${p.id}')" style="cursor:pointer"
        onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background=''">
        <td style="font-weight:500">${escHtml(p.isAdi || '(İsimsiz)')}</td>
        <td>${tarih}</td>
        <td class="rakam">${ym > 0 ? formatCurrencyInt(ym) + ' TL' : '-'}</td>
        <td class="rakam">${kazananFirma ? kazananFirma.ad : '-'}</td>
        <td class="rakam">${kazananToplam > 0 ? formatCurrencyInt(kazananToplam) + ' TL' : '-'}</td>
        <td class="rakam" style="color:${tasarruf > 0 ? '#065f46' : 'inherit'};font-weight:${tasarruf > 0 ? '600' : 'normal'}">
          ${tasarrufOran ? '%' + tasarrufOran : '-'}
        </td>
      </tr>`;
    }).join('');

    main.innerHTML = `
      <div class="page-header">
        <h2>&#128202; Dashboard</h2>
        <p>Projelerinizin genel özeti.</p>
      </div>

      <div class="stat-grid">
        <div class="stat-card primary">
          <div class="stat-label">Toplam Proje</div>
          <div class="stat-value">${toplamSayi}</div>
          <div class="stat-sub">Tüm projeler</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Onaylanan</div>
          <div class="stat-value">${onaylananSayi}</div>
          <div class="stat-sub">Tamamlanan</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Bekleyen</div>
          <div class="stat-value">${bekleyenSayi}</div>
          <div class="stat-sub">Taslak + Gönderildi</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Geri Gönderilen</div>
          <div class="stat-value">${geriGonderSayi}</div>
          <div class="stat-sub">Revizyon bekliyor</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>&#10003; Onaylanan Projeler (${onaylananSayi})</h3></div>
        <div class="card-body">
          ${onaylananlar.length === 0
            ? `<div style="text-align:center;padding:40px;color:var(--gray-400);font-size:13px">
                 Henüz onaylanmış proje yok.
               </div>`
            : `<table class="data-table">
                 <thead>
                   <tr>
                     <th>Proje Adı</th>
                     <th>Onay Tarihi</th>
                     <th>Yaklaşık Maliyet</th>
                     <th>Kazanan Firma</th>
                     <th>Kazanan Teklif</th>
                     <th>Tasarruf %</th>
                   </tr>
                 </thead>
                 <tbody>${onayliSatirlar}</tbody>
               </table>`}
        </div>
      </div>
    `;
  } catch(e) {
    main.innerHTML = `
      <div class="page-header"><h2>&#128202; Dashboard</h2></div>
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
      await db.collection('projeler').doc(currentCloudProjeId).update(extraUpdate).catch(() => {});
      showToast('Proje başarıyla kaydedildi!');
    } else {
      currentCloudProjeId = await saveProjeToCloud(proje);
      showToast('Proje başarıyla kaydedildi!');
    }
    renderPage();
  } catch(e) {
    showToast('Hata: ' + e.message, 'error');
  }
}

async function dashboardProjeAc(projeId) {
  try {
    const doc = await getProjeFromCloud(projeId);
    proje = Object.assign(getDefaultProje(), doc.data);
    currentCloudProjeId = projeId;
    currentProjeStatus = doc.status || 'taslak';
    currentProjeKilitli = true;
    currentProjeBaskaKullanici = false;
    saveProje(proje);
    projeAktif = true;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    currentPage = 'proje-ozet';
    updateNavLock();
    renderPage();
  } catch(e) {
    showToast('Hata: ' + e.message, 'error');
  }
}

async function cloudProjeAc(projeId) {
  try {
    const doc = await getProjeFromCloud(projeId);
    proje = Object.assign(getDefaultProje(), doc.data);
    currentCloudProjeId = projeId;
    currentProjeBaskaKullanici = ['admin','superadmin'].includes(currentDTMUser?.role) && doc.userId !== currentDTMUser.uid;
    currentProjeStatus = doc.status || 'taslak';
    const gonderildi = doc.status === 'gonderildi' || doc.status === 'onaylandi';
    currentProjeKilitli = doc.locked === true || currentProjeBaskaKullanici || gonderildi;
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
    showToast('Hata: ' + e.message, 'error');
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
            ${gerceklestirmeciler.map(g => `<option value="${g.uid}" data-ad="${g.displayName}">${g.displayName}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button onclick="document.getElementById('gonderiModal').remove()" style="padding:9px 20px;border:1px solid #d1d5db;background:#fff;border-radius:7px;cursor:pointer;font-size:13px">İptal</button>
          <button onclick="gonderiOnayla('${projeId}')" style="padding:9px 20px;background:#16a34a;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:13px;font-weight:600">Gönder</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function gonderiOnayla(projeId) {
  const select = document.getElementById('gerceklestirmeciSelect');
  const uid = select.value;
  const ad = select.options[select.selectedIndex]?.dataset?.ad || '';
  if (!uid) { showToast('Lütfen bir gerçekleştirmeci seçin.', 'warning'); return; }
  document.getElementById('gonderiModal').remove();
  try {
    await gonderiProje(projeId, uid, ad);
    if (currentCloudProjeId === projeId) currentProjeKilitli = true;
    renderPage();
  } catch(e) {
    showToast('Hata: ' + e.message, 'error');
  }
}


async function arsivleClick(projeId, isAdi) {
  if (!await showConfirm(`"${isAdi}" projesi arşive kaldırılacak.`, 'Arşivle')) return;
  try {
    await db.collection('projeler').doc(projeId).update({ status: 'arsivlendi', arsivlendiAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('Proje arşive kaldırıldı.', 'success');
    renderPage();
  } catch(e) { showToast('Hata: ' + e.message, 'error'); }
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
  } catch(e) { showToast('Hata: ' + e.message, 'error'); }
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
  } catch(e) { showToast('Hata: ' + e.message, 'error'); }
}


async function gonderilenOnaylaClick(projeId, isAdi) {
  try {
    const doc = await getProjeFromCloud(projeId);
    const data = Object.assign(getDefaultProje(), doc.data);
    if (!data.odenek || !data.butceTertibi) {
      showToast('Onay belgesi bilgileri eksik! Gerçekleştirme görevlisi önce ödenek ve bütçe tertibi bilgilerini girmelidir.', 'warning');
      return;
    }
    if (!await showConfirm(`"${isAdi}" projesi onaylanacak.<br><br>Bu işlem geri alınamaz. Emin misiniz?`, 'Onayla')) return;
    await onaylaProje(projeId);
    renderPage();
  } catch(e) {
    showToast('Hata: ' + e.message, 'error');
  }
}

async function onaylaClick(projeId, isAdi) {
  // Onay belgesi bilgileri doldurulmuş mu kontrol et
  if (!proje.odenek || !proje.butceTertibi) {
    showToast('Onay belgesi bilgileri eksik! Lütfen gerçekleştirme görevlisinin önce ödenek ve bütçe tertibi bilgilerini girmesini bekleyin.', 'warning');
    return;
  }
  if (!await showConfirm(`"${isAdi}" projesi onaylanacak.<br><br>Bu işlem geri alınamaz. Emin misiniz?`, 'Onayla')) return;
  try {
    await onaylaProje(projeId);
    // Belge oluşturma sayfasına yönlendir
    currentPage = 'onay-belgesi';
    renderPage();
  } catch(e) {
    showToast('Hata: ' + e.message, 'error');
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
    showToast('Hata: ' + e.message, 'error');
  }
}

async function cloudProjeSil(projeId, isAdi, kilitli) {
  if (kilitli) { showToast(`"${isAdi}" projesi kilitli. Silmek için önce kilidi açın.`, 'warning'); return; }
  if (!await showConfirm(`"${isAdi}" projesi kalıcı olarak silinecek. Emin misiniz?`, 'Sil')) return;
  try {
    await deleteProjeFromCloud(projeId);
    if (currentCloudProjeId === projeId) { currentCloudProjeId = null; currentProjeKilitli = false; }
    renderPage();
  } catch(e) {
    showToast('Hata: ' + e.message, 'error');
  }
}

async function cloudProjeKilitle(projeId, kilitle) {
  try {
    await toggleProjeLock(projeId, kilitle);
    if (currentCloudProjeId === projeId) currentProjeKilitli = kilitle;
    renderPage();
  } catch(e) {
    showToast('Hata: ' + e.message, 'error');
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
    <div class="page-header">
      <h2>Kullanıcı Yönetimi</h2>
      <p>Sisteme erişim yetkisi olan kullanıcıları yönetin.</p>
    </div>
    <div style="text-align:center;padding:40px;color:var(--gray-400)">Kullanıcılar yükleniyor...</div>
  `;
  try {
    const users = await getAllUsers();
    main.innerHTML = `
      <div class="page-header">
        <h2>Kullanıcı Yönetimi</h2>
        <p>Sisteme erişim yetkisi olan kullanıcıları yönetin.</p>
      </div>

      <div class="card">
        <div class="card-header"><h3>&#128100; Yeni Kullanıcı Ekle</h3></div>
        <div class="card-body">
          <div class="form-grid" style="max-width:600px">
            <div class="form-group">
              <label>Ad Soyad</label>
              <input type="text" id="yeniAd" placeholder="Ad Soyad">
            </div>
            <div class="form-group">
              <label>Kullanıcı Adı</label>
              <input type="text" id="yeniUsername" placeholder="kullaniciadi">
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
          <button class="btn btn-primary" onclick="kullaniciEkle()">+ Kullanıcı Ekle</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>&#128101; Mevcut Kullanıcılar</h3></div>
        <div class="card-body">
          <table class="data-table">
            <thead><tr><th>Ad Soyad</th><th>Kullanıcı Adı</th><th>Rol</th><th></th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>${u.displayName || '-'}</td>
                  <td>${u.username || '-'}</td>
                  <td>${u.uid !== currentDTMUser.uid ? `
                    <select onchange="kullaniciRolDegistir('${u.uid}', this.value)" style="padding:4px 8px;border:1px solid var(--gray-300);border-radius:5px;font-size:12px;cursor:pointer">
                      <option value="user" ${u.role === 'user' ? 'selected' : ''}>Kullanıcı</option>
                      <option value="gerceklestirmeci" ${u.role === 'gerceklestirmeci' ? 'selected' : ''}>Gerçekleştirme Görevlisi</option>
                      <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Yönetici</option>
                      <option value="superadmin" ${u.role === 'superadmin' ? 'selected' : ''}>Sistem Yöneticisi</option>
                    </select>` : `<span class="badge badge-admin">${getRoleLabel(u.role)}</span>`}
                  </td>
                  <td>
                    ${u.uid !== currentDTMUser.uid ? `<button class="btn btn-danger btn-sm" onclick="kullaniciSil('${u.uid}', '${u.displayName}')">Sil</button>` : '<span style="color:var(--gray-400);font-size:12px">(Aktif oturum)</span>'}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch(e) {
    main.innerHTML = `<div class="page-header"><h2>Kullanıcı Yönetimi</h2></div>
      <div style="color:red;padding:20px">Hata: ${e.message}</div>`;
  }
}

async function kullaniciEkle() {
  const ad = document.getElementById('yeniAd').value.trim();
  const username = document.getElementById('yeniUsername').value.trim();
  const sifre = document.getElementById('yeniSifre').value;
  const rol = document.getElementById('yeniRol').value;
  const msg = document.getElementById('kullaniciMsg');

  if (!ad || !username || !sifre) { msg.style.color = 'red'; msg.textContent = 'Tüm alanları doldurun.'; return; }
  if (sifre.length < 6) { msg.style.color = 'red'; msg.textContent = 'Şifre en az 6 karakter olmalı.'; return; }

  msg.style.color = 'var(--gray-500)'; msg.textContent = 'Kullanıcı oluşturuluyor...';
  try {
    await createDTMUser(username, sifre, ad, rol);
    msg.style.color = 'green'; msg.textContent = `✓ "${ad}" kullanıcısı başarıyla oluşturuldu.`;
    document.getElementById('yeniAd').value = '';
    document.getElementById('yeniUsername').value = '';
    document.getElementById('yeniSifre').value = '';
    renderKullaniciYonetimiPage();
  } catch(e) {
    msg.style.color = 'red';
    if (e.code === 'auth/email-already-in-use') msg.textContent = 'Bu kullanıcı adı zaten kullanımda.';
    else msg.textContent = 'Hata: ' + e.message;
  }
}

async function kullaniciRolDegistir(uid, yeniRol) {
  try {
    await changeUserRole(uid, yeniRol);
    renderKullaniciYonetimiPage();
  } catch(e) {
    showToast('Hata: ' + e.message, 'error');
  }
}

async function kullaniciSil(uid, ad) {
  if (!await showConfirm(`"${ad}" kullanıcısı kalıcı olarak silinecek. Emin misiniz?`, 'Sil')) return;
  try {
    await db.collection('users').doc(uid).delete();
    renderKullaniciYonetimiPage();
  } catch(e) {
    showToast('Hata: ' + e.message, 'error');
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
      }).catch(() => {});
    }
    const badge = document.getElementById('geriGonderBadge');
    if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }

    const bolumler = [
      { keys: ['taslak'],                    baslik: '📂 Devam Edenler',     renk: '#f9fafb', kenar: '#e5e7eb', yaziRenk: '#374151' },
      { keys: ['geri_gonderildi'],           baslik: '⏳ İşlem Bekleyenler', renk: '#fef2f2', kenar: '#fecaca', yaziRenk: '#991b1b' },
      { keys: ['gonderildi', 'onaylandi'],   baslik: '✅ Onaylananlar',       renk: '#f0fdf4', kenar: '#bbf7d0', yaziRenk: '#15803d' }
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
        return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:16px;overflow:hidden">
          <div style="padding:12px 16px;background:${b.renk};border-bottom:1px solid ${b.kenar};font-weight:700;font-size:13px;color:${b.yaziRenk}">
            ${b.baslik} (${grup.length})
          </div>
          ${grup.length === 0
            ? `<div style="text-align:center;padding:20px;color:#9ca3af;font-size:13px">${ara ? 'Arama ile eşleşen proje yok.' : 'Bu kategoride proje yok.'}</div>`
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
    }).catch(() => {});
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
            <span class="ky-proje-user">👤 ${p.userDisplayName || '-'}</span>
            <span class="ky-proje-date">📅 ${tarih}</span>
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
      <td style="width:40%"><input type="text" value="${bt.no || ''}" onchange="btGuncelle(${i},'no',this.value)" style="width:100%"></td>
      <td><input type="text" value="${bt.aciklama || ''}" onchange="btGuncelle(${i},'aciklama',this.value)" style="width:100%" placeholder="Açıklama (ör: Yapım İşleri)"></td>
      <td style="width:60px;text-align:center"><button class="btn btn-danger btn-sm" onclick="onRefDelete('butceTertibiList', ${i})">Sil</button></td>
    </tr>`).join('');

  return `
    <div class="page-header">
      <h2>Veri Merkezi</h2>
      <p>Bütçe tertiplerini yönetin.</p>
    </div>
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Bütçe Tertibi Listesi</h3><span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <table class="ref-table">
          <thead><tr><th style="width:40%">Bütçe Tertibi No</th><th>Açıklama</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:8px;display:flex;gap:6px">
          <input type="text" id="yeniBtNo" placeholder="Örn: 09.1.2.00.000/05/03.8" style="padding:6px 10px;border:1px solid var(--gray-300);border-radius:6px;flex:1;font-size:14px">
          <input type="text" id="yeniBtAciklama" placeholder="Açıklama" style="padding:6px 10px;border:1px solid var(--gray-300);border-radius:6px;flex:1;font-size:14px">
          <button class="btn btn-outline btn-sm" onclick="
            const no=document.getElementById('yeniBtNo').value.trim();
            const ac=document.getElementById('yeniBtAciklama').value.trim();
            if(no){if(!referans.butceTertibiList)referans.butceTertibiList=[];referans.butceTertibiList.push({no,aciklama:ac});saveReferans(referans);renderPage();}
          ">+ Ekle</button>
        </div>
      </div>
    </div>
  `;
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

  // Proje seçiliyse tab'a göre görünümü belirle
  if (currentGerceklestirmeciBelgelerProjeId) {
    // Onaylı/arşivlenmiş projeler için her zaman belgeler görünümü
    if (['onaylandi', 'arsivlendi'].includes(currentProjeStatus)) {
      currentGerceklestirmeciTab = 'belgeler';
    }
    if (currentGerceklestirmeciTab === 'belgeler') {
      renderGerceklestirmeciBelgelerView(main);
    } else {
      renderGerceklestirmeciProjeDetay(main);
    }
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
            <span class="ky-proje-user">&#128100; ${p.userDisplayName || '-'}</span>
            <span class="ky-proje-date">&#128197; ${tarih}</span>
            ${getStatusBadge(p.status)}
          </div>
        </div>
        <div class="ky-proje-actions">${btn}</div>
      </div>`;
    };

    if (aktif.length === 0 && onaylananlar.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:var(--gray-400)">
          <div style="font-size:48px;margin-bottom:16px">&#128196;</div>
          <div style="font-size:15px;font-weight:600;margin-bottom:8px">Henüz gönderilen proje yok</div>
          <div style="font-size:13px">Belgeler oluşturmak için size gönderilmiş bir proje bulunmalıdır.</div>
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

function renderGerceklestirmeciProjeDetay(main) {
  // Gerçekleştirme görevlisini oturum açan kullanıcıdan otomatik doldur
  if (!proje.gerceklestirmeGorevlisi?.ad) {
    proje.gerceklestirmeGorevlisi = {
      ad: currentDTMUser?.displayName || currentDTMUser?.username || '',
      unvan: currentDTMUser?.unvan || 'Gerçekleştirme Görevlisi'
    };
  }

  const isMiktariReadonly = proje.isTuru === 'Yapım İşi';
  const tutar = Number(proje.tahminiMaliyet || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 });

  main.innerHTML = `
    <div class="page-header" style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <button onclick="currentGerceklestirmeciBelgelerProjeId=null;renderPage();"
        style="background:none;border:1px solid var(--gray-300);border-radius:6px;padding:6px 12px;cursor:pointer;font-size:13px;color:var(--gray-600);white-space:nowrap;margin-top:4px">
        ← Proje Listesi
      </button>
      <div>
        <h2>📋 Proje Detayı</h2>
        <p style="display:flex;align-items:center;gap:8px">${proje.isAdi || ''} ${getStatusBadge(proje.status)}</p>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Proje Özeti</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label>İş Adı</label>
            <input type="text" value="${proje.isAdi || ''}" readonly style="background:#f9fafb">
          </div>
          <div class="form-group">
            <label>İş Türü</label>
            <input type="text" value="${proje.isTuru || ''}" readonly style="background:#f9fafb">
          </div>
          <div class="form-group">
            <label>Tahmini Maliyet (TL)</label>
            <input type="text" value="${tutar}" readonly style="background:#f9fafb">
          </div>
          <div class="form-group">
            <label>Birim</label>
            <input type="text" value="${proje.birim || ''}" readonly style="background:#f9fafb">
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:80px">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Onay Belgesi Bilgileri</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Kullanılabilir Ödenek Tutarı (TL)</label>
            <input type="number" id="gc_odenek" value="${proje.odenek || ''}" placeholder="0.00">
          </div>
          <div class="form-group">
            <label>Yatırım Proje Numarası</label>
            <input type="text" id="gc_yatirimProjeNo" value="${proje.yatirimProjeNo || ''}" placeholder="Varsa giriniz">
          </div>
          <div class="form-group">
            <label>Bütçe Tertibi</label>
            <select id="gc_butceTertibi">
              <option value="">-- Seçin --</option>
              ${(referans.butceTertibiList || []).map(bt => { const no = typeof bt === 'string' ? bt : bt.no; const ac = typeof bt === 'string' ? '' : bt.aciklama; return `<option value="${no}" ${proje.butceTertibi === no ? 'selected' : ''}>${no}${ac ? ' — ' + ac : ''}</option>`; }).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>İşin Miktarı</label>
            <input type="text" id="gc_isMiktari" value="${isMiktariReadonly ? '1 Adet' : (proje.isMiktari || '')}"
              ${isMiktariReadonly ? 'readonly style="background:#f3f4f6"' : ''} placeholder="Örn: 5 Adet">
          </div>
          <div class="form-group">
            <label>Avans Verilecek mi</label>
            <select id="gc_avansVar">
              <option value="Hayır" ${(proje.avansVar || 'Hayır') === 'Hayır' ? 'selected' : ''}>Hayır</option>
              <option value="Evet" ${proje.avansVar === 'Evet' ? 'selected' : ''}>Evet</option>
            </select>
          </div>
          <div class="form-group">
            <label>Fiyat Farkı Uygulanacak mı</label>
            <select id="gc_fiyatFarkiVar">
              <option value="Hayır" ${(proje.fiyatFarkiVar || 'Hayır') === 'Hayır' ? 'selected' : ''}>Hayır</option>
              <option value="Evet" ${proje.fiyatFarkiVar === 'Evet' ? 'selected' : ''}>Evet</option>
            </select>
          </div>
          <div class="form-group">
            <label>Şartname Düzenlenecek mi</label>
            <select id="gc_sartnameVar">
              <option value="Düzenlenecek" ${(proje.sartnameVar || 'Düzenlenecek') === 'Düzenlenecek' ? 'selected' : ''}>Düzenlenecek</option>
              <option value="Düzenlenmeyecek" ${proje.sartnameVar === 'Düzenlenmeyecek' ? 'selected' : ''}>Düzenlenmeyecek</option>
            </select>
          </div>
          <div class="form-group">
            <label>Sözleşme Düzenlenecek mi</label>
            <select id="gc_sozlesmeVar">
              <option value="Düzenlenecek" ${(proje.sozlesmeVar || 'Düzenlenecek') === 'Düzenlenecek' ? 'selected' : ''}>Düzenlenecek</option>
              <option value="Düzenlenmeyecek" ${proje.sozlesmeVar === 'Düzenlenmeyecek' ? 'selected' : ''}>Düzenlenmeyecek</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid #e5e7eb;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:100;box-shadow:0 -2px 8px rgba(0,0,0,0.06)">
      <button class="btn btn-primary" onclick="gcOnayBilgiKaydet()">💾 Kaydet</button>
      <button class="btn btn-secondary" onclick="currentGerceklestirmeciTab='belgeler';renderPage();">📄 Belgeleri Görüntüle →</button>
    </div>
  `;
}

function renderGerceklestirmeciBelgelerView(main) {
  // Gerçekleştirme görevlisini oturum açan kullanıcıdan otomatik doldur
  if (!proje.gerceklestirmeGorevlisi?.ad) {
    proje.gerceklestirmeGorevlisi = {
      ad: currentDTMUser?.displayName || currentDTMUser?.username || '',
      unvan: currentDTMUser?.unvan || 'Gerçekleştirme Görevlisi'
    };
  }

  const belgeler = [
    { id: 'dt-onay-belgesi', ad: 'D.T. Onay Belgesi' },
    { id: 'yaklasik-maliyet', ad: 'Yaklaşık Maliyet' },
    { id: 'teklif-tutanagi', ad: 'Teklif Tutanağı' },
    { id: 'sozlesme', ad: 'Sözleşme' },
    { id: 'bitti-tutanagi', ad: 'Bitti Tutanağı' },
    { id: 'hakedis-raporu', ad: 'Hakediş Raporu' }
  ];

  const tabs = belgeler.map(b =>
    `<div class="belge-tab ${currentGerceklestirmeciBelge === b.id ? 'active' : ''}"
      onclick="currentGerceklestirmeciBelge='${b.id}';renderPage();">${b.ad}</div>`
  ).join('');

  let belgeHTML = '';
  switch (currentGerceklestirmeciBelge) {
    case 'dt-onay-belgesi': belgeHTML = renderDogrudanTeminOnayBelgesi(proje); break;
    case 'yaklasik-maliyet': belgeHTML = renderYaklasikMaliyet(proje, referans); break;
    case 'teklif-tutanagi': belgeHTML = renderTeklifTutanagi(proje, referans); break;
    case 'sozlesme': belgeHTML = renderSozlesme(proje, referans); break;
    case 'bitti-tutanagi': belgeHTML = renderBittiTutanagi(proje, referans); break;
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
        <p style="display:flex;align-items:center;gap:8px">${proje.isAdi || ''} ${getStatusBadge(currentProjeStatus || 'onaylandi')}</p>
      </div>
    </div>
    <div class="belge-tabs">${tabs}</div>
    <div class="action-bar">
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
    case 'sozlesme': html = renderSozlesme(proje, referans); belgeYazdir(html, false, true); return;
    case 'bitti-tutanagi': html = renderBittiTutanagi(proje, referans); break;
    case 'hakedis-raporu': html = renderHakedisRaporu(proje, referans); break;
  }
  belgeYazdir(html, landscape);
}

function gerceklestirmeciBelgePdfIndir() {
  const belgeAdlari = {
    'dt-onay-belgesi': 'DT Onay Belgesi',
    'yaklasik-maliyet': 'Yaklaşık Maliyet Tutanağı',
    'teklif-tutanagi': 'Teklif Tutanağı',
    'sozlesme': 'Sözleşme',
    'bitti-tutanagi': 'Bitti Tutanağı',
    'hakedis-raporu': 'Hakediş Raporu'
  };
  let html = '';
  let landscape = false;
  let sozlesme = false;
  switch (currentGerceklestirmeciBelge) {
    case 'dt-onay-belgesi':  html = renderDogrudanTeminOnayBelgesi(proje);  break;
    case 'yaklasik-maliyet': html = renderYaklasikMaliyet(proje, referans); landscape = true; break;
    case 'teklif-tutanagi':  html = renderTeklifTutanagi(proje, referans);  landscape = true; break;
    case 'sozlesme':         html = renderSozlesme(proje, referans);        sozlesme = true;  break;
    case 'bitti-tutanagi':   html = renderBittiTutanagi(proje, referans);   break;
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
  const kdvTutar = sozlesmeKdvsiz * (p.kdvOrani / 100);
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
        ${satir('Sözleşme Tutarı (KDV Hariç)', sozlesmeKdvsiz > 0 ? formatCurrency(sozlesmeKdvsiz) + ' TL' : '')}
        ${satir('KDV Tutarı (%' + p.kdvOrani + ')', kdvTutar > 0 ? formatCurrency(kdvTutar) + ' TL' : '')}
        ${satir('Sözleşme Tutarı (KDV Dahil)', sozlesmeToplamKdvli > 0 ? formatCurrency(sozlesmeToplamKdvli) + ' TL' : '')}
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
          <div style="font-size:12px;color:#6b7280;margin-top:2px">${proje.isAdi || '(İsimsiz Proje)'}</div>
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
    }).catch(() => {});
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
        listeEl.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--gray-400)">
          <div style="font-size:40px;margin-bottom:12px">${aktifSekme==='arsiv'?'🗃️':'📥'}</div>
          <div style="font-size:14px;font-weight:600;color:var(--gray-500)">${ara?'Arama ile eşleşen proje bulunamadı.':aktifSekme==='arsiv'?'Arşivde proje yok.':'İşlem bekleyen proje yok.'}</div>
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
    <div style="max-width:600px;margin:0 auto">
      <div class="page-header">
        <h2>Profilim</h2>
        <p>Hesap bilgilerinizi görüntüleyin ve yönetin.</p>
      </div>

      <!-- Profil Kartı -->
      <div style="background:linear-gradient(135deg,#0f766e,#059669);border-radius:16px;padding:28px;color:#fff;margin-bottom:20px;position:relative;overflow:hidden">
        <div style="position:absolute;top:-40px;right:-40px;width:150px;height:150px;background:rgba(255,255,255,0.06);border-radius:50%"></div>
        <div style="display:flex;align-items:center;gap:20px">
          <!-- Avatar - hover ile düzenle -->
          <div onclick="openAvatarPicker()" title="Profil resmini değiştir"
               onmouseover="document.getElementById('avatarEditOverlay').style.opacity='1'"
               onmouseout="document.getElementById('avatarEditOverlay').style.opacity='0'"
               style="position:relative;width:72px;height:72px;cursor:pointer;flex-shrink:0">
            <div id="profilAvatarCircle" style="width:72px;height:72px;background:rgba(255,255,255,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;overflow:hidden;border:2px solid rgba(255,255,255,0.3)">
              ${u.avatar
                ? `<img src="icons/avatars/${u.avatar}.png" style="width:100%;height:100%;object-fit:cover" />`
                : '&#128100;'}
            </div>
            <div id="avatarEditOverlay" style="position:absolute;inset:0;background:rgba(0,0,0,0.5);border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.15s;pointer-events:none">
              <span style="font-size:20px">&#9998;</span>
            </div>
          </div>
          <div>
            <div style="font-size:22px;font-weight:700">${u.displayName || '-'}</div>
            <div style="font-size:14px;opacity:0.8;margin-top:4px">@${u.username || '-'}</div>
            <div style="margin-top:8px">
              <span style="background:rgba(255,255,255,0.2);font-size:11px;font-weight:600;padding:3px 12px;border-radius:20px">
                ${getRoleLabel(u.role)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Avatar Seçici Modal -->
      <div id="avatarPickerModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;align-items:center;justify-content:center">
        <div style="background:#fff;border-radius:14px;padding:24px;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.2)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="font-size:15px;font-weight:700;color:#1f2937">&#128247; Profil Resmi Seç</h3>
            <button onclick="closeAvatarPicker()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af;line-height:1;padding:0 4px">&times;</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px">
            ${AVATARS.map(a => `
              <div onclick="avatarSec('${a}')" style="cursor:pointer;border-radius:50%;overflow:hidden;width:48px;height:48px;border:3px solid ${u.avatar===a ? '#0f766e' : 'transparent'};transition:border-color .15s;margin:auto" id="avatarOpt_${a}">
                <img src="icons/avatars/${a}.png" style="width:100%;height:100%" />
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Bilgi Kartı -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><h3>&#128203; Hesap Bilgileri</h3></div>
        <div class="card-body">
          <table class="data-table">
            <tbody>
              <tr><td style="color:var(--gray-500);width:160px">Ad Soyad</td><td><strong>${u.displayName || '-'}</strong></td></tr>
              <tr><td style="color:var(--gray-500)">Kullanıcı Adı</td><td>${u.username || '-'}</td></tr>
              <tr><td style="color:var(--gray-500)">Rol</td><td>${getRoleLabel(u.role)}</td></tr>
              <tr><td style="color:var(--gray-500)">Son Giriş</td><td>${lastLogin}</td></tr>
              <tr><td style="color:var(--gray-500)">Hesap Oluşturma</td><td>${createdAt}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Şifre Değiştir -->
      <div class="card">
        <div class="card-header"><h3>&#128274; Şifre Değiştir</h3></div>
        <div class="card-body">
          <div class="form-group">
            <label>Mevcut Şifre</label>
            <input type="password" id="mevcutSifre" placeholder="Mevcut şifrenizi girin">
          </div>
          <div class="form-group">
            <label>Yeni Şifre</label>
            <input type="password" id="yeniSifre" placeholder="En az 6 karakter">
          </div>
          <div class="form-group">
            <label>Yeni Şifre (Tekrar)</label>
            <input type="password" id="yeniSifreTekrar" placeholder="Yeni şifrenizi tekrar girin">
          </div>
          <div id="sifreMsg" style="font-size:13px;margin-bottom:10px"></div>
          <button class="btn btn-primary" onclick="sifreDegistir()">Şifreyi Güncelle</button>
        </div>
      </div>
    </div>
  `;
}

function bindProfil() {}

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
      if (el) el.style.borderColor = a === avatarName ? '#0f766e' : 'transparent';
    });
    closeAvatarPicker();
    updateSidebarAvatar();
    showToast('Profil resmi güncellendi.', 'success');
  } catch (e) {
    showToast('Güncelleme başarısız: ' + e.message, 'error');
  }
}

async function sifreDegistir() {
  const mevcut = document.getElementById('mevcutSifre').value;
  const yeni = document.getElementById('yeniSifre').value;
  const tekrar = document.getElementById('yeniSifreTekrar').value;
  const msg = document.getElementById('sifreMsg');

  if (!mevcut || !yeni || !tekrar) { msg.style.color = 'red'; msg.textContent = 'Tüm alanları doldurun.'; return; }
  if (yeni.length < 6) { msg.style.color = 'red'; msg.textContent = 'Yeni şifre en az 6 karakter olmalı.'; return; }
  if (yeni !== tekrar) { msg.style.color = 'red'; msg.textContent = 'Yeni şifreler eşleşmiyor.'; return; }

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
          <button class="btn btn-primary" onclick="duyuruOlustur()">Yayınla</button>
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
                  ${d.baslik}
                </div>
                <div class="duyuru-meta">${d.createdBy} &middot; ${tarih}</div>
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

async function duyuruOlustur() {
  const baslik = document.getElementById('duyuruBaslik').value.trim();
  const mesaj = document.getElementById('duyuruMesaj').value.trim();
  const msg = document.getElementById('duyuruMsg');
  if (!baslik || !mesaj) { msg.style.color = 'red'; msg.textContent = 'Başlık ve mesaj zorunlu.'; return; }
  try {
    await createDuyuru(baslik, mesaj);
    msg.style.color = 'green'; msg.textContent = 'Duyuru yayınlandı!';
    document.getElementById('duyuruBaslik').value = '';
    document.getElementById('duyuruMesaj').value = '';
    renderDuyurularPage();
  } catch(e) { msg.style.color = 'red'; msg.textContent = 'Hata: ' + e.message; }
}

async function duyuruOku(duyuruId) {
  try {
    await duyuruOkunduIsaretle(duyuruId);
    okunmamiDuyuruSayisi = Math.max(0, okunmamiDuyuruSayisi - 1);
    updateDuyuruBadge();
    renderDuyurularPage();
  } catch(e) { showToast('Hata: ' + e.message, 'error'); }
}

async function duyuruSil(duyuruId) {
  if (!await showConfirm('Bu duyuru silinecek. Emin misiniz?', 'Sil')) return;
  try {
    await deleteDuyuru(duyuruId);
    renderDuyurularPage();
  } catch(e) { showToast('Hata: ' + e.message, 'error'); }
}

