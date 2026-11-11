// Frame renderer. Usage:
//   node src/render.mjs --stills 0.5,3.2,...          -> build/stills/*.png
//   node src/render.mjs --range 0:600 --out a.mkv     -> one worker (raw RGBA -> ffmpeg lossless)
//   node src/render.mjs --all [--workers 4]           -> parallel render + concat -> build/video_noaudio.mkv
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { W, H, FPS } from './core.mjs';
import { FRAMES } from './timeline.mjs';
import { drawCaptions, drawWatermark, initPost, post } from './fx.mjs';
import { SCENES } from './scenes/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
GlobalFonts.registerFromPath(path.join(ROOT, 'node_modules/@fontsource/luckiest-guy/files/luckiest-guy-latin-400-normal.woff2'), 'Luckiest Guy');
GlobalFonts.registerFromPath(path.join(ROOT, 'node_modules/@fontsource/fredoka/files/fredoka-latin-600-normal.woff2'), 'Fredoka');
GlobalFonts.registerFromPath(path.join(ROOT, 'node_modules/@fontsource/fredoka/files/fredoka-latin-700-normal.woff2'), 'Fredoka');

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
initPost();

export function sceneAt(t) {
  for (const s of SCENES) if (t >= s.t0 && t < s.t1) return s;
  return SCENES[SCENES.length - 1];
}

function renderFrame(f) {
  const t = f / FPS;
  const s = sceneAt(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  s.draw(ctx, t, t - s.t0);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  post(ctx, t, s.post || {});
  if (s.ui) { ctx.save(); s.ui(ctx, t, t - s.t0); ctx.restore(); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawCaptions(ctx, t);
  drawWatermark(ctx);
}

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

if (arg('--stills')) {
  const dir = arg('--dir') || path.join(ROOT, 'build/stills');
  fs.mkdirSync(dir, { recursive: true });
  for (const tt of arg('--stills').split(',')) {
    const f = Math.round(parseFloat(tt) * FPS);
    const t0 = Date.now();
    renderFrame(f);
    const name = path.join(dir, `f${String(f).padStart(4, '0')}.png`);
    fs.writeFileSync(name, canvas.toBuffer('image/png'));
    console.log(name, (Date.now() - t0) + 'ms', sceneAt(f / FPS).name);
  }
} else if (arg('--range')) {
  const [a, b] = arg('--range').split(':').map(Number);
  const out = arg('--out');
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv444p', '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = a; f < b; f++) {
    renderFrame(f);
    const ok = ff.stdin.write(canvas.data());
    if (!ok) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - a) % 60 === 0) process.stderr.write(`[${a}-${b}] frame ${f} ${(((Date.now() - t0) / (f - a + 1)) | 0)}ms/f\n`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
} else if (args.includes('--all')) {
  const nw = parseInt(arg('--workers') || '4', 10);
  const total = FRAMES;
  const parts = [];
  const per = Math.ceil(total / nw);
  const procs = [];
  for (let i = 0; i < nw; i++) {
    const a = i * per, b = Math.min(total, (i + 1) * per);
    const out = path.join(ROOT, `build/part${i}.mkv`);
    parts.push(out);
    procs.push(new Promise((res, rej) => {
      const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--range', `${a}:${b}`, '--out', out], { stdio: 'inherit' });
      p.on('close', (c) => (c === 0 ? res() : rej(new Error('worker failed ' + i))));
    }));
  }
  const t0 = Date.now();
  await Promise.all(procs);
  console.log('render done in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  const list = path.join(ROOT, 'build/parts.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  await new Promise((res) => spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(ROOT, 'build/video_noaudio.mkv')], { stdio: 'inherit' }).on('close', res));
  console.log('wrote build/video_noaudio.mkv');
}
