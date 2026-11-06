// =============================================================================
//  "DOUBLES EVERY MINUTE" — same timeline format as timeline.js.
//  Kept non-sexual on purpose: nothing is ever shown, only cartoon "puffy pants"
//  (a tent with a flag, then a pants-fabric balloon) that grow absurdly large.
//  Beat lengths follow the pauses in assets/double.mp3 (20 spoken segments).
// =============================================================================
import { CONFIG } from './config.js';

export const SET = { road: 40, planet: [0, 46, 0], things: { button: 'button', tank: 'tank' } };

const olive = { shirt: '#55652c', pants: '#4a5726', hat: '#4a5726', shoes: '#2b2b2b' };
export const CAST = {
  you: { ...CONFIG.you },
  friend: { ...CONFIG.friend, brow: '#1d1209' }, // the neighbour
  doctor: { skin: '#e0a77c', shirt: '#f4f6f8', pants: '#8fb8de', hair: '#9a9a9a', shoes: '#333333', tie: '#3b7dd8' },
  soldier1: { skin: '#c88758', ...olive },
  soldier2: { skin: '#e8a57a', ...olive },
};

const GRAY = '#8d9096'; // dad's sweatpants
const BAG = '#2f8f4e'; // sleeping bag
const confetti = ['#ff4d6d', '#ffd21f', '#4fb3ff', '#7cfc4a', '#c77dff'];
const tick = (at = 0) => ({ at, sound: 'tick', gain: 0.8 });
const hidden = (...names) => Object.fromEntries(names.map((n) => [n, [{ t: 0, vis: false }]]));

function hops(t0, t1, x0, x1, n) {
  const out = [];
  for (let i = 0; i <= n * 2; i++) {
    const u = i / (n * 2);
    out.push({ t: +(t0 + (t1 - t0) * u).toFixed(3), x: x0 + (x1 - x0) * u, y: i % 2 ? 0.28 : 0, e: i % 2 ? 'out' : 'in' });
  }
  return out;
}

