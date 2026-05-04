import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSpotify } from '../context/SpotifyContext';
import { useSoundCloud } from '../context/SoundCloudContext';

function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const spotify = useSpotify();
  const sc = useSoundCloud();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    // Guard against React Strict Mode's double-invocation of effects
    if (handledRef.current) return;
    handledRef.current = true;

    const path = location.pathname;

    if (path === '/auth/spotify/callback') {
      const code = new URLSearchParams(location.search).get('code');
      if (!code) { setError('No authorization code received from Spotify.'); return; }
      spotify.handleCallback(code)
        .then(() => navigate('/library', { replace: true }))
        .catch((e) => setError(String(e)));
    } else if (path === '/auth/soundcloud/callback') {
      sc.handleCallback(location.hash);
      navigate('/library', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <p style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>Connection failed: {error}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/settings', { replace: true })}>
          Back to Settings
        </button>
      </div>
    );
  }

  return (
    <div className="page" style={{ textAlign: 'center', paddingTop: '4rem', color: 'var(--color-text-muted)' }}>
      Connecting…
    </div>
  );
}

export default AuthCallback;
