// Render frames headlessly: node render.mjs <outdir> "<frames>"
//   <frames>: "5,40,90" or "0-899" or a mix "0-10,40,90-95"
// Env: RESUME=1 (skip frames already on disk), SCALE=0.5 (preview size), FORMAT=png|jpg,
//      STORY=story.js, ASPECT=9:16|16:9|1:1 (default from story aspect.json), WORKERS=n (parallel pages)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(ROOT, "web");

const [outArg, spec = "0"] = process.argv.slice(2);
if (!outArg) { console.error('usage: node render.mjs <outdir> "<frames>"'); process.exit(1); }
const outDir = path.resolve(ROOT, outArg);
fs.mkdirSync(outDir, { recursive: true });

const SIZES = { "9:16": [1080, 1920], "16:9": [1920, 1080], "1:1": [1080, 1080] };
let aspect = process.env.ASPECT;
if (!aspect) try { aspect = JSON.parse(fs.readFileSync(path.join(ROOT, "aspect.json"), "utf8")).aspect; } catch { aspect = "9:16"; }
const scale = +(process.env.SCALE || 1);
const [W, H] = SIZES[aspect].map((v) => Math.round((v * scale) / 2) * 2);
const FORMAT = process.env.FORMAT || "png";
const RESUME = process.env.RESUME === "1";
const STORY = process.env.STORY || "story.js";
const WORKERS = Math.max(1, +(process.env.WORKERS || 1));

const frames = [];
for (const part of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
  const m = part.match(/^(\d+)-(\d+)$/);
  if (m) for (let f = +m[1]; f <= +m[2]; f++) frames.push(f);
  else frames.push(+part);
}
const fileFor = (f) => path.join(outDir, `f_${String(f).padStart(5, "0")}.${FORMAT}`);
const todo = RESUME ? frames.filter((f) => !fs.existsSync(fileFor(f))) : frames;
if (!todo.length) { console.log("nothing to render"); process.exit(0); }

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const fp = path.join(WEB, u === "/" ? "index.html" : u);
  if (!fp.startsWith(WEB)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(d);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/index.html?w=${W}&h=${H}&story=${STORY}`;

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-sandbox",
    "--js-flags=--max-old-space-size=4096"],
});

const openPage = async () => {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(`[page ${m.type()}] ${m.text()}`); });
  page.on("pageerror", (e) => console.log(`[page error] ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.READY || window.LOAD_ERROR, null, { timeout: 300000 });
  const err = await page.evaluate(() => window.LOAD_ERROR);
  if (err) throw new Error("story failed to load:\n" + err);
  return page;
};

const t0 = Date.now();
let done = 0;
const queue = [...todo];
const worker = async (id) => {
  const page = await openPage();
  while (queue.length) {
    const f = queue.shift();
    const r = await page.evaluate(([f, fmt]) => window.renderFrame(f, fmt === "jpg" ? "image/jpeg" : "image/png", 0.95), [f, FORMAT]);
    fs.writeFileSync(fileFor(f), Buffer.from(r.b64, "base64"));
    done++;
    const el = (Date.now() - t0) / 1000, rate = el / done;
    if (done === 1 || done % 10 === 0 || done === todo.length)
      console.log(`[${done}/${todo.length}] frame ${f} ${r.ms.toFixed(0)} ms | ${rate.toFixed(2)} s/frame avg | ETA ${((todo.length - done) * rate / 60).toFixed(1)} min`);
  }
  await page.close();
};
try {
  await Promise.all(Array.from({ length: Math.min(WORKERS, todo.length) }, (_, i) => worker(i)));
} finally {
  await browser.close();
  server.close();
}
console.log(`done: ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${outDir} (${W}x${H})`);
