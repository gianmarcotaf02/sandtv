import React, { useCallback, useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Landing from './components/Landing';
import PlayerUI from './components/PlayerUI';
import AuthModal from './components/AuthModal';
import XtreamAuthModal from './components/XtreamAuthModal';
import ErrorBoundary from './components/ErrorBoundary';
import { useStore } from './store/useStore';
import { useM3UParser, useXMLTVParser } from './hooks/useParser';
import { useAuth } from './hooks/useAuth';
import { useXtreamParser } from './hooks/useXtreamParser';
import { useLiveEdgeDebugging } from './hooks/useLiveEdgeDebugging';
import { db } from './lib/db';

// Demo M3U content
const DEMO_M3U_CONTENT = `#EXTM3U url-tvg="http://example.com/epg.xml"
#EXTINF:-1 tvg-id="CNN.us" tvg-name="CNN" tvg-logo="https://i.imgur.com/k2sPgeh.png" group-title="News",CNN
https://cnn-cnninternational-1-eu.rakuten.wurl.com/manifest/playlist.m3u8
#EXTINF:-1 tvg-id="Bloomberg.us" tvg-name="Bloomberg TV" tvg-logo="https://i.imgur.com/c3VwJdD.png" group-title="News",Bloomberg TV
https://bloomberg-bloomberg-1-eu.rakuten.wurl.com/manifest/playlist.m3u8
#EXTINF:-1 tvg-id="NASA.us" tvg-name="NASA TV" tvg-logo="https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg" group-title="Documentaries",NASA TV
https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8
#EXTINF:-1 tvg-id="RedBullTV.com" tvg-name="Red Bull TV" tvg-logo="https://i.imgur.com/7kRxfMn.png" group-title="Sports",Red Bull TV
https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8
#EXTINF:-1 tvg-id="FashionTV.fr" tvg-name="Fashion TV" tvg-logo="https://i.imgur.com/Y2aRuK7.png" group-title="Lifestyle",Fashion TV
https://fashiontv-fashiontv-1-eu.rakuten.wurl.com/manifest/playlist.m3u8
`;

const App: React.FC = () => {
  const { playlist, setChannels, setEpgData, setEpgUrl, setM3uUrl, resetPlaylist, isLoading, setIsLoading } = useStore();
  const { parseM3U } = useM3UParser();
  const { parseXMLTV } = useXMLTVParser();
  const { user, loadPlaylist, savePlaylist, logout, saveUserData, loadUserData } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isXtreamAuthModalOpen, setIsXtreamAuthModalOpen] = useState(false);
  const [skipAutoLoadPlaylist, setSkipAutoLoadPlaylist] = useState(false);

  // 🔧 Integrazione debugging live edge (abilitato in development)
  useLiveEdgeDebugging(process.env.NODE_ENV === 'development');

  // Handle logout with playlist reset
  const handleLogout = async () => {
    await logout();
    resetPlaylist(); // Reset playlist after logout
    setSkipAutoLoadPlaylist(false); // Reset skip flag
  };

  // Initialize database
  useEffect(() => {
    db.clearExpiredEpg();
  }, []);

  // When user logs in, load stored preferences (favorites, settings, customGroups, watchHistory)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) return;
      try {
        const data = await loadUserData();
        if (cancelled || !data) return;
        // Merge loaded data into store
  const { favorites, customGroups, watchHistory, settings } = data;
  // Use zustand store API to set values when present
  if (Array.isArray(favorites)) useStore.getState().setFavorites(favorites);
  if (Array.isArray(customGroups)) useStore.getState().setCustomGroups(customGroups);
  if (Array.isArray(watchHistory)) useStore.getState().setWatchHistory(watchHistory);
  if (settings) useStore.getState().updateSettings(settings);
        console.log('✅ Dati utente caricati dall\'account');
      } catch (err) {
        console.error('Error loading user data on login:', err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]); // Rimosso loadUserData dalle dipendenze per evitare loop

  // Subscribe to store changes and persist to user doc (debounced)
  useEffect(() => {
    if (!user) return;
    
    let timeout: any = null;
    let lastSaved = JSON.stringify({});
    
    const unsub = useStore.subscribe((state) => {
      const payload = {
        favorites: state.favorites,
        customGroups: state.customGroups,
        watchHistory: state.watchHistory,
        settings: state.settings,
      };
      
      const current = JSON.stringify(payload);
      if (current === lastSaved) return; // Skip if nothing changed
      
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        try {
          await saveUserData(payload);
          lastSaved = current;
          console.log('✅ Impostazioni e gruppi salvati nell\'account');
        } catch (err) {
          console.error('❌ Errore auto-salvataggio dati utente:', err);
        }
      }, 1000); // Aumentato debounce a 1 secondo
    });
    return () => {
      if (timeout) clearTimeout(timeout);
      unsub();
    };
  }, [user, saveUserData]);

  const handleDataLoad = useCallback(
    async (content: string, m3uUrl?: string) => {
      setIsLoading(true);
      setSkipAutoLoadPlaylist(false); // Allow auto-load after successful playlist load
      const loadingToast = toast.loading('Caricamento playlist...');

      try {
        // Parse M3U in Web Worker
        const { channels: parsedChannels, epgUrl } = await parseM3U(content);
        
        console.log('📺 M3U Parsed:', {
          channelsFound: parsedChannels.length,
          epgUrlFound: epgUrl,
          firstChannel: parsedChannels[0]
        });
        
        if (parsedChannels.length === 0) {
          throw new Error('Nessun canale trovato nella playlist');
        }

        setChannels(parsedChannels);
        setEpgUrl(epgUrl);
        if (m3uUrl) {
          setM3uUrl(m3uUrl);
        }
        
        toast.success(`${parsedChannels.length} canali caricati!`, { id: loadingToast });

        // Save to Firebase if user is logged in (silently, no toast)
        if (user && m3uUrl) {
          try {
            await savePlaylist(m3uUrl, epgUrl);
          } catch (error) {
            console.error('Error saving playlist:', error);
          }
        }

        // Load EPG if available
        if (epgUrl) {
          console.log('🔍 EPG URL trovato, inizio caricamento:', epgUrl);
          const epgToast = toast.loading('Caricamento guida EPG...');
          try {
            // Always clear cache and fetch fresh EPG for now
            console.log('🗑️ Pulizia cache EPG e scaricamento dati freschi...');
            await db.clearAllEpg();
            
            // Fetch new EPG with cache busting
            const workerUrl = 'https://sandtv-proxy.sandtv.workers.dev';
            const cacheBuster = `&t=${Date.now()}`;
            const proxyUrl = `${workerUrl}?url=${encodeURIComponent(epgUrl)}${cacheBuster}`;
            
            console.log('📡 Richiesta EPG via proxy (cache-busting):', proxyUrl);
            
            const epgResponse = await fetch(proxyUrl, {
              signal: AbortSignal.timeout(30000),
              cache: 'no-store'
            });
            
            if (!epgResponse.ok) {
              throw new Error(`EPG fetch failed: ${epgResponse.statusText}`);
            }

            const epgContent = await epgResponse.text();
            console.log('✅ EPG scaricata, dimensione:', epgContent.length, 'bytes');
            console.log('📄 Inizio parsing EPG...');
            
            const epgData = await parseXMLTV(epgContent);
            console.log('✅ EPG parsata con successo!');
            console.log('📊 Statistiche EPG:', {
              canaliConEPG: Object.keys(epgData).length,
              primiCanaliEPG: Object.keys(epgData).slice(0, 10),
              primiCanaliPlaylist: parsedChannels.slice(0, 10).map(c => ({
                name: c.name,
                tvgId: c.tvg.id,
                channelId: c.id
              })),
              esempioCanaleEPG: {
                channelId: Object.keys(epgData)[0],
                programmiCount: epgData[Object.keys(epgData)[0]]?.length,
                primiProgrammi: epgData[Object.keys(epgData)[0]]?.slice(0, 2)
              }
            });
            
            setEpgData(epgData);
            
            console.log('💾 EPG salvata nello store');
            console.log('🔍 Verifica store dopo setEpgData:', {
              epgDataKeys: Object.keys(epgData).length,
              examplePrograms: epgData[Object.keys(epgData)[0]]?.slice(0, 2)
            });

            // Cache new EPG data (1 day cache)
            const cachePromises = Object.entries(epgData).map(([channelId, programs]) =>
              db.cacheEpgData(channelId, programs as any, 1)
            );
            await Promise.all(cachePromises);

            toast.success('Guida EPG aggiornata!', { id: epgToast });
          } catch (error) {
            console.error('EPG loading error:', error);
            toast.error('Impossibile caricare la guida EPG', { id: epgToast });
            setEpgData({});
          }
        }
      } catch (error) {
        console.error('Playlist loading error:', error);
        toast.error(error instanceof Error ? error.message : 'Errore nel caricamento', {
          id: loadingToast,
        });
        setChannels([]);
      } finally {
        setIsLoading(false);
      }
    },
    [parseM3U, parseXMLTV, setChannels, setEpgData, setEpgUrl, setM3uUrl, setIsLoading, user, savePlaylist]
  );

  const handleLoadFromUrl = useCallback(
    async (url: string) => {
      setIsLoading(true);
      const loadingToast = toast.loading('Caricamento da URL...');

      try {
        // Use CORS proxy for cross-origin requests
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const content = await response.text();
        toast.dismiss(loadingToast);
        await handleDataLoad(content, url);
      } catch (error) {
        console.error('URL fetch error:', error);
        toast.error('Impossibile recuperare la playlist dall\'URL', { id: loadingToast });
        setIsLoading(false);
      }
    },
    [handleDataLoad, setIsLoading]
  );

  const handleLoadFromFile = useCallback(
    (file: File) => {
      setIsLoading(true);
      const loadingToast = toast.loading('Lettura file...');

      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          toast.dismiss(loadingToast);
          await handleDataLoad(e.target.result as string);
        } else {
          toast.error('Impossibile leggere il file', { id: loadingToast });
          setIsLoading(false);
        }
      };
      reader.onerror = () => {
        toast.error('Errore nella lettura del file', { id: loadingToast });
        setIsLoading(false);
      };
      reader.readAsText(file);
    },
    [handleDataLoad, setIsLoading]
  );

  const handleLoadDemo = useCallback(() => {
    handleDataLoad(DEMO_M3U_CONTENT);
  }, [handleDataLoad]);

  // Handle EPG refresh
  const handleRefreshEpg = useCallback(async () => {
    const epgUrl = playlist.epgUrl;
    if (!epgUrl) {
      toast.error('Nessuna fonte EPG configurata');
      return;
    }
    
    setIsLoading(true);
    const epgToast = toast.loading('Aggiornamento guida EPG...');
    
    try {
      const workerUrl = 'https://sandtv-proxy.sandtv.workers.dev';
      const cacheBuster = `&t=${Date.now()}`;
      const proxyUrl = `${workerUrl}?url=${encodeURIComponent(epgUrl)}${cacheBuster}`;
      
      console.log('🔄 Refresh EPG con cache-busting:', proxyUrl);
      
      const epgResponse = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(30000),
        cache: 'no-store'
      });
      
      if (!epgResponse.ok) {
        throw new Error(`EPG fetch failed: ${epgResponse.statusText}`);
      }

      const epgContent = await epgResponse.text();
      console.log('Auto-refresh EPG downloaded, size:', epgContent.length, 'bytes');
      
      const epgData = await parseXMLTV(epgContent);
      console.log('Auto-refresh EPG parsed:', Object.keys(epgData).length, 'channels');
      console.log('EPG channel IDs sample:', Object.keys(epgData).slice(0, 10));
      
      setEpgData(epgData);

      // Clear old cache and save new data
      await db.epgCache.clear();
      const cachePromises = Object.entries(epgData).map(([channelId, programs]) =>
        db.cacheEpgData(channelId, programs as any, 7)
      );
      await Promise.all(cachePromises);

      toast.success('Guida EPG aggiornata!', { id: epgToast });
    } catch (error) {
      console.error('EPG refresh error:', error);
      toast.error('Errore aggiornamento EPG', { id: epgToast });
    } finally {
      setIsLoading(false);
    }
  }, [playlist.epgUrl, parseXMLTV, setEpgData]);

  // Handle loading EPG from custom URL
  const handleLoadEpg = useCallback(async (url: string) => {
    setIsLoading(true);
    const epgToast = toast.loading('Caricamento guida EPG...');
    
    try {
      const workerUrl = 'https://sandtv-proxy.sandtv.workers.dev';
      const cacheBuster = `&t=${Date.now()}`;
      const proxyUrl = `${workerUrl}?url=${encodeURIComponent(url)}${cacheBuster}`;
      
      console.log('📡 Caricamento EPG custom con cache-busting:', proxyUrl);
      
      const epgResponse = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(30000),
        cache: 'no-store'
      });
      
      if (!epgResponse.ok) {
        throw new Error(`EPG fetch failed: ${epgResponse.statusText}`);
      }

      const epgContent = await epgResponse.text();
      const epgData = await parseXMLTV(epgContent);
      setEpgData(epgData);
      setEpgUrl(url);

      // Cache the data
      await db.epgCache.clear();
      const cachePromises = Object.entries(epgData).map(([channelId, programs]) =>
        db.cacheEpgData(channelId, programs as any, 7)
      );
      await Promise.all(cachePromises);

      toast.success('Guida EPG caricata!', { id: epgToast });
    } catch (error) {
      console.error('EPG load error:', error);
      toast.error('Errore caricamento EPG', { id: epgToast });
    } finally {
      setIsLoading(false);
    }
  }, [parseXMLTV, setEpgData, setEpgUrl]);

  const handleReset = useCallback(() => {
    resetPlaylist();
    toast.success('Playlist rimossa');
  }, [resetPlaylist]);

  // Handle "New Playlist" button - stay on Landing and don't auto-load
  const handleNewPlaylist = useCallback(() => {
    resetPlaylist();
    setSkipAutoLoadPlaylist(true);
    toast.success('Pronto per caricare una nuova playlist');
  }, [resetPlaylist]);

  // Handle playlist selection from PlaylistManager
  const handleSelectPlaylist = useCallback(
    async (m3uUrl: string, epgUrl?: string | null) => {
      setSkipAutoLoadPlaylist(false); // Resume auto-load after selection
      
      // Find the saved playlist and update its lastUsed
      const savedPlaylist = useStore.getState().savedPlaylists.find(p => p.m3uUrl === m3uUrl);
      if (savedPlaylist) {
        useStore.getState().updatePlaylistLastUsed(savedPlaylist.id);
      }
      
      const loadingToast = toast.loading('Caricamento playlist...');
      
      try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(m3uUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const content = await response.text();
        toast.dismiss(loadingToast);
        await handleDataLoad(content, m3uUrl);
        if (epgUrl) {
          await handleLoadEpg(epgUrl);
        }
      } catch (error) {
        console.error('Playlist selection error:', error);
        toast.error('Impossibile caricare la playlist', { id: loadingToast });
        setIsLoading(false);
      }
    },
    [handleDataLoad, handleLoadEpg, setIsLoading]
  );

  // Load saved playlist when user logs in
  useEffect(() => {
    let isExecuting = false; // Prevent duplicate execution
    
    const loadUserPlaylist = async () => {
      if (isExecuting) return;
      if (skipAutoLoadPlaylist) return; // Don't auto-load if user wants new playlist
      
      console.log('Load playlist effect triggered');
      console.log('User:', user);
      console.log('Current playlist.m3uUrl:', playlist.m3uUrl);
      
      if (user && !playlist.m3uUrl) {
        isExecuting = true;
        console.log('Attempting to load saved playlist for user:', user.email);
        try {
          const savedPlaylist = await loadPlaylist();
          console.log('Saved playlist result:', savedPlaylist);
          
          if (savedPlaylist?.m3uUrl) {
            const loadingToast = toast.loading('Caricamento playlist salvata...');
            try {
              console.log('Fetching playlist from URL:', savedPlaylist.m3uUrl);
              // Use CORS proxy for saved playlist URL
              const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(savedPlaylist.m3uUrl)}`;
              const response = await fetch(proxyUrl);
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              const content = await response.text();
              toast.dismiss(loadingToast);
              await handleDataLoad(content, savedPlaylist.m3uUrl);
            } catch (err) {
              toast.error('Impossibile caricare la playlist salvata', { id: loadingToast });
              console.error('Error fetching saved playlist:', err);
            }
          } else {
            console.log('No saved playlist found');
          }
        } catch (error) {
          console.error('Error loading saved playlist:', error);
        } finally {
          isExecuting = false;
        }
      } else {
        if (!user) console.log('No user logged in');
        if (playlist.m3uUrl) console.log('Playlist already loaded');
      }
    };
    loadUserPlaylist();
  }, [user?.uid, playlist.m3uUrl, skipAutoLoadPlaylist]);

  if (!playlist.channels || playlist.channels.length === 0) {
    console.log('🏠 Rendering Landing - skipAutoLoadPlaylist:', skipAutoLoadPlaylist);
    return (
      <ErrorBoundary>
        <>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1f2937',
              color: '#fff',
            },
          }}
        />
        <Landing
          onLoadFromUrl={handleLoadFromUrl}
          onLoadFromFile={handleLoadFromFile}
          onLoadDemo={handleLoadDemo}
          isLoading={isLoading}
          user={user}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
          onOpenXtreamAuth={() => setIsXtreamAuthModalOpen(true)}
          onSelectPlaylist={handleSelectPlaylist}
          onNewPlaylist={handleNewPlaylist}
        />
        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)}
        />
        <XtreamAuthModal 
          isOpen={isXtreamAuthModalOpen}
          onClose={() => setIsXtreamAuthModalOpen(false)}
        />
      </>
        </ErrorBoundary>
    );
  }

  console.log('🎬 Rendering PlayerUI with channels:', playlist.channels.length);
  return (
    <ErrorBoundary>
      <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1f2937',
            color: '#fff',
          },
        }}
      />
      <PlayerUI 
        channels={playlist.channels} 
        epgData={playlist.epgData}
        onReset={handleReset}
        onLoadEpg={handleLoadEpg}
        onRefreshEpg={handleRefreshEpg}
        currentEpgUrl={playlist.epgUrl}
      />
    </>
    </ErrorBoundary>
  );
};

export default App;