// Render frames with Playwright (headless Chromium WebGL) and write PNGs.
// usage: node render.js --out DIR --w 1080 --h 1920 --fps 30 --workers 3 [--times 1.2,3.4] [--start 0 --end N]
const { chromium } = require('playwright');
const route = require('./serve.js');
const fs = require('fs'), path = require('path');
const A = {}; process.argv.slice(2).forEach((a, i, arr) => { if (a.startsWith('--')) A[a.slice(2)] = arr[i + 1]; });
const out = A.out || 'frames'; fs.mkdirSync(out, { recursive: true });
const w = +(A.w || 1080), h = +(A.h || 1920), fps = +(A.fps || 30), workers = +(A.workers || 2);
const DUR = 34.50775;
let jobs;
if (A.times) jobs = A.times.split(',').map((s, i) => ({ t: +s, file: path.join(out, `t_${String(i).padStart(3, '0')}_${(+s).toFixed(2)}.png`) }));
else {
  const n = Math.ceil(DUR * fps - 1e-6);
  const s0 = +(A.start || 0), s1 = Math.min(n, +(A.end || n));
  jobs = []; for (let i = s0; i < s1; i++) jobs.push({ t: i / fps, file: path.join(out, `f_${String(i).padStart(5, '0')}.png`) });
  if (!A.force) jobs = jobs.filter((j) => !fs.existsSync(j.file));
}
const extra = `&shadow=${A.shadow || 2048}&msaa=${A.msaa || 4}`;
(async () => {
  const t0 = Date.now(); let done = 0;
  const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  async function worker(k) {
    const b = await chromium.launch({ args });
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    p.on('pageerror', (e) => console.log('pageerror', e.message));
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.text()); });
    await route(p, __dirname);
    await p.goto(`http://local/index.html?w=${w}&h=${h}${extra}`);
    await p.waitForFunction(() => window.ready === true, null, { timeout: 600000 });
    const cdp = await p.context().newCDPSession(p);
    for (let i = k; i < jobs.length; i += workers) {
      const j = jobs[i];
      await p.evaluate((t) => window.renderAt(t), j.t);
      const r = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
      fs.writeFileSync(j.file, Buffer.from(r.data, 'base64'));
      done++;
      if (done % 20 === 0 || jobs.length < 60) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${jobs.length} ${el.toFixed(0)}s eta ${((el / done) * (jobs.length - done)).toFixed(0)}s`); }
    }
    await b.close();
  }
  await Promise.all([...Array(Math.min(workers, jobs.length || 1)).keys()].map(worker));
  console.log('done', jobs.length, 'frames in', ((Date.now() - t0) / 1000).toFixed(1), 's');
})();
