/**
 * HOOK: useLiveEdgeDebugging
 * 
 * Integra il sistema di debugging del live edge nell'applicazione
 * Fornisce accesso ai comandi di diagnostics tramite console window
 */

import { useEffect } from 'react';
import { setupLiveEdgeDebugging, validateLiveEdgeSetup } from '../lib/liveEdgeDebug';

export function useLiveEdgeDebugging(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Valida setup
    const validation = validateLiveEdgeSetup();
    
    if (!validation.valid) {
      console.warn('⚠️ Live Edge Setup Issues:');
      validation.issues.forEach(issue => console.warn('  ' + issue));
    }

    // Setup debug interface
    setupLiveEdgeDebugging();

    // Log info
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║    LIVE EDGE DEBUGGING READY - Open browser console!           ║
║    Type: liveEdgeDebug.help()                                  ║
╚════════════════════════════════════════════════════════════════╝
    `);

    // Cleanup: niente da pulire
    return () => {};
  }, [enabled]);
}
