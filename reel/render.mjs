// Renders the reel with headless Chromium.
//   node render.mjs stills            -> out/scene-1.png … scene-8.png
//   node render.mjs video [fps]       -> out/maa-ki-lori.mp4
//   node render.mjs frame <seconds>   -> out/frame.png (debugging)
// Needs Playwright + Chromium and ffmpeg. A global Playwright works via NODE_PATH="$(npm root -g)".
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'out');
mkdirSync(out, { recursive: true });
const [mode = 'stills', arg] = process.argv.slice(2);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(pathToFileURL(path.join(here, 'index.html')).href + '?render=1');
await page.waitForFunction(() => window.REEL);

const grab = (expr, type = 'image/png', q) => page.evaluate(([expr, type, q]) => {
  const cv = document.getElementById('c'), ctx = cv.getContext('2d');
  new Function('ctx', expr)(ctx);
  return cv.toDataURL(type, q).split(',')[1];
}, [expr, type, q]);

if (mode === 'stills') {
  const n = await page.evaluate(() => REEL.SCENES.length);
  const only = arg ? arg.split(',').map(Number) : null;
  for (let i = 0; i < n; i++) {
    if (only && !only.includes(i + 1)) continue;
    writeFileSync(path.join(out, `scene-${i + 1}.png`), Buffer.from(await grab(`REEL.renderStill(ctx, ${i})`), 'base64'));
    console.log(`scene-${i + 1}.png`);
  }
} else if (mode === 'frames') {
  // node render.mjs frames 0:50:1  -> out/frames/f-<t>.png (storyboard)
  const [a, b, step] = arg.split(':').map(Number);
  mkdirSync(path.join(out, 'frames'), { recursive: true });
  for (let t = a; t <= b + 1e-9; t += step) {
    writeFileSync(path.join(out, 'frames', `f-${t.toFixed(2).padStart(5, '0')}.png`), Buffer.from(await grab(`REEL.renderAt(ctx, ${t})`), 'base64'));
  }
} else if (mode === 'frame') {
  writeFileSync(path.join(out, 'frame.png'), Buffer.from(await grab(`REEL.renderAt(ctx, ${Number(arg)})`), 'base64'));
} else if (mode === 'video') {
  const fps = Number(arg || 30), total = await page.evaluate(() => REEL.TOTAL), frames = Math.round(total * fps);
  const file = path.join(out, 'maa-ki-lori.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', file],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    const buf = Buffer.from(await grab(`REEL.renderAt(ctx, ${f / fps})`, 'image/jpeg', 0.95), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 150 === 0) console.log(`frame ${f}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('wrote', file);
}
await browser.close();
