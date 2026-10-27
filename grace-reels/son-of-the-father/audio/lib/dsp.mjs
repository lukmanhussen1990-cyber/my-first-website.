// Tiny pure-JS DSP toolkit for the Grace in Motion soundtracks (no dependencies). Q.02 THE OLDEST MAN.
// Everything is deterministic: all randomness comes from seeded PRNGs (makeRng).
import fs from 'node:fs';

export const SR = 48000;
export const TAU = Math.PI * 2;
export const dB = (x) => Math.pow(10, x / 20);
export const lin2db = (x) => 20 * Math.log10(Math.max(1e-12, x));
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
export const cosRamp = (u) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u));
export const frameQ = (t, fps = 30) => Math.round(t * fps) / fps;      // nearest video frame
export const smp = (t) => Math.round(t * SR);                           // seconds -> samples

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function nm(s) {                                                  // "F#4" -> 66
  const m = /^([A-G][#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error('bad note ' + s);
  return 12 * (parseInt(m[2], 10) + 1) + NOTE[m[1]];
}

// ------------------------------------------------------------------ PRNG (sfc32, seeded by string)
export function hash32(s) {
  s = String(s); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export function makeRng(seed) {
  let x = typeof seed === 'number' ? seed >>> 0 : hash32(seed);
  const sm = () => { x = (x + 0x9e3779b9) | 0; let t = x ^ (x >>> 16); t = Math.imul(t, 0x21f0aaad); t ^= t >>> 15; t = Math.imul(t, 0x735a2d97); t ^= t >>> 15; return t >>> 0; };
  let a = sm(), b = sm(), c = sm(), d = sm();
  const next = () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 15; i++) next();
  let spare = null;
  return {
    next,
    uni: (lo = 0, hi = 1) => lo + (hi - lo) * next(),
    int: (n) => Math.floor(next() * n),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    sign: () => (next() < 0.5 ? -1 : 1),
    gauss() {
      if (spare !== null) { const s = spare; spare = null; return s; }
      let u, v, s;
      do { u = next() * 2 - 1; v = next() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
      const m = Math.sqrt(-2 * Math.log(s) / s); spare = v * m; return u * m;
    },
  };
}

// ------------------------------------------------------------------ buffers
export const f32 = (n) => new Float32Array(Math.max(0, Math.round(n)));
export const stereo = (n) => ({ L: f32(n), R: f32(n) });
export function scale(x, g) { for (let i = 0; i < x.length; i++) x[i] *= g; return x; }
export function peakAbs(x) { let m = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > m) m = v; } return m; }
export function rmsOf(x, i0 = 0, i1 = x.length) { let s = 0; for (let i = i0; i < i1; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, i1 - i0)); }
export function normPeak(x, target = 1) { const p = peakAbs(x); if (p > 0) scale(x, target / p); return x; }
export function normRms(x, target = 0.1) { const r = rmsOf(x); if (r > 0) scale(x, target / r); return x; }
export function mixInto(dst, src, g = 1, offset = 0) { const n = Math.min(src.length, dst.length - offset); for (let i = Math.max(0, -offset); i < n; i++) dst[offset + i] += src[i] * g; return dst; }
// cosine fade in / out (seconds) in place
export function fades(x, fi = 0.005, fo = 0.005) {
  const n = x.length, a = Math.min(n, smp(fi)), b = Math.min(n, smp(fo));
  for (let i = 0; i < a; i++) x[i] *= cosRamp(i / a);
  for (let i = 0; i < b; i++) x[n - 1 - i] *= cosRamp(i / b);
  return x;
}
// exponential-ish release curve 1 -> 0 over u in [0,1] (hits exactly zero)
export const relCurve = (u, k = 4) => (u >= 1 ? 0 : (Math.exp(-k * u) - Math.exp(-k)) / (1 - Math.exp(-k)));

// equal-power pan with unity gain in the centre
export function panGains(pan) { const a = (clamp(pan, -1, 1) + 1) * Math.PI / 4; return [Math.cos(a) * Math.SQRT2, Math.sin(a) * Math.SQRT2]; }

