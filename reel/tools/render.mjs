#!/usr/bin/env node
// Headless renderer driver: renders frames of render/index.html in Chromium
// (WebGL on Mesa lavapipe, a fast CPU Vulkan driver) and hands raw pixels to
// ffmpeg. Every frame is rendered on its own - no screen recording.
//
//   node tools/render.mjs --stills 0,240,480 --out stills/f        -> stills/f_0000.png ...
//   node tools/render.mjs --range 0:1665 --video build/clean.mp4   -> lossless-ish H.264
//   node tools/render.mjs --mode lab --view side --w 1200 --h 620 --out stills/lab
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const W = +(args.w || 1080), H = +(args.h || 1920), FPS = +(args.fps || 30);
const mode = args.mode || 'film';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.bin': 'application/octet-stream' };
let frameSink = null; // async (id, buffer) => void

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST' && url.startsWith('/__frame/')) {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      try { await frameSink(url.slice(9), Buffer.concat(chunks)); res.writeHead(200); res.end('ok'); }
      catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
    });
    return;
  }
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const launchEnv = { ...process.env, VK_ICD_FILENAMES: '/usr/share/vulkan/icd.d/lvp_icd.json' };
const browser = await chromium.launch({
  env: launchEnv,
  args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--use-vulkan=native', '--ignore-gpu-blocklist',
    '--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog', '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling', '--force-gpu-mem-available-mb=4096'],
});
const page = await browser.newPage({ viewport: { width: Math.min(W, 1920), height: Math.min(H, 1920) } });
page.on('console', (m) => { const t = m.text(); if (!t.includes('GPU stall')) console.log('[page]', t); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const DRIVER_ARGS = new Set(['w', 'h', 'fps', 'mode', 'stills', 'out', 'range', 'video', 'crf']);
const pass = Object.fromEntries(Object.entries(args).filter(([k]) => !DRIVER_ARGS.has(k)).map(([k, v]) => [k, String(v)]));
const q = new URLSearchParams({ mode, w: W, h: H, ...pass });
await page.goto(`http://127.0.0.1:${port}/render/index.html?${q}`);
await page.waitForFunction(() => window.ready === true || window.setupError, null, { timeout: 600000 });
const err = await page.evaluate(() => window.setupError);
if (err) { console.error(err); process.exit(1); }

async function renderOne(f) {
  await page.evaluate((fr) => window.renderFrame(fr), f);
  const status = await page.evaluate((fr) => window.sendFrame(String(fr)), f);
  if (status !== 200) throw new Error('frame send failed ' + status);
}

const t0 = Date.now();
if (args.video) {
  const [a, b] = String(args.range || '0:1').split(':').map(Number);
  const out = path.resolve(ROOT, args.video);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium',
    '-crf', String(args.crf || 12), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  frameSink = (id, buf) => new Promise((resolve, reject) => {
    if (buf.length !== W * H * 4) return reject(new Error('bad frame size ' + buf.length));
    if (ff.stdin.write(buf)) resolve(); else ff.stdin.once('drain', resolve);
  });
  for (let f = a; f < b; f++) {
    await renderOne(f);
    if ((f - a) % 10 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`frame ${f} (${f - a + 1}/${b - a}) ${(el / (f - a + 1)).toFixed(2)} s/frame, elapsed ${el.toFixed(0)} s`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('exit', r));
} else {
  const list = args.stills ? String(args.stills).split(',').map(Number) : [0];
  const outBase = path.resolve(ROOT, args.out || 'stills/still');
  fs.mkdirSync(path.dirname(outBase), { recursive: true });
  frameSink = (id, buf) => new Promise((resolve, reject) => {
    const name = mode === 'lab' && !args.stills ? `${outBase}.png` : `${outBase}_${String(id).padStart(4, '0')}.png`;
    const p = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-',
      '-vf', 'vflip', '-frames:v', '1', name]);
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error('png encode failed'))));
    p.stdin.end(buf);
  });
  for (const f of list) {
    const s = Date.now();
    await renderOne(f);
    console.log(`still ${f} done in ${((Date.now() - s) / 1000).toFixed(1)} s`);
  }
}
console.log(`total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await browser.close();
server.close();
