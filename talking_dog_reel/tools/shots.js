#!/usr/bin/env node
// Render one snapshot per shot (midpoint) for review:  node tools/shots.js --w 270 --h 480 --out build/shots [--from 0 --to 50]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2' };
(async () => {
  const srv = http.createServer((req, rsp) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; } rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(rsp); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const w = +opt('w', 270), h = +opt('h', 480), out = path.resolve(opt('out', 'build/shots'));
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/web/index.html?w=${w}&h=${h}`);
  await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
  const dur = await page.evaluate('window.TIMELINE.duration');
  const from = +opt('from', 0), to = Math.min(dur, +opt('to', dur));
  const shots = []; let cur = null;
  for (let t = from; t < to; t += 0.05) {
    const info = await page.evaluate(([t]) => window.sceneInfo(t), [t]);
    const key = info.id + ':' + info.shot.seg;
    if (!cur || cur.key !== key) { if (cur) cur.e = t; cur = { key, id: info.id, shot: info.shot.shot, s: t }; shots.push(cur); }
  }
  if (cur) cur.e = to;
  for (const s of shots) {
    const t = +opt('at', '') ? s.s + +opt('at') : (s.s + s.e) / 2;
    const d = await page.evaluate(([t]) => window.renderFrame(t, 0.85), [t]);
    const f = path.join(out, `s${String(s.id).padStart(2, '0')}_${s.key.split(':')[1]}_${t.toFixed(2)}.jpg`);
    fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64'));
    console.log(f.split('/').pop(), `shot ${s.shot} ${s.s.toFixed(2)}-${s.e.toFixed(2)} (${(s.e - s.s).toFixed(2)}s)`);
  }
  await browser.close(); srv.close();
})();
