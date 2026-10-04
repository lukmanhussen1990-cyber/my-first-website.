import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { achievementById, type AchievementDef } from '@/data/achievements';
import { useAppStore } from '@/store/app';
import { useJournalStore } from '@/store/journal';
import { usePlannerStore } from '@/store/planner';
import { evaluateAchievements, type AchievementSnapshot } from '@/store/selectors';
import { areStoresHydrated, subscribeHydration } from '@/store/storage';
import { useTravelStore } from '@/store/travel';
import type { AchievementId } from '@/types';

const WATCHED_STORES = ['app', 'planner', 'travel', 'journal'] as const;

/** Time-based badges (streaks, "homebound") are re-checked this often. */
const RECHECK_MS = 60_000;

function readSnapshot(now: Date): AchievementSnapshot {
  const app = useAppStore.getState();
  const { subjects, tasks } = usePlannerStore.getState();
  return {
    now,
    subjects,
    tasks,
    checklist: useTravelStore.getState().items,
    memories: useJournalStore.getState().memories,
    stats: app.stats,
    examDate: app.examDate,
    travelDate: app.travelDate,
    examCompletedAt: app.examCompletedAt,
  };
}

export interface AchievementWatcher {
  /** The badge to celebrate now (head of the queue), or null. */
  current: AchievementDef | null;
  /** Hide the current toast and move on to the next queued badge. */
  dismiss(): void;
}

/**
 * Mount once (root layout). Re-evaluates achievements whenever the stores change
 * (and every minute for time-based ones), unlocks newly earned badges and queues
 * them for the toast.
 *
 * The first evaluation of an onboarded session — after app start, or right after
 * onboarding seeds the sample plan — unlocks already-satisfied badges silently, so
 * returning users and sample data never trigger a flood of toasts.
 */
export function useAchievementWatcher(): AchievementWatcher {
  const [queue, setQueue] = useState<AchievementId[]>([]);

  useEffect(() => {
    let primed = false;
    let evaluating = false;

    const evaluate = () => {
      // unlockAchievement() writes to the app store, which notifies us again synchronously.
      if (evaluating) return;
      if (!areStoresHydrated(WATCHED_STORES) || !useAppStore.getState().hasOnboarded) {
        if (primed) setQueue((pending) => (pending.length ? [] : pending)); // app was reset
        primed = false;
        return;
      }
      evaluating = true;
      try {
        const { unlockAchievement } = useAppStore.getState();
        const unlocked = evaluateAchievements(readSnapshot(new Date())).filter((id) => unlockAchievement(id));
        if (primed && unlocked.length > 0) {
          setQueue((pending) => [...pending, ...unlocked.filter((id) => !pending.includes(id))]);
        }
        primed = true;
      } finally {
        evaluating = false;
      }
    };

    evaluate();
    const unsubscribers = [
      subscribeHydration(evaluate),
      useAppStore.subscribe(evaluate),
      usePlannerStore.subscribe(evaluate),
      useTravelStore.subscribe(evaluate),
      useJournalStore.subscribe(evaluate),
    ];
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') evaluate();
    });
    const timer = setInterval(evaluate, RECHECK_MS);

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      appState.remove();
      clearInterval(timer);
    };
  }, []);

  const current = queue.length > 0 ? achievementById[queue[0]] : null;
  const dismiss = () => setQueue((pending) => pending.slice(1));

  return { current, dismiss };
}
