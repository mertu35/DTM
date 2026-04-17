// ===================== EXCEL.JS =====================
// Excel çıktısı: HTML-to-XLS yöntemi (SheetJS CE cell style desteklemiyor)
// Excel, HTML formatındaki .xls dosyalarını border/renk/merge ile açar.

const EXCEL_DESTEKLI_BELGELER = ['yaklasik-maliyet', 'teklif-tutanagi'];

// ── Ortak: HTML tablosunu .xls olarak indir ──
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

// ── Excel HTML sarıcısı ──
function excelHtmlSaric(icerik, sayfaAdi) {
  return `<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:x='urn:schemas-microsoft-com:office:excel'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<!--[if gte mso 9]><xml>
 <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
  <x:Name>${sayfaAdi}</x:Name>
  <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
 </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
</xml><![endif]-->
<style>
  body { font-family: Arial, sans-serif; font-size: 9pt; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #000; padding: 3px 6px; vertical-align: middle; }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: bold; }
  .baslik-satir td { font-size: 13pt; font-weight: bold; text-align: center; border: none; }
  .no-border td { border: none; }
  .grup-h { background-color: #1F3864; color: #fff; font-weight: bold; text-align: center; }
  .firma-h { background-color: #2F5496; color: #fff; font-weight: bold; text-align: center; }
  .sutun-h { background-color: #BDD7EE; font-weight: bold; text-align: center; }
  .toplam-satir td { background-color: #F2F2F2; font-weight: bold; }
  .etiket-h { background-color: #F2F2F2; font-weight: bold; }
  .metin-kutu td { border: 2px solid #000; padding: 8px; text-align: justify; line-height: 1.4; }
  .kazanan-h td { background-color: #E2EFDA; font-weight: bold; }
  .rakam { text-align: right; mso-number-format:"#,##0.00"; }
</style>
</head><body>
${icerik}
</body></html>`;
}

// ── Para formatı (rakam) ──
function exRakam(sayi) {
  if (!sayi || sayi === 0) return '';
  return `<td class="rakam" style="mso-number-format:'#,##0.00'">${
    typeof formatCurrency === 'function' ? formatCurrency(sayi) : sayi.toLocaleString('tr-TR', { minimumFractionDigits: 2 })
  }</td>`;
}
function exRakamBold(sayi) {
  if (!sayi || sayi === 0) return '<td></td>';
  return `<td class="rakam bold" style="mso-number-format:'#,##0.00'"><b>${
    typeof formatCurrency === 'function' ? formatCurrency(sayi) : sayi.toLocaleString('tr-TR', { minimumFractionDigits: 2 })
  }</b></td>`;
}

