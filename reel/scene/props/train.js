// Modern white-and-red subway train (no logos). Car origin: centre of the car at rail-top height, facing +x.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { phys, std, glowMaterial, paintMaterial } from '../lib/materials.js';
import { MAT } from './machines.js';

export const CAR_L = 8.4, CAR_W = 2.3, FLOOR_Y = 0.95, ROOF_Y = 3.15;
const rbox = (w, h, d, r = 0.05, s = 2) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));

let M = null;
function mats() {
  if (M) return M;
  M = {
    white: paintMaterial('#e6e3dd', { amount: 0.12, rough: 0.3, clearcoat: 0.8, dirtColor: '#8a8580', key: 'tw' }),
    red: paintMaterial('#d2232a', { amount: 0.1, rough: 0.3, clearcoat: 0.9, dirtColor: '#5a2020', key: 'tr' }),
    darkBand: phys({ color: 0x15191d, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }, 'band'),
    glass: phys({ color: 0x9fb4c2, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1, depthWrite: false }, 'clearglass'),
    under: std({ color: 0x2a2b2d, roughness: 0.6, metalness: 0.5 }, 'under'),
    wheel: std({ color: 0x6d7073, roughness: 0.35, metalness: 0.9 }, 'wheel'),
    interior: std({ color: 0xfff0dc, roughness: 0.8, emissive: new THREE.Color('#ffd9a8'), emissiveIntensity: 0.35, side: THREE.BackSide }, 'interior'),
    seat: std({ color: 0x2f5d8a, roughness: 0.7 }, 'tseat'),
    head: glowMaterial('#fff6e6', 8, 'thead'),
    tail: glowMaterial('#ff3020', 5, 'ttail'),
  };
  return M;
}

