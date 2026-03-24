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
    onaylandi:       { label: 'Onaylandı',         bg: '#d1fae5', color: '#065f46' }
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
  btn.textContent = 'Giriş yapılıyor...';
  errDiv.style.display = 'none';
  try {
    await dtmLogin(username, password);
  } catch(e) {
    showLoginError('Kullanıcı adı veya şifre hatalı.');
    btn.disabled = false;
    btn.textContent = 'Giriş Yap';
  }
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
    // Referansı buluttan yükle
    try {
      const cloudRef = await loadReferansFromCloud();
      if (cloudRef) {
        referans = Object.assign(getDefaultReferans(), cloudRef);
      } else {
        referans = loadReferans();
        await saveReferansToCloud(referans);
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
    if (currentDTMUser.role === 'gerceklestirmeci') checkGonderilenProjeler();
    if (currentDTMUser.role === 'user') checkGeriGonderiend();
  } else {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('appLayout').style.display = 'none';
    const btn = document.getElementById('loginBtn');
    if (btn) { btn.disabled = false; btn.textContent = 'Giriş Yap'; }
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
    admin: { icon: '📁', mesaj: 'Sol menüden <strong>Onaylı Belgeler</strong> bölümüne giderek onaylanmış tüm belgeleri görüntüleyebilirsiniz.' },
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
    <div id="yeniProjeModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;display:none;align-items:center;justify-content:center">
      <div style="background:#fff;border-radius:12px;padding:32px;width:420px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.2)">
        <h3 style="margin-bottom:8px;font-size:18px;color:var(--gray-800)">📋 Yeni Proje Oluştur</h3>
        <p style="font-size:13px;color:var(--gray-500);margin-bottom:20px">Projeye bir isim verin.</p>
        <label style="font-size:13px;font-weight:600;color:var(--gray-700);display:block;margin-bottom:6px">İş / Hizmet Adı</label>
        <input id="yeniProjeAdi" type="text" placeholder="Örn: Çatı Onarım İşi" style="width:100%;padding:10px 12px;border:1px solid var(--gray-300);border-radius:6px;font-size:14px;margin-bottom:20px;box-sizing:border-box"
          onkeydown="if(event.key==='Enter')yeniProjeOlustur()">
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button onclick="document.getElementById('yeniProjeModal').style.display='none'" style="padding:8px 20px;border:1px solid var(--gray-300);background:#fff;border-radius:6px;cursor:pointer;font-size:13px">İptal</button>
          <button onclick="yeniProjeOlustur()" class="btn btn-primary" style="padding:8px 20px">Oluştur</button>
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
          <span style="font-weight:500;font-size:13px">${p.locked ? '🔒 ' : ''}${p.isAdi || '(İsimsiz)'}</span>
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
      if (m) { m.style.display = 'flex'; setTimeout(() => document.getElementById('yeniProjeAdi')?.focus(), 50); }
    }, 400);
    return;
  }
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('yeniProjeAdi')?.focus(), 100);
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

    <!-- GÖREVLİLER -->
    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>Y.M. Görevlileri</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
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
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header" onclick="toggleCard(this)">
        <h3>D.T. Görevlileri</h3>
        <span class="toggle-icon">&#9660;</span>
      </div>
      <div class="card-body">
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
        <div style="margin-top:12px; padding:12px; background:var(--primary-light); border-radius:6px;">
          <strong>Yaklaşık Maliyet: ${formatCurrency(yaklasikMaliyet)} TL</strong>
          <span style="color:var(--gray-500); margin-left:10px;">(${sayidanYaziya(yaklasikMaliyet)})</span>
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
  proje[field] = value;
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

function onFirmaChange(el, type) {
  const idx = parseInt(el.dataset.index);
  if (type === 'ym') {
    proje.ymFirmalar[idx].ad = el.value;
  } else {
    proje.teklifFirmalar[idx].ad = el.value;
  }
  autoSave();
  renderPage();
}

