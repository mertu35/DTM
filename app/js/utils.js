// ===================== UTILS.JS =====================
// Tarih, para, sayıdan yazıya çevirme yardımcıları

// HTML attribute içinde güvenli kullanım için escape (XSS önlemi)
function escAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatCurrency(num) {
  if (num == null || isNaN(num)) return '0,00';
  return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrencyInt(num) {
  if (num == null || isNaN(num)) return '0';
  return num.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function calculateEndDate(startDate, days) {
  if (!startDate || !days) return '';
  const d = new Date(startDate);
  d.setDate(d.getDate() + parseInt(days) - 1);
  return d.toISOString().split('T')[0];
}

// ===================== SAYIDAN YAZIYA =====================
const birler = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
const onlar = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];

function ucBasamak(n) {
  if (n === 0) return '';
  let s = '';
  const yuzler = Math.floor(n / 100);
  const onlarVal = Math.floor((n % 100) / 10);
  const birlerVal = n % 10;
  if (yuzler > 0) {
    s += (yuzler === 1 ? '' : birler[yuzler]) + 'Yüz';
  }
  if (onlarVal > 0) s += onlar[onlarVal];
  if (birlerVal > 0) s += birler[birlerVal];
  return s;
}

function sayidanYaziya(sayi) {
  if (sayi == null || isNaN(sayi)) return '';
  sayi = Math.round(sayi * 100) / 100;

  const tamKisim = Math.floor(Math.abs(sayi));
  const kurusKisim = Math.round((Math.abs(sayi) - tamKisim) * 100);

  if (tamKisim === 0 && kurusKisim === 0) return 'SıfırTL';

  let yazi = '';
  if (sayi < 0) yazi = 'Eksi';

  const milyar = Math.floor(tamKisim / 1000000000);
  const milyon = Math.floor((tamKisim % 1000000000) / 1000000);
  const bin = Math.floor((tamKisim % 1000000) / 1000);
  const kalan = tamKisim % 1000;

  if (milyar > 0) yazi += ucBasamak(milyar) + 'Milyar';
  if (milyon > 0) yazi += ucBasamak(milyon) + 'Milyon';
  if (bin > 0) {
    if (bin === 1) {
      yazi += 'Bin';
    } else {
      yazi += ucBasamak(bin) + 'Bin';
    }
  }
  if (kalan > 0) yazi += ucBasamak(kalan);

  yazi += 'TL';

  if (kurusKisim > 0) {
    yazi += ' ' + ucBasamak(kurusKisim) + 'Krş';
  }

  return yazi;
}

function sayidanYaziyaParantezli(sayi) {
  const yazi = sayidanYaziya(sayi);
  return `(${yazi})`;
}
