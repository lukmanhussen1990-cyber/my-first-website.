// Blocky low-poly characters (Roblox/Minecraft style) with pixel-art faces drawn on a canvas.
import * as THREE from 'three';
import { mat, box, group, canvasTex, hex, shade, aim, aim2 } from './lib.js';

const TW = 0.64, TH = 0.74, TD = 0.36;      // torso
const HW = 0.6, HH = 0.58, HD = 0.54;       // head
const AW = 0.2, AD = 0.22, UA = 0.38, FA = 0.3; // arms
const THIGH = 0.42, SHIN = 0.42;            // legs
export const DIM = { TW, TH, TD, HW, HH, HD, AW, UA, FA, THIGH, SHIN, HIP_Y: THIGH + SHIN };

// ----------------------------------------------------------------------------------------
// Pixel faces (64x64 canvas, nearest filtering)
// ----------------------------------------------------------------------------------------
function drawFace(ctx, st, e) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const skin = hex(st.skin), dark = '#2a1712', white = '#ffffff';
  R(0, 0, 64, 64, skin);
  // subtle lower-face shade for depth
  R(0, 58, 64, 6, hex(shade(st.skin, 0.93)));
  if (st.wrinkles) { R(19, 8, 26, 1, hex(shade(st.skin, 0.8))); R(22, 11, 20, 1, hex(shade(st.skin, 0.8))); }
  const eyes = e.eyes || st.eyes || 'normal';
  const px = (e.pupil ? e.pupil[0] : 0), py = (e.pupil ? e.pupil[1] : 0);
  const ey = 29;
  [[19, 1], [45, -1]].forEach(([cx, inner]) => {   // inner = direction towards face centre
    if (eyes === 'closedHappy') {
      for (let dx = -6; dx <= 6; dx++) R(cx + dx, ey - 3 + Math.round(Math.abs(dx) * 0.55), 1, 3, dark);
    } else if (eyes === 'shut') {
      R(cx - 6, ey, 13, 2, dark);
    } else {
      let w = 11, h = 11, pw = 5, ph = 6;
      if (eyes === 'big') { w = 13; h = 15; pw = 5; ph = 7; }
      if (eyes === 'wide') { w = 15; h = 17; pw = 3; ph = 3; }
      if (eyes === 'narrow') { w = 12; h = 5; pw = 4; ph = 5; }
      if (eyes === 'angry') { w = 12; h = 9; pw = 4; ph = 4; }
      const x0 = cx - Math.floor(w / 2), y0 = ey - Math.floor(h / 2);
      R(x0, y0, w, h, white);
      if (eyes === 'angry') { // red rims + lids cutting the inner top corner
        R(x0, y0 + h - 1, w, 1, '#ff8a8a');
        for (let k = 0; k < 6; k++) {
          const xx = inner > 0 ? x0 + w - 1 - k * 2 : x0 + k * 2;
          R(inner > 0 ? xx - 1 : xx, y0, 2, 5 - Math.floor(k * 0.8), skin);
        }
      }
      const pxx = Math.round(cx - pw / 2 + px * (w - pw) * 0.42);
      const pyy = Math.round(ey - ph / 2 + py * (h - ph) * 0.42 + (eyes === 'angry' ? 1 : 0));
      R(pxx, pyy, pw, ph, '#120a08');
      if (eyes !== 'wide' && eyes !== 'narrow') R(pxx + 1, pyy + 1, 2, 2, white);
      if (st.sparkle || e.sparkle) { R(pxx + pw - 2, pyy + ph - 2, 1, 1, white); R(pxx + 1, pyy + 1, 2, 2, white); R(pxx, pyy + 1, 1, 1, '#bfe9ff'); }
      if (eyes === 'narrow') R(x0 - 1, y0 - 2, w + 2, 2, hex(shade(st.skin, 0.7)));
      if (st.lashes) { R(x0 - 1, y0 - 2, w + 2, 2, '#120a08'); R(inner > 0 ? x0 - 3 : x0 + w + 1, y0 - 4, 2, 3, '#120a08'); }
    }
    // brows
    const brows = e.brows || st.brows || 'neutral';
    const bt = st.browThick || 3;
    for (let k = 0; k < 13; k++) {
      const xx = cx - 6 + k;
      const towardInner = inner > 0 ? k / 12 : 1 - k / 12;
      let yy = ey - 12;
      if (brows === 'worried') yy = ey - 11 - Math.round(towardInner * 4);
      if (brows === 'angry') yy = ey - 14 + Math.round(towardInner * 5);
      if (brows === 'stern') yy = ey - 13 + Math.round(towardInner * 3);
      if (brows === 'raised') yy = ey - 16;
      R(xx, yy, 1, bt, st.browColor || dark);
    }
  });
  // mouth
  const lip = st.lips || dark;
  const m = e.mouth || 'flat';
  const my = st.mouthY || 47;
  if (m === 'flat') R(25, my, 14, 3, lip);
  else if (m === 'smallSmile') { R(23, my - 2, 3, 2, lip); R(25, my, 14, 3, lip); R(38, my - 2, 3, 2, lip); }
  else if (m === 'smile') { for (let y = 0; y < 6; y++) { const hw = Math.round(11 - y * 1.6); R(32 - hw, my - 2 + y, hw * 2, 1, dark); } R(23, my - 2, 18, 2, white); R(21, my - 4, 3, 3, dark); R(40, my - 4, 3, 3, dark); }
  else if (m === 'fakeSmile') {
    R(17, my - 4, 30, 9, dark); R(19, my - 2, 26, 5, white);
    for (const x of [23, 28, 33, 38, 43]) R(x, my - 2, 1, 5, '#c9c2b8');
    R(14, my - 7, 4, 4, dark); R(46, my - 7, 4, 4, dark);
  } else if (m === 'hugeSmile') {
    R(10, my - 7, 44, 14, dark); R(12, my - 5, 40, 5, white); R(13, my + 1, 38, 4, white); R(12, my, 40, 1, '#c0394b');
    for (const x of [17, 22, 27, 32, 37, 42, 47]) { R(x, my - 5, 1, 5, '#c9c2b8'); R(x, my + 1, 1, 4, '#c9c2b8'); }
    R(6, my - 11, 5, 5, dark); R(53, my - 11, 5, 5, dark);
  } else if (m === 'o') { R(28, my - 4, 8, 9, dark); R(29, my - 3, 6, 7, '#7a1e22'); }
  else if (m === 'open') { R(25, my - 3, 14, 8, dark); R(27, my + 2, 10, 3, '#d0525a'); R(26, my - 3, 12, 2, white); }
  else if (m === 'frown') { R(23, my + 2, 3, 2, lip); R(25, my, 14, 3, lip); R(38, my + 2, 3, 2, lip); }
  else if (m === 'wavy') { for (let k = 0; k < 18; k++) R(23 + k, my + ((k >> 1) % 2 ? 2 : 0), 1, 2, dark); }
  else if (m === 'grimace') { R(19, my - 3, 26, 8, dark); R(21, my - 2, 22, 6, white); for (const x of [25, 29, 33, 37]) R(x, my - 2, 1, 6, '#c9c2b8'); R(16, my + 3, 3, 3, dark); R(45, my + 3, 3, 3, dark); }
  else if (m === 'puffed') { R(29, my - 1, 6, 5, dark); R(6, 38, 12, 12, hex(shade(st.skin, 1.08))); R(46, 38, 12, 12, hex(shade(st.skin, 1.08))); }
  else if (m === 'tight') { R(24, my, 16, 2, lip); R(23, my + 1, 2, 2, lip); R(39, my + 1, 2, 2, lip); }
  // cheeks / bindi
  const blush = e.blush ?? st.blush ?? 0;
  if (blush > 0) { ctx.globalAlpha = blush; R(7, 38, 10, 5, '#ff6f8a'); R(47, 38, 10, 5, '#ff6f8a'); ctx.globalAlpha = 1; }
  if (st.bindi) R(32 - st.bindi / 2, 12, st.bindi, st.bindi, '#d0102a');
  if (e.tears) { for (const cx of [19, 45]) { R(cx - 3, ey + 6, 6, 64, '#4fb8ff'); R(cx - 1, ey + 6, 2, 64, '#bfe9ff'); } }
  if (e.green) { ctx.globalAlpha = e.green; R(0, 0, 64, 64, '#7fc843'); ctx.globalAlpha = 1; }
  if (e.red) { ctx.globalAlpha = e.red; R(0, 0, 64, 64, '#ff3b2f'); ctx.globalAlpha = 1; }
}

