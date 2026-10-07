/*
 * Timing hooks shared by the trial runner and its mini-games. Every timer is
 * measured with performance.now() deltas so pausing freezes it exactly, and
 * every interval / timeout / rAF is torn down by its effect.
 *
 * Components that need a fresh timer (next question, next story node, a
 * restarted run) are re-keyed by their parent instead of resetting in place.
 */
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../state/settings';

/** Ref that always holds the latest value (for callbacks fired from timers). */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

const prefersReduced = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** App setting or OS preference for reduced motion. */
export function useReduceMotion(): boolean {
  const setting = useSettings((s) => s.reduceMotion);
  return setting || prefersReduced();
}

/**
 * Pausable countdown. Returns the remaining ms (re-rendered every `tickMs`).
 * `onExpire` fires once when it reaches zero.
 */
export function useCountdown(durationMs: number, running: boolean, onExpire?: () => void, tickMs = 100): number {
  const [left, setLeft] = useState(durationMs);
  const leftRef = useRef(durationMs);
  const fired = useRef(false);
  const cb = useLatest(onExpire);

  useEffect(() => {
    if (!running || fired.current) return;
    let last = performance.now();
    const step = () => {
      const now = performance.now();
      leftRef.current = Math.max(0, leftRef.current - (now - last));
      last = now;
    };
    const id = window.setInterval(() => {
      step();
      setLeft(leftRef.current);
      if (leftRef.current <= 0 && !fired.current) {
        fired.current = true;
        window.clearInterval(id);
        cb.current?.();
      }
    }, tickMs);
    return () => {
      window.clearInterval(id);
      step();
    };
  }, [running, tickMs, cb]);

  return left;
}

/**
 * Pausable one-shot timeout. Starts counting when `active` turns true, freezes
 * while `paused`, fires `cb` once per activation.
 */
export function usePausableTimeout(cb: () => void, ms: number, active: boolean, paused: boolean): void {
  const remaining = useRef(ms);
  const armed = useRef(false);
  const fired = useRef(false);
  const fn = useLatest(cb);

  useEffect(() => {
    if (!active) {
      armed.current = false;
      return;
    }
    if (!armed.current) {
      armed.current = true;
      fired.current = false;
      remaining.current = ms;
    }
    if (paused || fired.current) return;
    const start = performance.now();
    const id = window.setTimeout(() => {
      fired.current = true;
      remaining.current = 0;
      fn.current();
    }, remaining.current);
    return () => {
      window.clearTimeout(id);
      if (!fired.current) remaining.current = Math.max(0, remaining.current - (performance.now() - start));
    };
  }, [active, paused, ms, fn]);
}

/**
 * Typewriter reveal: returns how many characters of `text` are visible.
 * Freezes while paused; `complete()` reveals everything instantly.
 */
export function useTypewriter(text: string, charsPerSec: number, paused: boolean, instant = false) {
  const [count, setCount] = useState(instant ? text.length : 0);
  const countRef = useRef(count);
  const done = count >= text.length;

  useEffect(() => {
    if (paused || countRef.current >= text.length) return;
    let raf = 0;
    let last = performance.now();
    let acc = countRef.current;
    const frame = (now: number) => {
      // complete() may have jumped ahead; never move backwards
      acc = Math.min(text.length, Math.max(acc, countRef.current) + ((now - last) / 1000) * charsPerSec);
      last = now;
      const n = Math.floor(acc);
      if (n !== countRef.current) {
        countRef.current = n;
        setCount(n);
      }
      if (n < text.length) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [paused, text, charsPerSec]);

  const complete = () => {
    countRef.current = text.length;
    setCount(text.length);
  };

  return { shown: text.slice(0, count), done, complete };
}

/** Animated number that counts from 0 to `target` once `run` is true. */
export function useCountUp(target: number, run: boolean, durationMs = 1000, instant = false): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!run || instant || target === 0) return;
    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, run, durationMs, instant]);

  if (instant) return target;
  return target === 0 ? 0 : value;
}
