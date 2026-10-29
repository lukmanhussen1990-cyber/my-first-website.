// Sound effects for "Just Fire Insurance?", all synthesised and placed on the
// same anchors the picture uses. Usage: node tools/sfx.ts → audio/sfx.wav
import {readFileSync} from 'node:fs';
import {
  SR, Stereo, applyEnv, bell, biquad, brownNoise, mtof, osc, reverb, rng, sec, TABLES, whiteNoise, writeWav,
} from '../../../src/shared/audio/dsp.ts';
import {jesusWalkRange, makeAnchors, youLegs} from '../src/anchors.ts';

const tl = JSON.parse(readFileSync(new URL('../audio/timeline.json', import.meta.url), 'utf8'));
const A = makeAnchors(tl);
const s = (frame: number) => frame / 30;
const N = Math.ceil((s(A.total) + 0.2) * SR);
const dry = new Stereo(N);
const wetBus = new Stereo(N); // gets a short room reverb
const amb = new Stereo(N); // storm / water / birds beds

let seedN = 100;
const seed = () => seedN++;

// --- building blocks ---------------------------------------------------------------------

const thump = (f0: number, f1: number, dur: number, noise = 0.2) => {
  const n = sec(dur);
  const out = new Float32Array(n);
  let ph = 0;
  const nz = whiteNoise(n, seed());
  biquad(nz, 'lowpass', 1200);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / (dur * 0.25));
    ph += (2 * Math.PI * f) / SR;
    const e = Math.min(1, t / 0.003) * Math.exp(-t / (dur * 0.3));
    out[i] = (Math.sin(ph) + nz[i] * noise * Math.exp(-t / 0.015)) * e;
  }
  return out;
};

const pop = (pitch = 700) => thump(pitch, pitch * 0.35, 0.09, 0.05);

const whoosh = (dur: number, f0: number, f1: number, q = 1.2) => {
  const n = sec(dur);
  const x = whiteNoise(n, seed());
  biquad(x, 'bandpass', (i) => f0 * Math.pow(f1 / f0, i / n), q);
  return applyEnv(x, (t) => Math.sin(Math.PI * Math.min(1, t / dur)) ** 1.5 * 0.9);
};

const click = (bright = 6000, dur = 0.012) => {
  const x = whiteNoise(sec(dur), seed());
  biquad(x, 'highpass', bright * 0.5);
  biquad(x, 'lowpass', bright);
  return applyEnv(x, (t) => Math.exp(-t / (dur * 0.25)));
};

const splash = (size = 1) => {
  const dur = 0.5 * size + 0.2;
  const x = whiteNoise(sec(dur), seed());
  biquad(x, 'bandpass', (i) => 2600 - 1400 * (i / x.length), 0.7);
  applyEnv(x, (t) => Math.min(1, t / 0.01) * Math.exp(-t / (0.12 * size)));
  // droplets
  const r = rng(seed());
  for (let k = 0; k < 7; k++) {
    const t0 = 0.05 + r() * dur * 0.8;
    const d = thump(1800 + r() * 1500, 900, 0.04, 0);
    const o = Math.round(t0 * SR);
    for (let i = 0; i < d.length && o + i < x.length; i++) x[o + i] += d[i] * 0.25;
  }
  return x;
};

const chime = (midi: number, dur = 1.4, bright = 0.8) => bell(mtof(midi), dur, bright);

const sparkle = (count = 12, spread = 0.7) => {
  const out = new Float32Array(sec(spread + 1.2));
  const r = rng(seed());
  const scale = [86, 88, 90, 93, 95, 98, 100];
  for (let k = 0; k < count; k++) {
    const t0 = r() * spread;
    const b = bell(mtof(scale[Math.floor(r() * scale.length)]), 0.9, 0.5);
    const o = Math.round(t0 * SR);
    for (let i = 0; i < b.length && o + i < out.length; i++) out[o + i] += b[i] * (0.4 + r() * 0.4);
  }
  return out;
};

const rustle = (dur = 0.6) => {
  const x = whiteNoise(sec(dur), seed());
  biquad(x, 'bandpass', 2400, 0.8);
  const r = rng(seed());
  const bumps = Array.from({length: 9}, () => [r() * dur, 0.03 + r() * 0.06]);
  return applyEnv(x, (t) => {
    let e = 0;
    for (const [c, w] of bumps) e += Math.exp(-(((t - c) / w) ** 2));
    return Math.min(1, e) * 0.8;
  });
};

const footstep = () => {
  const x = whiteNoise(sec(0.09), seed());
  biquad(x, 'lowpass', 700);
  biquad(x, 'highpass', 90);
  return applyEnv(x, (t) => Math.min(1, t / 0.004) * Math.exp(-t / 0.025));
};

