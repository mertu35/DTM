const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const handlers = {};
let cached, lookups = [];
const cache = { match: async (request, options) => { lookups.push(options); return cached; } };
const context = vm.createContext({ URL, Response, caches: { open: async () => cache, match: async () => cached },
  fetch: async () => { throw new Error('offline'); },
  self: { location: { origin: 'https://example.test' }, addEventListener: (name, fn) => handlers[name] = fn }
});
vm.runInContext(fs.readFileSync('app/sw.js', 'utf8'), context);
async function request(path, mode = 'cors', method = 'GET') {
  let result;
  handlers.fetch({ request: { url: new URL(path, 'https://example.test').href, mode, method }, respondWith: promise => result = promise });
  return result;
}
(async () => {
  cached = new Response('javascript');
  assert.equal(await (await request('/js/app.js?v=new')).text(), 'javascript');
  assert.equal(lookups[0].ignoreSearch, true);
  assert.equal(await request('https://other.test/data'), undefined);
  assert.equal(await request('/data', 'cors', 'POST'), undefined);
  cached = undefined;
  assert.equal((await request('/missing.js')).type, 'error');
  assert.equal((await request('/missing-page', 'navigate')).type, 'error');
  cache.match = async () => undefined;
  cached = new Response('shell');
  assert.equal(await (await request('/page', 'navigate')).text(), 'shell');
  assert.equal((await request('/missing.js')).type, 'error');
  for (const asset of vm.runInContext('STATIC_ASSETS', context)) assert.ok(fs.existsSync('app/' + asset.replace(/^\.\//, '')), asset);
  console.log('PASS: versioned cache, offline navigation, failed script, request isolation and precache assets');
})().catch(error => { console.error(error); process.exitCode = 1; });
