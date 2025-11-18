import React, { useMemo } from 'react';
import { Channel, EpgData } from '../types';
import { PlayIcon } from './icons';
import { getContentTypeLabel, getContentTypeColor } from '../lib/contentDetector';

interface GridViewProps {
  channels: Channel[];
  currentChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  epgData: EpgData;
}

const GridView: React.FC<GridViewProps> = ({ channels, currentChannel, onSelectChannel, epgData }) => {
  
  // Debug: log EPG data structure (only once)
  React.useEffect(() => {
    const matchCount = channels.filter(ch => {
      const keys = [ch.tvg.id, ch.id, ch.name].filter(Boolean);
      return keys.some(key => epgData[key]);
    }).length;
    console.log(`GridView: ${matchCount}/${channels.length} canali con EPG`);
  }, [epgData, channels]);
  
  const getChannelCurrentProgram = (channel: Channel) => {
    // Try multiple possible keys
    const possibleKeys = [
      channel.tvg.id || '',
      channel.id,
      channel.name
    ].filter(Boolean);
    
    for (const key of possibleKeys) {
      if (epgData[key]) {
        const now = new Date();
        return epgData[key].find(p => now >= p.start && now <= p.stop) || null;
      }
    }
    
    return null;
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
        {channels.map((channel) => {
          const currentProgram = getChannelCurrentProgram(channel);
          const isActive = currentChannel?.id === channel.id;
          const isLiveNow = !!currentProgram;
          
          return (
            <div
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className={`
                relative group cursor-pointer rounded-2xl overflow-hidden
                bg-white dark:bg-gray-800 shadow-md hover:shadow-xl
                transform transition-all duration-200 hover:scale-105
                ${isActive ? 'ring-4 ring-blue-500 scale-105' : ''}
              `}
            >
              {/* Channel Logo/Thumbnail */}
              <div className="aspect-video bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center relative overflow-hidden">
                {channel.logo ? (
                  <img
                    src={channel.logo}
                    alt={channel.name}
                    className="w-full h-full object-contain p-4"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`${channel.logo ? 'hidden' : ''} text-4xl font-bold text-white/20`}>
                  {channel.name.charAt(0)}
                </div>
                
                {/* Play overlay on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <div className="bg-blue-600 rounded-full p-3">
                    <PlayIcon className="w-8 h-8 text-white" />
                  </div>
                </div>

                {/* Live indicator (shown when channel has a current program) */}
                {isLiveNow && (
                  <div className="absolute top-2 right-2 bg-red-600 rounded-full px-2 py-1 text-xs font-bold text-white flex items-center gap-1">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    LIVE
                  </div>
                )}
                
                {/* Content Type Badge */}
                {channel.contentType && (
                  <div className={`absolute top-2 left-2 rounded-full px-2 py-1 text-xs font-bold text-white ${getContentTypeColor(channel.contentType as any)}`}>
                    {getContentTypeLabel(channel.contentType as any).split(' ')[1]}
                  </div>
                )}
              </div>

              {/* Channel Info */}
              <div className="p-3">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate mb-1">
                  {channel.name}
                </h3>
                
                {currentProgram ? (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate font-medium">
                      {currentProgram.title}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-500">
                      {currentProgram.start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} - {currentProgram.stop.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div className="h-1 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ 
                          width: `${Math.min(100, Math.max(0, ((Date.now() - currentProgram.start.getTime()) / (currentProgram.stop.getTime() - currentProgram.start.getTime())) * 100))}%` 
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {channel.group}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GridView;
