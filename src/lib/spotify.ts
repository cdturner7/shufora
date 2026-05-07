// ── Types ────────────────────────────────────────────────────────────────────

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

export interface SpotifyUser {
  id: string;
  displayName: string;
  email: string;
  imageUrl: string;
}

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  tracks: { total: number };
  uri: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string }[];
  total_tracks: number;
  uri: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
  followers: { total: number };
}

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function base64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function generateCodeVerifier(): string {
  return base64url(randomBytes(48));
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(digest);
}

// ── OAuth URLs ────────────────────────────────────────────────────────────────

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-follow-read',
].join(' ');

export function getSpotifyRedirectUri(): string {
  return `${window.location.origin}/auth/spotify/callback`;
}

export async function buildAuthUrl(clientId: string): Promise<string> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  sessionStorage.setItem('shufora:spotify:verifier', verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getSpotifyRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

// ── Token exchange & refresh ──────────────────────────────────────────────────

export async function exchangeCode(code: string, clientId: string): Promise<SpotifyTokens> {
  const verifier = sessionStorage.getItem('shufora:spotify:verifier');
  if (!verifier) throw new Error('Missing PKCE verifier');
  sessionStorage.removeItem('shufora:spotify:verifier');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getSpotifyRedirectUri(),
      client_id: clientId,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const json = await res.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

export async function doRefreshToken(refreshToken: string, clientId: string): Promise<SpotifyTokens> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const json = await res.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

// ── Token storage ─────────────────────────────────────────────────────────────

const LS_KEY = 'shufora:spotify:tokens';

export function saveSpotifyTokens(t: SpotifyTokens) {
  localStorage.setItem(LS_KEY, JSON.stringify(t));
}

export function loadSpotifyTokens(): SpotifyTokens | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as SpotifyTokens) : null;
  } catch { return null; }
}

export function clearSpotifyTokens() {
  localStorage.removeItem(LS_KEY);
}

export function isTokenExpired(tokens: SpotifyTokens): boolean {
  return Date.now() > tokens.expiresAt - 60_000;
}

// ── API fetch wrapper ─────────────────────────────────────────────────────────

const API = 'https://api.spotify.com/v1';

export async function spotifyFetch<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Spotify API ${path}: ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Common API calls ──────────────────────────────────────────────────────────

export async function getSpotifyUser(token: string): Promise<SpotifyUser> {
  const data = await spotifyFetch<{ id: string; display_name: string; email: string; images: { url: string }[] }>('/me', token);
  return {
    id: data.id,
    displayName: data.display_name,
    email: data.email,
    imageUrl: data.images?.[0]?.url ?? '',
  };
}

export async function getSpotifyPlaylists(token: string): Promise<SpotifyPlaylist[]> {
  const data = await spotifyFetch<{ items: SpotifyPlaylist[] }>('/me/playlists?limit=50', token);
  return data.items;
}

export async function getPlaylistTracks(playlistId: string, token: string): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ items: { track: SpotifyTrack }[] }>(
    `/playlists/${playlistId}/tracks?limit=100`,
    token,
  );
  return data.items.map(i => i.track).filter(Boolean);
}

export async function getLikedTracks(token: string): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ items: { track: SpotifyTrack }[] }>('/me/tracks?limit=50', token);
  return data.items.map(i => i.track);
}

export async function searchSpotify(query: string, token: string): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ q: query, type: 'track', limit: '20' });
  const data = await spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(`/search?${params}`, token);
  return data.tracks.items;
}

export async function getRecentlyPlayed(token: string): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ items: { track: SpotifyTrack }[] }>('/me/player/recently-played?limit=20', token);
  return data.items.map(i => i.track);
}

export async function getSavedAlbums(token: string): Promise<SpotifyAlbum[]> {
  const data = await spotifyFetch<{ items: { album: SpotifyAlbum }[] }>('/me/albums?limit=20', token);
  return data.items.map(i => i.album);
}

export async function getFollowedArtists(token: string): Promise<SpotifyArtist[]> {
  const data = await spotifyFetch<{ artists: { items: SpotifyArtist[] } }>('/me/following?type=artist&limit=20', token);
  return data.artists.items;
}

export async function getAlbumTracks(albumId: string, album: SpotifyAlbum, token: string): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<{ items: Array<{ id: string; uri: string; name: string; duration_ms: number; artists: { name: string }[] }> }>(
    `/albums/${albumId}/tracks?limit=50`,
    token,
  );
  const albumRef = { name: album.name, images: album.images };
  return data.items.map(t => ({ ...t, album: albumRef }));
}

export async function playOnDevice(token: string, deviceId: string, uris: string[], offsetIndex = 0): Promise<void> {
  await spotifyFetch(`/me/player/play?device_id=${deviceId}`, token, {
    method: 'PUT',
    body: JSON.stringify({ uris, offset: { position: offsetIndex } }),
  });
}

export async function transferPlayback(token: string, deviceId: string): Promise<void> {
  await spotifyFetch('/me/player', token, {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });
}

// ── Window type declaration for the Spotify SDK ───────────────────────────────

export interface SpotifySDKPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener(event: 'ready', cb: (data: { device_id: string }) => void): boolean;
  addListener(event: 'not_ready', cb: (data: { device_id: string }) => void): boolean;
  addListener(event: 'player_state_changed', cb: (state: SpotifySDKState | null) => void): boolean;
  addListener(event: 'initialization_error', cb: (data: { message: string }) => void): boolean;
  addListener(event: 'authentication_error', cb: (data: { message: string }) => void): boolean;
  addListener(event: 'account_error', cb: (data: { message: string }) => void): boolean;
  removeListener(event: string): boolean;
  getCurrentState: () => Promise<SpotifySDKState | null>;
  setVolume: (v: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  previousTrack: () => Promise<void>;
  nextTrack: () => Promise<void>;
}

export interface SpotifySDKState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: SpotifyTrack & { album: { name: string; images: { url: string }[] } };
    next_tracks: SpotifyTrack[];
    previous_tracks: SpotifyTrack[];
  };
}

declare global {
  interface Window {
    Spotify: { Player: new (opts: {
      name: string;
      getOAuthToken: (cb: (token: string) => void) => void;
      volume?: number;
    }) => SpotifySDKPlayer };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}
