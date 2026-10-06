#!/usr/bin/env node
// Renders ad.html frame by frame with headless Chromium.
//
//   node render.js --out frames --fps 60 [--scale 2] [--workers 4]
//   node render.js --stills 0.5,1.2,5.9 --out stills     # single moments, for review
//   node render.js --cues cues.json                       # export soundtrack cue times only
//
// Frames are written as PNGs named 00000.png, 00001.png, ...

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const OUT = path.resolve(opt('out', 'frames'));
const FPS = +opt('fps', 60);
const SCALE = +opt('scale', 1);
const WORKERS = +opt('workers', 4);
const STILLS = opt('stills', null);
const CUES = opt('cues', null);
const PAGE = 'file://' + path.join(__dirname, 'ad.html');

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: SCALE });
  page.on('pageerror', e => { console.error('page error:', e.message); process.exitCode = 1; });
  await page.goto(PAGE);
  await page.evaluate(() => window.ready);
  return page;
}

async function shoot(page, t, file) {
  await page.evaluate(tt => window.renderFrame(tt), t);
  await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 } });
}

(async () => {
  const browser = await playwright.chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  try {
    if (CUES) {
      const page = await openPage(browser);
      fs.writeFileSync(CUES, JSON.stringify(await page.evaluate(() => window.getCues()), null, 2));
      console.log('cues ->', CUES);
      return;
    }
    fs.mkdirSync(OUT, { recursive: true });
    if (STILLS) {
      const page = await openPage(browser);
      for (const s of STILLS.split(',')) {
        const t = parseFloat(s);
        const file = path.join(OUT, `t${t.toFixed(3)}.png`);
        await shoot(page, t, file);
        console.log(file);
      }
      return;
    }
    const duration = (await (await openPage(browser)).evaluate(() => window.DURATION));
    const total = Math.round(duration * FPS);
    let next = 0, done = 0;
    const started = Date.now();
    await Promise.all(Array.from({ length: WORKERS }, async () => {
      const page = await openPage(browser);
      while (next < total) {
        const f = next++;
        await shoot(page, f / FPS, path.join(OUT, String(f).padStart(5, '0') + '.png'));
        if (++done % 60 === 0 || done === total) {
          process.stdout.write(`\r${done}/${total} frames  ${((Date.now() - started) / 1000).toFixed(1)}s`);
        }
      }
    }));
    process.stdout.write('\n');
  } finally {
    await browser.close();
  }
})();
