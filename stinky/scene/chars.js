// Low-poly blocky characters: chamfered (faceted) heads, pixel faces drawn on a canvas,
// blocky hands, clothes with canvas-made patterns.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, box, group, canvasTex, hex, shade, aim2 } from './lib.js';

const TW = 0.64, TH = 0.74, TD = 0.36;
const HW = 0.62, HH = 0.6, HD = 0.56;
const AW = 0.2, AD = 0.22, UA = 0.38, FA = 0.3;
const THIGH = 0.42, SHIN = 0.42;
export const DIM = { TW, TH, TD, HW, HH, HD, AW, UA, FA, THIGH, SHIN, HIP_Y: THIGH + SHIN };

// ---------------- canvas cloth patterns ----------------
export function pattern(kind, a, b) {
  const t = canvasTex(64, 64, (ctx) => {
    ctx.fillStyle = a; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = b;
    if (kind === 'stripes') for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 6);
    if (kind === 'plaid') { for (let i = 0; i < 64; i += 16) { ctx.globalAlpha = 0.55; ctx.fillRect(i, 0, 5, 64); ctx.fillRect(0, i, 64, 5); } ctx.globalAlpha = 1; }
    if (kind === 'dots') for (let y = 4; y < 64; y += 16) for (let x = (y / 16) % 2 ? 12 : 4; x < 64; x += 16) ctx.fillRect(x, y, 5, 5);
    if (kind === 'flowers') for (let y = 6; y < 64; y += 20) for (let x = (y / 20) % 2 ? 14 : 4; x < 64; x += 20) { ctx.fillRect(x, y + 2, 6, 2); ctx.fillRect(x + 2, y, 2, 6); }
  }, { nearest: true });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  return new THREE.MeshLambertMaterial({ map: t });
}
const M = (m) => (typeof m === 'number' ? mat(m) : m);

