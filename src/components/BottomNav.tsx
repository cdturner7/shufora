import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings, User } from 'lucide-react';
import './BottomNav.css';

function BottomNav() {
  const navItems = [
    { to: '/',         label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/settings', label: 'Settings',  icon: Settings },
    { to: '/profile',  label: 'Profile',   icon: User },
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