// Add a mono (Float32Array) or stereo ({L,R}) signal into a stereo bus at time t (s).
// Optional mono send buffers: sends = [[buf, amount], ...]
export function place(bus, sig, t, gain = 1, pan = 0, sends = null) {
  const N = bus.L.length, i0 = smp(t);
  const mono = !sig.L;
  const len = mono ? sig.length : sig.L.length;
  const k0 = Math.max(0, -i0), k1 = Math.min(len, N - i0);
  if (k1 <= k0) return;
  if (mono) {
    const [gl, gr] = panGains(pan);
    for (let k = k0; k < k1; k++) { const v = sig[k] * gain; bus.L[i0 + k] += v * gl; bus.R[i0 + k] += v * gr; }
    if (sends) for (const [buf, amt] of sends) { const g = gain * amt; for (let k = k0; k < k1; k++) buf[i0 + k] += sig[k] * g; }
  } else {
    const [gl, gr] = pan ? panGains(pan) : [1, 1];
    for (let k = k0; k < k1; k++) { bus.L[i0 + k] += sig.L[k] * gain * gl; bus.R[i0 + k] += sig.R[k] * gain * gr; }
    if (sends) for (const [buf, amt] of sends) { const g = 0.5 * gain * amt; for (let k = k0; k < k1; k++) buf[i0 + k] += (sig.L[k] + sig.R[k]) * g; }
  }
}
// mono signal with a pan that moves from p0 to p1 (curve u -> pan via fn if given)
export function placeMoving(bus, sig, t, gain, p0, p1, sends = null, fn = null) {
  const N = bus.L.length, i0 = smp(t), len = sig.length;
  for (let k = Math.max(0, -i0); k < len && i0 + k < N; k++) {
    const u = k / len; const p = fn ? fn(u) : p0 + (p1 - p0) * u;
    const a = (clamp(p, -1, 1) + 1) * Math.PI / 4; const v = sig[k] * gain;
    bus.L[i0 + k] += v * Math.cos(a) * Math.SQRT2; bus.R[i0 + k] += v * Math.sin(a) * Math.SQRT2;
  }
  if (sends) for (const [buf, amt] of sends) mixInto(buf, sig, gain * amt, i0);
}

// ------------------------------------------------------------------ noise
export function white(n, r) { const x = f32(n); for (let i = 0; i < x.length; i++) x[i] = r.next() * 2 - 1; return x; }
export function gaussNoise(n, r) { const x = f32(n); for (let i = 0; i < x.length; i++) x[i] = r.gauss(); return x; }
export function pink(n, r) {                                             // Paul Kellet's refined pink filter
  const x = f32(n); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < x.length; i++) {
    const w = r.next() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.18; b6 = w * 0.115926;
  }
  return x;
}
export function brown(n, r) { const x = f32(n); let y = 0; for (let i = 0; i < x.length; i++) { y = 0.997 * y + (r.next() * 2 - 1) * 0.08; x[i] = y; } return x; }
// slowly varying smooth random control signal in [-1,1] (cosine-interpolated random points at `rate` Hz)
export function smoothRand(n, rate, r) {
  const x = f32(n); const step = Math.max(1, Math.round(SR / rate)); let a = r.uni(-1, 1), b = r.uni(-1, 1);
  for (let i = 0; i < x.length; i++) { const k = i % step; if (k === 0 && i > 0) { a = b; b = r.uni(-1, 1); } const u = 0.5 - 0.5 * Math.cos(Math.PI * k / step); x[i] = a + (b - a) * u; }
  return x;
}

