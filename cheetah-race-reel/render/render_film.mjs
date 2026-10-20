// Full frame-by-frame render of the silent master.
//   node render/render_film.mjs [--from 0] [--to 1665] [--chunk 90] [--workers 1] [--n 6]
// Frames are rendered in chunks; each chunk is piped as raw RGBA into its own
// ffmpeg encode (work/master/chunk_XXXX.mp4), so an interrupted render resumes
// at the first missing chunk. When every chunk exists they are joined into
// work/master/master.mp4 (H.264, 1080x1920, 30 fps, no audio).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const FPS = +(args.fps ?? 30), W = +(args.w ?? 1080), H = +(args.h ?? 1920);
const TOTAL = Math.round(55.5 * FPS);
const SHADOW = args.shadow ? `&shadow=${args.shadow}` : '';
const from = +(args.from ?? 0), to = Math.min(+(args.to ?? TOTAL), TOTAL);
const CHUNK = +(args.chunk ?? 90), WORKERS = +(args.workers ?? 1), N = args.n ? +args.n : null;
const OUT = path.resolve(args.out ?? 'work/master');
const CRF = args.crf ?? '15';
fs.mkdirSync(OUT, { recursive: true });

const chunks = [];
for (let c0 = Math.floor(from / CHUNK) * CHUNK; c0 < to; c0 += CHUNK) chunks.push({ c0, c1: Math.min(c0 + CHUNK, TOTAL) });
const chunkFile = (c) => path.join(OUT, `chunk_${String(c.c0).padStart(4, '0')}.mp4`);
const todo = chunks.filter((c) => !fs.existsSync(chunkFile(c)));
console.log(`${chunks.length} chunks, ${todo.length} to render, ${WORKERS} worker(s)`);

function encoder(file) {
  // high quality intermediate: the final export re-encodes once with subtitles
  return spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p', '-g', '30', '-bf', '2',
    '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
}

async function worker(id, queue) {
  let cur = null; // { ff, pending }
  const port = 9100 + id * 7 + Math.floor(Math.random() * 50);
  const server = await startServer(port, async (buf) => {
    if (!cur) throw new Error('frame without an open chunk');
    if (!cur.ff.stdin.write(buf)) await new Promise((r) => cur.ff.stdin.once('drain', r));
  });
  let browser = null, page = null;
  const launch = async () => {
    if (browser) await browser.close().catch(() => {});
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: false,
      args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-gpu-sandbox', '--enable-gpu', '--disable-gpu-driver-bug-workarounds', '--js-flags=--max-old-space-size=4096'] });
    page = await browser.newPage({ viewport: { width: 64, height: 64 } });
    page.on('pageerror', (e) => console.log(`[w${id} pageerror]`, e.message));
    page.on('console', (m) => { const s = m.text(); if (/error/i.test(s) && !/GPU stall|PCFSoft|404/.test(s)) console.log(`[w${id}]`, s); });
    await page.goto(`http://127.0.0.1:${port}/render/index.html?mode=film&w=${W}&h=${H}${N ? `&n=${N}` : ''}${SHADOW}`);
    await page.waitForFunction(() => window.ready === true, null, { timeout: 300000 });
  };
  await launch();
  for (const c of queue) {
    const file = chunkFile(c), tmp = file.replace(/\.mp4$/, '.part.mp4');
    for (let attempt = 0; attempt < 3; attempt++) {
      const ff = encoder(tmp);
      const done = new Promise((res, rej) => ff.on('close', (code) => (code === 0 ? res() : rej(new Error('ffmpeg exit ' + code)))));
      cur = { ff };
      const t0 = Date.now();
      try {
        for (let f = c.c0; f < c.c1; f++) {
          const r = await page.evaluate(([t, f, fps]) => window.renderFrame(t, { frame: f, fps }), [f / FPS, f, FPS]);
          if (f % 15 === 0) console.log(`[w${id}] frame ${f} t=${(f / FPS).toFixed(2)} ${r.ms}ms N=${r.N}`);
        }
        ff.stdin.end();
        await done;
        fs.renameSync(tmp, file);
        console.log(`[w${id}] chunk ${c.c0}-${c.c1} done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        break;
      } catch (e) {
        console.log(`[w${id}] chunk ${c.c0} failed (${e.message}); restarting browser`);
        try { ff.stdin.destroy(); ff.kill('SIGKILL'); } catch {}
        await launch();
      }
    }
  }
  cur = null;
  await browser.close().catch(() => {});
  server.close();
}

const queues = Array.from({ length: WORKERS }, () => []);
todo.forEach((c, i) => queues[i % WORKERS].push(c));
await Promise.all(queues.map((q, i) => worker(i, q)));

// join when complete
if (chunks.every((c) => fs.existsSync(chunkFile(c))) && from === 0 && to === TOTAL) {
  const list = path.join(OUT, 'chunks.txt');
  fs.writeFileSync(list, chunks.map((c) => `file '${path.basename(chunkFile(c))}'`).join('\n') + '\n');
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', path.join(OUT, 'master.mp4')], { stdio: 'inherit' });
  console.log(r.status === 0 ? `master: ${path.join(OUT, 'master.mp4')}` : 'concat failed');
}
