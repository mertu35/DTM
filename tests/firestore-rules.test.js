// Start: firebase emulators:start --only firestore --project demo-dtm
// Run: node tests/firestore-rules.test.js
// Uses only the local emulator; never connects to the production project.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const host = 'http://127.0.0.1:8080';
const project = 'demo-dtm';
const base = `${host}/v1/projects/${project}/databases/(default)/documents`;
const name = p => `projects/${project}/databases/(default)/documents/${p}`;
const field = v => typeof v === 'boolean' ? { booleanValue: v } : { stringValue: v };
const fields = data => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, field(v)]));
function token(uid) {
  const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    sub: uid, user_id: uid, aud: project, iss: `https://securetoken.google.com/${project}`,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
    firebase: { sign_in_provider: 'password' }
  })}.`;
}
async function request(method, url, body, uid = 'owner', admin = false) {
  return fetch(url, { method, headers: {
    'Content-Type': 'application/json', Authorization: `Bearer ${admin ? 'owner' : token(uid)}`
  }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function seed(p, data) {
  const res = await request('PATCH', `${base}/${p}`, { fields: fields(data) }, '', true);
  assert.equal(res.status, 200, await res.text());
}
async function update(p, data, uid) {
  const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join('&');
  return request('PATCH', `${base}/${p}?${mask}`, { fields: fields(data) }, uid);
}
let count = 0;
async function check(label, response, allowed) {
  assert.equal(response.status, allowed ? 200 : 403, `${label}: ${await response.text()}`);
  console.log(`PASS: ${label}`);
  count++;
}
async function main() {
  const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
  const loaded = await request('PUT', `${host}/emulator/v1/projects/${project}:securityRules`,
    { rules: { files: [{ name: 'firestore.rules', content: rules }] } }, '', true);
  assert.equal(loaded.status, 200, await loaded.text());
  for (const [uid, role] of [['owner', 'user'], ['reviewer', 'gerceklestirmeci'], ['other', 'user'], ['admin', 'admin']]) {
    await seed(`users/${uid}`, { role });
  }
  const p = 'projeler/security-test';
  const reset = (status = 'gonderildi', locked = false) => seed(p, {
    userId: 'owner', atananGerceklestirmeciUid: 'reviewer', status, locked, isAdi: 'Original'
  });
  for (const [status, patch] of [
    ['onaylandi', { status: 'onaylandi', onaylandiAt: 'date', onaylandiBy: 'Reviewer' }],
    ['geri_gonderildi', { status: 'geri_gonderildi', geriGonderNot: 'Düzelt', geriGonderAt: 'date', geriGonderBy: 'Reviewer' }]
  ]) {
    await reset();
    await check(`reviewer transition ${status}`, await update(p, patch, 'reviewer'), true);
    for (const extra of [{ isAdi: 'Changed' }, { userId: 'reviewer' }, { atananGerceklestirmeciUid: 'other' }]) {
      await reset();
      await check(`reject ${status} with ${Object.keys(extra)[0]}`, await update(p, { ...patch, ...extra }, 'reviewer'), false);
    }
  }
  await reset();
  await check('reject unrelated reviewer edit', await update(p, { isAdi: 'Changed' }, 'reviewer'), false);
  await check('reject unassigned approval', await update(p, { status: 'onaylandi' }, 'other'), false);
  await check('reject owner approval', await update(p, { status: 'onaylandi' }, 'owner'), false);
  for (const status of ['taslak', 'geri_gonderildi', 'gonderildi', 'onaylandi', 'arsivlendi']) {
    for (const locked of [false, true]) {
      await reset(status, locked);
      for (const uid of ['owner', 'reviewer', 'other', 'admin']) {
        const allowed = uid === 'admin' || (!locked && (
          (uid === 'owner' && ['taslak', 'geri_gonderildi'].includes(status)) ||
          (uid === 'reviewer' && status === 'gonderildi')
        ));
        for (const suffix of ['dosyalar/file', 'dosyalar/file/parcalar/000']) {
          const file = `${p}/${suffix}`;
          await request('DELETE', `${base}/${file}`, undefined, '', true);
          await check(`create ${suffix} ${uid} ${status} locked=${locked}`,
            await request('PATCH', `${base}/${file}`, { fields: fields({ chunk: 'test' }) }, uid), allowed);
          await seed(file, { chunk: 'test' });
          await check(`read ${suffix} ${uid} ${status} locked=${locked}`,
            await request('GET', `${base}/${file}`, undefined, uid), uid !== 'other');
          await check(`delete ${suffix} ${uid} ${status} locked=${locked}`,
            await request('DELETE', `${base}/${file}`, undefined, uid), allowed);
        }
      }
    }
  }
  await reset();
  await seed(`${p}/dosyalar/file`, { chunk: 'test' });
  await check('reject approval and attachment deletion in same batch',
    await request('POST', `${base}:commit`, { writes: [
      { update: { name: name(p), fields: fields({ status: 'onaylandi' }) }, updateMask: { fieldPaths: ['status'] } },
      { delete: name(`${p}/dosyalar/file`) }
    ] }, 'reviewer'), false);
  console.log(`${count} security checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
