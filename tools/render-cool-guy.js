/*
 * Renders cool-guy.js to a PNG with headless Chromium.
 *   node tools/render-cool-guy.js [size] [outfile]
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SIZE = Number(process.argv[2]) || 1600;
const OUT = process.argv[3] || path.join(__dirname, '..', 'cool-guy.png');

(async () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'cool-guy.js'), 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<canvas id="c" width="' + SIZE + '" height="' + SIZE + '"></canvas>');
  await page.addScriptTag({ content: script });
  const dataUrl = await page.evaluate((size) => {
    const c = document.getElementById('c');
    drawCoolGuy(c.getContext('2d'), size, size);
    return c.toDataURL('image/png');
  }, SIZE);
  await browser.close();
  fs.writeFileSync(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote ' + OUT);
})();
