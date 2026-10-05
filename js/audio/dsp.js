// Shared DSP helpers for the Night Passenger audio engine: math utilities,
// seamless noise buffers, generated impulse responses and pre-rendered
// textures (rain on the roof, crickets, frogs, crackle). Everything here is
// synthesized in plain JS once at start-up and reused.

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => clamp(v, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Exponential interpolation, for frequencies. */
export const expLerp = (a, b, t) => a * Math.pow(b / a, t);
export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const dbToGain = (db) => Math.pow(10, db / 20);

/** Returns v when it is a finite number, otherwise the fallback. */
export function finite(v, fallback) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Small fast seeded PRNG (mulberry32), returns floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Approximately normal random number (mean 0, sd ~1). */
export const gauss = (rng) => (rng() + rng() + rng() + rng() - 2) * 1.732;

export const randRange = (rng, a, b) => a + (b - a) * rng();
export const randLog = (rng, a, b) => a * Math.pow(b / a, rng());

// ---------------------------------------------------------------------------
// Automation helpers

const lastTargets = new WeakMap();

/**
 * Smoothly move an AudioParam towards a value (setTargetAtTime), skipping
 * redundant calls so per-frame updates don't flood the automation timeline.
 */
export function glide(param, value, time, tc = 0.08) {
  if (!param || !Number.isFinite(value)) return;
  const prev = lastTargets.get(param);
  if (prev !== undefined && Math.abs(prev - value) <= 1e-4 * Math.max(1e-3, Math.abs(value))) return;
  lastTargets.set(param, value);
  param.setTargetAtTime(value, time, tc);
}

/** Forget the cached glide target (after a param was automated otherwise). */
export function forgetGlide(param) {
  lastTargets.delete(param);
}

/** Freeze a param at its current value from `t`, cancelling later automation. */
export function hold(param, t) {
  forgetGlide(param);
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(t);
  } else {
    const v = param.value;
    param.cancelScheduledValues(t);
    param.setValueAtTime(v, t);
  }
}

/** Disconnect a set of nodes once the given source node has ended. */
export function disposeOnEnd(source, nodes) {
  source.onended = () => {
    for (const n of nodes) {
      try { n.disconnect(); } catch (e) { /* already disconnected */ }
    }
    source.onended = null;
  };
}

/** Looping buffer source started at a random offset (decorrelates layers sharing a buffer). */
export function loopSource(ctx, buffer, when, rng = Math.random, rate = 1) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.playbackRate.value = rate;
  src.start(when, rng() * buffer.duration * 0.95);
  return src;
}

/** One-shot buffer source; stops by itself at `stopAt`. */
export function shotSource(ctx, buffer, when, stopAt, rng = Math.random) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.start(when, rng() * buffer.duration * 0.9);
  src.stop(stopAt);
  return src;
}

export function biquad(ctx, type, freq, q = 0.707, gain = 0) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  // k-rate coefficients: per-frame glides would otherwise force per-sample recomputation
  for (const p of [f.frequency, f.Q, f.gain]) {
    try { if ('automationRate' in p) p.automationRate = 'k-rate'; } catch (e) { /* unsupported */ }
  }
  f.frequency.value = freq;
  f.Q.value = q;
  f.gain.value = gain;
  return f;
}

