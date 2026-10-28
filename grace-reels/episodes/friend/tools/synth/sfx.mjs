// Sound effects for "Friend", each placed on its beat from src/beats.mjs. Two buses so the mix can treat
// them differently: "beds" (garden night, torches, room murmur, feast) duck hard under the voice;
// "hits" (heartbeat, water, coins, scale, steps, taps) duck lightly. Deterministic: seeded noise only.
import { SR, TAU, Bus, Rng, Noise, Sine, Saw, Biquad, curve, wobble, clamp, panGains } from './dsp.mjs';

// ---------- one-shot helpers ----------
function addMono(bus, i, y, pan) {
  if (i < 0 || i >= bus.n) return;
  const [gl, gr] = panGains(pan);
  bus.L[i] += y * gl;
  bus.R[i] += y * gr;
}
// Run a per-sample generator g(tt, q) -> y for len seconds from t, panned, with tiny edge fades.
function oneShot(bus, t, len, pan, g) {
  const i0 = bus.index(t), n = Math.round(len * SR), e = Math.min(240, n >> 2);
  for (let q = 0; q < n; q++) addMono(bus, i0 + q, g(q / SR, q) * Math.min(1, q / 24, (n - q) / e), pan);
}

function heartbeat(bus, t, gain = 0.5) {
  // lub-dub: two soft low thumps, the second a little higher and quieter
  for (const [dt, f, g] of [[0, 52, 1], [0.27, 64, 0.7]]) {
    const s = new Sine(0), lp = new Biquad('lowpass', 180, 0.8), nz = new Noise(`hb${t}${dt}`);
    oneShot(bus, t + dt, 0.32, 0, (tt) => {
      const env = Math.min(1, tt / 0.012) * Math.exp(-tt / 0.07);
      return (s.next(f * (1 - 0.18 * Math.min(1, tt / 0.1))) + 0.35 * lp.process(nz.white()) * Math.exp(-tt / 0.03)) * env * g * gain;
    });
  }
}

