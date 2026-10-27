// Inside the haunted mansion: a long purple hallway with candle sconces and chandeliers, a portrait
// whose eyes follow you, a bookshelf that spins to a secret door, a trapdoor over a dark pit, a
// grandfather clock (midnight BONG), fake spiders, a zombie mask on the floor, and an L-shaped corner
// at the end where Larry waits.
import * as THREE from 'three';
import { clay, glow, metal } from '../../../engine/toon/materials.js';
import { roundedBox, cyl, cone, sphere, torus } from '../../../engine/toon/geom.js';
import { mulberry32 } from '../../../engine/toon/anim.js';
import { add, group, canvasTex } from './common.js';
import { ghostShape } from './mansion.js';

export const HALL = { origin: [400, 0, 0], W: 4.2, L: 16, H: 3.8 };
export const TRAP_Z = -9.2;       // the trapdoor over the pit, in the middle of the hall

function wallpaper() {
  return canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#4f3478'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#5b3e88' : '#463069'; c.fillRect(i * w / 8, 0, w / 8, h); }
    c.fillStyle = 'rgba(190,150,255,0.18)';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * w / 4 + w / 8, y = j * h / 4 + h / 8;
      c.beginPath(); c.moveTo(x, y - 30); c.quadraticCurveTo(x + 22, y, x, y + 30); c.quadraticCurveTo(x - 22, y, x, y - 30); c.fill();
      c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill();
    }
  }, { repeat: [4, 1] });
}
function woodFloor() {
  return canvasTex(512, 512, (c, w, h) => {
    const rnd = mulberry32(12);
    for (let i = 0; i < 8; i++) {
      c.fillStyle = new THREE.Color('#5a3a30').offsetHSL(0, 0, (rnd() - 0.5) * 0.06).getStyle(); c.fillRect(i * w / 8, 0, w / 8, h);
      c.fillStyle = 'rgba(20,10,8,0.55)'; c.fillRect(i * w / 8, 0, 3, h);
      for (let k = 0; k < 3; k++) { const y = rnd() * h; c.fillRect(i * w / 8, y, w / 8, 3); }
    }
  }, { repeat: [2, 8] });
}

// portrait with eyes that follow the camera: the canvas is redrawn with the pupils' position
export function makePortrait() {
  const g = new THREE.Group(); g.name = 'portrait';
  const c = document.createElement('canvas'); c.width = 512; c.height = 640;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (px, py) => {
    const x = c.getContext('2d');
    const bg = x.createRadialGradient(256, 260, 30, 256, 300, 360); bg.addColorStop(0, '#5c7a5a'); bg.addColorStop(1, '#22301f');
    x.fillStyle = bg; x.fillRect(0, 0, 512, 640);
    // a pompous old gentleman: big mustache, top hat
    x.fillStyle = '#2a2240'; x.beginPath(); x.ellipse(256, 600, 210, 170, 0, Math.PI, 0); x.fill();          // coat
    x.fillStyle = '#f2ece0'; x.beginPath(); x.moveTo(206, 470); x.lineTo(256, 560); x.lineTo(306, 470); x.fill(); // collar
    x.fillStyle = '#e8b896'; x.beginPath(); x.arc(256, 320, 150, 0, 7); x.fill();                              // head
    x.fillStyle = '#1c1820'; x.fillRect(150, 100, 212, 110); x.fillRect(110, 200, 292, 22);                    // top hat
    x.fillStyle = '#7a2a3a'; x.fillRect(150, 175, 212, 22);
    x.fillStyle = '#5a3a2a'; x.beginPath(); x.ellipse(206, 390, 62, 24, -0.25, 0, 7); x.ellipse(306, 390, 62, 24, 0.25, 0, 7); x.fill(); // mustache
    x.fillStyle = '#d99a7a'; x.beginPath(); x.arc(256, 352, 26, 0, 7); x.fill();                                // nose
    for (const s of [-1, 1]) {
      const ex = 256 + s * 62, ey = 290;
      x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(ex, ey, 36, 42, 0, 0, 7); x.fill();
      x.lineWidth = 8; x.strokeStyle = '#1c1714'; x.stroke();
      x.fillStyle = '#1c1714'; x.beginPath(); x.arc(ex + px * 18, ey + py * 20, 15, 0, 7); x.fill();
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(ex + px * 18 + 5, ey + py * 20 - 5, 5, 0, 7); x.fill();
      x.strokeStyle = '#3a2a20'; x.lineWidth = 9; x.beginPath(); x.moveTo(ex - 34, ey - 58 - s * 4); x.lineTo(ex + 34, ey - 58 + s * 4); x.stroke();
    }
    tex.needsUpdate = true;
  };
  draw(0, 0);
  add(g, roundedBox(1.55, 1.9, 0.12, 0.04), metal('#c9a64a', { roughness: 0.35, metalness: 0.8 }), [0, 0, 0]);
  add(g, new THREE.PlaneGeometry(1.25, 1.56), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), [0, 0, 0.065], [0, 0, 0], 1, { shadow: false });
  g.userData.look = (px, py) => draw(Math.max(-1, Math.min(1, px)), Math.max(-1, Math.min(1, py)));
  return g;
}

