import { useCallback } from 'react';
import { Channel, EpgData } from '../types';

export const useM3UParser = () => {
  const parseM3U = useCallback(
    (content: string): Promise<{ channels: Channel[]; epgUrl: string | null }> => {
      return new Promise((resolve, reject) => {
        const worker = new Worker(
          new URL('../workers/m3u.worker.ts', import.meta.url),
          { type: 'module' }
        );

        worker.onmessage = (e) => {
          if (e.data.type === 'M3U_PARSED') {
            resolve({
              channels: e.data.channels,
              epgUrl: e.data.epgUrl,
            });
            worker.terminate();
          } else if (e.data.type === 'PARSE_ERROR') {
            reject(new Error(e.data.error));
            worker.terminate();
          }
        };

        worker.onerror = (error) => {
          reject(error);
          worker.terminate();
        };

        worker.postMessage({ type: 'PARSE_M3U', content });

        // Timeout after 30 seconds
        setTimeout(() => {
          worker.terminate();
          reject(new Error('M3U parsing timeout'));
        }, 30000);
      });
    },
    []
  );

  return { parseM3U };
};

export const useXMLTVParser = () => {
  const parseXMLTV = useCallback((content: string): Promise<EpgData> => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('../workers/xmltv.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (e) => {
        if (e.data.type === 'XMLTV_PARSED') {
          // Convert ISO strings back to Date objects
          const epgData: EpgData = {};
          Object.keys(e.data.epgData).forEach(channelId => {
            epgData[channelId] = e.data.epgData[channelId].map((program: any) => ({
              ...program,
              start: new Date(program.start),
              stop: new Date(program.stop),
            }));
          });
          
          resolve(epgData);
          worker.terminate();
        } else if (e.data.type === 'PARSE_ERROR') {
          reject(new Error(e.data.error));
          worker.terminate();
        }
      };

      worker.onerror = (error) => {
        reject(error);
        worker.terminate();
      };

      worker.postMessage({ type: 'PARSE_XMLTV', content });

      // Timeout after 60 seconds (EPG files can be large)
      setTimeout(() => {
        worker.terminate();
        reject(new Error('XMLTV parsing timeout'));
      }, 60000);
    });
  }, []);

  return { parseXMLTV };
};
