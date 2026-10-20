// Builds src/timeline.json from the real voice-line lengths:
// scene duration = voice line + padding, captions/SFX cue on word timestamps.
//
//   node scripts/timeline.js
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadStory, voCachePaths, readJSON, writeJSON, findPhrase } from './lib.js';

const story = loadStory();
const { fps } = story.video;
const pad = story.padding;

let t = 0;
const scenes = [];
const events = [];
const warnings = [];
const snap = (x) => Math.round(x * 1000) / 1000;

for (const [index, s] of story.scenes.entries()) {
  const scene = { id: s.id, index: index + 1, start: snap(t) };
  let vo = null;
  if (s.voice) {
    const { mp3, json } = voCachePaths(s.id);
    if (!fs.existsSync(json)) throw new Error(`Missing voice line ${s.id}; run scripts/voice.js first.`);
    const meta = readJSON(json);
    if (meta.text !== s.text) warnings.push(`${s.id}: cached take text differs from story.json`);
    vo = {
      file: path.relative(ROOT, mp3),
      role: s.voice,
      source: meta.source,
      start: scene.start,
      duration: meta.duration,
      words: meta.words.map((w) => ({ text: w.text, start: snap(scene.start + w.start), end: snap(scene.start + w.end) })),
    };
    scene.duration = snap(meta.duration + pad);
  } else {
    scene.duration = s.duration;
  }
  scene.end = snap(scene.start + scene.duration);
  scene.vo = vo;

  const wordTime = (phrase) => {
    const hit = vo && findPhrase(vo.words, phrase);
    if (!hit) {
      warnings.push(`${s.id}: cue "${phrase}" not found in voice words`);
      return scene.start;
    }
    return hit.start;
  };

  if (s.caption) {
    scene.caption = { ...s.caption, start: snap(wordTime(s.caption.cue)), end: scene.end };
  }
  if (s.bubble) scene.bubble = { text: s.bubble, start: scene.start, end: scene.end, words: vo?.words || [] };
  if (s.notification) scene.notification = { text: s.notification, start: snap(wordTime('phone') - 0.25), end: scene.end };
  if (s.choice) scene.choice = { ...s.choice, start: scene.start, comment: snap(wordTime('comment')) };
  if (s.choice_hold) scene.choice_hold = true;
  if (s.twist) scene.twist = { start: scene.start, end: scene.end };
  if (s.scare) scene.scare = true;
  if (s.silence_tail) scene.silence = { start: snap(scene.end - s.silence_tail), end: scene.end };

  for (const e of s.sfx || []) {
    const at = 'word' in e.at ? wordTime(e.at.word) + (e.at.offset || 0) : scene.start + e.at.scene;
    events.push({ type: e.type, time: snap(at), scene: s.id });
  }
  scenes.push(scene);
  t = scene.end;
}

// Scare moments drive camera shake + chromatic aberration (scenes 5, 8, 10).
const scares = [];
for (const sc of scenes) {
  if (!sc.scare) continue;
  const hit = events.find((e) => e.scene === sc.id && (e.type === 'hit' || e.type === 'hit_soft'));
  scares.push({ scene: sc.id, time: hit ? hit.time : sc.start, strength: hit?.type === 'hit_soft' ? 0.75 : 1 });
}

const duration = snap(t);
const timeline = {
  fps,
  width: story.video.width,
  height: story.video.height,
  duration,
  frames: Math.round(duration * fps),
  watermark: story.watermark,
  rail: story.rail,
  voice_sources: [...new Set(scenes.filter((s) => s.vo).map((s) => s.vo.source))],
  scenes,
  events: events.sort((a, b) => a.time - b.time),
  scares,
};
writeJSON(path.join(ROOT, 'src/timeline.json'), timeline);

for (const s of scenes) {
  const cap = s.caption ? `  caption@${s.caption.start.toFixed(2)} "${s.caption.text}"` : '';
  console.log(`${s.id}  ${s.start.toFixed(2)} → ${s.end.toFixed(2)}  (${s.duration.toFixed(2)}s)${cap}`);
}
console.log(`total ${duration.toFixed(2)}s, ${timeline.frames} frames @ ${fps}fps`);
if (duration < 55 || duration > 65) warnings.push(`total length ${duration.toFixed(2)}s is outside 55-65s`);
for (const w of warnings) console.warn('WARN', w);
