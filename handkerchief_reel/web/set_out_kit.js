// Shared kit for the outdoor places (set_out_paris / _wedding / _porch): sky dome with low-poly clouds (follows
// the camera), key + fill lights, ground planes, round trees, trimmed bushes, hedges, grass tufts, flowers.
// Everything is deterministic (seeded); animation is a pure function of t.
import * as THREE from 'three';
import { mat, tex, clamp, smooth, rng } from './lib.js';
import { mergeGeos, faceColors, hash2, vnoise, fbm, instancedCells, TriBuilder } from './set_util.js';
import { glowDiscCanvas } from './set_tex2.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const C = (h) => new THREE.Color(h);
export const TAU = Math.PI * 2;

export function msh(geo, material, name, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; m.name = name; return m;
}
export function boxAt(g, w, h, d, material, x, y, z, name, o = {}) { const m = msh(new THREE.BoxGeometry(w, h, d), material, name, o); m.position.set(x, y, z); g.add(m); return m; }
// geometry helpers (return geometry translated into place, for merging)
export function boxG(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d); if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')));
  g.translate(x, y, z); return g.toNonIndexed();
}
export function cylG(rt, rb, h, seg, x, y, z, o = {}) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open); if (o.rx || o.ry || o.rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')));
  g.translate(x, y, z); return g.toNonIndexed();
}
// merge a list of geometries into one mesh
export function merged(list, material, name, o) { return msh(mergeGeos(list), material, name, o); }
// stretch a geometry so a mesh lies between points a and b (unit cylinder/box along +Y, origin at the bottom)
export function between(geo, a, b) {
  const d = b.clone().sub(a), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize());
  const g = geo.clone(); g.scale(1, len, 1); g.applyQuaternion(q); g.translate(a.x, a.y, a.z); return g;
}

// box-mapped UVs (per face, from world position): consistent texel density on blobs / hedges without sphere poles
export function boxUV(geo, s = 1, o = [0, 0]) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  const a = V(), b = V(), c = V(), n = V(), e1 = V(), e2 = V();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const q = k === 0 ? a : k === 1 ? b : c;
      let u, v;
      if (ay >= ax && ay >= az) { u = q.x; v = q.z; } else if (ax >= az) { u = q.z; v = q.y; } else { u = q.x; v = q.y; }
      uv[(i + k) * 2] = u / s + o[0]; uv[(i + k) * 2 + 1] = v / s + o[1];
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
// jitter vertex positions by a hashed amount (keeps shared vertices together: hash of the rounded position)
export function jitter(geo, amt, seed = 0, yk = 1) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), q = (v) => Math.round(v * 500);
    const h1 = hash2(q(x) + q(z) * 7, q(y), seed) - 0.5, h2 = hash2(q(y) + q(x) * 3, q(z), seed + 1) - 0.5, h3 = hash2(q(z) + q(y) * 5, q(x), seed + 2) - 0.5;
    p.setXYZ(i, x + h1 * amt, y + h2 * amt * yk, z + h3 * amt);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- sky dome + clouds (child of the place group)
