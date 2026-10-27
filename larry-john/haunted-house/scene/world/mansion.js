// The haunted house as it grows: a crooked two-story spooky house, then a giant haunted mansion
// with towers, crooked glowing windows, a clock tower, a graveyard, a giant iron gate, a CHICKEN EXIT
// side door, searchlights, and (at the end) a ghost-shaped hole in the roof.
import * as THREE from 'three';
import { clay, glow, metal } from '../../../engine/toon/materials.js';
import { roundedBox, cyl, cone, sphere, torus, blob } from '../../../engine/toon/geom.js';
import { mulberry32 } from '../../../engine/toon/anim.js';
import { add, group, canvasTex } from './common.js';
import { makePumpkin } from './backyard.js';

export const MANSION = { pos: [10.0, 0, -31.0], rotY: 0, scale: 1.3 };
export const SPOOKY = { pos: [4.4, 0, -10.8], rotY: -0.18 };

function sidingTex(base, seed = 1) {
  return canvasTex(512, 512, (c, w, h) => {
    const rnd = mulberry32(seed);
    for (let i = 0; i < 16; i++) {
      c.fillStyle = new THREE.Color(base).offsetHSL(0, (rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.06).getStyle();
      c.fillRect(i * w / 16, 0, w / 16, h);
      c.fillStyle = 'rgba(10,6,20,0.45)'; c.fillRect(i * w / 16, 0, 3, h);
    }
  }, { repeat: [3, 2] });
}
function shingleTex(base, seed = 2) {
  return canvasTex(512, 512, (c, w, h) => {
    const rnd = mulberry32(seed);
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let r = 0; r < 12; r++) for (let k = 0; k < 9; k++) {
      c.fillStyle = new THREE.Color(base).offsetHSL(0, 0, (rnd() - 0.5) * 0.08).getStyle();
      const x = k * (w / 8) - ((r % 2) * w / 16), y = r * h / 12;
      c.beginPath(); c.roundRect(x + 2, y + 2, w / 8 - 4, h / 12 - 2, [0, 0, 10, 10]); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + h / 12 - 3, w / 8, 3);
    }
  }, { repeat: [4, 4] });
}

// a crooked glowing window (lit material shared so night/day can dim it)
function crookedWindow(parent, x, y, z, w, h, rot, litMat, frameMat, { round = false, ry = 0, shutters = null } = {}) {
  const g = group(parent, [x, y, z], [0, ry, rot]);
  if (round) {
    add(g, new THREE.TorusGeometry(w / 2, 0.09, 8, 28), frameMat, [0, 0, 0.04]);
    const gl = add(g, new THREE.CircleGeometry(w / 2, 28), litMat, [0, 0, 0.02], [0, 0, 0], 1, { shadow: false }); gl.userData.noAO = true;
  } else {
    add(g, roundedBox(w + 0.2, h + 0.2, 0.1, 0.03), frameMat, [0, 0, 0]);
    const gl = add(g, new THREE.PlaneGeometry(w, h), litMat, [0, 0, 0.055], [0, 0, 0], 1, { shadow: false }); gl.userData.noAO = true;
    add(g, roundedBox(w, 0.07, 0.06, 0.01), frameMat, [0, 0, 0.08]);
    add(g, roundedBox(0.07, h, 0.06, 0.01), frameMat, [0, 0, 0.08]);
    if (shutters) for (const s of [-1, 1]) add(g, roundedBox(w * 0.45, h + 0.1, 0.06, 0.02), shutters, [s * (w * 0.75), s * 0.05, 0.03], [0, 0, s * 0.12]);
  }
  return g;
}

function gable(w, h, depth) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(0, h); s.lineTo(w / 2, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g;
}
function pitchedRoof(parent, w, d, h, mat, pos, rot = [0, 0, 0], over = 0.4) {
  const g = group(parent, pos, rot);
  const slope = Math.atan2(h, w / 2), len = Math.hypot(w / 2 + over, h + over * h / (w / 2));
  for (const s of [-1, 1]) add(g, roundedBox(len, 0.18, d + over * 2, 0.05), mat, [s * (w / 4), h / 2, 0], [0, 0, -s * slope]);
  return g;
}

