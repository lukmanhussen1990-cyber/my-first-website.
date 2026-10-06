import type { Challenge, GameType, SuitId } from '../types';
import { SPADE_CHALLENGES } from './spade';
import { HEART_CHALLENGES } from './heart';
import { DIAMOND_CHALLENGES } from './diamond';
import { CLUB_CHALLENGES } from './club';

/** All ranked trials, ordered by suit then difficulty. */
export const CHALLENGES: Challenge[] = [
  ...SPADE_CHALLENGES,
  ...HEART_CHALLENGES,
  ...DIAMOND_CHALLENGES,
  ...CLUB_CHALLENGES,
];

/* ── Practice runs (Games tab) ─────────────────────────────────── */

interface GameMeta {
  type: GameType;
  name: string; // "Reaction"
  title: string; // "Reflex Test"
  blurb: string;
  suit: SuitId;
}

/** Display metadata for every mini-game engine (Games hub). */
export const GAME_TYPES: GameMeta[] = [
  { type: 'memory', name: 'Memory', title: 'Memory Puzzle', blurb: 'Memorise the spread, then match every pair.', suit: 'heart' },
  { type: 'logic', name: 'Logic', title: 'Logic Test', blurb: 'Sequences, riddles and deduction against the clock.', suit: 'diamond' },
  { type: 'pattern', name: 'Pattern', title: 'Pattern Relay', blurb: 'Repeat a growing signal sequence without error.', suit: 'club' },
  { type: 'escape', name: 'Escape', title: 'Escape Room', blurb: 'Search the room, find the clues, crack the code.', suit: 'club' },
  { type: 'reaction', name: 'Reaction', title: 'Reflex Test', blurb: 'Tap the instant the signal burns red.', suit: 'spade' },
  { type: 'numberOrder', name: 'Puzzle', title: 'Number Order', blurb: 'Swap tiles until every number is in place.', suit: 'diamond' },
  { type: 'choice', name: 'Choice', title: 'Moral Dilemma', blurb: 'Decide under pressure. Live with it.', suit: 'heart' },
  { type: 'stamina', name: 'Stamina', title: 'Endurance Run', blurb: 'Tap fast enough to stay above the kill line.', suit: 'spade' },
];

function practiceFrom(sourceId: string, type: GameType): Challenge {
  const src = CHALLENGES.find((c) => c.id === sourceId);
  if (!src) throw new Error(`practice source ${sourceId} missing`);
  const meta = GAME_TYPES.find((g) => g.type === type)!;
  return {
    ...src,
    id: `practice-${type}`,
    rank: 'A',
    title: `${meta.title} · Practice`,
    hook: meta.blurb,
    rewardPoints: 0,
    rewardXp: 40,
    rewardGems: 0,
    unlockLevel: 1,
    practice: true,
  };
}

/** One practice run per engine, based on the easiest ranked trial of that type. */
export const PRACTICE: Challenge[] = [
  practiceFrom('heart-3', 'memory'),
  practiceFrom('diamond-6', 'logic'),
  practiceFrom('club-3', 'pattern'),
  practiceFrom('club-6', 'escape'),
  practiceFrom('spade-3', 'reaction'),
  practiceFrom('diamond-3', 'numberOrder'),
  practiceFrom('heart-6', 'choice'),
  practiceFrom('spade-6', 'stamina'),
];

const BY_ID = new Map<string, Challenge>([...CHALLENGES, ...PRACTICE].map((c) => [c.id, c]));

export function getChallenge(id: string | undefined): Challenge | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function challengesForSuit(suit: SuitId): Challenge[] {
  return CHALLENGES.filter((c) => c.suit === suit);
}

export function challengesForZone(zoneId: string): Challenge[] {
  return CHALLENGES.filter((c) => c.zoneId === zoneId);
}
