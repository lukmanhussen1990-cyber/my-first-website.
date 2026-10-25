// Grace in Motion: small, dependency-free DSP toolkit for the code-made score and sound design.
// Everything is deterministic: randomness only comes from seeded generators (never Math.random).

import { readFileSync, writeFileSync } from "node:fs";

export const SR = 48000;
export const TAU = Math.PI * 2;

// ---------------------------------------------------------------- random
// mulberry32: fast, good enough for audio, fully reproducible
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a over the joined parts: stable seeds from names and times
export function seedOf(...parts) {
  const s = parts.join("|");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export const rand = (r, a = 0, b = 1) => a + (b - a) * r();
export const pick = (r, list) => list[Math.min(list.length - 1, Math.floor(r() * list.length))];
export const expRand = (r, mean) => -Math.log(1 - r() * 0.999999) * mean;

// ---------------------------------------------------------------- units and shapes
export const dbToGain = (d) => Math.pow(10, d / 20);
export const gainToDb = (g) => 20 * Math.log10(Math.max(g, 1e-12));
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;

const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// "D4", "F#5", "Bb2" -> Hz
export function note(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const pc = NOTE_BASE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  return mtof(12 * (Number(m[3]) + 1) + pc);
}

// raised-cosine 0 -> 1 over [0, 1]
export const rise = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x));

// gain over a span with smooth fades inside it (0 at both ends)
export function spanEnvelope(n, fadeIn, fadeOut) {
  const env = new Float32Array(n);
  const fi = Math.max(1, Math.round(fadeIn * SR));
  const fo = Math.max(1, Math.round(fadeOut * SR));
  for (let i = 0; i < n; i++) env[i] = rise(i / fi) * rise((n - 1 - i) / fo);
  return env;
}

// piecewise-linear automation in dB: points [[seconds, dB], ...] -> per-sample gain
export function automation(points, n, { wrapPeriod = 0 } = {}) {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  const out = new Float32Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    while (k < pts.length - 2 && t > pts[k + 1][0]) k++;
    let d;
    if (t <= pts[0][0]) d = pts[0][1];
    else if (t >= pts[pts.length - 1][0]) d = pts[pts.length - 1][1];
    else {
      const [t0, d0] = pts[k];
      const [t1, d1] = pts[k + 1];
      d = t1 > t0 ? lerp(d0, d1, (t - t0) / (t1 - t0)) : d1;
    }
    out[i] = dbToGain(d);
  }
  void wrapPeriod;
  return out;
}

// ---------------------------------------------------------------- WAV
export function readWav(path) {
  const buf = readFileSync(path);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Error(`not a WAV: ${path}`);
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === "fmt ") {
      let format = buf.readUInt16LE(pos + 8);
      if (format === 0xfffe) format = buf.readUInt16LE(pos + 8 + 24);
      fmt = { format, channels: buf.readUInt16LE(pos + 10), sampleRate: buf.readUInt32LE(pos + 12), bits: buf.readUInt16LE(pos + 22) };
    } else if (id === "data") {
      data = { start: pos + 8, size: Math.min(size, buf.length - pos - 8) };
      break;
    }
    pos += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error(`incomplete WAV: ${path}`);
  const { format, channels, bits } = fmt;
  const bps = bits / 8;
  const frames = Math.floor(data.size / (bps * channels));
  const out = Array.from({ length: channels }, () => new Float32Array(frames));
  let p = data.start;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      let v;
      if (format === 3 && bits === 32) v = buf.readFloatLE(p);
      else if (format === 3 && bits === 64) v = buf.readDoubleLE(p);
      else if (bits === 16) v = buf.readInt16LE(p) / 32768;
      else if (bits === 24) v = ((buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16)) << 8 >> 8) / 8388608;
      else if (bits === 32) v = buf.readInt32LE(p) / 2147483648;
      else throw new Error(`unsupported WAV format ${format}/${bits}`);
      out[c][i] = v;
      p += bps;
    }
  }
  return { sampleRate: fmt.sampleRate, channels: out };
}

// 24-bit PCM by default, or 32-bit float with { float: true }
export function writeWav(path, channels, sampleRate = SR, { float = false } = {}) {
  const nch = channels.length;
  const n = channels[0].length;
  const bps = float ? 4 : 3;
  const dataSize = n * nch * bps;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(float ? 3 : 1, 20);
  buf.writeUInt16LE(nch, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * nch * bps, 28);
  buf.writeUInt16LE(nch * bps, 32);
  buf.writeUInt16LE(bps * 8, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  let p = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nch; c++) {
      const v = channels[c][i];
      if (float) {
        buf.writeFloatLE(Number.isFinite(v) ? v : 0, p);
      } else {
        let s = Math.round(clamp(Number.isFinite(v) ? v : 0, -1, 1) * 8388607);
        if (s < 0) s += 0x1000000;
        buf[p] = s & 0xff;
        buf[p + 1] = (s >> 8) & 0xff;
        buf[p + 2] = (s >> 16) & 0xff;
      }
      p += bps;
    }
  }
  writeFileSync(path, buf);
}

