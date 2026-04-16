// ===================== FIREBASE.JS =====================
// firebaseConfig, config.js dosyasından yükleniyor (gitignore'da)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
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

let currentDTMUser = null; // { uid, username, displayName, role }

function usernameToEmail(username) {
  return `${username.toLowerCase().trim()}@dtm.local`;
}

// Giriş yap
async function dtmLogin(username, password) {
  const email = usernameToEmail(username);
  const cred = await auth.signInWithEmailAndPassword(email, password);
  const snap = await db.collection('users').doc(cred.user.uid).get();
  currentDTMUser = { uid: cred.user.uid, ...snap.data() };
  return currentDTMUser;
}

// Çıkış yap
async function dtmLogout() {
  currentDTMUser = null;
  await auth.signOut();
}

// Yeni kullanıcı oluştur (admin) - secondary app ile mevcut oturum korunur
async function createDTMUser(username, password, displayName, role) {
  const secondaryApp = firebase.initializeApp(firebaseConfig, 'secondary_' + Date.now());
  try {
    const email = usernameToEmail(username);
    const cred = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
    await db.collection('users').doc(cred.user.uid).set({
      username: username.toLowerCase().trim(),
      displayName,
      role: role || 'user',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await secondaryApp.auth().signOut();
    return cred.user.uid;
  } finally {
    await secondaryApp.delete();
  }
}

// Tüm kullanıcıları getir (admin)
async function getAllUsers() {
  const snap = await db.collection('users').orderBy('displayName').get();
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// Kullanıcı şifresini güncelle (admin)
async function updateUserPassword(username, newPassword) {
  const secondaryApp = firebase.initializeApp(firebaseConfig, 'pwupdate_' + Date.now());
  try {
    const cred = await secondaryApp.auth().signInWithEmailAndPassword(
      usernameToEmail(username), newPassword
    );
    await cred.user.updatePassword(newPassword);
    await secondaryApp.auth().signOut();
  } finally {
    await secondaryApp.delete();
  }
}

// Şifre değiştir (mevcut şifre ile yeniden auth gerekli)
async function changePassword(mevcutSifre, yeniSifre) {
  const user = auth.currentUser;
  const credential = firebase.auth.EmailAuthProvider.credential(user.email, mevcutSifre);
  await user.reauthenticateWithCredential(credential);
  await user.updatePassword(yeniSifre);
}

// Son giriş tarihini Firestore'a kaydet
async function updateLastLogin() {
  const user = auth.currentUser;
  if (!user) return;
  await db.collection('users').doc(user.uid).update({
    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(() => {});
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
    data: projeData,
    status: 'taslak',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return ref.id;
}

// Projeyi gerçekleştirmeciye gönder
async function gonderiProje(projeId, gerceklestirmeciUid, gerceklestirmeciAd) {
  await db.collection('projeler').doc(projeId).update({
    status: 'gonderildi',
    gonderildiAt: firebase.firestore.FieldValue.serverTimestamp(),
    gonderildiBy: currentDTMUser?.displayName || '',
    atananGerceklestirmeciUid: gerceklestirmeciUid,
    atananGerceklestirmeciAd: gerceklestirmeciAd
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
    data: projeData,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Kullanıcının projelerini getir
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
  const snap = await query.get();
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
