// Bundle once, render many stills.  node tools/render_stills.mjs <compId> <outDir> <frame>[:name] ...
import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const [compId, outDir, ...frames] = process.argv.slice(2);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const publicDir = path.join(root, process.env.EPISODE_PUBLIC ?? 'episodes/adam-silent/public');
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts'), publicDir });
const chromiumOptions = { gl: 'swangle' };
const composition = await selectComposition({ serveUrl, id: compId, browserExecutable, chromiumOptions });
for (const spec of frames) {
  const [f, name] = spec.split(':');
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: Number(f), output: path.join(outDir, `${name ?? 'f' + f}.png`), browserExecutable, chromiumOptions, imageFormat: 'png' });
  console.log(`frame ${f} -> ${name ?? f} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
