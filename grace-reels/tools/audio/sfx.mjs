// Grace in Motion: sound effects and ambiences, synthesized from scratch.
// Effects return { L, R, send } normalised to a -6 dBFS peak (cue gains are relative to that);
// ambiences return { L, R } beds calibrated to about -12 dBFS RMS.

import {
  SR, TAU, Biquad, SVF, Pink, Brown, Drift, rise, rand, pick, expRand, clamp, note, filter, normalizePeak, rmsOf,
} from "./dsp.mjs";

const NOMINAL_PEAK = 0.5;
const BED_RMS = 0.25;

const panGains = (pan) => {
  const th = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(th) * Math.SQRT2, Math.sin(th) * Math.SQRT2];
};
const stereo = (n) => [new Float32Array(n), new Float32Array(n)];
const done = (L, R, send) => {
  normalizePeak([L, R], NOMINAL_PEAK);
  return { L, R, send };
};

// a decaying sine partial written with a rotating phasor (fast, click-free)
function partial(L, R, start, { f, amp, tau, attack = 0.002, pan = 0, len }) {
  const n = Math.min(len ?? Math.round(tau * 6 * SR), L.length - start);
  const w = (TAU * f) / SR;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const d = Math.exp(-1 / (tau * SR));
  const [gl, gr] = panGains(pan);
  const att = Math.max(1, attack * SR);
  let c = 1;
  let s = 0;
  let a = amp;
  for (let k = 0; k < n; k++) {
    const v = s * a * (k < att ? rise(k / att) : 1);
    L[start + k] += v * gl;
    R[start + k] += v * gr;
    const nc = c * cw - s * sw;
    s = c * sw + s * cw;
    c = nc;
    a *= d;
  }
}

// ================================================================ effects

export function whoosh({ dur = 0.6 }, r) {
  const n = Math.round((dur + 0.4) * SR);
  const [L, R] = stereo(n);
  const pk = dur * 0.62;
  const nl = new Pink(r);
  const nr = new Pink(r);
  const fl = new SVF();
  const fr = new SVF();
  const ll = new SVF();
  const lr = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = t < pk ? Math.pow(rise(t / pk), 1.6) : Math.exp(-(t - pk) / (0.14 + dur * 0.12));
    if (i % 16 === 0) {
      const fc = 320 + 2200 * Math.pow(Math.sin(Math.PI * clamp(t / (dur * 1.15), 0, 1)), 1.5);
      fl.set(fc, 0.9);
      fr.set(fc * 1.07, 0.9);
      ll.set(fc * 0.33, 0.7);
      lr.set(fc * 0.36, 0.7);
    }
    const a = nl.tick();
    const b = nr.tick();
    fl.tick(a);
    fr.tick(b);
    ll.tick(a);
    lr.tick(b);
    const [gl, gr] = panGains(-0.65 + 1.3 * clamp(t / (dur * 1.1), 0, 1));
    L[i] = (fl.bp + ll.lp * 0.4) * env * gl;
    R[i] = (fr.bp + lr.lp * 0.4) * env * gr;
  }
  return done(L, R, 0.15);
}

export function pop({ pitch = 1 }, r) {
  const n = Math.round(0.22 * SR);
  const x = new Float32Array(n);
  const f0 = 540 * pitch;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * f0 * (1 + 0.85 * Math.exp(-t / 0.011))) / SR;
    const env = rise(t / 0.0012) * Math.exp(-t / 0.038);
    x[i] = Math.sin(ph) * env + (t < 0.002 ? (r() * 2 - 1) * 0.12 * (1 - t / 0.002) : 0);
  }
  filter(x, "lowpass", 5200, 0.7);
  return done(x, Float32Array.from(x), 0.12);
}

