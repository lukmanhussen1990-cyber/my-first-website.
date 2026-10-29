// Cuts the narration into phrase clips, applies a gentle tempo change (pitch kept),
// and re-joins them with the episode's pause rules. Writes audio/voice.wav (48 kHz mono)
// and src/data/voice_layout.json (where every phrase now starts and ends).
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'audio/appleee_upload.mp3');
const SR = 48000;
const TEMPO = 1.08;
const PRE = 0.045; // seconds of room tone kept before each phrase
const POST = 0.07; // and after
const VOICE_START = 1 / 30; // the voice starts on frame 1

const segments = JSON.parse(readFileSync(join(ROOT, 'src/data/segments.json'), 'utf8'));

const decode = (start, end) => {
  const raw = execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-ss', start.toFixed(3), '-to', end.toFixed(3), '-i', SRC,
    '-af', `rubberband=tempo=${TEMPO}:transients=smooth:formant=preserved,aresample=${SR}`,
    '-ac', '1', '-f', 'f32le', '-',
  ], {maxBuffer: 1 << 28});
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
};

const clips = [];
let speechStart = VOICE_START;
for (const seg of segments) {
  const cutStart = Math.max(0, seg.rawStart - PRE);
  const data = decode(cutStart, seg.rawEnd + POST);
  const clipStart = speechStart - (seg.rawStart - cutStart) / TEMPO;
  const speechEnd = speechStart + (seg.rawEnd - seg.rawStart) / TEMPO;
  clips.push({id: seg.id, clipStart, cutStart, data, speechStart, speechEnd});
  speechStart = speechEnd + seg.gapAfter;
}

const last = clips[clips.length - 1];
const total = last.clipStart + last.data.length / SR + 0.05;
const out = new Float32Array(Math.ceil(total * SR));
const fade = Math.round(0.012 * SR);
for (const c of clips) {
  const off = Math.round(c.clipStart * SR);
  const n = c.data.length;
  for (let i = 0; i < n; i++) {
    const g = Math.min(1, i / fade, (n - 1 - i) / fade);
    if (off + i >= 0) out[off + i] += c.data[i] * g;
  }
}

execFileSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', '-',
  '-c:a', 'pcm_f32le', join(ROOT, 'audio/voice.wav'),
], {input: Buffer.from(out.buffer)});

const layout = {
  tempo: TEMPO,
  pre: PRE,
  sampleRate: SR,
  durationSec: total,
  segments: clips.map((c) => ({
    id: c.id,
    clipStart: c.clipStart,
    cutStart: c.cutStart,
    speechStart: c.speechStart,
    speechEnd: c.speechEnd,
  })),
};
writeFileSync(join(ROOT, 'src/data/voice_layout.json'), JSON.stringify(layout, null, 1));
console.log(`voice.wav ${total.toFixed(2)} s, last speech ends ${last.speechEnd.toFixed(2)} s`);
