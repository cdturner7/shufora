import { useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppearanceProvider } from './context/AppearanceContext';
import { DevAccessProvider } from './context/DevAccessContext';
import { ToastProvider } from './context/ToastContext';
import { setLoggerUid, logger } from './utils/logger';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Settings from './pages/Settings';
import UserProfile from './pages/UserProfile';

function LoggerSync() {
  const { user, loading } = useAuth();
  const prevUid = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (loading) return;
    setLoggerUid(user?.uid ?? null);
    if (prevUid.current === undefined) {
      prevUid.current = user?.uid ?? null;
      return;
    }
    if (user && prevUid.current !== user.uid) {
      logger.info('auth', `Signed in as ${user.email}`, { uid: user.uid });
    } else if (!user && prevUid.current !== null) {
      logger.info('auth', 'Signed out');
    }
    prevUid.current = user?.uid ?? null;
  }, [loading, user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function App() {
  return (
    <AuthProvider>
      <LoggerSync />
      <DevAccessProvider>
        <AppearanceProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="profile" element={<UserProfile />} />
                </Route>
              </Route>
            </Routes>
          </ToastProvider>
        </AppearanceProvider>
      </DevAccessProvider>
    </AuthProvider>
  );
}

export default App;
