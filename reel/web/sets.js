// Sets & props, all built from code (low-poly, flat shaded).
import * as THREE from './three.module.js';
import { mat, basic, mesh, box, cyl, ico, cone, at, group, canvasTex, tube, heartMesh, glowSprite, facet } from './lowpoly.js';
import { hash, rng } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function plane(w, h, color, o = {}) {
  const m = mesh(new THREE.PlaneGeometry(w, h, o.sx ?? 1, o.sy ?? 1), color, { jit: o.jit ?? 0.03, ...o });
  return m;
}
function texPlane(w, h, tex, o = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), o.lit ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: new THREE.Color(o.emissive ?? '#000'), emissiveMap: o.emissive ? tex : null, emissiveIntensity: o.ei ?? 1, transparent: !!o.transparent })
    : new THREE.MeshBasicMaterial({ map: tex, toneMapped: o.toneMapped ?? false, transparent: !!o.transparent, side: o.side ?? THREE.FrontSide }));
  m.receiveShadow = !!o.lit;
  return m;
}

// ------------------------------------------------------------------ textures
function spreadsheetTex() {
  return canvasTex(512, 300, (x, w, h) => {
    x.fillStyle = '#f4faf6'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#1f8f5c'; x.fillRect(0, 0, w, 28);
    x.fillStyle = '#ffffff'; x.font = 'bold 16px sans-serif'; x.fillText('Q4_FINAL_final_v7.xlsx', 10, 19);
    x.strokeStyle = '#c9d6cf'; x.lineWidth = 1;
    for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(0, 28 + i * 22); x.lineTo(w * 0.62, 28 + i * 22); x.stroke(); }
    for (let j = 0; j < 6; j++) { x.beginPath(); x.moveTo(j * 52, 28); x.lineTo(j * 52, h); x.stroke(); }
    x.fillStyle = '#2c3e50'; x.font = '13px sans-serif';
    const r = rng(5);
    for (let i = 1; i < 12; i++) for (let j = 0; j < 6; j++) { if (r() < 0.75) x.fillText(String(Math.floor(r() * 9000 + 100)), j * 52 + 6, 28 + i * 22 - 6); }
    x.fillStyle = 'rgba(255,214,64,0.6)'; x.fillRect(104, 28 + 22 * 4, 52, 22);
    const cols = ['#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#2a9d8f'];
    for (let k = 0; k < 5; k++) { const bh = 40 + k * 32; x.fillStyle = cols[k]; x.fillRect(w * 0.66 + k * 32, h - 20 - bh, 22, bh); }
    x.strokeStyle = '#e63946'; x.lineWidth = 4; x.beginPath(); x.moveTo(w * 0.66, h - 60); x.lineTo(w * 0.97, h - 200); x.stroke();
  });
}
function posterTex() {
  return canvasTex(256, 340, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a9d8f'); g.addColorStop(1, '#1d6f87'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#e9f5f3'; x.beginPath(); x.moveTo(20, 230); x.lineTo(110, 90); x.lineTo(150, 150); x.lineTo(185, 110); x.lineTo(240, 230); x.fill();
    x.fillStyle = '#ffd166'; x.beginPath(); x.arc(190, 70, 22, 0, 7); x.fill();
    x.fillStyle = '#ffffff'; x.font = 'bold 38px sans-serif'; x.textAlign = 'center'; x.fillText('SYNERGY', w / 2, 290);
    x.font = '14px sans-serif'; x.fillText('together we reach further', w / 2, 315);
  });
}
function phoneTex() {
  return canvasTex(128, 256, (x, w, h) => {
    x.fillStyle = '#0d0f14'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#ff3b3b'; x.lineWidth = 6; x.strokeRect(34, 96, 56, 30); x.fillStyle = '#ff3b3b'; x.fillRect(90, 104, 6, 14); x.fillRect(40, 102, 8, 18);
    x.font = 'bold 18px sans-serif'; x.fillStyle = '#ff5b5b'; x.textAlign = 'center'; x.fillText('1%', w / 2, 160);
  });
}
function signTex(text, sub) {
  return canvasTex(512, 200, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f1d27a'); g.addColorStop(0.5, '#c99a32'); g.addColorStop(1, '#a87a1e');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#6e4f12'; x.lineWidth = 10; x.strokeRect(8, 8, w - 16, h - 16);
    x.fillStyle = '#3a2a08'; x.textAlign = 'center'; x.font = '96px LG'; x.fillText(text, w / 2, 125);
    x.font = '30px LG'; x.fillText(sub, w / 2, 172);
  });
}
function windowsTex(seed, cols = 6, rows = 18, lit = 0.45, wc = '#ffe6a6') {
  return canvasTex(128, 384, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    const r = rng(seed);
    const cw = w / cols, rh = h / rows;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      if (r() < lit) { x.fillStyle = r() < 0.2 ? '#bfe6ff' : wc; x.globalAlpha = 0.55 + r() * 0.45; x.fillRect(j * cw + 3, i * rh + 3, cw - 6, rh - 6); }
    }
    x.globalAlpha = 1;
  });
}
export function gradTex(stops, w = 4, h = 512) {
  return canvasTex(w, h, (x) => { const g = x.createLinearGradient(0, 0, 0, h); stops.forEach(([p, c]) => g.addColorStop(p, c)); x.fillStyle = g; x.fillRect(0, 0, w, h); });
}

