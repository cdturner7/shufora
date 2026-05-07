import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Music, Heart, PlayCircle, ListPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSpotify } from '../context/SpotifyContext';
import { useSoundCloud } from '../context/SoundCloudContext';
import { usePlayer, trackFromSpotify, trackFromSoundCloud, type Track } from '../context/PlayerContext';
import type { SoundCloudPlaylist } from '../lib/soundcloud';
import type { SpotifyAlbum, SpotifyArtist } from '../lib/spotify';
import './Library.css';

function navState(title: string, accent: string, artwork?: string, description?: string) {
  return { title, accent, artwork, description };
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

type Tab = 'spotify' | 'soundcloud';

function Library() {
  const spotify = useSpotify();
  const sc = useSoundCloud();
  const player = usePlayer();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>(spotify.isConnected ? 'spotify' : 'soundcloud');
  const [loading, setLoading] = useState(false);
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [savedAlbums, setSavedAlbums] = useState<SpotifyAlbum[]>([]);
  const [followedArtists, setFollowedArtists] = useState<SpotifyArtist[]>([]);

  useEffect(() => {
    if (spotify.isConnected) spotify.getPlaylists();
  }, [spotify.isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!spotify.isConnected) return;
    spotify.getRecentTracks().then(tracks => setRecentTracks(tracks.map(trackFromSpotify))).catch(() => {});
    spotify.getSavedAlbums().then(setSavedAlbums).catch(() => {});
    spotify.getFollowedArtists().then(setFollowedArtists).catch(() => {});
  }, [spotify.isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sc.isConnected) sc.getPlaylists();
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

  const addQueue = useCallback(async (loader: () => Promise<Track[]>) => {
    setLoading(true);
    try {
      const tracks = await loader();
      if (tracks.length) player.appendToQueue(tracks);
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

  const queueSpotifyLikes = () => addQueue(async () => {
    const tracks = await spotify.getLikedTracks();
    return tracks.map(trackFromSpotify);
  });

  const queueSpotifyPlaylist = (id: string) => addQueue(async () => {
    const tracks = await spotify.getPlaylistTracks(id);
    return tracks.map(trackFromSpotify);
  });

  const queueScLikes = () => addQueue(async () => {
    const tracks = await sc.getLikes();
    return tracks.map(t => trackFromSoundCloud(t, sc.getStreamUrl(t), sc.getArtwork(t)));
  });

  const queueScPlaylist = (pl: SoundCloudPlaylist) => addQueue(async () =>
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
        <div className="lib-content">
          <LibSection label="Playlists">
            <div className="library-list">
              <PlaylistRow
                title="Liked Songs"
                subtitle="Your saved tracks"
                icon={<Heart size={22} strokeWidth={1.5} />}
                accent="#1DB954"
                onPlay={playSpotifyLikes}
                onQueue={queueSpotifyLikes}
                onNavigate={() => navigate('/playlist/spotify/liked', { state: navState('Liked Songs', '#1DB954') })}
                disabled={loading}
              />
              {spotify.playlists.map(pl => (
                <PlaylistRow
                  key={pl.id}
                  title={pl.name}
                  subtitle={`${pl.tracks.total} tracks`}
                  artwork={pl.images[0]?.url}
                  accent="#1DB954"
                  onPlay={() => playSpotifyPlaylist(pl.id)}
                  onQueue={() => queueSpotifyPlaylist(pl.id)}
                  onNavigate={() => navigate(`/playlist/spotify/${pl.id}`, {
                    state: navState(pl.name, '#1DB954', pl.images[0]?.url, pl.description),
                  })}
                  disabled={loading}
                />
              ))}
            </div>
          </LibSection>

          {recentTracks.length > 0 && (
            <LibSection label="Recent Songs">
              <div className="lib-track-list">
                {recentTracks.slice(0, 10).map((track, i) => (
                  <TrackRow
                    key={`${track.id}:${i}`}
                    track={track}
                    onPlay={() => player.play(track, recentTracks, i)}
                    onQueue={() => player.appendToQueue([track])}
                    isActive={player.currentTrack?.id === track.id}
                  />
                ))}
              </div>
            </LibSection>
          )}

          {savedAlbums.length > 0 && (
            <LibSection label="Albums">
              <div className="lib-scroll-row">
                {savedAlbums.map(album => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    onPlay={() => playQueue(async () => {
                      const tracks = await spotify.getAlbumTracks(album.id, album);
                      return tracks.map(trackFromSpotify);
                    })}
                  />
                ))}
              </div>
            </LibSection>
          )}

          {followedArtists.length > 0 && (
            <LibSection label="Following">
              <div className="lib-scroll-row">
                {followedArtists.map(artist => (
                  <ArtistCard key={artist.id} artist={artist} />
                ))}
              </div>
            </LibSection>
          )}
        </div>
      )}

      {tab === 'soundcloud' && sc.isConnected && (
        <div className="lib-content">
          <LibSection label="Playlists">
            <div className="library-list">
              <PlaylistRow
                title="Liked Tracks"
                subtitle="Your liked tracks"
                icon={<Heart size={22} strokeWidth={1.5} />}
                accent="#FF5500"
                onPlay={playScLikes}
                onQueue={queueScLikes}
                onNavigate={() => navigate('/playlist/soundcloud/liked', { state: navState('Liked Tracks', '#FF5500') })}
                disabled={loading}
              />
              {sc.playlists.map(pl => (
                <PlaylistRow
                  key={pl.id}
                  title={pl.title}
                  subtitle={`${pl.track_count} tracks`}
                  artwork={pl.artwork_url ?? undefined}
                  accent="#FF5500"
                  onPlay={() => playScPlaylist(pl)}
                  onQueue={() => queueScPlaylist(pl)}
                  onNavigate={() => navigate(`/playlist/soundcloud/${pl.id}`, {
                    state: navState(pl.title, '#FF5500', pl.artwork_url ?? undefined),
                  })}
                  disabled={loading}
                />
              ))}
            </div>
          </LibSection>
        </div>
      )}

      {loading && <p className="library-loading">Loading…</p>}
    </div>
  );
}

function LibSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="lib-section">
      <p className="lib-section-title">{label}</p>
      {children}
    </div>
  );
}