function onFiyatChange(el) {
  const type = el.dataset.firma;
  const fi = parseInt(el.dataset.fi);
  const ki = parseInt(el.dataset.ki);
  const val = parseFloat(el.value) || 0;
  if (type === 'ym') {
    proje.ymFirmalar[fi].fiyatlar[ki] = val;
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
              <div class="ky-proje-name">${p.isAdi || '(İsimsiz)'}</div>
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
      <button class="btn btn-primary" onclick="yazdirBelge()">&#128424; Yazdır</button>
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

function bindBelgeler() {}

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

// ===================== VERİ MERKEZİ SAYFASI =====================
function renderVeriMerkeziPage() {
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
          <button class="btn btn-outline btn-sm" onclick="const v=document.getElementById('yeniIdare').value;if(v){referans.idareList.push(v);saveReferans(referans);renderPage();}">Ekle</button>
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
          <button class="btn btn-outline btn-sm" onclick="const v=document.getElementById('yeniMudurluk').value;if(v){referans.mudurlukler.push(v);saveReferans(referans);renderPage();}">Ekle</button>
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
          <button class="btn btn-outline btn-sm" onclick="const v=document.getElementById('yeniIlce').value;if(v){referans.ilceler.push(v);saveReferans(referans);renderPage();}">Ekle</button>
        </div>
      </div>
    </div>
  `;
}

function bindVeriMerkezi() {}

function onRefChange(list, index, field, value) {
  if (typeof referans[list][index] === 'object') {
    referans[list][index][field] = value;
  } else {
    referans[list][index] = value;
  }
  saveReferans(referans);
}

function onRefDelete(list, index) {
  referans[list].splice(index, 1);
  saveReferans(referans);
  renderPage();
}

function onRefAdd(list, item) {
  referans[list].push(item);
  saveReferans(referans);
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
        <td style="font-weight:500">${p.isAdi || '(İsimsiz)'}</td>
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
              <div class="ky-proje-name">${p.isAdi || '(İsimsiz)'}</div>
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
    if (err) showToast('Dosya okunamadı: ' + err.message, 'error'); return;
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

function renderKaydetYukleStatic() {
  const aktifProjeKarti = projeAktif ? (() => {
    const cloudBtnText = '💾 Kaydet';
    const isAdi = proje.isAdi || '(İsimsiz Proje)';
    const kayitliClass = currentCloudProjeId ? 'ky-status-saved' : 'ky-status-unsaved';
    const kayitliText = currentCloudProjeId ? '☁️ Bulutta kayıtlı' : '⚠️ Kaydedilmedi';
    return `
      <!-- Mevcut Proje Kartı -->
      <div class="ky-card ky-card-project">
        <div class="ky-card-glow ky-card-glow-blue"></div>
        <div class="ky-card-top">
          <div class="ky-card-icon-wrap ky-icon-blue">💾</div>
          <div class="ky-card-label">Aktif Proje</div>
        </div>
        <div class="ky-card-project-name">${isAdi}</div>
        <div class="ky-status ${kayitliClass}">${kayitliText}</div>
        <div class="ky-card-buttons">
          <button class="ky-btn ky-btn-primary" onclick="cloudKaydet()">${cloudBtnText}</button>
          <div class="ky-btn-row">
            <button class="ky-btn ky-btn-outline" onclick="exportProjeJSON(proje)">📥 İndir</button>
            <button class="ky-btn ky-btn-ghost-danger" onclick="yeniProje()">✕ Yeni Proje</button>
          </div>
        </div>
      </div>`;
  })() : '';

  return `
    <div class="ky-top-grid">
      ${aktifProjeKarti}

      <!-- Dosyadan Yükle Kartı -->
      <div class="ky-card ky-card-upload">
        <div class="ky-card-glow ky-card-glow-green"></div>
        <div class="ky-card-top">
          <div class="ky-card-icon-wrap ky-icon-green">📁</div>
          <div class="ky-card-label">Dosyadan Yükle</div>
        </div>
        <div class="ky-upload-desc">Daha önce indirdiğiniz JSON proje dosyasını seçerek tekrar yükleyin.</div>
        <div class="ky-upload-area">
          <label class="ky-file-label" id="kyFileLabel">
            <span class="ky-file-icon">📄</span>
            <span class="ky-file-text">Dosya seçmek için tıklayın</span>
            <input type="file" id="fileInput" accept=".json" onchange="if(this.files[0]){document.getElementById('kyFileLabel').querySelector('.ky-file-text').textContent=this.files[0].name;document.getElementById('kyFileLabel').classList.add('ky-file-selected')}">
          </label>
        </div>
        <button class="ky-btn ky-btn-success" onclick="yukleProje()">📤 Yükle</button>
      </div>
    </div>
  `;
}

function renderVeriMerkeziYedek() {
  return `
    <div class="card">
      <div class="card-header" style="background:linear-gradient(135deg,#e8f4fd,#dbeafe);border-bottom:2px solid #3b82f6;">
        <h3 style="color:#1e40af;">&#128190; Veri Merkezini Yedekle</h3>
      </div>
      <div class="card-body" style="background:#f8faff;">
        <div style="display:flex;gap:24px;align-items:stretch;flex-wrap:wrap;">
          <div style="flex:1;min-width:220px;background:#fff;border:1.5px solid #3b82f6;border-radius:10px;padding:18px 22px;display:flex;flex-direction:column;gap:10px;box-shadow:0 2px 8px rgba(59,130,246,0.08);">
            <div style="font-weight:600;color:#1e40af;font-size:13px;">&#128200; Yedek Al</div>
            <div style="font-size:12px;color:#64748b;">Veri Merkezi verilerini JSON olarak bilgisayara kaydet.</div>
            <button class="btn btn-primary" onclick="exportRefJSON()" style="margin-top:auto;">Veri Merkezini Kaydet</button>
          </div>
          <div style="flex:1;min-width:220px;background:#fff;border:1.5px solid #10b981;border-radius:10px;padding:18px 22px;display:flex;flex-direction:column;gap:10px;box-shadow:0 2px 8px rgba(16,185,129,0.08);">
            <div style="font-weight:600;color:#065f46;font-size:13px;">&#128196; Yedekten Geri Yükle</div>
            <div style="font-size:12px;color:#64748b;">Daha önce kaydedilmiş verileri geri getir.</div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:auto;flex-wrap:wrap;">
              <button class="btn btn-success" id="eskiVerilerBtn" onclick="yukleReferans()" style="white-space:nowrap;" disabled>Eski Verileri Getir</button>
              <input type="file" id="refFileInput" accept=".json" style="font-size:12px;color:#475569;" onchange="document.getElementById('eskiVerilerBtn').disabled = !this.files.length;">
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindKaydetYukle() {}

async function cloudKaydet() {
  if (currentProjeBaskaKullanici) { showToast('Bu proje başka bir kullanıcıya ait.', 'warning'); return; }
  if (currentProjeKilitli) { showToast('Bu proje kilitli. Değişiklikler kaydedilemez.', 'warning'); return; }
  try {
    if (currentCloudProjeId) {
      await updateProjeInCloud(currentCloudProjeId, proje);
      // Geri gönderme notunu temizle
      await db.collection('projeler').doc(currentCloudProjeId).update({
        geriGonderNot: null,
        geriGonderAt: null,
        geriGonderBy: null
      }).catch(() => {});
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

async function belgeyeGit(projeId) {
  try {
    const doc = await getProjeFromCloud(projeId);
    proje = Object.assign(getDefaultProje(), doc.data);
    currentCloudProjeId = projeId;
    currentProjeStatus = doc.status || 'onaylandi';
    currentGerceklestirmeciBelgelerProjeId = projeId;
    currentGerceklestirmeciBelge = 'dt-onay-belgesi';
    currentPage = 'gerceklestirmeci-belgeler';
    renderPage();
  } catch(e) {
    showToast('Hata: ' + e.message, 'error');
  }
}

async function onayiKaldirClick(projeId, isAdi) {
  if (!await showConfirm(`"${isAdi}" projesinin onayı kaldırılacak.<br><br>Oluşturulan belgeler silinecek. Emin misiniz?`, 'Onayı Kaldır')) return;
  try {
    await db.collection('projeler').doc(projeId).update({
      status: 'gonderildi',
      onaylandiAt: null,
      onaylandiBy: null
    });
    currentProjeStatus = 'gonderildi';
    renderPage();
  } catch(e) {
    showToast('Hata: ' + e.message, 'error');
  }
}

async function onaylaClick(projeId, isAdi) {
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
  const not = prompt(`"${isAdi}" projesini geri gönderiyorsunuz.\n\nGeri gönderme nedeninizi yazın:`);
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
    if (err) showToast('Dosya okunamadı: ' + err.message, 'error'); return;
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

    // Geri gönderildi badge sıfırla
    const badge = document.getElementById('geriGonderBadge');
    if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }

    const bolumler = [
      { keys: ['taslak'],                    baslik: '📂 Devam Edenler',     renk: '#f9fafb', kenar: '#e5e7eb', yaziRenk: '#374151' },
      { keys: ['geri_gonderildi'],           baslik: '⏳ İşlem Bekleyenler', renk: '#fef2f2', kenar: '#fecaca', yaziRenk: '#991b1b' },
      { keys: ['gonderildi', 'onaylandi'],   baslik: '✅ Onaylananlar',       renk: '#f0fdf4', kenar: '#bbf7d0', yaziRenk: '#15803d' }
    ];

    const projeKart = (p) => {
      const tarih = p.updatedAt?.toDate ? p.updatedAt.toDate().toLocaleDateString('tr-TR') : '-';
      const isAdiSafe = (p.isAdi||'').replace(/'/g,'');
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
            ${p.isAdi || '(İsimsiz)'}
          </div>
          <div class="ky-proje-meta">
            <span class="ky-proje-date">📅 ${tarih}</span>
            ${p.atananGerceklestirmeciAd ? `<span class="ky-proje-user">👷 ${p.atananGerceklestirmeciAd}</span>` : ''}
          </div>
          ${durmBilgisi}
          ${p.status === 'geri_gonderildi' && p.geriGonderNot ? `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:7px 10px;margin-top:6px;font-size:12px;color:#991b1b">
              <strong>Not:</strong> ${p.geriGonderNot}
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
    const onaylananlar = projeler.filter(p => p.status === 'onaylandi');

    // Yeni gönderilenleri işaretle, badge sıfırla
    if (bekleyenler.length > 0) {
      const ids = bekleyenler.map(p => p.id);
      db.collection('users').doc(currentDTMUser.uid).update({
        gorulenProjeler: firebase.firestore.FieldValue.arrayUnion(...ids)
      }).catch(() => {});
      const badge = document.getElementById('gonderilenBadge');
      if (badge) badge.style.display = 'none';
    }

    const projeKart = (p, butonlar) => {
      const tarih = p.gonderildiAt?.toDate ? p.gonderildiAt.toDate().toLocaleDateString('tr-TR') :
                    p.onaylandiAt?.toDate ? p.onaylandiAt.toDate().toLocaleDateString('tr-TR') : '-';
      const isAdiSafe = (p.isAdi||'').replace(/'/g,'');
      return `<div class="ky-proje-item">
        <div class="ky-proje-info">
          <div class="ky-proje-name"><span class="ky-proje-dot"></span>${p.isAdi || '(İsimsiz)'}</div>
          <div class="ky-proje-meta">
            <span class="ky-proje-user">👤 ${p.userDisplayName || '-'}</span>
            <span class="ky-proje-date">📅 ${tarih}</span>
            ${getStatusBadge(p.status)}
          </div>
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
            <button class="ky-btn-delete" onclick="geriGonderClick('${id}', '${ad}')" style="background:#dc2626;color:#fff;border-color:#dc2626">↩ Geri Gönder</button>
          `)).join('')}</div>`;

      const oHTML = ona.length === 0
        ? `<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px">${ara ? 'Arama ile eşleşen proje yok.' : 'Henüz onaylanan proje yok.'}</div>`
        : `<div class="ky-proje-grid">${ona.map(p => projeKart(p, (id, ad) => `
            <button class="ky-btn-open" onclick="cloudProjeAc('${id}')">Aç</button>
            <button class="ky-btn-open" onclick="belgeyeGit('${id}')" style="background:#16a34a;color:#fff;border-color:#16a34a">📄 Belge Oluştur</button>
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
  const liste = referans.butceTertibiList || [];
  const rows = liste.map((bt, i) => `
    <tr>
      <td><input type="text" value="${bt}" onchange="onRefChange('butceTertibiList', ${i}, null, this.value)" style="width:100%"></td>
      <td><button class="btn btn-danger btn-sm" onclick="onRefDelete('butceTertibiList', ${i})">Sil</button></td>
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
          <thead><tr><th>Bütçe Tertibi</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:8px;display:flex;gap:6px">
          <input type="text" id="yeniBtTertibi" placeholder="Örn: 46 01 03 05 01-03" style="padding:6px 10px;border:1px solid var(--gray-300);border-radius:6px;flex:1;font-size:14px">
          <button class="btn btn-outline btn-sm" onclick="const v=document.getElementById('yeniBtTertibi').value.trim();if(v){if(!referans.butceTertibiList)referans.butceTertibiList=[];referans.butceTertibiList.push(v);saveReferans(referans);renderPage();}">+ Ekle</button>
        </div>
      </div>
    </div>
  `;
}

async function renderGerceklestirmeciBelgelerPage() {
  const main = document.getElementById('mainContent');

  // Proje seçiliyse: proje-detay veya belgeler görünümü
  if (currentGerceklestirmeciBelgelerProjeId) {
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
    const projeler = await getUserProjeler();
    const onaylananlar = projeler.filter(p => p.status === 'onaylandi');
    const listEl = document.getElementById('gerceklestirmeciBelgeList');
    if (!listEl) return;

    if (onaylananlar.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:var(--gray-400)">
          <div style="font-size:48px;margin-bottom:16px">&#128196;</div>
          <div style="font-size:15px;font-weight:600;margin-bottom:8px">Henüz onaylanan proje yok</div>
          <div style="font-size:13px">Belgeler oluşturmak için proje onaylanmalıdır.</div>
        </div>`;
      return;
    }

    listEl.innerHTML = `<div class="ky-proje-grid">
      ${onaylananlar.map(p => {
        const tarih = p.onaylandiAt?.toDate ? p.onaylandiAt.toDate().toLocaleDateString('tr-TR') : '-';
        return `<div class="ky-proje-item">
          <div class="ky-proje-info">
            <div class="ky-proje-name">${p.isAdi || '(İsimsiz)'}</div>
            <div class="ky-proje-meta">
              <span class="ky-proje-user">&#128100; ${p.userDisplayName || '-'}</span>
              <span class="ky-proje-date">&#128197; ${tarih}</span>
              ${getStatusBadge(p.status)}
            </div>
          </div>
          <div class="ky-proje-actions">
            <button class="ky-btn-open" onclick="gerceklestirmeciBelgelerProjeAc('${p.id}')">Belge Oluştur</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
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
        <p style="display:flex;align-items:center;gap:8px">${proje.isAdi || ''} ${getStatusBadge('onaylandi')}</p>
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
              ${(referans.butceTertibiList || []).map(bt => `<option value="${bt}" ${proje.butceTertibi === bt ? 'selected' : ''}>${bt}</option>`).join('')}
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
      <button onclick="currentGerceklestirmeciTab='proje-detay';renderPage();"
        style="background:none;border:1px solid var(--gray-300);border-radius:6px;padding:6px 12px;
               cursor:pointer;font-size:13px;color:var(--gray-600);white-space:nowrap;margin-top:4px">
        ← Proje Detayı
      </button>
      <div>
        <h2>📄 Belgeler</h2>
        <p style="display:flex;align-items:center;gap:8px">${proje.isAdi || ''} ${getStatusBadge('onaylandi')}</p>
      </div>
    </div>
    <div class="belge-tabs">${tabs}</div>
    <div class="action-bar">
      <button class="btn btn-primary" onclick="gerceklestirmeciBelgeYazdir()">🖨️ Yazdır</button>
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
  try {
    if (currentGerceklestirmeciBelgelerProjeId) {
      await updateProjeInCloud(currentGerceklestirmeciBelgelerProjeId, proje);
    } else {
      saveProje(proje);
    }
    showToast('Kaydedildi', 'success');
    renderPage();
  } catch(e) {
    showToast('Kayıt hatası: ' + e.message, 'error');
  }
}

async function gerceklestirmeciBelgelerProjeAc(projeId) {
  try {
    const doc = await getProjeFromCloud(projeId);
    proje = Object.assign(getDefaultProje(), doc.data);
    currentCloudProjeId = projeId;
    currentProjeStatus = doc.status || 'onaylandi';
    currentGerceklestirmeciBelgelerProjeId = projeId;
    currentGerceklestirmeciBelge = 'dt-onay-belgesi';
    currentGerceklestirmeciTab = 'proje-detay';
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
        <button onclick="currentPage='gonderilen-projeler';renderPage();" style="padding:7px 14px;border:1px solid #d1d5db;background:#fff;border-radius:7px;cursor:pointer;font-size:13px">← Geri</button>
        <div>
          <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0">${p.isAdi || '(İsimsiz Proje)'}</h2>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">${getStatusBadge('gonderildi')} Proje Özeti</div>
        </div>
      </div>

      ${kart('📋 Proje Bilgileri', `<table style="width:100%;border-collapse:collapse">
        ${satir('İdare', p.idareAdi)}
        ${satir('Müdürlük', p.mudurluk)}
        ${satir('İş / Hizmet Adı', p.isAdi)}
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

      <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px;padding-bottom:32px">
        ${currentProjeStatus === 'onaylandi' ? `
        <button onclick="onayiKaldirClick('${currentCloudProjeId}', '${(p.isAdi||'').replace(/'/g,'')}')"
          style="padding:10px 24px;background:#fff;border:1px solid #dc2626;color:#dc2626;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">
          ✕ Onayı Kaldır
        </button>` : `
        <button onclick="geriGonderClick('${currentCloudProjeId}', '${(p.isAdi||'').replace(/'/g,'')}')"
          style="padding:10px 24px;background:#fff;border:1px solid #dc2626;color:#dc2626;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">
          ↩ Geri Gönder
        </button>
        <button onclick="onaylaClick('${currentCloudProjeId}', '${(p.isAdi||'').replace(/'/g,'')}')"
          style="padding:10px 24px;background:#16a34a;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">
          ✓ Onayla
        </button>`}
      </div>
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
  main.innerHTML = `
    <div class="page-header">
      <h2>Onaylı Belgeler</h2>
      <p>Sisteme onaylanmış tüm belgeler.</p>
    </div>
    <div style="text-align:center;padding:60px;color:var(--gray-400)">
      <div style="font-size:48px;margin-bottom:16px">📁</div>
      <div style="font-size:16px;font-weight:600;margin-bottom:8px;color:var(--gray-600)">Yakında</div>
      <div style="font-size:13px">Bu özellik belge formatı tamamlandıktan sonra aktif olacak.</div>
    </div>
  `;
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
    const snap = await db.collection('projeler')
      .where('userId', '==', user.uid)
      .where('status', '==', 'geri_gonderildi').get();
    const badge = document.getElementById('geriGonderBadge');
    if (badge) {
      badge.textContent = snap.size;
      badge.style.display = snap.size > 0 ? 'inline-flex' : 'none';
    }
  } catch(e) {}
}

async function checkGonderilenProjeler() {
  try {
    const snap = await db.collection('projeler').where('status', '==', 'gonderildi').get();
    const gorulenler = (await db.collection('users').doc(currentDTMUser.uid).get()).data()?.gorulenProjeler || [];
    const yeniSayi = snap.docs.filter(d => !gorulenler.includes(d.id)).length;
    const badge = document.getElementById('gonderilenBadge');
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
              <div class="duyuru-mesaj">${d.mesaj}</div>
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
