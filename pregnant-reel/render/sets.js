// Sets: alley behind the pizza shop (origin), street (x=50), hospital desk (x=100), exam room (x=150).
import { THREE, PI, RNG, M, mesh, box, cyl, ico, canvasTex, P, V } from './toon.js';
export const ST = V(50, 0, 0), DK = V(100, 0, 0), EX = V(150, 0, 0);
const hex = c => '#' + c.toString(16).padStart(6, '0');
const noiseTex = (base, spots, n = 300, size = 256, seed = 1) => canvasTex(size, size, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h); const r = RNG(seed);
  for (let i = 0; i < n; i++) { x.fillStyle = spots[i % spots.length]; x.globalAlpha = 0.25 + r() * 0.3; x.fillRect(r() * w, r() * h, 2 + r() * 5, 2 + r() * 5); }
  x.globalAlpha = 1;
});
const brickTex = (c1, c2, mortar) => canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = mortar; x.fillRect(0, 0, w, h); const r = RNG(4);
  for (let row = 0; row < 16; row++) for (let col = -1; col < 8; col++) {
    x.fillStyle = r() < 0.5 ? c1 : c2; const off = row % 2 ? 16 : 0; x.fillRect(col * 32 + off + 2, row * 16 + 2, 28, 12); }
});
function textTex(w, h, draw) { return canvasTex(w, h, draw); }
const FONT = '"Bangers", "Arial Black", sans-serif';