// opts: zenith, mid, horizon (= fog colour for a seamless horizon), below, glow, sunDir (unit, toward the sun),
// hzBand (rad), midStart, midBand, glowPow, glowAmt, horizonSun (horizon colour toward the sun), sunDisc {color, size}
export function buildSky(name, o) {
  const root = new THREE.Group(); root.name = `set.${name}.sky`;
  const g = new THREE.SphereGeometry(360, 48, 32);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const zen = C(o.zenith), mid = C(o.mid), hz = C(o.horizon), below = C(o.below || o.horizon), glow = C(o.glow || '#fff4dc');
  const hzSun = o.horizonSun ? C(o.horizonSun) : null, midSun = o.midSun ? C(o.midSun) : null;
  const S = o.sunDir.clone().normalize(), sunH = V(S.x, 0, S.z).normalize(), d = V(), dh = V();
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const el = Math.asin(clamp(d.y, -1, 1));
    dh.set(d.x, 0, d.z); const az = dh.lengthSq() > 1e-6 ? (dh.normalize().dot(sunH) + 1) / 2 : 0.5;
    const h = hz.clone(); if (hzSun) h.lerp(hzSun, Math.pow(az, o.sunAzPow ?? 2.5));
    const m = mid.clone(); if (midSun) m.lerp(midSun, Math.pow(az, o.sunAzPow ?? 2.5) * 0.8);
    const c = h.lerp(m, smooth(clamp(el / (o.hzBand ?? 0.2))));
    c.lerp(zen, smooth(clamp((el - (o.midStart ?? 0.12)) / (o.midBand ?? 0.95))));
    c.lerp(glow, clamp(Math.pow(Math.max(0, d.dot(S)), o.glowPow ?? 6) * (o.glowAmt ?? 0.6)));
    if (el < 0) c.lerp(below, smooth(clamp(-el / 0.05)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dome = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  dome.name = `set.${name}.skyDome`; dome.renderOrder = -10; dome.userData.noAudit = true; dome.frustumCulled = false;
  root.add(dome);
  if (o.sunDisc) {
    const gt = tex(glowDiscCanvas(64), { nearest: false });
    for (const [k, sc] of [[1, o.sunDisc.size], [0.32, o.sunDisc.size * 0.3]]) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: C(k < 1 ? '#fffaf0' : o.sunDisc.color), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      sp.scale.set(sc, sc, 1); sp.position.copy(S).multiplyScalar(330); sp.name = `set.${name}.sun`; sp.userData.noAudit = true; sp.renderOrder = -9; root.add(sp);
    }
  }
  const clouds = [];
  if (o.clouds) {
    const cm = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false });
    for (const c of o.clouds) {
      const [az, el] = c.at, dist = c.dist || 300;
      const dir = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      const geo = cloudGeo(c.seed, { w: c.w, h: c.h, d: c.d, n: c.n, rotY: az, sun: S, top: c.top || o.cloudTop, shade: c.shade || o.cloudShade, rim: c.rim || o.cloudRim, flat: c.flat });
      const m = new THREE.Mesh(geo, cm); m.position.copy(dir).multiplyScalar(dist); m.name = `set.${name}.cloud`; m.userData.noAudit = true; m.renderOrder = -8;
      root.add(m); clouds.push(m);
    }
  }
  return { root, dome, clouds, update(camera) { root.position.copy(camera.position); } };
}

// low-poly cumulus: a row of squashed icosahedrons, flat bottom, per-face colours (lit top, shaded belly)
export function cloudGeo(seed, o = {}) {
  const R = rng(seed), w = o.w || 50, h = o.h || 14, dd = o.d || 16, n = o.n || 7, geos = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), mid = 1 - Math.abs(t - 0.5) * 1.3;
    const r = h * (0.38 + R() * 0.22) * (0.55 + 0.45 * mid) * (o.flat ? 0.75 : 1);
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(r * (1.25 + R() * 0.5), r * (o.flat ? 0.7 : 1), r * (0.85 + R() * 0.3));
    g.translate((t - 0.5) * w * 0.82 + (R() - 0.5) * w * 0.08, r * (0.25 + R() * 0.25) + mid * h * 0.12, (R() - 0.5) * dd * 0.35);
    geos.push(g.toNonIndexed());
  }
  const g = mergeGeos(geos);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) * 0.15);
  g.rotateY(o.rotY || 0);
  const top = C(o.top || '#ffffff'), shade = C(o.shade || '#b4c4dc'), rim = o.rim ? C(o.rim) : null;
  const S = o.sun || V(0, 1, 0);
  return faceColors(g, (cx, cy, cz, nx, ny, nz, fi) => {
    const ndl = nx * S.x + ny * S.y + nz * S.z;
    let k = clamp(0.42 + ndl * 0.32 + ny * 0.32 + (cy / h) * 0.25);
    if (ny < -0.55) k *= 0.55;
    const c = shade.clone().lerp(top, k);
    if (rim) c.lerp(rim, clamp(ndl) * 0.55 * clamp(1 - ny));
    const j = 0.97 + hash2(fi, seed, 3) * 0.06;
    return [c.r * j, c.g * j, c.b * j];
  });
}

