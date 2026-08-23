/**
 * ===================== E-POSTA TOPLU GÜNCELLEME =====================
 *
 * Mevcut kullanıcıların Firebase Auth e-postasını `kullaniciadi@dtm.local`
 * yerine gerçek adresleriyle değiştirir. Firebase Console kullanıcı
 * e-postası düzenlemeye izin vermediği için bu iş Admin SDK ile yapılır.
 *
 * Ücretli plana (Blaze / Cloud Functions) gerek yoktur — script senin
 * bilgisayarında çalışır.
 *
 * Her kullanıcı için sırayla:
 *   1. Firestore'da `username` alanından kullanıcıyı bulur (uid alınır)
 *   2. Auth e-postasını değiştirir + emailVerified = true yapar
 *   3. Firestore users/{uid} kaydını günceller
 *   4. usernameEmailMap/{username} eşlemesini yazar
 *      (bu olmadan kullanıcı, kullanıcı adıyla giriş yapamaz)
 *
 * ---------------------------------------------------------------
 * KURULUM
 * ---------------------------------------------------------------
 *  1) Firebase Console → ⚙ Project settings → Service accounts
 *     → "Generate new private key" → inen dosyayı bu klasöre
 *       `serviceAccountKey.json` adıyla kaydet.
 *     ⚠ Bu dosya projenin ana anahtarıdır, kimseyle paylaşma.
 *       (.gitignore'da — repoya gitmez.)
 *
 *  2) `kullanicilar.ornek.json` dosyasını kopyalayıp
 *     `kullanicilar.json` adıyla kaydet ve içini doldur.
 *     (Bu dosya da .gitignore'da — kimsenin e-postası repoya gitmez.)
 *
 *  3) Bu klasörde:  npm install firebase-admin
 *
 * ---------------------------------------------------------------
 * ÇALIŞTIRMA
 * ---------------------------------------------------------------
 *  Önce provayı gör (hiçbir şey değiştirmez):
 *      node eposta-guncelle.js
 *
 *  Çıktı doğruysa gerçekten uygula:
 *      node eposta-guncelle.js --uygula
 */

const path = require('path');
const fs = require('fs');

const ANAHTAR_YOLU = path.join(__dirname, 'serviceAccountKey.json');
const LISTE_YOLU = path.join(__dirname, 'kullanicilar.json');

// --uygula verilmediği sürece hiçbir şey değiştirilmez (güvenli varsayılan)
const UYGULA = process.argv.includes('--uygula');

function hataVerCik(mesaj) {
  console.error('\n✖ ' + mesaj + '\n');
  process.exit(1);
}

if (!fs.existsSync(ANAHTAR_YOLU)) {
  hataVerCik(
    'serviceAccountKey.json bulunamadı.\n' +
    '  Firebase Console → Project settings → Service accounts →\n' +
    '  "Generate new private key" ile indirip şu yola koy:\n  ' + ANAHTAR_YOLU
  );
}

if (!fs.existsSync(LISTE_YOLU)) {
  hataVerCik(
    'kullanicilar.json bulunamadı.\n' +
    '  kullanicilar.ornek.json dosyasını kopyalayıp kullanicilar.json\n' +
    '  adıyla kaydet ve içini doldur.'
  );
}

let kullanicilar;
try {
  kullanicilar = JSON.parse(fs.readFileSync(LISTE_YOLU, 'utf8'));
} catch (e) {
  hataVerCik('kullanicilar.json okunamadı (geçersiz JSON olabilir): ' + e.message);
}

if (!Array.isArray(kullanicilar) || kullanicilar.length === 0) {
  hataVerCik('kullanicilar.json boş ya da dizi değil.');
}

const EPOSTA_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  hataVerCik(
    'firebase-admin paketi kurulu değil.\n' +
    '  Bu klasörde şu komutu çalıştır:\n\n    npm install firebase-admin\n'
  );
}

admin.initializeApp({ credential: admin.credential.cert(require(ANAHTAR_YOLU)) });
const auth = admin.auth();
const db = admin.firestore();