// ===================== ALLEY =====================
export function buildAlley(scene) {
  const S = {}; const G = S.group = new THREE.Group(); scene.add(G);
  const asph = noiseTex('#a3abb8', ['#8d95a3', '#b9c0cb', '#949caa'], 900, 256, 2); asph.wrapS = asph.wrapT = THREE.RepeatWrapping; asph.repeat.set(8, 8);
  const gnd = mesh(new THREE.PlaneGeometry(40, 40), M(0xffffff, { std: true, map: asph, r: 0.9 }), G); gnd.rotation.x = -PI / 2;
  const bt = brickTex('#e6a58b', '#dc9579', '#f3dccd'); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(4, 2);
  box(12, 5.2, 0.3, M(0xffffff, { std: true, map: bt, r: 0.9 }), G, 0, 2.6, -2.75, false);              // pizza shop back wall
  const bt2 = brickTex('#a9c6e6', '#9dbadb', '#e4eef8'); bt2.wrapS = bt2.wrapT = THREE.RepeatWrapping; bt2.repeat.set(3, 2);
  box(0.3, 7, 10, M(0xffffff, { std: true, map: bt2, r: 0.9 }), G, -5.2, 3.5, 2.2, false);               // left building
  for (let i = 0; i < 6; i++) box(0.12, 1.4, 0.12, M(0xc9a27a, { std: true }), G, 5.0, 0.7, -2.4 + i * 1.2);  // wooden fence posts
  for (const y of [0.35, 1.05]) box(0.08, 0.1, 7, M(0xc9a27a, { std: true }), G, 5.0, y, 0.6);
  for (let i = 0; i < 24; i++) box(0.04, 1.3, 0.2, M(0xd8b38a, { std: true }), G, 4.95, 0.65, -2.5 + i * 0.3);
  // back door, window, vent, pipes
  box(1.05, 2.15, 0.08, M(0x6aa88a, { std: true }), G, 2.7, 1.08, -2.58); cyl(0.04, 0.04, 0.1, 8, M(0xd9dee4, { std: true, metal: 0.5 }), G, 3.05, 1.05, -2.52).rotation.x = PI / 2;
  box(1.6, 0.12, 0.35, M(0xbfc4cb, { std: true }), G, 2.7, 0.06, -2.4);
  box(1.3, 1.0, 0.08, M(0xffe7a8, { std: true, emissive: 0xffcf7a, ei: 0.5 }), G, -3.0, 2.0, -2.58); box(1.45, 0.1, 0.15, M(0xffffff), G, -3.0, 1.45, -2.55);
  box(0.7, 0.45, 0.25, M(0xc3c8cf, { std: true, metal: 0.3 }), G, 0.9, 4.3, -2.5);
  cyl(0.06, 0.06, 5, 6, M(0xa7adb5, { std: true, metal: 0.3 }), G, -1.9, 2.5, -2.52);
  // PIZZA sign with bulbs
  const st = textTex(512, 160, (x, w, h) => { x.fillStyle = '#ffd34d'; x.fillRect(0, 0, w, h); x.fillStyle = '#e83a2f'; x.fillRect(0, 0, w, 14); x.fillRect(0, h - 14, w, 14);
    x.font = `130px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = '#7a1d14'; x.strokeText('PIZZA', w / 2, h / 2 + 6); x.fillStyle = '#e83a2f'; x.fillText('PIZZA', w / 2, h / 2 + 6); });
  S.sign = new THREE.Group(); S.sign.position.set(-0.3, 3.45, -2.5); G.add(S.sign);
  box(3.3, 1.0, 0.16, [M(0xe83a2f, { std: true }), M(0xe83a2f, { std: true }), M(0xe83a2f, { std: true }), M(0xe83a2f, { std: true }), M(0xffffff, { std: true, map: st, emissive: 0xffd34d, ei: 0.25 }), M(0xe83a2f, { std: true })].length ? M(0xe83a2f, { std: true }) : null, S.sign, 0, 0, 0);
  mesh(new THREE.PlaneGeometry(3.2, 0.95), new THREE.MeshStandardMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.35 }), S.sign, 0, 0, 0.085, false);
  S.bulbs = [];
  for (let i = 0; i < 18; i++) { const top = i < 9; const x = -1.55 + (i % 9) * 3.1 / 8; const b = ico(0.045, 0, M(0xfff1b0, { basic: true }), S.sign, x, top ? 0.56 : -0.56, 0.1, false); S.bulbs.push(b); }
  for (const x of [-1.2, 1.2]) cyl(0.025, 0.025, 1.0, 6, M(0x9aa0a8, { std: true }), S.sign, x, 0.95, -0.05);
  // cardboard box home (opening faces +z)
  const cb = textTex(256, 256, (x, w, h) => { x.fillStyle = '#c9a271'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(120,90,50,0.25)'; x.lineWidth = 2;
    for (let i = 0; i < w; i += 6) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); } x.fillStyle = 'rgba(120,80,40,0.5)'; x.font = 'bold 26px sans-serif'; x.fillText('THIS SIDE UP', 40, 60); x.fillText('↑ ↑', 90, 100); });
  const home = textTex(256, 128, (x, w, h) => { x.fillStyle = '#c9a271'; x.fillRect(0, 0, w, h); x.fillStyle = '#3a2a1e'; x.font = `44px ${FONT}`; x.textAlign = 'center'; x.fillText('HOME SWEET', w / 2, 52); x.fillText('HOME ♥', w / 2, 100); });
  const cbm = M(0xffffff, { std: true, map: cb, r: 0.95 });
  S.box = new THREE.Group(); S.box.position.set(-0.2, 0, -1.55); G.add(S.box);
  const BW = 1.35, BH = 0.95, BD = 1.75;
  box(BW, 0.04, BD, cbm, S.box, 0, 0.02, 0); S.boxTop = box(BW, 0.04, BD, cbm, S.box, 0, BH, 0);
  box(0.04, BH, BD, cbm, S.box, -BW / 2, BH / 2, 0); box(0.04, BH, BD, cbm, S.box, BW / 2, BH / 2, 0); box(BW, BH, 0.04, cbm, S.box, 0, BH / 2, -BD / 2);
  mesh(new THREE.PlaneGeometry(0.9, 0.45), M(0xffffff, { std: true, map: home }), S.box, BW / 2 + 0.025, 0.55, 0.1, false).rotation.y = PI / 2;
  S.flaps = [];
  for (const s of [1, -1]) { const f = new THREE.Group(); f.position.set(BW / 2 * s, BH / 2, BD / 2); S.box.add(f); box(0.5, BH * 0.95, 0.03, cbm, f, -0.25 * s, 0, 0); f.rotation.y = -1.9 * s; S.flaps.push(f); }
  const tf = box(BW * 0.95, 0.03, 0.4, cbm, S.box, 0, BH + 0.1, BD / 2 + 0.12); tf.rotation.x = -0.6;
  box(0.9, 0.12, 1.2, M(0xe57f7f, { std: true, r: 0.95 }), S.box, 0, 0.1, -0.15); const pil = box(0.5, 0.14, 0.32, M(0xf3efe6, { std: true }), S.box, 0, 0.18, -0.6); pil.rotation.y = 0.15;
  box(0.15, 0.05, 0.6, M(0xb8b8b8, { std: true }), S.box, 0.35, 0.96, 0.2).rotation.y = 0.4;   // duct tape on the roof
  // trash bins + bags
  for (const [x, z, open] of [[3.3, -1.95, false], [4.25, -1.9, true]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); G.add(g);
    box(0.85, 1.05, 0.8, M(0x6fbf87, { std: true }), g, 0, 0.53, 0); box(0.9, 0.06, 0.06, M(0x5aa874, { std: true }), g, 0, 0.95, 0.4);
    const lid = new THREE.Group(); lid.position.set(0, 1.07, -0.4); g.add(lid); box(0.9, 0.07, 0.85, M(0x4f9a69, { std: true }), lid, 0, 0, 0.42); lid.rotation.x = open ? -1.1 : 0;
    if (!open) S.binLid = lid;
    for (const s of [1, -1]) cyl(0.07, 0.07, 0.05, 8, M(0x333840, { std: true }), g, 0.32 * s, 0.07, 0.38).rotation.z = PI / 2;
  }
  for (const [x, z, s] of [[2.7, -1.6, 1], [3.9, -1.25, 0.8], [4.6, -1.3, 0.7]]) { const b = ico(0.32 * s, 1, M(0x4a5a52, { std: true, r: 0.4 }), G, x, 0.26 * s, z); b.scale.set(1, 0.85, 1); }
  // shopping cart (wire basket) with stuff in it
  S.cart = makeCart(G); S.cart.position.set(-1.75, 0, -0.9); S.cart.rotation.y = 0.35;
  // pizza box on the ground with one slice left
  S.pbox = makePizzaBox(G); S.pbox.position.set(0.95, 0, -0.15); S.pbox.rotation.y = -0.3;
  // puddles
  for (const [x, z, s] of [[1.6, 0.9, 1], [-2.6, 1.4, 0.7]]) { const p = mesh(new THREE.CircleGeometry(0.6 * s, 16), new THREE.MeshStandardMaterial({ color: 0x9fb8d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.7 }), G, x, 0.012, z, false); p.rotation.x = -PI / 2; p.scale.set(1.4, 1, 1); }
  // sunrise sun
  S.sun = mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: 0xffe08a }), G, 9, 3, -30, false); S.sun.visible = false;
  return S;
}
export function makeCart(parent) {
  const g = new THREE.Group(); parent.add(g); const wm = M(0xc9d1da, { std: true, metal: 0.5, r: 0.35 });
  const W = 0.62, D = 0.95, H0 = 0.42, H1 = 0.95;
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) { cyl(0.012, 0.012, H1 - 0.06, 5, wm, g, x, (H1 + 0.06) / 2, z); cyl(0.04, 0.04, 0.035, 8, M(0x2c2f36, { std: true }), g, x, 0.04, z).rotation.z = PI / 2; }
  for (const y of [H0, (H0 + H1) / 2, H1]) { box(W, 0.012, 0.012, wm, g, 0, y, -D / 2); box(W, 0.012, 0.012, wm, g, 0, y, D / 2); box(0.012, 0.012, D, wm, g, -W / 2, y, 0); box(0.012, 0.012, D, wm, g, W / 2, y, 0); }
  for (let i = 1; i < 8; i++) { box(0.008, H1 - H0, 0.008, wm, g, -W / 2, (H0 + H1) / 2, -D / 2 + i * D / 8); box(0.008, H1 - H0, 0.008, wm, g, W / 2, (H0 + H1) / 2, -D / 2 + i * D / 8); }
  box(W, 0.012, D, wm, g, 0, H0, 0);
  const handle = cyl(0.02, 0.02, W + 0.1, 8, M(0xe84a3a, { std: true }), g, 0, H1 + 0.08, -D / 2 - 0.12); handle.rotation.z = PI / 2;
  for (const s of [1, -1]) { const a = box(0.015, 0.2, 0.015, wm, g, s * W / 2, H1, -D / 2 - 0.06); a.rotation.x = 0.6; }
  // stuff
  const r = RNG(12);
  for (let i = 0; i < 6; i++) { const b = ico(0.12 + r() * 0.06, 0, M([0x4a5a52, 0xe0d8c8, 0x7a8fb0, 0xc9a271][i % 4], { std: true }), g, (r() - 0.5) * 0.35, H1 - 0.05 + r() * 0.1, (r() - 0.5) * 0.6); b.scale.y = 0.8; }
  for (let i = 0; i < 3; i++) cyl(0.035, 0.035, 0.12, 8, M([0xe84a3a, 0x8fbf5a, 0xd9dee4][i], { std: true, metal: 0.3 }), g, -0.1 + i * 0.1, H1 + 0.1, 0.25);
  return g;
}
export function makePizzaBox(parent) {
  const g = new THREE.Group(); parent.add(g);
  const pt = textTex(128, 128, (x, w, h) => { x.fillStyle = '#f4efe6'; x.fillRect(0, 0, w, h); x.fillStyle = '#e83a2f'; x.font = `34px ${FONT}`; x.textAlign = 'center'; x.fillText('PIZZA', w / 2, 75); x.strokeStyle = '#e83a2f'; x.lineWidth = 4; x.strokeRect(10, 10, w - 20, h - 20); });
  box(0.4, 0.05, 0.4, M(0xf4efe6, { std: true }), g, 0, 0.025, 0);
  const lid = new THREE.Group(); lid.position.set(0, 0.05, -0.2); g.add(lid); box(0.4, 0.012, 0.4, M(0xf4efe6, { std: true }), lid, 0, 0, 0.2); mesh(new THREE.PlaneGeometry(0.38, 0.38), M(0xffffff, { std: true, map: pt }), lid, 0, 0.008, 0.2, false).rotation.x = -PI / 2;
  lid.rotation.x = -1.9; g.userData.lid = lid;
  const sl = new THREE.Shape(); sl.moveTo(0, 0); sl.lineTo(0.13, 0.04); sl.lineTo(0.13, -0.04); sl.lineTo(0, 0);
  const slice = mesh(new THREE.ExtrudeGeometry(sl, { depth: 0.015, bevelEnabled: false }), M(0xffc85a, { std: true }), g, -0.05, 0.065, 0.05); slice.rotation.x = -PI / 2;
  for (const [x, z] of [[0.04, 0.0], [0.08, 0.015]]) cyl(0.012, 0.012, 0.006, 8, M(0xd9452f, { std: true }), g, -0.05 + x, 0.082, 0.05 - z);
  return g;
}

// ===================== STREET =====================
export function buildStreet(scene) {
  const S = {}; const G = S.group = new THREE.Group(); G.position.copy(ST); scene.add(G);
  const road = mesh(new THREE.PlaneGeometry(80, 12), M(0x8a93a3, { std: true, r: 0.9 }), G, 0, 0, 5); road.rotation.x = -PI / 2;
  for (let i = -20; i < 20; i++) box(1.2, 0.01, 0.12, M(0xfff3c4), G, i * 2.4, 0.01, 4.0);
  box(80, 0.15, 3.2, M(0xe5ddd0, { std: true }), G, 0, 0.075, 0.4);
  for (let i = -20; i < 20; i++) box(0.02, 0.152, 3.2, M(0xcfc6b8), G, i * 1.2, 0.076, 0.4);
  const cols = [0xf6c7b6, 0xc9e3d6, 0xfde3a7, 0xcdd7f2, 0xf2d0e6, 0xd6efc7];
  for (let i = 0; i < 12; i++) {
    const w = 4 + (i % 3), h = 4 + (i * 7 % 5), x = -22 + i * 4.8;
    if (x > 5 && x < 15) continue;
    const win = textTex(128, 128, (c, W, H) => { c.fillStyle = hex(cols[i % 6]); c.fillRect(0, 0, W, H); c.fillStyle = '#8fb8d8';
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) c.fillRect(14 + a * 38, 14 + b * 38, 24, 26); c.fillStyle = 'rgba(255,255,255,0.6)'; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) c.fillRect(14 + a * 38, 14 + b * 38, 24, 4); });
    win.wrapS = win.wrapT = THREE.RepeatWrapping; win.repeat.set(w / 3, h / 3);
    box(w, h, 3, M(0xffffff, { std: true, map: win }), G, x, h / 2, -2.6, false);
  }
  for (let i = -5; i < 5; i++) { const x = i * 5 + 1; cyl(0.05, 0.06, 3.2, 6, M(0x5d6b7a, { std: true }), G, x, 1.6, 1.7); const l = box(0.5, 0.12, 0.2, M(0x5d6b7a, { std: true }), G, x - 0.2, 3.2, 1.7); ico(0.08, 0, M(0xfff6d0, { emissive: 0xfff0b0, ei: 0.6 }), G, x - 0.4, 3.1, 1.7, false); }
  // hospital at the end of the street
  const hg = new THREE.Group(); hg.position.set(10, 0, -3.0); G.add(hg);
  box(9, 7, 4, M(0xf6f9fb, { std: true }), hg, 0, 3.5, 0, false);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) box(1.0, 0.9, 0.05, M(0x9fd0ea, { std: true, r: 0.2 }), hg, -3.4 + c * 1.7, 2.5 + r * 1.6, 2.02, false);
  box(2.4, 2.1, 0.05, M(0x9fd0ea, { std: true, r: 0.2 }), hg, 0, 1.05, 2.03, false);
  const ht = textTex(512, 128, (c, W, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); c.fillStyle = '#e8463a'; c.font = `92px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('HOSPITAL', W / 2 + 40, H / 2 + 4);
    c.fillRect(30, 34, 70, 22); c.fillRect(54, 10, 22, 70); });
  mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshStandardMaterial({ map: ht, emissive: 0xffffff, emissiveMap: ht, emissiveIntensity: 0.25 }), hg, 0, 6.2, 2.06, false);
  S.cart = makeCart(G);
  return S;
}

