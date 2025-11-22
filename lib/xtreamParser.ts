/**
 * Xtream Parser
 * Converte risposte Xtream API al formato interno dell'app (Channel, Program, etc.)
 */

import { Channel, Program } from '../types';
import {
  XtreamLiveChannel,
  XtreamVOD,
  XtreamSeries,
  XtreamSeriesEpisode,
  XtreamEPGProgram,
} from './xtreamApi';
import { detectContentType, ContentType } from './contentDetector';

export interface XtreamPlaylistData {
  liveChannels: Channel[];
  vodChannels: Channel[];
  seriesChannels: Channel[];
  epgData: Record<string, Program[]>;
}

/**
 * Converti canale Xtream live a Channel app
 */
export function parseXtreamLiveChannel(
  channel: XtreamLiveChannel,
  getStreamUrl: (streamId: number) => string
): Channel {
  const id = `xtream_live_${channel.stream_id}`;
  const name = channel.name;
  const url = getStreamUrl(channel.stream_id);
  const logo = channel.stream_icon || null;
  const group = channel.category_name || 'Live';

  // Auto-detect tipo contenuto
  const detection = detectContentType({
    channelName: name,
    groupTitle: group,
    url,
    tvgId: `xtream_${channel.stream_id}`,
    epgUrl: 'https://dummy.com/epg.xml', // Placeholder - Xtream usa API
    hasEpgData: !!channel.epg_channel_id,
  });

  const channel_obj: Channel = {
    id,
    name,
    url,
    logo,
    group,
    tvg: {
      id: `xtream_${channel.stream_id}`,
      name,
      logo,
    },
    contentType: detection.contentType as any,
    contentTypeConfidence: detection.confidence,
  };

  // Aggiungi metadati Xtream
  (channel_obj as any).xtreamStreamId = channel.stream_id;
  (channel_obj as any).xtreamType = 'live';
  (channel_obj as any).xtreamCatchup = channel.tv_archive === 1;
  (channel_obj as any).xtreamCatchupDays = channel.tv_archive_duration;

  return channel_obj;
}

/**
 * Converti VOD Xtream a Channel app
 */
export function parseXtreamVOD(
  vod: XtreamVOD,
  getStreamUrl: (streamId: number) => string
): Channel {
  const id = `xtream_vod_${vod.stream_id}`;
  const name = vod.title || vod.name;
  const url = getStreamUrl(vod.stream_id);
  const logo = vod.poster || vod.stream_icon || null;
  const group = vod.category_name || 'VOD';

  // Auto-detect tipo contenuto
  const detection = detectContentType({
    channelName: name,
    groupTitle: 'VOD',
    url,
    tvgId: `xtream_vod_${vod.stream_id}`,
  });

  const channel_obj: Channel = {
    id,
    name,
    url,
    logo,
    group,
    tvg: {
      id: `xtream_vod_${vod.stream_id}`,
      name,
      logo,
    },
    contentType: 'on-demand',
    contentTypeConfidence: 1.0,
  };

  // Aggiungi metadati Xtream VOD
  (channel_obj as any).xtreamStreamId = vod.stream_id;
  (channel_obj as any).xtreamType = 'vod';
  (channel_obj as any).xtreamYear = vod.year;
  (channel_obj as any).xtreamGenre = vod.genre;
  (channel_obj as any).xtreamRating = vod.rating_5based;
  (channel_obj as any).xtreamDuration = vod.duration;
  (channel_obj as any).xtreamDescription = vod.plot;
  (channel_obj as any).xtreamCast = vod.cast;

  return channel_obj;
}

/**
 * Converti Serie Xtream a Channel app
 */
export function parseXtreamSeries(
  series: XtreamSeries,
  getStreamUrl: (seriesId: number) => string
): Channel {
  const id = `xtream_series_${series.series_id}`;
  const name = series.title || series.name;
  const logo = series.poster || series.stream_icon || null;
  const group = series.category_name || 'Serie';

  // URL dummy - per serie serve episodio specifico
  const url = 'xtream://series/' + series.series_id;

  const channel_obj: Channel = {
    id,
    name,
    url,
    logo,
    group,
    tvg: {
      id: `xtream_series_${series.series_id}`,
      name,
      logo,
    },
    contentType: 'on-demand',
    contentTypeConfidence: 1.0,
  };

  // Aggiungi metadati Xtream Serie
  (channel_obj as any).xtreamSeriesId = series.series_id;
  (channel_obj as any).xtreamType = 'series';
  (channel_obj as any).xtreamYear = series.year;
  (channel_obj as any).xtreamGenre = series.genre;
  (channel_obj as any).xtreamRating = series.rating_5based;
  (channel_obj as any).xtreamDescription = series.plot;
  (channel_obj as any).xtreamCast = series.cast;

  return channel_obj;
}

