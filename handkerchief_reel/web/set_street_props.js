// Street props: the lamp post geometry (shared with set_city), the hollow round BUSH YOU hides in, the black
// stretch LIMO (curb-side doors open, gold rims with diamonds, glowing interior + mist), YOU's shopping CART with
// everything he owns, and the puddles. Pure functions of state (set_street.js applies it in update()).
import * as THREE from 'three';
import { mat, tex, rng, hash1, clamp, smooth } from './lib.js';
import { STREET } from './layout.js';
import { bushLeafCanvas } from './set_tex.js';
import { goldCanvas } from './set_tex2.js';
import { velvetCanvas, leatherCanvas, headlinerCanvas, carpetDarkCanvas, tireCanvas, rustCanvas, sleepingBagCanvas, umbrellaCanvas,
  cardboardBlankCanvas, terracottaCanvas, puffCanvas, dirtCanvas } from './set_street_tex.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const mesh = (geo, m, name, cast = true) => { const o = new THREE.Mesh(geo, m); o.name = name; o.castShadow = cast; o.receiveShadow = true; return o; };
const box = (w, h, d, m, x, y, z, name, cast = true) => { const o = mesh(new THREE.BoxGeometry(w, h, d), m, name, cast); o.position.set(x, y, z); return o; };

// ---------------------------------------------------------------- lamp post (classic iron lamp with a lantern)
export const LAMP = { lanternY: 3.95 };
export function lampPostGeometry() {
  const parts = [];
  const add = (geo, m, x = 0, y = 0, z = 0) => { geo.translate(x, y, z); parts.push({ geo, mat: m }); };
  add(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 8), 'iron', 0, 0.25, 0);
  add(new THREE.CylinderGeometry(0.11, 0.14, 0.35, 8), 'iron', 0, 0.62, 0);
  add(new THREE.CylinderGeometry(0.055, 0.075, 3.1, 8), 'iron', 0, 2.25, 0);
  add(new THREE.CylinderGeometry(0.1, 0.07, 0.18, 8), 'iron', 0, 3.72, 0);
  add(new THREE.CylinderGeometry(0.17, 0.1, 0.42, 6), 'glass', 0, 3.98, 0);
  add(new THREE.ConeGeometry(0.26, 0.24, 6), 'iron', 0, 4.31, 0);
  add(new THREE.SphereGeometry(0.05, 6, 4), 'iron', 0, 4.48, 0);
  return parts;
}

