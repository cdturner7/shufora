import { useRef, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, SkipBack, SkipForward, Play, Pause, Music, AlignJustify } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import './NowPlaying.css';

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function NowPlaying() {
  const navigate = useNavigate();
  const {
    currentTrack, isPlaying, position, duration,
    togglePlay, next, previous, seek,
    queue, queueIndex, skipToIndex,
  } = usePlayer();
  const progressRef = useRef<HTMLDivElement>(null);
  const [showQueue, setShowQueue] = useState(false);

  useEffect(() => {
    if (!currentTrack) navigate('/', { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    seek(((e.clientX - rect.left) / rect.width) * duration);
  }, [duration, seek]);

  if (!currentTrack) return null;

  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const upNext = queue.slice(queueIndex + 1);

  return (
    <div className="np-screen">

      {/* Header */}
      <header className="np-header">
        <button className="np-icon-btn" onClick={() => navigate(-1)} type="button" title="Back">
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
        <span className="np-header-label">{showQueue ? 'Up Next' : 'Playing Now'}</span>
        <button
          className={`np-icon-btn${showQueue ? ' np-icon-btn--active' : ''}`}
          onClick={() => setShowQueue(v => !v)}
          type="button"
          title="Queue"
        >
          <AlignJustify size={18} strokeWidth={1.75} />
        </button>
      </header>

      {showQueue ? (
        /* ── Queue panel ── */
        <div className="np-queue">
          {/* Current track */}
          <div className="np-queue-section-label">Now Playing</div>
          <div className="np-queue-row np-queue-row--current">
            <div className="np-queue-art">
              {currentTrack.artwork
                ? <img src={currentTrack.artwork} alt={currentTrack.title} />
                : <Music size={14} strokeWidth={1.5} />}
            </div>
            <div className="np-queue-info">
              <span className="np-queue-title">{currentTrack.title}</span>
              <span className="np-queue-artist">{currentTrack.artist}</span>
            </div>
            <span className="np-queue-dur">{fmt(duration)}</span>
          </div>

          {upNext.length > 0 ? (
            <>
              <div className="np-queue-section-label" style={{ marginTop: '1.5rem' }}>
                Up Next · {upNext.length} track{upNext.length !== 1 ? 's' : ''}
              </div>
              <div className="np-queue-list">
                {upNext.map((t, i) => {
                  const absoluteIndex = queueIndex + 1 + i;
                  return (
                    <button
                      key={`${t.service}:${t.id}:${absoluteIndex}`}
                      className="np-queue-row np-queue-row--btn"
                      onClick={() => skipToIndex(absoluteIndex)}
                      type="button"
                    >
                      <div className="np-queue-art">
                        {t.artwork
                          ? <img src={t.artwork} alt={t.title} />
                          : <Music size={14} strokeWidth={1.5} />}
                      </div>
                      <div className="np-queue-info">
                        <span className="np-queue-title">{t.title}</span>
                        <span className="np-queue-artist">{t.artist}</span>
                      </div>
                      <span className="np-queue-dur">{fmt(t.duration)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="np-queue-empty">Nothing queued after this track.</p>
          )}
        </div>
      ) : (
        /* ── Normal player view ── */
        <>
          {/* Artwork */}
          <div className="np-ring">
            <div className={`np-disk${isPlaying ? ' np-disk--playing' : ''}`}>
              {currentTrack.artwork ? (
                <img src={currentTrack.artwork} alt={currentTrack.title} />
              ) : (
                <div className="np-disk-empty">
                  <Music size={64} strokeWidth={1} />
                </div>
              )}
            </div>
          </div>

          {/* Track name & artist */}
          <div className="np-meta">
            <h1 className="np-title">{currentTrack.title}</h1>
            <p className="np-artist">{currentTrack.artist}</p>
          </div>

          {/* Progress */}
          <div className="np-progress-wrap">
            <div className="np-timestamps">
              <span>{fmt(position)}</span>
              <span>{fmt(duration)}</span>
            </div>
            <div className="np-progress-track" ref={progressRef} onClick={handleSeek}>
              <div className="np-progress-fill" style={{ width: `${pct}%` }} />
              <div className="np-progress-thumb" style={{ left: `${pct}%` }} />
            </div>
          </div>

          {/* Controls */}
          <div className="np-controls">
            <button className="np-ctrl np-ctrl--skip" onClick={previous} type="button" title="Previous">
              <SkipBack size={20} strokeWidth={2} />
            </button>
            <button className="np-ctrl np-ctrl--play" onClick={togglePlay} type="button" title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying
                ? <Pause size={28} strokeWidth={2.5} />
                : <Play  size={28} strokeWidth={2.5} />}
            </button>
            <button className="np-ctrl np-ctrl--skip" onClick={next} type="button" title="Next">
              <SkipForward size={20} strokeWidth={2} />
            </button>
          </div>
        </>
      )}

    </div>
  );
}

export default NowPlaying;
