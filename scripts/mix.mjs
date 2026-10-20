// Audio mix + final mux.
//  1. voice track: every line through its voice chain, placed at its timeline start
//  2. SFX ducked under the voice (sidechaincompress)
//  3. two-pass loudnorm to -14 LUFS / -1.5 dBTP
//  4. mux with the rendered picture -> final/night_shift.mp4 (H.264 copy, AAC 192k, +faststart)
//
//   node scripts/mix.mjs [--video frames/video.mp4] [--out final/night_shift.mp4] [--audio-only]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, readJSON, run } from './lib/util.mjs';
import { VO_CHAINS } from './lib/audiofx.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d);
const timeline = readJSON('src/timeline.json');
const MIX = path.join(ROOT, 'audio/mix');
fs.mkdirSync(MIX, { recursive: true });
const dur = timeline.duration;
const SR = 48000;

// 1) voice track
const inputs = [];
const parts = [];
timeline.vo.forEach((v, i) => {
  inputs.push('-i', path.join(ROOT, v.file));
  const delay = Math.max(0, Math.round(v.start * SR));
  parts.push(`[${i}:a]${VO_CHAINS[v.voice].join(',')},adelay=delays=${delay}S:all=1[v${i}]`);
});
const voMix = timeline.vo.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${timeline.vo.length}:normalize=0:dropout_transition=0,apad,atrim=0:${dur.toFixed(3)}[vo]`;
const voFile = path.join(MIX, 'vo.wav');
run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', parts.join(';') + ';' + voMix, '-map', '[vo]', '-ar', String(SR), '-c:a', 'pcm_s24le', voFile]);

// 2) duck the SFX under the voice and sum
const premix = path.join(MIX, 'premix.wav');
run('ffmpeg', ['-y', '-v', 'error', '-i', voFile, '-i', path.join(MIX, 'sfx.wav'), '-filter_complex',
  '[0:a]asplit=2[vo][key];' +
  '[1:a]atrim=0:' + dur.toFixed(3) + '[fx];' +
  '[fx][key]sidechaincompress=threshold=0.02:ratio=6:attack=12:release=380:makeup=1[duck];' +
  '[vo][duck]amix=inputs=2:normalize=0,alimiter=limit=0.95:level=disabled[out]',
  '-map', '[out]', '-ar', String(SR), '-c:a', 'pcm_s24le', premix]);

// 3) loudness: measure, then normalise linearly to -14 LUFS
const stats = (() => {
  const out = execFileSync('bash', ['-c', `ffmpeg -hide_banner -i "${premix}" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1`]).toString();
  return JSON.parse(out.slice(out.lastIndexOf('{'), out.lastIndexOf('}') + 1));
})();
const finalWav = path.join(MIX, 'final.wav');
const ln = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
run('ffmpeg', ['-y', '-v', 'error', '-i', premix, '-af', `${ln},aresample=${SR}`, '-c:a', 'pcm_s24le', finalWav]);
const check = execFileSync('bash', ['-c', `ffmpeg -hide_banner -i "${finalWav}" -af ebur128=peak=true -f null - 2>&1 | tail -12`]).toString();
const I = /I:\s+(-?[\d.]+) LUFS/.exec(check)?.[1];
const TP = /Peak:\s+(-?[\d.]+) dBFS/.exec(check)?.[1];
console.log(`Mix: integrated ${I} LUFS, true peak ${TP} dBTP (input was ${stats.input_i} LUFS)`);

// 4) mux
if (!args.includes('--audio-only')) {
  const video = path.resolve(ROOT, opt('video', 'frames/video.mp4'));
  const out = path.resolve(ROOT, opt('out', 'final/night_shift.mp4'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-i', finalWav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', String(SR), '-shortest', '-movflags', '+faststart', out]);
  console.log(`Final: ${path.relative(ROOT, out)}`);
}
