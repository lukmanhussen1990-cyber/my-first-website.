/*
 * Procedural sound engine (Web Audio). Every sound is synthesised at runtime —
 * no audio files, no licensing, near-zero download size.
 *
 * STUB: the public API below is final; the implementation is filled in by the
 * audio task. Screens may call these freely — they are no-ops until unlocked.
 */
import { getSettings } from '../state/settings';

export type Sfx =
  | 'tap' // generic button press
  | 'back' // navigate back
  | 'select' // select a tile / tab
  | 'confirm' // primary action
  | 'flip' // card flip
  | 'deal' // card slides onto table
  | 'reveal' // dramatic card reveal
  | 'glitch' // digital glitch burst
  | 'success' // trial survived
  | 'fail' // trial failed / eliminated
  | 'error' // wrong input
  | 'tick' // countdown tick
  | 'alarm' // timer critical
  | 'heartbeat' // tension pulse
  | 'whoosh' // screen transition
  | 'unlock' // achievement / zone unlocked
  | 'levelup' // level up fanfare
  | 'countdown' // 3-2-1 beep
  | 'go' // start signal
  | 'scan'; // map radar sweep

export type Ambience = 'city' | 'tension';

export const audio = {
  /** Create/resume the AudioContext. Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {},
  play(_sfx: Sfx, _opts?: { volume?: number; pitch?: number }): void {
    void getSettings;
  },
  startAmbience(_kind: Ambience = 'city'): void {},
  stopAmbience(): void {},
  /** Re-read settings (sound/music/volume) — called when settings change. */
  sync(): void {},
};
