import {
  createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode,
} from 'react';
import {
  buildAuthUrl, exchangeCode, doRefreshToken,
  saveSpotifyTokens, loadSpotifyTokens, clearSpotifyTokens, isTokenExpired,
  getSpotifyUser, getSpotifyPlaylists, getPlaylistTracks, getLikedTracks, searchSpotify,
  playOnDevice, transferPlayback,
  type SpotifyTokens, type SpotifyUser, type SpotifyPlaylist, type SpotifyTrack, type SpotifySDKPlayer, type SpotifySDKState,
} from '../lib/spotify';
import {
  saveSpotifyTokensForUser, loadSpotifyTokensForUser, clearSpotifyTokensForUser,
} from '../lib/connectionStorage';
import { useAuth } from './AuthContext';

interface SpotifyContextValue {
  isConnected: boolean;
  isReady: boolean;
  isLoading: boolean;
  deviceId: string | null;
  user: SpotifyUser | null;
  playerState: SpotifySDKState | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  handleCallback: (code: string) => Promise<void>;
  getToken: () => Promise<string | null>;
  // Playback
  play: (uris: string[], offsetIndex?: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  setVolume: (v: number) => Promise<void>;
  // Library
  getPlaylists: () => Promise<SpotifyPlaylist[]>;
  getPlaylistTracks: (id: string) => Promise<SpotifyTrack[]>;
  getLikedTracks: () => Promise<SpotifyTrack[]>;
  search: (q: string) => Promise<SpotifyTrack[]>;
}

const SpotifyContext = createContext<SpotifyContextValue | null>(null);

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';

export function SpotifyProvider({ children }: { children: ReactNode }) {
  const { user: authUser, loading: authLoading } = useAuth();
  const authUidRef = useRef<string | null>(null);
  authUidRef.current = authUser?.uid ?? null;

  const [tokens, setTokens] = useState<SpotifyTokens | null>(() => loadSpotifyTokens());
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  // True while we're checking Firestore for a persisted connection (no localStorage tokens yet)
  const [isLoading, setIsLoading] = useState(() => loadSpotifyTokens() === null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<SpotifySDKState | null>(null);
  const playerRef = useRef<SpotifySDKPlayer | null>(null);
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  // Keeps the last known device ID so play() never silently no-ops due to a
  // transient not_ready event clearing the deviceId state.
  const deviceIdRef = useRef<string | null>(null);

  // Load from Firestore when user logs in with no localStorage tokens (new device / cleared storage)
  useEffect(() => {
    if (authLoading) return; // wait for Firebase Auth to resolve before giving up
    if (!authUser?.uid) {
      setIsLoading(false);
      return;
    }
    if (tokensRef.current) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    loadSpotifyTokensForUser(authUser.uid)
      .then(firestoreTokens => {
        if (firestoreTokens && !tokensRef.current) {
          saveSpotifyTokens(firestoreTokens);
          setTokens(firestoreTokens);
          tokensRef.current = firestoreTokens;
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [authUser?.uid, authLoading]);

  // Save tokens to Firestore whenever they change and auth is available.
  // This is the reliable fallback for the OAuth callback race condition where
  // authUidRef.current may be null at handleCallback time (Firebase Auth is async).
  useEffect(() => {
    if (!tokens || !authUser?.uid) return;
    saveSpotifyTokensForUser(authUser.uid, tokens).catch(() => {});
  }, [tokens, authUser?.uid]);

  const isConnected = tokens !== null;

  // ── Token management ────────────────────────────────────────────────────────

  const getToken = useCallback(async (): Promise<string | null> => {
    let t = tokensRef.current;
    if (!t) return null;
    if (isTokenExpired(t)) {
      try {
        t = await doRefreshToken(t.refreshToken, CLIENT_ID);
        saveSpotifyTokens(t);
        setTokens(t);
        tokensRef.current = t;
        // Firestore save is handled by the [tokens, authUser?.uid] effect
      } catch {
        clearSpotifyTokens();
        setTokens(null);
        if (authUidRef.current) {
          clearSpotifyTokensForUser(authUidRef.current).catch(() => {});
        }
        return null;
      }
    }
    return t.accessToken;
  }, []);

  // ── OAuth ────────────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (!CLIENT_ID) { alert('VITE_SPOTIFY_CLIENT_ID is not configured.'); return; }
    const url = await buildAuthUrl(CLIENT_ID);
    window.location.href = url;
  }, []);

  const handleCallback = useCallback(async (code: string) => {
    const t = await exchangeCode(code, CLIENT_ID);
    saveSpotifyTokens(t);
    setTokens(t);
    // Firestore save is handled by the [tokens, authUser?.uid] effect,
    // which fires once auth resolves — even if that's after this callback returns.
  }, []);

  const disconnect = useCallback(() => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    clearSpotifyTokens();
    setTokens(null);
    setUser(null);
    setIsReady(false);
    setDeviceId(null);
    setPlayerState(null);
    if (authUidRef.current) {
      clearSpotifyTokensForUser(authUidRef.current).catch(() => {});
    }
  }, []);

  // ── Fetch user profile ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!tokens) return;
    getToken().then(token => {
      if (token) getSpotifyUser(token).then(setUser).catch(() => {});
    });
  }, [!!tokens]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load Web Playback SDK ────────────────────────────────────────────────────

  useEffect(() => {
    if (!tokens || !CLIENT_ID) return;

    function initPlayer() {
      if (!window.Spotify) return;
      const player = new window.Spotify.Player({
        name: 'Shufora',
        getOAuthToken: async (cb) => {
          const token = await getToken();
          if (token) cb(token);
        },
        volume: 0.5,
      });

      player.addListener('ready', ({ device_id }) => {
        deviceIdRef.current = device_id;
        setDeviceId(device_id);
        setIsReady(true);
        transferPlayback(tokensRef.current!.accessToken, device_id).catch(() => {});
      });

      player.addListener('not_ready', () => {
        setIsReady(false);
        setDeviceId(null);
        deviceIdRef.current = null;
        // Spotify SDK docs recommend calling connect() when not_ready fires
        setTimeout(() => playerRef.current?.connect(), 3000);
      });

      player.addListener('player_state_changed', (state) => {
        setPlayerState(state);
      });

      player.connect();
      playerRef.current = player;
    }

    if (window.Spotify) {
      initPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
      if (!document.getElementById('spotify-sdk')) {
        const script = document.createElement('script');
        script.id = 'spotify-sdk';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        document.body.appendChild(script);
      }
    }

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [!!tokens]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Playback controls ────────────────────────────────────────────────────────

  const play = useCallback(async (uris: string[], offsetIndex = 0) => {
    const token = await getToken();
    const did = deviceIdRef.current;
    if (!token || !did) return;
    await playOnDevice(token, did, uris, offsetIndex);
  }, [getToken]);

  const pause = useCallback(async () => {
    await playerRef.current?.pause();
  }, []);

  const resume = useCallback(async () => {
    await playerRef.current?.resume();
  }, []);

  const seek = useCallback(async (ms: number) => {
    await playerRef.current?.seek(ms);
  }, []);

  const next = useCallback(async () => {
    await playerRef.current?.nextTrack();
  }, []);

  const previous = useCallback(async () => {
    await playerRef.current?.previousTrack();
  }, []);

  const setVolume = useCallback(async (v: number) => {
    await playerRef.current?.setVolume(v);
  }, []);

  // ── Library ──────────────────────────────────────────────────────────────────

  const getPlaylists = useCallback(async () => {
    const token = await getToken();
    if (!token) return [];
    return getSpotifyPlaylists(token);
  }, [getToken]);

  const getPlaylistTracksFn = useCallback(async (id: string) => {
    const token = await getToken();
    if (!token) return [];
    return getPlaylistTracks(id, token);
  }, [getToken]);

  const getLikedTracksFn = useCallback(async () => {
    const token = await getToken();
    if (!token) return [];
    return getLikedTracks(token);
  }, [getToken]);

  const search = useCallback(async (q: string) => {
    const token = await getToken();
    if (!token) return [];
    return searchSpotify(q, token);
  }, [getToken]);

  return (
    <SpotifyContext.Provider value={{
      isConnected, isReady, isLoading, deviceId, user, playerState,
      connect, disconnect, handleCallback, getToken,
      play, pause, resume, seek, next, previous, setVolume,
      getPlaylists, getPlaylistTracks: getPlaylistTracksFn,
      getLikedTracks: getLikedTracksFn, search,
    }}>
      {children}
    </SpotifyContext.Provider>
  );
}

export function useSpotify(): SpotifyContextValue {
  const ctx = useContext(SpotifyContext);
  if (!ctx) throw new Error('useSpotify must be used within SpotifyProvider');
  return ctx;
}
