# ⚡ Configurazione Bassa Latenza - SandTV

## 🎯 Obiettivo
Ridurre al minimo il ritardo rispetto al live IPTV (paragonabile a VLC e altre app professionali) mantenendo stabilità e qualità.

## 📊 Parametri Chiave HLS.js

### Buffer Configuration
```javascript
backBufferLength: 10          // Buffer precedente minimo (10s)
maxBufferLength: 15            // ⚡ Buffer ridotto a 15s (vs 45s standard)
maxMaxBufferLength: 30         // ⚡ Max 30s (vs 90s standard)
maxBufferSize: 60 MB           // Dimensione buffer ottimizzata
maxBufferHole: 0.3             // Tolleranza gap ridotta
```

### Live Edge Sync
```javascript
lowLatencyMode: true                    // ⚡ Modalità bassa latenza ABILITATA
liveSyncDurationCount: 2                // ⚡ SOLO 2 segmenti dal live (molto vicino!)
liveMaxLatencyDurationCount: 6          // Max 6 segmenti prima di risync
maxLiveSyncPlaybackRate: 1.15           // Accelera fino a 1.15x per recuperare
liveSyncOnStallIncrease: 1.0            // Buffer incrementale se stalla
```

### Network & Performance
```javascript
manifestLoadingRetryDelay: 500          // ⚡ Retry veloce (500ms vs 1500ms)
fragLoadingMaxRetry: 6                  // Retry bilanciati
highBufferWatchdogPeriod: 1             // ⚡ Check buffer ogni 1 secondo
nudgeOffset: 0.1                        // Aggiustamenti frequenti
```

### Adaptive Bitrate
```javascript
abrEwmaDefaultEstimate: 1000000         // ⚡ Stima iniziale 1 Mbps (vs 500 kbps)
abrBandWidthFactor: 0.75                // Bilanciato qualità/latenza
startFragPrefetch: true                 // Pre-carica frammenti
testBandwidth: true                     // Test iniziale bandwidth
```

## 🚀 Funzione "Torna al Live" Ottimizzata

### Strategia Multi-Livello
1. **HLS liveSyncPosition** (priorità 1)
   - Buffer: 0.8s dal live edge
   - Stop/Start load per reload veloce

2. **Seekable Ranges** (fallback)
   - Buffer: 1s dal live edge
   - Reload buffer se disponibile

3. **Full Reload** (ultimo resort)
   - Ricarica completa stream

### Timings
```javascript
Buffer safety: 0.8-1s        // ⚡ Minimo per evitare blocchi
Reload delay: 50-100ms       // Veloce ma sicuro
```

## 📈 Indicatore Latenza Live

### Colori e Soglie
- 🟢 **Verde** (< 2s): LIVE - Latenza ottimale
- 🟡 **Giallo** (2-5s): Buona - Latenza accettabile  
- 🔴 **Rosso** (> 5s): Alta - Mostra "Torna al live"

### Display
- `LIVE`: < 1 secondo
- `-2.5s`: 1-10 secondi (decimi)
- `-12s`: > 10 secondi (arrotondato)

## ⚙️ Applicato a
- ✅ `Player.tsx` (player principale)
- ✅ `MiniPlayer.tsx` (mini player)
- ✅ `PlayerAdvanced.tsx` (player avanzato)

## 🔬 Confronto con Configurazione Precedente

| Parametro | Prima | Ora | Differenza |
|-----------|-------|-----|------------|
| Buffer Max | 45s | 15s | ⚡ -66% |
| Live Segments | 4 | 2 | ⚡ -50% |
| Low Latency | OFF | ON | ⚡ Attivo |
| Retry Delay | 1500ms | 500ms | ⚡ -66% |
| Buffer Check | 3s | 1s | ⚡ -66% |
| Live Edge Buffer | 3s | 0.8s | ⚡ -73% |

## 💡 Risultati Attesi

### Latenza
- **Prima**: 12-20 secondi di ritardo
- **Ora**: 2-5 secondi di ritardo
- **Ideale**: < 2 secondi (LIVE)

### Stabilità
- Possibili micro-buffering in caso di connessione lenta
- Recovery automatico con retry veloce
- Qualità video adattiva per mantenere continuità

### Trade-offs
- ✅ Latenza ultra-bassa (paragonabile a VLC)
- ✅ Reattività immediata
- ⚠️ Richiede connessione stabile
- ⚠️ Possibili brevi buffering su rete lenta

## 🎮 Utilizzo

L'indicatore di latenza è **sempre visibile** nell'overlay del player:
- Verde lampeggiante = Sei in LIVE
- Giallo/Rosso = Clicca l'indicatore stesso o il pulsante per tornare al live

## 🔧 Fine-tuning

Se riscontri troppi buffering, puoi aumentare:
- `maxBufferLength` da 15 a 20 secondi
- `liveSyncDurationCount` da 2 a 3 segmenti
- Live edge buffer da 0.8s a 1.5s

Se vuoi ancora meno latenza (rischio):
- `liveSyncDurationCount` da 2 a 1 segmento
- Live edge buffer da 0.8s a 0.5s
