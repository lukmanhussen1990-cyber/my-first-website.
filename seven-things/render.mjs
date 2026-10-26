// node render.mjs stills 0,12,40 [outDir]   -> build/stills/f0000.jpg ...
// node render.mjs full [out.mp4]            -> out/final_reel.mp4 (H.264 CRF 18, yuv420p, AAC 192k, faststart)
import { bundle } from '@remotion/bundler';
import { renderFrames, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';

const mode = process.argv[2] || 'stills';
const browserExecutable = process.env.REMOTION_BROWSER || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const chromiumOptions = { gl: 'swangle' };
const timeoutInMilliseconds = 240000;
const concurrency = Number(process.env.CONC || 3);
const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.jsx'), publicDir: path.resolve('public') });
console.log(`bundled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

if (mode === 'stills') {
  const frames = (process.argv[3] || '0').split(',').map(Number);
  const outDir = path.resolve(process.argv[4] || 'build/stills');
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = path.join(outDir, '_tmp'); fs.rmSync(tmp, { recursive: true, force: true });
  const inputProps = { frames, audio: false, overlay: process.env.NO_OVERLAY ? false : true, debug: !process.env.CLEAN };
  const composition = await selectComposition({ serveUrl, id: 'Stills', inputProps, browserExecutable, chromiumOptions });
  const t1 = Date.now();
  await renderFrames({ composition, serveUrl, inputProps, outputDir: tmp, imageFormat: 'jpeg', jpegQuality: 92, browserExecutable, chromiumOptions, timeoutInMilliseconds, concurrency: Math.min(concurrency, frames.length),
    onStart: () => {}, onFrameUpdate: () => {}, onBrowserLog: (l) => { if (l.type === 'error' || process.env.LOGS) console.log('[browser]', l.type, l.text.slice(0, 400)); } });
  const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.jpeg')).sort();
  files.forEach((f, i) => fs.renameSync(path.join(tmp, f), path.join(outDir, `f${String(frames[i]).padStart(4, '0')}.jpg`)));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`rendered ${frames.length} stills in ${((Date.now() - t1) / 1000).toFixed(1)}s -> ${outDir}`);
} else if (mode === 'frames') {
  // node render.mjs frames 336-540 build/seg1  -> JPEG frames of the reel (for splicing re-rendered sections)
  const [a, b] = process.argv[3].split('-').map(Number);
  const outDir = path.resolve(process.argv[4]); fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
  const inputProps = { frames: null, audio: false, overlay: true, debug: false };
  const composition = await selectComposition({ serveUrl, id: 'SevenThings', inputProps, browserExecutable, chromiumOptions });
  const t1 = Date.now();
  await renderFrames({ composition, serveUrl, inputProps, outputDir: outDir, imageFormat: 'jpeg', jpegQuality: 96, frameRange: [a, b], browserExecutable, chromiumOptions, timeoutInMilliseconds, concurrency,
    onStart: () => {}, onFrameUpdate: () => {}, onBrowserLog: (l) => { if (l.type === 'error') console.log('[browser]', l.text.slice(0, 300)); } });
  console.log(`frames ${a}-${b} -> ${outDir} in ${((Date.now() - t1) / 60000).toFixed(1)} min`);
} else if (mode === 'cast') {
  const out = path.resolve(process.argv[3] || 'out/characters.png');
  const composition = await selectComposition({ serveUrl, id: 'CastSheet', browserExecutable, chromiumOptions });
  await renderStill({ composition, serveUrl, output: out, imageFormat: 'png', browserExecutable, chromiumOptions, timeoutInMilliseconds });
  console.log('cast sheet ->', out);
} else if (mode === 'cover') {
  // node render.mjs cover [frame] [out.jpg]
  const inputProps = { frame: Number(process.argv[3] || 150) };
  const out = path.resolve(process.argv[4] || 'out/cover.jpg');
  const composition = await selectComposition({ serveUrl, id: 'Cover', inputProps, browserExecutable, chromiumOptions });
  await renderStill({ composition, serveUrl, inputProps, output: out, imageFormat: 'jpeg', jpegQuality: 94, browserExecutable, chromiumOptions, timeoutInMilliseconds });
  console.log('cover ->', out);
} else if (mode === 'preview') {
  // node render.mjs preview 0-344 out.mp4 [audio.wav] -> silent render of a frame range, then mux audio with ffmpeg
  const [a, b] = process.argv[3].split('-').map(Number);
  const out = path.resolve(process.argv[4] || 'build/preview.mp4');
  const silent = out.replace(/\.mp4$/, '_silent.mp4');
  const inputProps = { frames: null, audio: false, overlay: true, debug: false };
  const composition = await selectComposition({ serveUrl, id: 'SevenThings', inputProps, browserExecutable, chromiumOptions });
  const t1 = Date.now(); let last = 0;
  await renderMedia({ composition, serveUrl, inputProps, codec: 'h264', crf: 20, pixelFormat: 'yuv420p', outputLocation: silent, browserExecutable, chromiumOptions, timeoutInMilliseconds, concurrency, frameRange: [a, b], muted: true,
    onProgress: ({ renderedFrames }) => { const n = Date.now(); if (n - last > 30000) { last = n; console.log(`  ${renderedFrames}/${b - a + 1} frames, ${((n - t1) / 1000).toFixed(0)}s`); } },
    onBrowserLog: (l) => { if (l.type === 'error') console.log('[browser]', l.text.slice(0, 300)); } });
  const audio = process.argv[5] || (fs.existsSync('public/final_mix.wav') ? 'public/final_mix.wav' : 'voice/voice.wav');
  const { execFileSync } = await import('child_process');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', silent, '-ss', String(a / 30), '-t', String((b - a + 1) / 30), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
  console.log(`preview ${out} (${((Date.now() - t1) / 60000).toFixed(1)} min, audio: ${audio})`);
} else if (mode === 'full' || mode === 'range') {
  const out = path.resolve(process.argv[3] || 'out/final_reel.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const inputProps = { frames: null, audio: true, overlay: true, debug: false };
  const composition = await selectComposition({ serveUrl, id: 'SevenThings', inputProps, browserExecutable, chromiumOptions });
  const frameRange = mode === 'range' ? process.argv[4].split('-').map(Number) : null;
  const t1 = Date.now(); let last = 0;
  await renderMedia({ composition, serveUrl, inputProps, codec: 'h264', crf: 18, pixelFormat: 'yuv420p', audioCodec: 'aac', audioBitrate: '192k',
    outputLocation: out, browserExecutable, chromiumOptions, timeoutInMilliseconds, concurrency, frameRange, x264Preset: 'slow',
    onProgress: ({ renderedFrames, encodedFrames }) => { const n = Date.now(); if (n - last > 20000) { last = n; console.log(`  ${renderedFrames} rendered / ${encodedFrames} encoded, ${((n - t1) / 1000).toFixed(0)}s`); } },
    onBrowserLog: (l) => { if (l.type === 'error') console.log('[browser]', l.text.slice(0, 300)); } });
  console.log(`rendered ${out} in ${((Date.now() - t1) / 60000).toFixed(1)} min`);
}