export function paper(_, r) {
  const n = Math.round(0.62 * SR);
  const [L, R] = stereo(n);
  // the slide: soft band-passed swish
  const nz = new Pink(r);
  const bp = new SVF();
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (i % 16 === 0) bp.set(1700 + 1700 * rise(t / 0.3), 0.8);
    bp.tick(nz.tick());
    const env = rise(t / 0.06) * Math.exp(-Math.max(0, t - 0.12) / 0.09);
    L[i] += bp.bp * env * 0.9;
    R[i] += bp.bp * env * 0.9;
  }
  // crinkles: tiny resonant grains
  const grains = 14 + Math.floor(r() * 10);
  for (let g = 0; g < grains; g++) {
    const t0 = Math.round(rand(r, 0.0, 0.32) * SR);
    const len = Math.round(rand(r, 0.003, 0.012) * SR);
    const res = new Biquad("bandpass", rand(r, 2500, 7500), rand(r, 1.5, 4));
    const amp = Math.pow(r(), 2.2) * 0.9 + 0.1;
    const pan = rand(r, -0.5, 0.5);
    for (let k = 0; k < len + 400 && t0 + k < n; k++) {
      const e = k < len ? Math.sin((Math.PI * k) / len) : 0;
      const v = res.tick((r() * 2 - 1) * e) * amp;
      L[t0 + k] += v * (1 - pan);
      R[t0 + k] += v * (1 + pan);
    }
  }
  // the card landing: a soft low "fwump"
  const land = Math.round(0.26 * SR);
  const lp = new Biquad("lowpass", 260, 0.7);
  for (let k = 0; k < 0.09 * SR && land + k < n; k++) {
    const t = k / SR;
    const v = lp.tick(r() * 2 - 1) * rise(t / 0.004) * Math.exp(-t / 0.028) * 2.2;
    L[land + k] += v;
    R[land + k] += v;
  }
  filter(L, "highpass", 120);
  filter(R, "highpass", 120);
  return done(L, R, 0.1);
}

export function key(_, r) {
  const n = Math.round(0.075 * SR);
  const x = new Float32Array(n);
  const click = new Biquad("bandpass", rand(r, 3200, 5200), 1.2);
  const thock = rand(r, 170, 260);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = click.tick(r() * 2 - 1) * rise(t / 0.0006) * Math.exp(-t / 0.0045)
      + Math.sin(TAU * thock * t) * rise(t / 0.0015) * Math.exp(-t / 0.009) * 0.5;
  }
  const up = Math.round(rand(r, 0.035, 0.05) * SR);
  const rel = new Biquad("bandpass", rand(r, 2500, 4200), 1.5);
  for (let k = 0; up + k < n; k++) x[up + k] += rel.tick(r() * 2 - 1) * Math.exp(-k / SR / 0.003) * 0.35;
  return done(x, Float32Array.from(x), 0.04);
}

export function tick() {
  const n = Math.round(0.09 * SR);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = (Math.sin(TAU * 1760 * t) * 0.7 + Math.sin(TAU * 3520 * t) * 0.22) * rise(t / 0.0008) * Math.exp(-t / 0.014);
  }
  return done(x, Float32Array.from(x), 0.1);
}

// light-flare transition: an airy swell with a few bright glints
export function flare(_, r) {
  const dur = 1.1;
  const n = Math.round((dur + 1.2) * SR);
  const [L, R] = stereo(n);
  const nl = new Pink(r);
  const nr = new Pink(r);
  const hl = new Biquad("highpass", 2600, 0.6);
  const hr = new Biquad("highpass", 2700, 0.6);
  for (let i = 0; i < Math.round(dur * SR); i++) {
    const t = i / SR;
    const env = t < 0.45 ? Math.pow(rise(t / 0.45), 1.3) : Math.exp(-(t - 0.45) / 0.22);
    L[i] += hl.tick(nl.tick()) * env * 0.8;
    R[i] += hr.tick(nr.tick()) * env * 0.8;
  }
  for (let g = 0; g < 9; g++) {
    partial(L, R, Math.round(rand(r, 0.25, 0.6) * SR), {
      f: rand(r, 2600, 6500), amp: rand(r, 0.05, 0.14), tau: rand(r, 0.12, 0.35), attack: 0.004, pan: rand(r, -0.7, 0.7),
    });
  }
  return done(L, R, 0.4);
}

