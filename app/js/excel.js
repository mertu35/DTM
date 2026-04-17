// ===================== EXCEL.JS =====================
// SheetJS ile Excel (.xlsx) çıktı üretir

function excelDosyaAdi(baslik, projeAdi) {
  const ad = (projeAdi || 'Proje').replace(/[<>:"/\\|?*]/g, '-').substring(0, 80);
  return `${baslik} - ${ad}.xlsx`;
}

function sheetJSYuklu() {
  if (typeof XLSX === 'undefined') {
    showToast('Excel kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.', 'error');
    return false;
  }
  return true;
}

function sutunGenislik(ws, widths) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

function birlestir(ws, s_r, s_c, e_r, e_c) {
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: s_r, c: s_c }, e: { r: e_r, c: e_c } });
}

function paraFormatUygula(ws, rowStart, rowEnd, colStart, colEnd) {
  const fmt = '#,##0.00';
  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = colStart; c <= colEnd; c++) {
      const adr = XLSX.utils.encode_cell({ r, c });
      if (ws[adr] && typeof ws[adr].v === 'number') ws[adr].z = fmt;
    }
  }
}

// ===== YAKLAŞIK MALİYET EXCEL =====
// PDF yapısını birebir taklit eder:
// Sütunlar: S.NO | İş Adı | Miktar | F1-BF | F1-T | F2-BF | F2-T | F3-BF | F3-T | YM-BF | YM-T
function exportYaklasikMaliyetExcel(proje) {
  if (!sheetJSYuklu()) return;

  const kalemler = getKalemler(proje);
  const f1 = proje.ymFirmalar[0] || { ad: '', fiyatlar: [] };
  const f2 = proje.ymFirmalar[1] || { ad: '', fiyatlar: [] };
  const f3 = proje.ymFirmalar[2] || { ad: '', fiyatlar: [] };
  const ym = hesaplaYaklasikMaliyet(proje);

  const data = [];
  // Satır 0: Başlık (11 sütun: indeks 0-10)
  data.push(['YAKLAŞIK MALİYET TESPİT TUTANAĞI', '', '', '', '', '', '', '', '', '', '']);
  data.push(['']);
  // Satır 2-4: Proje bilgileri
  data.push(['İdarenin Adı', proje.idareAdi || '']);
  data.push(['Yapılan İş / Mal / Hizmetin Adı', proje.isAdi || '']);
  data.push(['Onay Belgesi Tarih/No',
    `${formatDate(proje.ymOnayTarihi)} Tarih ve ${proje.ymOnayNo || ''} Sayılı Olur`]);
  data.push(['']);

  // PDF Header Satır 1 (indeks 6): Firma grup başlıkları
  data.push([
    'S.NO', 'YAPILAN İŞ / MAL / HİZMETİN ADI', 'MİKTARI',
    '1. FİRMA', '', '2. FİRMA', '', '3. FİRMA', '',
    'YAKLAŞIK MALİYET', ''
  ]);
  // PDF Header Satır 2 (indeks 7): Firma adları — her firmayı kendi iki sütununa yay
  data.push([
    '', '', '',
    f1.ad || '-', '', f2.ad || '-', '', f3.ad || '-', '',
    '', ''
  ]);
  // PDF Header Satır 3 (indeks 8): BF/Toplam etiketleri
  data.push([
    '', '', '',
    'BİRİM FİYAT (TL)', 'TOPLAM FİYAT (TL)',
    'BİRİM FİYAT (TL)', 'TOPLAM FİYAT (TL)',
    'BİRİM FİYAT (TL)', 'TOPLAM FİYAT (TL)',
    'BİRİM FİYAT (TL)', 'TOPLAM FİYAT (TL)'
  ]);

  // Veri satırları (indeks 9+)
  kalemler.forEach((k, i) => {
    const miktar = parseFloat(k.miktar) || 0;
    const bf1 = f1.fiyatlar[i] || 0;
    const bf2 = f2.fiyatlar[i] || 0;
    const bf3 = f3.fiyatlar[i] || 0;
    const ortT = hesaplaYMKalemOrtalama(proje, i);
    const ortBF = ortT / (miktar || 1);
    data.push([
      i + 1, k.ad, miktar,
      bf1 || '', bf1 * miktar || '',
      bf2 || '', bf2 * miktar || '',
      bf3 || '', bf3 * miktar || '',
      ortBF || '', ortT || ''
    ]);
  });

  // Toplam satırı
  const t1Top = hesaplaYMFirmaToplam(f1, kalemler);
  const t2Top = hesaplaYMFirmaToplam(f2, kalemler);
  const t3Top = hesaplaYMFirmaToplam(f3, kalemler);
  data.push(['', 'TOPLAM:', '', '', t1Top || '', '', t2Top || '', '', t3Top || '', '', ym || '']);
  data.push(['']);
  data.push(['Yaklaşık Maliyet (Yazı ile):', sayidanYaziya(ym)]);

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Merge'ler
  birlestir(ws, 0, 0, 0, 10);   // Başlık
  // Satır 6 (header 1): S.NO/İşAdı/Miktar rowspan simulation + firma grup başlıkları
  birlestir(ws, 6, 0, 8, 0);    // S.NO span 3 satır
  birlestir(ws, 6, 1, 8, 1);    // İş Adı span 3 satır
  birlestir(ws, 6, 2, 8, 2);    // Miktar span 3 satır
  birlestir(ws, 6, 3, 6, 4);    // 1. FİRMA
  birlestir(ws, 6, 5, 6, 6);    // 2. FİRMA
  birlestir(ws, 6, 7, 6, 8);    // 3. FİRMA
  birlestir(ws, 6, 9, 6, 10);   // YAKLAŞIK MALİYET
  // Satır 7 (header 2): firma adları
  birlestir(ws, 7, 3, 7, 4);    // f1.ad
  birlestir(ws, 7, 5, 7, 6);    // f2.ad
  birlestir(ws, 7, 7, 7, 8);    // f3.ad
  birlestir(ws, 7, 9, 7, 10);   // YM (boş ama span)

  sutunGenislik(ws, [5, 38, 9, 14, 14, 14, 14, 14, 14, 14, 14]);
  paraFormatUygula(ws, 9, 9 + kalemler.length, 3, 10);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Yaklaşık Maliyet');
  XLSX.writeFile(wb, excelDosyaAdi('Yaklaşık Maliyet', proje.isAdi));
}

