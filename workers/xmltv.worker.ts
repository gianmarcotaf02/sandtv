// Web Worker for parsing XMLTV EPG data
import { Program, EpgData } from '../types';

interface ParseXMLTVMessage {
  type: 'PARSE_XMLTV';
  content: string;
}

interface ParseXMLTVResult {
  type: 'XMLTV_PARSED';
  epgData: EpgData;
}

interface ParseError {
  type: 'PARSE_ERROR';
  error: string;
}

type WorkerMessage = ParseXMLTVMessage;
type WorkerResponse = ParseXMLTVResult | ParseError;

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, content } = e.data;

  if (type === 'PARSE_XMLTV') {
    try {
      const epgData = parseXMLTV(content);
      
      // Convert Date objects to ISO strings for serialization
      const serializedEpgData: any = {};
      Object.keys(epgData).forEach(channelId => {
        serializedEpgData[channelId] = epgData[channelId].map(program => ({
          ...program,
          start: program.start.toISOString(),
          stop: program.stop.toISOString(),
        }));
      });
      
      const response: ParseXMLTVResult = {
        type: 'XMLTV_PARSED',
        epgData: serializedEpgData,
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

function parseXMLTV(content: string): EpgData {
  // Parse XML manually since DOMParser is not available in Web Workers
  const programs: Program[] = [];

  // Extract all programme elements using regex
  const programmeRegex = /<programme\s+([^>]+)>([\s\S]*?)<\/programme>/g;
  let match;

  while ((match = programmeRegex.exec(content)) !== null) {
    const attributes = match[1];
    const programContent = match[2];

    try {
      // Extract attributes
      const channelMatch = attributes.match(/channel="([^"]+)"/);
      const startMatch = attributes.match(/start="([^"]+)"/);
      const stopMatch = attributes.match(/stop="([^"]+)"/);

      if (!channelMatch || !startMatch || !stopMatch) continue;

      const channel = channelMatch[1];
      const startStr = startMatch[1];
      const stopStr = stopMatch[1];

      // Parse XMLTV timestamp format: YYYYMMDDHHmmss +ZZZZ
      // The timestamp is already in the timezone specified by the offset
      // So we just parse it as a local date and ignore the offset
      const parseXMLTVDate = (dateStr: string): Date => {
        const match = dateStr.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
        if (!match) {
          throw new Error(`Invalid date format: ${dateStr}`);
        }
        const [, year, month, day, hour, minute, second] = match;
        
        // Parse as local date - the time is already in the correct timezone
        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        );
        
        return date;
      };

      // Extract title
      const titleMatch = programContent.match(/<title[^>]*>([\s\S]*?)<\/title>/);
      const title = titleMatch ? titleMatch[1].trim() : 'No Title';

      // Extract description
      const descMatch = programContent.match(/<desc[^>]*>([\s\S]*?)<\/desc>/);
      const desc = descMatch ? descMatch[1].trim() : null;

      // Extract icon
      const iconMatch = programContent.match(/<icon\s+src="([^"]+)"/);
      const icon = iconMatch ? iconMatch[1] : null;

      // Extract category
      const categoryMatch = programContent.match(/<category[^>]*>([\s\S]*?)<\/category>/);
      const category = categoryMatch ? categoryMatch[1].trim() : null;

      // Extract episode number
      const episodeNumMatch = programContent.match(/<episode-num[^>]*>([\s\S]*?)<\/episode-num>/);
      const episodeNum = episodeNumMatch ? episodeNumMatch[1].trim() : null;

      programs.push({
        channel,
        title,
        desc,
        start: parseXMLTVDate(startStr),
        stop: parseXMLTVDate(stopStr),
        icon,
        category,
        episodeNum,
      });
    } catch (error) {
      console.error('Error parsing program:', error);
    }
  }

  // Group programs by channel
  const epgData: EpgData = {};
  programs.forEach((prog) => {
    if (!epgData[prog.channel]) {
      epgData[prog.channel] = [];
    }
    epgData[prog.channel].push(prog);
  });

  // Sort programs by start time for each channel
  Object.keys(epgData).forEach((channelId) => {
    epgData[channelId].sort((a, b) => a.start.getTime() - b.start.getTime());
  });

  return epgData;
}

export {};
