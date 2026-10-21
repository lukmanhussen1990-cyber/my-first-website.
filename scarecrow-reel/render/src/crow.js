// Crows: glossy, cheeky, toy-like. One design, five gang members (small variations) + baby crows.
import * as THREE from 'three';
import * as T from './textures.js';
import { V, setShadows } from './parts.js';
import { merge, paint } from './plants.js';
import { clamp, lerp, rng } from './util.js';

let MATS = null;
function mats() {
  if (MATS) return MATS;
  const ft = T.feathers();
  [ft.map, ft.normalMap, ft.roughnessMap].forEach((t) => t.repeat.set(2.5, 2.5));
  MATS = {
    feather: new THREE.MeshPhysicalMaterial({ color: 0x24252f, map: ft.map, normalMap: ft.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.42, roughnessMap: ft.roughnessMap,
      clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 1, sheenColor: new THREE.Color(0x5b72d8), sheenRoughness: 0.3 }),
    wing: new THREE.MeshPhysicalMaterial({ color: 0x1f2029, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25, sheen: 1, sheenColor: new THREE.Color(0x3f58c0), sheenRoughness: 0.35, side: THREE.DoubleSide }),
    eye: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, clearcoat: 1 }),
    iris: new THREE.MeshPhysicalMaterial({ color: 0x8a5a1a, roughness: 0.15, clearcoat: 1 }),
    pupil: new THREE.MeshPhysicalMaterial({ color: 0x050507, roughness: 0.08, clearcoat: 1 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    beak: new THREE.MeshPhysicalMaterial({ color: 0x6b6d7c, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x8a2c3a, roughness: 0.6 }),
    leg: new THREE.MeshPhysicalMaterial({ color: 0x34343c, roughness: 0.5, clearcoat: 0.3 }),
    lid: new THREE.MeshPhysicalMaterial({ color: 0x23242e, roughness: 0.4, clearcoat: 0.5, sheen: 1, sheenColor: new THREE.Color(0x4a62c8) }),
    fluff: new THREE.MeshPhysicalMaterial({ color: 0x45454f, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0x9a9ab0), sheenRoughness: 0.8 }),
    gape: new THREE.MeshStandardMaterial({ color: 0xf6c23a, roughness: 0.5 }),
    gapeIn: new THREE.MeshStandardMaterial({ color: 0xe8505a, roughness: 0.6 }),
  };
  return MATS;
}

function featherGeo(len, wid, thick = 0.012) {
  const g = new THREE.SphereGeometry(1, 14, 8); g.scale(len / 2, thick, wid / 2); g.translate(len / 2, 0, 0);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) / len; p.setZ(i, p.getZ(i) * (1 - 0.45 * x)); p.setY(i, p.getY(i) - 0.02 * len * x * x); }
  g.computeVertexNormals(); return g;
}

