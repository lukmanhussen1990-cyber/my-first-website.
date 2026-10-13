// Renders the scene with headless Chromium.
//
//   node tools/render.mjs cues   <out.json>
//   node tools/render.mjs stills <outdir> <t1,t2,...>
//   node tools/render.mjs frames <outdir> [fps=60] [workers=4] [start=0] [end=DURATION]
//
// Every frame is a pure function of time, so workers render interleaved frames
// independently and the result is identical to a single sequential pass.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  const { execSync } = await import('node:child_process');
  const root = execSync('npm root -g').toString().trim();
  ({ chromium } = require(path.join(root, 'playwright')));
}

const here = path.dirname(fileURLToPath(import.meta.url));
const sceneUrl = pathToFileURL(path.join(here, '..', 'scene', 'index.html')).href;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(sceneUrl);
  await page.evaluate(() => window.ready);
  if (errors.length) throw new Error('Scene errors:\n' + errors.join('\n'));
  page._errors = errors;
  return page;
}

async function grab(page, t) {
  const b64 = await page.evaluate((tt) => {
    window.renderFrame(tt);
    return document.getElementById('c').toDataURL('image/png').split(',')[1];
  }, t);
  if (page._errors.length) throw new Error(`Error at t=${t}:\n` + page._errors.join('\n'));
  return Buffer.from(b64, 'base64');
}

const [mode, out, ...rest] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] });
try {
  if (mode === 'cues') {
    const page = await openPage(browser);
    const data = await page.evaluate(() => ({ markers: window.SCENE.M, duration: window.SCENE.DURATION, cues: window.getCues() }));
    writeFileSync(out, JSON.stringify(data, null, 1));
    console.log(`${data.cues.length} cues -> ${out}`);
  } else if (mode === 'stills') {
    mkdirSync(out, { recursive: true });
    const page = await openPage(browser);
    for (const t of rest[0].split(',').map(Number)) {
      const png = await grab(page, t);
      const f = path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`);
      writeFileSync(f, png);
    }
    console.log('stills written to', out);
  } else if (mode === 'frames') {
    mkdirSync(out, { recursive: true });
    const fps = Number(rest[0] || 60), workers = Number(rest[1] || 4);
    const probe = await openPage(browser);
    const duration = await probe.evaluate(() => window.SCENE.DURATION);
    await probe.close();
    const start = Number(rest[2] || 0), end = Number(rest[3] || duration);
    const f0 = Math.round(start * fps), f1 = Math.round(end * fps);
    const total = f1 - f0;
    let done = 0;
    const t0 = Date.now();
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const page = await openPage(browser);
      for (let f = f0 + w; f < f1; f += workers) {
        const png = await grab(page, f / fps);
        writeFileSync(path.join(out, `f${String(f).padStart(5, '0')}.png`), png);
        done++;
        if (done % 120 === 0) {
          const el = (Date.now() - t0) / 1000;
          console.log(`${done}/${total} frames  ${(done / el).toFixed(1)} fps  eta ${((total - done) / (done / el)).toFixed(0)}s`);
        }
      }
      await page.close();
    }));
    console.log(`rendered ${total} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } else {
    console.error('usage: render.mjs cues|stills|frames ...');
    process.exitCode = 2;
  }
} finally {
  await browser.close();
}
