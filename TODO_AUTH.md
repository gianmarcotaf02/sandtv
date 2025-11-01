# 📝 TODO - Implementazione Autenticazione e EPG

## File creati:
- ✅ `lib/firebase.ts` - Configurazione Firebase
- ✅ `hooks/useAuth.ts` - Hook per autenticazione
- ✅ `components/AuthModal.tsx` - Modal login/registrazione
- ✅ `components/EpgSourceModal.tsx` - Modal per aggiungere EPG manuale
- ✅ `FIREBASE_SETUP.md` - Guida configurazione Firebase

## Prossimi passi:

1. **Configura Firebase** seguendo `FIREBASE_SETUP.md`

2. **Aggiorna App.tsx** per integrare autenticazione e EPG manuale

3. **Aggiorna Header.tsx** per mostrare:
   - Pulsante "Accedi" (se non loggato)
   - Email utente + "Esci" (se loggato)
   - Pulsante "📺 EPG" per aggiungere fonte manuale

4. **Salvataggio automatico playlist** quando utente è loggato

## Per ora:
Il player e l'EPG (se nell'M3U) funzionano. L'autenticazione è opzionale e può essere aggiunta seguendo i file creati.

Per attivare tutto, segui FIREBASE_SETUP.md e poi integra i componenti in App.tsx.