const chirp = () => {
  const r = rng(seed());
  const n = sec(0.5);
  const out = new Float32Array(n);
  const notes = 2 + Math.floor(r() * 3);
  for (let k = 0; k < notes; k++) {
    const t0 = k * (0.08 + r() * 0.05);
    const f0 = 3200 + r() * 1800;
    const len = 0.06 + r() * 0.04;
    let ph = 0;
    for (let i = 0; i < sec(len); i++) {
      const t = i / SR;
      const f = f0 + 1400 * Math.sin((t / len) * Math.PI) * (r() > 0.5 ? 1 : -1) * 0.2 + 900 * (t / len);
      ph += (2 * Math.PI * f) / SR;
      const j = Math.round(t0 * SR) + i;
      if (j < n) out[j] += Math.sin(ph) * Math.sin((t / len) * Math.PI) * 0.5;
    }
  }
  return out;
};

const heartbeat = () => {
  const out = new Float32Array(sec(0.6));
  const a = thump(65, 38, 0.16, 0.05);
  const b = thump(58, 34, 0.14, 0.05);
  for (let i = 0; i < a.length; i++) out[i] += a[i];
  const o = Math.round(0.22 * SR);
  for (let i = 0; i < b.length; i++) out[o + i] += b[i] * 0.7;
  return out;
};

const thunder = (dur = 3) => {
  const x = brownNoise(sec(dur), seed());
  biquad(x, 'lowpass', 260, 0.6);
  const crack = whiteNoise(sec(0.25), seed());
  biquad(crack, 'bandpass', 900, 0.5);
  for (let i = 0; i < crack.length; i++) x[i] += crack[i] * 0.15 * Math.exp(-i / SR / 0.06);
  const r = rng(seed());
  const rolls = Array.from({length: 5}, () => [0.1 + r() * dur * 0.6, 0.25 + r() * 0.4]);
  return applyEnv(x, (t) => {
    let e = 0.25 * Math.exp(-t / (dur * 0.5));
    for (const [c, w] of rolls) e += 0.6 * Math.exp(-(((t - c) / w) ** 2));
    return Math.min(1.2, e) * Math.min(1, t / 0.05);
  });
};

const waveCrash = (dur = 1.6) => {
  const x = whiteNoise(sec(dur), seed());
  biquad(x, 'lowpass', (i) => 400 + 2600 * Math.exp(-i / SR / 0.4), 0.6);
  return applyEnv(x, (t) => Math.min(1, t / 0.06) * Math.exp(-t / 0.5));
};

const lap = () => {
  const x = brownNoise(sec(1.4), seed());
  biquad(x, 'bandpass', 520, 0.7);
  return applyEnv(x, (t) => Math.sin(Math.PI * Math.min(1, t / 1.4)) ** 2);
};

const ding = () => {
  const out = chime(93, 2.2, 0.6);
  const b = chime(98, 2.0, 0.4);
  for (let i = 0; i < b.length && i + 2400 < out.length; i++) out[i + 2400] += b[i] * 0.7;
  return out;
};

// --- 1. opening: heartbeat + trembling tone -----------------------------------------------
for (let k = 0; k < 4; k++) dry.addMono(heartbeat(), 0.05 + k * 1.05, 0.55 * (1 - k * 0.12), 0);
{
  const dur = s(A.storm) + 0.5;
  const t = osc(TABLES.soft, 196, dur, 7.5, 14);
  const t2 = osc(TABLES.sine, 233, dur, 6.1, 10);
  for (let i = 0; i < t.length; i++) {
    const tt = i / SR;
    const flutter = 0.65 + 0.35 * Math.sin(2 * Math.PI * 9 * tt);
    const env = Math.min(1, tt / 0.6) * Math.max(0, Math.min(1, (dur - tt) / 0.8));
    t[i] = (t[i] + 0.5 * t2[i]) * flutter * env;
  }
  biquad(t, 'lowpass', 1400);
  amb.addMono(t, 0, 0.05, 0);
}

// --- 2–3. document, stamp, "?" pop ---------------------------------------------------------
wetBus.addMono(whoosh(0.5, 900, 3800, 1.1), s(A.docDrop) - 0.08, 0.5, 0.35);
dry.addMono(thump(120, 55, 0.25, 0.4), s(A.docLand), 0.35, 0.3);
dry.addMono(thump(95, 45, 0.3, 0.8), s(A.stamp) + 4 / 30, 0.7, 0.25);
dry.addMono(click(3500, 0.03), s(A.stamp) + 4 / 30, 0.6, 0.25);
wetBus.addMono(whoosh(0.3, 3000, 1200, 1.5), s(A.docOut), 0.22, 0.3);
wetBus.addMono(pop(620), s(A.qPop), 0.7, 0);

