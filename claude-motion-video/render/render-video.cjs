// Deterministic frame renderer: drives window.renderFrame(t) in headless Chromium and encodes with ffmpeg.
//
//   node render/render-video.cjs --stills=1.5,4.9,12          # review stills -> out/stills/
//   node render/render-video.cjs --from=0 --to=33 --workers=4  # full render -> out/video.mp4
//   node render/render-video.cjs --cues                        # dump audio cues -> out/cues.json
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');
const { startServer } = require('./server.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'out');
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const FPS = +(args.fps || 30);
const SCALE = +(args.scale || 1);
const WORKERS = +(args.workers || 4);
const LAUNCH = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] };

async function openPage(browser, port) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: SCALE });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/src/index.html`);
  await page.evaluate(() => window.ready);
  return page;
}

async function shoot(page, t, file) {
  await page.evaluate((tt) => window.renderFrame(tt), t);
  await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { server, port } = await startServer(ROOT);
  const browser = await chromium.launch(LAUNCH);

  if (args.cues) {
    const page = await openPage(browser, port);
    const cues = await page.evaluate(() => ({ duration: window.DURATION, cues: window.getCues() }));
    fs.writeFileSync(path.join(OUT, 'cues.json'), JSON.stringify(cues, null, 1));
    console.log(`wrote ${cues.cues.length} cues`);
  }

  if (args.stills) {
    const dir = path.join(OUT, 'stills');
    fs.mkdirSync(dir, { recursive: true });
    const page = await openPage(browser, port);
    for (const s of String(args.stills).split(',')) {
      const t = +s;
      await shoot(page, t, path.join(dir, `t_${t.toFixed(2)}.png`));
      console.log('still', t);
    }
  }

  if (args.to !== undefined) {
    const from = +(args.from || 0), to = +args.to;
    const n = Math.round((to - from) * FPS);
    const dir = path.join(OUT, 'frames');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const pages = await Promise.all(Array.from({ length: WORKERS }, () => openPage(browser, port)));
    const t0 = Date.now();
    let done = 0;
    await Promise.all(pages.map(async (page, w) => {
      // contiguous chunks keep each worker's scene caches warm
      const per = Math.ceil(n / WORKERS);
      for (let i = w * per; i < Math.min(n, (w + 1) * per); i++) {
        await shoot(page, from + i / FPS, path.join(dir, `f_${String(i).padStart(5, '0')}.png`));
        if (++done % 60 === 0) console.log(`${done}/${n} frames  ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
      }
    }));
    console.log(`rendered ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    const out = args.out ? path.resolve(ROOT, args.out) : path.join(OUT, 'video.mp4');
    const vf = SCALE !== 1 ? `scale=1920:1080:flags=lanczos,noise=alls=3:allf=t` : 'noise=alls=3:allf=t';
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, 'f_%05d.png'),
      '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('ffmpeg failed');
    console.log('wrote', out);
    if (!args.keep) fs.rmSync(dir, { recursive: true, force: true });
  }

  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
