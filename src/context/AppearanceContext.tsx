import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

export type AccentColor = 'purple' | 'blue' | 'teal' | 'green' | 'amber' | 'rose';

export interface Naming {
  appName: string;
  appSubtitle: string;
}

const SHUFORA_NAMING: Naming = {
  appName: 'Shufora',
  appSubtitle: '',
};

interface AppearanceState {
  accentColor: AccentColor;
  customAccentHex?: string;
}

interface AppearanceContextValue extends AppearanceState {
  setAccentColor: (a: AccentColor) => void;
  setCustomAccentHex: (hex: string) => void;
  naming: Naming;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

const LS_KEY = 'shufora:appearance';

const DEFAULTS: AppearanceState = { accentColor: 'teal', customAccentHex: '#2CC295' };

const ACCENT_PALETTE: Record<AccentColor, { primary: string; light: string; dim: string; glow: string; subtle: string }> = {
  amber:  { primary: '#C07C3A', light: '#D4944E', dim: '#A06830', glow: 'rgba(192,124,58,0.18)',  subtle: 'rgba(192,124,58,0.09)'  },
  purple: { primary: '#6B52C0', light: '#8B72DF', dim: '#5040A0', glow: 'rgba(107,82,192,0.17)',  subtle: 'rgba(107,82,192,0.09)'  },
  blue:   { primary: '#3A7EC0', light: '#5498D8', dim: '#2E66A6', glow: 'rgba(58,126,192,0.17)',  subtle: 'rgba(58,126,192,0.09)'  },
  teal:   { primary: '#2A9E8E', light: '#3BBAA8', dim: '#228476', glow: 'rgba(42,158,142,0.17)',  subtle: 'rgba(42,158,142,0.09)'  },
  green:  { primary: '#3A8C5A', light: '#4EAA72', dim: '#2E7448', glow: 'rgba(58,140,90,0.17)',   subtle: 'rgba(58,140,90,0.09)'   },
  rose:   { primary: '#C04060', light: '#D85A78', dim: '#A03050', glow: 'rgba(192,64,96,0.17)',   subtle: 'rgba(192,64,96,0.09)'   },
};

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const parts = clean.match(/.{2}/g);
  if (!parts) return null;
  return [parseInt(parts[0], 16), parseInt(parts[1], 16), parseInt(parts[2], 16)];
}

function deriveAccentPalette(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return ACCENT_PALETTE.teal;
  const [r, g, b] = rgb;
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  const light = `#${toHex(r + (255 - r) * 0.28)}${toHex(g + (255 - g) * 0.28)}${toHex(b + (255 - b) * 0.28)}`;
  const dim   = `#${toHex(r * 0.72)}${toHex(g * 0.72)}${toHex(b * 0.72)}`;
  return {
    primary: hex,
    light,
    dim,
    glow:   `rgba(${r},${g},${b},0.20)`,
    subtle: `rgba(${r},${g},${b},0.10)`,
  };
}

function applyAccent(accent: AccentColor, hex?: string) {
  const p = hex ? deriveAccentPalette(hex) : ACCENT_PALETTE[accent];
  const el = document.documentElement;
  el.style.setProperty('--color-primary', p.primary);
  el.style.setProperty('--color-primary-light', p.light);
  el.style.setProperty('--color-primary-dim', p.dim);
  el.style.setProperty('--color-primary-glow', p.glow);
  el.style.setProperty('--color-primary-subtle', p.subtle);
  el.style.setProperty('--color-accent', p.primary);
}

function lsLoad(): AppearanceState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULTS;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<AppearanceState>(() => {
    const s = lsLoad();
    applyAccent(s.accentColor, s.customAccentHex);
    return s;
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const userRef = useRef(user);
  userRef.current = user;

  function persist(next: AppearanceState) {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    const u = userRef.current;
    if (db && u) setDoc(doc(db, 'users', u.uid, 'data', 'appearance'), next);
  }

  useEffect(() => {
    if (!db || !user) return;
    const ref = doc(db, 'users', user.uid, 'data', 'appearance');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const remote = snap.data() as AppearanceState;
        applyAccent(remote.accentColor, remote.customAccentHex);
        setState(remote);
        localStorage.setItem(LS_KEY, JSON.stringify(remote));
      } else {
        setDoc(ref, stateRef.current);
      }
    });
    return unsub;
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const setAccentColor = useCallback((accentColor: AccentColor) => {
    const prev = stateRef.current;
    const next = { ...prev, accentColor, customAccentHex: undefined };
    applyAccent(accentColor, undefined);
    persist(next);
    setState(next);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setCustomAccentHex = useCallback((hex: string) => {
    const prev = stateRef.current;
    const next = { ...prev, customAccentHex: hex };
    applyAccent(prev.accentColor, hex);
    persist(next);
    setState(next);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppearanceContext.Provider value={{ ...state, setAccentColor, setCustomAccentHex, naming: SHUFORA_NAMING }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error('useAppearance must be used within AppearanceProvider');
  return ctx;
}
