// node render.mjs stills <outdir> <f1,f2,...>   |   node render.mjs seg <start> <end> <out.mp4>
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((q, s) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); s.end(d); }); }).listen(0);
const port = srv.address().port;
const [mode, ...args] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('console', m => { if (['error', 'warning'].includes(m.type()) || m.text().startsWith('INIT')) console.log('PAGE', m.type(), m.text()); });
page.on('pageerror', e => console.log('ERR page error', e.message));
await page.goto(`http://localhost:${port}/web/index.html`);
await page.waitForFunction(() => window.ready || window.initError, null, { timeout: 120000 });
const ie = await page.evaluate(() => window.initError); if (ie) { console.log('INIT FAILED', ie); process.exit(1); }
const shot = async f => { await page.evaluate(f => window.renderFrame(f), f); return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 } }); };
if (mode === 'stills') {
  const [out, list] = args; fs.mkdirSync(out, { recursive: true });
  for (const f of list.split(',').map(Number)) { const t0 = Date.now(); fs.writeFileSync(path.join(out, `f${String(f).padStart(4, '0')}.png`), await shot(f)); console.log('frame', f, Date.now() - t0, 'ms'); }
} else if (mode === 'seg') {
  const [a, b, out] = args; const tmp = out + '.part.mp4';
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', '30', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '11', '-pix_fmt', 'yuv420p', '-r', '30', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = +a; f < +b; f++) { const buf = await shot(f); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); fs.renameSync(tmp, out); console.log('seg done', a, b);
}
await browser.close(); srv.close();
