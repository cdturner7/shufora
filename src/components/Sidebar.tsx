import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings, User, Terminal } from 'lucide-react';
import { useAppearance } from '../context/AppearanceContext';
import { useDevAccess } from '../context/DevAccessContext';
import './Sidebar.css';

function Sidebar() {
  const { naming } = useAppearance();
  const { devMode } = useDevAccess();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/profile', label: 'Profile', icon: User },
    ...(devMode ? [
      { to: '/dev/logs', label: 'Dev Logs', icon: Terminal },
    ] : []),
  ];

  return (
    <aside className="sidebar">
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
    </aside>
  );
}

export default Sidebar;
