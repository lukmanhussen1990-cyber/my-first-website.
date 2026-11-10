// Render frames headlessly. usage: node src/render.mjs outDir [w h startFrame endFrame]
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs'; import { serve } from './serve.mjs';
const [out, w = 288, h = 512, s = 0, e = -1] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const { srv, port } = await serve(process.cwd());
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto(`http://127.0.0.1:${port}/src/index.html?w=${w}&h=${h}`);
await p.waitForFunction('window.READY', null, { timeout: 180000 });
const N = Math.round((await p.evaluate('window.INFO.DURATION')) * 30); const end = +e < 0 ? N : Math.min(N, +e);
for (let f = +s; f < end; f++) {
  const file = `${out}/f${String(f).padStart(4, '0')}.jpg`; if (fs.existsSync(file)) continue;
  const url = await p.evaluate((t) => window.renderAt(t), f / 30);
  fs.writeFileSync(file + '.part', Buffer.from(url.split(',')[1], 'base64')); fs.renameSync(file + '.part', file);
}
await b.close(); srv.close(); console.log('done', s, end);