// ===================== HOSPITAL FRONT DESK =====================
export function buildDesk(scene) {
  const S = {}; const G = S.group = new THREE.Group(); G.position.copy(DK); scene.add(G);
  const tile = textTex(128, 128, (c, W, H) => { c.fillStyle = '#e9f2f1'; c.fillRect(0, 0, W, H); c.strokeStyle = '#cfdedd'; c.lineWidth = 3; c.strokeRect(0, 0, W, H); });
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(10, 10);
  const f = mesh(new THREE.PlaneGeometry(12, 12), M(0xffffff, { std: true, map: tile, r: 0.4 }), G, 0, 0, 0); f.rotation.x = -PI / 2;
  box(12, 4, 0.2, M(0xcfeee3, { std: true }), G, 0, 2, -2.6, false);
  box(12, 0.5, 0.21, M(0x9fd9c5, { std: true }), G, 0, 0.25, -2.58, false);
  const rt = textTex(512, 96, (c, W, H) => { c.fillStyle = '#4aa98a'; c.fillRect(0, 0, W, H); c.fillStyle = '#ffffff'; c.font = `72px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('RECEPTION', W / 2, H / 2 + 4); });
  mesh(new THREE.PlaneGeometry(2.6, 0.5), M(0xffffff, { std: true, map: rt }), G, 0, 2.9, -2.49, false);
  cyl(0.28, 0.28, 0.05, 20, M(0xffffff, { std: true }), G, -2.2, 2.7, -2.47).rotation.x = PI / 2;
  box(0.02, 0.18, 0.01, M(P.ink), G, -2.2, 2.75, -2.43); box(0.13, 0.02, 0.01, M(P.ink), G, -2.15, 2.7, -2.43);
  // desk
  box(2.8, 1.1, 0.6, M(0xffffff, { std: true }), G, 0, 0.55, -0.9); box(2.9, 0.06, 0.75, M(0x7fcbb0, { std: true }), G, 0, 1.13, -0.95);
  box(2.82, 0.18, 0.02, M(0x7fcbb0, { std: true }), G, 0, 0.75, -0.59);
  const mon = box(0.5, 0.33, 0.04, M(0x2c3038, { std: true }), G, 0.75, 1.45, -1.1); box(0.06, 0.2, 0.06, M(0x2c3038), G, 0.75, 1.24, -1.1);
  box(0.46, 0.29, 0.01, M(0x9fe0f0, { emissive: 0x6fc0e0, ei: 0.5 }), G, 0.75, 1.45, -1.075);
  box(0.3, 0.02, 0.22, M(0xffffff, { std: true }), G, -0.6, 1.17, -0.85); cyl(0.05, 0.04, 0.12, 8, M(0xff8f86, { std: true }), G, -1.1, 1.22, -0.9);
  // plants + chairs
  for (const [x, z] of [[-3.5, -2.0], [3.6, -2.1]]) { cyl(0.25, 0.2, 0.5, 8, M(0xfde3a7, { std: true }), G, x, 0.25, z); const p = ico(0.45, 1, M(0x7cc48a, { std: true }), G, x, 0.9, z); p.scale.y = 1.2; }
  for (let i = 0; i < 3; i++) { box(0.55, 0.08, 0.5, M(0x9fc9ee, { std: true }), G, -4.2 + i * 0.6, 0.45, 0.4); box(0.55, 0.5, 0.08, M(0x9fc9ee, { std: true }), G, -4.2 + i * 0.6, 0.72, 0.17); }
  return S;
}

// ===================== EXAM ROOM =====================
export function buildExam(scene) {
  const S = {}; const G = S.group = new THREE.Group(); G.position.copy(EX); scene.add(G);
  const tile = textTex(128, 128, (c, W, H) => { c.fillStyle = '#dfe9f0'; c.fillRect(0, 0, W, H); c.strokeStyle = '#c4d3de'; c.lineWidth = 3; c.strokeRect(0, 0, W, H); });
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(6, 6);
  const f = mesh(new THREE.PlaneGeometry(6, 6), M(0xffffff, { std: true, map: tile, r: 0.4 }), G, 0, 0, 0); f.rotation.x = -PI / 2;
  const wm = M(0xcfe5f3, { std: true, r: 0.9 });
  S.back = new THREE.Group(); G.add(S.back);
  box(1.3, 3, 0.15, wm, S.back, -1.25, 1.5, -1.75, false); box(1.3, 3, 0.15, wm, S.back, 1.25, 1.5, -1.75, false);
  box(1.2, 0.9, 0.15, wm, S.back, 0, 0.45, -1.75, false); box(1.2, 0.8, 0.15, wm, S.back, 0, 2.6, -1.75, false);
  S.windowPane = mesh(new THREE.PlaneGeometry(1.2, 1.3), new THREE.MeshBasicMaterial({ color: 0xbfe3f7 }), S.back, 0, 1.55, -1.8, false);
  for (let i = 0; i < 6; i++) box(1.2, 0.03, 0.03, M(0xffffff), S.back, 0, 1.0 + i * 0.22, -1.66, false);
  box(1.28, 0.06, 0.12, M(0xffffff), S.back, 0, 0.92, -1.62);
  S.left = new THREE.Group(); G.add(S.left);
  box(0.15, 3, 1.3, wm, S.left, -1.75, 1.5, -1.1, false); box(0.15, 3, 1.4, wm, S.left, -1.75, 1.5, 1.05 + 0.65, false); box(0.15, 0.8, 1.0, wm, S.left, -1.75, 2.6, 0.05, false);
  S.door = new THREE.Group(); S.door.position.set(-1.7, 0, -0.45); G.add(S.door); box(0.05, 2.2, 0.95, M(0xf3e3c9, { std: true }), S.door, 0, 1.1, 0.475);
  S.right = box(0.15, 3, 3.5, wm, G, 1.75, 1.5, 0, false);
  S.ceiling = box(3.5, 0.1, 3.5, M(0xffffff), G, 0, 3.0, 0, false);
  // exam bed (along x)
  const bed = new THREE.Group(); bed.position.set(0, 0, -0.5); G.add(bed); S.bed = bed;
  box(2.0, 0.14, 0.75, M(0x9fd0e8, { std: true }), bed, 0, 0.7, 0); box(2.0, 0.02, 0.6, M(0xffffff, { std: true }), bed, 0.1, 0.78, 0);
  box(0.4, 0.1, 0.5, M(0xffffff, { std: true }), bed, -0.75, 0.82, 0);
  for (const [x, z] of [[-0.9, -0.3], [0.9, -0.3], [-0.9, 0.3], [0.9, 0.3]]) cyl(0.03, 0.03, 0.64, 6, M(0xc0c7cf, { std: true, metal: 0.4 }), bed, x, 0.32, z);
  // scan machine with a big screen
  const sc = new THREE.Group(); sc.position.set(1.05, 0, -1.25); G.add(sc); S.scanner = sc;
  box(0.55, 0.9, 0.5, M(0xf2f4f7, { std: true }), sc, 0, 0.45, 0); box(0.5, 0.05, 0.25, M(0x9fd0e8, { std: true }), sc, 0, 0.92, 0.1);
  cyl(0.03, 0.03, 0.6, 6, M(0xc0c7cf, { std: true }), sc, 0, 1.2, -0.1);
  S.screenGroup = new THREE.Group(); S.screenGroup.position.set(-0.05, 1.6, -0.05); S.screenGroup.rotation.y = -0.55; sc.add(S.screenGroup);
  box(0.8, 0.56, 0.06, M(0x2c3038, { std: true }), S.screenGroup, 0, 0, 0);
  S.screenCanvas = document.createElement('canvas'); S.screenCanvas.width = 256; S.screenCanvas.height = 176;
  S.screenTex = new THREE.CanvasTexture(S.screenCanvas); S.screenTex.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(0.72, 0.49), new THREE.MeshBasicMaterial({ map: S.screenTex }), S.screenGroup, 0, 0, 0.032, false);
  // heart monitor + IV pole
  const hm = new THREE.Group(); hm.position.set(-1.35, 0, -1.3); G.add(hm); S.heart = hm;
  cyl(0.03, 0.03, 1.4, 6, M(0xc0c7cf, { std: true }), hm, 0, 0.7, 0); box(0.45, 0.32, 0.12, M(0x2c3038, { std: true }), hm, 0, 1.55, 0);
  S.ecgCanvas = document.createElement('canvas'); S.ecgCanvas.width = 160; S.ecgCanvas.height = 100;
  S.ecgTex = new THREE.CanvasTexture(S.ecgCanvas); S.ecgTex.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(0.4, 0.26), new THREE.MeshBasicMaterial({ map: S.ecgTex }), hm, 0, 1.55, 0.065, false);
  S.ecgLight = ico(0.025, 0, M(0xff4040, { basic: true }), hm, 0.17, 1.74, 0.05, false);
  cyl(0.015, 0.015, 2.0, 6, M(0xc0c7cf, { std: true }), G, -1.2, 1.0, 0.6); box(0.18, 0.28, 0.06, M(0xd8f0ff, { std: true, opacity: 0.8 }), G, -1.2, 1.85, 0.6);
  // shelf with books
  box(0.9, 0.04, 0.3, M(0xffffff), G, 1.2, 1.9, -1.6); for (let i = 0; i < 6; i++) box(0.08, 0.28, 0.22, M([0xe8463a, 0x5a8fd8, 0x7cc48a, 0xffc85a, 0xc9a0ec, 0x4aa98a][i], { std: true }), G, 0.85 + i * 0.12, 2.06, -1.6);
  return S;
}
// ultrasound screen: grey fan with a tiny baby waving
export function drawScan(S, T, on = true, wave = 0) {
  const c = S.screenCanvas.getContext('2d'), W = c.canvas.width, H = c.canvas.height;
  c.fillStyle = '#0b0f14'; c.fillRect(0, 0, W, H);
  if (on) {
    const g = c.createRadialGradient(W / 2, -20, 10, W / 2, -20, H * 1.2); g.addColorStop(0, '#5a6470'); g.addColorStop(1, '#1d232b');
    c.fillStyle = g; c.beginPath(); c.moveTo(W / 2, -10); c.arc(W / 2, -10, H * 1.05, PI * 0.28, PI * 0.72); c.closePath(); c.fill();
    for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(255,255,255,${0.04 + (i * 37 % 10) / 120})`; c.fillRect((i * 73 + Math.floor(T * 30) * 13) % W, 30 + (i * 41) % (H - 30), 2, 2); }
    const bx = W / 2 + 6, by = H * 0.6;
    c.fillStyle = '#e8eef4'; c.strokeStyle = '#e8eef4'; c.lineCap = 'round';
    c.beginPath(); c.arc(bx - 18, by - 14, 17, 0, PI * 2); c.fill();                 // head
    c.beginPath(); c.ellipse(bx + 10, by + 4, 24, 15, 0.3, 0, PI * 2); c.fill();       // body
    c.lineWidth = 6; c.beginPath(); c.moveTo(bx + 26, by + 12); c.lineTo(bx + 34, by + 24); c.stroke();
    const a = -1.1 + 0.6 * Math.sin(T * 9) * wave;                                    // waving arm
    c.beginPath(); c.moveTo(bx - 4, by - 4); c.lineTo(bx - 4 + Math.cos(a) * 26, by - 4 + Math.sin(a) * 26); c.stroke();
    c.fillStyle = '#0b0f14'; c.fillRect(bx - 25, by - 18, 4, 3); c.fillRect(bx - 15, by - 18, 4, 3);
    c.fillStyle = '#7fd0ff'; c.font = 'bold 14px sans-serif'; c.fillText('SCAN  09:41', 8, H - 8);
  }
  S.screenTex.needsUpdate = true;
}
export function drawEcg(S, T) {
  const c = S.ecgCanvas.getContext('2d'), W = c.canvas.width, H = c.canvas.height;
  c.fillStyle = '#071a10'; c.fillRect(0, 0, W, H); c.strokeStyle = '#4dff8a'; c.lineWidth = 3; c.beginPath();
  for (let x = 0; x < W; x++) { const ph = ((x / W) * 2 + T * 1.2) % 1; let y = H * 0.6;
    if (ph > 0.42 && ph < 0.46) y -= (ph - 0.42) / 0.04 * H * 0.45; else if (ph >= 0.46 && ph < 0.5) y -= (0.5 - ph) / 0.04 * H * 0.45 - 6; x ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke(); c.fillStyle = '#4dff8a'; c.font = 'bold 18px sans-serif'; c.fillText('♥ 82', 6, 20);
  S.ecgTex.needsUpdate = true;
}
