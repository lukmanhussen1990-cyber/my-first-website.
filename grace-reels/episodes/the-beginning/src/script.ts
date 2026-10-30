// Idea 97 · The Priest Who Found the Beginning — narration source of truth.
// `*word*` marks a keyword (may span words), `|` marks a caption page break.
import type {KeywordTone} from '../../../src/kit-flat/palette';

export interface Sentence {
  id: number;
  scene: string;
  text: string;
  tones: Record<string, KeywordTone>;
  pauseAfter: number;
}

const P = 0.3;

export const SENTENCES: Sentence[] = [
  {id: 1, scene: 'S1', text: 'For years, many great scientists believed | the universe had no *beginning*. | It was just… always there.', tones: {beginning: 'red'}, pauseAfter: 0.5},
  {id: 2, scene: 'S2', text: 'Then a *priest* did the math.', tones: {priest: 'gold'}, pauseAfter: P},
  {id: 3, scene: 'S2', text: 'His name was Georges *Lemaître*. | A Catholic priest… and a physicist.', tones: {'lemaître': 'blue'}, pauseAfter: P},
  {id: 4, scene: 'S3', text: 'In 1927, he said | the universe is *expanding*.', tones: {expanding: 'blue'}, pauseAfter: P},
  {id: 5, scene: 'S4', text: "And if it's growing… rewind it. | Everything goes back to one tiny *point*.", tones: {point: 'blue'}, pauseAfter: P},
  {id: 6, scene: 'S4', text: 'A *beginning*.', tones: {beginning: 'gold'}, pauseAfter: 0.6},
  {id: 7, scene: 'S5', text: 'Even Einstein pushed back. | He reportedly told him: | "Your math is correct, | but your physics is *abominable*."', tones: {abominable: 'red'}, pauseAfter: P},
  {id: 8, scene: 'S6', text: 'Then in 1929, telescopes showed it. | The galaxies are moving *apart*.', tones: {apart: 'blue'}, pauseAfter: 0.8},
  {
    id: 9,
    scene: 'S7',
    text: 'But notice. | The famous name "*Big Bang*" | came from a scientist | who didn\'t believe in a beginning. | Fred Hoyle said it on the radio in 1949.',
    tones: {big: 'gold', bang: 'gold'},
    pauseAfter: P,
  },
  {id: 10, scene: 'S8', text: 'Then in 1965, two scientists | heard a strange hiss in their antenna. | They thought it was *pigeon* mess.', tones: {pigeon: 'blue'}, pauseAfter: 0.6},
  {id: 11, scene: 'S9', text: "It wasn't. | It was the *afterglow* of the beginning. | Still coming from every direction.", tones: {afterglow: 'gold'}, pauseAfter: P},
  {id: 12, scene: 'S10', text: 'Lemaître heard the news | shortly before he *died*.', tones: {died: 'red'}, pauseAfter: 0.6},
  {id: 13, scene: 'S11', text: 'He never said his math proves God. | But it showed what the Bible said | on page *one*.', tones: {one: 'gold'}, pauseAfter: P},
  {id: 14, scene: 'S11', text: '"In the beginning God created | the heaven and the *earth*."', tones: {earth: 'gold'}, pauseAfter: P},
  {id: 15, scene: 'S12', text: "Here's the simple question. | Everything that begins has a *cause*.", tones: {cause: 'green'}, pauseAfter: P},
  {id: 16, scene: 'S12', text: 'So if the universe began… | what caused *it*?', tones: {it: 'green'}, pauseAfter: 0.7},
  {id: 17, scene: 'S13', text: 'It had to be something | outside time, space and matter. | Powerful. Not made. *Eternal*.', tones: {eternal: 'gold'}, pauseAfter: P},
  {id: 18, scene: 'S14', text: 'The Bible says: | "The worlds were framed | by the *word* of God."', tones: {word: 'gold'}, pauseAfter: P},
  {id: 19, scene: 'S15', text: 'And it tells us who that Word is: | "All things were made by *him*."', tones: {him: 'gold'}, pauseAfter: 0.6},
  {id: 20, scene: 'S16', text: 'If the universe had a beginning… | who started it? | One word.', tones: {}, pauseAfter: 0},
];

export const sentenceWords = (s: Sentence) => {
  const pages = s.text.split('|').map((p) => p.trim());
  const out: {text: string; page: number; keyword: boolean; tone?: KeywordTone}[] = [];
  pages.forEach((p, pi) => {
    let open = false;
    for (const raw of p.split(/\s+/).filter(Boolean)) {
      if (raw.startsWith('*') || raw.startsWith('"*')) open = true;
      const keyword = open;
      if (raw.replace(/["”.,?:;…!]+$/, '').endsWith('*')) open = false;
      const text = raw.replace(/\*/g, '').replace(/^"/, '“').replace(/"/g, '”').replace(/'/g, '’');
      const key = text.toLowerCase().replace(/’/g, "'").replace(/[^a-zî0-9']/g, '').replace(/'s$/, '').replace(/'$/, '');
      out.push({text, page: pi, keyword, tone: keyword ? s.tones[key] : undefined});
    }
  });
  return out;
};
