#!/usr/bin/env node
/* Steps the animation frame by frame in headless Chromium, writes PNGs,
   then encodes them with ffmpeg.

   Usage:  node tools/render.mjs [outfile.mp4]                            */

import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? path.join(root, 'dist', 'animation.mp4'));
const frameDir = path.join(root, '.frames');

const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';

await rm(frameDir, { recursive: true, force: true });
await mkdir(frameDir, { recursive: true });
await mkdir(path.dirname(out), { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--force-device-scale-factor=1', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?record=1');
await page.waitForFunction(() => typeof window.ANIM !== 'undefined');

const { TOTAL_FRAMES, OUT_FPS } = await page.evaluate(() => ({
  TOTAL_FRAMES: window.ANIM.TOTAL_FRAMES,
  OUT_FPS: window.ANIM.OUT_FPS,
}));

process.stdout.write(`rendering ${TOTAL_FRAMES} frames at ${OUT_FPS} fps\n`);

for (let i = 0; i < TOTAL_FRAMES; i++) {
  const dataUrl = await page.evaluate((n) => {
    window.renderFrame(n);
    return document.getElementById('stage').toDataURL('image/png');
  }, i);
  const png = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
  await writeFile(path.join(frameDir, `f_${String(i).padStart(4, '0')}.png`), png);
  if ((i + 1) % 24 === 0) process.stdout.write(`  ${i + 1}/${TOTAL_FRAMES}\n`);
}

await browser.close();

await run(ffmpeg, [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-framerate', String(OUT_FPS),
  '-i', path.join(frameDir, 'f_%04d.png'),
  '-c:v', 'libx264',
  '-profile:v', 'high',
  '-pix_fmt', 'yuv420p',
  '-crf', '17',
  '-movflags', '+faststart',
  out,
]);

// A GIF too, for places that will not play video.
await run(ffmpeg, [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-framerate', String(OUT_FPS),
  '-i', path.join(frameDir, 'f_%04d.png'),
  '-vf', 'fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none',
  '-loop', '0',
  out.replace(/\.mp4$/, '.gif'),
]);

await rm(frameDir, { recursive: true, force: true });
process.stdout.write(`wrote ${out}\n`);