export function makeBookshelf() {
  const g = new THREE.Group(); g.name = 'bookshelf';
  const wood = clay('#5a3424'), rnd = mulberry32(8);
  const pivot = group(g, [0, 0, 0], [0, 0, 0], 'pivot');
  const build = (side) => {
    const f = group(pivot, [0, 0, side * 0.2], [0, side > 0 ? 0 : Math.PI, 0]);
    add(f, roundedBox(1.8, 2.8, 0.06, 0.02), wood, [0, 1.4, -0.17]);
    for (const x of [-0.88, 0.88]) add(f, roundedBox(0.08, 2.8, 0.38, 0.02), wood, [x, 1.4, 0]);
    for (const y of [0.05, 0.75, 1.45, 2.15, 2.78]) add(f, roundedBox(1.8, 0.06, 0.38, 0.02), wood, [0, y, 0]);
    for (const y of [0.08, 0.78, 1.48, 2.18]) {
      let x = -0.8;
      while (x < 0.78) {
        const bw = 0.06 + rnd() * 0.07, bh = 0.42 + rnd() * 0.2;
        const col = ['#b23a48', '#3a6ea5', '#e3b23c', '#3f8f5a', '#7d4fa0', '#d9703c'][Math.floor(rnd() * 6)];
        add(f, roundedBox(bw - 0.008, bh, 0.26, 0.01), clay(col), [x + bw / 2, y + bh / 2, 0.02], [0, 0, rnd() < 0.1 ? 0.25 : 0]);
        x += bw;
      }
    }
  };
  build(1); build(-1);
  // the secret passage behind: a dark opening with a green glow
  add(g, roundedBox(1.7, 2.7, 0.04, 0.02), clay('#0c0a12'), [0, 1.35, -0.42], [0, 0, 0], 1, { shadow: false });
  const glowL = new THREE.PointLight('#59ff95', 0, 4, 2); glowL.position.set(0, 1.2, -0.7); g.add(glowL);
  g.userData = { pivot, glowL };
  return g;
}

