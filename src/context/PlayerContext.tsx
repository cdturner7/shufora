import {
  createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode,
} from 'react';
import { useSpotify } from './SpotifyContext';
import { useSoundCloud } from './SoundCloudContext';
import type { SpotifyTrack } from '../lib/spotify';
import type { SoundCloudTrack } from '../lib/soundcloud';

// ── Unified track type ────────────────────────────────────────────────────────

export interface Track {
  id: string;
  service: 'spotify' | 'soundcloud';
  title: string;
  artist: string;
  album: string;
  duration: number;  // ms
  artwork: string;
  uri: string;       // spotify:track:xxx  OR  SC track ID as string
  streamUrl?: string;
  source?: string;   // display label — e.g. ora/playlist name
  oraId?: string;    // which board ora this track belongs to
}

export function trackFromSpotify(t: SpotifyTrack): Track {
  return {
    id: t.id,
    service: 'spotify',
    title: t.name,
    artist: t.artists.map(a => a.name).join(', '),
    album: t.album.name,
    duration: t.duration_ms,
    artwork: t.album.images[0]?.url ?? '',
    uri: t.uri,
  };
}

export function trackFromSoundCloud(t: SoundCloudTrack, streamUrl: string, artwork: string): Track {
  return {
    id: String(t.id),
    service: 'soundcloud',
    title: t.title,
    artist: t.user.username,
    album: '',
    duration: t.duration,
    artwork,
    uri: String(t.id),
    streamUrl,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Collects all contiguous Spotify track URIs starting at fromIndex.
// Returns the URIs and the index of the last track in the batch.
function buildSpotifyBatch(
  queue: Track[],
  fromIndex: number,
): { uris: string[]; batchEnd: number } {
  const uris: string[] = [];
  let i = fromIndex;
  while (i < queue.length && queue[i].service === 'spotify') {
    uris.push(queue[i].uri);
    i++;
  }
  return { uris, batchEnd: i - 1 };
}

// ── Context types ─────────────────────────────────────────────────────────────

interface PlayerContextValue {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  position: number;    // ms
  duration: number;    // ms
  volume: number;      // 0–1
  play: (track: Track, queue?: Track[], index?: number) => Promise<void>;
  loadQueue: (tracks: Track[], index?: number) => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  setVolume: (v: number) => void;
  skipToIndex: (index: number) => void;
  removeFromQueue: (absoluteIndex: number) => void;
  reorderQueue: (fromAbsolute: number, toAbsolute: number) => void;
  appendToQueue: (tracks: Track[]) => void;
  removeFromQueueWhere: (predicate: (track: Track) => boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function PlayerProvider({ children }: { children: ReactNode }) {
  const spotify = useSpotify();
  const sc = useSoundCloud();

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.7);

  const positionTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevSpTrackUri = useRef<string | null>(null);
  const maxSpPosition = useRef(0);
  const autoNextFired = useRef(false);
  // Last queue index included in the active Spotify batch (-1 = no batch).
  const spotifyBatchEndRef = useRef(-1);

  // Refs that always point to current values — used by stable callbacks to
  // avoid stale closure bugs.
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const positionRef = useRef(position);
  const volumeRef = useRef(volume);
  const currentTrackRef = useRef(currentTrack);
  queueRef.current = queue;
  queueIndexRef.current = queueIndex;
  positionRef.current = position;
  volumeRef.current = volume;
  currentTrackRef.current = currentTrack;

  // playSingleRef always points to the latest playSingle so that stable
  // callbacks (advanceQueue, next, previous) never capture stale context values.
  const playSingleRef = useRef<((track: Track) => Promise<void>) | null>(null);

  // ── Sync Spotify SDK state ────────────────────────────────────────────────

  useEffect(() => {
    const state = spotify.playerState;
    if (!state) return;
    const t = state.track_window.current_track;
    if (!t) return;

    // URI changed → Spotify advanced to the next track within the batch.
    // Sync queueIndex by finding the new URI in the Shufora queue.
    if (t.uri !== prevSpTrackUri.current) {
      prevSpTrackUri.current = t.uri;
      maxSpPosition.current = 0;
      autoNextFired.current = false;

      // Search from current index onward so duplicate URIs in the queue resolve correctly.
      const newIdx = queueRef.current.findIndex(
        (track, i) => i >= queueIndexRef.current && track.service === 'spotify' && track.uri === t.uri,
      );
      if (newIdx !== -1 && newIdx !== queueIndexRef.current) {
        setQueueIndex(newIdx);
        queueIndexRef.current = newIdx;
      }

      setCurrentTrack({
        id: t.id,
        service: 'spotify',
        title: t.name,
        artist: t.artists.map((a: { name: string }) => a.name).join(', '),
        album: t.album.name,
        duration: state.duration,
        artwork: t.album.images[0]?.url ?? '',
        uri: t.uri,
      });
      setDuration(state.duration);
    }

    // Batch-end detection: Spotify went silent (paused at position 0) after
    // playing for at least 5 s — the final track in the batch finished.
    // advanceQueue handles the transition to a SoundCloud track (or stops).
    if (!state.paused) maxSpPosition.current = Math.max(maxSpPosition.current, state.position);
    if (state.paused && state.position === 0 && maxSpPosition.current > 5000 && !autoNextFired.current) {
      autoNextFired.current = true;
      advanceQueue();
    }

    setIsPlaying(!state.paused);
    setPosition(state.position);
  }, [spotify.playerState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SoundCloud Audio events ───────────────────────────────────────────────

  useEffect(() => {
    const audio = sc.audio;
    if (!audio) return;

    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => { setIsPlaying(false); advanceQueue(); };
    const onTime  = () => setPosition(audio.currentTime * 1000);
    const onMeta  = () => setDuration(audio.duration * 1000);

    audio.addEventListener('play',           onPlay);
    audio.addEventListener('pause',          onPause);
    audio.addEventListener('ended',          onEnded);
    audio.addEventListener('timeupdate',     onTime);
    audio.addEventListener('loadedmetadata', onMeta);

    return () => {
      audio.removeEventListener('play',           onPlay);
      audio.removeEventListener('pause',          onPause);
      audio.removeEventListener('ended',          onEnded);
      audio.removeEventListener('timeupdate',     onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
    };
  }, [sc.audio]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Position polling for Spotify ──────────────────────────────────────────

  useEffect(() => {
    if (positionTimer.current) clearInterval(positionTimer.current);
    if (isPlaying && currentTrack?.service === 'spotify') {
      positionTimer.current = setInterval(() => {
        setPosition(p => Math.min(p + 500, duration));
      }, 500);
    }
    return () => { if (positionTimer.current) clearInterval(positionTimer.current); };
  }, [isPlaying, currentTrack?.service, duration]);

  // ── Core play dispatch ────────────────────────────────────────────────────
  // Not a useCallback — recreated every render so it always captures the
  // latest spotify / sc / volume context. playSingleRef.current always points
  // here so stable callbacks always get the fresh version.

  async function playSingle(track: Track) {
    setCurrentTrack(track);
    setPosition(0);

    if (track.service === 'spotify') {
      if (sc.audio) { sc.audio.pause(); sc.audio.src = ''; }
      // Send the entire contiguous Spotify segment starting at the current index.
      // Spotify handles natural track-to-track advance within this batch —
      // no further play() calls needed until we hit a SoundCloud track or the end.
      const { uris, batchEnd } = buildSpotifyBatch(queueRef.current, queueIndexRef.current);
      spotifyBatchEndRef.current = batchEnd;
      prevSpTrackUri.current = null; // reset so URI-sync fires on first SDK event
      maxSpPosition.current = 0;
      autoNextFired.current = false;
      await spotify.play(uris);
    } else {
      if (spotify.isReady) await spotify.pause();
      spotifyBatchEndRef.current = -1;
      const audio = sc.audio;
      if (!audio) return;
      audio.src = track.streamUrl ?? '';
      audio.volume = volumeRef.current;
      await audio.play().catch(() => {});
    }
  }
  playSingleRef.current = playSingle;

  // ── Re-sync Spotify batch after a queue mutation ──────────────────────────
  // Re-sends the updated URI list from the current track onward so Spotify's
  // internal queue matches the Shufora queue. The current track briefly
  // restarts then seeks back — imperceptible in practice.

  const resyncSpotifyBatch = useCallback(async () => {
    const cur = currentTrackRef.current;
    if (!cur || cur.service !== 'spotify') return;
    const { uris, batchEnd } = buildSpotifyBatch(queueRef.current, queueIndexRef.current);
    if (uris.length === 0) return;
    const savedPosition = positionRef.current;
    spotifyBatchEndRef.current = batchEnd;
    prevSpTrackUri.current = null;
    maxSpPosition.current = 0;
    autoNextFired.current = false;
    await spotify.play(uris);
    setTimeout(() => spotify.seek(savedPosition).catch(() => {}), 400);
  }, [spotify]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Advance to next track in queue ───────────────────────────────────────

  const advanceQueue = useCallback(() => {
    const nextIndex = queueIndexRef.current + 1;
    if (nextIndex < queueRef.current.length) {
      setQueueIndex(nextIndex);
      queueIndexRef.current = nextIndex;
      playSingleRef.current?.(queueRef.current[nextIndex]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public controls ───────────────────────────────────────────────────────

  const play = useCallback(async (track: Track, newQueue?: Track[], index = 0) => {
    if (newQueue) {
      setQueue(newQueue);
      setQueueIndex(index);
      queueRef.current = newQueue;
      queueIndexRef.current = index;
    }
    await playSingleRef.current?.(track);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate the queue without starting playback.
  // Only updates currentTrack when nothing is already playing — so reshuffling
  // while a song is playing never changes the "Now Playing" display.
  const loadQueue = useCallback((tracks: Track[], index = 0) => {
    if (tracks.length === 0) return;
    setQueue(tracks);
    setQueueIndex(index);
    queueRef.current = tracks;
    queueIndexRef.current = index;
    if (!currentTrackRef.current) {
      setCurrentTrack(tracks[index]);
    }
  }, []);

  const pause = useCallback(async () => {
    if (currentTrackRef.current?.service === 'spotify') await spotify.pause();
    else sc.audio?.pause();
  }, [spotify, sc]);

  const resume = useCallback(async () => {
    if (currentTrackRef.current?.service === 'spotify') {
      if (spotify.playerState) {
        await spotify.resume();
      } else {
        // No active Spotify state (e.g. queue pre-loaded via loadQueue without
        // starting playback) — send the full batch from the current position.
        const { uris, batchEnd } = buildSpotifyBatch(queueRef.current, queueIndexRef.current);
        if (uris.length > 0) {
          spotifyBatchEndRef.current = batchEnd;
          prevSpTrackUri.current = null;
          await spotify.play(uris);
        }
      }
    } else {
      await sc.audio?.play();
    }
  }, [spotify, sc]);

  const togglePlay = useCallback(async () => {
    if (isPlaying) await pause();
    else await resume();
  }, [isPlaying, pause, resume]);

  // next / previous / skipToIndex update queueIndexRef BEFORE calling playSingle
  // so the batch is built from the correct starting index.

  const next = useCallback(async () => {
    const nextIndex = queueIndexRef.current + 1;
    if (nextIndex < queueRef.current.length) {
      setQueueIndex(nextIndex);
      queueIndexRef.current = nextIndex;
      await playSingleRef.current?.(queueRef.current[nextIndex]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const previous = useCallback(async () => {
    if (positionRef.current > 3000) {
      setPosition(0);
      if (currentTrackRef.current?.service === 'spotify') await spotify.seek(0);
      else if (sc.audio) sc.audio.currentTime = 0;
      return;
    }
    const prevIndex = queueIndexRef.current - 1;
    if (prevIndex >= 0) {
      setQueueIndex(prevIndex);
      queueIndexRef.current = prevIndex;
      await playSingleRef.current?.(queueRef.current[prevIndex]);
    }
  }, [spotify, sc]); // eslint-disable-line react-hooks/exhaustive-deps

  const seek = useCallback(async (ms: number) => {
    setPosition(ms);
    if (currentTrackRef.current?.service === 'spotify') await spotify.seek(ms);
    else if (sc.audio) sc.audio.currentTime = ms / 1000;
  }, [spotify, sc]);

  const skipToIndex = useCallback((index: number) => {
    if (index < 0 || index >= queueRef.current.length) return;
    setQueueIndex(index);
    queueIndexRef.current = index;
    playSingleRef.current?.(queueRef.current[index]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const removeFromQueue = useCallback((absoluteIndex: number) => {
    if (absoluteIndex < 0 || absoluteIndex >= queueRef.current.length) return;
    const next = [...queueRef.current];
    next.splice(absoluteIndex, 1);
    queueRef.current = next;

    if (absoluteIndex < queueIndexRef.current) {
      const newIdx = queueIndexRef.current - 1;
      setQueueIndex(newIdx);
      queueIndexRef.current = newIdx;
    }

    setQueue(next);

    // If the removed track was inside the active Spotify batch, update Spotify's queue.
    if (absoluteIndex > queueIndexRef.current && absoluteIndex <= spotifyBatchEndRef.current) {
      resyncSpotifyBatch();
    }
  }, [resyncSpotifyBatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const reorderQueue = useCallback((fromAbsolute: number, toAbsolute: number) => {
    if (fromAbsolute === toAbsolute) return;
    const next = [...queueRef.current];
    const [item] = next.splice(fromAbsolute, 1);
    next.splice(toAbsolute, 0, item);
    queueRef.current = next;
    setQueue(next);
    // No Spotify resync here — Spotify already has the full batch queued and will
    // play through it uninterrupted. URI-change detection keeps queueIndex in sync
    // as each track advances naturally.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const appendToQueue = useCallback((tracks: Track[]) => {
    const next = [...queueRef.current, ...tracks];
    queueRef.current = next;
    setQueue(next);
  }, []);

  // Removes upcoming tracks (after current) matching predicate — history is untouched.
  const removeFromQueueWhere = useCallback((predicate: (track: Track) => boolean) => {
    const currentIdx = queueIndexRef.current;
    const q = queueRef.current;
    const history = q.slice(0, currentIdx + 1);
    const upcoming = q.slice(currentIdx + 1).filter(t => !predicate(t));
    if (upcoming.length === q.length - currentIdx - 1) return; // nothing removed
    const next = [...history, ...upcoming];
    queueRef.current = next;
    setQueue(next);
    if (currentTrackRef.current?.service === 'spotify') resyncSpotifyBatch();
  }, [resyncSpotifyBatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    volumeRef.current = v;
    if (sc.audio) sc.audio.volume = v;
    spotify.setVolume(v).catch(() => {});
  }, [spotify, sc]);

  return (
    <PlayerContext.Provider value={{
      currentTrack, queue, queueIndex, isPlaying, position, duration, volume,
      play, loadQueue, pause, resume, togglePlay, next, previous, seek, setVolume,
      skipToIndex, removeFromQueue, reorderQueue, appendToQueue, removeFromQueueWhere,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
