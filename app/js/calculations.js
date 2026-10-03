// ===================== CALCULATIONS.JS =====================

const HESAPLAMA_ALANLARI = {
  kdvOrani: 'KDV oranı', odenek: 'Ödenek', fiyatFarki: 'Fiyat farkı',
  oncekiHakedisTutar: 'Önceki hakediş tutarı', avansMahsubu: 'Avans mahsubu',
  sozlesmeDamgaVergisi: 'Sözleşme damga vergisi', sgkKesintisi: 'SGK kesintisi',
  vergiBorcu: 'Vergi borcu', gecikmeCezasi: 'Gecikme cezası',
  fiyatFarkiTeminat: 'Fiyat farkı teminatı', geciciKabulNoksanlari: 'Geçici kabul noksanları'
};

// Boş değer ile geçerli sıfırı ayır; kısmi metinleri ("20abc") sayı sayma.
function hesaplamaSayisi(value, varsayilan = 0) {
  if (value === undefined || value === null || value === '') return varsayilan;
  if (typeof value !== 'number' && typeof value !== 'string') return NaN;
  if (typeof value === 'string' && !value.trim()) return varsayilan;
  const sayi = Number(value);
  return Number.isFinite(sayi) ? sayi : NaN;
}

function paraYuvarla(value) {
  return Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;
}

function hesaplamaAlanHatasi(field, value) {
  const sayi = hesaplamaSayisi(value, field === 'kdvOrani' ? 20 : 0);
  const ad = HESAPLAMA_ALANLARI[field] || field;
  if (!Number.isFinite(sayi)) return `${ad}: geçerli bir sayı girin.`;
  if (field !== 'fiyatFarki' && sayi < 0) return `${ad}: negatif olamaz.`;
  if (field === 'kdvOrani' && sayi > 100) return 'KDV oranı: 0 ile 100 arasında olmalı.';
  return '';
}

function hesaplaKalemTutar(fiyat, miktar) {
  const f = hesaplamaSayisi(fiyat);
  const m = hesaplamaSayisi(miktar);
  return f >= 0 && m >= 0 ? paraYuvarla(f * m) : NaN;
}

function hesaplaSozlesmeVergileri(proje, referans, basitUsul = false) {
  const kazanan = getKazananFirma(proje, referans);
  const muaf = basitUsul || (kazanan && isFirmaBasitUsul(kazanan.ad, referans));
  const kdvOrani = muaf ? 0 : hesaplamaSayisi(proje.kdvOrani, 20);
  const sozlesmeBedeli = kazanan ? kazanan.toplam : 0;
  const kdv = paraYuvarla(sozlesmeBedeli * kdvOrani / 100);
  return { sozlesmeBedeli, kdvOrani, kdv, toplam: paraYuvarla(sozlesmeBedeli + kdv) };
}

// Kayıt/import yoluyla gelen veriyi de denetler; hatayı sessizce sıfıra çevirmez.
function getHesaplamaHatalari(proje, referans = getDefaultReferans(), hakedisKontrol = true) {
  const hatalar = [];
  for (const field of Object.keys(HESAPLAMA_ALANLARI)) {
    const hata = hesaplamaAlanHatasi(field, proje[field]);
    if (hata) hatalar.push(hata);
  }
  if (isMalVeyaHizmetTuru(proje.isTuru)) {
    (proje.isKalemleri || []).forEach((k, i) => {
      if (k && (!Number.isFinite(hesaplamaSayisi(k.miktar, 1)) || hesaplamaSayisi(k.miktar, 1) < 0)) {
        hatalar.push(`${i + 1}. kalem miktarı: sıfır veya pozitif bir sayı girin.`);
      }
    });
  }
  for (const [field, ad] of [['ymFirmalar', 'Y.M.'], ['teklifFirmalar', 'Teklif']]) {
    (proje[field] || []).forEach((f, i) => {
      (f.fiyatlar || []).forEach((fiyat, j) => {
        const sayi = hesaplamaSayisi(fiyat);
        if (!Number.isFinite(sayi) || sayi < 0) hatalar.push(`${ad} ${i + 1}. firma, ${j + 1}. fiyat: sıfır veya pozitif bir sayı girin.`);
      });
      if (!Number.isFinite(hesaplaTeklifFirmaToplam(f, getKalemler(proje)))) {
        hatalar.push(`${ad} ${i + 1}. firma toplamı hesaplanamıyor.`);
      }
    });
  }
  if (!hatalar.length && hakedisKontrol) {
    const hak = hesaplaHakedis(proje, referans, false);
    if (hak) {
      if (!Object.values(hak).every(Number.isFinite)) hatalar.push('Hakediş tutarları hesaplanamıyor.');
      else if (hak.toplamTutar < 0) hatalar.push('Fiyat farkı sonrası toplam tutar negatif olamaz.');
      else if (hak.buHakedis < 0) hatalar.push('Önceki hakediş tutarı, sözleşme bedeli ve fiyat farkı toplamını aşamaz.');
      else if (hak.avans > hak.buHakedis) hatalar.push('Avans mahsubu, bu hakediş tutarını aşamaz.');
      else if (hak.odenecek < 0) hatalar.push('Kesintiler toplamı tahakkuk tutarını aşıyor; ödenecek tutar negatif olamaz.');
    }
  }
  return hatalar;
}