// ---------------- stage B: crooked two-story spooky house -------------------------------------
export function makeSpookyHouse(lit) {
  const g = new THREE.Group(); g.name = 'spookyHouse';
  const wall = new THREE.MeshStandardMaterial({ map: sidingTex('#5d4f75', 4), roughness: 0.85 });
  const trim = clay('#2b2340'), roof = new THREE.MeshStandardMaterial({ map: shingleTex('#3a3150', 5), roughness: 0.8 });
  const shut = clay('#7a4fa8');
  const body = group(g, [0, 0, 0], [0, 0, 0.02]);
  add(body, roundedBox(6.4, 3.4, 5, 0.05), wall, [0, 1.7, 0]);
  const up = group(body, [0.25, 3.4, 0], [0, 0.04, -0.045]);       // crooked second floor
  add(up, roundedBox(5.8, 3.0, 4.6, 0.05), wall, [0, 1.5, 0]);
  add(up, roundedBox(6.2, 0.2, 5.0, 0.05), trim, [0, 0.05, 0]);
  pitchedRoof(up, 6.0, 4.8, 3.3, roof, [0, 3.0, 0], [0, 0, 0.05]);
  const gf = add(up, gable(5.8, 3.2, 0.2), wall, [0, 3.0, 2.25]);
  crookedWindow(up, 0, 4.2, 2.36, 0.9, 0.9, 0.1, lit, trim, { round: true });
  // little tower on the right corner
  const tw = group(body, [2.9, 0, 1.9], [0, 0, -0.06]);
  add(tw, cyl(1.0, 1.05, 8.4, 20), wall, [0, 4.2, 0]);
  add(tw, cone(1.45, 3.6, 20), roof, [0, 10.2, 0], [0, 0, 0.1]);
  add(tw, cyl(1.2, 1.2, 0.2, 20), trim, [0, 8.45, 0]);
  crookedWindow(tw, 0, 6.6, 1.03, 0.6, 1.0, -0.08, lit, trim);
  crookedWindow(tw, 0, 3.4, 1.03, 0.6, 1.0, 0.06, lit, trim);
  // windows (crooked), door, porch
  for (const [x, y, r] of [[-2.0, 1.9, 0.08], [0.2, 2.0, -0.06]]) crookedWindow(body, x, y, 2.53, 1.0, 1.25, r, lit, trim, { shutters: shut });
  for (const [x, y, r] of [[-1.7, 1.6, -0.1], [0.9, 1.5, 0.07]]) crookedWindow(up, x, y, 2.33, 0.95, 1.15, r, lit, trim, { shutters: shut });
  add(body, roundedBox(1.2, 2.2, 0.12, 0.03), clay('#3b2a1e'), [1.3, 1.1, 2.52]);
  add(body, roundedBox(3.2, 0.15, 1.3, 0.04), trim, [1.0, 2.6, 3.0], [0.15, 0, 0.04]);
  for (const x of [-0.4, 2.4]) add(body, cyl(0.08, 0.08, 2.6, 8), trim, [x, 1.3, 3.5], [0, 0, x * 0.02]);
  add(body, roundedBox(1.0, 1.6, 1.0, 0.05), clay('#4a3a3a'), [-1.9, 7.4, -1.0], [0, 0, 0.12]);     // crooked chimney
  return g;
}

