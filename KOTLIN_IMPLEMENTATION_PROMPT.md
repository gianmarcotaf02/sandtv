# SandTV - Prompt Implementazione App IPTV in Kotlin

Ti è stato assegnato il compito di replicare un'applicazione IPTV professionale chiamata **SandTV** da React/TypeScript a **Kotlin** per Android. Si tratta di un player IPTV completo che gestisce playlist M3U, EPG (Electronic Program Guide), streaming live e funzionalità di riproduzione avanzate.

## PANORAMICA DEL PROGETTO

**SandTV** è un'applicazione IPTV sofisticata con le seguenti capacità principali:
- Analizzare playlist M3U (da multiple sorgenti)
- Visualizzare EPG (Electronic Program Guide) da formato XMLTV
- Riprodurre stream live HLS/DASH con selezione della qualità
- Riconoscimento automatico del tipo di contenuto (live vs on-demand)
- Rilevamento avanzato del bordo live con algoritmo di isteresi
- Autenticazione utente con Firebase
- Cache del database locale (equivalente di Dexie: Room/SQLite)
- Gestione dei preferiti
- Gruppi di canali personalizzati
- Cronologia visualizzazione
- Interfaccia professionale con tema scuro

---

## STACK TECNOLOGICO

### Implementazione Attuale (React/TypeScript)
- **Frontend**: React 19.2.0, TypeScript, Tailwind CSS
- **Streaming**: HLS.js 1.6.13
- **Gestione dello Stato**: Zustand
- **Database**: IndexedDB (via Dexie)
- **Autenticazione**: Firebase
- **Build**: Vite
- **Web Workers**: Per parsing M3U/XMLTV

### Implementazione Target (Kotlin/Android)
Utilizza architettura Android moderna:
- **Linguaggio**: Kotlin 1.9+
- **Framework UI**: Jetpack Compose (UI dichiarativa moderna)
- **Streaming**: ExoPlayer 2.19+ (supporto HLS/DASH)
- **Gestione dello Stato**: ViewModel + Flow/StateFlow (architettura MVVM)
- **Database**: Room + SQLite
- **Autenticazione**: Firebase Auth (Android SDK)
- **Networking**: OkHttp + Retrofit per richieste HTTP
- **Async**: Coroutines + Flow
- **Caricamento Immagini**: Coil o Glide
- **Build**: Gradle con Kotlin DSL
- **Threading**: Coroutines (nessuna gestione manuale dei thread)

---

## MODELLI E TIPI DI DATI

### Canale
```kotlin
data class Channel(
    val id: String,                    // Identificatore unico
    val name: String,                  // Nome visualizzato
    val url: String,                   // URL dello stream
    val logo: String? = null,          // URL del logo
    val group: String,                 // Nome categoria/gruppo
    val tvg: Tvg,                      // Metadati TVG
    val contentType: ContentType? = ContentType.UNKNOWN,  // live/on-demand/vod/catchup
    val contentTypeConfidence: Float? = null             // 0.0-1.0
)

data class Tvg(
    val id: String? = null,            // ID TVG
    val name: String? = null,          // Nome TVG
    val logo: String? = null           // URL logo TVG
)

enum class ContentType {
    LIVE, ON_DEMAND, VOD, CATCHUP, UNKNOWN
}
```

### Programma (EPG)
```kotlin
data class Program(
    val channel: String,               // ID del canale
    val title: String,                 // Titolo del programma
    val description: String? = null,   // Descrizione programma
    val start: LocalDateTime,          // Orario inizio
    val stop: LocalDateTime,           // Orario fine
    val icon: String? = null,          // URL icona programma
    val category: String? = null,      // Categoria (news, sport, ecc)
    val episodeNum: String? = null     // Numero episodio (S01E01)
)

typealias EpgData = Map<String, List<Program>>  // Mappa da ID canale a programmi
```

