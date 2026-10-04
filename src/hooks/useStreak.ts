import { usePlannerStore } from '@/store/planner';
import { computeStreak, type StreakSummary } from '@/store/selectors';

import { useNow } from './useNow';

/** Study streak (`current`, `best`, `last7`) — updates on every change and each minute (day rollover). */
export function useStreak(): StreakSummary {
  const subjects = usePlannerStore((state) => state.subjects);
  const tasks = usePlannerStore((state) => state.tasks);
  const now = useNow(60_000);
  return computeStreak(subjects, tasks, now);
}
