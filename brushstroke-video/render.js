#!/usr/bin/env node
/* render.js - exports the canvas animation to an MP4 with no audio track.

   Usage:
     node render.js                       -> output/brushstroke-lyrics.mp4
     node render.js --out my.mp4          -> custom output path
     node render.js --frames frames/      -> PNG sequence instead of MP4
     node render.js --stills 1,3.5,11.6   -> a few PNG stills (for checking)
     node render.js --workers 4           -> parallel browser pages

   Needs Playwright (npm install) and ffmpeg on PATH, or set FFMPEG=/path/to/ffmpeg. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  console.error('Playwright is not installed. Run `npm install` in this folder first.');
  process.exit(1);
}

function parseArgs(argv) {
  const a = { out: path.join(__dirname, 'output', 'brushstroke-lyrics.mp4'), workers: 3 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--out') (a.out = path.resolve(v)), i++;
    else if (k === '--frames') (a.frames = path.resolve(v)), i++;
    else if (k === '--stills') (a.stills = v.split(',').map(Number)), i++;
    else if (k === '--workers') (a.workers = Math.max(1, parseInt(v, 10))), i++;
    else if (k === '--stills-dir') (a.stillsDir = path.resolve(v)), i++;
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const browser = await chromium.launch();
  const url = pathToFileURL(path.join(__dirname, 'index.html')).href + '?render';

  async function openPage() {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    page.on('pageerror', (err) => console.error('page error:', err.message));
    await page.goto(url);
    await page.waitForFunction(() => window.BV && window.BV.ready, null, { timeout: 60000 });
    return page;
  }
  const grab = async (page, t) => {
    const dataUrl = await page.evaluate((tt) => window.BV.renderFrame(tt), t);
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  };

  const first = await openPage();
  const { fps, duration } = await first.evaluate(() => ({ fps: BV.config.fps, duration: BV.config.duration }));

  if (args.stills) {
    const dir = args.stillsDir || path.join(__dirname, 'output', 'stills');
    fs.mkdirSync(dir, { recursive: true });
    for (const t of args.stills) {
      const file = path.join(dir, `still_${t.toFixed(2)}.png`);
      fs.writeFileSync(file, await grab(first, t));
      console.log('wrote', file);
    }
    await browser.close();
    return;
  }

  const total = Math.round(duration * fps);
  const pages = [first];
  while (pages.length < args.workers) pages.push(await openPage());

  let sink;
  let ff = null;
  if (args.frames) {
    fs.mkdirSync(args.frames, { recursive: true });
    sink = async (i, buf) => fs.promises.writeFile(path.join(args.frames, `frame_${String(i).padStart(5, '0')}.png`), buf);
  } else {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    const bin = process.env.FFMPEG || 'ffmpeg';
    ff = spawn(bin, [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
      '-an', // no audio track
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      '-movflags', '+faststart', args.out,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    ff.on('error', (e) => {
      console.error(`Could not start ffmpeg (${bin}): ${e.message}. Install ffmpeg or set FFMPEG=/path/to/ffmpeg.`);
      process.exit(1);
    });
    sink = (i, buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res)));
  }

  // Workers render frames out of order; frames are written strictly in order.
  const done = new Map();
  let next = 0; // next frame to hand out
  let written = 0; // next frame to write
  const started = Date.now();
  let flushing = Promise.resolve();
  function flush() {
    flushing = flushing.then(async () => {
      while (done.has(written)) {
        const buf = done.get(written);
        done.delete(written);
        await sink(written, buf);
        written++;
        if (written % 30 === 0 || written === total) {
          const el = (Date.now() - started) / 1000;
          process.stdout.write(`\rframe ${written}/${total}  ${(written / el).toFixed(1)} fps  eta ${Math.round(((total - written) * el) / written)}s   `);
        }
      }
    });
    return flushing;
  }
  async function worker(page) {
    while (next < total) {
      if (next - written > 90) {
        await new Promise((r) => setTimeout(r, 10));
        continue;
      }
      const i = next++;
      done.set(i, await grab(page, i / fps));
      flush();
    }
  }
  await Promise.all(pages.map(worker));
  await flush();
  process.stdout.write('\n');
  await browser.close();
  if (ff) {
    ff.stdin.end();
    await new Promise((res) => ff.on('close', res));
    console.log('wrote', args.out);
  } else {
    console.log('wrote', total, 'frames to', args.frames);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
