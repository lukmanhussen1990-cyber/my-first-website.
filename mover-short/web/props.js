import * as THREE from 'three';
import { mat, box, cyl, mesh, grp, canvasTex, plane, roundRect, lerp } from './lib.js';

export const LOGO_NAME = ['COUCH', 'CRUSHERS'];
const INK = '#17171c';

export function drawLogo(c, w, h, { bg = null, sub = 'MOVING CO.', phone = '(555) 014-2290', dark = INK } = {}) {
  if (bg) { c.fillStyle = bg; c.fillRect(0, 0, w, h); }
  const cx = w / 2;
  // couch icon
  const s = h / 512;
  c.save(); c.translate(cx, h * 0.2); c.scale(s, s);
  c.fillStyle = '#e8572a'; c.strokeStyle = dark; c.lineWidth = 10; c.lineJoin = 'round';
  roundRect(c, -120, -40, 240, 70, 18); c.fill(); c.stroke();
  roundRect(c, -150, -10, 60, 80, 16); c.fill(); c.stroke();
  roundRect(c, 90, -10, 60, 80, 16); c.fill(); c.stroke();
  roundRect(c, -95, 20, 190, 50, 10); c.fill(); c.stroke();
  c.fillStyle = dark; c.fillRect(-130, 70, 18, 22); c.fillRect(112, 70, 18, 22);
  c.restore();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  const big = (txt, y, size, fill) => { c.font = `${size}px Lucky`; c.lineWidth = size * 0.16; c.strokeStyle = dark; c.strokeText(txt, cx, y); c.fillStyle = fill; c.fillText(txt, cx, y); };
  big(LOGO_NAME[0] + ' ' + LOGO_NAME[1], h * 0.52, h * 0.2, '#ffcc1f');
  c.font = `900 ${h * 0.1}px Mont`; c.fillStyle = dark; c.fillText(sub, cx, h * 0.72);
  if (phone) { c.font = `800 ${h * 0.075}px Mont`; c.fillStyle = '#2f7de1'; c.fillText(phone, cx, h * 0.87); }
}

