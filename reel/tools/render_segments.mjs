#!/usr/bin/env node
// Renders the whole film in segments (one per scene) with a few parallel
// workers, then joins them into build/clean_video.mp4 (no audio, no subtitles)
// and makes the lighter out/clean_video.mp4 that the re-export uses.
// Segments that already exist are skipped, so a crashed run can be resumed and
// a single scene can be re-rendered by deleting its file.
//
//   node tools/render_segments.mjs            # render missing segments + join
//   node tools/render_segments.mjs --jobs 1   # one worker
//   node tools/render_segments.mjs --only 3   # re-render scene 3 only (then join)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const JOBS = +opt('jobs', 2);
const ONLY = opt('only', null);
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json'), 'utf8'));
const total = Math.round(TL.duration * TL.fps);
const segDir = path.join(ROOT, 'build', 'seg');
fs.mkdirSync(segDir, { recursive: true });

// one segment per scene
const segs = TL.scenes.map((s, i) => ({
  n: i + 1,
  a: Math.round(s.start * TL.fps),
  b: i === TL.scenes.length - 1 ? total : Math.round(TL.scenes[i + 1].start * TL.fps),
}));
for (const s of segs) {
  s.file = path.join(segDir, `scene${s.n}.mp4`);
  if (ONLY && String(s.n) === String(ONLY) && fs.existsSync(s.file)) fs.unlinkSync(s.file);
}
const todo = segs.filter((s) => !fs.existsSync(s.file));

function run(s) {
  return new Promise((resolve, reject) => {
    const tmp = s.file.replace(/\.mp4$/, '.part.mp4');
    const log = fs.openSync(s.file.replace(/\.mp4$/, '.log'), 'w');
    console.log(`scene ${s.n}: frames ${s.a}..${s.b - 1}`);
    const p = spawn('node', [path.join(ROOT, 'tools/render.mjs'), '--range', `${s.a}:${s.b}`, '--video', path.relative(ROOT, tmp)],
      { cwd: ROOT, stdio: ['ignore', log, log] });
    p.on('exit', (code) => {
      fs.closeSync(log);
      if (code === 0) { fs.renameSync(tmp, s.file); console.log(`scene ${s.n}: done`); resolve(); }
      else reject(new Error(`scene ${s.n} failed (exit ${code}), see ${s.file.replace(/\.mp4$/, '.log')}`));
    });
  });
}

const queue = [...todo];
await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
  while (queue.length) await run(queue.shift());
}));

// join (stream copy: all segments share the same encoder settings)
const list = path.join(segDir, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${s.file}'`).join('\n') + '\n');
const ff = (argv) => new Promise((resolve, reject) => {
  const p = spawn('ffmpeg', argv, { stdio: 'inherit' });
  p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg failed'))));
});
const master = path.join(ROOT, 'build', 'clean_video.mp4');
await ff(['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', master]);
console.log(`wrote ${path.relative(ROOT, master)} (master quality)`);
// a lighter copy that is kept in the repository, so the voices can be re-made
// and the reel re-exported later without rendering the 3D again
const keep = path.join(ROOT, 'out', 'clean_video.mp4');
fs.mkdirSync(path.dirname(keep), { recursive: true });
await ff(['-v', 'error', '-y', '-i', master, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-maxrate', '12M', '-bufsize', '24M',
  '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', keep]);
console.log(`wrote ${path.relative(ROOT, keep)}`);
