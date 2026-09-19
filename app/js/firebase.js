// ===================== FIREBASE.JS =====================
// firebaseConfig, config.js dosyasından yükleniyor (gitignore'da)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
auth.languageCode = 'tr'; // Firebase e-postaları ve doğrulama sayfaları Türkçe
const db = firebase.firestore();
const remoteConfig = firebase.remoteConfig();
remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // 1 saat cache

let visionApiKey = null;

async function loadVisionApiKey() {
  try {
    await remoteConfig.fetchAndActivate();
    visionApiKey = remoteConfig.getValue('vision_api_key').asString() || null;
  } catch(e) {
    // Remote Config yüklenemedi, Vision API devre dışı
    visionApiKey = null;
  }
}

let currentDTMUser = null; // { uid, username, displayName, role, email, emailVerified, pendingEmail }

function usernameToEmail(username) {
  return `${username.toLowerCase().trim()}@dtm.local`;
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  const visibleName = name.length <= 2 ? name[0] + '*' : name.slice(0, 2) + '***';
  const domainParts = domain.split('.');
  const tld = domainParts.pop();
  const restDomain = domainParts.map(p => p.length <= 2 ? p[0] + '*' : p[0] + '***').join('.');
  return `${visibleName}@${restDomain ? restDomain + '.' : ''}${tld}`;
}

// Kullanıcı adı → e-posta eşlemesi. Giriş ekranı ve "Şifremi Unuttum" akışı henüz
// oturum açılmadan bu eşlemeyi okuyabilmeli (users koleksiyonu auth ister), bu yüzden
// sadece {email, verified} tutan ayrı, herkese açık okunabilir bir dokümana yazılır.
//
// verified=false kayıt, e-posta değişikliği TALEP edildiği anda yazılır: doğrulama
// linkine tıklanınca Firebase auth e-postasını değiştirip oturumu düşürdüğü için,
// eşleme o an yazılamazsa kullanıcı kendi kullanıcı adıyla bir daha giriş yapamaz.
async function syncUsernameEmailMap(username, email, verified) {
  if (!username || !email) return;
  try {
    await db.collection('usernameEmailMap').doc(username.toLowerCase().trim())
      .set({ email: email.toLowerCase(), verified: Boolean(verified) });
  } catch(e) {
    console.warn('usernameEmailMap senkron hatası:', e);
  }
}

// Kullanıcı adından e-postayı bulur (auth gerektirmez).
// requireVerified: şifre sıfırlama gibi, linkin yanlış adrese gitmesinin hesap
// devralınmasına yol açabileceği akışlarda yalnızca doğrulanmış adresi döndürür.
async function getEmailByUsername(username, requireVerified = false) {
  try {
    const doc = await db.collection('usernameEmailMap').doc(username.toLowerCase().trim()).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (requireVerified && !data.verified) return null;
    return data.email || null;
  } catch(e) {
    console.warn('usernameEmailMap okuma hatası:', e);
    return null;
  }
}