// ---------------------------------------------------------------- circular stereo bus
// Everything renders into a circular timeline: a sound that rings past the end wraps to the start,
// so the reel loops seamlessly by construction.
export class Bus {
  constructor(n) {
    this.n = n;
    this.L = new Float32Array(n);
    this.R = new Float32Array(n);
  }
  addStereo(start, L, R, gain = 1) {
    const n = this.n;
    let i = ((Math.round(start) % n) + n) % n;
    const len = Math.min(L.length, n);
    for (let k = 0; k < len; k++) {
      this.L[i] += L[k] * gain;
      this.R[i] += R[k] * gain;
      if (++i === n) i = 0;
    }
  }
  // equal-power pan, centre = unity in both channels
  addMono(start, x, gain = 1, pan = 0) {
    const th = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
    const gl = Math.cos(th) * Math.SQRT2 * gain;
    const gr = Math.sin(th) * Math.SQRT2 * gain;
    const n = this.n;
    let i = ((Math.round(start) % n) + n) % n;
    const len = Math.min(x.length, n);
    for (let k = 0; k < len; k++) {
      this.L[i] += x[k] * gl;
      this.R[i] += x[k] * gr;
      if (++i === n) i = 0;
    }
  }
  addBus(other, gain = 1) {
    for (let i = 0; i < this.n; i++) {
      this.L[i] += other.L[i] * gain;
      this.R[i] += other.R[i] * gain;
    }
  }
  scale(gainArray) {
    for (let i = 0; i < this.n; i++) {
      this.L[i] *= gainArray[i];
      this.R[i] *= gainArray[i];
    }
  }
  gain(g) {
    for (let i = 0; i < this.n; i++) {
      this.L[i] *= g;
      this.R[i] *= g;
    }
  }
  mono() {
    const m = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) m[i] = 0.5 * (this.L[i] + this.R[i]);
    return m;
  }
}

// circular add of a mono array into a mono timeline
export function addCircular(dest, start, x, gain = 1) {
  const n = dest.length;
  let i = ((Math.round(start) % n) + n) % n;
  const len = Math.min(x.length, n);
  for (let k = 0; k < len; k++) {
    dest[i] += x[k] * gain;
    if (++i === n) i = 0;
  }
}

// ---------------------------------------------------------------- oscillators
export function polyblep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

