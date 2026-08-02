/* Renders the animation to dance.mp4.
   Drives window.__renderAt() frame by frame in headless Chromium, pipes
   the PNGs into ffmpeg and muxes the original track back in.

   usage:  node tools/record.js [outfile]
   needs:  npm i playwright  +  a static server on :8100 serving the site
*/

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const OUT = process.argv[2] || path.join(__dirname, '..', 'dance.mp4');
const URL = process.env.SITE_URL || 'http://localhost:8100/index.html';
const AUDIO = path.join(__dirname, '..', 'assets', 'track.mp3');
const FPS = 30, W = 1280, H = 720;
const DURATION = Number(process.env.DURATION || 103.34);
const START = Number(process.env.START || 0);
const SILENT = !!process.env.SILENT;   // video-only segment, for parallel runs
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || undefined,
    args: [`--window-size=${W},${H}`, '--mute-audio', '--hide-scrollbars']
  });
  const page = await browser.newPage({
    viewport: { width: W, height: H }, deviceScaleFactor: 1
  });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });

  // Drop the start gate without playing audio — the capture is silent and
  // the soundtrack is muxed in afterwards.
  await page.evaluate(() => {
    document.getElementById('gate').classList.add('hidden');
    document.body.classList.add('playing');
  });

  const args = ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', 'pipe:0'];
  if (!SILENT) args.push('-i', AUDIO, '-map', '0:v', '-map', '1:a',
    '-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT);
  const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'inherit', 'inherit'] });

  // Warm the rig up just before the start point so a segment never opens
  // mid-transition (matters when segments are rendered in parallel).
  for (let i = 15; i > 0; i--) {
    await page.evaluate(([tt, dt]) => window.__renderAt(tt, dt),
      [Math.max(0, START - i / FPS), 1 / FPS]);
  }

  const total = Math.round(DURATION * FPS);
  for (let i = 0; i < total; i++) {
    const t = START + i / FPS;
    await page.evaluate(([tt, dt]) => window.__renderAt(tt, dt), [t, 1 / FPS]);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) {
      await new Promise(r => ff.stdin.once('drain', r));
    }
    if (i % 150 === 0) {
      process.stdout.write(`\r  frame ${i}/${total}  (${(t).toFixed(1)}s)   `);
    }
  }
  process.stdout.write('\n');

  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('wrote', OUT);
})();
