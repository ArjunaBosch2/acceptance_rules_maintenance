import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import TopNav from './TopNav';
import { withApiEnv } from './apiEnv';
import { getAuthHeader } from './apiAuth';

const RuleDetail = () => {
  const { regelId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(withApiEnv(`/api/acceptance-rules?regelId=${encodeURIComponent(regelId)}`), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-store', ...getAuthHeader() },
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch details (status ${res.status})`);
        }
        const data = await res.json();
        // The API returns a single rule object, but normalize just in case
        const rule = Array.isArray(data) ? data[0] : data;
        setDetail(rule);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (regelId) fetchDetail();
    const handleEnvChange = () => {
      if (regelId) {
        fetchDetail();
      }
    };
    window.addEventListener('apiEnvChange', handleEnvChange);
    return () => window.removeEventListener('apiEnvChange', handleEnvChange);
  }, [regelId]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <TopNav />
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Terug
          </button>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">Regel {regelId}</h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 dark:bg-slate-900 dark:border-slate-700">
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
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-500 dark:text-slate-400">Omschrijving</dt>
                <dd className="text-lg text-gray-900 dark:text-slate-100">{detail.Omschrijving || detail.omschrijving || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-slate-400">Expressie</dt>
                <dd className="text-lg text-gray-900 whitespace-pre-wrap dark:text-slate-100">
                  {detail.Expressie || detail.expressie || '-'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-600 dark:text-slate-300">Geen details gevonden.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RuleDetail;
