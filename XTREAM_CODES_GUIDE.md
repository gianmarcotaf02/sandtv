# 📺 Supporto Xtream Codes - Documentazione

## Panoramica

SandTV ora supporta sia playlist M3U che **Xtream Codes API** - una delle piattaforme IPTV più diffuse. Puoi usare entrambi i metodi in parallelo, passando facilmente da uno all'altro.

---

## Architettura

```
┌─────────────────────────────────────────────┐
│           Landing Screen / App              │
├─────────────────────────────────────────────┤
│  [M3U Parser] ←→ [Xtream Parser] ←→ [Store] │
├─────────────────────────────────────────────┤
│  Live | VOD | Series | EPG | Favorites      │
└─────────────────────────────────────────────┘
```

### Componenti Xtream

| File | Scopo |
|------|-------|
| `lib/xtreamApi.ts` | Client API con metodi per live, VOD, series, EPG |
| `lib/xtreamParser.ts` | Converte dati Xtream al formato app |
| `hooks/useXtreamParser.ts` | Hook React per parsing e gestione |
| `components/XtreamAuthModal.tsx` | UI login credenziali Xtream |
| `store/useStore.ts` | Extended con `xtreamPlaylist` e `isXtreamActive` |

---

## Uso Utente

### 1. Aggiungere Account Xtream

**Nell'app:**
1. Vai a "Aggiungi Sorgente" → "Xtream Codes"
2. Inserisci:
   - **URL Server**: `http://xtream.example.com:8000`
   - **Username**: `username`
   - **Password**: `password`
3. Clicca "Connetti"
4. L'app caricherà automaticamente:
   - Canali live
   - VOD (Film)
   - Serie TV
   - EPG (programmi)

### 2. Navigazione

Dopo il login Xtream:
- **Live**: Canali in diretta (con EPG se disponibile)
- **Film/VOD**: Contenuti video on-demand
- **Serie**: Serie TV con episodi
- **Replay**: Catchup TV (se disponibile)
- **Preferiti**: Gestisci preferiti globalmente (M3U + Xtream)

### 3. Cambio tra M3U e Xtream

```
Landing Screen:
┌─────────────────────────┐
│ [M3U] [Xtream] [Cloud]  │ ← Pulsanti di switch
└─────────────────────────┘
```

Lo store mantiene entrambi gli elenchi. Switch istantaneo senza ricarica.

---

## API Xtream Implementate

### Live Channels
```typescript
// Ottieni canali live
const client = new XtreamApiClient(credentials);
const channels = await client.getLiveChannels(categoryId?);
// Ritorna: XtreamLiveChannel[]
```

### VOD (Film)
```typescript
// Ottieni film VOD
const vods = await client.getVOD(categoryId?);
// Ritorna: XtreamVOD[]

// Info film specifico
const info = await client.getVODInfo(vodId);
```

### Serie TV
```typescript
// Ottieni serie
const series = await client.getSeries(categoryId?);
// Ritorna: XtreamSeries[]

// Episodi di una serie
const episodes = await client.getSeriesEpisodes(seriesId);
// Ritorna: XtreamSeriesEpisode[]
```

### EPG (Programmi)
```typescript
// EPG per singolo canale
const programs = await client.getLiveEPG(channelId);

// EPG per range di tempo (es. 24h)
const now = Math.floor(Date.now() / 1000);
const epg = await client.getLiveEPGRange(now, now + 86400);
```

### Categorie
```typescript
const liveCategories = await client.getLiveCategories();
const vodCategories = await client.getVODCategories();
const seriesCategories = await client.getSeriesCategories();
```

---

## Integrazione nel Codice

### 1. Autenticazione

```typescript
// useXtreamParser.ts
const { parseXtreamPlaylist, testXtreamConnection } = useXtreamParser();

// Test credenziali
const isValid = await testXtreamConnection({
  server: 'http://xtream.example.com:8000',
  username: 'user',
  password: 'pass'
});

// Parse completo
const data = await parseXtreamPlaylist(credentials);
// {
//   channels: Channel[],           // Live
//   vodChannels: Channel[],        // VOD
//   seriesChannels: Channel[],     // Serie
//   epgData: Record<string, Program[]>,
//   playlistName: string
// }
```

### 2. Salvataggio in Store

```typescript
// App.tsx
const { setXtreamPlaylist, setIsXtreamActive } = useStore();

const handleXtreamSuccess = (credentials, data) => {
  setXtreamPlaylist({
    liveChannels: data.channels,
    vodChannels: data.vodChannels,
    seriesChannels: data.seriesChannels,
    epgData: data.epgData,
    playlistName: data.playlistName,
    credentials,
    lastSynced: Date.now()
  });
  setIsXtreamActive(true);
};
```

### 3. Rendering Canali

```typescript
// PlayerUI.tsx
const xtreamActive = useStore(state => state.isXtreamActive);
const xtreamData = useStore(state => state.xtreamPlaylist);
const m3uData = useStore(state => state.playlist);

const channels = xtreamActive ? xtreamData.liveChannels : m3uData.channels;
```

---

## Content Detection

I canali Xtream vengono auto-classificati:

```
Live Channel (tv_archive=1) → 🔴 Live (confidence: 0.95)
VOD (categoria: Film)       → 📺 On-demand (confidence: 1.0)
Serie TV                    → 📺 On-demand (confidence: 1.0)
Catchup (tv_archive=1+7d)   → ⏱️ Replay (confidence: 0.90)
```

---

## URL Stream

### Live
```
http://server:8000/live/username/password/streamId.m3u8
```

