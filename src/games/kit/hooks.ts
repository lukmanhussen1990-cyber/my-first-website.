/* Shared hooks for the mini-games in this folder. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { GameResult } from '../../data/types';
import { useSettings } from '../../state/settings';

/**
 * Wraps the runner's `onFinish` so it fires exactly once per game instance,
 * no matter how many timers / StrictMode effect replays try to end the game.
 */
export function useFinish(onFinish: (r: GameResult) => void): {
  finish: (r: GameResult) => void;
  isDone: () => boolean;
} {
  const cb = useRef(onFinish);
  const done = useRef(false);
  useLayoutEffect(() => {
    cb.current = onFinish;
  });
  const finish = useCallback((r: GameResult) => {
    if (done.current) return;
    done.current = true;
    cb.current(r);
  }, []);
  const isDone = useCallback(() => done.current, []);
  return { finish, isDone };
}

/**
 * Pointer-first press detection: games react on `pointerdown` (no click
 * latency, accurate timestamps) and keep keyboard activation working through
 * `onClick` with `detail === 0` (Enter / Space on a focused button).
 */
export function isPrimaryPointer(e: ReactPointerEvent): boolean {
  return e.pointerType !== 'mouse' || e.button === 0;
}

export function isKeyboardClick(e: ReactMouseEvent): boolean {
  return e.detail === 0;
}

/** performance.now()-based timestamp of an input event. */
export function eventTime(e: { timeStamp: number }): number {
  return e.timeStamp > 0 ? e.timeStamp : performance.now();
}

/** Live size of an element (ResizeObserver). */
export function useElementSize<T extends HTMLElement>(ref: RefObject<T | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setSize((prev) =>
        Math.abs(prev.width - r.width) < 0.5 && Math.abs(prev.height - r.height) < 0.5
          ? prev
          : { width: r.width, height: r.height },
      );
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** App setting or OS preference for reduced motion. */
export function useReducedMotion(): boolean {
  const setting = useSettings((s) => s.reduceMotion);
  const [os, setOs] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setOs(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return setting || os;
}

/** Restart a one-shot CSS animation on an element (Web Animations API). */
export function pulse(
  el: Element | null | undefined,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): void {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return;
  (el as HTMLElement).animate(keyframes, options);
}
