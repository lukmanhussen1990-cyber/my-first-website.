// DSP building blocks for the offline synth (48 kHz, float). Deterministic: seeded PRNG only.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

export const SR = 48000;
export const TAU = Math.PI * 2;

export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
export const db = (x) => 10 ** (x / 20);
export const toDb = (x) => 20 * Math.log10(Math.max(1e-12, x));
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// ---------- seeded randomness ----------
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
export class Rng {
  constructor(seed) {
    this.a = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 1;
  }
  next() {
    let t = (this.a = (this.a + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  bi() {
    return this.next() * 2 - 1;
  }
  gauss() {
    const u = Math.max(1e-9, this.next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * this.next());
  }
}

// ---------- buses ----------
// A bus covers [-pre, total) seconds. index(t) maps seconds to a sample index.
export class Bus {
  constructor(total, pre = 0, stereo = true) {
    this.pre = pre;
    this.n = Math.round((total + pre) * SR);
    this.L = new Float32Array(this.n);
    this.R = stereo ? new Float32Array(this.n) : this.L;
  }
  index(t) {
    return Math.round((t + this.pre) * SR);
  }
  // add a mono sample with constant-power pan (-1..1)
  add(i, x, pan = 0) {
    if (i < 0 || i >= this.n) return;
    const a = (clamp(pan, -1, 1) + 1) * 0.25 * Math.PI;
    this.L[i] += x * Math.cos(a);
    this.R[i] += x * Math.sin(a);
  }
  add2(i, l, r) {
    if (i < 0 || i >= this.n) return;
    this.L[i] += l;
    this.R[i] += r;
  }
  mixFrom(other, gain = 1) {
    for (let i = 0; i < this.n; i++) {
      this.L[i] += other.L[i] * gain;
      this.R[i] += other.R[i] * gain;
    }
  }
  scale(g) {
    for (let i = 0; i < this.n; i++) {
      this.L[i] *= g;
      this.R[i] *= g;
    }
  }
}
export const panGains = (pan) => {
  const a = (clamp(pan, -1, 1) + 1) * 0.25 * Math.PI;
  return [Math.cos(a), Math.sin(a)];
};

// ---------- filters ----------
export class Biquad {
  constructor(type = 'lowpass', f = 1000, q = 0.707, gainDb = 0) {
    this.z1 = 0;
    this.z2 = 0;
    this.set(type, f, q, gainDb);
  }
  set(type, f, q = 0.707, gainDb = 0) {
    const w0 = (TAU * clamp(f, 5, SR * 0.49)) / SR;
    const cw = Math.cos(w0), sw = Math.sin(w0), alpha = sw / (2 * q), A = 10 ** (gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    switch (type) {
      case 'lowpass': b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'highpass': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'bandpass': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'peaking': b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; break;
      case 'lowshelf': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 - (A - 1) * cw + s); b1 = 2 * A * (A - 1 - (A + 1) * cw); b2 = A * (A + 1 - (A - 1) * cw - s);
        a0 = A + 1 + (A - 1) * cw + s; a1 = -2 * (A - 1 + (A + 1) * cw); a2 = A + 1 + (A - 1) * cw - s; break;
      }
      case 'highshelf': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 + (A - 1) * cw + s); b1 = -2 * A * (A - 1 + (A + 1) * cw); b2 = A * (A + 1 + (A - 1) * cw - s);
        a0 = A + 1 - (A - 1) * cw + s; a1 = 2 * (A - 1 - (A + 1) * cw); a2 = A + 1 - (A - 1) * cw - s; break;
      }
      default: throw new Error(`biquad type ${type}`);
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  process(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
  run(arr, from = 0, to = arr.length) {
    for (let i = from; i < to; i++) arr[i] = this.process(arr[i]);
  }
}
export class OnePole {
  // lowpass y += a (x - y)
  constructor(fc) {
    this.y = 0;
    this.setF(fc);
  }
  setF(fc) {
    this.a = 1 - Math.exp((-TAU * fc) / SR);
  }
  process(x) {
    return (this.y += this.a * (x - this.y));
  }
}
// Run a chain of biquads over a channel.
export function filterChain(arr, specs, from = 0, to = arr.length) {
  for (const s of specs) new Biquad(...s).run(arr, from, to);
}

// ---------- oscillators ----------
function polyblep(t, dt) {
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
export class Saw {
  constructor(phase = 0) {
    this.p = phase;
  }
  next(f) {
    const dt = f / SR;
    let y = 2 * this.p - 1 - polyblep(this.p, dt);
    this.p += dt;
    if (this.p >= 1) this.p -= 1;
    return y;
  }
}
export class Pulse {
  constructor(phase = 0, width = 0.5) {
    this.p = phase;
    this.w = width;
  }
  next(f) {
    const dt = f / SR;
    let y = this.p < this.w ? 1 : -1;
    y += polyblep(this.p, dt);
    let q = this.p - this.w;
    if (q < 0) q += 1;
    y -= polyblep(q, dt);
    this.p += dt;
    if (this.p >= 1) this.p -= 1;
    return y;
  }
}
export class Sine {
  constructor(phase = 0) {
    this.p = phase;
  }
  next(f) {
    const y = Math.sin(TAU * this.p);
    this.p += f / SR;
    if (this.p >= 1) this.p -= 1;
    return y;
  }
}

// ---------- noise ----------
export class Noise {
  constructor(seed) {
    this.r = new Rng(seed);
    this.b = [0, 0, 0, 0, 0, 0, 0];
    this.brown = 0;
  }
  white() {
    return this.r.next() * 2 - 1;
  }
  pink() {
    const w = this.white(), b = this.b;
    b[0] = 0.99886 * b[0] + w * 0.0555179;
    b[1] = 0.99332 * b[1] + w * 0.0750759;
    b[2] = 0.969 * b[2] + w * 0.153852;
    b[3] = 0.8665 * b[3] + w * 0.3104856;
    b[4] = 0.55 * b[4] + w * 0.5329522;
    b[5] = -0.7616 * b[5] - w * 0.016898;
    const y = b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.5362;
    b[6] = w * 0.115926;
    return y * 0.11;
  }
  brownN() {
    this.brown = (this.brown + 0.02 * this.white()) / 1.02;
    return this.brown * 3.5;
  }
}
// Smooth random control signal (sum of slow sines with seeded phases), roughly in [-1, 1].
export function wobble(seed, rates) {
  const r = new Rng(seed);
  const ph = rates.map(() => r.next() * TAU);
  return (t) => rates.reduce((s, f, k) => s + Math.sin(TAU * f * t + ph[k]), 0) / rates.length;
}

// ---------- envelopes & automation ----------
// Piecewise curve from [[t, v], ...] with smoothstep easing between points.
export function curve(points) {
  const p = [...points].sort((a, b) => a[0] - b[0]);
  return (t) => {
    if (t <= p[0][0]) return p[0][1];
    if (t >= p[p.length - 1][0]) return p[p.length - 1][1];
    let k = 0;
    while (t > p[k + 1][0]) k++;
    const [t0, v0] = p[k], [t1, v1] = p[k + 1];
    return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
  };
}
// Attack / hold / release envelope value at time t (seconds since note start); cosine edges.
export function ahr(t, att, hold, rel) {
  if (t < 0) return 0;
  if (t < att) return 0.5 - 0.5 * Math.cos((Math.PI * t) / att);
  if (t < att + hold) return 1;
  const u = (t - att - hold) / rel;
  return u >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * u);
}

// ---------- reverb (FDN, 8 lines, Householder feedback) ----------
export function fdnReverb(inL, inR, { t60 = 4, damp = 6000, predelay = 0.03, size = 1, seed = 'fdn', diffuse = true } = {}) {
  const n = inL.length;
  const outL = new Float32Array(n), outR = new Float32Array(n);
  const base = [1433, 1601, 1867, 2053, 2251, 2399, 2617, 2803].map((d) => Math.round(d * size));
  const N = base.length;
  const lines = base.map((d) => new Float32Array(d));
  const idx = new Array(N).fill(0);
  const g = base.map((d) => 10 ** ((-3 * d) / (t60 * SR)));
  const lp = base.map(() => ({ y: 0 }));
  const la = 1 - Math.exp((-TAU * damp) / SR);
  const pd = Math.max(1, Math.round(predelay * SR));
  const preL = new Float32Array(pd), preR = new Float32Array(pd);
  let pi = 0;
  // input diffusion: 4 Schroeder allpasses per side
  const apSpec = [142, 107, 379, 277];
  const mkAp = (k) => apSpec.map((d) => ({ buf: new Float32Array(Math.round(d * (1 + 0.07 * k))), i: 0 }));
  const apL = mkAp(0), apR = mkAp(1);
  const ap = (chain, x) => {
    for (const a of chain) {
      const b = a.buf[a.i];
      const y = -0.6 * x + b;
      a.buf[a.i] = x + 0.6 * y;
      a.i = (a.i + 1) % a.buf.length;
      x = y;
    }
    return x;
  };
  const v = new Float64Array(N);
  for (let s = 0; s < n; s++) {
    let xl = preL[pi], xr = preR[pi];
    preL[pi] = inL[s];
    preR[pi] = inR[s];
    pi = (pi + 1) % pd;
    if (diffuse) {
      xl = ap(apL, xl);
      xr = ap(apR, xr);
    }
    let sum = 0;
    for (let k = 0; k < N; k++) {
      let y = lines[k][idx[k]];
      lp[k].y += la * (y - lp[k].y);
      v[k] = lp[k].y * g[k];
      sum += v[k];
    }
    const h = (2 / N) * sum;
    let ol = 0, or = 0;
    for (let k = 0; k < N; k++) {
      const y = v[k] - h + (k & 1 ? xr : xl) * 0.5;
      lines[k][idx[k]] = y;
      idx[k] = (idx[k] + 1) % lines[k].length;
      if (k & 1) or += k % 4 === 1 ? v[k] : -v[k];
      else ol += k % 4 === 0 ? v[k] : -v[k];
    }
    outL[s] = ol * 0.5;
    outR[s] = or * 0.5;
  }
  return [outL, outR];
}

// ---------- loudness (ITU-R BS.1770-4, 48 kHz K-weighting, gated) ----------
export function kWeight(arr) {
  const s1 = { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 };
  const s2 = { b0: 1, b1: -2, b2: 1, a1: -1.99004745483398, a2: 0.99007225036621 };
  const out = new Float64Array(arr.length);
  for (const c of [s1, s2]) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const src = c === s1 ? arr : out;
    for (let i = 0; i < arr.length; i++) {
      const x = src[i];
      const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      out[i] = y;
    }
  }
  return out;
}
export function blockPowers(channels, from = 0, to = channels[0].length) {
  const kw = channels.map((c) => kWeight(c.subarray(from, to)));
  const blk = Math.round(0.4 * SR), hop = Math.round(0.1 * SR);
  const pw = [];
  for (let s = 0; s + blk <= kw[0].length; s += hop) {
    let z = 0;
    for (const k of kw) {
      let acc = 0;
      for (let i = s; i < s + blk; i++) acc += k[i] * k[i];
      z += acc / blk;
    }
    pw.push(z);
  }
  return pw;
}
export function integratedLufs(channels, from, to) {
  const pw = blockPowers(channels, from, to);
  const L = (z) => -0.691 + 10 * Math.log10(Math.max(1e-20, z));
  const abs = pw.filter((z) => L(z) > -70);
  if (!abs.length) return -Infinity;
  const rel = L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((z) => L(z) > rel);
  return L(gated.reduce((a, b) => a + b, 0) / gated.length);
}

// ---------- true-peak style lookahead limiter (4x oversampled detection) ----------
function upsample4Peaks(x) {
  // windowed-sinc interpolation at 1/4, 2/4, 3/4 between samples; returns per-sample max |value|
  const taps = 12, kern = [];
  for (const frac of [0.25, 0.5, 0.75]) {
    const k = [];
    for (let j = -taps + 1; j <= taps; j++) {
      const t = j - frac;
      const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
      const w = 0.5 + 0.5 * Math.cos((Math.PI * t) / (taps + 0.5));
      k.push(sinc * w);
    }
    kern.push(k);
  }
  const n = x.length, pk = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = Math.abs(x[i]);
    for (const k of kern) {
      let acc = 0;
      for (let j = 0; j < k.length; j++) {
        const idx = i + j - taps + 1;
        if (idx >= 0 && idx < n) acc += x[idx] * k[j];
      }
      if (Math.abs(acc) > m) m = Math.abs(acc);
    }
    pk[i] = m;
  }
  return pk;
}
export function truePeakDb(channels) {
  let m = 0;
  for (const c of channels) {
    const p = upsample4Peaks(c);
    for (let i = 0; i < p.length; i++) if (p[i] > m) m = p[i];
  }
  return toDb(m);
}
export function limitTruePeak(channels, ceilingDb = -1.5, lookahead = 0.005, release = 0.08) {
  const ceil = db(ceilingDb), n = channels[0].length;
  const peaks = channels.map(upsample4Peaks);
  const req = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let p = 0;
    for (const pk of peaks) if (pk[i] > p) p = pk[i];
    req[i] = p > ceil ? ceil / p : 1;
  }
  const L = Math.max(1, Math.round(lookahead * SR));
  // min over the lookahead window, then a moving average so gain ramps down before the peak
  const mn = new Float32Array(n);
  const dq = [];
  for (let i = n - 1; i >= 0; i--) {
    while (dq.length && req[dq[dq.length - 1]] >= req[i]) dq.pop();
    dq.push(i);
    while (dq[0] > i + L) dq.shift();
    mn[i] = req[dq[0]];
  }
  // Moving average of the look-ahead minimum over the last L samples: every window that ends at or
  // after a peak contains that peak's required gain, so the ramp reaches it in time (no overshoot).
  const g = new Float32Array(n);
  const ring = new Float32Array(L).fill(1);
  let acc = L, ri = 0;
  for (let i = 0; i < n; i++) {
    acc += mn[i] - ring[ri];
    ring[ri] = mn[i];
    ri = (ri + 1) % L;
    g[i] = acc / L;
  }
  const ra = 1 - Math.exp(-1 / (release * SR));
  let cur = 1, over05 = 0, minG = 1, minAt = 0;
  for (let i = 0; i < n; i++) {
    cur = g[i] < cur ? g[i] : cur + ra * (g[i] - cur);
    if (cur < 0.944) over05++;
    if (cur < minG) { minG = cur; minAt = i; }
    for (const c of channels) c[i] *= cur;
  }
  return { over05: over05 / n, maxGrDb: -20 * Math.log10(minG), maxAt: minAt / SR };
}

// ---------- WAV I/O ----------
export function writeWavFloat(path, chans) {
  const nc = chans.length, n = chans[0].length;
  const buf = Buffer.alloc(44 + n * nc * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * nc * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(nc, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * nc * 4, 28); buf.writeUInt16LE(nc * 4, 32); buf.writeUInt16LE(32, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * nc * 4, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++, o += 4) buf.writeFloatLE(chans[c][i], o);
  writeFileSync(path, buf);
}
export function readAudio(path, channels = 1) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-ac', String(channels), '-ar', String(SR), '-f', 'f32le', '-'], {
    maxBuffer: 1 << 30,
  });
  if (r.status !== 0) throw new Error(`ffmpeg read failed: ${r.stderr}`);
  const all = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
  const n = all.length / channels;
  return Array.from({ length: channels }, (_, c) => {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = all[i * channels + c];
    return a;
  });
}
