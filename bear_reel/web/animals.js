// Animals: the bear + the map bear (animal_bear.js), the bloodhound, the squirrel and the birds. API: CONTRACTS.md.
// Everything is a pure function of p + t (no state kept between frames).
import * as THREE from 'three';
import { clamp, lerp, smooth, hash1, noise1, rng, v3, mat } from './lib.js';
import { Bear, bearMaterials } from './animal_bear.js';
import { ellipsoid } from './animal_geo.js';
import { furTex } from './animal_tex.js';
import { BEAR_PATH, COMPARE, MAP_BEAR } from './layout.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const W = (local, obj) => { obj.updateMatrixWorld(true); return local.clone().applyMatrix4(obj.matrixWorld); };
function mk(parent, geo, material, name, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material); m.name = name; m.castShadow = cast; m.receiveShadow = receive; parent.add(m); return m;
}
const ell = (rx, ry, rz, w = 9, h = 7) => ellipsoid(rx, ry, rz, w, h);
function limb(r0, r1, len, sides = 6) { const g = new THREE.CylinderGeometry(r1, r0, len, sides); g.translate(0, len / 2, 0); return g; }
function place(m, a, b) { // stretch a +Y limb (built with length 1) between two points
  const d = b.clone().sub(a), L = d.length(); m.position.copy(a); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); m.scale.set(1, L, 1);
}

