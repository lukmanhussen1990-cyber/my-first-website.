// Procedural radio programme material. Both "stations" are deterministic
// functions of their musical step index (seeded per section), so switching
// away and back sounds like a broadcast that kept playing.
//
// Notes are scheduled ahead of time by Radio.schedule() (lookahead pump);
// nothing here runs per frame.

import { mtof, mulberry32, biquad, gainNode, disposeOnEnd, clamp } from './dsp.js';

// ---------------------------------------------------------------------------
// 96.4 FM · NIGHT DRIVE — slow, warm, slightly melancholic

const BPM = 70;
const STEP = 60 / BPM / 2; // eighth note
const SWING = 0.045; // late off-beats for a lazy feel
const STEPS_PER_BAR = 8;
const STEPS_PER_CHORD = 16; // two bars per chord
const STEPS_PER_SECTION = 64; // four chords

// Diatonic to C major / A minor: everything stays consonant.
const CHORDS = {
  Am9: { bass: 45, pad: [57, 60, 64, 67, 71], tones: [57, 60, 64, 67, 71] },
  Fmaj7: { bass: 41, pad: [53, 57, 64, 67, 72], tones: [53, 57, 60, 64, 67] },
  Cmaj7: { bass: 48, pad: [55, 60, 64, 71], tones: [55, 59, 60, 64, 67] },
  G6: { bass: 43, pad: [55, 59, 62, 64, 71], tones: [55, 59, 62, 64, 67] },
  Dm9: { bass: 38, pad: [53, 57, 60, 64, 69], tones: [50, 53, 57, 60, 64] },
  Em7: { bass: 40, pad: [55, 59, 62, 67], tones: [52, 55, 59, 62, 64] },
};

const PROGRESSIONS = {
  A: ['Am9', 'Fmaj7', 'Cmaj7', 'G6'],
  B: ['Fmaj7', 'G6', 'Em7', 'Am9'],
  C: ['Dm9', 'Am9', 'Fmaj7', 'G6'],
};
const FORM = ['A', 'A', 'B', 'A', 'C', 'A', 'B', 'C'];

const SCALE_PCS = [0, 2, 4, 5, 7, 9, 11]; // C major / A minor

const RHYTHMS = [
  [0, 3, 6],
  [0, 2, 4, 6],
  [0, 3, 4, 7],
  [2, 3, 6],
  [0, 4, 5],
  [1, 4, 6],
  [0, 6],
  [0, 2, 3, 6],
];

/** Melody pitches allowed over a chord: scale notes minus "avoid" notes a semitone above a chord tone. */
function allowedPitches(chord, lo = 62, hi = 84) {
  const pcs = new Set(chord.tones.map((m) => m % 12));
  const out = [];
  for (let m = lo; m <= hi; m++) {
    const pc = m % 12;
    if (!SCALE_PCS.includes(pc)) continue;
    if (!pcs.has(pc) && pcs.has((pc + 11) % 12)) continue;
    out.push(m);
  }
  return out;
}

function chordPitches(chord, lo = 62, hi = 84) {
  const pcs = new Set(chord.tones.map((m) => m % 12));
  const out = [];
  for (let m = lo; m <= hi; m++) if (pcs.has(m % 12)) out.push(m);
  return out;
}

function nearestIndex(list, m) {
  let best = 0;
  for (let i = 1; i < list.length; i++) if (Math.abs(list[i] - m) < Math.abs(list[best] - m)) best = i;
  return best;
}

export class NightDriveMusic {
  /**
   * @param {BaseAudioContext} ctx
   * @param {AudioNode} out destination (radio music input)
   * @param {{white: AudioBuffer}} noise shared noise buffers
   */
  constructor(ctx, out, noise) {
    this.ctx = ctx;
    this.noise = noise;
    this.out = gainNode(ctx, 1);
    this.out.connect(out);
    this.active = false;
    this.t0 = 0;
    this.k = 0;
    this.nextTime = 0;
    this.plans = new Map();

    // shared pad bus: warm low-pass that breathes slowly
    this.padBus = gainNode(ctx, 0.5);
    this.padFilter = biquad(ctx, 'lowpass', 1100, 0.6);
    this.padLfo = ctx.createOscillator();
    this.padLfo.frequency.value = 0.045;
    this.padLfoDepth = gainNode(ctx, 380);
    this.padLfo.connect(this.padLfoDepth).connect(this.padFilter.frequency);
    this.padBus.connect(this.padFilter).connect(this.out);
    this.keysBus = gainNode(ctx, 0.55);
    this.keysBus.connect(this.out);
    this.bassBus = gainNode(ctx, 0.55);
    this.bassBus.connect(this.out);
    this.brushBus = gainNode(ctx, 0.12);
    this.brushFilter = biquad(ctx, 'bandpass', 6000, 0.8);
    this.brushBus.connect(this.brushFilter).connect(this.out);
    this.padLfo.start();
  }

