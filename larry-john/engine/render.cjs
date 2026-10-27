#!/usr/bin/env node
// Frame-by-frame renderer: opens a Three.js page in headless Chromium (Mesa llvmpipe, CPU only),
// renders every frame and streams the raw pixels into ffmpeg. No screen recording.
//
//   node engine/render.cjs --page haunted-house/scene/index.html --mode plates --w 1080 --h 1920 \
//        --from 0 --to 2700 --out haunted-house/build/plates/part0.mkv
//   node engine/render.cjs --page ... --mode stills --times 1.5,3.25 --outdir haunted-house/build/stills
//   node engine/render.cjs --page ... --mode cues --out haunted-house/build/cues.json
//   node engine/render.cjs --page ... --mode overlay --out haunted-house/build/overlay.mov
//
// Extra "--q key=value" pairs are passed to the page as URL query parameters.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { startServer } = require('./server.cjs');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const a = { mode: 'plates', w: 1080, h: 1920, fps: 30, from: 0, to: -1, q: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    const v = argv[i + 1];
    if (k === 'q') { a.q.push(v); i++; continue; }
    if (v === undefined || v.startsWith('--')) { a[k] = true; continue; }
    a[k] = isNaN(+v) ? v : +v; i++;
  }
  return a;
}

// Browser flags: use Mesa's llvmpipe through EGL (about 4x faster than SwiftShader here).
const GPU_ARGS = ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
  '--enable-webgl', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--font-render-hinting=none'];

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const W = a.w, H = a.h;
  let ff = null, frameCount = 0;
  const pending = [];

  const sink = async (params, body) => {
    if (params.kind === 'frame') {
      if (!ff.stdin.write(body)) await new Promise((r) => ff.stdin.once('drain', r));
      frameCount++;
    } else if (params.kind === 'file') {
      const out = path.resolve(ROOT, params.path);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, body);
    }
  };
  const srv = await startServer(ROOT, sink);
  const port = srv.address().port;

  if (a.mode === 'plates' || a.mode === 'overlay') {
    const out = path.resolve(ROOT, a.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const enc = a.mode === 'plates'
      // lossless RGB intermediate (the final H.264 encode happens once, at the end)
      ? ['-c:v', 'libx264rgb', '-qp', '0', '-preset', 'ultrafast', '-pix_fmt', 'rgb24']
      // overlay keeps its alpha channel
      : ['-c:v', 'qtrle', '-pix_fmt', 'argb'];
    ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(a.fps),
      '-i', '-', '-vf', 'vflip', ...enc, out], { stdio: ['pipe', 'inherit', 'inherit'] });
  }

  const browser = await chromium.launch({ args: GPU_ARGS, env: { ...process.env, EGL_PLATFORM: 'surfaceless' } });
  const page = await browser.newPage({ viewport: { width: Math.min(W, 1200), height: Math.min(H, 1200) } });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) || a.verbose) console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const qs = new URLSearchParams({ w: W, h: H, fps: a.fps, mode: a.mode });
  for (const kv of a.q) { const [k, ...v] = kv.split('='); qs.set(k, v.join('=')); }
  await page.goto(`http://127.0.0.1:${port}/${a.page}?${qs}`);
  await page.waitForFunction(() => window.APP && window.APP.ready === true, null, { timeout: 300000 });
  const info = await page.evaluate(() => window.APP.info());
  const t0 = Date.now();

  if (a.mode === 'cues') {
    const cues = await page.evaluate(() => window.APP.getCues());
    const out = path.resolve(ROOT, a.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(cues, null, 1));
    console.log('cues written', out);
  } else if (a.mode === 'stills') {
    const times = String(a.times).split(',').map(Number);
    const names = a.names ? String(a.names).split(',') : null;
    for (let i = 0; i < times.length; i++) {
      const name = names ? names[i] : `t${times[i].toFixed(2)}`;
      const rel = path.relative(ROOT, path.resolve(ROOT, a.outdir, `${name}.png`));
      await page.evaluate(async ([t, rel]) => { await window.APP.renderTime(t); await window.APP.sendPNG(rel); }, [times[i], rel]);
      process.stdout.write(`still ${name} `);
    }
    console.log();
  } else if (a.mode === 'sheet') {
    await page.evaluate(async (rel) => { await window.APP.renderSheet(); await window.APP.sendPNG(rel); }, a.out);
  } else {
    const last = a.to >= 0 ? a.to : info.frames;
    let tLast = Date.now();
    for (let f = a.from; f < last; f++) {
      await page.evaluate(async (f) => { await window.APP.renderFrame(f); await window.APP.sendPixels(f); }, f);
      if ((f - a.from) % 30 === 29 || f === last - 1) {
        const dt = (Date.now() - tLast) / 1000; tLast = Date.now();
        const done = f - a.from + 1, total = last - a.from;
        const eta = ((Date.now() - t0) / done) * (total - done) / 1000;
        console.log(`${a.mode} frame ${f + 1}/${last}  ${(dt / 30).toFixed(2)} s/frame  eta ${(eta / 60).toFixed(1)} min`);
      }
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    console.log(`wrote ${frameCount} frames to ${a.out} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
  await browser.close();
  srv.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
