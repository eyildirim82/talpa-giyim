import { Link, NavLink } from 'react-router-dom';
import { History, Archive } from 'lucide-react';

/** Üye tarafı üst barı — Modern Minimal, açık tema. */
export default function DsNav() {
  return (
    <nav className="ds-nav">
      <div className="ds-nav__inner">
        <Link to="/" className="ds-nav__brand">
          <img src="/talpa-logo.webp" alt="TALPA" />
          <span>TALPA Ayrıcalıklar</span>
        </Link>
        <div className="ds-nav__links">
          <NavLink to="/arsiv" className="ds-nav__link">
            <Archive size={16} /> Arşiv
          </NavLink>
          <NavLink to="/kodlarim" className="ds-nav__link">
            <History size={16} /> Kodlarım
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
