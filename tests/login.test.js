// Local regression checks: no anonymous email-directory reads.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let attempts = [], signOuts = 0, directoryReads = 0, profileExists = true;
let profile = { username: 'ali', role: 'user', displayName: 'Ali' };
const accounts = new Map([
  ['ali@dtm.local', { uid: 'legacy', email: 'ali@dtm.local', emailVerified: false }],
  ['new@example.com', { uid: 'changed', email: 'new@example.com', emailVerified: true }]
]);
const auth = { async signInWithEmailAndPassword(email, password) {
  attempts.push(email);
  if (!accounts.has(email) || password !== 'correct') {
    const error = new Error('Invalid credentials'); error.code = 'auth/invalid-credential'; throw error;
  }
  return { user: accounts.get(email) };
}, async signOut() { signOuts++; } };
const firestore = () => ({ collection(name) {
  if (name === 'usernameEmailMap') directoryReads++;
  return { doc: () => ({ async get() { return { exists: profileExists, data: () => ({ ...profile }) }; },
    async set() {}, async update() {} }) };
} });
const context = vm.createContext({ console, window: {}, firebaseConfig: {},
  firebase: { initializeApp() {}, auth: () => auth, firestore }
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/js/firebase.js'), 'utf8'), context);
async function main() {
  assert.equal((await context.dtmLogin(' ALI ', 'correct')).uid, 'legacy');
  accounts.delete('ali@dtm.local');
  await assert.rejects(context.dtmLogin('ali', 'correct'), { code: 'dtm/email-required' });
  assert.equal((await context.dtmLogin(' ALI ', 'correct', ' NEW@EXAMPLE.COM ')).uid, 'changed');
  assert.equal((await context.dtmLogin('NEW@EXAMPLE.COM', 'correct')).uid, 'changed');
  await assert.rejects(context.dtmLogin('other', 'correct', 'new@example.com'), { code: 'auth/invalid-credential' });
  assert.equal(signOuts, 1, 'valid email credentials with mismatched username must sign out');
  await assert.rejects(context.dtmLogin('ali', 'wrong', 'new@example.com'), { code: 'auth/invalid-credential' });
  profileExists = false;
  await assert.rejects(context.dtmLogin('new@example.com', 'correct'));
  assert.equal(signOuts, 2, 'missing application profile must sign out');
  assert.equal(directoryReads, 0);
  assert.ok(attempts.includes('new@example.com'));
  console.log('7 login scenarios passed; no email-directory access.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
