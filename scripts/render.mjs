// Headless deterministic renderer: Chromium + WebGL -> raw RGBA frames -> ffmpeg (H.264).
//
//   node scripts/render.mjs                        whole film -> frames/video.mp4
//   node scripts/render.mjs --workers 2            same, split across 2 browsers
//   node scripts/render.mjs --test                 5 s of scene 3 + 5 s of scene 10, 3 PNG stills each
//   node scripts/render.mjs --stills 12.5,49.3     PNG stills at those times (frames/stills/)
//   node scripts/render.mjs --from 10 --to 15 --out frames/clip.mp4
//   --scale 0.5                                    quick low-res preview
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { launchWebGLBrowser } from './lib/browser.mjs';
import { startServer } from './lib/server.mjs';
import { ROOT, readJSON } from './lib/util.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes('--' + name);
const timeline = readJSON('src/timeline.json');
const FPS = timeline.fps;
const SCALE = parseFloat(opt('scale', '1'));
const W = Math.round(timeline.width * SCALE);
const H = Math.round(timeline.height * SCALE);
const FRAMES_DIR = path.join(ROOT, 'frames');
fs.mkdirSync(path.join(FRAMES_DIR, 'stills'), { recursive: true });

function encoder(outFile) {
  const ff = spawn('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));
  return {
    write: (buf) => new Promise((resolve) => (ff.stdin.write(buf) ? resolve() : ff.stdin.once('drain', resolve))),
    close: () => {
      ff.stdin.end();
      return done;
    },
  };
}

function savePNG(buf, file) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', '-vf', 'vflip', '-frames:v', '1', file]);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error('png encode failed'))));
    ff.stdin.end(buf);
  });
}

async function openPage(serverUrl) {
  const { browser, mode, gl } = await launchWebGLBrowser({ width: W, height: H });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => {
    if (['error', 'warn'].includes(m.type())) console.error(`[page ${m.type()}]`, m.text());
  });
  await page.goto(`${serverUrl}/src/index.html?scale=${SCALE}`, { waitUntil: 'load', timeout: 0 });
  await page.waitForFunction('window.ready === true', { timeout: 0, polling: 200 });
  return { browser, page, mode, gl };
}

// Render frames [a, b) through one browser into `sink(i, buffer)`.
async function renderRange(serverUrl, sinkName, a, b, label = '') {
  const { browser, page, mode, gl } = await openPage(serverUrl);
  console.log(`${label}WebGL: ${mode} (${gl.renderer}) ${W}x${H}, frames ${a}..${b - 1}`);
  const t0 = Date.now();
  for (let i = a; i < b; i++) {
    await page.evaluate(async (fi, fps, sink) => {
      await window.renderFrame(fi / fps);
      await window.sendFrame(fi, sink);
    }, i, FPS, sinkName);
    const n = i - a + 1;
    if (n % 30 === 0 || i === b - 1) {
      const per = (Date.now() - t0) / n / 1000;
      console.log(`${label}frame ${i + 1}/${b}  ${per.toFixed(2)} s/frame  ETA ${(((b - i - 1) * per) / 60).toFixed(1)} min`);
    }
  }
  await browser.close();
}

