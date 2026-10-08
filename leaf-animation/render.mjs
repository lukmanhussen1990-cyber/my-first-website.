// Renders leaf.html to an MP4 by stepping its deterministic render(t) in headless Chromium.
//
//   node render.mjs                      -> leaf-animated.mp4 (1920x1080, 60 fps)
//   node render.mjs --preview out/ 1.2 3  -> PNG snapshots at the given times (seconds)
//
// Requires playwright + a Chromium build, and ffmpeg on PATH.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const WIDTH = 1920, HEIGHT = 1080, FPS = 60;
const args = process.argv.slice(2);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve(here, 'leaf.html')).href + '?render=1');
await page.waitForFunction(() => window.READY === true);
const duration = await page.evaluate(() => window.DURATION);

const frameAt = async t => {
  await page.evaluate(t => window.render(t), t);
  return page.screenshot({ type: 'png', animations: 'disabled', caret: 'hide' });
};

if (args[0] === '--preview') {
  const outDir = resolve(args[1] ?? 'preview');
  await mkdir(outDir, { recursive: true });
  for (const s of args.slice(2)) {
    const t = Number(s);
    await writeFile(resolve(outDir, `t${t.toFixed(2)}.png`), await frameAt(t));
    console.log(`wrote t=${t}`);
  }
} else {
  const out = resolve(args[0] ?? resolve(here, 'leaf-animated.mp4'));
  const total = Math.round(duration * FPS);
  const ff = spawn('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const png = await frameAt(i / FPS);
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`frame ${i}/${total}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  ff.stdin.end();
  await done;
  console.log(`wrote ${out}  (${total} frames, ${duration}s @ ${FPS}fps)`);
}
await browser.close();