// ---------------------------------------------------------------- the bush: a ring of leafy clumps, hollow centre
export function buildBush(env) {
  const g = new THREE.Group(); g.name = 'set.street.bush';
  const [bx, bz] = STREET.bush.pos, sy = STREET.sideY;
  g.position.set(bx, sy, bz);
  const leafM = mat(tex(bushLeafCanvas('#3f7a2e', 331), { repeat: [2, 2] }), { rough: 0.85 });
  leafM.flatShading = true;
  const leafM2 = mat(tex(bushLeafCanvas('#4f8a36', 337), { repeat: [2, 2] }), { rough: 0.85 }); leafM2.flatShading = true;
  // dirt square + stone edging in the sidewalk
  const dirtM = mat(tex(dirtCanvas(31), { repeat: [2, 2] }), { rough: 0.95 });
  const d = box(1.62, 0.04, 1.62, dirtM, 0, 0.005, 0, 'bushDirt', false); g.add(d);
  const stoneM = mat('#7a7670', { rough: 0.7 });
  for (const [x, z, w, dd] of [[0, 0.84, 1.76, 0.1], [0, -0.84, 1.76, 0.1], [0.84, 0, 0.1, 1.6], [-0.84, 0, 0.1, 1.6]]) g.add(box(w, 0.06, dd, stoneM, x, 0.03, z, 'bushEdge', false));
  const R = rng(911), clumps = [];
  const ring = (n, rad, y, size, k0) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R() * 0.3, r = rad * (0.92 + R() * 0.16), s = size * (0.85 + R() * 0.35);
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const p = geo.attributes.position;
      for (let j = 0; j < p.count; j++) { const f = 0.88 + hash1(j * 3.1 + i * 7 + k0) * 0.24; p.setXYZ(j, p.getX(j) * f, p.getY(j) * f * 0.92, p.getZ(j) * f); }
      geo.computeVertexNormals();
      const m = mesh(geo, (i + k0) % 3 ? leafM : leafM2, 'bushClump');
      m.scale.setScalar(s); m.position.set(Math.cos(a) * r, y + R() * 0.05, Math.sin(a) * r);
      m.userData.base = m.position.clone(); m.userData.ph = R() * 6.3;
      g.add(m); clumps.push(m);
    }
  };
  ring(11, 0.52, 0.28, 0.3, 0);       // bottom ring (wide)
  ring(11, 0.5, 0.58, 0.29, 3);       // middle ring
  ring(9, 0.4, 0.84, 0.23, 5);        // top ring: leaves the centre (r < 0.2) open for his neck + shoulders
  ring(7, 0.3, 0.93, 0.15, 7);
  // a few small flowers
  const flM = mat('#f2e8f0', { rough: 0.6, emissive: '#3a2a30', emissiveIntensity: 0.3 });
  for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, f = mesh(new THREE.IcosahedronGeometry(0.035, 0), flM, 'bushFlower', false); f.position.set(Math.cos(a) * 0.62, 0.45 + (i % 3) * 0.17, Math.sin(a) * 0.62); g.add(f); }
  return { group: g, clumps,
    update(t, shake) {
      const k = clamp(shake);
      for (const c of clumps) {
        const b = c.userData.base, ph = c.userData.ph;
        c.position.set(b.x + Math.sin(t * 31 + ph) * 0.03 * k, b.y + Math.abs(Math.sin(t * 23 + ph)) * 0.02 * k, b.z + Math.cos(t * 27 + ph) * 0.03 * k);
        c.rotation.set(Math.sin(t * 19 + ph) * 0.12 * k, 0, Math.cos(t * 21 + ph) * 0.12 * k);
      }
      g.rotation.z = Math.sin(t * 17) * 0.015 * k;
    } };
}

// ---------------------------------------------------------------- the limo
// Local frame: x along the car (nose +X), z across (curb side = +Z), y up, origin at the centre of the ground print.
const LEN = 7.2, WID = 2.0;
const WHEEL = { r: 0.37, x: 2.55, z: 0.86 };
const REAR_DOOR = [-1.05, -0.05];               // local x span of the rear door (curb side)
const FRONT_DOOR = [1.55, 2.35];                 // local x span of the front door
function limoProfile() {
  const s = new THREE.Shape();
  const arch = (cx, from, to) => { s.lineTo(cx - 0.47, 0.3); s.absarc(cx, 0.36, 0.47, Math.PI, 0, true); s.lineTo(cx + 0.47, 0.3); };
  s.moveTo(-3.6, 0.3);
  arch(-WHEEL.x); arch(WHEEL.x);
  s.lineTo(3.6, 0.3); s.lineTo(3.6, 0.7); s.lineTo(3.44, 0.84); s.lineTo(2.35, 0.93); s.lineTo(1.55, 1.42); s.lineTo(-2.55, 1.42);
  s.lineTo(-3.05, 0.92); s.lineTo(-3.45, 0.86); s.lineTo(-3.6, 0.74); s.lineTo(-3.6, 0.3);
  // door openings (holes through the car; the interior sits inside them)
  for (const [x0, x1] of [REAR_DOOR, [FRONT_DOOR[0] + 0.02, FRONT_DOOR[1]]]) {
    const top = x0 > 1 ? 1.22 : 1.36;
    const h = new THREE.Path(); h.moveTo(x0, 0.4); h.lineTo(x0, top); h.lineTo(x1, x0 > 1 ? 0.98 : top); h.lineTo(x1, 0.4); h.lineTo(x0, 0.4); s.holes.push(h);
  }
  return s;
}

