// still.js — render stills: node still.js out_dir name1 [name2 ...]
//   name = "t=12.5" for a story frame, or "test=chars" for a test sheet.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const [out, ...names] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?render=1');
  await page.waitForFunction(() => window.READY === true);
  for (const n of names) {
    const [k, v] = n.split('=');
    if (k === 't') await page.evaluate(t => window.renderFrame(t), parseFloat(v));
    else await page.evaluate(([nm, t]) => window.renderTest(nm, t), [v, 0]);
    await page.screenshot({ path: path.join(out, n.replace(/[^a-z0-9.]+/gi, '_') + '.png') });
  }
  await browser.close();
})();
