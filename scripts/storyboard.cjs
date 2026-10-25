// Renders one frame per shot (mid-point, or custom times) -> build/story/*.png, then tiles them.
// node scripts/storyboard.cjs [out.jpg] [t1 t2 ...]
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { start } = require('./server.cjs');

(async () => {
  const [out = 'out/storyboard.jpg', ...custom] = process.argv.slice(2);
  const dir = path.resolve(__dirname, '..', 'build', 'story');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const { srv, port } = await start();
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 180000 });
  let items;
  if (custom.length) items = custom.map((t) => ({ id: 't' + t, t: parseFloat(t) }));
  else {
    const shots = await page.evaluate(() => window.TL.shots.map((s) => ({ id: s.id, t0: s.t0, t1: Math.min(s.t1, window.TL.duration) })));
    items = shots.filter((s) => s.id !== 'ECHO').map((s) => ({ id: s.id, t: s.id === 'END' ? s.t0 + (s.t1 - s.t0) * 0.62 : (s.t0 + s.t1) / 2 }));
    const outro = await page.evaluate(() => window.TL.outroT0 + 1.1);
    items.push({ id: 'OUTRO', t: outro });
  }
  const files = [];
  for (const it of items) {
    await page.evaluate((t) => window.renderAt(t), it.t);
    const f = path.join(dir, `${String(files.length).padStart(2, '0')}_${it.id}.png`);
    await page.screenshot({ path: f }); files.push({ f, label: `${it.id}  ${it.t.toFixed(2)}s` });
    process.stdout.write('.');
  }
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(files));
  execFileSync('python3', [path.join(__dirname, 'tile.py'), path.join(dir, 'index.json'), out], { stdio: 'inherit' });
  console.log('\nwrote', out);
})();
