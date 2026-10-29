// Folds the single-mode Vite build (dist-single/) into one self-contained HTML file.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-single';
const out = process.argv[2] ?? 'nyxen-tx1-flashlight.html';
let html = readFileSync(join(dir, 'index.html'), 'utf8');

// Inline the stylesheet.
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g, (_, file) => {
  const css = readFileSync(join(dir, file), 'utf8');
  return `<style>${css}</style>`;
});

// Inline the module script. Escape sequences that would end or confuse the <script> element.
html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, file) => {
  const js = readFileSync(join(dir, file), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  return `<script type="module">${js}</script>`;
});

// Inline the favicon as a data URI.
html = html.replace(/<link rel="icon" type="image\/svg\+xml" href="\.\/favicon\.svg"\s*\/?>/, () => {
  const svg = readFileSync(join(dir, 'favicon.svg'), 'utf8');
  return `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" />`;
});

const leftovers = html.match(/(?:src|href)="\.\/assets\/[^"]+"/g);
if (leftovers) {
  console.error('Unresolved asset references:', leftovers);
  process.exit(1);
}
writeFileSync(out, html);
const assets = readdirSync(join(dir, 'assets'));
console.log(`Wrote ${out} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB) from ${assets.length} bundled assets.`);
