// Launch headless Chromium (SwiftShader WebGL2) and open a page of the project.
import { chromium } from 'playwright-core';
import fs from 'fs';

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
].filter(Boolean);

export async function openPage(port, query, { width = 1080, height = 1920, log = true } = {}) {
  const exe = CANDIDATES.find((p) => fs.existsSync(p));
  const browser = await chromium.launch({
    executablePath: exe,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--js-flags=--max-old-space-size=4096'],
  });
  const page = await browser.newPage({ viewport: { width: Math.min(width, 1920), height: Math.min(height, 1920) } });
  if (log) page.on('console', (m) => { const t = m.text(); if (!/GPU stall|GL Driver Message/.test(t)) console.log('[page]', t); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/src/index.html?${query}`);
  await page.waitForFunction('window.APP && (window.APP.ready || window.APP.error)', null, { timeout: 180000 });
  const err = await page.evaluate('window.APP.error');
  if (err) { await browser.close(); throw new Error('Page init failed: ' + err); }
  return { browser, page };
}