// interior painted onto glowing window panels
function windowTexture(kind) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  if (kind === 'sleep') { grad.addColorStop(0, '#a9b7ff'); grad.addColorStop(1, '#5a63b8'); }
  else if (kind === 'cinema') { grad.addColorStop(0, '#3a2c52'); grad.addColorStop(1, '#1d1530'); }
  else { grad.addColorStop(0, '#fff3d8'); grad.addColorStop(1, '#f5c98a'); }
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  if (kind === 'snack') {
    // shelves full of colourful snacks
    const cols = ['#ff5a4e', '#ffd23f', '#3bceac', '#ee8434', '#7b5cd6', '#4ea8ff', '#ff86c8'];
    for (let s = 0; s < 3; s++) {
      const y = 40 + s * 70;
      g.fillStyle = '#b07a48'; g.fillRect(0, y + 44, 512, 8);
      for (let i = 0; i < 22; i++) { g.fillStyle = cols[(i * 3 + s) % cols.length]; const w = 14 + (i * 7) % 10, h = 26 + (i * 5) % 16; g.beginPath(); g.roundRect(8 + i * 23, y + 44 - h, w, h, 4); g.fill(); }
    }
  } else if (kind === 'sleep') {
    for (let b = 0; b < 2; b++) {
      const y = 70 + b * 95;
      g.fillStyle = '#e8ecff'; g.beginPath(); g.roundRect(20, y, 472, 40, 10); g.fill();          // mattress + blanket
      g.fillStyle = '#ff9fb5'; g.beginPath(); g.roundRect(150, y - 6, 340, 42, 12); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(80, y + 4, 46, 18, 0, 0, 7); g.fill();      // pillow
      g.fillStyle = '#7a5a3e'; g.fillRect(0, y + 40, 512, 10);
    }
  } else if (kind === 'cinema') {
    g.fillStyle = '#fffbe8'; g.shadowColor = '#fff6c8'; g.shadowBlur = 40; g.beginPath(); g.roundRect(90, 22, 332, 120, 8); g.fill(); g.shadowBlur = 0;
    g.fillStyle = '#8fd3ff'; g.beginPath(); g.roundRect(104, 34, 304, 96, 6); g.fill();
    g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(256, 82, 26, 0, 7); g.fill();
    g.fillStyle = '#4f9a43'; g.fillRect(104, 112, 304, 18);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) { g.fillStyle = '#c0283a'; g.beginPath(); g.roundRect(30 + i * 52, 170 + r * 40, 40, 34, 10); g.fill(); }
  } else {
    // seats and grab poles
    for (let i = 0; i < 6; i++) { g.fillStyle = '#2f5d8a'; g.beginPath(); g.roundRect(20 + i * 82, 150, 62, 70, 14); g.fill(); }
    g.fillStyle = '#d8d8d8'; for (let i = 0; i < 4; i++) g.fillRect(70 + i * 120, 0, 6, 256);
  }
  // soft vignette inside the window
  const v = g.createRadialGradient(256, 128, 60, 256, 128, 300); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = v; g.fillRect(0, 0, 512, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function iconTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#d2232a'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
  g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineWidth = 14; g.lineCap = 'round';
  if (kind === 'snack') { // cup + straw
    g.beginPath(); g.moveTo(88, 92); g.lineTo(168, 92); g.lineTo(156, 200); g.lineTo(100, 200); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(132, 92); g.lineTo(150, 48); g.lineTo(176, 44); g.stroke();
  } else if (kind === 'sleep') { // bed
    g.fillRect(48, 140, 160, 26); g.fillRect(48, 100, 14, 90); g.fillRect(196, 140, 14, 50);
    g.beginPath(); g.ellipse(92, 128, 26, 14, 0, 0, 7); g.fill(); g.fillRect(118, 118, 90, 24);
    g.font = 'bold 52px sans-serif'; g.fillText('z', 160, 90); g.font = 'bold 36px sans-serif'; g.fillText('z', 190, 62);
  } else if (kind === 'cinema') { // play button on a screen
    g.beginPath(); g.roundRect(52, 70, 152, 108, 12); g.fill();
    g.fillStyle = '#d2232a'; g.beginPath(); g.moveTo(112, 98); g.lineTo(156, 124); g.lineTo(112, 150); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const WIN_TEX = {};
function winMat(kind) {
  if (!WIN_TEX[kind]) {
    const tex = windowTexture(kind);
    WIN_TEX[kind] = std({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: kind === 'cinema' ? 3.0 : 2.3, roughness: 0.15, metalness: 0 }, 'win' + kind);
  }
  return WIN_TEX[kind];
}

// side profile of the body (x along the car, y up), extruded across the width with rounded edges
function bodyGeometry(L, noseFront, noseBack) {
  const s = new THREE.Shape();
  const x0 = -L / 2, x1 = L / 2, y0 = 0.55, y1 = ROOF_Y;
  const n = 1.9; // nose length
  s.moveTo(x0 + (noseBack ? n : 0.15), y0);
  s.lineTo(x1 - (noseFront ? 0.25 : 0.15), y0);
  if (noseFront) { s.quadraticCurveTo(x1 + 0.05, y0 + 0.15, x1 - 0.1, y0 + 0.95); s.quadraticCurveTo(x1 - 0.7, y1 - 0.1, x1 - n, y1); }
  else { s.quadraticCurveTo(x1, y0, x1, y0 + 0.2); s.lineTo(x1, y1 - 0.2); s.quadraticCurveTo(x1, y1, x1 - 0.15, y1); }
  s.lineTo(x0 + (noseBack ? n : 0.15), y1);
  if (noseBack) { s.quadraticCurveTo(x0 + 0.7, y1 - 0.1, x0 + 0.1, y0 + 0.95); s.quadraticCurveTo(x0 - 0.05, y0 + 0.15, x0 + 0.25, y0); }
  else { s.quadraticCurveTo(x0, y1, x0, y1 - 0.2); s.lineTo(x0, y0 + 0.2); s.quadraticCurveTo(x0, y0, x0 + 0.15, y0); }
  const bev = 0.32;
  const g = new THREE.ExtrudeGeometry(s, { depth: CAR_W - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: 5, curveSegments: 18 });
  g.translate(0, 0, -(CAR_W - 2 * bev) / 2);
  return g;
}

// kind: 'lead' | 'tail' | 'passenger' | 'snack' | 'sleep' | 'cinema' | 'shuttle'
export function buildCar(kind, { L = CAR_L, johnWindow = -1 } = {}) {
  const m = mats();
  const car = new THREE.Group();
  const noseF = kind === 'lead' || kind === 'shuttle';
  const noseB = kind === 'tail' || kind === 'shuttle';
  const body = new THREE.Mesh(bodyGeometry(L, noseF, noseB), m.white); body.castShadow = body.receiveShadow = true; car.add(body);
  car.userData.body = body;
  // red skirt stripe + thin top stripe on both sides
  for (const z of [CAR_W / 2 + 0.005, -CAR_W / 2 - 0.005]) {
    const st = new THREE.Mesh(rbox(L - (noseF ? 1.0 : 0.3) - (noseB ? 1.0 : 0.3), 0.36, 0.02, 0.01), m.red);
    st.position.set((noseB ? 0.35 : 0) - (noseF ? 0.35 : 0), 0.95, z); car.add(st);
    const st2 = new THREE.Mesh(rbox(L - (noseF ? 2.4 : 0.3) - (noseB ? 2.4 : 0.3), 0.07, 0.02, 0.01), m.red);
    st2.position.set((noseB ? 1.05 : 0) - (noseF ? 1.05 : 0), 2.72, z); car.add(st2);
  }
  // nose: dark windscreen + red accent + headlights
  const ends = [];
  if (noseF) ends.push(1); if (noseB) ends.push(-1);
  for (const sgn of ends) {
    const ws = new THREE.Mesh(rbox(0.05, 0.85, CAR_W * 0.74, 0.03), m.darkBand);
    ws.position.set(sgn * (L / 2 - 1.05), 2.45, 0); ws.rotation.z = sgn * 0.92; car.add(ws);
    const acc = new THREE.Mesh(rbox(0.05, 0.42, CAR_W * 0.8, 0.03), m.red);
    acc.position.set(sgn * (L / 2 - 0.22), 1.18, 0); acc.rotation.z = sgn * 0.35; car.add(acc);
    for (const z of [0.62, -0.62]) {
      const hl = new THREE.Mesh(new THREE.CircleGeometry(0.13, 18), sgn > 0 ? m.head : m.tail);
      hl.position.set(sgn * (L / 2 - 0.12), 1.45, z); hl.rotation.y = sgn * Math.PI / 2; hl.rotation.x = 0; car.add(hl);
    }
  }
  // window band with glowing interiors, doors, icons on the camera side (+z) and the far side
  const winKind = ['snack', 'sleep', 'cinema'].includes(kind) ? kind : 'seats';
  const wm = winMat(winKind);
  const usable = L - (noseF ? 2.6 : 0.8) - (noseB ? 2.6 : 0.8);
  const startX = -L / 2 + (noseB ? 2.6 : 0.8);
  // explicit door / window slots along the side
  const slots = (noseF || noseB) ? ['D', 'W', 'W', 'D'] : ['W', 'D', 'W', 'W', 'D', 'W'];
  const sizes = slots.map((k) => (k === 'D' ? 1.5 : 1.0));
  const scale = usable / sizes.reduce((a, b) => a + b, 0);
  const centers = []; let acc = startX;
  sizes.forEach((w) => { centers.push(acc + (w * scale) / 2); acc += w * scale; });
  const doorsX = centers.filter((_, i) => slots[i] === 'D');
  const winX = centers.filter((_, i) => slots[i] === 'W');
  const winW = 1.0 * scale - 0.14;
  const doors = [];
  for (const side of [1, -1]) {
    const z = side * (CAR_W / 2 + 0.012);
    const hole = side > 0 && johnWindow >= 0 ? winX[johnWindow] : null;
    const bandSegs = hole === null ? [[startX, startX + usable]] : [[startX, hole - winW / 2 - 0.08], [hole + winW / 2 + 0.08, startX + usable]];
    for (const [a, b] of bandSegs) { const band = new THREE.Mesh(rbox(b - a, 0.95, 0.02, 0.01), m.darkBand); band.position.set((a + b) / 2, 2.05, z); car.add(band); }
    winX.forEach((wx, i) => {
      if (side > 0 && i === johnWindow) {
        // a real opening in the body (discarded in the shader), framed, with clear glass: John sits behind it
        const gl = new THREE.Mesh(rbox(winW, 0.78, 0.02, 0.06), m.glass); gl.position.set(wx, 2.05, z + 0.03); gl.renderOrder = 5; car.add(gl);
        const fs = new THREE.Shape(); fs.moveTo(-winW / 2 - 0.1, -0.49); fs.lineTo(winW / 2 + 0.1, -0.49); fs.lineTo(winW / 2 + 0.1, 0.49); fs.lineTo(-winW / 2 - 0.1, 0.49); fs.closePath();
        const hp = new THREE.Path(); hp.moveTo(-winW / 2, -0.39); hp.lineTo(-winW / 2, 0.39); hp.lineTo(winW / 2, 0.39); hp.lineTo(winW / 2, -0.39); hp.closePath(); fs.holes.push(hp);
        const fr = new THREE.Mesh(new THREE.ExtrudeGeometry(fs, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }), m.darkBand);
        fr.position.set(wx, 2.05, z - 0.02); car.add(fr);
        car.userData.johnWindowX = wx;
        const holeMat = m.white.clone();
        const prev = m.white.onBeforeCompile;
        holeMat.onBeforeCompile = (sh, r) => { prev(sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          if (vOP.z > 0.6 && abs(vOP.x - (${wx.toFixed(4)})) < ${(winW / 2 + 0.03).toFixed(4)} && abs(vOP.y - 2.05) < 0.42) discard;`); };
        holeMat.customProgramCacheKey = () => 'trainhole';
        body.material = holeMat;
        return;
      }
      const w = new THREE.Mesh(rbox(winW, 0.78, 0.02, 0.06), wm); w.position.set(wx, 2.05, z + side * 0.006); if (side < 0) w.rotation.y = Math.PI; car.add(w);
    });
    for (const dx of doorsX) {
      const d = new THREE.Group(); d.position.set(dx, 0, z + side * 0.02); car.add(d);
      const leaves = [];
      for (const s of [-1, 1]) {
        const leaf = new THREE.Group(); leaf.position.x = s * 0.36; d.add(leaf);
        const p = new THREE.Mesh(rbox(0.7, 2.0, 0.05, 0.04), m.white); p.position.y = 1.85; p.castShadow = true; leaf.add(p);
        const pw = new THREE.Mesh(rbox(0.42, 0.75, 0.02, 0.05), wm); pw.position.set(0, 2.15, side * 0.03); if (side < 0) pw.rotation.y = Math.PI; leaf.add(pw);
        const edge = new THREE.Mesh(rbox(0.04, 2.0, 0.06, 0.01), m.under); edge.position.set(-s * 0.35, 1.85, 0); leaf.add(edge);
        leaves.push({ leaf, s });
      }
      const fr = new THREE.Mesh(rbox(1.5, 0.06, 0.03, 0.01), m.under); fr.position.set(0, 2.88, 0); d.add(fr);
      if (side > 0) doors.push(leaves);
    }
    if (['snack', 'sleep', 'cinema'].includes(kind)) {
      const ic = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), std({ map: iconTexture(kind), roughness: 0.3, emissive: 0xffffff, emissiveMap: iconTexture(kind), emissiveIntensity: 0.25 }, 'icon' + kind));
      ic.position.set(startX + usable / 2, 1.3, z + side * 0.015); if (side < 0) ic.rotation.y = Math.PI; car.add(ic);
    }
  }
  // interior volume (seen through the open door / clear window)
  const inter = new THREE.Mesh(new THREE.BoxGeometry(L - 1.2, ROOF_Y - FLOOR_Y - 0.25, CAR_W - 0.25), m.interior);
  inter.position.set(0, (ROOF_Y + FLOOR_Y) / 2 - 0.05, 0); car.add(inter);
  // roof units
  for (const x of [-L / 4, L / 4]) { const ac = new THREE.Mesh(rbox(1.6, 0.25, 1.3, 0.08), m.under); ac.position.set(x, ROOF_Y + 0.08, 0); car.add(ac); }
  // bogies + wheels
  const wheels = [];
  for (const bx of [-L / 2 + 1.7, L / 2 - 1.7]) {
    const b = new THREE.Mesh(rbox(2.2, 0.35, 1.9, 0.06), m.under); b.position.set(bx, 0.45, 0); b.castShadow = true; car.add(b);
    for (const dx of [-0.65, 0.65]) for (const z of [0.72, -0.72]) {
      const wg = new THREE.CylinderGeometry(0.34, 0.34, 0.12, 22); wg.rotateX(Math.PI / 2);
      const w = new THREE.Mesh(wg, m.wheel); w.position.set(bx + dx, 0.34, z); car.add(w); wheels.push(w);
      const spoke = new THREE.Mesh(rbox(0.5, 0.06, 0.13, 0.01), m.under); w.add(spoke);
    }
  }
  // couplers / gangway bellows
  for (const sgn of [1, -1]) {
    if ((sgn > 0 && noseF) || (sgn < 0 && noseB)) continue;
    const bel = new THREE.Mesh(rbox(0.25, 2.2, 1.6, 0.06), m.under); bel.position.set(sgn * (L / 2 + 0.05), 1.95, 0); car.add(bel);
    const cp = new THREE.Mesh(rbox(0.35, 0.18, 0.25, 0.04), m.under); cp.position.set(sgn * (L / 2 + 0.1), 0.62, 0); car.add(cp);
  }
  car.traverse((o) => { if (o.isMesh && o.material !== m.glass) { o.castShadow = true; o.receiveShadow = true; } });
  car.userData.update = ({ dist = 0, doorOpen = 0 } = {}) => {
    for (const w of wheels) w.rotation.z = -dist / 0.34;
    for (const leaves of doors) for (const { leaf, s } of leaves) leaf.position.x = s * (0.36 + doorOpen * 0.66);
  };
  car.userData.doorsX = doorsX;
  return car;
}

// a full train: lead + given middle kinds + tail
export function buildTrain(kinds) {
  const group = new THREE.Group();
  const cars = kinds.map((k, i) => {
    const c = buildCar(k, { johnWindow: k === 'lead' ? 0 : -1 });
    group.add(c);
    return c;
  });
  return { group, cars, spacing: CAR_L + 0.35 };
}
