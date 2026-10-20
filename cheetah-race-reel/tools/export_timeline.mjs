// Export the animation timeline (sampled curves + discrete events) to JSON so
// the sound design can be generated in sync with the 3D render.
//   node tools/export_timeline.mjs [out.json]
import fs from 'node:fs';
import * as THREE from 'three';
import { BEAT, DURATION, W, slowFactor, carState, cheetahState } from '../render/js/timeline.js';
import { carWorld, cheetahWorld, cameraAt } from '../render/js/choreo.js';

const out = process.argv[2] || new URL('../work/timeline.json', import.meta.url).pathname;
const RATE = 200;
const n = Math.ceil(DURATION * RATE) + 1;
const cam = new THREE.PerspectiveCamera(38, 9 / 16, 0.1, 3000);
const v = new THREE.Vector3();
const screenX = (p, c) => {
  cam.position.copy(c.pos); cam.fov = c.fov; cam.lookAt(c.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  v.copy(p).project(cam);
  return { x: v.x, vis: v.z < 1 && Math.abs(v.x) < 1.3 && Math.abs(v.y) < 1.3, dist: c.pos.distanceTo(p) };
};

const curves = { t: [], tau: [], slow: [], carV: [], carY: [], carYaw: [], thrBack: [], thrSide: [], thrFront: [], spin: [], fan: [], brake: [],
  chV: [], chPhase: [], chVisible: [], chLeap: [], carPan: [], carDist: [], chPan: [], chDist: [] };
let phaseUnwrapped = 0, lastPhase = null;
for (let i = 0; i < n; i++) {
  const t = i / RATE;
  const c = carState(t), cw = carWorld(t), h = cheetahState(t), hw = cheetahWorld(t);
  const camT = cameraAt(t);
  const sc = screenX(new THREE.Vector3(cw.x, 0.6 + cw.y, cw.z), camT);
  const sh = screenX(new THREE.Vector3(hw.x, 0.5 + hw.y, hw.z), camT);
  if (lastPhase !== null) { let d = h.phase - lastPhase; if (d < -0.5) d += 1; phaseUnwrapped += d; }
  lastPhase = h.phase;
  curves.t.push(+t.toFixed(4)); curves.tau.push(+W(t).toFixed(5)); curves.slow.push(+slowFactor(t).toFixed(4));
  curves.carV.push(+c.v.toFixed(3)); curves.carY.push(+c.y.toFixed(3)); curves.carYaw.push(+cw.yaw.toFixed(4));
  curves.thrBack.push(+c.thrBack.toFixed(4)); curves.thrSide.push(+c.thrSide.toFixed(4)); curves.thrFront.push(+c.thrFront.toFixed(4));
  curves.spin.push(+c.spin.toFixed(4)); curves.fan.push(+c.fan.toFixed(4)); curves.brake.push(+Math.min(1, c.brake).toFixed(4));
  curves.chV.push(+h.v.toFixed(3)); curves.chPhase.push(+phaseUnwrapped.toFixed(4)); curves.chVisible.push(h.visible ? 1 : 0); curves.chLeap.push(+h.leap.toFixed(4));
  curves.carPan.push(+Math.max(-1, Math.min(1, sc.x)).toFixed(3)); curves.carDist.push(+sc.dist.toFixed(2));
  curves.chPan.push(+Math.max(-1, Math.min(1, sh.x)).toFixed(3)); curves.chDist.push(+sh.dist.toFixed(2));
}
// paw strikes: each leg touches down when the gallop phase passes its offset
const OFF = { HL: 0.0, HR: 0.07, FL: 0.5, FR: 0.57 };
const paws = [];
for (let i = 1; i < n; i++) {
  if (!curves.chVisible[i] || curves.chV[i] < 1.5 || curves.chLeap[i] > 0.01) continue;
  const a = curves.chPhase[i - 1], b = curves.chPhase[i];
  for (const [leg, off] of Object.entries(OFF)) {
    if (Math.floor(a - off) !== Math.floor(b - off)) paws.push({ t: +curves.t[i].toFixed(4), leg, v: curves.chV[i], pan: curves.chPan[i], dist: curves.chDist[i] });
  }
}
fs.writeFileSync(out, JSON.stringify({ rate: RATE, duration: DURATION, beat: BEAT, curves, paws }));
console.log(`wrote ${out}: ${n} samples, ${paws.length} paw strikes`);