// ----------------------------------------------------------------------------------------
// Generic humanoid
// ----------------------------------------------------------------------------------------
function makeHuman(spec) {
  const skinM = mat(spec.skin);
  const root = new THREE.Group();
  root.name = spec.name;
  const hips = group(root, 0, THIGH + SHIN, 0);
  const body = group(hips);
  const torsoMats = spec.torsoMats || mat(spec.shirt);
  const torso = box(TW, TH, TD, torsoMats, 0, TH / 2, 0, body);

  const neck = group(body, 0, TH, 0);
  const head = group(neck);
  const faceTex = canvasTex(64, 64, () => {}, { nearest: true });
  const faceMat = new THREE.MeshLambertMaterial({ map: faceTex });
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(HW, HH, HD), [skinM, skinM, skinM, skinM, faceMat, skinM]);
  headMesh.position.y = HH / 2 + 0.01; headMesh.castShadow = true; headMesh.receiveShadow = true;
  head.add(headMesh);
  box(0.06, 0.13, 0.11, skinM, HW / 2 + 0.03, 0.3, 0, head);   // ears
  box(0.06, 0.13, 0.11, skinM, -HW / 2 - 0.03, 0.3, 0, head);
  box(0.24, 0.06, 0.2, skinM, 0, -0.01, 0, head);              // neck stub

  const arms = {};
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const shoulder = group(body, s * (TW / 2 + AW / 2 + 0.006), TH - 0.08, 0);
    box(AW, UA + 0.04, AD, mat(spec.sleeve ?? spec.shirt), 0, -UA / 2 + 0.02, 0, shoulder);
    const elbow = group(shoulder, 0, -UA, 0);
    box(AW * 0.96, FA, AD * 0.96, mat(spec.forearm ?? spec.sleeve ?? spec.shirt), 0, -FA / 2, 0, elbow);
    if (spec.cuff) box(AW * 1.02, 0.05, AD * 1.02, mat(spec.cuff), 0, -FA + 0.03, 0, elbow);
    box(AW * 0.9, 0.15, AD * 0.88, skinM, 0, -FA - 0.075, 0, elbow);
    if (spec.bracelet) box(AW * 1.04, 0.025, AD * 1.04, mat(0xe8b931, { std: true, metalness: 0.7, roughness: 0.3 }), 0, -FA + 0.01, 0, elbow, false);
    const finger = box(0.065, 0.16, 0.065, skinM, 0, -FA - 0.2, 0.0, elbow);
    finger.visible = false;
    const hand = group(elbow, 0, -FA - 0.1, 0);   // attach props here
    arms[k] = { shoulder, elbow, finger, hand, s };
  }
  const legs = {};
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const hip = group(hips, s * 0.16, 0, 0);
    box(0.29, THIGH + 0.02, 0.33, mat(spec.pants), 0, -THIGH / 2, 0, hip);
    const knee = group(hip, 0, -THIGH, 0);
    box(0.28, SHIN - 0.1, 0.32, mat(spec.pants), 0, -(SHIN - 0.1) / 2, 0, knee);
    box(0.3, 0.12, 0.4, mat(spec.shoes ?? 0x2a2420, spec.shoesShiny ? { std: true, roughness: 0.25 } : {}), 0, -SHIN + 0.06, 0.04, knee);
    legs[k] = { hip, knee, s };
  }
  const ch = {
    name: spec.name, root, hips, body, torso, neck, head, headMesh, arms, legs,
    face: { tex: faceTex, style: spec.face, key: '' }, props: {}, extras: {},
  };
  ch.setFace = (e) => {
    const key = JSON.stringify(e);
    if (key === ch.face.key) return;
    ch.face.key = key;
    drawFace(faceTex.userData.ctx, spec.face, e);
    faceTex.needsUpdate = true;
  };
  ch.addProp = (name, obj, side = 'R', parent = null) => {
    (parent || arms[side].hand).add(obj);
    obj.visible = false;
    ch.props[name] = obj;
    return obj;
  };
  ch.reset = () => {
    root.visible = false;
    root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1);
    hips.position.set(0, THIGH + SHIN, 0); hips.rotation.set(0, 0, 0);
    body.rotation.set(0, 0, 0); body.position.set(0, 0, 0);
    neck.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); head.position.set(0, 0, 0);
    for (const a of Object.values(arms)) { aim2(a.shoulder, a.elbow, [a.s * 0.1, -1, 0], [a.s * 0.06, -1, 0.06]); a.finger.visible = false; }
    for (const l of Object.values(legs)) { aim2(l.hip, l.knee, [0, -1, 0], [0, -1, 0]); }
    for (const p of Object.values(ch.props)) p.visible = false;
    if (ch.onReset) ch.onReset();
    ch.setFace({});
  };
  return ch;
}