export function gainNode(ctx, value = 0) {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

/** GainNode that downmixes its input to mono. */
export function monoGain(ctx, value = 1) {
  const g = gainNode(ctx, value);
  g.channelCount = 1;
  g.channelCountMode = 'explicit';
  g.channelInterpretation = 'speakers';
  return g;
}

/**
 * Equal-power stereo panner. Uses StereoPannerNode when available, otherwise
 * a gain-pair + ChannelMerger fallback with the same interface.
 */
export function createPan(ctx, initial = 0) {
  if (typeof ctx.createStereoPanner === 'function') {
    const node = ctx.createStereoPanner();
    node.pan.value = clamp(initial, -1, 1);
    return {
      input: node,
      output: node,
      set(v, t, tc = 0.05) { glide(node.pan, clamp(v, -1, 1), t, tc); },
      curve(values, t, dur) { node.pan.setValueCurveAtTime(Float32Array.from(values, (v) => clamp(v, -1, 1)), t, dur); },
      disconnect() { node.disconnect(); },
    };
  }
  const input = monoGain(ctx, 1);
  const l = gainNode(ctx, 0);
  const r = gainNode(ctx, 0);
  const merger = ctx.createChannelMerger(2);
  input.connect(l);
  input.connect(r);
  l.connect(merger, 0, 0);
  r.connect(merger, 0, 1);
  const lr = (v) => {
    const a = (clamp(v, -1, 1) + 1) * Math.PI / 4;
    return [Math.cos(a), Math.sin(a)];
  };
  [l.gain.value, r.gain.value] = lr(initial);
  return {
    input,
    output: merger,
    set(v, t, tc = 0.05) {
      const [gl, gr] = lr(v);
      glide(l.gain, gl, t, tc);
      glide(r.gain, gr, t, tc);
    },
    curve(values, t, dur) {
      l.gain.setValueCurveAtTime(Float32Array.from(values, (v) => lr(v)[0]), t, dur);
      r.gain.setValueCurveAtTime(Float32Array.from(values, (v) => lr(v)[1]), t, dur);
    },
    disconnect() { input.disconnect(); l.disconnect(); r.disconnect(); merger.disconnect(); },
  };
}

// ---------------------------------------------------------------------------
// Curves

/** Transparent below ~0.8, soft knee above, never exceeds ~0.97. Feed it input * 0.5. */
export function makeSafetyCurve(n = 4096) {
  const c = new Float32Array(n);
  const knee = 0.8;
  const room = 0.97 - knee;
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2; // shaper input is pre-scaled by 0.5
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
    c[i] = Math.sign(x) * y * 0.5; // post-gain of 2 restores unity in the linear region
  }
  return c;
}

/** Gentle odd-order saturation normalised to unity at full scale. */
export function makeSaturationCurve(drive = 1.6, n = 2048) {
  const c = new Float32Array(n);
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(drive * x) / norm;
  }
  return c;
}

// ---------------------------------------------------------------------------
// Buffers

function normalizeRms(chans, targetRms, maxPeak = 0.98) {
  let sum = 0;
  let count = 0;
  let peak = 0;
  for (const d of chans) {
    for (let i = 0; i < d.length; i++) {
      sum += d[i] * d[i];
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
    }
    count += d.length;
  }
  const rms = Math.sqrt(sum / Math.max(1, count)) || 1;
  let k = targetRms / rms;
  if (peak * k > maxPeak) k = maxPeak / peak;
  for (const d of chans) for (let i = 0; i < d.length; i++) d[i] *= k;
}

/**
 * Stereo white / pink / brown noise. Pink and brown are filtered circularly
 * (two passes) so they loop without a seam.
 */
export function makeNoiseBuffers(ctx, seconds = 4, seed = 1234) {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const rng = mulberry32(seed);
  const make = () => ctx.createBuffer(2, n, sr);
  const white = make();
  const pink = make();
  const brown = make();
  for (let ch = 0; ch < 2; ch++) {
    const w = white.getChannelData(ch);
    for (let i = 0; i < n; i++) w[i] = rng() * 2 - 1;
    const p = pink.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const x = w[i];
        b0 = 0.99886 * b0 + x * 0.0555179;
        b1 = 0.99332 * b1 + x * 0.0750759;
        b2 = 0.969 * b2 + x * 0.153852;
        b3 = 0.8665 * b3 + x * 0.3104856;
        b4 = 0.55 * b4 + x * 0.5329522;
        b5 = -0.7616 * b5 - x * 0.016898;
        if (pass) p[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362;
        b6 = x * 0.115926;
      }
    }
    const br = brown.getChannelData(ch);
    let last = 0;
    let hp = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        last = (last + 0.02 * w[i]) / 1.02;
        hp += (last - hp) * 0.0005; // tiny DC blocker
        if (pass) br[i] = last - hp;
      }
    }
  }
  normalizeRms([white.getChannelData(0), white.getChannelData(1)], 0.3);
  normalizeRms([pink.getChannelData(0), pink.getChannelData(1)], 0.25);
  normalizeRms([brown.getChannelData(0), brown.getChannelData(1)], 0.25);
  return { white, pink, brown };
}

