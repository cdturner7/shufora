import { useRef, useCallback } from 'react';
import { SkipBack, SkipForward, Play, Pause, Music } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import './BoardPlayer.css';

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function BoardPlayer({ onIdlePlay }: { onIdlePlay?: () => void }) {
  const { currentTrack, isPlaying, position, duration, togglePlay, next, previous, seek } = usePlayer();
  const progressRef = useRef<HTMLDivElement>(null);

  function handlePlayClick() {
    if (!currentTrack && onIdlePlay) onIdlePlay();
    else togglePlay();
  }

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    seek(((e.clientX - rect.left) / rect.width) * duration);
  }, [duration, seek]);

  const pct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div className="board-player">
      {/* Artwork */}
      <div className={`bp-art${isPlaying ? ' bp-art--playing' : ''}`}>
        {currentTrack?.artwork ? (
          <img src={currentTrack.artwork} alt={currentTrack.title} />
        ) : (
          <div className="bp-art-empty">
            <Music size={48} strokeWidth={1} />
          </div>
        )}
      </div>

      {/* Track info */}
      <div className="bp-meta">
        {currentTrack ? (
          <>
            <p className="bp-title">{currentTrack.title}</p>
            <p className="bp-artist">{currentTrack.artist}</p>
          </>
        ) : (
          <p className="bp-idle">Add songs to your board and press play</p>
        )}
      </div>

      {/* Progress */}
      <div className="bp-progress-wrap">
        <div className="bp-timestamps">
          <span>{fmt(position)}</span>
          <span>{fmt(duration)}</span>
        </div>
        <div className="bp-progress-track" ref={progressRef} onClick={handleSeek}>
          <div className="bp-progress-fill" style={{ width: `${pct}%` }} />
          <div className="bp-progress-thumb" style={{ left: `${pct}%` }} />
        </div>
      </div>

      {/* Controls */}
      <div className="bp-controls">
        <button className="bp-ctrl bp-ctrl--skip" onClick={previous} type="button" title="Previous">
          <SkipBack size={18} strokeWidth={2} />
        </button>
        <button className="bp-ctrl bp-ctrl--play" onClick={handlePlayClick} type="button" title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <Pause size={22} strokeWidth={2.5} /> : <Play size={22} strokeWidth={2.5} />}
        </button>
        <button className="bp-ctrl bp-ctrl--skip" onClick={next} type="button" title="Next">
          <SkipForward size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

export default BoardPlayer;
