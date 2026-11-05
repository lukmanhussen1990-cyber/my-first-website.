import * as THREE from 'three';
import { mat, box, at } from './materials.js';
import { CONFIG } from './config.js';
import { DEG, clamp, rng, lerp } from './anim.js';

const pal = CONFIG.palette;
export const LADDER_LEN = 3.3;
export const BOX = { w: 0.64, h: 0.5, d: 0.56 };

// ---------------------------------------------------------------- cardboard box
export function makeCardboardBox(seed = 1) {
  const root = new THREE.Group();
  const yaw = new THREE.Group();
  root.add(yaw);
  const body = new THREE.Group();
  yaw.add(body);
  const shell = at(box(BOX.w, BOX.h, BOX.d, pal.cardboard), 0, BOX.h / 2, 0);
  body.add(shell);
  body.add(at(box(BOX.w + 0.004, 0.012, 0.11, pal.tape), 0, BOX.h + 0.004, 0));
  body.add(at(box(0.11, BOX.h * 0.5, 0.005, pal.tape), 0, BOX.h * 0.75, BOX.d / 2 + 0.003));
  body.add(at(box(0.16, 0.1, 0.005, pal.cardboardDark), -0.15, 0.17, BOX.d / 2 + 0.003)); // label
  // flaps that burst out when crushed
  const flaps = [];
  const r = rng(seed * 99);
  for (let i = 0; i < 4; i++) {
    const f = at(box(i % 2 ? 0.5 : 0.3, 0.012, i % 2 ? 0.26 : 0.4, i % 2 ? pal.cardboard : pal.cardboardDark), 0, 0, 0);
    const a = (i / 4) * Math.PI * 2 + r() * 0.5;
    f.userData = { a, tilt: 0.35 + r() * 0.5, spin: r() * 3 };
    flaps.push(f);
    yaw.add(f);
  }
  return {
    root,
    apply(s) {
      root.visible = s.vis !== false;
      const p = s.p || [0, 0, 0];
      root.position.set(p[0], p[1], p[2]);
      yaw.rotation.set((s.rx ?? 0) * DEG, (s.ry ?? 0) * DEG, (s.rz ?? 0) * DEG);
      const c = clamp(s.crush ?? 0);
      const sy = lerp(1, 0.13, c);
      const sxz = lerp(1, 1.22, c);
      body.scale.set(sxz, sy, sxz);
      for (const f of flaps) {
        f.visible = c > 0.4;
        const { a, tilt, spin } = f.userData;
        f.position.set(Math.cos(a) * 0.36 * sxz, 0.07, Math.sin(a) * 0.3 * sxz);
        f.rotation.set(Math.sin(a) * tilt, a + spin, -Math.cos(a) * tilt);
      }
    },
  };
}

// ---------------------------------------------------------------- home-made ladder
// root(pos, yaw) > tip(z) > lean(x) > side1 (+Y) ; hinge at top > side2 (-Y)
function ladderSide(dir, seed) {
  const g = new THREE.Group();
  const L = LADDER_LEN, half = 0.245;
  const rnd = rng(seed);
  for (const s of [-1, 1]) {
    const rail = at(box(0.08, L, 0.08, pal.wood), half * s, (dir * L) / 2, 0);
    g.add(rail);
  }
  for (let y = 0.32; y < L - 0.15; y += 0.3) {
    const rung = at(box(half * 2 + 0.16, 0.05, 0.05, pal.woodDark), (rnd() - 0.5) * 0.04, dir * y, 0.055);
    rung.rotation.z = (rnd() - 0.5) * 0.09; // hand-made: a bit wonky
    g.add(rung);
    for (const s of [-1, 1]) g.add(at(box(0.025, 0.025, 0.015, '#3d3d44'), half * s, dir * y, 0.085));
  }
  return g;
}

