// The knight's arming sword. Local frame: origin = centre of the grip, +Y toward the tip,
// cross-guard along local X, flats of the blade face ±Z.
import * as THREE from 'three';
import { Kit, PAL, shellGeo, shellRims, profile } from './knight_geo.js';
import { smoothstep } from '../core/util.js';

export const SWORD = {
  tipY: 0.905,      // blade point
  bladeBaseY: 0.11, // top of the cross-guard / start of blade
  guardY: 0.0975,   // centre of the cross-guard bar
  guardHalfW: 0.112,
  gripHalf: 0.085,  // grip spans [-gripHalf, +gripHalf]
  gripR: 0.0165,    // grip radius (incl. leather)
  pommelY: -0.118,  // centre of the wheel pommel
  pommelR: 0.033,
  pommelEnd: -0.158, // butt end (top of the peen)
  length: 1.063,
};

function bladeGeos() {
  // Cross-section stations along the blade; lenticular with a central fuller that fades out.
  const y0 = SWORD.bladeBaseY, y1 = SWORD.tipY;
  const N = 30;
  const flats = [], bevels = [], fuller = [];
  const sec = (y) => {
    const t = (y - y0) / (y1 - y0);
    let w = 0.025 - 0.006 * t; // half width
    const tp = smoothstep(0.78, 1.0, t);
    w *= Math.sqrt(Math.max(0, 1 - tp * tp)) * (1 - 0.15 * tp);
    if (t >= 0.9999) w = 0;
    const th = 0.0042 * (1 - 0.45 * t) * (1 - 0.6 * tp) + 0.0006; // half thickness
    const fd = (1 - smoothstep(0.55, 0.68, t)) * smoothstep(0.0, 0.03, t); // fuller depth factor
    const fw = Math.min(w * 0.36, 0.0085);
    const bev = Math.min(w * 0.3, 0.0055);
    // points from +X edge to -X edge across +Z face
    return {
      edgeP: [w, 0], bevP: [w - bev, th * 0.62], fulP: [fw, th * (1 - 0.05 * fd)], fulC: [0, th * (1 - 0.75 * fd)],
      w, th,
    };
  };
  const ys = [];
  for (let i = 0; i <= N; i++) { const u = i / N; ys.push(y0 + (y1 - y0) * (1 - Math.pow(1 - u, 1.35))); }
  const quad = (arr, a, b, c, d) => { arr.push(...a, ...b, ...c, ...a, ...c, ...d); };
  for (let i = 0; i < N; i++) {
    const A = sec(ys[i]), B = sec(ys[i + 1]), ya = ys[i], yb = ys[i + 1];
    for (const sz of [1, -1]) for (const sx of [1, -1]) {
      const P = (s, k, y) => [sx * s[k][0], y, sz * s[k][1]];
      const ord = (sx * sz > 0);
      const q = (arr, k0, k1) => {
        const a = P(A, k0, ya), b = P(A, k1, ya), c = P(B, k1, yb), d = P(B, k0, yb);
        if (ord) quad(arr, a, b, c, d); else quad(arr, a, d, c, b);
      };
      q(bevels, 'edgeP', 'bevP');
      q(flats, 'bevP', 'fulP');
      q(fuller, 'fulP', 'fulC');
    }
  }
  const mk = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
  // fix winding: ensure normals point away from the blade centre plane
  const fixed = [flats, bevels, fuller].map((arr) => {
    const g = mk(arr), p = g.attributes.position, n = g.attributes.normal;
    for (let t = 0; t < p.count; t += 3) {
      const cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3, cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
      const nz = n.getZ(t), nx = n.getX(t);
      if (nz * cz + nx * cx * 0.02 < 0) { // flipped: swap two vertices
        for (const a of ['position']) {
          const at = g.attributes[a];
          const x = at.getX(t + 1), y = at.getY(t + 1), z = at.getZ(t + 1);
          at.setXYZ(t + 1, at.getX(t + 2), at.getY(t + 2), at.getZ(t + 2));
          at.setXYZ(t + 2, x, y, z);
        }
      }
    }
    g.computeVertexNormals();
    return g;
  });
  return { flats: fixed[0], bevels: fixed[1], fuller: fixed[2] };
}

