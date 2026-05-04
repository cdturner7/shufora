import {
  createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode,
} from 'react';
import {
  buildSCAuthUrl, parseSCCallback,
  saveSCTokens, loadSCTokens, clearSCTokens,
  getSCUser, getSCPlaylists, getSCLikes, searchSC, getSCStreamUrl, getSCartwork,
  type SoundCloudTokens, type SoundCloudUser, type SoundCloudPlaylist, type SoundCloudTrack,
} from '../lib/soundcloud';
import {
  saveSCTokensForUser, loadSCTokensForUser, clearSCTokensForUser,
} from '../lib/connectionStorage';
import { useAuth } from './AuthContext';

interface SoundCloudContextValue {
  isConnected: boolean;
  user: SoundCloudUser | null;
  audio: HTMLAudioElement | null;
  connect: () => void;
  disconnect: () => void;
  handleCallback: (hash: string) => void;
  getToken: () => string | null;
  // Library
  getPlaylists: () => Promise<SoundCloudPlaylist[]>;
  getLikes: () => Promise<SoundCloudTrack[]>;
  search: (q: string) => Promise<SoundCloudTrack[]>;
  getStreamUrl: (track: SoundCloudTrack) => string;
  getArtwork: (track: SoundCloudTrack) => string;
}

const SoundCloudContext = createContext<SoundCloudContextValue | null>(null);

const CLIENT_ID = import.meta.env.VITE_SOUNDCLOUD_CLIENT_ID ?? '';

export function SoundCloudProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const authUidRef = useRef<string | null>(null);
  authUidRef.current = authUser?.uid ?? null;

  const [tokens, setTokens] = useState<SoundCloudTokens | null>(() => loadSCTokens());
  const [user, setUser] = useState<SoundCloudUser | null>(null);
  // Single shared Audio element for SoundCloud playback
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  audioRef.current.crossOrigin = 'anonymous';

  const isConnected = tokens !== null;

  // Sync tokens from Firestore when user logs in on a new device (no localStorage)
  useEffect(() => {
    if (!authUser?.uid || tokens) return;
    loadSCTokensForUser(authUser.uid).then(firestoreTokens => {
      if (firestoreTokens && !tokens) {
        saveSCTokens(firestoreTokens);
        setTokens(firestoreTokens);
        getSCUser(firestoreTokens.accessToken).then(setUser).catch(() => {});
      }
    }).catch(() => {});
  }, [authUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const getToken = useCallback((): string | null => {
    return tokens?.accessToken ?? null;
  }, [tokens]);

  // ── OAuth ────────────────────────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (!CLIENT_ID) { alert('VITE_SOUNDCLOUD_CLIENT_ID is not configured.'); return; }
    window.location.href = buildSCAuthUrl(CLIENT_ID);
  }, []);

  const handleCallback = useCallback((hash: string) => {
    const t = parseSCCallback(hash);
    if (!t) return;
    saveSCTokens(t);
    setTokens(t);
    getSCUser(t.accessToken).then(setUser).catch(() => {});
    if (authUidRef.current) {
      saveSCTokensForUser(authUidRef.current, t).catch(() => {});
    }
  }, []);

  const disconnect = useCallback(() => {
    audioRef.current.pause();
    audioRef.current.src = '';
    clearSCTokens();
    setTokens(null);
    setUser(null);
    if (authUidRef.current) {
      clearSCTokensForUser(authUidRef.current).catch(() => {});
    }
  }, []);

  // ── Library ──────────────────────────────────────────────────────────────────

  const getPlaylists = useCallback(async (): Promise<SoundCloudPlaylist[]> => {
    const token = tokens?.accessToken;
    if (!token) return [];
    return getSCPlaylists(token);
  }, [tokens]);

  const getLikes = useCallback(async (): Promise<SoundCloudTrack[]> => {
    const token = tokens?.accessToken;
    if (!token) return [];
    return getSCLikes(token);
  }, [tokens]);

  const search = useCallback(async (q: string): Promise<SoundCloudTrack[]> => {
    const token = tokens?.accessToken;
    if (!token) return [];
    return searchSC(q, token);
  }, [tokens]);

  const getStreamUrl = useCallback((track: SoundCloudTrack): string => {
    const token = tokens?.accessToken;
    if (token) return `${track.stream_url}?oauth_token=${token}`;
    return getSCStreamUrl(track, CLIENT_ID);
  }, [tokens]);

  const getArtwork = useCallback((track: SoundCloudTrack): string => {
    return getSCartwork(track);
  }, []);

  // Fetch user on initial load
  useState(() => {
    if (tokens) {
      getSCUser(tokens.accessToken).then(setUser).catch(() => {});
    }
  });

  return (
    <SoundCloudContext.Provider value={{
      isConnected, user, audio: audioRef.current,
      connect, disconnect, handleCallback, getToken,
      getPlaylists, getLikes, search, getStreamUrl, getArtwork,
    }}>
      {children}
    </SoundCloudContext.Provider>
  );
}

export function useSoundCloud(): SoundCloudContextValue {
  const ctx = useContext(SoundCloudContext);
  if (!ctx) throw new Error('useSoundCloud must be used within SoundCloudProvider');
  return ctx;
}
