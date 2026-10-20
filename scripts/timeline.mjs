// Builds src/timeline.json from the cached voice lines' REAL lengths.
//
// Scene length = lead beat + voice line(s) + 0.4 s padding + tail beat.
// Voice length is measured from the waveform (first to last audible sample), and
// the visual beats are scaled together so the reel lands on story.targetDuration
// (clamped to 60-70 s). Captions, the whisper bubble and every story cue (scares,
// door lock, phone, twist) are derived from the word timestamps, so picture and
// sound stay locked even when the voice changes.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readStory } from './lib/util.mjs';

const story = readStory();
const FPS = story.fps;
const frame = (t) => Math.round(t * FPS) / FPS;

function readWavMono(file) {
  const buf = fs.readFileSync(file);
  let off = 12;
  let fmt;
  let data;
  while (off < buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { channels: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    if (id === 'data') data = buf.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size & 1);
  }
  if (!fmt || fmt.bits !== 16) throw new Error(`${file}: expected 16-bit PCM WAV`);
  const n = data.length / 2 / fmt.channels;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = data.readInt16LE(i * 2 * fmt.channels) / 32768;
  return { samples: out, rate: fmt.rate };
}

// First/last audible sample (-42 dBFS on a 10 ms moving average).
function speechBounds({ samples, rate }) {
  const win = Math.round(rate * 0.01);
  const thresh = 10 ** (-42 / 20);
  let acc = 0;
  let first = -1;
  let last = -1;
  for (let i = 0; i < samples.length; i++) {
    acc += Math.abs(samples[i]);
    if (i >= win) acc -= Math.abs(samples[i - win]);
    if (acc / win > thresh) {
      if (first < 0) first = i - win;
      last = i;
    }
  }
  return { start: Math.max(0, first) / rate, end: Math.min(samples.length, last + 1) / rate, duration: samples.length / rate };
}

const clean = (s) => s.toLowerCase().replace(/[^a-z0-9':-]/g, '').replace(/^'+|'+$/g, '');

function loadLine(id) {
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, `audio/vo/${id}.json`), 'utf8'));
  const wav = path.join(ROOT, `audio/vo/${id}.wav`);
  const bounds = speechBounds(readWavMono(wav));
  const words = meta.words
    .filter((w) => /[a-z0-9]/i.test(w.text))
    .map((w) => ({ text: w.text, key: clean(w.text), start: w.start, end: Math.max(w.start, Math.min(w.end, bounds.end)) }));
  return { id, engine: meta.engine, file: `audio/vo/${id}.wav`, ...bounds, speech: bounds.end - bounds.start, words };
}

const lines = Object.fromEntries(story.lines.map((l) => [l.id, { ...loadLine(l.id), voice: l.voice, text: l.text }]));

// ---- solve the beat scale so the total hits the target length ----
let fixedTotal = 0;
let beatTotal = 0;
for (const sc of story.scenes) {
  if (sc.fixed) {
    fixedTotal += sc.fixed;
    continue;
  }
  fixedTotal += sc.lines.reduce((s, id) => s + lines[id].speech, 0) + story.scenePadding;
  beatTotal += sc.lead + sc.tail + (sc.gaps || []).reduce((a, b) => a + b, 0);
}
let k = (story.targetDuration - fixedTotal) / beatTotal;
k = Math.min(2.5, Math.max(0.55, k));
const projected = fixedTotal + k * beatTotal;
if (projected < story.minDuration) k = (story.minDuration - fixedTotal) / beatTotal;
if (projected > story.maxDuration) k = (story.maxDuration - fixedTotal) / beatTotal;

// ---- lay out scenes ----
const scenes = [];
const vo = [];
const captions = [];
let bubble = null;
const cues = {};
let cursor = 0;

for (const sc of story.scenes) {
  const start = frame(cursor);
  const scene = { id: sc.id, name: sc.name, start, scare: !!sc.scare, lines: {} };
  if (sc.fixed) {
    scene.end = frame(start + sc.fixed);
  } else {
    let t = start + sc.lead * k;
    scene.voStart = t;
    sc.lines.forEach((id, i) => {
      if (i) t += sc.gaps[i - 1] * k;
      const L = lines[id];
      const clipStart = t - L.start;
      const words = L.words.map((w) => ({ text: w.text, key: w.key, start: clipStart + w.start, end: clipStart + w.end }));
      scene.lines[id] = { start: t, end: t + L.speech, words };
      vo.push({ id, voice: L.voice, file: L.file, start: +clipStart.toFixed(4), speechStart: +t.toFixed(4), speechEnd: +(t + L.speech).toFixed(4) });
      t += L.speech;
    });
    scene.voEnd = t;
    scene.end = frame(t + story.scenePadding + sc.tail * k);
  }
  scenes.push(scene);
  cursor = scene.end;

  // captions: one at a time, each starting just before its first spoken word
  const own = [];
  for (const c of sc.captions || []) {
    const words = scene.lines[c.line].words;
    let idx = 0;
    if (c.at) {
      const prev = own.length ? own[own.length - 1].wordIndex : -1;
      idx = words.findIndex((w, i) => i > prev && w.key.startsWith(c.at));
      if (idx < 0) throw new Error(`caption anchor "${c.at}" not found in ${c.line}`);
    }
    const cap = { scene: sc.id, text: c.text, red: c.red || null, start: Math.max(scene.start, words[idx].start - 0.08), wordIndex: idx };
    if (c.reveal === 'words') {
      const capWords = c.text.split(/\s+/);
      cap.wordTimes = capWords.map((_, i) => words[Math.min(idx + i, words.length - 1)].start - 0.04);
    }
    own.push(cap);
  }
  own.forEach((cap, i) => {
    cap.end = i + 1 < own.length ? own[i + 1].start : scene.end;
    delete cap.wordIndex;
    captions.push(cap);
  });
  if (sc.bubble) {
    const L = scene.lines[sc.bubble.line];
    bubble = { scene: sc.id, text: sc.bubble.text, start: L.start - 0.12, end: scene.end, words: L.words };
  }
}

