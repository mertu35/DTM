// ===================== CALCULATIONS.JS =====================

function getKalemler(proje) {
  if (!isMalVeyaHizmetTuru(proje.isTuru)) {
    return [{ ad: proje.isAdi || proje.isTuru || 'Yapım İşi', miktar: 1, birim: '***' }];
  }
  const doldurulanlar = (proje.isKalemleri || []).filter(k => k && (k.ad?.trim() || (k.miktar !== '' && k.miktar !== undefined && k.miktar !== null)));
  if (doldurulanlar.length > 0) {
    return doldurulanlar.map(k => {
      const parsed = parseFloat(k.miktar);
      return {
        ad: k.ad || proje.isAdi || 'Kalem',
        miktar: isNaN(parsed) ? 1 : parsed,
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
    const fiyat = (firma.fiyatlar && firma.fiyatlar[i]) || 0;
    const miktar = parseFloat(kalemler[i]?.miktar) || 0;
    toplam += fiyat * miktar;
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
  const miktarVal = parseFloat(kalemler[kalemIndex]?.miktar);
  const miktar = (!isNaN(miktarVal) && miktarVal >= 0) ? miktarVal : 1;
  let toplam = 0;
  let count = 0;
  for (const firma of (proje.ymFirmalar || [])) {
    const fiyat = (firma.fiyatlar && firma.fiyatlar[kalemIndex]) || 0;
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
    const fiyat = (firma.fiyatlar && firma.fiyatlar[i]) || 0;
    const miktar = parseFloat(kalemler[i]?.miktar) || 0;
    toplam += fiyat * miktar;
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
function hesaplaHakedis(proje, referans) {
  const idx = (proje.kazananFirmaIndex !== undefined && proje.kazananFirmaIndex >= 0)
    ? proje.kazananFirmaIndex
    : hesaplaKazananFirma(proje);
  if (idx < 0 || !proje.teklifFirmalar || !proje.teklifFirmalar[idx]) return null;
  const kazanan = proje.teklifFirmalar[idx];
  if (!kazanan || !kazanan.ad) return null;

  const kalemler = getKalemler(proje);
  const sozlesmeBedeli = hesaplaTeklifFirmaToplam(kazanan, kalemler);
  const fiyatFarki = parseFloat(proje.fiyatFarki) || 0;
  const toplamTutar = Math.round((sozlesmeBedeli + fiyatFarki + Number.EPSILON) * 100) / 100;
  const oncekiHakedis = parseFloat(proje.oncekiHakedisTutar) || 0;
  const buHakedis = Math.round((toplamTutar - oncekiHakedis + Number.EPSILON) * 100) / 100;
  
  const basitUsul = typeof isFirmaBasitUsul === 'function' ? isFirmaBasitUsul(kazanan.ad, referans) : false;
  const kdvOrani = basitUsul ? 0 : (parseFloat(proje.kdvOrani) || 20);
  const kdv = Math.round((buHakedis * kdvOrani / 100 + Number.EPSILON) * 100) / 100;
  const tahakkuk = Math.round((buHakedis + kdv + Number.EPSILON) * 100) / 100;

  const avans = parseFloat(proje.avansMahsubu) || 0;
  const sozlesmeDamga = parseFloat(proje.sozlesmeDamgaVergisi) || 0;
  const damgaVergisi = Math.round(((buHakedis - avans) * 0.00948 + Number.EPSILON) * 100) / 100;
  const kdvTevkifati = Math.round((kdv * 4 / 10 + Number.EPSILON) * 100) / 100;
  const sgk = parseFloat(proje.sgkKesintisi) || 0;
  const vergi = parseFloat(proje.vergiBorcu) || 0;
  const gecikme = parseFloat(proje.gecikmeCezasi) || 0;
  const fiyatFarkiTeminat = parseFloat(proje.fiyatFarkiTeminat) || 0;
  const geciciKabul = parseFloat(proje.geciciKabulNoksanlari) || 0;

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
