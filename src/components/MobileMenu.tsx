import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Library, Settings, User, Terminal } from 'lucide-react';
import { useAppearance } from '../context/AppearanceContext';
import { useDevAccess } from '../context/DevAccessContext';
import './Sidebar.css';
import './MobileMenu.css';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

function MobileMenu({ open, onClose }: MobileMenuProps) {
  const { naming } = useAppearance();
  const { devMode } = useDevAccess();
  const location = useLocation();

  useEffect(() => { onClose(); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const navItems = [
    { to: '/',         label: 'Board',     icon: LayoutDashboard, end: true },
    { to: '/library',  label: 'Library',   icon: Library },
    { to: '/settings', label: 'Settings',  icon: Settings },
    { to: '/profile',  label: 'Profile',   icon: User },
    ...(devMode ? [
      { to: '/dev/logs', label: 'Dev Logs', icon: Terminal },
    ] : []),
  ];

  return (
    <div className={`mobile-menu-overlay${open ? ' mobile-menu-overlay--open' : ''}`} onClick={onClose}>
      <div className={`mobile-menu-drawer${open ? ' mobile-menu-drawer--open' : ''}`} onClick={(e) => e.stopPropagation()}>

        <div className="sidebar-brand">
          <h1 className="sidebar-title">{naming.appName}</h1>
          {naming.appSubtitle && (
            <p className="sidebar-subtitle">{naming.appSubtitle}</p>
          )}
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' active' : ''}${to.startsWith('/dev') ? ' sidebar-link--dev' : ''}`
              }
            >
              <Icon className="sidebar-icon" size={17} strokeWidth={1.75} />
              <span className="sidebar-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-version-row">
          <span className="sidebar-version">v0.1.0</span>
        </div>
      </div>
    </div>
  );
}

export default MobileMenu;
