// Low-poly world sets. Each set is a THREE.Group toggled by the timeline.
//   plain : green plain, ancient town + market, fields, shepherd hill, the ark site (origin)
//   sea   : the flood (faceted waves) — shares the origin, plain hidden
//   inside: inside the ark, lamplight (far away at x=+600)
//   hill  : hill with a cross and a glowing doorway (x=+3000)
//   city  : modern street at dusk with the same glowing door (x=-3000)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { matte, glowMat, radialTex, fadeTex, U } from './materials.js';
import { fbm, hash01, mulberry32, smooth, clamp } from './util.js';
import { makeAnimal } from './animals.js';

const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- ground height (shared by terrain + character placement) ----------
export function groundHeight(x, z) {
  const site = Math.hypot(x / 34, (z - 7) / 17);
  const town = Math.hypot((x + 18) / 26, (z - 32) / 18);
  const flatW = Math.min(sstep(1.0, 1.7, site), sstep(1.0, 1.6, town));
  let h = 1.1 * fbm(x * 0.025, z * 0.025, 3, 5) * (0.08 + 0.92 * flatW);
  h += 11 * Math.exp(-((x + 64) ** 2 + (z - 84) ** 2) / (2 * 21 * 21));          // shepherd hill
  h += 7 * Math.exp(-((x - 78) ** 2 + (z + 46) ** 2) / (2 * 30 * 30));
  h += 6 * Math.exp(-((x + 92) ** 2 + (z + 34) ** 2) / (2 * 26 * 26));
  h += 5 * Math.exp(-((x - 60) ** 2 + (z - 110) ** 2) / (2 * 26 * 26));
  const r = Math.hypot(x, z - 15);
  if (r > 120) h += (r - 120) * 0.2 * (0.7 + 0.3 * fbm(x * 0.02, z * 0.02, 2, 9));
  return h * flatW + h * (1 - flatW) * 0.0;
}

function colorize(geo, fn) {
  const p = geo.attributes.position; const c = new Float32Array(p.count * 3); const col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), col, i); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
}
const cA = new THREE.Color(), cB = new THREE.Color();

function tree(x, z, s = 1, seed = 1, palette = ['#5d6e2c', '#67772f', '#55652a', '#718034']) {
  const g = new THREE.Group(); const r = mulberry32(seed);
  const y = groundHeight(x, z);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 2.4 * s, 6), matte('#5a3a22'));
  trunk.position.y = 1.2 * s; trunk.castShadow = true; g.add(trunk);
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry((1.3 + r() * 0.8) * s, 1), matte(palette[Math.floor(r() * palette.length)]));
    c.position.set((r() - 0.5) * 1.4 * s, (2.8 + r() * 0.9) * s, (r() - 0.5) * 1.4 * s); c.scale.y = 0.9 + r() * 0.2;
    c.castShadow = true; c.receiveShadow = true; g.add(c); g.userData.crowns = (g.userData.crowns || []).concat(c);
  }
  g.position.set(x, y, z);
  return g;
}

function palm(x, z, s = 1, seed = 1) {
  const g = new THREE.Group(); const r = mulberry32(seed); const y = groundHeight(x, z);
  const lean = (r() - 0.5) * 0.25; let px = 0, py = 0;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.17 * s, 1.25 * s, 6), matte(i % 2 ? '#6b4a2c' : '#5e3f25'));
    seg.position.set(px, py + 0.62 * s, 0); seg.rotation.z = lean; seg.castShadow = true; g.add(seg);
    px -= Math.sin(lean) * 1.2 * s; py += Math.cos(lean) * 1.2 * s;
  }
  const crown = new THREE.Group(); crown.position.set(px, py, 0); g.add(crown);
  for (let i = 0; i < 8; i++) {
    const lf = new THREE.Mesh(new THREE.ConeGeometry(0.42 * s, 2.6 * s, 3), matte(i % 2 ? '#4f6a2a' : '#5a7530'));
    lf.scale.z = 0.16; lf.geometry.translate(0, 1.3 * s, 0);
    lf.rotation.set(0, i / 8 * Math.PI * 2 + r() * 0.3, 0); lf.rotateX(1.9 + r() * 0.3);
    lf.castShadow = true; crown.add(lf);
  }
  g.position.set(x, y, z); g.rotation.y = r() * 6;
  g.userData.crown = crown;
  return g;
}