### Playlist e Metadati
```kotlin
data class Playlist(
    val id: String,
    val name: String,
    val url: String,
    val m3uContent: String? = null,    // Contenuto M3U in cache
    val channels: List<Channel>,
    val epgUrl: String? = null,        // URL EPG/XMLTV
    val epgData: EpgData? = null,      // Dati EPG in cache
    val lastUpdated: LocalDateTime,
    val isFavorite: Boolean = false
)

data class Group(
    val id: String,
    val name: String,
    val channels: List<String>         // ID dei canali
)
```

### Utente e Preferenze
```kotlin
data class UserData(
    val userId: String,
    val favorites: List<String>,           // ID canali preferiti
    val customGroups: List<Group>,
    val watchHistory: List<WatchHistoryItem>,
    val settings: UserSettings,
    val lastUpdated: LocalDateTime
)

data class WatchHistoryItem(
    val channelId: String,
    val channelName: String,
    val watchedAt: LocalDateTime,
    val duration: Long                  // millisecondi guardati
)

data class UserSettings(
    val theme: AppTheme = AppTheme.DARK,
    val defaultQuality: StreamQuality = StreamQuality.AUTO,
    val enablePictureInPicture: Boolean = true,
    val autoPlayNextEpisode: Boolean = false,
    val language: String = "it",
    val bufferDuration: Long = 30000,   // millisecondi
    val maxBufferSize: Long = 60000     // millisecondi
)

enum class AppTheme { LIGHT, DARK, SYSTEM }
enum class StreamQuality { AUTO, HIGH_1080P, HIGH_720P, MEDIUM_480P, LOW_360P }
```

---

## FUNZIONALITÀ PRINCIPALI

### 1. PARSING PLAYLIST M3U
**File**: `workers/M3uParser.kt`
- Analizzare formato M3U con righe #EXTINF
- Estrarre attributi: tvg-id, tvg-name, tvg-logo, group-title, url-tvg
- Gestire caratteri speciali e encoding
- Restituire oggetti Channel strutturati
- **Performance**: Analizzare 10.000+ canali < 2 secondi (usare coroutines)
- **Threading**: Eseguire su Dispatchers.Default (background)

**Esempio di parsing**:
```
#EXTM3U url-tvg="http://example.com/epg.xml"
#EXTINF:-1 tvg-id="rai1" tvg-name="Rai 1" tvg-logo="..." group-title="TV"
http://example.com/rai1.m3u8
```

### 2. PARSING EPG XMLTV
**File**: `workers/XmltvParser.kt`
- Analizzare formato XMLTV con elementi <programme>
- Estrarre: canale, titolo, descrizione, inizio, fine, icona, categoria
- Gestire correttamente i fusi orari (convertire in locale)
- Cache dati EPG localmente (finestra di 7 giorni)
- **Performance**: Analizzare efficientemente file EPG grandi
- **Threading**: Eseguire su Dispatchers.Default

**Caching del database**: Archiviare in database Room, invalidare dopo 7 giorni

### 3. AUTO-RICONOSCIMENTO: Live vs On-demand
**File**: `contentdetection/ContentDetector.kt`

Analizzare 5 sorgenti di dati in ordine di priorità:
1. **Presenza EPG** (80% confidenza) → Se EPG URL esiste, probabilmente LIVE
2. **Group Title** (85-90%) → "TV"/"Television" = LIVE, "Film"/"Serie" = ON_DEMAND
3. **TVG ID** (75-80%) → Riconoscimento provider (rai, mediaset, sky = LIVE; netflix, amazon = ON_DEMAND)
4. **Nome Canale** (70-75%) → Pattern matching ("film", "live", "episodio", "+1h")
5. **URL dello Stream** (60-65%) → Riconoscimento protocollo (HLS/DASH = LIVE, MP4/MKV = ON_DEMAND)

**Ritorno**: `ContentDetectionResult(type: ContentType, confidence: Float, reasons: List<String>)`