// ------------------------------------------------------------------ filters
export function bqCoefs(type, f, q = Math.SQRT1_2, gainDb = 0) {
  f = clamp(f, 5, SR * 0.49);
  const w0 = TAU * f / SR, cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * q), A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lp': b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'hp': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'notch': b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'peak': b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; break;
    case 'ls': { const s = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) - (A - 1) * cw + s); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - s); a0 = (A + 1) + (A - 1) * cw + s; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - s; break; }
    case 'hs': { const s = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * cw + s); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - s); a0 = (A + 1) - (A - 1) * cw + s; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - s; break; }
    default: throw new Error('filter type ' + type);
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
// biquad in place (transposed direct form II)
export function filt(x, type, f, q = Math.SQRT1_2, gainDb = 0) {
  const [b0, b1, b2, a1, a2] = bqCoefs(type, f, q, gainDb);
  let z1 = 0, z2 = 0;
  for (let i = 0; i < x.length; i++) { const xi = x[i]; const y = b0 * xi + z1; z1 = b1 * xi - a1 * y + z2; z2 = b2 * xi - a2 * y; x[i] = y; }
  return x;
}
export const lp4 = (x, f) => filt(filt(x, 'lp', f, 0.5412), 'lp', f, 1.3066);
export const hp4 = (x, f) => filt(filt(x, 'hp', f, 0.5412), 'hp', f, 1.3066);
export const bp2 = (x, lo, hi) => filt(filt(x, 'hp', lo, 0.7071), 'lp', hi, 0.7071);
export function onePoleLP(x, f) { const a = 1 - Math.exp(-TAU * f / SR); let y = 0; for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); x[i] = y; } return x; }
// zero-phase-ish DC blocker / gentle high-pass
export function dcBlock(x, f = 18) { return filt(x, 'hp', f, 0.6); }

// biquad with time-varying gain (coefficients refreshed every `step` samples; TDF-II keeps it smooth)
export function dynEQ(x, type, f, q, gainDbAt, step = 32) {
  let z1 = 0, z2 = 0, c = null;
  for (let i = 0; i < x.length; i++) {
    if (i % step === 0) c = bqCoefs(type, f, q, gainDbAt(i));
    const xi = x[i], y = c[0] * xi + z1; z1 = c[1] * xi - c[3] * y + z2; z2 = c[2] * xi - c[4] * y; x[i] = y;
  }
  return x;
}

// TPT state-variable filter with a time-varying cutoff (fcAt(i) evaluated every `step` samples).
// mode: 'lp' | 'bp' (unity peak) | 'hp' | 'notch'
export function svf(x, fcAt, q = 0.707, mode = 'lp', step = 16) {
  const k = 1 / q; let ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0;
  const m = mode === 'lp' ? 0 : mode === 'bp' ? 1 : mode === 'hp' ? 2 : 3;
  const fixed = typeof fcAt === 'number';
  for (let i = 0; i < x.length; i++) {
    if (i % step === 0) {
      const fc = clamp(fixed ? fcAt : fcAt(i), 8, SR * 0.45);
      const g = Math.tan(Math.PI * fc / SR); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2;
    }
    const v0 = x[i], v3 = v0 - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    x[i] = m === 0 ? v2 : m === 1 ? v1 * k : m === 2 ? v0 - k * v1 - v2 : v0 - k * v1;
  }
  return x;
}

// piecewise-linear automation: keys = [[t, v], ...] (t ascending) -> f(t)
export const ramp = (keys) => (t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) { const [a, va] = keys[i], [b, vb] = keys[i + 1]; if (t <= b) return b > a ? lerp(va, vb, (t - a) / (b - a)) : vb; }
  return keys[keys.length - 1][1];
};

// stereo ensemble chorus (string-machine style): `voices` modulated delay taps per channel, each with a
// slow and a fast LFO; wet taps are summed with the dry signal (in place)
export function chorus(st, { voices = 3, base = 0.011, depth = 0.0035, slow = [0.31, 0.47, 0.63], fast = [5.1, 6.3, 7.4], fastDepth = 0.12, mix = 0.55, seed = 'chorus' } = {}) {
  const r = makeRng(seed), n = st.L.length, maxD = Math.ceil((base + depth * 1.3) * SR) + 4;
  for (const ch of ['L', 'R']) {
    const x = st[ch], dry = Float32Array.from(x), wet = new Float32Array(n);
    for (let v = 0; v < voices; v++) {
      const ps = r.next() * TAU, pf = r.next() * TAU, fs = slow[v % slow.length] * r.uni(0.9, 1.1), ff = fast[v % fast.length] * r.uni(0.9, 1.1);
      for (let i = maxD; i < n; i++) {
        const t = i / SR, d = (base + depth * (Math.sin(TAU * fs * t + ps) + fastDepth * Math.sin(TAU * ff * t + pf))) * SR;
        const p = i - d, k = p | 0, fr = p - k;
        wet[i] += dry[k] + fr * (dry[k + 1] - dry[k]);
      }
    }
    const g = mix / voices;
    for (let i = 0; i < n; i++) x[i] = dry[i] * (1 - mix * 0.5) + wet[i] * g;
  }
  return st;
}

