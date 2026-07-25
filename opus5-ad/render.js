const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const FPS = Number(process.env.FPS || 60);
const DUR = Number(process.env.DUR || 20);
const OUT = process.env.OUT || path.join(__dirname, 'opus5-ad.mp4');
const FFMPEG = process.env.FFMPEG;
const URL = process.env.URL || 'http://127.0.0.1:8123/index.html';
// optional preview mode: comma separated times -> writes PNGs, no video
const PREVIEW = process.env.PREVIEW;

(async () => {
  const browser = await chromium.launch({
    args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none',
           '--hide-scrollbars', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.READY === true, { timeout: 60000 });
  console.log('page ready');

  if (PREVIEW) {
    const fs = require('fs');
    fs.mkdirSync(path.join(__dirname, 'preview'), { recursive: true });
    for (const s of PREVIEW.split(',')) {
      const t = Number(s);
      await page.evaluate(t => window.seek(t), t);
      await page.screenshot({ path: path.join(__dirname, 'preview', `t${s}.png`) });
      console.log('preview', t);
    }
    await browser.close();
    return;
  }

  const total = Math.round(FPS * DUR);
  const ff = spawn(FFMPEG, [
    '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
    '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
    '-x264-params', 'ref=4:bframes=3',
    '-movflags', '+faststart',
    OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const write = buf => new Promise((res, rej) => {
    if (ff.stdin.write(buf)) return res();
    ff.stdin.once('drain', res);
    ff.stdin.once('error', rej);
  });

  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    const t = f / FPS;
    await page.evaluate(t => window.seek(t), t);
    const buf = await page.screenshot({ type: 'png' });
    await write(buf);
    if (f % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`frame ${f}/${total}  t=${t.toFixed(2)}s  elapsed ${el.toFixed(0)}s`);
    }
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('done ->', OUT);
})();
