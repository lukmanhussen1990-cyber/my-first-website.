// Synthesized sound effects (Q.02 THE OLDEST MAN). Every generator is deterministic (seeded) and returns
// either a mono Float32Array or a stereo {L, R}, peak- or RMS-normalised; the caller sets level, pan and
// sends. Generic generators (whooshes, booms, ticks, bells, crickets, wind, murmur) come from the
// SEVEN THINGS synth; the lamp, sand, paper, wood, water, rain, thunder and CTA sounds are new.
import { SR, TAU, makeRng, clamp, smooth, cosRamp, svf, filt, f32, white, pink, brown, smoothRand, normPeak, normRms,
  fades, softClip, mtof, nm, lp4, bp2, onePoleLP, smp, scale, peakAbs } from './dsp.mjs';
import { bell } from './instruments.mjs';

const copy = (x) => Float32Array.from(x);
const exp = Math.exp, sin = Math.sin;
export function normStereoPeak(s, target = 1) { const p = Math.max(peakAbs(s.L), peakAbs(s.R)); if (p > 0) { scale(s.L, target / p); scale(s.R, target / p); } return s; }
export function normStereoRms(s, target = 0.1) {
  let e = 0; for (let i = 0; i < s.L.length; i++) e += s.L[i] * s.L[i] + s.R[i] * s.R[i];
  const r = Math.sqrt(e / (2 * Math.max(1, s.L.length))); if (r > 0) { scale(s.L, target / r); scale(s.R, target / r); } return s;
}
const panLR = (p) => { const a = (clamp(p, -1, 1) + 1) * Math.PI / 4; return [Math.cos(a), Math.sin(a)]; };
// add mono `x` (or stereo) into stereo `st` at sample offset, with gain and pan
function addSt(st, x, off, g = 1, pan = 0) {
  if (x.L) { for (let i = 0; i < x.L.length && off + i < st.L.length; i++) if (off + i >= 0) { st.L[off + i] += x.L[i] * g; st.R[off + i] += x.R[i] * g; } return; }
  const [gl, gr] = panLR(pan);
  for (let i = 0; i < x.length && off + i < st.L.length; i++) if (off + i >= 0) { st.L[off + i] += x[i] * g * gl; st.R[off + i] += x[i] * g * gr; }
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
// bubble-resonance chirp (water): sine whose pitch glides f0 -> f1 (time constant tauG), decaying with tau
function addChirp(x, off, f0, f1, tauG, tau, amp) {
  const m = Math.min(x.length - off, Math.ceil(tau * SR * 8)); let ph = 0;
  for (let i = 0; i < m; i++) { const t = i / SR; ph += TAU * f0 * Math.pow(f1 / f0, 1 - exp(-t / tauG)) / SR; x[off + i] += amp * sin(ph) * (1 - exp(-t / 0.0007)) * exp(-t / tau); }
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
export const airySwish = (seed, bright = 1, dur = 0.75) => whoosh({ dur, peak: 0.5, f0: 1100 * bright, f1: 5200 * bright, f2: 2600 * bright, q: 0.7, air: 0.6, rise: 1.6, fall: 0.16, seed });
// dust transition: an airy swish with a cloud of fine grains riding its envelope (stereo, drifting)
export function dustSwish({ dur = 0.8, seed = 'dustSwish' } = {}) {
  const r = makeRng(seed), w = whoosh({ dur, peak: 0.5, f0: 900, f1: 4200, f2: 1800, q: 0.8, air: 0.6, rise: 1.6, fall: 0.15, seed: seed + 'w' });
  const n = w.length, out = { L: f32(n), R: f32(n) }; addSt(out, w, 0, 1, 0);
  let t = 0.02;
  while (t < dur - 0.02) {
    const u = t / dur, e = u < 0.5 ? Math.pow(u / 0.5, 1.6) : exp(-(t - dur * 0.5) / 0.15), g = f32(smp(0.01));
    addClick(g, 0, r, r.uni(3000, 9000), 1.4, 0.0006, r.uni(0.2, 0.6) * e);
    addSt(out, g, smp(t), 1, -0.7 + 1.4 * u + r.uni(-0.3, 0.3));
    t += -Math.log(1 - r.next() * 0.96) / 220;
  }
  return normStereoPeak(out);
}
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
// reverse swell sucking into a hit (ends abruptly at `dur`)
export function revSwell({ dur = 0.7, f0 = 500, oct = 3.3, seed = 'rev' } = {}) {
  const r = makeRng(seed), n = smp(dur), x = white(n, r);
  svf(x, (i) => f0 * Math.pow(2, oct * Math.pow(i / n, 1.6)), 0.9, 'bp', 16); normRms(x, 1);
  for (let i = 0; i < n; i++) x[i] *= Math.pow(i / n, 3);
  fades(x, 0.01, 0.004);
  return normPeak(x);
}
// anticipation "inhale" (the number dips before it rises): short airy reverse swell, cut on the hit
export function inhale({ dur = 0.25, seed = 'inhale' } = {}) {
  const r = makeRng(seed), n = smp(dur), x = pink(n, r), y = white(n, r), out = f32(n);
  svf(x, (i) => 650 * Math.pow(3.6, i / n), 1.3, 'bp', 16); normRms(x, 1);
  svf(y, (i) => 2800 * Math.pow(2.2, i / n), 1.0, 'bp', 16); normRms(y, 1);
  for (let i = 0; i < n; i++) { const u = i / n; out[i] = Math.pow(u, 2.2) * (x[i] + 0.45 * y[i]); }
  fades(out, 0.012, 0.005);
  return normPeak(out);
}

// ------------------------------------------------------------------ hits
// deep soft hit for the hook title: D1 sub with a gliding attack, octave + twelfth for small speakers,
// a warm low body; almost nothing above 300 Hz so it never sits on the first word
export function deepHit({ seed = 'hit', root = 36.71 } = {}) {
  const r = makeRng(seed), n = smp(3.2), out = f32(n);
  const body = brown(n, r); lp4(body, 240); normRms(body, 1);
  let p1 = 0, p2 = 0, p3 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, att = 1 - exp(-t / 0.003);
    p1 += TAU * root * (1 + 1.6 * exp(-t / 0.06)) / SR;
    p2 += TAU * root * 2 * (1 + 0.5 * exp(-t / 0.04)) / SR;
    p3 += TAU * root * 3 * (1 + 0.3 * exp(-t / 0.03)) / SR;
    out[i] = (sin(p1) * exp(-t / 0.9) + 0.5 * sin(p2) * exp(-t / 0.32) + 0.22 * sin(p3) * exp(-t / 0.14)) * att + 0.35 * body[i] * exp(-t / 0.08) * att;
  }
  softClip(normPeak(out), 2.0); lp4(out, 900);
  fades(out, 0.001, 0.8);
  return normPeak(out);
}
// sub boom on D1 with an octave layer, soft punch and a short soft transient
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
// the 969 slam: big WARM boom (D1 + A1 fifth + D2), a felt low-mid thud, long soft tail
export function warmBoom({ seed = 'warmBoom', root = 36.71 } = {}) {
  const r = makeRng(seed), n = smp(4.2), out = f32(n);
  const body = brown(n, r); lp4(body, 230); normRms(body, 1);
  const thud = white(n, r); filt(thud, 'bp', 170, 0.9); normRms(thud, 1);
  let p1 = 0, p2 = 0, p3 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, att = 1 - exp(-t / 0.004);
    p1 += TAU * root * (1 + 1.2 * exp(-t / 0.08)) / SR;
    p2 += TAU * root * 1.5 * (1 + 0.6 * exp(-t / 0.06)) / SR;
    p3 += TAU * root * 2 * (1 + 0.5 * exp(-t / 0.05)) / SR;
    out[i] = (sin(p1) * exp(-t / 1.35) + 0.3 * sin(p2) * exp(-t / 0.7) + 0.45 * sin(p3) * exp(-t / 0.45)) * att
      + (0.42 * body[i] * exp(-t / 0.12) + 0.22 * thud[i] * exp(-t / 0.05)) * att;
  }
  softClip(normPeak(out), 1.8); lp4(out, 1400);
  fades(out, 0.001, 1.2);
  return normPeak(out);
}
// short shake after the slam: low rumble burst with a gritty rattle
export function shake({ dur = 1.5, seed = 'shake' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = {};
  for (const ch of ['L', 'R']) {
    const x = brown(n, r); lp4(x, 130); filt(x, 'hp', 28, 0.7); normRms(x, 1);
    const g = white(n, r); bp2(g, 350, 1600); normRms(g, 1); const am = smoothRand(n, 26, r);
    for (let i = 0; i < n; i++) { const t = i / SR, e = (1 - exp(-t / 0.02)) * exp(-t / 0.38); x[i] = e * (x[i] + 0.22 * g[i] * Math.max(0, am[i])); }
    softClip(normPeak(x), 1.4); fades(x, 0.002, 0.3); out[ch] = x;
  }
  return normStereoPeak(out);
}
// deep wooden "thock": a mallet on a big hollow log: pitched low thump, hollow wood modes, surface knock
export function thock({ f = 73.42, seed = 'thock' } = {}) {
  const r = makeRng(seed), n = smp(1.2), x = f32(n);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * f * (1 + 0.6 * exp(-t / 0.018)) / SR; x[i] += sin(ph) * exp(-t / 0.16) * (1 - exp(-t / 0.0015)); }
  [[2.71, 0.45, 0.075], [4.62, 0.3, 0.045], [6.93, 0.17, 0.03], [9.8, 0.09, 0.02]].forEach(([k, a, tau]) => addMode(x, 0, f * k * r.uni(0.99, 1.01), a, tau, 0.0008));
  addClick(x, 0, r, 1100, 1.5, 0.004, 0.5); addClick(x, 0, r, 2600, 1.2, 0.0015, 0.2);
  softClip(normPeak(x), 1.4); onePoleLP(x, 6000); fades(x, 0.0005, 0.2);
  return normPeak(x);
}
// rising tone: glides up (ease-out) into `target`, then rings (glassy: fundamental, soft octave, a twelfth)
export function riseTone({ target = 293.66, from = -7, glide = 0.45, dur = 3.2, tau = 1.4, seed = 'riseTone' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = f32(n);
  let p = r.next() * TAU, q = 0, s = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = clamp(t / glide), semis = from * Math.pow(1 - u, 2.2);
    const f = target * Math.pow(2, semis / 12) * (1 + 0.0025 * sin(TAU * 5 * t) * smooth((t - 0.6) / 0.6));
    p += TAU * f / SR; q += TAU * f * 2.0026 / SR; s += TAU * f * 3 / SR;
    const e = (1 - exp(-t / 0.012)) * (t < glide ? 0.7 + 0.3 * smooth(u) : exp(-(t - glide) / tau));
    out[i] = e * (sin(p) + 0.26 * sin(q) + 0.07 * sin(s));
  }
  fades(out, 0.001, 0.4);
  return normPeak(out);
}
// soft riser (noise sweep + glide up to `target`), used under "equals"
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

