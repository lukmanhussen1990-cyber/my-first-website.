import type { Suit, SuitId } from './types';

export const SUIT_ORDER: SuitId[] = ['spade', 'heart', 'diamond', 'club'];

export const SUITS: Record<SuitId, Suit> = {
  spade: {
    id: 'spade',
    symbol: '♠',
    name: 'Spade',
    category: 'Physical',
    categoryLong: 'Physical Challenges',
    short: 'Physical',
    tagline: 'Speed. Strength. Endurance.',
    description:
      'Your reflexes are the only weapon you carry. Move fast, hold on longer than your body wants to, and outlast the clock.',
    tone: 'silver',
    games: ['reaction', 'stamina'],
  },
  heart: {
    id: 'heart',
    symbol: '♥',
    name: 'Heart',
    category: 'Psychological',
    categoryLong: 'Psychological Challenges',
    short: 'Social',
    tagline: 'Trust. Doubt. Sacrifice.',
    description:
      'Every choice costs someone something. Read the room, keep your memory sharp, and decide who you are when no one is watching.',
    tone: 'red',
    games: ['choice', 'memory'],
  },
  diamond: {
    id: 'diamond',
    symbol: '♦',
    name: 'Diamond',
    category: 'Logic',
    categoryLong: 'Logic & Intelligence',
    short: 'Logic',
    tagline: 'Order. Pattern. Proof.',
    description:
      'Numbers do not lie — people do. Break the system apart, find the rule hiding inside it, and solve it before it solves you.',
    tone: 'red',
    games: ['numberOrder', 'logic'],
  },
  club: {
    id: 'club',
    symbol: '♣',
    name: 'Club',
    category: 'Team Strategy',
    categoryLong: 'Team Strategy',
    short: 'Team',
    tagline: 'Signal. Coordinate. Escape.',
    description:
      'No one leaves this city alone. Relay signals without error, share what you find, and open the way out together.',
    tone: 'silver',
    games: ['pattern', 'escape'],
  },
};

export function isSuitId(v: string | undefined): v is SuitId {
  return v === 'spade' || v === 'heart' || v === 'diamond' || v === 'club';
}
