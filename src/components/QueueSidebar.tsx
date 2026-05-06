import { useState, useRef } from 'react';
import { X, GripVertical, Play, Music } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import BoardPlayer from './BoardPlayer';
import './QueueSidebar.css';

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function QueueSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { queue, queueIndex, skipToIndex, removeFromQueue, reorderQueue } = usePlayer();
  const dragFromRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const upNext = queue.slice(queueIndex + 1, queueIndex + 51);

  return (
    <aside className={`queue-sidebar${open ? ' queue-sidebar--open' : ''}`}>
        <div className="qs-header">
          <span className="qs-header-label">Now Playing</span>
          <button className="qs-close-btn" onClick={onClose} title="Close" type="button">
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="qs-body">
          <div className="qs-player">
            <BoardPlayer />
          </div>

          <div className="qs-queue">
            <div className="qs-queue-header">
              <span className="qs-queue-label">Up Next</span>
                </div>

            {upNext.length === 0 ? (
              <p className="qs-queue-empty">Nothing queued</p>
            ) : (
              <div className="qs-queue-list">
                {upNext.map((track, i) => {
                  const absIdx = queueIndex + 1 + i;
                  const isOver = dragOverIdx === absIdx;
                  return (
                    <div
                      key={`${track.service}:${track.id}:${absIdx}`}
                      className={`qs-queue-row${isOver ? ' qs-queue-row--over' : ''}`}
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
                    >
                      <GripVertical size={12} strokeWidth={1.5} className="qs-drag-handle" />
                      <div className="qs-track-art">
                        {track.artwork
                          ? <img src={track.artwork} alt={track.title} />
                          : <Music size={11} strokeWidth={1.5} />}
                      </div>
                      <div className="qs-track-info">
                        <span className="qs-track-title">{track.title}</span>
                        <span className="qs-track-meta">{track.artist} · {fmt(track.duration)}</span>
                      </div>
                      <div className="qs-track-actions">
                        <button
                          className="qs-action-btn"
                          onClick={() => skipToIndex(absIdx)}
                          title="Play now"
                          type="button"
                        >
                          <Play size={10} strokeWidth={2.5} />
                        </button>
                        <button
                          className="qs-action-btn qs-action-btn--remove"
                          onClick={() => removeFromQueue(absIdx)}
                          title="Remove"
                          type="button"
                        >
                          <X size={10} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
    </aside>
  );
}

export default QueueSidebar;
