# GUIDA RAPIDA - Test della funzionalità "Torna al live"

## 🚀 Quick Start (5 minuti)

### Passo 1: Build e avvio

```bash
npm run build
npm run dev
```

### Passo 2: Apri l'app

1. Vai a `http://localhost:5173`
2. Carica una playlist M3U con stream live (es. CNN, NASA TV)
3. Premi F12 per aprire la console

### Passo 3: Test base

Nel console browser, digita:

```javascript
// Mostra l'aiuto dei comandi disponibili
liveEdgeDebug.help()

// Guarda lo stato attuale
liveEdgeDebug.showLatest()
```

---

## 🎯 Test scenario per scenario

### Scenario 1: Bottone appare quando serve

**Obiettivo**: Verificare che il bottone "torna al live" appaia solo se c'è ritardo reale.

**Istruzioni**:

```
1. Riproduci un canale live (CNN, NASA TV, etc.)
2. Attendi 30 secondi (video in riproduzione)
3. Console: liveEdgeDebug.showLatest()
4. Leggi "Ritardo (s)" - dovrebbe essere < 2s (non visibile)
5. Se ritardo > 2.5s, il bottone ROSSO deve apparire nell'UI
```

**Controllo**:
- ✅ Bottone NON visibile quando ritardo < 2.5s
- ✅ Bottone ROSSO visibile quando ritardo > 2.5s
- ✅ No flickering (bottone non lampeggia)

---

### Scenario 2: Seek al live funziona

**Obiettivo**: Verificare che il bottone "torna al live" realmente sincronizzi al live.

**Istruzioni**:

```
1. Apri console (F12)
2. Avvia monitoraggio: liveEdgeDebug.startMonitoring(2000)
3. Osserva l'output per 10 secondi (es. "Ritardo: 0.5s")
4. Attendi che il ritardo salga a 3s+
5. Osserva: il bottone ROSSO dovrebbe apparire
6. CLICCA il bottone rosso "torna al live"
7. Consola mostra: "⚡ Seek to live via HLS.js: ..."
8. Il video dovrebbe sincronizzarsi rapidamente (entro 1-2 secondi)
9. Bottone scompare automaticamente
```

**Atteso**:
- ✅ Ritardo torna a < 1.5s dopo click
- ✅ Nessun freeze o stallo
- ✅ Audio continuo
- ✅ Console mostra log di seek completato

---

### Scenario 3: Test isteresi (no flickering)

**Obiettivo**: Verificare che la logica di isteresi funzioni correttamente.

**Istruzioni**:

```
1. Console: liveEdgeDebug.startMonitoring(1000)
2. Attendi che il ritardo salga a 2.8s
   → Log: "Ritardo: 2.8s"
   → Bottone APPARE ✅
3. Ritardo scende a 2.1s
   → Log: "Ritardo: 2.1s"
   → Bottone RIMANE VISIBILE (isteresi) ✅
4. Ritardo scende a 1.4s
   → Log: "Ritardo: 1.4s"
   → Bottone SCOMPARE ✅
```

**Atteso**:
- ✅ Nessun flickering between 1.5-2.5s
- ✅ Transizione smooth tra visibile/nascosto

---

### Scenario 4: Diagnostics server vs frontend

**Obiettivo**: Identificare se il ritardo è dovuto al server o al frontend.

**Istruzioni**:

```
1. Console: liveEdgeDebug.checkServerState()
2. Leggi l'output:
```

**Interpretazione**:

```
SE: Intervallo refresh > 15s O Numero segmenti > 8
   → PROBLEMA SERVER (lento o instabile)
   → Soluzione: Contattare provider IPTV

SE: Buffer medio < 2s O Ritardo spesso > 5s
   → PROBLEMA NETWORK (connessione lenta)
   → Soluzione: Usare rete migliore o ridurre qualità

SE: Ritardo medio 0.5-1s, Buffer medio 6-8s
   → TUTTO NORMALE ✅
```

---

### Scenario 5: Test stress (rete instabile)

**Obiettivo**: Verificare comportamento con rete scadente.

**Istruzioni**:

```
1. Browser DevTools → Network tab
2. Cambia throttle a "Slow 3G"
3. Avvia stream live
4. Console: liveEdgeDebug.startMonitoring(5000)
5. Osserva per 30-60 secondi
```

**Atteso**:
- ✅ Retry automatici degli errori di rete
- ✅ Buffer sale gradualmente
- ✅ Nessun crash
- ✅ Bottone continua a funzionare

**Se fallisce**:
```
// Aumenta i retry
const manager = getLiveEdgeManager({
  seekRetryAttempts: 5,
  seekRetryDelayMs: 200,
});
```

---

## 📊 Comandi console essenziali

### Diagnostics istantanee:

```javascript
// Ultimo stato
liveEdgeDebug.showLatest()

// Statistiche aggregate
liveEdgeDebug.showStatistics()

// Info server (segmenti, durata)
liveEdgeDebug.checkServerState()

// Tutta la cronologia
liveEdgeDebug.showHistory()
```