export function buildSword(material) {
  const group = new THREE.Group();
  group.name = 'knightSword';
  const kit = new Kit(material);
  const holder = new THREE.Group();
  group.add(holder);
  // blade
  const b = bladeGeos();
  kit.add(holder, b.flats, PAL.blade);
  kit.add(holder, b.bevels, PAL.bladeEdge);
  kit.add(holder, b.fuller, PAL.fuller);
  // ricasso collar / blade shoulder block
  // cross-guard: a bar along X, slightly curved toward the blade, flared rounded terminals
  const hw = SWORD.guardHalfW;
  const guard = shellGeo({
    nU: 10, nV: 18, aoTop: 0, aoBot: 0,
    prof: (t) => {
      const u = Math.abs(t * 2 - 1);
      const flare = smoothstep(0.82, 1.0, u);
      return { y: -hw + 2 * hw * t, rx: 0.0125 - 0.004 * u + 0.004 * flare, rz: 0.0135 - 0.005 * u + 0.006 * flare, sq: 2.6 };
    },
  });
  // rotate so the shell's axis (Y) runs along X; shell's local Z stays Z (blade flat normal), shell X -> -Y
  guard.applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.PI / 2));
  {
    const p = guard.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) + SWORD.guardY + 0.012 * Math.pow(Math.abs(x) / hw, 2.2)); }
    guard.computeVertexNormals();
  }
  kit.add(holder, guard, PAL.iron);
  // guard end caps (small balls)
  for (const s of [1, -1]) {
    const cap = new THREE.SphereGeometry(0.0115, 10, 7);
    cap.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(s * hw, SWORD.guardY + 0.012, 0), new THREE.Quaternion(), new THREE.Vector3(0.75, 1.0, 1.15)));
    kit.add(holder, cap, PAL.iron);
  }
  // central escutcheon block where the blade meets the guard
  const esc = new THREE.CylinderGeometry(0.019, 0.016, 0.03, 8, 1);
  esc.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(0, SWORD.guardY + 0.004, 0), new THREE.Quaternion(), new THREE.Vector3(1.25, 1, 0.62)));
  kit.add(holder, esc, PAL.iron);
  // grip: leather over wood core, slight swell, helical strip wrap grooves
  const gh = SWORD.gripHalf, gr = SWORD.gripR;
  const turns = 7.5;
  const gripO = {
    nU: 14, nV: 44, aoTop: 0, aoBot: 0,
    prof: (t) => { const sw = Math.sin(Math.PI * t); return { y: -gh + 2 * gh * t, rx: gr * (0.9 + 0.08 * sw), rz: gr * (0.78 + 0.07 * sw) }; },
    disp: (th, t) => { const ph = th + Math.PI * 2 * turns * t; const c = Math.cos(ph); return -0.0016 * Math.pow(Math.max(0, c), 10) + 0.0004 * Math.cos(ph * 2); },
  };
  kit.add(holder, shellGeo(gripO), { ...PAL.glove, color: 0x3a2a20, rough: 0.7 });
  // wire ferrules at both ends of the grip
  for (const y of [gh - 0.004, -gh + 0.004]) {
    const ring = new THREE.TorusGeometry(gr * 0.95, 0.0028, 5, 16);
    ring.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(0, y, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(1, 0.85, 1)));
    kit.add(holder, ring, PAL.iron, { bright: 1.08 });
  }
  // pommel neck
  const neck = new THREE.CylinderGeometry(0.011, 0.013, 0.012, 8);
  neck.translate(0, -gh - 0.004, 0);
  kit.add(holder, neck, PAL.iron);
  // wheel pommel (disc whose faces look along ±Z) with a raised central boss and bevelled rim
  const pr = SWORD.pommelR;
  const lathePts = [
    [0.0, 0.0125], [0.012, 0.0125], [0.0145, 0.0095], [0.024, 0.0085], [pr - 0.002, 0.0065], [pr, 0.0025],
    [pr, -0.0025], [pr - 0.002, -0.0065], [0.024, -0.0085], [0.0145, -0.0095], [0.012, -0.0125], [0.0, -0.0125],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const pom = new THREE.LatheGeometry(lathePts, 22);
  pom.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  pom.translate(0, SWORD.pommelY, 0);
  kit.add(holder, pom, PAL.iron, { bright: 1.05 });
  // peen block on top
  const peen = new THREE.BoxGeometry(0.009, 0.007, 0.009);
  peen.translate(0, SWORD.pommelY - pr - 0.0035, 0);
  kit.add(holder, peen, PAL.iron);
  const meshes = kit.build({ name: 'sword' });
  for (const m of meshes) { m.castShadow = true; m.receiveShadow = true; }
  group.userData.tris = kit.tris;
  return group;
}
