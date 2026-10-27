// LARRY: short and round, fluffy curly orange hair, freckles, gap-tooth grin, yellow T-shirt,
// brown shorts, white socks pulled up high, brown sandals, always a bag of chips.
// Costume: a plain white bedsheet with two uneven eye holes, stopping at his shins.
import * as THREE from 'three';
import { Character } from '../engine/toon/rig.js';
import { clay, cloth, PAL } from '../engine/toon/materials.js';
import { sphere, roundedBox, limb, blob, torus, capsule, weldSeamNormals } from '../engine/toon/geom.js';
import { Face, applyFace } from '../engine/toon/face.js';
import { mulberry32, clamp, smooth, lerp } from '../engine/toon/anim.js';

export const LARRY_SPEC = {
  name: 'larry', seed: 7,
  skin: '#f6c8a8', skinShade: '#e8ad8c',
  headR: 0.27, neck: 0.015,
  hipH: 0.34, hipX: 0.09,
  shoulderY: 0.33, shoulderX: 0.19,
  torso: [
    // yellow T-shirt: round belly, pear shaped
    { name: 'shirt', color: PAL.larryShirt, profile: [[0.0, -0.035], [0.205, -0.035], [0.236, 0.04], [0.247, 0.14], [0.226, 0.25], [0.17, 0.33], [0.1, 0.37], [0.0, 0.385]], sz: 0.92 },
    // brown shorts (the T-shirt hangs over the waistband)
    { name: 'shorts', color: PAL.larryShorts, attach: 'hips', profile: [[0.0, -0.1], [0.16, -0.1], [0.198, -0.05], [0.21, 0.0], [0.2, 0.02], [0.0, 0.02]], sz: 0.92 },
  ],
  arm: { upper: 0.15, lower: 0.14, r0: 0.056, r1: 0.05, r2: 0.047, handR: 0.068,
    sleeve: { r0: 0.08, r1: 0.072, len: 0.085, color: PAL.larryShirt } },
  leg: { upper: 0.15, lower: 0.15, r0: 0.078, r1: 0.066, r2: 0.06,
    upperMat: clay(PAL.larryShorts),
    sock: { r0: 0.064, r1: 0.064, len: 0.12, color: PAL.sock },
    shoe: (ch, foot, side) => sandal(ch, foot, side) },
  faceStyle: {
    eyeX: 0.35, eyeY: 0.13, eyeRX: 0.17, eyeRY: 0.205, pupilR: 0.088,
    mouthY: -0.43, mouthW: 0.3, gapTooth: true, browColor: '#c4561a', browY: 0.42,
    blush: 'rgba(255,110,120,0.6)', blushX: 0.55, blushY: -0.2,
    freckles: [[-0.17, -0.12, 0.018], [-0.25, -0.07, 0.016], [-0.31, -0.15, 0.017], [-0.22, -0.2, 0.014],
      [0.17, -0.12, 0.018], [0.25, -0.07, 0.016], [0.31, -0.15, 0.017], [0.22, -0.2, 0.014], [-0.06, 0.05, 0.012], [0.07, 0.04, 0.012]],
  },
  noseR: 0.15, noseY: -0.12, noseColor: '#f2b08f',
  hair: (ch, skull) => curlyHair(ch, skull),
};

function sandal(ch, foot, side) {
  const sole = clay(PAL.sandal), strap = clay('#8f5a30');
  // white sock covers the foot
  ch.mesh(sphere(0.07, 20, 14), clay(PAL.sock), foot, [0, -0.012, 0.035], [0, 0, 0], [0.82, 0.62, 1.35]);
  ch.mesh(roundedBox(0.12, 0.028, 0.21, 0.012), sole, foot, [0, -0.045, 0.04]);
  ch.mesh(torus(0.058, 0.014, 8, 24, Math.PI), strap, foot, [0, -0.028, 0.075], [0, 0, 0], [1, 0.75, 1]);
  ch.mesh(torus(0.058, 0.014, 8, 24, Math.PI), strap, foot, [0, -0.028, 0.0], [0, 0, 0], [1, 0.8, 1]);
}

