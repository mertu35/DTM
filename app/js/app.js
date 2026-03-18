// ===================== APP.JS =====================
let proje = getDefaultProje();
let referans = loadReferans();
let currentPage = 'anasayfa';
let saveTimeout = null;
let projeAktif = false;

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
  if (!confirm('Çıkış yapmak istediğinize emin misiniz?')) return;
  await dtmLogout();
}

async function onAuthReady(user) {
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
    // Admin menüyü göster
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = currentDTMUser.role === 'admin' ? '' : 'none';
    });
    // Kullanıcı bilgisi
    document.getElementById('sidebarUserName').textContent = currentDTMUser.displayName || currentDTMUser.username;
    document.getElementById('sidebarUserRole').textContent = currentDTMUser.role === 'admin' ? 'Yönetici' : 'Kullanıcı';
    // Ekranları göster/gizle
    // Her oturumda temiz başla
    proje = getDefaultProje();
    currentCloudProjeId = null;
    localStorage.removeItem(STORAGE_KEY);
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('appLayout').style.display = '';
    updateLastLogin();
    init();
  } else {
    document.getElementById('loginOverlay').style.display = '';
    document.getElementById('appLayout').style.display = 'none';
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
const PROJE_GEREKEN_SAYFALAR = ['veri-giris', 'belgeler'];

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
    case 'belgeler': main.innerHTML = renderBelgelerPage(); bindBelgeler(); break;
    case 'veri-merkezi': main.innerHTML = renderVeriMerkeziPage(); bindVeriMerkezi(); break;
    case 'dashboard': main.innerHTML = renderDashboardPage(); break;
    case 'kaydet-yukle': renderKaydetYuklePage(); break;
    case 'kullanici-yonetimi': renderKullaniciYonetimiPage(); break;
    case 'profil': main.innerHTML = renderProfilPage(); bindProfil(); break;
  }
}

