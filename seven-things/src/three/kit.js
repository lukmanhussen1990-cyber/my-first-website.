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
