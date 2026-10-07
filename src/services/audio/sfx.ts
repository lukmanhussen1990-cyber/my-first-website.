/*
 * Sound designs. Shared palette so the set feels like one game:
 *   – transients are band-limited noise, never raw clicks
 *   – every UI sound carries a little sub "body" (the weight of a heavy UI)
 *   – tonal material lives in A minor / D major, with glassy sine chimes,
 *     detuned saws for drama and saturated sine drops for impacts
 *   – a dark hall reverb and a darkening echo give everything the same space
 *
 * `v.t` is the start time, `v.p` the pitch multiplier (all tonal content and
 * most filter centres scale with it, so `pitch` transposes a sound cleanly).
 */
import type { Sfx } from '../audio';
import { SILENT, ahr, crushCurve, driveCurve, glide, rand, randLog } from './dsp';
import { chime, hiss, saws, thump, tone } from './kit';
import type { Voice } from './voice';

type Design = (v: Voice) => void;

/* ── UI ────────────────────────────────────────────────────────────────── */

const tap: Design = (v) => {
  const { t, p } = v;
  hiss(v, t, 0.0008, 0.5, 0.016, 'bandpass', 3600 * p, 1.3);
  hiss(v, t, 0.001, 0.16, 0.035, 'lowpass', 1100 * p, 0.7);
  thump(v, t, 210 * p, 72 * p, 0.045, 0.42, 0.07);
  tone(v, 'sine', 2350 * p, t, 0.0008, 0.05, 0.022);
  v.send(0.05);
};

const select: Design = (v) => {
  const { t, p } = v;
  const f = 1046.5 * p; // C6 — soft and high, above the clicks
  const o = tone(v, 'sine', f, t, 0.004, 0.22, 0.17);
  glide(o.frequency, t, f * 1.012, f, 0.03);
  tone(v, 'sine', f * 2, t, 0.002, 0.035, 0.06);
  tone(v, 'triangle', f / 2, t, 0.005, 0.09, 0.12);
  hiss(v, t, 0.0006, 0.14, 0.01, 'highpass', 5200, 0.7);
  v.send(0.14);
};

const confirm: Design = (v) => {
  const { t, p } = v;
  // Two chime layers a fifth apart, the second slightly later: a rising "yes".
  chime(v, 659.25 * p, t, 0.15, 0.42);
  chime(v, 987.77 * p, t + 0.075, 0.15, 0.7);
  // Body: detuned saws whose filter sweeps open with the chimes.
  const amp = v.gain(0, v.out);
  ahr(amp.gain, t, 0.012, 0.1, 0.05, 0.28);
  const lp = v.filter('lowpass', 500, 2.2, amp);
  glide(lp.frequency, t, 500, 3400, 0.12);
  lp.frequency.exponentialRampToValueAtTime(700, t + 0.4);
  for (const d of [-8, 8]) {
    const o = v.osc('sawtooth', 329.63 * p, t, t + 0.4, lp, d);
    glide(o.frequency, t, 320 * p, 329.63 * p, 0.08);
  }
  thump(v, t, 170 * p, 60 * p, 0.07, 0.42, 0.13);
  hiss(v, t, 0.0008, 0.22, 0.018, 'bandpass', 4200 * p, 1.1);
  v.send(0.28);
};

const back: Design = (v) => {
  const { t, p } = v;
  const a = tone(v, 'sine', 760 * p, t, 0.002, 0.2, 0.09);
  glide(a.frequency, t, 760 * p, 330 * p, 0.08);
  const b = tone(v, 'triangle', 380 * p, t, 0.003, 0.08, 0.08);
  glide(b.frequency, t, 380 * p, 170 * p, 0.08);
  hiss(v, t, 0.0008, 0.3, 0.014, 'bandpass', 2600 * p, 1.2);
  thump(v, t, 130 * p, 55 * p, 0.05, 0.32, 0.075);
  v.send(0.06);
};

/* ── Cards ─────────────────────────────────────────────────────────────── */

