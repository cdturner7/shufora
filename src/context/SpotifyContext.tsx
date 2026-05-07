import {
  createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode,
} from 'react';
import {
  buildAuthUrl, exchangeCode, doRefreshToken,
  saveSpotifyTokens, loadSpotifyTokens, clearSpotifyTokens, isTokenExpired,
  getSpotifyUser, getSpotifyPlaylists, getPlaylistTracks, getLikedTracks, searchSpotify,
  getRecentlyPlayed, getSavedAlbums, getFollowedArtists, getAlbumTracks,
  playOnDevice, transferPlayback,
  type SpotifyTokens, type SpotifyUser, type SpotifyPlaylist, type SpotifyTrack,
  type SpotifyAlbum, type SpotifyArtist, type SpotifySDKPlayer, type SpotifySDKState,
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
  playlists: SpotifyPlaylist[];
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
  getRecentTracks: () => Promise<SpotifyTrack[]>;
  getSavedAlbums: () => Promise<SpotifyAlbum[]>;
  getFollowedArtists: () => Promise<SpotifyArtist[]>;
  getAlbumTracks: (albumId: string, album: SpotifyAlbum) => Promise<SpotifyTrack[]>;
}

const SpotifyContext = createContext<SpotifyContextValue | null>(null);

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '';

