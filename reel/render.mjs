// Headless frame renderer: serves this folder, drives the page frame-by-frame, writes JPEG frames.
// Usage:
//   node render.mjs stills <outDir> [name ...]      render named test stills
//   node render.mjs frames <outDir> [from] [to]     render timeline frames (inclusive range)
//   node render.mjs times <outDir> t1 t2 ...         render single timestamps (seconds)
//   node render.mjs sfx <outDir>                    dump the sound-effect cue list (sfx.json)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wav': 'audio/wav' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const [mode = 'stills', outDir = 'out', ...rest] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const srv = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('[log]')) console.log('page:', m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?mode=${mode}`);
await page.waitForFunction(() => window.APP_READY === true, null, { timeout: 120000 });

const save = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
const t0 = Date.now();
if (mode === 'stills') {
  const names = rest.length ? rest : await page.evaluate(() => window.APP.stillNames());
  for (const n of names) {
    const url = await page.evaluate((n) => window.APP.renderStill(n), n);
    save(path.join(outDir, `${n}.jpg`), url);
    console.log('still', n);
  }
} else if (mode === 'times') {
  for (const t of rest.map(Number)) {
    const url = await page.evaluate((t) => window.APP.renderTime(t), t);
    save(path.join(outDir, `t_${t.toFixed(2).padStart(6, '0')}.jpg`), url);
  }
} else if (mode === 'sfx') {
  fs.writeFileSync(path.join(outDir, 'sfx.json'), JSON.stringify(await page.evaluate(() => window.APP.sfxEvents()), null, 1));
} else {
  const total = await page.evaluate(() => window.APP.frameCount());
  const from = Number(rest[0] ?? 0), to = Math.min(Number(rest[1] ?? total - 1), total - 1);
  for (let f = from; f <= to; f++) {
    const url = await page.evaluate((f) => window.APP.renderFrame(f), f);
    save(path.join(outDir, `f_${String(f).padStart(5, '0')}.jpg`), url);
    if (f % 30 === 0) console.log(`frame ${f}/${to} ${((Date.now() - t0) / (f - from + 1)).toFixed(0)}ms/f`);
  }
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await browser.close();
srv.close();