// ---------------- pixel faces (64x64) ----------------
function drawFace(ctx, st, e) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const skin = hex(st.skin), dark = '#22140f', white = '#ffffff';
  R(0, 0, 64, 64, skin);
  R(0, 58, 64, 6, hex(shade(st.skin, 0.93)));
  const eyes = e.eyes || st.eyes || 'normal';
  const px = e.pupil ? e.pupil[0] : 0, py = e.pupil ? e.pupil[1] : 0;
  const ey = 29;
  [[19, 1], [45, -1]].forEach(([cx, inner]) => {
    if (eyes === 'closedHappy') { for (let dx = -6; dx <= 6; dx++) R(cx + dx, ey - 3 + Math.round(Math.abs(dx) * 0.55), 1, 3, dark); }
    else if (eyes === 'shut') R(cx - 6, ey, 13, 2, dark);
    else if (eyes === 'squeeze') { for (let k = 0; k < 6; k++) { const x = inner > 0 ? cx - 5 + k : cx + 5 - k; R(x, ey - 5 + k, 2, 2, dark); R(x, ey + 5 - k, 2, 2, dark); } }
    else if (eyes === 'x') { for (let k = -4; k <= 4; k++) { R(cx + k, ey + k, 2, 2, dark); R(cx + k, ey - k, 2, 2, dark); } }
    else if (eyes === 'spiral') { R(cx - 6, ey - 6, 13, 13, white); const c = dark; R(cx - 5, ey - 5, 11, 1, c); R(cx + 5, ey - 5, 1, 10, c); R(cx - 3, ey + 4, 9, 1, c); R(cx - 3, ey - 3, 1, 8, c); R(cx - 3, ey - 3, 7, 1, c); R(cx + 3, ey - 3, 1, 5, c); R(cx - 1, ey + 1, 5, 1, c); R(cx - 1, ey - 1, 1, 3, c); }
    else {
      let w = 11, h = 11, pw = 5, ph = 6;
      if (eyes === 'big') { w = 13; h = 15; pw = 5; ph = 7; }
      if (eyes === 'cute') { w = 13; h = 15; pw = 9; ph = 11; }
      if (eyes === 'wide') { w = 15; h = 17; pw = 3; ph = 3; }
      if (eyes === 'sleepy') { w = 12; h = 5; pw = 5; ph = 4; }
      const x0 = cx - Math.floor(w / 2), y0 = ey - Math.floor(h / 2);
      R(x0, y0, w, h, white);
      const pxx = Math.round(cx - pw / 2 + px * (w - pw) * 0.42);
      const pyy = Math.round(ey - ph / 2 + py * (h - ph) * 0.42);
      R(pxx, pyy, pw, ph, eyes === 'cute' ? '#3b2416' : '#120a08');
      if (eyes === 'cute') { R(pxx, pyy + ph - 4, pw, 4, '#6b3d22'); R(pxx + 1, pyy + 1, 3, 3, white); R(pxx + pw - 3, pyy + ph - 4, 2, 2, white); R(pxx + 5, pyy + 2, 1, 1, white); }
      else if (eyes !== 'wide' && eyes !== 'sleepy') R(pxx + 1, pyy + 1, 2, 2, white);
      if (eyes === 'sleepy') R(x0 - 1, y0 - 2, w + 2, 3, hex(shade(st.skin, 0.75)));
      if (st.lashes) { R(x0 - 1, y0 - 2, w + 2, 2, '#120a08'); R(inner > 0 ? x0 - 3 : x0 + w + 1, y0 - 4, 2, 3, '#120a08'); R(inner > 0 ? x0 - 2 : x0 + w, y0 - 1, 2, 2, '#120a08'); }
    }
    const brows = e.brows || st.brows || 'neutral';
    const bt = st.browThick || 3;
    for (let k = 0; k < 13; k++) {
      const xx = cx - 6 + k;
      const ti = inner > 0 ? k / 12 : 1 - k / 12;
      let yy = ey - 12;
      if (eyes === 'cute' || eyes === 'big') yy = ey - 14;
      if (brows === 'worried') yy -= Math.round(ti * 4) - 1;
      if (brows === 'angry') yy += Math.round(ti * 5) - 2;
      if (brows === 'raised') yy -= 3;
      if (brows === 'confused') yy += inner > 0 ? Math.round(ti * 3) : -3 - Math.round((1 - ti) * 2);
      R(xx, yy, 1, bt, st.browColor || dark);
    }
  });
  // nose (only when sniffing)
  if (e.nose) { const o = e.nose === 'twitch' ? 1 : 0; R(29 + o, 38, 2, 3, hex(shade(st.skin, 0.7))); R(33 + o, 38, 2, 3, hex(shade(st.skin, 0.7))); R(28 + o, 36, 8, 2, hex(shade(st.skin, 0.82))); }
  const lip = st.lips || dark;
  const m = e.mouth || st.mouth || 'flat';
  const my = 47;
  if (m === 'flat') R(25, my, 14, 3, lip);
  else if (m === 'smallSmile') { R(23, my - 2, 3, 2, lip); R(25, my, 14, 3, lip); R(38, my - 2, 3, 2, lip); }
  else if (m === 'cuteSmile') { R(26, my - 1, 2, 2, lip); R(28, my + 1, 8, 2, lip); R(36, my - 1, 2, 2, lip); }
  else if (m === 'smile') { for (let y = 0; y < 6; y++) { const hw = Math.round(11 - y * 1.6); R(32 - hw, my - 2 + y, hw * 2, 1, dark); } R(23, my - 2, 18, 2, white); R(21, my - 4, 3, 3, dark); R(40, my - 4, 3, 3, dark); }
  else if (m === 'shiny') { R(14, my - 6, 36, 11, dark); R(16, my - 4, 32, 7, white); for (const x of [20, 25, 30, 35, 40, 45]) R(x, my - 4, 1, 7, '#d8e8ff'); R(11, my - 9, 4, 4, dark); R(49, my - 9, 4, 4, dark); }
  else if (m === 'o') { R(28, my - 4, 8, 9, dark); R(29, my - 3, 6, 7, '#7a1e22'); }
  else if (m === 'yawn') { R(22, my - 9, 20, 16, dark); R(24, my - 7, 16, 12, '#5a1418'); R(27, my + 1, 10, 4, '#e0606a'); R(24, my - 9, 16, 2, white); }
  else if (m === 'open') { R(25, my - 3, 14, 8, dark); R(27, my + 2, 10, 3, '#d0525a'); R(26, my - 3, 12, 2, white); }
  else if (m === 'frown') { R(23, my + 2, 3, 2, lip); R(25, my, 14, 3, lip); R(38, my + 2, 3, 2, lip); }
  else if (m === 'wavy') { for (let k = 0; k < 18; k++) R(23 + k, my + ((k >> 1) % 2 ? 2 : 0), 1, 2, dark); }
  else if (m === 'grimace') { R(19, my - 3, 26, 8, dark); R(21, my - 2, 22, 6, white); for (const x of [25, 29, 33, 37]) R(x, my - 2, 1, 6, '#c9c2b8'); R(16, my + 3, 3, 3, dark); R(45, my + 3, 3, 3, dark); }
  else if (m === 'puffed') { R(29, my - 1, 6, 5, dark); R(5, 37, 13, 13, hex(shade(st.skin, 1.1))); R(46, 37, 13, 13, hex(shade(st.skin, 1.1))); }
  else if (m === 'foam') { R(18, my - 5, 28, 10, '#ffffff'); R(15, my - 2, 6, 6, '#f2f8ff'); R(43, my - 3, 7, 7, '#f2f8ff'); R(24, my + 4, 5, 6, '#ffffff'); R(36, my + 4, 4, 8, '#ffffff'); R(26, my - 2, 4, 3, '#cfe6ff'); }
  else if (m === 'brush') { R(24, my - 3, 16, 7, dark); R(26, my - 2, 12, 5, white); }
  else if (m === 'sniff') { R(28, my, 8, 2, lip); }
  if (e.blush ?? st.blush) { ctx.globalAlpha = e.blush ?? st.blush; R(6, 38, 11, 5, '#ff6f9a'); R(47, 38, 11, 5, '#ff6f9a'); ctx.globalAlpha = 1; }
  if (e.green) { ctx.globalAlpha = e.green; R(0, 0, 64, 64, '#7fc843'); ctx.globalAlpha = 1; }
  if (e.blue) { ctx.globalAlpha = e.blue; R(0, 0, 64, 64, '#6fd8ff'); ctx.globalAlpha = 1; }
  if (e.red) { ctx.globalAlpha = e.red; R(0, 0, 64, 64, '#ff3b2f'); ctx.globalAlpha = 1; }
}