// ---------------- stage C: the giant haunted mansion -------------------------------------------
export function makeMansion(lit, litGreen) {
  const g = new THREE.Group(); g.name = 'mansion';
  const wall = new THREE.MeshStandardMaterial({ map: sidingTex('#55467a', 8), roughness: 0.85 });
  const wall2 = new THREE.MeshStandardMaterial({ map: sidingTex('#4a3d6a', 9), roughness: 0.85 });
  const trim = clay('#261e3a'), stone = clay('#6f6a7e', { roughness: 0.9 });
  const roof = new THREE.MeshStandardMaterial({ map: shingleTex('#2f2846', 10), roughness: 0.8 });
  const shut = clay('#8a5cc0'), teal = clay('#3fa39a');
  // main block
  add(g, roundedBox(15, 0.6, 10.5, 0.1), stone, [0, 0.3, 0]);
  const main = group(g, [0, 0.6, 0]);
  add(main, roundedBox(14, 10.5, 10, 0.1), wall, [0, 5.25, 0]);
  for (const y of [3.6, 7.1, 10.5]) add(main, roundedBox(14.4, 0.3, 10.4, 0.06), trim, [0, y, 0]);
  // mansard roof with dormers + iron cresting
  const mroof = group(main, [0, 10.5, 0]);
  // (the 45° turn is baked into the geometry so the scale below stretches it into a true rectangle)
  const mr = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 7.3, 4.2, 4, 1).rotateY(Math.PI / 4), roof); mr.scale.set(1.36, 1, 0.98); mr.position.y = 2.1; mr.castShadow = true; mr.receiveShadow = true; mroof.add(mr);
  for (let k = -2; k <= 2; k++) {
    if (k === 0) continue;
    const d = group(mroof, [k * 2.8, 1.6, 4.4], [0.0, 0, 0]);
    add(d, roundedBox(1.4, 1.8, 1.2, 0.05), wall2, [0, 0, -0.4]);
    add(d, gable(1.6, 0.9, 1.3), roof, [0, 0.9, -0.4]);
    crookedWindow(d, 0, 0, 0.22, 0.7, 0.95, (k % 2) * 0.08, k === 2 ? litGreen : lit, trim);
  }
  for (let k = 0; k < 28; k++) add(mroof, cone(0.06, 0.45, 6), metal('#1a1622'), [-6.4 + k * 0.47, 4.45, 0], [0, 0, 0]);
  add(mroof, roundedBox(13.2, 0.08, 0.08, 0.02), metal('#1a1622'), [0, 4.3, 0]);
  // ghost-shaped hole (shown at the end)
  const hole = group(mroof, [0, 2.0, 4.3], [-0.33, 0, 0], 'ghostHole');
  const gs = ghostShape();
  // the hole glows with the warm light of the hall inside
  const holeTex = canvasTex(256, 256, (c, w, h) => {
    // warm light from inside: bright in the middle, deeper orange toward the torn edge, two broken rafters
    const g = c.createRadialGradient(w * 0.5, h * 0.42, 4, w * 0.5, h * 0.48, w * 0.6);
    g.addColorStop(0, '#fff1c2'); g.addColorStop(0.45, '#ffc76a'); g.addColorStop(1, '#b8582a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(70,35,20,0.85)'; c.lineCap = 'round';
    c.lineWidth = 14; c.beginPath(); c.moveTo(-10, h * 0.7); c.lineTo(w + 10, h * 0.52); c.stroke();
  });
  holeTex.repeat.set(1 / 1.5, 1 / 1.7); holeTex.offset.set(0.5, 0.4 / 1.7);
  const holeMesh = add(hole, new THREE.ShapeGeometry(gs, 24), new THREE.MeshBasicMaterial({ map: holeTex, color: new THREE.Color(1.25, 1.15, 1.05), toneMapped: false }), [0, 0, 0.12], [0, 0, 0], 2.1, { shadow: false });
  holeMesh.userData.noAO = true;
  const holeRim = add(hole, new THREE.ShapeGeometry(gs, 24), clay('#2a1d16', { roughness: 0.9 }), [0, -0.06, 0.1], [0, 0, 0], 2.32, { shadow: false });
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.3; add(hole, roundedBox(0.34, 0.12, 0.08, 0.02), roof, [Math.cos(a) * 1.75, 1.0 + Math.sin(a) * 1.75, 0.16], [0.3, 0.2, a]); }
  hole.visible = false;
  g.userData.hole = hole;
  // windows on the main block (3 floors x 5) — crooked, glowing
  const rnd = mulberry32(31);
  for (let f = 0; f < 3; f++) for (let k = -2; k <= 2; k++) {
    if (f === 0 && k === 0) continue;   // door
    const lm = rnd() < 0.15 ? litGreen : lit;
    crookedWindow(main, k * 2.6, 1.8 + f * 3.5, 5.05, 1.0, 1.55, (rnd() - 0.5) * 0.18, lm, trim, { shutters: f === 1 ? shut : null });
  }
  // front entrance: arched double door, porch with columns, steps, lanterns
  const door = group(main, [0, 0, 5.02], [0, 0, 0], 'frontDoor');
  const arch = new THREE.Shape(); arch.moveTo(-1.1, 0); arch.lineTo(-1.1, 2.4); arch.absarc(0, 2.4, 1.1, Math.PI, 0, true); arch.lineTo(1.1, 0); arch.closePath();
  add(door, new THREE.ShapeGeometry(arch, 20), clay('#3a2418'), [0, 0, 0.06], [0, 0, 0], 1, { shadow: false });
  add(door, new THREE.ShapeGeometry(arch, 20), lit, [0, 0, 0.03], [0, 0, 0], [1.15, 1.08, 1], { shadow: false });
  add(door, roundedBox(0.06, 2.4, 0.08, 0.02), clay('#24160e'), [0, 1.2, 0.1]);
  for (const s of [-1, 1]) add(door, sphere(0.08, 12, 10), metal('#c9a64a'), [s * 0.2, 1.2, 0.15]);
  g.userData.frontDoor = door;
  add(g, roundedBox(6.0, 0.25, 2.8, 0.05), stone, [0, 0.72, 6.3]);
  for (let k = 0; k < 3; k++) add(g, roundedBox(4.5 - k * 0.3, 0.22, 0.6, 0.05), stone, [0, 0.11 + k * 0.2, 8.0 - k * 0.45]);
  for (const x of [-2.6, -1.4, 1.4, 2.6]) add(g, cyl(0.17, 0.2, 3.4, 12), clay('#ded6ea'), [x, 2.55, 7.4]);
  add(g, roundedBox(6.4, 0.35, 2.4, 0.06), trim, [0, 4.35, 6.4]);
  for (const s of [-1, 1]) {
    const lan = group(g, [s * 1.7, 3.3, 5.75]);
    add(lan, roundedBox(0.3, 0.42, 0.3, 0.05), metal('#1a1622'), [0, 0, 0]);
    const lg = add(lan, roundedBox(0.22, 0.3, 0.22, 0.04), glow('#ffcc6a', 4), [0, 0, 0], [0, 0, 0], 1, { shadow: false }); lg.userData.noAO = true;
    const L = new THREE.PointLight('#ffb35a', 2.5, 7, 2); lan.add(L);
  }
  // wings
  for (const [s, h, wm] of [[-1, 8.5, wall2], [1, 9.4, wall2]]) {
    const wing = group(g, [s * 10.4, 0.6, -0.6]);
    add(wing, roundedBox(6.8, h + 0.6, 8.2, 0.08), wm, [0, (h - 0.6) / 2, 0]);          // reaches down to the ground
    add(wing, roundedBox(7.1, 0.25, 8.5, 0.05), trim, [0, h, 0]);
    pitchedRoof(wing, 6.8, 8.2, 3.6, roof, [0, h, 0], [0, 0, s * 0.03]);
    add(wing, gable(6.8, 3.6, 0.25), wm, [0, h, 4.05]);
    crookedWindow(wing, 0, h + 1.3, 4.2, 0.9, 0.9, 0, lit, trim, { round: true });
    for (let f = 0; f < 2; f++) for (const x of [-1.6, 1.6]) {
      if (s > 0 && f === 0 && x < 0) continue;              // room for the CHICKEN EXIT door
      crookedWindow(wing, x, 1.9 + f * 3.4, 4.15, 1.0, 1.5, (rnd() - 0.5) * 0.2, rnd() < 0.2 ? litGreen : lit, trim, { shutters: shut });
    }
  }
  // CHICKEN EXIT: a small side door on the right wing's outer wall
  const ce = group(g, [8.9, 0, 3.58], [0, 0, 0], 'chickenExit');
  add(ce, roundedBox(1.1, 1.9, 0.12, 0.03), clay('#c9852f'), [0, 0.95, 0.02]);
  add(ce, roundedBox(1.3, 2.05, 0.08, 0.03), teal, [0, 1.0, -0.02]);
  const ceDoor = group(ce, [-0.5, 0, 0.09], [0, 0, 0], 'chickenDoor');
  add(ceDoor, roundedBox(1.0, 1.8, 0.07, 0.03), clay('#e3a64a'), [0.5, 0.9, 0]);
  add(ceDoor, sphere(0.05, 10, 8), metal('#3a3a3a'), [0.88, 0.9, 0.06]);
  const sign = add(ce, new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshStandardMaterial({ map: chickenSignTex(), roughness: 0.85 }), [0, 2.55, 0.08], [0, 0, -0.05], 1, { shadow: false });
  add(ce, roundedBox(1.6, 0.85, 0.05, 0.02), clay('#7a5233'), [0, 2.55, 0.04], [0, 0, -0.05]);
  const ceLight = new THREE.PointLight('#ffd27a', 1.6, 5, 2); ceLight.position.set(0, 2.2, 0.8); ce.add(ceLight);
  g.userData.chickenExit = ce; g.userData.chickenDoor = ceDoor; g.userData.chickenSign = sign;
  // towers
  const towers = [];
  const tL = group(g, [-13.6, 0, 4.4], [0, 0, 0.03]);       // round tower, front left
  add(tL, cyl(2.3, 2.4, 17, 24), wall, [0, 8.5, 0]);
  add(tL, cyl(2.6, 2.6, 0.35, 24), trim, [0, 17.1, 0]);
  add(tL, cone(3.0, 7.5, 24), roof, [0, 21.0, 0], [0, 0, -0.05]);
  add(tL, sphere(0.25, 12, 10), metal('#c9a64a'), [-0.35, 24.8, 0]);
  for (const y of [4, 8, 12.3]) crookedWindow(tL, 0, y, 2.35, 0.8, 1.3, (rnd() - 0.5) * 0.2, lit, trim);
  towers.push(tL);
  const tR = group(g, [13.6, 0, 3.5], [0, 0.0, -0.035]);     // tall square tower, front right
  add(tR, roundedBox(4.4, 19, 4.4, 0.08), wall2, [0, 9.5, 0]);
  add(tR, roundedBox(4.9, 0.4, 4.9, 0.06), trim, [0, 19.1, 0]);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3.4, 9, 4), roof); spire.rotation.y = Math.PI / 4; spire.position.y = 23.7; spire.castShadow = true; tR.add(spire);
  for (const y of [5, 9.5, 14]) crookedWindow(tR, 0, y, 2.25, 0.9, 1.4, (rnd() - 0.5) * 0.2, y === 9.5 ? litGreen : lit, trim);
  towers.push(tR);
  // clock tower on top of the main roof (the midnight BONG)
  const ct = group(g, [-1.6, 15.0, -0.5]);
  add(ct, roundedBox(3.4, 5.2, 3.4, 0.08), wall, [0, 2.6, 0]);
  add(ct, roundedBox(3.8, 0.3, 3.8, 0.05), trim, [0, 5.25, 0]);
  const cs = new THREE.Mesh(new THREE.ConeGeometry(2.7, 4.8, 4), roof); cs.rotation.y = Math.PI / 4; cs.position.y = 7.7; cs.castShadow = true; ct.add(cs);
  const clockFace = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#f3ecd6'; c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, 7); c.fill();
    c.strokeStyle = '#2a2238'; c.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.lineWidth = i % 3 ? 10 : 22; c.beginPath(); c.moveTo(w / 2 + Math.sin(a) * w * 0.36, h / 2 - Math.cos(a) * h * 0.36); c.lineTo(w / 2 + Math.sin(a) * w * 0.45, h / 2 - Math.cos(a) * h * 0.45); c.stroke(); }
  });
  const cf = group(ct, [0, 2.9, 1.72], [0, 0, 0], 'clockFace');
  add(cf, cyl(1.25, 1.25, 0.12, 40), trim, [0, 0, 0], [Math.PI / 2, 0, 0]);
  const cfm = add(cf, new THREE.CircleGeometry(1.1, 48), new THREE.MeshStandardMaterial({ map: clockFace, roughness: 0.6, emissive: '#fff2c8', emissiveIntensity: 0.6, emissiveMap: clockFace }), [0, 0, 0.07], [0, 0, 0], 1, { shadow: false });
  const hh = group(cf, [0, 0, 0.1]); add(hh, roundedBox(0.12, 0.65, 0.04, 0.03), clay('#1a1622'), [0, 0.3, 0]);
  const mh = group(cf, [0, 0, 0.12]); add(mh, roundedBox(0.08, 0.95, 0.04, 0.03), clay('#1a1622'), [0, 0.45, 0]);
  g.userData.clock = { face: cf, hour: hh, minute: mh, setTime: (h) => { hh.rotation.z = -(h / 12) * Math.PI * 2; mh.rotation.z = -(h % 1) * Math.PI * 2; } };
  g.userData.clock.setTime(11.97);
  // weathervane + bats on the roof
  add(g, cyl(0.04, 0.04, 2, 6), metal('#1a1622'), [-1.6, 24.2, -0.5]);
  for (const [x, y, z, r] of [[-5, 15.4, 3, 0.2], [4.6, 15.2, 2.5, -0.3]]) {
    const bat = makeBatShape(); bat.scale.setScalar(1.6); bat.position.set(x, y, z); bat.rotation.z = r; g.add(bat);
  }
  // purple and green uplights washing the facade
  const ups = [];
  for (const [x, col] of [[-5.5, '#9d6bff'], [5.5, '#4dff8a'], [-11, '#4dff8a'], [11, '#9d6bff']]) {
    // close to the facade so they wash the walls, not the graveyard lawn
    const sp = new THREE.SpotLight(col, 30, 26, 0.55, 0.6, 1.2); sp.position.set(x, 0.6, 7.2); sp.target.position.set(x * 0.9, 9, 4.5);
    g.add(sp, sp.target); ups.push(sp);
  }
  g.userData.uplights = ups;
  g.userData.towers = towers;
  g.userData.lit = lit;
  return g;
}