function whoosh(bus, tPeak, { pre = 0.6, post = 0.5, f0 = 300, fPeak = 2400, f1 = 500, gain = 0.3, panFrom = -0.6, panTo = 0.6, body = 0.6, q = 1.1, seed = 'whoosh', reverse = false } = {}) {
  const t0 = tPeak - pre, t1 = tPeak + post;
  const nz = new Noise(seed), bp = new Biquad('bandpass', f0, q), lp = new Biquad('lowpass', 220, 0.7);
  for (let i = Math.max(0, bus.index(t0)); i < Math.min(bus.n, bus.index(t1)); i++) {
    const t = i / SR - bus.pre;
    const u = clamp(t < tPeak ? (t - t0) / pre : (t - tPeak) / post, 0, 1);
    const f = t < tPeak ? f0 * (fPeak / f0) ** u : fPeak * (f1 / fPeak) ** u;
    if ((i & 15) === 0) bp.set('bandpass', f, q);
    // a reversed whoosh swells slowly and stops dead at its peak (like a sound played backwards)
    const env = reverse ? (t < tPeak ? u ** 3.2 : Math.max(0, 1 - u * 14)) : t < tPeak ? u ** 2.2 : (1 - u) ** 1.6;
    const w = nz.white();
    const y = (bp.process(w) + body * lp.process(w) * 2) * env * gain;
    addMono(bus, i, y, panFrom + (panTo - panFrom) * clamp((t - t0) / (pre + post), 0, 1));
  }
}
function tapeRewind(bus, t0, dur, gain = 0.4) {
  // chattering tone sweeping up + a falling noise sweep: time running backwards
  const nz = new Noise('rewind'), bp = new Biquad('bandpass', 3000, 1.5), bpt = new Biquad('bandpass', 800, 4);
  let ph = 0;
  const i0 = bus.index(t0), n = Math.round(dur * SR);
  for (let q = 0; q < n; q++) {
    const u = q / n;
    if ((q & 15) === 0) {
      bp.set('bandpass', 3200 * 0.3 ** u, 1.5);
      bpt.set('bandpass', 500 * 5 ** u, 4);
    }
    ph += (260 * 9 ** u) / SR;
    const chatter = 0.6 + 0.4 * Math.sin((TAU * 38 * q) / SR);
    const tone = bpt.process(2 * (ph % 1) - 1) * chatter;
    const env = Math.sin(Math.PI * Math.min(1, u * 1.1)) ** 0.8 * Math.min(1, (n - q) / 240, q / 240);
    addMono(bus, i0 + q, (0.5 * bp.process(nz.white()) + 0.45 * tone) * env * gain, 0.4 - 0.8 * u);
  }
}
function softThud(bus, t, gain = 0.25, f = 62) {
  const nz = new Noise(`thud${t}`), lp = new Biquad('lowpass', 220, 0.7), s = new Sine(0);
  oneShot(bus, t, 0.35, 0, (tt) => (0.7 * lp.process(nz.white()) * Math.exp(-tt / 0.06) + 0.6 * s.next(f) * Math.exp(-tt / 0.05)) * gain);
}
function cloth(bus, t0, dur, { gain = 0.12, rate = 14, fc = 1600, pan = 0, seed = 'cloth' } = {}) {
  // fabric: soft swish body plus small irregular rustles
  const r = new Rng(seed), nz = new Noise(seed), bp = new Biquad('bandpass', fc, 0.9), hp = new Biquad('highpass', 2500, 0.7);
  let next = 0, fT = -1, fA = 0;
  oneShot(bus, t0, dur, pan, (tt) => {
    if (tt >= next) { fT = tt; fA = r.range(0.3, 1); next = tt + (1 / rate) * r.range(0.5, 1.6); }
    const ft = tt - fT, w = nz.white();
    const swell = Math.sin(Math.PI * Math.min(1, tt / dur)) ** 0.8;
    return (bp.process(w) * (0.45 + fA * Math.exp(-ft / 0.03)) + 0.25 * hp.process(w) * fA * Math.exp(-ft / 0.01)) * swell * gain;
  });
}
function drip(bus, t, gain = 0.16, pan = 0, seed = 0) {
  // a drop into water: a short rising "plip" with a tiny click
  const r = new Rng(`drip${seed}`), s = new Sine(0), f0 = r.range(700, 1100);
  oneShot(bus, t, 0.12, pan, (tt) => (s.next(f0 * (1 + 1.4 * Math.min(1, tt / 0.03))) * Math.exp(-tt / 0.022) + (tt < 0.002 ? 0.3 : 0)) * gain);
}
function splash(bus, t, gain = 0.14, dur = 0.35, seed = 's') {
  // hands moving in shallow water: bubbly filtered noise plus a few plinks
  const nz = new Noise(`spl${seed}`), bp = new Biquad('bandpass', 1800, 0.8), lp = new Biquad('lowpass', 900, 0.7);
  const r = new Rng(`splr${seed}`), am = wobble(`spla${seed}`, [17, 29, 41]);
  oneShot(bus, t, dur, r.range(-0.2, 0.2), (tt) => {
    const env = Math.min(1, tt / 0.03) * Math.exp(-tt / (dur * 0.4));
    const w = nz.white();
    return (bp.process(w) * (0.6 + 0.4 * am(tt)) + 0.5 * lp.process(w)) * env * gain;
  });
  for (let k = 0; k < 3; k++) drip(bus, t + r.range(0.02, dur * 0.8), gain * 0.5, r.range(-0.3, 0.3), `${seed}${k}`);
}
function pour(bus, t0, t1, gain = 0.2) {
  // a stream of water into a clay basin: bubbly hiss, plinks, and a body resonance that rises as it fills
  const nzL = new Noise('pourL'), nzR = new Noise('pourR'), r = new Rng('pour');
  const mk = () => ({ hiss: new Biquad('bandpass', 2600, 0.7), body: new Biquad('bandpass', 380, 3.5), lp: new Biquad('lowpass', 5000, 0.7) });
  const fL = mk(), fR = mk(), am = wobble('pouram', [23, 37, 53, 71]);
  const bubbles = [];
  const i0 = bus.index(t0), n = Math.round((t1 - t0 + 0.25) * SR), dur = t1 - t0;
  for (let q = 0; q < n; q++) {
    const tt = q / SR, u = Math.min(1, tt / dur);
    if ((q & 31) === 0) for (const f of [fL, fR]) f.body.set('bandpass', 380 + 520 * u, 3.5);
    if (r.next() < 60 / SR) bubbles.push({ s: new Sine(0), f: r.range(600, 1600), age: 0, a: r.range(0.1, 0.35), tau: r.range(0.006, 0.014), pan: r.range(-0.5, 0.5) });
    let bl = 0, br = 0;
    for (let k = bubbles.length - 1; k >= 0; k--) {
      const b = bubbles[k], at = b.age / SR;
      const y = b.s.next(b.f * (1 + 0.6 * Math.min(1, at / 0.012))) * b.a * Math.exp(-at / b.tau);
      const [gl, gr] = panGains(b.pan);
      bl += y * gl;
      br += y * gr;
      if (++b.age > b.tau * 6 * SR) bubbles.splice(k, 1);
    }
    const env = Math.min(1, tt / 0.08) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.25) : 1);
    const a = 0.7 + 0.3 * am(tt);
    const l = fL.lp.process(fL.hiss.process(nzL.white()) * a + 2.2 * fL.body.process(nzL.white())) + bl * 0.5;
    const rr = fR.lp.process(fR.hiss.process(nzR.white()) * a + 2.2 * fR.body.process(nzR.white())) + br * 0.5;
    if (i0 + q >= 0 && i0 + q < bus.n) {
      bus.L[i0 + q] += l * env * gain;
      bus.R[i0 + q] += rr * env * gain;
    }
  }
}
function tick(bus, t, gain = 0.12, f = 2400, pan = 0) {
  const s = new Sine(0), nz = new Noise(`tick${t}`), hp = new Biquad('highpass', 3000, 0.7);
  oneShot(bus, t, 0.06, pan, (tt) => (0.6 * s.next(f) * Math.exp(-tt / 0.012) + 0.4 * hp.process(nz.white()) * Math.exp(-tt / 0.003)) * gain);
}
// Metal: a few inharmonic partials with fast decays. Coins are small and bright, the chain lower.
function metal(bus, t, { base = 2300, ratios = [1, 1.73, 2.42, 3.17, 3.98], decay = 0.18, gain = 0.15, pan = 0, seed = 'm', damp = 1 } = {}) {
  const r = new Rng(`metal${seed}`);
  const parts = ratios.map((k, j) => ({ s: new Sine(r.next()), f: base * k * r.range(0.985, 1.015), a: r.range(0.5, 1) / (1 + 0.6 * j), d: decay * r.range(0.6, 1.2) / (1 + 0.35 * j) / damp }));
  const nz = new Noise(`metaln${seed}`), hp = new Biquad('highpass', 5000, 0.7);
  oneShot(bus, t, Math.min(1.6, decay * 4 / damp + 0.03), pan, (tt) => {
    let y = 0;
    for (const p of parts) y += p.s.next(p.f) * p.a * Math.exp(-tt / p.d);
    return (y + 0.5 * hp.process(nz.white()) * Math.exp(-tt / 0.002)) * gain;
  });
}
const coinClink = (bus, t, k, gain = 0.14, pan = 0, damp = 1) =>
  metal(bus, t, { base: new Rng(`cb${k}`).range(2100, 2900), decay: 0.16, gain, pan, seed: `c${k}`, damp });
