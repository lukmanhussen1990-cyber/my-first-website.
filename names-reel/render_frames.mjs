#!/usr/bin/env node
// Renders reel.html in headless Chromium (Playwright).
//
//   node render_frames.mjs --frames build/frames [--workers 4] [--from 0] [--to 1800]
//        renders frame i = render(i / 30) for every frame and saves build/frames/f_0000.png ...
//   node render_frames.mjs --stills 2,6,15,30,42,52,58 --out output/stills
//        renders single PNG stills at the given times (seconds)
//   node render_frames.mjs --cover output/cover.png [--cover-time 0]
//   node render_frames.mjs --cues build/cues.json
//        writes the audio cue sheet (every sound is timed from the same timeline as the picture)
//
//   --page "My Page"   overrides the page name drawn at the top (default: NoorToon)
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30, TOTAL = 1800;

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2), v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    a[k] = v;
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));
let url = pathToFileURL(path.join(here, 'reel.html')).href + '?export=1';
if (args.page) url += '&page=' + encodeURIComponent(args.page);

const LAUNCH = { args: ['--disable-gpu', '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] };

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page error]', e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text()); });
  await page.goto(url);
  await page.evaluate(() => window.reelReady);            // fonts loaded + caches built
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => window.fontStatus());
  if (fonts.some(f => !f.endsWith('loaded'))) throw new Error('Fonts not loaded: ' + fonts.join(' | '));
  return page;
}

function writeDataURL(file, dataURL) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(dataURL.slice(dataURL.indexOf(',') + 1), 'base64'));
}

async function renderFrames(dir, from, to, workers) {
  fs.mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  let done = 0;
  const total = to - from;
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const browser = await chromium.launch(LAUNCH);
    const page = await openPage(browser);
    for (let i = from + w; i < to; i += workers) {         // interleaved: balances heavy and light scenes
      const d = await page.evaluate(i => window.renderFramePNG(i), i);
      writeDataURL(path.join(dir, `f_${String(i).padStart(4, '0')}.png`), d);
      if (++done % 60 === 0 || done === total) {
        const s = (Date.now() - t0) / 1000;
        process.stdout.write(`  frames ${done}/${total}  ${s.toFixed(0)} s  (eta ${((total - done) * s / done).toFixed(0)} s)\n`);
      }
    }
    await browser.close();
  }));
}

const browser = args.frames ? null : await chromium.launch(LAUNCH);
const page = browser ? await openPage(browser) : null;

if (args.cues) {
  const cues = await page.evaluate(() => window.getCues());
  fs.mkdirSync(path.dirname(args.cues), { recursive: true });
  fs.writeFileSync(args.cues, JSON.stringify(cues, null, 1));
  console.log(`cues -> ${args.cues} (${cues.ticks.length} ticks, ${cues.events.length} events)`);
}
if (args.stills) {
  const out = args.out || 'output/stills';
  for (const s of String(args.stills).split(',')) {
    const t = +s;
    const d = await page.evaluate(t => { window.render(t); return document.getElementById('reel').toDataURL('image/png'); }, t);
    const name = `still_${String(t.toFixed(2)).replace('.', '_')}s.png`;
    writeDataURL(path.join(out, name), d);
    console.log(`still t=${t}s -> ${path.join(out, name)}`);
  }
}
if (args.cover) {
  const t = +(args['cover-time'] || 0);
  const d = await page.evaluate(t => { window.render(t); return document.getElementById('reel').toDataURL('image/png'); }, t);
  writeDataURL(args.cover, d);
  console.log(`cover (t=${t}s) -> ${args.cover}`);
}
if (browser) await browser.close();

if (args.frames) {
  const from = +(args.from || 0), to = +(args.to || TOTAL), workers = +(args.workers || 4);
  console.log(`rendering frames ${from}..${to - 1} with ${workers} workers -> ${args.frames}`);
  await renderFrames(args.frames, from, to, workers);
}
