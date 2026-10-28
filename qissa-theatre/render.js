// Frame-by-frame renderer: serves this folder, drives window.renderFrame(t)
// in headless Chromium and saves each frame as an image.
//
//   node render.js frames --out DIR [--from 0] [--to END] [--workers 4]
//   node render.js stills --out DIR --times 1,2.5,10 | --every 2
//   node render.js cover  --out FILE.png
//   node render.js page   --url dev.html --out FILE.png
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.json': 'application/json', '.css': 'text/css' };

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
}

function serve() {
  const extra = arg('dev-root');
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      let file = path.join(ROOT, u);
      if (extra && u.startsWith('/dev/')) file = path.join(extra, u.slice(5));
      if (!file.startsWith(ROOT) && !(extra && file.startsWith(extra))) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function openPage(browser, base, url) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(base + url);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  return page;
}

async function shoot(page, t, file) {
  await page.evaluate(t => window.renderFrame(t), t);
  const jpg = file.endsWith('.jpg');
  await page.screenshot({ path: file, type: jpg ? 'jpeg' : 'png', quality: jpg ? 94 : undefined });
}

(async () => {
  const mode = process.argv[2];
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  try {
    if (mode === 'page') {
      const page = await openPage(browser, base, arg('url'));
      await page.screenshot({ path: arg('out') });
    } else if (mode === 'stills' || mode === 'cover') {
      const out = arg('out');
      const page = await openPage(browser, base, 'index.html' + (mode === 'cover' ? '?cover=1' : ''));
      if (mode === 'cover') {
        await page.evaluate(() => window.renderCover());
        await page.screenshot({ path: out });
      } else {
        fs.mkdirSync(out, { recursive: true });
        const END = await page.evaluate(() => window.TL.END);
        let times = arg('times') ? arg('times').split(',').map(Number) : [];
        if (arg('every')) for (let t = 0; t <= END; t += +arg('every')) times.push(+t.toFixed(3));
        for (const t of times) await shoot(page, t, path.join(out, `t_${t.toFixed(2).padStart(6, '0')}.jpg`));
      }
    } else if (mode === 'frames') {
      const out = arg('out');
      fs.mkdirSync(out, { recursive: true });
      const probe = await openPage(browser, base, 'index.html');
      const { END, FPS } = await probe.evaluate(() => ({ END: window.TL.END, FPS: window.TL.FPS }));
      await probe.close();
      const total = Math.round(END * FPS);
      const from = Math.round(+arg('from', 0) * FPS), to = Math.min(total, Math.round(+arg('to', END) * FPS));
      const workers = +arg('workers', 4);
      const t0 = Date.now();
      let done = 0;
      await Promise.all(Array.from({ length: workers }, async (_, w) => {
        const page = await openPage(browser, base, 'index.html');
        for (let f = from + w; f < to; f += workers) {
          const file = path.join(out, `f_${String(f).padStart(5, '0')}.jpg`);
          await shoot(page, f / FPS, file);
          if (++done % 150 === 0) {
            const el = (Date.now() - t0) / 1000;
            console.log(`${done}/${to - from} frames, ${(el / done * 1000).toFixed(0)} ms/frame, eta ${(el / done * (to - from - done)).toFixed(0)} s`);
          }
        }
        await page.close();
      }));
      console.log(`rendered ${to - from} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s (total ${total})`);
    }
  } finally {
    await browser.close();
    srv.close();
  }
})();
