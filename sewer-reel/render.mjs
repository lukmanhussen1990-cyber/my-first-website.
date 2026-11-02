// Frame-by-frame renderer: drives the Three.js page in headless Chromium and
// pipes each frame into ffmpeg (or saves stills).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true];
}));
const FPS = 30;
const start = +(args.start ?? 0), end = +(args.end ?? 1800); // [start, end)
const stills = args.stills ? String(args.stills).split(',').map(Number) : null;
const out = args.out ?? 'out/video.mp4';
const scale = +(args.scale ?? 1);
const step = +(args.step ?? 1);
const extra = args.q ? '&' + args.q : '';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning' || args.verbose) console.log('[page]', m.type(), m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/${args.page ?? "index.html"}?scale=${scale}${extra}`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 });

fs.mkdirSync(path.dirname(path.resolve(ROOT, out)), { recursive: true });
const t0 = Date.now();
if (stills) {
  for (const f of stills) {
    const url = await page.evaluate(f => window.renderFrame(f, 'image/png'), f);
    const file = path.resolve(ROOT, out.replace(/\.(mp4|png)$/, '') + `_${String(f).padStart(4, '0')}.png`);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log('still', f, file);
  }
} else {
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS / step), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS / step), path.resolve(ROOT, out)],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = start; f < end; f += step) {
    const url = await page.evaluate(f => window.renderFrame(f, 'image/jpeg'), f);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - start) % (30 * step) === 0) {
      const el = (Date.now() - t0) / 1000, done = (f - start) / step + 1;
      console.log(`frame ${f} (${done}/${end - start}) ${(el / done).toFixed(2)}s/frame`);
    }
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
console.log('done in', ((Date.now() - t0) / 1000).toFixed(1), 's');
await browser.close();
server.close();