// ===== YAKLAŞIK MALİYET EXCEL =====
function exportYaklasikMaliyetExcel(proje, referans) {
  const kalemler   = getKalemler(proje);
  const f1 = proje.ymFirmalar[0] || { ad: '', fiyatlar: [] };
  const f2 = proje.ymFirmalar[1] || { ad: '', fiyatlar: [] };
  const f3 = proje.ymFirmalar[2] || { ad: '', fiyatlar: [] };
  const ym = hesaplaYaklasikMaliyet(proje);
  const ymYazi = sayidanYaziya(ym);
  const ymGorevliler = typeof getAktifGorevliler === 'function'
    ? getAktifGorevliler(proje.ymGorevliler || []) : [];
  const ymTutanakT = proje.ymTutanakTarihiAyni !== false
    ? proje.ymOnayTarihi : (proje.ymTutanakTarihi || proje.ymOnayTarihi);
  const t1Top = hesaplaYMFirmaToplam(f1, kalemler);
  const t2Top = hesaplaYMFirmaToplam(f2, kalemler);
  const t3Top = hesaplaYMFirmaToplam(f3, kalemler);
  const COL = 11; // toplam sütun sayısı

  // Kalem satırları
  let kalemRows = '';
  kalemler.forEach((k, i) => {
    const mik  = parseFloat(k.miktar) || 0;
    const bf1  = f1.fiyatlar[i] || 0;
    const bf2  = f2.fiyatlar[i] || 0;
    const bf3  = f3.fiyatlar[i] || 0;
    const ortT = hesaplaYMKalemOrtalama(proje, i);
    const ortBF = ortT / (mik || 1);
    kalemRows += `<tr>
      <td class="center">${i + 1}</td>
      <td>${k.ad || ''}</td>
      <td class="center">${mik}</td>
      ${exRakam(bf1 || null)} ${exRakam(bf1 * mik || null)}
      ${exRakam(bf2 || null)} ${exRakam(bf2 * mik || null)}
      ${exRakam(bf3 || null)} ${exRakam(bf3 * mik || null)}
      ${exRakam(ortBF || null)} ${exRakam(ortT || null)}
    </tr>`;
  });

  // Görevli imzaları
  const gorevliImzalar = ymGorevliler.map(g =>
    `<td class="center">${g.ad || ''}<br/><small>${g.unvan || ''}</small></td>`
  ).join('');
  const bosPad = ymGorevliler.length > 0
    ? `<td colspan="${Math.max(1, 9 - ymGorevliler.length)}"></td>` : '<td colspan="9"></td>';

  const html = `<table>
  <tr class="baslik-satir"><td colspan="${COL}">YAKLAŞIK MALİYET TESPİT TUTANAĞI</td></tr>
  <tr class="no-border"><td colspan="${COL}">&nbsp;</td></tr>

  <!-- Proje Bilgileri -->
  <tr>
    <td colspan="2" class="etiket-h">İdarenin Adı</td>
    <td colspan="9">${proje.idareAdi || ''}</td>
  </tr>
  <tr>
    <td colspan="2" class="etiket-h">Yapılan İş / Mal / Hizmetin Adı, Niteliği</td>
    <td colspan="9">${proje.isAdi || ''}</td>
  </tr>
  <tr>
    <td colspan="2" class="etiket-h">Alım ve Yetkilendirilen Görevlilere İlişkin Onay Belgesi /<br>Görevlendirme Onayı Tarih ve No.su</td>
    <td colspan="9">${formatDate(proje.ymOnayTarihi)} Tarih ve ${proje.ymOnayNo || ''} Sayılı Olur</td>
  </tr>

  <tr class="no-border"><td colspan="${COL}">&nbsp;</td></tr>

  <!-- Tablo Başlığı -->
  <tr>
    <th rowspan="3" class="sutun-h">S.NO</th>
    <th rowspan="3" class="sutun-h">YAPILAN İŞ / MAL / HİZMETİN ADI</th>
    <th rowspan="3" class="sutun-h">MİKTARI</th>
    <th colspan="2" class="grup-h">1. FİRMA</th>
    <th colspan="2" class="grup-h">2. FİRMA</th>
    <th colspan="2" class="grup-h">3. FİRMA</th>
    <th colspan="2" class="grup-h">YAKLAŞIK MALİYET</th>
  </tr>
  <tr>
    <th colspan="2" class="firma-h">${f1.ad || '-'}</th>
    <th colspan="2" class="firma-h">${f2.ad || '-'}</th>
    <th colspan="2" class="firma-h">${f3.ad || '-'}</th>
    <th colspan="2" class="firma-h"></th>
  </tr>
  <tr>
    <th class="sutun-h">BİRİM FİYAT (TL)</th><th class="sutun-h">TOPLAM FİYAT (TL)</th>
    <th class="sutun-h">BİRİM FİYAT (TL)</th><th class="sutun-h">TOPLAM FİYAT (TL)</th>
    <th class="sutun-h">BİRİM FİYAT (TL)</th><th class="sutun-h">TOPLAM FİYAT (TL)</th>
    <th class="sutun-h">BİRİM FİYAT (TL)</th><th class="sutun-h">TOPLAM FİYAT (TL)</th>
  </tr>

  <!-- Kalemler -->
  ${kalemRows}

  <!-- Toplam -->
  <tr class="toplam-satir">
    <td></td><td colspan="2"><b>TOPLAM:</b></td>
    <td></td>${exRakamBold(t1Top)}
    <td></td>${exRakamBold(t2Top)}
    <td></td>${exRakamBold(t3Top)}
    <td></td>${exRakamBold(ym)}
  </tr>

  <tr class="no-border"><td colspan="${COL}">&nbsp;</td></tr>

  <!-- Açıklayıcı Metin -->
  <tr class="metin-kutu">
    <td colspan="${COL}">
      Karaman İl Özel İdaresi ${proje.mudurluk || ''} yetkilisince görevlendirilmem
      nedeniyle yukarıda özelliği belirtilen işin yapılması için 4734 sayılı Kamu İhale
      Kanununun 9. Maddesi gereğince yaklaşık maliyet çıkarılmış olup, ihale konusu işin
      ${typeof formatCurrency === 'function' ? formatCurrency(ym) : ym} (${ymYazi})
      (KDV hariç) bedelle ihaleye çıkması belirlenmiş ve iş bu tutanak tanzimen
      düzenlenmiştir. ${formatDate(ymTutanakT)}<br><br>
      <b>DAYANAKLAR</b><br>
      EK - 1 : Piyasa Fiyat Araştırması ( ${proje.ymFirmalar.filter(f => f.ad).length} Adet )
    </td>
  </tr>

  <tr class="no-border"><td colspan="${COL}">&nbsp;</td></tr>

  <!-- İmzalar -->
  <tr>
    ${gorevliImzalar}
    ${bosPad}
    <td colspan="2" class="center bold">OLUR<br>${formatDate(ymTutanakT)}<br><br>
      <b>${proje.onaylayanAmir?.ad || ''}</b><br>
      <small>${proje.onaylayanAmir?.unvan || ''}</small>
    </td>
  </tr>
</table>`;

  const dosyaAdi = `Yaklaşık Maliyet - ${(proje.isAdi || 'Proje').replace(/[<>:"/\\|?*]/g, '-').substring(0, 60)}`;
  htmlIndirXls(excelHtmlSaric(html, 'Yaklaşık Maliyet'), dosyaAdi);
}

