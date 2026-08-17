// ===================== CALCULATIONS.JS =====================

function getKalemler(proje) {
  if (proje.isTuru === 'Yapım İşi') {
    return [{ ad: proje.isAdi || 'Yapım İşi', miktar: 1, birim: '***' }];
  }
  const doldurulanlar = (proje.isKalemleri || []).filter(k => k && (k.ad?.trim() || k.miktar));
  if (doldurulanlar.length > 0) {
    return doldurulanlar.map(k => ({
      ad: k.ad || proje.isAdi || 'Kalem',
      miktar: parseFloat(k.miktar) || 1,
      birim: k.birim || 'Adet'
    }));
  }
  // Eğer kullanıcı kalem girmemişse işin adını 1 Adet kalem olarak kabul et
  return [{ ad: proje.isAdi || 'Mal / Hizmet Alımı', miktar: 1, birim: 'Adet' }];
}

// Yaklaşık maliyet hesaplama
function hesaplaYMFirmaToplam(firma, kalemler) {
  let toplam = 0;
  for (let i = 0; i < kalemler.length; i++) {
    const fiyat = firma.fiyatlar[i] || 0;
    const miktar = parseFloat(kalemler[i].miktar) || 0;
    toplam += fiyat * miktar;
  }
  return toplam;
}

// Kalem bazlı ortalamaların toplamı olarak hesaplanır (hesaplaYMKalemOrtalama ile aynı yöntem),
// böylece tutanakta basılan TOPLAM satırı, kendi üstündeki kalem satırlarının toplamına eşit olur.
function hesaplaYaklasikMaliyet(proje) {
  const kalemler = getKalemler(proje);
  let toplam = 0;
  for (let i = 0; i < kalemler.length; i++) {
    toplam += hesaplaYMKalemOrtalama(proje, i);
  }
  return toplam;
}

function hesaplaYMKalemOrtalama(proje, kalemIndex) {
  const kalemler = getKalemler(proje);
  const miktar = parseFloat(kalemler[kalemIndex]?.miktar) || 1;
  let toplam = 0;
  let count = 0;
  for (const firma of proje.ymFirmalar) {
    const fiyat = firma.fiyatlar[kalemIndex] || 0;
    if (fiyat > 0) {
      toplam += fiyat * miktar;
      count++;
    }
  }
  return count > 0 ? toplam / count : 0;
}

// Teklif hesaplama
function hesaplaTeklifFirmaToplam(firma, kalemler) {
  let toplam = 0;
  for (let i = 0; i < kalemler.length; i++) {
    const fiyat = firma.fiyatlar[i] || 0;
    const miktar = parseFloat(kalemler[i].miktar) || 0;
    toplam += fiyat * miktar;
  }
  return toplam;
}

function hesaplaKazananFirma(proje) {
  const kalemler = getKalemler(proje);
  let minToplam = Infinity;
  let minIndex = -1;
  proje.teklifFirmalar.forEach((f, i) => {
    if (f.ad) {
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
  const idx = proje.kazananFirmaIndex >= 0 ? proje.kazananFirmaIndex : hesaplaKazananFirma(proje);
  if (idx < 0) return null;
  const firma = proje.teklifFirmalar[idx];
  const firmaDetay = getFirmaByAd(firma.ad, referans);
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
  const kazanan = proje.teklifFirmalar[proje.kazananFirmaIndex >= 0 ? proje.kazananFirmaIndex : hesaplaKazananFirma(proje)];
  if (!kazanan) return null;

  const kalemler = getKalemler(proje);
  const sozlesmeBedeli = hesaplaTeklifFirmaToplam(kazanan, kalemler);
  const fiyatFarki = parseFloat(proje.fiyatFarki) || 0;
  const toplamTutar = sozlesmeBedeli + fiyatFarki;
  const oncekiHakedis = parseFloat(proje.oncekiHakedisTutar) || 0;
  const buHakedis = toplamTutar - oncekiHakedis;
  
  const basitUsul = typeof isFirmaBasitUsul === 'function' ? isFirmaBasitUsul(kazanan.ad, referans) : false;
  const kdvOrani = basitUsul ? 0 : (parseFloat(proje.kdvOrani) || 20);
  const kdv = buHakedis * kdvOrani / 100;
  const tahakkuk = buHakedis + kdv;

  const avans = parseFloat(proje.avansMahsubu) || 0;
  const sozlesmeDamga = parseFloat(proje.sozlesmeDamgaVergisi) || 0;
  const damgaVergisi = (buHakedis - avans) * 0.00948;
  const kdvTevkifati = kdv * 4 / 10;
  const sgk = parseFloat(proje.sgkKesintisi) || 0;
  const vergi = parseFloat(proje.vergiBorcu) || 0;
  const gecikme = parseFloat(proje.gecikmeCezasi) || 0;
  const fiyatFarkiTeminat = parseFloat(proje.fiyatFarkiTeminat) || 0;
  const geciciKabul = parseFloat(proje.geciciKabulNoksanlari) || 0;

  const toplamKesinti = sozlesmeDamga + damgaVergisi + kdvTevkifati + sgk + vergi + gecikme + avans + fiyatFarkiTeminat + geciciKabul;
  const odenecek = tahakkuk - toplamKesinti;

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
