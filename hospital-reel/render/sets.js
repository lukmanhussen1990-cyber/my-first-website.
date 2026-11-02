// Sets for the hospital reel: modern clinic (inside + outside), 1970s sets, projector room, props.
import { THREE, PI, RNG, mat, box, cyl, noiseTex, C } from './world.js';
import { mergeGeometries } from './lib/BufferGeometryUtils.js';

export function gradientTex(stops) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256);
  for (const [p, col] of stops) g.addColorStop(p, col);
  x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData = { c, ctx }; return t;
}
const vc = (geo, col) => {
  const g = geo.toNonIndexed(); const c = new THREE.Color(col); const n = g.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
};
function tree(geos, x, z, s, rnd, cols = [0x3f8a3a, 0x4c9a43, 0x357a33], trunk = 0x6b4a2e) {
  const add = (w, h, d, px, py, pz, col, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(ry); g.translate(px, py, pz); geos.push(vc(g, col)); };
  add(0.4 * s, 2.4 * s, 0.4 * s, x, 1.2 * s, z, trunk);
  add(2.2 * s, 1.4 * s, 2.2 * s, x, 2.9 * s, z, cols[0], rnd());
  add(1.6 * s, 1.1 * s, 1.6 * s, x + 0.2 * s, 3.9 * s, z - 0.1 * s, cols[1], rnd());
  add(1.0 * s, 0.8 * s, 1.0 * s, x - 0.1 * s, 4.7 * s, z + 0.1 * s, cols[2], rnd());
}
const vcMat = () => new THREE.MeshLambertMaterial({ vertexColors: true, map: noiseTex(0xffffff, 0.1, 8, 21) });

export function makePlant(s = 1, seed = 1, pot = 0xf2efe8) {
  const g = new THREE.Group(); const r = RNG(seed);
  cyl(0.2 * s, 0.15 * s, 0.38 * s, 8, mat(pot), 0, 0.19 * s, 0, g);
  cyl(0.18 * s, 0.18 * s, 0.03 * s, 8, mat(0x5a3e2a), 0, 0.37 * s, 0, g);
  const leaves = new THREE.Group(); leaves.position.y = 0.37 * s; g.add(leaves);
  const L = [];
  for (let i = 0; i < 10; i++) {
    const lg = new THREE.Group(); lg.rotation.order = 'YXZ';
    const tilt = 0.25 + r() * 0.45; lg.rotation.set(tilt, i / 10 * PI * 2 + r() * 0.5, 0);
    const len = (0.45 + r() * 0.3) * s;
    box(0.13 * s, len, 0.035 * s, mat([0x3f8a3a, 0x4fa046, 0x2f7a33][i % 3]), 0, len / 2, 0, lg);
    leaves.add(lg); L.push({ lg, tilt });
  }
  g.userData = { leaves, L };
  return g;
}
export function plantState(p, wilt = 0, perk = 0) {
  for (const { lg, tilt } of p.userData.L) lg.rotation.x = tilt + wilt * 1.5 - perk * 0.2;
  p.userData.leaves.scale.set(1, 1 + perk * 0.25 - wilt * 0.2, 1);
}

function chair(parent, x, z, ry, col = 0x8cc7e8) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  box(0.5, 0.08, 0.48, mat(col), 0, 0.42, 0.02, g);
  box(0.5, 0.34, 0.06, mat(col), 0, 0.95, -0.24, g);
  for (const sx of [1, -1]) {
    box(0.04, 0.42, 0.04, mat(0x9aa2ab), 0.22 * sx, 0.21, 0.2, g); box(0.04, 0.42, 0.04, mat(0x9aa2ab), 0.22 * sx, 0.21, -0.18, g);
    box(0.04, 0.6, 0.04, mat(0x9aa2ab), 0.22 * sx, 0.72, -0.24, g);
  }
  return g;
}

