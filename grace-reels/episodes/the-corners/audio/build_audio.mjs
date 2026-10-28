// Grace In Motion · The Corners — music, sound effects and final mix, all synthesized in code.
// Reads public/timeline.json + src/cues.mjs, writes audio/music.wav, audio/sfx.wav,
// audio/final_mix.wav (and public/final_mix.wav for Remotion).
// Usage: node audio/build_audio.mjs
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildCues} from '../src/cues.mjs';

const EP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SR = 48000;
const tl = JSON.parse(fs.readFileSync(`${EP}/public/timeline.json`, 'utf8'));
const {scenes: S, e: E} = buildCues(tl);
const DUR = tl.duration;
const N = Math.ceil(DUR * SR);

// ---------------------------------------------------------------- utilities
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const dbToGain = (db) => Math.pow(10, db / 20);
const stereo = () => [new Float32Array(N), new Float32Array(N)];
const idx = (t) => Math.round(t * SR);

function add(bus, t, mono, gain = 1, pan = 0) {
  const at = idx(t);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < mono.length; i++) {
    const j = at + i;
    if (j < 0 || j >= N) continue;
    bus[0][j] += mono[i] * gl;
    bus[1][j] += mono[i] * gr;
  }
}

class Biquad {
  constructor(type, f, q = 0.707) {
    this.set(type, f, q);
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  set(type, f, q) {
    const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
    const c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
    else if (type === 'hp') [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    else [b0, b1, b2] = [al, 0, -al]; // band-pass
    [a0, a1, a2] = [1 + al, -2 * c, 1 - al];
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

function env(i, len, att, rel) {
  const a = Math.min(1, i / Math.max(1, att * SR));
  const r = Math.min(1, (len - i) / Math.max(1, rel * SR));
  return Math.max(0, Math.min(a, r));
}

// ---------------------------------------------------------------- reverb (Freeverb)
function freeverb(bus, {room = 0.86, damp = 0.35, wet = 0.3, dry = 1} = {}) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const aps = [556, 441, 341, 225];
  const out = stereo();
  for (let ch = 0; ch < 2; ch++) {
    const spread = ch === 0 ? 0 : 23;
    const cb = combs.map((l) => ({buf: new Float32Array(Math.round((l + spread) * (SR / 44100))), i: 0, f: 0}));
    const ab = aps.map((l) => ({buf: new Float32Array(Math.round((l + spread) * (SR / 44100))), i: 0}));
    const x = bus[ch], y = out[ch];
    for (let n = 0; n < N; n++) {
      const inp = x[n] * 0.015;
      let s = 0;
      for (const c of cb) {
        const o = c.buf[c.i];
        c.f = o * (1 - damp) + c.f * damp;
        c.buf[c.i] = inp + c.f * room;
        if (++c.i >= c.buf.length) c.i = 0;
        s += o;
      }
      for (const a of ab) {
        const b = a.buf[a.i];
        a.buf[a.i] = s + b * 0.5;
        if (++a.i >= a.buf.length) a.i = 0;
        s = b - s;
      }
      y[n] = x[n] * dry + s * wet;
    }
  }
  return out;
}

// ---------------------------------------------------------------- instruments
function feltPiano(freq, vel, dur = 3.2) {
  const len = Math.round(dur * SR);
  const out = new Float32Array(len);
  const lp = new Biquad('lp', 1400 + vel * 1800, 0.6);
  const r = rng(Math.round(freq * 13));
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let s = 0;
    for (let k = 1; k <= 6; k++) {
      const inh = 1 + 0.0004 * k * k;
      s += (Math.sin(2 * Math.PI * freq * k * inh * t) / Math.pow(k, 1.9)) * Math.exp(-t * (0.9 + 0.75 * k));
    }
    const thump = i < 0.03 * SR ? (r() * 2 - 1) * Math.exp(-t * 160) * 0.25 : 0;
    const att = Math.min(1, t / 0.012);
    out[i] = lp.run((s + thump) * att * vel * 0.5) * env(i, len, 0.001, 0.3);
  }
  return out;
}

function harp(freq, vel, dur = 3.0, seed = 1) {
  const len = Math.round(dur * SR);
  const out = new Float32Array(len);
  const p = Math.max(2, Math.round(SR / freq));
  const buf = new Float32Array(p);
  const r = rng(seed);
  let prev = 0;
  for (let i = 0; i < p; i++) {
    const n = r() * 2 - 1;
    prev = prev * 0.72 + n * 0.28; // soft, felt-like pluck
    buf[i] = prev;
  }
  const lp = new Biquad('lp', 3200, 0.6);
  let j = 0;
  const decay = 0.4985 + Math.min(0.0012, freq / 4e6);
  for (let i = 0; i < len; i++) {
    const a = buf[j], b = buf[(j + 1) % p];
    const v = (a + b) * decay;
    buf[j] = v;
    out[i] = lp.run(a * vel * 1.1) * env(i, len, 0.004, 0.4);
    j = (j + 1) % p;
  }
  return out;
}

function padVoice(freq, dur, amp, bright = 1, seed = 1, vibrato = 0) {
  const len = Math.round(dur * SR);
  const out = new Float32Array(len);
  const lp1 = new Biquad('lp', 700 * bright, 0.7);
  const lp2 = new Biquad('lp', 1100 * bright, 0.6);
  const r = rng(seed);
  const det = [-0.11, 0.0, 0.09].map((c) => Math.pow(2, c / 12));
  const ph = det.map(() => r());
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const vib = vibrato ? 1 + vibrato * Math.sin(2 * Math.PI * 5.1 * t + ph[0] * 6) * Math.min(1, t / 1.2) : 1;
    let s = 0;
    for (let k = 0; k < det.length; k++) {
      ph[k] += (freq * det[k] * vib) / SR;
      if (ph[k] > 1) ph[k] -= 1;
      const saw = 2 * ph[k] - 1;
      const tri = 1 - 4 * Math.abs(ph[k] - 0.5);
      s += saw * 0.35 + tri * 0.65;
    }
    out[i] = lp2.run(lp1.run(s / det.length)) * amp;
  }
  return out;
}

function bell(freq, vel, dur = 2.2) {
  const len = Math.round(dur * SR);
  const out = new Float32Array(len);
  const parts = [[1, 1, 1.6], [2.01, 0.5, 2.6], [3.02, 0.25, 3.8], [4.18, 0.14, 5.2], [5.43, 0.08, 7]];
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let s = 0;
    for (const [m, a, d] of parts) s += Math.sin(2 * Math.PI * freq * m * t) * a * Math.exp(-t * d);
    out[i] = s * vel * 0.35 * Math.min(1, t / 0.004) * env(i, len, 0, 0.2);
  }
  return out;
}

