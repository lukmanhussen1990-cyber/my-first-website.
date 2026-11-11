// The prehistoric world: sky, clouds, mountains, hills, grass, sand clearing, rocks, huts, trees.
import * as THREE from 'three';
import { V3, clamp, lerp, rng, fbm, noise3, canvasTex, noiseFill, blobGeo, mesh, group, std, TAU, tube, curvePts, loft } from './util.js';

// ---------- procedural textures (all drawn in code) ----------
function specks(g, w, h, n, cols, r0, r1, seed, alpha = 1) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.4 + 0.6 * R()); g.fillStyle = cols[(R() * cols.length) | 0];
    const x = R() * w, y = R() * h, r = lerp(r0, r1, R() * R());
    g.beginPath(); g.ellipse(x, y, r, r * (0.6 + 0.6 * R()), R() * 3, 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
}
function strokes(g, w, h, n, cols, len0, len1, lw, seed, angle = Math.PI / 2, spread = 0.25, alpha = 0.6) {
  const R = rng(seed); g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.3 + 0.7 * R()); g.strokeStyle = cols[(R() * cols.length) | 0]; g.lineWidth = lw * (0.5 + R());
    const x = R() * w, y = R() * h, a = angle + (R() - 0.5) * spread, l = lerp(len0, len1, R());
    for (const ox of [0, -w, w]) for (const oy of [0, -h, h]) {
      if (ox && (x > l && x < w - l)) continue; if (oy && (y > l && y < h - l)) continue;
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke();
    }
  }
  g.globalAlpha = 1;
}
export const TEX = {};
export function makeTextures() {
  TEX.grass = canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, '#4aa82f', '#74c94a', 5, 4, 1);
    strokes(g, w, h, 2600, ['#3d9426', '#8ad85e', '#5cbb3a', '#2f8520'], 4, 11, 1.4, 2, -Math.PI / 2, 0.9, 0.55);
  });
  TEX.sand = canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, '#c2b094', '#a99579', 4, 4, 3);
    specks(g, w, h, 900, ['#6f604c', '#857560', '#5a4d3d'], 0.7, 2.4, 4, 0.8);
    specks(g, w, h, 500, ['#d8c9ae', '#cdbd9f'], 0.8, 3, 5, 0.6);
  });
  TEX.rock = canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, '#93806a', '#6d5d4d', 3, 5, 6);
    strokes(g, w, h, 1400, ['#5b4c3e', '#a8957c', '#7d6a57'], 14, 46, 2.2, 7, 0.5, 2.2, 0.28);
    specks(g, w, h, 700, ['#4a3d31', '#3f342a'], 0.8, 2.6, 8, 0.75);
  });
  TEX.rockWarm = canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, '#a9805a', '#8a6645', 3, 5, 16);
    strokes(g, w, h, 1500, ['#6e4f33', '#c09a70', '#96704c'], 14, 50, 2.2, 17, 0.4, 2.4, 0.3);
    specks(g, w, h, 600, ['#5a3f29', '#4b3421'], 0.8, 2.4, 18, 0.7);
  });
  TEX.thatch = canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, '#d9b455', '#c39a3c', 6, 3, 9);
    strokes(g, w, h, 5200, ['#f0d27a', '#a87f2a', '#e3c062', '#8f6a1f', '#f7e19a'], 22, 70, 1.8, 10, Math.PI / 2, 0.22, 0.7);
    // horizontal layer shadows
    for (let i = 0; i < 4; i++) { const y = (i + 0.5) / 4 * h; const gr = g.createLinearGradient(0, y - 18, 0, y + 14); gr.addColorStop(0, 'rgba(90,60,10,0)'); gr.addColorStop(0.55, 'rgba(90,60,10,0.55)'); gr.addColorStop(0.6, 'rgba(255,240,180,0.25)'); gr.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = gr; g.fillRect(0, y - 18, w, 32); }
  });
  TEX.mud = canvasTex(256, 256, (g, w, h) => {
    noiseFill(g, w, h, '#9a7650', '#7f5f3f', 4, 4, 11);
    strokes(g, w, h, 500, ['#6b4e32', '#b08a60'], 8, 30, 2, 12, 0, 0.6, 0.3);
    specks(g, w, h, 200, ['#5e442c'], 0.8, 2, 13, 0.6);
  });
  TEX.bark = canvasTex(256, 256, (g, w, h) => {
    noiseFill(g, w, h, '#6e4e31', '#54391f', 4, 3, 14);
    strokes(g, w, h, 700, ['#3d2814', '#8a6642'], 30, 90, 2.4, 15, Math.PI / 2, 0.12, 0.5);
  });
  TEX.leaf = canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, '#3f8f2c', '#62b53f', 5, 4, 19);
    specks(g, w, h, 2600, ['#7fd052', '#4c9c33', '#2f7a22', '#93dd66', '#3a8829'], 2.5, 7, 20, 0.85);
  });
  TEX.wood = canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, '#9a6a3c', '#7d5229', 3, 3, 21);
    strokes(g, w, h, 900, ['#5f3c1b', '#b98a55', '#6e4722'], 60, 200, 1.6, 22, Math.PI / 2, 0.05, 0.5);
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(40,22,8,0.75)'; g.fillRect(i * w / 5 - 2, 0, 4, h); g.fillStyle = 'rgba(255,220,170,0.18)'; g.fillRect(i * w / 5 + 3, 0, 2, h); }
    specks(g, w, h, 9, ['#4a2e14'], 5, 9, 23, 0.8);
  });
  TEX.stone = canvasTex(512, 512, (g, w, h) => {            // stacked stone blocks
    noiseFill(g, w, h, '#a39b8e', '#857d72', 4, 4, 24);
    const R = rng(25); const rows = 6;
    for (let r = 0; r < rows; r++) {
      const y0 = r * h / rows; let x = -R() * 60;
      while (x < w) {
        const bw = 70 + R() * 70; const sh = 0.86 + R() * 0.26;
        g.fillStyle = `rgba(${sh > 1 ? 255 : 0},${sh > 1 ? 250 : 0},${sh > 1 ? 235 : 0},${Math.abs(sh - 1) * 0.9})`;
        rr(g, x + 3, y0 + 3, bw - 6, h / rows - 6, 9); g.fill();
        g.strokeStyle = 'rgba(48,42,36,0.9)'; g.lineWidth = 5; rr(g, x + 2, y0 + 2, bw - 4, h / rows - 4, 10); g.stroke();
        g.strokeStyle = 'rgba(255,250,240,0.22)'; g.lineWidth = 2; rr(g, x + 6, y0 + 6, bw - 12, h / rows - 12, 7); g.stroke();
        x += bw;
      }
    }
    specks(g, w, h, 500, ['#5d564d', '#c4bcae'], 0.7, 2.2, 26, 0.5);
  });
  TEX.soil = canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, '#7a5133', '#5b3a22', 4, 5, 27);
    specks(g, w, h, 500, ['#3f2815', '#93684a', '#4c3320'], 1, 4, 28, 0.7);
    specks(g, w, h, 26, ['#9c9488', '#7f786d', '#b3aa9c'], 6, 15, 29, 1);
  });
  TEX.fur = canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, '#7a4a25', '#5e3618', 4, 4, 30);
    strokes(g, w, h, 5000, ['#3f220c', '#9a6537', '#6b3f1c', '#b17a46'], 18, 60, 2.0, 31, Math.PI / 2, 0.35, 0.6);
  });
  TEX.bamboo = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#8fae3c'); gr.addColorStop(0.35, '#c9d868'); gr.addColorStop(0.7, '#9bb944'); gr.addColorStop(1, '#8fae3c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    strokes(g, w, h, 300, ['#6f8e2a', '#dfe88a'], 40, 120, 1.4, 32, Math.PI / 2, 0.03, 0.35);
    for (const y of [0, h / 2]) { g.fillStyle = '#5d7a22'; g.fillRect(0, y + 4, w, 9); g.fillStyle = '#dbe58a'; g.fillRect(0, y + 13, w, 4); g.fillStyle = '#a8c050'; g.fillRect(0, y - 2, w, 6); }
  });
  for (const k in TEX) TEX[k].name = k;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

