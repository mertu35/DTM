// node tests/finance.test.js — no dependencies or production services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({
  console, setTimeout() {}, clearTimeout() {},
  localStorage: { getItem() { return null; }, setItem() {} },
  document: { getElementById() { return null; }, createElement() { return {}; },
    head: { appendChild() {} }, addEventListener() {} },
  window: { addEventListener() {} }
});
for (const file of ['data', 'utils', 'calculations', 'documents', 'excel', 'word', 'app']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, `../app/js/${file}.js`), 'utf8'), context);
}
vm.runInContext(`
  var captured = '', warnings = [];
  htmlIndirDoc = htmlIndirXls = html => { captured = html; };
  showToast = message => warnings.push(message);
  autoSave = renderPage = () => {};
`, context);
let count = 0;
function check(name, fn) { fn(); count++; console.log('PASS: ' + name); }
const run = code => vm.runInContext(code, context);
const base = () => Object.assign(context.getDefaultProje(), {
  isAdi: 'Test Çatı Onarımı', isTuru: 'Yapım İşi', kdvOrani: 20,
  ymFirmalar: [{ ad: 'A', fiyatlar: [200000] }, { ad: 'B', fiyatlar: [220000] }, { ad: 'C', fiyatlar: [240000] }],
  teklifFirmalar: [{ ad: 'A', fiyatlar: [200000] }, { ad: 'B', fiyatlar: [210000] }, { ad: 'C', fiyatlar: [230000] }],
  kazananFirmaIndex: 0, sozlesmeDamgaVergisi: 500
});
context.r = context.getDefaultReferans();
context.r.firmaList = ['A', 'B', 'C'].map(ad => ({ ad, adres: 'Test', tur: 'Şirket', basitUsul: false }));
for (const rate of [0, '0', 1, 10, 20, undefined, null, '']) {
  context.p = Object.assign(base(), { kdvOrani: rate });
  const expected = rate === undefined || rate === null || rate === '' ? 20 : Number(rate);
  check(`KDV ${String(rate)}`, () => {
    const h = run('hesaplaHakedis(p, r)');
    assert.equal(h.kdvOrani, expected);
    assert.equal(h.kdv, 200000 * expected / 100);
    assert.equal(run('hesaplaSozlesmeVergileri(p, r).kdv'), h.kdv);
    assert.ok(run('renderHakedisRaporu(p, r)').includes(`KDV (E x %${expected})`));
  });
}
for (const [field, value] of [
  ['sgkKesintisi', -1], ['vergiBorcu', -1], ['gecikmeCezasi', -1], ['avansMahsubu', -1],
  ['sozlesmeDamgaVergisi', -1], ['fiyatFarkiTeminat', -1], ['geciciKabulNoksanlari', -1],
  ['oncekiHakedisTutar', -1], ['odenek', -1], ['kdvOrani', -1], ['kdvOrani', 101],
  ['sgkKesintisi', Infinity], ['sgkKesintisi', '12abc'], ['sgkKesintisi', true],
  ['oncekiHakedisTutar', 200001], ['avansMahsubu', 200001], ['sgkKesintisi', 300000],
  ['fiyatFarki', -200001]
]) {
  context.p = Object.assign(base(), { [field]: value });
  check(`reject ${field}=${value}`, () => {
    assert.ok(run('getHesaplamaHatalari(p, r).length') > 0);
    assert.equal(run('hesaplaHakedis(p, r)'), null);
    assert.ok(run('renderHakedisRaporu(p, r)').includes('data-hesaplama-hatasi'));
    run('captured = ""');
    assert.equal(run('belgeIdindenWordUret("hakedis-raporu", p, r)'), false);
    assert.equal(run('belgeIdindenExcelUret("yaklasik-maliyet", p, r)'), false);
    assert.equal(run('captured'), '');
  });
}
for (const value of [-1, Infinity, '100x']) {
  context.p = base(); context.p.teklifFirmalar[0].fiyatlar[0] = value;
  check(`reject imported price ${value}`, () => assert.ok(run('getHesaplamaHatalari(p, r).length') > 0));
  context.p = Object.assign(base(), { isTuru: 'Mal Alımı', isKalemleri: [{ ad: 'Test', miktar: value }] });
  check(`reject imported quantity ${value}`, () => assert.ok(run('getHesaplamaHatalari(p, r).length') > 0));
}
context.p = Object.assign(base(), { fiyatFarki: -10000 });
check('signed price adjustment remains valid', () => {
  assert.equal(run('getHesaplamaHatalari(p, r).length'), 0);
  assert.equal(run('hesaplaHakedis(p, r).buHakedis'), 190000);
});
context.p = Object.assign(base(), { oncekiHakedisTutar: 200000, sozlesmeDamgaVergisi: 0 });
check('previous payment equal to total: zero payment', () => assert.equal(run('hesaplaHakedis(p, r).odenecek'), 0));
context.p = Object.assign(base(), { avansMahsubu: 200000, sozlesmeDamgaVergisi: 0 });
check('advance equal to current payment: stamp duty zero', () => assert.equal(run('hesaplaHakedis(p, r).damgaVergisi'), 0));
context.p = base();
context.r.firmaList[0].basitUsul = true;
check('simple-tax exemption shared by summary and payment', () => {
  assert.equal(run('hesaplaHakedis(p, r).kdv'), 0);
  assert.equal(run('hesaplaSozlesmeVergileri(p, r).kdv'), 0);
});
context.r.firmaList[0].basitUsul = false;
context.p = Object.assign(base(), { sgkKesintisi: 0.005, vergiBorcu: 0.005 });
check('fractional deductions: total equals sum of displayed cents', () => {
  const hak = run('hesaplaHakedis(p, r)');
  assert.equal(hak.sgk, 0.01);
  assert.equal(hak.vergi, 0.01);
  assert.equal(hak.toplamKesinti, 18396.02);
});
check('negative monetary rounding matches displayed cents', () => assert.equal(run('paraYuvarla(-1.005)'), -1.01));
for (const rate of [0, 20]) {
  context.p = Object.assign(base(), { kdvOrani: rate });
  check(`Word and screen payment consistency rate=${rate}`, () => {
    const screen = run('renderHakedisRaporu(p, r)');
    run('belgeIdindenWordUret("hakedis-raporu", p, r)');
    assert.ok(run('captured').includes(screen));
    assert.ok(screen.includes(context.formatCurrency(rate ? 221604 : 197604)));
  });
  check(`Excel and screen YM/offer consistency rate=${rate}`, () => {
    run('exportYaklasikMaliyetExcel(p, r)');
    assert.ok(run('captured').includes('220.000,00'));
    assert.ok(run('renderYaklasikMaliyet(p, r)').includes('220.000,00'));
    run('exportTeklifTutanagiExcel(p, r)');
    assert.ok(run('captured').includes('200.000,00'));
    assert.ok(run('renderTeklifTutanagi(p, r)').includes('200.000,00'));
  });
}
context.p = base(); context.p.ymFirmalar[0].fiyatlar[0] = '200000';
check('numeric strings are formatted identically in screen and Excel', () => {
  assert.ok(run('renderYaklasikMaliyet(p, r)').includes('200.000,00'));
  run('exportYaklasikMaliyetExcel(p, r)');
  assert.ok(run('captured').includes('200.000,00'));
});
context.p = Object.assign(base(), { isTuru: 'Mal Alımı', isKalemleri: [
  { ad: 'A', miktar: 0.333, birim: 'Adet' }, { ad: 'B', miktar: 0.333, birim: 'Adet' }
], ymFirmalar: [{ ad: 'A', fiyatlar: [0.1, 0.1] }, { ad: 'B', fiyatlar: [] }, { ad: 'C', fiyatlar: [] }] });
check('rounded line items equal displayed firm total', () => assert.equal(run('hesaplaYMFirmaToplam(p.ymFirmalar[0], getKalemler(p))'), 0.06));
run('proje = p = getDefaultProje(); referans = r;');
check('form rejects negative payment field and preserves old value', () => {
  run('onFieldChange("sgkKesintisi", "-50")');
  assert.equal(run('proje.sgkKesintisi'), 0);
});
check('form accepts zero KDV', () => {
  run('onFieldChange("kdvOrani", "0")');
  assert.equal(run('proje.kdvOrani'), 0);
});
check('form rejects negative price', () => {
  run('onFiyatChange({dataset:{firma:"teklif",fi:"0",ki:"0"},value:"-100"})');
  assert.equal(run('proje.teklifFirmalar[0].fiyatlar[0] || 0'), 0);
});
console.log(`${count} finance checks passed.`);
