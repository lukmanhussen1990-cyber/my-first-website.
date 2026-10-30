// Render many stills in one browser session: node tools/stills.mjs OUTDIR frame1 frame2 ...
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';

const [outDir, ...frames] = process.argv.slice(2);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public')});
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions: {gl: 'swangle'}});
const composition = await selectComposition({serveUrl, id: process.env.COMP ?? 'MoneyRoad', puppeteerInstance: browser, browserExecutable, chromiumOptions: {gl: 'swangle'}});
for (const f of frames) {
  const t0 = Date.now();
  await renderStill({composition, serveUrl, frame: Number(f), output: path.join(outDir, `f${f}.png`), puppeteerInstance: browser, browserExecutable, chromiumOptions: {gl: 'swangle'}});
  console.log(`frame ${f} ${Date.now() - t0}ms`);
}
await browser.close({silent: true});
