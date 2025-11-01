// Firebase configuration
// Sostituisci con le tue credenziali da Firebase Console

export const firebaseConfig = {
  apiKey: "AIzaSyDljsw4Lrh1tOoVtLZU2XPiL12gcb104rU",
  authDomain: "sandtv-3d909.firebaseapp.com",
  projectId: "sandtv-3d909",
  storageBucket: "sandtv-3d909.firebasestorage.app",
  messagingSenderId: "47675571365",
  appId: "1:47675571365:web:41aebdc03379885d41214c"
};

// Inizializza Firebase quando l'app si carica
let app: any = null;
let auth: any = null;
let db: any = null;

export const initFirebase = () => {
  if (typeof window === 'undefined') return;
  
  // @ts-ignore - Firebase è caricato via CDN
  if (typeof firebase !== 'undefined' && !app) {
    // @ts-ignore
    app = firebase.initializeApp(firebaseConfig);
    // @ts-ignore
    auth = firebase.auth();
    // @ts-ignore
    db = firebase.firestore();
  }
  
  return { app, auth, db };
};

export const getAuth = () => {
  if (!auth) initFirebase();
  return auth;
};

export const getDb = () => {
  if (!db) initFirebase();
  return db;
};
