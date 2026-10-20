// End-to-end build: voice -> timeline -> sfx -> render (chunked) -> mix -> mux.
//
//   node scripts/build.js                 full pipeline
//   node scripts/build.js --skip-render   re-mix / re-mux using final/video.mp4
//   node scripts/build.js --chunk 640     frames per render chunk (default 640)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, loadTimeline } from './lib.js';

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const py = fs.existsSync(path.join(ROOT, '.venv/bin/python')) ? path.join(ROOT, '.venv/bin/python') : 'python3';

function run(cmd, args) {
  console.log(`\n$ ${[cmd, ...args].join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0 && r.status !== 2) throw new Error(`${cmd} ${args[0]} failed (${r.status})`);
}

run('node', ['scripts/voice.js']);
run('node', ['scripts/timeline.js']);
run(py, ['scripts/sfx.py']);
const tl = loadTimeline();
const video = path.join(ROOT, 'final/video.mp4');
if (!argv.includes('--skip-render')) {
  const size = Number(opt('chunk', 640));
  const parts = [];
  for (let f = 0; f < tl.frames; f += size) {
    const out = path.join(ROOT, 'final/parts', `part_${String(f).padStart(5, '0')}.mp4`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (!fs.existsSync(out)) run('node', ['scripts/render.js', '--from', String(f), '--to', String(f + size), '--out', path.relative(ROOT, out)]);
    parts.push(out);
  }
  const list = path.join(ROOT, 'final/parts/list.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n') + '\n');
  run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', video]);
}
run('node', ['scripts/mix.js', '--mux', path.relative(ROOT, video), '--out', 'final/train_berth.mp4']);