// a ghost silhouette (round head, little arms, wavy bottom) for ghost-shaped holes
export function ghostShape() {
  const gs = new THREE.Shape();
  gs.moveTo(0, 1.3); gs.absarc(0, 0.75, 0.55, Math.PI / 2, -Math.PI * 0.05, true);
  gs.lineTo(0.75, 0.55); gs.lineTo(0.62, 0.25); gs.lineTo(0.55, -0.1);
  gs.quadraticCurveTo(0.42, -0.35, 0.3, -0.12); gs.quadraticCurveTo(0.15, -0.4, 0.0, -0.12); gs.quadraticCurveTo(-0.15, -0.4, -0.3, -0.12); gs.quadraticCurveTo(-0.42, -0.35, -0.55, -0.1);
  gs.lineTo(-0.62, 0.25); gs.lineTo(-0.75, 0.55); gs.lineTo(-0.55, 0.7); gs.absarc(0, 0.75, 0.55, Math.PI * 1.05, Math.PI / 2, true);
  return gs;
}

function chickenSignTex() {
  return canvasTex(768, 384, (c, w, h) => {
    c.fillStyle = '#f6e7c4'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#7a5233'; c.lineWidth = 14; c.strokeRect(7, 7, w - 14, h - 14);
    c.fillStyle = '#c62828'; c.font = '96px "Permanent Marker"'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('CHICKEN', 250, h * 0.35);
    c.fillText('EXIT', 330, h * 0.72);
    // cartoon chicken drawing
    c.save(); c.translate(130, h * 0.55);
    c.fillStyle = '#ffffff'; c.strokeStyle = '#2a1a10'; c.lineWidth = 7;
    c.beginPath(); c.ellipse(0, 20, 70, 58, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.arc(38, -42, 36, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#e2332e'; c.beginPath(); c.arc(30, -82, 12, 0, 7); c.arc(46, -80, 11, 0, 7); c.fill();
    c.fillStyle = '#f5b83a'; c.beginPath(); c.moveTo(70, -46); c.lineTo(100, -36); c.lineTo(70, -28); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(48, -48, 6, 0, 7); c.fill();
    c.strokeStyle = '#f5b83a'; c.lineWidth = 8; c.beginPath(); c.moveTo(-15, 75); c.lineTo(-15, 105); c.moveTo(15, 75); c.lineTo(15, 105); c.stroke();
    // little sweat drop (scared chicken)
    c.fillStyle = '#7fd0ff'; c.beginPath(); c.moveTo(-10, -70); c.quadraticCurveTo(-24, -48, -10, -42); c.quadraticCurveTo(4, -48, -10, -70); c.fill();
    c.restore();
    c.strokeStyle = '#c62828'; c.lineWidth = 10; c.beginPath(); c.moveTo(560, h * 0.72); c.lineTo(700, h * 0.72); c.lineTo(670, h * 0.6); c.moveTo(700, h * 0.72); c.lineTo(670, h * 0.84); c.stroke();
  });
}

export function makeBatShape(color = '#16121e') {
  const s = new THREE.Shape();
  s.moveTo(0, 0.12);
  s.quadraticCurveTo(0.12, 0.1, 0.18, 0.18); s.quadraticCurveTo(0.3, 0.05, 0.55, 0.12); s.quadraticCurveTo(0.45, 0.0, 0.48, -0.1);
  s.quadraticCurveTo(0.38, -0.05, 0.32, -0.14); s.quadraticCurveTo(0.24, -0.06, 0.16, -0.16); s.quadraticCurveTo(0.08, -0.05, 0, -0.08);
  s.quadraticCurveTo(-0.08, -0.05, -0.16, -0.16); s.quadraticCurveTo(-0.24, -0.06, -0.32, -0.14); s.quadraticCurveTo(-0.38, -0.05, -0.48, -0.1);
  s.quadraticCurveTo(-0.45, 0.0, -0.55, 0.12); s.quadraticCurveTo(-0.3, 0.05, -0.18, 0.18); s.quadraticCurveTo(-0.12, 0.1, 0, 0.12);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
  m.userData.noAO = true;
  const g = new THREE.Group(); g.add(m);
  // ears
  for (const x of [-0.04, 0.04]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 4), m.material); e.position.set(x, 0.15, 0); g.add(e); }
  return g;
}

