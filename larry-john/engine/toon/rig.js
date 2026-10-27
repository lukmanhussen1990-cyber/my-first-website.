// Toy-like character rig: big round head with a sticker face, capsule limbs, mitten hands.
// Characters face +Z. "L" is the character's own left (+X).
import * as THREE from 'three';
import { limb, sphere, smoothLathe, capsule } from './geom.js';
import { clay } from './materials.js';
import { Face, applyFace } from './face.js';
import { deg, lerp, blink, noise1, clamp } from './anim.js';

export const ZERO_POSE = {
  y: 0, squash: 1, lean: 0,
  hips: { fwd: 0, side: 0, twist: 0 },
  spine: { fwd: 0, side: 0, twist: 0 },
  head: { nod: 0, turn: 0, tilt: 0 },
  armL: { fwd: 0, out: 8, twist: 0, elbow: 8 },
  armR: { fwd: 0, out: 8, twist: 0, elbow: 8 },
  legL: { fwd: 0, out: 2, knee: 0, foot: 0 },
  legR: { fwd: 0, out: 2, knee: 0, foot: 0 },
};

export function mergePose(base, over) {
  const out = structuredClone(base);
  for (const k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) out[k] = { ...(out[k] || {}), ...over[k] };
    else out[k] = over[k];
  }
  return out;
}
export function blendPose(a, b, t) {
  if (t <= 0) return a; if (t >= 1) return b;
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[k] ?? b[k], vb = b[k] ?? a[k];
    if (typeof va === 'number') out[k] = lerp(va, vb, t);
    else if (va && typeof va === 'object') out[k] = blendPose(va, vb, t);
    else out[k] = t < 0.5 ? va : vb;
  }
  return out;
}

// Common poses (merged on top of ZERO_POSE).
export const POSES = {
  stand: {},
  armsUp: { armL: { fwd: 25, out: 150, elbow: 15 }, armR: { fwd: 25, out: 150, elbow: 15 }, head: { nod: -10 }, spine: { fwd: -6 } },
  cheer: { armL: { fwd: 10, out: 140, elbow: 25 }, armR: { fwd: 10, out: 140, elbow: 25 }, head: { nod: -12 } },
  facepalm: { armR: { fwd: 97, out: 26, twist: 0, elbow: 51 }, head: { nod: 18, tilt: -4 }, spine: { fwd: 8 }, armL: { fwd: 0, out: 10, elbow: 10 } },
  shrug: { armL: { fwd: 20, out: 55, elbow: 75, twist: -40 }, armR: { fwd: 20, out: 55, elbow: 75, twist: 40 }, head: { tilt: 10 }, spine: { side: 0 } },
  point: { armR: { fwd: 85, out: 12, elbow: 4 } },
  zombie: { armL: { fwd: 88, out: 6, elbow: 6 }, armR: { fwd: 84, out: 6, elbow: 10 }, head: { tilt: 14, nod: 6 }, spine: { fwd: 8 } },
  holdFront: { armL: { fwd: 45, out: 10, elbow: 60 }, armR: { fwd: 45, out: 10, elbow: 60 } },
  scared: { armL: { fwd: 40, out: 30, elbow: 110 }, armR: { fwd: 40, out: 30, elbow: 110 }, spine: { fwd: -6 }, legL: { out: 8 }, legR: { out: 8 } },
  sit: { legL: { fwd: 85, knee: 85 }, legR: { fwd: 85, knee: 85 } },
};

export class Character extends THREE.Group {
  constructor(spec) {
    super();
    this.spec = spec;
    this.name = spec.name || 'character';
    this.seed = spec.seed ?? 1;
    this.joints = {};
    this.parts = {};
    this.build();
    this.pose = structuredClone(ZERO_POSE);
    this.applyPose(this.pose);
  }