async function main() {
  const sinks = new Map();
  const { server, url } = await startServer(ROOT, {
    onPost: async (u, body) => {
      const sink = sinks.get(u.pathname);
      if (!sink) throw new Error('no sink for ' + u.pathname);
      await sink(parseInt(u.searchParams.get('i'), 10), body);
    },
  });

  const clip = async (fromFrame, toFrame, outFile, stills = []) => {
    const enc = outFile ? encoder(outFile) : null;
    const stillSet = new Map(stills.map((s) => [s.frame, s.file]));
    sinks.set('/frame', async (i, buf) => {
      if (enc) await enc.write(buf);
      if (stillSet.has(i)) await savePNG(buf, stillSet.get(i));
    });
    await renderRange(url, '/frame', fromFrame, toFrame);
    if (enc) await enc.close();
  };

  if (flag('test')) {
    const scene = (id) => timeline.scenes.find((s) => s.id === id);
    const s3 = scene(3);
    const s10 = scene(10);
    const a3 = Math.round((s3.start + 0.5) * FPS);
    const a10 = Math.round((timeline.cues.s10_reveal - 2.0) * FPS);
    const mk = (a, name) => [0.2, 0.5, 0.85].map((f, k) => ({ frame: a + Math.round(f * 5 * FPS), file: path.join(FRAMES_DIR, 'stills', `test_${name}_${k + 1}.png`) }));
    console.log('Test: scene 3 (dance) ...');
    await clip(a3, a3 + 5 * FPS, path.join(FRAMES_DIR, 'test_scene3.mp4'), mk(a3, 'scene3'));
    console.log('Test: scene 10 (fridge reflection) ...');
    await clip(a10, a10 + 5 * FPS, path.join(FRAMES_DIR, 'test_scene10.mp4'), mk(a10, 'scene10'));
  } else if (flag('segments')) {
    // one segment per scene so any scene can be re-rendered on its own, then concatenated
    const segDir = path.join(FRAMES_DIR, 'seg');
    fs.mkdirSync(segDir, { recursive: true });
    const only = opt('only') ? opt('only').split(',').map(Number) : null;
    const workers = Math.max(1, parseInt(opt('workers', '1'), 10));
    const jobs = timeline.scenes
      .filter((s) => (only ? only.includes(s.id) : !fs.existsSync(path.join(segDir, `scene_${String(s.id).padStart(2, '0')}.mp4`))))
      .map((s) => ({ id: s.id, a: Math.round(s.start * FPS), b: Math.round(s.end * FPS) }))
      .sort((x, y) => y.b - y.a - (x.b - x.a));
    console.log(`Segments to render: ${jobs.map((j) => j.id).join(', ') || 'none'}`);
    await Promise.all(
      Array.from({ length: workers }, async (_, k) => {
        for (let job = jobs.shift(); job; job = jobs.shift()) {
          const file = path.join(segDir, `scene_${String(job.id).padStart(2, '0')}.mp4`);
          const tmp = file.replace('.mp4', '.part.mp4');
          const enc = encoder(tmp);
          sinks.set(`/frame${k}`, async (i, buf) => enc.write(buf));
          await renderRange(url, `/frame${k}`, job.a, job.b, `[w${k} scene ${job.id}] `);
          await enc.close();
          fs.renameSync(tmp, file);
        }
      })
    );
    const parts = timeline.scenes.map((s) => path.join(segDir, `scene_${String(s.id).padStart(2, '0')}.mp4`));
    if (parts.every((p) => fs.existsSync(p))) {
      const list = path.join(FRAMES_DIR, 'parts.txt');
      fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
      const out = path.resolve(ROOT, opt('out', 'frames/video.mp4'));
      await new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' });
        ff.on('close', (c) => (c === 0 ? resolve() : reject(new Error('concat failed'))));
      });
      console.log(`Video: ${path.relative(ROOT, out)}`);
    }
  } else if (opt('stills')) {
    const times = opt('stills').split(',').map(Number);
    const tag = opt('tag', 'still');
    sinks.set('/frame', async (i, buf) => savePNG(buf, path.join(FRAMES_DIR, 'stills', `${tag}_${(i / FPS).toFixed(2)}s.png`)));
    const { browser, page, mode } = await openPage(url);
    console.log(`WebGL: ${mode}`);
    for (const t of times) {
      const i = Math.round(t * FPS);
      await page.evaluate(async (fi, fps) => {
        await window.renderFrame(fi / fps);
        await window.sendFrame(fi);
      }, i, FPS);
      console.log(`still @ ${t}s`);
    }
    await browser.close();
  } else {
    const from = Math.round(parseFloat(opt('from', '0')) * FPS);
    const to = Math.min(timeline.frames, Math.round(parseFloat(opt('to', String(timeline.duration))) * FPS));
    const out = path.resolve(ROOT, opt('out', 'frames/video.mp4'));
    const workers = Math.max(1, parseInt(opt('workers', '1'), 10));
    if (workers === 1) {
      await clip(from, to, out);
    } else {
      const per = Math.ceil((to - from) / workers);
      const parts = [];
      await Promise.all(
        Array.from({ length: workers }, async (_, k) => {
          const a = from + k * per;
          const b = Math.min(to, a + per);
          if (a >= b) return;
          const file = path.join(FRAMES_DIR, `part_${k}.mp4`);
          parts[k] = file;
          const enc = encoder(file);
          sinks.set(`/frame${k}`, async (i, buf) => enc.write(buf));
          await renderRange(url, `/frame${k}`, a, b, `[w${k}] `);
          await enc.close();
        })
      );
      const list = path.join(FRAMES_DIR, 'parts.txt');
      fs.writeFileSync(list, parts.filter(Boolean).map((p) => `file '${p}'`).join('\n'));
      await new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' });
        ff.on('close', (c) => (c === 0 ? resolve() : reject(new Error('concat failed'))));
      });
    }
    console.log(`Video: ${path.relative(ROOT, out)}`);
  }
  server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