export function buildLimo(env) {
  const root = new THREE.Group(); root.name = 'set.street.limo';
  const body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshStandardMaterial({ color: '#08090c', roughness: 0.16, metalness: 0.55, envMap: env, envMapIntensity: 1.5 });
  const inner = new THREE.MeshStandardMaterial({ color: '#16080a', roughness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#d8dce4', roughness: 0.12, metalness: 1.0, envMap: env, envMapIntensity: 1.8 });
  const goldM = new THREE.MeshStandardMaterial({ map: tex(goldCanvas({ base: '#f2c652', seed: 27 })), color: '#ffffff', roughness: 0.2, metalness: 1.0, envMap: env, envMapIntensity: 2.2, emissive: '#5a3a08', emissiveIntensity: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ color: '#05070a', roughness: 0.06, metalness: 0.2, envMap: env, envMapIntensity: 1.4 });
  const diamond = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0.1, envMap: env, envMapIntensity: 3.0, emissive: '#d8ecff', emissiveIntensity: 0.55, flatShading: true });
  const velvet = mat(tex(velvetCanvas('#8a1424', 61), { repeat: [2, 1] }), { rough: 0.9 });
  const leather = mat(tex(leatherCanvas('#2a1a14', 63)), { rough: 0.5 });
  // body: the side profile extruded across the width (door holes go through; interior placed in them)
  const geo = new THREE.ExtrudeGeometry(limoProfile(), { depth: WID, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 8 });
  geo.translate(0, 0, -WID / 2);
  const bm = mesh(geo, [paint, inner], 'limoBody'); body.add(bm);
  // windows: tinted glass bands along both sides (not over the door openings), windshield + rear window
  for (const sd of [-1, 1]) {
    const zz = sd * (WID / 2 + 0.045);
    const segs = sd > 0 ? [[-2.45, -1.12], [0.02, 1.48]] : [[-2.45, 1.48]];
    for (const [a, b] of segs) { const w = mesh(new THREE.PlaneGeometry(b - a, 0.38), glass, 'limoWindow', false); w.position.set((a + b) / 2, 1.16, zz); w.rotation.y = sd > 0 ? 0 : Math.PI; body.add(w); }
    // chrome belt line + gold pinstripe + chrome rocker
    body.add(box(LEN - 0.4, 0.03, 0.02, chrome, 0, 0.93, sd * (WID / 2 + 0.05), 'limoBelt', false));
    body.add(box(LEN - 0.5, 0.025, 0.02, goldM, 0, 0.66, sd * (WID / 2 + 0.05), 'limoStripe', false));
    body.add(box(LEN - 2.2, 0.06, 0.03, chrome, 0, 0.33, sd * (WID / 2 + 0.045), 'limoRocker', false));
  }
  const ws = mesh(new THREE.PlaneGeometry(1.86, 0.93), glass, 'limoWindshield', false); ws.position.set(1.95, 1.18, 0); ws.rotation.set(0, Math.PI / 2, 0); ws.rotateX(-0.72); body.add(ws);
  const rw = mesh(new THREE.PlaneGeometry(1.86, 0.68), glass, 'limoRearWindow', false); rw.position.set(-2.8, 1.17, 0); rw.rotation.set(0, -Math.PI / 2, 0); rw.rotateX(-0.82); body.add(rw);
  // grille, bumpers, lights, hood ornament
  body.add(box(0.06, 0.3, 1.1, chrome, 3.63, 0.6, 0, 'limoGrille'));
  for (let i = 0; i < 6; i++) body.add(box(0.07, 0.02, 1.0, paint, 3.64, 0.48 + i * 0.048, 0, 'limoGrilleSlat', false));
  body.add(box(0.12, 0.12, WID + 0.06, chrome, 3.62, 0.36, 0, 'limoBumperF'));
  body.add(box(0.12, 0.12, WID + 0.06, chrome, -3.62, 0.36, 0, 'limoBumperR'));
  const headM = new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4d0', emissiveIntensity: 2.2, roughness: 0.2 });
  const tailM = new THREE.MeshStandardMaterial({ color: '#5a0808', emissive: '#ff2010', emissiveIntensity: 1.6, roughness: 0.3 });
  for (const sd of [-1, 1]) {
    body.add(box(0.05, 0.12, 0.34, headM, 3.63, 0.72, sd * 0.72, 'limoHead', false));
    body.add(box(0.05, 0.12, 0.3, tailM, -3.63, 0.72, sd * 0.74, 'limoTail', false));
  }
  const orn = mesh(new THREE.ConeGeometry(0.035, 0.12, 5), goldM, 'limoOrnament'); orn.position.set(3.38, 0.93, 0); body.add(orn);
  // interior seen through the curb-side rear door: velvet bench facing forward, leather side panel, warm light
  const intr = new THREE.Group(); intr.name = 'limoInterior'; body.add(intr);
  intr.add(box(0.85, 0.42, 1.8, velvet, -0.85, 0.62, 0, 'limoSeat'));
  intr.add(box(0.25, 0.65, 1.8, velvet, -1.0, 1.05, 0, 'limoSeatBack'));
  intr.add(box(1.1, 0.04, 1.85, mat(tex(carpetDarkCanvas(67))), -0.55, 0.42, 0, 'limoFloor', false));
  const [hlMap, hlEmi] = headlinerCanvas(65);
  const hlM = mat(tex(hlMap), { rough: 0.8, emissive: '#ffffff', emissiveIntensity: 1.2 }); hlM.emissiveMap = tex(hlEmi);
  intr.add(box(1.05, 0.03, 1.85, hlM, -0.55, 1.37, 0, 'limoHeadliner', false));
  intr.add(box(1.0, 0.9, 0.04, leather, -0.55, 0.88, -0.94, 'limoFarPanel', false));
  const glassM = new THREE.MeshStandardMaterial({ color: '#f8f0e0', transparent: true, opacity: 0.55, roughness: 0.05, envMap: env });
  for (const dz of [-0.2, 0.15]) { const cg = mesh(new THREE.CylinderGeometry(0.03, 0.012, 0.13, 6), glassM, 'champagne', false); cg.position.set(-0.6, 0.92, dz); intr.add(cg); }
  intr.add(box(0.3, 0.2, 0.6, leather, -0.3, 0.6, 0.2, 'limoConsole'));
  // front interior (dark) behind the front door
  body.add(box(0.7, 0.4, 1.7, leather, 1.95, 0.62, 0, 'limoFrontSeat'));
  body.add(box(0.2, 0.55, 1.7, leather, 1.62, 0.98, 0, 'limoFrontSeatBack'));
  const lamp = new THREE.PointLight('#ffcf8a', 0, 4.5, 1.6); lamp.position.set(-0.55, 1.15, 0.35); lamp.name = 'limoInteriorLight'; body.add(lamp);
  const lampBulb = box(0.3, 0.03, 0.08, new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffd890', emissiveIntensity: 0 }), -0.55, 1.34, 0.4, 'limoBulb', false); body.add(lampBulb);
  // doors (curb side): hinged at the front edge, swing out toward +Z
  const door = (x0, x1, top, slopeTop, name) => {
    const piv = new THREE.Group(); piv.name = name; piv.position.set(x1, 0, WID / 2 + 0.005); body.add(piv);
    const s = new THREE.Shape(); s.moveTo(x0 - x1, 0.4); s.lineTo(x0 - x1, top); s.lineTo(0, slopeTop); s.lineTo(0, 0.4); s.lineTo(x0 - x1, 0.4);
    const dg = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false }); dg.translate(0, 0, -0.03);
    piv.add(mesh(dg, [paint, leather], `${name}Panel`));
    const wt = Math.min(top, slopeTop);
    const wg = mesh(new THREE.PlaneGeometry(Math.abs(x0 - x1) - 0.12, 0.34), glass, `${name}Glass`, false); wg.position.set((x0 - x1) / 2, wt - 0.22, 0.034); piv.add(wg);
    piv.add(box(Math.abs(x0 - x1) - 0.04, 0.025, 0.02, goldM, (x0 - x1) / 2, 0.66, 0.04, `${name}Stripe`, false));
    piv.add(box(0.14, 0.035, 0.03, goldM, (x0 - x1) + 0.14, 0.78, 0.05, `${name}Handle`, false));
    return piv;
  };
  const rearDoor = door(REAR_DOOR[0], REAR_DOOR[1], 1.36, 1.36, 'limoRearDoor');
  const frontDoor = door(FRONT_DOOR[0] + 0.02, FRONT_DOOR[1], 1.22, 0.98, 'limoFrontDoor');
  // the road-side rear door is closed for ever: a plain panel closes the hole
  for (const [x0, x1] of [REAR_DOOR, [FRONT_DOOR[0] + 0.02, FRONT_DOOR[1]]]) {
    const pnl = box(x1 - x0, x0 > 1 ? 0.6 : 0.96, 0.05, paint, (x0 + x1) / 2, x0 > 1 ? 0.7 : 0.88, -WID / 2 - 0.01, 'limoFarDoor'); body.add(pnl);
    const fg = mesh(new THREE.PlaneGeometry(x1 - x0 - 0.12, 0.3), glass, 'limoFarDoorGlass', false); fg.position.set((x0 + x1) / 2, x0 > 1 ? 0.98 : 1.14, -WID / 2 - 0.04); fg.rotation.y = Math.PI; body.add(fg);
  }
  // wheels: black tyre + GOLD rim with spokes and a ring of tiny diamonds (only the curb side gets the bling up close)
  const tireM = mat(tex(tireCanvas()), { rough: 0.75 });
  const wheels = [];
  for (const [wx, wz] of [[WHEEL.x, WHEEL.z], [-WHEEL.x, WHEEL.z], [WHEEL.x, -WHEEL.z], [-WHEEL.x, -WHEEL.z]]) {
    const wg = new THREE.Group(); wg.name = 'limoWheel'; wg.position.set(wx, WHEEL.r, wz); root.add(wg);
    const spin = new THREE.Group(); wg.add(spin);
    const sd = Math.sign(wz);
    const tg = new THREE.CylinderGeometry(WHEEL.r, WHEEL.r, 0.27, 14); tg.rotateX(Math.PI / 2);
    spin.add(mesh(tg, tireM, 'tyre'));
    const rg = new THREE.CylinderGeometry(0.245, 0.245, 0.03, 14); rg.rotateX(Math.PI / 2); const rim = mesh(rg, goldM, 'rim'); rim.position.z = sd * 0.13; spin.add(rim);
    const lip = new THREE.TorusGeometry(0.245, 0.022, 4, 16); const l = mesh(lip, goldM, 'rimLip'); l.position.z = sd * 0.15; spin.add(l);
    for (let i = 0; i < 6; i++) { const sp = box(0.05, 0.2, 0.025, goldM, 0, 0, sd * 0.155, 'spoke'); sp.geometry.translate(0, 0.1, 0); sp.rotation.z = i * Math.PI / 3; spin.add(sp); }
    const cap = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8).rotateX(Math.PI / 2), goldM, 'hubCap'); cap.position.z = sd * 0.16; spin.add(cap);
    if (sd > 0) for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, d = mesh(new THREE.OctahedronGeometry(0.014, 0), diamond, 'rimDiamond', false); d.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, sd * 0.165); spin.add(d); }
    wheels.push({ g: wg, spin, front: wx > 0 });
  }
  // headlight beams on the wet road (soft sprites) + soft mist puffs at the open door
  const puffT = tex(puffCanvas(64, 85), { nearest: false });
  const puffs = [];
  for (let i = 0; i < 7; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffT, color: '#ffe8d0', transparent: true, opacity: 0, depthWrite: false, fog: false }));
    sp.name = 'limoMist'; sp.userData.noAudit = true; sp.userData.i = i; root.add(sp); puffs.push(sp);
  }
  // shadow blob under the car
  const blob = mesh(new THREE.PlaneGeometry(LEN + 0.6, WID + 0.7), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.45, depthWrite: false }), 'limoShadow', false);
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.006; blob.userData.noAudit = true; root.add(blob);
  return { group: root, rearDoor, frontDoor, wheels, lamp, lampBulb, puffs,
    // world anchors for a given parked x (z of the car centre from layout)
    anchors(x) { const z = STREET.limo.pos[1]; return { frontWheel: [x + WHEEL.x, WHEEL.r, z + WHEEL.z + 0.16], rearDoorCentre: [x - 0.55, 0.9, z + WID / 2], rearDoorHandle: [x + REAR_DOOR[0] + 0.14, 0.78, z + WID / 2 + 0.05] }; },
    update(t, st) {
      const x = st.limoX, z = STREET.limo.pos[1];
      root.position.set(x, 0, z);
      root.visible = x > -40;
      const ang = -(x / WHEEL.r);
      for (const w of wheels) w.spin.rotation.z = ang;
      rearDoor.rotation.y = smooth(clamp(st.limoDoor)) * 1.25;
      frontDoor.rotation.y = smooth(clamp(st.guardDoor)) * 1.15;
      const open = clamp(st.limoDoor);
      lamp.intensity = open * 6; lampBulb.material.emissiveIntensity = open * 3;
      const mist = clamp(st.limoMist);
      for (const sp of puffs) {
        const i = sp.userData.i, ph = (t * 0.35 + i / puffs.length) % 1;
        sp.position.set(-0.55 + (hash1(i) - 0.5) * 0.7, 0.45 + ph * 0.6 + hash1(i + 9) * 0.2, WID / 2 + 0.15 + ph * 0.9);
        const s = 0.5 + ph * 0.9; sp.scale.set(s, s * 0.7, 1);
        sp.material.opacity = mist * 0.35 * Math.sin(Math.PI * ph);
      }
    } };
}

