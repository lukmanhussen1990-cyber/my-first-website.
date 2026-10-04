import { getCountdown, type CountdownState } from '@/store/selectors';
import type { IsoDateTime } from '@/types';

import { useNow } from './useNow';

export type { CountdownState };

export interface CountdownOptions {
  /** Start of the countdown window; `progress` is the elapsed fraction since then. */
  startIso?: IsoDateTime;
  /** Tick interval (default 1 s). */
  intervalMs?: number;
}

/** Live `{ days, hours, minutes, seconds, totalMs, isPast, progress }` to `targetIso`. */
export function useCountdown(
  targetIso: IsoDateTime,
  { startIso, intervalMs = 1000 }: CountdownOptions = {},
): CountdownState {
  const now = useNow(intervalMs);
  return getCountdown(targetIso, now, startIso);
}
