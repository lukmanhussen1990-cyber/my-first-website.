// scenes.js — the 14 shots, timed to the original song (128 BPM, first beat at 0.35 s).
'use strict';

const SONG_LEN = 21.44;
const B0 = 0.35;
const bt = k => B0 + k * BEAT;
// cut points land on beats of the song
const CUTS = [0, bt(3), bt(6), bt(11), bt(13), bt(16), bt(19), bt(23), bt(25), bt(28), bt(31), bt(34), bt(36), bt(40), SONG_LEN];

const UL = (x0, y0, x1, y1, stops) => lg(x0, y0, x1, y1, stops, 'userSpaceOnUse');
function blinkAt(t, times, dur = 0.14) { for (const b of times) { const k = (t - b) / dur; if (k >= 0 && k <= 1) return Math.sin(k * Math.PI); } return 0; }
const dadTop = (o, hat = true) => (o.y || 0) - (hat ? 352 : 330) * (o.s || 1) + (o.bob || 0) * (o.s || 1);

/* ======================= shared pieces ======================= */
function windowFrame(x, y, w, h, sky, inner = '', col = '#e9eef5') {
  let s = R(x, y, w, h, 3, sky, 0) + G('', inner, clip(R(x, y, w, h, 3, '#000', 0)));
  s += R(x, y, w, h, 3, 'none', 0, `stroke="${col}" stroke-width="10"`) + R(x - 5, y - 5, w + 10, h + 10, 5, 'none', 2.6) + R(x + 5, y + 5, w - 10, h - 10, 2, 'none', 2);
  s += PS(`M${x + w / 2},${y + 5} L${x + w / 2},${y + h - 5} M${x + 5},${y + h / 2} L${x + w - 5},${y + h / 2}`, col, 7);
  s += R(x - 14, y + h, w + 28, 12, 3, col, 2.6);
  return s;
}
function foreArm(x0, y0, x1, y1, o = {}) { // a sleeve + forearm + hand reaching in from off-screen
  const p = PAL.dad, sc = o.sc || 1.35, len = Math.hypot(x1 - x0, y1 - y0) / sc, ang = Math.atan2(-(x1 - x0), y1 - y0) / DEG;
  const skin = o.gloves ? p.glove : p.skin, sl = o.sleeve || 'url(#plaid)';
  let g = R(-24, -40, 48, len + 30, 20, sl, 3) + R(-24, -40, 12, len + 20, 6, 'rgba(0,0,0,0.18)', 0) + R(-18, len - 70, 36, 68, 15, p.skin, 3) + R(-25, len - 88, 50, 22, 10, o.cuff || p.cuff, 3);
  if (o.holdBack) g += G(`translate(0,${n2(len)})`, o.holdBack);
  g += C(0, len, 21, skin, 3) + E((o.thumb || -1) * 15, len - 8, 9, 13, skin, 2.6) + PS(`M-10,${n2(len + 12)} Q0,${n2(len + 16)} 10,${n2(len + 11)}`, 'rgba(0,0,0,0.22)', 2);
  if (o.hold) g += G(`translate(0,${n2(len)})`, o.hold);
  return G(`translate(${n2(x0)},${n2(y0)}) rotate(${n2(ang)}) scale(${sc})`, g);
}
function priceTag(x, y, txt, rot = 0) {
  return G(T(x, y, rot, 1), PS('M0,-30 L0,-10', OUT, 1.6) + R(-30, -10, 60, 32, 4, '#ffffff', 2.4) + C(0, -4, 2.4, 'none', 1.4) + TX(0, 9, txt, 19, '#d33a3a', { weight: 900 }));
}
function clockFace(x, y, r, hh, mm) {
  const ha = ((hh % 12) + mm / 60) * 30 * DEG, ma = mm * 6 * DEG;
  let s = C(x, y, r, '#ffffff', 3) + C(x, y, r - 4, 'none', 0, 'stroke="#d9d4cc" stroke-width="2"');
  for (let i = 0; i < 12; i++) { const a = i * 30 * DEG; s += PS(`M${n2(x + Math.sin(a) * (r - 7))},${n2(y - Math.cos(a) * (r - 7))} L${n2(x + Math.sin(a) * (r - 4))},${n2(y - Math.cos(a) * (r - 4))}`, OUT, 2); }
  s += PS(`M${x},${y} L${n2(x + Math.sin(ha) * r * 0.5)},${n2(y - Math.cos(ha) * r * 0.5)}`, OUT, 3.2) + PS(`M${x},${y} L${n2(x + Math.sin(ma) * r * 0.75)},${n2(y - Math.cos(ma) * r * 0.75)}`, OUT, 2.2) + C(x, y, 2.5, OUT, 0);
  return s;
}
function burger(x, y, s = 1, rot = 0) {
  return G(T(x, y, rot, s), P('M-26,4 Q0,10 26,4 Q26,15 0,15 Q-26,15 -26,4 Z', '#d99a52', 2.4) + R(-28, -5, 56, 10, 4, '#6b3b22', 2.4) + P('M-24,-7 L24,-7 L18,1 L-20,1 Z', '#ffc93c', 0) + P('M-30,-7 Q-20,-2 -10,-7 Q0,-2 10,-7 Q20,-2 30,-7 L28,-3 L-28,-3 Z', '#7bc043', 2) + P('M-26,-7 Q-26,-32 0,-32 Q26,-32 26,-7 Z', '#e0a35a', 2.4) + C(-8, -21, 1.6, '#fff3c4', 0) + C(6, -25, 1.6, '#fff3c4', 0) + C(12, -16, 1.6, '#fff3c4', 0));
}
function subSandwich(x, y, s = 1, rot = 0) {
  return G(T(x, y, rot, s), P('M-44,0 Q-46,-10 -36,-12 L36,-12 Q46,-10 44,0 Q44,8 36,8 L-36,8 Q-44,8 -44,0 Z', '#e2a85d', 2.4) + P('M-40,-12 Q-30,-6 -20,-12 Q-10,-6 0,-12 Q10,-6 20,-12 Q30,-6 40,-12 L38,-8 L-38,-8 Z', '#7bc043', 1.8) + R(-38, -8, 76, 5, 2, '#e8564b', 0) + P('M-42,-12 Q-40,-28 -30,-28 L30,-28 Q40,-28 42,-12 Z', '#eab26a', 2.4));
}
function soda(x, y, s = 1) { return G(T(x, y, 0, s), R(-11, -30, 22, 30, 4, '#d23b3e', 2.4) + R(-11, -30, 22, 5, 2, '#c9ced6', 2) + PS('M-6,-18 Q0,-12 6,-18', '#fff', 2.4)); }
function teddy(x, y, s) {
  return G(T(x, y, 0, s), C(-22, -26, 12, '#a8713f', 3) + C(22, -26, 12, '#a8713f', 3) + C(0, 0, 32, '#b47b47', 3) + E(0, 10, 13, 10, '#e8c79a', 2.4) + E(0, 5, 5, 3.5, OUT, 0) + C(-11, -6, 3.5, OUT, 0) + C(11, -6, 3.5, OUT, 0));
}
function heart(x, y, s, col) { return P(`M${x},${y + 6 * s} C${x - 12 * s},${y - 4 * s} ${x - 6 * s},${y - 12 * s} ${x},${y - 5 * s} C${x + 6 * s},${y - 12 * s} ${x + 12 * s},${y - 4 * s} ${x},${y + 6 * s} Z`, col, 0); }
function clawHammer() { // hand-local, handle continues along the arm (+y)
  return R(-4, -10, 8, 66, 3, '#c08a55', 2.4) + P('M-20,52 L16,52 L22,58 L16,66 L-20,66 Z', '#5c6670', 2.6) + P('M-20,52 L-30,46 L-28,54 L-20,58 Z', '#5c6670', 2);
}

