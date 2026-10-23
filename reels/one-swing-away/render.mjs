#!/usr/bin/env node
/**
 * Renders reel.html frame-by-frame in headless Chromium (Playwright) and stitches the
 * frames + the synthesized SFX track into an MP4 with ffmpeg.
 *
 *   node render.mjs --sheet             contact sheet, 1 frame per second -> contact-sheet.png
 *   node render.mjs --sheet --times 1.35,8.2,11.3 --name beats   sheet of chosen moments -> beats.png
 *   node render.mjs                     full render -> out/one-swing-away.mp4 (H.264 + AAC SFX)
 *   node render.mjs --frames 0,45,300   debug: only these frame numbers -> frames/
 *   node render.mjs --audio-only        just the synthesized SFX track -> out/one-swing-away.wav
 *
 * Options: --workers 4  --out out/name.mp4  --no-audio  --keep-frames  --guides
 */
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const has = name => argv.includes(`--${name}`);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* fall back to a global install */ }
  const root = execSync('npm root -g').toString().trim();
  return import(pathToFileURL(path.join(root, 'playwright', 'index.mjs')).href);
}

const { chromium } = await loadPlaywright();
const url = pathToFileURL(path.join(HERE, 'reel.html')).href + (has('guides') ? '?render&guides' : '?render');
const browser = await chromium.launch();

async function openPage() {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', e => { console.error('\nPAGE ERROR:', e.message); process.exitCode = 1; });
  page.on('console', m => { if (m.type() === 'error') console.error('\nconsole:', m.text()); });
  await page.goto(url);
  await page.evaluate(() => window.REEL.ready);
  return page;
}

const grab = (page, t) => page.evaluate(t => {
  window.REEL.renderFrame(t);
  return document.getElementById('reel').toDataURL('image/png').split(',')[1];
}, t);

const first = await openPage();
const { fps, duration } = await first.evaluate(() => window.REEL.CONFIG.video);
const total = Math.round(fps * duration);
const framesDir = path.join(HERE, 'frames');
const writeFrame = (i, b64) => fs.writeFileSync(path.join(framesDir, `f_${String(i).padStart(5, '0')}.png`), Buffer.from(b64, 'base64'));

if (has('sheet')) {
  // ---------------- contact sheet: one frame per second in a grid
  const times = opt('times') ? opt('times').split(',').map(Number) : null;
  const b64 = await first.evaluate(times => {
    const { CONFIG, renderFrame } = window.REEL;
    const ts = times || Array.from({ length: Math.floor(CONFIG.video.duration) }, (_, i) => i);
    const n = ts.length, cols = 4, rows = Math.ceil(n / cols);
    const cw = 360, ch = 640, gap = 14, lab = 44;
    const sheet = document.createElement('canvas');
    sheet.width = cols * cw + (cols + 1) * gap;
    sheet.height = rows * (ch + lab) + (rows + 1) * gap;
    const s = sheet.getContext('2d'), src = document.getElementById('reel');
    s.fillStyle = '#101010'; s.fillRect(0, 0, sheet.width, sheet.height);
    for (let i = 0; i < n; i++) {
      renderFrame(ts[i]);
      const x = gap + (i % cols) * (cw + gap), y = gap + Math.floor(i / cols) * (ch + lab + gap);
      s.drawImage(src, x, y, cw, ch);
      s.fillStyle = '#d8d8d8'; s.font = `600 22px ${CONFIG.font}`; s.letterSpacing = '3px';
      s.fillText(`${ts[i].toFixed(2)}s`, x + 4, y + ch + 31);
    }
    return sheet.toDataURL('image/png').split(',')[1];
  }, times);
  const out = path.join(HERE, `${opt('name', 'contact-sheet')}${has('guides') ? '-guides' : ''}.png`);
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log('contact sheet ->', path.relative(process.cwd(), out));
} else if (has('audio-only')) {
  const wavPath = path.resolve(HERE, opt('out', 'out/one-swing-away.mp4')).replace(/\.mp4$/, '.wav');
  fs.mkdirSync(path.dirname(wavPath), { recursive: true });
  fs.writeFileSync(wavPath, Buffer.from(await first.evaluate(() => window.REEL.renderAudioWav()), 'base64'));
  console.log('audio ->', path.relative(process.cwd(), wavPath));
} else if (opt('frames')) {
  // ---------------- debug: selected frames only
  fs.mkdirSync(framesDir, { recursive: true });
  for (const i of opt('frames').split(',').map(Number)) { writeFrame(i, await grab(first, i / fps)); console.log('frame', i); }
} else {
  // ---------------- full render
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const workers = Math.max(1, +opt('workers', 4));
  const pages = [first, ...await Promise.all(Array.from({ length: workers - 1 }, openPage))];
  const t0 = Date.now();
  let done = 0;
  await Promise.all(pages.map(async (page, w) => {
    for (let i = w; i < total; i += workers) {
      writeFrame(i, await grab(page, i / fps));
      if (++done % 15 === 0 || done === total) process.stdout.write(`\r  frames ${done}/${total}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }));
  console.log();

  const outPath = path.resolve(HERE, opt('out', 'out/one-swing-away.mp4'));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  let wavPath = null;
  if (!has('no-audio') && await first.evaluate(() => typeof window.REEL.renderAudioWav === 'function')) {
    wavPath = outPath.replace(/\.mp4$/, '.wav');
    fs.writeFileSync(wavPath, Buffer.from(await first.evaluate(() => window.REEL.renderAudioWav()), 'base64'));
    console.log('  audio ->', path.relative(process.cwd(), wavPath));
  }
  const ff = ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(framesDir, 'f_%05d.png')];
  if (wavPath) ff.push('-i', wavPath);
  ff.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-r', String(fps));
  ff.push(...(wavPath ? ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest'] : ['-an']));
  ff.push('-movflags', '+faststart', outPath);
  execFileSync('ffmpeg', ff, { stdio: 'inherit' });
  console.log('video ->', path.relative(process.cwd(), outPath));
  if (!has('keep-frames')) fs.rmSync(framesDir, { recursive: true, force: true });
}

await browser.close();