// ---------------- graveyard, iron fence and the giant gate --------------------------------------
export function makeTombstone(seed) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const stoneMat = clay(['#8a8698', '#7c788c', '#9690a6'][seed % 3], { roughness: 0.95 });
  const type = seed % 3;
  if (type === 0) {
    const s = new THREE.Shape(); s.moveTo(-0.35, 0); s.lineTo(-0.35, 0.6); s.absarc(0, 0.6, 0.35, Math.PI, 0, true); s.lineTo(0.35, 0); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }); geo.translate(0, 0, -0.075);
    add(g, geo, stoneMat, [0, 0, 0]);
    add(g, roundedBox(0.36, 0.04, 0.03, 0.01), clay('#5a5668'), [0, 0.62, 0.11]);
    add(g, roundedBox(0.04, 0.3, 0.03, 0.01), clay('#5a5668'), [0, 0.62, 0.11]);
  } else if (type === 1) {
    add(g, roundedBox(0.16, 1.0, 0.14, 0.03), stoneMat, [0, 0.5, 0]);
    add(g, roundedBox(0.6, 0.16, 0.14, 0.03), stoneMat, [0, 0.72, 0]);
  } else {
    add(g, roundedBox(0.7, 0.75, 0.18, 0.08), stoneMat, [0, 0.37, 0]);
    add(g, roundedBox(0.4, 0.05, 0.03, 0.01), clay('#5a5668'), [0, 0.5, 0.1]);
    add(g, roundedBox(0.3, 0.05, 0.03, 0.01), clay('#5a5668'), [0, 0.38, 0.1]);
  }
  add(g, roundedBox(0.9, 0.08, 0.5, 0.03), clay('#5d7a3a', { roughness: 1 }), [0, 0.0, 0.2], [0, 0, 0], 1, { shadow: false });
  g.rotation.z = (rnd() - 0.5) * 0.25; g.rotation.y = (rnd() - 0.5) * 0.4;
  return g;
}

