// Story beats derived from the whisper word timings (assets/words.json).
export const FPS = 60;
export const DURATION = 35.866;
export const TOTAL_FRAMES = Math.round(DURATION * FPS);   // 2152

export let WORDS = [];
export let ENV = [];   // loudness envelope at 60fps, 0..1
export function setData(words, env) { WORDS = words; ENV = env; }
export function loud(t) { const f = t * FPS; const i = Math.max(0, Math.min(ENV.length - 2, Math.floor(f))); const k = f - i; return (ENV[i] ?? 0) * (1 - k) + (ENV[i + 1] ?? 0) * k; }

export const T = {
  // shot cuts
  S2: 4.22, S3: 5.80, S4: 8.80, S5: 11.74, P2: 12.82, P3: 13.47, P4: 14.43, S6: 15.70, DOG: 18.30, S6C: 19.25, S7: 19.86, S8: 24.12, S10: 26.48, S10B: 27.12,
  S11: 28.26, S11B: 31.02, S12: 32.66, S13: 34.84,
  // events
  ROCKS: [0.02, 1.16, 2.08, 2.94],
  TYPE_WORDS: [16, 17, 18, 19, 20, 21],
  SEND: 9.06, KB_HIDE: 9.22, WHIP: 9.50, FAMILY: 9.68, BEAT1: 10.06, BEAT2: 10.58, BEAT3: 10.86,
  MENU_IN: 15.45, TAPS: [16.10, 16.52, 16.95, 17.30], PIN: 19.50, MENU_OUT: 19.84,
  SEEN: 19.92, SEEN_DAD: 20.20, SEEN_UNCLE: 21.40, SEEN_GRANDMA: 22.92,
  MOM_TYPING: 24.22, DAD_TYPING: 25.46, THUNDER: 25.62, DAD_STOP: 28.0,
  LEFT: 26.56, SLAM: 27.60, MOM_REPLY: 29.84, DAD_AGAIN: 32.72, SCRATCH: 34.62, GENIUS: 35.06,
};
export const MESSAGE = 'your mom is so fucking hot';

// number of typed characters at time t (letters land across each spoken word)
export function typedCount(t) {
  let n = 0; const parts = MESSAGE.split(' ');
  for (let i = 0; i < parts.length; i++) {
    const w = WORDS[T.TYPE_WORDS[i]]; if (!w) break; const len = parts[i].length + (i > 0 ? 1 : 0);
    const s = w.s - 0.05, e = Math.min(w.e - 0.06, w.s + 0.06 * len + 0.12);
    if (t >= e) n += len; else if (t > s) { n += Math.min(len, Math.floor((t - s) / (e - s) * len) + 1); break; } else break;
  }
  return n;
}
export function keyTimes() {   // [{t, ch}] for key-press highlights and tap SFX
  const out = []; const parts = MESSAGE.split(' ');
  for (let i = 0; i < parts.length; i++) { const w = WORDS[T.TYPE_WORDS[i]]; const str = (i > 0 ? ' ' : '') + parts[i]; const len = str.length; const s = w.s - 0.05, e = Math.min(w.e - 0.06, w.s + 0.06 * len + 0.12); for (let k = 0; k < len; k++) out.push({ t: s + (e - s) * k / len, ch: str[k] }); }
  return out;
}
