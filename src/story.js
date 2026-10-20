// Single source of truth for the script. Shared by the Node pipeline and the browser renderer.
// Edit text here, then run `npm run build` — changed lines are re-voiced, unchanged ones come from the cache.

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const SCENE_PADDING = 0.4; // seconds after the last voice line of each scene
export const LINE_GAP = 0.3; // pause between two voice lines inside one scene

export const RED = '#D7263D';
export const WATERMARK = '@midnightcompile';

// speaker: 'narrator' | 'mom'.  fx: 'door' = muffled through the front door.
export const LINES = {
  L01: { speaker: 'narrator', text: 'Just a normal evening at home. Cartoons... popcorn... nothing to worry about.' },
  L02: { speaker: 'narrator', text: 'Mom is in the kitchen, making your favorite dinner. She always hums when she cooks.' },
  L03a: { speaker: 'narrator', text: 'Then your phone buzzes. A text... from Mom.' },
  L03b: { speaker: 'narrator', text: "Stuck in traffic... Running late... Don't open the door for anyone." },
  L05: { speaker: 'narrator', text: "The humming stops. The stirring stops. Now it's just the TV... and the clock." },
  L07: { speaker: 'mom', text: 'Who are you texting... sweetie?' },
  L07b: { speaker: 'narrator', text: 'She never turned around.' },
  // fallback: used only while this line cannot be generated (no API key / no credits):
  // door-Mom says "Sweetie?" cut from kitchen-Mom's own take, so both Moms still share one voice.
  L08: { speaker: 'mom', fx: 'door', text: "Honey, open the door. It's me.",
    fallback: { line: 'L07', from: 1.03, to: 1.72, text: 'Sweetie?' } },
  L09a: { speaker: 'mom', text: "Don't open it... That's not me." },
  L09b: { speaker: 'narrator', text: 'Both of them sound exactly like Mom.' },
  L10: { speaker: 'narrator', text: 'Open the door... or ask a secret only Mom knows? Comment A or B.' },
};

// caption.at: { line, word } -> pops in when that word (0-based index) of that line is spoken,
//             { time }       -> seconds after the scene starts.
// preroll: seconds of picture/sfx before the first voice line of the scene.
// Scenes without voice lines (4, 6, 11) use a fixed `duration`: they are caption + sound-design beats.
// To narrate them, add a line to LINES, list it in `lines`, and point the caption at a word.
// minDuration: lower bound for a voiced scene (scene 8 keeps a fixed slot for door-Mom's line).
export const SCENES = [
  { id: 1, key: 'normal', lines: ['L01'], preroll: 0.5,
    caption: { text: 'A NORMAL EVENING.', red: 'NORMAL', at: { line: 'L01', word: 0 } } },
  { id: 2, key: 'dinner', lines: ['L02'],
    caption: { text: 'MOM IS MAKING DINNER.', red: 'MOM', at: { line: 'L02', word: 0 } } },
  { id: 3, key: 'phone', lines: ['L03a', 'L03b'], preroll: 0.35 },
  { id: 4, key: 'who', lines: [], duration: 3.6,
    caption: { text: 'THEN WHO IS IN THE KITCHEN?', red: 'WHO', at: { time: 0.35 } } },
  { id: 5, key: 'humming', lines: ['L05'],
    caption: { text: 'THE HUMMING STOPS.', red: 'STOPS', at: { line: 'L05', word: 0 } } },
  { id: 6, key: 'shadow', lines: [], duration: 4.2, scare: { at: 1.35 },
    caption: { text: "HER SHADOW DOESN'T MOVE.", red: 'SHADOW', at: { time: 1.35 } } },
  { id: 7, key: 'texting', lines: ['L07', 'L07b'], preroll: 0.9, silenceBefore: 0.9,
    bubble: { line: 'L07', text: 'Who are you texting, sweetie?', speaker: 'mom' } },
  { id: 8, key: 'doorbell', lines: ['L08'], preroll: 1.7, minDuration: 4.5, scare: { at: 0 },
    caption: { text: 'DING. DONG.', red: 'DONG.', at: { time: 0.05 } },
    bubble: { line: 'L08', text: "Honey, open the door. It's me.", speaker: 'door' } },
  { id: 9, key: 'turn', lines: ['L09a', 'L09b'], preroll: 1.0, scare: { at: 0.85 },
    bubble: { line: 'L09a', text: "Don't open it. That's not me.", speaker: 'mom' },
    caption: { text: 'BOTH SOUND LIKE MOM.', red: 'BOTH', at: { line: 'L09b', word: 0 } } },
  { id: 10, key: 'choice', lines: ['L10'], choice: true },
  { id: 11, key: 'twist', lines: [], duration: 2.4, choice: true },
];

export const CHOICE = {
  title: 'WHAT WOULD YOU DO?',
  red: 'YOU',
  a: 'OPEN THE DOOR',
  b: 'ASK A SECRET ONLY MOM KNOWS',
};

export const PHONE = {
  sender: 'Mom',
  time: '8:12',
  ampm: 'PM',
  date: 'Friday, October 20',
  message: "Stuck in traffic. Running late. Don't open the door for anyone.",
};