**Pattern regex**:
- Live: `/\blive\b/`, `/\bchanale\b/`, `/\bTV\b/`, `/hls|mpd/`
- On-demand: `/\bfilm\b/`, `/\bserie\b/`, `/\.mp4|\.mkv/`
- Catchup: `/\breplay\b/`, `/\bcatchup\b/`, `/\+\d+h/`

### 4. STREAMING HLS/DASH CON ExoPlayer
**File**: `player/StreamingManager.kt` & `player/PlayerController.kt`

**Funzionalità**:
- Riprodurre stream HLS (HTTP Live Streaming) e DASH
- Selettore qualità (Auto, 1080p, 720p, 480p, 360p)
- Bitrate adattativo (ABR)
- Monitoraggio della larghezza di banda
- Recupero errori con logica di retry (max 3 tentativi)
- Visualizzazione stato buffering
- Controlli di riproduzione (play/pause, seeking, velocità)

**Configurazione**:
```kotlin
val trackSelector = DefaultTrackSelector(context)
val renderersFactory = DefaultRenderersFactory(context)
val player = SimpleExoPlayer.Builder(context)
    .setTrackSelector(trackSelector)
    .setRenderersFactory(renderersFactory)
    .build()

player.setMediaItem(MediaItem.Builder()
    .setUri(streamUrl)
    .build())
```

### 5. RILEVAMENTO BORDO LIVE CON ISTERESI
**File**: `player/LiveEdgeManager.kt`

**Algoritmo**:
- Rilevare ritardo: `delay = seekableEnd - currentPosition`
- Mostrare pulsante "Vai al Live" quando ritardo > 2.5 secondi
- Nascondere pulsante quando ritardo < 1.5 secondi
- **Gap di isteresi (1.5-2.5s)**: Previene sfarfallio
- Aggiornare rilevamento ogni 500ms
- Cercare il live con retry (max 3 tentativi, 100ms ritardo tra tentativi)

**Proprietà**:
```kotlin
data class LiveEdgeConfig(
    val delayThreshold: Float = 2.5f,          // Soglia mostra pulsante
    val delayThresholdLow: Float = 1.5f,       // Soglia nascondi pulsante
    val minBufferForLive: Float = 0.8f,        // Rapporto buffer minimo
    val seekRetryAttempts: Int = 3,
    val seekRetryDelay: Long = 100,
    val updateInterval: Long = 500              // Millisecondi
)

data class LiveEdgeState(
    val currentDelay: Float,
    val shouldShowGoToLiveButton: Boolean,
    val bufferHealth: BufferHealth,
    val seekableStart: Long,
    val seekableEnd: Long,
    val currentPosition: Long
)

enum class BufferHealth { HEALTHY, ADEQUATE, CRITICAL, UNKNOWN }
```

### 6. AUTENTICAZIONE UTENTE (Firebase)
**File**: `auth/FirebaseAuthManager.kt`

**Funzionalità**:
- Autenticazione email/password
- Opzione login anonimo
- Persistenza sessione
- Gestione profilo utente
- Logout

**Integrazione**:
```kotlin
Firebase.auth.signInWithEmailAndPassword(email, password)
Firebase.auth.currentUser?.uid
Firebase.auth.signOut()
```

### 7. DATABASE LOCALE (Room + SQLite)
**File**: `database/AppDatabase.kt`

**Tabelle**:
```kotlin
@Entity(tableName = "channels")
data class ChannelEntity(
    @PrimaryKey val id: String,
    val name: String,
    val url: String,
    val logo: String?,
    val group: String,
    val tvgId: String?,
    val tvgName: String?,
    val contentType: String?,
    val contentTypeConfidence: Float?
)

@Entity(tableName = "programs")
data class ProgramEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val channel: String,
    val title: String,
    val description: String?,
    val start: Long,  // Timestamp
    val stop: Long,
    val icon: String?,
    val category: String?,
    val episodeNum: String?
)

@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey val id: String,
    val name: String,
    val url: String,
    val m3uContent: String?,
    val epgUrl: String?,
    val lastUpdated: Long,
    val isFavorite: Boolean
)

@Entity(tableName = "watch_history")
data class WatchHistoryEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val channelId: String,
    val channelName: String,
    val watchedAt: Long,
    val duration: Long
)

@Entity(tableName = "favorites")
data class FavoriteEntity(
    @PrimaryKey val channelId: String
)

@Entity(tableName = "custom_groups")
data class CustomGroupEntity(
    @PrimaryKey val id: String,
    val name: String,
    val channelIds: String  // Array JSON archiviato come stringa
)
```