// ---------------------------------------------------------------- YOU's shopping cart with everything he owns
export function buildCart(env) {
  const g = new THREE.Group(); g.name = 'set.street.cart';
  const [cx, cz] = STREET.cart.pos;
  g.position.set(cx, STREET.sideY, cz); g.rotation.y = STREET.cart.rotY;
  const rustM = mat(tex(rustCanvas(73)), { rough: 0.6, metal: 0.5 });
  const W = 0.55, Lc = 0.85, H0 = 0.42, H1 = 0.92;
  const bar = (x0, y0, z0, x1, y1, z1, r = 0.008) => {
    const a = V(x0, y0, z0), b = V(x1, y1, z1), len = a.distanceTo(b);
    const m = mesh(new THREE.CylinderGeometry(r, r, len, 4), rustM, 'cartBar');
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); g.add(m);
  };
  // basket: tapered box of wires
  const fw = W / 2, bw = W / 2 * 0.85;
  for (let i = 0; i <= 6; i++) { const x = -Lc / 2 + (i / 6) * Lc, w = fw + (bw - fw) * (i / 6); bar(x, H0, -w, x, H1, -w * 1.05); bar(x, H0, w, x, H1, w * 1.05); }
  for (let j = 0; j <= 4; j++) { const y = H0 + (j / 4) * (H1 - H0); bar(-Lc / 2, y, -fw, Lc / 2, y, -bw); bar(-Lc / 2, y, fw, Lc / 2, y, bw); bar(-Lc / 2, y, -fw, -Lc / 2, y, fw); bar(Lc / 2, y, -bw, Lc / 2, y, bw); }
  for (let i = 0; i <= 5; i++) { const z = -fw + (i / 5) * 2 * fw; bar(-Lc / 2, H0, z, Lc / 2, H0, z * 0.85); }
  // handle + frame legs + wheels
  bar(-Lc / 2 - 0.12, H1 + 0.08, -fw, -Lc / 2 - 0.12, H1 + 0.08, fw, 0.016);
  for (const s of [-1, 1]) { bar(-Lc / 2, H1, s * fw, -Lc / 2 - 0.12, H1 + 0.08, s * fw, 0.012); bar(-Lc / 2, H0, s * fw, -Lc / 2 + 0.05, 0.08, s * fw, 0.014); bar(Lc / 2, H0, s * bw, Lc / 2 - 0.05, 0.08, s * bw, 0.014); }
  const wm = mat('#222222', { rough: 0.6 });
  for (const [x, z] of [[-Lc / 2 + 0.05, fw], [-Lc / 2 + 0.05, -fw], [Lc / 2 - 0.05, bw], [Lc / 2 - 0.05, -bw]]) { const w = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8).rotateX(Math.PI / 2), wm, 'cartWheel'); w.position.set(x, 0.05, z); g.add(w); }
  // contents
  const bagM = mat(tex(sleepingBagCanvas(75), { repeat: [1, 1] }), { rough: 0.85 });
  const bag = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 10), bagM, 'sleepingBag'); bag.rotation.x = Math.PI / 2; bag.rotation.z = 0.2; bag.position.set(-0.12, H1 - 0.02, 0.02); g.add(bag);
  const potM = new THREE.MeshStandardMaterial({ color: '#9a9ea4', roughness: 0.35, metalness: 0.8, envMap: env, envMapIntensity: 0.8 });
  const pg = new THREE.CylinderGeometry(0.13, 0.11, 0.16, 10); { const p = pg.attributes.position; for (let i = 0; i < p.count; i++) if (p.getX(i) > 0.06 && p.getY(i) > 0) p.setX(i, p.getX(i) - 0.035); pg.computeVertexNormals(); }
  const pot = mesh(pg, potM, 'dentedPot'); pot.position.set(0.22, H1 - 0.05, -0.12); pot.rotation.z = -0.25; g.add(pot);
  const ph = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 4), potM, 'potHandle'); ph.rotation.z = Math.PI / 2; ph.position.set(0.36, H1 + 0.0, -0.12); g.add(ph);
  const cardM = mat(tex(cardboardBlankCanvas(79)), { rough: 0.9 });
  const card = box(0.5, 0.38, 0.02, cardM, 0.0, H1 + 0.1, -0.24, 'cardboard'); card.rotation.set(-0.15, 0.1, 0.05); g.add(card);
  const terM = mat(tex(terracottaCanvas(81)), { rough: 0.8 });
  const plantPot = mesh(new THREE.CylinderGeometry(0.075, 0.055, 0.12, 8), terM, 'plantPot'); plantPot.position.set(0.28, H1 + 0.02, 0.14); g.add(plantPot);
  const plant = mesh(new THREE.IcosahedronGeometry(0.1, 1), mat('#3f8a32', { rough: 0.8 }), 'plant'); plant.position.set(0.28, H1 + 0.15, 0.14); g.add(plant);
  const duckM = mat('#ffd21a', { rough: 0.4 }), beakM = mat('#ff8a1a', { rough: 0.4 });
  const duck = new THREE.Group(); duck.position.set(0.05, H1 + 0.06, 0.2); g.add(duck);
  const db = mesh(new THREE.SphereGeometry(0.06, 8, 6), duckM, 'duck'); db.scale.set(1.25, 0.85, 1); duck.add(db);
  const dh = mesh(new THREE.SphereGeometry(0.04, 8, 6), duckM, 'duckHead'); dh.position.set(0.05, 0.07, 0); duck.add(dh);
  const bk = mesh(new THREE.ConeGeometry(0.018, 0.04, 5), beakM, 'duckBeak'); bk.rotation.z = -Math.PI / 2; bk.position.set(0.1, 0.065, 0); duck.add(bk);
  for (const sd of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.006, 4, 3), mat('#111111'), 'duckEye', false); e.position.set(0.075, 0.085, sd * 0.022); duck.add(e); }
  const umbM = mat(tex(umbrellaCanvas(77)), { rough: 0.7, side: THREE.DoubleSide });
  umbM.alphaTest = 0.5; umbM.transparent = false;
  const umb = mesh(new THREE.ConeGeometry(0.42, 0.3, 8, 1, true), umbM, 'umbrella'); umb.position.set(-0.32, H1 + 0.42, -0.05); umb.rotation.z = 0.35; g.add(umb);
  const stick = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.75, 4), mat('#3a2a1a'), 'umbrellaStick'); stick.position.set(-0.24, H1 + 0.12, -0.05); stick.rotation.z = 0.35; g.add(stick);
  return { group: g };
}

