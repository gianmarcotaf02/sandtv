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
  testXtreamConnection: (credentials: XtreamCredentials) => Promise<boolean>;
}

export function useXtreamParser(): UseXtreamParserReturn {
  /**
   * Testa connessione Xtream
   */
  const testXtreamConnection = useCallback(async (credentials: XtreamCredentials) => {
    try {
      const client = createXtreamClient(credentials);
      const result = await client.testConnection();
      return result.success;
    } catch (error) {
      console.error('Xtream connection test failed:', error);
      return false;
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
        // 1. Carica categorie
        const [liveCategories, vodCategories, seriesCategories] = await Promise.all([
          client.getLiveCategories(),
          client.getVODCategories(),
          client.getSeriesCategories(),
        ]);

        // 2. Carica canali da tutte le categorie
        const liveChannelsPromises = liveCategories.map((cat) =>
          client.getLiveChannels(cat.category_id)
        );
        const vodPromises = vodCategories.map((cat) => client.getVOD(cat.category_id));
        const seriesPromises = seriesCategories.map((cat) => client.getSeries(cat.category_id));

        const [allLiveChannels, allVODs, allSeries] = await Promise.all([
          Promise.all(liveChannelsPromises).then((results) => results.flat()),
          Promise.all(vodPromises).then((results) => results.flat()),
          Promise.all(seriesPromises).then((results) => results.flat()),
        ]);

        // 3. Converti a formato app
        const channels = allLiveChannels.map((ch) =>
          parseXtreamLiveChannel(ch, (streamId) => client.getStreamUrl(streamId, 'live'))
        );

        const vodChannels = allVODs.map((vod) =>
          parseXtreamVOD(vod, (streamId) => client.getStreamUrl(streamId, 'vod'))
        );

        const seriesChannels = allSeries.map((series) =>
          parseXtreamSeries(series, (seriesId) =>
            client.getSeriesStreamUrl(seriesId, 1, 1) // Dummy per primo episodio
          )
        );

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
