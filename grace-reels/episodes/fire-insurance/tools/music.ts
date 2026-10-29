// Score for "Just Fire Insurance?" — felt piano, warm pads, light strings,
// low storm pulse, long reverb. Every section is placed on voice anchors.
// Usage: node tools/music.ts  → audio/music.wav
import {readFileSync} from 'node:fs';
import {SR, Stereo, bell, biquad, feltPiano, mtof, osc, pad, reverb, strings, TABLES, writeWav} from '../../../src/shared/audio/dsp.ts';
import {makeAnchors} from '../src/anchors.ts';

const tl = JSON.parse(readFileSync(new URL('../audio/timeline.json', import.meta.url), 'utf8'));
const A = makeAnchors(tl);
const s = (frame: number) => frame / 30;
const TOTAL = s(A.total) + 0.2;

const N = Math.ceil(TOTAL * SR);
const padBus = new Stereo(N);
const pianoBus = new Stereo(N);
const strBus = new Stereo(N);
const lowBus = new Stereo(N); // dry low pulse
const bellBus = new Stereo(N);

// note names → midi
const M: Record<string, number> = {};
['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((n, i) => {
  for (let o = 0; o < 8; o++) M[`${n}${o}`] = 12 * (o + 1) + i;
});
M.Bb1 = M['A#1']; M.Bb2 = M['A#2']; M.Bb3 = M['A#3'];
const ch = (...n: string[]) => n.map((x) => M[x]);

interface Sect {
  t0: number;
  t1: number;
  pad?: number[];
  padGain?: number;
  cutoff?: number;
  piano?: {notes: number[]; every: number; vel: number; pattern?: 'arp' | 'sparse' | 'pulse'};
  str?: number[];
  strGain?: number;
}

const beat = 60 / 74;

const addSect = (x: Sect, seed: number) => {
  const dur = Math.max(0.3, x.t1 - x.t0);
  if (x.pad) padBus.addMono(pad(x.pad, dur, Math.min(1.6, dur * 0.4), 2.2, x.cutoff ?? 1300, seed), x.t0, x.padGain ?? 0.5, 0);
  if (x.str) strBus.addMono(strings(x.str, dur, Math.min(1.4, dur * 0.4), 1.8, seed), x.t0, x.strGain ?? 0.22, 0.15);
  if (x.piano) {
    const p = x.piano;
    // place notes on a global grid so piano feels steady across sections
    const k0 = Math.ceil(x.t0 / (beat * p.every));
    const k1 = Math.floor((x.t1 - 0.05) / (beat * p.every));
    for (let k = k0; k <= k1; k++) {
      const t = k * beat * p.every;
      const idx = k % p.notes.length;
      const note = p.pattern === 'sparse' ? p.notes[(k * 3) % p.notes.length] : p.notes[idx];
      const vel = p.vel * (0.85 + 0.15 * Math.sin(k * 1.7));
      const pan = ((note % 12) / 12 - 0.5) * 0.5;
      pianoBus.addMono(feltPiano(note, beat * p.every * 1.6, vel, k), t, 1, pan);
    }
  }
};

// --- A. opening: quiet and uneasy -----------------------------------------------------
addSect({t0: 0, t1: s(A.docDrop), pad: ch('D3', 'A3', 'E4', 'F4'), padGain: 0.42, cutoff: 1000, piano: {notes: ch('A4', 'F4', 'E4', 'D4'), every: 2, vel: 0.32, pattern: 'sparse'}}, 1);
addSect({t0: s(A.docDrop), t1: s(A.storm) + 0.4, pad: ch('A#2', 'F3', 'A3', 'D4', 'E4'), padGain: 0.42, cutoff: 1000, piano: {notes: ch('D5', 'A4', 'E4'), every: 2, vel: 0.3, pattern: 'sparse'}}, 2);