  /** Start/stop generating notes; the musical clock keeps running while inactive. */
  setActive(on, now) {
    if (on === this.active) return;
    this.active = on;
    if (!on) return;
    if (!this.t0) this.t0 = now + 0.1;
    this.k = Math.max(0, Math.ceil((now + 0.05 - this.t0) / STEP));
    this.nextTime = this.stepTime(this.k);
    // joining mid-chord: bring the current pad in so it never starts empty
    const chordStart = Math.floor(this.k / STEPS_PER_CHORD) * STEPS_PER_CHORD;
    if (this.k !== chordStart) {
      const chord = this.chordAt(this.k);
      const end = this.stepTime(chordStart + STEPS_PER_CHORD);
      this.pad(chord, now + 0.05, end, 1.2);
      this.bass(chord, now + 0.05, end);
    }
  }

  stepTime(k) {
    return this.t0 + k * STEP + (k % 2 ? SWING * STEP * 2 : 0);
  }

  chordAt(k) {
    const section = Math.floor(k / STEPS_PER_SECTION);
    const prog = PROGRESSIONS[FORM[section % FORM.length]];
    return CHORDS[prog[Math.floor((k % STEPS_PER_SECTION) / STEPS_PER_CHORD)]];
  }

  /** Per-section plan: a motif (rhythm + contour) reused across the section. */
  plan(section) {
    let p = this.plans.get(section);
    if (p) return p;
    const rng = mulberry32(0x9e3779b1 ^ (section * 7919));
    const form = FORM[section % FORM.length];
    const rhythmA = RHYTHMS[Math.floor(rng() * RHYTHMS.length)];
    const rhythmB = RHYTHMS[Math.floor(rng() * RHYTHMS.length)];
    const contour = [];
    let pos = 0;
    for (let i = 0; i < 10; i++) {
      const r = rng();
      pos += r < 0.3 ? -1 : r < 0.55 ? 1 : r < 0.7 ? -2 : r < 0.85 ? 2 : 0;
      pos = clamp(pos, -4, 4);
      contour.push(pos);
    }
    p = {
      form,
      rhythmA,
      rhythmB,
      contour,
      centre: 70 + Math.floor(rng() * 6),
      melody: form !== 'C' || section % 3 === 0,
      brushes: section > 0 && form !== 'C',
      seed: Math.floor(rng() * 1e9),
    };
    this.plans.set(section, p);
    if (this.plans.size > 6) this.plans.delete(this.plans.keys().next().value);
    return p;
  }

  /** Schedule all steps whose time is before `until`; skips ahead after a stall. */
  schedule(now, until) {
    if (!this.active) return;
    if (this.nextTime < now - 0.2) {
      this.k = Math.max(0, Math.ceil((now + 0.05 - this.t0) / STEP));
      this.nextTime = this.stepTime(this.k);
    }
    let guard = 64;
    while (this.nextTime < until && guard-- > 0) {
      this.playStep(this.k, this.nextTime);
      this.k++;
      this.nextTime = this.stepTime(this.k);
    }
  }

