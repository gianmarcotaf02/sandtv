import React from 'react';
import { Group } from '../types';
import { PlusIcon, EditIcon, TrashIcon, StarIcon } from './icons';

interface SidebarProps {
  groups: { id: string, name: string }[];
  customGroups: Group[];
  selectedGroup: string;
  onSelectGroup: (groupId: string) => void;
  onAddGroup: () => void;
  onEditGroup: (group: Group) => void;
  onDeleteGroup: (groupId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  groups,
  customGroups,
  selectedGroup,
  onSelectGroup,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
}) => {
  const renderGroupItem = (group: { id: string; name: string }) => (
    <li key={group.id}>
      <button
        onClick={() => onSelectGroup(group.id)}
        className={`w-full text-left px-4 py-3 text-sm rounded-lg transition-all duration-200 transform flex items-center ${
          selectedGroup === group.id
            ? 'bg-blue-600 text-white scale-105 shadow-lg'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/60 hover:text-gray-900 dark:hover:text-white hover:scale-105'
        }`}
      >
        {group.id === 'favorites' && <StarIcon className="w-4 h-4 mr-2 flex-shrink-0" />}
        <span className="truncate">{group.name}</span>
      </button>
    </li>
  );

  return (
    <nav className="w-64 bg-gray-100 dark:bg-gray-900/50 backdrop-blur-lg border-r border-gray-300 dark:border-white/10 p-4 flex flex-col h-full transition-colors duration-300">
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex-shrink-0">SandTV</h2>
      <div className="flex-grow overflow-y-auto pr-2 -mr-2">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">Gruppi Predefiniti</h3>
        <ul className="space-y-2">
          {groups.map(renderGroupItem)}
        </ul>

        <div className="mt-6 mb-2 flex justify-between items-center px-2">
          <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Gruppi Personalizzati</h3>
          <button onClick={onAddGroup} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700/60">
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
        <ul className="space-y-1">
          {customGroups.map((group) => (
            <li key={group.id}>
                <div className={`w-full rounded-lg flex items-center transition-all duration-200 transform group ${
                     selectedGroup === group.id ? 'bg-blue-600 scale-105 shadow-lg' : 'hover:bg-gray-700/60 hover:scale-105'
                }`}>
                    <button
                        onClick={() => onSelectGroup(group.id)}
                        className={`flex-grow text-left px-4 py-3 text-sm transition-colors truncate ${
                            selectedGroup === group.id ? 'text-white' : 'text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white'
                        }`}
                    >
                        {group.name}
                    </button>
                    <div className="flex items-center pr-2">
                        <button onClick={() => onEditGroup(group)} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <EditIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDeleteGroup(group.id)} className="text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default Sidebar;