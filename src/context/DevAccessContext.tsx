import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from './AuthContext';
import { auth, functions } from '../lib/firebase';

interface DevAccessContextValue {
  isDev: boolean;
  devMode: boolean;
  devLoading: boolean;
  setDevMode: (on: boolean) => void;
}

const DevAccessContext = createContext<DevAccessContextValue>({
  isDev: false,
  devMode: false,
  devLoading: true,
  setDevMode: () => {},
});

const CLIENT_DEV_EMAILS: string[] = (import.meta.env.VITE_DEV_EMAILS ?? '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

function lsModeKey(uid: string) { return `shufora:devMode:${uid}`; }

function checkEmailClientSide(user: { email?: string | null; emailVerified?: boolean; providerData?: { providerId: string }[] }): boolean {
  const email = (user.email ?? '').toLowerCase();
  if (!email || !CLIENT_DEV_EMAILS.includes(email)) return false;

  if (auth) {
    const fromGoogle = (user.providerData ?? []).some((p) => p.providerId === 'google.com');
    return fromGoogle || !!user.emailVerified;
  }

  return true;
}

export function DevAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isDev, setIsDev] = useState(false);
  const [devMode, setDevModeState] = useState(false);
  const [devLoading, setDevLoading] = useState(true);

  useEffect(() => {
    setDevLoading(true);
    if (!user) {
      setIsDev(false);
      setDevModeState(false);
      setDevLoading(false);
      return;
    }

    const uid = user.uid;

    const clientIsDev = checkEmailClientSide(user);
    if (clientIsDev) {
      setIsDev(true);
      const stored = localStorage.getItem(lsModeKey(uid));
      setDevModeState(stored === null ? true : stored === 'true');
    }
    setDevLoading(false);

    if (!functions) return;
    httpsCallable(functions, 'getDevAccess')({})
      .then((res) => {
        const { isDev: serverIsDev } = res.data as { isDev: boolean };
        setIsDev(serverIsDev);
        if (serverIsDev) {
          const stored = localStorage.getItem(lsModeKey(uid));
          setDevModeState(stored === null ? true : stored === 'true');
        } else if (!clientIsDev) {
          setDevModeState(false);
          localStorage.removeItem(lsModeKey(uid));
        }
        if (!serverIsDev) {
          setIsDev(false);
          setDevModeState(false);
          localStorage.removeItem(lsModeKey(uid));
        }
      })
      .catch(() => {});
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  function setDevMode(on: boolean) {
    if (!user || !isDev) return;
    setDevModeState(on);
    localStorage.setItem(lsModeKey(user.uid), String(on));
  }

  return (
    <DevAccessContext.Provider value={{ isDev, devMode, devLoading, setDevMode }}>
      {children}
    </DevAccessContext.Provider>
  );
}

export function useDevAccess(): DevAccessContextValue {
  return useContext(DevAccessContext);
}
