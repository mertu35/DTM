// node tests/olur-parse.test.js — Olur document extraction and dropdown matching tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appJsSource = fs.readFileSync(path.join(__dirname, '../app/js/app.js'), 'utf8');

// Test ortamı için minimal context
const sandbox = {
  console,
  referans: {
    muhendisList: [
      { ad: 'Aziz AÇIKGÖZ', unvan: 'Elektrik Elektronik Mühendisi' },
      { ad: 'Erdem ÜNVER', unvan: 'İnşaat Mühendisi' },
      { ad: 'Ahmet CANBOLAT', unvan: 'Makine Mühendisi' }
    ],
    onaylayanList: [
      { ad: 'Sinan ÖZYER', unvan: 'Yatırım ve İnşaat Müdür V.' },
      { ad: '', unvan: 'Genel Sekreter' }
    ]
  },
  saveReferans(ref) {
    sandbox.referans = ref;
  }
};

const context = vm.createContext(sandbox);

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

console.log('ALL OLUR PARSING & PERSONNEL MATCHING TESTS PASSED!');
