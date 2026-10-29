// Idea 81 · Just Fire Insurance? — narration source of truth.
// `*word*` marks a keyword, `|` marks a caption page break.
// Keyword tones: gold = hope, red = fear/sin, blue = sad, green = "you".

import type {KeywordTone} from '../../../src/kit-flat/palette';

export interface Sentence {
  id: number;
  scene: string;
  text: string;
  tones: Record<string, KeywordTone>; // lower-case word (no punctuation) → tone
  pauseAfter: number; // seconds of silence after this sentence
}

const P = 0.3;

export const SENTENCES: Sentence[] = [
  {id: 1, scene: 'S1', text: "If you only pray | because you're scared of *hell*…", tones: {hell: 'red'}, pauseAfter: P},
  {id: 2, scene: 'S2', text: 'is Jesus just your *fire insurance*?', tones: {jesus: 'gold', fire: 'red', insurance: 'red'}, pauseAfter: 0.5},
  {id: 3, scene: 'S3', text: 'Is that faith even *real*?', tones: {real: 'gold'}, pauseAfter: P},
  {id: 4, scene: 'S4', text: "One night, Jesus' friends were in a boat… | in a huge *storm*.", tones: {storm: 'red'}, pauseAfter: P},
  {id: 5, scene: 'S5', text: 'The waves crashed in. | They were sure they would *die*.', tones: {die: 'red'}, pauseAfter: P},
  {id: 6, scene: 'S6', text: 'And Jesus? He was *asleep*.', tones: {jesus: 'gold', asleep: 'blue'}, pauseAfter: 0.6},
  {
    id: 7,
    scene: 'S7',
    text: 'So they woke Him up | with the most scared prayer ever: | "Master, carest thou not | that we *perish*?"',
    tones: {perish: 'red'},
    pauseAfter: P,
  },
  {id: 8, scene: 'S8', text: "That wasn't love. | That was pure *fear*.", tones: {fear: 'red'}, pauseAfter: 0.8},
  {
    id: 9,
    scene: 'S9',
    text: 'But notice. | Jesus didn\'t say, "Wrong reason." | He got up and said: | "Peace, be *still*."',
    tones: {jesus: 'gold', still: 'gold'},
    pauseAfter: P,
  },
  {id: 10, scene: 'S10', text: 'And the storm *stopped*.', tones: {stopped: 'gold'}, pauseAfter: 0.7},
  {id: 11, scene: 'S10', text: 'He answered a *scared* prayer.', tones: {scared: 'red'}, pauseAfter: P},
  {id: 12, scene: 'S11', text: 'Then He asked them: | "Why are ye so *fearful*?"', tones: {fearful: 'red'}, pauseAfter: P},
  {
    id: 13,
    scene: 'S12',
    text: 'Because fear is where faith can *start*. | "The fear of the LORD | is the *beginning* of wisdom."',
    tones: {start: 'gold', beginning: 'gold'},
    pauseAfter: P,
  },
  {
    id: 14,
    scene: 'S13',
    text: "But it's only the beginning. | God doesn't just want your fear. | He wants your *heart*.",
    tones: {heart: 'gold'},
    pauseAfter: P,
  },
  {id: 15, scene: 'S14', text: '"There is no fear in love; | but perfect love casteth out *fear*."', tones: {fear: 'red'}, pauseAfter: P},
  {id: 16, scene: 'S15', text: 'And the best part? | "We love him, | because he first *loved* us."', tones: {loved: 'gold'}, pauseAfter: P},
  {
    id: 17,
    scene: 'S15',
    text: "You don't have to make the love yourself. | Just get close enough | to see how much He loves *you*.",
    tones: {you: 'green'},
    pauseAfter: P,
  },
  {
    id: 18,
    scene: 'S16',
    text: "So if fear brought you to Jesus… | that's okay. | Just don't *stay* there.",
    tones: {jesus: 'gold', stay: 'green'},
    pauseAfter: 0.6,
  },
  {id: 19, scene: 'S17', text: 'Why do you pray? | Fear, or love? | One word.', tones: {fear: 'red', love: 'gold'}, pauseAfter: P},
  {id: 20, scene: 'S18', text: "And send this to someone | who only prays when they're *scared*.", tones: {scared: 'red'}, pauseAfter: 0},
];

/** Text the voice actually reads (no markup). */
export const spokenText = (s: Sentence) => s.text.replace(/\|\s*/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();

/** Words with caption-page index, keyword flag and tone. */
export const sentenceWords = (s: Sentence) => {
  const pages = s.text.split('|').map((p) => p.trim());
  const out: {text: string; page: number; keyword: boolean; tone?: KeywordTone}[] = [];
  pages.forEach((p, pi) => {
    for (const raw of p.split(/\s+/).filter(Boolean)) {
      const keyword = raw.includes('*');
      const text = raw
        .replace(/\*/g, '')
        .replace(/^"/, '\u201C')
        .replace(/"/g, '\u201D')
        .replace(/'/g, '\u2019');
      const key = text.toLowerCase().replace(/\u2019/g, "'").replace(/[^a-z']/g, '').replace(/'s$/, '').replace(/'$/, '');
      const only = s.id === 19 ? true : keyword || key === 'jesus';
      const tone = only ? s.tones[key] : undefined;
      out.push({text, page: pi, keyword, tone});
    }
  });
  return out;
};
