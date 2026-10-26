// Synthesized sound effects. Every generator is deterministic (seeded) and returns either a mono
// Float32Array or a stereo {L, R}, peak- or RMS-normalised; the caller sets level, pan and sends.
import { SR, TAU, makeRng, clamp, smooth, cosRamp, svf, filt, f32, white, pink, brown, smoothRand, normPeak, normRms,
  fades, softClip, mtof, nm, lp4, bp2, onePoleLP, smp, scale, peakAbs } from './dsp.mjs';
import { bell } from './instruments.mjs';

const copy = (x) => Float32Array.from(x);
const exp = Math.exp, sin = Math.sin;
function normStereoPeak(s, target = 1) { const p = Math.max(peakAbs(s.L), peakAbs(s.R)); if (p > 0) { scale(s.L, target / p); scale(s.R, target / p); } return s; }
function normStereoRms(s, target = 0.1) {
  let e = 0; for (let i = 0; i < s.L.length; i++) e += s.L[i] * s.L[i] + s.R[i] * s.R[i];
  const r = Math.sqrt(e / (2 * Math.max(1, s.L.length))); if (r > 0) { scale(s.L, target / r); scale(s.R, target / r); } return s;
}
// polyBLEP band-limited saw source with per-sample frequency array
function blepSaw(freq, r) {
  const n = freq.length, out = f32(n); let ph = r.next();
  for (let i = 0; i < n; i++) {
    const dt = freq[i] / SR; ph += dt; if (ph >= 1) ph -= 1;
    let s = 2 * ph - 1, t = ph;
    if (t < dt) { t /= dt; s -= t + t - t * t - 1; } else if (t > 1 - dt) { t = (t - 1) / dt; s -= t * t + t + t + 1; }
    out[i] = s;
  }
  return out;
}
// damped sinusoid added into x at sample offset
function addMode(x, off, f, amp, tau, att = 0.0005) {
  const n = Math.min(x.length - off, Math.ceil(tau * SR * 9)); if (n <= 0) return;
  const rr = exp(-1 / (tau * SR)), w = TAU * f / SR, cr = rr * Math.cos(w), sr = rr * Math.sin(w); let re = 1, im = 0;
  const na = att * SR;
  for (let i = 0; i < n; i++) { x[off + i] += amp * im * (i < na ? i / na : 1); const nr = re * cr - im * sr; im = re * sr + im * cr; re = nr; }
}
// short filtered-noise click added into x
function addClick(x, off, r, fc, q, tau, amp) {
  const n = Math.min(x.length - off, Math.ceil(tau * SR * 8)); if (n <= 0) return;
  const c = white(n, r); for (let i = 0; i < n; i++) c[i] *= exp(-(i / SR) / tau);
  filt(c, 'bp', fc, q); normPeak(c, amp);
  for (let i = 0; i < Math.min(n, 12); i++) c[i] *= i / 12;                // 0.25 ms ramp: sharp, never a step
  for (let i = 0; i < n; i++) x[off + i] += c[i];
}

// ------------------------------------------------------------------ whooshes
// band-passed noise whose centre sweeps up into the peak and falls after; airy upper layer
export function whoosh({ dur = 0.5, peak = 0.62, f0 = 320, f1 = 2400, f2 = 700, q = 1.3, air = 0.35, rise = 2.2, fall = 0.12, seed = 'whoosh' } = {}) {
  const r = makeRng(seed), n = smp(dur), pk = Math.round(peak * n);
  const x = white(n, r), a = white(n, r);
  const fc = (i) => (i < pk ? f0 * Math.pow(f1 / f0, Math.pow(smooth(i / pk), 0.8)) : f1 * Math.pow(f2 / f1, smooth((i - pk) / Math.max(1, n - pk))));
  svf(x, fc, q, 'bp', 16); normRms(x, 1);
  svf(a, (i) => fc(i) * 2.3, 0.7, 'bp', 16); normRms(a, 1);
  const out = f32(n);
  for (let i = 0; i < n; i++) {
    const e = i < pk ? Math.pow(i / pk, rise) : exp(-((i - pk) / SR) / fall);
    out[i] = (x[i] + air * a[i]) * e;
  }
  fades(out, 0.004, 0.03);
  return normPeak(out);
}
export const whipWhoosh = (seed) => whoosh({ dur: 0.46, peak: 0.63, f0: 300, f1: 2600, f2: 650, q: 1.5, air: 0.3, rise: 2.4, fall: 0.09, seed });
export const airySwish = (seed, bright = 1) => whoosh({ dur: 0.75, peak: 0.5, f0: 1100 * bright, f1: 5200 * bright, f2: 2600 * bright, q: 0.7, air: 0.6, rise: 1.6, fall: 0.16, seed });

// deep "push-through": resonant low sweep + mid air + a sub whump at the peak
export function pushWhoosh({ dur = 1.3, peak = 0.58, seed = 'push' } = {}) {
  const r = makeRng(seed), n = smp(dur), pk = Math.round(peak * n);
  const lo = white(n, r), mid = white(n, r);
  svf(lo, (i) => (i < pk ? 55 * Math.pow(6.5, smooth(i / pk)) : 357 * Math.pow(0.35, (i - pk) / (n - pk))), 2.0, 'bp', 16); normRms(lo, 1);
  svf(mid, (i) => (i < pk ? 280 * Math.pow(5.5, smooth(i / pk)) : 1540 * Math.pow(0.45, (i - pk) / (n - pk))), 0.9, 'bp', 16); normRms(mid, 1);
  const out = f32(n);
  for (let i = 0; i < n; i++) {
    const e = i < pk ? Math.pow(i / pk, 2.6) : exp(-((i - pk) / SR) / 0.15);
    out[i] = (lo[i] + 0.5 * mid[i]) * e;
  }
  let ph = 0;
  for (let i = pk, k = 0; i < n; i++, k++) {
    const t = k / SR; ph += TAU * 40 * (1 + 0.9 * exp(-t / 0.045)) / SR;
    out[i] += 2.6 * sin(ph) * exp(-t / 0.13) * (1 - exp(-t / 0.004));
  }
  softClip(normPeak(out), 1.4);
  fades(out, 0.005, 0.12);
  return normPeak(out);
}

