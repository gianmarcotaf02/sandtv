import React, { useRef, useState } from 'react';
import PlaylistManager from './PlaylistManager';

// Inline logo component with fallback between lowercase and capitalized filename
const LogoFallback: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => {
  const [src, setSrc] = useState('/logo.png');
  return (
    <img
      {...props}
      src={src}
      alt={props.alt || 'SandTV'}
      onError={() => {
        if (src === '/logo.png') setSrc('/Logo.png');
      }}
    />
  );
};
import { UploadIcon, LinkIcon, PlayIcon, UserIcon, ArrowRightOnRectangleIcon, SettingsIcon } from './icons';

interface LandingProps {
  onLoadFromUrl: (url: string) => void;
  onLoadFromFile: (file: File) => void;
  onLoadDemo: () => void;
  isLoading: boolean;
  user: { email: string } | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenXtreamAuth?: () => void;
  onSelectPlaylist?: (m3uUrl: string, epgUrl?: string | null) => void;
  onNewPlaylist?: () => void;
}

const Landing: React.FC<LandingProps> = ({ 
  onLoadFromUrl, 
  onLoadFromFile, 
  onLoadDemo, 
  isLoading, 
  user, 
  onOpenAuth, 
  onLogout,
  onOpenXtreamAuth,
  onSelectPlaylist,
  onNewPlaylist
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const handleUrlLoad = () => {
    setShowUrlModal(true);
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onLoadFromUrl(urlInput.trim());
      setShowUrlModal(false);
      setUrlInput('');
    }
  };

  const handleModalClose = () => {
    setShowUrlModal(false);
    setUrlInput('');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onLoadFromFile(event.target.files[0]);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center h-screen text-white p-4 overflow-hidden">
      {/* Auth button - top right */}
      <div className="absolute top-4 right-4 z-20">
        {user ? (
          <div className="flex items-center gap-2 bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-2xl px-4 py-2">
            <span className="text-sm text-gray-300 hidden sm:inline">{user.email}</span>
            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-gray-300 hover:bg-gray-700/60 hover:text-white transition-all"
              title="Esci"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="bg-gray-900/70 backdrop-blur-lg border border-white/10 rounded-2xl px-4 py-2 flex items-center gap-2 hover:border-blue-500/70 hover:bg-gray-800/80 transition-all duration-300"
          >
            <UserIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Accedi / Registrati</span>
          </button>
        )}
      </div>

      {/* Animated gradient background - darker */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 animate-gradient"></div>
      
      {/* Animated blobs - darker */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-600 rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-blob animation-delay-4000"></div>
      
      {/* Grain texture overlay */}
      <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]"></div>
      
      {/* URL Modal */}
      {showUrlModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-white">Inserisci URL della playlist M3U</h2>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleUrlSubmit()}
              placeholder="https://esempio.com/playlist.m3u"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all mb-6"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleUrlSubmit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-2xl transition-all transform hover:scale-105 active:scale-95"
              >
                OK
              </button>
              <button
                onClick={handleModalClose}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-2xl transition-all transform hover:scale-105 active:scale-95"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <LogoFallback className="h-28 md:h-36 w-auto mr-6" />
            <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-gradient-x">
              SandTV
            </h1>
          </div>
          <p className="text-lg md:text-xl text-gray-300 mt-2 font-light">Il tuo streaming, a modo tuo.</p>
        </div>

      {isLoading ? (
        <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500"></div>
            <p className="mt-4 text-lg text-gray-300">Caricamento Playlist...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl w-full px-4">
            <OptionCard
              icon={<LinkIcon className="w-10 h-10 md:w-12 md:h-12" />}
              title="Carica da URL"
              description="Riproduci da qualsiasi link di playlist M3U/M3U8."
              onClick={handleUrlLoad}
            />
            <OptionCard
              icon={<UploadIcon className="w-10 h-10 md:w-12 md:h-12" />}
              title="Carica File"
              description="Usa un file locale .m3u o .m3u8 dal tuo dispositivo."
              onClick={() => fileInputRef.current?.click()}
            />
            <OptionCard
              icon={<PlayIcon className="w-10 h-10 md:w-12 md:h-12" />}
              title="Carica Demo"
              description="Prova il lettore con una playlist di esempio."
              onClick={onLoadDemo}
            />
            {onOpenXtreamAuth && (
              <OptionCard
                icon={<SettingsIcon className="w-10 h-10 md:w-12 md:h-12" />}
                title="Xtream Codes"
                description="Connettiti a un server Xtream Codes per streaming."
                onClick={onOpenXtreamAuth}
              />
            )}
          </div>
          <div className="mt-8 flex gap-4">
            {onNewPlaylist && (
              <button
                onClick={() => {
                  onNewPlaylist();
                  setShowPlaylistManager(false);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-2xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                ✚ Nuova Playlist
              </button>
            )}
            <button
              onClick={() => setShowPlaylistManager(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-2xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <SettingsIcon className="w-5 h-5" />
              Gestione Playlist
            </button>
          </div>
        </>
      )}

      {/* PlaylistManager Modal */}
      {showPlaylistManager && (
        <PlaylistManager 
          isOpen={showPlaylistManager} 
          onClose={() => setShowPlaylistManager(false)}
          onSelectPlaylist={(m3uUrl, epgUrl) => {
            onSelectPlaylist?.(m3uUrl, epgUrl);
            setShowPlaylistManager(false);
          }}
        />
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".m3u,.m3u8"
        className="hidden"
      />
      </div>
    </div>
  );
};

const OptionCard: React.FC<{ icon: React.ReactNode; title: string; description: string; onClick: () => void; }> = ({ icon, title, description, onClick }) => (
  <div
    onClick={onClick}
    className="bg-gray-900/70 backdrop-blur-lg border border-white/10 p-6 md:p-8 rounded-2xl cursor-pointer hover:border-blue-500/70 hover:bg-gray-800/80 transition-all duration-300 flex flex-col items-center text-center transform hover:scale-105"
  >
    <div className="text-blue-400 mb-4">{icon}</div>
    <h3 className="text-xl font-semibold mb-2 text-white">{title}</h3>
    <p className="text-sm text-gray-300">{description}</p>
  </div>
);

export default Landing;
