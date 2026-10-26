// Set-building kit: low-poly terrain, houses, walls, trees, palms, rocks, grass, props and the
// procedural canvas textures they use (stone, plaster, wood, paving, cloth stripes).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { matte, U } from './materials.js';
import { hash01, mulberry32, clamp, fbm, noise2, lerp, smooth, invLerp } from '../lib/util.js';

// ---------- canvas textures (cached, sRGB) ----------
const cache = {};
export function canvasTex(key, w, h, draw, { repeat = null, srgb = true } = {}) {
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(...repeat);
  t.anisotropy = 4; cache[key] = t; return t;
}
function noiseFill(g, w, h, seed, fn) {
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, gg, b] = fn(x, y);
    const i = (y * w + x) * 4; img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
const tileN = (x, y, w, h, f, seed) => { // tileable fbm by blending 4 offsets
  const u = x / w, v = y / h;
  const a = fbm(x * f, y * f, 4, seed), b = fbm((x - w) * f, y * f, 4, seed), c = fbm(x * f, (y - h) * f, 4, seed), d = fbm((x - w) * f, (y - h) * f, 4, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
};
export function stoneTex() { // light neutral stone (tinted by material colour)
  return canvasTex('stone', 256, 256, (g, w, h) => noiseFill(g, w, h, 1, (x, y) => {
    const n = tileN(x, y, w, h, 0.03, 11), m = tileN(x, y, w, h, 0.12, 13);
    const speck = hash01(x * 977 + y, 5) > 0.985 ? -40 : 0;
    const v = clamp(205 + n * 70 + m * 30 + speck, 0, 255); return [v, v * 0.98, v * 0.95];
  }));
}
export function sandstoneTex() { // layered sandstone: horizontal strata, chisel pits, fine grain
  return canvasTex('sandstone', 512, 512, (g, w, h) => noiseFill(g, w, h, 5, (x, y) => {
    const n = tileN(x, y, w, h, 0.02, 51), m = tileN(x, y, w, h, 0.09, 53), f = tileN(x, y, w, h, 0.35, 57);
    const strata = Math.sin((y + n * 40) * 0.11) * 0.5 + 0.5, band = Math.sin((y + n * 25) * 0.031) * 0.5 + 0.5;
    const pit = hash01(Math.floor(x / 3) * 977 + Math.floor(y / 3), 9) > 0.996 ? -30 : 0;
    const v = clamp(192 + n * 40 + m * 18 + f * 10 + strata * 22 + band * 30 + pit, 0, 255);
    return [v, v * 0.95, v * 0.88];
  }));
}
export function plasterTex() {
  return canvasTex('plaster', 256, 256, (g, w, h) => noiseFill(g, w, h, 2, (x, y) => {
    const n = tileN(x, y, w, h, 0.02, 21), m = tileN(x, y, w, h, 0.09, 23);
    const v = clamp(225 + n * 40 + m * 16, 0, 255); return [v, v * 0.985, v * 0.96];
  }));
}
export function woodTex() {
  return canvasTex('wood', 256, 256, (g, w, h) => noiseFill(g, w, h, 3, (x, y) => {
    const n = tileN(x, y, w, h, 0.05, 31);
    const grain = Math.sin(y * 0.22 + n * 7 + Math.sin(x * 0.02) * 2) * 0.5 + 0.5;
    const v = 150 + grain * 55 + n * 40; return [v, v * 0.92, v * 0.82];
  }));
}
export function paveTex() { // irregular stone paving
  return canvasTex('pave', 512, 512, (g, w, h) => {
    noiseFill(g, w, h, 4, (x, y) => { const n = tileN(x, y, w, h, 0.03, 41); const v = clamp(200 + n * 60, 0, 255); return [v, v * 0.97, v * 0.92]; });
    g.strokeStyle = 'rgba(70,55,40,0.55)'; g.lineWidth = 3;
    const r = mulberry32(44);
    for (let row = 0; row < 8; row++) {
      const y0 = row * 64; let x = -r() * 60;
      g.beginPath(); g.moveTo(0, y0); g.lineTo(w, y0 + (r() - 0.5) * 4); g.stroke();
      while (x < w) { const ww = 50 + r() * 50; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (r() - 0.5) * 8, y0 + 64); g.stroke(); x += ww; }
    }
  }, { repeat: [1, 1] });
}
export function stripeTex(a, b, n = 8) {
  return canvasTex('stripe' + a + b + n, 256, 64, (g, w, h) => {
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * w / n, 0, w / n + 1, h); }
    const img = g.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const k = 0.9 + 0.1 * noise2(x * 0.08, y * 0.08, 9); for (let c = 0; c < 3; c++) img.data[i + c] *= k; }
    g.putImageData(img, 0, 0);
  });
}
export function texMat(hex, map, opts = {}) {
  const m = new THREE.MeshLambertMaterial({ color: hex, map, flatShading: opts.flat ?? true, ...opts.params });
  return m;
}

// ---------- terrain ----------
export function makeTerrain({ size = 400, seg = 160, height = () => 0, color = () => [0.6, 0.5, 0.3], circle = true }) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position; const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i); const y = height(x, z); p.setY(i, y);
    const col = color(x, z, y); c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const flatGeo = geo.toNonIndexed(); flatGeo.computeVertexNormals();
  const m = new THREE.Mesh(flatGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  m.receiveShadow = true;
  return m;
}
export const srgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
export const mixc = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

