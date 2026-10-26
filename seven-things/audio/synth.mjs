#!/usr/bin/env node
// SEVEN THINGS (Proverbs 6:16-19): the whole soundtrack (music, SFX and the final mix), synthesized
// in pure JS. Every cue time comes from src/plan.js, the same plan that drives the picture. ffmpeg is
// only used for the two-pass EBU R128 loudness normalisation and the final checks.
//
//   npm run audio  ->  audio/stems/music.wav, audio/stems/sfx.wav (float, post-duck: voice + stems = mix)
//                      audio/mix_prenorm.wav (float), audio/final_mix.wav (48 kHz / 24-bit / stereo,
//                      -14 LUFS, <= -1 dBTP), public/final_mix.wav, audio/cuesheet.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildPlan } from '../src/plan.js';
import * as D from './lib/dsp.mjs';
import * as I from './lib/instruments.mjs';
import * as X from './lib/sfx.mjs';

const { SR, dB, nm, mtof, place, placeMoving, smp, lerp, clamp, cosRamp } = D;
const q = (t) => D.frameQ(t, 30);                    // SFX land on the nearest video frame
const t00 = Date.now();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const log = (...a) => console.log(`[${((Date.now() - t00) / 1000).toFixed(1).padStart(5)}s]`, ...a);

// ------------------------------------------------------------------ plan (single source of truth)
const T = JSON.parse(fs.readFileSync(P('timeline.json'), 'utf8'));
const plan = buildPlan(T);
const E = plan.ev;
const N = Math.round(plan.dur * SR);
// scene spans (first shot start .. last shot end) so the score survives shots being split or renamed
const SPANS = {};
for (const s of plan.shots) { if (s.id === 'LOOP') continue; const c = SPANS[s.scene] ??= { t0: s.t0, t1: s.t1, shots: [] }; c.t0 = Math.min(c.t0, s.t0); c.t1 = Math.max(c.t1, s.t1); c.shots.push(s); }
const SC = new Proxy(SPANS, { get: (o, id) => o[id] ?? { t0: T.scenes[id].start - 0.15, t1: T.scenes[id].end + 0.15, shots: [] } });  // fallback: timeline scene
const mindT0 = (SC.S6.shots.find((s) => s.trans === 'push') ?? { t0: (SC.S6.t0 + SC.S6.t1) / 2 }).t0;   // push into the man's head
// word start (s) with a safe fallback, so a script edit can never break the audio build
const W = (beat, w, nth = 0, fallback = null) => {
  try { return plan.word(beat, w, nth).start; } catch {
    const b = plan.beats[beat], t = fallback ?? (b ? (b.start + b.end) / 2 : 0);
    console.warn(`  ! word "${w}"#${nth} not in ${beat}; using ${t.toFixed(2)} s`); return t;
  }
};
const cues = [];
const cue = (t, what) => { cues.push({ t: +t.toFixed(3), what }); return t; };

// voice (untouched): mono 48 kHz, padded/trimmed to the reel duration
const vw = D.readWav(P('voice', 'voice.wav'));
if (vw.sr !== SR) throw new Error(`voice.wav must be ${SR} Hz`);
const voice = new Float32Array(N); voice.set(vw.chans[0].subarray(0, N));
log(`plan: ${plan.dur.toFixed(3)} s (${N} samples, ${plan.frames} frames), voice ${(vw.chans[0].length / SR).toFixed(3)} s`);

// ================================================================== MUSIC
const music = D.stereo(N);
const mHall = D.f32(N);                               // mono send -> long hall
const MS = (amt) => [[mHall, amt]];
const BEAT = 60 / 80, EIGHTH = BEAT / 2;              // soft pulse at 80 BPM

// chord voicings (MIDI); mid-register pad voicings, voice-led so neighbours share tones
const CH = {
  Dm: [57, 62, 65, 69], Bb: [58, 62, 65, 70], F: [57, 60, 65, 69], C: [55, 60, 64, 67], Gm: [55, 58, 62, 67], A: [57, 61, 64, 69],
  DmL: [45, 50, 53, 57], BbL: [46, 50, 53, 58], AsL: [45, 50, 52, 57], AL: [45, 49, 52, 57],
  D: [57, 62, 66, 69], G: [59, 62, 67, 71], Bm: [59, 62, 66, 71], Dadd9: [57, 62, 64, 66, 69],
  D5: [50, 57, 62, 69],                       // open fifth: the loop seam (neither major nor minor)
};
const ROOTS = { Dm: 38, Bb: 46, F: 41, C: 36, Gm: 43, A: 45, DmL: 38, BbL: 34, AsL: 33, AL: 33, D: 38, G: 43, Bm: 47, Dadd9: 38, D5: 38 };

// piecewise-linear automation helper: keys = [[t, v], ...]
const ramp = (keys) => (t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) { const [a, va] = keys[i], [b, vb] = keys[i + 1]; if (t <= b) return lerp(va, vb, (t - a) / (b - a)); }
  return keys[keys.length - 1][1];
};
// render a chord progression as pad notes; a pitch held by consecutive chords is sustained, not re-struck
function padProgression(prog, tEnd, o) {
  const spans = [];
  prog.forEach(([t0, name], k) => {
    const t1 = k + 1 < prog.length ? prog[k + 1][0] : tEnd;
    for (const m of CH[name]) {
      const open = spans.find((s) => s.m === m && Math.abs(s.t1 - t0) < 1e-6);
      if (open) open.t1 = t1; else spans.push({ m, t0, t1, k });
    }
  });
  for (const s of spans) {
    const first = s.k === 0;
    I.padNote(music, { midi: s.m, t0: s.t0, t1: s.t1, att: first ? o.att0 ?? o.att : o.att, rel: o.rel, amp: o.amp * (o.ampAt ? o.ampAt(s.t0) : 1),
      cutoff: o.cutoff, q: o.q ?? 0.62, voices: o.voices ?? 4, detune: o.detune ?? 9, spread: o.spread ?? 0.8, wave: o.wave ?? 'saw',
      sends: MS(o.send ?? 0.45), seed: o.seed, bloom: o.bloom ?? 0.45, lfo: o.lfo ?? 0.18 });
  }
  return spans.length;
}
const chordAt = (prog, t) => { let c = prog[0][1]; for (const [t0, n] of prog) if (t >= t0 - 1e-6) c = n; return c; };

