/*
 * Local persistence (IndexedDB via `idb`).
 *
 * Two object stores:
 *   accounts — credential records keyed by the normalised username
 *   progress — PlayerProgress keyed by account id ("guest" for guest play)
 *
 * If IndexedDB is unavailable (some private-browsing modes) we fall back to an
 * in-memory store so the app still works for the current session.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PlayerProgress } from '../data/types';

export interface SessionRecord {
  /** SHA-256 of the session token, base64url. The raw token never touches the DB. */
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
}

export interface AccountRecord {
  id: string;
  username: string; // as typed (display)
  usernameKey: string; // lower-cased lookup key
  algo: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // base64url
  hash: string; // base64url
  createdAt: number;
  failedAttempts: number;
  lockedUntil: number;
  sessions: SessionRecord[];
}

interface BorderTrialsDB extends DBSchema {
  accounts: {
    key: string;
    value: AccountRecord;
    indexes: { byId: string };
  };
  progress: {
    key: string;
    value: PlayerProgress;
  };
}

const DB_NAME = 'border-trials';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BorderTrialsDB> | null> | null = null;
const memory = {
  accounts: new Map<string, AccountRecord>(),
  progress: new Map<string, PlayerProgress>(),
};

function db(): Promise<IDBPDatabase<BorderTrialsDB> | null> {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        // even reading `indexedDB` can throw in locked-down frames
        if (typeof indexedDB === 'undefined' || !indexedDB) return null;
        return await openDB<BorderTrialsDB>(DB_NAME, DB_VERSION, {
          upgrade(d) {
            const accounts = d.createObjectStore('accounts', { keyPath: 'usernameKey' });
            accounts.createIndex('byId', 'id', { unique: true });
            d.createObjectStore('progress');
          },
        });
      } catch (err) {
        console.warn('[border-trials] IndexedDB unavailable, using memory store', err);
        return null;
      }
    })();
  }
  return dbPromise;
}

/* ── Accounts ─────────────────────────────────────────────────── */

export async function getAccountByUsername(usernameKey: string): Promise<AccountRecord | undefined> {
  const d = await db();
  return d ? d.get('accounts', usernameKey) : memory.accounts.get(usernameKey);
}

export async function getAccountById(id: string): Promise<AccountRecord | undefined> {
  const d = await db();
  if (d) return d.getFromIndex('accounts', 'byId', id);
  return [...memory.accounts.values()].find((a) => a.id === id);
}

/** Insert a new account; rejects if the username key already exists. */
export async function insertAccount(rec: AccountRecord): Promise<void> {
  const d = await db();
  if (d) {
    await d.add('accounts', rec); // add() throws ConstraintError on duplicates
    return;
  }
  if (memory.accounts.has(rec.usernameKey)) throw new DOMException('exists', 'ConstraintError');
  memory.accounts.set(rec.usernameKey, structuredClone(rec));
}

export async function putAccount(rec: AccountRecord): Promise<void> {
  const d = await db();
  if (d) await d.put('accounts', rec);
  else memory.accounts.set(rec.usernameKey, structuredClone(rec));
}

export async function removeAccount(usernameKey: string): Promise<void> {
  const d = await db();
  if (d) await d.delete('accounts', usernameKey);
  else memory.accounts.delete(usernameKey);
}

/* ── Progress ─────────────────────────────────────────────────── */

export async function loadProgress(accountId: string): Promise<PlayerProgress | undefined> {
  const d = await db();
  const p = d ? await d.get('progress', accountId) : memory.progress.get(accountId);
  return p ? structuredClone(p) : undefined;
}

export async function saveProgress(accountId: string, p: PlayerProgress): Promise<void> {
  const d = await db();
  if (d) await d.put('progress', p, accountId);
  else memory.progress.set(accountId, structuredClone(p));
}

export async function deleteProgress(accountId: string): Promise<void> {
  const d = await db();
  if (d) await d.delete('progress', accountId);
  else memory.progress.delete(accountId);
}

export async function isPersistent(): Promise<boolean> {
  return (await db()) !== null;
}
