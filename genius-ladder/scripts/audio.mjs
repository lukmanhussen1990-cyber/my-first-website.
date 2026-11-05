// Mix narration clips + procedural SFX + ambience into build/audio.wav, placed by the timeline.
//   node scripts/audio.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './serve.mjs';
import { TIMELINE } from '../src/timeline.js';
import { compileTimeline } from '../src/director.js';
import { decode, writeWav, SR } from './lib/pcm.mjs';
import { SFX, crickets } from './lib/sfx.mjs';

const VO_GAIN = 1.0; // narration sits on top
const SFX_GAIN = 0.42; // effects clearly under the voice
const AMB_GAIN = 0.035;

const voFile = path.join(ROOT, 'build/vo.json');
const voTiming = fs.existsSync(voFile) ? JSON.parse(fs.readFileSync(voFile, 'utf8')) : {};
const tl = compileTimeline(TIMELINE, voTiming);
const n = Math.ceil(tl.total * SR);
const L = new Float32Array(n), R = new Float32Array(n);

function add(clip, at, gain, pan = 0) {
  const o = Math.round(at * SR);
  const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  for (let i = 0; i < clip.length && o + i < n; i++) {
    if (o + i < 0) continue;
    L[o + i] += clip[i] * gl;
    R[o + i] += clip[i] * gr;
  }
}

// narration: normalise all clips by one shared peak so relative levels are kept
const clips = tl.voClips.filter((c) => c.file).map((c) => ({ ...c, pcm: decode(path.join(ROOT, c.file)) }));
let peak = 1e-6;
for (const c of clips) for (const v of c.pcm) peak = Math.max(peak, Math.abs(v));
for (const c of clips) add(c.pcm, c.start, (VO_GAIN * 0.89) / peak);
if (!clips.length) console.warn('no narration clips found — run scripts/narration.mjs (or tts) first');

const cache = {};
for (const [i, e] of tl.sfx.entries()) {
  if (!e.sound) continue;
  if (!SFX[e.sound]) { console.warn(`unknown sound "${e.sound}"`); continue; }
  cache[e.sound] ||= SFX[e.sound]();
  add(cache[e.sound], e.t0, SFX_GAIN * (e.gain ?? 1), ((i % 3) - 1) * 0.25);
}

const amb = crickets(tl.total);
for (let i = 0; i < n; i++) {
  const t = i / SR, fade = Math.min(1, t / 0.5, (tl.total - t) / 0.5);
  L[i] += amb[i] * AMB_GAIN * fade;
  R[i] += amb[i] * AMB_GAIN * 0.8 * fade;
}

// gentle soft clip so stacked hits never distort
for (const ch of [L, R]) for (let i = 0; i < n; i++) ch[i] = Math.tanh(ch[i] * 1.1) / Math.tanh(1.1);
writeWav(path.join(ROOT, 'build/audio.wav'), [L, R]);
console.log(`wrote build/audio.wav (${tl.total.toFixed(2)} s, ${clips.length} narration clips, ${tl.sfx.filter((e) => e.sound).length} sfx)`);
