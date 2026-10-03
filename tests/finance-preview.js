proje = Object.assign(getDefaultProje(), {
      isAdi:'Test Çatı Onarımı', isTuru:'Yapım İşi', kdvOrani:20,
      ymFirmalar:[{ad:'Firma A',fiyatlar:[200000]},{ad:'Firma B',fiyatlar:[220000]},{ad:'Firma C',fiyatlar:[240000]}],
      teklifFirmalar:[{ad:'Firma A',fiyatlar:[200000]},{ad:'Firma B',fiyatlar:[210000]},{ad:'Firma C',fiyatlar:[230000]}],
      kazananFirmaIndex:0, sozlesmeDamgaVergisi:500,
      ymGorevliler:[{ad:'Test Görevlisi',unvan:'Mühendis'}],dtGorevliler:[{ad:'Test Görevlisi',unvan:'Mühendis'}]
    });
    referans.firmaList = ['Firma A','Firma B','Firma C'].map(ad=>({ad,adres:'Test adresi',tur:'Şirket',basitUsul:false}));
    currentBelgelerProjeId = 'local-test';
    currentBelge = 'hakedis-raporu';
    let testCurrentView = 'hak';
    autoSave = () => {};
    renderPage = () => testView(testCurrentView);
    function testField(field,value) {
      onFieldChange(field,value);
      testView(testCurrentView);
      document.getElementById('testKdv').value = proje.kdvOrani;
      document.getElementById('testOnceki').value = proje.oncekiHakedisTutar;
      document.getElementById('testSgk').value = proje.sgkKesintisi;
    }
    async function testPdf() {
      const blob = await pdfIndirBelge();
      if (blob) {
        const saved = await fetch('/test-pdf', {method:'POST',body:blob});
        document.getElementById('testState').textContent = saved.ok ? 'PDF üretildi ve yerel test çıktısına kaydedildi.' : 'PDF üretildi; test sunucusu kayıt desteği yok.';
      }
    }
    function testView(view) {
      testCurrentView = view;
      const main = document.getElementById('mainContent');
      if (view === 'summary') renderProjeOzetPage();
      else if (view === 'form') main.innerHTML = renderVeriGirisPage();
      else {
        currentBelge = view === 'ym' ? 'yaklasik-maliyet' : view === 'offer' ? 'teklif-tutanagi' : 'hakedis-raporu';
        main.innerHTML = view === 'ym' ? renderYaklasikMaliyet(proje,referans) : view === 'offer' ? renderTeklifTutanagi(proje,referans) : renderHakedisRaporu(proje,referans);
      }
      document.getElementById('testState').textContent = `KDV: %${proje.kdvOrani} | Önceki hakediş: ${proje.oncekiHakedisTutar} TL | SGK: ${proje.sgkKesintisi} TL`;
    }
    testView('hak');
dtmRegisterEvent('qa-0', function(event) { testField('kdvOrani',this.value) });
dtmRegisterEvent('qa-1', function(event) { testField('oncekiHakedisTutar',this.value) });
dtmRegisterEvent('qa-2', function(event) { testField('sgkKesintisi',this.value) });
dtmRegisterEvent('qa-3', function(event) { testView('hak') });
dtmRegisterEvent('qa-4', function(event) { testView('summary') });
dtmRegisterEvent('qa-5', function(event) { testView('form') });
dtmRegisterEvent('qa-6', function(event) { testView('ym') });
dtmRegisterEvent('qa-7', function(event) { testView('offer') });
dtmRegisterEvent('qa-8', function(event) { testPdf() });
dtmRegisterEvent('qa-9', function(event) { belgeIdindenWordUret('hakedis-raporu',proje,referans) });
dtmRegisterEvent('qa-10', function(event) { exportYaklasikMaliyetExcel(proje,referans) });
dtmRegisterEvent('qa-11', function(event) { exportTeklifTutanagiExcel(proje,referans) });

document.addEventListener('securitypolicyviolation', event => {
  document.getElementById('cspResult').dataset.violations = Number(document.getElementById('cspResult').dataset.violations || 0) + 1;
});
dtmRegisterEvent('qa-csp', function() {
  const probe = document.createElement('button');
  probe.setAttribute('onclick', 'window.dtmCspProbe = true');
  document.body.appendChild(probe);
  probe.click();
  probe.remove();
  const script = document.createElement('script');
  script.textContent = 'window.dtmCspProbe = true';
  document.body.appendChild(script);
  script.remove();
  setTimeout(() => {
    document.getElementById('cspResult').textContent = window.dtmCspProbe ? 'CSP testi başarısız' : 'Satır içi script ve olay kodu engellendi.';
  }, 100);
});
dtmRegisterEvent('qa-read-pdf', async function() {
  try {
    const response = await fetch('/tests/fixtures/security-text.pdf');
    const text = await readPdfText(new File([await response.blob()], 'sample.pdf'));
    document.getElementById('cspResult').textContent = 'Güncel PDF okuyucu: ' + text.slice(0, 180);
  } catch(error) { document.getElementById('cspResult').textContent = error.message; }
});
