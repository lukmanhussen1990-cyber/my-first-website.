#!/usr/bin/env node
/*
 * Render the animation to an MP4 (picture + sound) using headless Chromium
 * and ffmpeg. The frames come from the same drawFrame() the website uses and
 * the audio from the same ImranSound score, rendered offline.
 *
 *   node tools/render.mjs [out.mp4] [--width 3840] [--fps 60] [--workers 4]
 */
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const out = path.resolve(args.find((a) => a.endsWith('.mp4')) || path.join(root, 'media', 'imran.mp4'));
const width = +opt('width', 3840);
const height = Math.round(width * 9 / 16);
const fps = +opt('fps', 60);
const workers = +opt('workers', Math.max(1, Math.min(6, os.cpus().length)));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'imran-render-'));
const scripts = ['glyphs.js', 'chess.js', 'scene.js', 'sound.js']
  .map((f) => `<script src="${pathToFileURL(path.join(root, 'js', f)).href}"></script>`).join('\n');
fs.writeFileSync(path.join(tmp, 'render.html'), `<!doctype html><meta charset="utf-8">
<canvas id="c"></canvas>
${scripts}
<script>
  const c = document.getElementById('c');
  const g = c.getContext('2d');
  window.renderFrame = (t, w, h) => {
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    g.setTransform(w / ImranScene.W, 0, 0, h / ImranScene.H, 0, 0);
    ImranScene.drawFrame(g, t);
    return c.toDataURL('image/png');
  };
  window.renderAudio = async () => {
    const buf = await ImranSound.render(48000);
    const L = buf.getChannelData(0), R = buf.getChannelData(1), n = buf.length;
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    const gain = peak > 0 ? Math.pow(10, -1 / 20) / peak : 1;      // normalise to -1 dBFS
    const bytes = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) bytes.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); bytes.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt ');
    bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 2, true);
    bytes.setUint32(24, 48000, true); bytes.setUint32(28, 48000 * 4, true);
    bytes.setUint16(32, 4, true); bytes.setUint16(34, 16, true);
    str(36, 'data'); bytes.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) {
      bytes.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i] * gain)) * 32767, true);
      bytes.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i] * gain)) * 32767, true);
    }
    let bin = '';
    const u8 = new Uint8Array(bytes.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { wav: btoa(bin), peak, duration: ImranScene.DURATION };
  };
  window.ready = true;
</script>`);

const browser = await chromium.launch();
const open = async () => {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto(pathToFileURL(path.join(tmp, 'render.html')).href);
  await page.waitForFunction(() => window.ready);
  return page;
};

// sound
const first = await open();
const audio = await first.evaluate(() => window.renderAudio());
fs.writeFileSync(path.join(tmp, 'audio.wav'), Buffer.from(audio.wav, 'base64'));
console.log(`audio: ${audio.duration}s, raw peak ${audio.peak.toFixed(3)}`);

// picture
const total = Math.round(audio.duration * fps);
const pages = [first];
while (pages.length < workers) pages.push(await open());
let done = 0;
await Promise.all(pages.map(async (page, w) => {
  for (let f = w; f < total; f += workers) {
    const url = await page.evaluate(([t, ww, hh]) => window.renderFrame(t, ww, hh), [f / fps, width, height]);
    fs.writeFileSync(path.join(tmp, `f${String(f).padStart(5, '0')}.png`), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    if (++done % 60 === 0) console.log(`frames ${done}/${total}`);
  }
}));
await browser.close();

// encode
fs.mkdirSync(path.dirname(out), { recursive: true });
const ff = spawnSync('ffmpeg', [
  '-y', '-v', 'error',
  '-framerate', String(fps), '-i', path.join(tmp, 'f%05d.png'),
  '-i', path.join(tmp, 'audio.wav'),
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-tune', 'animation',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-c:a', 'aac', '-b:a', '256k',
  '-shortest', '-movflags', '+faststart', out
], { stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });
if (ff.status !== 0) process.exit(ff.status || 1);
console.log('wrote', path.relative(process.cwd(), out));
