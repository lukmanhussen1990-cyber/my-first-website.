// Story beat times (seconds). Shared by the animation, the particles and
// (exported as JSON) by the sound design, so picture and sound stay in sync.
import { keys, seg, easeInOut, easeOut, easeIn, smooth, lerp, clamp } from './lib.js';

export const FPS = 30, DURATION = 50;
export const SCENES = [0, 7, 14, 21, 28, 35, 41.5, 50];

export const B = {
  // 1. stomp in, huff, chest pound, start digging
  walk0: 0.5, walk1: 2.62, stomps: [0.8, 1.26, 1.72, 2.18, 2.6],
  huff: 2.95,
  pounds: [3.32, 3.5, 3.68, 3.86, 4.04, 4.22],
  hop: 4.45, hopLand: 4.8,
  dig0: 4.9,
  // 2. dirt over the fence, neighbour buried, wheelbarrow
  spray0: 5.45, gasp: 7.45, bury0: 7.6, bury1: 9.9, spray1: 10.2,
  barrowPop: 11.0,
  scoops: [11.55, 12.33, 13.11, 13.89],
  // 3. way too deep, map, squint, climb out, fill to the line
  deep0: 14.05, deep1: 16.6,
  mapUp: 16.8, linePop: 17.45, squint: 17.95,
  climb: 18.7, climbLand: 19.45,
  fill0: 19.75, fill1: 20.95,
  // 4. walls cave in, pound flat, concrete + tiles
  crumble0: 21.05, crumble1: 22.85,
  jumpIn: 22.75, jumpInLand: 23.1,
  punches: [23.32, 23.62, 23.92, 24.22, 24.48],
  jumpOut: 24.62, jumpOutLand: 25.0,
  slabs: [24.85, 25.0, 25.15, 25.3],
  tiles0: 25.45, tiles1: 27.0,
  cope0: 27.0, cope1: 27.5, ladder: 27.55,
  kidWalk0: 25.6, kidWalk1: 27.4,
  // 5. angry again, bananas, hose
  cross: 28.25, grunt: 28.45, huff2: 29.05,
  pilePop: 29.95, push0: 30.05, push1: 30.75,
  smile: 30.85, grab: 31.05, peel0: 31.2, peel1: 31.55, bite: 31.62,
  hoseOn: 31.8, water0: 31.95, water1: 35.35, hoseOff: 35.4,
  kidBack0: 34.35, kidBack1: 35.3,
  // 6. finished pool, kid cheers in swim gear
  poof: 35.75, cheers: [36.35, 37.1, 37.85, 38.6, 39.35],
  crouch: 40.85,
  // 7. cannonball finale
  bands: 41.6, backstep: 41.85, leap: 42.45, impact: 43.3,
  soak0: 43.55, soak1: 44.3,
  surface: 44.5, settle: 45.4, sigh: 45.6, bite2: 46.55, blink2: 47.3,
  hold: 48.0,
};

export const POOL_TOP_DEPTH = 1.6, DEEP = 3.0;

// hole depth over time
export function holeDepth(t) {
  if (t < B.dig0) return 0;
  if (t < 7.0) return lerp(0.02, 0.6, easeOut(seg(t, B.dig0, 7.0)));
  if (t < B.spray1) return lerp(0.6, 1.3, seg(t, 7.0, B.spray1));
  if (t < B.deep0) return lerp(1.3, 1.6, seg(t, B.spray1, B.deep0));
  if (t < B.deep1) {
    // "down, and down, and down": three accelerating surges
    const k = seg(t, B.deep0, B.deep1);
    const steps = (k * 3) - Math.sin(k * 3 * Math.PI * 2) / (Math.PI * 2) * 0.8;
    return lerp(1.6, DEEP, clamp(steps / 3));
  }
  if (t < B.fill0) return DEEP;
  if (t < B.fill1) return lerp(DEEP, 1.6, easeInOut(seg(t, B.fill0, B.fill1)));
  if (t < B.crumble0) return 1.6;
  if (t < B.jumpInLand) return lerp(1.6, 1.46, smooth(seg(t, B.crumble0 + 0.3, B.crumble1)));
  if (t < B.punches[4] + 0.15) return lerp(1.46, 1.6, smooth(seg(t, B.punches[4], B.punches[4] + 0.15)));
  return 1.6;
}

export function holeFootprint(t) {
  // grows from where the gorilla digs, then stays the pool rectangle
  const k = easeOut(seg(t, B.dig0, B.dig0 + 0.75));
  return {
    x0: lerp(-0.45, -1.5, k), x1: lerp(0.55, 1.5, k),
    zb: lerp(-0.5, -1.6, k), zf: lerp(0.5, 1.6, k),
  };
}

export function waterLevel(t) {
  const floor = -1.6;
  if (t < B.water0) return floor;
  const top = -0.12;
  let l = lerp(floor + 0.02, top, smooth(seg(t, B.water0, B.water1)));
  // cannonball: level surges then settles (gorilla displacement)
  if (t > B.impact) {
    const dt = t - B.impact;
    l += 0.09 * (1 - Math.exp(-dt * 6)) - 0.05 * Math.exp(-dt * 1.2) * Math.sin(dt * 7);
  }
  return l;
}

// beat list for the sound design (seconds)
export function sfxCues() {
  return {
    stomps: B.stomps, huff: [B.huff, B.huff2], pounds: B.pounds,
    hopLand: [B.hopLand], dig: [[B.dig0, B.spray1], [B.deep0, B.deep1]],
    dirtRain: [[B.spray0 + 0.9, B.spray1 + 1.0]], gasp: [B.gasp],
    barrowPop: [B.barrowPop], squeak: [B.barrowPop + 0.12, B.barrowPop + 0.45], scoops: B.scoops,
    paper: [B.mapUp - 0.1], linePop: [B.linePop], climbLand: [B.climbLand], fill: [[B.fill0, B.fill1]],
    crumble: [[B.crumble0, B.crumble1]], jumpLand: [B.jumpInLand, B.jumpOutLand], punches: B.punches,
    slabs: B.slabs, tiles: [B.tiles0, B.tiles1], cope: [B.cope0, B.cope1], ladder: [B.ladder],
    grunt: [B.grunt], pilePop: [B.pilePop], slide: [[B.push0, B.push1]], peel: [B.peel0, B.peel0 + 0.13, B.peel0 + 0.26], bite: [B.bite, B.bite2],
    hose: [[B.hoseOn, B.hoseOff]], poof: [B.poof], cheers: B.cheers,
    bands: [B.bands], leap: [B.leap], impact: [B.impact], soak: [[B.soak0, B.soak1]], sigh: [B.sigh],
    musicStop: B.impact,
  };
}

// stage layout (world positions, metres). Pool spans x -1.5..1.5, z -1.6..1.6 (front cut).
export const L = {
  kidHome: [-2.0, 0, 0.85],
  gDig: [0.0, 0, -0.15],
  barrow: [0.8, 0, -2.9],
  heap: [-0.85, 0, -3.0],
  neighbor: [1.9, 0.45, -5.75],
  gStage: [1.12, 0, -3.25],
  pileStart: [-1.3, 0, -2.95], pileEnd: [-0.05, 0, -2.95],
  kidPush: [-2.0, 0, -2.95],
  kidEdge: [-1.92, 0, -0.3],
  floatAt: [0.05, 0, -0.15],
};
