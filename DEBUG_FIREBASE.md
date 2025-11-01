# 🔍 Debug Firebase - Playlist Non Caricata

## Passi per Verificare:

### 1. Apri Console Browser (F12)
- Premi F12 nel browser
- Vai alla tab "Console"
- Ricarica la pagina

### 2. Controlla i Log
Dovresti vedere questi messaggi quando:

#### Al Login:
```
Load playlist effect triggered
User: [tuo oggetto utente]
Current playlist.m3uUrl: undefined
Attempting to load saved playlist for user: [tua email]
Loading playlist for user: [user-id]
```

#### Se Playlist Salvata Esiste:
```
Playlist loaded: {m3uUrl: "...", epgUrl: "...", updatedAt: "..."}
Fetching playlist from URL: [url]
```

#### Se NON Esiste:
```
No saved playlist found for user
```

#### Quando Carichi una Playlist:
```
Attempting to save playlist to Firebase...
User: [tua email]
M3U URL to save: [url della playlist]
Saving playlist for user: [user-id]
M3U URL: [url]
EPG URL: [url o null]
Playlist saved successfully!
```

### 3. Verifica Firebase Console

1. Vai su https://console.firebase.google.com/
2. Seleziona il progetto "sandtv-3d909"
3. Menu laterale → **Firestore Database**
4. Dovresti vedere:
   - Collection: `playlists`
   - Documenti con ID = User ID
   - Campi: `m3uUrl`, `epgUrl`, `updatedAt`

### 4. Problemi Comuni

#### Problema: "Firestore not initialized"
**Soluzione**: Firebase non si è caricato correttamente
- Controlla la connessione internet
- Verifica che gli script Firebase siano caricati (guarda Network tab)

#### Problema: "User not logged in" quando salvo
**Soluzione**: Il salvataggio avviene solo se sei loggato
- Fai login prima di caricare una playlist
- Oppure carica la playlist, poi fai login

#### Problema: Playlist non si carica al login
**Possibili cause**:
1. La playlist non è mai stata salvata (carica una playlist da loggato)
2. L'URL salvato non è più valido
3. CORS policy blocca il fetch dell'URL

#### Problema: "Permission denied" in Firestore
**Soluzione**: Controlla le regole Firestore
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /playlists/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 5. Test Manuale

**Scenario 1 - Primo Login**:
1. Fai login
2. Carica una playlist (da URL, file, o demo)
3. Controlla console: dovrebbe dire "Playlist salvata nel tuo account!"
4. Controlla Firebase Console: dovrebbe esserci il documento

**Scenario 2 - Login Successivo**:
1. Fai login (con playlist già salvata)
2. Attendi 1-2 secondi
3. La playlist dovrebbe caricarsi automaticamente
4. Controlla console: dovrebbe dire "Playlist loaded: ..."

**Scenario 3 - Carica Playlist da Loggato**:
1. Sei già loggato
2. Vai alla landing (pulsante "Nuova Playlist")
3. Carica una playlist
4. Dovrebbe salvare automaticamente e mostrare toast

### 6. Soluzione Temporanea

Se non funziona, prova:
1. Logout
2. Login
3. Carica playlist (assicurati di vedere "Playlist salvata nel tuo account!")
4. Logout
5. Login di nuovo
6. Dovrebbe caricare automaticamente

### 7. Controlla Network Tab

1. F12 → Network
2. Carica playlist
3. Cerca chiamate a Firebase:
   - `firestore.googleapis.com`
   - Dovrebbe essere 200 OK

## Debug Avanzato

### Controlla Firebase nel Browser Console
```javascript
// Verifica se Firebase è caricato
console.log(typeof firebase);  // dovrebbe essere "object"

// Verifica utente corrente
firebase.auth().currentUser

// Verifica Firestore
firebase.firestore()
```

### Test Manuale Firestore
```javascript
// Nel console browser, dopo login
const db = firebase.firestore();
db.collection('playlists').doc(firebase.auth().currentUser.uid).get()
  .then(doc => console.log('Playlist data:', doc.data()))
  .catch(err => console.error('Error:', err));
```
