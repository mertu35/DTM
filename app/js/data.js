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
      'Yatırım ve İnşaat Müdürlüğü'
    ],
    idareList: [
      'KARAMAN İL ÖZEL İDARESİ'
    ],
    butceTertibiList: [],
    dtSinirlari: [
      { yil: 2026, sinir: 0 },
      { yil: 2027, sinir: 0 },
      { yil: 2028, sinir: 0 }
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
    ymGorevliSayisi: 1,
    ymOnayTarihi: '',
    ymOnayNo: '',
    ymTutanakTarihiAyni: true,
    ymTutanakTarihi: '',
    dtGorevliler: [{ ad: '', unvan: '' }, { ad: '', unvan: '' }, { ad: '', unvan: '' }],
    dtGorevliSayisi: 1,
    dtOnayTarihi: '',
    dtOnayNo: '',
    dtTutanakTarihiAyni: true,
    dtTutanakTarihi: '',
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
    odenek: '',
    yatirimProjeNo: '',
    butceTertibi: '',
    isMiktari: '',
    avansVar: 'Hayır',
    fiyatFarkiVar: 'Hayır',
    sartnameVar: 'Düzenlenecek',
    sozlesmeVar: 'Düzenlenecek',
    gerceklestirmeGorevlisi: { ad: '', unvan: 'Gerçekleştirme Görevlisi' },
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

const GLOBAL_REF_FIELDS = ['onaylayanList', 'idareList', 'mudurlukler', 'ilceler', 'dtSinirlari'];
const GLOBAL_REF_KEY = 'dtm_global_referans';

function saveReferans(ref) {
  // Kullanıcıya özel alanları kaydet (global alanları hariç tut)
  const userRef = Object.assign({}, ref);
  GLOBAL_REF_FIELDS.forEach(f => delete userRef[f]);
  localStorage.setItem(REF_STORAGE_KEY, JSON.stringify(userRef));
  if (typeof saveReferansToCloud === 'function') {
    saveReferansToCloud(userRef).catch(() => {});
  }
}

function saveGlobalReferans(ref) {
  const globalData = {};
  GLOBAL_REF_FIELDS.forEach(f => { if (ref[f] !== undefined) globalData[f] = ref[f]; });
  localStorage.setItem(GLOBAL_REF_KEY, JSON.stringify(globalData));
  if (typeof saveGlobalReferansToCloud === 'function') {
    saveGlobalReferansToCloud(globalData).catch(() => {});
  }
}

function loadReferans() {
  const saved = localStorage.getItem(REF_STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    const ref = Object.assign(getDefaultReferans(), parsed);
    // Eski string formatını {no, aciklama} objesine migrate et
    if (ref.butceTertibiList) {
      ref.butceTertibiList = ref.butceTertibiList.map(bt =>
        typeof bt === 'string' ? { no: bt, aciklama: '' } : bt
      );
    }
    return ref;
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

function generateDosyaAdi() {
  const bugun = new Date();
  const tarih = bugun.getFullYear().toString() +
    String(bugun.getMonth() + 1).padStart(2, '0') +
    String(bugun.getDate()).padStart(2, '0');
  const sayacKey = 'DTM_sayac_' + tarih;
  const sayac = (parseInt(localStorage.getItem(sayacKey) || '0') + 1);
  localStorage.setItem(sayacKey, sayac);
  return 'DTM_' + tarih + '_' + String(sayac).padStart(3, '0');
}

function exportProjeJSON(proje) {
  const blob = new Blob([JSON.stringify(proje, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = generateDosyaAdi() + '.json';
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
