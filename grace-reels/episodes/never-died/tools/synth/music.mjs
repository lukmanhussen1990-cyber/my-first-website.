// Music score + instruments: soft pads, felt piano, low drone, strings, choir, long reverb.
// D minor, turning to D major exactly at beats.keyChange. Every section is tied to a beat from beats.mjs.
import {
  SR, TAU, Bus, Rng, Noise, Saw, Sine, Biquad, mtof, curve, ahr, wobble, clamp, panGains, fdnReverb,
} from './dsp.mjs';

// ---------------- chord voicings (MIDI) ----------------
const CH = {
  Dm9: [50, 57, 64, 65], Dm: [50, 57, 62, 65], Bbmaj7: [46, 53, 57, 62], FA: [45, 53, 57, 60],
  Gm9Bb: [46, 55, 57, 62], Asus4: [45, 52, 57, 62], A: [45, 52, 57, 61], F: [53, 57, 60, 65],
  CE: [52, 55, 60, 64], Bb: [46, 53, 58, 62], EbD: [50, 51, 55, 58], Gm7: [43, 53, 58, 62],
  A7sus4: [45, 52, 55, 62], C: [48, 55, 60, 64], A7: [45, 52, 55, 61], D5: [50, 57, 62, 69],
  Dsus2: [62, 64, 69, 74], GD: [62, 67, 71, 74], AsusHi: [57, 62, 64, 69], D: [50, 57, 62, 66],
  AC: [49, 52, 57, 61, 64], Bm7: [47, 54, 57, 62, 66], G: [43, 50, 55, 59, 62], DF: [42, 54, 57, 62, 66],
  GB: [47, 55, 59, 62], DF2: [54, 57, 62, 66], Fbig: [41, 53, 57, 60, 65, 69], Dbig: [38, 50, 57, 62, 66, 69],
};
const pitchPan = (m) => clamp((m - 60) / 26, -0.55, 0.55);

// ---------------- instruments ----------------
function padNote(bus, midi, t0, t1, o = {}) {
  const { att = 0.9, rel = 1.8, gain = 0.05, cutoff = 1500, voices = 3, detune = 8, pan = pitchPan(midi) } = o;
  const seed = `pad${midi}_${t0.toFixed(3)}`;
  const r = new Rng(seed);
  const f = mtof(midi);
  const osc = Array.from({ length: voices }, (_, k) => {
    const c = (k - (voices - 1) / 2) * detune + r.range(-2, 2);
    const [gl, gr] = panGains(clamp(pan + (k - (voices - 1) / 2) * 0.45, -1, 1));
    return { saw: new Saw(r.next()), ratio: 2 ** (c / 1200), gl, gr };
  });
  const fl = [new Biquad('lowpass', cutoff, 0.55), new Biquad('lowpass', cutoff, 0.85)];
  const fr = [new Biquad('lowpass', cutoff, 0.55), new Biquad('lowpass', cutoff, 0.85)];
  const wob = wobble(seed + 'w', [0.047, 0.113]);
  const i0 = bus.index(t0), i1 = Math.min(bus.n, bus.index(t1 + rel));
  const hold = Math.max(0, t1 - t0 - att);
  for (let i = Math.max(0, i0); i < i1; i++) {
    const t = (i - i0) / SR;
    const env = ahr(t, att, hold, rel);
    if ((i & 31) === 0) {
      const fc = cutoff * (1 + 0.16 * wob(t0 + t)) * (0.65 + 0.35 * env);
      for (const b of [fl[0], fr[0]]) b.set('lowpass', fc, 0.55);
      for (const b of [fl[1], fr[1]]) b.set('lowpass', fc, 0.85);
    }
    let l = 0, rr = 0;
    for (const o2 of osc) {
      const s = o2.saw.next(f * o2.ratio);
      l += s * o2.gl;
      rr += s * o2.gr;
    }
    l = fl[1].process(fl[0].process(l));
    rr = fr[1].process(fr[0].process(rr));
    bus.L[i] += l * env * gain;
    bus.R[i] += rr * env * gain;
  }
}
function padChord(bus, notes, t0, t1, o = {}) {
  notes.forEach((m, k) => padNote(bus, m, t0 + k * 0.012, t1, o));
}