// ---------------------------------------------------- 1) D minor countdown (hook .. buildup)
// slow harmonic rhythm (~4-6 s): one chord per number; the F lights up "SEVEN", and #6 pushes Gm -> A
const minorProg = [
  [E.impact + 0.25, 'Dm'],                  // hook: music enters softly after the impact
  [SC.S2.t0, 'Bb'],                         // the scroll
  [W('B03', 'seven'), 'F'],                 // "...yea, SEVEN are an abomination"
  [E.flip[0], 'Dm'],                        // #1 a proud look
  [E.flip[1], 'Bb'],                        // #2 a lying tongue
  [E.flip[2], 'Gm'],                        // #3 innocent blood (softer)
  [E.flip[3], 'Dm'],                        // #4 wicked imaginations
  [E.flip[4], 'F'],                         // #5 feet swift to mischief
  [E.flip[5], 'Gm'],                        // #6 false witness
  [W('B10', 'lies'), 'A'],                  // dominant left hanging into the drop
];
const minorCut = ramp([[0, 650], [SC.S2.t0, 850], [E.flip[0], 1000], [E.flip[2], 950], [E.flip[4], 1250], [E.buildup, 1500]]);
const minorAmp = ramp([[0, 0.7], [SC.S2.t0, 0.85], [E.flip[0], 1], [E.flip[2], 0.85], [E.flip[3], 1], [E.flip[5], 1.08]]);
padProgression(minorProg, E.buildup, { att: 1.6, att0: 2.6, rel: 2.0, amp: 0.13, ampAt: minorAmp, cutoff: minorCut, seed: 'padMinor' });
for (const [t, n] of minorProg) cue(t, `chord ${n}`);
// low drone: open fifth D2 + A2 (soft triangle), the countdown's pedal
// (one voice per note: detuned unisons beat and cancel in this register, which would make the drone pulse)
for (const m of [38, 45]) I.padNote(music, { midi: m, t0: E.impact + 0.15, t1: E.buildup, att: 3.0, rel: 0.6, amp: m === 38 ? 0.11 : 0.055, cutoff: () => 420, wave: 'tri', voices: 1, detune: 0, spread: 0, sends: MS(0.15), seed: 'drone', bloom: 0.2, lfo: 0.1, drift: 0.8 });
// soft pulse: 80 BPM eighths on the chord root, re-anchored on every number, resting under each riser
for (let k = 0; k < 6; k++) {
  const a = E.flip[k], b = k < 5 ? E.riser[k + 1] - 0.05 : E.buildup - 0.05;
  for (let j = 0; a + j * EIGHTH < b; j++) {
    const t = a + j * EIGHTH, ch = chordAt(minorProg, t), root = ROOTS[ch] % 12 + 48;  // octave 3
    const onBeat = j % 2 === 0, fifth = j % 8 === 5;
    const vel = (onBeat ? 0.55 : 0.32) * (k === 2 ? 0.72 : 0.86 + 0.04 * k) * (j === 0 ? 0.7 : 1);
    I.pluckNote(music, { midi: fifth ? root + 7 : root, t: t + 0.003 * Math.sin(j * 2.1), vel, cutoff: 430 + 60 * k + (k === 4 ? 120 : 0), decay: 0.13, pan: onBeat ? -0.1 : 0.12, gain: 0.55, sends: MS(0.14), seed: 'pulse' });
  }
}
cue(E.flip[0], 'pulse 80 BPM starts');
// felt piano: sparse motifs (beat offsets from the chord start, note, velocity, hold seconds)
const piano = [];
const phrase = (t0, list) => { for (const [b, n, v, d = 2.4] of list) piano.push({ t: t0 + b * BEAT, n, v, d }); };
phrase(E.impact, [[2, 'A3', 0.2, 3], [2, 'D4', 0.28, 3], [3, 'F4', 0.25], [4, 'A4', 0.28], [5.5, 'E4', 0.2]]);
phrase(SC.S2.t0, [[0.5, 'D4', 0.28], [1, 'F4', 0.25], [1.5, 'Bb4', 0.3, 3], [3, 'C5', 0.27, 2], [4, 'A4', 0.22, 2]]);
phrase(W('B03', 'seven'), [[0.5, 'F4', 0.27], [1, 'A4', 0.25], [1.5, 'C5', 0.3, 3], [3, 'E5', 0.22, 2]]);
phrase(E.flip[0], [[0.5, 'A4', 0.3], [1, 'D5', 0.29, 2.6], [1.5, 'F4', 0.23], [3, 'E5', 0.23]]);
phrase(W('B05', 'before', 1), [[0.5, 'F5', 0.26], [1, 'D5', 0.25], [1.5, 'A4', 0.25, 3], [3, 'G4', 0.22, 2]]);
phrase(E.flip[1], [[0.5, 'F4', 0.28], [1, 'Bb4', 0.26], [1.5, 'D5', 0.28, 2.5]]);
phrase(W('B06', 'Yes'), [[0.5, 'C5', 0.25], [1, 'A4', 0.24], [1.5, 'F4', 0.24, 2.5]]);
phrase(E.flip[2], [[0.5, 'Bb4', 0.21, 3], [1.5, 'D5', 0.19, 2.5], [3, 'A4', 0.19], [4, 'G4', 0.17, 3]]);
phrase(E.flip[3], [[0.5, 'A4', 0.28], [1, 'D5', 0.28], [1.5, 'F5', 0.25, 2.5], [3, 'E5', 0.23]]);
phrase(W('B08', 'imaginations'), [[0.5, 'D5', 0.25], [1, 'A4', 0.23], [1.5, 'C5', 0.24, 2.5], [3, 'Bb4', 0.22]]);
phrase(E.flip[4], [[0.5, 'C5', 0.3], [1, 'A4', 0.27], [1.5, 'F4', 0.26], [2, 'A4', 0.23], [3, 'G4', 0.24]]);
phrase(W('B09', 'mischief'), [[0.5, 'E5', 0.26], [1, 'C5', 0.25], [1.5, 'A4', 0.25], [3, 'G4', 0.22]]);
phrase(E.flip[5], [[0.5, 'D5', 0.3], [1, 'Bb4', 0.28], [1.5, 'G4', 0.26], [3, 'A4', 0.26]]);
phrase(W('B10', 'lies'), [[0.5, 'C#5', 0.27, 3], [1, 'E5', 0.25, 3], [1.5, 'A4', 0.23, 3]]);

