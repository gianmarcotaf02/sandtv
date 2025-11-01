import Dexie, { Table } from 'dexie';
import { Channel, EpgData, Program } from '../types';

export interface SavedPlaylist {
  id?: number;
  name: string;
  url?: string;
  content?: string;
  channels: Channel[];
  epgUrl: string | null;
  createdAt: number;
  lastUsed: number;
}

export interface CachedEpg {
  channelId: string;
  programs: Program[];
  lastUpdated: number;
  expiresAt: number;
}

export interface WatchHistoryEntry {
  id?: number;
  channelId: string;
  channelName: string;
  channelLogo: string | null;
  timestamp: number;
  duration: number;
  position: number; // Playback position in seconds
}

export interface Bookmark {
  id?: number;
  channelId: string;
  programTitle: string;
  timestamp: number;
  position: number;
  note?: string;
}

export interface AppSettings {
  id: number;
  settings: {
    theme: 'dark' | 'light';
    quality: 'auto' | '1080p' | '720p' | '480p' | '360p';
    volume: number;
    autoplay: boolean;
    parentalControl: {
      enabled: boolean;
      pin: string | null;
      restrictedChannels: string[];
    };
    language: 'it' | 'en';
    epgCacheDays: number;
    notifications: boolean;
  };
}

class IPTVDatabase extends Dexie {
  playlists!: Table<SavedPlaylist, number>;
  epgCache!: Table<CachedEpg, string>;
  history!: Table<WatchHistoryEntry, number>;
  bookmarks!: Table<Bookmark, number>;
  settings!: Table<AppSettings, number>;

  constructor() {
    super('IPTVDatabase');
    
    this.version(1).stores({
      playlists: '++id, name, lastUsed',
      epgCache: 'channelId, expiresAt',
      history: '++id, channelId, timestamp',
      bookmarks: '++id, channelId, timestamp',
      settings: 'id',
    });
  }

  // Playlist methods
  async savePlaylist(playlist: Omit<SavedPlaylist, 'id' | 'createdAt' | 'lastUsed'>) {
    return await this.playlists.add({
      ...playlist,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    });
  }

  async updatePlaylistUsage(id: number) {
    return await this.playlists.update(id, { lastUsed: Date.now() });
  }

  async getAllPlaylists() {
    return await this.playlists.orderBy('lastUsed').reverse().toArray();
  }

  async deletePlaylist(id: number) {
    return await this.playlists.delete(id);
  }

  // EPG Cache methods
  async cacheEpgData(channelId: string, programs: Program[], cacheDays = 7) {
    const expiresAt = Date.now() + cacheDays * 24 * 60 * 60 * 1000;
    return await this.epgCache.put({
      channelId,
      programs,
      lastUpdated: Date.now(),
      expiresAt,
    });
  }

  async getEpgCache(channelId: string): Promise<Program[] | null> {
    const cached = await this.epgCache.get(channelId);
    if (!cached) return null;
    
    if (Date.now() > cached.expiresAt) {
      await this.epgCache.delete(channelId);
      return null;
    }
    
    return cached.programs;
  }

  async clearExpiredEpg() {
    const now = Date.now();
    return await this.epgCache.where('expiresAt').below(now).delete();
  }

  async clearAllEpg() {
    return await this.epgCache.clear();
  }

  // History methods
  async addToHistory(entry: Omit<WatchHistoryEntry, 'id' | 'timestamp'>) {
    // Check if entry already exists for this channel
    const existing = await this.history
      .where('channelId')
      .equals(entry.channelId)
      .first();

    if (existing) {
      // Update existing entry
      return await this.history.update(existing.id!, {
        timestamp: Date.now(),
        duration: entry.duration,
        position: entry.position,
      });
    } else {
      // Add new entry
      return await this.history.add({
        ...entry,
        timestamp: Date.now(),
      });
    }
  }

  async getHistory(limit = 50) {
    return await this.history.orderBy('timestamp').reverse().limit(limit).toArray();
  }

  async clearHistory() {
    return await this.history.clear();
  }

  // Bookmark methods
  async addBookmark(bookmark: Omit<Bookmark, 'id' | 'timestamp'>) {
    return await this.bookmarks.add({
      ...bookmark,
      timestamp: Date.now(),
    });
  }

  async getBookmarks(channelId?: string) {
    if (channelId) {
      return await this.bookmarks.where('channelId').equals(channelId).toArray();
    }
    return await this.bookmarks.orderBy('timestamp').reverse().toArray();
  }

  async deleteBookmark(id: number) {
    return await this.bookmarks.delete(id);
  }

  // Settings methods
  async getSettings(): Promise<AppSettings['settings'] | null> {
    const settings = await this.settings.get(1);
    return settings?.settings || null;
  }

  async updateSettings(settings: Partial<AppSettings['settings']>) {
    const existing = await this.settings.get(1);
    if (existing) {
      return await this.settings.update(1, {
        settings: { ...existing.settings, ...settings },
      });
    } else {
      return await this.settings.add({
        id: 1,
        settings: {
          theme: 'dark',
          quality: 'auto',
          volume: 1,
          autoplay: true,
          parentalControl: {
            enabled: false,
            pin: null,
            restrictedChannels: [],
          },
          language: 'it',
          epgCacheDays: 7,
          notifications: true,
          ...settings,
        },
      });
    }
  }

  // Maintenance
  async getDbSize(): Promise<number> {
    // Estimate database size
    const [playlists, epg, history, bookmarks] = await Promise.all([
      this.playlists.count(),
      this.epgCache.count(),
      this.history.count(),
      this.bookmarks.count(),
    ]);
    
    return playlists + epg + history + bookmarks;
  }

  async clearAllData() {
    await Promise.all([
      this.playlists.clear(),
      this.epgCache.clear(),
      this.history.clear(),
      this.bookmarks.clear(),
    ]);
  }
}

export const db = new IPTVDatabase();

// Initialize and cleanup expired data on startup
db.on('ready', async () => {
  await db.clearExpiredEpg();
});