// ---------- distant mountain ring ----------
export function makeMountains({ seed = 1, n = 14, r0 = 160, r1 = 260, h0 = 18, h1 = 55, color = '#a08a6a', arc = [0, Math.PI * 2] } = {}) {
  const g = new THREE.Group(); const R = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const a = lerp(arc[0], arc[1], (i + R() * 0.6) / n); const r = lerp(r0, r1, R());
    const h = lerp(h0, h1, R()); const w = h * (1.4 + R() * 1.6);
    const geo = new THREE.ConeGeometry(w, h, 5 + Math.floor(R() * 3), 2);
    const pp = geo.attributes.position;
    for (let k = 0; k < pp.count; k++) { const y = pp.getY(k); if (y > -h / 2 + 0.01 && y < h / 2 - 0.01) { pp.setX(k, pp.getX(k) * (0.8 + 0.4 * R())); pp.setZ(k, pp.getZ(k) * (0.8 + 0.4 * R())); pp.setY(k, y + (R() - 0.5) * h * 0.12); } }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, matte(color));
    m.position.set(Math.sin(a) * r, h / 2 - 2, Math.cos(a) * r); m.rotation.y = R() * 6; m.scale.z = 0.7;
    g.add(m);
  }
  return g;
}

// ---------- houses ----------
export function makeHouse({ w = 4, d = 4, h = 3.2, wall = '#d9c39a', roof = 'flat', roofCol = '#b9a07a', door = '#4a3020', windows = 2, glow = 0, seed = 1, stairs = false } = {}) {
  const g = new THREE.Group(); const R = mulberry32(seed);
  const pm = texMat(wall, plasterTex());
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pm); body.position.y = h / 2; body.castShadow = body.receiveShadow = true; g.add(body);
  if (roof === 'flat') {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, 0.22, d + 0.24), matte(roofCol)); slab.position.y = h + 0.11; slab.castShadow = true; g.add(slab);
    const par = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, 0.36, 0.2), pm); par.position.set(0, h + 0.4, (d + 0.04) / 2); par.castShadow = true; g.add(par);
    const par2 = par.clone(); par2.position.z = -(d + 0.04) / 2; g.add(par2);
    // beam ends poking out under the roof
    for (let i = 0; i < Math.floor(w / 0.8); i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), matte('#5a3c24')); b.position.set(-w / 2 + 0.4 + i * 0.8, h - 0.14, d / 2 + 0.1); g.add(b); }
  } else if (roof === 'dome') {
    const dm = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) * 0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), pm); dm.position.y = h; dm.castShadow = true; g.add(dm);
  }
  const dw = Math.min(1.0, w * 0.26), dh = Math.min(1.9, h * 0.6);
  const dx = (R() - 0.5) * w * 0.4;
  const doorM = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), matte(door)); doorM.position.set(dx, dh / 2, d / 2 + 0.012); g.add(doorM);
  const arch = new THREE.Mesh(new THREE.CircleGeometry(dw / 2, 10, 0, Math.PI), matte(door)); arch.position.set(dx, dh, d / 2 + 0.012); g.add(arch);
  const winMat = glow > 0 ? new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0 * glow * 2.2, 0.62 * glow * 2.2, 0.25 * glow * 2.2) }) : matte('#3a2618');
  g.userData.windows = [];
  for (let i = 0; i < windows; i++) {
    const wx = -w / 2 + w * (i + 1) / (windows + 1); if (Math.abs(wx - dx) < dw * 0.8) continue;
    const wn = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.55), winMat); wn.position.set(wx, h * 0.62, d / 2 + 0.012); g.add(wn); g.userData.windows.push(wn);
  }
  if (stairs) { for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.4), pm); s.position.set(w / 2 + 0.3, 0.09 + i * h / 6, d / 2 - 0.3 - i * 0.42); s.scale.y = 1 + i * 0.9; s.position.y = (0.18 * s.scale.y) / 2; s.castShadow = true; g.add(s); } }
  return g;
}

// ---------- walls / blocks ----------
export function makeWall({ len = 8, h = 2, t = 0.5, color = '#b8a888', blocks = true, seed = 3 } = {}) {
  const g = new THREE.Group(); const R = mulberry32(seed);
  const m = texMat(color, stoneTex());
  if (!blocks) { const b = new THREE.Mesh(new THREE.BoxGeometry(len, h, t), m); b.position.y = h / 2; b.castShadow = b.receiveShadow = true; g.add(b); return g; }
  const rows = Math.max(1, Math.round(h / 0.45)); const rh = h / rows; const geos = [];
  for (let r = 0; r < rows; r++) {
    let x = -len / 2 - (r % 2) * 0.35;
    while (x < len / 2) {
      const bw = Math.min(0.6 + R() * 0.6, len / 2 - x); if (bw < 0.12) break;
      const bg = new THREE.BoxGeometry(bw - 0.04, rh - 0.04, t * (0.92 + R() * 0.12));
      bg.translate(Math.max(-len / 2, x) + bw / 2, r * rh + rh / 2, (R() - 0.5) * 0.04);
      geos.push(bg); x += bw;
    }
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), m); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh);
  return g;
}