/* ======================= backgrounds ======================= */
function bgBedroom(t, day) {
  let s = '<rect x="-100" y="-100" width="920" height="680" fill="url(#starsWall)"/>';
  if (day) s += '<rect x="-100" y="-100" width="920" height="680" fill="#a9c0f0" opacity="0.35"/>';
  s += R(-100, 300, 920, 92, 0, day ? '#5c76ad' : '#3e5079', 0) + R(-100, 296, 920, 8, 0, '#e8e2d4', 2.4);
  const sky = day ? UL(0, 50, 0, 240, [[0, '#7cc4f5'], [1, '#d6efff']]) : UL(0, 50, 0, 240, [[0, '#0d1433'], [0.65, '#262b62'], [1, '#6e4a7c']]);
  let inner = '';
  if (day) inner += cloud(90, 110, 0.7) + cloud(170, 170, 0.5) + glow(60, 70, 90, '#fff6c9', 0.8);
  else {
    const r = rng(4);
    for (let i = 0; i < 18; i++) inner += C(40 + r() * 160, 50 + r() * 140, 0.8 + r() * 1.3, '#fff', 0, `opacity="${n2(0.55 + 0.45 * Math.sin(t * 3 + i))}"`);
    inner += C(150, 95, 18, '#fff6d6', 0) + C(158, 89, 16, '#262b62', 0) + skyline(9, 40, 200, 240, 10, 50, '#1a1d3d', '#ffd36b', { lit: 0.25 });
  }
  s += windowFrame(40, 50, 160, 190, sky, inner);
  const cur = day ? '#e8784f' : '#c45a3d';
  s += P('M22,36 Q40,140 30,252 L66,252 Q56,140 62,36 Z', cur, 3) + P('M218,36 Q200,140 210,252 L174,252 Q184,140 178,36 Z', cur, 3) + R(14, 28, 212, 12, 5, '#8a5a36', 2.6);
  s += R(244, 78, 9, 52, 3, '#8a5a36', 2.2) + P('M252,84 L370,104 L252,124 Z', '#d8463c', 2.6) + TX(298, 104, 'GO TEAM', 13, '#fff', { weight: 900, rot: 5 });
  s += G('translate(430,124) rotate(4)', R(-38, -30, 76, 60, 2, '#fffdf3', 2.2) + PS('M-24,14 L-14,-6 L-4,10 L8,-12 L22,14', '#2f6fd0', 3) + C(18, -16, 6, '#ffd23f', 0));
  s += '<rect x="-100" y="392" width="920" height="200" fill="url(#woodH)"/>' + PS('M-100,392 L820,392', OUT, 3);
  s += E(360, 452, 200, 30, day ? '#7aa7d9' : '#55709f', 3) + E(360, 452, 158, 21, 'none', 0, 'stroke="#e8e2d4" stroke-width="4" opacity="0.6"');
  return s;
}
function bedFront(cx, y, w, blanket, head, breath = 0, deco = '') {
  let s = P(`M${cx - w / 2},${y} L${cx - w / 2},${y - 92} Q${cx},${y - 136} ${cx + w / 2},${y - 92} L${cx + w / 2},${y} Z`, '#a8774d', 3);
  s += P(`M${cx - w / 2 + 14},${y - 20} L${cx - w / 2 + 14},${y - 86} Q${cx},${y - 120} ${cx + w / 2 - 14},${y - 86} L${cx + w / 2 - 14},${y - 20} Z`, '#bf8d60', 0);
  s += E(cx, y - 64, w * 0.34, 19, '#f4f1ea', 3) + head;
  const by = y - 46 + breath;
  s += P(`M${cx - w / 2 - 8},${n2(by)} Q${cx},${n2(by - 14)} ${cx + w / 2 + 8},${n2(by)} L${cx + w / 2 + 12},${y + 36} L${cx - w / 2 - 12},${y + 36} Z`, blanket, 3) + deco;
  s += P(`M${cx - w / 2 - 8},${n2(by)} Q${cx},${n2(by - 14)} ${cx + w / 2 + 8},${n2(by)} L${cx + w / 2 + 9},${n2(by + 14)} Q${cx},${n2(by)} ${cx - w / 2 - 9},${n2(by + 14)} Z`, '#f4f1ea', 2.6);
  s += R(cx - w / 2 - 16, y + 28, w + 32, 44, 6, '#94653f', 3) + R(cx - w / 2 - 8, y + 36, w + 16, 6, 3, '#b07a4c', 0);
  return s;
}
function nightstand(cx, y) {
  return R(cx - 32, y - 92, 64, 92, 4, '#94653f', 3) + R(cx - 24, y - 74, 48, 22, 3, '#a8774d', 2.4) + C(cx, y - 63, 3, '#e3c08f', 1.6) + R(cx - 24, y - 44, 48, 22, 3, '#a8774d', 2.4) + C(cx, y - 33, 3, '#e3c08f', 1.6) +
    R(cx - 25, y - 120, 50, 28, 6, '#26222e', 2.6) + TX(cx, y - 105, '5:00', 15, '#ff4a4a', { font: "'JetBrains Mono', monospace", weight: 800 });
}
function doorwayWarm(x, y, w, h) {
  return R(x, y, w, h, 0, UL(0, y, 0, y + h, [[0, '#ffdca0'], [1, '#eaa45e']]), 0) + R(x + 22, y + 40, w - 44, 56, 2, '#f2c078', 2, 'opacity="0.7"') +
    R(x - 9, y - 9, w + 18, h + 9, 2, 'none', 0, 'stroke="#efe3cf" stroke-width="14"') + R(x - 16, y - 16, w + 32, h + 16, 2, 'none', 2.6) + R(x - 2, y - 2, w + 4, h + 2, 0, 'none', 2);
}
function bgSky(mode) {
  const st = mode === 'sunrise' ? [[0, '#34478f'], [0.42, '#d9739a'], [0.75, '#ffad6b'], [1, '#ffdca3']] : mode === 'noon' ? [[0, '#54a3e8'], [1, '#d2ecff']] : [[0, '#66ace8'], [1, '#d6edfb']];
  return `<rect x="-300" y="-300" width="1320" height="1000" fill="${UL(0, -60, 0, 470, st)}"/>`;
}
function bgCityBelow(mode, shift = 0) {
  const sr = mode === 'sunrise';
  const far = sr ? '#9a6e9e' : '#aac4dd', near = sr ? '#5f4a86' : '#87a7c7';
  let s = skyline(21, -260 + shift * 0.3, 980, 470, 80, 230, far, sr ? '#ffd08e' : '#d9e8f5', { towers: true, lit: 0.45 });
  s += `<rect x="-300" y="280" width="1320" height="400" fill="${UL(0, 280, 0, 480, [[0, '#ffffff', 0], [1, sr ? '#ffb48a' : '#eef6fc', 0.55]])}"/>`;
  s += skyline(33, -260 + shift * 0.6, 980, 505, 40, 150, near, sr ? '#ffd79a' : '#c8dbee', { towers: true, lit: 0.4 });
  return s;
}
function bgKitchen(t, mode) { // 'evening' | 'night' | 'party'
  let s = '<rect x="-100" y="-100" width="920" height="560" fill="url(#stripesWall)"/>';
  for (let i = 0; i < 3; i++) s += R(20 + i * 78, 26, 74, 94, 4, '#8fb39a', 3) + R(28 + i * 78, 34, 58, 78, 3, 'none', 0, 'stroke="#7a9d85" stroke-width="2.4"') + C(80 + i * 78, 106, 3, '#e6d6b8', 1.6);
  s += R(20, 120, 232, 112, 0, 'url(#tiles)', 2.4);
  s += R(10, 232, 252, 16, 3, '#ece4d6', 3) + R(20, 248, 232, 112, 4, '#8fb39a', 3) + PS('M98,252 L98,356 M176,252 L176,356', OUT, 2.4) + C(88, 300, 3, '#e6d6b8', 1.6) + C(108, 300, 3, '#e6d6b8', 1.6) + C(186, 300, 3, '#e6d6b8', 1.6);
  s += R(40, 196, 44, 36, 6, '#3a3f4c', 2.6) + R(48, 178, 28, 20, 4, '#3a3f4c', 2.4) + E(196, 222, 34, 12, '#e8e2d4', 2.6) + C(184, 210, 10, '#e8564b', 2.2) + C(204, 208, 10, '#ffc93c', 2.2) + C(194, 200, 9, '#7bc043', 2.2);
  const night = mode !== 'party' || true;
  const sky = UL(0, 60, 0, 190, [[0, '#0f1838'], [1, '#2f3570']]);
  let inner = '';
  const r = rng(12);
  for (let i = 0; i < 10; i++) inner += C(280 + r() * 130, 60 + r() * 100, 1 + r(), '#fff', 0, 'opacity="0.8"');
  inner += skyline(17, 280, 410, 190, 10, 40, '#161a36', '#ffd36b', { lit: 0.3 });
  if (night) s += windowFrame(280, 60, 130, 130, sky, inner);
  s += P('M270,52 L420,52 L420,80 Q405,92 390,80 Q375,92 360,80 Q345,92 330,80 Q315,92 300,80 Q285,92 270,80 Z', '#d8463c', 2.6) + PS('M270,66 L420,66', '#fff', 3, 'opacity="0.7"');
  const hh = mode === 'night' ? 11 : mode === 'party' ? 7 : 8, mm = mode === 'night' ? 48 : mode === 'party' ? 15 : 30;
  s += clockFace(446, 74, 22, hh, mm);
  s += R(470, 46, 122, 314, 10, '#e9edf0', 3) + PS('M470,150 L592,150', OUT, 2.4) + R(478, 90, 8, 40, 3, '#c9ced6', 2) + R(478, 162, 8, 60, 3, '#c9ced6', 2);
  s += G('translate(522,100) rotate(-5)', R(-22, -18, 44, 36, 2, '#fffdf3', 2) + PS('M-14,8 L-6,-6 L2,6 L12,-8', '#2f6fd0', 2.4)) + C(522, 84, 4, '#e8564b', 1.6);
  s += G('translate(548,196) rotate(6)', R(-26, -22, 52, 44, 2, '#fffdf3', 2) + C(-8, -4, 7, 'none', 0, 'stroke="#e8a21c" stroke-width="2.4"') + PS('M-8,3 L-8,16 M8,2 L8,16', '#c77dff', 2.4) + heart(10, -8, 0.7, '#ff4d6d')) + C(548, 176, 4, '#2f6fd0', 1.6);
  s += G('translate(506,262) rotate(-3)', R(-20, -16, 40, 32, 2, '#fff7a8', 2) + PS('M-12,-6 L12,-6 M-12,2 L8,2 M-12,10 L4,10', '#9aa0a8', 2));
  s += R(612, 70, 100, 290, 0, mode === 'party' ? UL(0, 70, 0, 360, [[0, '#3a3550'], [1, '#232033']]) : UL(0, 70, 0, 360, [[0, '#1f2238'], [1, '#121322']]), 0);
  s += R(604, 62, 116, 298, 2, 'none', 0, 'stroke="#efe3cf" stroke-width="12"') + R(597, 55, 130, 305, 2, 'none', 2.4) + R(610, 68, 104, 292, 0, 'none', 2);
  s += '<rect x="-100" y="360" width="920" height="200" fill="url(#woodH)"/>' + PS('M-100,360 L820,360', OUT, 3);
  return s;
}
function lampPendant(x, y, lit = 1) {
  return PS(`M${x},-60 L${x},${y - 30}`, OUT, 3) + P(`M${x - 38},${y} Q${x},${y - 52} ${x + 38},${y} Z`, '#2f5d50', 3) + E(x, y + 1, 14, 5, lit ? '#fff3c4' : '#ccc', 1.6);
}
function kitchenTable(y = 372) {
  return P(`M-80,${y} L800,${y} L830,${y + 50} L-110,${y + 50} Z`, '#b9875a', 3) + PS(`M-80,${y + 17} L800,${y + 17} M-95,${y + 34} L815,${y + 34}`, '#a87648', 2) + R(-120, y + 50, 960, 30, 0, '#8e6038', 3) + R(-120, y + 80, 960, 60, 0, '#3a2a22', 0, 'opacity="0.6"');
}

