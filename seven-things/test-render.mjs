import { bundle } from '@remotion/bundler';
import { renderFrames, selectComposition } from '@remotion/renderer';
import path from 'path';
const entry = path.resolve('src/test.jsx');
const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: entry });
console.log('bundled in', Date.now() - t0, 'ms');
const browserExecutable = process.env.REMOTION_BROWSER;
const chromiumOptions = { gl: process.env.GL || 'swangle' };
const comp = await selectComposition({ serveUrl, id: 'Test', browserExecutable, chromiumOptions });
const t1 = Date.now();
await renderFrames({ composition: comp, serveUrl, outputDir: path.resolve('build/test-frames'), imageFormat: 'jpeg', browserExecutable, chromiumOptions, concurrency: 2,
  onStart: () => {}, onFrameUpdate: (n) => {}, });
console.log('rendered', comp.durationInFrames, 'frames in', Date.now() - t1, 'ms');
