// Music + sound effects synthesized in code, ducked under the voice, mixed and loudness-normalized.
// Output: audio/final_mix.wav (48 kHz stereo, -14 LUFS, -1 dBTP) and a copy in public/ for Remotion.
import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SR = 48000;
const tl = JSON.parse(readFileSync(join(ROOT, 'src/data/timeline.json'), 'utf8'));
const cue = JSON.parse(readFileSync(join(ROOT, 'src/data/cues.json'), 'utf8'));
const DUR = tl.durationSec + 0.6;
const N = Math.ceil(DUR * SR);
const scene = (id) => tl.scenes.find((s) => s.id === id);

// seeded random
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const bus = () => [new Float32Array(N), new Float32Array(N)];
const music = bus(), sfx = bus();
const add = (b, t, data, gain = 1, pan = 0) => {
  const o = Math.round(t * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < data.length; i++) {
    const j = o + i;
    if (j < 0 || j >= N) continue;
    b[0][j] += data[i] * gl;
    b[1][j] += data[i] * gr;
  }
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const env = (i, n, a, r) => Math.min(1, i / (a * SR), (n - i) / (r * SR));

// ---------- instruments ----------
const piano = (f, dur = 2.5, vel = 1) => {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let h = 1; h <= 5; h++) v += Math.sin(2 * Math.PI * f * h * t * (1 + 0.0004 * h)) * Math.exp(-t * (1.6 + h * 1.1)) / Math.pow(h, 1.6);
    out[i] = v * vel * Math.min(1, t / 0.006) * Math.min(1, (n - i) / (0.05 * SR));
  }
  return out;
};
const harp = (f, dur = 2.2, vel = 1) => {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  const L = Math.max(2, Math.round(SR / f));
  const buf = new Float32Array(L).map(() => rnd() * 2 - 1);
  for (let k = 0; k < 3; k++) for (let i = 0; i < L; i++) buf[i] = (buf[i] + buf[(i + 1) % L]) / 2;
  let p = 0;
  for (let i = 0; i < n; i++) {
    const nx = (p + 1) % L;
    const v = buf[p];
    buf[p] = (buf[p] + buf[nx]) * 0.4985;
    p = nx;
    out[i] = v * vel * Math.min(1, (n - i) / (0.05 * SR));
  }
  return out;
};
const pad = (f, dur, vel = 1, att = 1.2, bright = 0.3) => {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const vib = 1 + 0.003 * Math.sin(2 * Math.PI * 5 * t);
    let v = Math.sin(2 * Math.PI * f * t * vib) + Math.sin(2 * Math.PI * f * 1.003 * t) * 0.6 + Math.sin(2 * Math.PI * f * 2 * t) * bright * 0.5 + Math.sin(2 * Math.PI * f * 3 * t) * bright * 0.2;
    out[i] = v * vel * env(i, n, att, Math.min(1.5, dur / 2)) * 0.35;
  }
  return out;
};

