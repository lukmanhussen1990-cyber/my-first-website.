// Fast low-res preview: every Nth frame of a composition as JPEGs (tiny WebGL buffer, no lens blur / MSAA), then
// ffmpeg joins them at 30/N fps with the sound mix.  usage: node scripts/preview.mjs <out.mp4> [--comp Id] [--nth 3] [--dpr 0.25] [--audio mix.wav]
import fs from "node:fs";
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.TMPDIR = process.env.REMOTION_TMP; }
import path from "node:path";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderFrames, selectComposition } from "@remotion/renderer";
import { browserExecutable, chromiumOptions } from "./browser.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const out = args[0], id = opt("comp", "SlipperyShort"), nth = Number(opt("nth", "3")), dpr = Number(opt("dpr", "0.25")), audio = opt("audio", null);
const conc = Number(opt("concurrency", "3")), lens = args.includes("--lens"), size = opt("size", null), shadow = Number(opt("shadow", "512"));
const dir = path.resolve(path.dirname(out), path.basename(out, ".mp4") + "_frames");
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const inputProps = { post: { dpr, msaa: 0, shadow, lens } };
const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions, inputProps });
let last = 0;
await renderFrames({
  composition, serveUrl, outputDir: dir, inputProps, imageFormat: "jpeg", jpegQuality: 80, everyNthFrame: nth, scale: dpr, concurrency: conc,
  browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000,
  onStart: () => {}, onFrameUpdate: (n) => { const now = Date.now(); if (now - last > 10000) { last = now; console.log(`frames ${n} / ${Math.ceil(composition.durationInFrames / nth)}, ${((now - t0) / 1000).toFixed(0)} s`); } },
});
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jpeg")).sort();
files.forEach((f, i) => fs.renameSync(path.join(dir, f), path.join(dir, `p${String(i).padStart(5, "0")}.jpeg`)));
const ff = ["-y", "-v", "error", "-framerate", String(30 / nth), "-i", path.join(dir, "p%05d.jpeg")];
if (audio) ff.push("-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "160k", "-shortest");
ff.push("-vf", size ? `scale=${size.replace("x", ":")}:flags=lanczos` : "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", size ? "17" : "23", "-r", "30", "-movflags", "+faststart", out);
execFileSync("ffmpeg", ff, { stdio: "inherit" });
console.log(`done: ${out} (${files.length} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