// slow riser into the twist: band-passed noise and a tone gliding up a fifth, cut clean at the end
export function riser({ dur = 2.5 }, r) {
  const n = Math.round((dur + 0.05) * SR);
  const [L, R] = stereo(n);
  const nl = new Pink(r);
  const nr = new Pink(r);
  const fl = new SVF();
  const fr = new SVF();
  let ph = 0;
  let ph2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const x = clamp(t / dur, 0, 1);
    const env = Math.pow(x, 2.2) * (t > dur - 0.04 ? Math.max(0, (dur + 0.01 - t) / 0.05) : 1);
    if (i % 16 === 0) {
      const fc = 250 * Math.pow(12, x);
      fl.set(fc, 1.2 + 2 * x);
      fr.set(fc * 1.04, 1.2 + 2 * x);
    }
    fl.tick(nl.tick());
    fr.tick(nr.tick());
    const f = 146.83 * Math.pow(1.5, x);
    ph += ((TAU * f) / SR) * (1 + 0.004 * Math.sin(TAU * 5.5 * t));
    ph2 += (TAU * f * 2.003) / SR;
    const tone = (Math.sin(ph) * 0.6 + Math.sin(ph2) * 0.22) * 0.45;
    L[i] = (fl.bp * 0.8 + tone) * env;
    R[i] = (fr.bp * 0.8 + tone) * env;
  }
  return done(L, R, 0.3);
}

export function thump(_, r) {
  const n = Math.round(0.8 * SR);
  const x = new Float32Array(n);
  const lp = new Biquad("lowpass", 180, 0.7);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * (46 + 44 * Math.exp(-t / 0.04))) / SR;
    x[i] = Math.sin(ph) * rise(t / 0.004) * Math.exp(-t / 0.17) + lp.tick(r() * 2 - 1) * Math.exp(-t / 0.02) * 0.6;
  }
  return done(x, Float32Array.from(x), 0.25);
}

// soft deep boom for "God stopped Abraham's hand": no sharp transient, long warm sub tail
export function boom(_, r) {
  const n = Math.round(4.2 * SR);
  const [L, R] = stereo(n);
  const bl = new Brown(r);
  const br = new Brown(r);
  const al = new Biquad("lowpass", 140, 0.7);
  const ar = new Biquad("lowpass", 150, 0.7);
  const felt = new Biquad("lowpass", 420, 0.7);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 34 + 30 * Math.exp(-t / 0.22);
    ph += (TAU * f) / SR;
    const env = rise(t / 0.012) * (0.72 * Math.exp(-t / 0.9) + 0.28 * Math.exp(-t / 2.3));
    const sub = (Math.sin(ph) + 0.22 * Math.sin(2 * ph) * Math.exp(-t / 0.5)) * env;
    const airEnv = rise(t / 0.02) * Math.exp(-t / 0.45) * 0.55;
    const tr = felt.tick(r() * 2 - 1) * rise(t / 0.003) * Math.exp(-t / 0.025) * 0.18;
    L[i] = sub + al.tick(bl.tick()) * airEnv + tr;
    R[i] = sub + ar.tick(br.tick()) * airEnv + tr;
  }
  return done(L, R, 0.35);
}

// warm shimmer: high sparkles in D major plus a soft high swell
export function shimmer({ dur = 2.5 }, r) {
  const n = Math.round((dur + 2.2) * SR);
  const [L, R] = stereo(n);
  const tones = ["D6", "E6", "F#6", "A6", "B6", "D7", "A5", "F#5"].map(note);
  const count = Math.round(dur * 9);
  for (let s = 0; s < count; s++) {
    const t0 = Math.pow(r(), 1.4) * dur;
    const f = pick(r, tones) * (1 + rand(r, -0.002, 0.002));
    const amp = rand(r, 0.25, 1) * (1 - (0.5 * t0) / dur) * 0.12;
    const tau = rand(r, 0.35, 0.9);
    const pan = rand(r, -0.8, 0.8);
    const st = Math.round(t0 * SR);
    partial(L, R, st, { f, amp, tau, attack: 0.003, pan });
    partial(L, R, st, { f: f * 2.0, amp: amp * 0.2, tau: tau * 0.5, attack: 0.003, pan });
  }
  for (const [nm, pan] of [["A5", -0.4], ["D6", 0.1], ["F#6", 0.45]]) {
    const f = note(nm);
    const [gl, gr] = panGains(pan);
    let p1 = r() * TAU;
    let p2 = r() * TAU;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const env = rise(t / (dur * 0.45)) * (t > dur ? Math.exp(-(t - dur) / 0.6) : 1) * 0.05;
      p1 += (TAU * f) / SR;
      p2 += (TAU * (f + 0.9)) / SR;
      const v = (Math.sin(p1) + Math.sin(p2)) * env * (1 + 0.15 * Math.sin(TAU * 5.8 * t));
      L[i] += v * gl;
      R[i] += v * gr;
    }
  }
  return done(L, R, 0.6);
}

