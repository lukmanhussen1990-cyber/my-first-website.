import type { CardRank } from '../../data/types';

const RANK_NAME: Partial<Record<CardRank, string>> = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };

/** "A" → "Ace", "7" → "7" — for "Ace of Diamonds" style lines. */
export function rankName(rank: CardRank): string {
  return RANK_NAME[rank] ?? rank;
}