// ===== TEKLİF TUTANAĞI EXCEL =====
// Sütunlar: S.NO | İş Adı | Miktar | Birim | F1 Teklif | F2 Teklif | F3 Teklif
function exportTeklifTutanagiExcel(proje, referans) {
  if (!sheetJSYuklu()) return;

  const kalemler = getKalemler(proje);
  const f1 = proje.teklifFirmalar[0] || { ad: '', fiyatlar: [] };
  const f2 = proje.teklifFirmalar[1] || { ad: '', fiyatlar: [] };
  const f3 = proje.teklifFirmalar[2] || { ad: '', fiyatlar: [] };
  const kazananIdx = proje.kazananFirmaIndex >= 0 ? proje.kazananFirmaIndex : hesaplaKazananFirma(proje);
  const kazanan = kazananIdx >= 0 ? getKazananFirma(proje, referans) : null;

  const data = [];
  data.push(['TEKLİF TUTANAĞI', '', '', '', '', '', '']);
  data.push(['']);
  data.push(['İdarenin Adı', proje.idareAdi || '']);
  data.push(['Yapılan İş / Mal / Hizmetin Adı', proje.isAdi || '']);
  data.push(['Onay Belgesi Tarih/No',
    `${formatDate(proje.dtOnayTarihi)} Tarih ve ${proje.dtOnayNo || ''} Sayılı Olur`]);
  data.push(['']);

  // Header (indeks 6)
  data.push([
    'S.NO', 'YAPILAN İŞ / MAL / HİZMETİN ADI', 'MİKTAR', 'BİRİM',
    (f1.ad || '1. Firma') + '\n(BF + KDV)',
    (f2.ad || '2. Firma') + '\n(BF + KDV)',
    (f3.ad || '3. Firma') + '\n(BF + KDV)'
  ]);

  // Veri satırları (indeks 7+)
  kalemler.forEach((k, i) => {
    data.push([
      i + 1, k.ad, parseFloat(k.miktar) || 0, k.birim || '',
      f1.fiyatlar[i] || '',
      f2.fiyatlar[i] || '',
      f3.fiyatlar[i] || ''
    ]);
  });

  // Toplam satırı
  const t1 = hesaplaTeklifFirmaToplam(f1, kalemler);
  const t2 = hesaplaTeklifFirmaToplam(f2, kalemler);
  const t3 = hesaplaTeklifFirmaToplam(f3, kalemler);
  data.push(['', 'TOPLAM (KDV Hariç)', '', '', t1 || '', t2 || '', t3 || '']);

  // Kazanan firma bölümü
  if (kazanan) {
    const kazananToplam = proje.teklifFirmalar[kazananIdx]
      ? hesaplaTeklifFirmaToplam(proje.teklifFirmalar[kazananIdx], kalemler) : 0;
    data.push(['']);
    data.push(['KAZANAN FİRMA', '', '', '', '', '', '']);
    data.push(['Firma Adı / Kişi', kazanan.ad || '']);
    data.push(['Adresi', kazanan.adres || '']);
    data.push(['Toplam Teklif Bedeli (KDV Hariç)', kazananToplam || '']);

    // Kazanan toplam para formatı
    const ws_temp = XLSX.utils.aoa_to_sheet(data);
    const toplamAdr = XLSX.utils.encode_cell({ r: data.length - 1, c: 1 });
    if (ws_temp[toplamAdr] && typeof ws_temp[toplamAdr].v === 'number') {
      ws_temp[toplamAdr].z = '#,##0.00';
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  birlestir(ws, 0, 0, 0, 6);  // Başlık

  sutunGenislik(ws, [5, 38, 9, 8, 20, 20, 20]);
  // Para formatı: veri satırları, firma teklif sütunları
  paraFormatUygula(ws, 7, 7 + kalemler.length, 4, 6);
  // Toplam satırı
  paraFormatUygula(ws, 7 + kalemler.length, 7 + kalemler.length, 4, 6);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Teklif Tutanağı');
  XLSX.writeFile(wb, excelDosyaAdi('Teklif Tutanağı', proje.isAdi));
}

// Belge ID'sine göre Excel üret
function belgeIdindenExcelUret(belgeId, proje, referans) {
  switch (belgeId) {
    case 'yaklasik-maliyet': exportYaklasikMaliyetExcel(proje); return true;
    case 'teklif-tutanagi':  exportTeklifTutanagiExcel(proje, referans); return true;
    default: return false;
  }
}

const EXCEL_DESTEKLI_BELGELER = ['yaklasik-maliyet', 'teklif-tutanagi'];
