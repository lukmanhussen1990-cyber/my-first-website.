// Render frames of the reel with headless Chromium + three.js.
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

function evFor(s) {
  const W = data.words, rel = i => W[i].s - s.t0, relE = i => W[i].e - s.t0;
  const ev = {};
  if (s.id === '09') ev.fines = [rel(35), rel(37)];
  if (s.id === '14') ev.under = rel(53) + 0.35;
  if (s.id === '21') ev.click = relE(84) - 0.22;
  return ev;
}

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
  await page.goto('http://local/index.html');
  await page.waitForFunction(() => window.ready || window.__err, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__err);
  if (err) { console.error('LOAD ERROR', err); process.exit(1); }
  await page.evaluate(d => window.init(d), data);

  const grab = async (s, t, file) => {
    const b64 = await page.evaluate(([id, t, d, T, ev]) => {
      window.renderShot(id, t, d, T, ev);
      return document.getElementById('c').toDataURL('image/jpeg', 0.94).split(',')[1];
    }, [s.id, t, s.dur, s.t0 + t, evFor(s)]);
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  };

  const t0 = Date.now(); let n = 0;
  for (const s of shots) {
    if (mode === 'stills') {
      for (const [k, u] of [['a', 0.02], ['b', 0.5], ['c', 0.97]]) { await grab(s, u * s.dur, path.join(outDir, `${s.id}_${k}.jpg`)); n++; }
    } else {
      const f0 = Math.round(s.t0 * FPS), f1 = Math.round(s.t1 * FPS);
      for (let f = f0; f < f1; f++) {
        const file = path.join(outDir, `${String(f).padStart(5, '0')}.jpg`);
        if (fs.existsSync(file)) continue;
        await grab(s, f / FPS - s.t0, file); n++;
      }
    }
    console.log(`shot ${s.id} done (${n} frames, ${((Date.now() - t0) / n).toFixed(0)} ms/frame)`);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
