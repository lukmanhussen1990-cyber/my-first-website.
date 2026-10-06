/*
 * Account security (device-local).
 *
 * - Passwords are never stored. We keep a PBKDF2-HMAC-SHA256 hash
 *   (600,000 iterations, 16-byte random salt, 256-bit output) via WebCrypto.
 * - Hash comparison is constant-time.
 * - Wrong-password and unknown-user failures return the same generic error.
 * - Repeated failures lock the account with exponential back-off.
 * - Sessions use a random 256-bit token. Only its SHA-256 is stored in the
 *   database; the raw token lives in localStorage ("remember me") or
 *   sessionStorage, and it expires (30 days / 12 hours).
 *
 * There is no server: accounts live on this device. To sync across devices,
 * replace this module with a backend implementing the same exports.
 */
import {
  getAccountById,
  getAccountByUsername,
  insertAccount,
  putAccount,
  removeAccount,
  deleteProgress,
  type AccountRecord,
} from './db';

export const GUEST_ID = 'guest';

const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;
const MAX_FAILS_BEFORE_LOCK = 5;
const LOCK_BASE_MS = 30_000;
const LOCK_MAX_MS = 15 * 60_000;
const REMEMBER_MS = 30 * 24 * 3600_000;
const SHORT_MS = 12 * 3600_000;
const MAX_SESSIONS = 5;

const SESSION_KEY = 'bt.session';
const GUEST_KEY = 'bt.guest';

export interface AccountPublic {
  id: string;
  username: string;
  createdAt: number;
}

export type AuthErrorCode =
  | 'INVALID_USERNAME'
  | 'WEAK_PASSWORD'
  | 'USERNAME_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'LOCKED'
  | 'INSECURE_CONTEXT';

export class AuthError extends Error {
  code: AuthErrorCode;
  retryAfterMs?: number;
  constructor(code: AuthErrorCode, message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

/* ── Validation ───────────────────────────────────────────────── */

const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

/** Returns an error message, or null when valid. */
export function validateUsername(u: string): string | null {
  if (!u.trim()) return 'Choose a player name.';
  if (!USERNAME_RE.test(u)) return '3–16 characters: letters, numbers or underscore.';
  return null;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too weak' | 'Weak' | 'Fair' | 'Strong' | 'Excellent';
  issues: string[];
  acceptable: boolean;
}

export function passwordStrength(pw: string, username = ''): PasswordStrength {
  const issues: string[] = [];
  if (pw.length < 8) issues.push('At least 8 characters');
  if (!/[a-zA-Z]/.test(pw)) issues.push('Include a letter');
  if (!/\d/.test(pw)) issues.push('Include a number');
  if (username && pw.toLowerCase().includes(username.toLowerCase())) issues.push('Must not contain your player name');
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  if (issues.length) score = Math.min(score, 1);
  const labels = ['Too weak', 'Weak', 'Fair', 'Strong', 'Excellent'] as const;
  const s = Math.min(4, score) as PasswordStrength['score'];
  return { score: s, label: labels[s], issues, acceptable: issues.length === 0 };
}

/* ── Crypto helpers ───────────────────────────────────────────── */

function subtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new AuthError(
      'INSECURE_CONTEXT',
      'Secure accounts need HTTPS (or localhost). Open the app over a secure connection.',
    );
  }
  return globalThis.crypto.subtle;
}

