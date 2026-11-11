import * as THREE from './three.module.js';
import { rng } from './util.js';

let SEED = 1;
const cache = new Map();
export function mat(color, o = {}) {
  const key = String(color) + JSON.stringify(o);
  if (!o.unique && cache.has(key)) return cache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), flatShading: o.flat !== false, roughness: o.rough ?? 0.85,
    metalness: o.metal ?? 0, emissive: new THREE.Color(o.emissive ?? 0x000000),
    emissiveIntensity: o.ei ?? 1, transparent: !!o.transparent, opacity: o.opacity ?? 1,
    vertexColors: o.vc !== false, side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true,
  });
  if (o.map) { m.map = o.map; }
  if (o.emissiveMap) { m.emissiveMap = o.emissiveMap; }
  if (!o.unique) cache.set(key, m);
  return m;
}
export function basic(color, o = {}) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: !!o.transparent, opacity: o.opacity ?? 1,
    blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: o.depthWrite ?? !o.transparent,
    side: o.side ?? THREE.FrontSide, map: o.map ?? null, toneMapped: o.toneMapped ?? true });
}
// per-facet shade jitter (gem-like low poly). pair=true shades quads uniformly.
export function facet(geo, amt = 0.06, seed = null, pair = false) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  const r = rng(seed ?? SEED++);
  let k = 1;
  for (let i = 0; i < n; i += 3) {
    if (!pair || (i / 3) % 2 === 0) k = 1 + (r() * 2 - 1) * amt;
    for (let j = 0; j < 3; j++) { const q = (i + j) * 3; col[q] = col[q + 1] = col[q + 2] = k; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
export function mesh(geo, color, o = {}) {
  const m = new THREE.Mesh(facet(geo, o.jit ?? 0.05, o.seed ?? null, o.pair ?? false), o.material ?? mat(color, o));
  m.castShadow = o.cast ?? true; m.receiveShadow = o.recv ?? true;
  return m;
}
export const box = (w, h, d, color, o = {}) => mesh(new THREE.BoxGeometry(w, h, d), color, { pair: true, jit: 0.035, ...o });
export const cyl = (rt, rb, h, seg, color, o = {}) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, o.open ?? false), color, o);
export const ico = (r, det, color, o = {}) => mesh(new THREE.IcosahedronGeometry(r, det), color, o);
export const cone = (r, h, seg, color, o = {}) => mesh(new THREE.ConeGeometry(r, h, seg), color, o);
export function taperBox(wBot, wTop, h, dBot, dTop, color, o = {}) {
  const g = new THREE.BoxGeometry(1, h, 1, 1, 2, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i); const u = (y + h / 2) / h;
    p.setX(i, p.getX(i) * (wBot + (wTop - wBot) * u));
    p.setZ(i, p.getZ(i) * (dBot + (dTop - dBot) * u));
  }
  g.translate(0, h / 2, 0);
  return mesh(g, color, { pair: true, jit: 0.03, ...o });
}
export function at(obj, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  obj.position.set(x, y, z); obj.rotation.set(rx, ry, rz); return obj;
}
export function group(...ch) { const g = new THREE.Group(); ch.forEach(c => c && g.add(c)); return g; }
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData.canvas = c; t.userData.ctx = x;
  return t;
}
export function tube(points, r, color, o = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, o.seg ?? 24, r, o.radial ?? 5, false);
  return mesh(g, color, { jit: 0.04, ...o });
}
export function setTube(m, points, r, o = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new THREE.Vector3(...p)));
  const g = facet(new THREE.TubeGeometry(curve, o.seg ?? 24, r, o.radial ?? 5, false), 0.04, 77);
  m.geometry.dispose(); m.geometry = g;
}
export function heartShape(s = 1) {
  const sh = new THREE.Shape();
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const a = 2 * Math.PI * i / 24;
    const x = 16 * Math.pow(Math.sin(a), 3);
    const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
    pts.push(new THREE.Vector2(x * s / 16, y * s / 16));
  }
  sh.setFromPoints(pts);
  return sh;
}
export function heartMesh(s, color, o = {}) {
  const g = new THREE.ExtrudeGeometry(heartShape(s), { depth: s * 0.35, bevelEnabled: true, bevelThickness: s * 0.12, bevelSize: s * 0.1, bevelSegments: 1, curveSegments: 2 });
  g.center();
  return mesh(g, color, { jit: 0.08, emissive: color, ei: 0.25, ...o });
}
let _glowTex = null;
export function glowTex() {
  if (_glowTex) return _glowTex;
  _glowTex = canvasTex(128, 128, (x, w, h) => {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  return _glowTex;
}
export function glowSprite(color, size, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(color), transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
}
