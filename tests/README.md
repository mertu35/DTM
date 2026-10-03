# DTM kontrolleri

Kurulum gerektirmeyen hesaplama ve belge içeriği kontrolleri:

```powershell
node tests/calculations.test.js
node tests/finance.test.js
```

İkinci test; sıfır KDV, negatif/geçersiz girdiler, önceki hakediş ve avans
sınırları, kesinti toplamları, kuruş yuvarlaması ve ekran/Word/Excel üretim
içeriğini kontrol eder. Vergi oranlarının mevzuat doğruluğunu doğrulamaz.

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