// end of reel: the stone drifts back up into the hang (fast, then slowing) -> loud early, quiet at the seam
export function riseWhoosh({ dur = 0.8, seed = 'rise' } = {}) {
  const r = makeRng(seed), n = smp(dur), x = pink(n, r), a = white(n, r);
  svf(x, (i) => 350 * Math.pow(4.5, Math.pow(i / n, 0.6)), 0.9, 'bp', 16); normRms(x, 1);
  svf(a, (i) => 2600 * Math.pow(2.2, i / n), 0.8, 'bp', 16); normRms(a, 1);
  const out = f32(n);
  for (let i = 0; i < n; i++) { const u = i / n; const e = smooth(u / 0.3) * (0.3 + 0.7 * Math.pow(1 - u, 1.4)); out[i] = (x[i] + 0.4 * a[i]) * e; }
  fades(out, 0.02, 0.01);
  return normPeak(out);
}
// start of reel: quiet hang, then the fall (accelerating) into the impact at `dur`
export function fallWhoosh({ dur = 0.4, hang = 0.12, seed = 'fall' } = {}) {
  const r = makeRng(seed), n = smp(dur), nh = smp(hang), x = pink(n, r), a = white(n, r);
  svf(x, (i) => (i < nh ? 1300 : 1300 * Math.pow(0.32, (i - nh) / (n - nh))), 0.9, 'bp', 16); normRms(x, 1);
  svf(a, (i) => (i < nh ? 5000 : 5000 * Math.pow(0.5, (i - nh) / (n - nh))), 0.8, 'bp', 16); normRms(a, 1);
  const out = f32(n);
  for (let i = 0; i < n; i++) {
    const e = i < nh ? 0.3 : 0.3 + 0.7 * Math.pow((i - nh) / (n - nh), 1.8);
    out[i] = (x[i] + 0.35 * a[i]) * e;
  }
  fades(out, 0.012, 0.004);
  return normPeak(out);
}

// reverse swell sucking into a hit (ends abruptly at `dur`)
export function revSwell({ dur = 0.7, seed = 'rev' } = {}) {
  const r = makeRng(seed), n = smp(dur), x = white(n, r);
  svf(x, (i) => 500 * Math.pow(10, Math.pow(i / n, 1.6)), 0.9, 'bp', 16); normRms(x, 1);
  for (let i = 0; i < n; i++) x[i] *= Math.pow(i / n, 3);
  fades(x, 0.01, 0.004);
  return normPeak(x);
}

