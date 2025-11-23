# 🔧 Xtream Codes - Troubleshooting

## Problemi Comuni e Soluzioni

### ❌ Errore 502 Bad Gateway

**Causa**: Il proxy Netlify non è disponibile (stai testando in locale senza `netlify dev`)

**Soluzione**:
1. **In locale con Netlify Dev**:
   ```bash
   npm install -g netlify-cli
   netlify dev
   ```
   L'app sarà disponibile su `http://localhost:8888`

2. **Deploy su Netlify**:
   ```bash
   git add .
   git commit -m "fix xtream"
   git push
   ```
   Testa su `https://tuosito.netlify.app`

3. **Fallback automatico**: Con le modifiche appena fatte, l'app proverà automaticamente la chiamata diretta se il proxy non è disponibile (potrebbe avere problemi CORS)

---

### 🔒 CORS Error (quando usa chiamata diretta)

**Causa**: Il server Xtream non permette richieste dal browser

**Soluzione**: Devi usare il proxy Netlify (vedi sopra)

---

### 🔑 Credenziali Non Valide

**Sintomi**: 
- Errore "Credenziali non valide"
- HTTP 401/403

**Verifica**:
1. ✅ URL server corretto: `http://server.com:8000` (con http/https e porta)
2. ✅ Username corretto (senza spazi)
3. ✅ Password corretta (senza spazi)
4. ✅ Account attivo (non scaduto)

**Test manuale**:
```bash
# Prova questo URL nel browser (sostituisci i valori):
http://TUO_SERVER:8000/player_api.php?username=TUO_USER&password=TUA_PASS&action=get_live_categories
```

Se restituisce JSON = credenziali OK
Se restituisce errore = credenziali sbagliate

---

### 🌐 Server Non Raggiungibile

**Sintomi**:
- Timeout
- Network error

**Verifica**:
1. Server online?
2. Firewall/VPN attivo?
3. URL corretto (inclusa porta)?

**Test ping**:
```bash
# Windows
ping SERVER_DOMINIO

# Oppure prova nel browser:
http://TUO_SERVER:8000
```

---

### 📊 Playlist Vuota

**Sintomi**: Connessione OK ma 0 canali

**Cause possibili**:
1. Account senza contenuti
2. Server in manutenzione
3. Categorie vuote

**Debug**:
Apri console browser (F12) e cerca:
```
✅ Connection successful
📄 Loaded X categories
📺 Loaded Y channels
```

---

## 🧪 Test Completo

### 1. Test Proxy Netlify
```bash
# Avvia in locale con Netlify
netlify dev

# Vai su http://localhost:8888
# Apri console (F12)
# Inserisci credenziali Xtream
# Guarda i log:
```

Dovresti vedere:
```
🔄 Trying proxy: /.netlify/functions/xtream-proxy...
✅ Proxy response: 200
✅ Connection successful
```

### 2. Test Chiamata Diretta
Se il proxy fallisce, vedrai:
```
⚠️ Proxy unavailable (status 502), trying direct...
🔄 Trying direct: http://server.com:8000/player_api.php...
```

### 3. Verifica Dati
Dopo connessione, controlla store:
```javascript
// Console browser
console.log(useStore.getState().channels);
console.log(useStore.getState().xtreamPlaylist);
```

---

## 📝 Logs Utili

### Nel Browser (Console F12)
```
🔐 Testing connection with credentials: {...}
🔄 Trying proxy: ...
✅ Proxy response: 200
📄 Response body (first 300 chars): [...]
✅ Connection successful
```

### Nel Proxy Netlify
Se usi `netlify dev`, vedrai:
```
📥 Proxy request: { server: '...', action: 'get_live_categories' }
🔍 Decoded server: http://...
🔄 Final URL: http://server:8000/player_api.php?...
✅ Response status: 200
```

---

## 🛠️ Comandi Utili

### Sviluppo Locale
```bash
# Con proxy Netlify (consigliato)
netlify dev

# O normale (senza proxy, potrebbe avere errori CORS)
npm run dev
```

### Deploy Produzione
```bash
# Commit e push
git add .
git commit -m "update xtream"
git push

# Netlify deploierà automaticamente
```

### Test Credenziali Manuale
```bash
# Windows PowerShell
$url = "http://TUO_SERVER:8000/player_api.php?username=USER&password=PASS&action=get_live_categories"
Invoke-WebRequest -Uri $url

# O semplicemente apri l'URL nel browser
```

---

## ✅ Checklist Pre-Test

Prima di testare Xtream:

- [ ] Ho credenziali valide (server/user/pass)
- [ ] Ho verificato che il server risponde (test manuale URL)
- [ ] Sto usando `netlify dev` o ho deployato su Netlify
- [ ] Ho aperto la console browser (F12) per vedere i log
- [ ] URL server include `http://` o `https://`
- [ ] URL server include la porta (es: `:8000`)
- [ ] Non ci sono spazi in username/password

---

## 🚀 Esempio Credenziali Test

**Formato corretto**:
```
Server: http://iptv.example.com:8000
Username: testuser123
Password: testpass456
```

**Formato SBAGLIATO**:
```
Server: iptv.example.com (manca http://)
Server: http://iptv.example.com (manca porta)
Username:  testuser123  (spazi)
```

---

## 📞 Debug Avanzato

### Abilita log dettagliati
Già attivi nel codice! Guarda console browser.

### Test API manuale
```javascript
// Console browser
const client = createXtreamClient({
  server: 'http://...',
  username: '...',
  password: '...'
});

// Test connessione
await client.testConnection();

// Carica categorie
await client.getLiveCategories();
```

---

## 🎯 Risoluzione Rapida

| Problema | Soluzione |
|----------|-----------|
| 502 Bad Gateway | Usa `netlify dev` o deploya |
| CORS Error | Usa il proxy Netlify |
| Credenziali invalide | Verifica URL completo con porta |
| Timeout | Controlla firewall/VPN |
| 0 canali | Verifica account abbia contenuti |
| Playlist non carica | Apri console F12 e leggi errori |
