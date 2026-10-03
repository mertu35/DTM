let qaTestAccount;
async function qaAuthAction(action) {
  const response = await fetch('/test-auth-' + action, { method: 'POST' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Local test failed');
  return result;
}
dtmRegisterEvent('qa-auth-prepare', async function() {
  try {
    await dtmLogout();
    qaTestAccount = await qaAuthAction('prepare');
    document.getElementById('loginUsername').value = qaTestAccount.username;
    document.getElementById('loginPassword').value = qaTestAccount.password;
    document.getElementById('qaAuthStatus').textContent = 'Yeni test adresi: ' + qaTestAccount.newEmail;
  } catch(error) { document.getElementById('qaAuthStatus').textContent = error.message; }
});
dtmRegisterEvent('qa-auth-verify', async function() {
  try {
    await qaAuthAction('verify');
    document.getElementById('qaAuthStatus').textContent = 'Emülatör doğrulama bağlantısı uygulandı: ' + qaTestAccount.newEmail;
  } catch(error) { document.getElementById('qaAuthStatus').textContent = error.message; }
});
dtmRegisterEvent('qa-auth-state', async function() {
  try {
    const state = await qaAuthAction('state');
    document.getElementById('qaAuthStatus').textContent = JSON.stringify(state);
  } catch(error) { document.getElementById('qaAuthStatus').textContent = error.message; }
});
dtmRegisterEvent('qa-auth-cleanup', async function() {
  try {
    await auth.signOut();
    await qaAuthAction('cleanup');
    document.getElementById('qaAuthStatus').textContent = 'Yerel test hesabı ve profili temizlendi.';
  } catch(error) { document.getElementById('qaAuthStatus').textContent = error.message; }
});

// Display the SDK error code for local diagnostics, without credentials or tokens.
const qaOriginalLogin = dtmLogin;
dtmLogin = async (...args) => {
  try { return await qaOriginalLogin(...args); }
  catch(error) {
    document.getElementById('qaAuthStatus').textContent = 'SDK giriş sonucu: ' + (error.code || error.message);
    throw error;
  }
};
