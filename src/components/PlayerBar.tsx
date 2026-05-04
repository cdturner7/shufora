import { useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ChevronUp } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import './PlayerBar.css';

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function PlayerBar() {
  const navigate = useNavigate();
  const { currentTrack, isPlaying, position, duration, volume, togglePlay, next, previous, seek, setVolume } = usePlayer();
  const trackRef = useRef<HTMLDivElement>(null);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    seek(((e.clientX - rect.left) / rect.width) * duration);
  }, [duration, seek]);

  const pct = duration > 0 ? (position / duration) * 100 : 0;

  if (!currentTrack) {
    return (
      <div className="player-bar player-bar--idle">
        <div className="player-bar-body">
          <div className="player-bar-left player-bar-left--idle">
            <div className="player-bar-art">
              <div className="player-bar-art-placeholder" />
            </div>
            <div className="player-bar-track">
              <span className="player-bar-title player-bar-title--idle">Nothing playing</span>
              <span className="player-bar-artist">Pick something to play</span>
            </div>
          </div>
          <div className="player-bar-controls">
            <button className="pctrl-btn" disabled><SkipBack size={16} strokeWidth={2} /></button>
            <button className="pctrl-btn pctrl-btn--play" disabled><Play size={18} strokeWidth={2} /></button>
            <button className="pctrl-btn" disabled><SkipForward size={16} strokeWidth={2} /></button>
          </div>
          <div className="player-bar-right" />
        </div>
      </div>
    );
  }

  return (
    <div className="player-bar">
      <div className="player-bar-progress" ref={trackRef} onClick={handleProgressClick}>
        <div className="player-bar-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="player-bar-body">
        <div className="player-bar-left" onClick={() => navigate('/now-playing')} role="button" tabIndex={0}>
          <div className="player-bar-art">
            {currentTrack.artwork
              ? <img src={currentTrack.artwork} alt={currentTrack.title} />
              : <div className="player-bar-art-placeholder" />}
          </div>
          <div className="player-bar-track">
            <span className="player-bar-title">{currentTrack.title}</span>
            <span className="player-bar-artist">{currentTrack.artist}</span>
          </div>
          <ChevronUp size={14} strokeWidth={2} className="player-bar-expand" />
        </div>

        <div className="player-bar-controls">
          <button className="pctrl-btn" onClick={previous} title="Previous">
            <SkipBack size={16} strokeWidth={2} />
          </button>
          <button className="pctrl-btn pctrl-btn--play" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause size={18} strokeWidth={2} /> : <Play size={18} strokeWidth={2} />}
          </button>
          <button className="pctrl-btn" onClick={next} title="Next">
            <SkipForward size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="player-bar-right">
          <span className="player-bar-time">{fmt(position)} / {fmt(duration)}</span>
          <button className="pctrl-btn" onClick={() => setVolume(volume === 0 ? 0.7 : 0)} title="Toggle mute">
            {volume === 0 ? <VolumeX size={15} strokeWidth={2} /> : <Volume2 size={15} strokeWidth={2} />}
          </button>
          <input
            className="player-volume"
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}

export default PlayerBar;
