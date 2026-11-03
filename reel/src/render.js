// Usage:
//   node render.js stills <outdir> <w> <h> t1 t2 ...
//   node render.js video <out.mp4> <w> <h> <fps> <startFrame> <endFrame> [crf]
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const [mode, out, w, h, ...rest] = process.argv.slice(2);
  const W = +w, H = +h;
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.error('PAGE:', m.text()); });
  page.on('pageerror', e => console.error('PAGEERR:', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?w=${W}&h=${H}&lq=${W < 800 ? 1 : 0}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 });

  if (mode === 'stills' || mode === 'shots') {
    fs.mkdirSync(out, { recursive: true });
    const times = mode === 'shots' ? await page.evaluate(() => window.SHOT_MIDS) : rest;
    for (const ts of times) {
      const t = +ts;
      const t0 = Date.now();
      await page.evaluate(t => window.renderAt(t), t);
      await page.screenshot({ path: path.join(out, `t_${t.toFixed(2).padStart(6, '0')}.png`) });
      console.log(`t=${t} ${(Date.now() - t0)}ms`);
    }
  } else {
    const [fps, f0, f1, crf = '18'] = rest.map(Number);
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const tStart = Date.now();
    for (let f = f0; f < f1; f++) {
      const t = f / fps;
      await page.evaluate(t => window.renderAt(t), t);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - f0) % 30 === 0) console.log(`[${path.basename(out)}] frame ${f}/${f1} ${((Date.now() - tStart) / (f - f0 + 1)).toFixed(0)}ms/f`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
