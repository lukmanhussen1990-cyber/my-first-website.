// Frame capture for the canvas animation (headless Chromium via Playwright).
//
//   node tools/capture.js stills <outDir> <t1,t2,...>     -> PNG stills at given seconds
//   node tools/capture.js frames <outDir> [workers=4]     -> every frame (30 fps) as PNG
//   node tools/capture.js page <file.html> <out.png>       -> screenshot of a test page canvas
//
// Files are served from the project root through Playwright routing, so fonts load same-origin.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'http://larry.local/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff': 'font/woff', '.png': 'image/png', '.mp3': 'audio/mpeg' };

async function openPage(browser, file) {
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await ctx.route(ORIGIN + '**', route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
    const fp = path.join(ROOT, rel);
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) return route.fulfill({ status: 404, body: 'nf' });
    route.fulfill({ status: 200, contentType: MIME[path.extname(fp)] || 'application/octet-stream', body: fs.readFileSync(fp) });
  });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(ORIGIN + file + '?capture=1');
  await page.evaluate(() => window.ready);
  return page;
}

async function grab(page, t) {
  const url = await page.evaluate(tt => { window.renderAt(tt); return document.getElementById('c').toDataURL('image/png'); }, t);
  return Buffer.from(url.split(',')[1], 'base64');
}

(async () => {
  const [mode, a, b, c] = process.argv.slice(2);
  const browser = await chromium.launch();
  try {
    if (mode === 'stills') {
      fs.mkdirSync(a, { recursive: true });
      const page = await openPage(browser, 'index.html');
      for (const ts of b.split(',')) {
        const t = parseFloat(ts);
        fs.writeFileSync(path.join(a, `still_${t.toFixed(2).padStart(6, '0')}.png`), await grab(page, t));
      }
    } else if (mode === 'frames') {
      fs.mkdirSync(a, { recursive: true });
      const workers = parseInt(b || '4', 10);
      const probe = await openPage(browser, 'index.html');
      const total = await probe.evaluate(() => Math.round(window.DURATION * 30));
      await probe.context().close();
      console.log('total frames', total);
      const per = Math.ceil(total / workers);
      let done = 0; const t0 = Date.now();
      await Promise.all(Array.from({ length: workers }, async (_, w) => {
        const page = await openPage(browser, 'index.html');
        for (let f = w * per; f < Math.min(total, (w + 1) * per); f++) {
          fs.writeFileSync(path.join(a, `f_${String(f).padStart(5, '0')}.png`), await grab(page, f / 30));
          if (++done % 100 === 0) console.log(`${done}/${total}  ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
        }
      }));
    } else if (mode === 'page') {
      const page = await openPage(browser, a);
      fs.writeFileSync(b, await grab(page, parseFloat(c || '0')));
    }
  } finally { await browser.close(); }
})();
