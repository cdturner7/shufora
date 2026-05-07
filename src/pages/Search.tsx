import { useState, useCallback } from 'react';
import { Search as SearchIcon, ListPlus } from 'lucide-react';
import { useSpotify } from '../context/SpotifyContext';
import { usePlayer, trackFromSpotify } from '../context/PlayerContext';
import type { SpotifyTrack } from '../lib/spotify';
import './Search.css';

function Search() {
  const spotify = useSpotify();
  const player = usePlayer();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const tracks = await spotify.search(q);
      setResults(tracks);
    } finally {
      setLoading(false);
    }
  }, [spotify]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    run(q);
  }

  return (
    <div className="page search-page">
      <div className="search-bar-wrap">
        <SearchIcon className="search-bar-icon" size={18} strokeWidth={1.75} />
        <input
          className="search-bar-input"
          type="search"
          placeholder="Artists, songs, albums…"
          value={query}
          onChange={handleChange}
          autoFocus
        />
      </div>

      {loading && <p className="search-hint">Searching…</p>}

      {!loading && query && results.length === 0 && (
        <p className="search-hint">No results for "{query}"</p>
      )}

      {!loading && !query && (
        <p className="search-hint">Search for music across your connected services.</p>
      )}

      {results.length > 0 && (
        <ul className="search-results">
          {results.map((track) => (
            <li key={track.id} className="search-result-item"
              onClick={() => spotify.play([track.uri])}
            >
              <img
                className="search-result-art"
                src={track.album.images[0]?.url}
                alt={track.album.name}
              />
              <div className="search-result-info">
                <span className="search-result-name">{track.name}</span>
                <span className="search-result-artist">
                  {track.artists.map(a => a.name).join(', ')}
                </span>
              </div>
              <button
                className="search-result-queue-btn"
                onClick={e => { e.stopPropagation(); player.appendToQueue([trackFromSpotify(track)]); }}
                title="Add to queue"
                type="button"
              >
                <ListPlus size={16} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Search;
