// Animated props: shower curtain (cling / hug / push / tape / sag / fall), tape strips, rings, spray, steam, burrito, snacks.
import { THREE, PI, clamp, lerp, ease, easeOut, V, RNG, M, mesh, box, cyl, ico, canvasTex, P, heartGeo, softSprite } from './toon.js';

const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const CHROME = M(0xe6ecf1, { std: true, metal: 0.3, r: 0.3 });
export const TAPE_M = M(0xc4c8ce, { std: true, metal: 0.25, r: 0.45 });

// ---------------------------------------------------------------- curtain
export class Curtain {
  constructor(bath) {
    this.B = bath; this.NU = 34; this.NV = 24;
    this.geo = new THREE.PlaneGeometry(1, 1, this.NU, this.NV);
    this.mat = new THREE.MeshStandardMaterial({ color: 0x5a5f67, roughness: 0.55, metalness: 0.0, flatShading: true, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(this.geo, this.mat); this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    bath.group.add(this.mesh);
    this.rings = [];
    for (let k = 0; k < 12; k++) { const r = mesh(new THREE.TorusGeometry(0.034, 0.0065, 6, 14), CHROME, bath.group); r.rotation.y = PI / 2; this.rings.push(r); }
    // tiny curtain face
    this.face = new THREE.Group(); bath.group.add(this.face); this.faceKey = '';
    this.st = this.defaults();
    this._p = V(0, 0, 0); this._a = V(0, 0, 0); this._b = V(0, 0, 0);
  }
  defaults() {
    return { T: 0, open: 0, folds: 1, cling: 0, cx: 0, cy: 1.0, crx: 0.32, cry: 0.42, cz: -0.5, hug: 0, hx: 0, hz: -0.64, hr: 0.3, htop: 1.75,
      push: 0, taped: 0, sag: 0, aL: 0, aR: 0, dropL: 0, dropR: 0, slide: 0, wet: 0, ringFly: [], face: null, faceU: 0.5, faceV: 0.2, faceSide: 'out', faceScale: 1, billow: 1, len: 1.86 };
  }
  railPoint(x, out) {
    const B = this.B, s = this.st, mid = -0.015;
    if (x < mid) { const d = x - B.railXL; out.set(B.railXL + d * Math.cos(s.aL), B.railY - s.dropL + d * Math.sin(s.aL), B.railZ + s.slide); }
    else { const d = B.railXR - x; out.set(B.railXR - d * Math.cos(s.aR), B.railY - s.dropR - d * Math.sin(s.aR), B.railZ + s.slide); }
    return out;
  }
  // surface point for (u across, v down), in bath-local coordinates
  point(u, v, out) {
    const s = this.st, B = this.B, T = s.T;
    const xl = B.railXL + 0.03, xr = B.railXR - 0.03;
    let x = xl + (lerp(xl, xr, u) - xl) * (1 - 0.8 * s.open);
    this.railPoint(x, out);
    const top = out.y;
    let y = top - 0.04 - v * s.len, z = out.z;
    x = out.x;
    // folds + idle billow
    const fa = (0.032 + 0.07 * s.open) * s.folds * (1 - 0.85 * s.taped) * (1 - 0.6 * s.hug);
    z += fa * Math.sin(u * PI * 2 * 9.5) + 0.012 * Math.sin(u * PI * 2 * 3 + 1.3) * v;
    z += s.billow * (0.02 * Math.sin(T * 1.4 + v * 2.2 + u * 3) * v) * (1 - s.taped);
    // cling: bulge inward against his back
    if (s.cling > 0) {
      const g = Math.exp(-(((x - s.cx) / s.crx) ** 2) - (((y - s.cy) / s.cry) ** 2));
      z = lerp(z, s.cz, clamp(s.cling * g * 1.15));
    }
    // push: billow outward (+z)
    if (s.push) {
      const k = Math.pow(Math.sin(PI * u), 0.8) * Math.pow(v, 1.25);
      z += s.push * 0.95 * k; y += s.push * 0.3 * v * v * Math.sin(PI * u);
    }
    // taped flat + sag (water weight)
    if (s.taped) z = lerp(z, B.railZ - 0.035, 0.8 * s.taped);
    if (s.sag) {
      const k = Math.sin(PI * u);
      z += s.sag * 0.4 * k * Math.pow(Math.sin(PI * Math.min(1, v * 1.08)), 1.4);
      y -= s.sag * 0.2 * k * v;
    }
    // hug: wrap around a vertical cylinder (him)
    if (s.hug > 0) {
      const wv = sstep(s.htop + 0.28, s.htop - 0.22, y);
      if (wv > 0) {
        const sx = x - s.hx; const lim = PI * 0.93;
        const r = s.hr * lerp(1, 0.78, clamp((1.0 - y) / 0.8));
        let ph = sx / r, extra = 0;
        if (Math.abs(ph) > lim) { extra = (Math.abs(ph) - lim) * 0.02; ph = Math.sign(ph) * lim; }
        const tx = s.hx + (r + extra) * Math.sin(ph), tz = s.hz + (r + extra) * Math.cos(ph);
        const k = clamp(s.hug * wv);
        x = lerp(x, tx, k); z = lerp(z, tz, k);
      }
    }
    return out.set(x, y, z);
  }
  normal(u, v, out) {
    const e = 0.02, a = this._a, b = this._b, p = this._p;
    this.point(Math.min(1, u + e), v, a); this.point(Math.max(0, u - e), v, p); a.sub(p);
    this.point(u, Math.min(1, v + e), b); this.point(u, Math.max(0, v - e), p); b.sub(p);
    return out.crossVectors(b, a).normalize();
  }
  update(T) {
    const s = this.st; s.T = T;
    const pos = this.geo.attributes.position, p = this._p;
    for (let iy = 0; iy <= this.NV; iy++) for (let ix = 0; ix <= this.NU; ix++) {
      this.point(ix / this.NU, iy / this.NV, p);
      pos.setXYZ(iy * (this.NU + 1) + ix, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    this.mat.roughness = lerp(0.55, 0.28, s.wet); this.mat.color.setHex(s.wet > 0.5 ? 0x50555d : 0x5a5f67);
    // rings follow the top edge, unless they fly off
    for (let k = 0; k < this.rings.length; k++) {
      const r = this.rings[k]; const u = k / (this.rings.length - 1);
      const xl = this.B.railXL + 0.03, xr = this.B.railXR - 0.03;
      const x = xl + (lerp(xl, xr, u) - xl) * (1 - 0.8 * s.open);
      this.railPoint(x, p); r.position.set(p.x, p.y - 0.012, p.z); r.rotation.set(0, PI / 2, 0); r.visible = true;
      const f = s.ringFly.find(q => q.k === k);
      if (f && T > f.t) {
        const dt = T - f.t; r.position.set(p.x + f.vx * dt, p.y - 0.012 + f.vy * dt - 4.9 * dt * dt, p.z + f.vz * dt);
        r.rotation.set(dt * f.spin, PI / 2 + dt * f.spin * 0.7, dt * 3);
        if (r.position.y < 0.15) r.visible = false;
      }
    }
    // face (sits on the outside of the curtain, or the inside when faceSide = 'in')
    this.face.visible = !!s.face;
    if (s.face) {
      if (s.face !== this.faceKey) this.buildFace(s.face);
      const n = this.normal(s.faceU, s.faceV, V(0, 0, 0)); const q = this.point(s.faceU, s.faceV, V(0, 0, 0));
      if (this.viewer) { const wp = q.clone().add(this.B.group.position); if (n.dot(this.viewer.clone().sub(wp)) < 0) n.negate(); }
      else if (s.hug > 0.2) { const out = V(q.x - s.hx, 0, q.z - s.hz); if (n.dot(out) < 0) n.negate(); }
      else if ((s.faceSide === 'in') === (n.z > 0)) n.negate();
      this.face.position.copy(q).addScaledVector(n, 0.014);
      this.face.lookAt(q.clone().add(n).add(this.B.group.position).addScaledVector(n, 0.014));
      this.face.scale.setScalar(s.faceScale || 1);
    }
  }
  buildFace(kind) {
    this.faceKey = kind; const F = this.face;
    while (F.children.length) F.remove(F.children[0]);
    const ink = M(P.ink, { std: true, r: 0.5 }), w = M(0xffffff, { std: true, r: 0.5 });
    const put = (bw, bh, x, y, mat, rz = 0) => { const b = box(bw, bh, 0.012, mat, F, x, y, 0, false); b.rotation.z = rz; return b; };
    if (kind === 'angry') {
      for (const s of [1, -1]) { put(0.05, 0.05, 0.06 * s, 0.0, w); put(0.026, 0.034, 0.055 * s, -0.004, ink); put(0.075, 0.016, 0.06 * s, 0.045, ink, -0.5 * s); }
      put(0.07, 0.014, 0, -0.07, ink); put(0.03, 0.014, 0.045, -0.083, ink, 0.6); put(0.03, 0.014, -0.045, -0.083, ink, -0.6);
    } else if (kind === 'love') {
      const hm = M(0xff4f8a, { std: true, r: 0.4 }); const hg = heartGeo();
      for (const s of [1, -1]) { const h = new THREE.Mesh(hg, hm); h.scale.setScalar(0.065); h.position.set(0.06 * s, 0, 0.004); F.add(h); }
      put(0.03, 0.012, 0.035, -0.065, ink, -0.5); put(0.03, 0.012, -0.035, -0.065, ink, 0.5); put(0.04, 0.012, 0, -0.075, ink);
      for (const s of [1, -1]) put(0.04, 0.018, 0.1 * s, -0.04, M(0xff8fa0, { std: true }));
    } else if (kind === 'smug') {
      for (const s of [1, -1]) { put(0.04, 0.012, 0.06 * s, 0.0, ink, 0.12 * s); put(0.06, 0.012, 0.06 * s, 0.035, ink, 0.25 * s); }
      put(0.07, 0.013, 0.01, -0.065, ink, 0.18); for (const s of [1, -1]) put(0.04, 0.018, 0.1 * s, -0.04, M(0xff8fa0, { std: true }));
    }
  }
}

// ---------------------------------------------------------------- tape strips
export class TapeStrips {
  constructor(bath, curtain) {
    this.B = bath; this.C = curtain; this.items = [];
    const tex = canvasTex(64, 16, (x, w, h) => { x.fillStyle = '#c9cdd3'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < w; i += 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 2, h); x.stroke(); } x.fillStyle = '#9da2a9'; x.fillRect(0, 0, 2, h); x.fillRect(w - 2, 0, 2, h); });
    const mat = M(0xffffff, { std: true, r: 0.45, map: tex, metal: 0.2 });
    // [A, B] : 'c' = curtain (u, v) ; 'w' = fixed point (x, y, z)
    const L = -0.935, R = 0.915, Z = -0.3;
    const defs = [
      [['w', L, 1.95, Z], ['w', R, 0.75, Z]], [['w', L, 0.75, Z], ['w', R, 1.95, Z]], [['w', L, 1.4, Z], ['w', R, 1.35, Z]],
      [['c', 0.5, 0.05], ['w', 0.0, 0.62, -0.36]], [['w', L, 1.75, Z], ['w', R, 1.2, Z]], [['w', L, 1.05, Z], ['w', R, 1.65, Z]],
      [['c', 0.2, 0.25], ['w', L, 2.0, -0.55]], [['c', 0.82, 0.25], ['w', R, 2.0, -0.55]], [['c', 0.18, 0.72], ['w', L, 0.95, -0.6]],
      [['c', 0.84, 0.72], ['w', R, 0.95, -0.6]], [['w', -0.6, 2.15, Z], ['w', 0.55, 0.62, -0.34]], [['w', 0.6, 2.15, Z], ['w', -0.55, 0.62, -0.34]],
      [['c', 0.35, 0.45], ['c', 0.65, 0.6]], [['c', 0.65, 0.45], ['c', 0.35, 0.6]],
    ];
    const r = RNG(77);
    for (const [a, b] of defs) {
      const g = new THREE.Group(); bath.group.add(g);
      const m = box(1, 0.055, 0.004, mat, g, 0.5, 0, 0, false); // unit length along +x from the pivot
      this.items.push({ a, b, g, m, ripT: 0, flyV: [r() - 0.5, 1 + r(), -1 - r()], spin: (r() - 0.5) * 8, shown: 0, rip: 0, side: r() < 0.5 ? 'a' : 'b' });
    }
  }
  pt(e, out) { if (e[0] === 'c') { this.C.point(e[1], e[2], out); out.z -= 0.012; } else out.set(e[1], e[2], e[3]); return out; }
  // shown: number of strips visible (fractional = last one growing); rip: per-strip rip progress handled with ripStart/ripGap
  update(T, shown, ripStart = 1e9, ripGap = 0.03) {
    const A = V(0, 0, 0), Bv = V(0, 0, 0), d = V(0, 0, 0);
    this.items.forEach((it, k) => {
      const grow = clamp(shown - k);
      it.g.visible = grow > 0;
      if (!it.g.visible) return;
      this.pt(it.a, A); this.pt(it.b, Bv);
      const tr = T - (ripStart + k * ripGap);
      if (tr > 0) {
        // the curtain-side end tears loose and the strip flops down from the other end, some fly away
        const free = it.side === 'a' ? A : Bv, fixed = it.side === 'a' ? Bv : A;
        const len = A.distanceTo(Bv);
        if (k % 3 === 0) { free.add(V(it.flyV[0] * tr, it.flyV[1] * tr - 4.9 * tr * tr, it.flyV[2] * tr)); fixed.add(V(it.flyV[0] * tr, it.flyV[1] * tr - 4.9 * tr * tr, it.flyV[2] * tr)); }
        else { const ang = Math.min(PI * 0.5, tr * 9) + 0.25 * Math.sin(tr * 25) * Math.exp(-tr * 4);
          free.copy(fixed).add(V(Math.sin(it.spin) * 0.15 * len, -Math.sin(ang) * len, -Math.cos(ang) * len * 0.4)); }
      }
      d.subVectors(Bv, A); const len = d.length() * grow;
      it.g.position.copy(A);
      it.g.quaternion.setFromUnitVectors(V(1, 0, 0), d.normalize());
      it.m.scale.set(Math.max(0.001, len), 1, 1); it.m.position.set(len / 2, 0, 0);
    });
  }
}

// ---------------------------------------------------------------- water spray (instanced streaks)
export class Spray {
  constructor(parent, n = 110) {
    this.n = n;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0045, 0.11, 0.0045), M(0xeaf8ff, { std: true, r: 0.1, opacity: 0.55, emissive: 0xbfe6f7, ei: 0.4 }), n);
    this.mesh.frustumCulled = false; this.mesh.castShadow = false; parent.add(this.mesh);
    const r = RNG(3); this.seed = []; for (let i = 0; i < n; i++) this.seed.push([r(), r(), r(), r()]);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion();
  }
  // origin & main direction in parent space; reach = travel length
  update(T, on, origin, dir, reach = 0.9, spread = 0.28) {
    this.mesh.visible = on > 0;
    if (!on) return;
    const d = dir.clone().normalize(); const side = V(0, 1, 0).cross(d); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize(); const up = d.clone().cross(side).normalize();
    for (let i = 0; i < this.n; i++) {
      const [a, b, c, e] = this.seed[i];
      const ph = (T * 2.2 + a) % 1; const ang = b * PI * 2, rad = Math.sqrt(c) * spread;
      const dd = d.clone().addScaledVector(side, Math.cos(ang) * rad).addScaledVector(up, Math.sin(ang) * rad).normalize();
      const p = origin.clone().addScaledVector(dd, 0.04 + ph * reach * (0.85 + 0.3 * e));
      p.y -= ph * ph * 0.12;
      this.q.setFromUnitVectors(V(0, 1, 0), dd);
      const s = ph > 0.92 || i / this.n > on ? 0 : 1;
      this.m.compose(p, this.q, V(s, s * (0.8 + e * 0.6), s)); this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- steam puffs (sprites)
export class Steam {
  constructor(parent, n = 26) {
    this.tex = softSprite('#ffffff'); this.items = []; const r = RNG(11);
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, opacity: 0 }));
      parent.add(s); this.items.push({ s, a: r(), b: r(), c: r(), d: r() });
    }
  }
  // box: [x0, x1, y0, y1, z0, z1] in parent space
  update(T, amount, bx) {
    for (const it of this.items) {
      const ph = (T * 0.07 + it.a) % 1;
      it.s.visible = amount > 0.01;
      it.s.position.set(lerp(bx[0], bx[1], it.b) + 0.15 * Math.sin(T * 0.5 + it.c * 6), lerp(bx[2], bx[3], ph), lerp(bx[4], bx[5], it.d));
      const sc = 0.55 + it.c * 0.9 + ph * 0.6; it.s.scale.set(sc, sc, 1);
      it.s.material.opacity = amount * 0.55 * Math.sin(PI * ph);
    }
  }
}

