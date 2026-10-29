// Build voice.wav + timeline.json from one full ElevenLabs read and its
// word-level transcript.
// Usage: node tools/voice_build.ts <raw audio> <words.json> [tempo=1.0] [voice label]
//   words.json: [{text, start, end}, ...] in raw-audio seconds (ElevenLabs Scribe).
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {SR, Stereo, biquad, readWav, writeWav} from '../../../src/shared/audio/dsp.ts';
import {align, fillTimes, placeClip, quietPoint, type StWord} from '../../../src/shared/audio/voice.ts';
import {SENTENCES, sentenceWords} from '../src/script.ts';

const [, , rawPath, wordsPath, tempoArg, label] = process.argv;
const tempo = Number(tempoArg ?? '1') || 1;
const here = (p: string) => new URL(p, import.meta.url).pathname;
const tmp = here('../audio/clips/raw48k.wav');

// 1. decode (and optionally speed up) the raw read to 48 kHz mono
const af = [`aresample=${SR}`, ...(tempo !== 1 ? [`atempo=${tempo}`] : []), 'highpass=f=70'];
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', rawPath, '-ac', '1', '-af', af.join(','), '-c:a', 'pcm_f32le', tmp]);
const raw = readWav(tmp).L;
const heard: StWord[] = (JSON.parse(readFileSync(wordsPath, 'utf8')) as StWord[])
  .filter((w) => /[A-Za-z0-9]/.test(w.text))
  .map((w) => ({text: w.text.trim(), start: w.start / tempo, end: w.end / tempo}));

// 2. align script words to what was heard
const scriptWords = SENTENCES.flatMap((s) => sentenceWords(s).map((w) => ({...w, sentence: s.id, scene: s.scene})));
const map = align(
  scriptWords.map((w) => w.text),
  heard.map((w) => w.text),
);
const matched = map.filter((k) => k >= 0).length;
const times = fillTimes(map, heard);
console.log(`aligned ${matched}/${scriptWords.length} words`);

// 3. cut each sentence at quiet points and re-join with the designed pauses
const FIRST = 1 / 30; // the voice starts on frame 1
const out = new Stereo(Math.ceil((raw.length / SR + 30) * SR));
const words: any[] = [];
const sentences: any[] = [];
let cursor = FIRST; // where the next sentence's first word should start
let idx = 0;
for (const s of SENTENCES) {
  const n = sentenceWords(s).length;
  const ws = times.slice(idx, idx + n);
  const sw = scriptWords.slice(idx, idx + n);
  idx += n;
  const first = ws[0].start;
  const last = ws[n - 1].end;
  const pre = s.id === 1 ? 0.03 : 0.07;
  const cutIn = quietPoint(raw, first - pre, 0.03);
  const cutOut = quietPoint(raw, last + 0.1, 0.06);
  const shift = cursor - first; // raw time → reel time
  placeClip(raw, Math.max(cutIn, first - 0.12), cutOut, out, Math.max(0, cutIn, first - 0.12) + shift);
  ws.forEach((t, k) =>
    words.push({
      text: sw[k].text,
      start: +(t.start + shift).toFixed(3),
      end: +(t.end + shift).toFixed(3),
      sentence: s.id,
      scene: s.scene,
      page: sw[k].page,
      keyword: sw[k].keyword,
      tone: sw[k].tone,
    }),
  );
  sentences.push({id: s.id, scene: s.scene, start: +(first + shift).toFixed(3), end: +(last + shift).toFixed(3)});
  cursor = last + shift + s.pauseAfter;
}
const voiceEnd = sentences[sentences.length - 1].end;

// 4. trim, gentle polish, normalise to −1 dBFS peak
const len = Math.ceil((voiceEnd + 0.6) * SR);
const v = new Stereo(len);
for (let i = 0; i < len; i++) {
  v.L[i] = out.L[i];
  v.R[i] = out.R[i];
}
biquad(v.L, 'peak', 3200, 0.8, 1.5);
biquad(v.R, 'peak', 3200, 0.8, 1.5);
const pk = v.peak();
v.scale(0.89 / pk);
writeWav(here('../audio/voice.wav'), v);

const tl = {fps: 30, voice: label ?? 'ElevenLabs', voiceEnd: +voiceEnd.toFixed(3), audio: null, words, sentences};
writeFileSync(here('../audio/timeline.json'), JSON.stringify(tl, null, 1));
console.log(`voice.wav ready: voice ends at ${voiceEnd.toFixed(2)} s (tempo ${tempo})`);
