// World layout (metres): x right, y up, z towards the camera. The cutaway face is
// the plane z = 0; the lawn is y = 0. The yard is on the left, the house on the
// right, and the tunnel lies just behind the cut face (z from -W to 0), so the cut
// opens it lengthwise.
//
// Digging is a "dig time" field over the cut face: every point of the cavity knows
// when the dig front reaches it (never dug = NEVER). The soil face, the tunnel's
// back wall, floor and dig faces all read the same field, so the hole grows the
// same way on every surface.
import { T } from './timeline.js';
import { clamp, smooth, easeOutCubic, easeOutBack, prog } from './util.js';

export const NEVER = 200;
export const W = 1.4; // tunnel depth: back wall at z = -W
export const ROOF = -1.3, FLOOR = -2.3; // tunnel ceiling and floor
export const MID = (ROOF + FLOOR) / 2;
export const HALF = (ROOF - FLOOR) / 2;
export const SHAFT = { x0: -4.55, x1: -3.95 }; // entrance shaft in the yard
export const PILE = { x: -5.25, z: -0.55 }; // dirt pile on the lawn, left of the shaft
export const DOGHOUSE = { x0: -1.6, x1: -0.4, z0: -1.25, floor: 0.08, eave: 0.92, ridge: 1.32 };
export const DOG_UP = { x0: -1.3, x1: -0.7 }; // the wrong turn: straight up into the doghouse
export const PATCH = { x0: -1.22, x1: -0.78, z0: -0.86, z1: -0.42 }; // doghouse floorboards that lift
export const HOUSE = {
  x0: 0.6, x1: 5.6, z0: -2.6, // outer walls, back wall
  wall: 0.22, // wall thickness
  slab0: -0.3, slab1: 0.15, floor: 0.18, // concrete slab, tiles on top
  foot: -0.9, // wall footings go down to here
  ceil: 2.8, upper: 3.05, roof0: 5.5, ridge: 7.3,
};
export const KIT = { x0: HOUSE.x0 + HOUSE.wall, x1: HOUSE.x1 - HOUSE.wall }; // kitchen interior
export const KIT_UP = { x0: 3.15, x1: 3.75 }; // up under the kitchen tile
export const TILE = { x0: 3.25, x1: 3.65, z0: -1.25, z1: -0.85, size: 0.4 }; // the trapdoor tile
export const SHELF = { x0: 2.6, x1: 3.9, y: 2.2, z0: -2.6, z1: -2.3 }; // open top shelf on the back wall
export const FRIDGE = { x0: 4.45, x1: 5.3, z0: -2.6, z1: -1.9, h: 1.85 };
export const COUNTER = { x0: 2.3, x1: 4.4, z0: -2.6, z1: -2.0, h: 0.92 };
export const BACKDOOR = { z0: -2.0, z1: -1.1, h: 2.05 }; // in the house's left wall
export const WINDOW = { x0: 0.95, x1: 1.95, y0: 1.1, y1: 2.1 }; // kitchen window, back wall
export const PULLEY = { x: 3.45, y: 2.55, z: -1.05 }; // wheel over the trapdoor
export const ROCK = { x: -1.72, y: -1.72, z: -1.22, r: 0.24 }; // the shovel clangs on it
export const MOM_POS = { x: 4.22, z: -1.28 }; // sits on the floor by the fridge
export const LANTERNS = [{ x: -2.95, t: T.lantern }, { x: 0.55, t: 29.0 }, { x: 2.6, t: 30.15 }];
// mine frames: posts at both sides of the tunnel depth, a beam under the roof
export const FRAMES_A = [-3.72, -3.2, -2.68, -2.16]; // snap in one by one in scene 2
export const FRAMES_B = [-0.25, 0.38, 1.01, 1.64, 2.27, 2.9]; // follow the dig in scene 4

