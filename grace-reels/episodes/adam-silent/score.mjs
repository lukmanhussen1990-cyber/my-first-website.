// Music + sound effects for "Why Didn't Adam Stop Her?" (key of D / B minor).
// Reads public/cues.json, writes audio/music.wav and audio/sfx.wav (48 kHz float).
import fs from 'node:fs';
import {
  Bus, SR, rng, mtof, piano, strings, choir, tone, thump, bell,
  noise, pinkify, biquad, place, reverb, writeWav,
} from '../../tools/audio/dsp.mjs';

const { cues: c } = JSON.parse(fs.readFileSync(new URL('./public/cues.json', import.meta.url)));
const T = c.total + 0.2;
const M = new Bus(T);
const X = new Bus(T);
const R = rng(107);
const D_MAJ9 = [50, 57, 62, 64, 66, 69];

// ---------------- MUSIC ----------------
// S1 Eden at dusk: warm, dreamy Dmaj9 with a gentle piano arpeggio (also the loop tail)
choir(M, 0, c.silentNote + 0.2, [50, 57, 62, 66], 0.55, { att: 0.08, rel: 1.6, seed: 1 });
strings(M, 0, c.silentNote, [38, 50, 57, 64, 66], 0.45, { att: 0.08, rel: 1.4, seed: 2 });
[62, 69, 76, 78, 74, 69].forEach((m, i) => piano(M, 0.05 + i * 0.5, m, 0.36, 1.6, 0.2));
// "didn't say a word": everything falls away to one held note
strings(M, c.silentNote, c.quoteCard + 0.4, [69], 0.2, { att: 0.5, rel: 1.2, bright: 1600, seed: 3 });
tone(M, c.silentNote, c.quoteCard, mtof(38), 0.05, { att: 1, rel: 1 });
piano(M, c.eveCU + 0.15, 78, 0.28, 2.2, 0.3);
piano(M, c.readSlowly + 0.1, 71, 0.26, 2.0, -0.2);
// S2 quote card: warm strings Bm(add9) -> G -> D/F# -> Asus
const qc = c.quoteCard;
strings(M, qc, qc + 2.3, [47, 54, 59, 61, 62, 66], 0.5, { att: 0.9, rel: 1.0, seed: 4 });
strings(M, qc + 2.3, c.withHer, [43, 50, 55, 59, 62, 67], 0.5, { att: 0.9, rel: 1.0, seed: 5 });
strings(M, c.withHer, c.quoteEnd, [42, 50, 57, 62, 66, 69], 0.56, { att: 0.6, rel: 1.0, seed: 6 });
choir(M, c.withHer - 0.2, c.quoteEnd, [62, 66, 69], 0.4, { vowel: 'ah', att: 0.8, rel: 1.4 });
strings(M, c.quoteEnd, c.handoff + 0.6, [45, 52, 57, 62, 64], 0.42, { att: 0.5, rel: 1.0, seed: 8 });
piano(M, qc + 0.1, 74, 0.3, 2.4, 0.2);
piano(M, c.withHer, 74, 0.34, 2.6, 0.1);
piano(M, c.withHer + 0.02, 81, 0.22, 2.6, 0.3);
// S3 with her: warm D, quieter
strings(M, c.handoff, c.snake, [38, 50, 57, 62, 66], 0.36, { att: 0.6, rel: 1.4, seed: 9 });
piano(M, c.handoff + 0.05, 74, 0.3, 2.0, 0);
piano(M, c.wholeTime + 0.1, 69, 0.24, 2.0, -0.2);
// S4 silent: a single held F#, low B drone, the G rubs against it
strings(M, c.snake, c.hideScene + 0.3, [66], 0.18, { att: 0.6, rel: 1.2, bright: 1400, seed: 10 });
tone(M, c.snake, c.hideScene, mtof(35), 0.06, { att: 1.2, rel: 1 });
strings(M, c.watchedReach, c.saidNothing + 0.3, [67], 0.11, { att: 0.8, rel: 0.8, bright: 1300, seed: 11 });
// S5 hiding: cold and thin, high sine harmonics
tone(M, c.hideScene, c.godCalled + 0.6, mtof(83), 0.026, { att: 1.0, rel: 1.2, trem: 0.4, tremRate: 0.4, pan: -0.3 });
tone(M, c.hideScene + 0.4, c.godCalled + 0.6, mtof(90), 0.014, { att: 1.0, rel: 1.2, trem: 0.5, tremRate: 0.27, pan: 0.4 });
// S6 "Where art thou?": a deep, soft presence chord
choir(M, c.whereArtThou - 0.3, c.adamSaid + 0.3, [50, 57, 62], 0.5, { vowel: 'oo', att: 0.6, rel: 1.2, seed: 12 });
tone(M, c.godCalled, c.adamSaid, mtof(38), 0.07, { att: 0.6, rel: 0.6 });
// S7-S8 blame: heartbeat pulses + minor strings
for (let t = c.adamSaid; t < c.web; t += 60 / 72) {
  thump(M, t, 0.28);
  thump(M, t + 0.22, 0.14);
}
strings(M, c.adamSaid, c.eveHurt, [47, 54, 59, 62], 0.38, { att: 0.6, rel: 0.6, seed: 13 });
strings(M, c.eveHurt, c.blamedHer, [40, 52, 55, 59, 64], 0.4, { att: 0.5, rel: 0.6, seed: 14 });
strings(M, c.blamedHer, c.eveSaid, [43, 55, 59, 61, 62], 0.4, { att: 0.5, rel: 0.6, seed: 15 });
strings(M, c.eveSaid, c.web, [42, 54, 59, 61, 66], 0.42, { att: 0.5, rel: 0.6, seed: 16 });
strings(M, c.T3, c.web, [42, 54, 58, 61, 66], 0.3, { att: 0.3, rel: 0.6, seed: 17 });
// S9 the web: pulse resolves into a sad Bm(add9)
strings(M, c.web, c.modern + 0.8, [35, 47, 54, 59, 61, 62], 0.42, { att: 0.4, rel: 1.4, seed: 18 });
choir(M, c.web, c.modern + 0.5, [59, 62, 66], 0.32, { att: 0.5, rel: 1.4, seed: 19 });
// S10 modern room: sad, personal solo piano in B minor
piano(M, c.modern, 47, 0.32, 4, -0.3);
piano(M, c.modern + 0.02, 54, 0.26, 4, -0.2);
[[c.modern + 0.4, 74], [c.T4, 73], [c.T5, 71], [c.T6, 69]].forEach(([t, m]) => piano(M, t, m, 0.32, 1.8, 0.2));
piano(M, c.T7, 43, 0.3, 3, -0.3);
piano(M, c.T7 + 0.01, 67, 0.3, 3, 0.2);
piano(M, c.T7 + 0.6, 66, 0.26, 2.4, 0.2);
// S11 but notice: hush, one sustained fifth
strings(M, c.butNotice, c.oneMan + 0.4, [57, 62], 0.28, { att: 1.0, rel: 1.0, bright: 1500, seed: 20 });
piano(M, c.calledAdam, 74, 0.3, 2.2, 0);
// S12 one man: low strings G -> D/F#
strings(M, c.oneMan, c.oneManGold, [31, 43, 50, 55, 59], 0.4, { att: 0.8, rel: 0.8, bright: 1500, seed: 21 });
strings(M, c.oneManGold, c.gethsemane + 0.5, [30, 42, 50, 57, 62], 0.42, { att: 0.5, rel: 1.2, bright: 1500, seed: 22 });
// S13 Gethsemane: deep hush, low drone, faint choir
tone(M, c.gethsemane, c.torches + 1, mtof(26), 0.05, { att: 1.0, rel: 1.5, harm2: 0.3 });
choir(M, c.gethsemane + 0.3, c.torches + 0.5, [50, 54, 57], 0.3, { att: 1.5, rel: 1.5, seed: 23 });
// S14 torches: tension build, slower pulse, rising strings
for (let t = c.torches; t < c.iAmHe - 0.2; t += 1.0) thump(M, t, 0.24, 48);
strings(M, c.torches, c.didntHide, [35, 47, 54, 59], 0.36, { att: 0.6, rel: 0.6, seed: 24 });
strings(M, c.didntHide, c.steppedForward, [31, 43, 50, 59], 0.4, { att: 0.5, rel: 0.6, seed: 25 });
strings(M, c.steppedForward, c.iAmHe, [33, 45, 52, 57, 61], 0.46, { att: 0.5, rel: 0.4, seed: 26 });
// S15 "I am he": strong warm swell
strings(M, c.iAmHe - 0.1, c.letTheseGo + 0.4, [26, 38, 50, 57, 62, 66, 69, 74], 0.75, { att: 0.35, rel: 1.2, bright: 3000, seed: 27 });
choir(M, c.iAmHe - 0.1, c.letTheseGo + 0.4, [57, 62, 66, 69], 0.6, { vowel: 'ah', att: 0.4, rel: 1.4, seed: 28 });
piano(M, c.iAmHe, 38, 0.5, 3, -0.2);
piano(M, c.iAmHe, 74, 0.4, 3, 0.2);
// S16 let these go: warm, protective G -> D/F#
strings(M, c.letTheseGo, c.protected, [31, 43, 50, 55, 59, 62, 67], 0.46, { att: 0.6, rel: 0.8, seed: 29 });
strings(M, c.protected, c.adamHid + 0.4, [30, 42, 50, 57, 62, 66], 0.46, { att: 0.5, rel: 1.0, seed: 30 });
piano(M, c.letThese, 71, 0.3, 2.2, 0.2);
piano(M, c.protected, 69, 0.3, 2.2, 0.2);
// S17 Adam hid (thin echo), then the rising swell as Jesus steps out
tone(M, c.adamHid, c.jesusStepped + 0.6, mtof(83), 0.022, { att: 0.5, rel: 0.8, trem: 0.4, tremRate: 0.5 });
strings(M, c.adamHid, c.jesusStepped, [35, 47, 54], 0.26, { att: 0.5, rel: 0.6, seed: 31 });
strings(M, c.jesusStepped, c.melt, [40, 52, 55, 59, 62, 64], 0.5, { att: 1.2, rel: 0.5, seed: 32 });
strings(M, c.tookIt, c.melt, [45, 52, 57, 62, 64, 69], 0.55, { att: 0.6, rel: 0.4, seed: 33 });
// the biggest warm chord as the threads melt into light: Gmaj9 -> D(add9)
strings(M, c.melt, c.knewNoSin, [31, 43, 50, 55, 59, 62, 66, 69], 0.8, { att: 0.3, rel: 1.0, bright: 3200, seed: 34 });
choir(M, c.melt, c.knewNoSin, [55, 59, 62, 66, 69], 0.7, { vowel: 'ah', att: 0.3, rel: 1.0, seed: 35 });
strings(M, c.knewNoSin, c.stopPassing + 1.2, [26, 38, 50, 57, 62, 64, 66, 69, 74], 0.82, { att: 0.25, rel: 1.6, bright: 3400, seed: 36 });
choir(M, c.knewNoSin, c.stopPassing + 1.0, [57, 62, 66, 69, 74], 0.72, { vowel: 'ah', att: 0.25, rel: 1.8, seed: 37 });
[[c.melt, [43, 55, 62, 71]], [c.knewNoSin, [38, 50, 66, 74]]].forEach(([t, ns]) => ns.forEach((m, i) => piano(M, t + i * 0.09, m, 0.42, 3.2, -0.3 + i * 0.2)));
// S18 dawn: hopeful arpeggios D -> A/C# -> Bm -> G
const dawn = [[c.stopPassing, [50, 57, 62, 66]], [c.bringIt - 0.4, [49, 57, 61, 64]], [c.sent, [47, 54, 59, 62]], [c.cta, [43, 50, 55, 59]]];
dawn.forEach(([t0, ns], k) => {
  const t1 = k + 1 < dawn.length ? dawn[k + 1][0] : c.beHonest;
  for (let t = t0, j = 0; t < t1 - 0.1; t += 0.38, j++) piano(M, t, ns[j % ns.length] + 12, 0.27, 1.4, (j % 2) * 0.4 - 0.2);
  strings(M, t0, t1, ns.map((m) => m - 12).concat(ns), 0.34, { att: 0.5, rel: 0.6, seed: 40 + k });
});
// S19 -> end card: resolve to D(add9), then the Dmaj9 pad that starts the loop
strings(M, c.beHonest, c.endCard + 0.5, [38, 50, 57, 62, 64, 66], 0.4, { att: 0.4, rel: 1.0, seed: 45 });
piano(M, c.beHonest, 74, 0.3, 2.4, 0.1);
choir(M, c.endCard - 0.2, T, [50, 57, 62, 66], 0.5, { att: 0.8, rel: 0.05, seed: 1 });
strings(M, c.endCard - 0.2, T, [38, 50, 57, 64, 66], 0.42, { att: 0.8, rel: 0.05, seed: 2 });
[62, 69, 76, 78].forEach((m, i) => piano(M, c.endCard + 0.3 + i * 0.5, m, 0.3, 1.6, 0.2));
reverb(M, { room: 0.88, damp: 0.4, wet: 0.36, dry: 0.85 });

