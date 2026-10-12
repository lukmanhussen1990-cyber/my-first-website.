// Node side of the renderer: drives three.js inside headless Chromium (Playwright) through a
// virtual origin. All scene data is computed in Node; the page only draws.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function findChromium() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean);
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    const dirs = fs.readdirSync(r).filter((d) => /^chromium_headless_shell-\d+$/.test(d) || /^chromium-\d+$/.test(d)).sort().reverse();
    for (const d of dirs) {
      const cands = [
        path.join(r, d, 'chrome-linux', 'headless_shell'),
        path.join(r, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
        path.join(r, d, 'chrome-linux', 'chrome'),
        path.join(r, d, 'chrome-linux64', 'chrome'),
      ];
      for (const c of cands) if (fs.existsSync(c)) return c;
    }
  }
  return undefined;
}

export class BrowserRenderer {
  static async launch() {
    if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync('/opt/pw-browsers')) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';
    const { chromium } = await import('playwright-core');
    const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
    let browser;
    try {
      browser = await chromium.launch({ args });
    } catch (e) {
      const exe = findChromium();
      if (!exe) throw e;
      browser = await chromium.launch({ args, executablePath: exe });
    }
    const r = new BrowserRenderer();
    r.browser = browser;
    r.page = await browser.newPage();
    r.page.on('pageerror', (e) => { r.lastError = e; console.error('[page error]', e.message); });
    r.page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
    const threePath = require.resolve('three').replace(/three\.cjs$/, 'three.module.js');
    const threeFile = fs.existsSync(threePath) ? threePath : path.join(here, '..', 'node_modules', 'three', 'build', 'three.module.js');
    const files = {
      '/index.html': { body: '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#000"><canvas id="c"></canvas><script type="module" src="/page.mjs"></script></body></html>', type: 'text/html' },
      '/page.mjs': { file: path.join(here, 'page.mjs'), type: 'text/javascript' },
      '/three.module.js': { file: threeFile, type: 'text/javascript' },
    };
    await r.page.route('http://viewer.local/**', async (route) => {
      const u = new URL(route.request().url());
      const f = files[u.pathname];
      if (!f) return route.fulfill({ status: 404, body: 'not found' });
      return route.fulfill({ status: 200, contentType: f.type, body: f.body ?? fs.readFileSync(f.file) });
    });
    await r.page.goto('http://viewer.local/index.html');
    await r.page.waitForFunction(() => typeof window.viewerSetup === 'function', null, { timeout: 30000 });
    return r;
  }

  async setup(cfg) {
    await this.page.setViewportSize({ width: cfg.width, height: cfg.height });
    await this.page.evaluate((c) => window.viewerSetup(c), cfg);
  }

  async render(frame) {
    const url = await this.page.evaluate((f) => window.viewerRender(f), frame);
    return Buffer.from(url.split(',')[1], 'base64');
  }

  async sheet(tiles, cols, title) {
    const url = await this.page.evaluate((s) => window.viewerSheet(s), {
      tiles: tiles.map((b) => `data:image/png;base64,${b.toString('base64')}`),
      cols,
      title,
    });
    return Buffer.from(url.split(',')[1], 'base64');
  }

  async close() { await this.browser.close(); }
}
