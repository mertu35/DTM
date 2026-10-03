# Vendored browser libraries

Runtime versions are pinned in package.json/package-lock.json:

- PDF.js 6.3.289 (text reader and matching worker, served locally).
- html2pdf.js 0.14.0, rebuilt from source with jsPDF 4.2.1,
  DOMPurify 3.4.16 and html2canvas 1.4.1.

The upstream prebuilt html2pdf bundle embeds older jsPDF/DOMPurify versions.
Auditing a freshly resolved npm dependency tree alone does not audit that
prebuilt bundle. This build uses the pinned, audited dependencies instead.

```powershell
cd tools/vendor
npm ci --ignore-scripts
npm run build
npm run audit:runtime
```

The build refreshes local PDF.js assets, licenses, the SHA-384 inventory in
app/js/vendor/manifest.json and the export bundle SRI in app/index.html.
Commit those artifacts and the lockfile together. Re-run browser PDF and
CSP tests after updating. .gitattributes preserves integrity-pinned bytes
across Windows and Linux checkouts.

SheetJS was removed because the application exports Excel-compatible HTML
without using XLSX APIs. Existing Excel exports remain available.

Relevant primary advisories:

- https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq
- https://github.com/eKoopmans/html2pdf.js/security/advisories/GHSA-w8x4-x68c-m6fc
- https://github.com/cure53/DOMPurify/security/advisories
- https://github.com/parallax/jsPDF/security/advisories

The CSP forbids inline scripts, inline event handlers and eval. Inline CSS
remains allowed for the existing document/form layouts. GitHub Pages uses
an HTML meta policy; frame-ancestors requires a hosting response header and
cannot be enforced through this meta tag.
