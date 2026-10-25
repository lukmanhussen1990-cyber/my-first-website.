// Dump the timeline's SFX cue list (build/cues.json) for scripts/audio.py
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { start } = require('./server.cjs');
(async () => {
  const { srv, port } = await start();
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto(`http://127.0.0.1:${port}/index.html`);
  await p.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 180000 });
  const cues = await p.evaluate(() => window.getCues());
  const out = path.resolve(__dirname, '..', 'build', 'cues.json');
  fs.writeFileSync(out, JSON.stringify(cues, null, 1));
  console.log('wrote', out, cues.cues.length, 'cues', cues.beds.length, 'beds', 'duration', cues.duration);
  await b.close(); srv.close();
})();