export function makeGrandfatherClock() {
  const g = new THREE.Group(); g.name = 'grandfatherClock';
  const wood = clay('#4a2a1c'), trim = metal('#c9a64a', { roughness: 0.35 });
  add(g, roundedBox(0.8, 2.6, 0.5, 0.05), wood, [0, 1.3, 0]);
  add(g, roundedBox(0.95, 0.25, 0.6, 0.05), wood, [0, 2.68, 0]);
  const top = new THREE.Shape(); top.moveTo(-0.48, 0); top.quadraticCurveTo(0, 0.55, 0.48, 0); top.closePath();
  const tg = new THREE.ExtrudeGeometry(top, { depth: 0.5, bevelEnabled: false }); tg.translate(0, 0, -0.25);
  add(g, tg, wood, [0, 2.8, 0]);
  const face = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#f4ead2'; c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, 7); c.fill();
    c.strokeStyle = '#2a1a10'; c.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.lineWidth = i % 3 ? 5 : 10; c.beginPath(); c.moveTo(w / 2 + Math.sin(a) * w * 0.36, h / 2 - Math.cos(a) * h * 0.36); c.lineTo(w / 2 + Math.sin(a) * w * 0.45, h / 2 - Math.cos(a) * h * 0.45); c.stroke(); }
  });
  add(g, new THREE.TorusGeometry(0.3, 0.035, 8, 32), trim, [0, 2.25, 0.27]);
  add(g, new THREE.CircleGeometry(0.29, 32), new THREE.MeshStandardMaterial({ map: face, roughness: 0.5, emissive: '#fff0c8', emissiveIntensity: 0.25, emissiveMap: face }), [0, 2.25, 0.26], [0, 0, 0], 1, { shadow: false });
  const hh = group(g, [0, 2.25, 0.29]); add(hh, roundedBox(0.035, 0.17, 0.02, 0.01), clay('#1a1622'), [0, 0.08, 0]);
  const mh = group(g, [0, 2.25, 0.3]); add(mh, roundedBox(0.025, 0.25, 0.02, 0.01), clay('#1a1622'), [0, 0.12, 0]);
  // pendulum window + pendulum
  add(g, roundedBox(0.45, 1.2, 0.04, 0.02), clay('#1c1210', { roughness: 0.2 }), [0, 1.2, 0.25], [0, 0, 0], 1, { shadow: false });
  const pend = group(g, [0, 1.75, 0.28]);
  add(pend, cyl(0.012, 0.012, 0.8, 6), trim, [0, -0.4, 0]);
  add(pend, cyl(0.12, 0.12, 0.03, 20), trim, [0, -0.82, 0], [Math.PI / 2, 0, 0]);
  g.userData = { hour: hh, minute: mh, pendulum: pend, setTime: (h) => { hh.rotation.z = -(h / 12) * Math.PI * 2; mh.rotation.z = -(h % 1) * Math.PI * 2; } };
  return g;
}

export function makeZombieMask() {
  const g = new THREE.Group(); g.name = 'zombieMask';
  const geo = new THREE.SphereGeometry(0.22, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.5); geo.scale(1, 0.55, 1.2);
  const m = add(g, geo, clay('#9fd18b', { roughness: 0.55, side: THREE.DoubleSide }), [0, 0.0, 0], [-Math.PI / 2 + 0.1, 0, 0.3]);
  // sticker face drawn on a decal plane
  const face = canvasTex(256, 256, (c) => {
    c.lineWidth = 9; c.strokeStyle = '#1c1714';
    for (const [x, r] of [[80, 34], [176, 26]]) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x, 100, r, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#1c1714'; c.beginPath(); c.arc(x + 6, 106, 10, 0, 7); c.fill(); }
    c.beginPath(); c.moveTo(70, 180); c.quadraticCurveTo(128, 205, 190, 170); c.stroke();
    c.fillStyle = '#ef7d8c'; c.beginPath(); c.ellipse(150, 192, 16, 20, 0.3, 0, 7); c.fill();
  });
  add(g, new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshStandardMaterial({ map: face, transparent: true, roughness: 0.6 }), [0, 0.135, 0.02], [-Math.PI / 2, 0, 0.3], 1, { shadow: false });
  for (let k = 0; k < 5; k++) add(g, cone(0.04, 0.12, 6), clay('#3a2c3a'), [-0.12 + k * 0.06, 0.04, -0.22], [-1.2, 0, 0]);
  return g;
}