function toB64u(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64u(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await subtle().importKey('raw', new TextEncoder().encode(password.normalize('NFKC')), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, HASH_BITS);
  return new Uint8Array(bits);
}

async function sha256(s: string): Promise<string> {
  return toB64u(await subtle().digest('SHA-256', new TextEncoder().encode(s)));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function newId(): string {
  return toB64u(randomBytes(12));
}

function usernameKey(u: string): string {
  return u.trim().toLowerCase();
}

function toPublic(a: AccountRecord): AccountPublic {
  return { id: a.id, username: a.username, createdAt: a.createdAt };
}

/* ── Storage of the client-side session token ─────────────────── */

interface StoredSession {
  accountId: string;
  token: string;
}

function readStoredSession(): StoredSession | null {
  for (const store of [safeStorage('local'), safeStorage('session')]) {
    const raw = store?.getItem(SESSION_KEY);
    if (!raw) continue;
    try {
      const v = JSON.parse(raw) as StoredSession;
      if (typeof v.accountId === 'string' && typeof v.token === 'string') return v;
    } catch {
      /* corrupted — ignore */
    }
  }
  return null;
}

function clearStoredSession() {
  safeStorage('local')?.removeItem(SESSION_KEY);
  safeStorage('session')?.removeItem(SESSION_KEY);
}

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

async function openSession(acc: AccountRecord, remember: boolean): Promise<void> {
  const token = toB64u(randomBytes(32));
  const now = Date.now();
  acc.sessions = [
    { tokenHash: await sha256(token), createdAt: now, expiresAt: now + (remember ? REMEMBER_MS : SHORT_MS) },
    ...acc.sessions.filter((s) => s.expiresAt > now),
  ].slice(0, MAX_SESSIONS);
  await putAccount(acc);
  clearStoredSession();
  safeStorage(remember ? 'local' : 'session')?.setItem(SESSION_KEY, JSON.stringify({ accountId: acc.id, token }));
  safeStorage('local')?.removeItem(GUEST_KEY);
}

/* ── Public API ───────────────────────────────────────────────── */

export async function registerAccount(username: string, password: string): Promise<AccountPublic> {
  const name = username.trim();
  const uErr = validateUsername(name);
  if (uErr) throw new AuthError('INVALID_USERNAME', uErr);
  const strength = passwordStrength(password, name);
  if (!strength.acceptable) throw new AuthError('WEAK_PASSWORD', strength.issues[0]);

  const key = usernameKey(name);
  if (await getAccountByUsername(key)) throw new AuthError('USERNAME_TAKEN', 'That player name is already taken.');

  const salt = randomBytes(SALT_BYTES);
  const hash = await pbkdf2(password, salt, ITERATIONS);
  const rec: AccountRecord = {
    id: newId(),
    username: name,
    usernameKey: key,
    algo: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: toB64u(salt),
    hash: toB64u(hash),
    createdAt: Date.now(),
    failedAttempts: 0,
    lockedUntil: 0,
    sessions: [],
  };
  try {
    await insertAccount(rec);
  } catch {
    throw new AuthError('USERNAME_TAKEN', 'That player name is already taken.');
  }
  await openSession(rec, true);
  return toPublic(rec);
}

export async function login(username: string, password: string, remember: boolean): Promise<AccountPublic> {
  const key = usernameKey(username);
  const acc = await getAccountByUsername(key);
  const now = Date.now();

  if (!acc) {
    // Spend comparable time so an unknown name isn't distinguishable by timing.
    await pbkdf2(password, randomBytes(SALT_BYTES), ITERATIONS);
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid player name or password.');
  }
  if (acc.lockedUntil > now) {
    throw new AuthError('LOCKED', 'Too many attempts. Try again shortly.', acc.lockedUntil - now);
  }

  const candidate = await pbkdf2(password, fromB64u(acc.salt), acc.iterations);
  if (!constantTimeEqual(candidate, fromB64u(acc.hash))) {
    acc.failedAttempts += 1;
    if (acc.failedAttempts >= MAX_FAILS_BEFORE_LOCK) {
      const exp = acc.failedAttempts - MAX_FAILS_BEFORE_LOCK;
      acc.lockedUntil = now + Math.min(LOCK_MAX_MS, LOCK_BASE_MS * 2 ** exp);
    }
    await putAccount(acc);
    if (acc.lockedUntil > now) {
      throw new AuthError('LOCKED', 'Too many attempts. Try again shortly.', acc.lockedUntil - now);
    }
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid player name or password.');
  }

  acc.failedAttempts = 0;
  acc.lockedUntil = 0;
  await openSession(acc, remember);
  return toPublic(acc);
}

/** Resolve the signed-in account from the stored session token, if valid. */
export async function restoreSession(): Promise<AccountPublic | null> {
  const stored = readStoredSession();
  if (!stored) return null;
  try {
    const acc = await getAccountById(stored.accountId);
    if (!acc) {
      clearStoredSession();
      return null;
    }
    const h = await sha256(stored.token);
    const now = Date.now();
    const ok = acc.sessions.some((s) => s.tokenHash === h && s.expiresAt > now);
    if (!ok) {
      clearStoredSession();
      return null;
    }
    return toPublic(acc);
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  const stored = readStoredSession();
  clearStoredSession();
  safeStorage('local')?.removeItem(GUEST_KEY);
  if (!stored) return;
  const acc = await getAccountById(stored.accountId);
  if (!acc) return;
  const h = await sha256(stored.token);
  acc.sessions = acc.sessions.filter((s) => s.tokenHash !== h);
  await putAccount(acc);
}

/** Permanently delete an account and its progress after re-checking the password. */
export async function deleteAccount(accountId: string, password: string): Promise<void> {
  const acc = await getAccountById(accountId);
  if (!acc) throw new AuthError('INVALID_CREDENTIALS', 'Account not found.');
  const candidate = await pbkdf2(password, fromB64u(acc.salt), acc.iterations);
  if (!constantTimeEqual(candidate, fromB64u(acc.hash))) {
    throw new AuthError('INVALID_CREDENTIALS', 'Incorrect password.');
  }
  await removeAccount(acc.usernameKey);
  await deleteProgress(acc.id);
  clearStoredSession();
}

/* ── Guest mode ───────────────────────────────────────────────── */

export function startGuest(): void {
  clearStoredSession();
  safeStorage('local')?.setItem(GUEST_KEY, '1');
}

export function isGuestActive(): boolean {
  return safeStorage('local')?.getItem(GUEST_KEY) === '1';
}
