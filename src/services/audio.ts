/*
 * Procedural sound engine (Web Audio). Every sound is synthesised at runtime —
 * no audio files, no licensing, near-zero download size.
 *
 * Screens may call these freely: they are silent no-ops until the first user
 * gesture unlocks audio, and when Web Audio is unavailable.
 *
 * Implementation lives in ./audio/:
 *   engine.ts    context lifecycle, voice pool (cap 24, 30 ms retrigger guard), settings
 *   graph.ts     buses → master → compressor, shared dark reverb + feedback echo;
 *                heavy buffers are generated in slices after the unlocking tap
 *   sfx.ts       the sound designs listed below
 *   ambience.ts  city / tension soundscapes
 *   voice.ts     per-sound node ownership and cleanup; kit.ts / dsp.ts building blocks
 */
import * as engine from './audio/engine';

export type Sfx =
  | 'tap' // generic button press
  | 'back' // navigate back
  | 'select' // select a tile / tab (pitch = frequency multiplier, e.g. per-pad tones)
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

/** Every effect name, in a stable order (handy for previews and tests). */
export const SFX_NAMES: readonly Sfx[] = [
  'tap',
  'back',
  'select',
  'confirm',
  'flip',
  'deal',
  'reveal',
  'glitch',
  'success',
  'fail',
  'error',
  'tick',
  'alarm',
  'heartbeat',
  'whoosh',
  'unlock',
  'levelup',
  'countdown',
  'go',
  'scan',
];

export const audio = {
  /** Create/resume the AudioContext. Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    engine.unlock();
  },
  /**
   * Play an effect. `volume` scales it (0–2, default 1); `pitch` multiplies its
   * frequencies (0.25–4, default 1). Gated by settings.sound. A foreground
   * 'heartbeat' briefly ducks the tension soundscape's own pulse so they never flam.
   */
  play(sfx: Sfx, opts?: { volume?: number; pitch?: number }): void {
    engine.play(sfx, opts);
  },
  /**
   * Start (or crossfade to) a looping soundscape. Persists across screens;
   * calling with the current kind is a no-op. Remembered while settings.music
   * is off or audio is still locked, and starts as soon as it can.
   */
  startAmbience(kind: Ambience = 'city'): void {
    engine.startAmbience(kind);
  },
  /** Fade the soundscape out and release it (a start within the fade picks it back up seamlessly). */
  stopAmbience(): void {
    engine.stopAmbience();
  },
  /** Re-read settings (sound/music/volume) — called when settings change. */
  sync(): void {
    engine.sync();
  },
};
