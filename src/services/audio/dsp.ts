/*
 * DSP building blocks for the procedural sound engine: noise buffers, the
 * reverb impulse response, wave-shaper curves and envelope helpers.
 *
 * Everything here is generated once per AudioContext and reused — nothing in
 * this file runs per sound. The buffer generators are written as resumable
 * jobs: offline rendering runs them to completion at once (`runNow`), the live
 * engine slices them across tasks (`runSliced`) so start-up never stalls a frame.
 */

export type Curve = Float32Array<ArrayBuffer>;

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Tiny positive floor for exponential ramps (they cannot reach 0). */
export const SILENT = 0.0001;

/** Random float in [lo, hi). */
export const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

/** Log-uniform random — even spread across octaves (for frequencies). */
export const randLog = (lo: number, hi: number): number => lo * (hi / lo) ** Math.random();

/* ── Resumable generation ──────────────────────────────────────────────── */

/** Buffer generation that yields between slices of samples. */
export type Job<T> = Generator<void, T, void>;

/** Samples generated between yield points (≈ 0.1–0.3 ms of work each). */
const SLICE = 2048;

/** Run a job to completion synchronously (offline rendering, tests). */
export function runNow<T>(job: Job<T>): T {
  for (;;) {
    const r = job.next();
    if (r.done) return r.value;
  }
}

function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s && typeof s.yield === 'function') return s.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Run a job a few milliseconds at a time, yielding to the page in between (never in the caller's task). */
export async function runSliced<T>(job: Job<T>, budgetMs = 4): Promise<T> {
  for (;;) {
    await yieldToMain();
    const until = performance.now() + budgetMs;
    let r = job.next();
    while (!r.done && performance.now() < until) r = job.next();
    if (r.done) return r.value;
  }
}

/** Resolves when the main thread is idle (or after `timeout` ms at the latest). */
export function idle(timeout = 1000): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout });
    else setTimeout(resolve, 80);
  });
}

/** Make the last few ms of a looping buffer blend into its start (no seam click). */
function seamless(d: Float32Array, fade: number): void {
  const n = d.length;
  const f = Math.min(fade, Math.floor(n / 4));
  for (let i = 0; i < f; i++) {
    const w = i / f;
    d[n - f + i] = d[n - f + i] * (1 - w) + d[i] * w;
  }
}

function normalize(d: Float32Array, peak = 0.98): void {
  let max = 0;
  for (let i = 0; i < d.length; i++) max = Math.max(max, Math.abs(d[i]));
  if (max === 0) return;
  const k = peak / max;
  for (let i = 0; i < d.length; i++) d[i] *= k;
}

/** Mono looping noise. White for transients, pink for beds, brown for rumble. */
export function* noiseJob(ctx: BaseAudioContext, seconds: number, color: 'white' | 'pink' | 'brown'): Job<AudioBuffer> {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * seconds));
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  // Paul Kellet's refined pink filter state / brown integrator state.
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let last = 0;
  for (let s = 0; s < len; s += SLICE) {
    const e = Math.min(len, s + SLICE);
    if (color === 'white') {
      for (let i = s; i < e; i++) d[i] = Math.random() * 2 - 1;
    } else if (color === 'pink') {
      for (let i = s; i < e; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      }
    } else {
      for (let i = s; i < e; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last;
      }
    }
    yield;
  }
  seamless(d, Math.floor(sr * 0.02));
  normalize(d, color === 'white' ? 1 : 0.95);
  return buf;
}

export const noiseBuffer = (ctx: BaseAudioContext, seconds: number, color: 'white' | 'pink' | 'brown'): AudioBuffer =>
  runNow(noiseJob(ctx, seconds, color));

/**
 * Sparse rain-drop texture: short decaying noise ticks scattered at random,
 * with a heavy-tailed loudness distribution (many faint, a few close drops).
 */
export function* dropsJob(ctx: BaseAudioContext, seconds: number, perSecond: number): Job<AudioBuffer> {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * seconds));
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const count = Math.floor(seconds * perSecond);
  for (let k = 0; k < count; k++) {
    const pos = Math.floor(Math.random() * len);
    const amp = 0.08 + Math.random() ** 4 * 0.92;
    const tau = sr * rand(0.0007, 0.0035);
    const dur = Math.floor(tau * 6);
    for (let j = 0; j < dur; j++) d[(pos + j) % len] += amp * (Math.random() * 2 - 1) * Math.exp(-j / tau);
    if (k % 12 === 11) yield;
  }
  normalize(d, 0.95);
  return buf;
}

