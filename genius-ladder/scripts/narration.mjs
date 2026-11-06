// Import a recorded/TTS narration file and sync it to the timeline.
//   node scripts/narration.mjs [assets/narration.mp3]
// The file is split at its pauses into one clip per timeline `vo` segment (in order).
// Each clip is placed on its beat by the mixer, and caption chunk start times inside
// the clip are estimated from syllable counts, then snapped to the nearest dip in loudness.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './serve.mjs';
import { loadStory } from '../src/stories.js';
import { autoCaps } from '../src/director.js';
import { decode, writeWav, SR } from './lib/pcm.mjs';

const ai = process.argv.indexOf('--story');
const { TIMELINE, narration, id: STORY } = await loadStory(ai > 0 ? process.argv[ai + 1] : 'ladder');
const fileArg = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--story');
const src = path.resolve(ROOT, fileArg || narration);
const BUILD = path.join(ROOT, 'build', STORY);
fs.mkdirSync(path.join(BUILD, 'vo'), { recursive: true });

// 1. find spoken segments (pauses >= 0.25 s below -35 dB)
const det = execFileSync('sh', ['-c', `ffmpeg -v info -i "${src}" -af silencedetect=noise=-35dB:d=0.25 -f null - 2>&1`]).toString();
const total = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString());
const starts = [...det.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
const ends = [...det.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
const sil = starts.map((s, i) => [s, ends[i] ?? total]);
const speech = [];
let cur = 0;
for (const [s, e] of sil) {
  if (s - cur > 0.15) speech.push([cur, s]);
  cur = e;
}
if (total - cur > 0.15) speech.push([cur, total]);

const segs = [];
for (const b of TIMELINE) (b.vo || []).forEach((v, i) => segs.push({ key: `${b.id}#${i}`, ...v, caps: v.caps || autoCaps(v.text) }));
if (speech.length !== segs.length) {
  console.error(`Found ${speech.length} spoken segments but the timeline has ${segs.length} vo segments:`);
  speech.forEach(([a, b2]) => console.error(`  ${a.toFixed(2)}-${b2.toFixed(2)}`));
  process.exit(1);
}

// 2. syllable-weighted caption timing, snapped to loudness dips
const syl = (w) => {
  w = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
};
const weight = (chunk) => chunk.split(/\s+/).reduce((a, w) => a + syl(w) + 0.35, 0) + (/[,.]$/.test(chunk) ? 0.8 : 0);

const out = {};
speech.forEach(([a, b], i) => {
  const seg = segs[i];
  const pad0 = Math.min(0.04, a), pad1 = 0.1;
  const clip = decode(src, { start: a - pad0, dur: b - a + pad0 + pad1 });
  // short fades so cuts never click
  const f = Math.round(0.012 * SR);
  for (let k = 0; k < f; k++) { clip[k] *= k / f; clip[clip.length - 1 - k] *= k / f; }
  const file = `build/${STORY}/vo/${seg.key.replace('#', '_')}.wav`;
  writeWav(path.join(ROOT, file), [clip]);

  // loudness envelope (10 ms)
  const hop = SR / 100, env = [];
  for (let k = 0; k + hop <= clip.length; k += hop) {
    let s = 0;
    for (let j = 0; j < hop; j++) s += clip[k + j] * clip[k + j];
    env.push(Math.sqrt(s / hop));
  }
  const sm = env.map((_, k) => (env[k - 1] ?? env[k]) * 0.25 + env[k] * 0.5 + (env[k + 1] ?? env[k]) * 0.25);
  const ws = seg.caps.map(weight), W = ws.reduce((x, y) => x + y, 0);
  const speechDur = b - a;
  let acc = 0;
  const st = [0];
  for (let c = 1; c < ws.length; c++) {
    acc += ws[c - 1];
    const est = pad0 + (acc / W) * speechDur;
    let best = est, bestV = Infinity;
    for (let d = -0.16; d <= 0.16; d += 0.01) {
      const k = Math.round((est + d) * 100);
      if (k <= 0 || k >= sm.length) continue;
      const v = sm[k] * (1 + Math.abs(d) * 2.5); // prefer dips close to the estimate
      if (v < bestV) { bestV = v; best = est + d; }
    }
    st.push(Math.max(st[c - 1] + 0.22, best - 0.03));
  }
  out[seg.key] = { file, dur: clip.length / SR, starts: st.map((x) => +x.toFixed(3)), src: [+a.toFixed(3), +b.toFixed(3)] };
  console.log(`${seg.key.padEnd(10)} ${a.toFixed(2)}-${b.toFixed(2)}s  ${seg.caps.map((c, k) => `${st[k].toFixed(2)} ${c}`).join(' | ')}`);
});
fs.writeFileSync(path.join(BUILD, 'vo.json'), JSON.stringify(out, null, 2));
console.log(`wrote build/${STORY}/vo.json`);
