// Render frames of the reel with headless Chromium + three.js. Each frame also gets a .json with the
// mosaic box (screen rect of his chest-to-knee body), the mask check result and overlay anchor points.
// usage: node render.js frames <outDir> [shotIds...]     -> every frame (30 fps) of the given shots (default all)
//        node render.js stills <outDir> [shotIds...]     -> 3 stills per shot (start/mid/end) for checking
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const data = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'shots.json'), 'utf8'));
const FPS = 30;
const [mode = 'stills', outDir = path.join(ROOT, '..', 'out', 'stills'), ...ids] = process.argv.slice(2);
const shots = data.shots.filter(s => !ids.length || ids.includes(s.id));
fs.mkdirSync(outDir, { recursive: true });
const SCALE = process.env.SCALE || '1';

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.route('http://local/**', route => {
    const p = path.join(ROOT, decodeURIComponent(new URL(route.request().url()).pathname));
    const type = p.endsWith('.js') ? 'text/javascript' : p.endsWith('.ttf') ? 'font/ttf' : 'text/html';
    route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(p) });
  });
  await page.goto('http://local/index.html?s=' + SCALE);
  await page.waitForFunction(() => window.ready || window.__err, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__err);
  if (err) { console.error('LOAD ERROR', err); process.exit(1); }
  await page.evaluate(d => window.init(d), data);

  const grab = async (s, t, file) => {
    const r = await page.evaluate(([id, t, d, T, SCALE]) => {
      window.renderShot(id, t, d, T);
      return { b64: document.getElementById('c').toDataURL('image/jpeg', SCALE === '1' ? 0.94 : 0.85).split(',')[1], meta: window.frameMeta() };
    }, [s.id, t, s.dur, s.t0 + t, SCALE]);
    fs.writeFileSync(file, Buffer.from(r.b64, 'base64'));
    fs.writeFileSync(file.replace(/\.jpg$/, '.json'), JSON.stringify(r.meta));
    return r.meta;
  };

  const t0 = Date.now(); let n = 0;
  for (const s of shots) {
    if (mode === 'stills') {
      for (const [k, u] of [['a', 0.02], ['b', 0.5], ['c', 0.97]]) { const m = await grab(s, u * s.dur, path.join(outDir, `${s.id}_${k}.jpg`)); n++; if (m.out) console.log('  MASK OUTSIDE BOX', s.id, k, m.out); }
    } else {
      const f0 = Math.round(s.t0 * FPS), f1 = Math.round(s.t1 * FPS);
      for (let f = f0; f < f1; f++) {
        const file = path.join(outDir, `${String(f).padStart(5, '0')}.jpg`);
        if (fs.existsSync(file) && fs.existsSync(file.replace(/\.jpg$/, '.json'))) continue;
        const m = await grab(s, f / FPS - s.t0, file); n++;
        if (m.out) console.log('  MASK OUTSIDE BOX frame', f, m.out);
      }
    }
    console.log(`shot ${s.id} done (${n} frames, ${n ? ((Date.now() - t0) / n).toFixed(0) : 0} ms/frame)`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
