const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app/js/firebase.js'), 'utf8');
let stored = { userId: 'owner', status: 'taslak', revision: 0, data: { isAdi: 'İlk' }, geriGonderNot: 'Düzelt' };
const copy = x => JSON.parse(JSON.stringify(x));
let updates = 0, retry = null;
const ref = { id: 'p', async get() { return { exists: true, data: () => copy(stored) }; }, async set(data) { stored = copy(data); } };
const db = { collection: () => ({ doc: () => ref }), async runTransaction(callback) {
  let patch;
  const transaction = { get: ref.get, update(_ref, data) { patch = data; } };
  let result = await callback(transaction);
  if (retry) { const action = retry; retry = null; action(); patch = null; result = await callback(transaction); }
  stored = { ...stored, ...copy(patch) }; updates++; return result;
} };
function session(role = 'user') {
  const firestore = () => db;
  firestore.FieldValue = { serverTimestamp: () => 'SERVER_TIME' };
  const context = vm.createContext({ console, window: {}, firebaseConfig: {}, firebase: {
    initializeApp() {}, auth: () => ({ currentUser: { uid: 'owner' }, async signOut() {} }), firestore
  } });
  vm.runInContext(source, context);
  vm.runInContext(`currentDTMUser = { role: '${role}', displayName: 'Test' }`, context);
  return context;
}
async function main() {
  const a = session(), b = session();
  await a.getProjeFromCloud('p'); await b.getProjeFromCloud('p');
  await a.updateProjeInCloud('p', { isAdi: 'A' });
  assert.equal(stored.revision, 1); assert.equal(stored.geriGonderNot, 'Düzelt');
  await assert.rejects(b.updateProjeInCloud('p', { isAdi: 'B' }), { code: 'dtm/conflict' });
  assert.equal(stored.data.isAdi, 'A'); assert.equal(updates, 1);
  await b.getProjeFromCloud('p', false);
  await assert.rejects(b.updateProjeInCloud('p', { isAdi: 'Read-only download must not rebase editor' }), { code: 'dtm/conflict' });
  await a.updateProjeInCloud('p', { isAdi: 'A2' }); assert.equal(stored.revision, 2);
  retry = () => { stored.revision++; stored.data.isAdi = 'Other'; };
  await assert.rejects(a.updateProjeInCloud('p', { isAdi: 'Lost' }), { code: 'dtm/conflict' });
  assert.equal(stored.data.isAdi, 'Other');
  stored.status = 'geri_gonderildi'; await a.getProjeFromCloud('p');
  await a.updateProjeInCloud('p', { isAdi: 'Fixed' });
  assert.equal(stored.status, 'geri_gonderildi'); assert.equal(stored.geriGonderNot, 'Düzelt');
  await a.gonderiProje('p', 'reviewer', 'Reviewer'); assert.equal(stored.status, 'gonderildi');
  await assert.rejects(a.gonderiProje('p', 'reviewer', 'Reviewer'), /durumu değişti/);
  const reviewer = session('gerceklestirmeci'); await reviewer.getProjeFromCloud('p');
  await reviewer.onaylaProje('p'); const approved = copy(stored);
  await assert.rejects(reviewer.onaylaProje('p'), /durumu değişti/);
  assert.deepEqual(stored, approved);
  stored.status = 'gonderildi'; await reviewer.getProjeFromCloud('p');
  retry = () => { stored.revision++; stored.data.isAdi = 'Changed before approval'; };
  await assert.rejects(reviewer.onaylaProje('p'), { code: 'dtm/conflict' });
  assert.equal(stored.status, 'gonderildi');
  stored.locked = true; await a.getProjeFromCloud('p');
  await assert.rejects(a.updateProjeInCloud('p', { isAdi: 'Locked' }), /kilitli/);
  await assert.rejects(session().updateProjeInCloud('p', {}), { code: 'dtm/conflict' });
  console.log('PASS: concurrent editors, retry conflict, successive saves, return note, resubmission, duplicate/stale approval, locked and unopened project');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
