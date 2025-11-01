import React, { useState, useEffect, useRef } from 'react';
import { Channel, EpgData, Program } from '../types';

interface EpgViewProps {
  channels: Channel[];
  epg: EpgData;
  onSelectChannel: (channel: Channel) => void;
}

const EpgView: React.FC<EpgViewProps> = ({ channels, epg, onSelectChannel }) => {
  const [now, setNow] = useState(new Date());
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  // Debug: log EPG data when it changes
  useEffect(() => {
    console.log('📺 EpgView ricevuto EPG:', {
      canaliConEPG: Object.keys(epg).length,
      primiCanaliEPG: Object.keys(epg).slice(0, 5),
      canaliTotali: channels.length
    });
  }, [epg, channels.length]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll to current time on load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (bodyScrollRef.current && headerScrollRef.current) {
        const currentTimePixels = (now.getHours() * 60 + now.getMinutes()) * PIXELS_PER_MINUTE;
        const scrollLeft = Math.max(0, currentTimePixels - 60 * PIXELS_PER_MINUTE);
        bodyScrollRef.current.scrollLeft = scrollLeft;
        headerScrollRef.current.scrollLeft = scrollLeft;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Sync horizontal scroll between header and EPG grid
  useEffect(() => {
    // We'll sync via the grid's scroll position
    const syncHeaderScroll = () => {
      // The header will sync when EPG grid scrolls
    };
    return () => {};
  }, []);

  // Get midnight of today
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const PIXELS_PER_MINUTE = 1; // 1 pixel per minute
  const HOUR_WIDTH = 60 * PIXELS_PER_MINUTE; // 60 pixels per hour
  const HOURS_TO_SHOW = 48;
  const TOTAL_WIDTH = HOURS_TO_SHOW * HOUR_WIDTH;

  // Calculate position of now (in pixels)
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowPixels = nowMinutes * PIXELS_PER_MINUTE;

  // Calculate program position and width
  const getProgramStyle = (program: Program) => {
    const startDate = program.start instanceof Date ? program.start : new Date(String(program.start));
    const stopDate = program.stop instanceof Date ? program.stop : new Date(String(program.stop));

    // Handle invalid dates
    if (isNaN(startDate.getTime()) || isNaN(stopDate.getTime())) {
      console.warn('Invalid program dates:', program.title, program.start, program.stop);
      return { left: '0px', width: '30px' };
    }

    // Calculate minutes from today's midnight
    const minutesFromMidnight = (startDate.getTime() - todayMidnight.getTime()) / (1000 * 60);
    let durationMinutes = (stopDate.getTime() - startDate.getTime()) / (1000 * 60);

    // Validate duration - if negative or too large, use default
    if (durationMinutes <= 0 || durationMinutes > 24 * 60) {
      console.warn('Invalid duration for program:', program.title, 'duration:', durationMinutes, 'mins');
      durationMinutes = 30; // Default 30 minutes
    }

    // Position e width in pixels
    const leftPixels = minutesFromMidnight * PIXELS_PER_MINUTE;
    const widthPixels = Math.max(30, Math.round(durationMinutes * PIXELS_PER_MINUTE));

    return {
      left: `${Math.max(0, Math.round(leftPixels))}px`,
      width: `${widthPixels}px`,
    };
  };

  const isLive = (program: Program): boolean => {
    const startDate = program.start instanceof Date ? program.start : new Date(program.start);
    const stopDate = program.stop instanceof Date ? program.stop : new Date(program.stop);
    return now >= startDate && now <= stopDate;
  };

  const getVisiblePrograms = (channelId: string): Program[] => {
    const programs = epg[channelId] || [];
    const windowEnd = new Date(todayMidnight);
    windowEnd.setHours(48, 0, 0, 0);

    const filtered = programs.filter(program => {
      const startDate = program.start instanceof Date ? program.start : new Date(program.start);
      const stopDate = program.stop instanceof Date ? program.stop : new Date(program.stop);
      return stopDate > todayMidnight && startDate < windowEnd;
    });

    // Debug: log first channel's first program
    if (channelId === Object.keys(epg)[0] && filtered.length > 0) {
      const firstProg = filtered[0];
      const startDate = firstProg.start instanceof Date ? firstProg.start : new Date(String(firstProg.start));
      const stopDate = firstProg.stop instanceof Date ? firstProg.stop : new Date(String(firstProg.stop));
      const durationMinutes = (stopDate.getTime() - startDate.getTime()) / (1000 * 60);
      const style = getProgramStyle(firstProg);
      console.log('Debug first program:', {
        title: firstProg.title,
        start: startDate.toLocaleString('it-IT'),
        stop: stopDate.toLocaleString('it-IT'),
        durationMinutes,
        style: style,
      });
    }

    return filtered;
  };

  return (
    <div className="h-full w-full overflow-hidden flex flex-col bg-gray-900 dark:bg-gray-950">
      {/* Header: Time slots */}
      <div className="flex-shrink-0 flex border-b border-gray-700 dark:border-gray-600">
        <div className="w-32 border-r border-gray-700 dark:border-gray-600 bg-gray-800 dark:bg-gray-900 text-white font-bold p-2 text-sm">
          {now.toLocaleDateString('it-IT', { weekday: 'short', month: '2-digit', day: '2-digit' })}
        </div>
        <div className="flex-1 overflow-x-auto" ref={headerScrollRef}>
          <div className="relative" style={{ width: `${TOTAL_WIDTH}px` }}>
            {/* Time grid background */}
            {Array.from({ length: HOURS_TO_SHOW }).map((_, i) => {
              const hour = i % 24;
              const day = Math.floor(i / 24);
              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-r border-gray-700 dark:border-gray-600 text-center text-xs text-gray-400 p-1 bg-gray-800 dark:bg-gray-900"
                  style={{
                    left: `${i * 60 * PIXELS_PER_MINUTE}px`,
                    width: `${60 * PIXELS_PER_MINUTE}px`,
                  }}
                >
                  <div className="font-semibold">{String(hour).padStart(2, '0')}:00</div>
                  {day > 0 && <div className="text-[10px]">+{day}d</div>}
                </div>
              );
            })}

            {/* Current time line in header */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none shadow-lg"
              style={{ left: `${nowPixels}px` }}
            />
          </div>
        </div>
      </div>

      {/* Body: Channels and Programs */}
      <div className="flex-grow flex overflow-hidden">
        {/* Fixed channels sidebar */}
        <div className="w-32 bg-gray-800 dark:bg-gray-900 border-r border-gray-700 dark:border-gray-600 flex-shrink-0 overflow-y-auto flex flex-col" ref={bodyScrollRef}>
          {channels.map(channel => (
            <div
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className="h-12 border-b border-gray-700 dark:border-gray-600 flex items-center justify-center p-1.5 cursor-pointer hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
            >
              <img
                src={channel.logo || 'https://via.placeholder.com/40'}
                alt={channel.name}
                title={channel.name}
                className="h-8 w-8 object-contain"
              />
            </div>
          ))}
        </div>

        {/* Scrollable EPG grid */}
        <div className="flex-grow overflow-auto" style={{ scrollBehavior: 'smooth' }}>
          <div className="flex">
            {/* EPG grid */}
            <div className="relative" style={{ width: `${TOTAL_WIDTH}px`, flex: 'none' }}>
            {/* Current time line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none shadow-lg"
              style={{ left: `${nowPixels}px` }}
            />

            {/* Channel rows */}
            {channels.map((channel) => {
              // Cerca EPG con diversi ID possibili
              const possibleIds = [
                channel.tvg.id,
                channel.id,
                channel.name
              ].filter(Boolean);
              
              // Trova il primo ID che ha dati EPG
              const channelIdWithEpg = possibleIds.find(id => epg[id as string]);
              
              // Debug per primo canale
              if (channel === channels[0]) {
                console.log('First channel EPG lookup:', {
                  channelName: channel.name,
                  tvgId: channel.tvg.id,
                  channelId: channel.id,
                  foundEpgId: channelIdWithEpg,
                  hasEpgData: !!channelIdWithEpg,
                  programCount: channelIdWithEpg ? epg[channelIdWithEpg]?.length : 0
                });
              }
              
              return (
              <div key={channel.id} className="relative h-12 border-b border-gray-700 dark:border-gray-600 bg-gray-800 dark:bg-gray-900 hover:bg-gray-750">
                {/* Programs for this channel */}
                {getVisiblePrograms(channelIdWithEpg || '').map((program, idx) => {
                  const style = getProgramStyle(program);
                  const live = isLive(program);
                  
                  return (
                    <div
                      key={idx}
                      className={`absolute top-0.5 bottom-0.5 px-2 py-1 text-xs font-medium overflow-hidden rounded border cursor-pointer transition-all hover:z-40 hover:scale-105 hover:shadow-lg ${
                        live
                          ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                          : 'bg-gray-700 border-gray-600 text-gray-100 hover:bg-gray-600'
                      }`}
                      style={{
                        ...style,
                        zIndex: live ? 30 : 20,
                        minWidth: '60px',
                      }}
                      title={`${program.title}\n${
                        program.start instanceof Date
                          ? program.start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                          : new Date(String(program.start)).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                      } - ${
                        program.stop instanceof Date
                          ? program.stop.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                          : new Date(String(program.stop)).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                      }`}
                      onClick={() => onSelectChannel(channel)}
                    >
                      <div className="truncate">{program.title}</div>
                    </div>
                  );
                })}
              </div>
              );
            })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EpgView;