  playStep(k, t) {
    const section = Math.floor(k / STEPS_PER_SECTION);
    const inSection = k % STEPS_PER_SECTION;
    const bar = Math.floor(inSection / STEPS_PER_BAR);
    const step = k % STEPS_PER_BAR;
    const plan = this.plan(section);
    const chord = this.chordAt(k);
    const rng = mulberry32(plan.seed + k * 131);

    if (inSection % STEPS_PER_CHORD === 0) {
      const end = this.stepTime(k + STEPS_PER_CHORD);
      this.pad(chord, t, end, 1.6);
      this.bass(chord, t, end);
    }

    if (plan.brushes && (step === 2 || step === 6 || (step === 7 && rng() < 0.3))) {
      this.brush(t, step === 7 ? 0.35 : 0.8 + rng() * 0.2);
    }

    const firstBarOfChord = bar % 2 === 0;
    const useMelody = plan.melody && (bar === 0 || bar === 4 || (plan.form === 'B' && bar === 2));
    if (useMelody) {
      const rhythm = bar === 4 ? plan.rhythmB : plan.rhythmA;
      const idx = rhythm.indexOf(step);
      if (idx >= 0) {
        const strong = step === 0 || step === 4;
        const pool = strong ? chordPitches(chord, 62, 84) : allowedPitches(chord);
        const target = plan.centre + plan.contour[idx % plan.contour.length] * 2;
        const m = pool[nearestIndex(pool, target)];
        const next = rhythm[idx + 1] ?? STEPS_PER_BAR + 1;
        const dur = (next - step) * STEP * (0.9 + rng() * 0.3);
        this.keys(m, t + (rng() - 0.5) * 0.012, dur, 0.55 + rng() * 0.25);
        if (strong && rng() < 0.35) this.keys(m - 12, t + 0.02, dur, 0.25);
      }
    } else if (firstBarOfChord || rng() < 0.4) {
      // sparse arpeggio of chord tones
      const rhythm = RHYTHMS[(k >> 3) % RHYTHMS.length];
      const idx = rhythm.indexOf(step);
      if (idx >= 0 && rng() < (firstBarOfChord ? 0.9 : 0.55)) {
        const tones = chordPitches(chord, 60, 79);
        const dir = (section + bar) % 2 ? -1 : 1;
        const i0 = dir > 0 ? idx : tones.length - 1 - idx;
        const m = tones[clamp(i0 + ((section >> 1) % 2), 0, tones.length - 1)];
        this.keys(m, t + (rng() - 0.5) * 0.012, STEP * 3, 0.32 + rng() * 0.18);
      }
    }
  }

  /** Soft detuned saw pad, slow attack, long release (overlaps the next chord). */
  pad(chord, t, end, attack) {
    const ctx = this.ctx;
    const release = 2.4;
    for (let i = 0; i < chord.pad.length; i++) {
      const f = mtof(chord.pad[i]);
      const g = gainNode(ctx, 0);
      const level = 0.07 / Math.sqrt(chord.pad.length / 4);
      g.gain.setValueAtTime(0, t);
      g.gain.setTargetAtTime(level, t, attack / 3);
      g.gain.setTargetAtTime(0, end, release / 4);
      const nodes = [g];
      let last = null;
      for (const det of [-7, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det + (i - 2) * 1.5;
        o.connect(g);
        o.start(t);
        o.stop(end + release * 1.6);
        nodes.push(o);
        last = o;
      }
      g.connect(this.padBus);
      disposeOnEnd(last, nodes);
    }
  }

  /** Soft sub bass: sine plus a little octave so it survives small speakers. */
  bass(chord, t, end) {
    const ctx = this.ctx;
    const f = mtof(chord.bass);
    const g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.12);
    g.gain.setTargetAtTime(0.2, t + 0.12, 1.2);
    g.gain.setTargetAtTime(0, end - 0.05, 0.15);
    const o1 = ctx.createOscillator();
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.frequency.value = f * 2;
    const g2 = gainNode(ctx, 0.3);
    o1.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.bassBus);
    o1.start(t);
    o2.start(t);
    o1.stop(end + 1);
    o2.stop(end + 1);
    disposeOnEnd(o2, [o1, o2, g2, g]);
  }

  /** Gentle electric piano: 1:1 FM with a decaying index and a faint tine. */
  keys(m, t, dur, vel) {
    const ctx = this.ctx;
    const f = mtof(m);
    t = Math.max(t, ctx.currentTime + 0.005);
    const decay = clamp(1.4 - (m - 60) * 0.03, 0.5, 1.5);
    const end = t + Math.max(0.15, dur);
    const stopAt = Math.min(t + decay * 5, end + 0.8);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f;
    const idx = gainNode(ctx, 0);
    idx.gain.setValueAtTime(f * 1.1 * vel, t);
    idx.gain.setTargetAtTime(f * 0.18, t, 0.25);
    mod.connect(idx).connect(car.frequency);
    const amp = gainNode(ctx, 0);
    const peak = 0.16 * vel;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.006);
    amp.gain.setTargetAtTime(0, t + 0.006, decay);
    amp.gain.setTargetAtTime(0, end, 0.14);
    const tine = ctx.createOscillator();
    tine.frequency.value = f * 4;
    const tg = gainNode(ctx, 0);
    tg.gain.setValueAtTime(0, t);
    tg.gain.linearRampToValueAtTime(peak * 0.12, t + 0.003);
    tg.gain.setTargetAtTime(0, t + 0.003, 0.05);
    tine.connect(tg).connect(amp);
    car.connect(amp).connect(this.keysBus);
    for (const o of [car, mod, tine]) {
      o.start(t);
      o.stop(stopAt);
    }
    disposeOnEnd(car, [car, mod, idx, tine, tg, amp]);
  }

  brush(t, vel) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise.white;
    const g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.004, 0.045);
    src.connect(g).connect(this.brushBus);
    src.start(t, Math.random() * 2);
    src.stop(t + 0.35);
    disposeOnEnd(src, [src, g]);
  }
}

