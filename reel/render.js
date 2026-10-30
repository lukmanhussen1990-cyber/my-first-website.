// Drives scene.html in headless Chromium.
//   node render.js preview 0.5 3.9 7.2   -> build/preview/t_<time>.png
//   node render.js video                 -> build/video_noaudio.mp4 (all frames)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf' };

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2);
  const server = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => { console.error('[page error]', e); process.exitCode = 1; });
  await page.goto(`http://127.0.0.1:${server.address().port}/scene.html`);
  await page.evaluate(() => window.ready);
  const { FPS, DUR } = await page.evaluate(() => window.META);
  const grab = async t => {
    const url = await page.evaluate(tt => { window.renderAt(tt); return window.frameData('image/png'); }, t);
    return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  };

  if (mode === 'preview') {
    const dir = path.join(ROOT, 'build', 'preview');
    fs.mkdirSync(dir, { recursive: true });
    for (const s of rest) {
      const t = parseFloat(s);
      fs.writeFileSync(path.join(dir, `t_${t.toFixed(2)}.png`), await grab(t));
      console.log('preview', t);
    }
  } else if (mode === 'video') {
    const out = path.join(ROOT, 'build', 'video_noaudio.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS), out],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
    const n = Math.round(FPS * DUR), t0 = Date.now();
    for (let i = 0; i < n; i++) {
      const buf = await grab(i / FPS);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 30 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
    ff.stdin.end();
    await done;
    console.log('wrote', out);
  }
  await browser.close();
  server.close();
}
main().catch(e => { console.error(e); process.exit(1); });
