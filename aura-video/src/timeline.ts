// All timing is derived from the beat grid of public/music.mp3.
// The video starts at the song's beat at 63.866s; B[i] is the video frame of beat i.
export const FPS = 30;
export const DURATION = 1350; // 45s
export const MUSIC_START_SEC = 63.86648526077097;

export const B = [
  0, 14, 29, 43, 59, 73, 87, 101, 116, 130, 145, 160, 173, 187, 202, 217, 232, 246, 261, 274, 288, 304, 319,
  334, 347, 363, 375, 390, 405, 420, 434, 449, 464, 478, 492, 507, 521, 536, 550, 565, 580, 594, 608, 623, 637,
  652, 666, 681, 696, 710, 724, 739, 753, 768, 782, 797, 811, 826, 840, 855, 869, 884, 898, 913, 927, 942, 956,
  971, 985, 1000, 1014, 1029, 1043, 1058, 1072, 1086, 1101, 1116, 1130, 1145, 1159, 1174, 1188, 1203, 1217,
  1232, 1246, 1260, 1275, 1289, 1304, 1318, 1333, 1348, 1362, 1376,
];
export const BEAT = 14.63; // frames per beat (~123 BPM)

/** Minute n starts on beat 4 + 8n (title takes the first 4 beats). The bass drop lands on minute 3. */
export const MIN_START = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((m) => B[4 + 8 * m]);
export const TITLE_END = B[4];
export const END_CARD = B[85];

export const minuteAt = (f: number) => {
  let m = -1;
  for (let i = 0; i < MIN_START.length; i++) if (f >= MIN_START[i]) m = i;
  return m; // -1 during title
};

export const AURA = [100, 200, 400, 800, 1600, 3200, 6400, 12800, Infinity];

export const HUD_TITLE = [
  'A SLEEPY NOBODY',
  "THE WIND'S FAVOURITE",
  "THE BULLY'S WHOLE AURA",
  'A SPORTS LEGEND',
  'A MOVIE POSTER',
  'BREAKING NEWS',
  'A SOLAR ECLIPSE',
  'TOO MUCH FOR ONE KID',
  'A NORSE MYTH',
];

export type Rank = {label: string; bg: string; fg: string};
const SIDE: Rank = {label: 'SIDE CHARACTER', bg: '#f4f1ea', fg: '#17140f'};
const MAIN: Rank = {label: 'MAIN CHARACTER', bg: '#f6c445', fg: '#1d1606'};
const BOSS: Rank = {label: 'FINAL BOSS', bg: '#f59a2b', fg: '#1d1006'};
const GOD: Rank = {label: 'TRICKSTER GOD', bg: '#8b5cf6', fg: '#ffffff'};
export const RANK: Rank[] = [SIDE, SIDE, SIDE, MAIN, MAIN, BOSS, BOSS, BOSS, GOD];

export const CAPTION = [
  'Minute 0: 100 aura. Toothpaste on his shirt.',
  'Minute 1: 200 aura. The wind blows only on him.',
  'Minute 2: 400 aura. The bully loses his cap.',
  "Minute 3: 800 aura. He didn't even look.",
  'Minute 4: 1,600 aura. The bus stops for him.',
  "Minute 5: 3,200 aura. He's on the news.",
  'Minute 6: 6,400 aura. His shadow is bigger than the school.',
  "Minute 7: 12,800 aura. His body can't hold it.",
  'Minute 8: ∞ aura. The trickster is awake.',
];

/** Shouts: big bold white words. Each entry shows `text` from `from` until `to`. `hl` words are yellow. */
export type Shout = {from: number; to: number; text: string; hl?: string[]; size?: number; y?: number};
export const SHOUTS: Shout[] = [
  {from: B[8], to: B[9], text: 'LATE', y: 1460},
  {from: B[9], to: B[12], text: 'LATE AGAIN.', hl: ['AGAIN.'], y: 1460},
  {from: B[24], to: B[25], text: "WHO'S"},
  {from: B[25], to: B[28], text: "WHO'S THAT?", hl: ['THAT?']},
  {from: B[48], to: B[51] + 6, text: 'ACCELERATE.', hl: ['ACCELERATE.']},
  {from: B[62], to: B[63], text: 'I'},
  {from: B[63], to: B[64], text: "I CAN'T..."},
  {from: B[64], to: B[65], text: 'MY'},
  {from: B[65], to: B[67], text: 'MY BODY...'},
  {from: B[78], to: B[80], text: 'SNAP.'},
];