/**
 * Converti episodio serie a URL playable
 */
export function getXtreamSeriesEpisodeUrl(
  seriesId: number,
  episode: XtreamSeriesEpisode,
  getStreamUrl: (seriesId: number, season: number, episodeId: number) => string
): string {
  return getStreamUrl(seriesId, episode.season, episode.id);
}

/**
 * Converti programmi EPG Xtream a Program app
 */
export function parseXtreamEPG(
  programs: XtreamEPGProgram[]
): Record<string, Program[]> {
  const epgData: Record<string, Program[]> = {};

  for (const prog of programs) {
    const channelId = prog.channel_id || prog.epg_id;

    if (!epgData[channelId]) {
      epgData[channelId] = [];
    }

    const program: Program = {
      channel: channelId,
      title: prog.title,
      desc: prog.description || null,
      start: new Date(prog.start * 1000),
      stop: new Date(prog.end * 1000),
      icon: prog.image || null,
      category: prog.genre || null,
    };

    epgData[channelId].push(program);
  }

  // Ordina programmi per orario
  for (const channelId in epgData) {
    epgData[channelId].sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  return epgData;
}

/**
 * Migliora metadati canale Xtream live con informazioni EPG
 */
export function enrichLiveChannelWithEPG(
  channel: Channel,
  currentProgram: Program | null
): Channel {
  if (!currentProgram) return channel;

  return {
    ...channel,
    tvg: {
      ...channel.tvg,
      name: channel.tvg.name, // Tieni il nome Xtream
    },
  };
}

/**
 * Crea elenco VOD con metadata ricchi
 */
export function createVODPlaylist(
  vods: XtreamVOD[],
  getStreamUrl: (streamId: number) => string
): Channel[] {
  return vods.map((vod) => parseXtreamVOD(vod, getStreamUrl));
}

/**
 * Crea elenco serie con metadata ricchi
 */
export function createSeriesPlaylist(
  series: XtreamSeries[],
  getStreamUrl: (seriesId: number) => string
): Channel[] {
  return series.map((s) => parseXtreamSeries(s, getStreamUrl));
}

/**
 * Valuta qualità dello stream Xtream
 */
export function assessXtreamStreamQuality(channel: Channel): 'live' | 'vod' | 'unknown' {
  const xtreamType = (channel as any).xtreamType;
  return xtreamType === 'live' || xtreamType === 'vod' ? xtreamType : 'unknown';
}

/**
 * Genera nome playlist da credenziali Xtream
 */
export function generateXtreamPlaylistName(server: string, username: string): string {
  try {
    const url = new URL(server);
    const host = url.hostname;
    return `Xtream: ${username}@${host}`;
  } catch {
    return `Xtream: ${username}`;
  }
}

/**
 * Converte informazioni di catchup da Xtream
 */
export function parseCatchupInfo(channel: Channel): { available: boolean; days: number } {
  const xtreamType = (channel as any).xtreamType;
  if (xtreamType !== 'live') return { available: false, days: 0 };

  const catchup = (channel as any).xtreamCatchup || false;
  const days = (channel as any).xtreamCatchupDays || 0;

  return {
    available: catchup && days > 0,
    days,
  };
}

/**
 * Organizza canali per categoria
 */
export function groupChannelsByCategory(channels: Channel[]): Record<string, Channel[]> {
  const grouped: Record<string, Channel[]> = {};

  for (const channel of channels) {
    const category = channel.group || 'Uncategorized';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(channel);
  }

  return grouped;
}

export default {
  parseXtreamLiveChannel,
  parseXtreamVOD,
  parseXtreamSeries,
  parseXtreamEPG,
  createVODPlaylist,
  createSeriesPlaylist,
  groupChannelsByCategory,
};