// --- dig fronts --------------------------------------------------------------
// entrance shaft: scoops straight down
export function shaftY(t) {
  let y = 0;
  const step = -FLOOR / T.shaftSteps;
  for (let i = 0; i < T.shaftSteps; i++) y -= step * easeOutCubic(prog(t, T.shaft0 + i * T.shaftStep, 0.24));
  return y;
}
// main tunnel: x of the dig face
const A_STEPS = 11;
const XA1 = -2.1, XA2 = -1.85;
const x0A = SHAFT.x1 - 0.04;
export function tunX(t) {
  let x = SHAFT.x1 - 0.04;
  if (t < T.tunA0) return x;
  if (t < T.tunA1 + 0.3) {
    const gap = (T.tunA1 - T.tunA0) / A_STEPS;
    for (let i = 0; i < A_STEPS; i++) x += ((XA1 - x0A) / A_STEPS) * easeOutCubic(prog(t, T.tunA0 + i * gap, 0.3));
    return x;
  }
  if (t < T.spoon0) return XA1 + (XA2 - XA1) * smooth(prog(t, T.tunA1 + 0.3, T.tunA2 - T.tunA1 - 0.3));
  if (t < T.tunB0) {
    // the spoon: tiny scoops, slow and steady
    const u = prog(t, T.spoon0, T.spoon1 - T.spoon0);
    const n = 26;
    const k = Math.floor(u * n), f = u * n - k;
    return XA2 + ((DOG_UP.x1 - XA2) * (k + smooth(clamp(f * 2.2)))) / n;
  }
  return DOG_UP.x1 + (KIT_UP.x1 + 0.03 - DOG_UP.x1) * smooth(prog(t, T.tunB0, T.tunB1 - T.tunB0));
}
// up into the doghouse: from the roof to the lawn under the doghouse floor
export function dogUpY(t) {
  return ROOF + (0.02 - ROOF) * smooth(prog(t, T.dogUp0, T.dogUp1 - T.dogUp0));
}
// up under the kitchen: from the roof to the bottom of the slab
export function kitUpY(t) {
  return ROOF + (HOUSE.slab0 - ROOF) * smooth(prog(t, T.kitUp0, T.kitUp1 - T.kitUp0));
}

// dirt that falls from the roof in scene 2: small bites out of the roof line
export const CAVES = [
  { x: -3.46, w: 0.36, d: 0.12, t: T.cave0 },
  { x: -2.9, w: 0.3, d: 0.09, t: T.cave0 + 0.45 },
  { x: -2.4, w: 0.34, d: 0.11, t: T.cave0 + 0.85 },
];

// --- dig time over the cut face ----------------------------------------------
// binary search: first t in [t0, t1] where dug(t) is true (dug is monotonic)
function firstTime(dug, t0, t1) {
  if (!dug(t1)) return NEVER;
  if (dug(t0)) return t0;
  for (let i = 0; i < 22; i++) {
    const m = (t0 + t1) / 2;
    if (dug(m)) t1 = m;
    else t0 = m;
  }
  return t1;
}
export function digTime(x, y) {
  let t = NEVER;
  // entrance shaft (its field reaches above the lawn so the opening stays clean)
  if (x >= SHAFT.x0 && x <= SHAFT.x1 && y <= 0.3 && y >= FLOOR - 0.001) {
    t = Math.min(t, firstTime((tt) => y >= shaftY(tt) - 0.001 || y > -0.02, T.shaft0 - 0.01, T.shaft0 + T.shaftSteps * T.shaftStep + 0.4));
  }
  // main tunnel, with a rounded dig face (the middle leads, the corners follow)
  if (x >= SHAFT.x1 - 0.06 && x <= KIT_UP.x1 + 1e-6 && y >= FLOOR && y <= ROOF) {
    const q = (y - MID) / HALF;
    const r = 0.13 * q * q;
    t = Math.min(t, firstTime((tt) => x <= tunX(tt) - r * (x < KIT_UP.x1 - 0.2 ? 1 : 0), T.tunA0 - 0.01, T.tunB1 + 0.3));
  }
  // the wrong turn: up into the doghouse
  if (x >= DOG_UP.x0 && x <= DOG_UP.x1 && y >= ROOF - 0.01 && y <= 0.3) {
    t = Math.min(t, y > 0.02 ? NEVER : firstTime((tt) => y <= dogUpY(tt), T.dogUp0, T.dogUp1 + 0.05));
  }
  // up under the kitchen slab
  if (x >= KIT_UP.x0 && x <= KIT_UP.x1 && y >= ROOF - 0.01 && y <= HOUSE.slab0 + 1e-6) {
    t = Math.min(t, firstTime((tt) => y <= kitUpY(tt), T.kitUp0, T.kitUp1 + 0.05));
  }
  // bites where the roof caves in
  for (const c of CAVES) {
    const u = (x - c.x) / (c.w / 2);
    if (Math.abs(u) < 1 && y > ROOF - 0.01 && y < ROOF + c.d * (1 - u * u) * (0.85 + 0.3 * Math.sin(x * 37.0))) {
      t = Math.min(t, c.t + 0.35 * ((y - ROOF) / c.d));
    }
  }
  return t;
}

