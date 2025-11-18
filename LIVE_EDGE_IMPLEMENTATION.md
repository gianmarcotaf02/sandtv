# GUIDA IMPLEMENTAZIONE - "TORNA AL LIVE" OTTIMIZZATO

## 📋 Sommario delle modifiche

Questa implementazione risolve i problemi critici nella funzionalità "torna al live":

✅ **Bottone appare solo se ritardo reale** - Non più flickering continuo  
✅ **Seek preciso al live edge** - Minimizzazione latenza e buffering  
✅ **Gestione buffer ottimale** - Evita blocchi e problemi di riproduzione  
✅ **Diagnostics avanzati** - Identifica problemi server vs frontend  
✅ **Retry intelligente** - Recupero automatico da errori di seek  

---

## 🏗️ Architettura della soluzione

### File nuovi creati:

1. **`lib/liveEdgeManager.ts`** - Core logic
   - `LiveEdgeManager` class con gestione completa del live edge
   - `LiveEdgeDiagnostics` interface per tracciamento dettagliato
   - Algoritmi di rilevamento e retry

2. **`lib/liveEdgeDebug.ts`** - Testing e diagnostics
   - Console commands per debugging
   - Funzioni di test automatiche
   - Validazione setup

### File modificati:

1. **`components/Player.tsx`**
   - Integrazione `LiveEdgeManager`
   - Rimozione logica vecchia e instabile
   - Nuove state variables
   - Funzione `goToLive()` completamente riscritta

---

## 🔧 Configurazione

Nel file `Player.tsx`, il manager è configurato con:

```typescript
const liveEdgeManagerRef = useRef(getLiveEdgeManager({
  enableDiagnostics: true,           // Log dettagliati
  delayThreshold: 2.5,               // Mostra bottone se > 2.5s
  delayThresholdLow: 1.5,            // Nascondi se < 1.5s (isteresi)
  debounceMs: 500,                   // Attendi 500ms di stabilità
  minBufferForLive: 0.8,             // Buffer minimo 0.8s dal live
  seekRetryAttempts: 3,              // 3 tentativi di retry
  seekRetryDelayMs: 100,             // 100ms tra retry
}));
```

**Personalizzazione per il tuo caso d'uso:**

- **Ritardo basso (sport in diretta)**: `delayThreshold: 1.5`, `delayThresholdLow: 0.5`
- **Ritardo tollerato (film/serie)**: `delayThreshold: 5`, `delayThresholdLow: 3`
- **Streaming instabile**: `seekRetryAttempts: 5`, `seekRetryDelayMs: 200`

---

## 📊 Come funziona la rilevazione del ritardo

### Flusso di decisione:

```
1. onTimeUpdate → trigger ogni 200-300ms (dipende da HLS.js)
   ↓
2. Debounce 500ms per evitare flickering
   ↓
3. analyzeLiveState() calcola:
   - Tempo corrente vs seekable end
   - State del buffer
   - Diagnostics HLS.js
   ↓
4. shouldShowGoToLiveButton() applica isteresi:
   - SE bottone nascosto E delay > 2.5s → MOSTRA
   - SE bottone visibile E delay < 1.5s → NASCONDI
   - SE buffering → mantieni stato (evita flickering)
   ↓
5. Aggiorna UI
```

### Isteresi (hysteresis)

Evita il flickering vicino al threshold:

```
Ritardo (secondi)
      |
   3.0| ← Mostra bottone (threshold alto)
      |
   2.5|    ╱─ Zona morta (mantieni stato)
      |   ╱
   1.5| ─ Nascondi bottone (threshold basso)
      |
   0.0└─────────────────────→ Tempo
```

---

## 🎯 Come funziona il seek al live

### Fasi del `seekToLiveEdge()`:

1. **Analisi dello stato corrente**
   - Leggi `hls.liveSyncPosition` (posizione ottimale HLS.js)
   - Fallback a `video.seekable.end()` se HLS non disponibile

2. **Calcolo della posizione target**
   - Target = liveSyncPosition - minBuffer (0.8s)
   - Questo lascia un buffer minimo per evitare stalling

3. **Esecuzione seek con retry**
   ```
   Tentativo 1: Seek e ascolta evento "seeked"
   ↓
   Se timeout (3s) → Tentativo 2
   ↓
   Se timeout → Tentativo 3
   ↓
   Se tutti falliscono → Log errore, continua comunque
   ```

4. **Ricarica buffer HLS** (dopo seek riuscito)
   - `hls.stopLoad()` ferma caricamento
   - `hls.startLoad(targetPosition)` ricomincia dal nuovo punto
   - Minimizza buffering inutile