function getKalemler(proje) {
  if (!isMalVeyaHizmetTuru(proje.isTuru)) {
    return [{ ad: proje.isAdi || proje.isTuru || 'Yapım İşi', miktar: 1, birim: '***' }];
  }
  const doldurulanlar = (proje.isKalemleri || []).filter(k => k && (k.ad?.trim() || (k.miktar !== '' && k.miktar !== undefined && k.miktar !== null)));
  if (doldurulanlar.length > 0) {
    return doldurulanlar.map(k => {
      const parsed = hesaplamaSayisi(k.miktar, 1);
      return {
        ad: k.ad || proje.isAdi || 'Kalem',
        miktar: parsed,
        birim: k.birim || 'Adet'
      };
    });
  }
  // Eğer kullanıcı kalem girmemişse işin adını 1 Adet kalem olarak kabul et
  return [{ ad: proje.isAdi || 'Mal / Hizmet Alımı', miktar: 1, birim: 'Adet' }];
}

// Yaklaşık maliyet hesaplama
function hesaplaYMFirmaToplam(firma, kalemler) {
  let toplam = 0;
  for (let i = 0; i < kalemler.length; i++) {
    toplam += hesaplaKalemTutar(firma.fiyatlar?.[i], kalemler[i]?.miktar);
  }
  return Math.round((toplam + Number.EPSILON) * 100) / 100;
}

// Kalem bazlı ortalamaların toplamı olarak hesaplanır (hesaplaYMKalemOrtalama ile aynı yöntem),
// böylece tutanakta basılan TOPLAM satırı, kendi üstündeki kalem satırlarının toplamına eşit olur.
function hesaplaYaklasikMaliyet(proje) {
  const kalemler = getKalemler(proje);
  let toplam = 0;
  for (let i = 0; i < kalemler.length; i++) {
    toplam += hesaplaYMKalemOrtalama(proje, i);
  }
  return Math.round((toplam + Number.EPSILON) * 100) / 100;
}

function hesaplaYMKalemOrtalama(proje, kalemIndex) {
  const kalemler = getKalemler(proje);
  const miktar = hesaplamaSayisi(kalemler[kalemIndex]?.miktar);
  if (!(miktar >= 0)) return NaN;
  let toplam = 0;
  let count = 0;
  for (const firma of (proje.ymFirmalar || [])) {
    const fiyat = hesaplamaSayisi(firma.fiyatlar?.[kalemIndex]);
    if (!Number.isFinite(fiyat) || fiyat < 0) return NaN;
    if (fiyat > 0) {
      toplam += fiyat * miktar;
      count++;
    }
  }
  const ort = count > 0 ? toplam / count : 0;
  return Math.round((ort + Number.EPSILON) * 100) / 100;
}

// Teklif hesaplama
function hesaplaTeklifFirmaToplam(firma, kalemler) {
  let toplam = 0;
  for (let i = 0; i < kalemler.length; i++) {
    toplam += hesaplaKalemTutar(firma.fiyatlar?.[i], kalemler[i]?.miktar);
  }
  return Math.round((toplam + Number.EPSILON) * 100) / 100;
}

function hesaplaKazananFirma(proje) {
  const kalemler = getKalemler(proje);
  let minToplam = Infinity;
  let minIndex = -1;
  (proje.teklifFirmalar || []).forEach((f, i) => {
    if (f && f.ad) {
      const toplam = hesaplaTeklifFirmaToplam(f, kalemler);
      if (toplam > 0 && toplam < minToplam) {
        minToplam = toplam;
        minIndex = i;
      }
    }
  });
  return minIndex;
}

