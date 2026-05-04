import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Library, Search, Settings } from 'lucide-react';
import './BottomNav.css';

function BottomNav() {
  const navItems = [
    { to: '/',         label: 'Board',    icon: LayoutDashboard, end: true },
    { to: '/library',  label: 'Library',  icon: Library },
    { to: '/search',   label: 'Search',   icon: Search },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `bottom-nav-link${isActive ? ' active' : ''}`
          }
        >
          <Icon className="bottom-nav-icon" size={22} strokeWidth={1.75} />
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default BottomNav;
