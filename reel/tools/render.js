// Headless renderer: serves the project, drives the page frame by frame.
//   node tools/render.js stills 1.2,5.0,9.3 [outdir]     -> PNG stills
//   node tools/render.js video <from> <to> <out.mp4> [step]  -> H.264 segment (no audio)
//   node tools/render.js info                              -> shots + audio cue list (JSON)
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.woff2': 'font/woff2' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(0, () => res(srv));
  });
}

(async () => {
  const [mode, a, b, c, d] = process.argv.slice(2);
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const timeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/timeline.json'), 'utf8'));
  const SCALE = parseFloat(process.env.SCALE || '1'), NOBLUR = !!process.env.NOBLUR;
  const info = await page.evaluate(([tl, sc]) => window.setup(tl, { scale: sc }), [timeline, SCALE]);
  if (mode === 'info') {
    fs.writeFileSync(path.join(ROOT, 'build/cues.json'), JSON.stringify(info, null, 1));
    console.log(JSON.stringify(info.shots.map((s) => [s.id, +s.t0.toFixed(2), +s.t1.toFixed(2)])), 'duration', info.duration.toFixed(2));
  } else if (mode === 'stills') {
    const outDir = b || path.join(ROOT, 'build/stills');
    fs.mkdirSync(outDir, { recursive: true });
    for (const ts of a.split(',')) {
      const t = parseFloat(ts);
      const t0 = Date.now();
      const url = await page.evaluate((t) => window.renderFrame(t, { type: 'image/png' }), t);
      const file = path.join(outDir, `t${t.toFixed(2).padStart(6, '0')}.png`);
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      console.log(file, ((Date.now() - t0) / 1000).toFixed(1) + 's');
    }
  } else if (mode === 'video') {
    const from = parseFloat(a), to = parseFloat(b), out = c, fps = 30;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
    const T0 = Date.now();
    for (let f = f0; f < f1; f++) {
      const url = await page.evaluate(([t, nb]) => window.renderFrame(t, { type: 'image/jpeg', quality: 0.95, noBlur: nb }), [f / fps, NOBLUR]);
      const buf = Buffer.from(url.split(',')[1], 'base64');
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if ((f - f0) % 15 === 0) console.log(`frame ${f}/${f1} ${(((Date.now() - T0) / 1000) / (f - f0 + 1)).toFixed(2)}s/f`);
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
  }
  await browser.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
