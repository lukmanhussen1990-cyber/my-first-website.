#!/usr/bin/env node
// Frame renderer: drives index.html in headless Chromium and captures the canvas.
//
//   node render.cjs --times 1.5,3,4.25 --out previews/       # stills (PNG) named t_1.500.png
//   node render.cjs --start 0 --end 15 --fps 30 --out frames/  # numbered frames
//   node render.cjs --start 0 --end 15 --fps 30 --video out.mp4 # straight to H.264
//   options: --workers 3  --format png|jpg  --solo <id,id>  --extra <file.js>  --crf 14
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');

let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2), v = process.argv[i + 1];
    if (v === undefined || v.startsWith('--')) args[k] = true; else { args[k] = v; i++; }
  }
}
const ROOT = __dirname;
const fps = parseFloat(args.fps || 30);
const workers = parseInt(args.workers || 3, 10);
const format = args.format || 'png';

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(ROOT, u === '/' ? 'index.html' : u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

(async () => {
  let times;
  if (args.times) times = String(args.times).split(',').map(Number);
  else {
    const start = parseFloat(args.start || 0), end = parseFloat(args.end);
    if (isNaN(end)) { console.error('need --end or --times'); process.exit(2); }
    const n = Math.round((end - start) * fps);
    times = Array.from({ length: n }, (_, i) => start + i / fps);
  }
  const server = await serve();
  const port = server.address().port;
  const q = new URLSearchParams();
  if (args.solo) q.set('solo', args.solo);
  if (args.extra) q.set('extra', args.extra); // extra script(s) relative to project root, e.g. scratch/test.js
  const url = `http://127.0.0.1:${port}/index.html${q.toString() ? '?' + q : ''}`;

  const browser = await playwright.chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
  const pages = [];
  for (let w = 0; w < Math.min(workers, times.length); w++) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
    page.on('pageerror', (e) => console.error('[pageerror]', e.message));
    await page.goto(url);
    await page.evaluate(() => window.READY);
    const errs = await page.evaluate(() => window.__errors || []);
    if (w === 0 && errs.length) console.error('[load errors]\n' + errs.join('\n'));
    pages.push(page);
  }

  let ff = null;
  const outDir = args.out ? path.resolve(args.out) : null;
  if (outDir) fs.mkdirSync(outDir, { recursive: true });
  if (args.video) {
    const crf = args.crf || '14';
    ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.resolve(args.video)],
      { stdio: ['pipe', 'inherit', 'inherit'] });
  }

  const pending = new Map(); let nextWrite = 0, nextIdx = 0, done = 0, errCount = 0;
  const t0 = Date.now();
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  async function flush() {
    while (pending.has(nextWrite)) {
      const buf = pending.get(nextWrite); pending.delete(nextWrite);
      if (ff) { if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)); }
      nextWrite++;
    }
  }
  await Promise.all(pages.map(async (page) => {
    while (nextIdx < times.length) {
      const i = nextIdx++; const t = times[i];
      const { data, errs } = await page.evaluate(([t, mime]) => {
        const before = window.__errors.length;
        renderFrame(t);
        return { data: document.getElementById('c').toDataURL(mime, 0.93), errs: window.__errors.slice(before) };
      }, [t, mime]);
      if (errs.length) { errCount += errs.length; if (errCount < 20) console.error(errs.join('\n')); }
      const buf = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
      if (outDir) {
        const name = args.times ? `t_${t.toFixed(3)}.${format}` : `f_${String(i + 1).padStart(5, '0')}.${format}`;
        fs.writeFileSync(path.join(outDir, name), buf);
      }
      if (ff) { pending.set(i, buf); await flush(); }
      done++;
      if (times.length > 20 && done % 60 === 0) process.stderr.write(`  ${done}/${times.length} frames (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
    }
  }));
  if (ff) { await flush(); ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
  await browser.close(); server.close();
  console.log(`rendered ${times.length} frame(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s${errCount ? `, ${errCount} scene errors` : ''}`);
  if (errCount) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
