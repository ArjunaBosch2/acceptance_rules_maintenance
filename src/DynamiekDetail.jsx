import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Edit2 } from 'lucide-react';
import TopNav from './TopNav';
import { withApiEnv } from './apiEnv';
import { getAuthHeader } from './apiAuth';

const DynamiekDetail = () => {
  const { regelId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editJson, setEditJson] = useState('');
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withApiEnv(`/api/dynamieken/${regelId}`), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store', ...getAuthHeader() },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch details (status ${res.status})`);
      }
      const data = await res.json();
      setDetail(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (regelId) fetchDetail();
    const handleEnvChange = () => {
      if (regelId) {
        fetchDetail();
      }
    };
    window.addEventListener('apiEnvChange', handleEnvChange);
    return () => window.removeEventListener('apiEnvChange', handleEnvChange);
  }, [regelId]);

  const handleOpenEdit = () => {
    setShowEditModal(true);
    setEditJson(JSON.stringify(detail, null, 2));
    setEditError('');
    setEditSuccess(false);
  };

  const handleCloseEdit = () => {
    setShowEditModal(false);
    setEditJson('');
    setEditError('');
    setEditSuccess(false);
  };

  const handleSaveEdit = async () => {
    setEditError('');
    setEditSuccess(false);

    try {
      // Parse JSON
      const parsed = JSON.parse(editJson);

      // Submit to API
      setEditLoading(true);
      const res = await fetch(withApiEnv('/api/dynamieken'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Fout bij aanpassen (status ${res.status})`);
      }

      setEditSuccess(true);
      setTimeout(() => {
        handleCloseEdit();
        fetchDetail();
      }, 1500);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setEditError('Ongeldige JSON syntax');
      } else {
        setEditError(err.message);
      }
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <TopNav />
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/dynamieken')}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Terug
          </button>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
            Dynamiek {regelId}
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 dark:bg-slate-900 dark:border-slate-700 neon-card">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/30 dark:border-yellow-700/60 dark:text-yellow-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0 dark:text-yellow-400" />
              <div>
                <p className="font-medium text-sm">Kon details niet laden</p>
                <p className="text-xs mt-1">{error}</p>
              </div>
            </div>
          ) : detail ? (
            <>
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Details</h2>
                <button
                  onClick={handleOpenEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors neon-primary"
                >
                  <Edit2 className="w-4 h-4" />
                  Aanpassen
                </button>
              </div>
              <pre className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm font-mono text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700">
                {JSON.stringify(detail, null, 2)}
              </pre>
            </>
          ) : (
            <p className="text-sm text-gray-600 dark:text-slate-300">Geen details gevonden.</p>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                Dynamiek Aanpassen
              </h2>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                JSON
              </label>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                Bewerk de JSON code of plak een nieuwe versie
              </p>
              <textarea
                value={editJson}
                onChange={(e) => setEditJson(e.target.value)}
                rows={16}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />

              {editError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 dark:bg-red-900/30 dark:border-red-700/60">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5 dark:text-red-400" />
                  <p className="text-sm text-red-800 dark:text-red-200">{editError}</p>
                </div>
              )}

              {editSuccess && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/30 dark:border-green-700/60">
                  <p className="text-sm text-green-800 dark:text-green-200">✓ Dynamiek succesvol aangepast!</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={handleCloseEdit}
                disabled={editLoading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Annuleren
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editLoading || !editJson.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors neon-primary"
              >
                {editLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamiekDetail;