function noiseBurst(dur, {seed = 1, type = 'bp', f0 = 1000, f1 = f0, q = 1, att = 0.005, rel = 0.05, shape = null} = {}) {
  const len = Math.round(dur * SR);
  const out = new Float32Array(len);
  const r = rng(seed);
  const flt = new Biquad(type, f0, q);
  for (let i = 0; i < len; i++) {
    const k = i / len;
    if (i % 32 === 0) flt.set(type, f0 * Math.pow(f1 / f0, k), q);
    const g = shape ? shape(k) : env(i, len, att, rel);
    out[i] = flt.run(r() * 2 - 1) * g;
  }
  return out;
}

// ---------------------------------------------------------------- MUSIC
const music = stereo();
const C = {
  D: [50, 57, 62, 66, 69, 64], Bm7: [47, 54, 62, 66, 69, 57], Gmaj7: [43, 50, 59, 62, 66, 55], Asus: [45, 52, 62, 64, 69, 57],
  A: [45, 52, 61, 64, 69, 57], Em7: [40, 47, 55, 62, 64, 59], Fsm: [42, 49, 57, 61, 66, 54], DF: [42, 50, 57, 62, 66, 69],
  AC: [49, 52, 57, 61, 64, 69], G: [43, 50, 59, 62, 67, 55], Bm: [47, 54, 59, 62, 66, 54],
};
const ws = (seg, t, n) => {
  try { return buildCues(tl).word(seg, t, n); } catch { return null; }
};
// [time, chord, section]  (sections drive harp density and colour)
const chart = [
  [0.0, 'D', 'open'], [S.S2.start, 'Bm7', 'rule'], [6.85, 'Gmaj7', 'rule'], [ws(4, 'land'), 'Asus', 'rule'], [ws(4, 'edges'), 'A', 'rule'],
  [S.S3.start, 'D', 'leave'], [ws(6, 'poor'), 'Gmaj7', 'leave'], [ws(7, 'always'), 'Em7', 'leave'], [ws(8, 'law'), 'Asus', 'leave'],
  [E.handOpen, 'DF', 'hand'],
  [S.S5.start, 'Bm', 'road'], [ws(11, 'ruth'), 'G', 'road'], [ws(12, 'she'), 'Em7', 'road'], [ws(12, 'foreigner'), 'Fsm', 'road'],
  [S.S6.start, 'Bm7', 'ask'], [ws(14, 'glean'), 'G', 'ask'],
  [S.S7.start, 'DF', 'corner'], [ws(15, 'corner'), 'G', 'corner'],
  [S.S8.start, 'Em7', 'notice'], [ws(16, 'happened'), 'Asus', 'notice'],
  [S.S9.start, 'D', 'boaz'], [ws(16, 'named'), 'G', 'boaz'], [ws(16, 'boaz') + 0.25, 'A', 'boaz'],
  [S.S10.start, 'D', 'family'], [E.dotObed, 'Bm7', 'family'], [E.dotJesse, 'G', 'family'], [E.dotDavid, 'A', 'family'],
  [S.S11.start, 'Em7', 'vine'], [S.S11.start + 0.7, 'Fsm', 'vine'], [S.S11.start + 1.35, 'G', 'vine'], [E.jesusBurst - 0.6, 'Asus', 'vine'],
  [E.jesusBurst, 'D', 'jesus'], [E.pullBack, 'AC', 'jesus'], [ws(20, 'picked'), 'Bm7', 'jesus'], [ws(20, 'leftovers'), 'G', 'jesus'],
  [S.S12.start, 'Gmaj7', 'manger'], [ws(21, 'yet'), 'DF', 'manger'], [ws(21, 'he', 1), 'Em7', 'manger'], [ws(21, 'poor'), 'Asus', 'manger'],
  [S.S13.start, 'D', 'forme'], [ws(23, 'least'), 'Bm7', 'forme'], [ws(23, 'mine'), 'G', 'forme'], [E.forMe, 'D', 'forme'],
  [S.S14.start, 'Gmaj7', 'city'], [ws(25, 'was'), 'DF', 'city'], [ws(25, 'open'), 'Em7', 'city'], [ws(26, 'people'), 'A', 'city'],
  [S.S15.start, 'Bm7', 'cta'], [ws(27, 'help'), 'Gmaj7', 'cta'], [ws(28, 'one'), 'Asus', 'cta'],
  [S.S16.start, 'D', 'end'],
];
for (const c of chart) if (c[0] == null) throw new Error(`chart time missing near ${c[1]}`);

