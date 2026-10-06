/*
 * Applying a game result to player progress: rewards, streaks, records and
 * achievement unlocks. Pure function — the store persists the returned copy.
 */
import { CHALLENGES, challengesForSuit } from '../data/challenges';
import { SUIT_ORDER } from '../data/suits';
import type { Challenge, GameResult, PlayerProgress, RewardSummary } from '../data/types';
import { isCleared, levelInfo, starsForScore } from './selectors';

const HISTORY_CAP = 40;
export const STARTER_POINTS = 500;
export const STARTER_GEMS = 50;

export function newProgress(playerName: string, avatarId = 0): PlayerProgress {
  const now = Date.now();
  return {
    version: 1,
    playerName,
    avatarId,
    xp: 0,
    points: STARTER_POINTS,
    gems: STARTER_GEMS,
    gamesPlayed: 0,
    wins: 0,
    streak: 0,
    bestStreak: 0,
    challenges: {},
    achievements: {},
    revealedZones: [],
    bests: {},
    empathy: 0,
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}

export interface ApplyResult {
  progress: PlayerProgress;
  summary: RewardSummary;
}

export function applyResult(prev: PlayerProgress, c: Challenge, r: GameResult): ApplyResult {
  const now = Date.now();
  const p: PlayerProgress = structuredClone(prev);
  const before = levelInfo(p.xp).level;
  const win = r.outcome === 'win';
  const score = Math.max(0, Math.min(100, Math.round(r.score)));
  const record = p.challenges[c.id] ?? { bestScore: 0, stars: 0, attempts: 0, wins: 0, lastPlayedAt: now };
  const firstClear = win && record.wins === 0 && !c.practice;
  const stars = win ? starsForScore(score) : 0;

  /* rewards */
  let points = 0;
  let xp = 0;
  let gems = 0;
  if (c.practice) {
    xp = win ? c.rewardXp : Math.round(c.rewardXp / 4);
  } else if (win) {
    const perf = 0.7 + 0.3 * (score / 100);
    const repeat = firstClear ? 1 : 0.35;
    points = Math.round(c.rewardPoints * perf * repeat);
    xp = Math.round(c.rewardXp * perf * (firstClear ? 1 : 0.5));
    gems = firstClear ? c.rewardGems : stars === 3 ? Math.ceil(c.rewardGems / 5) : 0;
  } else {
    xp = Math.round(c.rewardXp * 0.1); // participation
  }

  p.points += points;
  p.xp += xp;
  p.gems += gems;

  /* records */
  if (!c.practice) {
    p.gamesPlayed += 1;
    if (win) {
      p.wins += 1;
      p.streak += 1;
      p.bestStreak = Math.max(p.bestStreak, p.streak);
    } else {
      p.streak = 0;
    }
    p.challenges[c.id] = {
      bestScore: Math.max(record.bestScore, score),
      stars: Math.max(record.stars, stars) as 0 | 1 | 2 | 3,
      attempts: record.attempts + 1,
      wins: record.wins + (win ? 1 : 0),
      firstClearedAt: record.firstClearedAt ?? (win ? now : undefined),
      lastPlayedAt: now,
    };
    p.history.unshift({ challengeId: c.id, outcome: r.outcome, score, points, at: now });
    p.history = p.history.slice(0, HISTORY_CAP);
  }

  /* personal bests from game stats */
  const s = r.stats ?? {};
  if (s.avgReactionMs && win) p.bests.reactionMs = Math.min(p.bests.reactionMs ?? Infinity, s.avgReactionMs);
  if (s.tapsPerSec) p.bests.tapsPerSec = Math.max(p.bests.tapsPerSec ?? 0, s.tapsPerSec);
  if (s.patternLength) p.bests.patternLength = Math.max(p.bests.patternLength ?? 0, s.patternLength);
  if (c.game.type === 'memory' && win && s.mistakes !== undefined)
    p.bests.memoryMistakesMin = Math.min(p.bests.memoryMistakesMin ?? Infinity, s.mistakes);
  if (s.empathy) p.empathy += s.empathy;

  p.updatedAt = now;

  const newAchievements = unlockAchievements(p, c, r, win);
  for (const id of newAchievements) p.achievements[id] = now;

  const after = levelInfo(p.xp).level;
  return {
    progress: p,
    summary: {
      outcome: r.outcome,
      stars: stars as 0 | 1 | 2 | 3,
      points,
      xp,
      gems,
      leveledUp: after > before,
      newLevel: after,
      newAchievements,
      firstClear,
    },
  };
}

/** Returns ids of achievements newly earned by this result (not yet in p.achievements). */
function unlockAchievements(p: PlayerProgress, c: Challenge, r: GameResult, win: boolean): string[] {
  const has = (id: string) => id in p.achievements;
  const out: string[] = [];
  const grant = (id: string, cond: boolean) => {
    if (cond && !has(id)) out.push(id);
  };
  const s = r.stats ?? {};
  const level = levelInfo(p.xp).level;

  grant('first-win', p.wins >= 1);
  grant('games-10', p.gamesPlayed >= 10);
  grant('survivor', p.streak >= 3);
  grant('speed-master', win && c.game.type === 'reaction' && !!s.avgReactionMs && s.avgReactionMs < 250);
  grant('total-recall', win && c.game.type === 'memory' && s.mistakes === 0);
  grant('mastermind', win && c.game.type === 'logic' && s.correct !== undefined && s.correct === s.total);
  grant('escape-artist', win && c.game.type === 'escape' && s.attempts === 1);
  grant('the-kind-one', p.empathy >= 10);
  grant('explorer', p.revealedZones.length > 0);
  grant('full-house', SUIT_ORDER.every((suit) => challengesForSuit(suit).some((x) => isCleared(p, x.id))));
  for (const suit of SUIT_ORDER) {
    grant(`${suit}-master`, challengesForSuit(suit).every((x) => isCleared(p, x.id)));
  }
  grant('iron-will', win && !c.practice && c.difficulty === 5);
  grant('rising-star', level >= 5);
  grant('borderline-legend', level >= 10);
  return out;
}

/** Achievement check that doesn't depend on a game result (e.g. after a map reveal). */
export function passiveAchievements(p: PlayerProgress): string[] {
  const out: string[] = [];
  if (p.revealedZones.length > 0 && !('explorer' in p.achievements)) out.push('explorer');
  return out;
}

export const TOTAL_TRIALS = CHALLENGES.length;
