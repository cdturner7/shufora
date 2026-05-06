import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

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
}

// Per-user localStorage key prevents data bleed between accounts on the same device
const lsKey = (uid: string) => `shufora:oras:${uid}`;
// Legacy key from before multi-user support — migrated on first login
const LEGACY_LS_KEY = 'shufora:oras';

const OrasContext = createContext<OrasContextValue | null>(null);

export function OrasProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [oras, setOras] = useState<Ora[]>([]);

  useEffect(() => {
    if (!user) {
      setOras([]);
      return;
    }

    const uid = user.uid;
    const key = lsKey(uid);

    // Instant hydration from per-user localStorage cache
    try {
      const cached = JSON.parse(localStorage.getItem(key) ?? '[]') as Ora[];
      if (cached.length > 0) setOras(cached);
    } catch { /* ignore */ }

    if (!db) return;

    const ref = doc(db, 'users', uid, 'data', 'oras');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const remote = (snap.data().list ?? []) as Ora[];
        setOras(remote);
        localStorage.setItem(key, JSON.stringify(remote));
      } else {
        // First sign-in for this account — migrate any legacy oras up to Firestore
        const legacy = (() => {
          try { return JSON.parse(localStorage.getItem(LEGACY_LS_KEY) ?? '[]') as Ora[]; }
          catch { return [] as Ora[]; }
        })();
        setDoc(ref, { list: legacy });
        localStorage.removeItem(LEGACY_LS_KEY);
      }
    });

    return () => { setOras([]); unsub(); };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  function persist(next: Ora[], uid: string) {
    localStorage.setItem(lsKey(uid), JSON.stringify(next));
    if (db) {
      setDoc(doc(db, 'users', uid, 'data', 'oras'), { list: next }).catch(() => {});
    }
  }

  const addOra = useCallback((ora: Omit<Ora, 'id' | 'addedAt'>) => {
    if (!user) return;
    const uid = user.uid;
    setOras(prev => {
      const next = [...prev, { ...ora, id: `${ora.service}:${ora.sourceId}`, addedAt: Date.now() }];
      persist(next, uid);
      return next;
    });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeOra = useCallback((id: string) => {
    if (!user) return;
    const uid = user.uid;
    setOras(prev => {
      const next = prev.filter(o => o.id !== id);
      persist(next, uid);
      return next;
    });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOra = useCallback((service: Ora['service'], sourceId: string) =>
    oras.some(o => o.service === service && o.sourceId === sourceId),
  [oras]);

  return (
    <OrasContext.Provider value={{ oras, addOra, removeOra, isOra }}>
      {children}
    </OrasContext.Provider>
  );
}

export function useOras() {
  const ctx = useContext(OrasContext);
  if (!ctx) throw new Error('useOras must be inside OrasProvider');
  return ctx;
}
