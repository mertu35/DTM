// node tests/pdf-text.test.js — PDF.js text extraction with no cloud calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app/js/app.js'), 'utf8');
const start = source.indexOf('async function readPdfText(file)');
const end = source.indexOf('function parseTLTutar', start);
assert.ok(start >= 0 && end > start);
let networkCalls = 0;
const context = vm.createContext({
  fetch() { networkCalls++; throw new Error('Unexpected network call'); }
});
vm.runInContext(source.slice(start, end), context);
const file = { async arrayBuffer() { return new ArrayBuffer(8); } };
function mockPdf(pages) {
  context.pdfjsLib = { getDocument() { return { promise: Promise.resolve({
    numPages: pages.length,
    async getPage(page) { return { async getTextContent() {
      return { items: pages[page - 1].map(str => ({ str })) };
    } }; }
  }) }; } };
}
async function main() {
  mockPdf([['Test', 'Çatı Onarımı'], ['Tutarı', '200.000,00 TL']]);
  assert.equal(await context.readPdfText(file), 'Test Çatı Onarımı\nTutarı 200.000,00 TL\n');
  console.log('PASS: Turkish text across multiple pages');
  mockPdf([['123,45 TL']]);
  assert.equal(await context.readPdfText(file), '123,45 TL\n');
  console.log('PASS: short numeric text is preserved');
  mockPdf([[], ['   ']]);
  await assert.rejects(context.readPdfText(file), /bilgileri elle girin/);
  console.log('PASS: scanned PDF gets a clear manual-entry message');
  delete context.pdfjsLib;
  await assert.rejects(context.readPdfText(file), /PDF okuyucu yüklenemedi/);
  console.log('PASS: missing PDF reader gets a clear error');
  assert.equal(networkCalls, 0);
  console.log('PASS: no external OCR request');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
