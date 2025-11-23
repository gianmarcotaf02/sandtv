/**
 * Hook: useXtreamParser
 * Gestisce il parsing da Xtream API come alternativa a M3U
 */

import { useCallback } from 'react';
import { Channel, Program } from '../types';
import {
  createXtreamClient,
  XtreamCredentials,
  XtreamApiClient,
} from '../lib/xtreamApi';
import {
  parseXtreamLiveChannel,
  parseXtreamVOD,
  parseXtreamSeries,
  parseXtreamEPG,
  generateXtreamPlaylistName,
} from '../lib/xtreamParser';

export interface UseXtreamParserReturn {
  parseXtreamPlaylist: (
    credentials: XtreamCredentials
  ) => Promise<{
    channels: Channel[];
    vodChannels: Channel[];
    seriesChannels: Channel[];
    epgData: Record<string, Program[]>;
    playlistName: string;
  }>;
  testXtreamConnection: (credentials: XtreamCredentials) => Promise<{ success: boolean; error?: string }>;
}

export function useXtreamParser(): UseXtreamParserReturn {
  /**
   * Testa connessione Xtream
   */
  const testXtreamConnection = useCallback(async (credentials: XtreamCredentials) => {
    try {
      const client = createXtreamClient(credentials);
      const result = await client.testConnection();
      return result;
    } catch (error) {
      console.error('Xtream connection test failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Errore sconosciuto' };
    }
  }, []);

  /**
   * Parsing completo playlist Xtream
   */
  const parseXtreamPlaylist = useCallback(
    async (credentials: XtreamCredentials) => {
      const client = createXtreamClient(credentials);
      const playlistName = generateXtreamPlaylistName(credentials.server, credentials.username);

      try {
        console.log('📡 Caricamento canali live Xtream...');
        
        // 1. Carica SOLO categorie live (non VOD/serie per ora)
        const liveCategories = await client.getLiveCategories();
        console.log('✅ Caricate', liveCategories.length, 'categorie live');

        // 2. Carica canali live (limite prime 5 categorie per test)
        const categoriesToLoad = liveCategories.slice(0, 5); // Solo prime 5 categorie
        console.log('📺 Caricamento canali dalle prime', categoriesToLoad.length, 'categorie...');
        
        const liveChannelsPromises = categoriesToLoad.map((cat) =>
          client.getLiveChannels(cat.category_id)
        );

        const liveChannelsResults = await Promise.all(liveChannelsPromises);
        console.log('📦 Risultati ricevuti:', liveChannelsResults.length);
        
        // Valida che tutti i risultati siano array
        const validResults = liveChannelsResults.filter(result => Array.isArray(result));
        console.log('✅ Risultati validi:', validResults.length);
        
        const allLiveChannels = validResults.flat();
        console.log('✅ Caricati', allLiveChannels.length, 'canali live totali');

        // 3. Converti a formato app (con validazione)
        const channels = allLiveChannels
          .filter(ch => ch && ch.stream_id && ch.name) // Valida ogni canale
          .map((ch) => {
            try {
              return parseXtreamLiveChannel(ch, (streamId) => client.getStreamUrl(streamId, 'live'));
            } catch (error) {
              console.error('❌ Errore parsing canale:', ch.name, error);
              return null;
            }
          })
          .filter(ch => ch !== null) as Channel[];
        
        console.log('✅ Convertiti', channels.length, 'canali');

        // VOD e Serie: array vuoti per ora (caricamento lazy in futuro)
        const vodChannels: Channel[] = [];
        const seriesChannels: Channel[] = [];
        
        console.log('ℹ️ VOD e Serie non caricati (troppo grande, implementare lazy loading)');

        // 4. Carica EPG per canali live
        let epgData: Record<string, Program[]> = {};
        try {
          const now = Math.floor(Date.now() / 1000);
          const next24h = now + 86400; // +24 ore
          const xtreamEpg = await client.getLiveEPGRange(now, next24h);
          epgData = parseXtreamEPG(xtreamEpg);
        } catch (error) {
          console.warn('Errore caricamento EPG Xtream:', error);
          // Continua senza EPG
        }

        return {
          channels,
          vodChannels,
          seriesChannels,
          epgData,
          playlistName,
        };
      } catch (error) {
        console.error('Errore parsing Xtream:', error);
        throw new Error(`Errore caricamento Xtream: ${error instanceof Error ? error.message : 'Sconosciuto'}`);
      }
    },
    []
  );

  return {
    parseXtreamPlaylist,
    testXtreamConnection,
  };
}

export default useXtreamParser;
