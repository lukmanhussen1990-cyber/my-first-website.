// Debug helper: render time t with categories of objects hidden, to find visual culprits.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { startServer } from './server.mjs';
const srv = await startServer();
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: false, args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto(`http://127.0.0.1:${srv.address().port}/scene/index.html?ao=0`);
await p.waitForFunction('window.__ready && window.setup'); await p.evaluate('window.setup()');
const t = +process.argv[2] || 1.0;
const modes = process.argv.slice(3);
for (const mode of modes) {
  const info = await p.evaluate(([mode, t]) => {
    window.renderAt(t); const S = window.__scene; const hidden = [];
    S.traverse((o) => {
      const hit = (mode === 'sprites' && o.isSprite) || (mode === 'transparent' && o.material && o.material.transparent && !o.isSprite) ||
        (mode === 'instanced' && o.isInstancedMesh) || (mode === 'shader' && o.material && o.material.isShaderMaterial) || (mode === 'pointlight' && o.isPointLight);
      if (mode === 'nobloom') window.__bloom.enabled = false;
      if (hit && o.visible) { o.visible = false; hidden.push((o.type) + ':' + (o.material?.type || '') + ':' + (o.name || '') + ':' + o.position.toArray().map((v) => v.toFixed(2)).join(',')); }
    });
    window.renderOnly(); return hidden.slice(0, 30);
  }, [mode, t]);
  const img = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.6));
  fs.writeFileSync(`build/dbg_${mode}.jpg`, Buffer.from(img.split(',')[1], 'base64'));
  console.log(mode, JSON.stringify(info));
}
await b.close(); srv.close();