// ---------------- generic humanoid ----------------
const headGeo = new RoundedBoxGeometry(HW, HH, HD, 1, 0.07);
function makeHuman(spec) {
  const skinM = mat(spec.skin);
  const root = new THREE.Group(); root.name = spec.name;
  const hips = group(root, 0, THIGH + SHIN, 0);
  const body = group(hips);
  const torso = box(TW, TH, TD, M(spec.shirt), 0, TH / 2, 0, body);
  const neck = group(body, 0, TH, 0);
  const head = group(neck);
  const faceTex = canvasTex(64, 64, () => {}, { nearest: true });
  const faceMat = new THREE.MeshLambertMaterial({ map: faceTex });
  const headMesh = new THREE.Mesh(headGeo, [skinM, skinM, skinM, skinM, faceMat, skinM]);
  headMesh.position.y = HH / 2 + 0.02; headMesh.castShadow = true; headMesh.receiveShadow = true;
  head.add(headMesh);
  box(0.06, 0.13, 0.11, skinM, HW / 2 + 0.02, 0.31, 0, head);
  box(0.06, 0.13, 0.11, skinM, -HW / 2 - 0.02, 0.31, 0, head);
  box(0.24, 0.07, 0.2, skinM, 0, -0.01, 0, head);
  const arms = {};
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const shoulder = group(body, s * (TW / 2 + AW / 2 + 0.006), TH - 0.08, 0);
    box(AW, UA + 0.04, AD, M(spec.sleeve ?? spec.shirt), 0, -UA / 2 + 0.02, 0, shoulder);
    const elbow = group(shoulder, 0, -UA, 0);
    box(AW * 0.96, FA, AD * 0.96, M(spec.forearm ?? spec.sleeve ?? spec.shirt), 0, -FA / 2, 0, elbow);
    box(AW * 1.0, 0.17, AD * 0.95, skinM, 0, -FA - 0.085, 0, elbow);             // blocky hand
    const thumb = box(0.07, 0.1, 0.07, skinM, 0, -FA - 0.06, 0.11, elbow); thumb.visible = false;
    const finger = box(0.065, 0.16, 0.065, skinM, 0, -FA - 0.21, 0, elbow); finger.visible = false;
    const hand = group(elbow, 0, -FA - 0.1, 0);
    arms[k] = { shoulder, elbow, finger, thumb, hand, s };
  }
  const legs = {};
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const hip = group(hips, s * 0.16, 0, 0);
    box(0.29, THIGH + 0.02, 0.33, M(spec.pants), 0, -THIGH / 2, 0, hip);
    const knee = group(hip, 0, -THIGH, 0);
    box(0.28, SHIN - 0.1, 0.32, M(spec.shin ?? spec.pants), 0, -(SHIN - 0.1) / 2, 0, knee);
    box(0.3, 0.12, 0.4, M(spec.shoes ?? 0x2a2420), 0, -SHIN + 0.06, 0.04, knee);
    legs[k] = { hip, knee, s };
  }
  const ch = { name: spec.name, root, hips, body, torso, neck, head, headMesh, arms, legs, face: { tex: faceTex, key: '' }, extras: {} };
  ch.setFace = (e) => {
    const key = JSON.stringify(e);
    if (key === ch.face.key) return;
    ch.face.key = key;
    drawFace(faceTex.userData.ctx, spec.face, e);
    faceTex.needsUpdate = true;
  };
  ch.reset = () => {
    root.visible = false;
    root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1);
    hips.position.set(0, THIGH + SHIN, 0); hips.rotation.set(0, 0, 0);
    body.rotation.set(0, 0, 0); neck.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); head.position.set(0, 0, 0); head.visible = true;
    for (const a of Object.values(arms)) { aim2(a.shoulder, a.elbow, [a.s * 0.1, -1, 0], [a.s * 0.06, -1, 0.06]); a.finger.visible = false; a.thumb.visible = false; }
    for (const l of Object.values(legs)) aim2(l.hip, l.knee, [0, -1, 0], [0, -1, 0]);
    if (ch.onReset) ch.onReset();
    ch.setFace({});
  };
  return ch;
}

