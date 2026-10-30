// Mix voice + music + sfx with the music ducked under the voice.
// Usage: node mix.mjs voice.wav music.wav sfx.wav out.wav [musicDuckDb=8] [sfxDuckDb=4]
import { Bus, SR, db, readWavMono, writeWav } from './dsp.mjs';
import fs from 'node:fs';

const [voicePath, musicPath, sfxPath, outPath, mDuck = '8', sDuck = '4'] = process.argv.slice(2);
const voice = readWavMono(voicePath).x;
const stereo = (p) => {
  // read a float32 stereo wav written by dsp.writeWav
  const b = fs.readFileSync(p);
  const n = (b.length - 44) / 8;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = b.readFloatLE(44 + i * 8);
    R[i] = b.readFloatLE(48 + i * 8);
  }
  return { L, R, n };
};
const music = stereo(musicPath);
const sfx = stereo(sfxPath);
const n = Math.max(music.n, sfx.n, voice.length);
const out = new Bus(n / SR);

// voice activity envelope (20 ms RMS) -> smoothed duck gains
const hop = SR / 50;
const active = new Uint8Array(Math.ceil(n / hop));
for (let k = 0; k < active.length; k++) {
  let s = 0;
  for (let i = k * hop; i < Math.min(voice.length, (k + 1) * hop); i++) s += voice[i] * voice[i];
  active[k] = 10 * Math.log10(s / hop + 1e-12) > -42 ? 1 : 0;
}
// hold 150 ms so short gaps between words don't pump
const held = Uint8Array.from(active);
for (let k = 0; k < active.length; k++) if (active[k]) for (let j = 1; j <= 8 && k + j < held.length; j++) held[k + j] = 1;
const gM = db(-Number(mDuck));
const gS = db(-Number(sDuck));
let gm = 1, gs = 1;
const att = Math.exp(-1 / (0.06 * SR));
const rel = Math.exp(-1 / (0.45 * SR));
for (let i = 0; i < n; i++) {
  const on = held[Math.floor(i / hop)] === 1;
  const tm = on ? gM : 1;
  const ts = on ? gS : 1;
  gm = tm < gm ? tm + (gm - tm) * att : tm + (gm - tm) * rel;
  gs = ts < gs ? ts + (gs - ts) * att : ts + (gs - ts) * rel;
  const v = i < voice.length ? voice[i] : 0;
  const m = i < music.n ? [music.L[i], music.R[i]] : [0, 0];
  const x = i < sfx.n ? [sfx.L[i], sfx.R[i]] : [0, 0];
  out.L[i] = v + m[0] * gm + x[0] * gs;
  out.R[i] = v + m[1] * gm + x[1] * gs;
}
writeWav(outPath, out);
console.log('premix written', (n / SR).toFixed(2), 's');
