// Headless frame-by-frame renderer: serves src/, drives Chromium (Playwright), pipes raw frames into ffmpeg.
// usage:
//   node render.mjs --stills 1.0,4.5,9.2        -> out/stills/*.png (quick visual checks)
//   node render.mjs --range 0:600 --out out/seg0.mp4   (frame range, used by render_all.sh)
//   node render.mjs                              -> full video (single worker)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => { if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const W = 1080, H = 1920, FPS = 60;
const SS = parseFloat(args.ss ?? '2');
const scale = parseFloat(args.scale ?? '1');   // preview scale for stills

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.css': 'text/css' };
let sink = null;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/frame') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => { try { await sink(Buffer.concat(chunks), url.searchParams); res.end('ok'); } catch (e) { res.statusCode = 500; res.end(String(e)); } });
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/src/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; res.end('nf'); return; }
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--enable-webgl', '--disable-web-security'],
});
const page = await browser.newPage({ viewport: { width: 600, height: 900 } });
page.on('console', (m) => { const t = m.text(); if (!t.includes('GPU stall') && !t.includes('GL Driver Message')) console.log('[page]', t); });
page.on('pageerror', (e) => { console.error('[pageerror]', e.message, e.stack); });
await page.goto(`http://127.0.0.1:${port}/src/index.html?ss=${SS}&msaa=${args.msaa ?? 0}&scale=${scale}${args.debug ? '&debug=' + args.debug : ''}`);
await page.waitForFunction('window.READY === true || window.FAILED', null, { timeout: 180000 });
if (await page.evaluate('window.FAILED')) { console.error('init failed:', await page.evaluate('window.FAILED')); process.exit(1); }
const total = await page.evaluate('window.TOTAL_FRAMES');
const ow = Math.round(W * scale), oh = Math.round(H * scale);

if (args.scan) { console.log('S1 chest-up violations:', JSON.stringify(await page.evaluate('window.safetyScan()'))); }
else if (args.stills) {
  const dir = path.join(ROOT, 'out', 'stills'); fs.mkdirSync(dir, { recursive: true });
  const times = String(args.stills).split(',').map(Number);
  for (const t of times) {
    const f = Math.round(t * FPS);
    let buf = null;
    sink = async (b) => { buf = b; };
    const t0 = Date.now();
    await page.evaluate((f) => window.renderFrame(f), f); await page.evaluate(() => window.flush());
    const name = path.join(dir, `${(args.prefix || 'f')}_${t.toFixed(2).padStart(6, '0')}.png`);
    await new Promise((res, rej) => {
      const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${ow}x${oh}`, '-i', '-', '-frames:v', '1', name]);
      ff.on('close', (c) => c ? rej(new Error('ffmpeg ' + c)) : res()); ff.stdin.end(buf);
    });
    console.log(name, (Date.now() - t0) + 'ms');
  }
} else {
  let [f0, f1] = args.range ? String(args.range).split(':').map(Number) : [0, total];
  f1 = Math.min(f1, total);
  const out = args.out || path.join(ROOT, 'out', 'video_noaudio.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${ow}x${oh}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-qp', '0', '-pix_fmt', 'yuv444p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const buf = new Map(); let nextF = f0;
  sink = async (b, params) => { buf.set(Number(params.get('f')), b); while (buf.has(nextF)) { const x = buf.get(nextF); buf.delete(nextF); nextF++; if (!ff.stdin.write(x)) await new Promise((r) => ff.stdin.once('drain', r)); } };
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate((f) => window.renderFrame(f), f);
    if ((f - f0) % 20 === 0) {
      const el = (Date.now() - t0) / 1000, done = f - f0 + 1;
      console.log(`frame ${f}/${f1}  ${(el / done).toFixed(2)}s/frame  eta ${((f1 - f0 - done) * el / done / 60).toFixed(1)}min`);
    }
  }
  await page.evaluate(() => window.flush());
  if (nextF !== f1) { console.error('frame order error', nextF, f1); process.exit(2); }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('wrote', out);
}
const viol = await page.evaluate('window.VIOLATIONS'); if (viol && viol.length) console.log('CHEST-UP VIOLATIONS at t=', viol.join(','));
await browser.close();
server.close();
