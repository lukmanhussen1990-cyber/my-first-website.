// Inside the shed (beats 5-10): plank walls, a hanging bulb, a big light switch, a wall clock,
// shelves, a skeleton crate, a closet door that creaks open, green spotlights.
// Built bigger inside than outside (cartoon logic) so the camera has room.
import * as THREE from 'three';
import { clay, glow, metal } from '../../../engine/toon/materials.js';
import { roundedBox, cyl, cone, sphere, capsule, torus, limb } from '../../../engine/toon/geom.js';
import { mulberry32 } from '../../../engine/toon/anim.js';
import { add, group, canvasTex } from './common.js';

export const SHED_IN = { origin: [200, 0, 0], W: 4.2, D: 3.6, H: 2.7 };

function planks(base, vertical = true, n = 10, seed = 3) {
  return canvasTex(512, 512, (c, w, h) => {
    const rnd = mulberry32(seed);
    for (let i = 0; i < n; i++) {
      const col = new THREE.Color(base).offsetHSL(0, (rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.08).getStyle();
      c.fillStyle = col;
      if (vertical) { c.fillRect(i * w / n, 0, w / n, h); c.fillStyle = 'rgba(40,22,12,0.65)'; c.fillRect(i * w / n, 0, 4, h); }
      else { c.fillRect(0, i * h / n, w, h / n); c.fillStyle = 'rgba(40,22,12,0.65)'; c.fillRect(0, i * h / n, w, 4); }
      c.fillStyle = 'rgba(80,45,25,0.3)';
      for (let k = 0; k < 2; k++) { c.beginPath(); vertical ? c.ellipse(i * w / n + 12 + rnd() * (w / n - 24), rnd() * h, 5, 9, 0, 0, 7) : c.ellipse(rnd() * w, i * h / n + 12 + rnd() * (h / n - 24), 9, 5, 0, 0, 7); c.fill(); }
    }
  }, { repeat: [1, 1] });
}

// ---- reusable props ---------------------------------------------------------------------------
export function makeSpider(size = 1) {
  const g = new THREE.Group(); g.name = 'spider';
  const fur = clay('#1f1a24', { roughness: 0.95 });
  const body = group(g, [0, 0, 0]);
  add(body, sphere(0.09, 24, 18), fur, [0, 0, -0.04], [0, 0, 0], [1, 0.9, 1.15]);
  add(body, sphere(0.06, 20, 14), fur, [0, 0.01, 0.07]);
  // googly eyes
  for (const s of [-1, 1]) {
    add(body, sphere(0.032, 16, 12), clay('#ffffff', { roughness: 0.3 }), [s * 0.028, 0.035, 0.115]);
    add(body, sphere(0.014, 12, 10), clay('#111111'), [s * 0.03, 0.03, 0.143]);
  }
  // 8 bendy legs
  const legs = [];
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const hip = group(body, [s * 0.05, 0, 0.04 - k * 0.04], [0, s * (0.5 - k * 0.32), 0]);
    hip.rotation.z = s * -0.6;
    const up = add(hip, limb(0.012, 0.011, 0.11, 8, 3), fur, [0, 0, 0], [0, 0, s * -Math.PI / 2]);
    const knee = group(hip, [s * 0.11, 0, 0], [0, 0, s * 1.3]);
    add(knee, limb(0.011, 0.008, 0.12, 8, 3), fur, [0, 0, 0], [0, 0, s * -Math.PI / 2]);
    legs.push({ hip, knee, s, k });
  }
  // the string
  const str = add(g, cyl(0.003, 0.003, 1, 6), clay('#e8e8e8', { roughness: 0.4 }), [0, 0.5, 0], [0, 0, 0], 1, { shadow: false });
  g.userData = { body, legs, string: str };
  g.scale.setScalar(size);
  g.wiggle = (t, amt = 1) => {
    legs.forEach(({ hip, knee, s, k }) => { hip.rotation.z = s * (-0.6 + Math.sin(t * 14 + k) * 0.25 * amt); knee.rotation.z = s * (1.3 + Math.cos(t * 14 + k) * 0.2 * amt); });
    body.rotation.y = Math.sin(t * 2) * 0.3 * amt;
  };
  g.setString = (len) => { str.scale.y = len; str.position.y = len / 2 + 0.05; };
  return g;
}