**Query** (usando DAO):
- Ottenere tutti i canali
- Ottenere canali per gruppo
- Ottenere canali preferiti
- Ottenere cronologia visualizzazione (ultimi 100)
- Salvare/eliminare playlist
- Cercare canali per nome
- Aggiornare dati EPG
- Pulire dati scaduti (>7 giorni)

### 8. GESTIONE DELLO STATO (ViewModel + Flow)
**File**: Directory `viewmodels/`

**ViewModel Principali**:
- `PlaylistViewModel` - Gestire playlist, parsing, aggiornamenti
- `PlayerViewModel` - Stato riproduzione, qualità, posizione
- `ChannelViewModel` - Lista canali, filtri, ordinamento
- `EpgViewModel` - Dati EPG, programma corrente
- `UserViewModel` - Dati utente, autenticazione, preferenze
- `UIViewModel` - Tema, modalità visualizzazione, stato UI

**Pattern** (esempio):
```kotlin
class PlaylistViewModel : ViewModel() {
    private val _playlists = MutableStateFlow<List<Playlist>>(emptyList())
    val playlists: StateFlow<List<Playlist>> = _playlists.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    fun loadPlaylist(url: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val m3uContent = fetchM3uFromUrl(url)
                val channels = M3uParser.parse(m3uContent)
                _playlists.value = _playlists.value + 
                    Playlist(name = "Custom", channels = channels)
            } catch (e: Exception) {
                // Gestire errore
            } finally {
                _isLoading.value = false
            }
        }
    }
}
```

### 9. COMPONENTI UI (Jetpack Compose)
**File**: Directory `ui/screens/` e `ui/components/`

**Schermate Principali**:
1. **LandingScreen** - Importazione playlist, avvio rapido
2. **PlayerScreen** - Player principale con controlli
3. **ChannelListScreen** - Vista lista canali (virtualizzata)
4. **GridViewScreen** - Vista griglia canali
5. **EpgScreen** - Guida EPG, programmi correnti
6. **SettingsScreen** - Impostazioni utente, preferenze
7. **FavoritesScreen** - Canali preferiti
8. **AuthScreen** - Login/Registrazione

**Componenti Chiave**:
- `ChannelItem` - Singolo canale in lista
- `ChannelCard` - Canale in vista griglia
- `PlayerControls` - Play/pause, seek, selettore qualità
- `EpgGuide` - Griglia EPG con slot temporali
- `QualitySelector` - Dropdown per qualità stream
- `LoadingIndicator` - Loading animato
- `ErrorScreen` - Gestione errori UI
- `ToastNotification` - Messaggi toast (Snackbar o custom)

**Architettura Compose**:
```kotlin
@Composable
fun PlayerScreen(viewModel: PlayerViewModel) {
    val currentChannel by viewModel.currentChannel.collectAsState()
    val isPlaying by viewModel.isPlaying.collectAsState()
    
    Column {
        VideoPlayer(currentChannel, isPlaying)
        PlayerControls(viewModel)
        ChannelList(viewModel)
    }
}
```

### 10. NETWORKING E HTTP
**File**: Directory `network/`

**Librerie**:
- OkHttp per client HTTP
- Retrofit per chiamate API
- Gestione redirect, user-agent, timeout

**Utilizzo**:
```kotlin
val client = OkHttpClient.Builder()
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .addInterceptor { chain ->
        val originalRequest = chain.request()
        val requestWithUA = originalRequest.newBuilder()
            .header("User-Agent", "SandTV/1.0")
            .build()
        chain.proceed(requestWithUA)
    }
    .build()

val retrofit = Retrofit.Builder()
    .baseUrl("https://api.example.com/")
    .client(client)
    .addConverterFactory(GsonConverterFactory.create())
    .build()
```

