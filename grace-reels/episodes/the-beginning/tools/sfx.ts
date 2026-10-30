// Sound effects for "The Priest Who Found the Beginning", placed on the same anchors as the picture.
import {readFileSync} from 'node:fs';
import {SR, Stereo, applyEnv, bell, biquad, brownNoise, mtof, osc, reverb, rng, sec, TABLES, whiteNoise, writeWav} from '../../../src/shared/audio/dsp.ts';
import {makeAnchors, TYPE_FRAMES} from '../src/anchors.ts';

const A = makeAnchors(JSON.parse(readFileSync(new URL('../audio/timeline.json', import.meta.url), 'utf8')));
const s = (fr: number) => fr / 30;
const N = Math.ceil((s(A.total) + 0.2) * SR);
const dry = new Stereo(N), wet = new Stereo(N), amb = new Stereo(N);
let sd = 900;
const seed = () => sd++;

const thump = (f0: number, f1: number, dur: number, noise = 0.2) => {
  const n = sec(dur), out = new Float32Array(n), nz = whiteNoise(n, seed());
  biquad(nz, 'lowpass', 1200);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += (2 * Math.PI * (f1 + (f0 - f1) * Math.exp(-t / (dur * 0.25)))) / SR; out[i] = (Math.sin(ph) + nz[i] * noise * Math.exp(-t / 0.015)) * Math.min(1, t / 0.003) * Math.exp(-t / (dur * 0.3)); }
  return out;
};
const pop = (p = 700) => thump(p, p * 0.35, 0.09, 0.05);
const whoosh = (dur: number, f0: number, f1: number, q = 1.2) => {
  const n = sec(dur), x = whiteNoise(n, seed());
  biquad(x, 'bandpass', (i) => f0 * Math.pow(f1 / f0, i / n), q);
  return applyEnv(x, (t) => Math.sin(Math.PI * Math.min(1, t / dur)) ** 1.5);
};
const click = (b = 6000, dur = 0.012) => { const x = whiteNoise(sec(dur), seed()); biquad(x, 'highpass', b * 0.5); biquad(x, 'lowpass', b); return applyEnv(x, (t) => Math.exp(-t / (dur * 0.25))); };
const chime = (m: number, dur = 1.4, br = 0.7) => bell(mtof(m), dur, br);
const sparkle = (count = 12, spread = 0.7) => {
  const out = new Float32Array(sec(spread + 1.2)), r = rng(seed()), sc = [86, 88, 90, 93, 95, 98];
  for (let k = 0; k < count; k++) { const b = bell(mtof(sc[Math.floor(r() * sc.length)]), 0.9, 0.5), o = Math.round(r() * spread * SR); for (let i = 0; i < b.length && o + i < out.length; i++) out[o + i] += b[i] * (0.4 + r() * 0.4); }
  return out;
};
const wind = (dur: number, f = 420) => { const x = brownNoise(sec(dur), seed()); biquad(x, 'bandpass', (i) => f + 160 * Math.sin(i / SR / 1.7) + 90 * Math.sin(i / SR / 0.6), 0.8); return applyEnv(x, (t) => Math.min(1, t / 0.8, (dur - t) / 0.8) * (0.6 + 0.4 * Math.sin(t / 1.3) ** 2)); };
const rain = (dur: number) => { const x = whiteNoise(sec(dur), seed()); biquad(x, 'highpass', 2500); biquad(x, 'lowpass', 8000); return applyEnv(x, (t) => Math.min(1, t / 0.6, (dur - t) / 0.6)); };
const footstep = () => { const x = whiteNoise(sec(0.09), seed()); biquad(x, 'lowpass', 700); biquad(x, 'highpass', 90); return applyEnv(x, (t) => Math.min(1, t / 0.004) * Math.exp(-t / 0.025)); };
const chirp = () => {
  const r = rng(seed()), n = sec(0.5), out = new Float32Array(n);
  for (let k = 0; k < 2 + Math.floor(r() * 3); k++) { const t0 = k * (0.08 + r() * 0.05), f0 = 3200 + r() * 1800, len = 0.06 + r() * 0.04; let ph = 0; for (let i = 0; i < sec(len); i++) { const t = i / SR; ph += (2 * Math.PI * (f0 + 900 * (t / len))) / SR; const j = Math.round(t0 * SR) + i; if (j < n) out[j] += Math.sin(ph) * Math.sin((t / len) * Math.PI) * 0.5; } }
  return out;
};
const glass = () => { const out = sparkle(10, 0.25); const x = whiteNoise(sec(0.3), seed()); biquad(x, 'highpass', 3500); applyEnv(x, (t) => Math.exp(-t / 0.05)); for (let i = 0; i < x.length; i++) out[i] += x[i] * 0.6; return out; };

