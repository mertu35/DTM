// Local mocks verify atomic writes and Auth-account cleanup on failed creation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
let writes = [], commits = 0, created = 0, rolledBack = 0, fail = false;
const ref = key => ({ key, collection: name => ({ doc: id => ref(`${key}/${name}/${id}`) }),
  async get() { return { exists: true, data: () => ({ role: key.endsWith('/super') ? 'superadmin' : 'user', displayName: 'Test', username: 'canonical' }) }; } });
const db = { collection: name => ({ doc: id => ref(`${name}/${id}`) }), batch() {
  const pending = [];
  return { set: (target, data) => pending.push(['set', target.key, data]),
    update: (target, data) => pending.push(['update', target.key, data]),
    delete: target => pending.push(['delete', target.key]),
    async commit() { commits++; if (fail) throw new Error('denied'); writes = pending; } };
} };
const secondary = { auth: () => ({ async createUserWithEmailAndPassword() {
  created++; return { user: { uid: 'new', async delete() { rolledBack++; } } };
}, async signOut() {} }), async delete() {} };
const firestore = () => db;
firestore.FieldValue = { serverTimestamp: () => 'timestamp' };
const context = vm.createContext({ console, window: {}, firebaseConfig: {}, firebase: {
  initializeApp: (_, name) => name ? secondary : {}, auth: () => ({}), firestore
} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/js/firebase.js'), 'utf8'), context);
const actor = role => vm.runInContext(`currentDTMUser = { uid: 'actor', role: '${role}' };`, context);
async function main() {
  actor('user');
  await assert.rejects(context.createDTMUser('new', 'password', 'Test', 'user'));
  assert.equal(created, 0);
  actor('admin');
  await assert.rejects(context.createDTMUser('new', 'password', 'Test', 'superadmin'));
  assert.equal(created, 0);
  await assert.rejects(context.changeUserRole('super', 'user'));
  await assert.rejects(context.deleteDTMUser('super'));
  await assert.rejects(context.deleteDTMUser('actor'));
  assert.equal(commits, 0, 'denied actions must not mutate any document');
  await context.changeUserRole('target', 'gerceklestirmeci');
  assert.equal(commits, 1);
  assert.deepEqual(writes.map(w => w[1]), ['users/target', 'publicUsers/target']);
  assert.equal(writes[1][2].role, 'gerceklestirmeci');
  await context.deleteDTMUser('target');
  assert.equal(commits, 2);
  assert.deepEqual(writes.map(w => w[1]), ['usernameEmailMap/canonical', 'publicUsers/target', 'users/target/secret/info', 'users/target']);
  await context.createDTMUser('new', 'password', 'Test', 'user');
  assert.equal(commits, 3);
  assert.deepEqual(writes.map(w => w[1]), ['users/new', 'publicUsers/new']);
  fail = true;
  await assert.rejects(context.createDTMUser('new2', 'password', 'Test', 'user'), /denied/);
  assert.equal(rolledBack, 1, 'failed profile creation must delete the new Auth account');
  console.log('User management security checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