// distant, low thunder: rolling brown-noise rumbles under 200 Hz, a soft far crack
export function thunder({ dur = 4 }, r) {
  const n = Math.round((dur + 1.5) * SR);
  const [L, R] = stereo(n);
  const bl = new Brown(r);
  const br = new Brown(r);
  const l1 = new Biquad("lowpass", 170, 0.7);
  const l2 = new Biquad("lowpass", 170, 0.7);
  const r1 = new Biquad("lowpass", 180, 0.7);
  const r2 = new Biquad("lowpass", 180, 0.7);
  const rolls = Array.from({ length: 5 }, (_, k) => ({
    t: k === 0 ? 0.05 : rand(r, 0.15, dur * 0.75), len: rand(r, 0.5, 1.4), amp: k === 0 ? 1 : rand(r, 0.35, 0.8),
  }));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env = 0;
    for (const ro of rolls) {
      const x = (t - ro.t) / ro.len;
      if (x > 0) env += ro.amp * (x < 0.25 ? rise(x / 0.25) : Math.exp(-(x - 0.25) * 2.2));
    }
    env *= Math.exp(-t / (dur * 0.7));
    L[i] = l2.tick(l1.tick(bl.tick())) * env;
    R[i] = r2.tick(r1.tick(br.tick())) * env;
  }
  const crack = new Biquad("bandpass", 900, 0.7);
  const c0 = Math.round(0.08 * SR);
  for (let k = 0; k < 0.4 * SR; k++) {
    const t = k / SR;
    const v = crack.tick(r() * 2 - 1) * rise(t / 0.01) * Math.exp(-t / 0.09) * 0.06;
    L[c0 + k] += v * 0.8;
    R[c0 + k] += v * 1.2;
  }
  return done(L, R, 0.25);
}

// gentle bell-like chime on the biggest keywords
export function chime({ note: nm = "A5" }, r) {
  const f = note(nm);
  const n = Math.round(3.4 * SR);
  const [L, R] = stereo(n);
  const ratios = [1, 2.0, 3.01, 4.17, 5.43];
  const amps = [1, 0.32, 0.14, 0.07, 0.03];
  const taus = [2.4, 1.3, 0.8, 0.5, 0.35];
  ratios.forEach((k, j) => partial(L, R, 0, { f: f * k, amp: amps[j], tau: taus[j], attack: 0.002, pan: j % 2 ? 0.25 : -0.15 }));
  partial(L, R, 0, { f: f + 1.1, amp: 0.45, tau: 2.1, attack: 0.003, pan: 0.1 });
  void r;
  return done(L, R, 0.45);
}

export const SFX = { whoosh, pop, paper, key, tick, flare, riser, thump, boom, shimmer, thunder, chime };

// ================================================================ ambience beds

function calibrate(L, R, rms) {
  const cur = Math.sqrt((rmsOf(L) ** 2 + rmsOf(R) ** 2) / 2) || 1;
  for (let i = 0; i < L.length; i++) {
    L[i] *= rms / cur;
    R[i] *= rms / cur;
  }
}

// soft wind: decorrelated pink noise, band-limited, with slow gusts and a faint whistle
function windInto(L, R, r, { level = 1, low = 160, high = 900, gust = 0.3, gustRate = 0.22, whistle = 0.06, swell = null } = {}) {
  const n = L.length;
  const [wl, wr] = stereo(n);
  const nl = new Pink(r);
  const nr = new Pink(r);
  const hpl = new Biquad("highpass", low, 0.6);
  const hpr = new Biquad("highpass", low * 1.05, 0.6);
  const lpl = new SVF();
  const lpr = new SVF();
  const wh = new SVF();
  const g = new Drift(r, gustRate);
  const g2 = new Drift(r, gustRate * 2.7);
  const wd = new Drift(r, 0.15);
  const wn = new Pink(r);
  for (let i = 0; i < n; i++) {
    const x = i / n;
    const s = swell ? swell(x) : 1;
    const gg = 1 - gust + gust * (0.5 + 0.5 * g.tick()) + 0.12 * g2.tick();
    if (i % 32 === 0) {
      const hi = high * (0.8 + 0.35 * gg) * (swell ? 0.75 + 0.5 * s : 1);
      lpl.set(hi, 0.6);
      lpr.set(hi * 1.06, 0.6);
      wh.set(1200 + 600 * (0.5 + 0.5 * wd.tick()), 9);
    }
    lpl.tick(hpl.tick(nl.tick()));
    lpr.tick(hpr.tick(nr.tick()));
    wh.tick(wn.tick());
    wl[i] = (lpl.lp + wh.bp * whistle) * gg * s;
    wr[i] = (lpr.lp + wh.bp * whistle * 0.8) * gg * s;
  }
  calibrate(wl, wr, BED_RMS * 0.8 * level);
  for (let i = 0; i < n; i++) {
    L[i] += wl[i];
    R[i] += wr[i];
  }
}

