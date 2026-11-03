// Sets for the golden-toilet reel. Every texture is a small canvas drawn with code (pixel style).
import * as THREE from 'three';
import { mat, box, cyl, group, canvasTex, hash } from './lib.js';
import { drawCentered, drawText } from './font.js';

export const OFFSETS = {
  home: new THREE.Vector3(-80, 0, 0), gate: new THREE.Vector3(-40, 0, 40), hall: new THREE.Vector3(0, 0, 0),
  bath: new THREE.Vector3(40, 0, 0), party: new THREE.Vector3(80, 0, 0),
};
const GOLD = () => mat(0xf2c14e, { std: true, metalness: 0.95, roughness: 0.18, envMapIntensity: 1.4 });

function ptex(size, draw, rep = [1, 1]) {
  const t = canvasTex(size, size, draw, { nearest: true });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
  return t;
}
function lam(tex) { return new THREE.MeshLambertMaterial({ map: tex }); }
function marble(base, vein, n = 32) {
  return (c) => { c.fillStyle = base; c.fillRect(0, 0, n, n); c.fillStyle = vein;
    let x = 3, y = 0; for (let i = 0; i < 40; i++) { c.fillRect(x, y, 1, 1); x = (x + (hash(i) > 0.5 ? 1 : 0) + n) % n; y = (y + 1) % n; }
    x = 20; y = 0; for (let i = 0; i < 40; i++) { c.fillRect(x, y, 1, 1); x = (x + (hash(i + 9) > 0.4 ? -1 : 0) + n) % n; y = (y + 1) % n; }
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, 0, n, 1); c.fillRect(0, 0, 1, n); };
}
function plane(w, h, m, parent, x, y, z, ry = 0, rx = 0) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx, ry, 0); p.receiveShadow = true; parent.add(p); return p; }
function frameBox(parent, w, h, x, y, z, m, inner, t = 0.08) {
  const g = group(parent, x, y, z);
  box(w, t, 0.07, m, 0, h / 2 - t / 2, 0, g, false); box(w, t, 0.07, m, 0, -h / 2 + t / 2, 0, g, false);
  box(t, h, 0.07, m, -w / 2 + t / 2, 0, 0, g, false); box(t, h, 0.07, m, w / 2 - t / 2, 0, 0, g, false);
  if (inner) plane(w - t * 1.6, h - t * 1.6, inner, g, 0, 0, 0.01);
  return g;
}
function pixelArt(w, h, draw) { return new THREE.MeshLambertMaterial({ map: canvasTex(w, h, draw, { nearest: true }) }); }
function sofa(parent, x, z, ry, color) {
  const g = group(parent, x, 0, z); g.rotation.y = ry;
  const v = mat(color), gold = GOLD();
  box(2.2, 0.35, 0.95, v, 0, 0.3, 0, g); box(2.2, 0.8, 0.25, v, 0, 0.75, -0.38, g);
  for (const s of [1, -1]) box(0.28, 0.6, 0.95, v, s * 1.1, 0.45, 0, g);
  for (const xx of [-0.55, 0.55]) box(1.0, 0.16, 0.8, mat(color === 0x7a1f2e ? 0x8f2a3a : 0x2f6f6a), xx, 0.55, 0.05, g);
  for (const [a, b] of [[-1, 0.4], [1, 0.4], [-1, -0.4], [1, -0.4]]) box(0.08, 0.14, 0.08, gold, a, 0.07, b, g);
  box(2.24, 0.04, 0.04, gold, 0, 1.16, -0.38, g, false);
  return g;
}
function chandelier(parent, x, y, z, scale = 1) {
  const g = group(parent, x, y, z); g.scale.setScalar(scale);
  const gold = GOLD();
  cyl(0.02, 0.02, 1.2, 6, gold, 0, 0.6, 0, g);
  const crystal = mat(0xf4fbff, { std: true, roughness: 0.05, metalness: 0.1, envMapIntensity: 2 });
  const bulbs = [];
  [[1.1, 0], [0.75, 0.45], [0.4, 0.85]].forEach(([r, h], ti) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 6, 20), gold); ring.rotation.x = Math.PI / 2; ring.position.y = h; g.add(ring);
    const n = 10 - ti * 2;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), crystal); c.position.set(Math.cos(a) * r, h - 0.2, Math.sin(a) * r); c.scale.y = 1.8; g.add(c);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), mat(0xfff0b0, { basic: true })); b.position.set(Math.cos(a) * r, h + 0.1, Math.sin(a) * r); g.add(b); bulbs.push(b);
      cyl(0.03, 0.03, 0.1, 6, mat(0xfff8e6), Math.cos(a) * r, h + 0.02, Math.sin(a) * r, g);
    }
  });
  const big = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), crystal); big.position.y = -0.35; big.scale.y = 1.6; g.add(big);
  g.userData.bulbs = bulbs;
  return g;
}
function balloon(parent, x, y, z, color, scale = 1) {
  const g = group(parent, x, y, z); g.scale.setScalar(scale);
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), mat(color, { std: true, roughness: 0.25 })); b.scale.y = 1.2; g.add(b);
  cyl(0.004, 0.004, 1.4, 3, mat(0xffffff), 0, -1.0, 0, g);
  return g;
}
// voxel "32" balloon made from the pixel font glyph grid
function voxelNumber(parent, text, m, s = 0.09) {
  const G = { 3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'], 2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'] };
  const g = group(parent);
  let ox = 0;
  for (const ch of text) { G[ch].forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') box(s, s, s * 1.6, m, (ox + x) * s, (6 - y) * s, 0, g); }); ox += 6; }
  g.children.forEach((c) => { c.position.x -= (ox - 1) * s / 2; });
  return g;
}

