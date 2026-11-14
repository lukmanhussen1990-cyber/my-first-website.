import * as THREE from 'three';
import { mat, box, limb, mesh, grp, lerp, clamp, hash, starShape, canvasTex, plane } from './lib.js';

const INK = '#17171c';
const HIP_Y = 0.86;
const SEG = 8, ROT = Math.PI / 8;

// ---------- pose helpers ----------
export const P0 = {
  y: 0, lean: 0, twist: 0, tilt: 0, spine: 0, spineZ: 0, spineY: 0, headX: 0, headY: 0, headZ: 0,
  lShX: 0, lShY: 0, lShZ: 0.08, lEl: 0.12, rShX: 0, rShY: 0, rShZ: 0.08, rEl: 0.12,
  lHipX: 0, lHipZ: 0.02, lKnee: 0, rHipX: 0, rHipZ: 0.02, rKnee: 0, sx: 1, sy: 1, sz: 1,
};
export const pose = (o = {}) => ({ ...P0, ...o });
export function mix(a, b, t) { const r = {}; for (const k in P0) r[k] = lerp(a[k] ?? P0[k], b[k] ?? P0[k], t); return r; }
export function add(a, d) { const r = { ...a }; for (const k in d) r[k] = (r[k] ?? 0) + d[k]; return r; }

export const POSES = {
  stand: pose(),
  hipsHands: pose({ lShZ: 0.45, lShX: 0.25, lEl: 1.9, rShZ: 0.45, rShX: 0.25, rEl: 1.9 }),
  cheer: pose({ lShX: 2.75, lShZ: 0.45, lEl: 0.2, rShX: 2.75, rShZ: 0.45, rEl: 0.2, headX: -0.15 }),
  fist: pose({ rShX: 2.9, rShZ: 0.15, rEl: 0.3, lShX: 0.3, lEl: 1.2, headX: -0.1 }),
  pushUp: pose({ lShX: 2.2, lShZ: 0.12, lEl: 0.5, rShX: 2.2, rShZ: 0.12, rEl: 0.5, spine: 0.35, lHipX: 0.5, lKnee: 0.7, rHipX: -0.35, rKnee: 0.15, headX: -0.4, y: -0.05 }),
  carryFront: pose({ lShX: 1.1, lShZ: 0.1, lEl: 0.9, rShX: 1.1, rShZ: 0.1, rEl: 0.9, spine: -0.08 }),
  carryUp: pose({ lShX: 2.85, lShZ: 0.3, lEl: 0.25, rShX: 2.85, rShZ: 0.3, rEl: 0.25, spine: -0.05 }),
  hunch: pose({ spine: 0.95, headX: -0.75, lShX: 1.0, lEl: 1.5, rShX: 1.0, rEl: 1.5, lShZ: 0.35, rShZ: 0.35, lKnee: 0.35, rKnee: 0.35, lHipX: 0.35, rHipX: 0.35, y: -0.04 }),
  shrug: pose({ lShZ: 0.35, lShX: 0.25, lEl: 1.4, lShY: 0.6, rShZ: 0.35, rShX: 0.25, rEl: 1.4, rShY: 0.6, headZ: 0.12, spineZ: 0.02 }),
  point: pose({ rShX: 1.5, rShZ: 0.25, rEl: 0.05 }),
  phone: pose({ rShX: 0.6, rShZ: 0.65, rEl: 2.5, rShY: -0.3, headZ: 0.12 }),
  thumb: pose({ rShX: 1.15, rShZ: 0.2, rEl: 1.4 }),
  give: pose({ rShX: 1.2, rShZ: 0.05, rEl: 0.35 }),
  armsCross: pose({ lShX: 0.65, lShZ: 0.2, lEl: 2.0, lShY: -0.7, rShX: 0.75, rShZ: 0.2, rEl: 2.0, rShY: -0.7 }),
  sad: pose({ spine: 0.12, headX: 0.32, lShZ: 0.02, rShZ: 0.02, lEl: 0.05, rEl: 0.05 }),
  shock: pose({ lShX: 0.6, lShZ: 0.7, lEl: 0.9, rShX: 0.6, rShZ: 0.7, rEl: 0.9, spine: -0.12, headX: -0.08 }),
  wave: pose({ rShX: 2.6, rShZ: 0.6, rEl: 0.5 }),
  reach: pose({ lShX: 1.5, lEl: 0.1, rShX: 1.5, rEl: 0.1, lShZ: 0.05, rShZ: 0.05 }),
};
export function walk(ph, amp = 1) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return pose({
    lHipX: 0.42 * s * amp, rHipX: -0.42 * s * amp,
    lKnee: (0.08 + 0.55 * Math.max(0, -c)) * amp, rKnee: (0.08 + 0.55 * Math.max(0, c)) * amp,
    lShX: -0.38 * s * amp, rShX: 0.38 * s * amp, lEl: 0.35, rEl: 0.35,
    y: 0.025 * (1 - Math.abs(s)) * amp - 0.012, spineY: 0.06 * s * amp, headY: -0.04 * s * amp,
  });
}
export function run(ph, amp = 1) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return pose({
    lHipX: 0.8 * s * amp, rHipX: -0.8 * s * amp,
    lKnee: (0.25 + 1.1 * Math.max(0, -c)) * amp, rKnee: (0.25 + 1.1 * Math.max(0, c)) * amp,
    lShX: -0.9 * s * amp, rShX: 0.9 * s * amp, lEl: 1.4, rEl: 1.4, lShZ: 0.15, rShZ: 0.15,
    y: 0.06 * Math.abs(c) * amp - 0.03, spine: 0.25 * amp, headX: -0.15 * amp,
  });
}