function birdPhrase(L, R, start, r) {
  const species = Math.floor(r() * 4);
  const [gl, gr] = panGains(rand(r, -0.85, 0.85));
  const dist = rand(r, 0.3, 1.0);
  const notes = [];
  if (species === 0) {
    const f0 = rand(r, 3600, 4800);
    const count = 5 + Math.floor(r() * 8);
    const step = rand(r, 0.045, 0.065);
    for (let k = 0; k < count; k++) notes.push({ t: k * step, len: step * 0.7, f0: f0 * (1 - 0.01 * k), f1: f0 * (0.92 - 0.01 * k), amp: 1 - k / (count * 1.5) });
  } else if (species === 1) {
    const f0 = rand(r, 2300, 3100);
    notes.push({ t: 0, len: 0.22, f0, f1: f0 * 1.18, amp: 0.9 });
    notes.push({ t: 0.27, len: 0.26, f0: f0 * 1.12, f1: f0 * 0.94, amp: 1 });
    if (r() < 0.5) notes.push({ t: 0.6, len: 0.18, f0: f0 * 1.25, f1: f0 * 1.2, amp: 0.7 });
  } else if (species === 2) {
    const f0 = rand(r, 4200, 6000);
    const count = 2 + Math.floor(r() * 4);
    const gap = rand(r, 0.09, 0.14);
    for (let k = 0; k < count; k++) notes.push({ t: k * gap, len: 0.03, f0, f1: f0 * 0.8, amp: 0.8 });
  } else {
    const f0 = rand(r, 2800, 3600);
    notes.push({ t: 0, len: rand(r, 0.35, 0.6), f0, f1: f0 * 1.05, amp: 0.8, fm: rand(r, 18, 32), fmDepth: rand(r, 250, 450) });
  }
  for (const nt of notes) {
    const s0 = start + Math.round(nt.t * SR);
    const len = Math.round(nt.len * SR);
    let ph = r() * TAU;
    for (let k = 0; k < len; k++) {
      const i = s0 + k;
      if (i >= L.length) break;
      const x = k / len;
      let f = nt.f0 + (nt.f1 - nt.f0) * x;
      if (nt.fm) f += nt.fmDepth * Math.sin((TAU * nt.fm * k) / SR);
      ph += (TAU * f) / SR;
      const v = (Math.sin(ph) + 0.12 * Math.sin(2 * ph)) * Math.pow(Math.sin(Math.PI * x), 1.5) * nt.amp * dist * 0.42;
      L[i] += v * gl;
      R[i] += v * gr;
    }
  }
}

function hoof(L, R, s0, r, amp, pan) {
  const len = Math.round(0.09 * SR);
  const lp = new Biquad("lowpass", rand(r, 700, 1300), 0.8);
  const grit = new Biquad("bandpass", rand(r, 2200, 4500), 0.9);
  const f = rand(r, 120, 180);
  const gritAmt = r() < 0.7 ? 0.25 : 0.08;
  const [gl, gr] = panGains(pan);
  for (let k = 0; k < len && s0 + k < L.length; k++) {
    const t = k / SR;
    const thud = Math.sin(TAU * f * t * (1 - (0.3 * t) / 0.09)) * rise(t / 0.002) * Math.exp(-t / 0.018) * 0.6;
    const dirt = lp.tick(r() * 2 - 1) * rise(t / 0.001) * Math.exp(-t / 0.022) * 0.7;
    const g = grit.tick(r() * 2 - 1) * Math.exp(-t / 0.012) * gritAmt;
    const v = (thud + dirt + g) * amp * 0.55;
    L[s0 + k] += v * gl;
    R[s0 + k] += v * gr;
  }
}