// loop pre-roll: the reel opens on the open fifth the end card dissolves into (same voicing, level and
// filter), fading out under the falling stone, so the restart is continuous and the hook drone takes over
{
  const endAmp = 0.13 * 0.8, endCut = 1500;
  for (const m of CH.D5) I.padNote(music, { midi: m, t0: 0, t1: E.impact, att: 0.006, rel: 1.6, amp: endAmp, cutoff: () => endCut, seed: 'preroll', bloom: 0, sends: MS(0.45) });
  I.bassNote(music, { midi: 38, t0: 0, t1: E.impact, amp: 0.13, att: 0.006, rel: 1.0, sends: MS(0.06), seed: 'prerollBass' });
  cue(0, 'loop pre-roll: open fifth D-A fading under the fall');
}

// ---------------------------------------------------- 2) the drop: near silence until the reveal (automation below)
cue(E.buildup, 'music drops to -30 dB (0.3 s), heartbeat starts');

// ---------------------------------------------------- 3) tense, low D minor under S10-S12
const tenseProg = [[E.reveal, 'DmL'], [E.phone, 'BbL'], [E.howMany, 'AsL'], [W('B15', 'how'), 'AL']];
padProgression(tenseProg, E.goodNews + 0.35, { att: 1.3, att0: 0.6, rel: 1.8, amp: 0.12, cutoff: ramp([[E.reveal, 380], [E.reveal + 2, 520], [E.howMany, 560], [E.goodNews, 720]]), seed: 'padTense', send: 0.5, lfo: 0.25 });
for (const [t, n] of tenseProg) cue(t, `tense ${n}`);
[[E.reveal, E.phone, 38], [E.phone, E.howMany, 34], [E.howMany, E.goodNews + 0.25, 33]].forEach(([a, b, m], k) =>
  I.bassNote(music, { midi: m, t0: a, t1: b, amp: 0.15, att: k ? 0.6 : 0.25, rel: 1.4, sends: MS(0.05), seed: 'tenseBass' }));
// a thin, high glassy A (cold air) over the fire
I.padNote(music, { midi: 81, t0: E.reveal + 1.2, t1: E.phone, att: 2.5, rel: 1.5, amp: 0.018, cutoff: () => 5000, wave: 'sine', voices: 2, detune: 5, spread: 0.6, sends: MS(0.8), seed: 'glass', lfo: 0 });

// ---------------------------------------------------- 4) the good news: warm D major to the end
const majorProg = [
  [E.goodNews, 'D'], [W('B16', 'love'), 'G'], [W('B16', 'while'), 'A'], [W('B16', 'Christ'), 'D'],
  [SC.S14.t0, 'Bm'], [W('B17', 'he'), 'G'], [E.reunite, 'D'], [W('B17', 'and', 1), 'A'],
  [W('B17', 'unrighteousness'), 'D'], [W('B18', 'Just'), 'G'], [E.endCard, 'Dadd9'],
  [E.loopBack, 'D5'],                       // the third falls away: D-A carries over the loop into the D minor hook
];
const majorEnd = plan.dur + 0.3;
// the slow swell: the filter blooms open over ~3.5 s while the chord fades in
const majorCut = ramp([[E.goodNews, 380], [E.goodNews + 3.6, 1800], [SC.S14.t0, 1700], [E.endCard, 1600], [plan.dur, 1500]]);
const majorAmp = ramp([[E.goodNews, 1.05], [SC.S14.t0, 1.0], [E.cta, 0.85], [E.endCard, 0.8]]);
padProgression(majorProg, majorEnd, { att: 1.5, att0: 3.0, rel: 2.2, amp: 0.13, ampAt: majorAmp, cutoff: majorCut, seed: 'padMajor', bloom: 0.3 });
for (const [t, n] of majorProg) cue(t, `major ${n}`);
majorProg.forEach(([t0, name], k) => {                     // warm sub bass on the roots
  const t1 = k + 1 < majorProg.length ? majorProg[k + 1][0] : majorEnd;
  I.bassNote(music, { midi: ROOTS[name], t0, t1, amp: 0.13, att: k ? 0.4 : 2.6, rel: 1.3, sends: MS(0.06), seed: 'majBass' });
});
// glow layer: soft triangle an octave above the top of each chord (light shimmer)
majorProg.forEach(([t0, name], k) => {
  const t1 = k + 1 < majorProg.length ? majorProg[k + 1][0] : majorEnd, top = CH[name].slice(-2);
  for (const m of top) I.padNote(music, { midi: m + 12, t0, t1, att: k ? 1.4 : 3.2, rel: 2.0, amp: 0.022, cutoff: () => 6000, wave: 'tri', voices: 2, detune: 6, spread: 0.9, sends: MS(0.9), seed: 'glow', lfo: 0, bloom: 0 });
});
// gentle pulse returns once the tiles are washed (warm, lower and darker than in the countdown)
for (let j = 0; SC.S14.t0 + j * EIGHTH < E.endCard - 0.2; j++) {
  const t = SC.S14.t0 + j * EIGHTH, ch = chordAt(majorProg, t), root = ROOTS[ch] % 12 + 48;
  const fade = clamp((t - SC.S14.t0) / 3) * (t > E.cta ? 0.7 : 1);
  I.pluckNote(music, { midi: j % 8 === 5 ? root + 7 : root, t, vel: (j % 2 ? 0.26 : 0.42) * fade, cutoff: 380, decay: 0.15, pan: j % 2 ? 0.1 : -0.1, gain: 0.55, sends: MS(0.18), seed: 'pulse2' });
}
// piano in the major section
phrase(E.goodNews, [[2, 'A4', 0.23, 3], [2.5, 'D5', 0.25, 3], [3, 'F#5', 0.27, 3]]);
phrase(W('B16', 'love'), [[0.5, 'B4', 0.26], [1, 'D5', 0.26], [1.5, 'G5', 0.24, 2.5]]);
phrase(W('B16', 'while'), [[0.5, 'C#5', 0.26], [1, 'E5', 0.24], [1.5, 'A5', 0.22]]);
phrase(W('B16', 'Christ'), [[0.5, 'D4', 0.27, 3.5], [0.55, 'A4', 0.26, 3.5], [0.6, 'F#5', 0.29, 3.5], [2, 'E5', 0.21]]);
phrase(SC.S14.t0, [[0.5, 'F#4', 0.24], [1, 'B4', 0.24], [1.5, 'D5', 0.26, 2.5]]);
phrase(W('B17', 'he'), [[0.5, 'B4', 0.24], [1, 'D5', 0.26], [1.5, 'G5', 0.24]]);
phrase(E.reunite, [[0.5, 'A4', 0.28], [1, 'D5', 0.28], [1.5, 'F#5', 0.3, 3], [3, 'E5', 0.24]]);
phrase(W('B17', 'and', 1), [[0.5, 'C#5', 0.26], [1, 'E5', 0.26], [1.5, 'A5', 0.24, 2]]);
phrase(W('B17', 'unrighteousness'), [[0.5, 'F#5', 0.26, 3], [1, 'D5', 0.24], [1.5, 'A4', 0.24, 3]]);
phrase(W('B18', 'Just'), [[1, 'D5', 0.22, 2.5]]);
phrase(E.endCard, [[0.5, 'A4', 0.22, 3], [1, 'D5', 0.2, 3], [2, 'F#5', 0.18, 2.5]]);
for (const p of piano) {
  const m = nm(p.n);
  I.pianoNote(music, { midi: m, t: p.t, vel: p.v, dur: p.d, pan: clamp((m - 66) / 24, -0.4, 0.4), gain: 1, sends: MS(0.5), seed: 'felt' });
}
log(`music: ${piano.length} piano notes rendered`);