async function kullaniciyiGuncelle(kayit, sira, toplam) {
  const username = String(kayit.username || '').toLowerCase().trim();
  const email = String(kayit.email || '').toLowerCase().trim();
  const etiket = `[${sira}/${toplam}] ${username || '(kullanıcı adı yok)'}`;

  if (!username || !email) {
    console.log(`${etiket} → ATLANDI: username veya email boş`);
    return 'atlandi';
  }
  if (!EPOSTA_REGEX.test(email)) {
    console.log(`${etiket} → ATLANDI: geçersiz e-posta (${email})`);
    return 'atlandi';
  }

  // 1) Firestore'da kullanıcıyı bul
  const snap = await db.collection('users').where('username', '==', username).get();
  if (snap.empty) {
    console.log(`${etiket} → BULUNAMADI: Firestore'da bu kullanıcı adı yok`);
    return 'hata';
  }
  if (snap.size > 1) {
    console.log(`${etiket} → ATLANDI: aynı kullanıcı adına sahip ${snap.size} kayıt var, elle bakılmalı`);
    return 'atlandi';
  }

  const uid = snap.docs[0].id;

  // Auth hesabının mevcut durumu
  let mevcut;
  try {
    mevcut = await auth.getUser(uid);
  } catch (e) {
    console.log(`${etiket} → HATA: Auth hesabı bulunamadı (uid: ${uid}) — ${e.message}`);
    return 'hata';
  }

  if (mevcut.email === email && mevcut.emailVerified) {
    console.log(`${etiket} → zaten güncel (${email})`);
    return 'atlandi';
  }

  console.log(`${etiket} → ${mevcut.email}  ➜  ${email}`);

  if (!UYGULA) return 'prova';

  // 2) Auth e-postasını değiştir
  try {
    await auth.updateUser(uid, { email, emailVerified: true });
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      console.log(`      ✖ HATA: bu e-posta başka bir hesapta kullanılıyor`);
    } else {
      console.log(`      ✖ HATA: ${e.message}`);
    }
    return 'hata';
  }

  // 3) Firestore profilini güncelle
  await db.collection('users').doc(uid).set({
    email,
    emailVerified: true,
    pendingEmail: null
  }, { merge: true });

  // 4) Kullanıcı adı → e-posta eşlemesi (kullanıcı adıyla giriş için şart)
  await db.collection('usernameEmailMap').doc(username).set({ email, verified: true });

  console.log(`      ✔ tamam`);
  return 'basarili';
}

(async () => {
  console.log('\n=== DTM — E-posta Toplu Güncelleme ===');
  console.log(UYGULA
    ? '*** UYGULAMA MODU — değişiklikler gerçekten yazılacak ***\n'
    : 'PROVA MODU — hiçbir şey değiştirilmeyecek. Gerçekten uygulamak için: node eposta-guncelle.js --uygula\n');

  const sayac = { basarili: 0, atlandi: 0, hata: 0, prova: 0 };

  for (let i = 0; i < kullanicilar.length; i++) {
    try {
      const sonuc = await kullaniciyiGuncelle(kullanicilar[i], i + 1, kullanicilar.length);
      sayac[sonuc]++;
    } catch (e) {
      console.log(`      ✖ BEKLENMEYEN HATA: ${e.message}`);
      sayac.hata++;
    }
  }

  console.log('\n--- Özet ---');
  if (UYGULA) console.log(`Güncellenen : ${sayac.basarili}`);
  else console.log(`Güncellenecek: ${sayac.prova}`);
  console.log(`Atlanan     : ${sayac.atlandi}`);
  console.log(`Hatalı      : ${sayac.hata}`);
  console.log('');

  if (UYGULA && sayac.basarili > 0) {
    console.log('Not: Güncellenen kullanıcıların şifreleri değişmedi.');
    console.log('Artık hem kullanıcı adıyla hem e-posta ile giriş yapabilir,');
    console.log('"Şifremi Unuttum" özelliğini kullanabilirler.\n');
  }

  process.exit(sayac.hata > 0 ? 1 : 0);
})();