export const softClip = (x, drive = 1) => { const n = Math.tanh(drive); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive) / n; return x; };

// ------------------------------------------------------------------ FFT + convolution reverb
export class FFT {
  constructor(n) {
    this.n = n; let bits = 0; while ((1 << bits) < n) bits++;
    if ((1 << bits) !== n) throw new Error('FFT size must be a power of two');
    this.rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) { let r = 0, x = i; for (let b = 0; b < bits; b++) { r = (r << 1) | (x & 1); x >>= 1; } this.rev[i] = r; }
    this.cos = new Float64Array(n >> 1); this.sin = new Float64Array(n >> 1);
    for (let i = 0; i < n >> 1; i++) { this.cos[i] = Math.cos(TAU * i / n); this.sin[i] = Math.sin(TAU * i / n); }
  }
  run(re, im, inverse = false) {
    const n = this.n, rev = this.rev, ct = this.cos, st = this.sin;
    for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    const sg = inverse ? 1 : -1;
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let start = 0; start < n; start += size) {
        for (let j = start, k = 0, end = start + half; j < end; j++, k += step) {
          const c = ct[k], s = sg * st[k], l = j + half;
          const tr = re[l] * c - im[l] * s, ti = re[l] * s + im[l] * c;
          re[l] = re[j] - tr; im[l] = im[j] - ti; re[j] += tr; im[j] += ti;
        }
      }
    }
    if (inverse) { const g = 1 / n; for (let i = 0; i < n; i++) { re[i] *= g; im[i] *= g; } }
  }
}
const fftCache = new Map();
const getFFT = (n) => { if (!fftCache.has(n)) fftCache.set(n, new FFT(n)); return fftCache.get(n); };

// Mono input -> stereo output convolution (overlap-add). The stereo IR is packed as hL + i*hR,
// so one complex FFT per block yields both channels (x real => Re = x*hL, Im = x*hR).
export function convolveMonoToStereo(x, ir, nOut = x.length) {
  const L = ir.L.length; let n = 1; while (n < L * 2) n <<= 1; if (n < 1 << 16) n = 1 << 16;
  const fft = getFFT(n), hop = n - L + 1;
  const HR = new Float64Array(n), HI = new Float64Array(n);
  for (let i = 0; i < L; i++) { HR[i] = ir.L[i]; HI[i] = ir.R[i]; }
  fft.run(HR, HI, false);
  const out = stereo(nOut), re = new Float64Array(n), im = new Float64Array(n);
  for (let s = 0; s < Math.min(nOut, x.length); s += hop) {
    const len = Math.min(hop, x.length - s);
    let any = false; for (let i = 0; i < len; i++) if (x[s + i] !== 0) { any = true; break; }
    if (!any) continue;
    re.fill(0); im.fill(0);
    for (let i = 0; i < len; i++) re[i] = x[s + i];
    fft.run(re, im, false);
    for (let i = 0; i < n; i++) { const a = re[i], b = im[i], c = HR[i], d = HI[i]; re[i] = a * c - b * d; im[i] = a * d + b * c; }
    fft.run(re, im, true);
    const lim = Math.min(n, nOut - s);
    for (let i = 0; i < lim; i++) { out.L[s + i] += re[i]; out.R[s + i] += im[i]; }
  }
  return out;
}

