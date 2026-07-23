const { chromium } = require('playwright');
const path = require('path');

const FRAMES_DIR = process.argv[2];
const HTML = 'file://' + path.resolve(__dirname, 'logo.html');
const FPS = 30;
const DURATION = 4;            // seconds
const TOTAL = FPS * DURATION;  // frames

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  await page.goto(HTML);
  await page.waitForFunction('window.__ready === true');

  for (let f = 0; f < TOTAL; f++) {
    const t = f / (TOTAL - 1);
    await page.evaluate((tt) => window.drawFrame(tt), t);
    const name = String(f).padStart(4, '0');
    await page.locator('#c').screenshot({ path: path.join(FRAMES_DIR, `frame_${name}.png`) });
  }

  await browser.close();
  console.log('rendered ' + TOTAL + ' frames');
})();
