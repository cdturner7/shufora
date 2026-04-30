import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Bell, Menu, Settings as SettingsIcon } from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useSwUpdate } from '../hooks/useSwUpdate';
import { useAppearance } from '../context/AppearanceContext';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import MobileMenu from './MobileMenu';
import UserMenu from './UserMenu';
import './Layout.css';

function TopbarUserChip() {
  const navigate = useNavigate();
  const { user, logOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const u = user;
  const displayName = u.displayName || u.email?.split('@')[0] || 'Account';

  function getInitials() {
    if (u.displayName) {
      return u.displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
    }
    return (u.email?.[0] ?? '?').toUpperCase();
  }

  async function handleLogOut() {
    setOpen(false);
    await logOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="topbar-user-wrap">
      <button
        className={`topbar-user-chip${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Account"
      >
        {u.photoURL ? (
          <img className="topbar-avatar" src={u.photoURL} alt={displayName} referrerPolicy="no-referrer" />
        ) : (
          <div className="topbar-avatar topbar-avatar--initials">{getInitials()}</div>
        )}
        <div className="topbar-user-info">
          <span className="topbar-user-name">{displayName}</span>
        </div>
        <svg className="topbar-user-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="topbar-user-dropdown">
          <div className="topbar-user-dropdown-header">
            <span className="topbar-user-dropdown-name">{displayName}</span>
            {u.email && <span className="topbar-user-dropdown-email">{u.email}</span>}
          </div>
          <div className="topbar-user-dropdown-divider" />
          <button
            className="topbar-user-dropdown-item"
            onClick={() => { setOpen(false); navigate('/profile'); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            Profile
          </button>
          <div className="topbar-user-dropdown-divider" />
          <button className="topbar-user-dropdown-item topbar-user-dropdown-item--danger" onClick={handleLogOut}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

function Layout() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { naming } = useAppearance();
  const online = useOnlineStatus();
  const { updateAvailable, applyUpdate } = useSwUpdate();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const banners = (
    <>
      {!online && (
        <div className="app-banner app-banner--offline">
          <span>You're offline — changes will sync when reconnected.</span>
        </div>
      )}
      {updateAvailable && (
        <div className="app-banner app-banner--update">
          <span>A new version of {naming.appName} is available.</span>
          <button className="app-banner-action" onClick={applyUpdate}>Reload</button>
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <div className="app-layout mobile">
        <header className="app-header">
          <button
            className="app-header-menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            type="button"
          >
            <Menu size={20} strokeWidth={1.75} />
          </button>
          <div style={{ flex: 1 }} />
          <UserMenu user={user} compact />
        </header>
        {banners}
        <main className="app-content">
          <Outlet />
        </main>
        <BottomNav />
        <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      </div>
    );
  }

  return (
    <div className="app-layout desktop">
      <Sidebar />
      <div className="app-main" id="app-main">
        <header className="app-topbar">
          <div className="topbar-left" />
          <div className="topbar-right">
            <button className="topbar-icon-btn" title="Notifications">
              <Bell size={17} strokeWidth={1.75} />
            </button>
            <button
              className="topbar-icon-btn"
              onClick={() => navigate('/settings')}
              title="Settings"
            >
              <SettingsIcon size={17} strokeWidth={1.75} />
            </button>
            <div className="topbar-divider" />
            <TopbarUserChip />
          </div>
        </header>
        {banners}
        <main className="app-content">
          <Outlet />
        </main>
        <div id="modal-root" />
      </div>
    </div>
  );
}

export default Layout;
