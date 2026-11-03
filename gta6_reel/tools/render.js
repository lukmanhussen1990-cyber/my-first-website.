#!/usr/bin/env node
// Frame renderer: serves the project over a local HTTP server, drives the
// Three.js page with Playwright and saves JPEG frames.
//
//   node tools/render.js frames --w 1080 --h 1920 --fps 30 --workers 3 --out build/frames
//   node tools/render.js snap --times 1.2,5.5 --out build/snaps
//   node tools/render.js sfx --out build/sfx_events.json
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const mode = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function openPage(browser, port, w, h, timeline, extra = '') {
  const page = await browser.newPage({ viewport: { width: Math.min(w, 1080), height: Math.min(h, 1920) } });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  const tl = timeline ? '&timeline=' + encodeURIComponent(timeline) : '';
  await page.goto(`http://127.0.0.1:${port}/web/index.html?w=${w}&h=${h}${tl}${extra}`);
  await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
  return page;
}

const LAUNCH = { args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] };

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  const w = +opt('w', 1080), h = +opt('h', 1920);
  const timeline = opt('timeline', null);
  const out = path.resolve(opt('out', path.join(ROOT, 'build', 'frames')));
  if (mode !== 'sfx' && mode !== 'check') fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(LAUNCH);
  try {
    if (mode === 'snap') {
      const page = await openPage(browser, port, w, h, timeline);
      const times = opt('times', '1').split(',').map(Number);
      for (const t of times) {
        const d = await page.evaluate(([t]) => window.renderFrame(t, 0.9), [t]);
        const info = await page.evaluate(([t]) => window.sceneInfo(t), [t]);
        const f = path.join(out, `snap_${t.toFixed(2)}.jpg`);
        fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64'));
        console.log(f, JSON.stringify(info));
      }
    } else if (mode === 'debug') {
      // --views "t|x,y,z|lx,ly,lz|fov;..."
      const page = await openPage(browser, port, w, h, timeline);
      let n = 0;
      for (const v of opt('views', '').split(';').filter(Boolean)) {
        const [t, p, l, f] = v.split('|');
        const d = await page.evaluate(([t, p, l, f]) => window.renderDebug(t, p, l, f), [+t, p.split(',').map(Number), l.split(',').map(Number), +(f || 40)]);
        const file = path.join(out, `dbg_${n++}.jpg`);
        fs.writeFileSync(file, Buffer.from(d.split(',')[1], 'base64'));
        console.log(file);
      }
    } else if (mode === 'check') {
      // render every frame with the private area painted magenta and verify
      // that every visible magenta pixel is under the mosaic
      const fps = +opt('fps', 30), workers = +opt('workers', 4);
      const probe = await openPage(browser, port, 64, 114, timeline);
      const dur = await probe.evaluate('window.TIMELINE.duration');
      await probe.close();
      const N = Math.ceil(dur * fps - 1e-6);
      const res = new Array(N);
      let next = 0;
      const work = async () => {
        const page = await openPage(browser, port, w, h, timeline, '&check=1');
        for (;;) {
          const i = next++;
          if (i >= N) break;
          await page.evaluate(([t]) => window.renderFrame(t, 0), [i / fps]);
          res[i] = { f: i, t: +(i / fps).toFixed(3), ...(await page.evaluate('window.censorInfo()')) };
        }
        await page.close();
      };
      await Promise.all(Array.from({ length: workers }, work));
      const naked = res.filter(r => r.naked), visible = res.filter(r => r.pixels > 0);
      const bad = res.filter(r => r.check && r.check.uncovered > 0);
      fs.writeFileSync(opt('out', path.join(ROOT, 'build', 'censor_check.json')), JSON.stringify({ frames: N, naked: naked.length, privateVisible: visible.length, failures: bad }, null, 1));
      console.log(`frames ${N}; YOU naked in ${naked.length}; private zone on screen in ${visible.length}; frames with uncovered private pixels: ${bad.length}`);
      bad.slice(0, 20).forEach(b => console.log('  FAIL', JSON.stringify(b)));
    } else if (mode === 'sfx') {
      const page = await openPage(browser, port, 64, 114, timeline);
      const ev = await page.evaluate('window.sfxEvents()');
      fs.writeFileSync(opt('out', path.join(ROOT, 'build', 'sfx_events.json')), JSON.stringify(ev, null, 1));
      console.log(`${ev.length} sound events`);
    } else if (mode === 'frames') {
      const fps = +opt('fps', 30), workers = +opt('workers', 3), quality = +opt('quality', 0.92);
      const probe = await openPage(browser, port, 64, 114, timeline);
      const dur = await probe.evaluate('window.TIMELINE.duration');
      await probe.close();
      const N = Math.ceil(dur * fps - 1e-6);
      const start = +opt('start', 0), end = Math.min(N, +opt('end', N));
      console.log(`rendering frames ${start}..${end - 1} of ${N} (${dur}s @ ${fps}fps) at ${w}x${h} with ${workers} workers`);
      let next = start, done = 0;
      const t0 = Date.now();
      const work = async () => {
        const page = await openPage(browser, port, w, h, timeline);
        for (;;) {
          const i = next++;
          if (i >= end) break;
          const f = path.join(out, `f_${String(i).padStart(5, '0')}.jpg`);
          if (fs.existsSync(f) && !args.includes('--force')) { done++; continue; }
          const d = await page.evaluate(([t, q]) => window.renderFrame(t, q), [i / fps, quality]);
          fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64'));
          done++;
          if (done % 60 === 0) {
            const el = (Date.now() - t0) / 1000;
            console.log(`${done}/${end - start} frames, ${(el / done).toFixed(2)}s/frame, eta ${((end - start - done) * el / done / 60).toFixed(1)} min`);
          }
        }
        await page.close();
      };
      await Promise.all(Array.from({ length: workers }, work));
      console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    } else {
      console.log('usage: render.js frames|snap|sfx [--w --h --fps --workers --out --times --timeline]');
    }
  } finally {
    await browser.close();
    srv.close();
  }
})();
