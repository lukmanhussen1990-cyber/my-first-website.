// Lecture hall (origin) with a wedding dressing, plus papers (letter, test, vows) and a flip calendar.
import { THREE, PI, RNG, M, mesh, box, cyl, ico, canvasTex, P, V, heartGeo } from './toon.js';
const FONT = '"Bangers", sans-serif';
const HAND = '"Comic Sans MS", "Bangers", cursive';
export const DESKS = [];   // [x, z] of each student desk (students sit facing -z)
for (const z of [-1.2, 0.6, 2.4]) for (const x of [-3.6, -1.2, 1.2, 3.6]) DESKS.push([x, z]);
export const YOU_DESK = 5;   // middle row, second column

export function buildHall(scene) {
  const S = {}; const G = S.group = new THREE.Group(); scene.add(G);
  const wood = canvasTex(256, 256, (x, w, h) => { const r = RNG(3); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#e7cfa5' : '#dfc497'; x.fillRect(0, i * 32, w, 32); x.fillStyle = 'rgba(0,0,0,0.07)'; x.fillRect(0, i * 32, w, 2); x.fillRect(r() * w, i * 32, 2, 32); } });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(5, 5);
  box(12.4, 0.06, 11.4, M(0xffffff, { std: true, map: wood, r: 0.8 }), G, 0, -0.03, 0.7);
  const wall = M(0xfdf1dc, { std: true, r: 0.95 }), wall2 = M(0xd8ecf2, { std: true, r: 0.95 });
  S.front = box(12.4, 4.2, 0.2, wall2, G, 0, 2.1, -4.6, false);
  S.back = box(12.4, 4.2, 0.2, wall, G, 0, 2.1, 6.4, false);
  // left wall with three big windows (sunlight)
  S.left = new THREE.Group(); G.add(S.left);
  box(0.2, 1.0, 11, wall, S.left, -6.2, 0.5, 0.9, false); box(0.2, 0.8, 11, wall, S.left, -6.2, 3.8, 0.9, false);
  for (let i = 0; i < 4; i++) box(0.2, 2.4, 0.9, wall, S.left, -6.2, 2.2, -4.0 + i * 3.4, false);
  for (let i = 0; i < 3; i++) { mesh(new THREE.PlaneGeometry(2.5, 2.4), new THREE.MeshBasicMaterial({ color: 0xcfeafb }), S.left, -6.25, 2.2, -2.3 + i * 3.4, false).rotation.y = PI / 2;
    box(0.06, 0.06, 2.5, M(0xffffff), S.left, -6.08, 2.2, -2.3 + i * 3.4, false); box(0.06, 2.4, 0.06, M(0xffffff), S.left, -6.08, 2.2, -2.3 + i * 3.4, false); }
  // sun shafts through the windows
  S.shafts = [];
  for (let i = 0; i < 3; i++) { const sh = mesh(new THREE.PlaneGeometry(2.4, 6.5), M(0xfff1c4, { basic: true, opacity: 0.16, double: true }), G, -3.6, 1.6, -2.3 + i * 3.4, false); sh.rotation.set(0, PI / 2, -0.85); S.shafts.push(sh); }
  // right wall with the door near the front
  S.right = new THREE.Group(); G.add(S.right);
  box(0.2, 4.2, 9.2, wall, S.right, 6.2, 2.1, 1.8, false); box(0.2, 1.7, 1.3, wall, S.right, 6.2, 3.35, -3.15, false); box(0.2, 4.2, 0.5, wall, S.right, 6.2, 2.1, -4.25, false);
  S.door = new THREE.Group(); S.door.position.set(6.12, 0, -3.8); G.add(S.door);
  box(0.06, 2.5, 1.25, M(0xb98a5e, { std: true }), S.door, 0, 1.25, 0.625); cyl(0.035, 0.035, 0.1, 8, M(0xe0c060, { std: true, metal: 0.5 }), S.door, -0.06, 1.2, 1.1).rotation.z = PI / 2;
  S.doorLight = mesh(new THREE.PlaneGeometry(1.25, 2.5), new THREE.MeshBasicMaterial({ color: 0xfff6d6 }), G, 6.3, 1.25, -3.18, false); S.doorLight.rotation.y = -PI / 2;
  S.ceiling = box(12.4, 0.1, 11.4, M(0xffffff), G, 0, 4.2, 0.7, false);
  // chalkboard
  S.board = new THREE.Group(); S.board.position.set(-0.5, 2.05, -4.45); G.add(S.board);
  box(6.4, 2.3, 0.08, M(0x9b7a52, { std: true }), S.board, 0, 0, 0);
  S.boardCanvas = document.createElement('canvas'); S.boardCanvas.width = 1024; S.boardCanvas.height = 384;
  S.boardTex = new THREE.CanvasTexture(S.boardCanvas); S.boardTex.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(6.2, 2.1), new THREE.MeshStandardMaterial({ map: S.boardTex, roughness: 0.9 }), S.board, 0, 0, 0.045, false);
  box(6.3, 0.06, 0.16, M(0x9b7a52, { std: true }), S.board, 0, -1.12, 0.08);
  for (let i = 0; i < 4; i++) box(0.08, 0.02, 0.02, M(0xffffff), S.board, -2 + i * 0.25, -1.08, 0.1);
  // clock
  S.clock = new THREE.Group(); S.clock.position.set(4.2, 3.3, -4.48); G.add(S.clock);
  cyl(0.34, 0.34, 0.06, 24, M(0xffffff, { std: true }), S.clock, 0, 0, 0).rotation.x = PI / 2; cyl(0.37, 0.37, 0.05, 24, M(0x2c3038, { std: true }), S.clock, 0, 0, -0.01).rotation.x = PI / 2;
  S.hourHand = new THREE.Group(); S.clock.add(S.hourHand); box(0.03, 0.18, 0.01, M(P.ink), S.hourHand, 0, 0.08, 0.04);
  S.minHand = new THREE.Group(); S.clock.add(S.minHand); box(0.02, 0.27, 0.01, M(P.ink), S.minHand, 0, 0.12, 0.045);
  // professor's desk
  S.pdesk = new THREE.Group(); S.pdesk.position.set(2.2, 0, -3.2); G.add(S.pdesk);
  box(1.8, 0.08, 0.8, M(0xb98a5e, { std: true }), S.pdesk, 0, 0.78, 0); box(1.7, 0.7, 0.05, M(0xa47a50, { std: true }), S.pdesk, 0, 0.4, 0.37);
  for (const x of [-0.8, 0.8]) box(0.06, 0.74, 0.7, M(0xa47a50, { std: true }), S.pdesk, x, 0.37, 0);
  for (let i = 0; i < 3; i++) box(0.3, 0.06, 0.22, M([0xe8463a, 0x5a8fd8, 0x7cc48a][i], { std: true }), S.pdesk, -0.55, 0.85 + i * 0.06, -0.1);
  ico(0.07, 1, M(0xe83a3a, { std: true, r: 0.4 }), S.pdesk, 0.6, 0.88, 0.0);
  // student desks + chairs
  S.desks = []; S.chairs = [];
  DESKS.forEach(([x, z]) => {
    const d = new THREE.Group(); d.position.set(x, 0, z); G.add(d); S.desks.push(d);
    box(1.1, 0.06, 0.62, M(0xf2e2c4, { std: true }), d, 0, 0.74, -0.42); for (const sx of [-0.5, 0.5]) for (const sz of [-0.68, -0.16]) cyl(0.025, 0.025, 0.72, 6, M(0x8a96a8, { std: true, metal: 0.3 }), d, sx, 0.36, sz);
    const c = new THREE.Group(); d.add(c); S.chairs.push(c);
    box(0.48, 0.05, 0.45, M(0x9fc9ee, { std: true }), c, 0, 0.46, 0.1); box(0.48, 0.5, 0.05, M(0x9fc9ee, { std: true }), c, 0, 0.75, 0.33);
    for (const sx of [-0.2, 0.2]) for (const sz of [-0.1, 0.3]) cyl(0.02, 0.02, 0.45, 5, M(0x8a96a8, { std: true }), c, sx, 0.22, sz);
  });
  // ---------------- wedding dressing (hidden until the wedding)
  const W = S.wedding = new THREE.Group(); G.add(W); W.visible = false;
  const pinks = [0xffb3cf, 0xff8fa8, 0xffffff, 0xffe48f, 0xc9b6ec];
  const flower = (parent, x, y, z, s = 1, c = 0) => { const f = ico(0.08 * s, 1, M(pinks[c % 5], { std: true, r: 0.6 }), parent, x, y, z); f.scale.set(1, 0.8, 1); return f; };
  // flower arch in front of the chalkboard
  const arch = new THREE.Group(); arch.position.set(-0.5, 0, -3.7); W.add(arch);
  const N = 26;
  for (let i = 0; i <= N; i++) { const a = PI * i / N; const x = -1.5 * Math.cos(a), y = 0.1 + 2.7 * Math.sin(a) + (Math.sin(a) > 0.98 ? 0 : 0); flower(arch, x, y, 0, 1.6 + (i % 3) * 0.3, i);
    ico(0.06, 0, M(0x7cc48a, { std: true }), arch, x * 1.04, y + 0.05, 0.08).scale.set(1.6, 0.6, 0.6); }
  for (const s of [-1, 1]) cyl(0.04, 0.04, 0.2, 6, M(0xffffff), arch, 1.5 * s, 0.1, 0);
  // white chairs in rows facing the arch (with an aisle)
  S.wchairs = [];
  for (let r = 0; r < 4; r++) for (const x of [-3.6, -2.7, -1.8, 0.8, 1.7, 2.6]) {
    const c = new THREE.Group(); c.position.set(x, 0, -1.2 + r * 1.3); W.add(c); S.wchairs.push(c);
    box(0.45, 0.05, 0.42, M(0xffffff, { std: true }), c, 0, 0.46, 0); box(0.45, 0.48, 0.05, M(0xffffff, { std: true }), c, 0, 0.74, 0.21);
    for (const sx of [-0.19, 0.19]) for (const sz of [-0.18, 0.18]) cyl(0.018, 0.018, 0.45, 5, M(0xf2f2f2, { std: true }), c, sx, 0.22, sz);
    flower(c, 0.24, 0.85, 0.22, 0.7, r + x * 3);
  }
  // aisle runner + garlands + bouquets
  box(1.3, 0.012, 6, M(0xfff3f6, { std: true }), W, -0.5, 0.006, 0.6);
  for (let i = 0; i < 18; i++) { const x = -6 + i * 0.7; flower(W, x, 3.6 - Math.sin(i / 17 * PI) * 0.5, -4.35, 1.1, i); }
  for (let i = 0; i < 14; i++) flower(W, -6.0, 3.0 - Math.sin(i / 13 * PI) * 0.5, -4 + i * 0.75, 1.0, i + 2);
  for (const [x, z] of [[-2.4, -3.3], [1.4, -3.3]]) { cyl(0.15, 0.1, 0.9, 8, M(0xffffff, { std: true }), W, x, 0.45, z); for (let k = 0; k < 7; k++) flower(W, x + (k % 3 - 1) * 0.12, 1.0 + Math.floor(k / 3) * 0.1, z + (k % 2) * 0.1, 1.2, k); }
  return S;
}
// chalkboard drawing: equations normally, "JUST MARRIED" for the wedding
export function drawBoard(S, mode) {
  if (S.boardMode === mode) return; S.boardMode = mode;
  const c = S.boardCanvas.getContext('2d'), w = c.canvas.width, h = c.canvas.height;
  c.fillStyle = '#2f6b4f'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 300; i++) c.fillRect((i * 97) % w, (i * 53) % h, 30, 3);
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.fillStyle = 'rgba(255,255,255,0.88)'; c.lineWidth = 4;
  if (mode === 'wedding') {
    c.font = `120px ${FONT}`; c.textAlign = 'center'; c.fillText('JUST MARRIED', w / 2, 170); c.fillStyle = '#ff8fb0'; c.font = `90px ${FONT}`; c.fillText('♥  A+  ♥', w / 2, 300);
  } else {
    c.font = `52px ${FONT}`; c.textAlign = 'left'; c.fillText('f(x) = ∫ x² dx', 60, 90); c.fillText('E = mc²', 640, 90); c.fillText('a² + b² = c²', 70, 190); c.fillText('lim  1/n → 0', 600, 200);
    c.fillText('MIDTERM: FRIDAY!', 300, 310); c.beginPath(); c.arc(860, 300, 40, 0, PI * 2); c.stroke();
  }
  S.boardTex.needsUpdate = true;
}
// papers: a plane with a live canvas texture
export function makePaper(parent, w = 0.297, h = 0.42) {
  const cv = document.createElement('canvas'); cv.width = 360; cv.height = 510;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group(); parent.add(g);
  const m = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }), g, 0, 0, 0, true);
  return { g, m, cv, tex, ctx: cv.getContext('2d'), key: '' };
}
function lined(c, w, h) { c.fillStyle = '#fffdf6'; c.fillRect(0, 0, w, h); c.strokeStyle = '#bcd6ef'; c.lineWidth = 2; for (let y = 70; y < h; y += 34) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.strokeStyle = '#f2a0a8'; c.beginPath(); c.moveTo(48, 0); c.lineTo(48, h); c.stroke(); }
function heart(c, x, y, s, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x, y + s * 0.35); c.bezierCurveTo(x - s * 0.9, y - s * 0.35, x - s * 0.35, y - s, x, y - s * 0.45); c.bezierCurveTo(x + s * 0.35, y - s, x + s * 0.9, y - s * 0.35, x, y + s * 0.35); c.fill(); }
// love letter: text and hearts appear with progress k (0..1)
export function drawLetter(p, k, grade = 0) {
  const key = 'L' + Math.round(k * 60) + '_' + Math.round(grade * 40); if (p.key === key) return; p.key = key;
  const c = p.ctx, w = p.cv.width, h = p.cv.height; lined(c, w, h);
  const lines = ['Dear Professor...', 'I did not answer', 'any question.', 'But I think', 'I love you.', '- your worst student'];
  const total = lines.join('').length; let n = Math.floor(total * k);
  c.fillStyle = '#2a3a8a'; c.font = `30px ${HAND}`; c.textAlign = 'left';
  lines.forEach((ln, i) => { const part = ln.slice(0, Math.max(0, n)); n -= ln.length; if (part) c.fillText(part, 60, 62 + i * 34 * 1.5); });
  for (let i = 0; i < 9; i++) if (k > 0.1 + i * 0.09) heart(c, 40 + (i * 83) % (w - 60), 380 + (i % 3) * 40, 18 + (i % 3) * 6, ['#ff5f86', '#ff8fb0', '#ff3a6a'][i % 3]);
  if (grade > 0) {   // red pen A+ written over it
    c.save(); c.strokeStyle = '#e8202a'; c.lineWidth = 12; c.lineCap = 'round'; c.lineJoin = 'round'; const g = Math.min(1, grade * 1.25);
    const pts = [[90, 330], [150, 140], [210, 330], [120, 260], [185, 260], [250, 230], [330, 230], [290, 190], [290, 280]];
    c.beginPath(); c.moveTo(...pts[0]); const segs = [[1, 2], [3, 4]];
    if (g > 0) { const u = Math.min(1, g / 0.4); c.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * u, pts[0][1] + (pts[1][1] - pts[0][1]) * u); }
    if (g > 0.2) { const u = Math.min(1, (g - 0.2) / 0.3); c.moveTo(...pts[1]); c.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * u, pts[1][1] + (pts[2][1] - pts[1][1]) * u); }
    if (g > 0.45) { const u = Math.min(1, (g - 0.45) / 0.15); c.moveTo(...pts[3]); c.lineTo(pts[3][0] + (pts[4][0] - pts[3][0]) * u, pts[3][1]); }
    if (g > 0.6) { const u = Math.min(1, (g - 0.6) / 0.2); c.moveTo(...pts[5]); c.lineTo(pts[5][0] + (pts[6][0] - pts[5][0]) * u, pts[5][1]); }
    if (g > 0.8) { const u = Math.min(1, (g - 0.8) / 0.2); c.moveTo(...pts[7]); c.lineTo(pts[7][0], pts[7][1] + (pts[8][1] - pts[7][1]) * u); }
    c.stroke(); if (grade >= 1) { c.beginPath(); c.arc(210, 240, 150, 0, PI * 2); c.lineWidth = 8; c.stroke(); } c.restore();
  }
  p.tex.needsUpdate = true;
}
// failed test with a big red F
export function drawTest(p, seed) {
  const key = 'T' + seed; if (p.key === key) return; p.key = key;
  const c = p.ctx, w = p.cv.width, h = p.cv.height; c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#333'; c.font = '26px sans-serif'; c.fillText('FINAL TEST', 110, 50);
  for (let i = 0; i < 9; i++) { c.fillStyle = '#9aa4b0'; c.fillRect(40, 90 + i * 44, 240 - (i * 37 % 90), 10); c.strokeStyle = '#e8202a'; c.lineWidth = 6; c.beginPath(); c.moveTo(300, 85 + i * 44); c.lineTo(325, 105 + i * 44); c.moveTo(325, 85 + i * 44); c.lineTo(300, 105 + i * 44); c.stroke(); }
  c.save(); c.translate(250, 140); c.rotate(-0.2 + seed * 0.05); c.fillStyle = '#e8202a'; c.font = `190px ${FONT}`; c.fillText('F', -50, 70); c.lineWidth = 7; c.strokeStyle = '#e8202a'; c.beginPath(); c.arc(0, 0, 105, 0, PI * 2); c.stroke(); c.restore();
  p.tex.needsUpdate = true;
}
// wedding vows with spelling mistakes; corrections in red pen with progress k
export function drawVows(p, k) {
  const key = 'V' + Math.round(k * 50); if (p.key === key) return; p.key = key;
  const c = p.ctx, w = p.cv.width, h = p.cv.height; lined(c, w, h);
  c.fillStyle = '#2a3a8a'; c.font = `34px ${HAND}`; c.fillText('My Vows', 120, 55);
  c.font = `29px ${HAND}`;
  const rows = [['I promis to', 'promise', 22, 112], ['luv you', 'love', 0, 52], ['forevr and', 'forever', 0, 92], ['evr and evr', 'ever', 0, 50], ['your studnt,', 'student', 50, 130]];
  rows.forEach(([txt, fix, x0, wd], i) => {
    const y = 120 + i * 68; c.fillStyle = '#2a3a8a'; c.fillText(txt, 60, y);
    const kk = Math.max(0, Math.min(1, k * rows.length - i));
    if (kk > 0) { c.strokeStyle = '#e8202a'; c.lineWidth = 4; c.beginPath(); c.moveTo(60 + x0, y - 9); c.lineTo(60 + x0 + wd * Math.min(1, kk * 2), y - 9); c.stroke();
      if (kk > 0.5) { c.fillStyle = '#e8202a'; c.font = `26px ${HAND}`; c.fillText(fix.slice(0, Math.ceil(fix.length * (kk - 0.5) * 2)), 70 + x0, y - 30); c.font = `29px ${HAND}`; } }
  });
  if (k >= 1) heart(c, 280, 470, 30, '#ff3a6a');
  p.tex.needsUpdate = true;
}
// wall calendar with flipping pages
export function makeCalendar(parent) {
  const g = new THREE.Group(); parent.add(g);
  const months = ['MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER'];
  const texs = months.map((m, i) => canvasTex(256, 320, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = ['#ff8f86', '#9ee0c8', '#a9d6f2', '#ffe48f', '#c9b6ec', '#ffb3cf', '#ff8f86'][i]; x.fillRect(0, 0, w, 80);
    x.fillStyle = '#2a2a33'; x.font = `48px ${FONT}`; x.textAlign = 'center'; x.fillText(m, w / 2, 58); x.font = '22px sans-serif';
    for (let d = 0; d < 30; d++) x.fillText(String(d + 1), 30 + (d % 7) * 33, 120 + Math.floor(d / 7) * 42); }));
  box(0.62, 0.06, 0.06, M(0xc0392b, { std: true }), g, 0, 0.42, 0.03);
  const back = mesh(new THREE.PlaneGeometry(0.6, 0.75), new THREE.MeshStandardMaterial({ map: texs[0] }), g, 0, 0, 0.0, false);
  const pg = new THREE.Group(); pg.position.set(0, 0.375, 0.006); g.add(pg);
  const page = mesh(new THREE.PlaneGeometry(0.6, 0.75), new THREE.MeshStandardMaterial({ map: texs[0], side: THREE.DoubleSide }), pg, 0, -0.375, 0, false);
  return { g, back, page, pg, texs };
}
export function setCalendar(cal, f) { // f: continuous page index
  const i = Math.min(cal.texs.length - 1, Math.floor(f)), fr = f - Math.floor(f);
  cal.back.material.map = cal.texs[Math.min(cal.texs.length - 1, i + 1)]; cal.page.material.map = cal.texs[i];
  cal.pg.rotation.x = -fr * PI * 0.95; cal.page.visible = i < cal.texs.length - 1;
}
