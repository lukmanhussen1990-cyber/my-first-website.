#!/usr/bin/env node
// Deterministic frame renderer: headless Chrome (WebGL via ANGLE/SwiftShader) -> raw RGBA -> ffmpeg.
//
//   node tools/render.js --stills 1.5,30.2 [--names a,b] [--scale 0.5] [--out frames/stills]
//   node tools/render.js --scenes 1,2,3 [--workers 2]          -> frames/scene_01.mp4 ...
//   node tools/render.js --overlay                              -> frames/overlay/000123.png
//   node tools/render.js --clip 50.0:55.0 --name s6 [--scale 1] -> frames/clip_s6.mp4 (3D + text)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { startServer, ROOT } from './server.js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, []),
);
const SCALE = parseFloat(args.scale || '1');
const FPS = 30;
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/timeline.json'), 'utf8'));
const FRAMES = path.join(ROOT, 'frames');
fs.mkdirSync(FRAMES, { recursive: true });

const GL_VARIANTS = [
  ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  ['--use-gl=angle'],
  ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
];

async function openPage(handler) {
  const server = await startServer(handler);
  const port = server.address().port;
  let lastErr;
  for (const flags of GL_VARIANTS) {
    const browser = await puppeteer.launch({
      executablePath: CHROME, headless: true, protocolTimeout: 0,
      args: ['--no-sandbox', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', ...flags],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(0);
    page.on('console', (m) => { const s = m.text(); if (!/GPU stall|GL Driver Message/.test(s)) console.log('  [page]', s); });
    page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
    await page.goto(`http://127.0.0.1:${port}/src/index.html?scale=${SCALE}${args.lite ? '&lite=1' : ''}`);
    try {
      await page.waitForFunction('window.__ready === true || window.__bootError', { timeout: 180000 });
      const err = await page.evaluate(() => window.__bootError);
      if (err) throw new Error(err);
      return { browser, page, server };
    } catch (e) {
      lastErr = e;
      console.log('  GL variant failed:', flags.join(' '), e.message.split('\n')[0]);
      await browser.close();
    }
  }
  server.close();
  throw lastErr;
}

function ffmpegEncoder(out, W, H) {
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  return {
    write: (buf) => new Promise((res) => { if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res); }),
    close: async () => { ff.stdin.end(); await done; },
  };
}

const fmtTime = (s) => `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`;

async function renderStills() {
  const times = String(args.stills).split(',').map(Number);
  const names = args.names ? String(args.names).split(',') : times.map((t) => `t${t.toFixed(2)}`);
  const out = path.join(ROOT, args.out || 'frames/stills');
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, server } = await openPage(async (url, buf) => {
    if (url.pathname === '/still') fs.writeFileSync(path.join(out, url.searchParams.get('name') + '.png'), buf);
  });
  for (let i = 0; i < times.length; i++) {
    const t0 = Date.now();
    await page.evaluate((t, n, o) => window.renderStill(t, n, o), times[i], names[i], !args.noov);
    console.log(`still ${names[i]} @${times[i]}s  ${(Date.now() - t0) / 1000}s`);
  }
  await browser.close();
  server.close();
}

async function renderScenes() {
  const ids = args.scenes === 'all' ? TL.scenes.map((s) => s.id) : String(args.scenes).split(',').map(Number);
  const queue = ids.map((id) => TL.scenes.find((s) => s.id === id));
  const workers = Math.min(parseInt(args.workers || '2'), queue.length);
  const tStart = Date.now();
  async function worker(w) {
    let enc = null;
    const { browser, page, server } = await openPage(async (url, buf) => { if (url.pathname === '/frame') await enc.write(buf); });
    const { W, H } = await page.evaluate(() => window.SIZE);
    await page.evaluate(() => window.warmup());
    while (queue.length) {
      const sc = queue.shift();
      const f0 = Math.round(sc.start * FPS), f1 = Math.round(sc.end * FPS);
      const tag = String(sc.id).padStart(2, '0');
      const out = path.join(FRAMES, `scene_${tag}${SCALE !== 1 ? '_s' + SCALE : ''}.mp4`);
      enc = ffmpegEncoder(out + '.part.mp4', W, H);
      const t0 = Date.now();
      for (let f = f0; f < f1; f++) {
        await page.evaluate((t) => window.renderFrame(t), f / FPS);
        if ((f - f0) % 30 === 0) {
          const el = (Date.now() - t0) / 1000, per = el / Math.max(1, f - f0);
          console.log(`[w${w}] scene ${tag} frame ${f - f0}/${f1 - f0}  ${per.toFixed(2)}s/f  eta ${fmtTime(per * (f1 - f))}`);
        }
      }
      await enc.close();
      fs.renameSync(out + '.part.mp4', out);
      console.log(`[w${w}] scene ${tag} done in ${fmtTime((Date.now() - t0) / 1000)} -> ${path.relative(ROOT, out)}`);
    }
    await browser.close();
    server.close();
  }
  await Promise.all(Array.from({ length: workers }, (_, w) => worker(w)));
  console.log('all scenes done in', fmtTime((Date.now() - tStart) / 1000));
}

async function renderOverlay() {
  const dir = path.join(FRAMES, 'overlay');
  fs.mkdirSync(dir, { recursive: true });
  const { browser, page, server } = await openPage(async (url, buf) => {
    if (url.pathname === '/overlay') fs.writeFileSync(path.join(dir, String(url.searchParams.get('i')).padStart(6, '0') + '.png'), buf);
  });
  const t0 = Date.now();
  for (let f = 0; f < TL.frames; f++) {
    await page.evaluate((t, i) => window.renderOverlay(t, i), f / FPS, f);
    if (f % 300 === 0) console.log(`overlay ${f}/${TL.frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await browser.close();
  server.close();
  console.log('overlay done');
}

async function renderClip() {
  const [a, b] = String(args.clip).split(':').map(Number);
  const name = args.name || 'clip';
  const out = path.join(FRAMES, `clip_${name}.mp4`);
  const stillsDir = path.join(FRAMES, `clip_${name}_frames`);
  fs.mkdirSync(stillsDir, { recursive: true });
  // render composited stills, then encode (keeps the text layer in the test clip)
  const { browser, page, server } = await openPage(async (url, buf) => {
    if (url.pathname === '/still') fs.writeFileSync(path.join(stillsDir, url.searchParams.get('name') + '.png'), buf);
  });
  const f0 = Math.round(a * FPS), f1 = Math.round(b * FPS);
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate((t, n) => window.renderStill(t, n, true), f / FPS, String(f - f0).padStart(5, '0'));
    if ((f - f0) % 15 === 0) console.log(`clip ${name} ${f - f0}/${f1 - f0}  ${((Date.now() - t0) / 1000 / Math.max(1, f - f0)).toFixed(2)}s/f`);
  }
  await browser.close();
  server.close();
  await new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(stillsDir, '%05d.png'),
      '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', out], { stdio: 'inherit' });
    ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  });
  console.log('clip ->', path.relative(ROOT, out));
}

// low-res composited preview: --preview [--fps 15] [--workers 3] [--scale 0.333] -> frames/preview.mp4 (silent)
async function renderPreview() {
  const fps = parseInt(args.fps || '15');
  const total = Math.floor(TL.duration * fps);
  const workers = parseInt(args.workers || '3');
  const chunk = Math.ceil(total / workers);
  const tStart = Date.now();
  const parts = [];
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const f0 = w * chunk, f1 = Math.min(total, f0 + chunk);
    let enc = null;
    const { browser, page, server } = await openPage(async (url, buf) => { if (url.pathname === '/frame') await enc.write(buf); });
    const { W, H } = await page.evaluate(() => window.SIZE);
    const out = path.join(FRAMES, `preview_part${w}.mp4`);
    parts[w] = out;
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
    enc = { write: (buf) => new Promise((res) => { if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res); }) };
    const t0 = Date.now();
    for (let f = f0; f < f1; f++) {
      await page.evaluate((t) => window.renderComposite(t), f / fps);
      if ((f - f0) % 60 === 0) console.log(`[w${w}] ${f - f0}/${f1 - f0}  ${((Date.now() - t0) / 1000 / Math.max(1, f - f0)).toFixed(2)}s/f`);
    }
    ff.stdin.end();
    await done;
    await browser.close();
    server.close();
  }));
  const list = path.join(FRAMES, 'preview_list.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  await new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(FRAMES, 'preview.mp4')], { stdio: 'inherit' });
    ff.on('close', (c) => (c === 0 ? res() : rej(new Error('concat ' + c))));
  });
  console.log('preview done in', fmtTime((Date.now() - tStart) / 1000));
}

async function renderDebug() {
  // --debug "t;name;x,y,z;tx,ty,tz;fov|..."
  const out = path.join(ROOT, args.out || 'frames/debug');
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, server } = await openPage(async (url, buf) => {
    if (url.pathname === '/still') fs.writeFileSync(path.join(out, url.searchParams.get('name') + '.png'), buf);
  });
  for (const spec of String(args.debug).split('|')) {
    const [t, name, p, q, fov] = spec.split(';');
    await page.evaluate((t, n, p, q, f) => window.debugStill(t, n, p, q, f), +t, name, p.split(',').map(Number), q.split(',').map(Number), +(fov || 35));
    console.log('debug', name);
  }
  await browser.close();
  server.close();
}

const main = args.preview ? renderPreview : args.debug ? renderDebug : args.stills ? renderStills : args.scenes ? renderScenes : args.overlay ? renderOverlay : args.clip ? renderClip : null;
if (!main) {
  console.log('usage: --stills t1,t2 | --scenes 1,2|all | --overlay | --clip a:b');
  process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
