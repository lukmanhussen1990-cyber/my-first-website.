// Renders frames of the 3D scene with Chromium and software WebGL, one PNG per frame.
// Fastest on CPU is Mesa llvmpipe through a virtual display:
//   xvfb-run -a -s "-screen 0 1280x2000x24" node tools/render_frames.mjs --out frames
// Without a display it falls back to SwiftShader (about 4x slower).
//   node tools/render_frames.mjs --out frames --from 0 --to 1589 [--workers 3] [--frames 10,200,300] [--w 1080 --h 1920]
// Every frame is computed from its own time value, so frames can render in any order / in parallel.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './server.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => { if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return acc; }, []));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const timeline = JSON.parse(fs.readFileSync(path.join(root, 'timeline.json'), 'utf8'));
const W = +(args.w || 1080), H = +(args.h || 1920);
const out = path.resolve(root, args.out || 'frames');
fs.mkdirSync(out, { recursive: true });
const total = Math.round(timeline.duration * timeline.fps);
let frames;
if (args.frames) frames = String(args.frames).split(',').map((s) => (s.includes('s') ? Math.round(parseFloat(s) * timeline.fps) : +s));
else { const a = +(args.from ?? 0), b = +(args.to ?? total - 1), st = +(args.step || 1); frames = []; for (let f = a; f <= b; f += st) frames.push(f); }
if (!args.force) frames = frames.filter((f) => !fs.existsSync(path.join(out, `f${String(f).padStart(5, '0')}.png`)));
const workers = Math.max(1, +(args.workers || 1));
console.log(`rendering ${frames.length} frames at ${W}x${H} with ${workers} worker(s) -> ${out}`);

const server = await startServer(root, 0);
const port = server.address().port;
const t0 = Date.now();
let done = 0;
async function worker(k) {
  // llvmpipe (Mesa, needs an X display such as xvfb-run) is ~4x faster than SwiftShader on CPU
  const llvm = (args.gl || (process.env.DISPLAY ? 'llvmpipe' : 'swiftshader')) === 'llvmpipe';
  const glArgs = llvm ? ['--use-gl=angle', '--use-angle=gl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const browser = await chromium.launch({ headless: !llvm, args: [...glArgs, '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--js-flags=--max-old-space-size=4096', `--window-size=${W},${H}`] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (m) => { const t = m.text(); if (!t.includes('GPU stall') && !t.includes('GL Driver')) console.log(`[w${k}]`, t); });
  page.on('pageerror', (e) => console.log(`[w${k}] pageerror`, e.message));
  await page.goto(`http://127.0.0.1:${port}/scene/index.html?w=${W}&h=${H}${args.q ? '&' + args.q : ''}`);
  await page.waitForFunction(() => window.reelReady || window.reelError, null, { timeout: 600000 });
  const err = await page.evaluate(() => window.reelError);
  if (err) { console.error(err); process.exit(1); }
  const mine = frames.filter((_, i) => i % workers === k);
  for (const f of mine) {
    const ts = Date.now();
    const n = await page.evaluate((fr) => window.renderFrame(fr), f);
    const file = path.join(out, `${args.prefix || 'f'}${String(f).padStart(5, '0')}.png`);
    await page.screenshot({ path: file + '.tmp.png', type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
    fs.renameSync(file + '.tmp.png', file);
    done++;
    const el = (Date.now() - t0) / 1000;
    if (done % 10 === 0 || frames.length < 20) console.log(`[w${k}] frame ${f} (${n} sub) ${((Date.now() - ts) / 1000).toFixed(1)}s | ${done}/${frames.length} | eta ${((el / done) * (frames.length - done) / 60).toFixed(1)} min`);
  }
  await browser.close();
}
await Promise.all(Array.from({ length: workers }, (_, k) => worker(k)));
server.close();
console.log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
