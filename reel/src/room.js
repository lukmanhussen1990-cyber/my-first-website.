// Small bedroom at night: bed with messy blanket, desk + warm lamp, window with moonlit city, props.
import * as THREE from 'three';
import { facet, mat, mesh, loft, blob, box, canvasTex, FAST } from './geo.js';
import { mulberry32, noise2, TAU } from './util.js';

export const BED = { x0: -1.72, x1: 0.48, z0: -2.14, z1: -0.62, top: 0.5 };
export const SEAT = new THREE.Vector3(-0.3, BED.top + 0.065, -0.84);   // hip centre of the character

function woodTex() {
  return canvasTex(1024, 1024, (c, w, h) => {
    const rnd = mulberry32(42); const rows = 8, ph = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * 300;
      while (x < w) {
        const pw = 260 + rnd() * 280; const l = 34 + rnd() * 12, s = 42 + rnd() * 10, hu = 24 + rnd() * 8;
        c.fillStyle = `hsl(${hu},${s}%,${l}%)`; c.fillRect(x, r * ph, pw, ph);
        for (let i = 0; i < 26; i++) { c.strokeStyle = `hsla(${hu - 4},${s}%,${l - 6 - rnd() * 10}%,${0.12 + rnd() * 0.2})`; c.lineWidth = 1 + rnd() * 2; const y = r * ph + rnd() * ph; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + pw * 0.3, y + (rnd() - 0.5) * 10, x + pw * 0.6, y + (rnd() - 0.5) * 10, x + pw, y + (rnd() - 0.5) * 6); c.stroke(); }
        c.fillStyle = 'rgba(20,10,5,0.55)'; c.fillRect(x, r * ph, 3, ph);
        x += pw;
      }
      c.fillStyle = 'rgba(20,10,5,0.6)'; c.fillRect(0, r * ph, w, 3);
    }
  }, { repeat: [2.2, 2.6] });
}
function wallTex(base) {
  return canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h); const rnd = mulberry32(7);
    for (let i = 0; i < 2600; i++) { const a = rnd() * 0.05; c.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; const s = 2 + rnd() * 14; c.fillRect(rnd() * w, rnd() * h, s, s * (0.4 + rnd())); }
  }, { repeat: [3, 2] });
}
function nightTex() {
  return canvasTex(512, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a1030'); g.addColorStop(0.6, '#1b2a63'); g.addColorStop(1, '#3a3f86'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    const rnd = mulberry32(5);
    for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`; const s = 1 + rnd() * 2.2; c.fillRect(rnd() * w, rnd() * h * 0.6, s, s); }
    const mg = c.createRadialGradient(370, 120, 10, 370, 120, 130); mg.addColorStop(0, 'rgba(255,250,220,0.9)'); mg.addColorStop(0.25, 'rgba(200,215,255,0.35)'); mg.addColorStop(1, 'rgba(160,190,255,0)'); c.fillStyle = mg; c.fillRect(200, 0, 312, 300);
    c.fillStyle = '#fff8dc'; c.beginPath(); c.arc(370, 120, 38, 0, TAU); c.fill(); c.fillStyle = 'rgba(190,190,170,0.5)'; c.beginPath(); c.arc(382, 108, 9, 0, TAU); c.arc(356, 132, 6, 0, TAU); c.fill();
    let x = -10;
    while (x < w) { const bw = 40 + rnd() * 60, bh = 110 + rnd() * 170; c.fillStyle = '#070b1c'; c.fillRect(x, h - bh, bw, bh); for (let yy = h - bh + 12; yy < h - 8; yy += 20) for (let xx = x + 8; xx < x + bw - 10; xx += 15) if (rnd() > 0.62) { c.fillStyle = rnd() > 0.3 ? '#ffd070' : '#9fd8ff'; c.fillRect(xx, yy, 7, 10); } x += bw + 2; }
  });
}
function posterTex(kind) {
  return canvasTex(256, 360, (c, w, h) => {
    if (kind === 0) { // retro sun
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2b1055'); g.addColorStop(1, '#d53369'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffcf5c'; c.beginPath(); c.arc(w / 2, h * 0.5, 70, 0, TAU); c.fill(); c.fillStyle = '#2b1055'; for (let i = 0; i < 5; i++) c.fillRect(0, h * 0.5 + 8 + i * 15, w, 4 + i * 1.5);
      c.fillStyle = '#12082a'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * 0.78); c.lineTo(70, h * 0.62); c.lineTo(130, h * 0.76); c.lineTo(190, h * 0.6); c.lineTo(w, h * 0.74); c.lineTo(w, h); c.fill();
    } else if (kind === 1) { // rocket
      c.fillStyle = '#10243f'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4f1de'; c.beginPath(); c.moveTo(w / 2, 50); c.quadraticCurveTo(w / 2 + 50, 150, w / 2 + 32, 250); c.lineTo(w / 2 - 32, 250); c.quadraticCurveTo(w / 2 - 50, 150, w / 2, 50); c.fill();
      c.fillStyle = '#e07a5f'; c.beginPath(); c.moveTo(w / 2 - 32, 210); c.lineTo(w / 2 - 66, 270); c.lineTo(w / 2 - 32, 250); c.fill(); c.beginPath(); c.moveTo(w / 2 + 32, 210); c.lineTo(w / 2 + 66, 270); c.lineTo(w / 2 + 32, 250); c.fill();
      c.fillStyle = '#3d9be9'; c.beginPath(); c.arc(w / 2, 150, 18, 0, TAU); c.fill(); c.fillStyle = '#f2cc8f'; c.beginPath(); c.moveTo(w / 2 - 20, 252); c.lineTo(w / 2, 320); c.lineTo(w / 2 + 20, 252); c.fill();
    } else { // abstract
      c.fillStyle = '#f2e9d8'; c.fillRect(0, 0, w, h); const cols = ['#e76f51', '#2a9d8f', '#e9c46a', '#264653']; const rnd = mulberry32(3);
      for (let i = 0; i < 9; i++) { c.fillStyle = cols[i % 4]; c.beginPath(); c.moveTo(rnd() * w, rnd() * h); c.lineTo(rnd() * w, rnd() * h); c.lineTo(rnd() * w, rnd() * h); c.fill(); }
    }
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
  });
}

export function buildRoom() {
  const g = new THREE.Group();
  const std = (color, o = {}) => { if (FAST && !o.keepStd) { const { roughness, keepStd, ...rest } = o; return new THREE.MeshLambertMaterial({ color, ...rest }); } const { keepStd, ...r2 } = o; return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...r2 }); };

  // --- shell ---
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 5.2), std(0xffffff, { map: woodTex(), roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0.3); floor.receiveShadow = true; g.add(floor);
  const wallM = std(0xffffff, { map: wallTex('#6f7fa6'), roughness: 0.95 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.7), wallM); back.position.set(0, 1.35, -2.2); back.receiveShadow = true; g.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.7), wallM); left.rotation.y = Math.PI / 2; left.position.set(-2.2, 1.35, 0.3); left.receiveShadow = true; g.add(left);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.7), wallM); right.rotation.y = -Math.PI / 2; right.position.set(2.2, 1.35, 0.3); right.receiveShadow = true; g.add(right);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 5.2), std(0x596382)); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 2.7, 0.3); g.add(ceil);
  const baseM = mat(0xe9e4da);
  mesh(box(4.4, 0.1, 0.03), baseM, { pos: [0, 0.05, -2.185], parent: g, cast: false });
  mesh(box(0.03, 0.1, 5.2), baseM, { pos: [-2.185, 0.05, 0.3], parent: g, cast: false });
  mesh(box(0.03, 0.1, 5.2), baseM, { pos: [2.185, 0.05, 0.3], parent: g, cast: false });

  // --- bed ---
  const bw = BED.x1 - BED.x0, bd = BED.z1 - BED.z0, bcx = (BED.x0 + BED.x1) / 2, bcz = (BED.z0 + BED.z1) / 2;
  const woodM = mat(0x5a3a26, { roughness: 0.7 });
  mesh(box(bw + 0.08, 0.2, bd + 0.06, { seed: 4 }), woodM, { pos: [bcx, 0.18, bcz], parent: g });
  for (const [x, z] of [[BED.x0 + 0.06, BED.z1 - 0.06], [BED.x1 - 0.06, BED.z1 - 0.06]]) mesh(box(0.08, 0.1, 0.08), woodM, { pos: [x, 0.05, z], parent: g });
  mesh(box(0.08, 0.95, bd + 0.06, { seed: 6, sy: 2, sz: 3 }), woodM, { pos: [BED.x0 - 0.02, 0.5, bcz], parent: g });   // headboard
  mesh(box(bw, 0.22, bd, { seed: 8, sx: 4, sz: 3 }), mat(0xe8e2d6, { roughness: 0.95 }), { pos: [bcx, 0.39, bcz], parent: g });   // mattress
  // messy blanket: displaced grid, drapes over the front edge
  {
    const nx = 22, nz = 16; const x0 = -1.2, x1 = BED.x1 + 0.03, z0 = BED.z0 + 0.05, zEdge = BED.z1 + 0.035; const drop = 0.3; const zLen = (zEdge - z0) + drop;
    const P = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const u = i / nx, v = j / nz; let x = x0 + (x1 - x0) * u; const s = v * zLen; let z, y;
      const wr = noise2(u * 5.2, v * 4.3, 1) * 0.034 + noise2(u * 11, v * 9, 2) * 0.016;
      const heap = Math.exp(-((x + 0.95) ** 2 * 5 + (z0 + s + 1.6) ** 2 * 7)) * 0.16;   // crumpled heap toward the pillow/back
      if (s < zEdge - z0) { z = z0 + s; y = BED.top + 0.02 + Math.abs(wr) * 1.6 + wr * 0.4 + heap; }
      else { const dd = s - (zEdge - z0); z = zEdge + 0.02 + Math.sin(u * 17) * 0.012 + wr * 0.5; y = BED.top + 0.012 - dd + Math.abs(wr) * 0.3; }
      // turned-back corner near the pillow
      const fold = Math.max(0, 1 - Math.hypot((x - x0) * 2.2, (z - z0) * 0.9)); x += fold * 0.12; y += fold * 0.05;
      // right side drape
      if (u > 0.93) { const k = (u - 0.93) / 0.07; x = x1 + 0.005; y -= k * 0.22; }
      P.push(new THREE.Vector3(x, y, z));
    }
    const pos = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = P[j * (nx + 1) + i], b = P[j * (nx + 1) + i + 1], c = P[(j + 1) * (nx + 1) + i], d = P[(j + 1) * (nx + 1) + i + 1];
      const push = (...v) => v.forEach((q) => pos.push(q.x, q.y, q.z));
      if ((i + j) % 2) { push(a, c, b); push(b, c, d); } else { push(a, c, d); push(a, d, b); }
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const blanket = mesh(facet(bg, 0.085, 21), mat(0x4f8f86, { roughness: 0.95, side: THREE.DoubleSide }), { parent: g });
    g.userData.blanket = blanket;
  }
  // pillows
  const pillowG = blob(1, 2, (v, n) => { v.set(n.x * 0.3 * (1 - 0.25 * n.y * n.y), n.y * 0.085 * (1 + 0.5 * (1 - n.x * n.x) * (1 - n.z * n.z)), n.z * 0.2 * (1 - 0.2 * n.y * n.y)); }, { seed: 31, jitter: 0.05 });
  mesh(pillowG, mat(0xf3efe6, { roughness: 0.95 }), { pos: [-1.42, BED.top + 0.09, -1.55], rot: [0.05, 1.45, 0.12], parent: g });
  mesh(pillowG, mat(0x3f6fb5, { roughness: 0.95 }), { pos: [-1.38, BED.top + 0.1, -1.05], rot: [-0.1, 1.2, 0.3], scale: 0.8, parent: g });

  // --- window on back wall ---
  const win = new THREE.Group(); win.position.set(-0.55, 1.62, -2.19); g.add(win);
  const ww = 1.25, wh = 1.1;
  const nightMat = new THREE.MeshBasicMaterial({ map: nightTex(), color: new THREE.Color(0.75, 0.8, 1.0) });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), nightMat); glass.position.z = 0.005; win.add(glass);
  const frM = mat(0xf1ede4, { roughness: 0.6 });
  mesh(box(ww + 0.12, 0.06, 0.07), frM, { pos: [0, wh / 2 + 0.03, 0.03], parent: win }); mesh(box(ww + 0.2, 0.06, 0.14), frM, { pos: [0, -wh / 2 - 0.03, 0.06], parent: win });
  mesh(box(0.06, wh, 0.07), frM, { pos: [-ww / 2 - 0.03, 0, 0.03], parent: win }); mesh(box(0.06, wh, 0.07), frM, { pos: [ww / 2 + 0.03, 0, 0.03], parent: win });
  mesh(box(0.035, wh, 0.04), frM, { pos: [0, 0, 0.025], parent: win }); mesh(box(ww, 0.035, 0.04), frM, { pos: [0, 0.08, 0.025], parent: win });
  // curtains
  const curtG = (seed) => { const secs = []; for (let i = 0; i <= 6; i++) { const y = -0.75 + i * 0.25; secs.push({ y, rx: 0.17 - i * 0.008 + Math.sin(i * 2.1 + seed) * 0.02, rz: 0.045, x: Math.sin(i * 1.3 + seed) * 0.015 }); } return loft(secs, 10, { seed: 40 + seed, jitter: 0.09 }); };
  const curtM = mat(0x8a4f7d, { roughness: 1 });
  mesh(curtG(1), curtM, { pos: [-ww / 2 - 0.16, -0.05, 0.08], parent: win }); mesh(curtG(2), curtM, { pos: [ww / 2 + 0.16, -0.05, 0.08], parent: win });
  mesh(box(ww + 0.8, 0.035, 0.035), mat(0x2b2b33, { roughness: 0.4 }), { pos: [0, wh / 2 + 0.16, 0.09], parent: win });

  // --- desk + lamp on the right ---
  const desk = new THREE.Group(); desk.position.set(1.42, 0, -1.82); g.add(desk);
  const deskM = mat(0x8a5a3a, { roughness: 0.6 });
  mesh(box(1.3, 0.05, 0.62, { sx: 3 }), deskM, { pos: [0, 0.74, 0], parent: desk });
  for (const [x, z] of [[-0.6, -0.26], [0.6, -0.26], [-0.6, 0.26], [0.6, 0.26]]) mesh(box(0.05, 0.72, 0.05), deskM, { pos: [x, 0.36, z], parent: desk });
  mesh(box(0.42, 0.3, 0.55), mat(0x7a4e32, { roughness: 0.6 }), { pos: [0.4, 0.57, 0], parent: desk });
  // lamp
  const lamp = new THREE.Group(); lamp.position.set(-0.42, 0.765, -0.05); desk.add(lamp);
  const lampM = mat(0x2f3544, { roughness: 0.35, metalness: 0.4 });
  mesh(facet(new THREE.CylinderGeometry(0.085, 0.1, 0.03, 8), 0.05, 3), lampM, { pos: [0, 0.015, 0], parent: lamp });
  mesh(facet(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 5), 0.05, 4), lampM, { pos: [0.03, 0.2, 0], rot: [0, 0, -0.17], parent: lamp });
  mesh(facet(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 5), 0.05, 5), lampM, { pos: [-0.03, 0.44, 0.04], rot: [0.3, 0, 0.75], parent: lamp });
  const shade = new THREE.Group(); shade.position.set(-0.14, 0.5, 0.09); shade.rotation.set(0.5, 0, 0.55); lamp.add(shade);
  mesh(facet(new THREE.ConeGeometry(0.105, 0.14, 8, 1, true), 0.06, 6), mat(0xe2a13c, { roughness: 0.5, side: THREE.DoubleSide, emissive: 0xff9a3c, emissiveIntensity: 0.9 }), { parent: shade, cast: false });
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.6, 1.6) })); bulb.position.y = -0.045; shade.add(bulb);
  // desk props
  mesh(box(0.34, 0.016, 0.24), mat(0x9aa3b5, { roughness: 0.35, metalness: 0.5 }), { pos: [0.12, 0.775, 0.02], rot: [0, -0.25, 0], parent: desk });
  mesh(facet(new THREE.CylinderGeometry(0.04, 0.034, 0.09, 7), 0.05, 8), mat(0xe9e4da), { pos: [-0.2, 0.81, 0.2], parent: desk });
  [[0x2a9d8f, 0.03], [0xe9c46a, 0.025], [0xe76f51, 0.035]].forEach(([c, t], i) => mesh(box(0.2, t, 0.14, { seed: i }), mat(c), { pos: [0.46, 0.78 + i * 0.03, -0.14], rot: [0, 0.2 * i - 0.2, 0], parent: desk }));
  // chair
  const chair = new THREE.Group(); chair.position.set(1.1, 0, -1.15); chair.rotation.y = -0.5; g.add(chair);
  const chM = mat(0x2f3544, { roughness: 0.6 });
  mesh(box(0.42, 0.05, 0.42), chM, { pos: [0, 0.45, 0], parent: chair }); mesh(box(0.42, 0.45, 0.05), chM, { pos: [0, 0.75, 0.2], rot: [0.08, 0, 0], parent: chair });
  for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) mesh(box(0.035, 0.44, 0.035), chM, { pos: [x, 0.22, z], parent: chair });
  // hoodie tossed over the chair
  mesh(blob(1, 1, (v, n) => v.set(n.x * 0.24, n.y * 0.2 - Math.abs(n.x) * 0.06, n.z * 0.07), { seed: 12, jitter: 0.1 }), mat(0x4a8f6a, { roughness: 1 }), { pos: [0, 0.86, 0.2], parent: chair });

  // --- rug, slippers, misc on the floor ---
  const rug = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.95, 0.95, 0.014, 18), 0.08, 9), mat(0x39507f, { roughness: 1 })); rug.position.set(-0.25, 0.007, 0.1); rug.receiveShadow = true; g.add(rug);
  const rug2 = new THREE.Mesh(facet(new THREE.CylinderGeometry(0.7, 0.7, 0.016, 18), 0.08, 10), mat(0xd9b46a, { roughness: 1 })); rug2.position.set(-0.25, 0.009, 0.1); rug2.receiveShadow = true; g.add(rug2);
  const slipG = blob(1, 1, (v, n) => v.set(n.x * 0.05, Math.max(n.y, -0.2) * 0.03 * (1 + (n.z < 0 ? 0.6 : 0)), n.z * 0.115), { seed: 14 });
  mesh(slipG, mat(0xe8c468), { pos: [0.28, 0.04, -0.2], rot: [0, 0.5, 0], parent: g }); mesh(slipG, mat(0xe8c468), { pos: [0.42, 0.04, 0.02], rot: [0, -0.9, 0], parent: g });
  mesh(blob(0.115, 1, null, { seed: 15, jitter: 0.1 }), mat(0xd9672b, { roughness: 0.7 }), { pos: [1.55, 0.115, -0.5], parent: g });   // ball

  // --- wall decor ---
  const poster = (kind, x, y, z, ry, w = 0.5, h = 0.7, rz = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: posterTex(kind), roughness: 0.8 })); m.position.set(x, y, z); m.rotation.set(0, ry, rz); m.receiveShadow = true; g.add(m); };
  poster(0, 0.72, 1.62, -2.192, 0, 0.5, 0.7, 0.03); poster(1, -1.62, 1.7, -2.192, 0, 0.42, 0.6, -0.04); poster(2, -2.192, 1.6, -0.9, Math.PI / 2, 0.55, 0.75, 0.02);
  // shelf with books + plant on the left wall
  const shelf = new THREE.Group(); shelf.position.set(-2.08, 1.45, 0.25); g.add(shelf);
  mesh(box(0.22, 0.03, 0.9), deskM, { parent: shelf });
  const rnd = mulberry32(77); let bz = -0.38;
  for (let i = 0; i < 7; i++) { const t = 0.03 + rnd() * 0.03, hh = 0.18 + rnd() * 0.08; mesh(box(0.15, hh, t, { seed: i }), mat([0xe76f51, 0x2a9d8f, 0xe9c46a, 0x457b9d, 0xf4a261, 0x8ecae6, 0xb5838d][i]), { pos: [0, 0.015 + hh / 2, bz + t / 2], rot: [i === 6 ? 0.25 : 0, 0, 0], parent: shelf }); bz += t + 0.004; }
  mesh(facet(new THREE.CylinderGeometry(0.06, 0.045, 0.09, 7), 0.05, 2), mat(0xd9825b), { pos: [0, 0.06, 0.3], parent: shelf });
  for (let i = 0; i < 6; i++) mesh(facet(new THREE.ConeGeometry(0.03, 0.2, 4), 0.1, i), mat(0x4f9d5d), { pos: [Math.sin(i * 1.1) * 0.03, 0.18, 0.3 + Math.cos(i * 1.7) * 0.03], rot: [Math.sin(i * 2.3) * 0.5, i, Math.cos(i * 1.9) * 0.5], parent: shelf });
  // string of warm fairy lights along the back wall (tiny emissive beads -> bloom)
  const beadM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.0, 0.9) });
  for (let i = 0; i <= 26; i++) { const u = i / 26; const x = -2.1 + u * 4.2; const y = 2.42 - Math.sin(u * Math.PI * 4) ** 2 * 0.11; const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.014, 0), beadM); b.position.set(x, y, -2.17); g.add(b); }

  // --- lights ---
  const L = {};
  L.hemi = new THREE.HemisphereLight(0x5567b8, 0x2c2430, 0.75);
  L.key = new THREE.DirectionalLight(0xffe2c4, 0.55); L.key.position.set(0.5, 3, 2.2); L.key.target.position.set(-0.3, 1.0, -0.7); g.add(L.key, L.key.target); g.add(L.hemi);
  L.lamp = new THREE.SpotLight(0xffc48a, 15, 9, 1.05, 0.7, 1.6);
  L.lamp.position.set(0.86, 1.42, -1.62); L.lamp.target.position.set(-0.45, 0.55, -0.55); g.add(L.lamp, L.lamp.target);
  L.lamp.castShadow = true; L.lamp.shadow.mapSize.set(2048, 2048); L.lamp.shadow.bias = -0.0006; L.lamp.shadow.normalBias = 0.012; L.lamp.shadow.radius = 5; L.lamp.shadow.camera.near = 0.3; L.lamp.shadow.camera.far = 7;
  L.lampGlow = new THREE.PointLight(0xff9a4a, 2.2, 3.2, 1.8); L.lampGlow.position.set(0.95, 1.2, -1.75); g.add(L.lampGlow);
  L.moon = new THREE.SpotLight(0x8fb0ff, 16, 9, 0.75, 0.9, 1.2); L.moon.position.set(-0.75, 2.5, -2.9); L.moon.target.position.set(-0.3, 0.6, 0.2); g.add(L.moon, L.moon.target);
  L.fill = new THREE.PointLight(0x7b8cff, 1.6, 6, 1.4); L.fill.position.set(-0.6, 1.5, 2.2); g.add(L.fill);
  L.bounce = new THREE.PointLight(0xff8a5c, 0.9, 3.5, 1.6); L.bounce.position.set(-0.2, 0.35, -0.2); g.add(L.bounce);
  L.red = new THREE.PointLight(0xff1a1a, 0, 7, 1.3); L.red.position.set(-0.3, 1.9, 0.7); g.add(L.red);
  L.flash = new THREE.DirectionalLight(0xcfe0ff, 0); L.flash.position.set(-0.6, 2.2, -3.2); L.flash.target.position.set(-0.3, 1.0, 0); g.add(L.flash, L.flash.target);
  return { group: g, L, nightMat, bulb, shade };
}