/* ======================= SHOT 1 — 5:00 AM, he smiles at his sleeping kids ======================= */
function shot1(t, d) {
  const cam = { x: 372 + drift(t, 3), y: 246 + drift(t, 2, 1), z: lerp(1.0, 1.07, eio(clamp(t / d))) };
  const breath = Math.sin(t * 3.2) * 1.4;
  let s = bgBedroom(t, false);
  const bb = (x, y) => baseball(x, y, 7, 20);
  s += bedFront(222, 362, 170, '#3f6fb8', kidHeadAt('jake', 222, 292, 0.6, { expr: 'sleep', rot: -10 }), breath, bb(170, 345) + bb(232, 372) + bb(282, 340) + bb(196, 392));
  const hh = (x, y) => heart(x, y, 1, '#ffd1e1');
  s += bedFront(492, 362, 156, '#ec86ad', kidHeadAt('lily', 488, 294, 0.56, { expr: 'sleep', rot: 9 }) + teddy(534, 302, 0.55), -breath, hh(450, 350) + hh(512, 376) + hh(548, 346) + hh(470, 396));
  s += nightstand(360, 392);
  s += doorwayWarm(562, 72, 136, 320);
  const dO = { x: 630, y: 392, s: 0.86, expr: t < 0.85 ? 'soft' : 'warm', look: [-1, 0.5], armL: [7, 12], armR: [10, 8], headTilt: lerp(-2, -8, eio(clamp(t / d))), blink: blinkAt(t, [0.55]) };
  const [hx, hy] = dadHandWorld(dO, 1);
  s += G(T(hx, hy + 50, 0, 0.36), lunchPail());
  s += dad(dO);
  s += tint('#5060ae', 0.52);
  s += glow(630, 230, 280, '#ffbd6b', 0.55) + blend('screen', P('M562,392 L698,392 L560,500 L240,500 Z', UL(0, 392, 0, 500, [[0, '#ffbd6b', 0.5], [1, '#ffbd6b', 0]]), 0));
  s += glow(360, 236, 80, '#ffd36b', 0.6) + star5(360, 236, 11, '#ffe58a', 2) + glow(360, 287, 34, '#ff4a4a', 0.35);
  s += label(222, 240, 'Jake', 0.95) + label(490, 242, 'Lily', 0.95) + label(630, dadTop(dO) - 12, 'Dad');
  return camWrap(s, cam) + vignette(0.6);
}