// ---------------------- poses ----------------------
export const pose = {
  armsDown(ch) { for (const a of Object.values(ch.arms)) aim2(a.shoulder, a.elbow, [a.s * 0.1, -1, 0], [a.s * 0.06, -1, 0.06]); },
  handsOnHips(ch) { for (const a of Object.values(ch.arms)) aim2(a.shoulder, a.elbow, [a.s * 0.75, -0.62, -0.12], [-a.s * 0.75, -0.55, 0.15]); },
  crossed(ch) {
    const L = ch.arms.L, R = ch.arms.R;
    aim2(L.shoulder, L.elbow, [0.15, -0.88, 0.45], [-1, 0.12, 0.32]);
    aim2(R.shoulder, R.elbow, [-0.15, -0.8, 0.55], [1, 0.22, 0.18]);
  },
  point(ch, side = 'R', dir = [0, 0.1, 1]) {
    const a = ch.arms[side];
    aim2(a.shoulder, a.elbow, dir, dir);
    a.finger.visible = true;
  },
  armForward(ch, side, dU, dL) { const a = ch.arms[side]; aim2(a.shoulder, a.elbow, dU, dL || dU); },
  holdPlate(ch) { for (const a of Object.values(ch.arms)) aim2(a.shoulder, a.elbow, [a.s * 0.12, -0.85, 0.45], [-a.s * 0.18, -0.05, 1]); },
  hug(ch, squeeze = 0) { for (const a of Object.values(ch.arms)) aim2(a.shoulder, a.elbow, [a.s * (0.55 - squeeze * 0.1), -0.15, 0.85], [-a.s * (0.95 + squeeze * 0.2), -0.05, 0.35]); },
  sit(ch, seatY = 0.5) {
    ch.hips.position.y = seatY + 0.15;
    for (const l of Object.values(ch.legs)) aim2(l.hip, l.knee, [l.s * 0.05, -0.05, 1], [0, -1, 0.05]);
  },
  sitBlend(ch, u, seatY = 0.5) { // u: 0 standing -> 1 seated
    ch.hips.position.y = (THIGH + SHIN) + (seatY + 0.15 - (THIGH + SHIN)) * u;
    for (const l of Object.values(ch.legs)) {
      const a = u * Math.PI / 2;
      aim2(l.hip, l.knee, [l.s * 0.05 * u, -Math.cos(a), Math.sin(a)], [0, -1, 0.05 + 0.3 * u * (1 - u)]);
    }
    ch.body.rotation.x = Math.sin(u * Math.PI) * 0.35;
  },
  walk(ch, phase, amp = 1) {
    const s = Math.sin(phase) * 0.45 * amp;
    aim2(ch.legs.L.hip, ch.legs.L.knee, [0, -1, s], [0, -1, s - Math.max(0, -Math.cos(phase)) * 0.4 * amp]);
    aim2(ch.legs.R.hip, ch.legs.R.knee, [0, -1, -s], [0, -1, -s - Math.max(0, Math.cos(phase)) * 0.4 * amp]);
    ch.hips.position.y = THIGH + SHIN - Math.abs(Math.cos(phase)) * 0.03 * amp;
    for (const a of Object.values(ch.arms)) aim2(a.shoulder, a.elbow, [a.s * 0.12, -1, -s * a.s * 0.8], [a.s * 0.06, -1, -s * a.s * 0.8 + 0.15]);
  },
};