function TrackRow({ track, onPlay, onQueue, isActive }: {
  track: Track;
  onPlay: () => void;
  onQueue: () => void;
  isActive: boolean;
}) {
  return (
    <div
      className={`lib-track-row${isActive ? ' lib-track-row--active' : ''}`}
      onClick={onPlay}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onPlay()}
    >
      <div className="lib-track-art">
        {track.artwork
          ? <img src={track.artwork} alt={track.title} />
          : <Music size={14} strokeWidth={1.5} />}
      </div>
      <div className="lib-track-info">
        <span className="lib-track-title">{track.title}</span>
        <span className="lib-track-artist">{track.artist}</span>
      </div>
      <span className="lib-track-dur">{fmt(track.duration)}</span>
      <button
        className="lib-track-queue"
        onClick={e => { e.stopPropagation(); onQueue(); }}
        title="Add to queue"
        type="button"
      >
        <ListPlus size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function AlbumCard({ album, onPlay }: { album: SpotifyAlbum; onPlay: () => void }) {
  return (
    <div className="lib-card" onClick={onPlay}>
      <div className="lib-card-art">
        {album.images[0]?.url
          ? <img src={album.images[0].url} alt={album.name} />
          : <div className="lib-card-art-ph"><Music size={24} strokeWidth={1} /></div>}
      </div>
      <div className="lib-card-info">
        <span className="lib-card-name">{album.name}</span>
        <span className="lib-card-sub">{album.artists.map(a => a.name).join(', ')}</span>
      </div>
    </div>
  );
}

function ArtistCard({ artist }: { artist: SpotifyArtist }) {
  return (
    <div className="lib-card lib-card--artist">
      <div className="lib-card-art lib-card-art--circle">
        {artist.images[0]?.url
          ? <img src={artist.images[0].url} alt={artist.name} />
          : <div className="lib-card-art-ph"><Music size={24} strokeWidth={1} /></div>}
      </div>
      <div className="lib-card-info">
        <span className="lib-card-name">{artist.name}</span>
        {artist.genres[0] && <span className="lib-card-sub">{artist.genres[0]}</span>}
      </div>
    </div>
  );
}

function PlaylistRow({
  title, subtitle, artwork, icon, accent, onPlay, onQueue, onNavigate, disabled,
}: {
  title: string;
  subtitle: string;
  artwork?: string;
  icon?: ReactNode;
  accent: string;
  onPlay: () => void;
  onQueue: () => void;
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
        className="playlist-row-queue"
        onClick={e => { e.stopPropagation(); if (!disabled) onQueue(); }}
        disabled={disabled}
        title={`Add ${title} to queue`}
      >
        <ListPlus size={20} strokeWidth={1.5} />
      </button>
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
