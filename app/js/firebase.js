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
    // Eşlemeyi doğrulanmamış hesaplar için de yaz: yönetici tarafından gerçek e-postayla
    // açılan hesaplarda emailVerified false olur, ama kullanıcı adıyla giriş yine de
    // çalışmalı. Giriş zaten şifre istediği için bu bir güvenlik gevşemesi değil;
    // şifre sıfırlama yalnızca verified:true kaydı kullanmaya devam ediyor.
    if (userData.username) syncUsernameEmailMap(userData.username, cred.user.email, isVerified);
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

    // Kullanıcı adı → e-posta eşlemesi. Bu yazılmazsa kullanıcı, kullanıcı adıyla
    // giriş yapamaz: auth hesabı gerçek e-postayla açıldığı için `kullaniciadi@dtm.local`
    // denemesi boşa gider ve eşleme olmadan gerçek adrese ulaşılamaz.
    // Firestore kuralı yalnızca kişinin KENDİ kullanıcı adına yazmasına izin verdiği için
    // bu kayıt, yönetici oturumuyla değil, yeni kullanıcının oturumuyla (secondaryApp) yazılır.
    if (cleanEmail) {
      try {
        await secondaryApp.firestore().collection('usernameEmailMap').doc(cleanUsername)
          .set({ email: cleanEmail, verified: false });
      } catch (e) {
        console.warn('usernameEmailMap (yeni kullanıcı) yazılamadı:', e);
      }
    }

    await secondaryApp.auth().signOut();
    return cred.user.uid;
  } finally {
    await secondaryApp.delete();
  }
}

// Tüm kullanıcıları getir (admin) - e-posta ve doğrulama durumları dahil
async function getAllUsers() {
  const snap = await db.collection('users').orderBy('displayName').get();
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
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

// Giriş ekranı "Şifremi Unuttum" talebi
async function sifreSifirlamaGonder(identifier) {
  identifier = (identifier || '').trim();
  if (!identifier) throw new Error('Kullanıcı adınızı veya e-posta adresinizi giriniz.');

  let targetEmail = '';

  if (identifier.includes('@')) {
    targetEmail = identifier.toLowerCase();
  } else {
    // Kullanıcı adı girildiyse eşleme dokümanından doğrulanmış e-postaya bak
    const cleanUsername = identifier.toLowerCase();
    targetEmail = await getEmailByUsername(cleanUsername, true);

    if (!targetEmail) {
      throw new Error('Lütfen hesabınıza tanımlı e-posta adresinizi giriniz (örn: ornek@karaman.gov.tr).');
    }
  }

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

// Gerçekleştirmecileri getir
async function getGerceklestirmeciler() {
  const snap = await db.collection('users').where('role', '==', 'gerceklestirmeci').get();
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
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