// ================================================================== BLOODHOUND (sitting)
class Dog {
  constructor(world) {
    this.name = 'dog';
    const root = (this.root = new THREE.Group()); root.name = 'dog'; world.scene.add(root);
    const fur = mat(furTex('#b8662f', { seed: 61, amount: 14 }), { rough: 0.95 });
    const furDark = mat(furTex('#7c3d18', { seed: 62, amount: 16 }), { rough: 0.95 });
    const ear = mat(furTex('#5c2a12', { seed: 63, amount: 18 }), { rough: 0.95 });
    const muz = mat(furTex('#c98450', { seed: 64, amount: 10 }), { rough: 0.95 });
    const black = new THREE.MeshStandardMaterial({ color: '#141010', roughness: 0.18, flatShading: false });
    const eyeM = new THREE.MeshStandardMaterial({ color: '#1a0f0a', roughness: 0.1, flatShading: false });
    const haw = mat('#b4474a', { rough: 0.6 }), line = mat('#4a200c', { rough: 0.9 });
    // body (sitting upright, facing +Z)
    const torso = mk(root, ell(0.17, 0.27, 0.19), fur, 'dog.torso'); torso.position.set(0, 0.36, 0.0); torso.rotation.x = -0.45;
    const saddle = mk(root, ell(0.15, 0.2, 0.15), furDark, 'dog.saddle'); saddle.position.set(0, 0.42, -0.06); saddle.rotation.x = -0.45;
    for (const sx of [-1, 1]) {
      const hh = mk(root, ell(0.1, 0.13, 0.17), fur, 'dog.haunch'); hh.position.set(sx * 0.12, 0.15, -0.06);
      const hf = mk(root, ell(0.05, 0.035, 0.1), fur, 'dog.hindFoot'); hf.position.set(sx * 0.15, 0.035, 0.1);
      const fl = mk(root, limb(0.042, 0.036, 1, 6), fur, 'dog.foreleg'); place(fl, V(sx * 0.085, 0.42, 0.12), V(sx * 0.085, 0.05, 0.16));
      const fp = mk(root, ell(0.045, 0.03, 0.06), fur, 'dog.paw'); fp.position.set(sx * 0.085, 0.03, 0.19);
    }
    const tail = mk(root, limb(0.025, 0.012, 0.28, 5), fur, 'dog.tail'); tail.position.set(0.05, 0.04, -0.2); tail.rotation.set(Math.PI / 2 + 0.1, 0.9, 0);
    const neck = mk(root, limb(0.08, 0.07, 1, 7), fur, 'dog.neck'); place(neck, V(0, 0.55, 0.06), V(0, 0.72, 0.1));
    mk(root, ell(0.1, 0.06, 0.06), fur, 'dog.dewlap').position.set(0, 0.62, 0.15);
    // head
    this.headPivot = new THREE.Group(); this.headPivot.position.set(0, 0.74, 0.1); root.add(this.headPivot);
    const head = (this.head = new THREE.Group()); head.position.set(0, 0.03, 0.02); this.headPivot.add(head);
    this.headRadius = 0.1;
    mk(head, ell(0.085, 0.095, 0.1), fur, 'dog.skull');
    for (let i = 0; i < 3; i++) { const w = mk(head, new THREE.BoxGeometry(0.08 - i * 0.012, 0.006, 0.01), line, 'dog.wrinkle', { cast: false }); w.position.set(0, 0.03 + i * 0.016, 0.088 - i * 0.01); w.rotation.x = -0.35 - i * 0.12; }
    mk(head, ell(0.055, 0.055, 0.1), muz, 'dog.snout').position.set(0, -0.03, 0.11);
    this.nose = mk(head, ell(0.032, 0.024, 0.022), black, 'dog.nose'); this.nose.position.set(0, -0.005, 0.205);
    for (const sx of [-1, 1]) { const j = mk(head, ell(0.04, 0.06, 0.07), fur, 'dog.jowl'); j.position.set(sx * 0.042, -0.08, 0.12); j.rotation.z = sx * 0.15; }
    this.jaw = mk(head, ell(0.045, 0.02, 0.06), muz, 'dog.jaw'); this.jaw.position.set(0, -0.085, 0.1);
    this.lids = {};
    for (const [side, sx] of [['L', 1], ['R', -1]]) {
      mk(head, ell(0.017, 0.017, 0.012, 8, 6), eyeM, `dog.eye${side}`, { cast: false }).position.set(sx * 0.045, 0.02, 0.083);
      mk(head, ell(0.016, 0.007, 0.008, 6, 4), haw, 'dog.haw', { cast: false }).position.set(sx * 0.045, 0.004, 0.083);
      const lid = mk(head, ell(0.022, 0.012, 0.016, 8, 5), fur, `dog.lid${side}`, { cast: false }); lid.position.set(sx * 0.045, 0.03, 0.084);
      const brow = mk(head, new THREE.BoxGeometry(0.035, 0.008, 0.012), line, 'dog.brow', { cast: false }); brow.position.set(sx * 0.045, 0.048, 0.086);
      const ep = new THREE.Group(); ep.position.set(sx * 0.075, 0.03, 0.0); head.add(ep);   // long droopy ear
      const eg = ell(0.022, 0.15, 0.065, 7, 7); eg.translate(0, -0.13, 0.0);
      mk(ep, eg, ear, `dog.ear${side}`); ep.rotation.z = sx * 0.12;
      this.lids[side] = { lid, brow, sx, ear: ep };
    }
    this.eyeLocalV = { L: V(0.045, 0.02, 0.095), R: V(-0.045, 0.02, 0.095) };
    this.p = this.defaults();
  }
  defaults() { return { pos: [COMPARE.pos[0] + 0.95, COMPARE.pos[1]], rotY: 0, visible: false, sit: 1, headYaw: 0, headPitch: 0, lookAt: null, eyes: 'open', brows: 'neutral', mouth: 'closed' }; }
  headPos() { return W(V(), this.head); }
  nosePos() { return W(V(), this.nose); }
  eyeLocal(side = 'L') { return this.eyeLocalV[side].clone(); }
  eyePos(side = 'L') { return W(this.eyeLocalV[side], this.head); }
  mouthPos() { return W(V(0, -0.08, 0.15), this.head); }
  pawPos() { return W(V(0.085, 0.03, 0.19), this.root); }
  solve(t) {
    const p = this.p; this.root.visible = !!p.visible; if (!p.visible) return;
    this.root.position.set(p.pos[0], 0, p.pos[1]); this.root.rotation.set(0, p.rotY, 0);
    this.root.updateMatrixWorld(true);
    let yaw = p.headYaw, pitch = p.headPitch;
    if (p.lookAt) {
      const d = v3(p.lookAt).applyMatrix4(new THREE.Matrix4().copy(this.root.matrixWorld).invert()).sub(this.headPivot.position);
      yaw += clamp(Math.atan2(d.x, d.z), -1.0, 1.0); pitch += clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.5, 0.9);
    }
    this.headPivot.rotation.set(-pitch + Math.sin(t * 2.1) * 0.01, yaw, 0.08 * Math.sin(t * 0.7), 'YXZ');
    const sad = p.eyes === 'sad' || p.brows === 'sad', closed = p.eyes === 'closed' || ((t + 0.7) % 3.3) > 3.18;
    for (const side of ['L', 'R']) {
      const L = this.lids[side];
      L.lid.position.y = closed ? 0.018 : sad ? 0.026 : 0.031; L.lid.scale.set(1, closed ? 1.6 : sad ? 1.25 : 1, 1);
      L.brow.rotation.z = (sad ? -0.45 : 0) * L.sx; L.brow.position.y = sad ? 0.05 : 0.048;
      L.ear.rotation.set(pitch * 0.85 - 0.05, 0, L.sx * (0.12 + 0.04 * Math.sin(t * 1.3 + L.sx)));   // ears keep hanging down
    }
    this.jaw.position.y = p.mouth === 'open' ? -0.1 : -0.085;
  }
}