const level = {
  open: 0.9, rule: 0.72, leave: 0.75, hand: 0.85, road: 0.62, ask: 0.6, corner: 0.7, notice: 0.66, boaz: 0.82,
  family: 0.92, vine: 0.8, jesus: 0.95, manger: 0.68, forme: 0.72, city: 0.8, cta: 0.62, end: 0.78,
};
const harpRate = {
  open: 3.2, rule: 2.6, leave: 2.8, hand: 3.6, road: 1.3, ask: 1.4, corner: 2.4, notice: 2.0, boaz: 3.6,
  family: 4.6, vine: 7.0, jesus: 3.4, manger: 1.8, forme: 2.2, city: 2.8, cta: 1.4, end: 2.0,
};
const bright = {road: 0.65, ask: 0.7, manger: 0.75, cta: 0.75, jesus: 1.5, family: 1.25, vine: 1.2};
const rMus = rng(73);

for (let ci = 0; ci < chart.length; ci++) {
  const [t0, name, sec] = chart[ci];
  const t1 = ci + 1 < chart.length ? chart[ci + 1][0] : DUR;
  const notes = C[name];
  const lv = level[sec];
  const br = bright[sec] ?? 1;
  const hold = t1 - t0 + 1.4; // overlap tails into the next chord
  // pad: bass + 4 upper voices
  notes.slice(0, 5).forEach((m, k) => {
    const v = padVoice(mtof(m), hold, (k === 0 ? 0.16 : 0.085) * lv, br, ci * 10 + k);
    const n = v.length;
    for (let i = 0; i < n; i++) v[i] *= env(i, n, ci === 0 ? 0.03 : 0.7, 1.3);
    add(music, t0, v, 1, (k - 2) * 0.22);
  });
  // strings an octave up, from the corner onward, swelling in the big moments
  if (!['open', 'rule', 'leave', 'hand', 'road'].includes(sec)) {
    const sv = sec === 'jesus' ? 0.07 : sec === 'vine' ? 0.05 : 0.035;
    notes.slice(2, 5).forEach((m, k) => {
      const v = padVoice(mtof(m + 12), hold, sv * lv, 1.6, ci * 31 + k, 0.004);
      const n = v.length;
      for (let i = 0; i < n; i++) v[i] *= env(i, n, sec === 'vine' ? 0.35 : 1.0, 1.2);
      add(music, t0, v, 1, k * 0.5 - 0.5);
    });
  }
  // harp arpeggios
  const rate = harpRate[sec];
  const arp = [...notes.slice(1).map((m) => m + 12), ...notes.slice(2).map((m) => m + 24)].sort((a, b) => a - b);
  let k = 0;
  for (let t = t0 + 0.05; t < t1 - 0.05; t += 1 / rate) {
    const up = sec === 'vine' ? k : Math.floor(rMus() * arp.length);
    const m = arp[up % arp.length];
    const v = harp(mtof(m), 0.32 * lv * (0.8 + rMus() * 0.4), 2.6, ci * 100 + k);
    add(music, t + rMus() * 0.03, v, 1, (rMus() - 0.5) * 0.8);
    k++;
  }
  // felt piano: melody note on each chord change, a reply note half way
  if (!['vine'].includes(sec)) {
    const top = notes[4] + 12;
    add(music, t0 + 0.02, feltPiano(mtof(top), 0.55 * lv), 1, 0.15);
    if (t1 - t0 > 1.6) add(music, t0 + (t1 - t0) * 0.55, feltPiano(mtof(notes[3] + 12), 0.4 * lv), 1, -0.1);
  }
}
// the big warm lift when "?" becomes JESUS: low boom + bright chord swell
{
  const t = E.jesusBurst;
  const boom = new Float32Array(Math.round(2.6 * SR));
  for (let i = 0; i < boom.length; i++) {
    const tt = i / SR;
    boom[i] = Math.sin(2 * Math.PI * (52 - 10 * Math.min(1, tt)) * tt) * Math.exp(-tt * 1.6) * 0.55;
  }
  add(music, t, boom, 1, 0);
  [74, 78, 81, 86].forEach((m, i) => add(music, t + i * 0.03, bell(mtof(m), 0.55, 3.2), 1, (i - 1.5) * 0.4));
  const swell = noiseBurst(1.6, {seed: 9, type: 'hp', f0: 5000, q: 0.5, shape: (k) => Math.pow(k, 2) * (1 - Math.pow(k, 8))});
  add(music, t - 1.45, swell, 0.08, 0);
}
// music level automation: gentle fade at the very end so the loop lands softly
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const g = t > DUR - 1.2 ? Math.max(0.55, 1 - (t - (DUR - 1.2)) / 2.6) : 1;
  music[0][i] *= g;
  music[1][i] *= g;
}
const musicWet = freeverb(music, {room: 0.88, damp: 0.3, wet: 0.42, dry: 0.85});