export function makeFogMachine() {
  const g = new THREE.Group(); g.name = 'fogMachine';
  add(g, roundedBox(0.55, 0.32, 0.38, 0.05), clay('#3a3f4a', { roughness: 0.5 }), [0, 0.26, 0]);
  add(g, roundedBox(0.5, 0.04, 0.33, 0.015), clay('#c94040'), [0, 0.43, 0]);
  add(g, cyl(0.06, 0.08, 0.2, 16), metal('#9aa2ae'), [0.3, 0.3, 0], [0, 0, Math.PI / 2]);
  add(g, cyl(0.075, 0.075, 0.03, 16), clay('#22252c'), [0.4, 0.3, 0], [0, 0, Math.PI / 2]);
  add(g, sphere(0.03, 12, 10), glow('#7dff9e', 2), [-0.15, 0.35, 0.2]);
  add(g, cyl(0.025, 0.025, 0.02, 12), clay('#f2c94c'), [-0.05, 0.35, 0.2], [Math.PI / 2, 0, 0]);
  for (const x of [-0.2, 0.2]) for (const z of [-0.14, 0.14]) add(g, cyl(0.06, 0.06, 0.04, 16), clay('#1b1d22'), [x, 0.06, z], [Math.PI / 2, 0, 0]);
  add(g, capsule(0.015, 0.4, 4, 8), metal('#9aa2ae'), [-0.32, 0.55, 0], [0, 0, 0.6]);
  return g;
}

export function makeSkeletonBox() {
  const g = new THREE.Group(); g.name = 'skeletonBox';
  const wood = clay('#8a5a33'), bone = clay('#f4efe2', { roughness: 0.55 });
  add(g, roundedBox(0.7, 0.55, 0.6, 0.03), wood, [0, 0.275, 0]);
  for (const y of [0.12, 0.42]) add(g, roundedBox(0.72, 0.06, 0.62, 0.02), clay('#6e4626'), [0, y, 0]);
  const lid = group(g, [0, 0.55, -0.3], [0, 0, 0], 'lid');
  add(lid, roundedBox(0.72, 0.05, 0.62, 0.02), wood, [0, 0.02, 0.3]);
  // the skeleton on a spring
  const spring = group(g, [0, 0.4, 0], [0, 0, 0], 'spring');
  const coil = add(spring, new THREE.TorusKnotGeometry(0.06, 0.008, 80, 6, 1, 8), metal('#b8bec8'), [0, 0.08, 0], [Math.PI / 2, 0, 0], [1, 1, 3]);
  const skel = group(spring, [0, 0.2, 0], [0, 0, 0], 'skel');
  add(skel, sphere(0.13, 28, 20), bone, [0, 0.42, 0], [0, 0, 0], [1, 1.05, 1]);
  add(skel, roundedBox(0.15, 0.08, 0.12, 0.04), bone, [0, 0.3, 0.03]);
  for (const s of [-1, 1]) {
    add(skel, sphere(0.04, 16, 12), clay('#1b1622'), [s * 0.05, 0.43, 0.105], [0, 0, 0], [1, 1.2, 0.5]);
  }
  add(skel, cone(0.02, 0.03, 3), clay('#1b1622'), [0, 0.37, 0.125], [Math.PI, 0, 0]);
  for (let k = 0; k < 4; k++) add(skel, torus(0.1 - k * 0.008, 0.012, 6, 24, Math.PI * 1.6), bone, [0, 0.2 - k * 0.055, 0], [Math.PI / 2, 0, Math.PI * 0.7]);
  add(skel, cyl(0.015, 0.015, 0.3, 8), bone, [0, 0.12, -0.06]);
  const arms = [];
  for (const s of [-1, 1]) {
    const a = group(skel, [s * 0.12, 0.24, 0], [0, 0, s * 0.9]);
    add(a, capsule(0.015, 0.22, 4, 8), bone, [0, -0.12, 0]);
    add(a, sphere(0.03, 10, 8), bone, [0, -0.26, 0]);
    arms.push(a);
  }
  g.userData = { lid, spring, skel, arms };
  return g;
}