const flip: Design = (v) => {
  const { t, p } = v;
  const swish = hiss(v, t, 0.04, 0.42, 0.09, 'bandpass', 1100 * p, 0.9);
  glide(swish.filter.frequency, t, 1100 * p, 5600 * p, 0.12);
  const snap = t + 0.105;
  hiss(v, snap, 0.0006, 0.45, 0.01, 'highpass', 3800 * p, 0.7); // paper tick
  hiss(v, snap, 0.001, 0.3, 0.035, 'bandpass', 1700 * p, 3); // card stock resonance
  thump(v, snap, 150 * p, 80 * p, 0.03, 0.16, 0.05);
  v.send(0.08);
};

const deal: Design = (v) => {
  const { t, p } = v;
  const pn = v.pan(rand(-0.25, 0.25), v.out);
  const amp = v.gain(0, pn.node);
  amp.gain.setValueAtTime(SILENT, t);
  amp.gain.linearRampToValueAtTime(0.42, t + 0.05);
  amp.gain.exponentialRampToValueAtTime(SILENT, t + 0.17);
  const bp = v.filter('bandpass', 3200 * p, 1.1, amp);
  glide(bp.frequency, t, 3200 * p, 850 * p, 0.16);
  const hp = v.filter('highpass', 380, 0.7, bp);
  v.noise(t, t + 0.19, hp, 1.1);
  const land = t + 0.14;
  hiss(v, land, 0.0008, 0.3, 0.022, 'bandpass', 1300 * p, 2.4, pn.node);
  thump(v, land, 120 * p, 62 * p, 0.035, 0.2, 0.06, pn.node);
  v.send(0.06);
};

const reveal: Design = (v) => {
  const { t, p } = v;
  // Boom: deep sine drop + a saturated overtone so phone speakers feel it too.
  thump(v, t, 95 * p, 31 * p, 0.55, 0.62, 1.7);
  const sat = v.shaper(driveCurve(3), v.gain(0.2, v.out));
  const ov = tone(v, 'triangle', 190 * p, t, 0.003, 0.7, 0.55, sat);
  glide(ov.frequency, t, 190 * p, 62 * p, 0.4);
  const impact = hiss(v, t, 0.002, 0.34, 0.6, 'lowpass', 1800, 0.8);
  glide(impact.filter.frequency, t, 1800, 160, 0.5);
  // Shimmering riser: a bright cluster climbing into place under a fast tremolo.
  const trem = v.gain(0.55, v.out);
  v.osc('sine', 9, t, t + 2.4, v.gain(0.4, trem.gain));
  [1, 1.498, 2, 2.997].forEach((m, i) => {
    const f = 880 * m * p;
    const amp = v.gain(0, trem);
    amp.gain.setValueAtTime(SILENT, t + 0.04);
    amp.gain.exponentialRampToValueAtTime(0.05 - i * 0.008, t + 0.95);
    amp.gain.exponentialRampToValueAtTime(SILENT, t + 2.3);
    const o = v.osc('sine', f, t + 0.04, t + 2.35, amp, rand(-7, 7));
    glide(o.frequency, t + 0.04, f * 0.75, f, 1.1);
  });
  const air = hiss(v, t + 0.05, 0.85, 0.12, 1.2, 'highpass', 2500, 0.8);
  glide(air.filter.frequency, t + 0.05, 2500, 9000, 0.9);
  v.send(0.5);
};

/* ── Digital ───────────────────────────────────────────────────────────── */

const glitch: Design = (v) => {
  const { t, p } = v;
  const end = t + rand(0.2, 0.36);
  const level = v.gain(0.26, v.out);
  const hp = v.filter('highpass', 160, 0.7, level);
  const crush = v.shaper(crushCurve(3), hp, 'none');
  // Gate: random stutter pattern.
  const chop = v.gain(0, crush);
  for (let x = t; x < end; x += rand(0.012, 0.045)) {
    chop.gain.setValueAtTime(Math.random() < 0.72 ? rand(0.3, 0.65) : 0, x);
  }
  chop.gain.setValueAtTime(0, end);
  // Square with sample-and-hold pitch jumps, ring-modulated for a torn digital edge.
  const ring = v.gain(0, chop);
  const sq = v.osc('square', 440 * p, t, end + 0.01, ring);
  for (let x = t; x < end; x += rand(0.018, 0.05)) sq.frequency.setValueAtTime(randLog(120, 2600) * p, x);
  v.osc('square', rand(30, 110), t, end + 0.01, ring.gain);
  // Noise through a jumping band-pass.
  const nAmp = v.gain(0.9, chop);
  const bp = v.filter('bandpass', 2000, 2.5, nAmp);
  for (let x = t; x < end; x += rand(0.02, 0.06)) bp.frequency.setValueAtTime(randLog(500, 7000), x);
  v.noise(t, end + 0.01, bp, rand(0.6, 1.6));
  thump(v, t, 240 * p, 60 * p, 0.03, 0.24, 0.05);
  v.send(0.1);
};

