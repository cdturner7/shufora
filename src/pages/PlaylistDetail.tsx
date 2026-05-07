import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Play, Pause, Clock, LayoutGrid, Check, MoreVertical, SkipForward, Shuffle } from 'lucide-react';
import { useSpotify } from '../context/SpotifyContext';
import { useSoundCloud } from '../context/SoundCloudContext';
import { usePlayer, trackFromSpotify, trackFromSoundCloud, type Track } from '../context/PlayerContext';
import { useOras } from '../context/OrasContext';
import './PlaylistDetail.css';

interface PlaylistMeta {
  title: string;
  artwork?: string;
  description?: string;
  accent: string;
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function PlaylistDetail() {
  const { service, id } = useParams<{ service: string; id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const spotify = useSpotify();
  const sc = useSoundCloud();
  const player = usePlayer();
  const { insertNextInQueue } = player;
  const { addOra, isOra, addPinnedTrack } = useOras();

  type MenuPos = { trackIdx: number; top: number; right: number };
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);

  useEffect(() => {
    document.body.style.overflow = menuPos ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuPos]);

  const meta = (location.state as PlaylistMeta | null) ?? { title: 'Playlist', accent: '#2CC295' };

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        let loaded: Track[] = [];

        if (service === 'spotify') {
          if (id === 'liked') {
            const raw = await spotify.getLikedTracks();
            loaded = raw.map(trackFromSpotify);
          } else {
            const raw = await spotify.getPlaylistTracks(id!);
            loaded = raw.map(trackFromSpotify);
          }
        } else if (service === 'soundcloud') {
          if (id === 'liked') {
            const raw = await sc.getLikes();
            loaded = raw.map(t => trackFromSoundCloud(t, sc.getStreamUrl(t), sc.getArtwork(t)));
          } else {
            const playlists = await sc.getPlaylists();
            const pl = playlists.find(p => String(p.id) === id);
            if (pl) {
              loaded = pl.tracks.map(t => trackFromSoundCloud(t, sc.getStreamUrl(t), sc.getArtwork(t)));
            }
          }
        }

        if (!cancelled) setTracks(loaded);
      } catch (e) {
        if (!cancelled) setError('Failed to load tracks.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [service, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const playFrom = useCallback((index: number) => {
    if (tracks.length === 0) return;
    player.play(tracks[index], tracks, index);
  }, [tracks, player]);

  const playAll = useCallback(() => playFrom(0), [playFrom]);

  const isCurrentPlaylist = tracks.length > 0 &&
    player.currentTrack != null &&
    tracks.some(t => t.id === player.currentTrack!.id && t.service === player.currentTrack!.service);

  return (
    <div className="page playlist-detail-page">
      <button className="playlist-detail-back btn btn-ghost" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} strokeWidth={2} />
        Back
      </button>

      <div className="playlist-detail-header">
        <div className="playlist-detail-art" style={{ '--accent': meta.accent } as React.CSSProperties}>
          {meta.artwork
            ? <img src={meta.artwork} alt={meta.title} />
            : <div className="playlist-detail-art-ph"><Music size={40} strokeWidth={1} /></div>}
        </div>

        <div className="playlist-detail-meta">
          <p className="playlist-detail-service">{service === 'spotify' ? 'Spotify' : 'SoundCloud'}</p>
          <h1 className="playlist-detail-title">{meta.title}</h1>
          {meta.description && <p className="playlist-detail-desc">{meta.description}</p>}
          {!loading && (
            <p className="playlist-detail-count">{tracks.length} tracks</p>
          )}
          <div className="playlist-detail-actions">
            <button
              className="btn btn-primary playlist-detail-play-all"
              onClick={playAll}
              disabled={loading || tracks.length === 0}
              style={{ '--color-primary': meta.accent, '--color-primary-light': meta.accent } as React.CSSProperties}
            >
              {isCurrentPlaylist && player.isPlaying
                ? <><Pause size={16} strokeWidth={2} /> Playing</>
                : <><Play size={16} strokeWidth={2} /> Play All</>}
            </button>
            {(() => {
              const onBoard = isOra(service as 'spotify' | 'soundcloud', id!);
              return (
                <button
                  className="btn btn-secondary playlist-detail-queue-all"
                  onClick={() => !onBoard && addOra({
                    name: meta.title,
                    artwork: meta.artwork,
                    service: service as 'spotify' | 'soundcloud',
                    sourceId: id!,
                    trackCount: tracks.length,
                  })}
                  disabled={loading || onBoard}
                >
                  {onBoard
                    ? <><Check size={16} strokeWidth={2} /> On Board</>
                    : <><LayoutGrid size={16} strokeWidth={2} /> Add to Board</>}
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      {loading && (
        <div className="playlist-detail-loading">
          <div className="playlist-detail-spinner" />
        </div>
      )}

      {error && <p className="playlist-detail-error">{error}</p>}

      {!loading && !error && tracks.length === 0 && (
        <p className="playlist-detail-empty">No tracks in this playlist.</p>
      )}

      {!loading && tracks.length > 0 && (
        <>
        <div className="playlist-detail-tracks">
          <div className="playlist-detail-tracks-header">
            <span className="pd-col-title">Title</span>
            <span className="pd-col-dur"><Clock size={13} strokeWidth={1.75} /></span>
          </div>

          {tracks.map((track, i) => {
            const isActive = player.currentTrack?.id === track.id &&
                             player.currentTrack?.service === track.service;
            return (
              <div
                key={`${track.service}:${track.id}:${i}`}
                className={`pd-track-row${isActive ? ' pd-track-row--active' : ''}`}
                onClick={() => playFrom(i)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && playFrom(i)}
              >
                <div className="pd-track-art">
                  {track.artwork
                    ? <img src={track.artwork} alt={track.title} />
                    : <Music size={13} strokeWidth={1.5} />}
                  {isActive && player.isPlaying && <span className="pd-playing-dot" />}
                </div>
                <div className="pd-track-info">
                  <span className="pd-track-title">{track.title}</span>
                  <span className="pd-track-artist">{track.artist}</span>
                </div>
                <span className="pd-col-dur">{fmt(track.duration)}</span>
                <button
                  className="pd-menu-btn"
                  onClick={e => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenuPos(menuPos?.trackIdx === i
                      ? null
                      : { trackIdx: i, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                  }}
                  title="More options"
                  type="button"
                >
                  <MoreVertical size={14} strokeWidth={1.75} />
                </button>
              </div>
            );
          })}
        </div>

        {menuPos && (
          <>
            <div className="pd-menu-overlay" onClick={() => setMenuPos(null)} />
            <div
              className="pd-menu-dropdown"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <button
                className="pd-menu-item"
                onClick={() => {
                  insertNextInQueue([tracks[menuPos.trackIdx]]);
                  setMenuPos(null);
                }}
              >
                <SkipForward size={14} strokeWidth={1.75} />
                Play next
              </button>
              <button
                className="pd-menu-item"
                onClick={() => {
                  const track = tracks[menuPos.trackIdx];
                  addPinnedTrack(track);
                  player.insertNextInQueue([track]);
                  setMenuPos(null);
                }}
              >
                <Shuffle size={14} strokeWidth={1.75} />
                Add to board
              </button>
            </div>
          </>
        )}
        </>
      )}
    </div>
  );
}

export default PlaylistDetail;
