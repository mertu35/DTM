const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const vendor = path.join(root, 'app/js/vendor');
const pdf = path.join(__dirname, 'node_modules/pdfjs-dist');
fs.mkdirSync(vendor, { recursive: true });
for (const name of ['pdf.min.mjs', 'pdf.worker.min.mjs']) {
  fs.copyFileSync(path.join(pdf, 'build', name), path.join(vendor, name));
}
fs.copyFileSync(path.join(pdf, 'LICENSE'), path.join(vendor, 'PDFJS-LICENSE'));
fs.cpSync(path.join(pdf, 'standard_fonts'), path.join(vendor, 'standard_fonts'), { recursive: true });
fs.copyFileSync(path.join(__dirname, 'node_modules/html2pdf.js/LICENSE'), path.join(vendor, 'HTML2PDF-LICENSE'));
const pkg = require('./package.json');
const lock = require('./package-lock.json');
const packages = Object.entries(pkg.dependencies).map(([name, version]) => ({
  name, version, integrity: lock.packages['node_modules/' + name].integrity
}));
const files = [];
function addFile(file) {
  files.push({ path: path.relative(root, file).replaceAll('\\', '/'),
    integrity: 'sha384-' + crypto.createHash('sha384').update(fs.readFileSync(file)).digest('base64') });
}
function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (entry.name !== 'manifest.json') addFile(full);
  }
}
collect(vendor);
const bundle = path.join(root, 'app/js/html2pdf.bundle.min.js');
addFile(bundle);
addFile(bundle + '.LICENSE.txt');
fs.writeFileSync(path.join(vendor, 'manifest.json'), JSON.stringify({
  build: 'npm ci --ignore-scripts && npm run build (in tools/vendor)', packages, files
}, null, 2) + '\n');
const integrity = files.find(file => file.path === 'app/js/html2pdf.bundle.min.js').integrity;
const indexPath = path.join(root, 'app/index.html');
const html = fs.readFileSync(indexPath, 'utf8').replace(
  /(<script src="js\/html2pdf\.bundle\.min\.js" integrity=")[^"]+(" crossorigin="anonymous">)/,
  '$1' + integrity + '$2');
fs.writeFileSync(indexPath, html);
console.log('Vendor files and integrity manifest updated.');
