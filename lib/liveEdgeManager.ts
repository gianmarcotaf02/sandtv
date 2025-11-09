/**
 * LIVE EDGE MANAGER
 * 
 * Gestisce la rilevazione del ritardo rispetto al live edge nei flussi IPTV live.
 * Fornisce diagnostics precise per determinare quando il player è effettivamente dietro il live,
 * e gestisce il seek al live edge in modo ottimale.
 * 
 * Problemi che risolve:
 * - Falsi positivi nel rilevamento del ritardo (bottone che appare continuamente)
 * - Seek non ottimale al live edge che causa buffering
 * - Mancanza di diagnostics per identificare problemi server vs frontend
 */

export interface LiveEdgeDiagnostics {
  /** Tempo corrente del player in secondi */
  currentTime: number;
  /** Fine dell'intervallo seekable (live edge massimo) */
  seekableEnd: number;
  /** Ritardo calcolato rispetto al live edge (secondi) */
  delay: number;
  /** Posizione sync ottimale (da HLS.js) */
  hlsLiveSyncPosition: number | null;
  /** Durata buffer */
  duration: number;
  /** Se il video è in riproduzione */
  isPlaying: boolean;
  /** Se il video è in buffering */
  isBuffering: boolean;
  /** Numero di chunk nel buffer */
  bufferedChunks: number;
  /** Intervallo di tempo totale in buffer (secondi) */
  totalBufferedTime: number;
  /** Timestamp della misura (ms dal start dell'app) */
  timestamp: number;
  /** Diagnostica server-side (se disponibile) */
  serverDiagnostics: {
    playlistRefreshInterval: number | null;
    segmentDuration: number | null;
    totalSegments: number | null;
  };
}

export interface LiveEdgeConfig {
  /** Soglia di ritardo per mostrare il bottone (secondi) */
  delayThreshold: number;
  /** Soglia inferiore per nascondere il bottone con isteresi (secondi) */
  delayThresholdLow: number;
  /** Intervallo di debounce per controlli (ms) */
  debounceMs: number;
  /** Buffer minimo consigliato per il seek al live (secondi) */
  minBufferForLive: number;
  /** Tentativi di retry se il seek fallisce */
  seekRetryAttempts: number;
  /** Delay tra i retry (ms) */
  seekRetryDelayMs: number;
  /** Log diagnostics nella console */
  enableDiagnostics: boolean;
}

/**
 * Classe per la gestione del live edge e diagnostics
 */
export class LiveEdgeManager {
  private config: LiveEdgeConfig;
  private diagnosticsHistory: LiveEdgeDiagnostics[] = [];
  private maxHistorySize = 50;
  private lastCheckTime = 0;

  constructor(config: Partial<LiveEdgeConfig> = {}) {
    this.config = {
      delayThreshold: 3, // Mostra bottone se ritardo > 3 secondi
      delayThresholdLow: 2, // Nascondi bottone se ritardo < 2 secondi (isteresi)
      debounceMs: 500, // Attendi 500ms di stabilità prima di aggiornare
      minBufferForLive: 0.8, // Buffer minimo di 0.8 secondi dal live edge
      seekRetryAttempts: 3, // Ritenta 3 volte se il seek fallisce
      seekRetryDelayMs: 100, // Attendi 100ms tra retry
      enableDiagnostics: true,
      ...config,
    };
  }

