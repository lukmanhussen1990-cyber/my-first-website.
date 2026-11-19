/**
 * Render a handful of stills in one go (bundles once) — handy for look-dev.
 *   node scripts/stills.mjs 1.5 5 12.3 26.4      (times in seconds)
 * Env: REMOTION_GL (default angle), BROWSER (optional Chrome path), OUT (default out/stills)
 */
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const times = process.argv.slice(2).map(Number);
const outDir = process.env.OUT || 'out/stills';
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const chromiumOptions = { gl: process.env.REMOTION_GL || 'angle' };
const browserExecutable = process.env.BROWSER || null;
const composition = await selectComposition({ serveUrl, id: 'EngineReel', chromiumOptions, browserExecutable });
for (const t of times) {
  const frame = Math.round(t * composition.fps);
  const output = path.join(outDir, `t${t.toFixed(2).padStart(5, '0')}.png`);
  await renderStill({ serveUrl, composition, frame, output, chromiumOptions, browserExecutable, scale: Number(process.env.SCALE || 1) });
  console.log('wrote', output);
}