function getKazananFirma(proje, referans) {
  const idx = (proje.kazananFirmaIndex !== undefined && proje.kazananFirmaIndex >= 0)
    ? proje.kazananFirmaIndex
    : hesaplaKazananFirma(proje);
  if (idx < 0 || !proje.teklifFirmalar || !proje.teklifFirmalar[idx]) return null;
  const firma = proje.teklifFirmalar[idx];
  if (!firma || !firma.ad) return null;
  const firmaDetay = typeof getFirmaByAd === 'function' ? getFirmaByAd(firma.ad, referans) : null;
  const kalemler = getKalemler(proje);
  return {
    ad: firma.ad,
    toplam: hesaplaTeklifFirmaToplam(firma, kalemler),
    adres: firmaDetay ? firmaDetay.adres : '',
    tel: firmaDetay ? firmaDetay.tel : '',
    tur: firmaDetay ? firmaDetay.tur : 'Kişi'
  };
}

// Hakediş hesaplama
function hesaplaHakedis(proje, referans, dogrula = true) {
  if (dogrula && getHesaplamaHatalari(proje, referans).length) return null;
  const idx = (proje.kazananFirmaIndex !== undefined && proje.kazananFirmaIndex >= 0)
    ? proje.kazananFirmaIndex
    : hesaplaKazananFirma(proje);
  if (idx < 0 || !proje.teklifFirmalar || !proje.teklifFirmalar[idx]) return null;
  const kazanan = proje.teklifFirmalar[idx];
  if (!kazanan || !kazanan.ad) return null;

  const kalemler = getKalemler(proje);
  const sozlesmeBedeli = hesaplaTeklifFirmaToplam(kazanan, kalemler);
  const fiyatFarki = paraYuvarla(hesaplamaSayisi(proje.fiyatFarki));
  const toplamTutar = Math.round((sozlesmeBedeli + fiyatFarki + Number.EPSILON) * 100) / 100;
  const oncekiHakedis = paraYuvarla(hesaplamaSayisi(proje.oncekiHakedisTutar));
  const buHakedis = Math.round((toplamTutar - oncekiHakedis + Number.EPSILON) * 100) / 100;
  
  const basitUsul = typeof isFirmaBasitUsul === 'function' ? isFirmaBasitUsul(kazanan.ad, referans) : false;
  const kdvOrani = hesaplaSozlesmeVergileri(proje, referans, basitUsul).kdvOrani;
  const kdv = Math.round((buHakedis * kdvOrani / 100 + Number.EPSILON) * 100) / 100;
  const tahakkuk = Math.round((buHakedis + kdv + Number.EPSILON) * 100) / 100;

  const avans = paraYuvarla(hesaplamaSayisi(proje.avansMahsubu));
  const sozlesmeDamga = paraYuvarla(hesaplamaSayisi(proje.sozlesmeDamgaVergisi));
  const damgaVergisi = Math.round(((buHakedis - avans) * 0.00948 + Number.EPSILON) * 100) / 100;
  const kdvTevkifati = Math.round((kdv * 4 / 10 + Number.EPSILON) * 100) / 100;
  const sgk = paraYuvarla(hesaplamaSayisi(proje.sgkKesintisi));
  const vergi = paraYuvarla(hesaplamaSayisi(proje.vergiBorcu));
  const gecikme = paraYuvarla(hesaplamaSayisi(proje.gecikmeCezasi));
  const fiyatFarkiTeminat = paraYuvarla(hesaplamaSayisi(proje.fiyatFarkiTeminat));
  const geciciKabul = paraYuvarla(hesaplamaSayisi(proje.geciciKabulNoksanlari));

  const toplamKesinti = Math.round((sozlesmeDamga + damgaVergisi + kdvTevkifati + sgk + vergi + gecikme + avans + fiyatFarkiTeminat + geciciKabul + Number.EPSILON) * 100) / 100;
  const odenecek = Math.round((tahakkuk - toplamKesinti + Number.EPSILON) * 100) / 100;

  return {
    sozlesmeBedeli,
    fiyatFarki,
    toplamTutar,
    oncekiHakedis,
    buHakedis,
    kdvOrani,
    kdv,
    tahakkuk,
    sozlesmeDamga,
    damgaVergisi,
    kdvTevkifati,
    sgk,
    vergi,
    gecikme,
    avans,
    fiyatFarkiTeminat,
    geciciKabul,
    toplamKesinti,
    odenecek
  };
}

// Aktif görevli sayısı
function getAktifGorevliler(gorevliler) {
  return gorevliler.filter(g => g.ad && g.ad.trim());
}

function getGorevliMetni(gorevliler) {
  const aktif = getAktifGorevliler(gorevliler);
  return aktif.length > 1 ? 'Görevlileri' : 'Görevlisi';
}

function getTarafMetni(gorevliler) {
  const aktif = getAktifGorevliler(gorevliler);
  return aktif.length > 1 ? 'tarafımızca' : 'tarafımca';
}
