// Frame-by-frame renderer: drives the Three.js scene in Chromium (software GL) and pipes raw frames to ffmpeg.
// Usage:
//   node tools/render.mjs --stills 3.2,9.0,...  [--outdir build/stills] [--ss 1]
//   node tools/render.mjs --video [--from 0 --to 1515] [--chunk 60] [--ss 1]   -> build/render/video_nosubs.mp4
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { startServer } from './server.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => { if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json'), 'utf8'));
const FPS = TL.fps, W = TL.width, H = TL.height, SS = +(args.ss || 1);
const TOTAL = Math.round(TL.duration * FPS);
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let sink = null; // function(buffer) -> Promise
const srv = await startServer();
// add a raw-frame POST endpoint on a second tiny server
const frameSrv = http.createServer((req, res) => {
  const chunks = []; req.on('data', (c) => chunks.push(c));
  req.on('end', async () => { await sink(Buffer.concat(chunks)); res.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); res.end('ok'); });
});
await new Promise((r) => frameSrv.listen(0, '127.0.0.1', r));
const framePort = frameSrv.address().port;

const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-web-security', '--window-size=1100,1950'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/scene/index.html?ss=${SS}&ao=${args.ao ?? '1'}`);
await page.waitForFunction('window.__ready && window.setup', null, { timeout: 120000 });
const t0 = Date.now();
await page.evaluate('window.setup()');
console.log('setup', Date.now() - t0, 'ms');
const post = `http://127.0.0.1:${framePort}/f`;

function ffmpeg(argsList) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...argsList], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((r) => p.on('close', r));
  return { p, done, write: (b) => new Promise((r) => (p.stdin.write(b) ? r() : p.stdin.once('drain', r))) };
}
const scaleArgs = SS !== 1 ? ['-vf', `vflip,scale=${W}:${H}:flags=lanczos`] : ['-vf', 'vflip'];

if (args.stills) {
  const outdir = path.join(ROOT, args.outdir || 'build/stills'); fs.mkdirSync(outdir, { recursive: true });
  for (const ts of String(args.stills).split(',')) {
    const t = +ts; const a = Date.now();
    await page.evaluate((t) => window.renderAt(t), t);
    const out = path.join(outdir, `still_${t.toFixed(2).padStart(6, '0')}.png`);
    const f = ffmpeg(['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W * SS}x${H * SS}`, '-i', '-', ...scaleArgs, '-frames:v', '1', out]);
    sink = async (b) => { await f.write(b); f.p.stdin.end(); };
    await page.evaluate((u) => window.postFrame(u), post); await f.done;
    console.log('still', t, Date.now() - a, 'ms ->', out);
  }
} else if (args.video) {
  const from = +(args.from || 0), to = +(args.to || TOTAL), CH = +(args.chunk || 60);
  const cdir = path.join(ROOT, 'build/render/chunks'); fs.mkdirSync(cdir, { recursive: true });
  for (let c0 = from; c0 < to; c0 += CH) {
    const c1 = Math.min(to, c0 + CH);
    const out = path.join(cdir, `chunk_${String(c0).padStart(5, '0')}_${String(c1).padStart(5, '0')}.mp4`);
    if (fs.existsSync(out) && !args.force) { console.log('skip', out); continue; }
    const tmp = out + '.part.mp4';
    const f = ffmpeg(['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W * SS}x${H * SS}`, '-r', String(FPS), '-i', '-', ...scaleArgs,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '11', '-pix_fmt', 'yuv420p', '-tune', 'animation', tmp]);
    sink = (b) => f.write(b);
    const a = Date.now();
    for (let fr = c0; fr < c1; fr++) {
      await page.evaluate((t) => window.renderAt(t), fr / FPS);
      await page.evaluate((u) => window.postFrame(u), post);
    }
    f.p.stdin.end(); await f.done; fs.renameSync(tmp, out);
    console.log(`chunk ${c0}-${c1} ${((Date.now() - a) / (c1 - c0) / 1000).toFixed(2)} s/frame`);
  }
  // concat all chunks
  const files = fs.readdirSync(cdir).filter((f) => /^chunk_\d+_\d+\.mp4$/.test(f)).sort();
  const covered = files.reduce((n, f) => n + (+f.split('_')[2].slice(0, 5) - +f.split('_')[1]), 0);
  if (covered >= TOTAL) {
    const list = path.join(cdir, 'list.txt'); fs.writeFileSync(list, files.map((f) => `file '${path.join(cdir, f)}'`).join('\n'));
    const f = ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(ROOT, 'build/render/video_nosubs.mp4')]); f.p.stdin.end(); await f.done;
    console.log('wrote build/render/video_nosubs.mp4');
  } else console.log(`chunks cover ${covered}/${TOTAL} frames; concat skipped`);
}
await browser.close(); srv.close(); frameSrv.close();