// ---------- vegetation ----------
export function makePalm(s = 1, seed = 1) {
  const g = new THREE.Group(); const r = mulberry32(seed);
  const lean = (r() - 0.5) * 0.3; let px = 0, py = 0;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1.05 * s, 6), matte(i % 2 ? '#6b4a2c' : '#5e3f25'));
    seg.position.set(px, py + 0.52 * s, 0); seg.rotation.z = lean * (1 + i * 0.15); seg.castShadow = true; g.add(seg);
    px -= Math.sin(lean * (1 + i * 0.15)) * 1.0 * s; py += Math.cos(lean) * 1.0 * s;
  }
  const crown = new THREE.Group(); crown.position.set(px, py, 0); g.add(crown);
  for (let i = 0; i < 9; i++) {
    const lf = new THREE.Mesh(new THREE.ConeGeometry(0.4 * s, 2.5 * s, 3), matte(i % 2 ? '#4f6a2a' : '#5a7530'));
    lf.scale.z = 0.16; lf.geometry.translate(0, 1.25 * s, 0);
    const hold = new THREE.Group(); hold.rotation.y = i / 9 * Math.PI * 2 + r() * 0.3; crown.add(hold);
    lf.rotation.x = 1.85 + r() * 0.35; lf.castShadow = true; hold.add(lf);
  }
  g.userData.crown = crown; g.userData.h = py;
  return g;
}
export function makeTree(s = 1, seed = 1, palette = ['#5d6e2c', '#67772f', '#55652a', '#718034'], trunk = '#5a3a22') {
  const g = new THREE.Group(); const r = mulberry32(seed);
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.24 * s, 2.2 * s, 6), matte(trunk)); tr.position.y = 1.1 * s; tr.rotation.z = (r() - 0.5) * 0.15; tr.castShadow = true; g.add(tr);
  const crown = new THREE.Group(); crown.position.y = 2.4 * s; g.add(crown);
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry((0.8 + r() * 0.7) * s, 1), matte(palette[Math.floor(r() * palette.length)]));
    c.position.set((r() - 0.5) * 1.6 * s, (r() * 0.9) * s, (r() - 0.5) * 1.6 * s); c.scale.y = 0.75 + r() * 0.2;
    c.castShadow = true; c.receiveShadow = true; crown.add(c);
  }
  g.userData.crown = crown;
  return g;
}
export function makeOlive(s = 1, seed = 2) { return makeTree(s, seed, ['#7d8a5a', '#6f7d50', '#8a9666', '#76845a'], '#6a5440'); }
export function makeRock(size = 1, seed = 1, color = '#9a8a74') {
  const geo = new THREE.IcosahedronGeometry(size, 0); const R = mulberry32(seed); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.75 + R() * 0.5), p.getY(i) * (0.55 + R() * 0.4), p.getZ(i) * (0.75 + R() * 0.5));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, matte(color)); m.castShadow = m.receiveShadow = true; m.rotation.y = R() * 6;
  return m;
}
// swaying grass tufts (instanced, wind in the vertex shader)
export function makeGrass(n, area, seed, color = '#949a4a', h = 0.55, height = () => 0, skip = null) {
  const blade = [];
  for (let k = 0; k < 3; k++) { const g = new THREE.ConeGeometry(0.05, h, 3); g.translate(0, h / 2, 0); g.rotateZ((k - 1) * 0.35); g.translate((k - 1) * 0.06, 0, 0); blade.push(g); }
  const geo = mergeGeometries(blade);
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind;
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       vec4 wp0 = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
       float sway = sin(uTime*1.7 + wp0.x*0.35 + wp0.z*0.27) * 0.5 + sin(uTime*3.1 + wp0.x*0.9) * 0.18;
       transformed.x += sway * 0.3 * uWind * max(position.y, 0.0);`);
  };
  mat.customProgramCacheKey = () => 'grass7';
  const im = new THREE.InstancedMesh(geo, mat, n);
  const r = mulberry32(seed); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(); const p = new THREE.Vector3(); const up = new THREE.Vector3(0, 1, 0);
  let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) {
    const x = area[0] + r() * (area[2] - area[0]), z = area[1] + r() * (area[3] - area[1]);
    if (skip && skip(x, z)) continue;
    p.set(x, height(x, z), z); q.setFromAxisAngle(up, r() * 6.28); const sc = 0.55 + r() * 0.7; s.set(sc, sc * (0.7 + r() * 0.6), sc);
    m4.compose(p, q, s); im.setMatrixAt(k++, m4);
    const c = new THREE.Color(color).multiplyScalar(0.8 + r() * 0.4); im.setColorAt(k - 1, c);
  }
  im.count = k; im.receiveShadow = false; im.castShadow = false;
  return im;
}

// ---------- props ----------
export function makeJar(s = 1, color = '#b0683c') {
  const pts = [[0, 0], [0.16, 0.02], [0.24, 0.18], [0.25, 0.32], [0.18, 0.48], [0.1, 0.55], [0.12, 0.62], [0, 0.62]].map(([x, y]) => new THREE.Vector2(x * s, y * s));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 9), matte(color)); m.castShadow = true; return m;
}
export function makeBasket(s = 1, fruit = ['#e0742c'], seed = 1) {
  const g = new THREE.Group(); const R = mulberry32(seed);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * s, 0.24 * s, 0.24 * s, 9, 1, true), matte('#a98450', { params: { side: THREE.DoubleSide } })); b.position.y = 0.12 * s; b.castShadow = true; g.add(b);
  const bt = new THREE.Mesh(new THREE.CircleGeometry(0.24 * s, 9).rotateX(-Math.PI / 2), matte('#8a6a40')); bt.position.y = 0.01; g.add(bt);
  for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075 * s, 0), matte(fruit[i % fruit.length])); const a = R() * 6.28, rr = R() * 0.2 * s; f.position.set(Math.cos(a) * rr, 0.22 * s + R() * 0.06 * s, Math.sin(a) * rr); g.add(f); }
  return g;
}
export function makeStall({ awning = ['#b0442c', '#e8d6b0'], goods = ['#e0742c', '#b8352c', '#7a2a4a', '#d9a640'], seed = 1, w = 2.8 } = {}) {
  const g = new THREE.Group();
  for (const [px, pz] of [[-w / 2 + 0.1, -0.7], [w / 2 - 0.1, -0.7], [-w / 2 + 0.1, 0.75], [w / 2 - 0.1, 0.75]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.45, 0.09), matte('#5a3a22')); p.position.set(px, 1.22, pz); p.castShadow = true; g.add(p); }
  const aw = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.2, 1.9, 1, 1), texMat('#ffffff', stripeTex(awning[0], awning[1], 9), { params: { side: THREE.DoubleSide } }));
  aw.rotation.x = -Math.PI / 2 + 0.2; aw.position.set(0, 2.42, 0.02); aw.castShadow = true; g.add(aw);
  const val = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.2, 0.28), texMat('#ffffff', stripeTex(awning[0], awning[1], 9), { params: { side: THREE.DoubleSide } }));
  val.position.set(0, 2.16, 0.97); g.add(val); g.userData.valance = val;
  const tb = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.82, 1.15), texMat('#9a6a42', woodTex())); tb.position.y = 0.41; tb.castShadow = tb.receiveShadow = true; g.add(tb);
  const R = mulberry32(seed);
  for (let i = 0; i < 4; i++) { const bk = makeBasket(1, [goods[i % goods.length], goods[(i + 1) % goods.length]], seed + i); bk.position.set(-w / 2 + 0.5 + i * (w - 0.9) / 3, 0.82, -0.05 + (R() - 0.5) * 0.2); g.add(bk); }
  return g;
}
export function makeBench(len = 2.0, color = '#8a7a64') {
  const g = new THREE.Group(); const m = texMat(color, stoneTex());
  const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.5), m); top.position.y = 0.42; top.castShadow = top.receiveShadow = true; g.add(top);
  for (const x of [-len / 2 + 0.2, len / 2 - 0.2]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.44), m); l.position.set(x, 0.18, 0); l.castShadow = true; g.add(l); }
  return g;
}
export function makeLog(len = 1.6, r = 0.16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, len, 7), texMat('#a07a52', woodTex())); m.rotation.z = Math.PI / 2; m.castShadow = m.receiveShadow = true;
  const g = new THREE.Group(); m.position.y = r; g.add(m); return g;
}

// =====================================================================================================
// v2 additions (lighting/graphics track) — crafted low-poly: chamfers, per-face colour, gradients,
// instanced set dressing, worn paths, half-buried rocks, mud-brick houses and tents. All seeded.
// =====================================================================================================
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const toColor = (c) => (c && c.isColor ? c : new THREE.Color(c));

// ---------- geometry helpers ----------
// Chamfered box (bevel = chamfer width, m). Convex hull of the 24 chamfer points -> flat-shaded, non-indexed.
export function chamferBoxGeometry(w = 1, h = 1, d = 1, bevel = 0.04) {
  const b = Math.min(bevel, w / 2.2, h / 2.2, d / 2.2), pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push(new THREE.Vector3(sx * w / 2, sy * (h / 2 - b), sz * (d / 2 - b)));
    pts.push(new THREE.Vector3(sx * (w / 2 - b), sy * h / 2, sz * (d / 2 - b)));
    pts.push(new THREE.Vector3(sx * (w / 2 - b), sy * (h / 2 - b), sz * d / 2));
  }
  const g = new ConvexGeometry(pts); g.computeVertexNormals();
  return g;
}
// Low-poly stone from a convex hull of jittered ellipsoid points; flatten = squash of the bottom (sits well).
export function stoneGeometry(size = 0.5, seed = 1, { points = 14, squash = 0.62, flatten = 0.35, irregular = 0.35 } = {}) {
  const R = mulberry32(seed), pts = [];
  for (let i = 0; i < points; i++) {
    const u = R() * 2 - 1, a = R() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    const k = 1 + (R() - 0.5) * irregular * 2;
    let y = u * squash * k; if (y < -flatten * squash) y = -flatten * squash - (y + flatten * squash) * 0.2;
    pts.push(new THREE.Vector3(Math.cos(a) * r * k * size, y * size, Math.sin(a) * r * k * size * (0.8 + 0.3 * R())));
  }
  const g = new ConvexGeometry(pts); g.computeVertexNormals(); return g;
}
// Per-face colour variation: gives a non-indexed geometry a 'color' attribute = base * (1 ± jitter), one value per triangle.
// lum: luminance jitter (0.06 = ±6 %), hue: hue jitter, light: optional fn(normal) -> extra multiplier (e.g. lighter tops)
export function faceColors(geo, base, { lum = 0.07, hue = 0.01, sat = 0.03, seed = 1, top = 0.06 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3), b = toColor(base);
  const R = mulberry32(seed), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  const prev = g.attributes.color;
  for (let f = 0; f < n / 3; f++) {
    A.fromBufferAttribute(p, f * 3); B.fromBufferAttribute(p, f * 3 + 1); C.fromBufferAttribute(p, f * 3 + 2);
    const ny = B.sub(A).cross(C.sub(A)).normalize().y;
    _c1.copy(b); _c1.offsetHSL((R() - 0.5) * 2 * hue, (R() - 0.5) * 2 * sat, 0);
    _c1.multiplyScalar(1 + (R() - 0.5) * 2 * lum + top * ny);
    for (let k = 0; k < 3; k++) {
      const i = f * 3 + k;
      const m = prev ? [prev.getX(i), prev.getY(i), prev.getZ(i)] : [1, 1, 1];
      col[i * 3] = _c1.r * m[0]; col[i * 3 + 1] = _c1.g * m[1]; col[i * 3 + 2] = _c1.b * m[2];
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// Vertex-colour gradient: multiplies (or creates) the colour attribute with fn(x, y, z) -> [r,g,b] | THREE.Color,
// or with a simple vertical ramp: gradientColors(geo, { axis: 'y', from: 0, to: 3, a: '#7a6a55', b: '#ffffff' }).
export function gradientColors(geo, fn) {
  const p = geo.attributes.position, n = p.count;
  const prev = geo.attributes.color; const col = new Float32Array(n * 3);
  let f = fn;
  if (typeof fn !== 'function') {
    const { axis = 'y', from = 0, to = 1, a = '#000000', b = '#ffffff', ease = (x) => x } = fn;
    const ca = toColor(a).clone(), cb = toColor(b).clone(), ai = { x: 0, y: 1, z: 2 }[axis];
    f = (x, y, z) => { const v = [x, y, z][ai]; return _c2.copy(ca).lerp(cb, ease(clamp((v - from) / (to - from)))); };
  }
  for (let i = 0; i < n; i++) {
    const c = f(p.getX(i), p.getY(i), p.getZ(i)); const r = c.isColor ? [c.r, c.g, c.b] : c;
    const m = prev ? [prev.getX(i), prev.getY(i), prev.getZ(i)] : [1, 1, 1];
    col[i * 3] = r[0] * m[0]; col[i * 3 + 1] = r[1] * m[1]; col[i * 3 + 2] = r[2] * m[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
export const vcMat = (opts = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...opts });

// Bevelled box mesh with per-face colour variation (walls, steps, crates, bricks)
export function makeBevelBox(w, h, d, color, { bevel = 0.035, lum = 0.06, seed = 1, grad = null, mat = null } = {}) {
  let g = faceColors(chamferBoxGeometry(w, h, d, bevel), color, { lum, seed });
  if (grad) gradientColors(g, grad);
  const m = new THREE.Mesh(g, mat || vcMat()); m.castShadow = m.receiveShadow = true; return m;
}
// Bevelled low-poly stone. sink 0..1 = fraction buried (half-buried rocks: 0.35–0.5); place it at ground height.
export function makeStone(size = 0.5, { seed = 1, color = '#9b8a72', sink = 0.2, lum = 0.08, squash = 0.62 } = {}) {
  const g = faceColors(stoneGeometry(size, seed, { squash }), color, { lum, seed: seed + 3, top: 0.1 });
  g.translate(0, -sink * size * squash, 0);
  const m = new THREE.Mesh(g, vcMat()); m.castShadow = m.receiveShadow = true; m.rotation.y = hash01(seed, 9) * 6.28; return m;
}
export const makeHalfBuriedRock = (size = 0.8, opts = {}) => makeStone(size, { sink: 0.45, squash: 0.7, ...opts });

// ---------- instanced scatter ----------
// scatter(geometry, material, n, { area:[x0,z0,x1,z1] | ring:[cx,cz,r0,r1] | points:[[x,z],...], height(x,z), skip(x,z),
//   scale:[min,max], squash:[min,max] (y scale factor), tilt (rad), yaw:true, colors:[...hex] or color + jitter, seed, align })
// -> InstancedMesh (count = placed). Uses instanceColor, so the material should have color white (vertexColors ok).
export function scatter(geo, mat, n, o = {}) {
  const { area = [-10, -10, 10, 10], ring = null, points = null, height = () => 0, skip = null, scale = [0.8, 1.2], squash = [1, 1], tilt = 0.08,
    colors = null, color = null, jitter = 0.08, seed = 1, sink = 0, cast = true, receive = true } = o;
  const im = new THREE.InstancedMesh(geo, mat, points ? points.length : n);
  const R = mulberry32(seed), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let k = 0;
  const total = points ? points.length : n;
  for (let i = 0; i < total * 4 && k < total; i++) {
    let x, z;
    if (points) { if (i >= points.length) break; [x, z] = points[i]; }
    else if (ring) { const a = R() * Math.PI * 2, r = Math.sqrt(lerp(ring[2] ** 2, ring[3] ** 2, R())); x = ring[0] + Math.cos(a) * r; z = ring[1] + Math.sin(a) * r; }
    else { x = lerp(area[0], area[2], R()); z = lerp(area[1], area[3], R()); }
    if (skip && skip(x, z)) continue;
    const sc = lerp(scale[0], scale[1], R()), sq = lerp(squash[0], squash[1], R());
    s.set(sc, sc * sq, sc);
    e.set((R() - 0.5) * 2 * tilt, R() * Math.PI * 2, (R() - 0.5) * 2 * tilt); q.setFromEuler(e);
    p.set(x, height(x, z) - sink * sc, z);
    im.setMatrixAt(k, m4.compose(p, q, s));
    if (colors || color) {
      const base = colors ? colors[Math.floor(R() * colors.length)] : color;
      _c1.set(base).multiplyScalar(1 + (R() - 0.5) * 2 * jitter); im.setColorAt(k, _c1);
    }
    k++;
  }
  im.count = k; im.castShadow = cast; im.receiveShadow = receive;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
}
// ready-made props for scatter() (unit size; scatter's `scale` sets the size)
export const PROPS = {
  // grass tuft: 5 bent blades, darker at the root (vertex gradient)
  tuft() {
    const parts = [];
    for (let k = 0; k < 5; k++) {
      const b = new THREE.ConeGeometry(0.035, 0.42 + 0.12 * ((k * 37) % 5) / 5, 3, 2); b.translate(0, 0.22, 0);
      const pp = b.attributes.position; for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); pp.setX(i, pp.getX(i) + y * y * 0.35 * Math.cos(k * 1.3)); pp.setZ(i, pp.getZ(i) + y * y * 0.35 * Math.sin(k * 1.3)); }
      b.rotateY(k * 1.26); b.translate(Math.cos(k * 2.1) * 0.04, 0, Math.sin(k * 2.1) * 0.04); parts.push(b.toNonIndexed());
    }
    const g = mergeGeometries(parts); g.computeVertexNormals();
    return gradientColors(g, { axis: 'y', from: 0, to: 0.5, a: '#5d6236', b: '#ffffff', ease: (x) => Math.sqrt(x) });
  },
  pebble() { return faceColors(stoneGeometry(0.5, 3, { points: 9, squash: 0.5, flatten: 0.2 }), '#ffffff', { lum: 0.12, seed: 4, top: 0.12 }); },
  pot() { // clay jar with rim and per-face shading
    const pts = [[0, 0], [0.16, 0.01], [0.25, 0.14], [0.27, 0.3], [0.21, 0.46], [0.12, 0.54], [0.115, 0.6], [0.15, 0.63], [0.13, 0.65], [0.0, 0.64]].map(([x, y]) => new THREE.Vector2(x, y));
    return faceColors(new THREE.LatheGeometry(pts, 10), '#ffffff', { lum: 0.08, seed: 6, top: 0.08 });
  },
  basket() { // woven basket: open cylinder, banded colour, a rim
    const g = new THREE.CylinderGeometry(0.3, 0.22, 0.26, 10, 3, false).translate(0, 0.13, 0).toNonIndexed();
    gradientColors(g, (x, y, z) => { const b = Math.floor(y / 0.065) % 2 ? 0.86 : 1.0; return [b, b * 0.97, b * 0.92]; });
    return faceColors(g, '#ffffff', { lum: 0.05, seed: 8 });
  },
  firewood() { // a small stack of split logs
    const parts = []; const R = mulberry32(12);
    for (let i = 0; i < 7; i++) {
      const row = i < 4 ? 0 : 1, j = row ? i - 4 : i;
      const c = new THREE.CylinderGeometry(0.06 + R() * 0.015, 0.065, 0.7 + R() * 0.15, 6).rotateZ(Math.PI / 2).rotateY((R() - 0.5) * 0.25);
      c.translate(0, 0.065 + row * 0.11, (j - (row ? 1 : 1.5)) * 0.13); parts.push(c.toNonIndexed());
    }
    const g = mergeGeometries(parts); g.computeVertexNormals();
    return faceColors(g, '#ffffff', { lum: 0.1, seed: 13 });
  },
  sheaf() { // tied grain/reed bundle
    const g = new THREE.CylinderGeometry(0.16, 0.1, 0.8, 7, 2).translate(0, 0.4, 0).toNonIndexed();
    return faceColors(g, '#ffffff', { lum: 0.08, seed: 15 });
  },
};
const _propGeo = {};
export const propGeometry = (name) => _propGeo[name] || (_propGeo[name] = PROPS[name]());
// convenience wrappers (InstancedMesh, white vertex-colour material so instance colours tint the shading)
export const scatterGrass = (n, o = {}) => scatter(propGeometry('tuft'), vcMat(), n, { scale: [0.7, 1.3], squash: [0.7, 1.3], tilt: 0.15, color: '#9a9a52', jitter: 0.14, cast: false, ...o });
export const scatterPebbles = (n, o = {}) => scatter(propGeometry('pebble'), vcMat(), n, { scale: [0.05, 0.16], squash: [0.6, 1], tilt: 0.3, colors: ['#9c8c74', '#8a7a64', '#b0a088', '#7c6e5c'], sink: 0.1, ...o });
export const scatterPots = (n, o = {}) => scatter(propGeometry('pot'), vcMat(), n, { scale: [0.7, 1.15], tilt: 0.03, colors: ['#b0683c', '#9a5a34', '#c47a48', '#a8704a'], ...o });
export const scatterBaskets = (n, o = {}) => scatter(propGeometry('basket'), vcMat(), n, { scale: [0.8, 1.2], tilt: 0.04, colors: ['#b48a52', '#a07a46', '#c49a5e'], ...o });
export const scatterFirewood = (n, o = {}) => scatter(propGeometry('firewood'), vcMat(), n, { scale: [0.8, 1.2], tilt: 0.02, colors: ['#7a5636', '#6a4a2e', '#8a6440'], ...o });

// ---------- worn paths ----------
// Distance-to-polyline weight (0..1) for painting a path into terrain colours/heights: w = pathWeight(pts, width)(x, z)
export function pathWeight(points, width = 1.4, { soft = 0.6, wobble = 0.35, seed = 2 } = {}) {
  return (x, z) => {
    let best = 1e9;
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i], [bx, bz] = points[i + 1], dx = bx - ax, dz = bz - az;
      const u = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1));
      best = Math.min(best, Math.hypot(x - (ax + dx * u), z - (az + dz * u)));
    }
    const w = width * (1 + wobble * noise2(x * 0.3, z * 0.3, seed));
    return 1 - smooth(invLerp(w * 0.5 * (1 - soft), w * 0.5, best));
  };
}
// Ribbon mesh along a polyline that hugs the terrain; vertex colours fade to the ground colour at the edges
// (uses vertex alpha: transparent). Good for packed-earth paths, cart tracks, a lit holy path.
export function makePathRibbon(points, { width = 1.4, height = () => 0, color = '#c9a878', edge = '#c9a878', lift = 0.015, seg = 4, opacity = 0.85, seed = 3 } = {}) {
  const pos = [], col = [], idx = []; const ca = toColor(color), ce = toColor(edge);
  const samples = [];
  for (let i = 0; i < points.length - 1; i++) for (let k = 0; k < seg; k++) { const u = k / seg; samples.push([lerp(points[i][0], points[i + 1][0], u), lerp(points[i][1], points[i + 1][1], u)]); }
  samples.push(points[points.length - 1]);
  const cols = 5;
  samples.forEach(([x, z], i) => {
    const [nx, nz] = samples[Math.min(i + 1, samples.length - 1)], [px, pz] = samples[Math.max(i - 1, 0)];
    let tx = nx - px, tz = nz - pz; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const w = width * (1 + 0.25 * noise2(x * 0.4, z * 0.4, seed));
    for (let j = 0; j < cols; j++) {
      const v = j / (cols - 1) - 0.5, ox = -tz * v * w, oz = tx * v * w;
      const X = x + ox, Z = z + oz; pos.push(X, height(X, Z) + lift, Z);
      const e = Math.abs(v) * 2, a = (1 - smooth(invLerp(0.45, 1, e))) * opacity * (0.85 + 0.15 * noise2(X * 2, Z * 2, seed + 1));
      _c1.copy(ca).lerp(ce, e).multiplyScalar(0.94 + 0.12 * hash01(i * 7 + j, seed)); col.push(_c1.r, _c1.g, _c1.b, a);
    }
  });
  for (let i = 0; i < samples.length - 1; i++) for (let j = 0; j < cols - 1; j++) { const a = i * cols + j, b = a + cols; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true; m.renderOrder = 1; return m;
}

// ---------- footprints ----------
// Instanced sand prints along a polyline (alternating left/right). Returns the InstancedMesh with
// userData.setShown(n) to reveal the first n prints (S3: Enoch's footprints that simply stop).
export function makeFootprints(points, { stride = 0.36, gauge = 0.11, size = 0.12, height = () => 0, color = '#8f6d48', seed = 5, max = 400 } = {}) {
  const prints = []; let carry = 0, side = 1;
  for (let i = 0; i < points.length - 1 && prints.length < max; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1], L = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / L, tz = (bz - az) / L;
    for (let d = carry; d < L && prints.length < max; d += stride) {
      const x = ax + tx * d - tz * gauge * side, z = az + tz * d + tx * gauge * side;
      prints.push({ x, z, yaw: Math.atan2(tx, tz) + (hash01(prints.length, seed) - 0.5) * 0.2, side }); side = -side;
      carry = d + stride - L;
    }
  }
  // one print = heel + forefoot dents (flat discs slightly darker than the sand)
  const heel = new THREE.CircleGeometry(0.32, 9).scale(1, 1.25, 1).translate(0, -0.45, 0), fore = new THREE.CircleGeometry(0.42, 10).scale(1, 1.35, 1).translate(0, 0.35, 0);
  const geo = mergeGeometries([heel, fore]).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const im = new THREE.InstancedMesh(geo, mat, prints.length); im.renderOrder = 2;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(size, 1, size * 1.15), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  prints.forEach((P, i) => { q.setFromAxisAngle(up, P.yaw + Math.PI); p.set(P.x, height(P.x, P.z) + 0.006, P.z); im.setMatrixAt(i, m4.compose(p, q, s)); });
  im.userData.prints = prints; im.userData.setShown = (n) => { im.count = Math.max(0, Math.min(prints.length, Math.floor(n))); };
  im.receiveShadow = true;
  return im;
}

// ---------- mud-brick house ----------
// Bevelled walls with brick courses (vertex colour bands + per-face jitter), a darker plinth, flat roof of
// beams + straw/clay slab + parapet, recessed door with lintel, small windows, optional ladder and roof jars.
// Faces +z. Lit/shade contrast comes from the flat-shaded chamfers (>= 1.4 lit/shade on buildings, per style notes).
export function makeMudHouse({ w = 4, d = 3.6, h = 2.8, color = '#b98c5a', roof = '#9c7a52', door = '#24170e', seed = 1, ladder = true, windows = 2, glow = 0, parapet = 0.32, dome = false } = {}) {
  const g = new THREE.Group(); const R = mulberry32(seed);
  const wallGeo = faceColors(chamferBoxGeometry(w, h, d, 0.08), color, { lum: 0.05, seed, top: 0.04 });
  const base = toColor(color);
  gradientColors(wallGeo, (x, y, z) => {
    const course = Math.floor((y + h / 2) / 0.24), brick = Math.floor((x + z + (course % 2) * 0.22) / 0.44);
    const v = 0.93 + 0.1 * hash01(course * 131 + brick, seed) - (y < -h / 2 + 0.35 ? 0.12 : 0) + 0.06 * ((y + h / 2) / h);
    return [v, v, v * 0.98];
  });
  const walls = new THREE.Mesh(wallGeo, vcMat()); walls.position.y = h / 2; walls.castShadow = walls.receiveShadow = true; g.add(walls);
  if (dome) {
    const dm = new THREE.Mesh(faceColors(new THREE.SphereGeometry(Math.min(w, d) * 0.42, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), color, { lum: 0.06, seed: seed + 2 }), vcMat());
    dm.position.y = h; dm.castShadow = true; g.add(dm);
  } else {
    // beams poking out + roof slab + parapet
    const nb = Math.max(3, Math.round(w / 0.55));
    for (let i = 0; i < nb; i++) { const b = makeBevelBox(0.13, 0.13, d + 0.5, '#5a3c24', { bevel: 0.02, seed: seed + i }); b.position.set(-w / 2 + 0.25 + i * (w - 0.5) / (nb - 1), h - 0.12, 0); g.add(b); }
    const slab = makeBevelBox(w + 0.18, 0.2, d + 0.18, roof, { bevel: 0.05, seed: seed + 3, lum: 0.08 }); slab.position.y = h + 0.06; g.add(slab);
    if (parapet > 0) for (const [px, pz, pw, pd] of [[0, d / 2 + 0.02, w + 0.18, 0.18], [0, -d / 2 - 0.02, w + 0.18, 0.18], [w / 2 + 0.02, 0, 0.18, d + 0.18], [-w / 2 - 0.02, 0, 0.18, d + 0.18]]) {
      const p = makeBevelBox(pw, parapet, pd, color, { bevel: 0.04, seed: seed + 5, lum: 0.06 }); p.position.set(px, h + 0.16 + parapet / 2, pz); g.add(p);
    }
  }
  // door: recessed dark opening + lintel beam + threshold stone
  const dw = Math.min(0.95, w * 0.26), dh = Math.min(1.85, h * 0.68), dx = (R() - 0.5) * w * 0.35;
  const op = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, 0.1), new THREE.MeshLambertMaterial({ color: door })); op.position.set(dx, dh / 2, d / 2 - 0.02); g.add(op);
  const lin = makeBevelBox(dw + 0.34, 0.14, 0.2, '#6a4a2e', { bevel: 0.02, seed: seed + 7 }); lin.position.set(dx, dh + 0.07, d / 2 + 0.04); g.add(lin);
  const thr = makeBevelBox(dw + 0.2, 0.08, 0.32, '#9a8a74', { bevel: 0.02, seed: seed + 8 }); thr.position.set(dx, 0.04, d / 2 + 0.12); g.add(thr);
  g.userData.door = new THREE.Vector3(dx, 0, d / 2 + 0.2);
  // windows (small dark or glowing slots)
  const wm = glow > 0 ? new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2 * glow, 1.3 * glow, 0.5 * glow) }) : new THREE.MeshLambertMaterial({ color: door });
  g.userData.windows = [];
  for (let i = 0; i < windows; i++) {
    const wx = -w / 2 + w * (i + 1) / (windows + 1); if (Math.abs(wx - dx) < dw * 0.9) continue;
    const wn = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.08), wm); wn.position.set(wx, h * 0.66, d / 2 - 0.01); g.add(wn); g.userData.windows.push(wn);
  }
  if (ladder && !dome) {
    const L = new THREE.Group(), lm = vcMat();
    const rail = faceColors(new THREE.BoxGeometry(0.06, h + 0.6, 0.06), '#6e4c2e', { lum: 0.06, seed: seed + 9 });
    for (const x of [-0.2, 0.2]) { const r = new THREE.Mesh(rail, lm); r.position.set(x, (h + 0.6) / 2, 0); r.castShadow = true; L.add(r); }
    const rung = faceColors(new THREE.BoxGeometry(0.44, 0.04, 0.05), '#7a5636', { lum: 0.06, seed: seed + 10 });
    for (let i = 0; i < Math.floor(h / 0.32); i++) { const r = new THREE.Mesh(rung, lm); r.position.set(0, 0.3 + i * 0.32, 0); L.add(r); }
    L.position.set(w / 2 - 0.45, 0, d / 2 + 0.35); L.rotation.x = -0.18; g.add(L);
  }
  return g;
}

// ---------- tent ----------
// Ridge tent of woven goat-hair cloth draped over poles (sagging between them), striped vertex colours,
// open front flap, guy ropes and pegs. Faces +z. colors: [dark, light] stripes.
export function makeTent({ w = 4.2, d = 3, h = 2.1, colors = ['#3e2f26', '#7a5c42'], stripes = 7, seed = 2, open = 0.65, sag = 0.18 } = {}) {
  const g = new THREE.Group(); const R = mulberry32(seed);
  const NX = 10, NZ = 8, pos = [], col = [], idx = [];
  const ca = toColor(colors[0]), cb = toColor(colors[1]);
  const poles = [-w / 2, 0, w / 2];
  const ridge = (x) => { let k = 1; for (let i = 0; i < poles.length - 1; i++) if (x >= poles[i] && x <= poles[i + 1]) { const u = (x - poles[i]) / (poles[i + 1] - poles[i]); k = 1 - sag * Math.sin(Math.PI * u); } return h * k; };
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const u = i / NX, v = j / NZ;
    const x = (u - 0.5) * w;
    const zz = (v - 0.5) * 2;                      // -1 back .. 1 front
    const y = ridge(x) * (1 - Math.abs(zz) ** 1.15) + 0.04;
    let z = zz * d / 2 * (1 + 0.05 * Math.sin(u * 9 + seed));
    let yy = y;
    // front flap folded up on the right half
    if (zz > 0.55 && x > w * 0.05) { const f = smooth(invLerp(0.55, 1, zz)) * open; yy += f * (h * 0.7 - y); z -= f * (zz - 0.55) * d * 0.35; }
    pos.push(x, yy, z);
    const s = Math.floor(u * stripes + 0.15 * Math.sin(v * 6 + seed)) % 2; _c1.copy(s ? cb : ca).multiplyScalar(0.92 + 0.12 * hash01(i * 17 + j, seed));
    col.push(_c1.r, _c1.g, _c1.b);
  }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + NX + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  let geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
  geo = geo.toNonIndexed(); geo.computeVertexNormals();
  const cloth = new THREE.Mesh(geo, vcMat({ side: THREE.DoubleSide })); cloth.castShadow = cloth.receiveShadow = true; g.add(cloth);
  // dark interior so the open flap reads
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.8), new THREE.MeshLambertMaterial({ color: '#1a120c' })); inner.position.set(0, h * 0.4, -d * 0.1); g.add(inner);
  const pm = vcMat(), poleGeo = faceColors(new THREE.CylinderGeometry(0.04, 0.05, 1, 5), '#5a3e26', { seed: seed + 3 });
  for (const x of poles) { const p = new THREE.Mesh(poleGeo, pm); p.scale.y = ridge(x) + 0.12; p.position.set(x, (ridge(x) + 0.12) / 2, 0); p.castShadow = true; g.add(p); }
  // guy ropes + pegs
  const ropeM = new THREE.LineBasicMaterial({ color: '#4a3a2a' }); const rp = [];
  for (const x of poles) for (const sz of [-1, 1]) { const top = [x, ridge(x) * 0.55, sz * d * 0.28], peg = [x + (R() - 0.5) * 0.3, 0.02, sz * (d / 2 + 0.9 + R() * 0.3)]; rp.push(...top, ...peg);
    const pg = new THREE.Mesh(poleGeo, pm); pg.scale.set(0.6, 0.2, 0.6); pg.position.set(peg[0], 0.08, peg[2]); g.add(pg); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); g.add(new THREE.LineSegments(rg, ropeM));
  g.userData.door = new THREE.Vector3(w * 0.25, 0, d / 2 + 0.3);
  return g;
}
