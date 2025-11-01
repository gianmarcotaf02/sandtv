import React, { useEffect, useRef, useState } from 'react';
import { Channel, EpgData } from '../types';
import { PlayIcon, PauseIcon, VolumeUpIcon, VolumeOffIcon, XIcon, ExpandIcon } from './icons';

// Dichiarazione per TypeScript
declare const Hls: any;

interface MiniPlayerProps {
  channel: Channel | null;
  epgData: EpgData;
  onClose: () => void;
  onExpand: () => void;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({ channel, epgData, onClose, onExpand }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  // Setup video and HLS
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const onPlayStateChange = () => {
      setIsPlaying(!videoElement.paused);
    };

    videoElement.addEventListener('play', onPlayStateChange);
    videoElement.addEventListener('pause', onPlayStateChange);

    return () => {
      videoElement.removeEventListener('play', onPlayStateChange);
      videoElement.removeEventListener('pause', onPlayStateChange);
    };
  }, [channel]);

  // Load channel
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!channel || !videoElement) return;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (typeof Hls !== 'undefined' && Hls.isSupported() && channel.url.includes('.m3u8')) {
      const hls = new Hls({
        // Configurazione per bassa latenza
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 10,
        maxBufferLength: 20,
        maxMaxBufferLength: 30,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 5,
        liveDurationInfinity: true,
        highBufferWatchdogPeriod: 1,
      });
      
      hlsRef.current = hls;
      hls.loadSource(channel.url);
      hls.attachMedia(videoElement);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoElement.play().catch(() => {});
      });
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = channel.url;
      videoElement.play().catch(() => {});
    } else {
      videoElement.src = channel.url;
      videoElement.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  if (!channel) return null;

  const currentProgram = epgData[channel.tvg.id || '']?.find(p => {
    const now = new Date();
    return now >= p.start && now <= p.stop;
  });

  return (
    <div
      className="fixed bottom-4 left-4 z-40 bg-gray-900 rounded-2xl shadow-2xl overflow-hidden w-80 md:w-96"
    >
      {/* Header */}
      <div className="bg-gray-800 px-3 py-2 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {channel.logo && (
            <img src={channel.logo} alt={channel.name} className="w-6 h-6 object-contain flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white truncate">{channel.name}</h3>
            {currentProgram && (
              <p className="text-xs text-gray-400 truncate">{currentProgram.title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onExpand}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Espandi"
          >
            <ExpandIcon className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Chiudi"
          >
            <XIcon className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>

      {/* Video */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted={false}
          playsInline
          controls={false}
          className="w-full h-full"
        />
        
        {/* Controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              {isPlaying ? 
                <PauseIcon className="w-5 h-5 text-white" /> : 
                <PlayIcon className="w-5 h-5 text-white" />
              }
            </button>
            <button
              onClick={toggleMute}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              {isMuted ? 
                <VolumeOffIcon className="w-5 h-5 text-white" /> : 
                <VolumeUpIcon className="w-5 h-5 text-white" />
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MiniPlayer;
