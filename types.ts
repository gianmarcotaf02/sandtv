
export interface Channel {
  id: string;
  name: string;
  url: string;
  logo: string | null;
  group: string;
  tvg: {
    id: string | null;
    name: string | null;
    logo: string | null;
  };
  contentType?: 'live' | 'on-demand' | 'vod' | 'catchup' | 'unknown';
  contentTypeConfidence?: number;
}

export interface Program {
  channel: string;
  title: string;
  desc: string | null;
  start: Date;
  stop: Date;
  icon: string | null;
  category?: string | null;
  episodeNum?: string | null;
}

export interface EpgData {
  [channelId: string]: Program[];
}

export interface Group {
    id: string;
    name: string;
    channels: string[]; // array of channel ids
}

export type View = 'LIST' | 'GRID' | 'EPG';
