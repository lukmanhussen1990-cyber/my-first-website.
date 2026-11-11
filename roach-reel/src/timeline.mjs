// Single source of truth for timing: scene cuts, caption chunks and SFX cues, all keyed to the
// faster-whisper word timestamps in build/words.json. `node src/timeline.mjs` dumps JSON for the mixer.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const words = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/words.json'), 'utf8')).words;
export const WORDS = words;
export const DURATION = 32.7575; // voiceover length (s)
export const FRAMES = Math.ceil(DURATION * 60);

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** start time of the nth occurrence of a word */
export function ws(word, n = 1) {
  let k = 0;
  for (const w of words) if (norm(w.word) === norm(word) && ++k === n) return w.start;
  throw new Error('word not found: ' + word + ' #' + n);
}
export function we(word, n = 1) {
  let k = 0;
  for (const w of words) if (norm(w.word) === norm(word) && ++k === n) return w.end;
  throw new Error('word not found: ' + word + ' #' + n);
}

// ----------------------------------------------------------------- scene cuts
export const CUTS = {
  hook: 0,
  clock: 2.68,
  bath: 3.8,
  salmon: 6.02,
  face: 9.86,
  burrow: 12.66,
  rent: 17.46,
  bed: 18.6,
  surf: 20.4,
  wave: 23.94,
  waveBack: 24.58,
  dive: 25.16,
  parade: 25.92,
  hotel: 29.36,
  genius: 31.52,
  end: FRAMES / 60,
};

// ----------------------------------------------------------------- captions
// [text, startWordIndex-based timing] -> built from word list with explicit groupings
const GROUPS = [
  ['What', 'happens'], ['if', 'a', 'cockroach'], ['crawls', 'into', 'your'], ['fucking', 'dick?'],
  ["It's", '3am.'], ["You're", 'peeing'], ['half', '-asleep'], ['with', 'your', 'eyes'], ['closed.'],
  ['A', 'cockroach'], ['sees', 'the', 'stream'], ['and', 'climbs'], ['up', 'it', 'like'], ['a', 'fucking'], ['salmon.'],
  ['Straight', 'in.'], ['No', 'ticket,'], ['no', 'fucking'], ['permission.'],
  ['Now', 'it', 'lives'], ['in', 'there.'],
  ["It's", 'got'], ['a', 'sofa,'], ['a', 'TV,'], ['a', 'tiny'], ['fucking', 'fridge.'],
  ['It', 'even'], ['pays', 'rent.'], ['Two', 'crumbs'], ['a', 'fucking', 'month.'],
  ['Every', 'time'], ['you', 'pee,'], ['it', 'surfs', 'out'], ['on', 'a', 'tiny'], ['fucking', 'surfboard,'],
  ['waves', 'at', 'you,'], ['and', 'swims'], ['back', 'in.'],
  ['Then,'], ['one', 'night,'], ['it', 'invites'], ['its', '400'], ['fucking', 'cousins.'],
  ['Now,'], ['your', 'dick'], ['is', 'a', 'fucking'], ['hotel.'],
  ['Genius.'],
];
const KEY = new Set(['cockroach', '3am', 'asleep', 'closed', 'stream', 'climbs', 'salmon', 'straight', 'in', 'ticket', 'permission', 'there', 'sofa', 'tv', 'fridge', 'rent', 'crumbs', 'month', 'pee', 'surfs', 'surfboard', 'waves', 'back', 'night', 'invites', '400', 'cousins', 'hotel', 'genius', 'tiny', 'lives']);
const PINK = new Set(['fuck', 'fucking', 'dick']);
const DISPLAY = { '3am.': '3 A.M.', '-asleep': 'ASLEEP', half: 'HALF-' };

export const CAPTIONS = (() => {
  const out = [];
  let wi = 0;
  for (const g of GROUPS) {
    const ws_ = [];
    for (const token of g) {
      const w = words[wi];
      if (!w || w.word !== token) throw new Error(`caption mismatch at ${wi}: "${w && w.word}" vs "${token}"`);
      const n = norm(w.word);
      ws_.push({ text: (DISPLAY[w.word] || w.word.toUpperCase()).replace(/,$/, ''), start: w.start, end: w.end, color: PINK.has(n) ? 'pink' : KEY.has(n) ? 'yellow' : 'white' });
      wi++;
    }
    out.push({ words: ws_, start: ws_[0].start, end: ws_[ws_.length - 1].end });
  }
  // each chunk holds until the next chunk starts (max 0.9 s after its last word)
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1] ? out[i + 1].start : DURATION;
    out[i].hold = i === out.length - 1 ? DURATION + 1 : Math.min(next, out[i].end + 0.9);
  }
  return out;
})();