### Monitoraggio continuo:

```javascript
// Avvia monitoraggio (aggiorna ogni 5 secondi)
liveEdgeDebug.startMonitoring(5000)

// Ferma monitoraggio
liveEdgeDebug.stopMonitoring()
```

### Test automatici:

```javascript
// Testa rilevamento ritardo (simula 3s indietro)
liveEdgeDebug.testDelayDetection(3)

// Testa seek al live
liveEdgeDebug.testGoToLive()
```

### Report:

```javascript
// Esporta report completo (copiato negli appunti)
liveEdgeDebug.exportReport()
```

---

## 🔍 Interpretazione output

### showLatest() output:

```
Ritardo (s)            3.2    ← 3.2 secondi dietro il live
Tempo corrente (s)     100.5
Live edge (s)          103.7
Buffer totale (s)      8.5    ← Buono, > 8s
In riproduzione        Sì
In buffering           No     ← Non in stallo
Segmenti HLS           5      ← Playlist ragionevole
Durata segmento (s)    2.0
```

**Lettura**:
- Ritardo > 2.5s → Bottone dovrebbe essere visibile ✅
- Buffer > 5s → Streaming stabile ✅
- In buffering: No → Nessun stallo ✅

### showStatistics() output:

```
Ritardo medio (s)      1.2    ← Tipicamente 1.2s indietro
Ritardo massimo (s)    8.5
Ritardo minimo (s)     0.1
Buffer medio (s)       7.3
Frequenza dietro live  15%    ← Il 15% del tempo dietro live
```

**Valutazione**:
- Ritardo medio < 2s: Ottimo ✅
- Frequenza dietro live > 50%: Problema server ⚠️
- Buffer medio < 3s: Connessione instabile ⚠️

---

## ⚠️ Problemi comuni durante test

### Bottone non appare nemmeno se ritardo è alto

**Causa**: Video non in riproduzione

**Fix**:
```javascript
const video = document.querySelector('video');
console.log('Paused?', video.paused);  // Deve essere false
video.play();
```

### Console non mostra `liveEdgeDebug`

**Causa**: Debugging non abilitato o errore di caricamento

**Fix**:
```javascript
// Carica manualmente
window.liveEdgeDebug.help()

// Se ancora errore:
console.log(window.liveEdgeDebug)  // Deve esistere
```

### Bottone appare ma seek non funziona

**Causa**: HLS.js non a livello corretto

**Fix**:
```javascript
// Verifica HLS.js
console.log(window.Hls?.version);  // Deve essere 1.6.13

// Aggiorna se vecchio
// npm install hls.js@latest
```

### Seek causa freeze di 3-5 secondi

**Causa**: Buffer troppo piccolo

**Fix nel Player.tsx**:
```typescript
const manager = getLiveEdgeManager({
  minBufferForLive: 1.5,  // Aumenta da 0.8
  seekRetryDelayMs: 200,  // Aumenta da 100
});
```

---

## ✅ Checklist completamento test

- [ ] Build completato: `npm run build` (no errors)
- [ ] Dev server avviato: `npm run dev`
- [ ] Console debug disponibile: `liveEdgeDebug.help()`
- [ ] Test Scenario 1 ✅ (bottone appare se necessario)
- [ ] Test Scenario 2 ✅ (seek funziona)
- [ ] Test Scenario 3 ✅ (no flickering)
- [ ] Test Scenario 4 ✅ (diagnostics server)
- [ ] Test Scenario 5 ✅ (rete lenta)
- [ ] Nessun errore nella console browser
- [ ] Nessun memory leak (DevTools → Memory)

---

## 🎬 Ready for production?

Prima di deployare in produzione:

1. **Disabilitare diagnostics verbosi**:

```typescript
// In App.tsx, cambia:
useLiveEdgeDebugging(process.env.NODE_ENV === 'development');
// a:
useLiveEdgeDebugging(false);  // Disabilita in produzione
```

2. **Testare su stream reali**:
- Almeno 3 stream live diversi
- Rete: WiFi e mobile (4G)
- Browser: Chrome, Firefox, Safari

3. **Monitorare metriche**:
```javascript
// Salva statistiche ogni 5 minuti
setInterval(() => {
  const stats = liveEdgeDebug.getStatistics();
  console.log('📈 5-min stats:', stats);
  // Inviare al backend per analisi
}, 5 * 60 * 1000);
```

---

## 📞 Supporto

Se qualcosa non funziona:

1. **Esporta il report**:
```javascript
liveEdgeDebug.exportReport()
// Copia negli appunti
```

2. **Includi in bug report**:
```
- Report di liveEdgeDebug.exportReport()
- Browser + versione
- Network (WiFi/4G/etc)
- Stream URL (oscurato)
- Passi per riprodurre
```

3. **Consulta la guida completa**:
   - `LIVE_EDGE_IMPLEMENTATION.md` - Dettagli tecnici
   - `lib/liveEdgeManager.ts` - Codice source con commenti
