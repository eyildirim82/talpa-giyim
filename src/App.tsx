import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/design-system.css';
import Home from './pages/Home';
import MyCodes from './pages/MyCodes';
import Archive from './pages/Archive';
import CampaignDetail from './pages/CampaignDetail';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* Yeni tasarım (Modern Minimal) — üye tarafı */}
        <Route path="/" element={<Home />} />
        <Route path="/kodlarim" element={<MyCodes />} />
        <Route path="/arsiv" element={<Archive />} />
        <Route path="/kampanya/:slug" element={<CampaignDetail />} />
        {/* Henüz eski tasarımda — sırayla yenilenecek */}
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