// ================================================================== SFX
const sfx = D.stereo(N), sRoom = D.f32(N), sHall = D.f32(N);
const SS = (room = 0, hall = 0) => [[sRoom, room], [sHall, hall]];
const bedIn = (sig, fi, fo) => { if (sig.L) { D.fades(sig.L, fi, fo); D.fades(sig.R, fi, fo); } else D.fades(sig, fi, fo); return sig; };

// ---- B01 hook: the falling stone, the impact, dust, rocks, sheep
const tImp = q(E.impact);
place(sfx, X.fallWhoosh({ dur: tImp, hang: 0.12, seed: 'fall' }), 0, dB(-20), 0, SS(0.1));
cue(0, 'stone falls (whoosh continues the loop)');
place(sfx, X.impact({ seed: 'impact' }), tImp, dB(-6.5), 0, SS(0.15, 0.22)); cue(tImp, 'IMPACT (deep soft, D1 sub)');
place(sfx, X.dustBlast({ seed: 'dust' }), tImp + 0.01, dB(-17), 0, SS(0.2, 0.05)); cue(tImp, 'dust whoosh');
{ // rock clatter: landing times from the same ballistic formula the picture uses (desert.js), 0.5-1.45 s
  const h01 = (i, salt = 0) => { let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt | 0, 0xc2b2ae35); h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
  const r = D.makeRng('rocks'); let nClk = 0;
  for (const t of [tImp + 0.07, tImp + 0.15]) { place(sfx, X.pebble({ size: 0.6, seed: 'brk' + t }), t, dB(-30), r.uni(-0.4, 0.4), SS(0.15)); nClk++; }
  for (let i = 0; i < 26; i++) {
    const vy = 3 + 8 * h01(i, 3), s = 0.08 + 0.22 * h01(i, 4) ** 2, tl = (vy + Math.sqrt(vy * vy + 2 * 16 * 0.4)) / 16, t = E.impact + tl;
    if (t < 0.5 || t > 1.45) continue;
    const size = (s - 0.08) / 0.22, pan = 0.75 * Math.cos(h01(i, 1) * Math.PI * 2);
    place(sfx, X.pebble({ size, seed: 'rock' + i }), t, dB(-37 + 13 * size), pan, SS(0.15)); nClk++;
    if (size > 0.35) { place(sfx, X.pebble({ size: size * 0.6, seed: 'bnc' + i }), t + r.uni(0.06, 0.12), dB(-41 + 12 * size), pan, SS(0.15)); nClk++; }
  }
  cue(0.5, `rock clatter (${nClk} clicks, 0.47-1.45 s)`);
}
place(sfx, X.baa({ pitch: 430, dur: 0.5, seed: 'baa1' }), tImp + 0.28, dB(-29), -0.45, SS(0.3));
place(sfx, X.baa({ pitch: 395, dur: 0.58, seed: 'baa2' }), tImp + 0.66, dB(-31), 0.5, SS(0.3));
place(sfx, X.baa({ pitch: 455, dur: 0.42, seed: 'baa3' }), tImp + 1.42, dB(-36), -0.2, SS(0.35));
place(sfx, X.patter({ dur: 1.9, rate: 11, seed: 'hooves' }), tImp + 0.3, dB(-33), 0, SS(0.2));
cue(tImp + 0.28, 'sheep scatter (3 soft baas + hooves)');
// ---- B02 tracker tiles + settling dust
E.trackerIn.forEach((t0, k) => {
  const t = q(t0), last = k === 6;
  const f = last ? 880 : mtof([86, 88, 89, 91, 93, 94][k]);
  place(sfx, X.tick({ f, tau: last ? 0.012 : 0.006, seed: 'trk' + k }), t, dB(last ? -27 : -28), -0.3 + 0.1 * k, SS(0.05, 0.08));
  if (last) place(sfx, X.shimmer({ notes: ['A5', 'D6'], spacing: 0.05, dur: 1.2, bright: 0.3, air: 0.1, seed: 'q7' }), t + 0.03, dB(-30), 0, SS(0, 0.4));
  cue(t, `tracker tick ${k + 1}`);
});
place(sfx, bedIn(X.settleDust({ dur: 3.6, seed: 'settle' }), 0.4, 0.8), 1.9, dB(-15), 0, SS(0.1));
// ---- B03 the scroll
{ const t = q(SC.S2.t0); place(sfx, X.parchment({ dur: 1.5, seed: 'parch' }), t, dB(-19), 0.1, SS(0.15)); cue(t, 'parchment unroll'); }
{ const t = q(W('B03', 'seven')); place(sfx, X.shimmer({ notes: ['D6', 'F6', 'A6', 'C7', 'D7'], spacing: 0.06, dur: 2.2, bright: 0.5, seed: 'shimSeven' }), t, dB(-21), 0, SS(0, 0.45)); cue(t, 'shimmer on SEVEN'); }

