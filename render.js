/* Deterministic 8s render of index.html -> H.264 MP4.
 *
 * The page drives its rain from requestAnimationFrame + performance.now(),
 * and its CSS animations from the document timeline. Both are virtualised
 * here so every frame is reproducible and exactly 1/FPS apart, rather than
 * depending on how fast the machine happens to be.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const FPS      = 60;
const DURATION = 8;                       // seconds, one continuous shot
const FRAMES   = FPS * DURATION;
const WARMUP   = 150;                     // let rain + ripples populate first
const OUT      = process.argv[2] || 'rooftop-8s.mp4';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({
    viewport: { width: 540, height: 960 },  // x2 => 1080x1920
    deviceScaleFactor: 2
  });

  // virtual clock: rAF only advances when we say so
  await page.addInitScript(() => {
    let vnow = 0;
    const queue = [];
    performance.now = () => vnow;
    Date.now = () => 1755400000000 + vnow;
    window.requestAnimationFrame = cb => queue.push(cb);
    window.cancelAnimationFrame = () => {};
    window.__step = dt => {
      vnow += dt;
      queue.splice(0, queue.length).forEach(cb => cb(vnow));
    };
  });

  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  await page.goto('file:///home/user/my-first-website./index.html');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.getElementById('baked').width > 1);
  await page.evaluate(() => { document.querySelector('.ui').style.display = 'none'; });

  const step = dt => page.evaluate(d => window.__step(d), dt);
  const seek = t => page.evaluate(tt => {
    document.getAnimations({ subtree: true })
      .forEach(a => { a.pause(); a.currentTime = tt; });
  }, t);

  // settle the stochastic layers before frame 0
  for (let i = 0; i < WARMUP; i++) await step(1000 / FPS);

  const enc = spawn(ffmpeg, [
    '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-crf', '17',
    '-preset', 'slow',
    '-x264-params', 'ref=5:bframes=5',
    '-movflags', '+faststart',
    OUT
  ], { stdio: ['pipe', 'ignore', 'pipe'] });

  let ffErr = '';
  enc.stderr.on('data', d => { ffErr += d.toString(); });
  const done = new Promise((res, rej) => {
    enc.on('close', code => code === 0 ? res() : rej(new Error('ffmpeg ' + code + '\n' + ffErr.slice(-2000))));
  });

  const write = buf => new Promise(res => {
    enc.stdin.write(buf) ? res() : enc.stdin.once('drain', res);
  });

  const t0 = Date.now();
  for (let i = 0; i < FRAMES; i++) {
    await seek((i / FPS) * 1000);           // exact position in the 8s shot
    await step(1000 / FPS);                 // advance rain by one frame
    await write(await page.screenshot({ type: 'png' }));
    if ((i + 1) % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`  ${i + 1}/${FRAMES} frames  (${el.toFixed(0)}s elapsed, ` +
                  `~${((el / (i + 1)) * (FRAMES - i - 1)).toFixed(0)}s left)`);
    }
  }

  enc.stdin.end();
  await done;
  await browser.close();
  console.log('page errors:', errs.length ? errs : 'none');
  console.log('wrote', OUT);
})();
