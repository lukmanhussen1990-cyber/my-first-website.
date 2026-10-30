// Sound effects for "Angry at God?", placed on the same anchors as the picture.
import {readFileSync} from 'node:fs';
import {SR, Stereo, applyEnv, bell, biquad, brownNoise, mtof, osc, reverb, rng, sec, TABLES, whiteNoise, writeWav} from '../../../src/shared/audio/dsp.ts';
import {makeAnchors, TYPE_FRAMES} from '../src/anchors.ts';

const A = makeAnchors(JSON.parse(readFileSync(new URL('../audio/timeline.json', import.meta.url), 'utf8')));
const s = (fr: number) => fr / 30;
const N = Math.ceil((s(A.total) + 0.2) * SR);
const dry = new Stereo(N), wet = new Stereo(N), amb = new Stereo(N);
let sd = 500;
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

// opening: night wind + tremble tone
amb.addMono(wind(s(A.job) + 0.6, 380), 0, 0.3, -0.2);
{ const d = s(A.scroll) + 1; const t = osc(TABLES.soft, 196, d, 7.5, 14); for (let i = 0; i < t.length; i++) { const tt = i / SR; t[i] *= (0.65 + 0.35 * Math.sin(2 * Math.PI * 9 * tt)) * Math.min(1, tt / 0.4, (d - tt) / 0.6); } amb.addMono(t, 0, 0.05); }
wet.addMono(pop(520), s(A.howLong), 0.35, 0);
// scroll + stamp
{ const x = whiteNoise(sec(0.6), seed()); biquad(x, 'bandpass', (i) => 1500 + 2500 * (i / x.length), 0.9); applyEnv(x, (t) => Math.sin(Math.PI * Math.min(1, t / 0.6)) * (0.6 + 0.4 * Math.sin(t * 90))); wet.addMono(x, s(A.scroll), 0.4, 0.4); }
dry.addMono(thump(95, 45, 0.3, 0.8), s(A.stamp) + 4 / 30, 0.7, 0.4);
dry.addMono(click(3500, 0.03), s(A.stamp) + 4 / 30, 0.5, 0.4);
// jagged bubbles: sharp-soft pops rising in pitch 1→4
[A.b1, A.b2, A.b3, A.b4].forEach((b, i) => { wet.addMono(pop(600 + i * 160), s(b) + 0.1, 0.45, i % 2 ? 0.3 : -0.3); wet.addMono(click(4000, 0.02), s(b) + 0.1, 0.25, 0); });
wet.addMono(whoosh(0.5, 900, 300, 0.9), s(A.stack), 0.18, 0);
// Job: grey wind + soft rain under the cloud
amb.addMono(wind(s(A.light) - s(A.job) + 1, 300), s(A.job), 0.3, 0.3);
amb.addMono(rain(s(A.jobFill) - s(A.job) + 0.8), s(A.job), 0.07, -0.2);
wet.addMono(pop(480), s(A.complain), 0.25, 0.2);
// friends: chatter-like pops, then glass cracks
[A.f1, A.f2, A.f3].forEach((b, i) => [0, 0.07, 0.14].forEach((d, k) => wet.addMono(pop(900 + k * 120 + i * 60), s(b) + d, 0.22, i === 0 ? -0.4 : 0.4)));
[0, 0.08, 0.16].forEach((d, i) => wet.addMono(glass(), s(A.crack) + d, 0.25, (i - 1) * 0.5));
// the golden light: deep warm whoosh swell + wind
{ const d = 3; const x = brownNoise(sec(d), seed()); biquad(x, 'lowpass', (i) => 200 + 1200 * (i / x.length), 0.7); applyEnv(x, (t) => Math.sin(Math.PI * Math.min(1, t / d)) ** 1.2); amb.addMono(x, s(A.light) - 0.4, 0.55, 0); const sw = osc(TABLES.soft, 110, d); applyEnv(sw, (t) => Math.sin(Math.PI * Math.min(1, t / d))); amb.addMono(sw, s(A.light) - 0.2, 0.08, 0); }
amb.addMono(wind(3.5, 600), s(A.light), 0.18, 0.4);
// slots filling: soft chime each
[A.honest, A.jobFill, A.jesusFill, A.typing + TYPE_FRAMES].forEach((at, i) => wet.addMono(chime(91 + i * 2, 1.4, 0.6), s(at), 0.2, 0.2));
// the dotted path shimmer + gold "!"
wet.addMono(sparkle(14, 0.8), s(A.psalm22), 0.22, 0.4);
wet.addMono(chime(98, 1.2, 0.7), s(A.psalm22Bang), 0.18, 0.4);
wet.addMono(thump(140, 70, 0.18, 0.3), s(A.sign) + 8 / 30, 0.3, 0);
wet.addMono(pop(560), s(A.eph), 0.25, 0);
// walking away: footsteps, door, wind; rewind whoop
for (let fr = A.away + 15; fr < Math.max(A.away + 50, A.door - 4); fr += 15) dry.addMono(footstep(), s(fr), 0.3, -0.2);
amb.addMono(wind(s(A.dawn) - s(A.away), 520), s(A.away), 0.22, -0.3);
dry.addMono(thump(110, 60, 0.25, 0.5), s(A.door) + 0.3, 0.45, 0.4);
dry.addMono(click(2500, 0.03), s(A.door) + 0.3, 0.4, 0.4);
{ const d = 0.6; const n = sec(d); const x = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (2 * Math.PI * (200 * Math.pow(8, t / d))) / SR; x[i] = Math.sin(ph) * Math.sin(Math.PI * t / d) * 0.6; } const nz = whiteNoise(n, seed()); biquad(nz, 'bandpass', (i) => 400 * Math.pow(10, i / n), 1); for (let i = 0; i < n; i++) x[i] += nz[i] * 0.5 * Math.sin(Math.PI * i / n); wet.addMono(x, s(A.rewind), 0.35, 0); }
// sunrise birds one by one
for (let k = 0, t = s(A.dawn) + 1.2; t < s(A.cta) - 0.5; k++, t += Math.max(0.7, 2.4 - k * 0.25)) amb.addMono(chirp(), t, 0.09, Math.sin(t * 2.1) * 0.7);
wet.addMono(pop(640), s(A.singBubble), 0.22, 0.2);
// path: footsteps of Jesus, hearts
for (let fr = A.path + 13; fr < Math.max(A.path + 40, A.rather - 4); fr += 15) dry.addMono(footstep(), s(fr), 0.2, 0.5);
[A.rather + 2, A.rather + 10, A.loseYou, A.loseYou + 8].forEach((at, i) => wet.addMono(chime(93 + i * 2, 1.3, 0.6), s(at), 0.17, (i - 1.5) * 0.3));
wet.addMono(pop(560), s(A.pour), 0.22, 0);
// CTA: buttons, typing, hearts
wet.addMono(pop(520), s(A.cta + 8), 0.25, 0);
dry.addMono(click(2500, 0.02), s(A.btnYes), 0.45, -0.3);
{ const n = Array.from('Yes… but I’m still here 🙏').length; for (let k = 0; k < n; k++) dry.addMono(click(4500, 0.01), s(A.typing) + (k * TYPE_FRAMES) / 30 / n, 0.32, 0.1); }
[0, 8, 16].forEach((d, i) => wet.addMono(chime(91 + i * 2, 1.2, 0.6), s(A.typing + TYPE_FRAMES + 2 + d), 0.15, (i - 1) * 0.4));
wet.addMono(sparkle(10, 1.0), s(A.endCard + 4), 0.18, 0);

const out = new Stereo(N);
out.addStereo(dry, 0, 1); out.addStereo(reverb(wet, 0.72, 0.4, 0.3, 0.012), 0, 1); out.addStereo(amb, 0, 1);
const pk = out.peak(); if (pk > 0.98) out.scale(0.98 / pk);
writeWav(new URL('../audio/sfx.wav', import.meta.url).pathname, out);
console.log('sfx.wav peak', pk.toFixed(3));