const error: Design = (v) => {
  const { t, p } = v;
  const post = v.gain(0.2, v.out);
  const lp = v.filter('lowpass', 1500, 1.4, post);
  const sat = v.shaper(driveCurve(2.5), lp);
  for (const dt of [0, 0.115]) {
    const amp = v.gain(0, sat);
    ahr(amp.gain, t + dt, 0.004, 0.65, 0.06, 0.03);
    v.osc('sawtooth', 146.83 * p, t + dt, t + dt + 0.12, amp, -6);
    v.osc('square', 146.83 * p, t + dt, t + dt + 0.12, amp, 7);
    thump(v, t + dt, 110 * p, 70 * p, 0.04, 0.22, 0.06);
  }
  v.send(0.05);
};

/* ── Results ───────────────────────────────────────────────────────────── */

const success: Design = (v) => {
  const { t, p } = v;
  // A–C–E (minor) climbs, then the chord lands on A major: C → C♯ is the relief.
  const pluck = (f: number, at: number, peak: number) => {
    tone(v, 'triangle', f, at, 0.003, peak, 0.42);
    tone(v, 'sine', f * 2, at, 0.002, peak * 0.35, 0.25);
  };
  pluck(440 * p, t, 0.17);
  pluck(523.25 * p, t + 0.085, 0.17);
  pluck(659.26 * p, t + 0.17, 0.18);
  const r = t + 0.3;
  for (const f of [220, 440, 554.37, 659.26]) {
    saws(v, f * p, r, 0.03, f < 300 ? 0.07 : 0.05, 0.5, 1.3, [600, 2600, 900]);
  }
  chime(v, 1108.73 * p, r + 0.02, 0.1, 1.2); // C♯6 — the major third, glinting on top
  chime(v, 1318.51 * p, r + 0.08, 0.07, 1.1);
  thump(v, r, 110 * p, 50 * p, 0.25, 0.45, 0.9);
  hiss(v, r, 0.002, 0.12, 0.4, 'highpass', 6000, 0.7);
  v.send(0.45);
};

const fail: Design = (v) => {
  const { t, p } = v;
  const post = v.gain(0.28, v.out);
  const lp = v.filter('lowpass', 2600, 1.6, post);
  glide(lp.frequency, t, 2600, 140, 1.1);
  const dist = v.shaper(driveCurve(5), lp);
  const pre = v.gain(0, dist);
  ahr(pre.gain, t, 0.01, 0.9, 0.25, 0.9);
  const layers: [OscillatorType, number, number][] = [
    ['sawtooth', 110, -16],
    ['sawtooth', 110, 14],
    ['square', 55.6, 0],
  ];
  for (const [type, f, detune] of layers) {
    const o = v.osc(type, f * p, t, t + 1.25, pre, detune);
    glide(o.frequency, t, f * p, f * p * 0.34, 1.1);
  }
  const debris = hiss(v, t, 0.004, 0.3, 0.7, 'lowpass', 1400, 0.9);
  glide(debris.filter.frequency, t, 1400, 120, 0.7);
  thump(v, t, 78 * p, 28 * p, 0.6, 0.6, 1.0);
  v.send(0.3);
};

const unlock: Design = (v) => {
  const { t, p } = v;
  // E major arpeggio, fast and bright, alternating left/right like sparks.
  [659.26, 830.61, 987.77, 1318.51, 1661.22, 1975.53].forEach((f, i) => {
    const pn = v.pan(i % 2 ? 0.3 : -0.3, v.out);
    chime(v, f * p, t + i * 0.048, 0.11 - i * 0.008, 0.75 - i * 0.05, pn.node);
  });
  hiss(v, t + 0.05, 0.08, 0.07, 0.6, 'highpass', 7500, 0.7);
  thump(v, t, 140 * p, 70 * p, 0.06, 0.25, 0.12);
  v.send(0.42);
};

