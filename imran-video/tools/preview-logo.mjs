// Render a logo SVG (see design/CONTRACT.md) as a 1080x1080 still on the
// reference-style dark background with a soft glow, so designs can be judged
// in context.  Usage:
//   node tools/preview-logo.mjs <logo.svg> <out.png> [--compare <ref.png>]
// With --compare the output is 2160x1080: preview left, reference right.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const [, , svgPath, outPath, ...rest] = process.argv;
if (!svgPath || !outPath) {
  console.error('usage: preview-logo.mjs <logo.svg> <out.png> [--compare <ref.png>]');
  process.exit(1);
}
const cmpIdx = rest.indexOf('--compare');
const refPath = cmpIdx >= 0 ? rest[cmpIdx + 1] : null;

const svg = fs.readFileSync(svgPath, 'utf8');
const ref = refPath ? 'data:image/png;base64,' + fs.readFileSync(refPath).toString('base64') : null;

const html = `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="c" width="${ref ? 2160 : 1080}" height="1080"></canvas>
<script>
async function load(src) {
  const im = new Image(); im.src = src; await im.decode(); return im;
}
window.run = async (svg, ref) => {
  const c = document.getElementById('c'), x = c.getContext('2d');
  // background: dark radial falloff like the reference
  const g = x.createRadialGradient(540, 470, 40, 540, 520, 760);
  g.addColorStop(0, '#2c2732'); g.addColorStop(0.45, '#1f1c23');
  g.addColorStop(0.8, '#0e0c10'); g.addColorStop(1, '#060507');
  x.fillStyle = g; x.fillRect(0, 0, 1080, 1080);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const logo = await load(URL.createObjectURL(blob));
  // soft glow: blurred copy screened underneath
  x.save(); x.filter = 'blur(28px)'; x.globalAlpha = 0.55; x.globalCompositeOperation = 'screen';
  x.drawImage(logo, 0, 0, 1080, 1080); x.restore();
  x.drawImage(logo, 0, 0, 1080, 1080);
  x.save(); x.filter = 'blur(10px)'; x.globalAlpha = 0.25; x.globalCompositeOperation = 'screen';
  x.drawImage(logo, 0, 0, 1080, 1080); x.restore();
  if (ref) { const r = await load(ref); x.drawImage(r, 1080, 0, 1080, 1080); }
  return c.toDataURL('image/png');
};
</script></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
const url = await page.evaluate(([s, r]) => window.run(s, r), [svg, ref]);
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
console.log('wrote', outPath);