// ================================================================== SQUIRREL
class Squirrel {
  constructor(world) {
    this.name = 'squirrel';
    const root = (this.root = new THREE.Group()); root.name = 'squirrel'; world.scene.add(root);
    const fur = mat(furTex('#b5522a', { seed: 71, amount: 16 }), { rough: 0.95 }), belly = mat('#e8cfae', { rough: 0.9 }), dark = mat('#1a1210', { rough: 0.3 });
    const S = (this.S = 1.25);  // a bit bigger than life so it reads
    this.bodyG = new THREE.Group(); root.add(this.bodyG);
    mk(this.bodyG, ell(0.045 * S, 0.045 * S, 0.08 * S), fur, 'squirrel.body').position.set(0, 0.06 * S, 0);
    mk(this.bodyG, ell(0.03 * S, 0.03 * S, 0.05 * S), belly, 'squirrel.belly').position.set(0, 0.045 * S, 0.02 * S);
    this.head = new THREE.Group(); this.head.position.set(0, 0.095 * S, 0.075 * S); this.bodyG.add(this.head);
    mk(this.head, ell(0.033 * S, 0.03 * S, 0.038 * S), fur, 'squirrel.head');
    for (const sx of [-1, 1]) {
      mk(this.head, ell(0.008 * S, 0.009 * S, 0.006 * S), dark, 'squirrel.eye', { cast: false }).position.set(sx * 0.02 * S, 0.008 * S, 0.026 * S);
      mk(this.head, new THREE.ConeGeometry(0.008 * S, 0.022 * S, 4), fur, 'squirrel.ear').position.set(sx * 0.018 * S, 0.033 * S, -0.005 * S);
    }
    mk(this.head, ell(0.008 * S, 0.006 * S, 0.006 * S), dark, 'squirrel.nose', { cast: false }).position.set(0, -0.004 * S, 0.04 * S);
    this.tail = [];
    for (let i = 0; i < 6; i++) this.tail.push(mk(this.bodyG, ell((0.03 + i * 0.004) * S, (0.03 + i * 0.004) * S, 0.035 * S, 7, 5), fur, 'squirrel.tail'));
    this.legs = [];
    for (const [sx, z] of [[-1, 0.05], [1, 0.05], [-1, -0.05], [1, -0.05]]) { const l = mk(this.bodyG, ell(0.012 * S, 0.03 * S, 0.014 * S), fur, 'squirrel.leg'); l.userData = { sx, z: z * S }; this.legs.push(l); }
    this.p = this.defaults();
  }
  defaults() { return { pos: [0, 0, 0], rotY: 0, visible: false, run: 0, jump: 0, tail: 1 }; }
  headPos() { return W(V(), this.head); }
  nosePos() { return W(V(0, 0, 0.04 * this.S), this.head); }
  eyePos() { return this.headPos(); }
  eyeLocal() { return V(0, 0.008 * this.S, 0.026 * this.S); }
  mouthPos() { return this.nosePos(); }
  pawPos() { return W(V(), this.root); }
  solve(t) {
    const p = this.p, S = this.S; this.root.visible = !!p.visible; if (!p.visible) return;
    this.root.position.set(...p.pos); this.root.rotation.set(0, p.rotY, 0);
    const w = TAU * (p.run || 0), j = clamp(p.jump || 0);
    this.bodyG.position.y = Math.max(0, Math.sin(w)) * 0.03 * S * (1 - j) + j * 0.02 * S;
    this.bodyG.rotation.x = 0.25 * Math.cos(w) * (1 - j) - j * 0.35;
    for (const l of this.legs) {
      const front = l.userData.z > 0, ph = w + (front ? 0 : Math.PI);
      l.position.set(l.userData.sx * 0.03 * S, 0.02 * S, l.userData.z + Math.sin(ph) * 0.03 * S * (1 - j) + (front ? 1 : -1) * j * 0.04 * S);
      l.rotation.x = Math.sin(ph) * 0.8 * (1 - j) + (front ? -j : j) * 1.1;
    }
    for (let i = 0; i < this.tail.length; i++) {   // bushy tail: S-curve up over the back, waving
      const u = i / (this.tail.length - 1), ang = -0.4 + u * 2.6 * (p.tail ?? 1) - (0.25 * Math.sin(w * 0.5 + u * 2) + 0.4 * j);
      this.tail[i].position.set(0, 0.07 * S + Math.sin(ang) * 0.06 * S * (1 + u) + u * 0.06 * S, -0.08 * S - Math.cos(ang) * 0.05 * S * (1 + u * 0.8));
    }
    this.head.rotation.set(-0.15 * Math.cos(w) * (1 - j), 0, 0);
  }
}

