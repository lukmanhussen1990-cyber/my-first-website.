// Sets: house + pool (origin), living room (x=60), hallway (x=100), bathroom (x=140).
import { THREE, PI, RNG, M, mesh, box, cyl, ico, canvasTex, P, V } from './toon.js';

export const LR = V(60, 0, 0), HW = V(100, 0, 0), BA = V(140, 0, 0);

const tileTex = (base, line, n = 8, size = 256) => canvasTex(size, size, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h); x.strokeStyle = line; x.lineWidth = 3;
  for (let i = 0; i <= n; i++) { const p = i * w / n; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, h); x.stroke(); x.beginPath(); x.moveTo(0, p); x.lineTo(w, p); x.stroke(); }
}, false);
const woodTex = (c1, c2) => canvasTex(256, 256, (x, w, h) => {
  const r = RNG(3); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? c1 : c2; x.fillRect(0, i * 32, w, 32);
    x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(r() * w, i * 32, 2, 32); x.fillStyle = 'rgba(0,0,0,0.08)'; x.fillRect(0, i * 32, w, 2); }
});
function balloon(parent, x, y, z, col, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const b = ico(0.17 * s, 1, M(col, { std: true, r: 0.25 }), g, 0, 0, 0); b.scale.set(1, 1.15, 1);
  const k = new THREE.Mesh(new THREE.ConeGeometry(0.03 * s, 0.05 * s, 5), M(col, { std: true, r: 0.3 })); k.position.y = -0.2 * s; k.rotation.x = PI; g.add(k);
  cyl(0.003, 0.003, 0.9 * s, 3, M(0xffffff), g, 0, -0.66 * s, 0, false);
  return g;
}
function plant(parent, x, z, s = 1, pot = P.cream) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g); const r = RNG(Math.floor(x * 13 + z * 7));
  cyl(0.18 * s, 0.14 * s, 0.36 * s, 8, M(pot, { std: true }), g, 0, 0.18 * s, 0);
  for (let i = 0; i < 9; i++) { const l = new THREE.Group(); l.rotation.order = 'YXZ'; l.rotation.set(0.3 + r() * 0.5, i / 9 * PI * 2, 0); l.position.y = 0.36 * s; g.add(l);
    const leaf = ico(1, 0, M([0x7cc48a, 0x5fb07a, 0x92d39a][i % 3], { std: true }), l, 0, 0.32 * s, 0); leaf.scale.set(0.08 * s, 0.32 * s, 0.02 * s); }
  return g;
}

