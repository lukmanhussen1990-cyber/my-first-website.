// Renders frames of the reel with headless Chromium (software GL). Every frame is a pure function of its number.
//   node tools/render.mjs --out stills/v1 --frames 10,60,100 [--scale 0.5] [--jpg]
//   node tools/render.mjs --out frames --range 0-1583 [--step 1] [--skip-existing]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const has = (k) => process.argv.includes('--' + k);
const scale = parseFloat(arg('scale', '1')); const W = Math.round(1080 * scale), H = Math.round(1920 * scale);
const out = path.resolve(ROOT, arg('out', 'stills/tmp')); fs.mkdirSync(out, { recursive: true });
let frames = [];
if (arg('frames')) frames = String(arg('frames')).split(',').map(Number);
if (arg('range')) { const [a, b] = String(arg('range')).split('-').map(Number); const st = parseInt(arg('step', '1')); for (let f = a; f <= b; f += st) frames.push(f); }
const ext = has('jpg') ? 'jpg' : 'png';
const name = (f) => path.join(out, `f_${String(f).padStart(6, '0')}.${ext}`);
if (has('skip-existing')) frames = frames.filter(f => !fs.existsSync(name(f)));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', m => { const t = m.text(); if (!/GPU stall|GL Driver Message/.test(t)) console.log('PAGE', m.type(), t); });
page.on('pageerror', e => console.log('ERR', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')));
const q = arg('q', '');
await page.goto(`http://127.0.0.1:${port}/web/index.html?w=${W}&h=${H}${q ? '&' + q : ''}`);
await page.waitForFunction('window.READY === true', null, { timeout: 180000 });
const t0 = Date.now(); let n = 0;
for (const f of frames) {
  const ta = Date.now();
  await page.evaluate((f) => { window.renderFrame(f); const gl = document.getElementById('gl').getContext('webgl2'); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }, f);
  const tb = Date.now();
  await page.screenshot({ path: name(f), type: ext === 'jpg' ? 'jpeg' : 'png', ...(ext === 'jpg' ? { quality: 95 } : {}) });
  if (has('timing')) console.log(`f${f} render ${tb - ta} ms, shot ${Date.now() - tb} ms`);
  n++;
  if (n % 25 === 0 || n === frames.length) console.log(`rendered ${n}/${frames.length}  (${((Date.now() - t0) / n / 1000).toFixed(2)} s/frame)`);
}
await browser.close(); server.close();
