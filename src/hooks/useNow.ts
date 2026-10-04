import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Milliseconds until the next multiple of `intervalMs` on the wall clock (+ a few ms),
 * so a 1 s ticker flips exactly as the second changes and never skips one.
 */
const delayToNextTick = (intervalMs: number) => intervalMs - (Date.now() % intervalMs) + 5;

/**
 * The current time, re-rendering every `intervalMs`. Ticks are aligned to the wall
 * clock (whole seconds / minutes) to avoid drift; ticking pauses while the app is in
 * the background and refreshes immediately when it returns to the foreground.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = Math.max(250, intervalMs);
    let timer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const schedule = () => {
      stop();
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, delayToNextTick(interval));
    };

    if (AppState.currentState !== 'background') schedule();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(new Date());
        schedule();
      } else if (state === 'background') {
        stop();
      }
    });

    return () => {
      stop();
      subscription.remove();
    };
  }, [intervalMs]);

  return now;
}
