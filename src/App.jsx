import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TopNav from './TopNav';

const App = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
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
      const response = await fetch('/api/acceptance-rules');

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

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Acceptatieregels
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Beheer van verzekering acceptatieregels
                </p>
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Zoek op Regel ID (bijv. 60_200)"
                  className="w-full md:w-60 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mx-6 mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800 font-medium">
                  API verbinding niet beschikbaar
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Demo data wordt getoond. Configureer de backend API voor live data.
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
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Regel ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Extern Nummer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Omschrijving
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentRules.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                        Geen acceptatieregels gevonden
                      </td>
                    </tr>
                  ) : (
                    currentRules.map((rule) => (
                      <tr key={rule.regelId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-700">
                          <button
                            onClick={() => navigate(`/rules/${rule.regelId}`)}
                            className="hover:underline"
                          >
                            {rule.regelId}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {rule.externNummer}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {rule.omschrijving}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => navigate(`/rules/${rule.regelId}`)}
                            className="px-3 py-2 border border-blue-100 text-blue-700 rounded-md hover:bg-blue-50 hover:border-blue-200 hover:shadow-sm transition-all duration-150"
                            title="Toon details"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {rules.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Toont {filteredRules.length === 0 ? 0 : indexOfFirstRule + 1} tot {Math.min(indexOfLastRule, filteredRules.length)} van {filteredRules.length} regels
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(safePage - 1)}
                  disabled={safePage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  } else if (
                    pageNumber === safePage - 2 ||
                    pageNumber === safePage + 2
                  ) {
                    return <span key={pageNumber} className="px-2 py-2 text-gray-500">...</span>;
                  }
                  return null;
                })}

                <button
                  onClick={() => handlePageChange(safePage + 1)}
                  disabled={safePage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
