import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { TrashIcon, PlusIcon } from './icons';
import { toast } from 'react-hot-toast';

interface PlaylistManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlaylist: (m3uUrl: string, epgUrl?: string | null) => void;
}

const PlaylistManager: React.FC<PlaylistManagerProps> = ({ isOpen, onClose, onSelectPlaylist }) => {
  const { savedPlaylists, removeSavedPlaylist, addSavedPlaylist, playlist } = useStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlaylist, setNewPlaylist] = useState({ name: '', m3uUrl: '', epgUrl: '' });

  if (!isOpen) return null;

  const handleAddPlaylist = () => {
    if (!newPlaylist.name.trim() || !newPlaylist.m3uUrl.trim()) {
      toast.error('Nome e URL playlist sono obbligatori');
      return;
    }

    const savedPlaylist = {
      id: `playlist_${Date.now()}`,
      name: newPlaylist.name,
      m3uUrl: newPlaylist.m3uUrl,
      epgUrl: newPlaylist.epgUrl || null,
      createdAt: Date.now(),
    };

    addSavedPlaylist(savedPlaylist);
    toast.success(`Playlist "${newPlaylist.name}" salvata!`);
    setNewPlaylist({ name: '', m3uUrl: '', epgUrl: '' });
    setShowAddForm(false);
  };

  const handleDeletePlaylist = (id: string) => {
    removeSavedPlaylist(id);
    toast.success('Playlist eliminata');
  };

  const handleSelectPlaylist = (m3uUrl: string, epgUrl?: string | null) => {
    onSelectPlaylist(m3uUrl, epgUrl);
    onClose();
  };

  const isCurrent = (m3uUrl: string) => playlist.m3uUrl === m3uUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900/95 border-b border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Gestione Playlist</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Add new playlist button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full mb-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Aggiungi Nuova Playlist
            </button>
          )}

          {/* Add form */}
          {showAddForm && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6">
              <input
                type="text"
                placeholder="Nome playlist (es: Sky Italia)"
                value={newPlaylist.name}
                onChange={(e) => setNewPlaylist({ ...newPlaylist, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-3 transition-all"
              />
              <input
                type="text"
                placeholder="URL playlist M3U (es: https://...)"
                value={newPlaylist.m3uUrl}
                onChange={(e) => setNewPlaylist({ ...newPlaylist, m3uUrl: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-3 transition-all"
              />
              <input
                type="text"
                placeholder="URL EPG XMLTV (opzionale)"
                value={newPlaylist.epgUrl}
                onChange={(e) => setNewPlaylist({ ...newPlaylist, epgUrl: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4 transition-all"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddPlaylist}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-all"
                >
                  Salva
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewPlaylist({ name: '', m3uUrl: '', epgUrl: '' });
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-all"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}

          {/* Playlists list */}
          {savedPlaylists.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Nessuna playlist salvata</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedPlaylists.map((p) => (
                <div
                  key={p.id}
                  className={`border rounded-xl p-4 transition-all cursor-pointer ${
                    isCurrent(p.m3uUrl)
                      ? 'bg-blue-900/40 border-blue-500/60'
                      : 'bg-gray-800/50 border-gray-700 hover:border-blue-500/40'
                  }`}
                  onClick={() => !isCurrent(p.m3uUrl) && handleSelectPlaylist(p.m3uUrl, p.epgUrl)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold">{p.name}</h3>
                        {isCurrent(p.m3uUrl) && (
                          <span className="flex items-center gap-1 bg-green-600/30 text-green-400 text-xs px-2 py-1 rounded-full">
                            ✓ Attiva
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mt-1 truncate">📺 {p.m3uUrl}</p>
                      {p.epgUrl && (
                        <p className="text-sm text-gray-500 mt-0.5 truncate">📖 {p.epgUrl}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        Creata: {new Date(p.createdAt).toLocaleDateString('it-IT')}
                        {p.lastUsed && ` • Usata: ${new Date(p.lastUsed).toLocaleDateString('it-IT')}`}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePlaylist(p.id);
                      }}
                      className="ml-4 p-2 text-red-400 hover:bg-red-600/20 rounded-lg transition-all"
                      title="Elimina"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaylistManager;