function curlyHair(ch, skull) {
  const R = LARRY_SPEC.headR;
  const mats = [clay(PAL.larryHair), clay('#ff8a2a'), clay('#e5661a')];
  const rnd = mulberry32(42);
  const N = 260;
  for (let i = 0; i < N; i++) {
    // fibonacci points on the sphere: cover the top, back and sides, keep the face and forehead clear
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    if (y < -0.12) continue;
    if (z > 0.0 && y < 0.6 - 0.45 * Math.abs(x)) continue;   // hairline
    if (z > 0.55 && y < 0.72) continue;
    const s = 0.05 + rnd() * 0.022;
    const d = R * (0.985 + rnd() * 0.05);
    const m = ch.mesh(blob(s, 2, 0.09, 1 + (i % 9)), mats[i % 3], skull, [x * d, y * d + 0.01, z * d]);
    m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
  }
  // a fluffier second layer on top
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, el = 0.45 + rnd() * 0.5;
    const x = Math.cos(a) * Math.cos(el), y = Math.sin(el), z = Math.sin(a) * Math.cos(el);
    if (z > 0.35 && y < 0.8) continue;
    const s = 0.055 + rnd() * 0.02;
    ch.mesh(blob(s, 2, 0.09, 3 + (i % 5)), mats[(i + 1) % 3], skull, [x * R * 1.06, y * R * 1.06 + 0.012, z * R * 1.06]);
  }
  // a few springy curls on top
  for (let k = 0; k < 6; k++) {
    const a = k * 1.05 + 0.3;
    ch.mesh(torus(0.026, 0.011, 8, 18), mats[k % 3], skull, [Math.cos(a) * 0.09, R * 1.1, Math.sin(a) * 0.07 - 0.02], [Math.PI / 2 + 0.4 * Math.sin(a), a, 0]);
  }
}

// ---- chips --------------------------------------------------------------------------------------
export function makeChipsBag() {
  const g = new THREE.Group(); g.name = 'chipsBag';
  const bagMat = clay('#e8392f', { roughness: 0.45 });
  const body = new THREE.Mesh(roundedBox(0.17, 0.22, 0.07, 0.03, 5), bagMat);
  body.scale.set(1, 1, 1); body.castShadow = true; g.add(body);
  // crimped top edge and a yellow label stripe with a cartoon chip
  const crimp = clay('#c62a22', { roughness: 0.45 });
  for (const y of [0.115, -0.115]) {
    const c = new THREE.Mesh(roundedBox(0.175, 0.025, 0.03, 0.008), crimp); c.position.y = y; c.castShadow = true; g.add(c);
  }
  const label = new THREE.Mesh(roundedBox(0.15, 0.08, 0.075, 0.03, 4), clay('#ffd23a', { roughness: 0.5 }));
  g.add(label);
  const chip = makeChip(0.032); chip.position.set(0, 0, 0.04); chip.rotation.set(0.3, 0, 0.4); g.add(chip);
  return g;
}
export function makeChip(r = 0.03) {
  const geo = new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, 0.6);
  geo.scale(1, 0.35, 0.8);
  const m = new THREE.Mesh(geo, clay('#f3c04e', { roughness: 0.6, side: THREE.DoubleSide }));
  m.castShadow = true;
  return m;
}

