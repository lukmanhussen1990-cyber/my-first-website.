// Score for "Who Made God?": curious → ticking pulse that speeds up → cold drop →
// warm rising chord → holy bush → playful painting → big A–Z → tender manger → brightest "He made you".
import {readFileSync} from 'node:fs';
import {SR, Stereo, bell, biquad, feltPiano, mtof, osc, pad, reverb, strings, TABLES, writeWav} from '../../../src/shared/audio/dsp.ts';
import {makeAnchors} from '../src/anchors.ts';

const A = makeAnchors(JSON.parse(readFileSync(new URL('../audio/timeline.json', import.meta.url), 'utf8')));
const s = (fr: number) => fr / 30;
const N = Math.ceil((s(A.total) + 0.2) * SR);
const padBus = new Stereo(N), pianoBus = new Stereo(N), strBus = new Stereo(N), lowBus = new Stereo(N), harpBus = new Stereo(N), bellBus = new Stereo(N);
const M: Record<string, number> = {};
['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((n, i) => { for (let o = 0; o < 8; o++) M[`${n}${o}`] = 12 * (o + 1) + i; });
const ch = (...n: string[]) => n.map((x) => M[x.replace('Bb', 'A#')]);
const beat = 60 / 72;

const sect = (t0: number, t1: number, chords: number[][], o: {pad?: number; cut?: number; str?: number; piano?: number; every?: number; arp?: boolean}, seed: number) => {
  const span = (t1 - t0) / chords.length;
  chords.forEach((c, i) => {
    const a = t0 + i * span;
    const dur = span + 0.3;
    if (o.pad) padBus.addMono(pad(c, dur, Math.min(1.5, dur * 0.4), 2, o.cut ?? 1300, seed + i), a, o.pad);
    if (o.str) strBus.addMono(strings([c[c.length - 2] + 12, c[c.length - 1] + 12], dur, 1.2, 1.6, seed + i), a, o.str, 0.15);
    if (o.piano) {
      const ev = o.every ?? 1;
      const notes = [c[1] + 12, c[2] + 12, c[c.length - 1] + 12, c[2] + 12];
      for (let k = Math.ceil(a / (beat * ev)); k * beat * ev < a + span - 0.05; k++) {
        const n = o.arp ? notes[k % notes.length] : notes[(k * 3) % notes.length];
        pianoBus.addMono(feltPiano(n, beat * ev * 1.6, o.piano * (0.85 + 0.15 * Math.sin(k)), k), k * beat * ev, 1, ((n % 12) / 12 - 0.5) * 0.5);
      }
    }
  });
};

// Karplus–Strong harp pluck
const pluck = (midi: number, dur = 2.2) => {
  const f = mtof(midi);
  const n = Math.round(dur * SR);
  const p = Math.max(2, Math.round(SR / f));
  const buf = new Float32Array(p);
  let seed = midi * 7919;
  for (let i = 0; i < p; i++) { seed = (seed * 16807) % 2147483647; buf[i] = (seed / 2147483647) * 2 - 1; }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i % p;
    const v = buf[j];
    buf[j] = 0.996 * 0.5 * (v + buf[(j + 1) % p]);
    out[i] = v;
  }
  biquad(out, 'lowpass', 3800);
  return out;
};

