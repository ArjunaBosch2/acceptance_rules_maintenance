import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import RuleDetail from './RuleDetail';
import Products from './Products';
import ProductRules from './ProductRules';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/producten" element={<Products />} />
        <Route path="/producten/:productId/regels" element={<ProductRules />} />
        <Route path="/rules/:regelId" element={<RuleDetail />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