// ===== TEKLİF TUTANAĞI EXCEL =====
function exportTeklifTutanagiExcel(proje, referans) {
  const kalemler = getKalemler(proje);
  const f1 = proje.teklifFirmalar[0] || { ad: '', fiyatlar: [] };
  const f2 = proje.teklifFirmalar[1] || { ad: '', fiyatlar: [] };
  const f3 = proje.teklifFirmalar[2] || { ad: '', fiyatlar: [] };
  const kazananIdx = proje.kazananFirmaIndex >= 0 ? proje.kazananFirmaIndex : hesaplaKazananFirma(proje);
  const kazanan = kazananIdx >= 0 ? getKazananFirma(proje, referans) : null;
  const t1 = hesaplaTeklifFirmaToplam(f1, kalemler);
  const t2 = hesaplaTeklifFirmaToplam(f2, kalemler);
  const t3 = hesaplaTeklifFirmaToplam(f3, kalemler);
  const dtGorevliler = typeof getAktifGorevliler === 'function'
    ? getAktifGorevliler(proje.dtGorevliler || []) : [];
  const dtTutanakT = proje.dtTutanakTarihiAyni !== false
    ? proje.dtOnayTarihi : (proje.dtTutanakTarihi || proje.dtOnayTarihi);

  let teklifRows = '';
  kalemler.forEach((k, i) => {
    const mik = parseFloat(k.miktar) || 0;
    const bf1 = f1.fiyatlar[i] || 0;
    const bf2 = f2.fiyatlar[i] || 0;
    const bf3 = f3.fiyatlar[i] || 0;
    teklifRows += `<tr>
      <td class="center">${i + 1}</td>
      <td>${k.ad || ''}</td>
      <td class="center">${mik}</td>
      <td class="center">${k.birim || ''}</td>
      ${exRakam(bf1 || null)}
      ${exRakam(bf2 || null)}
      ${exRakam(bf3 || null)}
    </tr>`;
  });

  let kazananBolum = '';
  if (kazanan) {
    const kazananToplam = proje.teklifFirmalar[kazananIdx]
      ? hesaplaTeklifFirmaToplam(proje.teklifFirmalar[kazananIdx], kalemler) : 0;
    const kf = proje.teklifFirmalar[kazananIdx];
    let kazananRows = '';
    kalemler.forEach((k, i) => {
      const mik = parseFloat(k.miktar) || 0;
      const bf  = kf.fiyatlar[i] || 0;
      kazananRows += `<tr>
        <td class="center">${i + 1}</td>
        <td>${k.ad}</td>
        <td class="center">${mik}</td>
        <td class="center">${k.birim || ''}</td>
        ${i === 0 ? `<td rowspan="${kalemler.length}">${kazanan.ad}</td>` : ''}
        ${exRakam(bf || null)}
        ${i === 0 ? `<td rowspan="${kalemler.length}">${kazanan.adres || ''}</td>` : ''}
      </tr>`;
    });
    kazananBolum = `
  <tr class="no-border"><td colspan="7">&nbsp;</td></tr>
  <tr class="kazanan-h"><td colspan="7"><b>UYGUN GÖRÜLEN KİŞİ / FİRMA</b></td></tr>
  <tr>
    <th class="sutun-h">SIRA NO</th>
    <th class="sutun-h">MAL / HİZMET / YAPIM İŞİ</th>
    <th class="sutun-h">MİKTAR</th>
    <th class="sutun-h">BİRİM</th>
    <th class="sutun-h">ADI</th>
    <th class="sutun-h">Firma Fiyat Teklifi</th>
    <th class="sutun-h">ADRESİ</th>
  </tr>
  ${kazananRows}
  <tr class="toplam-satir">
    <td colspan="4"><b>TOPLAM (KDV Hariç)</b></td>
    ${exRakamBold(kazananToplam)} <td></td> <td></td>
  </tr>`;
  }

  const gorevliImzalar = dtGorevliler.map(g =>
    `<td class="center">${g.ad || ''}<br/><small>${g.unvan || ''}</small></td>`
  ).join('');
  const bosPad = `<td colspan="${Math.max(1, 5 - dtGorevliler.length)}"></td>`;

  const html = `<table>
  <tr class="baslik-satir"><td colspan="7">TEKLİF TUTANAĞI</td></tr>
  <tr class="no-border"><td colspan="7">&nbsp;</td></tr>

  <tr>
    <td colspan="2" class="etiket-h">İdarenin Adı</td>
    <td colspan="5">${proje.idareAdi || ''}</td>
  </tr>
  <tr>
    <td colspan="2" class="etiket-h">Yapılan İş / Mal / Hizmetin Adı, Niteliği</td>
    <td colspan="5">${proje.isAdi || ''}</td>
  </tr>
  <tr>
    <td colspan="2" class="etiket-h">Onay Belgesi Tarih ve No.su</td>
    <td colspan="5">${formatDate(proje.dtOnayTarihi)} Tarih ve ${proje.dtOnayNo || ''} Sayılı Olur</td>
  </tr>
  <tr class="no-border"><td colspan="7">&nbsp;</td></tr>

  <tr>
    <th rowspan="3" class="sutun-h">SIRA NO</th>
    <th rowspan="3" class="sutun-h">MAL / HİZMET / YAPIM İŞİ</th>
    <th rowspan="3" class="sutun-h">MİKTAR</th>
    <th rowspan="3" class="sutun-h">BİRİM</th>
    <th colspan="3" class="grup-h">KİŞİ / FİRMA VE FİYAT TEKLİFLERİ</th>
  </tr>
  <tr>
    <th class="sutun-h">1. (Kişi / Firma Adı)</th>
    <th class="sutun-h">2. (Kişi / Firma Adı)</th>
    <th class="sutun-h">3. (Kişi / Firma Adı)</th>
  </tr>
  <tr>
    <th class="firma-h">${f1.ad || '-'}</th>
    <th class="firma-h">${f2.ad || '-'}</th>
    <th class="firma-h">${f3.ad || '-'}</th>
  </tr>

  ${teklifRows}

  <tr class="toplam-satir">
    <td colspan="3"><b>TOPLAM (KDV Hariç)</b></td>
    <td></td>
    ${exRakamBold(t1)} ${exRakamBold(t2)} ${exRakamBold(t3)}
  </tr>

  ${kazananBolum}

  <tr class="no-border"><td colspan="7">&nbsp;</td></tr>
  <tr class="metin-kutu">
    <td colspan="7">
      4734 sayılı Kamu İhale Kanunu'nun 22 nci Maddesi uyarınca <b>doğrudan temin
      usulüyle</b> yapılacak alımlara ilişkin yapılan piyasa araştırmasında teklif edilen
      fiyatlar değerlendirilerek yukarıda adı ve adresleri belirtilen
      ${kazanan ? kazanan.ad + "'den" : 'firmadan'} alım yapılması uygun görülmüştür.
      ${formatDate(dtTutanakT)}
    </td>
  </tr>

  <tr class="no-border"><td colspan="7">&nbsp;</td></tr>
  <tr>
    <td colspan="2" class="bold center">Piyasa Fiyat Araştırması Görevlileri</td>
    ${gorevliImzalar}
    ${bosPad}
    <td colspan="2" class="center bold">UYGUNDUR<br>${formatDate(dtTutanakT)}<br><br>
      <b>${proje.onaylayanAmir?.ad || ''}</b><br>
      <small>${proje.onaylayanAmir?.unvan || ''}</small>
    </td>
  </tr>
</table>`;

  const dosyaAdi = `Teklif Tutanağı - ${(proje.isAdi || 'Proje').replace(/[<>:"/\\|?*]/g, '-').substring(0, 60)}`;
  htmlIndirXls(excelHtmlSaric(html, 'Teklif Tutanağı'), dosyaAdi);
}

// Belge ID'sine göre Excel üret
function belgeIdindenExcelUret(belgeId, proje, referans) {
  switch (belgeId) {
    case 'yaklasik-maliyet': exportYaklasikMaliyetExcel(proje, referans); return true;
    case 'teklif-tutanagi':  exportTeklifTutanagiExcel(proje, referans); return true;
    default: return false;
  }
}
