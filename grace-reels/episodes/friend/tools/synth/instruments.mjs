// Instruments for the score (shared shapes from "They Never Died"): pads, bowed strings and choir,
// felt piano, plucks, sub hits, noise swells and a D drone. Deterministic: seeded noise only.
import {
  SR, TAU, Bus, Rng, Noise, Saw, Sine, Biquad, mtof, curve, ahr, wobble, clamp, panGains, fdnReverb,
} from './dsp.mjs';

export const pitchPan = (m) => clamp((m - 60) / 26, -0.55, 0.55);

// ---------------- instruments ----------------
export function padNote(bus, midi, t0, t1, o = {}) {
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
export function padChord(bus, notes, t0, t1, o = {}) {
  notes.forEach((m, k) => padNote(bus, m, t0 + k * 0.012, t1, o));
}

export function bowed(bus, midi, t0, t1, o = {}) {
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
export const strings = (bus, notes, t0, t1, o = {}) => notes.forEach((m, k) => bowed(bus, m, t0 + k * 0.02, t1, o));
export const choir = (bus, notes, t0, t1, o = {}) =>
  notes.forEach((m, k) => bowed(bus, m, t0 + k * 0.03, t1, { voices: 4, detune: 7, vibRate: 4.7, vibDepth: 0.0032, cutoff: 3400, att: 1.1, rel: 1.8, ...o }));

export function piano(bus, midi, t, vel, o = {}) {
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
export const arp = (bus, notes, t, step, vel, o) => notes.forEach((m, k) => piano(bus, m, t + k * step, vel * (0.9 + 0.1 * (k % 2)), o));

export function pluck(bus, midi, t, vel, { pan = 0, decay = 0.9965, bright = 0.35 } = {}) {
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

export function subHit(bus, t, { gain = 0.5, f0 = 72, f1 = 33, sweep = 0.12, decay = 0.9, click = 0.25 } = {}) {
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

export function stab(bus, notes, t, gain) {
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

export function noiseShape(bus, t0, t1, seed, ampFn, filt, { stereo = true } = {}) {
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
export function crash(bus, t, gain = 0.15, decay = 2.6) {
  const mk = () => [new Biquad('highpass', 450, 0.7), new Biquad('lowpass', 7000, 0.7), new Biquad('peaking', 3200, 1, -3)];
  noiseShape(bus, t, t + decay * 1.3, `crash${t}`, (tt) => gain * Math.min(1, tt / 0.004) * Math.exp(-tt / (decay / 4.6)) * ahr(tt, 0.001, decay, decay * 0.3), { fl: mk(), fr: mk() });
}
export function reverseCymbal(bus, tEnd, dur, gain = 0.12) {
  const fl = [new Biquad('highpass', 700, 0.7), new Biquad('lowpass', 2000, 0.7)];
  const fr = [new Biquad('highpass', 700, 0.7), new Biquad('lowpass', 2000, 0.7)];
  noiseShape(bus, tEnd - dur, tEnd, `rcym${tEnd}`, (tt) => gain * (tt / dur) ** 2.6 * Math.min(1, (dur - tt) / 0.012), {
    fl, fr, update: (tt) => { const f = 2000 + 6000 * (tt / dur) ** 1.5; fl[1].set('lowpass', f, 0.7); fr[1].set('lowpass', f, 0.7); },
  });
}
export function riser(bus, t0, t1, gain = 0.08) {
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

export function ostinato(bus, t0, t1, rootAt, { step = 0.21, gain = 0.05 } = {}) {
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

export function drone(bus, from, to, level, cutoff) {
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

export function reverseSwell(bus, notes, tEnd, dur, gain) {
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

export function formantChoir(bus) {
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

