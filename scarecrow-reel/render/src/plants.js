// Procedural plant geometry: tomatoes, corn, lettuce, grass tufts, bushes, trees, flowers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, fbm, lerp, clamp } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Paint a constant vertex color (and optional sway weight) onto a geometry.
export function paint(geo, color, sway = null) {
  const n = geo.attributes.position.count; const c = new THREE.Color(color);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (sway !== null) geo.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(n).fill(sway), 1));
  return geo;
}

// Sway weight from height: 0 at ground, 1 at top.
export function swayByHeight(geo, h, pow = 1) {
  const p = geo.attributes.position; const a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) a[i] = Math.pow(clamp(p.getY(i) / h, 0, 1.4), pow);
  geo.setAttribute('aSway', new THREE.BufferAttribute(a, 1));
  return geo;
}

function strip(geo) { // keep only attributes we merge
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color', 'aSway'].includes(k)) geo.deleteAttribute(k);
  return geo.index ? geo.toNonIndexed() : geo;
}
export function merge(list) { return mergeGeometries(list.map(strip), false); }

// A leaf: strip along +Y from 0..len, cupped across and curled back (along +Z).
export function leafGeo(len, width, { curl = 0.3, cup = 0.3, segs = 6, wseg = 3, frill = 0, tip = 0.8, seed = 1 } = {}) {
  const g = new THREE.PlaneGeometry(1, 1, wseg, segs); const p = g.attributes.position; const r = rng(seed);
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, t = p.getY(i) + 0.5; // u in [-1,1], t in [0,1]
    const prof = Math.pow(Math.sin(Math.PI * clamp(t * 0.92 + 0.04)), tip) * (1 - 0.15 * t);
    const x = u * width * 0.5 * prof;
    let z = curl * len * t * t + cup * width * u * u * prof;
    if (frill) z += Math.sin(t * 23 + u * 3 + seed) * frill * Math.abs(u) * width;
    p.setXYZ(i, x, t * len, z);
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ tomato
export function tomatoPlant(seed) {
  const r = rng(seed); const leaves = [], fruit = [], fruitColors = [], stake = [];
  const H = lerp(0.95, 1.12, r());
  const stem = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.02, H * 0.35, 0.01), V(-0.01, H * 0.7, -0.01), V(0.01, H, 0)]);
  leaves.push(paint(new THREE.TubeGeometry(stem, 12, 0.013, 6), '#4f7d2a'));
  const stk = new THREE.CylinderGeometry(0.012, 0.014, H + 0.2, 6); stk.translate(0.05, (H + 0.2) / 2 - 0.05, -0.03); stake.push(stk);
  for (let tie = 0.3; tie < H; tie += 0.35) { const tg = new THREE.TorusGeometry(0.035, 0.004, 4, 10); tg.rotateX(Math.PI / 2); tg.translate(0.025, tie, -0.015); stake.push(tg); }
  const nb = 13;
  for (let b = 0; b < nb; b++) {
    const y0 = lerp(0.18, H * 0.95, b / (nb - 1)) + r() * 0.04; const ang = b * 2.4 + r() * 0.6;
    const len = lerp(0.36, 0.2, b / nb) + r() * 0.08; const dir = V(Math.cos(ang), 0.45 + r() * 0.3, Math.sin(ang)).normalize();
    const pts = [V(0, y0, 0)]; for (let k = 1; k <= 3; k++) { const q = pts[0].clone().addScaledVector(dir, len * k / 3); q.y -= 0.06 * (k / 3) ** 2; pts.push(q); }
    const curve = new THREE.CatmullRomCurve3(pts);
    leaves.push(paint(new THREE.TubeGeometry(curve, 6, 0.006, 4), '#56852e'));
    const nl = 8;
    for (let l = 0; l < nl; l++) {
      const t = 0.2 + 0.75 * l / (nl - 1); const at = curve.getPoint(t); const tan = curve.getTangent(t);
      for (const side of (l === nl - 1 ? [0] : [-1, 1])) {
        const sz = lerp(0.095, 0.065, t) * (0.8 + r() * 0.4);
        const lf = leafGeo(sz, sz * 0.62, { curl: 0.35, cup: 0.25, segs: 4, wseg: 2, frill: 0.06, seed: seed * 31 + b * 7 + l });
        const m = new THREE.Matrix4();
        const fwd = side === 0 ? tan.clone() : tan.clone().cross(V(0, 1, 0)).normalize().multiplyScalar(side).addScaledVector(tan, 0.5).normalize();
        fwd.y -= 0.25 + r() * 0.25; fwd.normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), fwd);
        q.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), r() * 0.8 - 0.4));
        m.compose(at, q, V(1, 1, 1)); lf.applyMatrix4(m);
        const g = 0.82 + r() * 0.3; paint(lf, new THREE.Color(0.24 * g, 0.48 * g, 0.16 * g));
        leaves.push(lf);
      }
    }
    // fruit cluster on some branches
    if (b > 0 && b < nb - 1 && r() < 0.8) {
      const at = curve.getPoint(0.35);
      const nf = 2 + Math.floor(r() * 3);
      for (let f = 0; f < nf; f++) {
        const rad = lerp(0.032, 0.046, r());
        const pos = at.clone().add(V((r() - 0.5) * 0.08, -0.05 - r() * 0.07, (r() - 0.5) * 0.08));
        fruit.push({ pos, rad, ripe: r() });
      }
    }
  }
  const leafGeoAll = swayByHeight(merge(leaves), H, 1.2);
  const stakeGeo = merge(stake);
  return { leaves: leafGeoAll, stake: stakeGeo, fruit, height: H };
}

