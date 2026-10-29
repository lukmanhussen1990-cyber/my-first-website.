// Tiny offline DSP toolkit for Grace in Motion reels (Node, no deps).
// Everything is deterministic: noise comes from a seeded PRNG.
import {readFileSync, writeFileSync} from 'node:fs';

export const SR = 48000;

// --- buffers ------------------------------------------------------------------

export class Stereo {
  L: Float32Array;
  R: Float32Array;
  constructor(public_len: number) {
    this.L = new Float32Array(public_len);
    this.R = new Float32Array(public_len);
  }
  get length() {
    return this.L.length;
  }
  /** Mix a mono signal in at time t (seconds) with gain and pan (-1..1). */
  addMono(sig: Float32Array, t: number, gain = 1, pan = 0) {
    const o = Math.round(t * SR);
    const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    for (let i = 0; i < sig.length; i++) {
      const j = o + i;
      if (j < 0 || j >= this.L.length) continue;
      this.L[j] += sig[i] * gl;
      this.R[j] += sig[i] * gr;
    }
  }
  addStereo(src: Stereo, t: number, gain = 1) {
    const o = Math.round(t * SR);
    for (let i = 0; i < src.length; i++) {
      const j = o + i;
      if (j < 0 || j >= this.L.length) continue;
      this.L[j] += src.L[i] * gain;
      this.R[j] += src.R[i] * gain;
    }
  }
  scale(g: number) {
    for (let i = 0; i < this.length; i++) {
      this.L[i] *= g;
      this.R[i] *= g;
    }
  }
  peak() {
    let p = 0;
    for (let i = 0; i < this.length; i++) p = Math.max(p, Math.abs(this.L[i]), Math.abs(this.R[i]));
    return p;
  }
}

export const sec = (t: number) => Math.max(1, Math.round(t * SR));

// --- WAV I/O --------------------------------------------------------------------

export const writeWav = (path: string, s: Stereo) => {
  const n = s.length;
  const buf = Buffer.alloc(44 + n * 8);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 8, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20); // IEEE float
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 8, 28);
  buf.writeUInt16LE(8, 32);
  buf.writeUInt16LE(32, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i++) {
    buf.writeFloatLE(s.L[i], 44 + i * 8);
    buf.writeFloatLE(s.R[i], 48 + i * 8);
  }
  writeFileSync(path, buf);
};

/** Read a 16/24/32-bit PCM or 32-bit float WAV (any channel count → stereo). */
export const readWav = (path: string): Stereo => {
  const b = readFileSync(path);
  let p = 12;
  let fmt = 1;
  let ch = 1;
  let bits = 16;
  let sr = SR;
  let data: Buffer | null = null;
  while (p < b.length - 8) {
    const id = b.toString('ascii', p, p + 4);
    const size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') {
      fmt = b.readUInt16LE(p + 8);
      ch = b.readUInt16LE(p + 10);
      sr = b.readUInt32LE(p + 12);
      bits = b.readUInt16LE(p + 22);
      if (fmt === 0xfffe) fmt = b.readUInt16LE(p + 32);
    } else if (id === 'data') {
      data = b.subarray(p + 8, p + 8 + size);
    }
    p += 8 + size + (size % 2);
  }
  if (!data) throw new Error('no data chunk');
  if (sr !== SR) throw new Error(`expected ${SR} Hz, got ${sr}`);
  const bps = bits / 8;
  const frames = Math.floor(data.length / (bps * ch));
  const out = new Stereo(frames);
  const rd = (o: number) => {
    if (fmt === 3) return bits === 64 ? data!.readDoubleLE(o) : data!.readFloatLE(o);
    if (bits === 16) return data!.readInt16LE(o) / 32768;
    if (bits === 24) return data!.readIntLE(o, 3) / 8388608;
    return data!.readInt32LE(o) / 2147483648;
  };
  for (let i = 0; i < frames; i++) {
    const l = rd(i * ch * bps);
    const r = ch > 1 ? rd(i * ch * bps + bps) : l;
    out.L[i] = l;
    out.R[i] = r;
  }
  return out;
};

// --- randomness -------------------------------------------------------------------