// --- B. storm: low and tense --------------------------------------------------------
const stormEnd = s(A.peaceBubble) - 0.25;
const stormChords = [ch('D2', 'A2', 'D3', 'F3'), ch('A#1', 'F2', 'D3', 'F3'), ch('G1', 'D2', 'A#2', 'D3'), ch('A1', 'E2', 'C#3', 'E3')];
{
  const t0 = s(A.storm);
  const span = (stormEnd - t0) / stormChords.length;
  stormChords.forEach((c, i) => addSect({t0: t0 + i * span, t1: t0 + (i + 1) * span, pad: c, padGain: 0.55, cutoff: 700, str: [c[2] + 12, c[3] + 12], strGain: 0.07}, 10 + i));
  // soft low pulse (heartbeat-like 8ths), growing with the fear
  const e8 = beat / 2;
  for (let t = t0; t < stormEnd - 0.1; t += e8) {
    const fr = t * 30;
    const inten = fr < A.waveHit ? 0.5 : fr < A.pureFear ? 0.75 : 1;
    const ci = Math.min(stormChords.length - 1, Math.floor((t - t0) / span));
    const root = stormChords[ci][0];
    const n = Math.round(0.28 * SR);
    const sig = new Float32Array(n);
    const o1 = osc(TABLES.sine, mtof(root), 0.28);
    const o2 = osc(TABLES.soft, mtof(root + 12), 0.28);
    for (let i = 0; i < n; i++) {
      const tt = i / SR;
      const env = Math.min(1, tt / 0.012) * Math.exp(-tt / 0.09);
      sig[i] = (o1[i] * 0.8 + o2[i] * 0.3) * env;
    }
    const accent = Math.round((t - t0) / e8) % 2 === 0 ? 1 : 0.6;
    lowBus.addMono(sig, t, 0.32 * inten * accent, 0);
  }
}

// --- C. "Peace, be still": near silence, then a warm open chord -------------------------
const calm0 = s(A.still) + 0.15;
const calmEnd = s(A.dawn) + 0.4;
const calmChords = [
  ch('D2', 'A2', 'D3', 'F#3', 'A3', 'E4'),
  ch('G2', 'D3', 'G3', 'B3', 'D4'),
  ch('D2', 'A2', 'F#3', 'A3', 'D4'),
  ch('A1', 'E2', 'A2', 'D3', 'E3'),
];
{
  const span = (calmEnd - calm0) / calmChords.length;
  calmChords.forEach((c, i) =>
    addSect(
      {
        t0: calm0 + i * span,
        t1: calm0 + (i + 1) * span + 0.3,
        pad: c,
        padGain: 0.5,
        cutoff: 1600,
        str: [c[c.length - 2] + 12, c[c.length - 1] + 12],
        strGain: i === 0 ? 0.12 : 0.1,
        piano: {notes: [c[2] + 12, c[3] + 12, c[4] + 12], every: 1, vel: 0.3},
      },
      20 + i,
    ),
  );
  bellBus.addMono(bell(mtof(M.A5), 3), calm0 + 0.05, 0.12, 0.2);
  bellBus.addMono(bell(mtof(M.D6), 3), calm0 + 0.45, 0.1, -0.2);
}

// --- D. the path: growing warmer --------------------------------------------------------
const path0 = s(A.dawn) + 0.4;
const lovedT = s(A.loved) - 0.15;
const pathChords = [
  ch('D3', 'A3', 'D4', 'F#4'),
  ch('C#3', 'A3', 'E4', 'A4'),
  ch('B2', 'F#3', 'D4', 'F#4'),
  ch('G2', 'D3', 'B3', 'D4'),
  ch('F#2', 'D3', 'A3', 'D4'),
  ch('E2', 'B2', 'G3', 'D4'),
  ch('A2', 'E3', 'G3', 'D4'),
  ch('A2', 'E3', 'G3', 'C#4'),
];
{
  const span = (lovedT - path0) / pathChords.length;
  pathChords.forEach((c, i) => {
    const t0 = path0 + i * span;
    const warm = i / pathChords.length;
    addSect(
      {
        t0,
        t1: t0 + span + 0.25,
        pad: c,
        padGain: 0.42 + warm * 0.12,
        cutoff: 1500 + warm * 900,
        str: t0 * 30 >= A.heartFloat - 20 ? [c[2] + 12, c[3] + 12] : undefined,
        strGain: 0.08 + warm * 0.08,
        piano: {notes: [c[1] + 12, c[2] + 12, c[3] + 12, c[2] + 12], every: 0.5, vel: 0.26 + warm * 0.1, pattern: 'arp'},
      },
      30 + i,
    );
  });
}

// --- E. "he first loved us": brightest ---------------------------------------------------
const bright0 = lovedT;
const bright1 = s(A.closeStep);
addSect(
  {
    t0: bright0,
    t1: bright1,
    pad: ch('D3', 'A3', 'D4', 'F#4', 'A4'),
    padGain: 0.6,
    cutoff: 2800,
    str: ch('F#4', 'A4', 'D5', 'F#5'),
    strGain: 0.2,
    piano: {notes: ch('D5', 'F#5', 'A5', 'F#5'), every: 0.5, vel: 0.36, pattern: 'arp'},
  },
  50,
);
[M.D6, M['F#6'], M.A6].forEach((m, i) => bellBus.addMono(bell(mtof(m), 2.6), bright0 + 0.05 + i * 0.12, 0.13, (i - 1) * 0.4));

