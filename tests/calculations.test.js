/**
 * ===================== HESAPLAMA BİRİM TESTLERİ =====================
 *
 * calculations.js içindeki yaklaşık maliyet, teklif, kazanan firma ve
 * hakediş (damga vergisi, KDV tevkifatı vb.) formüllerini bilinen
 * girdi/çıktı çiftleriyle doğrular. Bu sayılar doğrudan resmi belgelere
 * basıldığı için, bir değişiklik formülü yanlışlıkla bozarsa bunu bir
 * belgede fark etmeden ÖNCE burada yakalamak amaçlanır.
 *
 * Çalıştırmak için (build aracı, kurulum gerekmez):
 *   node tests/calculations.test.js
 *
 * Her değişiklikten sonra tekrar çalıştırılabilir. Beklenen değerler elle
 * hesaplanmıştır; resmi bir örnek belge ile karşılaştırılıp doğrulanmadı —
 * yalnızca kodun kendi formülünü doğru uyguladığını garanti eder, oranların
 * (binde 9,48 damga vergisi, 4/10 KDV tevkifatı vb.) mevzuata uygunluğunu
 * değil.
 */

const fs = require('fs');
const path = require('path');

// data.js ve calculations.js tarayıcı <script> etiketi için yazılmış,
// module.exports yok — üst seviye fonksiyon tanımlarını bu dosyanın
// kapsamına almak için eval kullanıyoruz (ikisi de DOM'a dokunmuyor).
eval(fs.readFileSync(path.join(__dirname, '../app/js/data.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../app/js/calculations.js'), 'utf8'));

let sonuclar = [];
function esit(a, b, tolerans = 0.01) { return Math.abs(a - b) <= tolerans; }
function check(ad, gercek, beklenen) {
  const ok = typeof gercek === 'number' ? esit(gercek, beklenen) : gercek === beklenen;
  sonuclar.push({ ad, ok, gercek, beklenen });
}

// ============================================================
// SENARYO 1: Yapım İşi — getKalemler tek kalem üretmeli (miktar=1, birim=***)
// ============================================================
{
  const proje = { isTuru: 'Yapım İşi', isAdi: 'Okul Çatı Onarımı', isKalemleri: [] };
  const kalemler = getKalemler(proje);
  check('S1: Yapım İşi -> tek kalem sayısı', kalemler.length, 1);
  check('S1: Yapım İşi -> miktar', kalemler[0].miktar, 1);
  check('S1: Yapım İşi -> birim', kalemler[0].birim, '***');
  check('S1: Yapım İşi -> ad', kalemler[0].ad, 'Okul Çatı Onarımı');
}

// ============================================================
// SENARYO 2: Mal Alımı — kullanıcı 2 kalem girmiş, miktar/birim korunmalı
// ============================================================
{
  const proje = {
    isTuru: 'Mal Alımı', isAdi: 'Kırtasiye Alımı',
    isKalemleri: [
      { ad: 'A4 Kağıt', miktar: '50', birim: 'Paket' },
      { ad: 'Dosya', miktar: '100', birim: 'Adet' }
    ]
  };
  const kalemler = getKalemler(proje);
  check('S2: Mal Alımı -> kalem sayısı', kalemler.length, 2);
  check('S2: Mal Alımı -> 1. kalem miktar (string "50" -> number 50)', kalemler[0].miktar, 50);
  check('S2: Mal Alımı -> 1. kalem birim', kalemler[0].birim, 'Paket');
  check('S2: Mal Alımı -> 2. kalem miktar', kalemler[1].miktar, 100);
}

// ============================================================
// SENARYO 3: Yaklaşık Maliyet hesaplama — YM firmalarının kalem bazlı ORTALAMASI
// Elle hesap: Yapım İşi, tek kalem (miktar=1). 3 firma teklif vermiş:
//   Firma A: 100.000 TL, Firma B: 120.000 TL, Firma C: 110.000 TL
//   Ortalama = (100.000+120.000+110.000)/3 = 110.000 TL
// ============================================================
{
  const proje = {
    isTuru: 'Yapım İşi', isAdi: 'Test İşi', isKalemleri: [],
    ymFirmalar: [
      { ad: 'Firma A', fiyatlar: [100000] },
      { ad: 'Firma B', fiyatlar: [120000] },
      { ad: 'Firma C', fiyatlar: [110000] }
    ]
  };
  const ym = hesaplaYaklasikMaliyet(proje);
  check('S3: Yaklaşık Maliyet (3 firma ortalaması, elle: 110.000 TL)', ym, 110000);
}

