#!/usr/bin/env node
// Frame-by-frame renderer: serves reel-studio over HTTP, drives the player page
// in headless Chromium (Playwright), captures every frame and encodes with ffmpeg.
//
//   node engine/render.mjs --project snail-disco-eyes --vo vo_el --timeline
//   node engine/render.mjs --project snail-disco-eyes --vo vo_el --stills 0.5,3.2 --outdir build/stills
//   node engine/render.mjs --project snail-disco-eyes --vo vo_el --video build/video.mp4 [--workers 3] [--from 0 --to 300]
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const project = args.project || 'snail-disco-eyes';
const vo = args.vo || 'vo';
const PDIR = path.join(ROOT, 'projects', project);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.css': 'text/css' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, resp) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const fp = path.join(ROOT, path.normalize(u).replace(/^(\.\.[/\\])+/, ''));
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { resp.writeHead(404); resp.end(); return; }
      resp.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(fp).pipe(resp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/engine/player.html?project=${project}&vo=${vo}`);
  await page.waitForFunction(() => window.READY || window.BOOT_ERROR, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.BOOT_ERROR);
  if (err) throw new Error('boot failed: ' + err);
  return page;
}

async function grab(page, frame) {
  await page.evaluate((f) => window.renderFrame(f), frame);
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 } });
}

// Raw RGBA straight from the canvas (no PNG encode): ~8x faster than a screenshot.
const OUT_W = Math.round(1080 * Number(args.scale || 1) / 2) * 2;
const OUT_H = Math.round(1920 * Number(args.scale || 1) / 2) * 2;

async function grabRaw(page, frame) {
  const b64 = await page.evaluate(([f, w, h]) => {
    window.renderFrame(f);
    let src = document.getElementById('c');
    if (w !== 1080) {
      // downscaled preview: resample in the page so far less data crosses over
      if (!window.__small) { window.__small = document.createElement('canvas'); window.__small.width = w; window.__small.height = h; }
      const sc = window.__small.getContext('2d', { willReadFrequently: true });
      sc.imageSmoothingQuality = 'high';
      sc.drawImage(src, 0, 0, w, h);
      src = window.__small;
    }
    const d = src.getContext('2d').getImageData(0, 0, w, h).data;
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH));
    return btoa(s);
  }, [frame, OUT_W, OUT_H]);
  return Buffer.from(b64, 'base64');
}

function ffmpegChunk(out) {
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${OUT_W}x${OUT_H}`, '-framerate', '30', '-i', '-',
    '-c:v', 'libx264', '-preset', args.preset || 'medium', '-crf', String(args.crf || 16), '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-g', '60', '-r', '30', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-vf', 'scale=out_color_matrix=bt709', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  return ff;
}

async function main() {
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
  try {
    const page = await openPage(browser, port);
    const tl = await page.evaluate(() => window.TIMELINE);
    fs.mkdirSync(path.join(PDIR, 'build'), { recursive: true });
    fs.writeFileSync(path.join(PDIR, 'build', `timeline_${vo}.json`), JSON.stringify(tl, null, 1));
    console.log(`timeline: ${tl.duration.toFixed(2)}s, ${tl.frames} frames, ${tl.scenes.length} scenes, ${tl.sounds.length} sounds`);
    if (tl.warnings.length) console.log('WARNINGS:\n  ' + tl.warnings.join('\n  '));

    if (args.stills) {
      const outdir = path.resolve(PDIR, args.outdir || 'build/stills');
      fs.mkdirSync(outdir, { recursive: true });
      const times = String(args.stills).split(',').map(Number);
      for (const t of times) {
        const f = Math.round(t * 30);
        const png = await grab(page, f);
        fs.writeFileSync(path.join(outdir, `t${t.toFixed(2).padStart(7, '0')}.png`), png);
      }
      console.log(`wrote ${times.length} stills to ${outdir}`);
    }

    if (args.video) {
      const from = Number(args.from || 0), to = Math.min(Number(args.to || tl.frames), tl.frames);
      const workers = Math.max(1, Number(args.workers || 3));
      const out = path.resolve(PDIR, args.video);
      // one chunk folder per output file, so two renders never write the same chunk
      const tmp = path.join(PDIR, 'build', 'chunks_' + path.basename(out, path.extname(out))); fs.mkdirSync(tmp, { recursive: true });
      const per = Math.ceil((to - from) / workers);
      const t0 = Date.now();
      let done = 0;
      const jobs = [];
      for (let w = 0; w < workers; w++) {
        const a = from + w * per, b = Math.min(to, a + per);
        if (a >= b) continue;
        jobs.push((async () => {
          const pg = w === 0 ? page : await openPage(browser, port);
          const chunk = path.join(tmp, `chunk_${String(w).padStart(2, '0')}.mp4`);
          const ff = ffmpegChunk(chunk);
          for (let f = a; f < b; f++) {
            const raw = await grabRaw(pg, f);
            if (!ff.stdin.write(raw)) await new Promise((r) => ff.stdin.once('drain', r));
            done++;
            if (done % 150 === 0) {
              const el = (Date.now() - t0) / 1000;
              console.log(`  ${done}/${to - from} frames  ${(done / el).toFixed(1)} fps  eta ${((to - from - done) / (done / el)).toFixed(0)}s`);
            }
          }
          ff.stdin.end();
          await new Promise((r) => ff.on('close', r));
          return chunk;
        })());
      }
      const chunks = await Promise.all(jobs);
      const list = path.join(tmp, 'list.txt');
      fs.writeFileSync(list, chunks.map((c) => `file '${c}'`).join('\n'));
      await new Promise((r, j) => spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'inherit' })
        .on('close', (code) => (code === 0 ? r() : j(new Error('concat failed')))));
      console.log(`video: ${out}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  } finally {
    await browser.close();
    srv.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
