import React, { useEffect, useState } from 'react';
import { RefreshCw, AlertCircle, Plus, X } from 'lucide-react';
import TopNav from './TopNav';
import { withApiEnv } from './apiEnv';
import { getAuthHeader } from './apiAuth';

const Dynamieken = () => {
  const [dynamieken, setDynamieken] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [validationError, setValidationError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const normalizeDynamieken = (incoming) => {
    if (!incoming) return [];

    const flatten = (items) =>
      items.flatMap((item) => {
        if (!item) return [];
        if (Array.isArray(item)) return flatten(item);
        if (Array.isArray(item.Data)) return flatten(item.Data);

        return [
          {
            regelId:
              item.RegelId ??
              item.Regelid ??
              item.regelid ??
              item.regelId ??
              item.RegelID ??
              '',
            omschrijving: item.Omschrijving ?? item.omschrijving ?? '',
          },
        ];
      });

    return flatten(Array.isArray(incoming) ? incoming : [incoming]);
  };

  const fetchDynamieken = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(withApiEnv('/api/dynamieken'), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store', ...getAuthHeader() },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch dynamiekregels (status ${res.status})`);
      }

      const data = await res.json();
      const normalized = normalizeDynamieken(data.rules || data.dynamieken || data.data || data);
      setDynamieken(normalized);
    } catch (err) {
      setError(err.message);
      setDynamieken([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDynamieken();
    const handleEnvChange = () => {
      fetchDynamieken();
    };
    window.addEventListener('apiEnvChange', handleEnvChange);
    return () => window.removeEventListener('apiEnvChange', handleEnvChange);
  }, []);

  const filteredDynamieken = dynamieken.filter((dynamiek) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      dynamiek.regelId?.toString().toLowerCase().includes(term) ||
      dynamiek.omschrijving?.toLowerCase().includes(term)
    );
  });

  const handleOpenModal = () => {
    setShowModal(true);
    setJsonInput('');
    setValidationError('');
    setSubmitSuccess(false);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setJsonInput('');
    setValidationError('');
    setSubmitSuccess(false);
  };

  const validateAndSubmit = async () => {
    setValidationError('');
    setSubmitSuccess(false);

    try {
      // Parse JSON
      const parsed = JSON.parse(jsonInput);

      // Validate required fields
      if (!parsed.ResourceId) {
        setValidationError('Veld "ResourceId" is verplicht');
        return;
      }
      if (!parsed.Omschrijving) {
        setValidationError('Veld "Omschrijving" is verplicht');
        return;
      }
      if (!parsed.Rekenregels) {
        setValidationError('Veld "Rekenregels" is verplicht');
        return;
      }

      // Submit to API
      setSubmitLoading(true);
      const res = await fetch(withApiEnv('/api/dynamieken'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Fout bij toevoegen (status ${res.status})`);
      }

      setSubmitSuccess(true);
      setJsonInput('');
      setTimeout(() => {
        handleCloseModal();
        fetchDynamieken();
      }, 1500);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setValidationError('Ongeldige JSON syntax');
      } else {
        setValidationError(err.message);
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <TopNav />
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 dark:bg-slate-900 dark:border-slate-700 neon-card">
          <div className="p-6 border-b border-gray-200 dark:border-slate-700">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">Dynamieken</h1>
                <p className="text-sm text-gray-600 mt-1 dark:text-slate-300">
                  Overzicht van dynamiekregels voor verzekeringen.
                </p>
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Zoek op Regel ID of Omschrijving"
                  className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
                <button
                  onClick={handleOpenModal}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors neon-primary"
                >
                  <Plus className="w-4 h-4" />
                  Toevoegen
                </button>
                <button
                  onClick={fetchDynamieken}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors neon-primary"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mx-6 mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3 dark:bg-yellow-900/30 dark:border-yellow-700/60">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5 dark:text-yellow-400" />
              <div>
                <p className="text-sm text-yellow-800 font-medium dark:text-yellow-200">Fout bij ophalen</p>
                <p className="text-xs text-yellow-700 mt-1 dark:text-yellow-200/80">
                  {error}
                </p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 dark:bg-slate-800 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider dark:text-slate-300">
                      Regel ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider dark:text-slate-300">
                      Omschrijving
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-900 dark:divide-slate-800">
                  {filteredDynamieken.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                        {error ? 'Fout bij ophalen van dynamieken' : 'Geen dynamieken gevonden'}
                      </td>
                    </tr>
                  ) : (
                    filteredDynamieken.map((dynamiek, index) => (
                      <tr
                        key={dynamiek.regelId || index}
                        className="hover:bg-gray-50 transition-colors dark:hover:bg-slate-800"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">
                          {dynamiek.regelId || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-200">
                          {dynamiek.omschrijving || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                Dynamiek Toevoegen
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                JSON Input
              </label>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                Plak hier de JSON code voor de dynamiek regel. Verplichte velden: ResourceId, Omschrijving, Rekenregels
              </p>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={'{\n  "ResourceId": "...",\n  "Omschrijving": "...",\n  "Rekenregels": [...]\n}'}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />

              {validationError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 dark:bg-red-900/30 dark:border-red-700/60">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5 dark:text-red-400" />
                  <p className="text-sm text-red-800 dark:text-red-200">{validationError}</p>
                </div>
              )}

              {submitSuccess && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/30 dark:border-green-700/60">
                  <p className="text-sm text-green-800 dark:text-green-200">✓ Dynamiek succesvol toegevoegd!</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                disabled={submitLoading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Annuleren
              </button>
              <button
                onClick={validateAndSubmit}
                disabled={submitLoading || !jsonInput.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors neon-primary"
              >
                {submitLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                Toevoegen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dynamieken;
