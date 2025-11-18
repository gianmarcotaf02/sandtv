import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Star } from 'lucide-react';
import { Channel, EpgData } from '../types';
import { getContentTypeLabel, getContentTypeColor } from '../lib/contentDetector';

interface ChannelListProps {
  channels: Channel[];
  currentChannel: Channel | null;
  favorites: string[];
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
  onAddToGroup?: (channel: Channel) => void;
  isCustomGroup: boolean;
  epgData: EpgData;
}

const ChannelItem: React.FC<{
    channel: Channel;
    isCurrent: boolean;
    isFavorite: boolean;
    onSelectChannel: (channel: Channel) => void;
    onToggleFavorite: (channelId: string) => void;
    onAddToGroup?: (channel: Channel) => void;
    isCustomGroup: boolean;
    epgData: EpgData;
}> = React.memo(({ channel, isCurrent, isFavorite, onSelectChannel, onToggleFavorite, onAddToGroup, isCustomGroup, epgData }) => {
    
    // Get current program
    const getCurrentProgram = () => {
        const possibleKeys = [
            channel.tvg.id || '',
            channel.id,
            channel.name
        ].filter(Boolean);
        
        for (const key of possibleKeys) {
            if (epgData[key]) {
                const now = new Date();
                const programs = epgData[key];
                
                // Debug: log first channel's programs to see dates
                if (channel.name === 'Rai 1' && Math.random() < 0.1) {
                    console.log(`🔍 Debug ${channel.name}:`, {
                        now: now.toISOString(),
                        nowTime: now.getTime(),
                        totalPrograms: programs.length,
                        firstProgram: programs[0] ? {
                            title: programs[0].title,
                            start: programs[0].start,
                            startISO: programs[0].start instanceof Date ? programs[0].start.toISOString() : programs[0].start,
                            stop: programs[0].stop,
                            stopISO: programs[0].stop instanceof Date ? programs[0].stop.toISOString() : programs[0].stop,
                            isDate: programs[0].start instanceof Date
                        } : null,
                        lastProgram: programs[programs.length - 1] ? {
                            title: programs[programs.length - 1].title,
                            start: programs[programs.length - 1].start,
                            stop: programs[programs.length - 1].stop
                        } : null
                    });
                }
                
                const program = epgData[key].find(p => now >= p.start && now <= p.stop) || null;
                return program;
            }
        }
        return null;
    };
    
    const currentProgram = getCurrentProgram();
    
    // Debug: log if we found a program (only occasionally to avoid spam)
    React.useEffect(() => {
        if (currentProgram && Math.random() < 0.01) {
            console.log(`✅ ChannelList found EPG for ${channel.name}:`, currentProgram.title);
        }
    }, [currentProgram, channel.name]);
    
    // Calculate progress percentage
    const getProgress = () => {
        if (!currentProgram) return 0;
        const now = new Date().getTime();
        const start = currentProgram.start.getTime();
        const stop = currentProgram.stop.getTime();
        const total = stop - start;
        const elapsed = now - start;
        return Math.min(Math.max((elapsed / total) * 100, 0), 100);
    };
    
    const progress = getProgress();
    
    return (
        <div
            onClick={() => onSelectChannel(channel)}
            className={`flex flex-col p-2 rounded-xl cursor-pointer transition-all duration-200 transform my-1 ${
            isCurrent ? 'bg-blue-700 scale-105 shadow-lg' : 'hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-105'
            }`}
        >
            <div className="flex items-center">
                <img src={channel.logo || 'https://via.placeholder.com/50'} alt={channel.name} className="w-12 h-12 object-contain mr-3 bg-gray-200 dark:bg-gray-900 rounded-2xl flex-shrink-0" />
                <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900 dark:text-gray-200 truncate font-medium">{channel.name}</span>
                        {channel.contentType && (
                            <span className={`text-xs px-2 py-0.5 rounded-full text-white whitespace-nowrap flex-shrink-0 ${getContentTypeColor(channel.contentType as any)}`}>
                                {getContentTypeLabel(channel.contentType as any)}
                            </span>
                        )}
                    </div>
                    {currentProgram ? (
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                            <div className="truncate font-medium">{currentProgram.title}</div>
                            <div className="flex items-center gap-1 text-[10px]">
                                <span>
                                    {currentProgram.start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span>-</span>
                                <span>
                                    {currentProgram.stop.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full h-1 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-gray-500 dark:text-gray-500 italic">Nessun programma</div>
                    )}
                </div>
                {isCustomGroup && onAddToGroup && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddToGroup(channel); }}
                    className="ml-2 p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white flex-shrink-0"
                  >
                    +
                  </button>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(channel.id); }}
                    className={`ml-2 p-2 rounded-full transition-colors flex-shrink-0 ${isFavorite ? 'text-yellow-500' : 'text-gray-500 dark:text-gray-600 hover:text-yellow-500'}`}
                    aria-label={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                >
                    <Star className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} />
                </button>
            </div>
        </div>
    );
});


const ChannelList: React.FC<ChannelListProps> = ({ channels, currentChannel, favorites, onSelectChannel, onToggleFavorite, onAddToGroup, isCustomGroup, epgData }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 95, // Increased height for EPG info
    overscan: 5, // Render 5 extra items above and below viewport
  });

  if (channels.length === 0) {
    return (
      <div className="w-80 p-4 text-center text-gray-600 dark:text-gray-400">
        Nessun canale in questo gruppo.
      </div>
    );
  }

  return (
    <aside ref={parentRef} className="w-80 p-2 overflow-y-auto h-full">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const channel = channels[virtualItem.index];
          return (
            <div
              key={channel.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ChannelItem
                channel={channel}
                isCurrent={currentChannel?.id === channel.id}
                isFavorite={favorites.includes(channel.id)}
                onSelectChannel={onSelectChannel}
                onToggleFavorite={onToggleFavorite}
                onAddToGroup={onAddToGroup}
                isCustomGroup={isCustomGroup}
                epgData={epgData}
              />
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default ChannelList;
