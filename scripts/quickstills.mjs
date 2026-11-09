// Fast low-res check stills: node scripts/quickstills.mjs <Comp> <frame,frame,...> <outPrefix> [dpr]
import fs from "node:fs";
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = process.env.REMOTION_TMP; }
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { browserExecutable, chromiumOptions } from "./browser.mjs";
const [id, list, prefix, dprS = "0.3"] = process.argv.slice(2);
const dpr = Number(dprS), inputProps = { post: { dpr, msaa: 0, shadow: 512, lens: false } };
fs.mkdirSync(path.dirname(path.resolve(prefix)), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions, inputProps });
for (const f of list.split(",").map(Number)) {
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", scale: dpr, inputProps, browserExecutable, chromiumOptions,
    onBrowserLog: (l) => { if (l.type === "error" && !l.text.includes("Failed to load")) console.log("[browser]", l.text.slice(0, 200)); } });
}
console.log("ok");