// ------------------------------------------------------------------ bells, ticks, sparkles
export function tick({ f = 2000, tau = 0.006, click = 0.35, seed = 'tick' } = {}) {
  const r = makeRng(seed), n = smp(0.05), x = f32(n);
  addMode(x, 0, f, 1, tau, 0.0004); addMode(x, 0, f * 2.01, 0.18, tau * 0.5, 0.0004);
  addClick(x, 0, r, f * 1.7, 1.2, 0.0012, click);
  fades(x, 0.0003, 0.006);
  return normPeak(x);
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
// soft rising glint: swelled tone with a little upward glide
export function glint({ f = 587.33, dur = 1.1, swell = 0.13, seed = 'glint' } = {}) {
  const r = makeRng(seed), n = smp(dur), x = f32(n); let ph = r.next() * TAU;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * f * Math.pow(2, -0.6 / 12 * exp(-t / 0.06)) / SR;
    const e = t < swell ? Math.pow(t / swell, 2) : exp(-(t - swell) / (0.3 * dur / 1.1));
    x[i] = (sin(ph) + 0.28 * sin(2 * ph) + 0.08 * sin(3 * ph)) * e;
  }
  fades(x, 0.002, 0.1);
  return normPeak(x);
}
// small gold glow: a swelling glint (root + fifth) with a tiny two-bell sparkle on top
export function goldGlow({ f = 1174.66, seed = 'goldGlow' } = {}) {
  const n = smp(2.2), out = { L: f32(n), R: f32(n) };
  addSt(out, glint({ f, dur: 1.8, swell: 0.16, seed: seed + 'a' }), 0, 0.8, -0.15);
  addSt(out, glint({ f: f * 1.5, dur: 1.5, swell: 0.2, seed: seed + 'b' }), smp(0.03), 0.45, 0.2);
  addSt(out, shimmer({ notes: [f * 2, f * 3], spacing: 0.05, dur: 1.2, bright: 0.25, air: 0.12, pan: [-0.3, 0.3], seed: seed + 's' }), smp(0.06), 0.35);
  return normStereoPeak(out);
}
// airy shimmer as Enoch is taken: breath of air rising into the light + a slow bright bell bloom
export function airyRise({ dur = 2.8, notes = ['F5', 'C6', 'F6', 'A6', 'C7', 'E7'], seed = 'airyRise' } = {}) {
  const r = makeRng(seed), n = smp(dur + 0.6), out = { L: f32(n), R: f32(n) };
  for (const ch of ['L', 'R']) {
    const a = white(n, r); svf(a, (i) => 900 * Math.pow(8, smooth(i / smp(dur))), 1.4, 'bp', 16); normRms(a, 1);
    const b = white(n, r); bp2(b, 6500, 14000); normRms(b, 1);
    for (let i = 0; i < n; i++) { const u = i / smp(dur), e = Math.pow(smooth(u / 0.3), 1.4) * (u > 0.4 ? cosRamp((1 - u) / 0.6) : 1); out[ch][i] = e * (0.4 * a[i] + 0.12 * b[i]); }
  }
  addSt(out, shimmer({ notes, spacing: 0.12, dur: dur * 0.9, bright: 0.22, air: 0.12, pan: [-0.6, 0.6], seed: seed + 'b' }), smp(0.12), 0.9);
  return normStereoPeak(out);
}
// gold dust burst: a cloud of tiny high bell grains thinning out over ~1.5 s, plus a soft sizzle
export function goldDust({ dur = 1.6, seed = 'goldDust' } = {}) {
  const r = makeRng(seed), n = smp(dur + 0.6), out = { L: f32(n), R: f32(n) };
  const P = [86, 89, 93, 98, 101, 105, 81, 84];                         // D minor colours, very high
  let t = 0;
  while (t < dur) {
    const f = mtof(P[r.int(P.length)]) * (1 + r.uni(-0.004, 0.004)), [gl, gr] = panLR(r.uni(-0.85, 0.85)), a = r.uni(0.25, 1) * exp(-t / 0.7), tau = r.uni(0.04, 0.22), off = smp(t);
    addMode(out.L, off, f, a * gl, tau, 0.0006); addMode(out.R, off, f, a * gr, tau, 0.0006);
    t += -Math.log(1 - r.next() * 0.97) / (70 * exp(-t / 0.35) + 8);
  }
  for (const ch of ['L', 'R']) { const x = white(n, r); bp2(x, 5000, 12000); normRms(x, 1); for (let i = 0; i < n; i++) { const tt = i / SR; out[ch][i] += 0.18 * x[i] * smooth(tt / 0.02) * exp(-tt / 0.4); } }
  return normStereoPeak(out);
}

