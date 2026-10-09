// node tests/olur-parse.test.js — Olur document extraction and dropdown matching tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appJsSource = fs.readFileSync(path.join(__dirname, '../app/js/app.js'), 'utf8');

// Test ortamı için minimal context
const sandbox = {
  console,
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  },
  referans: {
    muhendisList: [
      { ad: 'Aziz AÇIKGÖZ', unvan: 'Elektrik Elektronik Mühendisi' },
      { ad: 'Erdem ÜNVER', unvan: 'İnşaat Mühendisi' },
      { ad: 'Ahmet CANBOLAT', unvan: 'Makine Mühendisi' }
    ],
    onaylayanList: [
      { ad: 'Sinan ÖZYER', unvan: 'Yatırım ve İnşaat Müdür V.' },
      { ad: '', unvan: 'Genel Sekreter' }
    ],
    firmaList: [
      { ad: 'Alper YAMAÇ', adres: 'Abbas Mh. No:44', tur: 'Kişi', tel: '05433600756', faks: '', eposta: '', vkn: '1111111111' },
      { ad: 'Gültes Enerji', adres: 'Karaman', tur: 'Şirket', tel: '', faks: '', eposta: '', vkn: '2222222222' }
    ]
  },
  saveReferans(ref) {
    sandbox.referans = ref;
  }
};

const context = vm.createContext(sandbox);

// data.js ve calculations.js içerisindeki modelleri yükle
const dataJsSource = fs.readFileSync(path.join(__dirname, '../app/js/data.js'), 'utf8');
const calcJsSource = fs.readFileSync(path.join(__dirname, '../app/js/calculations.js'), 'utf8');
vm.runInContext(dataJsSource, context);
vm.runInContext(calcJsSource, context);
context.saveReferans = function(ref) { sandbox.referans = ref; };

// app.js içerisindeki yardımcı fonksiyonları yükle
const fnSnippets = [
  appJsSource.slice(appJsSource.indexOf('function dtmNormalizeTurkish('), appJsSource.indexOf('async function parseDTOluru('))
];
vm.runInContext(fnSnippets.join('\n'), context);

// 1. dtmNormalizeTurkish testleri
assert.equal(context.dtmNormalizeTurkish('Aziz AÇIKGÖZ'), context.dtmNormalizeTurkish('AZİZ AÇIKGÖZ'));
assert.equal(context.dtmNormalizeTurkish('Gökhan FİDAN'), context.dtmNormalizeTurkish('GOKHAN FIDAN'));
assert.equal(context.dtmNormalizeTurkish('Sinan ÖZYER'), context.dtmNormalizeTurkish('sinan özyer'));
console.log('PASS: dtmNormalizeTurkish case and Turkish character normalization');

// 2. YM Olur Belgesi Analizi (satır atlamalı görevli ve OLUR amiri)
const ymText = `T.C.
KARAMAN İL ÖZEL İDARESİ
Yatırım ve İnşaat Müdürlüğü

Sayı : E-69402670-750-85158 01.09.2026
Konu : Yaklaşık Maliyet Görevlisi

YATIRIM VE İNŞAAT MÜDÜRLÜĞÜNE

"Karaman İl Özel İdaresi Jeneratör Bakım İşi" için yaklaşık maliyet görevlisi olarak Elektrik ve
Elektronik Mühendisi Aziz AÇIKGÖZ'ün görevlendirilmesi hususunu;
"OLUR" emirlerinize arz ederim.

Dilek YILDIZ
Gerçekleştirme Görevlisi

OLUR
Gökhan FİDAN
Yatırım ve İnşaat Müdür V.`;

const ymRes = context.belgeyiAnaliz(ymText);
assert.equal(ymRes.isYM, true);
assert.equal(ymRes.isDT, false);
assert.equal(ymRes.isAdi, 'Karaman İl Özel İdaresi Jeneratör Bakım İşi');
assert.equal(ymRes.onayNo, '85158');
assert.equal(ymRes.onayTarihi, '2026-09-01');
assert.equal(ymRes.gorevliAd, 'Aziz AÇIKGÖZ');
assert.equal(ymRes.gorevliUnvan, 'Elektrik ve Elektronik Mühendisi');
assert.equal(ymRes.onaylayanAd, 'Gökhan FİDAN');
assert.equal(ymRes.onaylayanUnvan, 'Yatırım ve İnşaat Müdür V.');
console.log('PASS: YM Olur document fields accurately parsed');