export function buildCrow(scene, variant = 0) {
  const m = mats(); const C = { variant };
  const r = rng(1000 + variant * 17);
  const root = C.root = new THREE.Group(); scene.add(root);
  const sc = [0.95, 0.84, 0.88, 0.8, 0.9][variant % 5];
  const scaleG = C.scaleG = new THREE.Group(); scaleG.scale.setScalar(sc); root.add(scaleG);
  const bodyP = C.bodyP = new THREE.Group(); bodyP.position.y = 0.13; scaleG.add(bodyP);
  // one smooth teardrop body: chest up front, tapering to the tail
  const bodyG = new THREE.SphereGeometry(1, 36, 24);
  { const p = bodyG.attributes.position; for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const t = (z + 1) / 2; // 0 tail .. 1 chest
      const w = 0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 0.85 + 0.15));
      x *= 0.098 * w; y *= 0.1 * w; z *= 0.17;
      y += -0.05 * (1 - t) * (1 - t);
      p.setXYZ(i, x, y, z);
    } bodyG.computeVertexNormals(); }
  const body = new THREE.Mesh(bodyG, m.feather); body.position.set(0, 0.11, -0.02); body.rotation.x = -0.55; bodyP.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.078, 24, 16), m.feather); chest.position.set(0, 0.18, 0.06); chest.scale.set(1.05, 1.1, 1); bodyP.add(chest);
  // head
  const neck = C.neck = new THREE.Group(); neck.position.set(0, 0.235, 0.085); bodyP.add(neck);
  const head = C.head = new THREE.Group(); head.position.set(0, 0.055, 0.0); neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.094, 32, 24), m.feather); skull.scale.set(1, 0.95, 1.08); head.add(skull);
  const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), m.feather); cheekL.position.set(0, -0.035, 0.045); cheekL.scale.set(1.35, 0.9, 1); head.add(cheekL);
  // eyes (big, set on the front)
  C.eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * 0.045, 0.02, 0.078); eye.rotation.y = s * 0.32; head.add(eye);
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.037, 24, 18), m.eye); sclera.scale.set(1, 1.12, 0.6); eye.add(sclera);
    const iris = new THREE.Group(); eye.add(iris);
    const ir = new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 14), m.iris); ir.scale.set(1, 1.05, 0.42); ir.position.z = 0.017; iris.add(ir);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 16, 12), m.pupil); pu.scale.set(1, 1.05, 0.45); pu.position.z = 0.0235; iris.add(pu);
    const hi = new THREE.Mesh(new THREE.SphereGeometry(0.0058, 10, 8), m.hi); hi.position.set(0.007, 0.01, 0.0265); eye.add(hi);
    const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 8, 6), m.hi); hi2.position.set(-0.007, -0.007, 0.026); eye.add(hi2);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.041, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.lid); lid.scale.set(1.02, 1.15, 0.7); eye.add(lid);
    const low = new THREE.Mesh(new THREE.SphereGeometry(0.04, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.lid); low.scale.set(1.02, 1.12, 0.68); eye.add(low);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0105, 0.04, 4, 8), m.lid); brow.position.set(0, 0.05, 0.016); brow.rotation.z = Math.PI / 2; eye.add(brow);
    C.eyes.push({ eye, iris, lid, low, brow, s });
  }
  // beak (upper + hinged lower)
  const beakUp = new THREE.ConeGeometry(0.037, 0.15, 18); beakUp.rotateX(Math.PI / 2); beakUp.scale(1.0, 0.66, 1); beakUp.translate(0, 0.0, 0.075);
  { const p = beakUp.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, p.getY(i) - 0.35 * (z / 0.12) ** 2 * 0.05 + (p.getY(i) < 0 ? 0.006 : 0)); } beakUp.computeVertexNormals(); }
  const beak = C.beak = new THREE.Group(); beak.position.set(0, -0.022, 0.085); head.add(beak);
  beak.add(new THREE.Mesh(beakUp, m.beak));
  const lowerP = C.lowerBeak = new THREE.Group(); lowerP.position.set(0, -0.008, 0.0); beak.add(lowerP);
  const bl = new THREE.ConeGeometry(0.028, 0.11, 14); bl.rotateX(Math.PI / 2); bl.scale(1, 0.45, 1); bl.translate(0, -0.004, 0.055);
  lowerP.add(new THREE.Mesh(bl, m.beak));
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), m.mouth); tongue.scale.set(1, 0.3, 1.6); tongue.position.set(0, 0.002, 0.03); lowerP.add(tongue);
  const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), m.feather); nostril.scale.set(1.5, 0.6, 1.4); nostril.position.set(0, 0.016, 0.02); beak.add(nostril);
  // head tuft (style varies by gang member)
  const tuftStyles = [[[0, 0.11, -0.01, -0.5, 0.07], [0.02, 0.1, -0.03, -0.75, 0.06], [-0.02, 0.1, -0.03, -0.75, 0.06]], [[0, 0.1, 0.01, 0.2, 0.05]], [[0.015, 0.1, -0.02, -0.4, 0.045], [-0.015, 0.1, -0.02, -0.4, 0.045]], [[0, 0.1, -0.03, -1.0, 0.055]], [[0, 0.1, 0.0, -0.2, 0.06], [0.025, 0.095, -0.01, -0.5, 0.045]]];
  for (const [x, y, z, rx, L] of tuftStyles[variant % 5]) {
    const f = new THREE.Mesh(featherGeo(L, 0.03, 0.008), m.wing); f.rotation.set(0, -Math.PI / 2, 0); const g = new THREE.Group(); g.add(f); g.rotation.x = rx - 1.2; g.position.set(x, y - 0.015, z); head.add(g);
  }

  // wings: shoulder pivot -> wrist pivot (primaries)
  C.wings = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.08, 0.175, 0.045); bodyP.add(sh);
    sh.rotation.order = 'YZX';
    const inner = new THREE.Mesh(featherGeo(0.2, 0.12, 0.028), m.wing); inner.scale.x = s; sh.add(inner);
    const cov = new THREE.Mesh(featherGeo(0.12, 0.09, 0.03), m.feather); cov.scale.x = s; cov.position.y = 0.006; sh.add(cov);
    const wrist = new THREE.Group(); wrist.position.x = s * 0.15; sh.add(wrist);
    for (let k = 0; k < 5; k++) {
      const f = new THREE.Mesh(featherGeo(0.13 - k * 0.012, 0.034, 0.01), m.wing); f.scale.x = s;
      f.rotation.y = s * (-0.35 + k * 0.17); f.position.z = -0.02 - k * 0.006; wrist.add(f);
    }
    for (let k = 0; k < 4; k++) { // secondaries along the trailing edge
      const f = new THREE.Mesh(featherGeo(0.08, 0.03, 0.009), m.wing); f.scale.x = s; f.rotation.y = s * (1.25 + k * 0.08); f.position.set(s * (0.03 + k * 0.035), -0.002, -0.03); sh.add(f);
    }
    C.wings.push({ sh, wrist, s });
  }
  // tail
  const tail = C.tail = new THREE.Group(); tail.position.set(0, 0.035, -0.15); bodyP.add(tail);
  for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(featherGeo(0.19, 0.045, 0.012), m.wing); f.rotation.y = Math.PI / 2 + (k - 2) * 0.16; f.rotation.z = 0.45; tail.add(f); C.tailF = (C.tailF || []).concat([f]); }
  // legs
  C.legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.035, 0.03, 0.0); bodyP.add(hip);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.007, 0.15, 6), m.leg); shin.position.y = -0.075; hip.add(shin);
    const foot = new THREE.Group(); foot.position.y = -0.15; hip.add(foot);
    for (const a of [-0.45, 0, 0.45]) { const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.04, 3, 6), m.leg); toe.rotation.x = Math.PI / 2; toe.rotation.y = a; toe.position.set(Math.sin(a) * 0.022, -0.004, Math.cos(a) * 0.022); foot.add(toe); }
    const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.025, 3, 6), m.leg); back.rotation.x = Math.PI / 2; back.position.set(0, -0.004, -0.016); foot.add(back);
    C.legs.push({ hip, foot });
  }
  setShadows(root, true, true);

  C.restLid = [0.42, 0.3, 0.5, 0.36, 0.46][variant % 5];
  C.setPose = (p) => {
    root.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
    root.rotation.set(0, p.yaw ?? 0, p.roll ?? 0);
    root.visible = p.visible ?? true;
    root.scale.setScalar(Math.max(0.0001, p.scale ?? 1));
    bodyP.rotation.set(p.pitch ?? 0, 0, p.bodyRoll ?? 0);
    const sq = p.squash ?? 0; bodyP.scale.set(1 + sq * 0.4, 1 - sq, 1 + sq * 0.4);
    bodyP.position.y = 0.13 + (p.bob ?? 0);
    neck.rotation.set(p.headPitch ?? 0, p.headYaw ?? 0, p.headRoll ?? 0);
    neck.position.z = 0.07 + (p.neckOut ?? 0) * 0.04;
    lowerP.rotation.x = (p.beakOpen ?? 0) * 0.7;
    const gz = p.gaze ?? [0, 0];
    C.eyes.forEach((E, i) => {
      E.iris.position.set(clamp(gz[0], -1, 1) * 0.011, clamp(gz[1], -1, 1) * 0.01, 0);
      const lidAmt = clamp((i ? p.lidR : p.lidL) ?? p.lid ?? C.restLid, -0.3, 1);
      E.lid.rotation.x = lerp(-1.4, 1.45, lidAmt * 0.62 + 0.08) ;
      E.low.rotation.x = lerp(1.25, 0.25, clamp(p.lowLid ?? 0.15));
      const wide = p.wide ?? 0; E.eye.scale.setScalar(1 + wide * 0.22);
      const bt = (i ? p.browR : p.browL) ?? p.brow ?? 0.25; E.brow.rotation.z = Math.PI / 2 - E.s * bt * 0.6; E.brow.position.y = 0.05 + (p.browUp ?? 0) * 0.012 + wide * 0.012;
    });
    // wings: spread 0 folded .. 1 open; flap = up/down angle; wrist bend
    const sp = clamp(p.spread ?? 0); const fl = p.flap ?? 0;
    C.wings.forEach((W, i) => {
      const s = W.s; const wave = (i ? p.waveR : p.waveL) ?? 0;
      W.sh.rotation.y = s * lerp(-(Math.PI / 2 + 0.25), -0.15, sp) * -1;
      W.sh.rotation.z = s * (lerp(-0.12, 0, sp) + fl * sp + wave * 1.4);
      W.sh.rotation.x = lerp(-0.45, 0, sp) - wave * 0.2;
      W.wrist.rotation.z = s * (lerp(0.1, 0, sp) - fl * sp * 0.35 + wave * Math.sin((p.time ?? 0) * 18) * 0.5);
      W.wrist.rotation.y = s * lerp(0.35, 0, sp);
    });
    tail.rotation.x = (p.tailUp ?? 0) * 0.6 - 0.1;
    (C.tailF || []).forEach((f, k) => { f.rotation.y = Math.PI / 2 + (k - 2) * (0.16 + (p.tailFan ?? 0) * 0.2); });
    const tuck = clamp(p.tuck ?? 0); const st = p.step ?? 0;
    C.legs.forEach((L, i) => { L.hip.rotation.x = lerp(Math.sin(st + i * Math.PI) * 0.5, -1.2, tuck); L.foot.rotation.x = lerp(0, 1.0, tuck); L.hip.position.y = 0.03 + Math.max(0, Math.sin(st + i * Math.PI)) * 0.02 * (1 - tuck); });
  };
  C.setPose({});
  return C;
}

