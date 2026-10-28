// Sound effects, each placed on its beat from beats.mjs. Two buses so the mix can treat them differently:
// "beds" (wind, river, fire roar, crackles, whirlwind) duck hard under the voice; "hits" duck lightly.
import { SR, TAU, Bus, Rng, Noise, Sine, Biquad, curve, ahr, wobble, clamp, panGains } from './dsp.mjs';

// ---------- one-shot helpers ----------
function addMono(bus, i, y, pan) {
  if (i < 0 || i >= bus.n) return;
  const [gl, gr] = panGains(pan);
  bus.L[i] += y * gl;
  bus.R[i] += y * gr;
}

function footstep(bus, t, kind, k) {
  const r = new Rng(`step${kind}${k}`);
  const P = {
    calm: { f: 105, thud: 0.42, crunch: 0.32, fc: 1100, len: 0.16 },
    heavy: { f: 78, thud: 0.75, crunch: 0.42, fc: 900, len: 0.2 },
    light: { f: 118, thud: 0.28, crunch: 0.3, fc: 1500, len: 0.13 },
  }[kind];
  const nz = new Noise(`stepn${kind}${k}`);
  const bp = new Biquad('bandpass', P.fc * r.range(0.85, 1.15), 0.9), hp = new Biquad('highpass', 2800, 0.7);
  const thud = new Sine(0), toe = r.range(0.022, 0.04), v = r.range(0.85, 1.1);
  const pan = r.range(-0.12, 0.12), i0 = bus.index(t), len = Math.round(P.len * SR);
  for (let q = 0; q < len; q++) {
    const tt = q / SR;
    const att = Math.min(1, q / 72);
    const crunchEnv = Math.exp(-tt / 0.03) + (tt > toe ? 0.6 * Math.exp(-(tt - toe) / 0.025) : 0);
    const y = P.thud * thud.next(P.f * (1 - 0.25 * Math.min(1, tt / 0.06))) * Math.exp(-tt / 0.03)
      + P.crunch * bp.process(nz.white()) * crunchEnv
      + 0.08 * hp.process(nz.white()) * Math.exp(-tt / 0.006);
    addMono(bus, i0 + q, y * att * v * Math.min(1, (len - q) / 240), pan);
  }
}

function sparkle(bus, t0, t1, count, seed, gain) {
  // high bell partials (D major pentatonic), random onsets
  const r = new Rng(seed);
  const notes = [1174.7, 1318.5, 1480.0, 1760.0, 1975.5, 2349.3];
  for (let k = 0; k < count; k++) {
    const t = t0 + (t1 - t0) * (k / count) + r.range(0, (t1 - t0) / count);
    const f = notes[Math.floor(r.next() * notes.length)], a = gain * r.range(0.5, 1), tau = r.range(0.35, 0.8), pan = r.range(-0.7, 0.7);
    const s1 = new Sine(r.next()), s2 = new Sine(r.next());
    const i0 = bus.index(t), len = Math.round(tau * 5 * SR);
    for (let q = 0; q < len; q++) {
      const tt = q / SR;
      const env = Math.min(1, q / 96) * Math.exp(-tt / tau) * Math.min(1, (len - q) / 480);
      addMono(bus, i0 + q, a * env * (s1.next(f) + 0.25 * s2.next(f * 2.76) * Math.exp(-tt / 0.12)), pan);
    }
  }
}
function air(bus, t0, tPeak, t1, gain, seed, lo = 5000, hi = 9000) {
  // airy noise swell (shimmer body)
  const nl = new Noise(seed + 'l'), nr = new Noise(seed + 'r');
  const mk = () => [new Biquad('highpass', lo, 0.7), new Biquad('lowpass', hi, 0.7)];
  const fl = mk(), fr = mk();
  const env = curve([[t0, 0], [tPeak, 1], [t1, 0]]);
  for (let i = Math.max(0, bus.index(t0)); i < Math.min(bus.n, bus.index(t1)); i++) {
    const t = i / SR - bus.pre, a = env(t) * gain;
    let l = nl.white(), rr = nr.white();
    for (const b of fl) l = b.process(l);
    for (const b of fr) rr = b.process(rr);
    bus.L[i] += l * a;
    bus.R[i] += rr * a;
  }
}
function shimmer(bus, t0, tPeak, t1, gain, seed) {
  sparkle(bus, t0, t1 - 0.4, 14, seed, gain * 0.5);
  air(bus, t0, tPeak, t1, gain * 0.5, seed);
  // soft rising glass tone
  const s = new Sine(0), i0 = bus.index(t0), n = Math.round((t1 - t0) * SR), env = curve([[0, 0], [tPeak - t0, 1], [t1 - t0, 0]]);
  for (let q = 0; q < n; q++) {
    const tt = q / SR;
    addMono(bus, i0 + q, gain * 0.22 * env(tt) * s.next(1174.7 * 2 ** (tt / (t1 - t0))), 0);
  }
}