// Giriş yap (kullanıcı adı veya e-posta ile)
async function dtmLogin(identifier, password) {
  identifier = (identifier || '').trim();
  if (!identifier) throw new Error('Kullanıcı adı veya e-posta giriniz.');

  let emailToAuth = identifier.includes('@') ? identifier.toLowerCase() : usernameToEmail(identifier);
  let cred;

  try {
    cred = await auth.signInWithEmailAndPassword(emailToAuth, password);
  } catch (err) {
    // Eğer kullanıcı adı girilmişse ve kullanıcının auth emaili gerçek e-posta ile güncellenmişse eşleme dokümanından bak
    if (!identifier.includes('@') && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password')) {
      const gercekEmail = await getEmailByUsername(identifier);
      if (gercekEmail && gercekEmail !== emailToAuth) {
        cred = await auth.signInWithEmailAndPassword(gercekEmail, password);
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  // Firestore profil verisini çek
  const userDocRef = db.collection('users').doc(cred.user.uid);
  const snap = await userDocRef.get();
  let userData = snap.exists ? snap.data() : {};

  // Genel kullanıcı dizinini (publicUsers: yalnızca ad ve rol) arka planda senkronize et
  db.collection('publicUsers').doc(cred.user.uid).set({
    uid: cred.user.uid,
    displayName: userData.displayName || '',
    role: userData.role || 'user'
  }, { merge: true }).catch(() => {});

  // Auth e-posta doğrulama durumunu Firestore ile senkronize et
  if (cred.user.email && !cred.user.email.endsWith('@dtm.local')) {
    const isVerified = cred.user.emailVerified;
    if (userData.email !== cred.user.email || userData.emailVerified !== isVerified) {
      await userDocRef.update({
        email: cred.user.email,
        emailVerified: isVerified,
        pendingEmail: isVerified ? null : (userData.pendingEmail || cred.user.email)
      }).catch(e => console.warn('E-posta senkron hatası:', e));
      userData.email = cred.user.email;
      userData.emailVerified = isVerified;
      if (isVerified) userData.pendingEmail = null;
    }
  }

  currentDTMUser = { uid: cred.user.uid, ...userData };
  return currentDTMUser;
}

// Çıkış yap
async function dtmLogout() {
  currentDTMUser = null;
  await auth.signOut();
}

// Yeni kullanıcı oluştur (admin) - secondary app ile mevcut oturum korunur
async function createDTMUser(username, password, displayName, role, userEmail = '') {
  const secondaryApp = firebase.initializeApp(firebaseConfig, 'secondary_' + Date.now());
  try {
    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = userEmail ? userEmail.toLowerCase().trim() : '';
    // Auth hesabı oluştururken öncelik usernameToEmail
    const emailToCreate = cleanEmail || usernameToEmail(cleanUsername);
    const cred = await secondaryApp.auth().createUserWithEmailAndPassword(emailToCreate, password);
    
    const userDocData = {
      username: cleanUsername,
      displayName: displayName.trim(),
      role: role || 'user',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (cleanEmail) {
      userDocData.email = cleanEmail;
      userDocData.emailVerified = false;
      userDocData.pendingEmail = cleanEmail;
    }

    await db.collection('users').doc(cred.user.uid).set(userDocData);

    // Genel kullanıcı dizinine (publicUsers) ad ve rol bilgisini yaz
    await db.collection('publicUsers').doc(cred.user.uid).set({
      uid: cred.user.uid,
      displayName: displayName.trim(),
      role: role || 'user'
    }).catch(e => console.warn('publicUsers yazılamadı:', e));

    await secondaryApp.auth().signOut();
    return cred.user.uid;
  } finally {
    await secondaryApp.delete();
  }
}

// Tüm kullanıcıları getir (admin) - e-posta ve doğrulama durumları dahil
async function getAllUsers() {
  const snap = await db.collection('users').orderBy('displayName').get();
  const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  // publicUsers dizinini arka planda senkronize et
  list.forEach(u => {
    db.collection('publicUsers').doc(u.uid).set({
      uid: u.uid,
      displayName: u.displayName || '',
      role: u.role || 'user'
    }, { merge: true }).catch(() => {});
  });
  return list;
}

// Şifre değiştir (mevcut şifre ile yeniden auth gerekli)
async function changePassword(mevcutSifre, yeniSifre) {
  const user = auth.currentUser;
  const credential = firebase.auth.EmailAuthProvider.credential(user.email, mevcutSifre);
  await user.reauthenticateWithCredential(credential);
  await user.updatePassword(yeniSifre);
}

// ===================== E-POSTA DOĞRULAMA & ŞİFRE SIFIRLAMA =====================

// Kullanıcı profili için e-posta doğrulama bağlantısı gönder
async function epostaDogrulamaGonder(yeniEmail) {
  const user = auth.currentUser;
  if (!user) throw new Error('Oturum açık değil.');

  const cleanEmail = (yeniEmail || '').toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    throw new Error('Lütfen geçerli bir e-posta adresi giriniz.');
  }

  // Farklı bir kullanıcının bu e-postayı kullanıp kullanmadığını kontrol et
  try {
    const snap = await db.collection('users')
      .where('email', '==', cleanEmail)
      .get();
    
    const alreadyUsed = snap.docs.some(d => d.id !== user.uid && d.data().emailVerified);
    if (alreadyUsed) {
      throw new Error('Bu e-posta adresi sistemde başka bir kullanıcı tarafından doğrulanmış durumda.');
    }
  } catch (err) {
    if (err.message && err.message.includes('doğrulanmış durumda')) throw err;
    console.warn('E-posta tekillik sorgusu atlandı:', err?.message);
  }

  // Firebase Auth üzerinden e-posta güncelleme & doğrulama gönderimi
  auth.languageCode = 'tr';
  try {
    // Firebase güvenlik politikası gereği e-posta değişikliği için zorunlu metot
    await user.verifyBeforeUpdateEmail(cleanEmail);
  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      throw new Error('Güvenlik nedeniyle e-posta güncellemek için lütfen oturumunuzu kapatıp tekrar giriş yapınız.');
    } else if (err.code === 'auth/email-already-in-use') {
      throw new Error('Bu e-posta adresi başka bir hesap tarafından kullanılmaktadır.');
    } else if (err.code === 'auth/invalid-email') {
      throw new Error('Geçersiz bir e-posta adresi girdiniz.');
    } else if (err.code === 'auth/too-many-requests') {
      throw new Error('Çok fazla istek gönderildi. Lütfen birkaç dakika bekleyiniz.');
    } else {
      throw new Error('E-posta doğrulama gönderilemedi: ' + err.message);
    }
  }

  // Firestore kullanıcısına beklemede olarak kaydet
  try {
    await db.collection('users').doc(user.uid).update({
      pendingEmail: cleanEmail,
      emailVerified: false,
      emailUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.warn('Firestore pendingEmail kaydedilemedi:', err?.message);
  }

  if (currentDTMUser) {
    currentDTMUser.pendingEmail = cleanEmail;
    currentDTMUser.emailVerified = false;
  }

  // Eşlemeyi ŞİMDİ yaz (doğrulanmamış olarak). Kullanıcı linke tıkladığında Firebase
  // auth e-postasını değiştirip mevcut oturumun token'larını iptal ediyor; o andan
  // sonra oturum içinden yazma şansımız kalmayabilir ve kullanıcı adıyla giriş
  // kalıcı olarak bozulur. Şifre sıfırlama bu kaydı doğrulanana kadar kullanmaz.
  const mapUsername = currentDTMUser?.username;
  if (mapUsername) await syncUsernameEmailMap(mapUsername, cleanEmail, false);

  return cleanEmail;
}

// Profil açıldığında veya yenile dendiğinde doğrulama durumunu Firebase Auth ile eşitle
async function epostaDurumunuGuncelle() {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    await user.reload();
  } catch(e) {
    console.warn('User reload hatası:', e);
  }

  const authEmail = user.email;
  const isCustomEmail = authEmail && !authEmail.endsWith('@dtm.local');
  // Sadece Firebase Auth'un kendi emailVerified bayrağına güvenilir — bir e-postanın
  // @dtm.local olmaması onun doğrulandığı anlamına gelmez (admin, kullanıcı oluştururken
  // hiç doğrulatmadan gerçek bir e-posta atamış olabilir).
  const isVerified = isCustomEmail && Boolean(user.emailVerified);

  if (isVerified) {
    await db.collection('users').doc(user.uid).update({
      email: authEmail,
      emailVerified: true,
      pendingEmail: null
    }).catch(e => console.warn('Firestore email sync error:', e));

    if (currentDTMUser) {
      currentDTMUser.email = authEmail;
      currentDTMUser.emailVerified = true;
      currentDTMUser.pendingEmail = null;
    }
    if (currentDTMUser?.username) syncUsernameEmailMap(currentDTMUser.username, authEmail, true);
  }

  return {
    email: isCustomEmail ? authEmail : (currentDTMUser?.email || ''),
    emailVerified: isVerified,
    pendingEmail: currentDTMUser?.pendingEmail || null
  };
}

// Giriş ekranı "Şifremi Unuttum" talebi (güvenlik için doğrudan kayıtlı e-posta istenir)
async function sifreSifirlamaGonder(identifier) {
  identifier = (identifier || '').trim();
  if (!identifier) throw new Error('Lütfen kayıtlı e-posta adresinizi giriniz.');

  if (!identifier.includes('@')) {
    throw new Error('Şifre sıfırlama bağlantısı alabilmek için lütfen hesabınıza tanımlı e-posta adresinizi giriniz (örn: ornek@karaman.gov.tr).');
  }

  const targetEmail = identifier.toLowerCase();

  // Firebase Auth üzerinden şifre sıfırlama bağlantısı gönder
  try {
    await auth.sendPasswordResetEmail(targetEmail);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      throw new Error('Bu e-posta adresine ait bir kullanıcı hesabı bulunamadı.');
    } else if (err.code === 'auth/invalid-email') {
      throw new Error('Geçersiz bir e-posta adresi formatı girdiniz.');
    } else if (err.code === 'auth/too-many-requests') {
      throw new Error('Çok fazla sıfırlama talebinde bulunuldu. Lütfen birkaç dakika bekleyiniz.');
    } else {
      throw new Error('Şifre sıfırlama bağlantısı gönderilemedi: ' + err.message);
    }
  }

  return maskEmail(targetEmail);
}

// Son giriş tarihini Firestore'a kaydet
async function updateLastLogin() {
  const user = auth.currentUser;
  if (!user) return;
  await db.collection('users').doc(user.uid).update({
    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(e => console.warn('[lastLogin] Kaydedilemedi:', e?.code, e?.message));
}

// ===== REFERANS FIRESTORE FONKSİYONLARI =====

// Kullanıcının referans verisini Firestore'dan yükle
async function loadReferansFromCloud() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await db.collection('referans').doc(user.uid).get();
  return snap.exists ? snap.data() : null;
}

// Kullanıcının referans verisini Firestore'a kaydet
async function saveReferansToCloud(referansData) {
  const user = auth.currentUser;
  if (!user) return;
  await db.collection('referans').doc(user.uid).set({
    ...referansData,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Global referans verisini Firestore'dan yükle (idare, müdürlük, amir, ilçe)
async function loadGlobalReferansFromCloud() {
  const snap = await db.collection('globalReferans').doc('default').get();
  return snap.exists ? snap.data() : null;
}

// Global referans verisini Firestore'a kaydet (sadece superadmin)
async function saveGlobalReferansToCloud(data) {
  await db.collection('globalReferans').doc('default').set({
    ...data,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ===== PROJE FIRESTORE FONKSİYONLARI =====

// Projeyi buluta kaydet (yeni)
async function saveProjeToCloud(projeData) {
  const user = auth.currentUser;
  if (!user) throw new Error('Giriş yapılmamış');
  const ref = db.collection('projeler').doc();
  await ref.set({
    userId: user.uid,
    userDisplayName: currentDTMUser?.displayName || '',
    isAdi: projeData.isAdi || '(İsimsiz)',
    isTuru: projeData.isTuru || 'Yapım İşi',
    data: projeData,
    status: 'taslak',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return ref.id;
}

// Projeyi gerçekleştirmeciye gönder
async function gonderiProje(projeId, gerceklestirmeciUid, gerceklestirmeciAd, kazananBasitUsul = false) {
  await db.collection('projeler').doc(projeId).update({
    status: 'gonderildi',
    gonderildiAt: firebase.firestore.FieldValue.serverTimestamp(),
    gonderildiBy: currentDTMUser?.displayName || '',
    atananGerceklestirmeciUid: gerceklestirmeciUid,
    atananGerceklestirmeciAd: gerceklestirmeciAd,
    kazananBasitUsul: kazananBasitUsul
  });
}

// Gerçekleştirmecileri getir (veri sızıntısını önlemek için yalnızca genel ad ve rol içeren publicUsers'tan okur)
async function getGerceklestirmeciler() {
  try {
    const snap = await db.collection('publicUsers').where('role', '==', 'gerceklestirmeci').get();
    if (!snap.empty) {
      return snap.docs.map(d => ({ uid: d.id, displayName: d.data().displayName || '', role: d.data().role }));
    }
  } catch (e) {
    console.warn('publicUsers sorgulanamadı:', e);
  }
  // Fallback (admin/superadmin veya ilk kurulum için)
  try {
    const snap = await db.collection('users').where('role', '==', 'gerceklestirmeci').get();
    return snap.docs.map(d => ({ uid: d.id, displayName: d.data().displayName || '', role: d.data().role }));
  } catch (e) {
    return [];
  }
}

// Projeyi geri gönder (gerçekleştirmeci)
async function geriGonderProje(projeId, not) {
  await db.collection('projeler').doc(projeId).update({
    status: 'geri_gonderildi',
    geriGonderNot: not,
    geriGonderAt: firebase.firestore.FieldValue.serverTimestamp(),
    geriGonderBy: currentDTMUser?.displayName || ''
  });
}

// Projeyi onayla (gerçekleştirmeci)
async function onaylaProje(projeId) {
  await db.collection('projeler').doc(projeId).update({
    status: 'onaylandi',
    onaylandiAt: firebase.firestore.FieldValue.serverTimestamp(),
    onaylandiBy: currentDTMUser?.displayName || ''
  });
}

// Mevcut projeyi güncelle
async function updateProjeInCloud(projeId, projeData) {
  await db.collection('projeler').doc(projeId).update({
    isAdi: projeData.isAdi || '(İsimsiz)',
    isTuru: projeData.isTuru || 'Yapım İşi',
    data: projeData,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Kullanıcının projelerini getir (en fazla PROJE_LIMIT kayıt)
const PROJE_LIMIT = 500;
async function getUserProjeler() {
  const user = auth.currentUser;
  if (!user) return [];
  let query;
  if (['admin', 'superadmin'].includes(currentDTMUser?.role)) {
    query = db.collection('projeler');
  } else if (currentDTMUser?.role === 'gerceklestirmeci') {
    query = db.collection('projeler').where('atananGerceklestirmeciUid', '==', user.uid);
  } else {
    query = db.collection('projeler').where('userId', '==', user.uid);
  }
  // Limit + limit aşıldıysa konsola uyarı
  const snap = await query.limit(PROJE_LIMIT).get();
  if (snap.size === PROJE_LIMIT) {
    console.warn(`[projeler] Limit (${PROJE_LIMIT}) doldu — eski projeler gösterilmeyebilir.`);
  }
  const docs = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      isTuru: data.isTuru || data.data?.isTuru || 'Yapım İşi'
    };
  });
  // Index gerektirmemek için client tarafında sırala
  return docs.sort((a, b) => {
    const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
    const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
    return tB - tA;
  });
}

// Projeyi sil
async function deleteProjeFromCloud(projeId) {
  await db.collection('projeler').doc(projeId).delete();
}

// Tekil proje getir
async function getProjeFromCloud(projeId) {
  const snap = await db.collection('projeler').doc(projeId).get();
  if (!snap.exists) throw new Error('Proje bulunamadı');
  return { id: snap.id, ...snap.data() };
}

// ===== İŞE AİT DOSYALAR (Firestore Alt-Koleksiyonu & Base64) =====
// Fotoğraf, fatura, vergi borcu belgesi vb. harici depolama gerektirmeden
// doğrudan Firestore'da 'projeler/{projeId}/dosyalar' koleksiyonuna kaydedilir.
const PROJE_DOSYA_MAX_BOYUT = 5 * 1024 * 1024; // Maksimum dosya boyutu: 5 MB
const PROJE_DOSYA_IZIN_VERILEN_UZANTILAR = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'
];
const PROJE_DOSYA_IZIN_VERILEN_TIPLER = [
  'image/', 'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.', 'application/vnd.ms-excel',
  'application/x-pdf'
];

function projeDosyaTipiIzinli(dosya) {
  const ad = (dosya.name || '').toLowerCase();
  const uzantiGecerli = PROJE_DOSYA_IZIN_VERILEN_UZANTILAR.some(u => ad.endsWith(u));
  const tipGecerli = dosya.type && PROJE_DOSYA_IZIN_VERILEN_TIPLER.some(t => dosya.type.startsWith(t));
  return uzantiGecerli || tipGecerli;
}

function dosyaMimeTipiBelirle(dosya) {
  if (dosya.type && dosya.type !== 'application/octet-stream') return dosya.type;
  const ad = (dosya.name || '').toLowerCase();
  if (ad.endsWith('.pdf')) return 'application/pdf';
  if (ad.endsWith('.doc')) return 'application/msword';
  if (ad.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ad.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (ad.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ad.endsWith('.jpg') || ad.endsWith('.jpeg')) return 'image/jpeg';
  if (ad.endsWith('.png')) return 'image/png';
  if (ad.endsWith('.webp')) return 'image/webp';
  return 'application/pdf';
}

// Resimleri tarayıcıda kayıpsız sıkıştırıp Base64 JPEG üretir
function compressImage(file, maxDimension = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Dosyayı Base64 Data URL formatına çevirir
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.onload = (e) => resolve((e && e.target ? e.target.result : null) || reader.result);
    reader.readAsDataURL(file);
  });
}

// Base64 verisini Blob formatına çevirir
function base64ToBlob(base64Data, contentType) {
  const parts = base64Data.split(';base64,');
  const type = contentType || (parts[0] ? parts[0].replace('data:', '') : 'application/pdf');
  const rawBase64 = parts[1] || parts[0];
  const byteCharacters = atob(rawBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: type });
}

// Dosyayı yeni sekmede önizler veya doğrudan indirir
window.projeDosyaGoruntule = function(base64Data, dosyaAdi, contentType) {
  try {
    const mime = contentType || dosyaMimeTipiBelirle({ name: dosyaAdi, type: '' });
    const blob = base64ToBlob(base64Data, mime);
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  } catch(e) {
    const a = document.createElement('a');
    a.href = base64Data;
    a.download = dosyaAdi || 'dosya';
    a.click();
  }
};

// Projeye dosya yükle (Firestore alt-koleksiyonuna)
async function projeDosyaYukle(projeId, dosya) {
  if (dosya.size > PROJE_DOSYA_MAX_BOYUT) {
    throw new Error('Dosya boyutu 5 MB\'tan büyük olamaz. Lütfen daha küçük bir dosya seçin.');
  }

  if (!projeDosyaTipiIzinli(dosya)) {
    throw new Error('Bu dosya türü desteklenmiyor. Resim, PDF, Word veya Excel dosyası yükleyin.');
  }

  const mimeTipi = dosyaMimeTipiBelirle(dosya);
  let dataUrl = '';
  let sonBoyut = dosya.size;

  if (mimeTipi.startsWith('image/')) {
    // Fotoğrafları otomatik optimize et (mobil kamera fotoları 200-300 KB'a iner)
    dataUrl = await compressImage(dosya);
    sonBoyut = Math.round((dataUrl.length * 3) / 4);
  } else {
    // PDF / Word / Excel dosyaları
    dataUrl = await fileToBase64(dosya);
  }

  const docRef = db.collection('projeler').doc(projeId).collection('dosyalar').doc();
  const CHUNK_SIZE = 700 * 1024; // 700 KB chunk (Firestore 1 MB doküman sınırına tam uyar)

  if (dataUrl.length <= CHUNK_SIZE) {
    // Tek doküman olarak sığıyor
    await docRef.set({
      ad: dosya.name,
      boyut: sonBoyut,
      tip: mimeTipi,
      yukleyenAd: currentDTMUser?.displayName || currentDTMUser?.username || '',
      yukleyenUid: currentDTMUser?.uid || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      parcali: false,
      data: dataUrl
    });
  } else {
    // 1 MB'ı aşan büyük PDF'ler için parçalama (chunking)
    const chunks = [];
    for (let i = 0; i < dataUrl.length; i += CHUNK_SIZE) {
      chunks.push(dataUrl.slice(i, i + CHUNK_SIZE));
    }

    // Meta dokümanı ve parçaları tek bir atomik batch içinde yaz (yarım kalma/boş kayıt riskini sıfırlar)
    const batch = db.batch();
    batch.set(docRef, {
      ad: dosya.name,
      boyut: sonBoyut,
      tip: mimeTipi,
      yukleyenAd: currentDTMUser?.displayName || currentDTMUser?.username || '',
      yukleyenUid: currentDTMUser?.uid || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      parcali: true,
      parcaSayisi: chunks.length
    });

    chunks.forEach((chunk, index) => {
      const chunkDoc = docRef.collection('parcalar').doc(String(index).padStart(3, '0'));
      batch.set(chunkDoc, { index, chunk });
    });
    await batch.commit();
  }

  return `projeler/${projeId}/dosyalar/${docRef.id}`;
}

// Büyük parçalı dosyaların içeriğini birleştirerek getirir
async function projeDosyaIcerigiGetir(projeId, docId, dosyaMeta) {
  if (!dosyaMeta.parcali && dosyaMeta.url) {
    return dosyaMeta.url;
  }
  const snap = await db.collection('projeler').doc(projeId)
    .collection('dosyalar').doc(docId)
    .collection('parcalar').orderBy('index', 'asc')
    .get();

  const fullData = snap.docs.map(d => d.data().chunk).join('');
  return fullData;
}

// Projeye ait yüklenmiş dosyaları listele (en yeni en üstte)
async function projeDosyalariGetir(projeId) {
  const snap = await db.collection('projeler').doc(projeId).collection('dosyalar')
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      projeId: projeId,
      docId: doc.id,
      yol: `projeler/${projeId}/dosyalar/${doc.id}`,
      ad: d.ad || 'İsimsiz Belge',
      boyut: d.boyut || 0,
      tip: d.tip || 'application/pdf',
      parcali: Boolean(d.parcali),
      yukleyenAd: d.yukleyenAd || '',
      yuklenmeTarihi: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : new Date().toISOString(),
      url: d.data || ''
    };
  });
}

// Projeye ait bir dosyayı sil
async function projeDosyaSil(yol) {
  const docRef = db.doc(yol);
  const subSnap = await docRef.collection('parcalar').get();
  if (!subSnap.empty) {
    const batch = db.batch();
    subSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  await docRef.delete();
}

// ===== DUYURU FONKSİYONLARI =====

// Tüm duyuruları getir
async function getDuyurular() {
  const snap = await db.collection('duyurular').orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Duyuru oluştur (admin)
async function createDuyuru(baslik, mesaj) {
  await db.collection('duyurular').add({
    baslik,
    mesaj,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: currentDTMUser?.displayName || currentDTMUser?.username || ''
  });
}

// Duyuru sil (admin)
async function deleteDuyuru(id) {
  await db.collection('duyurular').doc(id).delete();
}

// Kullanıcının okunan duyurularını getir
async function getOkunanDuyurular() {
  const snap = await db.collection('users').doc(currentDTMUser.uid).get();
  return snap.data()?.okunanDuyurular || [];
}

// Duyuruyu okundu olarak işaretle
async function duyuruOkunduIsaretle(duyuruId) {
  await db.collection('users').doc(currentDTMUser.uid).update({
    okunanDuyurular: firebase.firestore.FieldValue.arrayUnion(duyuruId)
  });
}

// Kullanıcının kendi listesinden gizlediği (kişisel olarak sildiği) duyuruları getir
async function getSilinenDuyurular() {
  const snap = await db.collection('users').doc(currentDTMUser.uid).get();
  return snap.data()?.silinenDuyurular || [];
}

// Duyuruyu sadece bu kullanıcı için gizle (herkesten silmez, sadece kendi
// listesinden kaldırır — asıl duyuru dokümanı ve diğer kullanıcılar etkilenmez)
async function duyuruKendindenGizle(duyuruId) {
  await db.collection('users').doc(currentDTMUser.uid).update({
    silinenDuyurular: firebase.firestore.FieldValue.arrayUnion(duyuruId)
  });
}

// Kullanıcı rolünü değiştir (superadmin)
async function changeUserRole(uid, newRole) {
  await db.collection('users').doc(uid).update({ role: newRole });
  await db.collection('publicUsers').doc(uid).set({ role: newRole }, { merge: true }).catch(() => {});
}

// Avatar seç ve Firestore'a kaydet (hazır avatarlardan biri)
async function setAvatar(avatarName) {
  const user = auth.currentUser;
  if (!user) throw new Error('Giriş yapılmamış');
  await db.collection('users').doc(user.uid).update({ avatar: avatarName });
  if (currentDTMUser) currentDTMUser.avatar = avatarName;
}

// Proje kilit durumunu değiştir
async function toggleProjeLock(projeId, locked) {
  await db.collection('projeler').doc(projeId).update({
    locked: locked,
    lockedAt: locked ? firebase.firestore.FieldValue.serverTimestamp() : null,
    lockedBy: locked ? (currentDTMUser?.displayName || currentDTMUser?.username || '') : null
  });
}