export function makeWallClock(r = 0.32) {
  const g = new THREE.Group(); g.name = 'wallClock';
  const face = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#fbf6ea'; c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, 7); c.fill();
    c.strokeStyle = '#2a2420'; c.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2; c.lineWidth = i % 3 ? 8 : 16;
      c.beginPath(); c.moveTo(w / 2 + Math.sin(a) * w * 0.38, h / 2 - Math.cos(a) * h * 0.38); c.lineTo(w / 2 + Math.sin(a) * w * 0.45, h / 2 - Math.cos(a) * h * 0.45); c.stroke();
    }
  });
  add(g, cyl(r * 1.1, r * 1.1, 0.06, 40), clay('#c0392b', { roughness: 0.4 }), [0, 0, 0], [Math.PI / 2, 0, 0]);
  add(g, new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ map: face, roughness: 0.6 }), [0, 0, 0.035], [0, 0, 0], 1, { shadow: false });
  const hour = group(g, [0, 0, 0.045]); add(hour, roundedBox(0.035, r * 0.55, 0.012, 0.008), clay('#1e1a18'), [0, r * 0.25, 0]);
  const minute = group(g, [0, 0, 0.055]); add(minute, roundedBox(0.025, r * 0.8, 0.012, 0.008), clay('#1e1a18'), [0, r * 0.38, 0]);
  add(g, cyl(0.025, 0.025, 0.03, 12), clay('#c0392b'), [0, 0, 0.06], [Math.PI / 2, 0, 0]);
  g.userData = { hour, minute };
  g.setTime = (hours) => { hour.rotation.z = -(hours / 12) * Math.PI * 2; minute.rotation.z = -(hours % 1) * Math.PI * 2; };
  return g;
}

export function makeLightSwitch() {
  const g = new THREE.Group(); g.name = 'lightSwitch';
  add(g, roundedBox(0.2, 0.3, 0.03, 0.02), clay('#f4efe6', { roughness: 0.4 }), [0, 0, 0]);
  add(g, roundedBox(0.07, 0.12, 0.02, 0.01), clay('#d9d2c4'), [0, 0, 0.02]);
  const lever = group(g, [0, 0, 0.03], [0, 0, 0], 'lever');
  add(lever, roundedBox(0.045, 0.1, 0.05, 0.015), clay('#fbf8f2', { roughness: 0.35 }), [0, 0.03, 0.02]);
  for (const y of [-0.12, 0.12]) add(g, cyl(0.012, 0.012, 0.01, 10), metal('#b8b8b8'), [0, y, 0.02], [Math.PI / 2, 0, 0]);
  g.userData = { lever };
  g.set = (on) => { lever.rotation.x = on ? -0.5 : 0.5; };
  return g;
}

export function makeSpotCan(color = '#56ff8a') {
  const g = new THREE.Group(); g.name = 'spotCan';
  add(g, cyl(0.09, 0.12, 0.22, 20), clay('#1f2228', { roughness: 0.4 }), [0, 0, 0]);
  const lens = add(g, new THREE.CircleGeometry(0.1, 24), glow(color, 0.0, { unique: true }), [0, -0.111, 0], [Math.PI / 2, 0, 0], 1, { shadow: false });
  lens.userData.noAO = true;
  const L = new THREE.SpotLight(color, 0, 9, 0.5, 0.55, 1.4); L.position.set(0, -0.1, 0); L.target.position.set(0, -3, 0);
  g.add(L, L.target);
  // a soft visible light cone (additive)
  const coneMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const beam = add(g, new THREE.ConeGeometry(0.9, 2.6, 32, 1, true), coneMat, [0, -1.4, 0], [0, 0, 0], 1, { shadow: false });
  beam.userData.noAO = true;
  g.userData = { lens, light: L, beam };
  g.setOn = (k) => { lens.material.emissiveIntensity = 4 * k; L.intensity = 9 * k; beam.material.opacity = 0.05 * k; };
  return g;
}