/* ======================= SHOT 2 — taping his old boot by the door ======================= */
function shot2(t, d) {
  const cam = { x: lerp(380, 430, eio(t / d)), y: 250, z: lerp(1.0, 1.1, eio(t / d)) };
  let s = R(-100, -100, 920, 360, 0, '#2c4757', 0) + R(60, -100, 600, 340, 6, '#365a6b', 3) + R(100, -70, 240, 270, 4, '#2c4b5a', 2.4) + R(380, -70, 240, 270, 4, '#2c4b5a', 2.4);
  s += R(-100, 236, 920, 24, 0, '#e8e2d4', 2.6) + '<rect x="-100" y="260" width="920" height="300" fill="url(#tiles)"/>';
  s += P('M30,300 L690,300 L740,480 L-20,480 Z', '#c69b5e', 3) + P('M58,314 L662,314 L702,470 L18,470 Z', 'none', 0, 'stroke="#9a6f3a" stroke-width="6"') + TX(360, 400, 'HOME', 66, '#9a6f3a', { weight: 900, ls: 14, x: 'opacity="0.5"' });
  s += G(T(48, 376, 0, 0.92), sneakerSide('#d8463c')) + G(T(130, 398, 0, 0.92), sneakerSide('#d8463c'));
  s += G(T(262, 384, 0, 0.7), sneakerSide('#ff8fb5', '#fff7fb', true, t)) + G(T(318, 404, 0, 0.7), sneakerSide('#ff8fb5', '#fff7fb', true, t + 0.3));
  s += sparkles(t, 50, 300, 340, 80, 6, 3, '#ffffff', 10);
  const k = inv(t, 0.12, 1.05);
  const bx = 420, by = 446, bs = 1.12;
  s += G(T(bx, by, 0, bs), bootSide({ kind: 'old', flap: 0.3, tapeNew: eio(k) }));
  // left hand steadies the boot, right hand wraps fresh tape over the toe
  s += foreArm(560, -40, bx + 52 * bs, by - 132 * bs, { thumb: 1 });
  const ang = lerp(-50, 70, eio(k)), rip = eio(inv(t, 1.05, 1.3));
  const rx = bx + 172 * bs + Math.cos(ang * DEG) * 70 + rip * 60, ry = by - 40 * bs + Math.sin(ang * DEG) * 58 - rip * 70;
  const tx = bx + lerp(170, 168, k) * bs, ty = by + lerp(-60, -16, k) * bs;
  if (rip < 0.6) s += P(`M${n2(tx - 10)},${n2(ty)} L${n2(rx - 12)},${n2(ry + 8)} L${n2(rx + 12)},${n2(ry - 8)} L${n2(tx + 10)},${n2(ty)} Z`, '#c6cad0', 2, `opacity="${n2(1 - rip)}"`);
  s += foreArm(800, -30, rx + 10, ry - 20, { hold: G('translate(-6,18)', tapeRoll(0, 0, 0.7, ang * 2)) });
  s += tint('#7d8fc4', 0.32) + glow(110, 60, 320, '#ffcf8a', 0.45);
  return camWrap(s, cam) + vignette(0.5);
}

/* ======================= SHOT 3 — steel beam, hammer hits on the beat drop ======================= */
const HIT1 = 1.50, HIT2 = 1.97; // lands on the song's beat drop (4.66 s) and the next hit (5.13 s)
function shot3(t, d) {
  const imp = x => (t > x ? Math.exp(-(t - x) * 13) : 0);
  const sh = Math.max(imp(HIT1), imp(HIT2));
  const [sx, sy] = shake(t, 6 * sh, 34);
  const cam = { x: 360 + lerp(-24, 24, eio(t / d)) + sx, y: 236 + sy, z: lerp(1.0, 1.07, eio(t / d)) };
  let s = bgSky('day') + glow(640, 30, 230, '#fff7d0', 0.95) + glow(640, 30, 50, '#ffffff', 1);
  s += cloud(110 + t * 12, 70, 1.0, '#ffffff', 0.9) + cloud(440 + t * 7, 128, 0.7, '#ffffff', 0.85);
  s += crane(190, 520, 0.85, '#e8c35e') + bgCityBelow('day');
  s += ibeamV(70, -60, 440) + ibeamV(660, -60, 440) + ibeamH(-60, -20, 840);
  s += usFlag(96, 220, 0.85, t);
  s += ibeamH(-60, 362, 840);
  const a1 = kf(t, [[0, 46], [0.6, 46], [1.16, 170], [1.32, 172], [HIT1, 40, ei], [1.66, 150, eo], [1.78, 160], [HIT2, 40, ei], [2.12, 56, eo], [d, 64]]);
  const wipe = t < 0.42 ? [150, -88] : [lerp(150, 10, eio(inv(t, 0.42, 0.72))), lerp(-88, 18, eio(inv(t, 0.42, 0.72)))];
  const near = Math.min(Math.abs(t - HIT1), Math.abs(t - HIT2));
  const dO = { x: 330, y: 362, s: 0.82, expr: t < 0.5 ? 'tired' : near < 0.11 ? 'strain' : 'determined', armR: [a1, 4], armL: wipe, holdRBack: sledgehammer(), gloves: true, sweat: t * 1.4, bob: sh * 3 };
  s += dad(dO);
  const [hx, hy] = dadHandWorld(dO, 1), r2 = (-a1 + 4) * DEG;
  const headX = hx - Math.sin(r2) * 106 * 0.82, headY = hy + Math.cos(r2) * 106 * 0.82;
  for (const H of [HIT1, HIT2]) {
    const k = (t - H) / 0.22;
    if (k >= 0 && k <= 1) {
      let sp = '';
      for (let i = 0; i < 9; i++) { const a = (-160 + i * 17) * DEG, r0 = 10 + k * 30, r1 = r0 + 18 * (1 - k); sp += `M${n2(headX + Math.cos(a) * r0)},${n2(headY + 14 + Math.sin(a) * r0)} L${n2(headX + Math.cos(a) * r1)},${n2(headY + 14 + Math.sin(a) * r1)} `; }
      s += `<path d="${sp}" stroke="#ffe27a" stroke-width="3.2" stroke-linecap="round" opacity="${n2(1 - k)}"/>` + C(headX, headY + 14, 8 + k * 46, 'none', 0, `stroke="#fff" stroke-width="${n2(4 * (1 - k))}" opacity="${n2(0.8 * (1 - k))}"`);
    }
  }
  s += label(330, dadTop(dO) - 12, 'Dad');
  return camWrap(s, cam) + vignette(0.4);
}

/* ======================= SHOT 4 — the worn sole slips at the edge ======================= */
function shot4(t, d) {
  const slip = kf(t, [[0, 0], [0.2, 0], [0.4, 1, eo], [0.56, 1], [0.84, 0.1, eio], [d, 0.05]]);
  const step = kf(t, [[0, -60], [0.22, 0, eo], [0.56, 0], [0.84, -50, eio], [d, -54]]);
  const [sx, sy] = shake(t, t > 0.22 && t < 0.62 ? 5 : 0, 40);
  const cam = { x: 360 + sx, y: 240 + sy, z: 1.0 + t * 0.07 };
  let s = `<rect x="-100" y="-100" width="920" height="680" fill="${UL(0, 0, 0, 480, [[0, '#b9d0e3'], [1, '#7a90aa']])}"/>`;
  let city = '';
  const r = rng(77);
  for (let i = 0; i < 26; i++) { const x = 380 + r() * 420, y = 120 + r() * 360, w = 30 + r() * 50; city += R(x, y, w, w * 0.8, 2, ['#8aa0b8', '#9fb3c8', '#7b91aa'][i % 3], 0); }
  city += P('M560,-100 L640,-100 L700,600 L540,600 Z', '#8d96a3', 0) + PS('M600,-100 L620,600', '#f0e1a0', 3, 'stroke-dasharray="14 12"');
  for (let i = 0; i < 6; i++) { const y = ((i * 90 + t * 120) % 600) - 60; city += R(584 + i % 2 * 30, y, 9, 16, 2, i % 3 ? '#f2c230' : '#e8564b', 0); }
  s += G('', city, blurF(1.6));
  s += R(-100, 304, 640, 16, 0, '#de7556', 3) + R(-100, 320, 630, 100, 0, '#c4553a', 3) + R(-100, 320, 630, 14, 0, '#93402c', 0) + R(-100, 420, 640, 18, 0, '#b34c34', 3);
  for (let i = 0; i < 6; i++) s += C(-60 + i * 90, 372, 5, '#9e452f', 2) + C(-62 + i * 90, 370, 1.6, '#e98f73', 0);
  const fall = inv(t, 0.32, d);
  if (fall > 0) s += G(T(548 + fall * 40, 300 + fall * fall * 300, fall * 400, 1 - fall * 0.7), R(-9, -6, 18, 12, 3, '#6b7480', 2) + C(0, 0, 3, '#3a3f4c', 0));
  else s += G(T(548, 300, 0, 1), R(-9, -6, 18, 12, 3, '#6b7480', 2) + C(0, 0, 3, '#3a3f4c', 0));
  const bx = 300 + step, rot = slip * 17;
  s += G(`translate(${n2(bx)},304) rotate(${n2(rot)} ${n2(540 - bx)} 0)`, R(-6, -320, 102, 190, 16, '#4a6da6', 3) + R(-11, -170, 112, 24, 7, '#6a8cc4', 3) + bootSide({ kind: 'old', flap: 0.25 + slip * 0.75 }));
  if (slip > 0.3) s += PS('M520,250 q12,-6 24,0 M512,232 q16,-8 32,0', '#ffffff', 3, `opacity="${n2(slip)}"`);
  return camWrap(s, cam) + vignette(0.55);
}

