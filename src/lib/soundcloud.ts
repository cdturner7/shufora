// ── Types ─────────────────────────────────────────────────────────────────────

export interface SoundCloudTokens {
  accessToken: string;
  expiresAt: number; // unix ms — implicit tokens last ~1 hour
}

export interface SoundCloudUser {
  id: number;
  username: string;
  avatar_url: string;
}

export interface SoundCloudTrack {
  id: number;
  title: string;
  duration: number; // ms
  user: { username: string; avatar_url: string };
  artwork_url: string | null;
  stream_url: string;
  streamable: boolean;
  permalink_url: string;
}

export interface SoundCloudPlaylist {
  id: number;
  title: string;
  description: string | null;
  artwork_url: string | null;
  track_count: number;
  tracks: SoundCloudTrack[];
  permalink_url: string;
}

// ── OAuth (implicit grant) ────────────────────────────────────────────────────

export function getSoundCloudRedirectUri(): string {
  return `${window.location.origin}/auth/soundcloud/callback`;
}

export function buildSCAuthUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getSoundCloudRedirectUri(),
    response_type: 'token',
    scope: 'non-expiring',
    display: 'popup',
  });
  return `https://api.soundcloud.com/connect?${params}`;
}

// Parse token from hash fragment after implicit redirect
export function parseSCCallback(hash: string): SoundCloudTokens | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') ?? '0', 10);
  if (!accessToken) return null;
  return {
    accessToken,
    expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 : Date.now() + 365 * 24 * 3600 * 1000,
  };
}

// ── Token storage ─────────────────────────────────────────────────────────────

const LS_KEY = 'shufora:soundcloud:tokens';

export function saveSCTokens(t: SoundCloudTokens) {
  localStorage.setItem(LS_KEY, JSON.stringify(t));
}

export function loadSCTokens(): SoundCloudTokens | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as SoundCloudTokens) : null;
  } catch { return null; }
}

export function clearSCTokens() {
  localStorage.removeItem(LS_KEY);
}

// ── API fetch wrapper ─────────────────────────────────────────────────────────

const API = 'https://api.soundcloud.com';

export async function scFetch<T>(path: string, token: string): Promise<T> {
  const separator = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API}${path}${separator}oauth_token=${token}`, {
    headers: { Accept: 'application/json; charset=utf-8' },
  });
  if (!res.ok) throw new Error(`SoundCloud API ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Common API calls ──────────────────────────────────────────────────────────

export async function getSCUser(token: string): Promise<SoundCloudUser> {
  return scFetch<SoundCloudUser>('/me', token);
}

export async function getSCPlaylists(token: string): Promise<SoundCloudPlaylist[]> {
  return scFetch<SoundCloudPlaylist[]>('/me/playlists?limit=50&linked_partitioning=1', token);
}

export async function getSCLikes(token: string): Promise<SoundCloudTrack[]> {
  const data = await scFetch<{ collection: SoundCloudTrack[] }>('/me/likes/tracks?limit=50', token);
  return data.collection ?? [];
}

export async function searchSC(query: string, token: string): Promise<SoundCloudTrack[]> {
  const params = new URLSearchParams({ q: query, limit: '20' });
  const data = await scFetch<{ collection: SoundCloudTrack[] }>(`/tracks?${params}`, token);
  return data.collection ?? [];
}

export function getSCStreamUrl(track: SoundCloudTrack, clientId: string): string {
  // Prefer stream_url with client_id; some tracks need oauth_token (added at fetch time)
  return `${track.stream_url}?client_id=${clientId}`;
}

export function getSCartwork(track: SoundCloudTrack): string {
  return (track.artwork_url ?? track.user.avatar_url ?? '').replace('-large', '-t300x300');
}