export function makeDeadTree(seed = 1, h = 4) {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  const mat = clay('#2b2233', { roughness: 0.9 });
  const branch = (parent, len, r, depth) => {
    add(parent, cyl(r * 0.6, r, len, 6), mat, [0, len / 2, 0]);
    if (depth === 0) return;
    for (let k = 0; k < 2 + (depth > 1 ? 1 : 0); k++) {
      const b = group(parent, [0, len * (0.65 + rnd() * 0.3), 0], [(rnd() - 0.5) * 1.6, rnd() * 6, (rnd() - 0.5) * 1.6]);
      branch(b, len * 0.6, r * 0.6, depth - 1);
    }
  };
  branch(g, h * 0.45, 0.18, 3);
  return g;
}

export function makeIronGate() {
  const g = new THREE.Group(); g.name = 'ironGate';
  const iron = metal('#1b1824', { roughness: 0.45, metalness: 0.7 });
  const stone = clay('#6a6478', { roughness: 0.95 });
  for (const s of [-1, 1]) {
    add(g, roundedBox(0.9, 4.2, 0.9, 0.06), stone, [s * 2.4, 2.1, 0]);
    add(g, roundedBox(1.1, 0.25, 1.1, 0.05), stone, [s * 2.4, 4.3, 0]);
    const p = makePumpkin(0.38, true, 7 + s); p.position.set(s * 2.4, 4.42, 0); g.add(p);
    g.userData['pumpkin' + (s < 0 ? 'L' : 'R')] = p;
  }
  // two gate doors hinged at the pillars
  const doors = [];
  for (const s of [-1, 1]) {
    const pivot = group(g, [s * 1.95, 0, 0], [0, 0, 0], 'gateDoor');
    const d = group(pivot, [-s * 0.98, 0, 0]);
    for (let k = 0; k < 7; k++) {
      const x = -0.84 + k * 0.28, hgt = 3.3 + Math.sin((k / 6) * Math.PI) * 0.5 * (s < 0 ? 1 : 1);
      add(d, cyl(0.035, 0.035, hgt, 8), iron, [x, hgt / 2 + 0.05, 0]);
      add(d, cone(0.08, 0.28, 6), iron, [x, hgt + 0.18, 0]);
    }
    for (const y of [0.25, 1.05, 2.9]) add(d, roundedBox(1.9, 0.08, 0.07, 0.02), iron, [0, y, 0]);
    // short spear finials on the middle bar (the sheet snags on these)
    for (let k = 0; k < 7; k++) add(d, cone(0.06, 0.2, 6), iron, [-0.84 + k * 0.28, 1.18, 0.0]);
    // scrolls
    for (let k = 0; k < 3; k++) add(d, new THREE.TorusGeometry(0.16, 0.025, 6, 20), iron, [-0.56 + k * 0.56, 2.0, 0]);
    doors.push(pivot);
  }
  // arch over the gate
  add(g, new THREE.TorusGeometry(2.0, 0.07, 8, 40, Math.PI), iron, [0, 4.3, 0]);
  for (let k = 0; k < 5; k++) { const a = (k + 1) / 6 * Math.PI; add(g, cone(0.07, 0.3, 6), iron, [Math.cos(a) * 2.0, 4.3 + Math.sin(a) * 2.0 + 0.12, 0], [0, 0, a - Math.PI / 2]); }
  g.userData.doors = doors;
  return g;
}