// ----------------------------------------------------------------- SFX cues  [file, time, gainDb, opts]
// files: generated (assets/sfx/*.wav) or synth:<name> (procedural, tools/mix_audio.py)
export const SFX = [
  // hook
  ['synth:riser', 0.0, -21, { dur: 2.1 }],
  ['synth:drone', 0.0, -22, { dur: 2.7 }],
  ['synth:boom', ws('dick'), -8],
  ['synth:sting_hit', ws('dick'), -14],
  // 3 AM
  ['crickets', CUTS.clock, -20, { dur: CUTS.face - CUTS.clock, fade: 0.4 }],
  ['synth:clock_ticks', CUTS.clock, -14, { dur: 1.1 }],
  ['synth:whoosh_short', CUTS.bath - 0.18, -16],
  ['synth:footsteps', CUTS.bath + 0.05, -15, { dur: 1.0 }],
  ['yawn', ws('peeing') - 0.05, -8],
  ['trickle', ws('eyes') - 0.15, -15, { dur: CUTS.face - ws('eyes') + 0.1, fade: 0.25 }],
  // salmon
  ['synth:boing', ws('sees') + 0.05, -14],
  ['synth:snap', ws('and', 1) + 0.05, -10],
  ['whoosh', ws('climbs') - 0.2, -9],
  ['sting', ws('climbs') - 0.02, -10],
  ['splash', ws('climbs') + 0.04, -9],
  ['synth:sparkle', ws('climbs') + 0.35, -18, { dur: 1.3 }],
  ['splash2', ws('salmon') + 0.05, -14],
  // straight in
  ['wheee', CUTS.face + 0.02, -8],
  ['door', ws('in', 1) - 0.02, -10],
  ['synth:boom', ws('in', 1), -16],
  ['synth:zing', ws('in', 1) + 0.02, -19],
  ['synth:stamp', ws('ticket') + 0.12, -13],
  ['synth:stamp', ws('permission') + 0.2, -12],
  // burrow
  ['synth:iris', CUTS.burrow - 0.08, -12],
  ['synth:latch', ws('lives') - 0.05, -11],
  ['synth:pop', ws('lives') + 0.02, -12],
  ['synth:whoosh_short', ws('lives') + 0.1, -20],
  ['synth:pop', ws('sofa') + 0.02, -9],
  ['synth:thump', ws('sofa') + 0.16, -10],
  ['synth:pop', ws('tv') + 0.02, -9],
  ['tv', ws('tv') + 0.1, -16],
  ['synth:pop', ws('fridge') + 0.02, -9],
  ['synth:fridge_hum', ws('fridge') + 0.12, -15, { dur: CUTS.rent - ws('fridge') - 0.05 }],
  ['synth:boing', ws('fridge') + 0.32, -15],
  // rent
  ['synth:paper_slide', ws('pays') + 0.02, -12],
  ['crickets', CUTS.bed, -26, { dur: CUTS.surf - CUTS.bed, fade: 0.3 }],
  ['clink', ws('two') + 0.02, -9],
  ['clink', ws('crumbs') + 0.04, -10],
  ['synth:blip', ws('month') - 0.25, -16],
  // surf
  ['crickets', CUTS.surf, -24, { dur: CUTS.parade - CUTS.surf, fade: 0.3 }],
  ['trickle', ws('time') - 0.1, -16, { dur: CUTS.parade - ws('time'), fade: 0.3 }],
  ['wave', ws('surfs') - 0.1, -13],
  ['surf', ws('surfs') - 0.02, -10],
  ['synth:spray', ws('surfboard') - 0.05, -16, { dur: 0.9 }],
  ['hey', ws('waves') + 0.04, -6],
  ['synth:shimmer', CUTS.waveBack + 0.02, -18],
  ['splash2', ws('back') + 0.0, -10],
  // parade
  ['crickets', CUTS.parade, -24, { dur: CUTS.hotel - CUTS.parade, fade: 0.3 }],
  ['crowd', CUTS.parade + 0.15, -14, { dur: CUTS.genius - CUTS.parade - 0.1, fade: 0.5 }],
  ['synth:march', CUTS.parade, -16, { dur: CUTS.hotel - CUTS.parade }],
  ['synth:party', ws('invites') + 0.05, -12],
  ['synth:counter', ws('400') - 0.02, -14, { dur: 0.5 }],
  ['synth:boom', ws('400') + 0.48, -14],
  // hotel
  ['synth:whoosh_short', CUTS.hotel - 0.12, -14],
  ['synth:build', CUTS.hotel + 0.1, -14, { dur: 1.3 }],
  ['bell', ws('hotel') + 0.0, -8],
  ['synth:neon', ws('hotel') + 0.06, -16, { dur: 0.6 }],
  // genius
  ['scratch', CUTS.genius - 0.24, -12],
  ['synth:chime', ws('genius') + 0.0, -15],
  ['synth:neon', ws('genius') + 0.35, -18, { dur: 0.5 }],
  ['synth:twitch', ws('genius') + 0.55, -18],
];

if (process.argv[1] && process.argv[1].endsWith('timeline.mjs')) {
  process.stdout.write(JSON.stringify({ duration: DURATION, frames: FRAMES, cuts: CUTS, sfx: SFX, captions: CAPTIONS }, null, 1));
}
