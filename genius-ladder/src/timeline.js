// =============================================================================
//  THE TIMELINE — the single place to retime the video.
//
//  One entry per script beat. Beats play back-to-back; change `dur` to retime a
//  beat and everything after it shifts. Inside a beat every time (`at` / `t`) is
//  in seconds relative to the beat start.
//
//    dur      beat length (s)
//    vo       narration segments: { at, text (what the TTS says), caps (on-screen
//             chunks, 2–4 words; synced to the voice by scripts/tts.mjs) }
//    shots    hard cuts: { at, cam:{pos,look,fov}, push (slow push-in fraction),
//             to:{pos,look,fov,e} (optional camera move), track:{actor,part} (make
//             pos/look relative to an actor's head/hips/root at the shot start) }
//    sfx      sound-effect words and/or sounds: { at, word, color:'yellow'|'lime',
//             tilt (deg), pos:[nx,ny] or world:[x,y,z] (+ off:[px,px]), sound, gain }
//    impacts  { at, freeze (frames, everything holds), shake (s), amp (m) }
//    bursts   particle puffs: { at, pos, n, colors, speed, up, size }
//    keys     keyframes per actor/prop: { t, e (ease into this key), ...values }.
//             People take `pose` (see poses.js) + `j:{joint overrides}`, x/y/z,
//             ry/rx/rz (deg), sq (squash), face, hold, on:'ladder' + s (metres up
//             the ladder). A key at t=0 is a hard cut; before a property's first
//             key in a beat it holds that first value.
//
//  World: house wall face is z=0, bathroom window x∈[-0.45,0.45], y∈[3.0,3.9].
// =============================================================================
import { CONFIG } from './config.js';

const P = CONFIG.palette;
const LADDER = 3.3;
const WALL = 0.03;
const BOX_Y = (n) => n * 0.5; // stacked box bottoms
const greens = [P.grass, P.grassDark, P.grassLight, '#6b4a2b'];
const cardboard = [P.cardboard, P.cardboardDark, P.tape];

// point on a wall-leaning ladder, `s` metres up from the foot
function onWallLadder(leanDeg, s, out = 0.16) {
  const a = (leanDeg * Math.PI) / 180;
  const footZ = WALL + LADDER * Math.sin(a);
  return { y: s * Math.cos(a) + out * Math.sin(a), z: footZ - s * Math.sin(a) + out * Math.cos(a) };
}

// alternate climbing poses while moving up `s` (stiff, snappy steps)
function climb(t0, t1, s0, s1, steps, extra = {}) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    out.push({ t: +(t0 + (t1 - t0) * u).toFixed(3), s: s0 + (s1 - s0) * u, pose: i % 2 ? 'climbB' : 'climbA', e: 'snap', ...extra });
  }
  return out;
}

// hammer swings that land exactly on the given hit times
function hammer(hits) {
  return hits.flatMap((h) => [
    { t: h - 0.13, pose: 'hammerUp', e: 'out' },
    { t: h, pose: 'hammerDown', e: 'snap' },
  ]);
}

// beat 6: the ladder slides from 27° to 88° between 0.34 s and 1.2 s (ease 'in' = cubic);
// YOU lets go at 1.07 s, so start his flight exactly where the ladder has carried him.
const SLIDE = { t0: 0.34, t1: 1.2, a0: 27, a1: 88, letGo: 1.07 };
const slideLean = (t) => SLIDE.a0 + (SLIDE.a1 - SLIDE.a0) * Math.pow((t - SLIDE.t0) / (SLIDE.t1 - SLIDE.t0), 3);
const slip = onWallLadder(slideLean(SLIDE.letGo), 1.25);

