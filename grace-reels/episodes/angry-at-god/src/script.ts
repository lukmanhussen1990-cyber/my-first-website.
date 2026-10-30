// Idea 89 · Angry at God? — narration source of truth.
// `*word*` marks a keyword, `|` marks a caption page break.
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
  {id: 1, scene: 'S1', text: 'Is it a *sin* | to be angry at God?', tones: {sin: 'red'}, pauseAfter: P},
  {id: 2, scene: 'S2', text: "King David *yelled* at God… | and it's in the Bible.", tones: {yelled: 'red'}, pauseAfter: 0.5},
  {id: 3, scene: 'S3', text: '"How long wilt thou *forget* me, O LORD? | for ever?"', tones: {forget: 'red'}, pauseAfter: P},
  {id: 4, scene: 'S3', text: '"How long wilt thou *hide* | thy face from me?"', tones: {hide: 'red'}, pauseAfter: P},
  {id: 5, scene: 'S3', text: 'Four times in a row, he cried: | "How *long*?"', tones: {long: 'red'}, pauseAfter: P},
  {id: 6, scene: 'S4', text: "That's not a polite prayer. | That's an *honest* one.", tones: {honest: 'gold'}, pauseAfter: 0.6},
  {id: 7, scene: 'S5', text: 'Job lost almost *everything*.', tones: {everything: 'blue'}, pauseAfter: P},
  {id: 8, scene: 'S6', text: 'And he said: | "I will *complain* in the bitterness of my soul."', tones: {complain: 'red'}, pauseAfter: P},
  {id: 9, scene: 'S7', text: 'His friends gave him neat answers. | They said it must be his *fault*.', tones: {fault: 'red'}, pauseAfter: 0.8},
  {
    id: 10,
    scene: 'S8',
    text: 'But notice what God said at the end, | to the *friends*: | "Ye have not spoken of me | the thing that is *right*, | as my servant Job hath."',
    tones: {friends: 'green', right: 'gold'},
    pauseAfter: P,
  },
  {id: 11, scene: 'S8', text: 'God did correct Job. | But His anger burned against the friends… | not against the *honest* man.', tones: {honest: 'gold'}, pauseAfter: P},
  {id: 12, scene: 'S9', text: 'Even Jesus, on the cross, cried out: | "My God, my God, | *why* hast thou forsaken me?"', tones: {jesus: 'gold', why: 'blue'}, pauseAfter: P},
  {id: 13, scene: 'S10', text: "Those were David's words, | from *Psalm 22*.", tones: {psalm: 'gold', '22': 'gold'}, pauseAfter: 0.7},
  {id: 14, scene: 'S11', text: "So feeling angry isn't the sin. | The Bible says: | \"Be ye angry, and sin *not*.\"", tones: {not: 'gold'}, pauseAfter: P},
  {id: 15, scene: 'S12', text: 'The real danger is walking *away*. | Going silent. Shutting the door.', tones: {away: 'red'}, pauseAfter: 0.6},
  {id: 16, scene: 'S13', text: "Now look how David's angry prayer ends: | \"But I have *trusted* in thy mercy.\"", tones: {trusted: 'gold'}, pauseAfter: P},
  {id: 17, scene: 'S14', text: 'He started yelling… | and ended up *singing*: | "I will sing unto the LORD."', tones: {singing: 'gold'}, pauseAfter: P},
  {id: 18, scene: 'S15', text: "God can handle your anger. | He'd rather hear it… | than lose *you*.", tones: {you: 'green'}, pauseAfter: P},
  {id: 19, scene: 'S15', text: '"Pour out your *heart* before him."', tones: {heart: 'gold'}, pauseAfter: 0.6},
  {id: 20, scene: 'S16', text: 'Have you ever been angry at God? | Yes or no.', tones: {}, pauseAfter: 0},
];

export const sentenceWords = (s: Sentence) => {
  const pages = s.text.split('|').map((p) => p.trim());
  const out: {text: string; page: number; keyword: boolean; tone?: KeywordTone}[] = [];
  pages.forEach((p, pi) => {
    // "*Psalm 22*" spans two words: track open/close stars across words
    let open = false;
    for (const raw of p.split(/\s+/).filter(Boolean)) {
      const starts = raw.startsWith('*') || raw.startsWith('"*');
      if (starts) open = true;
      const keyword = open;
      if (raw.replace(/["”.,?:;…!]+$/, '').endsWith('*')) open = false;
      const text = raw.replace(/\*/g, '').replace(/^"/, '“').replace(/"/g, '”').replace(/'/g, '’');
      const key = text.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9']/g, '').replace(/'s$/, '').replace(/'$/, '');
      const tone = keyword || key === 'jesus' ? s.tones[key] : undefined;
      out.push({text, page: pi, keyword, tone});
    }
  });
  return out;
};
