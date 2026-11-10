// usage: node src/still.mjs out.jpg "x,y,z,tx,ty,tz,fov" ["x,y,..." ...]  [--w 540 --h 960] [--eval "js"]
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs'; import { serve } from './serve.mjs';
const args = process.argv.slice(2); const out = args.shift(); const cams = []; let w = 540, h = 960, ev = null, fn = 'renderCam';
for (let i = 0; i < args.length; i++) { if (args[i] === '--w') w = +args[++i]; else if (args[i] === '--h') h = +args[++i]; else if (args[i] === '--eval') ev = args[++i]; else if (args[i] === '--t') fn = 'renderAt'; else cams.push(args[i]); }
const { srv, port } = await serve(process.cwd());
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: w, height: h } }); p.on('console', m => console.log('[page]', m.text())); p.on('pageerror', e => console.log('[err]', e.message, e.stack));
await p.goto(`http://127.0.0.1:${port}/src/index.html?w=${w}&h=${h}`);
await p.waitForFunction('window.READY', null, { timeout: 120000 });
if (ev) console.log(JSON.stringify(await p.evaluate(ev)));
let i = 0;
for (const c of cams) {
  const t0 = Date.now();
  const arg = fn === 'renderAt' ? c.split('@').map((s, k) => k === 0 ? +s : s.split(',').map(Number)) : c.split(',').map(Number);
  const url = await p.evaluate(([f, a]) => f === 'renderAt' ? window.renderAt(a[0], a[1]) : window.renderCam(a), [fn, arg]);
  const f = cams.length > 1 ? out.replace(/(\.\w+)$/, `_${i}$1`) : out; i++;
  fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log(f, Date.now() - t0, 'ms');
}
await b.close(); srv.close();