// ---------------------------------------------------------------- burst particles (splash, droplets)
export class Burst {
  constructor(parent, n, geo, mat) {
    this.n = n; this.mesh = new THREE.InstancedMesh(geo, mat, n); this.mesh.frustumCulled = false; this.mesh.castShadow = false; parent.add(this.mesh);
    const r = RNG(n * 7 + 1); this.seed = []; for (let i = 0; i < n; i++) this.seed.push([r(), r(), r(), r(), r()]);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler();
  }
  // several emitters: [{o: Vector3, t: age, up, out, size}]
  update(list) {
    let i = 0; const per = Math.floor(this.n / Math.max(1, list.length));
    for (const em of list) {
      for (let k = 0; k < per; k++, i++) {
        const [a, b, c, d, e] = this.seed[i]; const t = em.t - d * (em.stagger || 0);
        const ang = a * PI * 2, sp = (em.out || 1.2) * (0.4 + b * 0.8);
        const p = em.o.clone().add(V(Math.cos(ang) * sp * t, (em.up || 2.5) * (0.6 + c * 0.6) * t - 4.9 * t * t, Math.sin(ang) * sp * t));
        const alive = t > 0 && t < (em.life || 0.9) && p.y > (em.floor ?? -5);
        const s = alive ? (em.size || 1) * (0.6 + e * 0.8) * (1 - 0.5 * t / (em.life || 0.9)) : 0;
        this.e.set(t * 6 * a, t * 5 * b, 0); this.q.setFromEuler(this.e);
        this.m.compose(p, this.q, V(s, s, s)); this.mesh.setMatrixAt(i, this.m);
      }
    }
    for (; i < this.n; i++) { this.m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this.m); }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = list.length > 0;
  }
}

