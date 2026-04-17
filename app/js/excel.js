// ===================== EXCEL.JS =====================
// SheetJS ile Excel (.xlsx) çıktı üretir

// Güvenli dosya adı
function excelDosyaAdi(baslik, projeAdi) {
  const ad = (projeAdi || 'Proje').replace(/[<>:"/\\|?*]/g, '-').substring(0, 80);
  return `${baslik} - ${ad}.xlsx`;
}

// SheetJS yüklü mü kontrolü
function sheetJSYuklu() {
  if (typeof XLSX === 'undefined') {
    showToast('Excel kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.', 'error');
    return false;
  }
  return true;
}

// Sütun genişliklerini ayarla
function sutunGenislik(ws, widths) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

// Hücre aralığı birleştir
function hucreBirlestir(ws, s_r, s_c, e_r, e_c) {
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: s_r, c: s_c }, e: { r: e_r, c: e_c } });
}

// ===== YAKLAŞIK MALİYET EXCEL =====
function exportYaklasikMaliyetExcel(proje) {
  if (!sheetJSYuklu()) return;

  const kalemler = getKalemler(proje);
  const f1 = proje.ymFirmalar[0] || { ad: '', fiyatlar: [] };
  const f2 = proje.ymFirmalar[1] || { ad: '', fiyatlar: [] };
  const f3 = proje.ymFirmalar[2] || { ad: '', fiyatlar: [] };
  const ym = hesaplaYaklasikMaliyet(proje);

  const data = [];
  data.push(['YAKLAŞIK MALİYET TESPİT TUTANAĞI']);
  data.push([]);
  data.push(['İdarenin Adı', proje.idareAdi || '']);
  data.push(['Yapılan İş / Mal / Hizmetin Adı', proje.isAdi || '']);
  data.push(['Onay Belgesi Tarih/No',
    `${formatDate(proje.ymOnayTarihi)} Tarih ve ${proje.ymOnayNo || ''} Sayılı Olur`]);
  data.push([]);

  // Başlık satırları (2 satır header)
  data.push([
    'S.NO', 'Yapılan İş / Mal / Hizmetin Adı', 'Miktar',
    '1. FİRMA', '', '2. FİRMA', '', '3. FİRMA', '',
    'YAKLAŞIK MALİYET', ''
  ]);
  data.push([
    '', '', '',
    'Birim Fiyat', 'Toplam',
    'Birim Fiyat', 'Toplam',
    'Birim Fiyat', 'Toplam',
    'Birim Fiyat', 'Toplam'
  ]);
  data.push([
    '', f1.ad || '', '',
    '', '', '', '', '', '',
    '', ''
  ]);

  // Kalem satırları
  kalemler.forEach((k, i) => {
    const miktar = parseFloat(k.miktar) || 0;
    const bf1 = f1.fiyatlar[i] || 0;
    const bf2 = f2.fiyatlar[i] || 0;
    const bf3 = f3.fiyatlar[i] || 0;
    const t1 = bf1 * miktar;
    const t2 = bf2 * miktar;
    const t3 = bf3 * miktar;
    const ortT = hesaplaYMKalemOrtalama(proje, i);
    const ortBF = ortT / (miktar || 1);

    data.push([
      i + 1, k.ad, miktar,
      bf1 || '', t1 || '',
      bf2 || '', t2 || '',
      bf3 || '', t3 || '',
      ortBF || '', ortT || ''
    ]);
  });

  // Toplam satırı
  const t1Top = hesaplaYMFirmaToplam(f1, kalemler);
  const t2Top = hesaplaYMFirmaToplam(f2, kalemler);
  const t3Top = hesaplaYMFirmaToplam(f3, kalemler);
  data.push([
    '', 'TOPLAM', '',
    '', t1Top || '',
    '', t2Top || '',
    '', t3Top || '',
    '', ym || ''
  ]);
  data.push([]);
  data.push(['Yaklaşık Maliyet (Yazı ile)', sayidanYaziya(ym)]);

  // Worksheet oluştur
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Merge hücreleri
  hucreBirlestir(ws, 0, 0, 0, 10);   // Başlık
  hucreBirlestir(ws, 6, 3, 6, 4);    // 1.FİRMA
  hucreBirlestir(ws, 6, 5, 6, 6);    // 2.FİRMA
  hucreBirlestir(ws, 6, 7, 6, 8);    // 3.FİRMA
  hucreBirlestir(ws, 6, 9, 6, 10);   // YAKLAŞIK MALİYET

  // Sütun genişlikleri
  sutunGenislik(ws, [6, 40, 10, 14, 14, 14, 14, 14, 14, 14, 14]);

  // Para formatı (4-10. sütunlar)
  const paraFormat = '#,##0.00';
  for (let r = 9; r < data.length - 2; r++) {
    for (let c = 3; c <= 10; c++) {
      const adr = XLSX.utils.encode_cell({ r, c });
      if (ws[adr] && typeof ws[adr].v === 'number') {
        ws[adr].z = paraFormat;
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Yaklaşık Maliyet');
  XLSX.writeFile(wb, excelDosyaAdi('Yaklaşık Maliyet', proje.isAdi));
}

// ===== TEKLİF TUTANAĞI EXCEL =====
function exportTeklifTutanagiExcel(proje, referans) {
  if (!sheetJSYuklu()) return;

  const kalemler = getKalemler(proje);
  const f1 = proje.teklifFirmalar[0] || { ad: '', fiyatlar: [] };
  const f2 = proje.teklifFirmalar[1] || { ad: '', fiyatlar: [] };
  const f3 = proje.teklifFirmalar[2] || { ad: '', fiyatlar: [] };
  const kazananIdx = proje.kazananFirmaIndex >= 0 ? proje.kazananFirmaIndex : hesaplaKazananFirma(proje);
  const kazanan = kazananIdx >= 0 ? getKazananFirma(proje, referans) : null;

  const data = [];
  data.push(['TEKLİF TUTANAĞI']);
  data.push([]);
  data.push(['İdarenin Adı', proje.idareAdi || '']);
  data.push(['Yapılan İş / Mal / Hizmetin Adı', proje.isAdi || '']);
  data.push(['Onay Belgesi Tarih/No',
    `${formatDate(proje.dtOnayTarihi)} Tarih ve ${proje.dtOnayNo || ''} Sayılı Olur`]);
  data.push([]);

  // Teklif tablosu başlık
  data.push([
    'S.NO', 'Yapılan İş / Mal / Hizmetin Adı', 'Miktar', 'Birim',
    f1.ad || '1. Firma',
    f2.ad || '2. Firma',
    f3.ad || '3. Firma'
  ]);

  // Teklif satırları
  kalemler.forEach((k, i) => {
    const miktar = parseFloat(k.miktar) || 0;
    data.push([
      i + 1, k.ad, miktar, k.birim || '',
      f1.fiyatlar[i] || '',
      f2.fiyatlar[i] || '',
      f3.fiyatlar[i] || ''
    ]);
  });

  // Toplam satırı
  const t1 = hesaplaTeklifFirmaToplam(f1, kalemler);
  const t2 = hesaplaTeklifFirmaToplam(f2, kalemler);
  const t3 = hesaplaTeklifFirmaToplam(f3, kalemler);
  data.push([
    '', 'TOPLAM (KDV Hariç)', '', '',
    t1 || '', t2 || '', t3 || ''
  ]);

  // Kazanan firma bilgisi
  if (kazanan) {
    data.push([]);
    data.push(['KAZANAN FİRMA']);
    data.push(['Firma Adı', kazanan.ad || '']);
    data.push(['Adresi', kazanan.adres || '']);
    data.push(['Toplam Teklif (KDV Hariç)', t1 < t2 && t1 < t3 ? t1 : (t2 < t3 ? t2 : t3)]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  hucreBirlestir(ws, 0, 0, 0, 6);
  sutunGenislik(ws, [6, 40, 10, 8, 18, 18, 18]);

  // Para formatı
  const paraFormat = '#,##0.00';
  for (let r = 7; r < data.length; r++) {
    for (let c = 4; c <= 6; c++) {
      const adr = XLSX.utils.encode_cell({ r, c });
      if (ws[adr] && typeof ws[adr].v === 'number') {
        ws[adr].z = paraFormat;
      }
    }
  }
  // Kazanan firma tutar formatı
  const toplamAdr = XLSX.utils.encode_cell({ r: data.length - 1, c: 1 });
  if (ws[toplamAdr] && typeof ws[toplamAdr].v === 'number') {
    ws[toplamAdr].z = paraFormat;
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Teklif Tutanağı');
  XLSX.writeFile(wb, excelDosyaAdi('Teklif Tutanağı', proje.isAdi));
}

// Belge ID'sine göre Excel üret
function belgeIdindenExcelUret(belgeId, proje, referans) {
  switch (belgeId) {
    case 'yaklasik-maliyet':
      exportYaklasikMaliyetExcel(proje);
      return true;
    case 'teklif-tutanagi':
      exportTeklifTutanagiExcel(proje, referans);
      return true;
    default:
      return false;
  }
}

// Excel opsiyonu olan belge ID'leri
const EXCEL_DESTEKLI_BELGELER = ['yaklasik-maliyet', 'teklif-tutanagi'];
