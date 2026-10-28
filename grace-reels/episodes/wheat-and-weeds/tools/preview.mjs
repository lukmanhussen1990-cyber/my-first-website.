// A short preview: chosen pieces of the reel at half size, joined, with the voice under them.
// Usage: node tools/preview.mjs out/preview.mp4 "0-4.27,7.08-8.7,..." [--scale=0.5]
import {bundle} from '@remotion/bundler';
import {openBrowser, renderMedia, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [outFile, list, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const scale = Number(opt.scale ?? 0.5);
const props = {lite: false, muted: true, noText: true};
const work = path.resolve('out/chunks/preview');
fs.mkdirSync(work, {recursive: true});
const segs = list.split(',').map((s) => s.split('-').map(Number));

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
const browser = await openBrowser('chrome', {chromiumOptions: {gl: 'swangle'}});
const composition = await selectComposition({serveUrl, id: 'Draft', inputProps: props, puppeteerInstance: browser, chromiumOptions: {gl: 'swangle'}});
const parts = [];
for (const [i, [a, b]] of segs.entries()) {
	const f0 = Math.round(a * 30);
	const f1 = Math.round(b * 30) - 1;
	const video = path.join(work, `seg${i}.mp4`);
	const t0 = performance.now();
	await renderMedia({serveUrl, composition, codec: 'h264', outputLocation: video, inputProps: props, frameRange: [f0, f1], scale, concurrency: 2, crf: 20, muted: true, puppeteerInstance: browser, chromiumOptions: {gl: 'swangle'}});
	// the voice for the same stretch
	const withVoice = path.join(work, `segv${i}.mp4`);
	execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-ss', String(f0 / 30), '-t', String((f1 - f0 + 1) / 30), '-i', 'audio/voice_track.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-af', 'afade=t=in:d=0.04,apad', '-shortest', withVoice]);
	parts.push(withVoice);
	console.log(`segment ${i}: ${a}-${b} s, ${f1 - f0 + 1} frames in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close({silent: true});
fs.writeFileSync(path.join(work, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n') + '\n');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(work, 'list.txt'), '-c:v', 'libx264', '-crf', '21', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', outFile]);
console.log(`wrote ${outFile}`);
