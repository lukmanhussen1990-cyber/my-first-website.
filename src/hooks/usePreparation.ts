import { usePlannerStore } from '@/store/planner';
import { overallProgress, type ProgressSummary } from '@/store/selectors';

/** Chapter-weighted preparation across all subjects: `{ progress (0–1), done, total }`. */
export function usePreparation(): ProgressSummary {
  const subjects = usePlannerStore((state) => state.subjects);
  return overallProgress(subjects);
}
