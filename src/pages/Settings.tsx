import { useSpotify } from '../context/SpotifyContext';
import { useSoundCloud } from '../context/SoundCloudContext';
import './Settings.css';

function Settings() {
  const spotify = useSpotify();
  const sc = useSoundCloud();

  return (
    <div className="page">
      <div className="card">
        <p className="settings-section-label">Music Accounts</p>
        <p className="settings-section-desc">Link your streaming accounts to sync your library and play music.</p>

        <div className="service-list">
          <MusicServiceCard
            name="Spotify"
            description="Stream music, playlists & podcasts"
            accentColor="#1DB954"
            logo={<SpotifyLogo />}
            connected={spotify.isConnected}
            isLoading={spotify.isLoading}
            username={spotify.user?.displayName ?? null}
            onConnect={() => spotify.connect()}
            onDisconnect={() => spotify.disconnect()}
          />
          <MusicServiceCard
            name="SoundCloud"
            description="Discover tracks & mixes"
            accentColor="#FF5500"
            logo={<SoundCloudLogo />}
            connected={sc.isConnected}
            username={sc.user?.username ?? null}
            onConnect={() => sc.connect()}
            onDisconnect={() => sc.disconnect()}
          />
        </div>
      </div>
    </div>
  );
}

function MusicServiceCard({
  name, description, logo, accentColor, connected, isLoading = false, username, onConnect, onDisconnect,
}: {
  name: string;
  description: string;
  logo: React.ReactNode;
  accentColor: string;
  connected: boolean;
  isLoading?: boolean;
  username: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div
      className={`service-card${connected ? ' service-card--connected' : ''}`}
      style={{ '--service-color': accentColor } as React.CSSProperties}
    >
      <div className="service-card-logo">{logo}</div>
      <div className="service-card-info">
        <span className="service-card-name">{name}</span>
        <span className="service-card-desc">
          {connected && username ? `Connected as ${username}` : description}
        </span>
      </div>
      <div className="service-card-action">
        {isLoading ? (
          <span className="service-card-checking">Checking…</span>
        ) : connected ? (
          <button className="btn btn-sm btn-secondary service-card-disconnect" onClick={onDisconnect}>
            Disconnect
          </button>
        ) : (
          <button className="btn btn-sm service-card-connect" onClick={onConnect}>
            Connect
          </button>
        )}
      </div>
      {connected && <div className="service-card-dot" />}
    </div>
  );
}

function SpotifyLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="12" fill="#1DB954"/>
      <path d="M16.8 16.2c-.2.3-.6.4-.9.2-2.5-1.5-5.6-1.9-9.3-1-.4.1-.7-.1-.8-.5-.1-.4.1-.7.4-.8 4.1-1 7.6-.5 10.4 1.1.3.2.4.7.2 1zm1.2-2.5c-.2.4-.7.5-1.1.3-2.8-1.7-7.1-2.2-10.4-1.2-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.8-1.1 8.4-.6 11.6 1.4.4.2.5.7.3 1.1zm.1-2.6C14.6 9.3 9.5 9.1 6.6 10c-.5.2-1-.1-1.2-.6-.2-.5.1-1 .6-1.2C9.6 7.1 15.3 7.3 19 9.5c.4.2.6.8.3 1.2-.2.4-.8.6-1.2.3z" fill="white"/>
    </svg>
  );
}

function SoundCloudLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="12" fill="#FF5500"/>
      <path d="M4 13.8c0 1.2.9 2.2 2 2.2h9.5c1.1 0 2-.9 2-2 0-1-.7-1.8-1.6-2-.1-.6-.5-1.1-1-1.4V10c0-1.7-1.3-3-3-3-.9 0-1.8.4-2.4 1.1C9.1 7.7 8.6 7.5 8 7.5c-1.1 0-2 .9-2 2 0 .2 0 .4.1.6C5 10.4 4 12 4 13.8z" fill="white" opacity="0.9"/>
    </svg>
  );
}

export default Settings;