/* ======================= SHOT 5 — lunch on the beam: burgers vs one slice of bread ======================= */
function shot5(t, d) {
  const cam = { x: lerp(360, 372, eio(t / d)), y: lerp(240, 218, eio(t / d)), z: lerp(1.0, 1.16, eio(t / d)) };
  let s = bgSky('noon') + glow(360, -60, 280, '#fff7d0', 0.8) + cloud(150 + t * 8, 60, 0.9) + cloud(560 + t * 5, 96, 0.6);
  s += bgCityBelow('day', 40) + ibeamV(-10, -60, 400) + ibeamV(730, -60, 400);
  s += ibeamH(-60, 318, 840);
  const ch = Math.abs(Math.sin(t * 9));
  const c1 = { x: 128, y: 318, s: 0.7, legs: 'sit', pal: PAL.co1, expr: 'chew', mouthOpen: ch, armR: [16, 132 + Math.sin(t * 9) * 5], armL: [8, 64], swing: Math.sin(t * 3) * 8 };
  const [b1x, b1y] = dadHandWorld(c1, 1);
  c1.extra = '';
  s += dad(c1) + burger(b1x - 6, b1y - 12, 1.1, -10);
  const c2 = { x: 600, y: 318, s: 0.7, legs: 'sit', pal: PAL.co2, expr: 'chew', mouthOpen: Math.abs(Math.sin(t * 8 + 1)), armL: [16, 126 + Math.sin(t * 8) * 5], armR: [10, 58], swing: Math.sin(t * 2.6 + 1) * 8 };
  const [s2x, s2y] = dadHandWorld(c2, -1);
  s += dad(c2) + subSandwich(s2x + 18, s2y - 8, 0.9, 12) + soda(660, 316, 1);
  const lift = eio(inv(t, 0.12, 0.62));
  const dO = { x: 370, y: 318, s: 0.78, legs: 'sit', expr: t < 0.8 ? 'tired' : 'sad', look: [0.5, 0.7], blink: blinkAt(t, [0.95]), armR: [lerp(8, 26, lift), lerp(70, 128, lift)], armL: [10, 66], swing: Math.sin(t * 2.2) * 5 };
  dO.mid = G(T(0, 30, 0, 0.82), lunchPail({ open: true }));
  const [hx, hy] = dadHandWorld(dO, 1);
  s += dad(dO) + bread(hx - 4, hy - 26, 0.62, -8);
  s += label(370, dadTop(dO) + 96 * 0.78 - 12, 'Dad');
  return camWrap(s, cam) + vignette(0.42);
}

/* ======================= SHOT 6 — POV: the kids' drawing taped in his lunch pail ======================= */
function shot6(t, d) {
  const cam = { x: 360, y: lerp(254, 230, eio(t / d)), z: lerp(1.0, 1.13, eio(t / d)) };
  let s = bgSky('noon') + G('', bgCityBelow('day', 80), blurF(3));
  s += P('M-100,330 L820,330 L820,600 L-100,600 Z', '#4a6da6', 3) + P('M-100,330 Q120,300 360,320 Q600,300 820,330', 'none', 0, 'stroke="#3a5688" stroke-width="10"');
  s += G(T(360, 474, 0, 1.08), lunchPailOpenPOV({ t }));
  const glowK = eio(inv(t, 0.3, 1.1));
  s += glow(360, 245, 190, '#ffd58a', 0.3 + 0.3 * glowK) + sparkles(t, 250, 170, 230, 140, 6, 11, '#fff6cf', 9);
  const reach = eio(inv(t, 0.35, 0.95));
  s += foreArm(-60, 600, lerp(150, 262, reach), lerp(520, 290, reach), { thumb: 1 });
  s += foreArm(820, 600, 610, 436, { hold: bread(-4, -24, 0.75, 20, true) });
  return camWrap(s, cam) + vignette(0.55);
}

/* ======================= SHOT 7 — the store window: boots $99 or glove $89 ======================= */
function shot7(t, d) {
  const cam = { x: 360, y: lerp(248, 236, eio(t / d)), z: lerp(1.0, 1.09, eio(t / d)) };
  let s = `<rect x="-200" y="-200" width="1120" height="900" fill="${UL(0, -80, 0, 420, [[0, '#2c3166'], [0.6, '#a5577a'], [1, '#f0936a']])}"/>`;
  s += R(-100, -40, 920, 450, 0, 'url(#brick)', 0) + R(-100, -40, 920, 450, 0, '#3a1f3a', 0, 'opacity="0.35"');
  s += R(110, 12, 500, 60, 6, '#1f3b33', 3) + TX(360, 43, 'HOMETOWN SPORTS', 30, '#ffe39a', { weight: 900, ls: 2 });
  for (let i = 0; i < 12; i++) s += C(126 + i * 42, 20, 3, i % 2 === Math.floor(t * 6) % 2 ? '#fff3b0' : '#e0b85a', 0);
  const win = UL(0, 96, 0, 370, [[0, '#ffe7b8'], [1, '#f2b46e']]);
  let inner = R(110, 96, 500, 274, 0, win, 0);
  for (let row = 0; row < 2; row++) {
    inner += R(110, 150 + row * 62, 500, 8, 0, '#c99a62', 0);
    for (let i = 0; i < 9; i++) { const x = 140 + i * 52, y = 140 + row * 62; inner += i % 3 === 0 ? C(x, y, 11, ['#e8564b', '#2f6fd0', '#f2c230'][(i + row) % 3], 2) : i % 3 === 1 ? R(x - 4, y - 30, 8, 38, 3, '#c08a55', 2) : R(x - 13, y - 12, 26, 20, 8, ['#2f6fd0', '#e8564b'][row], 2); }
  }
  inner += R(160, 300, 140, 70, 4, '#f4ece0', 3) + G('translate(178,300) scale(0.5)', bootSide({ kind: 'new' })) + priceTag(296, 262, '$99', 8);
  inner += R(420, 300, 140, 70, 4, '#f4ece0', 3) + glove(482, 262, 0.92, -10) + baseball(528, 292, 9) + priceTag(560, 252, '$89', -8);
  inner += sparkles(t, 160, 240, 400, 60, 5, 21, '#ffffff', 8);
  inner += blend('screen', P('M150,96 L210,96 L120,370 L60,370 Z', '#ffffff', 0, 'opacity="0.12"') + P('M470,96 L500,96 L420,370 L390,370 Z', '#ffffff', 0, 'opacity="0.1"'));
  s += G('', inner, clip(R(110, 96, 500, 274, 0, '#000', 0)));
  s += R(104, 90, 512, 286, 4, 'none', 0, 'stroke="#1f3b33" stroke-width="12"') + R(97, 83, 526, 300, 6, 'none', 2.6) + PS('M360,96 L360,370', '#1f3b33', 8);
  s += R(-100, 384, 920, 140, 0, '#8d8a96', 0) + PS('M-100,384 L820,384', OUT, 3) + PS('M-100,440 L820,440', '#76737f', 3) + hydrant(668, 470, 0.9);
  s += glow(360, 240, 330, '#ffc27a', 0.35);
  const look = kf(t, [[0, -1], [0.45, -1], [0.75, 1], [1.2, 1], [1.45, 0.4]]);
  const dO = { x: 360, y: 476, s: 0.9, facing: 'back', headX: look * 7, headTilt: look * 4, armL: [6, 8], armR: [10, 20] };
  const [hx, hy] = dadHandWorld(dO, 1);
  s += dad(dO) + bill(hx + 10, hy + 6, 0.55, 70) + bill(hx + 16, hy + 2, 0.55, 82);
  s += label(360, dadTop(dO) - 12, 'Dad');
  return camWrap(s, cam) + vignette(0.5);
}

