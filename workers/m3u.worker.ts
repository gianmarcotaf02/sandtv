// Web Worker for parsing M3U playlists
import { Channel } from '../types';

interface ParseM3UMessage {
  type: 'PARSE_M3U';
  content: string;
}

interface ParseM3UResult {
  type: 'M3U_PARSED';
  channels: Channel[];
  epgUrl: string | null;
}

interface ParseError {
  type: 'PARSE_ERROR';
  error: string;
}

type WorkerMessage = ParseM3UMessage;
type WorkerResponse = ParseM3UResult | ParseError;

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, content } = e.data;

  if (type === 'PARSE_M3U') {
    try {
      const result = parseM3U(content);
      const response: ParseM3UResult = {
        type: 'M3U_PARSED',
        ...result,
      };
      self.postMessage(response);
    } catch (error) {
      const response: ParseError = {
        type: 'PARSE_ERROR',
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
      self.postMessage(response);
    }
  }
};

function parseM3U(content: string): { channels: Channel[]; epgUrl: string | null } {
  const lines = content.split('\n');
  const channels: Channel[] = [];
  let epgUrl: string | null = null;

  // Extract EPG URL from header
  const urlTvLine = lines.find((line) => line.startsWith('#EXTM3U') && line.includes('url-tvg='));
  if (urlTvLine) {
    const match = urlTvLine.match(/url-tvg="([^"]+)"/);
    if (match) epgUrl = match[1];
  }

  // Parse channels
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
      const lineInfo = lines[i];
      const nameMatch = lineInfo.match(/,(.*)$/);
      const name = nameMatch ? nameMatch[1].trim() : 'Unknown Channel';

      const getAttr = (attr: string): string | null => {
        const match = lineInfo.match(new RegExp(`${attr}="([^"]+)"`));
        return match ? match[1] : null;
      };

      const url = lines[++i]?.trim() || '';

      if (url) {
        const tvgId = getAttr('tvg-id');
        const tvgName = getAttr('tvg-name');
        const tvgLogo = getAttr('tvg-logo');
        const group = getAttr('group-title') || 'Uncategorized';

        channels.push({
          id: `${tvgId || name}-${url.substring(0, 20)}`,
          name,
          url,
          logo: tvgLogo,
          group,
          tvg: {
            id: tvgId,
            name: tvgName,
            logo: tvgLogo,
          },
        });
      }
    }
  }

  return { channels, epgUrl };
}

export {};
