// Mix voice + music + sfx → audio/final_mix.wav (−14 LUFS, −1 dBTP) and copy it
// into public/ so Remotion can play it. Usage: node tools/mix.ts
import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {measure, mixReel} from '../../../src/shared/audio/mix.ts';
import {makeAnchors} from '../src/anchors.ts';

const here = (p: string) => new URL(p, import.meta.url).pathname;
const tlPath = here('../audio/timeline.json');
const tl = JSON.parse(readFileSync(tlPath, 'utf8'));
const A = makeAnchors(tl);
const out = here('../audio/final_mix.wav');
const j = mixReel({
  voice: here('../audio/voice.wav'),
  music: here('../audio/music.wav'),
  sfx: here('../audio/sfx.wav'),
  out,
  seconds: A.total / 30,
  musicGain: 0.55,
  sfxGain: 0.6,
  duckDb: 8,
});
console.log('pass-1 input:', j.input_i, 'LUFS', j.input_tp, 'dBTP');
console.log('final:', measure(out));
mkdirSync(here('../../../public/fire-insurance'), {recursive: true});
copyFileSync(out, here('../../../public/fire-insurance/final_mix.wav'));
tl.audio = 'fire-insurance/final_mix.wav';
writeFileSync(tlPath, JSON.stringify(tl, null, 1));