// 3. DT Olur Belgesi Analizi
const dtText = `YATIRIM VE İNŞAAT MÜDÜRLÜĞÜNE
İdaremizce doğrudan temin yoluyla yapılacak olan "Bayır Köyü İlkokulu Elektrik Onarım İşi" ile ilgili
doğrudan temin onay belgesi ekte sunulmuş olup, adı geçen işle ilgili Elektrik Elektronik Mühendisi Aziz
AÇIKGÖZ'ün doğrudan temin işlemleri için görevlendirilmesi hususunda;
"OLUR" emirlerinize arz ederim.
T.C.
KARAMAN İL ÖZEL İDARESİ
Sayı : E-69402670-755.99-79656 08.04.2026
Konu : Doğrudan Temin Onay Belgesi
OLUR
Sinan ÖZYER
Yatırım ve İnşaat Müdür V.`;

const dtRes = context.belgeyiAnaliz(dtText);
assert.equal(dtRes.isDT, true);
assert.equal(dtRes.isAdi, 'Bayır Köyü İlkokulu Elektrik Onarım İşi');
assert.equal(dtRes.onayNo, '79656');
assert.equal(dtRes.onayTarihi, '2026-04-08');
assert.equal(dtRes.gorevliAd, 'Aziz AÇIKGÖZ');
assert.equal(dtRes.onaylayanAd, 'Sinan ÖZYER');
assert.equal(dtRes.onaylayanUnvan, 'Yatırım ve İnşaat Müdür V.');
console.log('PASS: DT Olur document fields accurately parsed');

// 4. matchOrAddGorevli testleri
// Mevcut görevli (büyük-küçük harf farkı olsa dahi referans listesindeki kanonik ismi döndürmeli)
const mMatch = context.matchOrAddGorevli('aziz açıkgöz', 'Elektrik Mühendisi');
assert.equal(mMatch.ad, 'Aziz AÇIKGÖZ');

// Yeni görevli (listeye eklenmeli ve sıralanmalı)
const yMatch = context.matchOrAddGorevli('Büşra ÇELİK', 'Harita Mühendisi');
assert.equal(yMatch.ad, 'Büşra ÇELİK');
assert.ok(context.referans.muhendisList.some(m => m.ad === 'Büşra ÇELİK'));
console.log('PASS: matchOrAddGorevli existing & new personnel matching');

// 5. matchOrAddOnaylayanAmir testleri
// Mevcut amir
const amirMatch = context.matchOrAddOnaylayanAmir('sinan özyer', 'Müdür');
assert.equal(amirMatch.ad, 'Sinan ÖZYER');

// Yeni amir (Gökhan FİDAN listeye otomatik eklenmeli)
const yeniAmir = context.matchOrAddOnaylayanAmir('Gökhan FİDAN', 'Yatırım ve İnşaat Müdür V.');
assert.equal(yeniAmir.ad, 'Gökhan FİDAN');
assert.ok(context.referans.onaylayanList.some(o => o.ad === 'Gökhan FİDAN'));
console.log('PASS: matchOrAddOnaylayanAmir auto-add and match');

// 6. Sızan tırnak veya bağlam kelimesi içeren fotoğraf OCR metni testi
const photoLeakyText = `YATIRIM VE İNŞAAT MÜDÜRLÜĞÜNE
"Karaman İl Özel İdaresi Jeneratör Bakım İşi' için yaklaşık maliyet görevlisi olarak Elektrik ve
Elektronik Mühendisi Aziz AÇIKGÖZ'ün görevlendirilmesi hususunu;
"OLUR" emirlerinize arz ederim.
OLUR Gökhan FİDAN Yatırım ve İnşaat Müdür V.`;
const leakyRes = context.belgeyiAnaliz(photoLeakyText);
assert.equal(leakyRes.isAdi, 'Karaman İl Özel İdaresi Jeneratör Bakım İşi');
console.log('PASS: Leaky quote / context trailing phrases properly cut off');

