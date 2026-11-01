// Headless renderer: serves this folder, drives web/index.html frame by frame, writes JPEG frames.
// Usage:
//   node render.mjs frames <outDir> [from] [to]          render video frames (inclusive range)
//   node render.mjs times  <outDir> t1 t2 ...             render single timestamps (seconds)
//   node render.mjs shots  <outDir> [frac]                one frame per shot (at frac of the shot, default 0.5)
//   node render.mjs view   <outDir> <t> '<camJSON>' [name] render time t with a camera override {pos,target,fov}
//   node render.mjs audit  <outFile> [step]               glitch audit every `step` seconds (default 0.1) -> JSON
//   options: SCALE=0.5 env renders at half size (fast previews)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const [mode = 'shots', out = 'out', ...rest] = process.argv.slice(2);
const scale = Number(process.env.SCALE || 1);
if (mode !== 'audit') fs.mkdirSync(out, { recursive: true });
const srv = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Math.round(1080 * scale), height: Math.round(1920 * scale) } });
let errors = 0;
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('[log]')) { console.log('page:', m.type(), m.text()); if (m.type() === 'error') errors++; } });
page.on('pageerror', (e) => { console.log('pageerror:', e.message); errors++; });
await page.goto(`http://127.0.0.1:${srv.address().port}/web/index.html?scale=${scale}${process.env.USE ? '&use=' + process.env.USE : ''}`);
await page.waitForFunction(() => window.APP_READY === true, null, { timeout: 300000 });

const save = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
const t0 = Date.now();
if (mode === 'times') {
  for (const t of rest.map(Number)) {
    save(path.join(out, `t_${t.toFixed(2).padStart(6, '0')}.jpg`), await page.evaluate((t) => window.APP.renderTime(t), t));
  }
} else if (mode === 'shots') {
  const frac = Number(rest[0] ?? 0.5);
  const plan = await page.evaluate(() => window.APP.plan());
  for (const s of plan) {
    const t = Math.round((s.t0 + (s.t1 - s.t0) * frac) * 30) / 30;
    save(path.join(out, `${s.id}_${t.toFixed(2)}.jpg`), await page.evaluate((t) => window.APP.renderTime(t), t));
  }
} else if (mode === 'view') {
  const t = Number(rest[0]), cam = JSON.parse(rest[1]), name = rest[2] || `view_${t.toFixed(2)}`;
  save(path.join(out, `${name}.jpg`), await page.evaluate(([t, cam]) => window.APP.renderView(t, cam), [t, cam]));
} else if (mode === 'audit') {
  const step = Number(rest[0] ?? 0.1);
  const total = await page.evaluate(() => window.APP.frameCount() / 30);
  const res = [];
  for (let t = 0; t < total; t += step) {
    const r = await page.evaluate((t) => window.APP.audit(t), Math.round(t * 30) / 30);
    if (r.issues.length) res.push(r);
  }
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(`audit: ${res.length} times with issues -> ${out}`);
} else {
  const total = await page.evaluate(() => window.APP.frameCount());
  const from = Number(rest[0] ?? 0), to = Math.min(Number(rest[1] ?? total - 1), total - 1);
  for (let f = from; f <= to; f++) {
    const file = path.join(out, `f_${String(f).padStart(5, '0')}.jpg`);
    if (process.env.SKIP_EXISTING && fs.existsSync(file) && fs.statSync(file).size > 1000) continue;
    save(file, await page.evaluate((f) => window.APP.renderFrame(f), f));
    if (f % 30 === 0) console.log(`frame ${f}/${to} ${((Date.now() - t0) / (f - from + 1)).toFixed(0)}ms/f`);
  }
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s, page errors: ${errors}`);
await browser.close();
srv.close();
process.exit(errors ? 2 : 0);