// raster of the dig-time field over the tunnel region (for the GPU)
export const DIG_RECT = { x0: -4.7, x1: 3.9, y0: -2.45, y1: 0.35 };
export function digRaster(pxPerM) {
  const { x0, x1, y0, y1 } = DIG_RECT;
  const w = Math.round((x1 - x0) * pxPerM), h = Math.round((y1 - y0) * pxPerM);
  const out = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    const y = y0 + ((j + 0.5) / h) * (y1 - y0);
    for (let i = 0; i < w; i++) {
      const x = x0 + ((i + 0.5) / w) * (x1 - x0);
      // cheap reject: above the roof and outside the shafts
      if (y > ROOF + 0.14 && !(x >= SHAFT.x0 - 0.02 && x <= SHAFT.x1 + 0.02) && !(x >= DOG_UP.x0 - 0.02 && x <= DOG_UP.x1 + 0.02) && !(x >= KIT_UP.x0 - 0.02 && x <= KIT_UP.x1 + 0.02)) {
        out[j * w + i] = NEVER;
        continue;
      }
      out[j * w + i] = digTime(x, y);
    }
  }
  return { data: out, w, h };
}

// shovelfuls: when each scoop of dirt flies (the kid's shovel hits on these)
export const SCOOP_T = (() => {
  const out = [];
  for (let i = 0; i < T.shaftSteps; i++) out.push({ t: T.shaft0 + i * T.shaftStep + 0.08, kind: 'up' });
  for (let i = 0; i < 11; i++) out.push({ t: T.tunA0 + (i * (T.tunA1 - T.tunA0)) / 11 + 0.1, kind: 'side' });
  for (let i = 0; i < 4; i++) out.push({ t: T.tunA1 + 0.9 + i * 1.5, kind: 'side' });
  for (let i = 0; i < 12; i++) out.push({ t: T.tunB0 + 0.1 + (i * (T.tunB1 - T.tunB0 - 0.3)) / 12, kind: 'side' });
  return out;
})();
// tiny spoon scoops (scene 3), matching tunX's spoon steps
export const SPOON_T = (() => {
  const out = [];
  for (let k = 0; k < 26; k++) out.push(T.spoon0 + ((k + 0.25) / 26) * (T.spoon1 - T.spoon0));
  return out;
})();

// the doghouse gag: height of the top of the kid's head in the dog shaft. The
// doghouse floor patch rides on it while it is above the floor (env.js), and the
// kid's head follows it (characters.js).
export const KID_H = 0.95; // kid height, feet to the top of the head
export function dogPopHead(t) {
  const climb = ROOF - 0.35 + KID_H; // standing at the bottom of the shaft
  let y = climb + (0.0 - climb) * smooth(prog(t, T.dogUp0, T.dogUp1 - T.dogUp0));
  if (t >= T.popUp) y = 0.0 + 0.42 * easeOutBack(prog(t, T.popUp, 0.24), 2.2);
  if (t >= T.sink0) y = 0.42 + (-0.12 - 0.42) * smooth(prog(t, T.sink0, T.sink1 - T.sink0));
  if (t >= T.sink1) y = -0.12 + (climb - -0.12) * smooth(prog(t, T.sink1 + 0.1, 0.5));
  return y;
}

// where the kid digs: the dig face, or up a shaft
export function digFace(t) {
  if (t < T.tunA0) return { x: (SHAFT.x0 + SHAFT.x1) / 2, y: shaftY(t), dir: 'down' };
  return { x: tunX(t), y: FLOOR, dir: 'right' };
}
