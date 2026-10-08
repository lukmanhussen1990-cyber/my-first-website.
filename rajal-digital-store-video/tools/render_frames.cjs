#!/usr/bin/env node
/* Frame capture for the Rajal Digital Store video.
 *
 *   node tools/render_frames.cjs --at 0.5,7.1,20.4 --out /tmp/stills        # PNG stills for review
 *   node tools/render_frames.cjs --video build/silent.mkv [--workers 4]     # full render (lossless, no audio)
 *
 * Needs Playwright + Chromium (npm i playwright) and ffmpeg on the PATH.
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] === undefined || argv[i + 1].startsWith('--') ? true : argv[i + 1]); };
const SCALE = parseFloat(arg('scale', '1'));
const FPS = 30;

async function openPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: SCALE });
  const page = await ctx.newPage();
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) console.error('[page]', m.type(), m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?render=1');
  await page.evaluate(() => window.__ready);
  return page;
}
const launch = () => chromium.launch({ args: ['--font-render-hinting=none', '--allow-file-access-from-files', '--disable-lcd-text', '--force-color-profile=srgb', '--hide-scrollbars'] });

async function stills() {
  const out = path.resolve(arg('out', path.join(ROOT, 'build', 'stills')));
  fs.mkdirSync(out, { recursive: true });
  const times = String(arg('at')).split(',').map(Number);
  const browser = await launch();
  const page = await openPage(browser);
  for (const t of times) {
    await page.evaluate(t => window.renderFrame(t), t);
    const f = path.join(out, `t_${t.toFixed(2).padStart(6, '0')}.png`);
    await page.screenshot({ path: f });
    console.log('saved', f);
  }
  const sfx = await page.evaluate(() => window.SFX_EVENTS);
  fs.writeFileSync(path.join(ROOT, 'build', 'sfx_events.json'), JSON.stringify(sfx, null, 1));
  await browser.close();
}

async function renderRange(browser, from, to, outFile, quality) {
  const page = await openPage(browser);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'yuv420p', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))); });
  for (let f = from; f < to; f++) {
    await page.evaluate(t => window.renderFrame(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 30 === 0) process.stdout.write(`\r  frame ${f}/${to}   `);
  }
  ff.stdin.end();
  await done;
  await page.context().close();
}

async function video() {
  const outFile = path.resolve(arg('video'));
  const workers = parseInt(arg('workers', '4'), 10);
  const quality = parseInt(arg('quality', '96'), 10);
  const browser0 = await launch();
  const probe = await openPage(browser0);
  const total = await probe.evaluate(() => window.TOTAL);
  const sfx = await probe.evaluate(() => window.SFX_EVENTS);
  fs.writeFileSync(path.join(ROOT, 'build', 'sfx_events.json'), JSON.stringify(sfx, null, 1));
  await probe.context().close(); await browser0.close();
  const frames = Math.ceil(total * FPS);
  const per = Math.ceil(frames / workers);
  const segs = [];
  console.log(`rendering ${frames} frames @ ${FPS} fps with ${workers} workers (scale ${SCALE})`);
  const t0 = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, i) => {
    const a = i * per, b = Math.min(frames, a + per);
    if (a >= b) return;
    const seg = outFile.replace(/\.mkv$/, `.part${i}.mkv`);
    segs.push(seg);
    const browser = await launch();
    await renderRange(browser, a, b, seg, quality);
    await browser.close();
  }));
  segs.sort();
  const list = outFile + '.txt';
  fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', outFile], { stdio: 'inherit' }).on('close', c => c ? rej(new Error('concat failed')) : res()));
  segs.forEach(s => fs.unlinkSync(s)); fs.unlinkSync(list);
  console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${outFile}`);
}

(async () => {
  if (arg('at')) await stills();
  else if (arg('video')) await video();
  else { console.error('usage: --at t1,t2 [--out dir] | --video out.mkv [--workers n] [--scale s]'); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
