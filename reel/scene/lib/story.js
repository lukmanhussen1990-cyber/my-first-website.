// The whole film as a pure function of time t (seconds). Every frame can be rendered independently.
import * as THREE from 'three';
import {
  clamp, lerp, smoothstep, smoother, easeInOut, easeOut, easeIn, easeOutBack, popIn, prog, bump, track, mulberry32,
} from './util.js';
import { U } from './materials.js';
import {
  makeSky, makeEnvironment, makeLights, makeGround, makeLawnGrass, makeHouse, makeFence, makeDoghouse, makeBackdrop,
  makeContactShadow, makeSapling, HOUSE_Z, FENCE_X, DOOR_POS,
} from './world.js';
import { makeKid, makeNeighbor, makeGrandpa, makeDog, walkCycle } from './characters.js';
import { makeChest, makeShovel, makePulley, makeBone, makeDetector, makeMound, goldMat } from './props.js';
import { makeFX } from './fx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// ---- layout constants
const HC = 0.15, HX0 = -0.24, HX1 = 0.54, HZB = -0.8;  // hole column
const CZ_BURIED = -0.235;                               // chest centre z when inside the cut
const CHEST_H = 0.34 + 0.22;
const BURIED_Y = -0.92, DEEP_Y = -1.95, DEEPEST_Y = -3.3;
const LAWN_CHEST = V(1.15, 0, -0.42);
const KID_DIG = V(-0.4, 0, -0.4);
const KID_LEFT = V(-0.95, 0, -0.42);
const SHOVEL_PARK = V(-1.45, 0, -0.95);
const MOUND_POS = V(-0.9, 0, -1.55);
const DOG_HOME = V(-2.6, 0, -2.35);
const BONE_LAND = V(-1.95, 0, -4.5);
const NEIGH_X = 2.55;
const GP_SPOT = V(1.2, 0, -0.62);

// dig strokes (contact times) -----------------------------------------------------
const S1_STROKES = [0.45, 1.25, 2.05, 2.62];
const S2_STROKES = [10.85, 11.27, 11.69, 12.11, 12.53, 12.95, 13.37, 13.79];
const FILL_STROKES = [20.45, 20.8, 21.15];
const S4_STROKES = [24.8, 25.3, 25.8, 26.3];

export const SFX_CUES = []; // filled below for the audio script (exported via window.__cues)

