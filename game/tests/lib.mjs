// Shared Playwright helpers for headless testing (Chromium + SwiftShader WebGL).
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

export const GL_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required',
];

// mobile: emulate a landscape Android phone (touch, DPR 2.5, 915x412 CSS px)
export async function launch({ mobile = false, width = 1280, height = 720 } = {}) {
  const browser = await chromium.launch({ args: GL_ARGS });
  const context = await browser.newContext(mobile
    ? { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36' }
    : { viewport: { width, height } });
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
  return { browser, context, page, logs };
}

export async function open(page, htmlPath, query = '') {
  const url = 'file://' + path.resolve(htmlPath) + (query ? '?' + query : '');
  await page.goto(url, { waitUntil: 'load' });
}

export function errorsIn(logs) {
  return logs.filter((l) => l.startsWith('[pageerror]') || l.startsWith('[error]'));
}

export async function shot(page, outDir, name) {
  fs.mkdirSync(outDir, { recursive: true });
  const p = path.join(outDir, name + '.png');
  await page.screenshot({ path: p });
  return p;
}
