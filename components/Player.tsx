import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Channel, EpgData } from '../types';
import { PlayIcon, PauseIcon, VolumeUpIcon, VolumeOffIcon, FullscreenEnterIcon, FullscreenExitIcon, MinimizeIcon, AspectRatioIcon, ScreenMirroringIcon } from './icons';

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
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [objectFit, setObjectFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [isBehindLive, setIsBehindLive] = useState(false);
  const behindLiveCheckRef = useRef<number>(0); // Per stabilizzare il controllo
  const liveCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout per debounce
  const lastGoToLiveRef = useRef<number>(0); // Timestamp ultimo click "Torna al live"
  // Aspect ratio state: '16:9', '4:3' or 'auto' (no enforced aspect)
  const [aspect, setAspect] = useState<'16:9' | '4:3' | 'auto'>('16:9');
  const [showAspectMenu, setShowAspectMenu] = useState(false);
  // Hardware acceleration menu
  const [showHwAccelMenu, setShowHwAccelMenu] = useState(false);
  // Threshold used to determine if playback is behind live
  const LIVE_BEHIND_THRESHOLD = 5; // seconds - appears only if delay > 5s
  const aspectMenuRef = useRef<HTMLDivElement | null>(null);
  const aspectButtonRef = useRef<HTMLButtonElement | null>(null);
  const hwAccelMenuRef = useRef<HTMLDivElement | null>(null);
  const hwAccelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    // Listeners per lo stato del player
    const onPlayStateChange = () => {
      setIsPlaying(!videoElement.paused);
    };
    const onVolumeChange = () => {
        setIsMuted(videoElement.muted);
        setVolume(videoElement.volume);
    };
    const onTimeUpdate = () => {
        setCurrentTime(videoElement.currentTime);
        setDuration(videoElement.duration);
        
        // Non controllare se abbiamo appena cliccato "Torna al live" (blocca per 10 secondi)
        const timeSinceGoToLive = Date.now() - lastGoToLiveRef.current;
        if (timeSinceGoToLive < 10000) {
          // Dopo il click, ignora controlli per 10 secondi per evitare riapparizione durante buffering
          return;
        }
        
        // Debounce con timeout per evitare flickering
        if (liveCheckTimeoutRef.current) {
          clearTimeout(liveCheckTimeoutRef.current);
        }
        
        liveCheckTimeoutRef.current = setTimeout(() => {
          try {
            // Determine if we're behind live by checking seekable end
            if (videoElement.seekable && videoElement.seekable.length > 0) {
              const last = videoElement.seekable.length - 1;
              const end = videoElement.seekable.end(last);
              const delay = end - videoElement.currentTime;
              // Mostra solo se > 5s, nascondi se < 4s (con isteresi)
              if (delay > LIVE_BEHIND_THRESHOLD) {
                setIsBehindLive(true);
              } else if (delay < 4) {
                setIsBehindLive(false);
              }
              // Tra 4-5 secondi mantiene lo stato corrente
            } else {
              setIsBehindLive(false);
            }
          } catch (err) {
            setIsBehindLive(false);
          }
        }, 300); // Attendi 300ms di stabilità prima di cambiare stato
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

  // Picture-in-Picture support + auto-PiP when enabled in settings
  const { settings, setPlayerState, updateSettings } = useStore();

  // Auto Picture-in-Picture quando cambi scheda/finestra
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleVisibilityChange = async () => {
      // Usa l'impostazione dal settings store
      if (!settings.pipAuto) return;
      
      try {
        // Se la scheda diventa nascosta e il video sta riproducendo
        if (document.hidden && !videoElement.paused) {
          // Attiva PiP se supportato
          if (document.pictureInPictureEnabled && !document.pictureInPictureElement) {
            await videoElement.requestPictureInPicture();
            console.log('📺 PiP attivato automaticamente');
          }
        } 
        // Se la scheda diventa visibile, esci da PiP
        else if (!document.hidden && document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          console.log('📺 PiP disattivato - scheda visibile');
        }
      } catch (error) {
        console.log('PiP non disponibile:', error);
      }
    };

    // Listener per cambio visibilità scheda
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
  }, [videoRef.current]);

  // Auto PiP on visibility change / blur if setting enabled
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleAutoPiP = async () => {
      if (!settings.pipAuto) return;
      if (!document.pictureInPictureEnabled) return;
      
      try {
        if (document.hidden || !document.hasFocus()) {
          // Attiva PiP solo se il video è in riproduzione (non in pausa)
          if (!video.paused && !document.pictureInPictureElement) {
            await (video as any).requestPictureInPicture();
          }
        } else {
          // Esci da PiP quando torni alla scheda
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          }
        }
      } catch (err) {
        // ignore
      }
    };

    document.addEventListener('visibilitychange', handleAutoPiP);
    window.addEventListener('blur', handleAutoPiP);

    return () => {
      document.removeEventListener('visibilitychange', handleAutoPiP);
      window.removeEventListener('blur', handleAutoPiP);
    };
  }, [settings.pipAuto, videoRef.current]);

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
        // Configurazione bilanciata per prestazioni e stabilità
        enableWorker: true, // Usa Web Worker per parsing
        lowLatencyMode: false, // Disabilitato per maggiore stabilità
        
        // Buffer bilanciato per evitare microblocchi
        backBufferLength: 10, // Buffer precedente 10 secondi
        maxBufferLength: 30, // Buffer massimo 30 secondi (aumentato per stabilità)
        maxMaxBufferLength: 60, // Buffer massimo assoluto 60 secondi
        maxBufferSize: 120 * 1000 * 1000, // 120 MB max buffer size
        maxBufferHole: 0.5, // Tolleranza gap nel buffer
        
        // Sincronizzazione live più tollerante
        liveSyncDurationCount: 3, // Mantieni 3 segmenti dal live edge
        liveMaxLatencyDurationCount: 10, // Max 10 segmenti (più tollerante)
        liveDurationInfinity: true,
        
        // Monitoraggio meno aggressivo
        highBufferWatchdogPeriod: 2, // Check buffer ogni 2 secondi
        nudgeOffset: 0.1, // Piccoli aggiustamenti per sync
        nudgeMaxRetry: 3,
        
        // Network con timeout più generosi
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1000, // Attesa più lunga tra retry
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 6,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 8,
        
        // Adaptive Bitrate più conservativo
        startLevel: -1, // Auto-detect best quality
        abrEwmaDefaultEstimate: 500000, // 500 kbps stima iniziale
        abrBandWidthFactor: 0.8, // Più conservativo per evitare rebuffering
        abrBandWidthUpFactor: 0.7, 
        abrMaxWithRealBitrate: false,
        
        // Abilita fast switching
        enableSoftwareAES: true,
      });
      
      hlsRef.current = hls;
      hls.loadSource(channel.url);
      hls.attachMedia(videoElement);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed, starting playback');
        videoElement.play().catch((error: any) => {
          console.log('Autoplay prevented, user interaction needed:', error);
          setIsPlaying(false);
        });
      });
      
      // Log buffering events per debug
      hls.on(Hls.Events.BUFFER_APPENDING, () => {
        console.log('Buffer appending...');
      });
      
      hls.on(Hls.Events.BUFFER_APPENDED, () => {
        console.log('Buffer appended');
      });
      
      hls.on(Hls.Events.FRAG_BUFFERED, (event: any, data: any) => {
        console.log('Fragment buffered:', data.stats);
      });
      
      hls.on(Hls.Events.ERROR, (event: any, data: any) => {
        console.error('HLS error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, attempting recovery...');
              // Attendi 1 secondo prima di ripartire per evitare loop
              setTimeout(() => {
                if (hlsRef.current) {
                  hls.startLoad();
                }
              }, 1000);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, attempting recovery...');
              hls.recoverMediaError();
              // Se fallisce di nuovo, prova a ricaricare dopo 2 secondi
              setTimeout(() => {
                if (hlsRef.current && videoElement.error) {
                  console.log('Second recovery attempt...');
                  hls.recoverMediaError();
                }
              }, 2000);
              break;
            default:
              console.error('Fatal unrecoverable error');
              // Prova comunque a ricaricare lo stream dopo 3 secondi
              setTimeout(() => {
                if (hlsRef.current) {
                  console.log('Attempting full reload...');
                  hls.destroy();
                  const newHls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: false,
                    backBufferLength: 10,
                    maxBufferLength: 30,
                  });
                  hlsRef.current = newHls;
                  newHls.loadSource(channel.url);
                  newHls.attachMedia(videoElement);
                }
              }, 3000);
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
    const onWebkitFullscreenChange = () => {
      const isInFullscreen = (video as any)?.webkitDisplayingFullscreen;
      setIsFullscreen(!!isInFullscreen);
    };
    
    if (video) {
      video.addEventListener('webkitbeginfullscreen', () => setIsFullscreen(true));
      video.addEventListener('webkitendfullscreen', () => setIsFullscreen(false));
    }

    return () => {
      container?.removeEventListener('mousemove', handleMouseMove);
      container?.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', () => setIsFullscreen(true));
        video.removeEventListener('webkitendfullscreen', () => setIsFullscreen(false));
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
    }
  };

  const toggleMute = () => {
    if(videoRef.current) videoRef.current.muted = !videoRef.current.muted;
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
      if ((video as any).webkitEnterFullscreen) {
        try {
          (video as any).webkitEnterFullscreen();
          setIsFullscreen(true);
        } catch (err) {
          console.error('Error entering iOS fullscreen:', err);
        }
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

  const goToLive = () => {
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
      // If seekable ranges exist, jump to the end (live) minus a small buffer
      if (video.seekable && video.seekable.length > 0) {
        const last = video.seekable.length - 1;
        const end = video.seekable.end(last);
        // Move very close to live edge (small safety buffer)
        video.currentTime = Math.max(0, end - 0.5);
        // Ensure playback resumes
        video.play().catch(() => {});
        return;
      }
      // Fallback: if hls exposes liveSyncPosition
      if ((hlsRef as any).current && (hlsRef as any).current.liveSyncPosition !== undefined) {
        const pos = (hlsRef as any).current.liveSyncPosition;
        if (pos !== undefined && !isNaN(pos)) {
          // place at the reported live sync position
          video.currentTime = pos;
          video.play().catch(() => {});
          return;
        }
      }
      // Final fallback: just resume playback
      video.play().catch(() => {});
    } catch (err) {
      console.warn('goToLive error', err);
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