export function makeLadder() {
  const L = LADDER_LEN;
  const root = new THREE.Group();
  const tip = new THREE.Group();
  const lean = new THREE.Group();
  root.add(tip); tip.add(lean);
  const side1 = ladderSide(1, 7);
  lean.add(side1);
  const hinge = at(new THREE.Group(), 0, L, -0.02);
  lean.add(hinge);
  const side2 = ladderSide(-1, 13);
  side2.position.z = -0.085;
  hinge.add(side2);
  const hingeHw = new THREE.Group();
  for (const s of [-1, 1]) hingeHw.add(at(box(0.11, 0.11, 0.2, pal.metal), 0.245 * s, -0.03, -0.04));
  hinge.add(hingeHw);
  const feet1 = new THREE.Group(), feet2 = new THREE.Group();
  for (const s of [-1, 1]) {
    feet1.add(at(box(0.13, 0.075, 0.13, pal.rubber), 0.245 * s, 0.03, 0));
    feet2.add(at(box(0.13, 0.075, 0.13, pal.rubber), 0.245 * s, -L - 0.03, -0.085));
  }
  lean.add(feet1);
  hinge.add(feet2);
  // glue blobs (show during the gluing gag)
  const glue = new THREE.Group();
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat('#f7f7f2'));
    b.position.set(0.245 * s, 0.06, 0.04);
    b.scale.set(1.2, 0.6, 1.2);
    glue.add(b);
  }
  lean.add(glue);
  root.traverse((o) => o.isMesh && (o.castShadow = true));

  const api = {
    root, lean, side1,
    apply(s) {
      root.visible = s.vis !== false;
      const p = s.p || [0, 0];
      root.position.set(p[0], s.lift ?? 0, p[1]);
      root.rotation.y = (s.ry ?? 0) * DEG;
      tip.rotation.z = (s.tip ?? 0) * DEG;
      lean.rotation.x = -(s.lean ?? 0) * DEG + (s.wiggle ?? 0) * DEG;
      lean.rotation.z = (s.roll ?? 0) * DEG;
      hinge.rotation.x = (s.open ?? 0) * DEG;
      side2.visible = hingeHw.visible = !!s.side2;
      feet1.visible = feet1.children.length && (s.rubber ?? 0) > 0.01;
      feet1.scale.setScalar(Math.max(0.001, s.rubber ?? 0));
      feet2.visible = !!s.side2 && (s.rubber ?? 0) > 0.01;
      glue.visible = (s.glue ?? 0) > 0.01;
      glue.scale.setScalar(Math.max(0.001, s.glue ?? 0));
    },
    // world-space point on side 1, `s` metres from the foot, `out` metres off the climbing face
    point(sAlong, out = 0.13, target = new THREE.Vector3()) {
      lean.updateWorldMatrix(true, false);
      return target.set(0, sAlong, out).applyMatrix4(lean.matrixWorld);
    },
  };
  return api;
}

// Pure-math helper used by the timeline: where is a point on a wall-leaning ladder?
// The foot sits `L*sin(lean)` in front of the wall (wall face at z=0).
export function leaningLadder(leanDeg, sAlong, wallZ = 0.02) {
  const a = leanDeg * DEG;
  const footZ = wallZ + LADDER_LEN * Math.sin(a);
  return { footZ, y: sAlong * Math.cos(a), z: footZ - sAlong * Math.sin(a) };
}

// ---------------------------------------------------------------- toilet
export function makeToilet() {
  const g = new THREE.Group();
  const white = pal.porcelain;
  g.add(at(box(0.3, 0.32, 0.42, white), 0, 0.16, 0.02));
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.17, 0.16, 10), mat(white));
  bowl.scale.set(1, 1, 1.25);
  bowl.position.set(0, 0.36, 0.08);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.04, 10), mat('#e9edf2'));
  seat.scale.set(1, 1, 1.22);
  seat.position.set(0, 0.46, 0.08);
  g.add(bowl, seat);
  g.add(at(box(0.48, 0.42, 0.2, white), 0, 0.68, -0.27));
  g.add(at(box(0.5, 0.04, 0.22, '#e9edf2'), 0, 0.9, -0.27));
  g.add(at(box(0.07, 0.03, 0.05, '#c9ced6'), 0.16, 0.93, -0.25));
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

