import type { LeaderboardEntry } from './types';

/*
 * Seeded rival players for the leaderboard. Points are fixed so the player
 * genuinely climbs past rivals as they progress. Global rank below the
 * seeded top 50 is estimated from a population curve (see state/selectors).
 */

const TOP_NAMES = [
  'Kaze', 'Vesper', 'Nyx', 'Ronin', 'Sable', 'Juno', 'Hex', 'Mirae', 'Ashen', 'Kite',
  'Onyx', 'Lyra', 'Torque', 'Echo', 'Rook', 'Wren', 'Haze', 'Iris', 'Volt', 'Cinder',
  'Morrow', 'Quill', 'Saber', 'Tamsin', 'Umbra', 'Vale', 'Wraith', 'Xeno', 'Yuki', 'Zephyr',
  'Arc', 'Briar', 'Cobalt', 'Dune', 'Ember', 'Flint', 'Grey', 'Halo', 'Ion', 'Jinx',
  'Kestrel', 'Lumen', 'Moth', 'Nova', 'Orbit', 'Pike', 'Quartz', 'Rift', 'Shade', 'Talon',
];

const BADGE_POOL = ['first-win', 'games-10', 'speed-master', 'survivor', 'full-house', 'iron-will', 'mastermind'];

function pick<T>(arr: T[], i: number, n: number): T[] {
  return Array.from({ length: n }, (_, k) => arr[(i * 3 + k * 2) % arr.length]);
}

/** Global top 50, highest first. */
export const GLOBAL_TOP: LeaderboardEntry[] = TOP_NAMES.map((name, i) => {
  // smooth falloff from 12,450 to ~5,200
  const points = Math.round(12450 - i * 118 - Math.pow(i, 1.35) * 9);
  return {
    id: `rival-${i}`,
    name,
    avatarId: (i * 5 + 1) % 12,
    points,
    level: Math.max(8, 24 - Math.floor(i / 3)),
    wins: Math.max(20, 210 - i * 3),
    badges: pick(BADGE_POOL, i, i < 3 ? 4 : i < 10 ? 3 : 2),
    online: i % 4 === 1,
  };
});

/** Friends list — fixed points so you overtake them as you improve. */
export const FRIENDS: LeaderboardEntry[] = [
  { id: 'friend-0', name: 'Mika', avatarId: 3, points: 3240, level: 9, wins: 41, badges: ['first-win', 'survivor', 'full-house'], online: true },
  { id: 'friend-1', name: 'Jin', avatarId: 6, points: 2680, level: 8, wins: 33, badges: ['first-win', 'games-10'], online: false },
  { id: 'friend-2', name: 'Haru', avatarId: 9, points: 2110, level: 7, wins: 27, badges: ['first-win', 'speed-master'], online: true },
  { id: 'friend-3', name: 'Sora', avatarId: 1, points: 1540, level: 5, wins: 19, badges: ['first-win'], online: false },
  { id: 'friend-4', name: 'Rei', avatarId: 4, points: 980, level: 4, wins: 11, badges: ['first-win'], online: false },
  { id: 'friend-5', name: 'Taro', avatarId: 8, points: 610, level: 3, wins: 6, badges: [], online: true },
  { id: 'friend-6', name: 'Noa', avatarId: 11, points: 340, level: 2, wins: 3, badges: [], online: false },
].map((f) => ({ ...f, isFriend: true }));

/** Population used to estimate global rank below the top 50. */
export const GLOBAL_POPULATION = 4812;
