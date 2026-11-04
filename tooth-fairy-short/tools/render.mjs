// Headless frame renderer. Serves the project, opens N Chromium workers
// (software WebGL via SwiftShader) and saves frames posted back by the page.
//   node tools/render.mjs --out DIR [--frames 0,10,20 | --range 0:900] [--workers 3] [--scale 1] [--png]
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const flag = (k) => argv.includes('--' + k);
const out = path.resolve(arg('out', path.join(ROOT, 'frames')));
const scale = parseFloat(arg('scale', '1'));
const nWorkers = parseInt(arg('workers', '1'), 10);
const png = flag('png');
let frames;
if (arg('frames')) frames = arg('frames').split(',').map(Number);
else { const [a, b] = arg('range', '0:900').split(':').map(Number); frames = Array.from({ length: b - a }, (_, i) => a + i); }
if (flag('skip-existing')) frames = frames.filter((f) => !fs.existsSync(path.join(out, `f${String(f).padStart(5, '0')}.${png ? 'png' : 'jpg'}`)));
fs.mkdirSync(out, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/save') {
    const f = String(u.searchParams.get('f')).padStart(5, '0');
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => { fs.writeFileSync(path.join(out, `f${f}.${u.searchParams.get('ext')}`), Buffer.concat(chunks)); res.end('ok'); });
    return;
  }
  const file = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const t0 = Date.now();
let done = 0;
async function worker(k) {
  const mine = frames.filter((_, i) => i % nWorkers === k);
  if (!mine.length) return;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  const page = await browser.newPage({ viewport: { width: Math.round(1080 * scale), height: Math.round(1920 * scale) }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`[w${k}] pageerror:`, e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error(`[w${k}] ${m.type()}:`, m.text()); });
  await page.goto(`http://127.0.0.1:${port}/src/index.html?scale=${scale}${flag('nocap') ? '&nocap=1' : ''}${arg('cam') ? '&cam=' + arg('cam') : ''}${arg('qs') ? '&' + arg('qs') : ''}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 });
  for (const f of mine) {
    await page.evaluate(([f, png]) => window.saveFrame(f, png ? 'image/png' : 'image/jpeg', 0.95), [f, png]);
    done++;
    if (done % 25 === 0 || done === frames.length) {
      const el = (Date.now() - t0) / 1000;
      console.log(`${done}/${frames.length} frames  ${el.toFixed(0)}s  (${(el / done).toFixed(2)} s/frame)`);
    }
  }
  await browser.close();
}
await Promise.all(Array.from({ length: nWorkers }, (_, k) => worker(k)));
server.close();
console.log(`done: ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${out}`);