export const pose = {
  armsDown(ch) { for (const a of Object.values(ch.arms)) aim2(a.shoulder, a.elbow, [a.s * 0.1, -1, 0], [a.s * 0.06, -1, 0.06]); },
  arm(ch, side, dU, dL) { const a = ch.arms[side]; aim2(a.shoulder, a.elbow, dU, dL || dU); },
  point(ch, side, dir) { const a = ch.arms[side]; aim2(a.shoulder, a.elbow, dir, dir); a.finger.visible = true; },
  thumbsUp(ch, side) { const a = ch.arms[side]; aim2(a.shoulder, a.elbow, [a.s * 0.35, -0.55, 0.75], [a.s * 0.1, 1, 0.15]); a.thumb.visible = true; a.thumb.position.set(0, -FA - 0.06, 0.13); },
  stretch(ch, u) { for (const a of Object.values(ch.arms)) aim2(a.shoulder, a.elbow, [a.s * (0.1 + 0.4 * u), -1 + 1.9 * u, 0], [a.s * 0.2 * u, -1 + 2 * u, 0]); },
  armpits(ch, u) { for (const a of Object.values(ch.arms)) aim2(a.shoulder, a.elbow, [a.s * (0.1 + 0.9 * u), -1 + 0.9 * u, 0], [a.s * (0.06 + 0.3 * u), -1 + 1.6 * u, 0.1]); },
  sit(ch, seatY = 0.5) {
    ch.hips.position.y = seatY + 0.15;
    for (const l of Object.values(ch.legs)) aim2(l.hip, l.knee, [l.s * 0.05, -0.05, 1], [0, -1, 0.05]);
  },
  walk(ch, phase, amp = 1) {
    const s = Math.sin(phase) * 0.45 * amp;
    aim2(ch.legs.L.hip, ch.legs.L.knee, [0, -1, s], [0, -1, s - Math.max(0, -Math.cos(phase)) * 0.45 * amp]);
    aim2(ch.legs.R.hip, ch.legs.R.knee, [0, -1, -s], [0, -1, -s - Math.max(0, Math.cos(phase)) * 0.45 * amp]);
    ch.hips.position.y = THIGH + SHIN - Math.abs(Math.cos(phase)) * 0.03 * amp;
    for (const a of Object.values(ch.arms)) aim2(a.shoulder, a.elbow, [a.s * 0.12, -1, -s * a.s * 0.8], [a.s * 0.06, -1, -s * a.s * 0.8 + 0.15]);
  },
  run(ch, phase) {
    const s = Math.sin(phase);
    aim2(ch.legs.L.hip, ch.legs.L.knee, [0, -0.8, 0.75 * s], [0, -0.6, 0.6 * s - 0.6]);
    aim2(ch.legs.R.hip, ch.legs.R.knee, [0, -0.8, -0.75 * s], [0, -0.6, -0.6 * s - 0.6]);
    ch.hips.position.y = THIGH + SHIN - 0.08 + Math.abs(Math.cos(phase)) * 0.08;
    ch.body.rotation.x = 0.22;
    for (const a of Object.values(ch.arms)) aim2(a.shoulder, a.elbow, [a.s * 0.15, -0.8, -s * a.s * 0.9], [a.s * 0.1, 0.2, -s * a.s * 0.6 + 0.6]);
  },
};

