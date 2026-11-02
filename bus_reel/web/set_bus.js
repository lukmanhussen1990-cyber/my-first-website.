// The BUS on a long, sunny, tree-lined morning street. The street is static (world); the bus group moves along -Z
// (state busZ, default busZ(t) from layout.js), so trees, lamps and buildings slide past the windows.
// state: busZ, doorFront 0..1, doorMid 0..1, winOpen 0..1 (the upper pane at ME's row slides open), wheelSpin (auto)
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mat, tex, paint, clamp, lerp, smooth, hash1, hexToRgb, chamferBox } from './lib.js';
import { BUS, busZ, STOP_Z, RESERVED } from './layout.js';
import { signCanvas, glowDiscCanvas, windowCanvas } from './set_tex2.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function moquetteCanvas() {      // classic bus seat fabric: deep blue with a small cyan/yellow geometric pattern
  return paint(16, 16, (x, y) => {
    let c = [36, 70, 160];
    const k = (x + y * 2) % 8, j = (x * 3 + y) % 11;
    if (k === 0) c = [60, 150, 220];
    if (j === 0 && y % 4 === 1) c = [240, 200, 60];
    const n = (hash1(x * 13 + y * 7) - 0.5) * 12;
    return [c[0] + n, c[1] + n, c[2] + n];
  });
}
function floorCanvas() {         // grey rubber floor with little ridges
  return paint(16, 16, (x, y) => { const r = (y % 4 === 0) ? -18 : 0; const n = (hash1(x * 7 + y * 3) - 0.5) * 8; return [92 + r + n, 96 + r + n, 104 + r + n]; });
}
function asphaltCanvas2() {
  return paint(32, 32, (x, y) => { const n = (hash1(x * 17 + y * 31) - 0.5) * 22 + (hash1(Math.floor(x / 3) * 5 + Math.floor(y / 3) * 11) - 0.5) * 10; return [86 + n, 88 + n, 94 + n]; });
}
function slabCanvas2() {
  return paint(32, 32, (x, y) => { const g = (x % 16 === 0 || y % 16 === 0) ? -26 : 0; const n = (hash1(x * 3 + y * 19) - 0.5) * 12; return [196 + g + n, 190 + g + n, 180 + g + n]; });
}
function dashCanvas() { return paint(4, 32, (x, y) => (y < 14 ? [250, 250, 245, 255] : [0, 0, 0, 0])); }
function adCanvas(i) {           // little ad cards above the windows (no text, just shapes)
  const cols = [[255, 120, 90], [90, 180, 255], [120, 210, 120], [255, 210, 90], [200, 140, 255]];
  const c = cols[i % cols.length];
  return paint(32, 12, (x, y) => (x < 1 || y < 1 || x > 30 || y > 10 ? [250, 250, 250] : Math.hypot(x - 8, y - 6) < 4 ? [255, 255, 255] : (y > 3 && y < 5 && x > 14 && x < 28) || (y > 6 && y < 8 && x > 14 && x < 24) ? [255, 255, 255] : c));
}

