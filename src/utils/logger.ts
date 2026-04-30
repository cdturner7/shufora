import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  id: string;
  ts: string;
  level: LogLevel;
  source: string;
  message: string;
  data?: string;
}

const MAX_SESSION = 500;
let _buf: LogEntry[] = [];
let _uid: string | null = null;
const _listeners = new Set<() => void>();

let _idCounter = 0;
function makeId(): string {
  return `${Date.now().toString(36)}-${(++_idCounter).toString(36)}`;
}

function notify() {
  _listeners.forEach((fn) => fn());
}

export function setLoggerUid(uid: string | null): void {
  _uid = uid;
}

export function subscribe(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

export function getSessionLogs(): readonly LogEntry[] {
  return _buf;
}

export function clearSessionLogs(): void {
  _buf = [];
  notify();
}

export function log(level: LogLevel, source: string, message: string, data?: unknown): LogEntry {
  const entry: LogEntry = {
    id: makeId(),
    ts: new Date().toISOString(),
    level,
    source,
    message,
    data: data !== undefined
      ? (typeof data === 'string' ? data : JSON.stringify(data, null, 2))
      : undefined,
  };

  const consoleFn =
    level === 'error' ? console.error :
    level === 'warn'  ? console.warn  :
    level === 'debug' ? console.debug :
    console.log;
  consoleFn(`[${source}] ${message}`, ...(data !== undefined ? [data] : []));

  _buf.push(entry);
  if (_buf.length > MAX_SESSION) _buf = _buf.slice(-MAX_SESSION);
  notify();

  if (db && _uid && level !== 'debug') {
    addDoc(collection(db, 'users', _uid, '_logs'), {
      id: entry.id,
      ts: entry.ts,
      level: entry.level,
      source: entry.source,
      message: entry.message,
      ...(entry.data !== undefined ? { data: entry.data } : {}),
    }).catch(() => {});
  }

  return entry;
}

export const logger = {
  error: (source: string, msg: string, data?: unknown) => log('error', source, msg, data),
  warn:  (source: string, msg: string, data?: unknown) => log('warn',  source, msg, data),
  info:  (source: string, msg: string, data?: unknown) => log('info',  source, msg, data),
  debug: (source: string, msg: string, data?: unknown) => log('debug', source, msg, data),
};