// ------------------------------------------------------------------ OFFICE + DESK
export const DH = 1.12;
export function buildOffice() {
  const G = new THREE.Group(); G.name = 'office';
  const refs = {}; let refs0;
  const floor = plane(16, 16, '#8f939b', { sx: 24, sy: 24, jit: 0.035 }); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 3); G.add(floor);
  const wall = plane(16, 3.2, '#ead6b2', { sx: 12, sy: 3, jit: 0.02 }); wall.position.set(0, 1.6, -1.5); G.add(wall);
  refs0 = at(box(16, 0.09, 0.025, '#f4eee2'), 0, 0.045, -1.487); G.add(refs0);
  const lw = plane(12, 3.2, '#e2cda7', { sx: 8, sy: 2 }); lw.rotation.y = Math.PI / 2; lw.position.set(-3.4, 1.6, 4.4); G.add(lw);
  const rw = plane(12, 3.2, '#e2cda7', { sx: 8, sy: 2 }); rw.rotation.y = -Math.PI / 2; rw.position.set(3.4, 1.6, 4.4); G.add(rw);
  const fw = plane(7, 3.2, '#dde3e6', { sx: 6, sy: 2 }); fw.rotation.y = Math.PI; fw.position.set(0, 1.6, 7.5); G.add(fw);
  for (let k = 0; k < 3; k++) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.5), basic('#d8efff', { toneMapped: false })); gl.rotation.y = Math.PI; gl.position.set(-2 + k * 2, 1.55, 7.47); G.add(gl);
    G.add(at(box(1.7, 0.08, 0.06, '#f5f5f5'), -2 + k * 2, 0.78, 7.45)); G.add(at(box(1.7, 0.08, 0.06, '#f5f5f5'), -2 + k * 2, 2.32, 7.45));
  }
  const ceil = plane(8, 12, '#f2f0ea'); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 2.9, 3); G.add(ceil);
  for (let k = 0; k < 4; k++) G.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.5), basic('#fffdf5', { toneMapped: false })), 0, 2.89, -0.5 + k * 2.2));
  // back wall decor: window w/ blinds, poster, clock
  const wx = -1.25, wy = 2.05;
  G.add(at(new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.95), basic('#cfeaff', { toneMapped: false })), wx, wy, -1.488));
  for (let k = 0; k < 9; k++) G.add(at(box(1.04, 0.05, 0.012, '#f1e9d8', { cast: false }), wx, wy - 0.42 + k * 0.105, -1.48, 0.5));
  G.add(at(box(1.15, 0.05, 0.05, '#fbfaf6'), wx, wy + 0.5, -1.47)); G.add(at(box(1.15, 0.05, 0.05, '#fbfaf6'), wx, wy - 0.5, -1.47));
  G.add(at(box(0.05, 1.05, 0.05, '#fbfaf6'), wx - 0.55, wy, -1.47)); G.add(at(box(0.05, 1.05, 0.05, '#fbfaf6'), wx + 0.55, wy, -1.47));
  G.add(at(box(0.5, 0.66, 0.02, '#26262c'), 1.15, 2.0, -1.49));
  G.add(at(texPlane(0.44, 0.6, posterTex(), { lit: true }), 1.15, 2.0, -1.478));
  const clk = cyl(0.13, 0.13, 0.03, 12, '#fafafa'); clk.rotation.x = Math.PI / 2; clk.position.set(0.15, 2.35, -1.48); G.add(clk);
  G.add(at(box(0.01, 0.09, 0.005, '#111'), 0.15, 2.38, -1.462, 0, 0, 0.6)); G.add(at(box(0.008, 0.06, 0.005, '#111'), 0.15, 2.37, -1.461, 0, 0, -1.2));
  refs.wallStuff = [refs0];
  // socket
  const sock = new THREE.Group(); sock.position.set(-0.42, 0.32, -1.495); G.add(sock); refs.socket = sock;
  sock.add(at(box(0.078, 0.118, 0.01, '#f3efe5', { jit: 0.02 }), 0, 0, 0));
  for (const oy of [0.026, -0.026]) {
    sock.add(at(box(0.052, 0.044, 0.008, '#e7e1d3', { jit: 0.02 }), 0, oy, 0.006));
    for (const sx of [-0.0085, 0.0085]) sock.add(at(box(0.0045, 0.014, 0.004, '#141414', { vc: false }), sx, oy + 0.004, 0.0103));
    sock.add(at(cyl(0.0035, 0.0035, 0.004, 6, '#141414'), 0, oy - 0.012, 0.0103, Math.PI / 2));
  }
  sock.add(at(cyl(0.004, 0.004, 0.004, 8, '#c9c4b8'), 0, 0, 0.007, Math.PI / 2));
  const lowPlug = box(0.044, 0.038, 0.042, '#1d1d22'); lowPlug.position.set(-0.42, 0.294, -1.465); G.add(lowPlug); refs.wallStuff.push(sock, lowPlug);
  // power strip, PC tower, bin
  G.add(at(box(0.36, 0.04, 0.066, '#f2f2f0'), -0.1, 0.022, -1.33));
  G.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.03), basic('#ff8a2a', { toneMapped: false })), -0.27, 0.046, -1.33));
  for (let k = 0; k < 3; k++) G.add(at(box(0.04, 0.035, 0.045, '#1d1d22'), -0.18 + k * 0.08, 0.06, -1.33));
  const pc = group(box(0.21, 0.47, 0.46, '#2c2e35'), at(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.4, 0.012), basic('#3ab7ff', { toneMapped: false })), -0.105, 0, 0.18));
  pc.position.set(0.55, 0.235, -1.2); G.add(pc);
  // static cable tangle
  const C = [
    [[[-0.42, 0.294, -1.44], [-0.4, 0.12, -1.38], [-0.32, 0.025, -1.3], [-0.2, 0.06, -1.33]], '#18181c'],
    [[[-0.18, 0.06, -1.33], [-0.05, 0.02, -1.15], [0.25, 0.02, -1.0], [0.45, 0.1, -1.0], [0.46, 0.3, -1.0]], '#2a2a30'],
    [[[-0.02, 0.06, -1.33], [0.15, 0.02, -1.25], [0.44, 0.03, -1.2]], '#d9d9d9'],
    [[[-0.3, DH - 0.05, -1.25], [-0.32, 0.55, -1.3], [-0.5, 0.18, -1.32], [-0.36, 0.05, -1.2], [-0.2, 0.15, -1.25], [-0.28, 0.5, -1.3], [-0.24, DH - 0.05, -1.2]], '#1d1d22'],
    [[[-0.15, DH - 0.05, -1.3], [-0.2, 0.6, -1.36], [-0.32, 0.4, -1.4], [-0.55, 0.3, -1.36], [-0.62, 0.08, -1.25], [-0.45, 0.02, -1.1], [-0.25, 0.02, -1.05]], '#3b6fd1'],
    [[[-0.55, DH - 0.05, -1.3], [-0.6, 0.6, -1.4], [-0.48, 0.45, -1.42], [-0.35, 0.5, -1.4], [-0.3, 0.3, -1.38], [-0.4, 0.1, -1.3], [-0.6, 0.02, -1.2]], '#ececec'],
    [[[0.1, DH - 0.05, -1.3], [0.05, 0.5, -1.4], [-0.1, 0.25, -1.43], [-0.25, 0.3, -1.44], [-0.35, 0.45, -1.44], [-0.5, 0.42, -1.44], [-0.62, 0.2, -1.4], [-0.7, 0.02, -1.3]], '#2a2a30'],
  ];
  refs.cables = [];
  for (const [pts, col] of C) { const tb = tube(pts, 0.0075, col, { seg: 40, cast: true }); G.add(tb); refs.cables.push(tb); }
  const coil = new THREE.Mesh(facet(new THREE.TorusGeometry(0.08, 0.008, 4, 10), 0.05), mat('#18181c')); coil.rotation.x = Math.PI / 2; coil.position.set(-0.3, 0.012, -1.15); G.add(coil);
  const coil2 = coil.clone(); coil2.position.set(-0.26, 0.022, -1.13); coil2.rotation.set(Math.PI / 2 + 0.2, 0.2, 0); G.add(coil2);
  // desk (shakeable)
  const desk = new THREE.Group(); desk.name = 'desk'; G.add(desk); refs.desk = desk;
  const wood = '#b97f4b';
  desk.add(at(box(1.72, 0.045, 0.78, wood, { jit: 0.04 }), 0, DH - 0.023, -1.12));
  desk.add(at(box(1.72, 0.012, 0.79, '#c98d57'), 0, DH + 0.001, -1.12));
  refs.deskLegs = [];
  for (const [lx, lz] of [[-0.82, -1.47], [0.82, -1.47], [-0.82, -0.77], [0.82, -0.77]]) { const lg = at(box(0.055, DH - 0.045, 0.055, '#a36d3e'), lx, (DH - 0.045) / 2, lz); desk.add(lg); refs.deskLegs.push(lg); }
  desk.add(at(box(1.6, 0.06, 0.03, '#a36d3e'), 0, DH - 0.08, -1.46));
  // monitor
  const mon = new THREE.Group(); mon.position.set(0.0, DH + 0.007, -1.33); desk.add(mon);
  mon.add(at(box(0.22, 0.014, 0.16, '#222228'), 0, 0.007, 0));
  mon.add(at(box(0.05, 0.13, 0.04, '#222228'), 0, 0.07, -0.02));
  mon.add(at(box(0.64, 0.39, 0.03, '#1b1c21'), 0, 0.3, 0));
  const scr = texPlane(0.6, 0.35, spreadsheetTex()); scr.position.set(0, 0.3, 0.0155); mon.add(scr); refs.screen = scr;
  desk.add(at(box(0.44, 0.02, 0.14, '#3a3c44'), -0.05, DH + 0.01, -0.98));
  desk.add(at(box(0.08, 0.025, 0.11, '#3a3c44'), 0.3, DH + 0.012, -0.98));
  // mug (own group so it can hop/tilt)
  const mug = new THREE.Group(); mug.position.set(0.52, DH + 0.001, -0.9); desk.add(mug); refs.mug = mug;
  mug.add(at(cyl(0.043, 0.04, 0.105, 10, '#22a08e'), 0, 0.0525, 0));
  mug.add(at(new THREE.Mesh(facet(new THREE.TorusGeometry(0.03, 0.01, 4, 8), 0.05), mat('#22a08e')), 0.05, 0.055, 0, 0, 0, 0));
  const cof = cyl(0.037, 0.037, 0.004, 10, '#4a2a14'); cof.position.y = 0.094; mug.add(cof); refs.coffee = cof;
  // pens
  refs.pens = [];
  for (const [px, pz, col] of [[0.24, -0.86, '#2f6fe0'], [0.33, -0.83, '#e23b3b']]) {
    const pen = new THREE.Group(); pen.position.set(px, DH + 0.0095, pz); desk.add(pen);
    const body = cyl(0.0065, 0.0065, 0.15, 6, '#f2f2f2'); body.rotation.z = Math.PI / 2; pen.add(body);
    const cap = cyl(0.0072, 0.0072, 0.045, 6, col); cap.rotation.z = Math.PI / 2; cap.position.x = 0.055; pen.add(cap);
    pen.userData.home = [px, DH + 0.0095, pz]; refs.pens.push(pen);
  }
  // phone
  const ph = new THREE.Group(); ph.position.set(-0.56, DH + 0.006, -0.92); desk.add(ph); refs.phone = ph;
  ph.add(box(0.075, 0.009, 0.15, '#15161b'));
  const pscr = texPlane(0.068, 0.14, phoneTex()); pscr.rotation.x = -Math.PI / 2; pscr.position.y = 0.0048; ph.add(pscr);
  // plant
  const plant = group(at(cyl(0.07, 0.055, 0.12, 7, '#d96b45'), 0, 0.06, 0));
  for (let k = 0; k < 6; k++) { const lf = cone(0.03, 0.2, 4, '#3f9d4f'); lf.position.set(Math.sin(k) * 0.03, 0.2, Math.cos(k) * 0.03); lf.rotation.set(Math.cos(k * 2) * 0.5, 0, Math.sin(k * 2) * 0.5); plant.add(lf); }
  plant.position.set(-0.72, DH + 0.001, -1.35); desk.add(plant);
  desk.add(at(box(0.22, 0.04, 0.3, '#fbfbf8'), 0.68, DH + 0.02, -1.25, 0, 0.2, 0));
  // dynamic charger cable (desk phone -> over edge -> YOU's hand)
  refs.charger = tube([[-0.55, 0.99, -0.86], [-0.55, 0.99, -0.74], [-0.56, 0.6, -0.8], [-0.5, 0.3, -1.0]], 0.006, '#f4f4f4', { seg: 30 });
  G.add(refs.charger);
  // aisle: cubicles, plants, water cooler
  for (let k = 0; k < 4; k++) {
    const x = -2.6 + k * 1.75;
    G.add(at(box(1.6, 1.25, 0.06, '#6f8aa6', { jit: 0.03 }), x, 0.625, 4.2));
    G.add(at(box(1.62, 0.03, 0.08, '#c9ced6'), x, 1.26, 4.2));
    G.add(at(box(0.5, 0.32, 0.04, '#1f2026'), x - 0.2, 1.4, 4.5));
  }
  for (const [x, z] of [[-2.9, 2.6], [2.9, 2.4], [-2.9, 5.5]]) {
    const pl = group(at(cyl(0.2, 0.16, 0.42, 8, '#e8e2d6'), 0, 0.21, 0));
    for (let k = 0; k < 7; k++) { const lf = ico(0.22, 0, '#3e9a52'); lf.position.set(Math.sin(k * 1.3) * 0.15, 0.6 + (k % 3) * 0.18, Math.cos(k * 1.3) * 0.15); lf.scale.set(0.8, 1.2, 0.8); pl.add(lf); }
    pl.position.set(x, 0, z); G.add(pl);
  }
  const wc = group(at(box(0.32, 0.9, 0.32, '#e9ecef'), 0, 0.45, 0), at(cyl(0.13, 0.13, 0.42, 10, '#8fd3ff', { transparent: true, opacity: 0.8 }), 0, 1.11, 0));
  wc.position.set(2.4, 0, 3.6); G.add(wc);
  // flashlight pool on wall
  return { G, refs };
}