export const MAT = {};
export function makeMaterials() {
  const t = (tex, rx, ry) => { const c = tex.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };
  MAT.grass = new THREE.MeshStandardMaterial({ map: t(TEX.grass, 220, 220), roughness: 1 });
  MAT.sand = new THREE.MeshStandardMaterial({ map: t(TEX.sand, 7, 7), roughness: 1 });
  MAT.rock = new THREE.MeshStandardMaterial({ map: t(TEX.rock, 2, 2), roughness: 0.95 });
  MAT.rockWarm = new THREE.MeshStandardMaterial({ map: t(TEX.rockWarm, 2, 2), roughness: 0.95 });
  MAT.pebble = new THREE.MeshStandardMaterial({ map: t(TEX.rock, 1, 1), roughness: 0.95 });
  MAT.thatch = new THREE.MeshStandardMaterial({ map: t(TEX.thatch, 5, 1), roughness: 1 });
  MAT.mud = new THREE.MeshStandardMaterial({ map: t(TEX.mud, 4, 1), roughness: 1 });
  MAT.bark = new THREE.MeshStandardMaterial({ map: t(TEX.bark, 2, 2), roughness: 1 });
  MAT.leaf = new THREE.MeshStandardMaterial({ map: t(TEX.leaf, 2, 2), roughness: 1 });
  MAT.pine = new THREE.MeshStandardMaterial({ color: 0x2f7350, roughness: 1, flatShading: true });
  MAT.wood = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 0.85 });
  MAT.woodDark = new THREE.MeshStandardMaterial({ color: 0x4d321a, roughness: 0.9 });
  MAT.stone = new THREE.MeshStandardMaterial({ map: TEX.stone, roughness: 0.95 });
  MAT.stoneFlat = new THREE.MeshStandardMaterial({ map: t(TEX.rock, 1, 1), color: 0xcfc8bd, roughness: 0.95 });
  MAT.soil = new THREE.MeshStandardMaterial({ map: TEX.soil, roughness: 1 });
  MAT.dark = new THREE.MeshStandardMaterial({ color: 0x1b130c, roughness: 1 });
  MAT.fur = new THREE.MeshStandardMaterial({ map: TEX.fur, roughness: 1 });
  MAT.bamboo = new THREE.MeshStandardMaterial({ map: TEX.bamboo, roughness: 0.55 });
}