function smallBell(L, R, s0, r, pan, amp = 0.12) {
  const f0 = rand(r, 1950, 2250);
  [[1, 1, 0.5], [2.32, 0.5, 0.3], [4.25, 0.25, 0.18], [6.63, 0.12, 0.11]].forEach(([k, a, tau]) => {
    if (s0 < L.length) partial(L, R, s0, { f: f0 * k, amp: amp * a, tau, attack: 0.001, pan });
    const s1 = s0 + Math.round(0.07 * SR);
    if (r() < 0.5 && s1 < L.length) partial(L, R, s1, { f: f0 * k, amp: amp * a * 0.55, tau, attack: 0.001, pan });
  });
}

function crackles(L, R, r, { rate = 7, pan = 0.15, level = 1 } = {}) {
  const n = L.length;
  let t = expRand(r, 1 / rate);
  const [gl, gr] = panGains(pan);
  while (t * SR < n) {
    const s0 = Math.round(t * SR);
    const isPop = r() < 0.12;
    const res = new Biquad("bandpass", isPop ? rand(r, 600, 1200) : rand(r, 1500, 5200), isPop ? rand(r, 3, 6) : rand(r, 5, 12));
    const amp = Math.min(1, 0.15 / Math.pow(1 - r() * 0.98, 0.6)) * (isPop ? 1.6 : 1) * level;
    const burst = Math.round(rand(r, 0.0015, 0.004) * SR);
    for (let k = 0; k < burst + 900 && s0 + k < n; k++) {
      const v = res.tick(k < burst ? (r() * 2 - 1) * (1 - k / burst) : 0) * amp;
      L[s0 + k] += v * gl;
      R[s0 + k] += v * gr;
    }
    t += expRand(r, 1 / rate);
  }
}