// ----------------------------------------------------------------------------------------
// The cast
// ----------------------------------------------------------------------------------------
const HAIR_BLACK = 0x16110e;

export function makeHusband() {
  const shirt = 0x8fd0f2;
  const ch = makeHuman({
    name: 'husband', skin: 0xc28760, shirt, sleeve: shirt, forearm: shirt, cuff: 0xb9e3f8,
    pants: 0xb7a98d, shoes: 0x141414, shoesShiny: true,
    face: { skin: 0xc28760, eyes: 'big', browThick: 3 },
  });
  const B = ch.body, H = ch.head;
  // shirt details: collar, placket, buttons, pocket, belt
  const collarM = mat(0xc4e8fa);
  const c1 = box(0.2, 0.07, 0.06, collarM, -0.1, TH - 0.03, TD / 2 + 0.01, B, false); c1.rotation.z = -0.35;
  const c2 = box(0.2, 0.07, 0.06, collarM, 0.1, TH - 0.03, TD / 2 + 0.01, B, false); c2.rotation.z = 0.35;
  box(0.05, TH - 0.12, 0.02, mat(0x7fc0e4), 0, TH / 2 - 0.02, TD / 2 + 0.005, B, false);
  for (let i = 0; i < 4; i++) box(0.03, 0.03, 0.02, mat(0xffffff), 0, 0.17 + i * 0.13, TD / 2 + 0.015, B, false);
  box(0.15, 0.13, 0.02, mat(0x82c3e6), 0.16, TH - 0.24, TD / 2 + 0.006, B, false);
  box(TW + 0.02, 0.06, TD + 0.02, mat(0x4a2e1e), 0, 0.03, 0, B, false);
  box(0.08, 0.06, 0.03, mat(0xd9b24a, { std: true, metalness: 0.8, roughness: 0.3 }), 0, 0.03, TD / 2 + 0.01, B, false);
  // belly (grows after four plates, wobbles on the growl)
  const belly = box(0.5, 0.36, 0.12, mat(shirt), 0, 0.24, TD / 2 - 0.04, B);
  ch.extras.belly = belly;
  // hair: neat & combed (shiny) + optional messy spikes
  const hairM = mat(HAIR_BLACK);
  const neat = group(H);
  box(0.64, 0.13, 0.6, hairM, 0, HH + 0.055, -0.01, neat);
  box(0.64, 0.09, 0.07, hairM, 0, HH - 0.02, HD / 2 + 0.015, neat);
  box(0.36, 0.06, 0.08, hairM, -0.15, HH - 0.07, HD / 2 + 0.02, neat);  // side-swept fringe
  box(0.64, 0.42, 0.08, hairM, 0, HH * 0.62, -HD / 2 - 0.03, neat);
  box(0.05, 0.22, 0.5, hairM, HW / 2 + 0.02, HH * 0.78, -0.02, neat);
  box(0.05, 0.22, 0.5, hairM, -HW / 2 - 0.02, HH * 0.78, -0.02, neat);
  box(0.012, 0.015, 0.5, mat(0x3b322c), -0.12, HH + 0.123, -0.02, neat, false);    // side parting
  box(0.3, 0.018, 0.05, mat(0xf2f2f2, { basic: true }), 0.08, HH + 0.125, 0.12, neat, false); // shine
  for (let i = 0; i < 3; i++) box(0.012, 0.01, 0.45, mat(0x2d2520), 0.02 + i * 0.09, HH + 0.122, -0.04, neat, false); // comb lines
  const messy = group(H);
  for (let i = 0; i < 9; i++) {
    const s = box(0.1, 0.22, 0.1, hairM, -0.24 + (i % 5) * 0.12, HH + 0.14, -0.2 + Math.floor(i / 5) * 0.25, messy);
    s.rotation.set(((i * 37) % 7 - 3) * 0.12, 0, ((i * 53) % 9 - 4) * 0.13);
  }
  ch.extras.hairNeat = neat; ch.extras.hairMessy = messy;
  // brown stain on the seat of the pants (back of hips + thighs)
  const stainM = mat(0x6b4220);
  const stain = group(ch.hips);
  box(0.6, 0.3, 0.02, stainM, 0, -0.02, -0.176, stain, false);
  box(0.26, 0.22, 0.02, stainM, 0.16, -0.24, -0.176, stain, false);
  box(0.22, 0.18, 0.02, stainM, -0.15, -0.26, -0.176, stain, false);
  box(0.1, 0.12, 0.02, stainM, 0.04, -0.4, -0.176, stain, false);
  box(0.6, 0.2, 0.02, stainM, 0, 0.12, -0.19, stain, false);
  ch.extras.stain = stain;
  ch.onReset = () => { belly.scale.set(1, 1, 0.2); belly.position.set(0, 0.24, TD / 2 - 0.04); neat.visible = true; messy.visible = false; stain.visible = false; };
  return ch;
}