// ---- shot transitions: whip = whoosh peaking on the cut, dust/flare = soft airy swish, push = deep push-through
for (const s of plan.shots) {
  const t = q(s.t0);
  if (s.trans === 'whip') { const w = X.whipWhoosh('whip:' + s.id); placeMoving(sfx, w, t - w.length / SR * 0.63, dB(-18), -0.6, 0.6, SS(0.06)); cue(t, `whip whoosh -> ${s.id}`); }
  else if (s.trans === 'dust' || s.trans === 'flare') { const fl = s.trans === 'flare'; const w = X.airySwish(`${s.trans}:${s.id}`, fl ? 1.15 : 0.9); placeMoving(sfx, w, t - w.length / SR * 0.5, dB(fl ? -25 : -23), 0.4, -0.4, SS(0.1, 0.1)); cue(t, `${s.trans} swish -> ${s.id}`); }
  else if (s.trans === 'push') { const w = X.pushWhoosh({ dur: 1.3, peak: 0.58, seed: 'push:' + s.id }); place(sfx, w, t - 1.3 * 0.58, dB(-13), 0, SS(0.05, 0.1)); cue(t, `push-through whoosh -> ${s.id}`); }
}

// ---- numbers 1-6: riser (0.55 s) into a pitched tile thud, pitch stepping up (D F G A C D); #3 softer
const STEPS = [0, 3, 5, 7, 10, 12];
for (let k = 0; k < 6; k++) {
  const tf = q(E.flip[k]), soft = k === 2;
  place(sfx, X.riser({ dur: 0.55, target: mtof(nm('D4') + STEPS[k]), soft, seed: 'riser' + k }), tf - 0.55, dB(soft ? -25 : -20), 0, SS(0.05, 0.12));
  place(sfx, X.tileThud({ f: mtof(nm('D2') + STEPS[k]), soft, seed: 'thud' + k }), tf, dB(soft ? -19 : -13.5), 0, SS(0.12, 0.08));
  cue(tf - 0.55, `riser #${k + 1}`); cue(tf, `tile thud #${k + 1}${soft ? ' (soft)' : ''}`);
}

