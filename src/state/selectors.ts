/*
 * Pure game rules. No React, no I/O — everything here is deterministic and
 * derived from PlayerProgress so it can be reused by any screen.
 */
import { CHALLENGES, challengesForSuit } from '../data/challenges';
import { GLOBAL_POPULATION, GLOBAL_TOP } from '../data/rivals';
import { ZONES } from '../data/zones';
import type { Challenge, PlayerProgress, SuitId, Zone, ZoneStatus } from '../data/types';

/* ── Levels ───────────────────────────────────────────────────── */

/** XP needed to go from `level` to `level + 1`. */
export function levelCap(level: number): number {
  return 250 * level + 250;
}

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level */
  into: number;
  /** XP needed for the current level */
  cap: number;
  /** 0..1 */
  pct: number;
}

export function levelInfo(xp: number): LevelInfo {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (rest >= levelCap(level) && level < 99) {
    rest -= levelCap(level);
    level += 1;
  }
  const cap = levelCap(level);
  return { level, into: rest, cap, pct: Math.min(1, rest / cap) };
}

/* ── Ranking ──────────────────────────────────────────────────── */

const TOP_FLOOR = GLOBAL_TOP[GLOBAL_TOP.length - 1].points;

/** Global rank for a points total (1 = best). */
export function globalRank(points: number): number {
  const above = GLOBAL_TOP.filter((r) => r.points > points).length;
  if (above < GLOBAL_TOP.length) return above + 1;
  // below the seeded top 50 — estimate from a population curve
  const frac = Math.max(0, 1 - points / TOP_FLOOR);
  return GLOBAL_TOP.length + 1 + Math.round((GLOBAL_POPULATION - GLOBAL_TOP.length - 1) * Math.pow(frac, 3));
}

export function winRate(p: PlayerProgress): number {
  return p.gamesPlayed === 0 ? 0 : Math.round((p.wins / p.gamesPlayed) * 100);
}

/* ── Challenge / zone status ─────────────────────────────────── */

export type ChallengeStatus = 'locked' | 'available' | 'completed';

export function isCleared(p: PlayerProgress, id: string): boolean {
  return (p.challenges[id]?.wins ?? 0) > 0;
}

export function challengeStatus(c: Challenge, p: PlayerProgress): ChallengeStatus {
  if (isCleared(p, c.id)) return 'completed';
  const { level } = levelInfo(p.xp);
  if (level < c.unlockLevel) return 'locked';
  const zone = ZONES.find((z) => z.id === c.zoneId);
  if (zone?.hidden && !p.revealedZones.includes(zone.id)) return 'locked';
  return 'available';
}

export function zoneStatus(z: Zone, p: PlayerProgress): ZoneStatus {
  if (z.hidden && !p.revealedZones.includes(z.id)) return 'hidden';
  if (z.challengeIds.length > 0 && z.challengeIds.every((id) => isCleared(p, id))) return 'completed';
  const { level } = levelInfo(p.xp);
  return level >= z.unlockLevel ? 'available' : 'locked';
}

/** Hidden zones that a scan would reveal right now. */
export function scannableZones(p: PlayerProgress): Zone[] {
  const { level } = levelInfo(p.xp);
  return ZONES.filter((z) => z.hidden && !p.revealedZones.includes(z.id) && level >= z.unlockLevel);
}

export function suitProgress(suit: SuitId, p: PlayerProgress): { cleared: number; total: number } {
  const list = challengesForSuit(suit);
  return { cleared: list.filter((c) => isCleared(p, c.id)).length, total: list.length };
}

/** The next trial worth playing in a suit: first available, else the highest cleared for replay. */
export function nextChallengeForSuit(suit: SuitId, p: PlayerProgress): Challenge {
  const list = challengesForSuit(suit);
  return (
    list.find((c) => challengeStatus(c, p) === 'available') ??
    [...list].reverse().find((c) => challengeStatus(c, p) === 'completed') ??
    list[0]
  );
}

/** Up to `n` current missions for the dashboard: available, not yet cleared, easiest first. */
export function currentMissions(p: PlayerProgress, n = 3): Challenge[] {
  return CHALLENGES.filter((c) => challengeStatus(c, p) === 'available')
    .sort((a, b) => a.difficulty - b.difficulty || a.unlockLevel - b.unlockLevel)
    .slice(0, n);
}

/** Stars for a winning score. */
export function starsForScore(score: number): 1 | 2 | 3 {
  if (score >= 85) return 3;
  if (score >= 60) return 2;
  return 1;
}

/* ── Formatting helpers used across screens ──────────────────── */

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} Seconds`;
  const m = Math.round(sec / 60);
  return `${m} Minute${m === 1 ? '' : 's'}`;
}