// ---------------- the cast ----------------
const HAIR = 0x17110d;
function hairBox(H, w, h, d, x, y, z, m) { return box(w, h, d, m, x, y, z, H); }

export function makeYou() {
  const pj = pattern('stripes', '#9fb3c8', '#5f7fa6'), pjPants = pattern('plaid', '#3d5a8a', '#9ab4e0');
  const shirtM = mat(0x2b8c8c), skin = 0xc68a62;
  const ch = makeHuman({ name: 'you', skin, shirt: pj, sleeve: pj, forearm: skin, pants: pjPants, shoes: skin, face: { skin, eyes: 'big', browThick: 3 } });
  const B = ch.body, H = ch.head;
  const hairM = mat(HAIR);
  const messy = group(H);
  hairBox(messy, 0.66, 0.12, 0.6, 0, HH + 0.06, -0.01, hairM);
  for (let i = 0; i < 11; i++) {
    const s = box(0.11, 0.24, 0.11, hairM, -0.26 + (i % 5) * 0.13, HH + 0.15, -0.22 + Math.floor(i / 5) * 0.2, messy);
    s.rotation.set(((i * 37) % 7 - 3) * 0.16, i, ((i * 53) % 9 - 4) * 0.18);
  }
  hairBox(messy, 0.66, 0.4, 0.08, 0, HH * 0.62, -HD / 2 - 0.03, hairM);
  box(0.14, 0.18, 0.08, hairM, 0.2, HH - 0.02, HD / 2 + 0.02, messy).rotation.z = 0.5;
  const neat = group(H);
  hairBox(neat, 0.66, 0.13, 0.62, 0, HH + 0.055, -0.01, hairM);
  hairBox(neat, 0.66, 0.09, 0.07, 0, HH - 0.02, HD / 2 + 0.015, hairM);
  hairBox(neat, 0.38, 0.07, 0.08, -0.15, HH - 0.07, HD / 2 + 0.02, hairM);
  hairBox(neat, 0.66, 0.42, 0.08, 0, HH * 0.62, -HD / 2 - 0.03, hairM);
  box(0.28, 0.018, 0.05, mat(0xf2f2f2, { basic: true }), 0.1, HH + 0.125, 0.12, neat, false);
  for (const s of [1, -1]) { hairBox(messy, 0.05, 0.22, 0.5, s * (HW / 2 + 0.02), HH * 0.78, -0.02, hairM); hairBox(neat, 0.05, 0.22, 0.5, s * (HW / 2 + 0.02), HH * 0.78, -0.02, hairM); }
  // date outfit (collar, buttons, sleeves, jeans, sneakers) is a separate set of meshes we toggle
  const dressy = group(B);
  box(TW + 0.01, TH + 0.01, TD + 0.01, shirtM, 0, TH / 2, 0, dressy);
  const c1 = box(0.2, 0.07, 0.06, mat(0xe8f4f4), -0.1, TH - 0.03, TD / 2 + 0.01, dressy, false); c1.rotation.z = -0.35;
  const c2 = box(0.2, 0.07, 0.06, mat(0xe8f4f4), 0.1, TH - 0.03, TD / 2 + 0.01, dressy, false); c2.rotation.z = 0.35;
  for (let i = 0; i < 4; i++) box(0.03, 0.03, 0.02, mat(0xffffff), 0, 0.17 + i * 0.13, TD / 2 + 0.015, dressy, false);
  box(TW + 0.03, 0.06, TD + 0.03, mat(0x3a2a1a), 0, 0.03, 0, dressy, false);
  const dressyArms = [], dressyLegs = [];
  for (const a of Object.values(ch.arms)) { dressyArms.push(box(AW + 0.012, UA + 0.05, AD + 0.012, shirtM, 0, -UA / 2 + 0.02, 0, a.shoulder)); dressyArms.push(box(AW * 0.96 + 0.012, FA * 0.75, AD * 0.96 + 0.012, shirtM, 0, -FA * 0.375, 0, a.elbow)); }
  for (const l of Object.values(ch.legs)) {
    dressyLegs.push(box(0.3, THIGH + 0.03, 0.34, mat(0x2d3e63), 0, -THIGH / 2, 0, l.hip));
    dressyLegs.push(box(0.29, SHIN - 0.09, 0.33, mat(0x2d3e63), 0, -(SHIN - 0.1) / 2, 0, l.knee));
    dressyLegs.push(box(0.31, 0.13, 0.42, mat(0xf4f4f4), 0, -SHIN + 0.06, 0.04, l.knee));
  }
  // armpit sweat patches (only visible at the end)
  const pits = [];
  for (const a of Object.values(ch.arms)) pits.push(box(0.04, 0.16, 0.16, mat(0x1d6a6a), -a.s * (AW / 2 + 0.005), -0.08, 0, a.shoulder, false));
  ch.extras = { messy, neat, dressy, dressyArms, dressyLegs, pits };
  ch.outfit = (o) => {
    const date = o === 'date';
    neat.visible = date; messy.visible = !date; dressy.visible = date;
    for (const m of dressyArms.concat(dressyLegs)) m.visible = date;
  };
  ch.onReset = () => { ch.outfit('pj'); for (const p of pits) p.visible = false; };
  return ch;
}