// ===================== HOUSE + POOL =====================
export function buildHouse(scene) {
  const S = {}; const G = S.group = new THREE.Group(); scene.add(G);
  for (const [w, d, x, z] of [[56.35, 120, -31.825, 0], [56.35, 120, 31.825, 0], [7.3, 60.65, 0, -29.675], [7.3, 55.45, 0, 32.275]]) {   // grass with a hole for the pool
    const g = mesh(new THREE.PlaneGeometry(w, d), M(0xa8d8a0), G); g.rotation.x = -PI / 2; g.position.set(x, -0.02, z); }
  // house
  const wall = M(0xfbf7f0, { std: true, r: 0.9 }), accent = M(0xffd6bf, { std: true, r: 0.9 }), roof = M(0xc9ced6, { std: true });
  const glass = M(0xbfe6f5, { std: true, r: 0.1, emissive: 0x6aa8c8, ei: 0.25 });
  box(11, 3.2, 7, wall, G, 0, 1.6, -7.5); box(11.4, 0.25, 7.4, roof, G, 0, 3.32, -7.5);
  box(7, 2.9, 6, accent, G, -1.5, 4.9, -8); box(7.4, 0.25, 6.4, roof, G, -1.5, 6.45, -8);
  for (let i = 0; i < 4; i++) box(2.1, 2.5, 0.05, glass, G, -3.6 + i * 2.4, 1.35, -3.98, false);
  for (let i = 0; i < 5; i++) box(0.1, 2.6, 0.12, M(0x9aa0a8), G, -4.8 + i * 2.4, 1.35, -3.95);
  for (let i = 0; i < 3; i++) box(1.6, 1.4, 0.05, glass, G, -3.6 + i * 2.1, 5.0, -4.98, false);
  for (let i = 0; i < 9; i++) box(0.12, 2.9, 0.08, M(0xd9a875, { std: true }), G, 2.6 + i * 0.28, 4.9, -4.97);
  // deck + pool
  box(14, 0.06, 4.5, M(0xeee6d8, { std: true }), G, 0, 0.0, -1.8);
  const cop = M(0xf4efe6, { std: true });
  const PW = 7, PD = 3.6, PZ = 2.6;
  box(PW + 0.6, 0.08, 0.3, cop, G, 0, 0.04, PZ - PD / 2 - 0.15); box(PW + 0.6, 0.08, 0.3, cop, G, 0, 0.04, PZ + PD / 2 + 0.15);
  box(0.3, 0.08, PD, cop, G, -PW / 2 - 0.15, 0.04, PZ); box(0.3, 0.08, PD, cop, G, PW / 2 + 0.15, 0.04, PZ);
  const pt = tileTex('#7fd0ea', '#5fb6d6', 10); pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(4, 2);
  box(PW, 0.05, PD, M(0xffffff, { std: true, map: pt }), G, 0, -1.4, PZ);
  for (const [w, d, x, z] of [[PW, 0.05, 0, PZ - PD / 2], [PW, 0.05, 0, PZ + PD / 2], [0.05, PD, -PW / 2, PZ], [0.05, PD, PW / 2, PZ]]) box(w, 1.4, d, M(0xffffff, { std: true, map: pt }), G, x, -0.7, z);
  const wg = new THREE.PlaneGeometry(PW, PD, 40, 20);
  S.water = mesh(wg, new THREE.MeshStandardMaterial({ color: 0x5cc8ee, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.82, flatShading: true }), G, 0, -0.12, PZ, false);
  S.water.rotation.x = -PI / 2; S.waterBase = wg.attributes.position.array.slice(); S.pool = { PW, PD, PZ };
  // loungers + umbrella + plants + balloons + string lights
  for (const x of [-4.8, -3.2, 3.6]) { const l = new THREE.Group(); l.position.set(x, 0, -1.2); G.add(l); l.rotation.y = 0.2;
    box(0.65, 0.1, 1.8, M(0xffffff, { std: true }), l, 0, 0.3, 0); const b = box(0.65, 0.1, 0.7, M(0xffffff, { std: true }), l, 0, 0.55, -0.75); b.rotation.x = -0.7;
    box(0.6, 0.06, 1.2, M(P.coral, { std: true }), l, 0, 0.38, 0.25); for (const sx of [-0.28, 0.28]) for (const sz of [-0.8, 0.8]) cyl(0.025, 0.025, 0.3, 5, M(0xcfd4da), l, sx, 0.15, sz); }
  const um = new THREE.Group(); um.position.set(-4, 0, -0.5); G.add(um);
  cyl(0.04, 0.04, 2.4, 6, M(0xffffff), um, 0, 1.2, 0); const top = mesh(new THREE.ConeGeometry(1.3, 0.5, 8), M(P.coral, { std: true }), um, 0, 2.5, 0);
  for (const [x, z] of [[-6.5, -3], [6.5, -3], [-6.8, 1.5], [6.8, 2.5]]) plant(G, x, z, 1.6, P.cream);
  S.balloons = [];
  const bc = [P.pink, P.butter, P.baby, P.mint, P.lavender, P.coral];
  for (let i = 0; i < 7; i++) S.balloons.push(balloon(G, 4.6 + (i % 3) * 0.35, 1.7 + (i % 2) * 0.35 + Math.floor(i / 3) * 0.2, -1.5 + Math.floor(i / 3) * 0.3, bc[i % 6], 1.1));
  for (let i = 0; i < 6; i++) S.balloons.push(balloon(G, -6.0 + (i % 2) * 0.35, 1.8 + (i % 3) * 0.25, -0.8 + i * 0.12, bc[(i + 2) % 6], 1.1));
  for (let i = 0; i < 18; i++) { const x = -5.5 + i * 0.65; const y = 3.0 - Math.sin(i / 17 * PI) * 0.5;
    ico(0.05, 0, M([P.butter, P.pink, P.mint][i % 3], { basic: true }), G, x, y, -3.9, false); }
  // fence + trees
  const fm = M(0xffffff, { std: true });
  for (let x = -9; x <= 9; x += 0.5) box(0.08, 1.0, 0.08, fm, G, x, 0.5, 6.0);
  box(18.2, 0.08, 0.08, fm, G, 0, 0.9, 6.0);
  const r = RNG(5); for (let i = 0; i < 10; i++) { const x = (i < 5 ? -1 : 1) * (9 + r() * 6), z = -10 + r() * 16;
    cyl(0.18, 0.24, 2.4, 6, M(0xb08060), G, x, 1.2, z); const c = ico(1.6 + r() * 0.6, 1, M([0x8fd18f, 0x7cc48a, 0x9fdc9a][i % 3], { std: true }), G, x, 3.4, z); c.scale.y = 0.85; }
  // inflatables
  S.donut = mesh(new THREE.TorusGeometry(0.42, 0.17, 8, 14), M(P.pink, { std: true, r: 0.3 }), G, 1.6, -0.08, PZ + 0.8); S.donut.rotation.x = PI / 2;
  S.ball = new THREE.Group(); G.add(S.ball);
  for (let i = 0; i < 6; i++) { const m = mesh(new THREE.SphereGeometry(0.22, 8, 6, i / 6 * PI * 2, PI / 3), M([P.coral, 0xffffff, P.baby, P.butter, 0xffffff, P.mint][i], { std: true, r: 0.4 }), S.ball); }
  S.ball.position.set(-1.0, 0.5, PZ);
  return S;
}
export function waterWaves(S, t) {
  const a = S.water.geometry.attributes.position, b = S.waterBase;
  for (let i = 0; i < a.count; i++) { const x = b[i * 3], y = b[i * 3 + 1];
    a.array[i * 3 + 2] = 0.035 * Math.sin(x * 2.3 + t * 2.1) + 0.03 * Math.sin(y * 3.1 - t * 1.7) + 0.02 * Math.sin((x + y) * 4 + t * 3); }
  a.needsUpdate = true; S.water.geometry.computeVertexNormals();
}