// ---- story cues (absolute seconds) ----
const S = Object.fromEntries(scenes.map((s) => [s.id, s]));
const word = (sceneId, lineId, key) => S[sceneId].lines[lineId].words.find((w) => w.key.startsWith(key));
{
  const s4 = S[4];
  cues.s4_lookDown = s4.start + 0.1;
  cues.s4_phoneFull = s4.lines.s04.words[0].start - 0.15;
  cues.s4_lookUp = word(4, 's04', 'second').end + 0.05;
  cues.s4_reveal = word(4, 's04', "she's").start - 0.05;
  const s5 = S[5];
  cues.s5_drop = s5.start + 0.05;
  cues.s5_cutToLock = s5.voStart + 0.15;
  cues.s5_keyIn = word(5, 's05', 'lock').start - 0.1;
  cues.s5_keyTurn = word(5, 's05', 'door').start;
  cues.s5_lockClick = word(5, 's05', 'door').start + 0.3;
  const s6 = S[6];
  cues.s6_turn = s6.start + 0.05;
  cues.s6_reveal = s6.voStart - 0.12;
  const s7 = S[7];
  cues.s7_flicker = s7.start;
  cues.s7_duck = s7.start + 0.25;
  cues.s7_hand = s7.voStart + 0.35;
  cues.s7_heartbeat = s7.voStart;
  cues.s8_silence = S[8].start;
  cues.s8_realize = word(8, 's08', 'realize').start;
  cues.s9_rise = S[9].start + 0.15;
  cues.s9_risen = S[9].voStart + 0.1;
  const s10 = S[10];
  // push-in -> reveal hit -> 0.7 s of total silence -> whisper -> narrator
  cues.s10_reveal = s10.voStart - 1.05 * k;
  cues.s10_silence = s10.voStart - 0.7 * k;
  cues.s10_whisper = s10.lines.s10w.start;
  cues.s10_narrator = s10.lines.s10.start;
  cues.s11_card = S[11].start;
  cues.s12_twist = frame(S[12].start + 0.9);
  cues.s12_twistFrames = 3;
}
for (const key of Object.keys(cues)) if (key !== 's12_twistFrames') cues[key] = +cues[key].toFixed(4);

const duration = scenes[scenes.length - 1].end;

// Her off-beat heel landings and ring taps, on her 12 fps animation clock. The
// renderer animates from these and the sound design places taps on the same times.
const Q = 1 / 12;
const stepIntervals = [7, 5, 8, 4, 7, 6, 9, 5];
const danceSteps = [];
for (let t = 3 * Q, k = 0; t < duration; t += stepIntervals[k % stepIntervals.length] * Q, k++) {
  danceSteps.push({ t: +t.toFixed(4), foot: k % 2 ? 'R' : 'L' });
}
const tapIntervals = [3, 3, 2, 4, 3, 3, 2, 5, 3, 2, 3, 4];
const glassTaps = [];
for (let t = Math.ceil((cues.s6_reveal - 0.1) * 12) * Q, k = 0; t < S[8].start - 0.05; t += tapIntervals[k % tapIntervals.length] * Q, k++) {
  glassTaps.push({ t: +t.toFixed(4), finger: k % 2 });
}
const timeline = {
  fps: FPS,
  width: story.width,
  height: story.height,
  duration,
  frames: Math.round(duration * FPS),
  beatScale: +k.toFixed(4),
  voiceEngine: [...new Set(Object.values(lines).map((l) => l.engine))].join('+'),
  scenes: scenes.map((s) => ({ ...s, start: +s.start.toFixed(4), end: +s.end.toFixed(4) })),
  vo,
  captions,
  bubble,
  choiceCard: { ...story.choiceCard, start: cues.s11_card },
  cues,
  danceSteps,
  glassTaps,
};
fs.writeFileSync(path.join(ROOT, 'src/timeline.json'), JSON.stringify(timeline, null, 1));

console.log(`Timeline: ${duration.toFixed(2)} s, ${timeline.frames} frames, beat scale ${k.toFixed(3)}, voice: ${timeline.voiceEngine}`);
for (const s of scenes) console.log(`  scene ${String(s.id).padStart(2)} ${s.name.padEnd(8)} ${s.start.toFixed(2).padStart(6)} -> ${s.end.toFixed(2).padStart(6)}  (${(s.end - s.start).toFixed(2)} s)`);
if (duration < story.minDuration || duration > story.maxDuration) console.warn(`WARNING: duration ${duration.toFixed(2)} s is outside ${story.minDuration}-${story.maxDuration} s`);