const levelup: Design = (v) => {
  const { t, p } = v;
  // D major stacked from the bass up, brassy filters blooming, all releasing together.
  [146.83, 220, 293.66, 369.99, 440, 587.33, 739.99].forEach((f, i) => {
    saws(v, f * p, t + i * 0.065, 0.025, 0.05, 0.85 - i * 0.065, 0.9, [500, 3600, 1500]);
  });
  chime(v, 1174.66 * p, t + 0.46, 0.09, 1.3);
  chime(v, 1760 * p, t + 0.5, 0.05, 1.1);
  thump(v, t, 120 * p, 45 * p, 0.3, 0.5, 0.7);
  const rise = hiss(v, t, 0.42, 0.09, 0.5, 'bandpass', 800, 1.4);
  glide(rise.filter.frequency, t, 800, 7000, 0.45);
  v.send(0.4);
};

/* ── Timing & tension ──────────────────────────────────────────────────── */

const tick: Design = (v) => {
  const { t, p } = v;
  // Woody clock tick: two resonant noise "tocks" and a tiny pitched knock.
  hiss(v, t, 0.0005, 1.6, 0.018, 'bandpass', 2400 * p, 9);
  hiss(v, t, 0.0005, 1.0, 0.03, 'bandpass', 1150 * p, 7);
  const k = tone(v, 'sine', 2200 * p, t, 0.0005, 0.07, 0.02);
  glide(k.frequency, t, 2200 * p, 1700 * p, 0.02);
  tone(v, 'triangle', 620 * p, t, 0.0008, 0.06, 0.035);
  v.send(0.06);
};

const alarm: Design = (v) => {
  const { t, p } = v;
  const post = v.gain(0.2, v.out);
  const lp = v.filter('lowpass', 3200, 0.9, post);
  const sat = v.shaper(driveCurve(1.8), lp);
  const steps: [number, number][] = [
    [0, 987.77],
    [0.15, 739.99],
  ];
  for (const [dt, f] of steps) {
    const amp = v.gain(0, sat);
    ahr(amp.gain, t + dt, 0.004, 0.55, 0.11, 0.025);
    v.osc('sawtooth', f * p, t + dt, t + dt + 0.15, amp, -5);
    v.osc('square', f * p, t + dt, t + dt + 0.15, amp, 5);
  }
  thump(v, t, 140 * p, 90 * p, 0.05, 0.2, 0.08);
  v.send(0.14);
};

const heartbeat: Design = (v) => {
  const { t, p } = v;
  const lp = v.filter('lowpass', 420, 0.8, v.out);
  const beat = (at: number, k: number) => {
    thump(v, at, 82 * p, 42 * p, 0.09, 0.85 * k, 0.17);
    // Upper body so the beat still reads on small speakers.
    const o = tone(v, 'triangle', 165 * p, at, 0.003, 0.24 * k, 0.09, lp);
    glide(o.frequency, at, 165 * p, 85 * p, 0.08);
    hiss(v, at, 0.003, 0.14 * k, 0.06, 'lowpass', 260, 0.7);
  };
  beat(t, 1);
  beat(t + 0.23, 0.68);
  v.send(0.08);
};

const whoosh: Design = (v) => {
  const { t, p } = v;
  const pn = v.pan(-0.55, v.out);
  if (pn.pan) {
    pn.pan.setValueAtTime(-0.55, t);
    pn.pan.linearRampToValueAtTime(0.55, t + 0.42);
  }
  const amp = v.gain(0, pn.node);
  amp.gain.setValueAtTime(SILENT, t);
  amp.gain.linearRampToValueAtTime(0.5, t + 0.16);
  amp.gain.exponentialRampToValueAtTime(SILENT, t + 0.48);
  const bp = v.filter('bandpass', 380 * p, 1.2, amp);
  bp.frequency.setValueAtTime(380 * p, t);
  bp.frequency.exponentialRampToValueAtTime(3000 * p, t + 0.19);
  bp.frequency.exponentialRampToValueAtTime(800 * p, t + 0.48);
  v.noise(t, t + 0.5, bp);
  hiss(v, t, 0.15, 0.2, 0.3, 'lowpass', 260 * p, 0.8, pn.node, 0.5);
  v.send(0.18);
};