const t = (fr: number) => fr / 30;
const box = (t0: number, t1: number, notes: number[], every = 0.5, g = 0.08) => {
  for (let k = 0, x = t0; x < t1; k++, x += every) bellBus.addMono(bell(mtof(notes[k % notes.length]), 1.6, 0.4), x, g, ((k % 3) - 1) * 0.4);
};
const tick = (x: number, g: number) => {
  const o = osc(TABLES.sine, 1800, 0.03);
  for (let i = 0; i < o.length; i++) o[i] *= Math.exp(-i / SR / 0.006);
  lowBus.addMono(o, x, g);
};
// curious and light
sect(0, t(A.chain), [ch('D3', 'A3', 'D4', 'E4'), ch('B2', 'F#3', 'D4', 'A4'), ch('G2', 'D3', 'B3', 'E4'), ch('A2', 'E3', 'C#4', 'E4')], {pad: 0.42, cut: 1600, piano: 0.28, every: 0.5, arp: true}, 1);
box(0.3, t(A.chain), ch('A5', 'D6', 'E6', 'F#6'), 1.0, 0.05);
// steady ticking pulse that speeds up as the chain goes back
sect(t(A.chain), t(A.fall), [ch('E2', 'B2', 'E3', 'G3'), ch('C3', 'G3', 'C4', 'E4'), ch('D3', 'A3', 'D4', 'F#4'), ch('B2', 'F#3', 'B3', 'D4')], {pad: 0.4, cut: 1400, str: 0.08}, 10);
for (let x = t(A.chain), k = 0; x < t(A.fall); k++) {
  const u = (x - t(A.chain)) / (t(A.fall) - t(A.chain));
  tick(x, 0.25);
  x += 0.5 - 0.38 * u * u;
}
// cold empty drop when the cards fall
sect(t(A.fall) + 0.4, t(A.rewind), [ch('E4', 'B4')], {pad: 0.1, cut: 2600}, 20);
// warm rising chord at the first gold card
sect(t(A.rewind) + 0.9, t(A.everlasting), [ch('D2', 'A2', 'D3', 'F#3', 'A3', 'E4'), ch('G2', 'D3', 'G3', 'B3', 'D4')], {pad: 0.6, cut: 2200, str: 0.18, piano: 0.3, every: 1}, 30);
[M.D6, M['F#6'], M.A6].forEach((m, i) => bellBus.addMono(bell(mtof(m), 2.4), t(A.rewind + 30) + i * 0.1, 0.12, (i - 1) * 0.4));
sect(t(A.everlasting), t(A.bush), [ch('D2', 'A2', 'D3', 'F#3', 'A3'), ch('B1', 'F#2', 'B2', 'D3', 'F#3'), ch('G1', 'D2', 'G2', 'B2', 'D3')], {pad: 0.5, cut: 1600, str: 0.14, piano: 0.26, every: 1}, 35);
// deep, quiet, holy at the bush
sect(t(A.bush), t(A.paint), [ch('D2', 'A2', 'D3', 'A3'), ch('Bb1', 'F2', 'D3', 'F3'), ch('D2', 'A2', 'D3', 'F#3')], {pad: 0.4, cut: 900, str: 0.06}, 40);
// playful for the painting
sect(t(A.paint), t(A.aToZ), [ch('G2', 'D3', 'B3', 'D4'), ch('C3', 'G3', 'C4', 'E4'), ch('A2', 'E3', 'C#4', 'E4'), ch('D3', 'A3', 'D4', 'F#4')], {pad: 0.34, cut: 2000, piano: 0.3, every: 0.5, arp: true}, 50);
box(t(A.paint) + 0.4, t(A.aToZ), ch('B5', 'D6', 'G6'), 0.75, 0.05);
// warm and big at "the beginning and the end"
sect(t(A.aToZ), t(A.born), [ch('D2', 'A2', 'D3', 'F#3', 'A3', 'D4'), ch('A1', 'E2', 'A2', 'C#3', 'E3', 'A3'), ch('G1', 'D2', 'G2', 'B2', 'D3', 'G3')], {pad: 0.62, cut: 2600, str: 0.22, piano: 0.32, every: 0.5, arp: true}, 60);
// tender at the manger
sect(t(A.born), t(A.know), [ch('G2', 'D3', 'B3', 'D4'), ch('E2', 'B2', 'G3', 'B3'), ch('C3', 'G3', 'C4', 'E4')], {pad: 0.32, cut: 1300, piano: 0.24, every: 1}, 70);
box(t(A.born) + 0.5, t(A.know), ch('D6', 'B5', 'G5'), 1.0, 0.05);
sect(t(A.know), t(A.madeYou), [ch('D3', 'A3', 'D4', 'F#4'), ch('A2', 'E3', 'A3', 'C#4')], {pad: 0.46, cut: 2000, str: 0.14, piano: 0.28, every: 0.5, arp: true}, 75);
// brightest on "He made you"
sect(t(A.madeYou), t(A.cta), [ch('G2', 'D3', 'B3', 'D4'), ch('D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4')], {pad: 0.66, cut: 3000, str: 0.24, piano: 0.34, every: 0.5, arp: true}, 80);
[M.D5, M.A5, M.D6, M['F#6'], M.A6].forEach((m, i) => bellBus.addMono(bell(mtof(m), 2.8), t(A.heMade) + i * 0.08, 0.14, (i - 2) * 0.3));
// soft and personal at the end
sect(t(A.cta), t(A.endCard), [ch('G2', 'D3', 'B3', 'D4'), ch('A2', 'E3', 'A3', 'C#4')], {pad: 0.4, cut: 1700, piano: 0.28, every: 1}, 90);
sect(t(A.endCard), t(A.total) - 1.2, [ch('D3', 'A3', 'E4', 'F#4', 'A4')], {pad: 0.42, cut: 2000, str: 0.08}, 99);
[M.D4, M.A4, M['F#5']].forEach((m, i) => pianoBus.addMono(feltPiano(m, 2.2, 0.34, 7 + i), t(A.endCard) + 0.1 + i * 0.35, 1, (i - 1) * 0.2));

const mix = new Stereo(N);
mix.addStereo(padBus, 0, 1); mix.addStereo(pianoBus, 0, 0.55); mix.addStereo(strBus, 0, 1); mix.addStereo(harpBus, 0, 1); mix.addStereo(bellBus, 0, 1);
const out = reverb(mix, 0.88, 0.32, 0.42, 0.025);
out.addStereo(reverb(lowBus, 0.4, 0.5, 0.1, 0.005), 0, 1);
const end0 = t(A.total) - 1.4;
for (let i = 0; i < out.length; i++) {
  const tt = i / SR;
  let g = tt < 0.2 ? tt / 0.2 : 1;
  if (tt > end0) g *= Math.max(0, 1 - (tt - end0) / 1.3);
  out.L[i] *= g; out.R[i] *= g;
}
biquad(out.L, 'highpass', 32); biquad(out.R, 'highpass', 32);
const final = new Stereo(N);
final.addStereo(out, 0, 0.5 / out.peak());
writeWav(new URL('../audio/music.wav', import.meta.url).pathname, final);
console.log('music.wav', (N / SR).toFixed(2), 's');
