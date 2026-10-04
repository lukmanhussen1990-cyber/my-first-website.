#!/usr/bin/env node
/**
 * Renders the Last Mile brand sources (assets/brand/*.svg) to the PNGs that
 * app.json points at (assets/images/*.png).
 *
 * Run it from the repo root whenever an SVG in assets/brand/ changes:
 *
 *   node scripts/generate-brand-assets.mjs
 *
 * Requirements: Playwright with Chromium. The `playwright` package is resolved
 * from the project / NODE_PATH, then from $PLAYWRIGHT_MODULE (a path to the
 * package directory), then from the global npm root. Browsers come from
 * $PLAYWRIGHT_BROWSERS_PATH as usual; if Chromium is missing on a fresh machine
 * run `npx playwright install chromium` once.
 *
 * How it works: each SVG is drawn onto a canvas at the exact output size (a
 * vector render, never a resample) and the pixels are encoded here with a small
 * PNG writer. Opaque targets are written as RGB with no alpha channel (App Store
 * Connect rejects icons that have one) and the render fails if any pixel is not
 * fully opaque; silhouettes (themed icon, notification icon) are forced to pure
 * white so only their alpha carries the shape.
 */
import { Buffer } from 'node:buffer';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(ROOT, 'assets/brand');
const OUTPUT_DIR = join(ROOT, 'assets/images');

/**
 * mode: 'opaque' → RGB, every pixel must be fully opaque
 *       'alpha'  → RGBA as rendered
 *       'white'  → RGBA, colour forced to white (alpha-only silhouette)
 * radius: optional rounded-corner clip, as a fraction of the size.
 */
const JOBS = [
  { source: 'icon.svg', output: 'icon.png', size: 1024, mode: 'opaque' },
  { source: 'icon-background.svg', output: 'android-icon-background.png', size: 1024, mode: 'opaque' },
  { source: 'icon-foreground.svg', output: 'android-icon-foreground.png', size: 1024, mode: 'alpha' },
  { source: 'icon-monochrome.svg', output: 'android-icon-monochrome.png', size: 1024, mode: 'white' },
  { source: 'splash-icon.svg', output: 'splash-icon.png', size: 1024, mode: 'alpha' },
  { source: 'icon.svg', output: 'favicon.png', size: 196, mode: 'alpha', radius: 0.2237 },
  { source: 'notification-icon.svg', output: 'notification-icon.png', size: 96, mode: 'white' },
];

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = ['playwright', process.env.PLAYWRIGHT_MODULE];
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    candidates.push(join(globalRoot, 'playwright'));
  } catch {
    // npm unavailable — rely on the other candidates.
  }
  for (const id of candidates.filter(Boolean)) {
    try {
      return require(id);
    } catch {
      // try the next candidate
    }
  }
  throw new Error(
    'Playwright not found. Install it (npm i -g playwright) or set PLAYWRIGHT_MODULE to the package directory.',
  );
}

/** Sets the root <svg> width/height so the browser rasterises the vector at the target size. */
function withRenderSize(svg, size) {
  return svg.replace(/<svg\b[^>]*>/, (tag) =>
    tag
      .replace(/\swidth="[^"]*"/, '')
      .replace(/\sheight="[^"]*"/, '')
      .replace(/^<svg\b/, `<svg width="${size}" height="${size}"`),
  );
}

/** Runs in the page: draws the SVG on a canvas and returns its RGBA pixels as base64. */
async function rasterize({ svg, size, radius }) {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (radius) {
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, radius * size);
    ctx.clip();
  }
  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  let binary = '';
  for (let i = 0; i < data.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** 8-bit RGB (channels 3) or RGBA (channels 4) PNG, per-row adaptive filtering. */
function encodePng(size, pixels, channels) {
  const stride = size * channels;
  const filtered = Buffer.alloc((stride + 1) * size);
  const zeroRow = new Uint8Array(stride);
  const candidates = Array.from({ length: 5 }, () => new Uint8Array(stride));

  for (let y = 0; y < size; y++) {
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    const up = y ? pixels.subarray((y - 1) * stride, y * stride) : zeroRow;
    let bestType = 0;
    let bestScore = Infinity;
    for (let type = 0; type < 5; type++) {
      const out = candidates[type];
      let score = 0;
      for (let i = 0; i < stride; i++) {
        const left = i >= channels ? row[i - channels] : 0;
        const above = up[i];
        let predictor = 0;
        if (type === 1) predictor = left;
        else if (type === 2) predictor = above;
        else if (type === 3) predictor = (left + above) >> 1;
        else if (type === 4) predictor = paeth(left, above, i >= channels ? up[i - channels] : 0);
        const value = (row[i] - predictor) & 0xff;
        out[i] = value;
        score += value < 128 ? value : 256 - value;
      }
      if (score < bestScore) {
        bestScore = score;
        bestType = type;
      }
    }
    const offset = y * (stride + 1);
    filtered[offset] = bestType;
    filtered.set(candidates[bestType], offset + 1);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = channels === 4 ? 6 : 2; // colour type: RGBA / RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(filtered, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function toOutputPixels(rgba, { mode, output }) {
  if (mode === 'white') {
    for (let i = 0; i < rgba.length; i += 4) rgba.fill(255, i, i + 3);
    return { pixels: rgba, channels: 4 };
  }
  if (mode === 'alpha') return { pixels: rgba, channels: 4 };

  const rgb = new Uint8Array((rgba.length / 4) * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    if (rgba[i + 3] !== 255) throw new Error(`${output}: pixel ${i / 4} is not opaque`);
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  return { pixels: rgb, channels: 3 };
}

async function main() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    mkdirSync(OUTPUT_DIR, { recursive: true });
    for (const job of JOBS) {
      const svg = withRenderSize(readFileSync(join(SOURCE_DIR, job.source), 'utf8'), job.size);
      const base64 = await page.evaluate(rasterize, { svg, size: job.size, radius: job.radius ?? 0 });
      const { pixels, channels } = toOutputPixels(new Uint8Array(Buffer.from(base64, 'base64')), job);
      const file = join(OUTPUT_DIR, job.output);
      writeFileSync(file, encodePng(job.size, pixels, channels));
      const kb = (statSync(file).size / 1024).toFixed(1);
      console.log(
        `${relative(ROOT, file).padEnd(42)} ${job.size}×${job.size} ${channels === 4 ? 'RGBA' : 'RGB '} ${kb} KB  ← ${job.source}`,
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
