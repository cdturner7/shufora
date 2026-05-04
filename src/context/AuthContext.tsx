import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const googleProvider = new GoogleAuthProvider();

// ---------------------------------------------------------------------------
// Local mock auth — used when Firebase is not configured
// ---------------------------------------------------------------------------

const LOCAL_USER_KEY = 'shufora:local-user';

interface LocalUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: null;
}

function loadLocalUser(): LocalUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    return raw ? (JSON.parse(raw) as LocalUser) : null;
  } catch {
    return null;
  }
}

function saveLocalUser(u: LocalUser) {
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(u));
}

function clearLocalUser() {
  localStorage.removeItem(LOCAL_USER_KEY);
}

function makeLocalUser(email: string, displayName: string): LocalUser {
  return {
    uid: `local-${btoa(email)}`,
    email,
    displayName,
    photoURL: null,
  };
}

function asUser(u: LocalUser): User {
  return u as unknown as User;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      });
      return unsubscribe;
    } else {
      const localUser = loadLocalUser();
      setUser(localUser ? asUser(localUser) : null);
      setLoading(false);
    }
  }, []);

  // Persist user profile to Firestore on every sign-in so connections (Spotify etc.) can be looked up by uid
  useEffect(() => {
    if (!user || !db) return;
    setDoc(
      doc(db, 'users', user.uid, 'data', 'profile'),
      {
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL ?? '',
        lastLoginAt: serverTimestamp(),
      },
      { merge: true },
    ).catch(() => {});
  }, [user?.uid]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (auth) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      if (!password) throw { code: 'auth/wrong-password' };
      const u = makeLocalUser(email, email.split('@')[0]);
      saveLocalUser(u);
      setUser(asUser(u));
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    if (auth) {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(newUser, { displayName });
    } else {
      const u = makeLocalUser(email, displayName);
      saveLocalUser(u);
      setUser(asUser(u));
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (auth) {
      await signInWithPopup(auth, googleProvider);
    } else {
      throw { code: 'auth/operation-not-supported-in-this-environment' };
    }
  }, []);

  const logOut = useCallback(async () => {
    if (auth) {
      await signOut(auth);
    } else {
      clearLocalUser();
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!auth || !auth.currentUser || !auth.currentUser.email) {
      throw new Error('Not authenticated');
    }
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!auth) throw new Error('Firebase not configured');
    await sendPasswordResetEmail(auth, email);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, logOut, changePassword, sendPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
