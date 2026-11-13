// Render still frames: node stills.mjs out/stills 30 90 440 ...
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const [outDir, ...frames] = process.argv.slice(2);
fs.mkdirSync(outDir, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), onProgress: () => {}});
const chromiumOptions = {gl: 'swangle'};
const browser = await openBrowser('chrome', {browserExecutable: '/opt/pw-browsers/chromium', chromiumOptions});
const inputProps = {...(process.env.NOPOST ? {noPost: true} : {}), ...(process.env.FX ? {fx: process.env.FX} : {})};
const composition = await selectComposition({serveUrl, id: process.env.COMP ?? 'AuraVideo', inputProps, puppeteerInstance: browser, browserExecutable: '/opt/pw-browsers/chromium', chromiumOptions});
for (const fr of frames.map(Number)) {
  const t0 = Date.now();
  await renderStill({
    composition,
    serveUrl,
    frame: fr,
    inputProps,
    output: path.join(outDir, `${process.env.TAG ?? 'f'}${String(fr).padStart(4, '0')}.jpg`),
    imageFormat: 'jpeg',
    jpegQuality: 88,
    puppeteerInstance: browser,
    browserExecutable: '/opt/pw-browsers/chromium',
    chromiumOptions,
    onBrowserLog: (l) => { if (l.type !== 'log' || process.env.ALLLOG) console.log('[browser]', l.text.slice(0, 300)); },
  });
  console.log('frame', fr, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
await browser.close({silent: true});