// ---------------------------------------------------------------- lights
export function keyLight(name, color, intensity, dir) {
  const key = new THREE.DirectionalLight(C(color), intensity); key.name = `set.${name}.key`;
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025;
  key.userData.dir = dir.clone().normalize();
  return key;
}

// ---------------------------------------------------------------- ground: subdivided plane, vertex-colour patches
export function groundPlane(name, material, { x0, x1, z0, z1, seg = 48, y = 0, tint = null }) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, seg, seg); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const c = tint ? tint(p.getX(i), p.getZ(i)) : [1, 1, 1];
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    uv.setXY(i, p.getX(i), -p.getZ(i));                                 // world metres (texture.repeat = 1 / tile size)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = msh(g, material, name, { cast: false });
  return m;
}
// a flat strip/patch slightly above the ground (paths, plazas); UV in metres
export function patch(name, material, x0, x1, z0, z1, y = 0.012, o = {}) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, o.seg || 1, o.seg || 1); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i));
  if (o.tint) { const col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const c = o.tint(p.getX(i), p.getZ(i)); col.set(c, i * 3); } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  return msh(g, material, name, { cast: false });
}
export const patchTint = (seed, amt = 0.12, sc = 0.12) => (x, z) => { const k = 1 + (fbm(x * sc, z * sc, seed, 3) - 0.5) * 2 * amt; return [k, k, k]; };

// ---------------------------------------------------------------- vegetation geometry (shapes at real size)
// round deciduous tree: trunk (+2 branches) and a crown of squashed blobs. Returns { trunk, crown } geometries.
export function roundTreeGeos(seed, o = {}) {
  const R = rng(seed);
  const th = o.trunkH ?? 2.2, tr = o.trunkR ?? 0.18, cr = o.crownR ?? 1.8, n = o.blobs ?? 6, sq = o.squash ?? 0.85;
  const cy = th + cr * 0.62;
  // trunk with a slight lean + two branches into the crown
  const tg = [];
  const t0 = new THREE.CylinderGeometry(tr * 0.7, tr, th + cr * 0.4, 7, 2); t0.translate(0, (th + cr * 0.4) / 2, 0);
  tg.push(jitter(t0, tr * 0.25, seed).toNonIndexed());
  for (let k = 0; k < 2; k++) {
    const a = R() * TAU, b = new THREE.CylinderGeometry(tr * 0.25, tr * 0.45, cr * 0.9, 5, 1); b.translate(0, cr * 0.45, 0);
    b.rotateZ(0.7 + R() * 0.3); b.rotateY(a); b.translate(0, th * 0.85 + k * cr * 0.2, 0); tg.push(b.toNonIndexed());
  }
  const trunk = boxUV(mergeGeos(tg), 0.5);
  trunk.computeVertexNormals();
  // crown
  const cg = [];
  for (let i = 0; i < n; i++) {
    const main = i === 0, a = (i / n) * TAU + R() * 0.8;
    const r = main ? cr * 0.78 : cr * (0.46 + R() * 0.16);
    const d = main ? 0 : cr * (0.42 + R() * 0.16);
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.translate(Math.cos(a) * d, (main ? 0 : (R() - 0.35) * cr * 0.55) * sq, Math.sin(a) * d);
    cg.push(g);
  }
  if (o.top !== false) { const g = new THREE.IcosahedronGeometry(cr * 0.5, 1); g.translate((R() - 0.5) * cr * 0.3, cr * 0.48 * sq, (R() - 0.5) * cr * 0.3); cg.push(g); }
  let crown = mergeGeos(cg.map((g) => jitter(g.toNonIndexed(), cr * 0.09, seed + 5)));
  crown.scale(1, sq, 1); crown.translate(0, cy, 0);
  crown = boxUV(crown, o.leafTile ?? 0.9);
  crown = faceColors(crown, (x, y, z, nx, ny, nz, fi) => {
    const hk = clamp((y - (cy - cr * 0.8)) / (cr * 1.6));
    let k = (0.55 + 0.5 * hk) * (0.88 + hash2(fi, seed, 7) * 0.24);
    if (ny < -0.4) k *= 0.62;
    return [k, k, k * (o.blueShade ? 1.05 : 1)];
  });
  return { trunk, crown, height: cy + cr * sq, crownY: cy, crownR: cr };
}