// ===================== ANA SAYFA =====================
async function renderAnaSayfaPage() {
  const main = document.getElementById('mainContent');
  const ad = currentDTMUser?.displayName?.split(' ')[0] || 'Hoş Geldiniz';
  const saat = new Date().getHours();
  const selamlama = saat < 12 ? 'Günaydın' : saat < 18 ? 'İyi Günler' : 'İyi Akşamlar';

  main.innerHTML = `
    <div style="max-width:700px;margin:0 auto;padding:32px 16px">
      <div style="text-align:center;margin-bottom:40px">
        <div style="font-size:48px;margin-bottom:12px">🏛️</div>
        <h1 style="font-size:26px;font-weight:700;color:var(--gray-800);margin-bottom:6px">${selamlama}, ${ad}!</h1>
        <p style="color:var(--gray-500);font-size:14px">Doğrudan Temin Modülü'ne hoş geldiniz.</p>
      </div>

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
      </div>
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

  // Son projeleri yükle
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
          <span style="font-weight:500;font-size:13px">${p.isAdi || '(İsimsiz)'}</span>
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
  const modal = document.getElementById('yeniProjeModal');
  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('yeniProjeAdi')?.focus(), 100);
  }
}

function yeniProjeOlustur() {
  const isAdi = document.getElementById('yeniProjeAdi')?.value.trim();
  if (!isAdi) { alert('Lütfen bir proje adı girin.'); return; }
  proje = getDefaultProje();
  proje.isAdi = isAdi;
  currentCloudProjeId = null;
  document.getElementById('yeniProjeModal').style.display = 'none';
  projeAktif = true;
  currentPage = 'veri-giris';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('[data-page="veri-giris"]')?.classList.add('active');
  updateNavLock();
  renderPage();
}

function projeAcSayfasinaGit() {
  currentPage = 'kaydet-yukle';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('[data-page="kaydet-yukle"]')?.classList.add('active');
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

  return `
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
              ${referans.isTurleri.map(t => `<option value="${t}" ${proje.isTuru === t ? 'selected' : ''}>${t}</option>`).join('')}
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
  `;
}

function bindVeriGiris() {}

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

function renderBelgelerPage() {
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

  return `
    <div class="page-header">
      <h2>Belge Önizleme</h2>
      <p>Belgeyi seçin, önizleyin ve yazdırın.</p>
    </div>
    <div class="belge-tabs">${tabs}</div>
    <div class="action-bar">
      <button class="btn btn-primary" onclick="yazdirBelge()">&#128424; Yazdır</button>
    </div>
    <div class="belge-preview${['yaklasik-maliyet','teklif-tutanagi'].includes(currentBelge) ? ' landscape' : ''}">${belgeHTML}</div>
  `;
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
function renderDashboardPage() {
  const yaklasikMaliyet = hesaplaYaklasikMaliyet(proje);
  const kazananIdx = proje.kazananFirmaIndex >= 0 ? proje.kazananFirmaIndex : hesaplaKazananFirma(proje);
  const kazanan = kazananIdx >= 0 ? getKazananFirma(proje, referans) : null;
  const tasarruf = kazanan ? yaklasikMaliyet - kazanan.toplam : 0;
  const tasarrufOran = yaklasikMaliyet > 0 && kazanan ? (tasarruf / yaklasikMaliyet * 100) : 0;
  const hak = hesaplaHakedis(proje);
  const kalemler = getKalemler(proje);

  const firmaKarsilastirma = proje.teklifFirmalar.filter(f=>f.ad).map((f, i) => {
    const ymF = proje.ymFirmalar[i];
    const ymToplam = ymF ? hesaplaYMFirmaToplam(ymF, kalemler) : 0;
    const teklifToplam = hesaplaTeklifFirmaToplam(f, kalemler);
    const fark = ymToplam - teklifToplam;
    const isKazanan = i === kazananIdx;
    return `<tr style="${isKazanan ? 'background:rgba(13,159,110,0.1)' : ''}">
      <td>${i + 1}</td>
      <td>${f.ad} ${isKazanan ? '<strong>(KAZANAN)</strong>' : ''}</td>
      <td class="rakam">${formatCurrency(ymToplam)}</td>
      <td class="rakam">${formatCurrency(teklifToplam)}</td>
      <td class="rakam">${formatCurrency(fark)}</td>
      <td class="rakam">${ymToplam > 0 ? (fark/ymToplam*100).toFixed(1) + '%' : '-'}</td>
    </tr>`;
  }).join('');

  return `
    <div class="page-header">
      <h2>${proje.isAdi || 'Proje'} - Dashboard</h2>
      <p>${proje.idareAdi} - ${proje.mudurluk}</p>
    </div>

    <div class="stat-grid">
      <div class="stat-card primary">
        <div class="stat-label">Yaklaşık Maliyet</div>
        <div class="stat-value">${formatCurrencyInt(yaklasikMaliyet)} TL</div>
        <div class="stat-sub">KDV Hariç</div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">Kazanan Teklif</div>
        <div class="stat-value">${kazanan ? formatCurrencyInt(kazanan.toplam) + ' TL' : '-'}</div>
        <div class="stat-sub">${kazanan ? kazanan.ad : ''}</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">Tasarruf</div>
        <div class="stat-value">${formatCurrencyInt(tasarruf)} TL</div>
        <div class="stat-sub">%${tasarrufOran.toFixed(1)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ödenecek Tutar</div>
        <div class="stat-value">${hak ? formatCurrencyInt(hak.odenecek) + ' TL' : '-'}</div>
        <div class="stat-sub">Kesintiler sonrası</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Firma Karşılaştırması</h3></div>
      <div class="card-body">
        <table class="data-table">
          <thead>
            <tr><th>#</th><th>Firma</th><th>Y.M. Teklifi</th><th>Resmi Teklif</th><th>Fark</th><th>Fark %</th></tr>
          </thead>
          <tbody>${firmaKarsilastirma}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3>Proje Bilgileri</h3></div>
      <div class="card-body">
        <table class="data-table">
          <tbody>
            <tr><td><strong>Sözleşme Tarihi</strong></td><td>${formatDate(proje.sozlesmeTarihi)}</td></tr>
            <tr><td><strong>İş Süresi</strong></td><td>${proje.isSuresi} Takvim Günü</td></tr>
            <tr><td><strong>Bitiş Tarihi</strong></td><td>${formatDate(proje.fiiliBitimTarihi || calculateEndDate(proje.sozlesmeTarihi, proje.isSuresi))}</td></tr>
            <tr><td><strong>Y.M. Onay</strong></td><td>${formatDate(proje.ymOnayTarihi)} / Sayi: ${proje.ymOnayNo}</td></tr>
            <tr><td><strong>D.T. Onay</strong></td><td>${formatDate(proje.dtOnayTarihi)} / Sayi: ${proje.dtOnayNo}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ===================== KAYDET / YÜKLE SAYFASI =====================
let currentCloudProjeId = null; // Açık olan cloud proje ID'si

async function renderKaydetYuklePage() {
  const main = document.getElementById('mainContent');
  // İlk render - loading göster
  main.innerHTML = `
    <div class="ky-page">
      <div class="ky-page-header">
        <div class="ky-page-header-icon">💾</div>
        <div>
          <h2>Kaydet / Yükle</h2>
          <p>Projeleri buluta kaydedin veya yerel dosya olarak yönetin</p>
        </div>
      </div>

      ${renderKaydetYukleStatic()}

      <div class="ky-projeler-card">
        <div class="ky-projeler-header">
          <div class="ky-projeler-header-left">
            <span class="ky-projeler-icon">☁️</span>
            <h3>Projelerim</h3>
            ${currentDTMUser?.role === 'admin' ? '<span class="ky-admin-badge">Tüm kullanıcılar</span>' : ''}
          </div>
        </div>
        <div class="ky-projeler-body" id="projelerListBody">
          <div class="ky-loading">
            <div class="ky-loading-spinner"></div>
            <span>Projeler yükleniyor...</span>
          </div>
        </div>
      </div>
    </div>
  `;
  // Projeleri yükle
  try {
    const projeler = await getUserProjeler();
    const projeListHTML = projeler.length === 0
      ? `<div class="ky-empty-state">
           <div class="ky-empty-icon">📂</div>
           <div class="ky-empty-title">Henüz buluta kayıtlı proje yok</div>
           <div class="ky-empty-desc">Yukarıdaki "Buluta Kaydet" butonu ile ilk projenizi kaydedin.</div>
         </div>`
      : `<div class="ky-proje-grid">
          ${projeler.map(p => {
            const tarih = p.updatedAt?.toDate ? p.updatedAt.toDate().toLocaleDateString('tr-TR') : '-';
            const aktif = p.id === currentCloudProjeId;
            return `<div class="ky-proje-item ${aktif ? 'ky-proje-aktif' : ''}">
              <div class="ky-proje-info">
                <div class="ky-proje-name">
                  ${aktif ? '<span class="ky-aktif-dot"></span>' : '<span class="ky-proje-dot"></span>'}
                  ${p.isAdi || '(İsimsiz)'}
                </div>
                <div class="ky-proje-meta">
                  ${currentDTMUser?.role === 'admin' ? `<span class="ky-proje-user">👤 ${p.userDisplayName || '-'}</span>` : ''}
                  <span class="ky-proje-date">📅 ${tarih}</span>
                  ${aktif ? '<span class="ky-aktif-badge">Aktif</span>' : ''}
                </div>
              </div>
              <div class="ky-proje-actions">
                <button class="ky-btn-open" onclick="cloudProjeAc('${p.id}')" title="Projeyi Aç">Aç</button>
                <button class="ky-btn-delete" onclick="cloudProjeSil('${p.id}', '${(p.isAdi||'').replace(/'/g,'')}' )" title="Projeyi Sil">Sil</button>
              </div>
            </div>`;
          }).join('')}
        </div>`;
    document.getElementById('projelerListBody').innerHTML = projeListHTML;
  } catch(e) {
    document.getElementById('projelerListBody').innerHTML =
      `<div class="ky-error">Projeler yüklenemedi: ${e.message}</div>`;
  }
}

function renderKaydetYukleStatic() {
  if (!projeAktif) return ''; // Aktif proje yoksa Mevcut Proje kartını gizle
  const cloudBtnText = currentCloudProjeId ? '☁️ Güncelle' : '☁️ Buluta Kaydet';
  const isAdi = proje.isAdi || '(İsimsiz Proje)';
  const kayitliClass = currentCloudProjeId ? 'ky-status-saved' : 'ky-status-unsaved';
  const kayitliText = currentCloudProjeId ? '☁️ Bulutta kayıtlı' : '⚠️ Kaydedilmedi';

  return `
    <div class="ky-top-grid">

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
      </div>

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
  try {
    if (currentCloudProjeId) {
      await updateProjeInCloud(currentCloudProjeId, proje);
      alert('✓ Proje buluta güncellendi!');
    } else {
      currentCloudProjeId = await saveProjeToCloud(proje);
      alert('✓ Proje buluta kaydedildi!');
    }
    renderPage();
  } catch(e) {
    alert('Hata: ' + e.message);
  }
}

async function cloudProjeAc(projeId) {
  try {
    const doc = await getProjeFromCloud(projeId);
    proje = Object.assign(getDefaultProje(), doc.data);
    currentCloudProjeId = projeId;
    saveProje(proje);
    projeAktif = true;
    currentPage = 'veri-giris';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-page="veri-giris"]').classList.add('active');
    updateNavLock();
    renderPage();
  } catch(e) {
    alert('Hata: ' + e.message);
  }
}

async function cloudProjeSil(projeId, isAdi) {
  if (!confirm(`"${isAdi}" projesi silinecek. Emin misiniz?`)) return;
  try {
    await deleteProjeFromCloud(projeId);
    if (currentCloudProjeId === projeId) currentCloudProjeId = null;
    renderPage();
  } catch(e) {
    alert('Hata: ' + e.message);
  }
}

function yeniProje() {
  if (!confirm('Mevcut proje silinecek. Emin misiniz?')) return;
  localStorage.removeItem(STORAGE_KEY);
  proje = getDefaultProje();
  currentCloudProjeId = null;
  renderPage();
}

function yukleProje() {
  const input = document.getElementById('fileInput');
  if (!input.files.length) return alert('Dosya seçin.');
  importProjeJSON(input.files[0], (err, data) => {
    if (err) return alert('Dosya okunamadı: ' + err.message);
    proje = Object.assign(getDefaultProje(), data);
    saveProje(proje);
    alert('Proje yüklendi!');
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
  if (!input.files.length) return alert('Dosya seçin.');
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      referans = Object.assign(getDefaultReferans(), JSON.parse(e.target.result));
      saveReferans(referans);
      alert('Referans verileri yüklendi!');
      renderPage();
    } catch(err) {
      alert('Dosya okunamadı: ' + err.message);
    }
  };
  reader.readAsText(input.files[0]);
}

// ===================== KULLANICI YÖNETİMİ (ADMIN) =====================
async function renderKullaniciYonetimiPage() {
  const main = document.getElementById('mainContent');
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
                <option value="admin">Yönetici</option>
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
                  <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}</span></td>
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

async function kullaniciSil(uid, ad) {
  if (!confirm(`"${ad}" kullanıcısı silinecek. Emin misiniz?`)) return;
  try {
    await db.collection('users').doc(uid).delete();
    renderKullaniciYonetimiPage();
  } catch(e) {
    alert('Hata: ' + e.message);
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
      <div style="background:linear-gradient(135deg,#1a40a3,#1a56db);border-radius:16px;padding:28px;color:#fff;margin-bottom:20px;position:relative;overflow:hidden">
        <div style="position:absolute;top:-40px;right:-40px;width:150px;height:150px;background:rgba(255,255,255,0.06);border-radius:50%"></div>
        <div style="display:flex;align-items:center;gap:20px">
          <div style="width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">&#128100;</div>
          <div>
            <div style="font-size:22px;font-weight:700">${u.displayName || '-'}</div>
            <div style="font-size:14px;opacity:0.8;margin-top:4px">@${u.username || '-'}</div>
            <div style="margin-top:8px">
              <span style="background:rgba(255,255,255,0.2);font-size:11px;font-weight:600;padding:3px 12px;border-radius:20px">
                ${u.role === 'admin' ? '⭐ Yönetici' : '👤 Kullanıcı'}
              </span>
            </div>
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
              <tr><td style="color:var(--gray-500)">Rol</td><td>${u.role === 'admin' ? '⭐ Yönetici' : '👤 Kullanıcı'}</td></tr>
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
