import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, AlertCircle } from 'lucide-react';
import TopNav from './TopNav';

const ProductRules = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRules = async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/products?productId=${encodeURIComponent(productId)}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch product rules (status ${res.status})`);
      }
      const data = await res.json();
      const validatieregels = Array.isArray(data.Validatieregels)
        ? data.Validatieregels
        : Array.isArray(data.validatieregels)
          ? data.validatieregels
          : Array.isArray(data.Data?.Validatieregels)
            ? data.Data.Validatieregels
            : [];
      setRules(validatieregels);
    } catch (err) {
      setError(err.message);
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            ← Terug
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">
            Acceptatieregels voor product {productId}
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Overzicht van validatieregels uit de productdefinitie
            </p>
            <button
              onClick={fetchRules}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="mx-6 mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800 font-medium">Kon acceptatieregels niet laden</p>
                <p className="text-xs text-yellow-700 mt-1">{error}</p>
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
                      ValidatieregelId
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      AandResultaatAcceptatie
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Omschrijving
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      FaseVanafAftrappenValidatieregel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      IsGeldigBijAanvraag
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      IsGeldigBijMutatie
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rules.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                        Geen acceptatieregels gevonden
                      </td>
                    </tr>
                  ) : (
                    rules.map((regel) => (
                      <tr key={regel.ValidatieregelId || regel.validatieregelId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {regel.ValidatieregelId ?? regel.validatieregelId ?? '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {regel.AandResultaatAcceptatie ?? regel.aandResultaatAcceptatie ?? '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {regel.Omschrijving ?? regel.omschrijving ?? '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {regel.FaseVanafAftrappenValidatieregel ??
                            regel.faseVanafAftrappenValidatieregel ??
                            '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {(regel.IsGeldigBijAanvraag ?? regel.isGeldigBijAanvraag ?? false).toString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {(regel.IsGeldigBijMutatie ?? regel.isGeldigBijMutatie ?? false).toString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() =>
                              navigate(`/rules/${regel.ValidatieregelId || regel.validatieregelId}`)
                            }
                            disabled={!(regel.ValidatieregelId || regel.validatieregelId)}
                            className="px-3 py-2 border border-blue-100 text-blue-700 rounded-md hover:bg-blue-50 hover:border-blue-200 hover:shadow-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Toon regel details"
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
        </div>
      </div>
    </div>
  );
};

export default ProductRules;