// --- 4–9. the storm --------------------------------------------------------------------------
const st0 = s(A.storm) - 0.2;
const stCut = s(A.still) + 0.1; // storm sound cuts on "still"
{
  const dur = stCut - st0;
  // wind
  const wind = brownNoise(sec(dur), seed());
  biquad(wind, 'bandpass', (i) => 380 + 260 * Math.sin(i / SR / 1.7) + 140 * Math.sin(i / SR / 0.63), 0.8);
  applyEnv(wind, (t) => Math.min(1, t / 0.8) * (0.6 + 0.4 * Math.sin(t / 1.3) ** 2));
  // rain
  const rain = whiteNoise(sec(dur), seed());
  biquad(rain, 'highpass', 2500);
  biquad(rain, 'lowpass', 9000);
  applyEnv(rain, (t) => Math.min(1, t / 0.5));
  const r = rng(seed());
  for (let k = 0; k < dur * 22; k++) {
    const d = click(5000 + r() * 4000, 0.008);
    const o = Math.round(r() * dur * SR);
    for (let i = 0; i < d.length && o + i < rain.length; i++) rain[o + i] += d[i] * 0.6;
  }
  // rolling sea
  const sea = brownNoise(sec(dur), seed());
  biquad(sea, 'lowpass', 500, 0.6);
  applyEnv(sea, (t) => Math.min(1, t / 0.6) * (0.55 + 0.45 * Math.sin(t / 0.9) ** 2));
  // hard cut on "still" (6 ms fade so it doesn't click)
  const cut = (t: number) => (t > dur - 0.006 ? Math.max(0, (dur - t) / 0.006) : 1);
  applyEnv(wind, cut);
  applyEnv(rain, cut);
  applyEnv(sea, cut);
  amb.addMono(wind, st0, 0.5, -0.3);
  amb.addMono(wind, st0 + 0.013, 0.35, 0.4);
  amb.addMono(rain, st0, 0.11, 0.2);
  amb.addMono(rain, st0 + 0.021, 0.09, -0.3);
  amb.addMono(sea, st0, 0.65, 0);
  // occasional wave crashes during the storm
  for (let t = st0 + 1.2; t < stCut - 1.5; t += 3.1) amb.addMono(waveCrash(1.4), t, 0.3, Math.sin(t) * 0.5);
}
amb.addMono(thunder(3.2), s(A.lightning1) + 0.35, 0.65, -0.2);
amb.addMono(thunder(3.0), s(A.lightning2) + 0.3, 0.6, 0.3);
amb.addMono(waveCrash(1.8), s(A.waveHit) - 0.05, 0.9, -0.35);
wetBus.addMono(splash(1.3), s(A.waveHit), 0.55, -0.4);
wetBus.addMono(splash(1), s(A.waveHit) + 5 / 30, 0.45, -0.2);
wetBus.addMono(splash(1), s(A.bang2), 0.4, 0.4);
for (const b of [A.bang1, A.bang2, A.bang3]) wetBus.addMono(pop(820), s(b), 0.35, 0);
// z z z chime
[0, 0.26, 0.52].forEach((dt, i) => wetBus.addMono(chime(88 - i * 3, 1.3, 0.4), s(A.zzz) + dt, 0.18, 0.3));
// shaking Jesus: cloth rustle
wetBus.addMono(rustle(0.7), s(A.shake) + 0.1, 0.45, 0.2);
wetBus.addMono(rustle(0.5), s(A.shake) + 0.9, 0.3, 0.2);
wetBus.addMono(pop(560), s(A.prayerBubble), 0.3, 0);
wetBus.addMono(pop(520), s(A.pureFearLabel), 0.35, 0);
wetBus.addMono(pop(640), s(A.peaceBubble), 0.3, 0.2);

// --- 9–11. the calm ------------------------------------------------------------------------------
{
  // soft wind settling
  const w = brownNoise(sec(4), seed());
  biquad(w, 'bandpass', (i) => 500 - 250 * (i / w.length), 0.7);
  applyEnv(w, (t) => Math.min(1, t / 0.4) * Math.exp(-t / 1.4));
  amb.addMono(w, stCut + 0.05, 0.22, 0.2);
  // calm water lapping until dawn
  for (let t = stCut + 0.4; t < s(A.dawn) + 0.8; t += 1.15) amb.addMono(lap(), t, 0.22, Math.sin(t * 1.3) * 0.5);
}
for (const b of [A.goldBang1, A.goldBang2, A.goldBang3]) wetBus.addMono(chime(91 + ((b - A.goldBang1) / 8) * 2, 1.2, 0.8), s(b), 0.22, 0);
wetBus.addMono(pop(640), s(A.whyBubble), 0.28, 0.2);

