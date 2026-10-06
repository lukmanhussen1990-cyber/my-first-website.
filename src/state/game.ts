/*
 * Player progress store. Holds the signed-in (or guest) player's progress in
 * memory and writes every change through to IndexedDB.
 */
import { create } from 'zustand';
import { getAchievement } from '../data/achievements';
import { ZONES } from '../data/zones';
import type { Challenge, GameResult, PlayerProgress, RewardSummary, Zone } from '../data/types';
import { loadProgress, saveProgress } from '../services/db';
import { applyResult, newProgress, passiveAchievements } from './rewards';
import { scannableZones } from './selectors';
import { toast } from './toasts';

interface GameStore {
  accountId: string | null;
  progress: PlayerProgress | null;
  /** last reward summary, read by the result screen */
  lastSummary: RewardSummary | null;

  hydrate: (accountId: string, playerName: string) => Promise<void>;
  /** adopt an existing progress object under a new account id (guest → account) */
  adopt: (accountId: string, progress: PlayerProgress) => Promise<void>;
  clear: () => void;
  recordResult: (c: Challenge, r: GameResult) => RewardSummary;
  setAvatar: (avatarId: number) => void;
  setPlayerName: (name: string) => void;
  /** Reveal every hidden zone the player qualifies for. Returns what was found. */
  scanMap: () => { revealed: Zone[]; bonus: number };
}

function persist(accountId: string | null, p: PlayerProgress) {
  if (!accountId) return;
  saveProgress(accountId, p).catch((err) => console.error('[border-trials] save failed', err));
}

function announceAchievements(ids: string[]) {
  for (const id of ids) {
    const a = getAchievement(id);
    if (a) toast({ kind: 'achievement', title: a.name, body: a.description, achievementId: id, durationMs: 3800 });
  }
}

export const useGame = create<GameStore>((set, get) => ({
  accountId: null,
  progress: null,
  lastSummary: null,

  hydrate: async (accountId, playerName) => {
    let p = await loadProgress(accountId);
    if (!p) {
      p = newProgress(playerName, Math.floor(Math.random() * 12));
      await saveProgress(accountId, p);
    }
    set({ accountId, progress: p, lastSummary: null });
  },

  adopt: async (accountId, progress) => {
    const p = { ...progress, updatedAt: Date.now() };
    await saveProgress(accountId, p);
    set({ accountId, progress: p });
  },

  clear: () => set({ accountId: null, progress: null, lastSummary: null }),

  recordResult: (c, r) => {
    const { progress, accountId } = get();
    if (!progress) throw new Error('recordResult before hydrate');
    const { progress: next, summary } = applyResult(progress, c, r);
    set({ progress: next, lastSummary: summary });
    persist(accountId, next);
    announceAchievements(summary.newAchievements);
    return summary;
  },

  setAvatar: (avatarId) => {
    const { progress, accountId } = get();
    if (!progress) return;
    const next = { ...progress, avatarId, updatedAt: Date.now() };
    set({ progress: next });
    persist(accountId, next);
  },

  setPlayerName: (name) => {
    const { progress, accountId } = get();
    if (!progress) return;
    const next = { ...progress, playerName: name.slice(0, 16), updatedAt: Date.now() };
    set({ progress: next });
    persist(accountId, next);
  },

  scanMap: () => {
    const { progress, accountId } = get();
    if (!progress) return { revealed: [], bonus: 0 };
    const found = scannableZones(progress);
    if (found.length === 0) return { revealed: [], bonus: 0 };
    const bonus = found.reduce((sum, z) => sum + (z.revealBonus ?? 0), 0);
    const next: PlayerProgress = {
      ...progress,
      revealedZones: [...progress.revealedZones, ...found.map((z) => z.id)],
      points: progress.points + bonus,
      achievements: { ...progress.achievements },
      updatedAt: Date.now(),
    };
    const unlocked = passiveAchievements(next);
    for (const id of unlocked) next.achievements[id] = Date.now();
    set({ progress: next });
    persist(accountId, next);
    announceAchievements(unlocked);
    return { revealed: found, bonus };
  },
}));

/** Convenience hook: the current progress, asserting it is loaded (protected screens only). */
export function useProgress(): PlayerProgress {
  const p = useGame((s) => s.progress);
  if (!p) throw new Error('useProgress used before progress was hydrated');
  return p;
}

export const ALL_ZONES = ZONES;
