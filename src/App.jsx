import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, AlertCircle, X, Pencil, Info } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const restoredListRef = useRef(false);
  const makeId = () =>
    crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
  const createEmptyCondition = () => ({
    id: makeId(),
    operator: '=',
    value: '',
    joiner: 'and',
  });
  const createEmptyRecord = () => ({
    id: makeId(),
    rubriek: '',
    joiner: 'and',
    conditions: [createEmptyCondition()],
  });
  const [xpathBuilder, setXpathBuilder] = useState(() => ({
    records: [createEmptyRecord()],
  }));
  const [builderError, setBuilderError] = useState(null);
  const operatorOptions = [
    { value: '=', label: '=' },
    { value: '!=', label: '!=' },
    { value: '>', label: '>' },
    { value: '<', label: '<' },
    { value: '>=', label: '>=' },
    { value: '<=', label: '<=' },
    { value: 'contains', label: 'contains' },
    { value: 'not-contains', label: 'not contains' },
    { value: 'starts-with', label: 'starts-with' },
    { value: 'ends-with', label: 'ends-with' },
  ];
  const joinerOptions = [
    { value: 'and', label: 'EN' },
    { value: 'or', label: 'OF' },
  ];

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

  useEffect(() => {
    const listState = location.state?.listState;
    if (!restoredListRef.current && listState) {
      if (typeof listState.searchTerm === 'string') {
        setSearchTerm(listState.searchTerm);
      }
      if (Number.isFinite(listState.currentPage)) {
        setCurrentPage(listState.currentPage);
      }
      restoredListRef.current = true;
    }
  }, [location.state]);

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

  const handleRecordUpdate = (recordId, updates) => {
    setXpathBuilder((prev) => ({
      ...prev,
      records: prev.records.map((record) =>
        record.id === recordId ? { ...record, ...updates } : record
      ),
    }));
    setBuilderError(null);
  };

  const handleConditionUpdate = (recordId, conditionId, updates) => {
    setXpathBuilder((prev) => ({
      ...prev,
      records: prev.records.map((record) => {
        if (record.id !== recordId) return record;
        return {
          ...record,
          conditions: record.conditions.map((condition) =>
            condition.id === conditionId ? { ...condition, ...updates } : condition
          ),
        };
      }),
    }));
    setBuilderError(null);
  };

  const handleAddCondition = (recordId) => {
    setXpathBuilder((prev) => ({
      ...prev,
      records: prev.records.map((record) =>
        record.id === recordId
          ? { ...record, conditions: [...record.conditions, createEmptyCondition()] }
          : record
      ),
    }));
    setBuilderError(null);
  };

  const handleRemoveCondition = (recordId, conditionId) => {
    setXpathBuilder((prev) => ({
      ...prev,
      records: prev.records.map((record) => {
        if (record.id !== recordId) return record;
        const remaining = record.conditions.filter((condition) => condition.id !== conditionId);
        return {
          ...record,
          conditions: remaining.length ? remaining : [createEmptyCondition()],
        };
      }),
    }));
    setBuilderError(null);
  };

  const handleAddRecord = () => {
    setXpathBuilder((prev) => ({
      ...prev,
      records: [...prev.records, createEmptyRecord()],
    }));
    setBuilderError(null);
  };

  const handleRemoveRecord = (recordId) => {
    setXpathBuilder((prev) => {
      const remaining = prev.records.filter((record) => record.id !== recordId);
      return {
        ...prev,
        records: remaining.length ? remaining : [createEmptyRecord()],
      };
    });
    setBuilderError(null);
  };

  const normalizeJoiner = (joiner) => (joiner === 'or' ? 'or' : 'and');

  const isNumericValue = (value) => /^-?\d+$/.test(value);

  const buildXPathLiteral = (rawValue) => {
    if (!rawValue.includes("'")) return `'${rawValue}'`;
    if (!rawValue.includes('"')) return `"${rawValue}"`;
    const parts = rawValue.split("'");
    const wrapped = parts.map((part) => (part ? `'${part}'` : "''"));
    return `concat(${wrapped.join(',\"\'\",')})`;
  };

  const buildConditionExpression = (rubriek, condition) => {
    const value = condition.value.trim();
    if (!value) return null;
    const fieldPath = `//${rubriek}`;
    const fieldLower = `lower-case(${fieldPath})`;
    const valueLiteral = buildXPathLiteral(value);
    const valueLower = `lower-case(${valueLiteral})`;
    const numericOperators = ['>', '<', '>=', '<='];
    if (numericOperators.includes(condition.operator) && isNumericValue(value)) {
      return `number(${fieldPath}) ${condition.operator} ${value}`;
    }
    switch (condition.operator) {
      case '=':
        return `${fieldLower} = ${valueLower}`;
      case '!=':
        return `${fieldLower} != ${valueLower}`;
      case '>':
      case '<':
      case '>=':
      case '<=':
        return `${fieldLower} ${condition.operator} ${valueLower}`;
      case 'contains':
        return `contains(${fieldLower},${valueLower})`;
      case 'not-contains':
        return `not(contains(${fieldLower},${valueLower}))`;
      case 'starts-with':
        return `starts-with(${fieldLower},${valueLower})`;
      case 'ends-with':
        return `ends-with(${fieldLower},${valueLower})`;
      default:
        return `${fieldLower} = ${valueLower}`;
    }
  };

  const buildRecordExpression = (record) => {
    const rubriek = record.rubriek.trim();
    if (!rubriek) return null;
    const conditionExpressions = record.conditions
      .map((condition) => buildConditionExpression(rubriek, condition))
      .filter(Boolean);
    if (conditionExpressions.length === 0) return null;
    let combined = conditionExpressions[0];
    for (let i = 1; i < conditionExpressions.length; i += 1) {
      const joiner = normalizeJoiner(record.conditions[i].joiner);
      combined = `${combined} ${joiner} ${conditionExpressions[i]}`;
    }
    const conditionBlock =
      conditionExpressions.length > 1 ? `((${combined}))` : `(${combined})`;
    return `(fn:exists(//${rubriek}) and ${conditionBlock})`;
  };

  const buildXPathExpression = (records) => {
    const recordExpressions = records
      .map((record) => ({
        expr: buildRecordExpression(record),
        joiner: normalizeJoiner(record.joiner),
      }))
      .filter((record) => record.expr);
    if (recordExpressions.length === 0) return '';
    let combined = recordExpressions[0].expr;
    for (let i = 1; i < recordExpressions.length; i += 1) {
      combined = `${combined} ${recordExpressions[i].joiner} ${recordExpressions[i].expr}`;
    }
    return `if(( ${combined} )) then false() else true()`;
  };

  const handleApplyBuilder = () => {
    const expression = buildXPathExpression(xpathBuilder.records);
    if (!expression) {
      setBuilderError('Vul minimaal een rubriek en waarde in.');
      return;
    }
    setCreateForm((prev) => ({ ...prev, expressie: expression }));
    setBuilderError(null);
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
      setXpathBuilder({ records: [createEmptyRecord()] });
      setBuilderError(null);
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
                            onClick={() =>
                              navigate(`/rules/${rule.regelId}`, {
                                state: { listState: { searchTerm, currentPage } },
                              })
                            }
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
                            onClick={() =>
                              navigate(`/rules/${rule.regelId}`, {
                                state: { listState: { searchTerm, currentPage } },
                              })
                            }
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
            <form
              onSubmit={handleCreateSubmit}
              className="px-5 py-4 space-y-4 max-h-[75vh] overflow-y-auto"
            >
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
              <div className="flex items-center gap-3 text-xs font-medium text-gray-400 uppercase tracking-widest">
                <span className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></span>
                <span>---- OF ----</span>
                <span className="flex-1 h-px bg-gray-200 dark:bg-slate-700"></span>
              </div>
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 space-y-4 dark:border-slate-700 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-100">Xpath builder</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Bouw de expressie met rubrieken en voorwaarden en vul de Xpath Expressie in.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyBuilder}
                    disabled={!buildXPathExpression(xpathBuilder.records)}
                    className="px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    Vul Xpath Expressie
                  </button>
                </div>
                {xpathBuilder.records.map((record, recordIndex) => (
                  <div
                    key={record.id}
                    className="rounded-md border border-gray-200 bg-white/70 p-3 space-y-3 dark:border-slate-700 dark:bg-slate-900/40"
                  >
                    {recordIndex > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          className="text-xs font-medium text-gray-500 dark:text-slate-400"
                          htmlFor={`record-joiner-${record.id}`}
                        >
                          Koppeling met vorige rubriek
                        </label>
                        <select
                          id={`record-joiner-${record.id}`}
                          value={record.joiner}
                          onChange={(event) =>
                            handleRecordUpdate(record.id, { joiner: event.target.value })
                          }
                          className="px-2 py-1 border border-gray-300 rounded-md text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                        >
                          {joinerOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <label
                        className="text-xs font-medium text-gray-600 dark:text-slate-300"
                        htmlFor={`rubriek-${record.id}`}
                      >
                        Check op rubriek:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id={`rubriek-${record.id}`}
                          type="text"
                          value={record.rubriek}
                          onChange={(event) =>
                            handleRecordUpdate(record.id, { rubriek: event.target.value })
                          }
                          placeholder="Bijv. PG_456"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                        />
                        <div className="relative group">
                          <Info
                            className="w-4 h-4 text-gray-400 dark:text-slate-400"
                            aria-label="Info over rubriek"
                          />
                          <div className="pointer-events-none absolute right-0 top-6 w-72 rounded-md bg-gray-900 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            Plaats hier de entiteit_Tp nummer of AFD subentiteit. Voorbeeld TP nummer:
                            PG_456. Voorbeeld AFD: OB_KENTEKE.
                          </div>
                        </div>
                      </div>
                    </div>
                    {record.conditions.map((condition, conditionIndex) => (
                      <div
                        key={condition.id}
                        className="flex flex-wrap items-end gap-3"
                      >
                        {conditionIndex > 0 && (
                          <div className="min-w-[70px]">
                            <label
                              className="text-xs font-medium text-gray-500 dark:text-slate-400"
                              htmlFor={`condition-joiner-${condition.id}`}
                            >
                              EN/OF
                            </label>
                            <select
                              id={`condition-joiner-${condition.id}`}
                              value={condition.joiner}
                              onChange={(event) =>
                                handleConditionUpdate(record.id, condition.id, {
                                  joiner: event.target.value,
                                })
                              }
                              className="mt-1 w-full px-2 py-1 border border-gray-300 rounded-md text-xs dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                            >
                              {joinerOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="flex-1 min-w-[140px]">
                          <label
                            className="text-xs font-medium text-gray-600 dark:text-slate-300"
                            htmlFor={`operator-${condition.id}`}
                          >
                            Operator
                          </label>
                          <select
                            id={`operator-${condition.id}`}
                            value={condition.operator}
                            onChange={(event) =>
                              handleConditionUpdate(record.id, condition.id, {
                                operator: event.target.value,
                              })
                            }
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                          >
                            {operatorOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1 min-w-[160px]">
                          <label
                            className="text-xs font-medium text-gray-600 dark:text-slate-300"
                            htmlFor={`waarde-${condition.id}`}
                          >
                            Met waarde
                          </label>
                          <input
                            id={`waarde-${condition.id}`}
                            type="text"
                            value={condition.value}
                            onChange={(event) =>
                              handleConditionUpdate(record.id, condition.id, {
                                value: event.target.value,
                              })
                            }
                            placeholder="Bijv. 15"
                            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                          />
                        </div>
                        {conditionIndex > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveCondition(record.id, condition.id)
                            }
                            className="px-2 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 dark:text-slate-300 dark:hover:text-slate-100"
                          >
                            Verwijder
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddCondition(record.id)}
                        className="text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                      >
                        + Extra operatie op dezelfde rubriek
                      </button>
                      {xpathBuilder.records.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRecord(record.id)}
                          className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          Verwijder rubriek
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleAddRecord}
                    className="text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                  >
                    + Rubriek toevoegen
                  </button>
                  {builderError && (
                    <span className="text-xs text-red-600 dark:text-red-300">
                      {builderError}
                    </span>
                  )}
                </div>
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
