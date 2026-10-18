// Deterministic frame renderer: drives the Three.js page in headless Chromium and streams
// raw RGBA frames into ffmpeg.
//
//   node render.mjs --from 0 --to 4 --out out/seg_hook.mkv          # video segment
//   node render.mjs --stills 0.5,3.3,6 --scale 0.5                    # PNG stills in out/stills
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
    return acc;
  }, []),
);
const scale = parseFloat(args.scale || '1');
const W = Math.round(1080 * scale);
const H = Math.round(1920 * scale);
const timing = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/events.json'), 'utf8'));
const FPS = timing.fps;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

let sink = null; // function(buffer) -> Promise

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/frame') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const buf = Buffer.concat(chunks);
      if (buf.length !== W * H * 4) {
        res.writeHead(400);
        res.end('bad size');
        return;
      }
      await sink(buf, Number(url.searchParams.get('i')));
      res.writeHead(200);
      res.end('ok');
    });
    return;
  }
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'],
});
const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text());
});
page.on('pageerror', (e) => console.log('[page error]', e.message));
await page.goto(`http://127.0.0.1:${port}/public/index.html?scale=${scale}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });

function ffmpegToFile(out, extra) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', String(FPS), '-i', 'pipe:0', '-vf', 'vflip', ...extra, out], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  const done = new Promise((r) => ff.on('close', r));
  return {
    write: (buf) => new Promise((r) => (ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r))),
    close: async () => {
      ff.stdin.end();
      await done;
    },
  };
}

const t0 = Date.now();
if (args.stills) {
  const dir = path.join(ROOT, args.dir || 'out/stills');
  fs.mkdirSync(dir, { recursive: true });
  const times = args.stills.split(',').map(Number);
  for (const t of times) {
    const name = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`);
    const enc = ffmpegToFile(name, ['-frames:v', '1']);
    sink = (buf) => enc.write(buf);
    const s = Date.now();
    await page.evaluate(async ([tt]) => window.renderAndSend(tt, 0), [t]);
    await enc.close();
    console.log(`still t=${t} -> ${path.relative(ROOT, name)} (${Date.now() - s} ms)`);
  }
} else {
  const from = parseFloat(args.from || '0');
  const to = parseFloat(args.to || String(timing.duration));
  const f0 = Math.round(from * FPS);
  const f1 = Math.round(to * FPS);
  const out = path.join(ROOT, args.out || 'out/render.mkv');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const enc = ffmpegToFile(out, ['-c:v', 'libx264', '-preset', 'medium', '-crf', args.crf || '12', '-pix_fmt', 'yuv444p']);
  sink = (buf) => enc.write(buf);
  for (let f = f0; f < f1; f++) {
    const s = Date.now();
    await page.evaluate(async ([tt, i]) => window.renderAndSend(tt, i), [f / FPS, f]);
    if ((f - f0) % 15 === 0 || f === f1 - 1) {
      const el = (Date.now() - t0) / 1000;
      const done = f - f0 + 1;
      console.log(`frame ${f} (${(f / FPS).toFixed(2)}s) ${Date.now() - s} ms | ${done}/${f1 - f0} | eta ${(((f1 - f0 - done) * el) / done).toFixed(0)}s`);
    }
  }
  await enc.close();
  console.log(`wrote ${path.relative(ROOT, out)} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await browser.close();
server.close();