// ============ modern clinic ============
export function buildClinic(scene) {
  const S = {};
  const G = S.group = new THREE.Group(); scene.add(G);
  const rnd = RNG(17);
  const white = mat(0xf4f5f6, { noise: 0.025 }), whiteOut = mat(0xf7f7f5, { noise: 0.03 });
  // outside ground
  const gt = noiseTex(C.grass, 0.12, 16, 9).clone(); gt.needsUpdate = true; gt.repeat.set(70, 70);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshLambertMaterial({ map: gt }));
  ground.rotation.x = -PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; G.add(ground);
  box(2.6, 0.03, 18, mat(0xd9d6cf, { noise: 0.05, size: 16 }), 0, 0.0, 14.2, G);
  box(18, 0.03, 4, mat(0xcfccc5, { noise: 0.05, size: 16 }), 0, 0.0, 7.2, G);
  // interior floor
  const ft = noiseTex(0xe7e9ea, 0.04, 16, 3).clone(); ft.needsUpdate = true; ft.repeat.set(6, 5);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.04, 10), new THREE.MeshLambertMaterial({ map: ft }));
  floor.position.set(0, 0.0, 0); floor.receiveShadow = true; G.add(floor);
  // walls
  box(12.4, 3.4, 0.2, mat(0xd6e8dc, { noise: 0.02 }), 0, 1.7, -5.1, G);           // back (sage)
  box(0.2, 3.4, 3.8, white, -6.1, 1.7, -3.1, G); box(0.2, 3.4, 3.8, white, -6.1, 1.7, 3.1, G);
  box(0.2, 0.8, 2.4, white, -6.1, 3.0, 0, G);                                       // hallway lintel
  box(0.2, 3.4, 10.4, white, 6.1, 1.7, 0, G);
  for (const z of [-2.2, 2.2]) box(0.03, 1.5, 2.2, mat(0xbfe4f7, { emissive: 0x6a9ab8, ei: 0.6 }), 5.99, 1.75, z, G, false);
  // ceiling + lights
  box(12.2, 0.12, 10.2, white, 0, 3.4, 0, G);
  for (let x = -4; x <= 4; x += 2.6) for (let z = -3; z <= 3; z += 3) box(1.2, 0.02, 0.6, mat(0xffffff, { emissive: 0xffffff, ei: 0.8 }), x, 3.33, z, G, false);
  // glass front with doors
  const glass = new THREE.MeshLambertMaterial({ color: 0xcfeaf7, transparent: true, opacity: 0.2, depthWrite: false });
  const frameM = mat(0x8d949c);
  for (const x of [-6, -3.6, -1.2, 1.2, 3.6, 6]) box(0.14, 3.4, 0.16, frameM, x, 1.7, 5.05, G);
  box(12.2, 0.16, 0.16, frameM, 0, 3.32, 5.05, G); box(12.2, 0.1, 0.16, frameM, 0, 0.05, 5.05, G);
  for (const x of [-4.8, -2.4, 2.4, 4.8]) { const m = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.2, 0.03), glass); m.position.set(x, 1.7, 5.05); G.add(m); }
  box(2.4, 0.12, 0.14, frameM, 0, 2.7, 5.05, G);
  const tr = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.55, 0.03), glass); tr.position.set(0, 3.0, 5.05); G.add(tr);
  S.doors = [];
  for (const sx of [-1, 1]) {
    const d = new THREE.Group(); G.add(d);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6, 0.03), glass); pane.position.y = 1.32; d.add(pane);
    box(1.14, 0.06, 0.06, frameM, 0, 2.62, 0, d); box(1.14, 0.06, 0.06, frameM, 0, 0.04, 0, d);
    box(0.06, 2.62, 0.06, frameM, 0.55 * sx, 1.33, 0, d); box(0.04, 0.5, 0.06, mat(0xc0c6cc), -0.4 * sx, 1.2, 0.06, d);
    d.userData.sx = sx; S.doors.push(d);
  }
  S.setDoors = (open) => { for (const d of S.doors) d.position.set(d.userData.sx * (0.56 + 1.05 * open), 0, 5.12); };
  S.setDoors(0);
  // upper floor, roof, canopy (outside look)
  box(12.4, 3.6, 10.4, whiteOut, 0, 5.3, 0, G);
  S.upWin = [];
  for (const x of [-4.8, -2.4, 0, 2.4, 4.8]) {
    const m = new THREE.MeshLambertMaterial({ color: 0x9fd2f0, emissive: 0x3a6a8a, emissiveIntensity: 0.5 });
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 0.05), m); w.position.set(x, 5.2, 5.21); G.add(w);
    box(1.75, 0.1, 0.12, frameM, x, 4.42, 5.22, G); S.upWin.push(w);
  }
  box(12.8, 0.25, 10.8, mat(0xa9aeb3), 0, 7.2, 0, G);
  box(4.4, 0.18, 2.4, mat(0xf2f2f0), 0, 3.6, 6.2, G);
  for (const sx of [-1, 1]) box(0.14, 3.5, 0.14, frameM, 2.0 * sx, 1.75, 7.25, G);
  // hallway wing
  const ht = noiseTex(0xe9ebec, 0.04, 16, 5).clone(); ht.needsUpdate = true; ht.repeat.set(15, 1);
  const hf = new THREE.Mesh(new THREE.BoxGeometry(30, 0.04, 2.4), new THREE.MeshLambertMaterial({ map: ht })); hf.position.set(-21, 0, 0); hf.receiveShadow = true; G.add(hf);
  box(30, 0.02, 0.18, mat(0x8cc7e8), -21, 0.025, 0, G);
  for (const sz of [-1, 1]) {
    box(30, 3.4, 0.2, white, -21, 1.7, 1.3 * sz, G);
    box(30, 0.05, 0.06, mat(0xc8ccd0), -21, 0.92, 1.16 * sz, G);
    for (let x = -9; x > -35; x -= 4) {
      box(1.0, 2.2, 0.05, mat(0xc89a66), x, 1.1, 1.18 * sz, G);
      box(0.08, 0.04, 0.06, mat(0xb0b4b8), x + 0.35, 1.05, 1.13 * sz, G);
    }
  }
  box(0.2, 3.4, 2.8, white, -36.1, 1.7, 0, G);
  box(0.03, 1.6, 1.6, mat(0xbfe4f7, { emissive: 0x9ac8e6, ei: 0.8 }), -35.98, 1.7, 0, G, false);
  box(30, 0.12, 2.8, white, -21, 3.4, 0, G);
  for (let x = -8; x > -36; x -= 3) box(0.8, 0.02, 0.5, mat(0xffffff, { emissive: 0xffffff, ei: 0.8 }), x, 3.33, 0, G, false);
  box(30.4, 0.25, 3.2, mat(0xa9aeb3), -21, 3.55, 0, G);
  // waiting room furniture
  S.chairs = {};
  for (const x of [-2.6, 0, 1.7, 2.5]) S.chairs[x] = chair(G, x, 0.6, PI);
  for (const z of [-1.8, -1.0, -0.2]) chair(G, 4.9, z, -PI / 2, 0x9ad0b0);
  // card table
  cyl(0.45, 0.45, 0.04, 12, mat(0xd9c3a0), -1.3, 0.72, 2.5, G); cyl(0.05, 0.05, 0.7, 6, mat(0x9aa2ab), -1.3, 0.36, 2.5, G);
  chair(G, -2.0, 2.5, PI / 2, 0x9ad0b0); chair(G, -0.6, 2.5, -PI / 2, 0x9ad0b0);
  for (let i = 0; i < 5; i++) box(0.07, 0.005, 0.1, mat(0xffffff), -1.45 + i * 0.08, 0.745, 2.55 + (i % 2) * 0.05, G);
  // reception desk
  const desk = S.desk = new THREE.Group(); desk.position.set(3.2, 0, -3.9); G.add(desk);
  box(3, 1.05, 0.7, mat(0xf7f7f7), 0, 0.525, 0, desk); box(3.04, 0.85, 0.04, mat(0xc89a66), 0, 0.5, 0.37, desk);
  box(3.12, 0.06, 0.82, mat(0xd9b48a), 0, 1.08, 0, desk);
  box(0.55, 0.36, 0.05, mat(0x1d1f22), 0.6, 1.4, -0.12, desk); box(0.06, 0.18, 0.06, mat(0x6a6f75), 0.6, 1.18, -0.12, desk);
  box(0.5, 0.31, 0.01, mat(0x5aa8d8, { emissive: 0x2a5a7a }), 0.6, 1.4, -0.09, desk, false);
  const dp = makePlant(0.45, 9); dp.position.set(-1.2, 1.1, -0.05); desk.add(dp);
  // wall art, clock, calendar spot
  const art = [[0xf2a65a, 0x5ab8b0], [0x8fc4e8, 0xf28c8c], [0xf6d365, 0x7bc67b]];
  [-1.4, 0.0].forEach((x, i) => {
    box(1.0, 0.75, 0.04, mat(0xffffff), x, 2.0, -4.98, G);
    box(0.45, 0.65, 0.02, mat(art[i][0]), x - 0.22, 2.0, -4.95, G); box(0.45, 0.65, 0.02, mat(art[i][1]), x + 0.22, 2.0, -4.95, G);
  });
  const clk = cyl(0.25, 0.25, 0.05, 16, mat(0xffffff), 4.6, 2.6, -4.97, G); clk.rotation.x = PI / 2;
  box(0.03, 0.18, 0.02, mat(0x222222), 4.6, 2.66, -4.93, G); box(0.13, 0.03, 0.02, mat(0x222222), 4.65, 2.6, -4.93, G);
  // plants
  S.plantYou = makePlant(1.15, 3); S.plantYou.position.set(0.85, 0, 0.75); G.add(S.plantYou);
  for (const [x, z, s, sd] of [[-5.5, -4.5, 1.4, 4], [5.5, 4.4, 1.3, 5], [4.3, 4.4, 1.1, 6], [-5.5, 4.4, 1.2, 7], [-3.4, -4.6, 1.0, 8], [1.0, -4.6, 0.9, 10]]) {
    const p = makePlant(s, sd); p.position.set(x, 0, z); G.add(p);
  }
  // outside: trees, hedges, benches
  const tg = [];
  for (let i = 0; i < 26; i++) { const x = (rnd() < 0.5 ? -1 : 1) * (9 + rnd() * 14), z = -6 + rnd() * 30, sc = 0.9 + rnd() * 0.6; if (x < -5 && Math.abs(z) < 4.5) continue; tree(tg, x, z, sc, rnd); }
  for (let i = 0; i < 10; i++) tree(tg, -40 + i * 9 + rnd() * 3, -10 - rnd() * 6, 1.1 + rnd() * 0.5, rnd);
  for (let x = -6; x <= 6; x += 1.4) if (Math.abs(x) > 1.8) { const g = new THREE.BoxGeometry(1.3, 0.8, 0.9); g.translate(x, 0.4, 9.6); tg.push(vc(g, 0x3f8a3a)); }
  const trees = new THREE.Mesh(mergeGeometries(tg), vcMat()); trees.castShadow = true; trees.receiveShadow = true; G.add(trees);
  const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x666666 });
  S.clouds = new THREE.Group(); G.add(S.clouds);
  for (let i = 0; i < 10; i++) {
    const cl = new THREE.Group();
    for (let k = 0; k < 4; k++) box(3 + rnd() * 3, 1 + rnd(), 2 + rnd() * 2, cm, k * 2 - 3, rnd() * 0.6, rnd(), cl, false);
    cl.position.set(-40 + i * 9 + rnd() * 4, 18 + rnd() * 8, -30 - rnd() * 20); S.clouds.add(cl);
  }
  // stink lines out of one upstairs window (end shot)
  S.winStinkAnchor = new THREE.Vector3(2.4, 5.6, 5.4);
  return S;
}