### 11. MODALITÀ PICTURE-IN-PICTURE
**File**: `player/PipController.kt`

- Abilitare PiP per riproduzione in corso
- Ridimensionare finestra mobile
- Controlli in modalità PiP (play/pause, qualità)
- Riprendere riproduzione al ritorno

### 12. RICERCA E FILTRI
**File**: `search/SearchViewModel.kt`

- Cercare canali per nome
- Filtrare per gruppo/categoria
- Filtrare per tipo contenuto (live/on-demand)
- Ordinare (A-Z, preferiti, guardati di recente)
- Salvare cronologia ricerca

---

## PATTERN ARCHITETTURALE

Usa **MVVM (Model-View-ViewModel)** con livelli Clean Architecture:

```
app/
├── data/
│   ├── models/          # Classi dati
│   ├── database/        # Entità Room, DAO, Database
│   ├── network/         # Servizi Retrofit, chiamate API
│   └── repository/      # Pattern Repository (unica fonte di verità)
├── domain/
│   ├── models/          # Oggetti di dominio
│   ├── usecase/         # Logica di business
│   └── repository/      # Interfacce Repository
├── presentation/
│   ├── viewmodels/      # ViewModel
│   ├── screens/         # Schermate Composable
│   ├── components/      # Composable riutilizzabili
│   └── theme/           # Schemi colore, tipografia
└── worker/
    ├── M3uParser.kt
    └── XmltvParser.kt
```

**Flusso Dati**:
UI (Composable) → ViewModel (StateFlow) → Repository → Data Layer (Database/Network)

---

## REQUISITI DI PERFORMANCE

1. **Parsing M3U**: < 2 secondi per 10.000 canali
2. **Parsing EPG**: < 5 secondi per 1.000+ programmi
3. **Responsività UI**: Minimo 60fps, max 16ms per frame
4. **Query Database**: < 100ms per 10.000 record
5. **Utilizzo Memoria**: < 500MB per utilizzo tipico
6. **Tempo Avvio**: < 3 secondi cold start

**Strategie Ottimizzazione**:
- Usare Dispatchers.Default per lavoro CPU-intensivo
- Lazy load dati EPG (solo ore corrente/prossime 2)
- Cache risultati parsing M3U
- Implementare paginazione per liste grandi
- Usare viewportSize in LazyColumn per virtualizzazione

---

## DIPENDENZE (build.gradle.kts)

```kotlin
dependencies {
    // Core Android
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    
    // Jetpack Compose
    implementation("androidx.compose.ui:ui:1.6.0")
    implementation("androidx.compose.material3:material3:1.1.1")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.6.2")
    
    // Coroutines & Flow
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    
    // Room Database
    implementation("androidx.room:room-runtime:2.6.0")
    kapt("androidx.room:room-compiler:2.6.0")
    implementation("androidx.room:room-ktx:2.6.0")
    
    // ExoPlayer
    implementation("androidx.media3:media3-exoplayer:1.1.1")
    implementation("androidx.media3:media3-ui:1.1.1")
    implementation("androidx.media3:media3-exoplayer-hls:1.1.1")
    implementation("androidx.media3:media3-exoplayer-dash:1.1.1")
    
    // Firebase
    implementation("com.google.firebase:firebase-auth:22.3.0")
    implementation("com.google.firebase:firebase-database:20.2.2")
    
    // Networking
    implementation("com.squareup.okhttp3:okhttp:4.11.0")
    implementation("com.squareup.retrofit2:retrofit:2.10.0")
    implementation("com.squareup.retrofit2:converter-gson:2.10.0")
    
    // Image Loading
    implementation("io.coil-kt:coil-compose:2.5.0")
    
    // JSON
    implementation("com.google.code.gson:gson:2.10.1")
    
    // Other utilities
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.2")
    implementation("androidx.datastore:datastore-preferences:1.0.0")
}
```

