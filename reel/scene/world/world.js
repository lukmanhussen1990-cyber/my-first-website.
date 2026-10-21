// Landscape: terrain, the cut face (cake slice), the Great Wall, watchtowers, trees, sky and far ranges.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as GEO from './geo.js';
import { earthMaterial, terrainMaterial, wallMaterial, std, glowMaterial, tex, G } from '../lib/materials.js';
import { rng, smoothstep, lerp, clamp, fbm2 } from '../lib/util.js';

export const Y_BOT = -110;

// non-uniform sample positions: dense where the camera goes, sparse far away
function samples(ranges) {
  const out = [];
  for (const [a, b, step] of ranges) for (let v = a; v < b - 1e-6; v += step) out.push(v);
  out.push(ranges[ranges.length - 1][1]);
  return out;
}
export const XS = samples([[-900, -240, 12], [-240, -70, 2.0], [-70, 480, 0.7], [480, 700, 2.0], [700, 1500, 12]]);
const ZS = samples([[-900, -260, 20], [-260, -110, 5], [-110, -42, 1.6], [-42, -12, 0.9], [-12, 0, 0.45]]);

function terrainGeometry() {
  const nx = XS.length, nz = ZS.length;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = XS[i], z = ZS[j];
    const k = (j * nx + i) * 3;
    pos[k] = x; pos[k + 1] = GEO.terrainH(x, z); pos[k + 2] = z;
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// the vertical cut face: one tall quad per column, top follows the ground
function cutFaceGeometry() {
  const n = XS.length;
  const pos = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const x = XS[i];
    pos.set([x, Y_BOT, 0, x, GEO.surfaceCut(x), 0], i * 6);
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 6).map((_, k) => (k % 3 === 2 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

// sweep a 2D profile [{a, h}] along the wall path; returns geometry with uv (bricks) + aH
function sweep(path, profile, { uScale = 1 / 3.2, vScale = 1 / 3.2, closed = false, topUV = false } = {}) {
  const pos = [], uv = [], ah = [], idx = [];
  const m = profile.length;
  // profile arc length for v
  const pl = [0];
  for (let k = 1; k < m; k++) pl.push(pl[k - 1] + Math.hypot(profile[k].a - profile[k - 1].a, profile[k].h - profile[k - 1].h));
  path.forEach((p, i) => {
    for (let k = 0; k < m; k++) {
      const { a, h } = profile[k];
      pos.push(p.x + p.ax * a, p.y + h, p.z + p.az * a);
      uv.push(p.s * uScale, topUV ? a * vScale : (p.y + h) * vScale);
      ah.push(h);
    }
  });
  for (let i = 0; i < path.length - 1; i++) for (let k = 0; k < m - 1 + (closed ? 1 : 0); k++) {
    const k2 = (k + 1) % m;
    const a = i * m + k, b = i * m + k2, c = (i + 1) * m + k, d = (i + 1) * m + k2;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(ah, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function wallPath(step = 0.55) {
  const pts = [];
  let s = 0, prev = null;
  for (let x = GEO.WALL_X0; x <= GEO.WALL_X1 + 1e-6; x += step) {
    const z = GEO.wallZ(x);
    // smooth the base so the wall reads as a clean ribbon over the ridge
    let y = 0; for (let k = -2; k <= 2; k++) y += GEO.terrainH(x + k * 0.6, GEO.wallZ(x + k * 0.6)); y /= 5;
    const dx = 0.2, dz = GEO.wallZ(x + dx) - GEO.wallZ(x - dx);
    const l = Math.hypot(2 * dx, dz);
    const tx = (2 * dx) / l, tz = dz / l;
    if (prev) s += Math.hypot(x - prev.x, y - prev.y, z - prev.z);
    const p = { x, y, z, s, tx, tz, ax: -tz, az: tx };
    pts.push(p); prev = p;
  }
  return pts;
}

function buildWall(group) {
  const path = wallPath();
  const brick = wallMaterial('bricks');
  const blocks = wallMaterial('blocks');
  const body = mergeGeometries([
    sweep(path, [{ a: 1.78, h: -1.4 }, { a: 1.58, h: 3.0 }]),
    sweep(path, [{ a: -1.58, h: 3.0 }, { a: -1.78, h: -1.4 }]),
    // parapets (front taller, with merlons on top), inner + outer faces
    sweep(path, [{ a: 1.58, h: 3.0 }, { a: 1.58, h: 3.8 }, { a: 1.22, h: 3.8 }, { a: 1.22, h: 3.12 }]),
    sweep(path, [{ a: -1.22, h: 3.12 }, { a: -1.22, h: 3.6 }, { a: -1.58, h: 3.6 }, { a: -1.58, h: 3.0 }]),
  ]);
  const wall = new THREE.Mesh(body, brick);
  wall.castShadow = wall.receiveShadow = true;
  group.add(wall);
  const walk = new THREE.Mesh(sweep(path, [{ a: -1.22, h: 3.12 }, { a: 1.22, h: 3.12 }], { topUV: true, uScale: 1 / 2.4, vScale: 1 / 2.4 }), blocks);
  walk.receiveShadow = true;
  group.add(walk);

  // merlons (crenellations) along both parapets
  const mg = new RoundedBoxGeometry(0.52, 0.62, 0.36, 2, 0.05);
  const uvA = mg.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * 0.17, uvA.getY(i) * 0.2);
  mg.setAttribute('aH', new THREE.Float32BufferAttribute(new Float32Array(mg.attributes.position.count).fill(3.5), 1));
  const list = [];
  let nextS = 0;
  for (const p of path) if (p.s >= nextS) { list.push(p); nextS = p.s + 0.92; }
  const merlons = new THREE.InstancedMesh(mg, brick, list.length * 2);
  const o = new THREE.Object3D();
  list.forEach((p, i) => {
    for (const side of [0, 1]) {
      const a = side ? 1.40 : -1.40, hb = side ? 3.8 : 3.6;
      o.position.set(p.x + p.ax * a, p.y + hb + 0.28, p.z + p.az * a);
      o.rotation.set(0, Math.atan2(-p.tz, p.tx), 0);
      o.updateMatrix(); merlons.setMatrixAt(i * 2 + side, o.matrix);
    }
  });
  merlons.castShadow = merlons.receiveShadow = true;
  group.add(merlons);
  return path;
}

// watchtower with arched windows; some get a pavilion roof
const TOWERS = [-42, -6, 34, 75, 112, 155, 192, 228, 265, 300, 338, 372, 406, 448];
const PAVILIONS = new Set([-42, 75, 155, 228, 300, 448]);
function pavilionRoof() {
  // concave hip roof with upturned eaves
  const g = new THREE.BufferGeometry();
  const N = 10; const pos = []; const idx = [];
  const size = 3.1, h = 3.0;
  for (let side = 0; side < 4; side++) {
    const base = pos.length / 3;
    for (let j = 0; j <= N; j++) {
      const v = j / N; // 0 eave -> 1 ridge
      const half = size * (1 - v * 0.92);
      const lift = Math.pow(1 - v, 4) * 0.45;
      for (let i = 0; i <= N; i++) {
        const u = i / N * 2 - 1;
        const corner = Math.pow(Math.abs(u), 6) * 0.6 * (1 - v);
        const y = h * Math.pow(v, 1.6) + lift + corner;
        let x = u * half, z = half;
        const c = Math.cos(side * Math.PI / 2), s = Math.sin(side * Math.PI / 2);
        pos.push(x * c + z * s, y, -x * s + z * c);
      }
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = base + j * (N + 1) + i, b = a + 1, c2 = a + N + 1, d = c2 + 1;
      idx.push(a, b, c2, b, d, c2);
    }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function buildTowers(group, path, dusk) {
  const brick = wallMaterial('bricks');
  const blocks = wallMaterial('blocks');
  const dark = std({ color: 0x1a1410, roughness: 0.9 }, 'dark');
  const roofMat = std({ color: 0x3b3a3e, roughness: 0.55, metalness: 0.1 }, 'roof');
  const pillarMat = std({ color: 0x8c2a1e, roughness: 0.6 }, 'pillar');
  const lantern = glowMaterial('#ffb35c', 0.0, 'lantern');
  dusk.lanterns = lantern;
  const winShape = new THREE.Shape();
  winShape.moveTo(-0.38, 0); winShape.lineTo(0.38, 0); winShape.lineTo(0.38, 0.75); winShape.absarc(0, 0.75, 0.38, 0, Math.PI, false); winShape.lineTo(-0.38, 0);
  const winGeo = new THREE.ExtrudeGeometry(winShape, { depth: 0.08, bevelEnabled: false });
  const glowGeo = new THREE.ShapeGeometry(winShape);
  const towers = [];
  for (const tx of TOWERS) {
    const p = path.reduce((best, q) => (Math.abs(q.x - tx) < Math.abs(best.x - tx) ? q : best), path[0]);
    const big = tx === -42 || tx === 448;
    const W = big ? 7.5 : 5.4, D = big ? 6.6 : 5.0, H = big ? 8.6 : 7.0;
    const t = new THREE.Group();
    t.position.set(p.x, p.y, p.z);
    t.rotation.y = Math.atan2(-p.tz, p.tx);
    const bodyG = new RoundedBoxGeometry(W, H + 4, D, 2, 0.12);
    const uvA = bodyG.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * W / 3.2, uvA.getY(i) * (H + 4) / 3.2);
    const hA = new Float32Array(bodyG.attributes.position.count); for (let i = 0; i < hA.length; i++) hA[i] = bodyG.attributes.position.getY(i) + (H + 4) / 2 - 4;
    bodyG.setAttribute('aH', new THREE.BufferAttribute(hA, 1));
    const body = new THREE.Mesh(bodyG, brick); body.position.y = (H + 4) / 2 - 4; body.castShadow = body.receiveShadow = true; t.add(body);
    // plinth of big stone blocks
    const plG = new RoundedBoxGeometry(W + 0.4, 5.4, D + 0.4, 2, 0.1);
    const uvP = plG.attributes.uv; for (let i = 0; i < uvP.count; i++) uvP.setXY(i, uvP.getX(i) * (W + 0.4) / 2.4, uvP.getY(i) * 5.4 / 2.4);
    plG.setAttribute('aH', new THREE.BufferAttribute(new Float32Array(plG.attributes.position.count).map((_, i) => plG.attributes.position.getY(i) + 2.7 - 4), 1));
    const pl = new THREE.Mesh(plG, blocks); pl.position.y = -1.3; pl.castShadow = pl.receiveShadow = true; t.add(pl);
    // arched windows front & back (dark recess + warm lantern glow at dusk)
    for (const side of [1, -1]) for (const wx of (big ? [-2.2, 0, 2.2] : [-1.3, 1.3])) {
      const w = new THREE.Mesh(winGeo, dark); w.position.set(wx, H - 3.2, side * (D / 2 + 0.01) - (side > 0 ? 0.07 : -0.07)); if (side < 0) w.rotation.y = Math.PI; t.add(w);
      const gl = new THREE.Mesh(glowGeo, lantern); gl.scale.setScalar(0.7); gl.position.set(wx, H - 3.05, side * (D / 2 + 0.03)); if (side < 0) gl.rotation.y = Math.PI; t.add(gl);
    }
    // crenellated top
    const mg = new RoundedBoxGeometry(0.6, 0.7, 0.42, 2, 0.05);
    mg.setAttribute('aH', new THREE.Float32BufferAttribute(new Float32Array(mg.attributes.position.count).fill(H), 1));
    const ring = [];
    for (let i = 0; i < 6; i++) { const u = -W / 2 + 0.35 + i * (W - 0.7) / 5; ring.push([u, D / 2 - 0.21, 0], [u, -D / 2 + 0.21, 0]); }
    for (let i = 1; i < 5; i++) { const v = -D / 2 + 0.35 + i * (D - 0.7) / 5; ring.push([W / 2 - 0.21, v, 1], [-W / 2 + 0.21, v, 1]); }
    const im = new THREE.InstancedMesh(mg, brick, ring.length);
    const o = new THREE.Object3D();
    ring.forEach(([a, b, r], i) => { o.position.set(a, H + 0.35, b); o.rotation.set(0, r ? Math.PI / 2 : 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    im.castShadow = true; t.add(im);
    if (PAVILIONS.has(tx)) {
      const pv = new THREE.Group(); pv.position.y = H;
      const pg = new THREE.CylinderGeometry(0.16, 0.18, 2.2, 10);
      for (const [a, b] of [[-1.5, -1.3], [1.5, -1.3], [-1.5, 1.3], [1.5, 1.3]]) { const c = new THREE.Mesh(pg, pillarMat); c.position.set(a, 1.1, b); c.castShadow = true; pv.add(c); }
      const roof = new THREE.Mesh(pavilionRoof(), roofMat); roof.position.y = 2.05; roof.scale.set(big ? 1.25 : 0.9, 1, big ? 1.1 : 0.82); roof.castShadow = true; pv.add(roof);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), std({ color: 0xc89a3a, metalness: 0.8, roughness: 0.3 }, 'gold')); tip.position.y = 5.2; pv.add(tip);
      t.add(pv);
    }
    group.add(t);
    towers.push({ x: tx, obj: t, top: p.y + H });
  }
  return towers;
}

function buildTrees(group) {
  const r = rng(77);
  const canopyParts = [];
  const b1 = new THREE.SphereGeometry(1.0, 22, 16); b1.translate(0, 2.3, 0);
  const b2 = new THREE.SphereGeometry(0.75, 18, 12); b2.translate(0.55, 1.75, 0.2);
  const b3 = new THREE.SphereGeometry(0.7, 18, 12); b3.translate(-0.5, 1.85, -0.25);
  canopyParts.push(b1, b2, b3);
  const canopyG = mergeGeometries(canopyParts);
  // lumpy canopy
  const cp = canopyG.attributes.position;
  for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i); const k = 1 + (fbm2(x * 1.6 + 5, z * 1.6 + y, 2) - 0.5) * 0.18; cp.setXYZ(i, x * k, y * (0.96 + 0.08 * k), z * k); }
  canopyG.computeVertexNormals();
  const trunkG = new THREE.CylinderGeometry(0.11, 0.17, 1.8, 7); trunkG.translate(0, 0.9, 0);
  const canMat = std({ color: 0xffffff, roughness: 0.85 }, 'canopy');
  const trunkMat = std({ color: 0x5a4030, roughness: 0.9 }, 'trunk');
  const spots = [];
  let tries = 0;
  while (spots.length < 1400 && tries < 40000) {
    tries++;
    const far = r() < 0.35;
    const x = lerp(-120, 520, r());
    const z = far ? lerp(-150, -40, r()) : lerp(-40, -2.2, r());
    const wz = GEO.wallZ(x);
    if (Math.abs(z - wz) < 4.2) continue;
    if (x > -72 && x < 16 && z > -17) continue;          // valley work area + parking row
    if (x > 392 && x < 432 && z > -14) continue;         // end valley (station area)
    const h = GEO.terrainH(x, z);
    const hx = GEO.terrainH(x + 0.5, z) - h, hz = GEO.terrainH(x, z + 0.5) - h;
    const slope = Math.hypot(hx, hz) / 0.5;
    if (slope > 1.1) continue;
    if (fbm2(x * 0.03, z * 0.03, 3) < 0.42) continue;     // clumps
    if (z > -3.2 && r() < 0.7) continue;
    spots.push({ x, z, y: h, s: (far ? 1.6 : 1.0) * lerp(0.75, 1.35, r()), rot: r() * 6.28, c: r() });
  }
  const can = new THREE.InstancedMesh(canopyG, canMat, spots.length);
  const tr = new THREE.InstancedMesh(trunkG, trunkMat, spots.length);
  const o = new THREE.Object3D(); const col = new THREE.Color();
  spots.forEach((s, i) => {
    o.position.set(s.x, s.y - 0.15, s.z); o.rotation.set(0, s.rot, 0); o.scale.set(s.s, s.s * lerp(0.9, 1.25, s.c), s.s); o.updateMatrix();
    can.setMatrixAt(i, o.matrix); tr.setMatrixAt(i, o.matrix);
    col.setHSL(lerp(0.22, 0.31, s.c), lerp(0.45, 0.62, (s.c * 7.3) % 1), lerp(0.2, 0.32, (s.c * 3.1) % 1));
    can.setColorAt(i, col);
  });
  can.castShadow = tr.castShadow = true; can.receiveShadow = true;
  group.add(can, tr);
}

function buildBoulders(group) {
  const r = rng(91);
  const g = new THREE.DodecahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 0.8 + fbm2(x * 1.7 + 3, y * 1.7 + z, 2) * 0.45; p.setXYZ(i, x * k, y * k * 0.75, z * k); }
  g.computeVertexNormals();
  const m = std({ color: 0x9a9184, roughness: 0.9, map: tex('rock_albedo', { srgb: true }), normalMap: tex('rock_normal') }, 'boulder');
  const list = [];
  for (let i = 0; i < 400 && list.length < 220; i++) {
    const x = lerp(-60, 470, r()), z = lerp(-60, -2.5, r());
    if (Math.abs(z - GEO.wallZ(x)) < 3.5) continue;
    if (x > -72 && x < 16 && z > -17) continue;
    list.push({ x, z, y: GEO.terrainH(x, z), s: lerp(0.25, 0.9, r() ** 2), rot: r() * 6 });
  }
  const im = new THREE.InstancedMesh(g, m, list.length);
  const o = new THREE.Object3D();
  list.forEach((b, i) => { o.position.set(b.x, b.y, b.z); o.rotation.set(b.rot, b.rot * 2, 0); o.scale.setScalar(b.s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  im.castShadow = im.receiveShadow = true;
  group.add(im);
}

// sky dome: gradient + sun + glowing clouds; colours driven by uniforms
export function buildSky() {
  const U = {
    uSunDir: G.uSunDir,
    uZenith: { value: new THREE.Color('#3f6fa8') },
    uHorizon: { value: new THREE.Color('#f6b27a') },
    uSunCol: { value: new THREE.Color('#ffd08a') },
    uGlow: { value: 1.0 },
    tNoise: { value: tex('noise_rgba') },
    uBelow: { value: new THREE.Color('#6b5a54') },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 uSunDir, uZenith, uHorizon, uSunCol, uBelow; uniform float uGlow; uniform sampler2D tNoise; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float e = d.y;
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(clamp(e, 0.0, 1.0), 0.55));
        col = mix(col, uHorizon * 1.15, pow(sd, 3.0) * 0.6 * (1.0 - clamp(e*1.5,0.0,1.0)));
        // haze band near the horizon
        col = mix(col, uHorizon*1.08, exp(-abs(e)*18.0)*0.55);
        // clouds: thin lit streaks
        vec2 cuv = d.xz / max(d.y + 0.08, 0.02) * 0.07;
        float c = texture2D(tNoise, cuv * vec2(0.6, 1.4) + vec2(0.13, 0.4)).g;
        float c2 = texture2D(tNoise, cuv * vec2(1.3, 3.2) + vec2(0.7, 0.1)).b;
        float cloud = smoothstep(0.52, 0.72, c * 0.75 + c2 * 0.4) * smoothstep(0.0, 0.12, e) * (1.0 - smoothstep(0.35, 0.8, e));
        vec3 cloudCol = mix(vec3(1.0, 0.72, 0.62), vec3(1.25, 0.85, 0.55), pow(sd, 2.0)) * mix(0.85, 1.25, pow(sd, 4.0));
        col = mix(col, cloudCol * mix(uHorizon, vec3(1.0), 0.3) * 1.15, cloud * 0.75);
        // sun disc + glow
        col += uSunCol * (pow(sd, 900.0) * 12.0 + pow(sd, 60.0) * 0.9 * uGlow + pow(sd, 8.0) * 0.25 * uGlow);
        // below the horizon: warm dark haze
        col = mix(col, uBelow, smoothstep(0.0, -0.25, e));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  sky.userData.U = U;
  return sky;
}

function buildFarRanges(group) {
  const layers = [
    { z: -520, h: 70, amp: 90, col: '#7c8aa0', seed: 1 },
    { z: -760, h: 90, amp: 130, col: '#8f9ab0', seed: 2 },
    { z: -1100, h: 120, amp: 170, col: '#a3a9bc', seed: 3 },
  ];
  for (const L of layers) {
    const pos = [], idx = [];
    const xs = []; for (let x = -1800; x <= 2600; x += 8) xs.push(x);
    xs.forEach((x, i) => {
      const n = fbm2(x * 0.004 + L.seed * 10, L.seed, 5);
      const peak = Math.pow(n, 1.6) * L.amp + L.h * 0.3;
      pos.push(x, -60, L.z, x, peak, L.z + (fbm2(x * 0.01, L.seed + 3, 2) - 0.5) * 60);
      if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = std({ color: L.col, roughness: 1 }, 'far');
    group.add(new THREE.Mesh(g, m));
  }
}

export function buildWorld(scene, profileTex) {
  const group = new THREE.Group();
  scene.add(group);
  const range = [GEO.X_MIN, GEO.X_MAX];

  const terrain = new THREE.Mesh(terrainGeometry(), terrainMaterial());
  terrain.receiveShadow = true; terrain.castShadow = true;
  group.add(terrain);

  const cutMat = earthMaterial(profileTex, range, { key: 'cut', openings: true });
  const cut = new THREE.Mesh(cutFaceGeometry(), cutMat);
  cut.receiveShadow = true;
  group.add(cut);

  // rounded grassy lip along the top edge of the slice (the "cake frosting" edge)
  // split the lip where the edge jumps (the dug notch at the portal) so it never crosses the opening
  const lipMat = std({ color: 0x4f7a2b, roughness: 0.9, map: tex('grass_albedo', { srgb: true }) }, 'lip');
  const runs = [[]];
  let prevY = null;
  for (let x = -240; x <= 700; x += 0.6) {
    const y = GEO.surfaceCut(x) - 0.06;
    if (prevY !== null && Math.abs(y - prevY) > 1.2) runs.push([]);
    runs[runs.length - 1].push(new THREE.Vector3(x, y, -0.08)); prevY = y;
  }
  for (const pts of runs) if (pts.length > 3) {
    const lip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.13, 6, false), lipMat);
    lip.receiveShadow = true; group.add(lip);
  }

  const path = buildWall(group);
  const dusk = {};
  const towers = buildTowers(group, path, dusk);
  buildTrees(group);
  buildBoulders(group);
  buildFarRanges(group);

  const sky = buildSky();
  scene.add(sky);

  return { group, terrain, cut, cutMat, wallPath: path, towers, sky, dusk };
}
