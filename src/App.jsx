import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, AlertCircle, X, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TopNav from './TopNav';
import { withApiEnv } from './apiEnv';
import { getAuthHeader } from './apiAuth';

const App = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    omschrijving: '',
    expressie: '',
    afdBrancheCode: '',
  });
  const [createError, setCreateError] = useState(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRuleId, setEditRuleId] = useState(null);
  const [editOmschrijving, setEditOmschrijving] = useState('');
  const [editExpressie, setEditExpressie] = useState('');
  const [editError, setEditError] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const rulesPerPage = 10;
  const navigate = useNavigate();

  // Normalize varying API shapes into the fields the table expects
  const normalizeRules = (incoming) => {
    if (!incoming) return [];

    const flatten = (items) =>
      items.flatMap((item) => {
        if (!item) return [];
        if (Array.isArray(item)) return flatten(item);
        if (Array.isArray(item.Data)) return flatten(item.Data);

        return [
          {
            regelId: item.regelId ?? item.RegelId ?? item.id ?? '',
            externNummer: item.externNummer ?? item.ExternNummer ?? '',
            omschrijving: item.omschrijving ?? item.Omschrijving ?? '',
          },
        ];
      });

    return flatten(Array.isArray(incoming) ? incoming : [incoming]);
  };

  const fetchRules = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(withApiEnv('/api/acceptance-rules'), {
        headers: { ...getAuthHeader() },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch acceptance rules');
      }

      const data = await response.json();
      // Support multiple shapes: {rules: [...]}, {data: [...]}, or direct array/object
      const normalized = normalizeRules(data.rules || data.data || data);
      setRules(normalized);
    } catch (err) {
      setError(err.message);
      // Demo data for illustration when API fails
      setRules([
        { regelId: 'R001', externNummer: 'EXT-2024-001', omschrijving: 'Leeftijdsgrens voor standaard verzekering' },
        { regelId: 'R002', externNummer: 'EXT-2024-002', omschrijving: 'Medische keuring vereist boven drempelwaarde' },
        { regelId: 'R003', externNummer: 'EXT-2024-003', omschrijving: 'Geografische beperking voor bepaalde gebieden' },
        { regelId: 'R004', externNummer: 'EXT-2024-004', omschrijving: 'Beroepsrisico evaluatie criteria' },
        { regelId: 'R005', externNummer: 'EXT-2024-005', omschrijving: 'Minimale dekking voor bedrijfsverzekeringen' },
        { regelId: 'R006', externNummer: 'EXT-2024-006', omschrijving: 'Uitsluitingen voor pre-existente condities' },
        { regelId: 'R007', externNummer: 'EXT-2024-007', omschrijving: 'Wachttijd voor bepaalde dekking' },
        { regelId: 'R008', externNummer: 'EXT-2024-008', omschrijving: 'Maximum dekkingsbedrag per categorie' },
        { regelId: 'R009', externNummer: 'EXT-2024-009', omschrijving: 'Risico-opslag voor specifieke branches' },
        { regelId: 'R010', externNummer: 'EXT-2024-010', omschrijving: 'Documentatie vereisten voor aanvraag' },
        { regelId: 'R011', externNummer: 'EXT-2024-011', omschrijving: 'Gezondheidsverklaring verplicht vanaf leeftijd' },
        { regelId: 'R012', externNummer: 'EXT-2024-012', omschrijving: 'Eigen risico minimum en maximum' },
        { regelId: 'R013', externNummer: 'EXT-2024-013', omschrijving: 'Acceptatie criteria voor gevaarlijke hobby\'s' },
        { regelId: 'R014', externNummer: 'EXT-2024-014', omschrijving: 'Polisvoorwaarden voor meerdere verzekeringen' },
        { regelId: 'R015', externNummer: 'EXT-2024-015', omschrijving: 'Annuleringsrecht binnen koelingsperiode' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
    const handleEnvChange = () => {
      setCurrentPage(1);
      fetchRules();
    };
    window.addEventListener('apiEnvChange', handleEnvChange);
    return () => window.removeEventListener('apiEnvChange', handleEnvChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRules = rules.filter((rule) =>
    rule.regelId?.toString().toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredRules.length / rulesPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const indexOfLastRule = safePage * rulesPerPage;
  const indexOfFirstRule = indexOfLastRule - rulesPerPage;
  const currentRules = filteredRules.slice(indexOfFirstRule, indexOfLastRule);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleRefresh = () => {
    setCurrentPage(1);
    fetchRules();
  };

  const handleDelete = async (regelId) => {
    if (!regelId) return;
    setDeletingId(regelId);
    setError(null);
    try {
      const response = await fetch(
        withApiEnv(`/api/acceptance-rules?regelId=${encodeURIComponent(regelId)}`),
        {
          method: 'DELETE',
          headers: { 'Cache-Control': 'no-store', ...getAuthHeader() },
        }
      );
      if (!response.ok) {
        let message = `Failed to delete rule (status ${response.status})`;
        try {
          const payload = await response.json();
          message = payload.message || payload.error || message;
        } catch (err) {
          // ignore JSON parse failure
        }
        throw new Error(message);
      }
      setRules((prev) => prev.filter((rule) => rule.regelId !== regelId));
      setShowDeleteSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleCreateInputChange = (field) => (event) => {
    setCreateForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const openEditModal = (regelId, omschrijvingValue, expressieValue) => {
    setEditRuleId(regelId);
    setEditOmschrijving(omschrijvingValue || '');
    setEditExpressie(expressieValue || '');
    setEditError(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setEditError(null);
    if (!editRuleId) {
      setEditError('RegelId ontbreekt.');
      return;
    }
    if (!editOmschrijving.trim()) {
      setEditError('Omschrijving is verplicht.');
      return;
    }
    if (!editExpressie.trim()) {
      setEditError('Xpath expressie is verplicht.');
      return;
    }

    setEditSubmitting(true);
    try {
      const resourceId = crypto?.randomUUID ? crypto.randomUUID() : undefined;
      const payload = {
        RegelId: editRuleId,
        Omschrijving: editOmschrijving.trim(),
        Expressie: editExpressie.trim(),
        ResourceId: resourceId,
      };
      const response = await fetch(withApiEnv('/api/acceptance-rules'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let message = `Failed to update rule (status ${response.status})`;
        try {
          const payloadError = await response.json();
          message = payloadError.message || payloadError.error || message;
        } catch (err) {
          // ignore JSON parse failure
        }
        throw new Error(message);
      }
      setShowEditModal(false);
      setEditRuleId(null);
      setEditOmschrijving('');
      setEditExpressie('');
      fetchRules();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    setCreateError(null);

    const omschrijving = createForm.omschrijving.trim();
    const expressie = createForm.expressie.trim();
    const afdCodeRaw = createForm.afdBrancheCode.trim();
    const afdCode = Number.parseInt(afdCodeRaw, 10);

    if (!omschrijving) {
      setCreateError('Omschrijving is verplicht.');
      return;
    }
    if (omschrijving.length > 200) {
      setCreateError('Omschrijving mag maximaal 200 tekens bevatten.');
      return;
    }
    if (!expressie) {
      setCreateError('Xpath Expressie is verplicht.');
      return;
    }
    if (!afdCodeRaw || Number.isNaN(afdCode)) {
      setCreateError('Afd branchecode moet een geheel getal zijn.');
      return;
    }

    setCreateSubmitting(true);
    try {
      const resourceId = crypto?.randomUUID ? crypto.randomUUID() : undefined;
      const payload = {
        AfdBrancheCodeId: afdCode,
        Omschrijving: omschrijving,
        Expressie: expressie,
        ResourceId: resourceId,
      };
      const response = await fetch(withApiEnv('/api/acceptance-rules'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let message = `Failed to create rule (status ${response.status})`;
        try {
          const payloadError = await response.json();
          message = payloadError.message || payloadError.error || message;
        } catch (err) {
          // ignore JSON parse failure
        }
        throw new Error(message);
      }
      setShowCreateModal(false);
      setCreateForm({ omschrijving: '', expressie: '', afdBrancheCode: '' });
      setCurrentPage(1);
      fetchRules();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateSubmitting(false);
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
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
                  Acceptatieregels
                </h1>
                <p className="text-sm text-gray-600 mt-1 dark:text-slate-300">
                  Beheer van verzekering acceptatieregels
                </p>
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Zoek op Regel ID (bijv. 60_200)"
                  className="w-full md:w-60 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg transition-colors neon-primary"
                >
                  + Nieuwe regel
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mx-6 mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3 dark:bg-yellow-900/30 dark:border-yellow-700/60">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5 dark:text-yellow-400" />
              <div>
                <p className="text-sm text-yellow-800 font-medium dark:text-yellow-200">
                  Actie mislukt
                </p>
                <p className="text-xs text-yellow-700 mt-1 dark:text-yellow-200/80">{error}</p>
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
                      Extern Nummer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider dark:text-slate-300">
                      Omschrijving
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider dark:text-slate-300">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider dark:text-slate-300">
                      Aanpassen
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-900 dark:divide-slate-800">
                  {currentRules.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                        Geen acceptatieregels gevonden
                      </td>
                    </tr>
                  ) : (
                    currentRules.map((rule) => (
                      <tr key={rule.regelId} className="hover:bg-gray-50 transition-colors dark:hover:bg-slate-800">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-700 dark:text-blue-300">
                          <button
                            onClick={() => navigate(`/rules/${rule.regelId}`)}
                            className="hover:underline"
                          >
                            {rule.regelId}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-200">
                          {rule.externNummer}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-200">
                          {rule.omschrijving}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => navigate(`/rules/${rule.regelId}`)}
                            className="px-3 py-2 border border-blue-100 text-blue-700 rounded-md hover:bg-blue-50 hover:border-blue-200 hover:shadow-sm transition-all duration-150 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-900/30 neon-outline"
                            title="Toon details"
                          >
                            Details
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(rule.regelId, rule.omschrijving, '')}
                              className="p-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                              title="Bewerk acceptatieregel"
                              aria-label={`Bewerk acceptatieregel ${rule.regelId}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(rule.regelId)}
                              disabled={deletingId === rule.regelId}
                              className="p-2 rounded-md border border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-900/20"
                              title="Verwijder acceptatieregel"
                              aria-label={`Verwijder acceptatieregel ${rule.regelId}`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {rules.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between dark:border-slate-700">
              <div className="text-sm text-gray-700 dark:text-slate-200">
                Toont {filteredRules.length === 0 ? 0 : indexOfFirstRule + 1} tot {Math.min(indexOfLastRule, filteredRules.length)} van {filteredRules.length} regels
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(safePage - 1)}
                  disabled={safePage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {[...Array(totalPages)].map((_, index) => {
                  const pageNumber = index + 1;
                  if (
                    pageNumber === 1 ||
                    pageNumber === totalPages ||
                    (pageNumber >= safePage - 1 && pageNumber <= safePage + 1)
                  ) {
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => handlePageChange(pageNumber)}
                        className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                          safePage === pageNumber
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  } else if (
                    pageNumber === safePage - 2 ||
                    pageNumber === safePage + 2
                  ) {
                    return <span key={pageNumber} className="px-2 py-2 text-gray-500 dark:text-slate-400">...</span>;
                  }
                  return null;
                })}

                <button
                  onClick={() => handlePageChange(safePage + 1)}
                  disabled={safePage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showDeleteSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm border border-gray-200 dark:bg-slate-900 dark:border-slate-700 neon-modal">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Melding</p>
              <button
                onClick={() => setShowDeleteSuccess(false)}
                className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800"
                aria-label="Sluit melding"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-5 text-sm text-gray-700 dark:text-slate-200">
              Acceptatieregel succesvol verwijderd
            </div>
            <div className="px-4 py-3 flex justify-end">
              <button
                onClick={() => setShowDeleteSuccess(false)}
                className="px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-md border border-blue-100 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-900/30"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg border border-gray-200 dark:bg-slate-900 dark:border-slate-700 neon-modal">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Nieuwe acceptatieregel</p>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800"
                aria-label="Sluit formulier"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="px-5 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="omschrijving">
                  Omschrijving
                </label>
                <input
                  id="omschrijving"
                  type="text"
                  maxLength={200}
                  value={createForm.omschrijving}
                  onChange={handleCreateInputChange('omschrijving')}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="expressie">
                  Xpath Expressie
                </label>
                <textarea
                  id="expressie"
                  rows="4"
                  value={createForm.expressie}
                  onChange={handleCreateInputChange('expressie')}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="afd-branchecode">
                  Afd branchecode
                </label>
                <input
                  id="afd-branchecode"
                  type="number"
                  value={createForm.afdBrancheCode}
                  onChange={handleCreateInputChange('afdBrancheCode')}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>
              {createError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 dark:bg-red-900/30 dark:border-red-700/60 dark:text-red-300">
                  {createError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md border border-gray-200 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Opslaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg border border-gray-200 dark:bg-slate-900 dark:border-slate-700 neon-modal">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                Bewerk acceptatieregel {editRuleId}
              </p>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800"
                aria-label="Sluit formulier"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="px-5 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="edit-omschrijving">
                  Omschrijving
                </label>
                <input
                  id="edit-omschrijving"
                  type="text"
                  value={editOmschrijving}
                  onChange={(event) => setEditOmschrijving(event.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="edit-expressie">
                  Aangepaste Xpath expressie
                </label>
                <textarea
                  id="edit-expressie"
                  rows="5"
                  value={editExpressie}
                  onChange={(event) => setEditExpressie(event.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>
              {editError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 dark:bg-red-900/30 dark:border-red-700/60 dark:text-red-300">
                  {editError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md border border-gray-200 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Opslaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