// ------------------------------------------------------------------ props
export function makePlug() {
  const g = new THREE.Group();
  g.add(at(box(0.042, 0.042, 0.05, '#fbfbfb', { jit: 0.03, rough: 0.4 }), 0, 0, 0));
  for (const sx of [-0.009, 0.009]) g.add(at(box(0.004, 0.013, 0.03, '#d9b13a', { metal: 0.7, rough: 0.3, vc: false }), sx, 0, -0.038));
  g.add(at(cyl(0.006, 0.006, 0.03, 6, '#f4f4f4'), 0, 0, 0.035, Math.PI / 2));
  return g;
}
export function makeFlashlight() {
  const g = new THREE.Group();
  const body = cyl(0.017, 0.017, 0.16, 8, '#2b2d33', { rough: 0.5 }); body.rotation.x = Math.PI / 2; body.position.z = 0.02; g.add(body);
  const head = cyl(0.026, 0.019, 0.045, 8, '#33363d', { rough: 0.4 }); head.rotation.x = Math.PI / 2; head.position.z = 0.115; g.add(head);
  const band = cyl(0.018, 0.018, 0.02, 8, '#f2c230'); band.rotation.x = Math.PI / 2; band.position.z = -0.03; g.add(band);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.022, 10), basic('#fffbe0', { toneMapped: false })); lens.position.z = 0.138; g.add(lens);
  const gl = glowSprite('#fff4c0', 0.18, 0.9); gl.position.z = 0.15; g.add(gl);
  g.userData.lens = lens; g.userData.glow = gl;
  return g;
}
export function makeKeys() {
  const g = new THREE.Group();
  const gold = { metal: 0.85, rough: 0.25, emissive: '#5a3c00', ei: 0.6, vc: false };
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 4, 12), mat('#f5c542', gold)); g.add(ring);
  for (let k = 0; k < 3; k++) {
    const key = new THREE.Group();
    key.add(at(cyl(0.016, 0.016, 0.004, 8, '#f5c542', gold), 0, -0.005, 0, Math.PI / 2));
    key.add(at(box(0.008, 0.06, 0.004, '#f5c542', gold), 0, -0.05, 0));
    for (let j = 0; j < 3; j++) key.add(at(box(0.008, 0.006, 0.004, '#f5c542', gold), 0.007, -0.06 - j * 0.012, 0));
    key.position.set(0, -0.03, 0); key.rotation.z = (k - 1) * 0.5; g.add(key);
  }
  const tag = box(0.03, 0.04, 0.004, '#e63946'); tag.position.set(0.03, -0.035, 0.002); tag.rotation.z = -0.7; g.add(tag);
  return g;
}
export function makeMug(color = '#ffffff', text = null) {
  const g = new THREE.Group();
  g.add(at(cyl(0.04, 0.037, 0.1, 10, color), 0, 0.05, 0));
  g.add(at(new THREE.Mesh(facet(new THREE.TorusGeometry(0.028, 0.009, 4, 8), 0.05), mat(color)), 0.048, 0.052, 0));
  g.add(at(cyl(0.035, 0.035, 0.004, 10, '#4a2a14'), 0, 0.092, 0));
  return g;
}
export function makeCup() {
  const g = new THREE.Group();
  g.add(at(cyl(0.04, 0.03, 0.12, 9, '#fbfbfb'), 0, 0.06, 0));
  g.add(at(cyl(0.039, 0.035, 0.04, 9, '#8a5a32'), 0, 0.06, 0));
  g.add(at(cyl(0.043, 0.043, 0.015, 9, '#ffffff'), 0, 0.125, 0));
  return g;
}
export function makePapers(n = 1) {
  const g = new THREE.Group();
  for (let k = 0; k < n; k++) g.add(at(box(0.21, 0.004, 0.28, '#fbfbf7', { jit: 0.02 }), (k % 2) * 0.004, k * 0.004, 0));
  return g;
}
export function makeSanta() {
  const g = new THREE.Group();
  const c = cone(0.15, 0.26, 7, '#d42a3c'); c.position.y = 0.1; c.rotation.z = -0.35; g.add(c);
  const brim = new THREE.Mesh(facet(new THREE.TorusGeometry(0.15, 0.035, 4, 10), 0.06), mat('#ffffff')); brim.rotation.x = Math.PI / 2; g.add(brim);
  const pom = ico(0.04, 0, '#ffffff'); pom.position.set(0.1, 0.2, 0); g.add(pom);
  return g;
}
export function makeGradCap() {
  const g = new THREE.Group();
  g.add(at(box(0.36, 0.02, 0.36, '#16161a'), 0, 0.06, 0, 0, 0.785, 0));
  g.add(at(cyl(0.13, 0.14, 0.07, 8, '#16161a'), 0, 0.02, 0));
  g.add(at(box(0.01, 0.12, 0.01, '#f2c230'), 0.14, 0.0, 0.0));
  return g;
}
export function makeWrench() {
  const g = new THREE.Group();
  const m = { metal: 0.7, rough: 0.35, vc: false };
  g.add(at(box(0.022, 0.2, 0.012, '#b8bec8', m), 0, -0.08, 0));
  g.add(at(box(0.06, 0.04, 0.014, '#b8bec8', m), 0, -0.2, 0));
  g.add(at(box(0.02, 0.025, 0.016, '#2a2a2a'), 0, -0.215, 0));
  return g;
}