function bowed(bus, midi, t0, t1, o = {}) {
  // strings / choir source: detuned saws with delayed vibrato; optional tremolo and crescendo curve
  const {
    att = 0.7, rel = 1.3, gain = 0.04, cutoff = 2600, voices = 5, detune = 11, pan = pitchPan(midi),
    vibRate = 5.4, vibDepth = 0.0024, trem = 0, cresc = null, hard = false,
  } = o;
  const seed = `bow${midi}_${t0.toFixed(3)}_${voices}`;
  const r = new Rng(seed);
  const f = mtof(midi);
  const osc = Array.from({ length: voices }, (_, k) => {
    const c = r.range(-detune, detune);
    const [gl, gr] = panGains(clamp(pan + r.range(-0.35, 0.35), -1, 1));
    return { saw: new Saw(r.next()), ratio: 2 ** (c / 1200), vr: vibRate * r.range(0.93, 1.07), vp: r.next() * TAU, gl, gr };
  });
  const fl = [new Biquad('lowpass', cutoff, 0.6), new Biquad('lowpass', cutoff, 0.9)];
  const fr = [new Biquad('lowpass', cutoff, 0.6), new Biquad('lowpass', cutoff, 0.9)];
  const i0 = bus.index(t0);
  const i1 = Math.min(bus.n, bus.index(t1 + (hard ? 0.03 : rel)));
  const hold = Math.max(0, t1 - t0 - att);
  const tremPh = r.next();
  for (let i = Math.max(0, i0); i < i1; i++) {
    const t = (i - i0) / SR;
    let env = hard && t > t1 - t0 ? Math.max(0, 1 - (t - (t1 - t0)) / 0.03) * ahr(t1 - t0, att, hold, rel) : ahr(t, att, hold, rel);
    if (cresc) env *= cresc(t0 + t);
    if (trem > 0) {
      const ph = (t * trem + tremPh) % 1;
      env *= 0.42 + 0.58 * Math.sin(Math.PI * ph) ** 0.6;
    }
    if ((i & 31) === 0) {
      const fc = cutoff * (0.5 + 0.5 * Math.min(1, env));
      for (const b of [fl[0], fr[0]]) b.set('lowpass', fc, 0.6);
      for (const b of [fl[1], fr[1]]) b.set('lowpass', fc, 0.9);
    }
    const vib = 1 + vibDepth * Math.min(1, t / 0.45) * 1;
    let l = 0, rr = 0;
    for (const o2 of osc) {
      const s = o2.saw.next(f * o2.ratio * (1 + (vib - 1) * Math.sin(TAU * o2.vr * t + o2.vp)));
      l += s * o2.gl;
      rr += s * o2.gr;
    }
    l = fl[1].process(fl[0].process(l));
    rr = fr[1].process(fr[0].process(rr));
    bus.L[i] += l * env * gain;
    bus.R[i] += rr * env * gain;
  }
}
const strings = (bus, notes, t0, t1, o = {}) => notes.forEach((m, k) => bowed(bus, m, t0 + k * 0.02, t1, o));
const choir = (bus, notes, t0, t1, o = {}) =>
  notes.forEach((m, k) => bowed(bus, m, t0 + k * 0.03, t1, { voices: 4, detune: 7, vibRate: 4.7, vibDepth: 0.0032, cutoff: 3400, att: 1.1, rel: 1.8, ...o }));

function piano(bus, midi, t, vel, o = {}) {
  // felt piano: additive partials with inharmonicity, soft hammer, two detuned strings, damper release
  const { dur = 2.2, pan = pitchPan(midi), bright = 1 } = o;
  const f0 = mtof(midi);
  const r = new Rng(`pn${midi}_${t.toFixed(3)}`);
  const B = 0.00016 + 0.0000018 * Math.max(0, midi - 40);
  const T60 = clamp(7.5 * (220 / f0) ** 0.55, 1.3, 11);
  const parts = [];
  for (let n = 1; n <= 16; n++) {
    const fn = f0 * n * Math.sqrt(1 + B * n * n);
    if (fn > 7500) break;
    const amp = vel * n ** -1.1 * Math.exp(-(n - 1) / (2.4 * bright * (0.55 + vel))) * (0.35 + 0.65 * Math.abs(Math.sin((Math.PI * n) / 7.3)));
    const tau = T60 / 6.91 / (1 + 0.35 * (n - 1));
    for (const det of [-0.055, 0.055]) {
      const w = (TAU * (fn + det * (1 + 0.15 * n))) / SR;
      const ph = r.next() * TAU;
      parts.push({ c: Math.cos(w), s: Math.sin(w), x: Math.cos(ph), y: Math.sin(ph), d: Math.exp(-1 / (tau * SR)), a: amp * 0.5 });
    }
  }
  const [gl, gr] = panGains(pan);
  const thump = new Noise(`th${midi}_${t}`);
  const tlp = new Biquad('lowpass', 160 + 280 * vel, 0.7);
  const i0 = bus.index(t);
  const len = Math.round(Math.min(T60 * 0.85, dur + 1.6) * SR);
  const relStart = Math.round(dur * SR), relTau = 0.2 * SR, attN = 0.005 * SR, endFade = 0.03 * SR;
  for (let k = 0; k < len; k++) {
    const i = i0 + k;
    if (i < 0) continue;
    if (i >= bus.n) break;
    let y = 0;
    for (const p of parts) {
      const nx = (p.x * p.c - p.y * p.s) * p.d;
      p.y = (p.x * p.s + p.y * p.c) * p.d;
      p.x = nx;
      y += p.a * p.y;
    }
    let env = k < attN ? 0.5 - 0.5 * Math.cos((Math.PI * k) / attN) : 1;
    if (k > relStart) env *= Math.exp(-(k - relStart) / relTau);
    if (k > len - endFade) env *= (len - k) / endFade;
    let th = 0;
    if (k < 0.07 * SR) th = tlp.process(thump.white()) * vel * 0.3 * Math.exp(-k / (0.011 * SR)) * Math.min(1, k / 48);
    const out = y * env + th;
    bus.L[i] += out * gl;
    bus.R[i] += out * gr;
  }
}
const arp = (bus, notes, t, step, vel, o) => notes.forEach((m, k) => piano(bus, m, t + k * step, vel * (0.9 + 0.1 * (k % 2)), o));

function pluck(bus, midi, t, vel, { pan = 0, decay = 0.9965, bright = 0.35 } = {}) {
  // Karplus-Strong: soft low pizzicato for the walking pulse
  const f = mtof(midi), N = Math.max(2, Math.round(SR / f));
  const nz = new Noise(`pl${midi}_${t}`), buf = new Float32Array(N);
  let lp = 0;
  for (let k = 0; k < N; k++) buf[k] = lp += (nz.white() - lp) * bright;
  const [gl, gr] = panGains(pan);
  const i0 = bus.index(t), len = Math.round(1.6 * SR);
  let idx = 0;
  for (let k = 0; k < len; k++) {
    const cur = buf[idx], nxt = buf[(idx + 1) % N];
    buf[idx] = decay * 0.5 * (cur + nxt);
    idx = (idx + 1) % N;
    const i = i0 + k;
    if (i < 0 || i >= bus.n) continue;
    const env = Math.min(1, k / 96) * (k > len - 2400 ? (len - k) / 2400 : 1);
    bus.L[i] += cur * vel * env * gl;
    bus.R[i] += cur * vel * env * gr;
  }
}

