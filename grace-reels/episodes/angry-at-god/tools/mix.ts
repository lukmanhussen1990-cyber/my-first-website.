// Mix voice (+ a soft echo on David's quote lines) + music + sfx → audio/final_mix.wav.
import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {SR, readWav, writeWav} from '../../../src/shared/audio/dsp.ts';
import {measure, mixReel} from '../../../src/shared/audio/mix.ts';
import {makeAnchors} from '../src/anchors.ts';

const here = (p: string) => new URL(p, import.meta.url).pathname;
const tl = JSON.parse(readFileSync(here('../audio/timeline.json'), 'utf8'));
const A = makeAnchors(tl);
const v = readWav(here('../audio/voice.wav'));
// soft echo on lines 3–4 (David's "How long" quotes)
const a = Math.round((A.T.sf(3) / 30) * SR), b = Math.round((A.T.ef(4) / 30 + 0.3) * SR);
for (const [d, g] of [[0.22, 0.22], [0.44, 0.1]] as const) {
  const o = Math.round(d * SR);
  for (let i = b - 1; i >= a; i--) if (i + o < v.length) { v.L[i + o] += v.L[i] * g; v.R[i + o] += v.R[i] * g; }
}
writeWav(here('../audio/voice_fx.wav'), v);
const out = here('../audio/final_mix.wav');
const j = mixReel({voice: here('../audio/voice_fx.wav'), music: here('../audio/music.wav'), sfx: here('../audio/sfx.wav'), out, seconds: A.total / 30, musicGain: 0.55, sfxGain: 0.6, duckDb: 8});
console.log('pass-1:', j.input_i, 'LUFS; final:', measure(out));
mkdirSync(here('../../../public/angry-at-god'), {recursive: true});
copyFileSync(out, here('../../../public/angry-at-god/final_mix.wav'));
tl.audio = 'angry-at-god/final_mix.wav';
writeFileSync(here('../audio/timeline.json'), JSON.stringify(tl, null, 1));
