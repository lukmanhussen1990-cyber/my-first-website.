// Render still frames to PNG for previews / QA.
// Usage:
//   node render/shoot.mjs --q "entry=test&scene=studio" --times 0,1.5 --out out/previews/name [--w 540 --h 960]
//   --views "az=0&el=10;az=90&el=5"   (optional: re-render each time with each param set, appended to filename)
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { startServer } from './server.mjs';
import { openPage } from './browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const w = +(args.w || 540), h = +(args.h || 960);
const times = (args.times || '0').split(',').map(Number);
const views = args.views ? args.views.split(';') : [''];
const out = path.resolve(ROOT, args.out || 'out/previews/shot');
fs.mkdirSync(path.dirname(out), { recursive: true });

const { srv, port } = await startServer(ROOT);
const t0 = Date.now();
const { browser, page } = await openPage(port, `${args.q || 'entry=test&scene=studio'}&w=${w}&h=${h}`, { width: w, height: h });
try {
  for (const [vi, v] of views.entries()) {
    const vp = Object.fromEntries(new URLSearchParams(v).entries());
    await page.evaluate((p) => window.APP.setParams(p), vp);
    for (const t of times) {
      const frame = Math.round(t * 30);
      const dataUrl = await page.evaluate(([tt, fr]) => { window.APP.renderAt(tt, fr); return window.APP.stage.renderer.domElement.toDataURL('image/png'); }, [t, frame]);
      const suffix = (views.length > 1 ? `_v${vi}` : '') + `_t${t.toFixed(2)}`;
      const file = `${out}${suffix}.png`;
      fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
      console.log('wrote', path.relative(ROOT, file));
    }
  }
  const err = await page.evaluate('window.APP.error');
  if (err) console.log('PAGE ERROR:', err);
} finally {
  await browser.close();
  srv.close();
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