// Decaying-noise stereo impulse response: smooth onset, exponential decay, highs damped over time
// (time-varying 2-pole low-pass from `damp0` down to `damp1`), low end trimmed, energy-normalised.
export function makeIR({ seconds = 3.6, rt60 = 3.0, pre = 0.022, fadeIn = 0.07, damp0 = 9000, damp1 = 1400, hp = 140, seed = 'hall' } = {}) {
  const n = smp(seconds), p0 = smp(pre), out = {};
  for (const ch of ['L', 'R']) {
    const r = makeRng(seed + ':' + ch), x = f32(n);
    let y1 = 0, y2 = 0;
    for (let i = p0; i < n; i++) {
      const t = (i - p0) / SR, u = Math.min(1, t / (seconds - pre));
      const fc = damp0 * Math.pow(damp1 / damp0, Math.sqrt(u));
      const a = 1 - Math.exp(-TAU * fc / SR);
      y1 += a * (r.gauss() - y1); y2 += a * (y1 - y2);
      const env = Math.exp(-6.908 * t / rt60) * (t < fadeIn ? smooth(t / fadeIn) : 1) * (u > 0.9 ? cosRamp((1 - u) / 0.1) : 1);
      x[i] = y2 * env;                           // lows decay at rt60, highs faster (cutoff glides down)
    }
    filt(x, 'hp', hp, 0.6);
    out[ch] = x;
  }
  const e = Math.sqrt((rmsOf(out.L) ** 2 + rmsOf(out.R) ** 2) * n / 2);
  scale(out.L, 1 / e); scale(out.R, 1 / e);
  return out;
}

// ------------------------------------------------------------------ loudness (ITU-R BS.1770-4) + true peak
const KW1 = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585];
const KW2 = [1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621];
// mean-square of K-weighted signal per 100 ms (summed over channels)
function kSub(chans) {
  const hop = SR / 10, nsub = Math.floor(chans[0].length / hop), sub = new Float64Array(nsub);
  for (const x of chans) {
    let z1 = 0, z2 = 0, w1 = 0, w2 = 0, acc = 0, cnt = 0, j = 0;
    for (let i = 0; i < nsub * hop; i++) {
      const xi = x[i];
      const y = KW1[0] * xi + z1; z1 = KW1[1] * xi - KW1[3] * y + z2; z2 = KW1[2] * xi - KW1[4] * y;
      const u = KW2[0] * y + w1; w1 = KW2[1] * y - KW2[3] * u + w2; w2 = KW2[2] * y - KW2[4] * u;
      acc += u * u; if (++cnt === hop) { sub[j++] += acc / hop; acc = 0; cnt = 0; }
    }
  }
  return sub;
}
const LK = (ms) => -0.691 + 10 * Math.log10(Math.max(ms, 1e-20));
export function loudness(chans) {
  const sub = kSub(chans), blocks = [];
  for (let j = 0; j + 4 <= sub.length; j++) blocks.push((sub[j] + sub[j + 1] + sub[j + 2] + sub[j + 3]) / 4);
  const abs = blocks.filter((m) => LK(m) > -70);
  if (!abs.length) return -70;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const rel = LK(mean(abs)) - 10, gated = abs.filter((m) => LK(m) > rel);
  return LK(mean(gated.length ? gated : abs));
}
// short-term (3 s) loudness, one value every 100 ms; value k covers [k*0.1 - 3, k*0.1] s
export function shortTerm(chans) {
  const sub = kSub(chans), out = new Float64Array(sub.length);
  for (let j = 0; j < sub.length; j++) { let s = 0, c = 0; for (let k = Math.max(0, j - 29); k <= j; k++) { s += sub[k]; c++; } out[j] = LK(s / 30); }
  return out;
}