  /**
   * Analizza lo stato corrente del player e ritorna diagnostics dettagliati
   * 
   * @param video - Elemento video HTML
   * @param hls - Istanza di HLS.js (opzionale)
   * @returns Diagnostics dettagliati sullo stato del live
   */
  analyzeLiveState(
    video: HTMLVideoElement,
    hls?: any
  ): LiveEdgeDiagnostics | null {
    if (!video) return null;

    const now = performance.now();

    // Calcola il live edge e il ritardo
    let seekableEnd = 0;
    let delay = 0;

    if (video.seekable && video.seekable.length > 0) {
      const last = video.seekable.length - 1;
      seekableEnd = video.seekable.end(last);
      delay = seekableEnd - video.currentTime;
    }

    // Posizione sync da HLS.js (più accurata per bassa latenza)
    const hlsLiveSyncPosition = hls?.liveSyncPosition ?? null;

    // Calcola il buffer
    const { bufferedChunks, totalBufferedTime } = this.calculateBufferState(
      video
    );

    // Diagnostics server-side (dalla playlist m3u8)
    const serverDiags = this.analyzePlaylistDiagnostics(hls);

    const diagnostics: LiveEdgeDiagnostics = {
      currentTime: video.currentTime,
      seekableEnd,
      delay,
      hlsLiveSyncPosition,
      duration: video.duration,
      isPlaying: !video.paused && !video.ended,
      isBuffering: this.isVideoBuffering(video),
      bufferedChunks,
      totalBufferedTime,
      timestamp: now,
      serverDiagnostics: serverDiags,
    };

    // Mantieni history per analisi
    this.diagnosticsHistory.push(diagnostics);
    if (this.diagnosticsHistory.length > this.maxHistorySize) {
      this.diagnosticsHistory.shift();
    }

    if (this.config.enableDiagnostics) {
      console.log('📊 Live Edge Diagnostics:', {
        delay: `${delay.toFixed(2)}s`,
        currentTime: `${video.currentTime.toFixed(2)}s`,
        seekableEnd: `${seekableEnd.toFixed(2)}s`,
        buffer: `${totalBufferedTime.toFixed(2)}s`,
        isBuffering: diagnostics.isBuffering,
        hlsSync: hlsLiveSyncPosition?.toFixed(2) ?? 'N/A',
      });
    }

    return diagnostics;
  }

  /**
   * Determina se il bottone "torna al live" deve essere visibile
   * Usa isteresi per evitare flickering
   * 
   * @param diagnostics - Diagnostics correnti
   * @param currentlyShowing - Se il bottone è attualmente visibile
   * @returns true se il bottone deve essere mostrato
   */
  shouldShowGoToLiveButton(
    diagnostics: LiveEdgeDiagnostics | null,
    currentlyShowing: boolean = false
  ): boolean {
    if (!diagnostics) return false;

    // Se video non sta riproducendo, non mostrare bottone
    if (!diagnostics.isPlaying) {
      return false;
    }

    // Se in buffering, mantieni stato attuale per evitare flickering
    if (diagnostics.isBuffering) {
      return currentlyShowing;
    }

    // Isteresi: mostra se delay > threshold, nascondi solo se < threshold_low
    if (currentlyShowing) {
      // Se il bottone è visibile, nascondi solo se delay è basso
      return diagnostics.delay > this.config.delayThresholdLow;
    } else {
      // Se il bottone è nascosto, mostra solo se delay è alto
      return diagnostics.delay > this.config.delayThreshold;
    }
  }

  /**
   * Calcola lo stato preciso del buffer
   */
  private calculateBufferState(video: HTMLVideoElement): {
    bufferedChunks: number;
    totalBufferedTime: number;
  } {
    let totalBufferedTime = 0;
    let bufferedChunks = 0;

    if (video.buffered && video.buffered.length > 0) {
      bufferedChunks = video.buffered.length;

      // Somma tutti gli intervalli di buffer
      for (let i = 0; i < video.buffered.length; i++) {
        totalBufferedTime += video.buffered.end(i) - video.buffered.start(i);
      }
    }

    return { bufferedChunks, totalBufferedTime };
  }

  /**
   * Verifica se il video è attualmente in buffering
   */
  private isVideoBuffering(video: HTMLVideoElement): boolean {
    return (
      // Video is playing but no data is available
      (!video.paused && video.readyState < 3) ||
      // Stalled event (network issue)
      (video.networkState === 2 && video.readyState < 4)
    );
  }

