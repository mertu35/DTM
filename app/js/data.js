// ===================== DATA.JS =====================
// Veri modeli, localStorage, varsayılan referans verileri

const STORAGE_KEY = 'dtm_proje';
const REF_STORAGE_KEY = 'dtm_referans';
const PROJECTS_LIST_KEY = 'dtm_projeler_listesi';

// ===================== İŞ TÜRLERİ — TEK MERKEZ =====================
// Yeni bir iş türü eklemek ya da mevcut birini açmak/kapatmak için
// YALNIZCA bu liste düzenlenir. İş türü dropdown'ı, rozet renkleri,
// dashboard kategori kartları ve "Mal/Hizmet grubu mu?" kontrolü
// (Sözleşme yerine Muayene ve Kabul Tutanağı üretilmesi vb.)
// hepsi buradan beslenir.
//
//   aktif         : dropdown'da seçilebilir mi (false ise "(yakında)" olarak kilitli)
//   malVeyaHizmet : Mal/Hizmet grubundan mı (Yapım İşi'ne göre farklı belge seti)
const IS_TURLERI = [
  {
    ad: 'Yapım İşi',
    aktif: true,
    malVeyaHizmet: false,
    rozet:     { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
    dashboard: { icon: 'building', color: '#ea580c', bg: '#fff7ed' }
  },
  {
    ad: 'Onarım İşi',
    aktif: true,
    malVeyaHizmet: false,
    rozet:     { bg: '#ecfeff', color: '#155e75', border: '#a5f3fc' },
    dashboard: { icon: 'building', color: '#0e7490', bg: '#ecfeff' }
  },
  {
    ad: 'Bakım Onarım İşi',
    aktif: true,
    malVeyaHizmet: false,
    rozet:     { bg: '#fdf4ff', color: '#86198f', border: '#f5d0fe' },
    dashboard: { icon: 'building', color: '#a21caf', bg: '#fdf4ff' }
  },
  {
    ad: 'Mal Alımı',
    aktif: true,
    malVeyaHizmet: true,
    rozet:     { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
    dashboard: { icon: 'box', color: '#0284c7', bg: '#f0f9ff' }
  },
  {
    ad: 'Hizmet Alımı',
    aktif: false,
    malVeyaHizmet: true,
    rozet:     { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    dashboard: { icon: 'briefcase', color: '#16a34a', bg: '#f0fdf4' }
  },
  {
    ad: 'Danışmanlık',
    aktif: false,
    malVeyaHizmet: true,
    rozet:     { bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' },
    dashboard: { icon: 'pieChart', color: '#9333ea', bg: '#faf5ff' }
  }
];

const IS_TURU_ADLARI = IS_TURLERI.map(t => t.ad);

// Tanımı bulur; bilinmeyen bir iş türü için null döner.
function getIsTuruTanim(isTuru) {
  return IS_TURLERI.find(t => t.ad === isTuru) || null;
}

// Mal/Hizmet grubundan mı? (bilinmeyen tür → Yapım İşi gibi davranır)
function isMalVeyaHizmetTuru(isTuru) {
  const t = getIsTuruTanim(isTuru);
  return t ? t.malVeyaHizmet : false;
}

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
      { ad: 'Gökhan FİDAN', unvan: 'Yatırım ve İnşaat Müdür V.' },
      { ad: '', unvan: 'Genel Sekreter' },
      { ad: '', unvan: 'Genel Sekreter Yrd.' },
      { ad: '', unvan: 'Vali Yardımcısı' }
    ],
    firmaList: [
      { ad: 'Ramazan TEKİN', adres: '', tur: 'Kişi', tel: '', faks: '', eposta: '' },
      { ad: 'Alper YAMAÇ', adres: 'Abbas Mh. Dr.Mehmet Armurlu Sk. No:44/A Merkez/KARAMAN', tur: 'Kişi', tel: '(0) 543 360 07 56', faks: '', eposta: '' },
      { ad: 'Süleyman POYRAZ', adres: 'Karaman', tur: 'Kişi', tel: '', faks: '', eposta: '' },
      { ad: 'Gültes Enerji', adres: 'Karaman', tur: 'Şirket', tel: '', faks: '', eposta: '' },
      { ad: 'İsa CEYLAN', adres: 'Karaman', tur: 'Şirket', tel: '', faks: '', eposta: '' }
    ],
    birimList: ['Adet', 'm²', 'm³', 'm', 'kg', 'ton', 'lt', 'takım', 'set', 'gün', 'ay', 'kW', 'göz', '***'],
    kdvOranlari: [1, 10, 20],
    isTurleri: IS_TURU_ADLARI.slice(),
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
    ],
    geminiApiKey: '',
    geminiModel: 'gemini-3.8-flash'
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
    dtGorevlilerYmIleAyni: false,
    dtOnayTarihi: '',
    dtOnayNo: '',
    dtTutanakTarihiAyni: true,
    dtTutanakTarihi: '',
    onaylayanAmir: { ad: '', unvan: '' },
    sozlesmeTarihi: '',
    isSuresi: '',
    fiiliBitimTarihi: '',
    bittiEkleri: [],
    mkGorevliler: [{ ad: '', unvan: '' }, { ad: '', unvan: '' }, { ad: '', unvan: '' }],
    mkGorevliSayisi: 1,
    mkAtamaTarihi: '',
    mkAtamaSayisi: '',
    mkKabulTarihi: '',
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
    teknikSartnameMetni: '',
    sozlesmeVar: 'Düzenlenecek',
    sozlesmeOzelMaddeleri: {},
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

function normalizeProje(p) {
  // bittiEkleri eski string formatından array'e migrate et
  if (!Array.isArray(p.bittiEkleri)) {
    p.bittiEkleri = p.bittiEkleri ? [p.bittiEkleri] : [];
  }
  return p;
}

function parseProje(jsonStr) {
  return normalizeProje(JSON.parse(jsonStr));
}

function normalizeStr(s) {
  if (!s) return '';
  return s.trim()
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .replace(/Ş/g, 's').replace(/ş/g, 's')
    .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c')
    .toLowerCase()
    .replace(/\s+/g, ''); // Tüm boşlukları kaldırarak eşleşme garantisi
}

function isFirmaBasitUsul(ad, referans) {
  if (!ad || !referans) return false;
  const isim = normalizeStr(ad);
  
  const inYuklenici = (referans.yukleniciList || []).find(f => normalizeStr(f.ad) === isim);
  const inFirma = (referans.firmaList || []).find(f => normalizeStr(f.ad) === isim);
  
  if (inYuklenici && inYuklenici.basitUsul) return true;
  if (inFirma && inFirma.basitUsul) return true;
  
  return false;
}

function loadProje() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    return normalizeProje(Object.assign(getDefaultProje(), parsed));
  }
  return getDefaultProje();
}