/* ======================= SHOT 8 — rain walk home: water soaks through the hole ======================= */
function shot8(t, d) {
  const cam = { x: 360 + t * 26, y: 240, z: 1.02 };
  let s = `<rect x="-100" y="-100" width="920" height="680" fill="${UL(0, 0, 0, 480, [[0, '#121a33'], [1, '#2a3558']])}"/>`;
  s += bokeh(t, 16, 5, ['#ffcf7a', '#7ab8ff', '#ff8a7a'], 0.35, 12, 34);
  s += R(-100, 330, 920, 300, 0, '#262d42', 0) + PS('M-100,330 L820,330', '#3a4460', 3);
  for (let i = 0; i < 7; i++) s += blend('screen', R(40 + i * 110, 334, 14, 150, 4, ['#ffcf7a', '#7ab8ff'][i % 2], 0, 'opacity="0.12"'));
  s += E(430, 432, 200, 28, '#1b2a4a', 0) + blend('screen', E(470, 432, 70, 10, '#ffcf7a', 0, 'opacity="0.35"'));
  const r = rng(3);
  for (let i = 0; i < 7; i++) { const ph = (t * 1.6 + r()) % 1, x = 260 + r() * 340; s += E(x, 432 + (r() - 0.5) * 30, 6 + ph * 30, 1.5 + ph * 5, 'none', 0, `stroke="#9fc3ff" stroke-width="1.6" opacity="${n2((1 - ph) * 0.7)}"`); }
  const land = 0.36, sw = inv(t, 0, land);
  const fx = lerp(160, 380, eio(sw)), fy = 436 - Math.sin(sw * Math.PI) * 40 * (t < land ? 1 : 0);
  const wet = eio(inv(t, land, d));
  s += G(T(140, 436, 0, 0.9), R(-6, -330, 102, 190, 16, '#3e5a8a', 3) + R(-11, -176, 112, 24, 7, '#57739e', 3) + bootSide({ kind: 'old', flap: 0.3 }));
  s += G(T(fx, fy, t < land ? -8 * Math.sin(sw * Math.PI) : 0, 0.9), R(-6, -330, 102, 190, 16, '#4a6da6', 3) + R(-11, -176, 112, 24, 7, '#6a8cc4', 3) + bootSide({ kind: 'old', flap: 0.3 + 0.5 * wet, wet }));
  const sk = inv(t, land, land + 0.4);
  if (sk > 0 && sk < 1) {
    let sp = '';
    for (let i = 0; i < 12; i++) { const a = (-170 + i * 14) * DEG, rr = 20 + sk * 80; sp += C(fx + 120 + Math.cos(a) * rr * 1.4, 430 + Math.sin(a) * rr * 0.9 + sk * sk * 40, 4 * (1 - sk) + 1.5, '#a9c9ff', 0); }
    s += op(1 - sk, sp) + E(fx + 120, 434, 40 + sk * 90, 6 + sk * 10, 'none', 0, `stroke="#cfe0ff" stroke-width="3" opacity="${n2(1 - sk)}"`);
  }
  s += G(T(560, -20, Math.sin(t * 7) * 8, 1), PS('M0,-100 L0,60', OUT, 0) + foreArm(0, -110, 0, 40, { hold: G('translate(0,6)', giftBag(0, 92, 0.9, 0)) }));
  s += tint('#3b4a8c', 0.35) + rain(t, { n: 150, ang: 10, speed: 1150, col: '#cfe0ff', op: 0.5, len: 28 }) + glow(620, -20, 260, '#ffcf7a', 0.35);
  return camWrap(s, cam) + vignette(0.6);
}

/* ======================= SHOT 9 — the glove: pure joy ======================= */
function shot9(t, d) {
  const cam = { x: 392, y: 250, z: lerp(1.03, 1.1, eio(t / d)) };
  let s = bgKitchen(t, 'evening') + lampPendant(330, 118);
  const hop = Math.abs(Math.sin(inv(t, 0.15, 1.1) * Math.PI * 2)) * 10;
  const jO = { who: 'jake', outfit: 'pj', x: 420, y: 470, s: 1.05, bob: -hop, expr: t < 0.2 ? 'wow' : 'happy', armR: [158, 8], armL: [150, 22] };
  const [gx, gy] = kidHandWorld(jO, 1);
  const rub = Math.sin(t * 16) * 4;
  const dO = { x: 282, y: 470, s: 0.84, hat: false, expr: 'warm', armR: [108 + rub, 4], armL: [8, 12], headTilt: 6 };
  s += dad(dO);
  s += giftBag(512, 470, 0.8, 18, false);
  s += kid(jO) + glove(gx + 4, gy - 30, 0.75, 10) + sparkles(t, gx - 60, gy - 110, 120, 110, 7, 41, '#fff3b0', 11);
  const cl = Math.abs(Math.sin(t * 14));
  s += kid({ who: 'lily', outfit: 'pj', x: 560, y: 470, s: 0.9, expr: 'happy', armL: [28 + cl * 8, 104 + cl * 22], armR: [28 + cl * 8, 104 + cl * 22], bob: -Math.abs(Math.sin(t * 7)) * 4 });
  s += tint('#8a6a9a', 0.22) + glow(330, 150, 260, '#ffc977', 0.45) + glow(420, 300, 200, '#ffd99a', 0.2);
  s += label(282, dadTop(dO, false) - 12, 'Dad') + label(420, 470 - 205 * 1.05 - hop, 'Jake', 0.95) + label(560, 470 - 205 * 0.9, 'Lily', 0.9);
  return camWrap(s, cam) + vignette(0.5);
}