// ------------------------------------------------------------------ CORNER OFFICE (offset in X)
export const CX = 40;
export function buildCorner() {
  const G = new THREE.Group(); G.name = 'corner'; G.position.x = CX;
  const refs = {};
  // floor planks
  for (let k = 0; k < 28; k++) {
    const c = new THREE.Color('#9a6a42').offsetHSL(0, 0, (hash(k, 3) - 0.5) * 0.06);
    G.add(at(box(0.26, 0.02, 9, '#' + c.getHexString(), { jit: 0.03 }), -3.5 + k * 0.265, -0.01, 0));
  }
  const rug = cyl(1.5, 1.5, 0.012, 8, '#2f7f88', { jit: 0.05 }); rug.position.set(0.1, 0.006, -0.6); rug.scale.z = 0.75; G.add(rug);
  // glass walls: back (z=-3) and right (x=2.4)
  const frame = '#2b2f3a';
  for (let k = 0; k <= 7; k++) G.add(at(box(0.07, 3.0, 0.07, frame), -3.4 + k * 0.82, 1.5, -3));
  for (let k = 0; k <= 5; k++) G.add(at(box(0.07, 3.0, 0.07, frame), 2.4, 1.5, -3 + k * 0.82));
  G.add(at(box(5.9, 0.08, 0.1, frame), -0.5, 0.3, -3)); G.add(at(box(5.9, 0.08, 0.1, frame), -0.5, 2.95, -3));
  G.add(at(box(0.1, 0.08, 4.2, frame), 2.4, 0.3, -1)); G.add(at(box(0.1, 0.08, 4.2, frame), 2.4, 2.95, -1));
  G.add(at(box(5.9, 0.3, 0.12, '#e9e4dc'), -0.5, 0.15, -3)); G.add(at(box(0.12, 0.3, 4.2, '#e9e4dc'), 2.4, 0.15, -1));
  const ceil = plane(7, 7, '#f3f1ec'); ceil.rotation.x = Math.PI / 2; ceil.position.set(-0.5, 3.0, 0); G.add(ceil);
  // left solid wall with door
  const lw = plane(7, 3.0, '#e8e1d4', { sx: 5, sy: 2 }); lw.rotation.y = Math.PI / 2; lw.position.set(-3.4, 1.5, 0.3); G.add(lw);
  const door = new THREE.Group(); door.position.set(-3.38, 0, 0.9); G.add(door);
  door.add(at(box(0.06, 2.15, 1.0, '#8a5a34', { jit: 0.03 }), 0.03, 1.075, 0));
  door.add(at(box(0.08, 2.25, 0.08, '#efe9de'), 0.03, 1.12, -0.54)); door.add(at(box(0.08, 2.25, 0.08, '#efe9de'), 0.03, 1.12, 0.54));
  door.add(at(box(0.08, 0.08, 1.16, '#efe9de'), 0.03, 2.24, 0));
  door.add(at(cyl(0.025, 0.025, 0.05, 8, '#d9b13a', { metal: 0.7, rough: 0.3 }), 0.08, 1.05, 0.38, 0, 0, Math.PI / 2));
  const sign = new THREE.Group(); sign.position.set(0.075, 1.55, 0); door.add(sign); refs.sign = sign;
  const sf = texPlane(0.5, 0.2, signTex('THE BOSS', 'CORNER OFFICE'), { lit: true, emissive: '#ffffff', ei: 0.55 }); sf.rotation.y = Math.PI / 2; sf.position.x = 0.007; sign.add(sf);
  const sb = texPlane(0.5, 0.2, signTex('YOU', 'CORNER OFFICE'), { lit: true, emissive: '#ffffff', ei: 0.55 }); sb.rotation.set(0, -Math.PI / 2, Math.PI); sb.position.x = -0.007; sign.add(sb);
  sign.add(at(box(0.01, 0.21, 0.51, '#8a6a20'), 0, 0, 0));
  // executive desk
  const desk = new THREE.Group(); desk.position.set(0.9, 0, -1.55); G.add(desk); refs.desk = desk;
  const walnut = '#5a3824';
  desk.add(at(box(1.9, 0.06, 0.85, walnut, { jit: 0.04 }), 0, 0.78, 0));
  desk.add(at(box(0.48, 0.75, 0.8, '#4c2f1e'), -0.68, 0.375, 0)); desk.add(at(box(0.48, 0.75, 0.8, '#4c2f1e'), 0.68, 0.375, 0));
  desk.add(at(box(0.88, 0.32, 0.03, '#4c2f1e'), 0, 0.6, -0.3));
  for (const dx of [-0.68, 0.68]) for (const dy of [0.2, 0.45, 0.65]) desk.add(at(box(0.03, 0.012, 0.012, '#d9b13a', { metal: 0.6 }), dx, dy, 0.41));
  const lap = group(at(box(0.36, 0.015, 0.25, '#c9ccd2', { metal: 0.4, rough: 0.4 }), 0, 0, 0), at(box(0.36, 0.24, 0.012, '#c9ccd2', { metal: 0.4 }), 0, 0.12, -0.12, -0.25));
  lap.position.set(-0.25, 0.82, -0.05); desk.add(lap);
  const bm = makeMug('#ffffff'); bm.position.set(0.45, 0.81, 0.1); desk.add(bm);
  desk.add(at(box(0.3, 0.06, 0.06, '#d9b13a', { metal: 0.5 }), 0.2, 0.84, 0.3, -0.3));
  const dpl = group(at(cyl(0.06, 0.05, 0.1, 7, '#2a9d8f'), 0, 0.05, 0)); for (let k = 0; k < 5; k++) { const lf = cone(0.025, 0.14, 4, '#43a85a'); lf.position.set(Math.sin(k * 1.3) * 0.02, 0.15, Math.cos(k * 1.3) * 0.02); lf.rotation.set(Math.cos(k * 2) * 0.5, 0, Math.sin(k * 2) * 0.5); dpl.add(lf); }
  dpl.position.set(-0.75, 0.81, -0.2); desk.add(dpl);
  // chair
  const chair = group(at(box(0.55, 0.08, 0.5, '#1c1c22'), 0, 0.5, 0), at(box(0.55, 0.8, 0.1, '#1c1c22'), 0, 0.95, -0.24), at(cyl(0.03, 0.03, 0.42, 6, '#777'), 0, 0.25, 0), at(cyl(0.28, 0.28, 0.03, 5, '#333'), 0, 0.03, 0));
  chair.position.set(0.9, 0, -2.3); G.add(chair);
  // big plant & lamp
  const bp = group(at(cyl(0.28, 0.22, 0.55, 8, '#f0ece4'), 0, 0.275, 0));
  for (let k = 0; k < 9; k++) { const lf = ico(0.28, 0, k % 2 ? '#3a9450' : '#4fae5f'); lf.position.set(Math.sin(k * 1.7) * 0.2, 0.85 + (k % 3) * 0.25, Math.cos(k * 1.7) * 0.2); lf.scale.set(0.8, 1.3, 0.8); bp.add(lf); }
  bp.position.set(-2.8, 0, -2.4); G.add(bp);
  // whiteboard
  const wb = new THREE.Group(); wb.position.set(-1.2, 0, -1.4); wb.rotation.y = 0.3; G.add(wb); refs.wb = wb;
  wb.add(at(box(1.2, 0.82, 0.04, '#d8dde3'), 0, 1.08, 0));
  const wtex = canvasTex(600, 400, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); });
  refs.wbTex = wtex;
  const wbs = texPlane(1.14, 0.76, wtex, { lit: true }); wbs.position.set(0, 1.08, 0.021); wb.add(wbs);
  for (const sx of [-0.5, 0.5]) wb.add(at(box(0.04, 0.7, 0.04, '#9aa1ab'), sx, 0.35, 0));
  wb.add(at(box(1.1, 0.03, 0.06, '#9aa1ab'), 0, 0.65, 0.02));
  // skyline outside
  const city = new THREE.Group(); G.add(city); refs.city = city;
  const r = rng(42);
  const pal = ['#2d4a6b', '#3a5d7f', '#29506a', '#45648a', '#355877', '#4b5d86'];
  for (let i = 0; i < 70; i++) {
    const ang = -0.15 + r() * 1.9; // spread around the corner (behind both glass walls)
    const dist = 14 + r() * 45;
    const bx = 1.0 + Math.cos(ang) * dist, bz = -2.0 - Math.sin(ang) * dist;
    const bw = 2 + r() * 4, bd = 2 + r() * 4, bh = 6 + r() * 26 * (1 - dist / 80);
    const col = pal[Math.floor(r() * pal.length)];
    const tex = windowsTex(i + 7, 5, 16, 0.35 + r() * 0.3);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(Math.max(1, Math.round(bw / 2)), Math.max(1, Math.round(bh / 10)));
    const m = new THREE.Mesh(facet(new THREE.BoxGeometry(bw, bh, bd), 0.05, i, true),
      new THREE.MeshStandardMaterial({ color: col, flatShading: true, roughness: 0.9, vertexColors: true, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.9 }));
    m.position.set(bx, -18 + bh / 2 + (r() * 6), bz); city.add(m);
    if (r() < 0.25) { const sp = cone(bw * 0.3, 3, 4, col); sp.position.set(bx, m.position.y + bh / 2 + 1.5, bz); city.add(sp); }
  }
  const sun = glowSprite('#ffb15c', 30, 0.9); sun.position.set(14, -2, -40); city.add(sun);
  const sun2 = glowSprite('#fff0c0', 9, 1); sun2.position.set(14, -2, -40); city.add(sun2);
  return { G, refs };
}