export const TIMELINE = [
  // ---------------------------------------------------------------- 1. the problem
  {
    id: 'intro',
    dur: 3.95,
    vo: [{ at: 0.12, text: 'You want to watch your friend shit, but his bathroom window is ten feet up.', caps: ['YOU WANT TO', 'WATCH YOUR', 'FRIEND SHIT,', 'BUT HIS', 'BATHROOM WINDOW', 'IS TEN FEET UP.'] }],
    shots: [
      { at: 0, cam: { pos: [2.4, 1.0, 8.2], look: [0.2, 2.75, 0], fov: 58 }, push: 0.1 },
      { at: 1.2, cam: { pos: [0.22, 3.48, 1.75], look: [0, 3.22, -1.2], fov: 40 }, push: 0.14 },
      { at: 2.25, cam: { pos: [1.05, 0.22, 3.9], look: [0.05, 3.3, 0], fov: 62 }, push: 0.09 },
    ],
    keys: {
      you: [
        { t: 0, x: 0.55, y: 0, z: 2.5, ry: 188, pose: 'lookUp', face: 'blank' },
        { t: 0.7, pose: 'lookUp', j: { neckZ: 8 }, e: 'snap' },
        { t: 2.2, pose: 'lookUpHand', face: 'focus', e: 'snap' },
      ],
      friend: [
        { t: 0, x: 0, y: 2.36, z: -1.18, ry: 0, pose: 'sitPhone', face: 'bored', hold: 'phone', bino: false },
        { t: 1.6, pose: 'sitPhone', j: { neckY: 6, neckX: 26 }, e: 'snap' },
        { t: 2.0, pose: 'sitPhone', e: 'snap' },
      ],
      dog: [{ t: 0, vis: false }],
      ladder: [{ t: 0, vis: false }],
      box1: [{ t: 0, vis: false }],
      box2: [{ t: 0, vis: false }],
      box3: [{ t: 0, vis: false }],
    },
  },

  // ---------------------------------------------------------------- 2. boxes
  {
    id: 'boxes',
    dur: 2.6,
    vo: [{ at: 0.08, text: 'So you stack boxes like a semi-genius.', caps: ['SO YOU STACK', 'BOXES LIKE A', 'SEMI-GENIUS.'] }],
    shots: [
      { at: 0, cam: { pos: [2.5, 1.35, 3.1], look: [0, 1.0, 0.85], fov: 50 }, push: 0.08 },
      { at: 1.35, cam: { pos: [0.62, 0.04, 0.3], look: [0, -0.06, 0], fov: 40 }, push: 0.1, track: { actor: 'you', part: 'head' } },
    ],
    sfx: [{ at: 0.62, sound: 'thump', gain: 0.5 }],
    keys: {
      box1: [{ t: 0, p: [0, BOX_Y(0), 0.6], ry: 3, crush: 0, vis: true }],
      box2: [{ t: 0, p: [0.02, BOX_Y(1), 0.6], ry: -5, crush: 0, vis: true }],
      box3: [
        { t: 0, p: [0, 1.88, 1.18], ry: 0, crush: 0, vis: true },
        { t: 0.32, p: [0, 1.95, 1.0], e: 'out' },
        { t: 0.62, p: [0, BOX_Y(2), 0.6], ry: 7, e: 'snap' },
      ],
      you: [
        { t: 0, x: 0, y: 0, z: 1.62, ry: 180, pose: 'carryUp', face: 'focus' },
        { t: 0.32, pose: 'carryUp', j: { spine: -10 }, e: 'out' },
        { t: 0.62, pose: 'placeDown', e: 'snap' },
        { t: 0.95, pose: 'stand', e: 'snap' },
        { t: 1.12, z: 1.62, ry: 180 },
        { t: 1.3, ry: 68, pose: 'proud', face: 'proud', e: 'snap' },
        { t: 2.1, pose: 'proud', j: { neckX: -18, spine: -12 }, e: 'inOut' },
      ],
    },
  },

  // ---------------------------------------------------------------- 3. collapse
  {
    id: 'collapse',
    dur: 2.6,
    vo: [{ at: 0.62, text: 'But they collapse under your fat ass.', caps: ['BUT THEY', 'COLLAPSE UNDER', 'YOUR FAT ASS.'] }],
    shots: [
      { at: 0, cam: { pos: [1.9, 0.35, 3.7], look: [0.1, 1.9, 0.5], fov: 58 }, push: 0.08 },
      { at: 1.45, cam: { pos: [-0.85, 0.7, 0.15], look: [0, 0.85, 0.95], fov: 44 }, push: 0.1 },
    ],
    sfx: [
      { at: 0.3, word: 'CRUNCH!', sound: 'crunch', color: 'yellow', tilt: -7, world: [0, 0.9, 0.6], off: [150, -120] },
      { at: 0.52, sound: 'thud', gain: 0.8 },
    ],
    impacts: [{ at: 0.52, freeze: 4, shake: 0.45, amp: 0.12 }],
    bursts: [{ at: 0.32, pos: [0, 0.45, 0.6], n: 24, colors: cardboard, speed: 2.2, up: 2.6, size: 0.08, flat: true, life: 1.4 }],
    keys: {
      box1: [{ t: 0, p: [0, 0, 0.6], ry: 3, crush: 0, vis: true }, { t: 0.3, crush: 0 }, { t: 0.38, crush: 1, e: 'snap' }],
      box2: [{ t: 0, p: [0.02, BOX_Y(1), 0.6], ry: -5, crush: 0, vis: true }, { t: 0.3, p: [0.02, BOX_Y(1), 0.6] }, { t: 0.4, p: [0.04, 0.065, 0.62], ry: 12, crush: 1, e: 'snap' }],
      box3: [{ t: 0, p: [0, BOX_Y(2), 0.6], ry: 7, crush: 0, vis: true }, { t: 0.3, p: [0, BOX_Y(2), 0.6] }, { t: 0.42, p: [-0.03, 0.13, 0.58], ry: -8, crush: 1, e: 'snap' }],
      you: [
        { t: 0, x: 0, y: 1.5, z: 0.62, ry: 180, pose: 'reachUp', face: 'strain', sq: 1 },
        { t: 0.16, pose: 'reachUp', j: { spineZ: 5, shLx: 178 }, e: 'snap' },
        { t: 0.3, y: 1.5, z: 0.62, pose: 'wobble', face: 'shock', e: 'snap' },
        { t: 0.52, y: 0.2, z: 0.9, pose: 'sitGround', e: 'fall' },
        { t: 0.52, sq: 0.6, e: 'step' },
        { t: 0.66, sq: 0.6 },
        { t: 0.82, sq: 1.1, e: 'out' },
        { t: 0.98, sq: 1, face: 'dazed', e: 'inOut' },
        { t: 1.45, pose: 'sitSlump', j: { neckY: 38, neckX: -4 }, face: 'blank', e: 'step' },
        { t: 2.0, face: 'blank', blink: 1, e: 'step' },
        { t: 2.1, blink: 0, e: 'step' },
      ],
    },
  },

  // ---------------------------------------------------------------- 4. build a ladder
  {
    id: 'hammer',
    dur: 2.9,
    vo: [{ at: 0.28, text: 'So you nail two poles together with sticks in between.', caps: ['SO YOU NAIL', 'TWO POLES', 'TOGETHER WITH', 'STICKS IN BETWEEN.'] }],
    shots: [
      { at: 0, cam: { pos: [3.1, 0.52, 2.85], look: [2.42, 0.16, 2.08], fov: 44 }, push: 0.1 },
      { at: 1.3, cam: { pos: [3.9, 1.8, 5.7], look: [2.5, 0.45, 1.9], fov: 50 }, push: 0.08 },
    ],
    sfx: [
      { at: 0.14, word: 'BANG!', sound: 'bang', tilt: -8, pos: [0.3, 0.27], dur: 1.15 },
      { at: 0.44, word: 'BANG!', sound: 'bang', tilt: 6, pos: [0.68, 0.36], dur: 0.85 },
      { at: 0.74, word: 'BANG!', sound: 'bang', tilt: -3, pos: [0.42, 0.45], dur: 0.55, color: 'lime' },
    ],
    impacts: [
      { at: 0.14, freeze: 0, shake: 0.16, amp: 0.035 },
      { at: 0.44, freeze: 0, shake: 0.16, amp: 0.035 },
      { at: 0.74, freeze: 2, shake: 0.2, amp: 0.05 },
    ],
    bursts: [
      { at: 0.14, pos: [2.42, 0.12, 2.14], n: 6, colors: [P.wood, P.woodDark], speed: 1.2, up: 1.6, size: 0.03, life: 0.5 },
      { at: 0.44, pos: [2.42, 0.12, 2.14], n: 6, colors: [P.wood, P.woodDark], speed: 1.2, up: 1.6, size: 0.03, life: 0.5 },
      { at: 0.74, pos: [2.42, 0.12, 2.14], n: 8, colors: [P.wood, P.woodDark], speed: 1.4, up: 1.8, size: 0.035, life: 0.5 },
    ],
    keys: {
      box1: [{ t: 0, vis: false }],
      box2: [{ t: 0, vis: false }],
      box3: [{ t: 0, vis: false }],
      ladder: [{ t: 0, vis: true, wall: false, p: [0.75, 1.9], ry: -90, lean: 90, tip: 0, open: 0, side2: false, rubber: 0, glue: 0, lift: 0.045, wiggle: 0 }],
      you: [
        { t: 0, x: 2.42, y: 0, z: 2.62, ry: 180, pose: 'hammerUp', face: 'focus', hold: 'hammer', sq: 1 },
        ...hammer([0.14, 0.44, 0.74]),
        { t: 1.0, pose: 'hammerUp', face: 'focus', e: 'out' },
        { t: 1.3, x: 2.3, z: 2.75, ry: 200, pose: 'stand', face: 'proud', e: 'step' },
        { t: 1.3, j: { shRx: 150, shRz: 20, elR: 140 } },
        { t: 1.9, pose: 'stand', j: { shRx: 150, shRz: 20, elR: 140, neckX: 8, spine: -6 }, face: 'proud', e: 'snap' },
        { t: 2.3, pose: 'stand', j: { shRx: 150, shRz: 20, elR: 140, neckX: -6 }, e: 'snap' },
      ],
    },
  },

  // ---------------------------------------------------------------- 5. smug climb
  {
    id: 'smug',
    dur: 1.5,
    vo: [{ at: 0.15, text: 'Genius as fuck.', caps: ['GENIUS', 'AS FUCK.'] }],
    shots: [{ at: 0, cam: { pos: [-1.9, 0.45, 3.3], look: [0.05, 2.0, 0.9], fov: 56 }, push: 0.1 }],
    keys: {
      ladder: [{ t: 0, vis: true, wall: true, p: [0, 0], ry: 0, lean: 25, tip: 0, lift: 0, side2: false, rubber: 0 }],
      you: [
        { t: 0, on: 'ladder', onMix: 1, out: 0.16, ry: 180, hold: null, face: 'focus' },
        ...climb(0, 0.6, 0.62, 1.22, 2),
        { t: 0.68, pose: 'climbSmug', face: 'smug', e: 'snap' },
        { t: 1.3, pose: 'climbSmug', j: { neckX: -14, neckZ: -8 }, e: 'inOut' },
      ],
    },
  },

  // ---------------------------------------------------------------- 6. slide + faceplant
  {
    id: 'slide',
    dur: 3.5,
    vo: [{ at: 0.12, text: 'Except it slides down the wall and you eat the fucking grass.', caps: ['EXCEPT IT SLIDES', 'DOWN THE WALL', 'AND YOU EAT', 'THE FUCKING GRASS.'] }],
    shots: [
      { at: 0, cam: { pos: [5.6, 1.7, 3.0], look: [0, 1.45, 1.55], fov: 56 }, push: 0.07 },
      { at: 1.85, cam: { pos: [-0.62, 0.42, -0.3], look: [0, 0, 0], fov: 42 }, push: 0.12, track: { actor: 'you', part: 'head' } },
    ],
    sfx: [
      { at: 0.24, word: 'SKRRRT!', sound: 'skrrt', color: 'lime', tilt: 8, pos: [0.6, 0.28], dur: 1.1 },
      { at: 1.2, sound: 'clatter', gain: 0.8 },
      { at: 1.55, sound: 'thud', gain: 1 },
    ],
    impacts: [{ at: 1.55, freeze: 4, shake: 0.5, amp: 0.14 }],
    bursts: [{ at: 1.55, pos: [0.55, 0.12, 1.2], n: 30, colors: greens, speed: 1.8, up: 2.4, size: 0.055, life: 1.1 }],
    keys: {
      ladder: [
        { t: 0, vis: true, wall: true, lean: 25, lift: 0, tip: 0, rubber: 0 },
        { t: 0.22, lean: 25 },
        { t: SLIDE.t0, lean: SLIDE.a0, e: 'out' },
        { t: SLIDE.t1, lean: SLIDE.a1, lift: 0.04, e: 'in' },
        { t: 1.3, lean: 86, e: 'out' },
        { t: 1.4, lean: 88, e: 'in' },
      ],
      you: [
        { t: 0, on: 'ladder', onMix: 1, s: 1.25, out: 0.16, ry: 180, rx: 0, pose: 'climbHold', face: 'smug', sq: 1, hold: null, grass: false },
        { t: 0.3, face: 'shock', pose: 'climbHold', j: { neckY: 40 }, e: 'step' },
        { t: 0.5, pose: 'climbHold', j: { shLz: 30, shRz: 30, neckY: 40 }, e: 'snap' },
        { t: SLIDE.letGo, onMix: 1, x: 0, y: slip.y, z: slip.z, rx: 0 },
        { t: SLIDE.letGo + 0.01, onMix: 0, e: 'step' },
        { t: SLIDE.letGo, pose: 'flail', face: 'shock', e: 'snap' },
        { t: 1.3, x: 0.3, y: 0.95, z: 2.25, rx: 40, e: 'out' },
        { t: 1.55, x: 0.55, y: 0.16, z: 2.55, rx: 90, pose: 'faceplant', e: 'in' },
        { t: 1.55, sq: 0.62, face: 'dazed', e: 'step' },
        { t: 1.69, sq: 0.62 },
        { t: 1.85, sq: 1.06, e: 'out' },
        { t: 2.0, sq: 1, e: 'inOut' },
        { t: 2.2, grass: true, e: 'step' },
        { t: 2.55, face: 'serious', pose: 'faceplant', j: { neckX: -30 }, e: 'snap' },
      ],
    },
  },

  // ---------------------------------------------------------------- 7. rubber feet
  {
    id: 'glue',
    dur: 2.3,
    vo: [{ at: 0.12, text: 'So you glue rubber on the feet.', caps: ['SO YOU GLUE', 'RUBBER ON', 'THE FEET.'] }],
    shots: [
      { at: 0, cam: { pos: [-1.35, 0.75, 3.35], look: [0.25, 0.3, 1.5], fov: 40 }, push: 0.12 },
      { at: 1.15, cam: { pos: [1.75, 1.25, 3.9], look: [0.2, 1.0, 1.3], fov: 50 }, push: 0.08 },
    ],
    sfx: [
      { at: 0.62, word: 'SQUEAK!', sound: 'squeak', color: 'lime', tilt: -6, pos: [0.36, 0.3] },
      { at: 0.3, sound: 'splat', gain: 0.5 },
    ],
    keys: {
      ladder: [
        { t: 0, vis: true, wall: true, lean: 25, lift: 0, tip: 0, rubber: 0, glue: 0, wiggle: 0, side2: false },
        { t: 0.18, glue: 0 },
        { t: 0.32, glue: 1, e: 'back' },
        { t: 0.55, rubber: 0 },
        { t: 0.66, rubber: 1, glue: 0, e: 'back' },
        { t: 1.3, wiggle: 0 },
        { t: 1.4, wiggle: 3, e: 'snap' },
        { t: 1.5, wiggle: -3, e: 'snap' },
        { t: 1.6, wiggle: 2, e: 'snap' },
        { t: 1.7, wiggle: 0, e: 'snap' },
      ],
      you: [
        { t: 0, on: null, onMix: 0, x: 0.62, y: 0, z: 1.62, ry: -110, rx: 0, sq: 1, pose: 'kneelWork', face: 'focus', hold: 'glue', grass: false },
        { t: 0.28, pose: 'kneelWork', j: { shRx: 75, elR: 10 }, e: 'snap' },
        { t: 0.45, hold: 'rubber', e: 'step' },
        { t: 0.62, pose: 'kneelWork', j: { shRx: 70, elR: 5, spine: 36 }, e: 'snap' },
        { t: 0.68, hold: null, e: 'step' },
        { t: 1.15, x: 0.55, z: 1.75, ry: 25, pose: 'wiggle', face: 'focus', e: 'step' },
        { t: 1.75, pose: 'thumbsUp', thumb: true, face: 'happy', e: 'snap' },
      ],
    },
  },

  // ---------------------------------------------------------------- 8. the dog
  {
    id: 'dog',
    dur: 3.4,
    vo: [{ at: 0.15, text: 'Then his fucking dog pisses on it.', caps: ['THEN HIS', 'FUCKING DOG', 'PISSES ON IT.'] }],
    shots: [
      { at: 0, cam: { pos: [2.6, 1.25, 5.4], look: [0.7, 0.55, 1.5], fov: 52 }, push: 0.08 },
      { at: 0.95, cam: { pos: [-1.3, 0.48, 1.72], look: [0.3, 0.3, 1.78], fov: 42 }, push: 0.1 },
      { at: 2.05, cam: { pos: [1.4, 1.45, 5.8], look: [-0.6, 1.3, 0.9], fov: 56 }, push: 0.08 },
    ],
    sfx: [
      { at: 1.05, word: 'PSSSSHH!', sound: 'pssh', color: 'yellow', tilt: 6, pos: [0.55, 0.3], dur: 1.0 },
      { at: 2.85, sound: 'crash', gain: 0.9 },
    ],
    impacts: [{ at: 2.85, freeze: 3, shake: 0.4, amp: 0.1 }],
    bursts: [{ at: 2.85, pos: [-1.6, 0.1, 1.2], n: 16, colors: greens, speed: 1.5, up: 1.8, size: 0.05 }],
    keys: {
      ladder: [
        { t: 0, vis: true, wall: true, lean: 25, lift: 0, tip: 0, rubber: 1, glue: 0, wiggle: 0, side2: false },
        { t: 2.0, tip: 0, lift: 0 },
        { t: 2.85, tip: 82, lift: 0.24, e: 'in' },
        { t: 2.95, tip: 78, e: 'out' },
        { t: 3.05, tip: 82, e: 'in' },
      ],
      dog: [
        { t: 0, vis: true, x: 3.6, z: 1.86, ry: -90, walk: 0, walkAmp: 1, wag: 0, leg: 0, pee: 0, puddle: 0, puddleAt: [0.15, 1.55], peeTo: [0.22, 0.06, 1.47], headY: 0, tongue: true },
        { t: 0.9, x: 0.32, walk: 6.5, wag: 7, e: 'linear' },
        { t: 0.95, walkAmp: 0, e: 'snap' },
        { t: 1.02, leg: 1, e: 'snap' },
        { t: 1.08, pee: 0 },
        { t: 1.16, pee: 1, puddle: 0.12, e: 'linear' },
        { t: 1.95, pee: 1, puddle: 0.85, headY: -12, headZ: 14, wag: 13, e: 'linear' },
        { t: 2.02, pee: 0, leg: 0, e: 'snap' },
        { t: 2.2, x: 0.32, walk: 6.5, walkAmp: 0 },
        { t: 2.3, ry: 90, walkAmp: 1, headY: 0, e: 'snap' },
        { t: 3.4, x: 4.0, walk: 13, wag: 22, e: 'linear' },
      ],
      you: [
        { t: 0, on: null, onMix: 0, x: -1.0, y: 0, z: 2.3, ry: 150, rx: 0, sq: 1, pose: 'stand', face: 'blank', hold: null, thumb: false },
        { t: 1.0, pose: 'stand', j: { neckY: -30, neckX: 14 }, face: 'serious', e: 'snap' },
        { t: 2.15, pose: 'limp', face: 'blank', e: 'snap' },
        { t: 2.86, pose: 'shock', face: 'shock', e: 'snap' },
      ],
    },
  },

  // ---------------------------------------------------------------- 9. A-frame
  {
    id: 'hinge',
    dur: 2.9,
    vo: [{ at: 0.12, text: 'So you hinge on a second side so it stands by itself.', caps: ['SO YOU HINGE', 'ON A SECOND SIDE', 'SO IT STANDS', 'BY ITSELF.'] }],
    shots: [
      { at: 0, cam: { pos: [0.8, 3.4, 1.65], look: [0, 3.1, 0.62], fov: 42 }, push: 0.1 },
      { at: 1.2, cam: { pos: [2.3, 1.6, 5.8], look: [0.2, 1.65, 0.8], fov: 56 }, push: 0.08 },
    ],
    sfx: [{ at: 0.6, word: 'CLICK!', sound: 'click', color: 'lime', tilt: -5, pos: [0.62, 0.3] }],
    impacts: [{ at: 0.6, freeze: 3, shake: 0.18, amp: 0.035 }],
    keys: {
      dog: [{ t: 0, vis: false, pee: 0 }],
      ladder: [
        { t: 0, vis: true, wall: false, p: [0, 1.3], ry: 0, lean: 11, tip: 0, lift: 0, rubber: 1, side2: true, open: 0, wiggle: 0 },
        { t: 0.32, open: 0 },
        { t: 0.6, open: 22, e: 'back' },
      ],
      you: [
        { t: 0, x: 1.4, y: 0, z: 2.6, ry: 200, pose: 'stand', face: 'focus' },
        { t: 1.2, x: 0.95, z: 2.3, ry: 20, pose: 'stand', face: 'happy', e: 'step' },
        { t: 1.4, pose: 'tada', face: 'proud', e: 'back' },
        { t: 2.4, pose: 'tada', j: { neckX: -16, spine: -12 }, e: 'inOut' },
      ],
    },
  },

  // ---------------------------------------------------------------- 10. the reveal
  {
    id: 'reveal',
    dur: 5.0,
    vo: [
      { at: 0.12, text: 'You finally reach the top...', caps: ['YOU FINALLY', 'REACH THE TOP...'] },
      { at: 2.5, text: "and he's been watching you shit for three years.", caps: ["AND HE'S BEEN", 'WATCHING YOU SHIT', 'FOR THREE YEARS.'] },
    ],
    shots: [
      { at: 0, cam: { pos: [1.35, 0.45, 3.7], look: [0.1, 2.3, 0.9], fov: 58 }, push: 0.1 },
      { at: 1.45, cam: { pos: [0.42, 3.9, 2.35], look: [0, 3.4, -0.9], fov: 44 }, push: 0.32 },
      { at: 2.65, cam: { pos: [0.06, 3.58, 0.8], look: [0, 3.5, -1.2], fov: 38 }, push: 0.14 },
      { at: 3.7, cam: { pos: [0.1, 0.02, -0.8], look: [0, -0.02, 0], fov: 40 }, push: 0.12, track: { actor: 'you', part: 'head' } },
    ],
    sfx: [{ at: 3.72, sound: 'sting', gain: 0.6 }],
    keys: {
      ladder: [{ t: 0, vis: true, wall: false, p: [0, 1.3], ry: 0, lean: 11, tip: 0, lift: 0, rubber: 1, side2: true, open: 22 }],
      friend: [{ t: 0, x: 0, y: 2.36, z: -1.18, ry: 0, pose: 'sitBino', face: 'blank', hold: null, bino: true }],
      you: [
        { t: 0, on: 'ladder', onMix: 1, out: 0.16, ry: 180, rx: 0, sq: 1, face: 'focus', thumb: false, hold: null },
        ...climb(0, 1.35, 0.32, 1.95, 5),
        { t: 1.45, pose: 'peek', face: 'happy', e: 'snap' },
        { t: 3.7, pose: 'peek', face: 'shock', j: { spine: -6, neckX: -6 }, e: 'step' },
      ],
    },
  },

  // ---------------------------------------------------------------- 11. punchline
  {
    id: 'genius',
    dur: 2.1,
    captionStyle: 'huge',
    vo: [{ at: 0.18, text: 'Fucking genius.', caps: ['FUCKING GENIUS.'] }],
    shots: [{ at: 0, cam: { pos: [0, 1.32, 1.8], look: [0, 1.52, 3.0], fov: 40 }, push: 0.12 }],
    sfx: [{ at: 0, sound: 'boom', gain: 0.55 }],
    keys: {
      ladder: [{ t: 0, vis: false }],
      you: [{ t: 0, on: null, onMix: 0, x: 0, y: 0, z: 3.0, ry: 180, rx: 0, sq: 1, pose: 'crossArms', face: 'serious', hold: null }],
    },
  },
];
