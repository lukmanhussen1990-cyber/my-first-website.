/**
 * Build script.
 *
 *   node build.mjs
 *
 * Produces two artefacts from the ES modules in src/:
 *   dist/game.js              — classic script bundle, so index.html also runs
 *                               straight off the filesystem (file://) where ES
 *                               module imports would be blocked by CORS.
 *   touchline-standalone.html — the whole game in a single shareable file.
 *
 * Requires esbuild:  npm install
 */

import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const p = (...parts) => resolve(root, ...parts);

await mkdir(p('dist'), { recursive: true });

const result = await build({
  entryPoints: [p('src/main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2021'],
  legalComments: 'none',
  write: false,
  outfile: p('dist/game.js'),
});

const js = result.outputFiles[0].text;
await writeFile(p('dist/game.js'), js);

const html = await readFile(p('index.html'), 'utf8');
const css = await readFile(p('styles.css'), 'utf8');

const standalone = html
  .replace('<link rel="stylesheet" href="styles.css" />', `<style>\n${css}\n</style>`)
  .replace('<script src="dist/game.js" defer></script>', `<script>\n${js}\n</script>`);

await writeFile(p('touchline-standalone.html'), standalone);

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} kB`;
console.log(`dist/game.js               ${kb(js)}`);
console.log(`touchline-standalone.html  ${kb(standalone)}`);
