// Headless renderer: serves the project, drives Chromium (SwiftShader WebGL2)
// and receives raw RGBA frames over HTTP POST.
//
//   node render.mjs stills 0,4.3,12.5 [--spp 8] [--out build/stills]
//   node render.mjs video <startFrame> <endFrame> <out.mp4> [--spp 12]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const ROOT = path.dirname(fileURLToPath(import.meta.url));
let W = 1080, H = 1920;

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
};
const mode = argv[0];
const spp = +opt('spp', mode === 'video' ? 12 : 8);

const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css' };
let onFrame = null;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/frame')) {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const buf = Buffer.concat(chunks);
      if (onFrame) await onFrame(buf);
      res.writeHead(200);
      res.end('ok');
    });
    return;
  }
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? '/src/index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog',
    '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.setDefaultTimeout(0);
let pageErrors = 0;
page.on('console', (m) => {
  if (m.text().includes('GPU stall due to ReadPixels')) return;
  if (m.type() === 'error') pageErrors++;
  if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 2000));
});
page.on('pageerror', (e) => { pageErrors++; console.log('[pageerror]', e.message, '\n', (e.stack || '').split('\n').slice(0, 6).join('\n')); });
await page.goto(`http://127.0.0.1:${port}/src/index.html?scale=${opt('scale', 1)}`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 });
// compile every program up front and refuse to render with a broken shader
await page.evaluate(() => window.renderTime(0, 1));
if (pageErrors) {
  console.log(`aborting: ${pageErrors} error(s) reported by the page`);
  process.exit(1);
}
const fps = await page.evaluate(() => window.META.FPS);
({ W, H } = await page.evaluate(() => window.META));
if (opt('grade', null)) {
  const [exposure, punch, sat] = opt('grade').split(',').map(Number);
  await page.evaluate((g) => window.setGrade(g), { exposure, punch, sat });
}
const frameUrl = `http://127.0.0.1:${port}/frame`;

const writePng = (buf, out) => new Promise((resolve, reject) => {
  const p = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', '-vf', 'vflip', out]);
  p.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg exit ' + c))));
  p.stdin.end(buf);
});

if (mode === 'stills') {
  const times = argv[1].split(',').map(Number);
  const outDir = path.join(ROOT, opt('out', 'build/stills'));
  fs.mkdirSync(outDir, { recursive: true });
  for (const t of times) {
    const out = path.join(outDir, `${opt('prefix', 't')}${t.toFixed(2).padStart(6, '0')}.png`);
    let pending = null;
    onFrame = (buf) => { pending = writePng(buf, out); };
    const t0 = Date.now();
    await page.evaluate(([t, s, u]) => window.sendTime(t, s, u), [t, spp, frameUrl]);
    await pending;
    console.log(`still t=${t} -> ${path.relative(ROOT, out)} (${((Date.now() - t0) / 1000).toFixed(2)}s)`);
  }
} else if (mode === 'video') {
  const f0 = +argv[1], f1 = +argv[2], out = path.join(ROOT, argv[3]);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
    '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '10', '-pix_fmt', 'yuv444p', out]);
  const closed = new Promise((r) => ff.on('close', r));
  onFrame = (buf) => new Promise((r) => (ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r)));
  const tStart = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate(([f, s, u]) => window.sendFrame(f, s, u), [f, spp, frameUrl]);
    if ((f - f0) % 24 === 0 || f === f1 - 1) {
      const el = (Date.now() - tStart) / 1000;
      const per = el / (f - f0 + 1);
      console.log(`frame ${f} (${f - f0 + 1}/${f1 - f0}) ${per.toFixed(2)}s/frame, eta ${((f1 - f - 1) * per / 60).toFixed(1)} min`);
    }
  }
  ff.stdin.end();
  const code = await closed;
  console.log('ffmpeg exit', code, '->', path.relative(ROOT, out));
}
await browser.close();
server.close();