function chainRattle(bus, t0, dur, gain = 0.16, seed = 'ch') {
  const r = new Rng(seed);
  const n = Math.round(dur * 26);
  for (let k = 0; k < n; k++) {
    const t = t0 + dur * (k / n) ** 0.8 + r.range(0, 0.02);
    metal(bus, t, { base: r.range(900, 1500), ratios: [1, 1.5, 2.3, 3.1], decay: 0.06, gain: gain * r.range(0.3, 1) * (1 - 0.6 * (k / n)), pan: r.range(-0.3, 0.3), seed: `${seed}${k}` });
  }
}
function heavyClank(bus, t, gain = 0.3) {
  metal(bus, t, { base: 330, ratios: [1, 2.1, 2.9, 4.2, 5.4], decay: 0.5, gain: gain * 0.6, seed: 'clank' });
  softThud(bus, t, gain, 58);
}
function creak(bus, t0, dur, { gain = 0.08, f0 = 18, f1 = 40, fc = 900, seed = 'creak' } = {}) {
  // stick-slip: an impulse train with a drifting rate through a woody resonance
  const r = new Rng(seed), bp = new Biquad('bandpass', fc, 6), bp2 = new Biquad('bandpass', fc * 2.3, 8);
  let ph = 0;
  oneShot(bus, t0, dur, 0.1, (tt) => {
    const u = tt / dur;
    ph += (f0 + (f1 - f0) * Math.sin(Math.PI * u)) / SR;
    let x = 0;
    if (ph >= 1) { ph -= 1; x = r.range(0.5, 1); }
    const env = Math.sin(Math.PI * u) ** 0.6;
    return (bp.process(x) * 3 + bp2.process(x) * 1.5) * env * gain;
  });
}
function coinSpin(bus, t0, tWob, tFlat, gain = 0.2) {
  // A coin spinning on a wooden table. While it spins upright it hums; as it wobbles down the contact
  // rate rises faster and faster (like Euler's disk), then it slaps flat and rings for a moment.
  const r = new Rng('spin'), lp = new Biquad('lowpass', 7000, 0.7), wood = new Biquad('bandpass', 420, 2.5);
  const ring = [2350, 4100, 5800].map((f, j) => ({ s: new Sine(j * 0.3), f, a: [1, 0.5, 0.25][j] }));
  let ph = 0, env = 0;
  const n = Math.round((tFlat - t0) * SR);
  oneShot(bus, t0, tFlat - t0, 0.05, (tt) => {
    const t = t0 + tt;
    const rate = t < tWob ? 9 + 3 * Math.sin(tt * 2) : 12 * ((tFlat - tWob) / Math.max(0.03, tFlat - t)) ** 0.85;
    ph += Math.min(rate, 260) / SR;
    let x = 0;
    if (ph >= 1) { ph -= 1; x = r.range(0.6, 1); env = 1; }
    env *= 0.9992;
    let y = 0;
    for (const p of ring) y += p.s.next(p.f * (1 + 0.004 * Math.sin(tt * 40))) * p.a;
    const hum = t < tWob ? 0.35 : 0.2 + 0.5 * Math.min(1, (t - tWob) / (tFlat - tWob));
    return lp.process(y * env * 0.08 + wood.process(x) * 2.5) * hum * gain;
  });
  // the flat slap and a short ring
  metal(bus, tFlat, { base: 2350, decay: 0.12, gain: gain * 0.7, seed: 'flat' });
  softThud(bus, tFlat, gain * 0.8, 160);
}
function heartPop(bus, t, k) {
  const r = new Rng(`heart${k}`), s = new Sine(0), f0 = r.range(560, 760);
  oneShot(bus, t, 0.16, r.range(-0.2, 0.5), (tt) => s.next(f0 * (1 + 0.8 * Math.min(1, tt / 0.04))) * Math.exp(-tt / 0.035) * 0.16);
}
function tap(bus, t, k) {
  const r = new Rng(`tap${k}`), nz = new Noise(`tapn${k}`), bp = new Biquad('bandpass', r.range(3200, 4600), 1.2), s = new Sine(0), g = r.range(0.75, 1);
  oneShot(bus, t, 0.05, 0.25, (tt) => (0.6 * bp.process(nz.white()) * Math.exp(-tt / 0.003) + 0.35 * s.next(180) * Math.exp(-tt / 0.008)) * g * 0.22);
}
function pop(bus, t, f, gain = 0.14, pan = 0) {
  const s = new Sine(0);
  oneShot(bus, t, 0.2, pan, (tt) => s.next(f * (1 + 0.5 * Math.min(1, tt / 0.03))) * Math.exp(-tt / 0.05) * gain);
}
function sparkle(bus, t0, t1, count, seed, gain) {
  const r = new Rng(seed), notes = [1174.7, 1318.5, 1480.0, 1760.0, 1975.5, 2349.3];
  for (let k = 0; k < count; k++) {
    const t = t0 + (t1 - t0) * (k / count) + r.range(0, (t1 - t0) / count);
    const f = notes[Math.floor(r.next() * notes.length)], a = gain * r.range(0.5, 1), tau = r.range(0.35, 0.8);
    const s1 = new Sine(r.next()), s2 = new Sine(r.next());
    oneShot(bus, t, tau * 5, r.range(-0.7, 0.7), (tt) => a * Math.exp(-tt / tau) * (s1.next(f) + 0.25 * s2.next(f * 2.76) * Math.exp(-tt / 0.12)));
  }
}
function air(bus, t0, tPeak, t1, gain, seed, lo = 5000, hi = 9000) {
  const nl = new Noise(seed + 'l'), nr = new Noise(seed + 'r');
  const mk = () => [new Biquad('highpass', lo, 0.7), new Biquad('lowpass', hi, 0.7)];
  const fl = mk(), fr = mk(), env = curve([[t0, 0], [tPeak, 1], [t1, 0]]);
  for (let i = Math.max(0, bus.index(t0)); i < Math.min(bus.n, bus.index(t1)); i++) {
    const a = env(i / SR - bus.pre) * gain;
    let l = nl.white(), rr = nr.white();
    for (const b of fl) l = b.process(l);
    for (const b of fr) rr = b.process(rr);
    bus.L[i] += l * a;
    bus.R[i] += rr * a;
  }
}
function birdChirp(bus, t, seed, gain = 0.05) {
  const r = new Rng(`bird${seed}`), s = new Sine(0), f0 = r.range(2600, 3600), pan = r.range(-0.7, 0.7);
  const notes = 2 + Math.floor(r.next() * 3);
  for (let k = 0; k < notes; k++) {
    const dt = k * r.range(0.08, 0.14), up = r.next() < 0.5;
    oneShot(bus, t + dt, 0.07, pan, (tt) => s.next(f0 * (up ? 1 + 0.35 * tt / 0.07 : 1.3 - 0.35 * tt / 0.07)) * Math.sin(Math.PI * tt / 0.07) * gain);
  }
}
function footstepEarth(bus, t, k, gain = 0.3, pan = 0) {
  const r = new Rng(`step${k}`), nz = new Noise(`stepn${k}`), bp = new Biquad('bandpass', 1100 * r.range(0.85, 1.15), 0.9), s = new Sine(0);
  const toe = r.range(0.025, 0.04);
  oneShot(bus, t, 0.17, pan, (tt) => {
    const crunch = Math.exp(-tt / 0.03) + (tt > toe ? 0.6 * Math.exp(-(tt - toe) / 0.025) : 0);
    return (0.4 * s.next(100 * (1 - 0.25 * Math.min(1, tt / 0.06))) * Math.exp(-tt / 0.03) + 0.32 * bp.process(nz.white()) * crunch) * gain;
  });
}