// ---------------------------------------------------------------- the human burrito
export class Burrito {
  // local axis +x (feet at -x, head at +x), face up = +y. nested: outer (pos, yaw) > tilt (rot z) > roll (rot x) > body
  constructor(scene, headMan) {
    const o = this.outer = new THREE.Group(); scene.add(o);
    const tilt = this.tilt = new THREE.Group(); o.add(tilt);
    const roll = this.roll = new THREE.Group(); tilt.add(roll);
    const cm = this.mat = M(0x50555d, { std: true, r: 0.3 });
    const body = this.body = new THREE.Group(); roll.add(body);
    const bg = new THREE.CylinderGeometry(0.27, 0.25, 1.5, 16, 12); const pa = bg.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), rr = Math.hypot(x, z); if (rr < 0.01) continue;
      const a = Math.atan2(z, x); const n = 1 + 0.055 * Math.sin(a * 5 + y * 9) + 0.035 * Math.sin(a * 9 - y * 17) + 0.05 * Math.pow(Math.max(0, Math.sin(a * 2 - y * 5.5)), 6);
      pa.setX(i, x * n); pa.setZ(i, z * n); }
    bg.computeVertexNormals();
    const c = mesh(bg, cm, body, -0.05, 0, 0); c.rotation.z = PI / 2; c.scale.set(1, 1, 0.92);
    const capA = ico(0.26, 1, cm, body, 0.66, 0, 0); capA.scale.set(0.42, 1.0, 0.92);
    const capB = ico(0.25, 1, cm, body, -0.8, 0, 0); capB.scale.set(0.35, 0.98, 0.9);
    for (let i = 0; i < 4; i++) { const w = mesh(new THREE.TorusGeometry(0.268, 0.022, 5, 14), cm, body, -0.6 + i * 0.36, 0, 0); w.rotation.set(0.25, PI / 2, 0); w.scale.set(1, 1, 0.94); }
    const flap = box(1.3, 0.02, 0.2, cm, body, -0.1, 0.18, 0.17); flap.rotation.x = 0.75;
    for (const x of [-0.45, 0.1, 0.5]) { const t = mesh(new THREE.TorusGeometry(0.276, 0.03, 4, 16), TAPE_M, body, x, 0, 0); t.rotation.y = PI / 2; t.scale.set(1, 1, 0.93); }
    // bent metal bar sticking out like an antenna
    const bar = this.bar = new THREE.Group(); bar.position.set(0.45, 0.2, -0.12); body.add(bar);
    this.barA = new THREE.Group(); bar.add(this.barA); this.barA.rotation.set(0.0, 0, -0.5);
    const b1 = cyl(0.016, 0.016, 0.8, 8, CHROME, this.barA, 0, 0.4, 0);
    this.barB = new THREE.Group(); this.barB.position.y = 0.8; this.barA.add(this.barB); this.barB.rotation.z = 0.9;
    cyl(0.016, 0.016, 0.6, 8, CHROME, this.barB, 0, 0.3, 0); cyl(0.03, 0.03, 0.03, 8, CHROME, this.barB, 0, 0.6, 0);
    for (let i = 0; i < 3; i++) { const r = mesh(new THREE.TorusGeometry(0.034, 0.0065, 6, 14), CHROME, i < 2 ? this.barA : this.barB, 0.016, i < 2 ? 0.45 + i * 0.2 : 0.35, 0); r.rotation.set(PI / 2 + 0.3, 0, 0.2 * i); }
    // bare feet poking out of the bottom end
    this.feet = [];
    const skinM = M(P.skin, { std: true, r: 0.35 });
    for (const s of [1, -1]) { const f = new THREE.Group(); f.position.set(-0.83, 0.0, 0.075 * s); body.add(f);
      const an = cyl(0.04, 0.036, 0.14, 8, skinM, f, -0.06, 0, 0); an.rotation.z = PI / 2;
      box(0.065, 0.21, 0.088, skinM, f, -0.14, 0.07, 0); this.feet.push(f); }
    // head of YOU (body hidden) sticking out of the top end
    this.head = headMan; const hw = this.headWrap = new THREE.Group(); roll.add(hw);
    hw.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, 1), V(1, 0, 0), V(0, 1, 0)));
    hw.position.set(-0.84, 0, 0); hw.add(headMan.group);
    headMan.group.traverse(o => { if (o.isMesh) { let p = o, inHead = false; while (p) { if (p === headMan.head) { inHead = true; break; } p = p.parent; } if (!inHead) o.visible = false; } });
    this.outer.visible = false; this.outer.scale.setScalar(0.9);
  }
  // facePoint in world space (for anchors)
  set({ pos, yaw = 0, tilt = 0, roll = 0, wobble = 0, feet = 0, T = 0, bar = 0 }) {
    this.outer.visible = true; this.outer.position.copy(pos); this.outer.rotation.set(0, yaw, 0);
    this.tilt.rotation.set(0, 0, tilt); this.roll.rotation.set(roll, 0, 0);
    this.body.scale.set(1 + 0.03 * Math.sin(T * 9) * wobble, 1 - 0.04 * Math.sin(T * 9) * wobble, 1);
    this.feet.forEach((f, i) => { f.rotation.set(0, 0, 0.5 * feet * Math.sin(T * 17 + i * 2.1)); f.rotation.x = 0.35 * feet * Math.sin(T * 13 + i); });
    this.barA.rotation.z = -0.5 + bar * 0.22 * Math.sin(T * 11); this.barB.rotation.z = 0.9 + bar * 0.3 * Math.sin(T * 11 - 0.6);
  }
}

