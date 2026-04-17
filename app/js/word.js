// ===================== WORD.JS =====================
// Word çıktısı: HTML-to-DOC yöntemi
// HTML formatındaki metni Microsoft Word belgesi olarak (.doc) indirir.

const WORD_DESTEKLI_BELGELER = ['sozlesme', 'teknik-sartname', 'hakedis-raporu'];

// ── HTML tablosunu/metnini .doc olarak indir ──
function htmlIndirDoc(htmlStr, dosyaAdi) {
  const blob = new Blob(['\ufeff' + htmlStr], {
    type: 'application/msword;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dosyaAdi.replace(/\.docx?$/, '') + '.doc';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

// ── Word HTML sarıcısı ──
function wordHtmlSaric(icerik, landscape = false) {
  // Landscape sayfa ayarları Word-specific CSS
  const pageDef = landscape 
    ? `@page WordSection1 { size:841.9pt 595.3pt; mso-page-orientation:landscape; margin:36.0pt 36.0pt 36.0pt 36.0pt; mso-header-margin:35.4pt; mso-footer-margin:35.4pt; mso-paper-source:0; }`
    : `@page WordSection1 { size:595.3pt 841.9pt; margin:70.85pt 70.85pt 70.85pt 70.85pt; mso-header-margin:35.4pt; mso-footer-margin:35.4pt; mso-paper-source:0; }`;

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>DTM Belge</title>
<!--[if gte mso 9]>
<xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
 </w:WordDocument>
</xml>
<![endif]-->
<style>
  /* Sayfa Yapısı */
  ${pageDef}
  div.WordSection1 { page: WordSection1; }

  /* Genel Stiller */
  body { 
    font-family: "Times New Roman", Times, serif; 
    font-size: 11pt; 
    line-height: 1.5;
  }
  
  /* Tablo Mimarisi */
  table { 
    width: 100%; 
    border-collapse: collapse; 
    border: none;
    mso-table-layout-alt: fixed;
    mso-padding-alt: 0cm 5.4pt 0cm 5.4pt;
  }
  td, th { 
    padding: 4px 6px; 
    border: 1px solid windowtext; 
    vertical-align: middle; 
  }
  
  /* Şekillendirmeler */
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .italic { font-style: italic; }
  .baslik { font-size: 12pt; font-weight: bold; text-align: center; }
  .etiket { font-weight: bold; }
  
  /* Belge spesifik stilleri içeri yerleştirme (document.js stillerine karşılık gelir) */
  .madde { margin-bottom: 8pt; text-align: justify; }
  .madde p { margin: 0; padding: 0; text-align: justify; }
  .sozlesme-imza { margin-top: 30pt; }
  .imza-sutun { width: 50%; text-align: center; vertical-align: top; border: none; }
  .sozlesme-sayfa-header { text-align: center; font-weight: bold; font-size: 10pt; padding: 4px 0; border: none; }
  
  /* Çizgisiz tablo hücreleri */
  .no-border, table.no-border td { border: none !important; }
</style>
</head>
<body>
<div class="WordSection1">
${icerik}
</div>
</body>
</html>`;
}

// ── Belge ID'sine göre Word üret ──
function belgeIdindenWordUret(belgeId, proje, referans) {
  let icerik = '';
  let landscape = false;
  let dosyaAdi = '';

  switch (belgeId) {
    case 'sozlesme':
      icerik = renderSozlesme(proje, referans);
      dosyaAdi = `Sözleşme - ${proje.isAdi || 'Proje'}`;
      break;
    case 'teknik-sartname':
      icerik = renderTeknikSartname(proje, referans);
      dosyaAdi = `Teknik Şartname - ${proje.isAdi || 'Proje'}`;
      break;
    case 'hakedis-raporu':
      icerik = renderHakedisRaporu(proje, referans);
      landscape = true; // Hakediş raporu genelde yataydır
      dosyaAdi = `Hakediş Raporu - ${proje.isAdi || 'Proje'}`;
      break;
    default:
      return false;
  }

  // HTML'i doc şablonuna sarıp indir
  const tamHtml = wordHtmlSaric(icerik, landscape);
  const guvenliDosyaAdi = dosyaAdi.replace(/[<>:"/\\|?*]/g, '-').substring(0, 80);
  
  htmlIndirDoc(tamHtml, guvenliDosyaAdi);
  return true;
}