5. **Riproduci subito**
   - `video.play()` per ripresa immediata

---

## 🧪 Test e validazione

### Test 1: Verifica rilevamento ritardo

**Scenario**: Il player è indietro di 3 secondi dal live

**Istruzioni**:

```
1. Avvia streaming live
2. Apri browser console (F12)
3. Esegui:
   liveEdgeDebug.testDelayDetection(3)
4. Osserva:
   - "Bottone dovrebbe essere ✅ VISIBILE"
   - Controlla che il bottone rosso appaia nella UI
```

### Test 2: Verifica monitoraggio continuo

**Scenario**: Monitora il ritardo nel tempo

```
1. Avvia streaming
2. Console: liveEdgeDebug.startMonitoring(5000)
3. Osserva l'output ogni 5 secondi:
   12:34:56 | Ritardo: 0.5s | Buffer: 8.2s | Buffering: No
   12:35:01 | Ritardo: 2.1s | Buffer: 7.8s | Buffering: No
   12:35:06 | Ritardo: 4.2s | Buffer: 6.5s | Buffering: Yes
   ↑ Ritardo è aumentato, bottone dovrebbe apparire
   
4. Ferma con: liveEdgeDebug.stopMonitoring()
```

### Test 3: Verifica seek al live

**Scenario**: Clicca il bottone "torna al live" e verifica seek

```
1. Attendi che ritardo salga > 2.5s (bottone appare)
2. Osserva nella console:
   ✅ Log: "⚡ Seek to live via HLS.js: X.XXs"
3. Verifica che:
   - Video non freezzi
   - Audio continua
   - Ritardo torna a 0-1 secondo
   - Bottone scompare automaticamente
```

### Test 4: Diagnostics complete

**Scenario**: Esporta report dettagliato per analisi

```
1. Console: liveEdgeDebug.exportReport()
2. Copia il report (automaticamente negli appunti)
3. Report include:
   - Ritardo medio/max/min
   - Buffer medio
   - Frequenza dietro live
   - Info server playlist
   - Impostazioni configurate
```

### Test 5: Verifica isteresi

**Scenario**: Controlla che il bottone non flickeri

```
1. Attendi ritardo di 2.8s (sopra threshold 2.5)
   → Bottone appare ✅
   
2. Ritardo scende lentamente a 2.0s (sotto threshold, ma sopra 1.5)
   → Bottone rimane visibile (isteresi) ✅
   
3. Ritardo scende a 1.4s (sotto threshold basso)
   → Bottone scompare ✅
```

### Test 6: Test server vs frontend

**Scenario**: Identifica dove sta il problema

```
1. Console: liveEdgeDebug.checkServerState()
2. Output:
   Intervallo refresh playlist: 10.0s
   Durata segmento: 2.0s
   Numero segmenti: 5
   
3. Analisi:
   - Se molti segmenti → playlist grande → problema server
   - Se intervallo refresh alto → aggiornamenti lenti
   - Se durata segmento irregolare → encoding instabile
```

### Test 7: Test stress (buffering instabile)

**Scenario**: Simula condizioni di rete scadente

```
1. Browser DevTools → Network → "Slow 3G"
2. Inizia streaming
3. Console: liveEdgeDebug.startMonitoring()
4. Osserva comportamento:
   - Frequenza dietro live dovrebbe rimanere bassa
   - Retry automatici dovrebbero gestire errori
   - Buffer dovrebbe stabilizzarsi
```

---

## 📈 Interpretazione dei dati di diagnostics

### showLatest() output:

```
Ritardo (s)              | 3.2  ← Quanto è in ritardo
Tempo corrente (s)       | 100.5
Live edge (s)            | 103.7
Buffer totale (s)        | 8.5  ← Quanto c'è nel buffer
In riproduzione          | Sì   ← Se sta riproducendo
In buffering             | No   ← Se sta buffering
Segmenti HLS             | 5    ← Numero segmenti playlist
Durata segmento (s)      | 2.0  ← Durata media segmento
```

### Lettura delle statistiche:

```
Ritardo medio (s)        | 1.2  ← Ritardo tipico
Ritardo massimo (s)      | 8.5  ← Peak ritardo riscontrato
Ritardo minimo (s)       | 0.1  ← Minimo ritardo
Buffer medio (s)         | 7.3  ← Buffer tipico mantenuto
Frequenza dietro live    | 15%  ← Percentuale tempo dietro live
```

**Interpretazione**:
- **Ritardo medio < 1s**: Ottimale ✅
- **Ritardo medio 1-3s**: Buono, ma potrebbe migliorare ⚠️
- **Ritardo medio > 5s**: Problema, verificare server 🔴