// ---------- sky + clouds + mountains (re-centred on each set) ----------
export function buildBackdrop() {
  const g = new THREE.Group(); g.name = 'backdrop';
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#1f63d6') }, mid: { value: new THREE.Color('#4f95ee') }, hor: { value: new THREE.Color('#b9dcfb') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top, mid, hor;
      void main(){ float h = clamp(vP.y, -0.1, 1.0); vec3 c = mix(hor, mid, smoothstep(0.0, 0.28, h)); c = mix(c, top, smoothstep(0.25, 0.85, h));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -10; g.add(sky);

  // puffy cumulus: clusters of soft white spheres with flat-ish bottoms
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xdfe9f7, emissiveIntensity: 0.62, fog: false });
  const sph = new THREE.SphereGeometry(1, 20, 14);
  const R = rng(77); const clouds = new THREE.Group(); clouds.name = 'clouds';
  const N = 26;
  for (let i = 0; i < N; i++) {
    const c = new THREE.Group();
    const az = (i / N) * TAU + (R() - 0.5) * 0.3, dist = 330 + R() * 330, alt = 95 + R() * 190;
    const size = 16 + R() * 22; const puffs = 9 + (R() * 8 | 0);
    for (let k = 0; k < puffs; k++) {
      const u = (k / (puffs - 1)) * 2 - 1; const r = size * (0.42 + 0.58 * (1 - u * u)) * (0.7 + 0.5 * R());
      const m = new THREE.Mesh(sph, cloudMat);
      m.position.set(u * size * 1.7 + (R() - 0.5) * size * 0.5, r * 0.55 + (R() - 0.3) * size * 0.28, (R() - 0.5) * size * 0.9);
      m.scale.set(r, r * 0.82, r); c.add(m);
    }
    // flat base
    const base = new THREE.Mesh(sph, cloudMat); base.scale.set(size * 1.75, size * 0.36, size * 0.95); base.position.y = size * 0.1; c.add(base);
    c.position.set(Math.sin(az) * dist, alt, Math.cos(az) * dist); c.lookAt(0, alt * 0.6, 0);
    c.userData.az = az; c.userData.dist = dist; c.userData.alt = alt;
    clouds.add(c);
  }
  g.add(clouds); g.userData.clouds = clouds;

  // mountains: faceted peaks with snow caps
  const mts = [
    { az: 180, d: 330, r: 135, h: 215, s: 1 }, { az: 205, d: 420, r: 160, h: 190, s: 2 }, { az: 152, d: 400, r: 150, h: 170, s: 3 },
    { az: 128, d: 470, r: 170, h: 200, s: 4 }, { az: 232, d: 480, r: 180, h: 215, s: 5 }, { az: 96, d: 520, r: 170, h: 175, s: 6 },
    { az: 265, d: 520, r: 170, h: 185, s: 7 }, { az: 60, d: 500, r: 160, h: 165, s: 8 }, { az: 300, d: 520, r: 175, h: 190, s: 9 },
    { az: 25, d: 470, r: 160, h: 175, s: 10 }, { az: 335, d: 500, r: 170, h: 185, s: 11 }, { az: 0, d: 560, r: 190, h: 205, s: 12 },
  ];
  const mtMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
  for (const m of mts) {
    const a = m.az * Math.PI / 180;
    const mm = new THREE.Mesh(mountainGeo(m.r, m.h, m.s), mtMat); mm.position.set(Math.sin(a) * m.d, -6, Math.cos(a) * m.d); mm.rotation.y = m.s * 1.3; g.add(mm);
  }
  // rolling green foothills with cone pines
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x5f9f52, roughness: 1 });
  const hillMat2 = new THREE.MeshStandardMaterial({ color: 0x6fb058, roughness: 1 });
  const pineGeo = new THREE.ConeGeometry(1, 2.6, 6); pineGeo.translate(0, 1.3, 0);
  const RH = rng(5);
  for (let i = 0; i < 30; i++) {
    const az = (i / 30) * TAU + RH() * 0.2, d = 120 + RH() * 150; const rad = 50 + RH() * 60, hh = 14 + RH() * 26 + (d - 120) * 0.1;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI / 2), RH() > 0.5 ? hillMat : hillMat2);
    hill.scale.set(rad, hh, rad * (0.7 + RH() * 0.5)); hill.position.set(Math.sin(az) * d, -1.5, Math.cos(az) * d); hill.rotation.y = RH() * 3;
    g.add(hill);
    const np = 5 + (RH() * 9 | 0);
    for (let k = 0; k < np; k++) {
      const a2 = RH() * TAU, rr2 = Math.sqrt(RH()) * 0.8; const lx = Math.cos(a2) * rr2, lz = Math.sin(a2) * rr2;
      const ly = Math.sqrt(Math.max(0, 1 - lx * lx - lz * lz));
      const p = new THREE.Mesh(pineGeo, MAT.pine); const s = 3 + RH() * 4.5;
      const wp = V3(lx, ly, lz).multiply(hill.scale).applyEuler(hill.rotation).add(hill.position);
      p.position.copy(wp); p.position.y -= 0.6; p.scale.set(s, s * (1.1 + RH() * 0.7), s); g.add(p);
    }
  }
  return g;
}
function mountainGeo(rad, h, seed) {
  const g0 = new THREE.ConeGeometry(rad, h, 18, 10, true).toNonIndexed();
  const p = g0.attributes.position; const col = new Float32Array(p.count * 3); const v = V3();
  const snow = new THREE.Color('#f4f8ff'), snow2 = new THREE.Color('#c9d6ee'), rockC = new THREE.Color('#8793ad'), rock2 = new THREE.Color('#6f7b98'), green = new THREE.Color('#5c9a55'), green2 = new THREE.Color('#4c8749');
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const hn = (v.y + h / 2) / h; const ang = Math.atan2(v.z, v.x);
    const ridge = 1 + 0.22 * Math.sin(ang * 5 + seed) * (1 - hn) + 0.3 * fbm(Math.cos(ang) * 2 + seed, hn * 3, Math.sin(ang) * 2, 3) * (1 - hn * 0.7);
    const lean = 0.12 * rad * hn * hn;
    p.setXYZ(i, v.x * ridge + lean * Math.cos(seed), v.y + h / 2 + (hn < 0.99 ? 6 * noise3(v.x * 0.03, seed, v.z * 0.03) * (1 - hn) : 0), v.z * ridge + lean * Math.sin(seed));
  }
  // per-face colours
  const c = new THREE.Color();
  for (let f = 0; f < p.count; f += 3) {
    let hy = 0; for (let k = 0; k < 3; k++) hy += p.getY(f + k); hy /= 3 * h;
    const n = hash(f + seed * 1000);
    const line = 0.52 + 0.1 * Math.sin(p.getX(f) * 0.05 + seed) + 0.06 * (n - 0.5);
    if (hy > line) c.copy(snow).lerp(snow2, n * 0.9);
    else if (hy > 0.2 + 0.05 * n) c.copy(rockC).lerp(rock2, n);
    else c.copy(green).lerp(green2, n);
    for (let k = 0; k < 3; k++) { col[(f + k) * 3] = c.r; col[(f + k) * 3 + 1] = c.g; col[(f + k) * 3 + 2] = c.b; }
  }
  g0.setAttribute('color', new THREE.BufferAttribute(col, 3)); g0.computeVertexNormals();
  return g0;
}
const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