export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const whiteNoise = (n: number, seed: number) => {
  const r = rng(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = r() * 2 - 1;
  return out;
};

export const brownNoise = (n: number, seed: number) => {
  const w = whiteNoise(n, seed);
  const out = new Float32Array(n);
  let v = 0;
  for (let i = 0; i < n; i++) {
    v = (v + 0.02 * w[i]) / 1.02;
    out[i] = v * 3.5;
  }
  return out;
};

// --- filters ----------------------------------------------------------------------

type BiquadType = 'lowpass' | 'highpass' | 'bandpass' | 'peak';

/** RBJ biquad, in place. `freq` may be a function of the sample index for sweeps. */
export const biquad = (x: Float32Array, type: BiquadType, freq: number | ((i: number) => number), q = 0.707, gainDb = 0) => {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  const calc = (f: number) => {
    const w = (2 * Math.PI * Math.max(20, Math.min(f, SR * 0.45))) / SR;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const alpha = sw / (2 * q);
    let a0 = 1;
    if (type === 'lowpass') {
      b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    } else if (type === 'highpass') {
      b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    } else if (type === 'bandpass') {
      b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    } else {
      const A = Math.pow(10, gainDb / 40);
      b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A;
    }
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  };
  const dyn = typeof freq === 'function';
  if (!dyn) calc(freq as number);
  for (let i = 0; i < x.length; i++) {
    if (dyn && i % 32 === 0) calc((freq as (i: number) => number)(i));
    const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
};

export const applyEnv = (x: Float32Array, env: (t: number) => number) => {
  for (let i = 0; i < x.length; i++) x[i] *= env(i / SR);
  return x;
};

/** Attack/decay envelope (seconds). */
export const ad = (attack: number, decay: number, curve = 4) => (t: number) =>
  t < attack ? t / attack : Math.exp((-(t - attack) / decay) * curve * 0.25);

export const adsr = (a: number, d: number, s: number, hold: number, r: number) => (t: number) => {
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < hold) return s;
  if (t < hold + r) return s * (1 - (t - hold) / r);
  return 0;
};

// --- oscillators / instruments ----------------------------------------------------

const TABLE = 4096;
const makeTable = (harm: (n: number) => number, count: number) => {
  const t = new Float32Array(TABLE + 1);
  for (let n = 1; n <= count; n++) {
    const a = harm(n);
    if (!a) continue;
    for (let i = 0; i <= TABLE; i++) t[i] += a * Math.sin((2 * Math.PI * n * i) / TABLE);
  }
  let m = 0;
  for (let i = 0; i <= TABLE; i++) m = Math.max(m, Math.abs(t[i]));
  for (let i = 0; i <= TABLE; i++) t[i] /= m;
  return t;
};
export const TABLES = {
  sine: makeTable((n) => (n === 1 ? 1 : 0), 1),
  warmSaw: makeTable((n) => 1 / n, 10),
  soft: makeTable((n) => [1, 0.35, 0.12, 0.05, 0.02][n - 1] ?? 0, 5),
  felt: makeTable((n) => [1, 0.42, 0.18, 0.09, 0.04, 0.02][n - 1] ?? 0, 6),
};

/** Wavetable oscillator with optional vibrato (Hz, depth in cents). */
export const osc = (table: Float32Array, freq: number, dur: number, vibHz = 0, vibCents = 0, phase0 = 0) => {
  const n = sec(dur);
  const out = new Float32Array(n);
  let ph = phase0 * TABLE;
  for (let i = 0; i < n; i++) {
    const f = vibHz ? freq * Math.pow(2, (vibCents / 1200) * Math.sin((2 * Math.PI * vibHz * i) / SR)) : freq;
    ph += (f * TABLE) / SR;
    while (ph >= TABLE) ph -= TABLE;
    const k = ph | 0;
    const fr = ph - k;
    out[i] = table[k] + (table[k + 1] - table[k]) * fr;
  }
  return out;
};

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Soft felt piano note. */
export const feltPiano = (midi: number, dur: number, vel = 0.7, seed = 1) => {
  const f = mtof(midi);
  const len = dur + 2.5;
  const n = sec(len);
  const out = new Float32Array(n);
  const body = osc(TABLES.felt, f, len, 0, 0, (seed * 0.137) % 1);
  const upper = osc(TABLES.sine, f * 2.003, len);
  const decay = 1.2 + 2.6 * Math.exp(-(midi - 48) / 22); // low notes ring longer
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const atk = Math.min(1, t / 0.008);
    const rel = t > dur ? Math.exp(-(t - dur) / 0.35) : 1;
    const e = atk * Math.exp(-t / decay) * rel;
    const eu = atk * Math.exp(-t / (decay * 0.3)) * rel;
    out[i] = (body[i] * e + 0.25 * upper[i] * eu) * vel;
  }
  // felt thump
  const th = whiteNoise(sec(0.03), seed * 31 + midi);
  biquad(th, 'lowpass', 900);
  for (let i = 0; i < th.length; i++) out[i] += th[i] * 0.18 * vel * (1 - i / th.length);
  biquad(out, 'lowpass', 2600 + midi * 18, 0.6);
  return out;
};