/**
 * Generated reverb impulse response: decorrelated noise with an exponential
 * decay, a high-frequency damping filter that darkens over time, optional
 * early reflections. Energy-normalised per channel (use normalize = false).
 */
export function makeReverbIR(ctx, opts = {}) {
  const {
    duration = 2,
    rt60 = 1.8,
    preDelay = 0.01,
    attack = 0.005,
    cutStart = 8000,
    cutEnd = 2000,
    early = [],
    seed = 99,
    level = 1,
  } = opts;
  const sr = ctx.sampleRate;
  const n = Math.max(1, Math.floor(sr * duration));
  const buf = ctx.createBuffer(2, n, sr);
  const rng = mulberry32(seed);
  const pre = Math.floor(preDelay * sr);
  const fadeStart = Math.floor(n * 0.85);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (const e of early) {
      const idx = Math.floor((e.t + (ch ? e.spread || 0 : 0)) * sr);
      if (idx >= 0 && idx < n) d[idx] += e.g * (rng() < 0.5 ? -1 : 1);
    }
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      const env = Math.exp((-6.91 * t) / rt60) * Math.min(1, t / Math.max(1e-4, attack));
      d[i] += gauss(rng) * env * 0.5;
    }
    // time-varying one-pole low-pass: brighter early, darker late
    for (let i = 0; i < n; i++) {
      const fc = expLerp(cutStart, cutEnd, i / n);
      const a = 1 - Math.exp((-TAU * fc) / sr);
      lp += (d[i] - lp) * a;
      d[i] = lp;
    }
    for (let i = fadeStart; i < n; i++) d[i] *= 0.5 + 0.5 * Math.cos((Math.PI * (i - fadeStart)) / (n - fadeStart));
    let e = 0;
    for (let i = 0; i < n; i++) e += d[i] * d[i];
    const k = level / Math.sqrt(e || 1);
    for (let i = 0; i < n; i++) d[i] *= k;
  }
  return buf;
}

/** Add a damped sinusoid to a circular (looping) buffer. */
function addRinging(d, start, amp, freq, tau, sr, phase = 0) {
  const n = d.length;
  const len = Math.min(n - 1, Math.floor(tau * sr * 6));
  const decay = Math.exp(-1 / (tau * sr));
  const w = (TAU * freq) / sr;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  let re = Math.cos(phase) * amp;
  let im = Math.sin(phase) * amp;
  let idx = start % n;
  for (let i = 0; i < len; i++) {
    d[idx] += im;
    const nr = (re * cw - im * sw) * decay;
    im = (re * sw + im * cw) * decay;
    re = nr;
    if (++idx === n) idx = 0;
  }
}

/** Circular two-pass one-pole high-pass + low-pass on a looping buffer. */
function circularBand(d, sr, hpHz, lpHz) {
  const n = d.length;
  const ah = Math.exp((-TAU * hpHz) / sr);
  const al = 1 - Math.exp((-TAU * lpHz) / sr);
  let xPrev = 0, hp = 0, lp = 0;
  const out = new Float32Array(n);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const x = d[i];
      hp = ah * (hp + x - xPrev);
      xPrev = x;
      lp += (hp - lp) * al;
      if (pass) out[i] = lp;
    }
  }
  d.set(out);
}

/**
 * "Rain on a metal car roof" heard from inside: many tiny bright taps
 * (1.5-5 kHz), fewer heavier drops (0.6-1.5 kHz) with a soft panel thump,
 * and a filtered noise bed. Rendered circularly so the loop is seamless.
 */
