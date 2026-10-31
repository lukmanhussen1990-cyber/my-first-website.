// Sound effects for "Who Made God?", placed on the same anchors as the picture.
import {readFileSync} from 'node:fs';
import {SR, Stereo, applyEnv, bell, biquad, brownNoise, mtof, osc, reverb, rng, sec, TABLES, whiteNoise, writeWav} from '../../../src/shared/audio/dsp.ts';
import {makeAnchors, TYPE_FRAMES} from '../src/anchors.ts';

const A = makeAnchors(JSON.parse(readFileSync(new URL('../audio/timeline.json', import.meta.url), 'utf8')));
const s = (fr: number) => fr / 30;
const N = Math.ceil((s(A.total) + 0.2) * SR);
const dry = new Stereo(N), wet = new Stereo(N), amb = new Stereo(N);
let sd = 1300;
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
const crickets = (dur: number) => {
  const n = sec(dur), out = new Float32Array(n), r = rng(seed());
  for (let k = 0; k < dur * 3; k++) {
    const t0 = r() * dur, f0 = 4200 + r() * 900;
    for (let c = 0; c < 4; c++) { const o = osc(TABLES.sine, f0, 0.03); applyEnv(o, (tt) => Math.sin(Math.PI * tt / 0.03)); const j = Math.round((t0 + c * 0.05) * SR); for (let i = 0; i < o.length && j + i < n; i++) out[j + i] += o[i] * 0.4; }
  }
  return out;
};
amb.addMono(crickets(t(A.cards) + 0.5), 0, 0.12, 0.3);
wet.addMono(thump(320, 120, 0.25, 0.1), t(A.q), 0.55, 0);
// chessboard: wooden clack + playful wobble
wet.addMono(pop(520), t(A.chess), 0.25, 0.3);
dry.addMono(thump(1200, 700, 0.06, 0.8), t(A.piece) + 0.35, 0.5, 0.3);
{ const o = osc(TABLES.soft, 440, 0.5, 9, 120); applyEnv(o, (tt) => Math.sin(Math.PI * tt / 0.5)); wet.addMono(o, t(A.checkmate), 0.1, 0.3); }
wet.addMono(chime(96, 1.2, 0.6), t(A.watch), 0.2, 0);
// cards pop + tags tick
[A.phone, A.house, A.baby].forEach((at, i) => { wet.addMono(pop(560 + i * 60), t(at), 0.3, (i - 1) * 0.5); dry.addMono(click(5000, 0.012), t(at) + 0.15, 0.3, (i - 1) * 0.5); });
wet.addMono(pop(520), t(A.heb), 0.22, 0);
[0, 8, 16].forEach((d, i) => wet.addMono(whoosh(0.25, 800, 2400, 1.4), t(A.arrows + d), 0.15, (i - 1) * 0.5));
// chain pan: whoosh + a tick per step back, speeding into a blur
wet.addMono(whoosh(1.4, 300, 900, 0.8), t(A.chain), 0.25, 0);
for (let x = t(A.chain) + 0.4, k = 0; x < t(A.forever); k++) {
  const u = (x - t(A.chain)) / (t(A.forever) - t(A.chain));
  dry.addMono(click(3500, 0.015), x, 0.3, 0.2);
  x += Math.max(0.05, 0.6 - 0.55 * u);
}
// space: deep airy shimmer
{ const d = t(A.fall) - t(A.space) + 1; const x = whiteNoise(sec(d), seed()); biquad(x, 'bandpass', 5000, 0.6); applyEnv(x, (tt) => Math.min(1, tt / 0.8, (d - tt) / 0.8)); amb.addMono(x, t(A.space), 0.06, 0); const o = osc(TABLES.soft, 65, d); applyEnv(o, (tt) => Math.min(1, tt / 1, (d - tt) / 0.8)); amb.addMono(o, t(A.space), 0.1, 0); }
// cards going dark and falling: hollow clunks in a row, then silence
for (let i = 0; i < 11; i++) dry.addMono(thump(220, 110, 0.18, 0.5), t(A.fall + i * 4 + 14), 0.35, 0.5 - i * 0.1);
// rewind + the first gold card: warm chime + sparkle burst
{ const d = 0.9; const n = sec(d); const x = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const tt = i / SR; ph += (2 * Math.PI * (200 * Math.pow(6, tt / d))) / SR; x[i] = Math.sin(ph) * Math.sin(Math.PI * tt / d) * 0.5; } wet.addMono(x, t(A.rewind), 0.3, 0); }
[86, 90, 93].forEach((m, i) => wet.addMono(chime(m, 2.2, 0.6), t(A.rewind + 30) + i * 0.05, 0.16, (i - 1) * 0.4));
wet.addMono(sparkle(16, 0.8), t(A.rewind + 30), 0.25, 0);
wet.addMono(pop(600), t(A.neverMade), 0.22, 0); wet.addMono(pop(680), t(A.neverBegan), 0.22, 0);
// mountains rising: low soft rumble
{ const d = 2.2; const x = brownNoise(sec(d), seed()); biquad(x, 'lowpass', 160, 0.7); applyEnv(x, (tt) => Math.sin(Math.PI * Math.min(1, tt / d))); amb.addMono(x, t(A.everlasting + 6), 0.7, 0); }
wet.addMono(pop(560), t(A.psalm), 0.22, 0);
// burning bush: gentle crackle + deep hum
{ const d = t(A.paint) - t(A.bush) + 0.4; const x = whiteNoise(sec(d), seed()); biquad(x, 'bandpass', 1400, 0.8); const r = rng(seed()); applyEnv(x, (tt) => (r() > 0.992 ? 0.9 : 0.04) * Math.min(1, tt / 0.6, (d - tt) / 0.5)); amb.addMono(x, t(A.bush), 0.35, 0.3); const o = osc(TABLES.soft, 73, d); applyEnv(o, (tt) => Math.min(1, tt / 1, (d - tt) / 0.6)); amb.addMono(o, t(A.bush), 0.1, 0); }
wet.addMono(chime(93, 2.0, 0.5), t(A.iamBubble), 0.18, 0.3);
wet.addMono(chime(98, 1.6, 0.6), t(A.iamCard), 0.15, -0.4);
// red X: soft error ticks; gold check: bright ding
[A.x1, A.x2].forEach((at) => { dry.addMono(thump(300, 200, 0.08, 0.2), t(at + 4), 0.3, 0); dry.addMono(thump(240, 160, 0.08, 0.2), t(at + 7), 0.25, 0); });
wet.addMono(chime(98, 1.6, 0.8), t(A.check + 2), 0.25, 0.3);
wet.addMono(sparkle(10, 0.5), t(A.check + 2), 0.18, 0.4);
// painting: brush strokes + curious hmm
for (let k = 0; k < 4; k++) { const x = whiteNoise(sec(0.3), seed()); biquad(x, 'bandpass', 2200, 1.2); applyEnv(x, (tt) => Math.sin(Math.PI * tt / 0.3)); dry.addMono(x, t(A.paint) + 0.4 + k * 0.55, 0.16, -0.3); }
{ const o = osc(TABLES.soft, 180, 0.6, 5, 40); applyEnv(o, (tt) => Math.sin(Math.PI * Math.min(1, tt / 0.6))); biquad(o, 'lowpass', 700); wet.addMono(o, t(A.paintBubble), 0.2, 0.3); }
wet.addMono(chime(96, 1.2, 0.7), t(A.painterBang), 0.18, -0.3);
wet.addMono(pop(520), t(A.notGod + 2), 0.22, 0); wet.addMono(pop(640), t(A.notGodGold), 0.22, 0);
// timeline slide + two warm bells for Α and Ω
wet.addMono(whoosh(1.0, 400, 1400, 0.8), t(A.aToZ + 6), 0.2, 0);
wet.addMono(chime(74, 2.6, 0.5), t(A.alpha), 0.25, -0.5);
wet.addMono(chime(81, 2.6, 0.5), t(A.alpha) + 0.35, 0.25, 0.5);
wet.addMono(pop(560), t(A.revCard), 0.2, 0);
// stable: soft animal sounds + lullaby note
for (const k of [0.6, 2.0]) { const o = osc(TABLES.soft, 150, 0.7, 4, 50); applyEnv(o, (tt) => Math.sin(Math.PI * tt / 0.7) ** 2); biquad(o, 'lowpass', 600); amb.addMono(o, t(A.born) + k, 0.14, -0.5); }
wet.addMono(chime(86, 2.4, 0.4), t(A.flesh), 0.15, 0);
// hearts + the gold arrow
[0, 8, 16].forEach((d, i) => wet.addMono(chime(93 + i * 2, 1.2, 0.6), t(A.knowWord + d), 0.15, (i - 1) * 0.4));
wet.addMono(chime(98, 1.4, 0.7), t(A.heMade), 0.2, 0);
wet.addMono(sparkle(14, 0.8), t(A.youWord), 0.22, 0);
// call to action
wet.addMono(pop(520), t(A.cta + 8), 0.25, 0);
dry.addMono(click(2500, 0.02), t(A.btnYes), 0.45, -0.3);
{ const n = Array.from('It finally makes sense 🙏').length; for (let k = 0; k < n; k++) dry.addMono(click(4500, 0.01), t(A.typing) + (k * TYPE_FRAMES) / 30 / n, 0.32, 0.1); }
[0, 8, 16].forEach((d, i) => wet.addMono(chime(91 + i * 2, 1.2, 0.6), t(A.typing + TYPE_FRAMES + 2 + d), 0.15, (i - 1) * 0.4));
wet.addMono(sparkle(10, 1.0), t(A.endCard + 4), 0.18, 0);

const out = new Stereo(N);
out.addStereo(dry, 0, 1); out.addStereo(reverb(wet, 0.72, 0.4, 0.3, 0.012), 0, 1); out.addStereo(amb, 0, 1);
const pk = out.peak(); if (pk > 0.98) out.scale(0.98 / pk);
writeWav(new URL('../audio/sfx.wav', import.meta.url).pathname, out);
console.log('sfx.wav peak', pk.toFixed(3));
