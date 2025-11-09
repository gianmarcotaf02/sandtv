/**
 * LIVE EDGE DIAGNOSTICS & TESTING
 * 
 * Questo file fornisce utilità per testare e debuggare la funzionalità
 * "torna al live" nell'applicazione IPTV.
 * 
 * USO IN CONSOLE DEL BROWSER:
 * 
 * 1. Importa il manager nel browser con:
 *    window.liveEdgeTest = require('./lib/liveEdgeManager').getLiveEdgeManager()
 * 
 * 2. Accedi alle funzioni di test:
 *    - liveEdgeTest.getDiagnosticsHistory()
 *    - liveEdgeTest.getStatistics()
 *    - liveEdgeTest.exportDiagnosticsReport()
 */

import { getLiveEdgeManager } from './liveEdgeManager';

/**
 * Espone il manager nel contesto globale per debugging da browser console
 */
export function setupLiveEdgeDebugging(): void {
  if (typeof window !== 'undefined') {
    const manager = getLiveEdgeManager();
    
    // Esponi le funzioni di debug
    (window as any).liveEdgeDebug = {
      /**
       * Mostra l'ultimo stato di diagnostics
       */
      showLatest: () => {
        const history = manager.getDiagnosticsHistory();
        if (history.length === 0) {
          console.log('📊 Nessun dato di diagnostics disponibile');
          return;
        }
        const latest = history[history.length - 1];
        console.table({
          'Ritardo (s)': latest.delay.toFixed(2),
          'Tempo corrente (s)': latest.currentTime.toFixed(2),
          'Live edge (s)': latest.seekableEnd.toFixed(2),
          'Buffer totale (s)': latest.totalBufferedTime.toFixed(2),
          'In riproduzione': latest.isPlaying ? 'Sì' : 'No',
          'In buffering': latest.isBuffering ? 'Sì' : 'No',
          'Segmenti HLS': latest.serverDiagnostics.totalSegments,
          'Durata segmento (s)': latest.serverDiagnostics.segmentDuration?.toFixed(2) ?? 'N/A',
        });
      },

      /**
       * Mostra le statistiche aggregate
       */
      showStatistics: () => {
        const stats = manager.getStatistics();
        console.log('📈 Statistiche aggregate:', {
          'Ritardo medio (s)': stats.avgDelay.toFixed(2),
          'Ritardo massimo (s)': stats.maxDelay.toFixed(2),
          'Ritardo minimo (s)': stats.minDelay.toFixed(2),
          'Buffer medio (s)': stats.averageBufferSize.toFixed(2),
          'Frequenza dietro live': `${(stats.frequencyBehindLive * 100).toFixed(1)}%`,
        });
      },

      /**
       * Esporta il report completo
       */
      exportReport: () => {
        const report = manager.exportDiagnosticsReport();
        console.log(report);
        
        // Copia negli appunti se possibile
        if (navigator.clipboard) {
          navigator.clipboard.writeText(report);
          console.log('✅ Report copiato negli appunti');
        }
      },

      /**
       * Monitora il live edge in tempo reale (aggiornamento ogni 5 secondi)
       */
      startMonitoring: (intervalMs: number = 5000) => {
        const intervalId = setInterval(() => {
          const history = manager.getDiagnosticsHistory();
          if (history.length > 0) {
            const latest = history[history.length - 1];
            const now = new Date().toLocaleTimeString();
            console.log(
              `${now} | Ritardo: ${latest.delay.toFixed(2)}s | Buffer: ${latest.totalBufferedTime.toFixed(2)}s | Buffering: ${latest.isBuffering}`
            );
          }
        }, intervalMs);

        console.log(
          `📡 Monitoraggio avviato (update ogni ${intervalMs}ms). Ferma con: liveEdgeDebug.stopMonitoring()`
        );

        // Memorizza l'ID per poterlo stoppare
        (window as any).__liveEdgeMonitoringId = intervalId;
      },

      /**
       * Ferma il monitoraggio
       */
      stopMonitoring: () => {
        const intervalId = (window as any).__liveEdgeMonitoringId;
        if (intervalId) {
          clearInterval(intervalId);
          (window as any).__liveEdgeMonitoringId = null;
          console.log('✅ Monitoraggio fermato');
        }
      },

      /**
       * Simula un ritardo di X secondi e verifica se il bottone appare
       * (utile per test)
       */
      testDelayDetection: async (delaySeconds: number = 5) => {
        console.log(`🧪 Test: Simulazione ritardo di ${delaySeconds}s...`);
        console.log('Nota: Questo test richiede un video che sta riproducendo');
        
        const videoElement = document.querySelector('video') as HTMLVideoElement;
        if (!videoElement) {
          console.error('❌ Nessun elemento video trovato');
          return;
        }

        const originalTime = videoElement.currentTime;
        
        // Setta il tempo indietro di N secondi
        videoElement.currentTime = Math.max(0, originalTime - delaySeconds);
        
        // Attendi che HLS.js aggiornizzi
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Leggi lo stato
        const history = manager.getDiagnosticsHistory();
        if (history.length > 0) {
          const latest = history[history.length - 1];
          console.log(
            `📊 Risultato test: Ritardo rilevato = ${latest.delay.toFixed(2)}s (atteso: ~${delaySeconds}s)`
          );
          console.log(`Bottone dovrebbe essere ${latest.delay > 2.5 ? '✅ VISIBILE' : '❌ NASCOSTO'}`);
        }
        
        // Ripristina il tempo originale
        videoElement.currentTime = originalTime;
      },

      /**
       * Simula un seek al live e verifica se funziona
       */
      testGoToLive: async () => {
        console.log('🧪 Test: Seek al live...');
        
        const videoElement = document.querySelector('video') as HTMLVideoElement;
        if (!videoElement) {
          console.error('❌ Nessun elemento video trovato');
          return;
        }

        const timeBefore = videoElement.currentTime;
        
        // Usa il manager per seekare al live
        const diagnostics = manager.getDiagnosticsHistory()[manager.getDiagnosticsHistory().length - 1];
        const success = await manager.seekToLiveEdge(videoElement, diagnostics);
        
        const timeAfter = videoElement.currentTime;
        console.log(
          `📊 Risultato test: Seek ${success ? '✅ RIUSCITO' : '❌ FALLITO'}`
        );
        console.log(`Tempo prima: ${timeBefore.toFixed(2)}s, Tempo dopo: ${timeAfter.toFixed(2)}s`);
      },

      /**
       * Mostra tutta la history di diagnostics
       */
      showHistory: () => {
        const history = manager.getDiagnosticsHistory();
        if (history.length === 0) {
          console.log('📊 Nessun dato di diagnostics disponibile');
          return;
        }
        
        const data = history.map(h => ({
          timestamp: new Date(h.timestamp).toLocaleTimeString(),
          delay: h.delay.toFixed(2),
          currentTime: h.currentTime.toFixed(2),
          buffer: h.totalBufferedTime.toFixed(2),
          buffering: h.isBuffering ? 'Sì' : 'No',
        }));
        
        console.table(data);
      },

      /**
       * Controlla lo stato del server playlist (se disponibile)
       */
      checkServerState: () => {
        const history = manager.getDiagnosticsHistory();
        if (history.length === 0) {
          console.log('📊 Nessun dato di diagnostics disponibile');
          return;
        }
        
        const latest = history[history.length - 1];
        const server = latest.serverDiagnostics;
        
        console.log('🖥️ Diagnostics Server:', {
          'Intervallo refresh playlist': server.playlistRefreshInterval
            ? `${server.playlistRefreshInterval.toFixed(1)}s`
            : 'N/A',
          'Durata segmento': server.segmentDuration
            ? `${server.segmentDuration.toFixed(2)}s`
            : 'N/A',
          'Numero segmenti': server.totalSegments ?? 'N/A',
        });
      },

      /**
       * Mostra l'aiuto
       */
      help: () => {
        console.log(`
╔════════════════════════════════════════════════════════════════╗
║         LIVE EDGE DEBUGGING - Comandi disponibili              ║
╚════════════════════════════════════════════════════════════════╝

📊 DIAGNOSTICS:
  liveEdgeDebug.showLatest()         - Mostra ultimo stato
  liveEdgeDebug.showStatistics()     - Mostra statistiche aggregate
  liveEdgeDebug.showHistory()        - Mostra tutta la history
  liveEdgeDebug.checkServerState()   - Diagnostics del server

🧪 TEST:
  liveEdgeDebug.testDelayDetection() - Test rilevamento ritardo
  liveEdgeDebug.testGoToLive()       - Test seek al live

📈 MONITORAGGIO:
  liveEdgeDebug.startMonitoring()    - Avvia monitoraggio in tempo reale
  liveEdgeDebug.stopMonitoring()     - Ferma monitoraggio
  
📁 EXPORT:
  liveEdgeDebug.exportReport()       - Esporta report completo

        `);
      },
    };

    console.log('✅ Live Edge Debugging disponibile. Usa: liveEdgeDebug.help()');
  }
}

/**
 * Funzione di autochecking che valida la configurazione
 */
export function validateLiveEdgeSetup(): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Controlla che HLS.js sia disponibile
  if (typeof (window as any).Hls === 'undefined') {
    issues.push('⚠️ HLS.js non è disponibile in window');
  }

  // Controlla che ci sia almeno un video element
  const videoElements = document.querySelectorAll('video');
  if (videoElements.length === 0) {
    issues.push('⚠️ Nessun elemento video trovato nella pagina');
  }

  // Controlla le API video richieste
  if (videoElements.length > 0) {
    const video = videoElements[0] as HTMLVideoElement;
    
    if (!video.seekable) {
      issues.push('⚠️ seekable API non supportata');
    }
    
    if (!video.buffered) {
      issues.push('⚠️ buffered API non supportata');
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