// ---------------------------------------------------------------- SFX
// Every effect is levelled relative to the voice (dB): beds ~-26, accents -10..-16 peak.
const voice = readWavMono(`${EP}/public/voice.wav`);
const active = new Uint8Array(N);
for (const sg of tl.segments) for (let i = idx(sg.start - 0.08); i < idx(sg.end + 0.12); i++) if (i >= 0 && i < N) active[i] = 1;
const vR = rms(voice, active);
function fit(buf, db, mode = 'peak') {
  let m = 0;
  if (mode === 'peak') for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
  else m = rms(buf);
  const g = (vR * dbToGain(db)) / Math.max(1e-9, m);
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}
const sfx = stereo();
const sfxRev = stereo(); // send bus for chimes and sparkles
const rS = rng(616);

function wind(t0, t1, lvl, seed) {
  const len = Math.round((t1 - t0) * SR);
  const out = new Float32Array(len);
  const r = rng(seed);
  const bp = new Biquad('bp', 500, 0.6);
  const lp = new Biquad('lp', 1400, 0.7);
  let brown = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    brown = (brown + (r() * 2 - 1) * 0.06) * 0.995;
    if (i % 64 === 0) bp.set('bp', 380 + 260 * Math.sin(t * 0.7 + seed) + 120 * Math.sin(t * 1.9), 0.6);
    const gust = 0.6 + 0.4 * Math.sin(t * 0.9 + seed) * Math.sin(t * 0.37 + 1.3);
    out[i] = lp.run(bp.run(brown * 6 + (r() * 2 - 1) * 0.15)) * gust * lvl * env(i, len, 0.4, 0.6);
  }
  return out;
}
const swish = (seed) => noiseBurst(0.26, {seed, type: 'bp', f0: 3800, f1: 700, q: 1.4, shape: (k) => Math.sin(Math.PI * Math.pow(k, 0.6)) ** 2});
const whoosh = (dur, seed, lo = 300, hi = 2400) =>
  noiseBurst(dur, {seed, type: 'bp', f0: lo, f1: hi, q: 0.9, shape: (k) => Math.sin(Math.PI * k) ** 2});