  /**
   * Analizza la playlist m3u8 per ottenere diagnostics server-side
   * Questo aiuta a identificare se il problema è del server o del frontend
   */
  private analyzePlaylistDiagnostics(
    hls?: any
  ): LiveEdgeDiagnostics['serverDiagnostics'] {
    const result: LiveEdgeDiagnostics['serverDiagnostics'] = {
      playlistRefreshInterval: null,
      segmentDuration: null,
      totalSegments: null,
    };

    if (!hls || !hls.media) return result;

    try {
      // Analizza i segmenti per calcolare la durata media
      const playlist = hls.media;
      if (playlist.segments && playlist.segments.length > 0) {
        result.totalSegments = playlist.segments.length;

        // Calcola durata media segmento
        const durations = playlist.segments.map((seg: any) => seg.duration);
        result.segmentDuration =
          durations.reduce((a: number, b: number) => a + b, 0) /
          durations.length;
      }

      // Target duration (refresh interval consigliato)
      if (playlist.targetDuration) {
        result.playlistRefreshInterval = playlist.targetDuration;
      }
    } catch (err) {
      // Silenzio gli errori di parsing
    }

    return result;
  }

  /**
   * Esegue un seek preciso al live edge con gestione ottimale del buffer
   * 
   * @param video - Elemento video
   * @param diagnostics - Diagnostics correnti
   * @param hls - Istanza di HLS.js
   * @returns Promise che si risolve quando il seek è completato
   */
  async seekToLiveEdge(
    video: HTMLVideoElement,
    diagnostics: LiveEdgeDiagnostics | null,
    hls?: any
  ): Promise<boolean> {
    if (!video) return false;

    let targetPosition: number | null = null;

    // Metodo 1: Usa HLS.js liveSyncPosition (MIGLIORE)
    if (hls && typeof hls.liveSyncPosition === 'number') {
      // ⚡ Posiziona leggermente PRIMA del live sync per avere buffer
      targetPosition = hls.liveSyncPosition - this.config.minBufferForLive;

      if (this.config.enableDiagnostics) {
        console.log(
          `⚡ Seek to live via HLS.js: ${targetPosition.toFixed(2)}s (liveSyncPosition: ${hls.liveSyncPosition.toFixed(2)}s)`
        );
      }
    }
    // Metodo 2: Usa seekable ranges
    else if (video.seekable && video.seekable.length > 0) {
      const last = video.seekable.length - 1;
      const end = video.seekable.end(last);
      targetPosition = Math.max(
        0,
        end - this.config.minBufferForLive
      );

      if (this.config.enableDiagnostics) {
        console.log(
          `⚡ Seek to live via seekable: ${targetPosition.toFixed(2)}s (end: ${end.toFixed(2)}s)`
        );
      }
    }

    if (targetPosition === null) {
      console.warn('⚠️ Impossibile determinare il live edge per seek');
      return false;
    }

    // Esegui il seek con retry logic
    return this.performSeekWithRetry(video, targetPosition, hls);
  }

  /**
   * Esegue il seek con meccanismo di retry robusto
   */
  private async performSeekWithRetry(
    video: HTMLVideoElement,
    targetPosition: number,
    hls?: any,
    attemptNumber: number = 1
  ): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const currentTime = video.currentTime;

        // Se siamo già vicini al target, non fare niente
        if (Math.abs(currentTime - targetPosition) < 0.5) {
          if (this.config.enableDiagnostics) {
            console.log(
              `✅ Già al live edge (diff: ${Math.abs(currentTime - targetPosition).toFixed(2)}s)`
            );
          }
          resolve(true);
          return;
        }

        // Imposta il nuovo tempo
        video.currentTime = targetPosition;

        // Listener per verificare se il seek è riuscito
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('seeking', onSeeking);
          clearTimeout(seekTimeout);

          if (this.config.enableDiagnostics) {
            console.log(
              `✅ Seek completato: ${video.currentTime.toFixed(2)}s`
            );
          }

          // Se necessario, ricarica il buffer da HLS
          if (hls && typeof hls.startLoad === 'function') {
            hls.stopLoad();
            setTimeout(() => {
              hls.startLoad(targetPosition);
              video.play().catch(() => {});
            }, 50);
          } else {
            video.play().catch(() => {});
          }