// ---------- props for the village ----------
export function makeHut(seed = 1, s = 1) {
  const R = rng(seed + 100); const g = new THREE.Group();
  const wr = 1.55, wh = 1.75;
  const wall = mesh(new THREE.CylinderGeometry(wr, wr * 1.04, wh, 28, 1, true), MAT.mud, { pos: [0, wh / 2, 0] }); g.add(wall);
  // layered thatch roof
  const roofH = 1.9;
  const r1 = mesh(new THREE.ConeGeometry(wr * 1.5, roofH * 0.62, 28, 1, true), MAT.thatch, { pos: [0, wh + roofH * 0.25, 0] });
  const r2 = mesh(new THREE.ConeGeometry(wr * 1.12, roofH * 0.62, 28, 1, true), MAT.thatch, { pos: [0, wh + roofH * 0.55, 0] });
  const r3 = mesh(new THREE.ConeGeometry(wr * 0.66, roofH * 0.6, 28, 1), MAT.thatch, { pos: [0, wh + roofH * 0.9, 0] });
  for (const r of [r1, r2, r3]) { r.material = MAT.thatch; r.material.side = THREE.DoubleSide; g.add(r); }
  const knot = mesh(new THREE.SphereGeometry(0.13, 10, 8), MAT.thatch, { pos: [0, wh + roofH * 1.2, 0], scale: [1, 1.6, 1] }); g.add(knot);
  // doorway (dark recess + wooden frame)
  const door = mesh(new THREE.BoxGeometry(0.72, 1.3, 0.2), MAT.dark, { pos: [0, 0.65, wr - 0.04], cast: false }); g.add(door);
  for (const x of [-0.42, 0.42]) g.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.42, 8), MAT.bark, { pos: [x, 0.71, wr + 0.05] }));
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), MAT.bark, { pos: [0, 1.42, wr + 0.05], rot: [0, 0, Math.PI / 2] }));
  // little glowing window
  const win = mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), new THREE.MeshStandardMaterial({ color: 0xffc35a, emissive: 0xffb040, emissiveIntensity: 1.1 }), { pos: [Math.sin(0.95) * wr, 1.05, Math.cos(0.95) * wr], rot: [0, 0.95, 0], cast: false }); g.add(win);
  g.scale.setScalar(s * (0.92 + R() * 0.2));
  return g;
}
export function makeTree(seed = 1, s = 1) {
  const R = rng(seed + 300); const g = new THREE.Group();
  const th = 1.6 + R() * 0.9;
  const trunk = mesh(tube(curvePts([[0, 0, 0], [0.05 * (R() - 0.5), th * 0.5, 0.08 * (R() - 0.5)], [0.2 * (R() - 0.5), th, 0.2 * (R() - 0.5)]], 8), (u) => lerp(0.24, 0.13, u), 10), MAT.bark); g.add(trunk);
  const n = 6 + (R() * 4 | 0);
  for (let i = 0; i < n; i++) {
    const r = 0.75 + R() * 0.65; const a = R() * TAU, d = i === 0 ? 0 : 0.5 + R() * 0.75;
    const b = mesh(blobGeo(r, 2, seed * 10 + i, 0.22, 1.6), MAT.leaf, { pos: [Math.cos(a) * d, th + 0.5 + R() * 1.1, Math.sin(a) * d] });
    g.add(b);
  }
  g.scale.setScalar(s);
  return g;
}
export function makePine(seed = 1, s = 1) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 6), MAT.bark, { pos: [0, 0.35, 0] }));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.ConeGeometry(0.85 - i * 0.2, 1.3, 7), MAT.pine, { pos: [0, 1.1 + i * 0.75, 0], rot: [0, i * 0.5 + seed, 0] }));
  g.scale.setScalar(s);
  return g;
}
export function makeRock(r, seed, squash = [1, 0.8, 1], warm = false, detail = 3) {
  return mesh(blobGeo(r, detail, seed, 0.2, 1.3, squash), warm ? MAT.rockWarm : MAT.rock);
}