// ---------------------------------------------------------------- filters
// RBJ cookbook biquad, transposed direct form II
export class Biquad {
  constructor(type, f, q = Math.SQRT1_2, gainDb = 0) {
    this.z1 = 0;
    this.z2 = 0;
    this.set(type, f, q, gainDb);
  }
  set(type, f, q = Math.SQRT1_2, gainDb = 0) {
    const w = (TAU * clamp(f, 5, SR * 0.49)) / SR;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const alpha = sw / (2 * q);
    const A = Math.pow(10, gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    switch (type) {
      case "lowpass":
        b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
        break;
      case "highpass":
        b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
        break;
      case "bandpass": // constant 0 dB peak
        b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
        break;
      case "peak":
        b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A;
        break;
      case "lowshelf": {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 - (A - 1) * cw + s); b1 = 2 * A * (A - 1 - (A + 1) * cw); b2 = A * (A + 1 - (A - 1) * cw - s);
        a0 = A + 1 + (A - 1) * cw + s; a1 = -2 * (A - 1 + (A + 1) * cw); a2 = A + 1 + (A - 1) * cw - s;
        break;
      }
      case "highshelf": {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 + (A - 1) * cw + s); b1 = -2 * A * (A - 1 + (A + 1) * cw); b2 = A * (A + 1 + (A - 1) * cw - s);
        a0 = A + 1 - (A - 1) * cw + s; a1 = 2 * (A - 1 - (A + 1) * cw); a2 = A + 1 - (A - 1) * cw - s;
        break;
      }
      default:
        throw new Error(`unknown biquad ${type}`);
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  tick(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
  process(buf) {
    for (let i = 0; i < buf.length; i++) buf[i] = this.tick(buf[i]);
    return buf;
  }
}

export function filter(buf, type, f, q, gainDb) {
  return new Biquad(type, f, q, gainDb).process(buf);
}

// Zavalishin / Cytomic state-variable filter: stable under fast cutoff modulation
export class SVF {
  constructor() {
    this.ic1 = 0;
    this.ic2 = 0;
    this.lp = 0;
    this.bp = 0;
    this.hp = 0;
    this.set(1000, 0.7);
  }
  set(f, q) {
    const g = Math.tan((Math.PI * clamp(f, 10, SR * 0.45)) / SR);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  tick(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2;
    this.bp = v1 * this.k; // normalised: 0 dB at the centre frequency
    this.hp = v0 - this.k * v1 - v2;
  }
}

export class OnePole {
  constructor(seconds) {
    this.a = Math.exp(-1 / (Math.max(seconds, 1e-5) * SR));
    this.y = 0;
  }
  tick(x) {
    this.y = x + this.a * (this.y - x);
    return this.y;
  }
}

// ---------------------------------------------------------------- noise
export class Pink {
  // Paul Kellet's refined pink filter
  constructor(r) {
    this.r = r;
    this.b = [0, 0, 0, 0, 0, 0, 0];
  }
  tick() {
    const w = this.r() * 2 - 1;
    const b = this.b;
    b[0] = 0.99886 * b[0] + w * 0.0555179;
    b[1] = 0.99332 * b[1] + w * 0.0750759;
    b[2] = 0.969 * b[2] + w * 0.153852;
    b[3] = 0.8665 * b[3] + w * 0.3104856;
    b[4] = 0.55 * b[4] + w * 0.5329522;
    b[5] = -0.7616 * b[5] - w * 0.016898;
    const out = b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.5362;
    b[6] = w * 0.115926;
    return out * 0.11;
  }
}

export class Brown {
  constructor(r) {
    this.r = r;
    this.y = 0;
  }
  tick() {
    this.y = (this.y + 0.02 * (this.r() * 2 - 1)) * 0.997;
    return this.y * 3.5;
  }
}

// smooth random motion in [-1, 1] (for gusts, flicker, drift)
export class Drift {
  constructor(r, rate = 0.3) {
    this.r = r;
    this.rate = rate;
    this.a = r() * 2 - 1;
    this.b = r() * 2 - 1;
    this.t = 0;
  }
  tick() {
    this.t += this.rate / SR;
    if (this.t >= 1) {
      this.t -= 1;
      this.a = this.b;
      this.b = this.r() * 2 - 1;
    }
    return lerp(this.a, this.b, rise(this.t));
  }
}

// ---------------------------------------------------------------- analysis helpers
export function peakOf(...arrays) {
  let p = 0;
  for (const a of arrays) for (let i = 0; i < a.length; i++) {
    const v = Math.abs(a[i]);
    if (v > p) p = v;
  }
  return p;
}

export function normalizePeak(arrays, target) {
  const p = peakOf(...arrays);
  if (p > 0) for (const a of arrays) for (let i = 0; i < a.length; i++) a[i] *= target / p;
  return arrays;
}

export function rmsOf(a, from = 0, to = a.length) {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i] * a[i];
  return Math.sqrt(s / Math.max(1, to - from));
}

// ---------------------------------------------------------------- FFT
const fftTables = new Map();
function tablesFor(n) {
  let t = fftTables.get(n);
  if (t) return t;
  const bits = Math.log2(n);
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let x = i;
    let y = 0;
    for (let b = 0; b < bits; b++) {
      y = (y << 1) | (x & 1);
      x >>= 1;
    }
    rev[i] = y;
  }
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((TAU * i) / n);
    sin[i] = Math.sin((TAU * i) / n);
  }
  t = { rev, cos, sin };
  fftTables.set(n, t);
  return t;
}

// in-place radix-2 complex FFT (n = power of two)
export function fft(re, im, inverse = false) {
  const n = re.length;
  const { rev, cos, sin } = tablesFor(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  const sgn = inverse ? 1 : -1;
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const wr = cos[k];
        const wi = sgn * sin[k];
        const a = i + j;
        const b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) {
    re[i] /= n;
    im[i] /= n;
  }
}

const nextPow2 = (x) => 1 << Math.ceil(Math.log2(x));

