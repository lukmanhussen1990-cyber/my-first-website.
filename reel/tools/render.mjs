// Frame-by-frame renderer: drives headless Chromium (Three.js + SwiftShader WebGL) and writes
// either PNG stills or a lossless video segment. Every frame is rendered from its exact time -> perfectly smooth motion.
//
//   node tools/render.mjs --stills 3.5,10,20         -> build/stills/t_3.50.png ...
//   node tools/render.mjs --frames 0:1980 --out build/seg/a.mkv
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => { if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const W = 1080, H = 1920;

const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/src/index.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-watchdog', '--js-flags=--max-old-space-size=6144'] });
const SC = args.scale ? parseFloat(args.scale) : 1;
const page = await browser.newPage({ viewport: { width: Math.round(W * SC), height: Math.round(H * SC) } });
page.on('console', (m) => { const t = m.text(); if (!t.includes('GPU stall') && !t.includes('GL Driver')) console.log('[page]', t); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const qp = new URLSearchParams(); if (args.ao === '0') qp.set('ao', '0'); if (args.scale) qp.set('scale', String(args.scale));
const q = qp.toString() ? '?' + qp.toString() : '';
const t0 = Date.now();
await page.goto(`http://localhost:${port}/src/index.html${q}`);
await page.waitForFunction(() => window.__inited || window.__error, null, { timeout: 0, polling: 200 });
const err = await page.evaluate(() => window.__error);
if (err) { console.error('INIT ERROR', err); process.exit(1); }
console.log(`init ${(Date.now() - t0) / 1000}s`);

if (args.stills) {
  const dir = path.join(ROOT, args.dir || 'build/stills');
  fs.mkdirSync(dir, { recursive: true });
  for (const ts of String(args.stills).split(',')) {
    const t = parseFloat(ts);
    const s = Date.now();
    await page.evaluate((t) => window.APP.renderTime(t), t);
    const b64 = await page.evaluate(() => window.APP.png());
    const f = path.join(dir, `t_${t.toFixed(2).padStart(5, '0')}.png`);
    fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    console.log(`still t=${t} -> ${path.relative(ROOT, f)} (${Date.now() - s} ms)`);
  }
} else if (args.frames) {
  const [a, b] = String(args.frames).split(':').map(Number);
  const out = path.join(ROOT, args.out || `build/seg/seg_${String(a).padStart(4, '0')}.mkv`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', '30', '-i', '-', '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'veryfast', '-qp', '0', '-pix_fmt', 'yuv444p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const start = Date.now();
  for (let f = a; f < b; f++) {
    await page.evaluate((f) => window.APP.render(f), f);
    const b64 = await page.evaluate(() => window.APP.pixels());
    const buf = Buffer.from(b64, 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    const done = f - a + 1;
    if (done % 10 === 0 || f === b - 1) {
      const el = (Date.now() - start) / 1000;
      console.log(`frame ${f} (${done}/${b - a}) ${(el / done).toFixed(2)} s/frame, eta ${((b - a - done) * el / done / 60).toFixed(1)} min`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('wrote', out);
}
await browser.close();
server.close();