export function renderRainRoof(ctx, opts = {}) {
  const { seconds = 3, taps = 900, heavy = 18, bed = 0.12, seed = 7, rms = 0.22 } = opts;
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, n, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const rng = mulberry32(seed);
  const place = (amp, freq, tau, pos) => {
    const pan = rng();
    const gl = Math.cos((pan * Math.PI) / 2);
    const gr = Math.sin((pan * Math.PI) / 2);
    const ph = rng() * TAU;
    addRinging(L, pos, amp * gl, freq, tau, sr, ph);
    addRinging(R, pos, amp * gr, freq * (1 + (rng() - 0.5) * 0.02), tau, sr, ph);
  };
  // density breathes slowly (integer cycles per loop keeps it seamless)
  const density = (pos) => 1 + 0.35 * Math.sin((TAU * 2 * pos) / n) + 0.2 * Math.sin((TAU * 3 * pos) / n + 1.3);
  const nTaps = Math.floor(taps * seconds);
  for (let i = 0; i < nTaps; i++) {
    let pos = Math.floor(rng() * n);
    if (rng() * 1.55 > density(pos)) pos = Math.floor(rng() * n);
    const a = 0.02 + 0.2 * Math.pow(rng(), 3);
    place(a, randLog(rng, 1500, 5000), randRange(rng, 0.0006, 0.0025), pos);
  }
  const nHeavy = Math.floor(heavy * seconds);
  for (let i = 0; i < nHeavy; i++) {
    const pos = Math.floor(rng() * n);
    const a = 0.12 + 0.3 * Math.pow(rng(), 2);
    place(a, randLog(rng, 600, 1500), randRange(rng, 0.004, 0.011), pos);
    place(a * 0.6, randRange(rng, 140, 280), randRange(rng, 0.01, 0.025), pos);
  }
  const bedL = new Float32Array(n);
  const bedR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    bedL[i] = gauss(rng);
    bedR[i] = gauss(rng);
  }
  circularBand(bedL, sr, 500, 4500);
  circularBand(bedR, sr, 500, 4500);
  normalizeRms([bedL, bedR], 1);
  for (let i = 0; i < n; i++) {
    L[i] += bedL[i] * bed * 0.12;
    R[i] += bedR[i] * bed * 0.12;
  }
  normalizeRms([L, R], rms);
  return buf;
}

/** Splashy outdoor rain texture (drops on leaves/asphalt): short noisy ticks + hiss. */
export function renderRainOutdoor(ctx, opts = {}) {
  const { seconds = 2.7, ticks = 1400, seed = 21, rms = 0.2 } = opts;
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, n, sr);
  const rng = mulberry32(seed);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = gauss(rng) * 0.05;
    const count = Math.floor(ticks * seconds);
    for (let k = 0; k < count; k++) {
      const pos = Math.floor(rng() * n);
      const len = Math.floor(randRange(rng, 0.0004, 0.004) * sr);
      const amp = 0.05 + 0.4 * Math.pow(rng(), 3);
      for (let i = 0; i < len; i++) d[(pos + i) % n] += gauss(rng) * amp * Math.exp((-5 * i) / len);
    }
    circularBand(d, sr, 900, 9000);
  }
  normalizeRms([buf.getChannelData(0), buf.getChannelData(1)], rms);
  return buf;
}

/**
 * One cricket: chirps of a few sine pulses (3.5-5 kHz) repeated with slight
 * jitter. Mono, seamless.
 */
export function renderCricket(ctx, opts = {}) {
  const { seconds = 6, freq = 4300, period = 0.55, pulses = 3, pulseLen = 0.018, gap = 0.016, seed = 3 } = opts;
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const rng = mulberry32(seed);
  const chirps = Math.max(1, Math.round(seconds / period));
  const step = n / chirps;
  for (let c = 0; c < chirps; c++) {
    const start = Math.floor(c * step + (rng() - 0.5) * step * 0.08);
    const amp = 0.6 + 0.4 * rng();
    const np = pulses + (rng() < 0.2 ? 1 : 0);
    for (let p = 0; p < np; p++) {
      const ps = start + Math.floor(p * (pulseLen + gap) * sr);
      const len = Math.floor(pulseLen * sr * (0.9 + 0.2 * rng()));
      const f = freq * (1 + (rng() - 0.5) * 0.01);
      const w = (TAU * f) / sr;
      const pa = amp * (p === np - 1 ? 0.75 : 1);
      for (let i = 0; i < len; i++) {
        const env = Math.sin((Math.PI * i) / len) ** 2;
        const idx = (((ps + i) % n) + n) % n;
        d[idx] += pa * env * (Math.sin(w * i) + 0.12 * Math.sin(2 * w * i));
      }
    }
  }
  normalizeRms([d], 0.12, 0.9);
  return buf;
}

