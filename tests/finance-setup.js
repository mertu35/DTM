// Replace cloud/storage entry points before loading the application.
    loadReferans = () => getDefaultReferans();
    const auth = { onAuthStateChanged() {} };
    let currentDTMUser = { displayName:'Test Kullanıcısı', role:'user' };

window.dtmDisableServiceWorker = true;