// ---------- score ----------
// [start, end, chords(midi arrays), style]
const S = (id) => scene(id).start;
const sections = [
  [0, S('S3'), [[50, 57, 61, 66], [43, 55, 59, 64], [40, 52, 59, 62], [45, 52, 57, 61]], 'curious'],
  [S('S3'), S('S5'), [[50, 57, 62, 66], [47, 54, 59, 62], [43, 55, 59, 62], [45, 57, 61, 64]], 'curious'],
  [S('S5'), cue.snakeSaid + 1.5, [[50, 57, 62, 66], [43, 55, 62, 67], [47, 54, 62, 66], [45, 57, 61, 64]], 'eden'],
  [cue.snakeSaid + 1.5, S('S10'), [[38, 50, 53, 57], [34, 46, 53, 58], [31, 43, 50, 55], [33, 45, 52, 57]], 'tense'],
  [S('S10'), S('S12'), [[38, 50, 53], [34, 46, 50], [38, 45, 50], [38, 45, 50]], 'sad'],
  [S('S12'), S('S13'), [[38, 50, 57, 62, 66], [37, 49, 57, 61, 64], [35, 47, 54, 62, 66], [31, 43, 55, 59, 62]], 'strong'],
  [S('S13'), S('S15'), [[43, 55, 59, 62], [42, 54, 57, 62], [40, 52, 55, 59], [45, 52, 57, 61]], 'soft'],
  [S('S15'), DUR, [[43, 55, 59, 64], [45, 57, 61, 64], [50, 57, 62, 66], [50, 57, 62, 66]], 'resolve'],
];
const BEAT = 60 / 76;
for (const [a, b, chords, style] of sections) {
  const bar = BEAT * 4;
  for (let t = a, k = 0; t < b - 0.05; t += bar, k++) {
    const ch = chords[k % chords.length];
    const len = Math.min(bar, b - t) + 0.6;
    const padVel = {curious: 0.18, eden: 0.3, tense: 0.32, sad: 0.26, strong: 0.5, soft: 0.22, resolve: 0.3}[style];
    for (const m of ch) add(music, t, pad(mtof(m), len, padVel / ch.length * 2.2, style === 'strong' ? 0.5 : 1.1, style === 'strong' ? 0.6 : 0.25), 1, (m % 5) / 5 - 0.4);
    if (style === 'curious') {
      // playful pizzicato harp + staccato piano
      [0, 1, 2, 3, 4, 5, 6, 7].forEach((e) => {
        if (t + e * BEAT / 2 > b) return;
        const m = ch[(e * 3 + k) % ch.length] + 12 + (e % 4 === 3 ? 7 : 0);
        add(music, t + e * BEAT / 2, harp(mtof(m), 0.9, 0.22), 1, e % 2 ? 0.35 : -0.35);
      });
      if (k % 2 === 0) add(music, t + BEAT * 1.5, piano(mtof(ch[3] + 12), 0.6, 0.12), 1, 0.2);
    }
    if (style === 'eden' || style === 'strong' || style === 'resolve') {
      for (let e = 0; e < 8; e++) {
        if (t + e * BEAT / 2 > b) break;
        const m = ch[(e % 4) % ch.length] + 12 + (e >= 4 ? 12 : 0);
        add(music, t + e * BEAT / 2, harp(mtof(m), 2, style === 'strong' ? 0.2 : 0.16), 1, (e / 7) * 1.2 - 0.6);
      }
      add(music, t, piano(mtof(ch[0] + 12), 3, style === 'strong' ? 0.3 : 0.18), 1, -0.1);
    }
    if (style === 'strong') for (const m of ch.slice(1)) add(music, t, pad(mtof(m + 12), len, 0.09, 0.8, 0.8), 1, 0.3);
    if (style === 'tense') { if (k % 2 === 1) add(music, t + BEAT * 2, piano(mtof(ch[2] + 12), 2.5, 0.1), 1, 0.3); for (let e = 0; e < 4; e++) add(music, t + e * BEAT, piano(mtof(ch[0]), 0.8, 0.07), 1, -0.2); }
    if (style === 'sad') add(music, t, piano(mtof(ch[0] + 12), 3.5, 0.14), 1, 0);
    if (style === 'soft') { add(music, t, piano(mtof(ch[1] + 12), 3, 0.15), 1, -0.2); add(music, t + BEAT * 2, piano(mtof(ch[3] + 12), 2.5, 0.1), 1, 0.2); }
    if (style === 'resolve') add(music, t + BEAT * 2, piano(mtof(ch[2] + 12), 3, 0.14), 1, 0.2);
  }
}

// simple stereo reverb (Schroeder): 4 combs + 2 allpasses per channel
const reverb = ([L, R], wet = 0.35) => {
  for (const [ch, off] of [[L, 0], [R, 23]]) {
    const dry = Float32Array.from(ch);
    const acc = new Float32Array(N);
    for (const d of [1557, 1617, 1491, 1422].map((x) => x + off)) {
      const buf = new Float32Array(d); let p = 0, lp = 0;
      for (let i = 0; i < N; i++) { const y = buf[p]; lp = y * 0.7 + lp * 0.3; buf[p] = dry[i] + lp * 0.84; acc[i] += y; p = (p + 1) % d; }
    }
    for (const d of [556, 441].map((x) => x + off)) {
      const buf = new Float32Array(d); let p = 0;
      for (let i = 0; i < N; i++) { const b = buf[p]; const y = -acc[i] + b; buf[p] = acc[i] + b * 0.5; acc[i] = y; p = (p + 1) % d; }
    }
    for (let i = 0; i < N; i++) ch[i] = dry[i] * (1 - wet) + acc[i] * wet * 0.25;
  }
};
reverb(music, 0.38);

// ---------- sound effects ----------
const noise = (dur, shape, lp = 0.5) => {
  const n = Math.round(dur * SR), out = new Float32Array(n); let y = 0;
  for (let i = 0; i < n; i++) { y += ((rnd() * 2 - 1) - y) * lp; out[i] = y * shape(i / n, i / SR); }
  return out;
};
const tone = (dur, f, shape, partials = [1]) => {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; let v = 0; partials.forEach((a, h) => (v += a * Math.sin(2 * Math.PI * (typeof f === 'function' ? f(t) : f) * (h + 1) * t))); out[i] = v * shape(i / n, t); }
  return out;
};
const sweep = (dur, f0, f1, shape) => {
  const n = Math.round(dur * SR), out = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const k = i / n; ph += 2 * Math.PI * (f0 + (f1 - f0) * k) / SR; out[i] = Math.sin(ph) * shape(k, i / SR); }
  return out;
};
const dec = (r) => (k, t) => Math.exp(-t * r) * Math.min(1, t / 0.004);
const bell = (k) => Math.sin(Math.PI * k);