// ===================== LIVING ROOM =====================
export function buildLiving(scene) {
  const S = {}; const G = S.group = new THREE.Group(); G.position.copy(LR); scene.add(G);
  const fl = woodTex('#e9cfa8', '#e2c59c'); fl.wrapS = fl.wrapT = THREE.RepeatWrapping; fl.repeat.set(3, 3);
  box(9, 0.06, 8, M(0xffffff, { std: true, map: fl, r: 0.8 }), G, 0, -0.03, 0.5);
  const wm = M(0xcdeee2, { std: true, r: 0.95 }), wp = M(0xffe2d0, { std: true, r: 0.95 });
  // back wall with a big window
  const backZ = -3.0;
  box(9, 1.25, 0.2, wm, G, 0, 0.62, backZ, false); box(9, 0.8, 0.2, wm, G, 0, 3.0, backZ, false);
  box(2.4, 1.4, 0.2, wm, G, -3.3, 1.95, backZ, false); box(2.6, 1.4, 0.2, wm, G, 3.2, 1.95, backZ, false);
  const frame = M(0xffffff, { std: true });
  box(4.2, 0.08, 0.26, frame, G, -0.05, 1.27, backZ); box(4.2, 0.08, 0.26, frame, G, -0.05, 2.63, backZ);
  for (const x of [-2.1, -0.05, 2.0]) box(0.08, 1.4, 0.26, frame, G, x, 1.95, backZ);
  box(0.2, 3.4, 8, wp, G, -4.5, 1.7, 0.5, false);                 // left wall
  box(0.2, 3.4, 2.2, wp, G, 4.5, 1.7, -1.9, false); box(0.2, 3.4, 3.1, wp, G, 4.5, 1.7, 2.95, false); box(0.2, 1.0, 2.2, wp, G, 4.5, 2.9, 0.3, false); // right wall with doorway (z -0.8..1.4)
  box(9, 3.4, 0.2, wp, G, 0, 1.7, 4.5, false);
  S.ceiling = box(9, 0.1, 8, M(0xfdfbf6), G, 0, 3.42, 0.5, false);
  // outside, seen through the window: deck, pool, palms, sky
  box(12, 0.05, 6, M(0xeee6d8, { std: true }), G, 0, -0.05, -6.5, false);
  const pw = mesh(new THREE.PlaneGeometry(6, 2.6), new THREE.MeshStandardMaterial({ color: 0x5cc8ee, roughness: 0.15, emissive: 0x2a6a88, emissiveIntensity: 0.35 }), G, 0.3, 0.0, -6.6, false); pw.rotation.x = -PI / 2;
  const sky = canvasTex(4, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fd3f2'); g.addColorStop(1, '#ffe2c8'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshBasicMaterial({ map: sky }), G, 0, 4, -11, false);
  for (const x of [-2.5, 3.5]) { cyl(0.12, 0.16, 3.2, 6, M(0xb08060), G, x, 1.6, -8.5); const c = ico(1.3, 1, M(0x8fd18f, { std: true }), G, x, 3.5, -8.5); c.scale.y = 0.7; }
  // sofa (3 seats) + guest chairs in one straight line
  S.seatX = [-2.15, -1.3, -0.45, 0.35, 1.15, 2.05]; S.seatZ = -2.15;
  const so = M(0x8fd3c7, { std: true, r: 0.9 }), so2 = M(0x7cc4b8, { std: true, r: 0.9 });
  box(2.6, 0.42, 0.95, so, G, 0.35, 0.21, -2.2); box(2.6, 0.75, 0.25, so2, G, 0.35, 0.72, -2.58);
  for (const x of [-1.0, 1.7]) box(0.24, 0.62, 0.95, so2, G, x, 0.31, -2.2);
  for (const x of [-0.45, 0.35, 1.15]) box(0.76, 0.12, 0.8, M(0xa6e0d6, { std: true }), G, x, 0.47, -2.12);
  for (const [i, x] of [[0, -2.15], [1, -1.3], [2, 2.05]]) { const c = new THREE.Group(); c.position.set(x, 0, -2.15); G.add(c);
    const cm = M([P.peach, P.lavender, P.butter][i], { std: true, r: 0.8 });
    box(0.55, 0.08, 0.55, cm, c, 0, 0.45, 0); box(0.55, 0.65, 0.07, cm, c, 0, 0.8, -0.26);
    for (const sx of [-0.23, 0.23]) for (const sz of [-0.23, 0.23]) cyl(0.022, 0.022, 0.45, 5, M(0xd9b48a), c, sx, 0.22, sz); }
  // snack table (to the side) + bowls
  const tb = new THREE.Group(); tb.position.set(-3.0, 0, -0.6); G.add(tb);
  cyl(0.55, 0.55, 0.05, 14, M(0xffffff, { std: true }), tb, 0, 0.5, 0); cyl(0.05, 0.08, 0.5, 6, M(0xd9b48a), tb, 0, 0.25, 0);
  cyl(0.16, 0.1, 0.08, 10, M(P.coral, { std: true }), tb, -0.2, 0.57, 0.1); for (let i = 0; i < 6; i++) box(0.04, 0.01, 0.04, M(0xf2c14e), tb, -0.2 + (i % 3 - 1) * 0.04, 0.62, 0.1 + (i % 2) * 0.04);
  cyl(0.04, 0.04, 0.22, 8, M(0x7ac0e0, { std: true, r: 0.2 }), tb, 0.2, 0.63, -0.1); cyl(0.04, 0.04, 0.22, 8, M(P.coral, { std: true, r: 0.2 }), tb, 0.3, 0.63, 0.1);
  // rug, lamp, plants, balloons, bunting
  const rug = mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.02, 20), M(0xfff0e0, { std: true }), G, 0.3, 0.01, -0.4); rug.scale.z = 0.7;
  plant(G, -4.0, -2.5, 1.5, P.butter); plant(G, 4.0, -2.5, 1.2, P.pink);
  const bc = [P.pink, P.butter, P.baby, P.mint, P.lavender, P.coral];
  for (let i = 0; i < 6; i++) balloon(G, -3.9 + (i % 2) * 0.3, 2.3 + (i % 3) * 0.25, -2.5 + i * 0.05, bc[i]);
  for (let i = 0; i < 5; i++) balloon(G, 3.6 + (i % 2) * 0.3, 2.3 + (i % 3) * 0.25, -2.5 + i * 0.05, bc[(i + 3) % 6]);
  for (let i = 0; i < 14; i++) { const x = -3.8 + i * 0.58, y = 3.15 - Math.sin(i / 13 * PI) * 0.35;
    const f = mesh(new THREE.ConeGeometry(0.12, 0.24, 3), M(bc[i % 6], { std: true }), G, x, y, -2.85); f.rotation.x = PI; }
  // puddle (shown when he is on the floor)
  S.puddle = mesh(new THREE.CircleGeometry(1.0, 20), new THREE.MeshStandardMaterial({ color: 0x5fb8e6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.78 }), G, 0.3, 0.026, -0.55, false);
  S.puddle.rotation.x = -PI / 2; S.puddle.scale.set(1.5, 0.75, 1); S.puddle.visible = false;
  return S;
}