/** Warm pad chord: detuned soft saws, slow envelope, low-passed. */
export const pad = (midis: number[], dur: number, attack = 1.8, release = 2.4, cutoff = 1400, seed = 1) => {
  const n = sec(dur + release);
  const out = new Float32Array(n);
  const r = rng(seed);
  for (const m of midis) {
    for (const det of [-7, 0, 6]) {
      const o = osc(TABLES.warmSaw, mtof(m) * Math.pow(2, det / 1200), dur + release, 0.2 + r() * 0.3, 4, r());
      for (let i = 0; i < n; i++) out[i] += o[i];
    }
  }
  biquad(out, 'lowpass', cutoff, 0.7);
  biquad(out, 'lowpass', cutoff * 1.4, 0.6);
  const g = 1 / (midis.length * 3);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = t < attack ? Math.sin(((t / attack) * Math.PI) / 2) : t < dur ? 1 : Math.max(0, 1 - (t - dur) / release);
    out[i] *= e * g;
  }
  return out;
};

/** Light strings: brighter detuned saws with vibrato and slow bow. */
export const strings = (midis: number[], dur: number, attack = 1.2, release = 1.8, seed = 3) => {
  const n = sec(dur + release);
  const out = new Float32Array(n);
  const r = rng(seed);
  for (const m of midis) {
    for (const det of [-5, 4]) {
      const o = osc(TABLES.warmSaw, mtof(m) * Math.pow(2, det / 1200), dur + release, 5 + r(), 9, r());
      for (let i = 0; i < n; i++) out[i] += o[i];
    }
  }
  biquad(out, 'lowpass', 3200, 0.6);
  biquad(out, 'highpass', 180, 0.6);
  const g = 1 / (midis.length * 2);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = t < attack ? t / attack : t < dur ? 1 : Math.max(0, 1 - (t - dur) / release);
    out[i] *= e * e * g;
  }
  return out;
};

/** Bell / chime partials. */
export const bell = (freq: number, dur = 1.6, bright = 1) => {
  const n = sec(dur);
  const out = new Float32Array(n);
  const parts: [number, number, number][] = [
    [1, 1, 1],
    [2.76, 0.45 * bright, 0.55],
    [5.4, 0.22 * bright, 0.3],
    [8.93, 0.1 * bright, 0.18],
  ];
  for (const [ratio, amp, dk] of parts) {
    const o = osc(TABLES.sine, freq * ratio, dur);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      out[i] += o[i] * amp * Math.min(1, t / 0.003) * Math.exp(-t / (dur * 0.28 * dk));
    }
  }
  return out;
};

// --- reverb (Freeverb-style) --------------------------------------------------------

export const reverb = (src: Stereo, room = 0.86, damp = 0.35, wet = 0.4, predelay = 0.02): Stereo => {
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((v) => Math.round((v * SR) / 44100));
  const apT = [556, 441, 341, 225].map((v) => Math.round((v * SR) / 44100));
  const spread = Math.round((23 * SR) / 44100);
  const pd = Math.round(predelay * SR);
  const tail = sec(4);
  const out = new Stereo(src.length + tail);
  const runCh = (inp: Float32Array, outp: Float32Array, off: number) => {
    const combs = combT.map((t) => ({buf: new Float32Array(t + off), i: 0, store: 0}));
    const aps = apT.map((t) => ({buf: new Float32Array(t + off), i: 0}));
    const n = inp.length + tail;
    for (let s = 0; s < n; s++) {
      const x = s - pd >= 0 && s - pd < inp.length ? inp[s - pd] * 0.015 : 0;
      let acc = 0;
      for (const c of combs) {
        const y = c.buf[c.i];
        c.store = y * (1 - damp) + c.store * damp;
        c.buf[c.i] = x + c.store * room;
        c.i = (c.i + 1) % c.buf.length;
        acc += y;
      }
      for (const a of aps) {
        const b = a.buf[a.i];
        a.buf[a.i] = acc + b * 0.5;
        acc = b - acc;
        a.i = (a.i + 1) % a.buf.length;
      }
      outp[s] = acc;
    }
  };
  runCh(src.L, out.L, 0);
  runCh(src.R, out.R, spread);
  for (let i = 0; i < out.length; i++) {
    const dl = i < src.length ? src.L[i] : 0;
    const dr = i < src.length ? src.R[i] : 0;
    out.L[i] = dl * (1 - wet * 0.5) + out.L[i] * wet * 3;
    out.R[i] = dr * (1 - wet * 0.5) + out.R[i] * wet * 3;
  }
  return out;
};
