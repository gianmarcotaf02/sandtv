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
   * Costruisci URL al proxy backend Netlify
   */
  private getProxyUrl(action: string, params?: Record<string, string | number>): string {
    const proxyUrl = new URL('/.netlify/functions/xtream-proxy', window.location.origin);
    proxyUrl.searchParams.append('server', this.baseUrl);
    proxyUrl.searchParams.append('username', this.username);
    proxyUrl.searchParams.append('password', this.password);
    proxyUrl.searchParams.append('action', action);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        proxyUrl.searchParams.append(key, String(value));
      });
    }

    return proxyUrl.toString();
  }

  /**
   * Esegui richiesta API con fallback diretto
   */
  private async fetchWithFallback(action: string, params?: Record<string, string | number>): Promise<Response> {
    let proxyError: any = null;
    
    // Prova prima con il proxy
    try {
      const proxyUrl = this.getProxyUrl(action, params);
      console.log('🔄 Trying proxy:', proxyUrl);
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      
      // Se il proxy risponde, usa la sua risposta (anche se è un errore)
      if (response.status !== 502 && response.status !== 503 && response.status !== 504) {
        console.log('✅ Proxy response:', response.status);
        return response;
      }
      
      // Proxy non disponibile, prova a leggere l'errore
      const errorText = await response.text().catch(() => 'Unknown error');
      console.log('⚠️ Proxy error response:', errorText.substring(0, 200));
      proxyError = errorText;
      
      console.log('⚠️ Proxy unavailable (status ' + response.status + '), trying direct...');
    } catch (error) {
      console.log('⚠️ Proxy fetch error:', error instanceof Error ? error.message : String(error));
      proxyError = error;
    }

    // Fallback: chiamata diretta (potrebbe avere problemi CORS)
    try {
      const directUrl = this.buildUrl(action, params);
      console.log('🔄 Trying direct API call:', directUrl);
      const response = await fetch(directUrl, {
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'SandTV/1.0'
        },
      });
      
      console.log('✅ Direct call response:', response.status);
      return response;
    } catch (directError) {
      console.error('❌ Direct call also failed:', directError instanceof Error ? directError.message : String(directError));
      console.error('❌ Original proxy error was:', proxyError);
      
      // Se entrambi falliscono, rilancia l'errore del proxy
      throw new Error('Proxy non disponibile e chiamata diretta fallita. Verifica che le Netlify Functions siano deployate correttamente.');
    }
  }




  /**
   * Verifica credenziali e connessione
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔗 Testing Xtream connection...');
      
      const response = await this.fetchWithFallback('get_live_categories');
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response type:', response.type);
      console.log('📡 Response headers:', {
        'content-type': response.headers.get('content-type'),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('❌ HTTP Error:', response.status, errorText.substring(0, 200));
        
        if (response.status === 401 || response.status === 403) {
          return { success: false, error: 'Credenziali non valide' };
        }
        if (response.status === 502 || response.status === 504) {
          return { success: false, error: 'Errore proxy server' };
        }
        return { success: false, error: `HTTP ${response.status}` };
      }

      const bodyText = await response.text();
      console.log('📄 Response body length:', bodyText.length, 'bytes');
      console.log('📄 Response body (first 300 chars):', bodyText.substring(0, 300));
      
      let data;
      try {
        data = JSON.parse(bodyText);
        console.log('✅ JSON parsed successfully, type:', typeof data);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error('❌ JSON parse error:', errorMsg);
        console.error('❌ Invalid JSON around position:', bodyText.substring(Math.max(0, 3702300), 3702400));
        return { success: false, error: 'Server ha restituito dati non validi (JSON malformato)' };
      }
      
      console.log('✅ Connection successful, parsed data type:', typeof data);

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

    const url = this.getProxyUrl('get_server_info');
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

    const response = await this.fetchWithFallback('get_live_categories');
    const text = await response.text();
    const data = this.safeJsonParse(text, []);

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

    const response = await this.fetchWithFallback('get_live_streams', params);
    const text = await response.text();
    const data = this.safeJsonParse(text, []);

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

    const response = await this.fetchWithFallback('get_vod_categories');
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

    const response = await this.fetchWithFallback('get_vod_streams', params);
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

    const response = await this.fetchWithFallback('get_vod_info', { vod_id: vodId });
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

    const response = await this.fetchWithFallback('get_series_categories');
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

    const response = await this.fetchWithFallback('get_series', params);
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

    const response = await this.fetchWithFallback('get_series_info', { series_id: seriesId });
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

    const response = await this.fetchWithFallback('get_epg', { stream_id: channelId });
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

    const response = await this.fetchWithFallback('get_epg_range', {
      range_start: startTime,
      range_end: endTime,
    });
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

  private safeJsonParse<T>(text: string, fallback: T): T {
    try {
      return JSON.parse(text);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error('❌ JSON parse error:', errorMsg);
      console.error('❌ Text length:', text.length);
      console.error('❌ First 500 chars:', text.substring(0, 500));
      console.error('❌ Last 500 chars:', text.substring(Math.max(0, text.length - 500)));
      return fallback;
    }
  }

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