// ------------------------------------------------------------------ impacts / hits
// deep soft stone-into-sand impact, sub tuned to D1
export function impact({ seed = 'impact', root = 36.71 } = {}) {
  const r = makeRng(seed), n = smp(2.8), out = f32(n);
  const body = brown(n, r); lp4(body, 200); normRms(body, 1);
  const crunch = white(n, r); svf(crunch, (i) => 1500 * exp(-(i / SR) / 0.25) + 420, 0.8, 'bp', 32); normRms(crunch, 1);
  const grain = smoothRand(n, 140, r);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * root * (1 + 1.2 * exp(-t / 0.05)) / SR;
    const att = 1 - exp(-t / 0.0025);
    out[i] = 1.0 * sin(ph) * exp(-t / 0.65) * att
      + 0.3 * body[i] * exp(-t / 0.13) * att
      + 0.42 * sin(TAU * 98 * t) * exp(-t / 0.07) * att
      + 0.1 * crunch[i] * exp(-t / 0.08) * (0.4 + 0.6 * Math.abs(grain[i]));
  }
  softClip(normPeak(out), 1.7);
  fades(out, 0.001, 0.4);
  return normPeak(out);
}
// the reveal: deep sub boom on D1 with an octave layer, soft punch and a short soft transient
export function subBoom({ seed = 'boom', root = 36.71 } = {}) {
  const r = makeRng(seed), n = smp(2.6), out = f32(n);
  const punch = brown(n, r); lp4(punch, 320); normRms(punch, 1);
  const tr = white(n, r); filt(tr, 'bp', 2400, 0.7); normRms(tr, 1);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, att = 1 - exp(-t / 0.002);
    p1 += TAU * root * (1 + 1.5 * exp(-t / 0.07)) / SR;
    p2 += TAU * root * 2 * (1 + 0.6 * exp(-t / 0.05)) / SR;
    out[i] = (sin(p1) * exp(-t / 0.6) + 0.45 * sin(p2) * exp(-t / 0.22)) * att
      + 0.38 * punch[i] * exp(-t / 0.06) * att + 0.07 * tr[i] * exp(-t / 0.006);
  }
  softClip(normPeak(out), 1.9);
  fades(out, 0.0008, 0.6);
  return normPeak(out);
}
// soft tile "flip" thud: pitched low thump + woody knock + a quiet ring on the number's pitch
export function tileThud({ f = 73.42, soft = false, seed = 'thud' } = {}) {
  const r = makeRng(seed), n = smp(0.9), out = f32(n);
  const nz = white(n, r); filt(nz, 'bp', 850 + 350 * (f / 73.42 - 1), 1.3); normRms(nz, 1);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * f * (1 + 1.0 * exp(-t / 0.03)) / SR;
    const sub = sin(ph) * exp(-t / 0.17) * (1 - exp(-t / 0.002));
    const knock = 0.14 * nz[i] * exp(-t / 0.009) + 0.2 * sin(TAU * f * 6 * t) * exp(-t / 0.03);
    const ring = 0.13 * sin(TAU * f * 4 * t) * exp(-t / 0.33) * (1 - exp(-t / 0.004));
    out[i] = sub + knock * (soft ? 0.45 : 1) + ring;
  }
  softClip(normPeak(out), 1.3);
  fades(out, 0.001, 0.12);
  return normPeak(out);
}
// short riser into a flip: band-pass noise sweep + an octave glide up to `target`, accelerating tremolo
export function riser({ dur = 0.55, target = 293.66, soft = false, seed = 'riser' } = {}) {
  const r = makeRng(seed), n = smp(dur), nz = white(n, r), out = f32(n);
  svf(nz, (i) => 480 * Math.pow(9.5, Math.pow(i / n, 1.35)), 1.1, 'bp', 16); normRms(nz, 1);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n, t = i / SR;
    ph += TAU * target * Math.pow(2, Math.pow(u, 0.75) - 1) / SR;
    const trem = 1 - 0.28 * (0.5 + 0.5 * sin(TAU * (5 + 16 * u) * t));
    const tone = (sin(ph) + 0.22 * sin(2 * ph) + 0.07 * sin(3 * ph)) * trem;
    out[i] = Math.pow(u, 2.1) * (0.32 * nz[i] * (soft ? 0.7 : 1) + 0.8 * tone);
  }
  fades(out, 0.01, 0.006);
  return normPeak(out);
}
// ------------------------------------------------------------------ desert hook
export function dustBlast({ dur = 2.4, seed = 'dust' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) };
  for (const ch of ['L', 'R']) {
    const x = pink(n, r);
    svf(x, (i) => 5200 * exp(-(i / SR) / 0.65) + 650, 0.6, 'lp', 32); filt(x, 'hp', 260, 0.7); normRms(x, 1);
    const g = smoothRand(n, 9, r);
    for (let i = 0; i < n; i++) { const t = i / SR; out[ch][i] = x[i] * (1 - exp(-t / 0.035)) * (0.62 * exp(-t / 0.32) + 0.38 * exp(-t / 1.05)) * (0.8 + 0.2 * g[i]); }
    fades(out[ch], 0.002, 0.35);
  }
  return normStereoPeak(out);
}
export function pebble({ size = 0.5, seed = 'pebble' } = {}) {
  const r = makeRng(seed), n = smp(0.07), x = f32(n);
  const f = 5200 - 3000 * size + r.uni(-450, 450), tau = 0.0028 + 0.006 * size;
  addClick(x, 0, r, f * 0.9, 1.1, 0.0012, 0.55);
  addMode(x, 0, f, 0.5, tau); addMode(x, 0, f * 1.73, 0.25, tau * 0.6);
  if (size > 0.35) addMode(x, 0, 340 + 260 * r.next(), 0.35 * size, 0.009);
  fades(x, 0.0003, 0.01);
  return normPeak(x);
}
// soft formant "baa" (bleat with its quaver), distant
export function baa({ pitch = 420, dur = 0.55, seed = 'baa' } = {}) {
  const r = makeRng(seed), n = smp(dur), freq = f32(n), vib = r.uni(6.5, 8.5);
  for (let i = 0; i < n; i++) { const t = i / SR, u = i / n; freq[i] = pitch * (1 - 0.1 * u) * (1 - 0.09 * exp(-t / 0.04)) * (1 + 0.035 * sin(TAU * vib * t)); }
  const src = blepSaw(freq, r); const br = white(n, r); for (let i = 0; i < n; i++) src[i] += 0.1 * br[i];
  const F = [[820, 4, 1], [1750, 6, 0.55], [2750, 7, 0.28]], out = f32(n);
  for (const [fc, q, a] of F) { const b = copy(src); filt(b, 'bp', fc, q); for (let i = 0; i < n; i++) out[i] += a * b[i]; }
  for (let i = 0; i < n; i++) { const t = i / SR, u = i / n; out[i] *= smooth(t / 0.03) * (1 - 0.35 * (0.5 + 0.5 * sin(TAU * vib * t))) * (u > 0.6 ? cosRamp((1 - u) / 0.4) : 1); }
  filt(out, 'lp', 3600, 0.7); filt(out, 'hp', 300, 0.7);
  return normPeak(out);
}
// light hoof patter on sand (sheep running off), stereo
export function patter({ dur = 1.8, rate = 10, seed = 'patter' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) };
  let t = r.uni(0, 0.05);
  while (t < dur - 0.05) {
    const m = smp(0.05), x = white(m, r); onePoleLP(x, 650); normPeak(x, 1);
    for (let i = 0; i < m; i++) x[i] *= exp(-(i / SR) / 0.009);
    addClick(x, 0, r, 2400, 1, 0.001, 0.25);
    const a = r.uni(0.35, 1) * (1 - 0.5 * t / dur), p = r.uni(-0.75, 0.75), gl = Math.cos((p + 1) * Math.PI / 4), gr = Math.sin((p + 1) * Math.PI / 4);
    const i0 = smp(t); for (let i = 0; i < m && i0 + i < n; i++) { out.L[i0 + i] += x[i] * a * gl; out.R[i0 + i] += x[i] * a * gr; }
    t += -Math.log(1 - r.next() * 0.95) / rate;
  }
  return normStereoPeak(out);
}
// soft UI tick
export function tick({ f = 2000, tau = 0.006, click = 0.35, seed = 'tick' } = {}) {
  const r = makeRng(seed), n = smp(0.05), x = f32(n);
  addMode(x, 0, f, 1, tau, 0.0004); addMode(x, 0, f * 2.01, 0.18, tau * 0.5, 0.0004);
  addClick(x, 0, r, f * 1.7, 1.2, 0.0012, click);
  fades(x, 0.0003, 0.006);
  return normPeak(x);
}
export function settleDust({ dur = 3.4, seed = 'settle' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) };
  for (const ch of ['L', 'R']) {
    const x = pink(n, r); bp2(x, 900, 7000); normRms(x, 1);
    for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= smooth(t / 0.4) * exp(-t / 1.3); }
    let t = 0.05;
    while (t < dur - 0.05) { const rate = 30 * exp(-t / 1.2) + 3; addClick(x, smp(t), r, r.uni(3000, 8000), 1.5, 0.0009, r.uni(0.05, 0.25) * exp(-t / 1.6)); t += -Math.log(1 - r.next() * 0.95) / rate; }
    out[ch] = x;
  }
  return normStereoRms(out, 0.1);
}
// parchment unroll: crinkly band-passed noise sweep + low flap + a soft settle at the end
export function parchment({ dur = 1.5, seed = 'parch' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) };
  const crk = f32(n); let t = 0;                                      // shared crackle envelope (correlated L/R)
  while (t < dur) { const u = t / dur, dens = 170 * Math.sin(Math.PI * Math.min(1, u / 0.85)) + 15; const i0 = smp(t), a = r.uni(0.3, 1);
    for (let i = 0; i < smp(0.004) && i0 + i < n; i++) crk[i0 + i] += a * exp(-(i / SR) / 0.0011); t += -Math.log(1 - r.next() * 0.95) / dens; }
  for (const ch of ['L', 'R']) {
    const x = white(n, r); svf(x, (i) => 900 * Math.pow(3.6, Math.pow(i / n, 0.7)), 0.9, 'bp', 32); normRms(x, 1);
    const lo = white(n, r); lp4(lo, 420); normRms(lo, 1);
    for (let i = 0; i < n; i++) {
      const tt = i / SR, u = i / n;
      const env = smooth(tt / 0.08) * (u < 0.82 ? 1 - 0.3 * u : cosRamp((1 - u) / 0.18) * 0.75);
      const flap = Math.pow(0.5 + 0.5 * sin(TAU * 3.6 * tt + (ch === 'L' ? 0 : 0.7)), 2);
      out[ch][i] = env * (x[i] * (0.18 + 1.4 * crk[i]) + 0.22 * lo[i] * flap);
    }
    const s0 = smp(dur * 0.84), sl = white(smp(0.12), r); filt(sl, 'bp', 700, 1.0); normPeak(sl, 0.9);
    for (let i = 0; i < sl.length && s0 + i < n; i++) out[ch][s0 + i] += sl[i] * exp(-(i / SR) / 0.022);
    fades(out[ch], 0.01, 0.06);
  }
  return normStereoPeak(out);
}
// bell cluster sparkle (stereo, sweeping across)
export function shimmer({ notes = ['D6', 'F6', 'A6', 'C7', 'D7'], spacing = 0.065, dur = 2.4, bright = 0.6, air = 0.25, pan = [-0.55, 0.55], seed = 'shim' } = {}) {
  const r = makeRng(seed), n = smp(dur + spacing * notes.length + 0.1), out = { L: f32(n), R: f32(n) };
  notes.forEach((nt, k) => {
    const f = (typeof nt === 'number' ? nt : mtof(nm(nt))) * (1 + r.uni(-0.002, 0.002));
    const b = bell(f, { dur, bright, seed: seed + k }); const p = pan[0] + (pan[1] - pan[0]) * (notes.length > 1 ? k / (notes.length - 1) : 0.5);
    const a = (p + 1) * Math.PI / 4, i0 = smp(k * spacing * r.uni(0.85, 1.15)), g = 0.8 + 0.2 * r.next();
    for (let i = 0; i < b.length && i0 + i < n; i++) { out.L[i0 + i] += b[i] * Math.cos(a) * g; out.R[i0 + i] += b[i] * Math.sin(a) * g; }
  });
  if (air > 0) for (const ch of ['L', 'R']) {
    const x = white(n, r); bp2(x, 5500, 12000); normRms(x, 1);
    for (let i = 0; i < n; i++) { const t = i / SR; out[ch][i] += air * 0.25 * x[i] * smooth(t / 0.05) * exp(-t / 0.45); }
  }
  return normStereoPeak(out);
}
export function chime({ notes = ['D5', 'A5', 'D6', 'F#6'], spacing = 0.08, dur = 3.6, seed = 'chime' } = {}) {
  return shimmer({ notes, spacing, dur, bright: 0.35, air: 0, pan: [-0.35, 0.35], seed });
}

