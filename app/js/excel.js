// ===================== EXCEL.JS =====================
// Excel çıktısı: HTML-to-XLS yöntemi
// Resmi şablonla (1- TUTANAKLAR Y.M. VE PİYASA FİYAT ARAŞTIRMASI.xls) birebir uyumlu

const EXCEL_DESTEKLI_BELGELER = ['yaklasik-maliyet', 'teklif-tutanagi'];

// ── HTML tablosunu .xls olarak indir ──
function htmlIndirXls(htmlStr, dosyaAdi) {
  const blob = new Blob(['\ufeff' + htmlStr], {
    type: 'application/vnd.ms-excel;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dosyaAdi.replace(/\.xlsx?$/, '') + '.xls';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

// ── Excel HTML sarıcısı (MS Office namespace'leriyle) ──
function excelHtmlSaric(icerik, sayfaAdi) {
  return `<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:x='urn:schemas-microsoft-com:office:excel'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<!--[if gte mso 9]><xml>
 <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
  <x:Name>${sayfaAdi}</x:Name>
  <x:WorksheetOptions>
    <x:DisplayGridlines/>
    <x:FitToPage/>
    <x:FitWidth>1</x:FitWidth>
  </x:WorksheetOptions>
 </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
</xml><![endif]-->
<style>
  body { font-family: Arial, sans-serif; font-size: 9pt; }
  table { border-collapse: collapse; }
  td, th {
    border: 1px solid #000;
    padding: 3px 5px;
    vertical-align: middle;
    white-space: normal;
    word-wrap: break-word;
  }
  .no-border, .no-border td, .no-border th { border: none !important; }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: bold; }
  .italic { font-style: italic; }
  /* Başlık satırı */
  .baslik { font-size: 13pt; font-weight: bold; text-align: center; border: none; }
  /* Tablo başlıkları */
  .grup-h  { background-color: #1F3864; color: #fff; font-weight: bold; text-align: center; font-size: 9pt; }
  .firma-h { background-color: #2F5496; color: #fff; font-weight: bold; text-align: center; font-size: 9pt; }
  .sutun-h { background-color: #BDD7EE; font-weight: bold; text-align: center; font-size: 8pt; }
  /* Info satırları */
  .etiket  { background-color: #F2F2F2; font-weight: bold; vertical-align: middle; }
  /* Toplam satırı */
  .toplam td { background-color: #F2F2F2; font-weight: bold; }
  /* Kazanan bölümü */
  .kazanan-h { background-color: #E2EFDA; font-weight: bold; text-align: center; }
  /* Metin kutusu */
  .metin-kutu { border: 2px solid #000 !important; padding: 6px 8px; text-align: justify; line-height: 1.5; }
  /* Sayı formatı */
  .rakam { text-align: right; mso-number-format:"\#\,\#\#0\.00"; }
  /* Boş ayırıcı satır */
  .bos-satir td { border: none; height: 6px; }
  /* Genel */
  .tc-baslik { font-weight: bold; text-align: center; border: none; font-size: 10pt; }
</style>
</head>
<body>
${icerik}
</body>
</html>`;
}

// ── Para formatı yardımcısı ──
function fmtPara(sayi) {
  if (!sayi && sayi !== 0) return '';
  if (typeof sayi !== 'number') sayi = parseFloat(sayi) || 0;
  return sayi.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function tdRakam(sayi, bold) {
  const v = fmtPara(sayi);
  if (!v) return `<td></td>`;
  return `<td class="rakam${bold ? ' bold' : ''}" style="mso-number-format:'\\#\\,\\#\\#0\\.00'">${v}</td>`;
}

// =============================================
// ===== YAKLAŞIK MALİYET TESPİT TUTANAĞI =====
// =============================================
// Şablon: 15 sütun (A=0 ... O=14)
// A,B  : boş        (0,1)
// C    : S.NO        (2)
// D    : İş Adı      (3)
// E    : Miktar      (4)
// F    : boş sep     (5)
// G,H  : Firma 1    (6,7)
// I,J  : Firma 2    (8,9)
// K,L  : Firma 3    (10,11)
// M,N  : YM         (12,13)
// O    : boş        (14)
function exportYaklasikMaliyetExcel(proje, referans) {
  const C = 15; // toplam sütun sayısı
  const kalemler = getKalemler(proje);
  const f1 = proje.ymFirmalar[0] || { ad: '', fiyatlar: [] };
  const f2 = proje.ymFirmalar[1] || { ad: '', fiyatlar: [] };
  const f3 = proje.ymFirmalar[2] || { ad: '', fiyatlar: [] };
  const ym = hesaplaYaklasikMaliyet(proje);
  const ymYazi = sayidanYaziya(ym);
  const t1 = hesaplaYMFirmaToplam(f1, kalemler);
  const t2 = hesaplaYMFirmaToplam(f2, kalemler);
  const t3 = hesaplaYMFirmaToplam(f3, kalemler);
  const ymGorevliler = typeof getAktifGorevliler === 'function'
    ? getAktifGorevliler(proje.ymGorevliler || []) : (proje.ymGorevliler || []).filter(g => g.ad);
  const ymTutanakT = proje.ymTutanakTarihiAyni !== false
    ? proje.ymOnayTarihi : (proje.ymTutanakTarihi || proje.ymOnayTarihi);
  const firmaAdet = proje.ymFirmalar.filter(f => f.ad).length;
  const mudurlukMetin = proje.mudurluk || '';

  // Kalem satırları
  let kalemRows = '';
  kalemler.forEach((k, i) => {
    const mik  = parseFloat(k.miktar) || 0;
    const bf1  = parseFloat(f1.fiyatlar[i]) || 0;
    const bf2  = parseFloat(f2.fiyatlar[i]) || 0;
    const bf3  = parseFloat(f3.fiyatlar[i]) || 0;
    const ortT = hesaplaYMKalemOrtalama(proje, i);
    const ortBF = ortT / (mik || 1);
    kalemRows += `<tr>
      <td></td><td></td>
      <td class="center">${i + 1}</td>
      <td>${k.ad || ''}</td>
      <td class="center">${mik ? mik.toLocaleString('tr-TR') : ''}</td>
      <td></td>
      ${tdRakam(bf1 || null)}${tdRakam(bf1 * mik || null)}
      ${tdRakam(bf2 || null)}${tdRakam(bf2 * mik || null)}
      ${tdRakam(bf3 || null)}${tdRakam(bf3 * mik || null)}
      ${tdRakam(ortBF || null)}${tdRakam(ortT || null)}
      <td></td>
    </tr>`;
  });

  // Görevliler — her biri ayrı bir td (solda), OLUR sağda
  const gorevliSayisi = ymGorevliler.length || 1;
  // İmza satırlarını oluştur
  // Şablonda: dayanaklar satırında görevli adı sağda (col 6'dan itibaren)
  //           3 satır sonra da "O L U R" yine col 6'da
  const gorevliAdlar = ymGorevliler.map(g => g.ad || '').join('\n');
  const gorevliUnvanlar = ymGorevliler.map(g => g.unvan || '').join('\n');

  const html = `<table style="width:100%">

  <!-- ── Başlık ── -->
  <tr>
    <td colspan="${C}" class="baslik">YAKLAŞIK MALİYET TESPİT TUTANAĞI</td>
  </tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>

  <!-- ── Proje Bilgileri ── -->
  <tr>
    <td class="no-border" style="border:none"></td>
    <td colspan="5" class="etiket">İdarenin Adı</td>
    <td colspan="9">${proje.idareAdi || ''}</td>
  </tr>
  <tr>
    <td class="no-border" style="border:none"></td>
    <td colspan="5" class="etiket">Yapılan İş / Mal / Hizmetin Adı, Niteliği</td>
    <td colspan="9">${proje.isAdi || ''}</td>
  </tr>
  <tr>
    <td class="no-border" style="border:none"></td>
    <td colspan="5" class="etiket">Alım ve Yetkilendirilen Görevlilere İlişkin Onay Belgesi /<br>Görevlendirme Onayı Tarih ve No.su</td>
    <td colspan="9">${formatDate(proje.ymOnayTarihi)} Tarih ve ${proje.ymOnayNo || ''} Sayılı Olur</td>
  </tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>

  <!-- ── Tablo Başlıkları (3 satır) ── -->
  <tr>
    <td colspan="2" style="border:none"></td>
    <th rowspan="3" class="sutun-h">S.NO</th>
    <th rowspan="3" class="sutun-h">YAPILAN İŞ / MAL / HİZMETİN ADI</th>
    <th rowspan="3" class="sutun-h">MİKTARI</th>
    <td rowspan="3" style="border:none"></td>
    <th colspan="2" class="grup-h">1 FİRMA</th>
    <th colspan="2" class="grup-h">2. FİRMA</th>
    <th colspan="2" class="grup-h">3. FİRMA</th>
    <th colspan="2" class="grup-h">YAKLAŞIK MALİYET</th>
    <td rowspan="3" style="border:none"></td>
  </tr>
  <tr>
    <td colspan="2" style="border:none"></td>
    <th colspan="2" class="firma-h">${f1.ad || '-'}</th>
    <th colspan="2" class="firma-h">${f2.ad || '-'}</th>
    <th colspan="2" class="firma-h">${f3.ad || '-'}</th>
    <th colspan="2" class="firma-h"></th>
  </tr>
  <tr>
    <td colspan="2" style="border:none"></td>
    <th class="sutun-h">BİRİM FİYAT (TL)</th><th class="sutun-h">TOPLAM<br>FİYAT<br>(TL)</th>
    <th class="sutun-h">BİRİM FİYAT (TL)</th><th class="sutun-h">TOPLAM<br>FİYAT<br>(TL)</th>
    <th class="sutun-h">BİRİM FİYAT (TL)</th><th class="sutun-h">TOPLAM<br>FİYAT<br>(TL)</th>
    <th class="sutun-h">BİRİM FİYAT (TL)</th><th class="sutun-h">TOPLAM<br>FİYAT<br>(TL)</th>
  </tr>

  <!-- ── Kalem Satırları ── -->
  ${kalemRows}

  <!-- ── Toplam ── -->
  <tr class="toplam">
    <td></td><td></td>
    <td></td>
    <td class="bold">TOPLAM:</td>
    <td></td><td></td>
    <td></td>${tdRakam(t1, true)}
    <td></td>${tdRakam(t2, true)}
    <td></td>${tdRakam(t3, true)}
    <td></td>${tdRakam(ym, true)}
    <td></td>
  </tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>

  <!-- ── Açıklayıcı Metin ── -->
  <tr>
    <td colspan="2" style="border:none"></td>
    <td colspan="13" class="metin-kutu" style="text-align:justify; line-height:1.5">
      Karaman İl Özel İdaresi ${mudurlukMetin} yetkilisince görevlendirilmem nedeniyle yukarıda özelliği belirtilen işin yapılması için 4734 sayılı Kamu İhale Kanununun 9. Maddesi gereğince yaklaşık maliyet çıkarılmış olup, ihale konusu işin <b>${fmtPara(ym)} TL</b> (${ymYazi}) (KDV hariç) bedelle ihaleye çıkması belirlenmiş ve iş bu tutanak tanzimen düzenlenmiştir. <b>${formatDate(ymTutanakT)}</b>
    </td>
  </tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>

  <!-- ── DAYANAKLAR + İMZALAR (aynı bölge) ── -->
  <tr>
    <td colspan="2" style="border:none"></td>
    <td colspan="4" class="bold" style="border:none">DAYANAKLAR</td>
    <td colspan="9" class="center bold" style="border:none">${gorevliAdlar}</td>
  </tr>
  <tr>
    <td colspan="2" style="border:none"></td>
    <td colspan="4" style="border:none">EK - 1 : Piyasa Fiyat Araştırması ( ${firmaAdet} Adet )</td>
    <td colspan="9" class="center" style="border:none">${gorevliUnvanlar}</td>
  </tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>
  <tr>
    <td colspan="6" style="border:none"></td>
    <td colspan="9" class="center bold" style="border:none">O &nbsp; L &nbsp; U &nbsp; R</td>
  </tr>
  <tr>
    <td colspan="6" style="border:none"></td>
    <td colspan="9" class="center" style="border:none">${formatDate(ymTutanakT)}</td>
  </tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>
  <tr>
    <td colspan="6" style="border:none"></td>
    <td colspan="9" class="center bold" style="border:none">${proje.onaylayanAmir?.ad || ''}</td>
  </tr>
  <tr>
    <td colspan="6" style="border:none"></td>
    <td colspan="9" class="center" style="border:none">${proje.onaylayanAmir?.unvan || ''}</td>
  </tr>

</table>`;

  const dosyaAdi = `Yaklaşık Maliyet Tespit Tutanağı - ${(proje.isAdi || 'Proje').replace(/[<>:"/\\|?*]/g, '-').substring(0, 60)}`;
  htmlIndirXls(excelHtmlSaric(html, 'Yaklaşık Maliyet Tespit Tutnak'), dosyaAdi);
}

// =============================
// ===== TEKLİF TUTANAĞI =====
// =============================
// Şablon: 17 sütun (A=0 ... Q=16)
// A     : boş         (0)
// B     : SIRA NO / etiket (1)
// C-F   : İş Adı     (2-5, colspan 4)
// G     : MİKTAR     (6)
// H     : BİRİM      (7)
// I,J   : Firma 1    (8,9)
// K,L   : Firma 2    (10,11)
// M,N   : Firma 3    (12,13)
// O,P   : Firma 4    (14,15) — yok ise boş
// Q     : boş        (16)
function exportTeklifTutanagiExcel(proje, referans) {
  const C = 17;
  const kalemler = getKalemler(proje);
  const f1 = proje.teklifFirmalar[0] || { ad: '', fiyatlar: [] };
  const f2 = proje.teklifFirmalar[1] || { ad: '', fiyatlar: [] };
  const f3 = proje.teklifFirmalar[2] || { ad: '', fiyatlar: [] };
  const kazananIdx = proje.kazananFirmaIndex >= 0 ? proje.kazananFirmaIndex : hesaplaKazananFirma(proje);
  const kazananFirmaObj = kazananIdx >= 0 ? proje.teklifFirmalar[kazananIdx] : null;
  const kazanan = kazananIdx >= 0 ? getKazananFirma(proje, referans) : null;
  const t1 = hesaplaTeklifFirmaToplam(f1, kalemler);
  const t2 = hesaplaTeklifFirmaToplam(f2, kalemler);
  const t3 = hesaplaTeklifFirmaToplam(f3, kalemler);
  const dtGorevliler = typeof getAktifGorevliler === 'function'
    ? getAktifGorevliler(proje.dtGorevliler || []) : (proje.dtGorevliler || []).filter(g => g.ad);
  const dtTutanakT = proje.dtTutanakTarihiAyni !== false
    ? proje.dtOnayTarihi : (proje.dtTutanakTarihi || proje.dtOnayTarihi);

  // Teklif kalem satırları
  let teklifRows = '';
  kalemler.forEach((k, i) => {
    const mik = parseFloat(k.miktar) || 0;
    const p1 = parseFloat(f1.fiyatlar[i]) || null;
    const p2 = parseFloat(f2.fiyatlar[i]) || null;
    const p3 = parseFloat(f3.fiyatlar[i]) || null;
    teklifRows += `<tr>
      <td></td>
      <td class="center">${i + 1}</td>
      <td colspan="4">${k.ad || ''}</td>
      <td class="center">${mik ? mik.toLocaleString('tr-TR') : ''}</td>
      <td class="center">${k.birim || ''}</td>
      ${tdRakam(p1)}<td class="center" style="font-size:8pt">+KDV</td>
      ${tdRakam(p2)}<td class="center" style="font-size:8pt">+KDV</td>
      ${tdRakam(p3)}<td class="center" style="font-size:8pt">+KDV</td>
      <td></td><td></td>
      <td></td>
    </tr>`;
  });

  // Kazanan kalem satırları
  let kazananRows = '';
  if (kazanan && kazananFirmaObj) {
    kalemler.forEach((k, i) => {
      const mik = parseFloat(k.miktar) || 0;
      const fiyat = parseFloat(kazananFirmaObj.fiyatlar[i]) || null;
      kazananRows += `<tr>
        <td></td>
        <td class="center">${i + 1}</td>
        <td colspan="4">${k.ad || ''}</td>
        <td class="center">${mik ? mik.toLocaleString('tr-TR') : ''}</td>
        <td class="center">${k.birim || ''}</td>
        <td class="center">${kazanan.ad || ''}</td>
        <td></td>
        ${tdRakam(fiyat)}<td class="center" style="font-size:8pt">+KDV</td>
        <td colspan="2">${kazanan.adres || ''}</td>
        <td></td>
      </tr>`;
    });
  }

  // Görevli bilgileri (şablonda Ad Soyadı + Ünvanı ayrı satır, etiket-değer formatında)
  const gorevliSatirlar = dtGorevliler.length > 0
    ? dtGorevliler.map(g => `
        <tr>
          <td colspan="2" style="border:none"></td>
          <td colspan="2" class="etiket" style="border:1px solid #000">Adı Soyadı</td>
          <td style="border:1px solid #000" class="center">:</td>
          <td colspan="3" style="border:1px solid #000">${g.ad || ''}</td>
          <td colspan="9" style="border:none"></td>
        </tr>
        <tr>
          <td colspan="2" style="border:none"></td>
          <td colspan="2" class="etiket" style="border:1px solid #000">Ünvanı</td>
          <td style="border:1px solid #000" class="center">:</td>
          <td colspan="3" style="border:1px solid #000">${g.unvan || ''}</td>
          <td colspan="9" style="border:none"></td>
        </tr>
        <tr class="bos-satir"><td colspan="${C}"></td></tr>`
    ).join('')
    : `<tr>
        <td colspan="2" style="border:none"></td>
        <td colspan="2" class="etiket" style="border:1px solid #000">Adı Soyadı</td>
        <td style="border:1px solid #000" class="center">:</td>
        <td colspan="3" style="border:1px solid #000"></td>
        <td colspan="9" style="border:none"></td>
      </tr>
      <tr>
        <td colspan="2" style="border:none"></td>
        <td colspan="2" class="etiket" style="border:1px solid #000">Ünvanı</td>
        <td style="border:1px solid #000" class="center">:</td>
        <td colspan="3" style="border:1px solid #000"></td>
        <td colspan="9" style="border:none"></td>
      </tr>`;

  const kazananToplam = kazanan && kazananFirmaObj
    ? hesaplaTeklifFirmaToplam(kazananFirmaObj, kalemler) : 0;

  const html = `<table style="width:100%">

  <!-- ── T.C. Üst Başlık ── -->
  <tr>
    <td colspan="${C}" class="tc-baslik">
      T.C.<br>KARAMAN İL ÖZEL İDARESİ<br>${proje.mudurluk || 'YATIRIM VE İNŞAAT MÜDÜRLÜĞÜ'}
    </td>
  </tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>

  <!-- ── Belge Başlığı ── -->
  <tr>
    <td colspan="${C}" class="baslik">TEKLİF TUTANAĞI</td>
  </tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>

  <!-- ── Proje Bilgileri ── -->
  <tr>
    <td></td>
    <td colspan="5" class="etiket">İdarenin Adı</td>
    <td class="center bold">:</td>
    <td colspan="10">${proje.idareAdi || ''}</td>
  </tr>
  <tr>
    <td></td>
    <td colspan="5" class="etiket">Yapılan İş / Mal / Hizmetin Adı, Niteliği</td>
    <td class="center bold">:</td>
    <td colspan="10">${proje.isAdi || ''}</td>
  </tr>
  <tr>
    <td></td>
    <td colspan="5" class="etiket">Alım ve Yetkilendirilen Görevlilere İlişkin Onay Belgesi /<br>Görevlendirme Onayı Tarih ve No.su</td>
    <td class="center bold">:</td>
    <td colspan="10">${formatDate(proje.dtOnayTarihi)} Tarih ve ${proje.dtOnayNo || ''} Sayılı Olur</td>
  </tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>

  <!-- ── Teklif Tablosu Başlıkları ── -->
  <tr>
    <td style="border:none"></td>
    <th rowspan="3" class="sutun-h">SIRA<br>NO</th>
    <th colspan="4" rowspan="3" class="sutun-h">MAL / HİZMET / YAPIM İŞİ</th>
    <th rowspan="3" class="sutun-h">MİKTAR</th>
    <th rowspan="3" class="sutun-h">BİRİM</th>
    <th colspan="9" class="grup-h">KİŞİ / FİRMA / FİRMALAR VE FİYAT TEKLİFLERİ</th>
    <td rowspan="3" style="border:none"></td>
  </tr>
  <tr>
    <td style="border:none"></td>
    <th colspan="2" class="sutun-h">1. (Kişi / Firma Adı)</th>
    <th colspan="2" class="sutun-h">2. (Kişi / Firma Adı)</th>
    <th colspan="2" class="sutun-h">3. (Kişi / Firma Adı)</th>
    <th colspan="3"></th>
  </tr>
  <tr>
    <td style="border:none"></td>
    <th colspan="2" class="firma-h">${f1.ad || '-'}</th>
    <th colspan="2" class="firma-h">${f2.ad || '-'}</th>
    <th colspan="2" class="firma-h">${f3.ad || '-'}</th>
    <th colspan="3"></th>
  </tr>

  <!-- ── Teklif Kalemleri ── -->
  ${teklifRows}

  <!-- ── Teklif Toplamı ── -->
  <tr class="bos-satir"><td colspan="${C}"></td></tr>

  <!-- ── Uygun Görülen Bölümü ── -->
  <tr>
    <td style="border:none"></td>
    <th class="sutun-h">SIRA<br>NO</th>
    <th colspan="4" class="sutun-h">MAL / HİZMET / YAPIM İŞİ</th>
    <th class="sutun-h">MİKTAR</th>
    <th class="sutun-h">BİRİM</th>
    <th colspan="9" class="grup-h">UYGUN GÖRÜLEN KİŞİ / FİRMA / FİRMALAR</th>
    <td style="border:none"></td>
  </tr>
  <tr>
    <td style="border:none"></td>
    <td></td><td colspan="4"></td><td></td><td></td>
    <th colspan="2" class="sutun-h">ADI</th>
    <th colspan="2" class="sutun-h">Firmaya ait<br>Fiyat Teklifi</th>
    <th colspan="5" class="sutun-h">ADRESİ</th>
    <td style="border:none"></td>
  </tr>
  ${kazananRows || `<tr>
    <td style="border:none"></td>
    <td></td><td colspan="4"></td><td></td><td></td>
    <td colspan="2"></td><td colspan="2"></td><td colspan="5"></td>
    <td style="border:none"></td>
  </tr>`}

  <!-- Kazanan Toplam -->
  ${kazanan ? `<tr class="toplam">
    <td style="border:none"></td>
    <td colspan="7" class="bold">TOPLAM (KDV Hariç)</td>
    <td colspan="2"></td>
    ${tdRakam(kazananToplam, true)}
    <td></td>
    <td colspan="5"></td>
    <td style="border:none"></td>
  </tr>` : ''}

  <tr class="bos-satir"><td colspan="${C}"></td></tr>

  <!-- ── Açıklayıcı Metin ── -->
  <tr>
    <td colspan="2" style="border:none"></td>
    <td colspan="15" class="metin-kutu" style="text-align:justify;line-height:1.5">
      4734 sayılı Kamu İhale Kanunu'nun 22 nci Maddesi uyarınca <b>doğrudan temin usulüyle</b>
      yapılacak alımlara ilişkin yapılan piyasa araştırmasında teklif edilen fiyatlar değerlendirilerek
      yukarıda adı ve adresleri belirtilen
      ${kazanan ? `<b>${kazanan.ad}</b>'den` : '…'}
      alım yapılması uygun görülmüştür. <b>${formatDate(dtTutanakT)}</b>
    </td>
  </tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>

  <!-- ── Piyasa Fiyat Araştırması Görevlisi ── -->
  <tr>
    <td colspan="2" style="border:none"></td>
    <td colspan="6" class="bold" style="border:none">Piyasa Fiyat Araştırması Görevlisi / Görevlileri</td>
    <td colspan="9" style="border:none"></td>
  </tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>
  ${gorevliSatirlar}

  <!-- ── UYGUNDUR ── -->
  <tr>
    <td colspan="12" style="border:none"></td>
    <td colspan="5" class="center bold" style="border:none">UYGUNDUR</td>
  </tr>
  <tr class="bos-satir"><td colspan="${C}"></td></tr>
  <tr>
    <td colspan="12" style="border:none"></td>
    <td colspan="5" class="center bold" style="border:none">${proje.onaylayanAmir?.ad || ''}</td>
  </tr>
  <tr>
    <td colspan="12" style="border:none"></td>
    <td colspan="5" class="center" style="border:none">${proje.onaylayanAmir?.unvan || ''}</td>
  </tr>

</table>`;

  const dosyaAdi = `Teklif Tutanağı - ${(proje.isAdi || 'Proje').replace(/[<>:"/\\|?*]/g, '-').substring(0, 60)}`;
  htmlIndirXls(excelHtmlSaric(html, 'Teklif Tutanağı'), dosyaAdi);
}

// ── Belge ID'sine göre Excel üret ──
function belgeIdindenExcelUret(belgeId, proje, referans) {
  switch (belgeId) {
    case 'yaklasik-maliyet': exportYaklasikMaliyetExcel(proje, referans); return true;
    case 'teklif-tutanagi':  exportTeklifTutanagiExcel(proje, referans); return true;
    default: return false;
  }
}