export const TIMELINE = [
  // 1 ------------------------------------------------------------------------
  {
    id: 'intro',
    dur: 3.17,
    vo: [{ at: 0, text: 'What if your dick doubled in size every minute?', caps: ['WHAT IF YOUR', 'DICK DOUBLED', 'IN SIZE EVERY', 'MINUTE?'] }],
    shots: [
      { at: 0, cam: { pos: [2.8, 1.5, 9.2], look: [1.0, 1.1, 4.0], fov: 50 }, push: 0.1 },
      { at: 1.55, cam: { pos: [0.32, 0.02, 0.88], look: [0, -0.08, 0], fov: 40 }, push: 0.12, track: { actor: 'you', part: 'head' } },
    ],
    keys: {
      ...hidden('friend', 'doctor', 'soldier1', 'soldier2', 'dog', 'button', 'tank'),
      you: [
        { t: 0, vis: true, x: 1.0, y: 0, z: 4.0, ry: 20, rx: 0, sq: 1, pose: 'stand', face: 'blank', tent: 0, puff: 0, puffOff: null, puffSq: 1, pants: null, hold: null, belly: 0, walkAmp: 0 },
        { t: 1.6, pose: 'stand', j: { neckX: 38 }, face: 'focus', e: 'snap' },
        { t: 2.5, pose: 'stand', j: { neckX: 4 }, face: 'blank', e: 'snap' },
      ],
    },
  },
  // 2 ------------------------------------------------------------------------
  {
    id: 'min1',
    dur: 2.41,
    vo: [
      { at: 0, text: 'Minute one,', caps: ['MINUTE ONE,'] },
      { at: 1.01, text: 'nobody notices.', caps: ['NOBODY NOTICES.'] },
    ],
    shots: [{ at: 0, cam: { pos: [1.55, 1.35, 8.0], look: [1.5, 1.05, 4.0], fov: 46 }, push: 0.1 }],
    sfx: [tick()],
    keys: {
      you: [{ t: 0, x: 1.0, z: 4.0, ry: 10, pose: 'stand', face: 'blank' }],
      friend: [
        { t: 0, vis: true, x: 2.0, y: 0, z: 4.15, ry: -10, rx: 0, pose: 'stand', face: 'bored', hold: 'phone', bino: false },
        { t: 1.2, pose: 'stand', j: { neckY: 30 }, e: 'snap' },
        { t: 1.8, pose: 'stand', e: 'snap' },
      ],
    },
  },
  // 3 ------------------------------------------------------------------------
  {
    id: 'tent',
    dur: 3.09,
    vo: [{ at: 0, text: 'Minute five, your jeans look like a camping tent.', caps: ['MINUTE FIVE,', 'YOUR JEANS LOOK', 'LIKE A CAMPING', 'TENT.'] }],
    shots: [
      { at: 0, cam: { pos: [1.65, 1.3, 7.7], look: [1.45, 1.0, 4.0], fov: 46 }, push: 0.12 },
      { at: 2.05, cam: { pos: [0.3, 0.02, 0.85], look: [0, -0.06, 0], fov: 40 }, push: 0.12, track: { actor: 'you', part: 'head' } },
    ],
    sfx: [tick(), { at: 1.6, word: 'BOING!', sound: 'boing', color: 'lime', tilt: -6, pos: [0.5, 0.4] }],
    keys: {
      you: [
        { t: 0, tent: 0 },
        { t: 1.45, tent: 0 },
        { t: 1.65, tent: 1, e: 'back' },
        { t: 1.75, pose: 'shock', j: { neckX: 34 }, face: 'shock', e: 'snap' },
        { t: 2.05, pose: 'shock', j: { neckX: 0 }, e: 'step' },
      ],
      friend: [{ t: 0, hold: null }, { t: 1.9, pose: 'stand', j: { neckY: 40, neckX: 20 }, face: 'shock', e: 'snap' }],
    },
  },
  // 4 ------------------------------------------------------------------------
  {
    id: 'sweatpants',
    dur: 3.14,
    vo: [{ at: 0, text: "So you put on your dad's sweatpants like a semi-genius.", caps: ['SO YOU PUT ON', "YOUR DAD'S", 'SWEATPANTS LIKE A', 'SEMI-GENIUS.'] }],
    shots: [
      { at: 0, cam: { pos: [2.4, 1.3, 7.2], look: [1.2, 0.95, 4.0], fov: 46 }, push: 0.1 },
      { at: 1.5, cam: { pos: [0.55, 0.02, 0.75], look: [0, -0.08, 0], fov: 40 }, push: 0.12, track: { actor: 'you', part: 'head' } },
    ],
    sfx: [{ at: 0.4, sound: 'whoosh', gain: 0.8 }],
    keys: {
      you: [
        { t: 0, x: 1.0, y: 0.25, z: 4.0, ry: 10, pose: 'hop', face: 'focus', tent: 1 },
        { t: 0.45, pants: GRAY, tent: 0, e: 'step' },
        { t: 0.6, y: 0, pose: 'stand', e: 'in' },
        { t: 1.5, ry: 35, pose: 'proud', face: 'proud', e: 'step' },
        { t: 2.6, pose: 'proud', j: { neckX: -18, spine: -12 }, e: 'inOut' },
      ],
      friend: [{ t: 0, pose: 'stand', face: 'bored' }],
    },
  },
  // 5 ------------------------------------------------------------------------
  {
    id: 'explode',
    dur: 4.55,
    vo: [
      { at: 0, text: 'Minute seven,', caps: ['MINUTE SEVEN,'] },
      { at: 1.1, text: 'the sweatpants explode and the button hits your neighbor in the eye.', caps: ['THE SWEATPANTS', 'EXPLODE AND', 'THE BUTTON HITS', 'YOUR NEIGHBOR', 'IN THE EYE.'] },
    ],
    shots: [
      { at: 0, cam: { pos: [1.9, 1.2, 6.9], look: [1.1, 0.95, 4.0], fov: 44 }, push: 0.1 },
      { at: 1.85, cam: { pos: [2.15, 1.35, 7.9], look: [2.15, 1.25, 4.2], fov: 46 }, push: 0.06 },
      { at: 2.75, cam: { pos: [-0.8, 0.02, 0.18], look: [0, 0, 0], fov: 40 }, push: 0.12, track: { actor: 'friend', part: 'head' } },
    ],
    sfx: [
      tick(),
      { at: 1.85, word: 'BANG!', sound: 'bang', color: 'yellow', tilt: -8, pos: [0.35, 0.38] },
      { at: 2.6, word: 'BONK!', sound: 'thump', color: 'lime', tilt: 7, pos: [0.65, 0.3] },
    ],
    impacts: [{ at: 1.85, freeze: 3, shake: 0.3, amp: 0.07 }, { at: 2.6, freeze: 4, shake: 0.35, amp: 0.08 }],
    bursts: [{ at: 1.85, pos: [1.15, 0.85, 4.4], n: 22, colors: [GRAY, '#6f7278', '#b5b8bd'], speed: 2.2, up: 2.4, size: 0.07, flat: true, life: 1.2 }],
    keys: {
      you: [
        { t: 0, x: 1.0, y: 0, z: 4.0, ry: 20, pose: 'stand', face: 'blank', pants: GRAY, puff: 0 },
        { t: 0.3, puff: 0 },
        { t: 1.2, face: 'shock', e: 'step' },
        { t: 1.8, puff: 0.48, pose: 'shock', e: 'in' },
        { t: 1.86, puff: 0.56, e: 'snap' },
      ],
      friend: [
        { t: 0, x: 3.25, y: 0, z: 4.4, ry: -80, pose: 'stand', face: 'bored', hold: null },
        { t: 2.6, pose: 'shock', face: 'dazed', e: 'step' },
      ],
      button: [
        { t: 0, vis: false, p: [1.15, 0.85, 4.45], ry: 90 },
        { t: 1.85, vis: true, e: 'step' },
        { t: 2.2, p: [2.2, 1.95, 4.45], e: 'out' },
        { t: 2.6, p: [3.07, 1.76, 4.46], e: 'in' },
      ],
    },
  },
  // 6 ------------------------------------------------------------------------
  {
    id: 'sleepingbag',
    dur: 2.13,
    vo: [{ at: 0, text: 'So you wear a sleeping bag as pants.', caps: ['SO YOU WEAR', 'A SLEEPING BAG', 'AS PANTS.'] }],
    shots: [{ at: 0, cam: { pos: [2.4, 1.2, 7.4], look: [1.0, 0.9, 4.0], fov: 46 }, push: 0.08 }],
    sfx: [{ at: 0.5, sound: 'thump', gain: 0.35 }, { at: 1.0, sound: 'thump', gain: 0.35 }, { at: 1.5, sound: 'thump', gain: 0.35 }],
    keys: {
      you: [
        { t: 0, x: 0.2, y: 0, z: 4.0, ry: 90, pose: 'sack', face: 'focus', pants: BAG, puff: 0.6 },
        ...hops(0, 2.0, 0.2, 1.6, 4),
      ],
      friend: [{ t: 0, x: 3.25, z: 4.4, ry: -80, pose: 'stand', face: 'dazed' }],
    },
  },
  // 7 ------------------------------------------------------------------------
  {
    id: 'genius1',
    dur: 1.56,
    vo: [{ at: 0, text: 'Genius as fuck.', caps: ['GENIUS', 'AS FUCK.'] }],
    shots: [{ at: 0, cam: { pos: [0.5, 0.02, 0.8], look: [0, -0.1, 0], fov: 40 }, push: 0.1, track: { actor: 'you', part: 'head' } }],
    keys: {
      you: [{ t: 0, x: 1.4, y: 0, z: 4.0, ry: 30, pose: 'thumbsUp', thumb: true, face: 'smug', pants: BAG, puff: 0.6 }],
    },
  },
  // 8 ------------------------------------------------------------------------
  {
    id: 'door',
    dur: 3.77,
    vo: [
      { at: 0, text: 'Minute ten,', caps: ['MINUTE TEN,'] },
      { at: 1.03, text: "you can't fit through the door, so you climb out the window.", caps: ["YOU CAN'T FIT", 'THROUGH THE DOOR,', 'SO YOU CLIMB', 'OUT THE WINDOW.'] },
    ],
    shots: [
      { at: 0, cam: { pos: [-2.5, 1.4, 3.9], look: [-3.4, 1.2, 0.4], fov: 46 }, push: 0.1 },
      { at: 2.1, cam: { pos: [5.9, 1.6, 4.4], look: [3.4, 1.3, 0.8], fov: 50 }, push: 0.08 },
    ],
    sfx: [tick(), { at: 1.2, sound: 'squeak', gain: 0.6 }, { at: 3.1, word: 'BOING!', sound: 'boing', color: 'yellow', tilt: 7, pos: [0.55, 0.32] }],
    impacts: [{ at: 3.1, freeze: 3, shake: 0.3, amp: 0.07 }],
    keys: {
      friend: [{ t: 0, vis: false }],
      button: [{ t: 0, vis: false }],
      you: [
        { t: 0, x: -3.4, y: 0, z: 0.32, ry: 0, rx: 0, pose: 'push', face: 'strain', thumb: false, pants: BAG, puff: 1.35, puffSq: 0.75, puffOff: [0, -0.1, 0.25] },
        { t: 0.4, x: -3.45, puffSq: 0.68, e: 'snap' },
        { t: 0.8, x: -3.35, puffSq: 0.8, e: 'snap' },
        { t: 1.2, x: -3.45, puffSq: 0.68, e: 'snap' },
        { t: 1.6, x: -3.35, puffSq: 0.8, e: 'snap' },
        { t: 2.1, x: 3.4, y: 1.7, z: -1.6, rx: 82, pose: 'flail', face: 'shock', puffSq: 1, puffOff: null, e: 'step' },
        { t: 2.6, z: -0.6, y: 1.75, e: 'linear' },
        { t: 3.1, z: 0.0, y: 1.5, rx: 90, pose: 'superman', face: 'dazed', e: 'in' },
        { t: 3.25, y: 1.75, e: 'out' },
        { t: 3.4, y: 1.5, e: 'in' },
        { t: 3.55, y: 1.6, e: 'out' },
        { t: 3.7, y: 1.5, e: 'in' },
      ],
    },
  },
  // 9 ------------------------------------------------------------------------
  {
    id: 'parade',
    dur: 4.41,
    vo: [
      { at: 0, text: 'Minute twelve,', caps: ['MINUTE TWELVE,'] },
      { at: 1.11, text: 'your pants are dragging behind you like a fucking parade float.', caps: ['YOUR PANTS ARE', 'DRAGGING BEHIND YOU', 'LIKE A FUCKING', 'PARADE FLOAT.'] },
    ],
    shots: [
      { at: 0, cam: { pos: [-1.4, 1.9, 10.6], look: [-3.6, 1.6, 5.0], fov: 58 }, push: 0.08 },
      { at: 1.8, cam: { pos: [3.4, 0.45, 6.6], look: [-0.4, 1.8, 5.1], fov: 56 }, push: 0.08 },
    ],
    sfx: [tick(), { at: 1.3, sound: 'fanfare', gain: 0.7 }],
    bursts: [
      { at: 1.4, pos: [-4.5, 3.3, 5.2], n: 40, colors: confetti, speed: 1.6, up: 3, size: 0.07, flat: true, life: 2.2 },
      { at: 2.8, pos: [-2.5, 3.3, 5.2], n: 40, colors: confetti, speed: 1.6, up: 3, size: 0.07, flat: true, life: 1.6 },
    ],
    keys: {
      you: [
        { t: 0, x: -4.0, y: 0, z: 5.2, ry: 90, rx: 0, pose: 'stand', face: 'smug', pants: BAG, puff: 3.4, puffSq: 1, puffOff: [0, 0.75, -2.3], walk: 0, walkAmp: 1 },
        { t: 4.41, x: 1.6, walk: 6, e: 'linear' },
      ],
      friend: [{ t: 0, vis: true, x: 3.4, y: 0, z: 7.4, ry: -120, rx: 0, pose: 'wave', face: 'shock', hold: null }, { t: 0.3, pose: 'wave2', e: 'snap' }, { t: 0.6, pose: 'wave', e: 'snap' }, { t: 0.9, pose: 'wave2', e: 'snap' }],
    },
  },
  // 10 -----------------------------------------------------------------------
  {
    id: 'army',
    dur: 3.67,
    vo: [
      { at: 0, text: 'Minute fifteen,', caps: ['MINUTE FIFTEEN,'] },
      { at: 1.18, text: "the army shows up because you're blocking the highway.", caps: ['THE ARMY', 'SHOWS UP BECAUSE', "YOU'RE BLOCKING", 'THE HIGHWAY.'] },
    ],
    shots: [
      { at: 0, cam: { pos: [47.5, 6.5, 13], look: [40, 2.2, -1], fov: 55 }, push: 0.08 },
      { at: 1.7, cam: { pos: [41.6, 1.4, 13.5], look: [40, 1.8, 1.0], fov: 46 }, push: 0.08 },
    ],
    sfx: [tick(), { at: 0.45, word: 'HONK! HONK!', sound: 'honk', color: 'yellow', tilt: -5, pos: [0.5, 0.24] }, { at: 1.3, sound: 'boom', gain: 0.25 }],
    keys: {
      friend: [{ t: 0, vis: false }],
      you: [
        { t: 0, x: 40, y: 0, z: 1.0, ry: 0, pose: 'stand', face: 'blank', walkAmp: 0, puff: 7, puffOff: [0, 2.4, -4.2] },
        { t: 1.4, pose: 'reachUp', face: 'shock', e: 'snap' },
      ],
      tank: [{ t: 0, vis: true, p: [40, 0, 24], ry: 180 }, { t: 2.4, p: [40, 0, 8.5], e: 'out' }],
      soldier1: [{ t: 0, vis: true, x: 38.2, y: 0, z: 24.5, ry: 180, pose: 'stand', j: { shRx: 90, elR: 0 }, face: 'serious', walk: 0, walkAmp: 1 }, { t: 2.4, z: 7.2, walk: 7, e: 'out' }, { t: 2.5, walkAmp: 0, e: 'snap' }],
      soldier2: [{ t: 0, vis: true, x: 41.8, y: 0, z: 24.5, ry: 180, pose: 'stand', j: { shLx: 90, elL: 0 }, face: 'serious', walk: 0, walkAmp: 1 }, { t: 2.4, z: 7.2, walk: 7, e: 'out' }, { t: 2.5, walkAmp: 0, e: 'snap' }],
    },
  },
  // 11 -----------------------------------------------------------------------
  {
    id: 'nasa',
    dur: 4.17,
    vo: [
      { at: 0, text: 'Minute twenty,', caps: ['MINUTE TWENTY,'] },
      { at: 1.07, text: 'NASA calls because your pants are visible from space.', caps: ['NASA CALLS', 'BECAUSE YOUR PANTS', 'ARE VISIBLE', 'FROM SPACE.'] },
    ],
    shots: [
      { at: 0, cam: { pos: [43.2, 1.3, 5.6], look: [40.2, 2.4, 0], fov: 52 }, push: 0.1 },
      { at: 1.55, cam: { pos: [0, 48.5, 15.5], look: [0, 47.6, 0], fov: 42 }, push: 0.15 },
    ],
    sfx: [tick(), { at: 0.15, word: 'RING RING!', sound: 'ring', color: 'yellow', tilt: 6, pos: [0.6, 0.28] }, { at: 2.0, sound: 'beep', gain: 0.6 }],
    keys: {
      ...hidden('soldier1', 'soldier2'),
      you: [{ t: 0, x: 40, y: 0, z: 1.0, ry: 30, pose: 'phoneCall', hold: 'phone', face: 'blank', puff: 12, puffOff: [0, 4.6, -6.8] }],
    },
  },
  // 12 -----------------------------------------------------------------------
  {
    id: 'doctor',
    dur: 2.0,
    vo: [{ at: 0, text: 'You finally make it to the doctor...', caps: ['YOU FINALLY', 'MAKE IT TO', 'THE DOCTOR...'] }],
    shots: [{ at: 0, cam: { pos: [1.7, 1.7, 8.8], look: [1.0, 1.3, 4.2], fov: 52 }, push: 0.2 }],
    keys: {
      tank: [{ t: 0, vis: false }],
      you: [{ t: 0, x: 0.6, y: 0, z: 4.2, ry: 90, pose: 'stand', hold: null, face: 'blank', puff: 3.0, puffOff: [0, 0.5, -1.9] }],
      doctor: [{ t: 0, vis: true, x: 2.0, y: 0, z: 4.2, ry: -90, rx: 0, pose: 'stand', j: { neckX: -10 }, face: 'serious', hold: null }],
    },
  },
  // 13 -----------------------------------------------------------------------
  {
    id: 'phone',
    dur: 3.16,
    vo: [{ at: 0, text: 'And it turns out it was just your phone in your pocket the whole time.', caps: ['AND IT TURNS OUT', 'IT WAS JUST', 'YOUR PHONE', 'IN YOUR POCKET', 'THE WHOLE TIME.'] }],
    shots: [
      { at: 0, cam: { pos: [1.7, 1.6, 8.0], look: [1.25, 1.2, 4.2], fov: 50 }, push: 0.1 },
    ],
    sfx: [{ at: 1.25, word: 'PFFFFT!', sound: 'pfft', color: 'lime', tilt: -7, pos: [0.4, 0.33], dur: 1.1 }],
    keys: {
      doctor: [
        { t: 0, pose: 'stand', face: 'serious' },
        { t: 0.5, pose: 'reachPocket', e: 'snap' },
        { t: 1.15, pose: 'holdUp', hold: 'phone', face: 'blank', e: 'snap' },
      ],
      you: [
        { t: 0, puff: 3.0 },
        { t: 1.25, puff: 3.0, face: 'blank' },
        { t: 1.3, face: 'shock', e: 'step' },
        { t: 1.8, puff: 0, e: 'in' },
        { t: 2.4, face: 'blank', e: 'step' },
      ],
    },
  },
  // 14 -----------------------------------------------------------------------
  {
    id: 'genius',
    dur: 2.17,
    captionStyle: 'huge',
    vo: [{ at: 0, text: 'Fucking genius.', caps: ['FUCKING GENIUS.'] }],
    shots: [{ at: 0, cam: { pos: [0.6, 1.32, 6.3], look: [0.6, 1.52, 7.5], fov: 40 }, push: 0.12 }],
    sfx: [{ at: 0, sound: 'boom', gain: 0.55 }],
    keys: {
      doctor: [{ t: 0, vis: false }],
      you: [{ t: 0, x: 0.6, y: 0, z: 7.5, ry: 180, pose: 'crossArms', face: 'serious', hold: null, puff: 0, pants: null }],
    },
  },
];