// --- 12–16. the path -------------------------------------------------------------------------------
for (let t = s(A.dawn) + 0.5; t < s(A.cta) - 0.5; t += 1.3 + ((t * 7) % 1.4)) amb.addMono(chirp(), t, 0.1, Math.sin(t * 2.1) * 0.7);
wetBus.addMono(thump(90, 50, 0.2, 0.3), s(A.fearStone), 0.4, -0.5);
wetBus.addMono(pop(600), s(A.beginningLabel), 0.25, 0);
wetBus.addMono(pop(700), s(A.respectTag), 0.2, 0);
// footsteps (YOU and Jesus) — ~2 per second, matched to the walk cycle
for (const [a, b, x0, x1] of youLegs(A)) {
  for (let f = a + 7; f < b; f += 15) dry.addMono(footstep(), s(f), 0.3, ((x0 + x1) / 2 / 1080 - 0.5) * 0.8);
}
{
  const [a, b] = jesusWalkRange(A);
  for (let f = a + 7; f < b; f += 15) dry.addMono(footstep(), s(f), 0.22, 0.5);
}
wetBus.addMono(chime(86, 1.6, 0.7), s(A.heartFloat), 0.22, 0.4);
wetBus.addMono(pop(560), s(A.fearBubble), 0.28, 0);
wetBus.addMono(whoosh(1.2, 300, 1600, 0.6), s(A.goldWash), 0.25, 0.4);
wetBus.addMono(sparkle(16, 0.6), s(A.burst), 0.3, 0);
[0, 7, 14].forEach((d, i) => wetBus.addMono(chime(93 + i * 2, 1.4, 0.7), s(A.loved + d), 0.2, (i - 1) * 0.4));
wetBus.addMono(chime(95, 1.5, 0.6), s(A.lovesYou), 0.18, 0);
wetBus.addMono(thump(140, 70, 0.18, 0.3), s(A.signpost), 0.35, -0.3);
wetBus.addMono(chime(98, 1.4, 0.6), s(A.walkHome + 40), 0.2, 0.1);

// meter knob: soft slide whoosh on each move, warm ding at LOVE
wetBus.addMono(whoosh(0.5, 500, 1400, 0.9), s(A.heartFloat - 10), 0.15, 0);
wetBus.addMono(whoosh(0.4, 500, 1300, 0.9), s(A.burst), 0.12, 0);
wetBus.addMono(whoosh(0.6, 600, 2200, 0.9), s(A.loved - 22), 0.18, 0);
wetBus.addMono(ding(), s(A.loved), 0.3, 0.35);

// --- 17. call to action ---------------------------------------------------------------------------
wetBus.addMono(pop(520), s(A.cta + 4), 0.28, 0);
dry.addMono(click(2500, 0.02), s(A.btnFear), 0.5, -0.3);
wetBus.addMono(whoosh(0.35, 1200, 500, 0.9), s(A.btnFear - 2), 0.12, 0);
dry.addMono(click(2500, 0.02), s(A.btnLove), 0.5, 0.3);
wetBus.addMono(whoosh(0.45, 500, 1600, 0.9), s(A.btnLove - 2), 0.14, 0);
wetBus.addMono(ding(), s(A.btnLove + 12), 0.2, 0.3);
{
  const total = Array.from('Love 🙏 (still learning)').length;
  for (let k = 0; k < total; k++) dry.addMono(click(4500, 0.01), s(A.typing) + (k * 30) / 30 / total, 0.35, 0.1);
  [0, 6, 12].forEach((d, i) => wetBus.addMono(chime(91 + i * 2, 1.2, 0.6), s(A.typing + 32 + d), 0.16, (i - 1) * 0.4));
}

// --- 18. send + end card -------------------------------------------------------------------------
wetBus.addMono(whoosh(Math.max(0.8, s(A.planeArrive - A.plane)), 700, 2600, 1.4), s(A.plane), 0.3, -0.2);
wetBus.addMono(sparkle(14, 0.8), s(A.melt), 0.3, 0.3);
wetBus.addMono(chime(98, 1.6, 0.6), s(A.melt + 14), 0.18, 0.3);
wetBus.addMono(sparkle(10, 1.0), s(A.endCard + 4), 0.18, 0);

// --- mix ----------------------------------------------------------------------------------------------
const room = reverb(wetBus, 0.72, 0.4, 0.3, 0.012);
const out = new Stereo(N);
out.addStereo(dry, 0, 1);
out.addStereo(room, 0, 1);
out.addStereo(amb, 0, 1);
const pk = out.peak();
if (pk > 0.98) out.scale(0.98 / pk);
writeWav(new URL('../audio/sfx.wav', import.meta.url).pathname, out);
console.log(`sfx.wav ${(N / SR).toFixed(2)} s, peak ${pk.toFixed(3)}`);
