// Resumable frame render: bundles once, renders only the frames that are not on disk yet
// (JPEG, same settings as remotion.config.ts), so a container restart loses at most
// the frames in flight. Encode the folder afterwards with tools/encode_frames.sh.
//   node tools/render_frames.mjs <CompositionId> <outDir> [concurrency]
import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderFrames, selectComposition} from '@remotion/renderer';

const [id = 'SunsetRule', outDir = 'out/frames', concurrency = '2'] = process.argv.slice(2);
const SHELL = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const browserExecutable = fs.existsSync(SHELL) ? SHELL : null;
const chromiumOptions = {gl: 'swangle'};

// A frame counts as done only if its JPEG is complete (ends with the EOI marker).
const complete = (file) => {
	try {
		const fd = fs.openSync(file, 'r');
		const {size} = fs.fstatSync(fd);
		const tail = Buffer.alloc(2);
		fs.readSync(fd, tail, 0, 2, size - 2);
		fs.closeSync(fd);
		return size > 1000 && tail[0] === 0xff && tail[1] === 0xd9;
	} catch {
		return false;
	}
};

const scan = () => {
	const done = new Set();
	for (const name of fs.readdirSync(outDir)) {
		const m = /^element-(\d+)\.jpeg$/.exec(name);
		if (!m) continue;
		const file = path.join(outDir, name);
		if (complete(file)) done.add(Number(m[1]));
		else fs.rmSync(file);
	}
	return done;
};

fs.mkdirSync(outDir, {recursive: true});
const log = (s) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions});
const composition = await selectComposition({serveUrl, id, inputProps: {}, puppeteerInstance: browser, chromiumOptions});
const total = composition.durationInFrames;
const done = scan();
const frames = Array.from({length: total}, (_, f) => f).filter((f) => !done.has(f));
log(`${id}: ${total} frames, ${done.size} already on disk, ${frames.length} to render`);

if (frames.length) {
	const t0 = Date.now();
	let n = 0;
	await renderFrames({
		composition,
		serveUrl,
		inputProps: {},
		outputDir: outDir,
		frames,
		imageFormat: 'jpeg',
		jpegQuality: 95,
		concurrency: Number(concurrency),
		puppeteerInstance: browser,
		chromiumOptions,
		timeoutInMilliseconds: 120000,
		onStart: () => log('rendering'),
		onFrameUpdate: () => {
			n++;
			if (n % 10 === 0 || n === frames.length) {
				const per = (Date.now() - t0) / 1000 / n;
				const left = (frames.length - n) * per;
				log(`frames ${done.size + n}/${total}  ${per.toFixed(2)} s/frame  ~${Math.ceil(left / 60)} min left`);
			}
		},
	});
}
await browser.close({silent: true});
const missing = Array.from({length: total}, (_, f) => f).filter((f) => !scan().has(f));
log(missing.length ? `MISSING ${missing.length} frames` : `ALL ${total} FRAMES DONE`);
process.exit(missing.length ? 1 : 0);