export function makeWife() {
  const pink = 0xff6fae, gold = 0xf2c14e;
  const ch = makeHuman({
    name: 'wife', skin: 0xd6a07a, shirt: pink, sleeve: pink, forearm: 0xd6a07a, pants: 0xd6a07a, shoes: 0xffffff,
    bracelet: true,
    face: { skin: 0xd6a07a, eyes: 'normal', lashes: true, sparkle: true, lips: '#d81b60', blush: 0.45 },
  });
  const B = ch.body, H = ch.head;
  const goldM = mat(gold, { std: true, metalness: 0.75, roughness: 0.3 });
  // flared pink skater-dress skirt (a 4-sided truncated pyramid) + white belt
  const hem = group(ch.hips);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.62, 0.5, 4, 1), mat(pink));
  skirt.rotation.y = Math.PI / 4; skirt.scale.set(1, 1, 0.75); skirt.position.y = -0.2; skirt.castShadow = true; hem.add(skirt);
  const frill = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.64, 0.06, 4, 1), mat(0xffc1dc));
  frill.rotation.y = Math.PI / 4; frill.scale.set(1, 1, 0.75); frill.position.y = -0.43; hem.add(frill);
  ch.extras.hem = hem;
  box(TW + 0.03, 0.08, TD + 0.03, mat(0xffffff), 0, 0.06, 0, B, false);          // belt
  box(0.12, 0.1, 0.03, mat(0xffffff), 0.16, 0.06, TD / 2 + 0.02, B, false);       // little bow
  box(0.34, 0.08, 0.02, mat(0xffc1dc), 0, TH - 0.05, TD / 2 + 0.01, B, false);    // collar trim
  // puff sleeves
  for (const k of ['L', 'R']) box(AW * 1.25, 0.2, AD * 1.25, mat(0xff86bb), 0, -0.06, 0, ch.arms[k].shoulder, false);
  // white sneakers already via shoes; skin-coloured legs
  // long black hair + pink clip
  const hairM = mat(HAIR_BLACK);
  box(0.66, 0.13, 0.62, hairM, 0, HH + 0.05, -0.01, H);
  box(0.66, 0.08, 0.08, hairM, 0, HH - 0.01, HD / 2 + 0.01, H);
  box(0.42, 0.06, 0.09, hairM, 0.12, HH - 0.07, HD / 2 + 0.02, H);               // side-swept bangs
  box(0.1, 0.72, 0.14, hairM, HW / 2 + 0.02, HH * 0.42, 0.18, H);
  box(0.1, 0.72, 0.14, hairM, -HW / 2 - 0.02, HH * 0.42, 0.18, H);
  box(0.66, 1.2, 0.13, hairM, 0, HH - 0.52, -HD / 2 - 0.05, H);
  box(0.26, 0.018, 0.05, mat(0xeeeeee, { basic: true }), 0.12, HH + 0.12, 0.18, H, false);
  box(0.14, 0.06, 0.06, mat(0xff4f9a), -0.22, HH + 0.02, HD / 2 + 0.04, H, false); // hair clip
  // gold hoop earrings
  for (const s of [1, -1]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 14), goldM);
    hoop.position.set(s * (HW / 2 + 0.045), 0.1, 0.02); hoop.rotation.y = Math.PI / 2; H.add(hoop);
    ch.extras['earring' + s] = hoop;
  }
  // thin gold necklace
  box(0.22, 0.02, 0.02, goldM, 0, TH - 0.12, TD / 2 + 0.012, B, false);
  ch.onReset = () => { hem.rotation.set(0, 0, 0); hem.position.set(0, 0, 0); };
  return ch;
}