---

## 🔍 Problemi comuni e soluzioni

### ❌ Bottone appare ma non fa nulla

**Causa**: Seek fallisce silenziosamente

**Soluzione**:
```typescript
// Controlla i log nella console
console.log(liveEdgeDebug.exportReport());

// Verifica HLS.js:
console.log(window.Hls?.version); // Deve essere 1.6.13+
```

### ❌ Bottone flickera continuamente

**Causa**: Debounce troppo breve o isteresi assente

**Soluzione**:
```typescript
// Aumenta debounce
const manager = getLiveEdgeManager({
  debounceMs: 1000,  // Da 500 a 1000
  delayThresholdLow: 1.0,  // Aumenta gap isteresi
});
```

### ❌ Seek causa freeze

**Causa**: Buffer troppo piccolo o retry troppi

**Soluzione**:
```typescript
const manager = getLiveEdgeManager({
  minBufferForLive: 1.5,  // Aumenta buffer minimo
  seekRetryAttempts: 1,   // Riduci retry
});
```

### ❌ Ritardo rimane alto dopo click

**Causa**: Playlist o server troppo lenti

**Soluzione**: Verifica il server playlist
```
liveEdgeDebug.checkServerState()
```

Se `Numero segmenti` è alto (> 8) o `Intervallo refresh` alto (> 15s):
- **Problema server** → Contatta provider IPTV
- **Soluzione**: Configura player con buffer maggiore

### ❌ "seekableEnd undefined"

**Causa**: HLS.js non completamente caricato

**Soluzione**: Attendi che manifest sia caricato
```typescript
hls.on(Hls.Events.MANIFEST_PARSED, () => {
  // Solo ora il live edge è disponibile
});
```

---

## 🚀 Ottimizzazioni avanzate

### Per streaming a bassissima latenza (< 2 secondi):

```typescript
const manager = getLiveEdgeManager({
  delayThreshold: 1.0,
  delayThresholdLow: 0.3,
  minBufferForLive: 0.3,
  debounceMs: 200,
});
```

### Per streaming instabile (satellite, 4G):

```typescript
const manager = getLiveEdgeManager({
  delayThreshold: 5,
  delayThresholdLow: 3,
  minBufferForLive: 2.0,
  debounceMs: 1000,
  seekRetryAttempts: 5,
  seekRetryDelayMs: 200,
});
```

### Per monitoring avanzato:

```typescript
// Salva diagnostics periodicamente nel server
setInterval(() => {
  const report = liveEdgeDebug.exportReport();
  fetch('/api/diagnostics', { method: 'POST', body: report });
}, 60000); // Ogni minuto
```

---

## 📝 Checklist implementazione

- [ ] File `lib/liveEdgeManager.ts` creato
- [ ] File `lib/liveEdgeDebug.ts` creato
- [ ] `components/Player.tsx` aggiornato
- [ ] Import aggiunti in Player.tsx
- [ ] Build completato senza errori: `npm run build`
- [ ] Dev server testato: `npm run dev`
- [ ] Bottone testa su stream live
- [ ] Monitoraggio da console funziona
- [ ] Seek al live funziona senza freeze
- [ ] Test stress con rete lenta completato

---

## 💡 HLS.js versione

L'implementazione usa **hls.js 1.6.13** (dal package.json).

**Cosa fornisce questa versione**:
- ✅ `lowLatencyMode` per bassa latenza
- ✅ `liveSyncPosition` per posizione ottimale
- ✅ Retry intelligente
- ✅ Buffer management robusto

Se la versione installata è diversa, aggiorna:
```bash
npm install hls.js@latest
```

---

## 📞 Supporto e debug

Per diagnostics completi, usa:

```typescript
// Dump tutto in console
liveEdgeDebug.help()

// Oppure nel browser:
window.liveEdgeDebug.showStatistics()
window.liveEdgeDebug.checkServerState()
```

I log mostrano il percorso decisionale interno:
```
📊 Live Edge Diagnostics: {
  delay: "3.5s",           ← Ritardo attuale
  currentTime: "100.2s",
  seekableEnd: "103.7s",
  buffer: "8.2s",
  isBuffering: false,
  hlsSync: "102.9s",       ← Posizione ottimale HLS
}
```

---

## 🎬 Prossimi step

1. **Implementa nel app**: Integrate le modifiche al Player.tsx
2. **Testa su stream reale**: Usa i comandi console per validare
3. **Raccogli metriche**: Monitora su diversi stream
4. **Ottimizza threshold**: Regola per il tuo caso d'uso
5. **Deploy**: Rilascia in produzione
