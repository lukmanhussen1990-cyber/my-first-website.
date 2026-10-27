// Project set-local points to 1080x1920 screen pixels for a frame (composition helper).
// usage: node scripts/proj.mjs <frame> <set> "x,y,z" ["x,y,z" ...]
import fs from 'fs';
import * as THREE from 'three';
import { buildPlan, shotAt } from '../src/plan.js';
import { cameraShot, SETS } from '../src/lib/director.js';
const T = JSON.parse(fs.readFileSync(new URL('../timeline.json', import.meta.url)));
const plan = buildPlan(T);
const f = Number(process.argv[2]), set = process.argv[3], t = f / 30;
const { shot } = shotAt(plan, t);
const c = cameraShot(plan, shot, t);
const cam = new THREE.PerspectiveCamera(c.fov, 1080 / 1920, 0.05, 2000);
cam.position.set(...c.pos); cam.lookAt(...c.look); if (c.roll) cam.rotateZ(c.roll); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
console.log(`f${f} t=${t.toFixed(2)} shot ${shot.id} pos ${c.pos.map((v) => v.toFixed(2))} look ${c.look.map((v) => v.toFixed(2))} fov ${c.fov}`);
for (const s of process.argv.slice(4)) {
  const p = s.split(',').map(Number); const o = SETS[set];
  const v = new THREE.Vector3(p[0] + o[0], p[1] + o[1], p[2] + o[2]).project(cam);
  console.log(`  ${s.padEnd(18)} -> x ${Math.round((v.x + 1) / 2 * 1080)}, y ${Math.round((1 - v.y) / 2 * 1920)}${v.z > 1 ? ' (behind)' : ''}`);
}