const AMBIENCE = {
  dawn(n, r) {
    const [L, R] = stereo(n);
    windInto(L, R, r, { level: 0.55, low: 160, high: 900, gust: 0.25 });
    let t = rand(r, 0.05, 0.5);
    while (t * SR < n) {
      birdPhrase(L, R, Math.round(t * SR), r);
      t += expRand(r, 1.15) + 0.25;
    }
    return { L, R };
  },
  night(n, r) {
    const [L, R] = stereo(n);
    windInto(L, R, r, { level: 0.45, low: 120, high: 500, gust: 0.2 });
    for (const c of [{ f: 4500, pan: -0.55, amp: 0.1, period: 0.62 }, { f: 4250, pan: 0.6, amp: 0.07, period: 0.71 }, { f: 4700, pan: 0.1, amp: 0.035, period: 0.55 }]) {
      let t = rand(r, 0, c.period);
      while (t * SR < n) {
        for (let p = 0; p < 3; p++) {
          const s0 = Math.round((t + p * 0.032) * SR);
          if (s0 < n) partial(L, R, s0, { f: c.f * rand(r, 0.995, 1.005), amp: c.amp * rand(r, 0.7, 1), tau: 0.006, attack: 0.002, pan: c.pan, len: Math.round(0.02 * SR) });
        }
        t += c.period * rand(r, 0.9, 1.1);
      }
    }
    return { L, R };
  },
  wind(n, r) {
    const [L, R] = stereo(n);
    windInto(L, R, r, { level: 1, low: 200, high: 1100, gust: 0.45, whistle: 0.09 });
    return { L, R };
  },
  journey(n, r) {
    const [L, R] = stereo(n);
    windInto(L, R, r, { level: 0.6, low: 120, high: 700, gust: 0.3 });
    let t = 0.12;
    let k = 0;
    while (t * SR < n) {
      const x = (t * SR) / n;
      const pan = -0.3 + 0.6 * x;
      hoof(L, R, Math.round(t * SR), r, k % 2 === 0 ? 0.7 : 1.0, pan);
      if (k % 4 === 3 && r() < 0.85) smallBell(L, R, Math.round((t + rand(r, 0.02, 0.08)) * SR), r, pan);
      t += 0.29 * rand(r, 0.92, 1.08);
      k++;
    }
    return { L, R };
  },
  climb(n, r) {
    const [L, R] = stereo(n);
    windInto(L, R, r, { level: 1, low: 150, high: 650, gust: 0.4, whistle: 0.1, swell: (x) => 0.55 + 0.45 * x });
    const moan = new SVF();
    const mn = new Pink(r);
    const md = new Drift(r, 0.12);
    const [mL, mR] = stereo(n);
    for (let i = 0; i < n; i++) {
      if (i % 64 === 0) moan.set(170 + 50 * md.tick(), 3);
      moan.tick(mn.tick());
      const v = moan.bp * (0.4 + 0.6 * (i / n));
      mL[i] = v;
      mR[i] = v * 0.9;
    }
    calibrate(mL, mR, BED_RMS * 0.25);
    for (let i = 0; i < n; i++) {
      L[i] += mL[i];
      R[i] += mR[i];
    }
    // sparse soft footsteps on rock
    let t = 0.3;
    let side = 0;
    while (t * SR < n) {
      hoof(L, R, Math.round(t * SR), r, 0.22, side ? 0.2 : -0.2);
      side ^= 1;
      t += rand(r, 0.62, 0.8);
    }
    return { L, R };
  },
  fire(n, r) {
    const [L, R] = stereo(n);
    const breath = new Biquad("lowpass", 380, 0.7);
    const bn = new Brown(r);
    const fl = new Drift(r, 6);
    for (let i = 0; i < n; i++) {
      const v = breath.tick(bn.tick()) * (0.6 + 0.4 * (0.5 + 0.5 * fl.tick()));
      L[i] += v * 0.85;
      R[i] += v;
    }
    calibrate(L, R, BED_RMS * 0.35);
    crackles(L, R, r, { rate: 8, pan: 0.15, level: 1.1 });
    return { L, R };
  },
  glory(n, r) {
    const [L, R] = stereo(n);
    const nl = new Pink(r);
    const nr = new Pink(r);
    const bl = new Biquad("bandpass", 4200, 0.8);
    const br = new Biquad("bandpass", 4600, 0.8);
    const sw = new Drift(r, 0.1);
    for (let i = 0; i < n; i++) {
      const s = 0.6 + 0.4 * (0.5 + 0.5 * sw.tick());
      L[i] = bl.tick(nl.tick()) * s;
      R[i] = br.tick(nr.tick()) * s;
    }
    calibrate(L, R, BED_RMS * 0.5);
    for (const [nm, pan] of [["D6", -0.3], ["A6", 0.35]]) {
      const f = note(nm);
      const [gl, gr] = panGains(pan);
      let ph = r() * TAU;
      for (let i = 0; i < n; i++) {
        ph += (TAU * f) / SR;
        const v = Math.sin(ph) * 0.02 * (1 + 0.2 * Math.sin(TAU * 0.4 * (i / SR)));
        L[i] += v * gl;
        R[i] += v * gr;
      }
    }
    return { L, R };
  },
  storm(n, r) {
    const [L, R] = stereo(n);
    const bl = new Brown(r);
    const br = new Brown(r);
    const a1 = new Biquad("lowpass", 110, 0.7);
    const a2 = new Biquad("lowpass", 110, 0.7);
    const b1 = new Biquad("lowpass", 120, 0.7);
    const b2 = new Biquad("lowpass", 120, 0.7);
    const am = new Drift(r, 0.15);
    for (let i = 0; i < n; i++) {
      const g = 0.6 + 0.4 * (0.5 + 0.5 * am.tick());
      L[i] = a2.tick(a1.tick(bl.tick())) * g;
      R[i] = b2.tick(b1.tick(br.tick())) * g;
    }
    calibrate(L, R, BED_RMS * 0.7);
    windInto(L, R, r, { level: 0.7, low: 450, high: 1300, gust: 0.55, gustRate: 0.4, whistle: 0.12 });
    return { L, R };
  },
};

export function ambienceBed(name, n, r) {
  const fn = AMBIENCE[name];
  if (!fn) throw new Error(`unknown ambience ${name}`);
  return fn(n, r);
}

export const AMBIENCE_NAMES = Object.keys(AMBIENCE);