function whoosh(bus, tPeak, { pre = 0.6, post = 0.5, f0 = 300, fPeak = 2400, f1 = 500, gain = 0.3, panFrom = -0.6, panTo = 0.6, body = 0.6, q = 1.1, seed = 'whoosh' } = {}) {
  const t0 = tPeak - pre, t1 = tPeak + post;
  const nz = new Noise(seed), bp = new Biquad('bandpass', f0, q), lp = new Biquad('lowpass', 220, 0.7);
  for (let i = Math.max(0, bus.index(t0)); i < Math.min(bus.n, bus.index(t1)); i++) {
    const t = i / SR - bus.pre;
    const u = clamp(t < tPeak ? (t - t0) / pre : (t - tPeak) / post, 0, 1);
    const f = t < tPeak ? f0 * (fPeak / f0) ** u : fPeak * (f1 / fPeak) ** u;
    if ((i & 15) === 0) bp.set('bandpass', f, q);
    const env = t < tPeak ? u ** 2.2 : (1 - u) ** 1.6;
    const w = nz.white();
    const y = (bp.process(w) + body * lp.process(w) * 2) * env * gain;
    const pan = panFrom + (panTo - panFrom) * clamp((t - t0) / (pre + post), 0, 1);
    addMono(bus, i, y, pan);
  }
}
function boom(bus, t, { gain = 0.6, f0 = 65, f1 = 30, decay = 1.2 } = {}) {
  const s = new Sine(0), nz = new Noise(`boom${t}`), lp = new Biquad('lowpass', 150, 0.8);
  const i0 = bus.index(t), len = Math.round(decay * 2.5 * SR);
  let ph = 0;
  for (let q = 0; q < len; q++) {
    const tt = q / SR;
    ph += (f1 + (f0 - f1) * Math.exp(-tt / 0.15)) / SR;
    const env = Math.min(1, q / 96) * Math.exp(-tt / (decay * 0.4)) * Math.min(1, (len - q) / 2400);
    const y = (Math.sin(TAU * ph) + 0.5 * lp.process(nz.white()) * Math.exp(-tt / 0.06)) * env * gain;
    addMono(bus, i0 + q, y, 0);
  }
}
function stamp(bus, t) {
  // low thump + inky slap + tiny click; the impact sample sits exactly on t
  const nz = new Noise('stamp'), bp = new Biquad('bandpass', 1500, 1.0), body = new Biquad('bandpass', 260, 1.2), hp = new Biquad('highpass', 4500, 0.7);
  const s = new Sine(0), i0 = bus.index(t), len = Math.round(0.5 * SR);
  for (let q = -24; q < len; q++) {
    const tt = Math.max(0, q / SR);
    const att = q < 0 ? (q + 24) / 24 : 1;
    const w = nz.white();
    const y = 0.8 * s.next(88 * (1 - 0.3 * Math.min(1, tt / 0.1))) * Math.exp(-tt / 0.07)
      + 0.55 * bp.process(w) * Math.exp(-tt / 0.012)
      + 0.45 * body.process(w) * Math.exp(-tt / 0.03)
      + 0.12 * hp.process(w) * Math.exp(-tt / 0.0015);
    addMono(bus, i0 + q, y * att * Math.min(1, (len - q) / 960), 0);
  }
}
function rewindSweep(bus, t0, dur) {
  // tape rewind: chattering tone sweeping up + a noise sweep falling, then cut cleanly
  const nz = new Noise('rewind'), bp = new Biquad('bandpass', 3000, 1.5), bpt = new Biquad('bandpass', 800, 4);
  let ph = 0;
  const i0 = bus.index(t0), n = Math.round(dur * SR);
  for (let q = 0; q < n; q++) {
    const u = q / n;
    if ((q & 15) === 0) {
      bp.set('bandpass', 3200 * 0.25 ** u, 1.5);
      bpt.set('bandpass', 500 * 6 ** u, 4);
    }
    ph += (300 * 10 ** u) / SR;
    const chatter = 0.6 + 0.4 * Math.sin(TAU * 42 * q / SR);
    const tone = bpt.process(2 * (ph % 1) - 1) * chatter;
    const env = Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.7 * Math.min(1, (n - q) / 240) * Math.min(1, q / 240);
    addMono(bus, i0 + q, (0.5 * bp.process(nz.white()) + 0.55 * tone) * env * 0.5, -0.4 + 0.8 * u);
  }
}
function flutter(bus, t0, t1, { rate = 11, gain = 0.2, panFrom = 0, panTo = 0, swell = null, fc = 1100, seed = 'flutter' } = {}) {
  // cloth flaps: short noise bursts at irregular intervals plus a soft whoosh body
  const r = new Rng(seed), nz = new Noise(seed), bp = new Biquad('bandpass', fc, 0.8), lp = new Biquad('lowpass', 400, 0.7);
  const env = swell || (() => 1);
  let next = t0, flapT = -1, flapA = 0;
  for (let i = Math.max(0, bus.index(t0)); i < Math.min(bus.n, bus.index(t1)); i++) {
    const t = i / SR - bus.pre;
    if (t >= next) {
      flapT = t;
      flapA = r.range(0.5, 1);
      next = t + (1 / rate) * r.range(0.6, 1.5);
    }
    const ft = t - flapT;
    const flap = flapA * Math.min(1, ft / 0.004) * Math.exp(-ft / 0.035);
    const w = nz.white();
    const edge = Math.min(1, (t - t0) / 0.05, (t1 - t) / 0.08);
    const y = (bp.process(w) * flap + 0.35 * lp.process(w)) * env(t) * gain * edge;
    addMono(bus, i, y, panFrom + (panTo - panFrom) * (t - t0) / (t1 - t0));
  }
}
function softThud(bus, t, gain = 0.25) {
  const nz = new Noise(`thud${t}`), lp = new Biquad('lowpass', 220, 0.7), s = new Sine(0);
  const i0 = bus.index(t), len = Math.round(0.35 * SR);
  for (let q = 0; q < len; q++) {
    const tt = q / SR;
    const y = (0.7 * lp.process(nz.white()) * Math.exp(-tt / 0.06) + 0.6 * s.next(62) * Math.exp(-tt / 0.05)) * Math.min(1, q / 96) * Math.min(1, (len - q) / 480);
    addMono(bus, i0 + q, y * gain, 0);
  }
}
function chime(bus, t, f, gain = 0.16) {
  const s = [new Sine(0), new Sine(0.3), new Sine(0.6)], pop = new Sine(0);
  const i0 = bus.index(t), len = Math.round(2.2 * SR);
  for (let q = 0; q < len; q++) {
    const tt = q / SR;
    const bell = s[0].next(f) * Math.exp(-tt / 0.55) + 0.35 * s[1].next(f * 2.76) * Math.exp(-tt / 0.22) + 0.12 * s[2].next(f * 5.4) * Math.exp(-tt / 0.08);
    const p = pop.next(520 + 420 * Math.min(1, tt / 0.03)) * Math.exp(-tt / 0.03);
    addMono(bus, i0 + q, (bell * 0.8 + p * 0.5) * gain * Math.min(1, q / 64) * Math.min(1, (len - q) / 960), 0.15);
  }
}
function tap(bus, t, k) {
  const r = new Rng(`tap${k}`), nz = new Noise(`tapn${k}`), bp = new Biquad('bandpass', r.range(3200, 4600), 1.2), s = new Sine(0);
  const i0 = bus.index(t), len = Math.round(0.05 * SR), g = r.range(0.75, 1);
  for (let q = 0; q < len; q++) {
    const tt = q / SR;
    const y = 0.6 * bp.process(nz.white()) * Math.exp(-tt / 0.003) + 0.35 * s.next(180) * Math.exp(-tt / 0.008);
    addMono(bus, i0 + q, y * g * 0.22 * Math.min(1, q / 24) * Math.min(1, (len - q) / 96), 0.25);
  }
}
function heartPop(bus, t, k) {
  const r = new Rng(`heart${k}`), s = new Sine(0), f0 = r.range(560, 760);
  const i0 = bus.index(t), len = Math.round(0.16 * SR);
  for (let q = 0; q < len; q++) {
    const tt = q / SR;
    const y = s.next(f0 * (1 + 0.8 * Math.min(1, tt / 0.04))) * Math.exp(-tt / 0.035);
    addMono(bus, i0 + q, y * 0.16 * Math.min(1, q / 48) * Math.min(1, (len - q) / 240), r.range(-0.2, 0.5));
  }
}

