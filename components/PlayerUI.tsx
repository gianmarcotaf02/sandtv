import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Channel, EpgData, View, Group } from '../types';
import Sidebar from './Sidebar';
import ChannelList from './ChannelList';
import Player from './Player';
import EpgView from './EpgView';
import GridView from './GridView';
import MiniPlayer from './MiniPlayer';
import EpgSettings from './EpgSettings';
import Header from './Header';
import Modal from './Modal';
import ChannelSelectionModal from './ChannelSelectionModal';
import AuthModal from './AuthModal';
import { useStore } from '../store/useStore';
import { useAuth } from '../hooks/useAuth';

function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

interface PlayerUIProps {
    channels: Channel[];
    epgData: EpgData;
    onReset: () => void; // Function to go back to landing page
    onLoadEpg?: (url: string) => void; // Function to load new EPG
    onRefreshEpg?: () => void; // Function to refresh EPG
    currentEpgUrl?: string; // Current EPG URL
}

const PlayerUI: React.FC<PlayerUIProps> = ({ 
  channels, 
  epgData, 
  onReset, 
  onLoadEpg = () => {}, 
  onRefreshEpg = () => {},
  currentEpgUrl = ''
}) => {
  const { settings, updateSettings } = useStore();
  const { user, logout, saveCustomGroups, loadCustomGroups } = useAuth();
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<View>('LIST');
  
  const [favorites, setFavorites] = useLocalStorage<string[]>('iptv_favorites', []);
  const [customGroups, setCustomGroups] = useState<Group[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [isChannelSelectionOpen, setIsChannelSelectionOpen] = useState(false);
  const [selectedChannelsForGroup, setSelectedChannelsForGroup] = useState<string[]>([]);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // State for mobile panel visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChannelListOpen, setIsChannelListOpen] = useState(false);
  const [isEpgSettingsOpen, setIsEpgSettingsOpen] = useState(false);
  
  // State for mini player
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [lastClickedChannel, setLastClickedChannel] = useState<string | null>(null);

  // Apply theme to document
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  const toggleTheme = () => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  // Load custom groups from Firebase when user changes
  useEffect(() => {
    const loadGroups = async () => {
      setIsLoadingGroups(true);
      if (user) {
        const savedGroups = await loadCustomGroups();
        if (savedGroups) {
          setCustomGroups(savedGroups);
        }
      }
      setIsLoadingGroups(false);
    };
    
    loadGroups();
  }, [user]);

  // Save groups to Firebase whenever they change
  useEffect(() => {
    const saveGroups = async () => {
      // Only save if user is logged in, not loading, and has actually modified groups
      if (user && !isLoadingGroups && customGroups.length > 0) {
        try {
          await saveCustomGroups(customGroups);
          console.log('✅ Gruppi personalizzati salvati nell\'account');
        } catch (error) {
          console.error('❌ Errore salvataggio gruppi:', error);
        }
      }
    };

    // Delay to avoid saving while loading
    const timer = setTimeout(saveGroups, 500);
    return () => clearTimeout(timer);
  }, [customGroups, user, isLoadingGroups]);


  const toggleFavorite = (channelId: string) => {
    setFavorites(prev => 
      prev.includes(channelId) 
        ? prev.filter(id => id !== channelId) 
        : [...prev, channelId]
    );
  };
  
  const groups = useMemo(() => {
    const allChannelsGroup = { id: 'all', name: 'Tutti i Canali' };
    const favoritesGroup = { id: 'favorites', name: 'Preferiti' };
    const channelGroups = [...new Set(channels.map(c => c.group))].sort().map(g => ({ id: g, name: g }));
    return [allChannelsGroup, favoritesGroup, ...channelGroups];
  }, [channels]);

  const filteredChannels = useMemo(() => {
    let activeChannels = channels;

    if (selectedGroup === 'favorites') {
        activeChannels = channels.filter(c => favorites.includes(c.id));
    } else if (customGroups.some(g => g.id === selectedGroup)) {
        const group = customGroups.find(g => g.id === selectedGroup);
        const channelIds = group?.channels || [];
        activeChannels = channels.filter(c => channelIds.includes(c.id));
    } else if (selectedGroup !== 'all') {
        activeChannels = channels.filter(c => c.group === selectedGroup);
    }

    if (searchQuery) {
        return activeChannels.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return activeChannels;
  }, [channels, selectedGroup, searchQuery, favorites, customGroups]);

  const openAddGroupModal = () => {
    setIsModalOpen(true);
    setEditingGroup(null);
    setGroupName('');
  };

  const openEditGroupModal = (group: Group) => {
    setIsModalOpen(true);
    setEditingGroup(group);
    setGroupName(group.name);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (window.confirm("Sei sicuro di voler eliminare questo gruppo?")) {
        setCustomGroups(prev => prev.filter(g => g.id !== groupId));
        if (selectedGroup === groupId) {
            setSelectedGroup('all');
        }
    }
  };
  
  const handleSaveGroup = () => {
    if (!groupName.trim()) return;

    if (editingGroup) { 
      // Editing existing group - just update name
      setCustomGroups(prev => prev.map(g => g.id === editingGroup.id ? { ...g, name: groupName } : g));
      setIsModalOpen(false);
    } else { 
      // Creating new group - show channel selection
      setIsChannelSelectionOpen(true);
    }
  };

  const handleChannelSelectionConfirm = (selectedIds: string[]) => {
    const newGroup: Group = {
      id: `custom_${Date.now()}`,
      name: groupName,
      channels: selectedIds
    };
    setCustomGroups(prev => [...prev, newGroup]);
    setIsModalOpen(false);
    setIsChannelSelectionOpen(false);
    setGroupName('');
    setSelectedChannelsForGroup([]);
  };
  
  const addChannelToGroup = useCallback((channel: Channel) => {
     const customGroup = customGroups.find(g => g.id === selectedGroup);
     if(customGroup && !customGroup.channels.includes(channel.id)) {
        setCustomGroups(prev => prev.map(g => 
            g.id === selectedGroup ? {...g, channels: [...g.channels, channel.id]} : g
        ));
     }
  }, [customGroups, selectedGroup, setCustomGroups]);
  
  // Select first channel on initial load
  useEffect(() => {
    if(channels.length > 0 && !currentChannel) {
        setCurrentChannel(channels[0]);
    }
  }, [channels, currentChannel]);
  
  // Close mini player when switching away from GRID view
  useEffect(() => {
    if (view !== 'GRID') {
      setShowMiniPlayer(false);
    }
  }, [view]);
  
  const handleSelectChannel = (channel: Channel) => {
      const now = Date.now();
      const isDoubleClick = lastClickedChannel === channel.id && (now - lastClickTime) < 500;
      
      setCurrentChannel(channel);
      setIsChannelListOpen(false); // Close panel on selection
      
      if (isDoubleClick) {
        // Double click: open full player
        setShowMiniPlayer(false);
        if (view === 'GRID') {
          setView('LIST');
        }
      } else {
        // Single click: show mini player ONLY in GRID view
        if (view === 'GRID') {
          setShowMiniPlayer(true);
        }
        setLastClickTime(now);
        setLastClickedChannel(channel.id);
      }
  }
  
  const handleSelectGroup = (groupId: string) => {
      setSelectedGroup(groupId);
      setIsSidebarOpen(false); // Close panel on selection
  }

  const handleLogout = async () => {
    await logout();
    onReset(); // Torna alla landing page dopo il logout
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white flex flex-col overflow-hidden transition-colors duration-300">
      {/* Animated blobs background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>
      
      <div className="relative z-10 flex flex-col h-full">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        view={view}
        onViewChange={setView}
        onReset={onReset}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onToggleChannelList={() => setIsChannelListOpen(!isChannelListOpen)}
        onToggleEpgSettings={() => setIsEpgSettingsOpen(!isEpgSettingsOpen)}
        theme={settings.theme}
        onToggleTheme={toggleTheme}
        user={user}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />
      <div className="flex flex-grow relative overflow-hidden">
        {/* Mobile Overlay - Only on mobile and tablet */}
        {(isSidebarOpen || isChannelListOpen || isEpgSettingsOpen) && (
            <div
              className="fixed inset-0 bg-black/60 z-20 lg:hidden"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsChannelListOpen(false);
                setIsEpgSettingsOpen(false);
              }}
            />
        )}

        {/* Sidebar - Hidden on tablet portrait, visible on desktop */}
        <div className={`fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 h-full ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <Sidebar
              groups={groups}
              customGroups={customGroups}
              selectedGroup={selectedGroup}
              onSelectGroup={handleSelectGroup}
              onAddGroup={openAddGroupModal}
              onEditGroup={openEditGroupModal}
              onDeleteGroup={handleDeleteGroup}
              channels={filteredChannels}
            />
        </div>
        
        <main className="flex-grow flex flex-col overflow-hidden">
          <div className="flex-grow flex overflow-hidden">
            {view === 'LIST' ? (
              <div className="flex-grow flex overflow-hidden relative">
                {!showMiniPlayer && (
                  <Player 
                    channel={currentChannel} 
                    epgData={epgData}
                    onMinimize={() => setShowMiniPlayer(true)}
                  />
                )}
                {showMiniPlayer && (
                  <div className="flex-grow bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                    <div className="text-center text-gray-500 dark:text-gray-400">
                      <p className="text-lg">Riproduzione in Mini Player</p>
                      <p className="text-sm mt-2">Il player è ridotto in basso a sinistra</p>
                    </div>
                  </div>
                )}
                {/* Channel List - Fixed overlay on tablet portrait, static on desktop */}
                <div className={`fixed top-14 bottom-0 right-0 z-30 transform transition-transform duration-300 ease-in-out bg-gray-100/95 dark:bg-gray-900/50 backdrop-blur-lg border-l border-gray-300 dark:border-white/10 lg:static lg:top-0 lg:translate-x-0 lg:bg-transparent lg:backdrop-blur-none lg:border-l-0 ${isChannelListOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <ChannelList
                      channels={filteredChannels}
                      currentChannel={currentChannel}
                      favorites={favorites}
                      onSelectChannel={handleSelectChannel}
                      onToggleFavorite={toggleFavorite}
                      onAddToGroup={addChannelToGroup}
                      isCustomGroup={customGroups.some(g => g.id === selectedGroup)}
                      epgData={epgData}
                    />
                </div>
              </div>
            ) : view === 'GRID' ? (
              <GridView 
                channels={filteredChannels} 
                currentChannel={currentChannel}
                onSelectChannel={handleSelectChannel}
                epgData={epgData}
              />
            ) : (
              <EpgView channels={filteredChannels} epg={epgData} onSelectChannel={handleSelectChannel} />
            )}
          </div>
        </main>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingGroup ? 'Modifica Gruppo' : 'Crea Gruppo'}>
          <div className="space-y-4">
              <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nome Gruppo"
                  className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-300"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveGroup()}
              />
              <div className="flex justify-end space-x-2">
                  <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded-xl hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors">Annulla</button>
                  <button onClick={handleSaveGroup} className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors">Salva</button>
              </div>
          </div>
      </Modal>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
      />

      <ChannelSelectionModal
        isOpen={isChannelSelectionOpen}
        onClose={() => {
          setIsChannelSelectionOpen(false);
          setSelectedChannelsForGroup([]);
        }}
        channels={channels}
        onConfirm={handleChannelSelectionConfirm}
        title={`Aggiungi Canali a "${groupName}"`}
        preSelectedIds={selectedChannelsForGroup}
      />

      {/* EPG Settings Panel */}
      {isEpgSettingsOpen && (
        <>
          {/* Overlay per chiudere cliccando fuori - mobile and tablet only */}
          <div 
            className="fixed inset-0 bg-black/30 z-30 lg:hidden backdrop-blur-sm"
            onClick={() => setIsEpgSettingsOpen(false)}
          />
          <div className="fixed top-14 right-0 bottom-0 z-40 transform transition-transform duration-300 ease-in-out shadow-xl">
            <EpgSettings
              currentEpgUrl={currentEpgUrl}
              onLoadEpg={onLoadEpg}
              onRefreshEpg={onRefreshEpg}
              onClose={() => setIsEpgSettingsOpen(false)}
            />
          </div>
        </>
      )}

      {/* Mini Player - shown when a channel is selected in GRID view, or optionally in LIST view */}
      {showMiniPlayer && currentChannel && (
        <MiniPlayer
          channel={currentChannel}
          epgData={epgData}
          onClose={() => {
            setShowMiniPlayer(false);
            if (view === 'GRID') {
              setCurrentChannel(null);
            }
          }}
          onExpand={() => {
            setShowMiniPlayer(false);
            if (view !== 'LIST') {
              setView('LIST');
            }
          }}
        />
      )}
      </div>
    </div>
  );
};

export default PlayerUI;
