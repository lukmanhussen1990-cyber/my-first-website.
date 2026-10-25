// Snapshot helper: node scripts/snap.cjs <mode> <out.png|out_dir> [t1 t2 ...]
//   mode "sheet"  -> character sheet still
//   mode "reel"   -> renderAt(t) for each t, writes <out_dir>/t_<t>.png
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { start } = require('./server.cjs');

(async () => {
  const [mode = 'reel', out = 'build/snaps', ...ts] = process.argv.slice(2);
  const { srv, port } = await start();
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?mode=${mode}`);
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 180000 });
  const err = await page.evaluate(() => window.__error);
  if (err) { console.error(err); process.exit(1); }
  if (mode.startsWith('sheet')) {
    await page.screenshot({ path: out });
    console.log('wrote', out);
  } else {
    fs.mkdirSync(out, { recursive: true });
    for (const t of ts) {
      const t0 = Date.now();
      await page.evaluate((tt) => window.renderAt(tt), parseFloat(t));
      const f = path.join(out, `t_${parseFloat(t).toFixed(2)}.png`);
      await page.screenshot({ path: f });
      console.log('wrote', f, (Date.now() - t0) + 'ms');
    }
  }
  await browser.close(); srv.close();
})();
