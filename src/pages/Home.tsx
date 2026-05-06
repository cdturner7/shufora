import { useState, useEffect, useCallback, useRef } from 'react';
import { Music, Play, Shuffle, Plus, X, GripVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOras, type Ora } from '../context/OrasContext';
import { usePlayer, trackFromSpotify, trackFromSoundCloud, type Track } from '../context/PlayerContext';
import { useSpotify } from '../context/SpotifyContext';
import { useSoundCloud } from '../context/SoundCloudContext';
import type { SoundCloudPlaylist } from '../lib/soundcloud';
import BoardPlayer from '../components/BoardPlayer';
import AddOraModal from '../components/AddOraModal';
import './Home.css';

// ── Extended track type for board ──────────────────────────────────────────

interface BoardTrack extends Track {
  oraId: string;
  oraName: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Ora card ───────────────────────────────────────────────────────────────

function OraCard({ ora, onRemove, onNavigate }: { ora: Ora; onRemove: () => void; onNavigate: () => void }) {
  return (
    <div className="ora-card" onClick={onNavigate} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onNavigate()}>
      <div className="ora-card-art">
        {ora.artwork
          ? <img src={ora.artwork} alt={ora.name} />
          : <div className="ora-card-art-ph"><Music size={24} strokeWidth={1} /></div>}
        <span
          className="ora-card-badge"
          style={{ background: ora.service === 'spotify' ? '#1DB95422' : '#FF550022',
                   color: ora.service === 'spotify' ? '#1DB954' : '#FF5500' }}
        >
          {ora.service === 'spotify' ? 'SP' : 'SC'}
        </span>
      </div>
      <div className="ora-card-info">
        <span className="ora-card-name">{ora.name}</span>
        {ora.trackCount > 0 && <span className="ora-card-count">{ora.trackCount} tracks</span>}
      </div>
      <button
        className="ora-card-remove"
        onClick={e => { e.stopPropagation(); onRemove(); }}
        type="button"
        title="Remove Ora"
      >×</button>
    </div>
  );
}

// ── Board player section ───────────────────────────────────────────────────