function subHit(bus, t, { gain = 0.5, f0 = 72, f1 = 33, sweep = 0.12, decay = 0.9, click = 0.25 } = {}) {
  const i0 = bus.index(t), len = Math.round(decay * 3 * SR);
  const nz = new Noise(`sub${t}`), lp = new Biquad('lowpass', 140, 0.8);
  let ph = 0;
  for (let k = 0; k < len; k++) {
    const i = i0 + k;
    if (i < 0 || i >= bus.n) continue;
    const tt = k / SR;
    const f = f1 + (f0 - f1) * Math.exp(-tt / sweep);
    ph += f / SR;
    const env = Math.min(1, k / 96) * Math.exp(-tt / (decay * 0.42)) * (k > len - 2400 ? (len - k) / 2400 : 1);
    const y = Math.sin(TAU * ph) * env + lp.process(nz.white()) * click * Math.exp(-tt / 0.045) * Math.min(1, k / 48);
    bus.L[i] += y * gain;
    bus.R[i] += y * gain;
  }
}

function stab(bus, notes, t, gain) {
  // brass-like hit: saw stack with a fast filter envelope
  for (const m of notes) {
    const f = mtof(m), r = new Rng(`stab${m}_${t}`);
    const osc = [0, 1, 2].map(() => ({ s: new Saw(r.next()), ratio: 2 ** (r.range(-9, 9) / 1200) }));
    const [gl, gr] = panGains(pitchPan(m));
    const lp1 = new Biquad('lowpass', 400, 0.7), lp2 = new Biquad('lowpass', 400, 1.1);
    const i0 = bus.index(t), len = Math.round(2.0 * SR);
    for (let k = 0; k < len; k++) {
      const i = i0 + k;
      if (i < 0 || i >= bus.n) continue;
      const tt = k / SR;
      if ((k & 15) === 0) {
        const fc = 650 + 2900 * Math.min(1, tt / 0.012) * Math.exp(-tt / 0.32);
        lp1.set('lowpass', fc, 0.7);
        lp2.set('lowpass', fc, 1.1);
      }
      const env = Math.min(1, k / 288) * (0.35 + 0.65 * Math.exp(-tt / 0.28)) * ahr(tt, 0.001, 0.9, 1.0);
      let y = 0;
      for (const o of osc) y += o.s.next(f * o.ratio);
      y = lp2.process(lp1.process(y)) * env * gain;
      bus.L[i] += y * gl;
      bus.R[i] += y * gr;
    }
  }
}

function noiseShape(bus, t0, t1, seed, ampFn, filt, { stereo = true } = {}) {
  // generic noise layer; filt(tRel, fl, fr) may retune filters; ampFn(tRel) -> gain
  const nl = new Noise(seed + 'L'), nr = new Noise(seed + 'R');
  const { fl, fr, update } = filt;
  const i0 = bus.index(t0), i1 = Math.min(bus.n, bus.index(t1));
  for (let i = Math.max(0, i0); i < i1; i++) {
    const tt = (i - i0) / SR;
    if (update && (i & 31) === 0) update(tt);
    const a = ampFn(tt);
    let l = nl.white(), r = stereo ? nr.white() : l;
    for (const b of fl) l = b.process(l);
    for (const b of fr) r = b.process(r);
    bus.L[i] += l * a;
    bus.R[i] += r * a;
  }
}
function crash(bus, t, gain = 0.15, decay = 2.6) {
  const mk = () => [new Biquad('highpass', 450, 0.7), new Biquad('lowpass', 7000, 0.7), new Biquad('peaking', 3200, 1, -3)];
  noiseShape(bus, t, t + decay * 1.3, `crash${t}`, (tt) => gain * Math.min(1, tt / 0.004) * Math.exp(-tt / (decay / 4.6)) * ahr(tt, 0.001, decay, decay * 0.3), { fl: mk(), fr: mk() });
}
function reverseCymbal(bus, tEnd, dur, gain = 0.12) {
  const fl = [new Biquad('highpass', 700, 0.7), new Biquad('lowpass', 2000, 0.7)];
  const fr = [new Biquad('highpass', 700, 0.7), new Biquad('lowpass', 2000, 0.7)];
  noiseShape(bus, tEnd - dur, tEnd, `rcym${tEnd}`, (tt) => gain * (tt / dur) ** 2.6 * Math.min(1, (dur - tt) / 0.012), {
    fl, fr, update: (tt) => { const f = 2000 + 6000 * (tt / dur) ** 1.5; fl[1].set('lowpass', f, 0.7); fr[1].set('lowpass', f, 0.7); },
  });
}
function riser(bus, t0, t1, gain = 0.08) {
  const dur = t1 - t0;
  const fl = [new Biquad('bandpass', 400, 1.4)], fr = [new Biquad('bandpass', 400, 1.4)];
  noiseShape(bus, t0, t1 + 0.02, `riser${t0}`, (tt) => gain * (Math.min(tt, dur) / dur) ** 2 * Math.min(1, (dur + 0.02 - tt) / 0.02), {
    fl, fr, update: (tt) => { const f = 400 * 6 ** Math.min(1, tt / dur); fl[0].set('bandpass', f, 1.4); fr[0].set('bandpass', f, 1.4); },
  });
  const s = new Sine(0), i0 = bus.index(t0), n = Math.round(dur * SR);
  for (let k = 0; k < n; k++) {
    const i = i0 + k;
    if (i < 0 || i >= bus.n) continue;
    const u = k / n;
    const y = s.next(mtof(50) * 4 ** u) * gain * 0.35 * u * u * Math.min(1, (n - k) / 960);
    bus.L[i] += y;
    bus.R[i] += y;
  }
}

