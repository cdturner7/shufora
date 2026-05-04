import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Music, Check, Plus, Heart } from 'lucide-react';
import { useSpotify } from '../context/SpotifyContext';
import { useSoundCloud } from '../context/SoundCloudContext';
import { useOras } from '../context/OrasContext';
import type { SpotifyPlaylist } from '../lib/spotify';
import type { SoundCloudPlaylist } from '../lib/soundcloud';
import './AddOraModal.css';

interface PlaylistOption {
  sourceId: string;
  name: string;
  artwork?: string;
  service: 'spotify' | 'soundcloud';
  trackCount: number;
  isLikes?: boolean;
}

function ServiceDot({ service }: { service: 'spotify' | 'soundcloud' }) {
  return (
    <span
      className="aom-service-dot"
      style={{ background: service === 'spotify' ? '#1DB954' : '#FF5500' }}
      title={service === 'spotify' ? 'Spotify' : 'SoundCloud'}
    />
  );
}

function AddOraModal({ onClose }: { onClose: () => void }) {
  const spotify = useSpotify();
  const sc = useSoundCloud();
  const { addOra, removeOra, oras, isOra } = useOras();

  const [search, setSearch] = useState('');
  const [spPlaylists, setSpPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [scPlaylists, setScPlaylists] = useState<SoundCloudPlaylist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      const [sp, sc2] = await Promise.allSettled([
        spotify.isConnected ? spotify.getPlaylists() : Promise.resolve(null),
        sc.isConnected ? sc.getPlaylists() : Promise.resolve(null),
      ]);
      if (!alive) return;
      if (sp.status === 'fulfilled' && sp.value) setSpPlaylists(sp.value as SpotifyPlaylist[]);
      if (sc2.status === 'fulfilled' && sc2.value) setScPlaylists(sc2.value as SoundCloudPlaylist[]);
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allOptions = useMemo<PlaylistOption[]>(() => {
    const opts: PlaylistOption[] = [];
    if (spotify.isConnected) {
      opts.push({ sourceId: 'liked', name: 'Liked Songs', service: 'spotify', trackCount: 0, isLikes: true });
      spPlaylists.forEach(pl => opts.push({
        sourceId: pl.id, name: pl.name, artwork: pl.images[0]?.url,
        service: 'spotify', trackCount: pl.tracks.total,
      }));
    }
    if (sc.isConnected) {
      opts.push({ sourceId: 'liked', name: 'Liked Tracks', service: 'soundcloud', trackCount: 0, isLikes: true });
      scPlaylists.forEach(pl => opts.push({
        sourceId: String(pl.id), name: pl.title, artwork: pl.artwork_url ?? undefined,
        service: 'soundcloud', trackCount: pl.track_count,
      }));
    }
    return opts;
  }, [spotify.isConnected, sc.isConnected, spPlaylists, scPlaylists]);

  const recents = useMemo(() => allOptions.slice(0, 6), [allOptions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allOptions;
    const q = search.toLowerCase();
    return allOptions.filter(o => o.name.toLowerCase().includes(q));
  }, [allOptions, search]);

  function toggle(opt: PlaylistOption) {
    if (isOra(opt.service, opt.sourceId)) {
      const hit = oras.find(o => o.service === opt.service && o.sourceId === opt.sourceId);
      if (hit) removeOra(hit.id);
    } else {
      addOra({ name: opt.name, artwork: opt.artwork, service: opt.service, sourceId: opt.sourceId, trackCount: opt.trackCount });
    }
  }

  const connected = spotify.isConnected || sc.isConnected;

  return createPortal(
    <div className="modal-overlay aom-overlay" onClick={onClose}>
      <div className="modal add-ora-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="aom-header">
          <div>
            <p className="aom-eyebrow">Shufora Board</p>
            <h2 className="aom-title">Add Ora</h2>
          </div>
          <button className="aom-close" onClick={onClose} type="button" aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Search */}
        <div className="aom-search-wrap">
          <Search size={14} strokeWidth={2} className="aom-search-icon" />
          <input
            className="aom-search"
            type="text"
            placeholder="Search playlists…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button className="aom-search-clear" onClick={() => setSearch('')} type="button">
              <X size={13} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {!connected ? (
          <div className="aom-empty-state">
            <Music size={40} strokeWidth={1} />
            <p>Connect a music account in Settings to add Oras.</p>
          </div>
        ) : loading ? (
          <div className="aom-loading">
            <div className="aom-spinner" />
            <span>Loading your library…</span>
          </div>
        ) : (
          <div className="aom-body">

            {/* Recents row — hidden when searching */}
            {!search && recents.length > 0 && (
              <div className="aom-section">
                <span className="aom-section-label">Recents</span>
                <div className="aom-tiles">
                  {recents.map(opt => {
                    const added = isOra(opt.service, opt.sourceId);
                    return (
                      <button
                        key={`${opt.service}-${opt.sourceId}`}
                        className={`aom-tile${added ? ' aom-tile--added' : ''}`}
                        onClick={() => toggle(opt)}
                        type="button"
                        title={opt.name}
                      >
                        <div className="aom-tile-art">
                          {opt.artwork
                            ? <img src={opt.artwork} alt={opt.name} />
                            : opt.isLikes
                              ? <Heart size={20} strokeWidth={1.5} />
                              : <Music size={20} strokeWidth={1.5} />}
                          {added && (
                            <div className="aom-tile-check">
                              <Check size={13} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <ServiceDot service={opt.service} />
                        <span className="aom-tile-name">{opt.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full list */}
            <div className="aom-section">
              <span className="aom-section-label">{search ? 'Results' : 'All Playlists'}</span>
              <div className="aom-list">
                {filtered.length === 0 && (
                  <p className="aom-empty">No playlists match your search.</p>
                )}
                {filtered.map(opt => {
                  const added = isOra(opt.service, opt.sourceId);
                  return (
                    <div key={`${opt.service}-${opt.sourceId}`} className={`aom-row${added ? ' aom-row--added' : ''}`}>
                      <div className="aom-row-art">
                        {opt.artwork
                          ? <img src={opt.artwork} alt={opt.name} />
                          : <div className="aom-row-art-ph">
                              {opt.isLikes ? <Heart size={16} strokeWidth={1.5} /> : <Music size={16} strokeWidth={1.5} />}
                            </div>}
                      </div>
                      <div className="aom-row-info">
                        <span className="aom-row-name">{opt.name}</span>
                        <span className="aom-row-sub">
                          {opt.trackCount > 0 ? `${opt.trackCount} tracks · ` : ''}
                          {opt.service === 'spotify' ? 'Spotify' : 'SoundCloud'}
                        </span>
                      </div>
                      <button
                        className={`aom-row-btn${added ? ' aom-row-btn--added' : ''}`}
                        onClick={() => toggle(opt)}
                        type="button"
                        title={added ? 'Remove from board' : 'Add to board'}
                      >
                        {added ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default AddOraModal;
