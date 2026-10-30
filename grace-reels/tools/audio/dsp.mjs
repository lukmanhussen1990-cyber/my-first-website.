// Small offline DSP kit for Grace in Motion scores (48 kHz, stereo, float).
// Everything is deterministic: noise comes from a seeded generator.
import fs from 'node:fs';

export const SR = 48000;

// ---------- utils ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const db = (d) => Math.pow(10, d / 20);
const TBL_N = 8192;
const TBL = new Float32Array(TBL_N + 1);
for (let i = 0; i <= TBL_N; i++) TBL[i] = Math.sin((2 * Math.PI * i) / TBL_N);
// sine of a phase measured in cycles
export function sinc(ph) {
  const x = (ph - Math.floor(ph)) * TBL_N;
  const i = x | 0;
  return TBL[i] + (TBL[i + 1] - TBL[i]) * (x - i);
}

export class Bus {
  constructor(seconds) {
    this.n = Math.ceil(seconds * SR);
    this.L = new Float32Array(this.n);
    this.R = new Float32Array(this.n);
  }
  add(i, l, r) {
    if (i >= 0 && i < this.n) {
      this.L[i] += l;
      this.R[i] += r;
    }
  }
  mix(other, gain = 1) {
    for (let i = 0; i < this.n; i++) {
      this.L[i] += other.L[i] * gain;
      this.R[i] += other.R[i] * gain;
    }
  }
}

