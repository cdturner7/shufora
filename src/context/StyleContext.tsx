import { createContext, useContext, useState, type ReactNode } from 'react';

const LS_KEY = 'shufora:style-overrides';

export type StyleOverrides = Record<string, string>;

interface StyleContextValue {
  overrides: StyleOverrides;
  setOverride: (cssVar: string, value: string) => void;
  resetAll: () => void;
}

const StyleContext = createContext<StyleContextValue | null>(null);

function lsLoad(): StyleOverrides {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function applyAll(overrides: StyleOverrides) {
  const el = document.documentElement;
  for (const [cssVar, value] of Object.entries(overrides)) {
    el.style.setProperty(cssVar, value);
  }
}

export function StyleProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<StyleOverrides>(() => {
    const saved = lsLoad();
    applyAll(saved);
    return saved;
  });

  function setOverride(cssVar: string, value: string) {
    document.documentElement.style.setProperty(cssVar, value);
    setOverrides(prev => {
      const next = { ...prev, [cssVar]: value };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function resetAll() {
    setOverrides(prev => {
      for (const cssVar of Object.keys(prev)) {
        document.documentElement.style.removeProperty(cssVar);
      }
      localStorage.removeItem(LS_KEY);
      return {};
    });
  }

  return (
    <StyleContext.Provider value={{ overrides, setOverride, resetAll }}>
      {children}
    </StyleContext.Provider>
  );
}

export function useStyle(): StyleContextValue {
  const ctx = useContext(StyleContext);
  if (!ctx) throw new Error('useStyle must be used within StyleProvider');
  return ctx;
}
