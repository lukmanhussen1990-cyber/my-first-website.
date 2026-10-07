import { describe, expect, it } from 'vitest';
import { CHALLENGES, getChallenge } from '../data/challenges';
import { ZONES } from '../data/zones';
import { applyResult, newProgress, STARTER_POINTS } from '../state/rewards';
import {
  challengeStatus,
  formatClock,
  globalRank,
  levelCap,
  levelInfo,
  scannableZones,
  starsForScore,
  zoneStatus,
} from '../state/selectors';
import type { GameResult } from '../data/types';

const WIN: GameResult = { outcome: 'win', score: 90, summary: 'test' };
const LOSS: GameResult = { outcome: 'loss', score: 10, summary: 'test' };

describe('levels', () => {
  it('starts at level 1 with an empty bar', () => {
    expect(levelInfo(0)).toEqual({ level: 1, into: 0, cap: levelCap(1), pct: 0 });
  });

  it('rolls over exactly at the cap', () => {
    expect(levelInfo(levelCap(1) - 1).level).toBe(1);
    expect(levelInfo(levelCap(1)).level).toBe(2);
    expect(levelInfo(levelCap(1) + levelCap(2)).level).toBe(3);
  });
});

describe('global rank', () => {
  it('is monotonic: more points never means a worse rank', () => {
    let prev = Infinity;
    for (let p = 0; p <= 14000; p += 50) {
      const r = globalRank(p);
      expect(r).toBeLessThanOrEqual(prev);
      prev = r;
    }
  });

  it('puts a top score at #1', () => {
    expect(globalRank(999999)).toBe(1);
  });
});

describe('formatting', () => {
  it('formats clocks', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(452)).toBe('07:32');
    expect(formatClock(59.2)).toBe('01:00');
  });

  it('maps scores to stars', () => {
    expect(starsForScore(10)).toBe(1);
    expect(starsForScore(60)).toBe(2);
    expect(starsForScore(85)).toBe(3);
  });
});

describe('applyResult', () => {
  const c = getChallenge('spade-3')!;

  it('does not mutate the input progress', () => {
    const p = newProgress('Tester');
    const snapshot = structuredClone(p);
    applyResult(p, c, WIN);
    expect(p).toEqual(snapshot);
  });

  it('pays full rewards on the first clear and less on replays', () => {
    const p0 = newProgress('Tester');
    const first = applyResult(p0, c, WIN);
    expect(first.summary.firstClear).toBe(true);
    expect(first.summary.gems).toBe(c.rewardGems);
    expect(first.progress.points).toBe(STARTER_POINTS + first.summary.points);
    const second = applyResult(first.progress, c, WIN);
    expect(second.summary.firstClear).toBe(false);
    expect(second.summary.points).toBeLessThan(first.summary.points);
    expect(second.progress.challenges[c.id].wins).toBe(2);
  });

  it('tracks streaks and resets them on a loss', () => {
    let p = newProgress('Tester');
    p = applyResult(p, c, WIN).progress;
    p = applyResult(p, c, WIN).progress;
    expect(p.streak).toBe(2);
    p = applyResult(p, c, LOSS).progress;
    expect(p.streak).toBe(0);
    expect(p.bestStreak).toBe(2);
    expect(p.gamesPlayed).toBe(3);
    expect(p.wins).toBe(2);
  });

  it('never counts practice runs as games or wins', () => {
    const practice = getChallenge('practice-reaction')!;
    const r = applyResult(newProgress('Tester'), practice, WIN);
    expect(r.progress.gamesPlayed).toBe(0);
    expect(r.progress.wins).toBe(0);
    expect(r.summary.points).toBe(0);
    expect(r.summary.xp).toBeGreaterThan(0);
  });

  it('unlocks first-win, survivor and speed-master', () => {
    let p = newProgress('Tester');
    const fast: GameResult = { outcome: 'win', score: 95, summary: 'x', stats: { avgReactionMs: 220 } };
    const r1 = applyResult(p, c, fast);
    expect(r1.summary.newAchievements).toEqual(expect.arrayContaining(['first-win', 'speed-master']));
    p = r1.progress;
    p = applyResult(p, getChallenge('diamond-3')!, WIN).progress;
    const r3 = applyResult(p, getChallenge('heart-3')!, WIN);
    expect(r3.summary.newAchievements).toContain('survivor');
    // achievements are never re-announced
    expect(applyResult(r3.progress, c, WIN).summary.newAchievements).not.toContain('first-win');
  });

  it('records a reaction best only from wins', () => {
    const lossFast: GameResult = { outcome: 'loss', score: 20, summary: 'x', stats: { avgReactionMs: 150 } };
    expect(applyResult(newProgress('T'), c, lossFast).progress.bests.reactionMs).toBeUndefined();
  });
});

describe('unlocks', () => {
  it('locks trials above the player level and unlocks them after levelling', () => {
    const p = newProgress('Tester');
    const hard = CHALLENGES.find((x) => x.difficulty === 5)!;
    expect(challengeStatus(hard, p)).toBe('locked');
    const levelled = { ...p, xp: 999999 };
    const visible = CHALLENGES.filter((x) => {
      const z = ZONES.find((zz) => zz.id === x.zoneId)!;
      return !z.hidden;
    });
    for (const x of visible) expect(challengeStatus(x, levelled), x.id).toBe('available');
  });

  it('keeps hidden zones hidden until scanned', () => {
    const p = { ...newProgress('Tester'), xp: 999999 };
    const vault = ZONES.find((z) => z.id === 'vault')!;
    expect(zoneStatus(vault, p)).toBe('hidden');
    expect(challengeStatus(getChallenge('diamond-Q')!, p)).toBe('locked');
    expect(scannableZones(p).map((z) => z.id)).toEqual(expect.arrayContaining(['vault', 'signal']));
    const revealed = { ...p, revealedZones: ['vault'] };
    expect(zoneStatus(vault, revealed)).toBe('available');
    expect(challengeStatus(getChallenge('diamond-Q')!, revealed)).toBe('available');
  });
});
