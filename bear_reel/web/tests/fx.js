// fx preview harness (owner: fx agent). TEST=fx: every 10 s of "time" is one scenario (slot = floor(t / 10)),
// lt = t % 10 drives the effect. Cameras match the distances the shots use. Stub characters are posed here.
import * as THREE from 'three';
import { BEAR_PATH, HIDE_BUSH, YOU_SPOT, MAP_BEAR, COMPARE, BRANCH, HIDE_TREE } from '../layout.js';
import { clamp, smooth } from '../lib.js';

let canopy = null, mapBear = null;
function testCanopy(scene) {
  if (canopy) return canopy;
  const g = new THREE.ConeGeometry(1, 1, 7); g.translate(0, 0.5, 0);
  const m = new THREE.MeshStandardMaterial({ color: '#2f5a2a', roughness: 0.9, flatShading: true });
  const n = 2600;
  canopy = new THREE.InstancedMesh(g, m, n); canopy.name = 'fxtest.canopy'; canopy.userData.noAudit = true;
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) {
    const x = -50 + r() * 100, z = -30 + r() * 150;
    const hgt = 12 + r() * 8, rad = 2.2 + r() * 1.6;
    M.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(rad, hgt, rad));
    canopy.setMatrixAt(i, M);
    canopy.setColorAt(i, c.setHSL(0.3 + r() * 0.06, 0.45, 0.16 + r() * 0.12));
  }
  scene.add(canopy);
  const river = new THREE.Mesh(new THREE.PlaneGeometry(140, 7), new THREE.MeshStandardMaterial({ color: '#3d7fa8' }));
  river.rotation.x = -Math.PI / 2; river.position.set(0, 0.3, 55); river.name = 'fxtest.river'; river.userData.noAudit = true;
  canopy.add(river);
  mapBear = new THREE.Group(); mapBear.name = 'fxtest.mapBear';
  const fur = new THREE.MeshStandardMaterial({ color: '#6b4423', flatShading: true });
  const head = new THREE.Mesh(new THREE.SphereGeometry(3.2, 9, 7), fur); head.position.set(0, 21, 0); head.name = 'fxtest.mapBearHead';
  const snout = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 2.6), new THREE.MeshStandardMaterial({ color: '#c79a64', flatShading: true })); snout.position.set(0, 20.2, -3.6); snout.name = 'fxtest.snout';
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.6), new THREE.MeshStandardMaterial({ color: '#111' })); nose.position.set(0, 20.6, -5.0); nose.name = 'fxtest.nose';
  mapBear.add(head, snout, nose); mapBear.position.set(MAP_BEAR.pos[0], 0, MAP_BEAR.pos[1]);
  scene.add(mapBear);
  return canopy;
}
const MAP_NOSE = [MAP_BEAR.pos[0], 20.6, MAP_BEAR.pos[1] - 5.3];
const TRAIL_PTS = [[-0.6, 24, 1], [4.0, 24, 12], [-3.5, 24, 25], [2.5, 24, 39], [-4.0, 24, 52], [-8.5, 24, 66], [-3.0, 23.5, 78], MAP_NOSE];

