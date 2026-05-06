import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppearance } from '../context/AppearanceContext';
import { auth } from '../lib/firebase';
import './Login.css';

const isFirebaseConfigured = auth !== null;

type Mode = 'signin' | 'signup';

function Login() {
  const { signIn, signUp, signInWithGoogle, sendPasswordReset } = useAuth();
  const { naming } = useAppearance();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') ?? '/';

  const [mode, setMode] = useState<Mode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        if (!displayName.trim()) {
          setError('Please enter your name.');
          setSubmitting(false);
          return;
        }
        await signUp(email, password, displayName.trim());
      }
      navigate(next, { replace: true });
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      navigate(next, { replace: true });
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordReset(email);
      setResetSent(true);
    } catch (err: unknown) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (forgotMode) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-brand">
            <span className="login-brand-name">{naming.appName}</span>
          </div>
          <p className="login-tagline">Reset your password</p>
          {resetSent ? (
            <div className="login-reset-sent">
              <p>Check your email — we sent a reset link to <strong>{email}</strong>.</p>
              <button className="btn btn-primary btn-lg login-submit" onClick={() => { setForgotMode(false); setResetSent(false); }}>
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="login-form">
              <div className="form-group">
                <label className="form-label" htmlFor="reset-email">Email address</label>
                <input
                  id="reset-email"
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  autoFocus
                />
              </div>
              {error && <p className="login-error">{error}</p>}
              <button type="submit" className="btn btn-primary btn-lg login-submit" disabled={submitting || !email}>
                {submitting ? 'Sending…' : 'Send Reset Link'}
              </button>
              <button type="button" className="login-forgot-link" onClick={() => setForgotMode(false)}>
                ← Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const inSignin = mode === 'signin';

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-brand-name">{naming.appName}</span>
        </div>
        <p className="login-tagline">Your music, everywhere</p>

        <div className="login-tabs">
          <div className={`login-tab-slider${!inSignin ? ' login-tab-slider--right' : ''}`} />
          <button
            className={`login-tab${inSignin ? ' active' : ''}`}
            onClick={() => switchMode('signin')}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`login-tab${!inSignin ? ' active' : ''}`}
            onClick={() => switchMode('signup')}
            type="button"
          >
            Create Account
          </button>
        </div>

        {error && <p className="login-error">{error}</p>}

        <div className="login-forms-viewport">
          <div className={`login-forms-track${!inSignin ? ' login-forms-track--signup' : ''}`}>

            {/* Sign In panel */}
            <div className="login-form-panel" aria-hidden={!inSignin}>
              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="signin-email">Email</label>
                  <input
                    id="signin-email"
                    className="input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                    tabIndex={inSignin ? 0 : -1}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="signin-password">Password</label>
                  <input
                    id="signin-password"
                    className="input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    minLength={6}
                    tabIndex={inSignin ? 0 : -1}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg login-submit"
                  disabled={submitting}
                  tabIndex={inSignin ? 0 : -1}
                >
                  {submitting ? 'Please wait…' : 'Sign In'}
                </button>
                <button
                  type="button"
                  className="login-forgot-link"
                  onClick={() => { setForgotMode(true); setError(null); }}
                  tabIndex={inSignin ? 0 : -1}
                >
                  Forgot password?
                </button>
              </form>
            </div>

            {/* Create Account panel */}
            <div className="login-form-panel" aria-hidden={inSignin}>
              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="signup-name">Name</label>
                  <input
                    id="signup-name"
                    className="input"
                    type="text"
                    placeholder="Your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="name"
                    required={!inSignin}
                    tabIndex={inSignin ? -1 : 0}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="signup-email">Email</label>
                  <input
                    id="signup-email"
                    className="input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    tabIndex={inSignin ? -1 : 0}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="signup-password">Password</label>
                  <input
                    id="signup-password"
                    className="input"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    tabIndex={inSignin ? -1 : 0}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg login-submit"
                  disabled={submitting}
                  tabIndex={inSignin ? -1 : 0}
                >
                  {submitting ? 'Please wait…' : 'Create Account'}
                </button>
              </form>
            </div>

          </div>
        </div>

        {isFirebaseConfigured && (
          <>
            <div className="login-divider"><span>or</span></div>
            <button
              className="btn login-google-btn"
              onClick={handleGoogle}
              disabled={submitting}
              type="button"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </>
        )}

        {!isFirebaseConfigured && (
          <p className="login-local-notice">
            Running in local mode — data is saved to this device only.
            Add Firebase credentials in <code>.env</code> to enable sync and Google sign-in.
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

function friendlyError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code;
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed. Please try again.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.';
      case 'auth/operation-not-allowed':
        return 'Google sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.';
      case 'auth/popup-blocked':
        return 'Popup was blocked by your browser. Allow popups for this site and try again.';
      case 'auth/cancelled-popup-request':
        return 'Sign-in popup was cancelled. Please try again.';
      default:
        return `Something went wrong (${code}).`;
    }
  }
  return 'Something went wrong. Please try again.';
}

export default Login;