// ------------------------------------------------------------------ night ambience
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
// leaves rustling in the breeze (green seasons): gust-driven granular rustle + soft high air
export function rustle({ dur = 4, rate = 0.35, density = 160, seed = 'rustle' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) }, g = smoothRand(n, rate, r);
  for (const ch of ['L', 'R']) { const x = white(n, r); bp2(x, 2500, 8000); normRms(x, 1); for (let i = 0; i < n; i++) out[ch][i] = 0.12 * x[i] * (0.35 + 0.65 * Math.pow(0.5 + 0.5 * g[i], 2)); }
  let t = 0.01;
  while (t < dur - 0.02) {
    const gi = 0.5 + 0.5 * g[Math.min(n - 1, smp(t))], c = f32(smp(0.012));
    addClick(c, 0, r, r.uni(2500, 7500), 1.1, r.uni(0.0005, 0.0018), r.uni(0.15, 0.6) * gi);
    addSt(out, c, smp(t), 1, r.uni(-0.8, 0.8));
    t += -Math.log(1 - r.next() * 0.96) / (density * (0.15 + gi * gi));
  }
  return normStereoRms(out, 0.1);
}
// small oil-lamp flame: soft breathy flutter, faint hiss, sparse tiny ticks. gutter(tSec) in [0,1] makes
// it sputter (deeper, faster flicker, dips and little sputter bursts) as the oil runs out
export function lampFlame({ dur = 6, gutter = 0, rate = 3.5, seed = 'lamp' } = {}) {
  const gu = typeof gutter === 'function' ? gutter : () => gutter;
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) };
  const fl = smoothRand(n, 9, r), fl2 = smoothRand(n, 1.7, r), dip = smoothRand(n, 3.3, r), env = f32(n);
  let g = gu(0);
  for (let i = 0; i < n; i++) {
    if ((i & 255) === 0) g = gu(i / SR);
    env[i] = clamp(0.8 + 0.12 * fl2[i] + (0.12 + 0.55 * g) * fl[i] * 0.5 - 0.75 * g * Math.pow(Math.max(0, dip[i]), 2), 0.04, 1.4);
  }
  for (const ch of ['L', 'R']) {
    const breath = pink(n, r); bp2(breath, 110, 800); normRms(breath, 1);
    const hiss = white(n, r); bp2(hiss, 2500, 7500); normRms(hiss, 1);
    for (let i = 0; i < n; i++) out[ch][i] = env[i] * (0.2 * breath[i] + 0.03 * hiss[i]);
  }
  let t = r.uni(0, 0.2);
  while (t < dur - 0.05) {
    const g = gu(t), a = Math.exp(r.gauss() * 0.5) * 0.22, c = f32(smp(0.03)), pan = r.uni(-0.35, 0.35);
    addClick(c, 0, r, r.uni(1800, 5200), 1.3, r.uni(0.0004, 0.0014), a);
    if (g > 0.15 && r.next() < 0.7 * g) { let tt = 0.004; for (let k = 0, m = 2 + r.int(4); k < m; k++) { addClick(c, smp(tt), r, r.uni(700, 2400), 1.1, r.uni(0.0008, 0.0026), a * r.uni(0.6, 1.3)); tt += r.uni(0.003, 0.008); } }
    addSt(out, c, smp(t), 1, pan);
    t += -Math.log(1 - r.next() * 0.96) / (rate * (1 + 2.5 * g));
  }
  return normStereoRms(out, 0.1);
}
// tiny puff as the flame dies: a soft breath burst, a little low "fwp", and a faint curl of smoke hiss
export function puff({ seed = 'puff' } = {}) {
  const r = makeRng(seed), n = smp(1.0), x = f32(n);
  const b = white(n, r); bp2(b, 350, 2200); normRms(b, 1);
  const lo = brown(n, r); lp4(lo, 170); normRms(lo, 1);
  const s = white(n, r); bp2(s, 3000, 9000); normRms(s, 1);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = 0.8 * b[i] * smooth(t / 0.008) * exp(-t / 0.05) + 0.55 * lo[i] * smooth(t / 0.005) * exp(-t / 0.045) + 0.05 * s[i] * smooth((t - 0.04) / 0.12) * exp(-t / 0.32);
  }
  fades(x, 0.0005, 0.35);
  return normPeak(x);
}

