import React, { useCallback, useEffect, useState } from 'react';
import TopNav from './TopNav';
import { withApiEnv } from './apiEnv';
import { getAuthHeader } from './apiAuth';

const POLL_MS = 2000;
const DEFAULT_SUITE = 'avp_scenario';

const truncate = (value, max = 180) => {
  if (!value) return '';
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
};

const parseApiResponse = async (response, fallbackMessage) => {
  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();

  if (!contentType.includes('application/json')) {
    const snippet = truncate(rawText);
    throw new Error(
      `${fallbackMessage}: API gaf geen JSON terug (status ${response.status}). ` +
        `Waarschijnlijk backend/proxy issue. Response: ${snippet || '<leeg>'}`
    );
  }

  let payload = {};
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    const snippet = truncate(rawText);
    throw new Error(
      `${fallbackMessage}: ongeldige JSON (status ${response.status}). ` +
        `Response: ${snippet || '<leeg>'}`
    );
  }

  if (!response.ok) {
    throw new Error(payload.message || payload.error || `${fallbackMessage} (${response.status})`);
  }

  return payload;
};

const statusClassName = (status) => {
  switch (status) {
    case 'queued':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    case 'running':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
    case 'succeeded':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
    case 'failed':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-200';
  }
};

const toLocale = (value) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
};

const RunArtifacts = ({ artifacts }) => {
  if (!artifacts?.length) {
    return <span className="text-xs text-gray-500 dark:text-slate-400">Geen</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {artifacts.map((artifact) => (
        <a
          key={artifact.path}
          href={withApiEnv(artifact.download_url)}
          className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
        >
          {artifact.name}
        </a>
      ))}
    </div>
  );
};