// 4x polyphase interpolator (65-tap windowed sinc) -> per-sample true-peak envelope (max over channels)
const OS = 4, TP_TAPS = 65, TP_DELAY = (TP_TAPS - 1) / 2 / OS;   // = 8 input samples
const TPH = (() => {
  const h = new Float64Array(TP_TAPS), c = (TP_TAPS - 1) / 2;
  for (let i = 0; i < TP_TAPS; i++) {
    const t = (i - c) / OS, sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
    const w = 0.42 - 0.5 * Math.cos(TAU * i / (TP_TAPS - 1)) + 0.08 * Math.cos(2 * TAU * i / (TP_TAPS - 1)); // Blackman
    h[i] = sinc * w;
  }
  return [1, 2, 3].map((p) => { const ph = []; for (let j = 0; j * OS + p < TP_TAPS; j++) ph.push(h[j * OS + p]); return Float64Array.from(ph); });
})();
export function truePeakEnv(chans) {
  const n = chans[0].length, env = new Float32Array(n);
  for (const x of chans) {
    for (let m = 0; m < n; m++) {
      // sub-sample positions m + p/4 come from output index (m + 8)*4 + p of the zero-stuffed filter
      let pk = Math.abs(x[m]);
      for (let p = 0; p < 3; p++) {
        const h = TPH[p]; const base = m + TP_DELAY; let s = 0;
        for (let j = 0; j < h.length; j++) { const idx = base - j; if (idx >= 0 && idx < n) s += x[idx] * h[j]; }
        const a = Math.abs(s); if (a > pk) pk = a;
      }
      if (pk > env[m]) env[m] = pk;
    }
  }
  return env;
}
export function truePeak(chans) { return peakAbs(truePeakEnv(chans)); }

// Look-ahead true-peak limiter (linked stereo). Gain = box-smoothed min-filter of the needed reduction,
// so it reaches the target before each peak; release is a one-pole. Returns stats.
export function limit(chans, ceiling, { lookahead = 0.003, release = 0.09, env = null } = {}) {
  const n = chans[0].length, tp = env || truePeakEnv(chans), LA = Math.max(1, smp(lookahead));
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) need[i] = tp[i] > ceiling ? ceiling / tp[i] : 1;
  // sliding-window minimum over [i - 8, i + LA + 8] (covers the interpolator delay both ways)
  const W0 = 8, W1 = LA + 8, mn = new Float32Array(n), dq = new Int32Array(n); let h = 0, t = 0;
  for (let i = 0, j = 0; i < n; i++) {
    const hiIdx = Math.min(n - 1, i + W1);
    while (j <= hiIdx) { while (t > h && need[dq[t - 1]] >= need[j]) t--; dq[t++] = j; j++; }
    while (dq[h] < i - W0) h++;
    mn[i] = need[dq[h]];
  }
  const rc = 1 - Math.exp(-1 / (release * SR)); let g = 1;
  const rel = new Float32Array(n);
  for (let i = 0; i < n; i++) { const m = mn[i]; g = m < g ? m : g + (m - g) * rc; rel[i] = g; }
  // box smoothing (length LA) so the attack is a short ramp, never an instant jump
  const gain = new Float32Array(n); let acc = 0;
  for (let i = 0; i < n; i++) { acc += rel[i]; if (i >= LA) acc -= rel[i - LA]; gain[i] = acc / Math.min(i + 1, LA); }
  // the box average only spans values <= the target at each peak, so peaks land under the ceiling
  let minG = 1, limited = 0;
  for (let i = 0; i < n; i++) { const gi = gain[i]; for (const x of chans) x[i] *= gi; if (gi < minG) minG = gi; if (gi < 0.999) limited++; }
  return { maxReductionDb: -lin2db(minG), limitedPct: (100 * limited) / n };
}

