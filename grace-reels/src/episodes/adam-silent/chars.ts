import type { CharacterSpec, Look } from '../../kit-storybook/gl/Character';

export const ADAM_CU: CharacterSpec = {
  src: 'chars/char_adam_close.png',
  size: [1024, 1536],
  eyes: [{ c: [598, 492], r: [46, 24], a: 8 }, { c: [730, 527], r: [26, 19], a: 10 }],
  skin: [0.84, 0.55, 0.31],
  lash: [0.22, 0.13, 0.08],
  breathBand: [950, 1350],
  flutter: [{ center: [560, 230], radius: [330, 200], amp: 1.6 }],
};
export const EVE_CU: CharacterSpec = {
  src: 'chars/char_eve_close.png',
  size: [1024, 1536],
  eyes: [{ c: [335, 413], r: [33, 36], a: 5 }, { c: [505, 450], r: [54, 36], a: 18 }],
  skin: [0.84, 0.51, 0.28],
  lash: [0.2, 0.11, 0.07],
  breathBand: [950, 1400],
  flutter: [
    { center: [170, 1000], radius: [220, 520], amp: 3.2 },
    { center: [880, 980], radius: [200, 520], amp: 3.2 },
    { center: [520, 220], radius: [340, 200], amp: 1.4 },
  ],
};
export const JESUS_CU: CharacterSpec = {
  src: 'chars/char_jesus_close.png',
  line: 'lineart/jesus_close_gold.png',
  size: [1024, 1536],
  eyes: [{ c: [577, 407], r: [43, 25], a: 4 }, { c: [725, 433], r: [25, 23], a: 8 }],
  skin: [0.88, 0.59, 0.34],
  lash: [0.22, 0.13, 0.08],
  breathBand: [1000, 1450],
  flutter: [
    { center: [220, 820], radius: [230, 460], amp: 2.4 },
    { center: [820, 700], radius: [200, 420], amp: 2.0 },
  ],
};
export const JESUS_KNEEL: CharacterSpec = {
  src: 'chars/char_jesus_kneel.png',
  size: [1024, 1536],
  breathBand: [500, 900],
  flutter: [{ center: [300, 380], radius: [200, 260], amp: 1.6 }],
};
export const PAIR_REACH: CharacterSpec = {
  src: 'chars/char_adam_eve_reach.png',
  size: [1024, 1536],
  breathBand: [380, 760],
  flutter: [
    { center: [560, 700], radius: [200, 460], amp: 2.6 },
    { center: [300, 120], radius: [170, 120], amp: 1.2 },
  ],
};
export const PAIR_BLAME: CharacterSpec = {
  src: 'chars/char_adam_eve_blame.png',
  line: 'lineart/adam_eve_blame_white.png',
  size: [1536, 1024],
  breathBand: [220, 520],
  flutter: [
    { center: [1170, 380], radius: [230, 360], amp: 2.6 },
    { center: [330, 70], radius: [140, 90], amp: 1.0 },
  ],
};
export const MAN: CharacterSpec = {
  src: 'chars/char_man_point.png',
  size: [1024, 1536],
  breathBand: [420, 760],
  flutter: [{ center: [640, 140], radius: [210, 150], amp: 1.0 }],
};
// the pointing arm of MAN, pivoting at the shoulder. angle < 0 lowers it.
export const manArm = (angle: number) => ({ pivot: [372, 372] as [number, number], center: [175, 280] as [number, number], radius: [250, 150] as [number, number], angle });

// scene lighting presets for characters
export const LOOK: Record<string, Look> = {
  dusk: { tint: [1.04, 0.97, 0.92], lift: [0.02, 0.0, 0.02], sat: 1.0, rim: [1.0, 0.72, 0.4], rimDir: [1, -0.3], rimStrength: 0.75, rimWidth: 8 },
  duskSoft: { tint: [1.0, 0.95, 0.92], lift: [0.03, 0.01, 0.03], sat: 0.95, rim: [1.0, 0.75, 0.45], rimDir: [1, -0.4], rimStrength: 0.5 },
  evening: { tint: [0.62, 0.7, 0.92], lift: [0.0, 0.01, 0.05], sat: 0.75, rim: [0.55, 0.7, 1.0], rimDir: [-0.6, -1], rimStrength: 0.5, rimWidth: 8 },
  godLight: { tint: [0.95, 0.88, 0.82], lift: [0.02, 0.01, 0.0], sat: 0.95, rim: [1.0, 0.85, 0.55], rimDir: [0, -1], rimStrength: 1.1, rimWidth: 10 },
  hurt: { tint: [0.78, 0.8, 0.95], lift: [0.0, 0.0, 0.04], sat: 0.85, rim: [0.75, 0.82, 1.0], rimDir: [-1, -0.2], rimStrength: 0.55 },
  night: { tint: [0.62, 0.68, 0.9], lift: [0.0, 0.0, 0.03], sat: 0.78, rim: [0.55, 0.65, 1.0], rimDir: [1, -0.2], rimStrength: 0.45 },
  moon: { tint: [0.6, 0.68, 0.9], lift: [0.0, 0.01, 0.04], sat: 0.7, rim: [0.75, 0.85, 1.0], rimDir: [1, -1], rimStrength: 0.7, rimWidth: 9 },
  torch: { tint: [0.92, 0.74, 0.6], lift: [0.02, 0.0, 0.02], sat: 0.95, rim: [1.0, 0.62, 0.28], rimDir: [1, 0], rimStrength: 1.0, rimWidth: 10 },
  void: { tint: [0.85, 0.8, 0.78], lift: [0.0, 0.0, 0.0], sat: 0.9, rim: [1.0, 0.8, 0.5], rimDir: [0, -1], rimStrength: 0.8 },
  dawnBack: { tint: [0.2, 0.17, 0.2], lift: [0.03, 0.02, 0.03], sat: 0.6, rim: [1.0, 0.8, 0.55], rimDir: [1, -0.2], rimStrength: 1.6, rimWidth: 14 },
};