export function couch(color = '#e8572a') {
  const g = new THREE.Group();
  const m = mat(color), m2 = mat('#f07a45'), leg = mat('#3b2a1e');
  g.add(box(2.0, 0.38, 0.9, m, { pos: [0, 0.33, 0] }));
  g.add(box(2.0, 0.55, 0.24, m, { pos: [0, 0.7, -0.33], rot: [-0.08, 0, 0] }));
  g.add(box(0.24, 0.32, 0.92, m, { pos: [0.96, 0.62, 0] }));
  g.add(box(0.24, 0.32, 0.92, m, { pos: [-0.96, 0.62, 0] }));
  g.add(box(0.74, 0.14, 0.62, m2, { pos: [0.38, 0.58, 0.1] }));
  g.add(box(0.74, 0.14, 0.62, m2, { pos: [-0.38, 0.58, 0.1] }));
  g.add(box(0.7, 0.36, 0.14, m2, { pos: [0.38, 0.82, -0.2], rot: [-0.15, 0, 0] }));
  g.add(box(0.7, 0.36, 0.14, m2, { pos: [-0.38, 0.82, -0.2], rot: [-0.15, 0, 0] }));
  [[0.9, 0.35], [-0.9, 0.35], [0.9, -0.35], [-0.9, -0.35]].forEach(([x, z]) => g.add(box(0.08, 0.14, 0.08, leg, { pos: [x, 0.07, z] })));
  return g;
}
export function cbox(w = 0.5, h = 0.4, d = 0.45, tint = '#c99a5c') {
  const g = new THREE.Group();
  g.add(box(w, h, d, mat(tint), { pos: [0, h / 2, 0] }));
  g.add(box(w * 0.18, 0.006, d + 0.004, mat('#9a7038'), { pos: [0, h + 0.002, 0], cast: false }));
  g.add(box(w * 0.18, h * 0.3, 0.006, mat('#9a7038'), { pos: [0, h * 0.85, d / 2 + 0.002], cast: false }));
  return g;
}
export function fridge() {
  const g = new THREE.Group(), w = mat('#8fd3c4', { roughness: 0.4 }), dk = mat('#e9eef2', { roughness: 0.3 });
  g.add(box(0.72, 1.75, 0.68, w, { pos: [0, 0.875, 0] }));
  g.add(box(0.72, 0.03, 0.02, mat('#5f9e91'), { pos: [0, 1.15, 0.345], cast: false }));
  g.add(box(0.04, 0.35, 0.05, dk, { pos: [0.28, 1.4, 0.36] }));
  g.add(box(0.04, 0.55, 0.05, dk, { pos: [0.28, 0.8, 0.36] }));
  return g;
}
export function piano() {
  const g = new THREE.Group(), b = mat('#22202a', { roughness: 0.28 }), wood = mat('#2e2a35', { roughness: 0.35 });
  g.add(box(1.5, 1.25, 0.55, b, { pos: [0, 0.75, 0] }));
  g.add(box(1.56, 0.06, 0.62, wood, { pos: [0, 1.4, 0] }));
  g.add(box(1.5, 0.1, 0.38, b, { pos: [0, 0.78, 0.43] }));
  const keys = box(1.36, 0.035, 0.2, mat('#fbfbf6', { roughness: 0.3 }), { pos: [0, 0.845, 0.46] }); g.add(keys);
  for (let i = 0; i < 18; i++) { if ([2, 6, 9, 13, 16].includes(i % 18)) continue; g.add(box(0.035, 0.03, 0.11, mat('#111'), { pos: [-0.62 + i * 0.073, 0.875, 0.42], cast: false })); }
  g.add(box(0.08, 0.6, 0.08, b, { pos: [0.66, 0.3, 0.45] }));
  g.add(box(0.08, 0.6, 0.08, b, { pos: [-0.66, 0.3, 0.45] }));
  g.add(box(1.0, 0.5, 0.02, mat('#3a3340', { roughness: 0.3 }), { pos: [0, 1.1, 0.285] }));
  [[0.6, 0.2], [-0.6, 0.2], [0.6, -0.2], [-0.6, -0.2]].forEach(([x, z]) => g.add(cyl(0.05, 0.05, 0.05, 8, mat('#c9a43a', { metalness: 0.6, roughness: 0.3 }), { pos: [x, 0.05, z], rot: [0, 0, Math.PI / 2] })));
  g.userData.keysMesh = keys;
  return g;
}
export function dolly() {
  const g = new THREE.Group(), steel = mat('#d23a3a', { roughness: 0.4 }), dk = mat('#2a2a2e');
  const frame = new THREE.Group(); g.add(frame);
  frame.add(box(0.05, 1.35, 0.05, steel, { pos: [0.22, 0.75, -0.05] }));
  frame.add(box(0.05, 1.35, 0.05, steel, { pos: [-0.22, 0.75, -0.05] }));
  [0.4, 0.8, 1.2].forEach(y => frame.add(box(0.44, 0.035, 0.035, steel, { pos: [0, y, -0.05] })));
  frame.add(box(0.5, 0.03, 0.26, mat('#8f949b', { metalness: 0.5, roughness: 0.35 }), { pos: [0, 0.03, 0.1] }));
  frame.add(box(0.5, 0.05, 0.05, dk, { pos: [0, 1.44, -0.05] }));
  [0.29, -0.29].forEach(x => { frame.add(cyl(0.13, 0.13, 0.08, 10, dk, { pos: [x, 0.13, -0.12], rot: [0, 0, Math.PI / 2] })); frame.add(cyl(0.06, 0.06, 0.085, 8, mat('#bbb'), { pos: [x, 0.13, -0.12], rot: [0, 0, Math.PI / 2] })); });
  return g;
}
export function lamp() {
  const g = new THREE.Group();
  g.add(cyl(0.16, 0.18, 0.04, 8, mat('#333'), { pos: [0, 0.02, 0] }));
  g.add(cyl(0.02, 0.02, 1.2, 6, mat('#333'), { pos: [0, 0.62, 0] }));
  g.add(cyl(0.14, 0.26, 0.3, 8, mat('#f3d27a', { emissive: '#7a5a10', emissiveIntensity: 0.3 }), { pos: [0, 1.3, 0] }));
  return g;
}
const billTexCache = {};
export function billTex(v = 20) {
  if (billTexCache[v]) return billTexCache[v];
  return (billTexCache[v] = canvasTex(256, 112, (c, w, h) => {
    c.fillStyle = '#8fd19e'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2f7a45'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#cdeed3'; c.beginPath(); c.ellipse(w / 2, h / 2, 34, 40, 0, 0, 7); c.fill();
    c.fillStyle = '#2f7a45'; c.font = '900 50px Mont'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('$', w / 2, h / 2 + 3);
    c.font = '900 30px Mont'; c.fillText(v, 34, 30); c.fillText(v, w - 34, h - 26);
  }));
}
export function bill(v = 20, s = 1) {
  const p = plane(0.26 * s, 0.114 * s, billTex(v), { cast: true });
  p.material.roughness = 0.8; return p;
}
export function wallet() {
  const g = new THREE.Group(), lm = mat('#7a4a26', { roughness: 0.6 }), in_ = mat('#5c361a');
  const L = new THREE.Group(), R = new THREE.Group(); g.add(L, R);
  L.add(box(0.12, 0.1, 0.015, lm, { pos: [-0.06, 0, 0] })); L.add(box(0.11, 0.09, 0.004, in_, { pos: [-0.06, 0, 0.009] }));
  R.add(box(0.12, 0.1, 0.015, lm, { pos: [0.06, 0, 0] })); R.add(box(0.11, 0.09, 0.004, in_, { pos: [0.06, 0, 0.009] }));
  g.userData.setOpen = a => { L.rotation.y = -a / 2; R.rotation.y = a / 2; };
  g.userData.setOpen(2.6);
  return g;
}
export function moth() {
  const g = new THREE.Group();
  const bm = mat('#8a7f72'), wm = new THREE.MeshStandardMaterial({ color: '#c9bfae', side: THREE.DoubleSide, roughness: 0.9 });
  g.add(mesh(new THREE.SphereGeometry(0.018, 6, 4), bm).translateZ(0));
  const body = mesh(new THREE.CapsuleGeometry(0.012, 0.04, 2, 6), bm); body.rotation.x = Math.PI / 2; g.add(body);
  const wg = new THREE.CircleGeometry(0.045, 5); wg.translate(0.04, 0, 0);
  const L = mesh(wg, wm), R = mesh(wg, wm); R.rotation.y = Math.PI;
  const Lp = grp(L), Rp = grp(R); g.add(Lp, Rp);
  g.add(box(0.003, 0.03, 0.003, bm, { pos: [0.008, 0.02, 0.025], rot: [0.5, 0, -0.3] }), box(0.003, 0.03, 0.003, bm, { pos: [-0.008, 0.02, 0.025], rot: [0.5, 0, 0.3] }));
  g.userData.flap = f => { const a = Math.sin(f * 1.9) * 0.9; Lp.rotation.z = a; Rp.rotation.z = -a; };
  g.scale.setScalar(1.5);
  return g;
}
export function phone() {
  const g = new THREE.Group();
  g.add(box(0.08, 0.15, 0.015, mat('#1b1b20', { roughness: 0.3 })));
  g.add(box(0.07, 0.13, 0.002, mat('#4fc3ff', { emissive: '#2a8fd0', emissiveIntensity: 0.6 }), { pos: [0, 0, 0.009], cast: false }));
  return g;
}
export function wheel(r = 0.33, w = 0.22) {
  const g = new THREE.Group();
  g.add(cyl(r, r, w, 12, mat('#222226'), { rot: [0, 0, Math.PI / 2] }));
  g.add(cyl(r * 0.55, r * 0.55, w + 0.01, 8, mat('#c7cbd1', { metalness: 0.4, roughness: 0.35 }), { rot: [0, 0, Math.PI / 2] }));
  return g;
}
export function car(color = '#f4c430') {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); g.userData.body = body;
  const m = mat(color, { roughness: 0.35 }), glass = mat('#9fd3ef', { roughness: 0.1, metalness: 0.3 }), dk = mat('#2b2b30');
  body.add(box(1.6, 0.5, 2.6, m, { pos: [0, 0.55, 0] }));
  const cab = new THREE.BoxGeometry(1.45, 0.55, 1.6); const p = cab.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.88); p.setZ(i, p.getZ(i) * 0.82 - 0.05); }
  cab.computeVertexNormals(); const c = mesh(cab, m); c.position.set(0, 1.07, -0.2); body.add(c);
  body.add(box(1.32, 0.42, 0.02, glass, { pos: [0, 1.07, 0.52], rot: [-0.45, 0, 0] }));
  [0.72, -0.72].forEach(x => body.add(box(0.02, 0.36, 1.25, glass, { pos: [x * 0.97, 1.08, -0.22] })));
  body.add(box(1.62, 0.12, 0.08, dk, { pos: [0, 0.38, 1.31] })); body.add(box(1.62, 0.12, 0.08, dk, { pos: [0, 0.38, -1.31] }));
  [0.55, -0.55].forEach(x => body.add(box(0.28, 0.12, 0.03, mat('#fff9d0', { emissive: '#fff2a0', emissiveIntensity: 0.6 }), { pos: [x, 0.62, 1.31] })));
  const wheels = [];
  [[0.75, 0.85], [-0.75, 0.85], [0.75, -0.85], [-0.75, -0.85]].forEach(([x, z]) => { const w = wheel(0.3, 0.2); w.position.set(x, 0.3, z); g.add(w); wheels.push(w); });
  g.userData.wheels = wheels;
  return g;
}
export function truck() {
  const g = new THREE.Group();
  const white = mat('#f5f5f2', { roughness: 0.5 }), red = mat('#e8463c', { roughness: 0.35 }), glass = mat('#8fc3df', { roughness: 0.1, metalness: 0.3 }), dk = mat('#26262b');
  // cab at +z
  const cab = new THREE.Group(); g.add(cab);
  cab.add(box(2.3, 1.5, 1.9, red, { pos: [0, 1.25, 2.9] }));
  cab.add(box(2.2, 0.9, 1.4, red, { pos: [0, 2.35, 2.65] }));
  cab.add(box(2.0, 0.75, 0.02, glass, { pos: [0, 2.35, 3.36], rot: [-0.15, 0, 0] }));
  [1.16, -1.16].forEach(x => cab.add(box(0.02, 0.6, 0.9, glass, { pos: [x, 2.35, 2.75] })));
  cab.add(box(2.32, 0.25, 0.12, dk, { pos: [0, 0.6, 3.86] }));
  [0.8, -0.8].forEach(x => cab.add(box(0.34, 0.16, 0.03, mat('#fff9d0', { emissive: '#fff2a0', emissiveIntensity: 0.7 }), { pos: [x, 1.0, 3.86] })));
  // cargo box
  g.add(box(2.6, 2.9, 5.4, white, { pos: [0, 2.15, -0.75] }));
  g.add(box(2.66, 0.18, 5.46, red, { pos: [0, 0.78, -0.75] }));
  g.add(box(2.4, 0.3, 7.4, dk, { pos: [0, 0.55, 0.3] }));
  const wheels = [];
  [[1.12, 2.7], [-1.12, 2.7], [1.12, -2.2], [-1.12, -2.2], [1.12, -1.3], [-1.12, -1.3]].forEach(([x, z]) => { const w = wheel(0.5, 0.36); w.position.set(x, 0.5, z); g.add(w); wheels.push(w); });
  g.userData.wheels = wheels;
  // logo panels on both sides (wipe reveal via scale.x + texture repeat)
  const tex = canvasTex(1536, 820, (c, w, h) => drawLogo(c, w, h));
  const tex2 = tex.clone(); tex2.needsUpdate = true;
  const mk = (t, x, ry) => { const p = plane(4.8, 2.56, t, { transparent: true, anchorLeft: true }); p.material.side = THREE.FrontSide; p.position.set(x, 2.15, x > 0 ? 1.65 : -3.15); p.rotation.y = ry; g.add(p); return p; };
  const L = mk(tex, 1.305, Math.PI / 2 + Math.PI), R = mk(tex2, -1.305, -Math.PI / 2 + Math.PI);
  // fix: +x side faces +x; anchorLeft means the reveal starts at the cab end
  L.rotation.y = Math.PI / 2; L.position.set(1.305, 2.15, 1.65);
  R.rotation.y = -Math.PI / 2; R.position.set(-1.305, 2.15, -3.15);
  g.userData.logos = [L, R];
  g.userData.reveal = (k) => { [L, R].forEach(p => { p.visible = k > 0.001; p.scale.x = Math.max(0.001, k); p.material.map.repeat.x = Math.max(0.001, k); p.material.map.offset.x = 0; }); };
  g.userData.reveal(0);
  return g;
}
export function pump() {
  const g = new THREE.Group();
  g.add(box(1.4, 0.2, 0.9, mat('#b9bec4'), { pos: [0, 0.1, 0] }));
  g.add(box(0.8, 1.7, 0.55, mat('#f2f2ee', { roughness: 0.5 }), { pos: [0, 1.05, 0] }));
  g.add(box(0.82, 0.3, 0.57, mat('#2f7de1'), { pos: [0, 1.8, 0] }));
  const scr = canvasTex(256, 160, () => {});
  const sp = plane(0.5, 0.31, scr); sp.position.set(0, 1.4, 0.28); g.add(sp); g.userData.screen = scr;
  g.add(box(0.12, 0.25, 0.1, mat('#222'), { pos: [0.3, 0.95, 0.32] }));
  g.add(cyl(0.025, 0.025, 0.7, 6, mat('#222'), { pos: [0.42, 0.7, 0.33] }));
  g.userData.setAmount = (v) => {
    const c = scr.userData.canvas.getContext('2d');
    c.fillStyle = '#10161c'; c.fillRect(0, 0, 256, 160);
    c.fillStyle = '#5cff8a'; c.font = '900 34px Mont'; c.textAlign = 'right';
    c.fillText('$' + v.toFixed(2), 236, 70); c.fillStyle = '#ffd21f'; c.font = '800 22px Mont'; c.fillText('GAS', 236, 120);
    scr.needsUpdate = true;
  };
  return g;
}
export function laptop() {
  const g = new THREE.Group(), al = mat('#c3c7cd', { roughness: 0.35, metalness: 0.3 });
  g.add(box(0.62, 0.025, 0.42, al, { pos: [0, 0.0125, 0] }));
  g.add(box(0.54, 0.004, 0.2, mat('#2c2f35'), { pos: [0, 0.027, -0.04], cast: false }));
  const lid = new THREE.Group(); lid.position.set(0, 0.025, -0.21); g.add(lid);
  lid.add(box(0.62, 0.4, 0.018, al, { pos: [0, 0.2, 0] }));
  const draw = (approved) => (c, w, h) => {
    c.fillStyle = '#f4f6fa'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#2f7de1'; c.fillRect(0, 0, w, 70); c.fillStyle = '#fff'; c.font = '900 30px Mont'; c.textAlign = 'left'; c.fillText('REGISTER YOUR BUSINESS', 26, 46);
    c.fillStyle = '#6b7280'; c.font = '800 22px Mont'; c.fillText('BUSINESS NAME', 30, 120);
    c.fillStyle = '#fff'; c.strokeStyle = '#c3c9d4'; c.lineWidth = 3; roundRect(c, 30, 134, w - 60, 62, 10); c.fill(); c.stroke();
    c.fillStyle = '#17171c'; c.font = '900 30px Mont'; c.fillText('COUCH CRUSHERS MOVING CO.', 46, 176);
    c.fillStyle = '#6b7280'; c.font = '800 22px Mont'; c.fillText('OWNER', 30, 236);
    c.fillStyle = '#fff'; roundRect(c, 30, 250, w - 60, 62, 10); c.fill(); c.stroke();
    c.fillStyle = '#17171c'; c.font = '900 30px Mont'; c.fillText('YOU', 46, 292);
    if (approved) {
      c.save(); c.translate(w / 2, 410); c.rotate(-0.12);
      c.strokeStyle = '#1fa64a'; c.lineWidth = 12; roundRect(c, -230, -58, 460, 116, 18); c.stroke();
      c.fillStyle = '#1fa64a'; c.font = '900 78px Mont'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('APPROVED', 0, 4); c.restore();
    } else {
      c.fillStyle = '#1fa64a'; roundRect(c, w / 2 - 140, 360, 280, 76, 14); c.fill(); c.fillStyle = '#fff'; c.font = '900 34px Mont'; c.textAlign = 'center'; c.fillText('SUBMIT', w / 2, 410);
    }
  };
  const t1 = canvasTex(768, 480, draw(false)), t2 = canvasTex(768, 480, draw(true));
  const scr = plane(0.57, 0.356, t1); scr.material.emissive = new THREE.Color('#ffffff'); scr.material.emissiveMap = t1; scr.material.emissiveIntensity = 0.55;
  scr.position.set(0, 0.2, 0.011); lid.add(scr);
  g.userData.lid = lid; g.userData.setApproved = a => { scr.material.map = scr.material.emissiveMap = a ? t2 : t1; };
  lid.rotation.x = -0.25;
  return g;
}
export function printer() {
  const g = new THREE.Group();
  g.add(box(0.7, 0.3, 0.5, mat('#e9ebee', { roughness: 0.45 }), { pos: [0, 0.15, 0] }));
  g.add(box(0.5, 0.04, 0.3, mat('#d0d4da'), { pos: [0, 0.32, -0.05] }));
  g.add(box(0.5, 0.03, 0.06, mat('#3a3d44'), { pos: [0, 0.2, 0.25] }));
  g.add(box(0.08, 0.04, 0.02, mat('#5cff8a', { emissive: '#30d060', emissiveIntensity: 0.8 }), { pos: [0.25, 0.25, 0.25] }));
  return g;
}
let cardTex;
export function card() {
  cardTex = cardTex || canvasTex(700, 400, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f7de1'; c.fillRect(0, h - 40, w, 40); drawLogo(c, w, h - 30); });
  const p = plane(0.35, 0.2, cardTex, { cast: true }); p.material.roughness = 0.6;
  return p;
}
export function insuranceDoc() {
  const g = new THREE.Group();
  const t = canvasTex(600, 800, (c, w, h) => {
    c.fillStyle = '#fbfaf5'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#17171c'; c.font = '900 54px Mont'; c.textAlign = 'center'; c.fillText('INSURANCE', w / 2, 110); c.font = '800 34px Mont'; c.fillText('POLICY', w / 2, 160);
    c.save(); c.translate(w / 2, 320); c.fillStyle = '#2f7de1'; c.beginPath(); c.moveTo(0, -110); c.lineTo(95, -70); c.lineTo(85, 40); c.quadraticCurveTo(50, 100, 0, 125); c.quadraticCurveTo(-50, 100, -85, 40); c.lineTo(-95, -70); c.closePath(); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 18; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-40, 5); c.lineTo(-8, 40); c.lineTo(48, -30); c.stroke(); c.restore();
    c.fillStyle = '#c9ccd2'; for (let i = 0; i < 6; i++) c.fillRect(70, 490 + i * 42, i % 3 === 2 ? 300 : 460, 14);
  });
  const doc = plane(0.6, 0.8, t, { cast: true }); g.add(doc);
  const st = canvasTex(512, 200, (c, w, h) => { c.translate(w / 2, h / 2); c.strokeStyle = '#e02b2b'; c.lineWidth = 14; roundRect(c, -235, -80, 470, 160, 22); c.stroke(); c.fillStyle = '#e02b2b'; c.font = '900 96px Mont'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('INSURED', 0, 6); });
  const stamp = plane(0.5, 0.195, st, { transparent: true }); stamp.position.set(0, -0.18, 0.01); stamp.rotation.z = 0.18; g.add(stamp);
  g.userData.stamp = stamp;
  return g;
}
export function sign() {
  const g = new THREE.Group(), wood = mat('#3a3f47');
  const draw = (price, crossed) => (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#17171c'; c.lineWidth = 16; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#17171c'; c.font = '900 78px Mont'; c.textAlign = 'center'; c.fillText('MOVING', w / 2, 130);
    c.fillStyle = '#1fa64a'; c.font = '200px Lucky'; c.fillText(price, w / 2, 360);
    if (crossed) { c.strokeStyle = '#e02b2b'; c.lineWidth = 26; c.lineCap = 'round'; c.beginPath(); c.moveTo(100, 330); c.lineTo(w - 100, 250); c.stroke(); }
  };
  const t = canvasTex(512, 440, draw('$20', false));
  const face = plane(1.0, 0.86, t); face.position.set(0, 1.0, 0.24); face.rotation.x = -0.25; g.add(face);
  g.add(box(1.08, 0.94, 0.04, wood, { pos: [0, 1.0, 0.215], rot: [-0.25, 0, 0] }));
  g.add(box(1.08, 0.94, 0.04, wood, { pos: [0, 1.0, -0.215], rot: [0.25, 0, 0] }));
  const sticker = plane(0.82, 0.46, canvasTex(400, 240, (c, w, h) => { c.fillStyle = '#ffd21f'; c.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = i % 2 ? 100 : 118; c.lineTo(w / 2 + Math.cos(a) * r * 1.6, h / 2 + Math.sin(a) * r); } c.fill(); c.fillStyle = '#e02b2b'; c.font = '150px Lucky'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$80', w / 2, h / 2 + 10); }), { transparent: true });
  sticker.position.set(0.0, 0.88, 0.3); sticker.rotation.set(-0.25, 0, -0.12); g.add(sticker);
  g.userData.sticker = sticker; g.userData.cross = () => { const c = t.userData.canvas.getContext('2d'); draw('$20', true)(c, 512, 440); t.needsUpdate = true; };
  g.userData.uncross = () => { const c = t.userData.canvas.getContext('2d'); draw('$20', false)(c, 512, 440); t.needsUpdate = true; };
  return g;
}
export function trashcan(color = '#7c8a96') {
  const g = new THREE.Group();
  g.add(cyl(0.3, 0.25, 0.85, 8, mat(color, { roughness: 0.4, metalness: 0.3 }), { pos: [0, 0.425, 0] }));
  const lid = cyl(0.33, 0.33, 0.06, 8, mat(color, { roughness: 0.4, metalness: 0.3 }), { pos: [0, 0.88, 0] }); g.add(lid); g.userData.lid = lid;
  return g;
}
export function tree(s = 1, hue = 0) {
  const g = new THREE.Group();
  g.add(cyl(0.13 * s, 0.18 * s, 1.6 * s, 6, mat('#7a5232'), { pos: [0, 0.8 * s, 0] }));
  const greens = ['#5aa648', '#4f9a43', '#66b04f'];
  const c = mesh(new THREE.IcosahedronGeometry(1.15 * s, 1), mat(greens[hue % 3])); c.position.y = 2.25 * s; g.add(c);
  const c2 = mesh(new THREE.IcosahedronGeometry(0.75 * s, 1), mat(greens[(hue + 1) % 3])); c2.position.set(0.5 * s, 2.9 * s, 0.2 * s); g.add(c2);
  return g;
}
export function bush(s = 1) { const m = mesh(new THREE.IcosahedronGeometry(0.5 * s, 1), mat('#4f9a43')); m.scale.y = 0.75; m.position.y = 0.32 * s; return grp(m); }
export function lamppost() {
  const g = new THREE.Group(), m = mat('#3b4048');
  g.add(cyl(0.07, 0.09, 4.2, 6, m, { pos: [0, 2.1, 0] }));
  g.add(box(0.7, 0.07, 0.07, m, { pos: [0.3, 4.15, 0] }));
  g.add(box(0.35, 0.12, 0.25, mat('#fff3c4', { emissive: '#ffe9a0', emissiveIntensity: 0.5 }), { pos: [0.6, 4.08, 0] }));
  return g;
}
export function cloud(s = 1) {
  const g = new THREE.Group(), m = mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35 });
  [[0, 0, 0, 1.4], [1.3, -0.2, 0, 1.0], [-1.3, -0.3, 0.1, 0.9], [0.5, 0.5, -0.2, 0.9]].forEach(([x, y, z, r]) => { const c = mesh(new THREE.IcosahedronGeometry(r * s, 1), m, { cast: false, receive: false }); c.position.set(x * s, y * s, z * s); g.add(c); });
  g.scale.y = 0.65; return g;
}
export function bulb() {
  const g = new THREE.Group();
  g.add(cyl(0.008, 0.008, 1.0, 4, mat('#222'), { pos: [0, -0.5, 0] }));
  g.add(cyl(0.035, 0.035, 0.06, 6, mat('#444'), { pos: [0, -1.02, 0] }));
  g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), mat('#fff6d0', { emissive: '#ffe08a', emissiveIntensity: 1.2 }), { cast: false }).translateY(-1.1));
  return g;
}
export function mattress() {
  const g = new THREE.Group();
  g.add(box(1.0, 0.2, 1.9, mat('#e9e3d6'), { pos: [0, 0.1, 0] }));
  g.add(box(0.6, 0.1, 0.35, mat('#ffffff'), { pos: [0, 0.25, -0.7] }));
  g.add(box(0.9, 0.05, 0.9, mat('#6f8fc4'), { pos: [0, 0.225, 0.4], rot: [0, 0.1, 0] }));
  return g;
}
export function pizzaBox() {
  const g = new THREE.Group();
  g.add(box(0.45, 0.05, 0.45, mat('#d9b98a'), { pos: [0, 0.025, 0] }));
  const lid = box(0.45, 0.012, 0.45, mat('#e2c495'), { pos: [0, 0.2, -0.27], rot: [-1.2, 0, 0] }); g.add(lid);
  return g;
}