// ---- B04/B05 the proud rich man: slow steps on stone + coins; low swell under "pride"
{
  const a = SC.S3.t0 + 0.15, b = SC.S3.t1 - 0.2, r = D.makeRng('steps'); let k = 0;
  for (let t = a; t < b; t += 0.62 + r.uni(-0.025, 0.025), k++) {
    const u = (t - a) / (b - a), g = dB(-25) * (u < 0.55 ? 1 : lerp(1, 0.45, (u - 0.55) / 0.45));
    place(sfx, X.stepStone({ weight: k % 2 ? 0.85 : 1, seed: 'st' + k }), t, g, (k % 2 ? 0.12 : -0.12) + 0.2 * (u - 0.5), SS(0.28));
    if (k % 2 === 1) place(sfx, X.coins({ count: 4 + r.int(3), seed: 'coin' + k }), t + 0.02, g * dB(-6), 0.2, SS(0.15));
  }
  cue(a, `footsteps on stone (${k}) + coins`);
  const tp = W('B05', 'pride'), s0 = tp - 1.8, s1 = E.riser[1] - 0.1;
  place(sfx, X.lowSwell({ dur: s1 - s0, peak: 1.8 / (s1 - s0), seed: 'swellB05' }), s0, dB(-13), 0, SS(0, 0.15)); cue(s0, 'low swell (peaks on "pride")');
}
// ---- B06 market noon
{
  const a = SC.S4.t0, b = SC.S4.t1;
  place(sfx, bedIn(X.murmur({ dur: b - a + 0.4, talkers: 8, seed: 'market' }), 0.45, 0.55), a - 0.1, dB(-15), 0, SS(0.2)); cue(a, 'market murmur bed');
  for (const [t, p] of [[a + 0.95, -0.5], [a + 3.05, 0.45]]) { place(sfx, X.flutter({ dur: 0.85, seed: 'flut' + t }), t, dB(-26), p, SS(0.1)); cue(t, 'awning flutter'); }
}
// ---- B07 dusk field: crickets + soft wind (gentle)
{
  const a = SC.S5.t0, b = SC.S5.t1;
  place(sfx, bedIn(X.crickets({ dur: b - a + 0.3, count: 2, seed: 'crk' }), 0.8, 0.6), a, dB(-31), 0, SS(0.15));
  place(sfx, bedIn(X.wind({ dur: b - a + 0.4, lo: 180, hi: 1000, gust: 0.5, rate: 0.18, seed: 'duskwind' }), 0.6, 0.6), a - 0.1, dB(-19), 0, SS(0.05));
  cue(a, 'evening crickets + soft wind');
}
// ---- B08 the mind: calm air on the bench, then (after the push) low rumble + tiny thunder clicks
{
  place(sfx, bedIn(X.wind({ dur: mindT0 - SC.S6.t0 + 0.4, lo: 250, hi: 1400, gust: 0.4, rate: 0.12, seed: 'bench' }), 0.4, 0.5), SC.S6.t0, dB(-25), 0, null);
  const a = mindT0, b = SC.S6.t1, rolls = [0.9, 2.4];
  place(sfx, bedIn(X.rumble({ dur: b - a + 0.3, rolls, seed: 'storm' }), 0.5, 0.5), a, dB(-13), 0, SS(0, 0.1)); cue(a, 'low rumble (storm in the mind)');
  const r = D.makeRng('zaps');
  [0.55, 1.35, 2.05, 2.75, 3.45].forEach((o, k) => { const t = q(a + o + r.uni(-0.08, 0.08)); if (t < b - 0.15) { place(sfx, X.zap({ seed: 'zap' + k }), t, dB(-28), r.uni(-0.5, 0.5), SS(0.1, 0.15)); cue(t, 'tiny thunder click'); } });
}
// ---- B09 running to mischief: fast steps, wind rush, distant crowd swelling
{
  const a = SC.S7.t0, b = SC.S7.t1, r = D.makeRng('run'); let k = 0;
  for (let t = a + 0.06; t < b - 0.05; t += 0.3 + r.uni(-0.015, 0.015), k++) place(sfx, X.stepRun({ seed: 'run' + k }), t, dB(-25) * r.uni(0.8, 1), k % 2 ? 0.18 : -0.18, SS(0.06));
  place(sfx, bedIn(X.wind({ dur: b - a + 0.3, lo: 400, hi: 2600, gust: 0.6, rate: 0.6, move: 1.0, seed: 'rush' }), 0.3, 0.4), a, dB(-21), 0, null);
  const crowd = bedIn(X.murmur({ dur: b - a + 0.3, talkers: 12, pitchLo: 150, pitchHi: 290, lp: 1200, sylLo: 0.14, sylHi: 0.3, shout: 1, seed: 'crowd' }), 0.6, 0.5);
  for (let i = 0; i < crowd.L.length; i++) { const g = lerp(0.3, 1, Math.pow(i / crowd.L.length, 1.3)); crowd.L[i] *= g; crowd.R[i] *= g; }
  place(sfx, crowd, a, dB(-20), 0.15, SS(0.3)); cue(a, `running footsteps (${k}) + wind rush + distant crowd`);
}
// ---- B10 the city gate: hollow wind, the name tag cracks on "Ruining"
{
  const a = SC.S8.t0, b = SC.S8.t1;
  place(sfx, bedIn(X.gateWind({ dur: b - a + 0.4, seed: 'gate' }), 0.6, 0.35), a, dB(-17), 0, SS(0.1));
  const t = q(W('B10', 'Ruining')); place(sfx, X.crack({ seed: 'crack' }), t, dB(-17), 0.1, SS(0.2, 0.1)); cue(t, 'stone crack (name tag)');
}
// ---- B11 the drop: slow heartbeat (lub-dub, ~60 bpm easing a little faster) until the reveal
{
  const a = E.buildup + 0.1, b = q(E.reveal); let t = a, k = 0;
  while (t < b - 0.36) {
    const u = (t - E.buildup) / (b - E.buildup);
    place(sfx, X.heartbeat({ seed: 'hb' + k }), t, dB(-21 + 2.5 * u), 0, SS(0.05)); cue(t, `heartbeat ${k + 1}`);
    t += lerp(1.0, 0.86, u); k++;
  }
  place(sfx, bedIn(X.wind({ dur: b - SC.S9.t0, lo: 200, hi: 900, gust: 0.4, rate: 0.1, seed: 'night' }), 0.8, 0.3), SC.S9.t0, dB(-30), 0, null);
  place(sfx, X.revSwell({ dur: 0.7, seed: 'suck' }), b - 0.7, dB(-24), 0, SS(0, 0.1));
}
// ---- B12 the reveal: HARD hit (deep sub boom + bright shimmer)
{
  const t = q(E.reveal);
  place(sfx, X.subBoom({ seed: 'boom' }), t, dB(-9), 0, SS(0.05, 0.25));
  place(sfx, X.shimmer({ notes: ['D6', 'F6', 'A6', 'D7', 'F7', 'A7'], spacing: 0.028, dur: 2.4, bright: 0.8, air: 0.5, pan: [-0.7, 0.7], seed: 'revealShim' }), t, dB(-17), 0, SS(0, 0.5));
  cue(t, 'REVEAL HIT: sub boom + bright shimmer');
}
// ---- B12/B13 night fire: crackle bed, breathy whispers, thread snaps
{
  const a = SC.S10.t0, b = SC.S10.t1;
  place(sfx, bedIn(X.fire({ dur: b - a + 0.3, seed: 'fire1' }), 0.7, 0.45), a + 0.05, dB(-19), 0, SS(0.08)); cue(a, 'fire crackle bed (S10)');
  const SN = [81, 77, 74, 72, 69];                                   // A5 F5 D5 C5 A4: the circle coming apart
  E.whisperTo.forEach((t0, k) => {
    const t = q(t0), w = X.whisper({ dur: 0.46, seed: 'wh' + k }), dir = k % 2 ? -1 : 1;
    placeMoving(sfx, w, t, dB(-25), -0.65 * dir, 0.65 * dir, SS(0.12)); cue(t, `whisper ${k + 1}`);
  });
  E.snaps.forEach((t0, k) => { const t = q(t0); place(sfx, X.snap({ f: mtof(SN[k]), seed: 'snap' + k }), t, dB(-18), [-0.4, 0.35, -0.2, 0.45, 0][k], SS(0.06, 0.22)); cue(t, `thread snap ${k + 1}`); });
}
// ---- B14 phone: soft message pops
E.bubbles.forEach((t0, k) => { const t = q(t0); place(sfx, X.pop({ f: [520, 600, 690][k], seed: 'bub' + k }), t, dB(-24), [-0.25, 0.25, -0.1][k], SS(0.08)); cue(t, `message pop ${k + 1}`); });
// ---- B15 the self-check: soft tick per pulsing tile
E.pulses.forEach((t0, k) => { const t = q(t0); place(sfx, X.tick({ f: 1100 * Math.pow(2, k / 24), tau: 0.009, click: 0.2, seed: 'pls' + k }), t, dB(-26), -0.45 + 0.15 * k, SS(0.08, 0.05)); cue(t, `pulse tick ${k + 1}`); });
// ---- B16 good news: a rising light shimmer through the warm dissolve, a sparkle for the card
{
  const t = q(E.goodNews);
  place(sfx, X.shimmer({ notes: ['D5', 'F#5', 'A5', 'D6', 'F#6', 'A6', 'D7'], spacing: 0.17, dur: 2.6, bright: 0.35, air: 0.3, seed: 'goodShim' }), t + 0.2, dB(-23), 0, SS(0, 0.6));
  cue(t, 'good news: warm D major swell + rising shimmer');
  const tc = q(E.card); place(sfx, X.shimmer({ notes: ['A6', 'D7', 'F#7'], spacing: 0.05, dur: 1.6, bright: 0.3, air: 0.2, seed: 'cardShim' }), tc, dB(-27), 0.2, SS(0, 0.5)); cue(tc, 'card sparkle');
}
// ---- B17 the 7 tiles washed white (shimmer sweep each), fire again after the reunion, threads regrow
{
  const WN = [86, 88, 90, 93, 95, 98, 100];                          // D6 E6 F#6 A6 B6 D7 E7
  E.wash.forEach((t0, k) => { const t = q(t0); place(sfx, X.washSweep({ f: mtof(WN[k]), seed: 'wash' + k }), t, dB(-23), -0.45 + 0.15 * k, SS(0, 0.4)); cue(t, `wash sweep ${k + 1}`); });
  const a = E.reunite, b = SC.S14.t1;
  place(sfx, bedIn(X.fire({ dur: b - a + 0.3, rate: 8, seed: 'fire2' }), 0.9, 0.8), a, dB(-21), 0, SS(0.08)); cue(a, 'fire crackle bed (S14b, warm)');
  [74, 78, 81, 83, 86].forEach((m, k) => { const t = q(E.regrow[k]); place(sfx, X.glint({ f: mtof(m), seed: 'glint' + k }), t, dB(-27), [-0.4, 0.35, -0.2, 0.45, 0][k], SS(0, 0.35)); cue(t, `thread regrows ${k + 1}`); });
}
// ---- B18 the question: light tap per tile, typing ticks, heart pops
{
  [74, 76, 78, 79, 81, 83, 85].forEach((m, k) => { const t = q(E.taps[k]); place(sfx, X.tap({ f: mtof(m), seed: 'tap' + k }), t, dB(-25), -0.45 + 0.15 * k, SS(0.08, 0.05)); });
  cue(q(E.taps[0]), 'tile taps x7');
  const r = D.makeRng('typing'), nT = 9;
  for (let k = 0; k < nT; k++) { const t = q(E.typeStart + (k + 0.5) * (E.typeEnd - E.typeStart) / nT + r.uni(-0.02, 0.02)); place(sfx, X.typeTick({ seed: 'ty' + k }), t, dB(-30) * r.uni(0.75, 1), 0.25, SS(0.05)); }
  cue(q(E.typeStart), `typing ticks x${nT} (to ${E.typeEnd.toFixed(2)} s)`);
  [74, 76, 78, 81, 83, 86].forEach((m, k) => { const t = q(E.hearts[k]); place(sfx, X.heartPop({ f: mtof(m), seed: 'hp' + k }), t, dB(-26), 0.3 + 0.05 * k, SS(0.06, 0.12)); cue(t, `heart pop ${k + 1}`); });
}
// ---- B19 end card chime, then the stone drifts back up into the hang (whoosh into the loop)
{
  const t = q(E.endCard); place(sfx, X.chime({ seed: 'chime' }), t, dB(-15), 0, SS(0, 0.5)); cue(t, 'end card chime');
  const tl = q(E.loopBack); place(sfx, X.riseWhoosh({ dur: plan.dur - tl, seed: 'rise' }), tl, dB(-19), 0, SS(0.08, 0.1)); cue(tl, 'loop whoosh (flows into t=0)');
}
log(`sfx: ${cues.length} cues placed`);

