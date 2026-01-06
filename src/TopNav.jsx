import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getApiEnv, setApiEnv } from './apiEnv';
import { clearAuthCredentials, getAuthCredentials, setAuthCredentials } from './apiAuth';

const navLinkClasses = ({ isActive }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-blue-600 text-white shadow-sm'
      : 'text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800'
  }`;

const TopNav = () => {
  const navigate = useNavigate();
  const [apiEnv, setApiEnvState] = useState(getApiEnv());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authUser, setAuthUser] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [hasAuth, setHasAuth] = useState(Boolean(getAuthCredentials()));

  const handleEnvChange = (event) => {
    const nextEnv = event.target.value;
    setApiEnvState(nextEnv);
    setApiEnv(nextEnv);
  };

  useEffect(() => {
    const handleAuthChange = () => {
      setHasAuth(Boolean(getAuthCredentials()));
    };
    window.addEventListener('authChange', handleAuthChange);
    return () => window.removeEventListener('authChange', handleAuthChange);
  }, []);

  const handleAuthSubmit = (event) => {
    event.preventDefault();
    if (!authUser || !authPass) return;
    setAuthCredentials(authUser, authPass);
    setShowAuthModal(false);
    setAuthUser('');
    setAuthPass('');
  };

  const handleLogout = () => {
    clearAuthCredentials();
  };

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="text-blue-700 font-semibold text-lg tracking-tight dark:text-blue-300"
          aria-label="Ga naar Acceptatieregels"
        >
          Acceptatiebeheer
        </button>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 dark:text-slate-300" htmlFor="api-env">
              Omgeving
            </label>
            <select
              id="api-env"
              value={apiEnv}
              onChange={handleEnvChange}
              className="px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
            >
              <option value="production">Productie</option>
              <option value="acceptance">Acceptatie</option>
            </select>
          </div>
          {hasAuth ? (
            <button
              onClick={handleLogout}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Uitloggen
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-900/30"
            >
              Inloggen
            </button>
          )}
          <NavLink to="/" className={navLinkClasses} end>
            Acceptatieregels
          </NavLink>
          <NavLink to="/producten" className={navLinkClasses}>
            Producten
          </NavLink>
        </div>
      </div>
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm border border-gray-200 dark:bg-slate-900 dark:border-slate-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Inloggen</p>
              <button
                onClick={() => setShowAuthModal(false)}
                className="p-1 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800"
                aria-label="Sluit formulier"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAuthSubmit} className="px-4 py-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="auth-user">
                  Gebruikersnaam
                </label>
                <input
                  id="auth-user"
                  type="text"
                  value={authUser}
                  onChange={(event) => setAuthUser(event.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-slate-200" htmlFor="auth-pass">
                  Wachtwoord
                </label>
                <input
                  id="auth-pass"
                  type="password"
                  value={authPass}
                  onChange={(event) => setAuthPass(event.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md border border-gray-200 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Inloggen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
};

export default TopNav;