const thud = () => sweep(0.5, 130, 42, dec(8));
const buzz = () => tone(0.32, 146, (k, t) => bell(Math.min(1, k * 1.3)) * 0.5, [1, 0, 0.35, 0, 0.15]);
const click = (f = 2200, d = 0.03) => tone(d, f, dec(160), [1, 0.4]);
const whoosh = (d = 0.3) => noise(d, (k) => bell(k) * 0.6, 0.25);
const chime = () => tone(2.2, 1568, dec(2.2), [1, 0.5, 0.3, 0.2]);
const shimmer = (d = 1.6) => sweep(d, 900, 2800, (k, t) => bell(k) * 0.25 * (0.6 + 0.4 * Math.sin(t * 40)));
const stampHit = () => { const a = sweep(0.7, 95, 38, dec(6)); const b = noise(0.2, (k, t) => Math.exp(-t * 30), 0.15); for (let i = 0; i < b.length; i++) a[i] += b[i] * 0.7; return a; };

add(sfx, cue.xSlam, thud(), 1.2); add(sfx, cue.xSlam + 0.02, buzz(), 0.3);
add(sfx, cue.xSlam - 0.12, whoosh(0.14), 0.4);
[0, 0.9].forEach((d) => add(sfx, scene('S2').start + d, noise(0.35, (k) => bell(k) * 0.5, 0.5), 0.35, d ? 0.3 : -0.3));
add(sfx, cue.fruitFound, chime(), 0.35);
for (let i = 0; i < 4; i++) add(sfx, cue.paintStroke - 0.5 + i * 0.42, noise(0.38, (k) => bell(k) * 0.4, 0.3), 0.3, 0.3);
for (let t = scene('S3').start; t < scene('S5').start; t += 0.07 + rnd() * 0.5) add(sfx, t, click(600 + rnd() * 900, 0.012), 0.05 + rnd() * 0.06, -0.5);
add(sfx, cue.malumSplit, whoosh(0.35), 0.35);
[cue.flipFig, cue.flipGrape, cue.flipWheat].forEach((t, i) => add(sfx, t - 0.1, whoosh(0.25), 0.5, -0.4 + i * 0.3));
add(sfx, cue.lockedClunk, sweep(0.25, 120, 70, dec(18)), 0.9, 0.4); add(sfx, cue.lockedClunk, click(900, 0.04), 0.4, 0.4);
// Eden beds: water, wind in leaves, birds (quiet after the fall)
const edenA = scene('S5').start, edenB = cue.eat, edenWin = [[edenA, scene('S8').start], [scene('S9').start, cue.stripEat], [scene('S10').start, cue.eat + 2.5]];
for (const [a, b] of edenWin) {
  add(sfx, a, noise(b - a, (k, t) => Math.min(1, t / 0.6, (b - a - t) / 0.6) * 0.12, 0.05), 1, -0.3);
  add(sfx, a, noise(b - a, (k, t) => Math.min(1, t / 0.6, (b - a - t) / 0.6) * (0.06 + 0.04 * Math.sin(t * 0.8)) * (a + t > edenB ? Math.max(0, 1 - (a + t - edenB) / 1.2) : 1), 0.35), 1, 0.3);
  for (let t = a + 0.3; t < Math.min(b, edenB); t += 0.4 + rnd() * 1.3) add(sfx, t, sweep(0.09 + rnd() * 0.06, 2600 + rnd() * 1500, 4200 + rnd() * 1600, bell), 0.05 + rnd() * 0.05, rnd() * 1.6 - 0.8);
}
add(sfx, cue.snakeSlide, noise(3.4, (k, t) => bell(k) * (0.08 + 0.04 * Math.sin(t * 9)), 0.6), 1, 0.4);
const s17 = tl.segments.find((s) => s.id === 17);
add(sfx, s17.start, noise(s17.end - s17.start + 0.2, (k) => bell(k) * 0.05, 0.9), 1, 0.4);
// typing + error ticks + slot unlocks
const typeLetters = (at, n, cps) => { for (let i = 0; i < n; i++) add(sfx, at + i / cps, click(1800 + rnd() * 600, 0.025), 0.45, 0.1); add(sfx, at + n / cps + 0.12, tone(0.07, 880, (k) => bell(k) * 0.4, [1, 0, 0.3]), 0.3); };
typeLetters(cue.typeNot, 3, 9); typeLetters(cue.typeTouch, 5, 12);
[cue.slot1, cue.slot2].forEach((t) => { add(sfx, t, click(2400, 0.03), 0.5); add(sfx, t + 0.05, click(3200, 0.02), 0.35); });
add(sfx, cue.slot3, click(2400, 0.03), 0.5);
for (const m of [62, 66, 69, 74]) add(sfx, cue.slot3 + 0.03, pad(mtof(m), 1.6, 0.25, 0.02, 0.5), 0.8);
add(sfx, cue.slot3, shimmer(1.2), 0.5);
// desert: dry wind + small stones
add(sfx, scene('S11').start, noise(scene('S13').start - scene('S11').start, (k, t) => Math.min(1, t / 1, (1 - k) * 8) * (0.07 + 0.04 * Math.sin(t * 0.6)), 0.12), 1, -0.2);
for (let i = 0; i < 6; i++) add(sfx, scene('S11').start + 0.8 + i * 0.37 + rnd() * 0.2, click(500 + rnd() * 400, 0.03), 0.25, 0.3);
[cue.stamp1, cue.stamp2, cue.stamp3].forEach((t) => { add(sfx, t, stampHit(), 1.0); add(sfx, t + 0.04, shimmer(0.9), 0.35); });
add(sfx, cue.devilLeaves, whoosh(0.8), 0.25, 0.5);
add(sfx, cue.notifPing, tone(0.18, 1320, dec(14)), 0.45); add(sfx, cue.notifPing + 0.12, tone(0.3, 1760, dec(10)), 0.4);
add(sfx, scene('S14').start - 0.35, whoosh(0.4), 0.5);
add(sfx, cue.appleBreak, shimmer(2.0), 0.6);
add(sfx, cue.tapYes, click(1300, 0.05), 0.6);
add(sfx, cue.tapYes + 0.3, click(1000, 0.04), 0.3);
add(sfx, scene('S16').start + 0.1, chime(), 0.25);