// ---------------------------------------------------------------- reverb
// Synthetic stereo impulse response: sparse early reflections, then a dense decorrelated tail
// whose highs die faster than its lows (natural air absorption).
export function makeIR({ seconds = 5, rt60 = 3.5, rtLowMul = 1.25, rtHighMul = 0.55, predelay = 0.02, seed = 7, early = 12, bright = 7000 } = {}) {
  const n = Math.round(seconds * SR);
  const out = [new Float32Array(n), new Float32Array(n)];
  const r = rng(seed);
  const pre = Math.round(predelay * SR);
  const bands = [
    { type: "lowpass", f: 320, rt: rt60 * rtLowMul },
    { type: "bandpass", f: 1400, rt: rt60, q: 0.35 },
    { type: "highpass", f: 3800, rt: rt60 * rtHighMul },
  ];
  for (let c = 0; c < 2; c++) {
    const ir = out[c];
    for (const b of bands) {
      const bq = new Biquad(b.type, b.f, b.q ?? Math.SQRT1_2);
      const lp = new Biquad("lowpass", bright, 0.6);
      const decay = Math.log(1000) / (b.rt * SR); // 60 dB over rt
      for (let i = pre; i < n; i++) {
        const t = (i - pre) / SR;
        const onset = rise(t / 0.06);
        ir[i] += lp.tick(bq.tick(r() * 2 - 1)) * Math.exp(-decay * (i - pre)) * onset;
      }
    }
    for (let e = 0; e < early; e++) {
      const t = pre + Math.round(rand(r, 0.004, 0.085) * SR);
      if (t < n) ir[t] += (r() < 0.5 ? -1 : 1) * rand(r, 0.25, 0.7) * Math.exp(-(t - pre) / (0.05 * SR));
    }
  }
  // unit energy per channel so wet level is predictable
  for (const ir of out) {
    let e = 0;
    for (let i = 0; i < n; i++) e += ir[i] * ir[i];
    const g = 1 / Math.sqrt(e || 1);
    for (let i = 0; i < n; i++) ir[i] *= g;
  }
  return out;
}

// Circular convolution of a mono signal with a stereo IR (overlap-add FFT, tails wrap to the start).
// One complex FFT carries both channels: ifft(X * (H_L + i H_R)) = (x*h_L) + i (x*h_R).
export function convolveCircular(x, [irL, irR]) {
  const N = x.length;
  const M = irL.length;
  const B = 1 << 16;
  const nfft = nextPow2(B + M - 1);
  const hr = new Float64Array(nfft);
  const hi = new Float64Array(nfft);
  hr.set(irL);
  const tr = new Float64Array(nfft);
  const ti = new Float64Array(nfft);
  tr.set(irR);
  fft(hr, hi);
  fft(tr, ti);
  const Hr = new Float64Array(nfft);
  const Hi = new Float64Array(nfft);
  for (let k = 0; k < nfft; k++) {
    Hr[k] = hr[k] - ti[k];
    Hi[k] = hi[k] + tr[k];
  }
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  for (let s = 0; s < N; s += B) {
    const len = Math.min(B, N - s);
    let any = false;
    for (let i = 0; i < len; i++) if (x[s + i] !== 0) {
      any = true;
      break;
    }
    if (!any) continue;
    re.fill(0);
    im.fill(0);
    for (let i = 0; i < len; i++) re[i] = x[s + i];
    fft(re, im);
    for (let k = 0; k < nfft; k++) {
      const a = re[k];
      const b = im[k];
      re[k] = a * Hr[k] - b * Hi[k];
      im[k] = a * Hi[k] + b * Hr[k];
    }
    fft(re, im, true);
    const outLen = Math.min(nfft, len + M - 1);
    for (let i = 0; i < outLen; i++) {
      const j = (s + i) % N;
      L[j] += re[i];
      R[j] += im[i];
    }
  }
  return { L, R };
}

// ---------------------------------------------------------------- dynamics
// Feed-forward compressor with a soft knee (dB domain, smoothed detector).
export function compress(x, { threshold = -24, ratio = 3, knee = 6, attack = 0.006, release = 0.14, makeup = 0, detector = 0.004 } = {}) {
  const aA = Math.exp(-1 / (attack * SR));
  const aR = Math.exp(-1 / (release * SR));
  let env = -120;
  const out = new Float32Array(x.length);
  const rmsWin = new OnePole(detector); // 4 ms = RMS-like, 0.3 ms = peak-like
  for (let i = 0; i < x.length; i++) {
    const p = Math.sqrt(rmsWin.tick(x[i] * x[i]) + 1e-12);
    const lvl = gainToDb(p * Math.SQRT2);
    env = lvl > env ? aA * env + (1 - aA) * lvl : aR * env + (1 - aR) * lvl;
    const over = env - threshold;
    let gr = 0;
    if (over > knee / 2) gr = over * (1 - 1 / ratio);
    else if (over > -knee / 2) gr = ((over + knee / 2) ** 2 / (2 * knee)) * (1 - 1 / ratio);
    out[i] = x[i] * dbToGain(makeup - gr);
  }
  return out;
}

