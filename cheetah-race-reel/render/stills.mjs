// Render stills in one browser session.
//   node render/stills.mjs jobs.json        (array of {query, out, t, samples})
//   node render/stills.mjs "<query>" out.png t1 [t2 ...]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { startServer } from './server.mjs';

let jobs;
const argv = process.argv.slice(2);
if (argv[0].endsWith('.json')) jobs = JSON.parse(fs.readFileSync(argv[0], 'utf8'));
else { const [query, out, ...times] = argv; jobs = (times.length ? times : ['0']).map((t) => ({ query, out: out.replace('%', t), t: +t })); }
const defSamples = +(process.env.SAMPLES || 8);
const port = 8800 + Math.floor(Math.random() * 900);
let cur = null;
const server = await startServer(port, async (buf) => {
  const q = new URLSearchParams(cur.query); const W = +(q.get('w') || 1080), H = +(q.get('h') || 1920);
  await new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', '-vf', 'vflip', cur.out]);
    ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
    ff.stdin.end(buf);
  });
});
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: false,
  args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-gpu-sandbox', '--enable-gpu', '--disable-gpu-driver-bug-workarounds', '--js-flags=--max-old-space-size=4096'] });
const page = await browser.newPage({ viewport: { width: 64, height: 64 } });
page.on('console', (m) => { const s = m.text(); if (!/GPU stall|PCFSoft|404/.test(s)) console.log('[page]', s); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
let loaded = null;
for (const job of jobs) {
  cur = job;
  if (loaded !== job.query) {
    await page.goto(`http://127.0.0.1:${port}/render/index.html?${job.query}`);
    await page.waitForFunction(() => window.ready === true, null, { timeout: 300000 });
    loaded = job.query;
  }
  const r = await page.evaluate(([t, n, sh]) => window.renderFrame(t, { samples: n, shutter: sh }), [job.t || 0, job.samples || defSamples, job.shutter ?? 0.5]);
  console.log(`${job.out} t=${job.t} ${r.ms}ms N=${r.N}`);
}
await browser.close(); server.close();
