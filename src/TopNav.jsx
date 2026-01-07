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
          <NavLink to="/" className={navLinkClasses} end>
            Acceptatieregels
          </NavLink>
          <NavLink to="/producten" className={navLinkClasses}>
            Producten
          </NavLink>
          {hasAuth ? (
            <button
              onClick={handleLogout}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Uitloggen
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
