#!/usr/bin/env node
/*
 * Border Trials art pipeline.
 *
 * Every image in src/assets/art is ORIGINAL artwork painted procedurally on a
 * <canvas> by a "piece" in tools/art/pieces/*.html. This script opens each
 * piece in headless Chromium, waits for it to finish painting, captures the
 * canvas as PNG and encodes it to WebP/PNG with ImageMagick.
 *
 * Piece contract (tools/art/pieces/<name>.html):
 *   <meta name="art" data-out="src/assets/art/loading-hero.webp"
 *         data-w="900" data-h="1950" data-scale="1.5" data-quality="80">
 *   - render into <canvas id="c"> at (w*scale) x (h*scale) pixels
 *   - set window.__done = true when finished (may be async)
 *   - optional: multiple outputs — put several <meta name="art"> tags and
 *     read `window.__variant` (index) to decide what to draw; the runner
 *     reloads the page once per meta tag with ?v=<index>.
 *   - pieces may import shared helpers from ../lib/*.js (ES modules)
 *
 * Usage:
 *   node tools/art/render.mjs              # render every piece
 *   node tools/art/render.mjs loading-hero # only pieces whose file name contains the filter
 */
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const piecesDir = join(here, 'pieces');
const filter = process.argv[2] ?? '';

const EXEC_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium',
].filter(Boolean);

// Serve tools/art over http so pieces can use ES module imports.
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const file = join(here, decodeURIComponent(url.pathname));
    if (!file.startsWith(here)) throw new Error('outside');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const pieces = readdirSync(piecesDir)
  .filter((f) => f.endsWith('.html') && f.includes(filter))
  .sort();

if (pieces.length === 0) {
  console.error(`no pieces match "${filter}"`);
  process.exit(1);
}

const executablePath = EXEC_CANDIDATES.find((p) => existsSync(p));
const browser = await chromium.launch({
  executablePath,
  args: ['--disable-gpu-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const tmp = join(tmpdir(), 'bt-art');
mkdirSync(tmp, { recursive: true });

let failed = 0;
for (const file of pieces) {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`  [${file}] ${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => console.log(`  [${file}] pageerror: ${e.message}`));
  try {
    await page.goto(`http://127.0.0.1:${port}/pieces/${file}`);
    const metas = await page.$$eval('meta[name="art"]', (els) =>
      els.map((e) => ({
        out: e.dataset.out,
        w: Number(e.dataset.w),
        h: Number(e.dataset.h),
        scale: Number(e.dataset.scale || 1),
        quality: Number(e.dataset.quality || 80),
      })),
    );
    for (let v = 0; v < metas.length; v++) {
      const m = metas[v];
      const t0 = Date.now();
      await page.goto(`http://127.0.0.1:${port}/pieces/${file}?v=${v}`);
      await page.waitForFunction(() => window.__done === true, null, { timeout: 180_000, polling: 100 });
      const dataUrl = await page.$eval('#c', (c) => c.toDataURL('image/png'));
      const png = join(tmp, `${file}-${v}.png`);
      writeFileSync(png, Buffer.from(dataUrl.split(',')[1], 'base64'));
      const out = join(root, m.out);
      mkdirSync(dirname(out), { recursive: true });
      const args = [png, '-filter', 'Lanczos', '-resize', `${m.w}x${m.h}!`];
      if (out.endsWith('.webp')) args.push('-quality', String(m.quality), '-define', 'webp:method=6');
      if (out.endsWith('.png')) args.push('-strip', '-define', 'png:compression-level=9');
      args.push(out);
      execFileSync('convert', args);
      rmSync(png);
      console.log(`✓ ${m.out}  ${m.w}x${m.h}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }
  } catch (err) {
    failed++;
    console.error(`✗ ${file}: ${err.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
