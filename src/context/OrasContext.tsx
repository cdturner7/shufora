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

const STORAGE_KEY = 'shufora:oras';

const OrasContext = createContext<OrasContextValue | null>(null);

function lsLoad(): Ora[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

export function OrasProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [oras, setOras] = useState<Ora[]>(lsLoad);

  // Sync with Firestore — mirrors the AppearanceContext pattern
  useEffect(() => {
    if (!db || !user) return;
    const ref = doc(db, 'users', user.uid, 'data', 'oras');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const remote = (snap.data().list ?? []) as Ora[];
        setOras(remote);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
      } else {
        // First sign-in: migrate any existing localStorage oras up to Firestore
        setDoc(ref, { list: lsLoad() });
      }
    });
    return unsub;
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  function persist(next: Ora[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (db && user) {
      setDoc(doc(db, 'users', user.uid, 'data', 'oras'), { list: next }).catch(() => {});
    }
  }

  const addOra = useCallback((ora: Omit<Ora, 'id' | 'addedAt'>) => {
    setOras(prev => {
      const next = [...prev, { ...ora, id: `${ora.service}:${ora.sourceId}`, addedAt: Date.now() }];
      persist(next);
      return next;
    });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeOra = useCallback((id: string) => {
    setOras(prev => {
      const next = prev.filter(o => o.id !== id);
      persist(next);
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
