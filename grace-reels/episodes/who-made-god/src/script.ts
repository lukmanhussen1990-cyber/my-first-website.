// Idea 121 · Who Made God? — narration source of truth.
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
  {id: 1, scene: 'S1', text: 'If God made everything… | then who made *God*?', tones: {god: 'red'}, pauseAfter: P},
  {id: 2, scene: 'S2', text: 'A lot of people think | this question ends the debate. | Watch this.', tones: {}, pauseAfter: 0.5},
  {id: 3, scene: 'S3', text: 'Everything you see had a *beginning*. | Your phone. Your house. You.', tones: {beginning: 'blue'}, pauseAfter: P},
  {id: 4, scene: 'S4', text: 'And everything that begins… | was *caused* by something.', tones: {caused: 'red'}, pauseAfter: P},
  {id: 5, scene: 'S5', text: "So let's go back. Who made you? | Your parents. Who made them? | Keep going… *back*.", tones: {back: 'blue'}, pauseAfter: P},
  {id: 6, scene: 'S6', text: 'Past the Earth. Past the sun. | Past the *stars*.', tones: {stars: 'blue'}, pauseAfter: P},
  {id: 7, scene: 'S7', text: 'But if every maker needed a maker, forever… | nothing would ever *start*.', tones: {start: 'red'}, pauseAfter: 0.6},
  {id: 8, scene: 'S8', text: 'So at the very start, | there has to be Someone who was never *made*. | Someone who never *began*.', tones: {made: 'gold', began: 'gold'}, pauseAfter: P},
  {id: 9, scene: 'S9', text: 'And that’s exactly how the Bible describes God: | "From everlasting to everlasting, | thou art *God*."', tones: {god: 'gold'}, pauseAfter: P},
  {id: 10, scene: 'S10', text: 'When Moses asked God His name, | God said: "I AM THAT I *AM*."', tones: {am: 'gold'}, pauseAfter: 0.7},
  {id: 11, scene: 'S11', text: 'Not "I was made." Not "I began." | Just… I *AM*.', tones: {am: 'gold'}, pauseAfter: 0.8},
  {id: 12, scene: 'S12', text: 'But notice. | Asking "who made God" is like a painting | asking who painted the *painter*.', tones: {painter: 'gold'}, pauseAfter: P},
  {id: 13, scene: 'S13', text: 'If someone made Him… | He wouldn’t be *God*.', tones: {god: 'gold'}, pauseAfter: 0.6},
  {id: 14, scene: 'S14', text: 'And Jesus said: | "I am Alpha and Omega, | the beginning and the *end*." | The A and the Z.', tones: {end: 'gold'}, pauseAfter: P},
  {id: 15, scene: 'S15', text: 'Then the One who was never made… | was *born*. | "The Word was made flesh."', tones: {born: 'gold'}, pauseAfter: P},
  {id: 16, scene: 'S16', text: 'The Maker became a man… | so you could *know* Him.', tones: {know: 'gold'}, pauseAfter: 0.6},
  {id: 17, scene: 'S17', text: 'So who made God? No one. | He made *you*.', tones: {you: 'green'}, pauseAfter: 0.6},
  {id: 18, scene: 'S18', text: 'Did this answer it for you? | Yes or no.', tones: {}, pauseAfter: 0},
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
      const key = text.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9']/g, '').replace(/'s$/, '').replace(/'$/, '');
      out.push({text, page: pi, keyword, tone: keyword ? s.tones[key] : undefined});
    }
  });
  return out;
};
