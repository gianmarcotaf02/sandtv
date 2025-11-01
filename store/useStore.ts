import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Channel, EpgData, Group, Program } from '../types';

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
}

interface WatchHistory {
  channelId: string;
  timestamp: number;
  duration: number;
}

interface StoreState {
  // Playlist data
  playlist: PlaylistData;
  setChannels: (channels: Channel[]) => void;
  setEpgData: (epgData: EpgData) => void;
  setEpgUrl: (epgUrl: string | null) => void;
  setM3uUrl: (m3uUrl: string | null) => void;
  updateLastUpdated: () => void;
  resetPlaylist: () => void;

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
  pipAuto: false,
  hardwareAcceleration: 'disabled', // Temporaneamente disabilitato per test
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Playlist data
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
          currentChannel: null,
        }),

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
      partialize: (state) => ({
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
