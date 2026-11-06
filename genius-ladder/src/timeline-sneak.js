// =============================================================================
//  "SNEAK IN" — pregnant, homeless, and dumped by your rich husband.
//  Same timeline format as timeline.js (see the header there). Beat lengths
//  follow the pauses in assets/sneak_in.mp3 so each line lands on its beat.
//
//  Set: mansion wall at z=0, balcony + bedroom door up the stairs (x 4..7),
//  pool x∈[1.0,4.6] z∈[3.4,5.6], side gate with doggy door at x=8.5, z=4.5.
// =============================================================================
import { CONFIG } from './config.js';

export const SET = { pool: [1.0, 4.6, 3.4, 5.6], gate: [8.5, 4.5], stairs: true };

export const CAST = {
  you: { ...CONFIG.you },
  husband: { skin: '#d9a07a', shirt: '#262a3d', pants: '#262a3d', hair: '#161616', shoes: '#0e0e0e', tie: '#c8202f' },
  yoga: { skin: '#f0b48a', shirt: '#e0559f', pants: '#7b3fbf', hair: '#f2cf5b', bun: true, shoes: '#f4f4f4', brow: '#a98235' },
};

const water = ['#ffffff', '#bfe9ff', '#5cc6ff', '#2aa7e6'];
const greens = [CONFIG.palette.grass, CONFIG.palette.grassDark, CONFIG.palette.grassLight];

// alternate two poses every `step` seconds (kicks, rubbing, waving...)
function alt(t0, t1, step, a, b, extra = {}) {
  const out = [];
  for (let t = t0, i = 0; t <= t1 + 1e-6; t += step, i++) out.push({ t: +t.toFixed(3), pose: i % 2 ? b : a, e: 'snap', ...extra });
  return out;
}
// sneaking steps moving along x
function tiptoe(t0, t1, x0, x1, steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    out.push({ t: +(t0 + (t1 - t0) * u).toFixed(3), x: x0 + (x1 - x0) * u, pose: i % 2 ? 'sneakB' : 'sneak', e: 'snap' });
  }
  return out;
}