const countdown: Design = (v) => {
  const { t, p } = v;
  const amp = v.gain(0, v.out);
  ahr(amp.gain, t, 0.004, 0.26, 0.09, 0.09);
  v.osc('sine', 880 * p, t, t + 0.2, amp);
  v.osc('sine', 1760 * p, t, t + 0.2, v.gain(0.12, amp));
  hiss(v, t, 0.0006, 0.1, 0.008, 'highpass', 4000, 0.7);
  v.send(0.12);
};

const go: Design = (v) => {
  const { t, p } = v;
  const amp = v.gain(0, v.out);
  ahr(amp.gain, t, 0.003, 0.24, 0.16, 0.42);
  v.osc('sine', 1760 * p, t, t + 0.62, amp);
  v.osc('triangle', 880 * p, t, t + 0.62, v.gain(0.5, amp));
  v.osc('sine', 3520 * p, t, t + 0.62, v.gain(0.12, amp));
  thump(v, t, 92 * p, 34 * p, 0.38, 0.62, 1.05);
  const sat = v.shaper(driveCurve(3), v.gain(0.16, v.out));
  const ov = tone(v, 'triangle', 184 * p, t, 0.003, 0.7, 0.35, sat);
  glide(ov.frequency, t, 184 * p, 70 * p, 0.3);
  const impact = hiss(v, t, 0.002, 0.3, 0.4, 'lowpass', 1600, 0.8);
  glide(impact.filter.frequency, t, 1600, 180, 0.35);
  v.send(0.35);
};

const scan: Design = (v) => {
  const { t, p } = v;
  // Sonar ping — only the ping feeds the darkening feedback echo, for a long clean trail.
  const ping = v.gain(1, v.out);
  const main = tone(v, 'sine', 1240 * p, t, 0.002, 0.24, 0.5, ping);
  glide(main.frequency, t, 1240 * p, 1185 * p, 0.35);
  tone(v, 'sine', 2483 * p, t, 0.001, 0.05, 0.18, ping);
  tone(v, 'triangle', 620 * p, t, 0.003, 0.07, 0.32, ping);
  v.echo(0.75 * v.out.gain.value, ping); // pre-out, so scale by the voice level by hand
  // The radar arm: faint band-passed air sweeping across the stereo field.
  const pn = v.pan(-0.7, v.out);
  if (pn.pan) {
    pn.pan.setValueAtTime(-0.7, t);
    pn.pan.linearRampToValueAtTime(0.7, t + 0.6);
  }
  const sweep = hiss(v, t, 0.2, 0.06, 0.4, 'bandpass', 600, 2, pn.node);
  glide(sweep.filter.frequency, t, 600, 4200, 0.55);
  v.send(0.3);
};

/**
 * Per-effect trim so the set sits together. Balanced offline against the
 * ambience bed: UI clicks peak around −9 dBFS at full volume, feedback sounds
 * reach ≈ −20 LUFS-ish momentary, and the big moments ≈ −15. Negative feedback
 * (`error`) stays a touch under `alarm` so frequent mistakes inform rather than
 * punish; `tick` sits ≈ 10 dB clear of the tension bed it usually plays over.
 */
export const SFX_GAIN: Record<Sfx, number> = {
  tap: 2,
  back: 1.9,
  select: 2.5,
  confirm: 1.4,
  flip: 0.9,
  deal: 1.6,
  reveal: 1,
  glitch: 0.85,
  success: 1,
  fail: 0.9,
  error: 0.5,
  tick: 4.8,
  alarm: 0.8,
  heartbeat: 1,
  whoosh: 1,
  unlock: 1.3,
  levelup: 1,
  countdown: 1.1,
  go: 1,
  scan: 1.4,
};

export const SFX: Record<Sfx, Design> = {
  tap,
  back,
  select,
  confirm,
  flip,
  deal,
  reveal,
  glitch,
  success,
  fail,
  error,
  tick,
  alarm,
  heartbeat,
  whoosh,
  unlock,
  levelup,
  countdown,
  go,
  scan,
};
