// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Each test gets a fresh module graph + empty IndexedDB so accounts never
 * leak between tests.
 */
async function freshAuth() {
  vi.resetModules();
  indexedDB = new IDBFactory();
  localStorage.clear();
  sessionStorage.clear();
  return import('../services/auth');
}

describe('validation', () => {
  it('validates player names', async () => {
    const { validateUsername } = await freshAuth();
    expect(validateUsername('ab')).not.toBeNull();
    expect(validateUsername('has space')).not.toBeNull();
    expect(validateUsername('x'.repeat(17))).not.toBeNull();
    expect(validateUsername('Player_001')).toBeNull();
  });

  it('rejects weak passwords and passwords containing the name', async () => {
    const { passwordStrength } = await freshAuth();
    expect(passwordStrength('short1').acceptable).toBe(false);
    expect(passwordStrength('lettersonly').acceptable).toBe(false);
    expect(passwordStrength('12345678').acceptable).toBe(false);
    expect(passwordStrength('kaito2024x', 'Kaito').acceptable).toBe(false);
    expect(passwordStrength('Survive-The-City-9').acceptable).toBe(true);
    expect(passwordStrength('Survive-The-City-9').score).toBeGreaterThanOrEqual(3);
  });
});

describe('accounts', { timeout: 60_000 }, () => {
  let auth: Awaited<ReturnType<typeof freshAuth>>;
  beforeEach(async () => {
    auth = await freshAuth();
  });

  it('registers, stores only a salted hash, and restores the session', async () => {
    const acc = await auth.registerAccount('Kaito', 'Survive123!');
    expect(acc.username).toBe('Kaito');
    const { getAccountByUsername } = await import('../services/db');
    const rec = (await getAccountByUsername('kaito'))!;
    expect(JSON.stringify(rec)).not.toContain('Survive123!');
    expect(rec.iterations).toBeGreaterThanOrEqual(600_000);
    expect(rec.salt.length).toBeGreaterThan(10);
    expect(rec.sessions).toHaveLength(1);
    const stored = JSON.parse(localStorage.getItem('bt.session')!);
    expect(rec.sessions[0].tokenHash).not.toBe(stored.token); // only the hash is persisted
    expect((await auth.restoreSession())?.id).toBe(acc.id);
  });

  it('treats names case-insensitively and refuses duplicates', async () => {
    await auth.registerAccount('Kaito', 'Survive123!');
    await expect(auth.registerAccount('KAITO', 'Another123!')).rejects.toMatchObject({ code: 'USERNAME_TAKEN' });
    await auth.logout();
    await expect(auth.login('kaito', 'Survive123!', true)).resolves.toMatchObject({ username: 'Kaito' });
  });

  it('gives the same error for a wrong password and an unknown player', async () => {
    await auth.registerAccount('Kaito', 'Survive123!');
    const a = await auth.login('Kaito', 'wrong-pass-1', true).catch((e) => e);
    const b = await auth.login('Nobody', 'wrong-pass-1', true).catch((e) => e);
    expect(a.code).toBe('INVALID_CREDENTIALS');
    expect(b.code).toBe('INVALID_CREDENTIALS');
    expect(a.message).toBe(b.message);
  });

  it('locks the account after repeated failures', async () => {
    await auth.registerAccount('Kaito', 'Survive123!');
    const codes: string[] = [];
    for (let i = 0; i < 5; i++) codes.push((await auth.login('Kaito', `nope-${i}xx1`, true).catch((e) => e)).code);
    expect(codes.slice(0, 4)).toEqual(Array(4).fill('INVALID_CREDENTIALS'));
    expect(codes[4]).toBe('LOCKED');
    // even the right password is refused while locked
    const locked = await auth.login('Kaito', 'Survive123!', true).catch((e) => e);
    expect(locked.code).toBe('LOCKED');
    expect(locked.retryAfterMs).toBeGreaterThan(0);
  });

  it('rejects a tampered or revoked session token', async () => {
    await auth.registerAccount('Kaito', 'Survive123!');
    const stored = JSON.parse(localStorage.getItem('bt.session')!);
    localStorage.setItem('bt.session', JSON.stringify({ ...stored, token: 'forged' }));
    expect(await auth.restoreSession()).toBeNull();
    localStorage.setItem('bt.session', JSON.stringify(stored));
    expect(await auth.restoreSession()).not.toBeNull();
    await auth.logout();
    localStorage.setItem('bt.session', JSON.stringify(stored)); // replay after logout
    expect(await auth.restoreSession()).toBeNull();
  });

  it('keeps short sessions out of localStorage', async () => {
    await auth.registerAccount('Kaito', 'Survive123!');
    await auth.logout();
    await auth.login('Kaito', 'Survive123!', false);
    expect(localStorage.getItem('bt.session')).toBeNull();
    expect(sessionStorage.getItem('bt.session')).not.toBeNull();
  });

  it('deletes an account only with the right password', async () => {
    const acc = await auth.registerAccount('Kaito', 'Survive123!');
    await expect(auth.deleteAccount(acc.id, 'wrong-pass-1')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await auth.deleteAccount(acc.id, 'Survive123!');
    expect(await auth.restoreSession()).toBeNull();
    await expect(auth.login('Kaito', 'Survive123!', true)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
});