export const TIMELINE = [
  // 1 ------------------------------------------------------------------------
  {
    id: 'dumped',
    dur: 6.1,
    vo: [{ at: 0, text: "You're pregnant, homeless, and your rich husband just left you for his yoga instructor.", caps: ["YOU'RE PREGNANT,", 'HOMELESS, AND', 'YOUR RICH HUSBAND', 'JUST LEFT YOU', 'FOR HIS YOGA', 'INSTRUCTOR.'] }],
    shots: [
      { at: 0, cam: { pos: [6.4, 1.4, 10.4], look: [2.4, 2.2, 2.4], fov: 58 }, push: 0.08 },
      { at: 1.55, cam: { pos: [0.3, -0.1, 0.95], look: [0, -0.3, 0], fov: 44 }, push: 0.12, track: { actor: 'you', part: 'head' } },
      { at: 3.1, cam: { pos: [3.9, 2.7, 4.3], look: [2.3, 3.75, 0.7], fov: 44 }, push: 0.1 },
      { at: 4.7, cam: { pos: [2.5, 1.3, 9.0], look: [2.0, 2.9, 1.0], fov: 46 }, push: 0.1 },
    ],
    keys: {
      friend: [{ t: 0, vis: false }],
      dog: [{ t: 0, vis: false }],
      you: [
        { t: 0, vis: true, x: 1.6, y: 0, z: 6.9, ry: 180, rx: 0, sq: 1, belly: 1, pose: 'bellyHold', face: 'sad', hold: null, walkAmp: 0, waddle: 0 },
        { t: 1.55, ry: 0, e: 'step' },
        { t: 2.4, pose: 'bellyHold', j: { neckX: -6, neckZ: 8 }, e: 'snap' },
        { t: 4.7, ry: 180, pose: 'lookUp', face: 'sad', e: 'step' },
      ],
      husband: [
        { t: 0, vis: true, x: 2.75, y: 3.0, z: 0.75, ry: 18, pose: 'wave', face: 'smug', pockets: false, hold: null },
        ...alt(3.1, 4.7, 0.22, 'wave', 'wave2'),
      ],
      yoga: [{ t: 0, vis: true, x: 1.85, y: 3.0, z: 0.7, ry: 8, pose: 'tree', face: 'happy', hold: null }],
    },
  },

  // 2 ------------------------------------------------------------------------
  {
    id: 'sneak',
    dur: 3.89,
    vo: [{ at: 0, text: 'So you sneak into his mansion to get child support like a semi-genius.', caps: ['SO YOU SNEAK', 'INTO HIS MANSION', 'TO GET CHILD', 'SUPPORT LIKE A', 'SEMI-GENIUS.'] }],
    shots: [
      { at: 0, cam: { pos: [12.9, 1.25, 6.6], look: [9.6, 0.75, 4.4], fov: 50 }, push: 0.08 },
      { at: 2.0, cam: { pos: [0.72, 0.0, 0.38], look: [0, -0.08, 0], fov: 40 }, push: 0.1, track: { actor: 'you', part: 'head' } },
    ],
    keys: {
      husband: [{ t: 0, vis: false }],
      yoga: [{ t: 0, vis: false }],
      you: [
        { t: 0, x: 12.0, y: 0, z: 4.45, ry: -90, rx: 0, face: 'focus', belly: 1, hold: null },
        ...tiptoe(0, 1.95, 12.0, 9.6, 7),
        { t: 2.0, x: 9.55, ry: 55, pose: 'proud', face: 'proud', e: 'step' },
        { t: 3.2, pose: 'proud', j: { neckX: -18, spine: -12 }, e: 'inOut' },
      ],
    },
  },

  // 3 ------------------------------------------------------------------------
  {
    id: 'stuck',
    dur: 3.08,
    vo: [{ at: 0, text: 'But your fat pregnant belly gets stuck in the doggy door.', caps: ['BUT YOUR FAT', 'PREGNANT BELLY', 'GETS STUCK IN', 'THE DOGGY DOOR.'] }],
    shots: [
      { at: 0, cam: { pos: [10.5, 0.95, 5.7], look: [8.7, 0.38, 4.5], fov: 46 }, push: 0.1 },
      { at: 1.45, cam: { pos: [6.95, 0.6, 4.95], look: [8.2, 0.45, 4.5], fov: 40 }, push: 0.12 },
    ],
    sfx: [
      { at: 0.3, word: 'SQUEEZE!', sound: 'squeak', color: 'lime', tilt: -7, pos: [0.5, 0.3] },
      { at: 1.6, sound: 'squeak', gain: 0.6 },
    ],
    impacts: [{ at: 0.3, freeze: 0, shake: 0.25, amp: 0.04 }],
    keys: {
      you: [
        { t: 0, x: 8.78, y: 0, z: 4.5, ry: -90, rx: 0, belly: 1.05, pose: 'crawl', face: 'strain', hold: null },
        ...alt(0.2, 2.95, 0.18, 'crawlKickA', 'crawlKickB'),
        { t: 1.45, face: 'strain' },
        { t: 2.2, face: 'sad', e: 'step' },
      ],
    },
  },

  // 4 ------------------------------------------------------------------------
  {
    id: 'butter',
    dur: 3.54,
    vo: [{ at: 0, text: 'So you rub butter all over yourself and slide right through.', caps: ['SO YOU RUB', 'BUTTER ALL', 'OVER YOURSELF', 'AND SLIDE', 'RIGHT THROUGH.'] }],
    shots: [
      { at: 0, cam: { pos: [11.7, 1.55, 5.9], look: [9.7, 1.3, 4.7], fov: 46 }, push: 0.1 },
      { at: 1.75, cam: { pos: [5.6, 0.85, 6.4], look: [7.8, 0.35, 4.5], fov: 50 }, push: 0.08 },
    ],
    sfx: [
      { at: 0.4, word: 'SQUISH!', sound: 'squish', color: 'yellow', tilt: 7, pos: [0.38, 0.32] },
      { at: 1.0, sound: 'squish', gain: 0.6 },
      { at: 2.05, word: 'SHLOOOP!', sound: 'whoosh', color: 'lime', tilt: -6, pos: [0.55, 0.32] },
    ],
    keys: {
      you: [
        { t: 0, x: 9.7, y: 0, z: 4.7, ry: 60, rx: 0, belly: 1, pose: 'rubA', face: 'focus', hold: 'butter' },
        ...alt(0.15, 1.65, 0.2, 'rubA', 'rubB'),
        { t: 1.75, x: 8.95, y: 0, z: 4.5, ry: -90, rx: 0, pose: 'crawl', face: 'strain', hold: null, e: 'step' },
        { t: 2.05, x: 9.9, y: 0.16, rx: 90, pose: 'superman', face: 'smug', e: 'step' },
        { t: 3.54, x: 7.9, e: 'linear' },
      ],
    },
  },

  // 5 ------------------------------------------------------------------------
  {
    id: 'genius1',
    dur: 1.72,
    vo: [{ at: 0, text: 'Genius as fuck.', caps: ['GENIUS', 'AS FUCK.'] }],
    shots: [{ at: 0, cam: { pos: [4.9, 0.42, 4.95], look: [6.1, 0.22, 4.5], fov: 42 }, to: { pos: [4.4, 0.42, 4.95], look: [5.3, 0.22, 4.5], e: 'linear' }, push: 0 }],
    keys: {
      you: [
        { t: 0, x: 7.9, y: 0.16, z: 4.5, ry: -90, rx: 90, pose: 'superman', j: { neckX: -80 }, face: 'smug', belly: 1 },
        { t: 1.72, x: 7.0, e: 'linear' },
      ],
    },
  },

  // 6 ------------------------------------------------------------------------
  {
    id: 'pool',
    dur: 3.78,
    vo: [{ at: 0, text: 'Except you slide so fast you shoot straight into the fucking pool.', caps: ['EXCEPT YOU SLIDE', 'SO FAST YOU', 'SHOOT STRAIGHT', 'INTO THE', 'FUCKING POOL.'] }],
    shots: [
      { at: 0, cam: { pos: [7.4, 0.8, 6.5], look: [6.3, 0.3, 4.5], fov: 46 }, to: { pos: [6.5, 0.8, 6.5], look: [5.4, 0.3, 4.5], e: 'linear' }, push: 0 },
      { at: 1.7, cam: { pos: [2.9, 1.7, 9.8], look: [3.8, 0.4, 4.5], fov: 48 }, push: 0.08 },
    ],
    sfx: [{ at: 2.85, word: 'SPLOOSH!', sound: 'sploosh', color: 'yellow', tilt: -6, world: [3.4, 0.7, 4.5], size: 150, dur: 1.0 }],
    impacts: [{ at: 2.85, freeze: 4, shake: 0.5, amp: 0.13 }],
    bursts: [{ at: 2.85, pos: [3.5, 0.1, 4.5], n: 48, colors: water, speed: 2.3, up: 4.2, size: 0.08, life: 1.3 }],
    keys: {
      you: [
        { t: 0, x: 8.2, y: 0.16, z: 4.5, ry: -90, rx: 90, pose: 'superman', j: { neckX: -80 }, face: 'shock', belly: 1, sq: 1 },
        { t: 1.7, x: 7.3, e: 'linear' },
        { t: 1.7, x: 7.0, e: 'step' },
        { t: 2.4, x: 6.35, e: 'linear' },
        { t: 2.62, x: 5.6, y: 0.75, rx: 70, pose: 'flail', e: 'out' },
        { t: 2.85, x: 5.0, y: -0.3, rx: 95, e: 'in' },
        { t: 3.25, x: 2.6, y: -0.12, rx: -90, pose: 'floatBack', face: 'blank', e: 'step' },
      ],
    },
  },

  // 7 ------------------------------------------------------------------------
  {
    id: 'waddle',
    dur: 2.58,
    vo: [{ at: 0, text: 'So you climb out and waddle up to his bedroom.', caps: ['SO YOU CLIMB OUT', 'AND WADDLE UP', 'TO HIS BEDROOM.'] }],
    shots: [
      { at: 0, cam: { pos: [3.3, 0.85, 6.1], look: [3.4, 0.0, 4.5], fov: 44 }, push: 0.1 },
      { at: 1.05, cam: { pos: [8.2, 1.35, 4.9], look: [5.6, 1.7, 0.6], fov: 52 }, push: 0.08 },
    ],
    sfx: [{ at: 0.55, sound: 'sploosh', gain: 0.3 }],
    keys: {
      you: [
        { t: 0, x: 2.6, y: -0.12, z: 4.5, ry: -90, rx: -90, pose: 'floatBack', face: 'blank', belly: 1, walkAmp: 0, waddle: 0 },
        { t: 0.55, x: 2.6, y: -0.12, rx: -90 },
        { t: 0.75, x: 3.6, y: 0.45, z: 5.9, ry: 0, rx: 0, pose: 'hop', face: 'focus', e: 'out' },
        { t: 0.95, y: 0.08, z: 6.05, pose: 'stand', e: 'in' },
        { t: 1.05, x: 7.3, y: 0, z: 0.6, ry: -90, pose: 'stand', walk: 0, walkAmp: 1, waddle: 9, e: 'step' },
        { t: 1.2, x: 6.85, y: 0.3, walk: 0.4, e: 'linear' },
        { t: 2.58, x: 4.45, y: 2.72, walk: 4.6, e: 'linear' },
      ],
    },
  },

  // 8 ------------------------------------------------------------------------
  {
    id: 'dog',
    dur: 2.91,
    vo: [{ at: 0, text: 'Then his fucking dog chases you down the stairs.', caps: ['THEN HIS', 'FUCKING DOG', 'CHASES YOU', 'DOWN THE STAIRS.'] }],
    shots: [
      { at: 0, cam: { pos: [5.4, 3.95, 3.4], look: [3.0, 3.45, 0.6], fov: 48 }, push: 0.1 },
      { at: 1.15, cam: { pos: [8.1, 1.6, 6.8], look: [5.6, 1.3, 0.9], fov: 56 }, push: 0.08 },
    ],
    sfx: [
      { at: 0.3, word: 'WOOF!', sound: 'woof', color: 'yellow', tilt: -8, pos: [0.35, 0.3] },
      { at: 0.62, word: 'WOOF!', sound: 'woof', color: 'lime', tilt: 7, pos: [0.62, 0.38] },
      { at: 1.6, sound: 'woof', gain: 0.6 },
      { at: 2.42, sound: 'thud' },
    ],
    impacts: [{ at: 2.42, freeze: 4, shake: 0.45, amp: 0.12 }],
    bursts: [{ at: 2.42, pos: [7.5, 0.1, 2.6], n: 24, colors: greens, speed: 1.6, up: 2.2, size: 0.05 }],
    keys: {
      you: [
        { t: 0, x: 3.95, y: 3.0, z: 0.75, ry: -90, rx: 0, sq: 1, pose: 'stand', face: 'focus', belly: 1, walk: 0, walkAmp: 1, waddle: 9 },
        { t: 0.3, x: 3.6, walk: 1, e: 'linear' },
        { t: 0.34, pose: 'shock', face: 'shock', walkAmp: 0, waddle: 0, e: 'snap' },
        { t: 0.8, ry: 90, pose: 'run', e: 'snap' },
        { t: 1.15, x: 4.2, y: 3.0, z: 0.6, ry: 90, pose: 'run', face: 'shock', walk: 0, walkAmp: 1.3, e: 'step' },
        { t: 2.0, x: 7.1, y: 0.15, walk: 5, e: 'linear' },
        { t: 2.16, x: 7.5, y: 0, z: 1.0, ry: 0, pose: 'flail', walkAmp: 0, e: 'snap' },
        { t: 2.42, x: 7.5, y: 0.16, z: 1.3, rx: 90, pose: 'faceplant', face: 'dazed', e: 'in' },
        { t: 2.42, sq: 0.62, e: 'step' },
        { t: 2.56, sq: 0.62 },
        { t: 2.75, sq: 1, e: 'out' },
      ],
      dog: [
        { t: 0, vis: true, x: 2.0, y: 3.0, z: 0.45, ry: 90, walk: 0, walkAmp: 1, wag: 0, tongue: true, leg: 0, pee: 0, puddle: 0, headY: 0 },
        { t: 0.25, x: 2.0 },
        { t: 0.9, x: 3.0, walk: 3, wag: 6, e: 'linear' },
        { t: 1.15, x: 3.2, y: 3.0, z: 0.6, walk: 0, e: 'step' },
        { t: 2.1, x: 6.6, y: 0.35, walk: 9, wag: 14, e: 'linear' },
        { t: 2.5, x: 7.15, y: 0, z: 1.0, walk: 11, wag: 18, e: 'linear' },
        { t: 2.6, walkAmp: 0, e: 'snap' },
      ],
    },
  },

  // 9 ------------------------------------------------------------------------
  {
    id: 'find',
    dur: 1.73,
    vo: [{ at: 0, text: 'You finally find your husband...', caps: ['YOU FINALLY FIND', 'YOUR HUSBAND...'] }],
    shots: [{ at: 0, cam: { pos: [7.62, 0.38, 2.75], look: [7.5, 1.75, 3.75], fov: 50 }, push: 0.25 }],
    keys: {
      you: [{ t: 0, x: 7.5, y: 0.16, z: 1.3, ry: 0, rx: 90, sq: 1, pose: 'faceplant', j: { neckY: 0, neckX: -60 }, face: 'sad' }],
      husband: [{ t: 0, vis: true, x: 7.5, y: 0, z: 3.75, ry: 180, pose: 'stand', j: { neckX: 30 }, face: 'blank', pockets: false, hold: null }],
      dog: [{ t: 0, vis: true, x: 8.05, y: 0, z: 3.3, ry: -150, walkAmp: 0, wag: 0 }, { t: 1.73, wag: 4, e: 'linear' }],
    },
  },

  // 10 -----------------------------------------------------------------------
  {
    id: 'broke',
    dur: 3.63,
    vo: [{ at: 0, text: "And he's broke too, because the yoga instructor owns the mansion.", caps: ["AND HE'S BROKE TOO,", 'BECAUSE THE', 'YOGA INSTRUCTOR', 'OWNS THE MANSION.'] }],
    shots: [
      { at: 0, cam: { pos: [6.5, 1.35, 1.9], look: [7.5, 1.25, 3.75], fov: 42 }, push: 0.1 },
      { at: 1.85, cam: { pos: [4.4, 1.6, 4.6], look: [2.5, 3.85, 0.9], fov: 44 }, push: 0.1 },
    ],
    sfx: [{ at: 2.0, sound: 'jingle', gain: 0.7 }],
    keys: {
      husband: [
        { t: 0, pose: 'stand', face: 'sad' },
        { t: 0.35, pose: 'pocketsOut', pockets: true, e: 'snap' },
        { t: 1.0, pose: 'shrug', e: 'snap' },
      ],
      yoga: [
        { t: 0, vis: true, x: 2.4, y: 3.0, z: 1.0, ry: 25, pose: 'tree', face: 'smug', hold: null },
        { t: 1.85, pose: 'keysUp', hold: 'keys', e: 'step' },
        { t: 2.3, pose: 'keysUp', j: { shRz: 35, elR: 70 }, e: 'snap' },
        { t: 2.7, pose: 'keysUp', e: 'snap' },
        { t: 3.1, pose: 'keysUp', j: { shRz: 35, elR: 70 }, e: 'snap' },
      ],
    },
  },

  // 11 -----------------------------------------------------------------------
  {
    id: 'poolboy',
    dur: 1.66,
    vo: [{ at: 0, text: "Now you're the pool boy.", caps: ["NOW YOU'RE", 'THE POOL BOY.'] }],
    shots: [{ at: 0, cam: { pos: [2.92, 1.55, 2.8], look: [2.92, 1.25, 6.1], fov: 50 }, push: 0.1 }],
    keys: {
      dog: [{ t: 0, vis: false }],
      yoga: [{ t: 0, vis: false }],
      you: [
        { t: 0, x: 2.3, y: 0.08, z: 6.15, ry: 180, rx: 0, sq: 1, belly: 1, pose: 'skim', hold: 'net', face: 'blank', walkAmp: 0, waddle: 0 },
        ...alt(0.3, 1.6, 0.4, 'skim', 'skim', {}),
        { t: 0.7, pose: 'skim', j: { shLx: 50, shRx: 62 }, e: 'inOut' },
        { t: 1.2, pose: 'skim', e: 'inOut' },
      ],
      husband: [
        { t: 0, x: 3.55, y: 0.08, z: 6.15, ry: 180, pose: 'skim', hold: 'net', face: 'sad', pockets: false },
        { t: 0.5, pose: 'skim', j: { shLx: 50, shRx: 62 }, e: 'inOut' },
        { t: 1.0, pose: 'skim', e: 'inOut' },
      ],
    },
  },

  // 12 -----------------------------------------------------------------------
  {
    id: 'genius',
    dur: 2.2,
    captionStyle: 'huge',
    vo: [{ at: 0, text: 'Fucking genius.', caps: ['FUCKING GENIUS.'] }],
    shots: [{ at: 0, cam: { pos: [2.9, 1.32, 6.8], look: [2.9, 1.52, 8.0], fov: 40 }, push: 0.12 }],
    sfx: [{ at: 0, sound: 'boom', gain: 0.55 }],
    keys: {
      husband: [{ t: 0, vis: false }],
      you: [{ t: 0, x: 2.9, y: 0, z: 8.0, ry: 180, rx: 0, sq: 1, belly: 1, pose: 'crossArms', face: 'serious', hold: null }],
    },
  },
];