// ------------------------------------------------------------------ ducking envelope (from the voice)
// returns activity a(t) in [0,1]: 0 = no speech, 1 = speech; smooth attack/release, small look-ahead
export function voiceActivity(v, { lo = -52, hi = -34, att = 0.1, rel = 0.5, look = 0.06 } = {}) {
  const n = v.length, a = new Float32Array(n);
  // 1) 15 ms RMS
  const c = 1 - Math.exp(-1 / (0.015 * SR)); let ms = 0;
  for (let i = 0; i < n; i++) { ms += c * (v[i] * v[i] - ms); const d = 10 * Math.log10(ms + 1e-14); a[i] = smooth((d - lo) / (hi - lo)); }
  // 2) attack/release follower (two cascaded stages => smooth S-shaped curve)
  const ca = 1 - Math.exp(-1 / (att * 0.5 * SR)), cr = 1 - Math.exp(-1 / (rel * 0.5 * SR));
  let y1 = 0, y2 = 0;
  for (let i = 0; i < n; i++) { const x = a[i]; y1 += (x > y1 ? ca : cr) * (x - y1); y2 += (y1 > y2 ? ca : cr) * (y1 - y2); a[i] = y2; }
  // 3) look-ahead: shift earlier so the duck is already moving when a word starts
  const L = smp(look), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = a[Math.min(n - 1, i + L)];
  return out;
}

// ------------------------------------------------------------------ WAV I/O
export function readWav(path) {
  const b = fs.readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV: ' + path);
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4); let size = b.readUInt32LE(pos + 4); const body = pos + 8;
    if (id === 'fmt ') {
      fmt = { tag: b.readUInt16LE(body), ch: b.readUInt16LE(body + 2), sr: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14) };
      if (fmt.tag === 0xfffe && size >= 40) fmt.tag = b.readUInt16LE(body + 24);
    } else if (id === 'data') { if (size > b.length - body) size = b.length - body; data = { off: body, size }; break; }
    pos = body + size + (size & 1);
  }
  if (!fmt || !data) throw new Error('bad WAV: ' + path);
  const bps = fmt.bits / 8, frames = Math.floor(data.size / (bps * fmt.ch));
  const chans = Array.from({ length: fmt.ch }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < fmt.ch; c++) {
      const o = data.off + (i * fmt.ch + c) * bps; let v;
      if (fmt.tag === 3) v = bps === 4 ? b.readFloatLE(o) : b.readDoubleLE(o);
      else if (bps === 2) v = b.readInt16LE(o) / 32768;
      else if (bps === 3) v = ((b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) << 8 >> 8) / 8388608;
      else if (bps === 4) v = b.readInt32LE(o) / 2147483648;
      else throw new Error('unsupported WAV format');
      chans[c][i] = v;
    }
  }
  return { sr: fmt.sr, chans };
}
export function writeWav(path, chans, { bits = 32, float = true } = {}) {
  const ch = chans.length, n = chans[0].length, bps = bits / 8, dataSize = n * ch * bps;
  const fmtSize = float ? 18 : 16, hasFact = float;
  const header = 12 + 8 + fmtSize + (hasFact ? 12 : 0) + 8;
  const b = Buffer.alloc(header + dataSize);
  let p = 0;
  b.write('RIFF', p); p += 4; b.writeUInt32LE(header + dataSize - 8, p); p += 4; b.write('WAVE', p); p += 4;
  b.write('fmt ', p); p += 4; b.writeUInt32LE(fmtSize, p); p += 4;
  b.writeUInt16LE(float ? 3 : 1, p); p += 2; b.writeUInt16LE(ch, p); p += 2; b.writeUInt32LE(SR, p); p += 4;
  b.writeUInt32LE(SR * ch * bps, p); p += 4; b.writeUInt16LE(ch * bps, p); p += 2; b.writeUInt16LE(bits, p); p += 2;
  if (float) { b.writeUInt16LE(0, p); p += 2; b.write('fact', p); p += 4; b.writeUInt32LE(4, p); p += 4; b.writeUInt32LE(n, p); p += 4; }
  b.write('data', p); p += 4; b.writeUInt32LE(dataSize, p); p += 4;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = chans[c][i];
      if (float) { b.writeFloatLE(v, p); p += 4; }
      else { let s = Math.round(clamp(v, -1, 1) * 8388607); if (s < 0) s += 1 << 24; b[p] = s & 255; b[p + 1] = (s >> 8) & 255; b[p + 2] = (s >> 16) & 255; p += 3; }
    }
  }
  fs.writeFileSync(path, b);
}