// ---------- continuous beds ----------
function bed(bus, t0, t1, level, seed, build) {
  const gen = build(new Noise(seed + 'L'), new Noise(seed + 'R'));
  for (let i = Math.max(0, bus.index(t0)); i < Math.min(bus.n, bus.index(t1)); i++) {
    const t = i / SR - bus.pre, a = level(t);
    const [l, r] = gen(t, i);
    bus.L[i] += l * a;
    bus.R[i] += r * a;
  }
}
const cricketsGen = (seed) => (nl, nr) => {
  // a few crickets at different pitches and places: pulse trains of a high carrier, chirping in groups
  const r = new Rng(seed);
  const crickets = Array.from({ length: 6 }, (_, k) => ({
    f: r.range(3900, 5200), period: r.range(0.55, 1.15), pulses: 2 + Math.floor(r.next() * 3), prate: r.range(26, 34),
    off: r.range(0, 1), a: r.range(0.35, 1) * (k < 2 ? 1 : 0.55), gains: panGains(r.range(-0.85, 0.85)), s: new Sine(r.next()),
  }));
  const hp = [new Biquad('highpass', 3000, 0.7), new Biquad('highpass', 3000, 0.7)];
  return (t) => {
    let l = 0, rr = 0;
    for (const c of crickets) {
      const ph = ((t / c.period + c.off) % 1) * c.period;
      const pulseT = ph * c.prate, n = Math.floor(pulseT), fr = pulseT - n;
      const on = n < c.pulses ? Math.sin(Math.PI * fr) ** 2 : 0;
      const y = c.s.next(c.f) * on * c.a;
      l += y * c.gains[0];
      rr += y * c.gains[1];
    }
    return [l * 0.5 + 0.08 * hp[0].process(nl.pink()), rr * 0.5 + 0.08 * hp[1].process(nr.pink())];
  };
};
const leavesGen = (seed) => (nl, nr) => {
  // wind in olive leaves: a bright rustle that swells with the gusts
  const mk = () => ({ bp: new Biquad('bandpass', 3200, 0.6), lo: new Biquad('bandpass', 500, 0.7), hp: new Biquad('highpass', 120, 0.7) });
  const fL = mk(), fR = mk(), gust = wobble(seed + 'g', [0.07, 0.16, 0.29]), rust = wobble(seed + 'r', [3.1, 5.3, 8.7]);
  return (t) => {
    const g = 0.55 + 0.45 * gust(t), rs = 0.7 + 0.3 * rust(t);
    const l = fL.hp.process(fL.bp.process(nl.pink()) * rs * 1.4 + fL.lo.process(nl.pink()) * 0.8);
    const r = fR.hp.process(fR.bp.process(nr.pink()) * rs * 1.4 + fR.lo.process(nr.pink()) * 0.8);
    return [l * g * 2.2, r * g * 2.2];
  };
};
const roarGen = (seed) => (nl, nr) => {
  // torch fire: a soft low roar with flicker
  const mk = () => ({ lp: new Biquad('lowpass', 240, 0.7), lp2: new Biquad('lowpass', 240, 0.9), bp: new Biquad('bandpass', 650, 0.7), hp: new Biquad('highpass', 40, 0.7) });
  const fL = mk(), fR = mk(), turb = wobble(seed + 't', [5.3, 8.1, 13.7]), flick = wobble(seed + 'f', [4.1, 7.7, 11.3]);
  return (t) => {
    const a = 0.75 + 0.25 * turb(t), m = 0.6 + 0.4 * flick(t);
    const l = fL.hp.process(fL.lp2.process(fL.lp.process(nl.brownN())) * a * 1.6 + fL.bp.process(nl.pink()) * m * 0.5);
    const r = fR.hp.process(fR.lp2.process(fR.lp.process(nr.brownN())) * a * 1.6 + fR.bp.process(nr.pink()) * m * 0.5);
    return [l, r];
  };
};
const crackleGen = (seed, rate) => (nl) => {
  const r = new Rng(seed);
  const bpL = new Biquad('bandpass', 3500, 1.6), bpR = new Biquad('bandpass', 3500, 1.6);
  const popL = new Biquad('bandpass', 1100, 1.4), popR = new Biquad('bandpass', 1100, 1.4);
  const events = [];
  return () => {
    if (r.next() < rate / SR) {
      const [gl, gr] = panGains(r.range(-0.8, 0.8));
      events.push({ age: 0, a: r.range(0.1, 1) ** 2, tau: r.range(0.0008, 0.0025), pop: r.next() < 0.18, gl, gr });
    }
    let cl = 0, cr = 0, pl = 0, pr = 0;
    for (let k = events.length - 1; k >= 0; k--) {
      const e = events[k];
      const x = nl.white() * e.a * Math.exp(-e.age / (e.tau * SR)) * Math.min(1, e.age / 6 + 0.2);
      if (e.pop) { pl += x * e.gl; pr += x * e.gr; } else { cl += x * e.gl; cr += x * e.gr; }
      if (++e.age > e.tau * 8 * SR) events.splice(k, 1);
    }
    return [(bpL.process(cl) + popL.process(pl)) * 2.5, (bpR.process(cr) + popR.process(pr)) * 2.5];
  };
};
// Voices without words: noise and a buzz shaped by moving vowel formants, pulsed at syllable rate.
const VOWELS = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [440, 1020], [660, 1720]];
const murmurGen = (seed, { voices = 6, bright = 1, lp = 2400 } = {}) => (nl, nr) => {
  const r = new Rng(seed);
  const vs = Array.from({ length: voices }, (_, k) => ({
    saw: new Saw(r.next()), f0: r.range(95, 210) * (k % 3 === 2 ? 1.6 : 1), rate: r.range(3.6, 5.6), off: r.next() * 10,
    talk: wobble(`${seed}t${k}`, [0.11, 0.23, 0.37]), vow: r.next() * 6, f1: new Biquad('bandpass', 700, 5), f2: new Biquad('bandpass', 1200, 7),
    gains: panGains(r.range(-0.8, 0.8)), syl: wobble(`${seed}s${k}`, [0.7, 1.3]),
  }));
  const lpL = new Biquad('lowpass', lp, 0.7), lpR = new Biquad('lowpass', lp, 0.7);
  return (t, i) => {
    let l = 0, rr = 0;
    for (const v of vs) {
      const sylPh = (t * v.rate + v.off) % 1;
      const on = Math.max(0, v.talk(t) + 0.25) * Math.sin(Math.PI * sylPh) ** 1.5;
      if ((i & 63) === 0) {
        const k = Math.floor((t * v.rate + v.off) % 6), [a, b2] = VOWELS[(k + Math.floor(v.vow)) % 6];
        v.f1.set('bandpass', a * bright, 5);
        v.f2.set('bandpass', b2 * bright, 7);
      }
      const src = v.saw.next(v.f0 * (1 + 0.06 * v.syl(t))) * 0.6 + nl.white() * 0.25;
      const y = (v.f1.process(src) + 0.6 * v.f2.process(src)) * on;
      l += y * v.gains[0];
      rr += y * v.gains[1];
    }
    return [lpL.process(l) * 1.4, lpR.process(rr) * 1.4];
  };
};
function laugh(bus, t, seed, gain = 0.08) {
  // a short "ha-ha-ha" texture without words: a buzzy vowel pulsed 5 times a second, falling in pitch
  const r = new Rng(`laugh${seed}`), saw = new Saw(r.next()), nz = new Noise(`laughn${seed}`);
  const f1 = new Biquad('bandpass', 780, 5), f2 = new Biquad('bandpass', 1250, 7);
  const n = 3 + Math.floor(r.next() * 4), rate = r.range(4.6, 6.2), f0 = r.range(150, 280), pan = r.range(-0.75, 0.75);
  oneShot(bus, t, n / rate + 0.1, pan, (tt) => {
    const ph = (tt * rate) % 1, k = Math.floor(tt * rate);
    const on = k < n ? Math.sin(Math.PI * Math.min(1, ph / 0.75)) ** 2 * (1 - 0.12 * k) : 0;
    const src = saw.next(f0 * (1 - 0.05 * k)) * 0.7 + nz.white() * 0.45;
    return (f1.process(src) + 0.6 * f2.process(src)) * on * gain;
  });
}
const roomToneGen = () => (nl, nr) => {
  const lpL = new Biquad('lowpass', 160, 0.7), lpR = new Biquad('lowpass', 160, 0.7);
  return () => [lpL.process(nl.brownN()) * 1.2, lpR.process(nr.brownN()) * 1.2];
};