// ---- the room --------------------------------------------------------------------------------
export function buildShedInside() {
  const { origin, W, D, H } = SHED_IN;
  const root = new THREE.Group(); root.name = 'shedInside'; root.position.set(...origin);
  const wallMat = new THREE.MeshStandardMaterial({ map: planks('#9c6b43', true, 12, 4), roughness: 0.85 });
  const floorMat = new THREE.MeshStandardMaterial({ map: planks('#7d5434', false, 9, 6), roughness: 0.9 });
  add(root, new THREE.BoxGeometry(W, 0.1, D), floorMat, [0, -0.05, 0], [0, 0, 0], 1, { shadow: false });
  const walls = {};
  walls.back = add(root, new THREE.BoxGeometry(W, H, 0.12), wallMat, [0, H / 2, -D / 2]);
  walls.left = add(root, new THREE.BoxGeometry(0.12, H, D), wallMat, [-W / 2, H / 2, 0]);
  walls.right = add(root, new THREE.BoxGeometry(0.12, H, D), wallMat, [W / 2, H / 2, 0]);
  const front = group(root, [0, 0, D / 2], [0, 0, 0], 'frontWall');
  add(front, new THREE.BoxGeometry((W - 1.0) / 2, H, 0.12), wallMat, [-(W + 1.0) / 4, H / 2, 0]);
  add(front, new THREE.BoxGeometry((W - 1.0) / 2, H, 0.12), wallMat, [(W + 1.0) / 4, H / 2, 0]);
  add(front, new THREE.BoxGeometry(1.0, H - 1.9, 0.12), wallMat, [0, 1.9 + (H - 1.9) / 2, 0]);
  walls.front = front;
  // ceiling + beams
  add(root, new THREE.BoxGeometry(W, 0.08, D), clay('#5a3a24'), [0, H + 0.04, 0], [0, 0, 0], 1, { shadow: false });
  for (const z of [-1.1, 0, 1.1]) add(root, roundedBox(W, 0.14, 0.14, 0.02), clay('#6e4626'), [0, H - 0.07, z]);
  // hanging bulb
  const bulbG = group(root, [0.2, H - 0.05, 0.1], [0, 0, 0], 'bulb');
  add(bulbG, cyl(0.006, 0.006, 0.5, 6), clay('#222222'), [0, -0.25, 0], [0, 0, 0], 1, { shadow: false });
  add(bulbG, cyl(0.03, 0.03, 0.05, 12), metal('#aaaaaa'), [0, -0.52, 0]);
  const bulbGlass = add(bulbG, sphere(0.055, 20, 14), glow('#ffe2a0', 3, { unique: true }), [0, -0.6, 0], [0, 0, 0], [1, 1.2, 1], { shadow: false });
  bulbGlass.userData.noAO = true;
  const bulbLight = new THREE.PointLight('#ffd49a', 0, 9, 1.6); bulbLight.position.set(0, -0.65, 0); bulbLight.castShadow = false; bulbG.add(bulbLight);
  // window on the left wall: cold moonlight
  const win = group(root, [-W / 2 + 0.07, 1.55, -0.6], [0, Math.PI / 2, 0], 'window');
  add(win, roundedBox(0.8, 0.65, 0.06, 0.02), clay('#d9cdb4'), [0, 0, 0]);
  const winGlass = add(win, new THREE.PlaneGeometry(0.66, 0.52), glow('#7f9cff', 0.9, { unique: true }), [0, 0, 0.035], [0, 0, 0], 1, { shadow: false });
  winGlass.userData.noAO = true;
  add(win, roundedBox(0.66, 0.04, 0.05, 0.01), clay('#d9cdb4'), [0, 0, 0.04]);
  add(win, roundedBox(0.04, 0.52, 0.05, 0.01), clay('#d9cdb4'), [0, 0, 0.04]);
  const moonSpot = new THREE.SpotLight('#8ea8ff', 3.5, 8, 0.45, 0.6, 1.2); moonSpot.position.set(-W / 2 + 0.2, 1.6, -0.6); moonSpot.target.position.set(0.6, 0, 0.2);
  root.add(moonSpot, moonSpot.target);
  // light switch by the door (right of the door, on the front wall, facing in)
  const sw = makeLightSwitch(); sw.position.set(0.85, 1.25, D / 2 - 0.07); sw.rotation.y = Math.PI; root.add(sw);
  // wall clock on the back wall
  const clock = makeWallClock(0.3); clock.position.set(-0.9, 1.85, -D / 2 + 0.07); root.add(clock);
  // shelves with paint cans and pots (back right)
  for (const y of [0.9, 1.45]) {
    add(root, roundedBox(1.3, 0.05, 0.35, 0.01), clay('#7a5233'), [1.25, y, -D / 2 + 0.24]);
    const rnd = mulberry32(Math.round(y * 10));
    for (let k = 0; k < 4; k++) {
      const col = ['#c0392b', '#2e86de', '#f1c40f', '#27ae60', '#8e44ad'][Math.floor(rnd() * 5)];
      if (rnd() > 0.4) add(root, cyl(0.1, 0.1, 0.2, 16), clay(col, { roughness: 0.4 }), [0.75 + k * 0.32, y + 0.125, -D / 2 + 0.24]);
      else add(root, cyl(0.1, 0.07, 0.15, 14), clay('#c2703d'), [0.75 + k * 0.32, y + 0.1, -D / 2 + 0.24]);
    }
  }
  // rake and shovel leaning on the left wall
  add(root, cyl(0.02, 0.02, 1.6, 8), clay('#b07a45'), [-W / 2 + 0.25, 0.8, 0.8], [0.0, 0, 0.18]);
  add(root, roundedBox(0.25, 0.3, 0.03, 0.02), metal('#8d939c'), [-W / 2 + 0.11, 0.12, 0.8], [0, 0, 0.18]);
  // workbench (right)
  add(root, roundedBox(0.6, 0.06, 1.4, 0.02), clay('#8a5a33'), [W / 2 - 0.36, 0.85, 0.3]);
  for (const z of [-0.3, 0.9]) add(root, roundedBox(0.06, 0.85, 0.06, 0.01), clay('#6e4626'), [W / 2 - 0.36, 0.42, z]);
  add(root, cyl(0.12, 0.12, 0.25, 16), clay('#7f8c8d'), [W / 2 - 0.36, 1.0, 0.65]);   // bucket on the bench
  // closet door on the left wall that creaks open by itself
  const closet = group(root, [-W / 2 + 0.08, 0, 1.0], [0, Math.PI / 2, 0], 'closet');
  add(closet, roundedBox(0.9, 2.0, 0.04, 0.01), clay('#2a1a10'), [0, 1.0, -0.01], [0, 0, 0], 1, { shadow: false });   // dark opening
  const cdoor = group(closet, [-0.45, 0, 0.03], [0, 0, 0], 'closetDoor');
  add(cdoor, roundedBox(0.88, 1.98, 0.05, 0.01), new THREE.MeshStandardMaterial({ map: planks('#7a5a3c', true, 5, 9), roughness: 0.85 }), [0.44, 1.0, 0]);
  add(cdoor, sphere(0.035, 12, 10), metal('#b0a070'), [0.8, 1.0, 0.04]);
  // skeleton crate (back left)
  const skbox = makeSkeletonBox(); skbox.position.set(-1.2, 0, -D / 2 + 0.55); root.add(skbox);
  // three green spotlights on the beams
  const spots = [];
  for (const [x, z, ry, rx] of [[-1.3, 1.1, 0.4, 0.35], [0.0, -1.1, 0, -0.3], [1.3, 1.1, -0.4, 0.35]]) {
    const sp = makeSpotCan('#56ff8a'); sp.position.set(x, H - 0.25, z); sp.rotation.set(rx, ry, 0); root.add(sp); spots.push(sp);
  }
  // cobwebs in the top corners
  const web = new THREE.MeshBasicMaterial({ color: '#d8d8e8', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  for (const [x, z, r] of [[-W / 2 + 0.06, -D / 2 + 0.06, 0], [W / 2 - 0.06, -D / 2 + 0.06, Math.PI / 2]]) {
    const wg = new THREE.Group(); wg.position.set(x, H - 0.06, z); wg.rotation.y = r; root.add(wg);
    for (let k = 0; k < 4; k++) add(wg, new THREE.RingGeometry(0.08 + k * 0.08, 0.085 + k * 0.08, 12, 1, 0, Math.PI / 2), web, [0, 0, 0], [Math.PI / 2, 0, -Math.PI / 2], 1, { shadow: false });
  }
  root.userData = { walls, bulb: { glass: bulbGlass, light: bulbLight }, window: winGlass, moonSpot, lightSwitch: sw, clock, closetDoor: cdoor, skeletonBox: skbox, spots };
  root.userData.local = (x, y, z) => [origin[0] + x, origin[1] + y, origin[2] + z];
  root.userData.reset = () => {
    for (const k in walls) walls[k].visible = true;
    bulbLight.intensity = 0; bulbGlass.material.emissiveIntensity = 0.2;
    sw.set(true); clock.setTime(9.0); cdoor.rotation.y = 0;
    skbox.userData.lid.rotation.x = 0; skbox.userData.spring.position.y = 0.4; skbox.userData.spring.scale.y = 0.2; skbox.userData.skel.visible = false;
    spots.forEach((s) => s.setOn(0));
    moonSpot.intensity = 3.5;
  };
  return root;
}
