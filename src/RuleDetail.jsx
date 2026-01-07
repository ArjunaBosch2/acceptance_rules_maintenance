import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import TopNav from './TopNav';
import { withApiEnv } from './apiEnv';
import { getAuthHeader } from './apiAuth';

const RuleDetail = () => {
  const { regelId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState(null);
  const [explanation, setExplanation] = useState({ bullets: [], summary: '' });

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
        setExplanation({ bullets: [], summary: '' });
        setExplainError(null);
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

  const handleExplain = async () => {
    const expression = detail?.Expressie || detail?.expressie;
    if (!expression) return;
    setExplainLoading(true);
    setExplainError(null);
    setExplanation({ bullets: [], summary: '' });
    try {
      const response = await fetch('/api/explain-rule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ expression }),
      });
      if (!response.ok) {
        let message = `Failed to explain rule (status ${response.status})`;
        try {
          const payload = await response.json();
          message = payload.message || payload.error || message;
        } catch (err) {
          // ignore JSON parse failure
        }
        throw new Error(message);
      }
      const data = await response.json();
      const raw = (data.explanation || '').trim();
      const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const bullets = lines.filter((line) => line.startsWith('- ')).map((line) => line.slice(2));
      const summaryLine = lines.find((line) => line.toLowerCase().startsWith('samenvatting:'));
      const summary = summaryLine ? summaryLine.replace(/^samenvatting:\s*/i, '') : '';
      setExplanation({ bullets, summary });
    } catch (err) {
      setExplainError(err.message);
    } finally {
      setExplainLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <TopNav />
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => {
              const listState = location.state?.listState;
              if (listState) {
                navigate('/', { state: { listState } });
              } else {
                navigate(-1);
              }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Terug
          </button>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">Regel {regelId}</h1>
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
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={handleExplain}
                    disabled={explainLoading}
                    className="px-4 py-2 text-sm font-medium text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed neon-primary flex items-center gap-2"
                  >
                    <span aria-hidden="true">✨</span>
                    {explainLoading ? 'Uitleg ophalen...' : 'Wat doet deze acceptatieregel?'}
                  </button>
                </div>
                {explainError && (
                  <p className="mt-3 text-sm text-red-400">
                    {explainError}
                  </p>
                )}
                {(explanation.bullets.length > 0 || explanation.summary) && (
                  <div className="mt-4 rounded-lg border border-purple-500/30 bg-purple-900/20 p-4 text-sm text-slate-100">
                    {explanation.bullets.length > 0 && (
                      <ul className="space-y-2 list-disc pl-5">
                        {explanation.bullets.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    )}
                    {explanation.summary && (
                      <p className="mt-3 text-sm text-slate-200">
                        Samenvatting: {explanation.summary}
                      </p>
                    )}
                  </div>
                )}
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
