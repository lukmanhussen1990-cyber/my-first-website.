// Render the IMRAN logo reveal.
//   node tools/render.mjs                         full video -> out/imran-heisenberg.mp4
//   node tools/render.mjs --frames 40,70,121      only these frames (PNG) -> out/frames/
//   node tools/render.mjs --range 0-30            a frame range (PNG only)
// Options: --logo <svg> (default assets/logo.svg), --text IMRAN, --samples N,
//          --out <mp4>, --style '{"font":"Poppins","fontWeight":500}'
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const logoPath = path.resolve(opt('logo', path.join(ROOT, 'assets/logo.svg')));
const text = opt('text', 'IMRAN');
const samples = opt('samples') ? Number(opt('samples')) : undefined;
const style = opt('style') ? JSON.parse(opt('style')) : undefined;
const outMp4 = path.resolve(opt('out', path.join(ROOT, 'out/imran-heisenberg.mp4')));
const frameDir = path.resolve(opt('frame-dir', path.join(ROOT, 'out/frames')));

const browser = await chromium.launch({ args: ['--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => { console.error('[page error]', e); process.exitCode = 1; });
await page.goto('file://' + path.join(ROOT, 'src/index.html'));
const info = await page.evaluate(([svg, text, style]) => window.IMRAN.setup({ svg, text, style }),
  [fs.readFileSync(logoPath, 'utf8'), text, style]);
const FRAMES = await page.evaluate(() => window.IMRAN.FRAMES);

let frames;
if (opt('frames')) frames = opt('frames').split(',').map(Number);
else if (opt('range')) { const [a, b] = opt('range').split('-').map(Number); frames = []; for (let f = a; f <= b; f++) frames.push(f); }
else frames = [...Array(FRAMES).keys()];
const full = !opt('frames') && !opt('range');

fs.mkdirSync(frameDir, { recursive: true });
if (full) for (const f of fs.readdirSync(frameDir)) if (f.endsWith('.png')) fs.unlinkSync(path.join(frameDir, f));
const t0 = Date.now();
for (const f of frames) {
  const url = await page.evaluate(([f, samples]) => window.IMRAN.renderFrame(f, { samples }), [f, samples]);
  fs.writeFileSync(path.join(frameDir, `f_${String(f).padStart(3, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  process.stdout.write(`\rframe ${f} (${((Date.now() - t0) / 1000).toFixed(1)}s)   `);
}
process.stdout.write('\n');
await browser.close();

if (full) {
  fs.mkdirSync(path.dirname(outMp4), { recursive: true });
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-framerate', '60', '-i', path.join(frameDir, 'f_%03d.png'),
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-map', '0:v', '-map', '1:a', '-shortest',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outMp4], { stdio: 'inherit' });
  console.log('wrote', outMp4);
}