export function buildInterior() {
  const { origin, W, L, H } = HALL;
  const root = new THREE.Group(); root.name = 'interior'; root.position.set(...origin);
  const paper = new THREE.MeshStandardMaterial({ map: wallpaper(), roughness: 0.85 });
  const wain = clay('#3a2234', { roughness: 0.7 }), trim = clay('#24152a');
  const floor = new THREE.MeshStandardMaterial({ map: woodFloor(), roughness: 0.75 });
  // main hall runs from z=+2 to z=-14, then turns right (+X) into a short side corridor
  // the floor has a real opening for the trapdoor pit (1.25 m square at z = TRAP_Z)
  const TZ = TRAP_Z, TH = 0.625, z0 = 2, z1 = 2 - L;
  add(root, new THREE.BoxGeometry(W, 0.1, z0 - (TZ + TH)), floor, [0, -0.05, (z0 + TZ + TH) / 2], [0, 0, 0], 1, { shadow: false });
  add(root, new THREE.BoxGeometry(W, 0.1, (TZ - TH) - z1), floor, [0, -0.05, (TZ - TH + z1) / 2], [0, 0, 0], 1, { shadow: false });
  for (const s of [-1, 1]) add(root, new THREE.BoxGeometry(W / 2 - TH, 0.1, TH * 2), floor, [s * (W / 4 + TH / 2), -0.05, TZ], [0, 0, 0], 1, { shadow: false });
  add(root, new THREE.BoxGeometry(5.0, 0.1, 3.4), floor, [W / 2 + 2.5, -0.05, -12.2], [0, 0, 0], 1, { shadow: false });
  const carpet = clay('#8a1f2c', { roughness: 0.95 });
  const cz0 = 2 - 0.25, cz1 = 2 - L + 0.25;
  add(root, new THREE.PlaneGeometry(1.3, cz0 - (TZ + TH + 0.06)), carpet, [0, 0.006, (cz0 + TZ + TH + 0.06) / 2], [-Math.PI / 2, 0, 0], 1, { shadow: false });
  add(root, new THREE.PlaneGeometry(1.3, (TZ - TH - 0.06) - cz1), carpet, [0, 0.006, (TZ - TH - 0.06 + cz1) / 2], [-Math.PI / 2, 0, 0], 1, { shadow: false });
  const walls = {};
  const wall = (name, w, pos, ry) => {
    const g = group(root, pos, [0, ry, 0], name);
    add(g, new THREE.BoxGeometry(w, H, 0.15), paper, [0, H / 2, 0]);
    add(g, new THREE.BoxGeometry(w, 1.05, 0.08), wain, [0, 0.52, 0.1]);
    add(g, new THREE.BoxGeometry(w, 0.08, 0.12), trim, [0, 1.06, 0.12]);
    add(g, new THREE.BoxGeometry(w, 0.18, 0.18), trim, [0, H - 0.09, 0.08]);
    walls[name] = g; return g;
  };
  wall('left', L, [-W / 2, 0, 2 - L / 2], Math.PI / 2);
  wall('rightA', L - 3.6, [W / 2, 0, 2 - (L - 3.6) / 2], -Math.PI / 2);         // right wall up to the corner
  wall('end', W + 5.2, [2.6, 0, -L + 2 - 0.0], 0);                              // far end wall (also back wall of the side corridor)
  wall('sideFront', 5.0, [W / 2 + 2.5, 0, -12.2 + 1.7], Math.PI);              // the side corridor's near wall
  wall('sideEnd', 3.4, [W / 2 + 5.0, 0, -12.2], -Math.PI / 2);
  wall('back', W, [0, 0, 2], Math.PI);
  add(root, new THREE.BoxGeometry(W + 5.2, 0.12, L), clay('#22182c'), [2.6, H + 0.06, 2 - L / 2], [0, 0, 0], 1, { shadow: false });
  for (let k = 0; k < 6; k++) add(root, roundedBox(W, 0.16, 0.2, 0.03), trim, [0, H - 0.08, 1 - k * 2.8]);
  // candle sconces on both walls + chandeliers
  const lights = [], flames = [];
  const flameMat = glow('#ffbe55', 3.2, { unique: true });
  for (let k = 0; k < 5; k++) for (const s of [-1, 1]) {
    const z = 0.2 - k * 3.0;
    const sc = group(root, [s * (W / 2 - 0.1), 2.1, z], [0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0]);
    add(sc, roundedBox(0.16, 0.24, 0.05, 0.02), metal('#c9a64a'), [0, 0, 0]);
    add(sc, cyl(0.03, 0.03, 0.18, 10), clay('#f4ead8'), [0, 0.18, 0.1]);
    const fl = add(sc, sphere(0.035, 12, 10), flameMat, [0, 0.31, 0.1], [0, 0, 0], [1, 1.7, 1], { shadow: false }); fl.userData.noAO = true; flames.push(fl);
    if (s > 0 && k % 2 === 0 || s < 0 && k % 2 === 1) { const L2 = new THREE.PointLight('#ffb35a', 2.2, 5.5, 2); L2.position.set(0, 0.35, 0.3); sc.add(L2); lights.push(L2); }
  }
  for (const z of [-2.5, -8.5]) {
    const ch = group(root, [0, H - 0.9, z]);
    add(ch, cyl(0.01, 0.01, 0.9, 6), metal('#c9a64a'), [0, 0.45, 0]);
    add(ch, torus(0.45, 0.03, 8, 32), metal('#c9a64a'), [0, 0, 0], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      add(ch, cyl(0.025, 0.025, 0.14, 8), clay('#f4ead8'), [Math.cos(a) * 0.45, 0.08, Math.sin(a) * 0.45]);
      const fl = add(ch, sphere(0.03, 10, 8), flameMat, [Math.cos(a) * 0.45, 0.19, Math.sin(a) * 0.45], [0, 0, 0], [1, 1.7, 1], { shadow: false }); fl.userData.noAO = true; flames.push(fl);
    }
    const L3 = new THREE.PointLight('#ffc070', 3.5, 8, 1.8); L3.position.set(0, -0.1, 0); ch.add(L3); lights.push(L3);
  }
  // moonlit windows on the left wall
  const winMat = glow('#7f9cff', 1.1, { unique: true });
  for (const z of [-1.2, -7.2]) {
    const wg = group(root, [-W / 2 + 0.1, 1.9, z], [0, Math.PI / 2, 0]);
    add(wg, roundedBox(1.1, 1.8, 0.1, 0.03), trim, [0, 0, 0]);
    const gl = add(wg, new THREE.PlaneGeometry(0.9, 1.6), winMat, [0, 0, 0.06], [0, 0, 0], 1, { shadow: false }); gl.userData.noAO = true;
    add(wg, roundedBox(0.9, 0.05, 0.05, 0.01), trim, [0, 0.2, 0.08]); add(wg, roundedBox(0.05, 1.6, 0.05, 0.01), trim, [0, 0, 0.08]);
  }
  // props: portrait (left wall), bookshelf (right wall), trapdoor, grandfather clock, zombie mask
  const portrait = makePortrait(); portrait.position.set(-W / 2 + 0.11, 2.0, -4.3); portrait.rotation.y = Math.PI / 2; root.add(portrait);
  const shelf = makeBookshelf(); shelf.position.set(W / 2 - 0.25, 0, -5.6); shelf.rotation.y = -Math.PI / 2; root.add(shelf);
  const clock = makeGrandfatherClock(); clock.position.set(-W / 2 + 0.35, 0, -0.9); clock.rotation.y = Math.PI / 2; root.add(clock);
  const mask = makeZombieMask(); mask.position.set(0.7, 0.03, -10.5); mask.rotation.y = 0.9; mask.scale.setScalar(1.35); root.add(mask);
  // trapdoor: a hinged panel over a dark pit
  const td = group(root, [0, 0, TRAP_Z], [0, 0, 0], 'trapdoor');
  // the pit: dark stone walls that fade into black; a soft light inside shows whoever fell in
  const pitTex = canvasTex(256, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4a3d5c'); g.addColorStop(0.55, '#2a2136'); g.addColorStop(1, '#120d1a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(10,6,16,0.55)'; c.lineWidth = 6;
    for (let r = 0; r < 10; r++) { const y = (r + 0.5) * h / 10; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
      for (let k = 0; k < 3; k++) { const x = ((k + (r % 2) * 0.5) * w) / 3; c.beginPath(); c.moveTo(x, y - h / 10); c.lineTo(x, y); c.stroke(); } }
  });
  const pitMat = new THREE.MeshStandardMaterial({ map: pitTex, roughness: 0.95, side: THREE.BackSide });
  const pit = add(td, new THREE.BoxGeometry(1.6, 2.7, 1.6), pitMat, [0, -1.36, 0], [0, 0, 0], 1, { shadow: false });
  pit.userData.noAO = true;
  add(td, new THREE.CircleGeometry(0.5, 32), clay('#5b4a6e', { roughness: 1 }), [0, -2.69, 0], [-Math.PI / 2, 0, 0], [1.4, 1.1, 1], { shadow: false });   // a dusty old mattress
  const pitLight = new THREE.PointLight('#ece6ff', 0, 4.5, 1.4); pitLight.position.set(0, -0.6, 0.2); td.add(pitLight);
  const hinge = group(td, [0, -0.005, -0.62], [0, 0, 0], 'hinge');
  add(hinge, roundedBox(1.22, 0.06, 1.22, 0.01), new THREE.MeshStandardMaterial({ map: woodFloor(), roughness: 0.75, color: '#c9b0a0' }), [0, -0.03, 0.62]);
  for (const x of [-0.4, 0.4]) add(hinge, roundedBox(0.16, 0.02, 0.08, 0.005), metal('#3a3a3a'), [x, 0.005, 0.05]);
  add(hinge, torus(0.06, 0.012, 6, 16), metal('#3a3a3a'), [0, 0.01, 1.05], [Math.PI / 2, 0, 0]);
  for (const [w, d, x, z] of [[1.4, 0.09, 0, 0.66], [1.4, 0.09, 0, -0.66], [0.09, 1.4, 0.66, 0], [0.09, 1.4, -0.66, 0]]) {
    add(td, roundedBox(w, 0.025, d, 0.01), trim, [x, 0.0, z], [0, 0, 0], 1, { shadow: false });   // frame around the opening
  }
  // ghost-shaped hole in the ceiling above the corner (after the ghost escapes)
  // (local +y = the ghost's head points away from the hall entrance; local -z hangs below the ceiling)
  const ceilHole = group(root, [1.9, H - 0.004, -12.2], [-Math.PI / 2, 0, 0], 'ceilingHole');
  const nightSky = canvasTex(256, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2b2468'); g.addColorStop(1, '#141038');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const rnd = mulberry32(12);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,250,230,${0.5 + rnd() * 0.5})`; c.beginPath(); c.arc(rnd() * w, rnd() * h, 1 + rnd() * 2.2, 0, 7); c.fill(); }
  }, { repeat: [1, 1] });
  const holeMat = new THREE.MeshBasicMaterial({ map: nightSky, side: THREE.DoubleSide, toneMapped: false, color: new THREE.Color(1.2, 1.2, 1.3) });
  const hm = add(ceilHole, new THREE.ShapeGeometry(ghostShape(), 24), holeMat, [0, -0.75, -0.012], [0, 0, 0], 1.25, { shadow: false }); hm.userData.noAO = true;
  // splintered plaster around the hole
  const plaster = clay('#cdbfd8', { roughness: 0.95 });
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, r = 0.92 + (k % 3) * 0.06;
    add(ceilHole, roundedBox(0.2 + (k % 2) * 0.08, 0.09, 0.05, 0.02), plaster, [Math.cos(a) * r * 0.85, Math.sin(a) * r - 0.05, -0.03], [0.25 * ((k % 2) * 2 - 1), 0, a + 0.3]);
  }
  ceilHole.visible = false;
  root.userData = { walls, lights, flames, flameMat, winMat, portrait, shelf, clock, mask, ceilHole, trapdoor: { group: td, hinge, pit, light: pitLight } };
  root.userData.local = (x, y, z) => [origin[0] + x, origin[1] + y, origin[2] + z];
  root.userData.reset = () => {
    for (const k in walls) walls[k].visible = true;
    shelf.userData.pivot.rotation.y = 0; shelf.userData.glowL.intensity = 0;
    hinge.rotation.x = 0; pitLight.intensity = 0; clock.userData.setTime(11.95); clock.userData.pendulum.rotation.z = 0;
    lights.forEach((l) => { l.intensity = l.distance > 6 ? 3.5 : 2.2; });
    flameMat.emissiveIntensity = 3.2; winMat.emissiveIntensity = 1.1;
    portrait.userData.look(0, 0); mask.visible = false; ceilHole.visible = false;
  };
  return root;
}
