// Render the film (or a frame range) to video by streaming raw RGBA frames into ffmpeg.
// Usage:
//   node render/render.mjs --out out/video/film_raw.mp4 [--workers 2] [--start 0 --end 1811] [--w 1080 --h 1920] [--step 1]
// With several workers the range is split into contiguous chunks rendered in parallel (one headless
// browser each), encoded to near-lossless segments, then concatenated without re-encoding.
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
const out = path.resolve(ROOT, args.out || 'out/video/film_raw.mp4');
const crf = args.crf || '12';
fs.mkdirSync(path.dirname(out), { recursive: true });

function encoder(file) {
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS / step), '-i', '-',
    '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-pix_fmt', 'yuv420p', '-r', String(FPS / step), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  return { ff, done };
}

async function renderChunk(idx, f0, f1, file) {
  const enc = encoder(file);
  let pending = Promise.resolve();
  const { srv, port } = await startServer(ROOT, {
    onFrame: (buf) => {
      pending = pending.then(() => new Promise((res) => { if (!enc.ff.stdin.write(buf)) enc.ff.stdin.once('drain', res); else res(); }));
      return pending;
    },
  });
  const { browser, page } = await openPage(port, `entry=film&w=${W}&h=${H}`, { width: W, height: H });
  const t0 = Date.now();
  let n = 0;
  try {
    for (let f = f0; f < f1; f += step) {
      await page.evaluate(async (fr) => {
        window.APP.renderAt(fr / window.APP.fps, fr);
        const px = window.APP.readPixels();
        await fetch('/frame?i=' + fr, { method: 'POST', body: px });
      }, f);
      n++;
      if (n % 30 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`[w${idx}] frame ${f} (${n}/${Math.ceil((f1 - f0) / step)}) ${(el / n).toFixed(2)} s/frame`);
      }
      const err = await page.evaluate('window.APP.error');
      if (err) throw new Error('page error: ' + err);
    }
  } finally {
    await pending;
    enc.ff.stdin.end();
    await browser.close();
    srv.close();
  }
  await enc.done;
  console.log(`[w${idx}] done ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

const total = end - start;
const per = Math.ceil(total / workers / step) * step;
const chunks = [];
for (let i = 0; i < workers; i++) {
  const f0 = start + i * per, f1 = Math.min(end, f0 + per);
  if (f0 < f1) chunks.push([i, f0, f1, workers === 1 ? out : out.replace(/\.mp4$/, `.part${i}.mp4`)]);
}
const T = Date.now();
await Promise.all(chunks.map((c) => renderChunk(...c)));
if (chunks.length > 1) {
  const list = out.replace(/\.mp4$/, '.txt');
  fs.writeFileSync(list, chunks.map((c) => `file '${c[3]}'`).join('\n'));
  await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'inherit' })
    .on('close', (c) => (c === 0 ? res() : rej(new Error('concat failed')))));
  chunks.forEach((c) => fs.unlinkSync(c[3]));
  fs.unlinkSync(list);
}
console.log(`wrote ${path.relative(ROOT, out)} in ${((Date.now() - T) / 1000).toFixed(0)} s`);
