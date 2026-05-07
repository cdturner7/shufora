import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

let _uid: string | null = null;

export function setLoggerUid(uid: string | null): void {
  _uid = uid;
}

function log(level: LogLevel, source: string, message: string, data?: unknown): void {
  const consoleFn =
    level === 'error' ? console.error :
    level === 'warn'  ? console.warn  :
    level === 'debug' ? console.debug :
    console.log;
  consoleFn(`[${source}] ${message}`, ...(data !== undefined ? [data] : []));

  if (db && _uid && level !== 'debug') {
    addDoc(collection(db, 'users', _uid, '_logs'), {
      ts: new Date().toISOString(),
      level,
      source,
      message,
      ...(data !== undefined ? { data: typeof data === 'string' ? data : JSON.stringify(data, null, 2) } : {}),
    }).catch(() => {});
  }
}

export const logger = {
  error: (source: string, msg: string, data?: unknown) => log('error', source, msg, data),
  warn:  (source: string, msg: string, data?: unknown) => log('warn',  source, msg, data),
  info:  (source: string, msg: string, data?: unknown) => log('info',  source, msg, data),
  debug: (source: string, msg: string, data?: unknown) => log('debug', source, msg, data),
};
