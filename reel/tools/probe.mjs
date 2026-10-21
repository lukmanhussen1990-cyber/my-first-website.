// Print where John's band/face and the wheel hub land on screen over a time range (for subtitle-safe framing).
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(f).pipe(r); }).listen(8797);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 270, height: 480 } });
await page.goto('http://localhost:8797/src/index.html?scale=0.25&ao=0');
await page.waitForFunction(() => window.__inited || window.__error, null, { timeout: 0 });
const [a, b, step] = process.argv.slice(2).map(Number);
for (let t = a; t <= b + 1e-6; t += step) {
  const r = await page.evaluate((t) => window.APP.probe(t), t);
  console.log(t.toFixed(2), 'band', r.band.join(','), 'face', r.face.join(','), 'hub', r.hub.join(','));
}
await browser.close(); srv.close();
