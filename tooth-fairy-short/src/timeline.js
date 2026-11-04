// Timing sheet. All values come from tools/analyze_audio.py (energy-based
// segmentation + PocketSphinx forced alignment of assets/voiceover.mp3).
// Picture cuts sit 1-2 frames before each spoken onset; captions change on
// the same frame as the cut.
export const FPS = 30;
export const TOTAL_FRAMES = 900; // 30.0 s
// Speech ends at 28.43 s -> hold the final shot ~1 s -> cut to black.
export const BLACK_FRAME = 883; // 29.433 s

// Start frame of each of the 20 scenes, followed by the cut-to-black frame.
//            1   2   3    4    5    6    7    8    9   10   11   12   13   14   15   16   17   18   19   20  black
export const CUTS = [0, 49, 94, 149, 186, 222, 268, 315, 355, 393, 435, 481, 517, 572, 613, 663, 708, 751, 790, 826, BLACK_FRAME];

// Captions: one per scene. *word* marks the coral keyword. Officer dialogue
// is quoted, matching the reference style.
export const CAPTIONS = [
  'This man lost a *tooth.*',
  'He put it under his *pillow.*',
  'In the morning, there was *money.*',
  'Someone paid him.',
  'That was *bribery.*',
  'So he called the *police.*',
  'The officer looked at the money.',
  'Then at him.',
  '"Are you serious?"',
  '"That\'s the *Tooth* *Fairy."*',
  '"She buys teeth."',
  'That was *smuggling.*',
  'So the police set a *trap.*',
  'They caught her at midnight.',
  'The Tooth Fairy went to *jail.*',
  'But the man learned something.',
  'Teeth are *money.*',
  'He sold all of them.',
  "Now he's *rich.*",
  "He can't *eat.*",
];

// Word onsets (seconds) used for in-scene cues.
export const CUE = {
  tooth: 0.94,
  pillow: 2.52,
  morning: 3.34,
  money1: 4.33,
  paid: 5.38,
  bribery: 6.58,
  police: 8.23,
  money2: 10.0,
  him: 11.23,
  serious: 12.13,
  toothFairy: 13.53,
  teeth: 15.34,
  smuggling: 16.43,
  trap: 18.4,
  caught: 19.2,
  midnight: 19.8,
  jail: 21.52,
  something: 23.0,
  teeth2: 23.67,
  money3: 24.34,
  sold: 25.17,
  all: 25.53,
  them: 25.95,
  rich: 26.84,
  cant: 27.66,
  eat: 28.02,
  speechEnd: 28.43,
};

// Label cards drop so they land exactly on the spoken word.
export const CARDS = [
  { scene: 4, text: 'BRIBERY', land: CUE.bribery },
  { scene: 11, text: 'SMUGGLING', land: CUE.smuggling },
];

export function sceneAt(frame) {
  for (let i = CUTS.length - 2; i >= 0; i--) if (frame >= CUTS[i]) return i;
  return 0;
}
export const sceneStart = (i) => CUTS[i] / FPS;
export const sceneEnd = (i) => CUTS[i + 1] / FPS;