// ---------------- SOUND EFFECTS ----------------
const secs = (a, b) => Math.round((b - a) * SR);
const fade = (len, a = 0.4, r = 0.6) => (t) => Math.min(1, t / a, Math.max(0, (len - t) / r));
function ambience(t0, t1, { river = 0.03, leaves = 0.015, birds = 6, birdGain = 0.05, seed = 1 }) {
  const n = secs(t0, t1);
  const len = n / SR;
  if (river) {
    const w = pinkify(noise(n, seed));
    const rv = biquad(biquad(w, 'bp', 900, 0.5), 'lp', 2400);
    place(X, t0, rv, (t) => fade(len, 0.06)(t) * river * (0.8 + 0.2 * Math.sin(t * 1.3)), -0.4);
  }
  if (leaves) {
    const l = biquad(noise(n, seed + 1), 'bp', 3200, 0.7);
    place(X, t0, l, (t) => fade(len, 0.06)(t) * leaves * Math.max(0, Math.sin(t * 0.8 + seed)) ** 2, 0.5);
  }
  const r = rng(seed + 9);
  for (let k = 0; k < birds; k++) chirp(t0 + r() * Math.max(0.1, len - 0.6), birdGain * (0.5 + r() * 0.5), r() * 2 - 1, seed + k);
}
function chirp(t0, amp, pan, seed) {
  const r = rng(seed * 31);
  const notes = 2 + Math.floor(r() * 4);
  let t = t0;
  for (let k = 0; k < notes; k++) {
    const f0 = 2600 + r() * 2200;
    const d = 0.05 + r() * 0.07;
    const N = Math.round(d * SR);
    const x = new Float32Array(N);
    let ph = 0;
    for (let i = 0; i < N; i++) {
      const u = i / N;
      ph += (f0 * (1 + 0.35 * Math.sin(Math.PI * u) * (r() > 0.5 ? 1 : -1) * 0 + 0.3 * u)) / SR;
      x[i] = Math.sin(2 * Math.PI * ph) * Math.sin(Math.PI * u) ** 2;
    }
    place(X, t, x, () => amp, pan);
    t += d + 0.03 + r() * 0.06;
  }
}
function zing(t0, amp = 0.16, pan = 0) {
  const N = Math.round(0.55 * SR);
  const x = new Float32Array(N);
  let ph = 0;
  let ph2 = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const f = 700 + 2600 * (1 - Math.exp(-t / 0.05));
    ph += f / SR;
    ph2 += (f * 2.01) / SR;
    x[i] = (Math.sin(2 * Math.PI * ph) + 0.35 * Math.sin(2 * Math.PI * ph2)) * Math.exp(-t / 0.13) * Math.min(1, t / 0.003);
  }
  place(X, t0, x, () => amp, pan);
  bell(X, t0 + 0.04, 2637, amp * 0.25, 0.5, pan);
}
function hiss(t0, d = 0.9, amp = 0.03) {
  const x = biquad(noise(secs(0, d), 77), 'hp', 5000);
  place(X, t0, x, (t) => amp * Math.sin(Math.PI * Math.min(1, t / d)) ** 2, 0.4);
}
function shimmer(t0, d, amp = 0.05, base = 1760) {
  const r = rng(Math.round(t0 * 100));
  for (let k = 0; k < 9; k++) bell(X, t0 + r() * d * 0.7, base * (1 + Math.floor(r() * 4) * 0.25), amp * (0.4 + r() * 0.6), 0.9, r() * 1.6 - 0.8);
  tone(X, t0, t0 + d, base * 1.5, amp * 0.25, { att: d * 0.3, rel: d * 0.4, trem: 0.6, tremRate: 7 });
}
function crunch(t0, steps, gap, amp = 0.08, seed = 5) {
  const r = rng(seed);
  for (let k = 0; k < steps; k++) {
    const d = 0.12 + r() * 0.08;
    const x = biquad(noise(secs(0, d), seed + k), 'bp', 1400 + r() * 1800, 0.9);
    place(X, t0 + k * gap + r() * 0.05, x, (t) => amp * Math.exp(-t / 0.05) * (0.6 + 0.4 * r()), r() - 0.5);
  }
}
function whoosh(t0, d = 1.1, amp = 0.12) {
  const x = biquad(noise(secs(0, d), 91), 'bp', 400, 1.2, (t) => 300 + 3500 * (t / d) ** 1.5);
  place(X, t0, x, (t) => amp * Math.sin(Math.PI * Math.min(1, t / d)) ** 1.5, 0);
}
function bloom(t0, amp = 0.05) {
  const d = 0.9;
  const x = biquad(pinkify(noise(secs(0, d), Math.round(t0 * 7))), 'bp', 1800, 0.6, (t) => 900 + 2600 * (t / d));
  place(X, t0 - d * 0.7, x, (t) => amp * Math.sin(Math.PI * Math.min(1, t / d)) ** 2, 0);
}