// ============================================================
// SENARYO 4: Yaklaşık Maliyet — bazı firmalar 0/boş fiyat girmiş, sadece
// dolu olanların ortalaması alınmalı (elle hesap: (100.000+200.000)/2 = 150.000)
// ============================================================
{
  const proje = {
    isTuru: 'Yapım İşi', isAdi: 'Test İşi', isKalemleri: [],
    ymFirmalar: [
      { ad: 'Firma A', fiyatlar: [100000] },
      { ad: 'Firma B', fiyatlar: [0] },       // boş/0 -> sayılmamalı
      { ad: 'Firma C', fiyatlar: [200000] }
    ]
  };
  const ym = hesaplaYaklasikMaliyet(proje);
  check('S4: Yaklaşık Maliyet (0 fiyatlı firma hariç, elle: 150.000 TL)', ym, 150000);
}

// ============================================================
// SENARYO 5: Kazanan firma — en düşük teklif kazanır (elle: Firma B, 95.000 TL)
// ============================================================
{
  const kalemler = [{ ad: 'İş', miktar: 1, birim: '***' }];
  const firmaA = { ad: 'Firma A', fiyatlar: [100000] };
  const firmaB = { ad: 'Firma B', fiyatlar: [95000] };
  const firmaC = { ad: 'Firma C', fiyatlar: [98000] };
  const proje = { isTuru: 'Yapım İşi', isKalemleri: [], teklifFirmalar: [firmaA, firmaB, firmaC] };
  const kazananIdx = hesaplaKazananFirma(proje);
  check('S5: Kazanan firma indeksi (elle: Firma B = index 1)', kazananIdx, 1);
  check('S5: Kazanan firma toplamı (elle: 95.000 TL)', hesaplaTeklifFirmaToplam(firmaB, kalemler), 95000);
}

// ============================================================
// SENARYO 6: Hakediş hesaplama — TAM elle hesap
// Sözleşme bedeli: 200.000 TL (kazanan firma teklifi, 1 kalem x miktar 1)
// Fiyat farkı: 0, Önceki hakediş: 0 -> Bu hakediş (buHakedis) = 200.000 TL
// KDV oranı: %20 -> KDV = 200.000 * 0.20 = 40.000 TL
// Tahakkuk = 200.000 + 40.000 = 240.000 TL
// Kesintiler:
//   Sözleşme Damga (proje.sozlesmeDamgaVergisi elle girilmiş): 500 TL
//   Damga Vergisi (kesinti) = (buHakedis - avans) * 0.00948 = (200.000 - 0) * 0.00948 = 1.896 TL
//   KDV Tevkifatı = KDV * 4/10 = 40.000 * 0.4 = 16.000 TL
//   SGK: 0, Vergi Borcu: 0, Gecikme: 0, Avans: 0, Fiyat Farkı Teminat: 0, Geçici Kabul Noksanları: 0
// Toplam kesinti = 500 + 1.896 + 16.000 = 18.396 TL
// Ödenecek = 240.000 - 18.396 = 221.604 TL
// ============================================================
{
  const proje = {
    isTuru: 'Yapım İşi', isAdi: 'Test İşi', isKalemleri: [],
    kdvOrani: 20,
    teklifFirmalar: [{ ad: 'Kazanan Firma', fiyatlar: [200000] }],
    kazananFirmaIndex: 0,
    fiyatFarki: 0,
    oncekiHakedisTutar: 0,
    sozlesmeDamgaVergisi: 500,
    avansMahsubu: 0,
    sgkKesintisi: 0,
    vergiBorcu: 0,
    gecikmeCezasi: 0,
    fiyatFarkiTeminat: 0,
    geciciKabulNoksanlari: 0
  };
  const referans = getDefaultReferans();
  const h = hesaplaHakedis(proje, referans);
  check('S6: sözleşmeBedeli (elle: 200.000 TL)', h.sozlesmeBedeli, 200000);
  check('S6: buHakedis (elle: 200.000 TL)', h.buHakedis, 200000);
  check('S6: KDV (elle: %20 -> 40.000 TL)', h.kdv, 40000);
  check('S6: tahakkuk (elle: 240.000 TL)', h.tahakkuk, 240000);
  check('S6: damgaVergisi kesintisi (elle: 200.000 * 0,00948 = 1.896 TL)', h.damgaVergisi, 1896);
  check('S6: kdvTevkifatı (elle: 40.000 * 4/10 = 16.000 TL)', h.kdvTevkifati, 16000);
  check('S6: toplamKesinti (elle: 500 + 1.896 + 16.000 = 18.396 TL)', h.toplamKesinti, 18396);
  check('S6: ÖDENECEK TUTAR (elle: 240.000 - 18.396 = 221.604 TL)', h.odenecek, 221604);
}