// trimmed topiary ball (or dome when squash < 1): smooth-ish low-poly sphere sunk into the ground, AO colours
export function ballBushGeo(seed, r = 0.5, o = {}) {
  let g = new THREE.IcosahedronGeometry(1, o.detail ?? 2).toNonIndexed();
  jitter(g, o.rough ?? 0.06, seed);
  g.scale(r, r * (o.squash ?? 0.92), r);
  g.translate(0, r * (o.squash ?? 0.92) * (o.lift ?? 0.82), 0);
  g = boxUV(g, o.tile ?? 0.45);
  const H = r * (o.squash ?? 0.92) * ((o.lift ?? 0.82) + 1);
  return faceColors(g, (x, y, z, nx, ny, nz, fi) => {
    let k = (0.6 + 0.45 * clamp(y / H)) * (0.9 + hash2(fi, seed, 9) * 0.2);
    if (ny < -0.3) k *= 0.6;
    return [k, k, k];
  });
}
// hedge block with rounded/jittered surface; origin at the bottom centre, length along X
export function hedgeGeo(seed, len, h, w, o = {}) {
  const sx = Math.max(2, Math.round(len / 0.45)), sy = Math.max(2, Math.round(h / 0.45)), sz = Math.max(2, Math.round(w / 0.45));
  let g = new THREE.BoxGeometry(len, h, w, sx, sy, sz);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {                                    // round the top edges
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ty = (y / (h / 2)), ez = Math.abs(z) / (w / 2), ex = Math.abs(x) / (len / 2);
    if (ty > 0.2) { const k = (ty - 0.2) / 0.8; z *= 1 - 0.22 * k * k; if (o.roundEnds !== false) x *= 1 - 0.04 * k * k * ex; }
    if (ty > 0.99 && ez > 0.7) y -= h * 0.06;
    p.setXYZ(i, x, y + h / 2, z);
  }
  g = jitter(g.toNonIndexed(), o.rough ?? 0.07, seed);
  g = boxUV(g, o.tile ?? 0.5);
  return faceColors(g, (x, y, z, nx, ny, nz, fi) => {
    let k = (0.62 + 0.42 * clamp(y / h)) * (0.9 + hash2(fi, seed, 11) * 0.2);
    if (ny < -0.3) k *= 0.55;
    return [k, k, k];
  });
}