// ===================== HALLWAY =====================
export function buildHall(scene) {
  const S = {}; const G = S.group = new THREE.Group(); G.position.copy(HW); scene.add(G);
  const fl = woodTex('#e3c89f', '#dabd92'); fl.wrapS = fl.wrapT = THREE.RepeatWrapping; fl.repeat.set(4, 1);
  box(12.4, 0.06, 2.8, M(0xffffff, { std: true, map: fl }), G, 0, -0.03, 0);
  box(11, 0.012, 1.1, M(0xb9a3e0, { std: true }), G, 0, 0.005, 0);
  const wm = M(0xffe9d6, { std: true, r: 0.95 });
  for (const s of [1, -1]) { box(12.4, 2.9, 0.15, wm, G, 0, 1.45, 1.38 * s, false); box(12.4, 0.12, 0.05, M(0xffffff), G, 0, 0.1, 1.29 * s, false); }
  for (const ex of [-6.1, 6.1]) { box(0.15, 2.9, 2.9, wm, G, ex, 1.45, 0, false); box(0.05, 2.1, 0.95, M(0xf5e6d3, { std: true }), G, ex - Math.sign(ex) * 0.08, 1.05, 0, false); }
  S.ceiling = new THREE.Group(); G.add(S.ceiling); box(12.4, 0.1, 2.9, M(0xfdfbf6), S.ceiling, 0, 2.9, 0, false);
  for (let x = -4.5; x <= 4.5; x += 3) { cyl(0.18, 0.22, 0.06, 10, M(0xffffff, { emissive: 0xfff2d0, ei: 0.8 }), S.ceiling, x, 2.84, 0, false); }
  // family photos
  S.photos = [];
  const r = RNG(21);
  const fams = [[P.coral, P.baby], [P.mint, P.butter], [P.lavender, P.pink], [P.butter, P.baby], [P.pink, P.mint]];
  for (let i = 0; i < 10; i++) {
    const s = i % 2 ? 1 : -1; const x = -4.8 + i * 1.05; const w = 0.38 + r() * 0.2, h = 0.3 + r() * 0.2;
    const tex = canvasTex(160, 128, (c, W, H) => {
      const [a, b] = fams[i % 5]; c.fillStyle = '#' + a.toString(16).padStart(6, '0'); c.fillRect(0, 0, W, H);
      c.fillStyle = '#' + b.toString(16).padStart(6, '0'); c.fillRect(0, H * 0.65, W, H * 0.35);
      const n = 2 + (i % 3);
      for (let k = 0; k < n; k++) { const cx = W * (k + 1) / (n + 1), sc = k === n - 1 && n > 2 ? 0.7 : 1;
        c.fillStyle = ['#f0c4a0', '#c98a62', '#8d5a3a'][(i + k) % 3]; c.beginPath(); c.ellipse(cx, H * 0.42, 14 * sc, 17 * sc, 0, 0, PI * 2); c.fill();
        c.fillStyle = ['#ff8f86', '#6cc7bd', '#c9b6ec', '#ffe48f'][(i + k) % 4]; c.fillRect(cx - 16 * sc, H * 0.55, 32 * sc, 40 * sc);
        c.fillStyle = '#15151a'; c.fillRect(cx - 7 * sc, H * 0.4, 3, 6); c.fillRect(cx + 4 * sc, H * 0.4, 3, 6); }
    });
    const g = new THREE.Group(); g.position.set(x, 1.55 + (r() - 0.5) * 0.2, 1.29 * s); g.rotation.y = s > 0 ? PI : 0; G.add(g);
    box(w + 0.06, h + 0.06, 0.03, M([0xffffff, 0xd9b48a, 0x2a2a30][i % 3], { std: true }), g, 0, 0, 0);
    mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), g, 0, 0, 0.017, false);
    S.photos.push({ g, s, x, base: 0 });
  }
  // door frames at both ends
  for (const ex of [-6.0, 6.0]) { box(0.1, 2.3, 0.1, M(0xffffff), G, ex, 1.15, 0.52); box(0.1, 2.3, 0.1, M(0xffffff), G, ex, 1.15, -0.52); box(0.1, 0.1, 1.15, M(0xffffff), G, ex, 2.25, 0); }
  plant(G, 5.5, -1.0, 1.0, P.mint);
  return S;
}

