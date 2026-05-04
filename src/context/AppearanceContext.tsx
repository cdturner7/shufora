import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

export type Theme = 'dark' | 'light' | 'system';
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
  theme: Theme;
  accentColor: AccentColor;
  customAccentHex?: string;
  darkAccentHex?: string;
}

interface AppearanceContextValue extends AppearanceState {
  setTheme: (t: Theme) => void;
  setAccentColor: (a: AccentColor) => void;
  setCustomAccentHex: (hex: string) => void;
  setDarkAccentHex: (hex: string) => void;
  naming: Naming;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

const LS_KEY = 'shufora:appearance';

const DEFAULTS: AppearanceState = { theme: 'system', accentColor: 'teal', customAccentHex: '#2CC295' };

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

function resolveTheme(theme: Theme): 'dark' | 'light' {
  return theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', resolveTheme(theme));
}

function applyAccent(accent: AccentColor, lightHex?: string, darkHex?: string) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const effectiveHex = isDark && darkHex ? darkHex : lightHex;
  const p = effectiveHex ? deriveAccentPalette(effectiveHex) : ACCENT_PALETTE[accent];
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
    applyTheme(s.theme);
    applyAccent(s.accentColor, s.customAccentHex, s.darkAccentHex);
    return s;
  });

  useEffect(() => {
    if (!db || !user) return;
    const ref = doc(db, 'users', user.uid, 'data', 'appearance');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const remote = snap.data() as AppearanceState;
        applyTheme(remote.theme);
        applyAccent(remote.accentColor, remote.customAccentHex, remote.darkAccentHex);
        setState(remote);
        localStorage.setItem(LS_KEY, JSON.stringify(remote));
      } else {
        setDoc(ref, state);
      }
    });
    return unsub;
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function onSystemChange() {
      if (state.theme === 'system') {
        applyTheme('system');
        applyAccent(state.accentColor, state.customAccentHex, state.darkAccentHex);
      }
    }
    mq.addEventListener('change', onSystemChange);
    return () => mq.removeEventListener('change', onSystemChange);
  }, [state.theme]);

  function persist(next: AppearanceState) {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    if (db && user) setDoc(doc(db, 'users', user.uid, 'data', 'appearance'), next);
  }

  const setTheme = useCallback((theme: Theme) => {
    setState((prev) => {
      const next = { ...prev, theme };
      applyTheme(theme);
      // Re-apply accent so the dark/light hex swap takes effect immediately
      applyAccent(next.accentColor, next.customAccentHex, next.darkAccentHex);
      persist(next);
      return next;
    });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const setAccentColor = useCallback((accentColor: AccentColor) => {
    setState((prev) => {
      const next = { ...prev, accentColor, customAccentHex: undefined };
      applyAccent(accentColor, undefined, next.darkAccentHex);
      persist(next);
      return next;
    });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCustomAccentHex = useCallback((hex: string) => {
    setState((prev) => {
      const next = { ...prev, customAccentHex: hex };
      applyAccent(prev.accentColor, hex, next.darkAccentHex);
      persist(next);
      return next;
    });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const setDarkAccentHex = useCallback((hex: string) => {
    setState((prev) => {
      const next = { ...prev, darkAccentHex: hex };
      applyAccent(prev.accentColor, prev.customAccentHex, hex);
      persist(next);
      return next;
    });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppearanceContext.Provider value={{ ...state, setTheme, setAccentColor, setCustomAccentHex, setDarkAccentHex, naming: SHUFORA_NAMING }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error('useAppearance must be used within AppearanceProvider');
  return ctx;
}
