/**
 * Renders index.html frame-by-frame with headless Chromium and encodes an MP4.
 *
 *   cd tools && npm install && npm run render
 *
 * Output: video/imran-butterflies.mp4  (1920x1080, 30 fps, 5 s)
 */
import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const pageUrl = pathToFileURL(resolve(root, 'index.html')).href + '?capture=1';
const framesDir = resolve(root, '.frames');
const outDir = resolve(root, 'video');
const outFile = resolve(outDir, 'imran-butterflies.mp4');

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

// PLAYWRIGHT_CHROMIUM allows pointing at a pre-installed Chromium build.
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  args: ['--force-color-profile=srgb', '--disable-lcd-text', '--hide-scrollbars'],
});
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
await page.goto(pageUrl);
await page.waitForFunction('window.__ready === true');

const total = await page.evaluate('window.__TOTAL_FRAMES');
console.log(`rendering ${total} frames…`);

for (let i = 0; i < total; i++) {
  const dataUrl = await page.evaluate((n) => {
    window.__renderFrame(n);
    return document.getElementById('c').toDataURL('image/png');
  }, i);
  writeFileSync(
    resolve(framesDir, `f${String(i).padStart(4, '0')}.png`),
    Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64'),
  );
  if (i % 15 === 0) process.stdout.write(`  ${i}/${total}\r`);
}
await browser.close();
console.log(`\nencoding…`);

const res = spawnSync(ffmpegPath, [
  '-y',
  '-framerate', '30',
  '-i', resolve(framesDir, 'f%04d.png'),
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '17',
  '-pix_fmt', 'yuv420p',
  '-profile:v', 'high',
  '-level', '4.1',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-movflags', '+faststart',
  '-r', '30',
  outFile,
], { stdio: 'inherit' });

if (res.status !== 0) process.exit(res.status ?? 1);
rmSync(framesDir, { recursive: true, force: true });
console.log(`done -> ${outFile}`);
