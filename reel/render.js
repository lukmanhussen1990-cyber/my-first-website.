// Frame-by-frame renderer: serves the project, drives the page with Playwright, saves PNG/JPEG frames.
// usage: node render.js --out DIR [--from F --to F] [--times t1,t2,...] [--scale 0.5]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', path.join(root, 'build/frames'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.css': 'text/css' };
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(root)) { r.statusCode = 403; return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader('content-type', MIME[path.extname(p)] || 'application/octet-stream'); r.end(d); });
});
srv.listen(0, '127.0.0.1', async () => {
  fs.mkdirSync(out, { recursive: true });
  const tl = JSON.parse(fs.readFileSync(path.join(root, 'build/timeline.json')));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error('PAGEERROR', e.message, e.stack); process.exit(2); });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('CONSOLE', m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
  await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
  const stage = await page.$('#stage');
  const times = arg('times', null);
  const t0 = Date.now();
  if (times) {
    for (const ts of times.split(',')) {
      const t = parseFloat(ts);
      await page.evaluate((t) => window.renderFrame(t), t);
      await stage.screenshot({ path: path.join(out, `still_${t.toFixed(2).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 88 });
    }
  } else {
    const total = Math.round(tl.duration * tl.fps);
    const from = parseInt(arg('from', '0')), to = Math.min(total, parseInt(arg('to', String(total))));
    for (let f = from; f < to; f++) {
      await page.evaluate((t) => window.renderFrame(t), f / tl.fps);
      await stage.screenshot({ path: path.join(out, `f_${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 96 });
      if ((f - from) % 60 === 0) console.log(`frame ${f}/${to} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
  await browser.close(); srv.close();
  console.log('done', ((Date.now() - t0) / 1000).toFixed(1) + 's');
});
