#!/usr/bin/env node
/*
  Render the meme frame-by-frame with Playwright (headless Chromium) and
  encode with ffmpeg (H.264, yuv420p, 1080x1920, 30 fps, no audio).

  Usage
    node render.js                       → gpt_what_about_me.mp4
    node render.js --out my.mp4 --crf 18
    node render.js --sheet               → contact_sheet.png (1 frame per second)
    node render.js --sheet --times 5.6,6.0,6.6   (custom moments)
    node render.js --frames ./frames     → also save every frame as PNG
    node render.js --serve [--port 8123] → live preview at http://localhost:8123

  Requires: Node 18+, `npm install` (playwright), `npx playwright install chromium`, ffmpeg on PATH.
*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i < 0 ? def : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff': 'font/woff', '.png': 'image/png', '.txt': 'text/plain' };
function serve(port) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, url === '/' ? 'index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

async function openPage(port) {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { console.error('Playwright not found. Run: npm install && npx playwright install chromium'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page error]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1`);
  await page.evaluate(() => window.MEME_READY);
  return { browser, page };
}

(async () => {
  const port = +opt('port', 8123);
  if (opt('serve', false)) {
    await serve(port);
    console.log(`Preview: http://localhost:${port}   (Ctrl+C to stop)`);
    return;
  }
  const srv = await serve(port);
  const { browser, page } = await openPage(port);
  const meta = await page.evaluate(() => ({ D: MEME.TIMING.DURATION, FPS: MEME.TIMING.FPS }));

  if (opt('sheet', false)) {
    const custom = opt('times', null);
    const times = custom ? String(custom).split(',').map(Number)
      : [...Array(Math.floor(meta.D)).keys(), meta.D - 1 / meta.FPS];
    const out = opt('out', path.join(ROOT, 'contact_sheet.png'));
    const cols = +opt('cols', 4);
    const scale = +opt('scale', 0.25);
    const url = await page.evaluate(([ts, c, s]) => window.contactSheet(ts, c, s), [times, cols, scale]);
    fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
    console.log(`Contact sheet → ${out}`);
    await browser.close(); srv.close(); return;
  }

  const out = path.resolve(opt('out', path.join(ROOT, 'gpt_what_about_me.mp4')));
  const crf = String(opt('crf', 18));
  const framesDir = opt('frames', null);
  if (framesDir) fs.mkdirSync(framesDir, { recursive: true });
  const total = Math.round(meta.D * meta.FPS);

  const ff = spawn('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(meta.FPS), '-c:v', 'png', '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', crf,
    '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-r', String(meta.FPS), '-an', '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));

  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const url = await page.evaluate(t => window.renderFrame(t), i / meta.FPS);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (framesDir) fs.writeFileSync(path.join(framesDir, `f${String(i).padStart(4, '0')}.png`), buf);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 30 === 29 || i === total - 1) {
      const el = (Date.now() - t0) / 1000;
      process.stdout.write(`\rframe ${i + 1}/${total}  ${(el / (i + 1) * 1000).toFixed(0)} ms/frame  `);
    }
  }
  ff.stdin.end();
  await ffDone;
  console.log(`\nEncoded → ${out}`);
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
