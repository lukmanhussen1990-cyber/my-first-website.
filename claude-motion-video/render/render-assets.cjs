// Renders the artifact cards in src/assets.html to PNGs in assets/.
// Usage: node render/render-assets.cjs [cardId ...]
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { startServer } = require('./server.cjs');

const ROOT = path.resolve(__dirname, '..');
const CARDS = {
  landing: { w: 1200, h: 1600, dpr: 0.75 },
  herowide: { w: 1440, h: 560, dpr: 1 },
  app: { w: 450, h: 600, dpr: 2 },
  dashboard: { w: 1200, h: 1600, dpr: 0.75 },
  code: { w: 750, h: 1000, dpr: 1.2 },
  terminal: { w: 750, h: 1000, dpr: 1.2 },
  doc: { w: 750, h: 1000, dpr: 1.2 },
  poster: { w: 600, h: 800, dpr: 1.5 },
  chat: { w: 600, h: 800, dpr: 1.5 },
  brand: { w: 750, h: 1000, dpr: 1.2 },
  data: { w: 900, h: 1200, dpr: 1 },
  screen: { w: 1600, h: 1000, dpr: 1 },
  menu: { w: 600, h: 800, dpr: 1.5 },
  email: { w: 600, h: 800, dpr: 1.5 },
  research: { w: 750, h: 1000, dpr: 1.2 },
  slides: { w: 600, h: 800, dpr: 1.5 },
};

(async () => {
  const only = process.argv.slice(2);
  const ids = only.length ? only : Object.keys(CARDS);
  const { server, port } = await startServer(ROOT);
  const browser = await chromium.launch();
  fs.mkdirSync(path.join(ROOT, 'assets'), { recursive: true });
  for (const id of ids) {
    const spec = CARDS[id];
    const ctx = await browser.newContext({ viewport: { width: spec.w, height: spec.h }, deviceScaleFactor: spec.dpr });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[${id}] pageerror:`, e.message));
    await page.goto(`http://127.0.0.1:${port}/src/assets.html?only=${id}`);
    await page.evaluate(() => window.assetsReady);
    await page.waitForTimeout(150);
    const el = await page.$(`#${id}`);
    await el.screenshot({ path: path.join(ROOT, 'assets', `${id}.png`), omitBackground: true });
    console.log('rendered', id);
    await ctx.close();
  }
  await browser.close();
  server.close();
})();
