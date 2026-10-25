// Deterministic frame render: Playwright Chromium (SwiftShader WebGL) -> JPEG frames -> ffmpeg.
//   node scripts/render.cjs                 full reel  -> out/final_reel.mp4
//   node scripts/render.cjs --from 0 --to 6 --out out/preview_6s.mp4
//   options: --workers N (default 3), --fps 30, --keep (keep frames), --noaudio
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { start, ROOT } = require('./server.cjs');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const FPS = +arg('fps', 30);
const WORKERS = +arg('workers', 3);
const OUT = path.resolve(ROOT, arg('out', 'out/final_reel.mp4'));
const FRAMES = path.resolve(ROOT, arg('frames', 'build/frames'));

(async () => {
  const timings = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'timings.json'), 'utf8'));
  const t0 = +arg('from', 0), t1 = +arg('to', timings.duration);
  const f0 = Math.round(t0 * FPS), f1 = Math.ceil(t1 * FPS);
  fs.mkdirSync(FRAMES, { recursive: true });
  const todo = [];
  for (let f = f0; f < f1; f++) if (!fs.existsSync(path.join(FRAMES, `${String(f).padStart(5, '0')}.jpg`))) todo.push(f);
  console.log(`frames ${f0}..${f1 - 1} (${f1 - f0}), to render: ${todo.length}, workers: ${WORKERS}`);
  const { srv, port } = await start();
  const started = Date.now(); let done = 0;
  const worker = async (wi) => {
    const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.log(`[w${wi} pageerror]`, e.message));
    await page.goto(`http://127.0.0.1:${port}/index.html`);
    await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 240000 });
    const err = await page.evaluate(() => window.__error);
    if (err) throw new Error(err);
    // interleaved split keeps every worker on similar content cost
    for (let k = wi; k < todo.length; k += WORKERS) {
      const f = todo[k];
      await page.evaluate((t) => window.renderAt(t), f / FPS);
      await page.screenshot({ path: path.join(FRAMES, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95 });
      done++;
      if (done % 30 === 0) {
        const el = (Date.now() - started) / 1000; const rate = done / el;
        console.log(`  ${done}/${todo.length}  ${rate.toFixed(2)} fps  eta ${((todo.length - done) / rate / 60).toFixed(1)} min`);
      }
    }
    await browser.close();
  };
  await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)));
  srv.close();
  console.log(`rendered ${todo.length} frames in ${((Date.now() - started) / 60000).toFixed(1)} min`);
  // encode
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const list = path.join(FRAMES, `list_${f0}_${f1}.txt`);
  fs.writeFileSync(list, Array.from({ length: f1 - f0 }, (_, i) => `file '${String(f0 + i).padStart(5, '0')}.jpg'\nduration ${1 / FPS}`).join('\n') + '\n');
  const mix = path.join(ROOT, 'build', 'mix.wav');
  const a = ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-r', String(FPS), '-i', list];
  if (!flag('noaudio') && fs.existsSync(mix)) a.push('-ss', String(t0), '-t', String(t1 - t0), '-i', mix);
  a.push('-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-t', String((f1 - f0) / FPS));
  if (!flag('noaudio') && fs.existsSync(mix)) a.push('-c:a', 'aac', '-b:a', '192k');
  a.push('-movflags', '+faststart', OUT);
  execFileSync('ffmpeg', a, { stdio: 'inherit' });
  console.log('wrote', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