/* ======================= SHOT 10 — Little League catch, whip-pan to Dad cheering ======================= */
function shot10(t, d) {
  const pan = eio(inv(t, 0.6, 0.86)), vel = Math.sin(inv(t, 0.6, 0.86) * Math.PI);
  const cam = { x: lerp(360, 1080, pan), y: 240, z: 1.0 };
  let s = `<rect x="-200" y="-200" width="1840" height="900" fill="${UL(0, -60, 0, 320, [[0, '#f6a35a'], [0.6, '#ffd18c'], [1, '#ffe7b3']])}"/>`;
  s += glow(720, 150, 360, '#fff2c4', 0.85) + C(720, 170, 46, '#fff4d1', 0, 'opacity="0.9"');
  s += skyline(8, -200, 1640, 270, 20, 70, '#c98a6a', null) + P('M-200,262 Q300,230 700,256 Q1100,230 1640,260 L1640,300 L-200,300 Z', '#5f8a4f', 0);
  s += R(-200, 238, 1000, 52, 0, '#2e6b3f', 3) + R(-200, 232, 1000, 9, 0, '#f2c230', 2.4) + TX(160, 266, '310', 24, '#ffffff', { weight: 900 }) + TX(560, 266, 'GO TIGERS', 22, '#ffffff', { weight: 900, ls: 2 });
  s += R(470, 104, 170, 96, 6, '#20323a', 3) + TX(555, 126, 'HOME   GUEST', 13, '#ffe39a', { weight: 800 }) + TX(512, 164, '3', 34, '#ff7a5a', { weight: 900, font: "'JetBrains Mono', monospace" }) + TX(598, 164, '2', 34, '#ff7a5a', { weight: 900, font: "'JetBrains Mono', monospace" }) + R(548, 200, 14, 40, 0, '#20323a', 2.4);
  for (let i = 0; i < 8; i++) s += R(-200, 290 + i * 26, 1000, 26, 0, i % 2 ? '#6bab4f' : '#79b85a', 0);
  // Jake catches the fly ball
  const catchT = 0.52, after = t > catchT;
  const jO = { who: 'jake', outfit: 'uniform', cap: true, x: 360, y: 452, s: 1.18, expr: after ? 'happy' : 'wow', look: [-0.6, -1], armL: after ? [160, 10] : [150, 30], armR: after ? [150, 10] : [24, 20], bob: after ? -Math.abs(Math.sin((t - catchT) * 12)) * 12 : 0 };
  const [gx, gy] = kidHandWorld(jO, -1);
  s += kid(jO) + glove(gx - 2, gy - 34, 0.72, -14);
  const bk = inv(t, 0, catchT);
  if (!after) s += baseball(lerp(-40, gx - 2, bk), lerp(-20, gy - 40, bk) - Math.sin(bk * Math.PI) * 140, 8, t * 900);
  else s += baseball(gx - 4, gy - 40, 8);
  // bleachers and Dad
  s += R(720, 230, 920, 280, 0, '#7b8088', 0);
  for (let row = 0; row < 4; row++) {
    const y = 300 + row * 52;
    for (let i = 0; i < 9; i++) { const x = 760 + i * 92 + (row % 2) * 40; if (Math.abs(x - 1080) < 70 && row === 2) continue; s += crowdPerson(x, y + 4, 0.55, ['#8f6fae', '#7a5f9c', '#a283c0'][(i + row) % 3], t, i + row, t > 0.85 ? 1 : 0.2); }
    s += R(720, y, 920, 14, 3, '#c9ced6', 2.4) + R(720, y + 14, 920, 8, 0, '#8d939c', 0);
  }
  const cheer = t > 0.82;
  const dO = { x: 1080, y: 470, s: 0.84, expr: cheer ? 'cheer' : 'shock', armL: cheer ? [162, 14] : [20, 40], armR: cheer ? [162, 14] : [20, 40], bob: cheer ? -Math.abs(Math.sin((t - 0.82) * 11)) * 16 : 0, gloves: false };
  s += dad(dO);
  s += R(720, 456, 920, 14, 3, '#c9ced6', 2.4);
  s += label(360, 452 - 232 * 1.18, 'Jake') + label(1080, dadTop(dO) - 12, 'Dad');
  s += glow(720, 160, 600, '#ffcf8a', 0.25);
  const scene = vel > 0.05 ? G('', s, blurF(n2(18 * vel), 0)) : s;
  return camWrap(scene, cam) + vignette(0.4);
}

/* ======================= SHOT 11 — midnight: the kids see him taping the boot again ======================= */
function shot11(t, d) {
  const cam = { x: lerp(330, 486, eio(t / d)), y: lerp(250, 236, eio(t / d)), z: lerp(1.0, 1.22, eio(t / d)) };
  let s = bgKitchen(t, 'night');
  // the kids peek around the doorframe
  const turn = t > 0.85 ? 1 : 0, nod = t > 1.05 ? Math.sin((t - 1.05) * 18) * 4 * (t < 1.3 ? 1 : 0) : 0;
  let kids = kidHeadAt('lily', 640, 300 + nod, 0.62, { expr: 'worried', look: turn ? [0.2, -1] : [-1, 0.2] }) + kidHeadAt('jake', 654, 236 + nod, 0.66, { expr: turn ? 'determined' : 'worried', look: turn ? [0.2, 1] : [-1, 0.3], face: turn ? {} : { wet: true } });
  kids += C(616, 318, 9, PAL.lily.skin, 2.6) + C(618, 262, 10, PAL.jake.skin, 2.6);
  s += G('', kids, clip(R(612, 60, 110, 300, 0, '#000', 0)));
  s += R(604, 62, 12, 298, 0, '#efe3cf', 2.4) + C(617, 318, 9, PAL.lily.skin, 2.6) + C(619, 262, 10, PAL.jake.skin, 2.6);
  s += lampPendant(300, 150) + ray(300, 150, 120, 480, 470, '#ffd58a', 0.28);
  const rub = t > 0.45 && t < 1.15;
  const dO = { x: 300, y: 474, s: 0.86, legs: 'none', hat: false, vest: false, expr: rub ? 'sad' : 'tired', blink: rub ? 0.9 : blinkAt(t, [0.25]), armL: rub ? [150, -92] : [24, 76], armR: [26, 86] };
  const [hx, hy] = dadHandWorld(dO, 1);
  s += dad(dO);
  s += kitchenTable(392);
  s += G(T(150, 432, -6, 0.62), bootSide({ kind: 'old', flap: 0.35 })) + tapeRoll(hx + 4, Math.min(hy, 410), 0.8, t * 60) + R(380, 404, 80, 10, 4, '#f4b223', 2.4);
  s += C(560, 418, 12, '#e8e2d4', 2.4) + R(554, 390, 14, 26, 4, '#e8e2d4', 2.4);
  s += tint('#26306a', 0.5) + glow(300, 330, 210, '#ffc77a', 0.3);
  s += label(300, 474 - 330 * 0.86 - 12, 'Dad') + label(650, 190, 'Jake', 0.85) + label(642, 262, 'Lily', 0.8);
  return camWrap(s, cam) + vignette(0.65);
}

