// Renders logo.html frame by frame in headless Chromium and encodes an MP4 with ffmpeg.
// Usage: NODE_PATH=$(npm root -g) node render.js [out.mp4] [fps] [query]
//   e.g. node render.js logo.mp4 60 "name=ACME%20STUDIO&mono=M&tag=EST.%202026"
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const out = path.resolve(process.argv[2] || "logo.mp4");
const fps = +(process.argv[3] || 60);
const query = process.argv[4] || "";
const W = 1920, H = 1080;

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--allow-file-access-from-files"],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const url = "file://" + path.join(__dirname, "logo.html") + `?capture=1&w=${W}&h=${H}&${query}`;
  await page.goto(url);
  await page.evaluate(() => window.ready);
  const duration = await page.evaluate(() => window.DURATION);
  const frames = Math.round(duration * fps);

  const ff = spawn("ffmpeg", [
    "-y", "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });

  for (let i = 0; i < frames; i++) {
    await page.evaluate(t => window.render(t), i / fps);
    const buf = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
    if (i % 30 === 0) process.stderr.write(`frame ${i}/${frames}\r`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on("close", r));
  await browser.close();
  console.log(`\nwrote ${out}`);
})();
