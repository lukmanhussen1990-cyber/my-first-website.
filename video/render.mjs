// Offline renderer: drives index.html in headless Chromium frame by frame and
// pipes the frames to ffmpeg. The output has NO audio stream (-an).
//
//   node render.mjs                      -> out/brushstroke-disc.mp4
//   node render.mjs --fps 60 --workers 4 --crf 20
//   node render.mjs --from 8 --to 10 --out out/clip.mp4
//   node render.mjs --stills 1.2,7.9,12.5  -> out/stills/*.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(process.execPath, '../../lib/node_modules/playwright')); }

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => {
  if (v.startsWith('--')) a.push([v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return a;
}, []));
const FPS = Number(args.fps || 30);
const WORKERS = Number(args.workers || 4);
const OUT = path.resolve(here, args.out || 'out/brushstroke-disc.mp4');
const FFMPEG = args.ffmpeg || process.env.FFMPEG || 'ffmpeg';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(here, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(here) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/index.html?render`;

const browser = await playwright.chromium.launch();
async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => { console.error('page error:', e); process.exit(1); });
  await page.goto(url);
  await page.evaluate(() => window.motionReady);
  return page;
}
const grab = (page, t, type) => page.evaluate(([t, type]) => {
  window.renderFrame(t);
  return document.getElementById('c').toDataURL(type, 0.97);
}, [t, type]);

if (args.stills) {
  const dir = path.resolve(here, 'out/stills');
  fs.mkdirSync(dir, { recursive: true });
  const page = await openPage();
  for (const s of String(args.stills).split(',')) {
    const t = Number(s);
    const data = await grab(page, t, 'image/png');
    fs.writeFileSync(path.join(dir, `t${t.toFixed(2).padStart(5, '0')}.png`), Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('stills written to', dir);
} else {
  const duration = await (await openPage()).evaluate(() => window.DURATION);
  const from = Math.round(Number(args.from || 0) * FPS);
  const total = Math.round(Number(args.to || duration) * FPS) - from;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const ff = spawn(FFMPEG, [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 20), '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const pages = await Promise.all(Array.from({ length: WORKERS }, openPage));
  const done = new Map();
  let next = 0, written = 0;
  const t0 = Date.now();
  const flush = async () => {
    while (done.has(written)) {
      const buf = done.get(written); done.delete(written);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      written++;
      if (written % FPS === 0) process.stdout.write(`\r${written}/${total} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  };
  await Promise.all(pages.map(async page => {
    while (next < total) {
      const i = next++;
      const data = await grab(page, (from + i) / FPS, 'image/jpeg');
      done.set(i, Buffer.from(data.split(',')[1], 'base64'));
      await flush();
    }
  }));
  await flush();
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log(`\nwrote ${OUT}`);
}
await browser.close();
server.close();
