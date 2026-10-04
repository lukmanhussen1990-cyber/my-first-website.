// Usage: node render.js <html> <outdir> <fps> <duration> <w> <h>
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const path = require('path'), fs = require('fs');
const [,, file, outdir, fpsS, durS, wS, hS] = process.argv;
const fps = +fpsS || 60, dur = +durS || 5, W = +wS || 1920, H = +hS || 1080;
(async () => {
  fs.mkdirSync(outdir, { recursive: true });
  const b = await chromium.launch({ args: ['--force-device-scale-factor=1', '--disable-gpu-vsync'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve(file));
  await p.evaluate(() => window.ready);
  const n = Math.round(fps * dur);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const t = i / fps;
    await p.evaluate(t => window.seek(t), t);
    await p.screenshot({ path: path.join(outdir, `f${String(i).padStart(5, '0')}.png`), type: 'png', animations: 'disabled', caret: 'hide' });
    if (i % 60 === 0) console.log(`frame ${i}/${n}  ${(Date.now() - t0) / 1000}s`);
  }
  await b.close();
  console.log(`done ${n} frames in ${(Date.now() - t0) / 1000}s`);
})().catch(e => { console.error(e); process.exit(1); });
