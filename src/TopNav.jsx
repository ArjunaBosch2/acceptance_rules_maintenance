import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getApiEnv, setApiEnv } from './apiEnv';

const navLinkClasses = ({ isActive }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'
  }`;

const TopNav = () => {
  const navigate = useNavigate();
  const [apiEnv, setApiEnvState] = useState(getApiEnv());

  const handleEnvChange = (event) => {
    const nextEnv = event.target.value;
    setApiEnvState(nextEnv);
    setApiEnv(nextEnv);
  };

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="text-blue-700 font-semibold text-lg tracking-tight"
          aria-label="Ga naar Acceptatieregels"
        >
          Acceptatiebeheer
        </button>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600" htmlFor="api-env">
              Omgeving
            </label>
            <select
              id="api-env"
              value={apiEnv}
              onChange={handleEnvChange}
              className="px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
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
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
