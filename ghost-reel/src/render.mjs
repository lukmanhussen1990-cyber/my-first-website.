// Render all frames headlessly. usage: node src/render.mjs outDir [w h]
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs'; import { serve } from './serve.mjs';
const [out, w = 288, h = 512] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const { srv, port } = await serve(process.cwd());
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto(`http://127.0.0.1:${port}/src/index.html?w=${w}&h=${h}`);
await p.waitForFunction('window.READY', null, { timeout: 120000 });
const N = Math.round((await p.evaluate('window.INFO.DURATION')) * 30);
for (let f = 0; f < N; f++) {
  const url = await p.evaluate((t) => window.renderAt(t), f / 30);
  fs.writeFileSync(`${out}/f${String(f).padStart(4, '0')}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
}
await b.close(); srv.close(); console.log('frames', N);