// 7. Gemini AI Yanıtı Normalizasyonu ve GLOBAL_REF_FIELDS Kontrolü
assert.ok(dataJsSource.includes("'geminiApiKey'"), 'geminiApiKey must be in GLOBAL_REF_FIELDS');
assert.ok(dataJsSource.includes("'geminiModel'"), 'geminiModel must be in GLOBAL_REF_FIELDS');

// Markdown kod bloğuyla sarılmış Gemini yanıtını temizleme simülasyonu
const rawGeminiResponse = '```json\n{\n  "isAdi": "Karaman İl Özel İdaresi Jeneratör Bakım İşi",\n  "isYM": true,\n  "isDT": false,\n  "onayNo": "61019",\n  "onayTarihi": "24.09.2026",\n  "gorevliAd": "Aziz AÇIKGÖZ",\n  "gorevliUnvan": "Elektrik Elektronik Mühendisi",\n  "onaylayanAd": "Gökhan FİDAN",\n  "onaylayanUnvan": "Yatırım ve İnşaat Müdür V."\n}\n```';
let cleaned = rawGeminiResponse.trim().replace(/^```json\s*/, '').replace(/```\s*$/, '');
const parsedAi = JSON.parse(cleaned);
if (parsedAi.onayTarihi && typeof parsedAi.onayTarihi === 'string') {
  const dMatch = parsedAi.onayTarihi.match(/^(\d{2})[\.\/](\d{2})[\.\/](\d{4})$/);
  if (dMatch) parsedAi.onayTarihi = `${dMatch[3]}-${dMatch[2]}-${dMatch[1]}`;
}
assert.equal(parsedAi.isAdi, 'Karaman İl Özel İdaresi Jeneratör Bakım İşi');
assert.equal(parsedAi.onayTarihi, '2026-09-24');
assert.equal(parsedAi.gorevliAd, 'Aziz AÇIKGÖZ');
assert.equal(parsedAi.onaylayanAd, 'Gökhan FİDAN');
console.log('PASS: Gemini AI response cleaning, date normalization & global referans integration');

// 8. matchOrAddFirma testleri
// a. Mevcut firma isimle eşleşmeli (büyük/küçük harf duyarsız)
const fMatch1 = context.matchOrAddFirma('alper yamac');
assert.equal(fMatch1.isNew, false);
assert.equal(fMatch1.firma.ad, 'Alper YAMAÇ');

// b. Mevcut firma VKN ile eşleşmeli ve eksik adres/tel zenginleştirilmeli
const fMatch2 = context.matchOrAddFirma({
  ad: 'Gültes Enerji Elektrik Ltd.',
  vkn: '2222222222',
  adres: 'Yeni Sanayi Sitesi No:12 Karaman',
  tel: '0338 212 00 00'
});
assert.equal(fMatch2.isNew, false);
assert.equal(fMatch2.firma.ad, 'Gültes Enerji');
assert.equal(fMatch2.firma.adres, 'Yeni Sanayi Sitesi No:12 Karaman');
assert.equal(fMatch2.firma.tel, '0338 212 00 00');

// c. Yeni kurumsal firma ekleme ('Şirket' tespiti)
const fYeniSirket = context.matchOrAddFirma({
  ad: 'Özkan Mühendislik İnşaat San. ve Tic. Ltd. Şti.',
  vkn: '3333333333',
  adres: 'Atatürk Cad. No:50',
  tel: '0532 111 22 33'
});
assert.equal(fYeniSirket.isNew, true);
assert.equal(fYeniSirket.firma.tur, 'Şirket');
assert.equal(fYeniSirket.firma.vkn, '3333333333');
assert.ok(context.referans.firmaList.some(f => f.ad === 'Özkan Mühendislik İnşaat San. ve Tic. Ltd. Şti.'));

