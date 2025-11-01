import React, { useState, useMemo } from 'react';
import { Channel } from '../types';

interface ChannelSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  onConfirm: (selectedChannelIds: string[]) => void;
  title?: string;
  preSelectedIds?: string[];
}

const ChannelSelectionModal: React.FC<ChannelSelectionModalProps> = ({ 
  isOpen, 
  onClose, 
  channels, 
  onConfirm,
  title = 'Seleziona Canali',
  preSelectedIds = []
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preSelectedIds));

  const filteredChannels = useMemo(() => {
    return channels.filter(channel =>
      channel.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [channels, searchQuery]);

  const handleToggleChannel = (channelId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(channelId)) {
      newSelected.delete(channelId);
    } else {
      newSelected.add(channelId);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredChannels.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredChannels.map(c => c.id)));
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
    onClose();
    setSearchQuery('');
    setSelectedIds(new Set(preSelectedIds));
  };

  const handleClose = () => {
    onClose();
    setSearchQuery('');
    setSelectedIds(new Set(preSelectedIds));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="bg-gradient-to-br from-gray-900 to-gray-800 border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] p-6 flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <button 
            onClick={handleClose} 
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Cerca canali..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 bg-gray-800/60 text-white placeholder-gray-400 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 mb-4"
          autoFocus
        />

        {/* Select All Button */}
        <button
          onClick={handleSelectAll}
          className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold transition-colors text-sm"
        >
          {selectedIds.size === filteredChannels.length && filteredChannels.length > 0
            ? 'Deseleziona Tutto'
            : 'Seleziona Tutto'}
        </button>

        {/* Channels List */}
        <div className="flex-grow overflow-y-auto mb-4 space-y-2 border border-gray-700 rounded-2xl p-3 bg-gray-900/50">
          {filteredChannels.length > 0 ? (
            filteredChannels.map(channel => (
              <label
                key={channel.id}
                className="flex items-center p-2 rounded-2xl hover:bg-gray-700/50 cursor-pointer transition-colors group"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(channel.id)}
                  onChange={() => handleToggleChannel(channel.id)}
                  className="w-5 h-5 rounded accent-blue-600 cursor-pointer"
                />
                <img
                  src={channel.logo || 'https://via.placeholder.com/20'}
                  alt={channel.name}
                  className="w-5 h-5 mx-3 object-contain"
                />
                <span className="text-white flex-grow group-hover:text-blue-400 transition-colors">
                  {channel.name}
                </span>
                <span className="text-gray-500 text-sm">
                  {channel.group}
                </span>
              </label>
            ))
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <p>Nessun canale trovato</p>
            </div>
          )}
        </div>

        {/* Counter */}
        <div className="mb-4 text-sm text-gray-400">
          <span className="text-blue-400 font-semibold">{selectedIds.size}</span> canali selezionati su <span className="text-blue-400 font-semibold">{channels.length}</span>
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl font-semibold transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold transition-colors"
          >
            Conferma ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChannelSelectionModal;