export function makeIronFence(len) {
  const g = new THREE.Group();
  const iron = metal('#1b1824', { roughness: 0.45, metalness: 0.7 });
  const n = Math.floor(len / 0.3);
  const bars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 6), iron, n);
  const tips = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.22, 6), iron, n);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    o.position.set(-len / 2 + i * 0.3, 1.0, 0); o.updateMatrix(); bars.setMatrixAt(i, o.matrix);
    o.position.set(-len / 2 + i * 0.3, 2.1, 0); o.updateMatrix(); tips.setMatrixAt(i, o.matrix);
  }
  bars.castShadow = tips.castShadow = true;
  g.add(bars, tips);
  for (const y of [0.3, 1.7]) add(g, roundedBox(len, 0.07, 0.06, 0.02), iron, [0, y, 0]);
  return g;
}

// searchlight beams sweeping the night sky
export function makeSearchlight(color = '#b48cff') {
  const g = new THREE.Group();
  add(g, cyl(0.5, 0.6, 0.6, 16), metal('#2a2a36'), [0, 0.3, 0]);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 6, 140, 24, 1, true), new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  }));
  beam.geometry.translate(0, 70, 0);
  beam.userData.noAO = true;
  const pivot = group(g, [0, 0.6, 0]);
  pivot.add(beam);
  g.userData.pivot = pivot;
  return g;
}