// ================================================================== reverbs, automation, ducking, mix
const hallIR = D.makeIR({ seconds: 3.6, rt60: 3.2, pre: 0.025, fadeIn: 0.08, damp0: 9500, damp1: 1300, hp: 150, seed: 'hall' });
const roomIR = D.makeIR({ seconds: 1.5, rt60: 1.0, pre: 0.012, fadeIn: 0.02, damp0: 8000, damp1: 2600, hp: 180, seed: 'room' });
const addWet = (bus, send, ir, g = 1) => { const w = D.convolveMonoToStereo(send, ir, N); for (let i = 0; i < N; i++) { bus.L[i] += w.L[i] * g; bus.R[i] += w.R[i] * g; } };
addWet(music, mHall, hallIR, 1.0);
addWet(sfx, sRoom, roomIR, 1.0);
addWet(sfx, sHall, hallIR, 1.0);
for (const b of [music, sfx]) { D.dcBlock(b.L, 22); D.dcBlock(b.R, 22); }
log('reverbs done');

// the drop: post-reverb, so the hall tail goes too: -30 dB in 0.3 s at the buildup, back at the reveal
{
  const a = smp(E.buildup), b = smp(E.buildup + 0.3), c = smp(q(E.reveal) - 0.004), low = dB(-30);
  for (let i = a; i < N && i < c; i++) { const g = i < b ? lerp(1, low, cosRamp((i - a) / (b - a))) : low; music.L[i] *= g; music.R[i] *= g; }
}
// calibrate the music bed against the voice: un-ducked music sits 5.5 LU under the narration
const Lvoice = D.loudness([voice, voice]);
const Lmusic0 = D.loudness([music.L, music.R]);
const musicGain = dB(Lvoice - 5.5 - Lmusic0);
// ducking from an envelope follower on the voice (80 ms attack, 500 ms release, smooth S-curve, 120 ms look-ahead)
const act = D.voiceActivity(voice, { att: 0.08, rel: 0.5, look: 0.12 }); // pre-duck: the dip is in place as a word starts
// plus a gentle speech-band dip (-4 dB, broad, ~1 kHz) on the music while the narrator speaks, so the bed
// stays full in the pauses but never sits on the voice's formants
for (const x of [music.L, music.R]) D.dynEQ(x, 'peak', 1000, 0.6, (i) => -4 * act[i]);
const musicStem = D.stereo(N), sfxStem = D.stereo(N), mixL = new Float32Array(N), mixR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const gm = musicGain * Math.pow(10, (-8 * act[i]) / 20), gs = Math.pow(10, (-3 * act[i]) / 20);
  musicStem.L[i] = music.L[i] * gm; musicStem.R[i] = music.R[i] * gm;
  sfxStem.L[i] = sfx.L[i] * gs; sfxStem.R[i] = sfx.R[i] * gs;
  mixL[i] = voice[i] + musicStem.L[i] + sfxStem.L[i]; mixR[i] = voice[i] + musicStem.R[i] + sfxStem.R[i];
}
// loop seam: 5 ms fade-in at t=0, 150 ms fade-out at the end (no click when the reel restarts)
for (const x of [mixL, mixR, musicStem.L, musicStem.R, sfxStem.L, sfxStem.R]) D.fades(x, 0.005, 0.15);
log(`levels: voice ${Lvoice.toFixed(1)} LUFS, music (raw) ${Lmusic0.toFixed(1)} -> gain ${D.lin2db(musicGain).toFixed(1)} dB, sfx ${D.loudness([sfx.L, sfx.R]).toFixed(1)} LUFS`);

