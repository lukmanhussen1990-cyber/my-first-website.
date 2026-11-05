// Launch headless Chromium with software WebGL (works on GPU-less CI boxes / containers).
import { createRequire } from 'node:module';
import { serve } from '../serve.mjs';

const require = createRequire(import.meta.url);

export async function openPage({ scale = 1, debug = false } = {}) {
  const { chromium } = require('playwright');
  const server = await serve(0);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  const q = new URLSearchParams({ render: '1', scale: String(scale) });
  if (debug) q.set('debug', '1');
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?${q}`);
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  return {
    page,
    async close() { await browser.close(); server.close(); },
  };
}