// d. Yeni şahıs firması ekleme ('Kişi' tespiti)
const fYeniKisi = context.matchOrAddFirma({
  ad: 'Mehmet KAYA',
  vkn: '44444444444',
  adres: 'Kirişçi Mh.',
  tel: '0505 555 44 33'
});
assert.equal(fYeniKisi.isNew, true);
assert.equal(fYeniKisi.firma.tur, 'Kişi');
console.log('PASS: matchOrAddFirma matching, enrichment & auto-adding new companies');

// 9. dtmTopluBelgeleriDerleVeHazirla (Tüm Belgeleri Yükle sentezleme motoru)
const topluBelgelerSample = [
  // 1. Belge: YM Olur Belgesi
  {
    belgeTuru: 'olur',
    olur: {
      isAdi: 'Köy Konağı Çatı ve Dış Cephe Onarımı',
      isYM: true,
      isDT: false,
      onayNo: '99887',
      onayTarihi: '2026-10-01',
      gorevliAd: 'Aziz AÇIKGÖZ',
      gorevliUnvan: 'Elektrik Elektronik Mühendisi',
      onaylayanAd: 'Sinan ÖZYER',
      onaylayanUnvan: 'Yatırım ve İnşaat Müdür V.',
      isTuru: 'Onarım İşi'
    }
  },
  // 2. Belge: 1. Firma Teklifi
  {
    belgeTuru: 'teklif',
    teklif: {
      firmaAdi: 'Alper YAMAÇ',
      vkn: '1111111111',
      toplamTeklifTutari: 110000,
      kalemler: [
        { ad: 'Çatı ve Dış Cephe Onarımı', miktar: 1, birim: 'Adet', birimFiyat: 110000, toplamTutar: 110000 }
      ]
    }
  },
  // 3. Belge: 2. Firma Teklifi (En düşük teklif veren - KAZANAN)
  {
    belgeTuru: 'teklif',
    teklif: {
      firmaAdi: 'Gültes Enerji',
      vkn: '2222222222',
      toplamTeklifTutari: 95000,
      kalemler: [
        { ad: 'Çatı ve Dış Cephe Onarımı', miktar: 1, birim: 'Adet', birimFiyat: 95000, toplamTutar: 95000 }
      ]
    }
  },
  // 4. Belge: 3. Firma Teklifi (Yeni Firma)
  {
    belgeTuru: 'teklif',
    teklif: {
      firmaAdi: 'Özkan Mühendislik İnşaat San. ve Tic. Ltd. Şti.',
      vkn: '3333333333',
      toplamTeklifTutari: 105000,
      kalemler: [
        { ad: 'Çatı ve Dış Cephe Onarımı', miktar: 1, birim: 'Adet', birimFiyat: 105000, toplamTutar: 105000 }
      ]
    }
  }
];

const derlemeSonuc = context.dtmTopluBelgeleriDerleVeHazirla(topluBelgelerSample);
assert.ok(derlemeSonuc, 'Derleme sonucu boş olmamalı');
assert.equal(derlemeSonuc.proje.isAdi, 'Köy Konağı Çatı ve Dış Cephe Onarımı');
assert.equal(derlemeSonuc.proje.ymOnayNo, '99887');
assert.equal(derlemeSonuc.proje.ymOnayTarihi, '2026-10-01');
assert.equal(derlemeSonuc.proje.ymGorevliler[0].ad, 'Aziz AÇIKGÖZ');
assert.equal(derlemeSonuc.proje.onaylayanAmir.ad, 'Sinan ÖZYER');
assert.equal(derlemeSonuc.okunanOlurSayisi, 1);
assert.equal(derlemeSonuc.okunanTeklifSayisi, 3);
// Kazanan firma indeksi Gültes Enerji (95.000 TL) olmalı
assert.equal(derlemeSonuc.kazananIdx, 1);
assert.equal(derlemeSonuc.proje.teklifFirmalar[1].ad, 'Gültes Enerji');
assert.equal(derlemeSonuc.proje.teklifFirmalar[1].fiyatlar[0], 95000);
// Yaklaşık maliyet: 3 firma ortalaması: (110.000 + 95.000 + 105.000) / 3 = 103.333,33 TL
assert.equal(derlemeSonuc.yaklasikMaliyet, 103333.33);
console.log('PASS: dtmTopluBelgeleriDerleVeHazirla batch synthesis, pricing & winner calculation');