// ------------------------------------------------------------------ FLASHBACK (offset in Z)
export const FZ = -200;
export function buildFlash() {
  const G = new THREE.Group(); G.name = 'flash'; G.position.z = FZ;
  const refs = { polas: [], bokeh: [], hearts: [] };
  const cols = ['#ffd1f0', '#d6c8ff', '#ffe3c2', '#c8f0ff', '#ffffff'];
  for (let i = 0; i < 40; i++) {
    const s = glowSprite(cols[i % cols.length], 0.4 + hash(i, 1) * 1.2, 0.35 + 0.35 * hash(i, 2));
    s.position.set((hash(i, 3) - 0.5) * 6, (hash(i, 4) - 0.5) * 9, -2 - hash(i, 5) * 10); G.add(s); refs.bokeh.push(s);
  }
  for (let i = 0; i < 18; i++) { const h = heartMesh(0.06 + 0.04 * hash(i, 9), i % 3 ? '#ff4f8b' : '#ff7aa8'); h.castShadow = false; G.add(h); refs.hearts.push(h); }
  return { G, refs };
}
export function makePolaroid(photoTex, caption) {
  const g = new THREE.Group();
  const fr = box(0.36, 0.43, 0.008, '#fbfaf5', { jit: 0.025, cast: false });
  g.add(fr);
  const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.31), new THREE.MeshBasicMaterial({ map: photoTex, toneMapped: false }));
  ph.position.set(0, 0.035, 0.0045); g.add(ph);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.43), basic('#f1ede2')); back.rotation.y = Math.PI; back.position.z = -0.0045; g.add(back);
  if (caption) {
    const ct = canvasTex(512, 96, (x, w, h) => { x.fillStyle = '#fbfaf5'; x.fillRect(0, 0, w, h); x.fillStyle = '#3a3550'; x.font = '54px LG'; x.textAlign = 'center'; x.fillText(caption, w / 2, 68); });
    const cp = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.056), new THREE.MeshBasicMaterial({ map: ct, toneMapped: false })); cp.position.set(0, -0.165, 0.0046); g.add(cp);
  }
  return g;
}