// ------------------------------------------------------------------ foley
// soft footstep on a packed sand path: heel thud + granular crunch, then a lighter toe roll
export function stepSand({ weight = 1, seed = 'sand' } = {}) {
  const r = makeRng(seed), n = smp(0.32), x = f32(n);
  addMode(x, 0, 85 + r.uni(-8, 8), 0.5 * weight, 0.02, 0.003);
  const grains = (t0, len, cnt, amp) => { for (let k = 0; k < cnt; k++) { const tt = t0 + len * Math.pow(r.next(), 1.6); addClick(x, smp(tt), r, r.uni(1400, 4800), 1.4, r.uni(0.0005, 0.0016), amp * r.uni(0.3, 1) * exp(-(tt - t0) / (len * 0.6))); } };
  grains(0.002, 0.09, 26, 0.35 * weight);
  const t2 = 0.11 + r.uni(-0.015, 0.015);
  addMode(x, smp(t2), 110, 0.2 * weight, 0.012, 0.002);
  grains(t2, 0.07, 16, 0.22 * weight);
  const h = white(n, r); bp2(h, 900, 5000); normPeak(h, 0.08);
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] += h[i] * (smooth(t / 0.01) * exp(-t / 0.05) + 0.5 * (t > t2 ? exp(-(t - t2) / 0.035) : 0)); }
  onePoleLP(x, 7000); fades(x, 0.0005, 0.04);
  return normPeak(x);
}
// soft paper slide (parchment timeline sliding in): rough friction noise with a gentle settle
export function paperSlide({ dur = 0.9, seed = 'paper' } = {}) {
  const r = makeRng(seed), n = smp(dur + 0.15), nd = smp(dur), out = { L: f32(n), R: f32(n) };
  const rough = smoothRand(n, 85, r), slow = smoothRand(n, 7, r);
  for (const ch of ['L', 'R']) {
    const x = white(n, r); svf(x, (i) => 2400 * Math.pow(1.5, slow[i]) * (1 + 0.4 * (i / nd)), 0.8, 'bp', 32); normRms(x, 1);
    const lo = white(n, r); bp2(lo, 300, 1100); normRms(lo, 1);
    for (let i = 0; i < n; i++) {
      const u = i / nd, e = i < nd ? smooth(u / 0.22) * (u > 0.55 ? cosRamp((1 - u) / 0.45) : 1) : 0;
      out[ch][i] = e * (0.55 + 0.45 * Math.abs(rough[i])) * (0.6 * x[i] + 0.45 * lo[i]);
    }
  }
  const tap = f32(smp(0.1)); addClick(tap, 0, r, 900, 0.9, 0.006, 0.35); addMode(tap, 0, 240, 0.2, 0.015);
  addSt(out, tap, nd - smp(0.06), 1, 0.1);
  for (const ch of ['L', 'R']) fades(out[ch], 0.01, 0.06);
  return normStereoPeak(out);
}
// hammer on a timber peg: contact click, timber modes, plank body, a faint hammer-head ring
export function hammerTap({ f = 720, weight = 1, seed = 'hammer' } = {}) {
  const r = makeRng(seed), n = smp(0.35), x = f32(n);
  addClick(x, 0, r, 2400, 1.0, 0.0012, 0.6 * weight);
  addMode(x, 0, f * r.uni(0.97, 1.03), 0.7 * weight, 0.025, 0.0004);
  addMode(x, 0, f * 2.37, 0.3 * weight, 0.014, 0.0004);
  addMode(x, 0, f * 0.31, 0.45 * weight, 0.04, 0.001);
  addMode(x, 0, 3400 * r.uni(0.98, 1.02), 0.1, 0.03, 0.0003);
  fades(x, 0.0003, 0.05);
  return normPeak(x);
}
// unintelligible babble: formant-filtered band-limited saw "syllables", stereo, low-passed
const VOW = [[730, 1090, 2440], [270, 2290, 3010], [530, 1840, 2480], [570, 840, 2410], [440, 1020, 2240], [300, 870, 2240], [640, 1190, 2390]];
export function murmur({ dur = 4, talkers = 7, pitchLo = 105, pitchHi = 230, lp = 1700, sylLo = 0.09, sylHi = 0.2, shout = 0, seed = 'murmur' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) };
  for (let k = 0; k < talkers; k++) {
    const p = r.uni(-0.8, 0.8), gl = Math.cos((p + 1) * Math.PI / 4), gr = Math.sin((p + 1) * Math.PI / 4);
    const base = r.uni(pitchLo, pitchHi), lvl = r.uni(0.5, 1); let t = r.uni(0, 0.5), phrase = 0;
    while (t < dur - 0.05) {
      const d = r.uni(sylLo, sylHi) * (1 + shout * 0.8), m = smp(d), V = r.pick(VOW);
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
// a distant mocking laugh ("ha-ha-ha", no words): aspirated syllables on a falling voiced 'a'
export function laugh({ pitch = 170, count = 5, seed = 'laugh' } = {}) {
  const r = makeRng(seed), per = r.uni(0.16, 0.2), n = smp(count * per + 0.35), out = f32(n);
  for (let k = 0; k < count; k++) {
    const t0 = k * per * r.uni(0.95, 1.05), m = smp(per * 0.75), f0 = pitch * (1.18 - 0.28 * k / count), freq = f32(m);
    for (let i = 0; i < m; i++) freq[i] = f0 * (1 + 0.05 * (1 - i / m));
    const src = blepSaw(freq, r), syl = f32(m), asp = white(m, r); bp2(asp, 1200, 3500); normRms(asp, 0.4);
    [[760, 6, 1], [1250, 8, 0.5], [2600, 10, 0.2]].forEach(([fc, q, g]) => { const b = copy(src); filt(b, 'bp', fc, q); for (let i = 0; i < m; i++) syl[i] += g * b[i]; });
    const i0 = smp(t0), a = (1 - 0.45 * k / count) * r.uni(0.8, 1);
    for (let i = 0; i < m && i0 + i < n; i++) { const u = i / m, eh = exp(-u / 0.12), ev = Math.pow(sin(Math.PI * clamp((u - 0.12) / 0.88)), 1.4); out[i0 + i] += a * (asp[i] * eh + syl[i] * ev); }
  }
  lp4(out, 2400); filt(out, 'hp', 200, 0.7); fades(out, 0.005, 0.08);
  return normPeak(out);
}
// wooden creak (the ark lifting): stick-slip impulse train through hollow timber resonances
export function creak({ dur = 1.4, f0 = 34, f1 = 22, seed = 'creak' } = {}) {
  const r = makeRng(seed), n = smp(dur), src = f32(n), wob = smoothRand(n, 5, r); let ph = 0;
  for (let i = 0; i < n; i++) { const u = i / n, f = (f0 + (f1 - f0) * u) * (1 + 0.28 * wob[i]); ph += f / SR; if (ph >= 1) { ph -= 1; src[i] = r.uni(0.5, 1); } }
  const out = f32(n);
  for (const [fc, q, g] of [[290, 6, 1], [690, 8, 0.6], [1450, 7, 0.32], [2600, 5, 0.12]]) { const b = copy(src); filt(b, 'bp', fc * r.uni(0.95, 1.05), q); for (let i = 0; i < n; i++) out[i] += g * b[i]; }
  for (let i = 0; i < n; i++) { const u = i / n; out[i] *= Math.pow(sin(Math.PI * u), 0.7) * (0.75 + 0.25 * wob[i]); }
  fades(out, 0.02, 0.08);
  return normPeak(out);
}
// low water swell (the flood rising under the ark): sloshing brown/pink noise that rises and falls
export function waterSwell({ dur = 2.4, seed = 'swellW' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = {};
  for (const ch of ['L', 'R']) {
    const x = brown(n, r); lp4(x, 380); normRms(x, 1); const y = pink(n, r); svf(y, (i) => 300 * Math.pow(2.2, sin(Math.PI * i / n)), 1.2, 'bp', 32); normRms(y, 1);
    const sl = smoothRand(n, 1.6, r);
    for (let i = 0; i < n; i++) { const u = i / n, e = Math.pow(sin(Math.PI * Math.min(1, u * 1.25)), 1.5) * (u > 0.8 ? cosRamp((1 - u) / 0.2) : 1); x[i] = e * (0.7 * x[i] + 0.4 * y[i]) * (0.75 + 0.25 * sl[i]); }
    out[ch] = x;
  }
  return normStereoPeak(out);
}

// ------------------------------------------------------------------ water, rain, thunder
// one slow-motion falling drop: a soft stretched whoosh with a faint falling whistle, ending on the splash
export function dropFall({ dur = 0.75, seed = 'dropFall' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = f32(n);
  const a = pink(n, r); svf(a, (i) => 1600 * Math.pow(0.42, i / n), 3.0, 'bp', 16); normRms(a, 1);
  const b = brown(n, r); lp4(b, 260); normRms(b, 1);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n, t = i / SR; ph += TAU * 2200 * Math.pow(0.6, u) / SR;
    out[i] = Math.pow(smooth(u / 0.95), 1.8) * (0.8 * a[i] + 0.35 * b[i] + 0.1 * sin(ph) * (0.7 + 0.3 * sin(TAU * 6 * t)));
  }
  fades(out, 0.03, 0.006);
  return normPeak(out);
}
// the huge amplified raindrop "plip" (slow motion): contact click + amplified low thump on dry ground,
// a big bubble chirp gliding up, a second smaller bubble, and a crown of tiny droplets
export function bigDrop({ seed = 'bigDrop' } = {}) {
  const r = makeRng(seed), n = smp(2.4), x = f32(n);
  addClick(x, 0, r, 1700, 1.0, 0.0012, 0.3);
  let ph = 0;
  for (let i = 0; i < smp(0.45); i++) { const t = i / SR; ph += TAU * 66 * (1 + 0.9 * exp(-t / 0.02)) / SR; x[i] += 0.65 * sin(ph) * exp(-t / 0.1) * (1 - exp(-t / 0.002)); }
  addChirp(x, smp(0.004), 360, 1150, 0.05, 0.09, 1.0);
  addChirp(x, smp(0.115), 620, 1650, 0.035, 0.05, 0.32);
  const sp = white(smp(0.12), r); bp2(sp, 700, 4000); normPeak(sp, 0.18); for (let i = 0; i < sp.length; i++) x[smp(0.002) + i] += sp[i] * exp(-(i / SR) / 0.025);
  for (let k = 0; k < 9; k++) { const t = r.uni(0.07, 0.48), f0 = r.uni(1400, 3000); addChirp(x, smp(t), f0, f0 * r.uni(1.5, 2.1), 0.008, r.uni(0.012, 0.025), r.uni(0.05, 0.16) * exp(-t / 0.3)); }
  fades(x, 0.0003, 0.6);
  return normPeak(x);
}
// rain bed. intensity(tSec) in [0,1] scales the drop rate and the hiss; surface: 'earth' (soft ticks and
// pats), 'street' (hard splats, tiny plinks); gust = depth of the slow "sheets" of rain
export function rain({ dur = 6, intensity = 1, surface = 'earth', rate = 80, hiss = 1, gust = 0.15, gustRate = 0.4, seed = 'rain' } = {}) {
  const I = typeof intensity === 'function' ? intensity : () => intensity;
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) }, env = f32(n);
  for (let i = 0; i < n; i += 128) { const v = I(i / SR); for (let j = i; j < Math.min(n, i + 128); j++) env[j] = v; }
  onePoleLP(env, 4);
  const st = surface === 'street';
  for (const ch of ['L', 'R']) {
    const x = pink(n, r); bp2(x, st ? 1100 : 600, st ? 10000 : 7500); normRms(x, 1); const g = smoothRand(n, gustRate, r);
    for (let i = 0; i < n; i++) out[ch][i] = 0.3 * hiss * x[i] * Math.pow(env[i], 1.25) * (1 - gust + gust * (0.5 + 0.5 * g[i]) * 2) / (1 + gust);
  }
  const ev = f32(smp(0.06));
  let t = r.uni(0, 0.03);
  while (t < dur - 0.03) {
    const v = env[Math.min(n - 1, smp(t))];
    if (v > 0.002) {
      ev.fill(0); const a = Math.exp(r.gauss() * 0.55) * 0.3;
      if (st) {
        addClick(ev, 0, r, r.uni(2500, 8000), 1.2, r.uni(0.0004, 0.0012), a);
        if (r.next() < 0.22) { const f0 = r.uni(1600, 4200); addChirp(ev, 0, f0, f0 * r.uni(1.4, 1.9), 0.006, r.uni(0.008, 0.016), a * 0.5); }
      } else {
        addClick(ev, 0, r, r.uni(1800, 6000), 1.1, r.uni(0.0005, 0.0018), a);
        if (r.next() < 0.18) addMode(ev, 0, r.uni(280, 650), a * 0.5, r.uni(0.004, 0.009), 0.0004);
      }
      addSt(out, ev, smp(t), 1, r.uni(-0.9, 0.9));
    }
    t += -Math.log(1 - r.next() * 0.985) / (rate * Math.max(0.03, v));
  }
  return out;
}
// water trickling in a gutter: a stream of tiny bubble chirps over a soft wet band
export function trickle({ dur = 6, rate = 90, seed = 'trickle' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) }, ev = f32(smp(0.04));
  for (const ch of ['L', 'R']) { const x = pink(n, r); bp2(x, 700, 2600); normRms(x, 0.05); out[ch].set(x); }
  let t = 0.01;
  while (t < dur - 0.03) { ev.fill(0); const f0 = r.uni(1200, 3600); addChirp(ev, 0, f0, f0 * r.uni(1.3, 1.8), 0.005, r.uni(0.006, 0.014), r.uni(0.1, 0.4)); addSt(out, ev, smp(t), 1, r.uni(-0.25, 0.25) + 0.3); t += -Math.log(1 - r.next() * 0.97) / rate; }
  return normStereoRms(out, 0.1);
}
// thunder: brown-noise rolls (slow attack, long decay), low-passed; far = no crack, darker
export function thunder({ dur = 5, far = 1, rolls = [0, 0.75, 1.7], seed = 'thunder' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = {};
  for (const ch of ['L', 'R']) {
    const x = brown(n, r); lp4(x, far ? 170 : 360); filt(x, 'hp', 24, 0.7); normRms(x, 1);
    const crk = white(n, r); bp2(crk, 180, far ? 700 : 1600); normRms(crk, 1);
    const g = smoothRand(n, 6, r), sl = smoothRand(n, 0.8, r);
    for (let i = 0; i < n; i++) {
      const t = i / SR; let e = 0;
      rolls.forEach((t0, k) => { if (t > t0) { const tt = t - t0; e += (k ? 0.72 : 1) * smooth(tt / (0.28 + 0.1 * k)) * exp(-tt / (1.3 + 0.35 * k)); } });
      x[i] = e * (0.72 + 0.28 * g[i]) * (0.85 + 0.15 * sl[i]) * (x[i] + (far ? 0.07 : 0.2) * crk[i] * (0.5 + 0.5 * g[i]));
    }
    softClip(normPeak(x), 1.3); fades(x, 0.02, 0.5); out[ch] = x;
  }
  return normStereoPeak(out);
}
// the sky cracks with light: a bright tearing crack running across the sky (L -> R) into a deep rumble
export function skyCrack({ dur = 5.5, seed = 'skyCrack' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) };
  const snap = white(smp(0.05), r); filt(snap, 'hp', 700, 0.7); for (let i = 0; i < snap.length; i++) snap[i] *= (1 - exp(-(i / SR) / 0.0008)) * exp(-(i / SR) / 0.009);
  addSt(out, normPeak(snap, 0.9), 0, 1, -0.4);
  let t = 0.003; const c = f32(smp(0.03));
  while (t < 0.5) { c.fill(0); addClick(c, 0, r, r.uni(1200, 7000) * exp(-t / 0.6), 1.1, r.uni(0.0005, 0.002), r.uni(0.35, 1) * exp(-t / 0.13)); addSt(out, c, smp(t), 1, -0.6 + 2.4 * t + r.uni(-0.2, 0.2)); t += r.uni(0.0015, 0.007) * (1 + 9 * t); }
  addSt(out, thunder({ dur: dur - 0.04, far: 0, rolls: [0, 0.9, 2.2], seed: seed + 'rumble' }), smp(0.04), 0.85);
  return normStereoPeak(out);
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

// ------------------------------------------------------------------ call to action
// two dice: a short shake in the hand (muffled clicks), then thrown onto a wooden table, bouncing to rest
export function diceRattle({ seed = 'dice' } = {}) {
  const r = makeRng(seed), n = smp(1.35), out = { L: f32(n), R: f32(n) }, ev = f32(smp(0.08));
  const hit = (t, a, pan, table, muffle) => {
    ev.fill(0); const f = r.uni(2600, 4800) * (muffle ? 0.6 : 1);
    addMode(ev, 0, f, a, muffle ? 0.002 : 0.005, 0.0002); addMode(ev, 0, f * 1.63, a * 0.5, 0.003, 0.0002);
    addClick(ev, 0, r, muffle ? 2500 : 6000, 1.2, 0.0006, a * 0.6);
    if (table) addMode(ev, 0, r.uni(240, 420), a * 0.7, 0.018, 0.0006);
    addSt(out, ev, smp(t), 1, pan);
  };
  for (const s0 of [0, 0.11, 0.22]) for (let k = 0; k < 4; k++) hit(s0 + r.uni(0, 0.03), r.uni(0.15, 0.35), r.uni(-0.2, 0.2), false, true);
  for (const [d, t0, p] of [[0, 0.38, -0.25], [1, 0.405, 0.3]]) {
    let t = t0, gap = r.uni(0.1, 0.13), a = 1;
    while (gap > 0.012 && t < 1.25) { hit(t, a * r.uni(0.8, 1), p + r.uni(-0.05, 0.05), true, false); t += gap; gap *= r.uni(0.55, 0.7); a *= 0.62; }
    for (let k = 0; k < 6; k++) { hit(t, a * r.uni(0.3, 0.6), p, true, false); t += r.uni(0.015, 0.03); }
  }
  for (const ch of ['L', 'R']) fades(out[ch], 0.0005, 0.05);
  return normStereoPeak(out);
}
// golden hourglass: a warm D-major chime with a soft attack, and fine sand trickling through the neck
export function hourglass({ seed = 'hourglass' } = {}) {
  const r = makeRng(seed), n = smp(3.4), out = { L: f32(n), R: f32(n) };
  const ch = shimmer({ notes: ['D6', 'F#6', 'A6', 'D7'], spacing: 0.04, dur: 2.9, bright: 0.28, air: 0.08, pan: [-0.35, 0.35], seed: seed + 'c' });
  for (const k of ['L', 'R']) for (let i = 0; i < ch[k].length; i++) ch[k][i] *= Math.min(1, i / smp(0.012));
  addSt(out, ch, 0, 1);
  const sand = f32(n); let t = 0.05;
  while (t < 2.6) { addClick(sand, smp(t), r, r.uni(3500, 9000), 1.5, 0.0004, r.uni(0.1, 0.35) * smooth(t / 0.3) * exp(-t / 1.6)); t += -Math.log(1 - r.next() * 0.97) / 650; }
  const hs = white(n, r); bp2(hs, 4000, 10000); normRms(hs, 0.03); for (let i = 0; i < n; i++) { const tt = i / SR; sand[i] += hs[i] * smooth(tt / 0.3) * exp(-tt / 1.6); }
  addSt(out, sand, 0, 0.5, 0.1);
  return normStereoPeak(out);
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
// the loop seam: a soft breath of air that rises (brightening) toward the seam and falls into the hook hit
export const loopWhoosh = ({ dur = 0.82, peak = 0.85, seed = 'loop' } = {}) => whoosh({ dur, peak, f0: 280, f1: 1900, f2: 500, q: 0.9, air: 0.4, rise: 2.0, fall: 0.06, seed });

// ================================================================== Q.03 SON OF THE FATHER
// the crowd (roar with chant-like pulses, bursts, whispers), iron (chains, shackles on stone, the key, the
// lock breaking), the heartbeat, torches, steps on stone, distant horn calls, low drums, birds, a city at night
const METAL = [1, 1.47, 2.09, 2.56, 3.31, 4.12, 5.03];
// inharmonic iron partials (a link, a cuff, a lock body) added into x at sample offset
function addMetal(x, off, r, f, amp, tau, k = 5) {
  for (let j = 0; j < k; j++) addMode(x, off, f * METAL[j] * r.uni(0.985, 1.015), amp * Math.pow(0.72, j) * r.uni(0.6, 1), tau * Math.pow(0.8, j) * r.uni(0.8, 1.2), 0.0002);
}

// crowd roar: a mass of shouting voices (formant-filtered band-limited saws on long "ah / a / eh / oh"
// shouts, pitched up with the energy) over a broadband noise roar; no words. energy(tSec) 0..~1.2 drives
// level, pitch and brightness. chant = {rate, sync, depth, phase}: a share of the shouters lock to rhythmic
// pulses (chant-like, wordless). burst: every voice shouts at once (the crowd hit)
const SHOUT = [[760, 1150, 2500], [660, 1080, 2650], [560, 1720, 2500], [500, 880, 2400]];
export function crowdRoar({ dur = 4, energy = () => 1, voices = 26, chant = null, burst = false, bright = 1, seed = 'roar' } = {}) {
  const r = makeRng(seed), n = smp(dur), E = f32(Math.ceil(n / 64) + 1);
  for (let b = 0; b < E.length; b++) E[b] = clamp(energy(b * 64 / SR), 0, 1.5);
  const eAt = (i) => E[Math.max(0, Math.min(E.length - 1, i >> 6))];
  const per = chant ? 1 / chant.rate : 0, ph0 = chant?.phase ?? 0, depth = chant?.depth ?? 0.6;
  const pulseAt = (t) => (chant ? Math.pow(0.5 + 0.5 * Math.cos(TAU * (t - ph0) / per), 3) : 0);
  // noise roar (a breathy wall of voices at a distance)
  const roar = { L: f32(n), R: f32(n) };
  for (const ch of ['L', 'R']) {
    const a = pink(n, r); bp2(a, 220, 3000 * bright); normRms(a, 1);
    const b = pink(n, r); svf(b, (i) => 650 + 550 * eAt(i), 1.3, 'bp', 32); normRms(b, 1);
    const g = smoothRand(n, 1.4, r);
    for (let i = 0; i < n; i++) { const p = chant ? 1 - depth * 0.55 + depth * 0.55 * pulseAt(i / SR) * 1.6 : 1; roar[ch][i] = eAt(i) * p * (0.85 + 0.15 * g[i]) * (0.5 * a[i] + 0.5 * b[i]); }
  }
  // shouters
  const vox = { L: f32(n), R: f32(n) };
  const shoutAt = (t, d, base, gl, gr, lvl) => {
    const i0 = smp(t), m = Math.min(smp(d), n - i0); if (m < 128 || i0 < 0) return;
    const e0 = eAt(i0), V = r.pick(SHOUT), f0 = base * (1 + 0.5 * e0) * r.uni(0.95, 1.06), freq = f32(m), jit = smoothRand(m, 16, r), bend = r.uni(0.04, 0.16);
    for (let i = 0; i < m; i++) { const u = i / m; freq[i] = f0 * (1 + bend * sin(Math.PI * Math.min(1, u * 1.7)) - 0.12 * u * u) * (1 + 0.014 * jit[i]); }
    const src = blepSaw(freq, r), syl = f32(m);
    V.forEach((fc, j) => { const y = copy(src); filt(y, 'bp', fc * (1 + 0.1 * e0) * r.uni(0.96, 1.04), 4 + 2 * j); for (let i = 0; i < m; i++) syl[i] += y[i] * [1, 0.55, 0.28][j]; });
    const asp = white(m, r); bp2(asp, 900, 4200); normRms(asp, 0.1);
    const a = lvl * r.uni(0.6, 1);
    for (let i = 0; i < m; i++) { const u = i / m, ee = smooth(u / 0.07) * (u > 0.55 ? cosRamp((1 - u) / 0.45) : 1) * a * eAt(i0 + i), s = (syl[i] + asp[i]) * ee; vox.L[i0 + i] += s * gl; vox.R[i0 + i] += s * gr; }
  };
  for (let k = 0; k < voices; k++) {
    const female = r.next() < 0.4, base = female ? r.uni(190, 300) : r.uni(105, 185), [gl, gr] = panLR(r.uni(-0.95, 0.95)), lvl = r.uni(0.35, 1);
    if (burst) { shoutAt(r.uni(0, 0.05), r.uni(0.55, 1.15), base, gl, gr, lvl); continue; }
    if (chant && r.next() < (chant.sync ?? 0.55)) {                   // chanter: one shout per pulse (some skipped)
      for (let t = ph0 + per * Math.floor((0 - ph0) / per); t < dur; t += per) if (t > -0.05 && r.next() > 0.18) shoutAt(Math.max(0, t - 0.07 + r.uni(-0.03, 0.03)), per * r.uni(0.42, 0.62), base, gl, gr, lvl);
      continue;
    }
    for (let t = r.uni(0, 0.9); t < dur - 0.1;) { const d = r.uni(0.35, 1.0); shoutAt(t, d, base, gl, gr, lvl); t += d + (r.next() > 0.3 ? r.uni(0.05, 0.25) : r.uni(0.4, 1.2)); }
  }
  normStereoRms(roar, 1); normStereoRms(vox, 1);
  const out = { L: f32(n), R: f32(n) };
  for (const ch of ['L', 'R']) {
    for (let i = 0; i < n; i++) out[ch][i] = 0.55 * roar[ch][i] + 0.85 * vox[ch][i];
    lp4(out[ch], 5200 * bright); filt(out[ch], 'hp', 110, 0.7);
  }
  return normStereoRms(out, 0.1);
}
// whispers through a hushed crowd: unvoiced formant syllables and sibilants, wide; no words
export function whispers({ dur = 3, voices = 8, seed = 'whisper' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) };
  for (let k = 0; k < voices; k++) {
    const [gl, gr] = panLR(r.uni(-0.9, 0.9)), lvl = r.uni(0.4, 1); let t = r.uni(0, 0.7);
    while (t < dur - 0.12) {
      const sib = r.next() < 0.3, d = sib ? r.uni(0.06, 0.16) : r.uni(0.07, 0.17), m = smp(d), syl = f32(m), src = white(m, r);
      if (sib) { const y = copy(src); filt(y, 'hp', r.uni(3800, 5600), 0.8); filt(y, 'lp', 10000, 0.7); for (let i = 0; i < m; i++) syl[i] = y[i] * 0.55; }
      else r.pick(VOW).forEach((fc, j) => { const y = copy(src); filt(y, 'bp', fc * r.uni(0.95, 1.08), 4 + 2 * j); for (let i = 0; i < m; i++) syl[i] += y[i] * [1, 0.7, 0.4][j]; });
      const i0 = smp(t), a = lvl * r.uni(0.5, 1);
      for (let i = 0; i < m && i0 + i < n; i++) { const e = Math.pow(sin(Math.PI * i / m), sib ? 1 : 1.6) * a; out.L[i0 + i] += syl[i] * e * gl; out.R[i0 + i] += syl[i] * e * gr; }
      t += d + (r.next() > 0.22 ? r.uni(0.01, 0.06) : r.uni(0.3, 0.9));
    }
  }
  for (const ch of ['L', 'R']) filt(out[ch], 'hp', 320, 0.7);
  return normStereoRms(out, 0.1);
}
// heavy iron chain: the big first impact (iron thud + link ring) and the links jingling to rest
export function chainClank({ links = 8, spread = 0.26, weight = 1, seed = 'chain' } = {}) {
  const r = makeRng(seed), n = smp(spread + 1.5), out = { L: f32(n), R: f32(n) }, ev = f32(smp(1.2));
  addMode(ev, 0, r.uni(105, 130), 0.9 * weight, 0.05, 0.001);
  addMetal(ev, 0, r, r.uni(820, 1050), 0.8 * weight, 0.16);
  addClick(ev, 0, r, 3200, 1.0, 0.0015, 0.7);
  addSt(out, ev, 0, 1, 0);
  for (let k = 0, t = r.uni(0.012, 0.03); k < links && t < spread; k++) {
    ev.fill(0); const a = r.uni(0.25, 0.7) * exp(-t / (spread * 0.6));
    addMetal(ev, 0, r, r.uni(1500, 4200), a, r.uni(0.04, 0.12), 4);
    addClick(ev, 0, r, r.uni(2500, 6500), 1.2, 0.0008, a * 0.6);
    addSt(out, ev, smp(t), 1, r.uni(-0.4, 0.4));
    t += r.uni(0.012, 0.05) * (1 + 1.5 * t / spread);
  }
  for (const ch of ['L', 'R']) { onePoleLP(out[ch], 9000); fades(out[ch], 0.0003, 0.25); }
  return normStereoPeak(out);
}
// a chain dragging over stone: gritty friction with links knocking
export function chainDrag({ dur = 1.2, rate = 14, seed = 'chainDrag' } = {}) {
  const r = makeRng(seed), n = smp(dur + 0.5), nd = smp(dur), out = { L: f32(n), R: f32(n) }, ev = f32(smp(0.5));
  const rough = smoothRand(n, 40, r), slow = smoothRand(n, 2.5, r);
  for (const ch of ['L', 'R']) {
    const x = white(n, r); svf(x, (i) => 2200 * Math.pow(1.6, slow[i]), 1.4, 'bp', 32); normRms(x, 1);
    for (let i = 0; i < n; i++) { const u = i / nd, e = i < nd ? smooth(u / 0.15) * (u > 0.8 ? cosRamp((1 - u) / 0.2) : 1) : 0; out[ch][i] = 0.12 * e * x[i] * (0.4 + 0.6 * Math.abs(rough[i])); }
  }
  for (let t = r.uni(0, 0.05); t < dur;) {
    ev.fill(0); addMetal(ev, 0, r, r.uni(1600, 4800), r.uni(0.15, 0.6) * smooth(t / 0.1), r.uni(0.03, 0.09), 4);
    addSt(out, ev, smp(t), 1, r.uni(-0.3, 0.3));
    t += -Math.log(1 - r.next() * 0.95) / rate;
  }
  for (const ch of ['L', 'R']) { onePoleLP(out[ch], 8500); fades(out[ch], 0.01, 0.15); }
  return normStereoPeak(out);
}
// open shackles hitting the stone: stone thud + heavy iron ring, two bounces, the chain settling
export function ironOnStone({ seed = 'ironStone' } = {}) {
  const r = makeRng(seed), n = smp(2.6), out = { L: f32(n), R: f32(n) }, ev = f32(smp(1.8));
  const hit = (t, a, f, pan) => {
    ev.fill(0);
    addMode(ev, 0, r.uni(62, 78), 1.0 * a, 0.07, 0.0015); addMode(ev, 0, r.uni(140, 170), 0.5 * a, 0.035, 0.001);
    addMetal(ev, 0, r, f, 0.85 * a, 0.42, 6);
    addClick(ev, 0, r, 2600, 0.9, 0.003, 0.9 * a); addClick(ev, 0, r, 900, 0.8, 0.008, 0.6 * a);
    addSt(out, ev, smp(t), 1, pan);
  };
  hit(0, 1, r.uni(420, 520), 0); hit(0.085 + r.uni(0, 0.02), 0.45, r.uni(600, 760), 0.15); hit(0.16 + r.uni(0, 0.02), 0.22, r.uni(800, 1000), -0.1);
  addSt(out, chainClank({ links: 10, spread: 0.45, weight: 0.5, seed: seed + 'c' }), smp(0.03), 0.45);
  for (const ch of ['L', 'R']) { onePoleLP(out[ch], 9000); fades(out[ch], 0.0003, 0.4); }
  return normStereoPeak(out);
}
// an iron key in the shackle lock: a short scrape in, three ratchet clicks, the bolt clunks open
export function keyTurn({ seed = 'key' } = {}) {
  const r = makeRng(seed), n = smp(1.1), out = { L: f32(n), R: f32(n) }, ev = f32(smp(0.5));
  { const m = smp(0.12), x = white(m, r); bp2(x, 2500, 7000); for (let i = 0; i < m; i++) x[i] *= 0.25 * sin(Math.PI * i / m); addSt(out, x, 0, 1, 0.1); }
  [0.2, 0.26, 0.32].forEach((t) => { ev.fill(0); addMetal(ev, 0, r, r.uni(2800, 3600), 0.35, 0.02, 3); addClick(ev, 0, r, 5000, 1.2, 0.0006, 0.4); addSt(out, ev, smp(t + r.uni(-0.005, 0.005)), 1, 0.1); });
  ev.fill(0); addMode(ev, 0, 180, 0.8, 0.03, 0.001); addMetal(ev, 0, r, r.uni(1100, 1300), 0.6, 0.08, 5); addClick(ev, 0, r, 2200, 1.0, 0.002, 0.7);
  addSt(out, ev, smp(0.42), 1, 0.1);
  for (const ch of ['L', 'R']) fades(out[ch], 0.0005, 0.12);
  return normStereoPeak(out);
}
// a small padlock clunk (the locked name card): body knock + a short iron ring
export function lockClunk({ seed = 'lockClunk' } = {}) {
  const r = makeRng(seed), n = smp(0.9), x = f32(n);
  addMode(x, 0, 150, 0.8, 0.03, 0.001); addMetal(x, 0, r, r.uni(1250, 1400), 0.55, 0.12, 5); addClick(x, 0, r, 2400, 1.0, 0.002, 0.8);
  addMetal(x, smp(0.035), r, r.uni(2300, 2600), 0.18, 0.05, 3);
  fades(x, 0.0004, 0.2);
  return normPeak(x);
}
// the lock breaks: a sharp crack, the two halves ringing apart (L / R), tiny shards tinkling
export function lockCrack({ seed = 'lockCrack' } = {}) {
  const r = makeRng(seed), n = smp(2.3), out = { L: f32(n), R: f32(n) }, ev = f32(smp(1.7));
  const snap = white(smp(0.06), r); filt(snap, 'hp', 900, 0.7);
  for (let i = 0; i < snap.length; i++) { const t = i / SR; snap[i] *= (1 - exp(-t / 0.0004)) * exp(-t / 0.007); }
  addSt(out, normPeak(snap, 1), 0, 1, 0);
  addMetal(ev, 0, r, r.uni(700, 820), 0.7, 0.5, 6); addSt(out, ev, smp(0.002), 0.8, -0.4);
  ev.fill(0); addMetal(ev, 0, r, r.uni(980, 1150), 0.6, 0.42, 6); addSt(out, ev, smp(0.006), 0.8, 0.4);
  for (let k = 0, t = 0.04; k < 9; k++, t += r.uni(0.02, 0.08)) { ev.fill(0); addMetal(ev, 0, r, r.uni(2500, 6000), r.uni(0.1, 0.35) * exp(-t / 0.35), r.uni(0.03, 0.1), 3); addSt(out, ev, smp(t), 1, r.uni(-0.8, 0.8)); }
  for (const ch of ['L', 'R']) { onePoleLP(out[ch], 11000); fades(out[ch], 0.0002, 0.5); }
  return normStereoPeak(out);
}
// heartbeat "lub-dub": two soft low thumps with a little body (2nd harmonic for small speakers)
export function heartbeat({ gap = 0.21, weight = 1, seed = 'heart' } = {}) {
  const r = makeRng(seed), n = smp(0.9), x = f32(n);
  const thump = (t0, f, a, tau) => { const i0 = smp(t0); let ph = 0; for (let i = i0; i < n; i++) { const t = (i - i0) / SR; ph += TAU * f * (1 + 0.5 * exp(-t / 0.015)) / SR; x[i] += a * sin(ph) * (1 - exp(-t / 0.004)) * exp(-t / tau); } };
  thump(0, 52, 1.0 * weight, 0.07); thump(0, 104, 0.3 * weight, 0.03); thump(gap, 58, 0.7 * weight, 0.06); thump(gap, 116, 0.22 * weight, 0.025);
  const b = brown(n, r); lp4(b, 140); normRms(b, 0.25);
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] += b[i] * (exp(-t / 0.05) + 0.7 * (t > gap ? exp(-(t - gap) / 0.045) : 0)); }
  softClip(normPeak(x), 1.4); lp4(x, 420); fades(x, 0.001, 0.15);
  return normPeak(x);
}
// a burning torch: low roar with flutter, crackles and the odd pop
export function torchFire({ dur = 4, size = 1, seed = 'fire' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) }, fl = smoothRand(n, 7, r), sw = smoothRand(n, 0.8, r);
  for (const ch of ['L', 'R']) {
    const lo = brown(n, r); lp4(lo, 380 * size); filt(lo, 'hp', 45, 0.7); normRms(lo, 1);
    const mid = pink(n, r); bp2(mid, 300, 2200); normRms(mid, 1);
    for (let i = 0; i < n; i++) out[ch][i] = (0.7 + 0.2 * sw[i] + 0.25 * fl[i]) * (0.75 * lo[i] + 0.25 * mid[i] * (0.6 + 0.4 * fl[i]));
  }
  const c = f32(smp(0.03));
  for (let t = r.uni(0, 0.05); t < dur - 0.03; t += -Math.log(1 - r.next() * 0.96) / 28) {
    c.fill(0); const a = Math.exp(r.gauss() * 0.6) * 0.35;
    addClick(c, 0, r, r.uni(1500, 6000), 1.2, r.uni(0.0004, 0.0018), a);
    if (r.next() < 0.08) addMode(c, 0, r.uni(300, 700), a * 0.8, 0.006, 0.0005);
    addSt(out, c, smp(t), 1, r.uni(-0.5, 0.5));
  }
  return normStereoRms(out, 0.1);
}
// a footstep on stone paving (leather sandal): heel knock + grit, then the lighter toe
export function stepStone({ weight = 1, hard = 0.5, seed = 'stone' } = {}) {
  const r = makeRng(seed), n = smp(0.3), x = f32(n);
  addMode(x, 0, 95 + r.uni(-10, 10), 0.6 * weight, 0.018, 0.002);
  addClick(x, 0, r, r.uni(1400, 2400) * (1 + hard * 0.5), 1.1, 0.0016 + 0.002 * (1 - hard), 0.55 * weight * (0.5 + hard));
  for (let k = 0; k < 8; k++) addClick(x, smp(0.003 + 0.04 * r.next()), r, r.uni(2500, 6000), 1.3, r.uni(0.0004, 0.001), 0.12 * weight * r.next());
  const t2 = 0.085 + r.uni(-0.015, 0.015);
  addMode(x, smp(t2), 130, 0.22 * weight, 0.012, 0.002); addClick(x, smp(t2), r, r.uni(1800, 3000), 1.1, 0.0012, 0.25 * weight * (0.5 + hard));
  onePoleLP(x, 8000); fades(x, 0.0004, 0.04);
  return normPeak(x);
}
// a distant horn call over the city (ram's-horn-like, synthesized): a low swelling note that breaks up a fifth
export function hornCall({ f0 = 233, dur = 1.6, jump = 1.5, seed = 'horn' } = {}) {
  const r = makeRng(seed), n = smp(dur + 0.2), nd = smp(dur), freq = f32(n), jit = smoothRand(n, 30, r), vib = smoothRand(n, 4, r), tj = 0.45 * dur;
  for (let i = 0; i < n; i++) { const t = i / SR, base = t < tj ? f0 * Math.pow(2, -2.5 * exp(-t / 0.08) / 12) : f0 * jump * Math.pow(2, -1.5 * exp(-(t - tj) / 0.05) / 12); freq[i] = base * (1 + 0.004 * jit[i] + 0.006 * vib[i]); }
  const src = blepSaw(freq, r), out = f32(n);
  [[620, 3, 1], [1350, 4, 0.6], [2500, 5, 0.25], [3600, 6, 0.1]].forEach(([fc, q, g]) => { const y = copy(src); filt(y, 'bp', fc, q); for (let i = 0; i < n; i++) out[i] += g * y[i]; });
  const br = white(n, r); bp2(br, 1200, 5000); normRms(br, 0.08);
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = i / nd, e = (t < tj ? smooth(t / 0.12) * (0.7 + 0.3 * smooth(t / tj)) : 1) * (u > 0.85 ? cosRamp((1 - u) / 0.15) : 1) * (i < nd ? 1 : 0);
    out[i] = (out[i] + br[i]) * e * (t > tj - 0.03 && t < tj + 0.02 ? 0.55 : 1);
  }
  lp4(out, 3800); fades(out, 0.005, 0.1);
  return normPeak(out);
}
// low drum (taiko-like): a pitched skin thump with stick, muffle 0..1 darkens and shortens it
export function taiko({ f = 58, vel = 1, muffle = 0, dur = 1.4, seed = 'taiko' } = {}) {
  const r = makeRng(seed), n = smp(dur), x = f32(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * f * (1 + 0.9 * exp(-t / 0.025)) / SR; x[i] = sin(ph) * (1 - exp(-t / 0.002)) * exp(-t / (0.32 - 0.12 * muffle)); }
  addMode(x, 0, f * 1.58, 0.35, 0.12, 0.002); addMode(x, 0, f * 2.14, 0.2, 0.08, 0.002);
  const sk = white(n, r); bp2(sk, 90, 1100 - 600 * muffle); normRms(sk, 1);
  for (let i = 0; i < n; i++) x[i] += (0.55 + 0.25 * vel) * sk[i] * exp(-(i / SR) / 0.045);
  addClick(x, 0, r, 2400, 1, 0.0018, 0.25 * vel * (1 - muffle));
  softClip(normPeak(x), 1.3 + 0.5 * vel); lp4(x, 2600 - 1700 * muffle); fades(x, 0.0005, 0.25);
  return normPeak(x);
}
// a light hand-drum tap (ghost notes between the low drums)
export function frameTap({ f = 190, bright = 0.5, seed = 'tap' } = {}) {
  const r = makeRng(seed), n = smp(0.25), x = f32(n);
  addMode(x, 0, f * r.uni(0.97, 1.03), 0.8, 0.05, 0.001); addMode(x, 0, f * 1.6, 0.25, 0.03, 0.001);
  const sk = white(n, r); bp2(sk, 400, 2500 + 2500 * bright); normRms(sk, 1);
  for (let i = 0; i < n; i++) x[i] += 0.5 * sk[i] * exp(-(i / SR) / 0.018);
  fades(x, 0.0004, 0.06);
  return normPeak(x);
}
// small birds over a sunny yard (the memories): short chirp phrases
export function birds({ dur = 3, count = 3, rate = 1.6, seed = 'birds' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = { L: f32(n), R: f32(n) }, ev = f32(smp(0.1));
  for (let k = 0; k < count; k++) {
    const pan = r.uni(-0.8, 0.8), f = r.uni(2800, 4800);
    for (let t = r.uni(0, 1 / rate); t < dur - 0.4; t += -Math.log(1 - r.next() * 0.95) / rate + 0.25) {
      for (let j = 0, tt = t, cnt = 2 + r.int(4); j < cnt; j++, tt += r.uni(0.06, 0.1)) {
        ev.fill(0); const m = smp(r.uni(0.03, 0.07)), f0 = f * r.uni(0.85, 1.2), f1 = f0 * r.uni(0.7, 1.4); let ph = 0;
        for (let i = 0; i < m; i++) { const u = i / m; ph += TAU * (f0 + (f1 - f0) * u) / SR; ev[i] = sin(ph) * Math.pow(sin(Math.PI * u), 2); }
        addSt(out, ev, smp(tt), r.uni(0.5, 1), pan);
      }
    }
  }
  return normStereoPeak(out, 0.8);
}
// a city at night (the modern match cut): low traffic hum, a far highway band, a car or two passing
export function cityNight({ dur = 6, passes = 2, seed = 'cityNight' } = {}) {
  const r = makeRng(seed), n = smp(dur), out = {};
  for (const ch of ['L', 'R']) {
    const lo = brown(n, r); lp4(lo, 260); filt(lo, 'hp', 35, 0.7); normRms(lo, 1);
    const mid = pink(n, r); bp2(mid, 350, 1300); normRms(mid, 1);
    const sw = smoothRand(n, 0.12, r), x = f32(n);
    for (let i = 0; i < n; i++) x[i] = (0.75 + 0.25 * sw[i]) * (0.7 * lo[i] + 0.3 * mid[i]);
    out[ch] = x;
  }
  for (let k = 0; k < passes; k++) {
    const t0 = r.uni(0, Math.max(0.1, dur - 3)), m = smp(r.uni(2.4, 3.6)), p0 = r.uni(0.3, 0.9) * (k % 2 ? 1 : -1), x = pink(m, r), i0 = smp(t0);
    svf(x, (i) => 300 + 1300 * Math.pow(sin(Math.PI * i / m), 2), 0.7, 'lp', 32); normRms(x, 1);
    for (let i = 0; i < m && i0 + i < n; i++) { const e = 0.7 * Math.pow(sin(Math.PI * i / m), 2), [gl, gr] = panLR(p0 * (1 - 2 * i / m)); out.L[i0 + i] += x[i] * e * gl; out.R[i0 + i] += x[i] * e * gr; }
  }
  return normStereoRms(out, 0.1);
}
