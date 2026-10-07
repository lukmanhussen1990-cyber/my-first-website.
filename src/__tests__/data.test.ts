import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../data/achievements';
import { CHALLENGES, GAME_TYPES, PRACTICE, getChallenge } from '../data/challenges';
import { FRIENDS, GLOBAL_TOP } from '../data/rivals';
import { SUIT_ORDER, SUITS } from '../data/suits';
import { ZONES } from '../data/zones';

describe('game data integrity', () => {
  it('has unique challenge ids', () => {
    const ids = [...CHALLENGES, ...PRACTICE].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has five ranked trials per suit with rising difficulty', () => {
    for (const suit of SUIT_ORDER) {
      const list = CHALLENGES.filter((c) => c.suit === suit);
      expect(list).toHaveLength(5);
      expect(list.map((c) => c.difficulty)).toEqual([1, 2, 3, 4, 5]);
      for (const c of list) expect(SUITS[suit].games).toContain(c.game.type);
    }
  });

  it('places every trial in an existing zone, and zones list exactly their trials', () => {
    for (const c of CHALLENGES) {
      const zone = ZONES.find((z) => z.id === c.zoneId);
      expect(zone, c.id).toBeDefined();
      expect(zone!.challengeIds, c.id).toContain(c.id);
    }
    for (const z of ZONES) {
      for (const id of z.challengeIds) expect(getChallenge(id)?.zoneId, `${z.id}/${id}`).toBe(z.id);
      expect(z.x).toBeGreaterThanOrEqual(0);
      expect(z.x).toBeLessThanOrEqual(100);
      expect(z.y).toBeGreaterThanOrEqual(0);
      expect(z.y).toBeLessThanOrEqual(100);
    }
  });

  it('never gates a trial behind a zone that unlocks later than the trial', () => {
    for (const c of CHALLENGES) {
      const zone = ZONES.find((z) => z.id === c.zoneId)!;
      expect(zone.unlockLevel, c.id).toBeLessThanOrEqual(c.unlockLevel);
    }
  });

  it('has a practice run for every game engine', () => {
    for (const g of GAME_TYPES) {
      const p = getChallenge(`practice-${g.type}`);
      expect(p?.practice, g.type).toBe(true);
      expect(p?.game.type).toBe(g.type);
      expect(p?.rewardPoints).toBe(0);
    }
  });

  it('has well-formed choice graphs', () => {
    for (const c of [...CHALLENGES, ...PRACTICE]) {
      if (c.game.type !== 'choice') continue;
      const { nodes, start } = c.game.choice;
      const ids = new Set(nodes.map((n) => n.id));
      expect(ids.has(start), c.id).toBe(true);
      for (const n of nodes) {
        expect(n.options.map((o) => o.id), `${c.id}/${n.id}`).toContain(n.defaultOption);
        for (const o of n.options) if (o.next) expect(ids.has(o.next), `${c.id}/${n.id}/${o.id}`).toBe(true);
      }
    }
  });

  it('has valid logic answers', () => {
    for (const c of CHALLENGES) {
      if (c.game.type !== 'logic') continue;
      const { questions, passMark } = c.game.logic;
      expect(passMark).toBeLessThanOrEqual(questions.length);
      for (const q of questions) {
        expect(q.answer, q.id).toBeGreaterThanOrEqual(0);
        expect(q.answer, q.id).toBeLessThan(q.options.length);
      }
    }
  });

  it('has escape rooms whose clues cover every digit of the code', () => {
    for (const c of CHALLENGES) {
      if (c.game.type !== 'escape') continue;
      const { code, clues } = c.game.escape;
      expect(code).toMatch(/^\d{3,5}$/);
      const covered = new Set(clues.map((k) => k.digit));
      for (let i = 0; i < code.length; i++) expect(covered.has(i), `${c.id} digit ${i}`).toBe(true);
    }
  });

  it('only references real achievements from rivals', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const r of [...GLOBAL_TOP, ...FRIENDS]) for (const b of r.badges) expect(ids.has(b), `${r.name}:${b}`).toBe(true);
  });

  it('sorts the global leaderboard from highest to lowest', () => {
    for (let i = 1; i < GLOBAL_TOP.length; i++) expect(GLOBAL_TOP[i - 1].points).toBeGreaterThan(GLOBAL_TOP[i].points);
  });
});