export function buildSets(scene) {
  const S = {};
  // ======================= HOME (his & mom's) =======================
  {
    const g = group(scene); g.position.copy(OFFSETS.home); S.home = { group: g };
    plane(10, 9, lam(ptex(32, (c) => { c.fillStyle = '#b07a4c'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#9a6538'; for (let y = 0; y < 32; y += 8) { c.fillRect(0, y, 32, 1); c.fillRect((y * 5) % 32, y, 1, 8); } }, [6, 6])), g, 0, 0, 0, 0, -Math.PI / 2);
    const wall = lam(ptex(32, (c) => { c.fillStyle = '#e9c98f'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#dcb877'; for (let i = 0; i < 30; i++) c.fillRect((i * 13) % 32, (i * 7) % 32, 2, 1); }, [5, 3]));
    box(10, 4.6, 0.2, wall, 0, 2.3, -3.2, g); box(0.2, 4.6, 8, wall, -3.6, 2.3, 0.6, g); box(0.2, 4.6, 8, wall, 3.6, 2.3, 0.6, g);
    // kitchen corner: shelf with steel pots, stove, table with steel mug
    const steel = mat(0xd8dde2, { std: true, metalness: 0.9, roughness: 0.25 });
    box(2.2, 0.06, 0.4, mat(0x7a4a26), -2.2, 2.0, -2.95, g); for (let i = 0; i < 4; i++) cyl(0.16, 0.14, 0.24, 10, steel, -3.0 + i * 0.5, 2.15, -2.95, g);
    box(1.4, 0.9, 0.6, mat(0x8a8f96), -2.2, 0.45, -2.85, g); box(1.4, 0.06, 0.6, mat(0x3a3f45), -2.2, 0.93, -2.85, g);
    const tbl = group(g, -1.0, 0, -1.6); box(1.2, 0.06, 0.8, mat(0x8b5a2b), 0, 0.78, 0, tbl); for (const [a, b] of [[-0.5, 0.33], [0.5, 0.33], [-0.5, -0.33], [0.5, -0.33]]) box(0.06, 0.76, 0.06, mat(0x6e4420), a, 0.38, b, tbl);
    S.home.table = tbl;
    // door with slippers at the threshold
    box(1.1, 2.4, 0.06, mat(0x7a4a26), 2.4, 1.2, -3.08, g); box(0.06, 0.06, 0.04, GOLD(), 2.0, 1.2, -3.02, g, false);
    // wall calendar (flip pages built in shots) + a wall clock
    S.home.calendarSpot = new THREE.Vector3(0.8, 2.2, -3.07);
    const clock = cyl(0.3, 0.3, 0.05, 16, mat(0xffffff), 1.9, 2.9, -3.08, g); clock.rotation.x = Math.PI / 2;
    // the "32" balloon (gold voxel digits) + a few round balloons for scene 1
    const n32 = voxelNumber(g, '32', mat(0xf2c14e, { std: true, metalness: 0.7, roughness: 0.25 }), 0.12);
    n32.position.set(0.25, 2.5, -2.2); S.home.n32 = n32;
    cyl(0.004, 0.004, 1.4, 3, mat(0xffffff), 0.25, 1.8, -2.2, g);
    balloon(g, 1.8, 2.5, -2.6, 0xff5d93); balloon(g, -0.2, 2.7, -2.7, 0x3f86d4);
  }
  // ======================= MANSION GATE (exterior, golden hour) =======================
  {
    const g = group(scene); g.position.copy(OFFSETS.gate); S.gate = { group: g };
    plane(40, 40, lam(ptex(32, (c) => { c.fillStyle = '#4f9a3a'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#5aae44'; for (let i = 0; i < 50; i++) c.fillRect((i * 17) % 32, (i * 29) % 32, 2, 2); }, [16, 16])), g, 0, -0.01, -6, 0, -Math.PI / 2);
    plane(4, 30, lam(ptex(32, (c) => { c.fillStyle = '#d8c49a'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#c4ad80'; for (let y = 0; y < 32; y += 8) for (let x = (y % 16 ? 4 : 0); x < 32; x += 8) c.fillRect(x, y, 7, 7); }, [2, 15])), g, 0, 0.01, -8, 0, -Math.PI / 2);
    const gold = GOLD(), iron = mat(0x1b1b1f);
    for (const s of [1, -1]) {
      box(0.7, 3.6, 0.7, lam(ptex(32, marble('#efe7da', '#c9bfae'), [1, 3])), s * 2.3, 1.8, 0, g);
      box(0.9, 0.2, 0.9, gold, s * 2.3, 3.7, 0, g); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(0xfff0b0, { basic: true })); lamp.position.set(s * 2.3, 4.0, 0); g.add(lamp);
      box(6, 1.4, 0.4, mat(0x2f6a2f), s * 5.6, 0.7, 0.2, g);
    }
    const gate = { L: group(g, -1.95, 0, 0), R: group(g, 1.95, 0, 0) };
    for (const [k, s] of [['L', 1], ['R', -1]]) {
      const hg = gate[k];
      for (let i = 0; i < 9; i++) { const b = box(0.06, 3.0, 0.06, i % 2 ? iron : gold, s * (0.1 + i * 0.21), 1.5, 0, hg); void b; }
      box(1.95, 0.1, 0.08, gold, s * 0.98, 0.4, 0, hg); box(1.95, 0.1, 0.08, gold, s * 0.98, 2.6, 0, hg);
      for (let i = 0; i < 9; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), gold); sp.position.set(s * (0.1 + i * 0.21), 3.1, 0); hg.add(sp); }
    }
    S.gate.gate = gate;
    // the mansion behind
    const house = group(g, 0, 0, -16);
    box(18, 7, 4, lam(ptex(32, (c) => { c.fillStyle = '#f4ead8'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#e6d8bf'; for (let y = 0; y < 32; y += 4) c.fillRect(0, y, 32, 1); }, [6, 3])), 0, 3.5, 0, house);
    for (let i = 0; i < 6; i++) cyl(0.3, 0.35, 6, 8, mat(0xffffff), -5 + i * 2, 3, 2.3, house);
    box(19, 0.5, 5, mat(0xd9c7a6), 0, 7.2, 0, house);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) box(1.0, 1.4, 0.05, mat(0xffd98a, { basic: true }), -7.5 + i * 2.5, 2 + r * 3, 2.03, house);
    box(2.2, 3.2, 0.05, mat(0x6a3a1a), 0, 1.6, 2.04, house);
  }
  // ======================= MANSION HALL =======================
  {
    const g = group(scene); g.position.copy(OFFSETS.hall); S.hall = { group: g };
    plane(20, 18, lam(ptex(32, marble('#f3eee6', '#bdb2a2'), [10, 9])), g, 0, 0, 0, 0, -Math.PI / 2);
    const wall = lam(ptex(32, (c) => { c.fillStyle = '#efd9b0'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#e4c993'; for (let y = 0; y < 32; y += 8) for (let x = (y % 16 ? 4 : 0); x < 32; x += 8) { c.fillRect(x + 3, y + 2, 2, 4); c.fillRect(x + 2, y + 3, 4, 2); } }, [8, 3]));
    box(20, 7, 0.2, wall, 0, 3.5, -6, g); box(0.2, 7, 14, wall, -8, 3.5, 0.5, g); box(0.2, 7, 14, wall, 8, 3.5, 0.5, g);
    const gold = GOLD();
    box(20, 0.12, 0.08, gold, 0, 1.0, -5.88, g, false); box(20, 0.15, 0.08, gold, 0, 6.6, -5.88, g, false);
    for (let i = 0; i < 6; i++) { cyl(0.28, 0.3, 7, 8, mat(0xfaf6ef), -7 + i * 2.8, 3.5, -5.5, g); box(0.7, 0.2, 0.7, gold, -7 + i * 2.8, 6.9, -5.5, g); }
    S.hall.chandelier = chandelier(g, 0, 5.2, -1.5, 1.25);
    S.hall.sofaL = sofa(g, -3.2, -3.6, 0.35, 0x7a1f2e);
    S.hall.sofaR = sofa(g, 3.4, -3.4, -0.35, 0x1f5a5a);
    box(1.4, 0.06, 0.8, mat(0xdff4ff, { std: true, roughness: 0.05, transparent: true, opacity: 0.6 }), 0, 0.5, -3.2, g); box(1.2, 0.48, 0.6, gold, 0, 0.24, -3.2, g, false);
    // paintings (pixel art) + gold pots with plants
    const art = (draw) => pixelArt(48, 36, draw);
    frameBox(g, 2.0, 1.5, -3.4, 3.8, -5.85, gold, art((c) => { c.fillStyle = '#7fb4e0'; c.fillRect(0, 0, 48, 36); c.fillStyle = '#3f8f4f'; c.fillRect(0, 22, 48, 14); c.fillStyle = '#ffd23f'; c.fillRect(34, 6, 8, 8); c.fillStyle = '#6a4a2a'; c.fillRect(10, 14, 3, 10); c.fillStyle = '#2f6a2f'; c.fillRect(6, 8, 11, 8); }));
    frameBox(g, 2.0, 1.5, 3.4, 3.8, -5.85, gold, art((c) => { c.fillStyle = '#2a1f3a'; c.fillRect(0, 0, 48, 36); c.fillStyle = '#c9906a'; c.fillRect(18, 8, 12, 12); c.fillStyle = '#2b1a12'; c.fillRect(16, 5, 16, 6); c.fillStyle = '#f1e6d2'; c.fillRect(14, 21, 20, 15); c.fillStyle = '#111'; c.fillRect(20, 12, 2, 3); c.fillRect(26, 12, 2, 3); }));
    for (const x of [-6.5, 6.5]) { cyl(0.35, 0.28, 0.6, 8, gold, x, 0.3, -4.8, g); for (let i = 0; i < 7; i++) { const l = box(0.18, 0.9, 0.05, mat(0x2f8f3f), x + Math.cos(i) * 0.12, 1.05, -4.8 + Math.sin(i) * 0.12, g); l.rotation.set(Math.sin(i * 2) * 0.4, i, Math.cos(i * 3) * 0.4); } }
    // grand entrance door (left wall) and the bathroom door (right wall)
    const ent = group(g, -7.9, 0, 2.0); S.hall.entrance = ent;
    S.hall.entL = group(ent, 0, 0, -0.9); box(0.12, 3.4, 0.9, mat(0x5a2f14), 0, 1.7, 0.45, S.hall.entL);
    S.hall.entR = group(ent, 0, 0, 0.9); box(0.12, 3.4, 0.9, mat(0x5a2f14), 0, 1.7, -0.45, S.hall.entR);
    box(0.2, 0.2, 2.2, gold, 0.05, 3.5, 0, ent, false);
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(2, 3.4), mat(0xffd98a, { basic: true })); outside.position.set(-0.3, 1.7, 0); outside.rotation.y = Math.PI / 2; ent.add(outside);
    const bd = group(g, 7.9, 0, 1.2); S.hall.bathDoor = bd;
    S.hall.bathHinge = group(bd, 0, 0, -0.6); box(0.1, 2.6, 1.2, mat(0x6a3a1a), 0, 1.3, 0.6, S.hall.bathHinge); box(0.06, 0.06, 0.12, gold, -0.08, 1.25, 1.05, S.hall.bathHinge, false);
    box(0.25, 0.15, 1.5, gold, 0, 2.7, 0.0, bd, false);
    const sign = pixelArt(64, 24, (c) => { c.fillStyle = '#2a1f14'; c.fillRect(0, 0, 64, 24); drawCentered(c, 'W.C.', 32, 12, 2, { color: '#f2c14e' }); });
    plane(0.6, 0.22, sign, bd, -0.06, 3.0, 0, -Math.PI / 2);
    S.hall.underDoor = new THREE.Vector3(7.75, 0.08, 1.2);
  }
  // ======================= GOLDEN BATHROOM =======================
  {
    const g = group(scene); g.position.copy(OFFSETS.bath); S.bath = { group: g };
    plane(8, 8, lam(ptex(32, (c) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? '#1c1a1a' : '#f3eee6'; c.fillRect(x * 8, y * 8, 8, 8); } }, [6, 6])), g, 0, 0, 0, 0, -Math.PI / 2);
    const wm = lam(ptex(32, marble('#f1e3c4', '#c79a4a'), [4, 3]));
    box(8, 4.5, 0.2, wm, 0, 2.25, -2.6, g); box(0.2, 4.5, 6, wm, -2.6, 2.25, 0.4, g); box(0.2, 4.5, 6, wm, 2.6, 2.25, 0.4, g);
    const gold = GOLD();
    box(8, 0.1, 0.06, gold, 0, 1.2, -2.48, g, false);
    // THE GOLDEN TOILET
    const t = group(g, 0, 0, -1.85); S.bath.toilet = t;
    cyl(0.24, 0.3, 0.42, 10, gold, 0, 0.21, 0.05, t);                     // base
    const bowl = cyl(0.36, 0.26, 0.24, 12, gold, 0, 0.5, 0.18, t); bowl.scale.z = 1.25;
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 14), gold); seat.rotation.x = Math.PI / 2; seat.scale.y = 1.25; seat.position.set(0, 0.63, 0.18); t.add(seat);
    box(0.7, 0.6, 0.26, gold, 0, 0.95, -0.24, t); box(0.76, 0.06, 0.3, gold, 0, 1.27, -0.24, t); box(0.12, 0.04, 0.04, mat(0xffffff), 0.25, 1.15, -0.1, t, false);
    // gold sink + taps, mirror, toilet paper holder, door
    const sk = group(g, -1.7, 0, -2.2);
    box(0.9, 0.8, 0.5, lam(ptex(32, marble('#2a2420', '#c79a4a'))), 0, 0.4, 0, sk); const basin = cyl(0.3, 0.22, 0.12, 10, gold, 0, 0.86, 0.02, sk); void basin;
    cyl(0.03, 0.03, 0.25, 6, gold, 0, 1.05, -0.18, sk); box(0.04, 0.04, 0.16, gold, 0, 1.16, -0.1, sk, false);
    for (const s of [1, -1]) { const tp = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), gold); tp.position.set(s * 0.14, 1.0, -0.18); sk.add(tp); }
    frameBox(g, 1.0, 1.2, -1.7, 2.1, -2.48, gold, mat(0xd6e6ee, { std: true, roughness: 0.05, metalness: 0.6 }), 0.1);
    const tph = group(g, 0.85, 0.75, -2.45); box(0.3, 0.04, 0.12, gold, 0, 0.1, 0.05, tph, false);
    const roll = cyl(0.09, 0.09, 0.22, 10, mat(0xffffff), 0, 0, 0.12, tph); roll.rotation.z = Math.PI / 2;
    S.bath.tpRoll = tph;
    const door = group(g, 2.45, 0, 0.9); box(0.1, 2.6, 1.2, mat(0x6a3a1a), 0, 1.3, 0, door);
  }
  // ======================= BIRTHDAY PARTY =======================
  {
    const g = group(scene); g.position.copy(OFFSETS.party); S.party = { group: g };
    plane(14, 12, lam(ptex(32, (c) => { c.fillStyle = '#7a3a2a'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#8f4a32'; for (let y = 0; y < 32; y += 4) c.fillRect(0, y, 32, 2); }, [8, 8])), g, 0, 0, 0, 0, -Math.PI / 2);
    const wall = lam(ptex(32, (c) => { c.fillStyle = '#f7c9a0'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#f0b888'; for (let x = 0; x < 32; x += 8) c.fillRect(x, 0, 3, 32); }, [6, 3]));
    box(14, 5, 0.2, wall, 0, 2.5, -4, g); box(0.2, 5, 10, wall, -6, 2.5, 0.5, g); box(0.2, 5, 10, wall, 6, 2.5, 0.5, g);
    const banner = pixelArt(256, 48, (c) => { c.fillStyle = '#2a1f5a'; c.fillRect(0, 0, 256, 48); drawCentered(c, 'HAPPY BIRTHDAY', 128, 24, 3, { color: '#ffd23f' }); });
    plane(4.4, 0.8, banner, g, 0, 3.6, -3.88);
    for (let i = 0; i < 12; i++) { const f = box(0.3, 0.4, 0.02, mat([0xff5d93, 0x3f86d4, 0xffd23f, 0x3fae5a][i % 4]), -4.4 + i * 0.8, 4.3 - Math.sin(i / 11 * Math.PI) * 0.3, -3.85, g, false); f.rotation.z = Math.PI / 4; }
    // long table + tablecloth + cake with candles
    const tb = group(g, 0, 0, -1.6); S.party.table = tb;
    box(3.6, 0.08, 1.3, lam(ptex(32, (c) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#f2c14e'; for (let i = 0; i < 32; i += 8) c.fillRect(i, 0, 4, 32); }, [3, 1])), 0, 0.8, 0, tb);
    for (const [a, b] of [[-1.6, 0.5], [1.6, 0.5], [-1.6, -0.5], [1.6, -0.5]]) box(0.08, 0.78, 0.08, mat(0x5e3a1d), a, 0.39, b, tb);
    const cake = group(tb, -0.6, 0.84, 0); S.party.cake = cake;
    cyl(0.36, 0.36, 0.26, 12, mat(0xfff0f5), 0, 0.13, 0, cake); cyl(0.28, 0.28, 0.22, 12, mat(0xff8fb1), 0, 0.37, 0, cake); cyl(0.37, 0.37, 0.05, 12, mat(0xff5d93), 0, 0.27, 0, cake);
    const flames = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cyl(0.015, 0.015, 0.14, 5, mat([0x3f86d4, 0xffd23f, 0x3fae5a][i % 3]), Math.cos(a) * 0.16, 0.55, Math.sin(a) * 0.16, cake); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 5), mat(0xffb030, { basic: true })); fl.position.set(Math.cos(a) * 0.16, 0.66, Math.sin(a) * 0.16); cake.add(fl); flames.push(fl); }
    S.party.flames = flames;
    for (let i = 0; i < 4; i++) { cyl(0.2, 0.2, 0.02, 10, mat(0xffffff), 0.3 + i * 0.35, 0.85, 0.3, tb); }
    S.party.balloons = [];
    [[-4.5, 2.6, -3.2, 0xff5d93], [-3.6, 3.0, -3.4, 0x3f86d4], [-2.8, 2.5, -3.1, 0xffd23f], [3.0, 2.8, -3.3, 0x3fae5a], [3.9, 2.4, -3.0, 0xff5d93], [4.6, 3.0, -3.4, 0xb98af0]].forEach(([x, y, z, c]) => S.party.balloons.push(balloon(g, x, y, z, c, 1.1)));
  }
  return S;
}

// ---------- props ----------
export function makeTPRoll() { const g = new THREE.Group(); const r = cyl(0.1, 0.1, 0.22, 12, mat(0xffffff), 0, 0, 0, g); r.rotation.z = Math.PI / 2; const h = cyl(0.035, 0.035, 0.225, 8, mat(0x9a7a5a), 0, 0, 0, g); h.rotation.z = Math.PI / 2; return g; }
export function makeMug() {
  const g = new THREE.Group();
  const steel = mat(0xe3e8ec, { std: true, metalness: 0.95, roughness: 0.15, envMapIntensity: 1.6 });
  cyl(0.085, 0.075, 0.2, 14, steel, 0, 0, 0, g); cyl(0.09, 0.09, 0.02, 14, steel, 0, 0.1, 0, g);
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 10, Math.PI), steel); h.position.set(0.09, 0.0, 0); h.rotation.z = -Math.PI / 2; g.add(h);
  return g;
}
export function phoneTex() {
  const t = canvasTex(120, 240, (c) => {
    const gr = c.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#1f2a4a'); gr.addColorStop(1, '#6a2f6a'); c.fillStyle = gr; c.fillRect(0, 0, 120, 240);
    drawCentered(c, 'calling...', 60, 40, 1.6, { color: '#c8c8ff' });
    drawCentered(c, 'MOM {heart}', 60, 90, 3.2, { color: '#ffffff' });
    c.fillStyle = '#e8473f'; c.beginPath(); c.arc(60, 190, 18, 0, 7); c.fill(); c.fillStyle = '#ffffff'; c.fillRect(50, 186, 20, 8);
  }, { nearest: true });
  return t;
}
export function makePhone(tex) {
  const g = new THREE.Group();
  box(0.2, 0.4, 0.03, mat(0x16161c, { std: true, roughness: 0.3 }), 0, 0, 0, g);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.36), new THREE.MeshBasicMaterial({ map: tex })); s.position.z = 0.016; g.add(s);
  return g;
}
export function makeGift() {
  const g = new THREE.Group();
  const wrap = new THREE.MeshLambertMaterial({ map: canvasTex(32, 32, (c) => { c.fillStyle = '#c4202f'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#ffd23f'; for (let y = 2; y < 32; y += 8) for (let x = (y % 16 ? 6 : 2); x < 32; x += 8) { c.fillRect(x, y, 2, 2); } }, { nearest: true }) });
  const gold = GOLD();
  const body = box(0.7, 0.5, 0.55, wrap, 0, 0.25, 0, g);
  box(0.12, 0.52, 0.57, gold, 0, 0.25, 0, g, false); box(0.72, 0.52, 0.12, gold, 0, 0.25, 0, g, false);
  for (const s of [1, -1]) { const loop = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 10), gold); loop.position.set(s * 0.1, 0.56, 0); loop.rotation.set(0, Math.PI / 2, s * 0.6); g.add(loop); }
  g.userData.body = body; g.userData.wrap = wrap;
  return g;
}
export function makeFrame(texture) {
  const g = new THREE.Group();
  const gold = GOLD();
  box(1.3, 1.0, 0.06, gold, 0, 0, -0.02, g);
  for (const [x, y] of [[-0.6, 0.45], [0.6, 0.45], [-0.6, -0.45], [0.6, -0.45]]) { const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), gold); o.position.set(x, y, 0.04); g.add(o); }
  for (const [w, h, x, y] of [[1.4, 0.08, 0, 0.5], [1.4, 0.08, 0, -0.5], [0.08, 1.08, -0.68, 0], [0.08, 1.08, 0.68, 0]]) box(w, h, 0.1, gold, x, y, 0.02, g, false);
  const ph = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.81), new THREE.MeshBasicMaterial({ map: texture })); ph.position.z = 0.015; g.add(ph);
  g.userData.photo = ph;
  return g;
}
export function calendarTex() {
  const t = canvasTex(160, 200, () => {}, { nearest: true });
  t.userData.draw = (day) => {
    const c = t.userData.ctx;
    c.fillStyle = '#fbf7ee'; c.fillRect(0, 0, 160, 200); c.fillStyle = '#c8302c'; c.fillRect(0, 0, 160, 44);
    drawCentered(c, 'MARCH', 80, 22, 3, { color: '#ffffff' });
    drawCentered(c, String(day), 80, 118, 11, { color: day === 8 ? '#c8302c' : '#2a2a2a' });
    if (day === 8) drawCentered(c, 'B-DAY!', 80, 182, 2.4, { color: '#c8302c' });
    t.needsUpdate = true;
  };
  t.userData.draw(1);
  return t;
}
