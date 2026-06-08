import { useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Tag, Megaphone, Settings as SettingsIcon, LogOut, Plane } from 'lucide-react';
import { useAuth } from './useAuth';
import { AdminCtx } from './ctx';
import Login from './Login';
import Overview from './sections/Overview';
import Campaigns from './sections/Campaigns';
import CampaignDetail from './sections/CampaignDetail';
import Types from './sections/Types';
import Announcements from './sections/Announcements';
import Settings from './sections/Settings';

const linkClass = ({ isActive }: { isActive: boolean }) => `ds-side__link${isActive ? ' active' : ''}`;

export default function AdminApp() {
  const auth = useAuth();
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const notify = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  if (auth.loading) {
    return (
      <div className="ds">
        <div className="ds-container">Yükleniyor…</div>
      </div>
    );
  }

  if (!auth.session) {
    return <Login signIn={auth.signIn} />;
  }

  const email = auth.session.user.email ?? '';
  const initials = (email.slice(0, 2) || 'AD').toUpperCase();

  return (
    <AdminCtx.Provider value={{ email, getAuthHeaders: auth.getAuthHeaders, signOut: auth.signOut, notify }}>
      <div className="ds ds-admin">
        <aside className="ds-side ds-side--navy">
          <div className="ds-side__brand">
            <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <Plane size={17} color="#fff" />
            </span>
            <span>TALPA<small>Yönetim Paneli</small></span>
          </div>

          <NavLink end to="/admin" className={linkClass}>
            <LayoutDashboard size={18} /> Genel Bakış
          </NavLink>
          <NavLink to="/admin/kampanyalar" className={linkClass}>
            <Package size={18} /> Kampanyalar
          </NavLink>
          <NavLink to="/admin/turler" className={linkClass}>
            <Tag size={18} /> Türler
          </NavLink>
          <NavLink to="/admin/duyurular" className={linkClass}>
            <Megaphone size={18} /> Duyurular
          </NavLink>
          <NavLink to="/admin/ayarlar" className={linkClass}>
            <SettingsIcon size={18} /> Ayarlar
          </NavLink>

          <div className="ds-side__foot">
            <span className="ds-side__avatar">{initials}</span>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
              {email}
            </span>
            <button type="button" className="ds-side__logout" title="Çıkış" onClick={() => void auth.signOut()}>
              <LogOut size={16} />
            </button>
          </div>
        </aside>

        <div className="ds-admin__main">
          {msg && (
            <div style={{ padding: '1rem 1.5rem 0' }}>
              <div className={`ds-alert ds-alert--${msg.type === 'success' ? 'success' : 'danger'}`} style={{ marginBottom: 0 }}>
                {msg.text}
              </div>
            </div>
          )}

          <div className="ds-admin__body">
            <Routes>
              <Route index element={<Overview />} />
              <Route path="kampanyalar" element={<Campaigns />} />
              <Route path="kampanyalar/:id" element={<CampaignDetail />} />
              <Route path="turler" element={<Types />} />
              <Route path="duyurular" element={<Announcements />} />
              <Route path="ayarlar" element={<Settings />} />
            </Routes>
          </div>
        </div>
      </div>
    </AdminCtx.Provider>
  );
}