export function SpotifyProvider({ children }: { children: ReactNode }) {
  const { user: authUser, loading: authLoading } = useAuth();
  const authUidRef = useRef<string | null>(null);
  authUidRef.current = authUser?.uid ?? null;

  // Always start null — tokens are loaded after auth resolves so they're always for the right user
  const [tokens, setTokens] = useState<SpotifyTokens | null>(null);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<SpotifySDKState | null>(null);
  const playerRef = useRef<SpotifySDKPlayer | null>(null);
  const playlistsPromiseRef = useRef<Promise<SpotifyPlaylist[]> | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  // Keeps the last known device ID so play() never silently no-ops due to a
  // transient not_ready event clearing the deviceId state.
  const deviceIdRef = useRef<string | null>(null);
  // Play request queued before the SDK device was ready — fired on next ready event.
  const pendingPlayRef = useRef<{ uris: string[]; offsetIndex: number } | null>(null);
  // Track which user's tokens are currently loaded to detect user switches
  const loadedForUidRef = useRef<string | null>(null);

  // Load tokens after auth resolves; clear when user logs out or switches accounts
  useEffect(() => {
    if (authLoading) return;

    if (!authUser?.uid) {
      // Logged out — wipe token cache so the next user starts clean
      clearSpotifyTokens();
      setTokens(null);
      tokensRef.current = null;
      playlistsPromiseRef.current = null;
      refreshPromiseRef.current = null;
      loadedForUidRef.current = null;
      setIsLoading(false);
      return;
    }

    const uid = authUser.uid;

    // A different user logged in — discard the previous user's cached tokens
    if (loadedForUidRef.current !== null && loadedForUidRef.current !== uid) {
      clearSpotifyTokens();
      setTokens(null);
      tokensRef.current = null;
      playlistsPromiseRef.current = null;
      refreshPromiseRef.current = null;
    }
    loadedForUidRef.current = uid;

    if (tokensRef.current) {
      setIsLoading(false);
      return;
    }

    // Try localStorage cache first (instant, no network)
    const cached = loadSpotifyTokens();
    if (cached) {
      setTokens(cached);
      tokensRef.current = cached;
      setIsLoading(false);
      return;
    }

    // Fall through to Firestore (cross-device / cleared localStorage)
    setIsLoading(true);
    loadSpotifyTokensForUser(uid)
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
    const t = tokensRef.current;
    if (!t) return null;
    if (!isTokenExpired(t)) return t.accessToken;

    // Deduplicate concurrent refresh calls — only one flight at a time.
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = doRefreshToken(t.refreshToken, CLIENT_ID)
        .then(fresh => {
          saveSpotifyTokens(fresh);
          setTokens(fresh);
          tokensRef.current = fresh;
          // Save the rotated refresh token to Firestore immediately — don't rely
          // solely on the [tokens] effect, which can be skipped when authUser
          // briefly re-initialises (causing Firestore to keep a stale, invalid RT).
          if (authUidRef.current) {
            saveSpotifyTokensForUser(authUidRef.current, fresh).catch(() => {});
          }
          return fresh.accessToken;
        })
        .catch((e: unknown) => {
          // Only disconnect for definitive 4xx rejections (revoked / rotated-away
          // refresh token). Transient failures (network down, 5xx) leave the
          // existing tokens in place so the next getToken() call can retry —
          // clearing on a transient error would permanently strand the user.
          const isPermanent = e instanceof Error && /Token refresh failed: 4\d\d/.test(e.message);
          if (isPermanent) {
            clearSpotifyTokens();
            setTokens(null);
            tokensRef.current = null;
            if (authUidRef.current) {
              clearSpotifyTokensForUser(authUidRef.current).catch(() => {});
            }
          }
          return null;
        })
        .finally(() => { refreshPromiseRef.current = null; });
    }

    return refreshPromiseRef.current;
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
    // Save directly when uid is already available; the [tokens, authUser?.uid]
    // effect covers the case where Firebase Auth hasn't resolved yet.
    if (authUidRef.current) {
      saveSpotifyTokensForUser(authUidRef.current, t).catch(() => {});
    }
  }, []);

  const disconnect = useCallback(() => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    pendingPlayRef.current = null;
    clearSpotifyTokens();
    setTokens(null);
    setUser(null);
    setPlaylists([]);
    playlistsPromiseRef.current = null;
    refreshPromiseRef.current = null;
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
        getToken().then(token => {
          if (!token) return;
          transferPlayback(token, device_id).catch(() => {});
          if (pendingPlayRef.current) {
            const pending = pendingPlayRef.current;
            pendingPlayRef.current = null;
            playOnDevice(token, device_id, pending.uris, pending.offsetIndex).catch(() => {});
          }
        });
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
    if (!token) return;
    const did = deviceIdRef.current;
    if (!did) {
      // SDK not ready yet — store and fire when device becomes available.
      pendingPlayRef.current = { uris, offsetIndex };
      return;
    }
    pendingPlayRef.current = null;
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
    if (!playlistsPromiseRef.current) {
      playlistsPromiseRef.current = getToken()
        .then(token => (token ? getSpotifyPlaylists(token) : []))
        .then(result => { setPlaylists(result); return result; })
        .catch(() => { playlistsPromiseRef.current = null; return [] as SpotifyPlaylist[]; });
    }
    return playlistsPromiseRef.current;
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

  const getRecentTracksFn = useCallback(async () => {
    const token = await getToken();
    if (!token) return [];
    return getRecentlyPlayed(token);
  }, [getToken]);

  const getSavedAlbumsFn = useCallback(async () => {
    const token = await getToken();
    if (!token) return [];
    return getSavedAlbums(token);
  }, [getToken]);

  const getFollowedArtistsFn = useCallback(async () => {
    const token = await getToken();
    if (!token) return [];
    return getFollowedArtists(token);
  }, [getToken]);

  const getAlbumTracksFn = useCallback(async (albumId: string, album: SpotifyAlbum) => {
    const token = await getToken();
    if (!token) return [];
    return getAlbumTracks(albumId, album, token);
  }, [getToken]);

  return (
    <SpotifyContext.Provider value={{
      isConnected, isReady, isLoading, deviceId, user, playerState, playlists,
      connect, disconnect, handleCallback, getToken,
      play, pause, resume, seek, next, previous, setVolume,
      getPlaylists, getPlaylistTracks: getPlaylistTracksFn,
      getLikedTracks: getLikedTracksFn, search,
      getRecentTracks: getRecentTracksFn,
      getSavedAlbums: getSavedAlbumsFn,
      getFollowedArtists: getFollowedArtistsFn,
      getAlbumTracks: getAlbumTracksFn,
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
