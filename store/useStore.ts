import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Channel, EpgData, Group, Program } from '../types';
import { XtreamCredentials } from '../lib/xtreamApi';

interface PlayerState {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isFullscreen: boolean;
  quality: 'auto' | '1080p' | '720p' | '480p' | '360p';
  subtitlesEnabled: boolean;
  isPiPMode: boolean;
}

interface ViewState {
  currentView: 'LIST' | 'EPG' | 'GRID';
  isSidebarOpen: boolean;
  isChannelListOpen: boolean;
  searchQuery: string;
  selectedGroup: string;
}

interface PlaylistData {
  channels: Channel[];
  epgData: EpgData;
  epgUrl: string | null;
  m3uUrl: string | null;
  lastUpdated: number | null;
}

interface XtreamPlaylistData {
  liveChannels: Channel[];
  vodChannels: Channel[];
  seriesChannels: Channel[];
  epgData: EpgData;
  playlistName: string;
  credentials?: XtreamCredentials;
  lastSynced: number | null;
}

interface Settings {
  theme: 'dark' | 'light';
  autoplay: boolean;
  defaultQuality: 'auto' | '1080p' | '720p' | '480p' | '360p';
  parentalControlEnabled: boolean;
  parentalControlPin: string | null;
  language: 'it' | 'en';
  // Enable automatic Picture-in-Picture when the page loses focus / tab change
  pipAuto?: boolean;
  // Hardware acceleration: 'auto' (default), 'disabled', 'enabled'
  hardwareAcceleration?: 'auto' | 'disabled' | 'enabled';
  // Track if user has ever unmuted (for autoplay compliance)
  hasUserUnmuted?: boolean;
}

interface WatchHistory {
  channelId: string;
  timestamp: number;
  duration: number;
}

interface SavedPlaylist {
  id: string;
  name: string;
  m3uUrl: string;
  epgUrl?: string | null;
  createdAt: number;
  lastUsed?: number;
}

interface StoreState {
  // Saved playlists
  savedPlaylists: SavedPlaylist[];
  addSavedPlaylist: (playlist: SavedPlaylist) => void;
  removeSavedPlaylist: (id: string) => void;
  updatePlaylistLastUsed: (id: string) => void;

  // Playlist data (M3U)
  playlist: PlaylistData;
  setChannels: (channels: Channel[]) => void;
  setEpgData: (epgData: EpgData) => void;
  setEpgUrl: (epgUrl: string | null) => void;
  setM3uUrl: (m3uUrl: string | null) => void;
  updateLastUpdated: () => void;
  resetPlaylist: () => void;

  // Xtream playlist data
  xtreamPlaylist: XtreamPlaylistData;
  setXtreamPlaylist: (data: Partial<XtreamPlaylistData>) => void;
  resetXtreamPlaylist: () => void;
  isXtreamActive: boolean;
  setIsXtreamActive: (active: boolean) => void;

  // Current playback
  currentChannel: Channel | null;
  setCurrentChannel: (channel: Channel | null) => void;

  // Player state
  player: PlayerState;
  setPlayerState: (state: Partial<PlayerState>) => void;

  // View state
  view: ViewState;
  setViewState: (state: Partial<ViewState>) => void;

  // Favorites
  favorites: string[];
  toggleFavorite: (channelId: string) => void;
  setFavorites: (favorites: string[]) => void;
  isFavorite: (channelId: string) => boolean;

  // Custom groups
  customGroups: Group[];
  setCustomGroups: (groups: Group[]) => void;
  addCustomGroup: (name: string) => void;
  updateCustomGroup: (groupId: string, updates: Partial<Group>) => void;
  deleteCustomGroup: (groupId: string) => void;
  addChannelToGroup: (groupId: string, channelId: string) => void;
  removeChannelFromGroup: (groupId: string, channelId: string) => void;

  // Watch history
  watchHistory: WatchHistory[];
  setWatchHistory: (history: WatchHistory[]) => void;
  addToHistory: (channelId: string, duration: number) => void;
  clearHistory: () => void;

