# DTM kontrolleri

Kurulum gerektirmeyen hesaplama ve belge içeriği kontrolleri:

```powershell
node tests/calculations.test.js
node tests/finance.test.js
node tests/pdf-text.test.js
```

İkinci test; sıfır KDV, negatif/geçersiz girdiler, önceki hakediş ve avans
sınırları, kesinti toplamları, kuruş yuvarlaması ve ekran/Word/Excel üretim
içeriğini kontrol eder. Vergi oranlarının mevzuat doğruluğunu doğrulamaz.
PDF metin testi, Türkçe ve kısa metinlerin korunduğunu, taranmış PDF için açık
hata verildiğini ve harici OCR isteği yapılmadığını kontrol eder.

Tarayıcı ve gerçek PDF kontrolü için:

```powershell
python tests/finance-server.py
```

`http://127.0.0.1:8766/tests/finance-preview.html` adresini açın. Sayfa, uygulamanın
gerçek hesaplama, form, önizleme ve indirme fonksiyonlarını örnek verilerle
çalıştırır. Firebase'e bağlanmaz ve projeyi kaydetmez. PDF indirme, normal
tarayıcı indirmesine ek olarak örnek çıktıyı işletim sistemi geçici klasöründeki
`dtm-finance-qa/sample-payment.pdf` dosyasına kaydeder.

Örnek sözleşme 200.000 TL, sözleşme damga vergisi 500 TL'dir:

- %20 KDV: ödenecek tutar 221.604 TL.
- %0 KDV: ödenecek tutar 197.604 TL.
- Önceki hakediş 200.001 TL: belge üretimi engellenir.
- Negatif SGK kesintisi: değişiklik reddedilir, önceki değer korunur.

Firestore yetki regresyonları için Java ve Firebase CLI gerekir:

```powershell
firebase emulators:start --only firestore --project demo-dtm
node tests/firestore-rules.test.js
```

Yetki testi yalnızca yerel `demo-dtm` emülatörünü kullanır.

Ekran XSS regresyonları için `node tests/security-ui.test.js` çalıştırın.
Gerçek proje listesi oluşturulur; HTML karakterleri, tırnak, ters eğik çizgi ve
satır sonu içeren adlar düğme işleyicilerine veri olarak aktarılmalıdır.

`node tests/user-management.test.js`, kullanıcı oluşturma/rol değiştirme/silme
işlemlerinin atomik kaydını ve başarısız profil kaydında Auth hesabının temizlenmesini
yerel taklitlerle kontrol eder.

E-posta senkronu için `node tests/email-auth.test.js` çalıştırın. Auth token
yenilemesinin kayıttan önce gerçekleştiğini ve hatalarda yerel doğrulama
bilgisinin başarılı gibi güncellenmediğini kontrol eder. Firestore testleri
e-posta/verified alanlarının Auth adresiyle eşleşmesini de doğrular.

`node tests/login.test.js`, eski kullanıcı adı girişini, güncel e-posta ile
girişi, kullanıcı adı/adres eşleşmesini ve anonim e-posta dizini erişimi
yapılmadığını kontrol eder. E-postası değişen hesabın kullanıcı adıyla girişi
kayıtlı e-posta alanı üzerinden tamamlanır; yalnızca kullanıcı adından adres
çözümleme yapılmaz.

Tarayıcı politikası ve dosya bütünlüğü için:

```powershell
node tests/browser-security.test.js
```

Finans test sayfasında “CSP engellemesini test et” satır içi script ve olay
kodunun engellendiğini gösterir. “Metin PDF okuyucusunu test et” yerel
metin katmanlı PDF örneğini yeni okuyucu ile açar. PDF, Word ve Excel
düğmeleri gerçek dışa aktarma fonksiyonlarını çalıştırır.

Gerçek Firebase SDK ile e-posta değiştirme akışının **yerel** testi:

```powershell
firebase emulators:start --only "auth,firestore" --project demo-dtm --config firebase.test.json
node tests/firestore-rules.test.js
python tests/finance-server.py
```

`http://127.0.0.1:8766/test-auth` adresini açın. “Yerel test hesabı oluştur”
formu yalnızca emülatöre ait bilgilerle doldurur. Giriş yapın, Profilim'de
alt çubuktaki yeni test adresini kullanarak doğrulama isteyin. “Yerel
doğrulama bağlantısını uygula” kodu Auth emülatöründe işler. Çıkış yapıp
kullanıcı adıyla deneyin; kayıtlı e-posta alanını doldurup tekrar girin.
“Test profilini kontrol et” yeni adresin `emailVerified:true` durumunu
Firestore'dan gösterir. “Test hesabını temizle” Auth hesabını ve profil,
kullanıcı dizini, referans kayıtlarını emülatörden siler.

Bu test gerçek posta teslimini ve canlı Firebase ayarlarını doğrulamaz.
Canlı test, kontrol edilen bir test posta kutusunda doğrulama bağlantısının
açılmasını gerektirir. Üretim hesabının parolasını test dosyalarına yazmayın.

Kayıt/iş akışı regresyonları: `node tests/project-workflow.test.js`
PDF aktarımı, tutar ayrıştırma, tekrar giriş ve yazdırma: `node tests/feature-regressions.test.js`