// ---------- placement ----------
export function renderSfx(b, tl) {
  const pre = Math.round((b.total - b.loopOut) * 1000) / 1000;
  const T = b.total;
  const beds = new Bus(T, pre), hits = new Bus(T, pre);
  const norm = (s) => s.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
  const w = (sid, text, nth = 0) => tl.words.filter((x) => x.sid === sid && norm(x.text) === text)[nth].start;

  // ---- the night garden (S1 from the pre-roll, S9–S11, faint in S12–S13, back at the end for the loop) ----
  const garden = curve([
    [-pre, 1], [b.s2 - 0.1, 1], [b.s2 + 0.3, 0], [b.s9 - 0.4, 0], [b.s9 + 0.5, 1], [b.kissLean - 0.3, 0.8], [b.kissLean + 0.4, 0.05],
    [b.friendWord + 0.4, 0.05], [b.friendWord + 1.8, 0.25], [b.keyChange, 0.25], [b.s13 + 1.5, 0.3], [b.s14 - 0.2, 0.0],
    [b.loopOut - 1.2, 0.0], [T, 1],
  ]);
  bed(beds, -pre, T, (t) => 0.05 * garden(t), 'crickets', cricketsGen('crickets'));
  bed(beds, -pre, T, (t) => 0.05 * garden(t), 'leaves', leavesGen('leaves'));
  const torches = curve([
    [-pre, 1], [b.s2 - 0.1, 1], [b.s2 + 0.25, 0], [b.s9, 0], [w('09', 'crowd'), 0.6], [b.swordsUp, 1], [b.kissLean - 0.3, 0.8],
    [b.kissLean + 0.4, 0.04], [b.friendWord, 0.04], [b.friendWord + 0.6, 0], [b.s12, 0], [b.s12 + 0.4, 0.35], [b.s13, 0.2], [b.s13 + 0.8, 0],
    [b.loopOut - 0.8, 0], [T, 1],
  ]);
  bed(beds, -pre, T, (t) => 0.07 * torches(t), 'torch-roar', roarGen('torch'));
  bed(beds, -pre, T, (t) => 0.035 * torches(t), 'torch-crackle', crackleGen('torch-crackle', 30));

  // ---- S1 heartbeat under the slow-motion kiss; S10 heartbeat when everything else falls silent ----
  b.heart.forEach((t) => heartbeat(hits, t, t < b.s2 ? 0.34 : 0.42));
  cloth(hits, b.kissTouch - 0.5, 0.7, { gain: 0.05, fc: 1300, seed: 'kiss1' });

  // ---- S2 the rewind: a reversed whoosh and tape chatter that stop dead on the landing ----
  whoosh(hits, b.rewindLand, { pre: b.rewindLand - b.rewindStart, post: 0.2, f0: 400, fPeak: 3200, f1: 600, gain: 0.36, panFrom: 0.6, panTo: -0.6, body: 0.7, seed: 'rewind-w', reverse: true });
  tapeRewind(hits, b.rewindStart + 0.05, b.rewindLand - b.rewindStart - 0.1, 0.22);
  softThud(hits, b.rewindLand, 0.22, 70);

  // ---- the upper room: lamps and a soft murmur of voices without words (S2–S5, faint in S12) ----
  const room = curve([
    [b.rewindLand - 0.1, 0], [b.rewindLand + 0.3, 1], [b.s3 + 1, 0.85], [b.s4, 0.6], [b.s5, 0.35], [b.s6 - 0.2, 0.3], [b.s6 + 0.2, 0],
    [b.s12, 0], [b.s12 + 0.4, 0.35], [b.s13 - 0.2, 0.2], [b.s13 + 0.3, 0],
  ]);
  bed(beds, b.rewindLand - 0.2, b.s13 + 0.4, (t) => 0.035 * room(t), 'murmur', murmurGen('murmur', { voices: 6, lp: 1600 }));
  bed(beds, b.rewindLand - 0.2, b.s13 + 0.4, (t) => 0.03 * room(t), 'lamps', crackleGen('lamp-crackle', 9));
  bed(beds, b.rewindLand - 0.2, b.s13 + 0.4, (t) => 0.05 * room(t), 'room-tone', roomToneGen());

  // ---- S3 the towel and the water ----
  cloth(hits, b.jesusRise + 0.1, 0.6, { gain: 0.08, fc: 1200, seed: 'rise' });
  cloth(hits, b.robeOff, 0.75, { gain: 0.12, fc: 1400, rate: 16, seed: 'robe' });
  cloth(hits, b.towelTie, 0.6, { gain: 0.1, fc: 2000, rate: 18, seed: 'towel' });
  pour(hits, b.pourStart, b.pourEnd, 0.2);
  softThud(hits, b.kneel, 0.12, 80);
  splash(hits, b.washStart + 0.05, 0.13, 0.5, 'w1');
  splash(hits, b.washStart + 0.8, 0.1, 0.45, 'w2');
  [11.35, 11.62, 12.0].forEach((t, k) => drip(hits, t, 0.12, -0.1 + 0.1 * k, `s3${k}`));
  cloth(hits, 11.45, 0.5, { gain: 0.06, fc: 1800, seed: 'wipe' });

  // ---- S4 the twelve dots: a soft tick each; the 12th is darker with a tiny coin "ting" ----
  b.dots.slice(0, 11).forEach((t, k) => tick(hits, t, 0.1, 2200 + 60 * k, -0.3 + 0.06 * k));
  tick(hits, b.dots[11], 0.12, 1300, 0.35);
  coinClink(hits, b.dots[11] + 0.03, 'dot', 0.08, 0.35);
  splash(hits, b.peterStation + 0.1, 0.08, 0.3, 'p');
  splash(hits, b.johnStation + 0.1, 0.08, 0.3, 'j');

  // ---- S5 Judas: a drip at the touch, a cloth flinch, the pouch's glint ----
  splash(hits, b.touch, 0.1, 0.35, 'jt');
  cloth(hits, b.touch + 0.06, 0.3, { gain: 0.08, fc: 1500, rate: 22, seed: 'flinch' });
  sparkle(hits, b.pouchGlint, b.pouchGlint + 0.3, 3, 'glint', 0.05);
  drip(hits, b.lookUp + 0.3, 0.1, 0.1, 'j1');
  drip(hits, b.betray + 0.4, 0.09, -0.1, 'j2');

  // ---- S6 the deal: a dim room; one bright clink per coin into the palm ----
  bed(beds, b.s6 - 0.1, b.s7 + 0.2, curve([[b.s6 - 0.1, 0], [b.s6 + 0.3, 0.06], [b.s7 - 0.3, 0.06], [b.s7 + 0.2, 0]]), 'deal-tone', roomToneGen());
  whoosh(hits, b.s6 + 0.05, { pre: 0.35, post: 0.4, f0: 900, fPeak: 2600, f1: 700, gain: 0.08, body: 0.2, panFrom: -0.3, panTo: 0.3, seed: 'flash' });
  b.coins.forEach((t, k) => coinClink(hits, t, k, 0.11 + 0.04 * (k / 29), -0.15 + 0.3 * ((k * 7) % 5) / 4, k < 3 ? 1.4 : 1.8));
  metal(hits, b.silver, { base: 2500, decay: 0.3, gain: 0.12, seed: 'last-coin' });

  // ---- S7 the coins fly onto the scale; the chain drops; the scale settles level on "slave" ----
  whoosh(hits, b.coinsFly + 0.3, { pre: 0.3, post: 0.4, f0: 800, fPeak: 3800, f1: 1400, gain: 0.1, body: 0.2, panFrom: -0.5, panTo: 0.3, seed: 'coins-fly' });
  b.coinLand.forEach((t, k) => coinClink(hits, t, `l${k}`, 0.06 + 0.03 * ((k * 5) % 3) / 2, -0.25, 2.2));
  creak(hits, b.coinsLanded - 0.2, 0.9, { gain: 0.06, seed: 'tip' });
  softThud(hits, b.coinsLanded, 0.14, 70);
  chainRattle(hits, b.chainDrop, b.chainLand - b.chainDrop + 0.1, 0.12, 'chain-drop');
  heavyClank(hits, b.chainLand, 0.3);
  creak(hits, b.chainLand + 0.05, b.scaleLevel - b.chainLand + 0.35, { gain: 0.08, f0: 14, f1: 32, seed: 'settle' });
  softThud(hits, b.scaleLevel, 0.26, 54);
  chainRattle(hits, b.scaleLevel, 0.3, 0.05, 'chain-settle');

  // ---- S8 one long spinning coin that wobbles and drops flat ----
  coinSpin(hits, b.spinStart, b.wobble, b.coinFlat, 0.22);

  // ---- S9 the crowd comes: distant footsteps, staves and an odd metal clink ----
  const r9 = new Rng('crowd');
  for (let t = b.s9 + 0.8, k = 0; t < b.kissLean - 0.4; t += r9.range(0.09, 0.2), k++) {
    const near = clamp((t - b.s9) / (b.s10 - b.s9), 0, 1);
    footstepEarth(hits, t, `c${k}`, (0.05 + 0.08 * near) * r9.range(0.5, 1), r9.range(-0.6, 0.6));
  }
  [35.9, 36.8, 37.5].forEach((t, k) => metal(hits, t, { base: 1700 + 300 * k, decay: 0.08, gain: 0.04, pan: 0.3 - 0.3 * k, seed: `sw${k}` }));
  [36.3, 37.1].forEach((t) => softThud(hits, t, 0.06, 120));

  // ---- S10 Judas walks up; cloth as he leans in; then only the heartbeat ----
  b.steps.judas.forEach((t, k) => footstepEarth(hits, t, `j${k}`, 0.24, 0.05));
  cloth(hits, b.kissLean, 0.9, { gain: 0.07, fc: 1300, rate: 10, seed: 'lean' });

  // ---- S11 friend: gold dust shimmer as the word appears ----
  sparkle(hits, b.friendWord + 0.15, b.friendWord + 2.2, 7, 'friend-dust', 0.035);
  air(hits, b.friendWord, b.friendWord + 1.2, b.friendWord + 3.4, 0.006, 'friend-air');

  // ---- S12 the split-screen slide ----
  whoosh(hits, b.s12 + 0.3, { pre: 0.3, post: 0.35, f0: 500, fPeak: 2000, f1: 500, gain: 0.08, body: 0.3, panFrom: 0.5, panTo: -0.5, seed: 'split' });
  whoosh(hits, b.warmTakesOver + 0.2, { pre: 0.25, post: 0.35, f0: 500, fPeak: 1800, f1: 500, gain: 0.06, body: 0.3, panFrom: -0.4, panTo: 0.4, seed: 'warm' });

  // ---- S13 dawn: a warm rise and a few far birds ----
  air(hits, b.s13 - 0.3, b.enemies, b.enemies + 2.5, 0.01, 'rise-air', 3000, 8000);
  sparkle(hits, b.enemies, b.enemies + 1.6, 6, 'rise-glint', 0.04);
  [54.6, 55.3, 56.4, 57.2].forEach((t, k) => birdChirp(hits, t, k, 0.03));

  // ---- S14 the feast: a happy murmur, laughter without words, cups ----
  const feast = curve([[b.s14 - 0.2, 0], [b.s14 + 0.4, 1], [b.s15 - 0.3, 1], [b.s15 + 0.4, 0]]);
  bed(beds, b.s14 - 0.2, b.s15 + 0.5, (t) => 0.05 * feast(t), 'feast', murmurGen('feast', { voices: 9, bright: 1.08, lp: 3200 }));
  const r14 = new Rng('laughs');
  [b.laugh, b.laugh + 0.9, 60.3, 60.9, 61.6, b.right + 0.1, 62.6].forEach((t, k) => laugh(hits, t + r14.range(0, 0.1), k, k === 0 ? 0.08 : 0.05));
  [58.6, 61.0].forEach((t, k) => metal(hits, t, { base: 1900 + 200 * k, ratios: [1, 2.3, 3.9], decay: 0.25, gain: 0.04, pan: -0.4 + 0.8 * k, seed: `cup${k}` }));

  // ---- S15 call to action: YES/NO pops, typing taps (spaces skipped), hearts ----
  pop(hits, b.yes, 660, 0.12, -0.3);
  pop(hits, b.no, 520, 0.11, 0.3);
  [...b.commentText].forEach((ch, k) => {
    if (ch !== ' ') tap(hits, b.typingStart + k / b.typingCps, k);
  });
  for (let k = 0; k < 6; k++) heartPop(hits, b.hearts + k * 0.22, k);

  // ---- S16 the logo draws itself ----
  sparkle(hits, b.logoDraw, b.logoDraw + 1.0, 5, 'logo', 0.04);
  air(hits, b.logoDraw - 0.1, b.logoDraw + 0.5, b.logoDraw + 1.6, 0.006, 'logo-air');
  return { beds, hits, pre };
}