export function makeDad() {
  const shirt = 0xf6f6f2;
  const ch = makeHuman({
    name: 'dad', skin: 0xab7650, shirt, sleeve: shirt, forearm: shirt, cuff: 0xe2e2dc, pants: 0x5b4636, shoes: 0x2a1c12, shoesShiny: true,
    face: { skin: 0xab7650, eyes: 'narrow', browThick: 4, brows: 'stern', wrinkles: true, mouthY: 50, browColor: '#3a3330' },
  });
  const B = ch.body, H = ch.head;
  // shirt details: collar, placket, buttons, pocket, belt (tucked in)
  const collarM = mat(0xffffff);
  const c1 = box(0.2, 0.07, 0.06, collarM, -0.1, TH - 0.03, TD / 2 + 0.01, B, false); c1.rotation.z = -0.35;
  const c2 = box(0.2, 0.07, 0.06, collarM, 0.1, TH - 0.03, TD / 2 + 0.01, B, false); c2.rotation.z = 0.35;
  box(0.05, TH - 0.12, 0.02, mat(0xe4e4de), 0, TH / 2 - 0.02, TD / 2 + 0.005, B, false);
  for (let i = 0; i < 4; i++) box(0.03, 0.03, 0.02, mat(0x8a8a8a), 0, 0.17 + i * 0.13, TD / 2 + 0.015, B, false);
  box(0.15, 0.13, 0.02, mat(0xe8e8e2), -0.16, TH - 0.24, TD / 2 + 0.006, B, false);
  box(0.03, 0.12, 0.025, mat(0x1d3d8a), -0.12, TH - 0.2, TD / 2 + 0.02, B, false); // pen-pocket pen
  box(TW + 0.02, 0.06, TD + 0.02, mat(0x2a1c12), 0, 0.03, 0, B, false);
  box(0.08, 0.06, 0.03, mat(0xc0c0c0, { std: true, metalness: 0.8, roughness: 0.3 }), 0, 0.03, TD / 2 + 0.01, B, false);
  const hem = group(ch.hips); ch.extras.hem = hem;   // (nothing hangs below the belt any more)
  // maroon sweater vest over the shirt (contrast against the white sofa)
  const vestM = mat(0x7a2e2e);
  box(TW + 0.03, TH - 0.2, TD + 0.03, vestM, 0, (TH - 0.2) / 2 + 0.06, 0, B);
  box(0.2, 0.12, TD + 0.03, vestM, -0.21, TH - 0.2, 0, B, false);
  box(0.2, 0.12, TD + 0.03, vestM, 0.21, TH - 0.2, 0, B, false);
  for (let i = 0; i < 3; i++) box(0.035, 0.035, 0.02, mat(0x2a1612), 0, 0.16 + i * 0.12, TD / 2 + 0.03, B, false);
  box(TW + 0.04, 0.05, TD + 0.04, mat(0x5e2222), 0, 0.08, 0, B, false);
  // grey receding hair
  const hairM = mat(0x4a4642);
  box(0.62, 0.06, 0.34, hairM, 0, HH + 0.03, -0.12, H);
  box(0.62, 0.38, 0.08, hairM, 0, HH * 0.62, -HD / 2 - 0.03, H);
  box(0.06, 0.24, 0.42, mat(0x8c8783), HW / 2 + 0.02, HH * 0.68, -0.05, H);
  box(0.06, 0.24, 0.42, mat(0x8c8783), -HW / 2 - 0.02, HH * 0.68, -0.05, H);
  // BIG thick mustache
  const mM = mat(0x1d1714);
  const must = group(H, 0, 0.2, HD / 2 + 0.035);
  box(0.42, 0.1, 0.08, mM, 0, 0, 0, must);
  box(0.12, 0.14, 0.08, mM, 0.22, -0.05, 0, must).rotation.z = 0.3;
  box(0.12, 0.14, 0.08, mM, -0.22, -0.05, 0, must).rotation.z = -0.3;
  box(0.08, 0.07, 0.07, mM, 0.29, 0.03, 0, must);
  box(0.08, 0.07, 0.07, mM, -0.29, 0.03, 0, must);
  ch.extras.mustache = must;
  // glasses
  const gM = mat(0x111111);
  const glasses = group(H, 0, 0.32, HD / 2 + 0.03);
  for (const s of [1, -1]) {
    const cx = s * 0.13;
    box(0.2, 0.025, 0.03, gM, cx, 0.075, 0, glasses, false);
    box(0.2, 0.025, 0.03, gM, cx, -0.075, 0, glasses, false);
    box(0.025, 0.17, 0.03, gM, cx - 0.1, 0, 0, glasses, false);
    box(0.025, 0.17, 0.03, gM, cx + 0.1, 0, 0, glasses, false);
    box(0.02, 0.02, 0.3, gM, s * (HW / 2 + 0.01), 0.06, -0.15, glasses, false);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.13), new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.18 }));
    lens.position.set(cx, 0, 0.005); glasses.add(lens);
  }
  box(0.07, 0.02, 0.03, gM, 0, 0.04, 0, glasses, false);
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false }));
  glint.position.set(-0.13, 0, 0.02); glint.rotation.z = -0.6; glasses.add(glint);
  ch.extras.glint = glint; ch.extras.glasses = glasses;
  ch.onReset = () => { glint.material.opacity = 0; };
  return ch;
}

