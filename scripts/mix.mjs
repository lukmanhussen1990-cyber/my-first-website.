// Mix + master + mux:
//   stems.py lays out VO and SFX on the timeline,
//   ffmpeg ducks the SFX under the voice (sidechaincompress), then gain + limiter + linear loudnorm to -14 LUFS,
//   and muxes with build/video.mp4 -> final/two_moms.mp4 (H.264 copy, AAC 192k, faststart).
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { P } from './config.mjs';

const TARGET = { I: -14, TP: -1.0, LRA: 11 };

function ff(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(r.stderr.slice(-2000));
  return r.stderr;
}

const graph = (tail) => [
  '[0:a]aresample=48000,aformat=channel_layouts=stereo[sfx]',
  '[1:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[vo1][vo2]',
  '[sfx][vo1]sidechaincompress=threshold=0.035:ratio=4:attack=15:release=450:knee=3:makeup=1[duck]',
  '[2:a]aresample=48000,aformat=channel_layouts=stereo[sting]',
  '[duck][vo2][sting]amix=inputs=3:normalize=0[pre]',
  `[pre]${tail}[out]`,
].join(';');

const readJSON = (log) => JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));

export function master() {
  console.log('Audio stems:');
  execFileSync('python3', [P('scripts', 'stems.py')], { stdio: 'inherit' });
  const sfx = P('audio', 'mix', 'sfx.wav'), vo = P('audio', 'mix', 'vo.wav'), sting = P('audio', 'mix', 'stingers.wav');
  const ln = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}`;
  const measure = (tail) => readJSON(ff(['-i', sfx, '-i', vo, '-i', sting, '-filter_complex', graph(`${tail}${tail ? ',' : ''}${ln}:print_format=json`), '-map', '[out]', '-f', 'null', '-']));

  // 1) measure the ducked mix, 2) static gain to the target + peak limiter, 3) final linear loudnorm
  const m1 = measure('');
  const gain = TARGET.I - Number(m1.input_i);
  const pre = `volume=${gain.toFixed(2)}dB,alimiter=limit=0.75:attack=3:release=60:level=disabled:latency=1`;
  const m2 = measure(pre);
  console.log(`  mix ${m1.input_i} LUFS -> gain ${gain.toFixed(2)} dB + limiter -> ${m2.input_i} LUFS, ${m2.input_tp} dBTP`);
  const master = P('audio', 'mix', 'master.wav');
  const ln3 = `${pre},${ln}:measured_I=${m2.input_i}:measured_TP=${m2.input_tp}:measured_LRA=${m2.input_lra}:measured_thresh=${m2.input_thresh}:offset=${m2.target_offset}:linear=true:print_format=json`;
  const m3 = readJSON(ff(['-i', sfx, '-i', vo, '-i', sting, '-filter_complex', graph(ln3), '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s16le', master]));
  console.log(`  master ${m3.output_i} LUFS, ${m3.output_tp} dBTP, LRA ${m3.output_lra} (${m3.normalization_type})`);
  return master;
}

export function mix({ video = P('build', 'video.mp4'), out = P('final', 'two_moms.mp4') } = {}) {
  const wav = master();
  // mux
  fs.mkdirSync(P('final'), { recursive: true });
  ff(['-i', video, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-shortest', '-movflags', '+faststart', out]);
  console.log(`  wrote ${out}`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { if (process.argv.includes('--audio-only')) master(); else mix(); } catch (e) { console.error(e.message); process.exit(1); }
}