// grass tuft: single-triangle blades, vertex colours dark root -> light tip (double-sided material)
export function grassTuftGeo(seed, o = {}) {
  const R = rng(seed), tb = new TriBuilder(), n = o.blades ?? 7;
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, d = R() * (o.spread ?? 0.06), cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    const ba = R() * TAU, w = 0.012 + R() * 0.01, hgt = (o.h ?? 0.14) * (0.6 + R() * 0.8), lean = 0.02 + R() * 0.07;
    const px = -Math.sin(ba) * w, pz = Math.cos(ba) * w;
    const tip = [cx + Math.cos(a) * lean, hgt, cz + Math.sin(a) * lean];
    const base = o.base || [0.42, 0.62, 0.26], top = o.top || [0.95 + R() * 0.1, 1.0, 0.6 + R() * 0.2];
    tb.tri([cx - px, -0.01, cz - pz], [cx + px, -0.01, cz + pz], tip, [0, 0], [1, 0], [0.5, 1], base, base, top);
  }
  const g = tb.build(); g.computeVertexNormals();
  // blades point up: give them an upward normal so they light like the lawn
  const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0);
  return g;
}
// little flower: stem + 5 petals + centre (vertex colours baked)
export function flowerGeo(petal, centre = [1, 0.82, 0.25], o = {}) {
  const tb = new TriBuilder(), h = o.h ?? 0.16, r = o.r ?? 0.03, stem = [0.32, 0.55, 0.22];
  tb.tri([-0.005, 0, 0], [0.005, 0, 0], [0, h, 0], [0, 0], [1, 0], [0.5, 1], stem);
  tb.tri([0, 0, -0.005], [0, 0, 0.005], [0, h, 0], [0, 0], [1, 0], [0.5, 1], stem);
  const N = o.petals ?? 5;
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * TAU, a1 = ((k + 0.5) / N) * TAU, a2 = ((k + 1) / N) * TAU;
    const P = (a, rr, dy = 0) => [Math.cos(a) * rr, h + dy, Math.sin(a) * rr];
    tb.tri(P(0, 0), P(a1, r, -0.004), P(a0, r * 0.35), [0, 0], [1, 0], [0.5, 1], petal);
    tb.tri(P(0, 0), P(a2, r * 0.35), P(a1, r, -0.004), [0, 0], [1, 0], [0.5, 1], petal);
  }
  const cr = r * 0.35;
  tb.tri([0, h + 0.004, cr], [cr * 0.87, h + 0.004, -cr * 0.5], [-cr * 0.87, h + 0.004, -cr * 0.5], [0, 0], [1, 0], [0.5, 1], centre);
  const g = tb.build(); const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0);
  return g;
}
// a flower clump: leafy mound + several flower heads on top (vertex colours baked)
export function flowerClumpGeo(seed, petal, o = {}) {
  const R = rng(seed), geos = [], r = o.r ?? 0.22, h = o.h ?? 0.26;
  const leaf = new THREE.IcosahedronGeometry(1, 1).toNonIndexed(); jitter(leaf, 0.15, seed); leaf.scale(r, h * 0.7, r); leaf.translate(0, h * 0.35, 0);
  geos.push(faceColors(leaf, (x, y, z, nx, ny, nz, fi) => { const k = (0.55 + 0.5 * clamp(y / h)) * (0.85 + hash2(fi, seed, 3) * 0.3); return [0.3 * k, 0.55 * k, 0.22 * k]; }));
  const n = o.n ?? 7;
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, d = R() * r * 0.75;
    const f = new THREE.IcosahedronGeometry(o.fr ?? 0.045, 0).toNonIndexed(); f.scale(1, 0.7, 1);
    f.translate(Math.cos(a) * d, h * (0.62 + R() * 0.32) + (1 - d / r) * h * 0.1, Math.sin(a) * d);
    const pc = Array.isArray(petal[0]) ? petal[i % petal.length] : petal, j = 0.9 + R() * 0.2;
    geos.push(faceColors(f, (x, y, z, nx, ny) => { const k = (ny > 0.3 ? 1.05 : 0.8) * j; return [pc[0] * k, pc[1] * k, pc[2] * k]; }));
  }
  return mergeGeos(geos);
}

// instanced helper: items [{x,y,z,ry,s|sx,sy,sz,col}] -> InstancedMesh list (frustum culled per cell)
export function inst(name, geo, material, items, o = {}) { return instancedCells(name, geo, material, items, { cell: o.cell ?? 16, cast: o.cast ?? true, receive: o.receive ?? true }); }

// standard materials
export const leafMat = (canvas, o = {}) => { const m = mat(tex(canvas), { rough: 0.92, ...o }); m.vertexColors = true; return m; };
export const vcMat = (color = '#ffffff', o = {}) => { const m = mat(color, { rough: 0.9, ...o }); m.vertexColors = true; return m; };
// "rgb 0..255 hex" -> [r,g,b] 0..1 linear-ish multipliers for vertex colours
export const vc = (hex) => { const c = C(hex); return [c.r, c.g, c.b]; };
export { vnoise, fbm, hash2 };