// ---------------------------------------------------------------- plate of snacks + fork with food
export function makePlate(parent) {
  const g = new THREE.Group(); parent.add(g);
  const plate = cyl(0.15, 0.12, 0.025, 14, M(0xffffff, { std: true, r: 0.3 }), g, 0, 0, 0);
  cyl(0.155, 0.155, 0.012, 14, M(0x9ad3e8, { std: true, r: 0.3 }), g, 0, 0.012, 0);
  const snacks = [];
  const r = RNG(41);
  const kinds = [[0xf2c14e, 'chip'], [0xf2c14e, 'chip'], [0xe8a33a, 'chip'], [0x8b4fb3, 'grape'], [0x8b4fb3, 'grape'], [0xd98a4a, 'cookie'], [0xff8f86, 'candy'], [0x9ee0c8, 'candy'], [0xf6e3c0, 'sand'], [0xf2c14e, 'chip'], [0x6a3f2a, 'cookie'], [0xffe48f, 'candy']];
  kinds.forEach(([c, k], i) => {
    let m;
    if (k === 'chip') { m = ico(0.035, 0, M(c, { std: true }), g); m.scale.set(1, 0.3, 1); }
    else if (k === 'grape') m = ico(0.022, 1, M(c, { std: true, r: 0.3 }), g);
    else if (k === 'cookie') m = cyl(0.03, 0.03, 0.012, 8, M(c, { std: true }), g);
    else if (k === 'sand') m = box(0.06, 0.03, 0.06, M(c, { std: true }), g);
    else m = box(0.025, 0.025, 0.025, M(c, { std: true, r: 0.3 }), g);
    const a = r() * PI * 2, d = Math.sqrt(r()) * 0.1;
    m.userData.home = V(Math.cos(a) * d, 0.035 + (i % 3) * 0.012, Math.sin(a) * d);
    m.userData.v = V((r() - 0.5) * 2.4, 1.2 + r() * 2.2, (r() - 0.2) * 2.4); m.userData.spin = V(r() * 9, r() * 9, r() * 9);
    m.position.copy(m.userData.home); snacks.push(m);
  });
  const shards = [];
  for (let i = 0; i < 7; i++) { const s = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 3), M(0xffffff, { std: true, r: 0.3 }), parent); s.visible = false;
    s.userData.v = V(Math.cos(i * 0.9) * (0.8 + r()), 0.6 + r(), Math.sin(i * 0.9) * (0.8 + r())); s.userData.spin = V(r() * 6, r() * 9, r() * 6); shards.push(s); }
  return { g, plate, snacks, shards };
}
export function makeFork(parent) {
  const g = new THREE.Group(); parent.add(g);
  const sm = M(0xd9dee4, { std: true, metal: 0.7, r: 0.3 });
  box(0.012, 0.18, 0.006, sm, g, 0, -0.06, 0);
  box(0.03, 0.01, 0.006, sm, g, 0, 0.035, 0);
  for (let i = 0; i < 4; i++) box(0.005, 0.05, 0.005, sm, g, -0.012 + i * 0.008, 0.065, 0);
  const food = ico(0.03, 1, M(0x8a4a2a, { std: true, r: 0.6 }), g, 0, 0.085, 0.005);
  return { g, food };
}
export function makeNoodle(parent, col) { const n = cyl(0.04, 0.04, 1.3, 8, M(col, { std: true, r: 0.5 }), parent); n.rotation.x = PI / 2; return n; }
export function makeTapeRoll(parent) {
  const g = new THREE.Group(); parent.add(g);
  mesh(new THREE.TorusGeometry(0.055, 0.028, 8, 16), TAPE_M, g);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12, 1, true), M(0xc9a777, { std: true, double: true }), g).rotation.x = PI / 2;
  const tail = box(0.05, 0.12, 0.003, TAPE_M, g, 0.07, -0.05, 0); tail.rotation.z = 0.3;
  return g;
}
export function makeHearts(parent, n = 7) {
  const hg = heartGeo(); const hm = M(0xff6fa5, { std: true, r: 0.35 }), hm2 = M(0xffa6c9, { std: true, r: 0.35 });
  const out = []; for (let i = 0; i < n; i++) { const h = new THREE.Mesh(hg, i % 2 ? hm : hm2); parent.add(h); h.visible = false; out.push(h); }
  return out;
}