function pour(dur, lvl, seed) {
  const len = Math.round(dur * SR);
  const out = new Float32Array(len);
  const r = rng(seed);
  const hiss = new Biquad('bp', 4500, 0.7);
  for (let i = 0; i < len; i++) out[i] = hiss.run(r() * 2 - 1) * 0.06 * env(i, len, 0.08, 0.25);
  const count = Math.round(dur * 260);
  for (let c = 0; c < count; c++) {
    const at = Math.floor(r() * len);
    const f = 1800 + r() * 4500;
    const cl = noiseBurst(0.006, {seed: seed * 1000 + c, type: 'bp', f0: f, q: 3, att: 0.0005, rel: 0.005});
    const g = (0.25 + r() * 0.5) * env(at, len, 0.06, 0.3);
    for (let i = 0; i < cl.length && at + i < len; i++) out[at + i] += cl[i] * g;
  }
  for (let i = 0; i < len; i++) out[i] *= lvl;
  return out;
}
function footstep(seed, lvl) {
  const th = noiseBurst(0.09, {seed, type: 'lp', f0: 180, q: 0.7, att: 0.003, rel: 0.07});
  const cr = noiseBurst(0.07, {seed: seed + 7, type: 'bp', f0: 2400, q: 0.8, att: 0.002, rel: 0.06});
  const out = new Float32Array(th.length);
  for (let i = 0; i < out.length; i++) out[i] = (th[i] * 2.2 + (cr[i] || 0) * 0.5) * lvl;
  return out;
}
function voiceFormant(dur, f0fn, formants, lvl, seed) {
  const len = Math.round(dur * SR);
  const out = new Float32Array(len);
  const fl = formants.map(([f, q]) => new Biquad('bp', f, q));
  const r = rng(seed);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const k = i / len;
    ph += f0fn(k) / SR;
    if (ph > 1) ph -= 1;
    const src = (ph < 0.12 ? 1 : 0) - 0.12 + (r() * 2 - 1) * 0.04;
    let s = 0;
    for (const f of fl) s += f.run(src);
    out[i] = s * lvl * Math.sin(Math.PI * Math.min(1, k * 1.15)) ** 1.5;
  }
  return out;
}
function crackle(dur, lvl, seed) {
  const len = Math.round(dur * SR);
  const out = new Float32Array(len);
  const r = rng(seed);
  for (let c = 0; c < dur * 9; c++) {
    const at = Math.floor(r() * len);
    const cl = noiseBurst(0.004 + r() * 0.01, {seed: seed + c, type: 'bp', f0: 1500 + r() * 3000, q: 1.5, att: 0.0003, rel: 0.004});
    const g = 0.3 + r() * 0.7;
    for (let i = 0; i < cl.length && at + i < len; i++) out[at + i] += cl[i] * g * lvl;
  }
  return out;
}
const chime = (t, m, v = 0.5, pan = 0) => {
  const b = fit(bell(mtof(m), 1, 2.4), -13 + 20 * Math.log10(v / 0.45));
  add(sfx, t, b, 0.7, pan);
  add(sfxRev, t, b, 0.8, pan);
};

