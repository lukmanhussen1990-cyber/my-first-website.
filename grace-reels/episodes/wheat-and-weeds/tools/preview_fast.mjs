// The quickest preview: every other frame, small and lite, the voice under it. Joins with parts already
// rendered by tools/preview.mjs (out/chunks/preview/segv*.mp4) when asked to.
// Usage: node tools/preview_fast.mjs out/file.mp4 "a-b,c-d" [--keep=0,1,2] [--scale=0.4]
import {bundle} from '@remotion/bundler';
import {openBrowser, renderFrames, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [outFile, list, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const scale = Number(opt.scale ?? 0.4);
const keep = opt.keep ? opt.keep.split(',').map(Number) : [];
const props = {lite: true, muted: true, noText: true};
const work = path.resolve('out/chunks/preview');
fs.mkdirSync(work, {recursive: true});
const segs = list.split(',').map((s) => s.split('-').map(Number));

const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
const browser = await openBrowser('chrome', {chromiumOptions: {gl: 'swangle'}});
const composition = await selectComposition({serveUrl, id: 'Draft', inputProps: props, puppeteerInstance: browser, chromiumOptions: {gl: 'swangle'}});
const parts = keep.map((k) => path.join(work, `segv${k}.mp4`));
for (const [i, [a, b]] of segs.entries()) {
	const f0 = Math.round(a * 30);
	const f1 = Math.round(b * 30) - 1;
	const dir = path.join(work, `fast${i}`);
	fs.rmSync(dir, {recursive: true, force: true});
	fs.mkdirSync(dir, {recursive: true});
	const t0 = performance.now();
	await renderFrames({serveUrl, composition, inputProps: props, outputDir: dir, frameRange: [f0, f1], everyNthFrame: 2, imageFormat: 'jpeg', jpegQuality: 80, scale, concurrency: 3, puppeteerInstance: browser, chromiumOptions: {gl: 'swangle'}, onStart: () => {}, onFrameUpdate: () => {}});
	const frames = fs.readdirSync(dir).filter((f) => f.endsWith('.jpeg')).sort();
	frames.forEach((f, k) => fs.renameSync(path.join(dir, f), path.join(dir, `f${String(k).padStart(5, '0')}.jpeg`)));
	const out = path.join(work, `fastv${i}.mp4`);
	execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '15', '-i', path.join(dir, 'f%05d.jpeg'), '-ss', String(f0 / 30), '-t', String((f1 - f0 + 1) / 30), '-i', 'audio/voice_track.wav', '-map', '0:v', '-map', '1:a', '-r', '30', '-c:v', 'libx264', '-crf', '24', '-pix_fmt', 'yuv420p', '-vf', 'scale=432:768', '-c:a', 'aac', '-b:a', '128k', '-af', 'apad', '-shortest', out]);
	parts.push(out);
	console.log(`segment ${i}: ${a}-${b} s, ${frames.length} frames in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close({silent: true});
const inputs = parts.flatMap((p) => ['-i', p]);
const n = parts.length;
const filter = parts.map((_, k) => `[${k}:v]scale=432:768,setsar=1,fps=30[v${k}];[${k}:a]aresample=48000[a${k}]`).join(';') + ';' + parts.map((_, k) => `[v${k}][a${k}]`).join('') + `concat=n=${n}:v=1:a=1[v][a]`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filter, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outFile]);
console.log(`wrote ${outFile}`);