// ---------------------------------------------------------------------------
// AM 1520 — a faint, slowed old waltz drifting under the static

const AM_BEAT = 60 / 50;
const AM_PITCH = 0.943; // "slowed record": a little under a semitone flat
// [midi | null, beats]; D minor (harmonic), 3/4
const AM_TUNE = [
  [69, 2], [65, 1], [64, 2], [62, 1], [61, 2], [62, 1], [64, 3],
  [65, 2], [67, 1], [69, 2], [70, 1], [69, 2], [67, 1], [65, 3],
  [64, 2], [65, 1], [67, 2], [64, 1], [65, 2], [62, 1], [61, 3],
  [62, 2], [64, 1], [65, 2], [64, 1], [62, 3], [null, 3],
];
const AM_CHORDS = {
  Dm: { root: 50, notes: [57, 62, 65] },
  A7: { root: 45, notes: [55, 61, 64] },
  Gm6: { root: 43, notes: [52, 58, 62] },
};
const AM_BARS = ['Dm', 'Dm', 'A7', 'A7', 'Dm', 'Dm', 'Gm6', 'Dm', 'A7', 'A7', 'Dm', 'A7', 'Dm', 'Gm6', 'Dm', 'Dm'];

export class AmGhost {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = gainNode(ctx, 1);
    this.out.connect(out);
    this.active = false;
    this.nextTime = 0;
    this.noteIdx = 0;
    this.beatInTune = 0;
    this.pauseBars = 0;
    this.rng = mulberry32(1520);
    this.vib = ctx.createOscillator();
    this.vib.frequency.value = 4.6;
    this.vibDepth = gainNode(ctx, 9); // cents
    this.vib.connect(this.vibDepth);
    this.vib.start();
  }

  setActive(on, now) {
    if (on === this.active) return;
    this.active = on;
    if (on) this.nextTime = Math.max(this.nextTime, now + 0.15);
  }

  schedule(now, until) {
    if (!this.active) return;
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.05;
    let guard = 32;
    while (this.nextTime < until && guard-- > 0) {
      const t = this.nextTime;
      if (this.pauseBars > 0) {
        this.pauseBars--;
        this.nextTime += AM_BEAT * 3;
        continue;
      }
      const [m, beats] = AM_TUNE[this.noteIdx];
      const bar = Math.floor(this.beatInTune / 3) % AM_BARS.length;
      const beatInBar = this.beatInTune % 3;
      const dur = beats * AM_BEAT;
      if (m !== null) this.voice(m, t, dur * 0.95, 0.22, 'triangle');
      // oom-pah-pah accompaniment on every beat covered by this note
      for (let b = 0; b < beats; b++) {
        const bb = (beatInBar + b) % 3;
        const chord = AM_CHORDS[AM_BARS[(bar + Math.floor((beatInBar + b) / 3)) % AM_BARS.length]];
        const tb = t + b * AM_BEAT;
        if (bb === 0) this.voice(chord.root, tb, AM_BEAT * 0.9, 0.2, 'sine');
        else for (const n of chord.notes) this.voice(n, tb, AM_BEAT * 0.5, 0.05, 'sine');
      }
      this.beatInTune += beats;
      this.nextTime += dur;
      this.noteIdx++;
      if (this.noteIdx >= AM_TUNE.length) {
        this.noteIdx = 0;
        this.beatInTune = 0;
        this.pauseBars = 2 + Math.floor(this.rng() * 4); // drifts out between repeats
      }
    }
  }

  voice(m, t, dur, vel, type) {
    const ctx = this.ctx;
    t = Math.max(t, ctx.currentTime + 0.005);
    const f = mtof(m) * AM_PITCH;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    this.vibDepth.connect(o.detune);
    const o2 = ctx.createOscillator();
    o2.frequency.value = f * 2.003;
    const g2 = gainNode(ctx, 0.25);
    const g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.04);
    g.gain.setTargetAtTime(vel * 0.45, t + 0.04, 0.4);
    g.gain.setTargetAtTime(0, t + dur, 0.12);
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.out);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.8);
    o2.stop(t + dur + 0.8);
    o.onended = () => {
      try { this.vibDepth.disconnect(o.detune); } catch (e) { /* gone */ }
      for (const n of [o, o2, g2, g]) n.disconnect();
    };
  }
}