export function tomatoFruitGeo() {
  const g = new THREE.SphereGeometry(1, 18, 12); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { // slightly lobed, squashed
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x);
    const lobe = 1 + 0.045 * Math.cos(a * 5) * (1 - Math.abs(y)); p.setXYZ(i, x * lobe, y * 0.86 - (y > 0.8 ? 0.06 : 0), z * lobe);
  }
  g.computeVertexNormals();
  return g;
}
export function calyxGeo() {
  const parts = [];
  for (let k = 0; k < 5; k++) { const l = leafGeo(0.035, 0.012, { curl: -0.2, cup: 0.1, segs: 2, wseg: 1 }); l.rotateX(Math.PI / 2 - 0.3); l.rotateY(k * Math.PI * 2 / 5); parts.push(l); }
  const st = new THREE.CylinderGeometry(0.003, 0.004, 0.02, 4); st.translate(0, 0.01, 0); parts.push(st);
  return merge(parts);
}

// ------------------------------------------------------------------ corn
export function cornPlant(seed) {
  const r = rng(seed); const parts = []; const H = lerp(1.85, 2.2, r());
  const lean = V((r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.08);
  const stalk = new THREE.CatmullRomCurve3([V(0, 0, 0), V(lean.x * 0.3, H * 0.4, lean.z * 0.3), V(lean.x, H * 0.85, lean.z), V(lean.x * 1.2, H, lean.z * 1.2)]);
  const tube = new THREE.TubeGeometry(stalk, 16, 0.02, 7);
  { const p = tube.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / H; const s = lerp(1.15, 0.45, y); const cx = lean.x * y, cz = lean.z * y; p.setX(i, cx + (p.getX(i) - cx) * s); p.setZ(i, cz + (p.getZ(i) - cz) * s); } tube.computeVertexNormals(); }
  parts.push(paint(tube, '#7d9a3a'));
  const nl = 11;
  for (let l = 0; l < nl; l++) {
    const t = 0.12 + 0.8 * l / nl; const at = stalk.getPoint(t); const len = lerp(0.85, 0.45, t) * (0.85 + r() * 0.3);
    const lf = leafGeo(len, 0.075, { curl: 0.9 + r() * 0.5, cup: 0.15, segs: 10, wseg: 2, tip: 0.55, frill: 0.02, seed: seed + l });
    lf.rotateX(-0.35 - r() * 0.25);
    lf.rotateY(l * Math.PI * 0.95 + r() * 0.5);
    lf.translate(at.x, at.y, at.z);
    const g = 0.95 + r() * 0.25; const yel = t * 0.12;
    paint(lf, new THREE.Color((0.42 + yel) * g, 0.64 * g, 0.2 * g)); parts.push(lf);
  }
  // tassel
  const top = stalk.getPoint(1);
  for (let k = 0; k < 9; k++) {
    const a = k * 0.7 + r(); const L = 0.18 + r() * 0.12;
    const c = new THREE.CatmullRomCurve3([top, top.clone().add(V(Math.cos(a) * L * 0.4, L * 0.7, Math.sin(a) * L * 0.4)), top.clone().add(V(Math.cos(a) * L * 0.9, L * 0.6, Math.sin(a) * L * 0.9))]);
    parts.push(paint(new THREE.TubeGeometry(c, 5, 0.004, 3), '#c9a95a'));
  }
  // cobs
  const cobs = 1 + (r() < 0.6 ? 1 : 0);
  for (let k = 0; k < cobs; k++) {
    const t = 0.45 + k * 0.12; const at = stalk.getPoint(t); const a = r() * 6.28;
    const husk = new THREE.SphereGeometry(1, 10, 8); husk.scale(0.04, 0.13, 0.04);
    husk.translate(0, 0.12, 0); husk.rotateZ(0.5); husk.rotateY(a); husk.translate(at.x, at.y, at.z);
    parts.push(paint(husk, '#8fae4a'));
    const silk = new THREE.ConeGeometry(0.022, 0.07, 6); silk.translate(0, 0.27, 0); silk.rotateZ(0.5); silk.rotateY(a); silk.translate(at.x, at.y, at.z);
    parts.push(paint(silk, '#a7743a'));
  }
  return { geo: swayByHeight(merge(parts), H, 1.5), height: H };
}

