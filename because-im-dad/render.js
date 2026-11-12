// render.js — render the animation to MP4 (24 fps) and mux the music.
//   node render.js [out.mp4] [audio.wav] [scale]
//   scale 1.5 => 1080x1080 (default), 1 => 720x720
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

(async () => {
  const out = process.argv[2] || path.join(__dirname, 'because-im-dad.mp4');
  const audio = process.argv[3] || '';
  const scale = parseFloat(process.argv[4] || '1.5');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: scale });
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?render=1');
  await page.waitForFunction(() => window.READY === true);
  const total = await page.evaluate(() => window.TOTAL);
  const N = Math.round(total * 24);
  const args = ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '24', '-i', '-'];
  if (audio) args.push('-i', audio);
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
  if (audio) args.push('-c:a', 'aac', '-b:a', '192k', '-af', `afade=t=out:st=${(total - 0.9).toFixed(2)}:d=0.9`, '-shortest');
  args.push(out);
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    await page.evaluate(t => window.renderFrame(t), f / 24);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log(`done: ${out} (${N} frames, ${total.toFixed(2)}s) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})();
