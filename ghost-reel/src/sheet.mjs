// Contact sheet / arbitrary frame grabs.  usage: node src/sheet.mjs out.jpg [t1 t2 ...] [--cols 6] [--w 360 --h 640] [--cam x,y,z,tx,ty,tz,fov]
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs'; import { execFileSync } from 'node:child_process'; import { serve } from './serve.mjs';
const args = process.argv.slice(2); const out = args.shift(); let times = [], cols = 6, w = 360, h = 640, camO = null;
for (let i = 0; i < args.length; i++) { if (args[i] === '--cols') cols = +args[++i]; else if (args[i] === '--w') w = +args[++i]; else if (args[i] === '--h') h = +args[++i]; else if (args[i] === '--cam') camO = args[++i].split(',').map(Number); else times.push(+args[i]); }
const { srv, port } = await serve(process.cwd());
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: w, height: h } }); p.on('console', m => console.log('[page]', m.text())); p.on('pageerror', e => console.log('[err]', e.message, e.stack));
await p.goto(`http://127.0.0.1:${port}/src/index.html?w=${w}&h=${h}`);
await p.waitForFunction('window.READY', null, { timeout: 120000 });
if (!times.length) times = await p.evaluate('window.INFO.SHEET_TIMES');
const tmp = out + '.tmp'; fs.mkdirSync(tmp, { recursive: true });
let i = 0;
for (const t of times) {
  const url = await p.evaluate(([t, c]) => window.renderAt(t, c), [t, camO]);
  fs.writeFileSync(`${tmp}/f${String(i++).padStart(3, '0')}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
}
await b.close(); srv.close();
const rows = Math.ceil(times.length / cols);
const label = times.map((t, k) => `drawtext=text='${k + 1}  ${t.toFixed(2)}s':x=${(k % cols) * w + 8}:y=${Math.floor(k / cols) * h + 8}:fontsize=20:fontcolor=yellow:box=1:boxcolor=black@0.6:fontfile=assets/fonts/Poppins-ExtraBold.ttf`).join(',');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', `${tmp}/f%03d.jpg`, '-vf', `tile=${cols}x${rows},${label}`, '-frames:v', '1', '-q:v', '3', out]);
fs.rmSync(tmp, { recursive: true }); console.log('wrote', out);
