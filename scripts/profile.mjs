// Measure average render time per frame with features toggled (run with ALLOW_MISSING_VO=1 if a line is missing).
import { spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { buildTimeline } from './timeline.mjs';
import { P, ROOT } from './config.mjs';

fs.writeFileSync(P('build', 'timeline.json'), JSON.stringify(buildTimeline(), null, 2));
const srv = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = srv.address().port;
const msaa = process.argv[2] ?? '4';
const browser = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true, protocolTimeout: 900000,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`http://127.0.0.1:${port}/src/index.html?msaa=${msaa}`);
await page.waitForFunction('window.ready === true || window.initError', { timeout: 300000 });
const times = (process.argv[3] || '3,10,36.5,57').split(',').map(Number);
for (const t of times) {
  const r = {};
  r.full = await page.evaluate((t) => window.profile(t, 2), t);
  r.noDOF = await page.evaluate((t) => window.profile(t, 2, { noDOF: true }), t);
  r.noBloom = await page.evaluate((t) => window.profile(t, 2, { noBloom: true }), t);
  r.noShadows = await page.evaluate((t) => window.profile(t, 2, { noShadows: true }), t);
  console.log(`msaa=${msaa} t=${t}: ` + Object.entries(r).map(([k, v]) => `${k} ${v.toFixed(0)}ms`).join('  '));
}
await browser.close(); srv.close();
