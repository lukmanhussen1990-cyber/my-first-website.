// Synth instruments: band-limited wavetable pad, felt piano, soft pluck, bells, sub bass.
// Each note renders into a stereo dry bus plus optional mono reverb sends: sends = [[buf, amt], ...].
import { SR, TAU, makeRng, clamp, mtof, smooth, cosRamp, relCurve, svf, filt, onePoleLP, f32, place, rmsOf } from './dsp.mjs';

// ------------------------------------------------------------------ band-limited wavetables
const WT = 4096;
function buildTables(kind) {
  const sinT = new Float64Array(WT); for (let i = 0; i < WT; i++) sinT[i] = Math.sin(TAU * i / WT);
  const bands = [];
  for (let k = 0; k < 26; k++) {
    const fTop = 16 * Math.pow(2, (k + 1) / 2);                       // half-octave bands
    const H = Math.max(1, Math.min(WT / 2 - 1, Math.floor(18500 / fTop)));
    const acc = new Float64Array(WT);
    for (let h = 1; h <= H; h++) {
      let a = 0;
      if (kind === 'saw') a = 2 / Math.PI / h;
      else if (kind === 'tri') a = h % 2 ? (((h - 1) / 2) % 2 ? -1 : 1) * 8 / (Math.PI * Math.PI) / (h * h) : 0;
      else if (kind === 'sine') a = h === 1 ? 1 : 0;
      if (!a) continue;
      const x = Math.PI * h / (H + 1); a *= Math.sin(x) / x;           // Lanczos sigma: no Gibbs ripple
      for (let i = 0, idx = 0; i < WT; i++, idx = (idx + h) & (WT - 1)) acc[i] += a * sinT[idx];
    }
    const tab = new Float32Array(WT + 1); for (let i = 0; i < WT; i++) tab[i] = acc[i]; tab[WT] = tab[0];
    bands.push({ fTop, tab });
  }
  return bands;
}
const TABLES = { saw: buildTables('saw'), tri: buildTables('tri'), sine: buildTables('sine') };
const pickTable = (kind, f) => { const b = TABLES[kind]; for (const x of b) if (x.fTop >= f) return x.tab; return b[b.length - 1].tab; };

// render one oscillator voice (with slow random pitch drift) and add it into L/R with gains
function osc(L, R, kind, f, n, gl, gr, r, driftCents = 1.8) {
  const tab = pickTable(kind, f * 1.02);
  let ph = r.next() * WT; const inc0 = f * WT / SR;
  const dR1 = r.uni(0.05, 0.16), dR2 = r.uni(0.17, 0.4), p1 = r.next() * TAU, p2 = r.next() * TAU;
  const depth = driftCents / 1200 * Math.LN2;
  for (let b = 0; b < n; b += 64) {
    const t = b / SR;
    const inc = inc0 * Math.exp(depth * (0.7 * Math.sin(TAU * dR1 * t + p1) + 0.3 * Math.sin(TAU * dR2 * t + p2)));
    const e = Math.min(n, b + 64);
    for (let i = b; i < e; i++) {
      const ip = ph | 0, s = tab[ip] + (ph - ip) * (tab[ip + 1] - tab[ip]);
      L[i] += s * gl; R[i] += s * gr;
      ph += inc; if (ph >= WT) ph -= WT;
    }
  }
}

// ------------------------------------------------------------------ pad note
// o: midi, t0 (note on), t1 (note off), att, rel (s), amp, cutoff(tAbs) Hz, q, voices, detune (cents),
//    spread (0..1 stereo width), wave, lfo (filter wobble depth), sends, seed
export function padNote(bus, o) {
  const { midi, t0, t1, att = 1.6, rel = 2.4, amp = 0.1, cutoff = () => 1200, q = 0.62, voices = 4, detune = 9,
    spread = 0.8, wave = 'saw', lfo = 0.18, sends = null, seed = 'pad', drift = 1.8, bloom = 0.45, keyTrack = 0 } = o;
  const r = makeRng(`${seed}:${midi}:${t0.toFixed(3)}`);
  const f0 = mtof(midi), nHold = Math.max(1, Math.round((t1 - t0) * SR)), nRel = Math.round(rel * SR), n = nHold + nRel;
  const L = f32(n), R = f32(n);
  for (let v = 0; v < voices; v++) {
    const u = voices === 1 ? 0 : (v / (voices - 1)) * 2 - 1;           // -1..1 across the stack
    const det = u * detune + r.uni(-1.2, 1.2);
    const pan = voices === 1 ? 0 : (v % 2 ? 1 : -1) * spread * (0.45 + 0.55 * Math.abs(u));
    const a = (pan + 1) * Math.PI / 4;
    osc(L, R, wave, f0 * Math.pow(2, det / 1200), n, Math.cos(a), Math.sin(a), r, drift);
  }
  const lr = r.uni(0.035, 0.08), lp = r.next() * TAU, nA = att * SR;
  const fcAt = (i) => {
    const t = i / SR, open = 1 - bloom + bloom * smooth(i / (nA * 1.4));
    return cutoff(t0 + t) * open * (1 + lfo * Math.sin(TAU * lr * t + lp)) * (1 + keyTrack * (f0 / 261.6 - 1));
  };
  svf(L, fcAt, q, 'lp', 32); svf(R, fcAt, q, 'lp', 32);
  const g = amp / Math.sqrt(voices);
  for (let i = 0; i < n; i++) {
    let e = i < nA ? cosRamp(i / nA) : 1;
    if (i >= nHold) e *= relCurve((i - nHold) / nRel, 3.2);
    L[i] *= e * g; R[i] *= e * g;
  }
  place(bus, { L, R }, t0, 1, 0, sends);
}

