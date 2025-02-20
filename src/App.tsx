import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import WalletPage from './pages/WalletPage';
import PurchasePage from './pages/PurchasePage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WalletPage />} />
        <Route path="/purchase/:walletAddress" element={<PurchasePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;