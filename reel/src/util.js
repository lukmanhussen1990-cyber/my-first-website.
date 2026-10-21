import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Tileable value noise on an integer period.
export function vnoise(x, y, period, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const p = period;
  const m = (a) => ((a % p) + p) % p;
  const a = hash2(m(xi), m(yi), seed), b = hash2(m(xi + 1), m(yi), seed);
  const c = hash2(m(xi), m(yi + 1), seed), d = hash2(m(xi + 1), m(yi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, y, period, oct = 5, seed = 0) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x * f, y * f, period * f, seed + i * 17);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return s / norm;
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Fill an image by a per-pixel function returning [r,g,b] in 0..255
export function pixels(w, h, fn) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const col = fn(x, y);
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = col.length > 3 ? col[3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Height (Float32Array w*h, 0..1) -> normal map canvas
export function normalFromHeight(hgt, w, h, strength = 2.0) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const at = (x, y) => hgt[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function tex(c, { srgb = true, repeat = [1, 1], aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
export const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Shadow helpers
export function shadowAll(obj, cast = true, receive = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

// Merge static descendant meshes of `root` by material (keeps draw calls low in software WebGL).
// `skip(mesh)` returns true for meshes that must stay separate (animated, etc.).
export function mergeStatic(root, skip = () => false) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  const victims = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.geometry.isInstancedBufferGeometry || o === root) return;
    if (!o.visible || skip(o)) return;
    let anc = o.parent, bad = false;
    while (anc && anc !== root) { if (anc.userData.noMerge) bad = true; anc = anc.parent; }
    if (bad) return;
    const key = o.material.uuid + '|' + o.castShadow + '|' + o.receiveShadow + '|' + o.renderOrder;
    let g = o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (o.material.vertexColors && !g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    if (!o.material.vertexColors && g.attributes.color) g.deleteAttribute('color');
    if (!g.index) { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); }
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, ro: o.renderOrder, geos: [] });
    groups.get(key).geos.push(g);
    victims.push(o);
  });
  let made = 0;
  for (const { mat, cast, recv, ro, geos } of groups.values()) {
    if (geos.length < 2) { continue; }
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat); m.castShadow = cast; m.receiveShadow = recv; m.renderOrder = ro;
    root.add(m); made++;
    // remove originals of this group
    for (const v of victims) if (v.material === mat && v.castShadow === cast && v.receiveShadow === recv && v.renderOrder === ro) v.userData.__merged = true;
  }
  for (const v of victims) if (v.userData.__merged) v.parent.remove(v);
  return made;
}

// Tiny meshes don't need to cast shadows or feed the AO pass.
export function trimTiny(root, r = 0.045) {
  const s = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.getWorldScale(s);
    if (o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z) < r) { o.castShadow = false; o.userData.noAO = true; }
  });
}