// ===================== BATHROOM =====================
// tub alcove: x -0.95..0.92, z -1.05..-0.28 ; rail at y 2.25, z -0.24 ; door opening in the front wall (z 2.82) x -0.45..1.6
export function buildBath(scene) {
  const S = {}; const G = S.group = new THREE.Group(); G.position.copy(BA); scene.add(G);
  const wt = tileTex('#ffffff', '#dfe6ea', 6); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(3, 2);
  const ft = tileTex('#cfe6ee', '#b8d2dc', 6); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(3, 3);
  const tileM = M(0xffffff, { std: true, map: wt, r: 0.35 });
  box(4.0, 0.06, 4.0, M(0xffffff, { std: true, map: ft, r: 0.4 }), G, 0.5, -0.03, 0.8);
  S.backWall = box(4.0, 2.8, 0.15, tileM, G, 0.5, 1.4, -1.12, false);
  S.leftWall = box(0.15, 2.8, 4.0, tileM, G, -1.02, 1.4, 0.8, false);
  S.rightWall = box(0.15, 2.8, 4.0, tileM, G, 2.5, 1.4, 0.8, false);
  S.alcoveWall = box(0.15, 2.8, 0.95, tileM, G, 1.0, 1.4, -0.6, false);
  S.ceiling = box(4.0, 0.1, 4.0, M(0xffffff), G, 0.5, 2.8, 0.8, false);
  S.front = new THREE.Group(); G.add(S.front);
  box(0.6, 2.8, 0.15, tileM, S.front, -0.75, 1.4, 2.82, false); box(0.9, 2.8, 0.15, tileM, S.front, 2.05, 1.4, 2.82, false); box(2.05, 0.55, 0.15, tileM, S.front, 0.575, 2.525, 2.82, false);
  S.door = new THREE.Group(); S.door.position.set(-0.45, 0, 2.82); G.add(S.door); S.door.rotation.y = -1.75;   // open, against the wall
  box(1.0, 2.2, 0.05, M(0xf5e6d3, { std: true }), S.door, 0.5, 1.1, 0); cyl(0.03, 0.03, 0.08, 6, M(0xc0c6cc, { std: true, metal: 0.6, r: 0.3 }), S.door, 0.9, 1.0, 0.05);
  const hf = woodTex('#e3c89f', '#dabd92'); hf.wrapS = hf.wrapT = THREE.RepeatWrapping; hf.repeat.set(2, 2);
  box(4.0, 0.06, 3.6, M(0xffffff, { std: true, map: hf }), G, 0.5, -0.03, 4.7);
  // bathtub
  const tub = M(0xffffff, { std: true, r: 0.25 });
  box(1.9, 0.12, 0.8, tub, G, -0.02, 0.06, -0.66);
  S.tubFront = box(1.9, 0.55, 0.1, tub, G, -0.02, 0.28, -0.28); box(1.9, 0.55, 0.08, tub, G, -0.02, 0.28, -1.03);
  box(0.08, 0.55, 0.8, tub, G, -0.94, 0.28, -0.66); box(0.08, 0.55, 0.8, tub, G, 0.9, 0.28, -0.66);
  box(1.96, 0.05, 0.16, tub, G, -0.02, 0.57, -0.27);
  // shower head + pipe + knobs (back wall)
  const chrome = M(0xe6ecf1, { std: true, metal: 0.3, r: 0.3 });
  S.pipe = new THREE.Group(); G.add(S.pipe);
  cyl(0.02, 0.02, 0.75, 6, chrome, S.pipe, 0, 1.92, -1.03); const arm = S.pipeArm = cyl(0.02, 0.02, 0.25, 6, chrome, S.pipe, 0, 2.3, -0.95); arm.rotation.x = PI / 2;
  S.head = cyl(0.11, 0.06, 0.06, 10, chrome, S.pipe, 0, 2.26, -0.82); S.head.rotation.x = 0.7;
  S.headPos = V(0, 2.22, -0.8);
  for (const x of [-0.12, 0.12]) { const k = cyl(0.04, 0.04, 0.05, 8, chrome, S.pipe, x, 1.05, -1.02); k.rotation.x = PI / 2; }
  // shelf with bottles
  S.shelf = new THREE.Group(); G.add(S.shelf);
  box(0.25, 0.03, 0.18, M(0xffffff), S.shelf, -0.82, 1.15, -0.95);
  [[0xff8f86, 0.07, 0.22], [0x9ee0c8, 0.06, 0.18], [0xc9b6ec, 0.055, 0.25]].forEach(([c, r, h], i) => cyl(r * 0.8, r, h, 8, M(c, { std: true, r: 0.3 }), S.shelf, -0.9 + i * 0.07, 1.165 + h / 2, -0.95 + (i % 2) * 0.04));
  // rubber duck on the tub rim
  S.duck = new THREE.Group(); S.duck.position.set(0.72, 0.6, -0.27); S.duck.rotation.y = -0.5; G.add(S.duck);
  const yel = M(0xffd84a, { std: true, r: 0.35 });
  const db = ico(0.07, 1, yel, S.duck, 0, 0.05, 0); db.scale.set(1.1, 0.8, 1.3); ico(0.045, 1, yel, S.duck, 0, 0.12, 0.05);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 4), M(0xff9a3c, { std: true })); beak.rotation.x = PI / 2; beak.position.set(0, 0.115, 0.1); S.duck.add(beak);
  box(0.012, 0.012, 0.005, M(P.ink), S.duck, 0.02, 0.13, 0.09); box(0.012, 0.012, 0.005, M(P.ink), S.duck, -0.02, 0.13, 0.09);
  // more bottles on the floor corner + sink, mirror, towel, mat
  [[0xffb3cf, 0.05, 0.2], [0xa9d6f2, 0.045, 0.16]].forEach(([c, r, h], i) => cyl(r * 0.8, r, h, 8, M(c, { std: true, r: 0.3 }), G, 0.62 + i * 0.1, 0.12 + h / 2, -0.95));
  box(0.5, 0.85, 0.45, M(0xffffff, { std: true, r: 0.3 }), G, 2.2, 0.42, 1.0); box(0.55, 0.06, 0.5, M(0xf0f0f0, { std: true }), G, 2.2, 0.87, 1.0);
  box(0.03, 0.7, 0.55, M(0xdff3fb, { std: true, metal: 0.6, r: 0.08 }), G, 2.42, 1.55, 1.0);
  box(0.06, 0.5, 0.35, M(P.mint, { std: true }), G, -0.97, 1.0, 1.0);
  box(0.9, 0.015, 0.55, M(P.lavender, { std: true }), G, 0.0, 0.01, 0.3);
  // rail in two halves (so it can bend in the middle)
  S.railY = 2.25; S.railZ = -0.24; S.railXL = -0.95; S.railXR = 0.92;
  S.railL = new THREE.Group(); S.railL.position.set(S.railXL, S.railY, S.railZ); G.add(S.railL);
  S.railR = new THREE.Group(); S.railR.position.set(S.railXR, S.railY, S.railZ); G.add(S.railR);
  const rl = cyl(0.016, 0.016, 0.94, 8, chrome, S.railL, 0.47, 0, 0); rl.rotation.z = PI / 2;
  const rr = cyl(0.016, 0.016, 0.93, 8, chrome, S.railR, -0.465, 0, 0); rr.rotation.z = PI / 2;
  for (const [g, s] of [[S.railL, 1], [S.railR, -1]]) { const c = cyl(0.03, 0.03, 0.03, 8, chrome, g, 0, 0, 0); c.rotation.z = PI / 2; }
  return S;
}
