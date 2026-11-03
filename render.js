#!/usr/bin/env node
/**
 * render.js — turns index.html into output.mp4 (1080x1920, 30 fps, H.264 + AAC)
 *
 *   node render.js                     full render: frames/ → audio.wav → output.mp4
 *   node render.js --check 2,16,27,35  render single stills (in seconds) into checks/
 *   node render.js --serve             serve this folder; open the printed ?preview URL
 *
 * Options
 *   --workers N     parallel headless browsers (default: 2)
 *   --from F --to F render only frames F..F (inclusive) — handy for re-rendering a section
 *   --no-encode     stop after writing frames + audio
 *
 * Needs Node 18+, Playwright (`npm install`, then `npx playwright install chromium`) and ffmpeg on PATH.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const W = 1080, H = 1920;
const FRAMES_DIR = path.join(ROOT, 'frames');
const CHECK_DIR = path.join(ROOT, 'checks');
const AUDIO = path.join(ROOT, 'audio.wav');
const OUT = path.join(ROOT, 'output.mp4');

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : def; };

// ---------------------------------------------------------------- static server
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.json': 'application/json', '.png': 'image/png' };
function serve(port = 0) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// ---------------------------------------------------------------- browser
async function launch() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  return chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
    ...(proxy ? { proxy: { server: proxy, bypass: '127.0.0.1,localhost' } } : {}),
  });
}
async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html?render`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  return page;
}
const pad = (n) => String(n).padStart(5, '0');

// ---------------------------------------------------------------- modes
async function checkStills(port, secondsList) {
  fs.mkdirSync(CHECK_DIR, { recursive: true });
  const browser = await launch();
  const page = await openPage(browser, port);
  for (const s of secondsList) {
    const fps = await page.evaluate(() => window.TIMELINE.fps);
    const n = Math.round(s * fps);
    await page.evaluate((f) => window.renderFrame(f), n);
    const file = path.join(CHECK_DIR, `check_${String(s).replace('.', '_')}s.png`);
    await page.screenshot({ path: file, type: 'png' });
    console.log('wrote', path.relative(ROOT, file));
  }
  await browser.close();
}

async function renderFrames(port, from, to, workers) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  const queue = []; for (let f = from; f <= to; f++) queue.push(f);
  const total = queue.length; let done = 0; const t0 = Date.now();
  const worker = async (id) => {
    const browser = await launch();
    const page = await openPage(browser, port);
    while (queue.length) {
      const f = queue.shift();
      await page.evaluate((n) => window.renderFrame(n), f);
      await page.screenshot({ path: path.join(FRAMES_DIR, `frame_${pad(f)}.png`), type: 'png' });
      done++;
      if (done % 30 === 0 || done === total) {
        const el = (Date.now() - t0) / 1000, eta = (el / done) * (total - done);
        console.log(`frames ${done}/${total}  (${(done / el).toFixed(2)} fps, eta ${Math.round(eta)}s)`);
      }
    }
    await browser.close();
  };
  await Promise.all(Array.from({ length: workers }, (_, i) => worker(i)));
}

async function renderAudio(port) {
  const browser = await launch();
  const page = await openPage(browser, port);
  const b64 = await page.evaluate(() => window.renderAudioWav());
  fs.writeFileSync(AUDIO, Buffer.from(b64, 'base64'));
  console.log('wrote audio.wav', (fs.statSync(AUDIO).size / 1e6).toFixed(1), 'MB');
  await browser.close();
}

function encode(fps) {
  const ff = [
    '-y', '-framerate', String(fps), '-i', path.join(FRAMES_DIR, 'frame_%05d.png'), '-i', AUDIO,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', OUT,
  ];
  console.log('ffmpeg', ff.join(' '));
  const r = spawnSync('ffmpeg', ff, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed');
  console.log('wrote', path.relative(ROOT, OUT));
}

(async () => {
  if (opt('serve')) {
    const { port } = await serve(Number(opt('port', 8080)));
    console.log(`Preview: http://127.0.0.1:${port}/index.html?preview   (add &t=24 to start at 24s)`);
    return; // keep serving
  }
  const { server, port } = await serve();
  try {
    if (opt('check')) {
      await checkStills(port, String(opt('check')).split(',').map(Number));
      return;
    }
    const probe = await launch(); const p = await openPage(probe, port);
    const { fps, duration } = await p.evaluate(() => ({ fps: window.TIMELINE.fps, duration: window.TIMELINE.duration }));
    await probe.close();
    const last = Math.round(fps * duration) - 1;
    const from = Number(opt('from', 0)), to = Math.min(last, Number(opt('to', last)));
    const workers = Math.max(1, Number(opt('workers', 2)));
    console.log(`rendering frames ${from}..${to} with ${workers} worker(s)`);
    await renderFrames(port, from, to, workers);
    await renderAudio(port);
    if (!opt('no-encode')) encode(fps);
  } finally {
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
