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
  playlists: SoundCloudPlaylist[];
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

  // Always start null — tokens are loaded after auth resolves so they're always for the right user
  const [tokens, setTokens] = useState<SoundCloudTokens | null>(null);
  const [user, setUser] = useState<SoundCloudUser | null>(null);
  const [playlists, setPlaylists] = useState<SoundCloudPlaylist[]>([]);
  const playlistsPromiseRef = useRef<Promise<SoundCloudPlaylist[]> | null>(null);
  // Single shared Audio element for SoundCloud playback
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  audioRef.current.crossOrigin = 'anonymous';
  // Track which user's tokens are loaded to detect user switches
  const loadedForUidRef = useRef<string | null>(null);

  const isConnected = tokens !== null;

  // Load tokens after auth resolves; clear when user logs out or switches accounts
  useEffect(() => {
    if (!authUser?.uid) {
      // Logged out — wipe token cache so the next user starts clean
      clearSCTokens();
      setTokens(null);
      setUser(null);
      playlistsPromiseRef.current = null;
      loadedForUidRef.current = null;
      return;
    }

    const uid = authUser.uid;

    // A different user logged in — discard the previous user's cached tokens
    if (loadedForUidRef.current !== null && loadedForUidRef.current !== uid) {
      clearSCTokens();
      setTokens(null);
      setUser(null);
      playlistsPromiseRef.current = null;
    }
    loadedForUidRef.current = uid;

    if (tokens) return;

    // Try localStorage cache first (instant, no network)
    const cached = loadSCTokens();
    if (cached) {
      setTokens(cached);
      getSCUser(cached.accessToken).then(setUser).catch(() => {});
      return;
    }

    // Fall through to Firestore (cross-device / cleared localStorage)
    loadSCTokensForUser(uid).then(firestoreTokens => {
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
    setPlaylists([]);
    playlistsPromiseRef.current = null;
    if (authUidRef.current) {
      clearSCTokensForUser(authUidRef.current).catch(() => {});
    }
  }, []);

  // ── Library ──────────────────────────────────────────────────────────────────

  const getPlaylists = useCallback(async (): Promise<SoundCloudPlaylist[]> => {
    if (!playlistsPromiseRef.current) {
      const token = tokens?.accessToken;
      if (!token) return [];
      playlistsPromiseRef.current = getSCPlaylists(token)
        .then(result => { setPlaylists(result); return result; })
        .catch(() => { playlistsPromiseRef.current = null; return [] as SoundCloudPlaylist[]; });
    }
    return playlistsPromiseRef.current;
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

  return (
    <SoundCloudContext.Provider value={{
      isConnected, user, audio: audioRef.current, playlists,
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