// ---------- main set ----------
export function buildMainSet() {
  const g = new THREE.Group(); g.name = 'mainSet';
  const ground = mesh(new THREE.CircleGeometry(900, 48), MAT.grass, { rot: [-Math.PI / 2, 0, 0], cast: false }); g.add(ground);
  // sand clearing (irregular blob)
  const shape = new THREE.Shape(); const NS = 72;
  for (let i = 0; i <= NS; i++) {
    const a = i / NS * TAU; const r = 10.5 + 2.0 * noise3(Math.cos(a) * 1.3, Math.sin(a) * 1.3, 4.2) + 1.0 * noise3(Math.cos(a) * 3.1, Math.sin(a) * 3.1, 1.2);
    const x = Math.cos(a) * r * 1.25 + 2.5, y = Math.sin(a) * r * 0.95 - 1.0;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const sandGeo = new THREE.ShapeGeometry(shape, 1);
  { const uv = sandGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 28, uv.getY(i) / 28); }
  const sand = mesh(sandGeo, MAT.sand, { rot: [-Math.PI / 2, 0, 0], pos: [0, 0.015, 0], cast: false }); g.add(sand);

  // THE big rock (scene 1) + rock wall behind the clearing
  const big = makeRock(1.75, 11, [1.25, 0.92, 0.85], true, 4); big.position.set(0.1, 1.15, -1.5); big.rotation.y = 0.4; g.add(big); g.userData.bigRock = big;
  g.add(makeRock(0.55, 12, [1.2, 0.7, 1], true).translateX(-2.1).translateY(0.25).translateZ(-1.0));
  g.add(makeRock(0.4, 13, [1, 0.7, 1.1], false).translateX(2.3).translateY(0.18).translateZ(-0.9));
  const R = rng(42);
  const wall = [
    [-9.5, -6.5, 2.4], [-6.2, -7.6, 3.0], [-2.6, -8.4, 2.7], [1.2, -8.8, 3.3], [5.0, -8.2, 2.8], [8.6, -7.0, 2.5], [11.5, -5.2, 2.0],
    [-7.8, -9.2, 2.2], [-0.8, -10.6, 2.9], [3.4, -10.8, 2.6], [7.2, -9.8, 2.3], [-4.6, -6.3, 1.5], [3.3, -6.4, 1.4], [-11.8, -4.4, 1.6],
  ];
  wall.forEach(([x, z, r], i) => {
    const k = makeRock(r, 20 + i, [1.15 + R() * 0.3, 0.75 + R() * 0.25, 1 + R() * 0.2], i % 3 === 0, 3);
    k.position.set(x, r * 0.45, z); k.rotation.y = R() * 6; g.add(k);
  });
  // stacked boulders for height
  [[-4.2, -8.6, 1.7, 3.3], [2.8, -9.6, 1.8, 3.8], [6.8, -8.9, 1.4, 3.0], [-8.4, -7.8, 1.3, 2.6]].forEach(([x, z, r, y], i) => {
    const k = makeRock(r, 60 + i, [1.2, 0.8, 1], i % 2 === 0); k.position.set(x, y, z); k.rotation.y = i * 1.7; g.add(k);
  });
  // scattered small rocks + pebbles
  for (let i = 0; i < 46; i++) {
    const a = R() * TAU, d = 2.5 + R() * 9; const x = Math.cos(a) * d * 1.2 + 2, z = Math.sin(a) * d * 0.9 - 0.5;
    if (Math.hypot(x - 0, z - 0.6) < 1.6 || Math.hypot(x + 3, z - 2.6) < 2.2 || Math.hypot(x - 9, z - 2.5) < 4.2) continue;
    const r = R() < 0.25 ? 0.22 + R() * 0.3 : 0.05 + R() * 0.1;
    const k = mesh(blobGeo(r, 1, 200 + i, 0.25, 1.4, [1.1, 0.7, 1]), MAT.pebble, { pos: [x, r * 0.35, z], rot: [0, R() * 6, 0] }); g.add(k);
  }
  // huts
  const huts = [[-13, -5.5, 0.6], [-17.5, -0.5, 1.1], [-14, 5.5, 1.5], [-20, -9, 0.4], [-8.5, -13.5, 0.2], [15.5, -9.5, -0.5], [19, -3, -1.0], [-22, 4.5, 1.3], [16, 8, -2.2]];
  huts.forEach(([x, z, ry], i) => { const h = makeHut(i + 1, 1.25); h.position.set(x, 0, z); h.rotation.y = ry; g.add(h); });
  // trees
  const trees = [[-10.5, -11, 1.5], [12.5, -11.5, 1.6], [-16, -13, 1.7], [9.5, -13, 1.3], [-18, 8.5, 1.5], [21, -9.5, 1.6], [-24, -3, 1.4], [-6, 14, 1.4], [8, 15, 1.5], [18, 13, 1.6], [-13, 16, 1.5], [1, 19, 1.4], [24, 4, 1.5], [-2, -14.5, 1.6], [14, 18.5, 1.3], [-20, 15, 1.6]];
  trees.forEach(([x, z, s], i) => { const t = makeTree(i + 3, s); t.position.set(x, 0, z); t.rotation.y = i * 2.1; g.add(t); });
  const RP = rng(9);
  for (let i = 0; i < 26; i++) { const a = RP() * TAU, d = 26 + RP() * 38; const p = makePine(i, 1.6 + RP() * 1.6); p.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); g.add(p); }
  // grass tufts on the border of the clearing
  const tuftGeo = new THREE.ConeGeometry(0.035, 0.34, 4); tuftGeo.translate(0, 0.17, 0);
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0x4f9e30, roughness: 1 });
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, 1500); const dm = new THREE.Object3D(); let ti = 0;
  const RT = rng(8);
  for (let i = 0; i < 300; i++) {
    const a = RT() * TAU, d = 9 + RT() * 12; const cx = Math.cos(a) * d * 1.25 + 2.5, cz = Math.sin(a) * d * 0.95 + 1.0;
    for (let k = 0; k < 5; k++) { dm.position.set(cx + (RT() - 0.5) * 0.22, 0, cz + (RT() - 0.5) * 0.22); dm.rotation.set((RT() - 0.5) * 0.7, RT() * 6, (RT() - 0.5) * 0.7); dm.scale.setScalar(0.7 + RT() * 0.9); dm.updateMatrix(); tufts.setMatrixAt(ti++, dm.matrix); }
  }
  tufts.count = ti; tufts.receiveShadow = true; g.add(tufts);
  return g;
}
