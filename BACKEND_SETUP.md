# Backend Setup per EPG

## Opzione 1: Cloudflare Workers (Consigliato - GRATIS)

### Setup rapido:

1. **Installa Wrangler CLI:**
```bash
npm install -g wrangler
```

2. **Login a Cloudflare:**
```bash
wrangler login
```

3. **Deploy il worker:**
```bash
wrangler deploy
```

4. **Ottieni l'URL del worker** (es: `https://sandtv-proxy.tuoaccount.workers.dev`)

5. **Aggiorna App.tsx** - sostituisci questa riga:
```typescript
// Invece di:
console.log('EPG URL found:', epgUrl);

// Usa:
const workerUrl = 'https://sandtv-proxy.TUOACCOUNT.workers.dev';
const proxyUrl = `${workerUrl}?url=${encodeURIComponent(epgUrl)}`;
const epgResponse = await fetch(proxyUrl);
```

### Limiti Cloudflare Workers FREE:
- ✅ 100,000 richieste/giorno (più che sufficienti)
- ✅ Cache CDN integrata
- ✅ Velocità globale

---

## Opzione 2: Server Node.js locale

### Setup:

1. **Crea `server.js`:**
```javascript
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url');
  
  try {
    const response = await fetch(url);
    const data = await response.text();
    res.send(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(3001, () => console.log('Proxy running on port 3001'));
```

2. **Installa dipendenze:**
```bash
npm install express cors node-fetch
```

3. **Avvia:**
```bash
node server.js
```

4. **Usa in App.tsx:**
```typescript
const proxyUrl = `http://localhost:3001/proxy?url=${encodeURIComponent(epgUrl)}`;
```

---

## Opzione 3: Vercel Serverless (GRATIS)

1. **Crea `api/proxy.js`:**
```javascript
export default async function handler(req, res) {
  const { url } = req.query;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (!url) return res.status(400).send('Missing url');
  
  try {
    const response = await fetch(url);
    const data = await response.text();
    res.send(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
}
```

2. **Deploy:**
```bash
vercel deploy
```

3. **Usa l'URL Vercel** (es: `https://tuoapp.vercel.app/api/proxy?url=...`)

---

## Per ora (senza backend):

Il player funziona **senza EPG**. I canali vengono mostrati solo con nome e logo dall'M3U.

Quando configuri il backend, decomenta il codice EPG in `App.tsx`.
