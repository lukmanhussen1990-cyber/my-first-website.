// Reusable reel mixer: voice + music (ducked under the voice) + sfx, then
// two-pass ffmpeg loudnorm to −14 LUFS / −1 dBTP.
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {SR, Stereo, readWav, writeWav} from './dsp.ts';

export interface MixOptions {
  voice?: string; // path, optional
  music: string;
  sfx: string;
  out: string; // final wav
  seconds: number; // total length
  musicGain?: number;
  sfxGain?: number;
  duckDb?: number; // music reduction under the voice
  lufs?: number;
  tp?: number;
}

export const mixReel = (o: MixOptions) => {
  const N = Math.ceil(o.seconds * SR);
  const voice = o.voice && existsSync(o.voice) ? readWav(o.voice) : null;
  const music = readWav(o.music);
  const sfx = readWav(o.sfx);
  const duck = new Float32Array(N).fill(1);
  if (voice) {
    // voice activity → smoothed gain (attack 60 ms, release 350 ms)
    const win = Math.round(0.03 * SR);
    const floor = Math.pow(10, -(o.duckDb ?? 8) / 20);
    let g = 1;
    const att = Math.exp(-1 / (0.06 * SR));
    const rel = Math.exp(-1 / (0.35 * SR));
    let rms = 0;
    for (let i = 0; i < N; i++) {
      const v = i < voice.length ? (Math.abs(voice.L[i]) + Math.abs(voice.R[i])) / 2 : 0;
      rms = rms + (v - rms) / win;
      const target = rms > 0.012 ? floor : 1;
      g = target < g ? target + (g - target) * att : target + (g - target) * rel;
      duck[i] = g;
    }
  }
  const mix = new Stereo(N);
  const mg = o.musicGain ?? 0.55;
  const sg = o.sfxGain ?? 0.6;
  for (let i = 0; i < N; i++) {
    let l = 0;
    let r = 0;
    if (voice && i < voice.length) {
      l += voice.L[i];
      r += voice.R[i];
    }
    if (i < music.length) {
      l += music.L[i] * mg * duck[i];
      r += music.R[i] * mg * duck[i];
    }
    if (i < sfx.length) {
      l += sfx.L[i] * sg;
      r += sfx.R[i] * sg;
    }
    mix.L[i] = l;
    mix.R[i] = r;
  }
  const pre = o.out.replace(/\.wav$/, '.premix.wav');
  writeWav(pre, mix);
  const I = o.lufs ?? -14;
  const TP = o.tp ?? -1;
  const stderr = execFileSync(
    'bash',
    ['-c', `ffmpeg -hide_banner -nostats -i "${pre}" -af loudnorm=I=${I}:TP=${TP}:LRA=11:print_format=json -f null - 2>&1 >/dev/null`],
    {encoding: 'utf8'},
  );
  const json = JSON.parse(stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1));
  const af =
    `loudnorm=I=${I}:TP=${TP}:LRA=11:measured_I=${json.input_i}:measured_TP=${json.input_tp}:` +
    `measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}:linear=true:print_format=summary`;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', pre, '-af', af, '-ar', String(SR), '-c:a', 'pcm_s24le', o.out]);
  return json;
};

/** Integrated loudness + true peak of a file (for the final check). */
export const measure = (file: string) => {
  const err = execFileSync('bash', ['-c', `ffmpeg -hide_banner -nostats -i "${file}" -af ebur128=peak=true -f null - 2>&1 >/dev/null | tail -12`], {
    encoding: 'utf8',
  });
  const I = /I:\s+(-?[\d.]+) LUFS/.exec(err)?.[1];
  const P = /Peak:\s+(-?[\d.]+) dBFS/.exec(err)?.[1];
  return {lufs: Number(I), truePeak: Number(P)};
};