function BoardPlayerSection({
  onShuffle,
  onShuffleBoard,
  onLoadMore,
  isLoadingTracks,
}: {
  onShuffle: () => void;
  onShuffleBoard: () => void;
  onLoadMore: () => void;
  isLoadingTracks: boolean;
}) {
  const { currentTrack, queue, queueIndex, skipToIndex, removeFromQueue, reorderQueue } = usePlayer();
  const upNext = queue.slice(queueIndex + 1);

  const [visibleCount, setVisibleCount] = useState(30);
  const visibleUpNext = upNext.slice(0, visibleCount);

  // Desktop mouse drag
  const dragFromRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  // Touch drag
  const listContainerRef = useRef<HTMLDivElement>(null);
  const touchDragRef = useRef<{ fromAbsIdx: number } | null>(null);

  // Prevent scroll while touch-dragging (requires non-passive listener)
  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => { if (touchDragRef.current) e.preventDefault(); };
    el.addEventListener('touchmove', handler, { passive: false });
    return () => el.removeEventListener('touchmove', handler);
  }, []);

  function handleRowTouchStart(absIdx: number) {
    touchDragRef.current = { fromAbsIdx: absIdx };
    setDragOverIdx(absIdx);
  }

  function handleRowTouchMove(e: React.TouchEvent) {
    if (!touchDragRef.current || !listContainerRef.current) return;
    const touch = e.touches[0];
    const rows = listContainerRef.current.querySelectorAll<HTMLDivElement>('.bps-queue-row');
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        setDragOverIdx(queueIndex + 1 + i);
        break;
      }
    }
  }

  function handleRowTouchEnd() {
    if (!touchDragRef.current) return;
    if (dragOverIdx !== null && dragOverIdx !== touchDragRef.current.fromAbsIdx) {
      reorderQueue(touchDragRef.current.fromAbsIdx, dragOverIdx);
    }
    touchDragRef.current = null;
    setDragOverIdx(null);
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      if (visibleCount < upNext.length) {
        setVisibleCount(v => v + 20);
      } else {
        onLoadMore();
      }
    }
  }

  return (
    <div className="bps">
      {/* Left: player (hidden on mobile — PlayerBar handles it) */}
      <div className="bps-left">
        <BoardPlayer onIdlePlay={onShuffle} />
      </div>

      {/* Right: queue */}
      <div className="bps-right">
        <div className="bps-queue-head">
          <span className="bps-queue-label">Up Next</span>
          <button className="bps-shuffle-btn" type="button" onClick={onShuffleBoard} title="Shuffle Board">
            <Shuffle size={15} strokeWidth={2} />
          </button>
        </div>

        {upNext.length === 0 ? (
          isLoadingTracks ? (
            <div className="bps-skeleton">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="bps-skeleton-row">
                  <div className="bps-skel bps-skel--art" />
                  <div className="bps-skeleton-info">
                    <div className="bps-skel bps-skel--title" />
                    <div className="bps-skel bps-skel--meta" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="bps-queue-empty">
              {currentTrack ? 'End of queue.' : 'Shuffle the board to start playing.'}
            </p>
          )
        ) : (
          <div className="bps-queue-list" ref={listContainerRef} onScroll={handleScroll}>
            {visibleUpNext.map((track, i) => {
              const absIdx = queueIndex + 1 + i;
              const isOver = dragOverIdx === absIdx;
              return (
                <div
                  key={`${track.service}:${track.id}:${absIdx}`}
                  className={`bps-queue-row${isOver ? ' bps-queue-row--over' : ''}`}
                  onClick={() => skipToIndex(absIdx)}
                  draggable
                  onDragStart={() => { dragFromRef.current = absIdx; }}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(absIdx); }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={e => {
                    e.preventDefault();
                    if (dragFromRef.current !== null && dragFromRef.current !== absIdx) {
                      reorderQueue(dragFromRef.current, absIdx);
                    }
                    dragFromRef.current = null;
                    setDragOverIdx(null);
                  }}
                  onTouchStart={() => handleRowTouchStart(absIdx)}
                  onTouchMove={handleRowTouchMove}
                  onTouchEnd={handleRowTouchEnd}
                >
                  <GripVertical size={12} strokeWidth={1.5} className="bps-drag-handle" />
                  <div className="bps-track-art">
                    {track.artwork
                      ? <img src={track.artwork} alt={track.title} />
                      : <Music size={11} strokeWidth={1.5} />}
                  </div>
                  <div className="bps-track-info">
                    <span className="bps-track-title">{track.title}</span>
                    <span className="bps-track-meta">{track.artist} · {fmt(track.duration)}</span>
                  </div>
                  {track.source && (
                    <span className="bps-track-source">{track.source}</span>
                  )}
                  <button
                    className="bps-remove-btn"
                    onClick={e => { e.stopPropagation(); removeFromQueue(absIdx); }}
                    title="Remove from queue"
                    type="button"
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                </div>
              );
            })}
            {upNext.length > visibleCount && (
              <div className="bps-queue-more">
                {upNext.length - visibleCount} more — scroll to load
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

function Home() {
  const { oras, removeOra } = useOras();
  const player = usePlayer();
  const { removeFromQueueWhere } = player;
  const spotify = useSpotify();
  const sc = useSoundCloud();
  const navigate = useNavigate();

  function navToOra(ora: Ora) {
    navigate(`/playlist/${ora.service}/${ora.sourceId}`, {
      state: {
        title: ora.name,
        accent: ora.service === 'spotify' ? '#1DB954' : '#FF5500',
        artwork: ora.artwork,
      },
    });
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [boardTracks, setBoardTracks] = useState<BoardTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  const spotifyRef = { current: spotify };
  const scRef = { current: sc };
  spotifyRef.current = spotify;
  scRef.current = sc;

  const boardTracksRef = useRef<BoardTrack[]>([]);
  boardTracksRef.current = boardTracks;

  const oraIds = oras.map(o => o.id).join(',');
  const autoQueuedRef = useRef(false);

  // Reset auto-queue flag whenever the ora set changes so a re-load always
  // refreshes the queue (but only if playback isn't already active).
  useEffect(() => { autoQueuedRef.current = false; }, [oraIds]);

  const loadTracks = useCallback(async (oraList: Ora[]) => {
    setBoardTracks([]);
    if (oraList.length === 0) { setLoadingTracks(false); return; }
    setLoadingTracks(true);

    let scPlaylistCache: SoundCloudPlaylist[] | null = null;
    const all: BoardTrack[] = [];

    for (const ora of oraList) {
      try {
        let tracks: Track[] = [];
        if (ora.service === 'spotify') {
          if (ora.sourceId === 'liked') {
            tracks = (await spotifyRef.current.getLikedTracks()).map(trackFromSpotify);
          } else {
            tracks = (await spotifyRef.current.getPlaylistTracks(ora.sourceId)).map(trackFromSpotify);
          }
        } else {
          if (ora.sourceId === 'liked') {
            const raw = await scRef.current.getLikes();
            tracks = raw.map(t => trackFromSoundCloud(t, scRef.current.getStreamUrl(t), scRef.current.getArtwork(t)));
          } else {
            if (!scPlaylistCache) scPlaylistCache = await scRef.current.getPlaylists();
            const pl = scPlaylistCache.find(p => String(p.id) === ora.sourceId);
            if (pl) tracks = pl.tracks.map(t => trackFromSoundCloud(t, scRef.current.getStreamUrl(t), scRef.current.getArtwork(t)));
          }
        }
        all.push(...tracks.map(t => ({ ...t, oraId: ora.id, oraName: ora.name, source: ora.name })));
      } catch { /* skip failed ora */ }
    }

    const seen = new Set<string>();
    const deduped = all.filter(t => {
      const k = `${t.service}:${t.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    setBoardTracks(deduped);
    setLoadingTracks(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadTracks(oras);
  }, [oraIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // When tracks finish loading (or a new ora is added), auto-populate the queue
  // if there are no upcoming tracks. Uses loadQueue when idle, appendToQueue when
  // something is already playing so playback isn't interrupted.
  useEffect(() => {
    if (boardTracks.length === 0) return;
    if (autoQueuedRef.current) return;
    autoQueuedRef.current = true;
    const hasUpcoming = player.queue.length > player.queueIndex + 1;
    if (hasUpcoming) return;
    if (!player.currentTrack) {
      player.loadQueue(boardTracks as Track[], 0);
    } else {
      player.appendToQueue(boardTracks as Track[]);
    }
  }, [boardTracks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refill: when fewer than 20 tracks remain upcoming, append the full
  // board again so playback never stops.
  useEffect(() => {
    const remaining = player.queue.length - player.queueIndex - 1;
    if (remaining < 20 && boardTracksRef.current.length > 0) {
      player.appendToQueue(boardTracksRef.current as Track[]);
    }
  }, [player.queueIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  function appendMoreToQueue() {
    if (boardTracksRef.current.length === 0) return;
    player.appendToQueue(boardTracksRef.current as Track[]);
  }

  function playBoard() {
    const { queue } = player;
    if (queue.length === 0) return;
    player.play(queue[0], queue, 0);
  }

  function shuffleBoard() {
    const tracks = boardTracksRef.current;
    if (tracks.length === 0) return;
    if (player.currentTrack) {
      const cur = player.currentTrack;
      const rest = (tracks as Track[]).filter(t => !(t.id === cur.id && t.service === cur.service));
      player.loadQueue([cur, ...rest], 0);
    } else {
      player.loadQueue(tracks as Track[], 0);
    }
  }

  const hasOras = oras.length > 0;

  return (
    <div className="page home-board-page">
      <div className="board-page-header">
        <button className="btn btn-primary btn-sm" type="button" onClick={playBoard} disabled={!hasOras || player.isPlaying}>
          <Play size={13} strokeWidth={2.5} fill="currentColor" />
          Play Board
        </button>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => setModalOpen(true)}>
          <Plus size={14} strokeWidth={2.5} />
          Add Ora
        </button>
      </div>

      {!hasOras ? (
        <div className="home-empty">
          <div className="home-empty-ring">
            <Music size={32} strokeWidth={1} />
          </div>
          <p className="home-empty-title">Your board is empty</p>
          <p className="home-empty-sub">Add an Ora to start mixing playlists together.</p>
        </div>
      ) : (
        <div className="board-layout">
          <div className="board-main">
            <div className="ora-board">
              {oras.map(ora => (
                <OraCard
                  key={ora.id}
                  ora={ora}
                  onRemove={() => {
                    removeOra(ora.id);
                    removeFromQueueWhere(t => t.oraId === ora.id);
                  }}
                  onNavigate={() => navToOra(ora)}
                />
              ))}
            </div>
            <BoardPlayerSection
              onShuffle={playBoard}
              onShuffleBoard={shuffleBoard}
              onLoadMore={appendMoreToQueue}
              isLoadingTracks={loadingTracks}
            />
          </div>
        </div>
      )}

      {modalOpen && <AddOraModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

export default Home;
