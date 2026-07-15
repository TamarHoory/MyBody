/**
 * storage.js — Firebase Persistence Layer
 *
 * Replaces localStorage with Firebase Firestore and Google Auth.
 * Features real-time syncing across devices and automatic migration of legacy local data.
 */
(function (global) {
  'use strict';

  // =========================================================================
  // FIREBASE CONFIGURATION
  // =========================================================================
  // TODO: Replace with your actual Firebase project config
  const firebaseConfig = {
    apiKey: "AIzaSyC_jVbjbEylXjKvSBdH0MGZ5sRIaI1MAmU",
    authDomain: "mybody-app-62f94.firebaseapp.com",
    projectId: "mybody-app-62f94",
    storageBucket: "mybody-app-62f94.firebasestorage.app",
    messagingSenderId: "935721302121",
    appId: "1:935721302121:web:b8f3891affd2468f7d0af8",
    measurementId: "G-4SZ2HC2LGZ"
  };

  // Initialize Firebase (using compat libraries loaded in index.html)
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  // In-memory cache for synchronous reads
  let currentUser = null;
  let cachedProfile = null;
  let cachedEntries = [];
  
  let isReady = false;
  let readyChecks = 0;
  let unsubscribeProfile = null;
  let unsubscribeEntries = null;

  let isLocalMode = false;

  function _saveLocalModeData() {
    localStorage.setItem('mybody_local_dev', JSON.stringify({
      profile: cachedProfile,
      entries: cachedEntries
    }));
  }

  /* ---- Firebase Auth & Sync Logic ---- */

  // Migrate any old local storage data to the cloud on first login
  function _migrateLocalToCloud(uid) {
    const raw = localStorage.getItem('mybodyapp_v1');
    if (!raw) return;
    try {
      const local = JSON.parse(raw);
      if (local.profile) {
        db.collection('users').doc(uid).set({ profile: local.profile }, { merge: true });
      }
      if (local.entries && local.entries.length > 0) {
        const batch = db.batch();
        local.entries.forEach(e => {
          if (!e.id) e.id = _uuid();
          const ref = db.collection('users').doc(uid).collection('entries').doc(e.id);
          batch.set(ref, e);
        });
        batch.commit();
      }
      localStorage.removeItem('mybodyapp_v1');
      console.log('[Storage] Successfully migrated local data to cloud.');
    } catch (e) {
      console.error('[Storage] Failed to migrate local data:', e);
    }
  }

  function _bootApp(uid) {
    // Fetch data ONE TIME to boot the app stably (prevents any snapshot loops)
    Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('users').doc(uid).collection('entries').get()
    ]).then(([profileDoc, entriesSnapshot]) => {
      
      if (profileDoc.exists) {
        cachedProfile = profileDoc.data().profile || null;
      } else {
        cachedProfile = null;
      }

      const entries = [];
      entriesSnapshot.forEach(doc => {
        entries.push({ id: doc.id, ...doc.data() });
      });
      cachedEntries = entries;

      // Now that data is loaded, boot the UI ONCE.
      isReady = true;
      if (typeof AppController !== 'undefined') {
        AppController.renderApp();
      }

      // Start silent background listeners for future updates
      _startSilentListeners(uid);

    }).catch(err => {
      console.error("Error during app boot:", err);
      alert("שגיאה בטעינת נתונים מהענן.");
    });
  }

  function _startSilentListeners(uid) {
    if (unsubscribeProfile) unsubscribeProfile();
    if (unsubscribeEntries) unsubscribeEntries();

    unsubscribeProfile = db.collection('users').doc(uid).onSnapshot(doc => {
      if (doc.exists) {
        cachedProfile = doc.data().profile || null;
      } else {
        cachedProfile = null;
      }
      if (typeof AppController !== 'undefined' && isReady && cachedProfile) {
        // Only refresh the inner UI components silently
        AppController.init(); 
      }
    });

    unsubscribeEntries = db.collection('users').doc(uid).collection('entries').onSnapshot(snapshot => {
      const entries = [];
      snapshot.forEach(doc => {
        entries.push({ id: doc.id, ...doc.data() });
      });
      cachedEntries = entries;
      if (typeof AppController !== 'undefined' && isReady && cachedProfile) {
        // Only refresh the inner UI components silently
        if (typeof AppController.refresh === 'function') {
          AppController.refresh();
        }
      }
    });
  }

  // Monitor Auth State
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      document.getElementById('login-error').textContent = '';
      
      // Attempt migration if needed
      _migrateLocalToCloud(user.uid);
      
      // Boot the app with a stable one-time fetch
      _bootApp(user.uid);
      
    } else {
      currentUser = null;
      cachedProfile = null;
      cachedEntries = [];
      isReady = false;
      
      // Stop listeners
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeEntries) unsubscribeEntries();

      // Delegate UI rendering to AppController
      if (typeof AppController !== 'undefined') {
        AppController.renderApp();
      }
    }
  });

  function loginLocalMode(e) {
    if (e) e.preventDefault();
    isLocalMode = true;
    currentUser = { uid: 'local_dev_user', displayName: 'Local Mode' };
    isReady = true;

    const raw = localStorage.getItem('mybody_local_dev');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        cachedProfile = data.profile || null;
        cachedEntries = data.entries || [];
      } catch (err) {
        cachedProfile = null;
        cachedEntries = [];
      }
    } else {
      cachedProfile = null;
      cachedEntries = [];
    }

    if (typeof AppController !== 'undefined') {
      AppController.renderApp();
    }
  }

  function loginWithGoogle(e) {
    if (e) e.preventDefault();
    if (window.location.protocol === 'file:') {
      console.warn("Local file:// protocol detected. Forcing Local Dev Mode.");
      loginLocalMode(e);
      return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
      document.getElementById('login-error').textContent = 'שגיאה בהתחברות: ' + err.message;
      console.error('Login error:', err);
      alert('שגיאת התחברות לגוגל: ' + err.message + '\n\nאם כתוב שהדומיין לא מורשה (unauthorized domain), חובה להוסיף את הקישור של Netlify להגדרות ב-Firebase!');
    });
  }

  function logout() {
    auth.signOut();
  }

  function _uuid() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  /* ---- Public API ---- */

  function getCurrentUser() {
    return currentUser;
  }

  function isSetupComplete() {
    return cachedProfile !== null;
  }

  function saveProfile(profile) {
    if (!currentUser) return;
    // Optimistic update
    cachedProfile = { ...profile }; 
    if (isLocalMode) {
      _saveLocalModeData();
      return;
    }
    db.collection('users').doc(currentUser.uid).set({ profile }, { merge: true }).catch(e => {
      console.error("Save profile error:", e);
      alert('שגיאה בשמירת נתונים בענן.');
    });
  }

  function getProfile() {
    const p = cachedProfile ? { ...cachedProfile } : null;
    if (p) {
      // Dynamic age
      if (p.birthDate) {
        const today = new Date();
        const bdate = new Date(p.birthDate);
        let age = today.getFullYear() - bdate.getFullYear();
        const m = today.getMonth() - bdate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < bdate.getDate())) {
          age--;
        }
        p.age = age;
      }
    }
    return p;
  }

  function getEntries() {
    return [...cachedEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  function addEntry(entry) {
    if (!currentUser) return;
    const id = _uuid();
    const saved = { ...entry, id };
    
    // Optimistic update
    cachedEntries.push(saved);
    if (isLocalMode) {
      _saveLocalModeData();
      return saved;
    }
    
    db.collection('users').doc(currentUser.uid).collection('entries').doc(id).set(saved).catch(e => {
       console.error("Add entry error:", e);
    });
    return saved;
  }

  function updateEntry(id, updated) {
    if (!currentUser) return false;
    
    // Optimistic update
    const idx = cachedEntries.findIndex(e => e.id === id);
    if (idx === -1) return false;
    
    cachedEntries[idx] = { ...updated, id };
    if (isLocalMode) {
      _saveLocalModeData();
      return true;
    }

    db.collection('users').doc(currentUser.uid).collection('entries').doc(id).set(cachedEntries[idx]).catch(e => {
      console.error("Update entry error:", e);
    });
    return true;
  }

  function deleteEntry(id) {
    if (!currentUser) return;
    
    // Optimistic update
    cachedEntries = cachedEntries.filter(e => e.id !== id);
    if (isLocalMode) {
      _saveLocalModeData();
      return;
    }

    db.collection('users').doc(currentUser.uid).collection('entries').doc(id).delete().catch(e => {
       console.error("Delete entry error:", e);
    });
  }

  function exportData() {
    return { profile: cachedProfile, entries: cachedEntries };
  }

  function downloadBackup() {
    const raw = localStorage.getItem('mybodyapp_v1');
    if (!raw) {
      alert('אין נתונים מקומיים לייצוא.');
      return;
    }
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mybody_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function restoreBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.profile) throw new Error("קובץ לא תקין");
        
        // If logged in, push directly to Firebase
        if (currentUser) {
          db.collection('users').doc(currentUser.uid).set({ profile: data.profile }, { merge: true });
          if (data.entries && data.entries.length > 0) {
            const batch = db.batch();
            data.entries.forEach(entry => {
              if (!entry.id) entry.id = _uuid();
              const ref = db.collection('users').doc(currentUser.uid).collection('entries').doc(entry.id);
              batch.set(ref, entry);
            });
            batch.commit();
          }
          alert('הנתונים שוחזרו בהצלחה לענן!');
          
          // Seamlessly transition to the main app without a page refresh
          cachedProfile = data.profile;
          if (data.entries) {
            cachedEntries = data.entries;
          }
          document.getElementById('onboarding-overlay').classList.add('hidden');
          document.getElementById('app').classList.remove('hidden');
          if (typeof AppController !== 'undefined') {
            AppController.init();
          }
        } else {
          alert('יש להתחבר לחשבון לפני שחזור גיבוי!');
        }
      } catch (err) {
        alert('שגיאה בקריאת קובץ הגיבוי. נא לוודא שזה הקובץ הנכון.');
      }
    };
    reader.readAsText(file);
  }

  function clearAll() {
    if (!currentUser || !confirm("האם למחוק הכל? (מחיקה לא תמחק בענן אלא אם נממש פונקציית שרת)")) {
      return;
    }
    // Hard to delete entire collection from client cleanly, typically requires looping.
    // We'll just loop and delete existing in cache.
    cachedEntries.forEach(e => deleteEntry(e.id));
    db.collection('users').doc(currentUser.uid).delete(); // Deletes profile
  }

  global.StorageService = {
    isSetupComplete,
    saveProfile,
    getProfile,
    getEntries,
    addEntry,
    updateEntry,
    deleteEntry,
    exportData,
    downloadBackup,
    restoreBackup,
    clearAll,
    loginWithGoogle,
    loginLocalMode,
    logout,
    getCurrentUser
  };

})(window);