          resolve(true);
        };

        let isSeekingStarted = false;
        const onSeeking = () => {
          isSeekingStarted = true;
        };

        const seekTimeout = setTimeout(() => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('seeking', onSeeking);

          if (isSeekingStarted) {
            // Seeking è iniziato ma non è finito (probabile timeout)
            if (
              attemptNumber < this.config.seekRetryAttempts
            ) {
              if (this.config.enableDiagnostics) {
                console.warn(
                  `⚠️ Seek timeout, tentando di nuovo (${attemptNumber}/${this.config.seekRetryAttempts})`
                );
              }

              // Ritenta dopo un delay
              setTimeout(() => {
                this.performSeekWithRetry(
                  video,
                  targetPosition,
                  hls,
                  attemptNumber + 1
                ).then(resolve);
              }, this.config.seekRetryDelayMs);
            } else {
              console.error(
                `❌ Seek fallito dopo ${this.config.seekRetryAttempts} tentativi`
              );
              video.play().catch(() => {});
              resolve(false);
            }
          } else {
            // Seeking non è nemmeno iniziato (settato il currentTime direttamente)
            if (this.config.enableDiagnostics) {
              console.log(`✅ Seek diretto senza evento seeked`);
            }
            video.play().catch(() => {});
            resolve(true);
          }
        }, 3000); // Timeout 3 secondi

        video.addEventListener('seeked', onSeeked);
        video.addEventListener('seeking', onSeeking);
      } catch (err) {
        console.error('❌ Errore durante seek:', err);
        resolve(false);
      }
    });
  }

  /**
   * Ritorna la history di diagnostics per analisi
   */
  getDiagnosticsHistory(): LiveEdgeDiagnostics[] {
    return [...this.diagnosticsHistory];
  }

  /**
   * Calcola statistiche sulla history per debugging
   */
  getStatistics(): {
    avgDelay: number;
    maxDelay: number;
    minDelay: number;
    averageBufferSize: number;
    frequencyBehindLive: number;
  } {
    if (this.diagnosticsHistory.length === 0) {
      return {
        avgDelay: 0,
        maxDelay: 0,
        minDelay: 0,
        averageBufferSize: 0,
        frequencyBehindLive: 0,
      };
    }

    const delays = this.diagnosticsHistory.map((d) => d.delay);
    const buffers = this.diagnosticsHistory.map((d) => d.totalBufferedTime);
    const behindLive = this.diagnosticsHistory.filter(
      (d) => d.delay > this.config.delayThreshold
    ).length;

    return {
      avgDelay: delays.reduce((a, b) => a + b, 0) / delays.length,
      maxDelay: Math.max(...delays),
      minDelay: Math.min(...delays),
      averageBufferSize: buffers.reduce((a, b) => a + b, 0) / buffers.length,
      frequencyBehindLive: behindLive / this.diagnosticsHistory.length,
    };
  }

  /**
   * Esporta un report di diagnostics per debugging
   */
  exportDiagnosticsReport(): string {
    const stats = this.getStatistics();
    const latest = this.diagnosticsHistory[this.diagnosticsHistory.length - 1];

    return `
=== LIVE EDGE DIAGNOSTICS REPORT ===
Timestamp: ${new Date().toISOString()}

LATEST STATE:
- Delay: ${latest?.delay.toFixed(2)}s
- Buffer: ${latest?.totalBufferedTime.toFixed(2)}s
- Is Buffering: ${latest?.isBuffering}
- Total Segments: ${latest?.serverDiagnostics.totalSegments}

STATISTICS (last ${this.diagnosticsHistory.length} measurements):
- Average Delay: ${stats.avgDelay.toFixed(2)}s
- Max Delay: ${stats.maxDelay.toFixed(2)}s
- Min Delay: ${stats.minDelay.toFixed(2)}s
- Average Buffer: ${stats.averageBufferSize.toFixed(2)}s
- Frequency Behind Live: ${(stats.frequencyBehindLive * 100).toFixed(1)}%

CONFIG:
${JSON.stringify(this.config, null, 2)}
    `;
  }
}

// Singleton instance per uso globale
let managerInstance: LiveEdgeManager | null = null;

export function getLiveEdgeManager(
  config?: Partial<LiveEdgeConfig>
): LiveEdgeManager {
  if (!managerInstance) {
    managerInstance = new LiveEdgeManager(config);
  }
  return managerInstance;
}

export function resetLiveEdgeManager(): void {
  managerInstance = null;
}
