#!/usr/bin/env node
// Render the reel frame-by-frame with Playwright and pipe the frames into ffmpeg.
//   node render.js --preview [--out build/video_preview.mp4]
//   node render.js --full    [--out build/video_full.mp4]
//   node render.js --stills 1.2,5,9.5 [--w 540 --h 960]   (debug PNGs -> build/stills)
//   node render.js --shots  [--w 540 --h 960]               (one still per shot -> build/stills)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = __dirname;
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes(k);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function openPage(browser, port, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/scene/index.html?w=${w}&h=${h}`);
  await page.waitForFunction(() => typeof window.setupReel === 'function', null, { timeout: 60000 });
  const info = await page.evaluate(() => window.setupReel());
  return { page, info };
}

async function main() {
  const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'timeline.json')));
  const full = has('--full');
  const W = +arg('--w', full ? 1080 : 540), H = +arg('--h', full ? 1920 : 960);
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  if (has('--stills') || has('--shots')) {
    const { page } = await openPage(browser, port, W, H);
    let times;
    if (has('--shots')) times = await page.evaluate(() => window.__shotTimes());
    else times = arg('--stills').split(',').map(Number);
    const dir = path.join(ROOT, 'build', 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    let i = 0;
    for (const t of times) {
      const name = await page.evaluate((tt) => window.renderAt(tt), t);
      const file = path.join(dir, `${String(i++).padStart(3, '0')}_${t.toFixed(2)}.png`);
      await page.screenshot({ path: file });
      console.log(file, name);
    }
    await browser.close(); srv.close();
    return;
  }

  const out = path.resolve(arg('--out', path.join(ROOT, 'build', full ? 'video_full.mp4' : 'video_preview.mp4')));
  const frames = tl.frames, fps = tl.fps;
  const workers = +arg('--workers', 3);
  const per = Math.ceil(frames / workers);
  const t0 = Date.now();
  const segFiles = [];
  let done = 0;
  await Promise.all(Array.from({ length: workers }, async (_, wi) => {
    const a = wi * per, b = Math.min(frames, a + per);
    if (a >= b) return;
    const seg = path.join(ROOT, 'build', `seg_${full ? 'full' : 'prev'}_${wi}.mp4`);
    segFiles[wi] = seg;
    const enc = full
      ? ['-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-profile:v', 'high']
      : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p'];
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', full ? 'png' : 'mjpeg', '-i', '-', ...enc, '-r', String(fps), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    const { page } = await openPage(browser, port, W, H);
    for (let f = a; f < b; f++) {
      await page.evaluate((tt) => window.renderAt(tt), f / fps);
      const buf = await page.screenshot(full ? { type: 'png' } : { type: 'jpeg', quality: 80 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      done++;
      if (done % 60 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`frames ${done}/${frames}  ${(el / done).toFixed(3)} s/frame  eta ${((frames - done) * el / done / 60).toFixed(1)} min`);
      }
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    await page.close();
  }));
  await browser.close(); srv.close();
  const list = path.join(ROOT, 'build', 'segs.txt');
  fs.writeFileSync(list, segFiles.filter(Boolean).map((f) => `file '${f}'`).join('\n'));
  await new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'inherit' });
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error('concat failed'))));
  });
  console.log(`video -> ${out}  (${frames} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
