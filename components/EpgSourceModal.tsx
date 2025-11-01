import React, { useState } from 'react';

interface EpgSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEpgSource: (url: string) => Promise<void>;
}

const EpgSourceModal: React.FC<EpgSourceModalProps> = ({ isOpen, onClose, onAddEpgSource }) => {
  const [epgUrl, setEpgUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onAddEpgSource(epgUrl);
      setEpgUrl('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Errore nel caricamento EPG');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 m-4 transition-colors duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Aggiungi Fonte EPG
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Suggerimento:</strong> Inserisci l'URL del file XMLTV/EPG (di solito termina con .xml o .gz)
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              URL EPG
            </label>
            <input
              type="url"
              value={epgUrl}
              onChange={(e) => setEpgUrl(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              placeholder="https://esempio.com/epg.xml"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Formati supportati: XMLTV (.xml, .xml.gz)
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-xl transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-xl transition-colors"
            >
              {loading ? 'Caricamento...' : 'Carica EPG'}
            </button>
          </div>
        </form>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            💡 <strong>Fonti EPG gratuite:</strong>
          </p>
          <ul className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <li>• EPG Italia: epgshare01.online</li>
            <li>• EPG Internazionale: iptv-org.github.io/epg</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EpgSourceModal;