  // Settings
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const initialPlayerState: PlayerState = {
  isPlaying: false,
  isMuted: false,
  volume: 1,
  currentTime: 0,
  duration: 0,
  isFullscreen: false,
  quality: 'auto',
  subtitlesEnabled: false,
  isPiPMode: false,
};

const initialViewState: ViewState = {
  currentView: 'LIST',
  isSidebarOpen: false,
  isChannelListOpen: false,
  searchQuery: '',
  selectedGroup: 'all',
};

const initialSettings: Settings = {
  theme: 'dark',
  autoplay: true,
  defaultQuality: 'auto',
  parentalControlEnabled: false,
  parentalControlPin: null,
  language: 'it',
  pipAuto: true, // Auto-PiP attivo di default
  hardwareAcceleration: 'disabled', // Temporaneamente disabilitato per test
};

const initialXtreamPlaylist: XtreamPlaylistData = {
  liveChannels: [],
  vodChannels: [],
  seriesChannels: [],
  epgData: {},
  playlistName: '',
  credentials: undefined,
  lastSynced: null,
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Saved playlists
      savedPlaylists: [],
      addSavedPlaylist: (playlist) =>
        set((state) => ({
          savedPlaylists: [...state.savedPlaylists, playlist],
        })),
      removeSavedPlaylist: (id) =>
        set((state) => ({
          savedPlaylists: state.savedPlaylists.filter((p) => p.id !== id),
        })),
      updatePlaylistLastUsed: (id) =>
        set((state) => ({
          savedPlaylists: state.savedPlaylists.map((p) =>
            p.id === id ? { ...p, lastUsed: Date.now() } : p
          ),
        })),

      // Playlist data (M3U)
      playlist: {
        channels: [],
        epgData: {},
        epgUrl: null,
        m3uUrl: null,
        lastUpdated: null,
      },
      setChannels: (channels) =>
        set((state) => ({
          playlist: { ...state.playlist, channels },
        })),
      setEpgData: (epgData) =>
        set((state) => ({
          playlist: { ...state.playlist, epgData },
        })),
      setEpgUrl: (epgUrl) =>
        set((state) => ({
          playlist: { ...state.playlist, epgUrl },
        })),
      setM3uUrl: (m3uUrl) =>
        set((state) => ({
          playlist: { ...state.playlist, m3uUrl },
        })),
      updateLastUpdated: () =>
        set((state) => ({
          playlist: { ...state.playlist, lastUpdated: Date.now() },
        })),
      resetPlaylist: () =>
        set({
          playlist: {
            channels: [],
            epgData: {},
            epgUrl: null,
            m3uUrl: null,
            lastUpdated: null,
          },
        }),

      // Xtream playlist data
      xtreamPlaylist: initialXtreamPlaylist,
      setXtreamPlaylist: (data) =>
        set((state) => ({
          xtreamPlaylist: { ...state.xtreamPlaylist, ...data },
        })),
      resetXtreamPlaylist: () =>
        set({
          xtreamPlaylist: initialXtreamPlaylist,
        }),
      isXtreamActive: false,
      setIsXtreamActive: (active) => set({ isXtreamActive: active }),

      // Current playback
      currentChannel: null,
      setCurrentChannel: (channel) => {
        const state = get();
        if (channel) {
          state.addToHistory(channel.id, 0);
        }
        set({ currentChannel: channel });
      },

      // Player state
      player: initialPlayerState,
      setPlayerState: (playerState) =>
        set((state) => ({
          player: { ...state.player, ...playerState },
        })),

      // View state
      view: initialViewState,
      setViewState: (viewState) =>
        set((state) => ({
          view: { ...state.view, ...viewState },
        })),

      // Favorites
      favorites: [],
      toggleFavorite: (channelId) =>
        set((state) => ({
          favorites: state.favorites.includes(channelId)
            ? state.favorites.filter((id) => id !== channelId)
            : [...state.favorites, channelId],
        })),
      setFavorites: (favorites) => set({ favorites }),
      isFavorite: (channelId) => get().favorites.includes(channelId),

      // Custom groups
      customGroups: [],
      setCustomGroups: (groups) => set({ customGroups: groups }),
      addCustomGroup: (name) =>
        set((state) => ({
          customGroups: [
            ...state.customGroups,
            {
              id: `custom_${Date.now()}`,
              name,
              channels: [],
            },
          ],
        })),
      updateCustomGroup: (groupId, updates) =>
        set((state) => ({
          customGroups: state.customGroups.map((g) =>
            g.id === groupId ? { ...g, ...updates } : g
          ),
        })),
      deleteCustomGroup: (groupId) =>
        set((state) => ({
          customGroups: state.customGroups.filter((g) => g.id !== groupId),
          view:
            state.view.selectedGroup === groupId
              ? { ...state.view, selectedGroup: 'all' }
              : state.view,
        })),
      addChannelToGroup: (groupId, channelId) =>
        set((state) => ({
          customGroups: state.customGroups.map((g) =>
            g.id === groupId && !g.channels.includes(channelId)
              ? { ...g, channels: [...g.channels, channelId] }
              : g
          ),
        })),
      removeChannelFromGroup: (groupId, channelId) =>
        set((state) => ({
          customGroups: state.customGroups.map((g) =>
            g.id === groupId
              ? { ...g, channels: g.channels.filter((id) => id !== channelId) }
              : g
          ),
        })),

      // Watch history
      watchHistory: [],
      setWatchHistory: (history) => set({ watchHistory: history }),
      addToHistory: (channelId, duration) =>
        set((state) => {
          const existing = state.watchHistory.find((h) => h.channelId === channelId);
          if (existing) {
            return {
              watchHistory: state.watchHistory.map((h) =>
                h.channelId === channelId
                  ? { ...h, timestamp: Date.now(), duration }
                  : h
              ),
            };
          }
          return {
            watchHistory: [
              { channelId, timestamp: Date.now(), duration },
              ...state.watchHistory.slice(0, 49), // Keep last 50
            ],
          };
        }),
      clearHistory: () => set({ watchHistory: [] }),

      // Settings
      settings: initialSettings,
      updateSettings: (settings) =>
        set((state) => ({
          settings: { ...state.settings, ...settings },
        })),

      // Loading states
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'iptv-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state, action) => {
        // Ensure playlist has required fields
        if (state) {
          if (!state.playlist.channels) state.playlist.channels = [];
          if (!state.playlist.epgData) state.playlist.epgData = {};
        }
      },
      partialize: (state) => ({
        savedPlaylists: state.savedPlaylists,
        playlist: {
          m3uUrl: state.playlist.m3uUrl,
          epgUrl: state.playlist.epgUrl,
        },
        favorites: state.favorites,
        customGroups: state.customGroups,
        watchHistory: state.watchHistory,
        settings: state.settings,
        view: {
          selectedGroup: state.view.selectedGroup,
        },
      }),
    }
  )
);
