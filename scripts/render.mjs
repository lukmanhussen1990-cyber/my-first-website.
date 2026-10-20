// Deterministic headless render: puppeteer steps window.renderFrame in fixed 1/30 s steps and the page
// POSTs raw RGBA frames to this process, which pipes them straight into ffmpeg (no screenshots, no clock).
//
//   node scripts/render.mjs                       full video -> build/video.mp4
//   node scripts/render.mjs --scene 6 --seconds 5 --stills 3   test clip + 3 PNG stills (frames/)
//   node scripts/render.mjs --times 1.2,30.5      PNG stills at given times only
//   node scripts/render.mjs --workers 2           split the frame range over 2 browsers
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';
import { buildTimeline } from './timeline.mjs';
import { P, ROOT } from './config.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(`--${k}`);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png' };

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const pw = '/opt/pw-browsers';
  if (fs.existsSync(pw)) {
    const d = fs.readdirSync(pw).filter((x) => /^chromium-\d+$/.test(x)).sort().pop();
    if (d) { const exe = path.join(pw, d, 'chrome-linux', 'chrome'); if (fs.existsSync(exe)) return exe; }
  }
  return undefined; // puppeteer's own download
}

const BASE_FLAGS = ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--enable-webgl', '--force-device-scale-factor=1',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--window-size=1080,1920'];
const GL_MODES = [
  ['angle (gpu)', ['--use-gl=angle']],
  ['angle + swiftshader', ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']],
];

async function launchWithWebGL(log = true) {
  for (const [name, flags] of GL_MODES) {
    const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: [...BASE_FLAGS, ...flags], protocolTimeout: 900000 });
    const page = await browser.newPage();
    const info = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return null;
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'webgl2';
    });
    await page.close();
    if (info) { if (log) console.log(`  WebGL via ${name}: ${info}`); return browser; }
    if (log) console.log(`  WebGL not available via ${name}, trying fallback...`);
    await browser.close();
  }
  throw new Error('No WebGL2 available in headless Chrome');
}

function startServer(sinks) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const m = url.match(/^\/frame\/(\d+)$/);
    if (req.method === 'POST' && m) {
      const frame = Number(m[1]);
      const sink = sinks.find((s) => frame >= s.from && frame < s.to);
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (!sink) { res.writeHead(400); res.end(); return; }
        const ok = sink.write(frame, buf);
        const done = () => { res.writeHead(200); res.end('ok'); };
        if (ok) done(); else sink.ff.stdin.once('drain', done);
      });
      return;
    }
    const file = path.join(ROOT, url === '/' ? '/src/index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

async function openPage(browser, port) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  page.on('console', (m) => { const t = m.text(); if (/error|fail|warn/i.test(t) && !/favicon/.test(t)) console.log('    [page]', t.slice(0, 300)); });
  page.on('pageerror', (e) => console.log('    [page error]', e.message));
  await page.goto(`http://127.0.0.1:${port}/src/index.html?msaa=${arg('msaa', 4)}`);
  await page.waitForFunction('window.ready === true || window.initError', { timeout: 300000 });
  const err = await page.evaluate('window.initError');
  if (err) throw new Error(err);
  return page;
}