// ---------- duck music ~8 dB under speech ----------
const duck = new Float32Array(N).fill(1);
for (const s of tl.segments) for (let i = Math.round((s.start - 0.12) * SR); i < Math.round((s.end + 0.15) * SR); i++) if (i >= 0 && i < N) duck[i] = 0.398;
let g = 1;
for (let i = 0; i < N; i++) { const target = duck[i]; g += (target - g) * (target < g ? 1 / (0.06 * SR) : 1 / (0.35 * SR)); duck[i] = g; }

// ---------- mix ----------
const voiceRaw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', join(ROOT, 'audio/voice.wav'), '-af', 'highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=4', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], {maxBuffer: 1 << 29});
const voice = new Float32Array(voiceRaw.buffer, voiceRaw.byteOffset, voiceRaw.length / 4);
let vpk = 0; for (const v of voice) vpk = Math.max(vpk, Math.abs(v));
let mpk = 0; for (let i = 0; i < N; i++) mpk = Math.max(mpk, Math.abs(music[0][i]), Math.abs(music[1][i]));
const mg = 0.32 / mpk;
const out = new Float32Array(N * 2);
for (let i = 0; i < N; i++) {
  const v = i < voice.length ? voice[i] / vpk * 0.85 : 0;
  for (let c = 0; c < 2; c++) out[i * 2 + c] = v + music[c][i] * mg * duck[i] + sfx[c][i] * 0.5;
}
mkdirSync(join(ROOT, 'audio'), {recursive: true});
const pre = join(ROOT, 'audio/mix_pre.wav');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_f32le', pre], {input: Buffer.from(out.buffer)});
// two-pass loudnorm to -14 LUFS / -1 dBTP
const pass1 = execFileSync('ffmpeg', ['-hide_banner', '-i', pre, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
const m = JSON.parse(execFileSync('bash', ['-c', `ffmpeg -hide_banner -i "${pre}" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p'`], {encoding: 'utf8'}));
void pass1;
const final = join(ROOT, 'audio/final_mix.wav');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', pre, '-af',
  `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=${SR}`,
  '-ar', String(SR), '-c:a', 'pcm_s24le', final]);
mkdirSync(join(ROOT, 'public'), {recursive: true});
copyFileSync(final, join(ROOT, 'public/final_mix.wav'));
console.log('final_mix.wav written; pass-1 input loudness', m.input_i, 'LUFS');