// S1 field: wind, sickles, four corners light up with rising chimes
add(sfx, 0, fit(wind(0, S.S3.end, 1, 1), -27, 'rms'), 1, -0.2);
add(sfx, 0, fit(wind(0, S.S3.end, 1, 2), -30, 'rms'), 1, 0.3);
[0.12, 0.62, 1.12, 1.62, 2.12].forEach((t, i) => add(sfx, t, fit(swish(10 + i), -12), 1, i % 2 ? 0.4 : -0.4));
E.cornerLit.forEach((t, i) => chime(t, [81, 85, 88, 93][i], 0.42, [-0.5, 0.5, -0.3, 0.3][i]));
chime(E.trackerIn, 86, 0.22, 0);
// S2 reapers' sickles + the corner that stays standing
E.swishesS2.forEach((t, i) => add(sfx, t, fit(swish(30 + i), -17), 1, i % 2 ? 0.35 : -0.25));
chime(E.edgesGlow, 88, 0.4, 0.4);
// scripture cards slide in on a soft paper whoosh
for (const c of [E.lev199, E.lev1910, E.deut1511, E.ruth22, E.cor89, E.matt2540]) add(sfx, c.in - 0.05, fit(whoosh(0.4, Math.round(c.in * 10), 500, 1800), -17), 1, 0);
// S3 families fill baskets
chime(E.cornersWord, 84, 0.35, 0.3);
E.pours.forEach((t, i) => add(sfx, t, fit(pour(1.2, 1, 40 + i), -19, 'rms'), 1, 0.2 - i * 0.2));
// S4 the hand opens: whoosh then grain into the basket
add(sfx, E.handOpen - 0.15, fit(whoosh(0.55, 50, 250, 1600), -10), 1, 0);
add(sfx, E.pour.start, fit(pour(E.pour.end - E.pour.start, 1, 51), -15, 'rms'), 1, 0);
add(sfx, E.grainLand, fit(noiseBurst(0.12, {seed: 52, type: 'lp', f0: 300, q: 0.7, att: 0.002, rel: 0.1}), -12), 1, 0);
// S5 road from Moab: dusty footsteps of two walkers, dry wind
add(sfx, S.S5.start, fit(wind(S.S5.start, S.S5.end, 1, 3), -25, 'rms'), 1, 0);
E.stepsS5.forEach((t, i) => {
  add(sfx, t, fit(footstep(60 + i, 1), -15), 1, -0.15);
  add(sfx, t + 0.27, fit(footstep(160 + i, 1), -18), 1, 0.15);
});
chime(E.ruthDotGlow, 81, 0.25, -0.3);
// S6 house: lamp crackle, quiet room
add(sfx, S.S6.start, fit(crackle(S.S6.end - S.S6.start, 1, 70), -24), 1, -0.3);
chime(E.gleanTag + 0.05, 88, 0.2, 0.2);
// S7 Ruth gathers leftover grain
add(sfx, S.S7.start, fit(wind(S.S7.start, S.S9.end, 1, 4), -28, 'rms'), 1, 0);
E.pickups.forEach((t, i) => add(sfx, t, fit(pour(0.45, 1, 80 + i), -20, 'rms'), 1, 0.1));
// S8 the map: a soft glowing path shimmer
add(sfx, E.butNotice, fit(feltPiano(mtof(57), 0.5, 2), -12), 1, 0);
for (let i = 0; i < 8; i++) chime(E.path.start + i * ((E.path.end - E.path.start) / 8), [74, 76, 78, 81, 83, 86, 88, 90][i], 0.16, -0.6 + i * 0.15);
// S9 whip pan and the secret extra grain
add(sfx, E.whipPan.start - 0.06, fit(whoosh(0.32, 90, 400, 4000), -9), 1, 0.3);
E.drops.forEach((t, i) => add(sfx, t, fit(pour(0.35, 1, 95 + i), -18, 'rms'), 1, 0.3 - i * 0.2));
chime(E.ruthAmazed, 90, 0.3, 0);
// S10 wedding: soft clap texture, baby coo, tracker dots
{
  const len = E.clap.end - E.clap.start;
  for (let c = 0; c < len * 7; c++) {
    const t = E.clap.start + rS() * len;
    add(sfx, t, fit(noiseBurst(0.03, {seed: 300 + c, type: 'bp', f0: 1300 + rS() * 900, q: 1.1, att: 0.0005, rel: 0.025}), -21), 1, rS() - 0.5);
  }
}
add(sfx, E.coo, fit(voiceFormant(0.5, (k) => 390 + 150 * Math.sin(Math.PI * k), [[340, 6], [880, 8], [2600, 10]], 1, 7), -15), 1, 0);
// tracker dots fill with a soft chime; JESUS gets the big bright chord (in the music)
chime(E.dotRuth, 81, 0.32, -0.4);
chime(E.dotObed, 83, 0.32, -0.2);
chime(E.dotJesse, 85, 0.32, 0.0);
chime(E.dotDavid, 86, 0.32, 0.2);
// S11 vine: magical rising shimmer into the burst
for (let i = 0; i < 14; i++) chime(E.vine.start + (i / 14) * (E.vine.end - E.vine.start - 0.1), 74 + [0, 2, 4, 7, 9][i % 5] + 12 * Math.floor(i / 5), 0.13 + i * 0.012, Math.sin(i) * 0.5);
add(sfx, E.vine.start, fit(noiseBurst(E.vine.end - E.vine.start, {seed: 110, type: 'bp', f0: 2000, f1: 9000, q: 0.7, shape: (k) => k * k}), -20), 1, 0);
[86, 90, 93, 98].forEach((m, i) => chime(E.jesusBurst + i * 0.02, m, 0.45, (i - 1.5) * 0.5));
chime(E.leftoversGlow, 81, 0.25, -0.2);
// S12 manger: lantern crackle, soft animals
add(sfx, S.S12.start, fit(crackle(S.S12.end - S.S12.start, 1, 120), -22), 1, 0.3);
add(sfx, S.S12.start + 0.6, fit(voiceFormant(0.7, (k) => 300 + 25 * Math.sin(k * 40), [[700, 5], [1150, 7], [2400, 9]], 1, 121), -22), 1, -0.5);
add(sfx, S.S12.start + 2.4, fit(noiseBurst(0.5, {seed: 122, type: 'lp', f0: 500, q: 0.8, shape: (k) => Math.sin(Math.PI * k) * (0.6 + 0.4 * Math.sin(k * 60))}), -22), 1, 0.5);
// S13 bread breaking
add(sfx, E.breadBreak, fit(crackle(0.35, 1, 130), -16), 1, 0);
chime(E.forMe, 86, 0.3, 0);
// S14 city street ambience + match-cut whoosh
add(sfx, E.matchCut - 0.12, fit(whoosh(0.45, 140, 300, 2000), -12), 1, 0);
{
  const len = Math.round((S.S14.end - S.S14.start) * SR);
  const out = new Float32Array(len);
  const r = rng(141);
  const lp = new Biquad('lp', 350, 0.7);
  const car = new Biquad('bp', 600, 0.8);
  let br = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    br = (br + (r() * 2 - 1) * 0.05) * 0.996;
    const swell = Math.max(0, Math.sin(t * 0.9)) ** 3;
    out[i] = (lp.run(br * 5) * 0.6 + car.run(r() * 2 - 1) * 0.12 * swell) * env(i, len, 0.3, 0.5) * 0.5;
  }
  add(sfx, S.S14.start, fit(out, -27, 'rms'), 1, 0);
}
chime(E.handoff, 85, 0.3, 0);
// S15 typing taps and heart pops
{
  const chars = E.ctaText.length + 2;
  for (let c = 0; c < chars; c++) {
    const t = E.typing.start + (c / chars) * (E.typing.end - E.typing.start);
    add(sfx, t, fit(noiseBurst(0.012, {seed: 150 + c, type: 'bp', f0: 2600, q: 2, att: 0.0005, rel: 0.01}), -17), 1, 0.1);
  }
  for (let h = 0; h < 5; h++) {
    const t = E.hearts.start + h * 0.22;
    const len = Math.round(0.09 * SR);
    const pop = new Float32Array(len);
    for (let i = 0; i < len; i++) pop[i] = Math.sin(2 * Math.PI * (900 - 3000 * (i / SR)) * (i / SR)) * Math.exp(-(i / SR) * 45) * 0.3;
    add(sfx, t, fit(pop, -15), 1, 0.3 - h * 0.12);
  }
}
// S16 logo draws itself
add(sfx, E.logoDraw.start, fit(noiseBurst(1.0, {seed: 160, type: 'bp', f0: 3000, f1: 8000, q: 0.8, shape: (k) => Math.sin(Math.PI * k)}), -22), 1, 0);
chime(E.logoDraw.end, 86, 0.35, 0);
chime(E.logoDraw.end + 0.04, 90, 0.25, 0.3);
add(sfx, E.loopFlow.start, fit(wind(E.loopFlow.start, DUR + 0.6, 1, 5), -27, 'rms'), 1, 0); // wind leads back into the opening field

