// Frame-by-frame render: headless Chromium draws each frame, we pipe JPEGs into ffmpeg.
//   node scripts/render.mjs                  full 1080x1920 render + mux with build/audio.wav
//   node scripts/render.mjs --workers 3      split frames across N browser pages (faster on multi-core)
//   node scripts/render.mjs --stills 0.5     contact sheet every 0.5 s  -> build/stills.png (debug overlay)
//   node scripts/render.mjs --stills 1.2,3.4 contact sheet of specific times
//   node scripts/render.mjs --range 10:14    render only a time range (seconds) -> build/range.mp4
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { openPage } from './lib/browser.mjs';
import { ROOT } from './serve.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
};
const BUILD = path.join(ROOT, 'build');
const OUT = path.join(ROOT, 'out');
fs.mkdirSync(BUILD, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

async function stills(spec) {
  const scale = Number(opt('scale', 0.3));
  const { page, close } = await openPage({ scale, debug: true });
  const info = await page.evaluate(() => window.timelineInfo());
  let times;
  if (String(spec).includes(',')) times = String(spec).split(',').map(Number);
  else {
    const step = Number(spec) || 0.5;
    times = [];
    for (let t = 0.02; t < info.total; t += step) times.push(+t.toFixed(3));
  }
  const dir = path.join(BUILD, 'stills');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, t] of times.entries()) {
    const url = await page.evaluate((tt) => window.renderTime(tt), t);
    fs.writeFileSync(path.join(dir, `s${String(i).padStart(3, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  await close();
  const cols = Number(opt('cols', 8));
  const rows = Math.ceil(times.length / cols);
  const outFile = path.join(BUILD, opt('out', 'stills.png'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(dir, 's%03d.png'), '-vf', `tile=${cols}x${rows}:padding=4:color=white`, '-frames:v', '1', outFile]);
  console.log(`wrote ${outFile} (${times.length} stills)`);
}

async function renderFrames(from, to, file, onFrame, scale = 1) {
  const { page, close } = await openPage({ scale });
  const ff = spawn('ffmpeg', [
    '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = from; i < to; i++) {
    const url = await page.evaluate((f) => window.renderFrame(f, 'image/jpeg', 0.96), i);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    onFrame?.(i);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await close();
}

async function full() {
  const { page, close } = await openPage({ scale: 0.1 });
  const info = await page.evaluate(() => window.timelineInfo());
  await close();
  let from = 0, to = info.frames;
  const range = opt('range', null);
  if (range) {
    const [a, b] = String(range).split(':').map(Number);
    from = Math.round(a * info.fps);
    to = Math.min(info.frames, Math.round(b * info.fps));
  }
  const workers = Math.max(1, Number(opt('workers', 2)));
  const per = Math.ceil((to - from) / workers);
  const t0 = Date.now();
  let done = 0;
  const tick = () => {
    done++;
    if (done % 30 === 0 || done === to - from) {
      const el = (Date.now() - t0) / 1000;
      process.stdout.write(`\rframes ${done}/${to - from}  ${(done / el).toFixed(2)} fps  eta ${Math.round(((to - from - done) / done) * el)}s   `);
    }
  };
  const parts = [];
  const jobs = [];
  for (let w = 0; w < workers; w++) {
    const a = from + w * per, b = Math.min(to, a + per);
    if (a >= b) continue;
    const f = path.join(BUILD, `part${w}.mp4`);
    parts.push(f);
    jobs.push(renderFrames(a, b, f, tick, Number(opt('scale', 1))));
  }
  await Promise.all(jobs);
  console.log(`\nrendered ${to - from} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const list = path.join(BUILD, 'parts.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  const video = path.join(BUILD, range ? 'range_video.mp4' : 'video.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
  const audio = path.join(BUILD, 'audio.wav');
  const final = opt('out', null) ? path.join(OUT, opt('out')) : range ? path.join(BUILD, 'range.mp4') : path.join(OUT, 'genius-ladder.mp4');
  const aArgs = fs.existsSync(audio)
    ? ['-ss', String(from / info.fps), '-t', String((to - from) / info.fps), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k']
    : [];
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, ...aArgs, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', '-shortest', final]);
  console.log(`wrote ${final}`);
}

if (opt('stills', null)) await stills(opt('stills'));
else await full();
