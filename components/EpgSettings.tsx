import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Plus, Trash2, RefreshCw, Calendar, Clock, Globe, Settings, X } from 'lucide-react';

interface EpgSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

interface EpgSettingsProps {
  currentEpgUrl: string;
  onLoadEpg: (url: string) => void;
  onRefreshEpg: () => void;
  isLoading?: boolean;
  onClose?: () => void; // Aggiungo callback per chiusura
}

const EpgSettings: React.FC<EpgSettingsProps> = ({ 
  currentEpgUrl, 
  onLoadEpg, 
  onRefreshEpg,
  isLoading = false,
  onClose
}) => {
  const { settings, updateSettings } = useStore();
  const [epgSources, setEpgSources] = useState<EpgSource[]>(() => {
    const saved = localStorage.getItem('epg_sources');
    return saved ? JSON.parse(saved) : [
      {
        id: '1',
        name: 'EPG predefinita',
        url: currentEpgUrl,
        enabled: true
      }
    ];
  });

  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Time range settings
  const [timeRange, setTimeRange] = useState(() => {
    const saved = localStorage.getItem('epg_time_range');
    return saved ? parseInt(saved) : 24; // Default 24 hours
  });

  // Auto-refresh settings
  const [autoRefresh, setAutoRefresh] = useState(() => {
    const saved = localStorage.getItem('epg_auto_refresh');
    return saved === 'true';
  });

  const [refreshInterval, setRefreshInterval] = useState(() => {
    const saved = localStorage.getItem('epg_refresh_interval');
    return saved ? parseInt(saved) : 12; // Default 12 hours
  });

  // Timezone offset
  const [timezoneOffset, setTimezoneOffset] = useState(() => {
    const saved = localStorage.getItem('epg_timezone_offset');
    return saved ? parseInt(saved) : 0;
  });

  // Save sources to localStorage
  const saveSources = (sources: EpgSource[]) => {
    setEpgSources(sources);
    localStorage.setItem('epg_sources', JSON.stringify(sources));
  };

  // Add new EPG source
  const handleAddSource = () => {
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;

    const newSource: EpgSource = {
      id: Date.now().toString(),
      name: newSourceName.trim(),
      url: newSourceUrl.trim(),
      enabled: false
    };

    saveSources([...epgSources, newSource]);
    setNewSourceName('');
    setNewSourceUrl('');
    setShowAddForm(false);
  };

  // Remove EPG source
  const handleRemoveSource = (id: string) => {
    saveSources(epgSources.filter(source => source.id !== id));
  };

  // Toggle EPG source
  const handleToggleSource = (id: string) => {
    const updatedSources = epgSources.map(source => ({
      ...source,
      enabled: source.id === id ? !source.enabled : false // Only one can be enabled
    }));
    saveSources(updatedSources);
    
    const activeSource = updatedSources.find(s => s.id === id && s.enabled);
    if (activeSource) {
      onLoadEpg(activeSource.url);
    }
  };

  // Update time range
  const handleTimeRangeChange = (hours: number) => {
    setTimeRange(hours);
    localStorage.setItem('epg_time_range', hours.toString());
  };

  // Update auto-refresh
  const handleAutoRefreshToggle = () => {
    const newValue = !autoRefresh;
    setAutoRefresh(newValue);
    localStorage.setItem('epg_auto_refresh', newValue.toString());
  };

  // Update refresh interval
  const handleRefreshIntervalChange = (hours: number) => {
    setRefreshInterval(hours);
    localStorage.setItem('epg_refresh_interval', hours.toString());
  };

  // Update timezone offset
  const handleTimezoneOffsetChange = (offset: number) => {
    setTimezoneOffset(offset);
    localStorage.setItem('epg_timezone_offset', offset.toString());
  };

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-900 dark:text-white" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Impostazioni
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Chiudi impostazioni"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
          Salvate automaticamente nel tuo account
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* EPG Sources Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">EPG</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="p-1 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
              title="Aggiungi fonte EPG"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add source form */}
          {showAddForm && (
            <div className="mb-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-xl space-y-2">
              <input
                type="text"
                placeholder="Nome fonte (es: EPG Italia)"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
              />
              <input
                type="url"
                placeholder="URL EPG"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddSource}
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                >
                  Aggiungi
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-3 py-1.5 text-sm bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}

          {/* EPG sources list */}
          <div className="space-y-2">
            {epgSources.map((source) => (
              <div
                key={source.id}
                className={`p-3 rounded-xl border ${
                  source.enabled
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input
                      type="radio"
                      checked={source.enabled}
                      onChange={() => handleToggleSource(source.id)}
                      className="text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {source.name}
                    </span>
                  </label>
                  {epgSources.length > 1 && (
                    <button
                      onClick={() => handleRemoveSource(source.id)}
                      className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                      title="Rimuovi fonte"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate pl-6">
                  {source.url}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Refresh Settings */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Aggiornamento
          </h3>
          
          <button
            onClick={onRefreshEpg}
            disabled={isLoading}
            className="w-full px-4 py-2 mb-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Caricamento...' : 'Aggiorna EPG ora'}
          </button>

          <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer">
            <span className="text-sm text-gray-700 dark:text-gray-300">Aggiornamento automatico</span>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={handleAutoRefreshToggle}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>

          {autoRefresh && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Intervallo aggiornamento
              </label>
              <select
                value={refreshInterval}
                onChange={(e) => handleRefreshIntervalChange(parseInt(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
              >
                <option value="1">Ogni ora</option>
                <option value="3">Ogni 3 ore</option>
                <option value="6">Ogni 6 ore</option>
                <option value="12">Ogni 12 ore</option>
                <option value="24">Ogni 24 ore</option>
              </select>
            </div>
          )}
        </div>

        {/* Time Range Settings */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Intervallo temporale
          </h3>
          
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
              Mostra programmi per
            </label>
            <select
              value={timeRange}
              onChange={(e) => handleTimeRangeChange(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
            >
              <option value="6">6 ore</option>
              <option value="12">12 ore</option>
              <option value="24">24 ore</option>
              <option value="48">48 ore</option>
              <option value="168">7 giorni</option>
            </select>
          </div>
        </div>

        {/* Timezone Settings */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Fuso orario
          </h3>
          
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
              Offset fuso orario (ore)
            </label>
            <select
              value={timezoneOffset}
              onChange={(e) => handleTimezoneOffsetChange(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
            >
              <option value="-12">UTC-12</option>
              <option value="-11">UTC-11</option>
              <option value="-10">UTC-10</option>
              <option value="-9">UTC-9</option>
              <option value="-8">UTC-8</option>
              <option value="-7">UTC-7</option>
              <option value="-6">UTC-6</option>
              <option value="-5">UTC-5</option>
              <option value="-4">UTC-4</option>
              <option value="-3">UTC-3</option>
              <option value="-2">UTC-2</option>
              <option value="-1">UTC-1</option>
              <option value="0">UTC+0 (GMT)</option>
              <option value="1">UTC+1 (CET)</option>
              <option value="2">UTC+2 (CEST)</option>
              <option value="3">UTC+3</option>
              <option value="4">UTC+4</option>
              <option value="5">UTC+5</option>
              <option value="6">UTC+6</option>
              <option value="7">UTC+7</option>
              <option value="8">UTC+8</option>
              <option value="9">UTC+9</option>
              <option value="10">UTC+10</option>
              <option value="11">UTC+11</option>
              <option value="12">UTC+12</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Regola l'orario dei programmi in base al tuo fuso orario
            </p>
          </div>
        </div>

        {/* EPG Info */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-1">
            Info EPG
          </h4>
          <p className="text-xs text-blue-700 dark:text-blue-400">
            La guida elettronica dei programmi (EPG) mostra gli orari e le descrizioni dei programmi TV.
          </p>
          {currentEpgUrl && (
            <p className="text-xs text-blue-600 dark:text-blue-500 mt-2 truncate">
              Fonte attuale: {currentEpgUrl}
            </p>
          )}
        </div>

        {/* Player Settings */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Player
          </h3>
          <div className="space-y-3">
            {/* PiP Auto */}
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700 dark:text-gray-300">Attiva PiP automatico</span>
                <input
                  type="checkbox"
                  checked={!!settings.pipAuto}
                  onChange={() => updateSettings({ pipAuto: !settings.pipAuto })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Se abilitato il player tenterà di entrare automaticamente in Picture-in-Picture quando cambi scheda, minimizzi la finestra o in altri casi in cui il browser supporta PiP.
              </p>
            </div>

            {/* Hardware Acceleration */}
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block">
                Accelerazione Hardware
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => updateSettings({ hardwareAcceleration: 'auto' })}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    (settings.hardwareAcceleration || 'auto') === 'auto'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                >
                  Auto
                </button>
                <button
                  onClick={() => updateSettings({ hardwareAcceleration: 'enabled' })}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    settings.hardwareAcceleration === 'enabled'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                >
                  Abilitata
                </button>
                <button
                  onClick={() => updateSettings({ hardwareAcceleration: 'disabled' })}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    settings.hardwareAcceleration === 'disabled'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                >
                  Disabilitata
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Controlla l'uso della GPU per la riproduzione video. Auto (consigliato) permette al browser di decidere. Abilitata forza l'uso della GPU per migliori prestazioni. Disabilitata può risolvere problemi di compatibilità.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EpgSettings;
