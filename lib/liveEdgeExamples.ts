/**
 * ESEMPIO DI UTILIZZO - Live Edge Manager
 * 
 * Questo file mostra come usare il LiveEdgeManager in casi d'uso reali
 */

import { getLiveEdgeManager, LiveEdgeConfig } from './liveEdgeManager';

/**
 * ESEMPIO 1: Uso base nel Player component
 * 
 * Questo è esattamente quello che è implementato in Player.tsx
 */
export function exampleBasicUsage() {
  // Crea il manager (singleton)
  const liveEdgeManager = getLiveEdgeManager({
    enableDiagnostics: true,
    delayThreshold: 2.5,
    delayThresholdLow: 1.5,
  });

  // Nel onTimeUpdate handler:
  function onTimeUpdate(video: HTMLVideoElement, hls: any) {
    // Analizza lo stato corrente
    const diagnostics = liveEdgeManager.analyzeLiveState(video, hls);

    if (diagnostics) {
      console.log(`Ritardo attuale: ${diagnostics.delay.toFixed(2)}s`);
      console.log(`Buffer: ${diagnostics.totalBufferedTime.toFixed(2)}s`);
      
      // Decidi se mostrare il bottone (con isteresi)
      const shouldShow = liveEdgeManager.shouldShowGoToLiveButton(
        diagnostics,
        false // passa lo stato precedente (es. da state React)
      );
      
      // setIsBehindLive(shouldShow); // Aggiorna UI React
    }
  }

  // Quando l'utente clicca "torna al live":
  async function handleGoToLiveClick(
    video: HTMLVideoElement,
    hls: any
  ) {
    const diagnostics = liveEdgeManager.getDiagnosticsHistory()[
      liveEdgeManager.getDiagnosticsHistory().length - 1
    ];

    const success = await liveEdgeManager.seekToLiveEdge(
      video,
      diagnostics,
      hls
    );

    if (success) {
      console.log('✅ Seekato al live con successo');
    } else {
      console.warn('⚠️ Seek fallito, ma video continua');
    }
  }
}

/**
 * ESEMPIO 2: Utilizzo per un dashboard di statistiche
 */
export function exampleDashboard() {
  const manager = getLiveEdgeManager();

  // Aggiorna dashboard ogni 10 secondi
  setInterval(() => {
    const stats = manager.getStatistics();

    // Aggiorna UI con le statistiche
    document.getElementById('avg-delay').textContent = 
      stats.avgDelay.toFixed(2) + 's';
    document.getElementById('max-delay').textContent = 
      stats.maxDelay.toFixed(2) + 's';
    document.getElementById('buffer-size').textContent = 
      stats.averageBufferSize.toFixed(2) + 's';
    document.getElementById('behind-live-freq').textContent = 
      (stats.frequencyBehindLive * 100).toFixed(1) + '%';

    // Colora in rosso se problematico
    const indicator = document.getElementById('health-indicator');
    if (stats.frequencyBehindLive > 0.5) {
      indicator.style.backgroundColor = 'red';
      indicator.textContent = 'Problematico';
    } else if (stats.frequencyBehindLive > 0.2) {
      indicator.style.backgroundColor = 'yellow';
      indicator.textContent = 'Avvertenza';
    } else {
      indicator.style.backgroundColor = 'green';
      indicator.textContent = 'Buono';
    }
  }, 10000);
}

/**
 * ESEMPIO 3: Profilo personalizzato per sport live a bassa latenza
 */
export function exampleSportsProfile() {
  const sportsConfig: Partial<LiveEdgeConfig> = {
    // Sport richiede latenza bassissima
    delayThreshold: 1.0,      // Mostra bottone se > 1s
    delayThresholdLow: 0.5,   // Nascondi se < 0.5s
    minBufferForLive: 0.3,    // Minimo buffer
    debounceMs: 200,          // Check frequente
    enableDiagnostics: false,  // Disabilita log per performance
  };

  return getLiveEdgeManager(sportsConfig);
}

/**
 * ESEMPIO 4: Profilo per rete instabile
 */
export function exampleUnstableNetworkProfile() {
  const config: Partial<LiveEdgeConfig> = {
    // Rete instabile richiede più tolleranza
    delayThreshold: 5,         // Accetta fino a 5s di ritardo
    delayThresholdLow: 3,
    minBufferForLive: 2.0,     // Buffer più grande
    debounceMs: 1000,          // Check meno frequente
    seekRetryAttempts: 5,      // Più retry
    seekRetryDelayMs: 200,     // Delay più lungo tra retry
  };

  return getLiveEdgeManager(config);
}

/**
 * ESEMPIO 5: Integrazione con backend per monitoraggio
 */
