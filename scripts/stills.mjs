// Render one or more stills with a single bundle + browser.
// usage: node scripts/stills.mjs <compositionId> <outDir> <frame,frame,...> [propsJSON] [--gl=swangle] [--scale=0.5]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const pos = args.filter((a) => !a.startsWith('--'));
const [compId, outDir, framesArg, propsArg] = pos;
const frames = framesArg.split(',').map((x) => parseInt(x, 10));
const inputProps = propsArg ? JSON.parse(propsArg) : {};
const gl = flags.gl || 'swangle';
const scale = flags.scale ? parseFloat(flags.scale) : 1;
const prefix = flags.prefix || compId;

fs.mkdirSync(outDir, {recursive: true});
const t0 = Date.now();
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), webpackOverride: (c) => c});
const browserExecutable = process.env.RENDER_VIA_PROXY ? path.resolve('scripts/chrome-proxy-wrapper.sh') : null;
const browser = await openBrowser('chrome', {chromiumOptions: {gl}, browserExecutable});
const composition = await selectComposition({serveUrl, id: compId, inputProps, puppeteerInstance: browser, browserExecutable});
console.log(`bundled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
for (const frame of frames) {
	const t1 = Date.now();
	const output = path.join(outDir, `${prefix}_${String(frame).padStart(5, '0')}.png`);
	await renderStill({
		composition,
		serveUrl,
		output,
		frame,
		inputProps,
		scale,
		puppeteerInstance: browser,
		chromiumOptions: {gl},
		browserExecutable,
		timeoutInMilliseconds: 120000,
		onBrowserLog: (log) => {
			if (flags.quiet) return;
			console.log(`[browser ${log.type}] ${log.text}`.slice(0, 2000));
		},
	});
	console.log(`frame ${frame} -> ${output} (${((Date.now() - t1) / 1000).toFixed(1)}s)`);
}
await browser.close({silent: true});