// ------------------------------------------------------------------ lettuce
export function lettuce(seed, red = false) {
  const r = rng(seed); const parts = [];
  const n = 16;
  for (let k = 0; k < n; k++) {
    const t = k / n; // outer -> inner
    const len = lerp(0.2, 0.08, t) * (0.85 + r() * 0.3); const wid = len * lerp(1.0, 0.85, t);
    const lf = leafGeo(len, wid, { curl: lerp(0.5, -0.15, t), cup: lerp(0.35, 0.6, t), segs: 6, wseg: 4, frill: 0.09, tip: 0.5, seed: seed * 13 + k });
    lf.rotateX(-lerp(1.15, 0.25, t) + r() * 0.15);
    lf.rotateY(k * 2.39996 + r() * 0.3);
    lf.translate(0, 0.01 + t * 0.03, 0);
    // color: lighter at base and inner leaves, red edges for red variety
    const p = lf.attributes.position; const col = new Float32Array(p.count * 3); const uv = lf.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const along = uv.getY(i), across = Math.abs(uv.getX(i) - 0.5) * 2;
      let c = new THREE.Color().setRGB(lerp(0.42, 0.62, t), lerp(0.66, 0.85, t), lerp(0.22, 0.35, t));
      c.lerp(new THREE.Color(0.85, 0.92, 0.55), (1 - along) * 0.35);
      if (red) c.lerp(new THREE.Color(0.45, 0.08, 0.18), clamp(along * 1.2 * (0.4 + across * 0.8) - t * 0.5));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    lf.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(lf);
  }
  return swayByHeight(merge(parts), 0.25, 1.0);
}

