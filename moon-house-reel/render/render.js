// Frame renderer: drives headless Chromium (SwiftShader WebGL) and writes PNG frames.
// usage: node render/render.js --frames 0:1650 [--out build/frames] [--workers 2]
//        node render/render.js --stills 3.0,11.0 --out build/stills [--scale 0.5]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]]) : a), []));
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'scene/timeline.json')));
const FPS = TL.fps, scale = +(args.scale || 1);
const W = Math.round(TL.width * scale), H = Math.round(TL.height * scale);
const out = path.resolve(ROOT, args.out || 'build/frames');
fs.mkdirSync(out, { recursive: true });
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((q, r) => {
      const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
      fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
    }).listen(0, () => res(srv));
  });
}
async function worker(srv, jobs, id) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--js-flags=--max-old-space-size=6000'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[w${id}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => console.log(`[w${id}] pageerror: ${e.message}`));
  await page.goto(`http://localhost:${srv.address().port}/scene/index.html?w=${W}&h=${H}&msaa=${args.msaa ?? 4}`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 600000 });
  console.log(`[w${id}] ready in ${(await page.evaluate(() => window.buildMs)).toFixed(0)} ms`);
  while (jobs.length) {
    const job = jobs.shift();
    const t1 = Date.now();
    if (args.eval) await page.evaluate((code) => { window.__evalHook = new Function('S', code); }, String(args.eval));
    await page.evaluate((t) => { window.__story.update(t); if (window.__evalHook) window.__evalHook(window.__story); return window.renderAt(t, true); }, job.t);
    const url = await page.evaluate(() => window.grab());
    fs.writeFileSync(job.file, Buffer.from(url.split(',')[1], 'base64'));
    if (job.log) console.log(`[w${id}] ${path.basename(job.file)} t=${job.t.toFixed(3)} ${Date.now() - t1} ms`);
  }
  await browser.close();
}
(async () => {
  const srv = await serve();
  let jobs = [];
  if (args.stills) {
    jobs = String(args.stills).split(',').map((s) => ({ t: +s, file: path.join(out, `still_${(+s).toFixed(2)}.png`), log: true }));
  } else {
    const [a, b] = String(args.frames || `0:${Math.round(TL.duration * FPS)}`).split(':').map(Number);
    const step = +(args.step || 1);
    for (let f = a; f < b; f += step) {
      const file = path.join(out, `f_${String(f).padStart(5, '0')}.png`);
      if (args.resume && fs.existsSync(file) && fs.statSync(file).size > 1000) continue;
      jobs.push({ t: f / FPS, file, log: f % 10 === 0 });
    }
  }
  const nw = Math.min(+(args.workers || 1), jobs.length || 1);
  const t0 = Date.now();
  await Promise.all(Array.from({ length: nw }, (_, i) => worker(srv, jobs, i)));
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  srv.close();
})();
