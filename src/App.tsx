import { useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppearanceProvider } from './context/AppearanceContext';
import { DevAccessProvider } from './context/DevAccessContext';
import { ToastProvider } from './context/ToastContext';
import { SpotifyProvider } from './context/SpotifyContext';
import { SoundCloudProvider } from './context/SoundCloudContext';
import { PlayerProvider } from './context/PlayerContext';
import { OrasProvider } from './context/OrasContext';
import { setLoggerUid, logger } from './utils/logger';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Library from './pages/Library';
import AuthCallback from './pages/AuthCallback';
import NowPlaying from './pages/NowPlaying';
import UserProfile from './pages/UserProfile';
import Search from './pages/Search';
import PlaylistDetail from './pages/PlaylistDetail';

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
            <SpotifyProvider>
              <SoundCloudProvider>
                <PlayerProvider>
                  <OrasProvider>
                  <Routes>
                    <Route path="/login" element={<Login />} />

                    <Route element={<ProtectedRoute />}>
                      <Route path="now-playing"             element={<NowPlaying />} />
                      <Route path="auth/spotify/callback"   element={<AuthCallback />} />
                      <Route path="auth/soundcloud/callback" element={<AuthCallback />} />

                      <Route element={<Layout />}>
                        <Route index element={<Home />} />
                        <Route path="library"  element={<Library />} />
                        <Route path="search"                      element={<Search />} />
                        <Route path="playlist/:service/:id"       element={<PlaylistDetail />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="profile"  element={<UserProfile />} />
                      </Route>
                    </Route>
                  </Routes>
                  </OrasProvider>
                </PlayerProvider>
              </SoundCloudProvider>
            </SpotifyProvider>
          </ToastProvider>
        </AppearanceProvider>
      </DevAccessProvider>
    </AuthProvider>
  );
}

export default App;
