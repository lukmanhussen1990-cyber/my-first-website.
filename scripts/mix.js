// Mixes voice + SFX stems with ffmpeg: ambience/drone/heartbeat ducked under
// the voice (sidechaincompress), then two-pass loudnorm to about -14 LUFS.
// Optionally muxes with a rendered video.
//
//   node scripts/mix.js                       -> audio/mix.wav
//   node scripts/mix.js --mux final/video.mp4 --out final/train_berth.mp4
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, loadTimeline } from './lib.js';

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const TARGET = { I: -14, TP: -1.5, LRA: 11 };

function ff(args, { capture = false } = {}) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) {
    console.error(r.stderr.slice(-3000));
    throw new Error('ffmpeg failed');
  }
  return capture ? r.stderr : '';
}

function buildMix(tl, out) {
  const inputs = [];
  const chains = [];
  const voLabels = [];
  for (const sc of tl.scenes) {
    if (!sc.vo) continue;
    const i = inputs.length / 2;
    inputs.push('-i', path.join(ROOT, sc.vo.file));
    const ms = Math.round(sc.vo.start * 1000);
    const voice =
      sc.vo.role === 'whisper'
        ? // close to your left ear: panned, intimate room, a little air
          `highpass=f=180,equalizer=f=6000:t=q:w=1:g=3,aecho=0.85:0.5:28|61:0.25|0.14,pan=stereo|c0=1.0*c0|c1=0.38*c0,volume=1.6`
        : `highpass=f=70,acompressor=threshold=-22dB:ratio=3:attack=6:release=150:makeup=2,equalizer=f=180:t=q:w=1:g=1.5,pan=stereo|c0=c0|c1=c0`;
    chains.push(`[${i}:a]aresample=48000,aformat=channel_layouts=mono,${voice},adelay=${ms}|${ms}[v${i}]`);
    voLabels.push(`[v${i}]`);
  }
  const stem = (name) => {
    const i = inputs.length / 2;
    inputs.push('-i', path.join(ROOT, 'audio/sfx', `${name}.wav`));
    return i;
  };
  const bed = stem('bed');
  const drone = stem('drone');
  const heart = stem('heart');
  const events = stem('events');
  const dur = tl.duration.toFixed(3);
  chains.push(`${voLabels.join('')}amix=inputs=${voLabels.length}:normalize=0:dropout_transition=0,apad,atrim=0:${dur}[vo]`);
  chains.push(`[vo]asplit=2[vomix][vokey]`);
  chains.push(`[${bed}:a]volume=0.55[b]`, `[${drone}:a]volume=0.32[d]`, `[${heart}:a]volume=0.9[h]`);
  chains.push(`[b][d][h]amix=inputs=3:normalize=0[bedmix]`);
  chains.push(`[bedmix][vokey]sidechaincompress=threshold=0.025:ratio=7:attack=12:release=380:makeup=1[ducked]`);
  chains.push(`[${events}:a]volume=0.9[fx]`);
  chains.push(`[vomix][ducked][fx]amix=inputs=3:normalize=0,atrim=0:${dur},asetpts=N/SR/TB[pre]`);
  const pre = path.join(ROOT, 'audio/premix.wav');
  if (process.env.MIX_DEBUG) {
    // write the voice, ducked bed and fx buses separately for level checks
    const dbg = chains.map((c) => c.replace('[vomix][ducked][fx]amix', '[vomix]asplit[vd][vomix2];[ducked]asplit[dd][ducked2];[fx]asplit[fd][fx2];[vomix2][ducked2][fx2]amix'));
    ff([...inputs, '-filter_complex', dbg.join(';'), '-map', '[pre]', '-c:a', 'pcm_s24le', pre, '-map', '[vd]', path.join(ROOT, 'audio/bus_vo.wav'), '-map', '[dd]', path.join(ROOT, 'audio/bus_bed.wav'), '-map', '[fd]', path.join(ROOT, 'audio/bus_fx.wav')]);
  } else {
    ff([...inputs, '-filter_complex', chains.join(';'), '-map', '[pre]', '-c:a', 'pcm_s24le', pre]);
  }

  // two-pass loudnorm
  const stats = ff(['-i', pre, '-af', `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`, '-f', 'null', '-'], { capture: true });
  const m = JSON.parse(stats.slice(stats.lastIndexOf('{'), stats.lastIndexOf('}') + 1));
  const ln = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  ff(['-i', pre, '-af', `${ln},aresample=48000`, '-c:a', 'pcm_s24le', out]);
  const check = ff(['-i', out, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { capture: true });
  const I = check.match(/I:\s+(-?[\d.]+) LUFS/g)?.pop();
  const peak = check.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.pop();
  console.log(`[mix] ${path.relative(ROOT, out)}  integrated ${I}  true-peak ${peak}`);
}

function mux(tl, video, audio, out) {
  const note = tl.voice_sources.some((s) => s.startsWith('offline-placeholder'))
    ? 'Voice: OFFLINE PLACEHOLDER (Piper) - regenerate with ElevenLabs'
    : 'Voice: ElevenLabs';
  ff(['-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', '-metadata', `title=The Train Berth`, '-metadata', `comment=${note}`, out]);
  console.log(`[mux] ${path.relative(ROOT, out)}`);
}

const tl = loadTimeline();
const mixOut = path.resolve(ROOT, opt('mix', 'audio/mix.wav'));
buildMix(tl, mixOut);
if (opt('mux')) mux(tl, path.resolve(ROOT, opt('mux')), mixOut, path.resolve(ROOT, opt('out', 'final/train_berth.mp4')));
