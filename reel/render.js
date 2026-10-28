// Frame renderer: serves this folder over HTTP, opens index.html in headless
// Chromium (Playwright) and captures frames from the canvas timeline.
//
//   node render.js all [workers]          -> frames/f_00000.jpg ...
//   node render.js times 0,2,4 [outdir]   -> outdir/t_000.00.png (preview stills)
//   node render.js cover                  -> out/cover.png
//   node render.js page test.html out.png -> screenshot of any page in this folder
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.json': 'application/json' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function openPage(browser, port, file = 'index.html') {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/${file}`);
  if (file === 'index.html') await page.evaluate(() => window.READY);
  return page;
}

async function grab(page, t, opts = {}, type = 'jpeg') {
  const url = await page.evaluate(([t, o, ty]) => {
    window.renderFrame(t, o);
    return document.getElementById('c').toDataURL(ty === 'png' ? 'image/png' : 'image/jpeg', 0.97);
  }, [t, opts, type]);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

(async () => {
  const [mode, a1, a2] = process.argv.slice(2);
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch();
  try {
    if (mode === 'times') {
      const out = a2 || 'preview';
      fs.mkdirSync(out, { recursive: true });
      const page = await openPage(browser, port);
      for (const s of a1.split(',')) {
        const t = parseFloat(s);
        const t0 = Date.now();
        fs.writeFileSync(path.join(out, `t_${t.toFixed(2).padStart(6, '0')}.png`), await grab(page, t, {}, 'png'));
        console.log('t', t, Date.now() - t0, 'ms');
      }
    } else if (mode === 'cover') {
      fs.mkdirSync('out', { recursive: true });
      const page = await openPage(browser, port);
      fs.writeFileSync('out/cover.png', await grab(page, parseFloat(a1 || '8.6'), { cover: true }, 'png'));
    } else if (mode === 'page') {
      const page = await openPage(browser, port, a1);
      await page.waitForTimeout(300);
      await page.screenshot({ path: a2 });
    } else if (mode === 'all') {
      const workers = parseInt(a1 || '4', 10);
      const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json')));
      const total = Math.round(TL.duration * TL.fps);
      fs.mkdirSync('frames', { recursive: true });
      const per = Math.ceil(total / workers);
      let done = 0;
      const t0 = Date.now();
      await Promise.all(Array.from({ length: workers }, async (_, w) => {
        const page = await openPage(browser, port);
        for (let f = w * per; f < Math.min(total, (w + 1) * per); f++) {
          const file = path.join('frames', `f_${String(f).padStart(5, '0')}.jpg`);
          fs.writeFileSync(file, await grab(page, f / TL.fps));
          if (++done % 60 === 0) {
            const el = (Date.now() - t0) / 1000;
            console.log(`${done}/${total} frames, ${el.toFixed(0)}s elapsed, eta ${(el / done * (total - done)).toFixed(0)}s`);
          }
        }
      }));
      console.log('done', total, 'frames in', ((Date.now() - t0) / 1000).toFixed(0), 's');
    }
  } finally {
    await browser.close();
    srv.close();
  }
})();
