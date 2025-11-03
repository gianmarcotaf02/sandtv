import React, { useEffect, useRef, useState, useMemo } from 'react';
import Hls from 'hls.js';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, PictureInPicture, RotateCcw, Camera 
} from 'lucide-react';
import { Channel, EpgData } from '../types';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';

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

interface PlayerProps {
  channel: Channel | null;
  epgData: EpgData;
}

const PlayerAdvanced: React.FC<PlayerProps> = ({ channel, epgData }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const overlayTimeoutRef = useRef<number | null>(null);

  const [showOverlay, setShowOverlay] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<{ index: number; height: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [isBuffering, setIsBuffering] = useState(false);

  const { player, setPlayerState } = useStore();
  const { settings } = useStore();

  // Initialize HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const setupHls = () => {
      if (Hls.isSupported()) {
        const hls = new Hls({
          // ⚡ Configurazione BASSA LATENZA
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
          nudgeMaxRetry: 3,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 4,
          manifestLoadingRetryDelay: 500,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 6,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 6,
          startLevel: -1,
          abrEwmaDefaultEstimate: 1000000,
          abrBandWidthFactor: 0.75,
          abrBandWidthUpFactor: 0.7,
          progressive: true,
          startFragPrefetch: true,
          testBandwidth: true,
        });
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          const levels = data.levels.map((level, index) => ({
            index,
            height: level.height,
          }));
          setQualityLevels(levels);
          setCurrentQuality(hls.currentLevel);
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          setCurrentQuality(data.level);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Network error, trying to recover...');
                setTimeout(() => {
                  if (hlsRef.current) {
                    hls.startLoad();
                  }
                }, 2000);
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Media error, trying to recover...');
                hls.recoverMediaError();
                break;
              default:
                console.error('Fatal error, cannot recover');
                setTimeout(() => {
                  if (hlsRef.current) {
                    hls.destroy();
                    hlsRef.current = null;
                  }
                }, 1000);
                break;
            }
          }
        });

        hls.attachMedia(video);
        return hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        return null;
      }
    };

    const hls = setupHls();

    // Event listeners
    const onPlayStateChange = () => setIsPlaying(!video.paused);
    const onVolumeChange = () => {
      setIsMuted(video.muted);
      setVolume(video.volume);
      setPlayerState({ volume: video.volume, isMuted: video.muted });
    };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setDuration(video.duration);
    };
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);

    video.addEventListener('play', onPlayStateChange);
    video.addEventListener('pause', onPlayStateChange);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onTimeUpdate);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);

    return () => {
      video.removeEventListener('play', onPlayStateChange);
      video.removeEventListener('pause', onPlayStateChange);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onTimeUpdate);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      
      if (hls) {
        hls.destroy();
        hlsRef.current = null;
      }
    };
  }, [setPlayerState]);

  // Load channel
  useEffect(() => {
    const video = videoRef.current;
    const hls = hlsRef.current;
    
    if (!video || !channel) return;

    const loadChannel = async () => {
      try {
        if (hls) {
          hls.loadSource(channel.url);
          await video.play();
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = channel.url;
          await video.play();
        } else {
          video.src = channel.url;
          await video.play();
        }
        setPlayerState({ isPlaying: true });
      } catch (error) {
        console.error('Error loading channel:', error);
      }
    };

    loadChannel();
  }, [channel, setPlayerState]);

  // Overlay auto-hide
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

    return () => {
      container?.removeEventListener('mousemove', handleMouseMove);
      container?.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
    };
  }, [channel]);

  // Controls
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) videoRef.current.currentTime = parseFloat(e.target.value);
  };

  const toggleFullscreen = () => {
    const container = playerContainerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (error) {
      console.error('PiP error:', error);
    }
  };

  // Keep store in sync and auto-PiP behavior
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

  const changeQuality = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setShowSettings(false);
    }
  };

  const replay10Seconds = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    }
  };

  const takeScreenshot = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `screenshot-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  // EPG info
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
    return ((now - start) / (stop - start)) * 100;
  }, [currentProgram]);

  if (!channel) {
    return (
      <div className="flex-grow w-full h-full bg-black flex items-center justify-center text-gray-400">
        <div className="text-center">
          <Play className="mx-auto h-12 w-12 text-gray-500" />
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
      <video 
        ref={videoRef} 
        autoPlay 
        controls={false} 
        className="w-full h-full" 
        style={{ cursor: showOverlay ? 'pointer' : 'none' }}
        onClick={togglePlay} 
      />

      {/* Buffering indicator */}
      <AnimatePresence>
        {isBuffering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-16 h-16 border-4 border-t-blue-500 border-gray-700 rounded-full animate-spin"></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Play button overlay */}
      {!isPlaying && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={togglePlay}
            className="pointer-events-auto bg-black/50 backdrop-blur-sm rounded-full p-6 transition-transform hover:scale-110"
          >
            <Play className="w-16 h-16 text-white" fill="white" />
          </motion.button>
        </div>
      )}

      {/* Controls overlay */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col justify-end p-4 md:p-6 bg-gradient-to-t from-black via-black/70 to-transparent"
          >
            <div className="w-full max-w-7xl mx-auto">
              {/* EPG Info */}
              <div className="flex items-center mb-4">
                <img
                  src={channel.logo || 'https://via.placeholder.com/80'}
                  alt={channel.name}
                  className="h-14 w-14 md:h-20 md:w-20 object-contain mr-4 bg-gray-700 p-1 rounded-xl flex-shrink-0"
                />
                <div className="flex-grow">
                  <h2 className="text-2xl md:text-4xl font-bold truncate">{channel.name}</h2>
                  {currentProgram && (
                    <div className="mt-1">
                      <p className="text-md md:text-lg text-gray-200 truncate">{currentProgram.title}</p>
                      <p className="text-xs md:text-sm text-gray-400">
                        {currentProgram.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {currentProgram.stop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <div className="w-full bg-gray-600 rounded-full h-1 mt-2">
                        <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${programProgress}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {isFinite(duration) && duration > 0 && (
                <div className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
                  <span>{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    min="0"
                    max={duration}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1 bg-gray-500 rounded-2xl appearance-none cursor-pointer"
                  />
                  <span>{formatTime(duration)}</span>
                </div>
              )}

              {/* Control buttons */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <button onClick={togglePlay} className="text-white hover:scale-110 transition">
                    {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7" />}
                  </button>

                  <button onClick={replay10Seconds} className="text-white hover:scale-110 transition">
                    <RotateCcw className="w-6 h-6" />
                  </button>

                  <div className="flex items-center gap-2 group/volume">
                    <button onClick={toggleMute} className="text-white hover:scale-110 transition">
                      {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
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
                  <button onClick={takeScreenshot} className="text-white hover:scale-110 transition">
                    <Camera className="w-6 h-6" />
                  </button>

                  {document.pictureInPictureEnabled && (
                    <button onClick={togglePiP} className="text-white hover:scale-110 transition">
                      <PictureInPicture className="w-6 h-6" />
                    </button>
                  )}

                  <div className="relative">
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="text-white hover:scale-110 transition"
                    >
                      <Settings className="w-6 h-6" />
                    </button>

                    <AnimatePresence>
                      {showSettings && qualityLevels.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded-2xl shadow-xl p-2 min-w-[150px]"
                        >
                          <div className="text-sm font-semibold text-gray-300 px-2 py-1">Qualità</div>
                          <button
                            onClick={() => changeQuality(-1)}
                            className={`w-full text-left px-2 py-1 rounded hover:bg-gray-700 text-sm ${
                              currentQuality === -1 ? 'text-blue-400' : 'text-white'
                            }`}
                          >
                            Auto
                          </button>
                          {qualityLevels.map((level) => (
                            <button
                              key={level.index}
                              onClick={() => changeQuality(level.index)}
                              className={`w-full text-left px-2 py-1 rounded hover:bg-gray-700 text-sm ${
                                currentQuality === level.index ? 'text-blue-400' : 'text-white'
                              }`}
                            >
                              {level.height}p
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button onClick={toggleFullscreen} className="text-white hover:scale-110 transition">
                    {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PlayerAdvanced;