export const dropsBuffer = (ctx: BaseAudioContext, seconds: number, perSecond: number): AudioBuffer =>
  runNow(dropsJob(ctx, seconds, perSecond));

/**
 * Dark stereo hall impulse: early reflections, then decorrelated noise that
 * decays exponentially while a one-pole low-pass closes over time, so the
 * tail gets darker as it fades (like air absorption in a big concrete space).
 */
export function* impulseJob(ctx: BaseAudioContext, seconds = 2.2): Job<AudioBuffer> {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const pre = Math.floor(sr * 0.014);
  const buf = ctx.createBuffer(2, len, sr);
  const k = -6.9 / (seconds * 0.82 * sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let s = pre; s < len; s += SLICE) {
      const e = Math.min(len, s + SLICE);
      for (let i = s; i < e; i++) {
        const t = (i - pre) / (len - pre);
        const env = Math.exp(k * (i - pre)) * (1 - t);
        const a = 0.62 * (1 - t) ** 1.6 + 0.035;
        lp += a * (Math.random() * 2 - 1 - lp);
        const fadeIn = Math.min(1, (i - pre) / (sr * 0.006));
        d[i] = lp * env * fadeIn;
      }
      yield;
    }
    // Early reflections from nearby walls.
    for (let r = 0; r < 7; r++) {
      const at = pre + Math.floor(sr * rand(0.006, 0.085));
      d[at] += (Math.random() < 0.5 ? -1 : 1) * rand(0.25, 0.6) * (1 - r / 9);
    }
  }
  return buf;
}

export const impulseResponse = (ctx: BaseAudioContext, seconds = 2.2): AudioBuffer => runNow(impulseJob(ctx, seconds));

const curves = new Map<string, Curve>();

/** Smooth tanh saturation; `k` = drive (1 = gentle warmth, 8 = heavy fuzz). */
export function driveCurve(k: number): Curve {
  const key = `d${k}`;
  let c = curves.get(key);
  if (!c) {
    const n = 2048;
    c = new Float32Array(n);
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(k * x) / norm;
    }
    curves.set(key, c);
  }
  return c;
}

/**
 * Output safety clipper over an input domain of ±2 (feed it through a ×0.5
 * gain): transparent below 0.7, then a tanh knee that never exceeds 1.0.
 */
export function softClipCurve(): Curve {
  const key = 'soft';
  let c = curves.get(key);
  if (!c) {
    const n = 4096;
    c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = ((i / (n - 1)) * 2 - 1) * 2;
      const a = Math.abs(x);
      c[i] = a < 0.7 ? x : Math.sign(x) * (0.7 + 0.3 * Math.tanh((a - 0.7) / 0.3));
    }
    curves.set(key, c);
  }
  return c;
}

/** Amplitude quantiser (bit crusher): `steps` levels per polarity. */
export function crushCurve(steps: number): Curve {
  const key = `c${steps}`;
  let c = curves.get(key);
  if (!c) {
    const n = 4096;
    c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.round(x * steps) / steps;
    }
    curves.set(key, c);
  }
  return c;
}

/* ── Envelopes ─────────────────────────────────────────────────────────── */

/** Attack (linear) → decay (exponential) from silence to silence. */
export function ad(param: AudioParam, t: number, attack: number, peak: number, decay: number): void {
  param.setValueAtTime(SILENT, t);
  param.linearRampToValueAtTime(Math.max(peak, SILENT), t + attack);
  param.exponentialRampToValueAtTime(SILENT, t + attack + decay);
}

/** Attack → hold → release, for gated tones (beeps, buzzes, chords). */
export function ahr(param: AudioParam, t: number, attack: number, peak: number, hold: number, release: number): void {
  const p = Math.max(peak, SILENT);
  param.setValueAtTime(SILENT, t);
  param.linearRampToValueAtTime(p, t + attack);
  param.setValueAtTime(p, t + attack + hold);
  param.exponentialRampToValueAtTime(SILENT, t + attack + hold + release);
}

/** Exponential glide between two positive values. */
export function glide(param: AudioParam, t: number, from: number, to: number, dur: number): void {
  param.setValueAtTime(from, t);
  param.exponentialRampToValueAtTime(to, t + dur);
}

/** Smoothly move a live parameter towards `value` from wherever it is now. */
export function approach(param: AudioParam, t: number, value: number, timeConstant: number): void {
  param.cancelScheduledValues(t);
  param.setValueAtTime(param.value, t);
  param.setTargetAtTime(value, t, timeConstant);
}
