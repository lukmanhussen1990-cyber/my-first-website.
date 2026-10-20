#!/usr/bin/env node
// Frame-by-frame renderer driver.
//   node render/render.mjs stills --times 3.2,9.5 [--w 540 --h 960] [--samples 4] [--out build/stills]
//   node render/render.mjs frames [--start 0 --end 1665] [--chunk 45] [--workers 1]   (resumable)
//   node render/render.mjs concat                                                       -> build/clean.mp4
// Chromium runs WebGL2 on Mesa llvmpipe (software GL, all CPU cores). Every frame is
// rendered (no screen capture) and streamed as raw RGBA into ffmpeg.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mode = args[0] || 'stills';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +opt('w', 1080), H = +opt('h', 1920);
const OUT = path.resolve(ROOT, opt('out', mode === 'stills' ? 'build/stills' : 'build/chunks'));
fs.mkdirSync(OUT, { recursive: true });

const pwPath = fs.existsSync('/opt/node22/lib/node_modules/playwright/index.mjs')
  ? '/opt/node22/lib/node_modules/playwright/index.mjs' : 'playwright';
const { chromium } = await import(pwPath);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const sinks = new Map(); // token -> async (buf, query) => void

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      if (req.method === 'POST' && u.pathname.startsWith('/sink/')) {
        const token = u.pathname.slice(6);
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', async () => {
          try {
            const sink = sinks.get(token);
            if (!sink) throw new Error('no sink ' + token);
            await sink(Buffer.concat(chunks), u.searchParams);
            res.writeHead(200); res.end('ok');
          } catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
        });
        return;
      }
      const fp = path.join(ROOT, decodeURIComponent(u.pathname));
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function openPage(port) {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist', '--disable-gpu-watchdog',
      '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--js-flags=--max-old-space-size=6144'],
  });
  const page = await browser.newPage({ viewport: { width: Math.min(W, 1080), height: Math.min(H, 1920) } });
  page.on('console', (m) => { const t = m.text(); if (!/GPU stall|GL Driver Message/.test(t)) console.log('[page]', t); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/render/index.html?w=${W}&h=${H}${opt('q') ? '&' + opt('q') : ''}`);
  await page.waitForFunction('window.R_READY === true', null, { timeout: 120000 });
  const t0 = Date.now();
  const info = await page.evaluate(() => window.R.init());
  console.log(`[init] ${JSON.stringify(info)} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { browser, page, info };
}

function ffmpegRawToFile(outFile, extraOut) {
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', '30', '-i', '-',
    '-vf', 'vflip', ...extraOut, outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  const write = (buf) => new Promise((res, rej) => { ff.stdin.write(buf, (e) => (e ? rej(e) : res())); });
  return { ff, done, write, end: () => { ff.stdin.end(); return done; } };
}

const srv = await startServer();
const port = srv.address().port;

if (mode === 'stills') {
  const times = opt('times', '2').split(',').map(Number);
  const samples = opt('samples') ? +opt('samples') : undefined;
  const cam = opt('cam') ? JSON.parse(opt('cam')) : undefined;
  const tag = opt('tag', '');
  const { browser, page } = await openPage(port);
  for (const t of times) {
    const name = path.join(OUT, `still_${t.toFixed(2).padStart(6, '0')}${tag}.png`);
    const token = 'still' + Math.random().toString(36).slice(2);
    sinks.set(token, async (buf) => { const f = ffmpegRawToFile(name, ['-frames:v', '1']); await f.write(buf); await f.end(); });
    const r = await page.evaluate(([t, url, samples, cam]) => window.R.renderStill(t, url, { ...(samples ? { samples } : {}), ...(cam ? { cam } : {}) }), [t, `/sink/${token}`, samples, cam]);
    console.log(`[still] t=${t} -> ${path.relative(ROOT, name)} ${JSON.stringify(r)}`);
  }
  await browser.close();
} else if (mode === 'frames') {
  const total = Math.round(JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json'))).duration * 30);
  const start = +opt('start', 0), end = Math.min(+opt('end', total), total);
  const chunk = +opt('chunk', 45);
  const workers = +opt('workers', 1);
  const queue = [];
  for (let a = start; a < end; a += chunk) {
    const b = Math.min(a + chunk, end);
    const file = path.join(OUT, `chunk_${String(a).padStart(5, '0')}_${String(b).padStart(5, '0')}.mkv`);
    if (!fs.existsSync(file)) queue.push({ a, b, file });
  }
  console.log(`[frames] ${queue.length} chunks to render (${start}-${end}), ${workers} worker(s)`);
  const tStart = Date.now();
  let framesDone = 0; const framesTotal = queue.reduce((s, q) => s + q.b - q.a, 0);
  async function worker(id) {
    const { browser, page } = await openPage(port);
    while (queue.length) {
      const job = queue.shift();
      const part = job.file + '.part.mkv';
      const enc = ffmpegRawToFile(part, ['-c:v', 'libx264', '-preset', 'medium', '-crf', '8', '-pix_fmt', 'yuv444p', '-g', '30']);
      const token = `w${id}c${job.a}`;
      let expect = job.a;
      sinks.set(token, async (buf, q) => {
        const i = +q.get('i');
        if (i !== expect) throw new Error(`frame order ${i} != ${expect}`);
        expect++;
        await enc.write(buf);
      });
      const t0 = Date.now();
      const stats = await page.evaluate(([a, b, url]) => window.R.renderFrames(a, b, url), [job.a, job.b, `/sink/${token}`]);
      await enc.end();
      fs.renameSync(part, job.file);
      sinks.delete(token);
      framesDone += job.b - job.a;
      const el = (Date.now() - tStart) / 1000;
      const avgS = stats.reduce((s, x) => s + x[1], 0) / stats.length;
      const eta = (el / framesDone) * (framesTotal - framesDone);
      console.log(`[w${id}] frames ${job.a}-${job.b} in ${((Date.now() - t0) / 1000).toFixed(1)}s (avg ${(stats.reduce((s, x) => s + x[2], 0) / stats.length / 1000).toFixed(2)}s/frame, ~${avgS.toFixed(1)} samples) | ${framesDone}/${framesTotal} | ETA ${(eta / 60).toFixed(1)} min`);
    }
    await browser.close();
  }
  await Promise.all(Array.from({ length: workers }, (_, i) => worker(i)));
  console.log(`[frames] done in ${((Date.now() - tStart) / 60000).toFixed(1)} min`);
} else if (mode === 'concat') {
  const files = fs.readdirSync(OUT).filter((f) => /^chunk_\d+_\d+\.mkv$/.test(f)).sort();
  const list = path.join(OUT, 'list.txt');
  fs.writeFileSync(list, files.map((f) => `file '${path.join(OUT, f)}'`).join('\n'));
  const outFile = path.resolve(ROOT, opt('file', 'build/clean.mkv'));
  await new Promise((res, rej) => spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', outFile], { stdio: 'inherit' })
    .on('close', (c) => (c === 0 ? res() : rej(new Error('concat failed')))));
  console.log(`[concat] ${files.length} chunks -> ${path.relative(ROOT, outFile)}`);
}
srv.close();
process.exit(0);
