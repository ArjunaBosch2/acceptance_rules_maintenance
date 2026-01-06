import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const navLinkClasses = ({ isActive }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100'
  }`;

const TopNav = () => {
  const navigate = useNavigate();

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
        <div className="flex items-center gap-2">
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