// ================================================================== BIRDS (pool of flapping birds)
class Birds {
  constructor(world, n = 90) {
    this.calls = [];
    const g = (this.group = new THREE.Group()); g.name = 'birds'; world.scene.add(g);
    const body = mat('#2a2622', { rough: 0.8 }), wing = mat('#3a332c', { rough: 0.85, side: THREE.DoubleSide }), beak = mat('#c98a2a');
    const bodyG = ell(0.05, 0.045, 0.12, 7, 5), headG = ell(0.035, 0.035, 0.035, 6, 4); headG.translate(0, 0.03, 0.1);
    const beakG = new THREE.ConeGeometry(0.012, 0.04, 4); beakG.rotateX(Math.PI / 2); beakG.translate(0, 0.025, 0.145);
    const tailG = new THREE.BufferGeometry().setFromPoints([V(-0.04, 0, -0.08), V(0.04, 0, -0.08), V(0, 0.005, -0.2)]); tailG.computeVertexNormals();
    const wingG = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0.05), V(0, 0, -0.05), V(0.26, 0, -0.07), V(0, 0, 0.05), V(0.26, 0, -0.07), V(0.3, 0, 0.0)]); wingG.computeVertexNormals();
    this.birds = [];
    for (let i = 0; i < n; i++) {
      const b = new THREE.Group(); b.visible = false; g.add(b);
      mk(b, bodyG, body, 'bird.body'); mk(b, headG, body, 'bird.head'); mk(b, beakG, beak, 'bird.beak', { cast: false }); mk(b, tailG, wing, 'bird.tail');
      const wl = new THREE.Group(), wr = new THREE.Group(); b.add(wl); b.add(wr);
      mk(wl, wingG, wing, 'bird.wing'); mk(wr, wingG, wing, 'bird.wing').scale.x = -1;
      b.userData = { wl, wr };
      b.traverse((m) => { if (m.isMesh) m.userData.noAudit = true; });
      this.birds.push(b);
    }
  }
  burst(o) { this.calls.push(['burst', o]); }
  flyOff(o) { this.calls.push(['flyOff', o]); }
  perch(o) { this.calls.push(['perch', o]); }
  reset() { this.calls.length = 0; for (const b of this.birds) b.visible = false; }
  _fly(b, P, dir, t, flapHz, seed) {
    b.visible = true; b.position.copy(P); b.scale.setScalar(1.6);
    b.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(V(), dir.clone().normalize().negate(), V(0, 1, 0)));
    b.rotateZ(0.25 * Math.sin(t * 3 + seed));
    const f = Math.sin(TAU * flapHz * t + seed * 7);
    b.userData.wl.rotation.z = 0.9 * f; b.userData.wr.rotation.z = -0.9 * f;
  }
  _sit(b, P, ry) { b.visible = true; b.position.copy(P); b.scale.setScalar(1.6); b.rotation.set(0, ry, 0); b.userData.wl.rotation.z = 0.05; b.userData.wr.rotation.z = -0.05; }
  commit(ctx) {
    let k = 0;
    const next = () => (k < this.birds.length ? this.birds[k++] : null);
    for (const [type, o] of this.calls) {
      const t = o.t ?? ctx.t, R = rng(o.seed ?? 1);
      if (type === 'perch') {
        for (const [i, pt] of (o.points || []).entries()) { const b = next(); if (!b) break; this._sit(b, V(pt[0], pt[1] + Math.max(0, Math.sin(t * 3 + i * 2)) * 0.05, pt[2]), i * 2.1 + 0.6 * Math.sin(t * 1.3 + i)); }
      } else if (type === 'burst') {
        const trees = o.trees || [[0, 0]], n = o.count ?? 60, [h0, h1] = o.height || [9, 15], dir = V(...(o.dir || [0.2, 1, 0.5])), sp = o.speed ?? 6;
        for (let i = 0; i < n; i++) {
          const b = next(); if (!b) break;
          const tr = trees[i % trees.length], a = R() * TAU, rr = R() * 2.2, dl = R() * 0.3;
          const start = V(tr[0] + Math.cos(a) * rr, h0 + R() * (h1 - h0), tr[1] + Math.sin(a) * rr);
          const di = dir.clone().add(V((R() - 0.5) * 1.1, (R() - 0.3) * 0.6, (R() - 0.5) * 1.1)).normalize();
          const s = sp * (0.8 + R() * 0.5), hz = 7 + R() * 3, tau = t - o.t0 - dl;
          if (tau < 0) continue;
          const P = start.clone().addScaledVector(di, s * tau + 1.5 * tau * tau).add(V(Math.sin(tau * 4 + i) * 0.15, 0.6 * tau * tau, 0));
          this._fly(b, P, di.clone().add(V(0, 0.3, 0)), t, hz, i);
        }
      } else if (type === 'flyOff') {
        const n = o.count ?? 5, from = V(...(o.from || [0, 5, 0])), dir = V(...(o.dir || [1, 0.5, 0]));
        for (let i = 0; i < n; i++) {
          const b = next(); if (!b) break;
          const dl = R() * 0.35, di = dir.clone().add(V((R() - 0.5) * 0.8, (R() - 0.2) * 0.5, (R() - 0.5) * 0.8)).normalize();
          const start = from.clone().add(V((R() - 0.5) * 1.2, (R() - 0.5) * 0.6, (R() - 0.5) * 1.2)), tau = t - o.t0 - dl;
          if (tau < 0) this._sit(b, start, i); else this._fly(b, start.clone().addScaledVector(di, 5 * tau + tau * tau), di, t, 8, i);
        }
      }
    }
  }
}

// ================================================================== build
export function buildAnimals(world) {
  const M = bearMaterials();
  const bear = new Bear(world, M, { name: 'bear' });
  const mapBear = new Bear(world, M, { name: 'mapBear' });
  const dog = new Dog(world), squirrel = new Squirrel(world), birds = new Birds(world);
  const bearDefaults = () => { const p = bear.defaults(); p.pos = BEAR_PATH.stop.slice(); p.rotY = Math.PI; p.visible = true; return p; };
  const mapDefaults = () => { const p = mapBear.defaults(); p.pos = MAP_BEAR.pos.slice(); p.rotY = Math.PI; p.visible = false; p.scale = MAP_BEAR.scale; p.stance = 1; p.ears = 1; return p; };
  return {
    characters: [bear, dog, squirrel], bear, dog, squirrel, birds, mapBear,
    reset(t) { bear.p = bearDefaults(); mapBear.p = mapDefaults(); dog.p = dog.defaults(); squirrel.p = squirrel.defaults(); birds.reset(); },
    commit(ctx) { const t = ctx.t; bear.solve(t); mapBear.solve(t); dog.solve(t); squirrel.solve(t); birds.commit(ctx); },
  };
}