const sfxWet = freeverb(sfxRev, {room: 0.8, damp: 0.4, wet: 1, dry: 0});
for (let ch = 0; ch < 2; ch++) for (let i = 0; i < N; i++) sfx[ch][i] += sfxWet[ch][i] * 0.5;

// ---------------------------------------------------------------- WAV io
function readWavMono(file) {
  const b = fs.readFileSync(file);
  let p = 12, fmt, data;
  while (p < b.length) {
    const id = b.toString('ascii', p, p + 4), sz = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = {ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22), fmtTag: b.readUInt16LE(p + 8)};
    if (id === 'data') data = b.subarray(p + 8, p + 8 + sz);
    p += 8 + sz + (sz % 2);
  }
  if (fmt.sr !== SR) throw new Error('voice must be 48 kHz');
  const bps = fmt.bits / 8, frames = data.length / (bps * fmt.ch);
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const o = i * bps * fmt.ch;
    out[i] = fmt.bits === 24 ? data.readIntLE(o, 3) / 8388608 : fmt.bits === 16 ? data.readInt16LE(o) / 32768 : data.readFloatLE(o);
  }
  return out;
}
function writeWav(file, chans) {
  const n = chans[0].length, ch = chans.length;
  const b = Buffer.alloc(44 + n * ch * 3);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * ch * 3, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * ch * 3, 28); b.writeUInt16LE(ch * 3, 32); b.writeUInt16LE(24, 34); b.write('data', 36); b.writeUInt32LE(n * ch * 3, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    b.writeIntLE(Math.round(Math.max(-1, Math.min(1, chans[c][i])) * 8388607), o, 3);
    o += 3;
  }
  fs.writeFileSync(file, b);
}
function rms(x, mask) {
  let s = 0, c = 0;
  for (let i = 0; i < x.length; i++) if (!mask || mask[i]) { s += x[i] * x[i]; c++; }
  return Math.sqrt(s / Math.max(1, c));
}

