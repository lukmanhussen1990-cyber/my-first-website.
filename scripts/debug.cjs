// node scripts/debug.cjs <t> "<js expression evaluated after renderAt(t)>"
const { chromium } = require('playwright');
const { start } = require('./server.cjs');
(async () => {
  const [t = '1', expr = 'null'] = process.argv.slice(2);
  const { srv, port } = await start();
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 180000 });
  console.log(await page.evaluate(([tt, ex]) => { window.renderAt(parseFloat(tt)); return JSON.stringify(eval(ex), null, 1); }, [t, expr]));
  await browser.close(); srv.close();
})();
