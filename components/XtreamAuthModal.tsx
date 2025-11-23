import React, { useState } from 'react';
import { X, Loader } from 'lucide-react';
import { XtreamCredentials } from '../lib/xtreamApi';
import { useXtreamParser } from '../hooks/useXtreamParser';
import toast from 'react-hot-toast';

interface XtreamAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (credentials: XtreamCredentials, data: any) => void;
}

const XtreamAuthModal: React.FC<XtreamAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const { parseXtreamPlaylist, testXtreamConnection } = useXtreamParser();

  const handleTestConnection = async () => {
    if (!server || !username || !password) {
      setError('Compila tutti i campi');
      return;
    }

    // Valida URL server
    try {
      const url = new URL(server);
      if (!url.protocol.startsWith('http')) {
        setError('URL non valido: usa http:// o https://');
        return;
      }
    } catch {
      setError('URL non valido: deve iniziare con http:// o https://');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const credentials: XtreamCredentials = { server, username, password };
      
      console.log('🔐 Testing connection with credentials:', {
        server: credentials.server,
        username: credentials.username,
        passwordLength: credentials.password.length,
      });

      console.log('🔄 Calling testXtreamConnection...');
      const result = await testXtreamConnection(credentials);
      console.log('📥 testXtreamConnection result:', result);

      if (!result || typeof result !== 'object') {
        console.error('❌ Invalid result from testXtreamConnection:', result);
        setError('Errore interno: risposta non valida dal test di connessione');
        setIsLoading(false);
        return;
      }

      if (!result.success) {
        const errorMsg = result.error || 'Server non raggiungibile';
        console.error('❌ Connection failed:', errorMsg);
        
        // Messaggi più specifici
        if (errorMsg.includes('Timeout') || errorMsg.includes('timeout')) {
          setError('⏱️ Il server Xtream non risponde. Possibili cause:\n• Server offline o lento\n• Credenziali non valide\n• Server blocca connessioni esterne\n\nVerifica che il server sia raggiungibile e le credenziali corrette.');
        } else if (errorMsg.includes('Errore proxy')) {
          setError('⚠️ Proxy non disponibile. Usa "netlify dev" per testare in locale, oppure deploya su Netlify.');
        } else if (errorMsg.includes('Credenziali')) {
          setError('❌ Credenziali non valide. Verifica username e password.');
        } else if (errorMsg.includes('CORS')) {
          setError('🔒 Errore CORS: il server blocca le richieste dal browser. Assicurati che il proxy Netlify sia attivo.');
        } else {
          setError(`❌ ${errorMsg}`);
        }
        
        setIsLoading(false);
        return;
      }

      // Connessione OK, carica dati completi
      toast.loading('✅ Connesso! Caricamento playlist...');
      
      console.log('🔄 Calling parseXtreamPlaylist...');
      const data = await parseXtreamPlaylist(credentials);
      console.log('📥 parseXtreamPlaylist result:', data);
      
      if (!data || typeof data !== 'object') {
        console.error('❌ Invalid data from parseXtreamPlaylist:', data);
        setError('Errore interno: dati non validi dal parsing playlist');
        toast.dismiss();
        setIsLoading(false);
        return;
      }
      
      toast.dismiss();
      
      const totalChannels = (data.channels?.length || 0) + (data.vodChannels?.length || 0) + (data.seriesChannels?.length || 0);
      toast.success(`✅ Caricati ${totalChannels} contenuti (${data.channels?.length || 0} live, ${data.vodChannels?.length || 0} VOD, ${data.seriesChannels?.length || 0} serie)`);
      
      onSuccess(credentials, data);
      handleClose();
    } catch (err) {
      console.error('❌ Connection error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(`❌ Errore: ${errorMessage}`);
      toast.dismiss();
      toast.error('Errore di connessione');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setServer('');
    setUsername('');
    setPassword('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Xtream Codes</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Descrizione */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Connettiti al tuo account Xtream Codes per accedere a canali live, VOD e serie TV.
        </p>

        {/* Errore */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4 mb-6">
          {/* Server */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              URL Server
            </label>
            <input
              type="url"
              placeholder="http://xtream.example.com:8000"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Es: http://iptv.example.com:8000
            </p>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username
            </label>
            <input
              type="text"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-500 dark:text-gray-400 text-sm"
                disabled={isLoading}
              >
                {showPassword ? 'Nascondi' : 'Mostra'}
              </button>
            </div>
          </div>
        </div>

        {/* Info utils */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-6">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            💡 <strong>Info:</strong> Inserisci le credenziali Xtream fornite dal tuo provider IPTV.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleTestConnection}
            disabled={isLoading || !server || !username || !password}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading ? (
              <>
                <Loader size={18} className="animate-spin" />
                Connessione...
              </>
            ) : (
              'Connetti'
            )}
          </button>
        </div>

        {/* Link Info */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
          Non hai credenziali Xtream?{' '}
          <a
            href="https://xtream-ui.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Scopri di più
          </a>
        </p>
      </div>
    </div>
  );
};

export default XtreamAuthModal;
