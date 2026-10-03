const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
assert.match(policy, /script-src-attr 'none'/);
const scriptPolicy = policy.split(';').find(value => value.trim().startsWith('script-src '));
assert.ok(!/unsafe-inline|unsafe-eval|\*/.test(scriptPolicy));
assert.match(policy, /object-src 'none'/);
assert.match(policy, /base-uri 'self'/);
assert.match(policy, /form-action 'none'/);
assert.ok(!/<script(?:\s[^>]*)?>\s*[^<\s]/.test(html), 'no inline script');
for (const file of ['app/index.html', 'app/js/app.js', 'app/js/bootstrap.js']) {
  assert.ok(!/(?<![\w-])on(?:click|change|input|keydown|mouseover|mouseout)\s*=\s*"/.test(
    fs.readFileSync(path.join(root, file), 'utf8')), 'no inline event handlers in ' + file);
}
assert.ok(!/xlsx@|pdf\.js\/3\./.test(html), 'retired external libraries removed');
for (const tag of html.matchAll(/<script\b[^>]+src="https:\/\/[^>]+>/g)) {
  assert.match(tag[0], /integrity="sha384-[A-Za-z0-9+/=]+"/);
  assert.match(tag[0], /crossorigin="anonymous"/);
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'app/js/vendor/manifest.json')));
for (const file of manifest.files) {
  const integrity = 'sha384-' + crypto.createHash('sha384').update(fs.readFileSync(path.join(root, file.path))).digest('base64');
  assert.equal(integrity, file.integrity, file.path);
}
const bundleHash = manifest.files.find(file => file.path === 'app/js/html2pdf.bundle.min.js').integrity;
assert.ok(html.includes('integrity="' + bundleHash + '"'));
console.log(`CSP, external SRI and ${manifest.files.length} vendor integrity checks passed.`);