/** -200 AURA floaters. `who` names the actor whose head they rise from. */
export type Floater = {from: number; shot: string; who: string; text?: string};
export const FLOATERS: Floater[] = [
  {from: B[14], shot: 'm1a', who: 'npc0'},
  {from: B[22] + 4, shot: 'm2a', who: 'bully'},
  {from: B[30] + 6, shot: 'm3a', who: 'npc1'},
  {from: B[31] + 4, shot: 'm3a', who: 'npc2'},
];

/** White flash + camera shake moments (scenes 5, 7, 8) */
export const FLASHES = [MIN_START[5], MIN_START[7], MIN_START[8]];
export const SWITCH_FLASH = B[67]; // white flash, then inverted SWITCH! frame
export const SWITCH_INVERT_FROM = B[67] + 5;

/** Audio cues (frame the clip should START at, so the spoken word lands on the beat). */
export const SFX = [
  {src: 'sfx/late_again.mp3', at: B[8] - 7, vol: 1.0},
  {src: 'sfx/whos_that.mp3', at: B[24] - 6, vol: 1.0},
  {src: 'sfx/accelerate.mp3', at: B[48] - 5, vol: 1.0},
  {src: 'sfx/bell.mp3', at: B[56] + 3, vol: 0.55},
  {src: 'sfx/boom.mp3', at: MIN_START[5], vol: 0.8},
  {src: 'sfx/boom.mp3', at: MIN_START[7], vol: 0.9},
  {src: 'sfx/boom.mp3', at: MIN_START[8], vol: 1.0},
  {src: 'sfx/boom.mp3', at: SWITCH_FLASH, vol: 0.7},
  {src: 'sfx/snap.mp3', at: B[78], vol: 1.0},
];

/** Shot list: every cut is on a beat. */
export type ShotId =
  | 'title'
  | 'm0a'
  | 'm0b'
  | 'm1a'
  | 'm1b'
  | 'm2a'
  | 'm2b'
  | 'm3a'
  | 'm3b'
  | 'm4a'
  | 'm4b'
  | 'm5a'
  | 'm5b'
  | 'm6a'
  | 'm6b'
  | 'm7a'
  | 'm7b'
  | 'm7c'
  | 'm8a'
  | 'm8b'
  | 'm8c'
  | 'm8d'
  | 'm8e'
  | 'm8f'
  | 'end';

export const SHOTS: {id: ShotId; from: number; to: number}[] = [
  {id: 'title', from: 0, to: B[4]},
  {id: 'm0a', from: B[4], to: B[8]},
  {id: 'm0b', from: B[8], to: B[12]},
  {id: 'm1a', from: B[12], to: B[16]},
  {id: 'm1b', from: B[16], to: B[20]},
  {id: 'm2a', from: B[20], to: B[24]},
  {id: 'm2b', from: B[24], to: B[28]},
  {id: 'm3a', from: B[28], to: B[32]},
  {id: 'm3b', from: B[32], to: B[36]},
  {id: 'm4a', from: B[36], to: B[40]},
  {id: 'm4b', from: B[40], to: B[44]},
  {id: 'm5a', from: B[44], to: B[48]},
  {id: 'm5b', from: B[48], to: B[52]},
  {id: 'm6a', from: B[52], to: B[56]},
  {id: 'm6b', from: B[56], to: B[60]},
  {id: 'm7a', from: B[60], to: B[62]},
  {id: 'm7b', from: B[62], to: B[67]},
  {id: 'm7c', from: B[67], to: B[68]},
  {id: 'm8a', from: B[68], to: B[72]},
  {id: 'm8b', from: B[72], to: B[74]},
  {id: 'm8c', from: B[74], to: B[76]},
  {id: 'm8d', from: B[76], to: B[78]},
  {id: 'm8e', from: B[78], to: B[80]},
  {id: 'm8f', from: B[80], to: B[85]},
  {id: 'end', from: B[85], to: DURATION},
];

export const shotAt = (f: number) => {
  for (const s of SHOTS) if (f >= s.from && f < s.to) return s;
  return SHOTS[SHOTS.length - 1];
};
