// Bundle once, render many stills. Usage:
// node src/shared/render_stills.mjs <compositionId> <outDir> <frame[:name]> ...
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const [, , compId, outDir, ...frames] = process.argv;
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public')});
const composition = await selectComposition({serveUrl, id: compId, browserExecutable});
fs.mkdirSync(outDir, {recursive: true});
for (const spec of frames) {
  const [fs_, name] = spec.split(':');
  const frame = Number(fs_);
  const output = path.join(outDir, `${name ?? 'f' + String(frame).padStart(5, '0')}.png`);
  await renderStill({serveUrl, composition, frame, output, browserExecutable, imageFormat: 'png'});
  console.log('wrote', output);
}
