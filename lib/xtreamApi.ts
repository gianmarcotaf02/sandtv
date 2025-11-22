/**
 * Xtream Codes API Client
 * Interfaccia completa con Xtream API per playlist live, VOD, EPG e catchup
 * 
 * Documentazione: https://xtream-ui.com/
 */

export interface XtreamCredentials {
  server: string;        // Es: http://xtream.example.com:8000
  username: string;
  password: string;
}

export interface XtreamServerInfo {
  serverTime: string;
  timezone: string;
  timestamp: number;
}

/**
 * Risposta canale live da Xtream API
 */
export interface XtreamLiveChannel {
  num: number;           // Numero canale
  name: string;          // Nome canale
  stream_type: string;   // "live"
  stream_id: number;
  stream_icon: string;   // URL logo
  epg_channel_id: string | null;
  added: string;
  category_id: number | string;
  category_name: string;
  parent_id: number;
  custom_sid: string | null;
  tv_archive: number;    // 1 = ha catchup
  tv_archive_duration: number; // Giorni archivio
  direct_source: string | null;
}

/**
 * Risposta VOD da Xtream API
 */
export interface XtreamVOD {
  stream_id: number;
  name: string;
  title: string;
  year: string;
  release_date: string;
  plot: string;
  poster: string;        // URL immagine
  backdrop: string;
  cast: string;
  director: string;
  genre: string;
  duration: string;      // In secondi o HH:MM:SS
  rating: string;
  rating_5based: string;
  stream_icon: string;
  category_id: string;
  category_name: string;
  container_extension: string; // "mkv", "mp4", ecc
  added: string;
}

/**
 * Risposta Serie TV da Xtream API
 */
export interface XtreamSeries {
  series_id: number;
  name: string;
  title: string;
  year: string;
  release_date: string;
  plot: string;
  poster: string;
  backdrop: string;
  cast: string;
  director: string;
  genre: string;
  rating: string;
  rating_5based: string;
  stream_icon: string;
  category_id: string;
  category_name: string;
  added: string;
  cover?: string;
}

/**
 * Episodio di una serie
 */
export interface XtreamSeriesEpisode {
  id: number;
  episode_num: number;
  title: string;
  description: string;
  season: number;
  added: string;
  duration: string;
  air_date: string;
}

/**
 * Programma EPG da Xtream
 */
export interface XtreamEPGProgram {
  epg_id: string;
  id: string;
  start: number;         // Timestamp
  end: number;           // Timestamp
  title: string;
  description: string;
  channel_id: string;
  genre: string;
  image: string;
}

/**
 * Categoria da Xtream
 */
export interface XtreamCategory {
  category_id: number | string;
  category_name: string;
  parent_id: number;
}

/**
 * Interfaccia cache interna
 */
interface CacheEntry {
  data: any;
  timestamp: number;
}

/**
 * Client Xtream API
 */
