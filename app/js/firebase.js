// ===================== FIREBASE.JS =====================
const firebaseConfig = {
  apiKey: "AIzaSyA3Wm_jGplJ3W51Fu8o-UAZajeBsvJeCsg",
  authDomain: "dtmd-b927d.firebaseapp.com",
  projectId: "dtmd-b927d",
  storageBucket: "dtmd-b927d.firebasestorage.app",
  messagingSenderId: "759515234039",
  appId: "1:759515234039:web:38f8357cb07e19b1a49df2"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

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
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return ref.id;
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
  if (currentDTMUser?.role === 'admin') {
    query = db.collection('projeler').orderBy('updatedAt', 'desc');
  } else {
    query = db.collection('projeler')
      .where('userId', '==', user.uid)
      .orderBy('updatedAt', 'desc');
  }
  const snap = await query.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
