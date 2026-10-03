// node tests/security-ui.test.js — actual rendering and decoded inline handlers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const main = { innerHTML: '' };
const context = vm.createContext({ console, setTimeout() {}, clearTimeout() {},
  localStorage: { getItem() { return null; }, setItem() {} },
  document: { getElementById(id) { return id === 'mainContent' ? main : null; },
    createElement() { return {}; }, head: { appendChild() {} }, addEventListener() {} },
  window: { addEventListener() {} }
});
for (const file of ['data', 'utils', 'calculations', 'documents', 'excel', 'word', 'app']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, `../app/js/${file}.js`), 'utf8'), context);
}
const decode = value => value.replace(/&(quot|#39|lt|gt|amp);/g, (_, key) =>
  ({ quot: '"', '#39': "'", lt: '<', gt: '>', amp: '&' })[key]);
async function mainTest() {
  let count = 0;
  for (const payload of ["O'Brien", "'); globalThis.injected = true; //", '" onclick="globalThis.injected=true',
    '<img src=x onerror="globalThis.injected=true">', 'Slash\\ and\nnewline\u2028separator', '&quot;']) {
    context.payload = payload;
    vm.runInContext(`
      getUserProjeler = async () => [{ id: payload, isAdi: payload, status: 'taslak',
        atananGerceklestirmeciAd: payload, isTuru: 'Yapım İşi' }];
      globalThis.received = [];
      cloudProjeAc = (...args) => received.push(args);
      gonderiClick = (...args) => received.push(args);
      cloudProjeSil = (...args) => received.push(args);
      cloudProjeKilitle = (...args) => received.push(args);
    `, context);
    await context.renderProjelerimPage();
    assert.ok(!main.innerHTML.includes('<img'), 'user HTML must remain text');
    const handlers = [...main.innerHTML.matchAll(/onclick="([^"]*)"/g)].map(m => decode(m[1])).filter(handler => /^(cloudProje|gonderiClick)/.test(handler));
    assert.equal(handlers.length, 4, 'all project action buttons rendered');
    for (const handler of handlers) vm.runInContext(handler, context);
    assert.equal(context.received[0][0], payload);
    assert.equal(context.received[1][1], payload);
    assert.equal(context.received[3][1], payload);
    assert.equal(context.injected, undefined, 'payload must never execute');
    count++;
  }
  assert.equal(context.escAttr(0), '0');
  assert.equal(context.escHtml(null), '');
  console.log(`${count + 2} UI security checks passed.`);
}
mainTest().catch(error => { console.error(error); process.exitCode = 1; });
