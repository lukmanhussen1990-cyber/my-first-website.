#!/usr/bin/env node
// Render frames of scene/index.html with Playwright (headless Chromium + WebGL/SwiftShader).
//   node tools/render.js --stills 1.0,5.2,12 --out /tmp/stills       # PNG stills at given seconds
//   node tools/render.js --frames 0-1349 --out frames --workers 3     # JPEG frame sequence
//   node tools/render.js --dump scene/shots.json                     # export shot list + events
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));
const FPS = 30;
const scale = parseFloat(args.scale || '1');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function openPage(port) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/scene/index.html?scale=${scale}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 });
  return { browser, page };
}

const writeData = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  const outDir = path.resolve(args.out || path.join(ROOT, 'frames'));
  if (args.stills || args.frames) fs.mkdirSync(outDir, { recursive: true });

  if (args.dump) {
    const { browser, page } = await openPage(port);
    const data = await page.evaluate(() => ({ shots: window.getShots(), events: window.getEvents() }));
    fs.writeFileSync(path.resolve(args.dump), JSON.stringify(data, null, 1));
    console.log(`wrote ${args.dump}: ${data.shots.length} shots`);
    await browser.close();
  }

  if (args.stills) {
    const { browser, page } = await openPage(port);
    for (const s of String(args.stills).split(',')) {
      const f = Math.round(parseFloat(s) * FPS);
      const t0 = Date.now();
      const url = await page.evaluate((f) => window.renderFrame(f, 'png'), f);
      const shot = await page.evaluate(() => window.__lastShot + ' cam=' + JSON.stringify(window.__cam || ''));
      const file = path.join(outDir, `still_${String(f).padStart(5, '0')}.png`);
      writeData(file, url);
      console.log(`t=${(f / FPS).toFixed(2)}s frame ${f} [${shot}] ${Date.now() - t0}ms -> ${file}`);
    }
    await browser.close();
  }

  if (args.frames) {
    const [a, b] = String(args.frames).split('-').map(Number);
    const workers = parseInt(args.workers || '2', 10);
    const all = []; for (let f = a; f <= b; f++) if (!args.resume || !fs.existsSync(path.join(outDir, `f_${String(f).padStart(5, '0')}.jpg`))) all.push(f);
    const chunks = Array.from({ length: workers }, (_, i) => all.filter((_, k) => k % workers === i));
    const t0 = Date.now(); let done = 0;
    await Promise.all(chunks.map(async (list, wi) => {
      if (!list.length) return;
      const { browser, page } = await openPage(port);
      for (const f of list) {
        const url = await page.evaluate((f) => window.renderFrame(f), f);
        writeData(path.join(outDir, `f_${String(f).padStart(5, '0')}.jpg`), url);
        done++;
        if (done % 30 === 0) {
          const el = (Date.now() - t0) / 1000;
          console.log(`${done}/${all.length} frames  ${(el / done).toFixed(2)}s/frame  eta ${((all.length - done) * el / done / 60).toFixed(1)} min`);
        }
      }
      await browser.close();
    }));
    console.log(`rendered ${all.length} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