/** Faint distant stereo insect chorus (many trilling individuals). Seamless. */
export function renderInsectChorus(ctx, opts = {}) {
  const { seconds = 8, voices = 9, seed = 11 } = opts;
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, n, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const rng = mulberry32(seed);
  for (let v = 0; v < voices; v++) {
    // integer number of cycles per loop for every periodic term => seamless
    const cyc = (hz) => Math.max(1, Math.round(hz * seconds)) / seconds;
    const f = cyc(randRange(rng, 3600, 5600));
    const trill = cyc(randRange(rng, 18, 45));
    const swell = cyc(randRange(rng, 0.12, 0.6));
    const ph = rng() * TAU;
    const pan = rng();
    const gl = Math.cos((pan * Math.PI) / 2);
    const gr = Math.sin((pan * Math.PI) / 2);
    const amp = 0.3 + 0.7 * rng();
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const am = Math.max(0, Math.sin(TAU * trill * t + ph)) ** 3;
      const sw = 0.5 + 0.5 * Math.sin(TAU * swell * t + ph * 2);
      const s = Math.sin(TAU * f * t) * am * sw * sw * amp;
      L[i] += s * gl;
      R[i] += s * gr;
    }
  }
  normalizeRms([L, R], 0.1, 0.9);
  return buf;
}

/** Sparse distant frog croaks (pulsed low-mid tones). Stereo, seamless. */
export function renderFrogs(ctx, opts = {}) {
  const { seconds = 11, croaks = 9, seed = 5 } = opts;
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, n, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const rng = mulberry32(seed);
  for (let c = 0; c < croaks; c++) {
    const start = Math.floor(rng() * n);
    const f0 = randRange(rng, 230, 420);
    const pulseRate = randRange(rng, 16, 28);
    const dur = randRange(rng, 0.18, 0.5);
    const len = Math.floor(dur * sr);
    const pan = rng();
    const gl = Math.cos((pan * Math.PI) / 2);
    const gr = Math.sin((pan * Math.PI) / 2);
    const amp = 0.4 + 0.6 * rng();
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.sin((Math.PI * i) / len) ** 0.7;
      const pulse = Math.max(0, Math.sin(TAU * pulseRate * t)) ** 2;
      const f = f0 * (1 - 0.06 * (i / len));
      const s = Math.sin(TAU * f * t) + 0.5 * Math.sin(2 * TAU * f * t) + 0.25 * Math.sin(3 * TAU * f * t);
      const v = s * env * pulse * amp;
      const idx = (start + i) % n;
      L[idx] += v * gl;
      R[idx] += v * gr;
    }
  }
  normalizeRms([L, R], 0.08, 0.9);
  return buf;
}

/** Sparse clicks and pops (tape/electrical crackle). Mono, seamless. */
export function renderCrackle(ctx, opts = {}) {
  const { seconds = 3.3, rate = 40, seed = 17, rms = 0.08 } = opts;
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const rng = mulberry32(seed);
  const count = Math.floor(rate * seconds);
  for (let k = 0; k < count; k++) {
    const pos = Math.floor(rng() * n);
    const big = rng() < 0.08;
    const amp = (big ? 0.6 : 0.15) * (0.3 + rng());
    const len = Math.floor((big ? randRange(rng, 0.001, 0.004) : randRange(rng, 0.0001, 0.0008)) * sr) + 2;
    const sign = rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < len; i++) {
      const env = Math.exp((-4 * i) / len);
      d[(pos + i) % n] += (i === 0 ? sign * amp : gauss(rng) * amp * 0.5) * env;
    }
  }
  circularBand(d, sr, 300, 9000);
  normalizeRms([d], rms, 0.95);
  return buf;
}
