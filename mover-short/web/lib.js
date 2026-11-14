import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = t => t * t * (3 - 2 * t);
export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeIn = t => t * t * t;
export const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const easeOutElastic = t => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1);
export const bounceOut = t => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
// deterministic hash noise
export const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const rnd = (i, k = 0) => hash(i * 17.17 + k * 3.31 + 0.5);

const matCache = new Map();
export function mat(color, o = {}) {
  const { unique, ...rest } = o;
  const key = color + JSON.stringify(rest);
  if (!unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.82, metalness: 0, ...rest });
  if (!unique) matCache.set(key, m);
  return m;
}
export function basic(color, o = {}) { return new THREE.MeshBasicMaterial({ color, ...o }); }

export function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
export function box(w, h, d, color, o = {}) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color, o.mat || {}) : color, o);
  if (o.pos) m.position.set(...o.pos);
  if (o.rot) m.rotation.set(...o.rot);
  return m;
}
// box whose origin is at the top-centre (hangs downward) - for limbs
export function limb(w, h, d, color, o = {}) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(0, -h / 2, 0);
  if (o.taper) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { if (p.getY(i) < -h / 2) { p.setX(i, p.getX(i) * o.taper); p.setZ(i, p.getZ(i) * o.taper); } } g.computeVertexNormals(); }
  return mesh(g, typeof color === 'string' ? mat(color) : color);
}
export function cyl(rt, rb, h, seg, color, o = {}) {
  const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof color === 'string' ? mat(color, o.mat || {}) : color, o);
  if (o.pos) m.position.set(...o.pos);
  if (o.rot) m.rotation.set(...o.rot);
  return m;
}
export function grp(...kids) { const g = new THREE.Group(); kids.forEach(k => k && g.add(k)); return g; }
export function at(obj, x, y, z, ry = 0) { obj.position.set(x, y, z); obj.rotation.set(0, ry, 0); return obj; }

export function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...o.repeat); }
  t.needsUpdate = true; t.userData.canvas = c;
  return t;
}
export function plane(w, h, tex, o = {}) {
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: !!o.transparent, side: o.side ?? THREE.DoubleSide, roughness: o.roughness ?? 0.9, alphaTest: o.alphaTest ?? 0 });
  const g = new THREE.PlaneGeometry(w, h);
  if (o.anchorLeft) g.translate(w / 2, 0, 0);
  const p = mesh(g, m, { cast: o.cast ?? false, receive: o.receive ?? false });
  return p;
}
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function starShape(r1 = 1, r2 = 0.45, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath(); return s;
}
// camera keyframe helper: keys = [[frame, [px,py,pz], [lx,ly,lz], fov?], ...]
export function camKeys(keys, f, ease = easeInOut) {
  if (f <= keys[0][0]) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const [fa, pa, la, va = 40] = keys[i], [fb, pb, lb, vb = 40] = keys[i + 1];
    if (f <= fb) { const t = ease(seg(f, fa, fb)); return [f, pa.map((v, k) => lerp(v, pb[k], t)), la.map((v, k) => lerp(v, lb[k], t)), lerp(va, vb, t)]; }
  }
  return keys[keys.length - 1];
}