// --- F. soft and personal ---------------------------------------------------------------
const personal = [ch('G2', 'D3', 'B3', 'D4'), ch('F#2', 'D3', 'A3', 'D4'), ch('E2', 'B2', 'G3', 'D4'), ch('A2', 'E3', 'A3', 'C#4'), ch('B2', 'F#3', 'B3', 'D4'), ch('G2', 'D3', 'G3', 'B3')];
{
  const t0 = bright1;
  const t1 = s(A.cta) + 0.3;
  const span = (t1 - t0) / personal.length;
  personal.forEach((c, i) =>
    addSect({t0: t0 + i * span, t1: t0 + (i + 1) * span + 0.25, pad: c, padGain: 0.36, cutoff: 1500, piano: {notes: [c[1] + 12, c[2] + 12, c[3] + 12], every: 1, vel: 0.3}}, 60 + i),
  );
}

// --- G/H. call to action + send ------------------------------------------------------------
const tail = [ch('G2', 'D3', 'B3', 'D4'), ch('A2', 'E3', 'C#4', 'E4'), ch('B2', 'F#3', 'D4', 'F#4'), ch('G2', 'D3', 'B3', 'D4'), ch('D3', 'A3', 'D4', 'F#4'), ch('A2', 'E3', 'A3', 'C#4')];
{
  const t0 = s(A.cta) + 0.3;
  const t1 = s(A.endCard);
  const span = (t1 - t0) / tail.length;
  tail.forEach((c, i) =>
    addSect({t0: t0 + i * span, t1: t0 + (i + 1) * span + 0.25, pad: c, padGain: 0.38, cutoff: 1700, str: i >= 3 ? [c[2] + 12, c[3] + 12] : undefined, strGain: 0.08, piano: {notes: [c[1] + 12, c[2] + 12, c[3] + 12, c[2] + 12], every: 0.5, vel: 0.27, pattern: 'arp'}}, 70 + i),
  );
}

// --- I. end card: resolve, then fade towards the loop -------------------------------------
addSect({t0: s(A.endCard), t1: s(A.total) - 1.2, pad: ch('D3', 'A3', 'E4', 'F#4', 'A4'), padGain: 0.45, cutoff: 2000, str: ch('A4', 'D5'), strGain: 0.1}, 90);
pianoBus.addMono(feltPiano(M.D4, 2.4, 0.36, 7), s(A.endCard) + 0.1, 1, -0.1);
pianoBus.addMono(feltPiano(M.A4, 2.2, 0.32, 8), s(A.endCard) + 0.45, 1, 0.05);
pianoBus.addMono(feltPiano(M['F#5'], 2.0, 0.3, 9), s(A.endCard) + 0.8, 1, 0.2);
bellBus.addMono(bell(mtof(M.D6), 2.5), s(A.endCard) + 0.95, 0.1, 0);

// --- mix the score ------------------------------------------------------------------------
const music = new Stereo(N);
music.addStereo(padBus, 0, 1);
music.addStereo(pianoBus, 0, 0.55);
music.addStereo(strBus, 0, 1);
music.addStereo(bellBus, 0, 1);
const wet = reverb(music, 0.88, 0.32, 0.42, 0.025);
const out = new Stereo(N);
out.addStereo(wet, 0, 1);
// the low pulse stays mostly dry and tight
const lowWet = reverb(lowBus, 0.6, 0.5, 0.15, 0.01);
out.addStereo(lowWet, 0, 1);

// automation: duck to near-silence for the "Peace, be still" beat, fade at the very end
const silence0 = s(A.peaceBubble) - 0.3;
const silence1 = calm0;
const end0 = s(A.total) - 1.4;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  let g = 1;
  if (t > silence0 - 0.6 && t < silence1) g = Math.max(0.06, 1 - (t - (silence0 - 0.6)) / 0.6);
  if (t >= silence1 && t < silence1 + 0.05) g = 0.06 + (t - silence1) / 0.05;
  if (t > end0) g *= Math.max(0, 1 - (t - end0) / 1.3);
  if (t < 0.25) g *= t / 0.25;
  out.L[i] *= g;
  out.R[i] *= g;
}
biquad(out.L, 'highpass', 32);
biquad(out.R, 'highpass', 32);
const pk = out.peak();
out.scale(0.5 / pk);
const final = new Stereo(N);
final.addStereo(out, 0, 1);
writeWav(new URL('../audio/music.wav', import.meta.url).pathname, final);
console.log(`music.wav ${TOTAL.toFixed(2)} s, peak normalised from ${pk.toFixed(3)}`);
