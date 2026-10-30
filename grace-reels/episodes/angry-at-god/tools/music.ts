// Score for "Angry at God?": restless pulse → grey Job → warm light swell →
// solemn cross → cold walk-away → sunrise build → harp song → brightest → soft end.
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

const t = {
  job: s(A.job), light: s(A.light), cross: s(A.cross), sign: s(A.sign), away: s(A.away), dawn: s(A.dawn),
  sing: s(A.sing), path: s(A.path), cta: s(A.cta), end: s(A.endCard), total: s(A.total),
};

// raw and restless: Dm with a low pulse under David
sect(0, t.job, [ch('D2', 'A2', 'D3', 'F3', 'E4'), ch('Bb1', 'F2', 'D3', 'F3', 'E4'), ch('G1', 'D2', 'Bb2', 'D3', 'A3'), ch('A1', 'E2', 'C#3', 'E3', 'A3')], {pad: 0.5, cut: 800, str: 0.06, piano: 0.26, every: 2}, 1);
for (let x = 0.1; x < t.job - 0.3; x += beat / 2) {
  const o1 = osc(TABLES.sine, mtof(M.D1), 0.26), o2 = osc(TABLES.soft, mtof(M.D2), 0.26);
  const sig = new Float32Array(o1.length);
  for (let i = 0; i < sig.length; i++) { const tt = i / SR; sig[i] = (o1[i] * 0.8 + o2[i] * 0.3) * Math.min(1, tt / 0.012) * Math.exp(-tt / 0.09); }
  lowBus.addMono(sig, x, 0.3 * (Math.round(x / (beat / 2)) % 2 ? 0.6 : 1));
}
// grey and lonely for Job
sect(t.job, t.light, [ch('A2', 'E3', 'G3', 'C4'), ch('F2', 'C3', 'E3', 'A3'), ch('A2', 'E3', 'G3', 'C4')], {pad: 0.38, cut: 900, piano: 0.24, every: 2}, 10);
// warm swell when the light speaks
sect(t.light, t.cross, [ch('F2', 'C3', 'F3', 'A3', 'C4'), ch('E2', 'C3', 'G3', 'C4'), ch('D2', 'A2', 'F3', 'A3', 'C4'), ch('Bb1', 'F2', 'D3', 'F3', 'A3'), ch('C2', 'G2', 'E3', 'G3', 'C4')], {pad: 0.55, cut: 1900, str: 0.16, piano: 0.28, every: 1, arp: true}, 20);
// very quiet and solemn at the cross (low sustained tone)
sect(t.cross, t.sign, [ch('D2', 'A2', 'D3', 'F3'), ch('Bb1', 'F2', 'D3', 'F3')], {pad: 0.3, cut: 600}, 30);
{
  const low = osc(TABLES.sine, mtof(M.D2), t.sign - t.cross + 1);
  for (let i = 0; i < low.length; i++) { const tt = i / SR; low[i] *= Math.min(1, tt / 1.5) * Math.min(1, (t.sign - t.cross + 1 - tt) / 1.2); }
  lowBus.addMono(low, t.cross, 0.12);
}
// calm for the sign
sect(t.sign, t.away, [ch('F2', 'C3', 'F3', 'A3'), ch('C3', 'G3', 'C4', 'E4'), ch('D3', 'A3', 'C4', 'F4'), ch('Bb2', 'F3', 'A3', 'D4')], {pad: 0.4, cut: 1400, piano: 0.26, every: 1}, 40);
// empty and cold when YOU walks away
sect(t.away, t.dawn, [ch('A3', 'E4', 'B4'), ch('F3', 'C4', 'G4')], {pad: 0.22, cut: 2400}, 50);
// slow sunrise build
sect(t.dawn, t.sing, [ch('D2', 'A2', 'D3', 'F3', 'A3'), ch('Bb1', 'F2', 'D3', 'F3', 'Bb3'), ch('F2', 'C3', 'F3', 'A3', 'C4'), ch('A1', 'E2', 'A2', 'C#3', 'E3')], {pad: 0.5, cut: 1800, str: 0.12, piano: 0.26, every: 1}, 60);
// warm major with a harp melody when David sings
sect(t.sing, t.path, [ch('D3', 'A3', 'D4', 'F#4'), ch('G2', 'D3', 'B3', 'D4'), ch('B2', 'F#3', 'D4', 'F#4'), ch('A2', 'E3', 'C#4', 'E4')], {pad: 0.5, cut: 2200, str: 0.14}, 70);
{
  const mel = ch('A4', 'D5', 'F#5', 'E5', 'D5', 'B4', 'A4', 'F#4', 'A4', 'B4', 'D5', 'E5');
  for (let i = 0; i < 12; i++) {
    const at = s(A.sing + 8 + i * 14);
    if (at > t.path) break;
    harpBus.addMono(pluck(mel[i]), at, 0.5, ((i % 4) - 1.5) * 0.25);
    harpBus.addMono(pluck(mel[i] - 12), at, 0.2, 0);
  }
}
// brightest at "rather hear it… than lose you"
sect(t.path, t.cta, [ch('D3', 'A3', 'D4', 'F#4', 'A4'), ch('A2', 'E3', 'A3', 'C#4', 'E4'), ch('B2', 'F#3', 'B3', 'D4', 'F#4'), ch('G2', 'D3', 'G3', 'B3', 'D4')], {pad: 0.58, cut: 2800, str: 0.2, piano: 0.32, every: 0.5, arp: true}, 80);
[M.D6, M['F#6'], M.A6].forEach((m, i) => bellBus.addMono(bell(mtof(m), 2.4), s(A.loseYou) + i * 0.12, 0.12, (i - 1) * 0.4));
// soft and personal at the end
sect(t.cta, t.end, [ch('G2', 'D3', 'B3', 'D4'), ch('F#2', 'D3', 'A3', 'D4'), ch('E2', 'B2', 'G3', 'D4'), ch('A2', 'E3', 'A3', 'C#4')], {pad: 0.38, cut: 1600, piano: 0.28, every: 1}, 90);
sect(t.end, t.total - 1.2, [ch('D3', 'A3', 'E4', 'F#4', 'A4')], {pad: 0.42, cut: 2000, str: 0.08}, 99);
[M.D4, M.A4, M['F#5']].forEach((m, i) => pianoBus.addMono(feltPiano(m, 2.2, 0.34, 7 + i), t.end + 0.1 + i * 0.35, 1, (i - 1) * 0.2));

const mix = new Stereo(N);
mix.addStereo(padBus, 0, 1); mix.addStereo(pianoBus, 0, 0.55); mix.addStereo(strBus, 0, 1); mix.addStereo(harpBus, 0, 1); mix.addStereo(bellBus, 0, 1);
const out = reverb(mix, 0.88, 0.32, 0.42, 0.025);
out.addStereo(reverb(lowBus, 0.6, 0.5, 0.15, 0.01), 0, 1);
const end0 = t.total - 1.4;
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
