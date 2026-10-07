/*
 * Pausable game clock shared by the mini-games in this folder.
 *
 * Every timer a game schedules goes through one PausableClock so that the
 * runner's pause menu (and the intro countdown, which also reports `paused`)
 * freezes the whole game: pending timeouts keep their remaining time and
 * resume exactly where they stopped, and `now()` reports game time that does
 * not advance while paused.
 */
import { useEffect, useLayoutEffect, useState } from 'react';

interface Timer {
  fn: () => void;
  remaining: number;
  due: number;
  handle: number | null;
}

export class PausableClock {
  private timers = new Map<number, Timer>();
  private seq = 0;
  private paused: boolean;
  private accum = 0;
  private since: number;

  constructor(paused: boolean) {
    this.paused = paused;
    this.since = performance.now();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Game time in ms since the clock was created, frozen while paused. */
  now(): number {
    return this.accum + (this.paused ? 0 : performance.now() - this.since);
  }

  /** Run `fn` after `ms` of un-paused time. Returns an id for `cancel`. */
  after(ms: number, fn: () => void): number {
    const id = ++this.seq;
    const t: Timer = { fn, remaining: Math.max(0, ms), due: 0, handle: null };
    this.timers.set(id, t);
    if (!this.paused) this.arm(id, t);
    return id;
  }

  cancel(id: number | null | undefined): void {
    if (id == null) return;
    const t = this.timers.get(id);
    if (!t) return;
    if (t.handle !== null) window.clearTimeout(t.handle);
    this.timers.delete(id);
  }

  /** Cancel every pending timer. */
  clear(): void {
    for (const t of this.timers.values()) if (t.handle !== null) window.clearTimeout(t.handle);
    this.timers.clear();
  }

  setPaused(p: boolean): void {
    if (p === this.paused) return;
    const now = performance.now();
    this.paused = p;
    if (p) {
      this.accum += now - this.since;
      for (const t of this.timers.values()) {
        if (t.handle !== null) window.clearTimeout(t.handle);
        t.handle = null;
        t.remaining = Math.max(0, t.due - now);
      }
    } else {
      this.since = now;
      for (const [id, t] of this.timers) this.arm(id, t);
    }
  }

  private arm(id: number, t: Timer) {
    t.due = performance.now() + t.remaining;
    t.handle = window.setTimeout(() => {
      this.timers.delete(id);
      t.fn();
    }, t.remaining);
  }
}

/**
 * One clock per game instance, kept in sync with the runner's `paused` prop
 * and cleared on unmount. Schedule timers from effects (cancel them in the
 * cleanup) or from event handlers / other timer callbacks.
 */
export function useClock(paused: boolean): PausableClock {
  const [clock] = useState(() => new PausableClock(paused));
  useLayoutEffect(() => {
    clock.setPaused(paused);
  }, [clock, paused]);
  useEffect(() => () => clock.clear(), [clock]);
  return clock;
}