// ------------------------------------------------------------------ felt piano
// Additive: up to 18 slightly inharmonic partials, each as two detuned damped "strings"
// (prompt + aftersound decay => natural two-stage decay and gentle beating), soft felt
// roll-off, strike-position comb, felt thump, damper on release.
export function pianoNote(bus, o) {
  const { midi, t, vel = 0.4, dur = 2.2, pan = 0, gain = 1, sends = null, seed = 'pno', felt = 1 } = o;
  const r = makeRng(`${seed}:${midi}:${t.toFixed(3)}`);
  const f0 = mtof(midi), damp = 0.11, nHold = Math.round(dur * SR), n = nHold + Math.round(damp * 7 * SR);
  const out = new Float64Array(n);
  const Binh = 0.00011 * Math.pow(2, (midi - 48) / 13);
  const bright = (380 + 1500 * vel * vel) / felt + f0 * 1.1;           // felt hammer: dark, velocity-dependent
  const tau1 = clamp(3.0 * Math.pow(261.6 / f0, 0.62), 0.6, 7.5);
  for (let p = 1; p <= 18; p++) {
    const fp = p * f0 * Math.sqrt(1 + Binh * p * p);
    if (fp > 9000) break;
    let a = 1 / Math.pow(p, 0.85);
    a /= 1 + Math.pow(fp / bright, 2.4);
    a *= 0.5 + 0.5 * Math.abs(Math.sin(Math.PI * p * 0.137));          // hammer strike point ~1/7.3
    if (a < 2e-4) continue;
    const tau = tau1 / (1 + 0.3 * (p - 1)) * r.uni(0.85, 1.15);
    const cents = r.uni(0.3, 1.2);
    for (let s = 0; s < 2; s++) {
      const fs = fp * Math.pow(2, (s ? cents : -cents) / 2400);
      const ts = s ? tau * 1.05 : tau * 0.2, as = s ? 0.32 : 0.68;      // prompt sound + aftersound
      const rr = Math.exp(-1 / (ts * SR)), w = TAU * fs / SR, cr = rr * Math.cos(w), sr = rr * Math.sin(w);
      const m = Math.min(n, Math.ceil(ts * SR * 9.3));
      let re = 1, im = 0; const A = a * as;
      for (let i = 0; i < m; i++) { out[i] += A * im; const nr = re * cr - im * sr; im = re * sr + im * cr; re = nr; }
    }
  }
  // felt thump (very low, short) + a breath of hammer noise
  const nt = Math.min(n, Math.round(0.06 * SR)); let y = 0, y2 = 0;
  const ca = 1 - Math.exp(-TAU * 700 / SR);
  for (let i = 0; i < nt; i++) {
    const tt = i / SR;
    y += ca * (r.uni(-1, 1) - y); y2 += ca * (y - y2);
    out[i] += 0.5 * y2 * Math.exp(-tt / 0.008) * (0.4 + vel) + 0.05 * Math.sin(TAU * 95 * tt) * Math.exp(-tt / 0.02);
  }
  // attack (felt is soft) + damper release
  const tA = 0.0025 + 0.006 * (1 - vel), nDamp = damp * SR;
  for (let i = 0; i < n; i++) {
    let e = 1 - Math.exp(-(i / SR) / tA);
    if (i > nHold) e *= Math.exp(-(i - nHold) / nDamp);
    if (i > n - 480) e *= (n - i) / 480;
    out[i] *= e;
  }
  const x = Float32Array.from(out);
  onePoleLP(x, 4200 + 2500 * vel);
  filt(x, 'hp', 45, 0.7);
  // loudness-normalise by the attack RMS so different registers sit evenly
  const ref = rmsOf(x, 0, Math.min(x.length, Math.round(0.25 * SR))) || 1;
  const g = gain * Math.pow(vel, 1.35) * 0.32 / ref;
  for (let i = 0; i < x.length; i++) x[i] *= g;
  place(bus, x, t, 1, pan, sends);
}

