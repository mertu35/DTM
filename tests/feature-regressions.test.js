const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app/js/app.js', 'utf8');
const slice = (a,b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const ctx = vm.createContext({});
vm.runInContext(slice('function parseTLTutar', 'async function parseTeklifPDF'), ctx);
for (const [input, expected] of [['12.500,00 TL',12500], ['1234.56 TL',1234.56], ['1.234.567',1234567], ['123,45',123.45], ['1234',1234], ['bad',0]]) assert.equal(ctx.parseTLTutar(input), expected);
let saved = 0, rendered = 0, messages = [];
Object.assign(ctx, { readPdfText: async () => 'Firma Test Tutarı 200.000,00 TL', showToast: (...args) => messages.push(args), showConfirm: async () => true,
  escHtml: s => s, formatCurrency: String, referans: { firmaList: [{ ad: 'Firma Test' }] },
  proje: { isKalemleri: [{ ad: '' }, { ad: 'Çatı', miktar: 4 }], teklifFirmalar: [{ ad: '', fiyatlar: [] }] },
  saveProje: () => saved++, renderPage: () => rendered++ });
vm.runInContext(slice('async function parseTeklifPDF', '\nfunction '), ctx);
async function main() {
  await ctx.parseTeklifPDF({}, 'teklif', 0);
  assert.equal(ctx.proje.teklifFirmalar[0].fiyatlar[1], 50000);
  assert.equal(saved, 1); assert.equal(rendered, 1);
  ctx.readPdfText = async () => 'Tutarı: 1234.56 TL';
  await ctx.parseTeklifPDF({}, 'teklif', 0);
  assert.equal(ctx.proje.teklifFirmalar[0].fiyatlar[1], 308.64);
  ctx.proje.isKalemleri = [{ ad: '' }];
  await ctx.parseTeklifPDF({}, 'teklif', 0); assert.equal(saved, 2);
  assert.match(messages.at(-1)[0], /iş kalemi/);
  const docs = fs.readFileSync('app/js/documents.js', 'utf8');
  const printCtx = vm.createContext({ window: { open: () => null }, showToast: (...args) => messages.push(args) });
  vm.runInContext(docs.slice(docs.indexOf('function belgeYazdir(')), printCtx);
  assert.equal(printCtx.belgeYazdir('<p>Test</p>'), false);
  assert.match(messages.at(-1)[0], /açılır/);
  const nodes = [{ dataset: { page: 'a' }, classList: { remove(){}, add(){} }, addEventListener() { this.count = (this.count || 0)+1; } }];
  const nav = vm.createContext({ document: { querySelectorAll: () => nodes, querySelector: () => null }, updateNavLock(){}, renderPage(){}, currentPage:'a' });
  vm.runInContext(slice('function init() {','\nfunction '), nav);
  nav.init(); nav.init(); assert.equal(nodes[0].count, 1);
  console.log('PASS: decimal parsing, PDF active row import/no row, blocked print popup, repeated navigation initialization');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
