// Frame renderer: loads the Three.js scene in headless Chromium (software WebGL)
// and renders every frame deterministically.
//   node render.mjs --stills 0,120,300 --out ../build/stills      -> PNG stills
//   node render.mjs --range 0 1500 --workers 3 --out ../build/video_clean.mp4
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const query = args.query || '';
const FPS = 30;
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((q, r) => {
      const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
      if (!p.startsWith(root)) { r.writeHead(403); r.end(); return; }
      fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
    }).listen(0, () => res(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { const t = m.text(); if (!t.includes('GPU stall')) console.log('[page]', t); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/render/index.html?${query}`);
  await page.waitForFunction(() => window.sceneReady || window.sceneError, null, { timeout: 600000 });
  const err = await page.evaluate(() => window.sceneError);
  if (err) throw new Error(err);
  return page;
}

async function frame(page, f) {
  await page.evaluate((f) => window.renderFrame(f), f);
  const url = await page.evaluate(() => window.grabPNG());
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

const launchArgs = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];

async function stills(list, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const srv = await serve(); const browser = await chromium.launch({ args: launchArgs });
  const page = await openPage(browser, srv.address().port);
  for (const f of list) {
    const t0 = Date.now(); const png = await frame(page, f);
    const name = path.join(outDir, `still_${String(f).padStart(4, '0')}.png`); fs.writeFileSync(name, png);
    console.log(`frame ${f} (${(f / FPS).toFixed(2)}s) ${Date.now() - t0}ms -> ${name}`, JSON.stringify(await page.evaluate(() => window.sceneInfo())));
  }
  await browser.close(); srv.close();
}

// Render frames [a, b) into a lossless-ish H.264 segment.
async function segment(page, a, b, file) {
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '10', '-pix_fmt', 'yuv444p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = a; f < b; f++) {
    const png = await frame(page, f);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - a) % 10 === 0) { const el = (Date.now() - t0) / 1000; console.log(`[${path.basename(file)}] frame ${f} ${(el / (f - a + 1)).toFixed(2)}s/frame`); }
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
}

async function video(a, b, workers, out) {
  const segDir = path.join(path.dirname(out), 'segments'); fs.mkdirSync(segDir, { recursive: true });
  const chunk = 30; const jobs = [];
  for (let s = a; s < b; s += chunk) jobs.push([s, Math.min(b, s + chunk)]);
  const srv = await serve(); const port = srv.address().port;
  const todo = jobs.filter(([s, e]) => !fs.existsSync(path.join(segDir, `seg_${String(s).padStart(5, '0')}_${e}.mp4`)));
  console.log(`${jobs.length} segments, ${todo.length} to render with ${workers} workers`);
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const browser = await chromium.launch({ args: launchArgs }); const page = await openPage(browser, port);
    while (todo.length) {
      const [s, e] = todo.shift(); const file = path.join(segDir, `seg_${String(s).padStart(5, '0')}_${e}.mp4`);
      await segment(page, s, e, file + '.tmp.mp4'); fs.renameSync(file + '.tmp.mp4', file);
    }
    await browser.close();
  }));
  srv.close();
  const list = jobs.map(([s, e]) => `file '${path.join(segDir, `seg_${String(s).padStart(5, '0')}_${e}.mp4`)}'`).join('\n');
  fs.writeFileSync(path.join(segDir, 'list.txt'), list);
  await new Promise((r) => spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(segDir, 'list.txt'), '-c', 'copy', out], { stdio: 'inherit' }).on('close', r));
  console.log('wrote', out);
}

if (args.stills) await stills(String(args.stills).split(',').map(Number), path.resolve(args.out || path.join(root, 'build/stills')));
else if (args.range) { const [a, b] = [Number(args.range), Number(process.argv[process.argv.indexOf('--range') + 2])]; await video(a, b, Number(args.workers || 3), path.resolve(args.out || path.join(root, 'build/video_clean.mp4'))); }
else console.log('usage: --stills 0,10,20 | --range 0 1500 [--workers 3]');