function ostinato(bus, t0, t1, rootAt, { step = 0.21, gain = 0.05 } = {}) {
  const pat = [0, 12, 0, 7, 0, 12, 0, 7];
  let k = 0;
  for (let t = t0; t < t1 - 0.02; t += step, k++) {
    const root = rootAt(t), m = root + pat[k % 8], f = mtof(m), r = new Rng(`ost${k}`);
    const osc = [new Saw(r.next()), new Saw(r.next())];
    const lp = new Biquad('lowpass', 1200, 0.9), sub = new Sine(0);
    const acc = k % 4 === 0 ? 1.3 : 1;
    const i0 = bus.index(t), len = Math.round(Math.min(step * 0.95, t1 - t) * SR);
    for (let q = 0; q < len; q++) {
      const i = i0 + q;
      if (i < 0 || i >= bus.n) continue;
      const tt = q / SR;
      if ((q & 15) === 0) lp.set('lowpass', 450 + 1100 * Math.exp(-tt / 0.06), 0.9);
      const env = Math.min(1, q / 192) * Math.exp(-tt / 0.11) * Math.min(1, (len - q) / 240);
      const y = (lp.process(osc[0].next(f * 0.998) + osc[1].next(f * 1.003)) + 0.5 * sub.next(f / 2)) * env * gain * acc;
      bus.L[i] += y;
      bus.R[i] += y;
    }
    if (k % 2 === 0) subHit(bus, t, { gain: gain * 2.2 * acc, f0: 110, f1: 55, sweep: 0.03, decay: 0.32, click: 0.6 });
  }
}

function drone(bus, from, to, level, cutoff) {
  const sL = [new Sine(0.1), new Sine(0.3), new Sine(0.7)], sR = [new Sine(0.2), new Sine(0.5), new Sine(0.9)];
  const sawL = new Saw(0.13), sawR = new Saw(0.61);
  const lpL = new Biquad('lowpass', 220, 0.7), lpR = new Biquad('lowpass', 220, 0.7);
  const wob = wobble('drone', [0.031, 0.077, 0.13]);
  const D1 = mtof(26), D2 = mtof(38), A2 = mtof(45);
  const i0 = Math.max(0, bus.index(from)), i1 = Math.min(bus.n, bus.index(to));
  for (let i = i0; i < i1; i++) {
    const t = i / SR - bus.pre;
    if ((i & 63) === 0) { const fc = cutoff(t); lpL.set('lowpass', fc, 0.7); lpR.set('lowpass', fc, 0.7); }
    const a = level(t) * (1 + 0.09 * wob(t));
    const l = 0.55 * sL[0].next(D1) + 0.6 * sL[1].next(D2 * 0.9992) + 0.14 * sL[2].next(A2) + 0.4 * lpL.process(sawL.next(D2 * 0.9988));
    const r = 0.55 * sR[0].next(D1) + 0.6 * sR[1].next(D2 * 1.0008) + 0.14 * sR[2].next(A2) + 0.4 * lpR.process(sawR.next(D2 * 1.0012));
    bus.L[i] += l * a;
    bus.R[i] += r * a;
  }
}

function reverseSwell(bus, notes, tEnd, dur, gain) {
  const tmp = new Bus(dur + 0.6, 0);
  padChord(tmp, notes, 0.02, 0.4, { att: 0.02, rel: 0.5, gain, cutoff: 2600 });
  const [wl, wr] = fdnReverb(tmp.L, tmp.R, { t60: 3.2, size: 0.9, seed: 'rev-swell' });
  const n = Math.round(dur * SR), i1 = bus.index(tEnd);
  for (let k = 0; k < n; k++) {
    const src = n - 1 - k; // reversed
    const u = k / n;
    const env = u ** 1.8 * Math.min(1, (n - k) / 600);
    const i = i1 - n + k;
    if (i < 0 || i >= bus.n) continue;
    bus.L[i] += (0.35 * tmp.L[src] + wl[src]) * env;
    bus.R[i] += (0.35 * tmp.R[src] + wr[src]) * env;
  }
}

function formantChoir(bus) {
  // source-filter "aah": parallel formant bandpasses on the summed choir voices
  const spec = [[380, 4, 0.35], [750, 6, 1.0], [1150, 8, 0.6], [2800, 10, 0.22]];
  for (const ch of [bus.L, bus.R]) {
    const bp = spec.map(([f, q]) => new Biquad('bandpass', f, q));
    const lp = new Biquad('lowpass', 2200, 0.7);
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      let y = 0.22 * lp.process(x);
      for (let k = 0; k < bp.length; k++) y += bp[k].process(x) * spec[k][2] * 1.6;
      ch[i] = y;
    }
  }
}

