// Frame capture with Playwright + Chromium.
//
//   node capture.cjs stills <outDir> <t1,t2,...> [--debug]
//   node capture.cjs frames <outDir> [--fps 30] [--from 0] [--to 25]
//   node capture.cjs text   <outDir> [--fps 30]      (text layer only, transparent PNGs)
//   node capture.cjs cues   <out.json>
//
// Requires NODE_PATH to include a Playwright install.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const SRC = path.resolve(__dirname, '..', 'src', 'index.html');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
}

(async () => {
  const [mode, out, list] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--font-render-hinting=none', '--disable-lcd-text'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto('file://' + SRC);
  await page.evaluate(() => window.ready);

  if (mode === 'cues') {
    const cues = await page.evaluate(() => PS.CUES);
    fs.writeFileSync(out, JSON.stringify(cues, null, 1));
    console.log('cues:', cues.length);
  } else if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    const debug = process.argv.includes('--debug');
    for (const ts of list.split(',')) {
      const t = parseFloat(ts);
      await page.evaluate(([t, debug]) => PS.renderFrame(t, { debug }), [t, debug]);
      await page.screenshot({ path: path.join(out, `t${t.toFixed(2).padStart(5, '0')}.png`) });
    }
    console.log('stills done');
  } else if (mode === 'frames' || mode === 'text') {
    fs.mkdirSync(out, { recursive: true });
    const fps = parseFloat(arg('fps', '30'));
    const from = parseFloat(arg('from', '0')), to = parseFloat(arg('to', '25'));
    const n0 = Math.round(from * fps), n1 = Math.round(to * fps);
    if (mode === 'text') await page.evaluate(() => document.body.classList.add('alpha'));
    const t0 = Date.now();
    for (let n = n0; n < n1; n++) {
      const t = n / fps;
      await page.evaluate((t) => PS.renderFrame(t), t);
      await page.screenshot({ path: path.join(out, `f${String(n).padStart(5, '0')}.png`), omitBackground: mode === 'text' });
      if (n % 60 === 0) console.log(`frame ${n} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }
    console.log(`${n1 - n0} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
