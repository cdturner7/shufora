import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { SpotifyTokens } from './spotify';
import type { SoundCloudTokens } from './soundcloud';

function connectionDoc(uid: string, service: 'spotify' | 'soundcloud') {
  return doc(db!, 'users', uid, 'connections', service);
}

export async function saveSpotifyTokensForUser(uid: string, tokens: SpotifyTokens): Promise<void> {
  if (!db) return;
  await setDoc(connectionDoc(uid, 'spotify'), {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
  });
}

export async function loadSpotifyTokensForUser(uid: string): Promise<SpotifyTokens | null> {
  if (!db) return null;
  const snap = await getDoc(connectionDoc(uid, 'spotify'));
  return snap.exists() ? (snap.data() as SpotifyTokens) : null;
}

export async function clearSpotifyTokensForUser(uid: string): Promise<void> {
  if (!db) return;
  await deleteDoc(connectionDoc(uid, 'spotify'));
}

export async function saveSCTokensForUser(uid: string, tokens: SoundCloudTokens): Promise<void> {
  if (!db) return;
  await setDoc(connectionDoc(uid, 'soundcloud'), {
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
  });
}

export async function loadSCTokensForUser(uid: string): Promise<SoundCloudTokens | null> {
  if (!db) return null;
  const snap = await getDoc(connectionDoc(uid, 'soundcloud'));
  return snap.exists() ? (snap.data() as SoundCloudTokens) : null;
}

export async function clearSCTokensForUser(uid: string): Promise<void> {
  if (!db) return;
  await deleteDoc(connectionDoc(uid, 'soundcloud'));
}
