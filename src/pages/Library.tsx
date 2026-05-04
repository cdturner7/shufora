import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Music, Heart, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSpotify } from '../context/SpotifyContext';
import { useSoundCloud } from '../context/SoundCloudContext';
import { usePlayer, trackFromSpotify, trackFromSoundCloud, type Track } from '../context/PlayerContext';
import type { SpotifyPlaylist } from '../lib/spotify';
import type { SoundCloudPlaylist } from '../lib/soundcloud';
import './Library.css';

function navState(title: string, accent: string, artwork?: string, description?: string) {
  return { title, accent, artwork, description };
}

type Tab = 'spotify' | 'soundcloud';

function Library() {
  const spotify = useSpotify();
  const sc = useSoundCloud();
  const player = usePlayer();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>(spotify.isConnected ? 'spotify' : 'soundcloud');
  const [spPlaylists, setSpPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [scPlaylists, setScPlaylists] = useState<SoundCloudPlaylist[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (spotify.isConnected) spotify.getPlaylists().then(setSpPlaylists).catch(() => {});
  }, [spotify.isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sc.isConnected) sc.getPlaylists().then(setScPlaylists).catch(() => {});
  }, [sc.isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const playQueue = useCallback(async (loader: () => Promise<Track[]>) => {
    setLoading(true);
    try {
      const queue = await loader();
      if (queue.length) await player.play(queue[0], queue, 0);
    } finally {
      setLoading(false);
    }
  }, [player]);

  const playSpotifyLikes = () => playQueue(async () => {
    const tracks = await spotify.getLikedTracks();
    return tracks.map(trackFromSpotify);
  });

  const playSpotifyPlaylist = (id: string) => playQueue(async () => {
    const tracks = await spotify.getPlaylistTracks(id);
    return tracks.map(trackFromSpotify);
  });

  const playScLikes = () => playQueue(async () => {
    const tracks = await sc.getLikes();
    return tracks.map(t => trackFromSoundCloud(t, sc.getStreamUrl(t), sc.getArtwork(t)));
  });

  const playScPlaylist = (pl: SoundCloudPlaylist) => playQueue(async () =>
    pl.tracks.map(t => trackFromSoundCloud(t, sc.getStreamUrl(t), sc.getArtwork(t)))
  );

  if (!spotify.isConnected && !sc.isConnected) {
    return (
      <div className="page">
          <div className="library-empty">
          <Music size={52} strokeWidth={1} />
          <p>Connect a music account to get started.</p>
          <button className="btn" onClick={() => navigate('/settings')}>Go to Settings</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">

      {spotify.isConnected && sc.isConnected && (
        <div className="library-tabs">
          <button className={`library-tab${tab === 'spotify' ? ' active' : ''}`} onClick={() => setTab('spotify')}>
            Spotify
          </button>
          <button className={`library-tab${tab === 'soundcloud' ? ' active' : ''}`} onClick={() => setTab('soundcloud')}>
            SoundCloud
          </button>
        </div>
      )}

      {tab === 'spotify' && spotify.isConnected && (
        <div className="library-list">
          <PlaylistRow
            title="Liked Songs"
            subtitle="Your saved tracks"
            icon={<Heart size={22} strokeWidth={1.5} />}
            accent="#1DB954"
            onPlay={playSpotifyLikes}
            onNavigate={() => navigate('/playlist/spotify/liked', { state: navState('Liked Songs', '#1DB954') })}
            disabled={loading}
          />
          {spPlaylists.map(pl => (
            <PlaylistRow
              key={pl.id}
              title={pl.name}
              subtitle={`${pl.tracks.total} tracks`}
              artwork={pl.images[0]?.url}
              accent="#1DB954"
              onPlay={() => playSpotifyPlaylist(pl.id)}
              onNavigate={() => navigate(`/playlist/spotify/${pl.id}`, {
                state: navState(pl.name, '#1DB954', pl.images[0]?.url, pl.description),
              })}
              disabled={loading}
            />
          ))}
        </div>
      )}

      {tab === 'soundcloud' && sc.isConnected && (
        <div className="library-list">
          <PlaylistRow
            title="Liked Tracks"
            subtitle="Your liked tracks"
            icon={<Heart size={22} strokeWidth={1.5} />}
            accent="#FF5500"
            onPlay={playScLikes}
            onNavigate={() => navigate('/playlist/soundcloud/liked', { state: navState('Liked Tracks', '#FF5500') })}
            disabled={loading}
          />
          {scPlaylists.map(pl => (
            <PlaylistRow
              key={pl.id}
              title={pl.title}
              subtitle={`${pl.track_count} tracks`}
              artwork={pl.artwork_url ?? undefined}
              accent="#FF5500"
              onPlay={() => playScPlaylist(pl)}
              onNavigate={() => navigate(`/playlist/soundcloud/${pl.id}`, {
                state: navState(pl.title, '#FF5500', pl.artwork_url ?? undefined),
              })}
              disabled={loading}
            />
          ))}
        </div>
      )}

      {loading && <p className="library-loading">Loading…</p>}
    </div>
  );
}

function PlaylistRow({
  title, subtitle, artwork, icon, accent, onPlay, onNavigate, disabled,
}: {
  title: string;
  subtitle: string;
  artwork?: string;
  icon?: ReactNode;
  accent: string;
  onPlay: () => void;
  onNavigate: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`playlist-row${disabled ? ' playlist-row--disabled' : ''}`}
      onClick={disabled ? undefined : onNavigate}
    >
      <div className="playlist-row-art" style={{ '--accent': accent } as React.CSSProperties}>
        {artwork
          ? <img src={artwork} alt={title} />
          : <div className="playlist-row-art-ph">{icon ?? <Music size={22} strokeWidth={1.5} />}</div>}
      </div>
      <div className="playlist-row-info">
        <span className="playlist-row-title">{title}</span>
        <span className="playlist-row-sub">{subtitle}</span>
      </div>
      <button
        className="playlist-row-play"
        onClick={e => { e.stopPropagation(); if (!disabled) onPlay(); }}
        disabled={disabled}
        title={`Play ${title}`}
      >
        <PlayCircle size={28} strokeWidth={1.5} />
      </button>
    </div>
  );
}

export default Library;