export class XtreamApiClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private cacheExpiry = 3600000; // 1 ora
  private cache = new Map<string, CacheEntry>();

  constructor(credentials: XtreamCredentials) {
    this.baseUrl = credentials.server.replace(/\/$/, ''); // Rimuovi trailing slash
    this.username = credentials.username;
    this.password = credentials.password;
  }

  /**
   * Costruisci URL API Xtream
   */
  private buildUrl(action: string, params?: Record<string, string | number>): string {
    const url = new URL(`${this.baseUrl}/player_api.php`);
    url.searchParams.append('username', this.username);
    url.searchParams.append('password', this.password);
    url.searchParams.append('action', action);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    return url.toString();
  }




  /**
   * Verifica credenziali e connessione
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const url = this.buildUrl('get_live_categories');
      console.log('🔗 Testing Xtream connection to:', url);
      
      const response = await fetch(url);
      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('❌ HTTP Error:', response.status, errorText);
        
        if (response.status === 401 || response.status === 403) {
          return { success: false, error: 'Credenziali non valide' };
        }
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      console.log('✅ Connection successful, response:', data);

      // Se è un oggetto vuoto o array vuoto, connessione ok
      if (typeof data === 'object') {
        return { success: true };
      }

      return { success: false, error: 'Risposta inattesa' };
    } catch (error) {
      console.error('❌ Connection error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Errore connessione' };
    }
  }

  /**
   * Ottieni info server
   */
  async getServerInfo(): Promise<XtreamServerInfo> {
    const cacheKey = 'server_info';
    const cached = this.getFromCache<XtreamServerInfo>(cacheKey);
    if (cached !== undefined) return cached;

    const url = this.buildUrl('get_server_info');
    const response = await fetch(url);
    const data = await response.json();

    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Ottieni categorie live
   */
  async getLiveCategories(): Promise<XtreamCategory[]> {
    const cacheKey = 'live_categories';
    const cached = this.getFromCache<XtreamCategory[]>(cacheKey);
    if (cached !== undefined) return cached;

    const url = this.buildUrl('get_live_categories');
    const response = await fetch(url);
    const data = await response.json();

    this.setCache(cacheKey, Array.isArray(data) ? data : []);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Ottieni canali live
   */
  async getLiveChannels(categoryId?: string | number): Promise<XtreamLiveChannel[]> {
    const params = categoryId ? { category_id: categoryId } : undefined;
    const cacheKey = `live_channels_${categoryId || 'all'}`;
    const cached = this.getFromCache<XtreamLiveChannel[]>(cacheKey);
    if (cached !== undefined) return cached;

    const url = this.buildUrl('get_live_streams', params);
    const response = await fetch(url);
    const data = await response.json();

    this.setCache(cacheKey, Array.isArray(data) ? data : []);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Ottieni categorie VOD
   */
  async getVODCategories(): Promise<XtreamCategory[]> {
    const cacheKey = 'vod_categories';
    const cached = this.getFromCache<XtreamCategory[]>(cacheKey);
    if (cached !== undefined) return cached;

    const url = this.buildUrl('get_vod_categories');
    const response = await fetch(url);
    const data = await response.json();

    this.setCache(cacheKey, Array.isArray(data) ? data : []);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Ottieni VOD
   */
  async getVOD(categoryId?: string | number): Promise<XtreamVOD[]> {
    const params = categoryId ? { category_id: categoryId } : undefined;
    const cacheKey = `vod_${categoryId || 'all'}`;
    const cached = this.getFromCache<XtreamVOD[]>(cacheKey);
    if (cached !== undefined) return cached;

    const url = this.buildUrl('get_vod_streams', params);
    const response = await fetch(url);
    const data = await response.json();

    this.setCache(cacheKey, Array.isArray(data) ? data : []);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Ottieni info VOD specifico
   */
  async getVODInfo(vodId: number): Promise<XtreamVOD | null> {
    const cacheKey = `vod_info_${vodId}`;
    const cached = this.getFromCache<XtreamVOD>(cacheKey);
    if (cached !== undefined) return cached;

    const url = this.buildUrl('get_vod_info', { vod_id: vodId });
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.info) {
      this.setCache(cacheKey, data.info);
      return data.info;
    }
    return null;
  }

  /**
   * Ottieni categorie serie
   */
  async getSeriesCategories(): Promise<XtreamCategory[]> {
    const cacheKey = 'series_categories';
    const cached = this.getFromCache<XtreamCategory[]>(cacheKey);
    if (cached !== undefined) return cached;

    const url = this.buildUrl('get_series_categories');
    const response = await fetch(url);
    const data = await response.json();

    this.setCache(cacheKey, Array.isArray(data) ? data : []);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Ottieni serie TV
   */
  async getSeries(categoryId?: string | number): Promise<XtreamSeries[]> {
    const params = categoryId ? { category_id: categoryId } : undefined;
    const cacheKey = `series_${categoryId || 'all'}`;
    const cached = this.getFromCache<XtreamSeries[]>(cacheKey);
    if (cached !== undefined) return cached;

    const url = this.buildUrl('get_series', params);
    const response = await fetch(url);
    const data = await response.json();

    this.setCache(cacheKey, Array.isArray(data) ? data : []);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Ottieni episodi di una serie
   */
  async getSeriesEpisodes(seriesId: number): Promise<XtreamSeriesEpisode[]> {
    const cacheKey = `series_episodes_${seriesId}`;
    const cached = this.getFromCache<XtreamSeriesEpisode[]>(cacheKey);
    if (cached !== undefined) return cached;

    const url = this.buildUrl('get_series_info', { series_id: seriesId });
    const response = await fetch(url);
    const data = await response.json();

    const episodes = data?.episodes || {};
    const episodesList = Object.values(episodes).flat() as XtreamSeriesEpisode[];

    this.setCache(cacheKey, episodesList);
    return episodesList;
  }

  /**
   * Ottieni EPG per canale live
   */
  async getLiveEPG(channelId: string | number): Promise<XtreamEPGProgram[]> {
    const cacheKey = `epg_live_${channelId}`;
    const cached = this.getFromCache<XtreamEPGProgram[]>(cacheKey);
    if (cached !== undefined) return cached;

    const url = this.buildUrl('get_epg', { stream_id: channelId });
    const response = await fetch(url);
    const data = await response.json();

    this.setCache(cacheKey, Array.isArray(data) ? data : []);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Ottieni EPG per range di canali
   */
  async getLiveEPGRange(startTime: number, endTime: number): Promise<XtreamEPGProgram[]> {
    const cacheKey = `epg_range_${startTime}_${endTime}`;
    const cached = this.getFromCache<XtreamEPGProgram[]>(cacheKey);
    if (cached !== undefined) return cached;

    const url = this.buildUrl('get_epg_range', {
      range_start: startTime,
      range_end: endTime,
    });
    const response = await fetch(url);
    const data = await response.json();

    this.setCache(cacheKey, Array.isArray(data) ? data : []);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Ottieni URL stream per canale live
   */
  getStreamUrl(streamId: number, type: 'live' | 'vod' | 'series' = 'live'): string {
    const ext = type === 'series' ? '.m3u8' : '.m3u8';
    return `${this.baseUrl}/${type}/${this.username}/${this.password}/${streamId}${ext}`;
  }

  /**
   * Ottieni URL stream series
   */
  getSeriesStreamUrl(seriesId: number, seasonId: number, episodeId: number): string {
    return `${this.baseUrl}/series/${this.username}/${this.password}/${seriesId}/${seasonId}/${episodeId}.m3u8`;
  }

  /**
   * Pulisci cache scaduta
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Svuota cache completamente
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ===== Utility privati =====

  private getFromCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.cacheExpiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data as T;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }
}

/**
 * Factory per creare client Xtream
 */
export function createXtreamClient(credentials: XtreamCredentials): XtreamApiClient {
  return new XtreamApiClient(credentials);
}