export function makeCrush() {
  const yellow = 0xffd23f, skin = 0xe2b08c;
  const dress = pattern('flowers', '#ffd23f', '#ffffff');
  const ch = makeHuman({ name: 'crush', skin, shirt: dress, sleeve: mat(0xffe27a), forearm: skin, pants: skin, shin: skin, shoes: 0xffffff,
    face: { skin, eyes: 'cute', lashes: true, lips: '#e0457a', blush: 0.55, mouth: 'cuteSmile' } });
  const B = ch.body, H = ch.head;
  // flared skirt + white collar + puffy sleeves + bow
  const hem = group(ch.hips);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.64, 0.52, 4, 1), dress);
  skirt.rotation.y = Math.PI / 4; skirt.scale.set(1, 1, 0.75); skirt.position.y = -0.22; skirt.castShadow = true; hem.add(skirt);
  ch.extras.hem = hem;
  box(0.36, 0.06, 0.05, mat(0xffffff), -0.1, TH - 0.04, TD / 2 + 0.01, B, false).rotation.z = -0.3;
  box(0.36, 0.06, 0.05, mat(0xffffff), 0.1, TH - 0.04, TD / 2 + 0.01, B, false).rotation.z = 0.3;
  box(TW + 0.02, 0.06, TD + 0.02, mat(0xfff3c4), 0, 0.05, 0, B, false);
  for (const k of ['L', 'R']) box(AW * 1.3, 0.2, AD * 1.3, mat(yellow), 0, -0.06, 0, ch.arms[k].shoulder, false);
  // long black hair with straight bangs
  const hairM = mat(HAIR);
  box(0.68, 0.13, 0.64, hairM, 0, HH + 0.05, -0.01, H);
  box(0.68, 0.17, 0.09, hairM, 0, HH - 0.07, HD / 2 + 0.02, H);       // bangs
  box(0.11, 0.8, 0.16, hairM, HW / 2 + 0.03, HH * 0.38, 0.17, H);
  box(0.11, 0.8, 0.16, hairM, -HW / 2 - 0.03, HH * 0.38, 0.17, H);
  box(0.68, 1.25, 0.14, hairM, 0, HH - 0.55, -HD / 2 - 0.05, H);
  box(0.3, 0.02, 0.05, mat(0xeeeeee, { basic: true }), 0.12, HH + 0.125, 0.18, H, false);
  const bow = group(H, 0.24, HH + 0.06, 0.15);
  box(0.12, 0.1, 0.05, mat(0xff8fb1), -0.06, 0, 0, bow); box(0.12, 0.1, 0.05, mat(0xff8fb1), 0.06, 0, 0, bow); box(0.05, 0.06, 0.06, mat(0xff5d93), 0, 0, 0, bow);
  ch.onReset = () => { hem.rotation.set(0, 0, 0); hem.position.set(0, 0, 0); };
  return ch;
}

