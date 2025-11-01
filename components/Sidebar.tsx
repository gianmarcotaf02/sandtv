import React, { useState } from 'react';
import { Group } from '../types';
import { PlusIcon, EditIcon, TrashIcon, StarIcon, GridIcon, Bars3Icon } from './icons';

interface SidebarProps {
  groups: { id: string, name: string }[];
  customGroups: Group[];
  selectedGroup: string;
  onSelectGroup: (groupId: string) => void;
  onAddGroup: () => void;
  onEditGroup: (group: Group) => void;
  onDeleteGroup: (groupId: string) => void;
  channels?: any[]; // Per generare icone automatiche
}

// Funzione per ottenere l'icona del gruppo basata sui canali
const getGroupIcon = (groupId: string, groupName: string, channels?: any[]) => {
  // Icone predefinite
  if (groupId === 'all') return '📺';
  if (groupId === 'favorites') return '⭐';
  if (groupId === 'uncategorized') return '📂';
  
  // Per gruppi personalizzati, cerca il logo del primo canale
  if (channels && channels.length > 0) {
    const firstChannel = channels[0];
    if (firstChannel?.logo) {
      return <img src={firstChannel.logo} alt="" className="w-6 h-6 object-contain rounded" />;
    }
  }
  
  // Fallback: emoji basata sul nome
  const name = groupName.toLowerCase();
  if (name.includes('sport')) return '⚽';
  if (name.includes('news') || name.includes('notizie')) return '📰';
  if (name.includes('film') || name.includes('movie')) return '🎬';
  if (name.includes('serie') || name.includes('tv')) return '📺';
  if (name.includes('music') || name.includes('musica')) return '🎵';
  if (name.includes('kids') || name.includes('bambini')) return '🎨';
  if (name.includes('doc')) return '📚';
  
  // Default
  return '📁';
};

const Sidebar: React.FC<SidebarProps> = ({
  groups,
  customGroups,
  selectedGroup,
  onSelectGroup,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
  channels,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const renderGroupItem = (group: { id: string; name: string }, isCustom: boolean = false) => {
    const icon = getGroupIcon(group.id, group.name, channels);
    const isSelected = selectedGroup === group.id;
    
    return (
      <li key={group.id} className="relative group">
        <button
          onClick={() => onSelectGroup(group.id)}
          className={`w-full text-left px-3 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
            isSelected
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/60'
          }`}
          title={!isExpanded ? group.name : ''}
        >
          <span className="text-2xl flex-shrink-0 w-6 h-6 flex items-center justify-center">
            {typeof icon === 'string' ? icon : icon}
          </span>
          {isExpanded && (
            <span className="truncate flex-grow text-sm font-medium">{group.name}</span>
          )}
        </button>
        
        {/* Pulsanti edit/delete per gruppi custom (solo quando espanso) */}
        {isCustom && isExpanded && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); onEditGroup(group as Group); }}
              className="p-1 hover:bg-gray-600/50 rounded"
            >
              <EditIcon className="w-3 h-3" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDeleteGroup(group.id); }}
              className="p-1 hover:bg-red-600/50 rounded"
            >
              <TrashIcon className="w-3 h-3" />
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <nav 
      className={`bg-gray-100 dark:bg-gray-900/50 backdrop-blur-lg border-r border-gray-300 dark:border-white/10 flex flex-col h-full transition-all duration-300 ${
        isExpanded ? 'w-64' : 'w-20'
      }`}
    >
      {/* Header con toggle */}
      <div className="p-4 border-b border-gray-300 dark:border-white/10">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700/60 transition-colors"
          title={isExpanded ? 'Riduci sidebar' : 'Espandi sidebar'}
        >
          <Bars3Icon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Gruppi */}
      <div className="flex-grow overflow-y-auto p-3 space-y-6">
        {/* Gruppi Predefiniti */}
        <div>
          {isExpanded && (
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">
              Predefiniti
            </h3>
          )}
          <ul className="space-y-1">
            {groups.map(g => renderGroupItem(g, false))}
          </ul>
        </div>

        {/* Gruppi Personalizzati */}
        <div>
          <div className="flex items-center justify-between mb-2 px-2">
            {isExpanded && (
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Personalizzati
              </h3>
            )}
            <button
              onClick={onAddGroup}
              className={`p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700/60 text-gray-600 dark:text-gray-400 ${
                !isExpanded ? 'mx-auto' : ''
              }`}
              title="Aggiungi gruppo"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
          <ul className="space-y-1">
            {customGroups.map(g => renderGroupItem(g, true))}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