export function buildBus(env, world) {
  const group = new THREE.Group(); group.name = 'set.bus';
  const bus = new THREE.Group(); bus.name = 'set.bus.body'; group.add(bus);
  const gloss = (c, r = 0.3, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, envMap: env, envMapIntensity: 0.8 });
  const addB = (m, name, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; m.name = `set.bus.${name}`; bus.add(m); return m; };
  const boxB = (w, h, d, material, x, y, z, name, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x, y, z); return addB(m, name, cast); };
  const addW = (m, name, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; m.name = `set.street.${name}`; group.add(m); return m; };

  // ---------------------------------------------------------------- materials
  const white = mat('#f6f4ee', { rough: 0.45 }), blue = mat('#2f6fd6', { rough: 0.4 }), roofM = mat('#d8dadc', { rough: 0.6 });
  const inWall = mat('#dde1e6', { rough: 0.7 }), inLow = mat('#b9c1cc', { rough: 0.7 }), ceilM = mat('#f2f3f4', { rough: 0.8 });
  const darkM = mat('#24262b', { rough: 0.6 }), rubber = mat('#1a1b1e', { rough: 0.9 });
  const chrome = gloss('#d4d8de', 0.22, 0.85);
  const glass = new THREE.MeshStandardMaterial({ color: '#cfe8f4', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, envMap: env, envMapIntensity: 0.6 });
  const fabric = mat(tex(moquetteCanvas(), { repeat: [2, 2] }), { rough: 0.95 });
  const shell = mat('#2a3550', { rough: 0.5 });
  const floorM = mat(tex(floorCanvas(), { repeat: [6, 24] }), { rough: 0.8 });
  const W2 = BUS.halfW, IN = BUS.inner, Z0 = BUS.z0, Z1 = BUS.z1, WY = BUS.win;

  // ---------------------------------------------------------------- body: floor, roof, front, back
  boxB(2 * IN, 0.12, BUS.len, floorM, 0, -0.06, 0, 'floor', false);
  boxB(2 * W2, 0.08, BUS.len, darkM, 0, -0.16, 0, 'under');
  const roof = boxB(2 * W2, BUS.roof - BUS.ceil, BUS.len, [roofM, roofM, roofM, ceilM, roofM, roofM], 0, (BUS.roof + BUS.ceil) / 2, 0, 'roof');
  roof.material = [white, white, roofM, ceilM, white, white];
  boxB(1.4, 0.3, 2.2, roofM, 0, BUS.roof + 0.15, 1.5, 'ac');
  // front: lower panel with headlights, windshield, destination sign "COLLEGE"
  boxB(2 * W2, 0.92, 0.1, [white, white, white, white, white, inLow], 0, 0.34, Z0 - 0.0, 'frontLow');
  const lightM = mat('#fff8e0', { emissive: '#fff2c0', emissiveIntensity: 1.2 });
  for (const sx of [-0.85, 0.85]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.04), lightM); h.position.set(sx, 0.2, Z0 - 0.06); addB(h, 'headlight', false); }
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(2 * W2 - 0.12, 1.4), glass); ws.position.set(0, 1.5, Z0 + 0.02); addB(ws, 'windshield', false, false);
  for (const sx of [-1, 1]) boxB(0.08, 1.45, 0.1, white, sx * (W2 - 0.04), 1.5, Z0, 'aPillar');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.24), new THREE.MeshBasicMaterial({ map: tex(signCanvas(['7  COLLEGE'], { w: 256, h: 40, bg: '#111111', color: '#ffa020' })) }));
  sign.position.set(0, 2.33, Z0 - 0.03); sign.rotation.y = Math.PI; addB(sign, 'destSign', false, false);
  boxB(2 * W2, 0.3, 0.1, white, 0, 2.35, Z0 + 0.03, 'signBox');
  // back wall with a small window
  boxB(2 * W2, 1.08, 0.1, [white, white, white, white, inLow, white], 0, 0.42, Z1, 'backLow');
  boxB(2 * W2, 0.55, 0.1, [white, white, white, white, inWall, white], 0, 2.2, Z1, 'backTop');
  boxB(0.5, 0.97, 0.1, white, -W2 + 0.25, 1.45, Z1, 'backSide'); boxB(0.5, 0.97, 0.1, white, W2 - 0.25, 1.45, Z1, 'backSide');
  const bw = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.95), glass); bw.position.set(0, 1.45, Z1); addB(bw, 'backWin', false, false);

  // ---------------------------------------------------------------- side walls (window bays, pillars, doors)
  const openings = { 1: [[BUS.frontDoor.z0, BUS.frontDoor.z1], [BUS.midDoor.z0, BUS.midDoor.z1]], '-1': [] };
  const segs = (side, a, b) => {      // [a,b] minus the door openings of that side
    let out = [[a, b]];
    for (const [d0, d1] of openings[side]) out = out.flatMap(([s0, s1]) => (d1 <= s0 || d0 >= s1 ? [[s0, s1]] : [[s0, d0], [d1, s1]].filter(([u, v]) => v - u > 0.01)));
    return out;
  };
  const panes = [];
  for (const side of [-1, 1]) {
    const x = side * (W2 - 0.035), ext = side > 0 ? 0 : 1;       // material index of the exterior face (+x: 0, -x: 1)
    const sideMat = (outer, inner) => { const a = [outer, outer, outer, outer, outer, outer]; a[ext] = outer; a[1 - ext] = inner; return a; };
    for (const [a, b] of segs(side, Z0, Z1)) {
      boxB(0.07, 0.62, b - a, sideMat(blue, inLow), x, 0.19, (a + b) / 2, 'wallLow');                 // -0.12 .. 0.5 (blue band)
      boxB(0.07, WY.y0 - 0.5, b - a, sideMat(white, inLow), x, (0.5 + WY.y0) / 2, (a + b) / 2, 'wallMid');
    }
    boxB(0.07, BUS.ceil - WY.y1 + 0.02, BUS.len, sideMat(white, inWall), x, (WY.y1 + BUS.ceil) / 2, 0, 'wallTop');
    // window region: pillars + panes
    const bayHalf = 0.6, edges = [];
    for (const c of BUS.bays) edges.push(c - bayHalf, c + bayHalf);
    const solid = [[Z0, BUS.bays[0] - bayHalf], [BUS.bays[BUS.bays.length - 1] + bayHalf, Z1]];
    for (const [a, b] of solid) for (const [s0, s1] of segs(side, a, b)) boxB(0.07, WY.y1 - WY.y0, s1 - s0, sideMat(white, inWall), x, (WY.y0 + WY.y1) / 2, (s0 + s1) / 2, 'wallSolid');
    for (const e of edges) boxB(0.075, WY.y1 - WY.y0, 0.09, sideMat(white, inWall), x, (WY.y0 + WY.y1) / 2, e, 'pillar');
    for (const c of BUS.bays) {
      if (side > 0 && c + bayHalf > BUS.midDoor.z0 && c - bayHalf < BUS.midDoor.z1) {   // the mid door takes this bay (glass door instead)
        continue;
      }
      for (const y of [WY.y0, WY.ySlide, WY.y1]) boxB(0.05, 0.035, 1.2, rubber, x, y, c, 'winFrame', false);
      const lo = new THREE.Mesh(new THREE.PlaneGeometry(1.15, WY.ySlide - WY.y0), glass); lo.position.set(x, (WY.y0 + WY.ySlide) / 2, c); lo.rotation.y = Math.PI / 2; addB(lo, 'paneLow', false, false);
      const up = new THREE.Group(); up.position.set(x - side * 0.012, (WY.ySlide + WY.y1) / 2, c); bus.add(up);
      const upPane = new THREE.Mesh(new THREE.PlaneGeometry(1.15, WY.y1 - WY.ySlide), glass); upPane.rotation.y = Math.PI / 2; up.add(upPane);
      for (const sz of [-0.575, 0.575]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, WY.y1 - WY.ySlide, 0.03), rubber); f.position.z = sz; up.add(f); }
      panes.push({ side, c, up });
    }
  }
  const mePane = panes.find((p) => p.side > 0 && Math.abs(p.c - BUS.me.row) < 0.01);
  // doors (right side): two glass leaves each, hinged at their outer edges, folding inward
  const doors = {};
  for (const [name, D] of [['front', BUS.frontDoor], ['mid', BUS.midDoor]]) {
    const w = (D.z1 - D.z0) / 2, leaves = [];
    for (const [k, hz] of [[0, D.z0], [1, D.z1]]) {
      const piv = new THREE.Group(); piv.position.set(W2 - 0.05, 0, hz); bus.add(piv);
      const dir = k === 0 ? 1 : -1;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, 1.9), glass); pane.rotation.y = Math.PI / 2; pane.position.set(0, 1.05, dir * w / 2); piv.add(pane);
      for (const [fy, fh] of [[0.05, 0.1], [2.0, 0.1], [1.05, 0.04]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.04, fh, w), white); f.position.set(0, fy, dir * w / 2); f.castShadow = true; piv.add(f); }
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 0.05), rubber); edge.position.set(0, 1.05, dir * (w - 0.02)); piv.add(edge);
      leaves.push({ piv, dir });
    }
    doors[name] = leaves;
    boxB(0.07, BUS.ceil - 2.1, D.z1 - D.z0, white, W2 - 0.035, (2.1 + BUS.ceil) / 2, (D.z0 + D.z1) / 2, 'doorTop');
    const step = boxB(0.45, 0.06, D.z1 - D.z0, mat('#3a3d44', { rough: 0.8 }), W2 + 0.0, -0.2, (D.z0 + D.z1) / 2, 'step');
    step.material = mat('#f2c230', { rough: 0.6 });
  }
  // wheels
  const wheels = [];
  const tireG = new THREE.CylinderGeometry(0.5, 0.5, 0.32, 18); tireG.rotateZ(Math.PI / 2);
  const hubG = new THREE.CylinderGeometry(0.26, 0.26, 0.34, 10); hubG.rotateZ(Math.PI / 2);
  for (const z of [-3.9, 3.3]) for (const sx of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(sx * 1.08, BUS.roadY + 0.5, z); bus.add(w);
    const tire = new THREE.Mesh(tireG, rubber); tire.castShadow = true; w.add(tire);
    const hub = new THREE.Mesh(hubG, gloss('#b8bcc4', 0.3, 0.7)); w.add(hub);
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.05), darkM); b.rotation.x = (i / 5) * Math.PI; w.add(b); }
    wheels.push(w);
    boxB(0.08, 0.06, 1.3, darkM, sx * (W2 + 0.01), 0.58, z, 'arch');
  }

  // ---------------------------------------------------------------- interior: ceiling lights, rails, straps, poles, ads
  const lightStrip = mat('#ffffff', { emissive: '#fff8ea', emissiveIntensity: 0.9 });
  for (const sx of [-0.62, 0.62]) boxB(0.16, 0.02, BUS.len - 1.6, lightStrip, sx, BUS.ceil - 0.012, 0.5, 'ceilLight', false);
  for (const sx of [-0.38, 0.38]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 9.6, 8), chrome); r.rotation.x = Math.PI / 2; r.position.set(sx, 1.95, 0.6); addB(r, 'rail');
    for (let z = -3.9; z < 5.4; z += 0.55) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.012), mat('#2a2c32')); st.position.set(sx, 1.86, z); addB(st, 'strap', true);
      const lp = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 10), mat('#e8e8e8', { rough: 0.5 })); lp.position.set(sx, 1.75, z); lp.rotation.y = Math.PI / 2; addB(lp, 'strapLoop', true);
    }
  }
  for (const z of BUS.poles) for (const sx of [-0.3, 0.3]) {
    if (sx > 0 && z > BUS.midDoor.z0 - 0.2 && z < BUS.midDoor.z1 + 0.2) continue;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, BUS.ceil, 8), chrome); p.position.set(sx, BUS.ceil / 2, z); addB(p, 'pole');
  }
  for (const z of [BUS.frontDoor.z0 - 0.05, BUS.frontDoor.z1 + 0.05, BUS.midDoor.z0 - 0.06, BUS.midDoor.z1 + 0.06]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, BUS.ceil, 8), chrome); p.position.set(W2 - 0.22, BUS.ceil / 2, z); addB(p, 'doorPole'); }
  BUS.bays.forEach((c, i) => {
    for (const side of [-1, 1]) {
      const ad = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.24), mat(tex(adCanvas(i * 2 + (side > 0 ? 1 : 0))), { rough: 0.6 }));
      ad.position.set(side * (IN - 0.05), 2.1, c); ad.rotation.set(0, -side * Math.PI / 2, side * 0); ad.rotateX(0.35); addB(ad, 'ad', false);
    }
  });

  // ---------------------------------------------------------------- seats (blue moquette), driver area
  const seatsFree = [];
  const seat = (x, z, side) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); bus.add(g);
    const cush = new THREE.Mesh(chamferBox(0.42, 0.1, 0.42, 0.03), fabric); cush.position.set(0, BUS.seatY - 0.05, 0); g.add(cush);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), shell); base.position.set(0, BUS.seatY - 0.12, 0); g.add(base);
    const back = new THREE.Mesh(chamferBox(0.42, 0.56, 0.08, 0.03), fabric); back.position.set(0, BUS.seatY + 0.3, 0.22); back.rotation.x = -0.1; g.add(back);
    const bshell = new THREE.Mesh(chamferBox(0.43, 0.58, 0.03, 0.01), shell); bshell.position.set(0, BUS.seatY + 0.3, 0.27); bshell.rotation.x = -0.1; g.add(bshell);
    if (Math.abs(x) < 0.7) {         // aisle seat: leg pedestal + a chrome grab handle on the backrest
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, BUS.seatY - 0.12, 8), chrome); leg.position.set(-side * 0.15, (BUS.seatY - 0.12) / 2, 0); g.add(leg);
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 12, Math.PI), chrome); h.position.set(-side * 0.12, BUS.seatY + 0.6, 0.25); h.rotation.set(0, 0, 0); g.add(h);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };
  for (const z of BUS.rows) for (const side of [-1, 1]) {
    if (side > 0 && z > BUS.midDoor.z0 - 0.35 && z < BUS.midDoor.z1 + 0.25) continue;
    seat(side * BUS.seatX.win, z, side); seat(side * BUS.seatX.aisle, z, side);
  }
  for (let i = 0; i < 5; i++) seat(-0.96 + i * 0.48, 5.5, i < 2 ? -1 : 1);
  // driver: seat, wheel, dashboard, partition, fare box
  const [dx, dz] = BUS.driver.pos;
  const ds = new THREE.Mesh(chamferBox(0.55, 0.14, 0.55, 0.04), mat('#2a2c34', { rough: 0.7 })); ds.position.set(dx, 0.48, dz + 0.02); addB(ds, 'driverSeat');
  const dsb = new THREE.Mesh(chamferBox(0.55, 0.7, 0.12, 0.04), mat('#2a2c34', { rough: 0.7 })); dsb.position.set(dx, 0.92, dz + 0.32); dsb.rotation.x = -0.12; addB(dsb, 'driverBack');
  boxB(2 * IN, 0.4, 0.42, mat('#2c2e34', { rough: 0.6 }), 0, 0.82, Z0 + 0.25, 'dash');
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 8, 24), darkM); wheel.position.set(dx, 1.08, dz - 0.42); wheel.rotation.x = -1.05; addB(wheel, 'steering');
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.45, 8), darkM); col.position.set(dx, 0.92, dz - 0.52); col.rotation.x = -1.05 + Math.PI / 2; addB(col, 'column');
  const part = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.2), glass); part.position.set(-0.78, 1.2, dz + 0.55); addB(part, 'partition', false, false);
  boxB(0.85, 0.05, 0.05, chrome, -0.78, 1.82, dz + 0.55, 'partTop'); boxB(0.05, 1.8, 0.05, chrome, -0.36, 0.9, dz + 0.55, 'partPole');
  boxB(0.28, 0.5, 0.25, mat('#5a5f6a', { rough: 0.5 }), -0.12, 1.0, dz - 0.25, 'farebox');
  boxB(0.3, 0.06, 0.25, mat('#e04040', { emissive: '#600', emissiveIntensity: 0.6 }), -0.12, 1.27, dz - 0.25, 'fareLight');
  // the big rear-view mirror: a real mirror (Reflector), angled toward the driver's face
  const MR = BUS.mirror;
  const mirror = new Reflector(new THREE.PlaneGeometry(MR.w, MR.h), { textureWidth: 640, textureHeight: 240, color: 0xd8dde4, clipBias: 0.003 });
  mirror.name = 'set.bus.mirror';
  const mirrorPiv = new THREE.Group(); mirrorPiv.position.set(...MR.pos); bus.add(mirrorPiv);
  const toEye = V(...MR.eye).sub(V(...MR.pos)).normalize(), toCam = V(...MR.cam).sub(V(...MR.pos)).normalize();
  mirrorPiv.quaternion.setFromUnitVectors(V(0, 0, 1), toEye.add(toCam).normalize());
  mirrorPiv.add(mirror);
  const mback = new THREE.Mesh(new THREE.BoxGeometry(MR.w + 0.05, MR.h + 0.05, 0.04), darkM); mback.position.z = -0.025; mirrorPiv.add(mback);
  const marm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 6), darkM); marm.position.set(MR.pos[0], MR.pos[1] + 0.14, MR.pos[2]); addB(marm, 'mirrorArm');

  // ---------------------------------------------------------------- the crowd: simple blocky extras in the other seats
  // (+ a few standing in the aisle). state crowd 0/1, crowdLean (rad: the hard-brake jerk forward).
  const faceTex = (skin) => tex(paint(8, 8, (x, y) => {
    const c = hexToRgb(skin);
    if ((x === 2 || x === 5) && (y === 3 || y === 4)) return [30, 26, 24];
    if (y === 6 && x >= 3 && x <= 4) return [150, 70, 60];
    return c;
  }));
  const skins = ['#f2cfb4', '#d9a07a', '#a8714a', '#8a5a3a', '#e8b898', '#c58c64'];
  const shirts = ['#d84a4a', '#4a8ad8', '#f2c230', '#5aae5a', '#9a6ad0', '#f28a3a', '#3a3f4a', '#e8e2d4', '#2aa8a8', '#c84a8a'];
  const pantsC = ['#2a3448', '#3a4a68', '#4a4036', '#24262b', '#5a5048'];
  const hairs = ['#1a120c', '#3a2414', '#6a4028', '#c89a50', '#141010', '#8a8680'];
  const extras = [];
  const box = (w, h, d, m, x, y, z, parent) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.position.set(x, y, z); q.castShadow = true; q.receiveShadow = true; parent.add(q); return q; };
  const makeExtra = (i, x, z, seated) => {
    const r = (k) => hash1(i * 13.7 + k * 3.1);
    const skin = skins[Math.floor(r(1) * skins.length)], shirt = mat(shirts[Math.floor(r(2) * shirts.length)], { rough: 0.85 });
    const skinM = mat(skin, { rough: 0.8 }), pm = mat(pantsC[Math.floor(r(3) * pantsC.length)], { rough: 0.9 }), hm = mat(hairs[Math.floor(r(4) * hairs.length)], { rough: 0.9 });
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.PI; bus.add(g);       // faces -z (forward)
    const s = 0.92 + r(5) * 0.14, hipY = seated ? BUS.seatY + 0.06 : 0.88 * s;
    if (seated) { for (const sx of [-0.07, 0.07]) { box(0.11, 0.11, 0.42, pm, sx, hipY, 0.17, g); box(0.1, hipY, 0.1, pm, sx, hipY / 2, 0.36, g); } }
    else for (const sx of [-0.07, 0.07]) box(0.11, hipY, 0.11, pm, sx, hipY / 2, 0, g);
    const up = new THREE.Group(); up.position.set(0, hipY, 0); g.add(up);
    box(0.32 * s, 0.5 * s, 0.2 * s, shirt, 0, 0.25 * s, 0, up);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.23, 0.21), [skinM, skinM, hm, skinM, mat(faceTex(skin), { rough: 0.8 }), skinM]);
    head.position.set(0, 0.5 * s + 0.15, 0.0); head.castShadow = true; up.add(head);
    box(0.225, 0.07, 0.225, hm, 0, 0.5 * s + 0.27, -0.005, up);
    if (r(6) > 0.5) box(0.225, 0.18, 0.06, hm, 0, 0.5 * s + 0.17, -0.09, up);              // longer hair at the back
    const armUp = !seated && r(7) > 0.3;
    for (const sx of [-1, 1]) {
      const a = box(0.09, 0.46 * s, 0.09, shirt, sx * 0.205 * s, 0.25 * s, seated ? 0.06 : 0, up);
      if (seated) { a.rotation.x = -0.6; a.position.z = 0.12; a.position.y = 0.2 * s; }
      if (armUp && sx > 0) { a.position.set(sx * 0.2 * s, 0.68 * s, 0); }
    }
    extras.push({ g, up });
  };
  let ei = 0;
  for (const z of BUS.rows) for (const side of [-1, 1]) {
    if (side > 0 && z > BUS.midDoor.z0 - 0.35 && z < BUS.midDoor.z1 + 0.25) continue;
    for (const sx of [BUS.seatX.win, BUS.seatX.aisle]) {
      const x = side * sx;
      if (RESERVED.some(([rx, rz]) => Math.abs(rx - x) < 0.01 && Math.abs(rz - z) < 0.01)) continue;
      makeExtra(ei++, x, z + 0.04, true);
    }
  }
  for (let i = 0; i < 5; i++) makeExtra(ei++, -0.96 + i * 0.48, 5.54, true);

  // interior fill lights (move with the bus)
  for (const z of [-3.5, 0.0, 3.5]) { const pl = new THREE.PointLight('#fff4e6', 4.5, 7, 1.6); pl.position.set(0, 2.05, z); bus.add(pl); }

  // ---------------------------------------------------------------- the street (world, static)
  const ZA = 70, ZB = -300, LEN = ZA - ZB, ZC = (ZA + ZB) / 2;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(BUS.curbX + 9.5, LEN), mat(tex(asphaltCanvas2(), { repeat: [3, LEN / 3] }), { rough: 0.95 }));
  road.rotation.x = -Math.PI / 2; road.position.set((BUS.curbX - 9.5) / 2, BUS.roadY, ZC); addW(road, 'road', false);
  const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, LEN), new THREE.MeshStandardMaterial({ map: tex(dashCanvas(), { repeat: [1, LEN / 6] }), transparent: true, alphaTest: 0.5, roughness: 0.8 }));
  dash.rotation.x = -Math.PI / 2; dash.position.set(-2.6, BUS.roadY + 0.005, ZC); addW(dash, 'dash', false);
  const edgeLine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, LEN), mat('#f2d040')); edgeLine.rotation.x = -Math.PI / 2; edgeLine.position.set(-7.2, BUS.roadY + 0.005, ZC); addW(edgeLine, 'yline', false);
  const slab = mat(tex(slabCanvas2(), { repeat: [2, LEN / 2.4] }), { rough: 0.9 });
  const curbM = mat('#c8c4bc', { rough: 0.8 });
  for (const [x0, x1] of [[BUS.curbX, 6.0], [-13.5, -9.5]]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.15, LEN), [curbM, curbM, slab, curbM, curbM, curbM]); sw.position.set((x0 + x1) / 2, BUS.curbY - 0.075, ZC); addW(sw, 'sidewalk', false);
  }
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(60, LEN), mat('#6aa84a', { rough: 1 })); grass.rotation.x = -Math.PI / 2; grass.position.set(0, BUS.roadY - 0.02, ZC); addW(grass, 'ground', false);
  // trees (instanced, low-poly): trunks + two crowns each, both sides
  const treeSpots = [];
  for (const [x, seed] of [[3.75, 1], [-11.0, 2]]) for (let z = ZA; z > ZB; z -= 7.2) {
    const j = hash1(z * 3.1 + seed * 17);
    if (seed === 1 && Math.abs(z - (STOP_Z - 4.0)) < 4.5) continue;      // leave room for the bus shelter
    treeSpots.push({ x: x + (j - 0.5) * 0.8, z: z + (hash1(z + seed) - 0.5) * 2.5, s: 0.85 + j * 0.45, k: hash1(z * 7 + seed) });
  }
  const trunkG = new THREE.CylinderGeometry(0.11, 0.17, 2.4, 6); trunkG.translate(0, 1.2, 0);
  const crownG = new THREE.IcosahedronGeometry(1.25, 0);
  const trunks = new THREE.InstancedMesh(trunkG, mat('#7a5638', { rough: 0.9 }), treeSpots.length);
  const crowns = new THREE.InstancedMesh(crownG, mat('#ffffff', { rough: 0.8 }), treeSpots.length * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col3 = new THREE.Color();
  treeSpots.forEach((t, i) => {
    m4.compose(ps.set(t.x, BUS.curbY, t.z), q.identity(), sc.set(t.s, t.s, t.s)); trunks.setMatrixAt(i, m4);
    for (let k = 0; k < 2; k++) {
      q.setFromEuler(new THREE.Euler(t.k * 3 + k, t.k * 5, k * 0.7));
      m4.compose(ps.set(t.x + (k ? 0.5 : -0.2) * t.s, BUS.curbY + (2.9 + k * 0.75) * t.s, t.z + (k ? -0.3 : 0.25) * t.s), q, sc.setScalar(t.s * (k ? 0.82 : 1.05)));
      crowns.setMatrixAt(i * 2 + k, m4);
      crowns.setColorAt(i * 2 + k, col3.set(['#4f9a3c', '#5fae46', '#3f8a34', '#6dbb4c'][(i + k) % 4]));
    }
  });
  trunks.castShadow = crowns.castShadow = true; trunks.receiveShadow = crowns.receiveShadow = true;
  trunks.name = 'set.street.trunks'; crowns.name = 'set.street.crowns'; group.add(trunks, crowns);
  // buildings along both sides (window-textured blocks)
  const bCols = ['#e8c9a0', '#d98c6a', '#b8c8d8', '#f0e0b8', '#c8a8c8', '#a8c8a8', '#e8b0a0'];
  const winTex = tex(windowCanvas({ seed: 5, inside: '#4a5a6a', frame: '#e8e4dc', mullion: true }));
  const bMats = bCols.map((c) => mat(winTex, { rough: 0.7, tint: c }));
  for (const [x0, dirX, seed] of [[7.0, 1, 3], [-15.0, -1, 4]]) {
    let z = ZA;
    while (z > ZB) {
      const w = 8 + hash1(z * 1.7 + seed) * 7, h = 6 + hash1(z * 2.3 + seed) * 11, d = 8;
      const g = new THREE.BoxGeometry(d, h, w - 0.6);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(w / 3.2)), uv.getY(i) * Math.max(1, Math.round(h / 3.2)));
      const b = new THREE.Mesh(g, bMats[Math.floor(hash1(z + seed * 9) * bMats.length)]);
      b.position.set(x0 + dirX * d / 2, BUS.curbY + h / 2, z - w / 2); addW(b, 'building', true);
      z -= w;
    }
  }
  // lamp posts (right sidewalk) + the bus stop (shelter + sign) where the crush gets on
  const lampM = mat('#3a3f48', { rough: 0.5 });
  for (let z = ZA - 5; z > ZB; z -= 24) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.2, 6), lampM); p.position.set(2.35, BUS.curbY + 2.6, z); addW(p, 'lamp');
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.08), lampM); arm.position.set(1.9, BUS.curbY + 5.1, z); addW(arm, 'lampArm'); }
  const sz = STOP_Z - 4.0;
  const shM = mat('#3a6ad0', { rough: 0.5 });
  for (const [px, pz] of [[3.0, sz - 1.6], [3.0, sz + 1.6], [4.5, sz - 1.6], [4.5, sz + 1.6]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.08), shM); p.position.set(px, BUS.curbY + 1.2, pz); addW(p, 'shelterPost'); }
  const shRoof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 3.6), shM); shRoof.position.set(3.75, BUS.curbY + 2.42, sz); addW(shRoof, 'shelterRoof');
  const shBack = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.7), glass); shBack.position.set(4.5, BUS.curbY + 1.3, sz); shBack.rotation.y = Math.PI / 2; addW(shBack, 'shelterGlass', false);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 2.4), mat('#a8743a')); bench.position.set(4.2, BUS.curbY + 0.45, sz); addW(bench, 'bench');
  const stopSign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mat(tex(signCanvas(['BUS'], { w: 64, h: 64, bg: '#2f6fd6', color: '#ffffff' })), { side: THREE.DoubleSide }));
  stopSign.position.set(2.4, BUS.curbY + 2.6, sz - 2.6); stopSign.rotation.y = Math.PI / 2; addW(stopSign, 'stopSign', false);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), lampM); sp.position.set(2.4, BUS.curbY + 1.3, sz - 2.6); addW(sp, 'stopPole');

  // sky: morning gradient dome (follows the camera) + a soft sun glow
  const skyG = new THREE.SphereGeometry(400, 32, 16), sp2 = skyG.attributes.position, colA = new Float32Array(sp2.count * 3);
  const zen = new THREE.Color('#6aaaf0'), hz = new THREE.Color('#e8f0f6'), warm = new THREE.Color('#ffe2b8');
  const sunDir = V(0.55, 0.62, -0.5).normalize();
  for (let i = 0; i < sp2.count; i++) {
    const d = V(sp2.getX(i), sp2.getY(i), sp2.getZ(i)).normalize();
    const c = hz.clone().lerp(zen, smooth(clamp(d.y / 0.6)));
    c.lerp(warm, 0.55 * Math.pow(Math.max(0, d.dot(sunDir)), 6));
    colA.set([c.r, c.g, c.b], i * 3);
  }
  skyG.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  const sky = new THREE.Mesh(skyG, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10; group.add(sky);

  // lights: warm low morning sun from the front-right (window light + tree shadows sweep through the bus) + sky fill
  const key = new THREE.DirectionalLight('#ffe6c0', 2.6); key.name = 'set.bus.sun';
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  key.userData.dir = sunDir.clone();
  group.add(key, key.target);
  group.add(new THREE.HemisphereLight('#cfe4ff', '#8a7a62', 1.25));

  const props = { bus, mirror, wheels, doors, mePane };
  return {
    name: 'bus', group, props, key,
    look: { background: null, fog: { color: '#dfe9f0', near: 45, far: 260 }, exposure: 1.05, shadowCenter: [0, 1, 0], shadowRadius: 8 },
    defaults: () => ({ busZ: null, doorFront: 0, doorMid: 0, winOpen: 0, crowd: 1, crowdLean: 0 }),
    update(t, s, ctx) {
      const z = s.busZ ?? busZ(t);
      bus.position.set(0, 0, z);
      sky.position.copy(ctx.camera.position);
      for (const w of wheels) w.rotation.x = z / 0.5;
      for (const [name, k] of [['front', s.doorFront], ['mid', s.doorMid]]) for (const L of doors[name]) L.piv.rotation.y = -L.dir * (k || 0) * 1.45;
      if (mePane) mePane.up.position.z = BUS.me.row + (s.winOpen || 0) * 0.62;
      for (const e of extras) { e.g.visible = (s.crowd ?? 1) > 0.5; e.up.rotation.x = (s.crowdLean || 0); }
    },
  };
}
