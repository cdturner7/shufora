import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Library, Terminal, Palette, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppearance } from '../context/AppearanceContext';
import { useDevAccess } from '../context/DevAccessContext';
import './Sidebar.css';

const STORAGE_KEY = 'shufora:sidebar:collapsed';

function Sidebar() {
  const { naming } = useAppearance();
  const { devMode } = useDevAccess();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  const navItems = [
    { to: '/',        label: 'Board',     icon: LayoutDashboard, end: true },
    { to: '/library', label: 'Library',   icon: Library },
    ...(devMode ? [
      { to: '/admin/style-guide', label: 'Style Guide', icon: Palette },
      { to: '/dev/logs',          label: 'Dev Logs',    icon: Terminal },
    ] : []),
  ];

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar-brand">
        <h1 className="sidebar-title">{naming.appName}</h1>
        {!collapsed && naming.appSubtitle && (
          <p className="sidebar-subtitle">{naming.appSubtitle}</p>
        )}
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}${(to.startsWith('/dev') || to.startsWith('/admin')) ? ' sidebar-link--dev' : ''}`
            }
          >
            <Icon className="sidebar-icon" size={17} strokeWidth={1.75} />
            <span className="sidebar-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && <span className="sidebar-version">v0.1.0</span>}
        <button className="sidebar-collapse-btn" onClick={toggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} type="button">
          {collapsed ? <ChevronRight size={15} strokeWidth={2} /> : <ChevronLeft size={15} strokeWidth={2} />}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
