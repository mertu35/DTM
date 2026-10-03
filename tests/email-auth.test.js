// Tests the actual email sync flow without Firebase or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let calls = [], failRefresh = false, failWrite = false;
const user = { uid: 'test', email: 'real@example.com', emailVerified: true,
  async reload() { calls.push('reload'); },
  async getIdToken(force) { assert.equal(force, true); calls.push('token'); if (failRefresh) throw new Error('expired'); }
};
const firestore = () => ({ collection: () => ({ doc: () => ({ async update(data) {
  calls.push('write'); assert.equal(data.email, user.email); assert.equal(data.emailVerified, true);
  if (failWrite) throw new Error('permission-denied');
} }) }) });
const context = vm.createContext({ console, window: {}, firebaseConfig: {},
  firebase: { initializeApp() {}, auth: () => ({ currentUser: user }), firestore }
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/js/firebase.js'), 'utf8'), context);
function reset() {
  calls = [];
  vm.runInContext("currentDTMUser = { uid: 'test', emailVerified: false };", context);
}
async function main() {
  reset();
  const result = await context.epostaDurumunuGuncelle();
  assert.deepEqual(calls, ['reload', 'token', 'write']);
  assert.equal(result.emailVerified, true);
  assert.equal(vm.runInContext('currentDTMUser.emailVerified', context), true);
  reset(); failRefresh = true;
  await assert.rejects(context.epostaDurumunuGuncelle(), /yenilenemedi/);
  assert.deepEqual(calls, ['reload', 'token']);
  assert.equal(vm.runInContext('currentDTMUser.emailVerified', context), false);
  reset(); failRefresh = false; failWrite = true;
  await assert.rejects(context.epostaDurumunuGuncelle(), /permission-denied/);
  assert.equal(vm.runInContext('currentDTMUser.emailVerified', context), false);
  reset(); failWrite = false; user.emailVerified = false;
  assert.equal((await context.epostaDurumunuGuncelle()).emailVerified, false);
  assert.deepEqual(calls, ['reload', 'token']);
  console.log('4 email sync checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
