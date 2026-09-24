// Smoke test: load the built game, press START, hold some inputs, screenshot, report errors.
//   node tests/smoke.mjs [dist/index.html] [tests/out/smoke] [--mobile]
import { launch, open, errorsIn, shot } from './lib.mjs';

const html = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'dist/index.html';
const outDir = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'tests/out/smoke';
const mobile = process.argv.includes('--mobile');

const { browser, page, logs } = await launch({ mobile });
await open(page, html);
await page.waitForTimeout(1500);
await shot(page, outDir, '01_title');
await page.evaluate(() => window.__game && window.__game.start && window.__game.start());
await page.waitForTimeout(500);
// fall back: click anything that looks like a start button
if (await page.evaluate(() => window.__game && window.__game.state === 'title')) {
  await page.mouse.click(640, 400);
}
await page.waitForTimeout(1500);
await shot(page, outDir, '02_playing');
await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(160); }
await shot(page, outDir, '03_combo');
await page.keyboard.press('KeyK'); await page.waitForTimeout(600);
await shot(page, outDir, '04_charge');
const info = await page.evaluate(() => {
  const g = window.__game || {};
  return { state: g.state, fps: g.fps, soldiers: g.soldiers && g.soldiers(), stats: g.stats };
});
console.log('game:', JSON.stringify(info));
const errs = errorsIn(logs);
console.log(`console lines: ${logs.length}, errors: ${errs.length}`);
for (const l of errs.slice(0, 20)) console.log(l);
await browser.close();
process.exit(errs.length ? 1 : 0);