// ---------------------------------------------------------------- pee stream + puddle
export function makePee() {
  const stream = new THREE.Group();
  const drops = [];
  for (let i = 0; i < 18; i++) {
    const d = box(0.028, 0.028, 0.05, pal.pee, { emissive: '#3a3000' });
    d.castShadow = false;
    drops.push(d);
    stream.add(d);
  }
  const puddle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.008, 12), mat(pal.pee, { transparent: true, opacity: 0.82 }));
  puddle.receiveShadow = true;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), tmp = new THREE.Vector3();
  return {
    stream, puddle,
    apply(s, time, from) {
      const on = (s.pee ?? 0) > 0.01;
      stream.visible = on;
      if (on && from) {
        a.copy(from);
        const to = s.peeTo || [0, 0.1, 0];
        b.set(to[0], to[1], to[2]);
        const n = drops.length;
        for (let i = 0; i < n; i++) {
          const u = ((i / n) + time * 2.4) % 1;
          tmp.lerpVectors(a, b, u);
          tmp.y += Math.sin(u * Math.PI) * 0.16 - u * 0.02;
          drops[i].position.copy(tmp);
          drops[i].lookAt(b);
          drops[i].visible = u <= s.pee;
        }
      }
      const pz = s.puddle ?? 0;
      puddle.visible = pz > 0.01;
      const pp = s.puddleAt || [0, 0];
      puddle.position.set(pp[0], 0.012, pp[1]);
      puddle.scale.set(pz, 1, pz * 0.8);
    },
  };
}

// ---------------------------------------------------------------- particle bursts (stateless)
export function makeParticles(max = 260) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ flatShading: true }), max);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const col = new THREE.Color();
  for (let i = 0; i < max; i++) mesh.setColorAt(i, col.set('#ffffff'));
  return {
    mesh,
    // bursts: [{at, pos:[x,y,z], n, colors:[...], speed, up, size, life, spread}]
    update(bursts, t) {
      let k = 0;
      for (const [bi, b] of bursts.entries()) {
        const dt = t - b.at;
        const life = b.life ?? 0.9;
        if (dt < 0 || dt > life) continue;
        const r = rng(1000 + bi * 77);
        for (let i = 0; i < (b.n ?? 14) && k < max; i++, k++) {
          const ang = r() * Math.PI * 2;
          const sp = (b.speed ?? 2.2) * (0.4 + r() * 0.8);
          const vx = Math.cos(ang) * sp * (b.spread ?? 1);
          const vz = Math.sin(ang) * sp * (b.spread ?? 1);
          const vy = (b.up ?? 2.6) * (0.5 + r() * 0.7);
          const y = b.pos[1] + vy * dt - 4.9 * dt * dt;
          p.set(b.pos[0] + vx * dt, Math.max(0.015, y), b.pos[2] + vz * dt);
          const grounded = y <= 0.015;
          e.set(r() * 6 + (grounded ? 0 : dt * 9), r() * 6, r() * 6 + (grounded ? 0 : dt * 7));
          q.setFromEuler(e);
          const s = (b.size ?? 0.06) * (0.6 + r() * 0.8) * (1 - Math.pow(dt / life, 4));
          sc.set(s, s * (b.flat ? 0.25 : 1), s);
          m.compose(p, q, sc);
          mesh.setMatrixAt(k, m);
          const cs = b.colors || ['#ffffff'];
          mesh.setColorAt(k, col.set(cs[i % cs.length]));
        }
      }
      mesh.count = k;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.visible = k > 0;
    },
  };
}