const Testen = () => {
  const [suite, setSuite] = useState(DEFAULT_SUITE);
  const [baseUrl, setBaseUrl] = useState('');
  const [runs, setRuns] = useState([]);
  const [activeRunId, setActiveRunId] = useState(null);
  const [activeRun, setActiveRun] = useState(null);
  const [logs, setLogs] = useState('');
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [startingRun, setStartingRun] = useState(false);
  const [error, setError] = useState(null);

  const loadRuns = useCallback(
    async (keepLoading = true) => {
      if (keepLoading) setLoadingRuns(true);
      try {
        const response = await fetch(withApiEnv('/api/test-runs?limit=10'), {
          headers: { ...getAuthHeader() },
          cache: 'no-store',
        });
        const payload = await parseApiResponse(response, 'Kon runs niet ophalen');
        const nextRuns = Array.isArray(payload) ? payload : payload.runs || [];
        setRuns(nextRuns);

        if (!activeRunId && nextRuns.length > 0) {
          const running = nextRuns.find((run) => run.status === 'queued' || run.status === 'running');
          setActiveRunId((running || nextRuns[0]).run_id);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        if (keepLoading) setLoadingRuns(false);
      }
    },
    [activeRunId]
  );

  const loadRunDetail = useCallback(async (runId) => {
    if (!runId) return null;
    const response = await fetch(withApiEnv(`/api/test-runs/${runId}`), {
      headers: { ...getAuthHeader() },
      cache: 'no-store',
    });
    const payload = await parseApiResponse(response, `Kon run ${runId} niet ophalen`);
    setActiveRun(payload);
    return payload;
  }, []);

  const loadRunLogs = useCallback(async (runId) => {
    if (!runId) return '';
    const response = await fetch(withApiEnv(`/api/test-runs/${runId}/logs`), {
      headers: { ...getAuthHeader() },
      cache: 'no-store',
    });
    const payload = await parseApiResponse(response, 'Kon logs niet ophalen');
    const nextLogs = payload.logs || '';
    setLogs(nextLogs);
    return nextLogs;
  }, []);

  const handleStartRun = async () => {
    setStartingRun(true);
    setError(null);
    try {
      const response = await fetch(withApiEnv('/api/test-runs'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          suite,
          baseUrl: baseUrl.trim() || undefined,
        }),
      });
      const payload = await parseApiResponse(response, 'Run starten mislukt');

      setActiveRunId(payload.run_id);
      setActiveRun({ run_id: payload.run_id, status: payload.status, suite });
      setLogs('Run staat in de queue...');
      await loadRuns(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setStartingRun(false);
    }
  };

  useEffect(() => {
    loadRuns();
    const onEnvChange = () => {
      setError(null);
      loadRuns();
    };
    window.addEventListener('apiEnvChange', onEnvChange);
    return () => window.removeEventListener('apiEnvChange', onEnvChange);
  }, [loadRuns]);

  useEffect(() => {
    if (!activeRunId) return undefined;

    let cancelled = false;
    let timeoutId;

    const poll = async () => {
      try {
        const detail = await loadRunDetail(activeRunId);
        await loadRunLogs(activeRunId);
        await loadRuns(false);

        if (!cancelled && detail && (detail.status === 'queued' || detail.status === 'running')) {
          timeoutId = window.setTimeout(poll, POLL_MS);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeRunId, loadRunDetail, loadRunLogs, loadRuns]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <TopNav />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 dark:bg-slate-900 dark:border-slate-700">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">Testen</h1>
              <p className="text-sm text-gray-600 mt-1 dark:text-slate-300">
                Start een gequeue-de Playwright/Pytest run en volg status, logs en artifacts.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="suite" className="text-xs font-medium text-gray-600 dark:text-slate-300">
                  Suite
                </label>
                <select
                  id="suite"
                  value={suite}
                  onChange={(event) => setSuite(event.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                >
                  <option value="avp_scenario">avp_scenario</option>
                  <option value="smoke">smoke</option>
                </select>
              </div>
              <div>
                <label htmlFor="base-url" className="text-xs font-medium text-gray-600 dark:text-slate-300">
                  Base URL (optioneel)
                </label>
                <input
                  id="base-url"
                  type="text"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>
              <button
                onClick={handleStartRun}
                disabled={startingRun}
                className="h-10 mt-5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {startingRun ? 'Starten...' : 'Start test-run'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700/60">
              {error}
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 dark:bg-slate-900 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Live status</h2>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusClassName(activeRun?.status)}`}
              >
                {activeRun?.status || 'idle'}
              </span>
            </div>
            <dl className="mt-4 text-sm text-gray-700 space-y-2 dark:text-slate-200">
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Run ID</dt>
                <dd className="font-mono text-xs break-all text-right">{activeRun?.run_id || '-'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Starttijd</dt>
                <dd>{toLocale(activeRun?.started_at || activeRun?.queued_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Eindtijd</dt>
                <dd>{toLocale(activeRun?.finished_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-medium">Resultaat</dt>
                <dd>
                  {activeRun?.passed ?? 0}/{activeRun?.total ?? 0} geslaagd, {activeRun?.failed ?? 0} gefaald
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Artifacts</p>
              <div className="mt-2">
                <RunArtifacts artifacts={activeRun?.artifacts || []} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 dark:bg-slate-900 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Live logs</h2>
            <pre className="mt-4 h-80 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 whitespace-pre-wrap dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200">
              {logs || 'Nog geen logs'}
            </pre>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 dark:bg-slate-900 dark:border-slate-700">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Laatste runs</h2>
            <button
              onClick={() => loadRuns()}
              disabled={loadingRuns}
              className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {loadingRuns ? 'Verversen...' : 'Verversen'}
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-y border-gray-200 dark:bg-slate-800 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase dark:text-slate-300">run_id</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase dark:text-slate-300">Start</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase dark:text-slate-300">Eind</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase dark:text-slate-300">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase dark:text-slate-300">Total</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase dark:text-slate-300">Passed</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase dark:text-slate-300">Failed</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase dark:text-slate-300">Artifacts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-3 py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                      Nog geen test-runs.
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr
                      key={run.run_id}
                      onClick={() => setActiveRunId(run.run_id)}
                      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 ${
                        run.run_id === activeRunId ? 'bg-blue-50/80 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <td className="px-3 py-3 text-xs font-mono text-gray-800 dark:text-slate-200">{run.run_id}</td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-slate-300">{toLocale(run.started_at || run.queued_at)}</td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-slate-300">{toLocale(run.finished_at)}</td>
                      <td className="px-3 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClassName(run.status)}`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-slate-300">{run.total ?? 0}</td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-slate-300">{run.passed ?? 0}</td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-slate-300">{run.failed ?? 0}</td>
                      <td className="px-3 py-3 text-sm">
                        <RunArtifacts artifacts={run.artifacts || []} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Testen;
