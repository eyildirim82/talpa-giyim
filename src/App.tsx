import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CampaignPage from './pages/CampaignPage';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <nav className="navbar">
        <NavLink to="/" className="brand">
          <img src="/talpa-logo.webp" alt="TALPA" style={{ height: '32px' }} />
        </NavLink>
        <div className="nav-links">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
            Kampanyalar
          </NavLink>
        </div>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/kampanya/:slug" element={<CampaignPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
