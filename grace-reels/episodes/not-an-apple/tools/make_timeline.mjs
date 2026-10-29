// Merges the script table, the voice layout and the aligned words into
// src/data/timeline.json (every word, keyword flag, line, block and scene) and
// src/data/cues.json (the moments that animation and sound effects both hit).
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const FPS = 30;

const segments = read('src/data/segments.json');
const layout = read('src/data/voice_layout.json');
const aligned = read('src/data/words_aligned.json');

// script line (1-18) for each segment
const LINES = [[0], [1, 2, 3], [4, 5], [6, 7, 8, 9], [10, 11, 12, 13], [14, 15], [16, 17], [18, 19], [20, 21],
  [22, 23, 24, 25], [26, 27, 28, 29, 30], [31, 32, 33, 34, 35], [36], [37, 38, 39], [40, 41, 42], [43, 44],
  [45, 46, 47], [48, 49, 50]];
const lineOf = {};
LINES.forEach((ids, i) => ids.forEach((id) => (lineOf[id] = i + 1)));

const words = [];
for (const seg of segments) {
  const tokens = seg.display.split(' ');
  const timed = aligned.filter((w) => w.seg === seg.id);
  if (timed.length !== tokens.length) throw new Error(`token mismatch in segment ${seg.id}`);
  tokens.forEach((tok, k) => {
    const kw = /\*/.test(tok);
    words.push({
      i: words.length,
      text: tok.replace(/\*/g, ''),
      kw,
      start: timed[k].start,
      end: timed[k].end,
      seg: seg.id,
      line: lineOf[seg.id],
      block: seg.block,
      scene: seg.scene,
    });
  });
}

const seg = (id) => layout.segments.find((s) => s.id === id);
const wordAt = (segId, k) => words.filter((w) => w.seg === segId)[k];
const find = (segId, text) => {
  const w = words.find((x) => x.seg === segId && x.text.toLowerCase().replace(/[^a-z']/g, '') === text);
  if (!w) throw new Error(`no word ${text} in segment ${segId}`);
  return w;
};

// scenes cut 3 frames before their first spoken word
const LEAD = 3 / FPS;
const sceneIds = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15'];
const scenes = sceneIds.map((id) => {
  const first = segments.find((s) => s.scene === id);
  return {id, start: id === 'S1' ? 0 : seg(first.id).speechStart - LEAD};
});
const lastSpeechEnd = seg(50).speechEnd;
scenes.push({id: 'S16', start: lastSpeechEnd + 0.5});
const END = scenes[scenes.length - 1].start + 3.0;
scenes.forEach((s, i) => (s.end = i + 1 < scenes.length ? scenes[i + 1].start : END));

const blocks = [];
for (const w of words) {
  let b = blocks.find((x) => x.id === w.block);
  if (!b) blocks.push((b = {id: w.block, first: w.i, last: w.i, start: w.start, end: w.end}));
  b.last = w.i;
  b.end = w.end;
}

const cues = {
  xWindup: seg(1).speechStart,
  xSlam: find(2, 'never').start,
  panelIn: seg(3).speechStart,
  magnifierStart: seg(3).speechStart,
  fruitFound: find(4, 'fruit').start,
  cardGen36: seg(5).speechStart,
  paintStroke: find(7, 'paintings').start,
  malumRise: find(9, 'malum').start,
  malumSplit: find(9, 'apple').start,
  flipFig: find(10, 'fig').start,
  flipGrape: find(11, 'grape').start,
  flipWheat: find(12, 'wheat').start,
  lockedClunk: seg(13).speechStart,
  edenCrane: scenes[4].start,
  snakeSlide: seg(15).speechStart,
  snakeSaid: find(15, 'said').start,
  cardGen31: seg(17).speechStart,
  doubtHook: seg(18).speechStart,
  doubtWord: find(19, 'doubt').start,
  strip217: seg(20).speechStart,
  strip34: seg(22).speechStart,
  typeNot: find(23, 'not').start,
  slot1: find(25, 'not').start,
  butNotice: seg(26).speechStart,
  stripEat: seg(28).speechStart,
  typeTouch: find(30, 'touch').start,
  slot2: find(30, 'touch').start,
  tagNeverTouch: seg(31).speechStart,
  bothEdits: seg(32).speechStart,
  give: seg(34).speechStart,
  eat: find(35, 'ate').start,
  desert: scenes[10].start,
  jesusStands: seg(37).speechStart,
  stamp1: find(39, 'written').start,
  slot3: find(39, 'written').start,
  stamp2: find(40, 'three').start,
  stamp3: find(41, 'written').start,
  devilLeaves: find(42, 'left').start,
  phoneScroll: seg(43).speechStart,
  notifPing: seg(44).speechStart,
  snakeShadow: find(44, 'really').start,
  matchCut: scenes[13].start,
  appleBreak: find(45, 'fruit').start,
  whatDidGodSay: seg(47).speechStart,
  cta: seg(48).speechStart,
  tapYes: find(50, 'yes').start,
  typeComment: find(49, 'apple').start,
  endCard: scenes[15].start,
};

const timeline = {
  fps: FPS,
  durationSec: END,
  durationInFrames: Math.round(END * FPS),
  voice: {file: 'audio/voice.wav', tempo: layout.tempo},
  scenes,
  blocks,
  words,
  segments: segments.map((s) => ({id: s.id, line: lineOf[s.id], scene: s.scene, block: s.block,
    start: seg(s.id).speechStart, end: seg(s.id).speechEnd, display: s.display})),
};
writeFileSync(join(ROOT, 'src/data/timeline.json'), JSON.stringify(timeline, null, 1));
writeFileSync(join(ROOT, 'src/data/cues.json'), JSON.stringify(cues, null, 1));
console.log(`timeline: ${END.toFixed(2)} s (${timeline.durationInFrames} frames), ${words.length} words, ${blocks.length} caption blocks`);
for (const s of scenes) console.log(`${s.id.padEnd(4)} ${s.start.toFixed(2).padStart(6)} - ${s.end.toFixed(2).padStart(6)}  (${(s.end - s.start).toFixed(1)} s)`);
