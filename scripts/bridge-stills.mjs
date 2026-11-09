// usage: node scripts/bridge-stills.mjs <outPrefix> <frame,frame,...> [scale]  (bundles once, jpeg)
// COMP=<CompositionId> picks the composition (default BridgeShort).
// BRIDGE_ENTRY=src/sandboxes/<name>/index.tsx renders a sandbox copy instead of the main project entry.
// Browser + GL backend are picked by scripts/browser.mjs (cloud Linux: bundled headless shell + SwiftShader "swangle";
// Windows/macOS with a GPU: system Chrome + "angle"). Override with CHROME_PATH / REMOTION_GL.
import fs from "node:fs";
// Remotion bundles fill the temp folder (each copies public/): set REMOTION_TMP to a folder on a big drive
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = process.env.REMOTION_TMP; }
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import { browserExecutable, chromiumOptions } from "./browser.mjs";

const [prefix, frames, scale = "0.5"] = process.argv.slice(2);
if (!prefix || !frames) { console.error("usage: node scripts/bridge-stills.mjs <outPrefix> <frame,frame,...> [scale]"); process.exit(1); }
fs.mkdirSync(path.dirname(path.resolve(prefix)), { recursive: true });
const id = process.env.COMP || "BridgeShort";
const t00 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve(process.env.BRIDGE_ENTRY || "src/index.ts"), publicDir: path.resolve("public") });
console.log("bundled", ((Date.now() - t00) / 1000).toFixed(1) + "s");
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions });
const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale),
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000, onBrowserLog });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