// ---------------------------------------------------------------- puddles: dark, glossy, slightly irregular
export function buildPuddles(env) {
  const g = new THREE.Group(); g.name = 'set.street.puddles';
  const m = new THREE.MeshStandardMaterial({ color: '#0a0d14', roughness: 0.02, metalness: 0.6, envMap: env, envMapIntensity: 2.2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const spots = [[4.2, -4.7, 1.6, 0.0], [-1.3, -3.0, 0.45, STREET.sideY], [6.0, -2.2, 0.6, STREET.sideY], [-4.5, -6.5, 1.1, 0.0], [9.5, -5.2, 0.9, 0.0], [12, -1.8, 0.5, STREET.sideY]];
  for (const [x, z, r, y] of spots) {
    const geo = new THREE.CircleGeometry(r, 18);
    const p = geo.attributes.position;
    for (let i = 1; i < p.count; i++) { const a = Math.atan2(p.getY(i), p.getX(i)), k = 0.8 + 0.25 * Math.sin(a * 3 + x) + 0.12 * Math.sin(a * 5 + z); p.setXY(i, p.getX(i) * k * 1.3, p.getY(i) * k * 0.8); }
    const pm = mesh(geo, m, 'puddle', false); pm.rotation.x = -Math.PI / 2; pm.position.set(x, y + 0.004, z); g.add(pm);
  }
  return { group: g };
}
