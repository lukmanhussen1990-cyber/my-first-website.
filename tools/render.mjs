// Deterministic renderer: serves the project, drives index.html in headless
// Chromium, calls window.renderAt(t) for every frame and pipes JPEG frames to ffmpeg.
//
//   node tools/render.mjs                 full reel -> build/video.mp4 (silent)
//   node tools/render.mjs --preview       6 s preview (0..6 s) -> build/preview_silent.mp4
//   node tools/render.mjs --stills        one frame per scene -> build/stills/*.jpg
//   node tools/render.mjs --sheet         character sheet -> out/characters.png
//   node tools/render.mjs --cover 2.6     cover image -> out/cover.jpg
//   node tools/render.mjs --safezone      text bounding boxes vs the IG safe zone -> build/safezone.json
//   node tools/render.mjs --at 12.5,30    single frames -> build/stills/at_*.jpg
//   node tools/render.mjs --range 10,16   frames for a time range -> build/range.mp4
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 30;
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(ROOT, u === '/' ? '/index.html' : u);
      if (!f.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(f, (e, b) => {
        if (e) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(b);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function main() {
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || flag('--verbose')) console.log('[page]', m.type(), m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const mode = flag('--sheet') ? 'sheet' : 'reel';
  await page.goto(`http://127.0.0.1:${port}/index.html?mode=${mode}`);
  await page.waitForFunction('window.__ready === true || window.__error', null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error(err);
  const info = await page.evaluate(() => window.reelInfo());
  fs.mkdirSync(path.join(ROOT, 'build/stills'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'build/sfx_events.json'), JSON.stringify(info.events, null, 1));
  fs.writeFileSync(path.join(ROOT, 'build/scenes.json'), JSON.stringify(info.scenes, null, 1));

  const shot = async (t, file) => {
    await page.evaluate((tt) => window.renderAt(tt), t);
    const buf = await page.screenshot({ type: 'jpeg', quality: 96 });
    if (file) fs.writeFileSync(file, buf);
    return buf;
  };

  if (flag('--safezone')) { // every visible text element must sit inside x 60-960, y 220-1500
    const viol = []; let checked = 0;
    for (let t = 0; t < info.total; t += 0.25) {
      await page.evaluate((tt) => window.renderAt(tt), t);
      const v = await page.evaluate(() => {
        const eff = (el) => { let o = 1; for (let e = el; e && e.id !== 'stage'; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= parseFloat(cs.opacity); } return o; };
        const sel = ['#captions .w', '.pill', '.card', '#topbar .l', '#topbar .r', '#watermark', '#end .icon svg', '#end .lbl', '#bubble', '#outro .logo', '#outro .name', '#outro .sub', '#qmark'];
        const out = [];
        for (const q of sel) for (const el of document.querySelectorAll(q)) {
          if (eff(el) < 0.05) continue;
          // text elements: measure the glyphs, not the (wider) block box
          let r = el.getBoundingClientRect();
          if (['#end .lbl', '#outro .name', '#outro .sub', '#topbar .l', '#topbar .r', '#watermark', '#qmark'].includes(q)) { const rg = document.createRange(); rg.selectNodeContents(el); r = rg.getBoundingClientRect(); }
          if (r.width < 1) continue;
          if (r.left < 59 || r.right > 961 || r.top < 219 || r.bottom > 1501) out.push(`${q} "${(el.textContent || '').trim().slice(0, 24)}" [${r.left.toFixed(0)},${r.top.toFixed(0)},${r.right.toFixed(0)},${r.bottom.toFixed(0)}]`);
        }
        return out;
      });
      checked++;
      for (const x of v) viol.push(`t=${t.toFixed(2)} ${x}`);
    }
    fs.writeFileSync(path.join(ROOT, 'build/safezone.json'), JSON.stringify({ checked, violations: viol }, null, 1));
    console.log(`safe zone: ${checked} frames, ${viol.length} violations`); viol.slice(0, 20).forEach((x) => console.log(' ', x));
  } else if (flag('--cover')) {
    await page.evaluate((t) => window.makeCover(t), Number(opt('--cover')) || 2.6);
    fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'out/cover.jpg'), await page.screenshot({ type: 'jpeg', quality: 94 }));
    console.log('wrote out/cover.jpg');
  } else if (mode === 'sheet') {
    const buf = await page.screenshot({ type: 'png' });
    fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'out/characters.png'), buf);
    console.log('wrote out/characters.png');
  } else if (flag('--stills')) {
    for (const s of info.scenes) {
      const f = path.join(ROOT, `build/stills/${s.id}.jpg`);
      await shot(s.still, f);
      console.log('still', s.id, s.still.toFixed(2));
    }
  } else if (opt('--at')) {
    for (const t of opt('--at').split(',').map(Number)) {
      await shot(t, path.join(ROOT, `build/stills/at_${t.toFixed(2)}.jpg`));
      console.log('frame', t);
    }
  } else {
    let t0 = 0, t1 = info.total, out = path.join(ROOT, 'build/video.mp4');
    if (flag('--preview')) { t0 = 0; t1 = 6; out = path.join(ROOT, 'build/preview_silent.mp4'); }
    if (opt('--range')) { [t0, t1] = opt('--range').split(',').map(Number); out = path.join(ROOT, opt('--out') || 'build/range.mp4'); }
    const n0 = Math.round(t0 * FPS), n1 = Math.round(t1 * FPS);
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const started = Date.now();
    for (let n = n0; n < n1; n++) {
      const buf = await shot(n / FPS);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if ((n - n0) % 60 === 0) {
        const el = (Date.now() - started) / 1000, done = n - n0 + 1;
        console.log(`frame ${n}/${n1} (${(n / FPS).toFixed(1)}s)  ${(el / done * 1000).toFixed(0)} ms/f  eta ${((n1 - n) * el / done / 60).toFixed(1)} min`);
      }
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    console.log('wrote', out);
  }
  await browser.close();
  srv.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