// paper / wall props --------------------------------------------------------
export function linedPage(ctx, w, h, k = 0, text = true) {
  ctx.fillStyle = '#fbfaf3'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#a9c4e8'; ctx.lineWidth = 3;
  for (let y = 120; y < h; y += 56) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.strokeStyle = '#e88a8a'; ctx.beginPath(); ctx.moveTo(90, 0); ctx.lineTo(90, h); ctx.stroke();
  for (let y = 60; y < h; y += h / 3) { ctx.fillStyle = '#dcdcdc'; ctx.beginPath(); ctx.arc(40, y, 14, 0, PI * 2); ctx.fill(); }
  if (!text) return;
  ctx.save(); ctx.translate(w / 2 + (k % 3 - 1) * 10, h * 0.42); ctx.rotate((-3 + (k * 37 % 7)) * PI / 180);
  ctx.fillStyle = '#1d3a8a'; ctx.font = `bold ${Math.round(w * 0.13)}px Hand`;
  ctx.textAlign = 'center';
  const lines = ['Patient talks', 'about poop', 'a lot.'];
  lines.forEach((ln, i) => ctx.fillText(ln, (i - 1) * 8, (i - 0.6) * w * 0.15));
  ctx.strokeStyle = '#1d3a8a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-w * 0.3, w * 0.24); ctx.quadraticCurveTo(0, w * 0.27, w * 0.32, w * 0.235); ctx.stroke();
  if (k % 2) { ctx.beginPath(); ctx.moveTo(-w * 0.3, w * 0.27); ctx.quadraticCurveTo(0, w * 0.3, w * 0.3, w * 0.265); ctx.stroke(); }
  ctx.restore();
}
export function scribbles(ctx, w, h, seed = 1) {
  ctx.fillStyle = '#fbfaf3'; ctx.fillRect(0, 0, w, h);
  const r = RNG(seed);
  ctx.strokeStyle = '#3a4a7a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  for (let y = 70; y < h - 60; y += 52) {
    let x = 40; const end = w - 40 - r() * 160;
    ctx.beginPath(); ctx.moveTo(x, y);
    while (x < end) { x += 10 + r() * 10; ctx.lineTo(x, y + (r() - 0.5) * 18); }
    ctx.stroke();
  }
}