// ---------------------------------------------------------------- MIX
// smooth duck envelope: about 8 dB down under the voice
const duck = new Float32Array(N);
{
  let g = 1;
  const down = dbToGain(-8);
  const aA = Math.exp(-1 / (0.12 * SR)), aR = Math.exp(-1 / (0.4 * SR));
  for (let i = 0; i < N; i++) {
    const target = active[i] ? down : 1;
    g = target < g ? target + (g - target) * aA : target + (g - target) * aR;
    duck[i] = g;
  }
}
const mR = rms(musicWet[0]);
const musicGain = (vR * dbToGain(-7)) / mR; // un-ducked bed sits ~7 dB under the voice, ~15 dB when ducked
const sfxGain = 1.0;
const mix = stereo();
for (let i = 0; i < N; i++) {
  const v = voice[i] || 0;
  for (let c = 0; c < 2; c++) {
    mix[c][i] = v + musicWet[c][i] * musicGain * duck[i] + sfx[c][i] * sfxGain * (active[i] ? 0.8 : 1);
  }
}
writeWav(`${EP}/audio/music.wav`, musicWet.map((ch) => ch.map((x) => x * musicGain)));
writeWav(`${EP}/audio/sfx.wav`, sfx.map((ch) => ch.map((x) => x * sfxGain)));
const pre = `${EP}/audio/mix_prenorm.wav`;
writeWav(pre, mix);

// ---------------------------------------------------------------- loudness: -14 LUFS, true peak -1 dBTP (two-pass loudnorm)
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-nostats', ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
const measure = (file, extra = '') => {
  const r = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${file}" -af "${extra}loudnorm=I=-14:TP=-1:LRA=11:print_format=json" -f null - 2>&1`], {encoding: 'utf8'});
  return JSON.parse(r.slice(r.lastIndexOf('{'), r.lastIndexOf('}') + 1));
};
const m0 = measure(pre);
const gain = -14 - parseFloat(m0.input_i);
// gain into a gentle peak limiter first, so the second loudnorm pass can stay linear
const limited = `${EP}/audio/mix_limited.wav`;
ff(['-y', '-i', pre, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.85:attack=4:release=80:level=disabled`, '-ar', '48000', '-c:a', 'pcm_s24le', limited]);
const m1 = measure(limited);
const out = `${EP}/audio/final_mix.wav`;
ff(['-y', '-i', limited, '-af',
  `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${m1.input_i}:measured_TP=${m1.input_tp}:measured_LRA=${m1.input_lra}:measured_thresh=${m1.input_thresh}:offset=${m1.target_offset}:linear=true:print_format=summary`,
  '-ar', '48000', '-c:a', 'pcm_s24le', out]);
fs.copyFileSync(out, `${EP}/public/final_mix.wav`);
fs.unlinkSync(limited);
const m2 = measure(out);
const report = `final_mix.wav  integrated ${m2.input_i} LUFS, true peak ${m2.input_tp} dBTP, LRA ${m2.input_lra} LU\n` +
  `music gain ${musicGain.toFixed(3)}, ducking -8 dB under voice, duration ${DUR}s\n`;
fs.writeFileSync(`${EP}/audio/mix_report.txt`, report);
console.log(report);