// 4x oversampled peak estimate (windowed-sinc interpolation) for true-peak limiting
function truePeakTrack(L, R) {
  const n = L.length;
  const taps = 16;
  const phases = [0.25, 0.5, 0.75].map((frac) => {
    const h = new Float64Array(taps);
    let sum = 0;
    for (let k = 0; k < taps; k++) {
      const x = k - taps / 2 + 1 - frac;
      const s = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const w = 0.5 + 0.5 * Math.cos((Math.PI * x) / (taps / 2 + 1));
      h[k] = s * w;
      sum += h[k];
    }
    for (let k = 0; k < taps; k++) h[k] /= sum;
    return h;
  });
  const peak = new Float32Array(n);
  for (const ch of [L, R]) {
    for (let i = 0; i < n; i++) {
      let p = Math.abs(ch[i]);
      for (const h of phases) {
        let acc = 0;
        for (let k = 0; k < taps; k++) {
          const j = i + k - taps / 2 + 1;
          if (j >= 0 && j < n) acc += h[k] * ch[j];
        }
        const a = Math.abs(acc);
        if (a > p) p = a;
      }
      if (p > peak[i]) peak[i] = p;
    }
  }
  return peak;
}

// Look-ahead true-peak limiter: gain is ramped in before peaks, released smoothly after.
export function limit(L, R, { ceilingDb = -1.5, lookahead = 0.003, release = 0.09 } = {}) {
  const n = L.length;
  const ceil = dbToGain(ceilingDb);
  const peak = truePeakTrack(L, R);
  const la = Math.max(1, Math.round(lookahead * SR));
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) need[i] = peak[i] > ceil ? ceil / peak[i] : 1;
  // sliding minimum over the look-ahead window (monotonic deque)
  const minAhead = new Float32Array(n);
  const dq = new Int32Array(n);
  let h = 0;
  let t = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (t > h && need[dq[t - 1]] >= need[i]) t--;
    dq[t++] = i;
    while (dq[h] > i + la) h++;
    minAhead[i] = need[dq[h]];
  }
  // box-average of the look-ahead minimum: a smooth ramp that still reaches every peak's target in time
  const att = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += minAhead[i];
    if (i > la) acc -= minAhead[i - la - 1];
    att[i] = acc / Math.min(i + 1, la + 1);
  }
  const rel = Math.exp(-1 / (release * SR));
  let g = 1;
  let reduced = 0;
  let over3 = 0;
  let minG = 1;
  for (let i = 0; i < n; i++) {
    g = att[i] < g ? att[i] : att[i] + rel * (g - att[i]);
    L[i] *= g;
    R[i] *= g;
    if (g < 0.891) reduced++; // more than 1 dB
    if (g < 0.708) over3++; // more than 3 dB
    if (g < minG) minG = g;
  }
  return { over1dB: reduced / n, over3dB: over3 / n, maxReductionDb: -gainToDb(minG) };
}

// ITU-R BS.1770 integrated loudness (K-weighted, gated), stereo at 48 kHz
export function loudnessLUFS(L, R) {
  const kw = (x) => {
    const s1 = { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 };
    const s2 = { b0: 1.0, b1: -2.0, b2: 1.0, a1: -1.99004745483398, a2: 0.99007225036621 };
    const y = new Float64Array(x.length);
    for (const s of [s1, s2]) {
      let z1 = 0;
      let z2 = 0;
      const src = s === s1 ? x : y;
      for (let i = 0; i < src.length; i++) {
        const v = src[i];
        const o = s.b0 * v + z1;
        z1 = s.b1 * v - s.a1 * o + z2;
        z2 = s.b2 * v - s.a2 * o;
        y[i] = o;
      }
    }
    return y;
  };
  const kl = kw(L);
  const kr = kw(R);
  const block = Math.round(0.4 * SR);
  const hop = Math.round(0.1 * SR);
  const z = [];
  for (let s = 0; s + block <= kl.length; s += hop) {
    let a = 0;
    let b = 0;
    for (let i = s; i < s + block; i++) {
      a += kl[i] * kl[i];
      b += kr[i] * kr[i];
    }
    z.push((a + b) / block);
  }
  const lk = (v) => -0.691 + 10 * Math.log10(v + 1e-20);
  const abs = z.filter((v) => lk(v) > -70);
  const mean = abs.reduce((a, b) => a + b, 0) / Math.max(1, abs.length);
  const rel = abs.filter((v) => lk(v) > lk(mean) - 10);
  return lk(rel.reduce((a, b) => a + b, 0) / Math.max(1, rel.length));
}
