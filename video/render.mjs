/**
 * Renders scene.html frame by frame and pipes the frames straight into ffmpeg,
 * muxing build/audio.wav to produce the final MP4.
 *
 * Frames are never written to disk (a 4K PNG sequence would be several GB).
 *
 *   node render.mjs                          # full 4K encode
 *   node render.mjs --width 1920 --height 1080 --out build/preview.mp4
 *   node render.mjs --preview 0,300,830      # stills only, into build/preview/
 */

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(HERE, 'build');
const FFMPEG = process.env.FFMPEG
  || '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : fallback;
};

const timeline = JSON.parse(fs.readFileSync(path.join(HERE, 'timeline.json'), 'utf8'));
timeline.width = parseInt(arg('width', timeline.width), 10);
timeline.height = parseInt(arg('height', timeline.height), 10);

const previewArg = arg('preview', null);
const previewFrames = previewArg ? previewArg.split(',').map(Number) : null;
const outFile = path.resolve(HERE, arg('out', 'build/2plus2.mp4'));
const audioFile = path.join(BUILD, 'audio.wav');

const total = Math.round(timeline.duration * timeline.fps);
const frames = previewFrames || Array.from({ length: total }, (_, i) => i);

fs.mkdirSync(BUILD, { recursive: true });

/* ------------------------------------------------------------------ encoder */

let ffmpeg = null;
let previewDir = null;

if (previewFrames) {
  previewDir = path.join(BUILD, 'preview');
  fs.mkdirSync(previewDir, { recursive: true });
} else {
  if (!fs.existsSync(audioFile)) {
    console.error(`missing ${audioFile} — run: python3 music.py`);
    process.exit(1);
  }
  const args = [
    '-y',
    '-f', 'image2pipe', '-framerate', String(timeline.fps), '-i', 'pipe:0',
    '-i', audioFile,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '17',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'high',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-x264-params', 'keyint=60:min-keyint=30:scenecut=0',
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart',
    '-shortest',
    outFile,
  ];
  ffmpeg = spawn(FFMPEG, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffErr = '';
  ffmpeg.stderr.on('data', (d) => { ffErr += d.toString(); if (ffErr.length > 40000) ffErr = ffErr.slice(-20000); });
  ffmpeg.on('exit', (code) => {
    if (code !== 0) { console.error('ffmpeg failed:\n' + ffErr.slice(-4000)); process.exitCode = 1; }
  });
  ffmpeg.stdin.on('error', () => {});   // ffmpeg may close early on failure
}

// one persistent handler rather than one per frame, which would leak listeners
const write = (buf) => new Promise((resolve) => {
  if (ffmpeg.stdin.write(buf)) resolve();
  else ffmpeg.stdin.once('drain', resolve);
});

/* -------------------------------------------------------------------- render */

const browser = await chromium.launch({
  args: ['--force-color-profile=srgb', '--disable-lcd-text', '--hide-scrollbars'],
});
const page = await browser.newPage({
  viewport: { width: timeline.width, height: timeline.height },
  deviceScaleFactor: 1,
});

let failed = false;
page.on('pageerror', (e) => { console.error('PAGE ERROR:', e.message); failed = true; });
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });

await page.addInitScript((tl) => { window.__TIMELINE__ = tl; }, timeline);
await page.goto(pathToFileURL(path.join(HERE, 'scene.html')).href, { waitUntil: 'load' });
await page.evaluate(() => window.__ready);
if (failed) { await browser.close(); process.exit(1); }

const el = await page.$('#stage');
const t0 = Date.now();

for (let i = 0; i < frames.length; i++) {
  const f = frames[i];
  await page.evaluate((n) => window.renderFrame(n), f);

  if (previewDir) {
    await el.screenshot({ path: path.join(previewDir, String(f).padStart(5, '0') + '.png') });
  } else {
    await write(await el.screenshot({ type: 'png' }));
  }

  if (i % 30 === 0 || i === frames.length - 1) {
    const done = i + 1;
    const rate = done / ((Date.now() - t0) / 1000);
    console.log(
      `frame ${done}/${frames.length}  ${rate.toFixed(2)} fps  ` +
      `eta ${(((frames.length - done) / rate) / 60).toFixed(1)} min`
    );
  }
}

await browser.close();

if (ffmpeg) {
  ffmpeg.stdin.end();
  const code = await new Promise((r) => ffmpeg.on('close', r));
  if (code !== 0) process.exit(1);
  const mb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
  console.log(`\nwrote ${outFile}  (${mb} MB)`);
}
console.log(`total ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`);