const GLOBAL_REF_FIELDS = ['onaylayanList', 'idareList', 'mudurlukler', 'ilceler', 'dtSinirlari', 'yukleniciList', 'geminiApiKey', 'geminiModel'];
const GLOBAL_REF_KEY = 'dtm_global_referans';

function saveReferans(ref) {
  // Kullanıcıya özel alanları kaydet (global alanları hariç tut)
  const userRef = Object.assign({}, ref);
  GLOBAL_REF_FIELDS.forEach(f => delete userRef[f]);
  localStorage.setItem(REF_STORAGE_KEY, JSON.stringify(userRef));
  if (typeof saveReferansToCloud === 'function') {
    saveReferansToCloud(userRef).catch(e => {
      console.warn('[Kişisel Referans] Buluta kaydedilemedi:', e?.code, e?.message);
      if (typeof showToast === 'function') showToast('KİŞİSEL verileriniz buluta kaydedilemedi: ' + e?.message, 'error');
    });
  }
}

function saveGlobalReferans(ref) {
  const globalData = {};
  GLOBAL_REF_FIELDS.forEach(f => {
    if (f !== 'geminiApiKey' && f !== 'geminiModel' && ref[f] !== undefined) {
      globalData[f] = ref[f];
    }
  });
  localStorage.setItem(GLOBAL_REF_KEY, JSON.stringify(globalData));
  if (typeof saveGlobalReferansToCloud === 'function') {
    saveGlobalReferansToCloud(globalData).catch(e => {
      console.warn('[Global Referans] Buluta kaydedilemedi:', e?.code, e?.message);
      if (typeof showToast === 'function') showToast('GLOBAL veriler buluta kaydedilemedi: ' + e?.message, 'error');
    });
  }
}

