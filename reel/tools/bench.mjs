import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = path.resolve('.');
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(8799);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const t = parseFloat(process.argv[2] || '47');
for (const q of process.argv.slice(3)) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('http://localhost:8799/src/index.html?' + q);
  await page.waitForFunction(() => window.__inited || window.__error, null, { timeout: 0 });
  const r = await page.evaluate((t) => window.APP.bench(t, 3), t);
  console.log(q.padEnd(30), JSON.stringify(r, (k, v) => typeof v === 'number' ? Math.round(v) : v));
  await page.close();
}
await browser.close(); srv.close();
