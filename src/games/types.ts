import type { Challenge, GameResult } from '../data/types';

/**
 * Contract every mini-game component implements. The PlayScreen ("runner")
 * owns the trial chrome — title bar, overall countdown, pause menu, intro and
 * result overlays — and renders the game in the body area below the timer.
 */
export interface GameProps {
  /** the trial being played; game parameters live in challenge.game */
  challenge: Challenge;
  /** true while the pause menu (or intro countdown) is up — freeze timers/input */
  paused: boolean;
  /** remaining ms of the trial's overall time limit (updated ~4x per second) */
  timeLeftMs: number;
  /**
   * Call exactly once when the game ends. If the overall timer expires first,
   * the runner ends the trial as a loss itself and the game is unmounted.
   */
  onFinish: (result: GameResult) => void;
}

/*
 * GameResult.stats keys by game (read by state/rewards.ts for bests and
 * achievements — keep these names exactly):
 *   reaction    avgReactionMs, bestReactionMs, misses, rounds
 *   stamina     tapsPerSec, taps, minMeter (0..100)
 *   choice      empathy, survival
 *   memory      mistakes, pairs, seconds
 *   numberOrder moves, optimal
 *   logic       correct, total
 *   pattern     patternLength, mistakes
 *   escape      attempts, cluesFound
 */
