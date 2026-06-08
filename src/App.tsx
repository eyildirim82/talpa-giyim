import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/design-system.css';
import Home from './pages/Home';
import MyCodes from './pages/MyCodes';
import Archive from './pages/Archive';
import CampaignDetail from './pages/CampaignDetail';
import AdminApp from './admin/AdminApp';

function App() {
  return (
    <Router>
      <Routes>
        {/* Yeni tasarım (Modern Minimal) — üye tarafı */}
        <Route path="/" element={<Home />} />
        <Route path="/kodlarim" element={<MyCodes />} />
        <Route path="/arsiv" element={<Archive />} />
        <Route path="/kampanya/:slug" element={<CampaignDetail />} />
        {/* Admin (yeni, sol-menü kabuk) — nested rotalar */}
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </Router>
  );
}

export default App;
