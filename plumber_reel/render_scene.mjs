// Render the code-made 3D pictures for the plumber reel (scene/ = three.js, headless Chromium + SwiftShader).
//   node render_scene.mjs [ids...]            stills -> images/shot_XX.png (+ clips/shot_XX.mp4 for animated shots)
//   PREVIEW=0.4 node render_scene.mjs 1 2     quick small stills -> build/preview/shot_XX.jpg
//   STILLS_ONLY=1 / CLIPS_ONLY=1              skip the clips / the stills
// Also writes build/anchors/shot_XX.json: screen positions (u, v in 0..1 of the still) of mouths, eyes, doors...
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf' };
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'shots.json'), 'utf8'));
const ids = process.argv.slice(2).map(Number).filter(Boolean);
const todo = (ids.length ? ids : plan.shots.map((s) => s.id)).filter((i) => !plan.shots.find((s) => s.id === i)?.black);   // shot 20 is a black screen
const PREVIEW = Number(process.env.PREVIEW || 0);
const STILL_K = 1.25;                    // stills are rendered 1.25x (1350x2400) so the edit can zoom in sharply

const srv = await new Promise((res) => {
  const s = http.createServer((req, rq) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rq.writeHead(404); rq.end(); return; }
    rq.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(p).pipe(rq);
  });
  s.listen(0, '127.0.0.1', () => res(s));
});
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const save = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
let errors = 0;
for (const d of ['images', 'clips', 'build/anchors', 'build/preview']) fs.mkdirSync(path.join(ROOT, d), { recursive: true });

async function open(id, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('console', (m) => { if (m.type() === 'error') { console.log(`shot ${id} page:`, m.text()); errors++; } });
  page.on('pageerror', (e) => { console.log(`shot ${id} pageerror:`, e.message); errors++; });
  await page.goto(`http://127.0.0.1:${srv.address().port}/scene/index.html?shot=${id}&w=${w}&h=${h}${process.env.CAM ? '&cam=' + encodeURIComponent(process.env.CAM) : ''}`);
  await page.waitForFunction(() => window.APP_READY === true || !!window.APP_ERROR, null, { timeout: 300000 });
  const err = await page.evaluate(() => window.APP_ERROR);
  if (err) throw new Error(`shot ${id}: ${err}`);
  return page;
}

for (const id of todo) { try { await renderOne(id); } catch (e) { console.log(`shot ${id} FAILED: ${e.message.split('\n')[0]}`); errors++; } }
async function renderOne(id) {
  const t0 = Date.now(), nn = String(id).padStart(2, '0');
  if (PREVIEW) {
    const w = Math.round(1080 * PREVIEW / 2) * 2, h = Math.round(1920 * PREVIEW / 2) * 2;
    const page = await open(id, w, h);
    const info = await page.evaluate(() => window.APP.info());
    save(path.join(ROOT, `build/preview/shot_${nn}.jpg`), await page.evaluate((lt) => window.APP.render(lt), info.still * info.dur));
    await page.close();
    console.log(`shot ${nn} preview ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return;
  }
  if (!process.env.CLIPS_ONLY) {
    const page = await open(id, Math.round(1080 * STILL_K), Math.round(1920 * STILL_K));
    const info = await page.evaluate(() => window.APP.info());
    const lt = info.still * info.dur;
    save(path.join(ROOT, `images/shot_${nn}.png`), await page.evaluate((lt) => window.APP.render(lt, 'image/png'), lt));
    fs.writeFileSync(path.join(ROOT, `build/anchors/shot_${nn}.json`), JSON.stringify(await page.evaluate((lt) => window.APP.anchors(lt), lt)));
    await page.close();
    console.log(`shot ${nn} still ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  const page = await open(id, 1080, 1920);
  const info = await page.evaluate(() => window.APP.info());
  if (info.clip && !process.env.STILLS_ONLY) {
    const n = Math.round(info.dur * 30) + 2;
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', path.join(ROOT, `clips/shot_${nn}.mp4`)]);
    for (let f = 0; f < n; f++) {
      const url = await page.evaluate((lt) => window.APP.render(lt, 'image/jpeg', 0.95), f / 30);
      ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'));
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    console.log(`shot ${nn} clip ${n} frames ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  await page.close();
}
await browser.close();
srv.close();
console.log(`done, page errors: ${errors}`);
process.exit(errors ? 2 : 0);
