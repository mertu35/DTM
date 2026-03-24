// ===================== DOCUMENTS.JS =====================
// Belge şablonları - Excel formatına birebir uygun

function renderYaklasikMaliyet(proje, referans) {
  const kalemler = getKalemler(proje);
  const ymGorevliler = getAktifGorevliler(proje.ymGorevliler);
  const yaklasikMaliyet = hesaplaYaklasikMaliyet(proje);
  const ymYaziyla = sayidanYaziya(yaklasikMaliyet);

  // Firma başlıkları (satır 7-8-9)
  const firma1 = proje.ymFirmalar[0];
  const firma2 = proje.ymFirmalar[1];
  const firma3 = proje.ymFirmalar[2];

  // Kalem satırları
  let kalemRows = '';
  kalemler.forEach((k, i) => {
    const miktar = parseFloat(k.miktar) || 0;
    const bf1 = firma1.fiyatlar[i] || 0;
    const bf2 = firma2.fiyatlar[i] || 0;
    const bf3 = firma3.fiyatlar[i] || 0;
    const t1 = bf1 * miktar;
    const t2 = bf2 * miktar;
    const t3 = bf3 * miktar;
    const ortBF = hesaplaYMKalemOrtalama(proje, i) / (miktar || 1);
    const ortT = hesaplaYMKalemOrtalama(proje, i);

    kalemRows += `<tr>
      <td class="merkez">${i + 1}</td>
      <td>${k.ad}</td>
      <td class="merkez" colspan="1">${miktar}</td>
      <td class="rakam">${bf1 > 0 ? formatCurrency(bf1) : ''}</td>
      <td class="rakam">${t1 > 0 ? formatCurrency(t1) : ''}</td>
      <td class="rakam">${bf2 > 0 ? formatCurrency(bf2) : ''}</td>
      <td class="rakam">${t2 > 0 ? formatCurrency(t2) : ''}</td>
      <td class="rakam">${bf3 > 0 ? formatCurrency(bf3) : ''}</td>
      <td class="rakam">${t3 > 0 ? formatCurrency(t3) : ''}</td>
      <td class="rakam">${formatCurrency(ortBF)}</td>
      <td class="rakam">${formatCurrency(ortT)}</td>
    </tr>`;
  });

  // Toplam satırı
  const t1Top = hesaplaYMFirmaToplam(firma1, kalemler);
  const t2Top = hesaplaYMFirmaToplam(firma2, kalemler);
  const t3Top = hesaplaYMFirmaToplam(firma3, kalemler);

  const gorevliSayisi = ymGorevliler.length;

  return `
    <div class="belge">
      <h2 class="belge-baslik">YAKLAŞIK MALİYET TESPİT TUTANAĞI</h2>

      <table class="bilgi-tablo" style="margin-bottom:20px">
        <tr>
          <td class="etiket" style="width:45%">İdarenin Adı</td>
          <td>${proje.idareAdi}</td>
        </tr>
        <tr>
          <td class="etiket">Yapılan İş / Mal / Hizmetin Adı, Niteliği</td>
          <td>${proje.isAdi}</td>
        </tr>
        <tr>
          <td class="etiket">Alım ve Yetkilendirilen Görevlilere İlişkin Onay Belgesi /<br>Görevlendirme Onayı Tarih ve No.su</td>
          <td>${formatDate(proje.ymOnayTarihi)} Tarih ve ${proje.ymOnayNo} Sayılı Olur</td>
        </tr>
      </table>

      <table class="veri-tablo" style="font-size:9.5pt">
        <thead>
          <tr>
            <th rowspan="3" style="width:35px">S.NO</th>
            <th rowspan="3">YAPILAN İŞ / MAL /<br>HİZMETİN ADI</th>
            <th rowspan="3" style="width:55px">MİKTARI</th>
            <th colspan="2">1. FİRMA</th>
            <th colspan="2">2. FİRMA</th>
            <th colspan="2">3. FİRMA</th>
            <th colspan="2" rowspan="2">YAKLAŞIK MALİYET</th>
          </tr>
          <tr>
            <th colspan="2" style="padding:12px 4px">${firma1.ad || '-'}</th>
            <th colspan="2" style="padding:12px 4px">${firma2.ad || '-'}</th>
            <th colspan="2" style="padding:12px 4px">${firma3.ad || '-'}</th>
          </tr>
          <tr>
            <th style="width:70px">BİRİM<br>FİYAT<br>(TL)</th>
            <th style="width:70px">TOPLAM<br>FİYAT<br>(TL)</th>
            <th style="width:70px">BİRİM<br>FİYAT<br>(TL)</th>
            <th style="width:70px">TOPLAM<br>FİYAT<br>(TL)</th>
            <th style="width:70px">BİRİM<br>FİYAT<br>(TL)</th>
            <th style="width:70px">TOPLAM<br>FİYAT<br>(TL)</th>
            <th style="width:70px">BİRİM<br>FİYAT<br>(TL)</th>
            <th style="width:70px">TOPLAM<br>FİYAT<br>(TL)</th>
          </tr>
        </thead>
        <tbody>
          ${kalemRows}
          <tr class="toplam-satir">
            <td></td>
            <td colspan="2"><strong>TOPLAM:</strong></td>
            <td></td>
            <td class="rakam"><strong>${formatCurrency(t1Top)}</strong></td>
            <td></td>
            <td class="rakam"><strong>${formatCurrency(t2Top)}</strong></td>
            <td></td>
            <td class="rakam"><strong>${formatCurrency(t3Top)}</strong></td>
            <td></td>
            <td class="rakam"><strong>${formatCurrency(yaklasikMaliyet)}</strong></td>
          </tr>
        </tbody>
      </table>

      <div style="margin:12px 0;border:0.5mm solid #000;padding:10px 14px;page-break-inside:avoid">
        <p style="text-align:justify;line-height:1.2">Karaman İl Özel İdaresi ${proje.mudurluk} yetkilisince görevlendirilmem nedeniyle yukarıda özelliği belirtilen işin yapılması için 4734 sayılı Kamu İhale Kanununun 9. Maddesi gereğince yaklaşık maliyet çıkarılmış olup, ihale konusu işin ${formatCurrency(yaklasikMaliyet)} (${ymYaziyla}) (KDV hariç) bedelle ihaleye çıkması belirlenmiş ve iş bu tutanak tanzimen düzenlenmiştir. ${formatDate(proje.ymOnayTarihi)}</p>

        <div style="margin-top:10px">
          <p><strong>DAYANAKLAR</strong></p>
          <p style="margin-top:4px">EK - 1 : Piyasa Fiyat Araştırması ( ${proje.ymFirmalar.filter(f => f.ad).length} Adet )</p>
        </div>

        <div style="display:flex;align-items:flex-start;margin-top:14px;gap:0">
          <!-- Görevliler sol tarafta -->
          <div style="flex:1;display:flex;gap:10px">
            ${ymGorevliler.map(g =>
              `<div style="text-align:center;flex:1;padding-top:5px">
                <strong>${g.ad}</strong><br>
                <span style="font-size:9.5pt">${g.unvan || getUnvanByAd(g.ad, referans)}</span>
              </div>`
            ).join('')}
          </div>
          <!-- OLUR: 3. Firma sütununun altında (140px) -->
          <div style="width:140px;text-align:center;padding-top:65px">
            <p style="font-weight:bold">OLUR</p>
            <p>${formatDate(proje.ymOnayTarihi)}</p>
            <p style="margin-top:10px"><strong>${proje.onaylayanAmir.ad}</strong></p>
            <p style="font-size:9.5pt">${proje.onaylayanAmir.unvan}</p>
          </div>
          <!-- Boşluk: Yaklaşık Maliyet sütunlarının altı (140px) -->
          <div style="width:140px"></div>
        </div>
      </div>
    </div>
  `;
}

