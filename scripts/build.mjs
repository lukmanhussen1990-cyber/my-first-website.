// One command, end to end:
//   1. voice lines (ElevenLabs with-timestamps, cached)   2. sound effects (ElevenLabs SFX or numpy synth, cached)
//   3. timeline from the real voice lengths                4. deterministic Three.js render -> build/video.mp4
//   5. mix (sidechain ducking + loudnorm -14 LUFS) + mux -> final/two_moms.mp4
//
//   node scripts/build.mjs [--workers N] [--skip-render]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { ensureVoice } from './voice.mjs';
import { buildTimeline } from './timeline.mjs';
import { mix } from './mix.mjs';
import { P } from './config.mjs';

const argv = process.argv.slice(2);
const workers = argv.includes('--workers') ? argv[argv.indexOf('--workers') + 1] : '1';

console.log('1/5 voice');
await ensureVoice();
console.log('2/5 sound effects');
execFileSync('node', [P('scripts', 'sfx-eleven.mjs')], { stdio: 'inherit' });
execFileSync('python3', [P('scripts', 'sfx.py')], { stdio: 'inherit' });
console.log('3/5 timeline');
const tl = buildTimeline();
fs.mkdirSync(P('build'), { recursive: true });
fs.writeFileSync(P('build', 'timeline.json'), JSON.stringify(tl, null, 2));
console.log(`  ${tl.duration.toFixed(2)} s, ${tl.frames} frames`);
if (!argv.includes('--skip-render')) {
  console.log('4/5 render');
  execFileSync('node', [P('scripts', 'render.mjs'), '--workers', workers], { stdio: 'inherit' });
}
console.log('5/5 mix + mux');
mix();
