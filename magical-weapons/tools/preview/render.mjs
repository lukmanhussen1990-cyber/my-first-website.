// Renders one preview scenario (see make_previews.py) in headless Chromium and writes the sheets as PNGs.
//
//     node tools/preview/render.mjs scenario.json [outDir]
//
// Environment:
//   BEDROCK_SAMPLES  checkout of Mojang/bedrock-samples (tag v1.21.0.26-preview): supplies the vanilla
//                    player model and animations the weapons are attached to (required)
//   CHROMIUM_PATH    Chromium/Chrome executable (default: newest Playwright-installed Chromium)
//   PACK_RP          resource pack to preview (default: the scenario's own packRP)
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RIG = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(RIG, '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');

const [scenarioPath, outDir = path.join(RIG, 'out')] = process.argv.slice(2);
if (!scenarioPath) {
  console.error('usage: node render.mjs scenario.json [outDir]');
  process.exit(2);
}
const SAMPLES = process.env.BEDROCK_SAMPLES;
if (!SAMPLES || !fs.existsSync(path.join(SAMPLES, 'resource_pack', 'models', 'mobs.json'))) {
  console.error('Set BEDROCK_SAMPLES to a checkout of https://github.com/Mojang/bedrock-samples (tag v1.21.0.26-preview).');
  process.exit(2);
}

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(os.homedir(), '.cache', 'ms-playwright'),
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')].filter(Boolean);
  const rels = ['chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe'];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const d of dirs) for (const r of rels) if (fs.existsSync(path.join(root, d, r))) return path.join(root, d, r);
  }
  return undefined;                                  // let Playwright resolve its own browser
}

const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const mounts = [
  ['/node_modules/', path.join(TOOLS, 'node_modules') + '/'],
  ['/vanilla/', path.join(SAMPLES, 'resource_pack') + '/'],
  ['/pack/', path.resolve(process.env.PACK_RP || scenario.packRP || '') + '/'],
];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = null;
  for (const [prefix, dir] of mounts) if (url.startsWith(prefix)) { file = path.join(dir, url.slice(prefix.length)); break; }
  if (!file) file = path.join(RIG, url === '/' ? 'viewer.html' : url.slice(1));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found ' + url); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-proxy-server'],
});
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('console', (m) => { const t = m.text(); if (!t.startsWith('[vite]') && !t.startsWith('Failed to load')) console.log('  [page]', t); });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/viewer.html`);
  await page.waitForFunction(() => window.RIG_READY === true, null, { timeout: 30000 });

  const n = await page.evaluate((cfg) => window.RIG.setup(cfg), scenario.setup);
  console.log('loaded geometries:', n);

  for (const sheet of scenario.sheets) {
    const t0 = Date.now();
    const { png, logs } = await page.evaluate((spec) => window.RIG.renderSheet(spec), sheet.spec);
    const out = path.join(outDir, sheet.out);
    fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
    console.log(`wrote ${out} (${Date.now() - t0} ms)`);
    if (sheet.showLogs) console.log('  active anims per tile:', logs);
  }
} finally {
  await browser.close();
  server.close();
}