function renderTeklifTutanagi(proje, referans) {
  const kalemler = getKalemler(proje);
  const dtGorevliler = getAktifGorevliler(proje.dtGorevliler);
  const kazananIdx = proje.kazananFirmaIndex >= 0 ? proje.kazananFirmaIndex : hesaplaKazananFirma(proje);
  const kazanan = kazananIdx >= 0 ? getKazananFirma(proje, referans) : null;
  const gorevliMetni = getGorevliMetni(proje.dtGorevliler);
  const tarafMetni = getTarafMetni(proje.dtGorevliler);

  // Firma isimleri
  const f1 = proje.teklifFirmalar[0];
  const f2 = proje.teklifFirmalar[1];
  const f3 = proje.teklifFirmalar[2];

  // Dinamik metin hesapla
  const getFirmaTur = (ad) => {
    const found = (referans.firmaList || []).find(x => x.ad === ad);
    return found ? found.tur : 'Şirket';
  };
  const aktiveTurler = [f1, f2, f3].filter(f => f.ad).map(f => getFirmaTur(f.ad));
  const hepsiKisi = aktiveTurler.length > 0 && aktiveTurler.every(t => t === 'Kişi');
  const hepsiFirma = aktiveTurler.length > 0 && aktiveTurler.every(t => t === 'Şirket');
  const teklifVerenMetni = hepsiKisi ? 'kişilerce' : hepsiFirma ? 'firmalarca' : 'kişi / firmalarca';
  const kazananTur = kazanan ? getFirmaTur(kazanan.ad) : 'Şirket';
  const kazananKisiMetni = kazananTur === 'Kişi' ? 'kişiden' : 'firmadan';

  // İlk tablo - Teklif satırları
  let teklifRows = '';
  kalemler.forEach((k, i) => {
    const miktar = parseFloat(k.miktar) || 0;
    const bf1 = f1.fiyatlar[i] || 0;
    const bf2 = f2.fiyatlar[i] || 0;
    const bf3 = f3.fiyatlar[i] || 0;
    teklifRows += `<tr style="height:36px">
      <td class="merkez">${i + 1}</td>
      <td style="padding:6px 4px">${k.ad}</td>
      <td class="merkez">${miktar}</td>
      <td class="merkez">${k.birim}</td>
      <td class="merkez">${bf1 > 0 ? formatCurrency(bf1) + ' +KDV' : ''}</td>
      <td class="merkez">${bf2 > 0 ? formatCurrency(bf2) + ' +KDV' : ''}</td>
      <td class="merkez">${bf3 > 0 ? formatCurrency(bf3) + ' +KDV' : ''}</td>
    </tr>`;
  });

  // Kazanan firma bilgileri - tüm kalemler
  let kazananRows = '';
  if (kazanan) {
    const kazananFirmaFiyatlar = proje.teklifFirmalar[kazananIdx]?.fiyatlar || [];
    kalemler.forEach((k, i) => {
      const miktar = parseFloat(k.miktar) || 0;
      const bf = kazananFirmaFiyatlar[i] || 0;
      const toplam = bf * miktar;
      kazananRows += `<tr style="height:36px">
        <td class="merkez">${i + 1}</td>
        <td style="padding:6px 4px">${k.ad}</td>
        <td class="merkez">${miktar}</td>
        <td class="merkez">${k.birim}</td>
        <td class="merkez">${i === 0 ? kazanan.ad : ''}</td>
        <td class="merkez">${bf > 0 ? formatCurrency(bf) + ' + KDV' : ''}</td>
        <td style="padding:6px 4px">${i === 0 ? kazanan.adres : ''}</td>
      </tr>`;
    });
  }

  const kazananHTML = kazanan ? `
    <table class="veri-tablo" style="margin-top:0;border-top:none;font-size:9.5pt;table-layout:fixed">
      <colgroup>
        <col style="width:32px">
        <col style="width:160px">
        <col style="width:38px">
        <col style="width:45px">
        <col style="width:90px">
        <col style="width:110px">
        <col style="width:130px">
      </colgroup>
      <thead>
        <tr>
          <th rowspan="2">SIRA<br>NO</th>
          <th rowspan="2">MAL / HİZMET / YAPIM İŞİ</th>
          <th rowspan="2">MİKTAR</th>
          <th rowspan="2">BİRİM</th>
          <th colspan="3">UYGUN GÖRÜLEN KİŞİ / FİRMA / FİRMALAR</th>
        </tr>
        <tr>
          <th>ADI</th>
          <th>Firmaya ait Fiyat Teklifi</th>
          <th>ADRESİ</th>
        </tr>
      </thead>
      <tbody>
        ${kazananRows}
      </tbody>
    </table>` : '';

  // Görevli imzaları - sadece ad (ünvan ayrı satırda)
  const gorevliImzalar = dtGorevliler.map(g =>
    `<td style="border:none;padding-top:5px;padding-left:25px;vertical-align:top;width:${100/Math.max(dtGorevliler.length,1)}%">
      ${g.ad}
    </td>`
  ).join('');

  return `
    <div class="belge">
      <div style="text-align:center;margin-bottom:25px;line-height:1.8">
        <p>T.C.<br><strong>${proje.idareAdi}</strong><br>${proje.mudurluk.toUpperCase()}</p>
      </div>

      <h2 class="belge-baslik" style="margin-bottom:20px">TEKLİF TUTANAĞI</h2>

      <table class="bilgi-tablo" style="margin-bottom:15px">
        <tr>
          <td class="etiket" style="width:45%">İdarenin Adı</td>
          <td>: ${proje.idareAdi}</td>
        </tr>
        <tr>
          <td class="etiket">Yapılan İş / Mal / Hizmetin Adı, Niteliği</td>
          <td>: ${proje.isAdi}</td>
        </tr>
        <tr>
          <td class="etiket">Alım ve Yetkilendirilen Görevlilere İlişkin Onay Belgesi /<br>Görevlendirme Onayı Tarih ve No.su</td>
          <td>: ${formatDate(proje.dtOnayTarihi)} Tarih ve ${proje.dtOnayNo} Sayılı Olur</td>
        </tr>
      </table>

      <table class="veri-tablo" style="font-size:9.5pt;table-layout:fixed">
        <colgroup>
          <col style="width:32px">
          <col style="width:160px">
          <col style="width:38px">
          <col style="width:45px">
          <col style="width:110px">
          <col style="width:110px">
          <col style="width:110px">
        </colgroup>
        <thead>
          <tr>
            <th rowspan="3" style="padding:8px 4px">SIRA<br>NO</th>
            <th rowspan="3" style="padding:8px 4px">MAL / HİZMET / YAPIM İŞİ</th>
            <th rowspan="3" style="padding:8px 4px">MİKTAR</th>
            <th rowspan="3" style="padding:8px 4px">BİRİM</th>
            <th colspan="3">KİŞİ / FİRMA / FİRMALAR VE FİYAT TEKLİFLERİ</th>
          </tr>
          <tr>
            <th style="padding:6px 4px">1. (Kişi / Firma Adı)</th>
            <th style="padding:6px 4px">2. (Kişi / Firma Adı)</th>
            <th style="padding:6px 4px">3. (Kişi / Firma Adı)</th>
          </tr>
          <tr>
            <th style="padding:6px 4px">${f1.ad || '-'}</th>
            <th style="padding:6px 4px">${f2.ad || '-'}</th>
            <th style="padding:6px 4px">${f3.ad || '-'}</th>
          </tr>
        </thead>
        <tbody>
          ${teklifRows}
        </tbody>
      </table>

      ${kazananHTML}

      <div style="margin:12px 0;border:0.5mm solid #000;padding:10px 14px;page-break-inside:avoid">
        <p style="text-align:justify;line-height:1.4">4734 sayılı Kamu İhale Kanunu'nun 22 nci Maddesi uyarınca <strong>doğrudan temin usulüyle</strong> yapılacak alımlara ilişkin yapılan piyasa araştırmasında ${teklifVerenMetni} teklif edilen fiyatlar ${tarafMetni} değerlendirilerek yukarıda adı ve adresleri belirtilen ${kazananKisiMetni} alım yapılması uygun görülmüştür. ${formatDate(proje.dtOnayTarihi)}</p>

        <div style="display:flex;align-items:flex-start;margin-top:14px;gap:0">
          <!-- Görevliler sol tarafta -->
          <div style="flex:1">
            <p style="font-weight:bold;text-align:center;margin-bottom:6px">Piyasa Fiyat Araştırması ${dtGorevliler.length > 1 ? 'Görevlileri' : 'Görevlisi'}</p>
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="border:none;width:90px;white-space:nowrap">Adı Soyadı</td>
                <td style="border:none;width:10px">:</td>
                ${gorevliImzalar}
              </tr>
              <tr>
                <td style="border:none;white-space:nowrap">Ünvanı</td>
                <td style="border:none">:</td>
                ${dtGorevliler.map(g =>
                  `<td style="border:none;font-size:9.5pt;padding-left:25px">${g.unvan || getUnvanByAd(g.ad, referans)}</td>`
                ).join('')}
              </tr>
            </table>
          </div>
          <!-- UYGUNDUR sağda -->
          <div style="width:160px;text-align:center;padding-top:20px">
            <p style="font-weight:bold">UYGUNDUR</p>
            <p style="margin-top:30px"><strong>${proje.onaylayanAmir.ad}</strong></p>
            <p style="font-size:9.5pt">${proje.onaylayanAmir.unvan}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSozlesme(proje, referans) {
  const kazananIdx = proje.kazananFirmaIndex >= 0 ? proje.kazananFirmaIndex : hesaplaKazananFirma(proje);
  const kazanan = kazananIdx >= 0 ? getKazananFirma(proje, referans) : { ad: '', toplam: 0, adres: '', tel: '', tur: 'Kişi' };
  const kazananDetay = kazananIdx >= 0 && proje.teklifFirmalar[kazananIdx] ? getFirmaByAd(proje.teklifFirmalar[kazananIdx].ad, referans) : null;
  const bedel = kazanan.toplam;
  const bedelYazi = sayidanYaziya(bedel);
  const bitisT = calculateEndDate(proje.sozlesmeTarihi, proje.isSuresi);
  const isSuresiSayi = parseInt(proje.isSuresi) || 0;
  const isSuresiYazi = sayidanYaziya(isSuresiSayi).replace(/\s*TL\s*/g, '').trim();
  const kazananFaks = kazananDetay ? (kazananDetay.faks || '-') : '-';
  const kazananEposta = kazananDetay ? (kazananDetay.eposta || '-') : '-';

  return `
    <div class="sozlesme">
    <table class="sozlesme-sayfa-tablo">
      <thead><tr><td class="sozlesme-sayfa-header">
        T.C.<br>
        <strong>${proje.idareAdi}</strong><br>
        ${proje.mudurluk.toUpperCase()}
      </td></tr></thead>
      <tbody><tr><td>
    <div class="belge">
      <h3 class="merkez" style="font-weight:bold">DOĞRUDAN TEMİN USULÜ İLE YAPILACAK</h3>

      <table style="width:100%;border-collapse:collapse;margin:10px 0">
        <tr>
          <td style="border:1px solid #000;text-align:center;padding:10px;font-weight:bold;color:#365F91;font-size:11pt;letter-spacing:0.5px">
            ${proje.isAdi.toUpperCase()}
          </td>
        </tr>
      </table>

      <div class="madde">
        <p><strong>Madde 1- Sözleşmenin Tarafları</strong></p>
        <p>Bu sözleşme bir tarafta <strong>${proje.idareAdi}</strong> <strong>${proje.mudurluk.toUpperCase()}</strong> (Bundan böyle idare diye anılacaktır) ile diğer tarafta <strong>${kazanan.ad}</strong> (bundan böyle yüklenici olarak anılacaktır) arasında aşağıda yazılı şartlar dahilinde akdedilmiştir.</p>
      </div>

      <div class="madde">
        <p><strong>Madde 2- Taraflara Ait Bilgiler</strong></p>
        <table class="bilgi-tablo" style="margin-top:6px">
          <tr>
            <td style="width:38px;font-weight:bold;vertical-align:top">2.1.</td>
            <td style="width:190px;vertical-align:top">İdarenin Adresi</td>
            <td style="width:12px;vertical-align:top">:</td>
            <td><strong>Üniversite Mah. İbrahim Öktem Bulv. No:136 KARAMAN</strong></td>
          </tr>
          <tr>
            <td></td>
            <td>Tel No</td>
            <td>:</td>
            <td><strong>338–226 15 00</strong></td>
          </tr>
          <tr>
            <td></td>
            <td>Faks No</td>
            <td>:</td>
            <td><strong>338- 226 16 11</strong></td>
          </tr>
          <tr>
            <td></td>
            <td>E-Posta Adresi</td>
            <td>:</td>
            <td><strong>admin@karamanozelidare.gov.tr</strong></td>
          </tr>
        </table>
        <table class="bilgi-tablo" style="margin-top:4px">
          <tr>
            <td style="width:38px;font-weight:bold;vertical-align:top">2.2.</td>
            <td style="width:190px;vertical-align:top">Yüklenicinin Tebligat Adresi</td>
            <td style="width:12px;vertical-align:top">:</td>
            <td><strong>${kazanan.adres}</strong></td>
          </tr>
          <tr>
            <td></td>
            <td>Tel No</td>
            <td>:</td>
            <td><strong>${kazanan.tel}</strong></td>
          </tr>
          <tr>
            <td></td>
            <td>Faks No</td>
            <td>:</td>
            <td><strong>${kazananFaks}</strong></td>
          </tr>
          <tr>
            <td></td>
            <td>E-Posta Adresi</td>
            <td>:</td>
            <td><strong>${kazananEposta}</strong></td>
          </tr>
        </table>
        <p style="margin-top:6px">2.3. Her iki taraf madde 2.1. ve 2.2.'de belirtilen adreslerini tebligat adresi olarak kabul etmişlerdir. Adres değişiklikleri usulüne uygun şekilde karşı tarafa tebliğ edilmedikçe en son bildirilen adrese yapılacak tebliğ ilgili tarafa yapılmış sayılır.</p>
        <p>2.3. Taraflar, yazılı tebligatı daha sonra süresi içinde yapmak kaydıyla, elden teslim, posta veya posta kuryesi, teleks, faks veya elektronik posta gibi diğer yollarla da bildirimde bulunabilirler.</p>
      </div>

      <div class="madde">
        <p><strong>Madde 3- Tanımlar</strong></p>
        <p>Bu Sözleşmenin uygulanmasında, 4734 sayılı Kamu İhale Kanunu ve 4735 sayılı Kamu İhale Sözleşmeleri Kanunu ve ihale dokümanını oluşturan belgelerde yer alan tanımlar geçerlidir.</p>
      </div>

      <div class="madde">
        <p><strong>Madde 4- İşin Adı, Niteliği, Türü, Miktarı Ve İşin Yapılma / Malın Teslim Edilme Yeri</strong></p>
        <table class="bilgi-tablo" style="margin-top:6px">
          <tr>
            <td style="width:38px;font-weight:bold">4.1.</td>
            <td style="width:190px">İşin Adı</td>
            <td style="width:12px">:</td>
            <td>${proje.isAdi.toUpperCase()}</td>
          </tr>
          <tr>
            <td style="font-weight:bold">4.2.</td>
            <td>İşin Niteliği, Türü, Miktarı</td>
            <td>:</td>
            <td>${proje.isTuru}</td>
          </tr>
          <tr>
            <td style="font-weight:bold">4.3.</td>
            <td>İşin Yapılma/ Teslim Edilme Yeri</td>
            <td>:</td>
            <td>${proje.ilce ? proje.ilce + '/' : ''}${proje.sehir}</td>
          </tr>
          <tr>
            <td style="font-weight:bold">4.4.</td>
            <td>İşin Süresi</td>
            <td>:</td>
            <td>${isSuresiSayi} (${isSuresiYazi}) Takvim günü</td>
          </tr>
        </table>
      </div>

      <div class="madde">
        <p><strong>Madde 5- Sözleşme Türü, Bedeli ve Süresi</strong></p>
        <table class="bilgi-tablo" style="margin-top:6px">
          <tr>
            <td style="width:38px;font-weight:bold">5.1.</td>
            <td style="width:190px">Sözleşme Bedeli</td>
            <td style="width:12px">:</td>
            <td>${formatCurrency(bedel)}- TL (${bedelYazi})</td>
          </tr>
          <tr>
            <td style="font-weight:bold">5.2.</td>
            <td>Sözleşme Türü</td>
            <td>:</td>
            <td>Götürü bedel sözleşme</td>
          </tr>
          <tr>
            <td style="font-weight:bold">5.3.</td>
            <td>Sözleşme Süresi</td>
            <td>:</td>
            <td>${isSuresiSayi} (${isSuresiYazi}) Takvim Günü</td>
          </tr>
        </table>
      </div>

      <div class="madde">
        <p><strong>Madde 6- Sözleşmenin Ekleri</strong></p>
        <p>İhale dokümanı, bu sözleşmenin eki ve ayrılmaz parçası olup, İdareyi ve Yükleniciyi bağlar. Ancak, sözleşme hükümleri ile ihale dokümanını oluşturan belgelerdeki hükümler arasında çelişki ya da farklılık olması halinde, ihale dokümanında yer alan hükümler esas alınır.</p>
      </div>

      <div class="madde">
        <p><strong>Madde 7- İşe Başlama Ve Bitirme Tarihi</strong></p>
        <p>7.1. Sözleşme tarihi yer teslim tarihidir.</p>
        <table class="bilgi-tablo" style="margin-top:4px">
          <tr>
            <td style="width:230px">İşe Başlama Tarihi</td>
            <td style="width:12px">:</td>
            <td>${formatDate(proje.sozlesmeTarihi)}</td>
          </tr>
          <tr>
            <td>İşi Bitirme Tarihi</td>
            <td>:</td>
            <td>${formatDate(bitisT)}</td>
          </tr>
        </table>
      </div>

      <div class="madde">
        <p><strong>Madde 8- Ödeme Yeri Ve Şartları</strong></p>
        <table class="bilgi-tablo" style="margin-top:6px">
          <tr>
            <td style="width:38px;font-weight:bold;vertical-align:top">8.1.</td>
            <td style="width:190px;vertical-align:top">Ödemenin Yapılacağı Yer</td>
            <td style="width:12px;vertical-align:top">:</td>
            <td>Karaman İl Özel İdaresi Mali Hizmetler Müdürlüğü Saymanlığınca/Muhasebe Müdürlüğünce Ödenir.</td>
          </tr>
          <tr>
            <td style="font-weight:bold">8.2.</td>
            <td>Ödeme Şartları</td>
            <td>:</td>
            <td>Kabul Yapıldığında Tamamı Ödenir</td>
          </tr>
          <tr>
            <td style="font-weight:bold">8.3.</td>
            <td>Avans Verilmesi Şartları ve Miktarı</td>
            <td>:</td>
            <td>Verilmeyecektir.</td>
          </tr>
        </table>
      </div>

      <div class="madde">
        <p><strong>Madde 9- Sözleşme Bedeline Dahil Olan Giderler</strong></p>
        <p>Taahhüdün yerine getirilmesine ilişkin ulaşım, sigorta, vergi, resim ve harç giderleri sözleşme bedeline dahildir. İlgili mevzuatı uyarınca hesaplanacak Katma Değer Vergisi ise sözleşme bedeline dahil olmayıp idare tarafından yükleniciye ödenecektir.</p>
      </div>

      <div class="madde">
        <p><strong>Madde 10- Vergi, Resim ve Harçlar ile Sözleşmeyle İlgili Diğer Giderler</strong></p>
        <p>Sözleşmenin yapılmasına ait vergi, resim ve harçlarla diğer sözleşme giderleri yükleniciye aittir.</p>
      </div>

      <div class="madde">
        <p><strong>Madde 11- Montaj, İşletmeye Alma, Eğitim, Bakım-Onarım, Yedek Parça Gibi Destek Hizmetlerine Ait Şartlar</strong></p>
        <p>x</p>
      </div>

      <div class="madde">
        <p><strong>Madde 12- Kesin Teminat Miktarı Ve İadesine İlişkin Şartlar</strong></p>
        <p>x</p>
      </div>

      <div class="madde">
        <p><strong>Madde 13- Garanti Ve Bakım, Onarım</strong></p>
        <p>x</p>
      </div>

      <div class="madde">
        <p><strong>Madde 14- Teslim Etme Ve Teslim Alma Şekil Ve Şartları</strong></p>
        <p>x</p>
      </div>

      <div class="madde">
        <p><strong>Madde 15- Gecikme Halinde Alınacak Cezalar</strong></p>
        <p>İdare tarafından sözleşmenin 17 nci maddesinde belirtilen süre uzatımı halleri hariç, iş zamanında bitirilmediği/mal teslim edilmediği takdirde geçen her takvim günü için Yükleniciye yapılacak ödemelerden sözleşme bedeli üzerinden binde 3 oranında gecikme cezası kesilecektir. Kesilecek toplam ceza tutarı hiçbir şekilde ihale bedelini aşamaz. Gecikme cezası Yükleniciye ayrıca protesto çekmeye gerek kalmaksızın ödemelerden kesilir. Bu cezanın ödemelerden karşılanamaması halinde Yükleniciden ayrıca tahsil edilir. Bu gecikme ihtarın Yükleniciye tebliğinden itibaren 20 günü geçtiği takdirde İdare Sözleşmeyi fesih edecektir.</p>
      </div>

      <div class="madde">
        <p><strong>Madde 16- Mücbir Sebepler Ve Süre Uzatımı Verilebilme Şartları</strong></p>
        <p>Mücbir sebepler dışında yüklenici süre uzatımı talebinde bulunamaz. Mücbir sebepler 4735 sayılı Kamu İhale sözleşmeleri Kanunu'nun 10.Maddesinde belirtilen sebeplerdir.</p>
      </div>

      <div class="madde">
        <p><strong>Madde 17- Denetim Muayene Ve Kabul İşlemlerine İlişkin Şartlar</strong></p>
        <p>Denetim Muayene ve Kabul İşlemlerine Dair Yönetmelik çerçevesinde idarece yapılacaktır.</p>
      </div>

      <div class="madde">
        <p><strong>Madde 18- Sözleşmede Değişiklik Yapılma Şartları</strong></p>
        <p>İşin türüne bağlı olarak; Yapım İşleri İhalelerine ait Tip Sözleşme (Ek:6)nın 25. Maddesinde belirtilen şartlar dışında sözleşmede değişiklik yapılamaz.</p>
      </div>

      <div class="madde">
        <p><strong>Madde 19- Sözleşmenin Feshine İlişkin Şartlar</strong></p>
        <p>İşin türüne bağlı olarak; Yapım İşleri İhalelerine ait Tip Sözleşme (Ek:6)nın 27. Maddesindeki hususlar geçerlidir.</p>
      </div>

      <div class="madde">
        <p><strong>Madde 20- Diğer Hususlar</strong></p>
        <p>x</p>
      </div>

      <div class="madde">
        <p><strong>Madde 21- Anlaşmazlıkların Çözümü</strong></p>
        <p>Anlaşmazlıkların çözümü konusunda <strong>KARAMAN</strong> Mahkemeleri ve İcra Daireleri yetkilidir.</p>
      </div>

      <div class="madde">
        <p><strong>Madde 22- Yürürlülük</strong></p>
        <p>İş bu sözleşme 22 Maddeden ibaret olup, İdare ve Yüklenici tarafından tam olarak okunup anlaşıldıktan sonra ${formatDate(proje.sozlesmeTarihi)} tarihinde 1 (Bir) nüsha olarak imza altına alınmıştır. Ayrıca İdare, Yüklenicinin talebi halinde sözleşmenin aslına uygun idarece onaylı suretini düzenleyip yükleniciye verecektir.</p>
      </div>

      <div class="sozlesme-imza" style="margin-top:40px">
        <div class="imzalar-yan">
          <div class="imza-kutu">
            <p class="bold">YÜKLENİCİ</p>
            <div class="imza-ad" style="margin-top:60px"></div>
          </div>
          <div class="imza-kutu">
            <p class="bold">İDARE</p>
            <div class="imza-ad">${proje.onaylayanAmir.ad}</div>
            <div class="imza-unvan">${proje.onaylayanAmir.unvan}</div>
          </div>
        </div>
      </div>
    </div>
      </td></tr></tbody>
    </table>
    </div>
  `;
}

function renderBittiTutanagi(proje, referans) {
  const kazananIdx = proje.kazananFirmaIndex >= 0 ? proje.kazananFirmaIndex : hesaplaKazananFirma(proje);
  const kazanan = kazananIdx >= 0 ? getKazananFirma(proje, referans) : { ad: '', toplam: 0 };
  const bitisT = proje.fiiliBitimTarihi || calculateEndDate(proje.sozlesmeTarihi, proje.isSuresi);
  const dtGorevliler = getAktifGorevliler(proje.dtGorevliler);

  const tekGorevli = dtGorevliler.length === 1;
  const gorevliImzalar = dtGorevliler.map(g =>
    `<td style="border:none;text-align:${tekGorevli ? 'left' : 'center'};padding-top:40px">
      <strong>${g.ad}</strong><br>
      <span style="font-size:9.5pt">${g.unvan || getUnvanByAd(g.ad, referans)}</span>
    </td>`
  ).join('');

  return `
    <div class="belge">
      <div style="text-align:center;margin-bottom:25px;line-height:1.8">
        <p>T.C.<br><strong>${proje.idareAdi}</strong><br>${proje.mudurluk.toUpperCase()}</p>
      </div>

      <h2 class="belge-baslik">İŞ BİTİRME TUTANAĞI</h2>

      <table class="bilgi-tablo" style="margin:20px 0">
        <tr><td class="etiket" style="width:35%">İdarenin Adı</td><td>: ${proje.idareAdi}</td></tr>
        <tr><td class="etiket">Yapılan İş / Hizmetin Adı</td><td>: ${proje.isAdi.toUpperCase()}</td></tr>
        <tr><td class="etiket">Sözleşme Tarihi</td><td>: ${formatDate(proje.sozlesmeTarihi)}</td></tr>
        <tr><td class="etiket">Sözleşme Bedeli</td><td>: ${formatCurrency(kazanan.toplam)} TL (KDV Hariç)</td></tr>
        <tr><td class="etiket">İş Süresi</td><td>: ${proje.isSuresi} Takvim Günü</td></tr>
        <tr><td class="etiket">İşe Başlama Tarihi</td><td>: ${formatDate(proje.sozlesmeTarihi)}</td></tr>
        <tr><td class="etiket">İşin Bitim Tarihi</td><td>: ${formatDate(bitisT)}</td></tr>
      </table>

      <div style="margin:40px 0;text-align:justify;line-height:1.8">
        <p>Yukarıda bilgileri belirtilen işin, sözleşme ve eklerine uygun olarak tamamlandığı ${formatDate(bitisT)} tarihinde yerinde yapılan inceleme sonucunda tespit edilmiş olup, iş bu tutanak tarafımızca düzenlenmiştir.</p>
      </div>

      <div style="margin-top:50px">
        <p style="${dtGorevliler.length === 1 ? 'text-align:left' : 'text-align:center'};font-weight:bold;margin-bottom:10px">${dtGorevliler.length === 1 ? 'KONTROL GÖREVLİSİ' : 'KONTROL GÖREVLİLERİ'}</p>
        <table style="width:100%;border-collapse:collapse">
          <tr>${gorevliImzalar}</tr>
        </table>
      </div>
    </div>
  `;
}

function renderDogrudanTeminOnayBelgesi(proje) {
  const yaklasikMaliyet = hesaplaYaklasikMaliyet(proje);
  const dtGorevliler = getAktifGorevliler(proje.dtGorevliler);
  const isMiktari = proje.isTuru === 'Yapım İşi' ? '1 Adet' : (proje.isMiktari || '-');
  const odenek = proje.odenek ? formatCurrency(parseFloat(proje.odenek)) + ' -TL' : '-';
  const gcAd = proje.gerceklestirmeGorevlisi?.ad || '';
  const gcUnvan = proje.gerceklestirmeGorevlisi?.unvan || 'Gerçekleştirme Görevlisi';

  const satir = (etiket, deger, colspan) => `
    <tr>
      <td style="border:1px solid #000;padding:5px 8px;font-weight:600;width:42%;background:#f9f9f9">${etiket}</td>
      <td style="border:1px solid #000;padding:5px 8px;${colspan?'':''}width:58%">${deger || '-'}</td>
    </tr>`;

  const gorevliMetni = dtGorevliler.map(g => `${g.ad}${g.unvan ? ' ' + g.unvan : ''}`).join(', ');

  return `
    <div class="belge">
      <div style="text-align:center;margin-bottom:6px">
        <div style="font-size:11pt;font-weight:bold">T.C.</div>
        <div style="font-size:11pt;font-weight:bold">${proje.idareAdi}</div>
        <div style="font-size:10pt;font-weight:bold">${proje.mudurluk}</div>
      </div>

      <h2 class="belge-baslik" style="margin:10px 0 4px">DOĞRUDAN TEMİN ONAY BELGESİ</h2>
      <div style="text-align:center;font-size:9.5pt;margin-bottom:14px">(4734 sayılı Kanunun 22. maddesi (d) bendi gereğince)</div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
        ${satir('ALIMI YAPAN İDARENİN ADI', `${proje.idareAdi} (${proje.mudurluk})`)}
        ${satir('BELGE TARİH VE SAYISI', `${formatDate(proje.dtOnayTarihi)} / ${proje.dtOnayNo ? Number(proje.dtOnayNo).toLocaleString('tr-TR') : '-'}`)}
      </table>

      <div style="border:1px solid #000;padding:5px 8px;font-weight:700;font-size:10pt;margin-top:10px;background:#f0f0f0">
        DOĞRUDAN TEMİN İLE İLGİLİ BİLGİLER
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${satir('İŞİN TANIMI', proje.isAdi)}
        ${satir('İŞİN NİTELİĞİ', proje.isTuru)}
        ${satir('İŞİN MİKTARI', isMiktari)}
        ${satir('Yaklaşık Maliyet', formatCurrency(yaklasikMaliyet) + ' -TL')}
        ${satir('Kullanılabilir Ödenek Tutarı', odenek)}
        ${satir('Yatırım Proje Numarası (varsa)', proje.yatirimProjeNo || '-')}
        ${satir('Bütçe Tertibi (varsa)', proje.butceTertibi || '-')}
        ${satir('Temin Şekli', '4734 sayılı Kanunun 22. maddesinin (d) bendi gereğince doğrudan temin.')}
        ${satir('Avans Verilecek mi', proje.avansVar || 'Hayır')}
        ${satir('Fiyat Farkı Uygulanacak mı', proje.fiyatFarkiVar || 'Hayır')}
        ${satir('Şartname Düzenlenip Düzenlenmeyeceği', proje.sartnameVar || 'Düzenlenecek')}
        ${satir('Sözleşme Düzenlenip Düzenlenmeyeceği', proje.sozlesmeVar || 'Düzenlenecek')}
      </table>

      <div style="border:1px solid #000;padding:5px 8px;font-weight:700;font-size:10pt;margin-top:10px;background:#f0f0f0">
        TEMİN İLE İLGİLİ DİĞER AÇIKLAMALAR
      </div>
      <div style="border:1px solid #000;border-top:none;padding:8px 10px;min-height:50px;font-size:10pt;line-height:1.6">
        <strong>Görevli Personeller :</strong> ${gorevliMetni || '-'}
      </div>

      <div style="border:1px solid #000;border-top:none;font-size:10pt;line-height:1.7;display:flex;min-height:130px">
        <div style="flex:1;padding:10px 14px;border-right:1px solid #000;display:flex;flex-direction:column;justify-content:space-between">
          <p style="text-align:justify;margin:0">Yukarıda isimleri yazılı personelin, belirtilen yapımın/malın/hizmetin doğrudan temini için gerekli fiyat araştırmasını ve diğer işlemleri yapmak üzere görevlendirilmesi hususunu onaylarınıza arz ederim. &nbsp;&nbsp; ${formatDate(proje.dtOnayTarihi)}</p>
          <div>
            <div style="display:flex"><span style="min-width:110px"><strong>Adı SOYADI</strong></span><span><strong>:</strong> ${gcAd}</span></div>
            <div style="display:flex"><span style="min-width:110px"><strong>Unvanı</strong></span><span><strong>:</strong> ${gcUnvan}</span></div>
            <div style="display:flex;margin-top:16px"><span style="min-width:110px"><strong>İmzası</strong></span><span><strong>:</strong></span></div>
          </div>
        </div>
        <div style="flex:1;padding:10px 14px;text-align:center">
          <div style="font-weight:bold">Uygundur. &nbsp;&nbsp; ${formatDate(proje.dtOnayTarihi)}</div>
          <div style="margin-top:16px"><strong>${proje.onaylayanAmir.ad}</strong></div>
          <div style="font-size:9.5pt">${proje.onaylayanAmir.unvan}</div>
        </div>
      </div>
    </div>
  `;
}

function renderHakedisRaporu(proje, referans) {
  const hak = hesaplaHakedis(proje);
  if (!hak) return '<div class="belge"><p>Kazanan firma belirlenemedi.</p></div>';

  const dtGorevliler = getAktifGorevliler(proje.dtGorevliler);
  const odenecekYazi = sayidanYaziya(hak.odenecek);
  const kazananIdx = proje.kazananFirmaIndex >= 0 ? proje.kazananFirmaIndex : hesaplaKazananFirma(proje);

  return `
    <div class="belge">
      <h2 class="belge-baslik">HAKEDİŞ RAPORU</h2>
      <table style="width:100%;margin-bottom:15px"><tr>
        <td><strong>${proje.isAdi.toUpperCase()}</strong></td>
        <td style="text-align:right"><strong>HAKEDİŞ NO: 1</strong></td>
      </tr></table>

      <table class="veri-tablo hakedis-tablo">
        <thead><tr><th colspan="2">YAPILAN İŞİN</th><th style="width:150px">TUTAR (TL)</th></tr></thead>
        <tbody>
          <tr><td>A</td><td>Sözleşme Fiyatları İle Yapılan İş</td><td class="rakam">${formatCurrency(hak.sozlesmeBedeli)}</td></tr>
          <tr><td>B</td><td>Fiyat Farkı Tutarı</td><td class="rakam">${formatCurrency(hak.fiyatFarki)}</td></tr>
          <tr class="toplam-satir"><td>C</td><td>Toplam Tutar (A+B)</td><td class="rakam">${formatCurrency(hak.toplamTutar)}</td></tr>
          <tr><td>D</td><td>Bir Önceki Hakedişin Toplam Tutarı</td><td class="rakam">${formatCurrency(hak.oncekiHakedis)}</td></tr>
          <tr class="toplam-satir"><td>E</td><td>Bu Hakedişin Tutarı (C – D)</td><td class="rakam">${formatCurrency(hak.buHakedis)}</td></tr>
          <tr><td>F</td><td>KDV (E x %${proje.kdvOrani})</td><td class="rakam">${formatCurrency(hak.kdv)}</td></tr>
          <tr class="toplam-satir"><td>G</td><td>Tahakkuk Tutarı</td><td class="rakam">${formatCurrency(hak.tahakkuk)}</td></tr>
        </tbody>
      </table>

      <table class="veri-tablo hakedis-tablo" style="margin-top:10px">
        <thead><tr><th colspan="2">KESİNTİLER VE MAHSUPLAR</th><th style="width:150px">TUTAR (TL)</th></tr></thead>
        <tbody>
          <tr><td>a)</td><td>Sözleşme Damga Vergisi [(E-g) x % 0,948]</td><td class="rakam">${formatCurrency(hak.sozlesmeDamga)}</td></tr>
          <tr><td>b)</td><td>Damga Vergisi [(E-g) x % 0,948]</td><td class="rakam">${formatCurrency(hak.damgaVergisi)}</td></tr>
          <tr><td>c)</td><td>KDV Tevkifatı (F x 4/10)</td><td class="rakam">${formatCurrency(hak.kdvTevkifati)}</td></tr>
          <tr><td>d)</td><td>Sosyal Sigortalar Kurumu Kesintisi</td><td class="rakam">${formatCurrency(hak.sgk)}</td></tr>
          <tr><td>e)</td><td>Vergi Borcu</td><td class="rakam">${formatCurrency(hak.vergi)}</td></tr>
          <tr><td>f)</td><td>Gecikme Cezası</td><td class="rakam">${formatCurrency(hak.gecikme)}</td></tr>
          <tr><td>g)</td><td>Avans Mahsubu</td><td class="rakam">${formatCurrency(hak.avans)}</td></tr>
          <tr><td>h)</td><td>Bu Hakedişle Ödenen Fiyat Farkının Teminat Kesintisi</td><td class="rakam">${formatCurrency(hak.fiyatFarkiTeminat)}</td></tr>
          <tr><td>i)</td><td>Geçici Kabul Noksanları Kesintisi</td><td class="rakam">${formatCurrency(hak.geciciKabul)}</td></tr>
          <tr class="toplam-satir"><td>H</td><td>Kesintiler ve Mahsuplar Toplamı</td><td class="rakam">${formatCurrency(hak.toplamKesinti)}</td></tr>
        </tbody>
      </table>

      <table class="veri-tablo hakedis-tablo" style="margin-top:10px">
        <tbody>
          <tr class="toplam-satir">
            <td colspan="2"><strong>Yükleniciye Ödenecek Tutar (G - H)</strong></td>
            <td class="rakam" style="width:150px"><strong>${formatCurrency(hak.odenecek)}</strong></td>
          </tr>
          <tr>
            <td colspan="2">Yazıyla Yalnız:</td>
            <td>${odenecekYazi}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top:40px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="border:none;text-align:center;font-weight:bold;padding-bottom:6px;width:30%">YÜKLENİCİ</td>
            <td style="border:none;text-align:center;font-weight:bold;padding-bottom:6px;width:70%">DÜZENLEYENLER</td>
          </tr>
          <tr style="height:50px;vertical-align:bottom">
            <td style="border:none;text-align:center">
              <strong>${proje.teklifFirmalar[kazananIdx]?.ad || ''}</strong>
            </td>
            <td style="border:none">
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  ${dtGorevliler.map(g =>
                    `<td style="border:none;text-align:center;vertical-align:bottom">
                      <strong>${g.ad}</strong><br>
                      <span style="font-size:9.5pt">${g.unvan || getUnvanByAd(g.ad, referans)}</span>
                    </td>`
                  ).join('')}
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align:center;margin-top:40px">
        <p style="font-weight:bold;letter-spacing:2px">ONAYLAYAN</p>
        <p style="margin-top:40px"><strong>${proje.onaylayanAmir.ad}</strong></p>
        <p style="font-size:9.5pt">${proje.onaylayanAmir.unvan}</p>
      </div>
    </div>
  `;
}

function belgeYazdir(html, landscape = false, sozlesme = false) {
  const win = window.open('', '_blank');
  const pageSize = landscape
    ? 'size: A4 landscape; margin: 10mm 15mm;'
    : sozlesme
      ? 'size: A4; margin: 10mm 15mm;'
      : 'size: A4; margin: 15mm 20mm;';
  const maxWidth = landscape ? '277mm' : '210mm';
  const bodyPadding = landscape ? '10mm 15mm' : '15mm 20mm';

  win.document.write(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Belge Yazdır</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', serif; font-size: 9.5pt; color: #000; padding: ${bodyPadding}; }
    .belge { max-width: ${maxWidth}; margin: 0 auto; }
    .belge-ust { text-align: center; margin-bottom: 15px; }
    .belge-baslik { text-align: center; font-size: 13.5pt; margin: 10px 0; font-weight: bold; }
    .bilgi-tablo { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .bilgi-tablo td { padding: 2px 6px; vertical-align: top; }
    .bilgi-tablo .etiket { font-weight: bold; }
    .veri-tablo { width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 0.5mm solid #000; }
    .veri-tablo th, .veri-tablo td { border: 0.5mm solid #000; padding: 2px 4px; text-align: left; font-size: 9.5pt; }
    .veri-tablo th { background: #f0f0f0; text-align: center; font-weight: bold; }
    .rakam { text-align: right !important; }
    .merkez { text-align: center !important; }
    .bold { font-weight: bold; }
    .toplam-satir td { font-weight: bold; background: #f9f9f9; }
    .aciklama-metin { margin: 15px 0; line-height: 1.6; text-align: justify; }
    .imzalar-yan { display: flex; justify-content: space-around; gap: 30px; }
    .imza-kutu, .imza-kutu-inline { text-align: center; min-width: 150px; }
    .imza-ad { font-weight: bold; margin-top: 40px; }
    .imza-unvan { font-size: 9.5pt; }
    .madde { margin-bottom: 12px; line-height: 1.5; page-break-inside: avoid; break-inside: avoid; }
    .madde p { margin-top: 5px; text-align: justify; }
    .sozlesme .madde p, .sozlesme .madde { font-size: 12pt; }
    .sozlesme .madde { margin-bottom: 7px; line-height: 1.35; page-break-inside: avoid; break-inside: avoid; }
    .sozlesme .madde p { margin-top: 3px; }
    .sozlesme-imza { margin-top: 20px; }
    .hakedis-tablo td:first-child { width: 30px; text-align: center; font-weight: bold; }
    small { font-size: 8.5pt; }
    .sozlesme-sayfa-tablo { width: 100%; border-collapse: collapse; }
    .sozlesme-sayfa-tablo > tbody > tr > td { padding: 0; }
    .sozlesme-sayfa-header {
      display: block;
      text-align: center;
      font-weight: bold;
      font-size: 10pt;
      line-height: 1.5;
      padding: 4px 0 6px;
      margin-bottom: 6px;
    }
    @media print {
      body { padding: 0; }
      @page { ${pageSize} }
      .sozlesme-sayfa-tablo thead { display: table-header-group; }
      .sozlesme-sayfa-tablo tbody { display: table-row-group; }
    }
  </style>
</head>
<body>${html}</body>
</html>`);
  win.document.close();
  setTimeout(() => win.print(), 500);
}