// Baby crow: fluffy ball, big eyes, yellow gape that opens to chirp.
export function buildBaby(parent, seed = 0) {
  const m = mats(); const B = {};
  const root = B.root = new THREE.Group(); parent.add(root);
  const body = new THREE.SphereGeometry(0.05, 24, 18); const p = body.attributes.position;
  const r = rng(2000 + seed);
  for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); const k = 1 + (Math.sin(v.x * 220 + seed) * Math.sin(v.y * 230) * Math.sin(v.z * 210)) * 0.06; v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z); }
  body.computeVertexNormals();
  const bm = new THREE.Mesh(body, m.fluff); bm.scale.set(1, 1.05, 1); root.add(bm);
  const fuzz = []; for (let k = 0; k < 9; k++) { const c = new THREE.ConeGeometry(0.006, 0.03, 4); c.translate(0, 0.015, 0); c.rotateZ((r() - 0.5) * 1.2); c.rotateX((r() - 0.5) * 0.8 - 0.3); c.translate((r() - 0.5) * 0.03, 0.045, -0.005); fuzz.push(paint(c, 0x55555f)); }
  root.add(new THREE.Mesh(merge(fuzz), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })));
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.017, 14, 10), m.eye); e.scale.set(1, 1.1, 0.6); e.position.set(s * 0.02, 0.012, 0.042); root.add(e);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), m.pupil); pu.scale.set(1, 1.1, 0.5); pu.position.set(s * 0.02, 0.011, 0.05); root.add(pu);
    const hi = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 6, 4), m.hi); hi.position.set(s * 0.02 + 0.004, 0.017, 0.055); root.add(hi);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), m.fluff); w.scale.set(0.5, 1, 1.2); w.position.set(s * 0.047, -0.005, -0.005); root.add(w);
  }
  const beak = new THREE.Group(); beak.position.set(0, -0.006, 0.046); root.add(beak);
  const up = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.03, 12), m.gape); up.rotation.x = Math.PI / 2 + 0.25; up.scale.set(1.3, 1, 0.55); up.position.z = 0.012; beak.add(up);
  const lowP = new THREE.Group(); beak.add(lowP);
  const lo = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.026, 12), m.gape); lo.rotation.x = Math.PI / 2 - 0.25; lo.scale.set(1.3, 1, 0.5); lo.position.set(0, -0.004, 0.011); lowP.add(lo);
  const inside = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), m.gapeIn); inside.scale.set(1.2, 0.5, 1); inside.position.set(0, -0.003, 0.008); beak.add(inside);
  setShadows(root, true, true);
  B.setPose = (q) => {
    root.position.set(q.x ?? 0, q.y ?? 0, q.z ?? 0); root.rotation.set(q.pitch ?? 0, q.yaw ?? 0, q.roll ?? 0);
    root.scale.setScalar(Math.max(0.0001, q.scale ?? 1));
    lowP.rotation.x = (q.open ?? 0) * 0.9; beak.rotation.x = -(q.open ?? 0) * 0.35;
  };
  return B;
}