// equal-power pan, p in [-1, 1]
export function panGains(p) {
  const a = ((p + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

// smooth envelope: attack/release are linear-in-dB-ish cosine ramps
export function env(t, dur, att, rel) {
  if (t < 0 || t > dur + rel) return 0;
  let g = 1;
  if (t < att) g = 0.5 - 0.5 * Math.cos((Math.PI * t) / att);
  if (t > dur) g *= 0.5 + 0.5 * Math.cos((Math.PI * (t - dur)) / rel);
  return g;
}

// ---------- instruments ----------
// soft felt piano: inharmonic partials, per-partial decay, muted hammer
export function piano(bus, t0, midi, vel = 0.5, dur = 2.5, pan = 0) {
  const f0 = mtof(midi);
  const B = 0.00035;
  const parts = [];
  for (let n = 1; n <= 12; n++) {
    const f = n * f0 * Math.sqrt(1 + B * n * n);
    if (f > 9000) break;
    const amp = (vel / Math.pow(n, 1.15)) * Math.exp(-n * (0.32 + 0.25 * (1 - vel)));
    const tau = (2.4 * Math.pow(220 / f0, 0.45)) / (1 + 0.35 * (n - 1));
    parts.push({ f, amp, tau, ph: n * 0.137 });
  }
  const rel = 0.35;
  const len = Math.min(dur + rel, 9);
  const [gl, gr] = panGains(pan);
  const i0 = Math.round(t0 * SR);
  const N = Math.round(len * SR);
  for (let k = 0; k < N; k++) {
    const t = k / SR;
    let s = 0;
    for (const p of parts) s += p.amp * Math.exp(-t / p.tau) * sinc(p.ph + p.f * t);
    const a = Math.min(1, t / 0.006) * (t > dur ? 0.5 + 0.5 * Math.cos((Math.PI * Math.min(1, (t - dur) / rel))) : 1);
    s *= a * 0.22;
    bus.add(i0 + k, s * gl, s * gr);
  }
}

// warm string section: detuned band-limited saws, gentle vibrato, dark tone
export function strings(bus, t0, t1, midis, vel = 0.4, { att = 1.2, rel = 1.6, bright = 2200, pan = 0, seed = 1 } = {}) {
  const r = rng(seed);
  const dur = t1 - t0;
  const i0 = Math.round(t0 * SR);
  const N = Math.round((dur + rel) * SR);
  const voices = [];
  midis.forEach((m, vi) => {
    for (const cents of [-7, 0, 6]) {
      const f = mtof(m) * Math.pow(2, cents / 1200);
      const harm = [];
      for (let n = 1; n * f < 7500 && n <= 24; n++) harm.push([n, (1 / n) * Math.exp(-(n * f) / bright)]);
      const p = pan + (vi / Math.max(1, midis.length - 1) - 0.5) * 0.7 + (cents / 7) * 0.15;
      voices.push({ f, harm, ph: r(), vib: 4.6 + r() * 1.2, vph: r(), g: panGains(Math.max(-1, Math.min(1, p))) });
    }
  });
  const norm = (vel * 0.05) / Math.sqrt(midis.length);
  for (let k = 0; k < N; k++) {
    const t = k / SR;
    const e = env(t, dur, att, rel) * norm;
    if (e === 0) continue;
    let l = 0;
    let rr = 0;
    const vibDepth = 0.0016 * Math.min(1, t / 1.5);
    for (const v of voices) {
      const fm = 1 + vibDepth * sinc(v.vph + v.vib * t);
      const base = v.ph + v.f * t * fm;
      let s = 0;
      for (const [n, a] of v.harm) s += a * sinc(base * n);
      l += s * v.g[0];
      rr += s * v.g[1];
    }
    bus.add(i0 + k, l * e, rr * e);
  }
}

// formant choir pad ("oo" or "ah")
const VOWELS = {
  oo: [[320, 1, 80], [870, 0.35, 100], [2250, 0.12, 140]],
  ah: [[720, 1, 90], [1150, 0.6, 110], [2650, 0.25, 160]],
};
export function choir(bus, t0, t1, midis, vel = 0.4, { vowel = 'oo', att = 1.8, rel = 2.2, seed = 7 } = {}) {
  const r = rng(seed);
  const form = VOWELS[vowel];
  const dur = t1 - t0;
  const i0 = Math.round(t0 * SR);
  const N = Math.round((dur + rel) * SR);
  const voices = [];
  midis.forEach((m) => {
    for (let c = 0; c < 4; c++) {
      const f = mtof(m) * Math.pow(2, ((r() - 0.5) * 16) / 1200);
      const harm = [];
      for (let n = 1; n * f < 5000; n++) {
        const fn = n * f;
        let a = 0;
        for (const [ff, g, bw] of form) a += g * Math.exp(-((fn - ff) ** 2) / (2 * bw * bw));
        harm.push([n, (a + 0.02) / Math.sqrt(n)]);
      }
      voices.push({ f, harm, ph: r(), vib: 4 + r() * 1.5, vph: r(), g: panGains((r() - 0.5) * 1.4) });
    }
  });
  const norm = (vel * 0.06) / Math.sqrt(voices.length);
  for (let k = 0; k < N; k++) {
    const t = k / SR;
    const e = env(t, dur, att, rel) * norm;
    if (e === 0) continue;
    let l = 0;
    let rr = 0;
    for (const v of voices) {
      const base = v.ph + v.f * t * (1 + 0.0025 * sinc(v.vph + v.vib * t));
      let s = 0;
      for (const [n, a] of v.harm) s += a * sinc(base * n);
      l += s * v.g[0];
      rr += s * v.g[1];
    }
    bus.add(i0 + k, l * e, rr * e);
  }
}

// pure sine pad / drone with optional tremolo
export function tone(bus, t0, t1, freq, amp, { att = 0.5, rel = 0.8, trem = 0, tremRate = 0.3, pan = 0, harm2 = 0 } = {}) {
  const i0 = Math.round(t0 * SR);
  const dur = t1 - t0;
  const N = Math.round((dur + rel) * SR);
  const [gl, gr] = panGains(pan);
  for (let k = 0; k < N; k++) {
    const t = k / SR;
    const e = env(t, dur, att, rel) * amp * (1 - trem * (0.5 + 0.5 * sinc(tremRate * t)));
    const s = (sinc(freq * t) + harm2 * sinc(2 * freq * t)) * e;
    bus.add(i0 + k, s * gl, s * gr);
  }
}

// low heartbeat-like pulse
export function thump(bus, t0, amp = 0.5, f = 52) {
  const i0 = Math.round(t0 * SR);
  const N = Math.round(0.6 * SR);
  for (let k = 0; k < N; k++) {
    const t = k / SR;
    const fr = f * (1 + 0.8 * Math.exp(-t / 0.03));
    const s = Math.sin(2 * Math.PI * fr * t) * Math.exp(-t / 0.14) * Math.min(1, t / 0.004) * amp;
    bus.add(i0 + k, s, s);
  }
}

// inharmonic bell / chime
export function bell(bus, t0, f, amp = 0.2, decay = 2.2, pan = 0) {
  const ratios = [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1], [0.5, 0.25]];
  const i0 = Math.round(t0 * SR);
  const N = Math.round(decay * 3 * SR);
  const [gl, gr] = panGains(pan);
  for (let k = 0; k < N; k++) {
    const t = k / SR;
    let s = 0;
    for (const [r, a] of ratios) s += a * Math.exp((-t * (1 + r * 0.4)) / decay) * sinc(f * r * t);
    s *= amp * Math.min(1, t / 0.002);
    bus.add(i0 + k, s * gl, s * gr);
  }
}

// ---------- noise + filters ----------
export function noise(n, seed = 3) {
  const r = rng(seed);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = r() * 2 - 1;
  return x;
}
export function pinkify(x) {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const w = x[i];
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    y[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return y;
}
export function biquad(x, type, freq, q = 0.707, freqFn = null) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0, b1, b2, a1, a2;
  const coef = (f) => {
    const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
    const cs = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    let c;
    if (type === 'lp') c = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2];
    else if (type === 'hp') c = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2];
    else c = [al, 0, -al]; // band-pass
    const a0 = 1 + al;
    [b0, b1, b2] = c.map((v) => v / a0);
    a1 = (-2 * cs) / a0;
    a2 = (1 - al) / a0;
  };
  coef(freq);
  for (let i = 0; i < x.length; i++) {
    if (freqFn && (i & 63) === 0) coef(freqFn(i / SR));
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}
// place a mono signal with a gain curve and pan
export function place(bus, t0, x, gainFn = () => 1, pan = 0) {
  const i0 = Math.round(t0 * SR);
  const [gl, gr] = panGains(pan);
  for (let k = 0; k < x.length; k++) {
    const g = gainFn(k / SR);
    if (g !== 0) bus.add(i0 + k, x[k] * g * gl, x[k] * g * gr);
  }
}

// ---------- reverb (Freeverb) ----------
export function reverb(bus, { room = 0.86, damp = 0.35, wet = 0.32, dry = 1, width = 1 } = {}) {
  const scale = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const aps = [556, 441, 341, 225];
  const fb = room * 0.28 + 0.7;
  const d1 = damp * 0.4;
  const d2 = 1 - d1;
  const mk = (len) => ({ buf: new Float32Array(Math.round(len * scale)), i: 0, store: 0 });
  const chans = [0, 23].map((sp) => ({ c: combs.map((l) => mk(l + sp)), a: aps.map((l) => mk(l + sp)) }));
  const outL = new Float32Array(bus.n);
  const outR = new Float32Array(bus.n);
  for (let i = 0; i < bus.n; i++) {
    const input = (bus.L[i] + bus.R[i]) * 0.015;
    const res = [0, 0];
    chans.forEach((ch, ci) => {
      let o = 0;
      for (const c of ch.c) {
        const v = c.buf[c.i];
        c.store = v * d2 + c.store * d1;
        c.buf[c.i] = input + c.store * fb;
        if (++c.i >= c.buf.length) c.i = 0;
        o += v;
      }
      for (const a of ch.a) {
        const v = a.buf[a.i];
        a.buf[a.i] = o + v * 0.5;
        if (++a.i >= a.buf.length) a.i = 0;
        o = v - o;
      }
      res[ci] = o;
    });
    const w1 = wet * (width / 2 + 0.5);
    const w2 = wet * ((1 - width) / 2);
    outL[i] = bus.L[i] * dry + res[0] * w1 + res[1] * w2;
    outR[i] = bus.R[i] * dry + res[1] * w1 + res[0] * w2;
  }
  bus.L = outL;
  bus.R = outR;
}

// ---------- io ----------
export function writeWav(path, bus, bits = 32) {
  const n = bus.n;
  const bytes = bits / 8;
  const buf = Buffer.alloc(44 + n * 2 * bytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2 * bytes, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(bits === 32 ? 3 : 1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2 * bytes, 28);
  buf.writeUInt16LE(2 * bytes, 32);
  buf.writeUInt16LE(bits, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2 * bytes, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (const v of [bus.L[i], bus.R[i]]) {
      if (bits === 32) buf.writeFloatLE(v, o);
      else buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), o);
      o += bytes;
    }
  }
  fs.writeFileSync(path, buf);
}
export function readWavMono(path) {
  const b = fs.readFileSync(path);
  let p = 12;
  let fmt = null;
  while (p < b.length) {
    const id = b.toString('ascii', p, p + 4);
    const size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') {
      const bytes = fmt.bits / 8;
      const n = size / bytes / fmt.ch;
      const x = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const o = p + 8 + i * bytes * fmt.ch;
        x[i] = fmt.bits === 32 ? b.readFloatLE(o) : b.readInt16LE(o) / 32768; // float (fmt 3 or extensible)
      }
      return { x, sr: fmt.sr };
    }
    p += 8 + size + (size & 1);
  }
  throw new Error('no data chunk');
}
