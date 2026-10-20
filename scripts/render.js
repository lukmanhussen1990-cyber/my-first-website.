// Deterministic renderer: steps window.renderFrame(t) in fixed 1/fps steps in
// headless Chrome and pipes every frame into ffmpeg.
//
//   node scripts/render.js                                  full video -> final/video.mp4
//   node scripts/render.js --scene 5 --seconds 5 --stills 3 --out frames/test_scene5.mp4
//   node scripts/render.js --at 10.5,24.9 --png-dir frames   stills only
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';
import { ROOT, loadTimeline } from './lib.js';

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const SAFE = { top: 300, bottom: 1400, right: 1080 - 160, left: 0 };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png' };
function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (url === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const pw = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  return fs.existsSync(pw) ? pw : undefined; // undefined -> puppeteer's bundled Chrome
}

async function launch(flags) {
  return puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-driver-bug-workarounds', '--window-size=1080,1920', ...flags],
    protocolTimeout: 0,
  });
}

// Try hardware ANGLE first, fall back to SwiftShader (software) if WebGL2 is unavailable.
async function openPage(port) {
  const variants = [
    { name: 'angle', flags: ['--use-gl=angle'] },
    { name: 'swiftshader', flags: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  ];
  for (const v of variants) {
    const browser = await launch(v.flags);
    const page = await browser.newPage();
    const ok = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
    if (!ok) {
      await browser.close();
      console.log(`[gl] ${v.name}: no WebGL2, falling back`);
      continue;
    }
    page.on('console', (m) => {
      if (['error', 'warn'].includes(m.type())) console.log(`[page:${m.type()}] ${m.text()}`);
    });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/src/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.ready !== undefined, { timeout: 60000 }).catch(() => {
      throw new Error('page module failed to load (see [pageerror] above)');
    });
    const info = await page.evaluate(() => window.ready);
    const renderer = await page.evaluate(() => {
      const gl = window.__three.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
    console.log(`[gl] using ${v.name}: ${renderer}`);
    return { browser, page, info };
  }
  throw new Error('No WebGL2 context available in headless Chrome.');
}

async function grab(client) {
  const { data } = await client.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, fromSurface: true, captureBeyondViewport: false });
  return Buffer.from(data, 'base64');
}

function checkSafe(bounds, t, issues) {
  for (const b of bounds) {
    if (b.y0 < SAFE.top - 0.5 || b.y1 > SAFE.bottom + 0.5 || b.x1 > SAFE.right + 0.5 || b.x0 < SAFE.left) {
      issues.push(`${t.toFixed(2)}s ${b.what} [${b.x0.toFixed(0)},${b.y0.toFixed(0)} - ${b.x1.toFixed(0)},${b.y1.toFixed(0)}]`);
    }
  }
}

async function main() {
  const tl = loadTimeline();
  const fps = tl.fps;
  let t0 = 0;
  let t1 = tl.duration;
  const sceneArg = opt('scene');
  if (sceneArg) {
    const sc = tl.scenes[Number(sceneArg) - 1];
    t0 = sc.start;
    t1 = sc.end;
  }
  if (opt('start')) t0 = Number(opt('start'));
  if (opt('seconds')) t1 = Math.min(tl.duration, t0 + Number(opt('seconds')));
  if (opt('end')) t1 = Number(opt('end'));
  const f0 = opt('from') ? Number(opt('from')) : Math.round(t0 * fps);
  const f1 = opt('to') ? Math.min(Number(opt('to')), tl.frames) : Math.round(t1 * fps);
  const stills = Number(opt('stills', 0));
  const at = opt('at') ? opt('at').split(',').map(Number) : null;
  const pngDir = path.resolve(ROOT, opt('png-dir', 'frames'));
  fs.mkdirSync(pngDir, { recursive: true });

  const server = await serve();
  const { browser, page } = await openPage(server.address().port);
  const client = await page.createCDPSession();
  if (argv.includes('--nolids')) await page.evaluate(() => (window.__debug = { noLids: true }));
  const issues = [];

  if (at) {
    for (const t of at) {
      const fr = Math.round(t * fps);
      const res = await page.evaluate((x) => window.renderFrame(x), fr / fps);
      checkSafe(res.bounds, fr / fps, issues);
      const file = path.join(pngDir, `still_${String(fr).padStart(5, '0')}_${res.scene}.png`);
      fs.writeFileSync(file, await grab(client));
      console.log(`[still] ${(fr / fps).toFixed(2)}s -> ${path.relative(ROOT, file)}`);
    }
  } else {
    const out = path.resolve(ROOT, opt('out', 'final/video.mp4'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const stillFrames = new Set();
    for (let k = 0; k < stills; k++) stillFrames.add(Math.round(f0 + ((k + 0.5) / stills) * (f1 - f0)));
    const started = Date.now();
    for (let f = f0; f < f1; f++) {
      const t = f / fps;
      const res = await page.evaluate((x) => window.renderFrame(x), t);
      checkSafe(res.bounds, t, issues);
      const png = await grab(client);
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if (stillFrames.has(f)) {
        const file = path.join(pngDir, `still_${String(f).padStart(5, '0')}_${res.scene}.png`);
        fs.writeFileSync(file, png);
      }
      const done = f - f0 + 1;
      if (done % 30 === 0 || f === f1 - 1) {
        const el = (Date.now() - started) / 1000;
        const eta = (el / done) * (f1 - f0 - done);
        console.log(`[render] ${done}/${f1 - f0} frames  ${(el / done).toFixed(2)}s/frame  eta ${(eta / 60).toFixed(1)} min`);
      }
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    console.log(`[render] wrote ${path.relative(ROOT, out)}`);
  }
  await browser.close();
  server.close();
  if (issues.length) {
    console.warn(`[safe-zone] ${issues.length} text boxes outside the safe zone, e.g.:\n  ${[...new Set(issues)].slice(0, 8).join('\n  ')}`);
    process.exitCode = 2;
  } else console.log('[safe-zone] all text inside y 300-1400 and >= 160px from the right edge');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