function saveAiConfig(ref) {
  if (typeof saveAiConfigToCloud === 'function') {
    saveAiConfigToCloud({
      geminiApiKey: ref?.geminiApiKey || '',
      geminiModel: ref?.geminiModel || 'gemini-3.8-flash'
    }).catch(e => {
      console.warn('[AI Config] Buluta kaydedilemedi:', e?.code, e?.message);
      if (typeof showToast === 'function') showToast('AI ayarları buluta kaydedilemedi: ' + e?.message, 'error');
    });
  }
}

function loadReferans() {
  const saved = localStorage.getItem(REF_STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    const ref = Object.assign(getDefaultReferans(), parsed);
    // İş türleri listesi kullanıcı tarafından düzenlenmez; her zaman kod
    // içindeki güncel IS_TURLERI listesinden gelir (eski kayıtlarda saklı
    // kalmış liste yeni eklenen türleri asla göstermeyeceği için üzerine yazılır).
    ref.isTurleri = IS_TURU_ADLARI.slice();
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

// Telefon / faks numaraları "(0) 500 123 45 67" biçiminde tutulur.
function telefonUlusalHaneler(deger) {
  let r = String(deger || '').replace(/\D/g, '').replace(/^0+/, '');
  if (r.length === 12 && r.startsWith('90')) r = r.slice(2);
  return r;
}

function telefonBicimlendir(deger) {
  const r = telefonUlusalHaneler(deger);
  if (r.length !== 10) return null;
  return `(0) ${r.slice(0, 3)} ${r.slice(3, 6)} ${r.slice(6, 8)} ${r.slice(8)}`;
}

// Biçimlenemeyen eski/aktarılan değerler kaybolmasın diye olduğu gibi bırakılır.
function telefonNormalize(deger) {
  const ham = String(deger || '').trim();
  if (!/[1-9]/.test(ham)) return '';
  return telefonBicimlendir(ham) || ham;
}

function telefonGecerliMi(deger) {
  const ham = String(deger || '').trim();
  return !ham || telefonBicimlendir(ham) === ham;
}

function epostaNormalize(deger) {
  return String(deger || '').trim().toLowerCase();
}

// "ad@alan.uzantı" biçimi aranır; .com zorunlu değildir (.gov.tr, .com.tr, .org da geçerli).
function epostaGecerliMi(deger) {
  const e = String(deger || '').trim();
  return !e || /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(e);
}


const TURKIYE_ILLERI = ['Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'];

// 81 ilin ilçeleri (973 ilçe). Kaynak: turkey-neighbourhoods 4.0.3 (MIT lisansı);
// turkey-location-data 1.1.1 ile karşılaştırıldı, yalnızca 2 yazım farkı vardı.
const TURKIYE_ILCELERI = {
  "Adana": ["Aladağ", "Ceyhan", "Çukurova", "Feke", "İmamoğlu", "Karaisalı", "Karataş", "Kozan", "Pozantı", "Saimbeyli", "Sarıçam", "Seyhan", "Tufanbeyli", "Yumurtalık", "Yüreğir"],
  "Adıyaman": ["Besni", "Çelikhan", "Gerger", "Gölbaşı", "Kahta", "Merkez", "Samsat", "Sincik", "Tut"],
  "Afyonkarahisar": ["Başmakçı", "Bayat", "Bolvadin", "Çay", "Çobanlar", "Dazkırı", "Dinar", "Emirdağ", "Evciler", "Hocalar", "İhsaniye", "İscehisar", "Kızılören", "Merkez", "Sandıklı", "Sinanpaşa", "Sultandağı", "Şuhut"],
  "Ağrı": ["Diyadin", "Doğubayazıt", "Eleşkirt", "Hamur", "Merkez", "Patnos", "Taşlıçay", "Tutak"],
  "Aksaray": ["Ağaçören", "Eskil", "Gülağaç", "Güzelyurt", "Merkez", "Ortaköy", "Sarıyahşi", "Sultanhanı"],
  "Amasya": ["Göynücek", "Gümüşhacıköy", "Hamamözü", "Merkez", "Merzifon", "Suluova", "Taşova"],
  "Ankara": ["Akyurt", "Altındağ", "Ayaş", "Bala", "Beypazarı", "Çamlıdere", "Çankaya", "Çubuk", "Elmadağ", "Etimesgut", "Evren", "Gölbaşı", "Güdül", "Haymana", "Kahramankazan", "Kalecik", "Keçiören", "Kızılcahamam", "Mamak", "Nallıhan", "Polatlı", "Pursaklar", "Sincan", "Şereflikoçhisar", "Yenimahalle"],
  "Antalya": ["Akseki", "Aksu", "Alanya", "Demre", "Döşemealtı", "Elmalı", "Finike", "Gazipaşa", "Gündoğmuş", "İbradı", "Kaş", "Kemer", "Kepez", "Konyaaltı", "Korkuteli", "Kumluca", "Manavgat", "Muratpaşa", "Serik"],
  "Ardahan": ["Çıldır", "Damal", "Göle", "Hanak", "Merkez", "Posof"],
  "Artvin": ["Ardanuç", "Arhavi", "Borçka", "Hopa", "Kemalpaşa", "Merkez", "Murgul", "Şavşat", "Yusufeli"],
  "Aydın": ["Bozdoğan", "Buharkent", "Çine", "Didim", "Efeler", "Germencik", "İncirliova", "Karacasu", "Karpuzlu", "Koçarlı", "Köşk", "Kuşadası", "Kuyucak", "Nazilli", "Söke", "Sultanhisar", "Yenipazar"],
  "Balıkesir": ["Altıeylül", "Ayvalık", "Balya", "Bandırma", "Bigadiç", "Burhaniye", "Dursunbey", "Edremit", "Erdek", "Gömeç", "Gönen", "Havran", "İvrindi", "Karesi", "Kepsut", "Manyas", "Marmara", "Savaştepe", "Sındırgı", "Susurluk"],
  "Bartın": ["Amasra", "Kurucaşile", "Merkez", "Ulus"],
  "Batman": ["Beşiri", "Gercüş", "Hasankeyf", "Kozluk", "Merkez", "Sason"],
  "Bayburt": ["Aydıntepe", "Demirözü", "Merkez"],
  "Bilecik": ["Bozüyük", "Gölpazarı", "İnhisar", "Merkez", "Osmaneli", "Pazaryeri", "Söğüt", "Yenipazar"],
  "Bingöl": ["Adaklı", "Genç", "Karlıova", "Kiğı", "Merkez", "Solhan", "Yayladere", "Yedisu"],
  "Bitlis": ["Adilcevaz", "Ahlat", "Güroymak", "Hizan", "Merkez", "Mutki", "Tatvan"],
  "Bolu": ["Dörtdivan", "Gerede", "Göynük", "Kıbrıscık", "Mengen", "Merkez", "Mudurnu", "Seben", "Yeniçağa"],
  "Burdur": ["Ağlasun", "Altınyayla", "Bucak", "Çavdır", "Çeltikçi", "Gölhisar", "Karamanlı", "Kemer", "Merkez", "Tefenni", "Yeşilova"],
  "Bursa": ["Büyükorhan", "Gemlik", "Gürsu", "Harmancık", "İnegöl", "İznik", "Karacabey", "Keles", "Kestel", "Mudanya", "Mustafakemalpaşa", "Nilüfer", "Orhaneli", "Orhangazi", "Osmangazi", "Yenişehir", "Yıldırım"],
  "Çanakkale": ["Ayvacık", "Bayramiç", "Biga", "Bozcaada", "Çan", "Eceabat", "Ezine", "Gelibolu", "Gökçeada", "Lapseki", "Merkez", "Yenice"],
  "Çankırı": ["Atkaracalar", "Bayramören", "Çerkeş", "Eldivan", "Ilgaz", "Kızılırmak", "Korgun", "Kurşunlu", "Merkez", "Orta", "Şabanözü", "Yapraklı"],
  "Çorum": ["Alaca", "Bayat", "Boğazkale", "Dodurga", "İskilip", "Kargı", "Laçin", "Mecitözü", "Merkez", "Oğuzlar", "Ortaköy", "Osmancık", "Sungurlu", "Uğurludağ"],
  "Denizli": ["Acıpayam", "Babadağ", "Baklan", "Bekilli", "Beyağaç", "Bozkurt", "Buldan", "Çal", "Çameli", "Çardak", "Çivril", "Güney", "Honaz", "Kale", "Merkezefendi", "Pamukkale", "Sarayköy", "Serinhisar", "Tavas"],
  "Diyarbakır": ["Bağlar", "Bismil", "Çermik", "Çınar", "Çüngüş", "Dicle", "Eğil", "Ergani", "Hani", "Hazro", "Kayapınar", "Kocaköy", "Kulp", "Lice", "Silvan", "Sur", "Yenişehir"],
  "Düzce": ["Akçakoca", "Cumayeri", "Çilimli", "Gölyaka", "Gümüşova", "Kaynaşlı", "Merkez", "Yığılca"],
  "Edirne": ["Enez", "Havsa", "İpsala", "Keşan", "Lalapaşa", "Meriç", "Merkez", "Süloğlu", "Uzunköprü"],
  "Elazığ": ["Ağın", "Alacakaya", "Arıcak", "Baskil", "Karakoçan", "Keban", "Kovancılar", "Maden", "Merkez", "Palu", "Sivrice"],
  "Erzincan": ["Çayırlı", "İliç", "Kemah", "Kemaliye", "Merkez", "Otlukbeli", "Refahiye", "Tercan", "Üzümlü"],
  "Erzurum": ["Aşkale", "Aziziye", "Çat", "Hınıs", "Horasan", "İspir", "Karaçoban", "Karayazı", "Köprüköy", "Narman", "Oltu", "Olur", "Palandöken", "Pasinler", "Pazaryolu", "Şenkaya", "Tekman", "Tortum", "Uzundere", "Yakutiye"],
  "Eskişehir": ["Alpu", "Beylikova", "Çifteler", "Günyüzü", "Han", "İnönü", "Mahmudiye", "Mihalgazi", "Mihalıççık", "Odunpazarı", "Sarıcakaya", "Seyitgazi", "Sivrihisar", "Tepebaşı"],
  "Gaziantep": ["Araban", "İslahiye", "Karkamış", "Nizip", "Nurdağı", "Oğuzeli", "Şahinbey", "Şehitkamil", "Yavuzeli"],
  "Giresun": ["Alucra", "Bulancak", "Çamoluk", "Çanakçı", "Dereli", "Doğankent", "Espiye", "Eynesil", "Görele", "Güce", "Keşap", "Merkez", "Piraziz", "Şebinkarahisar", "Tirebolu", "Yağlıdere"],
  "Gümüşhane": ["Kelkit", "Köse", "Kürtün", "Merkez", "Şiran", "Torul"],
  "Hakkari": ["Çukurca", "Derecik", "Merkez", "Şemdinli", "Yüksekova"],
  "Hatay": ["Altınözü", "Antakya", "Arsuz", "Belen", "Defne", "Dörtyol", "Erzin", "Hassa", "İskenderun", "Kırıkhan", "Kumlu", "Payas", "Reyhanlı", "Samandağ", "Yayladağı"],
  "Iğdır": ["Aralık", "Karakoyunlu", "Merkez", "Tuzluca"],
  "Isparta": ["Aksu", "Atabey", "Eğirdir", "Gelendost", "Gönen", "Keçiborlu", "Merkez", "Senirkent", "Sütçüler", "Şarkikaraağaç", "Uluborlu", "Yalvaç", "Yenişarbademli"],
  "İstanbul": ["Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane", "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer", "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", "Tuzla", "Ümraniye", "Üsküdar", "Zeytinburnu"],
  "İzmir": ["Aliağa", "Balçova", "Bayındır", "Bayraklı", "Bergama", "Beydağ", "Bornova", "Buca", "Çeşme", "Çiğli", "Dikili", "Foça", "Gaziemir", "Güzelbahçe", "Karabağlar", "Karaburun", "Karşıyaka", "Kemalpaşa", "Kınık", "Kiraz", "Konak", "Menderes", "Menemen", "Narlıdere", "Ödemiş", "Seferihisar", "Selçuk", "Tire", "Torbalı", "Urla"],
  "Kahramanmaraş": ["Afşin", "Andırın", "Çağlayancerit", "Dulkadiroğlu", "Ekinözü", "Elbistan", "Göksun", "Nurhak", "Onikişubat", "Pazarcık", "Türkoğlu"],
  "Karabük": ["Eflani", "Eskipazar", "Merkez", "Ovacık", "Safranbolu", "Yenice"],
  "Karaman": ["Ayrancı", "Başyayla", "Ermenek", "Kazımkarabekir", "Merkez", "Sarıveliler"],
  "Kars": ["Akyaka", "Arpaçay", "Digor", "Kağızman", "Merkez", "Sarıkamış", "Selim", "Susuz"],
  "Kastamonu": ["Abana", "Ağlı", "Araç", "Azdavay", "Bozkurt", "Cide", "Çatalzeytin", "Daday", "Devrekani", "Doğanyurt", "Hanönü", "İhsangazi", "İnebolu", "Küre", "Merkez", "Pınarbaşı", "Seydiler", "Şenpazar", "Taşköprü", "Tosya"],
  "Kayseri": ["Akkışla", "Bünyan", "Develi", "Felahiye", "Hacılar", "İncesu", "Kocasinan", "Melikgazi", "Özvatan", "Pınarbaşı", "Sarıoğlan", "Sarız", "Talas", "Tomarza", "Yahyalı", "Yeşilhisar"],
  "Kırıkkale": ["Bahşılı", "Balışeyh", "Çelebi", "Delice", "Karakeçili", "Keskin", "Merkez", "Sulakyurt", "Yahşihan"],
  "Kırklareli": ["Babaeski", "Demirköy", "Kofçaz", "Lüleburgaz", "Merkez", "Pehlivanköy", "Pınarhisar", "Vize"],
  "Kırşehir": ["Akçakent", "Akpınar", "Boztepe", "Çiçekdağı", "Kaman", "Merkez", "Mucur"],
  "Kilis": ["Elbeyli", "Merkez", "Musabeyli", "Polateli"],
  "Kocaeli": ["Başiskele", "Çayırova", "Darıca", "Derince", "Dilovası", "Gebze", "Gölcük", "İzmit", "Kandıra", "Karamürsel", "Kartepe", "Körfez"],
  "Konya": ["Ahırlı", "Akören", "Akşehir", "Altınekin", "Beyşehir", "Bozkır", "Cihanbeyli", "Çeltik", "Çumra", "Derbent", "Derebucak", "Doğanhisar", "Emirgazi", "Ereğli", "Güneysınır", "Hadim", "Halkapınar", "Hüyük", "Ilgın", "Kadınhanı", "Karapınar", "Karatay", "Kulu", "Meram", "Sarayönü", "Selçuklu", "Seydişehir", "Taşkent", "Tuzlukçu", "Yalıhüyük", "Yunak"],
  "Kütahya": ["Altıntaş", "Aslanapa", "Çavdarhisar", "Domaniç", "Dumlupınar", "Emet", "Gediz", "Hisarcık", "Merkez", "Pazarlar", "Simav", "Şaphane", "Tavşanlı"],
  "Malatya": ["Akçadağ", "Arapgir", "Arguvan", "Battalgazi", "Darende", "Doğanşehir", "Doğanyol", "Hekimhan", "Kale", "Kuluncak", "Pütürge", "Yazıhan", "Yeşilyurt"],
  "Manisa": ["Ahmetli", "Akhisar", "Alaşehir", "Demirci", "Gölmarmara", "Gördes", "Kırkağaç", "Köprübaşı", "Kula", "Salihli", "Sarıgöl", "Saruhanlı", "Selendi", "Soma", "Şehzadeler", "Turgutlu", "Yunusemre"],
  "Mardin": ["Artuklu", "Dargeçit", "Derik", "Kızıltepe", "Mazıdağı", "Midyat", "Nusaybin", "Ömerli", "Savur", "Yeşilli"],
  "Mersin": ["Akdeniz", "Anamur", "Aydıncık", "Bozyazı", "Çamlıyayla", "Erdemli", "Gülnar", "Mezitli", "Mut", "Silifke", "Tarsus", "Toroslar", "Yenişehir"],
  "Muğla": ["Bodrum", "Dalaman", "Datça", "Fethiye", "Kavaklıdere", "Köyceğiz", "Marmaris", "Menteşe", "Milas", "Ortaca", "Seydikemer", "Ula", "Yatağan"],
  "Muş": ["Bulanık", "Hasköy", "Korkut", "Malazgirt", "Merkez", "Varto"],
  "Nevşehir": ["Acıgöl", "Avanos", "Derinkuyu", "Gülşehir", "Hacıbektaş", "Kozaklı", "Merkez", "Ürgüp"],
  "Niğde": ["Altunhisar", "Bor", "Çamardı", "Çiftlik", "Merkez", "Ulukışla"],
  "Ordu": ["Akkuş", "Altınordu", "Aybastı", "Çamaş", "Çatalpınar", "Çaybaşı", "Fatsa", "Gölköy", "Gülyalı", "Gürgentepe", "İkizce", "Kabadüz", "Kabataş", "Korgan", "Kumru", "Mesudiye", "Perşembe", "Ulubey", "Ünye"],
  "Osmaniye": ["Bahçe", "Düziçi", "Hasanbeyli", "Kadirli", "Merkez", "Sumbas", "Toprakkale"],
  "Rize": ["Ardeşen", "Çamlıhemşin", "Çayeli", "Derepazarı", "Fındıklı", "Güneysu", "Hemşin", "İkizdere", "İyidere", "Kalkandere", "Merkez", "Pazar"],
  "Sakarya": ["Adapazarı", "Akyazı", "Arifiye", "Erenler", "Ferizli", "Geyve", "Hendek", "Karapürçek", "Karasu", "Kaynarca", "Kocaali", "Pamukova", "Sapanca", "Serdivan", "Söğütlü", "Taraklı"],
  "Samsun": ["19 Mayıs", "Alaçam", "Asarcık", "Atakum", "Ayvacık", "Bafra", "Canik", "Çarşamba", "Havza", "İlkadım", "Kavak", "Ladik", "Salıpazarı", "Tekkeköy", "Terme", "Vezirköprü", "Yakakent"],
  "Siirt": ["Baykan", "Eruh", "Kurtalan", "Merkez", "Pervari", "Şirvan", "Tillo"],
  "Sinop": ["Ayancık", "Boyabat", "Dikmen", "Durağan", "Erfelek", "Gerze", "Merkez", "Saraydüzü", "Türkeli"],
  "Sivas": ["Akıncılar", "Altınyayla", "Divriği", "Doğanşar", "Gemerek", "Gölova", "Gürün", "Hafik", "İmranlı", "Kangal", "Koyulhisar", "Merkez", "Suşehri", "Şarkışla", "Ulaş", "Yıldızeli", "Zara"],
  "Şanlıurfa": ["Akçakale", "Birecik", "Bozova", "Ceylanpınar", "Eyyübiye", "Halfeti", "Haliliye", "Harran", "Hilvan", "Karaköprü", "Siverek", "Suruç", "Viranşehir"],
  "Şırnak": ["Beytüşşebap", "Cizre", "Güçlükonak", "İdil", "Merkez", "Silopi", "Uludere"],
  "Tekirdağ": ["Çerkezköy", "Çorlu", "Ergene", "Hayrabolu", "Kapaklı", "Malkara", "Marmaraereğlisi", "Muratlı", "Saray", "Süleymanpaşa", "Şarköy"],
  "Tokat": ["Almus", "Artova", "Başçiftlik", "Erbaa", "Merkez", "Niksar", "Pazar", "Reşadiye", "Sulusaray", "Turhal", "Yeşilyurt", "Zile"],
  "Trabzon": ["Akçaabat", "Araklı", "Arsin", "Beşikdüzü", "Çarşıbaşı", "Çaykara", "Dernekpazarı", "Düzköy", "Hayrat", "Köprübaşı", "Maçka", "Of", "Ortahisar", "Sürmene", "Şalpazarı", "Tonya", "Vakfıkebir", "Yomra"],
  "Tunceli": ["Çemişgezek", "Hozat", "Mazgirt", "Merkez", "Nazımiye", "Ovacık", "Pertek", "Pülümür"],
  "Uşak": ["Banaz", "Eşme", "Karahallı", "Merkez", "Sivaslı", "Ulubey"],
  "Van": ["Bahçesaray", "Başkale", "Çaldıran", "Çatak", "Edremit", "Erciş", "Gevaş", "Gürpınar", "İpekyolu", "Muradiye", "Özalp", "Saray", "Tuşba"],
  "Yalova": ["Altınova", "Armutlu", "Çınarcık", "Çiftlikköy", "Merkez", "Termal"],
  "Yozgat": ["Akdağmadeni", "Aydıncık", "Boğazlıyan", "Çandır", "Çayıralan", "Çekerek", "Kadışehri", "Merkez", "Saraykent", "Sarıkaya", "Sorgun", "Şefaatli", "Yenifakılı", "Yerköy"],
  "Zonguldak": ["Alaplı", "Çaycuma", "Devrek", "Ereğli", "Gökçebey", "Kilimli", "Kozlu", "Merkez"]
};

// Belgelerde basılan adres: "adres İlçe/İL". Eski kayıtlarda il/ilçe yoksa ya da
// adreste zaten yazılıysa adres aynen döner (iki kez yazılmasın).
function firmaTamAdres(f) {
  const adres = String((f && f.adres) || '').trim();
  const il = String((f && f.il) || '').trim();
  const ilce = String((f && f.ilce) || '').trim();
  if (!il && !ilce) return adres;
  const ek = [ilce, il.toLocaleUpperCase('tr-TR')].filter(Boolean).join('/');
  const sade = s => s.toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
  if (adres && sade(adres).includes(sade(ek))) return adres;
  return adres ? `${adres} ${ek}` : ek;
}
