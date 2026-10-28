// Render several stills from one bundle: node tools/stills.mjs out/dir 12.5 30.2 ...  (times in seconds)
// Optional env: SCALE (default 0.5), PREVIEW=1
import path from 'node:path';
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';

const [outDir, ...times] = process.argv.slice(2);
const root = process.cwd();
fs.mkdirSync(outDir, {recursive: true});
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts')});
const inputProps = {preview: process.env.PREVIEW === '1'};
const browserExecutable = path.join(root, 'tools/chrome-swiftshader.sh');
const chromiumOptions = {gl: 'swangle'};
const composition = await selectComposition({serveUrl, id: 'TheCorners', inputProps, browserExecutable, chromiumOptions});
for (const ts of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(parseFloat(ts) * composition.fps));
  const output = path.join(outDir, `t${String(ts).padStart(6, '0')}.png`);
  await renderStill({composition, serveUrl, output, frame, inputProps, browserExecutable, chromiumOptions, scale: parseFloat(process.env.SCALE ?? '0.5'), imageFormat: 'png'});
  console.log('still', ts, '->', output);
}