export async function exampleBackendIntegration() {
  const manager = getLiveEdgeManager({
    enableDiagnostics: false,  // Disabilita log in produzione
  });

  // Salva diagnostics ogni minuto
  setInterval(async () => {
    try {
      const report = manager.exportDiagnosticsReport();
      const stats = manager.getStatistics();

      // Invia al backend
      await fetch('/api/streaming-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          avgDelay: stats.avgDelay,
          maxDelay: stats.maxDelay,
          bufferSize: stats.averageBufferSize,
          frequencyBehindLive: stats.frequencyBehindLive,
          deviceInfo: {
            browser: navigator.userAgent,
            online: navigator.onLine,
            connection: (navigator as any).connection?.effectiveType,
          },
        }),
      });

      console.log('📤 Metriche inviate al backend');
    } catch (error) {
      console.error('❌ Errore invio metriche:', error);
    }
  }, 60000);
}

/**
 * ESEMPIO 6: Test automatico della funzionalità
 */
export async function exampleAutoTest(
  video: HTMLVideoElement,
  hls: any
) {
  const manager = getLiveEdgeManager();
  const tests = [];

  // Test 1: Rilevamento ritardo
  const originalTime = video.currentTime;
  video.currentTime -= 3;
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const diag1 = manager.analyzeLiveState(video, hls);
  tests.push({
    name: 'Delay Detection',
    pass: diag1 && diag1.delay > 2.8,
    value: diag1?.delay.toFixed(2),
  });

  video.currentTime = originalTime;

  // Test 2: Isteresi
  const shouldShow1 = manager.shouldShowGoToLiveButton(diag1, false);
  const shouldShow2 = manager.shouldShowGoToLiveButton(diag1, true);
  tests.push({
    name: 'Hysteresis',
    pass: shouldShow1 && shouldShow2, // Deve mostrare in entrambi i casi
    value: 'OK',
  });

  // Test 3: Seek
  const seekSuccess = await manager.seekToLiveEdge(video, diag1, hls);
  tests.push({
    name: 'Seek to Live',
    pass: seekSuccess,
    value: seekSuccess ? 'Success' : 'Failed',
  });

  // Riporta risultati
  console.table(tests);
  return tests;
}

/**
 * ESEMPIO 7: Monitoraggio avanzato con callback
 */
export function exampleAdvancedMonitoring(
  onDelayChange?: (delay: number) => void,
  onBufferingStart?: () => void,
  onBufferingEnd?: () => void
) {
  const manager = getLiveEdgeManager();
  let lastDelay = 0;
  let wasBuffering = false;

  setInterval(() => {
    const history = manager.getDiagnosticsHistory();
    if (history.length === 0) return;

    const latest = history[history.length - 1];

    // Callback su cambio ritardo
    if (Math.abs(latest.delay - lastDelay) > 0.5) {
      lastDelay = latest.delay;
      onDelayChange?.(latest.delay);
    }

    // Callback su cambio buffering
    if (latest.isBuffering && !wasBuffering) {
      wasBuffering = true;
      onBufferingStart?.();
    } else if (!latest.isBuffering && wasBuffering) {
      wasBuffering = false;
      onBufferingEnd?.();
    }
  }, 1000);
}

/**
 * ESEMPIO 8: Utility per esportare dati di debug
 */
export function exampleExportDebugData() {
  const manager = getLiveEdgeManager();

  // Crea un Blob con il report
  const report = manager.exportDiagnosticsReport();
  const blob = new Blob([report], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  // Scarica il file
  const a = document.createElement('a');
  a.href = url;
  a.download = `live-edge-report-${Date.now()}.txt`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * ESEMPIO 9: Configurazione dinamica basata sulla rete
 */
export function exampleDynamicConfiguration() {
  const navigator_ = navigator as any;
  
  // Rileva tipo di connessione
  const effectiveType = navigator_.connection?.effectiveType || '4g';
  
  const configs = {
    '4g': {
      delayThreshold: 1.5,
      minBufferForLive: 0.5,
      debounceMs: 300,
    },
    '3g': {
      delayThreshold: 3,
      minBufferForLive: 1.5,
      debounceMs: 800,
    },
    '2g': {
      delayThreshold: 5,
      minBufferForLive: 3,
      debounceMs: 1500,
    },
    'slow-2g': {
      delayThreshold: 8,
      minBufferForLive: 5,
      debounceMs: 2000,
    },
  };

  const config = configs[effectiveType] || configs['4g'];
  return getLiveEdgeManager(config);
}

/**
 * ESEMPIO 10: Alert system per problemi di streaming
 */
export function exampleAlertSystem() {
  const manager = getLiveEdgeManager();

  // Alert se frequenza dietro live è alta
  setInterval(() => {
    const stats = manager.getStatistics();

    if (stats.frequencyBehindLive > 0.5) {
      console.error(
        '🚨 ALERT: Streaming dietro live il 50%+ del tempo. ' +
        'Possibile problema di server o network.'
      );
      
      // Notifica all'utente
      alert('⚠️ Qualità dello stream: Possibili ritardi');
    }

    if (stats.maxDelay > 30) {
      console.error(
        '🚨 ALERT: Ritardo massimo raggiunto: ' + 
        stats.maxDelay.toFixed(2) + 's'
      );
    }

    if (stats.averageBufferSize < 1) {
      console.warn(
        '⚠️ WARNING: Buffer medio molto basso: ' +
        stats.averageBufferSize.toFixed(2) + 's. ' +
        'Network instabile?'
      );
    }
  }, 30000);
}
