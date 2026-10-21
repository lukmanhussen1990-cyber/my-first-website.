#!/usr/bin/env node
// Frame-by-frame renderer: drives the Three.js scene in headless Chromium and saves PNG frames.
//   node tools/render.mjs stills  --times 3,10,18 [--scale 0.5] [--samples 2] [--out dir]
//   node tools/render.mjs frames  --from 0 --to 1680 [--out render/frames]   (resumable)
//   node tools/render.mjs events  (writes audio/events.json)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }

const args = process.argv.slice(2);
const mode = args[0] || 'stills';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const scale = parseFloat(opt('scale', '1'));

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((q, s) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { s.writeHead(403); s.end(); return; }
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'Content-Type': mime[path.extname(p)] || 'application/octet-stream' }); s.end(d); });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--js-flags=--max-old-space-size=8192'] });
const page = await browser.newPage({ viewport: { width: Math.round(1080 * scale), height: Math.round(1920 * scale) } });
page.on('console', (m) => { const t = m.text(); if (!t.includes('GPU stall') && !t.includes('GL Driver')) console.log('[page]', t); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const t0 = Date.now();
await page.goto(`http://localhost:${port}/scene/index.html?scale=${scale}`);
await page.waitForFunction(() => window.ready || window.__err, null, { timeout: 600000 });
const err = await page.evaluate(() => window.__err);
if (err) { console.error(err); process.exit(1); }
console.log(`scene ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

async function saveFrame(file) {
  const data = await page.evaluate(() => window.grab());
  fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
}

if (mode === 'events') {
  const ev = await page.evaluate(() => window.getEvents());
  fs.mkdirSync(path.join(ROOT, 'audio'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'audio/events.json'), JSON.stringify(ev, null, 1));
  const tr = await page.evaluate(() => window.getTracks());
  fs.writeFileSync(path.join(ROOT, 'audio/tracks.json'), JSON.stringify(tr));
  console.log(`wrote ${ev.length} events`);
} else if (mode === 'stills') {
  const out = opt('out', path.join(ROOT, 'render/stills'));
  fs.mkdirSync(out, { recursive: true });
  const samples = opt('samples') ? parseInt(opt('samples')) : undefined;
  const ao = opt('ao', '1') !== '0';
  for (const ts of opt('times', '3').split(',')) {
    const t = parseFloat(ts); const f = Math.round(t * 30);
    const s = Date.now();
    const info = await page.evaluate(([f, samples, ao]) => window.renderFrame(f, { samples, ao }), [f, samples, ao]);
    const file = path.join(out, `still_${t.toFixed(2)}.png`);
    await saveFrame(file);
    console.log(`t=${t} frame ${f} tau=${info.tau.toFixed(2)} N=${info.N} ${(Date.now() - s)}ms -> ${file}`);
  }
} else if (mode === 'custom') {
  // --views '[{"name":"top","tau":3,"pos":[0,80,-10],"target":[0,0,-12],"fov":40}]'
  const out = opt('out', path.join(ROOT, 'render/stills'));
  fs.mkdirSync(out, { recursive: true });
  for (const v of JSON.parse(opt('views'))) {
    await page.evaluate((v) => window.renderCustom(v), v);
    await saveFrame(path.join(out, `custom_${v.name}.png`));
    console.log('custom', v.name);
  }
} else if (mode === 'frames') {
  const out = opt('out', path.join(ROOT, 'render/frames'));
  fs.mkdirSync(out, { recursive: true });
  const from = parseInt(opt('from', '0')), to = parseInt(opt('to', '1680')), step = parseInt(opt('step', '1'));
  const maxS = parseInt(opt('maxSamples', '1')), minS = parseInt(opt('minSamples', '1'));
  const fixed = opt('samples') ? parseInt(opt('samples')) : undefined;
  let done = 0; const start = Date.now();
  for (let f = from; f < to; f += step) {
    const file = path.join(out, `f_${String(f).padStart(5, '0')}.png`);
    if (fs.existsSync(file) && fs.statSync(file).size > 1000) continue;
    const s = Date.now();
    const info = await page.evaluate(([f, a, b, n]) => window.renderFrame(f, { maxSamples: a, minSamples: b, samples: n }), [f, maxS, minS, fixed]);
    await saveFrame(file + '.tmp');
    fs.renameSync(file + '.tmp', file);
    done++;
    const el = (Date.now() - start) / 1000;
    if (done % 10 === 0 || f === from) console.log(`frame ${f} N=${info.N} ${(Date.now() - s)}ms  avg ${(el / done).toFixed(2)}s/f`);
  }
}
await browser.close();
server.close();
