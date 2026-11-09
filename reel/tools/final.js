// Full-quality render: a small worker pool renders short chunks in parallel, then the chunks are
// concatenated and muxed with the final mix into grandma_sweater_reel.mp4.
//   node tools/final.js [workers=2] [chunkSeconds=1.5]
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const workers = parseInt(process.argv[2] || '2', 10);
const chunkSec = parseFloat(process.argv[3] || '1.5');
const cues = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/cues.json'), 'utf8'));
const fps = 30, totalFrames = Math.round(cues.duration * fps);
const segDir = path.join(ROOT, 'build/segments');
fs.mkdirSync(segDir, { recursive: true });

const chunks = [];
for (let f = 0; f < totalFrames; f += Math.round(chunkSec * fps)) {
  const f1 = Math.min(totalFrames, f + Math.round(chunkSec * fps));
  chunks.push({ i: chunks.length, from: f / fps, to: f1 / fps, file: path.join(segDir, `seg_${String(chunks.length).padStart(3, '0')}.mp4`) });
}
const todo = chunks.filter((c) => !fs.existsSync(c.file) || fs.statSync(c.file).size < 1000);
console.log(`${totalFrames} frames, ${chunks.length} chunks (${todo.length} to render), ${workers} workers`);
const T0 = Date.now();
let done = chunks.length - todo.length;

function run(c) {
  return new Promise((resolve, reject) => {
    const tmp = c.file + '.part.mp4';
    const p = spawn('node', [path.join(__dirname, 'render.js'), 'video', String(c.from), String(c.to), tmp], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`chunk ${c.i} failed: ${err.slice(-500)}`));
      fs.renameSync(tmp, c.file);
      done++;
      const el = (Date.now() - T0) / 1000;
      console.log(`chunk ${c.i} done (${done}/${chunks.length}) elapsed ${(el / 60).toFixed(1)} min`);
      resolve();
    });
  });
}
(async () => {
  const queue = todo.slice();
  await Promise.all(Array.from({ length: workers }, async () => { while (queue.length) await run(queue.shift()); }));
  const list = path.join(segDir, 'list.txt');
  fs.writeFileSync(list, chunks.map((c) => `file '${c.file}'`).join('\n'));
  const out = path.join(ROOT, '..', 'grandma_sweater_reel.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-i', path.join(ROOT, 'build/mix_final.wav'),
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  console.log('FINAL', out, ((Date.now() - T0) / 60000).toFixed(1), 'min');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