function house(x, z, w, d, h, roof, wall, roofCol, rot, seed) {
  const g = new THREE.Group(); const y = groundHeight(x, z);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matte(wall)); body.position.y = h / 2; body.castShadow = body.receiveShadow = true; g.add(body);
  if (roof === 'pyr') {
    const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.62, 4), matte(roofCol)); r.rotation.y = Math.PI / 4; r.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    r.position.y = h + h * 0.31; r.castShadow = true; g.add(r);
  } else {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.28, d + 0.3), matte(roofCol)); slab.position.y = h + 0.14; slab.castShadow = true; g.add(slab);
    const par = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.4, 0.25), matte(wall)); par.position.set(0, h + 0.45, (d + 0.05) / 2); g.add(par);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.2, w * 0.28), Math.min(2.0, h * 0.62)), matte('#3a2618'));
  door.position.set(w * 0.12, Math.min(2.0, h * 0.62) / 2, d / 2 + 0.01); g.add(door);
  const r = mulberry32(seed);
  for (let i = 0; i < 2; i++) { const wn = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), matte('#4a3020')); wn.position.set(-w * 0.28 + i * w * 0.5 * r(), h * 0.68, d / 2 + 0.01); if (i === 0 || r() > 0.4) g.add(wn); }
  g.position.set(x, y, z); g.rotation.y = rot;
  return g;
}

function stall(x, z, rot, awning, goods) {
  const g = new THREE.Group(); const y = groundHeight(x, z);
  for (const [px, pz] of [[-1.2, -0.7], [1.2, -0.7], [-1.2, 0.7], [1.2, 0.7]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.3, 0.1), matte('#5a3a22')); p.position.set(px, 1.15, pz); p.castShadow = true; g.add(p); }
  const aw = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 1.9), matte(awning)); aw.position.y = 2.35; aw.rotation.x = 0.12; aw.castShadow = true; g.add(aw);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.2), matte('#7a5232')); tb.position.y = 0.4; tb.castShadow = tb.receiveShadow = true; g.add(tb);
  for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), matte(goods[i % goods.length])); f.position.set(-0.9 + (i % 5) * 0.42, 0.9, -0.25 + Math.floor(i / 5) * 0.4); g.add(f); }
  g.position.set(x, y, z); g.rotation.y = rot;
  return g;
}

function ribbon(points, width, color, yoff = 0.04) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const N = 80; const pos = []; const idx = [];
  for (let i = 0; i <= N; i++) {
    const p = curve.getPoint(i / N), tg = curve.getTangent(i / N); const nx = -tg.z, nz = tg.x;
    for (const s of [-1, 1]) { const x = p.x + nx * width / 2 * s, z = p.z + nz * width / 2 * s; pos.push(x, groundHeight(x, z) + yoff, z); }
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, matte(color, { unique: true, params: { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } }));
  m.receiveShadow = true; return m;
}