// ---------------- the score ----------------
export function renderMusic(b, tl) {
  const pre = Math.round((b.total - b.loopOut) * 1000) / 1000;
  const T = b.total;
  const mk = () => new Bus(T, pre);
  const pads = mk(), str = mk(), cho = mk(), pno = mk(), low = mk(), fx = mk();
  const w = (part, text) => tl.words.find((x) => x.part === part && x.text.replace(/[^A-Za-z’']/g, '') === text).start;

  // ---- S1 hook (starts in the pre-roll so t = 0 is already "mid-action") ----
  padChord(pads, CH.Dm9, -pre, b.s2 + 0.15, { att: 0.35, rel: 1.6, gain: 0.05 });
  strings(low, [38, 50], -pre, b.s2, { att: 0.35, rel: 1.4, gain: 0.03, cutoff: 900 });
  subHit(fx, b.hookTitleIn, { gain: 0.48, f0: 80, f1: 32, decay: 1.4, click: 0.22 });
  piano(pno, 69, w(1, 'died') + 0.02, 0.42, { dur: 1.0 });
  piano(pno, 65, w(1, 'Not') + 0.02, 0.34, { dur: 0.5 });
  piano(pno, 64, w(1, 'once') + 0.02, 0.32, { dur: 0.8 });

  // ---- S2 Enoch: warm felt piano over pads; a lift when God takes him ----
  const S2 = [
    [b.s2, 6.0, CH.Bbmaj7], [6.0, 7.6, CH.FA], [7.6, b.enochVanish - 0.08, CH.Gm9Bb],
    [b.enochVanish - 0.08, 9.9, CH.Asus4], [9.9, b.badge1 - 0.06, CH.Dm9], [b.badge1 - 0.06, 12.4, CH.F],
    [12.4, 13.5, CH.CE], [13.5, 14.3, CH.Bb], [14.3, 14.85, CH.Asus4], [14.85, b.s3, CH.A],
  ];
  for (const [t0, t1, c] of S2) {
    padChord(pads, c, t0 - 0.12, t1, { att: 0.55, rel: 1.4, gain: 0.042 });
    strings(low, [c[0] - 12], t0 - 0.1, t1, { att: 0.5, rel: 1.2, gain: 0.026, cutoff: 800 });
  }
  arp(pno, [46, 53, 57, 62], b.s2 + 0.06, 0.16, 0.3, { dur: 2.2 });
  piano(pno, 74, w(2, 'Enoch'), 0.42, { dur: 0.6 });
  piano(pno, 72, w(2, 'Enoch') + 0.55, 0.32, { dur: 0.5 });
  piano(pno, 69, w(2, 'Enoch') + 1.0, 0.32, { dur: 0.6 });
  piano(pno, 69, w(2, 'walked'), 0.34, { dur: 0.4 });
  piano(pno, 72, w(2, 'with'), 0.34, { dur: 0.4 });
  piano(pno, 74, w(2, 'God'), 0.44, { dur: 1.2 });
  piano(pno, 70, w(2, 'and'), 0.36, { dur: 0.5 });
  piano(pno, 69, w(2, 'not'), 0.32, { dur: 0.9 });
  arp(pno, [57, 62, 64, 69, 74, 76, 81], b.enochVanish, 0.075, 0.33, { dur: 1.6 });
  choir(cho, [69, 74, 76], b.enochVanish - 0.2, 10.5, { gain: 0.016, att: 0.45, rel: 1.6 });
  piano(pno, 77, b.badge1, 0.4, { dur: 1.0 });
  piano(pno, 81, b.badge1 + 0.02, 0.3, { dur: 1.0 });
  piano(pno, 76, w(3, 'see'), 0.3, { dur: 0.4 });
  piano(pno, 74, w(3, 'death'), 0.34, { dur: 0.8 });
  piano(pno, 74, w(3, 'because'), 0.3, { dur: 0.6 });
  piano(pno, 73, w(3, 'pleased'), 0.32, { dur: 0.5 });
  piano(pno, 76, 14.92, 0.28, { dur: 0.7 });

  // ---- S3 Elijah and Elisha: gentle walking pulse on Elijah's steps, tension on "wrong" ----
  const S3 = [[b.s3, 17.2, CH.Dm], [17.2, b.wrong - 0.11, CH.Bbmaj7], [b.wrong - 0.11, 20.2, CH.EbD], [20.2, 21.4, CH.Gm7], [21.4, b.suddenly, CH.A7sus4]];
  const rootAt3 = (t) => ({ 50: 38, 46: 46, 43: 43, 45: 45 }[S3.find(([a, c]) => t >= a && t < c)?.[2][0]] ?? 38);
  for (const [t0, t1, c] of S3) {
    padChord(pads, c, t0 - 0.12, t1, { att: 0.5, rel: 1.3, gain: 0.04 });
    strings(low, [c[0] - 12], t0 - 0.1, t1, { att: 0.45, rel: 1.1, gain: 0.024, cutoff: 800 });
  }
  b.steps.elijah.forEach((t, k) => {
    if (t >= b.suddenly - 0.05) return;
    const r = rootAt3(t);
    pluck(low, k % 2 ? r + 7 : r, t, 0.55, { pan: k % 2 ? 0.15 : -0.15 });
  });
  piano(pno, 74, b.elijahLabel, 0.38, { dur: 0.5 });
  piano(pno, 72, b.elijahLabel + 0.4, 0.3, { dur: 0.5 });
  piano(pno, 69, b.elijahLabel + 0.8, 0.3, { dur: 0.8 });
  piano(pno, 75, b.wrong, 0.3, { dur: 0.6 });
  piano(pno, 74, b.wrong + 0.62, 0.28, { dur: 0.7 });
  piano(pno, 65, b.elishaLabel, 0.3, { dur: 0.4 });
  piano(pno, 67, b.elishaLabel + 0.4, 0.3, { dur: 0.4 });
  piano(pno, 69, b.elishaLabel + 0.82, 0.3, { dur: 0.6 });
  piano(pno, 76, w(5, 'talking'), 0.26, { dur: 0.8 });

  // ---- S4 chariot: tremolo crescendo -> big hit -> driving until the freeze (hard stop) ----
  const burst = b.chariotBurst, frz = b.freeze;
  const cres4 = curve([[b.suddenly, 0.18], [burst - 0.05, 1]]);
  strings(str, [38, 50, 53, 57, 62], b.suddenly, burst + 0.02, { att: 0.15, rel: 0.08, gain: 0.03, trem: 13, cresc: cres4, cutoff: 3000, hard: true });
  riser(fx, b.suddenly + 0.2, burst, 0.06);
  reverseCymbal(fx, burst, 1.5, 0.08);
  subHit(fx, burst, { gain: 0.72, f0: 90, f1: 30, decay: 1.6, click: 0.4 });
  stab(fx, [38, 50, 57, 62, 65], burst, 0.05);
  crash(fx, burst, 0.11, 2.8);
  const S4 = [[burst, 25.6, [38, 50, 57, 62, 65]], [25.6, 26.45, [34, 46, 53, 58, 62]], [26.45, 27.3, [31, 43, 55, 58, 62]], [27.3, frz, [33, 45, 52, 57, 61]]];
  for (const [t0, t1, c] of S4) strings(str, c, t0, t1, { att: 0.06, rel: 0.25, gain: 0.026, cutoff: 3200, hard: t1 === frz });
  ostinato(low, burst, frz, (t) => (t < 25.6 ? 38 : t < 26.45 ? 34 + 12 : t < 27.3 ? 31 + 12 : 33 + 12), { step: 0.21, gain: 0.05 });

  // ---- S5 freeze: filtered drone + sparse piano, reverse swell into the rewind ----
  piano(pno, 69, b.mythIn + 0.05, 0.3, { dur: 0.8 });
  piano(pno, 65, w(7, 'rode'), 0.26, { dur: 0.6 });
  piano(pno, 67, w(7, 'chariot'), 0.24, { dur: 0.4 });
  piano(pno, 64, w(7, 'heaven'), 0.28, { dur: 1.0 });
  piano(pno, 38, b.redX, 0.5, { dur: 1.2 });
  piano(pno, 45, b.redX + 0.01, 0.36, { dur: 1.2 });
  reverseSwell(fx, [62, 65, 69, 76], b.rewind, b.rewind - b.redX - 0.05, 0.05);

  // ---- S6 slow replay, then the whirlwind crescendo to "heaven" ----
  const S6a = [[b.s6, 34.7, CH.Dm9], [34.7, b.between - 0.05, CH.Bbmaj7], [b.between - 0.05, b.stormGather, CH.Gm9Bb]];
  for (const [t0, t1, c] of S6a) padChord(pads, c, t0, t1, { att: 0.9, rel: 1.4, gain: 0.04, cutoff: 1300 });
  for (let t = b.replay + 0.3; t < b.stormGather - 0.3; t += 1.25) subHit(low, t, { gain: 0.28, f0: 62, f1: 40, decay: 0.55, click: 0.1 });
  piano(pno, 81, b.replay + 0.2, 0.22, { dur: 1.4 });
  piano(pno, 77, b.asunderLabel, 0.24, { dur: 1.4 });
  piano(pno, 76, 35.6, 0.2, { dur: 1.2 });
  piano(pno, 74, b.between, 0.24, { dur: 1.4 });
  const cres6 = curve([[b.stormGather, 0.3], [b.heaven, 1], [b.heaven + 0.9, 0.85], [b.s7 + 0.4, 0.5]]);
  const S6b = [[b.stormGather, b.liftOff, [38, 50, 57, 62, 65]], [b.liftOff, b.whirlwindFull, [34, 46, 53, 58, 62]], [b.whirlwindFull, b.heaven, [36, 48, 55, 60, 64]], [b.heaven, b.s7 + 0.3, CH.Fbig]];
  for (const [t0, t1, c] of S6b) {
    strings(str, c, t0 - 0.05, t1, { att: 0.35, rel: 1.6, gain: 0.03, cresc: cres6, cutoff: 3000 });
    padChord(pads, c.slice(1), t0 - 0.05, t1, { att: 0.4, rel: 1.6, gain: 0.03, cutoff: 1800 });
  }
  choir(cho, [57, 62, 65, 69], b.stormGather + 0.4, b.whirlwindFull, { gain: 0.022, cresc: cres6 });
  choir(cho, [60, 64, 67, 72], b.whirlwindFull, b.heaven, { gain: 0.025, cresc: cres6, att: 0.5 });
  choir(cho, [65, 69, 72, 77], b.heaven - 0.05, b.s7 + 0.4, { gain: 0.03, att: 0.25, rel: 2.0 });
  riser(fx, b.liftOff, b.heaven, 0.05);
  reverseCymbal(fx, b.heaven, 1.2, 0.06);
  subHit(fx, b.heaven, { gain: 0.4, f0: 70, f1: 36, decay: 1.6, click: 0.12 });
  arp(pno, [65, 69, 72, 77, 81], b.heaven + 0.05, 0.09, 0.3, { dur: 1.8 });

  // ---- S7 "My father": sparse and sad, near silence while the cloak falls, swell into the mountain ----
  const S7 = [[b.s7, b.myFather - 0.1, CH.Dm, 0.03], [b.myFather - 0.1, 44.1, CH.Gm9Bb, 0.034], [44.1, 45.45, CH.A7, 0.032], [45.45, b.cloakFloat - 0.2, CH.Dm, 0.03]];
  for (const [t0, t1, c, g] of S7) padChord(pads, c, t0, t1, { att: 0.8, rel: 1.5, gain: g, cutoff: 1200 });
  [[45.5, 50], [45.9, 48], [46.3, 46], [46.7, 45]].forEach(([t, m]) => strings(low, [m], t, t + 0.42, { att: 0.12, rel: 0.6, gain: 0.03, cutoff: 900 }));
  piano(pno, 62, w(10, 'Elisha'), 0.26, { dur: 1.2 });
  piano(pno, 69, w(10, 'Elisha') + 0.01, 0.2, { dur: 1.2 });
  piano(pno, 69, b.myFather, 0.36, { dur: 0.4 });
  piano(pno, 67, b.myFather + 0.36, 0.3, { dur: 0.5 });
  piano(pno, 65, w(10, 'my'), 0.32, { dur: 0.4 });
  piano(pno, 64, w(10, 'my') + 0.32, 0.28, { dur: 1.0 });
  piano(pno, 62, w(10, 'and'), 0.26, { dur: 0.8 });
  piano(pno, 57, w(10, 'more'), 0.22, { dur: 1.2 });
  padChord(pads, [81, 86], b.cloakFloat - 0.4, b.cloakLand, { att: 1.0, rel: 0.8, gain: 0.012, cutoff: 2600 });
  piano(pno, 86, b.cloakFloat + 0.1, 0.16, { dur: 1.2 });
  piano(pno, 81, b.cloakFloat + 0.95, 0.14, { dur: 1.2 });
  piano(pno, 77, b.cloakFloat + 1.65, 0.13, { dur: 1.2 });
  piano(pno, 38, b.cloakLand, 0.3, { dur: 1.5 });
  piano(pno, 50, b.cloakLand + 0.01, 0.22, { dur: 1.5 });
  const cres7 = curve([[tl.cues.notTheEnd - 0.1, 0.25], [b.s8, 1], [b.s8 + 0.8, 0.8]]);
  strings(str, [46, 53, 58, 62], tl.cues.notTheEnd - 0.1, b.lightGrows, { att: 0.5, rel: 0.9, gain: 0.03, cresc: cres7 });
  strings(str, [48, 55, 60, 64], b.lightGrows, b.s8, { att: 0.3, rel: 0.9, gain: 0.032, cresc: cres7 });
  choir(cho, [62, 67, 72], b.lightGrows - 0.2, b.s8 + 0.2, { gain: 0.016, cresc: cres7 });

  // ---- S8 mountain: bright choir pad, still D but hinting major ----
  const S8 = [[b.s8, 52.8, CH.Dsus2], [52.8, b.figuresAppear, CH.GD], [b.figuresAppear, 55.8, CH.Dsus2], [55.8, 56.7, CH.GD], [56.7, b.keyChange, CH.AsusHi]];
  for (const [t0, t1, c] of S8) {
    choir(cho, c, t0 - 0.15, t1, { gain: 0.022, att: 0.7, rel: 1.5 });
    padChord(pads, c.map((m) => m - 12), t0 - 0.15, t1, { att: 0.6, rel: 1.4, gain: 0.03, cutoff: 1700 });
  }
  strings(str, [50, 57, 62, 69], b.s8, b.keyChange, { att: 0.5, rel: 1.0, gain: 0.02, cutoff: 2600 });
  choir(cho, [78], b.figuresAppear + 0.2, 55.8, { gain: 0.007, att: 1.0 });
  piano(pno, 81, b.centuries + 0.1, 0.22, { dur: 1.2 });
  piano(pno, 86, w(12, 'mountain'), 0.18, { dur: 1.2 });
  piano(pno, 88, b.figuresAppear + 0.2, 0.18, { dur: 1.2 });
  piano(pno, 78, b.jesusShine, 0.3, { dur: 1.4 });

  // ---- S9 promise: full warm D major from the key change ----
  const kc = b.keyChange;
  const S9 = [[kc, 58.6, CH.Dbig], [58.6, 59.85, CH.AC], [59.85, 61.1, CH.Bm7], [61.1, b.neverDie - 0.06, CH.G], [b.neverDie - 0.06, 63.3, CH.DF], [63.3, 63.6, CH.Asus4], [63.6, b.s10, CH.A]];
  const cres9 = curve([[kc, 0.85], [b.neverDie - 0.3, 0.8], [63.35, 1.0], [b.s10 + 0.2, 0.7]]);
  for (const [t0, t1, c] of S9) {
    padChord(pads, c, t0 - 0.06, t1, { att: 0.35, rel: 1.3, gain: 0.04, cutoff: 1900 });
    strings(str, c, t0 - 0.06, t1, { att: 0.4, rel: 1.3, gain: 0.022, cutoff: 2800, cresc: cres9 });
  }
  arp(pno, [50, 57, 62, 66, 69, 74], kc, 0.09, 0.4, { dur: 2.0 });
  piano(pno, 78, w(13, 'promise'), 0.34, { dur: 0.8 });
  piano(pno, 74, w(14, 'Whosoever'), 0.3, { dur: 0.6 });
  piano(pno, 76, w(14, 'liveth'), 0.3, { dur: 0.6 });
  piano(pno, 74, w(14, 'believeth'), 0.3, { dur: 0.5 });
  piano(pno, 71, w(14, 'me'), 0.3, { dur: 0.5 });
  piano(pno, 69, b.neverDie, 0.38, { dur: 1.0 });
  piano(pno, 74, b.neverDie + 0.01, 0.32, { dur: 1.0 });
  piano(pno, 78, 63.0, 0.34, { dur: 0.9 });
  choir(cho, [62, 66, 69, 74], b.neverDie - 0.3, b.s10 + 0.3, { gain: 0.02, cresc: cres9 });

  // ---- S10 call to action: soft D major ----
  const S10 = [[b.s10, 65.4, CH.D], [65.4, 66.9, CH.GB], [66.9, 68.3, CH.DF2], [68.3, 69.0, CH.Asus4], [69.0, b.s11, CH.A]];
  for (const [t0, t1, c] of S10) {
    padChord(pads, c, t0 - 0.1, t1, { att: 0.5, rel: 1.3, gain: 0.036, cutoff: 1600 });
    arp(pno, c.slice(0, 4).map((m) => m + 12), t0 + 0.05, 0.14, 0.2, { dur: 1.4 });
  }
  strings(low, [38], b.s10, 65.4, { att: 0.6, rel: 1.0, gain: 0.02, cutoff: 700 });

  // ---- S11 resolve on D major; the opening pre-roll fades in on top for the loop ----
  padChord(pads, CH.Dbig, b.s11 - 0.05, b.loopOut - 0.3, { att: 0.3, rel: 1.0, gain: 0.04, cutoff: 1800 });
  strings(str, CH.Dbig, b.s11 - 0.05, b.loopOut - 0.3, { att: 0.4, rel: 1.0, gain: 0.02, cutoff: 2400 });
  choir(cho, [62, 66, 69, 74], b.s11, b.loopOut - 0.3, { gain: 0.014, att: 0.6, rel: 1.0 });
  arp(pno, [38, 50, 57, 62, 66, 69], b.s11, 0.07, 0.42, { dur: 2.3 });

  // ---- drone: D pedal through S1–S8 (filtered in the freeze), away from the D-major chord changes ----
  const droneLvl = curve([
    [-pre, 0.075], [b.s2 - 0.3, 0.075], [b.s2 + 0.4, 0.035], [b.s3, 0.035], [b.suddenly, 0.05], [burst, 0.07],
    [frz, 0.07], [frz + 0.05, 0.09], [b.rewind, 0.06], [b.s6 + 0.3, 0.04], [b.heaven, 0.08], [b.s7 + 0.5, 0.04],
    [b.cloakFloat, 0.02], [b.cloakLand, 0.02], [b.s8, 0.05], [kc - 0.2, 0.05], [58.4, 0.0], [b.s11 - 0.4, 0.0],
    [b.s11 + 0.3, 0.045], [b.loopOut - 0.3, 0.03], [T, 0.0],
  ]);
  const droneCut = curve([[-pre, 230], [frz - 0.01, 230], [frz + 0.03, 140], [b.rewind - 0.4, 140], [b.rewind, 230], [T, 230]]);
  drone(low, -pre, T, droneLvl, droneCut);

  // ---- bus processing, reverb, master ----
  if (process.env.SYNTH_DEBUG) for (const [nm, bus] of Object.entries({ pads, str, cho, pno, low, fx })) {
    const k = bus.L.findIndex((x) => !Number.isFinite(x));
    if (k >= 0) console.log('non-finite in', nm, 'at', (k / SR - pre).toFixed(4));
  }
  formantChoir(cho);
  const eq = (bus, specs) => { for (const ch of [bus.L, bus.R]) for (const s of specs) new Biquad(...s).run(ch); };
  eq(pads, [['highpass', 70, 0.7], ['lowpass', 6500, 0.7]]);
  eq(str, [['highpass', 45, 0.7], ['peaking', 350, 1, 2], ['peaking', 3000, 1, -3], ['highshelf', 7000, 0.7, -3]]);
  eq(cho, [['highpass', 120, 0.7], ['highshelf', 6000, 0.7, -4]]);
  eq(pno, [['highpass', 40, 0.7], ['highshelf', 5000, 0.7, -2]]);
  eq(low, [['highpass', 25, 0.7], ['lowpass', 2500, 0.7]]);
  eq(fx, [['highpass', 25, 0.7], ['highshelf', 8000, 0.7, -3]]);

  const send = mk();
  for (const [bus, amt] of [[pads, 0.35], [str, 0.38], [cho, 0.55], [pno, 0.45], [low, 0.06], [fx, 0.3]]) send.mixFrom(bus, amt);
  const [wl, wr] = fdnReverb(send.L, send.R, { t60: 4.4, damp: 5200, predelay: 0.035, size: 1.15, seed: 'hall' });

  const out = mk();
  for (const bus of [pads, str, cho, pno, low, fx]) out.mixFrom(bus, 1);
  for (let i = 0; i < out.n; i++) {
    out.L[i] += wl[i] * 0.55;
    out.R[i] += wr[i] * 0.55;
  }
  eq(out, [['highpass', 30, 0.7], ['highshelf', 7000, 0.7, -3], ['lowpass', 14000, 0.7]]);

  // section dynamics (the hard stop at the freeze lives here too)
  const intensity = curve([
    [-pre, 0.8], [b.cloakWipe, 0.8], [b.s2 + 0.2, 0.6], [b.s3 - 0.2, 0.6], [b.s3 + 0.3, 0.55], [b.suddenly, 0.55],
    [burst - 0.08, 0.95], [burst + 0.1, 1.0], [frz - 0.005, 0.95], [frz + 0.03, 0.32], [b.redX, 0.36], [b.rewind - 0.02, 0.6],
    [b.s6 + 0.25, 0.48], [b.stormGather, 0.5], [b.heaven, 1.0], [b.s7 + 0.1, 0.72], [b.s7 + 1.2, 0.42], [b.cloakFloat - 0.3, 0.38],
    [b.cloakFloat + 0.3, 0.16], [b.cloakLand, 0.18], [tl.cues.notTheEnd, 0.35], [b.s8, 0.88], [b.s8 + 1.0, 0.72], [kc - 0.1, 0.72],
    [kc + 0.4, 0.9], [b.neverDie, 0.86], [63.4, 1.0], [b.s10 + 0.3, 0.6], [b.s11 - 0.1, 0.55], [b.s11 + 0.4, 0.52],
    [b.loopOut - 0.2, 0.45], [T, 0.8],
  ]);
  for (let i = 0; i < out.n; i++) {
    const g = intensity(i / SR - pre);
    out.L[i] *= g;
    out.R[i] *= g;
  }
  return { bus: out, pre };
}