// Eden at dusk (opening; also the loop target)
ambience(0, c.quoteCard + 0.6, { river: 0.035, leaves: 0.016, birds: 7, seed: 11 });
shimmer(c.fruitShimmer, 2.6, 0.045);
ambience(c.quoteCard, c.handoff, { river: 0.018, leaves: 0.008, birds: 3, birdGain: 0.03, seed: 12 });
ambience(c.handoff, c.hideScene, { river: 0.03, leaves: 0.014, birds: 4, seed: 13 });
shimmer(c.handoff, 1.6, 0.04);
hiss(c.snake - 0.15, 1.0, 0.026);
// cool blue evening: crickets-like insects, God's warm moving hum, hiding footsteps
ambience(c.hideScene, c.web, { river: 0.02, leaves: 0.02, birds: 0, seed: 14 });
for (let t = c.hideScene; t < c.web - 0.3; t += 0.42) tone(X, t, t + 0.06, 4400, 0.006, { att: 0.01, rel: 0.03, pan: 0.6 });
tone(X, c.godWalking - 0.6, c.hid + 0.4, 110, 0.05, { att: 1.2, rel: 1.4, harm2: 0.5, pan: -0.2 });
tone(X, c.godWalking - 0.6, c.hid + 0.4, 165, 0.04, { att: 1.4, rel: 1.4, pan: 0.2 });
tone(X, c.whereArtThou - 0.4, c.adamSaid, 110, 0.06, { att: 0.5, rel: 1.0, harm2: 0.5 });
crunch(c.hid - 0.9, 6, 0.16, 0.07);
// back in the evening garden (but notice): soft night air and insects
ambience(c.butNotice, c.oneMan + 0.4, { river: 0.016, leaves: 0.012, birds: 0, seed: 15 });
for (let t = c.butNotice; t < c.oneMan; t += 0.42) tone(X, t, t + 0.06, 4400, 0.005, { att: 0.01, rel: 0.03, pan: 0.6 });
// blame threads
[['T1', 0.3], ['T2', -0.1], ['T3', 0.4]].forEach(([k, p]) => zing(c[k], 0.15, p));
hiss(c.T3 + 0.45, 1.1, 0.022);
// modern room
const roomTone = (a, b) => place(X, a, biquad(pinkify(noise(secs(a, b), 21)), 'lp', 500), fade(b - a, 0.08, 0.3) && ((t) => 0.03 * fade(b - a, 0.08, 0.3)(t)), 0);
roomTone(c.modern, c.butNotice);
for (const t of [c.modern + 0.05, c.modern + 0.33]) {
  const x = new Float32Array(Math.round(0.2 * SR));
  for (let i = 0; i < x.length; i++) x[i] = Math.sign(Math.sin((2 * Math.PI * 175 * i) / SR)) * Math.sin((Math.PI * i) / x.length);
  place(X, t, biquad(x, 'lp', 900), () => 0.05, 0.2);
}
[['T4', -0.5], ['T5', -0.2], ['T6', 0.1], ['T7', 0]].forEach(([k, p]) => zing(c[k], 0.13, p));
// Gethsemane: crickets, wind in the olive trees, torches, armor and footsteps
const gs = c.gethsemane;
const ge = c.adamHid;
place(X, gs, biquad(pinkify(noise(secs(gs, ge), 31)), 'lp', 700, 0.7, (t) => 500 + 300 * Math.sin(t * 0.7)), (t) => 0.05 * fade(ge - gs, 0.5, 0.6)(t), -0.2);
for (let t = gs; t < ge - 0.3; t += 0.31) tone(X, t, t + 0.05, 4700, 0.006, { att: 0.01, rel: 0.02, pan: -0.5 });
const tr = c.torches;
const crackle = rng(41);
place(X, tr, biquad(pinkify(noise(secs(tr, ge), 33)), 'lp', 300), (t) => 0.04 * fade(ge - tr, 0.6, 0.5)(t), 0.3);
for (let t = tr; t < ge; t += 0.05 + crackle() * 0.18) {
  const x = biquad(noise(Math.round(0.02 * SR), Math.round(t * 100)), 'hp', 1500);
  place(X, t, x, (u) => 0.05 * Math.exp(-u / 0.004) * crackle(), crackle() - 0.2);
}
crunch(tr, 9, 0.36, 0.06, 9);
for (const t of [tr + 0.2, tr + 0.95, tr + 1.7, tr + 2.4]) bell(X, t, 1900 + crackle() * 900, 0.03, 0.15, 0.4);
crunch(c.iAmHe + 0.4, 3, 0.12, 0.06, 13);
bell(X, c.iAmHe + 0.45, 2300, 0.03, 0.15, 0.3);
// threads fly to Jesus and melt into light
whoosh(c.tookIt - 0.35, 1.2, 0.13);
shimmer(c.melt - 0.1, 2.6, 0.06, 2093);
bell(X, c.melt, 1046.5, 0.07, 2.4, 0);
// dawn room: typing, "sent", dawn birds
roomTone(c.stopPassing, c.endCard);
const typer = rng(51);
for (let t = c.stopPassing + 0.6; t < c.bringIt - 0.1; t += 0.11 + typer() * 0.09) {
  const x = biquad(noise(Math.round(0.015 * SR), Math.round(t * 1000)), 'bp', 3500, 1.5);
  place(X, t, x, (u) => 0.05 * Math.exp(-u / 0.004), 0.2);
}
tone(X, c.sent, c.sent + 0.08, 1318.5, 0.05, { att: 0.005, rel: 0.25 });
tone(X, c.sent + 0.1, c.sent + 0.2, 1760, 0.045, { att: 0.005, rel: 0.35 });
for (let k = 0; k < 5; k++) chirp(c.bringIt + 0.3 + k * 0.8, 0.03, k % 2 ? 0.5 : -0.4, 60 + k);
// end card: logo chime, soft gold dust shimmer, then the opening Eden ambience fades in for the loop
bell(X, c.endCard + 0.25, 1174.7, 0.06, 2.0, 0);
shimmer(c.endCard + 0.3, 2.2, 0.035, 2349);
ambience(c.total - 1.1, T, { river: 0.035, leaves: 0.016, birds: 1, seed: 11 });
// soft blooms on the big light transitions
[c.quoteCard, c.hideScene, c.web, c.modern, c.gethsemane, c.melt, c.endCard].forEach((t) => bloom(t, 0.045));
reverb(X, { room: 0.6, damp: 0.5, wet: 0.18, dry: 0.95 });

writeWav(new URL('./audio/music.wav', import.meta.url).pathname, M);
writeWav(new URL('./audio/sfx.wav', import.meta.url).pathname, X);
console.log(`music + sfx written, ${T.toFixed(2)} s`);
