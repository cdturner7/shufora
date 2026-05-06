import { useState, type FormEvent } from 'react';
import { Pencil, Check, X, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSpotify } from '../context/SpotifyContext';
import { useSoundCloud } from '../context/SoundCloudContext';
import { auth } from '../lib/firebase';
import './UserProfile.css';

function initials(name: string | null | undefined, email: string | null | undefined): string {
  if (name?.trim()) return name.trim()[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return '?';
}

function UserProfile() {
  const { user, updateDisplayName, changePassword, providerData } = useAuth();
  const spotify = useSpotify();
  const sc = useSoundCloud();

  const [editingName, setEditingName]   = useState(false);
  const [nameValue, setNameValue]       = useState('');
  const [nameSaving, setNameSaving]     = useState(false);
  const [nameError, setNameError]       = useState<string | null>(null);

  const [showPw, setShowPw]     = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]       = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError]   = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  if (!user) return null;

  const hasPasswordProvider = auth !== null && providerData.some(p => p.providerId === 'password');

  function startEditName() {
    setNameValue(user!.displayName ?? '');
    setNameError(null);
    setEditingName(true);
  }

  async function saveName() {
    const trimmed = nameValue.trim();
    if (!trimmed) return;
    setNameSaving(true);
    setNameError(null);
    try {
      await updateDisplayName(trimmed);
      setEditingName(false);
    } catch {
      setNameError('Failed to update name.');
    } finally {
      setNameSaving(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (newPw.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    setPwSaving(true);
    try {
      await changePassword(currentPw, newPw);
      setPwSuccess(true);
      setCurrentPw(''); setNewPw('');
      setShowPw(false);
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPwError('Current password is incorrect.');
      } else {
        setPwError('Failed to update password.');
      }
    } finally {
      setPwSaving(false);
    }
  }

  function cancelPw() {
    setShowPw(false); setCurrentPw(''); setNewPw(''); setPwError(null);
  }

  return (
    <div className="page profile">
      <h1 className="page-title">Profile</h1>

      {/* ── Identity ─────────────────────────────────────────────────── */}
      <div className="card profile-identity">
        <div className="profile-avatar">
          {user.photoURL
            ? <img src={user.photoURL} alt={user.displayName ?? 'Avatar'} />
            : <span>{initials(user.displayName, user.email)}</span>}
        </div>

        <div className="profile-info">
          {editingName ? (
            <div className="profile-name-edit">
              <input
                className="input profile-name-input"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                maxLength={60}
                autoFocus
              />
              <button className="profile-icon-btn" onClick={saveName} disabled={nameSaving || !nameValue.trim()} title="Save">
                <Check size={15} strokeWidth={2.5} />
              </button>
              <button className="profile-icon-btn profile-icon-btn--cancel" onClick={() => setEditingName(false)} title="Cancel">
                <X size={15} strokeWidth={2.5} />
              </button>
              {nameError && <span className="profile-field-error">{nameError}</span>}
            </div>
          ) : (
            <div className="profile-name-row">
              <span className="profile-name">{user.displayName ?? '—'}</span>
              <button className="profile-icon-btn" onClick={startEditName} title="Edit name">
                <Pencil size={13} strokeWidth={2} />
              </button>
            </div>
          )}
          <span className="profile-email">{user.email}</span>
        </div>
      </div>

      {/* ── Password ─────────────────────────────────────────────────── */}
      {hasPasswordProvider && (
        <div className="card">
          <div className="profile-section-header">
            <span className="profile-section-label">
              <Lock size={13} strokeWidth={2} />
              Password
            </span>
            {!showPw && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowPw(true); setPwSuccess(false); }}>
                Change
              </button>
            )}
          </div>
          {pwSuccess && !showPw && (
            <p className="profile-success">Password updated.</p>
          )}
          {showPw && (
            <form onSubmit={handlePasswordSubmit} className="profile-pw-form">
              <div className="form-group">
                <label className="form-label">Current password</label>
                <input
                  className="input"
                  type="password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">New password</label>
                <input
                  className="input"
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
              </div>
              {pwError && <p className="profile-pw-error">{pwError}</p>}
              <div className="profile-pw-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={cancelPw}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={pwSaving || !currentPw || !newPw}>
                  {pwSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Linked accounts ──────────────────────────────────────────── */}
      <div className="card">
        <div className="profile-section-header">
          <span className="profile-section-label">Linked accounts</span>
        </div>
        <div className="profile-accounts">

          <div className={`profile-account${spotify.isConnected ? ' profile-account--connected' : ''}`}>
            <div className="profile-account-logo profile-account-logo--spotify">
              <SpotifyMark />
            </div>
            <div className="profile-account-info">
              <span className="profile-account-name">Spotify</span>
              {spotify.isConnected && spotify.user
                ? <span className="profile-account-sub">{spotify.user.displayName || spotify.user.email}</span>
                : <span className="profile-account-sub profile-account-sub--dim">Not connected</span>}
            </div>
            {spotify.isConnected
              ? <button className="btn btn-secondary btn-sm" onClick={spotify.disconnect}>Disconnect</button>
              : <button className="btn btn-primary btn-sm" onClick={spotify.connect}>Connect</button>}
          </div>

          <div className={`profile-account${sc.isConnected ? ' profile-account--connected' : ''}`}>
            <div className="profile-account-logo profile-account-logo--soundcloud">
              <SoundCloudMark />
            </div>
            <div className="profile-account-info">
              <span className="profile-account-name">SoundCloud</span>
              {sc.isConnected && sc.user
                ? <span className="profile-account-sub">{sc.user.username}</span>
                : <span className="profile-account-sub profile-account-sub--dim">Not connected</span>}
            </div>
            {sc.isConnected
              ? <button className="btn btn-secondary btn-sm" onClick={sc.disconnect}>Disconnect</button>
              : <button className="btn btn-primary btn-sm" onClick={sc.connect}>Connect</button>}
          </div>

        </div>
      </div>
    </div>
  );
}

function SpotifyMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
      <path d="M5 8.5c4.5-1.5 9.5-.5 14 2" />
      <path d="M5 12.5c3.5-1 7.5-.5 11 1.5" />
      <path d="M5 16.5c2.5-.75 5.5-.5 8 1" />
    </svg>
  );
}

function SoundCloudMark() {
  return (
    <svg viewBox="0 0 24 24" fill="white">
      <path d="M1 17.5A2.5 2.5 0 0 0 3.5 20H17a3.5 3.5 0 0 0 .5-6.97A5.5 5.5 0 0 0 7 8.55a4 4 0 0 0-3 1.32A2.5 2.5 0 0 0 1 12.5v5z" />
    </svg>
  );
}

export default UserProfile;