### VOD
```
http://server:8000/vod/username/password/vodId.m3u8
```

### Serie (Episodio)
```
http://server:8000/series/username/password/seriesId/seasonId/episodeId.m3u8
```

---

## Caching & Performance

### Cache Implementato

| Risorsa | TTL |
|---------|-----|
| Server info | 1h |
| Categorie | 1h |
| Canali live | 1h |
| VOD | 1h |
| Serie | 1h |
| EPG | 1h |

### Clearing Cache

```typescript
const client = createXtreamClient(credentials);

// Pulisci cache scaduto
client.clearExpiredCache();

// Svuota tutto
client.clearCache();
```

---

## Gestione Errori

### Errori di Connessione

```typescript
const result = await testXtreamConnection(credentials);
if (!result.success) {
  // result.error contiene dettagli
  // Es: "HTTP 401", "Connection timeout", etc
}
```

### Errori di Parsing

```typescript
try {
  const data = await parseXtreamPlaylist(credentials);
} catch (error) {
  // Error handling
  toast.error(`Errore Xtream: ${error.message}`);
}
```

---

## Metadata Xtream Salvati

Ogni canale Xtream mantiene metadata aggiuntivi:

```typescript
// Su ogni Channel quando xtreamType = 'live'
channel.xtreamStreamId    // ID stream Xtream
channel.xtreamType        // 'live' | 'vod' | 'series'
channel.xtreamCatchup     // boolean: ha replay?
channel.xtreamCatchupDays // numero giorni archivio

// Su VOD
channel.xtreamYear
channel.xtreamGenre
channel.xtreamRating      // 0-10
channel.xtreamDuration
channel.xtreamDescription
channel.xtreamCast

// Su Serie
channel.xtreamSeriesId
channel.xtreamYear
channel.xtreamGenre
```

---

## Sincronizzazione

### Auto-sync Suggerito

```typescript
// Sincronizza ogni 6 ore
useEffect(() => {
  const interval = setInterval(async () => {
    if (xtreamActive && credentials) {
      const data = await parseXtreamPlaylist(credentials);
      setXtreamPlaylist({
        ...data,
        credentials,
        lastSynced: Date.now()
      });
      toast.success('Playlist Xtream aggiornata');
    }
  }, 6 * 60 * 60 * 1000);
  
  return () => clearInterval(interval);
}, [xtreamActive, credentials]);
```

---

## Vantaggi vs M3U

| Feature | M3U | Xtream |
|---------|-----|--------|
| Live channels | ✅ | ✅ |
| VOD/Film | ❌ | ✅ |
| Serie TV | ❌ | ✅ |
| EPG | ✅ | ✅ |
| Catchup | 🟠 (nel M3U) | ✅ (nativa) |
| Categorie | ✅ (limitate) | ✅ (ricche) |
| Sync Dinamica | ❌ (static) | ✅ (live) |
| Metadata Ricchi | ❌ | ✅ (anno, genere, rating) |

---

## Limitazioni Conosciute

1. **Rate Limiting**: Xtream implementa rate limiting. Usa cache per ridurre richieste.
2. **Timeout**: EPG range con range >7 giorni potrebbe timeout. Limita a 24-48h.
3. **Credenziali**: Salvate solo in localStorage (non cifratu). Per produzione, usa secure storage.
4. **Username/Password nel URL**: I veri stream URL contengono credenziali. Non sharare URL pubblicamente.

---

## Troubleshooting

### "Credenziali non valide"
- Verifica URL server (con/senza porta)
- Controlla username/password
- Testa da browser diretto: `http://server:8000/player_api.php?username=X&password=Y&action=get_live_categories`

### "Timeout"
- Xtream server potrebbe essere lento
- Aumenta timeout in `xtreamApi.ts` (se necessario)
- Riduci range EPG

### EPG non appare
- Non tutti gli server Xtream hanno EPG attivato
- Verifica in Xtream panel se EPG è disponibile

---

## Roadmap Xtream

- [ ] Sincronizzazione automatica in background
- [ ] Crittografia credenziali Xtream in storage
- [ ] Watchlist/Bookmark VOD
- [ ] Continua episodio da dove l'hai lasciato
- [ ] Download VOD offline
- [ ] Sottotitoli da Xtream
- [ ] Rating/Review VOD
- [ ] Raccomandazioni basate su genere

---

## Esempio Completo

```typescript
// App.tsx
import XtreamAuthModal from './components/XtreamAuthModal';
import { useXtreamParser } from './hooks/useXtreamParser';
import { useStore } from './store/useStore';

function App() {
  const [isXtreamModalOpen, setIsXtreamModalOpen] = useState(false);
  const { setXtreamPlaylist, setIsXtreamActive } = useStore();

  const handleXtreamSuccess = (credentials, data) => {
    setXtreamPlaylist({
      liveChannels: data.channels,
      vodChannels: data.vodChannels,
      seriesChannels: data.seriesChannels,
      epgData: data.epgData,
      playlistName: data.playlistName,
      credentials,
      lastSynced: Date.now()
    });
    setIsXtreamActive(true);
    toast.success(`${data.playlistName} caricata!`);
  };

  return (
    <>
      <button onClick={() => setIsXtreamModalOpen(true)}>
        Aggiungi Xtream
      </button>
      
      <XtreamAuthModal
        isOpen={isXtreamModalOpen}
        onClose={() => setIsXtreamModalOpen(false)}
        onSuccess={handleXtreamSuccess}
      />
    </>
  );
}
```

---

**Status**: ✅ IMPLEMENTATO E TESTATO

Domande o problemi? Contatta il supporto! 🎯
