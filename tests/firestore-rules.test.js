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
const field = v => v === null ? { nullValue: null } : v instanceof Date ? { timestampValue: v.toISOString() } : typeof v === 'number' ? { integerValue: String(v) } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'string' ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(field) } } : { mapValue: { fields: fields(v) } };
const fields = data => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, field(v)]));
const authClaims = {};
function token(uid) {
  const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    sub: uid, user_id: uid, aud: project, iss: `https://securetoken.google.com/${project}`,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
    firebase: { sign_in_provider: 'password' }, ...(authClaims[uid] || {})
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
async function seedAs(p, data, uid) { return request('PATCH', `${base}/${p}`, { fields: fields(data) }, uid); }
const header = 'data:application/pdf;base64,';
function fileMeta(uid = 'owner', multi = false) { return {
  ad: 'test.pdf', boyut: multi ? 537600 : 3, tip: 'application/pdf', yukleyenUid: uid,
  yukleyenAd: 'Test', createdAt: new Date(), parcali: multi,
  ...(multi ? { parcaSayisi: 2 } : { data: header + 'YWJj' })
}; }
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
  const emailUser = 'email-user';
  const resetEmail = (verified = false) => seed(`users/${emailUser}`, {
    role: 'user', email: 'real@example.com', emailVerified: verified
  });
  await resetEmail();
  authClaims[emailUser] = { email: 'real@example.com', email_verified: false };
  await check('unverified Auth cannot verify profile', await update(`users/${emailUser}`, { emailVerified: true }, emailUser), false);
  authClaims[emailUser].email_verified = true;
  await check('matching verified Auth email allowed', await update(`users/${emailUser}`, { emailVerified: true }, emailUser), true);
  await check('email-only change cannot retain verification', await update(`users/${emailUser}`, { email: 'fake@example.com' }, emailUser), false);
  await check('verified Auth cannot verify another address', await update(`users/${emailUser}`, { email: 'fake@example.com', emailVerified: true }, emailUser), false);
  await check('email change with verification reset allowed', await update(`users/${emailUser}`, { email: 'new@example.com', emailVerified: false }, emailUser), true);
  await check('pending email update allowed', await update(`users/${emailUser}`, { pendingEmail: 'pending@example.com', emailVerified: false }, emailUser), true);
  authClaims[emailUser] = { email: 'new@example.com', email_verified: true };
  await check('newly verified Auth address sync allowed', await update(`users/${emailUser}`, { email: 'new@example.com', emailVerified: true }, emailUser), true);
  authClaims[emailUser] = { email: 'real@example.com', email_verified: false };
  await check('unrelated avatar with stale token allowed', await update(`users/${emailUser}`, { avatar: 'avatar2' }, emailUser), true);
  await check('admin cannot falsely verify another profile', await update(`users/${emailUser}`, { email: 'fake@example.com', emailVerified: true }, 'admin'), false);
  await check('admin unrelated role change preserves verified profile', await update(`users/${emailUser}`, { role: 'gerceklestirmeci' }, 'admin'), true);
  await seed('users/admin', { role: 'admin', email: 'admin@example.com', emailVerified: false });
  authClaims.admin = { email: 'admin@example.com', email_verified: true };
  await check('admin self verification cannot bypass address match', await update('users/admin', { email: 'fake@example.com', emailVerified: true }, 'admin'), false);
  await check('admin matching self verification allowed', await update('users/admin', { emailVerified: true }, 'admin'), true);
  await check('admin cannot create falsely verified profile', await seedAs('users/fake-verified', { role: 'user', email: 'fake@example.com', emailVerified: true }, 'admin'), false);
  await resetEmail();
  authClaims[emailUser] = {};
  await check('missing Auth claims cannot verify profile', await update(`users/${emailUser}`, { emailVerified: true }, emailUser), false);
  await seed('users/super', { role: 'superadmin', displayName: 'Super' });
  await seed('publicUsers/super', { uid: 'super', role: 'superadmin', displayName: 'Super' });
  await seed('users/super/secret/info', { value: 'private' });
  await check('self role escalation denied', await update('users/owner', { role: 'admin' }, 'owner'), false);
  await check('admin cannot demote superadmin', await update('users/super', { role: 'user' }, 'admin'), false);
  await check('admin cannot create superadmin', await seedAs('users/new-super', { role: 'superadmin' }, 'admin'), false);
  await check('invalid role denied', await update('users/other', { role: 'unknown' }, 'admin'), false);
  await check('admin self demotion denied', await update('users/admin', { role: 'user' }, 'admin'), false);
  await check('self avatar allowed', await update('users/owner', { avatar: 'avatar1' }, 'owner'), true);
  for (const data of [
    { uid: 'owner', displayName: '', role: 'admin' },
    { uid: 'other', displayName: '', role: 'user' },
    { uid: 'owner', displayName: 'Forged', role: 'user' },
    { uid: 'owner', displayName: '', role: 'user', email: 'private@example.com' }
  ]) await check('public directory spoof or extra field denied', await seedAs('publicUsers/owner', data, 'owner'), false);
  await check('valid public directory allowed', await seedAs('publicUsers/owner', { uid: 'owner', displayName: '', role: 'user' }, 'owner'), true);
  for (const target of ['users/super', 'publicUsers/super', 'users/super/secret/info']) {
    await check('admin cannot delete superadmin data ' + target, await request('DELETE', `${base}/${target}`, undefined, 'admin'), false);
  }
  await check('atomic profile and directory creation', await request('POST', `${base}:commit`, { writes: [
    { update: { name: name('users/new-user'), fields: fields({ role: 'user', displayName: 'New' }) } },
    { update: { name: name('publicUsers/new-user'), fields: fields({ uid: 'new-user', role: 'user', displayName: 'New' }) } }
  ] }, 'admin'), true);
  await check('atomic role and directory change', await request('POST', `${base}:commit`, { writes: [
    { update: { name: name('users/new-user'), fields: fields({ role: 'gerceklestirmeci' }) }, updateMask: { fieldPaths: ['role'] } },
    { update: { name: name('publicUsers/new-user'), fields: fields({ uid: 'new-user', role: 'gerceklestirmeci', displayName: 'New' }) } }
  ] }, 'super'), true);
  await seed('users/deleted', { role: 'user', displayName: 'Deleted' });
  await seed('publicUsers/deleted', { uid: 'deleted', role: 'user', displayName: 'Deleted' });
  await seed('users/deleted/secret/info', { value: 'private' });
  await seed('projeler/deleted-owned', { userId: 'deleted', status: 'taslak' });
  await seed('projeler/deleted-owned/dosyalar/file', { chunk: 'private' });
  await seed('referans/deleted', { value: 'private' });
  await check('atomic user deletion', await request('POST', `${base}:commit`, { writes: [
    { delete: name('publicUsers/deleted') }, { delete: name('users/deleted/secret/info') }, { delete: name('users/deleted') }
  ] }, 'admin'), true);
  for (const uid of ['deleted', 'unregistered']) {
    for (const target of ['publicUsers/owner', 'projeler/deleted-owned', 'projeler/deleted-owned/dosyalar/file', 'referans/deleted']) {
      await check('unregistered read denied ' + uid + ' ' + target, await request('GET', `${base}/${target}`, undefined, uid), false);
    }
    await check('unregistered project write denied ' + uid, await update('projeler/deleted-owned', { isAdi: 'Changed' }, uid), false);
  }
  await seed('visionUsage/retired', { legacy: 'test' });
  for (const uid of ['owner', 'reviewer', 'admin']) {
    await check(`retired OCR counter read denied ${uid}`,
      await request('GET', `${base}/visionUsage/retired`, undefined, uid), false);
    await check(`retired OCR counter create denied ${uid}`,
      await request('PATCH', `${base}/visionUsage/new-${uid}`, {
        fields: { sayfaSayisi: { integerValue: '1' } }
      }, uid), false);
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
          if (suffix.includes('parcalar')) await seed(`${p}/dosyalar/file`, fileMeta(uid, true));
          await check(`create ${suffix} ${uid} ${status} locked=${locked}`,
            await request('PATCH', `${base}/${file}`, { fields: fields(suffix.includes('parcalar') ? { index: 0, chunk: header + 'A'.repeat(716800 - header.length) } : fileMeta(uid)) }, uid), allowed);
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
  const versioned = 'projeler/versioned';
  await seed(versioned, { userId: 'owner', status: 'taslak', data: 'before' });
  await check('financial data without revision denied', await update(versioned, { data: 'new' }, 'owner'), false);
  await check('legacy project first version allowed', await update(versioned, { data: 'new', revision: 1 }, 'owner'), true);
  await check('stale version denied', await update(versioned, { data: 'lost', revision: 1 }, 'owner'), false);
  await check('skipped version denied', await update(versioned, { data: 'lost', revision: 4 }, 'owner'), false);
  await check('next version allowed', await update(versioned, { data: 'next', revision: 2 }, 'owner'), true);
  await check('revision rollback denied', await update(versioned, { revision: 0 }, 'admin'), false);
  await check('admin financial change without revision denied', await update(versioned, { data: 'unversioned' }, 'admin'), false);
  await seed(versioned, { userId: 'owner', status: 'gonderildi', atananGerceklestirmeciUid: 'reviewer', revision: 2 });
  await check('reviewer approval with next version allowed', await update(versioned, { status: 'onaylandi', onaylandiBy: 'Reviewer', revision: 3 }, 'reviewer'), true);
  await check('reviewer repeated approval denied', await update(versioned, { onaylandiBy: 'Changed', revision: 4 }, 'reviewer'), false);
  await seed(versioned, { userId: 'owner', status: 'gonderildi', atananGerceklestirmeciUid: 'reviewer', revision: 3 });
  await check('reviewer return with next version allowed', await update(versioned, { status: 'geri_gonderildi', geriGonderNot: 'Düzelt', revision: 4 }, 'reviewer'), true);
  await reset('taslak');
  const frozen = { version: 1, firmaList: [], yukleniciList: [] };
  await check('snapshot can be captured at submission', await update(p, { status: 'gonderildi', belgeReferans: frozen }, 'owner'), true);
  await check('admin cannot rewrite stored tax exemption', await update(p, { kazananBasitUsul: true }, 'admin'), false);
  await check('admin cannot rewrite submitted snapshot', await update(p, { belgeReferans: { ...frozen, firmaList: [{ ad: 'Forged' }] } }, 'admin'), false);
  await seed(p, { userId: 'owner', status: 'geri_gonderildi', belgeReferans: frozen });
  await check('return snapshot cannot change before resubmission', await update(p, { belgeReferans: { ...frozen, firmaList: [{ ad: 'New' }] } }, 'owner'), false);
  await check('resubmission can refresh snapshot', await update(p, { status: 'gonderildi', atananGerceklestirmeciUid: 'reviewer', belgeReferans: { ...frozen, firmaList: [{ ad: 'New' }] } }, 'owner'), true);
  await reset('taslak');
  for (const [label, patch] of [
    ['HTML MIME', { tip: 'text/html', ad: 'fake.html' }], ['MIME-extension mismatch', { tip: 'application/pdf', ad: 'fake.png' }],
    ['HTML data URL', { data: 'data:text/html;base64,YWJj' }], ['extra field', { secret: 'extra' }],
    ['missing data', { data: null }], ['negative size', { boyut: -1 }], ['size exceeds limit', { boyut: 5242881 }],
    ['fake size', { boyut: 1000 }], ['forged uploader', { yukleyenUid: 'other' }], ['wrong timestamp type', { createdAt: 'fake' }],
    ['too many parts', { parcali: true, parcaSayisi: 60 }], ['unlisted nested path', { ad: 'test.pdf' }]
  ]) {
    const target = label === 'unlisted nested path' ? `${p}/dosyalar/security/unknown/child` : `${p}/dosyalar/security`;
    await request('DELETE', `${base}/${target}`, undefined, '', true);
    await check(label + ' denied', await seedAs(target, { ...fileMeta(), ...patch }, 'owner'), false);
  }
  const multipart = `${p}/dosyalar/multi`;
  await seed(multipart, fileMeta('owner', true));
  await check('last part exact aggregate size allowed', await seedAs(`${multipart}/parcalar/001`, { index: 1, chunk: 'A'.repeat(header.length) }, 'owner'), true);
  await request('DELETE', `${base}/${multipart}/parcalar/001`, undefined, '', true);
  await check('oversized aggregate part denied', await seedAs(`${multipart}/parcalar/001`, { index: 1, chunk: 'A'.repeat(header.length + 100) }, 'owner'), false);
  await check('mismatched part id denied', await seedAs(`${multipart}/parcalar/009`, { index: 1, chunk: 'AAAA' }, 'owner'), false);
  await check('out of range part denied', await seedAs(`${multipart}/parcalar/002`, { index: 2, chunk: 'AAAA' }, 'owner'), false);
  await check('malformed base64 denied', await seedAs(`${multipart}/parcalar/001`, { index: 1, chunk: '<script>' }, 'owner'), false);
  const raw = Buffer.alloc(5242880).toString('base64');
  const full = header + raw;
  const chunks = Array.from({ length: Math.ceil(full.length / 716800) }, (_, i) => full.slice(i * 716800, (i + 1) * 716800));
  await check('5 MB upload with ten chunks in atomic batch', await request('POST', `${base}:commit`, { writes: [
    { update: { name: name(`${p}/dosyalar/full`), fields: fields({ ...fileMeta('owner', true), boyut: 5242880, parcaSayisi: chunks.length }) } },
    ...chunks.map((chunk, index) => ({ update: { name: name(`${p}/dosyalar/full/parcalar/${String(index).padStart(3,'0')}`), fields: fields({ index, chunk }) } }))
  ] }, 'owner'), true);
  await reset('taslak');
  await check('project delete needs deletion phase', await request('DELETE', `${base}/${p}`, undefined, 'owner'), false);
  await check('start deletion phase', await update(p, { deleting: true, revision: 1 }, 'owner'), true);
  await check('new attachment during deletion denied', await seedAs(`${p}/dosyalar/during-delete`, fileMeta(), 'owner'), false);
  await check('new submission during deletion denied', await update(p, { status: 'gonderildi', atananGerceklestirmeciUid: 'reviewer' }, 'owner'), false);
  await check('edit during deletion denied', await update(p, { data: 'edit', revision: 2 }, 'owner'), false);
  await check('cancel deletion phase', await update(p, { deleting: false, revision: 2 }, 'owner'), true);
  await update(p, { deleting: true, revision: 3 }, 'owner');
  await check('atomic project and attachment cleanup', await request('POST', `${base}:commit`, { writes: [
    { delete: name(`${p}/dosyalar/full/parcalar/000`) }, { delete: name(`${p}/dosyalar/full`) }, { delete: name(p) }
  ] }, 'owner'), true);
  await seed(p, { userId: 'owner', status: 'taslak', deleting: true, revision: 1 });
  const manyFiles = Array.from({ length: 450 }, (_, i) => `${p}/dosyalar/bulk-${i}`);
  const bulkSeed = await request('POST', `${base}:commit`, { writes: manyFiles.map(path => ({ update: { name: name(path), fields: fields({ legacy: 'test' }) } })) }, '', true);
  assert.equal(bulkSeed.status, 200, await bulkSeed.text());
  await check('450 attachments and parent can be atomically deleted', await request('POST', `${base}:commit`, { writes: [...manyFiles.map(path => ({ delete: name(path) })), { delete: name(p) }] }, 'owner'), true);
  console.log(`${count} security checks passed.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
