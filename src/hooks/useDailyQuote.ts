import { quoteForDay, type Quote } from '@/data/quotes';
import { toDayKey } from '@/utils/date';

import { useNow } from './useNow';

/** Today's quote — the same all day, a new one after local midnight. */
export function useDailyQuote(offset = 0): Quote {
  const now = useNow(60_000);
  return quoteForDay(toDayKey(now), offset);
}