// ============================================================
// SENARYO 7: Hakediş — 2. hakediş (önceki hakediş düşülmeli) + AVANS mahsubu
// Sözleşme bedeli: 200.000, Önceki hakediş: 120.000 -> buHakedis = 80.000
// Avans mahsubu: 10.000 -> damga vergisi tabanı (buHakedis - avans) = 70.000
// Damga Vergisi = 70.000 * 0,00948 = 663,60 TL
// KDV = 80.000 * 0,20 = 16.000 TL, KDV Tevkifatı = 16.000*0.4 = 6.400 TL
// Toplam kesinti = damgaVergisi(663,60) + kdvTevkifati(6.400) + avans(10.000) = 17.063,60
// Tahakkuk = 80.000 + 16.000 = 96.000
// Ödenecek = 96.000 - 17.063,60 = 78.936,40
// ============================================================
{
  const proje = {
    isTuru: 'Yapım İşi', isAdi: 'Test İşi', isKalemleri: [],
    kdvOrani: 20,
    teklifFirmalar: [{ ad: 'Kazanan Firma', fiyatlar: [200000] }],
    kazananFirmaIndex: 0,
    fiyatFarki: 0,
    oncekiHakedisTutar: 120000,
    sozlesmeDamgaVergisi: 0,
    avansMahsubu: 10000,
    sgkKesintisi: 0, vergiBorcu: 0, gecikmeCezasi: 0, fiyatFarkiTeminat: 0, geciciKabulNoksanlari: 0
  };
  const referans = getDefaultReferans();
  const h = hesaplaHakedis(proje, referans);
  check('S7: buHakedis (elle: 200.000 - 120.000 = 80.000 TL)', h.buHakedis, 80000);
  check('S7: damgaVergisi (elle: (80.000-10.000)*0,00948 = 663,60 TL)', h.damgaVergisi, 663.60);
  check('S7: KDV (elle: 80.000*0,20 = 16.000 TL)', h.kdv, 16000);
  check('S7: kdvTevkifatı (elle: 16.000*0,4 = 6.400 TL)', h.kdvTevkifati, 6400);
  check('S7: ÖDENECEK TUTAR (elle: 96.000 - 17.063,60 = 78.936,40 TL)', h.odenecek, 78936.40);
}

// ============================================================
// SENARYO 8: Basit usul firma (gerçek kişi) — KDV muaf olmalı
// ============================================================
{
  const referans = getDefaultReferans();
  referans.firmaList = [{ ad: 'Ramazan TEKİN', adres: '', tur: 'Kişi', basitUsul: true }];
  const proje = {
    isTuru: 'Yapım İşi', isAdi: 'Test İşi', isKalemleri: [],
    kdvOrani: 20,
    teklifFirmalar: [{ ad: 'Ramazan TEKİN', fiyatlar: [50000] }],
    kazananFirmaIndex: 0,
    fiyatFarki: 0, oncekiHakedisTutar: 0, sozlesmeDamgaVergisi: 0, avansMahsubu: 0,
    sgkKesintisi: 0, vergiBorcu: 0, gecikmeCezasi: 0, fiyatFarkiTeminat: 0, geciciKabulNoksanlari: 0
  };
  const h = hesaplaHakedis(proje, referans);
  check('S8: Basit usul -> kdvOrani sonucu 0 olmalı', h.kdvOrani, 0);
  check('S8: Basit usul -> KDV tutarı 0 olmalı (elle: KDV muaf)', h.kdv, 0);
  check('S8: Basit usul -> kdvTevkifatı da 0 olmalı', h.kdvTevkifati, 0);
}

// ============================================================
console.log('\n=== HESAPLAMA BİRİM TESTİ SONUÇLARI ===\n');
let fail = 0;
for (const r of sonuclar) {
  const satir = `${r.ok ? 'PASS' : 'FAIL'} - ${r.ad}` + (r.ok ? '' : `  (gerçek: ${r.gercek}, beklenen: ${r.beklenen})`);
  console.log(satir);
  if (!r.ok) fail++;
}
console.log(`\n${sonuclar.length - fail}/${sonuclar.length} geçti.`);
process.exit(fail > 0 ? 1 : 0);