// ---- the bedsheet costume ---------------------------------------------------------------------
// A cloth mesh rebuilt each frame from a few parameters:
//   drape     0 = flat sheet floating in the air, 1 = draped over Larry
//   sway      hem wave phase, swing  side-to-side lag (secondary motion)
//   wingL/R   how far each side is pulled out by an arm (hands poke out), wingY: height of the pull
//   mouthPush bulge at the mouth (screams, "JOHN!")
//   snag      {dir: [x,y,z] local point, amount} pulls part of the hem toward a point (gate spikes)
export class Sheet extends THREE.Group {
  constructor() {
    super();
    this.name = 'sheet';
    this.H = 1.32;              // top of the sheet (just above the hair)
    this.hem = 0.17;            // hem height: socks and sandals show below
    this.rings = 56; this.segs = 72;
    const geo = new THREE.BufferGeometry();
    const n = (this.rings + 1) * (this.segs + 1);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const idx = [];
    for (let i = 0; i < this.rings; i++) for (let j = 0; j < this.segs; j++) {
      const a = i * (this.segs + 1) + j, b = a + this.segs + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    geo.setIndex(idx);
    this.geo = geo;
    this.face = new Face({ eyeStyle: 'sheet', blush: null, freckles: null, pupilR: 0.07, lineW: 0.03 }, 1024);
    // a touch of self-light keeps the white sheet white in shade (no green lawn bounce, readable at night)
    this.mat = cloth(PAL.sheet, { unique: true, side: THREE.DoubleSide, sheen: 0.35, roughness: 0.9, emissive: '#fff6ee', emissiveIntensity: 0.14 });
    this.faceCenterY = 0.94;     // Larry's head centre
    applyFace(this.mat, this.face, { extent: 0.33, center: [0, this.faceCenterY], glow: 0.0, depth: 0.12 });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.add(this.mesh);
    this.params = { drape: 1, sway: 0, swing: 0, wingL: 0, wingR: 0, wingY: 0.62, mouthPush: 0, flatY: 2.6, flatTilt: 0, snag: null, t: 0, lift: 0 };
    this.update();
  }

  // draped radius profile vs height (y from ground): a smooth spline through hand-placed points
  profile(y) {
    if (!this._lut) {
      const H = this.H;
      const ctrl = [[0.0, H], [0.13, H - 0.018], [0.235, H - 0.065], [0.305, H - 0.15], [0.336, H - 0.27], [0.336, 0.94], [0.322, 0.82], [0.312, 0.72],
        [0.33, 0.62], [0.352, 0.48], [0.368, 0.33], [0.384, 0.18], [0.388, 0.12]];
      const curve = new THREE.SplineCurve(ctrl.map(([r, yy]) => new THREE.Vector2(r, yy)));
      const pts = curve.getSpacedPoints(400);
      this._lut = pts.map((p) => [p.y, Math.max(0, p.x)]).sort((a, b) => a[0] - b[0]);
    }
    const L = this._lut;
    if (y <= L[0][0]) return L[0][1];
    if (y >= L[L.length - 1][0]) return 0;
    let lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m][0] <= y) lo = m; else hi = m; }
    const f = (y - L[lo][0]) / (L[hi][0] - L[lo][0] || 1);
    return lerp(L[lo][1], L[hi][1], f);
  }

  set(p) { Object.assign(this.params, p); this.update(); }

  update() {
    const P = this.params, pos = this.geo.attributes.position.array, uv = this.geo.attributes.uv.array;
    const R = this.rings, S = this.segs, H = this.H;
    // total arc length of the draped profile, from the top centre down to the hem
    const ys = [], arc = [0];
    for (let i = 0; i <= R; i++) {
      const u = i / R;
      // more rings near the top (dome)
      const y = H - (H - this.hem) * (u < 0.3 ? (u / 0.3) * 0.25 : 0.25 + (u - 0.3) / 0.7 * 0.75);
      ys.push(y);
      if (i > 0) { const dy = ys[i - 1] - y, dr = this.profile(y) - this.profile(ys[i - 1]); arc.push(arc[i - 1] + Math.hypot(dy, dr)); }
    }
    const L = arc[R];
    let k = 0, q = 0;
    for (let i = 0; i <= R; i++) {
      const y0 = ys[i], s = arc[i] / L;
      for (let j = 0; j <= S; j++) {
        const th = (j / S) * Math.PI * 2 + Math.PI;      // seam at the back; th = 2*PI is the front
        const sx = Math.sin(th), cz = Math.cos(th);
        // ---- draped position ----
        let r = this.profile(y0);
        const low = clamp((1.0 - y0) / 0.8);             // 0 at shoulders, 1 at hem
        r += low * (0.026 * Math.sin(th * 7 + 0.6) + 0.013 * Math.sin(th * 13 + 2.1) + 0.008 * Math.sin(th * 3 - 1.2));   // folds
        r += 0.012 * Math.exp(-((y0 - 0.66) ** 2) / 0.004) * (0.6 + 0.4 * Math.sin(th * 4));                  // cloth bunching on the shoulders
        let y = y0;
        const hemZone = clamp((0.4 - y0) / 0.23);
        y += hemZone * (0.022 * Math.sin(th * 5 + P.sway) + 0.01 * Math.sin(th * 9 - P.sway * 1.3));
        let x = sx * r, z = cz * r;
        // swing: lower part lags behind motion
        x += P.swing * low * low * 0.12;
        // wings: arms pull the sides out (L = +X side)
        for (const [w, side] of [[P.wingL, 1], [P.wingR, -1]]) {
          if (w <= 0) continue;
          const ang = Math.acos(clamp(side * sx));        // angular distance from that side
          const fall = Math.exp(-(ang * ang) / 0.35);
          const hy = Math.exp(-((y0 - P.wingY) ** 2) / 0.05) * 0.9 + clamp((P.wingY - y0) / 0.5) * 0.35;
          const push = w * fall * hy * 0.32;
          x += side * push; y += w * fall * clamp((P.wingY - y0 + 0.3) / 0.6) * 0.08;
        }
        // mouth push (front, at mouth height)
        if (P.mouthPush > 0) {
          const da = Math.atan2(Math.sin(th), Math.cos(th));
          const d2 = da ** 2 / 0.08 + ((y0 - 0.83) ** 2) / 0.006;
          const b = P.mouthPush * 0.07 * Math.exp(-d2);
          x += sx * b; z += cz * b;
        }
        // snag: pull toward a local point
        if (P.snag && P.snag.amount > 0) {
          const [tx, ty, tz] = P.snag.point;
          const ang = Math.atan2(tx, tz);
          let da = th - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
          const f = Math.exp(-(da * da) / 0.12) * clamp((0.75 - y0) / 0.55);
          x = lerp(x, tx, f * P.snag.amount * 0.85); y = lerp(y, ty, f * P.snag.amount * 0.6); z = lerp(z, tz, f * P.snag.amount * 0.85);
        }
        y += P.lift * low;
        // ---- flat position (floating sheet, centre = top of the dome) ----
        let fx = 0, fy = 0, fz = 0;
        if (P.drape < 1) {
          const rr = s * 1.25;                              // flat radius
          const sq = 1 / Math.pow(Math.max(Math.abs(Math.cos(th)), Math.abs(Math.sin(th))), 0.55);   // squarish corners
          fx = sx * rr * sq; fz = cz * rr * sq;
          fy = P.flatY + Math.sin(rr * 6 - P.t * 9) * 0.05 * rr + Math.sin(fx * 4 + P.t * 5) * 0.04;
          // tilt the flat sheet
          const tz = fz * Math.cos(P.flatTilt) - (fy - P.flatY) * Math.sin(P.flatTilt);
          fy = P.flatY + fz * Math.sin(P.flatTilt) + (fy - P.flatY) * Math.cos(P.flatTilt); fz = tz;
        }
        // centre drapes first, edges last
        const d = P.drape >= 1 ? 1 : smooth(clamp(P.drape * 1.6 - s * 0.6));
        pos[k++] = lerp(fx, x, d); pos[k++] = lerp(fy, y, d); pos[k++] = lerp(fz, z, d);
        uv[q++] = j / S; uv[q++] = 1 - s;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.uv.needsUpdate = true;
    this.geo.computeVertexNormals();
    weldSeamNormals(this.geo, R, S);
    this.geo.computeBoundingSphere();
  }
}

export function makeLarry() {
  const larry = new Character(LARRY_SPEC);
  larry.chips = makeChipsBag();
  larry.chips.position.set(0, -0.12, 0.05);
  larry.chips.rotation.set(0.1, 0, 0.15);
  larry.hand('L').add(larry.chips);
  larry.sheet = new Sheet();
  larry.joints.body.add(larry.sheet);
  larry.sheet.visible = false;
  larry.setSheet = (on) => {
    larry.sheet.visible = on;
    // under the sheet his head and torso are hidden (they would poke through the cloth)
    for (const n of ['skull', 'nose', 'shirt']) if (larry.parts[n]) larry.parts[n].visible = !on;
    larry.joints.skull.visible = !on;
    for (const L of ['L', 'R']) {
      larry.parts['sleeve' + L].visible = !on; larry.parts['upperArm' + L].visible = !on;
    }
  };
  return larry;
}
