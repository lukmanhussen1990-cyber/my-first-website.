// Render the film (or a frame range) to video by streaming raw RGBA frames into ffmpeg.
// Usage:
//   node render/render.mjs --out out/video/film_raw.mp4 [--workers 3] [--start 0 --end 1811] [--w 1080 --h 1920]
//                          [--step 1] [--crf 14] [--seg 90]
// The range is cut into short segments (default 90 frames = 3 s) that the workers (one headless browser
// each) pull from a shared queue. Every finished segment is kept on disk under <out>.segs/, so an
// interrupted render resumes where it stopped. When all segments exist they are concatenated without
// re-encoding. Delete <out>.segs/ to force a full re-render (or delete single segments to redo them).
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { startServer } from './server.mjs';
import { openPage } from './browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const W = +(args.w || 1080), H = +(args.h || 1920);
const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline/timeline.json'), 'utf8'));
const FPS = tl.fps;
const start = +(args.start || 0), end = +(args.end || tl.frames);
const workers = Math.max(1, +(args.workers || 1));
const step = Math.max(1, +(args.step || 1));
const segLen = Math.max(step, +(args.seg || 90));
const out = path.resolve(ROOT, args.out || 'out/video/film_raw.mp4');
const crf = args.crf || '14';
const segDir = out + '.segs';
fs.mkdirSync(segDir, { recursive: true });

function encoder(file) {
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS / step), '-i', '-',
    '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-pix_fmt', 'yuv420p', '-r', String(FPS / step), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  return { ff, done };
}

// segment queue
const segs = [];
for (let f = start; f < end; f += segLen) {
  const f1 = Math.min(end, f + segLen);
  segs.push({ f0: f, f1, file: path.join(segDir, `seg_${String(f).padStart(5, '0')}_${String(f1).padStart(5, '0')}.mp4`) });
}
const todo = segs.filter((s) => !fs.existsSync(s.file));
console.log(`${segs.length} segments, ${segs.length - todo.length} already done, ${todo.length} to render with ${workers} worker(s)`);
let next = 0;

async function worker(idx) {
  let enc = null;
  const { srv, port } = await startServer(ROOT, {
    onFrame: (buf) => new Promise((res) => { if (!enc.ff.stdin.write(buf)) enc.ff.stdin.once('drain', res); else res(); }),
  });
  const { browser, page } = await openPage(port, `entry=film&w=${W}&h=${H}`, { width: W, height: H, log: false });
  const t0 = Date.now();
  let n = 0;
  try {
    while (next < todo.length) {
      const seg = todo[next++];
      const tmp = seg.file.replace(/\.mp4$/, '.tmp.mp4');
      enc = encoder(tmp);
      for (let f = seg.f0; f < seg.f1; f += step) {
        await page.evaluate(async (fr) => {
          window.APP.renderAt(fr / window.APP.fps, fr);
          const px = window.APP.readPixels();
          await fetch('/frame?i=' + fr, { method: 'POST', body: px });
        }, f);
        n++;
      }
      const err = await page.evaluate('window.APP.error');
      if (err) throw new Error('page error: ' + err);
      enc.ff.stdin.end();
      await enc.done;
      fs.renameSync(tmp, seg.file);
      const el = (Date.now() - t0) / 1000;
      const doneSegs = segs.filter((s) => fs.existsSync(s.file)).length;
      console.log(`[w${idx}] ${path.basename(seg.file)} done — ${(el / n).toFixed(2)} s/frame, ${doneSegs}/${segs.length} segments complete`);
    }
  } finally {
    await browser.close();
    srv.close();
  }
}

const T = Date.now();
await Promise.all(Array.from({ length: Math.min(workers, todo.length) }, (_, i) => worker(i)));
const missing = segs.filter((s) => !fs.existsSync(s.file));
if (missing.length) { console.log(`ERROR: ${missing.length} segments missing`); process.exit(1); }
const list = path.join(segDir, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${s.file}'`).join('\n'));
await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'inherit' })
  .on('close', (c) => (c === 0 ? res() : rej(new Error('concat failed')))));
console.log(`wrote ${path.relative(ROOT, out)} in ${((Date.now() - T) / 1000).toFixed(0)} s`);