// ---------- character ----------
export class Char {
  constructor(o) {
    this.o = o = Object.assign({ skin: '#f2c3a0', shirt: '#2f7de1', pants: '#23304f', shoes: '#f4f4f4', hair: '#5a3418', hairStyle: 'short', sleeves: 'short', height: 1, width: 1, seed: 1 }, o);
    this.seed = o.seed;
    const root = this.root = new THREE.Group(); root.name = o.name;
    const body = this.body = new THREE.Group(); root.add(body);
    body.scale.set(o.width, o.height, o.width);
    this.skinMat = mat(o.skin, { unique: true });
    const skin = this.skinMat, shirt = mat(o.shirt), pants = mat(o.pants), shoes = mat(o.shoes);

    // hips & legs
    const hips = this.hips = new THREE.Group(); hips.position.y = HIP_Y; body.add(hips);
    this.pelvis = box(0.34, 0.17, 0.22, pants, { pos: [0, 0.02, 0] }); hips.add(this.pelvis);
    const leg = side => {
      const hip = new THREE.Group(); hip.position.set(side * 0.092, -0.02, 0); hips.add(hip);
      hip.add(limb(0.155, 0.41, 0.165, pants));
      const knee = new THREE.Group(); knee.position.y = -0.40; hip.add(knee);
      knee.add(limb(0.14, 0.37, 0.15, pants, { taper: 0.9 }));
      const ankle = new THREE.Group(); ankle.position.y = -0.375; knee.add(ankle);
      ankle.add(box(0.135, 0.085, 0.26, shoes, { pos: [0, -0.035, 0.045] }));
      ankle.add(box(0.14, 0.02, 0.27, mat('#d9d9d9'), { pos: [0, -0.072, 0.045] }));
      return { hip, knee, ankle };
    };
    this.lLeg = leg(1); this.rLeg = leg(-1);

    // spine / torso
    const spine = this.spine = new THREE.Group(); spine.position.y = 0.09; hips.add(spine);
    const tg = new THREE.BoxGeometry(0.42, 0.5, 0.25); tg.translate(0, 0.25, 0);
    const tp = tg.attributes.position;
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); const k = y > 0.3 ? 1.06 : 0.86; tp.setX(i, tp.getX(i) * k); }
    tg.computeVertexNormals();
    spine.add(mesh(tg, shirt));
    if (o.collar) spine.add(box(0.2, 0.03, 0.02, mat(o.collar), { pos: [0, 0.47, 0.13] }));
    if (o.logo) { const lg = plane(0.16, 0.16, o.logo, { transparent: true }); lg.position.set(0, 0.32, 0.128); spine.add(lg); }

    // neck & head
    const neck = new THREE.Group(); neck.position.y = 0.5; spine.add(neck);
    neck.add(box(0.11, 0.09, 0.11, skin, { pos: [0, 0.03, 0] }));
    const head = this.head = new THREE.Group(); head.position.y = 0.07; neck.add(head);
    this.buildHead(head, skin);

    // arms
    const arm = side => {
      const sh = new THREE.Group(); sh.position.set(side * 0.255, 0.44, 0); spine.add(sh);
      sh.rotation.order = 'XYZ';
      sh.add(limb(0.13, o.sleeves === 'long' ? 0.31 : 0.17, 0.13, shirt));
      if (o.sleeves !== 'long') { const u = limb(0.098, 0.15, 0.098, skin); u.position.y = -0.16; sh.add(u); }
      const el = new THREE.Group(); el.position.y = -0.30; sh.add(el);
      el.add(limb(0.092, 0.26, 0.092, o.sleeves === 'long' ? shirt : skin, { taper: 0.9 }));
      if (o.sleeves === 'long') { const cuff = limb(0.08, 0.02, 0.08, skin); cuff.position.y = -0.255; el.add(cuff); }
      const hand = new THREE.Group(); hand.position.y = -0.265; el.add(hand);
      hand.add(limb(0.05, 0.11, 0.095, skin));
      const th = box(0.035, 0.06, 0.035, skin, { pos: [-side * 0.005, -0.03, 0.06], rot: [-0.5, 0, 0] }); hand.add(th);
      return { sh, el, hand };
    };
    this.lArm = arm(1); this.rArm = arm(-1);

    // fx: dizzy stars, sweat drop
    this.stars = new THREE.Group(); this.stars.position.y = 0.42; head.add(this.stars);
    const sg = new THREE.ExtrudeGeometry(starShape(0.05, 0.022), { depth: 0.015, bevelEnabled: false });
    for (let i = 0; i < 4; i++) { const s = mesh(sg, mat('#ffd21f', { emissive: '#b88a00', emissiveIntensity: 0.5 }), { cast: false }); this.stars.add(s); }
    this.sweat = mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#7fd0ff', { roughness: 0.2, emissive: '#2a6c96', emissiveIntensity: 0.3 }), { cast: false });
    this.sweat.scale.set(0.8, 1.3, 0.6); this.sweat.position.set(-0.19, 0.25, 0.08); head.add(this.sweat);
    this.pose = pose();
    this.setFace();
  }

  buildHead(head, skin) {
    const o = this.o, H = 0.23, RT = 0.165, RB = 0.135;
    this.H = H; this.RT = RT; this.RB = RB;
    const hg = new THREE.CylinderGeometry(RT, RB, H, SEG, 1); hg.rotateY(ROT); hg.translate(0, H / 2, 0);
    head.add(mesh(hg, skin));
    const dg = new THREE.SphereGeometry(RT, SEG, 3, 0, Math.PI * 2, 0, Math.PI / 2); dg.rotateY(ROT); dg.scale(1, 0.72, 1); dg.translate(0, H, 0);
    head.add(mesh(dg, skin));
    const fz = y => (RB + (RT - RB) * y / H) * Math.cos(ROT);
    this.fz = fz;
    // nose, ears
    head.add(box(0.04, 0.06, 0.05, skin, { pos: [0, 0.1, fz(0.1) + 0.015] }));
    head.add(box(0.03, 0.07, 0.05, skin, { pos: [0.16, 0.12, 0] }));
    head.add(box(0.03, 0.07, 0.05, skin, { pos: [-0.16, 0.12, 0] }));
    const hair = mat(o.hair);
    const hs = o.hairStyle;
    if (hs !== 'bald') {
      const cap = new THREE.SphereGeometry(RT * 1.09, SEG, 3, 0, Math.PI * 2, 0, Math.PI / 2); cap.rotateY(ROT); cap.scale(1, 0.86, 1); cap.translate(0, H - 0.02, 0);
      head.add(mesh(cap, hs === 'cap' ? mat(o.capColor || '#d33') : hair));
      // back & sides
      const back = new THREE.CylinderGeometry(RT * 1.07, RT * 1.02, 0.12, SEG, 1, true, Math.PI * 0.62, Math.PI * 0.76); back.rotateY(ROT); back.translate(0, H - 0.05, 0);
      if (hs !== 'cap') head.add(mesh(back, hair));
    } else {
      head.add(box(0.03, 0.06, 0.12, hair, { pos: [0.165, 0.16, -0.03] }));
      head.add(box(0.03, 0.06, 0.12, hair, { pos: [-0.165, 0.16, -0.03] }));
    }
    if (hs === 'short' || hs === 'spiky') {
      const fr = box(0.30, 0.06, 0.06, hair, { pos: [0.02, H - 0.005, fz(H) - 0.01], rot: [0.25, 0, -0.12] }); head.add(fr);
      head.add(box(0.12, 0.05, 0.05, hair, { pos: [-0.09, H - 0.02, fz(H) - 0.005], rot: [0.3, 0, 0.3] }));
    }
    if (hs === 'spiky') {
      const cg = new THREE.ConeGeometry(0.05, 0.12, 4);
      [[0, 0.11, 0.03, 0, 0], [0.08, 0.09, 0, 0, -0.5], [-0.08, 0.09, 0, 0, 0.5], [0.04, 0.09, -0.08, -0.4, -0.2], [-0.04, 0.09, -0.08, -0.4, 0.2]].forEach(([x, y, z, rx, rz]) => {
        const c = mesh(cg, hair); c.position.set(x, H + y, z); c.rotation.set(rx, 0, rz); head.add(c);
      });
    }
    if (hs === 'bun') {
      head.add(mesh(new THREE.IcosahedronGeometry(0.085, 0), hair).translateY(H + 0.1).translateZ(-0.07));
    }
    if (hs === 'long') {
      head.add(box(0.34, 0.36, 0.08, hair, { pos: [0, 0.1, -0.13] }));
      head.add(box(0.05, 0.3, 0.12, hair, { pos: [0.165, 0.11, -0.04] }));
      head.add(box(0.05, 0.3, 0.12, hair, { pos: [-0.165, 0.11, -0.04] }));
      head.add(box(0.3, 0.06, 0.06, hair, { pos: [0, H - 0.01, fz(H) - 0.01], rot: [0.3, 0, 0] }));
    }
    if (hs === 'cap') {
      const brim = box(0.26, 0.025, 0.16, mat(o.capColor || '#d33'), { pos: [0, H + 0.01, fz(H) + 0.05], rot: [-0.08, 0, 0] });
      if (o.capBack) { brim.position.z = -fz(H) - 0.05; brim.rotation.x = 0.08; }
      head.add(brim);
      head.add(box(0.29, 0.04, 0.06, hair, { pos: [0, H - 0.04, -0.1] }));
    }
    if (o.mustache) head.add(box(0.13, 0.035, 0.03, mat(o.hair), { pos: [0, 0.07, fz(0.07) + 0.02] }));
    if (o.glasses) {
      const gm = mat(INK);
      const rg = new THREE.TorusGeometry(0.038, 0.007, 4, 8);
      [0.06, -0.06].forEach(x => { const r = mesh(rg, gm, { cast: false }); r.position.set(x, 0.135, fz(0.135) + 0.022); head.add(r); });
      head.add(box(0.04, 0.008, 0.008, gm, { pos: [0, 0.14, fz(0.14) + 0.022] }));
    }
    // headband (hidden until "made it real")
    this.band = new THREE.Group();
    const bg = new THREE.CylinderGeometry(RT * 1.02, RT * 1.01, 0.05, SEG, 1, true); bg.rotateY(ROT);
    const bm = mat('#e8302c', { side: THREE.DoubleSide });
    const ring = mesh(bg, bm); ring.position.y = H - 0.02; this.band.add(ring);
    const t1 = box(0.04, 0.14, 0.015, bm, { pos: [0.03, H - 0.08, -RT - 0.01], rot: [0.3, 0, 0.35] });
    const t2 = box(0.04, 0.12, 0.015, bm, { pos: [-0.03, H - 0.08, -RT - 0.01], rot: [0.3, 0, -0.3] });
    this.band.add(t1, t2); this.bandTails = [t1, t2];
    this.band.visible = false; head.add(this.band);

    // ---- face features ----
    const ink = mat(INK, { roughness: 0.5 });
    const F = this.face = {};
    const eye = (x) => { const e = box(0.036, 0.062, 0.02, ink, { pos: [x, 0.135, fz(0.135) + 0.006], cast: false }); head.add(e); return e; };
    F.eyes = [eye(0.058), eye(-0.058)];
    const white = mat('#ffffff', { roughness: 0.5 });
    F.wide = [0.06, -0.06].map(x => { const g = grp(box(0.075, 0.085, 0.012, white, { cast: false }), box(0.032, 0.05, 0.02, ink, { cast: false, pos: [0, -0.005, 0.006] })); g.position.set(x, 0.14, fz(0.14) + 0.006); head.add(g); return g; });
    const arcG = new THREE.TorusGeometry(0.026, 0.008, 4, 10, Math.PI);
    F.happy = [0.058, -0.058].map(x => { const a = mesh(arcG, ink, { cast: false }); a.position.set(x, 0.125, fz(0.125) + 0.008); head.add(a); return a; });
    F.closed = [0.058, -0.058].map(x => box(0.05, 0.012, 0.02, ink, { cast: false, pos: [x, 0.125, fz(0.125) + 0.006] })).map(m => (head.add(m), m));
    const xEye = x => { const g = grp(box(0.06, 0.012, 0.02, ink, { cast: false, rot: [0, 0, 0.78] }), box(0.06, 0.012, 0.02, ink, { cast: false, rot: [0, 0, -0.78] })); g.position.set(x, 0.135, fz(0.135) + 0.006); head.add(g); return g; };
    F.x = [xEye(0.058), xEye(-0.058)];
    const chev = (x, dir) => { const g = grp(box(0.045, 0.012, 0.02, ink, { cast: false, pos: [0, 0.011, 0], rot: [0, 0, -0.5 * dir] }), box(0.045, 0.012, 0.02, ink, { cast: false, pos: [0, -0.011, 0], rot: [0, 0, 0.5 * dir] })); g.position.set(x, 0.135, fz(0.135) + 0.006); head.add(g); return g; };
    F.squint = [chev(0.058, -1), chev(-0.058, 1)];
    const dollarTex = canvasTex(64, 64, (c) => { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(32, 32, 30, 0, 7); c.fill(); c.fillStyle = '#1f9e46'; c.font = '900 52px Mont'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 32, 35); });
    F.dollar = [0.062, -0.062].map(x => { const p = plane(0.085, 0.085, dollarTex, { transparent: true }); p.material.emissive = new THREE.Color('#ffffff'); p.material.emissiveMap = dollarTex; p.material.emissiveIntensity = 0.4; p.position.set(x, 0.14, fz(0.14) + 0.01); head.add(p); return p; });
    F.brows = [0.06, -0.06].map(x => { const b = box(0.078, 0.022, 0.02, ink, { cast: false, pos: [x, 0.2, fz(0.2) + 0.006] }); head.add(b); return b; });
    const mz = fz(0.06) + 0.007;
    const dark = mat('#4a1416', { roughness: 0.6 });
    F.line = box(0.07, 0.013, 0.02, ink, { cast: false, pos: [0, 0.055, mz] }); head.add(F.line);
    const sm = new THREE.TorusGeometry(0.04, 0.009, 4, 10, Math.PI);
    F.smile = mesh(sm, ink, { cast: false }); F.smile.rotation.z = Math.PI; F.smile.position.set(0, 0.075, mz + 0.002); head.add(F.smile);
    F.frown = mesh(sm, ink, { cast: false }); F.frown.position.set(0, 0.035, mz + 0.004); head.add(F.frown);
    const og = new THREE.CircleGeometry(0.035, 12);
    F.open = mesh(og, dark, { cast: false }); F.open.position.set(0, 0.055, mz); head.add(F.open);
    const gg = new THREE.CircleGeometry(0.05, 12, Math.PI, Math.PI);
    F.grin = grp(mesh(gg, dark, { cast: false }), box(0.09, 0.016, 0.004, white, { cast: false, pos: [0, -0.008, 0.002] }));
    F.grin.position.set(0, 0.075, mz); head.add(F.grin);
    F.grit = grp(box(0.1, 0.045, 0.012, ink, { cast: false }), box(0.088, 0.033, 0.014, white, { cast: false }), box(0.088, 0.004, 0.016, ink, { cast: false }));
    F.grit.position.set(0, 0.055, mz); head.add(F.grit);
    const blush = mat('#ff7a8a', { transparent: true, opacity: 0.55, roughness: 1 });
    F.blush = [0.09, -0.09].map(x => { const b = mesh(new THREE.CircleGeometry(0.028, 8), blush, { cast: false }); b.position.set(x, 0.085, fz(0.085) + 0.004); head.add(b); return b; });
  }

  // eyes: open|wide|happy|closed|x|squint|dollar ; mouth: line|smile|frown|open|grin|grit|none ; brow: number angle (+ angry / - sad), browY offset
  setFace({ eyes = 'open', mouth = 'line', open = 0.6, brow = 0, browY = 0, blink = 0, red = 0, blush = false, look = [0, 0] } = {}) {
    const F = this.face;
    const vis = (arr, v) => arr.forEach(m => (m.visible = v));
    vis(F.eyes, eyes === 'open'); vis(F.wide, eyes === 'wide'); vis(F.happy, eyes === 'happy'); vis(F.closed, eyes === 'closed');
    vis(F.x, eyes === 'x'); vis(F.squint, eyes === 'squint'); vis(F.dollar, eyes === 'dollar');
    if (eyes === 'open') {
      if (blink > 0.5) { vis(F.eyes, false); vis(F.closed, true); }
      F.eyes.forEach((e, i) => { e.position.x = (i ? -0.058 : 0.058) + look[0] * 0.012; e.position.y = 0.135 + look[1] * 0.012; });
    }
    vis(F.brows, !['x'].includes(eyes));
    F.brows.forEach((b, i) => { b.rotation.z = (i ? -1 : 1) * brow; b.position.y = 0.2 + browY + (eyes === 'wide' ? 0.03 : 0); });
    ['line', 'smile', 'frown', 'open', 'grin', 'grit'].forEach(k => (F[k].visible = mouth === k));
    if (mouth === 'open') F.open.scale.set(0.85 + open * 0.25, 0.25 + open * 1.1, 1);
    vis(F.blush, blush);
    this.skinMat.color.set(this.o.skin).lerp(new THREE.Color('#ff4a3a'), red * 0.55);
  }

  apply(p) {
    this.pose = p;
    const h = this.hips;
    h.position.y = HIP_Y + p.y; h.rotation.set(p.lean, p.twist, p.tilt);
    this.body.scale.set(this.o.width * p.sx, this.o.height * p.sy, this.o.width * p.sz);
    this.spine.rotation.set(p.spine, p.spineY, p.spineZ);
    this.head.rotation.set(p.headX, p.headY, p.headZ);
    this.lArm.sh.rotation.set(-p.lShX, p.lShY, p.lShZ); this.lArm.el.rotation.x = -p.lEl;
    this.rArm.sh.rotation.set(-p.rShX, -p.rShY, -p.rShZ); this.rArm.el.rotation.x = -p.rEl;
    this.lLeg.hip.rotation.set(-p.lHipX, 0, p.lHipZ); this.lLeg.knee.rotation.x = p.lKnee;
    this.rLeg.hip.rotation.set(-p.rHipX, 0, -p.rHipZ); this.rLeg.knee.rotation.x = p.rKnee;
    // keep feet flat-ish
    this.lLeg.ankle.rotation.x = (p.lHipX - p.lKnee - p.lean) * (p.footFree ? 0 : 1);
    this.rLeg.ankle.rotation.x = (p.rHipX - p.rKnee - p.lean) * (p.footFree ? 0 : 1);
  }

  // idle life: breathing + blink. returns blink amount
  life(f, p) {
    const b = Math.sin(f / 30 * 2.1 + this.seed) * 0.012;
    p.spine += b; p.headX -= b * 0.6;
    p.lShZ += Math.abs(b) * 0.5; p.rShZ += Math.abs(b) * 0.5;
    const per = 95 + Math.floor(hash(this.seed) * 50);
    const ph = (f + this.seed * 37) % per;
    return ph < 4 ? 1 : 0;
  }
  // convenience: place, pose, face in one go
  set(x, y, z, ry, p, face, f = 0) {
    this.root.visible = true;
    this.root.position.set(x, y, z); this.root.rotation.set(0, ry, 0);
    const q = { ...p };
    const blink = face && face.noLife ? 0 : this.life(f, q);
    this.apply(q);
    this.setFace({ blink, ...(face || {}) });
    this.stars.visible = false; this.sweat.visible = false;
    this.legsOn(true);
    return this;
  }
  legsOn(v) { this.lLeg.hip.visible = v; this.rLeg.hip.visible = v; this.pelvis.visible = v; }
  dizzy(f, on = true) {
    this.stars.visible = on;
    this.stars.children.forEach((s, i) => { const a = f / 30 * 5 + i * Math.PI / 2; s.position.set(Math.cos(a) * 0.22, Math.sin(a * 2) * 0.02, Math.sin(a) * 0.22); s.rotation.y = a * 2; });
  }
  sweatDrop(f, t0 = 0) { this.sweat.visible = true; const k = ((f - t0) % 40) / 40; this.sweat.position.y = 0.26 - k * 0.12; this.sweat.scale.setScalar(1); this.sweat.scale.set(0.8, 1.3, 0.6); }
  hand(side) { return side === 'l' ? this.lArm.hand : this.rArm.hand; }
  worldOf(obj, v = new THREE.Vector3()) { obj.updateWorldMatrix(true, false); return v.setFromMatrixPosition(obj.matrixWorld); }
}
