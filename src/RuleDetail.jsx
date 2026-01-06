import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import TopNav from './TopNav';
import { withApiEnv } from './apiEnv';

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
          headers: { 'Cache-Control': 'no-store' },
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
  }, [regelId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Terug
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Regel {regelId}</h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Kon details niet laden</p>
                <p className="text-xs mt-1">{error}</p>
              </div>
            </div>
          ) : detail ? (
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-500">Omschrijving</dt>
                <dd className="text-lg text-gray-900">{detail.Omschrijving || detail.omschrijving || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Expressie</dt>
                <dd className="text-lg text-gray-900 whitespace-pre-wrap">
                  {detail.Expressie || detail.expressie || '-'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-600">Geen details gevonden.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RuleDetail;