export function makeMom() {
  const green = 0x2e9e5b;
  const ch = makeHuman({
    name: 'mom', skin: 0xc48a63, shirt: green, sleeve: green, forearm: green, cuff: 0x268a4e, pants: 0xc48a63, shoes: 0x7a3b2e,
    face: { skin: 0xc48a63, eyes: 'normal', lashes: true, lips: '#b0303e', blush: 0.3 },
  });
  const B = ch.body, H = ch.head;
  // green dress: mid-calf skirt, white apron with a pocket, pearl necklace
  const skirt = group(ch.hips);
  box(0.72, 0.62, 0.44, mat(green), 0, -0.3, 0, skirt);
  box(0.74, 0.04, 0.46, mat(0x268a4e), 0, -0.6, 0, skirt, false);
  box(0.46, 0.5, 0.03, mat(0xfff8ec), 0, -0.24, 0.235, skirt, false);        // apron skirt
  box(0.2, 0.12, 0.02, mat(0xf3e3c8), 0.08, -0.2, 0.255, skirt, false);       // apron pocket
  ch.extras.skirt = skirt;
  box(0.36, 0.34, 0.03, mat(0xfff8ec), 0, 0.28, TD / 2 + 0.01, B, false);    // apron bib
  box(TW + 0.02, 0.05, TD + 0.02, mat(0xfff8ec), 0, 0.07, 0, B, false);       // apron strings
  for (let i = 0; i < 7; i++) box(0.035, 0.035, 0.035, mat(0xfdfbf2, { std: true, roughness: 0.2 }), -0.15 + i * 0.05, TH - 0.08 - Math.sin(i / 6 * Math.PI) * 0.07, TD / 2 + 0.03, B, false);
  // hair bun (grey streak) + small pearl studs
  const hairM = mat(0x2a211c);
  box(0.64, 0.12, 0.6, hairM, 0, HH + 0.04, -0.01, H);
  box(0.64, 0.07, 0.08, hairM, 0, HH - 0.01, HD / 2 + 0.01, H);
  box(0.64, 0.4, 0.08, hairM, 0, HH * 0.62, -HD / 2 - 0.03, H);
  box(0.06, 0.3, 0.46, hairM, HW / 2 + 0.02, HH * 0.7, -0.03, H);
  box(0.06, 0.3, 0.46, hairM, -HW / 2 - 0.02, HH * 0.7, -0.03, H);
  box(0.3, 0.26, 0.2, hairM, 0, HH * 0.55, -HD / 2 - 0.15, H);
  box(0.14, 0.012, 0.02, mat(0xb8b2ad), 0.12, HH + 0.105, 0.14, H, false);
  for (const s of [1, -1]) box(0.05, 0.05, 0.05, mat(0xfdfbf2, { std: true, roughness: 0.2 }), s * (HW / 2 + 0.035), 0.13, 0.02, H, false);
  return ch;
}

