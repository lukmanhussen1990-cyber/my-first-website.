// Frame renderer for TOKEN HUNGRY.
//
//   node tools/render.mjs --frames build/frames [--fps 30] [--workers 4] [--scale 1]
//   node tools/render.mjs --still 1.5,4.2 --out build/stills
//   node tools/render.mjs --sheet 0 --out build/sheet0.png
//   node tools/render.mjs --events build/events.json
//
// Playwright is resolved through NODE_PATH (e.g. NODE_PATH="$(npm root -g)").
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
  '.wav': 'audio/wav',
  '.png': 'image/png',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, url === '/' ? 'index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function openPage(browser, port, scale) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}]`, m.text());
  });
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  return page;
}

const JPEG = args.includes('--jpeg');
const shot = (page, file) =>
  page.screenshot({
    path: file,
    clip: { x: 0, y: 0, width: 1920, height: 1080 },
    ...(file.endsWith('.jpg') ? { type: 'jpeg', quality: 96 } : {}),
  });

const server = await serve();
const port = server.address().port;
const browser = await chromium.launch({ args: ['--disable-gpu', '--font-render-hinting=none'] });
const scale = parseFloat(opt('scale', '1'));

try {
  if (opt('sheet') != null) {
    const page = await openPage(browser, port, scale);
    await page.evaluate((n) => window.drawSheet(n), parseInt(opt('sheet'), 10));
    const out = opt('out', 'build/sheet.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await shot(page, out);
    console.log('wrote', out);
  } else if (opt('still') != null) {
    const page = await openPage(browser, port, scale);
    const out = opt('out', 'build/stills');
    fs.mkdirSync(out, { recursive: true });
    for (const ts of opt('still').split(',')) {
      const t = parseFloat(ts);
      await page.evaluate((tt) => window.renderFrame(tt), t);
      const file = path.join(out, `t_${t.toFixed(3).padStart(7, '0')}.png`);
      await shot(page, file);
      console.log('wrote', file);
    }
  } else if (opt('events') != null) {
    const page = await openPage(browser, port, scale);
    const ev = await page.evaluate(() => window.getEvents());
    fs.mkdirSync(path.dirname(opt('events')), { recursive: true });
    fs.writeFileSync(opt('events'), JSON.stringify(ev, null, 1));
    console.log('wrote', opt('events'), ev.length, 'events');
  } else if (opt('frames') != null) {
    const out = opt('frames');
    const fps = parseFloat(opt('fps', '30'));
    const workers = parseInt(opt('workers', '4'), 10);
    const from = parseInt(opt('from', '0'), 10);
    const dur = parseFloat(opt('duration', '25'));
    const total = Math.round(dur * fps);
    const to = parseInt(opt('to', String(total)), 10);
    const step = parseInt(opt('step', '1'), 10);
    fs.mkdirSync(out, { recursive: true });
    const t0 = Date.now();
    let done = 0;
    await Promise.all(
      Array.from({ length: workers }, async (_, w) => {
        const page = await openPage(browser, port, scale);
        for (let f = from + w * step; f < to; f += workers * step) {
          await page.evaluate((tt) => window.renderFrame(tt), f / fps);
          await shot(page, path.join(out, `f_${String(f).padStart(5, '0')}.${JPEG ? 'jpg' : 'png'}`));
          done++;
          if (done % 50 === 0) console.log(`${done} frames, ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
        }
      }),
    );
    console.log(`rendered ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
} finally {
  await browser.close();
  server.close();
}