// swaying grass tufts (instanced)
function grassField(n, area, seed, color = '#949a4a') {
  const blade = [];
  for (let k = 0; k < 3; k++) { const g = new THREE.ConeGeometry(0.06, 0.55, 3); g.translate(0, 0.27, 0); g.rotateZ((k - 1) * 0.35); g.translate((k - 1) * 0.07, 0, 0); blade.push(g); }
  const geo = mergeGeometries(blade);
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind;
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       vec4 wp0 = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
       float sway = sin(uTime*1.9 + wp0.x*0.35 + wp0.z*0.27) * 0.5 + sin(uTime*3.3 + wp0.x*0.9) * 0.18;
       transformed.x += sway * 0.22 * uWind * max(position.y, 0.0);`);
  };
  mat.customProgramCacheKey = () => 'grass';
  const im = new THREE.InstancedMesh(geo, mat, n);
  const r = mulberry32(seed); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(); const p = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) {
    const x = area[0] + r() * (area[2] - area[0]), z = area[1] + r() * (area[3] - area[1]);
    if (area[4] && area[4](x, z)) continue;
    p.set(x, groundHeight(x, z), z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28); const sc = 0.55 + r() * 0.6; s.set(sc, sc * (0.7 + r() * 0.5), sc);
    m4.compose(p, q, s); im.setMatrixAt(k++, m4);
    const c = new THREE.Color(color).multiplyScalar(0.85 + r() * 0.3); im.setColorAt(k - 1, c);
  }
  im.count = k; im.receiveShadow = false; im.castShadow = false;
  return im;
}

// a free-standing wooden doorway that glows (hill + city share it with the ark's door look)
export function makeDoorway() {
  const g = new THREE.Group(); const D = { group: g };
  const w = 1.9, h = 3.0;
  const fm = matte('#5a3a22');
  for (const [bw, bh, x, y] of [[0.3, h + 0.3, -w / 2 - 0.15, (h + 0.3) / 2], [0.3, h + 0.3, w / 2 + 0.15, (h + 0.3) / 2], [w + 0.9, 0.32, 0, h + 0.3], [w + 0.6, 0.12, 0, 0.06]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.36), fm); f.position.set(x, y, 0); f.castShadow = true; g.add(f);
  }
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 1.1), fog: false }));
  inner.position.set(0, h / 2, 0); g.add(inner); D.inner = inner;
  const hinge = new THREE.Group(); hinge.position.set(-w / 2, h / 2, 0.12); g.add(hinge); D.hinge = hinge;
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(w / 4 - 0.03, h - 0.05, 0.12), matte(['#8a5c33', '#7d5230', '#93643a', '#74492a'][k])); b.position.set(w / 8 + k * w / 4, 0, 0); b.castShadow = true; hinge.add(b); }
  hinge.rotation.y = -1.9;
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat([1.0, 0.78, 0.4], 0.8, { map: radialTex() }));
  halo.position.set(0, h / 2, 0.3); halo.scale.set(w * 2.6, h * 1.7, 1); g.add(halo); D.halo = halo;
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat([1.0, 0.72, 0.34], 0.7, { map: fadeTex() }));
  spill.rotation.x = -Math.PI / 2; spill.rotation.z = Math.PI; spill.position.set(0, 0.05, 3.2); spill.scale.set(w + 2.2, 6.5, 1); g.add(spill); D.spill = spill;
  const light = new THREE.PointLight('#ffbe70', 30, 16, 1.6); light.position.set(0, 1.6, 1.2); g.add(light); D.light = light;
  D.set = (k = 1) => {
    inner.material.color.setRGB(0.45 + 1.1 * k, 0.28 + 0.62 * k, 0.1 + 0.2 * k);
    halo.material.opacity = 0.42 * k; spill.material.opacity = 0.42 * k; light.intensity = 22 * k;
  };
  D.center = new THREE.Vector3(0, h / 2, 0);
  return D;
}

export function buildWorld(scene) {
  const W = { sets: {} };
  // ======================= PLAIN =======================
  const plain = new THREE.Group(); scene.add(plain); W.sets.plain = plain;
  const tg = new THREE.PlaneGeometry(760, 760, 152, 152); tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, groundHeight(tp.getX(i), tp.getZ(i)));
  tg.computeVertexNormals();
  colorize(tg, (x, y, z, c) => {
    const n = fbm(x * 0.03, z * 0.03, 2, 21), m = fbm(x * 0.008, z * 0.008, 2, 23);
    cA.set('#8d8a43'); cB.set('#a19a4c'); c.copy(cA).lerp(cB, clamp(0.5 + n));
    c.lerp(cB.set('#7a7a3a'), clamp(m * 1.5));
    c.lerp(cB.set('#b8a464'), clamp((y - 6) / 10) * 0.6);
  });
  const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const terrain = new THREE.Mesh(tg, terrainMat); terrain.receiveShadow = true; plain.add(terrain);
  W.terrainMat = terrainMat;
  // building-site dirt + sawdust, road to town, town square
  const siteG = new THREE.CircleGeometry(1, 40); siteG.rotateX(-Math.PI / 2);
  const site = new THREE.Mesh(siteG, matte('#a88c5a', { unique: true, params: { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } }));
  site.scale.set(27, 1, 11); site.position.set(0, 0.03, 4); site.receiveShadow = true; plain.add(site); W.site = site;
  plain.add(ribbon([[-2, 11], [-6, 17], [-12, 23], [-16, 28], [-18, 34], [-22, 44], [-26, 60]], 3.2, '#ae9662'));
  plain.add(ribbon([[-16, 30], [-6, 34], [8, 38], [24, 36], [40, 34], [60, 30]], 2.6, '#ae9662'));
  plain.add(ribbon([[-18, 31], [-36, 30], [-52, 40], [-60, 62], [-63, 80]], 2.2, '#ae9662'));
  const sq = new THREE.Mesh(siteG, matte('#b9a170', { unique: true, params: { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } }));
  sq.scale.set(8, 1, 7); sq.position.set(-17, groundHeight(-17, 31) + 0.05, 31); sq.receiveShadow = true; plain.add(sq);
  // town
  const town = new THREE.Group(); plain.add(town); W.town = town;
  const walls = ['#cdb084', '#c4a274', '#d6bf92', '#bf9a6a', '#d2b688'];
  const roofs = ['#a8473a', '#5d7a43', '#4f6f8f', '#c49a3a', '#cdb084', '#b8936a'];
  const rr = mulberry32(77); W.chimneys = [];
  const placed = [];
  const HOUSES = [];
  for (let i = 0; i < 70 && HOUSES.length < 24; i++) {
    const ang = rr() * Math.PI * 2, rad = 9 + rr() * 16;
    const x = -17 + Math.cos(ang) * rad * 1.3, z = 32 + Math.sin(ang) * rad * 0.85;
    if (z < 19) continue;
    const w = 3.6 + rr() * 2.6, d = 3.4 + rr() * 2.2, h = 2.8 + rr() * 1.8;
    if (placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + Math.max(w, d) * 0.62)) continue;
    // keep the road to the ark open
    if (Math.abs((x + 12) - (z - 24) * -0.6) < 3.5 && z < 32) continue;
    placed.push([x, z, Math.max(w, d) * 0.62]);
    const rot = Math.atan2(-17 - x, 31 - z) + (rr() - 0.5) * 0.3;
    const roof = rr() < 0.55 ? 'pyr' : 'flat';
    const hs = house(x, z, w, d, h, roof, walls[Math.floor(rr() * walls.length)], roofs[Math.floor(rr() * roofs.length)], rot, i);
    town.add(hs); HOUSES.push(hs);
    if (roof === 'flat' && W.chimneys.length < 5 && rr() < 0.6) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.5), matte('#9a7a54')); ch.position.set(w * 0.25, h + 0.6, -d * 0.2); hs.add(ch); ch.castShadow = true;
      hs.updateMatrixWorld(true); W.chimneys.push(new THREE.Vector3(w * 0.25, h + 1.2, -d * 0.2).applyMatrix4(hs.matrixWorld));
    }
  }
  W.houses = HOUSES;
  const awn = ['#a8473a', '#4f6f8f', '#c49a3a', '#5d7a43', '#7a4a62'];
  const goods = [['#c8452a', '#e0a030', '#7a9a3a'], ['#d4a03a', '#b06a2a'], ['#8a5a9a', '#5a8a3a', '#e0c070'], ['#c06030', '#d8c090']];
  W.stalls = [];
  for (let i = 0; i < 6; i++) {
    const a = -0.4 + i * 0.75; const x = -17 + Math.cos(a) * 6.5, z = 31 + Math.sin(a) * 5.2;
    const s = stall(x, z, -a + Math.PI / 2, awn[i % awn.length], goods[i % goods.length]); town.add(s); W.stalls.push(s);
  }
  const well = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.8, 10, 1, true), matte('#9a8a70', { params: { side: THREE.DoubleSide } })); well.position.set(-17, groundHeight(-17, 31) + 0.4, 31); town.add(well);
  // fields (crop rows)
  const fields = new THREE.Group(); plain.add(fields); W.fields = fields;
  const fieldDefs = [[36, 30, 20, 16, 0.2, '#a49a40', '#8b9a3a'], [52, 52, 22, 14, -0.15, '#c4a64a', '#b0943e'], [30, 58, 16, 18, 0.35, '#7f9238', '#94a040']];
  for (const [fx, fz, fw, fd, rot, c1, c2] of fieldDefs) {
    const fgp = new THREE.Group(); fgp.position.set(fx, 0, fz); fgp.rotation.y = rot; fields.add(fgp);
    for (let k = 0; k < Math.floor(fd / 1.2); k++) {
      const z = -fd / 2 + k * 1.2; const row = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.32, 0.55), matte(k % 2 ? c1 : c2));
      const wx = fx, wz = fz + z; row.position.set(0, groundHeight(wx, wz) + 0.12, z); row.receiveShadow = true; row.castShadow = true; fgp.add(row);
    }
  }
  // trees, palms, rocks
  const veg = new THREE.Group(); plain.add(veg); W.veg = veg; W.trees = []; W.palms = [];
  const vr = mulberry32(99);
  const blocked = (x, z) => Math.hypot(x / 30, (z - 6) / 15) < 1.15 || Math.hypot((x + 17) / 30, (z - 32) / 20) < 1.0 || (x > 18 && x < 66 && z > 18 && z < 66)
    || (x > -14 && x < 56 && z > 0 && z < 60) || (x < -55 && z > 78) || (x > 30 && x < 70 && z > -10 && z < 30) || (x > -40 && x < -10 && z > 36 && z < 52);
  for (let i = 0; i < 400 && W.trees.length < 70; i++) {
    const x = -140 + vr() * 280, z = -90 + vr() * 230;
    if (blocked(x, z)) continue;
    const t = tree(x, z, 0.9 + vr() * 0.7, i); veg.add(t); W.trees.push(t);
  }
  for (let i = 0; i < 300 && W.palms.length < 26; i++) {
    const x = -50 + vr() * 52, z = 10 + vr() * 50;
    if (blocked(x, z) && !(Math.hypot((x + 17) / 30, (z - 32) / 20) > 0.75 && Math.hypot((x + 17) / 30, (z - 32) / 20) < 1.1)) continue;
    if (Math.hypot(x / 30, (z - 6) / 15) < 1.25) continue;
    const p = palm(x, z, 0.9 + vr() * 0.5, i + 500); veg.add(p); W.palms.push(p);
  }
  for (let i = 0; i < 40; i++) {
    const x = -90 + vr() * 180, z = -40 + vr() * 140; if (blocked(x, z)) continue;
    const rk = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4 + vr() * 0.9, 0), matte(vr() < 0.5 ? '#8a8070' : '#9a8c74'));
    rk.position.set(x, groundHeight(x, z) + 0.1, z); rk.rotation.set(vr(), vr(), vr()); rk.castShadow = true; veg.add(rk);
  }
  // grass
  W.grass = grassField(2600, [-70, -30, 70, 75, (x, z) => Math.hypot(x / 27, (z - 4) / 11) < 1.0 || Math.hypot((x + 17) / 9, (z - 31) / 8) < 1], 5);
  plain.add(W.grass);
  W.grassHill = grassField(900, [-95, 55, -35, 110], 6, '#9a9a50'); plain.add(W.grassHill);
  // wood piles near the ark
  const piles = new THREE.Group(); plain.add(piles); W.piles = piles;
  for (const [px, pz, rot] of [[-13, 9.2, 0.2], [11, 9.5, -0.3], [-22, -5, 1.2], [21, -4, 0.8]]) {
    const pg = new THREE.Group(); pg.position.set(px, 0, pz); pg.rotation.y = rot; piles.add(pg);
    for (let k = 0; k < 7; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.2, 7), matte(k % 2 ? '#8a6038' : '#7a5230')); l.rotation.z = Math.PI / 2; l.position.set(0, 0.22 + Math.floor(k / 4) * 0.4, (k % 4) * 0.46 - 0.7 + (k >= 4 ? 0.23 : 0)); l.castShadow = true; pg.add(l); }
    for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.55), matte('#a07848')); b.position.set(0.4, 0.05 + k * 0.11, 1.5); b.rotation.y = (k % 2) * 0.05; b.castShadow = true; pg.add(b); }
  }
  // sheep on the shepherd hill
  W.flock = [];
  for (let i = 0; i < 9; i++) {
    const a = makeAnimal('sheep', 70 + i); const x = -66 + (hash01(i, 1) - 0.5) * 12, z = 82 + (hash01(i, 2) - 0.5) * 10;
    a.group.position.set(x, groundHeight(x, z), z); a.group.rotation.y = hash01(i, 3) * 6; a.group.scale.setScalar(1.1); plain.add(a.group); W.flock.push(a);
  }

  // ======================= SEA (the flood) =======================
  const sea = new THREE.Group(); scene.add(sea); W.sets.sea = sea;
  const sg = new THREE.PlaneGeometry(520, 520, 90, 90); sg.rotateX(-Math.PI / 2);
  const seaMesh = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ color: '#557284', flatShading: true }));
  seaMesh.receiveShadow = true; sea.add(seaMesh); W.seaMesh = seaMesh;
  W.seaBase = Float32Array.from(sg.attributes.position.array);
  W.waveAt = (x, z, t) => 0.9 * Math.sin(x * 0.11 + t * 1.3) + 0.7 * Math.sin(z * 0.14 - t * 1.05 + x * 0.04) + 0.45 * Math.sin((x + z) * 0.23 + t * 2.1) + 0.25 * Math.sin(x * 0.5 - t * 2.8);
  W.setSea = (t) => {
    const p = sg.attributes.position; const b = W.seaBase;
    for (let i = 0; i < p.count; i++) { const x = b[i * 3], z = b[i * 3 + 2]; p.setY(i, W.waveAt(x, z, t)); }
    p.needsUpdate = true; sg.computeVertexNormals();
  };

  // ======================= INSIDE THE ARK =======================
  const inside = new THREE.Group(); inside.position.set(600, 0, 0); scene.add(inside); W.sets.inside = inside;
  const wood = ['#6e4a2b', '#7a5230', '#664226', '#73502e'];
  const floor = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 12), matte('#6a4628')); floor.position.y = -0.15; floor.receiveShadow = true; inside.add(floor);
  for (let k = 0; k < 14; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 0.18), matte(wood[k % 4])); p.position.set(0, 0.3 + k * 0.62, -5.8); p.receiveShadow = true; inside.add(p); }
  for (const s of [-1, 1]) for (let k = 0; k < 14; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 12), matte(wood[(k + 1) % 4])); p.position.set(s * 10.8, 0.3 + k * 0.62, 0); p.receiveShadow = true; inside.add(p); }
  for (let x = -9; x <= 9; x += 3) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 12), matte('#4e321d')); b.position.set(x, 6.2, 0); b.castShadow = true; inside.add(b); const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 6.2, 0.32), matte('#5a3a22')); post.position.set(x, 3.1, -4.8); post.castShadow = true; inside.add(post); }
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 12), matte('#4a2f1a')); ceil.position.y = 6.6; inside.add(ceil);
  for (const [x, z] of [[-6, -3.6], [5.5, -3.8], [-1, -4.2]]) { const h = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.0), matte('#c9a85a')); h.position.set(x, 0.45, z); h.rotation.y = 0.2; h.castShadow = true; inside.add(h); }
  const lampG = new THREE.Group(); lampG.position.set(-0.5, 4.3, -1.2); inside.add(lampG); W.lamp = lampG;
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 4), matte('#2a1a10')); chain.position.y = 0.95; lampG.add(chain);
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.1), fog: false })); lampG.add(bulb);
  const lh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat([1, 0.7, 0.35], 0.75, { map: radialTex() })); lh.scale.setScalar(6); lampG.add(lh); W.lampHalo = lh;
  const lampLight = new THREE.PointLight('#ffad5c', 60, 26, 1.4); lampLight.castShadow = false; lampG.add(lampLight); W.lampLight = lampLight;
  W.insideAnimals = [];
  for (const [k, x, z, ry, s] of [['sheep', 4.6, -1.8, -0.6, 1.0], ['sheep', 5.6, -2.6, -0.4, 0.95], ['lion', -6.6, -2.4, 0.5, 0.9], ['lioness', -7.8, -3.4, 0.4, 0.9], ['deer', 7.6, -3.6, -0.9, 0.9], ['camel', -3.4, -4.6, 0.1, 0.85]]) {
    const a = makeAnimal(k, x * 13); a.group.position.set(x, 0, z); a.group.rotation.y = ry; a.group.scale.setScalar(s); inside.add(a.group); W.insideAnimals.push(a);
  }
  for (const [x, ry] of [[-3, 0.3], [-2.4, 0.5]]) { const d = makeAnimal('dove', 9); d.group.position.set(x, 6.55, 1.2); d.group.rotation.y = ry; d.group.scale.setScalar(1.6); inside.add(d.group); W.insideAnimals.push(d); }

  // ======================= HILL WITH CROSS + DOORWAY =======================
  const hill = new THREE.Group(); hill.position.set(3000, 0, 0); scene.add(hill); W.sets.hill = hill;
  const hh = (x, z) => 6.5 * Math.exp(-(x * x + z * z) / (2 * 15 * 15)) + 0.6 * fbm(x * 0.05, z * 0.05, 2, 41);
  W.hillHeight = hh;
  const hg = new THREE.PlaneGeometry(500, 500, 100, 100); hg.rotateX(-Math.PI / 2);
  { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const r = Math.hypot(x, z); p.setY(i, hh(x, z) + (r > 90 ? (r - 90) * 0.12 : 0)); } hg.computeVertexNormals(); }
  colorize(hg, (x, y, z, c) => { const n = fbm(x * 0.04, z * 0.04, 2, 51); c.set('#9a8f4a').lerp(cB.set('#b39e58'), clamp(0.5 + n)); });
  const hm = new THREE.Mesh(hg, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); hm.receiveShadow = true; hill.add(hm);
  const cross = new THREE.Group(); cross.position.set(5.2, hh(5.2, -4.5), -4.5); hill.add(cross); W.cross = cross;
  const cv = new THREE.Mesh(new THREE.BoxGeometry(0.42, 6.2, 0.42), matte('#4e321d')); cv.position.y = 3.1; cv.castShadow = true; cross.add(cv);
  const ch2 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.38, 0.38), matte('#4e321d')); ch2.position.y = 4.6; ch2.castShadow = true; cross.add(ch2);
  cross.rotation.y = -0.35;
  const hdoor = makeDoorway(); hdoor.group.position.set(0, hh(0, 0) - 0.05, 0); hill.add(hdoor.group); W.hillDoor = hdoor;
  hill.add(grassField(1400, [-40, -40, 40, 40], 7, '#8c9440'));
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28 + 0.3, r = 22 + hash01(i, 5) * 14; const t = tree(0, 0, 0.8 + hash01(i, 6) * 0.4, i + 900, ['#6b7a3a', '#5f6e34', '#76843f']); t.position.set(Math.cos(a) * r, hh(Math.cos(a) * r, Math.sin(a) * r), Math.sin(a) * r); hill.add(t); }
  for (let i = 0; i < 10; i++) { const x = (hash01(i, 8) - 0.5) * 30, z = (hash01(i, 9) - 0.5) * 30; const rk = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4 + hash01(i, 3) * 0.6, 0), matte('#8a8070')); rk.position.set(x, hh(x, z), z); rk.castShadow = true; hill.add(rk); }

  // ======================= CITY STREET AT DUSK =======================
  const city = new THREE.Group(); city.position.set(-3000, 0, 0); scene.add(city); W.sets.city = city;
  const road = new THREE.Mesh(new THREE.BoxGeometry(400, 0.1, 12), matte('#3a3a40')); road.position.set(0, -0.05, 6); road.receiveShadow = true; city.add(road);
  for (let x = -150; x < 150; x += 6) { const l = new THREE.Mesh(new THREE.BoxGeometry(3, 0.02, 0.22), matte('#d9cfa8')); l.position.set(x, 0.01, 6); city.add(l); }
  for (let k = 0; k < 7; k++) { const z = 0.8 + k * 0.75; const cw = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.02, 0.42), matte('#e6dfcc')); cw.position.set(14, 0.012, z + 0.6 + 0); city.add(cw); }
  const walk = new THREE.Mesh(new THREE.BoxGeometry(400, 0.24, 7), matte('#9a958a')); walk.position.set(0, 0.06, -3.5); walk.receiveShadow = true; city.add(walk);
  const walk2 = new THREE.Mesh(new THREE.BoxGeometry(400, 0.24, 6), matte('#9a958a')); walk2.position.set(0, 0.06, 15); walk2.receiveShadow = true; city.add(walk2);
  for (let x = -150; x < 150; x += 2.2) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 7), matte('#85807a')); s.position.set(x, 0.19, -3.5); city.add(s); }
  const curb = new THREE.Mesh(new THREE.BoxGeometry(400, 0.3, 0.3), matte('#b5b0a5')); curb.position.set(0, 0.1, 0); city.add(curb);
  W.windows = [];
  const bcol = ['#7a6a5e', '#8a7c6a', '#6a6470', '#9a8a74', '#5e5a62', '#806c5a', '#a08a70'];
  const winMatOn = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 0.88, 0.45), fog: true });
  const winMatOff = matte('#3a3a44');
  const br = mulberry32(314);
  for (const side of [-1, 1]) {
    let x = -120;
    while (x < 120) {
      const w = 9 + br() * 7, h = side < 0 ? 12 + br() * 26 : 9 + br() * 16, d = 10;
      const z = side < 0 ? -7.2 - d / 2 : 18.2 + d / 2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matte(bcol[Math.floor(br() * bcol.length)])); b.position.set(x + w / 2, h / 2, z); b.castShadow = b.receiveShadow = true; city.add(b);
      const face = side < 0 ? z + d / 2 + 0.02 : z - d / 2 - 0.02;
      const geosOn = [], geosOff = [];
      for (let fy = 3.2; fy < h - 1.5; fy += 3) for (let fx = 1.2; fx < w - 1; fx += 2.2) {
        const q = new THREE.PlaneGeometry(1.2, 1.6); if (side > 0) q.rotateY(Math.PI); q.translate(x + fx, fy, face);
        (br() < 0.55 ? geosOn : geosOff).push(q);
      }
      if (geosOn.length) city.add(new THREE.Mesh(mergeGeometries(geosOn), winMatOn));
      if (geosOff.length) city.add(new THREE.Mesh(mergeGeometries(geosOff), winMatOff));
      // shop front at street level
      const shop = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.6, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5 + 0.25 * br(), 0.36 + 0.14 * br(), 0.2), fog: true }));
      if (side > 0) shop.rotation.y = Math.PI; shop.position.set(x + w / 2, 1.5, face + (side < 0 ? 0.01 : -0.01)); city.add(shop);
      const awnC = ['#7d2f34', '#3e4a78', '#2f4a4a', '#c99a3a'][Math.floor(br() * 4)];
      const aw = new THREE.Mesh(new THREE.BoxGeometry(w - 1, 0.15, 1.4), matte(awnC)); aw.position.set(x + w / 2, 2.95, face + (side < 0 ? 0.7 : -0.7)); aw.rotation.x = side < 0 ? 0.2 : -0.2; aw.castShadow = true; city.add(aw);
      x += w + 0.6;
    }
  }
  W.lamps = [];
  for (let x = -54; x <= 66; x += 12) {
    const g = new THREE.Group(); g.position.set(x, 0, -0.9); city.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.6, 6), matte('#2a2a30')); pole.position.y = 2.8; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), matte('#2a2a30')); arm.position.set(0, 5.5, 0.55); g.add(arm);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 1.0) })); bulb.position.set(0, 5.4, 1.1); g.add(bulb);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat([1, 0.72, 0.4], 0.5, { map: radialTex() })); halo.position.set(0, 5.3, 1.2); halo.scale.setScalar(3.2); g.add(halo);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat([0.9, 0.62, 0.32], 0.3, { map: radialTex() })); pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.2, 1.2); pool.scale.setScalar(6); g.add(pool);
    W.lamps.push(g);
  }
  W.cars = [];
  const carCols = ['#7d2f34', '#3e4a78', '#c9c2b0', '#2f4a4a', '#c99a3a'];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); city.add(g);
    const bdy = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 1.8), matte(carCols[i % 5])); bdy.position.y = 0.75; bdy.castShadow = true; g.add(bdy);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.75, 1.6), matte('#2a2e36')); cab.position.set(-0.2, 1.55, 0); g.add(cab);
    for (const [wx, wz] of [[1.3, 0.9], [-1.3, 0.9], [1.3, -0.9], [-1.3, -0.9]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 8), matte('#1a1a1c')); wh.rotation.x = Math.PI / 2; wh.position.set(wx, 0.36, wz); g.add(wh); }
    const hl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat([1, 0.9, 0.7], 0.6, { map: radialTex() })); hl.position.set(2.2, 0.8, 0); hl.rotation.y = Math.PI / 2; hl.scale.set(1.6, 0.9, 1); g.add(hl);
    const tl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat([1.2, 0.15, 0.1], 0.5, { map: radialTex() })); tl.position.set(-2.2, 0.85, 0); tl.rotation.y = -Math.PI / 2; tl.scale.set(1.0, 0.6, 1); g.add(tl);
    g.position.set(-34 + i * 13 + (i % 2) * 3, 0, i % 2 ? 4.2 : 7.8); g.rotation.y = i % 2 ? 0 : Math.PI;
    W.cars.push(g);
  }
  for (let x = -40; x <= 40; x += 16) { const t = tree(0, 0, 0.7, x + 3000, ['#4e5e3a', '#56663e']); t.position.set(x + 6, 0.2, -6.4); city.add(t); }
  const cdoor = makeDoorway(); cdoor.group.position.set(0, 0.18, -5.6); city.add(cdoor.group); W.cityDoor = cdoor;
  return W;
}
