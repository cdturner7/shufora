import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import type { Track } from './PlayerContext';

export interface Ora {
  id: string;
  name: string;
  artwork?: string;
  service: 'spotify' | 'soundcloud';
  sourceId: string;
  trackCount: number;
  addedAt: number;
}

interface OrasContextValue {
  oras: Ora[];
  addOra: (ora: Omit<Ora, 'id' | 'addedAt'>) => void;
  removeOra: (id: string) => void;
  isOra: (service: Ora['service'], sourceId: string) => boolean;
  pinnedTracks: Track[];
  addPinnedTrack: (track: Track) => void;
  removePinnedTrack: (id: string, service: string) => void;
}

// Per-user localStorage key prevents data bleed between accounts on the same device
const lsKey = (uid: string) => `shufora:oras:${uid}`;
// Legacy key from before multi-user support — migrated on first login
const LEGACY_LS_KEY = 'shufora:oras';

const OrasContext = createContext<OrasContextValue | null>(null);

export function OrasProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [oras, setOras] = useState<Ora[]>([]);
  const [pinnedTracks, setPinnedTracks] = useState<Track[]>([]);

  const orasRef = useRef<Ora[]>(oras);
  orasRef.current = oras;
  const pinnedTracksRef = useRef<Track[]>(pinnedTracks);
  pinnedTracksRef.current = pinnedTracks;

  useEffect(() => {
    if (!user) {
      setOras([]);
      setPinnedTracks([]);
      return;
    }

    const uid = user.uid;
    const key = lsKey(uid);

    // Instant hydration from per-user localStorage cache
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0) setOras(parsed);
        } else if (parsed?.list) {
          setOras(parsed.list);
          setPinnedTracks(parsed.pinnedTracks ?? []);
        }
      }
    } catch { /* ignore */ }

    if (!db) return;

    const ref = doc(db, 'users', uid, 'data', 'oras');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const remote = (snap.data().list ?? []) as Ora[];
        const remotePinned = (snap.data().pinnedTracks ?? []) as Track[];
        setOras(remote);
        setPinnedTracks(remotePinned);
        localStorage.setItem(key, JSON.stringify({ list: remote, pinnedTracks: remotePinned }));
      } else {
        // First sign-in for this account — migrate any legacy oras up to Firestore
        const legacy = (() => {
          try { return JSON.parse(localStorage.getItem(LEGACY_LS_KEY) ?? '[]') as Ora[]; }
          catch { return [] as Ora[]; }
        })();
        setDoc(ref, { list: legacy, pinnedTracks: [] });
        localStorage.removeItem(LEGACY_LS_KEY);
      }
    });

    return () => { setOras([]); setPinnedTracks([]); unsub(); };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  function persist(nextOras: Ora[], nextPinned: Track[], uid: string) {
    localStorage.setItem(lsKey(uid), JSON.stringify({ list: nextOras, pinnedTracks: nextPinned }));
    if (db) {
      setDoc(doc(db, 'users', uid, 'data', 'oras'), { list: nextOras, pinnedTracks: nextPinned }).catch(() => {});
    }
  }

  const addOra = useCallback((ora: Omit<Ora, 'id' | 'addedAt'>) => {
    if (!user) return;
    const uid = user.uid;
    setOras(prev => {
      const next = [...prev, { ...ora, id: `${ora.service}:${ora.sourceId}`, addedAt: Date.now() }];
      persist(next, pinnedTracksRef.current, uid);
      return next;
    });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeOra = useCallback((id: string) => {
    if (!user) return;
    const uid = user.uid;
    setOras(prev => {
      const next = prev.filter(o => o.id !== id);
      persist(next, pinnedTracksRef.current, uid);
      return next;
    });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOra = useCallback((service: Ora['service'], sourceId: string) =>
    oras.some(o => o.service === service && o.sourceId === sourceId),
  [oras]);

  const addPinnedTrack = useCallback((track: Track) => {
    if (!user) return;
    const uid = user.uid;
    setPinnedTracks(prev => {
      if (prev.some(t => t.id === track.id && t.service === track.service)) return prev;
      const next = [...prev, track];
      persist(orasRef.current, next, uid);
      return next;
    });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const removePinnedTrack = useCallback((id: string, service: string) => {
    if (!user) return;
    const uid = user.uid;
    setPinnedTracks(prev => {
      const next = prev.filter(t => !(t.id === id && t.service === service));
      persist(orasRef.current, next, uid);
      return next;
    });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <OrasContext.Provider value={{ oras, addOra, removeOra, isOra, pinnedTracks, addPinnedTrack, removePinnedTrack }}>
      {children}
    </OrasContext.Provider>
  );
}

export function useOras() {
  const ctx = useContext(OrasContext);
  if (!ctx) throw new Error('useOras must be inside OrasProvider');
  return ctx;
}
