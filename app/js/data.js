// ===================== DATA.JS =====================
// Veri modeli, localStorage, varsayılan referans verileri

const STORAGE_KEY = 'dtm_proje';
const REF_STORAGE_KEY = 'dtm_referans';
const PROJECTS_LIST_KEY = 'dtm_projeler_listesi';

function getDefaultReferans() {
  return {
    muhendisList: [
      { ad: 'Aziz AÇIKGÖZ', unvan: 'Elektrik Elektronik Mühendisi' },
      { ad: 'Erdem ÜNVER', unvan: 'İnşaat Mühendisi' },
      { ad: 'Ahmet CANBOLAT', unvan: 'Makine Mühendisi' },
      { ad: 'Şükrü BIYIKLI', unvan: 'Elektrik Elektronik Mühendisi' },
      { ad: 'İlyas ÖZKAYMAK', unvan: 'İnşaat Mühendisi' }
    ],
    onaylayanList: [
      { ad: 'Sinan ÖZYER', unvan: 'Yatırım ve İnşaat Müdür V.' },
      { ad: '', unvan: 'Genel Sekreter' },
      { ad: '', unvan: 'Genel Sekreter Yrd.' },
      { ad: '', unvan: 'Vali Yardımcısı' }
    ],
    firmaList: [
      { ad: 'Ramazan TEKİN', adres: '', tur: 'Kişi', tel: '', faks: '', eposta: '' },
      { ad: 'Alper YAMAÇ', adres: 'Abbas Mh. Dr.Mehmet Armurlu Sk. No:44/A Merkez/KARAMAN', tur: 'Kişi', tel: '0 543 360 0756', faks: '', eposta: '' },
      { ad: 'Süleyman POYRAZ', adres: 'Karaman', tur: 'Kişi', tel: '', faks: '', eposta: '' },
      { ad: 'Gültes Enerji', adres: 'Karaman', tur: 'Şirket', tel: '', faks: '', eposta: '' },
      { ad: 'İsa CEYLAN', adres: 'Karaman', tur: 'Şirket', tel: '', faks: '', eposta: '' }
    ],
    birimList: ['Adet', 'm²', 'm³', 'm', 'kg', 'ton', 'lt', 'takım', 'set', 'gün', 'ay', 'kW', 'göz', '***'],
    kdvOranlari: [1, 10, 20],
    isTurleri: ['Yapım İşi', 'Mal Alımı', 'Hizmet Alımı', 'Danışmanlık'],
    sehir: 'Karaman',
    ilceler: ['Merkez', 'Ayrancı', 'Başyayla', 'Ermenek', 'Kazımkarabekir', 'Sarıveliler'],
    mudurlukler: [
      'Yatırım ve İnşaat Müdürlüğü',
      'Plan Proje Yatırım ve İnşaat Müdürlüğü',
      'İmar ve Kentsel İyileştirme Müdürlüğü',
      'Destek Hizmetleri Müdürlüğü',
      'Encümen Müdürlüğü'
    ]
  };
}

function getDefaultProje() {
  return {
    idareAdi: 'KARAMAN İL ÖZEL İDARESİ',
    mudurluk: 'Yatırım ve İnşaat Müdürlüğü',
    isAdi: '',
    isTuru: 'Yapım İşi',
    kdvOrani: 20,
    sehir: 'Karaman',
    ilce: '',
    ymGorevliler: [{ ad: '', unvan: '' }, { ad: '', unvan: '' }, { ad: '', unvan: '' }],
    ymOnayTarihi: '',
    ymOnayNo: '',
    dtGorevliler: [{ ad: '', unvan: '' }, { ad: '', unvan: '' }, { ad: '', unvan: '' }],
    dtOnayTarihi: '',
    dtOnayNo: '',
    onaylayanAmir: { ad: '', unvan: '' },
    sozlesmeTarihi: '',
    isSuresi: '',
    fiiliBitimTarihi: '',
    isKalemleri: [
      { ad: '', miktar: '', birim: '' },
      { ad: '', miktar: '', birim: '' },
      { ad: '', miktar: '', birim: '' },
      { ad: '', miktar: '', birim: '' },
      { ad: '', miktar: '', birim: '' }
    ],
    ymFirmalar: [
      { ad: '', fiyatlar: [0, 0, 0, 0, 0] },
      { ad: '', fiyatlar: [0, 0, 0, 0, 0] },
      { ad: '', fiyatlar: [0, 0, 0, 0, 0] }
    ],
    teklifFirmalar: [
      { ad: '', fiyatlar: [0, 0, 0, 0, 0] },
      { ad: '', fiyatlar: [0, 0, 0, 0, 0] },
      { ad: '', fiyatlar: [0, 0, 0, 0, 0] }
    ],
    kazananFirmaIndex: -1,
    oncekiHakedisTutar: 0,
    fiyatFarki: 0,
    sozlesmeDamgaVergisi: 0,
    sgkKesintisi: 0,
    vergiBorcu: 0,
    gecikmeCezasi: 0,
    avansMahsubu: 0,
    fiyatFarkiTeminat: 0,
    geciciKabulNoksanlari: 0
  };
}

function saveProje(proje) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(proje));
}

function loadProje() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    return Object.assign(getDefaultProje(), parsed);
  }
  return getDefaultProje();
}

function saveReferans(ref) {
  localStorage.setItem(REF_STORAGE_KEY, JSON.stringify(ref));
}

function loadReferans() {
  const saved = localStorage.getItem(REF_STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    return Object.assign(getDefaultReferans(), parsed);
  }
  const def = getDefaultReferans();
  saveReferans(def);
  return def;
}

function getUnvanByAd(ad, referans) {
  if (!ad) return '';
  const m = referans.muhendisList.find(x => x.ad === ad);
  return m ? m.unvan : '';
}

function getFirmaByAd(ad, referans) {
  if (!ad) return null;
  return referans.firmaList.find(x => x.ad === ad) || null;
}

// Proje listesi yönetimi
function getProjeListesi() {
  const saved = localStorage.getItem(PROJECTS_LIST_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveProjeListesi(list) {
  localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(list));
}

function exportProjeJSON(proje) {
  const blob = new Blob([JSON.stringify(proje, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (proje.isAdi || 'proje') + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importProjeJSON(file, callback) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const proje = JSON.parse(e.target.result);
      callback(null, proje);
    } catch (err) {
      callback(err);
    }
  };
  reader.readAsText(file);
}
