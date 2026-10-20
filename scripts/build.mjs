// One command, end to end:
//   voice (cached) -> timeline -> sound design -> render picture -> mix + mux -> final/night_shift.mp4
//
//   node scripts/build.mjs [--workers 2] [--skip-render]
import { ROOT, run } from './lib/util.mjs';

const args = process.argv.slice(2);
const workers = args.includes('--workers') ? args[args.indexOf('--workers') + 1] : '2';
const env = { ...process.env, NODE_USE_ENV_PROXY: '1' };
const step = (title, cmd, a) => {
  console.log(`\n=== ${title} ===`);
  run(cmd, a, { cwd: ROOT, env });
};

step('Voice lines (cached)', 'node', ['scripts/voice.mjs']);
step('Timeline from real voice lengths', 'node', ['scripts/timeline.mjs']);
step('Sound design', 'python3', ['scripts/sfx.py']);
if (!args.includes('--skip-render')) step('Render picture', 'node', ['scripts/render.mjs', '--workers', workers]);
step('Mix + mux', 'node', ['scripts/mix.mjs']);