// ---- the whole haunted estate: stages + graveyard + gate --------------------------------------
export function buildEstate(W) {
  const root = new THREE.Group(); root.name = 'estate';
  const lit = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffb347', emissiveIntensity: 2.4, roughness: 1 });
  const litGreen = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#59ff95', emissiveIntensity: 2.4, roughness: 1 });
  const spooky = makeSpookyHouse(lit); spooky.position.set(...SPOOKY.pos); spooky.rotation.y = SPOOKY.rotY; root.add(spooky);
  const mansion = makeMansion(lit, litGreen); mansion.position.set(...MANSION.pos); mansion.rotation.y = MANSION.rotY; mansion.scale.setScalar(MANSION.scale); root.add(mansion);
  // graveyard between the mansion and the gate
  const gy = new THREE.Group(); gy.name = 'graveyard'; root.add(gy);
  const rnd = mulberry32(77);
  const tombs = [];
  for (let i = 0; i < 60; i++) {
    const x = MANSION.pos[0] + (rnd() - 0.5) * 22, z = -19.5 + rnd() * 5.2;
    if (Math.abs(x - MANSION.pos[0]) < 2.4 || x < 2.8) continue;   // keep the path and our house clear
    const t = makeTombstone(i); t.position.set(x, 0, z); gy.add(t); tombs.push(t);
  }
  // a row of tombstones close along both sides of the path (so every graveyard shot reads)
  for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) {
    const t = makeTombstone(100 + k * 2 + (sd > 0 ? 1 : 0));
    t.position.set(MANSION.pos[0] + sd * (2.05 + ((k + (sd > 0 ? 1 : 0)) % 2) * 0.35), 0, -14.7 - k * 1.25 - (sd > 0 ? 0.4 : 0));
    t.rotation.y += sd * 0.35; gy.add(t); tombs.push(t);
  }
  const lanterns = [];
  for (let i = 0; i < 8; i++) {
    const z = -19.6 + i * 0.75;
    for (const s of [-1, 1]) {
      if ((i + (s > 0 ? 1 : 0)) % 2) continue;
      const p = makePumpkin(0.24 + rnd() * 0.08, true, 40 + i); p.position.set(MANSION.pos[0] + s * 1.6, 0, z); p.rotation.y = -s * 0.5; gy.add(p); lanterns.push(p);
    }
  }
  for (const [x, z, s] of [[-5.5, -18.5, 1], [8.5, -16.5, 2], [-3.0, -15.5, 3]]) { const t = makeDeadTree(s, 5); t.position.set(MANSION.pos[0] + x, 0, z); gy.add(t); }
  // a darker, muddier patch of ground under the graveyard (soft edges blend into the lawn)
  const gyGround = canvasTex(512, 256, (c, w, h) => {
    const rnd2 = mulberry32(5);
    c.fillStyle = '#3b4636'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${20 + rnd2() * 40},${30 + rnd2() * 40},${30 + rnd2() * 30},0.35)`; c.beginPath(); c.arc(rnd2() * w, rnd2() * h, 2 + rnd2() * 9, 0, 7); c.fill(); }
    // fade out at the edges
    const m = c.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x) / (w * 0.12), ey = Math.min(y, h - 1 - y) / (h * 0.25);
      m.data[(y * w + x) * 4 + 3] = 255 * Math.min(1, ex, ey) * 0.92;
    }
    c.putImageData(m, 0, 0);
  });
  const gyg = add(gy, new THREE.PlaneGeometry(27, 8.5), new THREE.MeshStandardMaterial({ map: gyGround, transparent: true, depthWrite: false, roughness: 1 }), [MANSION.pos[0], 0.012, -16.9], [-Math.PI / 2, 0, 0], 1, { shadow: false });
  gyg.receiveShadow = true; gyg.renderOrder = 1; gyg.userData.noAO = true;
  // path to the door
  add(gy, new THREE.PlaneGeometry(2.6, 8), clay('#7d7488', { roughness: 1 }), [MANSION.pos[0], 0.02, -17.0], [-Math.PI / 2, 0, 0], 1, { shadow: false });
  // iron fence + gate across the front of the graveyard
  const gateZ = -13.2;
  const gate = makeIronGate(); gate.position.set(MANSION.pos[0], 0, gateZ); root.add(gate);
  for (const s of [-1, 1]) { const f = makeIronFence(s < 0 ? 4.6 : 9); f.position.set(MANSION.pos[0] + s * (s < 0 ? 5.2 : 7.4), 0, gateZ); root.add(f); }
  // searchlights behind the mansion
  const searchlights = [];
  for (const [x, col] of [[-10, '#b48cff'], [2, '#7dffb0'], [16, '#b48cff']]) {
    const s = makeSearchlight(col); s.position.set(MANSION.pos[0] + x * 1.3, 0, MANSION.pos[2] - 11); root.add(s); searchlights.push(s);
  }
  root.userData = { spooky, mansion, graveyard: gy, gate, lanterns, tombs, searchlights, lit, litGreen, gateZ };
  root.userData.reset = () => {
    spooky.visible = false; mansion.visible = false; gy.visible = false; gate.visible = false;
    root.children.forEach((c) => { if (c !== spooky && c !== mansion && c !== gy && c !== gate) c.visible = false; });
    spooky.scale.setScalar(1); mansion.scale.setScalar(MANSION.scale);
    mansion.userData.hole.visible = false;
    gate.userData.doors.forEach((d) => { d.rotation.y = 0; });
    mansion.userData.chickenDoor.rotation.y = 0;
    mansion.userData.clock.setTime(11.97);
    lit.emissiveIntensity = 2.4; litGreen.emissiveIntensity = 2.4;
    for (const s of searchlights) s.visible = false;
  };
  root.userData.showFence = (on) => { root.children.forEach((c) => { if (c.type === 'Group' && c !== spooky && c !== mansion && c !== gy && c !== gate && !searchlights.includes(c)) c.visible = on; }); };
  return root;
}