---

## DETTAGLI DI IMPLEMENTAZIONE IMPORTANTI

1. **Integrazione Content Detection**:
   - Chiamare `ContentDetector.detectContentType()` durante parsing M3U
   - Aggiungere tipo rilevato all'oggetto Channel
   - Visualizzare badge tipo contenuto in UI (🔴 Live, 📺 On-demand, ecc)

2. **Rilevamento Bordo Live**:
   - Integrare `LiveEdgeManager` in PlayerController
   - Monitorare posizione riproduzione ogni 500ms
   - Mostrare pulsante "Vai al Live" quando ritardo > 2.5s
   - Nascondere automaticamente quando ritardo < 1.5s
   - Implementare meccanismo seek-to-live con retry

3. **Strategia Caching EPG**:
   - Recuperare EPG al caricamento playlist
   - Cache in database Room con timestamp
   - Invalidare dopo 7 giorni
   - Mostrare programma corrente mentre EPG carica

4. **Gestione Errori**:
   - Errori di rete: Mostrare dialogo retry
   - Errori di parsing: Log e continuare con dati parziali
   - Errori database: Fallback a storage in memoria
   - Errori riproduzione: Auto-retry o suggerire downgrade qualità

5. **Tema e UI**:
   - Implementare toggle tema scuro/chiaro
   - Usare Material 3 design system
   - Schema colori: Blu primario, colori accentuati per tipi contenuto
   - Tipografia personalizzata (Roboto o font sistema)

6. **Notifiche e Feedback**:
   - Toast/Snackbar per azioni (canale aggiunto, impostazioni salvate)
   - Indicatori loading durante parsing
   - Progress bar per buffering
   - Messaggi errore con suggerimenti actionabili

---

## CONFIGURAZIONE E IMPOSTAZIONI

Creare sistema impostazioni utente con:
- Qualità stream predefinita
- Preferenze dimensione buffer
- Toggle Picture-in-Picture
- Auto-play prossimo episodio
- Selezione lingua
- Opzioni velocità riproduzione
- Supporto sottotitoli (se EPG ha info sottotitoli)
- Categorie contenuto bloccate

---

## REQUISITI TEST

Implementare test unitari per:
- Parsing M3U (vari formati e casi limite)
- Parsing XMLTV (gestione fusi orari, caratteri speciali)
- Content detection (tutti 5 scenari)
- Operazioni database (CRUD, query)
- Calcoli live edge (vari scenari ritardo)

---

## DELIVERABLE

1. ✅ App Android Kotlin completa
2. ✅ UI funzionale con Jetpack Compose
3. ✅ Streaming HLS/DASH con ExoPlayer
4. ✅ Parsing M3U & XMLTV
5. ✅ Auto-riconoscimento tipi contenuto
6. ✅ Gestione bordo live
7. ✅ Autenticazione Firebase
8. ✅ Cache locale (database Room)
9. ✅ Preferenze e impostazioni utente
10. ✅ Supporto tema scuro
11. ✅ Gestione e recupero errori
12. ✅ Test unitari
13. ✅ Documentazione codice
14. ✅ Android minSdk 24, targetSdk 34

---

## NOTE

- Replicare UI/UX da versione React il più fedelmente possibile
- Mantenere parità funzionalità (nessuna funzionalità persa nella traduzione)
- Ottimizzare per mobile (interazioni touch, layout responsivi)
- Gestire correttamente ciclo di vita Android (onPause, onResume per player)
- Richiedere permessi necessari (INTERNET, READ_EXTERNAL_STORAGE se necessario)
- Testare su più dimensioni dispositivo (telefono, tablet)
- Assicurare buona performance su dispositivi mid-range (2GB+ RAM)

---

**Inizia configurando la struttura del progetto, configurando Gradle e implementando i modelli dati core e repository. Poi passa all'UI e infine alle funzionalità avanzate come rilevamento bordo live.**