function ffmpegSink(from, to, out, W, H, fps) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', 'pipe:0',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  let next = from;
  const pending = new Map();
  const sink = {
    from, to, ff,
    write(frame, buf) {
      pending.set(frame, buf);
      let ok = true;
      while (pending.has(next)) { ok = ff.stdin.write(pending.get(next)); pending.delete(next); next++; }
      return ok;
    },
    done: new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg exited ${c}`))))),
  };
  return sink;
}

async function main() {
  const tl = buildTimeline();
  fs.mkdirSync(P('build'), { recursive: true });
  fs.writeFileSync(P('build', 'timeline.json'), JSON.stringify(tl, null, 2));
  const fps = tl.fps;

  // frame range
  let from = 0, to = tl.frames;
  if (arg('scene')) {
    const sc = tl.scenes.find((s) => s.id === Number(arg('scene')));
    from = Math.round(sc.start * fps);
    to = Math.round(sc.end * fps);
  }
  if (arg('start')) from = Math.round(Number(arg('start')) * fps);
  if (arg('end')) to = Math.round(Number(arg('end')) * fps);
  if (arg('seconds')) to = Math.min(to, from + Math.round(Number(arg('seconds')) * fps));

  const sinks = [];
  const server = await startServer(sinks);
  const port = server.address().port;
  const t0 = Date.now();

  if (arg('times')) { // stills only
    const browser = await launchWithWebGL();
    const page = await openPage(browser, port);
    fs.mkdirSync(P('frames'), { recursive: true });
    const shots = arg('debug') ? JSON.parse(arg('debug')) : [null];
    for (const tt of arg('times').split(',').map(Number)) for (const [si, ds] of shots.entries()) {
      await page.evaluate((d) => { window.debugShot = d; }, ds);
      const png = await page.evaluate((t) => window.stillPNG(t), tt);
      const f = P('frames', `${arg('prefix', 'still')}_${tt.toFixed(2)}s${ds ? '_v' + si : ''}.png`);
      fs.writeFileSync(f, Buffer.from(png.split(',')[1], 'base64'));
      console.log(`  still ${f}`);
    }
    await browser.close(); server.close();
    return;
  }

  const out = arg('out', P('build', arg('scene') ? `scene${arg('scene')}_test.mp4` : 'video.mp4'));
  const segDir = P('build', 'segments');
  fs.mkdirSync(segDir, { recursive: true });
  // Full renders are split into one segment per scene (each starts on a keyframe), so a single scene
  // can be re-rendered later (--scenes 8) and spliced back losslessly; --resume skips finished scenes.
  const full = !arg('scene') && !arg('start') && !arg('end') && !arg('seconds');
  const only = arg('scenes') ? arg('scenes').split(',').map(Number) : null;
  const jobs = full
    ? tl.scenes.map((sc) => ({ a: Math.round(sc.start * fps), b: Math.round(sc.end * fps), segOut: path.join(segDir, `scene_${String(sc.id).padStart(2, '0')}.mp4`), id: sc.id }))
        .filter((j) => (!only || only.includes(j.id)) && !(has('resume') && fs.existsSync(j.segOut)))
    : [{ a: from, b: to, segOut: out }];
  const total = jobs.reduce((n, j) => n + j.b - j.a, 0);
  const workers = Math.max(1, Math.min(Number(arg('workers', 1)), jobs.length));
  console.log(`Rendering ${total} frames (${(total / fps).toFixed(2)}s) in ${jobs.length} segment(s) with ${workers} worker(s)`);
  let doneFrames = 0;
  const queue = [...jobs];
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    if (!queue.length) return;
    const browser = await launchWithWebGL(w === 0);
    const page = await openPage(browser, port);
    while (queue.length) {
      const job = queue.shift();
      const tmp = job.segOut + '.part.mp4';
      const sink = ffmpegSink(job.a, job.b, tmp, tl.width, tl.height, fps);
      sinks.push(sink);
      for (let i = job.a; i < job.b; i++) {
        await page.evaluate((f) => window.sendFrame(f), i);
        doneFrames++;
        if (doneFrames % 30 === 0 || doneFrames === total) {
          const el = (Date.now() - t0) / 1000;
          const eta = (el / doneFrames) * (total - doneFrames);
          console.log(`  ${doneFrames}/${total} frames  ${(el / doneFrames).toFixed(2)}s/frame  ETA ${(eta / 60).toFixed(1)} min`);
        }
      }
      sink.ff.stdin.end();
      await sink.done;
      fs.renameSync(tmp, job.segOut);
      if (job.id) console.log(`  scene ${job.id} done -> ${path.basename(job.segOut)}`);
    }
    await browser.close();
  }));
  if (full) {
    const all = tl.scenes.map((sc) => path.join(segDir, `scene_${String(sc.id).padStart(2, '0')}.mp4`));
    const missing = all.filter((f) => !fs.existsSync(f));
    if (missing.length) {
      console.log(`  not concatenating: missing ${missing.map((f) => path.basename(f)).join(', ')}`);
    } else {
      const list = path.join(segDir, 'list.txt');
      fs.writeFileSync(list, all.map((f) => `file '${f}'`).join('\n'));
      await new Promise((r, j) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' })
        .on('close', (c) => (c === 0 ? r() : j(new Error('concat failed')))));
    }
  }
  server.close();
  console.log(`  wrote ${out} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);

  // optional evenly spaced stills from the rendered range
  const nStills = Number(arg('stills', 0));
  if (nStills > 0) {
    fs.mkdirSync(P('frames'), { recursive: true });
    for (let k = 0; k < nStills; k++) {
      const tt = (from + ((k + 0.5) / nStills) * (to - from)) / fps;
      const rel = tt - from / fps;
      const f = P('frames', `${arg('prefix', 'test')}_${k + 1}_${tt.toFixed(2)}s.png`);
      await new Promise((r, j) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-ss', rel.toFixed(3), '-i', out, '-frames:v', '1', f], { stdio: 'inherit' })
        .on('close', (c) => (c === 0 ? r() : j(new Error('still extract failed')))));
      console.log(`  still ${f}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
