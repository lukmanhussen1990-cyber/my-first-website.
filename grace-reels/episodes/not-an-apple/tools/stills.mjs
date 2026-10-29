// Renders chosen frames of the reel as PNG stills with one bundle: node tools/stills.mjs 138 240 ...
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts')});
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const inputProps = {noAudio: true};
const composition = await selectComposition({serveUrl, id: 'Reel', inputProps, browserExecutable});
for (const frame of frames) {
  await renderStill({composition, serveUrl, frame, inputProps, browserExecutable, output: path.join(root, `out/stills/f${String(frame).padStart(4, '0')}.png`)});
  console.log('still', frame);
}
