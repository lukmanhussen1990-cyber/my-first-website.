#!/usr/bin/env node
/*
 * Screenshot a route of the running app in a phone-sized headless Chromium.
 *
 *   node tools/shoot.mjs <route> <out.png> [options]
 *
 *   route        hash route, e.g. /home, /cards/spade, /play/diamond-3
 *                ("/" captures the loading screen itself, --wait ms after it appears)
 *   --base URL   app URL (default http://localhost:5173/)
 *   --guest      start as a signed-in guest (default for protected routes)
 *   --fresh      start signed out with empty storage
 *   --seed N     before navigating, simulate N wins across trials (dev hook)
 *   --wait MS    extra wait after the route settles (default 1200)
 *   --click SEL  click a CSS selector after load (repeatable, in order)
 *   --eval JS    run JS in the page after load (repeatable)
 *   --w / --h    viewport (default 390x844), --dpr (default 2)
 *
 * Relies on the dev-only window.__bt hook exposed in src/main.tsx.
 */
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const route = args[0] ?? '/';
const out = args[1] ?? 'shot.png';
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const all = (name) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));
const base = opt('base', 'http://localhost:5173/');
const fresh = args.includes('--fresh');
const seed = Number(opt('seed', 0));
const wait = Number(opt('wait', 1200));
const W = Number(opt('w', 390));
const H = Number(opt('h', 844));
const dpr = Number(opt('dpr', 2));

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

// Ignore Vite's HMR socket so file edits elsewhere can't reload the page or
// raise the error overlay mid-capture.
await ctx.addInitScript(() => {
  const NativeWS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    if (String(protocols).includes('vite')) {
      return { addEventListener() {}, removeEventListener() {}, send() {}, close() {}, readyState: 0 };
    }
    return new NativeWS(url, protocols);
  };
});

if (!fresh) {
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('bt.session')) localStorage.setItem('bt.guest', '1');
  });
}

await page.goto(base + '#/');
if (route === '/') {
  // Capture the splash itself: --wait is measured from its first paint.
  await page.waitForSelector('[role=progressbar]', { timeout: 20000 });
} else {
  await page.waitForFunction(() => window.__bt && window.__bt.ready(), null, { timeout: 30000 });
}

if (seed > 0) {
  await page.evaluate((n) => window.__bt.simulateWins(n), seed);
}
if (route !== '/' && route !== '') {
  await page.evaluate((r) => window.__bt.navigate(r, { transition: 'none' }), route);
}
await page.waitForTimeout(wait);
for (const sel of all('click')) {
  await page.click(sel, { timeout: 5000 }).catch((e) => errors.push(`click ${sel}: ${e.message}`));
  await page.waitForTimeout(600);
}
for (const js of all('eval')) {
  await page.evaluate(js).catch((e) => errors.push(`eval: ${e.message}`));
  await page.waitForTimeout(600);
}
mkdirSync(dirname(out) || '.', { recursive: true });
await page.screenshot({ path: out });
if (errors.length) console.log('PAGE ERRORS:\n  ' + errors.join('\n  '));
console.log(`saved ${out}`);
await browser.close();
