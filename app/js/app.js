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
let topluSecilenDosyalar = [];
let topluGrupluDosyalar = { olur: [], ym: [], dt: [] };

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
  // Renkler ve etiketler data.js'teki IS_TURLERI listesinden gelir
  const tanim = getIsTuruTanim(isTuru) || IS_TURLERI[0];
  const t = tanim.rozet;
  return `<span style="font-size:11px;background:${t.bg};color:${t.color};border:1px solid ${t.border};padding:2px 8px;border-radius:5px;font-weight:600;display:inline-flex;align-items:center;gap:3px">🏷️ ${escHtml(tanim.ad)}</span>`;
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
  const iconSpan = document.createElement('span');
  iconSpan.style.cssText = 'font-size:16px;font-weight:700;display:inline-flex;align-items:center;flex-shrink:0;';
  iconSpan.innerHTML = r.icon;
  const msgSpan = document.createElement('span');
  msgSpan.textContent = mesaj;
  toast.appendChild(iconSpan);
  toast.appendChild(msgSpan);
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
          <p style="margin:0 0 14px;white-space:pre-line">${escHtml(baslik)}</p>
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

// Ortak belge indir modalı. dtOnayBelgesi=true iken listeye D.T. Onay Belgesi
// de eklenir (gerçekleştirmeci görünümü); onIndir seçilen belge id'leriyle
// çağrılan asıl indirme/yazdırma fonksiyonudur.
function belgeIndirModalAc(guard, dtOnayBelgesi, onIndir) {
  if (!proje || !guard) return;
  if (!belgeHesaplamaKontrol(proje, referans)) return;

  const mevcut = document.getElementById('dtmBelgeIndirModal');
  if (mevcut) mevcut.remove();

  const isMalVeyaHizmet = isMalVeyaHizmetTuru(proje.isTuru);
  const sonTutanakId = isMalVeyaHizmet ? 'muayene-kabul' : 'bitti-tutanagi';
  const sonTutanakAd = isMalVeyaHizmet ? 'Muayene ve Kabul' : 'Bitti Tutanağı';

  const belgeler = [
    ...(dtOnayBelgesi ? [{ id: 'dt-onay-belgesi', ad: 'D.T. Onay Belgesi', excel: false, word: true }] : []),
    { id: 'yaklasik-maliyet', ad: 'Yaklaşık Maliyet', excel: true, word: false },
    { id: 'teklif-tutanagi', ad: 'Teklif Tutanağı', excel: true, word: false },
    { id: 'teknik-sartname', ad: 'Teknik Şartname', excel: false, word: true },
    ...(isMalVeyaHizmet ? [] : [{ id: 'sozlesme', ad: 'Sözleşme', excel: false, word: true }]),
    { id: sonTutanakId, ad: sonTutanakAd, excel: false, word: true },
    { id: 'hakedis-raporu', ad: 'Hakediş Raporu', excel: false, word: true }
  ];

  const checkboxler = belgeler.map(b => `
    <label style="display:flex;align-items:center;gap:10px;padding:9px 0;cursor:pointer;border-bottom:1px solid var(--gray-100);">
      <input type="checkbox" class="belge-indir-cb" value="${escAttr(b.id)}" data-excel="${b.excel}" data-word="${b.word}" checked
        style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary)">
      <span style="font-size:14px;color:var(--gray-800);flex:1">${b.ad}</span>
      <span style="font-size:10px;background:#ef4444;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600">PDF</span>
    </label>`).join('');

  const overlay = document.createElement('div');
  overlay.id = 'dtmBelgeIndirModal';
  overlay.className = 'dtm-modal-overlay';
  overlay.innerHTML = `
    <div class="dtm-modal" style="max-width:460px">
      <div class="dtm-modal-header">
        <h3>&#128196; Belge ve İhale Dosyası İndir (PDF)</h3>
      </div>
      <div class="dtm-modal-body">
        <p style="margin:0 0 14px;font-size:13px;color:var(--gray-500)">İndirilecek belgeleri işaretleyin</p>
        <label style="display:flex;align-items:center;gap:10px;padding:9px 0;cursor:pointer;border-bottom:2px solid var(--gray-200);margin-bottom:2px;font-weight:600;">
          <input type="checkbox" id="hepsiniSecCb" checked
            style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary)">
          <span style="font-size:14px;color:var(--gray-700)">Tümünü Seç</span>
        </label>
        ${checkboxler}
        <div style="margin-top:14px;padding:10px 12px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div style="font-size:12px;color:#5b21b6;line-height:1.35">
            <strong>📦 Tek Tıkla İhale Dosyası (ZIP):</strong> Seçili resmi tutanakları ve yüklenen tüm proje evraklarını (Fatura, Vergi, Fotoğraf vb.) <strong>tamamı PDF formatında</strong> klasörlenmiş tek ZIP olarak indirir.
          </div>
          <button id="dtmBelgeIndirIhaleZip" class="btn" style="background:#7c3aed;color:#fff;white-space:nowrap;flex-shrink:0;padding:8px 12px;font-size:12.5px;font-weight:700">&#128230; İhale ZIP (PDF)</button>
        </div>
      </div>
      <div class="dtm-modal-footer">
        <button id="dtmBelgeIndirIptal" class="btn btn-outline">İptal</button>
        <button id="dtmBelgeIndirOnay" class="btn btn-primary">&#128196; PDF İndir</button>
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

  document.getElementById('dtmBelgeIndirIhaleZip').onclick = async () => {
    const secilen = [...overlay.querySelectorAll('.belge-indir-cb:checked')].map(cb => cb.value);
    if (!secilen.length) { showToast('En az bir belge seçin', 'warning'); return; }
    overlay.remove();
    await ihaleDosyasiZipIndir(dtOnayBelgesi, secilen);
  };

  document.getElementById('dtmBelgeIndirOnay').onclick = async () => {
    const secilen = [...overlay.querySelectorAll('.belge-indir-cb:checked')].map(cb => cb.value);
    if (!secilen.length) { showToast('En az bir belge seçin', 'warning'); return; }
    overlay.remove();
    await onIndir(secilen);
  };
}

// ── Tek Tıkla İhale Dosyası (ZIP - Tamamı PDF) İndir ──
// Projenin tüm resmi tutanaklarını (.pdf) + Dokümanlar arşivindeki
// yüklenmiş evrakları (Fotoğraflar, Fatura, Vergi Borcu Yoktur, Diğer Belgeler - tamamı .pdf olarak)
// düzenli klasör yapısıyla tek bir .zip paketi halinde indirir.
window.ihaleDosyasiZipIndir = async function(dtOnayDahil = false, secilenBelgeIdleri = null) {
  if (!proje) {
    showToast('Aktif proje bulunamadı.', 'warning');
    return;
  }
  if (!belgeHesaplamaKontrol(proje, referans)) return;

  try {
    showToast('📦 İhale dosyası (PDF belgeleri) hazırlanıyor, lütfen bekleyin...', 'info', 5000);

    const isMalVeyaHizmet = isMalVeyaHizmetTuru(proje.isTuru);
    const sonTutanakId = isMalVeyaHizmet ? 'muayene-kabul' : 'bitti-tutanagi';
    const dtOnayOlsunMu = Boolean(dtOnayDahil || proje.dtOnayNo || proje.odenek || proje.butceTertibi);

    const varsayilanSiraliBelgeler = [
      ...(dtOnayOlsunMu ? ['dt-onay-belgesi'] : []),
      'yaklasik-maliyet',
      'teklif-tutanagi',
      'teknik-sartname',
      ...(isMalVeyaHizmet ? [] : ['sozlesme']),
      sonTutanakId,
      'hakedis-raporu'
    ];

    const hedefBelgeler = Array.isArray(secilenBelgeIdleri) && secilenBelgeIdleri.length > 0
      ? secilenBelgeIdleri
      : varsayilanSiraliBelgeler;

    const zipGirdileri = [];
    let resmiBelgeSayisi = 0;

    for (let idx = 0; idx < hedefBelgeler.length; idx++) {
      const belgeId = hedefBelgeler[idx];
      const siraPrefix = String(idx + 1).padStart(2, '0');
      const uretilen = await belgeIdindenPdfVerisiUret(belgeId, proje, referans);
      if (uretilen && uretilen.bytes && uretilen.dosyaAdi) {
        const temizDosyaAdi = `${siraPrefix}_${uretilen.dosyaAdi.replace(/\.pdf$/i, '')}.pdf`;
        zipGirdileri.push({
          ad: temizDosyaAdi,
          zipYolu: `01_Resmi_Tutanak_ve_Belgeler/${temizDosyaAdi}`,
          bytes: uretilen.bytes
        });
        resmiBelgeSayisi++;
      }
    }

    // Projeye yüklenmiş ek evrakları (Dokümanlar arşivi) da PDF olarak ZIP'e dahil et
    const aktifProjeId = currentBelgelerProjeId || currentGerceklestirmeciBelgelerProjeId || currentCloudProjeId;
    if (aktifProjeId && typeof projeDosyalariGetir === 'function') {
      try {
        const bulutDosyalar = await projeDosyalariGetir(aktifProjeId);
        window._projeDosyalariCache = {};
        bulutDosyalar.forEach(d => { window._projeDosyalariCache[d.docId] = d; });
        window._sonProjeDosyalariListesi = bulutDosyalar;
      } catch (err) {
        console.warn('Bulut evrakları ZIP için alınamadı:', err);
      }
    }

    const ekKayitlar = typeof tumNormalizedDokumanKayitlariniGetir === 'function'
      ? tumNormalizedDokumanKayitlariniGetir()
      : [];

    const ekKlasorMap = {
      fatura: '02_Fatura',
      vergi: '03_Vergi_Borcu_Yoktur',
      fotograf: '04_Fotograflar',
      diger: '05_Diger_Belgeler'
    };

    let ekEvrakSayisi = 0;
    const kullanilanYollar = new Set(zipGirdileri.map(g => g.zipYolu));

    for (const kayit of ekKayitlar) {
      try {
        const veri = await cozDokumanKaydiVerisi(kayit);
        const klasor = ekKlasorMap[kayit.kategoriKod] || '05_Diger_Belgeler';
        const isPdf = /\.pdf$/i.test(veri.temizAd) || veri.mime === 'application/pdf';
        const isGorsel = dokumanGoruntuMu(veri.temizAd, veri.mime) || (veri.dataUrl && veri.dataUrl.startsWith('data:image/'));

        let pdfBytes = null;
        const tabanAd = veri.temizAd.replace(/\.[^.]+$/, '') || 'Evrak';
        const pdfDosyaAdi = `${tabanAd}.pdf`;

        if (isPdf) {
          pdfBytes = veri.bytes;
        } else if (isGorsel && typeof gorselDataUrlToPdfBytes === 'function') {
          pdfBytes = await gorselDataUrlToPdfBytes(veri.dataUrl, tabanAd);
        } else {
          // Word/Excel vb. bozuk çıkmaması için ZIP'e yalnızca PDF formatındaki belgeler alınır
          continue;
        }

        if (!pdfBytes || !pdfBytes.length) continue;

        let adayYol = `${klasor}/${pdfDosyaAdi}`;
        let sayac = 2;
        while (kullanilanYollar.has(adayYol)) {
          adayYol = `${klasor}/${tabanAd}_${sayac}.pdf`;
          sayac++;
        }
        kullanilanYollar.add(adayYol);
        zipGirdileri.push({
          ad: pdfDosyaAdi,
          zipYolu: adayYol,
          bytes: pdfBytes
        });
        ekEvrakSayisi++;
      } catch (err) {
        console.warn('Evrak ZIP paketine eklenemedi:', kayit?.temizAd, err);
      }
    }

    if (zipGirdileri.length === 0) {
      showToast('İndirilecek PDF belgesi oluşturulamadı.', 'warning');
      return;
    }

    const zipBlob = olusturProjeDokumanZipBlob(zipGirdileri);
    const projeAdTemiz = String(proje.isAdi || 'Proje')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, '_')
      .slice(0, 50)
      .replace(/^_+|_+$/g, '') || 'Proje';

    tetikleBlobIndirme(zipBlob, `Ihale_Dosyasi_${projeAdTemiz}.zip`);
    const detayMetin = ekEvrakSayisi > 0
      ? `${resmiBelgeSayisi} resmi PDF tutanak + ${ekEvrakSayisi} PDF ek evrak`
      : `${resmiBelgeSayisi} resmi PDF tutanak`;
    showToast(`📦 İhale dosyası (${detayMetin}) ZIP olarak indirildi!`, 'success', 4500);
  } catch (e) {
    showToast('İhale ZIP oluşturma hatası: ' + (e.message || e), 'error');
  }
};

function acBelgeIndirModal() {
  belgeIndirModalAc(currentBelgelerProjeId, false, cokluBelgeIndir);
}

function acGerceklestirmeciIndirModal() {
  belgeIndirModalAc(currentGerceklestirmeciBelgelerProjeId, true, cokluGerceklestirmeciBelgeIndir);
}

// Ortak: proje belgeleri render eşlemesi. dtOnayBelgesi=true iken D.T. Onay
// Belgesi de eşlemeye eklenir (gerçekleştirmeci görünümünde kullanılır).
function belgeMapOlustur(dtOnayBelgesi) {
  const map = {
    'yaklasik-maliyet': { render: () => renderYaklasikMaliyet(proje, referans), landscape: true },
    'teklif-tutanagi':  { render: () => renderTeklifTutanagi(proje, referans), landscape: true },
    'teknik-sartname':  { render: () => renderTeknikSartname(proje, referans), landscape: false },
    'sozlesme':         { render: () => renderSozlesme(proje, referans), landscape: false, sozlesme: true },
    'bitti-tutanagi':   { render: () => renderBittiTutanagi(proje, referans), landscape: false },
    'muayene-kabul':    { render: () => renderMuayeneKabulTutanagi(proje, referans), landscape: false },
    'hakedis-raporu':   { render: () => renderHakedisRaporu(proje, referans), landscape: false }
  };
  if (dtOnayBelgesi) map['dt-onay-belgesi'] = { render: () => renderDogrudanTeminOnayBelgesi(proje), landscape: false };
  return map;
}

// Ortak: seçilen belgeleri tek bir yazdırma penceresinde birleştirip açar.
function belgeleriYazdirPenceresiAc(secilen, dtOnayBelgesi) {
  if (!belgeHesaplamaKontrol(proje, referans)) return;
  const belgeMap = belgeMapOlustur(dtOnayBelgesi);

  const parts = [];
  for (const belgeId of secilen) {
    const b = belgeMap[belgeId];
    if (!b) continue;
    parts.push({ html: b.render(), landscape: b.landscape || false, sozlesme: b.sozlesme || false });
  }
  if (!parts.length) return;

  const win = window.open('', '_blank');
  if (!win) { showToast('Açılır pencere engellendi. Tarayıcı ayarlarından izin verin.', 'error'); return; }

  const sections = parts.map(b => {
    const sinif = b.sozlesme ? 'pg-sozlesme' : (b.landscape ? 'pg-yatay' : 'pg-dikey');
    return `<div class="belge-bolum ${sinif}">${b.html}</div>`;
  }).join('');

  const css = `
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: "Times New Roman", serif; font-size:9pt; color:#000; background:#fff; }
    .belge-bolum { padding:10mm 14mm; }
    .pg-yatay { padding:8mm 10mm; }
    .pg-sozlesme { padding:10mm 25mm 20mm 25mm; }
    .belge { width:100%; }
    ${belgeOrtakCSS()}
    @page dikey  { size: A4 portrait;  margin: 10mm 14mm; }
    @page yatay  { size: A4 landscape; margin: 8mm 10mm; }
    @page sozlesmesayfa { size: A4 portrait; margin: 10mm 25mm 20mm 25mm; }
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
      /* Sözleşme, resmi Word şablonuyla eşit kenar boşluğu ve %100 ölçek kullanır */
      .pg-sozlesme { page: sozlesmesayfa; break-before: page; zoom: 1; }
      .pg-dikey:first-child, .pg-yatay:first-child, .pg-sozlesme:first-child { break-before: avoid; }
      ${belgeSayfalamaCSS()}
    }`;

  win.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${escHtml(proje.isAdi || 'Belgeler')}</title><style>${css}</style></head><body>${sections}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 800);
}

async function cokluBelgeIndir(secilen) {
  if (!proje || !currentBelgelerProjeId) { showToast('Proje bulunamadı', 'error'); return; }
  belgeleriYazdirPenceresiAc(secilen, false);
}

function cokluGerceklestirmeciBelgeIndir(secilen) {
  if (!proje || !currentGerceklestirmeciBelgelerProjeId) return;
  belgeleriYazdirPenceresiAc(secilen, true);
}

const AVATARS = [
  'avatar1','avatar2','avatar3','avatar4','avatar5','avatar6'
];

function avatarSrc(name) {
  return (name && AVATARS.includes(name)) ? `icons/avatars/${name}.png` : null;
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
let loginFormPending = false;
async function doLogin() {
  if (loginFormPending) return;
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  const errDiv = document.getElementById('loginError');
  if (!username || !password) { showLoginError('Kullanıcı adı/e-posta ve şifre gerekli.'); return; }
  btn.disabled = true;
  btn.innerHTML = '<span>Giriş yapılıyor...</span>';
  errDiv.style.display = 'none';
  try {
    loginFormPending = true;
    await dtmLogin(username, password, document.getElementById('loginRegisteredEmail')?.value || '');
    await onAuthReady(auth.currentUser);
  } catch(e) {
    // Ağ/sistem hatası: spesifik mesaj. Kimlik hatası: generic mesaj (güvenlik).
    const ozelKodlar = ['auth/network-request-failed', 'auth/too-many-requests', 'auth/requires-recent-login'];
    if (e?.code === 'dtm/email-required') {
      document.getElementById('loginEmailField').style.display = '';
      document.getElementById('loginRegisteredEmail').focus();
    }
    const mesaj = e?.code === 'dtm/email-required' ? e.message :
      ozelKodlar.includes(e?.code) ? hataMesaji(e) : 'Kullanıcı adı/e-posta veya şifre hatalı.';
    showLoginError(mesaj);
  } finally {
    loginFormPending = false;
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
  if (input) input.value = (loginUser && loginUser.includes('@')) ? loginUser : '';
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
      msg.textContent = 'Lütfen kayıtlı e-posta adresinizi giriniz.';
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

// Rol bazlı periyodik kontrollerin interval ID'leri — çıkış/giriş arasında
// eskilerinin temizlenmemesi, aynı taramanın üst üste binerek gereksiz
// Firestore okuması yapmasına yol açıyordu.
let rolIntervalIds = [];
function rolIntervallariTemizle() {
  rolIntervalIds.forEach(id => clearInterval(id));
  rolIntervalIds = [];
}

async function onAuthReady(user) {
  const lo = document.getElementById('loadingOverlay');
  if (lo) lo.style.display = 'none';
  rolIntervallariTemizle();
  if (user && currentDTMUser) {
    // Referansı buluttan yükle (kullanıcı + global)
    try {
      const [cloudRef, globalRef] = await Promise.all([
        loadReferansFromCloud(),
        loadGlobalReferansFromCloud().catch(() => null)
      ]);
      referans = Object.assign(getDefaultReferans(), cloudRef || {});
      // İş türleri listesi kullanıcıya özel değildir; buluttaki eski kayıt
      // yeni eklenen türleri (örn. Onarım İşi) içermeyebileceği için her
      // zaman kod içindeki güncel listeyle değiştirilir.
      referans.isTurleri = IS_TURU_ADLARI.slice();
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
      rolIntervalIds.push(setInterval(checkGonderilenProjeler, 30000));
    }
    if (['admin', 'superadmin'].includes(currentDTMUser.role)) {
      checkOnayliProjeler();
      rolIntervalIds.push(setInterval(checkOnayliProjeler, 30000));
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
  document.getElementById('loginRegisteredEmail')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  // Firebase auth state dinleyici
  auth.onAuthStateChanged(async user => {
    if (loginFormPending) return;
    if (user) {
      if (!currentDTMUser) {
        const snap = await db.collection('users').doc(user.uid).get();
        if (snap.exists) currentDTMUser = { uid: user.uid, ...snap.data() };
      }
      if (currentDTMUser) {
        db.collection('publicUsers').doc(user.uid).set({
          uid: user.uid,
          displayName: currentDTMUser.displayName || '',
          role: currentDTMUser.role || 'user'
        }, { merge: true }).catch(() => {});

        // Yönetici açtığında tüm kullanıcı listesini publicUsers ile otomatik senkronize et
        if (['admin', 'superadmin'].includes(currentDTMUser.role)) {
          getAllUsers().catch(() => {});
        }
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
    if (item.dataset.dtmNavBound === 'true') return;
    item.dataset.dtmNavBound = 'true';
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
      if (targetPage === 'dokumanlar') {
        currentBelge = 'dokumanlar';
        if (currentCloudProjeId && !currentBelgelerProjeId) {
          currentBelgelerProjeId = currentCloudProjeId;
        }
      }
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
    case 'dokumanlar':
      currentBelge = 'dokumanlar';
      renderBelgelerPage();
      break;
    case 'veri-merkezi': main.innerHTML = renderVeriMerkeziPage(); break;
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

// Karşılama ekranında gösterilecek ismi belirler. Sadece ilk kelimeyi almak,
// isim "M. Asım" gibi tek harfli bir kısaltmayla başlıyorsa "M.!" gibi eksik
// bir selamlamaya yol açıyordu — bu durumda bir sonraki kelime de eklenir.
function karsilamaAdi(displayName) {
  if (!displayName) return 'Hoş Geldiniz';
  const parcalar = displayName.trim().split(/\s+/).filter(Boolean);
  if (parcalar.length > 1 && parcalar[0].replace('.', '').length <= 1) {
    return parcalar[0] + ' ' + parcalar[1];
  }
  return parcalar[0] || 'Hoş Geldiniz';
}

// ===================== ANA SAYFA =====================
async function renderAnaSayfaPage() {
  const main = document.getElementById('mainContent');
  const ad = karsilamaAdi(currentDTMUser?.displayName);
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
        <h1 style="font-size:26px;font-weight:700;color:var(--gray-800);margin-bottom:6px">${selamlama}, ${escHtml(ad)}!</h1>
        <p style="color:var(--gray-500);font-size:14px">Doğrudan Temin Modülü'ne Hoş Geldiniz.</p>
      </div>

      ${roleInfo ? `
      <div class="home-role-card" style="margin-bottom:32px">
        <div style="margin-bottom:12px;color:var(--primary);display:flex;justify-content:center">${roleInfo.icon}</div>
        <p style="color:var(--gray-700);font-size:14px;line-height:1.6">${roleInfo.mesaj}</p>
      </div>` : `
      <div class="home-action-grid">
        <div class="home-action-card primary" ${dtmEventAttr('click', function(event) { yeniProjeBaslat() })}>
          <div style="margin-bottom:10px;display:flex;justify-content:center">${typeof getIcon === 'function' ? getIcon('plusCircle', 36) : '📋'}</div>
          <div style="font-weight:700;font-size:16px;margin-bottom:4px">Yeni Proje</div>
          <div style="font-size:12px;opacity:0.85">Yeni bir proje oluştur</div>
        </div>
        <div class="home-action-card outline" ${dtmEventAttr('click', function(event) { projeAcSayfasinaGit() })}>
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
    <div id="yeniProjeModal" ${dtmEventAttr('click', function(event) { if (event.target === this) kapatYeniProjeModal(); })} style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;align-items:center;justify-content:center">
      <div style="background:#fff;border-radius:12px;padding:28px 32px;width:540px;max-width:94vw;box-shadow:0 20px 60px rgba(0,0,0,0.2);max-height:90vh;overflow-y:auto;position:relative">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:18px;color:var(--gray-800)">📋 Yeni Proje Oluştur</h3>
            <p style="margin:0;font-size:13px;color:var(--gray-500)">Nasıl oluşturmak istersiniz?</p>
          </div>
          <button type="button" ${dtmEventAttr('click', function(event) { kapatYeniProjeModal(); })} title="Kapat" style="background:#f1f5f9;border:1px solid #e2e8f0;color:var(--gray-600);width:32px;height:32px;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1">✕</button>
        </div>

        <!-- Adım 1: Seçim -->
        <div id="yeniProjeAdim1" style="display:flex;flex-direction:column;gap:12px">
          <button ${dtmEventAttr('click', function(event) { acYeniProjeTopluAdim() })}
            style="padding:16px;border:2px solid #3b82f6;border-radius:10px;background:#f0f7ff;cursor:pointer;text-align:left;font-size:14px;transition:all 0.15s"
            ${dtmEventAttr('mouseover', function(event) { this.style.borderColor='#1d4ed8';this.style.background='#e0f0fe' })} ${dtmEventAttr('mouseout', function(event) { this.style.borderColor='#3b82f6';this.style.background='#f0f7ff' })}>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div style="font-weight:700;color:#1e40af;font-size:15px">⚡ Tüm Belgeleri Yükle</div>
              <span style="background:#2563eb;color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px">Önerilen</span>
            </div>
            <div style="font-size:12px;color:#1d4ed8;margin-top:4px">Olur belgesi ve firma teklif mektuplarını tek seferde yükleyerek projeyi otomatik oluşturun</div>
          </button>
          <button ${dtmEventAttr('click', function(event) { document.getElementById('yeniProjeAdim1').style.display='none';document.getElementById('yeniProjeAdim2Manuel').style.display='block';setTimeout(()=>document.getElementById('yeniProjeAdi')?.focus(),50) })}
            style="padding:16px;border:2px solid var(--gray-200);border-radius:10px;background:#fff;cursor:pointer;text-align:left;font-size:14px;transition:border-color 0.15s"
            ${dtmEventAttr('mouseover', function(event) { this.style.borderColor='var(--primary)' })} ${dtmEventAttr('mouseout', function(event) { this.style.borderColor='var(--gray-200)' })}>
            <div style="font-weight:600;color:var(--gray-800)">✏️ Manuel Oluştur</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:4px">İş adını kendiniz yazarak başlayın</div>
          </button>
          <button ${dtmEventAttr('click', function(event) { document.getElementById('yeniProjeAdim1').style.display='none';document.getElementById('yeniProjeAdim2Olur').style.display='block' })}
            style="padding:16px;border:2px solid var(--gray-200);border-radius:10px;background:#fff;cursor:pointer;text-align:left;font-size:14px;transition:border-color 0.15s"
            ${dtmEventAttr('mouseover', function(event) { this.style.borderColor='var(--primary)' })} ${dtmEventAttr('mouseout', function(event) { this.style.borderColor='var(--gray-200)' })}>
            <div style="font-weight:600;color:var(--gray-800)">📄 Olur Dosyasından Oluştur</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:4px">Onay belgesi yükleyerek iş adını otomatik doldurun</div>
          </button>
          <button ${dtmEventAttr('click', function(event) { acYeniProjeSablonAdim() })}
            style="padding:16px;border:2px solid #ddd6fe;border-radius:10px;background:#faf5ff;cursor:pointer;text-align:left;font-size:14px;transition:all 0.15s"
            ${dtmEventAttr('mouseover', function(event) { this.style.borderColor='#7c3aed';this.style.background='#f3e8ff' })} ${dtmEventAttr('mouseout', function(event) { this.style.borderColor='#ddd6fe';this.style.background='#faf5ff' })}>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div style="font-weight:700;color:#6d28d9;font-size:14.5px">📑 Benzer Projeden Kopyala (Şablon)</div>
              <span style="background:#7c3aed;color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px">Hızlı Şablon</span>
            </div>
            <div style="font-size:12px;color:#5b21b6;margin-top:4px">Önceki bir projenin iş kalemlerini, görevlilerini ve teknik şartnamesini kopyalayarak yeni proje başlatın</div>
          </button>
          <button ${dtmEventAttr('click', function(event) { kapatYeniProjeModal(); })} style="padding:8px;border:none;background:none;cursor:pointer;font-size:13px;color:var(--gray-400)">İptal</button>
        </div>

        <!-- Adım 2a: Manuel -->
        <div id="yeniProjeAdim2Manuel" style="display:none">
          <label style="font-size:13px;font-weight:600;color:var(--gray-700);display:block;margin-bottom:6px">İş / Hizmet Adı</label>
          <input id="yeniProjeAdi" type="text" placeholder="Örn: Çatı Onarım İşi" style="width:100%;padding:10px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:14px;margin-bottom:20px;box-sizing:border-box"
            ${dtmEventAttr('keydown', function(event) { if(event.key==='Enter')yeniProjeOlustur() })}>
          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button ${dtmEventAttr('click', function(event) { document.getElementById('yeniProjeAdim2Manuel').style.display='none';document.getElementById('yeniProjeAdim1').style.display='flex' })} style="padding:8px 20px;border:1px solid var(--gray-300);background:#fff;border-radius:6px;cursor:pointer;font-size:13px">← Geri</button>
            <button ${dtmEventAttr('click', function(event) { yeniProjeOlustur() })} class="btn btn-primary" style="padding:8px 20px">Oluştur</button>
          </div>
        </div>

        <!-- Adım 2b: Olur belgesi -->
        <div id="yeniProjeAdim2Olur" style="display:none">
          <p style="font-size:13px;color:var(--gray-600);margin-bottom:16px">Onay belgelerini (PDF veya JPG/PNG Fotoğraf) yükleyin, alanlar otomatik doldurulacak. İkisini birden veya yalnızca birini yükleyebilirsiniz.</p>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
            <!-- YM Belgesi -->
            <div style="padding:14px 18px;background:#eff6ff;border:1.5px dashed #93c5fd;border-radius:8px;display:flex;align-items:center;gap:12px">
              <span style="font-size:13px;color:#1e40af;flex:1;font-weight:500">📄 Y.M. Olur Belgesi</span>
              <span id="ymDosyaAdi" style="font-size:12px;color:#374151;flex:2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
              <label style="cursor:pointer;padding:6px 16px;background:#2563eb;color:#fff;border-radius:6px;font-size:12px;display:inline-block;white-space:nowrap;flex-shrink:0">
                Olur Belgesi Seç
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg" id="ymPdfInput" style="display:none" ${dtmEventAttr('change', function(event) { document.getElementById('ymDosyaAdi').textContent=this.files[0]?this.files[0].name:'' })}>
              </label>
            </div>
            <!-- DT Belgesi -->
            <div style="padding:14px 18px;background:#f0fdf4;border:1.5px dashed #86efac;border-radius:8px;display:flex;align-items:center;gap:12px">
              <span style="font-size:13px;color:#166534;flex:1;font-weight:500">📄 D.T. Olur Belgesi</span>
              <span id="dtDosyaAdi" style="font-size:12px;color:#374151;flex:2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
              <label style="cursor:pointer;padding:6px 16px;background:#16a34a;color:#fff;border-radius:6px;font-size:12px;display:inline-block;white-space:nowrap;flex-shrink:0">
                Olur Belgesi Seç
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg" id="dtPdfInput" style="display:none" ${dtmEventAttr('change', function(event) { document.getElementById('dtDosyaAdi').textContent=this.files[0]?this.files[0].name:'' })}>
              </label>
            </div>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button ${dtmEventAttr('click', function(event) { document.getElementById('yeniProjeAdim2Olur').style.display='none';document.getElementById('yeniProjeAdim1').style.display='flex' })} style="padding:8px 20px;border:1px solid var(--gray-300);background:#fff;border-radius:6px;cursor:pointer;font-size:13px">← Geri</button>
            <button ${dtmEventAttr('click', function(event) { parseIkiOlurBelgesi() })} style="padding:8px 24px;background:#2563eb;color:#fff;border-radius:6px;font-size:13px;border:none;cursor:pointer;font-weight:600">Oku ve Devam Et →</button>
          </div>
        </div>

        <!-- Adım 2c: Tüm Belgeleri Yükle (3 Ana Bölümlü) -->
        <div id="yeniProjeAdim2Toplu" style="display:none">
          <p style="font-size:12.5px;color:var(--gray-600);margin-bottom:12px;line-height:1.4">
            Belgeleri ilgili bölümlere sürükleyin veya seçin. Her bölüme <strong>birden fazla fotoğraf (JPG/PNG) veya PDF</strong> ekleyebilirsiniz.
          </p>

          <div style="display:flex;flex-direction:column;gap:10px">
            <!-- 1. Bölüm: Olur Belgeleri -->
            <div id="topluDropzoneOlur" style="padding:12px 14px;background:#eff6ff;border:1.5px dashed #93c5fd;border-radius:10px;transition:all 0.2s">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
                <div>
                  <div style="font-size:13px;font-weight:700;color:#1e40af;display:flex;align-items:center;gap:6px">
                    <span>📄 1. Olur Belgeleri</span>
                    <span id="topluSayiOlur" style="background:#dbeafe;color:#1e40af;font-size:11px;padding:1px 7px;border-radius:10px;font-weight:600">0 belge</span>
                  </div>
                  <div style="font-size:11px;color:#3b82f6;margin-top:2px">Y.M. Görevlendirme Oluru ve D.T. Onay Belgesi</div>
                </div>
                <label style="cursor:pointer;padding:6px 12px;background:#2563eb;color:#fff;border-radius:6px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0">
                  <span>+ Belge Seç</span>
                  <input type="file" id="topluInputOlur" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,image/*" style="display:none"
                    ${dtmEventAttr('change', function(event) { topluDosyalarEkle(this.files, 'olur'); this.value=''; })}>
                </label>
              </div>
              <div id="topluListeOlur" style="display:none;flex-direction:column;gap:5px;margin-top:8px"></div>
            </div>

            <!-- 2. Bölüm: Yaklaşık Maliyet — "PİYASA FİYAT ARAŞTIRMASI" -->
            <div id="topluDropzoneYm" style="padding:12px 14px;background:#fefce8;border:1.5px dashed #facc15;border-radius:10px;transition:all 0.2s">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
                <div>
                  <div style="font-size:13px;font-weight:700;color:#854d0e;display:flex;align-items:center;gap:6px">
                    <span>📊 2. Yaklaşık Maliyet — "PİYASA FİYAT ARAŞTIRMASI"</span>
                    <span id="topluSayiYm" style="background:#fef08a;color:#854d0e;font-size:11px;padding:1px 7px;border-radius:10px;font-weight:600">0 belge</span>
                  </div>
                  <div style="font-size:11px;color:#a16207;margin-top:2px">Başlığında <strong>"PİYASA FİYAT ARAŞTIRMASI"</strong> (Konu: Piyasa Fiyat Araştırması) yazan belgeler</div>
                </div>
                <label style="cursor:pointer;padding:6px 12px;background:#ca8a04;color:#fff;border-radius:6px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0">
                  <span>+ Piyasa Fiyat (Y.M.) Seç</span>
                  <input type="file" id="topluInputYm" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,image/*" style="display:none"
                    ${dtmEventAttr('change', function(event) { topluDosyalarEkle(this.files, 'ym'); this.value=''; })}>
                </label>
              </div>
              <div id="topluListeYm" style="display:none;flex-direction:column;gap:5px;margin-top:8px"></div>
            </div>

            <!-- 3. Bölüm: Resmi Teklif — "TEKLİF MEKTUBUDUR" -->
            <div id="topluDropzoneDt" style="padding:12px 14px;background:#f0fdf4;border:1.5px dashed #86efac;border-radius:10px;transition:all 0.2s">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
                <div>
                  <div style="font-size:13px;font-weight:700;color:#166534;display:flex;align-items:center;gap:6px">
                    <span>🏷️ 3. Resmi Teklif — "TEKLİF MEKTUBUDUR"</span>
                    <span id="topluSayiDt" style="background:#dcfce7;color:#166534;font-size:11px;padding:1px 7px;border-radius:10px;font-weight:600">0 belge</span>
                  </div>
                  <div style="font-size:11px;color:#15803d;margin-top:2px">Başlığında <strong>"TEKLİF MEKTUBUDUR"</strong> (Konu: Teklif) yazan nihai resmi teklifler</div>
                </div>
                <label style="cursor:pointer;padding:6px 12px;background:#16a34a;color:#fff;border-radius:6px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;flex-shrink:0">
                  <span>+ Resmi Teklif Seç</span>
                  <input type="file" id="topluInputDt" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,image/*" style="display:none"
                    ${dtmEventAttr('change', function(event) { topluDosyalarEkle(this.files, 'dt'); this.value=''; })}>
                </label>
              </div>
              <div id="topluListeDt" style="display:none;flex-direction:column;gap:5px;margin-top:8px"></div>
              <div style="font-size:11px;color:#166534;opacity:0.9;margin-top:6px">
                💡 <em>WhatsApp fotoğrafları karışsa bile yapay zeka kağıttaki <strong>"PİYASA FİYAT ARAŞTIRMASI"</strong> ve <strong>"TEKLİF MEKTUBUDUR"</strong> başlığını okuyup otomatik doğru tabloya ayırır.</em>
              </div>
            </div>
          </div>

          <!-- Seçilen dosyalar toplam özeti -->
          <div id="topluDosyalarWrap" style="margin-top:10px;display:none">
            <div style="font-size:12px;font-weight:600;color:var(--gray-600);display:flex;justify-content:space-between;align-items:center;padding:4px 2px">
              <span>Toplam Seçilen Belge: <strong id="topluDosyaSayisi" style="color:var(--primary)">0</strong></span>
              <button type="button" style="background:none;border:none;color:#ef4444;font-size:11.5px;font-weight:600;cursor:pointer" ${dtmEventAttr('click', function(event) { topluDosyalariTemizle(); })}>Tümünü Temizle</button>
            </div>
            <div id="topluDosyalarListesi" style="display:none"></div>
          </div>

          <!-- İlerleme / Durum -->
          <div id="topluIlerlemeDurumu" style="display:none;margin-top:12px;padding:12px;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
              <div style="display:flex;align-items:center;gap:10px;overflow:hidden;flex:1">
                <span id="topluSpinner" style="font-size:18px;flex-shrink:0">⏳</span>
                <div style="flex:1;overflow:hidden">
                  <div id="topluDurumBaslik" style="font-size:13px;font-weight:600;color:#0369a1">Analiz Başlatılıyor...</div>
                  <div id="topluDurumDetay" style="font-size:11px;color:#0284c7;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Lütfen bekleyin</div>
                </div>
              </div>
              <button type="button" id="btnTopluAnalizDurdur" ${dtmEventAttr('click', function(event) { topluAnaliziDurdur(); })} style="padding:5px 10px;background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0">⏹ Durdur</button>
            </div>
            <div style="width:100%;height:6px;background:#e0f2fe;border-radius:3px;margin-top:8px;overflow:hidden">
              <div id="topluIlerlemeBar" style="width:0%;height:100%;background:#0284c7;transition:width 0.3s"></div>
            </div>
          </div>

          <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap">
            <button type="button" id="btnTopluKapat" ${dtmEventAttr('click', function(event) { kapatYeniProjeModal(); })} style="padding:8px 14px;border:1px solid #fecaca;background:#fef2f2;color:#dc2626;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">✕ Vazgeç / Kapat</button>
            <div style="display:flex;gap:8px;align-items:center">
              <button type="button" id="btnTopluGeri" ${dtmEventAttr('click', function(event) { topluAnaliziDurdur(true); document.getElementById('yeniProjeAdim2Toplu').style.display='none';document.getElementById('yeniProjeAdim1').style.display='flex'; })} style="padding:8px 18px;border:1px solid var(--gray-300);background:#fff;border-radius:6px;cursor:pointer;font-size:13px">← Geri</button>
              <button type="button" id="btnTopluAnalizBaslat" class="btn btn-primary" style="padding:8px 20px;display:flex;align-items:center;gap:6px"
                ${dtmEventAttr('click', function(event) { topluAnaliziBaslat(); })}>
                <span>🚀 Belgeleri Çözümle ve Projeyi Oluştur</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Adım 2d: Benzer Projeden Kopyala (Şablon) -->
        <div id="yeniProjeAdim2Sablon" style="display:none">
          <p style="font-size:13px;color:var(--gray-600);margin:0 0 12px 0">
            Şablon olarak kullanmak istediğiniz projeyi seçin. Hangi bilgilerin kopyalanacağını bir sonraki adımda seçebilirsiniz.
          </p>
          <input id="sablonProjeAraInput" type="text" placeholder="🔍 Kayıtlı projelerinizde ara..."
            ${dtmEventAttr('input', function(event) { sablonProjeleriFiltrele() })}
            style="width:100%;padding:9px 12px;border:1px solid var(--gray-300);border-radius:8px;font-size:13.5px;margin-bottom:10px;box-sizing:border-box;outline:none">
          <div id="sablonProjeListesi" style="max-height:280px;overflow-y:auto;border:1px solid var(--gray-200);border-radius:8px;background:#f8fafc;padding:6px;display:flex;flex-direction:column;gap:6px">
            <div style="padding:18px;text-align:center;color:var(--gray-500);font-size:13px">⏳ Projeler yükleniyor...</div>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
            <button type="button" ${dtmEventAttr('click', function(event) { document.getElementById('yeniProjeAdim2Sablon').style.display='none';document.getElementById('yeniProjeAdim1').style.display='flex'; })} style="padding:8px 20px;border:1px solid var(--gray-300);background:#fff;border-radius:6px;cursor:pointer;font-size:13px">← Geri</button>
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
        return `<div class="home-recent-row" ${dtmEventAttr('click', function(event) { cloudProjeAc(String(p.id ?? '')) })} style="border-bottom:1px solid var(--gray-100)">
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
  const adim2t = modal.querySelector('#yeniProjeAdim2Toplu');
  const adim2s = modal.querySelector('#yeniProjeAdim2Sablon');
  if (adim1) adim1.style.display = 'flex';
  if (adim2m) adim2m.style.display = 'none';
  if (adim2o) adim2o.style.display = 'none';
  if (adim2t) adim2t.style.display = 'none';
  if (adim2s) adim2s.style.display = 'none';
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

  // Toplu dosya seçimlerini temizle
  topluSecilenDosyalar = [];
  topluGrupluDosyalar = { olur: [], ym: [], dt: [] };
  ['#topluInputOlur', '#topluInputYm', '#topluInputDt', '#topluBelgelerInput'].forEach(sel => {
    const el = modal.querySelector(sel);
    if (el) el.value = '';
  });
  topluDosyalariGuncelleUI();
  const ilerleme = modal.querySelector('#topluIlerlemeDurumu');
  if (ilerleme) ilerleme.style.display = 'none';
  const btnBaslat = modal.querySelector('#btnTopluAnalizBaslat');
  if (btnBaslat) { btnBaslat.disabled = false; btnBaslat.style.opacity = '1'; }
  const btnGeri = modal.querySelector('#btnTopluGeri');
  if (btnGeri) { btnGeri.disabled = false; btnGeri.style.opacity = '1'; }
}

function kapatYeniProjeModal() {
  if (typeof topluAnaliziDurdur === 'function') topluAnaliziDurdur(true);
  const modal = document.getElementById('yeniProjeModal');
  if (modal) modal.style.display = 'none';
}

function yeniProjeOlustur() {
  const isAdiEl = document.getElementById('yeniProjeAdi');
  const isAdi = isAdiEl?.value.trim();
  if (!isAdi) { markError(isAdiEl); showToast('Lütfen bir proje adı girin.', 'warning'); return; }
  proje = getDefaultProje();
  proje.isAdi = isAdi;
  if (typeof window !== 'undefined') window._bekleyenProjeDosyalari = [];
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

// ===================== BENZER PROJEDEN KOPYALA (ŞABLON PROJE) =====================
window._sablonProjelerCache = [];

window.acYeniProjeSablonAdim = async function() {
  const adim1 = document.getElementById('yeniProjeAdim1');
  const adim2s = document.getElementById('yeniProjeAdim2Sablon');
  if (adim1) adim1.style.display = 'none';
  if (adim2s) adim2s.style.display = 'block';
  const araInp = document.getElementById('sablonProjeAraInput');
  if (araInp) {
    araInp.value = '';
    setTimeout(() => araInp.focus(), 50);
  }
  const listeEl = document.getElementById('sablonProjeListesi');
  if (!listeEl) return;
  listeEl.innerHTML = `<div style="padding:18px;text-align:center;color:var(--gray-500);font-size:13px">⏳ Kayıtlı projeleriniz yükleniyor...</div>`;
  try {
    const projeler = await getUserProjeler();
    window._sablonProjelerCache = projeler || [];
    sablonProjeleriFiltrele();
  } catch (e) {
    listeEl.innerHTML = `<div style="padding:18px;text-align:center;color:#dc2626;font-size:13px">Projeler yüklenemedi: ${escHtml(hataMesaji(e))}</div>`;
  }
};

window.sablonProjeleriFiltrele = function() {
  const listeEl = document.getElementById('sablonProjeListesi');
  if (!listeEl) return;
  const ara = (document.getElementById('sablonProjeAraInput')?.value || '').trim().toLocaleLowerCase('tr');
  const tum = Array.isArray(window._sablonProjelerCache) ? window._sablonProjelerCache : [];
  const filtreli = ara
    ? tum.filter(p => (p.isAdi || '').toLocaleLowerCase('tr').includes(ara) || (p.isTuru || '').toLocaleLowerCase('tr').includes(ara))
    : tum;

  if (filtreli.length === 0) {
    listeEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--gray-500);font-size:13px">${ara ? 'Aramanızla eşleşen proje bulunamadı.' : 'Henüz şablon olarak kopyalanabilecek kayıtlı projeniz yok.'}</div>`;
    return;
  }

  listeEl.innerHTML = filtreli.map(p => {
    const tarih = p.updatedAt?.toDate ? p.updatedAt.toDate().toLocaleDateString('tr-TR') : '-';
    return `
      <div ${dtmEventAttr('click', function(event) { kapatYeniProjeModal(); projeSablonKopyalaClick(String(p.id ?? '')); })}
        style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:all 0.15s"
        ${dtmEventAttr('mouseover', function(event) { this.style.borderColor='#7c3aed';this.style.background='#faf5ff'; })}
        ${dtmEventAttr('mouseout', function(event) { this.style.borderColor='#e2e8f0';this.style.background='#fff'; })}>
        <div style="min-width:0;flex:1">
          <div style="font-size:13.5px;font-weight:600;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(p.isAdi || '(İsimsiz)')}</div>
          <div style="font-size:11.5px;color:#64748b;margin-top:2px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span>📅 ${tarih}</span>
            ${getIsTuruBadge(p.isTuru)}
          </div>
        </div>
        <span style="padding:5px 10px;background:#f3e8ff;color:#6d28d9;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap;flex-shrink:0">📑 Seç →</span>
      </div>`;
  }).join('');
};

window.projeSablonKopyalaClick = async function(projeId) {
  if (!projeId) return;
  try {
    showToast('⏳ Şablon proje verileri okunuyor...', 'info', 2000);
    const doc = await getProjeFromCloud(projeId);
    if (!doc || !doc.data) {
      showToast('Kaynak proje verisi bulunamadı.', 'error');
      return;
    }
    acProjeSablonKopyalaModal(doc.data, doc.isAdi || doc.data.isAdi || 'Proje');
  } catch (e) {
    showToast('Proje kopyalanamadı: ' + hataMesaji(e), 'error');
  }
};

function acProjeSablonKopyalaModal(kaynakData, kaynakIsAdi) {
  const mevcut = document.getElementById('dtmSablonKopyalaModal');
  if (mevcut) mevcut.remove();

  const kalemSayisi = Array.isArray(kaynakData.isKalemleri)
    ? kaynakData.isKalemleri.filter(k => (k.ad || '').trim() !== '').length
    : 0;
  const sartnameVar = Boolean((kaynakData.teknikSartnameMetni || '').trim() || (kaynakData.sozlesmeOzelMaddeleri || '').trim());
  const varsayilanYeniAd = `${kaynakIsAdi} (Yeni)`;

  const overlay = document.createElement('div');
  overlay.id = 'dtmSablonKopyalaModal';
  overlay.className = 'dtm-modal-overlay';
  overlay.innerHTML = `
    <div class="dtm-modal" style="max-width:480px">
      <div class="dtm-modal-header" style="display:flex;align-items:center;justify-content:space-between">
        <h3>📑 Benzer Projeden Kopyala (Şablon)</h3>
      </div>
      <div class="dtm-modal-body">
        <div style="padding:10px 12px;background:#faf5ff;border:1px solid #ddd6fe;border-radius:8px;margin-bottom:14px;font-size:12.5px;color:#5b21b6">
          <strong>Kaynak Proje:</strong> ${escHtml(kaynakIsAdi)}
          <div style="font-size:11.5px;color:#6d28d9;margin-top:2px">Seçtiğiniz bilgilerle yeni bir <strong>Taslak</strong> proje oluşturulacaktır (Eski onay tarihleri ve sayıları sıfırlanır).</div>
        </div>

        <label style="font-size:13px;font-weight:700;color:var(--gray-800);display:block;margin-bottom:6px">Yeni İş / Hizmet Adı</label>
        <input id="sablonYeniIsAdiInput" type="text" value="${escAttr(varsayilanYeniAd)}"
          placeholder="Yeni projenin iş adını girin"
          style="width:100%;padding:10px 12px;border:1.5px solid #c4b5fd;border-radius:8px;font-size:14px;margin-bottom:16px;box-sizing:border-box;outline:none">

        <div style="font-size:13px;font-weight:700;color:var(--gray-800);margin-bottom:8px">Kopyalanacak Bölümler:</div>

        <label style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;cursor:pointer;border-bottom:1px solid var(--gray-100)">
          <input type="checkbox" id="sablonCbKalemler" checked style="width:16px;height:16px;margin-top:2px;cursor:pointer;accent-color:#7c3aed">
          <div style="font-size:13.5px;color:var(--gray-800)">
            <strong>İş Kalemleri, Birimler ve Miktarlar</strong>
            <div style="font-size:11.5px;color:var(--gray-500)">${kalemSayisi} adet iş kalemi ve birim bilgisi aktarılır</div>
          </div>
        </label>

        <label style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;cursor:pointer;border-bottom:1px solid var(--gray-100)">
          <input type="checkbox" id="sablonCbIdare" checked style="width:16px;height:16px;margin-top:2px;cursor:pointer;accent-color:#7c3aed">
          <div style="font-size:13.5px;color:var(--gray-800)">
            <strong>İdare, Müdürlük, İş Türü, KDV ve İlçe Bilgileri</strong>
            <div style="font-size:11.5px;color:var(--gray-500)">${escHtml(kaynakData.isTuru || 'Yapım/Onarım')} • KDV %${escHtml(String(kaynakData.kdvOrani ?? 20))} • ${escHtml(kaynakData.ilce || 'Merkez')}</div>
          </div>
        </label>

        <label style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;cursor:pointer;border-bottom:1px solid var(--gray-100)">
          <input type="checkbox" id="sablonCbGorevliler" checked style="width:16px;height:16px;margin-top:2px;cursor:pointer;accent-color:#7c3aed">
          <div style="font-size:13.5px;color:var(--gray-800)">
            <strong>Görevli Personeller ve Onaylayan Amir</strong>
            <div style="font-size:11.5px;color:var(--gray-500)">Y.M., D.T., Muayene/Kabul görevlileri ve İhale Yetkilisi aktarılır</div>
          </div>
        </label>

        <label style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;cursor:pointer;border-bottom:1px solid var(--gray-100)">
          <input type="checkbox" id="sablonCbSartname" checked style="width:16px;height:16px;margin-top:2px;cursor:pointer;accent-color:#7c3aed">
          <div style="font-size:13.5px;color:var(--gray-800)">
            <strong>Teknik Şartname ve Sözleşme Özel Maddeleri</strong>
            <div style="font-size:11.5px;color:var(--gray-500)">${sartnameVar ? 'Kayıtlı şartname ve sözleşme metinleri aktarılır' : 'Varsayılan şablon ayarları aktarılır'}</div>
          </div>
        </label>

        <label style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;cursor:pointer">
          <input type="checkbox" id="sablonCbFirmalar" style="width:16px;height:16px;margin-top:2px;cursor:pointer;accent-color:#7c3aed">
          <div style="font-size:13.5px;color:var(--gray-800)">
            <strong>Firma İsimleri ve Birim Fiyat Teklifleri</strong>
            <div style="font-size:11.5px;color:var(--gray-500)">İşaretlenmezse yeni ihale için firma ve fiyat tabloları temiz başlatılır</div>
          </div>
        </label>
      </div>
      <div class="dtm-modal-footer">
        <button id="sablonKopyalaIptalBtn" class="btn btn-outline">İptal</button>
        <button id="sablonKopyalaOnayBtn" class="btn" style="background:#7c3aed;color:#fff;font-weight:700">📑 Kopyala ve Projeyi Aç</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const adInput = document.getElementById('sablonYeniIsAdiInput');
  setTimeout(() => {
    if (adInput) {
      adInput.focus();
      adInput.select();
    }
  }, 50);

  document.getElementById('sablonKopyalaIptalBtn').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  const uygulaKopyalama = () => {
    const yeniAd = (adInput?.value || '').trim();
    if (!yeniAd) {
      markError(adInput);
      showToast('Lütfen yeni proje için bir iş adı girin.', 'warning');
      return;
    }

    const cbKalemler = document.getElementById('sablonCbKalemler')?.checked;
    const cbIdare = document.getElementById('sablonCbIdare')?.checked;
    const cbGorevliler = document.getElementById('sablonCbGorevliler')?.checked;
    const cbSartname = document.getElementById('sablonCbSartname')?.checked;
    const cbFirmalar = document.getElementById('sablonCbFirmalar')?.checked;

    const klon = (obj) => JSON.parse(JSON.stringify(obj));
    const yeniProje = getDefaultProje();
    yeniProje.isAdi = yeniAd;

    if (cbIdare) {
      if (kaynakData.idareAdi) yeniProje.idareAdi = kaynakData.idareAdi;
      if (kaynakData.mudurluk) yeniProje.mudurluk = kaynakData.mudurluk;
      if (kaynakData.isTuru) yeniProje.isTuru = kaynakData.isTuru;
      if (kaynakData.kdvOrani !== undefined) yeniProje.kdvOrani = kaynakData.kdvOrani;
      if (kaynakData.ilce) yeniProje.ilce = kaynakData.ilce;
      if (kaynakData.il) yeniProje.il = kaynakData.il;
      if (kaynakData.isinSuresi) yeniProje.isinSuresi = kaynakData.isinSuresi;
      if (kaynakData.cezaOrani) yeniProje.cezaOrani = kaynakData.cezaOrani;
    }

    if (cbGorevliler) {
      if (Array.isArray(kaynakData.ymGorevliler)) yeniProje.ymGorevliler = klon(kaynakData.ymGorevliler);
      if (Array.isArray(kaynakData.dtGorevliler)) yeniProje.dtGorevliler = klon(kaynakData.dtGorevliler);
      if (Array.isArray(kaynakData.mkGorevliler)) yeniProje.mkGorevliler = klon(kaynakData.mkGorevliler);
      if (kaynakData.ymGorevliSayisi !== undefined) yeniProje.ymGorevliSayisi = kaynakData.ymGorevliSayisi;
      if (kaynakData.dtGorevliSayisi !== undefined) yeniProje.dtGorevliSayisi = kaynakData.dtGorevliSayisi;
      if (kaynakData.mkGorevliSayisi !== undefined) yeniProje.mkGorevliSayisi = kaynakData.mkGorevliSayisi;
      if (kaynakData.dtGorevlilerYmIleAyni !== undefined) yeniProje.dtGorevlilerYmIleAyni = kaynakData.dtGorevlilerYmIleAyni;
      if (kaynakData.onaylayanAmir) yeniProje.onaylayanAmir = klon(kaynakData.onaylayanAmir);
    }

    if (cbSartname) {
      if (kaynakData.teknikSartnameMetni !== undefined) yeniProje.teknikSartnameMetni = kaynakData.teknikSartnameMetni;
      if (kaynakData.sozlesmeOzelMaddeleri !== undefined) yeniProje.sozlesmeOzelMaddeleri = kaynakData.sozlesmeOzelMaddeleri;
    }

    if (cbKalemler && Array.isArray(kaynakData.isKalemleri) && kaynakData.isKalemleri.length > 0) {
      yeniProje.isKalemleri = klon(kaynakData.isKalemleri);
      const kalemAdet = yeniProje.isKalemleri.length;
      yeniProje.ymFirmalar = [
        { ad: '', fiyatlar: Array(kalemAdet).fill('') },
        { ad: '', fiyatlar: Array(kalemAdet).fill('') },
        { ad: '', fiyatlar: Array(kalemAdet).fill('') }
      ];
      yeniProje.teklifFirmalar = [
        { ad: '', fiyatlar: Array(kalemAdet).fill('') },
        { ad: '', fiyatlar: Array(kalemAdet).fill('') },
        { ad: '', fiyatlar: Array(kalemAdet).fill('') }
      ];
    }

    if (cbFirmalar) {
      if (Array.isArray(kaynakData.ymFirmalar)) yeniProje.ymFirmalar = klon(kaynakData.ymFirmalar);
      if (Array.isArray(kaynakData.teklifFirmalar)) yeniProje.teklifFirmalar = klon(kaynakData.teklifFirmalar);
      if (kaynakData.kazananFirmaIndex !== undefined) yeniProje.kazananFirmaIndex = kaynakData.kazananFirmaIndex;
    }

    proje = yeniProje;
    if (typeof window !== 'undefined') {
      window._bekleyenProjeDosyalari = [];
      window._sonProjeDosyalariListesi = [];
      if (window._seciliProjeDokumanlari instanceof Set) window._seciliProjeDokumanlari.clear();
    }
    currentCloudProjeId = null;
    currentProjeStatus = 'taslak';
    currentProjeKilitli = false;
    currentProjeBaskaKullanici = false;
    currentProjeKazananBasitUsul = null;
    saveProje(proje);
    lastSavedProjeSnapshot = JSON.stringify(proje);

    overlay.remove();
    projeAktif = true;
    currentPage = 'veri-giris';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-page="veri-giris"]')?.classList.add('active');
    updateNavLock();
    renderPage();
    showToast('📑 Proje şablon olarak kopyalandı! Yeni proje bilgilerini düzenleyip kaydedebilirsiniz.', 'success', 4500);
  };

  document.getElementById('sablonKopyalaOnayBtn').onclick = uygulaKopyalama;
  adInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') uygulaKopyalama();
  });
}

// ===================== VERİ GİRİŞ SAYFASI =====================
function renderVeriGirisPage() {
  const hesaplamaHatalari = getHesaplamaHatalari(proje, referans);
  const ymSayisi = proje.ymGorevliSayisi || 1;
  const ymSeciliAdlar = (proje.ymGorevliler || []).slice(0, ymSayisi).map(g => g.ad).filter(Boolean);
  const ymGorevliRows = proje.ymGorevliler.slice(0, ymSayisi).map((g, i) => `
    <div class="form-grid" style="position:relative">
      <div class="form-group">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <label style="margin-bottom:0">Y.M. Görevlisi ${i + 1}</label>
          ${i > 0 ? `<button type="button" ${dtmEventAttr('click', function(event) { onGorevliSil('ym', (i)) })} title="Bu görevliyi kaldır" style="background:none;border:none;color:#ef4444;font-size:12px;cursor:pointer;padding:2px 6px;border-radius:4px" ${dtmEventAttr('mouseover', function(event) { this.style.background='#fee2e2' })} ${dtmEventAttr('mouseout', function(event) { this.style.background='none' })}>✕ Sil</button>` : ''}
        </div>
        <select data-field="ymGorevliler" data-index="${i}" data-sub="ad" ${dtmEventAttr('change', function(event) { onGorevliChange(this, 'ym') })}>
          <option value="">-- Seçin --</option>
          ${referans.muhendisList.map(m => {
            const baskaSecili = g.ad !== m.ad && ymSeciliAdlar.includes(m.ad);
            return `<option value="${escAttr(m.ad)}" ${g.ad === m.ad ? 'selected' : ''} ${baskaSecili ? 'disabled style="color:#9ca3af"' : ''}>${escHtml(m.ad)}${baskaSecili ? ' (Seçildi)' : ''}</option>`;
          }).join('')}
          ${g.ad && !referans.muhendisList.some(m => m.ad === g.ad) ? `<option value="${escAttr(g.ad)}" selected>${escHtml(g.ad)}</option>` : ''}
        </select>
      </div>
      <div class="form-group">
        <label>Ünvanı</label>
        <input type="text" value="${escAttr(g.unvan || getUnvanByAd(g.ad, referans))}" readonly>
      </div>
    </div>`).join('');
  const ymEkleBtn = ymSayisi < 3 ? `<button class="btn btn-outline btn-sm" ${dtmEventAttr('click', function(event) { onGorevliEkle('ym') })} style="margin-top:6px;">+ Y.M. Görevlisi Ekle</button>` : '';

  const dtSayisi = proje.dtGorevliSayisi || 1;
  const dtSeciliAdlar = (proje.dtGorevliler || []).slice(0, dtSayisi).map(g => g.ad).filter(Boolean);
  const dtGorevliRows = proje.dtGorevliler.slice(0, dtSayisi).map((g, i) => `
    <div class="form-grid" style="position:relative">
      <div class="form-group">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <label style="margin-bottom:0">D.T. Görevlisi ${i + 1} ${proje.dtGorevlilerYmIleAyni ? '<span style="font-weight:400;color:var(--primary);font-size:11px">(Y.M. Görevlisi ' + (i+1) + ')</span>' : ''}</label>
          ${i > 0 && !proje.dtGorevlilerYmIleAyni ? `<button type="button" ${dtmEventAttr('click', function(event) { onGorevliSil('dt', (i)) })} title="Bu görevliyi kaldır" style="background:none;border:none;color:#ef4444;font-size:12px;cursor:pointer;padding:2px 6px;border-radius:4px" ${dtmEventAttr('mouseover', function(event) { this.style.background='#fee2e2' })} ${dtmEventAttr('mouseout', function(event) { this.style.background='none' })}>✕ Sil</button>` : ''}
        </div>
        <select data-field="dtGorevliler" data-index="${i}" data-sub="ad" ${dtmEventAttr('change', function(event) { onGorevliChange(this, 'dt') })} ${proje.dtGorevlilerYmIleAyni ? 'disabled style="background:#f8fafc;cursor:not-allowed"' : ''}>
          <option value="">-- Seçin --</option>
          ${referans.muhendisList.map(m => {
            const baskaSecili = g.ad !== m.ad && dtSeciliAdlar.includes(m.ad);
            return `<option value="${escAttr(m.ad)}" ${g.ad === m.ad ? 'selected' : ''} ${baskaSecili ? 'disabled style="color:#9ca3af"' : ''}>${escHtml(m.ad)}${baskaSecili ? ' (Seçildi)' : ''}</option>`;
          }).join('')}
          ${g.ad && !referans.muhendisList.some(m => m.ad === g.ad) ? `<option value="${escAttr(g.ad)}" selected>${escHtml(g.ad)}</option>` : ''}
        </select>
      </div>
      <div class="form-group">
        <label>Ünvanı</label>
        <input type="text" value="${escAttr(g.unvan || getUnvanByAd(g.ad, referans))}" readonly ${proje.dtGorevlilerYmIleAyni ? 'style="background:#f8fafc"' : ''}>
      </div>
    </div>`).join('');
  const dtEkleBtn = dtSayisi < 3 ? `<button class="btn btn-outline btn-sm" ${dtmEventAttr('click', function(event) { onGorevliEkle('dt') })} style="margin-top:6px;">+ D.T. Görevlisi Ekle</button>` : '';

  if (!proje.mkGorevliler) proje.mkGorevliler = [{ad:'', unvan:''}, {ad:'', unvan:''}, {ad:'', unvan:''}];
  const mkSayisi = proje.mkGorevliSayisi || 1;
  const mkSeciliAdlar = (proje.mkGorevliler || []).slice(0, mkSayisi).map(g => g.ad).filter(Boolean);
  const mkGorevliRows = proje.mkGorevliler.slice(0, mkSayisi).map((g, i) => `
    <div class="form-grid" style="position:relative">
      <div class="form-group">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <label style="margin-bottom:0">Muayene Kabul Görevlisi ${i + 1}</label>
          ${i > 0 ? `<button type="button" ${dtmEventAttr('click', function(event) { onGorevliSil('mk', (i)) })} title="Bu görevliyi kaldır" style="background:none;border:none;color:#ef4444;font-size:12px;cursor:pointer;padding:2px 6px;border-radius:4px" ${dtmEventAttr('mouseover', function(event) { this.style.background='#fee2e2' })} ${dtmEventAttr('mouseout', function(event) { this.style.background='none' })}>✕ Sil</button>` : ''}
        </div>
        <select data-field="mkGorevliler" data-index="${i}" data-sub="ad" ${dtmEventAttr('change', function(event) { onGorevliChange(this, 'mk') })}>
          <option value="">-- Seçin --</option>
          ${referans.muhendisList.map(m => {
            const baskaSecili = g.ad !== m.ad && mkSeciliAdlar.includes(m.ad);
            return `<option value="${escAttr(m.ad)}" ${g.ad === m.ad ? 'selected' : ''} ${baskaSecili ? 'disabled style="color:#9ca3af"' : ''}>${escHtml(m.ad)}${baskaSecili ? ' (Seçildi)' : ''}</option>`;
          }).join('')}
          ${g.ad && !referans.muhendisList.some(m => m.ad === g.ad) ? `<option value="${escAttr(g.ad)}" selected>${escHtml(g.ad)}</option>` : ''}
        </select>
      </div>
      <div class="form-group">
        <label>Ünvanı</label>
        <input type="text" value="${escAttr(g.unvan || getUnvanByAd(g.ad, referans))}" readonly>
      </div>
    </div>`).join('');
  const mkEkleBtn = mkSayisi < 3 ? `<button class="btn btn-outline btn-sm" ${dtmEventAttr('click', function(event) { onGorevliEkle('mk') })} style="margin-top:6px;">+ Muayene Kabul Görevlisi Ekle</button>` : '';

  const kalemler = !isMalVeyaHizmetTuru(proje.isTuru) ? '' : proje.isKalemleri.map((k, i) => `
    <tr>
      <td class="merkez">${i + 1}</td>
      <td><input type="text" value="${escAttr(k.ad)}" data-field="isKalemleri" data-index="${i}" data-sub="ad" ${dtmEventAttr('change', function(event) { onKalemChange(this) })}></td>
      <td><input type="number" min="0" step="any" value="${escAttr(k.miktar)}" data-field="isKalemleri" data-index="${i}" data-sub="miktar" ${dtmEventAttr('change', function(event) { onKalemChange(this) })} style="width:80px"></td>
      <td><select data-field="isKalemleri" data-index="${i}" data-sub="birim" ${dtmEventAttr('change', function(event) { onKalemChange(this) })}>
        <option value="">--</option>
        ${referans.birimList.map(b => `<option value="${escAttr(b)}" ${k.birim === b ? 'selected' : ''}>${escHtml(b)}</option>`).join('')}
      </select></td>
    </tr>`).join('');

  const kalemlerSection = !isMalVeyaHizmetTuru(proje.isTuru) ? `
    <div class="card-body">
      <p style="color:var(--gray-500)">Bu iş türü seçildiğinde iş kalemi otomatik olarak iş adı ve miktar 1 olarak belirlenir.</p>
    </div>` : `
    <div class="card-body">
      <table class="data-table">
        <thead><tr><th>S.No</th><th>Kalem Adı</th><th>Miktar</th><th>Birim</th></tr></thead>
        <tbody>${kalemler}</tbody>
      </table>
    </div>`;

  // YM Firma tabloları (Yumuşak Okyanus / Çelik Mavisi Tema)
  const aktifKalemler = getKalemler(proje);
  const ymFirmaRows = proje.ymFirmalar.map((f, fi) => `
    <div class="card" style="margin-bottom:12px;border:1.5px solid #bae6fd;border-radius:12px;background:#fff;box-shadow:0 2px 6px rgba(2,132,199,0.06)">
      <div class="card-body" style="padding:14px">
        <div class="form-group" style="margin-bottom:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="padding:3px 10px;border-radius:6px;background:#e0f2fe;color:#0c4a6e;font-size:12px;font-weight:700">${fi + 1}. Firma</span>
              <span style="font-size:11.5px;color:#0369a1;font-weight:600">Piyasa Fiyat Araştırması</span>
            </div>
            <label title="PDF'den oku" style="cursor:pointer;padding:4px 10px;background:#f0f9ff;border:1px solid #7dd3fc;border-radius:6px;font-size:11.5px;font-weight:600;color:#0369a1;white-space:nowrap">
              📄 PDF'den Oku
              <input type="file" accept=".pdf" style="display:none" ${dtmEventAttr('change', function(event) { parseTeklifPDF(this.files[0],'ym',(fi));this.value='' })}>
            </label>
          </div>
          <select data-field="ymFirmalar" data-index="${fi}" data-sub="ad" ${dtmEventAttr('change', function(event) { onFirmaChange(this, 'ym') })}
            style="border:1.5px solid #cbd5e1;font-weight:600;color:#0f172a">
            <option value="">-- Firma Seçin --</option>
            ${[...referans.firmaList].sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(fr => `<option value="${escAttr(fr.ad)}" ${f.ad === fr.ad ? 'selected' : ''}>${escHtml(fr.ad)}</option>`).join('')}
          </select>
        </div>
        <div style="border:1px solid #e0f2fe;border-radius:10px;overflow:hidden;background:#f8fafc">
          <table class="data-table" style="margin:0">
            <thead>
              <tr style="background:#e0f2fe">
                <th style="color:#0c4a6e;border-bottom:1.5px solid #bae6fd">İş Kalemi</th>
                <th style="color:#0c4a6e;border-bottom:1.5px solid #bae6fd;width:230px">💰 Birim Fiyat (TL)</th>
                <th style="color:#0c4a6e;border-bottom:1.5px solid #bae6fd;text-align:right;width:160px">Toplam (TL)</th>
              </tr>
            </thead>
            <tbody>
              ${aktifKalemler.map((k, ki) => {
                const bf = f.fiyatlar[ki] || 0;
                const toplam = hesaplaKalemTutar(bf, k.miktar);
                const dolu = Number(bf) > 0;
                return `<tr style="background:#fff">
                  <td style="font-weight:600;color:#1e293b">${escHtml(k.ad || '-')}</td>
                  <td>
                    <div style="position:relative;display:flex;align-items:center;max-width:210px">
                      <input type="number" min="0" step="0.01" value="${escAttr(bf || '')}" placeholder="Fiyat girin..." data-firma="ym" data-fi="${fi}" data-ki="${ki}" ${dtmEventAttr('change', function(event) { onFiyatChange(this) })}
                        style="width:100%;padding:7px 38px 7px 10px;border:2px ${dolu ? 'solid #0284c7' : 'dashed #38bdf8'};border-radius:8px;background:${dolu ? '#fff' : '#f0f9ff'};color:#082f49;font-size:14px;font-weight:700;box-sizing:border-box">
                      <span style="position:absolute;right:6px;background:#0369a1;color:#fff;font-size:11px;font-weight:700;padding:2px 6px;border-radius:5px;pointer-events:none">TL</span>
                    </div>
                  </td>
                  <td class="rakam" style="font-weight:700;color:#0c4a6e">${toplam > 0 ? formatCurrency(toplam) + ' TL' : '-'}</td>
                </tr>`;
              }).join('')}
              <tr class="toplam-row" style="background:#e0f2fe;border-top:2px solid #0284c7">
                <td colspan="2" style="color:#0c4a6e"><strong>TOPLAM</strong></td>
                <td class="rakam" style="color:#0c4a6e"><strong>${formatCurrency(hesaplaYMFirmaToplam(f, aktifKalemler))} TL</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`).join('');

  const yaklasikMaliyet = hesaplaYaklasikMaliyet(proje);
  const ymSinirAsildi = (() => {
    if (!proje.ymOnayTarihi) return false;
    const yil = new Date(proje.ymOnayTarihi).getFullYear();
    const sinirObj = (referans.dtSinirlari || []).find(s => s.yil === yil);
    return sinirObj && sinirObj.sinir > 0 && yaklasikMaliyet > sinirObj.sinir;
  })();

  // Teklif Firma tabloları (Yumuşak Okyanus / Çelik Mavisi Tema)
  const teklifFirmaRows = proje.teklifFirmalar.map((f, fi) => {
    const kazananIdx = proje.kazananFirmaIndex >= 0 ? proje.kazananFirmaIndex : hesaplaKazananFirma(proje);
    const isKazanan = fi === kazananIdx;
    return `
    <div class="card" style="margin-bottom:12px;border:${isKazanan ? '2px solid #0284c7' : '1.5px solid #bae6fd'};border-radius:12px;background:#fff;box-shadow:${isKazanan ? '0 4px 14px rgba(2,132,199,0.14)' : '0 2px 6px rgba(2,132,199,0.06)'}">
      <div class="card-body" style="padding:14px">
        <div class="form-group" style="margin-bottom:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="padding:3px 10px;border-radius:6px;background:${isKazanan ? '#0369a1' : '#e0f2fe'};color:${isKazanan ? '#fff' : '#0c4a6e'};font-size:12px;font-weight:700">${fi + 1}. Firma</span>
              ${isKazanan ? `<span style="padding:2px 10px;border-radius:12px;background:#f0f9ff;color:#075985;border:1px solid #7dd3fc;font-size:11.5px;font-weight:700">✓ En Düşük Teklif (KAZANAN)</span>` : `<span style="font-size:11.5px;color:#0369a1;font-weight:600">Resmi Teklif Mektubu</span>`}
            </div>
            <label title="PDF'den oku" style="cursor:pointer;padding:4px 10px;background:#f0f9ff;border:1px solid #7dd3fc;border-radius:6px;font-size:11.5px;font-weight:600;color:#0369a1;white-space:nowrap">
              📄 PDF'den Oku
              <input type="file" accept=".pdf" style="display:none" ${dtmEventAttr('change', function(event) { parseTeklifPDF(this.files[0],'teklif',(fi));this.value='' })}>
            </label>
          </div>
          <select data-field="teklifFirmalar" data-index="${fi}" data-sub="ad" ${dtmEventAttr('change', function(event) { onFirmaChange(this, 'teklif') })}
            style="border:1.5px solid #cbd5e1;font-weight:600;color:#0f172a">
            <option value="">-- Firma Seçin --</option>
            ${[...referans.firmaList].sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(fr => `<option value="${escAttr(fr.ad)}" ${f.ad === fr.ad ? 'selected' : ''}>${escHtml(fr.ad)}</option>`).join('')}
          </select>
        </div>
        ${f.analizEksik ? `<div class="alert alert-warning">Analizde eksik veya tutarsız teklif bulundu. Kalemleri ve fiyatları belgenizle karşılaştırıp düzeltin.
          <button class="btn btn-sm" ${dtmEventAttr('click', function(event) { analizTeklifiniDogrula(fi) })}>Teklifi kontrol ettim</button></div>` : ''}
        <div style="border:1px solid #e0f2fe;border-radius:10px;overflow:hidden;background:#f8fafc">
          <table class="data-table" style="margin:0">
            <thead>
              <tr style="background:#e0f2fe">
                <th style="color:#0c4a6e;border-bottom:1.5px solid #bae6fd">İş Kalemi</th>
                <th style="color:#0c4a6e;border-bottom:1.5px solid #bae6fd;width:230px">💰 Birim Fiyat (TL)</th>
                <th style="color:#0c4a6e;border-bottom:1.5px solid #bae6fd;text-align:right;width:160px">Toplam (TL)</th>
              </tr>
            </thead>
            <tbody>
              ${aktifKalemler.map((k, ki) => {
                const bf = f.fiyatlar[ki] || 0;
                const toplam = hesaplaKalemTutar(bf, k.miktar);
                const dolu = Number(bf) > 0;
                return `<tr style="background:#fff">
                  <td style="font-weight:600;color:#1e293b">${escHtml(k.ad || '-')}</td>
                  <td>
                    <div style="position:relative;display:flex;align-items:center;max-width:210px">
                      <input type="number" min="0" step="0.01" value="${escAttr(bf || '')}" placeholder="Fiyat girin..." data-firma="teklif" data-fi="${fi}" data-ki="${ki}" ${dtmEventAttr('change', function(event) { onFiyatChange(this) })}
                        style="width:100%;padding:7px 38px 7px 10px;border:2px ${dolu ? 'solid #0284c7' : 'dashed #38bdf8'};border-radius:8px;background:${dolu ? '#fff' : '#f0f9ff'};color:#082f49;font-size:14px;font-weight:700;box-sizing:border-box">
                      <span style="position:absolute;right:6px;background:#0369a1;color:#fff;font-size:11px;font-weight:700;padding:2px 6px;border-radius:5px;pointer-events:none">TL</span>
                    </div>
                  </td>
                  <td class="rakam" style="font-weight:700;color:#0c4a6e">${toplam > 0 ? formatCurrency(toplam) + ' TL' : '-'}</td>
                </tr>`;
              }).join('')}
              <tr class="toplam-row" style="background:#e0f2fe;border-top:2px solid #0284c7">
                <td colspan="2" style="color:#0c4a6e"><strong>TOPLAM</strong></td>
                <td class="rakam" style="color:#0c4a6e"><strong>${formatCurrency(hesaplaTeklifFirmaToplam(f, aktifKalemler))} TL</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
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

  const chkGenel = Boolean(proje.isAdi?.trim() && proje.idareAdi?.trim() && proje.mudurluk?.trim());
  const chkOlur = Boolean(
    proje.ymGorevliler?.slice(0, ymSayisi).some(g => g.ad?.trim()) &&
    proje.dtGorevliler?.slice(0, dtSayisi).some(g => g.ad?.trim()) &&
    proje.ymOnayTarihi?.trim() && proje.ymOnayNo?.trim() &&
    proje.dtOnayTarihi?.trim() && proje.dtOnayNo?.trim() &&
    proje.onaylayanAmir?.ad?.trim()
  );
  const chkKalem = !isMalVeyaHizmetTuru(proje.isTuru)
    ? Boolean(proje.isAdi?.trim())
    : Boolean(proje.isKalemleri?.some(k => k.ad?.trim() && Number(k.miktar) > 0));
  const ymDoluSayi = (proje.ymFirmalar || []).filter(f => f.ad?.trim() && hesaplaYMFirmaToplam(f, aktifKalemler) > 0).length;
  const chkYm = ymDoluSayi > 0 && yaklasikMaliyet > 0;
  const kazananIdxTop = proje.kazananFirmaIndex >= 0 ? proje.kazananFirmaIndex : hesaplaKazananFirma(proje);
  const kazananFirmaTop = kazananIdxTop >= 0 ? proje.teklifFirmalar?.[kazananIdxTop] : null;
  const kazananTutarTop = kazananFirmaTop ? hesaplaTeklifFirmaToplam(kazananFirmaTop, aktifKalemler) : 0;
  const chkTeklif = Boolean(kazananFirmaTop?.ad?.trim() && kazananTutarTop > 0);
  const tamamlananAdimSayisi = [chkGenel, chkOlur, chkKalem, chkYm, chkTeklif].filter(Boolean).length;

  const canliDurumVeHizliMenuHtml = `
    <div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:12px;padding:12px 14px;margin-bottom:10px;box-shadow:0 2px 8px rgba(2,132,199,0.06)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:800;color:#0c4a6e">📊 Canlı Proje Durumu & Kontrol Listesi</span>
          <span style="padding:2px 9px;border-radius:12px;font-size:11.5px;font-weight:700;background:${tamamlananAdimSayisi === 5 ? '#dcfce7' : '#e0f2fe'};color:${tamamlananAdimSayisi === 5 ? '#166534' : '#0369a1'};border:1px solid ${tamamlananAdimSayisi === 5 ? '#86efac' : '#7dd3fc'}">
            ${tamamlananAdimSayisi}/5 Adım Tamam
          </span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:8px">
        <div ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_proje'); })}
          style="cursor:pointer;padding:8px 10px;border-radius:8px;background:#fff;border:1.5px solid ${chkGenel ? '#86efac' : '#cbd5e1'};display:flex;align-items:center;gap:8px" title="Proje Bilgileri bölümüne git">
          <span style="font-size:15px">${chkGenel ? '✅' : '⏳'}</span>
          <div style="overflow:hidden">
            <div style="font-size:11.5px;font-weight:700;color:#0f172a">1. İş & İdare Bilgisi</div>
            <div style="font-size:11px;color:${chkGenel ? '#15803d' : '#64748b'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${chkGenel ? escHtml(proje.isAdi) : 'İş adı / idare eksik'}</div>
          </div>
        </div>
        <div ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_ymGorevli'); })}
          style="cursor:pointer;padding:8px 10px;border-radius:8px;background:#fff;border:1.5px solid ${chkOlur ? '#86efac' : '#cbd5e1'};display:flex;align-items:center;gap:8px" title="Olur & Görevliler bölümüne git">
          <span style="font-size:15px">${chkOlur ? '✅' : '⏳'}</span>
          <div style="overflow:hidden">
            <div style="font-size:11.5px;font-weight:700;color:#0f172a">2. Olur & Görevliler</div>
            <div style="font-size:11px;color:${chkOlur ? '#15803d' : '#64748b'}">${chkOlur ? 'Görevli & Onay No tamam' : 'Tarih / sayı / görevli eksik'}</div>
          </div>
        </div>
        <div ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_kalemler'); })}
          style="cursor:pointer;padding:8px 10px;border-radius:8px;background:#fff;border:1.5px solid ${chkKalem ? '#86efac' : '#cbd5e1'};display:flex;align-items:center;gap:8px" title="İş Kalemleri bölümüne git">
          <span style="font-size:15px">${chkKalem ? '✅' : '⏳'}</span>
          <div style="overflow:hidden">
            <div style="font-size:11.5px;font-weight:700;color:#0f172a">3. İş Kalemleri</div>
            <div style="font-size:11px;color:${chkKalem ? '#15803d' : '#64748b'}">${chkKalem ? `${aktifKalemler.filter(k => k.ad?.trim()).length || 1} kalem tanımlı` : 'En az 1 kalem girin'}</div>
          </div>
        </div>
        <div ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_ymTeklif'); })}
          style="cursor:pointer;padding:8px 10px;border-radius:8px;background:#fff;border:1.5px solid ${chkYm ? '#86efac' : '#cbd5e1'};display:flex;align-items:center;gap:8px" title="Yaklaşık Maliyet bölümüne git">
          <span style="font-size:15px">${chkYm ? '✅' : '⏳'}</span>
          <div style="overflow:hidden">
            <div style="font-size:11.5px;font-weight:700;color:#0f172a">4. Yaklaşık Maliyet</div>
            <div style="font-size:11px;font-weight:700;color:${chkYm ? '#0369a1' : '#64748b'}">${chkYm ? `${formatCurrency(yaklasikMaliyet)} TL (${ymDoluSayi} firma)` : 'Firma / fiyat girilmedi'}</div>
          </div>
        </div>
        <div ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_resmiTeklif'); })}
          style="cursor:pointer;padding:8px 10px;border-radius:8px;background:#fff;border:1.5px solid ${chkTeklif ? '#86efac' : '#cbd5e1'};display:flex;align-items:center;gap:8px" title="Resmi Teklif bölümüne git">
          <span style="font-size:15px">${chkTeklif ? '🏆' : '⏳'}</span>
          <div style="overflow:hidden">
            <div style="font-size:11.5px;font-weight:700;color:#0f172a">5. Kazanan Teklif</div>
            <div style="font-size:11px;font-weight:700;color:${chkTeklif ? '#15803d' : '#64748b'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${chkTeklif ? `${formatCurrency(kazananTutarTop)} TL • ${escHtml(kazananFirmaTop.ad)}` : 'Resmi teklif girilmedi'}</div>
          </div>
        </div>
      </div>
    </div>
    <div id="vgStickyHizliGitBar" style="position:sticky;top:0;z-index:95;background:#f0f9ff;border:1.5px solid #7dd3fc;border-radius:0 0 10px 10px;padding:9px 12px;margin-bottom:16px;box-shadow:0 4px 12px rgba(2,132,199,0.12);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="font-size:11.5px;font-weight:800;color:#0369a1;margin-right:2px">⚡ Hızlı Git:</span>
        <button type="button" ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_proje'); })} style="padding:4px 9px;background:#fff;color:#0c4a6e;border:1px solid #7dd3fc;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer">📋 Proje</button>
        <button type="button" ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_ymGorevli'); })} style="padding:4px 9px;background:#fff;color:#0c4a6e;border:1px solid #7dd3fc;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer">👥 Y.M. Görevli</button>
        <button type="button" ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_dtGorevli'); })} style="padding:4px 9px;background:#fff;color:#0c4a6e;border:1px solid #7dd3fc;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer">👥 D.T. Görevli</button>
        <button type="button" ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_amir'); })} style="padding:4px 9px;background:#fff;color:#0c4a6e;border:1px solid #7dd3fc;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer">✒️ Amir</button>
        ${!isMalVeyaHizmetTuru(proje.isTuru) ? `<button type="button" ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_tarih'); })} style="padding:4px 9px;background:#fff;color:#0c4a6e;border:1px solid #7dd3fc;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer">📅 Tarihler</button>` : `<button type="button" ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_mk'); })} style="padding:4px 9px;background:#fff;color:#0c4a6e;border:1px solid #7dd3fc;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer">🔍 Kabul Komisyonu</button>`}
        <button type="button" ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_kalemler'); })} style="padding:4px 9px;background:#fff;color:#0c4a6e;border:1px solid #7dd3fc;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer">📦 Kalemler</button>
        <button type="button" ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_ymTeklif'); })} style="padding:4px 9px;background:#fff;color:#0c4a6e;border:1px solid #7dd3fc;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer">📊 Y.M. Teklif</button>
        <button type="button" ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_resmiTeklif'); })} style="padding:4px 9px;background:#fff;color:#0c4a6e;border:1px solid #7dd3fc;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer">🏷️ Resmi Teklif</button>
        <button type="button" ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_kesinti'); })} style="padding:4px 9px;background:#fff;color:#0c4a6e;border:1px solid #7dd3fc;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer">🧮 Kesintiler</button>
        <button type="button" ${dtmEventAttr('click', function(event) { veriGirisBolumeGit('vgCard_dokuman'); })} style="padding:4px 9px;background:#fff;color:#0c4a6e;border:1px solid #7dd3fc;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer">📎 Doküman Yükle</button>
      </div>
      <button type="button" id="vgTumKartlarToggleBtn" ${dtmEventAttr('click', function(event) { veriGirisTumKartlariDaraltAc(); })}
        style="padding:4px 10px;background:#0c4a6e;color:#fff;border:1px solid #075985;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;white-space:nowrap">
        ↕️ Daralt / Aç
      </button>
    </div>`;

  return `
    ${kilitBanner}
    ${hesaplamaHatalari.length ? renderHesaplamaUyarisi(hesaplamaHatalari) : ''}
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <h2>Veri Giriş Formu</h2>
        <p>Proje bilgilerini girin, belgeler otomatik oluşturulacaktır.</p>
      </div>
      <button type="button" ${dtmEventAttr('click', function(event) { acProjeSablonKopyalaModal(proje, proje.isAdi || 'Proje'); })}
        style="padding:8px 14px;background:#faf5ff;color:#6d28d9;border:1.5px solid #ddd6fe;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px"
        title="Bu projenin kalemlerini, görevlilerini ve şartnamesini kopyalayarak yeni bir taslak proje oluştur">
        📑 Bu Projeden Kopyala (Şablon)
      </button>
    </div>
    ${canliDurumVeHizliMenuHtml}

    <!-- PROJE BİLGİLERİ -->
    <div id="vgCard_proje" class="card" style="border:1.5px solid #bae6fd;background:#f0f9ff4d">
      <div class="card-header" style="background:#0c4a6e;color:#fff;border-bottom:1px solid #075985" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <h3 style="color:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span>📋 Proje Bilgileri</span>
          <span style="background:#0369a1;color:#e0f2fe;font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px">GENEL BİLGİLER</span>
        </h3>
        <span class="toggle-icon" style="color:#bae6fd">&#9660;</span>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label>İdare Adı</label>
            <select id="idareAdi" ${dtmEventAttr('change', function(event) { onFieldChange('idareAdi', this.value) })}>
              ${referans.idareList.map(i => `<option value="${escAttr(i)}" ${proje.idareAdi === i ? 'selected' : ''}>${escHtml(i)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Müdürlük</label>
            <select id="mudurluk" ${dtmEventAttr('change', function(event) { onFieldChange('mudurluk', this.value) })}>
              ${referans.mudurlukler.map(m => `<option value="${escAttr(m)}" ${proje.mudurluk === m ? 'selected' : ''}>${escHtml(m)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group full-width">
            <label>Yapılan İş / Hizmet Adı</label>
            <input type="text" id="isAdi" value="${escAttr(proje.isAdi)}" ${dtmEventAttr('change', function(event) { onFieldChange('isAdi', this.value) })}>
          </div>
          <div class="form-group full-width" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:16px">
            <div class="form-group">
              <label>İş Türü</label>
              <select id="isTuru" ${dtmEventAttr('change', function(event) { onFieldChange('isTuru', this.value); renderPage(); })}>
                ${referans.isTurleri.map(t => {
                  // Hangi türün seçilebilir olduğu data.js'teki IS_TURLERI listesinde tanımlı
                  const tanim = getIsTuruTanim(t);
                  const aktif = tanim ? tanim.aktif : false;
                  return `<option value="${escAttr(t)}" ${proje.isTuru === t ? 'selected' : ''} ${!aktif ? 'disabled style="color:#9ca3af"' : ''}>${escHtml(t)}${!aktif ? ' (yakında)' : ''}</option>`;
                }).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>KDV Oranı (%)</label>
              <select id="kdvOrani" ${dtmEventAttr('change', function(event) { onFieldChange('kdvOrani', this.value) })}>
                ${[...new Set([0, ...referans.kdvOranlari])].map(k => `<option value="${escAttr(k)}" ${proje.kdvOrani == k ? 'selected' : ''}>${escHtml(k)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Şehir</label>
              <input type="text" id="sehir" value="${escAttr(proje.sehir)}" ${dtmEventAttr('change', function(event) { onFieldChange('sehir', this.value) })}>
            </div>
            <div class="form-group">
              <label>İlçe</label>
              <select id="ilce" ${dtmEventAttr('change', function(event) { onFieldChange('ilce', this.value) })}>
                <option value="">-- Seçin --</option>
                ${referans.ilceler.map(i => `<option value="${escAttr(i)}" ${proje.ilce === i ? 'selected' : ''}>${escHtml(i)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- GÖREVLİLER -->
    <div id="vgCard_ymGorevli" class="card" style="border:1.5px solid #bae6fd;background:#f0f9ff4d">
      <div class="card-header" style="background:#0c4a6e;color:#fff;border-bottom:1px solid #075985" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <h3 style="color:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span>👥 Y.M. Görevlileri</span>
          <span style="background:#0369a1;color:#e0f2fe;font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px">YAKLAŞIK MALİYET OLURU</span>
        </h3>
        <span class="toggle-icon" style="color:#bae6fd">&#9660;</span>
      </div>
      <div class="card-body">
        <div style="margin-bottom:14px;padding:10px 14px;background:#e0f2fe;border:1.5px dashed #7dd3fc;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <span style="font-size:13px;color:#0c4a6e;font-weight:600">📄 Olur belgesinden (PDF / Fotoğraf) otomatik doldur</span>
          <label style="cursor:pointer;padding:6px 16px;background:#0284c7;color:#fff;border-radius:6px;font-size:13px;font-weight:600;white-space:nowrap;user-select:none">
            Olur Belgesi Seç
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg" style="display:none" ${dtmEventAttr('change', function(event) { parseYMOluru(this.files[0]);this.value='' })}>
          </label>
        </div>
        ${ymGorevliRows}
        ${ymEkleBtn}
        <div class="form-grid" style="margin-top:12px">
          <div class="form-group">
            <label>Y.M. Onay Tarihi</label>
            <input type="date" id="ymOnayTarihi" value="${escAttr(proje.ymOnayTarihi)}" ${dtmEventAttr('change', function(event) { onFieldChange('ymOnayTarihi', this.value) })}>
          </div>
          <div class="form-group">
            <label>Onay Sayısı</label>
            <input type="text" id="ymOnayNo" value="${escAttr(proje.ymOnayNo)}" ${dtmEventAttr('change', function(event) { onFieldChange('ymOnayNo', this.value) })}>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Y.M. Tutanak Tarihi</label>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:normal;font-size:13px">
                <input type="checkbox" ${proje.ymTutanakTarihiAyni !== false ? 'checked' : ''} ${dtmEventAttr('change', function(event) { onFieldChange('ymTutanakTarihiAyni', this.checked);renderPage() })}>
                Onay tarihi ile aynı
              </label>
              ${proje.ymTutanakTarihiAyni !== false
                ? `<span style="font-size:13px;color:var(--gray-500)">${proje.ymOnayTarihi ? formatDate(proje.ymOnayTarihi) : '(Önce onay tarihi girin)'}</span>`
                : `<input type="date" value="${escAttr(proje.ymTutanakTarihi || '')}" ${dtmEventAttr('change', function(event) { onFieldChange('ymTutanakTarihi', this.value) })}>`
              }
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="vgCard_dtGorevli" class="card" style="border:1.5px solid #bae6fd;background:#f0f9ff4d">
      <div class="card-header" style="background:#0c4a6e;color:#fff;border-bottom:1px solid #075985" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <h3 style="color:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span>👥 D.T. Görevlileri</span>
          <span style="background:#0369a1;color:#e0f2fe;font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px">DOĞRUDAN TEMİN OLURU</span>
        </h3>
        <span class="toggle-icon" style="color:#bae6fd">&#9660;</span>
      </div>
      <div class="card-body">
        <div style="margin-bottom:14px;padding:10px 14px;background:#e0f2fe;border:1.5px dashed #7dd3fc;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <span style="font-size:13px;color:#0c4a6e;font-weight:600">📄 Olur belgesinden (PDF / Fotoğraf) otomatik doldur</span>
          <label style="cursor:pointer;padding:6px 16px;background:#0284c7;color:#fff;border-radius:6px;font-size:13px;font-weight:600;white-space:nowrap;user-select:none">
            Olur Belgesi Seç
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg" style="display:none" ${dtmEventAttr('change', function(event) { parseDTOluru(this.files[0]);this.value='' })}>
          </label>
        </div>

        <div style="margin-bottom:14px;padding:10px 14px;background:#f8fafc;border:1px solid #bae6fd;border-radius:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;color:#0c4a6e;user-select:none">
            <input type="checkbox" id="dtGorevliAyniCb" ${proje.dtGorevlilerYmIleAyni ? 'checked' : ''} ${dtmEventAttr('change', function(event) { onDtGorevliAyniToggle(this.checked) })} style="width:16px;height:16px;accent-color:#0284c7;cursor:pointer">
            <span>👥 Yaklaşık Maliyet Görevlileri ile aynı kişiler</span>
          </label>
          ${proje.dtGorevlilerYmIleAyni ? '<p style="margin:4px 0 0 24px;font-size:12px;color:#0369a1">Y.M. görevlilerinde yapılan değişiklikler otomatik olarak buraya yansıtılır.</p>' : ''}
        </div>

        ${dtGorevliRows}
        ${!proje.dtGorevlilerYmIleAyni ? dtEkleBtn : ''}
        <div class="form-grid" style="margin-top:12px">
          <div class="form-group">
            <label>D.T. Onay Tarihi</label>
            <input type="date" id="dtOnayTarihi" value="${escAttr(proje.dtOnayTarihi)}" ${dtmEventAttr('change', function(event) { onFieldChange('dtOnayTarihi', this.value) })}>
          </div>
          <div class="form-group">
            <label>Onay Sayısı</label>
            <input type="text" id="dtOnayNo" value="${escAttr(proje.dtOnayNo)}" ${dtmEventAttr('change', function(event) { onFieldChange('dtOnayNo', this.value) })}>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Teklif Tutanağı Tarihi</label>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:normal;font-size:13px">
                <input type="checkbox" ${proje.dtTutanakTarihiAyni !== false ? 'checked' : ''} ${dtmEventAttr('change', function(event) { onFieldChange('dtTutanakTarihiAyni', this.checked);renderPage() })}>
                Onay tarihi ile aynı
              </label>
              ${proje.dtTutanakTarihiAyni !== false
                ? `<span style="font-size:13px;color:var(--gray-500)">${proje.dtOnayTarihi ? formatDate(proje.dtOnayTarihi) : '(Önce onay tarihi girin)'}</span>`
                : `<input type="date" value="${escAttr(proje.dtTutanakTarihi || '')}" ${dtmEventAttr('change', function(event) { onFieldChange('dtTutanakTarihi', this.value) })}>`
              }
            </div>
          </div>
        </div>
      </div>
    </div>

    ${currentDTMUser?.role === 'gerceklestirmeci' ? `<div class="card" style="border:1.5px solid #bae6fd;background:#f0f9ff4d">
      <div class="card-header" style="background:#0c4a6e;color:#fff;border-bottom:1px solid #075985" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <h3 style="color:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span>📑 Onay Belgesi Bilgileri</span>
          <span style="background:#0369a1;color:#e0f2fe;font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px">ÖDENEK & BÜTÇE</span>
        </h3>
        <span class="toggle-icon" style="color:#bae6fd">&#9660;</span>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Kullanılabilir Ödenek Tutarı (TL)</label>
            <input type="number" min="0" step="0.01" id="odenek" value="${escAttr(proje.odenek)}" ${dtmEventAttr('input', function(event) { onFieldChange('odenek', this.value) })} placeholder="0.00">
          </div>
          <div class="form-group">
            <label>Yatırım Proje Numarası</label>
            <input type="text" id="yatirimProjeNo" value="${escAttr(proje.yatirimProjeNo)}" ${dtmEventAttr('input', function(event) { onFieldChange('yatirimProjeNo', this.value) })} placeholder="Varsa giriniz">
          </div>
          <div class="form-group">
            <label>Bütçe Tertibi</label>
            <input type="text" id="butceTertibi" value="${escAttr(proje.butceTertibi)}" ${dtmEventAttr('input', function(event) { onFieldChange('butceTertibi', this.value) })} placeholder="Örn: 09.1.2.00.000/05/03.8">
          </div>
          <div class="form-group">
            <label>İşin Miktarı</label>
            <input type="text" id="isMiktari" value="${!isMalVeyaHizmetTuru(proje.isTuru) ? '1 Adet' : escAttr(proje.isMiktari || '')}"
              ${!isMalVeyaHizmetTuru(proje.isTuru) ? 'readonly style="background:#f3f4f6"' : ''}
              ${dtmEventAttr('input', function(event) { onFieldChange('isMiktari', this.value) })} placeholder="Örn: 5 Adet">
          </div>
          <div class="form-group">
            <label>Avans Verilecek mi</label>
            <select id="avansVar" ${dtmEventAttr('change', function(event) { onFieldChange('avansVar', this.value) })}>
              <option value="Hayır" ${(proje.avansVar||'Hayır')==='Hayır'?'selected':''}>Hayır</option>
              <option value="Evet" ${proje.avansVar==='Evet'?'selected':''}>Evet</option>
            </select>
          </div>
          <div class="form-group">
            <label>Fiyat Farkı Uygulanacak mı</label>
            <select id="fiyatFarkiVar" ${dtmEventAttr('change', function(event) { onFieldChange('fiyatFarkiVar', this.value) })}>
              <option value="Hayır" ${(proje.fiyatFarkiVar||'Hayır')==='Hayır'?'selected':''}>Hayır</option>
              <option value="Evet" ${proje.fiyatFarkiVar==='Evet'?'selected':''}>Evet</option>
            </select>
          </div>
          <div class="form-group">
            <label>Şartname Düzenlenecek mi</label>
            <select id="sartnameVar" ${dtmEventAttr('change', function(event) { onFieldChange('sartnameVar', this.value) })}>
              <option value="Düzenlenecek" ${(proje.sartnameVar||'Düzenlenecek')==='Düzenlenecek'?'selected':''}>Düzenlenecek</option>
              <option value="Düzenlenmeyecek" ${proje.sartnameVar==='Düzenlenmeyecek'?'selected':''}>Düzenlenmeyecek</option>
            </select>
          </div>
          <div class="form-group">
            <label>Sözleşme Düzenlenecek mi</label>
            <select id="sozlesmeVar" ${dtmEventAttr('change', function(event) { onFieldChange('sozlesmeVar', this.value) })}>
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
              ${dtmEventAttr('input', function(event) { onFieldChange('gerceklestirmeGorevlisi', {ad:this.value,unvan:document.getElementById('gerceklestirmeUnvan').value}) })}>
          </div>
          <div class="form-group">
            <label>Ünvanı</label>
            <input type="text" id="gerceklestirmeUnvan" value="${escAttr(proje.gerceklestirmeGorevlisi?.unvan||'Gerçekleştirme Görevlisi')}"
              ${dtmEventAttr('input', function(event) { onFieldChange('gerceklestirmeGorevlisi', {ad:document.getElementById('gerceklestirmeAd').value,unvan:this.value}) })}>
          </div>
        </div>
      </div>
    </div>` : ''}

    <div id="vgCard_amir" class="card" style="border:1.5px solid #bae6fd;background:#f0f9ff4d">
      <div class="card-header" style="background:#0c4a6e;color:#fff;border-bottom:1px solid #075985" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <h3 style="color:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span>✒️ Onaylayan Amir</span>
          <span style="background:#0369a1;color:#e0f2fe;font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px">İHALE YETKİLİSİ / OLUR</span>
        </h3>
        <span class="toggle-icon" style="color:#bae6fd">&#9660;</span>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Amir Adı</label>
            <select id="onaylayanAmir" ${dtmEventAttr('change', function(event) { onAmirChange(this) })}>
              <option value="">-- Seçin --</option>
              ${referans.onaylayanList.filter(o=>o.ad).map(o => `<option value="${escAttr(o.ad)}" ${proje.onaylayanAmir.ad === o.ad ? 'selected' : ''}>${escHtml(o.ad)}</option>`).join('')}
              ${proje.onaylayanAmir?.ad && !referans.onaylayanList.some(o => o.ad === proje.onaylayanAmir.ad) ? `<option value="${escAttr(proje.onaylayanAmir.ad)}" selected>${escHtml(proje.onaylayanAmir.ad)}</option>` : ''}
            </select>
          </div>
          <div class="form-group">
            <label>Ünvanı</label>
            <input type="text" id="onaylayanUnvan" value="${escAttr(proje.onaylayanAmir.unvan)}" readonly>
          </div>
        </div>
      </div>
    </div>

    ${!isMalVeyaHizmetTuru(proje.isTuru) ? `
    <!-- TARİHLER -->
    <div id="vgCard_tarih" class="card" style="border:1.5px solid #bae6fd;background:#f0f9ff4d">
      <div class="card-header" style="background:#0c4a6e;color:#fff;border-bottom:1px solid #075985" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <h3 style="color:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span>📅 Sözleşme ve Tarihler</span>
          <span style="background:#0369a1;color:#e0f2fe;font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px">SÜRE & İŞ BİTİMİ</span>
        </h3>
        <span class="toggle-icon" style="color:#bae6fd">&#9660;</span>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Sözleşme Tarihi</label>
            <input type="date" id="sozlesmeTarihi" value="${escAttr(proje.sozlesmeTarihi)}" ${dtmEventAttr('change', function(event) { onFieldChange('sozlesmeTarihi', this.value) })}>
          </div>
          <div class="form-group">
            <label>İş Süresi (Takvim Günü)</label>
            <input type="number" id="isSuresi" value="${escAttr(proje.isSuresi)}" ${dtmEventAttr('input', function(event) { onFieldChange('isSuresi', this.value) })}>
          </div>
          <div class="form-group">
            <label>İşin Bitirilmesi Gereken Tarih</label>
            <div style="display:flex;align-items:center;gap:8px">
              <input type="text" id="bitisTarihi" value="${escAttr(formatDate(calculateEndDate(proje.sozlesmeTarihi, proje.isSuresi)))}" readonly style="flex:1">
              <button type="button" ${dtmEventAttr('click', function(event) { (function(){ document.getElementById('bitisTarihi').value = formatDate(calculateEndDate(proje.sozlesmeTarihi, proje.isSuresi)); })() })} title="Tarihi Güncelle" style="padding:6px 10px;background:#fff;color:#555;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;font-size:14px;white-space:nowrap;transition:all 0.15s" ${dtmEventAttr('mouseover', function(event) { this.style.borderColor='#1a56db';this.style.color='#1a56db' })} ${dtmEventAttr('mouseout', function(event) { this.style.borderColor='#d1d5db';this.style.color='#555' })}>&#x21BB;</button>
            </div>
          </div>
          <div class="form-group">
            <label>İşin Fiili Bitim Tarihi</label>
            <input type="date" id="fiiliBitimTarihi" value="${escAttr(proje.fiiliBitimTarihi)}" ${dtmEventAttr('change', function(event) { onFieldChange('fiiliBitimTarihi', this.value) })}>
          </div>
          <div class="form-group">
            <label>Bitti Tutanağı Ekleri <span style="font-weight:400;color:var(--gray-400);font-size:11px">(opsiyonel)</span></label>
            <div id="bittiEkleriList">
              ${(Array.isArray(proje.bittiEkleri) ? proje.bittiEkleri : proje.bittiEkleri ? [proje.bittiEkleri] : []).map((ek, i) => `
                <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
                  <span style="min-width:20px;font-size:13px;color:var(--gray-500);font-weight:600">${i + 1}-</span>
                  <input type="text" value="${escAttr(ek)}" data-ek-index="${i}" placeholder="Ek açıklaması"
                    style="flex:1" ${dtmEventAttr('change', function(event) { onBittiEkChange(this) })}>
                  <button type="button" ${dtmEventAttr('click', function(event) { onBittiEkSil((i)) })}
                    style="padding:5px 9px;background:#fff;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;color:#6b7280;font-size:14px;line-height:1;transition:all 0.15s"
                    ${dtmEventAttr('mouseover', function(event) { this.style.borderColor='#ef4444';this.style.color='#ef4444' })}
                    ${dtmEventAttr('mouseout', function(event) { this.style.borderColor='#d1d5db';this.style.color='#6b7280' })}>✕</button>
                </div>`).join('')}
            </div>
            <button type="button" ${dtmEventAttr('click', function(event) { onBittiEkEkle() })}
              class="btn btn-outline btn-sm" style="margin-top:4px">+ Ek Ekle</button>
          </div>
        </div>
      </div>
    </div>` : ''}

    ${isMalVeyaHizmetTuru(proje.isTuru) ? `
    <!-- MUAYENE VE KABUL KOMİSYONU / HEYETİ -->
    <div id="vgCard_mk" class="card" style="border:1.5px solid #bae6fd;background:#f0f9ff4d">
      <div class="card-header" style="background:#0c4a6e;color:#fff;border-bottom:1px solid #075985" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <h3 style="color:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span>🔍 Muayene ve Kabul Komisyonu (Heyeti)</span>
          <span style="background:#0369a1;color:#e0f2fe;font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px">KABUL KOMİSYONU</span>
        </h3>
        <span class="toggle-icon" style="color:#bae6fd">&#9660;</span>
      </div>
      <div class="card-body">
        ${mkGorevliRows}
        ${mkEkleBtn}
        <div class="form-grid" style="margin-top:14px">
          <div class="form-group">
            <label>Muayene Kabul Tarihi</label>
            <input type="date" id="mkKabulTarihi" value="${escAttr(proje.mkKabulTarihi || '')}" ${dtmEventAttr('change', function(event) { onFieldChange('mkKabulTarihi', this.value) })}>
          </div>
          <div class="form-group">
            <label>Komisyon Atama Tarihi</label>
            <input type="date" id="mkAtamaTarihi" value="${escAttr(proje.mkAtamaTarihi || '')}" ${dtmEventAttr('change', function(event) { onFieldChange('mkAtamaTarihi', this.value) })}>
          </div>
          <div class="form-group">
            <label>Komisyon Atama Olur / Karar Sayısı</label>
            <input type="text" id="mkAtamaSayisi" value="${escAttr(proje.mkAtamaSayisi || '')}" ${dtmEventAttr('input', function(event) { onFieldChange('mkAtamaSayisi', this.value) })} placeholder="Örn: E-12345678-xxx-987">
          </div>
        </div>
      </div>
    </div>` : ''}

    <!-- İŞ KALEMLERİ -->
    <div id="vgCard_kalemler" class="card" style="border:1.5px solid #bae6fd;background:#f0f9ff4d">
      <div class="card-header" style="background:#0c4a6e;color:#fff;border-bottom:1px solid #075985" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <h3 style="color:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span>📦 İş Kalemleri</span>
          <span style="background:#0369a1;color:#e0f2fe;font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px">ALIM / YAPIM KALEMLERİ</span>
        </h3>
        <span class="toggle-icon" style="color:#bae6fd">&#9660;</span>
      </div>
      ${kalemlerSection}
    </div>

    <!-- YAKLAŞIK MALİYET FİRMALARI -->
    <div id="vgCard_ymTeklif" class="card" style="border:1.5px solid #bae6fd;background:#f0f9ff4d">
      <div class="card-header" style="background:#0c4a6e;color:#fff;border-bottom:1px solid #075985" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <h3 style="color:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span>📊 Yaklaşık Maliyet - Firma Teklifleri</span>
          <span style="background:#0369a1;color:#e0f2fe;font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px">PİYASA FİYAT ARAŞTIRMASI</span>
        </h3>
        <span class="toggle-icon" style="color:#bae6fd">&#9660;</span>
      </div>
      <div class="card-body">
        ${ymFirmaRows}
        <div style="margin-top:12px; padding:12px 14px; background:${ymSinirAsildi ? '#fef2f2' : '#e0f2fe'}; border-radius:8px; border:${ymSinirAsildi ? '1.5px solid #fca5a5' : '1.5px solid #7dd3fc'}; color:#0c4a6e">
          <strong>Yaklaşık Maliyet: ${formatCurrency(yaklasikMaliyet)} TL</strong>
          <span style="color:#0369a1; margin-left:10px;">(${sayidanYaziya(yaklasikMaliyet)})</span>
          ${ymSinirAsildi ? '<div style="color:#dc2626;font-size:12px;margin-top:4px;font-weight:600">⚠️ Doğrudan Temin sınırı aşıldı!</div>' : ''}
        </div>
      </div>
    </div>

    <!-- TEKLİF FİRMALARI -->
    <div id="vgCard_resmiTeklif" class="card" style="border:1.5px solid #bae6fd;background:#f0f9ff4d">
      <div class="card-header" style="background:#0c4a6e;color:#fff;border-bottom:1px solid #075985" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-right:10px;flex-wrap:wrap;gap:8px">
          <h3 style="color:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span>🏷️ Resmi Teklif - Firma Teklifleri</span>
            <span style="background:#0369a1;color:#e0f2fe;font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px">TEKLİF MEKTUBUDUR</span>
          </h3>
          ${!currentProjeKilitli ? `
            <button type="button" ${dtmEventAttr('click', function(event) { event.stopPropagation(); ymFirmalariniTeklifeKopyala(); })}
              style="padding:5px 12px;background:#0284c7;color:#fff;border:1px solid #7dd3fc;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px"
              title="Yaklaşık Maliyet bölümünde seçtiğiniz firmaları buraya tek tıkla kopyalar">
              📋 Y.M. Firmalarını Buraya Aktar
            </button>
          ` : ''}
        </div>
        <span class="toggle-icon" style="color:#bae6fd">&#9660;</span>
      </div>
      <div class="card-body">
        ${!currentProjeKilitli ? `
          <div style="margin-bottom:12px;padding:9px 14px;background:#e0f2fe;border:1px solid #7dd3fc;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <span style="font-size:12.5px;color:#0c4a6e;font-weight:600">💡 Yaklaşık maliyet araştırmasındaki firmalar resmi teklifte de aynıysa tekrar tek tek seçmeyin:</span>
            <button type="button" ${dtmEventAttr('click', function(event) { ymFirmalariniTeklifeKopyala(); })}
              style="padding:6px 14px;background:#0284c7;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">
              📋 Y.M. Firmalarını Resmi Teklife Kopyala
            </button>
          </div>
        ` : ''}
        ${teklifFirmaRows}
      </div>
    </div>

    <!-- HAKEDİŞ KESİNTİLERİ -->
    <div id="vgCard_kesinti" class="card" style="border:1.5px solid #bae6fd;background:#f0f9ff4d">
      <div class="card-header" style="background:#0c4a6e;color:#fff;border-bottom:1px solid #075985" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <h3 style="color:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span>🧮 Hakediş Kesintileri</span>
          <span style="background:#0369a1;color:#e0f2fe;font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px">VERGİ & KESİNTİLER</span>
        </h3>
        <span class="toggle-icon" style="color:#bae6fd">&#9660;</span>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Önceki Hakediş Tutarı (TL)</label>
            <input type="number" step="0.01" min="0" value="${escAttr(proje.oncekiHakedisTutar)}" ${dtmEventAttr('change', function(event) { onFieldChange('oncekiHakedisTutar', this.value) })}>
          </div>
          <div class="form-group">
            <label>Fiyat Farkı (TL)</label>
            <input type="number" step="0.01" value="${escAttr(proje.fiyatFarki)}" ${dtmEventAttr('change', function(event) { onFieldChange('fiyatFarki', this.value) })}>
          </div>
          <div class="form-group">
            <label>Sözleşme Damga Vergisi (TL)</label>
            <input type="number" step="0.01" min="0" value="${escAttr(proje.sozlesmeDamgaVergisi)}" ${dtmEventAttr('change', function(event) { onFieldChange('sozlesmeDamgaVergisi', this.value) })}>
          </div>
          <div class="form-group">
            <label>SGK Kesintisi (TL)</label>
            <input type="number" step="0.01" min="0" value="${escAttr(proje.sgkKesintisi)}" ${dtmEventAttr('change', function(event) { onFieldChange('sgkKesintisi', this.value) })}>
          </div>
          <div class="form-group">
            <label>Vergi Borcu (TL)</label>
            <input type="number" step="0.01" min="0" value="${escAttr(proje.vergiBorcu)}" ${dtmEventAttr('change', function(event) { onFieldChange('vergiBorcu', this.value) })}>
          </div>
          <div class="form-group">
            <label>Gecikme Cezası (TL)</label>
            <input type="number" step="0.01" min="0" value="${escAttr(proje.gecikmeCezasi)}" ${dtmEventAttr('change', function(event) { onFieldChange('gecikmeCezasi', this.value) })}>
          </div>
          <div class="form-group">
            <label>Avans Mahsubu (TL)</label>
            <input type="number" step="0.01" min="0" value="${escAttr(proje.avansMahsubu)}" ${dtmEventAttr('change', function(event) { onFieldChange('avansMahsubu', this.value) })}>
          </div>
        </div>
      </div>
    </div>

    <div id="vgCard_dokuman" class="card" style="border:1.5px solid #bae6fd;background:#f0f9ff4d">
      <div class="card-header" style="background:#0c4a6e;color:#fff;border-bottom:1px solid #075985" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-right:10px;flex-wrap:wrap;gap:8px">
          <h3 style="color:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span>📎 İşe Ait Dokümanlar (Fatura, Vergi Borcu, Fotoğraf, Olur & Teklif)</span>
            <span style="background:#0369a1;color:#e0f2fe;font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px">EVRAK & FOTOĞRAF ARŞİVİ</span>
          </h3>
          <button type="button" ${dtmEventAttr('click', function(event) { event.stopPropagation(); projeDokumanlarSekmesineGit(); })}
            style="padding:5px 12px;background:#0284c7;color:#fff;border:1px solid #7dd3fc;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">
            📎 Dokümanlar Sekmesinde Gör →
          </button>
        </div>
        <span class="toggle-icon" style="color:#bae6fd">&#9660;</span>
      </div>
      <div class="card-body">
        <div id="projeDosyaListesi" style="margin-bottom:8px">
          <p style="color:var(--gray-400);font-size:13px">Yükleniyor...</p>
        </div>
      </div>
    </div>

    ${!currentProjeKilitli ? `
    <div style="position:sticky;bottom:0;background:#fff;border-top:1px solid #e5e7eb;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:100;box-shadow:0 -2px 8px rgba(0,0,0,0.06)">
      <span style="font-size:13px;color:#6b7280">
        ${currentCloudProjeId ? '💡 Değişikliklerinizi kaydetmeyi unutmayın.' : '💡 Proje henüz kaydedilmedi. Kaydettiğinizde bekleyen dokümanlar da buluta aktarılır.'}
      </span>
      <button class="btn btn-primary" ${dtmEventAttr('click', function(event) { cloudKaydet() })} style="min-width:140px">
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
  projeDosyaListesiYukle();
}

function formatDosyaBoyutu(bayt) {
  if (!bayt) return '';
  if (bayt < 1024) return bayt + ' B';
  if (bayt < 1024 * 1024) return (bayt / 1024).toFixed(0) + ' KB';
  return (bayt / 1024 / 1024).toFixed(1) + ' MB';
}

const PROJE_DOKUMAN_KATEGORILERI = [
  {
    kod: 'fotograf',
    sekmeAd: '📸 Fotoğraflar',
    baslik: '📸 İş / Yapım Fotoğrafları',
    kisaAd: 'Fotoğraf',
    aciklama: 'Yapılan işin, onarımın veya alınan malzemelerin fotoğrafları',
    etiket: '[Fotoğraf]',
    bg: '#fefce8',
    border: '#fde047',
    badgeBg: '#fef08a',
    text: '#854d0e',
    btnBg: '#ca8a04'
  },
  {
    kod: 'fatura',
    sekmeAd: '🧾 Fatura',
    baslik: '🧾 Fatura Belgeleri',
    kisaAd: 'Fatura',
    aciklama: 'İşe ait e-Arşiv / e-Fatura PDF veya fotoğrafı',
    etiket: '[Fatura]',
    bg: '#eff6ff',
    border: '#93c5fd',
    badgeBg: '#dbeafe',
    text: '#1e40af',
    btnBg: '#2563eb'
  },
  {
    kod: 'vergi',
    sekmeAd: '🏛️ Vergi Borcu Yoktur',
    baslik: '🏛️ Vergi / SGK Borcu Yoktur',
    kisaAd: 'Vergi Borcu',
    aciklama: 'Vergi dairesi veya SGK borcu yoktur yazıları',
    etiket: '[Vergi Borcu]',
    bg: '#f0fdf4',
    border: '#86efac',
    badgeBg: '#dcfce7',
    text: '#166534',
    btnBg: '#16a34a'
  },
  {
    kod: 'diger',
    sekmeAd: '📁 Diğer Belgeler',
    baslik: '📁 Diğer Belgeler',
    kisaAd: 'Belge',
    aciklama: 'Olur yazıları, teklif mektupları, şartname ekleri, tutanaklar ve diğer resmi evraklar',
    etiket: '[Diğer]',
    bg: '#f8fafc',
    border: '#cbd5e1',
    badgeBg: '#e2e8f0',
    text: '#334155',
    btnBg: '#475569'
  }
];

let currentDokumanKategori = 'fotograf';

function tespitProjeDosyaKategorisi(dosyaMeta) {
  if (dosyaMeta && dosyaMeta.kategori) {
    if (dosyaMeta.kategori === 'olur_teklif') return 'diger';
    if (PROJE_DOKUMAN_KATEGORILERI.some(k => k.kod === dosyaMeta.kategori)) {
      return dosyaMeta.kategori;
    }
  }
  const ad = String(dosyaMeta?.ad || dosyaMeta?.name || '').trim();
  if (/^\[Fatura\]/i.test(ad)) return 'fatura';
  if (/^\[Vergi Borcu\]/i.test(ad)) return 'vergi';
  if (/^\[Fotoğraf\]/i.test(ad)) return 'fotograf';
  if (/^\[(Olur-Teklif|Diğer)\]/i.test(ad)) return 'diger';

  if (/fatura|earsiv|e-arşiv|efatura/i.test(ad)) return 'fatura';
  if (/vergi|borcu|sgk|vkn|maliye/i.test(ad)) return 'vergi';
  if (/olur|teklif|piyasa|yaklasik|yaklaşık|onay/i.test(ad)) return 'diger';
  const tip = String(dosyaMeta?.tip || dosyaMeta?.type || '').toLowerCase();
  if (tip.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif)$/i.test(ad)) return 'fotograf';
  return 'diger';
}

function temizProjeDosyaAdi(ad) {
  return String(ad || '').replace(/^\[(Fatura|Vergi Borcu|Fotoğraf|Olur-Teklif|Diğer)\]\s*/i, '').trim() || 'Belge';
}

function etiketliProjeDosyasiOlustur(dosya, kategoriKod = 'diger', altEtiket = '') {
  if (!dosya) return dosya;
  const normKod = kategoriKod === 'olur_teklif' ? 'diger' : kategoriKod;
  const kat = PROJE_DOKUMAN_KATEGORILERI.find(k => k.kod === normKod) || PROJE_DOKUMAN_KATEGORILERI[3];
  const hamAd = temizProjeDosyaAdi(dosya.name || 'belge');
  const noktaIdx = hamAd.lastIndexOf('.');
  const uzanti = noktaIdx >= 0 ? hamAd.slice(noktaIdx) : '';
  const govde = noktaIdx >= 0 ? hamAd.slice(0, noktaIdx) : hamAd;
  const onEk = `${kat.etiket} ${altEtiket ? altEtiket + ' - ' : ''}`;
  const maxGovde = Math.max(10, 240 - onEk.length - uzanti.length);
  const yeniAd = `${onEk}${govde.slice(0, maxGovde)}${uzanti}`;

  try {
    if (typeof File === 'function' && typeof Blob === 'function' && dosya instanceof Blob) {
      return new File([dosya], yeniAd, { type: dosya.type || '', lastModified: dosya.lastModified || Date.now() });
    }
  } catch(_) {}
  return Object.assign({}, dosya, { name: yeniAd });
}

window._projeDosyalariCache = {};
window._sonProjeDosyalariListesi = [];
window._bekleyenProjeDosyalari = [];
window._seciliProjeDokumanlari = new Set();
window._dokumanGaleriDurumu = {
  acik: false,
  liste: [],
  aktifIndex: 0,
  zoom: 1,
  rotation: 0,
  aktifBlobUrl: null
};

function dokumanIndirmeIzniVarMi() {
  return currentPage !== 'veri-giris';
}

function dokumanPaneliniYenile() {
  const container = document.getElementById('projeDosyaListesi');
  if (!container) return;
  const saltOkunur = Boolean(currentProjeKilitli || currentGerceklestirmeciReadOnly || currentPage === 'proje-ozet');
  container.innerHTML = renderKategoriDokumanKutulari(window._sonProjeDosyalariListesi || [], saltOkunur);
}

window.dokumanKategoriSec = function(kod) {
  if (!PROJE_DOKUMAN_KATEGORILERI.some(k => k.kod === kod)) return;
  currentDokumanKategori = kod;
  dokumanPaneliniYenile();
};

function projeDokumanlarSekmesineGit() {
  if (currentCloudProjeId) {
    currentBelgelerProjeId = currentCloudProjeId;
  }
  currentBelge = 'dokumanlar';
  currentPage = 'dokumanlar';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('[data-page="dokumanlar"]')?.classList.add('active');
  renderPage();
}

function dokumanGoruntuMu(ad, tip) {
  const t = String(tip || '').toLowerCase();
  const a = String(ad || '').toLowerCase();
  return t.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif)$/i.test(a);
}

function dokumanPdfMi(ad, tip) {
  const t = String(tip || '').toLowerCase();
  const a = String(ad || '').toLowerCase();
  return t === 'application/pdf' || /\.pdf$/i.test(a);
}

function dataUrlToUint8Array(dataUrl) {
  const parts = String(dataUrl || '').split(';base64,');
  const rawBase64 = parts.length > 1 ? parts[1] : parts[0];
  const bin = atob(rawBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

// Saf JS ile standart ZIP (STORE + UTF-8 dosya adı) oluşturucu
const _zipCrcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function _hesaplaCrc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = _zipCrcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function olusturProjeDokumanZipBlob(dosyaGirdileri) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const kullanilanAdlar = new Map();

  const now = new Date();
  const dosTime = ((now.getHours() & 0x1F) << 11) | ((now.getMinutes() & 0x3F) << 5) | ((now.getSeconds() >> 1) & 0x1F);
  const dosDate = (((Math.max(1980, now.getFullYear()) - 1980) & 0x7F) << 9) | (((now.getMonth() + 1) & 0x0F) << 5) | (now.getDate() & 0x1F);

  for (const girdi of dosyaGirdileri) {
    let safAd = String(girdi.zipYolu || girdi.ad || 'belge')
      .replace(/[\\:*?"<>|]/g, '_')
      .replace(/^\/+/, '');
    if (!safAd) safAd = 'belge';

    const anahtar = safAd.toLocaleLowerCase('tr');
    const adet = kullanilanAdlar.get(anahtar) || 0;
    kullanilanAdlar.set(anahtar, adet + 1);
    if (adet > 0) {
      const nokta = safAd.lastIndexOf('.');
      if (nokta > 0) safAd = `${safAd.slice(0, nokta)} (${adet + 1})${safAd.slice(nokta)}`;
      else safAd = `${safAd} (${adet + 1})`;
    }

    const nameBytes = encoder.encode(safAd);
    const dataBytes = girdi.bytes instanceof Uint8Array ? girdi.bytes : new Uint8Array(girdi.bytes || []);
    const crc = _hesaplaCrc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true);         // Version needed
    lv.setUint16(6, 0x0800, true);     // UTF-8 filename flag
    lv.setUint16(8, 0, true);          // Compression method: 0 (STORE)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory signature
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);     // UTF-8 filename flag
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, dataBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + size;
  }

  const centralSize = centralParts.reduce((acc, p) => acc + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, dosyaGirdileri.length, true);
  ev.setUint16(10, dosyaGirdileri.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
}

function tetikleBlobIndirme(blob, dosyaAdi) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = dosyaAdi || 'belge';
  if (document.body && typeof document.body.appendChild === 'function') {
    document.body.appendChild(a);
  }
  if (typeof a.click === 'function') a.click();
  if (typeof a.remove === 'function') a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

async function cozDokumanKaydiVerisi(kayit) {
  if (!kayit) throw new Error('Belge bulunamadı.');
  if (kayit.kaynak === 'cloud') {
    const d = window._projeDosyalariCache?.[kayit.docId] || kayit.raw;
    if (!d) throw new Error('Bulut belgesi bulunamadı.');
    let dataUrl = d.url;
    if (d.parcali && !dataUrl) {
      dataUrl = await projeDosyaIcerigiGetir(d.projeId, d.docId, d);
      d.url = dataUrl;
    }
    if (!dataUrl) throw new Error('Belge içeriği boş.');
    const temizAd = temizProjeDosyaAdi(d.ad);
    const mime = (typeof dosyaMimeTipiBelirle === 'function' ? dosyaMimeTipiBelirle({ name: temizAd }) : '') || d.tip || 'application/octet-stream';
    const bytes = dataUrlToUint8Array(dataUrl);
    const blob = new Blob([bytes], { type: mime });
    return { temizAd, dataUrl, mime, bytes, blob, boyut: d.boyut || bytes.length, kategoriKod: kayit.kategoriKod };
  } else if (kayit.kaynak === 'pending') {
    const item = (window._bekleyenProjeDosyalari || [])[kayit.bekleyenIdx] || kayit.raw;
    if (!item || !item.file) throw new Error('Bekleyen belge bulunamadı.');
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(item.file);
    });
    const temizAd = (item.altEtiket ? `${item.altEtiket} - ` : '') + temizProjeDosyaAdi(item.file.name || 'Belge');
    const mime = (typeof dosyaMimeTipiBelirle === 'function' ? dosyaMimeTipiBelirle({ name: temizAd }) : '') || item.file.type || 'application/octet-stream';
    const bytes = dataUrlToUint8Array(dataUrl);
    const blob = new Blob([bytes], { type: mime });
    return { temizAd, dataUrl, mime, bytes, blob, boyut: item.file.size || bytes.length, kategoriKod: kayit.kategoriKod };
  }
  throw new Error('Geçersiz belge kaynağı.');
}
const dokumanOgesiCozumle = cozDokumanKaydiVerisi;

function tumNormalizedDokumanKayitlariniGetir() {
  const dosyalar = window._sonProjeDosyalariListesi || [];
  const bekleyenler = (!currentCloudProjeId && Array.isArray(window._bekleyenProjeDosyalari))
    ? window._bekleyenProjeDosyalari
    : [];

  const liste = [];
  dosyalar.forEach(d => {
    const katKod = tespitProjeDosyaKategorisi(d);
    const temizAd = temizProjeDosyaAdi(d.ad);
    liste.push({
      key: `cloud:${d.docId}`,
      kaynak: 'cloud',
      docId: d.docId,
      kategoriKod: katKod,
      temizAd,
      boyut: d.boyut || 0,
      tip: d.tip || '',
      yukleyenAd: d.yukleyenAd || '',
      thumbUrl: (dokumanGoruntuMu(temizAd, d.tip) && d.url && d.url.startsWith('data:image/')) ? d.url : '',
      raw: d
    });
  });

  bekleyenler.forEach((b, idx) => {
    const f = b.file || {};
    const katKod = b.kategori === 'olur_teklif' ? 'diger' : (b.kategori || tespitProjeDosyaKategorisi(f));
    const temizAd = (b.altEtiket ? `${b.altEtiket} - ` : '') + temizProjeDosyaAdi(f.name || 'Belge');
    liste.push({
      key: `pending:${idx}`,
      kaynak: 'pending',
      bekleyenIdx: idx,
      kategoriKod: katKod,
      temizAd,
      boyut: f.size || 0,
      tip: f.type || '',
      yukleyenAd: '',
      thumbUrl: '',
      raw: b
    });
  });

  return liste;
}

// ===================== SEÇİM & İNDİRME İŞLEMLERİ =====================
window.dokumanSecimDegistir = function(key) {
  if (!key) return;
  if (window._seciliProjeDokumanlari.has(key)) {
    window._seciliProjeDokumanlari.delete(key);
  } else {
    window._seciliProjeDokumanlari.add(key);
  }
  dokumanPaneliniYenile();
};

window.dokumanKategoriTumunuSec = function(kategoriKod) {
  const tumu = tumNormalizedDokumanKayitlariniGetir().filter(k => !kategoriKod || k.kategoriKod === kategoriKod);
  if (!tumu.length) return;
  const hepsiSecili = tumu.every(k => window._seciliProjeDokumanlari.has(k.key));
  if (hepsiSecili) {
    tumu.forEach(k => window._seciliProjeDokumanlari.delete(k.key));
  } else {
    tumu.forEach(k => window._seciliProjeDokumanlari.add(k.key));
  }
  dokumanPaneliniYenile();
};

window.dokumanTumSecimiTemizle = function() {
  window._seciliProjeDokumanlari.clear();
  dokumanPaneliniYenile();
};

window.projeDosyaIndir = async function(docId) {
  const kayit = tumNormalizedDokumanKayitlariniGetir().find(k => k.key === `cloud:${docId}`);
  if (!kayit) return;
  try {
    if (typeof showToast === 'function' && kayit.raw?.parcali && !kayit.raw?.url) {
      showToast('⏳ Dosya hazırlanıyor...', 'info', 2000);
    }
    const veri = await cozDokumanKaydiVerisi(kayit);
    tetikleBlobIndirme(veri.blob, veri.temizAd);
  } catch (e) {
    if (typeof showToast === 'function') showToast('Dosya indirilemedi: ' + (e.message || e), 'error');
  }
};

window.bekleyenProjeDosyaIndir = async function(idx) {
  const kayit = tumNormalizedDokumanKayitlariniGetir().find(k => k.key === `pending:${idx}`);
  if (!kayit) return;
  try {
    const veri = await cozDokumanKaydiVerisi(kayit);
    tetikleBlobIndirme(veri.blob, veri.temizAd);
  } catch (e) {
    if (typeof showToast === 'function') showToast('Dosya indirilemedi: ' + (e.message || e), 'error');
  }
};

window.topluProjeDokumanIndir = async function(kapsam = 'secili', mod = 'zip') {
  const tumKayitlar = tumNormalizedDokumanKayitlariniGetir();
  let hedefler = [];
  if (kapsam === 'secili') {
    hedefler = tumKayitlar.filter(k => window._seciliProjeDokumanlari.has(k.key));
  } else if (kapsam === 'kategori') {
    hedefler = tumKayitlar.filter(k => k.kategoriKod === currentDokumanKategori);
  } else if (kapsam === 'tumu') {
    hedefler = tumKayitlar;
  }

  if (!hedefler.length) {
    if (typeof showToast === 'function') showToast('İndirilecek belge seçilmedi.', 'warning');
    return;
  }

  try {
    // Tek dosya varsa doğrudan indir
    if (hedefler.length === 1 && mod !== 'zip-zorla') {
      const veri = await cozDokumanKaydiVerisi(hedefler[0]);
      tetikleBlobIndirme(veri.blob, veri.temizAd);
      if (typeof showToast === 'function') showToast('✅ Belge indirildi.', 'success');
      return;
    }

    if (typeof showToast === 'function') {
      showToast(`⏳ ${hedefler.length} adet belge hazırlanıyor, lütfen bekleyin...`, 'info', 3000);
    }

    if (mod === 'tektek') {
      for (let i = 0; i < hedefler.length; i++) {
        const veri = await cozDokumanKaydiVerisi(hedefler[i]);
        tetikleBlobIndirme(veri.blob, veri.temizAd);
        if (i < hedefler.length - 1) {
          await new Promise(r => setTimeout(r, 260));
        }
      }
      if (typeof showToast === 'function') showToast(`✅ ${hedefler.length} adet belge indirildi.`, 'success');
      return;
    }

    // ZIP modu (varsayılan)
    const klasorAdMap = {
      fotograf: '1_Fotograflar',
      fatura: '2_Fatura',
      vergi: '3_Vergi_Borcu_Yoktur',
      diger: '4_Diger_Belgeler'
    };

    const zipGirdileri = [];
    for (const kayit of hedefler) {
      const veri = await cozDokumanKaydiVerisi(kayit);
      const klasor = kapsam === 'tumu' ? (klasorAdMap[kayit.kategoriKod] || 'Belgeler') + '/' : '';
      zipGirdileri.push({
        ad: veri.temizAd,
        zipYolu: klasor + veri.temizAd,
        bytes: veri.bytes
      });
    }

    const zipBlob = olusturProjeDokumanZipBlob(zipGirdileri);
    const projeAdTemiz = String(proje?.isAdi || 'Proje')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, '_')
      .slice(0, 45)
      .replace(/^_+|_+$/g, '') || 'Proje';
    const altEk = kapsam === 'kategori'
      ? `_${klasorAdMap[currentDokumanKategori] || currentDokumanKategori}`
      : (kapsam === 'secili' ? `_Secili_${hedefler.length}_Belge` : '_Tum_Dokumanlar');

    tetikleBlobIndirme(zipBlob, `${projeAdTemiz}${altEk}.zip`);
    if (typeof showToast === 'function') {
      showToast(`📦 ${hedefler.length} belge tek ZIP paketi olarak indirildi!`, 'success');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Toplu indirme hatası: ' + (e.message || e), 'error');
  }
};

// ===================== GALERİ (LIGHTBOX) & KLAVYE GEÇİŞ SİSTEMİ =====================
function dokumanGaleriKlavyeBagla() {
  if (window._dokumanGaleriKeybound) return;
  window._dokumanGaleriKeybound = true;
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('keydown', function(e) {
      if (!window._dokumanGaleriDurumu?.acik) return;
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        window.dokumanGaleriGezin(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        window.dokumanGaleriGezin(1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        window.dokumanGaleriKapat();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        window.dokumanGaleriZoom(0.25);
      } else if (e.key === '-') {
        e.preventDefault();
        window.dokumanGaleriZoom(-0.25);
      } else if (e.key === '0') {
        e.preventDefault();
        window.dokumanGaleriZoomSifirla();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        window.dokumanGaleriDondur();
      }
    });
  }
}

function dokumanGaleriTemizleBlob() {
  if (window._dokumanGaleriDurumu?.aktifBlobUrl) {
    try { URL.revokeObjectURL(window._dokumanGaleriDurumu.aktifBlobUrl); } catch (_) {}
    window._dokumanGaleriDurumu.aktifBlobUrl = null;
  }
}

window.dokumanGaleriKapat = function() {
  window._dokumanGaleriDurumu.acik = false;
  dokumanGaleriTemizleBlob();
  const modal = document.getElementById('dtmDokumanGaleriModal');
  if (modal) modal.remove();
};

window.dokumanGaleriZoom = function(delta) {
  const st = window._dokumanGaleriDurumu;
  if (!st.acik) return;
  st.zoom = Math.min(3.5, Math.max(0.5, Math.round((st.zoom + delta) * 100) / 100));
  dokumanGaleriDomStilGuncelle();
};

window.dokumanGaleriZoomSifirla = function() {
  const st = window._dokumanGaleriDurumu;
  if (!st.acik) return;
  st.zoom = 1;
  st.rotation = 0;
  dokumanGaleriDomStilGuncelle();
};

window.dokumanGaleriResimTiklaZoom = function() {
  const st = window._dokumanGaleriDurumu;
  if (!st.acik) return;
  st.zoom = st.zoom > 1.05 ? 1 : 1.75;
  dokumanGaleriDomStilGuncelle();
};

window.dokumanGaleriDondur = function() {
  const st = window._dokumanGaleriDurumu;
  if (!st.acik) return;
  st.rotation = (st.rotation + 90) % 360;
  dokumanGaleriDomStilGuncelle();
};

function dokumanGaleriDomStilGuncelle() {
  const st = window._dokumanGaleriDurumu;
  const img = document.getElementById('dtmGaleriAnaGorsel');
  if (img) {
    img.style.transform = `scale(${st.zoom}) rotate(${st.rotation}deg)`;
    img.style.cursor = st.zoom > 1.05 ? 'zoom-out' : 'zoom-in';
  }
  const zoomLbl = document.getElementById('dtmGaleriZoomLabel');
  if (zoomLbl) {
    zoomLbl.textContent = `%${Math.round(st.zoom * 100)}`;
  }
}

window.dokumanGaleriGezin = function(yon) {
  const st = window._dokumanGaleriDurumu;
  if (!st.acik || !st.liste.length) return;
  const len = st.liste.length;
  st.aktifIndex = (st.aktifIndex + yon + len) % len;
  st.zoom = 1;
  st.rotation = 0;
  dokumanGaleriIcerikYukle();
};

window.dokumanGaleriIndexAc = function(idx) {
  const st = window._dokumanGaleriDurumu;
  if (!st.acik || idx < 0 || idx >= st.liste.length) return;
  st.aktifIndex = idx;
  st.zoom = 1;
  st.rotation = 0;
  dokumanGaleriIcerikYukle();
};

window.dokumanGaleriAktifiIndir = async function() {
  const st = window._dokumanGaleriDurumu;
  const kayit = st.liste?.[st.aktifIndex];
  if (!kayit) return;
  try {
    const veri = await cozDokumanKaydiVerisi(kayit);
    tetikleBlobIndirme(veri.blob, veri.temizAd);
  } catch (e) {
    if (typeof showToast === 'function') showToast('Dosya indirilemedi: ' + (e.message || e), 'error');
  }
};

window.dokumanGaleriAktifiYeniSekmedeAc = async function() {
  const st = window._dokumanGaleriDurumu;
  const kayit = st.liste?.[st.aktifIndex];
  if (!kayit) return;
  try {
    const veri = await cozDokumanKaydiVerisi(kayit);
    if (typeof projeDosyaGoruntule === 'function') {
      projeDosyaGoruntule(veri.dataUrl, veri.temizAd, veri.mime);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('Dosya açılamadı: ' + (e.message || e), 'error');
  }
};

async function dokumanGaleriIcerikYukle() {
  const st = window._dokumanGaleriDurumu;
  if (!st.acik || !st.liste.length) return;

  dokumanGaleriTemizleBlob();

  let modal = document.getElementById('dtmDokumanGaleriModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dtmDokumanGaleriModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.92);z-index:99999;display:flex;flex-direction:column;justify-content:space-between;backdrop-filter:blur(6px);user-select:none';
    document.body.appendChild(modal);
  }

  const kayit = st.liste[st.aktifIndex];
  const toplam = st.liste.length;
  const katObj = PROJE_DOKUMAN_KATEGORILERI.find(k => k.kod === kayit.kategoriKod) || PROJE_DOKUMAN_KATEGORILERI[0];
  const isImg = dokumanGoruntuMu(kayit.temizAd, kayit.tip);
  const indirmeAktif = dokumanIndirmeIzniVarMi();

  // Önce yükleniyor görünümü (parçalı bulut dosyaları için)
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:rgba(15,23,42,0.85);border-bottom:1px solid rgba(255,255,255,0.12);gap:12px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1">
        <span style="background:#0284c7;color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:16px;white-space:nowrap">${st.aktifIndex + 1} / ${toplam}</span>
        <span style="background:rgba(255,255,255,0.12);color:#e2e8f0;font-size:11.5px;font-weight:600;padding:3px 9px;border-radius:8px;white-space:nowrap">${escHtml(katObj.sekmeAd)}</span>
        <div style="min-width:0;flex:1">
          <div style="color:#fff;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(kayit.temizAd)}</div>
          <div style="color:#94a3b8;font-size:11px">${formatDosyaBoyutu(kayit.boyut)}${kayit.yukleyenAd ? ' • 👤 ' + escHtml(kayit.yukleyenAd) : ''}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        ${isImg ? `
          <button type="button" ${dtmEventAttr('click', function(event) { dokumanGaleriZoom(-0.25); })} title="Uzaklaştır (-)" style="padding:7px 10px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.18);border-radius:7px;cursor:pointer;font-size:12px;font-weight:600">🔍-</button>
          <button type="button" id="dtmGaleriZoomLabel" ${dtmEventAttr('click', function(event) { dokumanGaleriZoomSifirla(); })} title="Boyutu Sıfırla (0)" style="padding:7px 10px;background:rgba(255,255,255,0.1);color:#e2e8f0;border:1px solid rgba(255,255,255,0.18);border-radius:7px;cursor:pointer;font-size:12px;font-weight:700;min-width:52px">%100</button>
          <button type="button" ${dtmEventAttr('click', function(event) { dokumanGaleriZoom(0.25); })} title="Yakınlaştır (+)" style="padding:7px 10px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.18);border-radius:7px;cursor:pointer;font-size:12px;font-weight:600">🔍+</button>
          <button type="button" ${dtmEventAttr('click', function(event) { dokumanGaleriDondur(); })} title="90° Döndür (R)" style="padding:7px 11px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.18);border-radius:7px;cursor:pointer;font-size:12px;font-weight:600">🔄 Döndür</button>
        ` : ''}
        ${indirmeAktif ? `
          <button type="button" ${dtmEventAttr('click', function(event) { dokumanGaleriAktifiIndir(); })} style="padding:7px 13px;background:#0284c7;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:5px">⬇️ İndir</button>
          <button type="button" ${dtmEventAttr('click', function(event) { dokumanGaleriAktifiYeniSekmedeAc(); })} title="Yeni Sekmede Aç" style="padding:7px 11px;background:rgba(255,255,255,0.12);color:#e2e8f0;border:1px solid rgba(255,255,255,0.2);border-radius:7px;cursor:pointer;font-size:12px;font-weight:600">↗ Yeni Sekme</button>
        ` : ''}
        <button type="button" ${dtmEventAttr('click', function(event) { dokumanGaleriKapat(); })} title="Kapat (Esc)" style="padding:7px 13px;background:#dc2626;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12.5px;font-weight:700">✕ Kapat</button>
      </div>
    </div>

    <div style="flex:1;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:16px 68px" ${dtmEventAttr('click', function(event) { if (event.target === this) dokumanGaleriKapat(); })}>
      ${toplam > 1 ? `
        <button type="button" ${dtmEventAttr('click', function(event) { event.stopPropagation(); dokumanGaleriGezin(-1); })} title="Önceki (Sol Ok ⬅️)"
          style="position:absolute;left:14px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(15,23,42,0.78);color:#fff;border:1.5px solid rgba(255,255,255,0.28);font-size:26px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;box-shadow:0 4px 14px rgba(0,0,0,0.35)">
          ‹
        </button>
      ` : ''}

      <div id="dtmGaleriMerkezAlan" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:auto">
        <div style="color:#cbd5e1;font-size:14px;font-weight:600">⏳ Belge yükleniyor...</div>
      </div>

      ${toplam > 1 ? `
        <button type="button" ${dtmEventAttr('click', function(event) { event.stopPropagation(); dokumanGaleriGezin(1); })} title="Sonraki (Sağ Ok ➡️)"
          style="position:absolute;right:14px;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(15,23,42,0.78);color:#fff;border:1.5px solid rgba(255,255,255,0.28);font-size:26px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;box-shadow:0 4px 14px rgba(0,0,0,0.35)">
          ›
        </button>
      ` : ''}
    </div>

    <div style="background:rgba(15,23,42,0.9);border-top:1px solid rgba(255,255,255,0.12);padding:10px 16px;display:flex;flex-direction:column;gap:6px">
      ${toplam > 1 ? `
        <div style="display:flex;align-items:center;gap:8px;overflow-x:auto;padding-bottom:2px">
          ${st.liste.map((item, idx) => {
            const aktif = idx === st.aktifIndex;
            const itemImg = dokumanGoruntuMu(item.temizAd, item.tip);
            return `
              <div ${dtmEventAttr('click', function(event) { dokumanGaleriIndexAc(Number(idx)); })}
                title="${escAttr(item.temizAd)}"
                style="display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:8px;cursor:pointer;flex-shrink:0;max-width:170px;background:${aktif ? '#0284c7' : 'rgba(255,255,255,0.08)'};border:1.5px solid ${aktif ? '#7dd3fc' : 'rgba(255,255,255,0.12)'};color:${aktif ? '#fff' : '#cbd5e1'}">
                ${item.thumbUrl
                  ? `<img src="${escAttr(item.thumbUrl)}" style="width:26px;height:26px;object-fit:cover;border-radius:4px;flex-shrink:0">`
                  : `<span style="font-size:14px">${itemImg ? '🖼️' : '📄'}</span>`}
                <span style="font-size:11.5px;font-weight:${aktif ? '700' : '500'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${idx + 1}. ${escHtml(item.temizAd)}</span>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
      <div style="text-align:center;font-size:11.5px;color:#94a3b8">
        💡 Klavyeden <strong style="color:#e2e8f0">⬅️ Sol / Sağ ➡️</strong> ok tuşlarıyla geçiş yapabilir, <strong style="color:#e2e8f0">R</strong> ile fotoğrafı döndürebilir, <strong style="color:#e2e8f0">ESC</strong> ile çıkabilirsiniz.
      </div>
    </div>
  `;

  try {
    const veri = await cozDokumanKaydiVerisi(kayit);
    if (!st.acik || st.liste[st.aktifIndex]?.key !== kayit.key) return;
    // Küçük resmi önbelleğe yaz
    if (isImg && veri.dataUrl) kayit.thumbUrl = veri.dataUrl;

    const merkez = document.getElementById('dtmGaleriMerkezAlan');
    if (!merkez) return;

    if (isImg) {
      merkez.innerHTML = `
        <img id="dtmGaleriAnaGorsel" src="${escAttr(veri.dataUrl)}" alt="${escAttr(veri.temizAd)}"
          ${dtmEventAttr('click', function(event) { event.stopPropagation(); dokumanGaleriResimTiklaZoom(); })}
          style="max-width:92%;max-height:76vh;object-fit:contain;border-radius:8px;box-shadow:0 15px 40px rgba(0,0,0,0.5);transition:transform 0.18s ease;cursor:zoom-in">
      `;
    } else if (dokumanPdfMi(veri.temizAd, veri.mime)) {
      const blobUrl = URL.createObjectURL(veri.blob);
      st.aktifBlobUrl = blobUrl;
      merkez.innerHTML = `
        <iframe src="${escAttr(blobUrl)}" style="width:92%;height:76vh;border:none;border-radius:10px;background:#fff;box-shadow:0 15px 40px rgba(0,0,0,0.5)"></iframe>
      `;
    } else {
      merkez.innerHTML = `
        <div style="background:#1e293b;border:1px solid #334155;border-radius:14px;padding:32px;text-align:center;max-width:420px;color:#fff;box-shadow:0 15px 40px rgba(0,0,0,0.4)">
          <div style="font-size:46px;margin-bottom:12px">📄</div>
          <div style="font-size:16px;font-weight:700;margin-bottom:6px;word-break:break-word">${escHtml(veri.temizAd)}</div>
          <div style="font-size:12.5px;color:#94a3b8;margin-bottom:20px">${formatDosyaBoyutu(veri.boyut)} • Office / İndirilebilir Belge</div>
          ${indirmeAktif ? `
            <button type="button" ${dtmEventAttr('click', function(event) { dokumanGaleriAktifiIndir(); })}
              style="padding:10px 22px;background:#0284c7;color:#fff;border:none;border-radius:8px;font-size:13.5px;font-weight:700;cursor:pointer">
              ⬇️ Bilgisayara İndir
            </button>
          ` : `
            <div style="font-size:12px;color:#cbd5e1">İndirmek için sol menüdeki <strong>📎 Dokümanlar</strong> sekmesini kullanabilirsiniz.</div>
          `}
        </div>
      `;
    }
  } catch (e) {
    const merkez = document.getElementById('dtmGaleriMerkezAlan');
    if (merkez) {
      merkez.innerHTML = `<div style="color:#fca5a5;font-size:14px;font-weight:600">⚠️ Belge yüklenemedi: ${escHtml(e.message || String(e))}</div>`;
    }
  }
}

function acDokumanGaleri(hedefKey, sadeceAktifKategori = true) {
  dokumanGaleriKlavyeBagla();
  const tumKayitlar = tumNormalizedDokumanKayitlariniGetir();
  let liste = sadeceAktifKategori
    ? tumKayitlar.filter(k => k.kategoriKod === currentDokumanKategori)
    : tumKayitlar;
  if (!liste.some(k => k.key === hedefKey)) {
    liste = tumKayitlar;
  }
  const idx = liste.findIndex(k => k.key === hedefKey);
  if (idx < 0) return;

  window._dokumanGaleriDurumu = {
    acik: true,
    liste,
    aktifIndex: idx,
    zoom: 1,
    rotation: 0,
    aktifBlobUrl: null
  };
  dokumanGaleriIcerikYukle();
}

window.projeDosyaAc = async function(docId) {
  const d = window._projeDosyalariCache?.[docId];
  if (!d) return;
  if (typeof document !== 'undefined' && document.body && typeof document.body.appendChild === 'function') {
    acDokumanGaleri(`cloud:${docId}`, true);
    return;
  }
  try {
    let dataUrl = d.url;
    if (d.parcali && !dataUrl) {
      if (typeof showToast === 'function') showToast('Dosya açılıyor, lütfen bekleyin...', 'info');
      dataUrl = await projeDosyaIcerigiGetir(d.projeId, d.docId, d);
      d.url = dataUrl;
    }
    if (typeof projeDosyaGoruntule === 'function' && dataUrl) {
      projeDosyaGoruntule(dataUrl, temizProjeDosyaAdi(d.ad), d.tip);
    }
  } catch(e) {
    if (typeof showToast === 'function') showToast('Dosya açılamadı: ' + (e.message || e), 'error');
  }
};

window.bekleyenProjeDosyaAc = async function(idx) {
  const item = (window._bekleyenProjeDosyalari || [])[idx];
  if (!item || !item.file) return;
  if (typeof document !== 'undefined' && document.body && typeof document.body.appendChild === 'function') {
    acDokumanGaleri(`pending:${idx}`, true);
    return;
  }
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(item.file);
    });
    if (typeof projeDosyaGoruntule === 'function' && dataUrl) {
      projeDosyaGoruntule(dataUrl, temizProjeDosyaAdi(item.file.name), item.file.type);
    }
  } catch(e) {
    if (typeof showToast === 'function') showToast('Dosya önizlenemedi: ' + (e.message || e), 'error');
  }
};

window.bekleyenProjeDosyaSil = function(idx) {
  if (!Array.isArray(window._bekleyenProjeDosyalari)) return;
  if (idx >= 0 && idx < window._bekleyenProjeDosyalari.length) {
    window._bekleyenProjeDosyalari.splice(idx, 1);
    window._seciliProjeDokumanlari.clear();
    projeDosyaListesiYukle();
  }
};

async function bekleyenProjeDosyalariniBulutaYukle(projeId) {
  if (!projeId || !Array.isArray(window._bekleyenProjeDosyalari) || window._bekleyenProjeDosyalari.length === 0) return 0;
  const kuyruk = [...window._bekleyenProjeDosyalari];
  window._bekleyenProjeDosyalari = [];
  window._seciliProjeDokumanlari.clear();
  let basarili = 0;
  for (const item of kuyruk) {
    try {
      const etiketli = etiketliProjeDosyasiOlustur(item.file, item.kategori || 'diger', item.altEtiket || '');
      await projeDosyaYukle(projeId, etiketli);
      basarili++;
    } catch (err) {
      console.warn('Bekleyen dosya buluta yüklenemedi:', item.file?.name, err);
    }
  }
  return basarili;
}

function renderKategoriDokumanKutulari(dosyalar = [], saltOkunur = false) {
  const bekleyenler = (!currentCloudProjeId && Array.isArray(window._bekleyenProjeDosyalari))
    ? window._bekleyenProjeDosyalari
    : [];
  const toplamBulut = dosyalar.length;
  const toplamBekleyen = bekleyenler.length;
  const genelToplam = toplamBulut + toplamBekleyen;
  const indirmeAktif = dokumanIndirmeIzniVarMi();

  if (!PROJE_DOKUMAN_KATEGORILERI.some(k => k.kod === currentDokumanKategori)) {
    currentDokumanKategori = 'fotograf';
  }

  // Geçersiz seçim anahtarlarını temizle
  const gecerliAnahtarlar = new Set([
    ...dosyalar.map(d => `cloud:${d.docId}`),
    ...bekleyenler.map((_, idx) => `pending:${idx}`)
  ]);
  for (const k of Array.from(window._seciliProjeDokumanlari)) {
    if (!gecerliAnahtarlar.has(k)) window._seciliProjeDokumanlari.delete(k);
  }
  const toplamSeciliSayi = indirmeAktif ? window._seciliProjeDokumanlari.size : 0;

  // Kategori bazlı sayıları hesapla
  const kategoriVerileri = PROJE_DOKUMAN_KATEGORILERI.map(kat => {
    const katDosyalar = dosyalar.filter(d => tespitProjeDosyaKategorisi(d) === kat.kod);
    const katBekleyenler = bekleyenler
      .map((b, idx) => ({ ...b, _bekleyenIdx: idx }))
      .filter(b => {
        const bKat = b.kategori === 'olur_teklif' ? 'diger' : (b.kategori || tespitProjeDosyaKategorisi(b.file));
        return bKat === kat.kod;
      });
    return {
      kat,
      katDosyalar,
      katBekleyenler,
      toplamSayi: katDosyalar.length + katBekleyenler.length
    };
  });

  // Üst sekme menüsü (Fotoğraflar | Fatura | Vergi Borcu Yoktur | Diğer Belgeler)
  const sekmelerHtml = `
    <div class="belge-tabs" style="margin-bottom:14px">
      ${kategoriVerileri.map(({ kat, toplamSayi }) => {
        const isAktif = currentDokumanKategori === kat.kod;
        return `
          <div class="belge-tab ${isAktif ? 'active' : ''}" ${dtmEventAttr('click', function(event) { dokumanKategoriSec(String(kat.kod)); })} style="display:inline-flex;align-items:center;gap:8px">
            <span>${kat.sekmeAd}</span>
            <span style="font-size:11px;font-weight:700;padding:1px 7px;border-radius:10px;background:${isAktif ? 'rgba(255,255,255,0.22)' : 'var(--gray-200)'};color:${isAktif ? '#fff' : 'var(--gray-700)'}">${toplamSayi}</span>
          </div>`;
      }).join('')}
    </div>
  `;

  const ustBilgiHtml = !currentCloudProjeId ? `
    <div style="padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="font-size:12.5px;color:#92400e">
        💡 <strong>Proje henüz buluta kaydedilmedi.</strong> ${toplamBekleyen > 0 ? `Seçtiğiniz <strong>${toplamBekleyen} adet evrak</strong> hazır bekliyor; projeyi kaydettiğiniz anda otomatik olarak buluta yüklenecektir.` : 'Evrakları şimdiden ilgili sekmelere ekleyebilirsiniz; projeyi kaydettiğinizde otomatik olarak buluta aktarılır.'}
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${indirmeAktif && genelToplam > 0 ? `
          <button type="button" ${dtmEventAttr('click', function(event) { topluProjeDokumanIndir('tumu', 'zip'); })}
            style="padding:6px 12px;background:#0284c7;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">
            📦 Tüm Evrakları ZIP İndir (${genelToplam})
          </button>
        ` : ''}
        ${!saltOkunur ? `
          <button type="button" class="btn btn-primary btn-sm" ${dtmEventAttr('click', function(event) { cloudKaydet(); })} style="white-space:nowrap">
            💾 Projeyi ve Evrakları Şimdi Kaydet
          </button>
        ` : ''}
      </div>
    </div>
  ` : `
    <div style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <span style="font-size:12.5px;color:#334155">📎 Bu projeye kayıtlı toplam <strong>${toplamBulut} adet</strong> resmi doküman / fotoğraf bulunuyor.</span>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        ${indirmeAktif && toplamBulut > 0 ? `
          <button type="button" ${dtmEventAttr('click', function(event) { topluProjeDokumanIndir('tumu', 'zip'); })}
            style="padding:6px 12px;background:#0284c7;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
            📦 Tüm Proje Evraklarını ZIP İndir (${toplamBulut})
          </button>
        ` : ''}
        <span style="font-size:11.5px;color:#64748b">${indirmeAktif ? 'Dosya başına maks. 5 MB' : '💡 İndirme işlemleri "📎 Dokümanlar" sekmesinden yapılır'}</span>
      </div>
    </div>
  `;

  const aktifVeri = kategoriVerileri.find(v => v.kat.kod === currentDokumanKategori) || kategoriVerileri[0];
  const { kat, katDosyalar, katBekleyenler, toplamSayi } = aktifVeri;

  const aktifKategoriAnahtarlari = [
    ...katDosyalar.map(d => `cloud:${d.docId}`),
    ...katBekleyenler.map(b => `pending:${b._bekleyenIdx}`)
  ];
  const aktifKategorideSeciliSayi = indirmeAktif ? aktifKategoriAnahtarlari.filter(k => window._seciliProjeDokumanlari.has(k)).length : 0;
  const aktifKategoriHepsiSecili = indirmeAktif && aktifKategoriAnahtarlari.length > 0 && aktifKategorideSeciliSayi === aktifKategoriAnahtarlari.length;

  // Toplu seçim ve indirme araç çubuğu (SADECE Dokümanlar / Proje Özeti sayfasında gösterilir; Veri Girişi'nde gösterilmez)
  const topluIslemBarHtml = (indirmeAktif && toplamSayi > 0) ? `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;padding:9px 12px;background:rgba(255,255,255,0.78);border:1px solid ${kat.border};border-radius:8px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button type="button" ${dtmEventAttr('click', function(event) { dokumanKategoriTumunuSec(String(kat.kod)); })}
          style="padding:5px 11px;background:#fff;color:#1e293b;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px">
          <span>${aktifKategoriHepsiSecili ? '☑️ Seçimi Kaldır' : '☐ Bu Sekmedeki Tümünü Seç'}</span>
        </button>
        ${toplamSeciliSayi > 0 ? `
          <span style="font-size:12px;font-weight:700;color:#0369a1;background:#e0f2fe;padding:4px 10px;border-radius:12px">
            ${toplamSeciliSayi} belge seçildi
          </span>
          <button type="button" ${dtmEventAttr('click', function(event) { dokumanTumSecimiTemizle(); })}
            style="padding:4px 8px;background:transparent;color:#64748b;border:none;font-size:11.5px;cursor:pointer;text-decoration:underline">
            Temizle
          </button>
        ` : `<span style="font-size:11.5px;color:#64748b">💡 Fotoğraflara tıklayıp klavye ok tuşlarıyla (⬅️ ➡️) gezinebilir veya kutucukları seçip topluca indirebilirsiniz.</span>`}
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        ${kat.kod === 'fotograf' ? `
          <button type="button" ${dtmEventAttr('click', function(event) { yazdirProjeFotografRaporu(); })}
            style="padding:6px 12px;background:#0c4a6e;color:#fff;border:1px solid #075985;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px"
            title="Seçili veya tüm fotoğraflardan A4 kurumsal Fotoğraf Tutanağı / Görsel Rapor oluşturur">
            🖨️ Fotoğraf Tutanağı / PDF (${aktifKategorideSeciliSayi > 0 ? aktifKategorideSeciliSayi : toplamSayi})
          </button>
        ` : ''}
        ${toplamSeciliSayi > 0 ? `
          <button type="button" ${dtmEventAttr('click', function(event) { topluProjeDokumanIndir('secili', 'zip'); })}
            style="padding:6px 12px;background:#0284c7;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;box-shadow:0 2px 5px rgba(2,132,199,0.25)">
            📦 Seçilenleri ZIP İndir (${toplamSeciliSayi})
          </button>
          <button type="button" ${dtmEventAttr('click', function(event) { topluProjeDokumanIndir('secili', 'tektek'); })}
            style="padding:6px 11px;background:#fff;color:#0369a1;border:1px solid #7dd3fc;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">
            ⬇️ Ayrı Ayrı İndir
          </button>
        ` : `
          <button type="button" ${dtmEventAttr('click', function(event) { topluProjeDokumanIndir('kategori', 'zip'); })}
            style="padding:6px 12px;background:#fff;color:${kat.text};border:1px solid ${kat.border};border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
            📥 Bu Sekmedekileri İndir (${toplamSayi})
          </button>
        `}
      </div>
    </div>
  ` : '';

  const satirlarHtml = [
    ...katDosyalar.map((d, siraIdx) => {
      const secimKey = `cloud:${d.docId}`;
      const isSecili = indirmeAktif && window._seciliProjeDokumanlari.has(secimKey);
      const temizAd = temizProjeDosyaAdi(d.ad);
      const isImg = dokumanGoruntuMu(temizAd, d.tip);
      const thumbHtml = (isImg && d.url && d.url.startsWith('data:image/'))
        ? `<img src="${escAttr(d.url)}" alt="${escAttr(temizAd)}" style="width:46px;height:46px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;flex-shrink:0">`
        : `<span style="width:46px;height:46px;border-radius:6px;background:${kat.badgeBg};color:${kat.text};display:inline-flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${isImg ? '🖼️' : '📄'}</span>`;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:${isSecili ? '#f0f9ff' : '#fff'};border:1.5px solid ${isSecili ? '#38bdf8' : 'rgba(0,0,0,0.08)'};border-radius:8px;transition:all 0.15s">
          <div style="display:flex;align-items:center;gap:10px;overflow:hidden;flex:1">
            ${indirmeAktif ? `
              <input type="checkbox" ${isSecili ? 'checked' : ''} ${dtmEventAttr('change', function(event) { dokumanSecimDegistir(String(secimKey)); })}
                style="width:17px;height:17px;cursor:pointer;accent-color:#0284c7;flex-shrink:0" title="İndirmek için seç">
            ` : ''}
            <div style="display:flex;align-items:center;gap:10px;overflow:hidden;flex:1;cursor:pointer" ${dtmEventAttr('click', function(event) { projeDosyaAc(String(d.docId ?? '')); })} title="Galeride Aç (Klavye ok tuşlarıyla gezin)">
              ${thumbHtml}
              <div style="overflow:hidden;flex:1">
                <div style="font-size:13px;font-weight:600;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${siraIdx + 1}. ${escHtml(temizAd)}</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span>${formatDosyaBoyutu(d.boyut)}</span>
                  ${d.yukleyenAd ? `<span>• 👤 ${escHtml(d.yukleyenAd)}</span>` : ''}
                </div>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <button type="button" ${dtmEventAttr('click', function(event) { projeDosyaAc(String(d.docId ?? '')); })} style="padding:6px 11px;background:${kat.bg};color:${kat.text};border:1px solid ${kat.border};border-radius:6px;font-size:12px;font-weight:600;cursor:pointer" title="Önizleme / Galeri">👁️ Aç</button>
            ${indirmeAktif ? `<button type="button" ${dtmEventAttr('click', function(event) { projeDosyaIndir(String(d.docId ?? '')); })} style="padding:6px 10px;background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer" title="Bu Dosyayı İndir">⬇️</button>` : ''}
            ${!saltOkunur ? `<button type="button" ${dtmEventAttr('click', function(event) { projeDosyaSilOnayla(String(d.yol ?? '')); })} title="Sil" style="padding:6px 9px;background:#fff;border:1px solid #fecaca;border-radius:6px;cursor:pointer;color:#dc2626;font-size:12px">🗑️</button>` : ''}
          </div>
        </div>`;
    }),
    ...katBekleyenler.map((b, siraIdx) => {
      const secimKey = `pending:${b._bekleyenIdx}`;
      const isSecili = indirmeAktif && window._seciliProjeDokumanlari.has(secimKey);
      const f = b.file || {};
      const temizAd = (b.altEtiket ? `${b.altEtiket} - ` : '') + temizProjeDosyaAdi(f.name || 'Belge');
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:${isSecili ? '#f0f9ff' : '#fffbeb'};border:1.5px dashed ${isSecili ? '#0284c7' : '#f59e0b'};border-radius:8px">
          <div style="display:flex;align-items:center;gap:10px;overflow:hidden;flex:1">
            ${indirmeAktif ? `
              <input type="checkbox" ${isSecili ? 'checked' : ''} ${dtmEventAttr('change', function(event) { dokumanSecimDegistir(String(secimKey)); })}
                style="width:17px;height:17px;cursor:pointer;accent-color:#0284c7;flex-shrink:0" title="İndirmek için seç">
            ` : ''}
            <div style="display:flex;align-items:center;gap:10px;overflow:hidden;flex:1;cursor:pointer" ${dtmEventAttr('click', function(event) { bekleyenProjeDosyaAc(Number(b._bekleyenIdx)); })}>
              <span style="width:42px;height:42px;border-radius:6px;background:#fef3c7;color:#b45309;display:inline-flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">⏳</span>
              <div style="overflow:hidden;flex:1">
                <div style="font-size:12.5px;font-weight:600;color:#78350f;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${katDosyalar.length + siraIdx + 1}. ${escHtml(temizAd)}</div>
                <div style="font-size:11px;color:#b45309">${formatDosyaBoyutu(f.size)} • Kaydedildiğinde buluta yüklenecek</div>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <button type="button" ${dtmEventAttr('click', function(event) { bekleyenProjeDosyaAc(Number(b._bekleyenIdx)); })} style="padding:5px 10px;background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer">👁️ Önizle</button>
            ${indirmeAktif ? `<button type="button" ${dtmEventAttr('click', function(event) { bekleyenProjeDosyaIndir(Number(b._bekleyenIdx)); })} style="padding:5px 9px;background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer" title="İndir">⬇️</button>` : ''}
            ${!saltOkunur ? `<button type="button" ${dtmEventAttr('click', function(event) { bekleyenProjeDosyaSil(Number(b._bekleyenIdx)); })} style="padding:5px 9px;background:#fff;border:1px solid #fecaca;border-radius:6px;cursor:pointer;color:#dc2626;font-size:12px">✕</button>` : ''}
          </div>
        </div>`;
    })
  ].join('');

  const inputId = `projeDosyaInput_${kat.kod}`;
  const aktifKutuHtml = `
    <div style="padding:18px;background:${kat.bg};border:1.5px solid ${kat.border};border-radius:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <div style="font-size:15px;font-weight:700;color:${kat.text};display:flex;align-items:center;gap:8px">
            <span>${kat.baslik}</span>
            <span style="background:${kat.badgeBg};color:${kat.text};font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600">${toplamSayi} belge</span>
          </div>
          <div style="font-size:12px;color:${kat.text};opacity:0.85;margin-top:3px">${kat.aciklama}</div>
        </div>
        ${!saltOkunur ? `
          <label style="cursor:pointer;padding:8px 16px;background:${kat.btnBg};color:#fff;border-radius:8px;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.12)">
            <span>+ ${kat.kisaAd} Yükle</span>
            <input type="file" id="${inputId}" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style="display:none"
              ${dtmEventAttr('change', function(event) { projeDosyaSecildi(this.files, String(kat.kod)); this.value=''; })}>
          </label>
        ` : ''}
      </div>
      ${topluIslemBarHtml}
      ${toplamSayi > 0 ? `
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
          ${satirlarHtml}
        </div>
      ` : `
        <div style="padding:28px 16px;text-align:center;background:rgba(255,255,255,0.6);border:1px dashed ${kat.border};border-radius:10px;font-size:13px;color:${kat.text};opacity:0.8;margin-top:14px">
          Henüz <strong>${escHtml(kat.sekmeAd.replace(/^[^\s]+\s/, ''))}</strong> sekmesinde yüklü belge bulunmuyor.
        </div>
      `}
    </div>`;

  return sekmelerHtml + ustBilgiHtml + aktifKutuHtml;
}

async function projeDosyaListesiYukle() {
  const container = document.getElementById('projeDosyaListesi');
  if (!container) return;
  const saltOkunur = Boolean(currentProjeKilitli || currentGerceklestirmeciReadOnly || currentPage === 'proje-ozet');

  if (!currentCloudProjeId) {
    window._sonProjeDosyalariListesi = [];
    container.innerHTML = renderKategoriDokumanKutulari([], saltOkunur);
    return;
  }

  try {
    const dosyalar = await projeDosyalariGetir(currentCloudProjeId);
    window._projeDosyalariCache = {};
    dosyalar.forEach(d => { window._projeDosyalariCache[d.docId] = d; });
    window._sonProjeDosyalariListesi = dosyalar;
    if (window._projeEvrakSayiCache && currentCloudProjeId) {
      const sayac = { toplam: dosyalar.length, fotograf: 0, fatura: 0, vergi: 0, diger: 0 };
      dosyalar.forEach(d => {
        const k = tespitProjeDosyaKategorisi(d);
        if (sayac[k] !== undefined) sayac[k]++;
        else sayac.diger++;
      });
      window._projeEvrakSayiCache[currentCloudProjeId] = sayac;
    }
    container.innerHTML = renderKategoriDokumanKutulari(dosyalar, saltOkunur);
  } catch(e) {
    container.innerHTML = `<p style="color:#dc2626;font-size:13px">Dokümanlar yüklenemedi: ${escHtml(hataMesaji(e))}</p>`;
  }
}

async function yazdirProjeFotografRaporu() {
  try {
    const tumDosyalar = Array.isArray(window._sonProjeDosyalariListesi) ? window._sonProjeDosyalariListesi : [];
    const bekleyenler = Array.isArray(window._bekleyenProjeDosyalari) ? window._bekleyenProjeDosyalari : [];
    const seciliSet = window._seciliProjeDokumanlari instanceof Set ? window._seciliProjeDokumanlari : new Set();

    const fotoBulut = tumDosyalar.filter(d => tespitProjeDosyaKategorisi(d) === 'fotograf');
    const fotoBekleyen = bekleyenler
      .map((b, idx) => ({ ...b, _bekleyenIdx: idx }))
      .filter(b => tespitProjeDosyaKategorisi({ kategori: b.kategori, ad: b.file?.name, tip: b.file?.type }) === 'fotograf');

    const tumFotoOgeleri = [
      ...fotoBulut.map(d => ({ kaynak: 'cloud', docId: d.docId, ad: temizProjeDosyaAdi(d.ad), tip: d.tip || '', secimKey: `cloud:${d.docId}`, raw: d })),
      ...fotoBekleyen.map(b => ({ kaynak: 'pending', bekleyenIdx: b._bekleyenIdx, ad: temizProjeDosyaAdi(b.file?.name || 'Fotograf'), tip: b.file?.type || '', secimKey: `pending:${b._bekleyenIdx}`, raw: b }))
    ];

    const seciliFotolar = tumFotoOgeleri.filter(o => seciliSet.has(o.secimKey));
    const hedefFotolar = seciliFotolar.length > 0 ? seciliFotolar : tumFotoOgeleri;

    if (!hedefFotolar.length) {
      showToast('Yazdırılacak fotoğraf bulunamadı.', 'warning');
      return;
    }

    showToast('⏳ Fotoğraf tutanağı hazırlanıyor...', 'info', 2500);
    const cozulmusFotolar = [];
    for (let i = 0; i < hedefFotolar.length; i++) {
      const oge = hedefFotolar[i];
      const veri = await cozDokumanKaydiVerisi(oge);
      const dosyaAdi = veri?.temizAd || veri?.ad || oge?.ad || `Fotoğraf ${i + 1}`;
      const dosyaTipi = veri?.mime || veri?.tip || oge?.tip || '';
      if (veri && veri.dataUrl && (veri.dataUrl.startsWith('data:image/') || dokumanGoruntuMu(dosyaAdi, dosyaTipi))) {
        cozulmusFotolar.push({
          sira: cozulmusFotolar.length + 1,
          ad: dosyaAdi,
          dataUrl: veri.dataUrl
        });
      }
    }

    if (!cozulmusFotolar.length) {
      showToast('Fotoğraf sekmesinde görüntülenebilir resim dosyası bulunamadı.', 'warning');
      return;
    }

    const idareAdi = escHtml(proje?.idareAdi || 'T.C. KARAMAN İL ÖZEL İDARESİ');
    const mudurlukAdi = escHtml(proje?.mudurluk || 'Yatırım ve İnşaat Müdürlüğü');
    const isAdi = escHtml(proje?.isAdi || '-');
    const isTuru = escHtml(proje?.isTuru || '-');
    const raporTarihi = new Date().toLocaleDateString('tr-TR');

    const gorevliler = (isMalVeyaHizmetTuru(proje?.isTuru) && Array.isArray(proje?.mkGorevliler) && proje.mkGorevliler.some(g => g?.ad?.trim()))
      ? proje.mkGorevliler.slice(0, proje.mkGorevliSayisi || 3).filter(g => g?.ad?.trim())
      : (Array.isArray(proje?.dtGorevliler) && proje.dtGorevliler.some(g => g?.ad?.trim()))
        ? proje.dtGorevliler.slice(0, proje.dtGorevliSayisi || 1).filter(g => g?.ad?.trim())
        : (Array.isArray(proje?.ymGorevliler) ? proje.ymGorevliler.slice(0, proje.ymGorevliSayisi || 1).filter(g => g?.ad?.trim()) : []);

    const imzaHucreleri = gorevliler.length > 0
      ? gorevliler.map(g => `
          <div style="text-align:center;min-width:160px;padding:6px 10px">
            <div style="font-weight:700;font-size:12px;color:#111">${escHtml(g.ad)}</div>
            <div style="font-size:11px;color:#4b5563;margin-top:2px">${escHtml(g.unvan || getUnvanByAd(g.ad, referans) || '')}</div>
            <div style="margin-top:28px;border-top:1px dotted #9ca3af;font-size:10px;color:#6b7280;padding-top:3px">İmza</div>
          </div>
        `).join('')
      : `<div style="text-align:center;min-width:180px;padding:6px 10px">
           <div style="font-weight:700;font-size:12px;color:#111">${escHtml(currentDTMUser?.displayName || 'Kontrol Görevlisi')}</div>
           <div style="margin-top:28px;border-top:1px dotted #9ca3af;font-size:10px;color:#6b7280;padding-top:3px">İmza</div>
         </div>`;

    const fotoKartlariHtml = cozulmusFotolar.map(f => `
      <div style="border:1.5px solid #cbd5e1;border-radius:8px;padding:8px;background:#fff;page-break-inside:avoid;break-inside:avoid;display:flex;flex-direction:column;justify-content:space-between">
        <div style="width:100%;height:230px;display:flex;align-items:center;justify-content:center;background:#f8fafc;border-radius:6px;overflow:hidden;border:1px solid #e2e8f0">
          <img src="${escAttr(f.dataUrl)}" alt="${escAttr(f.ad)}" style="max-width:100%;max-height:226px;object-fit:contain;display:block">
        </div>
        <div style="margin-top:6px;display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:11px;color:#1e293b;border-top:1px solid #f1f5f9;padding-top:5px">
          <strong style="color:#0c4a6e">Fotoğraf ${f.sira}</strong>
          <span style="color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:210px">${escHtml(f.ad)}</span>
        </div>
      </div>
    `).join('');

    const raporHtml = `
      <div class="belge-icerik" style="font-family:'Times New Roman',Times,serif;color:#111;padding:8px 12px">
        <div style="text-align:center;border-bottom:2px solid #0c4a6e;padding-bottom:10px;margin-bottom:14px">
          <div style="font-size:14px;font-weight:700;letter-spacing:0.3px">T.C.</div>
          <div style="font-size:15px;font-weight:700">${idareAdi}</div>
          <div style="font-size:13px;font-weight:600;color:#334155">${mudurlukAdi}</div>
          <div style="font-size:15px;font-weight:700;color:#0c4a6e;margin-top:6px;text-decoration:underline">İŞE AİT FOTOĞRAF TUTANAĞI / GÖRSEL RAPORU</div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px">
          <tbody>
            <tr>
              <td style="border:1px solid #cbd5e1;padding:6px 10px;background:#f8fafc;font-weight:700;width:22%">İşin / Alımın Adı</td>
              <td style="border:1px solid #cbd5e1;padding:6px 10px" colspan="3"><strong>${isAdi}</strong></td>
            </tr>
            <tr>
              <td style="border:1px solid #cbd5e1;padding:6px 10px;background:#f8fafc;font-weight:700;width:22%">İş Türü</td>
              <td style="border:1px solid #cbd5e1;padding:6px 10px;width:28%">${isTuru}</td>
              <td style="border:1px solid #cbd5e1;padding:6px 10px;background:#f8fafc;font-weight:700;width:22%">Tutanak Tarihi / Adet</td>
              <td style="border:1px solid #cbd5e1;padding:6px 10px;width:28%">${raporTarihi} (${cozulmusFotolar.length} Adet Fotoğraf)</td>
            </tr>
          </tbody>
        </table>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px">
          ${fotoKartlariHtml}
        </div>

        <div style="page-break-inside:avoid;break-inside:avoid;margin-top:14px;padding-top:10px;border-top:1.5px solid #cbd5e1">
          <div style="font-size:11.5px;color:#334155;margin-bottom:12px;text-align:center">
            Yukarıda yer alan <strong>${cozulmusFotolar.length} adet</strong> fotoğraf, <strong>${isAdi}</strong> kapsamında yapılan iş/malzeme tespitine ait olup tarafımızca kayıt altına alınmıştır.
          </div>
          <div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:16px">
            ${imzaHucreleri}
          </div>
        </div>
      </div>
    `;

    const pdfDosyaAdi = 'Fotograf_Tutanagi_' + String(proje?.isAdi || 'Proje').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 40);
    belgeYazdir(raporHtml, false, false, pdfDosyaAdi);
  } catch (e) {
    showToast('Fotoğraf raporu oluşturulamadı: ' + hataMesaji(e), 'error');
  }
}

window._projeEvrakSayiCache = window._projeEvrakSayiCache || {};

function guncelleProjeEvrakRozetDom(projeId, bilgi) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(`projeEvrakRozet_${projeId}`);
  if (!el) return;
  const toplam = Number(bilgi?.toplam || 0);
  if (toplam > 0) {
    const detayParcalar = [];
    if (bilgi.fotograf > 0) detayParcalar.push(`📸${bilgi.fotograf}`);
    if (bilgi.fatura > 0) detayParcalar.push(`🧾${bilgi.fatura}`);
    if (bilgi.vergi > 0) detayParcalar.push(`🏛️${bilgi.vergi}`);
    if (bilgi.diger > 0) detayParcalar.push(`📁${bilgi.diger}`);
    const detayStr = detayParcalar.length > 0 ? ` (${detayParcalar.join(' ')})` : '';
    el.style.display = 'inline-flex';
    el.style.background = '#e0f2fe';
    el.style.color = '#0369a1';
    el.style.borderColor = '#bae6fd';
    el.textContent = `📎 ${toplam} Evrak${detayStr}`;
    el.title = `Fotoğraf: ${bilgi.fotograf || 0}, Fatura: ${bilgi.fatura || 0}, Vergi Borcu: ${bilgi.vergi || 0}, Diğer: ${bilgi.diger || 0}`;
  } else if (currentPage === 'dokumanlar') {
    el.style.display = 'inline-flex';
    el.style.background = '#f1f5f9';
    el.style.color = '#64748b';
    el.style.borderColor = '#cbd5e1';
    el.textContent = '📎 Evrak Yok';
    el.title = 'Bu projeye henüz doküman yüklenmemiş';
  } else {
    el.style.display = 'none';
  }
}

async function projeListesiEvrakRozetleriniYukle(projeler) {
  if (!Array.isArray(projeler) || !projeler.length) return;
  if (typeof projeDosyalariGetir !== 'function' || typeof db === 'undefined' || !db) return;
  if (!window._projeEvrakSayiCache) window._projeEvrakSayiCache = {};

  for (const p of projeler) {
    const pid = p?.id;
    if (!pid) continue;
    if (window._projeEvrakSayiCache[pid]) {
      guncelleProjeEvrakRozetDom(pid, window._projeEvrakSayiCache[pid]);
      continue;
    }
    try {
      const dosyalar = await projeDosyalariGetir(pid);
      const liste = Array.isArray(dosyalar) ? dosyalar : [];
      const sayac = { toplam: liste.length, fotograf: 0, fatura: 0, vergi: 0, diger: 0 };
      liste.forEach(d => {
        const k = tespitProjeDosyaKategorisi(d);
        if (sayac[k] !== undefined) sayac[k]++;
        else sayac.diger++;
      });
      window._projeEvrakSayiCache[pid] = sayac;
      guncelleProjeEvrakRozetDom(pid, sayac);
    } catch (_) {}
  }
}

if (typeof window !== 'undefined') {
  window.yazdirProjeFotografRaporu = yazdirProjeFotografRaporu;
  window.projeListesiEvrakRozetleriniYukle = projeListesiEvrakRozetleriniYukle;
}

async function projeDosyaSecildi(fileList, kategoriKod = 'diger') {
  const dosyalar = Array.from(fileList || []);
  if (!dosyalar.length) return;

  if (!currentCloudProjeId) {
    if (!Array.isArray(window._bekleyenProjeDosyalari)) window._bekleyenProjeDosyalari = [];
    dosyalar.forEach(f => {
      window._bekleyenProjeDosyalari.push({ file: f, kategori: kategoriKod, altEtiket: '' });
    });
    showToast(`${dosyalar.length} belge eklendi. Projeyi kaydettiğinizde buluta yüklenecek.`, 'info', 3500);
    projeDosyaListesiYukle();
    return;
  }

  let hataVar = false;
  showToast('⏳ Doküman(lar) buluta yükleniyor...', 'info', 2500);
  for (const dosya of dosyalar) {
    try {
      const etiketli = etiketliProjeDosyasiOlustur(dosya, kategoriKod);
      await projeDosyaYukle(currentCloudProjeId, etiketli);
    } catch(e) {
      hataVar = true;
      showToast(dosya.name + ': ' + hataMesaji(e), 'error');
    }
  }
  const input = document.getElementById('projeDosyaInput');
  if (input) input.value = '';
  if (!hataVar) showToast('✅ Doküman(lar) başarıyla yüklendi.', 'success');
  projeDosyaListesiYukle();
}

async function projeDosyaSilOnayla(yol) {
  if (!await showConfirm('Bu dokümanı silmek istediğinize emin misiniz?', 'Dokümanı Sil')) return;
  try {
    await projeDosyaSil(yol);
    showToast('Doküman silindi.', 'success');
    projeDosyaListesiYukle();
  } catch(e) {
    showToast('Hata: ' + hataMesaji(e), 'error');
  }
}

function onFieldChange(field, value) {
  if (Object.hasOwn(HESAPLAMA_ALANLARI, field)) {
    const hata = hesaplamaAlanHatasi(field, value);
    if (hata) { showToast(hata, 'warning'); renderPage(); return; }
    value = hesaplamaSayisi(value, field === 'kdvOrani' ? 20 : 0);
  }
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
  if (sub === 'miktar' && (!Number.isFinite(hesaplamaSayisi(el.value, 1)) || hesaplamaSayisi(el.value, 1) < 0)) {
    showToast('Miktar: sıfır veya pozitif bir sayı girin.', 'warning');
    el.value = proje.isKalemleri[idx][sub];
    return;
  }
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

function dtmNormalizeTurkish(str) {
  if (!str) return '';
  return str
    .replace(/[\u2018\u2019\u02BC'"]/g, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[\u0131i]/g, 'i')
    .replace(/[\u011f\u011e]/g, 'g')
    .replace(/[\u00fc\u00dc]/g, 'u')
    .replace(/[\u015f\u015e]/g, 's')
    .replace(/[\u00f6\u00d6]/g, 'o')
    .replace(/[\u00e7\u00c7]/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();
}

let dtmReferansProva = false;
function dtmAiYanitiDogrula(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Analiz yanıtı geçerli bir nesne değil.');
  const text = new Set(['ad','firmaAdi','isAdi','isTuru','onayNo','onayTarihi','gorevliAd','gorevliUnvan','onaylayanAd','onaylayanUnvan','adres','tel','faks','eposta','vkn','vergiDairesi','tur','birim','belgeTuru','teklifGrubu']);
  const numeric = new Set(['miktar','birimFiyat','toplamTutar','toplamTeklifTutari']);
  function inspect(obj) {
    for (const [key,v] of Object.entries(obj)) {
      if (v == null) continue;
      if (text.has(key) && (typeof v !== 'string' || v.length > 2000)) throw new Error(key + ': geçerli metin bekleniyor.');
      if (numeric.has(key) && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) throw new Error(key + ': sıfır veya pozitif sayı bekleniyor.');
      if (['isDT','isYM','basitUsul'].includes(key) && typeof v !== 'boolean') throw new Error(key + ': geçersiz değer.');
      if (key === 'onayTarihi' && v) {
        const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m || new Date(v+'T00:00:00Z').toISOString().slice(0,10) !== v) throw new Error('Onay tarihi geçersiz.');
      }
      if (key === 'kalemler') {
        if (!Array.isArray(v) || v.length > 100) throw new Error('Kalem listesi geçersiz.');
        v.forEach(k => { if (!k || typeof k !== 'object' || Array.isArray(k)) throw new Error('Kalem geçersiz.'); inspect(k); });
      }
      if (key === 'olur' || key === 'teklif') {
        if (typeof v !== 'object' || Array.isArray(v)) throw new Error('Belge alanı geçersiz.'); inspect(v);
      }
    }
  }
  inspect(value); return value;
}

function matchOrAddGorevli(ad, unvan) {
  if (!ad || !ad.trim()) return { ad: '', unvan: '' };
  const temizAd = ad.trim();
  if (!referans.muhendisList || !Array.isArray(referans.muhendisList)) referans.muhendisList = [];
  const norm = dtmNormalizeTurkish(temizAd);
  let match = referans.muhendisList.find(m => m && m.ad && dtmNormalizeTurkish(m.ad) === norm);
  if (match) {
    if (unvan && !match.unvan) {
      match.unvan = unvan.trim();
      if (!dtmReferansProva) saveReferans(referans);
    }
    return { ad: match.ad, unvan: match.unvan || unvan || '' };
  }
  const yeni = { ad: temizAd, unvan: unvan ? unvan.trim() : '' };
  referans.muhendisList.push(yeni);
  referans.muhendisList.sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr-TR'));
  if (!dtmReferansProva) saveReferans(referans);
  return yeni;
}

function matchOrAddOnaylayanAmir(ad, unvan) {
  if (!ad || !ad.trim()) return { ad: '', unvan: '' };
  const temizAd = ad.trim();
  if (!referans.onaylayanList || !Array.isArray(referans.onaylayanList)) referans.onaylayanList = [];
  const norm = dtmNormalizeTurkish(temizAd);
  let match = referans.onaylayanList.find(o => o && o.ad && dtmNormalizeTurkish(o.ad) === norm);
  if (match) {
    if (unvan && !match.unvan) {
      match.unvan = unvan.trim();
      if (!dtmReferansProva) saveReferans(referans);
    }
    return { ad: match.ad, unvan: match.unvan || unvan || '' };
  }
  const yeni = { ad: temizAd, unvan: unvan ? unvan.trim() : '' };
  const bosIdx = referans.onaylayanList.findIndex(o => !o.ad || !o.ad.trim());
  if (bosIdx >= 0 && unvan && referans.onaylayanList[bosIdx].unvan === unvan) {
    referans.onaylayanList[bosIdx] = yeni;
  } else {
    referans.onaylayanList.push(yeni);
  }
  if (!dtmReferansProva) saveReferans(referans);
  return yeni;
}

function matchOrAddFirma(firmaData) {
  if (!firmaData) return { firma: null, isNew: false };

  const rawAd = typeof firmaData === 'string' ? firmaData : (firmaData.ad || firmaData.firmaAdi || '');
  if (!rawAd || !rawAd.trim()) return { firma: null, isNew: false };

  const temizAd = rawAd.trim().replace(/^['"“«]+|['"”»]+$/g, '').trim();
  if (!referans.firmaList || !Array.isArray(referans.firmaList)) referans.firmaList = [];

  const rawVkn = (typeof firmaData === 'object' && firmaData.vkn) ? String(firmaData.vkn).replace(/\D/g, '') : '';
  const norm = dtmNormalizeTurkish(temizAd);

  // 1. VKN ile tam eşleşme (10 veya 11 haneli vergi/TC kimlik no)
  let match = null;
  if (rawVkn && rawVkn.length >= 10) {
    match = referans.firmaList.find(f => f && f.vkn && String(f.vkn).replace(/\D/g, '') === rawVkn);
  }

  // 2. Normalize edilmiş Türkçe isimle tam eşleşme
  if (!match) {
    match = referans.firmaList.find(f => f && f.ad && dtmNormalizeTurkish(f.ad) === norm);
  }

  if (match) {
    let degisti = false;
    if (typeof firmaData === 'object') {
      if ((!match.adres || match.adres.length < 10) && firmaData.adres && firmaData.adres.trim().length >= 10) {
        match.adres = firmaData.adres.trim();
        degisti = true;
      } else if (!match.adres && firmaData.adres) {
        match.adres = firmaData.adres.trim();
        degisti = true;
      }
      if (!match.tel && telefonNormalize(firmaData.tel)) { match.tel = telefonNormalize(firmaData.tel); degisti = true; }
      if (!match.eposta && firmaData.eposta) { match.eposta = firmaData.eposta.trim(); degisti = true; }
      if (!match.vkn && rawVkn) { match.vkn = rawVkn; degisti = true; }
      if (!match.vergiDairesi && firmaData.vergiDairesi) { match.vergiDairesi = firmaData.vergiDairesi.trim(); degisti = true; }
      if (match.basitUsul === undefined && firmaData.basitUsul !== undefined) { match.basitUsul = !!firmaData.basitUsul; degisti = true; }
    }
    if (degisti && !dtmReferansProva) {
      saveReferans(referans);
      if (typeof firmaHavuzaSenkronizeEt === 'function') firmaHavuzaSenkronizeEt(match);
    }
    return { firma: match, isNew: false };
  }

  // Yeni firma oluştur ve kaydet
  const tespitTur = (typeof firmaData === 'object' && (firmaData.tur === 'Şirket' || firmaData.tur === 'Kişi'))
    ? firmaData.tur
    : (/ltd|a\.ş|şti|şirket|ticaret|sanayi|san\.|tic\./i.test(temizAd) ? 'Şirket' : 'Kişi');

  const yeni = {
    ad: temizAd,
    tur: tespitTur,
    adres: (typeof firmaData === 'object' && firmaData.adres) ? firmaData.adres.trim() : '',
    tel: typeof firmaData === 'object' ? telefonNormalize(firmaData.tel) : '',
    faks: typeof firmaData === 'object' ? telefonNormalize(firmaData.faks) : '',
    eposta: (typeof firmaData === 'object' && firmaData.eposta) ? firmaData.eposta.trim() : '',
    vkn: rawVkn || '',
    vergiDairesi: (typeof firmaData === 'object' && firmaData.vergiDairesi) ? firmaData.vergiDairesi.trim() : '',
    basitUsul: typeof firmaData === 'object' ? !!firmaData.basitUsul : false
  };

  referans.firmaList.push(yeni);
  referans.firmaList.sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr-TR'));
  if (!dtmReferansProva) {
    saveReferans(referans);
    if (typeof firmaHavuzaSenkronizeEt === 'function') firmaHavuzaSenkronizeEt(yeni);
  }

  return { firma: yeni, isNew: true };
}

function dtmTopluBelgeleriDerleVeHazirla(parsedResults) {
  const original = referans, previous = dtmReferansProva;
  const baseline = JSON.stringify(original);
  referans = JSON.parse(baseline); dtmReferansProva = true;
  try {
    (parsedResults || []).forEach(dtmAiYanitiDogrula);
    const result = dtmTopluBelgeleriDerle(parsedResults);
    if (result) { result.onayReferansi = referans; result.referansSurumu = baseline; }
    return result;
  } finally { referans = original; dtmReferansProva = previous; }
}
function dtmTopluBelgeleriDerle(parsedResults) {
  if (!parsedResults || !Array.isArray(parsedResults) || parsedResults.length === 0) return null;

  let isAdi = '';
  let isTuru = 'Yapım İşi';
  let ymOnayNo = '';
  let ymOnayTarihi = '';
  let dtOnayNo = '';
  let dtOnayTarihi = '';
  let ymGorevli = null;
  let dtGorevli = null;
  let onaylayanAmir = null;
  const teklifListesi = [];
  const ymTeklifListesi = [];
  const dtTeklifListesi = [];
  const genelTeklifListesi = [];
  const yeniEklenenFirmalar = [];
  let okunanOlurSayisi = 0;
  let okunanTeklifSayisi = 0;

  for (const item of parsedResults) {
    if (!item) continue;

    // 1. Olur belgesi kontrolü
    const o = item.olur || (item.belgeTuru === 'olur' ? item : null);
    if (o && (o.isAdi || o.onayNo || o.gorevliAd || o.onaylayanAd)) {
      okunanOlurSayisi++;
      if (o.isAdi && !isAdi) isAdi = o.isAdi.trim();
      if (o.isTuru) isTuru = o.isTuru;
      if (o.isYM) {
        if (o.onayNo) ymOnayNo = o.onayNo;
        if (o.onayTarihi) ymOnayTarihi = o.onayTarihi;
        if (o.gorevliAd) ymGorevli = { ad: o.gorevliAd, unvan: o.gorevliUnvan || '' };
      }
      if (o.isDT) {
        if (o.onayNo) dtOnayNo = o.onayNo;
        if (o.onayTarihi) dtOnayTarihi = o.onayTarihi;
        if (o.gorevliAd) dtGorevli = { ad: o.gorevliAd, unvan: o.gorevliUnvan || '' };
      }
      if (!o.isYM && !o.isDT) {
        if (o.onayNo) { ymOnayNo = ymOnayNo || o.onayNo; dtOnayNo = dtOnayNo || o.onayNo; }
        if (o.onayTarihi) { ymOnayTarihi = ymOnayTarihi || o.onayTarihi; dtOnayTarihi = dtOnayTarihi || o.onayTarihi; }
        if (o.gorevliAd) { ymGorevli = ymGorevli || { ad: o.gorevliAd, unvan: o.gorevliUnvan || '' }; }
      }
      if (o.onaylayanAd && !onaylayanAmir) {
        onaylayanAmir = { ad: o.onaylayanAd, unvan: o.onaylayanUnvan || '' };
      }
    }

    // 2. Teklif mektubu kontrolü
    const t = item.teklif || (item.belgeTuru === 'teklif' ? item : null);
    if (t && (t.firmaAdi || t.toplamTeklifTutari > 0 || (Array.isArray(t.kalemler) && t.kalemler.length > 0))) {
      okunanTeklifSayisi++;
      const firmaSonuc = matchOrAddFirma(t);
      const firmaAd = (firmaSonuc && firmaSonuc.firma && firmaSonuc.firma.ad) ? firmaSonuc.firma.ad : (t.firmaAdi || 'Firma');
      if (firmaSonuc && firmaSonuc.isNew && !yeniEklenenFirmalar.includes(firmaAd)) {
        yeniEklenenFirmalar.push(firmaAd);
      }
      const grup = item.teklifGrubu || t.teklifGrubu || '';
      const teklifKaydi = {
        firmaAd,
        vkn: t.vkn || '',
        toplamTeklifTutari: Number(t.toplamTeklifTutari) || 0,
        kalemler: Array.isArray(t.kalemler) ? t.kalemler : [],
        isNew: firmaSonuc ? firmaSonuc.isNew : false,
        teklifGrubu: grup
      };
      teklifListesi.push(teklifKaydi);
      if (grup === 'ym') ymTeklifListesi.push(teklifKaydi);
      else if (grup === 'dt') dtTeklifListesi.push(teklifKaydi);
      else genelTeklifListesi.push(teklifKaydi);
    }
  }

  // Eğer hiçbir şey bulunamadıysa null dön
  if (!isAdi && teklifListesi.length === 0 && !ymOnayNo && !dtOnayNo) {
    return null;
  }

  // Ana kalem listesini tespit et
  const masterKalemler = [];
  let enZenginTeklif = teklifListesi.reduce((max, cur) => ((cur.kalemler && cur.kalemler.length > (max.kalemler?.length || 0)) ? cur : max), { kalemler: [] });

  if (enZenginTeklif.kalemler && enZenginTeklif.kalemler.length > 0) {
    enZenginTeklif.kalemler.forEach(k => {
      masterKalemler.push({
        ad: (k.ad || '').trim() || (isAdi || 'Kalem'),
        miktar: Number(k.miktar) > 0 ? Number(k.miktar) : 1,
        birim: k.birim || 'Adet'
      });
    });
    if (masterKalemler.length > 1 && !isTuru.includes('Mal')) {
      isTuru = 'Mal Alımı';
    }
  } else {
    masterKalemler.push({
      ad: isAdi || 'Yapım / Onarım İşi',
      miktar: 1,
      birim: isMalVeyaHizmetTuru(isTuru) ? 'Adet' : '***'
    });
  }

  // Firmaların tekliflerini masterKalemler ile eşleştirme yardımcısı
  function eslestirTeklifGrubu(liste) {
    return liste.map(t => {
      const fiyatlar = [];
      masterKalemler.forEach((mk) => {
        const matches = (t.kalemler || []).filter(k => k && k.ad && dtmNormalizeTurkish(k.ad) === dtmNormalizeTurkish(mk.ad) && dtmNormalizeTurkish(k.birim || 'Adet') === dtmNormalizeTurkish(mk.birim || 'Adet'));
        let foundKalem = matches.length === 1 && Number(matches[0].miktar) === Number(mk.miktar) ? matches[0] : null;
        if (!foundKalem && masterKalemler.length === 1 && Array.isArray(t.kalemler) && t.kalemler.length === 1 && t.kalemler[0] && Number(t.kalemler[0].miktar || 1) === Number(mk.miktar || 1)) {
          foundKalem = t.kalemler[0];
        }
        if (foundKalem && Number(foundKalem.birimFiyat) > 0) {
          fiyatlar.push(Number(foundKalem.birimFiyat));
        } else if (masterKalemler.length === 1 && t.kalemler.length === 0 && t.toplamTeklifTutari > 0) {
          const m = Number(mk.miktar) || 1;
          fiyatlar.push(Math.round((t.toplamTeklifTutari / m) * 100) / 100);
        } else {
          fiyatlar.push(0);
        }
      });

      const hesaplananToplam = masterKalemler.reduce((acc, mk, ki) => acc + (fiyatlar[ki] || 0) * (Number(mk.miktar) || 1), 0);
      return {
        ad: t.firmaAd,
        fiyatlar,
        toplam: Math.round(hesaplananToplam * 100) / 100,
        eksik: fiyatlar.some(f => !(f > 0)) || (t.toplamTeklifTutari > 0 && Math.abs(t.toplamTeklifTutari - hesaplananToplam) > 0.02) || t.kalemler.length > masterKalemler.length,
        isNew: t.isNew
      };
    });
  }

  const ayriYmDt = ymTeklifListesi.length > 0 && dtTeklifListesi.length > 0;
  const firmalarTeklifData = ayriYmDt
    ? eslestirTeklifGrubu([...dtTeklifListesi, ...genelTeklifListesi])
    : eslestirTeklifGrubu(teklifListesi);
  const ymFirmalarData = ayriYmDt
    ? eslestirTeklifGrubu([...ymTeklifListesi, ...genelTeklifListesi])
    : firmalarTeklifData;

  // Taslak projeyi oluştur
  const projeTaslak = getDefaultProje();
  projeTaslak.isAdi = isAdi || (masterKalemler[0]?.ad ? masterKalemler[0].ad : 'Yeni Proje');
  projeTaslak.isTuru = isTuru;

  if (ymOnayNo)     projeTaslak.ymOnayNo = ymOnayNo;
  if (ymOnayTarihi) projeTaslak.ymOnayTarihi = ymOnayTarihi;
  if (dtOnayNo)     projeTaslak.dtOnayNo = dtOnayNo;
  if (dtOnayTarihi) projeTaslak.dtOnayTarihi = dtOnayTarihi;

  if (ymGorevli) {
    const g = matchOrAddGorevli(ymGorevli.ad, ymGorevli.unvan);
    projeTaslak.ymGorevliler[0].ad = g.ad;
    projeTaslak.ymGorevliler[0].unvan = g.unvan;
    projeTaslak.ymGorevliSayisi = 1;
  }
  if (dtGorevli) {
    const g = matchOrAddGorevli(dtGorevli.ad, dtGorevli.unvan);
    projeTaslak.dtGorevliler[0].ad = g.ad;
    projeTaslak.dtGorevliler[0].unvan = g.unvan;
    projeTaslak.dtGorevliSayisi = 1;
  }
  if (onaylayanAmir) {
    const a = matchOrAddOnaylayanAmir(onaylayanAmir.ad, onaylayanAmir.unvan);
    projeTaslak.onaylayanAmir = { ad: a.ad, unvan: a.unvan };
  }

  // Kalemleri yerleştir (en az 5 kalem slotu)
  const projeKalemler = masterKalemler.map(k => ({ ...k }));
  while (projeKalemler.length < 5) {
    projeKalemler.push({ ad: '', miktar: '', birim: '' });
  }
  projeTaslak.isKalemleri = projeKalemler;

  function firmaSlotlariniHazirla(dataList) {
    const hazir = dataList.map(f => {
      const fyt = [...f.fiyatlar];
      while (fyt.length < projeTaslak.isKalemleri.length) fyt.push(0);
      return { ad: f.ad, fiyatlar: fyt, analizEksik: f.eksik };
    });
    while (hazir.length < 3) {
      hazir.push({ ad: '', fiyatlar: new Array(projeTaslak.isKalemleri.length).fill(0) });
    }
    return hazir;
  }

  // Firmaları yerleştir (en az 3 firma slotu)
  projeTaslak.teklifFirmalar = firmaSlotlariniHazirla(firmalarTeklifData);
  projeTaslak.ymFirmalar = ayriYmDt
    ? firmaSlotlariniHazirla(ymFirmalarData)
    : projeTaslak.teklifFirmalar.map(f => ({ ad: f.ad, fiyatlar: [...f.fiyatlar] }));

  // Kazanan firma ve yaklaşık maliyet hesapla
  const kazananIdx = hesaplaKazananFirma(projeTaslak);
  projeTaslak.kazananFirmaIndex = kazananIdx;
  const yaklasikMaliyet = hesaplaYaklasikMaliyet(projeTaslak);

  return {
    proje: projeTaslak,
    masterKalemler,
    firmalarTeklifData,
    ymFirmalarData,
    ayriYmDt,
    yeniEklenenFirmalar,
    okunanOlurSayisi,
    okunanTeklifSayisi,
    kazananIdx,
    yaklasikMaliyet
  };
}


function belgeyiAnaliz(fullText) {
  const cleanText = (fullText || '').replace(/\r?\n/g, ' ');
  const isDT = /doğrudan\s+temin/i.test(cleanText);
  const isYM = /yaklaşık\s+maliyet/i.test(cleanText);

  let isAdi = null;
  // 1. Tırnak işaretleri arasındaki iş adını ara (çift tırnaklar)
  const tirnakMatch = cleanText.match(/[\u201C\u201E\u0022\u00AB]([^\u201D\u201C\u0022\u00BB]{5,180})[\u201D\u201F\u0022\u00BB]/);
  if (tirnakMatch) {
    let ham = tirnakMatch[1].replace(/\s+/g, ' ').trim();
    // Kapanış tırnağı kaçtıysa ve cümlenin devamı içeri sızdıysa temizle
    ham = ham.replace(/\s+(?:için|kapsamında|ile\s+ilgili|hususunu|hususunda|doğrudan\s+temin|görevlendirilmesi|yaklaşık\s+maliyet).*$/i, '').trim();
    ham = ham.replace(/['"”’«»\.\,]+$/, '').trim();
    if (ham.length >= 5) isAdi = ham;
  }

  // 2. Kapanış tırnağı tek tırnak veya bozuk karakter olduysa ("... İşi' için)
  if (!isAdi) {
    const tekTirnakMatch = cleanText.match(/[\u201C\u201E\u0022\u00AB'‘]([^'"”’«»\n]{5,120}?(?:İşi|Alımı|Yapımı|Hizmeti|Onarımı|Bakımı|Tadilatı|Temini|Malı|isi|alimi|yapimi|hizmeti|onarimi|bakimi|temini))\s*['"”’»]?\s*(?:için|kapsamında|ile\s+ilgili)/i);
    if (tekTirnakMatch) isAdi = tekTirnakMatch[1].replace(/\s+/g, ' ').trim();
  }

  // 3. Tırnaksız bağlam araması ("... İşi için" veya "... İşi kapsamında")
  if (!isAdi) {
    const baglamMatch = cleanText.match(/(?:olan|yapılacak|konulu|adlı)?\s*["“']?([A-Za-zÇŞĞÜÖİçşğüöı0-9 \/\-\.]{5,100}?(?:İşi|Alımı|Yapımı|Hizmeti|Onarımı|Bakımı|Tadilatı|Temini|Malı))\s*["”']?\s*(?:için|kapsamında|ile\s+ilgili)/i);
    if (baglamMatch) isAdi = baglamMatch[1].replace(/\s+/g, ' ').trim();
  }

  // 4. Doğrudan 'İşin Adı:' veya 'Hizmetin Adı:' başlığı
  if (!isAdi) {
    const konusuMatch = cleanText.match(/(?:İşin\s+Adı|Hizmetin\s+Adı)\s*[:\-]?\s*([A-Za-zÇŞĞÜÖİçşğüöı0-9 \/\-]{5,100}?)(?:\s{2,}|$)/i);
    if (konusuMatch) isAdi = konusuMatch[1].replace(/\s+/g, ' ').trim();
  }

  let onayNo = null, onayTarihi = null;
  const sayiIdx = cleanText.search(/Sayı\s*:/);
  if (sayiIdx >= 0) {
    const satirMetni = cleanText.substring(sayiIdx, sayiIdx + 120);
    const sayiMatch = satirMetni.match(/Sayı\s*:\s*(.+?)\s+(\d{2}[\.\/]\d{2}[\.\/]\d{4})/);
    if (sayiMatch) {
      const parts = sayiMatch[1].replace(/\s+/g, '').split('-');
      onayNo = parts[parts.length - 1];
    }
    const tarihMatch = satirMetni.match(/(\d{2})[\.\/](\d{2})[\.\/](\d{4})/);
    if (tarihMatch) onayTarihi = `${tarihMatch[3]}-${tarihMatch[2]}-${tarihMatch[1]}`;
  }

  let gorevliAd = null, gorevliUnvan = null;
  const gorevliMatchDT = cleanText.match(/(?:ilgili|olarak)\s+([A-Za-zÇŞĞÜÖİçşğüöı\s]+?)\s*['\u2018\u2019\u02BC]\S*\s+doğrudan\s+temin/i);
  const gorevliMatchYM = cleanText.match(/olarak\s+([A-Za-zÇŞĞÜÖİçşğüöı\s]+?)\s*['\u2018\u2019\u02BC]\S*\s+görevlendirilmesi/i);
  const gorevliMatchGenel = cleanText.match(/([A-Za-zÇŞĞÜÖİçşğüöı\s]+?)\s*['\u2018\u2019\u02BC]\S*\s+görevlendirilmesi/i);
  const gorevliMatch = isDT ? (gorevliMatchDT || gorevliMatchGenel || gorevliMatchYM) :
                              (isYM ? (gorevliMatchYM || gorevliMatchGenel || gorevliMatchDT) :
                                      (gorevliMatchDT || gorevliMatchYM || gorevliMatchGenel));
  if (gorevliMatch) {
    const tamMetin = gorevliMatch[1].trim();
    const kelimeler = tamMetin.split(/\s+/).filter(Boolean);
    let idx = kelimeler.length - 1;
    const soyadlar = [];
    while (idx >= 0 && /^[A-ZÇŞĞÜÖİ]+$/.test(kelimeler[idx])) soyadlar.unshift(kelimeler[idx--]);
    const adlar = (idx >= 0 && /^[A-ZÇŞĞÜÖİ][a-zçşğüöı]/.test(kelimeler[idx])) ? [kelimeler[idx--]] : [];
    if (adlar.length === 0 && soyadlar.length >= 2) {
      adlar.push(soyadlar.shift());
    }
    gorevliAd = [...adlar, ...soyadlar].join(' ');
    gorevliUnvan = kelimeler.slice(0, idx + 1).join(' ');
  }

  let onaylayanAd = null, onaylayanUnvan = null;
  const olurPattern = /\bOLUR(?![''\u2018\u2019\u02BCa-zçşğüöıA-ZÇŞĞÜÖİ])/g;
  let match, lastOlurIdx = -1;
  while ((match = olurPattern.exec(cleanText)) !== null) lastOlurIdx = match.index;
  if (lastOlurIdx >= 0) {
    const olurSonrasi = cleanText.substring(lastOlurIdx, lastOlurIdx + 300).replace(/\s+/g, ' ');
    const temizSonrasi = olurSonrasi.replace(/^OLUR\s*(?:\d{2}[\.\/]\d{2}[\.\/]\d{4}\s*)?/, '').trim();
    let isimMatch = temizSonrasi.match(/^([A-ZÇŞĞÜÖİ][a-zçşğüöı]+(?:\s+[A-ZÇŞĞÜÖİ][a-zçşğüöı]+)?\s+[A-ZÇŞĞÜÖİ]{2,}(?:\s+[A-ZÇŞĞÜÖİ]{2,})?)/);
    if (!isimMatch) {
      isimMatch = temizSonrasi.match(/^([A-ZÇŞĞÜÖİ]{2,}(?:\s+[A-ZÇŞĞÜÖİ]{2,}){1,2})(?=\s+(?:Müdür|MÜDÜR|Genel|GENEL|Vali|VALİ|Başkan|BAŞKAN|Kaymakam|KAYMAKAM|Yatırım|YATIRIM|İl|İL))/i);
    }
    if (isimMatch) {
      onaylayanAd = isimMatch[1].trim();
      const isimSonrasi = temizSonrasi.substring(temizSonrasi.indexOf(onaylayanAd) + onaylayanAd.length).trim();
      const unvanMatch = isimSonrasi.match(/^((?:[A-Za-zÇŞĞÜÖİçşğüöı]+\s+){0,6}(?:Müdür|Genel\s+Sekreter|Vali|Başkan|Kaymakam)[A-Za-zÇŞĞÜÖİçşğüöı\.\s]*?)(?:\s{2,}|\d|$)/i);
      if (unvanMatch) onaylayanUnvan = unvanMatch[1].replace(/\s+/g, ' ').trim();
    }
  }

  return { isDT, isYM, isAdi, onayNo, onayTarihi, gorevliAd, gorevliUnvan, onaylayanAd, onaylayanUnvan };
}

// ===================== GEMINI AI ENTEGRASYONU =====================
async function dtmFileToBase64(file) {
  const isImage = (file.type && file.type.startsWith('image/')) ||
                  /\.(png|jpe?g|webp|bmp)$/i.test(file.name || '');

  if (isImage && typeof document !== 'undefined') {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataUrl;
      });

      const maxDim = 1800;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64 = optimizedDataUrl.split(',')[1];
      return { base64, mimeType: 'image/jpeg' };
    } catch (e) {
      console.warn('Görsel optimizasyon hatası:', e);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.substring(commaIdx + 1) : dataUrl;
      let mimeType = file.type || '';
      if (!mimeType) {
        const name = (file.name || '').toLowerCase();
        if (name.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (name.endsWith('.png')) mimeType = 'image/png';
        else if (name.endsWith('.webp')) mimeType = 'image/webp';
        else mimeType = 'image/jpeg';
      }
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const GEMINI_ALLOWED_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
let lastWorkingGeminiModel = '';
const deadGeminiModels = new Set();
let topluAnalizAbortController = null;
let topluAnalizDurduruldu = false;

function getSafeGeminiModels() {
  const raw = (referans && typeof referans.geminiModel === 'string') ? referans.geminiModel.trim() : '';
  const selectedModel = GEMINI_ALLOWED_MODELS.includes(raw) ? raw : 'gemini-3.8-flash';
  const ordered = [lastWorkingGeminiModel, selectedModel, ...GEMINI_ALLOWED_MODELS]
    .filter((m, idx, arr) => m && GEMINI_ALLOWED_MODELS.includes(m) && arr.indexOf(m) === idx);
  const alive = ordered.filter(m => !deadGeminiModels.has(m));
  return alive.length > 0 ? alive : ordered;
}

function dtmTemizleGeminiHamYanit(parsed, kategori = '') {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed;
  const textKeys = new Set(['ad','firmaAdi','isAdi','isTuru','onayNo','gorevliAd','gorevliUnvan','onaylayanAd','onaylayanUnvan','adres','tel','faks','eposta','vkn','vergiDairesi','tur','birim','belgeTuru','teklifGrubu']);
  const boolKeys = new Set(['isDT','isYM','basitUsul']);

  function temizSayi(val) {
    if (typeof val === 'number') return (Number.isFinite(val) && val >= 0) ? val : 0;
    if (typeof val === 'string') {
      let s = val.replace(/[^\d.,-]/g, '').trim();
      if (!s) return 0;
      if (s.includes('.') && s.includes(',')) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
        else s = s.replace(/,/g, '');
      } else if (s.includes(',')) {
        s = s.replace(',', '.');
      }
      const n = Number(s);
      return (Number.isFinite(n) && n >= 0) ? n : 0;
    }
    return 0;
  }

  function temizTarih(val) {
    if (val == null || val === '') return null;
    const s = String(val).trim();
    let iso = s;
    const dmy = s.match(/^(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{4})$/);
    const ymd = s.match(/^(\d{4})[\.\/\-](\d{1,2})[\.\/\-](\d{1,2})$/);
    if (dmy) iso = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    else if (ymd) iso = `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const dt = new Date(iso + 'T00:00:00Z');
    if (isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== iso) return null;
    return iso;
  }

  function temizNesne(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue;
      if (textKeys.has(k)) {
        obj[k] = String(v).trim().slice(0, 2000);
      } else if (boolKeys.has(k)) {
        if (typeof v === 'string') obj[k] = v.toLowerCase().trim() === 'true';
        else obj[k] = Boolean(v);
      } else if (k === 'onayTarihi') {
        obj[k] = temizTarih(v);
      }
    }
  }

  temizNesne(parsed);
  if (parsed.olur && typeof parsed.olur === 'object' && !Array.isArray(parsed.olur)) {
    temizNesne(parsed.olur);
  }
  if (parsed.teklif && typeof parsed.teklif === 'object' && !Array.isArray(parsed.teklif)) {
    const t = parsed.teklif;
    temizNesne(t);
    t.toplamTeklifTutari = temizSayi(t.toplamTeklifTutari);
    if (Array.isArray(t.kalemler)) {
      t.kalemler = t.kalemler
        .filter(k => k && typeof k === 'object' && !Array.isArray(k))
        .slice(0, 100)
        .map(k => {
          temizNesne(k);
          k.ad = (k.ad && String(k.ad).trim()) ? String(k.ad).trim().slice(0, 2000) : (parsed.olur?.isAdi || 'İş Kalemi');
          k.birim = (k.birim && String(k.birim).trim()) ? String(k.birim).trim().slice(0, 100) : 'Adet';
          k.miktar = temizSayi(k.miktar);
          if (!(k.miktar > 0)) k.miktar = 1;
          k.birimFiyat = temizSayi(k.birimFiyat);
          k.toplamTutar = temizSayi(k.toplamTutar);
          if (k.birimFiyat === 0 && k.toplamTutar > 0 && k.miktar > 0) {
            k.birimFiyat = Math.round((k.toplamTutar / k.miktar) * 100) / 100;
          }
          if (k.toplamTutar === 0 && k.birimFiyat > 0) {
            k.toplamTutar = Math.round((k.birimFiyat * k.miktar) * 100) / 100;
          }
          return k;
        });
      const kalemToplam = Math.round(t.kalemler.reduce((acc, k) => acc + (k.birimFiyat * k.miktar), 0) * 100) / 100;
      if (t.kalemler.length > 0 && t.kalemler.every(k => k.birimFiyat > 0) && kalemToplam > 0) {
        if (t.toplamTeklifTutari === 0 || Math.abs(t.toplamTeklifTutari - kalemToplam) > 0.02) {
          t.toplamTeklifTutari = kalemToplam;
        }
      }
    } else if (t.kalemler != null) {
      t.kalemler = [];
    }
  }

  const rawGrup = String(parsed.teklifGrubu || parsed.teklif?.teklifGrubu || '').toLowerCase().trim();
  const aiGrup = (rawGrup === 'ym' || rawGrup.includes('piyasa') || rawGrup.includes('yaklasik') || rawGrup.includes('yaklaşık'))
    ? 'ym'
    : (rawGrup === 'dt' || rawGrup.includes('teklif mektubu') || rawGrup.includes('resmi'))
      ? 'dt'
      : '';

  if (aiGrup === 'ym' || aiGrup === 'dt') {
    parsed.teklifGrubu = aiGrup;
    if (parsed.teklif && typeof parsed.teklif === 'object') delete parsed.teklif.teklifGrubu;
    if (parsed.teklif) parsed.belgeTuru = 'teklif';
  } else if (kategori === 'ym' || kategori === 'dt') {
    parsed.teklifGrubu = kategori;
    if (parsed.teklif && typeof parsed.teklif === 'object') delete parsed.teklif.teklifGrubu;
    if (parsed.teklif) parsed.belgeTuru = 'teklif';
  } else if (kategori === 'olur' && parsed.olur) {
    parsed.belgeTuru = 'olur';
  }

  return parsed;
}

async function dtmAnalyzeDocumentWithGemini(file, apiKey) {
  const { base64, mimeType } = await dtmFileToBase64(file);

  const prompt = `Sen Türkiye Cumhuriyeti kamu ihale ve doğrudan temin mevzuatı (4734 sayılı KİK 22/d) uzmanısın.
Sana verilen resmi evrakı (Doğrudan Temin Görevlendirme / Olur Belgesi veya Yaklaşık Maliyet Oluru) dikkatle incele.
Belgedeki şu alanları çıkar ve SADECE geçerli bir JSON formatında döndür:

{
  "isAdi": "İşin tam ve doğru adı (Örn: 'Karaman İl Özel İdaresi Jeneratör Bakım İşi'). Sadece işin konusunu al; tırnak işaretlerini temizle; 'için', 'kapsamında', 'hususunu', 'arz ederim' gibi resmi yazışma cümlelerini DAHİL ETME.",
  "isDT": true/false (Doğrudan temin piyasa fiyat araştırması görevlendirme belgesi ise true, aksi halde false),
  "isYM": true/false (Yaklaşık maliyet tespit görevlendirme veya hesap cetveli belgesi ise true, aksi halde false),
  "onayNo": "Belgenin resmi sayısı/evrak numarası (Örn: '61019' veya 'E-55550293-934.01-61019'). Yoksa null",
  "onayTarihi": "Belgenin resmi onay tarihi (YYYY-MM-DD formatında, örn: '2026-09-24'). Yoksa null",
  "gorevliAd": "Görevlendirilen personelin Adı Soyadı (Türkçe karakterleri düzgün, örn: 'Ahmet CANBOLAT'). Birden fazla varsa ilk görevli.",
  "gorevliUnvan": "Görevlendirilen personelin unvanı (Örn: 'Makine Mühendisi', 'Tekniker'). Yoksa null",
  "onaylayanAd": "Belgenin en altındaki 'OLUR' veren/onaylayan en yetkili amirin Adı Soyadı (Örn: 'Ali YILDIRIM'). Yoksa null",
  "onaylayanUnvan": "Onaylayan amirin unvanı (Örn: 'Vali a. Genel Sekreter', 'Genel Sekreter', 'Yatırım ve İnşaat Müdürü'). Yoksa null"
}

Önemli kurallar:
- Yanıtın SADECE saf JSON olsun, markdown kod bloğu veya ek açıklama ekleme.
- Belgede net okunamayan veya bulunmayan alanları null bırak.`;

  const models = getSafeGeminiModels();
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[Gemini API] ${model} hata verdi (${res.status}):`, errText);
        lastError = new Error(`Gemini API Hatası (${res.status}): ${errText}`);
        if ([404, 429, 500, 503].includes(res.status)) {
          if (res.status === 429 || res.status === 503) await new Promise(r => setTimeout(r, 1200));
          continue;
        }
        throw lastError;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Gemini API boş yanıt döndürdü.');

      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');

      const parsed = dtmTemizleGeminiHamYanit(JSON.parse(cleaned));
      return dtmAiYanitiDogrula(parsed);
    } catch (err) {
      lastError = err;
      if (err.message && (err.message.includes('404') || err.message.includes('429') || err.message.includes('503'))) continue;
      throw err;
    }
  }

  throw lastError || new Error('Tüm Gemini modelleri denendi ancak yanıt alınamadı.');
}

async function dtmTestGeminiApiKey(apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error('Lütfen geçerli bir API anahtarı giriniz.');
  const key = apiKey.trim();
  const models = getSafeGeminiModels();
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const payload = {
        contents: [
          {
            parts: [{ text: 'Merhaba, bu bir test mesajıdır.' }]
          }
        ]
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return { success: true, model };
      }
      const errText = await res.text();
      lastError = new Error(`Hata (${res.status}): ${errText}`);
      if (res.status === 404) continue;
      throw lastError;
    } catch(e) {
      lastError = e;
      if (e.message && e.message.includes('404')) continue;
      throw e;
    }
  }
  throw lastError || new Error('API anahtarı doğrulanamadı.');
}

async function dtmAnalyzeSingleDocumentMultiAI(file, apiKey, kategori = '') {
  const { base64, mimeType } = await dtmFileToBase64(file);

  const kategoriIpucu = kategori === 'olur'
    ? 'BU BELGE BİR OLUR / ONAY BELGESİDİR (Yaklaşık Maliyet Görevlendirme Oluru veya Doğrudan Temin Onay Belgesi). "belgeTuru": "olur" olarak doldur.'
    : (kategori === 'ym' || kategori === 'dt')
      ? 'BU BELGE BİR FİRMA FİYAT TEKLİF BELGESİDİR ("PİYASA FİYAT ARAŞTIRMASI" veya "TEKLİF MEKTUBUDUR"). "belgeTuru": "teklif" olarak doldur ve tablodaki kalemleri/fiyatları KDV HARİÇ olarak çıkar.'
      : 'Belgenin türünü ("olur", "teklif" veya "diger") belirle ve ilgili alanları çıkar.';

  const prompt = `Sen Türkiye Cumhuriyeti kamu ihale ve doğrudan temin mevzuatı (4734 sayılı KİK 22/d) uzmanısın.
Sana verilen resmi evrakı dikkatle incele. ${kategoriIpucu}
Yanıtını SADECE geçerli bir JSON formatında döndür:

{
  "belgeTuru": "olur",
  "teklifGrubu": "ym",
  "olur": {
    "isAdi": "İşin tam ve doğru adı (Sadece işin konusunu al; tırnak işaretlerini temizle; 'için', 'kapsamında', 'hususunu', 'arz ederim' gibi resmi yazışma cümlelerini DAHİL ETME)",
    "isDT": true,
    "isYM": false,
    "onayNo": "Belgenin resmi sayısı/evrak numarası (Örn: '61019'). Yoksa null",
    "onayTarihi": "Belgenin resmi onay tarihi (YYYY-MM-DD formatında, örn: '2026-09-24'). Yoksa null",
    "gorevliAd": "Görevlendirilen personelin Adı Soyadı. Birden fazla varsa ilk görevli.",
    "gorevliUnvan": "Görevlendirilen personelin unvanı. Yoksa null",
    "onaylayanAd": "Belgenin en altındaki 'OLUR' veren/onaylayan en yetkili amirin Adı Soyadı. Yoksa null",
    "onaylayanUnvan": "Onaylayan amirin unvanı. Yoksa null",
    "isTuru": "Yapım İşi"
  },
  "teklif": {
    "firmaAdi": "Teklifi veren firmanın veya kişinin tam adı / unvanı (Örn: 'Gültes Enerji Ltd. Şti.' veya 'Alper YAMAÇ')",
    "vkn": "Vergi Kimlik Numarası veya TC Kimlik Numarası (Varsa). Yoksa null",
    "vergiDairesi": "Vergi dairesi. Yoksa null",
    "adres": "Firma açık adresi. Yoksa null",
    "tel": "Firma telefon numarası. Yoksa null",
    "eposta": "Firma e-posta adresi. Yoksa null",
    "toplamTeklifTutari": 0.0,
    "kalemler": [
      {
        "ad": "İş kalemi veya malzeme adı",
        "miktar": 1.0,
        "birim": "Adet",
        "birimFiyat": 0.0,
        "toplamTutar": 0.0
      }
    ]
  }
}

Önemli kurallar:
- Yanıtın SADECE saf JSON olsun, markdown kod bloğu veya ek açıklama ekleme.
- Eğer belge bir Olur Belgesi ise "belgeTuru": "olur" yap, "olur" objesini doldur, "teklif" ve "teklifGrubu" alanlarını null bırak.
- Eğer belge bir Firma Teklifi ise "belgeTuru": "teklif" yap, "teklif" objesini doldur, "olur" alanını null bırak.
- ÇOK ÖNEMLİ ("teklifGrubu" ayrımı):
  * Eğer belgenin ortasındaki başlıkta "PİYASA FİYAT ARAŞTIRMASI" veya "Konu: Piyasa Fiyat Araştırması" veya metinde "Piyasa araştırmasına esas olmak üzere" yazıyorsa: "teklifGrubu": "ym" yap (Yaklaşık Maliyet teklifidir).
  * Eğer belgenin ortasındaki başlıkta "TEKLİF MEKTUBUDUR" veya "Konu: Teklif" veya metinde "Teklif fiyatına esas olmak üzere" yazıyorsa: "teklifGrubu": "dt" yap (Resmi Teklif mektubudur).
- TÜM FİYATLAR (birimFiyat, toplamTutar, toplamTeklifTutari) KDV HARİÇ net tutar olmalıdır.
- Rakamları kesinlikle sayı (float/number) olarak döndür.
- Okunamayan veya bulunmayan alanları null bırak.`;

  const models = getSafeGeminiModels();
  let lastError = null;

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];
    if (topluAnalizDurduruldu) throw new Error('Analiz kullanıcı tarafından durduruldu.');
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      };

      const reqCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      topluAnalizAbortController = reqCtrl;
      const timerId = reqCtrl ? setTimeout(() => { try { reqCtrl.abort(); } catch(_) {} }, 25000) : null;

      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          ...(reqCtrl ? { signal: reqCtrl.signal } : {})
        });
      } finally {
        if (timerId) clearTimeout(timerId);
      }

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[Gemini API - Toplu] ${model} hata verdi (${res.status}):`, errText);
        lastError = new Error(`Gemini API Hatası (${res.status}): ${errText}`);
        if (res.status === 404) {
          deadGeminiModels.add(model);
          continue;
        }
        if ([429, 500, 503].includes(res.status)) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw lastError;
      }

      lastWorkingGeminiModel = model;
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Gemini API boş yanıt döndürdü.');

      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');

      const parsed = dtmTemizleGeminiHamYanit(JSON.parse(cleaned), kategori);
      return dtmAiYanitiDogrula(parsed);
    } catch (err) {
      if (topluAnalizDurduruldu || (err && err.name === 'AbortError' && topluAnalizDurduruldu)) {
        throw new Error('Analiz kullanıcı tarafından durduruldu.');
      }
      if (err && err.name === 'AbortError') {
        lastError = new Error(`${model} yanıt süresi aşıldı (25 sn).`);
        continue;
      }
      lastError = err;
      if (err.message && (err.message.includes('404') || err.message.includes('429') || err.message.includes('503'))) continue;
      throw err;
    }
  }

  throw lastError || new Error('Tüm Gemini modelleri denendi ancak yanıt alınamadı.');
}

async function dtmParseOlurBelgesi(file) {
  if (!file) return null;
  const apiKey = (referans && referans.geminiApiKey) || (typeof localStorage !== 'undefined' && localStorage.getItem('dtm_gemini_api_key'));

  if (apiKey && apiKey.trim()) {
    try {
      showToast('🤖 Belge yapay zeka (Gemini AI) ile analiz ediliyor...', 'info', 6000);
      const aiResult = await dtmAnalyzeDocumentWithGemini(file, apiKey.trim());
      if (aiResult && (aiResult.isAdi || aiResult.gorevliAd || aiResult.onaylayanAd)) {
        showToast('✅ Yapay zeka belgeyi başarıyla çözümledi!', 'success', 3000);
        return aiResult;
      }
    } catch (aiErr) {
      console.warn('Gemini analizi başarısız oldu, yerel motora geçiliyor:', aiErr);
      showToast('Yapay zeka yanıt veremedi, yerel OCR/PDF motoruna geçiliyor...', 'warning', 3500);
    }
  }

  showToast('Belge okunuyor...', 'info');
  const fullText = await readPdfText(file);
  return belgeyiAnaliz(fullText);
}

if (typeof window !== 'undefined') {
  window.geminiApiKeyKaydet = function() {
    const inp = document.getElementById('globalGeminiApiKey');
    const val = (inp?.value || '').trim();
    referans.geminiApiKey = val;
    referans.geminiModel = 'gemini-3.8-flash';
    if (typeof saveAiConfig === 'function') saveAiConfig(referans);
    saveGlobalReferans(referans);
    showToast(val ? 'Gemini API anahtarı buluta kaydedildi! Yetkili kurum personelleri için aktif.' : 'Gemini API anahtarı temizlendi.', 'success');
    renderPage();
  };

  window.geminiApiKeySil = function() {
    if (!confirm('Gemini API anahtarını sistemden kaldırmak istediğinize emin misiniz?')) return;
    referans.geminiApiKey = '';
    if (typeof saveAiConfig === 'function') saveAiConfig(referans);
    saveGlobalReferans(referans);
    showToast('Gemini API anahtarı kaldırıldı. Sistem yerel OCR motoruna döndü.', 'info');
    renderPage();
  };

  window.geminiApiKeyTestEt = async function() {
    const inp = document.getElementById('globalGeminiApiKey');
    const resDiv = document.getElementById('geminiApiTestResult');
    const val = (inp?.value || referans.geminiApiKey || '').trim();

    if (!val) {
      showToast('Lütfen önce bir API anahtarı giriniz.', 'warning');
      return;
    }

    if (resDiv) {
      resDiv.style.display = 'block';
      resDiv.style.color = 'var(--primary)';
      resDiv.innerHTML = '⏳ Google Gemini sunucularına bağlanılıyor...';
    }

    try {
      const result = await dtmTestGeminiApiKey(val);
      if (resDiv) {
        resDiv.style.color = '#16a34a';
        resDiv.innerHTML = `✅ <strong>Bağlantı Başarılı!</strong> Google ${escHtml(result.model)} modeli yanıt verdi. Kurum personelleri için kullanıma hazır.`;
      }
      showToast('Gemini API bağlantısı başarılı!', 'success');
    } catch(e) {
      if (resDiv) {
        resDiv.style.color = '#dc2626';
        resDiv.innerHTML = `❌ <strong>Bağlantı Başarısız:</strong> ${escHtml(e.message)}`;
      }
      showToast('Bağlantı başarısız: ' + e.message, 'error');
    }
  };

  window.toggleGeminiKeyVisibility = function() {
    const inp = document.getElementById('globalGeminiApiKey');
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  };

  window.profilGeminiApiKeyKaydet = function() {
    const inp = document.getElementById('profilGeminiApiKey');
    const val = (inp?.value || '').trim();
    referans.geminiApiKey = val;
    referans.geminiModel = 'gemini-3.8-flash';
    if (typeof saveAiConfig === 'function') saveAiConfig(referans);
    saveGlobalReferans(referans);
    showToast(val ? 'Gemini API anahtarı buluta kaydedildi! Yetkili kurum personelleri için aktif.' : 'Gemini API anahtarı temizlendi.', 'success');
    renderPage();
  };

  window.profilGeminiApiKeySil = function() {
    if (!confirm('Gemini API anahtarını sistemden kaldırmak istediğinize emin misiniz?')) return;
    referans.geminiApiKey = '';
    if (typeof saveAiConfig === 'function') saveAiConfig(referans);
    saveGlobalReferans(referans);
    showToast('Gemini API anahtarı kaldırıldı. Sistem yerel OCR motoruna döndü.', 'info');
    renderPage();
  };

  window.profilGeminiApiKeyTestEt = async function() {
    const inp = document.getElementById('profilGeminiApiKey');
    const resDiv = document.getElementById('profilGeminiApiTestResult');
    const val = (inp?.value || referans.geminiApiKey || '').trim();

    if (!val) {
      showToast('Lütfen önce bir API anahtarı giriniz.', 'warning');
      return;
    }

    if (resDiv) {
      resDiv.style.display = 'block';
      resDiv.style.color = 'var(--primary)';
      resDiv.innerHTML = '⏳ Google Gemini sunucularına bağlanılıyor...';
    }

    try {
      const result = await dtmTestGeminiApiKey(val);
      if (resDiv) {
        resDiv.style.color = '#16a34a';
        resDiv.innerHTML = `✅ <strong>Bağlantı Başarılı!</strong> Google ${escHtml(result.model)} modeli yanıt verdi. Kurum personelleri için kullanıma hazır.`;
      }
      showToast('Gemini API bağlantısı başarılı!', 'success');
    } catch(e) {
      if (resDiv) {
        resDiv.style.color = '#dc2626';
        resDiv.innerHTML = `❌ <strong>Bağlantı Başarısız:</strong> ${escHtml(e.message)}`;
      }
      showToast('Bağlantı başarısız: ' + e.message, 'error');
    }
  };

  window.toggleProfilGeminiKeyVisibility = function() {
    const inp = document.getElementById('profilGeminiApiKey');
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  };
}

async function parseDTOluru(file) {
  if (!file) return;
  try {
    const res = await dtmParseOlurBelgesi(file);
    if (!res) return;

    if (res.onayNo)     proje.dtOnayNo = res.onayNo;
    if (res.onayTarihi) proje.dtOnayTarihi = res.onayTarihi;
    if (res.gorevliAd) {
      const g = matchOrAddGorevli(res.gorevliAd, res.gorevliUnvan);
      proje.dtGorevliler[0].ad = g.ad;
      proje.dtGorevliler[0].unvan = g.unvan;
      proje.dtGorevliSayisi = 1;
    }
    if (res.onaylayanAd) {
      const a = matchOrAddOnaylayanAmir(res.onaylayanAd, res.onaylayanUnvan);
      proje.onaylayanAmir = { ad: a.ad, unvan: a.unvan };
    }

    autoSave();
    renderPage();
    showToast('D.T. Olur belgesi okundu, alanlar dolduruldu!', 'success');
  } catch(e) {
    showToast('Belge okunamadı: ' + e.message, 'error');
  }
}

async function parseYMOluru(file) {
  if (!file) return;
  try {
    const res = await dtmParseOlurBelgesi(file);
    if (!res) return;

    if (res.onayNo)     proje.ymOnayNo = res.onayNo;
    if (res.onayTarihi) proje.ymOnayTarihi = res.onayTarihi;
    if (res.gorevliAd) {
      const g = matchOrAddGorevli(res.gorevliAd, res.gorevliUnvan);
      proje.ymGorevliler[0].ad = g.ad;
      proje.ymGorevliler[0].unvan = g.unvan;
      proje.ymGorevliSayisi = 1;
    }
    if (res.onaylayanAd && (!proje.onaylayanAmir || !proje.onaylayanAmir.ad)) {
      const a = matchOrAddOnaylayanAmir(res.onaylayanAd, res.onaylayanUnvan);
      proje.onaylayanAmir = { ad: a.ad, unvan: a.unvan };
    }

    autoSave();
    renderPage();
    showToast('Y.M. Olur belgesi okundu, alanlar dolduruldu!', 'success');
  } catch(e) {
    showToast('Belge okunamadı: ' + e.message, 'error');
  }
}

async function parseIkiOlurBelgesi() {
  const ymInput = document.getElementById('ymPdfInput');
  const dtInput = document.getElementById('dtPdfInput');
  const ymFile = ymInput && ymInput.files[0] ? ymInput.files[0] : null;
  const dtFile = dtInput && dtInput.files[0] ? dtInput.files[0] : null;

  if (!ymFile && !dtFile) {
    showToast('En az bir belge dosyası seçin.', 'warning');
    return;
  }

  showToast('Belge(ler) okunuyor...', 'info');

  try {
    const ymSonuc = ymFile ? await dtmParseOlurBelgesi(ymFile) : null;
    const dtSonuc = dtFile ? await dtmParseOlurBelgesi(dtFile) : null;

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

    let ymKabul = false;
    if (ymSonuc) {
      const ymSatirlar = [
        `📋 İş Adı: ${ymSonuc.isAdi || isAdi}`,
        ymSonuc.onayNo     ? `🔢 Sayı: ${ymSonuc.onayNo}` : null,
        ymSonuc.onayTarihi ? `📅 Tarih: ${ymSonuc.onayTarihi.split('-').reverse().join('.')}` : null,
        ymSonuc.gorevliAd  ? `👤 Görevli: ${ymSonuc.gorevliAd}${ymSonuc.gorevliUnvan ? ' / ' + ymSonuc.gorevliUnvan : ''}` : null,
        ymSonuc.onaylayanAd ? `✅ Onaylayan: ${ymSonuc.onaylayanAd}${ymSonuc.onaylayanUnvan ? ' / ' + ymSonuc.onaylayanUnvan : ''}` : null,
      ].filter(Boolean).join('\n');
      ymKabul = await showConfirm(`📘 Y.M. Onay Belgesi bilgileri:\n\n${escHtml(ymSatirlar)}\n\nBu belgeyi aktaralım mı?`, 'Evet, Aktar', 'Bu Belgeyi Atla');
    }

    let dtKabul = false;
    if (dtSonuc) {
      const dtSatirlar = [
        `📋 İş Adı: ${dtSonuc.isAdi || isAdi}`,
        dtSonuc.onayNo      ? `🔢 Sayı: ${dtSonuc.onayNo}` : null,
        dtSonuc.onayTarihi  ? `📅 Tarih: ${dtSonuc.onayTarihi.split('-').reverse().join('.')}` : null,
        dtSonuc.gorevliAd   ? `👤 Görevli: ${dtSonuc.gorevliAd}${dtSonuc.gorevliUnvan ? ' / ' + dtSonuc.gorevliUnvan : ''}` : null,
        dtSonuc.onaylayanAd ? `✅ Onaylayan: ${dtSonuc.onaylayanAd}${dtSonuc.onaylayanUnvan ? ' / ' + dtSonuc.onaylayanUnvan : ''}` : null,
      ].filter(Boolean).join('\n');
      dtKabul = await showConfirm(`📗 D.T. Onay Belgesi bilgileri:\n\n${escHtml(dtSatirlar)}\n\nBu belgeyi aktaralım mı?`, 'Evet, Aktar', 'Bu Belgeyi Atla');
    }

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

    document.getElementById('yeniProjeModal').style.display = 'none';
    proje = getDefaultProje();
    proje.isAdi = isAdi;

    if (ymKabul && ymSonuc) {
      if (ymSonuc.onayNo)     proje.ymOnayNo = ymSonuc.onayNo;
      if (ymSonuc.onayTarihi) proje.ymOnayTarihi = ymSonuc.onayTarihi;
      if (ymSonuc.gorevliAd) {
        const g = matchOrAddGorevli(ymSonuc.gorevliAd, ymSonuc.gorevliUnvan);
        proje.ymGorevliler[0].ad = g.ad;
        proje.ymGorevliler[0].unvan = g.unvan;
        proje.ymGorevliSayisi = 1;
      }
    }
    if (dtKabul && dtSonuc) {
      if (dtSonuc.onayNo)      proje.dtOnayNo = dtSonuc.onayNo;
      if (dtSonuc.onayTarihi)  proje.dtOnayTarihi = dtSonuc.onayTarihi;
      if (dtSonuc.gorevliAd) {
        const g = matchOrAddGorevli(dtSonuc.gorevliAd, dtSonuc.gorevliUnvan);
        proje.dtGorevliler[0].ad = g.ad;
        proje.dtGorevliler[0].unvan = g.unvan;
        proje.dtGorevliSayisi = 1;
      }
    }

    const seciliOnaylayan = (dtKabul && dtSonuc && dtSonuc.onaylayanAd) ? dtSonuc :
                            (ymKabul && ymSonuc && ymSonuc.onaylayanAd) ? ymSonuc : null;
    if (seciliOnaylayan) {
      const a = matchOrAddOnaylayanAmir(seciliOnaylayan.onaylayanAd, seciliOnaylayan.onaylayanUnvan);
      proje.onaylayanAmir = { ad: a.ad, unvan: a.unvan };
    }

    if (typeof window !== 'undefined') {
      window._bekleyenProjeDosyalari = [];
      if (ymKabul && ymFile) window._bekleyenProjeDosyalari.push({ file: ymFile, kategori: 'olur_teklif', altEtiket: 'YM Olur' });
      if (dtKabul && dtFile) window._bekleyenProjeDosyalari.push({ file: dtFile, kategori: 'olur_teklif', altEtiket: 'DT Olur' });
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
  try {
    const res = await dtmParseOlurBelgesi(file);

    if (!res || !res.isAdi) {
      showToast('İş adı belge içinde bulunamadı. Manuel girin.', 'warning');
      const modal = document.getElementById('yeniProjeModal');
      if (modal) {
        modal.querySelector('#yeniProjeAdim2Olur').style.display = 'none';
        modal.querySelector('#yeniProjeAdim2Manuel').style.display = 'block';
        setTimeout(() => modal.querySelector('#yeniProjeAdi')?.focus(), 50);
      }
      return;
    }

    const tip = res.isDT ? 'D.T. Onay Belgesi' : (res.isYM ? 'Y.M. Onay Belgesi' : 'Onay Belgesi');
    const satirlar = [
      `📄 Belge Türü: ${tip}`,
      `📋 İş Adı: ${res.isAdi}`,
      res.onayNo    ? `🔢 Sayı: ${res.onayNo}` : null,
      res.onayTarihi ? `📅 Tarih: ${res.onayTarihi.split('-').reverse().join('.')}` : null,
      res.gorevliAd  ? `👤 Görevli: ${res.gorevliAd}${res.gorevliUnvan ? ' / ' + res.gorevliUnvan : ''}` : null,
      res.onaylayanAd ? `✅ Onaylayan: ${res.onaylayanAd}${res.onaylayanUnvan ? ' / ' + res.onaylayanUnvan : ''}` : null,
    ].filter(Boolean).join('\n');

    const onaylandi = await showConfirm(`Aşağıdaki bilgiler okundu:\n\n${escHtml(satirlar)}\n\nForma aktaralım mı?`, 'Evet, Aktar', 'Hayır');
    if (!onaylandi) {
      const modal = document.getElementById('yeniProjeModal');
      if (modal) {
        modal.querySelector('#yeniProjeAdim2Olur').style.display = 'none';
        modal.querySelector('#yeniProjeAdim2Manuel').style.display = 'block';
        const inp = modal.querySelector('#yeniProjeAdi');
        if (inp) { inp.value = res.isAdi; setTimeout(() => inp.focus(), 50); }
      }
      return;
    }

    document.getElementById('yeniProjeModal').style.display = 'none';
    proje = getDefaultProje();
    proje.isAdi = res.isAdi;
    if (res.isDT) {
      if (res.onayNo)     proje.dtOnayNo = res.onayNo;
      if (res.onayTarihi) proje.dtOnayTarihi = res.onayTarihi;
      if (res.gorevliAd) {
        const g = matchOrAddGorevli(res.gorevliAd, res.gorevliUnvan);
        proje.dtGorevliler[0].ad = g.ad;
        proje.dtGorevliler[0].unvan = g.unvan;
        proje.dtGorevliSayisi = 1;
      }
    } else {
      if (res.onayNo)     proje.ymOnayNo = res.onayNo;
      if (res.onayTarihi) proje.ymOnayTarihi = res.onayTarihi;
      if (res.gorevliAd) {
        const g = matchOrAddGorevli(res.gorevliAd, res.gorevliUnvan);
        proje.ymGorevliler[0].ad = g.ad;
        proje.ymGorevliler[0].unvan = g.unvan;
        proje.ymGorevliSayisi = 1;
      }
    }
    if (res.onaylayanAd) {
      const a = matchOrAddOnaylayanAmir(res.onaylayanAd, res.onaylayanUnvan);
      proje.onaylayanAmir = { ad: a.ad, unvan: a.unvan };
    }
    if (typeof window !== 'undefined') {
      window._bekleyenProjeDosyalari = [{ file, kategori: 'olur_teklif', altEtiket: res.isDT ? 'DT Olur' : 'YM Olur' }];
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

// ===== TÜM BELGELERİ YÜKLE — ÇOKLU BELGE VE TEKLİF ENTEGRASYONU =====

function acYeniProjeTopluAdim() {
  const modal = document.getElementById('yeniProjeModal');
  if (!modal) return;
  const adim1 = modal.querySelector('#yeniProjeAdim1');
  const adim2t = modal.querySelector('#yeniProjeAdim2Toplu');
  if (adim1) adim1.style.display = 'none';
  if (adim2t) adim2t.style.display = 'block';
  topluDosyalariGuncelleUI();
  setupTopluDropzone();
}

function setupTopluDropzone() {
  const bolumler = [
    { id: 'topluDropzoneOlur', grup: 'olur', border: '#93c5fd', hoverBorder: '#2563eb', bg: '#eff6ff', hoverBg: '#dbeafe' },
    { id: 'topluDropzoneYm',   grup: 'ym',   border: '#facc15', hoverBorder: '#ca8a04', bg: '#fefce8', hoverBg: '#fef08a' },
    { id: 'topluDropzoneDt',   grup: 'dt',   border: '#86efac', hoverBorder: '#16a34a', bg: '#f0fdf4', hoverBg: '#dcfce7' }
  ];

  bolumler.forEach(b => {
    const dz = document.getElementById(b.id);
    if (!dz || dz._dzInit) return;
    dz._dzInit = true;

    dz.addEventListener('dragover', (e) => {
      e.preventDefault();
      dz.style.borderColor = b.hoverBorder;
      dz.style.background = b.hoverBg;
    });

    dz.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dz.style.borderColor = b.border;
      dz.style.background = b.bg;
    });

    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.style.borderColor = b.border;
      dz.style.background = b.bg;
      if (e.dataTransfer && e.dataTransfer.files) {
        topluDosyalarEkle(e.dataTransfer.files, b.grup);
      }
    });
  });
}

function syncTopluDuzListe() {
  topluSecilenDosyalar = [
    ...(topluGrupluDosyalar.olur || []),
    ...(topluGrupluDosyalar.ym || []),
    ...(topluGrupluDosyalar.dt || [])
  ];
}

function topluDosyalarEkle(fileList, grup = 'olur') {
  if (!fileList || fileList.length === 0) return;
  const hedefGrup = ['olur', 'ym', 'dt'].includes(grup) ? grup : 'olur';
  if (!Array.isArray(topluGrupluDosyalar[hedefGrup])) topluGrupluDosyalar[hedefGrup] = [];
  const liste = topluGrupluDosyalar[hedefGrup];

  for (let i = 0; i < fileList.length; i++) {
    const f = fileList[i];
    const zatenVar = liste.some(ex => ex.name === f.name && ex.size === f.size);
    if (!zatenVar) {
      liste.push(f);
    }
  }
  syncTopluDuzListe();
  topluDosyalariGuncelleUI();
}

function topluDosyaSil(grupVeyaIndex, index) {
  if (typeof grupVeyaIndex === 'string' && ['olur', 'ym', 'dt'].includes(grupVeyaIndex)) {
    const liste = topluGrupluDosyalar[grupVeyaIndex] || [];
    if (index >= 0 && index < liste.length) {
      liste.splice(index, 1);
    }
  } else if (typeof grupVeyaIndex === 'number') {
    let kalan = grupVeyaIndex;
    for (const g of ['olur', 'ym', 'dt']) {
      const liste = topluGrupluDosyalar[g] || [];
      if (kalan < liste.length) {
        liste.splice(kalan, 1);
        break;
      }
      kalan -= liste.length;
    }
  }
  syncTopluDuzListe();
  topluDosyalariGuncelleUI();
}

function topluDosyalariTemizle() {
  topluSecilenDosyalar = [];
  topluGrupluDosyalar = { olur: [], ym: [], dt: [] };
  ['topluInputOlur', 'topluInputYm', 'topluInputDt', 'topluBelgelerInput'].forEach(id => {
    const inp = document.getElementById(id);
    if (inp) inp.value = '';
  });
  topluDosyalariGuncelleUI();
}

function formatDosyaBoyutu(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function topluDosyalariGuncelleUI() {
  syncTopluDuzListe();
  const wrap = document.getElementById('topluDosyalarWrap');
  const sayiEl = document.getElementById('topluDosyaSayisi');
  if (sayiEl) sayiEl.textContent = String(topluSecilenDosyalar.length);
  if (wrap) wrap.style.display = topluSecilenDosyalar.length > 0 ? 'block' : 'none';

  const grupAyarlari = [
    { grup: 'olur', sayiId: 'topluSayiOlur', listeId: 'topluListeOlur' },
    { grup: 'ym',   sayiId: 'topluSayiYm',   listeId: 'topluListeYm' },
    { grup: 'dt',   sayiId: 'topluSayiDt',   listeId: 'topluListeDt' }
  ];

  grupAyarlari.forEach(ga => {
    const dosyalar = topluGrupluDosyalar[ga.grup] || [];
    const sEl = document.getElementById(ga.sayiId);
    const lEl = document.getElementById(ga.listeId);
    if (sEl) sEl.textContent = `${dosyalar.length} belge`;
    if (!lEl) return;

    if (dosyalar.length === 0) {
      lEl.style.display = 'none';
      lEl.innerHTML = '';
      return;
    }

    lEl.style.display = 'flex';
    const g = ga.grup;
    lEl.innerHTML = dosyalar.map((f, idx) => {
      const isPdf = (f.name || '').toLowerCase().endsWith('.pdf');
      const icon = isPdf ? '📄' : '🖼️';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 10px;background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:6px;font-size:12px">
          <div style="display:flex;align-items:center;gap:7px;overflow:hidden;flex:1">
            <span>${icon}</span>
            <span style="font-weight:500;color:var(--gray-800);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(f.name)}">${escHtml(f.name)}</span>
            <span style="color:var(--gray-400);font-size:11px;flex-shrink:0">(${formatDosyaBoyutu(f.size)})</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <span id="topluDosyaDurum_${g}_${idx}" style="font-size:11px;font-weight:600"></span>
            <button type="button" ${dtmEventAttr('click', function(event) { topluDosyaSil(String(g), Number(idx)); })} style="background:none;border:none;color:#ef4444;font-size:13px;cursor:pointer;padding:2px 5px;line-height:1" title="Kaldır">✕</button>
          </div>
        </div>
      `;
    }).join('');
  });
}

function topluAnaliziDurdur(sessiz = false) {
  topluAnalizDurduruldu = true;
  if (topluAnalizAbortController) {
    try { topluAnalizAbortController.abort(); } catch(_) {}
    topluAnalizAbortController = null;
  }
  const ilerlemeEl = document.getElementById('topluIlerlemeDurumu');
  const btnBaslat = document.getElementById('btnTopluAnalizBaslat');
  const btnGeri = document.getElementById('btnTopluGeri');
  if (ilerlemeEl) ilerlemeEl.style.display = 'none';
  if (btnBaslat) { btnBaslat.disabled = false; btnBaslat.style.opacity = '1'; }
  if (btnGeri) { btnGeri.disabled = false; btnGeri.style.opacity = '1'; }
  if (!sessiz) {
    showToast('Analiz durduruldu.', 'info', 2500);
  }
}

async function topluAnaliziBaslat() {
  syncTopluDuzListe();
  if (topluSecilenDosyalar.length === 0) {
    showToast('Lütfen ilgili bölümlere en az bir belge (Olur veya Teklif Mektubu) ekleyin.', 'warning');
    return;
  }

  const apiKey = (referans && referans.geminiApiKey) || (typeof localStorage !== 'undefined' && localStorage.getItem('dtm_gemini_api_key'));
  if (!apiKey || !apiKey.trim()) {
    showToast('Tüm belgeleri çözümlemek için Google Gemini API anahtarı gereklidir. Veri Merkezi sayfasından anahtarınızı kaydedebilirsiniz.', 'warning', 6000);
    return;
  }

  topluAnalizDurduruldu = false;
  const ilerlemeEl = document.getElementById('topluIlerlemeDurumu');
  const baslikEl = document.getElementById('topluDurumBaslik');
  const detayEl = document.getElementById('topluDurumDetay');
  const barEl = document.getElementById('topluIlerlemeBar');
  const btnBaslat = document.getElementById('btnTopluAnalizBaslat');
  const btnGeri = document.getElementById('btnTopluGeri');

  if (ilerlemeEl) ilerlemeEl.style.display = 'block';
  if (btnBaslat) { btnBaslat.disabled = true; btnBaslat.style.opacity = '0.6'; }

  const islenecekKuyruk = [];
  const grupEtiket = {
    olur: 'Olur Belgesi',
    ym: 'Piyasa Fiyat Araştırması (Y.M.)',
    dt: 'Resmi Teklif Mektubu (D.T.)'
  };
  ['olur', 'ym', 'dt'].forEach(g => {
    (topluGrupluDosyalar[g] || []).forEach((file, idx) => {
      islenecekKuyruk.push({ file, grup: g, idx, etiket: grupEtiket[g] });
    });
  });

  const total = islenecekKuyruk.length;
  const parsedResults = [];
  const hataliDosyalar = [];

  for (let i = 0; i < total; i++) {
    if (topluAnalizDurduruldu) break;
    const item = islenecekKuyruk[i];
    const durumEl = document.getElementById(`topluDosyaDurum_${item.grup}_${item.idx}`);
    if (durumEl) { durumEl.style.color = '#0284c7'; durumEl.textContent = '⏳ Okunuyor...'; }
    if (baslikEl) baslikEl.textContent = `[${item.etiket}] Belge ${i + 1} / ${total} analiz ediliyor...`;
    if (detayEl) detayEl.textContent = `${item.file.name} (Yapay zeka metin ve tabloları çözümlüyor)`;
    if (barEl) barEl.style.width = `${Math.round(((i + 0.2) / total) * 100)}%`;

    if (i > 0) {
      await new Promise(r => setTimeout(r, 350));
      if (topluAnalizDurduruldu) break;
    }

    try {
      const res = await dtmAnalyzeSingleDocumentMultiAI(item.file, apiKey.trim(), item.grup);
      parsedResults.push(res);
      if (durumEl) { durumEl.style.color = '#16a34a'; durumEl.textContent = '✅ Okundu'; }
      if (barEl) barEl.style.width = `${Math.round(((i + 1) / total) * 100)}%`;
    } catch (err) {
      if (topluAnalizDurduruldu) break;
      console.warn(`[Toplu Analiz] ${item.file.name} çözümlenemedi:`, err);
      if (durumEl) { durumEl.style.color = '#dc2626'; durumEl.textContent = '⚠️ Hata'; durumEl.title = err.message || ''; }
      hataliDosyalar.push({ dosya: item.file.name, hata: err.message });
    }
  }

  topluAnalizAbortController = null;
  if (btnBaslat) { btnBaslat.disabled = false; btnBaslat.style.opacity = '1'; }
  if (btnGeri) { btnGeri.disabled = false; btnGeri.style.opacity = '1'; }
  if (ilerlemeEl) ilerlemeEl.style.display = 'none';

  const modalEl = document.getElementById('yeniProjeModal');
  if (topluAnalizDurduruldu && (!modalEl || modalEl.style.display === 'none')) {
    return;
  }

  if (parsedResults.length === 0) {
    if (!topluAnalizDurduruldu) {
      showToast('Belgelerden hiçbiri çözümlenemedi. ' + (hataliDosyalar[0]?.hata || ''), 'error', 5000);
    }
    return;
  }

  if (hataliDosyalar.length > 0) {
    showToast(`${total} belgeden ${parsedResults.length} adedi okundu, ${hataliDosyalar.length} dosya atlandı.`, 'warning', 4500);
  } else if (topluAnalizDurduruldu) {
    showToast(`Okunan ${parsedResults.length} belge ile özet hazırlandı.`, 'info', 3500);
  }

  let ozet;
  try { ozet = dtmTopluBelgeleriDerleVeHazirla(parsedResults); } catch(e) { showToast('Analiz doğrulanamadı: ' + e.message, 'error'); return; }
  if (!ozet) {
    showToast('Belgelerden anlamlı bir proje veya teklif bilgisi çıkarılamadı.', 'warning', 4000);
    return;
  }

  renderTopluAnalizOnayModal(ozet);
}

function renderTopluAnalizOnayModal(ozet) {
  if (!ozet || !ozet.proje) return;
  const eski = document.getElementById('topluAnalizOnayModal');
  if (eski) eski.remove();

  const modalEl = document.createElement('div');
  modalEl.id = 'topluAnalizOnayModal';
  modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10050;display:flex;align-items:center;justify-content:center;padding:16px;';

  const p = ozet.proje;
  const kazananIdx = ozet.kazananIdx;
  const kazananFirma = kazananIdx >= 0 && p.teklifFirmalar ? p.teklifFirmalar[kazananIdx] : null;

  const aktifKalemler = (p.isKalemleri || []).filter(k => k && k.ad && k.ad.trim());
  const kalemlerHtml = aktifKalemler.length > 0 ? `
    <div style="margin-bottom:14px">
      <div style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:6px">📦 Tespit Edilen İş Kalemleri (${aktifKalemler.length})</div>
      <table class="data-table" style="font-size:12px;width:100%">
        <thead><tr><th>#</th><th>Kalem Adı</th><th style="text-align:right">Miktar</th><th>Birim</th></tr></thead>
        <tbody>
          ${aktifKalemler.map((k, i) => `<tr><td class="merkez">${i + 1}</td><td>${escHtml(k.ad)}</td><td class="rakam">${k.miktar}</td><td>${escHtml(k.birim || 'Adet')}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  ` : '';

  const ymHtml = ozet.ayriYmDt && Array.isArray(ozet.ymFirmalarData) ? `
    <div style="margin-bottom:14px">
      <div style="font-size:12px;font-weight:600;color:#854d0e;margin-bottom:6px">📊 Yaklaşık Maliyet — Piyasa Fiyat Araştırması (${ozet.ymFirmalarData.length})</div>
      ${ozet.ymFirmalarData.map(f => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;margin-bottom:5px;border-radius:8px;background:#fefce8;border:1px solid #fef08a">
          <div style="font-weight:600;font-size:12.5px;color:#854d0e;display:flex;align-items:center;gap:6px">
            <span>${escHtml(f.ad || 'İsimsiz Firma')}</span>
            ${f.eksik ? '<span style="color:#b45309;font-size:11px">Eksik/tutarsız</span>' : ''}
            ${f.isNew ? '<span style="background:#2563eb;color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;font-weight:600">🆕 Yeni Firma</span>' : ''}
          </div>
          <div style="font-size:13px;font-weight:700;color:#713f12">${f.toplam > 0 ? formatCurrency(f.toplam) + ' TL' : '-'}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const firmalarHtml = (ozet.firmalarTeklifData || []).map((f, i) => {
    const isKazanan = i === kazananIdx;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;margin-bottom:6px;border-radius:8px;background:${isKazanan ? '#f0fdf4' : '#f9fafb'};border:1px solid ${isKazanan ? '#86efac' : '#e5e7eb'}">
        <div>
          <div style="font-weight:600;font-size:13px;color:${isKazanan ? '#166534' : 'var(--gray-800)'};display:flex;align-items:center;gap:6px">
            <span>${escHtml(f.ad || 'İsimsiz Firma')}</span>
            ${f.eksik ? '<span style="color:#b45309">Eksik veya tutarsız: kazanan hesabına katılmadı</span>' : ''}
            ${isKazanan ? '<span style="background:#16a34a;color:#fff;font-size:10px;padding:2px 6px;border-radius:10px;font-weight:600">🏆 EN AVANTAJLI (KAZANAN)</span>' : ''}
            ${f.isNew ? '<span style="background:#2563eb;color:#fff;font-size:10px;padding:2px 6px;border-radius:10px;font-weight:600">🆕 Onayla Eklenecek</span>' : ''}
          </div>
          <div style="font-size:11px;color:var(--gray-500);margin-top:2px">Teklif Fiyatı</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:700;color:${isKazanan ? '#166534' : 'var(--gray-900)'}">${f.toplam > 0 ? formatCurrency(f.toplam) + ' TL' : '-'}</div>
        </div>
      </div>
    `;
  }).join('');

  modalEl.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:28px;width:640px;max-width:96vw;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;border-bottom:1px solid var(--gray-200);padding-bottom:12px">
        <div>
          <h3 style="margin:0;font-size:18px;color:var(--gray-800);display:flex;align-items:center;gap:8px">
            <span>✨</span> Tüm Belgeler Çözümlendi
          </h3>
          <p style="margin:4px 0 0;font-size:12px;color:var(--gray-500)">Aşağıdaki proje verileri belgelerinizden otomatik olarak hazırlandı.</p>
        </div>
        <button id="btnTopluOnayModalKapatX" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--gray-400);line-height:1;padding:4px 8px;border-radius:6px">&times;</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px;margin-bottom:14px;background:#f8fafc;padding:12px;border-radius:10px;border:1px solid #e2e8f0">
        <div>
          <span style="font-size:11px;color:var(--gray-500);display:block">İşin Adı</span>
          <strong style="font-size:13px;color:var(--gray-800);word-break:break-word">${escHtml(p.isAdi || '(Belirtilmedi)')}</strong>
        </div>
        <div>
          <span style="font-size:11px;color:var(--gray-500);display:block">İş Türü</span>
          <span style="font-size:12px;font-weight:600;color:#1e40af">${escHtml(p.isTuru)}</span>
        </div>
        <div>
          <span style="font-size:11px;color:var(--gray-500);display:block">Y.M. Onay No / Tarih</span>
          <span style="font-size:12px;color:var(--gray-700)">${escHtml(p.ymOnayNo || '-')} / ${escHtml(p.ymOnayTarihi ? p.ymOnayTarihi.split('-').reverse().join('.') : '-')}</span>
        </div>
        <div>
          <span style="font-size:11px;color:var(--gray-500);display:block">D.T. Onay No / Tarih</span>
          <span style="font-size:12px;color:var(--gray-700)">${escHtml(p.dtOnayNo || '-')} / ${escHtml(p.dtOnayTarihi ? p.dtOnayTarihi.split('-').reverse().join('.') : '-')}</span>
        </div>
        <div>
          <span style="font-size:11px;color:var(--gray-500);display:block">Görevli Personel</span>
          <span style="font-size:12px;color:var(--gray-700)">${escHtml(p.ymGorevliler[0]?.ad || p.dtGorevliler[0]?.ad || '-')}</span>
        </div>
        <div>
          <span style="font-size:11px;color:var(--gray-500);display:block">Onaylayan Amir</span>
          <span style="font-size:12px;color:var(--gray-700)">${escHtml(p.onaylayanAmir?.ad || '-')}</span>
        </div>
      </div>

      ${kalemlerHtml}

      ${ymHtml}

      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:6px">🏷️ ${ozet.ayriYmDt ? 'Resmi Teklif — Teklif Mektubu' : 'Firma Teklifleri'} (${ozet.firmalarTeklifData.length})</div>
        ${firmalarHtml}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;margin-bottom:16px">
        <div>
          <span style="font-size:11px;color:#1e40af;font-weight:600;display:block">YAKLAŞIK MALİYET</span>
          <strong style="font-size:15px;color:#1e3a8a">${ozet.yaklasikMaliyet > 0 ? formatCurrency(ozet.yaklasikMaliyet) + ' TL' : '-'}</strong>
        </div>
        ${kazananFirma ? `
          <div style="text-align:right">
            <span style="font-size:11px;color:#166534;font-weight:600;display:block">SÖZLEŞME / KAZANAN BEDEL</span>
            <strong style="font-size:15px;color:#14532d">${formatCurrency(hesaplaTeklifFirmaToplam(kazananFirma, getKalemler(p)))} TL</strong>
          </div>
        ` : ''}
      </div>

      ${ozet.yeniEklenenFirmalar && ozet.yeniEklenenFirmalar.length > 0 ? `
        <div style="padding:8px 12px;background:#fefce8;border-radius:6px;border:1px solid #fef08a;font-size:12px;color:#854d0e;margin-bottom:16px">
          💡 <strong>${ozet.yeniEklenenFirmalar.length} firma</strong> (${escHtml(ozet.yeniEklenenFirmalar.join(', '))}) sisteminize otomatik olarak kaydedildi ve zenginleştirildi.
        </div>
      ` : ''}

      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="btnTopluOnayModalVazgec" style="padding:10px 18px;border:1px solid var(--gray-300);background:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500">← Düzenle / Vazgeç</button>
        <button id="btnTopluOnayModalKabul" class="btn btn-primary" style="padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px">
          <span>✅ Projeyi Başlat ve Veri Girişine Git</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  modalEl.querySelector('#btnTopluOnayModalKapatX')?.addEventListener('click', () => modalEl.remove());
  modalEl.querySelector('#btnTopluOnayModalVazgec')?.addEventListener('click', () => modalEl.remove());
  modalEl.querySelector('#btnTopluOnayModalKabul')?.addEventListener('click', () => {
    dtmTopluProjeyiKabulEt(p, ozet);
  });
}

function dtmTopluProjeyiKabulEt(yeniProje, ozet) {
  if (ozet) {
    if (JSON.stringify(referans) !== ozet.referansSurumu) { showToast('Referans listesi değişti. Analizi yeniden hazırlayınız.', 'warning'); return; }
    referans = ozet.onayReferansi; saveReferans(referans);
  }
  if (typeof window !== 'undefined') {
    window._bekleyenProjeDosyalari = [];
    (topluGrupluDosyalar?.olur || []).forEach(f => window._bekleyenProjeDosyalari.push({ file: f, kategori: 'olur_teklif', altEtiket: 'Olur' }));
    (topluGrupluDosyalar?.ym || []).forEach(f => window._bekleyenProjeDosyalari.push({ file: f, kategori: 'olur_teklif', altEtiket: 'Piyasa Fiyat (YM)' }));
    (topluGrupluDosyalar?.dt || []).forEach(f => window._bekleyenProjeDosyalari.push({ file: f, kategori: 'olur_teklif', altEtiket: 'Resmi Teklif (DT)' }));
  }
  proje = yeniProje;
  currentCloudProjeId = null;
  currentProjeKilitli = false;
  currentProjeBaskaKullanici = false;
  projeAktif = true;
  lastSavedProjeSnapshot = JSON.stringify(proje);
  saveProje(proje);

  document.getElementById('topluAnalizOnayModal')?.remove();
  const m = document.getElementById('yeniProjeModal');
  if (m) m.style.display = 'none';

  currentPage = 'veri-giris';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('[data-page="veri-giris"]')?.classList.add('active');
  updateNavLock();
  renderPage();
  autoSave();

  showToast('Proje başarıyla oluşturuldu! Belgeler ve evraklar aktarıldı.', 'success', 5000);
}

if (typeof window !== 'undefined') {
  window.kapatYeniProjeModal = kapatYeniProjeModal;
  window.topluAnaliziDurdur = topluAnaliziDurdur;
  window.acYeniProjeTopluAdim = acYeniProjeTopluAdim;
  window.setupTopluDropzone = setupTopluDropzone;
  window.topluDosyalarEkle = topluDosyalarEkle;
  window.topluDosyaSil = topluDosyaSil;
  window.topluDosyalariTemizle = topluDosyalariTemizle;
  window.topluDosyalariGuncelleUI = topluDosyalariGuncelleUI;
  window.topluAnaliziBaslat = topluAnaliziBaslat;
  window.renderTopluAnalizOnayModal = renderTopluAnalizOnayModal;
  window.dtmTopluProjeyiKabulEt = dtmTopluProjeyiKabulEt;
  window.matchOrAddFirma = matchOrAddFirma;
  window.dtmTopluBelgeleriDerleVeHazirla = dtmTopluBelgeleriDerleVeHazirla;
  window.dtmAnalyzeSingleDocumentMultiAI = dtmAnalyzeSingleDocumentMultiAI;
  window.dtmTemizleGeminiHamYanit = dtmTemizleGeminiHamYanit;
}


// PDF veya Görsel (JPG, JPEG, PNG, WEBP) içindeki metin katmanını tarayıcıda oku; harici OCR servisi kullanılmaz.
async function readPdfText(file) {
  if (!file) throw new Error('Dosya seçilmedi.');

  // Görsel dosyası kontrolü (JPG, JPEG, PNG, WEBP, BMP)
  const isImage = (file.type && file.type.startsWith('image/')) ||
                  /\.(png|jpe?g|webp|bmp)$/i.test(file.name || '');

  if (isImage) {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        showToast('Belge fotoğrafı/görseli algılandı, yerel OCR ile okunuyor...', 'info', 5000);
        const ocrResult = await dtmLocalOcrImage(file);
        if (ocrResult && ocrResult.trim()) {
          return ocrResult;
        }
      } catch(imgErr) {
        console.warn('Görsel OCR denemesi başarısız:', imgErr);
      }
    }
    throw new Error('Görselde okunabilir metin bulunamadı. Lütfen daha net ve aydınlık bir fotoğraf seçin veya bilgileri elle girin.');
  }

  const pdf = await dtmLoadPdf(file);
  let fullText = '';
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    if (!fullText.trim()) {
      // Dijital metin yok (Taranmış veya çizim/vektör PDF): %100 yerel çevrimdışı OCR'ı devreye sok
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
          showToast('Taranmış/çizim belge algılandı, yerel OCR ile okunuyor...', 'info', 5000);
          const ocrResult = await dtmLocalOcrPdf(pdf);
          if (ocrResult && ocrResult.trim()) {
            return ocrResult;
          }
        } catch(ocrErr) {
          console.warn('Yerel OCR denemesi başarısız:', ocrErr);
        }
      }
      throw new Error('Bu PDF okunabilir metin içermiyor. Taranmış/görüntü PDF yerine metin içeren bir PDF seçin veya bilgileri elle girin.');
    }
    return fullText;
  } finally {
    await pdf.destroy?.();
  }
}

async function dtmLocalOcrImage(file) {
  const Tesseract = await dtmEnsureTesseract();
  if (!Tesseract || !Tesseract.createWorker) throw new Error('OCR motoru başlatılamadı.');

  const base = (typeof document !== 'undefined' && document.baseURI) ? document.baseURI : window.location.href;
  const workerPath = new URL('js/vendor/tesseract/worker.min.js', base).href;
  const corePath = new URL('js/vendor/tesseract/tesseract-core-lstm.wasm.js', base).href;
  const langPath = new URL('js/vendor/tesseract/lang-data', base).href;

  const worker = await Tesseract.createWorker('tur', 1, {
    workerPath,
    corePath,
    langPath,
    workerBlobURL: false
  });

  try {
    const imgUrl = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Görsel yüklenemedi.'));
      i.src = imgUrl;
    });

    const canvas = document.createElement('canvas');
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    // Fotoğraflar için çözünürlük ölçeklendirmesi (en az 1600px genişlik)
    if (width > 0 && width < 1600) {
      const scale = 1600 / width;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(imgUrl);

    // Fotoğraf gölgelerini azaltmak ve yazıları netleştirmek için dinamik kontrast
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      let minVal = 255, maxVal = 0;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (gray < minVal) minVal = gray;
        if (gray > maxVal) maxVal = gray;
      }
      const range = (maxVal - minVal) || 1;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const norm = ((gray - minVal) / range) * 255;
        // Metinleri koyulaştırıp kağıdı parlat
        let val;
        if (norm < 135) {
          val = Math.max(0, norm * 0.7);
        } else {
          val = Math.min(255, 135 + (norm - 135) * 1.45);
        }
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch(_) {}

    const { data } = await worker.recognize(canvas);
    canvas.width = 0;
    canvas.height = 0;
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

async function dtmEnsureTesseract() {
  if (typeof window !== 'undefined' && window.Tesseract) return window.Tesseract;
  const base = (typeof document !== 'undefined' && document.baseURI) ? document.baseURI : (typeof window !== 'undefined' ? window.location.href : '');
  const scriptUrl = new URL('js/vendor/tesseract/tesseract.min.js', base).href;
  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="tesseract.min.js"]');
    if (existing) {
      if (window.Tesseract) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Yerel OCR kütüphanesi yüklenemedi.'));
    document.head.appendChild(script);
  });
  return window.Tesseract;
}

async function dtmLocalOcrPdf(pdf) {
  const Tesseract = await dtmEnsureTesseract();
  if (!Tesseract || !Tesseract.createWorker) throw new Error('OCR motoru başlatılamadı.');

  const base = (typeof document !== 'undefined' && document.baseURI) ? document.baseURI : window.location.href;
  const workerPath = new URL('js/vendor/tesseract/worker.min.js', base).href;
  const corePath = new URL('js/vendor/tesseract/tesseract-core-lstm.wasm.js', base).href;
  const langPath = new URL('js/vendor/tesseract/lang-data', base).href;

  const worker = await Tesseract.createWorker('tur', 1, {
    workerPath,
    corePath,
    langPath,
    workerBlobURL: false
  });

  let ocrText = '';
  try {
    const maxPages = Math.min(pdf.numPages, 3);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const { data } = await worker.recognize(canvas);
      ocrText += (data.text || '') + '\n';
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await worker.terminate();
  }
  return ocrText;
}

async function dtmLoadPdf(file) {
  if (typeof window !== 'undefined' && window.pdfjsReady) {
    try { await window.pdfjsReady; } catch(err) { /* handled in bootstrap */ }
  }
  const lib = typeof window !== 'undefined' && window.pdfjsLib ? window.pdfjsLib : (typeof pdfjsLib !== 'undefined' ? pdfjsLib : null);
  if (!lib) {
    if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
      throw new Error('Tarayıcı güvenlik kısıtlaması nedeniyle yerel dosya (file://) modunda PDF modülü başlatılamıyor. Lütfen uygulamayı GitHub Pages üzerinden açın veya bilgileri manuel girin.');
    }
    throw new Error('PDF okuyucu yüklenemedi.');
  }
  const data = await file.arrayBuffer();
  const options = { data, isEvalSupported: false, useWasm: false, disableFontFace: true };
  if (typeof document !== 'undefined' && document.baseURI) {
    options.standardFontDataUrl = window.pdfStandardFontDataUrl || new URL('js/vendor/standard_fonts/', document.baseURI).href;
  }
  return lib.getDocument(options).promise;
}

function parseTLTutar(str) {
  let s = String(str).replace(/[TLtl\s₺]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return 0;
  return Number(s) || 0;
}

async function parseTeklifPDF(file, type, fi) {
  if (!file) return;
  showToast('PDF okunuyor...', 'info');
  try {
    const fullText = await readPdfText(file);

    // Tutar: önce "Tutarı [sayı]" kalıbını ara (en güvenilir)
    // Metin katmanında "TL" bozuk olabileceği için önce tutar etiketini kullan.
    let tutar = 0;
    const tutariMatch = fullText.match(/Tutar[ıi]\s*[:\-]?\s*([0-9][0-9.,]*)/i);
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
    const onaylandi = await showConfirm(`PDF'den okunan bilgiler:\n\n${escHtml(satirlar)}\n\nAktaralım mı?`, 'Evet, Aktar', 'Hayır');
    if (!onaylandi) return;

    const liste = type === 'ym' ? proje.ymFirmalar : proje.teklifFirmalar;
    if (!liste[fi]) throw new Error('Firma satırı bulunamadı.');
    if (tutar > 0) {
      const aktifKi = proje.isKalemleri.findIndex(k => k.ad?.trim());
      if (aktifKi < 0) throw new Error('Önce bir iş kalemi giriniz.');
      const miktarVal = parseFloat(proje.isKalemleri[aktifKi]?.miktar);
      if (!Number.isFinite(miktarVal) || miktarVal <= 0) throw new Error('İş kalemi miktarı sıfırdan büyük olmalıdır.');
      const miktar = miktarVal;
      liste[fi].fiyatlar[aktifKi] = Math.round((tutar / miktar) * 100) / 100;
    }
    if (firmaAdi) liste[fi].ad = firmaAdi;
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

function analizTeklifiniDogrula(fi) {
  const firma = proje.teklifFirmalar[fi];
  const kalemler = getKalemler(proje);
  if (!firma || !kalemler.length || kalemler.some((k,i) => !(hesaplamaSayisi(firma.fiyatlar[i]) > 0))) {
    showToast('Her kalem için pozitif birim fiyat giriniz.', 'warning'); return;
  }
  firma.analizEksik = false;
  proje.kazananFirmaIndex = hesaplaKazananFirma(proje);
  autoSave(); renderPage();
}

function onFiyatChange(el) {
  const type = el.dataset.firma;
  const fi = parseInt(el.dataset.fi);
  const ki = parseInt(el.dataset.ki);
  const val = hesaplamaSayisi(el.value);
  if (!Number.isFinite(val) || val < 0) {
    showToast('Birim fiyat: sıfır veya pozitif bir sayı girin.', 'warning');
    el.value = (type === 'ym' ? proje.ymFirmalar : proje.teklifFirmalar)[fi].fiyatlar[ki] || '';
    return;
  }
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

function veriGirisBolumeGit(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const header = card.querySelector('.card-header');
  const body = card.querySelector('.card-body');
  if (header && header.classList.contains('collapsed')) {
    header.classList.remove('collapsed');
  }
  if (body && body.classList.contains('collapsed')) {
    body.classList.remove('collapsed');
  }
  card.style.scrollMarginTop = '68px';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function veriGirisTumKartlariDaraltAc() {
  const main = document.getElementById('mainContent');
  if (!main) return;
  const headers = Array.from(main.querySelectorAll('.card[id^="vgCard_"] > .card-header'));
  if (!headers.length) return;
  const hepsiKapali = headers.every(h => h.classList.contains('collapsed'));
  headers.forEach(h => {
    const body = h.nextElementSibling;
    if (hepsiKapali) {
      h.classList.remove('collapsed');
      if (body) body.classList.remove('collapsed');
    } else {
      h.classList.add('collapsed');
      if (body) body.classList.add('collapsed');
    }
  });
}

function ymFirmalariniTeklifeKopyala() {
  if (currentProjeKilitli) {
    showToast('Bu proje kilitli olduğu için değişiklik yapılamaz.', 'warning');
    return;
  }
  const ymFirmalar = Array.isArray(proje?.ymFirmalar) ? proje.ymFirmalar : [];
  const seciliYmVar = ymFirmalar.some(f => f && String(f.ad || '').trim());
  if (!seciliYmVar) {
    showToast('Önce Yaklaşık Maliyet bölümünde en az bir firma seçin.', 'warning');
    return;
  }
  if (!Array.isArray(proje.teklifFirmalar)) proje.teklifFirmalar = [];
  let aktarılanSayi = 0;
  ymFirmalar.forEach((yf, idx) => {
    const ad = String(yf?.ad || '').trim();
    if (!proje.teklifFirmalar[idx]) {
      proje.teklifFirmalar[idx] = { ad: '', fiyatlar: [] };
    }
    if (ad) {
      proje.teklifFirmalar[idx].ad = ad;
      aktarılanSayi++;
    }
  });
  autoSave();
  renderPage();
  showToast(`✅ ${aktarılanSayi} Yaklaşık Maliyet firması Resmi Teklif listesine aktarıldı!`, 'success');
}

if (typeof window !== 'undefined') {
  window.veriGirisBolumeGit = veriGirisBolumeGit;
  window.veriGirisTumKartlariDaraltAc = veriGirisTumKartlariDaraltAc;
  window.ymFirmalariniTeklifeKopyala = ymFirmalariniTeklifeKopyala;
}

// ===================== PROJE LİSTESİ SAYFALAMA YARDIMCISI =====================
const PROJE_SAYFA_BOYUTU = 10;

function renderProjeSayfalamaBar(toplamAdet, aktifSayfa, sayfaBoyutu, onSayfaSecCallback, icKenarModu = false) {
  if (!toplamAdet || toplamAdet <= 0) return '';
  const boyut = sayfaBoyutu || PROJE_SAYFA_BOYUTU;
  const toplamSayfa = Math.max(1, Math.ceil(toplamAdet / boyut));
  const sayfa = Math.min(Math.max(1, aktifSayfa || 1), toplamSayfa);
  const baslangic = (sayfa - 1) * boyut + 1;
  const bitis = Math.min(toplamAdet, sayfa * boyut);

  const sayfaNoList = [];
  if (toplamSayfa <= 7) {
    for (let i = 1; i <= toplamSayfa; i++) sayfaNoList.push(i);
  } else {
    sayfaNoList.push(1);
    if (sayfa > 3) sayfaNoList.push('...');
    const sBas = Math.max(2, sayfa - 1);
    const sBit = Math.min(toplamSayfa - 1, sayfa + 1);
    for (let i = sBas; i <= sBit; i++) sayfaNoList.push(i);
    if (sayfa < toplamSayfa - 2) sayfaNoList.push('...');
    sayfaNoList.push(toplamSayfa);
  }

  const oncekiDis = sayfa <= 1;
  const sonrakiDis = sayfa >= toplamSayfa;

  const sayfaBtnHtml = sayfaNoList.map(no => {
    if (no === '...') {
      return `<span style="padding:4px 6px;color:#9ca3af;font-size:12.5px;font-weight:600">…</span>`;
    }
    const aktifMi = no === sayfa;
    return `<button type="button" ${aktifMi ? 'disabled' : dtmEventAttr('click', function(event) { event.stopPropagation(); onSayfaSecCallback(no); })}
      style="min-width:32px;height:32px;padding:0 8px;border-radius:7px;font-size:12.5px;font-weight:700;cursor:${aktifMi ? 'default' : 'pointer'};border:1px solid ${aktifMi ? '#1e3a5f' : '#d1d5db'};background:${aktifMi ? '#1e3a5f' : '#fff'};color:${aktifMi ? '#fff' : '#374151'};transition:all 0.15s">
      ${no}
    </button>`;
  }).join('');

  const wrapStyle = icKenarModu
    ? 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:10px 16px;background:#f8fafc;border-top:1px solid #e5e7eb'
    : 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:14px;padding:10px 16px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,0.03)';

  return `
    <div class="dtm-sayfalama-bar" style="${wrapStyle}">
      <div style="font-size:12.5px;color:#4b5563">
        Toplam <strong style="color:#111827">${toplamAdet}</strong> projeden <strong style="color:#111827">${baslangic}–${bitis}</strong> arası gösteriliyor
        <span style="color:#9ca3af;margin-left:4px">(Sayfa ${sayfa} / ${toplamSayfa} • Sayfa başına ${boyut})</span>
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
        <button type="button" ${oncekiDis ? 'disabled' : dtmEventAttr('click', function(event) { event.stopPropagation(); onSayfaSecCallback(sayfa - 1); })}
          style="height:32px;padding:0 11px;border-radius:7px;font-size:12.5px;font-weight:600;border:1px solid #d1d5db;background:${oncekiDis ? '#f3f4f6' : '#fff'};color:${oncekiDis ? '#9ca3af' : '#374151'};cursor:${oncekiDis ? 'not-allowed' : 'pointer'}">
          ◀ Önceki
        </button>
        ${sayfaBtnHtml}
        <button type="button" ${sonrakiDis ? 'disabled' : dtmEventAttr('click', function(event) { event.stopPropagation(); onSayfaSecCallback(sayfa + 1); })}
          style="height:32px;padding:0 11px;border-radius:7px;font-size:12.5px;font-weight:600;border:1px solid #d1d5db;background:${sonrakiDis ? '#f3f4f6' : '#fff'};color:${sonrakiDis ? '#9ca3af' : '#374151'};cursor:${sonrakiDis ? 'not-allowed' : 'pointer'}">
          Sonraki ▶
        </button>
      </div>
    </div>`;
}

// ===================== BELGELER SAYFASI =====================
let currentBelge = 'yaklasik-maliyet';

async function renderBelgelerPage() {
  const main = document.getElementById('mainContent');
  const isDokumanlarModu = currentPage === 'dokumanlar';

  // DURUM 1: Proje seçilmedi → proje listesini göster
  if (!currentBelgelerProjeId) {
    main.innerHTML = `
      <div class="page-header">
        <h2>${isDokumanlarModu ? '&#128206; Dokümanlar' : '&#128196; Belgeler'}</h2>
        <p>${isDokumanlarModu ? 'Dokümanlarını (fatura, vergi borcu yoktur, fotoğraf, teklifler vb.) görüntülemek veya yüklemek istediğiniz projeyi seçin.' : 'Belge oluşturmak istediğiniz projeyi seçin.'}</p>
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
            <div class="dtm-empty-icon">${isDokumanlarModu ? '&#128206;' : '&#128196;'}</div>
            <div class="dtm-empty-title">Henüz proje yok</div>
            <div class="dtm-empty-desc">${isDokumanlarModu ? 'Doküman yüklemek için önce bir proje oluşturun.' : 'Belge oluşturmak için önce bir proje oluşturun.'}</div>
            <div class="dtm-empty-action">
              <button class="btn btn-primary" ${dtmEventAttr('click', function(event) { yeniProjeBaslat() })}>Yeni Proje</button>
            </div>
          </div>`;
        return;
      }

      const projeKartBelge = (p) => {
        const tarih = p.updatedAt?.toDate ? p.updatedAt.toDate().toLocaleDateString('tr-TR') : '-';
        return `<div class="ky-proje-item">
          <div class="ky-proje-info">
            <div class="ky-proje-name">${escHtml(p.isAdi || '(İsimsiz)')}</div>
            <div class="ky-proje-meta">
              <span class="ky-proje-date">&#128197; ${tarih}</span>
              ${getIsTuruBadge(p.isTuru)}
              ${getStatusBadge(p.status || 'taslak')}
              <span id="projeEvrakRozet_${escAttr(p.id)}" class="ky-proje-evrak-rozet" style="display:none;align-items:center;gap:4px;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:10px;background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd"></span>
            </div>
          </div>
          <div class="ky-proje-actions">
            <button class="ky-btn-open" ${dtmEventAttr('click', function(event) { belgelerProjeAc(String(p.id ?? '')) })}>${isDokumanlarModu ? '📎 Dokümanları Aç' : 'Belge Oluştur'}</button>
          </div>
        </div>`;
      };

      let belgelerAktifSayfa = 1;
      let sonGorunenSayfaProjeleri = [];

      const renderBelgelerProjeGrid = (aramaMetni, durumFiltre, siralamaAnahtari) => {
        const ara = aramaMetni.trim().toLocaleLowerCase('tr');
        let filtrelenen = projeler;
        if (durumFiltre !== 'hepsi') filtrelenen = filtrelenen.filter(p => (p.status || 'taslak') === durumFiltre);
        if (ara) filtrelenen = filtrelenen.filter(p => (p.isAdi || '').toLocaleLowerCase('tr').includes(ara));
        filtrelenen = siralaProjeler(filtrelenen, siralamaAnahtari);
        if (filtrelenen.length === 0) {
          sonGorunenSayfaProjeleri = [];
          return `<div style="text-align:center;padding:30px;color:#9ca3af;font-size:13px">Arama/filtre ile eşleşen proje yok.</div>`;
        }
        const toplamSayfa = Math.max(1, Math.ceil(filtrelenen.length / PROJE_SAYFA_BOYUTU));
        if (belgelerAktifSayfa > toplamSayfa) belgelerAktifSayfa = toplamSayfa;
        if (belgelerAktifSayfa < 1) belgelerAktifSayfa = 1;
        sonGorunenSayfaProjeleri = filtrelenen.slice((belgelerAktifSayfa - 1) * PROJE_SAYFA_BOYUTU, belgelerAktifSayfa * PROJE_SAYFA_BOYUTU);
        return `<div class="ky-proje-grid">${sonGorunenSayfaProjeleri.map(projeKartBelge).join('')}</div>` +
          renderProjeSayfalamaBar(filtrelenen.length, belgelerAktifSayfa, PROJE_SAYFA_BOYUTU, (yeniSayfa) => {
            belgelerAktifSayfa = yeniSayfa;
            window.belgelerProjeFiltrele(false);
          });
      };

      listEl.innerHTML = `
        <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
          <input id="belgelerProjeArama" type="text" placeholder="🔍 Proje adına göre ara..." ${dtmEventAttr('input', function(event) { belgelerProjeFiltrele(true) })}
            style="flex:1;min-width:200px;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none">
          <select id="belgelerProjeDurum" ${dtmEventAttr('change', function(event) { belgelerProjeFiltrele(true) })}
            style="padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;background:#fff;cursor:pointer;outline:none">
            <option value="hepsi">Tüm Durumlar</option>
            <option value="taslak">Taslak</option>
            <option value="geri_gonderildi">Geri Gönderildi</option>
            <option value="gonderildi">Gönderildi</option>
            <option value="onaylandi">Onaylandı</option>
            <option value="arsivlendi">Arşivlendi</option>
          </select>
          <select id="belgelerProjeSirala" ${dtmEventAttr('change', function(event) { belgelerProjeFiltrele(true) })}
            style="padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;background:#fff;cursor:pointer;outline:none">
            <option value="tarih-yeni">Tarihe göre (Yeni → Eski)</option>
            <option value="tarih-eski">Tarihe göre (Eski → Yeni)</option>
            <option value="isim-az">İsme göre (A → Z)</option>
            <option value="isim-za">İsme göre (Z → A)</option>
          </select>
        </div>
        <div id="belgelerProjeGrid">${renderBelgelerProjeGrid('', 'hepsi', 'tarih-yeni')}</div>`;

      window.belgelerProjeFiltrele = (sayfaSifirla = true) => {
        if (sayfaSifirla) belgelerAktifSayfa = 1;
        const ara = document.getElementById('belgelerProjeArama').value;
        const durum = document.getElementById('belgelerProjeDurum').value;
        const sirala = document.getElementById('belgelerProjeSirala').value;
        document.getElementById('belgelerProjeGrid').innerHTML = renderBelgelerProjeGrid(ara, durum, sirala);
        projeListesiEvrakRozetleriniYukle(sonGorunenSayfaProjeleri);
      };
      projeListesiEvrakRozetleriniYukle(sonGorunenSayfaProjeleri);
    } catch(e) {
      const listEl = document.getElementById('belgelerProjeList');
      if (listEl) listEl.innerHTML = `<div style="color:red;padding:20px">Projeler yüklenemedi: ${escHtml(e?.message || '')}</div>`;
    }
    return;
  }

  // DURUM 2: Proje seçili
  if (isDokumanlarModu) {
    main.innerHTML = `
      <div class="page-header" style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <button ${dtmEventAttr('click', function(event) { currentBelgelerProjeId=null; renderPage(); })}
          style="background:none;border:1px solid var(--gray-300);border-radius:6px;padding:6px 12px;
                 cursor:pointer;font-size:13px;color:var(--gray-600);white-space:nowrap;margin-top:4px">
          &#8592; Proje Listesi
        </button>
        <div>
          <h2>&#128206; Dokümanlar</h2>
          <p style="display:flex;align-items:center;gap:8px">${escHtml(proje.isAdi || '')} ${getStatusBadge(currentProjeStatus)}</p>
        </div>
      </div>
      <div id="projeDosyaListesi">Yükleniyor...</div>
    `;
    projeDosyaListesiYukle();
    return;
  }

  if (currentBelge === 'dokumanlar') currentBelge = 'yaklasik-maliyet';
  const isMalVeyaHizmet = isMalVeyaHizmetTuru(proje.isTuru);
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
    `<div class="belge-tab ${currentBelge === b.id ? 'active' : ''}" ${dtmEventAttr('click', function(event) { currentBelge=String(b.id ?? ''); renderPage(); })}>${b.ad}</div>`
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
      <button ${dtmEventAttr('click', function(event) { currentBelgelerProjeId=null; renderPage(); })}
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
        <button ${dtmEventAttr('click', function(event) { acTeknikSartnameDuzenleModal() })}
          style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#f59e0b;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(245,158,11,0.35)"
          ${dtmEventAttr('mouseover', function(event) { this.style.background='#d97706' })} ${dtmEventAttr('mouseout', function(event) { this.style.background='#f59e0b' })}>
          <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Şartname Metnini Düzenle
        </button>
      ` : ''}
      ${currentBelge === 'sozlesme' ? `
        <button ${dtmEventAttr('click', function(event) { acSozlesmeMaddeleriDuzenleModal() })}
          style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#f59e0b;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(245,158,11,0.35)"
          ${dtmEventAttr('mouseover', function(event) { this.style.background='#d97706' })} ${dtmEventAttr('mouseout', function(event) { this.style.background='#f59e0b' })}>
          <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Sözleşme Maddelerini Düzenle
        </button>
      ` : ''}
      <button ${dtmEventAttr('click', function(event) { yazdirBelge() })}
        style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;background:#3b82f6;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(59,130,246,0.35)"
        ${dtmEventAttr('mouseover', function(event) { this.style.background='#2563eb' })} ${dtmEventAttr('mouseout', function(event) { this.style.background='#3b82f6' })}>
        <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
        Yazdır
      </button>
      <button ${dtmEventAttr('click', function(event) { acBelgeIndirModal() })}
        style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;background:#10b981;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(16,185,129,0.35)"
        ${dtmEventAttr('mouseover', function(event) { this.style.background='#059669' })} ${dtmEventAttr('mouseout', function(event) { this.style.background='#10b981' })}>
        <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        İndir
      </button>
      <button ${dtmEventAttr('click', function(event) { ihaleDosyasiZipIndir(false) })}
        title="Tüm resmi tutanakları ve yüklenen evrakları tamamı PDF formatında tek bir ZIP dosyası olarak indir"
        style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(124,58,237,0.35)"
        ${dtmEventAttr('mouseover', function(event) { this.style.background='#6d28d9' })} ${dtmEventAttr('mouseout', function(event) { this.style.background='#7c3aed' })}>
        📦 İhale Dosyası (ZIP)
      </button>
      <button ${dtmEventAttr('click', function(event) { pdfIndirBelge() })} style="display:none">PDF İndir</button>
    </div>
    <div class="belge-preview${['yaklasik-maliyet','teklif-tutanagi'].includes(currentBelge) ? ' landscape' : ''}">${belgeHTML}</div>
  `;
  if (currentBelge === 'teklif-tutanagi') {
    requestAnimationFrame(() => hizalaGorevliIsmi(document));
  }
}

async function belgelerProjeAc(projeId) {
  try {
    const doc = await getProjeFromCloud(projeId);
    proje = Object.assign(getDefaultProje(), doc.data);
    currentCloudProjeId = projeId;
    currentProjeStatus = doc.status || 'taslak';
    currentProjeKazananBasitUsul = doc.kazananBasitUsul === true;
    const gonderildi = doc.status === 'gonderildi' || doc.status === 'onaylandi';
    currentProjeKilitli = doc.locked === true || gonderildi;
    currentBelgelerProjeId = projeId;
    currentBelge = currentPage === 'dokumanlar' ? 'dokumanlar' : 'yaklasik-maliyet';
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
        await updateProjeInCloud(currentCloudProjeId, proje);
      } catch(e) {
        console.warn('Buluta kaydedilemedi:', e);
        showToast('Değişiklikler buluta kaydedilemedi: ' + hataMesaji(e) + ' (Sadece bu cihazda kaldı, tekrar deneyin)', 'error');
        kapat();
        renderPage();
        return;
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
        await updateProjeInCloud(currentCloudProjeId, proje);
      } catch(e) {
        console.warn('Buluta kaydedilemedi:', e);
        showToast('Değişiklikler buluta kaydedilemedi: ' + hataMesaji(e) + ' (Sadece bu cihazda kaldı, tekrar deneyin)', 'error');
        kapat();
        renderPage();
        return;
      }
    }
    showToast("Teknik Şartname metni başarıyla güncellendi.", "success");
    kapat();
    renderPage();
  };
}

function yazdirBelge() {
  if (!belgeHesaplamaKontrol(proje, referans)) return;
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
  if (!belgeHesaplamaKontrol(proje, referans)) return;
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
  // Sözleşme, sayfa başına tekrar eden üstbilgi/imza bloğu içerdiği için
  // html2canvas tabanlı PDF motoruyla doğru üretilemiyor; tarayıcının kendi
  // yazdırma motoruna yönlendiriliyor (çıktı "Yazdır" ile birebir aynı olur).
  if (sozlesme) {
    showToast('Yazdırma penceresinde Hedef olarak "PDF olarak kaydet" seçin.', 'info', 6000);
    belgeYazdir(html, landscape, true, dosyaAdi);
    return;
  }
  return belgePdfIndir(html, landscape, dosyaAdi);
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
  if (!dtmFirmaHavuzuIlkYuklendi && !dtmFirmaHavuzuYukleniyor) {
    setTimeout(() => ortakFirmaHavuzunuYukle(true), 20);
  }

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
      <td style="width:46%"><input type="text" class="ref-input" value="${escAttr(o.ad)}" placeholder="Ad Soyad giriniz" ${dtmEventAttr('change', function(event) { onRefChange('onaylayanList', (i), 'ad', this.value) })}></td>
      <td style="width:46%"><input type="text" class="ref-input" value="${escAttr(o.unvan)}" placeholder="Ünvan (Örn: Şube Müdürü)" ${dtmEventAttr('change', function(event) { onRefChange('onaylayanList', (i), 'unvan', this.value) })}></td>
      <td style="width:8%; text-align:center;">
        <button class="btn-icon-danger" ${dtmEventAttr('click', function(event) { onRefDelete('onaylayanList', (i)) })} title="Amiri Sil">
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
      <button ${dtmEventAttr('click', function(event) { onRefDelete('ilceler', (i)) })} title="İlçeyi Sil">
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
      ${isSuperAdmin ? `<button class="btn btn-primary" ${dtmEventAttr('click', function(event) { forceMergeYukleniciHavuzu() })} style="display:flex;align-items:center;gap:6px">${typeof getIcon === 'function' ? getIcon('sliders', 16) : '🔄'} Tüm Firmaları Havuza Çek</button>` : ''}
    </div>

    <div class="card">
      <div class="card-header" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <h3 style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('users', 18) : ''}</span>
          Görevli Personel Rehberi
          <span style="font-size:11px;background:#e8eefb;color:var(--primary);padding:2px 8px;border-radius:12px;font-weight:600;margin-left:4px">${sortedMuhendis.length} Personel</span>
        </h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div style="display:flex; gap:10px; margin-bottom:16px; align-items:center;">
          <select class="ref-input" style="flex:1; height:40px; padding:0 12px; font-size:13px; border-radius:8px;" ${dtmEventAttr('change', function(event) { onMuhendisSelect(this.value) })}>
            <option value="-1">🔍 Kayıtlı personellerden seçin veya düzenleyin...</option>
            ${sortedMuhendis.map(item => `<option value="${escAttr(item.i)}" ${dtmSeciliMuhendisIndex === item.i ? 'selected' : ''}>${escHtml(item.m.ad)} — ${escHtml(item.m.unvan || 'Belirtilmedi')}</option>`).join('')}
          </select>
          <button class="btn-icon-primary" style="height:40px; padding:0 14px; font-size:13px; font-weight:600; border-radius:8px; white-space:nowrap;" ${dtmEventAttr('click', function(event) { acMuhendisModal() })}>
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
              <button class="btn-icon-primary" style="height:36px; padding:0 14px;" ${dtmEventAttr('click', function(event) { acMuhendisModal((dtmSeciliMuhendisIndex)) })} title="Düzenle">
                ${typeof getIcon === 'function' ? getIcon('edit', 14) : '✏️'} Bilgileri Düzenle
              </button>
              <button class="btn-icon-danger" style="height:36px; padding:0 12px;" ${dtmEventAttr('click', function(event) { onRefDelete('muhendisList', (dtmSeciliMuhendisIndex)); onMuhendisSelect(-1); })} title="Sil">
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
      <div class="card-header" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <h3 style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('building', 18) : ''}</span>
          Firma & Yüklenici Rehberi
          <span style="font-size:11px;background:#e8eefb;color:var(--primary);padding:2px 8px;border-radius:12px;font-weight:600;margin-left:4px">${sortedFirms.length} Kayıtlı</span>
        </h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div style="display:flex; gap:10px; margin-bottom:16px; align-items:center;">
          <select class="ref-input" style="flex:1; height:40px; padding:0 12px; font-size:13px; border-radius:8px;" ${dtmEventAttr('change', function(event) { onFirmaListeSelect(this.value) })}>
            <option value="-1">🔍 Kayıtlı firmalardan seçin veya düzenleyin...</option>
            ${dtmYeniEklenenFirma ? `<option value="NEW" selected>➕ Yeni Firma (Kaydedilmedi)</option>` : ''}
            ${sortedFirms.map(item => `<option value="${escAttr(item.i)}" ${!dtmYeniEklenenFirma && dtmSeciliFirmaIndex === item.i ? 'selected' : ''}>${escHtml(item.f.ad)}</option>`).join('')}
          </select>
          <button class="btn-icon-primary" style="height:40px; padding:0 14px; font-size:13px; font-weight:600; border-radius:8px; white-space:nowrap;" ${dtmEventAttr('click', function(event) { onFirmaListeEkle() })}>
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
              <div class="form-group"><label>Firma / Kişi Adı <span style="color:var(--danger)">*</span></label><input type="text" class="ref-input" id="firmaInputAd" value="${escAttr(f.ad || '')}" placeholder="Firma / Kişi Adı Giriniz" ${dtmEventAttr('change', function(event) { onFirmaFieldChange('firmaList', String(i ?? ''), 'ad', this.value) })} ${dtmEventAttr('input', function(event) { onFirmaFieldChange('firmaList', String(i ?? ''), 'ad', this.value) })}></div>
              <div class="form-group"><label>Tür <span style="color:var(--danger)">*</span></label><select class="ref-input" id="firmaInputTur" ${dtmEventAttr('change', function(event) { onFirmaFieldChange('firmaList', String(i ?? ''), 'tur', this.value); renderPage('veri-merkezi'); })}>
                  <option value="Kişi" ${f.tur === 'Kisi' || f.tur === 'Kişi' ? 'selected' : ''}>Kişi</option>
                  <option value="Şirket" ${f.tur === 'Şirket' ? 'selected' : ''}>Şirket</option>
              </select></div>
              <div class="form-group" style="grid-column: span 2;"><label>Adres</label><input type="text" class="ref-input" id="firmaInputAdres" value="${escAttr(f.adres || '')}" placeholder="Mahalle, sokak, no (il/ilçe aşağıdan seçilir)" ${dtmEventAttr('change', function(event) { onFirmaFieldChange('firmaList', String(i ?? ''), 'adres', this.value); firmaAdresOnizlemeGuncelle(f, 'firmaInput') })}></div>
              ${firmaIlIlceAlanlari(f, 'firmaList', i, 'firmaInput', () => renderPage('veri-merkezi'))}
              <div class="form-group"><label>Telefon</label><input type="tel" inputmode="tel" autocomplete="off" class="ref-input${telefonGecerliMi(f.tel) ? '' : ' has-error'}" id="firmaInputTel" value="${escAttr(f.tel || '')}" placeholder="(0) 500 123 45 67" ${dtmEventAttr('input', function(event) { telefonGirdiIsle(this, event) })} ${dtmEventAttr('change', function(event) { this.value = telefonNormalize(this.value); this.classList.toggle('has-error', !telefonGecerliMi(this.value)); onFirmaFieldChange('firmaList', String(i ?? ''), 'tel', this.value) })}></div>
              <div class="form-group"><label>Faks</label><input type="tel" inputmode="tel" autocomplete="off" class="ref-input${telefonGecerliMi(f.faks) ? '' : ' has-error'}" id="firmaInputFaks" value="${escAttr(f.faks || '')}" placeholder="(0) 500 123 45 67" ${dtmEventAttr('input', function(event) { telefonGirdiIsle(this, event) })} ${dtmEventAttr('change', function(event) { this.value = telefonNormalize(this.value); this.classList.toggle('has-error', !telefonGecerliMi(this.value)); onFirmaFieldChange('firmaList', String(i ?? ''), 'faks', this.value) })}></div>
              <div class="form-group"><label>E-Posta</label><input type="email" inputmode="email" autocomplete="off" class="ref-input${epostaGecerliMi(f.eposta) ? '' : ' has-error'}" id="firmaInputEposta" value="${escAttr(f.eposta || '')}" placeholder="ornek@domain.com" ${dtmEventAttr('change', function(event) { this.value = epostaNormalize(this.value); this.classList.toggle('has-error', !epostaGecerliMi(this.value)); if (!epostaGecerliMi(this.value)) showToast('E-posta adresi eksik: "@" işareti ve .com, .gov.tr gibi bir uzantı olmalı.', 'error'); onFirmaFieldChange('firmaList', String(i ?? ''), 'eposta', this.value) })}></div>
              ${f.tur === 'Şirket' ? '' : `<div class="form-group"><label>Doğum Tarihi</label><input type="date" class="ref-input" value="${escAttr(f.dogumTarihi || '')}" ${dtmEventAttr('change', function(event) { onFirmaFieldChange('firmaList', String(i ?? ''), 'dogumTarihi', this.value) })}></div>`}
              <div class="form-group" style="grid-column: span 2; display: flex; flex-direction: row; align-items: center; justify-content: flex-start; gap: 8px; margin-top: 5px;">
                <input type="checkbox" id="basitUsul_${i}" ${f.basitUsul ? 'checked' : ''} ${dtmEventAttr('change', function(event) { onFirmaFieldChange('firmaList', String(i ?? ''), 'basitUsul', this.checked) })}>
                <label for="basitUsul_${i}" style="margin:0; cursor:pointer; font-weight:600; color:var(--primary)">Bu Firma / Kişi Basit Usule Tabiidir</label>
              </div>
            </div>
            <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--gray-200); display:flex; justify-content:space-between; align-items:center;">
              <button class="btn btn-primary" ${dtmEventAttr('click', function(event) { kaydetFirmaFormu(String(i ?? '')) })} style="display:inline-flex;align-items:center;gap:6px">
                ${typeof getIcon === 'function' ? getIcon('check', 16) : '✓'} Bilgileri Kaydet
              </button>
              ${isNew ? `
                <button class="btn btn-outline btn-sm" ${dtmEventAttr('click', function(event) { vazgecFirmaFormu() })}>Vazgeç</button>
              ` : `
                <button class="btn btn-danger btn-sm" style="display:inline-flex;align-items:center;gap:4px" ${dtmEventAttr('click', function(event) { onRefDelete('firmaList', (i)); onFirmaListeSelect(-1); })}>
                  ${typeof getIcon === 'function' ? getIcon('trash', 14) : ''} Firmayı Sil
                </button>
              `}
            </div>
          </div>
          `;
        })() : `
          <div style="text-align:center; padding:16px 20px; background:var(--gray-50); border:1px dashed var(--gray-300); border-radius:10px; color:var(--gray-500); font-size:13px;">
            Firma detayını görüntülemek veya düzenlemek için yukarıdaki listeden bir firma seçin ya da <strong>+ Yeni Firma</strong> butonuna tıklayın.
          </div>
        `}
      </div>
    </div>

    <!-- ORTAK FİRMA HAVUZU KARTI (AYRI KART) -->
    <div id="ortakFirmaHavuzuContainer" style="margin-top:24px;">
      ${renderOrtakFirmaHavuzuBolumu()}
    </div>
    ` : ''}

    ${isSuperAdmin ? `
    <!-- Merkezi Yapay Zeka (Gemini AI) Entegrasyon Kartı -->
    <div class="card" style="border:1.5px solid #3b82f6;box-shadow:0 4px 15px rgba(59,130,246,0.08);">
      <div class="card-header" ${dtmEventAttr('click', function(event) { toggleCard(this) })} style="background:linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%);color:#fff;cursor:pointer;">
        <h3 style="display:flex;align-items:center;gap:8px;margin:0;color:#fff;">
          <span style="font-size:18px;">🤖</span>
          <span>Merkezi Yapay Zeka (Google Gemini AI) Entegrasyonu</span>
          <span style="font-size:11px;background:rgba(255,255,255,0.2);color:#fff;padding:2px 8px;border-radius:12px;font-weight:600;margin-left:4px">
            ${referans.geminiApiKey ? '✓ Aktif' : 'Tanımsız'}
          </span>
        </h3>
        <span class="toggle-icon" style="color:#fff;">&#9660;</span>
      </div>
      <div class="card-body" style="padding:20px;">
        <p style="font-size:13.5px;color:var(--gray-600);margin:0 0 10px;line-height:1.5;">
          Buraya tanımlayacağınız Google Gemini API anahtarı, <strong>tüm kurum personelleri</strong> için bulut üzerinden ortak aktif olur. Personeller Olur belgesi veya telefon fotoğrafı yüklediğinde, belgeler en güncel <strong>gemini-3.8-flash</strong> yapay zeka modeliyle saniyeler içinde analiz edilir; sonuçlar aktarılmadan önce kontrol edilmelidir.
        </p>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:12.5px;color:var(--gray-600);">
          <span>Kullanılan Model:</span>
          <span style="font-family:monospace;font-weight:700;background:var(--gray-100);color:var(--primary);padding:3px 10px;border-radius:6px;border:1px solid var(--gray-200);">gemini-3.8-flash (Aktif)</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:720px;">
          <div style="position:relative;flex:1;min-width:280px;">
            <input type="password" id="globalGeminiApiKey" value="${escAttr(referans.geminiApiKey || '')}" placeholder="Google AI Studio API Anahtarınızı giriniz (AIzaSy...)" style="width:100%;padding:10px 40px 10px 14px;border:1.5px solid var(--gray-300);border-radius:8px;font-size:13.5px;font-family:monospace;box-sizing:border-box;">
            <button type="button" ${dtmEventAttr('click', function(event) { toggleGeminiKeyVisibility() })} style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--gray-500);font-size:14px;padding:2px;" title="Göster / Gizle">👁️</button>
          </div>
          <button class="btn btn-primary" ${dtmEventAttr('click', function(event) { geminiApiKeyKaydet() })} style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;">
            💾 Buluta Kaydet
          </button>
          <button class="btn btn-outline" ${dtmEventAttr('click', function(event) { geminiApiKeyTestEt() })} style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;">
            ⚡ Bağlantıyı Test Et
          </button>
          ${referans.geminiApiKey ? `
            <button class="btn btn-icon-danger" ${dtmEventAttr('click', function(event) { geminiApiKeySil() })} title="Anahtarı Sistemden Kaldır" style="padding:10px 12px;">
              ✕
            </button>
          ` : ''}
        </div>
        <div id="geminiApiTestResult" style="margin-top:12px;font-size:13px;display:none;padding:8px 12px;border-radius:6px;background:var(--gray-50);"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
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
          <button class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:6px" ${dtmEventAttr('click', function(event) { onRefAdd('onaylayanList', {ad:'', unvan:''}) })}>
            ${typeof getIcon === 'function' ? getIcon('plus', 15) : '+'} Yeni Amir Ekle
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
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
              <button ${dtmEventAttr('click', function(event) { onRefDelete('idareList', (i)) })} title="Sil">
                ${typeof getIcon === 'function' ? getIcon('x', 14) : '×'}
              </button>
            </span>`).join('')}
        </div>
        <div style="display:flex;gap:8px;max-width:480px">
          <input type="text" class="ref-input" id="yeniIdare" placeholder="Yeni idare adı giriniz">
          <button class="btn btn-outline btn-sm" style="white-space:nowrap" ${dtmEventAttr('click', function(event) { const v=document.getElementById('yeniIdare').value;if(v){referans.idareList.push(v);saveGlobalReferans(referans);renderPage();} })}>+ Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
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
              <button ${dtmEventAttr('click', function(event) { onRefDelete('mudurlukler', (i)) })} title="Sil">
                ${typeof getIcon === 'function' ? getIcon('x', 14) : '×'}
              </button>
            </span>`).join('')}
        </div>
        <div style="display:flex;gap:8px;max-width:480px">
          <input type="text" class="ref-input" id="yeniMudurluk" placeholder="Yeni müdürlük adı giriniz">
          <button class="btn btn-outline btn-sm" style="white-space:nowrap" ${dtmEventAttr('click', function(event) { const v=document.getElementById('yeniMudurluk').value;if(v){referans.mudurlukler.push(v);saveGlobalReferans(referans);renderPage();} })}>+ Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
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
          <button class="btn btn-outline btn-sm" style="white-space:nowrap" ${dtmEventAttr('click', function(event) { const v=document.getElementById('yeniIlce').value;if(v){referans.ilceler.push(v);saveGlobalReferans(referans);renderPage();} })}>+ Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
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
                <td><input type="number" class="ref-input" value="${escAttr(s.sinir)}" min="0" placeholder="0" ${dtmEventAttr('change', function(event) { onRefChange('dtSinirlari', (i), 'sinir', parseFloat(this.value)||0) })}></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    ` : ''}
  `;
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

function firmaAdresOnizlemeGuncelle(f, idOnEki) {
  const el = document.getElementById(idOnEki + 'AdresOnizleme');
  if (el) el.textContent = firmaTamAdres(f) || '—';
}

// İlçe listeden seçilir; kurumun kendi ilinde yöneticinin tanımladığı ilçe listesi kullanılır.
function firmaIlIlceAlanlari(f, list, i, idOnEki, yenidenCiz) {
  const index = String(i ?? '');
  const yerelIl = referans.sehir || 'Karaman';
  const yerelIlceler = Array.isArray(referans.ilceler) ? referans.ilceler : [];
  const ilceler = f.il === yerelIl && yerelIlceler.length > 0 ? yerelIlceler : (TURKIYE_ILCELERI[f.il] || []);
  const ilceSecimli = ilceler.length > 0;
  const ilceSecenekleri = f.ilce && !ilceler.includes(f.ilce) ? [...ilceler, f.ilce] : ilceler;
  return `
    <div class="form-group"><label>İl</label><select class="ref-input" id="${idOnEki}Il" ${dtmEventAttr('change', function(event) { onFirmaFieldChange(list, index, 'il', this.value); onFirmaFieldChange(list, index, 'ilce', ''); yenidenCiz(); })}>
      <option value="">Seçiniz</option>
      ${TURKIYE_ILLERI.map(il => `<option value="${escAttr(il)}" ${f.il === il ? 'selected' : ''}>${escHtml(il)}</option>`).join('')}
    </select></div>
    <div class="form-group"><label>İlçe</label>${ilceSecimli
      ? `<select class="ref-input" id="${idOnEki}Ilce" ${dtmEventAttr('change', function(event) { onFirmaFieldChange(list, index, 'ilce', this.value); firmaAdresOnizlemeGuncelle(f, idOnEki); })}>
          <option value="">Seçiniz</option>
          ${ilceSecenekleri.map(x => `<option value="${escAttr(x)}" ${f.ilce === x ? 'selected' : ''}>${escHtml(x)}</option>`).join('')}
        </select>`
      : `<input type="text" class="ref-input" id="${idOnEki}Ilce" value="${escAttr(f.ilce || '')}" placeholder="${f.il ? 'İlçe giriniz' : 'Önce il seçiniz'}" ${f.il ? '' : 'disabled'} ${dtmEventAttr('change', function(event) { this.value = this.value.trim(); onFirmaFieldChange(list, index, 'ilce', this.value); firmaAdresOnizlemeGuncelle(f, idOnEki); })}>`}
    </div>
    <div class="form-group" style="grid-column: span 2; margin-top:-6px; font-size:12px; color:var(--gray-500);">Belgelerde görünecek adres: <strong id="${idOnEki}AdresOnizleme" style="color:var(--gray-700);">${escHtml(firmaTamAdres(f) || '—')}</strong></div>`;
}

// Kaydetmeden önce telefon/faks/e-postayı düzeltir; geçersiz alan varsa kaydı durdurur.
function firmaIletisimDogrula(f, idOnEki) {
  const hatali = [];
  [['tel', 'Tel', 'Telefon'], ['faks', 'Faks', 'Faks']].forEach(([alan, idSonEki, etiket]) => {
    f[alan] = telefonNormalize(f[alan]);
    if (!telefonGecerliMi(f[alan])) {
      hatali.push(etiket);
      markError(document.getElementById(idOnEki + idSonEki));
    }
  });
  f.eposta = epostaNormalize(f.eposta);
  const epostaHatali = !epostaGecerliMi(f.eposta);
  if (epostaHatali) markError(document.getElementById(idOnEki + 'Eposta'));

  if (hatali.length) {
    showToast(`${hatali.join(' ve ')} numarası 10 haneli olmalı. Örn: (0) 500 123 45 67`, 'error');
  } else if (epostaHatali) {
    showToast('E-posta adresi eksik: "@" işareti ve .com, .gov.tr gibi bir uzantı olmalı.', 'error');
  }
  return hatali.length === 0 && !epostaHatali;
}

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
  if (!firmaIletisimDogrula(f, 'firmaInput')) return;

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
  const kaydedilenFirma = isNew ? referans.firmaList[dtmSeciliFirmaIndex] : f;
  if (kaydedilenFirma) {
    firmaHavuzaSenkronizeEt(kaydedilenFirma);
  }
  if (isSuperAdmin) {
    saveGlobalReferans(referans);
  }
  showToast("Firma / Kişi bilgileri başarıyla kaydedildi ve ortak havuza aktarıldı.", "success");
  renderPage('veri-merkezi');
};

// ===== ORTAK FİRMA HAVUZU (DİĞER KULLANICILARIN FİRMALARI) =====
let dtmFirmaHavuzuAcik = true;
let dtmFirmaHavuzuFiltre = 'eksikler'; // 'eksikler' | 'tumu'
let dtmFirmaHavuzuArama = '';
let dtmFirmaHavuzuSayfa = 1;
let dtmFirmaHavuzuSeciliAnahtar = null;
let dtmFirmaHavuzuYukleniyor = false;
let dtmFirmaHavuzuIlkYuklendi = false;

function firmaGecersizTestKaydiMi(ad) {
  const ham = String(ad || '').trim();
  if (!ham || ham.length < 3) return true;
  const kucuk = ham.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
  if (['yeni firma', '(isimsiz firma)', '(i̇simsiz firma)', 'test', 'deneme', 'firma', 'ahmet ahmet'].includes(kucuk)) return true;
  const kelimeler = kucuk.split(' ').filter(Boolean);
  if (kelimeler.length === 2 && kelimeler[0] === kelimeler[1]) return true;
  return false;
}

function firmaAdAnahtari(ad) {
  const ham = String(ad || '').trim();
  if (firmaGecersizTestKaydiMi(ham)) return '';
  const temiz = ham
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/i̇/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\bsezen\s+su\b/g, 'sezensu')
    .replace(/\b(elektik|elektirk|elektr)\b/g, 'elektrik')
    .replace(/\botoamsyon\b/g, 'otomasyon')
    .replace(/\bsihhi\b/g, 'sihhi')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!temiz) return '';
  const hamKelimeler = temiz.split(' ').filter(Boolean);

  const kisaltmaHaritasi = {
    muh: 'muhendislik',
    mut: 'muteahhitlik',
    sis: 'sistemleri',
    malz: 'malzemeleri',
    kal: 'kalorifer',
    mak: 'makina',
    asan: 'asansor',
    tes: 'tesisat',
    en: 'enerji',
    teks: 'tekstil',
    ins: 'insaat'
  };

  const sirketBelirtecleri = new Set([
    'ltd', 'limited', 'sti', 'sirketi', 'as', 'anonim', 'san', 'sanayi', 'sanayii',
    'tic', 'ticaret', 'ins', 'insaat', 'muh', 'muhendislik', 'yapi', 'enerji',
    'tesisat', 'otomasyon', 'bilgisayar', 'telekom', 'telekomunikasyon', 'motor', 'musavirlik'
  ]);
  const sirketMi = hamKelimeler.some(k => sirketBelirtecleri.has(k)) || hamKelimeler[0] === 'gultes';

  const dolguKelimeler = new Set([
    've', 'san', 'sanayi', 'sanayii', 'tic', 'ticaret', 'ltd', 'limited',
    'sti', 'sirketi', 'as', 'anonim', 'ins', 'insaat', 'taah', 'taahhut',
    'ith', 'ihr', 'paz', 'pazarlama'
  ]);

  const ozelKelimeler = hamKelimeler
    .map(k => kisaltmaHaritasi[k] || k)
    .filter(k => !dolguKelimeler.has(k));

  if (ozelKelimeler.length === 0) return temiz;
  if (ozelKelimeler[0] === 'gultes') return 'gultes yapi';
  if (sirketMi) {
    if (ozelKelimeler[0] === 'karaman' && ozelKelimeler.length >= 3) {
      return ozelKelimeler.slice(0, 3).join(' ');
    }
    if (ozelKelimeler.length >= 2) {
      return ozelKelimeler.slice(0, 2).join(' ');
    }
  }
  return ozelKelimeler.join(' ');
}

function firmaAdiKalitePuani(ad) {
  const s = String(ad || '').trim();
  if (!s) return 0;
  let puan = Math.min(s.length, 85);
  // Yazım hatası içeren kayıtların puanını düşür
  if (/elektik|elektirk|otoamsyon|sıhhı/i.test(s)) puan -= 30;
  // Tamamı BÜYÜK HARF yerine Baş Harfleri Büyük (Title Case) olan düzgün yazımı tercih et
  const harfler = s.replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]/g, '');
  const buyukHarfler = s.replace(/[^A-ZÇĞİÖŞÜ]/g, '');
  if (harfler.length > 10 && buyukHarfler.length < harfler.length * 0.85) {
    puan += 15;
  }
  // Çok kısa eksik şirket isimlerinin puanını düşür
  if (s.split(/\s+/).length <= 2 && /^gültes/i.test(s)) puan -= 40;
  return puan;
}

function firmaHavuzaTekilBirlestir(hedefListe, kaynakFirma) {
  if (!kaynakFirma || !kaynakFirma.ad) return false;
  const temizAd = String(kaynakFirma.ad).trim();
  const anahtar = firmaAdAnahtari(temizAd);
  if (!anahtar) return false;

  const mevcut = hedefListe.find(x => firmaAdAnahtari(x.ad) === anahtar);
  const sirketIpucu = /\b(ltd|şti|a\.?ş|san|tic|mühendislik|inşaat|enerji|otomasyon|tesisat|yapı)\b/i.test(temizAd);
  const kaynakTur = (kaynakFirma.tur === 'Şirket' || sirketIpucu) ? 'Şirket' : 'Kişi';

  if (!mevcut) {
    hedefListe.push({
      ad: temizAd,
      tur: kaynakTur,
      adres: (kaynakFirma.adres || '').trim(),
      il: (kaynakFirma.il || '').trim(),
      ilce: (kaynakFirma.ilce || '').trim(),
      tel: telefonNormalize(kaynakFirma.tel),
      faks: telefonNormalize(kaynakFirma.faks),
      eposta: (kaynakFirma.eposta || '').trim(),
      vkn: kaynakFirma.vkn || '',
      vergiDairesi: (kaynakFirma.vergiDairesi || '').trim(),
      basitUsul: !!kaynakFirma.basitUsul
    });
    return true;
  }

  let degisti = false;
  if (firmaAdiKalitePuani(temizAd) > firmaAdiKalitePuani(mevcut.ad)) {
    mevcut.ad = temizAd;
    degisti = true;
  }

  // Adres sadece "Karaman" gibi tek kelimeyse ve yeni kayıtta açık adres varsa güncelle
  const mevcutAdres = (mevcut.adres || '').trim();
  const yeniAdres = (kaynakFirma.adres || '').trim();
  if (yeniAdres && (!mevcutAdres || (mevcutAdres.length <= 10 && yeniAdres.length > mevcutAdres.length))) {
    mevcut.adres = yeniAdres;
    degisti = true;
  }

  if (!mevcut.il && kaynakFirma.il) {
    mevcut.il = String(kaynakFirma.il).trim();
    mevcut.ilce = String(kaynakFirma.ilce || '').trim();
    degisti = true;
  }

  ['tel', 'faks', 'eposta', 'vkn', 'vergiDairesi'].forEach(alan => {
    if (!mevcut[alan] && kaynakFirma[alan]) {
      mevcut[alan] = (alan === 'tel' || alan === 'faks') ? telefonNormalize(kaynakFirma[alan]) : String(kaynakFirma[alan]).trim();
      degisti = true;
    }
  });
  if ('dogumTarihi' in mevcut) {
    delete mevcut.dogumTarihi;
    degisti = true;
  }
  if (mevcut.tur !== 'Şirket' && kaynakTur === 'Şirket') {
    mevcut.tur = 'Şirket';
    degisti = true;
  }
  if (!mevcut.basitUsul && kaynakFirma.basitUsul) {
    mevcut.basitUsul = true;
    degisti = true;
  }
  return degisti;
}

function tekillestirFirmaHavuzuListesi(liste) {
  const sonuc = [];
  (Array.isArray(liste) ? liste : []).forEach(f => firmaHavuzaTekilBirlestir(sonuc, f));
  sonuc.sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr-TR'));
  return sonuc;
}

// Firmaları ortak havuza tek transaction'da ekler; başarısızsa null döner.
// Normal kullanıcılar için kurallar listenin küçülmesine izin vermez, bu yüzden
// tekilleştirme (kayıt birleştirip silme) yalnızca yetkili rollerde yapılır.
async function firmalariOrtakHavuzaEkle(firmalar) {
  if (typeof db === 'undefined' || !currentDTMUser) return null;
  const yetkili = ['admin', 'superadmin', 'gerceklestirmeci'].includes(currentDTMUser.role);
  const globalRef = db.collection('globalReferans').doc('default');
  try {
    return await db.runTransaction(async tx => {
      const snap = await tx.get(globalRef);
      const hamGlobal = (snap.exists && Array.isArray(snap.data()?.yukleniciList)) ? [...snap.data().yukleniciList] : [];
      if (!snap.exists && !yetkili) return hamGlobal;
      const liste = yetkili ? tekillestirFirmaHavuzuListesi(hamGlobal) : hamGlobal.map(f => ({ ...f }));
      let degisti = !snap.exists || liste.length !== hamGlobal.length;
      (firmalar || []).forEach(f => { if (firmaHavuzaTekilBirlestir(liste, f)) degisti = true; });
      if (degisti) {
        liste.sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr-TR'));
        tx.set(globalRef, {
          yukleniciList: liste,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      return liste;
    });
  } catch (e) {
    console.warn('Firma ortak havuza eklenemedi:', e);
    return null;
  }
}

async function firmaHavuzaSenkronizeEt(firmaObj) {
  if (!firmaObj || !firmaObj.ad) return;
  if (!Array.isArray(referans.yukleniciList)) referans.yukleniciList = [];
  firmaHavuzaTekilBirlestir(referans.yukleniciList, firmaObj);
  referans.yukleniciList = tekillestirFirmaHavuzuListesi(referans.yukleniciList);

  const guncelHavuz = await firmalariOrtakHavuzaEkle([firmaObj]);
  if (guncelHavuz) referans.yukleniciList = tekillestirFirmaHavuzuListesi(guncelHavuz);
}

async function ortakFirmaHavuzunuYukle(sessiz = true) {
  if (dtmFirmaHavuzuYukleniyor) return;
  dtmFirmaHavuzuYukleniyor = true;
  guncelleOrtakFirmaHavuzuDOM();

  try {
    const birlesikHavuz = [];
    (referans.yukleniciList || []).forEach(f => firmaHavuzaTekilBirlestir(birlesikHavuz, f));
    (referans.firmaList || []).forEach(f => firmaHavuzaTekilBirlestir(birlesikHavuz, f));

    if (typeof db !== 'undefined' && currentDTMUser) {
      const yetkili = ['admin', 'superadmin', 'gerceklestirmeci'].includes(currentDTMUser.role);
      // Normal kullanıcı yalnızca kendi firma listesini gönderir; havuz önbelleğini
      // (yukleniciList) geri yazmak, yöneticinin havuzdan sildiği kayıtları geri getirirdi.
      const eklenecek = yetkili
        ? [...(referans.yukleniciList || []), ...(referans.firmaList || [])]
        : [...(referans.firmaList || [])];

      if (currentDTMUser.role === 'superadmin') {
        try {
          const usersRefSnap = await db.collection('referans').get();
          usersRefSnap.forEach(doc => {
            const data = doc.data();
            if (data && Array.isArray(data.firmaList)) eklenecek.push(...data.firmaList);
          });
        } catch (errUsers) {
          console.warn('Kullanıcı firma listeleri taranamadı:', errUsers);
        }
      }

      let guncelHavuz = await firmalariOrtakHavuzaEkle(eklenecek);
      if (!guncelHavuz) {
        try {
          const globalSnap = await db.collection('globalReferans').doc('default').get();
          guncelHavuz = (globalSnap.exists && Array.isArray(globalSnap.data()?.yukleniciList)) ? globalSnap.data().yukleniciList : [];
        } catch (errGlobal) {
          console.warn('Global firma havuzu okunamadı:', errGlobal);
          guncelHavuz = [];
        }
      }
      guncelHavuz.forEach(f => firmaHavuzaTekilBirlestir(birlesikHavuz, f));
      birlesikHavuz.sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr-TR'));
    } else {
      birlesikHavuz.sort((a, b) => (a.ad || '').localeCompare(b.ad || '', 'tr-TR'));
    }

    referans.yukleniciList = birlesikHavuz;
    try {
      const mevcutGlobal = JSON.parse(localStorage.getItem(GLOBAL_REF_KEY) || '{}');
      mevcutGlobal.yukleniciList = birlesikHavuz;
      localStorage.setItem(GLOBAL_REF_KEY, JSON.stringify(mevcutGlobal));
    } catch (_) {}
    dtmFirmaHavuzuIlkYuklendi = true;

    if (!sessiz) {
      showToast(`Firma Havuzu güncellendi (${birlesikHavuz.length} firma).`, 'success');
    }
  } catch (e) {
    console.error('Ortak firma havuzu yükleme hatası:', e);
    if (!sessiz) showToast('Firma havuzu yenilenirken hata oluştu: ' + (e?.message || e), 'error');
  } finally {
    dtmFirmaHavuzuYukleniyor = false;
    guncelleOrtakFirmaHavuzuDOM();
  }
}

function guncelleOrtakFirmaHavuzuDOM() {
  const container = document.getElementById('ortakFirmaHavuzuContainer');
  if (!container) return;
  const aramaEl = document.getElementById('firmaHavuzuAramaInput');
  const aktifMi = document.activeElement === aramaEl;
  const cursorStart = aktifMi ? aramaEl.selectionStart : null;
  const cursorEnd = aktifMi ? aramaEl.selectionEnd : null;

  container.innerHTML = renderOrtakFirmaHavuzuBolumu();

  if (aktifMi) {
    const yeniAramaEl = document.getElementById('firmaHavuzuAramaInput');
    if (yeniAramaEl) {
      yeniAramaEl.focus();
      if (cursorStart !== null && cursorEnd !== null) {
        try { yeniAramaEl.setSelectionRange(cursorStart, cursorEnd); } catch (_) {}
      }
    }
  }
}

window.toggleOrtakFirmaHavuzu = function() {
  dtmFirmaHavuzuAcik = !dtmFirmaHavuzuAcik;
  if (dtmFirmaHavuzuAcik && !dtmFirmaHavuzuIlkYuklendi && !dtmFirmaHavuzuYukleniyor) {
    ortakFirmaHavuzunuYukle(true);
  }
  guncelleOrtakFirmaHavuzuDOM();
};

window.firmaHavuzuFiltreDegistir = function(filtre) {
  dtmFirmaHavuzuFiltre = filtre;
  dtmFirmaHavuzuSayfa = 1;
  guncelleOrtakFirmaHavuzuDOM();
};

window.firmaHavuzuAramaDegistir = function(deger) {
  dtmFirmaHavuzuArama = deger || '';
  dtmFirmaHavuzuSayfa = 1;
  guncelleOrtakFirmaHavuzuDOM();
};

window.toggleHavuzFirmaDetay = function(encodedAd) {
  const anahtar = firmaAdAnahtari(decodeURIComponent(encodedAd || ''));
  if (!anahtar) return;
  dtmFirmaHavuzuSeciliAnahtar = (dtmFirmaHavuzuSeciliAnahtar === anahtar) ? null : anahtar;
  guncelleOrtakFirmaHavuzuDOM();
};

window.havuzdanFirmayiListemeEkle = function(encodedAd) {
  const hedefAd = decodeURIComponent(encodedAd || '');
  const anahtar = firmaAdAnahtari(hedefAd);
  const havuz = tekillestirFirmaHavuzuListesi(referans.yukleniciList);
  const kaynak = havuz.find(f => firmaAdAnahtari(f.ad) === anahtar);
  if (!kaynak) {
    showToast('Firma havuzda bulunamadı.', 'error');
    return;
  }

  if (!Array.isArray(referans.firmaList)) referans.firmaList = [];
  const mevcut = referans.firmaList.find(f => firmaAdAnahtari(f.ad) === anahtar);

  if (!mevcut) {
    referans.firmaList.push({
      ad: (kaynak.ad || '').trim(),
      tur: kaynak.tur === 'Şirket' ? 'Şirket' : 'Kişi',
      adres: (kaynak.adres || '').trim(),
      il: (kaynak.il || '').trim(),
      ilce: (kaynak.ilce || '').trim(),
      tel: telefonNormalize(kaynak.tel),
      faks: telefonNormalize(kaynak.faks),
      eposta: (kaynak.eposta || '').trim(),
      dogumTarihi: kaynak.dogumTarihi || '',
      vkn: kaynak.vkn || '',
      vergiDairesi: (kaynak.vergiDairesi || '').trim(),
      basitUsul: !!kaynak.basitUsul
    });
    saveReferans(referans);
    showToast(`"${kaynak.ad}" firmanız kendi listenize eklendi!`, 'success');
    renderPage('veri-merkezi');
  } else {
    let guncellendi = false;
    if (!mevcut.il && kaynak.il) {
      mevcut.il = String(kaynak.il).trim();
      mevcut.ilce = String(kaynak.ilce || '').trim();
      guncellendi = true;
    }
    ['adres', 'tel', 'faks', 'eposta', 'dogumTarihi', 'vkn', 'vergiDairesi'].forEach(alan => {
      if (!mevcut[alan] && kaynak[alan]) {
        mevcut[alan] = (alan === 'tel' || alan === 'faks') ? telefonNormalize(kaynak[alan]) : String(kaynak[alan]).trim();
        guncellendi = true;
      }
    });
    if (guncellendi) {
      saveReferans(referans);
      showToast(`"${kaynak.ad}" firmasının eksik bilgileri havuzdan tamamlandı.`, 'success');
      renderPage('veri-merkezi');
    } else {
      showToast('Bu firma zaten listenizde mevcut.', 'info');
    }
  }
};

window.havuzdanTumEksikleriListemeEkle = async function() {
  const havuz = tekillestirFirmaHavuzuListesi(referans.yukleniciList);
  if (!Array.isArray(referans.firmaList)) referans.firmaList = [];
  const benimAnahtarlarim = new Set(referans.firmaList.map(f => firmaAdAnahtari(f.ad)).filter(Boolean));

  const eklenecekler = [];
  havuz.forEach(kaynak => {
    const anahtar = firmaAdAnahtari(kaynak.ad);
    if (!anahtar || benimAnahtarlarim.has(anahtar)) return;
    benimAnahtarlarim.add(anahtar);
    eklenecekler.push(kaynak);
  });

  if (eklenecekler.length === 0) {
    showToast('Havuzdaki tüm firmalar zaten listenizde ekli.', 'info');
    return;
  }

  const ornekSayisi = 5;
  const ornekler = eklenecekler.slice(0, ornekSayisi).map(f => `<li>${escHtml(f.ad)}</li>`).join('');
  const kalan = eklenecekler.length - ornekSayisi;
  const onay = await showConfirm(
    `<strong>${eklenecekler.length} firma</strong> ortak havuzdan kendi firma listenize eklenecek:` +
    `<ul style="margin:8px 0 4px 18px">${ornekler}</ul>` +
    (kalan > 0 ? `<div style="color:var(--gray-500)">ve ${kalan} firma daha</div>` : '') +
    `<div style="margin-top:10px">Yalnızca bir firmaya ihtiyacınız varsa, o firmanın yanındaki "Listeme Ekle" düğmesini kullanın.</div>`,
    `Evet, ${eklenecekler.length} Firmayı Ekle`, 'Vazgeç'
  );
  if (!onay) return;

  eklenecekler.forEach(kaynak => {
    referans.firmaList.push({
      ad: (kaynak.ad || '').trim(),
      tur: kaynak.tur === 'Şirket' ? 'Şirket' : 'Kişi',
      adres: (kaynak.adres || '').trim(),
      il: (kaynak.il || '').trim(),
      ilce: (kaynak.ilce || '').trim(),
      tel: telefonNormalize(kaynak.tel),
      faks: telefonNormalize(kaynak.faks),
      eposta: (kaynak.eposta || '').trim(),
      dogumTarihi: kaynak.dogumTarihi || '',
      vkn: kaynak.vkn || '',
      vergiDairesi: (kaynak.vergiDairesi || '').trim(),
      basitUsul: !!kaynak.basitUsul
    });
  });

  saveReferans(referans);
  showToast(`${eklenecekler.length} firma ortak havuzdan kendi listenize eklendi!`, 'success');
  renderPage('veri-merkezi');
};

function renderOrtakFirmaHavuzuBolumu() {
  const havuz = tekillestirFirmaHavuzuListesi(referans.yukleniciList);
  const benimFirmalarim = Array.isArray(referans.firmaList) ? referans.firmaList : [];
  const benimMap = new Map();
  benimFirmalarim.forEach(f => {
    if (f && f.ad) {
      const k = firmaAdAnahtari(f.ad);
      if (k) benimMap.set(k, f);
    }
  });

  const eksikFirmalar = havuz.filter(f => !benimMap.has(firmaAdAnahtari(f.ad)));
  const aktifFiltre = (dtmFirmaHavuzuFiltre === 'eksikler' && eksikFirmalar.length === 0 && havuz.length > 0)
    ? 'tumu'
    : dtmFirmaHavuzuFiltre;

  const q = dtmFirmaHavuzuArama.trim().toLocaleLowerCase('tr-TR');
  const bazListe = aktifFiltre === 'eksikler' ? eksikFirmalar : havuz;
  const filtrelenmis = q
    ? bazListe.filter(f =>
        String(f.ad || '').toLocaleLowerCase('tr-TR').includes(q) ||
        firmaTamAdres(f).toLocaleLowerCase('tr-TR').includes(q) ||
        String(f.tel || '').toLocaleLowerCase('tr-TR').includes(q) ||
        String(f.tur || '').toLocaleLowerCase('tr-TR').includes(q)
      )
    : bazListe;

  const toplamSayfa = Math.max(1, Math.ceil(filtrelenmis.length / PROJE_SAYFA_BOYUTU));
  if (dtmFirmaHavuzuSayfa > toplamSayfa) dtmFirmaHavuzuSayfa = toplamSayfa;
  if (dtmFirmaHavuzuSayfa < 1) dtmFirmaHavuzuSayfa = 1;
  const sayfaFirmalari = filtrelenmis.slice((dtmFirmaHavuzuSayfa - 1) * PROJE_SAYFA_BOYUTU, dtmFirmaHavuzuSayfa * PROJE_SAYFA_BOYUTU);

  return `
    <div class="card">
      <div class="card-header" ${dtmEventAttr('click', function(event) { toggleOrtakFirmaHavuzu() })} style="cursor:pointer;">
        <h3 style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="color:var(--primary);display:inline-flex;font-size:17px;">🌐</span>
          <span>Firma Havuzu (Diğer Kullanıcıların Firmaları)</span>
          <span style="font-size:11px;background:#e8eefb;color:var(--primary);padding:2px 8px;border-radius:12px;font-weight:600;margin-left:4px">Toplam ${havuz.length} Firma</span>
          ${eksikFirmalar.length > 0 ? `
            <span style="font-size:11px;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:12px;font-weight:700;">+${eksikFirmalar.length} Listenizde Yok</span>
          ` : `
            <span style="font-size:11px;background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:12px;font-weight:600;">✓ Tümü Listenizde Ekli</span>
          `}
        </h3>
        <span class="toggle-icon" style="transform:${dtmFirmaHavuzuAcik ? 'rotate(0deg)' : 'rotate(-90deg)'};transition:transform 0.2s;">&#9660;</span>
      </div>

      ${dtmFirmaHavuzuAcik ? `
        <div class="card-body">
          <p style="font-size:13px; color:var(--gray-500); margin:0 0 14px;">
            Diğer personellerin sisteme eklediği firmaları aşağıdan inceleyebilir, kendi listenizde olmayanları tek tıkla <strong>Firma & Yüklenici Rehberi</strong> listenize dahil edebilirsiniz.
          </p>
          <!-- Filtre Sekmeleri, Arama ve Aksiyonlar -->
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:14px;">
            <div style="display:inline-flex; background:var(--gray-100); padding:4px; border-radius:8px; gap:4px; border:1px solid var(--gray-200);">
              <button type="button" ${dtmEventAttr('click', function(event) { firmaHavuzuFiltreDegistir('eksikler') })}
                style="border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; background:${aktifFiltre === 'eksikler' ? '#fff' : 'transparent'}; color:${aktifFiltre === 'eksikler' ? 'var(--primary)' : 'var(--gray-600)'}; box-shadow:${aktifFiltre === 'eksikler' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'};">
                ✨ Listemde Olmayanlar (${eksikFirmalar.length})
              </button>
              <button type="button" ${dtmEventAttr('click', function(event) { firmaHavuzuFiltreDegistir('tumu') })}
                style="border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; background:${aktifFiltre === 'tumu' ? '#fff' : 'transparent'}; color:${aktifFiltre === 'tumu' ? 'var(--primary)' : 'var(--gray-600)'}; box-shadow:${aktifFiltre === 'tumu' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'};">
                📋 Tüm Havuz (${havuz.length})
              </button>
            </div>

            <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:220px; justify-content:flex-end; flex-wrap:wrap;">
              <input type="text" id="firmaHavuzuAramaInput" class="ref-input"
                value="${escAttr(dtmFirmaHavuzuArama)}"
                placeholder="🔍 Havuzda firma adı, adres veya telefon ara..."
                style="flex:1; min-width:200px; max-width:320px; height:36px; font-size:12.5px; padding:0 12px; border-radius:8px; background:#fff;"
                ${dtmEventAttr('input', function(event) { firmaHavuzuAramaDegistir(this.value) })}>
              ${eksikFirmalar.length > 0 ? `
                <button type="button" class="btn btn-primary btn-sm"
                  style="height:36px; padding:0 12px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:5px; white-space:nowrap; border-radius:8px;"
                  ${dtmEventAttr('click', function(event) { havuzdanTumEksikleriListemeEkle() })}>
                  ➕ Tüm Eksikleri Ekle (${eksikFirmalar.length})
                </button>
              ` : ''}
              <button type="button" class="btn btn-outline btn-sm"
                style="height:36px; padding:0 12px; font-size:12px; background:#fff; white-space:nowrap; border-radius:8px;"
                title="Diğer kullanıcıların eklediği son firmaları buluttan çek"
                ${dtmEventAttr('click', function(event) { ortakFirmaHavuzunuYukle(false) })}>
                ${dtmFirmaHavuzuYukleniyor ? '⏳ Yenileniyor...' : '🔄 Yenile'}
              </button>
            </div>
          </div>

          <!-- Havuz Firma Listesi -->
          ${dtmFirmaHavuzuYukleniyor && havuz.length === 0 ? `
            <div style="text-align:center; padding:24px; color:var(--gray-500); font-size:13px; background:var(--gray-50); border-radius:10px; border:1px solid var(--gray-200);">
              ⏳ Ortak firma havuzu senkronize ediliyor...
            </div>
          ` : filtrelenmis.length === 0 ? `
            <div style="text-align:center; padding:22px 16px; color:var(--gray-500); font-size:13px; background:var(--gray-50); border-radius:10px; border:1px dashed var(--gray-300);">
              ${q ? `"<strong>${escHtml(dtmFirmaHavuzuArama)}</strong>" aramasına uygun firma bulunamadı.` : (aktifFiltre === 'eksikler' ? '🎉 Harika! Ortak havuzdaki tüm firmalar zaten kendi listenizde ekli.' : 'Ortak havuzda henüz kayıtlı firma bulunmuyor.')}
            </div>
          ` : `
            <div id="firmaHavuzuScrollList" style="display:block;">
              ${sayfaFirmalari.map(f => {
                const anahtar = firmaAdAnahtari(f.ad);
                const bendeVar = benimMap.get(anahtar);
                const encodedAd = encodeURIComponent(f.ad || '');
                const detayAcik = dtmFirmaHavuzuSeciliAnahtar === anahtar;
                const eksikDetayVar = bendeVar && (
                  (!bendeVar.adres && f.adres) ||
                  (!bendeVar.tel && f.tel) ||
                  (!bendeVar.eposta && f.eposta) ||
                  (!bendeVar.faks && f.faks)
                );
                return `
                  <div style="background:${detayAcik ? '#fff' : '#f8fafc'}; border:1.5px solid ${detayAcik ? 'var(--primary)' : (bendeVar ? '#e2e8f0' : '#bfdbfe')}; border-radius:10px; margin-bottom:10px; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                    <div ${dtmEventAttr('click', function(event) { toggleHavuzFirmaDetay(encodedAd) })}
                      style="display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 16px; cursor:pointer; user-select:none; flex-wrap:wrap;"
                      title="Firma detaylarını görüntülemek için tıklayın">
                      <div style="min-width:220px; flex:1;">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; line-height:1.4;">
                          <span style="font-size:13.5px; font-weight:700; color:${detayAcik ? 'var(--primary)' : '#1e293b'};">${escHtml(f.ad)}</span>
                          <span style="font-size:11px; padding:2px 8px; border-radius:999px; font-weight:600; background:${f.tur === 'Şirket' ? '#eef2ff' : '#fef3c7'}; color:${f.tur === 'Şirket' ? '#4338ca' : '#92400e'};">
                            ${escHtml(f.tur || 'Kişi')}
                          </span>
                          ${f.basitUsul ? `<span style="font-size:11px; padding:2px 8px; border-radius:999px; font-weight:600; background:#dcfce7; color:#166534;">Basit Usul</span>` : ''}
                          <span style="font-size:11.5px; font-weight:500; color:#64748b;">${detayAcik ? '▲ Detayı Gizle' : '▼ Bilgileri Gör'}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-top:6px; font-size:12px; color:#64748b; line-height:1.4;">
                          ${firmaTamAdres(f) ? `<span>📍 ${escHtml(firmaTamAdres(f))}</span>` : `<span style="color:#94a3b8;">📍 Adres belirtilmemiş</span>`}
                          ${f.tel ? `<span style="font-weight:500; color:#475569;">📞 ${escHtml(f.tel)}</span>` : ''}
                        </div>
                      </div>
                      <div style="flex-shrink:0; display:flex; align-items:center; gap:8px;">
                        ${!bendeVar ? `
                          <button type="button" class="btn btn-primary btn-sm"
                            style="height:34px; padding:0 14px; font-size:12.5px; font-weight:600; border-radius:8px; white-space:nowrap; display:inline-flex; align-items:center; gap:5px;"
                            ${dtmEventAttr('click', function(event) { event.stopPropagation(); havuzdanFirmayiListemeEkle(encodedAd); })}>
                            ➕ Listeme Ekle
                          </button>
                        ` : eksikDetayVar ? `
                          <button type="button" class="btn btn-outline btn-sm"
                            style="height:32px; padding:0 12px; font-size:12px; font-weight:600; border-radius:8px; white-space:nowrap; background:#fff; display:inline-flex; align-items:center; gap:4px;"
                            title="Havuzdaki adres/telefon bilgilerini kendi kaydınıza tamamlayın"
                            ${dtmEventAttr('click', function(event) { event.stopPropagation(); havuzdanFirmayiListemeEkle(encodedAd); })}>
                            🔄 Bilgileri Tamamla
                          </button>
                          <span style="font-size:12px; font-weight:600; color:#15803d; background:#dcfce7; padding:6px 10px; border-radius:8px; white-space:nowrap;">
                            ✓ Listenizde
                          </span>
                        ` : `
                          <span style="font-size:12px; font-weight:600; color:#15803d; background:#dcfce7; padding:6px 12px; border-radius:8px; white-space:nowrap;">
                            ✓ Listenizde Ekli
                          </span>
                        `}
                      </div>
                    </div>

                    ${detayAcik ? `
                      <div style="padding:14px 16px; background:#fff; border-top:1px solid #e2e8f0; border-radius:0 0 10px 10px; font-size:12.5px;">
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:10px 16px;">
                          <div>
                            <div style="font-size:11px; font-weight:600; color:var(--gray-500); margin-bottom:2px;">Firma / Kişi Adı</div>
                            <div style="font-weight:700; color:var(--gray-800);">${escHtml(f.ad || '-')}</div>
                          </div>
                          <div>
                            <div style="font-size:11px; font-weight:600; color:var(--gray-500); margin-bottom:2px;">Kayıt Türü & Vergi Durumu</div>
                            <div style="color:var(--gray-800); font-weight:600;">
                              ${escHtml(f.tur || 'Kişi')} &middot; ${f.basitUsul ? '<span style="color:#166534;">Basit Usule Tabi (KDV Muaf)</span>' : 'Standart (KDV\'li)'}
                            </div>
                          </div>
                          <div style="grid-column:1 / -1;">
                            <div style="font-size:11px; font-weight:600; color:var(--gray-500); margin-bottom:2px;">Açık Adres</div>
                            <div style="color:var(--gray-800);">${firmaTamAdres(f) ? escHtml(firmaTamAdres(f)) : '<span style="color:var(--gray-400);">Belirtilmemiş</span>'}</div>
                          </div>
                          <div>
                            <div style="font-size:11px; font-weight:600; color:var(--gray-500); margin-bottom:2px;">Telefon</div>
                            <div style="color:var(--gray-800);">${f.tel ? escHtml(f.tel) : '<span style="color:var(--gray-400);">Belirtilmemiş</span>'}</div>
                          </div>
                          <div>
                            <div style="font-size:11px; font-weight:600; color:var(--gray-500); margin-bottom:2px;">Faks</div>
                            <div style="color:var(--gray-800);">${f.faks ? escHtml(f.faks) : '<span style="color:var(--gray-400);">Belirtilmemiş</span>'}</div>
                          </div>
                          <div>
                            <div style="font-size:11px; font-weight:600; color:var(--gray-500); margin-bottom:2px;">E-Posta</div>
                            <div style="color:var(--gray-800);">${f.eposta ? escHtml(f.eposta) : '<span style="color:var(--gray-400);">Belirtilmemiş</span>'}</div>
                          </div>
                        </div>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
            ${renderProjeSayfalamaBar(filtrelenmis.length, dtmFirmaHavuzuSayfa, PROJE_SAYFA_BOYUTU, (yeniSayfa) => {
              dtmFirmaHavuzuSayfa = yeniSayfa;
              guncelleOrtakFirmaHavuzuDOM();
            })}
          `}
        </div>
      ` : ''}
    </div>
  `;
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

    // Kategori kartları data.js'teki IS_TURLERI listesinden üretilir;
    // yeni bir iş türü eklendiğinde dashboard'a kendiliğinden gelir.
    const turStats = {};
    IS_TURLERI.forEach(t => {
      turStats[t.ad] = {
        adet: 0, tutar: 0, onayliAdet: 0,
        icon: t.dashboard.icon, color: t.dashboard.color, bg: t.dashboard.bg
      };
    });

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
      return `<tr ${dtmEventAttr('click', function(event) { dashboardProjeAc(String(p.id ?? '')) })} style="cursor:pointer"
        ${dtmEventAttr('mouseover', function(event) { this.style.background='#f0f7ff' })} ${dtmEventAttr('mouseout', function(event) { this.style.background='' })}>
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
      <div style="color:red;padding:20px">Hata: ${escHtml(e?.message || '')}</div>`;
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
              ${dtmEventAttr('change', function(event) { if(this.files[0]){document.getElementById('kyFileLabel').querySelector('.ky-file-text').textContent=this.files[0].name;document.getElementById('kyFileLabel').classList.add('ky-file-selected')} })}>
          </label>
        </div>
        <button class="btn btn-primary" ${dtmEventAttr('click', function(event) { yukleProjeCloud() })}>📥 Getir</button>
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
      let indirSayfa = 1;
      const renderIndirSayfa = () => {
        const toplamSayfa = Math.max(1, Math.ceil(onaylananlar.length / PROJE_SAYFA_BOYUTU));
        if (indirSayfa > toplamSayfa) indirSayfa = toplamSayfa;
        if (indirSayfa < 1) indirSayfa = 1;
        const sayfaListe = onaylananlar.slice((indirSayfa - 1) * PROJE_SAYFA_BOYUTU, indirSayfa * PROJE_SAYFA_BOYUTU);
        listEl.innerHTML = `<div class="ky-proje-grid">
          ${sayfaListe.map(p => {
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
                <button class="ky-btn-open" ${dtmEventAttr('click', function(event) { dosyaGetir(String(p.id ?? '')) })}>📥 İndir</button>
              </div>
            </div>`;
          }).join('')}
        </div>` + renderProjeSayfalamaBar(onaylananlar.length, indirSayfa, PROJE_SAYFA_BOYUTU, (yeniSayfa) => {
          indirSayfa = yeniSayfa;
          renderIndirSayfa();
        });
      };
      renderIndirSayfa();
    }
  } catch(e) {
    const listEl = document.getElementById('dosyaGetirList');
    if (listEl) listEl.innerHTML = `<div style="color:red;padding:12px">Projeler yüklenemedi: ${escHtml(e?.message || '')}</div>`;
  }
}

async function dosyaGetir(projeId) {
  try {
    const doc = await getProjeFromCloud(projeId, false);
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
  const savedSnapshot = JSON.stringify(proje);
  const savedData = JSON.parse(savedSnapshot);
  try {
    if (currentCloudProjeId) {
      await updateProjeInCloud(currentCloudProjeId, savedData);
      // Geri gönderme notu ve durum, yeniden gönderilene kadar korunur.
      lastSavedProjeSnapshot = savedSnapshot;
    } else {
      currentCloudProjeId = await saveProjeToCloud(savedData);
      lastSavedProjeSnapshot = savedSnapshot;
    }
    let yuklenenEvrak = 0;
    if (typeof window !== 'undefined' && Array.isArray(window._bekleyenProjeDosyalari) && window._bekleyenProjeDosyalari.length > 0) {
      showToast('⏳ Proje kaydedildi, bekleyen dokümanlar buluta yükleniyor...', 'info', 3000);
      yuklenenEvrak = await bekleyenProjeDosyalariniBulutaYukle(currentCloudProjeId);
    }
    if (yuklenenEvrak > 0) {
      showToast(`Proje ve ${yuklenenEvrak} adet doküman başarıyla kaydedildi!`, 'success', 4000);
    } else {
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
    if (typeof window !== 'undefined') window._bekleyenProjeDosyalari = [];
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
    if (typeof window !== 'undefined') window._bekleyenProjeDosyalari = [];
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
  const eksikler = getHesaplamaHatalari(p, referans);
  if (!p.isAdi?.trim())                                         eksikler.push('İş Adı');
  if (!p.idareAdi?.trim())                                      eksikler.push('İdare Adı');
  if (!p.mudurluk?.trim())                                      eksikler.push('Müdürlük');
  if (!p.ymGorevliler?.slice(0, p.ymGorevliSayisi||1).some(g => g.ad?.trim()))
                                                                 eksikler.push('Y.M. Görevlisi');
  if (!p.dtGorevliler?.slice(0, p.dtGorevliSayisi||1).some(g => g.ad?.trim()))
                                                                 eksikler.push('D.T. Görevlisi');
  if (!p.onaylayanAmir?.ad?.trim())                             eksikler.push('Onaylayan Amir');
  if (isMalVeyaHizmetTuru(p.isTuru) && !p.isKalemleri?.some(k => k.ad?.trim()))
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
  if (currentCloudProjeId === projeId && (!lastSavedProjeSnapshot || JSON.stringify(proje) !== lastSavedProjeSnapshot)) { showToast('Göndermeden önce değişikliklerinizi kaydediniz.', 'warning'); return; }
  // Validasyon: önce projeyi cloud'dan çek, kontrol et
  let projeDoc;
  try {
    projeDoc = await getProjeFromCloud(projeId, false);
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
    gerceklestirmeciler = (await getGerceklestirmeciler()).filter(g => g.uid !== currentDTMUser?.uid);
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
        <p style="font-size:13px;color:#6b7280;margin-bottom:20px"><strong>${escHtml(isAdi)}</strong> projesi seçtiğiniz kişiye gönderilecek. Bu işlem geri alınamaz.</p>
        <div style="margin-bottom:20px">
          <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:8px">Gerçekleştirmeci Seçin</label>
          <select id="gerceklestirmeciSelect" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px">
            <option value="">-- Seçin --</option>
            ${gerceklestirmeciler.map(g => `<option value="${escAttr(g.uid)}" data-ad="${escAttr(g.displayName)}">${escHtml(g.displayName)}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button ${dtmEventAttr('click', function(event) { document.getElementById('gonderiModal').remove() })} style="padding:9px 20px;border:1px solid #d1d5db;background:#fff;border-radius:7px;cursor:pointer;font-size:13px">İptal</button>
          <button id="gonderiOnaylaBtn" ${dtmEventAttr('click', function(event) { gonderiOnayla(String(projeId ?? ''), this) })} style="padding:9px 20px;background:#16a34a;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:13px;font-weight:600">Gönder</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function gonderiOnayla(projeId, btn) {
  if (currentCloudProjeId === projeId && (!lastSavedProjeSnapshot || JSON.stringify(proje) !== lastSavedProjeSnapshot)) { showToast('Göndermeden önce değişikliklerinizi kaydediniz.', 'warning'); return; }
  const select = document.getElementById('gerceklestirmeciSelect');
  const uid = select.value;
  const ad = select.options[select.selectedIndex]?.dataset?.ad || '';
  if (!uid) { showToast('Lütfen bir gerçekleştirmeci seçin.', 'warning'); return; }
  await butonKilitli(btn, 'Gönderiliyor...', async () => {
    try {
      // Kazanan firmanın basit usul durumunu, gönderilen projeye ait veriden yakala
      const projeDoc = await getProjeFromCloud(projeId, false);
      const p = Object.assign(getDefaultProje(), projeDoc.data);
      const kIdx = p.kazananFirmaIndex >= 0 ? p.kazananFirmaIndex : hesaplaKazananFirma(p);
      const kFirma = p.teklifFirmalar[kIdx];
      const basitUsul = kFirma ? isFirmaBasitUsul(kFirma.ad, referans) : false;

      if (currentCloudProjeId === projeId && projeSurumleri.get(projeId) !== (projeDoc.revision || 0)) throw projeCakismaHatasi();
      const belgeRef = belgeReferansiOlustur(p, referans);
      await gonderiProje(projeId, uid, ad, basitUsul, projeDoc.revision || 0, belgeRef);
      document.getElementById('gonderiModal')?.remove();
      if (currentCloudProjeId === projeId) {
        currentProjeKilitli = true; currentProjeStatus = 'gonderildi';
        proje.belgeReferans = belgeRef; proje.kayitliKazananBasitUsul = basitUsul;
        lastSavedProjeSnapshot = JSON.stringify(proje);
      }
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
              <div style="font-weight:600;color:#111">👤 ${escHtml(sahipAd)}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px">Proje sahibine geri gönder</div>
            </button>
            ${gcAd ? `<button id="arsivHedefGc" style="padding:12px 16px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;text-align:left;font-size:14px;transition:border-color 0.15s">
              <div style="font-weight:600;color:#111">👷 ${escHtml(gcAd)}</div>
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
              <div style="font-weight:600;color:#111">👤 ${escHtml(sahipAd)}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px">Proje sahibine geri gönder</div>
            </button>
            ${gcAd ? `<button id="ggHedefGc" style="padding:12px 16px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;text-align:left;font-size:14px">
              <div style="font-weight:600;color:#111">👷 ${escHtml(gcAd)}</div>
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
    const doc = await getProjeFromCloud(projeId, false);
    const data = Object.assign(getDefaultProje(), doc.data);
    if (!data.odenek || !data.butceTertibi) {
      showToast('Onay belgesi bilgileri eksik! Gerçekleştirme görevlisi önce ödenek ve bütçe tertibi bilgilerini girmelidir.', 'warning');
      return;
    }
    if (!await showConfirm(`"${escHtml(isAdi)}" projesi onaylanacak.<br><br>Bu işlem geri alınamaz. Emin misiniz?`, 'Onayla')) return;
    await onaylaProje(projeId, doc.revision || 0);
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
  const not = await showPrompt(`"${isAdi}" projesini geri gönderiyorsunuz.\nGeri gönderme nedeninizi yazın:`, 'Nedeninizi buraya yazın...');
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
                ${currentDTMUser?.role === 'superadmin' ? '<option value="superadmin">Sistem Yöneticisi</option>' : ''}
              </select>
            </div>
          </div>
          <div id="kullaniciMsg" style="margin:8px 0;font-size:13px"></div>
          <button class="btn btn-primary" ${dtmEventAttr('click', function(event) { kullaniciEkle(this) })}>+ Kullanıcı Ekle</button>
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
                <th>Şifre İşlemi</th>
                <th>AI Yetkisi</th>
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
                  <td>
                    ${u.email && !u.email.endsWith('@dtm.local') ? `
                      <button type="button" class="btn btn-outline btn-sm" ${dtmEventAttr('click', function(event) { adminSifreSifirlaClick(String(u.email ?? ''), String(u.username ?? ''), String(u.displayName ?? '')) })} style="font-size:11.5px;padding:3px 8px;display:inline-flex;align-items:center;gap:4px;" title="Kullanıcının e-posta adresine şifre sıfırlama bağlantısı gönder">
                        🔑 Sıfırla
                      </button>
                    ` : `
                      <span style="font-size:11.5px;color:var(--gray-400);" title="E-posta tanımlanmadığı için sıfırlama linki gönderilemez">E-Posta Yok</span>
                    `}
                  </td>
                  <td>
                    ${['admin', 'superadmin', 'gerceklestirmeci'].includes(u.role) ? `
                      <span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;display:inline-flex;align-items:center;gap:4px;" title="Bu rol kurumsal AI erişimine doğrudan sahiptir">
                        🤖 Rol İçi Aktif
                      </span>
                    ` : `
                      <button type="button" class="btn btn-outline btn-sm" ${dtmEventAttr('click', function(event) { kullaniciAiYetkiDegistir(String(u.uid ?? ''), !Boolean(u.aiYetkisi)) })} style="font-size:11.5px;padding:3px 8px;border-color:${u.aiYetkisi ? '#86efac' : 'var(--gray-300)'};background:${u.aiYetkisi ? '#f0fdf4' : 'transparent'};color:${u.aiYetkisi ? '#166534' : 'var(--gray-500)'};" title="Kurumsal Gemini AI kullanım yetkisini aç/kapat">
                        ${u.aiYetkisi ? '🤖 Açık' : '🔒 Kapalı'}
                      </button>
                    `}
                  </td>
                  <td>${u.uid !== currentDTMUser.uid ? (
                    (u.role === 'superadmin' && currentDTMUser?.role !== 'superadmin') ? `
                      <span class="badge badge-admin" style="background:#4338ca;color:#fff">${getRoleLabel(u.role)}</span>
                    ` : `
                      <select ${dtmEventAttr('change', function(event) { kullaniciRolDegistir(String(u.uid ?? ''), this.value) })} style="padding:4px 8px;border:1px solid var(--gray-300);border-radius:5px;font-size:12px;cursor:pointer">
                        <option value="user" ${u.role === 'user' ? 'selected' : ''}>Kullanıcı</option>
                        <option value="gerceklestirmeci" ${u.role === 'gerceklestirmeci' ? 'selected' : ''}>Gerçekleştirme Görevlisi</option>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Yönetici</option>
                        ${currentDTMUser?.role === 'superadmin' ? `<option value="superadmin" ${u.role === 'superadmin' ? 'selected' : ''}>Sistem Yöneticisi</option>` : ''}
                      </select>
                    `
                  ) : `<span class="badge badge-admin">${getRoleLabel(u.role)}</span>`}
                  </td>
                  <td>
                    ${u.uid !== currentDTMUser.uid ? (
                      (u.role === 'superadmin' && currentDTMUser?.role !== 'superadmin') ? `
                        <span style="color:var(--gray-400);font-size:12px">(Yetki kısıtlı)</span>
                      ` : `
                        <button class="btn btn-danger btn-sm" ${dtmEventAttr('click', function(event) { kullaniciSil(String(u.uid ?? ''), String(u.displayName ?? ''), String(u.username ?? '')) })}>Sil</button>
                      `
                    ) : '<span style="color:var(--gray-400);font-size:12px">(Aktif oturum)</span>'}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch(e) {
    main.innerHTML = `<div class="vm-page-header"><h2>Kullanıcı Yönetimi</h2></div>
      <div style="color:red;padding:20px">Hata: ${escHtml(e?.message || '')}</div>`;
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
  if (rol === 'superadmin' && currentDTMUser?.role !== 'superadmin') {
    msg.style.color = 'red'; msg.textContent = 'Sistem Yöneticisi rolü yalnızca mevcut Sistem Yöneticisi tarafından atanabilir.'; return;
  }

  msg.style.color = 'var(--gray-500)'; msg.textContent = 'Kullanıcı oluşturuluyor...';
  await butonKilitli(btn, 'Oluşturuluyor...', async () => {
    try {
      await createDTMUser(username, sifre, ad, rol, email);
      msg.style.color = 'green'; msg.textContent = `✓ "${ad}" kullanıcısı başarıyla oluşturuldu.`;
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
  if (yeniRol === 'superadmin' && currentDTMUser?.role !== 'superadmin') {
    showToast('Sistem Yöneticisi rolü yalnızca mevcut Sistem Yöneticisi tarafından atanabilir.', 'warning');
    renderKullaniciYonetimiPage();
    return;
  }
  try {
    await changeUserRole(uid, yeniRol);
    showToast('Kullanıcı rolü başarıyla güncellendi.', 'success');
    renderKullaniciYonetimiPage();
  } catch(e) {
    showToast('Hata: ' + hataMesaji(e), 'error');
  }
}

async function kullaniciAiYetkiDegistir(uid, yeniDurum) {
  try {
    await setUserAiPermission(uid, yeniDurum);
    showToast(yeniDurum ? 'Kullanıcıya kurumsal AI kullanım yetkisi verildi.' : 'Kullanıcının kurumsal AI kullanım yetkisi kaldırıldı.', 'success');
    renderKullaniciYonetimiPage();
  } catch(e) {
    showToast('Hata: ' + hataMesaji(e), 'error');
  }
}

async function kullaniciSil(uid, ad, username) {
  if (!await showConfirm(`"${escHtml(ad)}" kullanıcısı kalıcı olarak silinecek. Emin misiniz?`, 'Sil')) return;
  try {
    await deleteDTMUser(uid);
    showToast(`"${ad}" kullanıcısı silindi.`, 'success');
    renderKullaniciYonetimiPage();
  } catch(e) {
    showToast('Hata: ' + hataMesaji(e), 'error');
  }
}

async function adminSifreSifirlaClick(email, username, ad) {
  const targetEmail = (email || '').trim();
  if (!targetEmail || targetEmail.endsWith('@dtm.local')) {
    showToast(`"${ad}" için tanımlı geçerli bir e-posta adresi bulunmuyor.`, 'warning', 5000);
    return;
  }
  if (!await showConfirm(`"${escHtml(ad)}" (${escHtml(targetEmail)}) kullanıcısına şifre sıfırlama bağlantısı gönderilsin mi?`, 'Şifre Sıfırla')) return;
  try {
    await auth.sendPasswordResetEmail(targetEmail);
    showToast(`"${ad}" kullanıcısına şifre sıfırlama bağlantısı gönderildi.`, 'success');
  } catch(e) {
    showToast('Şifre sıfırlama hatası: ' + hataMesaji(e), 'error');
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
      const isAdiSafe = p.isAdi;
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
            ${p.atananGerceklestirmeciAd ? `<span class="ky-proje-user">👷 ${escHtml(p.atananGerceklestirmeciAd)}</span>` : ''}
            <span id="projeEvrakRozet_${escAttr(p.id)}" class="ky-proje-evrak-rozet" style="display:none;align-items:center;gap:4px;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:10px;background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd"></span>
          </div>
          ${durmBilgisi}
          ${p.status === 'geri_gonderildi' && p.geriGonderNot ? `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:7px 10px;margin-top:6px;font-size:12px;color:#991b1b">
              <strong>Not:</strong> ${escHtml(p.geriGonderNot)}
            </div>` : ''}
        </div>
        <div class="ky-proje-actions">
          <button class="ky-btn-open" ${dtmEventAttr('click', function(event) { cloudProjeAc(String(p.id ?? '')) })}>Aç</button>
          <button class="ky-btn-lock" ${dtmEventAttr('click', function(event) { projeSablonKopyalaClick(String(p.id ?? '')) })} style="background:#faf5ff;color:#6d28d9;border-color:#ddd6fe" title="Bu projeyi şablon olarak kopyala ve yeni taslak oluştur">📑 Kopyala</button>
          ${aktif && !kilitli ? `<button class="ky-btn-lock" ${dtmEventAttr('click', function(event) { gonderiClick(String(p.id ?? ''), String(isAdiSafe ?? '')) })} style="background:#16a34a;color:#fff;border-color:#16a34a">📤 Gönder</button>` : ''}
          ${aktif ? `<button class="ky-btn-lock ${kilitli ? 'ky-btn-lock-active' : ''}" ${dtmEventAttr('click', function(event) { cloudProjeKilitle(String(p.id ?? ''), (!kilitli)) })}>${kilitli ? '🔓 Kilidi Aç' : '🔒 Kilitle'}</button>` : ''}
          ${aktif && !kilitli ? `<button class="ky-btn-delete" ${dtmEventAttr('click', function(event) { cloudProjeSil(String(p.id ?? ''), String(isAdiSafe ?? ''), (kilitli)) })}>Sil</button>` : ''}
        </div>
      </div>`;
    };

    const bolumSayfalari = { taslak: 1, geri_gonderildi: 1, gonderildi: 1, onaylandi: 1 };
    let sonGorunenProjelerim = [];

    const renderProjelerimListe = (aramaMetni, durumFiltre, siralamaAnahtari) => {
      const ara = aramaMetni.trim().toLocaleLowerCase('tr');
      sonGorunenProjelerim = [];
      return bolumler.map(b => {
        if (durumFiltre !== 'hepsi' && !b.keys.includes(durumFiltre)) return '';
        const bolumKey = b.keys[0];
        let grup = projeler.filter(p => b.keys.includes(p.status || 'taslak'));
        if (ara) grup = grup.filter(p => (p.isAdi || '').toLocaleLowerCase('tr').includes(ara));
        grup = siralaProjeler(grup, siralamaAnahtari);

        const toplamSayfa = Math.max(1, Math.ceil(grup.length / PROJE_SAYFA_BOYUTU));
        if ((bolumSayfalari[bolumKey] || 1) > toplamSayfa) bolumSayfalari[bolumKey] = toplamSayfa;
        const aktifSayfa = Math.max(1, bolumSayfalari[bolumKey] || 1);
        const sayfaGrup = grup.slice((aktifSayfa - 1) * PROJE_SAYFA_BOYUTU, aktifSayfa * PROJE_SAYFA_BOYUTU);
        sonGorunenProjelerim.push(...sayfaGrup);

        return `<div class="ky-bolum-kart" style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:16px;overflow:hidden">
          <div class="ky-bolum-baslik" style="padding:12px 16px;background:${b.renk};border-bottom:1px solid ${b.kenar};font-weight:700;font-size:13px;color:${b.yaziRenk}">
            ${b.baslik} (${grup.length})
          </div>
          ${grup.length === 0
            ? `<div class="ky-bolum-empty" style="text-align:center;padding:20px;color:#9ca3af;font-size:13px">${ara ? 'Arama ile eşleşen proje yok.' : 'Bu kategoride proje yok.'}</div>`
            : `<div class="ky-proje-grid">${sayfaGrup.map(projeKart).join('')}</div>` +
              renderProjeSayfalamaBar(grup.length, aktifSayfa, PROJE_SAYFA_BOYUTU, (yeniSayfa) => {
                bolumSayfalari[bolumKey] = yeniSayfa;
                window.projelerimFiltrele(false);
              }, true)}
        </div>`;
      }).join('');
    };

    main.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div><h2>Projelerim</h2><p>Tüm projeleriniz ve durumları.</p></div>
        <button class="btn btn-primary" ${dtmEventAttr('click', function(event) { yeniProjeBaslat() })}>&#43; Yeni Proje</button>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <input id="projelerimArama" type="text" placeholder="🔍 Proje adına göre ara..." ${dtmEventAttr('input', function(event) { projelerimFiltrele(true) })}
          style="flex:1;min-width:200px;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none">
        <select id="projelerimDurum" ${dtmEventAttr('change', function(event) { projelerimFiltrele(true) })}
          style="padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;background:#fff;cursor:pointer;outline:none">
          <option value="hepsi">Tüm Durumlar</option>
          <option value="taslak">Devam Edenler</option>
          <option value="geri_gonderildi">İşlem Bekleyenler</option>
          <option value="gonderildi">Onaylananlar</option>
        </select>
        <select id="projelerimSirala" ${dtmEventAttr('change', function(event) { projelerimFiltrele(true) })}
          style="padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;background:#fff;cursor:pointer;outline:none">
          <option value="tarih-yeni">Tarihe göre (Yeni → Eski)</option>
          <option value="tarih-eski">Tarihe göre (Eski → Yeni)</option>
          <option value="isim-az">İsme göre (A → Z)</option>
          <option value="isim-za">İsme göre (Z → A)</option>
        </select>
      </div>
      <div id="projelerimListe">${renderProjelerimListe('', 'hepsi', 'tarih-yeni')}</div>`;

    window.projelerimFiltrele = (sayfaSifirla = true) => {
      if (sayfaSifirla) {
        Object.keys(bolumSayfalari).forEach(k => { bolumSayfalari[k] = 1; });
      }
      const ara = document.getElementById('projelerimArama').value;
      const durum = document.getElementById('projelerimDurum').value;
      const sirala = document.getElementById('projelerimSirala').value;
      document.getElementById('projelerimListe').innerHTML = renderProjelerimListe(ara, durum, sirala);
      projeListesiEvrakRozetleriniYukle(sonGorunenProjelerim);
    };
    projeListesiEvrakRozetleriniYukle(sonGorunenProjelerim);
  } catch(e) {
    main.innerHTML = `<div class="page-header"><h2>Projelerim</h2></div><div style="color:red;padding:20px">Hata: ${escHtml(e?.message || '')}</div>`;
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
      const isAdiSafe = p.isAdi;
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

    const gonderilenSayfalari = { bekleyen: 1, onaylanan: 1 };

    const renderGonderilenListe = (aramaMetni) => {
      const ara = aramaMetni.trim().toLocaleLowerCase('tr');
      const filtrele = (liste) => ara
        ? liste.filter(p => (p.isAdi||'').toLocaleLowerCase('tr').includes(ara) || (p.userDisplayName||'').toLocaleLowerCase('tr').includes(ara))
        : liste;

      const bek = filtrele(bekleyenler);
      const ona = filtrele(onaylananlar);

      const bekToplamSayfa = Math.max(1, Math.ceil(bek.length / PROJE_SAYFA_BOYUTU));
      if (gonderilenSayfalari.bekleyen > bekToplamSayfa) gonderilenSayfalari.bekleyen = bekToplamSayfa;
      const bekSayfa = Math.max(1, gonderilenSayfalari.bekleyen || 1);
      const sayfaBek = bek.slice((bekSayfa - 1) * PROJE_SAYFA_BOYUTU, bekSayfa * PROJE_SAYFA_BOYUTU);

      const onaToplamSayfa = Math.max(1, Math.ceil(ona.length / PROJE_SAYFA_BOYUTU));
      if (gonderilenSayfalari.onaylanan > onaToplamSayfa) gonderilenSayfalari.onaylanan = onaToplamSayfa;
      const onaSayfa = Math.max(1, gonderilenSayfalari.onaylanan || 1);
      const sayfaOna = ona.slice((onaSayfa - 1) * PROJE_SAYFA_BOYUTU, onaSayfa * PROJE_SAYFA_BOYUTU);

      const bHTML = bek.length === 0
        ? `<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px">${ara ? 'Arama ile eşleşen proje yok.' : 'Bekleyen proje yok.'}</div>`
        : `<div class="ky-proje-grid">${sayfaBek.map(p => projeKart(p, (id, ad) => `
            <button class="ky-btn-open" ${dtmEventAttr('click', function(event) { cloudProjeAc(String(id ?? '')) })}>Aç</button>
            <button class="ky-btn-open" ${dtmEventAttr('click', function(event) { gonderilenOnaylaClick(String(id ?? ''), String(ad ?? '')) })} style="background:#16a34a;color:#fff;border-color:#16a34a">✓ Onayla</button>
            <button class="ky-btn-delete" ${dtmEventAttr('click', function(event) { geriGonderClick(String(id ?? ''), String(ad ?? '')) })} style="background:#dc2626;color:#fff;border-color:#dc2626">↩ Geri Gönder</button>
          `)).join('')}</div>` + renderProjeSayfalamaBar(bek.length, bekSayfa, PROJE_SAYFA_BOYUTU, (yeniSayfa) => {
            gonderilenSayfalari.bekleyen = yeniSayfa;
            window.gonderilenFiltrele(false);
          }, true);

      const oHTML = ona.length === 0
        ? `<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px">${ara ? 'Arama ile eşleşen proje yok.' : 'Henüz onaylanan proje yok.'}</div>`
        : `<div class="ky-proje-grid">${sayfaOna.map(p => projeKart(p, (id, ad) => `
            <button class="ky-btn-open" ${dtmEventAttr('click', function(event) { cloudProjeAc(String(id ?? '')) })}>Görüntüle</button>
          `)).join('')}</div>` + renderProjeSayfalamaBar(ona.length, onaSayfa, PROJE_SAYFA_BOYUTU, (yeniSayfa) => {
            gonderilenSayfalari.onaylanan = yeniSayfa;
            window.gonderilenFiltrele(false);
          }, true);

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
        <input id="gonderilenArama" type="text" placeholder="🔍 Proje adı veya kullanıcıya göre ara..." ${dtmEventAttr('input', function(event) { gonderilenFiltrele(true) })}
          style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none">
      </div>
      <div id="gonderilenListe">${renderGonderilenListe('')}</div>`;

    window.gonderilenFiltrele = (sayfaSifirla = true) => {
      if (sayfaSifirla) {
        gonderilenSayfalari.bekleyen = 1;
        gonderilenSayfalari.onaylanan = 1;
      }
      const ara = document.getElementById('gonderilenArama').value;
      document.getElementById('gonderilenListe').innerHTML = renderGonderilenListe(ara);
    };
  } catch(e) {
    main.innerHTML = `<div class="page-header"><h2>Projeler</h2></div><div style="color:red;padding:20px">Hata: ${escHtml(e?.message || '')}</div>`;
  }
}

// ===================== GERÇEKLEŞTİRMECİ BELGELER SAYFASI =====================
function renderGerceklestirmeciVeriMerkeziPage() {
  const liste = (referans.butceTertibiList || []).map(bt =>
    typeof bt === 'string' ? { no: bt, aciklama: '' } : bt
  );
  const rows = liste.map((bt, i) => `
    <tr>
      <td style="width:40%"><input type="text" class="ref-input" value="${escAttr(bt.no || '')}" ${dtmEventAttr('change', function(event) { btGuncelle((i),'no',this.value) })} placeholder="Tertip No"></td>
      <td><input type="text" class="ref-input" value="${escAttr(bt.aciklama || '')}" ${dtmEventAttr('change', function(event) { btGuncelle((i),'aciklama',this.value) })} placeholder="Açıklama (Örn: Yapım İşleri)"></td>
      <td style="width:60px;text-align:center">
        <button class="btn-icon-danger" ${dtmEventAttr('click', function(event) { onRefDelete('butceTertibiList', (i)) })} title="Sil">
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
      <div class="card-header" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
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
          <button class="btn btn-outline btn-sm" style="white-space:nowrap" ${dtmEventAttr('click', function(event) { const no=document.getElementById('yeniBtNo').value.trim();
            const ac=document.getElementById('yeniBtAciklama').value.trim();
            if(no){if(!referans.butceTertibiList)referans.butceTertibiList=[];referans.butceTertibiList.push({no,aciklama:ac});saveReferans(referans);renderPage();} })}>+ Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" ${dtmEventAttr('click', function(event) { toggleCard(this) })}>
        <h3 style="display:flex;align-items:center;gap:8px">
          <span style="color:var(--primary);display:inline-flex">${typeof getIcon === 'function' ? getIcon('building', 18) : ''}</span>
          Ortak Yüklenici & Firma Havuzu
          <span style="font-size:11px;background:#e8eefb;color:var(--primary);padding:2px 8px;border-radius:12px;font-weight:600;margin-left:4px">${sortedYuklenici.length} Kayıtlı</span>
        </h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
        <div style="display:flex; gap:10px; margin-bottom:16px; align-items:center;">
          <select class="ref-input" style="flex:1; height:40px; padding:0 12px; font-size:13px; border-radius:8px;" ${dtmEventAttr('change', function(event) { onYukleniciSelect(this.value) })}>
            <option value="-1">🔍 Kayıtlı firmalardan seçin veya düzenleyin...</option>
            ${dtmYeniEklenenYuklenici ? `<option value="NEW_YUKLENICI" selected>➕ Yeni Firma (Kaydedilmedi)</option>` : ''}
            ${sortedYuklenici.map(item => `<option value="${escAttr(item.i)}" ${!dtmYeniEklenenYuklenici && dtmSeciliYukleniciIndex === item.i ? 'selected' : ''}>${escHtml(item.f.ad)}</option>`).join('')}
          </select>
          <button class="btn-icon-primary" style="height:40px; padding:0 14px; font-size:13px; font-weight:600; border-radius:8px; white-space:nowrap;" ${dtmEventAttr('click', function(event) { onYukleniciEkle() })}>
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
              <div class="form-group"><label>Firma / Kişi Adı <span style="color:var(--danger)">*</span></label><input type="text" class="ref-input" id="yukleniciInputAd" value="${escAttr(f.ad || '')}" placeholder="Firma / Kişi Adı Giriniz" ${dtmEventAttr('change', function(event) { onFirmaFieldChange('yukleniciList', String(i ?? ''), 'ad', this.value) })} ${dtmEventAttr('input', function(event) { onFirmaFieldChange('yukleniciList', String(i ?? ''), 'ad', this.value) })}></div>
              <div class="form-group"><label>Tür <span style="color:var(--danger)">*</span></label><select class="ref-input" id="yukleniciInputTur" ${dtmEventAttr('change', function(event) { onFirmaFieldChange('yukleniciList', String(i ?? ''), 'tur', this.value); document.getElementById('mainContent').innerHTML = renderGerceklestirmeciVeriMerkeziPage(); })}>
                  <option value="Kişi" ${f.tur === 'Kisi' || f.tur === 'Kişi' ? 'selected' : ''}>Kişi</option>
                  <option value="Şirket" ${f.tur === 'Şirket' ? 'selected' : ''}>Şirket</option>
              </select></div>
              <div class="form-group" style="grid-column: span 2;"><label>Adres</label><input type="text" class="ref-input" id="yukleniciInputAdres" value="${escAttr(f.adres || '')}" placeholder="Mahalle, sokak, no (il/ilçe aşağıdan seçilir)" ${dtmEventAttr('change', function(event) { onFirmaFieldChange('yukleniciList', String(i ?? ''), 'adres', this.value); firmaAdresOnizlemeGuncelle(f, 'yukleniciInput') })}></div>
              ${firmaIlIlceAlanlari(f, 'yukleniciList', i, 'yukleniciInput', () => { document.getElementById('mainContent').innerHTML = renderGerceklestirmeciVeriMerkeziPage(); })}
              <div class="form-group"><label>Telefon</label><input type="tel" inputmode="tel" autocomplete="off" class="ref-input${telefonGecerliMi(f.tel) ? '' : ' has-error'}" id="yukleniciInputTel" value="${escAttr(f.tel || '')}" placeholder="(0) 500 123 45 67" ${dtmEventAttr('input', function(event) { telefonGirdiIsle(this, event) })} ${dtmEventAttr('change', function(event) { this.value = telefonNormalize(this.value); this.classList.toggle('has-error', !telefonGecerliMi(this.value)); onFirmaFieldChange('yukleniciList', String(i ?? ''), 'tel', this.value) })}></div>
              <div class="form-group"><label>Faks</label><input type="tel" inputmode="tel" autocomplete="off" class="ref-input${telefonGecerliMi(f.faks) ? '' : ' has-error'}" id="yukleniciInputFaks" value="${escAttr(f.faks || '')}" placeholder="(0) 500 123 45 67" ${dtmEventAttr('input', function(event) { telefonGirdiIsle(this, event) })} ${dtmEventAttr('change', function(event) { this.value = telefonNormalize(this.value); this.classList.toggle('has-error', !telefonGecerliMi(this.value)); onFirmaFieldChange('yukleniciList', String(i ?? ''), 'faks', this.value) })}></div>
              <div class="form-group"><label>E-Posta</label><input type="email" inputmode="email" autocomplete="off" class="ref-input${epostaGecerliMi(f.eposta) ? '' : ' has-error'}" id="yukleniciInputEposta" value="${escAttr(f.eposta || '')}" placeholder="ornek@domain.com" ${dtmEventAttr('change', function(event) { this.value = epostaNormalize(this.value); this.classList.toggle('has-error', !epostaGecerliMi(this.value)); if (!epostaGecerliMi(this.value)) showToast('E-posta adresi eksik: "@" işareti ve .com, .gov.tr gibi bir uzantı olmalı.', 'error'); onFirmaFieldChange('yukleniciList', String(i ?? ''), 'eposta', this.value) })}></div>
              ${f.tur === 'Şirket' ? '' : `<div class="form-group"><label>Doğum Tarihi</label><input type="date" class="ref-input" value="${escAttr(f.dogumTarihi || '')}" ${dtmEventAttr('change', function(event) { onFirmaFieldChange('yukleniciList', String(i ?? ''), 'dogumTarihi', this.value) })}></div>`}
              <div class="form-group" style="grid-column: span 2; display: flex; flex-direction: row; align-items: center; justify-content: flex-start; gap: 8px; margin-top: 5px;">
                <input type="checkbox" id="basitUsul_${i}" ${f.basitUsul ? 'checked' : ''} ${dtmEventAttr('change', function(event) { onFirmaFieldChange('yukleniciList', String(i ?? ''), 'basitUsul', this.checked) })}>
                <label for="basitUsul_${i}" style="margin:0; cursor:pointer; font-weight:600; color:var(--primary)">Bu Firma / Kişi Basit Usule Tabiidir</label>
              </div>
            </div>
            <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--gray-200); display:flex; justify-content:space-between; align-items:center;">
              <button class="btn btn-primary" ${dtmEventAttr('click', function(event) { kaydetYukleniciFormu(String(i ?? '')) })} style="display:inline-flex;align-items:center;gap:6px">
                ${typeof getIcon === 'function' ? getIcon('check', 16) : '✓'} Bilgileri Kaydet
              </button>
              ${isNew ? `
                <button class="btn btn-outline btn-sm" ${dtmEventAttr('click', function(event) { vazgecYukleniciFormu() })}>Vazgeç</button>
              ` : `
                <button class="btn btn-danger btn-sm" style="display:inline-flex;align-items:center;gap:4px" ${dtmEventAttr('click', function(event) { onRefDelete('yukleniciList', (i)); onYukleniciSelect(-1); })}>
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
  dtmYeniEklenenYuklenici = {ad:'', adres:'', il: referans.sehir || 'Karaman', ilce:'', tur:'Kisi', tel:'', faks:'', eposta:'', dogumTarihi:'', basitUsul:false};
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
  if (!firmaIletisimDogrula(f, 'yukleniciInput')) return;

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
  dtmYeniEklenenFirma = {ad:'', adres:'', il: referans.sehir || 'Karaman', ilce:'', tur:'Kisi', tel:'', faks:'', eposta:'', dogumTarihi:'', basitUsul:false};
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
        <button ${dtmEventAttr('click', function(event) { document.getElementById(String(modalId ?? '')).remove() })} style="background:none; border:none; color:var(--gray-400); cursor:pointer; font-size:18px; padding:4px;" title="Kapat">
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
            ${dtmEventAttr('input', function(event) { this.value = this.value.replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ\s]/g, ''); })}
            ${dtmEventAttr('keydown', function(event) { if(event.key==='Enter') kaydetMuhendisModal((isEdit ? index : null)) })}>
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
        <button class="btn btn-outline" style="padding:10px 20px; font-size:14px; border-radius:8px;" ${dtmEventAttr('click', function(event) { document.getElementById(String(modalId ?? '')).remove() })}>Vazgeç</button>
        <button class="btn btn-primary" ${dtmEventAttr('click', function(event) { kaydetMuhendisModal((isEdit ? index : null)) })} style="display:inline-flex; align-items:center; gap:8px; padding:10px 24px; font-size:14px; font-weight:600; border-radius:8px;">
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
            const { dogumTarihi, ...havuzFirmasi } = firma;
            globalFirms.push(havuzFirmasi);
            changed = true;
          } else {
            ['adres', 'il', 'ilce', 'tur', 'tel', 'faks', 'eposta'].forEach(fld => {
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
        ? `<button class="ky-btn-open" style="background:#6b7280" ${dtmEventAttr('click', function(event) { gerceklestirmeciBelgelerProjeAc(String(p.id ?? ''),true) })}>Belgeleri Gör</button>`
        : `<button class="ky-btn-open" ${dtmEventAttr('click', function(event) { gerceklestirmeciBelgelerProjeAc(String(p.id ?? '')) })}>Belge Oluştur</button>`;
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

    const gcSayfalari = { aktif: 1, onaylanan: 1 };

    const renderGrupHTML = (aramaMetni, siralamaAnahtari) => {
      const ara = aramaMetni.trim().toLocaleLowerCase('tr');
      let eslesenAktif = ara ? aktif.filter(p => (p.isAdi || '').toLocaleLowerCase('tr').includes(ara)) : aktif;
      let eslesenOnaylanan = ara ? onaylananlar.filter(p => (p.isAdi || '').toLocaleLowerCase('tr').includes(ara)) : onaylananlar;
      eslesenAktif = siralaProjeler(eslesenAktif, siralamaAnahtari);
      eslesenOnaylanan = siralaProjeler(eslesenOnaylanan, siralamaAnahtari);
      if (eslesenAktif.length === 0 && eslesenOnaylanan.length === 0) {
        return `<div style="text-align:center;padding:30px;color:#9ca3af;font-size:13px">Arama ile eşleşen proje yok.</div>`;
      }
      let h = '';
      if (eslesenAktif.length > 0) {
        const topSayfa = Math.max(1, Math.ceil(eslesenAktif.length / PROJE_SAYFA_BOYUTU));
        if (gcSayfalari.aktif > topSayfa) gcSayfalari.aktif = topSayfa;
        const sayfa = Math.max(1, gcSayfalari.aktif || 1);
        const sayfaAktif = eslesenAktif.slice((sayfa - 1) * PROJE_SAYFA_BOYUTU, sayfa * PROJE_SAYFA_BOYUTU);
        h += `<h3 style="font-size:14px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px">Aktif Projeler (${eslesenAktif.length})</h3>
          <div style="margin-bottom:28px">
            <div class="ky-proje-grid">${sayfaAktif.map(p => projeKarti(p, false)).join('')}</div>
            ${renderProjeSayfalamaBar(eslesenAktif.length, sayfa, PROJE_SAYFA_BOYUTU, (yeniSayfa) => {
              gcSayfalari.aktif = yeniSayfa;
              window.gcBelgeProjeFiltrele(false);
            })}
          </div>`;
      }
      if (eslesenOnaylanan.length > 0) {
        const topSayfa = Math.max(1, Math.ceil(eslesenOnaylanan.length / PROJE_SAYFA_BOYUTU));
        if (gcSayfalari.onaylanan > topSayfa) gcSayfalari.onaylanan = topSayfa;
        const sayfa = Math.max(1, gcSayfalari.onaylanan || 1);
        const sayfaOnay = eslesenOnaylanan.slice((sayfa - 1) * PROJE_SAYFA_BOYUTU, sayfa * PROJE_SAYFA_BOYUTU);
        h += `<h3 style="font-size:14px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px">Onayladıklarım (${eslesenOnaylanan.length})</h3>
          <div>
            <div class="ky-proje-grid">${sayfaOnay.map(p => projeKarti(p, true)).join('')}</div>
            ${renderProjeSayfalamaBar(eslesenOnaylanan.length, sayfa, PROJE_SAYFA_BOYUTU, (yeniSayfa) => {
              gcSayfalari.onaylanan = yeniSayfa;
              window.gcBelgeProjeFiltrele(false);
            })}
          </div>`;
      }
      return h;
    };

    listEl.innerHTML = `
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <input id="gcBelgeProjeArama" type="text" placeholder="🔍 Proje adına göre ara..." ${dtmEventAttr('input', function(event) { gcBelgeProjeFiltrele(true) })}
          style="flex:1;min-width:200px;max-width:400px;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none">
        <select id="gcBelgeProjeSirala" ${dtmEventAttr('change', function(event) { gcBelgeProjeFiltrele(true) })}
          style="padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;background:#fff;cursor:pointer;outline:none">
          <option value="tarih-yeni">Tarihe göre (Yeni → Eski)</option>
          <option value="tarih-eski">Tarihe göre (Eski → Yeni)</option>
          <option value="isim-az">İsme göre (A → Z)</option>
          <option value="isim-za">İsme göre (Z → A)</option>
        </select>
      </div>
      <div id="gcBelgeProjeGrup">${renderGrupHTML('', 'tarih-yeni')}</div>`;

    window.gcBelgeProjeFiltrele = (sayfaSifirla = true) => {
      if (sayfaSifirla) {
        gcSayfalari.aktif = 1;
        gcSayfalari.onaylanan = 1;
      }
      const ara = document.getElementById('gcBelgeProjeArama').value;
      const sirala = document.getElementById('gcBelgeProjeSirala').value;
      document.getElementById('gcBelgeProjeGrup').innerHTML = renderGrupHTML(ara, sirala);
    };
  } catch(e) {
    const listEl = document.getElementById('gerceklestirmeciBelgeList');
    if (listEl) listEl.innerHTML = `<div style="color:red;padding:20px">Projeler yüklenemedi: ${escHtml(e?.message || '')}</div>`;
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

  const isMalVeyaHizmet = isMalVeyaHizmetTuru(proje.isTuru);
  const sonTutanakId = isMalVeyaHizmet ? 'muayene-kabul' : 'bitti-tutanagi';
  const sonTutanakAd = isMalVeyaHizmet ? 'Muayene ve Kabul' : 'Bitti Tutanağı';

  if (currentGerceklestirmeciBelge === 'dokumanlar') currentGerceklestirmeciBelge = 'dt-onay-belgesi';
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
      ${dtmEventAttr('click', function(event) { currentGerceklestirmeciBelge=String(b.id ?? '');renderPage(); })}>${b.ad}</div>`
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
      <button ${dtmEventAttr('click', function(event) { currentGerceklestirmeciBelgelerProjeId=null;currentGerceklestirmeciReadOnly=false;renderPage(); })}
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
        <button ${dtmEventAttr('click', function(event) { acTeknikSartnameDuzenleModal() })}
          style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#f59e0b;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(245,158,11,0.35)"
          ${dtmEventAttr('mouseover', function(event) { this.style.background='#d97706' })} ${dtmEventAttr('mouseout', function(event) { this.style.background='#f59e0b' })}>
          <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Şartname Metnini Düzenle
        </button>
      ` : ''}
      <button ${dtmEventAttr('click', function(event) { gerceklestirmeciBelgeYazdir() })}
        style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;background:#3b82f6;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(59,130,246,0.35)"
        ${dtmEventAttr('mouseover', function(event) { this.style.background='#2563eb' })} ${dtmEventAttr('mouseout', function(event) { this.style.background='#3b82f6' })}>
        <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
        Yazdır
      </button>
      <button ${dtmEventAttr('click', function(event) { acGerceklestirmeciIndirModal() })}
        style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;background:#10b981;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(16,185,129,0.35)"
        ${dtmEventAttr('mouseover', function(event) { this.style.background='#059669' })} ${dtmEventAttr('mouseout', function(event) { this.style.background='#10b981' })}>
        <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        İndir
      </button>
      <button ${dtmEventAttr('click', function(event) { ihaleDosyasiZipIndir(true) })}
        title="Tüm resmi tutanakları (D.T. Onay dahil) ve yüklenen evrakları tamamı PDF formatında tek bir ZIP dosyası olarak indir"
        style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 3px 10px rgba(124,58,237,0.35)"
        ${dtmEventAttr('mouseover', function(event) { this.style.background='#6d28d9' })} ${dtmEventAttr('mouseout', function(event) { this.style.background='#7c3aed' })}>
        📦 İhale Dosyası (ZIP)
      </button>
      <button ${dtmEventAttr('click', function(event) { gerceklestirmeciBelgePdfIndir() })} style="display:none">PDF İndir</button>
    </div>
    <div class="belge-preview${['yaklasik-maliyet','teklif-tutanagi'].includes(currentGerceklestirmeciBelge) ? ' landscape' : ''}">${belgeHTML}</div>
  `;
  if (currentGerceklestirmeciBelge === 'teklif-tutanagi') {
    requestAnimationFrame(() => hizalaGorevliIsmi(document));
  }
}

async function gcOnayBilgiKaydet() {
  proje.dtOnayTarihi = document.getElementById('gc_dtOnayTarihi')?.value || '';
  proje.dtOnayNo = document.getElementById('gc_dtOnayNo')?.value || '';
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
  if (!belgeHesaplamaKontrol(proje, referans)) return;
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
  if (!belgeHesaplamaKontrol(proje, referans)) return;
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
  // Sözleşme, sayfa başına tekrar eden üstbilgi/imza bloğu içerdiği için
  // html2canvas tabanlı PDF motoruyla doğru üretilemiyor; tarayıcının kendi
  // yazdırma motoruna yönlendiriliyor (çıktı "Yazdır" ile birebir aynı olur).
  if (sozlesme) {
    showToast('Yazdırma penceresinde Hedef olarak "PDF olarak kaydet" seçin.', 'info', 6000);
    belgeYazdir(html, landscape, true, dosyaAdi);
    return;
  }
  belgePdfIndir(html, landscape, dosyaAdi);
}

// ===================== PROJE ÖZET SAYFASI (GERÇEKLEŞTİRMECİ) =====================
function renderProjeOzetPage() {
  const main = document.getElementById('mainContent');
  const p = proje;
  const hatalar = getHesaplamaHatalari(p, referans);
  if (hatalar.length) { main.innerHTML = renderHesaplamaUyarisi(hatalar); return; }
  const kalemler = getKalemler(p);
  const ymMaliyet = hesaplaYaklasikMaliyet(p);
  const kazananIndex = (p.kazananFirmaIndex !== undefined && p.kazananFirmaIndex >= 0) ? p.kazananFirmaIndex : hesaplaKazananFirma(p);
  const kazananFirma = (p.teklifFirmalar && kazananIndex >= 0) ? p.teklifFirmalar[kazananIndex] : null;
  const sozlesmeKdvsiz = kazananFirma ? hesaplaTeklifFirmaToplam(kazananFirma, kalemler) : 0;
  const belgeRef = getBelgeReferansi(p, referans);
  const basitUsul = (kazananFirma && typeof isFirmaBasitUsul === 'function' ? isFirmaBasitUsul(kazananFirma.ad, belgeRef) : false);
  const vergiler = hesaplaSozlesmeVergileri(p, referans, basitUsul);
  const kdvTutar = vergiler.kdv;
  const sozlesmeToplamKdvli = vergiler.toplam;

  const satir = (label, value) => value ? `<tr><td style="color:#6b7280;padding:8px 12px;font-size:13px;width:45%">${label}</td><td style="padding:8px 12px;font-size:13px;font-weight:500">${value}</td></tr>` : '';
  const kart = (baslik, icerik) => `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:16px;overflow:hidden"><div style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:13px;color:#374151">${baslik}</div>${icerik}</div>`;

  const ymGorevliler = p.ymGorevliler.slice(0, p.ymGorevliSayisi || 1).filter(g => g.ad).map(g => `<tr><td style="padding:6px 12px;font-size:13px">${escHtml(g.ad)}</td><td style="padding:6px 12px;font-size:13px;color:#6b7280">${escHtml(g.unvan)}</td></tr>`).join('');
  const dtGorevliler = p.dtGorevliler.slice(0, p.dtGorevliSayisi || 1).filter(g => g.ad).map(g => `<tr><td style="padding:6px 12px;font-size:13px">${escHtml(g.ad)}</td><td style="padding:6px 12px;font-size:13px;color:#6b7280">${escHtml(g.unvan)}</td></tr>`).join('');

  const ymFirmalar = p.ymFirmalar.filter(f => f.ad);
  const ymFirmaRows = ymFirmalar.map(f => {
    const toplam = hesaplaYMFirmaToplam(f, kalemler);
    return `<tr>
      <td style="padding:7px 12px;font-size:13px">${escHtml(f.ad)}</td>
      <td style="padding:7px 12px;font-size:13px;text-align:right">${formatCurrency(toplam)} TL</td>
    </tr>`;
  }).join('');

  const teklifFirmalar = p.teklifFirmalar.filter(f => f.ad);
  const firmaTeklifRows = teklifFirmalar.map((f, fi) => {
    const gercekIndex = p.teklifFirmalar.indexOf(f);
    const toplam = hesaplaTeklifFirmaToplam(f, kalemler);
    const kazanan = gercekIndex === kazananIndex;
    return `<tr style="${kazanan ? 'background:#f0fdf4;font-weight:600' : ''}">
      <td style="padding:7px 12px;font-size:13px">${kazanan ? '✓ ' : ''}${escHtml(f.ad)}</td>
      <td style="padding:7px 12px;font-size:13px;text-align:right">${formatCurrency(toplam)} TL</td>
    </tr>`;
  }).join('');

  main.innerHTML = `
    <div style="max-width:800px;margin:0 auto;padding:24px 16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <button ${dtmEventAttr('click', function(event) { if(currentOnayliBelgelerProjeId){currentOnayliBelgelerProjeId=null;}else{currentPage='gonderilen-projeler';}renderPage(); })} style="padding:7px 14px;border:1px solid #d1d5db;background:#fff;border-radius:7px;cursor:pointer;font-size:13px">← Geri</button>
        <div>
          <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0">${escHtml(p.isAdi || '(İsimsiz Proje)')}</h2>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">${getStatusBadge(currentProjeStatus || 'gonderildi')} Proje Özeti</div>
        </div>
      </div>

      ${kart('📋 Proje Bilgileri', `<table style="width:100%;border-collapse:collapse">
        ${satir('İdare', escHtml(p.idareAdi))}
        ${satir('Müdürlük', escHtml(p.mudurluk))}
        ${satir('İş / Hizmet Adı', escHtml(p.isAdi))}
        ${satir('İş Türü', escHtml(p.isTuru))}
        ${satir('KDV Oranı', '%' + vergiler.kdvOrani)}
        ${satir('Şehir / İlçe', [p.sehir, p.ilce].filter(Boolean).join(' / '))}
      </table>`)}

      ${kart('👷 Y.M. Görevlileri', `<table style="width:100%;border-collapse:collapse">${ymGorevliler || '<tr><td style="padding:10px 12px;color:#9ca3af;font-size:13px">Bilgi girilmemiş</td></tr>'}</table>`) }
      ${kart('👷 D.T. Görevlileri', `<table style="width:100%;border-collapse:collapse">${dtGorevliler || '<tr><td style="padding:10px 12px;color:#9ca3af;font-size:13px">Bilgi girilmemiş</td></tr>'}</table>`)}

      ${kart('📅 Onay ve Sözleşme Bilgileri', `<table style="width:100%;border-collapse:collapse">
        ${satir('Y.M. Onay Tarihi', formatDate(p.ymOnayTarihi))}
        ${satir('Y.M. Onay Sayısı', escHtml(p.ymOnayNo))}
        ${satir('D.T. Onay Tarihi', formatDate(p.dtOnayTarihi))}
        ${satir('D.T. Onay Sayısı', escHtml(p.dtOnayNo))}
        ${satir('Onaylayan Amir', p.onaylayanAmir?.ad ? escHtml(p.onaylayanAmir.ad + ' / ' + p.onaylayanAmir.unvan) : '')}
        ${satir('Sözleşme Tarihi', formatDate(p.sozlesmeTarihi))}
        ${satir('İş Süresi', p.isSuresi ? escHtml(p.isSuresi) + ' Takvim Günü' : '')}
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
          ${kazananFirma?.ad ? `<tfoot><tr style="background:#f0fdf4;border-top:2px solid #bbf7d0"><td style="padding:8px 12px;font-size:13px;font-weight:700;color:#15803d">✓ Kazanan Firma</td><td style="padding:8px 12px;font-size:13px;font-weight:700;color:#15803d;text-align:right">${escHtml(kazananFirma.ad)}</td></tr></tfoot>` : ''}
        </table>`) : ''}

      ${kart('💰 Mali Özet', `<table style="width:100%;border-collapse:collapse">
        ${satir(basitUsul ? 'Sözleşme Tutarı' : 'Sözleşme Tutarı (KDV Hariç)', sozlesmeKdvsiz > 0 ? formatCurrency(sozlesmeKdvsiz) + ' TL' : '')}
        ${basitUsul ? satir('KDV Durumu', '<span style="color:#16a34a;font-weight:600">Basit Usul (KDV Muaf)</span>') : satir('KDV Tutarı (%' + vergiler.kdvOrani + ')', kdvTutar > 0 ? formatCurrency(kdvTutar) + ' TL' : '0,00 TL')}
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
              <label>D.T. Onay Tarihi</label>
              <input type="date" id="gc_dtOnayTarihi" value="${escAttr(p.dtOnayTarihi || '')}" ${roInp}>
            </div>
            <div class="form-group">
              <label>D.T. Onay Sayısı</label>
              <input type="text" id="gc_dtOnayNo" value="${escAttr(p.dtOnayNo || '')}" placeholder="Örn: 84426" ${roInp}>
            </div>
            <div class="form-group">
              <label>Kullanılabilir Ödenek Tutarı (TL)</label>
              <input type="number" id="gc_odenek" value="${escAttr(p.odenek || '')}" placeholder="0.00" ${roInp}>
            </div>
            <div class="form-group">
              <label>Yatırım Proje Numarası</label>
              <input type="text" id="gc_yatirimProjeNo" value="${escAttr(p.yatirimProjeNo || '')}" placeholder="Varsa giriniz" ${roInp}>
            </div>
            <div class="form-group">
              <label>Bütçe Tertibi</label>
              <select id="gc_butceTertibi" ${dis}>
                <option value="">-- Seçin --</option>
                ${(referans.butceTertibiList || []).map(bt => { const no = typeof bt === 'string' ? bt : bt.no; const ac = typeof bt === 'string' ? '' : bt.aciklama; return `<option value="${escAttr(no)}" ${p.butceTertibi === no ? 'selected' : ''}>${escHtml(no)}${ac ? ' — ' + escHtml(ac) : ''}</option>`; }).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>İşin Miktarı</label>
              <input type="text" id="gc_isMiktari"
                value="${!isMalVeyaHizmetTuru(p.isTuru) ? '1 Adet' : escAttr(p.isMiktari || '')}"
                ${ro || !isMalVeyaHizmetTuru(p.isTuru) ? 'readonly style="background:#f3f4f6;color:#6b7280"' : ''}
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
          ${!ro ? `<div style="margin-top:14px"><button class="btn btn-primary" ${dtmEventAttr('click', function(event) { gcOnayBilgiKaydet() })}>💾 Kaydet</button></div>` : ''}
        </div>
      </div>`;
      })() : ''}

      ${currentDTMUser?.role === 'admin' || currentDTMUser?.role === 'superadmin' ? (() => {
        const bt = (referans.butceTertibiList || []).find(b => (typeof b === 'string' ? b : b.no) === p.butceTertibi);
        const btLabel = bt ? (typeof bt === 'string' ? bt : bt.no + (bt.aciklama ? ' — ' + bt.aciklama : '')) : (p.butceTertibi || '-');
        const odenek = p.odenek ? Number(p.odenek).toLocaleString('tr-TR', {minimumFractionDigits:2}) + ' TL' : '-';
        return kart('💳 Ödenek ve Bütçe Bilgileri', `<table style="width:100%;border-collapse:collapse">
          ${satir('Kullanılabilir Ödenek', odenek)}
          ${satir('Bütçe Tertibi', escHtml(btLabel))}
          ${satir('Yatırım Proje No', escHtml(p.yatirimProjeNo || ''))}
          ${satir('İşin Miktarı', escHtml(p.isMiktari || ''))}
          ${satir('Avans', escHtml(p.avansVar || ''))}
          ${satir('Fiyat Farkı', escHtml(p.fiyatFarkiVar || ''))}
        </table>`);
      })() : ''}

      ${kart('📎 Projeye Ait Dokümanlar ve Evraklar', `<div style="padding:16px" id="projeDosyaListesi">Yükleniyor...</div>`)}

      ${currentDTMUser?.role !== 'gerceklestirmeci' && !currentOnayliBelgelerProjeId && !['onaylandi','arsivlendi'].includes(currentProjeStatus) ? `
      <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px;padding-bottom:32px">
        <button ${dtmEventAttr('click', function(event) { geriGonderClick(String(currentCloudProjeId ?? ''), String(p.isAdi ?? '')) })}
          style="padding:10px 24px;background:#fff;border:1px solid #dc2626;color:#dc2626;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">
          ↩ Geri Gönder
        </button>
        <button ${dtmEventAttr('click', function(event) { onaylaClick(String(currentCloudProjeId ?? ''), String(p.isAdi ?? '')) })}
          style="padding:10px 24px;background:#16a34a;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">
          ✓ Onayla
        </button>
      </div>` : '<div style="padding-bottom:32px"></div>'}
    </div>`;
  projeDosyaListesiYukle();
}

// ===================== ONAY BELGESİ SAYFASI (GERÇEKLEŞTİRMECİ) =====================
function renderOnayBelgesiPage() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div style="max-width:800px;margin:0 auto;padding:24px 16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <button ${dtmEventAttr('click', function(event) { currentPage='gonderilen-projeler';renderPage(); })} style="padding:7px 14px;border:1px solid #d1d5db;background:#fff;border-radius:7px;cursor:pointer;font-size:13px">← Geri</button>
        <div>
          <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0">Onay Belgesi Oluştur</h2>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">${escHtml(proje.isAdi || '(İsimsiz Proje)')}</div>
        </div>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:32px;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">✅</div>
        <div style="font-size:16px;font-weight:700;color:#15803d;margin-bottom:8px">Proje Onaylandı</div>
        <div style="font-size:13px;color:#166534;margin-bottom:24px">Belge formatı tamamlandıktan sonra buradan Doğrudan Temin Onay Belgesi oluşturabileceksiniz.</div>
        <button ${dtmEventAttr('click', function(event) { currentPage='gonderilen-projeler';renderPage(); })} style="padding:10px 24px;background:#16a34a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">Proje Listesine Dön</button>
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
    let onayliAktifSayfa = 1;

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
      else if (siralama === 'yeni') liste = [...liste].sort((a,b)=>(b.onaylandiAt?.toMillis?.()??0)-(a.onaylandiAt?.toMillis?.()??0));
      else if (siralama === 'eski') liste = [...liste].sort((a,b)=>(a.onaylandiAt?.toMillis?.()??0)-(b.onaylandiAt?.toMillis?.()??0));
      return liste;
    };

    const renderListe = (sayfaSifirla = true) => {
      if (sayfaSifirla !== false) onayliAktifSayfa = 1;
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

      const toplamSayfa = Math.max(1, Math.ceil(liste.length / PROJE_SAYFA_BOYUTU));
      if (onayliAktifSayfa > toplamSayfa) onayliAktifSayfa = toplamSayfa;
      if (onayliAktifSayfa < 1) onayliAktifSayfa = 1;
      const sayfaListe = liste.slice((onayliAktifSayfa - 1) * PROJE_SAYFA_BOYUTU, onayliAktifSayfa * PROJE_SAYFA_BOYUTU);

      listeEl.innerHTML = `<div class="ky-proje-grid">${sayfaListe.map(p => {
        const tarihStr = p.onaylandiAt?.toDate ? p.onaylandiAt.toDate().toLocaleDateString('tr-TR') : '-';
        const adSafe   = p.isAdi||'(İsimsiz)';
        const aksiyonlar = aktifSekme === 'arsiv' ? `
          <button class="ky-btn-open" ${dtmEventAttr('click', function(event) { event.stopPropagation();onayliBelgelerProjeAc(String(p.id ?? '')) })}>&#128196; Belgeleri Gör</button>
          <button class="ky-btn" ${dtmEventAttr('click', function(event) { event.stopPropagation();arsivdenCikarClick(String(p.id ?? ''),String(adSafe ?? '')) })}
            style="background:#f59e0b;color:#fff;border-color:#f59e0b;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid">
            ↩ Arşivden Çıkar
          </button>` : `
          <button class="ky-btn-open" ${dtmEventAttr('click', function(event) { event.stopPropagation();onayliBelgelerProjeAc(String(p.id ?? '')) })}>&#128196; Belgeleri Gör</button>
          <button class="ky-btn" ${dtmEventAttr('click', function(event) { event.stopPropagation();adminGeriGonderClick(String(p.id ?? ''),String(adSafe ?? '')) })}
            style="background:#f59e0b;color:#fff;border-color:#f59e0b;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid">
            ↩ Geri Gönder
          </button>
          <button class="ky-btn" ${dtmEventAttr('click', function(event) { event.stopPropagation();arsivleClick(String(p.id ?? ''),String(adSafe ?? '')) })}
            style="background:#6b7280;color:#fff;border-color:#6b7280;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid">
            🗃️ Arşivle
          </button>`;
        return `<div class="ky-proje-item" style="cursor:pointer" ${dtmEventAttr('click', function(event) { onayliBelgelerProjeAc(String(p.id ?? '')) })}>
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
      }).join('')}</div>` + renderProjeSayfalamaBar(liste.length, onayliAktifSayfa, PROJE_SAYFA_BOYUTU, (yeniSayfa) => {
        onayliAktifSayfa = yeniSayfa;
        renderListe(false);
      });
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
        <button id="sekmeBekleyen" ${dtmEventAttr('click', function(event) { switchSekme('bekleyenler') })}
          style="padding:10px 20px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:3px solid #f59e0b;color:#b45309;margin-bottom:-2px">
          📥 İşlem Bekleyenler <span style="background:#fef3c7;color:#92400e;font-size:11px;padding:2px 7px;border-radius:10px;margin-left:4px">${bekleyenler.length}</span>
        </button>
        <button id="sekmeArsiv" ${dtmEventAttr('click', function(event) { switchSekme('arsiv') })}
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
        <button ${dtmEventAttr('click', function(event) { el.querySelector('#onayliTarih').value='hepsi';el.querySelector('#onayliAralikWrap').style.display='none';renderListe() })}
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
    if (el) el.innerHTML = `<div style="color:red;padding:20px">Projeler yüklenemedi: ${escHtml(e?.message || '')}</div>`;
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
          <div ${dtmEventAttr('click', function(event) { openAvatarPicker() })} title="Profil resmini değiştir"
               ${dtmEventAttr('mouseover', function(event) { document.getElementById('avatarEditOverlay').style.opacity='1' })}
               ${dtmEventAttr('mouseout', function(event) { document.getElementById('avatarEditOverlay').style.opacity='0' })}
               style="position:relative;width:80px;height:80px;cursor:pointer;flex-shrink:0;border-radius:50%;box-shadow:0 4px 14px rgba(0,0,0,0.25);">
            <div id="profilAvatarCircle" style="width:80px;height:80px;background:rgba(255,255,255,0.18);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;overflow:hidden;border:3px solid rgba(255,255,255,0.85);backdrop-filter:blur(4px);">
              ${avatarSrc(u.avatar)
                ? `<img src="${avatarSrc(u.avatar)}" style="width:100%;height:100%;object-fit:cover" />`
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
            <button ${dtmEventAttr('click', function(event) { closeAvatarPicker() })} style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--gray-400);line-height:1;padding:4px 8px;border-radius:6px;">&times;</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;">
            ${AVATARS.map(a => `
              <div ${dtmEventAttr('click', function(event) { avatarSec(String(a ?? '')) })} style="cursor:pointer;border-radius:50%;overflow:hidden;width:48px;height:48px;border:3px solid ${u.avatar===a ? 'var(--primary, #1a56db)' : 'transparent'};transition:all .2s;box-shadow:${u.avatar===a ? '0 0 0 2px rgba(26,86,219,0.3)' : 'none'};margin:auto;" id="avatarOpt_${a}">
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
            <button class="btn btn-primary" ${dtmEventAttr('click', function(event) { sifreDegistir() })} style="width:100%;padding:11px 16px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:600;border-radius:8px;">
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
          <button ${dtmEventAttr('click', function(event) { epostaDurumYenile(this) })} title="Doğrulama durumunu sunucudan yenile" class="btn btn-sm btn-secondary" style="padding:5px 10px;font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;">
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
          <button class="btn btn-secondary" ${dtmEventAttr('click', function(event) { epostaDogrulamaIstegiGonder(this) })} style="padding:11px 20px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;border-radius:8px;cursor:pointer;">
            <span style="display:inline-flex;">${typeof getIcon === 'function' ? getIcon('send', 15) : ''}</span>
            <span>Doğrulama Bağlantısı Gönder / E-Postayı Güncelle</span>
          </button>
        </div>
      </div>

      <!-- Yapay Zeka (AI) Durumu / Yönetimi -->
      ${(u.role === 'superadmin' || u.role === 'admin') ? `
      <div class="card" style="margin-top:20px;border:1.5px solid #3b82f6;box-shadow:0 4px 15px rgba(59,130,246,0.08);">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%);color:#fff;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">🤖</span>
            <h3 style="font-size:15px;margin:0;font-weight:700;color:#fff;">Merkezi Yapay Zeka (Google Gemini AI) Ayarları</h3>
          </div>
          <span style="font-size:11px;background:rgba(255,255,255,0.2);color:#fff;padding:2px 8px;border-radius:12px;font-weight:600;">
            ${referans.geminiApiKey ? '✓ Aktif' : 'Tanımsız'}
          </span>
        </div>
        <div class="card-body" style="padding:20px;">
          <p style="font-size:13px;color:var(--gray-600);margin:0 0 10px;line-height:1.5;">
            Sistem Yöneticisi yetkinizle kurum geneli Google Gemini API anahtarını yönetebilirsiniz. Bu anahtar tüm kurum memurlarının Olur ve teklif belgelerini çözümlerken ortak kullanılır.
          </p>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:12.5px;color:var(--gray-600);">
            <span>Kullanılan Model:</span>
            <span style="font-family:monospace;font-weight:700;background:var(--gray-100);color:var(--primary);padding:3px 10px;border-radius:6px;border:1px solid var(--gray-200);">gemini-3.8-flash (Aktif)</span>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:720px;">
            <div style="position:relative;flex:1;min-width:280px;">
              <input type="password" id="profilGeminiApiKey" value="${escAttr(referans.geminiApiKey || '')}" placeholder="Google AI Studio API Anahtarı (AIzaSy...)" style="width:100%;padding:10px 40px 10px 14px;border:1.5px solid var(--gray-300);border-radius:8px;font-size:13.5px;font-family:monospace;box-sizing:border-box;">
              <button type="button" ${dtmEventAttr('click', function(event) { toggleProfilGeminiKeyVisibility() })} style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--gray-500);font-size:14px;padding:2px;" title="Göster / Gizle">👁️</button>
            </div>
            <button class="btn btn-primary" ${dtmEventAttr('click', function(event) { profilGeminiApiKeyKaydet() })} style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;">
              💾 Buluta Kaydet
            </button>
            <button class="btn btn-outline" ${dtmEventAttr('click', function(event) { profilGeminiApiKeyTestEt() })} style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;">
              ⚡ Test Et
            </button>
            ${referans.geminiApiKey ? `
              <button class="btn btn-icon-danger" ${dtmEventAttr('click', function(event) { profilGeminiApiKeySil() })} title="Anahtarı Sistemden Kaldır" style="padding:10px 12px;">
                ✕
              </button>
            ` : ''}
          </div>
          <div id="profilGeminiApiTestResult" style="margin-top:12px;font-size:13px;display:none;padding:8px 12px;border-radius:6px;background:var(--gray-50);"></div>
        </div>
      </div>
      ` : `
      <div class="card" style="margin-top:20px;border:1px solid var(--gray-200);">
        <div class="card-header" style="display:flex;align-items:center;gap:8px;padding:16px 20px;background:var(--gray-50);">
          <span style="font-size:18px;">🤖</span>
          <h3 style="font-size:15px;margin:0;font-weight:700;color:var(--gray-900);">Yapay Zeka Destekli Belge Okuyucu</h3>
        </div>
        <div class="card-body" style="padding:18px 20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="font-weight:600;font-size:14px;color:var(--gray-800);">Kurumsal Yapay Zeka Durumu</div>
              <p style="font-size:12.5px;color:var(--gray-500);margin:4px 0 0;">Yüklenen resmi evraklar ve fotoğraflar otomatik olarak kurumsal yapay zeka ile çözümlenir.</p>
            </div>
            <span style="font-size:12px;font-weight:700;padding:4px 12px;border-radius:14px;background:${referans.geminiApiKey ? '#f0fdf4' : 'var(--gray-100)'};color:${referans.geminiApiKey ? '#166534' : 'var(--gray-600)'};border:1px solid ${referans.geminiApiKey ? '#bbf7d0' : 'var(--gray-200)'};">
              ${referans.geminiApiKey ? '✓ Google Gemini Flash Aktif' : 'Yerel OCR Aktif'}
            </span>
          </div>
        </div>
      </div>
      `}

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
    const [tumDuyurular, okunanlar, silinenler] = await Promise.all([getDuyurular(), getOkunanDuyurular(), getSilinenDuyurular()]);
    const duyurular = tumDuyurular.filter(d => !silinenler.includes(d.id));
    const canManage = ['admin', 'superadmin'].includes(currentDTMUser?.role);
    const adminForm = canManage ? `
      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><h3>Yeni Duyuru Yayınla</h3></div>
        <div class="card-body">
          <div class="form-group"><label>Başlık</label><input type="text" id="duyuruBaslik" placeholder="Duyuru başlığı"></div>
          <div class="form-group"><label>Mesaj</label><textarea id="duyuruMesaj" rows="4" placeholder="Duyuru içeriği..." style="width:100%;padding:8px;border:1px solid var(--gray-200);border-radius:6px;font-size:14px;resize:vertical"></textarea></div>
          <div id="duyuruMsg" style="margin:8px 0;font-size:13px"></div>
          <button class="btn btn-primary" ${dtmEventAttr('click', function(event) { duyuruOlustur(this) })}>Yayınla</button>
        </div>
      </div>` : '';
    const listHTML = duyurular.length === 0
      ? `<div style="text-align:center;padding:40px;color:var(--gray-400)">Henüz duyuru yok.</div>`
      : duyurular.map(d => {
          const okundu = okunanlar.includes(d.id);
          const tarih = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString('tr-TR') : '-';
          return `
            <div class="duyuru-item ${okundu ? 'duyuru-okundu' : 'duyuru-okunmadi'}">
              <div class="duyuru-ust" ${dtmEventAttr('click', function(event) { toggleDuyuru(String(d.id ?? '')) })} style="cursor:pointer">
                <div class="duyuru-baslik">
                  ${!okundu ? '<span class="duyuru-yeni">Yeni</span>' : ''}
                  ${escHtml(d.baslik)}
                </div>
                <div style="display:flex;align-items:center;gap:10px">
                  <div class="duyuru-meta">${escHtml(d.createdBy || '')} &middot; ${tarih}</div>
                  <span class="duyuru-chevron">&#8250;</span>
                </div>
              </div>
              <div class="duyuru-detay" id="duyuruDetay_${d.id}" style="display:none">
                <div class="duyuru-mesaj">${escHtml(d.mesaj)}</div>
                <div class="duyuru-actions">
                  ${!okundu ? `<button class="btn btn-sm btn-outline" ${dtmEventAttr('click', function(event) { event.stopPropagation();duyuruOku(String(d.id ?? '')) })}>Okundu</button>` : ''}
                  ${okundu ? `<button class="btn btn-sm btn-outline" ${dtmEventAttr('click', function(event) { event.stopPropagation();duyuruKendindenGizleCagir(String(d.id ?? '')) })}>Sil</button>` : ''}
                  ${canManage ? `<button class="btn btn-sm btn-danger" ${dtmEventAttr('click', function(event) { event.stopPropagation();duyuruSil(String(d.id ?? '')) })}>Herkesten Kaldır</button>` : ''}
                </div>
              </div>
            </div>`;
        }).join('');
    main.innerHTML = `
      <div class="page-header"><h2>Duyurular</h2><p>Yönetici tarafından paylaşılan duyurular.</p></div>
      ${adminForm}
      <div class="card"><div class="card-header"><h3>Tüm Duyurular</h3></div><div class="card-body" style="padding:0">${listHTML}</div></div>`;

    window.toggleDuyuru = (id) => {
      const el = document.getElementById('duyuruDetay_' + id);
      if (!el) return;
      const acik = el.style.display !== 'none';
      el.style.display = acik ? 'none' : 'block';
      el.closest('.duyuru-item')?.classList.toggle('duyuru-acik', !acik);
    };
  } catch(e) {
    main.innerHTML = `<div class="page-header"><h2>Duyurular</h2></div><div style="color:red;padding:20px">Yüklenemedi: ${escHtml(e?.message || '')}</div>`;
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

// Okunmuş bir duyuruyu sadece kendi listesinden kaldırır (diğer kullanıcıları etkilemez)
async function duyuruKendindenGizleCagir(duyuruId) {
  try {
    await duyuruKendindenGizle(duyuruId);
    renderDuyurularPage();
  } catch(e) { showToast('Hata: ' + hataMesaji(e), 'error'); }
}

// ===================== HAKKINDA SAYFASI =====================
const APP_CURRENT_VERSION = '2.6.0';

function compareSemver(v1, v2) {
  const p1 = String(v1 || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = String(v2 || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(p1.length, p2.length, 3);
  for (let i = 0; i < len; i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

async function checkForUpdates(showLoading = false) {
  try {
    const doc = await db.collection('appConfig').doc('version').get();
    const rawLatest = doc.exists ? (doc.data()?.latest || APP_CURRENT_VERSION) : APP_CURRENT_VERSION;
    const cmp = compareSemver(rawLatest, APP_CURRENT_VERSION);
    const hasUpdate = cmp > 0;
    const latestVersion = hasUpdate ? rawLatest : APP_CURRENT_VERSION;

    if (cmp < 0 && ['admin', 'superadmin'].includes(currentDTMUser?.role)) {
      db.collection('appConfig').doc('version').set({ latest: APP_CURRENT_VERSION }, { merge: true }).catch(() => {});
    }

    // Badge güncelle
    const badge = document.getElementById('guncellemeBadge');
    if (badge) {
      badge.style.display = hasUpdate ? 'inline-flex' : 'none';
    }

    return { latestVersion, hasUpdate };
  } catch(e) {
    const badge = document.getElementById('guncellemeBadge');
    if (badge) badge.style.display = 'none';
    return { latestVersion: APP_CURRENT_VERSION, hasUpdate: false };
  }
}

let currentHakkindaTab = 'hakkinda';

function hakkindaSekmeDegistir(sekme) {
  currentHakkindaTab = sekme;
  renderHakkindaPage();
}

function hakkindaBilgileriKopyala() {
  const tarayici = (typeof navigator !== 'undefined' && navigator.userAgent)
    ? (navigator.userAgent.split(') ').pop().split(' ')[0] || navigator.userAgent)
    : 'Bilinmiyor';
  const metin = [
    `Uygulama: Doğrudan Temin Modülü (DTM)`,
    `Geliştirici: Merih Yazılım`,
    `Kurum: Karaman İl Özel İdaresi - Yatırım ve İnşaat Müdürlüğü`,
    `Sürüm: v${APP_CURRENT_VERSION}`,
    `Sürüm Numarası: 20261028 (dtm-v139)`,
    `Platform: Web PWA / Firebase Cloud`,
    `Tarayıcı: ${tarayici}`,
    `Tarih: ${new Date().toLocaleString('tr-TR')}`
  ].join('\n');

  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(metin).then(() => {
      showToast('📋 Sürüm ve sistem bilgileri panoya kopyalandı!', 'success');
    }).catch(() => {
      showToast('Panoya kopyalanamadı.', 'warning');
    });
  } else {
    showToast('📋 Bilgiler hazır: v' + APP_CURRENT_VERSION, 'info');
  }
}

if (typeof window !== 'undefined') {
  window.hakkindaSekmeDegistir = hakkindaSekmeDegistir;
  window.hakkindaBilgileriKopyala = hakkindaBilgileriKopyala;
  window.getMerihYazilimLogoSvg = getMerihYazilimLogoSvg;
}

function getMerihYazilimLogoSvg(size = 64) {
  const s = Number(size) || 64;
  const uid = 'merih_' + s;
  return `<svg width="${s}" height="${s}" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;display:block;filter:drop-shadow(0 6px 14px rgba(2,132,199,0.28))">
    <defs>
      <linearGradient id="${uid}_f1" x1="18" y1="24" x2="42" y2="96" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#e0f2fe"/>
        <stop offset="100%" stop-color="#38bdf8"/>
      </linearGradient>
      <linearGradient id="${uid}_f2" x1="34" y1="24" x2="60" y2="76" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#0284c7"/>
        <stop offset="100%" stop-color="#075985"/>
      </linearGradient>
      <linearGradient id="${uid}_f3" x1="60" y1="76" x2="86" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="100%" stop-color="#bae6fd"/>
      </linearGradient>
      <linearGradient id="${uid}_f4" x1="86" y1="24" x2="102" y2="96" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#f97316"/>
        <stop offset="100%" stop-color="#c2410c"/>
      </linearGradient>
    </defs>
    <rect x="4" y="4" width="112" height="112" rx="28" fill="#061320" stroke="rgba(56,189,248,0.45)" stroke-width="2.5"/>
    <polygon points="18,90 18,32 34,22 34,80" fill="url(#${uid}_f1)"/>
    <polygon points="18,90 34,80 44,86 28,96" fill="#0369a1"/>
    <polygon points="34,22 48,30 60,54 60,74 34,42" fill="url(#${uid}_f2)"/>
    <polygon points="60,54 72,30 86,22 86,42 60,74" fill="url(#${uid}_f3)"/>
    <polygon points="86,22 102,32 102,90 86,80" fill="url(#${uid}_f4)"/>
    <polygon points="74,86 86,80 86,42 74,56" fill="#0284c7"/>
    <polygon points="74,86 86,80 102,90 90,96" fill="#9a3412"/>
  </svg>`;
}

async function renderHakkindaPage() {
  const main = document.getElementById('mainContent');
  const aktifSekme = currentHakkindaTab || 'hakkinda';
  const tarayiciKisa = (typeof navigator !== 'undefined' && navigator.userAgent)
    ? (navigator.userAgent.split(') ').pop().split(' ')[0] || navigator.userAgent)
    : 'Web Tarayıcı';
  const isletimSistemi = (typeof navigator !== 'undefined' && navigator.userAgent)
    ? (navigator.userAgent.includes('Windows') ? 'Windows (x86_64)' : navigator.userAgent.includes('Mac') ? 'macOS' : navigator.userAgent.includes('Linux') ? 'Linux' : 'Web İstemci')
    : 'Windows / Web';
  const kullaniciRol = currentDTMUser
    ? `${currentDTMUser.displayName || currentDTMUser.username || 'Kullanıcı'} (${getRoleLabel(currentDTMUser.role)})`
    : 'Standart Oturum';

  const sekmeler = [
    { id: 'hakkinda',       baslik: 'Hakkında' },
    { id: 'surum-notlari',  baslik: 'Sürüm Notları' },
    { id: 'iletisim',       baslik: 'İletişim Bilgileri' }
  ];

  const sekmeBarHtml = `
    <div style="display:flex;justify-content:center;border-bottom:1.5px solid #cbd5e1;margin-bottom:22px;gap:4px;flex-wrap:wrap">
      ${sekmeler.map(s => {
        const aktif = s.id === aktifSekme;
        return `
          <button type="button" ${dtmEventAttr('click', function(event) { hakkindaSekmeDegistir(String(s.id)); })}
            style="padding:9px 22px;font-size:13.5px;font-weight:${aktif ? '700' : '600'};color:${aktif ? '#0c4a6e' : '#475569'};background:${aktif ? '#fff' : '#f1f5f9'};border:1.5px solid ${aktif ? '#cbd5e1' : '#e2e8f0'};border-bottom:${aktif ? '2px solid #fff' : '1.5px solid #cbd5e1'};border-radius:8px 8px 0 0;margin-bottom:-1.5px;cursor:pointer;transition:all 0.15s">
            ${escHtml(s.baslik)}
          </button>`;
      }).join('')}
    </div>`;

  let icerikHtml = '';

  if (aktifSekme === 'hakkinda') {
    icerikHtml = `
      <!-- FreeCAD Tarzı Görsel Logo & Versiyon Kartı -->
      <div style="position:relative;background:linear-gradient(135deg,#f8fafc 0%,#e0f2fe 100%);border:1.5px solid #bae6fd;border-radius:14px;padding:34px 28px;margin-bottom:18px;box-shadow:inset 0 1px 0 #fff, 0 4px 14px rgba(2,132,199,0.08);overflow:hidden">
        <div style="position:absolute;inset:0;background-image:linear-gradient(to right, rgba(2,132,199,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(2,132,199,0.07) 1px, transparent 1px);background-size:28px 28px;pointer-events:none"></div>
        <div style="position:relative;display:flex;align-items:center;justify-content:center;gap:20px;flex-wrap:wrap">
          <div style="width:74px;height:74px;border-radius:18px;background:linear-gradient(135deg,#0c4a6e,#0284c7);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(2,132,199,0.28);flex-shrink:0">
            ${typeof getIcon === 'function' ? getIcon('fileText', 40) : '📄'}
          </div>
          <div style="text-align:left">
            <div style="font-size:34px;font-weight:800;color:#0c4a6e;letter-spacing:-0.5px;line-height:1.1">
              DTM <span style="font-weight:400;color:#0369a1;font-size:24px">Modülü</span>
            </div>
            <div style="font-size:13.5px;color:#334155;font-weight:600;margin-top:4px">
              Doğrudan Temin & Hakediş Yönetim Sistemi
            </div>
            <div style="font-size:15px;font-weight:700;color:#0f172a;margin-top:6px;text-align:right">
              version <span style="font-family:monospace;font-size:17px;color:#0284c7">${escHtml(APP_CURRENT_VERSION)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:center;margin-bottom:18px">
        <div ${dtmEventAttr('click', function(event) { hakkindaSekmeDegistir('iletisim'); })}
          style="display:inline-flex;align-items:center;gap:10px;padding:6px 14px 6px 8px;border-radius:999px;background:#f0f9ff;border:1.5px solid #bae6fd;cursor:pointer;transition:all 0.15s;box-shadow:0 2px 6px rgba(2,132,199,0.08)">
          ${getMerihYazilimLogoSvg(28)}
          <span style="font-size:13px;color:#0c4a6e;font-weight:700">
            Merih Yazılım © 2024–2026 • Karaman İl Özel İdaresi
          </span>
        </div>
      </div>

      <!-- Sistem & Sürüm Detay Tablosu -->
      <div style="padding:6px 10px;margin-bottom:18px">
        <table style="width:100%;font-size:13.5px;border-collapse:collapse">
          <tbody>
            <tr>
              <td style="padding:7px 8px;color:#475569;width:38%">Sürüm</td>
              <td style="padding:7px 8px;font-weight:700;color:#0f172a">${escHtml(APP_CURRENT_VERSION)}</td>
            </tr>
            <tr>
              <td style="padding:7px 8px;color:#475569">Sürüm numarası</td>
              <td style="padding:7px 8px;font-weight:600;color:#1e293b;font-family:monospace">20261028 (dtm-v139)</td>
            </tr>
            <tr>
              <td style="padding:7px 8px;color:#475569">Yayım tarihi</td>
              <td style="padding:7px 8px;font-weight:600;color:#1e293b">2026/10/26</td>
            </tr>
            <tr>
              <td style="padding:7px 8px;color:#475569">İşletim Sistemi / Ortam</td>
              <td style="padding:7px 8px;font-weight:600;color:#1e293b">${escHtml(isletimSistemi)}</td>
            </tr>
            <tr>
              <td style="padding:7px 8px;color:#475569">Mimari & Altyapı</td>
              <td style="padding:7px 8px;font-weight:600;color:#1e293b">PWA Cloud + Yerel OCR & Gemini AI</td>
            </tr>
            <tr>
              <td style="padding:7px 8px;color:#475569">Tarayıcı</td>
              <td style="padding:7px 8px;font-weight:600;color:#1e293b">${escHtml(tarayiciKisa)}</td>
            </tr>
            <tr>
              <td style="padding:7px 8px;color:#475569">Aktif Oturum</td>
              <td style="padding:7px 8px;font-weight:600;color:#0369a1">${escHtml(kullaniciRol)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Güncelleme Durumu & Aksiyon Çubuğu -->
      <div id="guncellemeDurum" style="margin-bottom:14px;padding:10px 14px;border-radius:8px;background:var(--gray-50);border:1px solid var(--gray-200);font-size:13px;color:var(--gray-600)">
        Güncelleme durumu kontrol ediliyor...
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-top:10px;border-top:1px solid #e2e8f0">
        <button type="button" ${dtmEventAttr('click', function(event) { hakkindaBilgileriKopyala(); })}
          style="padding:7px 16px;background:#f8fafc;color:#1e293b;border:1px solid #cbd5e1;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer">
          📋 Panoya Kopyala
        </button>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn btn-primary" ${dtmEventAttr('click', function(event) { guncellemeyiKontrolEt(); })} style="padding:7px 14px;font-size:12.5px">
            🔍 Güncellemeleri Denetle
          </button>
          <button type="button" id="guncellemeyiUygulaBttn" class="btn btn-success" ${dtmEventAttr('click', function(event) { uygulamaGuncelle(); })} style="display:none;padding:7px 14px;font-size:12.5px">
            🔄 Güncellemeyi Uygula
          </button>
        </div>
      </div>
    `;
  } else if (aktifSekme === 'surum-notlari') {
    icerikHtml = `
      <div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:12px;padding:18px 20px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #bae6fd">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:18px">🚀</span>
            <h3 style="margin:0;font-size:16px;font-weight:800;color:#0c4a6e">v${escHtml(APP_CURRENT_VERSION)} — Son Sürüm Notları</h3>
          </div>
          <span style="padding:3px 10px;border-radius:12px;background:#0284c7;color:#fff;font-size:11.5px;font-weight:700">Güncel Sürüm</span>
        </div>
        <ul style="margin:0;padding-left:20px;font-size:13.5px;line-height:2.05;color:#1e293b">
          <li>🌊 <strong>Yumuşak Okyanus (Çelik Mavisi) Kurumsal Tema:</strong> Veri Giriş Formu kartları, teklif tabloları ve birim fiyat kutuları göz yormayan okyanus mavisi kurumsal tasarımla yenilendi.</li>
          <li>📊 <strong>Canlı Proje Durumu & Hızlı Geçiş Çubuğu:</strong> Veri giriş formunun en üstünde 5 adımlı canlı kontrol listesi (Checklist), tek tıkla bölüme kaydırma ve tüm kartları daraltıp açma aracı eklendi.</li>
          <li>⚡ <strong>Y.M. Firmalarını Resmi Teklife Tek Tıkla Aktarma:</strong> Yaklaşık maliyette seçilen firmaları resmi teklif mektuplarına tek tuşla kopyalama özelliği eklendi.</li>
          <li>🖼️ <strong>Tam Ekran Fotoğraf Galerisi & Klavye Gezinmesi:</strong> Dokümanlar sekmesinde fotoğraflar arasında <code>←</code> <code>→</code> yön tuşlarıyla tam ekran gezinme, yakınlaştırma, döndürme ve çoklu ZIP indirme eklendi.</li>
          <li>🖨️ <strong>Fotoğraf Tutanağı / Görsel Rapor (A4 PDF):</strong> İşe ait fotoğraflardan tek tıkla kurumsal başlıklı ve imzalı A4 Fotoğraf Tutanağı üretme özelliği eklendi.</li>
          <li>📎 <strong>Proje Kartlarında Canlı Evrak Rozetleri:</strong> Projelerim ve Dokümanlar listelerinde her projenin yüklü evrak/fotoğraf sayısını gösteren özet rozetler eklendi.</li>
        </ul>
      </div>
    `;
  } else if (aktifSekme === 'iletisim') {
    icerikHtml = `
      <div style="background:linear-gradient(135deg,#071321 0%,#0c4a6e 55%,#0284c7 100%);border:1.5px solid rgba(56,189,248,0.35);border-radius:14px;padding:24px;color:#fff;margin-bottom:16px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;box-shadow:0 8px 24px rgba(2,132,199,0.22)">
        ${getMerihYazilimLogoSvg(72)}
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.4px;color:#38bdf8;font-weight:700">Geliştirici & Teknoloji Çözüm Ortağı</div>
          <div style="font-size:24px;font-weight:900;letter-spacing:0.6px;margin-top:3px">MERİH <span style="font-weight:400;color:#7dd3fc">YAZILIM</span></div>
          <div style="font-size:13px;color:#e0f2fe;margin-top:4px">Kurumsal Kamu Yazılımları & Mühendislik Otomasyon Sistemleri</div>
        </div>
      </div>

      <div style="border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff">
        <table style="width:100%;font-size:13.5px;border-collapse:collapse">
          <tbody>
            <tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:12px 16px;color:#64748b;width:36%;font-weight:600">🏢 Yazılım & Geliştirme</td>
              <td style="padding:12px 16px;font-weight:700;color:#0c4a6e">Merih Yazılım</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:12px 16px;color:#64748b;font-weight:600">🏛️ Kurum & Birim</td>
              <td style="padding:12px 16px;font-weight:600;color:#1e293b">T.C. Karaman İl Özel İdaresi — Yatırım ve İnşaat Müdürlüğü</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:12px 16px;color:#64748b;font-weight:600">🛠️ Teknik Destek</td>
              <td style="padding:12px 16px;color:#334155">Sistem içi <strong>Duyurular</strong> modülü veya Sistem Yöneticisi üzerinden Merih Yazılım destek ekibine ulaşabilirsiniz.</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;color:#64748b;font-weight:600">📜 Telif & Lisans</td>
              <td style="padding:12px 16px;color:#475569">© 2024–2026 <strong>Merih Yazılım</strong>. Kurumsal kullanım için özel olarak geliştirilmiştir.</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  main.innerHTML = `
    <div style="max-width:650px;margin:12px auto;">
      <div class="card" style="border:1.5px solid #cbd5e1;border-radius:14px;box-shadow:0 10px 30px rgba(15,23,42,0.08);overflow:hidden;background:#fff">
        <div style="padding:14px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:14.5px;color:#0f172a">
            <span style="color:#0284c7;display:inline-flex">${typeof getIcon === 'function' ? getIcon('clipboardCheck', 18) : 'ℹ️'}</span>
            <span>Hakkında — Doğrudan Temin Modülü</span>
          </div>
          <span style="font-size:12px;font-weight:700;color:#0369a1;background:#e0f2fe;padding:2px 9px;border-radius:10px">v${escHtml(APP_CURRENT_VERSION)}</span>
        </div>
        <div class="card-body" style="padding:20px 24px">
          ${sekmeBarHtml}
          ${icerikHtml}
        </div>
      </div>
    </div>`;

  if (aktifSekme === 'hakkinda') {
    guncellemeyiKontrolEt();
  } else {
    checkForUpdates(false);
  }
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
      durumEl.innerHTML = `&#9888;&#65039; <strong>Yeni sürüm mevcut: v${escHtml(latestVersion)}</strong><br><span style="font-size:12px">Mevcut sürümünüz: v${escHtml(APP_CURRENT_VERSION)}. Güncellemeyi uygulamak için butona tıklayın.</span>`;
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
