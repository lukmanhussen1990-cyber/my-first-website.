import { useAppStore } from '@/store/app';
import { getJourneyPhase } from '@/store/selectors';
import type { JourneyPhase } from '@/types';

import { useNow } from './useNow';

/** preparing → exam-day → completed → home, re-evaluated every 30 s and on any date change. */
export function useJourneyPhase(): JourneyPhase {
  const examDate = useAppStore((state) => state.examDate);
  const travelDate = useAppStore((state) => state.travelDate);
  const examCompletedAt = useAppStore((state) => state.examCompletedAt);
  const now = useNow(30_000);
  return getJourneyPhase({ examDate, travelDate, examCompletedAt, now });
}
