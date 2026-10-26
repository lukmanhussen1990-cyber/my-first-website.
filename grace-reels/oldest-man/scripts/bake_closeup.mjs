// Character close-up stills (quality loop): node scripts/bake_closeup.mjs out.png [view] [t] [lamp]
// Renders the CastCloseup composition (1080×1920) — see src/CastSheet.jsx.
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'path';
const browserExecutable = process.env.REMOTION_BROWSER || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const chromiumOptions = { gl: 'swangle' };
const out = path.resolve(process.argv[2] || 'quality/closeup.png');
const inputProps = { view: process.argv[3] || 'threeQuarter', t: Number(process.argv[4] ?? 1.0), lamp: Number(process.argv[5] ?? 1) };
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.jsx'), publicDir: path.resolve('public') });
const composition = await selectComposition({ serveUrl, id: 'CastCloseup', inputProps, browserExecutable, chromiumOptions });
await renderStill({ composition, serveUrl, inputProps, output: out, imageFormat: 'png', browserExecutable, chromiumOptions, timeoutInMilliseconds: 240000,
  onBrowserLog: (l) => { if (l.type === 'error' || process.env.LOGS) console.log('[browser]', l.type, l.text.slice(0, 300)); } });
console.log('closeup ->', out, JSON.stringify(inputProps));
