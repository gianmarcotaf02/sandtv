# 🔥 Guida Configurazione Firebase

## 1. Crea progetto Firebase (GRATIS)

1. Vai su https://console.firebase.google.com/
2. Clicca "Aggiungi progetto"
3. Nome progetto: **sandtv** (o quello che vuoi)
4. Disabilita Google Analytics (non serve)
5. Crea progetto

## 2. Attiva Authentication

1. Nel menu laterale → **Authentication**
2. Clicca "Inizia"
3. Abilita questi provider:
   - ✅ **Email/Password**
   - ✅ **Google** (facoltativo ma consigliato)

## 3. Attiva Firestore Database

1. Nel menu laterale → **Firestore Database**
2. Clicca "Crea database"
3. Modalità: **Produzione**
4. Regione: **europe-west** (più vicina)
5. Nelle **Regole** sostituisci con:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /playlists/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 4. Ottieni credenziali

1. Vai a **Impostazioni progetto** (icona ingranaggio in alto a sinistra)
2. Scorri fino a **Le tue app**
3. Clicca sull'icona **</>** (Web)
4. Nome app: **SandTV Web**
5. NON selezionare Firebase Hosting
6. Clicca "Registra app"

## 5. Copia configurazione

Vedrai qualcosa come:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "sandtv-xxx.firebaseapp.com",
  projectId: "sandtv-xxx",
  storageBucket: "sandtv-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## 6. Incolla in `lib/firebase.ts`

Apri `lib/firebase.ts` e sostituisci le credenziali:

```typescript
export const firebaseConfig = {
  apiKey: "IL_TUO_API_KEY",  // <-- Incolla qui
  authDomain: "IL_TUO_AUTH_DOMAIN",
  projectId: "IL_TUO_PROJECT_ID",
  storageBucket: "IL_TUO_STORAGE_BUCKET",
  messagingSenderId: "IL_TUO_SENDER_ID",
  appId: "IL_TUO_APP_ID"
};
```

## 7. Test

1. Ricarica l'app
2. Clicca "Accedi" nell'header
3. Registra un account
4. La playlist verrà salvata automaticamente!

## ✅ Funzionalità attive:

- 🔐 Login con Email/Password
- 🔑 Login con Google
- 💾 Salvataggio automatico playlist
- 📺 Salvataggio fonte EPG personalizzata
- ☁️ Sincronizzazione cross-device

## 🆓 Limiti Piano Gratuito:

- ✅ 50,000 letture/giorno
- ✅ 20,000 scritture/giorno
- ✅ 1GB storage
- ✅ 10GB/mese transfer
- ✅ **Più che sufficiente per uso personale!**

## 🔒 Sicurezza:

Le credenziali Firebase nel codice frontend sono **SICURE** - Firebase le usa solo per identificare il progetto. La sicurezza vera è nelle **Regole Firestore** che abbiamo impostato (solo l'utente loggato può accedere ai propri dati).
