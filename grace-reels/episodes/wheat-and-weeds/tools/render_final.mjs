// Final render at full quality: the code is bundled once (so later edits can't change chunks halfway), the
// frames are rendered in resumable chunks (a restart only loses the chunk in progress), then the chunks are
// joined without re-encoding and the final mix is added as AAC 48 kHz.
// Run: node tools/render_final.mjs   (output: out/reel_wheat-and-weeds.mp4)
import {bundle} from '@remotion/bundler';
import {openBrowser, renderMedia, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'out/reel_wheat-and-weeds.mp4';
const CHUNK = 300;
const props = {lite: false, muted: true};
const dir = path.resolve('out/chunks');
fs.mkdirSync(dir, {recursive: true});
const tl = JSON.parse(fs.readFileSync('timeline.json', 'utf8'));
const N = tl.durationInFrames;

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
const browser = await openBrowser('chrome', {chromiumOptions: {gl: 'swangle'}});
const composition = await selectComposition({serveUrl, id: 'Reel', inputProps: props, puppeteerInstance: browser, chromiumOptions: {gl: 'swangle'}, timeoutInMilliseconds: 300000});
const chunks = [];
for (let k = 0, f0 = 0; f0 < N; k++, f0 += CHUNK) {
	const f1 = Math.min(N, f0 + CHUNK) - 1;
	const file = path.join(dir, `chunk_${String(k).padStart(2, '0')}.mp4`);
	chunks.push(file);
	if (fs.existsSync(file) && fs.statSync(file).size > 0) continue;
	const t0 = performance.now();
	let shown = 0;
	await renderMedia({
		serveUrl,
		composition,
		codec: 'h264',
		crf: 18,
		pixelFormat: 'yuv420p',
		outputLocation: `${file}.part.mp4`,
		inputProps: props,
		frameRange: [f0, f1],
		muted: true,
		concurrency: 4,
		// every tab loads all the sprites and compiles every scene's shaders before its first frame
		timeoutInMilliseconds: 300000,
		puppeteerInstance: browser,
		chromiumOptions: {gl: 'swangle'},
		onProgress: ({renderedFrames}) => {
			if (renderedFrames >= shown + 50) {
				shown = renderedFrames;
				console.log(`chunk ${k}: ${renderedFrames}/${f1 - f0 + 1} frames, ${((performance.now() - t0) / 1000).toFixed(0)} s`);
			}
		},
	});
	fs.renameSync(`${file}.part.mp4`, file);
	console.log(`chunk ${k} done: frames ${f0}-${f1} in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close({silent: true});
fs.writeFileSync(path.join(dir, 'list.txt'), chunks.map((c) => `file '${c}'`).join('\n') + '\n');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-c', 'copy', path.join(dir, 'video.mp4')]);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(dir, 'video.mp4'), '-i', 'audio/final_mix.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', OUT]);
console.log(`done: ${OUT}`);