// ---------- continuous beds ----------
function bed(bus, t0, t1, level, seed, build) {
  // build(rngNoiseL, rngNoiseR) returns a per-sample generator (t) => [l, r]
  const gen = build(new Noise(seed + 'L'), new Noise(seed + 'R'));
  for (let i = Math.max(0, bus.index(t0)); i < Math.min(bus.n, bus.index(t1)); i++) {
    const t = i / SR - bus.pre;
    const a = level(t);
    const [l, r] = gen(t, i);
    bus.L[i] += l * a;
    bus.R[i] += r * a;
  }
}
const windGen = (seed, lo = 250, hi = 700, whistle = 0.15) => (nl, nr) => {
  const mk = () => ({ bp: new Biquad('bandpass', 400, 0.8), wh: new Biquad('bandpass', 1400, 3), hp: new Biquad('highpass', 90, 0.7) });
  const fL = mk(), fR = mk();
  const sweep = wobble(seed + 's', [0.05, 0.13, 0.21]), gust = wobble(seed + 'g', [0.07, 0.17, 0.31]);
  return (t, i) => {
    if ((i & 63) === 0) {
      const u = 0.5 + 0.5 * sweep(t);
      for (const f of [fL, fR]) {
        f.bp.set('bandpass', lo + (hi - lo) * u, 0.8);
        f.wh.set('bandpass', 1100 + 700 * u, 3);
      }
    }
    const g = 0.7 + 0.3 * gust(t);
    const l = fL.hp.process(fL.bp.process(nl.pink()) + whistle * fL.wh.process(nl.pink()));
    const r = fR.hp.process(fR.bp.process(nr.pink()) + whistle * fR.wh.process(nr.pink()));
    return [l * g * 3, r * g * 3];
  };
};
const riverGen = (seed) => (nl, nr) => {
  const r = new Rng(seed), lpL = new Biquad('lowpass', 1200, 0.7), lpR = new Biquad('lowpass', 1200, 0.7);
  const hpL = new Biquad('highpass', 150, 0.7), hpR = new Biquad('highpass', 150, 0.7);
  const bubbles = [];
  const wob = wobble(seed + 'w', [0.21, 0.37]);
  return (t, i) => {
    if (r.next() < 26 / SR) bubbles.push({ s: new Sine(0), f: r.range(480, 1400), age: 0, a: r.range(0.1, 0.4), tau: r.range(0.007, 0.016), pan: r.range(-0.8, 0.8) });
    let bl = 0, br = 0;
    for (let k = bubbles.length - 1; k >= 0; k--) {
      const b = bubbles[k];
      const tt = b.age / SR;
      const y = b.s.next(b.f * (1 + 0.5 * Math.min(1, tt / 0.015))) * b.a * Math.exp(-tt / b.tau) * Math.min(1, b.age / 24);
      const [gl, gr] = panGains(b.pan);
      bl += y * gl;
      br += y * gr;
      if (++b.age > b.tau * 6 * SR) bubbles.splice(k, 1);
    }
    const g = 0.85 + 0.15 * wob(t);
    return [(hpL.process(lpL.process(nl.pink())) * 2.2 + bl * 0.5) * g, (hpR.process(lpR.process(nr.pink())) * 2.2 + br * 0.5) * g];
  };
};
const roarGen = (seed, slow = false) => (nl, nr) => {
  const lo = slow ? 170 : 300, mid = slow ? 380 : 750;
  const mk = () => ({ lp: new Biquad('lowpass', lo, 0.7), lp2: new Biquad('lowpass', lo, 0.9), bp: new Biquad('bandpass', mid, 0.7), hp: new Biquad('highpass', 35, 0.7) });
  const fL = mk(), fR = mk();
  const turb = wobble(seed + 't', slow ? [3.1, 5.3, 7.9] : [7.3, 11.1, 17.9, 23.3]);
  const flick = wobble(seed + 'f', slow ? [2.1, 3.7] : [5.7, 9.3, 13.1]);
  return (t) => {
    const a = 0.75 + 0.25 * turb(t), m = 0.6 + 0.4 * flick(t);
    const l = fL.hp.process(fL.lp2.process(fL.lp.process(nl.brownN())) * a * 1.6 + fL.bp.process(nl.pink()) * m * 0.55);
    const r = fR.hp.process(fR.lp2.process(fR.lp.process(nr.brownN())) * a * 1.6 + fR.bp.process(nr.pink()) * m * 0.55);
    return [l, r];
  };
};
const crackleGen = (seed, rate) => (nl) => {
  // sum each event's excitation per channel first, then run one filter per channel (shared state stays valid)
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
const howlGen = (seed, tStart, tPeak) => (nl, nr) => {
  // resonant whirlwind howl rising in pitch + swirling low rumble that circles left/right
  const mkBank = () => [new Biquad('bandpass', 220, 9), new Biquad('bandpass', 330, 10), new Biquad('bandpass', 450, 12)];
  const bL = mkBank(), bR = mkBank();
  const lpL = new Biquad('lowpass', 130, 0.8), lpR = new Biquad('lowpass', 130, 0.8);
  const wob = wobble(seed + 'w', [0.6, 1.3, 2.1]);
  let rot = 0;
  return (t, i) => {
    const u = clamp((t - tStart) / (tPeak - tStart), 0, 1.2);
    if ((i & 31) === 0) {
      const v = 1 + 0.08 * wob(t), up = 1 + 1.35 * u;
      [220, 330, 450].forEach((f, k) => {
        bL[k].set('bandpass', f * up * v, 9 + k);
        bR[k].set('bandpass', f * up * v * 1.02, 9 + k);
      });
    }
    rot += (0.3 + 0.9 * u) / SR;
    const pL = nl.pink(), pR = nr.pink();
    let hl = 0, hr = 0;
    for (let k = 0; k < 3; k++) {
      hl += bL[k].process(pL) * (1 - 0.25 * k);
      hr += bR[k].process(pR) * (1 - 0.25 * k);
    }
    const rumble = lpL.process(nl.brownN()) * 1.6, rumble2 = lpR.process(nr.brownN()) * 1.6;
    const sw = Math.sin(TAU * rot);
    return [hl * 2.4 + rumble * (0.75 + 0.25 * sw), hr * 2.4 + rumble2 * (0.75 - 0.25 * sw)];
  };
};

// ---------- placement ----------
export function renderSfx(b, tl) {
  const pre = Math.round((b.total - b.loopOut) * 1000) / 1000;
  const T = b.total;
  const beds = new Bus(T, pre), hits = new Bus(T, pre);
  const frz = b.freeze, burst = b.chariotBurst;

  // S1 hook: whirlwind already raging (starts in the pre-roll so the loop seam is continuous)
  const hookLvl = curve([[-pre, 0.5], [0, 0.5], [b.cloakWipe, 0.42], [b.s2 + 0.35, 0.0], [T, 0]]);
  bed(beds, -pre, b.s2 + 0.4, hookLvl, 'whirl-hook', howlGen('whirl-hook', -pre - 1.5, 3.0));
  flutter(hits, b.cloakPass - 0.45, b.cloakPass + 0.5, { rate: 13, gain: 0.32, panFrom: -0.5, panTo: 0.6, swell: curve([[b.cloakPass - 0.45, 0.2], [b.cloakPass, 1], [b.cloakPass + 0.5, 0.15]]), seed: 'pass' });
  flutter(hits, b.cloakWipe - 0.25, b.s2 + 0.2, { rate: 9, gain: 0.34, panFrom: 0.4, panTo: -0.3, swell: curve([[b.cloakWipe - 0.25, 0.3], [b.cloakWipe + 0.15, 1], [b.s2 + 0.2, 0.2]]), fc: 800, seed: 'wipe' });
  whoosh(hits, b.cloakWipe + 0.12, { pre: 0.35, post: 0.3, f0: 250, fPeak: 1600, f1: 300, gain: 0.18, panFrom: 0.5, panTo: -0.5, seed: 'wipe-w' });

  // S2 Enoch: calm steps that simply stop; a light shimmer as he is taken; badge chime
  b.steps.enoch.forEach((t, k) => footstep(hits, t, 'calm', k));
  shimmer(hits, b.enochVanish - 0.45, b.enochVanish + 0.15, b.enochVanish + 2.6, 0.16, 'enoch-shimmer');
  chime(hits, b.badge1, 880, 0.14);
  air(beds, b.s2, b.s2 + 2, b.s3, 0.012, 'hill-air', 2500, 6000);

  // S3–S4 Jordan: river + wind; heavy Elijah steps, light Elisha steps
  const jordanLvl = curve([[b.s3 - 0.3, 0], [b.s3 + 0.6, 1], [frz - 0.002, 1], [frz + 0.025, 0]]);
  bed(beds, b.s3 - 0.3, frz + 0.03, (t) => 0.1 * jordanLvl(t), 'river', riverGen('river'));
  const windLvl = curve([[b.s3 - 0.3, 0], [b.s3 + 0.6, 0.09], [b.suddenly, 0.09], [burst - 0.1, 0.3], [burst + 0.6, 0.16], [frz - 0.002, 0.16], [frz + 0.025, 0]]);
  bed(beds, b.s3 - 0.3, frz + 0.03, windLvl, 'jordan-wind', windGen('jordan-wind'));
  b.steps.elijah.forEach((t, k) => footstep(hits, t, 'heavy', k));
  b.steps.elisha.forEach((t, k) => footstep(hits, t, 'light', k));

  // S4 chariot: whoosh into the burst, boom, fire roar, hooves, crackles — hard stop at the freeze
  whoosh(hits, burst, { pre: 0.75, post: 0.7, f0: 220, fPeak: 2600, f1: 350, gain: 0.5, panFrom: -0.9, panTo: 0.7, body: 0.9, seed: 'burst' });
  boom(hits, burst, { gain: 0.75, f0: 70, f1: 28, decay: 1.4 });
  const roarLvl = curve([[burst - 0.1, 0], [burst + 0.08, 0.55], [burst + 1.0, 0.42], [frz - 0.002, 0.45], [frz + 0.025, 0]]);
  bed(beds, burst - 0.1, frz + 0.03, roarLvl, 'roar', roarGen('roar'));
  bed(beds, burst, frz + 0.03, (t) => 0.06 * roarLvl(t) / 0.55, 'crackle', crackleGen('crackle', 45));
  const stride = 0.45;
  for (const [off, pan, g] of [[0, -0.35, 1], [0.21, 0.4, 0.8]]) {
    for (let t = burst + 0.15 + off, k = 0; t < frz - 0.05; t += stride, k++) {
      [0, 0.085, 0.17].forEach((o, j) => {
        const ht = t + o;
        if (ht >= frz - 0.03) return;
        hoof(hits, ht, g * [0.7, 0.8, 1][j], pan, `${off}-${k}-${j}`, false);
      });
    }
  }

  // S5 myth picture + stamp + rewind
  whoosh(hits, b.mythIn + 0.2, { pre: 0.25, post: 0.3, f0: 1200, fPeak: 3600, f1: 1500, gain: 0.07, body: 0.15, panFrom: -0.3, panTo: 0.2, q: 0.9, seed: 'paper' });
  stamp(hits, b.redX);
  rewindSweep(hits, b.rewind, 0.3);

  // S6 slowed, low-passed roar for the replay; whirlwind howl rising to "heaven"
  const slowLvl = curve([[b.replay - 0.05, 0], [b.replay + 0.5, 0.42], [b.stormGather - 0.3, 0.38], [b.stormGather + 0.35, 0]]);
  bed(beds, b.replay - 0.05, b.stormGather + 0.4, slowLvl, 'roar-slow', roarGen('roar-slow', true));
  for (let t = b.replay + 0.4, k = 0; t < b.stormGather - 0.4; t += 0.9, k++) {
    [0, 0.17, 0.34].forEach((o, j) => hoof(hits, t + o, 0.55 * [0.7, 0.8, 1][j], -0.2, `slow-${k}-${j}`, true));
  }
  const howlLvl = curve([[b.stormGather - 0.2, 0], [b.liftOff, 0.25], [b.whirlwindFull, 0.42], [b.heaven, 0.62], [b.heaven + 0.7, 0.5], [b.s7, 0.12], [b.s7 + 0.6, 0]]);
  bed(beds, b.stormGather - 0.2, b.s7 + 0.65, howlLvl, 'whirl', howlGen('whirl', b.stormGather, b.heaven));
  flutter(hits, b.cloakSlip - 0.1, b.cloakSlip + 0.6, { rate: 12, gain: 0.12, swell: curve([[b.cloakSlip - 0.1, 0.3], [b.cloakSlip + 0.15, 1], [b.cloakSlip + 0.6, 0]]), seed: 'slip' });
  chime(hits, b.badge2, 880, 0.12);

  // S7 softer wind, near silence while the cloak falls; flutter + soft landing; light shimmer into S8
  const s7Wind = curve([[b.s7 - 0.4, 0], [b.s7 + 0.8, 0.07], [b.cloakFloat - 0.4, 0.06], [b.cloakFloat + 0.3, 0.02], [b.cloakLand, 0.02], [b.s8 - 0.3, 0.035], [b.s8 + 0.4, 0]]);
  bed(beds, b.s7 - 0.4, b.s8 + 0.45, s7Wind, 's7-wind', windGen('s7-wind', 200, 520, 0.08));
  flutter(hits, b.cloakFloat, b.cloakLand, { rate: 5.5, gain: 0.1, fc: 900, panFrom: 0.3, panTo: -0.1, swell: curve([[b.cloakFloat, 0.4], [b.cloakFloat + 0.6, 1], [b.cloakLand - 0.3, 0.55], [b.cloakLand, 0.2]]), seed: 'fall' });
  softThud(hits, b.cloakLand, 0.2);
  shimmer(hits, b.lightGrows, b.s8 + 0.05, b.s8 + 1.6, 0.14, 's8-shimmer');

  // S10 typing taps (one per character, spaces skipped) and soft heart pops
  [...b.commentText].forEach((ch, k) => {
    if (ch !== ' ') tap(hits, b.typingStart + k / b.typingCps, k);
  });
  for (let k = 0; k < 6; k++) heartPop(hits, b.hearts + k * 0.24, k);

  // S11 loop-out: the opening whirlwind pre-roll is moved here by the mixer, so nothing to add.
  return { beds, hits, pre };
}

function hoof(bus, t, g, pan, seed, slow) {
  const r = new Rng(`hoof${seed}`), s = new Sine(0), nz = new Noise(`hoofn${seed}`), bp = new Biquad('bandpass', slow ? 700 : 1300, 1.0);
  const lp = new Biquad('lowpass', slow ? 900 : 4000, 0.7);
  const f0 = slow ? 70 : 105, f1 = slow ? 40 : 62, dec = slow ? 0.07 : 0.045;
  const i0 = bus.index(t), len = Math.round((slow ? 0.3 : 0.18) * SR), v = r.range(0.85, 1.1);
  let ph = 0;
  for (let q = 0; q < len; q++) {
    const tt = q / SR;
    ph += (f1 + (f0 - f1) * Math.exp(-tt / 0.02)) / SR;
    const y = Math.sin(TAU * ph) * Math.exp(-tt / dec) + 0.3 * bp.process(nz.white()) * Math.exp(-tt / 0.01);
    addMono(bus, i0 + q, lp.process(y) * g * v * 0.42 * Math.min(1, q / 48) * Math.min(1, (len - q) / 240), pan);
  }
}