export async function buildStory({ renderer, scene, camera }) {
  scene.environment = makeEnvironment(renderer);
  scene.environmentIntensity = 0.6;
  scene.fog = new THREE.Fog(new THREE.Color(0.95, 0.68, 0.48), 22, 85);
  scene.add(makeSky());
  const lights = makeLights(scene);
  const ground = makeGround(); scene.add(ground.group);
  const grass = makeLawnGrass(); scene.add(grass.group);
  const house = makeHouse(); scene.add(house.group);
  scene.add(makeFence());
  scene.add(makeDoghouse());
  scene.add(makeBackdrop());
  const sapling = makeSapling(); sapling.position.set(-0.95, 0, -0.95); sapling.rotation.y = 0.4; scene.add(sapling);

  const kid = makeKid(); scene.add(kid.root);
  const neighbor = makeNeighbor(); scene.add(neighbor.root);
  const grandpa = makeGrandpa(); scene.add(grandpa.root);
  const dog = makeDog(); scene.add(dog.root);
  const shadows = { kid: makeContactShadow(0.3, 0.5), neighbor: makeContactShadow(0.36, 0.4), grandpa: makeContactShadow(0.36, 0.5), dog: makeContactShadow(0.34, 0.45), chest: makeContactShadow(0.5, 0.55) };
  Object.values(shadows).forEach((s) => scene.add(s));

  const chest = makeChest(); scene.add(chest.root);
  const kshovel = makeShovel({ len: 0.46, bladeW: 0.14, bladeH: 0.17, woodHex: [200, 140, 80] }); scene.add(kshovel);
  const gshovel = makeShovel({ len: 0.85, bladeW: 0.19, bladeH: 0.23, woodHex: [150, 104, 62] }); scene.add(gshovel);
  const pulley = makePulley({ x: HC, z: CZ_BURIED, span: 1.3, height: 1.85 }); scene.add(pulley.group);
  const bone = makeBone(1.0); scene.add(bone);
  const det = makeDetector(1.9); scene.add(det.group);
  const mound = makeMound(); scene.add(mound);
  const fx = makeFX(scene);

  // ---------------------------------------------------------------- deterministic FX events
  let seed = 1;
  S1_STROKES.slice(0, 3).forEach((c, i) => {
    fx.dirt(c + 0.0, [HC - 0.05, 0.02, -0.38], [0, 0.6, 0.2], { count: 8, speed: 1.0, spread: 0.6, size: 0.022, seed: seed++ });
    fx.dirt(c + 0.36, [HC - 0.3, 0.42, -0.5], [-0.55, 0.5, -0.65], { count: 12, speed: 1.6, size: 0.03, seed: seed++ });
    fx.dust(c + 0.02, [HC, 0.0, -0.35], { count: 3, size: 0.25, seed: seed++, life: 0.9 });
  });
  fx.dust(2.63, [HC, -0.32, -0.3], { count: 4, size: 0.22, seed: seed++, life: 0.8 });
  [3.1, 3.5, 3.9].forEach((b) => fx.dust(b, [HC, -0.33, -0.3], { count: 3, size: 0.28, radius: 0.3, seed: seed++, rise: 0.35 }));
  fx.dirt(4.35, [HC, -0.5, -0.24], [0.2, 1.0, 0.1], { count: 22, speed: 1.6, spread: 0.7, size: 0.03, seed: seed++ });
  fx.dirt(4.9, [1.0, 0.35, -0.42], [0, -0.2, 0.1], { count: 14, speed: 0.5, spread: 0.9, size: 0.025, seed: seed++ });
  fx.dust(5.2, [LAWN_CHEST.x, 0.0, LAWN_CHEST.z], { count: 7, size: 0.45, radius: 0.45, seed: seed++ });
  fx.dust(9.6, [LAWN_CHEST.x, 0.5, LAWN_CHEST.z], { count: 6, size: 0.35, radius: 0.4, seed: seed++, rise: 0.2 });
  fx.dust(9.45, [0.6, 0.0, -0.42], { count: 3, size: 0.25, seed: seed++ });
  fx.dust(10.0, [KID_DIG.x, 0, KID_DIG.z], { count: 3, size: 0.25, seed: seed++ });
  S2_STROKES.forEach((c, i) => {
    const fl = () => openBottomAt(c);
    fx.dirt(c, [HC, fl() + 0.05, -0.32], [0, 0.5, 0.1], { count: 6, speed: 0.8, spread: 0.8, size: 0.022, seed: seed++, floor: openBottomAt(c) });
    fx.dirt(c + 0.2, [HC - 0.05, Math.max(0.1, fl() + 0.9), -0.4], [-0.55, 0.9, -0.6], { count: 16, speed: 2.4, size: 0.032, seed: seed++ });
  });
  fx.dust(14.35, [0.6, 0, -0.42], { count: 4, size: 0.3, seed: seed++ });
  [16.5, 16.75, 17.0].forEach((p, i) => fx.dust(p, [HC + (i === 0 ? -0.65 : i === 1 ? 0.65 : 0), i === 2 ? 1.85 : 0.0, -0.4], { count: 4, size: 0.35, seed: seed++, color: new THREE.Color(1.0, 0.92, 0.7) }));
  fx.dust(20.0, [HC, DEEP_Y + 0.05, -0.25], { count: 6, size: 0.4, radius: 0.35, seed: seed++ });
  FILL_STROKES.forEach((c) => {
    fx.dirt(c + 0.18, [HC - 0.1, 0.45, -0.38], [0.25, -0.4, 0.1], { count: 22, speed: 1.0, spread: 0.6, size: 0.035, seed: seed++, floor: (x, z) => -0.3 });
    fx.dust(c + 0.4, [HC, 0, -0.35], { count: 3, size: 0.3, seed: seed++ });
  });
  S4_STROKES.forEach((c) => {
    fx.dirt(c, [HC, 0.02, -0.38], [0, 0.6, 0.2], { count: 7, speed: 1.1, size: 0.022, seed: seed++ });
    fx.dirt(c + 0.2, [HC - 0.2, 0.45, -0.45], [-0.6, 0.7, -0.5], { count: 14, speed: 2.0, size: 0.03, seed: seed++ });
  });
  [25.3, 25.8, 26.3, 26.75].forEach((c) => fx.dust(c, [HC, chestYAt(c) + CHEST_H, -0.2], { count: 3, size: 0.3, radius: 0.25, seed: seed++ }));
  for (let i = 0; i < 9; i++) { const c = 31.4 + i * 0.13; fx.dirt(c, [HC + 0.05 + (i % 2 ? 0.06 : -0.06), 0.04, -0.62], [i % 2 ? 0.25 : -0.25, 0.75, -0.75], { count: 6, speed: 1.6, size: 0.022, seed: seed++ }); }
  fx.dust(33.6, [0.1, 0, -1.1], { count: 5, size: 0.35, seed: seed++ });
  fx.dust(34.95, [BONE_LAND.x, 0, BONE_LAND.z], { count: 4, size: 0.4, seed: seed++ });
  fx.dust(33.92, [BONE_LAND.x, 0, BONE_LAND.z], { count: 4, size: 0.4, seed: seed++ });
  [36.45, 36.8].forEach((c) => fx.dust(c, [KID_DIG.x + 0.08, 0.5, KID_DIG.z + 0.18], { count: 4, size: 0.18, radius: 0.12, rise: 0.25, seed: seed++, life: 0.9 }));
  fx.dirt(45.25, [HC + 0.2, 0.05, -0.42], [-0.2, 0.7, 0.2], { count: 10, speed: 1.2, size: 0.025, seed: seed++ });
  fx.dirt(45.4, [HC, 0.05, -0.38], [0, 1.0, 0.15], { count: 40, speed: 2.6, spread: 0.9, size: 0.035, seed: seed++ });
  fx.dust(45.4, [HC, 0.05, -0.38], { count: 8, size: 0.55, radius: 0.5, seed: seed++, rise: 0.5 });
  fx.dust(45.95, [HC, 0, -0.42], { count: 6, size: 0.45, radius: 0.45, seed: seed++ });
  [15.0, 15.45, 15.9, 9.05, 23.4, 49.7].forEach((t0, i) => fx.sweat(t0, i % 2 ? 1 : -1, i));
  fx.bang(2.66, 0.65, () => kidHeadW());
  fx.bang(8.95, 0.7, () => kidHeadW());
  fx.bang(23.25, 0.7, () => kidHeadW());
  fx.bang(46.6, 0.9, () => kidHeadW());
  fx.noteWindow = { t0: 41.95, t1: 45.0, anchor: () => grandpa.head.getWorldPosition(V(0, 0, 0)) };
  const kidHeadW = () => kid.head.getWorldPosition(V(0, 0, 0));

  // ---------------------------------------------------------------- hole + chest timelines
  function strokeDepth(t, strokes, d0, d1, dur = 0.14) {
    let d = d0; const n = strokes.length;
    strokes.forEach((c, i) => { d = lerp(d, d0 + (d1 - d0) * ((i + 1) / n), 0) ; });
    let k = 0; for (const c of strokes) k += smoothstep(c, c + dur, t);
    return d0 + (d1 - d0) * (k / n);
  }
  function openBottomAt(t) {
    if (t < 3.0) return strokeDepth(t, S1_STROKES.slice(0, 3), 0, -0.3) + (t > 2.62 ? -0.06 * smoothstep(2.62, 2.8, t) : 0);
    if (t < 4.3) return -0.36 - 0.04 * smoothstep(3.0, 4.0, t);
    if (t < 10.5) return BURIED_Y;
    if (t < 19.99) return strokeDepth(t, S2_STROKES, BURIED_Y, DEEP_Y);
    if (t < 21.6) {
      const top = DEEP_Y + CHEST_H; // fill from the chest top upwards
      let k = 0; for (const c of FILL_STROKES) k += smoothstep(c + 0.15, c + 0.45, t);
      const v = lerp(top, 0, k / FILL_STROKES.length);
      return v > -0.004 ? 0 : v;
    }
    return 0;
  }
  function holeXAt(t) {
    if (t < 2.95) return [HC - 0.2, HC + 0.2];
    const k = smoothstep(2.95, 3.95, t);
    return [lerp(HC - 0.2, HX0, k), lerp(HC + 0.2, HX1, k)];
  }
  function chestYAt(t) {
    if (t < 20.0) return DEEP_Y;
    let k = 0; for (const c of S4_STROKES) k += smoothstep(c + 0.05, c + 0.45, t);
    return lerp(DEEP_Y, DEEPEST_Y, k / S4_STROKES.length);
  }
  const wheelY = 1.85 - 0.17;
  function chestState(t) {
    const s = { pos: V(HC, BURIED_Y, CZ_BURIED), rx: 0, ry: 0, rz: 0, open: 0, magic: 0, sq: 0, ring: null };
    if (t < 4.25) return s;
    if (t < 5.2) {
      const e = prog(t, 4.25, 5.2); const ee = easeInOut(e);
      s.pos.set(lerp(HC, LAWN_CHEST.x, ee), lerp(BURIED_Y, 0, easeOut(e)) + Math.sin(Math.PI * e) * 0.5 * (e > 0.3 ? 1 : e / 0.3), lerp(CZ_BURIED, LAWN_CHEST.z, ee));
      s.rz = -Math.sin(Math.PI * e) * 0.35; return s;
    }
    // resting on the lawn
    s.pos.copy(LAWN_CHEST);
    s.sq = 0.12 * Math.exp(-10 * Math.max(0, t - 5.2)) * Math.cos((t - 5.2) * 24) * (t >= 5.2 ? 1 : 0);
    if (t < 9.6) {
      const o = smoothstep(5.45, 6.45, t) + Math.sin((t - 5.45) * 30) * 0.03 * bump(t, 5.45, 6.45);
      const slam = smoothstep(9.42, 9.6, t);
      s.open = clamp(o * (1 - slam), 0, 1); s.open = lerp(s.open, 0, easeIn(prog(t, 9.42, 9.6)));
      s.magic = smoothstep(5.9, 6.5, t) * (1 + 1.4 * smoothstep(7.5, 8.2, t));
      return s;
    }
    s.sq += 0.15 * Math.exp(-12 * Math.max(0, t - 9.6)) * Math.cos((t - 9.6) * 30) * (t >= 9.6 ? 1 : 0);
    if (t < 17.9) {
      // straining kid: wobble but no lift
      const w = bump(t, 14.55, 16.25);
      s.rz = Math.sin(t * 38) * 0.035 * w; s.pos.y += Math.max(0, Math.sin(t * 19)) * 0.012 * w;
      return s;
    }
    const swingStart = 18.6, hangY = 0.28;
    if (t < swingStart) { // dragged along the lawn towards the hole
      const e = easeInOut(prog(t, 17.9, swingStart));
      s.pos.set(lerp(LAWN_CHEST.x, HX1 + 0.33, e), 0, lerp(LAWN_CHEST.z, CZ_BURIED, e)); s.rz = Math.sin(t * 40) * 0.01; return s;
    }
    if (t < 19.0) { // swings off the edge and hangs under the wheel
      const e = prog(t, swingStart, 19.0);
      const ang = lerp(0.6, 0, easeOut(e)) + Math.sin(e * 9) * 0.12 * (1 - e);
      const L = wheelY - 0.28 - hangY - CHEST_H + 0.02;
      s.pos.set(HC + Math.sin(ang) * (L + 0.3), lerp(0.0, hangY, easeOut(e)), CZ_BURIED); s.rz = ang * 0.5; return s;
    }
    if (t < 20.0) { // lowered smoothly
      const e = easeInOut(prog(t, 19.0, 20.0));
      s.pos.set(HC + Math.sin((t - 19) * 7) * 0.03 * (1 - e), lerp(hangY, DEEP_Y, e), CZ_BURIED); s.rz = Math.sin((t - 19) * 7) * 0.04 * (1 - e); return s;
    }
    if (t < 45.35) { s.pos.set(HC, chestYAt(t), CZ_BURIED); s.sq = 0.08 * Math.exp(-14 * (t - 20)) * Math.cos((t - 20) * 26); return s; }
    if (t < 45.95) { // grandpa scoops it out in one go
      const e = prog(t, 45.35, 45.95);
      const y = lerp(DEEPEST_Y, 0, e) + Math.sin(Math.PI * e) * 1.15;
      s.pos.set(HC, y, lerp(CZ_BURIED, -0.42, smoothstep(0.2, 0.7, e))); s.rx = -e * Math.PI * 2; return s;
    }
    s.pos.set(HC, 0, -0.42);
    s.sq = 0.16 * Math.exp(-11 * (t - 45.95)) * Math.cos((t - 45.95) * 26);
    s.open = smoothstep(46.3, 46.85, t) * 0.92; s.magic = smoothstep(46.5, 47.0, t) * 1.25;
    return s;
  }

  // ---------------------------------------------------------------- shovel helpers
  function orient(obj, tip, dir, side) {
    const y = dir.clone().normalize(); const z = side.clone().sub(y.clone().multiplyScalar(side.dot(y))).normalize(); const x = new THREE.Vector3().crossVectors(y, z);
    const m = new THREE.Matrix4().makeBasis(x, y, z); obj.quaternion.setFromRotationMatrix(m); obj.position.copy(tip);
  }
  function grips(sh) { const d = sh.userData; const q = sh.quaternion; return { top: d.top.clone().applyQuaternion(q).add(sh.position), mid: d.mid.clone().applyQuaternion(q).add(sh.position) }; }
  // one dig stroke; u in [0,1], contact at u=0.3
  function stroke(u, spot, toDigger, tossDir) {
    const k = [
      [0.0, spot.clone().addScaledVector(UP, 0.26).addScaledVector(toDigger, 0.06), toDigger.clone().multiplyScalar(0.35).add(UP)],
      [0.3, spot.clone().addScaledVector(UP, -0.1), toDigger.clone().multiplyScalar(0.42).add(UP)],
      [0.52, spot.clone().addScaledVector(UP, 0.0).addScaledVector(toDigger, 0.02), toDigger.clone().multiplyScalar(1.05).add(UP)],
      [0.8, spot.clone().addScaledVector(UP, 0.34).addScaledVector(tossDir, 0.22).addScaledVector(toDigger, 0.12), toDigger.clone().multiplyScalar(0.5).add(UP).addScaledVector(tossDir, -0.35)],
      [1.0, spot.clone().addScaledVector(UP, 0.26).addScaledVector(toDigger, 0.06), toDigger.clone().multiplyScalar(0.35).add(UP)],
    ];
    let i = 0; while (i < k.length - 2 && u > k[i + 1][0]) i++;
    const e = smoother((u - k[i][0]) / (k[i + 1][0] - k[i][0]));
    return { tip: k[i][1].clone().lerp(k[i + 1][1], e), dir: k[i][2].clone().lerp(k[i + 1][2], e).normalize(), load: u > 0.38 && u < 0.8, lean: Math.sin(clamp(u / 0.55, 0, 1) * Math.PI) };
  }
  function strokeAt(t, strokes, period) {
    for (const c of strokes) { const s0 = c - 0.3 * period; if (t >= s0 && t < s0 + period) return (t - s0) / period; }
    return -1;
  }

  // ---------------------------------------------------------------- KID
  const kidE = { smile: 0.55, open: 0, eyeOpen: 1, browUp: 0, browAngle: 0, gaze: null, wide: 1, teeth: 0 };
  function blink(t, off = 0) { const p = ((t + off) % 3.7); return p < 0.12 ? 1 - Math.sin(p / 0.12 * Math.PI) * 0.95 : 1; }
  function kidPose(t) {
    const p = { x: KID_DIG.x, z: KID_DIG.z, yaw: 1.05, expr: { ...kidE, eyeOpen: blink(t) }, crouch: 0, lean: 0 };
    const chestS = chestState(t);
    let sh = null; // shovel placement {tip, dir, side}
    let holding = false, load = false;
    const toKid = V(-1, 0, 0);
    const parkShovel = () => ({ tip: SHOVEL_PARK.clone().add(V(0, -0.1, 0)), dir: V(0.15, 1, 0.1).normalize(), side: V(0, 0, 1) });
    const gazeChest = () => chestS.pos.clone().add(V(0, 0.3, 0));
    if (t < 2.9) {
      // ---- S1 digging the little plant hole
      const spot = V(HC - 0.04, openBottomAt(t), -0.36);
      let u = strokeAt(t, S1_STROKES, 0.8);
      if (t > 2.62 - 0.24 && t < 2.62) u = 0.3 * prog(t, 2.38, 2.62);
      if (t >= 2.62) u = 0.3 - 0.12 * Math.exp(-8 * (t - 2.62)) * Math.abs(Math.sin((t - 2.62) * 40));
      if (u < 0) u = 0;
      const s = stroke(u, spot, V(-0.92, 0, -0.1).normalize(), V(-0.6, 0, -0.8).normalize());
      sh = { tip: s.tip, dir: s.dir, side: V(0, 0, 1) }; holding = true; load = s.load;
      p.lean = 0.25 + s.lean * 0.25; p.crouch = 0.05 + s.lean * 0.06; p.expr.gaze = spot.clone();
      p.expr.smile = 0.6; p.headPitch = 0.3;
      if (t > 2.62) { const k = smoothstep(2.62, 2.75, t); p.expr.browUp = k; p.expr.eyeOpen = 1 + 0.2 * k; p.expr.open = 0.35 * k; p.expr.smile = lerp(0.6, 0.1, k); p.lean -= 0.12 * k; }
    } else if (t < 4.25) {
      // ---- kneel and brush the dirt away
      const k = smoothstep(2.9, 3.05, t);
      if (t < 3.05) { sh = { tip: SHOVEL_PARK.clone().lerp(V(-0.6, 0.5, -0.5), 1 - k), dir: V(0.15, 1, 0.1).normalize(), side: V(0, 0, 1) }; sh.tip.y = lerp(0.4, -0.1, k); }
      else sh = parkShovel();
      p.crouch = 0.42 * k; p.lean = 0.55 * k; p.yaw = 1.2;
      const b = (t - 3.0) / 0.4; const phase = (b % 1);
      const sweepX = lerp(HC - 0.28, HC + 0.12, Math.sin(phase * Math.PI));
      p.handR = V(sweepX, -0.18 - 0.12 * k, -0.3);
      p.handL = V(HC - 0.3, 0.02, -0.55);
      p.expr.gaze = V(HC, -0.35, -0.3); p.expr.browUp = 0.6; p.expr.open = 0.2; p.expr.smile = 0.3; p.headPitch = 0.45;
      if (t > 4.0) { const g = smoothstep(4.0, 4.25, t); p.handL = p.handL.lerp(chestS.pos.clone().add(V(-0.36, 0.25, 0)), g); p.handR = p.handR.lerp(chestS.pos.clone().add(V(0.1, 0.5, 0.15)), g); }
    } else if (t < 5.25) {
      // ---- heave the chest out and fling it onto the lawn
      sh = parkShovel();
      const e = prog(t, 4.25, 5.2);
      p.crouch = lerp(0.42, 0.0, easeOut(prog(t, 4.25, 4.7))); p.lean = lerp(0.55, -0.25, easeOut(prog(t, 4.25, 4.75))); p.yaw = 1.2;
      const hold = 1 - smoothstep(0.35, 0.55, e);
      const cp = chestS.pos.clone();
      p.handL = cp.clone().add(V(-0.36, 0.25, 0)).lerp(V(-0.2, 1.05, -0.4), 1 - hold);
      p.handR = cp.clone().add(V(-0.3, 0.3, 0.2)).lerp(V(0.05, 1.0, -0.3), 1 - hold);
      p.expr.open = 0.5; p.expr.wide = 1.3; p.expr.teeth = 1; p.expr.eyeOpen = 0.35; p.expr.smile = 0.1; p.expr.browAngle = 0.3;
      p.bob = Math.sin(e * Math.PI) * 0.05;
    } else if (t < 9.0) {
      // ---- lid creaks open, golden light, amazed
      sh = parkShovel();
      const k = smoothstep(5.9, 6.6, t);
      p.yaw = lerp(1.2, 0.95, smoothstep(5.3, 6.0, t)); p.lean = lerp(-0.25, 0.08, smoothstep(5.2, 5.6, t)) + 0.08 * k;
      p.expr.gaze = gazeChest(); p.expr.open = lerp(0.15, 0.85, k); p.expr.wide = lerp(1, 0.75, k); p.expr.smile = lerp(0.3, 0.55, k); p.expr.eyeOpen = 1 + 0.25 * k; p.expr.browUp = 1.1 * k; p.expr.pupil = 1 + 0.25 * k;
      // hands up to cheeks in awe
      const hs = smoothstep(6.1, 6.6, t);
      if (hs > 0) { const hw = kid.head.localToWorld(V(-0.22, -0.12, 0.12)), hw2 = kid.head.localToWorld(V(0.22, -0.12, 0.12)); p.handL = hs > 0.01 ? hw : null; p.handR = hw2; }
      // beams: look up into the sky
      const up = smoothstep(7.7, 8.4, t);
      p.headPitch = -0.55 * up; p.expr.gaze = up > 0.5 ? kid.head.localToWorld(V(0.2, 3, 2)) : p.expr.gaze;
      if (t > 8.85) { const pk = smoothstep(8.85, 9.0, t); p.expr.open = 0.75; p.expr.wide = 1.5; p.expr.teeth = 1; p.expr.smile = lerp(0.55, -0.2, pk); p.expr.browAngle = -0.35 * pk; p.expr.browUp = 1.2; p.headPitch = lerp(p.headPitch, 0.1, pk); }
    } else if (t < 9.75) {
      // ---- panic: jump over the hole and SLAM the lid
      sh = parkShovel();
      const e = prog(t, 9.05, 9.45);
      const from = KID_DIG, to = V(HX1 + 0.08, 0, -0.42);
      p.x = lerp(from.x, to.x, easeInOut(e)); p.z = lerp(from.z, to.z, easeInOut(e)); p.y = Math.sin(Math.PI * e) * 0.38;
      p.yaw = 1.3; p.crouch = t < 9.05 ? 0.15 * prog(t, 9.0, 9.05) : (t < 9.45 ? 0.05 : 0.25 * bump(t, 9.45, 9.7));
      p.lean = t < 9.45 ? 0.2 : 0.5 * smoothstep(9.45, 9.58, t);
      const lidTop = LAWN_CHEST.clone().add(V(-0.12, 0.62, 0.1));
      if (t > 9.4) { const s = smoothstep(9.4, 9.58, t); p.handL = lidTop.clone().add(V(0, 0.3 * (1 - s), -0.1)); p.handR = lidTop.clone().add(V(0.1, 0.3 * (1 - s), 0.12)); }
      else { p.handL = kid.spine.localToWorld(V(-0.25, 0.55, 0.05)); p.handR = kid.spine.localToWorld(V(0.25, 0.55, 0.05)); }
      p.expr.open = 0.7; p.expr.wide = 1.5; p.expr.teeth = 1; p.expr.smile = -0.25; p.expr.browAngle = -0.35; p.expr.browUp = 1; p.expr.eyeOpen = 1.2;
      p.expr.gaze = LAWN_CHEST.clone().add(V(0, 0.4, 0));
    } else if (t < 14.4) {
      // ---- back over the hole, grab the shovel, jump in and dig a deep hole
      if (t < 10.1) {
        const e = prog(t, 9.75, 10.1); const from = V(HX1 + 0.08, 0, -0.42), to = KID_LEFT;
        p.x = lerp(from.x, to.x, easeInOut(e)); p.z = lerp(from.z, to.z, easeInOut(e)); p.y = Math.sin(Math.PI * e) * 0.4; p.yaw = -1.2; sh = parkShovel();
        p.crouch = 0.1; p.expr.open = 0.5; p.expr.wide = 1.3; p.expr.teeth = 1; p.expr.smile = -0.1; p.expr.browAngle = -0.3;
      } else if (t < 10.35) {
        p.x = KID_LEFT.x; p.z = KID_LEFT.z; p.yaw = lerp(-1.2, -2.2, smoothstep(10.1, 10.2, t)); sh = parkShovel();
        const g = grips(shovelPlace(sh)); p.handR = g.top; p.handL = g.mid; p.lean = 0.25; p.crouch = 0.1;
        p.expr.smile = 0.2; p.expr.browAngle = -0.25; p.expr.open = 0.1;
      } else if (t < 10.6) {
        const e = prog(t, 10.35, 10.6); p.x = lerp(KID_LEFT.x, HC, easeInOut(e)); p.z = lerp(KID_LEFT.z, -0.36, easeInOut(e));
        p.y = lerp(0, BURIED_Y, easeIn(e)) + Math.sin(Math.PI * e) * 0.35; p.yaw = lerp(-2.2, 0.55, e); holding = true;
        sh = { tip: kid.root.position.clone().add(V(0.15, 0.1, 0.18)), dir: V(-0.2, 1, 0.1).normalize(), side: V(0, 0, 1) };
        p.expr.smile = 0.3; p.expr.browAngle = -0.3;
      } else {
        // in the hole
        const floor = openBottomAt(t);
        const u = Math.max(0, strokeAt(t, S2_STROKES, 0.42));
        const exitE = prog(t, 13.95, 14.35);
        p.x = lerp(HC - 0.08, HX1 + 0.08, easeInOut(exitE)); p.z = lerp(-0.36, -0.42, exitE);
        p.y = lerp(floor, 0, easeOut(exitE)) + Math.sin(Math.PI * exitE) * 0.6; p.yaw = lerp(0.55, 1.3, exitE);
        const spot = V(HC + 0.12, floor, -0.22);
        const s = stroke(u, spot, V(-0.6, 0, -0.5).normalize(), V(-0.7, 0, -0.7).normalize());
        // the toss has to clear the hole: lift it a lot
        s.tip.y += Math.sin(clamp((u - 0.55) / 0.35, 0, 1) * Math.PI) * 0.35;
        sh = { tip: s.tip, dir: s.dir, side: V(0, 0, 1) }; holding = true; load = s.load;
        if (exitE > 0) { sh = { tip: kid.root.position.clone().add(V(-0.3, 0.2, 0.1)), dir: V(-0.5, 1, 0).normalize(), side: V(0, 0, 1) }; }
        p.lean = 0.3 + s.lean * 0.25; p.crouch = 0.08 + s.lean * 0.08;
        p.expr.smile = 0.25; p.expr.browAngle = -0.35; p.expr.open = 0.25 + 0.2 * s.lean; p.expr.wide = 1.2; p.expr.teeth = 0.7; p.expr.gaze = spot;
        p.headPitch = 0.2;
      }
    } else if (t < 16.6) {
      // ---- try to lift the chest: too heavy!
      p.x = HX1 + 0.1; p.z = -0.42; p.yaw = 1.45;
      const st = bump(t, 14.5, 16.3);
      const shake = Math.sin(t * 41) * 0.012 * st;
      p.crouch = 0.22 * smoothstep(14.4, 14.6, t) * (1 - smoothstep(16.2, 16.35, t)); p.lean = 0.25 - 0.32 * st; p.x += shake; p.headPitch = 0.1;
      p.handL = chestState(t).pos.clone().add(V(-0.38, 0.22, 0.12)); p.handR = chestState(t).pos.clone().add(V(-0.38, 0.22, -0.12));
      p.handLPole = V(p.x - 0.5, 0.3, 0.6); p.handRPole = V(p.x - 0.5, 0.3, -1.2);
      p.expr.eyeOpen = 0.12 + 0.88 * (1 - st); p.expr.open = 0.55 * st; p.expr.wide = 1.6; p.expr.teeth = 1; p.expr.smile = -0.15; p.expr.browAngle = -0.45 * st; p.headPitch = 0.1 - 0.2 * st;
      p.squash = 0.04 * st * Math.max(0, Math.sin(t * 19));
      sh = { tip: SHOVEL_PARK.clone().add(V(0, -0.1, 0)), dir: V(0.15, 1, 0.1).normalize(), side: V(0, 0, 1) };
      if (t > 16.25) { // give up and hop back over the hole
        const e = prog(t, 16.25, 16.6); p.handL = null; p.handR = null;
        p.x = lerp(HX1 + 0.1, KID_LEFT.x, easeInOut(e)); p.y = Math.sin(Math.PI * e) * 0.38; p.yaw = lerp(1.45, 0.6, e); p.crouch = 0.05; p.lean = 0.1;
        p.expr = { ...kidE, smile: 0.0, open: 0.2, browAngle: 0.25, browUp: 0.3, eyeOpen: 0.85 };
      }
    } else if (t < 20.25) {
      // ---- the pulley: pull the rope, then let it out slowly
      p.x = KID_LEFT.x - 0.1; p.z = KID_LEFT.z + 0.05; p.yaw = 1.0;
      sh = parkShovel();
      const pulling = smoothstep(17.85, 18.1, t) * (1 - smoothstep(18.9, 19.1, t));
      const feeding = smoothstep(19.0, 19.2, t) * (1 - smoothstep(19.95, 20.1, t));
      const hand = (k) => V(p.x + 0.32 - 0.1 * pulling + 0.08 * feeding + Math.sin(t * 16) * 0.03 * pulling * k, 0.62 + 0.05 * k, p.z + 0.04 * k);
      if (t > 17.55) { p.handR = hand(1); p.handL = hand(-1).add(V(-0.08, -0.06, 0)); }
      p.lean = -0.28 * pulling + 0.05 * feeding; p.crouch = 0.12 * pulling;
      p.expr.smile = lerp(0.2, 0.75, smoothstep(17.0, 17.6, t)); p.expr.browUp = 0.5; p.expr.gaze = chestState(t).pos.clone().add(V(0, 0.4, 0));
      if (pulling > 0.1) { p.expr.teeth = 1; p.expr.open = 0.3; p.expr.wide = 1.4; p.expr.eyeOpen = 0.6; }
      p.headPitch = 0.1 + 0.25 * feeding;
    } else if (t < 21.6) {
      // ---- fill the hole back in from the mound
      p.x = KID_LEFT.x + 0.3; p.z = KID_LEFT.z; p.yaw = 1.1;
      if (t < 20.3) { sh = parkShovel(); const g = grips(shovelPlace(sh)); p.handR = g.top; p.handL = g.mid; p.yaw = -1.5; }
      else {
        const u = Math.max(0, strokeAt(t, FILL_STROKES.map((c) => c - 0.1), 0.36));
        // scoop at the mound, dump into the hole
        const a = smoother(clamp((u - 0.1) / 0.6, 0, 1));
        const tip = V(lerp(MOUND_POS.x + 0.25, HC - 0.1, a), 0.05 + Math.sin(a * Math.PI) * 0.35, lerp(MOUND_POS.z + 0.3, -0.38, a));
        const dir = V(lerp(0.3, -0.8, a), 1, lerp(0.5, -0.2, a)).normalize();
        sh = { tip, dir, side: V(0, 0, 1) }; holding = true; load = a > 0.05 && a < 0.85;
        p.yaw = lerp(-0.6, 1.2, a); p.lean = 0.3;
      }
      p.expr.smile = 0.7; p.expr.gaze = V(HC, 0, -0.4);
    } else if (t < 29.0) {
      // ---- the neighbour and his metal detector
      p.x = KID_LEFT.x + 0.35; p.z = KID_LEFT.z; p.yaw = 0.5;
      const notice = smoothstep(23.1, 23.3, t);
      const u = strokeAt(t, S4_STROKES, 0.5);
      if (u >= 0) {
        const s = stroke(u, V(HC - 0.05, 0, -0.38), V(-0.92, 0, -0.1).normalize(), V(-0.7, 0, -0.7).normalize());
        sh = { tip: s.tip, dir: s.dir, side: V(0, 0, 1) }; load = s.load; p.lean = 0.3 + s.lean * 0.3; p.yaw = 1.0;
        p.expr.teeth = 1; p.expr.open = 0.35; p.expr.wide = 1.4; p.expr.browAngle = -0.4; p.expr.smile = 0.1;
      } else {
        sh = { tip: V(p.x + 0.28, -0.08, p.z + 0.12), dir: V(-0.1, 1, 0.05).normalize(), side: V(0, 0, 1) };
        const g0 = t < 24.5 ? 0 : 1;
        p.expr.gaze = notice > 0.5 && t < 27.6 ? neighbor.head.getWorldPosition(V(0, 0, 0)) : null;
        p.headYaw = 0.5 * notice * (t < 27.8 ? 1 : 0);
        if (notice > 0 && t < 24.6) { p.expr.eyeOpen = 1.2; p.expr.open = 0.5; p.expr.smile = -0.1; p.expr.browUp = 1; p.expr.wide = 0.8; }
        if (t > 26.6) { const r = smoothstep(26.9, 27.3, t); p.expr.smile = lerp(0.2, 0.85, r); p.expr.eyeOpen = lerp(1, 0.5, r); p.expr.browUp = 0.3 * r; }
      }
      holding = true;
      if (t > 28.6) { const k = smoothstep(28.6, 28.95, t); sh = { tip: sh.tip.clone().lerp(SHOVEL_PARK.clone().add(V(0, -0.1, 0)), k), dir: sh.dir.clone().lerp(V(0.15, 1, 0.1), k).normalize(), side: V(0, 0, 1) }; holding = k < 0.95; p.yaw = lerp(0.5, -0.8, k); }
    } else if (t < 36.0) {
      // ---- the dog and the bone
      p.x = KID_LEFT.x - 0.25; p.z = KID_LEFT.z; p.yaw = 0.7; sh = parkShovel();
      p.expr.gaze = dog.head.getWorldPosition(V(0, 0, 0));
      const worry = smoothstep(30.2, 30.5, t) * (1 - smoothstep(32.2, 32.4, t));
      p.expr.browAngle = -0.3 * worry; p.expr.smile = lerp(0.5, -0.05, worry); p.expr.open = 0.25 * worry;
      if (t > 32.15) {
        const wind = smoothstep(32.3, 32.75, t), thr = smoothstep(32.75, 32.85, t);
        p.yaw = lerp(0.7, -0.4, wind);
        p.handR = kid.spine.localToWorld(V(0.18 - 0.1 * wind, 0.45 + 0.35 * wind, -0.1 - 0.25 * wind + 0.6 * thr));
        if (thr > 0) p.handR = kid.spine.localToWorld(V(-0.1, 0.8, 0.5));
        p.lean = -0.15 * wind + 0.3 * thr * (1 - smoothstep(33.2, 33.6, t));
        p.expr.smile = 0.9; p.expr.eyeOpen = 0.6; p.expr.browAngle = 0.2; p.expr.open = 0.1;
        if (t > 32.85) p.expr.gaze = boneState(t).pos;
      }
    } else {
      // ---- S6/S7: perfectly hidden ... and grandpa
      p.x = KID_DIG.x - 0.45; p.z = KID_DIG.z - 0.02; p.yaw = 0.45; sh = parkShovel();
      // dust off hands
      const c1 = bump(t, 36.25, 36.6), c2 = bump(t, 36.6, 36.95);
      const clap = Math.max(c1, c2);
      const front = kid.spine.localToWorld(V(0, 0.42, 0.28));
      if (t < 37.0) { p.handL = front.clone().add(V(-0.04 - 0.1 * (1 - clap), 0, 0)); p.handR = front.clone().add(V(0.04 + 0.1 * (1 - clap), 0.02 * clap, 0)); }
      const hips = smoothstep(37.0, 37.35, t);
      if (hips > 0) { p.handL = kid.spine.localToWorld(V(-0.2, 0.08, 0.06)); p.handR = kid.spine.localToWorld(V(0.2, 0.08, 0.06)); p.handLPole = kid.spine.localToWorld(V(-0.8, 0.2, -0.4)); p.handRPole = kid.spine.localToWorld(V(0.8, 0.2, -0.4)); }
      p.lean = -0.12 * hips; p.expr.smile = 0.95; p.expr.eyeOpen = lerp(0.9, 0.35, hips); p.expr.browUp = 0.3; p.headPitch = -0.12 * hips;
      if (t > 43.3) {
        const look = smoothstep(43.3, 43.8, t);
        p.expr.gaze = grandpa.head.getWorldPosition(V(0, 0, 0)); p.headYaw = 0.6 * look; p.expr.eyeOpen = lerp(0.35, 1.0, look); p.expr.smile = lerp(0.95, 0.15, look);
        p.expr.browUp = 0.4 * look; p.expr.open = 0.2 * look;
        if (t > 44.0) { p.handL = null; p.handR = null; }
      }
      if (t > 45.3) {
        const k = smoothstep(45.3, 45.5, t); p.expr.gaze = chestState(t).pos.clone().add(V(0, 0.2, 0)); p.headYaw = lerp(p.headYaw, 0.35, k);
        p.expr.eyeOpen = 1.25; p.expr.open = 0.85 * k; p.expr.wide = 0.9; p.expr.smile = -0.1; p.expr.browUp = 1.2; p.expr.pupil = 0.7; p.lean = -0.15 * k;
      }
      if (t > 46.85) { const k = smoothstep(46.85, 47.2, t); p.expr.gaze = grandpa.head.getWorldPosition(V(0, 0, 0)); p.headYaw = 0.55; p.expr.open = lerp(0.85, 1.0, k); p.expr.wide = 0.85; p.squash = -0.02 * k; }
    }
    if (sh) { shovelPlace(sh); if (holding) { const g = grips(kshovel); p.handR = p.handR || g.top; p.handL = p.handL || g.mid; } kshovel.userData.clump.visible = load; }
    return p;
  }
  function shovelPlace(s) { orient(kshovel, s.tip, s.dir, s.side); kshovel.updateMatrixWorld(); return kshovel; }

  // ---------------------------------------------------------------- BONE
  function boneState(t) {
    const s = { pos: V(0, -5, 0), rot: 0, visible: false };
    if (t < 32.15) return s;
    if (t < 32.85) { s.visible = true; s.pos = kid.arms[1].hand.getWorldPosition(V(0, 0, 0)); s.scale = popIn(prog(t, 32.15, 32.45)); return s; }
    const e = prog(t, 32.85, 33.9); const from = V(-1.25, 1.1, -0.3);
    s.visible = true; s.scale = 1;
    s.pos = from.clone().lerp(BONE_LAND, e); s.pos.y = lerp(from.y, 0.05, e) + Math.sin(Math.PI * e) * 2.2; s.rot = e * 14;
    if (t >= 33.9) { s.pos = BONE_LAND.clone().add(V(0, 0.05, 0)); s.rot = 0; }
    if (t > 34.95) { s.pos = dog.head.localToWorld(V(0, -0.08, 0.2)); s.rot = 0; }
    return s;
  }

  // ---------------------------------------------------------------- DOG
  function dogPose(t) {
    const p = { x: DOG_HOME.x, z: DOG_HOME.z, yaw: 0.6, t, wag: 0.4, walk: 0, run: 0, phase: 0, headPitch: 0, headYaw: 0 };
    if (t < 28.9) { p.x = -2.75; p.z = -2.45; p.yaw = 0.35; p.pitch = 0; p.bob = -0.12; p.wag = 0.25; p.headPitch = 0.15; p.tongue = 1; p.y = 0; return p; } // lying by the doghouse
    if (t < 30.0) {
      const e = prog(t, 28.9, 30.0); const a = V(-2.75, 0, -2.45), b = V(HC + 0.05, 0, -1.05);
      const ee = easeInOut(e); p.x = lerp(a.x, b.x, ee); p.z = lerp(a.z, b.z, ee); p.yaw = lerp(Math.atan2(b.x - a.x, b.z - a.z), 0.0, smoothstep(0.75, 1, e));
      p.walk = 1; p.phase = (t - 28.9) * 15; p.wag = 0.6; return p;
    }
    p.x = HC + 0.05; p.z = -1.05; p.yaw = 0;
    if (t < 31.35) { p.headPitch = 0.55; p.headYaw = Math.sin(t * 9) * 0.12; p.pitch = 0.18; p.wag = 0.9; p.wagSpeed = 18; p.bob = -0.03 + Math.sin(t * 40) * 0.005; p.tongue = 0; return p; }
    if (t < 33.0) { p.frontDig = smoothstep(31.35, 31.5, t) * (1 - smoothstep(32.55, 32.7, t)); p.phase = t * 9; p.pitch = 0.3 * p.frontDig; p.headPitch = 0.4; p.wag = 1; p.wagSpeed = 20; p.tongue = 1; return p; }
    if (t < 33.55) {
      const b = boneState(t); const look = b.pos.clone(); const d = look.sub(V(p.x, 0.6, p.z));
      p.headYaw = clamp(Math.atan2(d.x, d.z), -1.2, 1.2) * 0.7; p.headPitch = -0.35; p.wag = 1.2; p.wagSpeed = 24; p.earFlop = 0.6;
      p.squash = t > 33.38 && t < 33.55 ? -0.06 * bump(t, 33.38, 33.55) : 0; p.tongue = 1; return p;
    }
    if (t < 35.0) {
      const e = prog(t, 33.55, 35.0); const a = V(p.x, 0, p.z), b = BONE_LAND.clone().add(V(0.3, 0, 0.35));
      const ee = easeInOut(e); p.x = lerp(a.x, b.x, ee); p.z = lerp(a.z, b.z, ee); p.yaw = Math.atan2(b.x - a.x, b.z - a.z);
      p.run = 1; p.phase = (t - 33.55) * 22; p.wag = 1; p.earFlop = 0.8; return p;
    }
    // happily chewing the bone over there
    const b = BONE_LAND.clone().add(V(0.3, 0, 0.35));
    p.x = b.x; p.z = b.z; p.yaw = lerp(Math.atan2(b.x - HC, b.z + 1.05) + Math.PI, 0.7, smoothstep(35.0, 35.4, t)); p.bob = -0.1 * smoothstep(35.0, 35.4, t);
    p.headPitch = 0.25 + Math.sin(t * 7) * 0.08; p.wag = 0.8; p.wagSpeed = 12;
    return p;
  }

  // ---------------------------------------------------------------- NEIGHBOUR
  function neighborPose(t) {
    const p = { x: NEIGH_X, z: -3.0, yaw: 0, expr: { smile: 0.4, eyeOpen: blink(t, 1.3), browUp: 0.3 }, visible: t > 21.2 && t < 29.8 };
    let grip, coil;
    const walkIn = prog(t, 21.3, 22.75);
    if (t < 22.75) {
      p.z = lerp(-2.7, -0.75, walkIn); p.yaw = 0;
      Object.assign(p, walkCycle(V(p.x, 0, p.z), 0, (t - 21.3) * 8.5, { stride: 0.42, lift: 0.1, footH: 0.06, width: 0.12 }));
      grip = neighbor.spine.localToWorld(V(0.05, 0.35, 0.35)); coil = V(p.x - 0.1 + Math.sin(t * 3) * 0.3, 0.07, p.z + 0.9);
      p.expr.gaze = coil.clone();
    } else if (t < 27.9) {
      p.z = -0.75; p.yaw = -0.85;
      const reach = smoothstep(22.75, 23.05, t);
      p.lean = 0.25 * reach; p.side = 0.1 * reach;
      const sweep = Math.sin((t - 22.9) * 2.6) * 0.14;
      coil = V(lerp(p.x - 0.4, 0.95 + sweep, reach), lerp(0.07, 0.1, reach), lerp(p.z + 0.6, -0.42, reach));
      grip = V(lerp(p.x - 0.1, 2.35, reach), lerp(0.85, 1.45, reach), lerp(p.z + 0.25, -0.55, reach));
      p.expr.gaze = coil.clone(); p.headPitch = 0.25 * reach;
      const beepEx = smoothstep(23.0, 23.3, t) * (1 - smoothstep(26.8, 27.1, t));
      p.expr.browUp = 0.3 + 0.9 * beepEx; p.expr.eyeOpen = 1 + 0.2 * beepEx; p.expr.smile = lerp(0.4, 0.75, beepEx); p.expr.open = 0.2 * beepEx;
      if (t > 27.0) { const c = smoothstep(27.0, 27.3, t); p.expr.smile = lerp(0.75, 0.15, c); p.expr.browAngle = 0.35 * c; p.expr.open = 0; }
      // shrug
      const sh = bump(t, 27.3, 27.95);
      if (sh > 0.01) { p.headRoll = 0.25 * sh; p.side = 0.05; p.expr.browUp = 1.0 * sh; p.expr.browAngle = 0.4; }
      p._shrug = sh;
    } else {
      const e = prog(t, 27.95, 29.6);
      p.yaw = lerp(-0.85, Math.PI, smoothstep(0, 0.25, e)); p.z = lerp(-0.75, -3.4, smoothstep(0.15, 1, e));
      Object.assign(p, walkCycle(V(p.x, 0, p.z), p.yaw, (t - 27.95) * 8, { stride: 0.4, lift: 0.09, footH: 0.06, width: 0.12 }));
      grip = neighbor.spine.localToWorld(V(0.1, 0.32, 0.3)); coil = grip.clone().add(V(0.0, -1.35, 0)).add(new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)).multiplyScalar(1.1));
      p.expr.smile = 0.3; p.expr.browAngle = 0.3;
    }
    p.grip = grip; p.coil = coil;
    return p;
  }

  // ---------------------------------------------------------------- GRANDPA
  function grandpaPose(t) {
    const p = { x: DOOR_POS.x, z: HOUSE_Z - 0.3, yaw: 0, expr: { smile: 0.75, eyeOpen: blink(t, 2.1) * 0.75, browUp: 0.2 }, lean: 0.12, visible: t > 41.55 };
    const start = V(DOOR_POS.x + 0.1, 0, HOUSE_Z + 0.25);
    let sh;
    if (t < 44.9) {
      const e = prog(t, 41.7, 44.9);
      const ee = smoothstep(0, 1, e) * 0.15 + e * 0.85;
      p.x = lerp(start.x, GP_SPOT.x, ee); p.z = lerp(start.z, GP_SPOT.z, ee);
      p.yaw = Math.atan2(GP_SPOT.x - start.x, GP_SPOT.z - start.z);
      if (t < 41.7) { p.z = HOUSE_Z - 0.2 + (t - 41.55) * 3; }
      Object.assign(p, walkCycle(V(p.x, 0, p.z), p.yaw, (t - 41.7) * 9.5, { stride: 0.36, lift: 0.08, footH: 0.06, width: 0.11 }));
      p.bob += Math.sin((t - 41.7) * 9.5 * 2) * 0.012; p.headRoll = Math.sin((t - 41.7) * 4.75) * 0.1; p.headYaw = Math.sin((t - 41.7) * 2) * 0.1;
      // shovel over the right shoulder
      const shoulder = grandpa.spine.localToWorld(V(0.24, 0.52, 0.0));
      const back = grandpa.spine.localToWorld(V(0.32, -0.25, -0.75));
      sh = { tip: back, dir: shoulder.clone().sub(back).normalize(), side: V(1, 0, 0) };
      p.expr.smile = 0.9; p.expr.eyeOpen = 0.45; p.expr.open = 0.06 + 0.06 * Math.sin(t * 6);
    } else {
      p.x = GP_SPOT.x; p.z = GP_SPOT.z; const turn = smoothstep(44.9, 45.1, t);
      p.yaw = lerp(Math.atan2(GP_SPOT.x - start.x, GP_SPOT.z - start.z), -1.25, turn);
      // one easy scoop
      const spot = V(HC + 0.24, 0, -0.42);
      if (t < 45.7) {
        const u = clamp((t - (45.25 - 0.3 * 0.7)) / 0.7, 0, 1);
        const s = stroke(u, spot, V(1, 0, -0.2).normalize(), V(-0.2, 0.0, 0.3).normalize());
        sh = { tip: s.tip, dir: s.dir, side: V(0, 0, 1) }; p.lean = 0.15 + s.lean * 0.3;
        if (t < 45.1) { const k = turn; sh.tip = sh.tip.clone().lerp(grandpa.spine.localToWorld(V(0.32, -0.25, -0.75)), 1 - k); }
      } else {
        // rest on the shovel, open the lid, smile at the kid
        sh = { tip: V(GP_SPOT.x + 0.05, -0.05, GP_SPOT.z + 0.35), dir: V(-0.05, 1, 0.08).normalize(), side: V(1, 0, 0) };
        const open = smoothstep(46.15, 46.4, t) * (1 - smoothstep(46.85, 47.1, t));
        p.lean = 0.12 + 0.3 * open;
        if (open > 0.01) p.handL = chestState(t).pos.clone().add(V(0.0, 0.42 + 0.35 * smoothstep(46.3, 46.85, t), 0.22 - 0.25 * smoothstep(46.3, 46.85, t)));
        const smileAt = smoothstep(46.8, 47.15, t);
        p.headYaw = lerp(0, -0.4, smileAt); p.expr.gaze = smileAt > 0.3 ? kid.head.getWorldPosition(V(0, 0, 0)) : chestState(t).pos.clone().add(V(0, 0.3, 0));
        p.expr.smile = 1.0; p.expr.eyeOpen = lerp(0.6, 0.3, smileAt); p.expr.browUp = 0.4;
        // talking (mustache bob) during his line
        const talk = smoothstep(47.2, 47.3, t) * (1 - smoothstep(49.3, 49.45, t));
        p.expr.open = talk * (0.12 + 0.12 * Math.abs(Math.sin(t * 17)) * Math.abs(Math.sin(t * 5.3)));
        p.headPitch = talk * Math.sin(t * 8) * 0.04 - 0.05 * smileAt;
        if (t > 49.45) { p.bob = Math.abs(Math.sin(t * 14)) * 0.012 * (1 - smoothstep(50.2, 50.5, t)); p.expr.eyeOpen = 0.25; }
      }
    }
    orient(gshovel, sh.tip, sh.dir, sh.side); gshovel.updateMatrixWorld();
    const g = grips(gshovel);
    p.handR = p.handR || g.top;
    if (!p.handL) p.handL = t < 44.9 ? null : g.mid;
    if (t < 44.9) p.handR = g.mid.clone().lerp(g.top, 0.25);
    gshovel.userData.clump.visible = false;
    return p;
  }

  // ---------------------------------------------------------------- CAMERA
  // [time, target x,y,z, distance, pitch(deg), yaw(deg)]
  const camKeys = [
    [0.0, [0.0, 0.05, -0.4], 7.6, 8, 0],
    [4.6, [0.15, 0.0, -0.4], 7.9, 8, 0],
    [5.6, [0.32, 0.12, -0.42], 7.0, 8, -2],
    [7.3, [0.42, 0.25, -0.42], 6.4, 7, -3],
    [8.6, [0.35, 0.85, -0.6], 9.2, 6, -2],
    [10.3, [0.2, -0.3, -0.5], 9.2, 8, 0],
    [14.2, [0.25, -0.5, -0.5], 10.0, 8, 0],
    [15.4, [0.45, -0.25, -0.45], 8.6, 8, -2],
    [16.6, [0.3, -0.45, -0.5], 10.2, 8, 0],
    [21.3, [0.25, -0.55, -0.5], 10.4, 8, 0],
    [22.8, [0.95, -0.7, -0.6], 14.5, 7, 2],
    [27.6, [0.95, -0.72, -0.6], 14.5, 7, 2],
    [29.4, [-0.1, 0.05, -0.6], 10.2, 8, 0],
    [32.4, [-0.15, 0.15, -0.7], 9.6, 8, 0],
    [34.4, [-0.6, -0.1, -1.2], 11.0, 9, -4],
    [36.0, [0.05, 0.4, -0.6], 8.6, 8, 0],
    [37.3, [0.05, 0.42, -0.6], 8.4, 8, 0],
    [41.2, [-0.75, 0.4, -2.0], 22.0, 9, -2],
    [42.3, [-0.65, 0.45, -2.0], 21.0, 9, -2],
    [45.0, [0.1, -0.05, -0.6], 10.6, 8, 0],
    [46.4, [0.15, 0.1, -0.5], 9.2, 8, 0],
    [49.6, [0.2, 0.3, -0.5], 8.2, 7, 1],
    [50.5, [0.2, 0.32, -0.5], 8.0, 7, 1],
  ];
  function cameraAt(t) {
    let i = 0; while (i < camKeys.length - 2 && t > camKeys[i + 1][0]) i++;
    const a = camKeys[i], b = camKeys[i + 1]; const e = smoother(clamp((t - a[0]) / (b[0] - a[0]), 0, 1));
    const tg = V(lerp(a[1][0], b[1][0], e), lerp(a[1][1], b[1][1], e), lerp(a[1][2], b[1][2], e));
    const dist = lerp(a[2], b[2], e), pitch = THREE.MathUtils.degToRad(lerp(a[3], b[3], e)), yaw = THREE.MathUtils.degToRad(lerp(a[4], b[4], e));
    const pos = tg.clone().add(V(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist));
    // a whisper of handheld drift so it never feels robotic
    pos.x += Math.sin(t * 0.37) * 0.015; pos.y += Math.sin(t * 0.29 + 1) * 0.012;
    return { pos, tg };
  }

  // ---------------------------------------------------------------- UPDATE
  const _cs = new THREE.Vector3();
  function placeShadow(s, obj, r, y = 0.012) { obj.getWorldPosition(_cs); s.position.set(_cs.x, y, _cs.z); }

  function update(t) {
    // world uniforms
    const hx = holeXAt(t); U.uHoleX.value.set(hx[0], hx[1]); U.uHoleZ.value = HZB;
    const ob = openBottomAt(t); U.uOpenBottom.value = ob; U.uSurfOpen.value = ob < -0.004 ? 1 : 0;
    const cs = chestState(t);
    U.uDisturbBottom.value = t >= 19.99 && t < 45.35 ? Math.min(cs.pos.y, DEEP_Y) : (t >= 45.35 ? DEEPEST_Y : 0);
    U.uPatch.value = t < 21.3 ? 0 : t < 35.6 ? 1 : t < 45.38 ? 1 - smoothstep(35.6, 36.4, t) : 1;
    U.uDogPatch.value.set(HC + 0.02, -0.5, 0.32, smoothstep(31.4, 32.5, t) * (1 - smoothstep(35.6, 36.2, t)));
    // detector rings
    U.uRingT0.value = 22.95; U.uRingT1.value = 26.55;
    U.uRingParams.value.set(1.45, 2.1, 0.032, t > 22.9 && t < 28.5 ? 1.25 : 0.0);
    ground.updateCavity();
    // trees sway
    scene.traverse((o) => { if (o.userData.sway) o.userData.sway(t); });
    // door
    house.door.rotation.y = -1.6 * smoothstep(41.55, 42.0, t) * (1 - smoothstep(45.5, 46.2, t) * 0.0);

    // chest
    chest.root.position.copy(cs.pos); chest.root.rotation.set(cs.rx, cs.ry, cs.rz);
    chest.root.scale.set(1 + cs.sq * 0.5, 1 - cs.sq, 1 + cs.sq * 0.5);
    chest.set(t, cs.open, cs.magic);
    U.uChestGlow.value.set(cs.pos.x, cs.pos.y + 0.4, cs.pos.z, cs.magic * Math.min(1, cs.open * 3));
    // beams into the sky
    const beamI = smoothstep(7.55, 7.9, t) * (1 - smoothstep(9.45, 9.6, t));
    fx.setBeams(t, cs.pos.clone().add(V(0, 0.38, 0.0)), beamI * 0.5, easeOut(prog(t, 7.55, 8.3)));
    window.__bloom.strength = 0.5 + 0.35 * beamI;

    // pulley
    const pz = [16.5, 16.75, 17.0, 17.25, 17.5];
    pulley.parts.forEach((part, i) => {
      const s = popIn(prog(t, pz[i], pz[i] + 0.45)) * (1 - easeIn(prog(t, 20.2, 20.42)));
      part.visible = s > 0.002; part.scale.setScalar(Math.max(0.001, s));
    });
    const ringW = chest.root.localToWorld(V(0, CHEST_H + 0.04, 0));
    if (t > 17.5 && t < 20.42) {
      const kh = kid.arms[1].hand.getWorldPosition(V(0, 0, 0));
      pulley.setRopes(ringW, t > 17.6 ? kh : null, t > 17.9 ? -(t - 17.9) * 4 : 0);
    }

    // characters
    const kp = kidPose(t); kid.pose(kp);
    // kid feet in hole: IK feet default to root height (handled by y)
    const dp = dogPose(t); dog.pose(dp); dog.root.position.y = 0;
    const np = neighborPose(t); neighbor.root.visible = np.visible; det.group.visible = np.visible;
    if (np.visible) {
      // aim the detector from grip to coil
      const dir = np.grip.clone().sub(np.coil); const len = dir.length();
      det.group.position.copy(np.grip); det.group.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize()); det.group.scale.set(1, len / det.len, 1);
      np.handR = np.grip.clone(); np.handL = np.grip.clone().lerp(np.coil, 0.18).add(V(0, 0.02, 0));
      if (np._shrug > 0.05) { np.handL = neighbor.spine.localToWorld(V(-0.42, 0.35 + 0.15 * np._shrug, 0.2)); }
      neighbor.pose(np);
      const beeping = t > 22.95 && t < 27.0;
      const bp = ((t - 22.95) % 0.36) < 0.12;
      det.led.material.emissiveIntensity = beeping && bp ? 6 * (1 - smoothstep(25.8, 27.0, t) * 0.7) : 0.2;
      det.glowRing.material.opacity = beeping ? (bp ? 1 : 0.35) * (1 - smoothstep(26.0, 27.0, t)) : 0;
      det.coil.rotation.set(0, 0, 0);
      // keep coil level
      det.coil.quaternion.copy(det.group.quaternion.clone().invert());
      det.coil.scale.set(1, det.len / len, 1);
      U.uRingCenter.value.copy(np.coil);
    }
    const gp = grandpaPose(t); grandpa.root.visible = gp.visible; gshovel.visible = gp.visible;
    grandpa.pose(gp);
    // bone
    const bs = boneState(t); bone.visible = bs.visible; bone.position.copy(bs.pos); bone.rotation.set(0.3, 0.5, bs.rot); bone.scale.setScalar(bs.scale ?? 1);
    if (t > 34.95) bone.rotation.set(0, dog.root.rotation.y + Math.PI / 2, 0);
    // sapling stays by the kid (the reason for digging)
    // mound grows with digging, shrinks with filling
    let mk = 0.25 * smoothstep(0.6, 2.7, t) + 0.75 * smoothstep(10.9, 14.0, t);
    mk *= 1 - smoothstep(20.5, 21.45, t);
    mound.visible = mk > 0.01; mound.position.copy(MOUND_POS); mound.scale.set(0.2 + 0.55 * mk, 0.06 + 0.26 * mk, 0.2 + 0.5 * mk);
    // contact shadows
    placeShadow(shadows.kid, kid.root); shadows.kid.visible = kid.root.position.y > -0.05; shadows.kid.material.opacity = 0.5 * clamp(1 - kid.root.position.y * 2, 0, 1);
    placeShadow(shadows.dog, dog.root); placeShadow(shadows.neighbor, neighbor.root); shadows.neighbor.visible = np.visible;
    placeShadow(shadows.grandpa, grandpa.root); shadows.grandpa.visible = gp.visible;
    placeShadow(shadows.chest, chest.root); shadows.chest.visible = cs.pos.y > -0.05 && cs.pos.y < 0.6; shadows.chest.material.opacity = 0.55 * clamp(1 - cs.pos.y * 2, 0, 1);

    fx.update(t, { kidHead: kidHeadW });

    // camera
    const c = cameraAt(t); camera.position.copy(c.pos); camera.lookAt(c.tg); camera.updateMatrixWorld();
  }
  // two passes: the second sees world matrices that already belong to time t (hands that follow heads, gazes, etc.)
  return { update: (t) => { update(t); update(t); } };
}
