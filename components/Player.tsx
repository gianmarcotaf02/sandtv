import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Channel, EpgData } from '../types';
import { PlayIcon, PauseIcon, VolumeUpIcon, VolumeOffIcon, FullscreenEnterIcon, FullscreenExitIcon, MinimizeIcon, AspectRatioIcon, ScreenMirroringIcon } from './icons';
import { getLiveEdgeManager, LiveEdgeDiagnostics } from '../lib/liveEdgeManager';

// Dichiarazione per TypeScript
declare const Hls: any;

const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    if (hh) {
        return `${hh}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
};

const Player: React.FC<{ channel: Channel | null, epgData: EpgData, onMinimize?: () => void }> = ({ channel, epgData, onMinimize }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null); // Riferimento per HLS.js
  
  const [showOverlay, setShowOverlay] = useState(true);
  const overlayTimeoutRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  
  // Picture-in-Picture support + auto-PiP when enabled in settings
  const { settings, setPlayerState, updateSettings, player } = useStore();
  
  // ⚡ USA LO STATO GLOBALE invece dello stato locale per volume/mute
  // Questo evita che il player si resetti quando viene rimontato
  const isMuted = player.isMuted;
  const volume = player.volume;
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [objectFit, setObjectFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [isBehindLive, setIsBehindLive] = useState(false);
  const behindLiveCheckRef = useRef<number>(0);
  const liveCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastGoToLiveRef = useRef<number>(0);
  const liveEdgeManagerRef = useRef(getLiveEdgeManager({
    enableDiagnostics: true, // Abilita log per debugging
    delayThreshold: 2.5, // Mostra bottone se ritardo > 2.5 secondi
    delayThresholdLow: 1.5, // Nascondi bottone se ritardo < 1.5 secondi (isteresi)
  }));
  const lastDiagnosticsRef = useRef<LiveEdgeDiagnostics | null>(null);
  // Aspect ratio state: '16:9', '4:3' or 'auto' (no enforced aspect)
  const [aspect, setAspect] = useState<'16:9' | '4:3' | 'auto'>('16:9');
  const [showAspectMenu, setShowAspectMenu] = useState(false);
  // Hardware acceleration menu
  const [showHwAccelMenu, setShowHwAccelMenu] = useState(false);
  const aspectMenuRef = useRef<HTMLDivElement | null>(null);
  const aspectButtonRef = useRef<HTMLButtonElement | null>(null);
  const hwAccelMenuRef = useRef<HTMLDivElement | null>(null);
  const hwAccelButtonRef = useRef<HTMLButtonElement | null>(null);

  // ⚡ Inizializza il video element con lo stato dallo store al mount
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    // ⚡ LOGICA INTELLIGENTE: 
    // - Se l'utente NON ha mai unmutato → parte muted (prima volta)
    // - Se l'utente HA unmutato → usa lo stato salvato nello store
    const shouldBeMuted = settings.hasUserUnmuted ? player.isMuted : true;
    videoElement.muted = shouldBeMuted;
    videoElement.volume = player.volume;
    
    // Aggiorna lo store se necessario (solo la prima volta)
    if (!settings.hasUserUnmuted && !player.isMuted) {
      setPlayerState({ isMuted: true });
    }
  }, []); // Solo al mount

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    // Listeners per lo stato del player
    const onPlayStateChange = () => {
      setIsPlaying(!videoElement.paused);
    };
    const onVolumeChange = () => {
        // ⚡ Aggiorna lo store invece dello stato locale
        setPlayerState({ 
          isMuted: videoElement.muted,
          volume: videoElement.volume 
        });
    };
    const onTimeUpdate = () => {
        setCurrentTime(videoElement.currentTime);
        setDuration(videoElement.duration);
        
        // Non controllare se abbiamo appena cliccato "Torna al live" (blocca per 3 secondi)
        const timeSinceGoToLive = Date.now() - lastGoToLiveRef.current;
        if (timeSinceGoToLive < 3000) {
          // Dopo il click, ignora controlli per 3 secondi per evitare riapparizione durante buffering
          return;
        }
        
        // Debounce con timeout per evitare flickering
        if (liveCheckTimeoutRef.current) {
          clearTimeout(liveCheckTimeoutRef.current);
        }
        
        liveCheckTimeoutRef.current = setTimeout(() => {
          try {
            const liveEdgeManager = liveEdgeManagerRef.current;
            const diagnostics = liveEdgeManager.analyzeLiveState(
              videoElement,
              hlsRef.current
            );
            
            if (diagnostics) {
              lastDiagnosticsRef.current = diagnostics;
              
              // Usa il manager per determinare se mostrare il bottone
              const shouldShow = liveEdgeManager.shouldShowGoToLiveButton(
                diagnostics,
                isBehindLive
              );
              
              setIsBehindLive(shouldShow);
            }
          } catch (err) {
            console.error('❌ Errore nell\'analisi del live edge:', err);
            setIsBehindLive(false);
          }
        }, 500); // Debounce 500ms
    };

    videoElement.addEventListener('play', onPlayStateChange);
    videoElement.addEventListener('pause', onPlayStateChange);
    videoElement.addEventListener('playing', onPlayStateChange);
    videoElement.addEventListener('waiting', onPlayStateChange);
    videoElement.addEventListener('volumechange', onVolumeChange);
    videoElement.addEventListener('timeupdate', onTimeUpdate);
    videoElement.addEventListener('loadedmetadata', onTimeUpdate);
    
    // Set initial state
    setIsPlaying(!videoElement.paused);
    
    // Cleanup
    return () => {
      if (liveCheckTimeoutRef.current) {
        clearTimeout(liveCheckTimeoutRef.current);
      }
      videoElement.removeEventListener('play', onPlayStateChange);
      videoElement.removeEventListener('pause', onPlayStateChange);
      videoElement.removeEventListener('playing', onPlayStateChange);
      videoElement.removeEventListener('waiting', onPlayStateChange);
      videoElement.removeEventListener('volumechange', onVolumeChange);
      videoElement.removeEventListener('timeupdate', onTimeUpdate);
      videoElement.removeEventListener('loadedmetadata', onTimeUpdate);
    };
  }, [channel]);

  // Auto Picture-in-Picture - gestione unificata e ottimizzata
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleAutoPiP = async () => {
      // Verifica impostazione
      if (!settings.pipAuto) return;
      if (!document.pictureInPictureEnabled) return;
      
      console.log('📺 PiP Auto - Stato:', {
        hidden: document.hidden,
        paused: videoElement.paused,
        pipActive: !!document.pictureInPictureElement
      });
      
      try {
        // Se la scheda è nascosta E il video sta riproducendo
        if (document.hidden && !videoElement.paused) {
          // Attiva PiP se non è già attivo
          if (!document.pictureInPictureElement) {
            await videoElement.requestPictureInPicture();
            console.log('✅ PiP attivato (scheda nascosta)');
          }
        } 
        // Se la scheda è visibile E PiP è attivo
        else if (!document.hidden && document.pictureInPictureElement) {
          // Esci da PiP
          await document.exitPictureInPicture();
          console.log('✅ PiP disattivato (scheda visibile)');
        }
      } catch (error) {
        // Ignora errori (es. interazione utente richiesta)
        console.warn('⚠️ PiP errore:', error);
      }
    };

    // Listener per cambio visibilità scheda (funziona anche cambiando tab)
    document.addEventListener('visibilitychange', handleAutoPiP);

    return () => {
      document.removeEventListener('visibilitychange', handleAutoPiP);
    };
  }, [settings.pipAuto]);

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await (video as any).requestPictureInPicture();
      }
    } catch (error) {
      console.error('PiP error:', error);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => setPlayerState({ isPiPMode: true });
    const onLeave = () => setPlayerState({ isPiPMode: false });

    video.addEventListener('enterpictureinpicture', onEnter as EventListener);
    video.addEventListener('leavepictureinpicture', onLeave as EventListener);

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter as EventListener);
      video.removeEventListener('leavepictureinpicture', onLeave as EventListener);
    };
  }, [setPlayerState]);

  // Cleanup HLS on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const videoElement = videoRef.current;
    
    if (!channel || !videoElement) {
      return;
    }

    console.log('Loading channel:', channel.name, channel.url);

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Check if HLS.js is supported and needed
    if (typeof Hls !== 'undefined' && Hls.isSupported() && channel.url.includes('.m3u8')) {
      console.log('Using HLS.js');
      const hls = new Hls({
        // ⚡ CONFIGURAZIONE BASSA LATENZA - Bilanciata per velocità e stabilità
        enableWorker: true, // Web Worker per parsing parallelo
        lowLatencyMode: true, // ⚡ ABILITATO per ridurre latenza
        
        // Buffer ottimizzato per bassa latenza ma con safety margin
        backBufferLength: 10, // Buffer precedente minimo
        maxBufferLength: 15, // ⚡ Buffer ridotto a 15s (era 45s) per bassa latenza
        maxMaxBufferLength: 30, // ⚡ Max 30s invece di 90s
        maxBufferSize: 60 * 1000 * 1000, // 60 MB sufficiente per streaming live
        maxBufferHole: 0.3, // Tolleranza ridotta per reagire velocemente
        
        // ⚡ Sincronizzazione AGGRESSIVA al live edge
        liveSyncDurationCount: 2, // ⚡ SOLO 2 segmenti dal live (molto vicino!)
        liveMaxLatencyDurationCount: 6, // ⚡ Max 6 segmenti prima di risync
        liveDurationInfinity: true,
        
        // ⚡ Catchup veloce se vai indietro
        maxLiveSyncPlaybackRate: 1.15, // Accelera fino a 1.15x per recuperare
        liveSyncOnStallIncrease: 1.0, // Aumenta buffer di 1 segmento se stalla
        
        // Monitoraggio attivo per mantenere low latency
        highBufferWatchdogPeriod: 1, // ⚡ Check frequente ogni 1 secondo
        nudgeOffset: 0.1, // Aggiustamenti frequenti
        nudgeMaxRetry: 3,
        
        // Network ottimizzato: timeout ridotti ma con retry adeguati
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 500, // ⚡ Retry veloce (era 1500)
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 6,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6, // Meno retry ma più veloci
        
        // Adaptive Bitrate bilanciato per qualità/latenza
        startLevel: -1, // Auto-detect migliore qualità disponibile
        abrEwmaDefaultEstimate: 1000000, // ⚡ Stima iniziale più alta (1 Mbps)
        abrBandWidthFactor: 0.75, // Bilanciato
        abrBandWidthUpFactor: 0.7,
        abrMaxWithRealBitrate: false,
        
        // Ottimizzazioni extra per performance
        enableSoftwareAES: true,
        progressive: true,
        startFragPrefetch: true, // Pre-carica il prossimo frammento
        testBandwidth: true, // Test bandwidth iniziale
        
        // ⚡ CHIAVE: Forza a stare vicino al live edge
        backtrackAttempts: 2, // Tentativi limitati se un frammento fallisce
        maxFragLookUpTolerance: 0.25, // Tolleranza ridotta nella ricerca frammenti
      });
      
      hlsRef.current = hls;
      hls.loadSource(channel.url);
      hls.attachMedia(videoElement);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed, starting playback');
        
        // ⚡ Resume rapido: salta direttamente al live edge
        if (hlsRef.current && typeof hlsRef.current.liveSyncPosition === 'number') {
          const livePos = hlsRef.current.liveSyncPosition;
          if (livePos > 0) {
            videoElement.currentTime = livePos;
            console.log('⚡ Quick resume al live edge:', livePos);
          }
        }
        
        videoElement.play().catch((error: any) => {
          console.log('Autoplay prevented, user interaction needed:', error);
          setIsPlaying(false);
        });
      });
      
      hls.on(Hls.Events.ERROR, (event: any, data: any) => {
        console.error('HLS error:', data.type, data.details);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, attempting recovery...');
              // Attendi 2 secondi prima di ripartire per evitare loop aggressivi
              setTimeout(() => {
                if (hlsRef.current) {
                  hls.startLoad();
                }
              }, 2000);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal unrecoverable error, will retry in 5 seconds');
              // Solo in caso di errore fatale non recuperabile, attendi di più
              setTimeout(() => {
                if (hlsRef.current && channel) {
                  console.log('Attempting full stream reload...');
                  hls.destroy();
                  // Ricrea HLS con le stesse configurazioni ottimizzate
                  const newHls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: 10,
                    maxBufferLength: 15,
                    maxMaxBufferLength: 30,
                    maxBufferSize: 60 * 1000 * 1000,
                    maxBufferHole: 0.3,
                    liveSyncDurationCount: 2,
                    liveMaxLatencyDurationCount: 6,
                    liveDurationInfinity: true,
                    maxLiveSyncPlaybackRate: 1.15,
                    highBufferWatchdogPeriod: 1,
                    nudgeOffset: 0.1,
                    manifestLoadingTimeOut: 10000,
                    manifestLoadingMaxRetry: 4,
                    manifestLoadingRetryDelay: 500,
                    levelLoadingTimeOut: 10000,
                    levelLoadingMaxRetry: 6,
                    fragLoadingTimeOut: 20000,
                    fragLoadingMaxRetry: 6,
                    startLevel: -1,
                    abrBandWidthFactor: 0.75,
                    progressive: true,
                    startFragPrefetch: true,
                  });
                  hlsRef.current = newHls;
                  newHls.loadSource(channel.url);
                  newHls.attachMedia(videoElement);
                }
              }, 5000);
              break;
          }
        }
      });
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      console.log('Using native HLS support');
      videoElement.src = channel.url;
      videoElement.play().catch((error: any) => {
        console.log('Autoplay prevented, user interaction needed:', error);
        setIsPlaying(false);
      });
    } else {
      // Direct playback for other formats
      console.log('Using direct playback');
      videoElement.src = channel.url;
      videoElement.play().catch((error: any) => {
        console.log('Autoplay prevented, user interaction needed:', error);
        setIsPlaying(false);
      });
    }
  }, [channel]);


  const showAndFadeOverlay = () => {
    setShowOverlay(true);
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
    }
    overlayTimeoutRef.current = window.setTimeout(() => {
      setShowOverlay(false);
    }, 4000);
  };

  useEffect(() => {
    showAndFadeOverlay();

    const container = playerContainerRef.current;
    
    // Gestione mouse move e mouse leave
    const handleMouseMove = (e: MouseEvent) => {
      showAndFadeOverlay();
    };
    
    const handleMouseLeave = () => {
      // Nascondi overlay immediatamente quando il mouse esce dal player
      setShowOverlay(false);
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
    };
    
    container?.addEventListener('mousemove', handleMouseMove);
    container?.addEventListener('mouseleave', handleMouseLeave);
    
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    
    // iOS fullscreen events
    const video = videoRef.current;
    const onWebkitBeginFullscreen = () => setIsFullscreen(true);
    const onWebkitEndFullscreen = () => setIsFullscreen(false);
    const onWebkitPresentationModeChanged = (e: Event) => {
      const mode = (video as any)?.webkitPresentationMode;
      setIsFullscreen(mode === 'fullscreen');
    };
    
    if (video) {
      video.addEventListener('webkitbeginfullscreen', onWebkitBeginFullscreen);
      video.addEventListener('webkitendfullscreen', onWebkitEndFullscreen);
      video.addEventListener('webkitpresentationmodechanged', onWebkitPresentationModeChanged);
    }

    return () => {
      container?.removeEventListener('mousemove', handleMouseMove);
      container?.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', onWebkitBeginFullscreen);
        video.removeEventListener('webkitendfullscreen', onWebkitEndFullscreen);
        video.removeEventListener('webkitpresentationmodechanged', onWebkitPresentationModeChanged);
      }
      
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
    };
  }, [channel]);

  // Controlli Player
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Error playing video:', err);
      });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if(videoRef.current) {
        videoRef.current.volume = newVolume;
        videoRef.current.muted = newVolume === 0;
        
        // ⚡ Aggiorna lo store
        setPlayerState({ 
          volume: newVolume,
          isMuted: newVolume === 0
        });
        
        // Se l'utente aumenta il volume, salva che ha unmutato
        if (newVolume > 0 && !settings.hasUserUnmuted) {
          updateSettings({ hasUserUnmuted: true });
        }
    }
  };

  const toggleMute = () => {
    if(videoRef.current) {
      const newMuted = !videoRef.current.muted;
      videoRef.current.muted = newMuted;
      
      // ⚡ Aggiorna lo store
      setPlayerState({ isMuted: newMuted });
      
      // Se l'utente unmuta, salva la preferenza
      if (!newMuted && !settings.hasUserUnmuted) {
        updateSettings({ hasUserUnmuted: true });
      }
    }
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) videoRef.current.currentTime = parseFloat(e.target.value);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    const container = playerContainerRef.current;
    if (!video || !container) return;
    
    // Detect iOS devices
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // Use native iOS fullscreen for better integration and stability
      try {
        // Try webkitSetPresentationMode first (modern iOS)
        if (typeof (video as any).webkitSetPresentationMode === 'function') {
          const currentMode = (video as any).webkitPresentationMode;
          if (currentMode === 'fullscreen') {
            (video as any).webkitSetPresentationMode('inline');
            setIsFullscreen(false);
          } else {
            (video as any).webkitSetPresentationMode('fullscreen');
            setIsFullscreen(true);
          }
        }
        // Fallback to webkitEnterFullscreen for older iOS
        else if (typeof (video as any).webkitEnterFullscreen === 'function') {
          if ((video as any).webkitDisplayingFullscreen) {
            (video as any).webkitExitFullscreen();
            setIsFullscreen(false);
          } else {
            (video as any).webkitEnterFullscreen();
            setIsFullscreen(true);
          }
        } else {
          console.warn('iOS fullscreen not supported on this device');
        }
      } catch (err) {
        console.error('Error toggling iOS fullscreen:', err);
      }
    } else {
      // Use standard Fullscreen API for other browsers
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  const cycleObjectFit = () => {
    setObjectFit(prev => {
      if (prev === 'contain') return 'cover';
      if (prev === 'cover') return 'fill';
      return 'contain';
    });
  };

  const goToLive = async () => {
    const video = videoRef.current;
    if (!video) return;
    
    // Registra timestamp del click per bloccare controlli successivi
    lastGoToLiveRef.current = Date.now();
    
    // Cancella timeout pendente per evitare conflitti
    if (liveCheckTimeoutRef.current) {
      clearTimeout(liveCheckTimeoutRef.current);
    }
    
    // Nascondi immediatamente il pulsante
    setIsBehindLive(false);
    
    try {
      const liveEdgeManager = liveEdgeManagerRef.current;
      const diagnostics = lastDiagnosticsRef.current;
      
      // ⚡ Esegui il seek al live edge con il manager
      const success = await liveEdgeManager.seekToLiveEdge(
        video,
        diagnostics,
        hlsRef.current
      );
      
      if (success) {
        console.log('✅ Seek al live completato con successo');
      } else {
        console.warn('⚠️ Seek al live fallito, ma il video continua');
      }
    } catch (err) {
      console.error('❌ Errore durante goToLive:', err);
      // Fallback: prova comunque a riavviare il video
      video.play().catch(() => {});
    }
  };

  // Handler for hardware acceleration change
  const handleHwAccelChange = (value: 'auto' | 'disabled' | 'enabled') => {
    updateSettings({ hardwareAcceleration: value });
    setShowHwAccelMenu(false);
    // Notify user that change will take effect on next video load
    console.log(`Hardware acceleration set to: ${value} (will apply on next channel)`);
  };

  const currentProgram = useMemo(() => {
    if (!channel || !epgData[channel.tvg.id || '']) return null;
    const now = new Date();
    return epgData[channel.tvg.id || ''].find(p => now >= p.start && now <= p.stop);
  }, [channel, epgData]);

  const programProgress = useMemo(() => {
    if (!currentProgram) return 0;
    const now = new Date().getTime();
    const start = currentProgram.start.getTime();
    const stop = currentProgram.stop.getTime();
    if (now < start || now > stop) return 0;
    const progress = ((now - start) / (stop - start)) * 100;
    return Math.min(100, Math.max(0, progress));
  }, [currentProgram]);

  // Close aspect menu on outside click
  useEffect(() => {
    if (!showAspectMenu) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (aspectMenuRef.current && aspectMenuRef.current.contains(target)) return;
      if (aspectButtonRef.current && aspectButtonRef.current.contains(target)) return;
      setShowAspectMenu(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showAspectMenu]);

  // Close hardware accel menu on outside click
  useEffect(() => {
    if (!showHwAccelMenu) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (hwAccelMenuRef.current && hwAccelMenuRef.current.contains(target)) return;
      if (hwAccelButtonRef.current && hwAccelButtonRef.current.contains(target)) return;
      setShowHwAccelMenu(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showHwAccelMenu]);

  if (!channel) {
    return (
      <div className="flex-grow w-full h-full bg-black flex items-center justify-center text-gray-400">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium">Nessun Canale Selezionato</h3>
          <p className="mt-1 text-sm text-gray-500">Seleziona un canale per iniziare a guardare.</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={playerContainerRef} 
      className="flex-grow bg-black relative w-full h-full group"
      style={{ cursor: showOverlay ? 'default' : 'none' }}
    >
      {/* small inline keyframes for fade-up animation */}
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(6px) scale(.98);} to { opacity: 1; transform: translateY(0) scale(1);} }`}</style>

      <video 
        ref={videoRef} 
        autoPlay 
        muted={true}
        playsInline
        controls={false}
        preload="auto"
        crossOrigin="anonymous"
        className="w-full h-full"
        style={{ 
          objectFit, 
          aspectRatio: aspect === 'auto' ? undefined : aspect.replace(':', '/'), 
          cursor: showOverlay ? 'pointer' : 'none',
          willChange: settings.hardwareAcceleration !== 'disabled' ? 'transform' : undefined,
          transform: settings.hardwareAcceleration !== 'disabled' ? 'translateZ(0)' : undefined,
        }}
        onClick={togglePlay}
        // iOS-specific attributes for better native integration
        webkit-playsinline="true"
        x-webkit-airplay="allow"
      />
      
      {/* Screen Mirroring Button - Top Right Corner */}
      <div className={`absolute top-4 right-4 z-30 transition-opacity duration-300 ${showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button 
          onClick={async () => {
            const video = videoRef.current;
            if (!video) return;
            
            try {
              // Try different methods for casting
              
              // 1. Remote Playback API (Chromecast)
              if ('remote' in video && (video as any).remote) {
                await (video as any).remote.prompt();
                console.log('✅ Chromecast prompt opened');
                return;
              }
              
              // 2. WebKit Presentation API (AirPlay on Safari)
              if ((video as any).webkitShowPlaybackTargetPicker) {
                (video as any).webkitShowPlaybackTargetPicker();
                console.log('✅ AirPlay picker opened');
                return;
              }
              
              // 3. Presentation API (generic)
              if ('PresentationRequest' in window) {
                const request = new (window as any).PresentationRequest([channel?.url]);
                await request.start();
                console.log('✅ Presentation started');
                return;
              }
              
              // Nessun metodo supportato
              alert('⚠️ Screen mirroring non supportato su questo browser.\n\nProva con:\n- Chrome/Edge per Chromecast\n- Safari per AirPlay');
            } catch (error: any) {
              if (error.name === 'NotAllowedError') {
                console.log('❌ Utente ha annullato');
              } else if (error.name === 'NotSupportedError') {
                alert('⚠️ Nessun dispositivo di casting disponibile');
              } else {
                console.error('Errore casting:', error);
              }
            }
          }}
          className="bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white p-3 rounded-full transition-all duration-200 hover:scale-110 shadow-lg border border-white/20"
          title="Trasmetti su TV (Chromecast, AirPlay)"
        >
          <ScreenMirroringIcon className="w-6 h-6" />
        </button>
      </div>
      
      {/* Center click area: large invisible zone that toggles play/pause when clicked
          Use pointer-events so controls (which have higher z) still receive clicks */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <div
          className="w-2/3 h-2/3 pointer-events-auto"
          onClick={(e) => {
            // Prevent clicks from bubbling to other handlers
            e.stopPropagation();
            togglePlay();
          }}
          style={{ cursor: showOverlay ? 'pointer' : 'none' }}
          aria-hidden={false}
        />
      </div>
      
      {!isPlaying && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <button onClick={togglePlay} className="pointer-events-auto bg-black/50 rounded-full p-4 transition-transform transform hover:scale-110">
                    <PlayIcon className="w-16 h-16 text-white" />
                </button>
           </div>
      )}

      <div 
        className={`absolute inset-0 flex flex-col justify-end p-4 md:p-6 bg-gradient-to-t from-black via-black/70 to-transparent transition-opacity duration-300 ${showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="w-full max-w-7xl mx-auto">
            {/* EPG Info */}
            <div className="flex items-center mb-4">
                <img src={channel.logo || 'https://via.placeholder.com/80'} alt={channel.name} className="h-14 w-14 md:h-20 md:w-20 object-contain mr-4 bg-gray-700 p-1 rounded-xl flex-shrink-0" />
                <div>
                    <h2 className="text-2xl md:text-4xl font-bold truncate">{channel.name}</h2>
                    {currentProgram && (
                        <div className="mt-1">
                            <p className="text-md md:text-lg text-gray-200 truncate">{currentProgram.title}</p>
                            <p className="text-xs md:text-sm text-gray-400">
                                {currentProgram.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {currentProgram.stop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <div className="w-full bg-gray-600 rounded-full h-1 mt-2">
                                <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${programProgress}%` }}></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Controls */}
            <div className="w-full">
                { isFinite(duration) && duration > 0 && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                        <span>{formatTime(currentTime)}</span>
                        <input
                            type="range"
                            min="0"
                            max={duration}
                            value={currentTime}
                            onChange={handleSeek}
                            className="w-full h-1 bg-gray-500 rounded-2xl appearance-none cursor-pointer range-sm"
                        />
                        <span>{formatTime(duration)}</span>
                    </div>
                )}
                
                <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="text-white">
                            {isPlaying ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7" />}
                        </button>
                        <div className="flex items-center gap-2 group/volume">
                             <button onClick={toggleMute} className="text-white">
                                {isMuted || volume === 0 ? <VolumeOffIcon className="w-6 h-6" /> : <VolumeUpIcon className="w-6 h-6" />}
                             </button>
                             <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-0 group-hover/volume:w-24 h-1 bg-gray-500 rounded-2xl appearance-none cursor-pointer transition-all duration-300"
                              />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {isBehindLive && (
                        <button onClick={goToLive} className="w-9 h-9 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded-full border border-red-500" title="Torna al live" aria-label="Torna al live">
                          {/* small play icon to indicate live */}
                          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </button>
                      )}
                      {document.pictureInPictureEnabled && (
                        <button 
                          onClick={togglePiP} 
                          className="px-3 py-2 rounded-2xl bg-blue-600/90 hover:bg-blue-700 text-white text-sm font-semibold shadow-lg transition-all duration-200 flex items-center gap-1.5 border border-blue-500/50" 
                          title="Picture-in-Picture" 
                          aria-label="Picture-in-Picture"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                            <rect x="13" y="11" width="7" height="6" rx="1" fill="currentColor" />
                          </svg>
                          <span>PiP</span>
                        </button>
                      )}
                        {onMinimize && (
                            <button onClick={onMinimize} className="text-white" title="Modalità Mini Player">
                                <MinimizeIcon className="w-6 h-6" />
                            </button>
                        )}
                        
                        {/* Hardware Acceleration Menu */}
                        <div className="relative inline-block">
                          <button
                            ref={el => (hwAccelButtonRef.current = el)}
                            onClick={() => setShowHwAccelMenu(prev => !prev)}
                            className="text-white px-2 py-1 rounded-xl border border-transparent hover:border-blue-400 bg-transparent text-xs font-semibold"
                            title={`Accelerazione Hardware: ${settings.hardwareAcceleration || 'auto'}`}
                          >
                            HW: {settings.hardwareAcceleration === 'auto' ? 'AUTO' : settings.hardwareAcceleration === 'enabled' ? 'ON' : 'OFF'}
                          </button>
                          {showHwAccelMenu && (
                            <div ref={el => (hwAccelMenuRef.current = el)} className="absolute right-0 bottom-full mb-2 w-36 bg-gradient-to-br from-blue-800 to-blue-700 border border-blue-600 rounded shadow-lg z-50" style={{ animation: 'fadeUp 160ms ease-out' }}>
                              {/* arrow */}
                              <div className="absolute right-3 -bottom-2 w-3 h-3 bg-blue-800 transform rotate-45 border-l border-t border-blue-600" />
                              <button
                                onClick={() => handleHwAccelChange('auto')}
                                className={`w-full text-left px-3 py-2 hover:bg-blue-700/80 text-white ${settings.hardwareAcceleration === 'auto' ? 'bg-blue-700/50' : ''}`}
                              >
                                Auto
                              </button>
                              <button
                                onClick={() => handleHwAccelChange('enabled')}
                                className={`w-full text-left px-3 py-2 hover:bg-blue-700/80 text-white ${settings.hardwareAcceleration === 'enabled' ? 'bg-blue-700/50' : ''}`}
                              >
                                Abilitata
                              </button>
                              <button
                                onClick={() => handleHwAccelChange('disabled')}
                                className={`w-full text-left px-3 py-2 hover:bg-blue-700/80 text-white ${settings.hardwareAcceleration === 'disabled' ? 'bg-blue-700/50' : ''}`}
                              >
                                Disabilitata
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* Aspect Ratio Menu */}
                        <div className="relative inline-block">
                          <button
                            ref={el => (aspectButtonRef.current = el)}
                            onClick={() => setShowAspectMenu(prev => !prev)}
                            className="text-white px-2 py-1 rounded-xl border border-transparent hover:border-purple-400 bg-transparent"
                            title={`Formato video: ${aspect}`}
                          >
                            {aspect}
                          </button>
                          {showAspectMenu && (
                            <div ref={el => (aspectMenuRef.current = el)} className="absolute right-0 bottom-full mb-2 w-32 bg-gradient-to-br from-purple-800 to-purple-700 border border-purple-600 rounded shadow-lg z-50" style={{ animation: 'fadeUp 160ms ease-out' }}>
                              {/* arrow */}
                              <div className="absolute right-3 -bottom-2 w-3 h-3 bg-purple-800 transform rotate-45 border-l border-t border-purple-600" />
                              <button
                                onClick={() => { setAspect('16:9'); setShowAspectMenu(false); }}
                                className="w-full text-left px-3 py-2 hover:bg-purple-700/80 text-white"
                              >
                                16:9
                              </button>
                              <button
                                onClick={() => { setAspect('4:3'); setShowAspectMenu(false); }}
                                className="w-full text-left px-3 py-2 hover:bg-purple-700/80 text-white"
                              >
                                4:3
                              </button>
                              <button
                                onClick={() => { setAspect('auto'); setShowAspectMenu(false); }}
                                className="w-full text-left px-3 py-2 hover:bg-purple-700/80 text-white"
                              >
                                Auto
                              </button>
                            </div>
                          )}
                        </div>
                        <button onClick={toggleFullscreen} className="text-white">
                            {isFullscreen ? <FullscreenExitIcon className="w-6 h-6" /> : <FullscreenEnterIcon className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default Player;
