// usage: node scripts/render.mjs <out.mp4> [--comp BridgeShort] [--frames 0-2024] [--scale 1] [--concurrency 2] [--crf 16]
// Renders a composition to h264 with the browser/GL backend from scripts/browser.mjs (cloud Linux: headless shell +
// SwiftShader; a PC with a GPU: Chrome + ANGLE). Final 2K vertical export: --scale 1.3333 (1440x2560).
// Remotion writes a silent audio track: mux the real mix afterwards with
//   ffmpeg -i video.mp4 -i mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest final.mp4
import fs from "node:fs";
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = process.env.REMOTION_TMP; }
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { browserExecutable, chromiumOptions } from "./browser.mjs";

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--"));
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
if (!out) { console.error("usage: node scripts/render.mjs <out.mp4> [--comp Id] [--frames a-b] [--scale s] [--concurrency n] [--crf q]"); process.exit(1); }
const id = opt("comp", process.env.COMP || "BridgeShort");
const scale = Number(opt("scale", "1"));
const concurrency = Number(opt("concurrency", "2"));
const crf = Number(opt("crf", "16"));
const fr = opt("frames", null);
const frameRange = fr ? (fr.includes("-") ? fr.split("-").map(Number) : Number(fr)) : null;

fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve(process.env.BRIDGE_ENTRY || "src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions });
let last = 0;
await renderMedia({
  composition, serveUrl, codec: "h264", crf, scale, concurrency, frameRange, outputLocation: out,
  browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000,
  onProgress: ({ renderedFrames, encodedFrames }) => {
    const now = Date.now();
    if (now - last > 15000) { last = now; console.log(`rendered ${renderedFrames}, encoded ${encodedFrames}, ${((now - t0) / 1000).toFixed(0)} s`); }
  },
});
const n = Array.isArray(frameRange) ? frameRange[1] - frameRange[0] + 1 : frameRange != null ? 1 : composition.durationInFrames;
const secs = (Date.now() - t0) / 1000;
console.log(`done: ${out} — ${n} frames in ${secs.toFixed(0)} s (${(secs / n).toFixed(2)} s/frame incl. bundling)`);
