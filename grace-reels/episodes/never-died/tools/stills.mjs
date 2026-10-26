// Quick look-dev: bundle once, then render many stills with one browser.
// Usage: node tools/stills.mjs <outDir> <frame|t=seconds>[,...] [--comp=Reel] [--scale=0.5] [--props='{"only":"S2"}']
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';

const [outDir, list, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const comp = opt.comp ?? 'Reel';
const scale = Number(opt.scale ?? 0.5);
const props = opt.props ? JSON.parse(opt.props) : {};
fs.mkdirSync(outDir, {recursive: true});

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
const browser = await openBrowser('chrome', {chromiumOptions: {gl: 'swangle'}});
const composition = await selectComposition({serveUrl, id: comp, inputProps: props, puppeteerInstance: browser, chromiumOptions: {gl: 'swangle'}});
for (const item of list.split(',')) {
	const frame = item.startsWith('t=') ? Math.round(Number(item.slice(2)) * composition.fps) : Number(item);
	const output = path.join(outDir, `${comp.toLowerCase()}_${String(frame).padStart(4, '0')}.png`);
	const t0 = Date.now();
	await renderStill({serveUrl, composition, frame, output, inputProps: props, scale, puppeteerInstance: browser, chromiumOptions: {gl: 'swangle'}, imageFormat: 'png'});
	console.log(`${output}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
await browser.close({silent: true});