/* ======================= SHOT 12 — they break the piggy bank (on the beat) ======================= */
const SMASH = 0.47;
function shot12(t, d) {
  const imp = t > SMASH ? Math.exp(-(t - SMASH) * 10) : 0;
  const [sx, sy] = shake(t, 7 * imp, 40);
  const cam = { x: 380 + sx, y: 260 + sy, z: lerp(1.08, 1.16, eio(t / d)) };
  let s = bgBedroom(t, true);
  s += bedFront(222, 362, 170, '#3f6fb8', '', 0, '') + bedFront(492, 362, 156, '#ec86ad', teddy(530, 300, 0.55), 0, '');
  const a1 = kf(t, [[0, 172], [0.3, 176], [SMASH, 84, ei], [d, 90]]);
  const jO = { who: 'jake', outfit: 'tee', x: 210, y: 470, s: 1.15, expr: 'determined', armR: [a1, 0], armL: [12, 16], holdRBack: clawHammer() };
  const pigX = 362, pigY = 444;
  if (t < SMASH) s += piggyBank(pigX, pigY, 0.9 + Math.sin(t * 40) * 0.01);
  s += kid(jO);
  s += kid({ who: 'lily', outfit: 'dress', x: 520, y: 470, s: 1.02, expr: t < SMASH + 0.05 ? 'squeeze' : 'wow', armL: [150, -30], armR: [150, -30] });
  if (t >= SMASH) {
    const k = t - SMASH, r = rng(9);
    let fx = '';
    for (let i = 0; i < 8; i++) { const a = (-170 + r() * 160) * DEG, v = 220 + r() * 180; fx += shard(pigX + Math.cos(a) * v * k, pigY - 40 + Math.sin(a) * v * k + 500 * k * k, 0.9, k * 600 * (r() - 0.5), 100 + i); }
    for (let i = 0; i < 26; i++) {
      const a = (-175 + r() * 170) * DEG, v = 180 + r() * 260, vy = Math.sin(a) * v;
      let y = pigY - 40 + vy * k + 700 * k * k; const floor = 446 + r() * 20;
      if (y > floor) y = floor - Math.abs(Math.sin(k * 14 + i)) * 12 * Math.exp(-k * 4);
      fx += coin(pigX + Math.cos(a) * v * k * 1.1, y, 8, Math.cos(k * 22 + i), i % 4 ? '#f5c542' : '#d9dde2');
    }
    s += fx + op(clamp(1 - k * 3), C(pigX, pigY - 40, 30 + k * 300, 'none', 0, 'stroke="#fff" stroke-width="8"'));
  }
  s += glow(100, 80, 300, '#fff1c4', 0.4);
  s += label(210, 470 - 232 * 1.15, 'Jake') + label(520, 470 - 225 * 1.02, 'Lily');
  return camWrap(s, cam) + vignette(0.4);
}

/* ======================= SHOT 13 — birthday: new boots, happy tears ======================= */
function shot13(t, d) {
  const cam = { x: 360, y: lerp(244, 206, eio(inv(t, 0.3, d))), z: lerp(1.0, 1.34, eio(inv(t, 0.3, d))) };
  let s = bgKitchen(t, 'party') + lampPendant(360, 112);
  const bnr = 'HAPPY BIRTHDAY DAD!', cols = ['#e63946', '#2f6fd0', '#f4a01c', '#2a9d5c', '#c77dff'];
  s += P('M20,22 Q360,52 700,22 L700,62 Q360,92 20,62 Z', '#fffdf3', 2.4);
  for (let i = 0; i < bnr.length; i++) { const x = 60 + i * 33.5, y = 46 + Math.sin((i / (bnr.length - 1)) * Math.PI) * 14; s += `<text x="${n2(x)}" y="${n2(y)}" font-family="${HAND}" font-size="30" fill="${cols[i % 5]}" text-anchor="middle" dominant-baseline="central">${bnr[i]}</text>`; }
  for (const [x, y, c] of [[40, 150, '#e63946'], [76, 120, '#f4f1ea'], [110, 160, '#2f6fd0'], [640, 150, '#2f6fd0'], [676, 118, '#e63946'], [700, 170, '#f4f1ea']]) { const b = Math.sin(t * 2 + x) * 4; s += PS(`M${x},${y + 34 + b} Q${x - 6},${y + 90} ${x + 4},${y + 150}`, OUT, 1.6) + E(x, y + b, 24, 30, c, 3) + E(x - 8, y - 10 + b, 6, 9, '#fff', 0, 'opacity="0.6"'); }
  const open = eio(inv(t, 0.08, 0.5));
  const phase = t < 0.45 ? 0 : t < 0.95 ? 1 : 2;
  const dO = { x: 360, y: 476, s: 0.86, legs: 'none', hat: false, vest: false, expr: ['soft', 'shock', 'teary'][phase], blink: blinkAt(t, [0.3]), armL: phase === 2 ? [lerp(24, -82, eio(inv(t, 0.95, 1.2))), lerp(70, 95, eio(inv(t, 0.95, 1.2)))] : [24, 70], armR: [24, 70], headTilt: phase === 2 ? -4 : 0 };
  s += kid({ who: 'jake', outfit: 'tee', x: 150, y: 470, s: 1.05, expr: phase ? 'happy' : 'big', look: [1, 0], armL: [10, 12], armR: [60, 60] });
  s += kid({ who: 'lily', outfit: 'dress', x: 600, y: 470, s: 0.95, expr: phase ? 'happy' : 'big', look: [-1, 0], armL: [30, 110], armR: [30, 110] });
  s += dad(dO);
  s += kitchenTable(392);
  s += G(T(360, 420, 0, 0.88), shoeBox(0, 0, 1, open));
  if (open > 0.3) s += op(1 - inv(t, 0.9, 1.4) * 0.8, blend('screen', `<path d="M300,370 L420,370 L500,200 L220,200 Z" fill="${UL(0, 370, 0, 200, [[0, '#fff3c4', 0.5], [1, '#fff3c4', 0]])}"/>`)) + sparkles(t, 270, 280, 190, 90, 8, 61, '#ffffff', 12);
  s += cake(586, 420, 0.5, t, 1) + glow(586, 360, 90, '#ffc35a', 0.5);
  s += tint('#7a5a8a', 0.12) + glow(360, 260, 300, '#ffcf8a', 0.18);
  if (phase === 2) s += sparkles(t, 300, 150, 120, 60, 3, 71, '#cfefff', 7);
  s += label(360, 476 - 330 * 0.86 - 10, 'Dad') + label(150, 470 - 205 * 1.05, 'Jake', 0.95) + label(600, 470 - 205 * 0.95, 'Lily', 0.9);
  return camWrap(s, cam) + vignette(0.45);
}

/* ======================= SHOT 14 — sunrise: new boots planted on the beam ======================= */
function shot14(t, d) {
  const k = eio(inv(t, 0.0, 1.35));
  const cam = { x: 360, y: lerp(366, 236, k), z: lerp(2.4, 1.0, k) };
  let s = bgSky('sunrise') + glow(520, 330, 300, '#ffd9a0', 0.9) + C(520, 336, 46, '#fff0c9', 0, 'opacity="0.95"');
  s += blend('screen', `<path d="M520,336 L-100,-100 L120,-100 Z M520,336 L360,-100 L560,-100 Z M520,336 L820,-60 L820,120 Z" fill="${UL(0, 336, 0, -100, [[0, '#fff3c4', 0.35], [1, '#fff3c4', 0]])}"/>`);
  s += cloud(160, 110, 1.0, '#ffc1a6', 0.8) + cloud(620, 70, 0.8, '#ffb3b8', 0.7);
  s += bgCityBelow('sunrise');
  s += ibeamV(110, -60, 450) + usFlag(136, 260, 0.9, t) + ibeamH(-60, 380, 840);
  const dO = { x: 360, y: 380, s: 0.9, boots: 'new', hatDrawing: true, expr: t < 1.1 ? 'smile' : 'warm', look: [1, -0.3], armL: [8, 12], armR: [10, 14], headTilt: lerp(0, 4, k) };
  s += dad(dO);
  s += sparkles(t, 300, 340, 120, 40, 5, 81, '#ffffff', 10);
  s += glow(520, 330, 160, '#ffe7b0', 0.35) + tint('#ffb27a', 0.12, 'soft-light');
  s += label(360, dadTop(dO) - 12, 'Dad', 1, clamp((t - 1.2) / 0.3));
  return camWrap(s, cam) + vignette(0.5);
}

const SHOT_FNS = [shot1, shot2, shot3, shot4, shot5, shot6, shot7, shot8, shot9, shot10, shot11, shot12, shot13, shot14];
const SHOTS = SHOT_FNS.map((f, i) => ({ name: f.name, dur: CUTS[i + 1] - CUTS[i], draw: f }));
const FLASHES = [
  { t: CUTS[2] + HIT1, dur: 0.16, o: 0.45 },   // beat drop: first hammer hit
  { t: CUTS[11] + SMASH, dur: 0.32, o: 0.9 },  // piggy bank smash
];
