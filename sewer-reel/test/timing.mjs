import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage(); page.on('pageerror', e => console.log('ERR', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?scale=${process.argv[2] || 0.5}`); await page.waitForFunction(() => window.READY);
for (const t of [1, 8, 19, 26, 34, 44, 52, 57]) {
  await page.evaluate(f => window.renderFrame(f), Math.round(t * 30));
  const t0 = Date.now(); for (let k = 0; k < 3; k++) await page.evaluate(f => window.renderFrame(f), Math.round(t * 30) + k + 1);
  const info = await page.evaluate(() => 0);
  console.log('t', t, ((Date.now() - t0) / 3).toFixed(0), 'ms/frame');
}
await browser.close(); server.close();