export function makeDog() {
  const brown = 0x9a6233, darkB = 0x5c3a1d, light = 0xd7aa78;
  const M = mat(brown), D = mat(darkB), Lm = mat(light);
  const root = new THREE.Group(); root.name = 'dog';
  const bodyP = group(root, 0, 0.36, 0);           // pivot at hips
  const body = box(0.36, 0.3, 0.62, M, 0, 0.0, 0.22, bodyP);
  box(0.37, 0.12, 0.3, Lm, 0, -0.1, 0.32, bodyP, false); // chest patch
  const legs = [];
  for (const [x, z] of [[0.11, 0.42], [-0.11, 0.42], [0.11, 0.0], [-0.11, 0.0]]) {
    const p = group(bodyP, x, -0.08, z);
    box(0.11, 0.3, 0.11, M, 0, -0.14, 0, p);
    box(0.12, 0.05, 0.14, Lm, 0, -0.29, 0.02, p, false);
    legs.push(p);
  }
  const headP = group(bodyP, 0, 0.2, 0.5);
  const head = box(0.36, 0.32, 0.32, M, 0, 0.1, 0.04, headP);
  box(0.22, 0.15, 0.18, Lm, 0, 0.02, 0.26, headP);
  const nose = box(0.09, 0.06, 0.05, mat(0x1a1a1a), 0, 0.08, 0.36, headP, false);
  for (const s of [1, -1]) {
    box(0.07, 0.07, 0.02, mat(0x111111), s * 0.09, 0.16, 0.205, headP, false);
    box(0.025, 0.025, 0.02, mat(0xffffff, { basic: true }), s * 0.09 + 0.015, 0.175, 0.212, headP, false);
    const ear = group(headP, s * 0.2, 0.24, 0.0);
    box(0.08, 0.22, 0.14, D, 0, -0.08, 0, ear);
  }
  const tongue = box(0.07, 0.03, 0.08, mat(0xff7a95), 0, -0.04, 0.32, headP, false);
  const tailP = group(bodyP, 0, 0.1, -0.08);
  box(0.06, 0.06, 0.26, D, 0, 0.05, -0.12, tailP).rotation.x = -0.6;
  const collar = box(0.38, 0.06, 0.12, mat(0xd62828), 0, 0.1, 0.48, bodyP, false);
  const dog = { name: 'dog', root, bodyP, legs, headP, tailP, nose, tongue, props: {} };
  dog.reset = () => {
    root.visible = false; root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1);
    bodyP.position.set(0, 0.36, 0); bodyP.rotation.set(0, 0, 0);
    legs.forEach((l) => l.rotation.set(0, 0, 0));
    headP.rotation.set(0, 0, 0); tailP.rotation.set(0, 0, 0); tongue.visible = true;
  };
  // sitting: rear down, front legs straight
  dog.sit = () => {
    bodyP.rotation.x = -0.75; bodyP.position.y = 0.2;
    legs[0].rotation.x = 0.75; legs[1].rotation.x = 0.75;
    legs[2].rotation.x = -0.75 + 1.4; legs[3].rotation.x = -0.75 + 1.4;
    headP.rotation.x = 0.75;
  };
  // walking upright on the back legs, front paw pinching its nose
  dog.upright = (phase) => {
    bodyP.rotation.x = -1.35; bodyP.position.y = 0.34 + Math.abs(Math.sin(phase)) * 0.02;
    legs[2].rotation.x = 1.35 + Math.sin(phase) * 0.5; legs[3].rotation.x = 1.35 - Math.sin(phase) * 0.5;
    legs[0].rotation.set(1.35 + 1.25, 0, 0.35); // paw up to the nose
    legs[1].rotation.set(1.35 + 0.2, 0, 0);
    headP.rotation.x = 1.25; tongue.visible = false;
  };
  return dog;
}
