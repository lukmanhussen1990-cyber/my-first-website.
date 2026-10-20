// Renders the reel with headless Chromium (Playwright).
//
//   node render_frames.mjs --frames            all 1350 PNG frames  -> build/frames/frame_00000.png ...
//   node render_frames.mjs --stills            check stills         -> build/stills/still_XX.Xs.png
//   node render_frames.mjs --cover             cover image          -> output/cover.png
//   node render_frames.mjs --cues              audio cue sheet      -> build/cues.json
//   node render_frames.mjs --times 3.2,8.9     extra stills at the given seconds
//   --range 0,90                               only render frames [from, to) (no folder wipe)
//   --workers 4                                pages rendering in parallel (default: CPU count, max 6)
//
// For every frame i the page calls render(i / 30) and returns the canvas as PNG.
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const STILL_TIMES = [1.5, 5, 10, 14, 19, 23, 28, 33, 37, 43];
const COVER_TIME = 2.2;
const workers = Math.max(1, Math.min(6, parseInt(val('--workers', String(os.cpus().length)), 10)));
const url = pathToFileURL(path.join(ROOT, 'index.html')).href + '?export=1';

const browser = await chromium.launch({ args: ['--disable-gpu', '--force-color-profile=srgb'] });

async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('console:', m.text()); });
  await page.goto(url);
  await page.evaluate(async () => { await document.fonts.ready; await window.NOOR.ready; });
  const fonts = await page.evaluate(() => window.NOOR.fontsOk());
  if (fonts.some((f) => !f.endsWith('loaded'))) throw new Error('Fonts not loaded: ' + fonts.join(', '));
  return page;
}
const writePng = (file, dataUrl) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
};

const first = await openPage();
const meta = await first.evaluate(() => ({ FPS: window.NOOR.FPS, FRAMES: window.NOOR.FRAMES, DURATION: window.NOOR.DURATION }));

if (has('--cues') || has('--frames')) {
  const cues = await first.evaluate(() => window.NOOR.cues());
  const f = path.join(ROOT, 'build', 'cues.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(cues, null, 1));
  console.log(`cue sheet -> ${path.relative(ROOT, f)} (${cues.ticks.length} letter ticks, ${cues.counts.length} counts)`);
}

if (has('--cover')) {
  writePng(path.join(ROOT, 'output', 'cover.png'), await first.evaluate((t) => window.NOOR.still(t), COVER_TIME));
  console.log(`cover -> output/cover.png (t = ${COVER_TIME}s)`);
}

const extra = val('--times', '');
const stillTimes = [...(has('--stills') ? STILL_TIMES : []), ...(extra ? extra.split(',').map(Number) : [])];
for (const t of stillTimes) {
  const f = path.join(ROOT, 'build', 'stills', `still_${t.toFixed(1).padStart(4, '0')}s.png`);
  writePng(f, await first.evaluate((tt) => window.NOOR.still(tt), t));
  console.log('still ->', path.relative(ROOT, f));
}

if (has('--frames')) {
  const dir = path.join(ROOT, 'build', 'frames');
  const range = val('--range', '');
  const [from, to] = range ? range.split(',').map(Number) : [0, meta.FRAMES];
  if (!range) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const pages = [first];
  for (let i = 1; i < workers; i++) pages.push(await openPage());
  const t0 = Date.now();
  let next = from, done = 0;
  const total = to - from;
  await Promise.all(pages.map(async (page) => {
    for (;;) {
      const i = next++;
      if (i >= to) return;
      const png = await page.evaluate((k) => window.NOOR.frame(k), i);
      writePng(path.join(dir, `frame_${String(i).padStart(5, '0')}.png`), png);
      if (++done % 90 === 0 || done === total) {
        const s = (Date.now() - t0) / 1000;
        console.log(`frames ${done}/${total}  ${s.toFixed(0)}s elapsed, ~${((s / done) * (total - done)).toFixed(0)}s left`);
      }
    }
  }));
}

await browser.close();