fs.mkdirSync(P('audio', 'stems'), { recursive: true });
D.writeWav(P('audio', 'stems', 'music.wav'), [musicStem.L, musicStem.R]);
D.writeWav(P('audio', 'stems', 'sfx.wav'), [sfxStem.L, sfxStem.R]);

// ================================================================== master: peak control so loudnorm can stay linear
// linear loudnorm needs (true peak - integrated) <= 13 dB (-1 dBTP at -14 LUFS); a transparent look-ahead
// limiter trims the few voice peaks that exceed that (target 12.8 dB, 0.2 dB safety)
const PLR = 12.8;
const L0 = D.loudness([mixL, mixR]), TP0 = D.lin2db(D.truePeak([mixL, mixR]));
let ceilDb = L0 + PLR, lim = null, L1 = L0, TP1 = TP0;
const orig = [Float32Array.from(mixL), Float32Array.from(mixR)];
for (let it = 0; it < 4; it++) {
  if (it) { mixL.set(orig[0]); mixR.set(orig[1]); }
  lim = D.limit([mixL, mixR], dB(ceilDb), { lookahead: 0.003, release: 0.09 });
  L1 = D.loudness([mixL, mixR]); TP1 = D.lin2db(D.truePeak([mixL, mixR]));
  if (TP1 - L1 <= PLR + 0.05) break;
  ceilDb -= TP1 - L1 - PLR + 0.05;
}
log(`master: ${L0.toFixed(2)} LUFS / ${TP0.toFixed(2)} dBTP -> limiter ceiling ${ceilDb.toFixed(2)} dBFS (max GR ${lim.maxReductionDb.toFixed(2)} dB, ${lim.limitedPct.toFixed(2)}% of samples) -> ${L1.toFixed(2)} LUFS / ${TP1.toFixed(2)} dBTP`);
const PRE = P('audio', 'mix_prenorm.wav');
D.writeWav(PRE, [mixL, mixR]);

// ================================================================== two-pass loudnorm (ffmpeg) -> final_mix.wav
const ff = (args) => { const r = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error('ffmpeg failed:\n' + (r.stderr || '').slice(-3000)); return r.stderr; };
const lastJson = (s) => JSON.parse(s.slice(s.lastIndexOf('{'), s.lastIndexOf('}') + 1));
const LN = 'loudnorm=I=-14:TP=-1:LRA=11';
// (pass 1 pads 3 s of digital silence: it is gated out of every measurement, but stops loudnorm's
// end-of-stream look-ahead flush from biasing input_i by ~0.1 dB on a reel that ends on sound)
const m1 = lastJson(ff(['-hide_banner', '-nostats', '-i', PRE, '-af', `apad=pad_dur=3,${LN}:print_format=json`, '-f', 'null', '-']));
log(`loudnorm pass 1: I ${m1.input_i} LUFS, TP ${m1.input_tp} dBTP, LRA ${m1.input_lra} LU, thresh ${m1.input_thresh}`);
const FINAL = P('audio', 'final_mix.wav');
const af2 = `${LN}:measured_I=${m1.input_i}:measured_TP=${m1.input_tp}:measured_LRA=${m1.input_lra}:measured_thresh=${m1.input_thresh}:offset=${m1.target_offset}:linear=true:print_format=json`;
const m2 = lastJson(ff(['-hide_banner', '-nostats', '-y', '-i', PRE, '-af', `${af2},aresample=48000,apad,atrim=end_sample=${N}`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', FINAL]));
log(`loudnorm pass 2: ${m2.normalization_type} -> I ${m2.output_i} LUFS, TP ${m2.output_tp} dBTP, LRA ${m2.output_lra} LU`);
if (m2.normalization_type !== 'linear') console.warn('  ! loudnorm fell back to dynamic mode');
fs.mkdirSync(P('public'), { recursive: true });
fs.copyFileSync(FINAL, P('public', 'final_mix.wav'));

// ================================================================== verification
const eb = ff(['-hide_banner', '-nostats', '-i', FINAL, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
const sum = eb.slice(eb.lastIndexOf('Summary:'));
const I_ = parseFloat(/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]), TP_ = parseFloat(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1]), LRA_ = parseFloat(/LRA:\s+(-?[\d.]+) LU/.exec(sum)?.[1]);
const pr = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-count_packets', '-show_entries', 'stream=sample_rate,channels,bits_per_sample,duration_ts,duration', '-of', 'json', FINAL], { encoding: 'utf8' });
const st = JSON.parse(pr.stdout).streams[0];
const durOk = Math.abs(st.duration_ts / SR - plan.dur) <= 1 / 30;
cues.sort((a, b) => a.t - b.t);
fs.writeFileSync(P('audio', 'cuesheet.json'), JSON.stringify({ duration: plan.dur, samples: N, lufs: I_, truePeak: TP_, lra: LRA_, cues }, null, 1));
log(`final_mix.wav: ${st.sample_rate} Hz, ${st.channels} ch, ${st.bits_per_sample}-bit, ${st.duration_ts} samples = ${(st.duration_ts / SR).toFixed(4)} s (plan ${plan.dur} s) ${durOk ? 'OK' : 'MISMATCH'}`);
log(`ebur128: I = ${I_} LUFS, true peak = ${TP_} dBTP, LRA = ${LRA_} LU  ${Math.abs(I_ + 14) <= 0.3 && TP_ <= -1.0 ? 'OK' : 'CHECK'}`);
log(`done -> audio/final_mix.wav + public/final_mix.wav (${((Date.now() - t00) / 1000).toFixed(1)} s)`);
