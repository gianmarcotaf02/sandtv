import React, { useState } from 'react';
import { View } from '../types';
import { ListIcon, GridIconView, GridIcon, UploadIcon, Bars3Icon, ListBulletIcon, SunIcon, MoonIcon, UserIcon, ArrowRightOnRectangleIcon, SettingsIcon } from './icons';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  view: View;
  onViewChange: (view: View) => void;
  onReset: () => void;
  onToggleSidebar: () => void;
  onToggleChannelList: () => void;
  onToggleEpgSettings: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  user: { email: string } | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  view,
  onViewChange,
  onReset,
  onToggleSidebar,
  onToggleChannelList,
  onToggleEpgSettings,
  theme,
  onToggleTheme,
  user,
  onOpenAuth,
  onLogout,
}) => {
  const LogoImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => {
    const [src, setSrc] = useState('/logo.png');
    return (
      <img
        {...props}
        src={src}
        alt={props.alt || 'SandTV'}
        onError={() => {
          // fallback to other common filename
          if (src === '/logo.png') setSrc('/Logo.png');
        }}
      />
    );
  };
  return (
    <header className="flex-shrink-0 bg-gray-900/70 backdrop-blur-lg border-b border-white/10 p-3 flex items-center justify-between z-20 shadow-lg transition-colors duration-300">
      <div className="flex items-center space-x-2">
        {/* Hamburger menu - visible only on mobile and tablet portrait, hidden on desktop */}
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-gray-300 hover:bg-gray-700/60 lg:hidden"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
        {/* Logo */}
        <div className="flex items-center mr-2">
          {/* Try lowercase first, then fallback to capitalized filename if missing */}
          <LogoImage className="h-12 md:h-20 w-auto" />
        </div>
        <div className="hidden md:flex items-center space-x-2">
          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-xl text-white bg-gray-700/80 hover:bg-gray-600/80 flex items-center text-sm font-semibold border border-gray-600"
          >
            <UploadIcon className="w-5 h-5 mr-2" />
            Nuova Playlist
          </button>
        </div>
      </div>
      
      <div className="flex-1 px-4 md:px-8">
        <input
          type="text"
          placeholder="Cerca canali..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="bg-gray-800/60 text-white placeholder-gray-400 rounded-xl px-3 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700"
        />
      </div>

      <div className="flex items-center space-x-2">
        {user ? (
          <div className="flex items-center space-x-2">
            <span className="hidden md:inline text-sm text-gray-300">
              {user.email}
            </span>
            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-gray-300 hover:bg-gray-700/60"
              title="Esci"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="px-3 py-1.5 rounded-xl text-white bg-gray-700/80 hover:bg-gray-600/80 flex items-center text-sm font-semibold border border-gray-600"
          >
            <UserIcon className="w-5 h-5 md:mr-2" />
            <span className="hidden md:inline">Accedi / Registrati</span>
          </button>
        )}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-xl text-gray-300 hover:bg-gray-700/60"
        >
          {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>
        <button
          onClick={onToggleEpgSettings}
          className="p-2 rounded-xl text-gray-300 hover:bg-gray-700/60"
          title="Impostazioni"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
        <div className="hidden md:flex items-center space-x-2">
          <button
            onClick={() => onViewChange('LIST')}
            className={`p-2 rounded-xl ${
              view === 'LIST'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700/60'
            }`}
            title="Vista Lista"
          >
            <ListIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => onViewChange('GRID')}
            className={`p-2 rounded-xl ${
              view === 'GRID'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700/60'
            }`}
            title="Vista Griglia"
          >
            <GridIconView className="w-5 h-5" />
          </button>
          <button
            onClick={() => onViewChange('EPG')}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${
              view === 'EPG'
                ? 'bg-blue-600 text-white'
                : 'text-white bg-gray-700/80 hover:bg-gray-600/80 border border-gray-600'
            }`}
            title="Vista EPG"
          >
            ◻ EPG
          </button>
        </div>
        {/* Channel List toggle - visible on mobile and tablet, hidden on desktop */}
        <button
          onClick={onToggleChannelList}
          className="p-2 rounded-xl text-gray-300 hover:bg-gray-700/60 lg:hidden"
        >
          <ListBulletIcon className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
};

export default Header;
