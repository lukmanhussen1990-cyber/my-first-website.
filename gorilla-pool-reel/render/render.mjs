// Renders the Three.js scene frame by frame in headless Chromium and pipes the
// raw frames into ffmpeg. Usage:
//   node render.mjs stills  --times 3.5,10,17 --w 540 --h 960 --out ../output/stills
//   node render.mjs video   --from 0 --to 1500 --out ../output/segments/seg_0000.mp4
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const mode = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +opt('w', 1080), H = +opt('h', 1920), FPS = 30;
const ao = opt('ao', '1');
const extra = opt('q', '');
const port = 8200 + Math.floor(Math.random() * 700);

let sink = null; // current consumer of POSTed frames
const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/frame') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => { await sink(Buffer.concat(chunks)); res.end('ok'); });
    return;
  }
  let f = url.pathname.startsWith('/node_modules/') ? path.join(HERE, url.pathname) : path.join(HERE, 'scene', url.pathname);
  fs.readFile(f, (err, data) => {
    if (err) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(port);

const ffmpeg = (outArgs, inRate = FPS) => {
  const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(inRate), '-i', '-', '-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv', ...outArgs], { stdio: ['pipe', 'inherit', 'inherit'] });
  return p;
};
const write = (p, buf) => new Promise((ok) => { if (!p.stdin.write(buf)) p.stdin.once('drain', ok); else ok(); });
const close = (p) => new Promise((ok) => { p.on('close', ok); p.stdin.end(); });

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--disable-gpu-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/index.html?w=${W}&h=${H}&ao=${ao}${extra ? '&' + extra : ''}`);
await page.waitForFunction('window.sceneReady === true', null, { timeout: 300000 });
console.log('scene ready', JSON.stringify(await page.evaluate('sceneInfo()')));

if (mode === 'stills') {
  const out = opt('out', '../output/stills');
  fs.mkdirSync(out, { recursive: true });
  const times = opt('times', '1').split(',').map(Number);
  for (const t of times) {
    const t0 = Date.now();
    const file = path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`);
    const p = ffmpeg(['-frames:v', '1', file]);
    sink = (buf) => write(p, buf);
    await page.evaluate(([tt]) => window.renderFrame(tt, '/frame'), [t]);
    await close(p);
    console.log(`still t=${t} -> ${file} (${Date.now() - t0} ms)`);
  }
} else if (mode === 'video') {
  const from = +opt('from', 0), to = +opt('to', 1500), rate = +opt('rate', FPS);
  const out = opt('out', '../output/segments/seg.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const crf = opt('crf', '10');
  const tmp = out + '.part.mp4';
  const p = ffmpeg(['-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-tune', 'animation', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', tmp], rate);
  sink = (buf) => write(p, buf);
  const tStart = Date.now();
  for (let f = from; f < to; f++) {
    await page.evaluate(([tt]) => window.renderFrame(tt, '/frame'), [f / rate]);
    if ((f - from) % 10 === 0) {
      const el = (Date.now() - tStart) / 1000, per = el / (f - from + 1);
      console.log(`frame ${f} (${per.toFixed(2)} s/frame, eta ${((to - f) * per / 60).toFixed(1)} min)`);
    }
  }
  await close(p);
  fs.renameSync(tmp, out);
  console.log('wrote', out, ((Date.now() - tStart) / 1000).toFixed(0), 's');
}
await browser.close();
server.close();
