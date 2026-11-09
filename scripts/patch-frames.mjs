// Re-render a frame range of a nth-frame render (after a fix) and drop the new JPEGs into its frames folder.
// usage: node scripts/patch-frames.mjs <framesDir> <from> <to> [--nth 2] [--dpr 0.5] [--shadow 1024] [--comp SlipperyShort]
import fs from "node:fs";
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = process.env.REMOTION_TMP; }
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderFrames, selectComposition } from "@remotion/renderer";
import { browserExecutable, chromiumOptions } from "./browser.mjs";
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const [dir, a, b] = [args[0], Number(args[1]), Number(args[2])];
const nth = Number(opt("nth", "2")), dpr = Number(opt("dpr", "0.5")), shadow = Number(opt("shadow", "1024")), id = opt("comp", "SlipperyShort");
const tmp = path.resolve(dir + "_patch"); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const inputProps = { post: { dpr, msaa: 0, shadow, lens: false } };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions, inputProps });
const from = Math.ceil(a / nth) * nth;
await renderFrames({ composition, serveUrl, outputDir: tmp, inputProps, imageFormat: "jpeg", jpegQuality: 80, everyNthFrame: nth, frameRange: [from, b], scale: dpr,
  concurrency: 3, browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000, onStart: () => {} });
const files = fs.readdirSync(tmp).filter((f) => f.endsWith(".jpeg")).sort();
files.forEach((f, i) => fs.copyFileSync(path.join(tmp, f), path.join(dir, `element-${String(from / nth + i).padStart(3, "0")}.jpeg`)));
console.log(`patched ${files.length} frames from index ${from / nth}`);