// ------------------------------------------------------------------ grass tuft
export function grassTuft(seed, blades = 7, h = 0.16) {
  const r = rng(seed); const parts = [];
  for (let b = 0; b < blades; b++) {
    const L = h * (0.6 + r() * 0.7), W = 0.011 + r() * 0.006;
    const g = new THREE.PlaneGeometry(1, 1, 1, 4); const p = g.attributes.position;
    const bend = 0.25 + r() * 0.5;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), t = p.getY(i) + 0.5;
      p.setXYZ(i, u * W * (1 - t * 0.85), t * L, bend * L * t * t);
    }
    g.rotateY(r() * Math.PI * 2);
    g.translate((r() - 0.5) * 0.05, 0, (r() - 0.5) * 0.05);
    const col = new Float32Array(p.count * 3);
    const tipC = new THREE.Color().setHSL(0.25 + r() * 0.06, 0.62, 0.3 + r() * 0.1);
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / L; const c = new THREE.Color(0.035, 0.07, 0.02).lerp(tipC, Math.pow(t, 0.7));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    // bias normals upward so blades shade softly like a lawn
    const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) { const v = V(nn.getX(i), nn.getY(i) + 1.2, nn.getZ(i)).normalize(); nn.setXYZ(i, v.x, v.y, v.z); }
    parts.push(g);
  }
  return swayByHeight(merge(parts), h, 1.0);
}

// ------------------------------------------------------------------ blobs (bushes, canopy)
export function blob(radius, seed, { detail = 4, amp = 0.22, freq = 1.6, squash = 0.85 } = {}) {
  const g = new THREE.IcosahedronGeometry(radius, detail); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = V(p.getX(i), p.getY(i), p.getZ(i)); const n = v.clone().normalize();
    const k = fbm(n.x * freq + 5, n.y * freq + n.z * freq * 0.7 + 3, 4, seed) - 0.5;
    const k2 = fbm(n.x * freq * 3 + 1, n.z * freq * 3 + n.y * 2, 2, seed + 9) - 0.5;
    v.multiplyScalar(1 + k * amp * 2 + k2 * amp * 0.6); v.y *= squash; p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  // spherical uv from direction
  const uv = g.attributes.uv; for (let i = 0; i < p.count; i++) { const n = V(p.getX(i), p.getY(i), p.getZ(i)).normalize(); uv.setXY(i, Math.atan2(n.z, n.x) / (Math.PI * 2) * 3, n.y * 1.5); }
  return g;
}

// Leaf cards scattered over a blob surface (breaks up the silhouette).
export function leafShell(radius, count, seed, { size = 0.09, squash = 0.85, color = [0.25, 0.45, 0.15], spread = 0.35 } = {}) {
  const r = rng(seed); const parts = [];
  const base = leafGeo(1, 0.6, { curl: 0.25, cup: 0.3, segs: 3, wseg: 2 });
  for (let k = 0; k < count; k++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2; const s = Math.sqrt(1 - u * u);
    const n = V(s * Math.cos(a), u, s * Math.sin(a)); if (n.y < -0.4) continue;
    const pos = n.clone().multiplyScalar(radius * (0.92 + r() * 0.15)); pos.y *= squash;
    const lf = base.clone(); const sz = size * (0.7 + r() * 0.6); lf.scale(sz, sz, sz);
    const dir = n.clone().add(V((r() - 0.5) * spread, r() * 0.3, (r() - 0.5) * spread)).normalize();
    lf.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir));
    lf.translate(pos.x, pos.y, pos.z);
    const g = 0.75 + r() * 0.5; paint(lf, new THREE.Color(color[0] * g, color[1] * g, color[2] * g));
    parts.push(lf);
  }
  return merge(parts);
}

// ------------------------------------------------------------------ flowers
export function marigold(seed) {
  const r = rng(seed); const parts = [];
  const stem = new THREE.CylinderGeometry(0.004, 0.005, 0.16, 4); stem.translate(0, 0.08, 0); parts.push(paint(stem, '#4f7a2a'));
  for (let k = 0; k < 4; k++) { const l = leafGeo(0.06, 0.025, { curl: 0.3, segs: 3, wseg: 1 }); l.rotateX(-1.0); l.rotateY(k * 1.6 + r()); l.translate(0, 0.04 + k * 0.02, 0); parts.push(paint(l, '#4c7f2c')); }
  const head = blob(0.03, seed, { detail: 2, amp: 0.25, freq: 6, squash: 0.7 }); head.translate(0, 0.17, 0);
  parts.push(paint(head, r() < 0.5 ? '#f08a12' : '#f5b51c'));
  return swayByHeight(merge(parts), 0.18, 1.0);
}