// ------------------------------------------------------------------ people / places
export function stepStone({ weight = 1, seed = 'step' } = {}) {
  const r = makeRng(seed), n = smp(0.3), x = f32(n);
  addMode(x, 0, 105 + r.uni(-8, 8), 0.75 * weight, 0.016, 0.001);
  addClick(x, 0, r, 2200 + r.uni(-300, 300), 1.2, 0.0035, 0.55);
  const sc = white(smp(0.06), r); filt(sc, 'bp', 950, 0.8); normPeak(sc, 0.14); for (let i = 0; i < sc.length; i++) x[i] += sc[i] * exp(-(i / SR) / 0.025);
  const t2 = smp(0.065 + r.uni(-0.01, 0.01));                         // toe
  addMode(x, t2, 130, 0.35 * weight, 0.012, 0.001); addClick(x, t2, r, 3000, 1.2, 0.0025, 0.32);
  fades(x, 0.0003, 0.03);
  return normPeak(x);
}
export function coins({ count = 5, spread = 0.14, seed = 'coins' } = {}) {
  const r = makeRng(seed), n = smp(spread + 0.35), x = f32(n);
  for (let k = 0; k < count; k++) {
    const off = smp(r.uni(0, spread)), f = r.uni(2700, 4800), a = r.uni(0.4, 1), tau = r.uni(0.03, 0.09);
    [[1, 1], [1.58, 0.6], [2.41, 0.4], [3.31, 0.25]].forEach(([ratio, g], j) => addMode(x, off, f * ratio, a * g, tau / (1 + j * 0.6)));
    addClick(x, off, r, 6000, 1.5, 0.0006, 0.3 * a);
  }
  fades(x, 0.0003, 0.05);
  return normPeak(x);
}
// unintelligible babble: formant-filtered band-limited saw "syllables", stereo, low-passed
const VOWELS = [[730, 1090, 2440], [270, 2290, 3010], [530, 1840, 2480], [570, 840, 2410], [440, 1020, 2240], [300, 870, 2240], [640, 1190, 2390]];
export function murmur({ dur = 4, talkers = 7, pitchLo = 105, pitchHi = 230, lp = 1700, sylLo = 0.09, sylHi = 0.2, shout = 0, seed = 'murmur' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) };
  for (let k = 0; k < talkers; k++) {
    const p = r.uni(-0.8, 0.8), gl = Math.cos((p + 1) * Math.PI / 4), gr = Math.sin((p + 1) * Math.PI / 4);
    const base = r.uni(pitchLo, pitchHi), lvl = r.uni(0.5, 1); let t = r.uni(0, 0.5), phrase = 0;
    while (t < dur - 0.05) {
      const d = r.uni(sylLo, sylHi) * (1 + shout * 0.8), m = smp(d), V = r.pick(VOWELS);
      const freq = f32(m), f0 = base * (1 + 0.12 * Math.cos(phrase * 0.9)) * (1 + shout * 0.35);
      for (let i = 0; i < m; i++) freq[i] = f0 * (1 + r.uni(-0.002, 0.002) + (shout ? 0.06 : -0.05) * i / m);
      const src = blepSaw(freq, r), syl = f32(m);
      V.forEach((fc, j) => { const b = copy(src); filt(b, 'bp', fc, 5 + j * 2); for (let i = 0; i < m; i++) syl[i] += b[i] * [1, 0.5, 0.25][j]; });
      const i0 = smp(t), a = lvl * r.uni(0.6, 1);
      for (let i = 0; i < m && i0 + i < n; i++) { const e = Math.pow(sin(Math.PI * i / m), 1.5) * a; out.L[i0 + i] += syl[i] * e * gl; out.R[i0 + i] += syl[i] * e * gr; }
      phrase++;
      t += d + (r.next() > 0.18 ? r.uni(0.02, 0.07) : r.uni(0.25, 0.75));
    }
  }
  lp4(out.L, lp); lp4(out.R, lp); filt(out.L, 'hp', 180, 0.7); filt(out.R, 'hp', 180, 0.7);
  for (const ch of ['L', 'R']) { const x = pink(n, r); bp2(x, 250, 1400); normRms(x, 0.02); for (let i = 0; i < n; i++) out[ch][i] += x[i]; }
  return normStereoRms(out, 0.1);
}
// awning / cloth flutter in a gust: irregular flaps (random period and strength) on band-passed noise
export function flutter({ dur = 0.9, seed = 'flutter' } = {}) {
  const r = makeRng(seed), n = smp(dur), x = white(n, r), lo = white(n, r), out = f32(n), flap = f32(n);
  bp2(x, 450, 2800); normRms(x, 1); lp4(lo, 320); normRms(lo, 1);
  let t = r.uni(0, 0.03);
  while (t < dur) {
    const per = r.uni(0.045, 0.11), a = r.uni(0.35, 1), w = per * r.uni(0.35, 0.6), i0 = smp(t), m = smp(w);
    for (let i = 0; i < m && i0 + i < n; i++) flap[i0 + i] = Math.max(flap[i0 + i], a * Math.pow(sin(Math.PI * i / m), 3));
    t += per;
  }
  for (let i = 0; i < n; i++) {
    const u = i / n, env = smooth(u / 0.18) * (u > 0.55 ? cosRamp((1 - u) / 0.45) : 1);
    out[i] = env * (x[i] * (0.15 + flap[i]) + 0.35 * lo[i] * flap[i]);
  }
  fades(out, 0.01, 0.05);
  return normPeak(out);
}
export function crickets({ dur = 4, count = 2, seed = 'crickets' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) };
  for (let k = 0; k < count; k++) {
    const fc = r.uni(4300, 5100), per = r.uni(0.62, 0.86), pulses = 3 + r.int(2), p = k % 2 ? r.uni(0.35, 0.7) : -r.uni(0.35, 0.7), lvl = r.uni(0.6, 1);
    const gl = Math.cos((p + 1) * Math.PI / 4), gr = Math.sin((p + 1) * Math.PI / 4); let t = r.uni(0, per);
    while (t < dur - 0.2) {
      for (let j = 0; j < pulses; j++) {
        const i0 = smp(t + j * 0.031), m = smp(0.014), ph0 = r.next() * TAU;
        for (let i = 0; i < m && i0 + i < n; i++) { const s = sin(TAU * fc * (1 + 0.006 * i / m) * i / SR + ph0) * Math.pow(sin(Math.PI * i / m), 2) * lvl; out.L[i0 + i] += s * gl; out.R[i0 + i] += s * gr; }
      }
      t += per * r.uni(0.93, 1.07);
    }
  }
  for (const ch of ['L', 'R']) {                                     // distant chorus
    const x = white(n, r); filt(x, 'bp', 4700, 5); normRms(x, 0.05); const ph = r.next();
    for (let i = 0; i < n; i++) out[ch][i] += x[i] * Math.pow(0.5 + 0.5 * sin(TAU * (29 * i / SR + ph)), 3);
  }
  return normStereoPeak(out);
}
export function wind({ dur = 4, lo = 180, hi = 1100, gust = 0.55, rate = 0.15, move = 0.7, seed = 'wind' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = {};
  for (const ch of ['L', 'R']) {
    const x = pink(n, r), g = smoothRand(n, rate * r.uni(0.8, 1.25), r), c = smoothRand(n, rate * 1.7, r), mid = Math.sqrt(lo * hi);
    svf(x, (i) => mid * Math.pow(2, move * c[i]), 0.55, 'bp', 32); bp2(x, lo * 0.6, hi * 1.6); normRms(x, 1);
    for (let i = 0; i < n; i++) x[i] *= (1 - gust) + gust * (0.5 + 0.5 * g[i]);
    out[ch] = x;
  }
  return normStereoRms(out, 0.1);
}
export function rumble({ dur = 4, rolls = [], seed = 'rumble' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = {};
  for (const ch of ['L', 'R']) {
    const x = brown(n, r); lp4(x, 150); filt(x, 'hp', 28, 0.7); normRms(x, 1);
    const sw = smoothRand(n, 0.35, r);
    for (let i = 0; i < n; i++) {
      const t = i / SR; let e = 0.3 + 0.5 * Math.pow(Math.max(0, 0.5 + 0.5 * sw[i]), 1.5);
      for (const t0 of rolls) if (t > t0) e += 0.9 * (1 - exp(-(t - t0) / 0.12)) * exp(-(t - t0) / 1.1);
      x[i] *= e;
    }
    softClip(normPeak(x), 1.5);
    out[ch] = x;
  }
  return normStereoRms(out, 0.1);
}
// tiny lightning "thunder click": fizzy micro-crackle + a little low pop
export function zap({ seed = 'zap' } = {}) {
  const r = makeRng(seed), n = smp(0.45), x = f32(n); let t = 0; const k = 7 + r.int(7);
  for (let j = 0; j < k; j++) { addClick(x, smp(t), r, r.uni(2800, 7000), 1.3, 0.0006, r.uni(0.4, 1) * exp(-t / 0.05)); t += r.uni(0.002, 0.014); }
  const fz = white(smp(0.08), r); filt(fz, 'hp', 5000, 0.7); normPeak(fz, 0.12); for (let i = 0; i < fz.length; i++) x[i] += fz[i] * exp(-(i / SR) / 0.02);
  addMode(x, smp(0.11), 68, 0.45, 0.07, 0.004); addMode(x, smp(0.11), 140, 0.15, 0.04, 0.004);
  fades(x, 0.0003, 0.05);
  return normPeak(x);
}
export function stepRun({ seed = 'run' } = {}) {
  const r = makeRng(seed), n = smp(0.18), x = f32(n);
  addMode(x, 0, 80 + r.uni(-6, 6), 0.9, 0.022, 0.0015);
  const cr = white(n, r), g = f32(n); filt(cr, 'bp', 1100 + r.uni(-200, 200), 0.7); normPeak(cr, 1);
  for (let i = 0; i < n; i += smp(r.uni(0.001, 0.004))) g[i] = r.uni(0.3, 1);
  onePoleLP(g, 300); normPeak(g, 1);
  for (let i = 0; i < n; i++) x[i] += 0.5 * cr[i] * g[i] * exp(-(i / SR) / 0.035);
  addClick(x, 0, r, 3200, 0.8, 0.002, 0.18);
  fades(x, 0.0003, 0.03);
  return normPeak(x);
}
// hollow wind through a stone gate: broadband wind + two slowly wandering resonances
export function gateWind({ dur = 5, seed = 'gate' } = {}) {
  const r = makeRng(seed), n = smp(dur), w = wind({ dur, lo: 200, hi: 1400, gust: 0.6, rate: 0.12, seed: seed + 'w' });
  for (const ch of ['L', 'R']) {
    const a = pink(n, r), b = pink(n, r), ca = smoothRand(n, 0.11, r), cb = smoothRand(n, 0.09, r), g = smoothRand(n, 0.2, r);
    svf(a, (i) => 245 * Math.pow(2, 0.14 * ca[i]), 9, 'bp', 32); normRms(a, 1);
    svf(b, (i) => 590 * Math.pow(2, 0.12 * cb[i]), 7, 'bp', 32); normRms(b, 1);
    for (let i = 0; i < n; i++) w[ch][i] = w[ch][i] * 10 * 0.7 + (0.55 * a[i] + 0.3 * b[i]) * (0.55 + 0.45 * g[i]);
  }
  return normStereoRms(w, 0.1);
}
// stone (name tag) crack: sharp-but-soft transient, crackle run, body, crumbs
export function crack({ seed = 'crack' } = {}) {
  const r = makeRng(seed), n = smp(0.7), x = f32(n);
  addClick(x, 0, r, 2800, 0.8, 0.0025, 1.0);
  let t = 0.004; const k = 10 + r.int(6);
  for (let j = 0; j < k; j++) { addClick(x, smp(t), r, r.uni(1500, 4200), 1.2, r.uni(0.0008, 0.002), 0.75 * exp(-t / 0.06) * r.uni(0.5, 1)); t += r.uni(0.004, 0.014); }
  addMode(x, 0, 190, 0.55, 0.03, 0.001); addMode(x, 0, 112, 0.4, 0.05, 0.001);
  for (let j = 0; j < 4; j++) { const off = smp(r.uni(0.13, 0.42)); addClick(x, off, r, r.uni(2500, 5000), 1.5, 0.001, 0.15); addMode(x, off, r.uni(3000, 5000), 0.1, 0.004); }
  fades(x, 0.0003, 0.05);
  return normPeak(x);
}
// one lub-dub, low-passed and lightly saturated so it is felt (and still audible on phones)
export function heartbeat({ seed = 'heart' } = {}) {
  const r = makeRng(seed), n = smp(0.8), x = f32(n);
  const thump = (off, f0, f1, amp, tau) => { let ph = 0; for (let i = 0; off + i < n; i++) { const t = i / SR; ph += TAU * (f1 + (f0 - f1) * exp(-t / 0.035)) / SR; x[off + i] += amp * sin(ph) * (1 - exp(-t / 0.004)) * exp(-t / tau); } };
  thump(0, 68, 44, 1.0, 0.09); thump(smp(0.235), 76, 50, 0.72, 0.07);
  const b = brown(n, r); lp4(b, 160); normPeak(b, 0.25); for (let i = 0; i < n; i++) x[i] += b[i] * (exp(-(i / SR) / 0.03) + 0.7 * (i > smp(0.235) ? exp(-((i - smp(0.235)) / SR) / 0.025) : 0));
  softClip(normPeak(x), 2.2); lp4(x, 320); fades(x, 0.001, 0.1);
  return normPeak(x);
}
export function fire({ dur = 6, rate = 11, seed = 'fire' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = {};
  for (const ch of ['L', 'R']) {
    const roar = brown(n, r); lp4(roar, 380); filt(roar, 'hp', 60, 0.7); normRms(roar, 1);
    const g = smoothRand(n, 0.8, r), hiss = white(n, r); bp2(hiss, 2000, 6500); normRms(hiss, 1);
    const x = f32(n);
    for (let i = 0; i < n; i++) x[i] = 0.13 * roar[i] * (0.65 + 0.35 * g[i]) + 0.02 * hiss[i];
    let t = r.uni(0, 0.05);
    while (t < dur - 0.05) {
      const burst = r.next() < 0.3 ? 2 + r.int(3) : 1, a = Math.exp(r.gauss() * 0.6) * 0.35;
      for (let j = 0; j < burst; j++) addClick(x, smp(t + j * r.uni(0.003, 0.012)), r, r.uni(1200, 5200), 1.2, r.uni(0.0005, 0.0028), a * r.uni(0.5, 1));
      t += -Math.log(1 - r.next() * 0.96) / rate;
    }
    t = r.uni(0.2, 1);
    while (t < dur - 0.1) { addClick(x, smp(t), r, r.uni(500, 1300), 1.0, r.uni(0.004, 0.008), r.uni(0.4, 0.8)); t += -Math.log(1 - r.next() * 0.96) / 0.7; }
    out[ch] = x;
  }
  return normStereoRms(out, 0.1);
}
// breathy whisper texture (no words): sibilant + breathy bands under a syllabic envelope
export function whisper({ dur = 0.48, seed = 'whisper' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = f32(n);
  const s = white(n, r), sh = white(n, r), h = white(n, r);
  filt(s, 'bp', r.uni(4800, 6400), 1.5); filt(sh, 'bp', r.uni(2200, 2800), 1.8); filt(h, 'bp', r.uni(1100, 1500), 1.2);
  normRms(s, 1); normRms(sh, 1); normRms(h, 1);
  const syl = []; let t = 0.01; while (t < dur - 0.06) { const d = r.uni(0.07, 0.13); syl.push([t, d, r.next() < 0.45]); t += d + r.uni(0.01, 0.04); }
  for (let i = 0; i < n; i++) {
    const tt = i / SR; let e = 0, sib = 0;
    for (const [t0, d, isS] of syl) if (tt >= t0 && tt < t0 + d) { const v = Math.pow(sin(Math.PI * (tt - t0) / d), 1.6); e = Math.max(e, v); if (isS) sib = Math.max(sib, v); }
    out[i] = e * (0.55 * sh[i] + 0.4 * h[i]) + sib * 0.75 * s[i];
  }
  onePoleLP(out, 9000); fades(out, 0.015, 0.05);
  return normPeak(out);
}
// gold thread snapping: Karplus-Strong pluck with a small downward bend + tiny tick + air
export function snap({ f = 880, seed = 'snap' } = {}) {
  const r = makeRng(seed), n = smp(0.7), x = f32(n);
  const P0 = SR / f, L = Math.ceil(P0 * 1.1) + 4, buf = new Float64Array(L * 8);
  const rho = exp(-1 / (0.13 * f));
  const ex = white(Math.ceil(P0), r); onePoleLP(ex, 3500); onePoleLP(ex, 5000);   // softer, rounder pick
  let w = 0; const size = buf.length;
  for (let i = 0; i < n; i++) {
    const t = i / SR, P = P0 * (1 + 0.035 * (1 - exp(-t / 0.05)));
    const rd = w - P, i1 = Math.floor(rd), fr = rd - i1;
    const a = buf[(i1 + size * 4) % size], b = buf[(i1 - 1 + size * 4) % size], c = buf[(i1 + 1 + size * 4) % size];
    const delayed = a + fr * (c - a), prev = b + fr * (a - b);
    let y = rho * 0.5 * (delayed + prev); if (i < ex.length) y += ex[i];
    buf[w % size] = y; w++;
    x[i] = y;
  }
  normPeak(x, 1);
  addClick(x, 0, r, 4800, 1.2, 0.001, 0.28);
  const air = white(smp(0.08), r); filt(air, 'hp', 6000, 0.7); normPeak(air, 0.16); for (let i = 0; i < air.length; i++) x[i] += air[i] * exp(-(i / SR) / 0.025);
  onePoleLP(x, 6000); fades(x, 0.0008, 0.15);
  return normPeak(x);
}
export function pop({ f = 560, seed = 'pop' } = {}) {
  const n = smp(0.16), x = f32(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * f * (1 + 0.55 * (1 - exp(-t / 0.012))) / SR; x[i] = (sin(ph) + 0.22 * sin(2 * ph)) * (1 - exp(-t / 0.0015)) * exp(-t / 0.032); }
  filt(x, 'lp', 4000, 0.7); fades(x, 0.0003, 0.02);
  return normPeak(x);
}
export function washSweep({ f = 1174.66, seed = 'wash' } = {}) {
  const r = makeRng(seed), sh = shimmer({ notes: [f, f * 1.5, f * 2], spacing: 0.04, dur: 1.7, bright: 0.4, air: 0, pan: [-0.3, 0.3], seed });
  const n = sh.L.length, m = smp(0.45);
  for (const ch of ['L', 'R']) {
    const a = white(m, r); svf(a, (i) => 2500 * Math.pow(3.6, i / m), 1.2, 'bp', 16); normRms(a, 1);
    for (let i = 0; i < m && i < n; i++) sh[ch][i] += 0.12 * a[i] * Math.pow(sin(Math.PI * i / m), 1.5);
  }
  return normStereoPeak(sh);
}
// soft rising glint (thread regrowing): swelled tone with a little upward glide
export function glint({ f = 587.33, seed = 'glint' } = {}) {
  const r = makeRng(seed), n = smp(1.1), x = f32(n); let ph = r.next() * TAU;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * f * Math.pow(2, -0.6 / 12 * exp(-t / 0.06)) / SR;
    const e = t < 0.13 ? Math.pow(t / 0.13, 2) : exp(-(t - 0.13) / 0.3);
    x[i] = (sin(ph) + 0.28 * sin(2 * ph) + 0.08 * sin(3 * ph)) * e;
  }
  fades(x, 0.002, 0.1);
  return normPeak(x);
}
export function tap({ f = 880, seed = 'tap' } = {}) {
  const r = makeRng(seed), n = smp(0.22), x = f32(n);
  addMode(x, 0, f, 1, 0.05, 0.0006); addMode(x, 0, f * 3.98, 0.25, 0.012, 0.0004);
  addClick(x, 0, r, 3200, 1, 0.001, 0.18);
  fades(x, 0.0003, 0.03);
  return normPeak(x);
}
export function typeTick({ seed = 'type' } = {}) {
  const r = makeRng(seed), n = smp(0.045), x = f32(n);
  addClick(x, 0, r, r.uni(3500, 5500), 1.5, 0.0022, 1);
  addMode(x, 0, r.uni(1700, 2300), 0.35, 0.006, 0.0003); addMode(x, 0, 420, 0.2, 0.008, 0.0005);
  fades(x, 0.0003, 0.008);
  return normPeak(x);
}
export function heartPop({ f = 700, seed = 'hpop' } = {}) {
  const n = smp(0.22), x = f32(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * f * (1 + 0.45 * (1 - exp(-t / 0.03))) / SR; x[i] = (sin(ph) + 0.15 * sin(2 * ph)) * (1 - exp(-t / 0.002)) * exp(-t / 0.06) + 0.08 * sin(4 * ph) * exp(-t / 0.02); }
  fades(x, 0.0003, 0.03);
  return normPeak(x);
}
// low cinematic swell (sine D + octave + low noise), rises then falls
export function lowSwell({ dur = 3.0, f = 36.71, peak = 0.75, seed = 'swell' } = {}) {
  const r = makeRng(seed), n = smp(dur), x = f32(n), b = brown(n, r); lp4(b, 130); normRms(b, 0.3);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n; p1 += TAU * f / SR; p2 += TAU * f * 2.003 / SR;
    const e = u < peak ? Math.pow(u / peak, 2) : cosRamp((1 - u) / (1 - peak));
    x[i] = e * (sin(p1) + 0.55 * sin(p2) + b[i]);
  }
  softClip(normPeak(x), 1.4); fades(x, 0.05, 0.05);
  return normPeak(x);
}
