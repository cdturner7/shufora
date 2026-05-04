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

  // playSingleRef always points to the latest playSingle so that callbacks
  // with empty deps (handleAutoNext, next, previous) never capture stale
  // Spotify / SC context values.
  const playSingleRef = useRef<((track: Track) => Promise<void>) | null>(null);

  // ── Sync Spotify SDK state ────────────────────────────────────────────────

  useEffect(() => {
    const state = spotify.playerState;
    if (!state) return;
    const t = state.track_window.current_track;
    if (t) {
      if (t.uri !== prevSpTrackUri.current) {
        prevSpTrackUri.current = t.uri;
        maxSpPosition.current = 0;
        autoNextFired.current = false;
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
  // latest spotify / sc / volume refs. playSingleRef.current always points
  // here so all stable callbacks get the fresh version.

  async function playSingle(track: Track) {
    setCurrentTrack(track);
    setPosition(0);

    if (track.service === 'spotify') {
      if (sc.audio) { sc.audio.pause(); sc.audio.src = ''; }
      await spotify.play([track.uri]);
    } else {
      if (spotify.isReady) await spotify.pause();
      const audio = sc.audio;
      if (!audio) return;
      audio.src = track.streamUrl ?? '';
      audio.volume = volumeRef.current;
      await audio.play().catch(() => {});
    }
  }
  playSingleRef.current = playSingle;

  // ── Advance to next track in queue (used by auto-next) ────────────────────
  // Stable ref — uses only refs internally so it never goes stale.

  const advanceQueue = useCallback(() => {
    const nextIndex = queueIndexRef.current + 1;
    if (nextIndex < queueRef.current.length) {
      setQueueIndex(nextIndex);
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

  // Populate the queue and show the first track without starting playback.
  // Used for auto-loading the board queue on login so the user just hits play.
  const loadQueue = useCallback((tracks: Track[], index = 0) => {
    if (tracks.length === 0) return;
    setQueue(tracks);
    setQueueIndex(index);
    setCurrentTrack(tracks[index]);
    queueRef.current = tracks;
    queueIndexRef.current = index;
  }, []);

  const pause = useCallback(async () => {
    if (currentTrackRef.current?.service === 'spotify') await spotify.pause();
    else sc.audio?.pause();
  }, [spotify, sc]);

  const resume = useCallback(async () => {
    if (currentTrackRef.current?.service === 'spotify') {
      // If nothing is loaded in the Spotify SDK (e.g. queue was pre-populated via
      // loadQueue without actually starting playback), fall back to a REST play call.
      if (spotify.playerState) {
        await spotify.resume();
      } else {
        const uri = currentTrackRef.current?.uri;
        if (uri) await spotify.play([uri]);
      }
    } else {
      await sc.audio?.play();
    }
  }, [spotify, sc]);

  const togglePlay = useCallback(async () => {
    if (isPlaying) await pause();
    else await resume();
  }, [isPlaying, pause, resume]);

  // next / previous / skipToIndex use only refs — no stale closure risk.

  const next = useCallback(async () => {
    const nextIndex = queueIndexRef.current + 1;
    if (nextIndex < queueRef.current.length) {
      setQueueIndex(nextIndex);
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
    playSingleRef.current?.(queueRef.current[index]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const removeFromQueue = useCallback((absoluteIndex: number) => {
    setQueue(prev => {
      if (absoluteIndex < 0 || absoluteIndex >= prev.length) return prev;
      const next = [...prev];
      next.splice(absoluteIndex, 1);
      queueRef.current = next;
      // If removed track was before current, shift current index down
      if (absoluteIndex < queueIndexRef.current) {
        const newIdx = queueIndexRef.current - 1;
        setQueueIndex(newIdx);
        queueIndexRef.current = newIdx;
      }
      return next;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reorderQueue = useCallback((fromAbsolute: number, toAbsolute: number) => {
    if (fromAbsolute === toAbsolute) return;
    setQueue(prev => {
      const next = [...prev];
      const [item] = next.splice(fromAbsolute, 1);
      next.splice(toAbsolute, 0, item);
      queueRef.current = next;
      return next;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const appendToQueue = useCallback((tracks: Track[]) => {
    setQueue(prev => {
      const next = [...prev, ...tracks];
      queueRef.current = next;
      return next;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Removes upcoming tracks (after current) matching predicate — history is untouched.
  const removeFromQueueWhere = useCallback((predicate: (track: Track) => boolean) => {
    setQueue(prev => {
      const currentIdx = queueIndexRef.current;
      const history = prev.slice(0, currentIdx + 1);
      const upcoming = prev.slice(currentIdx + 1).filter(t => !predicate(t));
      const next = [...history, ...upcoming];
      queueRef.current = next;
      return next;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    volumeRef.current = v;
    if (sc.audio) sc.audio.volume = v;
    spotify.setVolume(v).catch(() => {});
  }, [spotify, sc]);

  return (
    <PlayerContext.Provider value={{
      currentTrack, queue, queueIndex, isPlaying, position, duration, volume,
      play, loadQueue, pause, resume, togglePlay, next, previous, seek, setVolume, skipToIndex, removeFromQueue, reorderQueue, appendToQueue, removeFromQueueWhere,
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
