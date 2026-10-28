// Sound effects for "The Face of God", each placed on its beat from src/beats.mjs. Two buses so the mix
// can treat them differently: "beds" (storm wind and rain, the sea, fire, camp murmur, room, breeze) duck
// hard under the voice; "hits" (thunder, whooshes, steps, gasps, chimes, taps) duck lightly.
// Deterministic: seeded noise only.
import { SR, TAU, Bus, Rng, Noise, Sine, Saw, Biquad, curve, wobble, clamp, panGains } from './dsp.mjs';
import { noiseShape } from './instruments.mjs';

// ---------- one-shot helpers ----------
function addMono(bus, i, y, pan) {
  if (i < 0 || i >= bus.n) return;
  const [gl, gr] = panGains(pan);
  bus.L[i] += y * gl;
  bus.R[i] += y * gr;
}
function oneShot(bus, t, len, pan, g) {
  const i0 = bus.index(t), n = Math.round(len * SR), e = Math.min(240, n >> 2);
  for (let q = 0; q < n; q++) addMono(bus, i0 + q, g(q / SR, q) * Math.min(1, q / 24, (n - q) / e), pan);
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
function tick(bus, t, gain = 0.12, f = 2400, pan = 0) {
  const s = new Sine(0), nz = new Noise(`tick${t}`), hp = new Biquad('highpass', 3000, 0.7);
  oneShot(bus, t, 0.06, pan, (tt) => (0.6 * s.next(f) * Math.exp(-tt / 0.012) + 0.4 * hp.process(nz.white()) * Math.exp(-tt / 0.003)) * gain);
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
function bed(bus, t0, t1, level, seed, build) {
  const gen = build(new Noise(seed + 'L'), new Noise(seed + 'R'));
  for (let i = Math.max(0, bus.index(t0)); i < Math.min(bus.n, bus.index(t1)); i++) {
    const t = i / SR - bus.pre, a = level(t);
    const [l, r] = gen(t, i);
    bus.L[i] += l * a;
    bus.R[i] += r * a;
  }
}
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
const roomToneGen = () => (nl, nr) => {
  const lpL = new Biquad('lowpass', 160, 0.7), lpR = new Biquad('lowpass', 160, 0.7);
  return () => [lpL.process(nl.brownN()) * 1.2, lpR.process(nr.brownN()) * 1.2];
};

// ---------- the storm ----------
function thunder(bus, t, { gain = 0.5, crack = 1, len = 3.4, seed = 'th' } = {}) {
  const r = new Rng(seed);
  if (crack > 0) {
    // the crack overhead: a sharp bright tear of noise
    const nz = new Noise(seed + 'c'), hp = new Biquad('highpass', 900, 0.7), bp = new Biquad('bandpass', 2300, 0.8);
    oneShot(bus, t, 0.4, r.range(-0.3, 0.3), (tt) => {
      const w = nz.white();
      return (hp.process(w) * 0.6 + bp.process(w) * 0.7) * Math.min(1, tt / 0.002) * (Math.exp(-tt / 0.04) + 0.25 * Math.exp(-tt / 0.15)) * gain * crack;
    });
  }
  // the rumble: a few rolling swells of low noise
  const mk = () => [new Biquad('lowpass', 240, 0.7), new Biquad('lowpass', 170, 0.9), new Biquad('highpass', 26, 0.7)];
  const swells = Array.from({ length: 5 }, (_, k) => ({ at: 0.04 + k * r.range(0.3, 0.7), tau: r.range(0.35, 0.9), a: r.range(0.55, 1) * (1 - 0.14 * k) }));
  noiseShape(bus, t, t + len, seed + 'r', (tt) => {
    let a = 0;
    for (const s of swells) if (tt > s.at) a += s.a * Math.min(1, (tt - s.at) / 0.06) * Math.exp(-(tt - s.at) / s.tau);
    return a * gain * 3.2 * Math.min(1, (len - tt) / 0.4);
  }, { fl: mk(), fr: mk() });
}
const stormWindGen = (seed) => (nl, nr) => {
  // a howling mountain gale: low roar plus a resonant whistle that rides the gusts
  const mk = () => ({ lo: new Biquad('bandpass', 380, 0.55), howl: new Biquad('bandpass', 700, 7), hp: new Biquad('highpass', 50, 0.7), lp: new Biquad('lowpass', 2600, 0.7) });
  const fL = mk(), fR = mk(), gust = wobble(seed + 'g', [0.08, 0.19, 0.41]), hf = wobble(seed + 'h', [0.05, 0.13]);
  return (t, i) => {
    const g = 0.5 + 0.5 * gust(t);
    if ((i & 63) === 0) {
      const f = 520 + 300 * hf(t) + 380 * g;
      fL.howl.set('bandpass', f, 7);
      fR.howl.set('bandpass', f * 1.06, 7);
    }
    const l = fL.lp.process(fL.hp.process(fL.lo.process(nl.pink()) * 1.7 + fL.howl.process(nl.white()) * 0.55 * g));
    const r = fR.lp.process(fR.hp.process(fR.lo.process(nr.pink()) * 1.7 + fR.howl.process(nr.white()) * 0.55 * g));
    return [l * (0.35 + g) * 1.6, r * (0.35 + g) * 1.6];
  };
};
const rainGen = (seed) => (nl, nr) => {
  // a steady hiss with small drops ticking in it
  const mk = () => ({ hp: new Biquad('highpass', 1600, 0.7), lp: new Biquad('lowpass', 9000, 0.7), drop: new Biquad('bandpass', 4200, 2) });
  const fL = mk(), fR = mk(), am = wobble(seed + 'a', [0.17, 0.37]), r = new Rng(seed);
  let dl = 0, dr = 0;
  return (t) => {
    if (r.next() < 220 / SR) dl = r.range(0.3, 1);
    if (r.next() < 220 / SR) dr = r.range(0.3, 1);
    dl *= 0.994;
    dr *= 0.994;
    const a = 0.8 + 0.2 * am(t);
    return [
      (fL.lp.process(fL.hp.process(nl.white())) * 0.6 + fL.drop.process(nl.white()) * dl * 1.6) * a,
      (fR.lp.process(fR.hp.process(nr.white())) * 0.6 + fR.drop.process(nr.white()) * dr * 1.6) * a,
    ];
  };
};
function toneRise(bus, t0, t1, f0, f1, gain) {
  // the rising tone as the light breaks through: two sines a fifth apart, a slow shimmer, gliding up
  const a = new Sine(0), c = new Sine(0.3), d = new Sine(0.6), len = t1 - t0;
  oneShot(bus, t0, len + 0.4, 0, (tt) => {
    const u = Math.min(1, tt / len), f = f0 * (f1 / f0) ** (u * u);
    const env = Math.min(1, tt / 0.3) * (tt > len ? Math.max(0, 1 - (tt - len) / 0.4) : 1) * (0.4 + 0.6 * u);
    return (a.next(f) + 0.5 * c.next(f * 1.5) + 0.25 * d.next(f * 2.01)) * (0.85 + 0.15 * Math.sin(TAU * 7 * tt)) * env * gain;
  });
}

// ---------- the montage ----------
function croak(bus, t, seed, gain = 0.12) {
  // a frog: "rib-bit", two buzzy syllables
  const r = new Rng(`croak${seed}`), saw = new Saw(r.next()), f1 = new Biquad('bandpass', 600, 4), f2 = new Biquad('bandpass', 1500, 6);
  const f0 = r.range(120, 170), pan = r.range(-0.5, 0.5);
  oneShot(bus, t, 0.34, pan, (tt) => {
    const syl = tt < 0.12 ? Math.sin(Math.PI * tt / 0.12) : tt > 0.17 && tt < 0.32 ? Math.sin(Math.PI * (tt - 0.17) / 0.15) : 0;
    const pulse = 0.5 + 0.5 * Math.sign(Math.sin(TAU * 32 * tt));
    const src = saw.next(f0 * (tt < 0.15 ? 1 : 1.18));
    return (f1.process(src) + 0.5 * f2.process(src)) * syl * pulse * gain * 2;
  });
}
function hail(bus, t0, t1, seed, gain = 0.14) {
  // hailstones: a quick rain of hard ticks and small thuds
  const r = new Rng(`hail${seed}`);
  for (let t = t0; t < t1; t += r.range(0.008, 0.03)) {
    const u = (t - t0) / (t1 - t0);
    tick(bus, t, gain * r.range(0.3, 1) * Math.min(1, u * 5) * Math.min(1, (1 - u) * 4), r.range(1800, 4200), r.range(-0.8, 0.8));
    if (r.next() < 0.12) softThud(bus, t, gain * 0.5, r.range(90, 160));
  }
}
const seaGen = (seed) => (nl, nr) => {
  // walls of water: a deep roar with slow surges
  const mk = () => ({ lp: new Biquad('lowpass', 420, 0.7), bp: new Biquad('bandpass', 900, 0.6), hp: new Biquad('highpass', 30, 0.7) });
  const fL = mk(), fR = mk(), surge = wobble(seed + 's', [0.31, 0.53, 0.9]);
  return (t) => {
    const s = 0.65 + 0.35 * surge(t);
    return [
      fL.hp.process(fL.lp.process(nl.brownN()) * 2.4 + fL.bp.process(nl.pink()) * 0.8 * s) * s,
      fR.hp.process(fR.lp.process(nr.brownN()) * 2.4 + fR.bp.process(nr.pink()) * 0.8 * s) * s,
    ];
  };
};

// ---------- the clift, the camp, chimes ----------
function gravelStep(bus, t, k, gain = 0.3, pan = 0) {
  // a footstep on loose stones: the step plus a short crunch of gravel
  footstepEarth(bus, t, k, gain, pan);
  const r = new Rng(`grv${k}`), nz = new Noise(`grvn${k}`), bp = new Biquad('bandpass', r.range(2600, 3800), 1.2);
  let next = 0, a = 0;
  oneShot(bus, t + 0.01, 0.16, pan, (tt) => {
    if (tt >= next) { a = r.range(0.2, 1); next = tt + r.range(0.004, 0.018); }
    a *= 0.996;
    return bp.process(nz.white()) * a * Math.exp(-tt / 0.07) * gain * 0.9;
  });
}
function gasp(bus, t, seed, gain = 0.1) {
  // a sharp intake of breath with an "ah" colour, no words
  const r = new Rng(`gasp${seed}`), nz = new Noise(`gaspn${seed}`), f1 = new Biquad('bandpass', r.range(700, 900), 3), f2 = new Biquad('bandpass', r.range(1200, 1800), 4), hp = new Biquad('highpass', 400, 0.7);
  const len = r.range(0.22, 0.34), pan = r.range(-0.7, 0.7);
  oneShot(bus, t, len, pan, (tt) => {
    const u = tt / len, env = Math.min(1, tt / 0.03) * (1 - u) ** 1.4;
    const w = nz.white();
    return (f1.process(w) * 1.6 + f2.process(w) * 1.1 + hp.process(w) * 0.25) * env * gain;
  });
}
function chime(bus, t, freqs, gain = 0.06, pan = 0, tau = 0.9) {
  // small bells: each note a sine with a quick inharmonic shimmer
  freqs.forEach((f, k) => {
    const s1 = new Sine(0.1 * k), s2 = new Sine(0.37 * k);
    oneShot(bus, t + k * 0.03, tau * 5, pan + (k - (freqs.length - 1) / 2) * 0.25, (tt) =>
      (s1.next(f) + 0.3 * s2.next(f * 2.76) * Math.exp(-tt / 0.15)) * Math.exp(-tt / tau) * Math.min(1, tt / 0.003) * gain);
  });
}
function echoed(fn, delays, gains) {
  // the same sound again, quieter and later: a soft echo off the mountain
  fn(0, 1);
  delays.forEach((d, k) => fn(d, gains[k]));
}

// ---------- placement ----------
export function renderSfx(b, tl) {
  const pre = Math.round((b.total - b.loopOut) * 1000) / 1000;
  const T = b.total;
  const beds = new Bus(T, pre), hits = new Bus(T, pre);
  const norm = (s) => s.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
  const w = (sid, text, nth = 0) => tl.words.filter((x) => x.sid === sid && norm(x.text) === text)[nth].start;
  const cut = b.hardCut;

  // ---- the storm on the summit (from the pre-roll, so the loop flows into it): wind and rain; near
  // silence after the hard cut; back for the ask and the answer; muffled inside the clift ----
  const storm = curve([
    [-pre, 1], [b.swellStart, 1.1], [cut - 0.02, 1.25], [cut, 0.07], [b.s3 - 0.05, 0.07], [b.s3 + 0.05, 0], [b.s4 - 0.1, 0], [b.s4 + 0.2, 0.9],
    [b.s5, 1], [b.s6, 0.8], [b.inside, 0.55], [b.gloryRush, 0.35], [b.gloryGone, 0.3], [b.s7, 0.45], [b.dawn, 0.35], [b.dawn + 0.8, 0],
    [b.loopOut - 0.6, 0], [T, 1],
  ]);
  bed(beds, -pre, T, (t) => 0.06 * storm(t), 'gale', stormWindGen('gale'));
  const rain = curve([[-pre, 1], [cut - 0.02, 1], [cut, 0], [b.s4 - 0.1, 0], [b.s4 + 0.3, 0.8], [b.s6, 0.6], [b.inside, 0.3], [b.s7, 0.2], [b.dawn, 0], [b.loopOut - 0.6, 0], [T, 1]]);
  bed(beds, -pre, T, (t) => 0.03 * rain(t), 'rain', rainGen('rain'));
  // thunder after each flash, and the robe and beard flapping in the gusts
  [[b.lightning1, 0.55, 1], [b.lightning2, 0.42, 0.7], [b.lightning3, 0.36, 0.6], [b.lightning4, 0.4, 0.8], [b.lightning5, 0.3, 0.5], [b.lightning6, 0.36, 0.7]]
    // (a rumble that would still be going at the hard cut stops just before it)
    .forEach(([t, g, cr], k) => thunder(hits, t + 0.06, { gain: g, crack: cr, seed: `th${k}`, len: t < cut ? Math.min(3.4, cut - t - 0.09) : 3.4 }));
  [[0.05, 1.1], [1.25, 1.0], [b.s2 + 0.05, 1.1], [b.s4 + 0.1, 1.2], [w('04', 'thee'), 1.0], [b.s5 + 0.3, 0.9]].forEach(([t, d], k) =>
    cloth(hits, t, d, { gain: 0.07, rate: 24, fc: 1100, pan: -0.2 + 0.1 * k, seed: `flap${k}` }));
  // the rising tone as the light breaks through, then the swell into "you will die" that stops dead
  toneRise(hits, 0.0, b.titleOut, 196, 523, 0.035);
  whoosh(hits, cut, { pre: cut - b.swellStart, post: 0.004, f0: 200, fPeak: 3600, f1: 3600, gain: 0.3, panFrom: 0, panTo: 0, body: 0.9, seed: 'swell', reverse: true });

  // ---- S3 montage: fire, plagues, sea ----
  whoosh(hits, b.s3 + 0.12, { pre: 0.25, post: 0.6, f0: 300, fPeak: 2600, f1: 500, gain: 0.3, panFrom: -0.7, panTo: 0.4, seed: 'w-fire' });
  const fire = curve([[b.s3, 0], [b.s3 + 0.2, 0.6], [b.fire - 0.05, 0.7], [b.fire + 0.1, 1.4], [b.whipPlagues - 0.04, 1.2], [b.whipPlagues, 0]]);
  bed(beds, b.s3, b.whipPlagues, (t) => 0.1 * fire(t), 'bush-roar', roarGen('bush'));
  bed(beds, b.s3, b.whipPlagues, (t) => 0.06 * fire(t), 'bush-crackle', crackleGen('bush-crackle', 45));
  whoosh(hits, b.fire + 0.05, { pre: 0.12, post: 0.7, f0: 250, fPeak: 1800, f1: 350, gain: 0.34, panFrom: 0, panTo: 0.2, body: 1.1, seed: 'flare' });
  whoosh(hits, b.whipPlagues, { pre: 0.14, post: 0.22, f0: 600, fPeak: 4200, f1: 900, gain: 0.26, panFrom: 0.7, panTo: -0.7, seed: 'whip1' });
  b.frogs.forEach((t, k) => croak(hits, t, k, 0.11));
  hail(hits, b.whipPlagues + 0.05, b.whipSea, 'h', 0.12);
  whoosh(hits, b.whipSea, { pre: 0.14, post: 0.22, f0: 600, fPeak: 4200, f1: 900, gain: 0.26, panFrom: -0.7, panTo: 0.7, seed: 'whip2' });
  const sea = curve([[b.whipSea, 0], [b.whipSea + 0.1, 0.7], [b.split - 0.05, 0.8], [b.split + 0.25, 1.6], [b.s4 - 0.2, 1.0], [b.s4, 0]]);
  bed(beds, b.whipSea, b.s4 + 0.05, (t) => 0.12 * sea(t), 'sea', seaGen('sea'));
  whoosh(hits, b.split + 0.2, { pre: 0.3, post: 1.0, f0: 120, fPeak: 900, f1: 160, gain: 0.4, panFrom: -0.5, panTo: 0.5, body: 1.4, seed: 'split' });
  whoosh(hits, b.s4, { pre: 0.12, post: 0.3, f0: 500, fPeak: 3600, f1: 700, gain: 0.22, panFrom: 0.6, panTo: -0.6, seed: 'whip3' });

  // ---- S6 the clift: rock scrape, the covering shadow, the roaring rush of light and its echo ----
  creak(hits, b.rockScrape, 0.7, { gain: 0.12, f0: 70, f1: 140, fc: 1300, seed: 'scrape' });
  noiseShape(hits, b.rockScrape, b.rockScrape + 0.7, 'grit', (tt) => 0.05 * Math.sin(Math.PI * tt / 0.7), { fl: [new Biquad('bandpass', 2400, 0.9)], fr: [new Biquad('bandpass', 2600, 0.9)] });
  whoosh(hits, b.cover + 0.35, { pre: 0.35, post: 0.8, f0: 90, fPeak: 420, f1: 110, gain: 0.3, panFrom: 0.4, panTo: -0.2, body: 1.2, seed: 'cover' });
  echoed((d, g) => whoosh(hits, b.gloryPeak + d, { pre: b.gloryPeak - b.gloryRush, post: 1.1, f0: 140, fPeak: 3000, f1: 300, gain: 0.48 * g, panFrom: -0.9, panTo: 0.9, body: 1.3, q: 0.8, seed: `rush${d}` }),
    [0.55, 1.15], [0.28, 0.12]);
  noiseShape(hits, b.gloryRush, b.gloryGone + 0.6, 'roar', (tt) => {
    const u = tt / (b.gloryGone + 0.6 - b.gloryRush);
    return 0.18 * Math.min(1, tt / 0.25) * Math.exp(-Math.max(0, u - 0.45) * 4);
  }, { fl: [new Biquad('lowpass', 500, 0.7), new Biquad('highpass', 40, 0.7)], fr: [new Biquad('lowpass', 520, 0.7), new Biquad('highpass', 40, 0.7)] });

  // ---- S7–S8 the trails fade; morning; footsteps on gravel and a shimmer around the face ----
  sparkle(hits, b.s7 + 0.3, b.dawn, 6, 'trails', 0.025);
  air(hits, b.dawn - 0.3, b.dawn + 0.4, b.dawn + 1.6, 0.012, 'dawn-air', 3000, 8000);
  bed(beds, b.dawn, b.s9 + 0.4, (t) => 0.04 * curve([[b.dawn, 0], [b.dawn + 0.8, 1], [b.faceCU, 0.8], [b.s9 + 0.4, 0]])(t), 'morning-breeze', leavesGen('morning'));
  b.steps.moses.forEach((t, k) => gravelStep(hits, t, k, 0.26, -0.15));
  sparkle(hits, b.shining - 0.05, b.faceCU + 1.0, 10, 'shine', 0.035);
  air(hits, b.shining - 0.2, b.faceCU + 0.2, b.s9, 0.01, 'shine-air', 6000, 11000);

  // ---- S9 the camp: gasps and murmurs without words, a child's shuffle ----
  const camp = curve([[b.s9 - 0.1, 0], [b.s9 + 0.4, 1], [b.gasp2, 0.7], [b.s10, 0.4], [b.s10 + 0.5, 0]]);
  bed(beds, b.s9 - 0.1, b.s10 + 0.6, (t) => 0.04 * camp(t), 'camp', murmurGen('camp', { voices: 8, lp: 2200 }));
  [0, 0.12, 0.27].forEach((d, k) => gasp(hits, b.gasp1 + d, `a${k}`, 0.09));
  [0, 0.09, 0.2, 0.33].forEach((d, k) => gasp(hits, b.gasp2 + d, `b${k}`, 0.08));
  [0, 0.18, 0.34].forEach((d, k) => footstepEarth(hits, b.stepBack + d, 40 + k, 0.14, 0.2 - 0.15 * k));
  cloth(hits, b.childPeek - 0.1, 0.45, { gain: 0.06, fc: 2200, seed: 'child' });
  [0, 0.16].forEach((d, k) => footstepEarth(hits, b.childPeek + d, 60 + k, 0.08, 0.35));

  // ---- S10 the veil: soft cloth ----
  cloth(hits, b.veilOn - 0.25, 0.9, { gain: 0.11, fc: 2000, rate: 12, seed: 'veil' });

  // ---- S11 the light streak across the centuries, then the lamplit upper room ----
  whoosh(hits, b.streak, { pre: b.streak - b.streakStart, post: 0.55, f0: 500, fPeak: 4600, f1: 900, gain: 0.32, panFrom: -0.85, panTo: 0.85, body: 0.5, seed: 'streak' });
  sparkle(hits, b.streakStart, b.streak + 0.4, 8, 'streak-sp', 0.03);
  const room = curve([[b.room - 0.2, 0], [b.room + 0.3, 1], [b.s12 + 0.3, 0.8], [b.s12 + 0.8, 0]]);
  bed(beds, b.room - 0.2, b.s12 + 0.9, (t) => 0.03 * room(t), 'lamps', crackleGen('lamp-crackle', 8));
  bed(beds, b.room - 0.2, b.s12 + 0.9, (t) => 0.045 * room(t), 'room-tone', roomToneGen());

  // ---- S12–S13 the Galilee hillside: birds and a breeze ----
  const hill = curve([[b.s12, 0], [b.s12 + 0.5, 0.7], [b.s13, 1], [b.s14, 0.6], [b.s14 + 0.8, 0]]);
  bed(beds, b.s12, b.s14 + 0.9, (t) => 0.04 * hill(t), 'hill-breeze', leavesGen('hill'));
  for (let k = 0, t = b.s12 + 0.4; t < b.s14 + 0.3; k++, t += 0.7 + new Rng(`bt${k}`).range(0, 0.9)) birdChirp(hits, t, k, 0.035);

  // ---- badges: a pop and a chime as each fills; a bright chord when FACE fills; cards and labels ----
  [0, 0.12, 0.24].forEach((d, k) => pop(hits, b.badgesIn + d, 520 + 90 * k, 0.07, -0.3 + 0.3 * k));
  pop(hits, b.fire, 640, 0.1, -0.25);
  chime(hits, b.fire + 0.02, [1174.7, 1760], 0.035, -0.25);
  pop(hits, b.sea, 700, 0.1, 0);
  chime(hits, b.sea + 0.02, [1318.5, 1975.5], 0.035, 0);
  sparkle(hits, b.faceGlow, b.faceGlow + 0.8, 4, 'face-glow', 0.02);
  pop(hits, b.faceFill, 760, 0.11, 0.25);
  chime(hits, b.faceFill + 0.02, [1174.7, 1480.0, 1760.0, 2349.3], 0.04, 0.25, 1.4);
  for (const t of [b.cardGloryIn, b.cardLiveIn, b.cardShoneIn, b.cardJohnIn, b.cardFaceIn]) cloth(hits, t - 0.05, 0.3, { gain: 0.03, fc: 3200, rate: 30, seed: `card${t}` });
  for (const t of [b.labelClift, b.labelBack, b.labelKnow, b.labelVeil]) tick(hits, t, 0.05, 1900, 0.2);

  // ---- S14 call to action: typing taps (spaces skipped), hearts ----
  [...b.commentText].forEach((ch, k) => {
    if (ch !== ' ') tap(hits, b.typingStart + k / b.typingCps, k);
  });
  for (let k = 0; k < 6; k++) heartPop(hits, b.hearts + k * 0.22, k);

  // ---- S15 the logo draws itself ----
  sparkle(hits, b.logoDraw, b.logoDraw + 1.0, 5, 'logo', 0.04);
  air(hits, b.logoDraw - 0.1, b.logoDraw + 0.5, b.logoDraw + 1.6, 0.006, 'logo-air');
  return { beds, hits, pre };
}