// 10. Mal Alımı çoklu kalem sentezleme testi
const malAlimiSample = [
  {
    belgeTuru: 'olur',
    olur: {
      isAdi: 'Kırtasiye ve Malzeme Alımı',
      onayNo: '5544',
      isTuru: 'Mal Alımı'
    }
  },
  {
    belgeTuru: 'teklif',
    teklif: {
      firmaAdi: 'Alper YAMAÇ',
      kalemler: [
        { ad: 'A4 Fotokopi Kağıdı', miktar: 50, birim: 'koli', birimFiyat: 1000 },
        { ad: 'Tükenmez Kalem', miktar: 100, birim: 'Adet', birimFiyat: 15 }
      ]
    }
  },
  {
    belgeTuru: 'teklif',
    teklif: {
      firmaAdi: 'Gültes Enerji',
      kalemler: [
        { ad: 'A4 Fotokopi Kağıdı', miktar: 50, birim: 'koli', birimFiyat: 900 },
        { ad: 'Tükenmez Kalem', miktar: 100, birim: 'Adet', birimFiyat: 20 }
      ]
    }
  }
];
const malSonuc = context.dtmTopluBelgeleriDerleVeHazirla(malAlimiSample);
assert.equal(malSonuc.proje.isTuru, 'Mal Alımı');
assert.equal(malSonuc.masterKalemler.length, 2);
assert.equal(malSonuc.masterKalemler[0].ad, 'A4 Fotokopi Kağıdı');
assert.equal(malSonuc.masterKalemler[0].miktar, 50);
assert.equal(malSonuc.masterKalemler[1].ad, 'Tükenmez Kalem');
assert.equal(malSonuc.masterKalemler[1].miktar, 100);
// Alper: 50*1000 + 100*15 = 51.500 TL
// Gültes: 50*900 + 100*20 = 47.000 TL (Kazanan Gültes)
assert.equal(malSonuc.kazananIdx, 1);
console.log('PASS: Multi-item Mal Alımı batch parsing, item synchronization & winner selection');

console.log('ALL OLUR PARSING, COMPANY MATCHING & BATCH SYNTHESIS TESTS PASSED!');

const beforePreview = JSON.stringify(context.referans);
const reversed = JSON.parse(JSON.stringify(malAlimiSample));
reversed[2].teklif.kalemler.reverse();
const reordered = context.dtmTopluBelgeleriDerleVeHazirla(reversed);
assert.deepEqual(Array.from(reordered.proje.teklifFirmalar[1].fiyatlar).slice(0,2), [900,20]);
assert.equal(JSON.stringify(context.referans), beforePreview, 'Preview must not mutate reference records');
const missing = JSON.parse(JSON.stringify(malAlimiSample));
missing[2].teklif.kalemler.pop();
const incomplete = context.dtmTopluBelgeleriDerleVeHazirla(missing);
assert.equal(incomplete.kazananIdx, 0, 'Incomplete cheaper offer must not win');
assert.equal(incomplete.proje.teklifFirmalar[1].analizEksik, true);
const duplicate = JSON.parse(JSON.stringify(malAlimiSample));
duplicate[2].teklif.kalemler[1] = {...duplicate[2].teklif.kalemler[0]};
assert.equal(context.dtmTopluBelgeleriDerleVeHazirla(duplicate).kazananIdx,0);
for (const invalid of [[], {kalemler:{}}, {miktar:-1}, {birimFiyat:'100'}, {onayTarihi:'2026-02-30'}, {ad:55}, {basitUsul:'false'}]) {
  assert.throws(() => context.dtmAiYanitiDogrula(invalid));
}
assert.equal(JSON.stringify(context.referans), beforePreview);
console.log('PASS: reordered, incomplete, duplicate items; isolated preview and malformed AI output');