const t = (fr: number) => fr / 30;
// crickets (night beds)
const crickets = (dur: number) => {
  const n = sec(dur), out = new Float32Array(n), r = rng(seed());
  for (let k = 0; k < dur * 3; k++) {
    const t0 = r() * dur, f0 = 4200 + r() * 900;
    for (let c = 0; c < 4; c++) { const o = osc(TABLES.sine, f0, 0.03); applyEnv(o, (tt) => Math.sin(Math.PI * tt / 0.03)); const j = Math.round((t0 + c * 0.05) * SR); for (let i = 0; i < o.length && j + i < n; i++) out[j + i] += o[i] * 0.4; }
  }
  return out;
};
amb.addMono(crickets(t(A.rewindShot) + 1), 0, 0.12, 0.3);
wet.addMono(pop(760), t(A.bang), 0.4, 0);
for (let fr = 6; fr < 70; fr += 15) dry.addMono(footstep(), t(fr), 0.28, -0.5);
// chalk: scratching + taps synced to the writing
for (let fr = A.chalk + 6, k = 0; fr < A.expanding; fr += 9, k++) {
  const x = whiteNoise(sec(0.22), seed()); biquad(x, 'bandpass', 3200 + (k % 3) * 400, 2.5); applyEnv(x, (tt) => Math.sin(Math.PI * Math.min(1, tt / 0.22)) * (0.6 + 0.4 * Math.sin(tt * 160)));
  dry.addMono(x, t(fr), 0.3, -0.2);
  if (k % 3 === 2) dry.addMono(click(3000, 0.02), t(fr) + 0.2, 0.4, -0.2);
}
wet.addMono(chime(91, 1.4, 0.6), t(A.expanding), 0.2, 0.2);
wet.addMono(sparkle(10, 1.5), t(A.chalk) + 0.5, 0.1, 0);
// rewind: reverse whoosh that speeds up, then a tiny tink
{
  const d = Math.max(0.8, t(A.point) - t(A.rewind));
  const x = whiteNoise(sec(d), seed());
  biquad(x, 'bandpass', (i) => 300 * Math.pow(12, (i / x.length) ** 2), 0.8);
  applyEnv(x, (tt) => (tt / d) ** 2.2);
  wet.addMono(x, t(A.rewind), 0.6, 0);
  wet.addMono(chime(100, 1.2, 0.3), t(A.point), 0.25, 0);
}
wet.addMono(pop(600), t(A.aBeginning), 0.22, 0);
// Einstein: a soft "hmm" tone
{ const o = osc(TABLES.soft, 140, 0.6, 5, 30); applyEnv(o, (tt) => Math.sin(Math.PI * Math.min(1, tt / 0.6))); biquad(o, 'lowpass', 600); wet.addMono(o, t(A.eBubble) - 0.1, 0.25, -0.4); }
wet.addMono(pop(560), t(A.eBubble), 0.25, 0);
// observatory: dome whirr + lens click
{ const d = 1.2; const o = osc(TABLES.warmSaw, 70, d, 9, 30); applyEnv(o, (tt) => Math.min(1, tt / 0.1, (d - tt) / 0.2)); biquad(o, 'lowpass', 900); dry.addMono(o, t(A.obs) + 0.2, 0.12, -0.3); }
dry.addMono(click(4000, 0.02), t(A.lens), 0.5, 0.2);
wet.addMono(chime(93, 1.4, 0.6), t(A.apart), 0.2, 0.2);
// radio: warm 1940s crackle + faint on-air buzz
{ const d = t(A.antenna) - t(A.radio) + 0.4; const x = whiteNoise(sec(d), seed()); biquad(x, 'bandpass', 1800, 0.7); const r = rng(seed()); applyEnv(x, () => (r() > 0.985 ? 1 : 0.08)); amb.addMono(x, t(A.radio), 0.18, 0); const b = osc(TABLES.warmSaw, 60, d); biquad(b, 'lowpass', 300); applyEnv(b, (tt) => Math.min(1, tt / 0.3, (d - tt) / 0.3)); amb.addMono(b, t(A.radio), 0.03, 0); }
wet.addMono(pop(640), t(A.bigBang), 0.3, 0);
wet.addMono(chime(98, 1.2, 0.7), t(A.hoyle), 0.18, 0.4);
// antenna: static hiss (stays), pigeon coos + flaps, broom
{ const d = t(A.glowShot) - t(A.hiss) + 0.6; const x = whiteNoise(sec(d), seed()); biquad(x, 'highpass', 1500); biquad(x, 'lowpass', 7000); applyEnv(x, (tt) => Math.min(1, tt / 0.4, (d - tt) / 0.4)); amb.addMono(x, t(A.hiss), 0.06, 0.4); }
for (const k of [0, 1.1]) { const o = osc(TABLES.soft, 330, 0.5, 6, 60); applyEnv(o, (tt) => Math.sin(Math.PI * tt / 0.5) ** 2); biquad(o, 'lowpass', 900); wet.addMono(o, t(A.antenna) + 0.6 + k, 0.18, 0.5); }
for (let k = 0; k < 6; k++) { const x = whiteNoise(sec(0.06), seed()); biquad(x, 'bandpass', 900, 1); applyEnv(x, (tt) => Math.exp(-tt / 0.02)); dry.addMono(x, t(A.pigeon) + k * 0.1, 0.4, 0.5); }
for (let fr = A.pigeon + 16; fr < A.glowShot - 4; fr += 15) { const x = whiteNoise(sec(0.35), seed()); biquad(x, 'bandpass', 2500, 0.8); applyEnv(x, (tt) => Math.sin(Math.PI * tt / 0.35)); dry.addMono(x, t(fr), 0.18, -0.2); }
// afterglow: deep warm hum
{ const d = t(A.news) - t(A.afterglow) + 0.5; const o = osc(TABLES.soft, 82, d); applyEnv(o, (tt) => Math.min(1, tt / 0.8, (d - tt) / 0.6)); amb.addMono(o, t(A.afterglow) - 0.2, 0.12, 0); }
wet.addMono(chime(95, 1.4, 0.6), t(A.afterglow), 0.2, 0.2);
// letter: paper + soft chime
wet.addMono(whoosh(0.45, 1200, 3000, 1.2), t(A.letter), 0.3, 0.4);
wet.addMono(chime(91, 1.6, 0.5), t(A.letter) + 0.6, 0.18, 0.3);
// Bible: page turn + glow chime per word
{ const x = whiteNoise(sec(0.5), seed()); biquad(x, 'bandpass', (i) => 900 + 2500 * (i / x.length), 0.8); applyEnv(x, (tt) => Math.sin(Math.PI * tt / 0.5)); wet.addMono(x, t(A.bible - 4), 0.35, 0); }
A.T.tl.words.filter((w) => w.sentence === 14).forEach((w, i) => wet.addMono(chime(86 + (i % 5) * 2, 0.9, 0.4), w.start, 0.08, ((i % 3) - 1) * 0.3));
// GOD slot: bright chord
[86, 90, 93, 98].forEach((m, i) => wet.addMono(chime(m, 2.2, 0.7), t(A.god) + i * 0.03, 0.14, (i - 1.5) * 0.3));
[A.expanding, A.apart, A.afterglow].forEach((at) => wet.addMono(chime(96, 1.2, 0.5), t(at) + 0.05, 0.12, 0.5));
// dominoes: soft clacks, silence, "?" pop
{ const n = 8, step = Math.max(4, Math.floor((A.cause - A.chain) / n)); for (let k = 0; k < n; k++) dry.addMono(thump(900, 500, 0.05, 0.6), t(A.chain + k * step + 8), 0.35, 0.5 - k * 0.12); }
wet.addMono(pop(520), t(A.whyQ), 0.35, -0.4);
// light from outside the boxes
{ const d = 2.5; const x = brownNoise(sec(d), seed()); biquad(x, 'lowpass', (i) => 200 + 900 * (i / x.length), 0.7); applyEnv(x, (tt) => Math.sin(Math.PI * Math.min(1, tt / d))); amb.addMono(x, t(A.outside), 0.35, 0); }
[A.powerful, A.notMade, A.eternal].forEach((at, i) => wet.addMono(pop(560 + i * 80), t(at), 0.22, 0));
// the light burst: huge soft bloom + sparkles
{ const d = 3; const x = brownNoise(sec(d), seed()); biquad(x, 'lowpass', (i) => 300 + 3000 * Math.exp(-i / SR / 0.5), 0.6); applyEnv(x, (tt) => Math.min(1, tt / 0.15) * Math.exp(-tt / 1.0)); amb.addMono(x, t(A.burst), 0.7, 0); wet.addMono(sparkle(22, 1.2), t(A.burst) + 0.1, 0.3, 0); }
wet.addMono(pop(560), t(A.worlds), 0.22, 0);
wet.addMono(pop(560), t(A.allThings), 0.22, 0);
// call to action: typing + sparkles
{ const n = Array.from('God 🙏✨').length; for (let k = 0; k < n; k++) dry.addMono(click(4500, 0.01), t(A.typing) + (k * TYPE_FRAMES) / 30 / n, 0.35, 0.1); }
wet.addMono(sparkle(14, 0.8), t(A.typing + 26), 0.2, 0);
wet.addMono(sparkle(10, 1.0), t(A.endCard + 4), 0.18, 0);

const out = new Stereo(N);
out.addStereo(dry, 0, 1); out.addStereo(reverb(wet, 0.72, 0.4, 0.3, 0.012), 0, 1); out.addStereo(amb, 0, 1);
const pk = out.peak(); if (pk > 0.98) out.scale(0.98 / pk);
writeWav(new URL('../audio/sfx.wav', import.meta.url).pathname, out);
console.log('sfx.wav peak', pk.toFixed(3));
