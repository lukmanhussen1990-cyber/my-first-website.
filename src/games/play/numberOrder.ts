/*
 * Number-order puzzle rules (pure). A board is an array where board[i] is the
 * number shown at position i; it is solved when board[i] === i + 1.
 */
import { mulberry32, shuffle } from './rng';

export function isSolved(board: readonly number[]): boolean {
  return board.every((v, i) => v === i + 1);
}

/** Minimum swaps to sort a permutation = n − (number of cycles). */
export function minSwaps(board: readonly number[]): number {
  const n = board.length;
  const seen = new Array<boolean>(n).fill(false);
  let cycles = 0;
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    cycles++;
    let j = i;
    while (!seen[j]) {
      seen[j] = true;
      j = board[j] - 1;
    }
  }
  return n - cycles;
}

/** Seeded scramble that is never already solved and never trivially short. */
export function scramble(size: number, seed: number): number[] {
  const n = size * size;
  const sorted = Array.from({ length: n }, (_, i) => i + 1);
  const rand = mulberry32(seed);
  const floor = Math.ceil(n / 2);
  let board = shuffle(sorted, rand);
  for (let tries = 0; minSwaps(board) < floor && tries < 24; tries++) board = shuffle(sorted, rand);
  if (isSolved(board)) [board[0], board[1]] = [board[1], board[0]];
  return board;
}

export function placedCount(board: readonly number[]): number {
  return board.reduce((sum, v, i) => sum + (v === i + 1 ? 1 : 0), 0);
}
