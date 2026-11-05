// PCM helpers: decode anything with ffmpeg into Float32 mono, write 16-bit WAV.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

export const SR = 48000;

export function decode(file, { start, dur, sr = SR } = {}) {
  const args = ['-v', 'error'];
  if (start !== undefined) args.push('-ss', String(start));
  if (dur !== undefined) args.push('-t', String(dur));
  args.push('-i', file, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-');
  const buf = execFileSync('ffmpeg', args, { maxBuffer: 1 << 30 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice();
}

export function writeWav(file, channels, sr = SR) {
  const n = channels[0].length, ch = channels.length;
  const b = Buffer.alloc(44 + n * ch * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * ch * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * ch * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-1, Math.min(1, channels[c][i]));
    b.writeInt16LE(Math.round(v * 32767), o); o += 2;
  }
  fs.writeFileSync(file, b);
}