// stub bear (web/stubs/animals.js): head centre = root + R(rotY) * (0, 1.6, 1.6), nose 0.45 in front of it
const B0 = [BEAR_PATH.stop[0], BEAR_PATH.stop[1]];
const HB = [B0[0], 1.6, B0[1] - 1.6];          // head centre when the stub bear stands at B0 facing -Z
const NB = [B0[0], 1.6, B0[1] - 2.05];         // nose
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export function update(ctx) {
  const { t, W, cam, post } = ctx;
  const fx = W.fx, you = W.cast.you, bear = W.animals.bear, dog = W.animals.dog;
  const slot = Math.floor(t / 10), lt = t - slot * 10, T0 = slot * 10;
  if (canopy) { canopy.visible = false; mapBear.visible = false; }
  cam.handheld(0);
  const bearAt = (pos, rotY) => { bear.p.pos = pos; bear.p.rotY = rotY; bear.p.visible = true; };
  const nose = () => bear.nosePos();

  switch (slot) {
    case 0: {          // s01-like: stink behind the bush, medium close-up from the front (lt<5) / low over the bush (lt>=5)
      bear.p.visible = false;
      if (lt < 5) cam.set({ pos: [0.95, 1.45, 3.1], target: [0.05, 1.3, 0], fov: 40 });
      else cam.set({ pos: [-0.2, 1.05, 2.6], target: [0.1, 1.25, 0], fov: 40 });
      fx.stink({ at: [0.12, 0.92, -0.05], amount: 0.8, t, seed: 3 });
      break;
    }
    case 1: {          // s02 wide 8 m (lt<5) and s29 high wide with huge lines over the trees (lt>=5)
      bear.p.visible = false;
      if (lt < 5) {
        cam.set({ pos: [5.6, 2.3, 7.2], target: [-0.3, 1.5, 0], fov: 40 });
        fx.stink({ at: [0.12, 0.92, -0.05], amount: 0.5, t, seed: 5 });
      } else {
        W.set.state.fog = { color: '#ff9a52', near: 60, far: 400 };
        cam.set({ pos: [9, 16, 30], target: [-1, 9, 0], fov: 40 });
        fx.stink({ at: [-0.9, 9, -1.5], amount: 1, t, seed: 9, scale: 12, spread: 0.5 });
        fx.haze({ at: [-1, 10, 0], radius: 9, amount: 0.8, t, ground: null });
      }
      break;
    }
    case 2: {          // s24 profile: stink sucked into the nose (progress 0..1 over 2 s; lt>=5: held at 0.5)
      you.p.visible = false; bearAt(B0, Math.PI);
      const tg = add(NB, [0, -0.3, 0.08]);
      cam.set({ pos: add(tg, [1.75, 0.1, -0.15]), target: tg, fov: 40 });
      const prog = lt < 5 ? clamp(lt / 2) : 0.5;
      fx.stinkFlow({ from: add(NB, [0, -0.8, -0.3]), to: nose, progress: prog, t, count: 4, seed: 2 });
      break;
    }
    case 3: {          // s21 map: trail from 150 m straight down, camera follows the head
      bear.p.visible = false;
      testCanopy(ctx.scene); canopy.visible = true; mapBear.visible = true;
      W.set.state.fog = { color: '#ff9a52', near: 300, far: 900 };
      const prog = clamp(lt / 4);
      const hp = fx.trailHead({ points: TRAIL_PTS, progress: prog });
      const cz = clamp(hp[2] - 10, 22, 62);
      cam.set({ pos: [-2, 150, cz], target: [-2, 0, cz + 0.001], up: [0, 0, 1], fov: 40, far: 600 });
      fx.trail({ points: TRAIL_PTS, progress: prog, t, width: 5 });
      break;
    }
    case 4: {          // s25/s26 haze around the bear's face (medium close-up), green tint
      you.p.visible = false; bearAt(B0, Math.PI);
      cam.set({ pos: add(HB, [0.5, 0.15, -3.0]), target: add(HB, [0, -0.15, 0]), fov: 40 });
      fx.haze({ at: add(HB, [0, -0.3, -0.4]), radius: 1.2, amount: lt < 5 ? 0.6 : 1, t });
      post.tint = lt < 5 ? 0.12 : 0.25;
      break;
    }
    case 5: {          // sweat: s08 face close-up (lt<5), s15 panic burst medium close-up (lt>=5)
      bear.p.visible = false;
      you.p.crouch = lt < 5 ? 0 : 0.35;
      const hy = lt < 5 ? 1.6 : 1.6 - 0.35 * 0.4;
      if (lt < 5) {
        cam.set({ pos: [0.2, hy + 0.05, YOU_SPOT.pos[1] + 0.75], target: [YOU_SPOT.pos[0], hy, YOU_SPOT.pos[1]], fov: 40 });
        fx.sweat({ ch: you, side: 'L', t0: T0 + 0.3, t, size: 1 });
        fx.sweat({ ch: you, side: 'R', t0: T0 + 1.4, t, size: 0.8 });
      } else {
        cam.set({ pos: [0.3, hy + 0.1, YOU_SPOT.pos[1] + 1.6], target: [YOU_SPOT.pos[0], hy - 0.05, YOU_SPOT.pos[1]], fov: 40 });
        fx.sweatBurst({ ch: you, t0: T0 + 5.2, t, count: 6, every: 0.35 });
      }
      break;
    }
    case 6: {          // s25 tears down the cheeks (front close-up) lt<5; cryTears front view lt>=5 (reference look)
      you.p.visible = false; bearAt(B0, Math.PI);
      cam.set({ pos: add(HB, [0.15, 0.1, -2.2]), target: add(HB, [0, -0.1, 0]), fov: 40 });
      if (lt < 5) fx.tears({ ch: bear, t0: T0 + 0.3, t, amount: 1 });
      else fx.cryTears({ ch: bear, t, amount: 1, dir: [0, 1, 0] });
      break;
    }
    case 7: {          // s27 wide side view: bear runs away (+X) crying, dust behind the feet
      you.p.visible = false;
      const x = -3 + lt * 2.2;
      bearAt([x, 6], Math.PI / 2);
      cam.set({ pos: [x + 1.0, 1.9, 6 - 7.5], target: [x + 0.8, 1.5, 6], fov: 40 });
      fx.cryTears({ ch: bear, t, amount: 1 });
      for (let k = 0; k < 4; k++) {
        const tk = Math.floor(lt / 0.32) * 0.32 - k * 0.32;
        if (tk < 0) continue;
        fx.dust({ at: [-3 + tk * 2.2 - 0.5, 0, 6 + (k % 2 ? 0.35 : -0.35)], t0: T0 + tk, t, amount: 0.8, seed: Math.round(tk * 100) });
      }
      break;
    }
    case 8: {          // s05 itch around the hips (lt<5) / s13 swirl into the nose (lt>=5)
      if (lt < 5) {
        bear.p.visible = false;
        cam.set({ pos: [0.35, 1.45, 2.4], target: [0.05, 1.25, -0.28], fov: 40 });
        fx.itch({ at: [0.05, 1.05, -0.2], t0: T0 + 0.3, t, radius: 0.32, count: 7 });
      } else {
        you.p.visible = false; bearAt(B0, Math.PI);
        cam.set({ pos: add(NB, [0.04, 0.03, -0.62]), target: NB, fov: 40 });
        fx.swirl({ to: nose, t, amount: 1, radius: 0.16 });
      }
      break;
    }
    case 9: {          // s06 leaves burst off the bush (lt<5) / s07 branch snap splinters at ground level (lt>=5)
      bear.p.visible = false;
      if (lt < 5) {
        cam.set({ pos: [0.6, 1.4, 3.4], target: [0.1, 1.1, 0], fov: 40 });
        fx.leaves({ at: [0.22, 1.0, 0.55], t0: T0 + 0.3, t, count: 12, spread: 0.6 });
        fx.leaves({ at: [0.0, 0.95, 0.4], t0: T0 + 1.0, t, count: 8, spread: 0.5, seed: 77 });
      } else {
        you.p.visible = false;
        const b = [BRANCH.pos[0], 0.04, BRANCH.pos[1]];
        cam.set({ pos: [b[0] + 0.15, 0.18, b[2] - 0.75], target: [b[0], 0.08, b[2]], fov: 40 });
        fx.splinters({ at: b, t0: T0 + 5.4, t, count: 16 });
      }
      break;
    }
    case 10: {         // s10 needles kicked at the paws (low angle) lt<5 / s09 glints: eyes in the dark lt>=5
      you.p.visible = false;
      if (lt < 5) {
        bearAt([BEAR_PATH.enter[0], BEAR_PATH.enter[1] - 1], Math.PI);
        const pz = BEAR_PATH.enter[1] - 1 - 1.3;
        cam.set({ pos: [BEAR_PATH.enter[0] + 0.3, 0.4, pz - 2.6], target: [BEAR_PATH.enter[0], 0.6, pz], fov: 40 });
        for (const [k, t0] of [[0, 0.4], [1, 1.1], [2, 1.8]]) fx.needles({ at: [BEAR_PATH.enter[0] + (k % 2 ? 0.35 : -0.35), 0, pz + 0.1], t0: T0 + t0, t, count: 16, seed: 5 + k });
      } else {
        bearAt(BEAR_PATH.start, Math.PI);
        W.set.state.exposure = 0.45;
        cam.set({ pos: [-0.8, 1.6, 6], target: [-1.6, 1.8, 24], fov: 40 });
        const e = (s) => () => W.animals.bear.eyePos(s);
        fx.glint({ at: e('L'), t, size: 0.16, seed: 1 });
        fx.glint({ at: e('R'), t, size: 0.16, seed: 2 });
      }
      break;
    }
    case 11: {         // s19 badge next to the bear head ~5 m away at fov 40
      you.p.visible = false;
      bearAt([COMPARE.pos[0] - 1.2, COMPARE.pos[1]], 0);
      dog.p.visible = true;
      cam.set({ pos: [COMPARE.pos[0], 1.6, COMPARE.pos[1] + 6.5], target: [COMPARE.pos[0] - 0.4, 1.5, COMPARE.pos[1]], fov: 40 });
      fx.badge({ text: 'x7', at: () => W.animals.bear.nosePos().add(new THREE.Vector3(0.75, 0.45, 0.2)), t0: T0 + 0.5, t, size: 0.75 });
      break;
    }
    default: break;
  }
}