// ------------------------------------------------------------------ soft pluck (pulse)
export function pluckNote(bus, o) {
  const { midi, t, vel = 0.5, cutoff = 650, decay = 0.15, pan = 0, gain = 1, sends = null, seed = 'plk', wave = 'saw' } = o;
  const r = makeRng(`${seed}:${midi}:${t.toFixed(3)}`);
  const f0 = mtof(midi), n = Math.round((decay * 7 + 0.03) * SR);
  const L = f32(n), R = f32(n);
  osc(L, R, wave, f0 * Math.pow(2, -2.5 / 1200), n, 0.75, 0.55, r, 0.4);
  osc(L, R, wave, f0 * Math.pow(2, 2.5 / 1200), n, 0.55, 0.75, r, 0.4);
  const fc = (i) => cutoff * (1 + 2.2 * vel * Math.exp(-(i / SR) / 0.045));
  svf(L, fc, 0.8, 'lp', 16); svf(R, fc, 0.8, 'lp', 16);
  const g = gain * vel * 0.6;
  for (let i = 0; i < n; i++) {
    const tt = i / SR; let e = (1 - Math.exp(-tt / 0.0025)) * Math.exp(-tt / decay);
    if (i > n - 480) e *= (n - i) / 480;
    L[i] *= e * g; R[i] *= e * g;
  }
  place(bus, { L, R }, t, 1, pan, sends);
}

// ------------------------------------------------------------------ bells / chimes (additive, damped)
// returns a mono Float32Array
export function bell(f, { dur = 2.6, bright = 1, seed = 'bell', partials = null, attack = 0.0015 } = {}) {
  const r = makeRng(`${seed}:${f.toFixed(2)}`);
  const P = partials || [[1, 1, 1], [2.0, 0.32, 0.6], [2.76, 0.2 * bright, 0.42], [4.07, 0.1 * bright, 0.3], [5.43, 0.06 * bright, 0.22], [0.5, 0.06, 1.3]];
  const n = Math.round(dur * SR), x = new Float64Array(n), tau = dur / 6.9;
  for (const [ratio, amp, dk] of P) {
    const fp = f * ratio * (1 + r.uni(-0.0015, 0.0015)); if (fp > 16000) continue;
    for (let s = 0; s < 2; s++) {                                       // two detuned modes => shimmer
      const ff = fp * (s ? 1.0007 : 0.9993), ts = tau * dk * (s ? 1 : 0.8);
      const rr = Math.exp(-1 / (ts * SR)), w = TAU * ff / SR, cr = rr * Math.cos(w), sr = rr * Math.sin(w);
      let re = 1, im = 0; const A = amp * 0.5, m = Math.min(n, Math.ceil(ts * SR * 9.3));
      for (let i = 0; i < m; i++) { x[i] += A * im; const nr = re * cr - im * sr; im = re * sr + im * cr; re = nr; }
    }
  }
  const out = f32(n), nA = attack * SR;
  for (let i = 0; i < n; i++) { let e = i < nA ? cosRamp(i / nA) : 1; if (i > n - 960) e *= (n - i) / 960; out[i] = x[i] * e; }
  return out;
}

// ------------------------------------------------------------------ sub / bass note (sine + soft harmonics)
export function bassNote(bus, o) {
  const { midi, t0, t1, amp = 0.2, att = 0.35, rel = 1.2, sends = null, h2 = 0.28, h3 = 0.1, drive = 1.2, seed = 'bass' } = o;
  const r = makeRng(`${seed}:${midi}:${t0.toFixed(3)}`);
  const f = mtof(midi), nHold = Math.round((t1 - t0) * SR), nRel = Math.round(rel * SR), n = nHold + nRel, nA = att * SR;
  const x = f32(n); const ph0 = r.next() * TAU, th = Math.tanh(drive);
  const w = TAU * f / SR;
  for (let i = 0; i < n; i++) {
    const ph = w * i + ph0;
    let s = Math.sin(ph) + h2 * Math.sin(2 * ph) + h3 * Math.sin(3 * ph);
    s = Math.tanh(s * drive * 0.7) / th;
    let e = i < nA ? cosRamp(i / nA) : 1; if (i >= nHold) e *= relCurve((i - nHold) / nRel, 3);
    x[i] = s * e * amp;
  }
  filt(x, 'lp', 420, 0.7);
  place(bus, x, t0, 1, 0, sends);
}