  j(name, parent, pos = [0, 0, 0]) {
    const g = new THREE.Group(); g.name = name; g.position.set(...pos);
    parent.add(g); this.joints[name] = g; return g;
  }
  mesh(geo, mat, parent, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], name) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scl);
    m.castShadow = true; m.receiveShadow = true;
    if (name) { m.name = name; this.parts[name] = m; }
    parent.add(m); return m;
  }

  build() {
    const s = this.spec;
    const skin = clay(s.skin);
    this.skinMat = skin;
    const body = this.j('body', this);
    const hips = this.j('hips', body, [0, s.hipH, 0]);
    const spine = this.j('spine', hips);
    // torso layers: [{profile: [[r,y]...], color, sx, sz}]
    for (const layer of s.torso) {
      const m = this.mesh(smoothLathe(layer.profile, 40, 40), layer.mat || clay(layer.color), layer.attach === 'hips' ? hips : spine,
        [0, 0, layer.z || 0], [0, 0, 0], [layer.sx || 1, 1, layer.sz || 1], layer.name);
    }
    const chest = this.j('chest', spine, [0, s.shoulderY, 0]);
    // head
    const head = this.j('head', chest, [0, s.neck ?? 0.02, s.headZ || 0]);
    const skull = this.j('skull', head, [0, s.headR * 0.95, 0]);
    this.face = new Face({ lid: s.skinShade || '#e2a98a', ...(s.faceStyle || {}) }, s.faceSize || 1024);
    const headMat = clay(s.skin, { unique: true });
    applyFace(headMat, this.face, { extent: s.headR, glow: 0.0 });
    this.headMat = headMat;
    this.mesh(sphere(s.headR, 64, 48), headMat, skull, [0, 0, 0], [0, 0, 0], s.headScale || [1, 1, 1], 'skull');
    // nose
    if (s.nose !== false) this.mesh(sphere(s.headR * (s.noseR || 0.13), 24, 18), clay(s.noseColor || s.skin), skull,
      [0, s.headR * (s.noseY ?? -0.1), s.headR * 0.98], [0, 0, 0], [1, 0.92, 0.85], 'nose');
    // ears
    if (s.ears !== false) for (const side of [-1, 1])
      this.mesh(sphere(s.headR * 0.17, 20, 14), skin, skull, [side * s.headR * 0.96, -s.headR * 0.02, -s.headR * 0.05], [0, 0, 0], [0.55, 1, 0.85]);
    // arms
    const a = s.arm;
    for (const side of [1, -1]) {
      const L = side > 0 ? 'L' : 'R';
      const sh = this.j('sh' + L, chest, [side * s.shoulderX, 0, 0]);
      this.mesh(limb(a.r0, a.r1, a.upper), a.upperMat || skin, sh, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'upperArm' + L);
      if (a.sleeve) this.mesh(limb(a.sleeve.r0, a.sleeve.r1, a.sleeve.len), clay(a.sleeve.color), sh, [0, 0.012, 0], [0, 0, 0], [1, 1, 1], 'sleeve' + L);
      const el = this.j('el' + L, sh, [0, -a.upper, 0]);
      this.mesh(limb(a.r1, a.r2 ?? a.r1 * 0.95, a.lower), a.lowerMat || skin, el, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'forearm' + L);
      if (a.cuff) this.mesh(limb(a.cuff.r0, a.cuff.r1, a.cuff.len), clay(a.cuff.color), el, [0, -a.lower + a.cuff.len + a.cuff.r1 * 0.2, 0], [0, 0, 0], [1, 1, 1], 'cuff' + L);
      const hd = this.j('hand' + L, el, [0, -a.lower, 0]);
      this.buildHand(hd, side, a.handR, a.handMat || skin);
    }
    // legs
    const l = s.leg;
    for (const side of [1, -1]) {
      const L = side > 0 ? 'L' : 'R';
      const hp = this.j('hip' + L, hips, [side * s.hipX, 0, 0]);
      this.mesh(limb(l.r0, l.r1, l.upper), l.upperMat || skin, hp, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'thigh' + L);
      const kn = this.j('knee' + L, hp, [0, -l.upper, 0]);
      this.mesh(limb(l.r1, l.r2 ?? l.r1, l.lower), l.lowerMat || skin, kn, [0, 0, 0], [0, 0, 0], [1, 1, 1], 'shin' + L);
      if (l.sock) this.mesh(limb(l.sock.r0, l.sock.r1, l.sock.len), clay(l.sock.color), kn, [0, -l.lower + l.sock.len, 0], [0, 0, 0], [1, 1, 1], 'sock' + L);
      const ft = this.j('foot' + L, kn, [0, -l.lower, 0]);
      if (l.shoe) l.shoe(this, ft, side);
    }
    if (s.hair) s.hair(this, skull);
    if (s.extras) s.extras(this);
  }

  buildHand(parent, side, r, mat) {
    const g = new THREE.Group(); g.name = 'mitten'; parent.add(g);
    this.mesh(sphere(r, 24, 18), mat, g, [0, -r * 0.75, 0], [0, 0, 0], [0.92, 1.05, 0.72]);
    this.mesh(sphere(r * 0.42, 16, 12), mat, g, [-side * r * 0.62, -r * 0.45, r * 0.32], [0, 0, 0], [1, 1.25, 1]);
    // alternate hand shapes, hidden until used
    const peace = new THREE.Group(); peace.name = 'peace'; peace.visible = false; parent.add(peace);
    this.mesh(sphere(r * 0.9, 24, 18), mat, peace, [0, -r * 0.7, 0], [0, 0, 0], [0.95, 0.85, 0.75]);
    for (const k of [-1, 1]) this.mesh(capsule(r * 0.22, r * 0.9, 6, 12), mat, peace, [k * r * 0.28, -r * 1.65, 0], [0, 0, k * 0.22]);
    const point = new THREE.Group(); point.name = 'point'; point.visible = false; parent.add(point);
    this.mesh(sphere(r * 0.9, 24, 18), mat, point, [0, -r * 0.7, 0], [0, 0, 0], [0.95, 0.85, 0.75]);
    this.mesh(capsule(r * 0.22, r * 0.95, 6, 12), mat, point, [0, -r * 1.7, 0]);
    parent.userData.hands = { mitten: g, peace, point };
  }
  setHand(side, kind = 'mitten') {
    const h = this.joints['hand' + side].userData.hands;
    for (const k in h) h[k].visible = k === kind;
  }
  hand(side) { return this.joints['hand' + side]; }

  // ---- posing ----
  applyPose(p) {
    const J = this.joints, s = this.spec;
    this.pose = p;
    const sq = p.squash ?? 1, k = 1 / Math.sqrt(Math.max(0.1, sq));
    J.body.scale.set(k, sq, k);
    J.body.position.y = p.y || 0;
    J.body.rotation.z = deg(p.lean || 0);
    J.hips.rotation.set(deg(p.hips.fwd), deg(p.hips.twist), deg(p.hips.side), 'YXZ');
    J.spine.rotation.set(deg(p.spine.fwd), deg(p.spine.twist), deg(p.spine.side), 'YXZ');
    J.head.rotation.set(deg(p.head.nod), deg(p.head.turn), deg(p.head.tilt), 'YXZ');
    for (const [L, side] of [['L', 1], ['R', -1]]) {
      const a = p['arm' + L];
      J['sh' + L].rotation.set(deg(-a.fwd), deg(side * (a.twist || 0)), deg(side * a.out), 'ZXY');
      J['el' + L].rotation.set(deg(-a.elbow), 0, 0);
      const lg = p['leg' + L];
      J['hip' + L].rotation.set(deg(-lg.fwd), deg(side * (lg.twist || 0)), deg(side * (lg.out || 0)), 'ZXY');
      J['knee' + L].rotation.set(deg(lg.knee || 0), 0, 0);
      J['foot' + L].rotation.set(deg(lg.foot || 0), 0, 0);
    }
  }

  // Idle life: breathing, gentle sway, blinking. Adds on top of the current pose.
  idle(t, amount = 1) {
    const J = this.joints;
    const br = Math.sin(t * 2 * Math.PI / 3.4 + this.seed) * 0.012 * amount;
    J.spine.scale.set(1 + br * 0.6, 1 + br, 1 + br * 0.6);
    J.head.rotation.z += deg(noise1(t * 0.35, this.seed) * 2.5 * amount);
    J.head.rotation.x += deg(noise1(t * 0.3, this.seed + 3) * 2 * amount);
  }
  blinkAmount(t) { return blink(t, this.seed + 11); }

  setFace(expr, extra = {}, t = null) {
    const lid = t !== null && extra.lid === undefined ? this.blinkAmount(t) : (extra.lid || 0);
    this.face.set(expr, { ...extra, lid });
  }

  // Walk / run cycles: returns a pose fragment to merge.
  static walk(phase, amt = 1, run = false) {
    const s = Math.sin(phase * 2 * Math.PI), c = Math.cos(phase * 2 * Math.PI);
    const A = (run ? 42 : 26) * amt;
    return {
      y: Math.abs(Math.sin(phase * 2 * Math.PI)) * (run ? 0.06 : 0.025) * amt,
      hips: { twist: s * 6 * amt, fwd: run ? 8 : 0 },
      spine: { twist: -s * 8 * amt, fwd: run ? 10 : 2 },
      armL: { fwd: -s * A * 0.8, out: 10, elbow: run ? 80 : 20 + Math.max(0, -s) * 15 },
      armR: { fwd: s * A * 0.8, out: 10, elbow: run ? 80 : 20 + Math.max(0, s) * 15 },
      legL: { fwd: s * A, knee: Math.max(0, -c) * (run ? 70 : 40) * amt + 4, out: 2 },
      legR: { fwd: -s * A, knee: Math.max(0, c) * (run ? 70 : 40) * amt + 4, out: 2 },
    };
  }

  // Look at a world point with the head (adds yaw/pitch, clamped).
  lookAtWorld(target, weight = 1) {
    const head = this.joints.head;
    const hp = new THREE.Vector3(); head.getWorldPosition(hp);
    const inv = new THREE.Matrix4().copy(this.matrixWorld).invert();
    const lt = target.clone().applyMatrix4(inv), lh = hp.clone().applyMatrix4(inv);
    const d = lt.sub(lh);
    const yaw = clamp(Math.atan2(d.x, d.z), -1.1, 1.1), pitch = clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.6, 0.6);
    head.rotation.y += yaw * weight; head.rotation.x += pitch * weight;
  }
}