export function makeWaiter() {
  const skin = 0x8d5a3b;
  const ch = makeHuman({ name: 'waiter', skin, shirt: 0xf6f6f6, pants: 0x1c1c22, shoes: 0x111111, face: { skin, eyes: 'normal', brows: 'raised' } });
  const B = ch.body, H = ch.head;
  box(TW + 0.03, TH - 0.18, TD + 0.03, mat(0x23232b), 0, (TH - 0.18) / 2 + 0.04, 0, B);
  box(0.16, 0.07, 0.05, mat(0xb3122e), 0, TH - 0.06, TD / 2 + 0.03, B, false);
  const apron = group(ch.hips); box(0.6, 0.62, 0.03, mat(0xffffff), 0, -0.3, TD / 2 + 0.03, apron, false);
  const hairM = mat(0x2b1d14);
  box(0.66, 0.1, 0.6, hairM, 0, HH + 0.04, -0.02, H); box(0.66, 0.36, 0.08, hairM, 0, HH * 0.64, -HD / 2 - 0.03, H);
  box(0.3, 0.06, 0.06, mat(0x2b1d14), 0, 0.2, HD / 2 + 0.03, H); // little mustache
  return ch;
}

export function makePatron(kind) {
  const look = kind === 'a'
    ? { skin: 0xb07850, shirt: 0x3f8f4f, pants: 0x4a4038, hair: 0x2a1d14 }
    : kind === 'b' ? { skin: 0xf0c8a0, shirt: 0x8a5bc4, pants: 0x2d3e63, hair: 0x7a4a24 }
      : { skin: 0xd9a77e, shirt: 0xc4503a, pants: 0x3a3a3a, hair: 0xcfcfcf };
  const ch = makeHuman({ name: 'patron' + kind, skin: look.skin, shirt: look.shirt, pants: look.pants, face: { skin: look.skin, eyes: 'normal' } });
  const H = ch.head, hm = mat(look.hair);
  box(0.66, 0.11, 0.6, hm, 0, HH + 0.05, -0.01, H); box(0.66, 0.38, 0.08, hm, 0, HH * 0.62, -HD / 2 - 0.03, H);
  if (kind === 'b') box(0.28, 0.24, 0.2, hm, 0, HH * 0.75, -HD / 2 - 0.12, H);
  if (kind === 'c') box(0.5, 0.12, 0.06, hm, 0, 0.12, HD / 2 + 0.03, H); // beard
  return ch;
}
