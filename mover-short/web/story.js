import * as THREE from 'three';
import { Char, POSES, pose, mix, add, walk, run } from './char.js';
import * as PR from './props.js';
import { clamp, lerp, seg, smooth, easeInOut, easeOut, easeIn, easeOutBack, bounceOut, rnd, camKeys, mat, box, cyl, grp, mesh, starShape } from './lib.js';

/* Voice phrase table (s):
 0.00 You had no money, not even one dollar. | 3.44 So when your friend said, | 4.82 help me move my couch, I'll give you 20 bucks,
 7.28 you said yes. | 8.64 But the couch got stuck on the stairs, | 10.54 so you pushed and pushed until it came loose | 13.62 and fell right on you.
 15.42 But his neighbor saw it and paid you 50 bucks | 17.40 to move her stuff too. | 19.04 But then the whole building wanted help,
 20.92 so you called two friends and shared the money. | 23.54 But carrying everything with your hands hurt your back, | 26.24 so you bought a cart with wheels.
 28.04 But one day, a piano slipped | 29.76 and rolled all the way down the hill. | 31.86 So you paid for it, then got insurance.
 34.52 But your car was too small, so you rented a big truck. | 37.84 But after paying for gas and your friends, | 40.10 you still had no money.
 41.90 So you raised your price and nobody said no. | 44.80 But then a lady asked for your business card | 46.54 and you didn't have one.
 48.24 So you made it real. | 49.68 You registered your business, | 51.18 put your name on the truck and printed business cards.
 54.02 Congrats, you're not broke anymore. | 55.74 You just started a moving company. (ends 57.72) */

export const TOTAL = 1800;
const PI = Math.PI, HP = PI / 2;
let ctx, OFF, S, F = 0;
const C = {}, P = {};

// ---------------- helpers ----------------
const V = (set, x, y, z) => new THREE.Vector3(OFF[set].x + x, OFF[set].y + y, OFF[set].z + z);
function put(obj, set, x, y, z, ry = 0, rx = 0, rz = 0, s = 1) {
  obj.visible = true; obj.position.set(OFF[set].x + x, OFF[set].y + y, OFF[set].z + z); obj.rotation.set(rx, ry, rz);
  if (typeof s === 'number') obj.scale.setScalar(s); else obj.scale.set(...s); return obj;
}
function putW(obj, v, rx = 0, ry = 0, rz = 0, s = 1) { obj.visible = true; obj.position.copy(v); obj.rotation.set(rx, ry, rz); if (typeof s === 'number') obj.scale.setScalar(s); else obj.scale.set(...s); return obj; }
function attach(obj, parent, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) { parent.add(obj); obj.visible = true; obj.position.set(x, y, z); obj.rotation.set(rx, ry, rz); obj.scale.setScalar(s); return obj; }
function ch(c, set, x, y, z, ry, p, face = {}) { c.set(OFF[set].x + x, OFF[set].y + y, OFF[set].z + z, ry, p, face, F); c.root.updateMatrixWorld(true); return c; }
function handPt(c, side, off = [0, -0.08, 0.02]) { c.root.updateMatrixWorld(true); return c.hand(side).localToWorld(new THREE.Vector3(...off)); }
function headPt(c, up = 0.45) { c.root.updateMatrixWorld(true); return c.head.localToWorld(new THREE.Vector3(0, up, 0)); }
function seqPose(t, keys, tr = 0.14) {
  let i = 0; while (i + 1 < keys.length && t >= keys[i + 1][0]) i++;
  if (i === 0 || t - keys[i][0] >= tr) return { ...keys[i][1] };
  return mix(keys[i - 1][1], keys[i][1], smooth(clamp((t - keys[i][0]) / tr)));
}
const talkAmt = (t, a, b) => (t >= a && t <= b ? 0.15 + 0.85 * Math.abs(Math.sin((t - a) * 20.5)) * (0.6 + 0.4 * Math.sin(t * 7.3)) : -1);
function talk(t, spans, base = {}) { for (const [a, b] of spans) { const o = talkAmt(t, a, b); if (o >= 0) return { ...base, mouth: 'open', open: o }; } return base; }
function shake(t, t0, amp = 0.1, dur = 0.45) { const u = t - t0; if (u < 0 || u > dur) return [0, 0, 0]; const k = amp * Math.pow(1 - u / dur, 2); return [Math.sin(u * 71) * k, Math.sin(u * 89 + 1.3) * k, Math.sin(u * 53 + 2.1) * k * 0.5]; }
function cam(set, p, l, fov = 42, sh = [0, 0, 0], roll = 0) { ctx.cam(set, [p[0] + sh[0], p[1] + sh[1], p[2] + sh[2]], [l[0] + sh[0], l[1] + sh[1], l[2] + sh[2]], fov, roll); }
function camK(set, keys, t, sh, ease = easeInOut) { const k = camKeys(keys, t, ease); cam(set, k[1], k[2], k[3], sh); }
function pop(text, t0, at, o = {}) {
  if (at.isVector3) { ctx.dyn.push({ text, t: t0, anchor: at.clone(), ...o }); return; }
  ctx.dyn.push({ text, t: t0, x: clamp(at[0], 170, 910), y: clamp(at[1] + (o.dy ?? 0), 180, 1500), ...o });
}
function fly(obj, p0, p1, t, t0, t1, arc = 0.5, spin = [0, 0, 0], s = 1) {
  const u = clamp((t - t0) / (t1 - t0));
  const v = new THREE.Vector3().lerpVectors(p0, p1, u); v.y += Math.sin(PI * u) * arc;
  putW(obj, v, spin[0] * u, spin[1] * u, spin[2] * u, s); return u;
}
function walkPh(dist, stride = 0.62) { return dist / stride * PI; }
function hideExtras() { C.hero.band.visible = false; P.pockets.forEach(p => (p.visible = false)); }
function couchStack(n) { return n; }

// ---------------- static comics (screen space) + flashes ----------------
export const COMICS = [
  { t: 6.26, text: 'KA-CHING!', x: 540, y: 330, size: 150, fill: '#5fe07a', rot: -0.08, dur: 0.85 },
  { t: 7.58, text: 'DEAL!', x: 770, y: 330, size: 165, fill: '#ffd21f', rot: 0.08, burst: true, lines: true, dur: 0.85 },
  { t: 10.95, text: 'PUSH!', x: 300, y: 560, size: 150, fill: '#ffffff', rot: -0.16, dur: 0.6 },
  { t: 11.67, text: 'PUSH!', x: 770, y: 470, size: 165, fill: '#ffffff', rot: 0.12, dur: 0.75 },
  { t: 13.95, text: 'WHAM!', x: 540, y: 560, size: 230, fill: '#ff4d3a', rot: -0.1, burst: true, burstColor: '#ffd21f', lines: true, dur: 1.1 },
  { t: 16.88, text: 'CHA-CHING!', x: 540, y: 420, size: 135, fill: '#5fe07a', rot: 0.06, dur: 0.9 },
  { t: 19.55, text: 'HELP!', x: 280, y: 720, size: 120, fill: '#ffffff', rot: -0.12, dur: 1.3 },
  { t: 19.8, text: 'ME TOO!', x: 790, y: 560, size: 110, fill: '#ffd21f', rot: 0.1, dur: 1.1 },
  { t: 20.05, text: 'HEY KID!', x: 330, y: 380, size: 105, fill: '#ffffff', rot: -0.06, dur: 0.85 },
  { t: 20.3, text: 'HELP!', x: 780, y: 880, size: 120, fill: '#ffd21f', rot: 0.14, dur: 0.6 },
  { t: 21.0, text: 'RING RING', x: 740, y: 470, size: 90, fill: '#ffffff', rot: 0.1, dur: 0.5 },
  { t: 22.42, text: 'SNATCH!', x: 540, y: 400, size: 150, fill: '#ffd21f', rot: -0.07, dur: 0.75 },
  { t: 25.22, text: 'CRACK!', x: 560, y: 460, size: 200, fill: '#ff4d3a', rot: 0.08, burst: true, burstColor: '#ffffff', lines: true, dur: 1.0 },
  { t: 26.88, text: 'TA-DA!', x: 540, y: 420, size: 170, fill: '#ffd21f', rot: -0.06, burst: true, burstColor: '#7fd6ff', dur: 0.9 },
  { t: 29.42, text: 'OOPS!', x: 560, y: 430, size: 170, fill: '#ffffff', rot: 0.1, dur: 0.75 },
  { t: 30.25, text: 'NOOO!', x: 760, y: 340, size: 120, fill: '#ffffff', rot: 0.12, dur: 0.8 },
  { t: 31.37, text: 'CRASH!', x: 540, y: 520, size: 230, fill: '#ff4d3a', rot: -0.08, burst: true, burstColor: '#ffd21f', lines: true, dur: 0.95 },
  { t: 33.46, text: 'STAMP!', x: 770, y: 420, size: 120, fill: '#ffffff', rot: 0.12, dur: 0.75 },
  { t: 34.75, text: 'CREAK...', x: 300, y: 520, size: 100, fill: '#ffffff', rot: -0.1, dur: 0.75 },
  { t: 36.2, text: 'VROOOM!', x: 720, y: 560, size: 160, fill: '#ffd21f', rot: 0.08, lines: true, dur: 0.95 },
  { t: 38.1, text: 'GLUG GLUG', x: 300, y: 470, size: 95, fill: '#ffffff', rot: -0.1, dur: 0.8 },
  { t: 39.42, text: 'GIMME!', x: 560, y: 380, size: 140, fill: '#ffd21f', rot: 0.06, dur: 0.6 },
  { t: 40.75, text: 'CHIRP...', x: 790, y: 360, size: 85, fill: '#ffffff', rot: 0.1, dur: 1.0 },
  { t: 42.27, text: 'SLAP!', x: 640, y: 420, size: 180, fill: '#ff4d3a', rot: 0.1, burst: true, burstColor: '#ffffff', dur: 0.8 },
  { t: 47.45, text: 'AWKWARD...', x: 540, y: 380, size: 120, fill: '#ffffff', rot: -0.05, dur: 0.75 },
  { t: 48.88, text: "LET'S GO!", x: 540, y: 380, size: 170, fill: '#ffd21f', rot: -0.06, lines: true, dur: 0.8 },
  { t: 50.42, text: 'CLICK!', x: 300, y: 520, size: 110, fill: '#ffffff', rot: -0.1, dur: 0.6 },
  { t: 52.62, text: 'BRRRT!', x: 540, y: 400, size: 170, fill: '#ffffff', rot: 0.06, lines: true, dur: 0.9 },
  { t: 54.62, text: 'KA-CHING!', x: 540, y: 360, size: 160, fill: '#5fe07a', rot: -0.06, burst: true, burstColor: '#ffd21f', dur: 0.9 },
  { t: 58.64, text: 'WHAM!', x: 540, y: 560, size: 240, fill: '#ff4d3a', rot: -0.1, burst: true, burstColor: '#ffd21f', lines: true, dur: 1.36 },
];
export const FLASHES = [{ t: 26.85, dur: 0.18, a: 0.85 }, { t: 48.13, dur: 0.22 }, { t: 54.03, dur: 0.25 }, { t: 55.77, dur: 0.2, a: 0.5, color: '255,220,160' }];
export const captionY = f => 1250;

// ---------------- init ----------------
export function init(c) {
  ctx = c; OFF = c.OFF; S = c.S;
  const reg = o => { o.rotation.order = 'YXZ'; return c.reg(o); };
  C.hero = new Char({ name: 'hero', shirt: '#2f7de1', pants: '#23304f', hair: '#5a3418', hairStyle: 'short', seed: 1 });
  C.buddy = new Char({ name: 'buddy', shirt: '#3aa655', pants: '#3b3b44', hair: '#1c1c1c', hairStyle: 'spiky', skin: '#c98e64', height: 1.04, seed: 2 });
  C.granny = new Char({ name: 'granny', shirt: '#9b7fd1', pants: '#6b5a7a', hair: '#d9d9de', hairStyle: 'bun', glasses: true, skin: '#f2c9b0', sleeves: 'long', height: 0.9, seed: 3 });
  C.red = new Char({ name: 'red', shirt: '#e04545', pants: '#2c3e50', hair: '#1c1c1c', hairStyle: 'cap', capColor: '#2f2f36', capBack: true, skin: '#8d5a3b', seed: 4 });
  C.yellow = new Char({ name: 'yellow', shirt: '#f2b630', pants: '#3a4a6b', hair: '#c0571f', hairStyle: 'short', skin: '#f5d0b0', width: 1.1, seed: 5 });
  C.owner = new Char({ name: 'owner', shirt: '#d98b3a', pants: '#4a4a52', hair: '#4a3020', hairStyle: 'bald', mustache: true, skin: '#e6b08a', width: 1.18, sleeves: 'long', seed: 6 });
  C.lady = new Char({ name: 'lady', shirt: '#ef7fb0', pants: '#5b4a8a', hair: '#2b1a12', hairStyle: 'long', skin: '#d9a27a', height: 0.96, seed: 7 });
  C.c1 = new Char({ name: 'c1', shirt: '#29b0b0', pants: '#33415c', hair: '#3a2a1a', hairStyle: 'short', skin: '#c48660', seed: 8 });
  C.c2 = new Char({ name: 'c2', shirt: '#8a5cd6', pants: '#2c2c34', hair: '#e0b040', hairStyle: 'spiky', skin: '#f2c3a0', seed: 9 });
  C.c3 = new Char({ name: 'c3', shirt: '#ff8c42', pants: '#3a4a6b', hair: '#2b1a12', hairStyle: 'bun', skin: '#8d5a3b', height: 0.95, seed: 10 });
  Object.values(C).forEach(k => c.reg(k.root));
  // hero pocket flaps
  P.pockets = [1, -1].map(s => { const b = box(0.07, 0.12, 0.1, mat('#f4f4f4'), { pos: [s * 0.2, -0.08, 0.02] }); C.hero.hips.add(b); b.visible = false; return b; });

  P.couch = reg(PR.couch());
  P.boxes = Array.from({ length: 6 }, (_, i) => reg(PR.cbox(0.62 - (i % 3) * 0.06, 0.42, 0.5, i % 2 ? '#c99a5c' : '#d4a86a')));
  P.fridge = reg(PR.fridge());
  P.piano = reg(PR.piano());
  P.dolly = reg(PR.dolly());
  P.lamp = reg(PR.lamp());
  P.bills = Array.from({ length: 24 }, (_, i) => reg(PR.bill(i % 3 ? 20 : 50)));
  P.bill20 = reg(PR.bill(20)); P.bill50 = reg(PR.bill(50));
  P.wallet = reg(PR.wallet());
  P.moth = reg(PR.moth());
  P.phone = reg(PR.phone());
  P.car = reg(PR.car());
  P.truck = reg(PR.truck());
  P.pump = reg(PR.pump());
  P.laptop = reg(PR.laptop());
  P.printer = reg(PR.printer());
  P.cards = Array.from({ length: 14 }, () => reg(PR.card()));
  P.doc = reg(PR.insuranceDoc());
  P.sign = reg(PR.sign());
  P.keys = Array.from({ length: 12 }, (_, i) => reg(box(0.07, 0.03, 0.22, mat(i % 3 ? '#fbfbf6' : '#111'))));
  const stG = new THREE.ExtrudeGeometry(starShape(0.09, 0.04), { depth: 0.025, bevelEnabled: false });
  P.stars = reg(grp(...Array.from({ length: 4 }, () => mesh(stG, mat('#ffd21f', { emissive: '#b88a00', emissiveIntensity: 0.6 }), { cast: false }))));
  P.roller = reg(grp(cyl(0.02, 0.02, 1.3, 6, mat('#6b4a2e'), { pos: [0, -0.55, 0] }), box(0.03, 0.03, 0.3, mat('#888'), { pos: [0, 0.1, 0] }), cyl(0.07, 0.07, 0.34, 10, mat('#e8463c'), { pos: [0, 0.18, 0], rot: [HP, 0, 0] })));
  const confColors = ['#ff4d3a', '#ffd21f', '#2f7de1', '#5fe07a', '#ff7fd0', '#ffffff'];
  P.confetti = Array.from({ length: 70 }, (_, i) => reg(mesh(new THREE.PlaneGeometry(0.07, 0.1), new THREE.MeshStandardMaterial({ color: confColors[i % 6], side: THREE.DoubleSide, roughness: 0.6, emissive: confColors[i % 6], emissiveIntensity: 0.25 }), { cast: false })));
  S.cans.forEach(cn => { cn.userData.home = cn.position.clone(); });
}

// ---------------- per-shot code ----------------
const SHOTS = [];
const shot = (a, b, fn) => SHOTS.push({ a, b, fn });

function stars(v, t, r = 0.35) { putW(P.stars, v); P.stars.children.forEach((s, i) => { const a = t * 5 + i * HP; s.position.set(Math.cos(a) * r, Math.sin(a * 2) * 0.04, Math.sin(a) * r); s.rotation.set(0, a * 2, 0); }); }
function mothFly(t, t0, from, dir, f) {
  if (t < t0) return null; const u = t - t0;
  const v = from.clone().add(new THREE.Vector3(dir[0] * u + Math.sin(u * 7) * 0.05, dir[1] * u + Math.sin(u * 11) * 0.05, dir[2] * u));
  putW(P.moth, v, 0.3, Math.atan2(dir[0], dir[2]) + Math.sin(u * 5) * 0.4, 0, 1.6); P.moth.userData.flap(f); return v;
}
function confetti(set, cx, cz, t, t0, spread = 3, top = 6) {
  if (t < t0) return;
  P.confetti.forEach((m, i) => {
    const u = t - t0 - rnd(i, 1) * 0.6; if (u < 0) return;
    const x = cx + (rnd(i, 2) - 0.5) * spread * 2 + Math.sin(u * 3 + i) * 0.25, y = top - u * (1.4 + rnd(i, 3)), z = cz + (rnd(i, 4) - 0.5) * 2.5;
    if (y < 0.05) return;
    put(m, set, x, y, z, u * 4 + i, u * 6 + i, u * 3);
  });
}
function crowdWave(c, t, ph) { const p = { ...POSES.wave }; p.rShZ += Math.sin(t * 11 + ph) * 0.35; return p; }

// 1 ROOM: broke
shot(0, 100, (L, t) => {
  ctx.light('room', 'room', 0, 0, { extent: 6 }); S.room.visible = true;
  const shakeOn = t > 1.5 && t < 2.35;
  const p = pose({ ...POSES.sad, rShX: 0.8 + (shakeOn ? Math.sin(t * 34) * 0.07 : 0), rShZ: -0.5, rEl: 1.55, rShY: 0.3, lShX: 0.35, lEl: 0.3, headX: 0.3, headY: -0.08 });
  const look = t > 2.0 ? [-0.6, 0.7] : [0, -0.6];
  ch(C.hero, 'room', 0.35, 0, 0.2, -0.08, p, { eyes: 'open', brow: -0.32, mouth: t > 2.5 ? 'frown' : 'line', look });
  if (t > 2.35) C.hero.sweatDrop(F, 70);
  const hp = handPt(C.hero, 'r', [0, -0.11, 0.05]);
  const flip = smooth(seg(t, 1.45, 1.65));
  putW(P.wallet, hp, 0, -0.1, PI * flip + (shakeOn ? Math.sin(t * 34) * 0.25 : 0), 1.25); P.wallet.userData.setOpen(2.5);
  const mv = mothFly(t, 1.95, hp, [-0.45, 0.42, 0.5], F);
  if (mv) pop('FLAP FLAP', 2.05, mv, { size: 78, fill: '#ffffff', dy: -60, dur: 0.95, rot: -0.1, drift: -20 });
  camK('room', [[4, [0.38, 1.58, 2.25], [0.3, 1.42, 0.2], 40], [96, [0.85, 1.5, 4.1], [0.3, 1.2, 0.2], 42]], L);
});

// 2 STREET: friend asks
shot(100, 172, (L, t) => {
  ctx.light('day', 'street', 0, 2); S.street.visible = true;
  put(P.couch, 'street', 0.75, 0.16, 1.25, -0.55);
  const pt = pose({ lShZ: 1.25, lShX: 0.3, lEl: 0.05, headY: 0.15 });
  const p = seqPose(t, [[0, crowdWave(C.buddy, t, 0)], [4.7, pt], [5.45, POSES.give]]);
  if (t < 4.7) { p.rShZ = POSES.wave.rShZ + Math.sin(t * 11) * 0.35; }
  ch(C.buddy, 'street', -0.45, 0.16, 2.4, 0.18, p, talk(t, [[4.82, 5.5]], { eyes: 'open', mouth: 'smile', browY: 0.012 }));
  camK('street', [[0, [0.05, 1.5, 7.0], [0.1, 1.1, 1.8], 42], [72, [0.05, 1.45, 6.2], [0.1, 1.12, 1.8], 42]], L);
});

// 3 STREET: bill offered
shot(172, 186, (L, t) => {
  ctx.light('day', 'street', 0, 2); S.street.visible = true;
  put(P.couch, 'street', 1.0, 0.16, 1.3, -0.55);
  ch(C.buddy, 'street', -0.2, 0.16, 2.3, 0, pose({ ...POSES.give, rShX: 1.35, rEl: 0.15 }), talk(t, [[5.8, 6.6]], { mouth: 'smile', browY: 0.015 }));
  const hp = handPt(C.buddy, 'r', [0, -0.13, 0.02]);
  putW(P.bill20, hp, -0.25, 0, 0.08 + Math.sin(t * 14) * 0.08, 1.7);
  camK('street', [[0, [-0.3, 1.5, 5.1], [-0.3, 1.42, 2.3], 40], [14, [-0.3, 1.5, 4.85], [-0.3, 1.42, 2.3], 40]], L);
});

// 4 STREET: $ eyes
shot(186, 216, (L, t) => {
  ctx.light('day', 'street', 0, 2); S.street.visible = true;
  ch(C.hero, 'street', 0.3, 0.16, 3.4, 0, pose({ headZ: Math.sin(t * 9) * 0.06, headX: -0.08 }), { eyes: t > 6.22 ? 'dollar' : 'open', mouth: t > 6.22 ? 'grin' : 'open', open: 0.5, browY: 0.02 });
  camK('street', [[0, [0.32, 1.74, 5.0], [0.3, 1.71, 3.4], 38], [30, [0.31, 1.74, 4.75], [0.3, 1.71, 3.4], 38]], L);
});

// 5 STREET: YES jump
shot(216, 258, (L, t) => {
  ctx.light('day', 'street', 0, 2); S.street.visible = true;
  put(P.couch, 'street', -1.6, 0.16, 0.9, 0.35);
  const u = seg(t, 7.4, 7.85);
  const jy = Math.sin(PI * u) * 0.5;
  let p = t < 7.4 ? mix(POSES.stand, pose({ lKnee: 0.7, rKnee: 0.7, lHipX: 0.5, rHipX: 0.5, y: -0.12, spine: 0.15, lShX: -0.3, rShX: -0.3 }), smooth(seg(t, 7.2, 7.4)))
    : t < 7.85 ? pose({ ...POSES.fist, y: jy, lKnee: 0.5, lHipX: 0.4, rKnee: 0.2 })
      : mix(pose({ ...POSES.fist, y: -0.08, lKnee: 0.4, rKnee: 0.4, lHipX: 0.3, rHipX: 0.3 }), POSES.fist, smooth(seg(t, 7.85, 8.1)));
  ch(C.hero, 'street', 0.25, 0.16, 2.7, -0.1, p, { eyes: t > 7.35 ? 'happy' : 'dollar', mouth: 'grin' });
  ch(C.buddy, 'street', -1.05, 0.16, 1.5, 0.35, POSES.thumb, { mouth: 'smile' });
  if (t < 7.3) { const hp = handPt(C.hero, 'r'); putW(P.bill20, hp, -0.2, 0, 0.1, 1.4); }
  camK('street', [[0, [0.45, 1.0, 7.8], [0.1, 1.5, 2.4], 46], [42, [0.4, 1.1, 7.1], [0.1, 1.55, 2.4], 46]], L);
});

// stairs couch helpers
const STUCK = { x: -0.1, y: 1.55, rz: 0.9 };
function stuckCouch(t, extra = 0) {
  let jx = 0, jr = 0;
  [9.3, 10.92, 11.64].forEach(tt => { const u = t - tt; if (u > 0 && u < 0.35) { jr += Math.sin(u * 40) * 0.025 * (1 - u / 0.35); jx += Math.sin(u * 33) * 0.02 * (1 - u / 0.35); } });
  put(P.couch, 'stairs', STUCK.x + jx + extra * 0.55, STUCK.y + extra * 0.32, -0.05, 0, 0, STUCK.rz + jr);
}

// 6 STAIRS: stuck wide
shot(258, 316, (L, t) => {
  ctx.light('stairs', 'stairs', 0, 0, { extent: 7 }); S.stairs.visible = true;
  stuckCouch(t);
  const pull = pose({ ...POSES.reach, lShX: 1.9, rShX: 1.9, lean: -0.22, lHipX: 0.3, lKnee: 0.4, rHipX: -0.2, y: -0.05, headX: -0.2 });
  ch(C.buddy, 'stairs', 2.05, 2.0, -0.05, -HP, pull, { eyes: 'squint', mouth: 'grit', red: 0.4 });
  ch(C.hero, 'stairs', -1.35, 0.2, -0.05, HP, pose({ ...POSES.pushUp, spine: 0.25 }), { eyes: 'squint', mouth: 'grit', red: 0.3 });
  if (t > 9.25) pop('STUCK!', 9.3, V('stairs', 0.2, 2.9, 0), { size: 150, fill: '#ff8a3d', rot: -0.08, dur: 1.0 });
  camK('stairs', [[0, [0.25, 2.0, 8.6], [0.2, 1.5, -0.2], 44], [58, [0.2, 1.95, 8.0], [0.15, 1.45, -0.2], 44]], L);
});

// 7 STAIRS: push push pop
shot(316, 408, (L, t) => {
  ctx.light('stairs', 'stairs', 0, 0, { extent: 7 }); S.stairs.visible = true;
  const loose = easeOut(seg(t, 12.72, 12.9));
  const back = easeIn(seg(t, 13.25, 13.6)) * 0.25;
  stuckCouch(t, loose - back);
  let lunge = 0; [10.92, 11.64].forEach(tt => { const u = t - tt; if (u > -0.08 && u < 0.3) lunge += Math.sin(clamp((u + 0.08) / 0.38) * PI) * 0.09; });
  const strain = Math.sin(t * 46) * 0.008;
  let p = pose({ ...POSES.pushUp, spine: 0.25 + lunge * 1.5, y: -0.05 + strain });
  if (t > 12.72) p = mix(p, pose({ ...POSES.reach, spine: 0.6, lHipX: 0.6, lKnee: 0.5, rHipX: -0.4, headX: -0.3 }), smooth(seg(t, 12.72, 12.9)));
  const after = t > 12.75;
  ch(C.hero, 'stairs', -1.35 + lunge + (after ? 0.12 * easeOut(seg(t, 12.72, 12.95)) : 0), 0.2, -0.05, HP, p,
    after ? { eyes: 'wide', mouth: 'open', open: 0.7, red: 0.3 } : { eyes: 'squint', mouth: 'grit', red: 0.4 + 0.4 * seg(t, 10.5, 12.5) });
  C.hero.sweatDrop(F, 320);
  ch(C.buddy, 'stairs', 2.05 + loose * 0.4, 2.0, -0.05, -HP, mix(pose({ ...POSES.reach, lShX: 1.9, rShX: 1.9, lean: -0.22, lHipX: 0.3, lKnee: 0.4, y: -0.05 }), pose({ ...POSES.shock, lean: -0.5, y: -0.1 }), loose), { eyes: loose > 0.5 ? 'wide' : 'squint', mouth: loose > 0.5 ? 'open' : 'grit' });
  if (t > 12.7) pop('POP!', 12.75, V('stairs', 0.8, 2.6, 0), { size: 160, fill: '#ffd21f', rot: 0.12, burst: true, burstColor: '#ffffff', dur: 0.6 });
  camK('stairs', [[0, [-0.55, 1.45, 4.6], [-0.55, 1.3, -0.1], 44], [70, [-0.45, 1.45, 3.9], [-0.5, 1.35, -0.1], 44], [92, [-0.5, 1.5, 4.3], [-0.4, 1.45, -0.1], 44]], L);
});

// 8 STAIRS: couch falls on you
const SQUASH = pose({ lShZ: 1.45, rShZ: 1.45, lEl: 0.2, rEl: 0.2, lHipZ: 0.55, rHipZ: 0.55, sy: 0.22, sx: 1.35, sz: 1.35, footFree: 1 });
shot(408, 462, (L, t) => {
  ctx.light('stairs', 'stairs', -1, 0, { extent: 7 }); S.stairs.visible = true;
  const hit = 13.93;
  const sh = shake(t, hit, 0.14, 0.5);
  if (t < hit) {
    const u = easeIn(seg(t, 13.6, hit));
    const x = lerp(STUCK.x + 0.55 * 0.75, -1.75, u), y = lerp(STUCK.y + 0.24, 0, u) + Math.sin(PI * u) * 0.25, rz = lerp(0.62, 0, u * u);
    put(P.couch, 'stairs', x, Math.max(0, y), -0.05, 0, 0, rz);
    ch(C.hero, 'stairs', -1.75, 0, -0.05, -0.1, pose({ ...POSES.shock, lShX: 2.2, rShX: 2.2, headX: -0.4, headY: 0.45 }), { eyes: 'wide', mouth: 'open', open: 1 });
  } else {
    const u = t - hit;
    const b = Math.abs(Math.sin(u * 16)) * 0.1 * Math.exp(-u * 6);
    put(P.couch, 'stairs', -1.75, 0.3 + b, -0.05, 0, 0, Math.sin(u * 12) * 0.03 * Math.exp(-u * 4));
    const p = pose({ ...SQUASH, lHipX: Math.sin(u * 14) * 0.25 * Math.exp(-u * 1.2), rHipX: -Math.sin(u * 14) * 0.25 * Math.exp(-u * 1.2) });
    ch(C.hero, 'stairs', -1.75, 0, 0.0, HP - 0.3, p, { eyes: 'x', mouth: 'open', open: 0.5, noLife: true });
    stars(V('stairs', -1.75, 1.3, 0), t, 0.45);
  }
  ch(C.buddy, 'stairs', 2.0, 2.0, -0.05, -HP + 0.4, t < hit ? POSES.shock : pose({ ...POSES.shock, lShX: 2.0, rShX: 2.0, lEl: 2.0, rEl: 2.0 }), { eyes: 'wide', mouth: 'open', open: 0.8 });
  cam('stairs', [-3.4, 0.75, 3.2], [-0.9, 1.3, -0.1], 46, sh);
});

// 9 STAIRS: granny pays 50
shot(462, 522, (L, t) => {
  ctx.light('stairs', 'stairs', -3, 0, { extent: 7 }); S.stairs.visible = true;
  put(P.couch, 'stairs', -1.75, 0.3, -0.05, 0, 0, 0.02);
  const doorK = easeOut(seg(t, 15.42, 15.75));
  S.nDoor.rotation.y = 1.75 * doorK;
  const step = easeInOut(seg(t, 15.55, 16.0));
  const gp = seqPose(t, [[0, POSES.stand], [15.8, pose({ ...POSES.shock, lShX: 1.9, rShX: 1.9, lEl: 2.1, rEl: 2.1, lShZ: 0.4, rShZ: 0.4 })], [16.3, pose({ ...POSES.give, rShX: 1.35 })], [17.0, pose({ ...POSES.thumb })]]);
  ch(C.granny, 'stairs', -4.15 + step * 0.4, 0, -0.75 + step * 0.55, 0.5 + step * 0.6, gp, t < 16.2 ? { eyes: 'wide', mouth: 'open', open: 0.6, browY: 0.02 } : { eyes: 'happy', mouth: 'smile' });
  // hero lying under couch: left arm sticks out toward camera
  const reachK = smooth(seg(t, 16.55, 16.8)), pullK = smooth(seg(t, 17.0, 17.2));
  const lp = pose({ lean: -HP, y: -0.74, lShZ: 1.25, lShX: 0.25 + reachK * 0.55 - pullK * 0.4, lEl: 0.2, rShZ: 0.3, footFree: 1, lHipZ: 0.15, rHipZ: 0.15 });
  lp.lShX += Math.sin(t * 9) * 0.06 * (1 - reachK);
  ch(C.hero, 'stairs', -2.45, 0, -0.1, -HP, lp, { eyes: 'x', mouth: 'open', noLife: true });
  stars(V('stairs', -1.6, 1.35, 0), t, 0.4);
  // bill path
  if (t < 16.85) { const gh = handPt(C.granny, 'r', [0, -0.12, 0.02]); putW(P.bill50, gh, -0.2, 0.3, 0.1 + Math.sin(t * 13) * 0.08, 1.5); }
  else if (t < 17.25) { const hh = handPt(C.hero, 'l', [0, -0.1, 0]); putW(P.bill50, hh, -0.4, 0.2, 0.2, 1.5); }
  camK('stairs', [[0, [-3.35, 1.3, 4.9], [-3.2, 0.95, -0.4], 42], [60, [-3.3, 1.22, 4.4], [-3.15, 0.95, -0.4], 42]], L);
});

// 10 STREET: tower of boxes
shot(522, 572, (L, t) => {
  ctx.light('day', 'street', 0, 2); S.street.visible = true;
  const d = (t - 17.4) * 1.05, hx = -1.3 + d;
  const ph = walkPh(d, 0.5);
  const p = add(walk(ph, 0.55), { lShX: 2.85, rShX: 2.85, lEl: 0.25, rEl: 0.25, lShZ: 0.25, rShZ: 0.25 });
  ch(C.hero, 'street', hx, 0.16, 2.6, HP, p, { eyes: 'squint', mouth: 'grit', red: 0.35 });
  C.hero.sweatDrop(F, 520);
  let y = 2.16, sway = 0;
  for (let i = 0; i < 5; i++) {
    sway += Math.sin(t * 4.2 + i * 0.6) * 0.035 * (i + 1) * 0.6;
    const bx = P.boxes[i]; put(bx, 'street', hx + Math.sin(sway) * (y - 2.0) * 0.5, y, 2.6, HP + (i % 2 ? 0.2 : -0.15), 0, sway * 0.6);
    y += 0.42;
  }
  put(P.lamp, 'street', hx + Math.sin(sway) * (y - 2) * 0.5, y, 2.6, 0, 0, sway * 0.8 + 0.15, 0.8);
  const gd = Math.max(0, (t - 17.6) * 0.95), gx = -2.75 + gd;
  ch(C.granny, 'street', gx, 0.16, 2.2, HP, add(walk(walkPh(gd, 0.45), 0.6), { rShX: 1.5, rEl: 0.05, rShZ: 0.1 }), talk(t, [[17.6, 18.6]], { mouth: 'smile' }));
  cam('street', [hx + 0.2, 2.6, 8.6], [hx + 0.15, 2.65, 2.4], 46);
});

// 11 STREET: whole building
const RES = [['granny', 3], ['owner', 4], ['c1', 7], ['c2', 8], ['c3', 11], ['lady', 12]];
shot(572, 628, (L, t) => {
  ctx.light('day', 'street', 0, 0, { extent: 14, cy: 5 }); S.street.visible = true;
  RES.forEach(([name, wi], i) => {
    const w = S.windows[wi], t0 = 19.3 + i * 0.16;
    const k = easeOutBack(seg(t, t0, t0 + 0.22));
    w.userData.open(clamp(k));
    if (t < t0) return;
    const wp = w.position;
    ch(C[name], 'street', wp.x, wp.y - 1.84, 0.05 + 0.2 * clamp(k), 0, pose({ ...crowdWave(C[name], t, i * 1.7), spine: 0.12 }), talk(t, [[t0 + 0.1, t0 + 1.4]], { eyes: 'wide', mouth: 'open' }));
    C[name].legsOn(false);
  });
  ch(C.hero, 'street', 0.1, 0.16, 3.2, PI, pose({ headX: -0.55, lShZ: 0.2, rShZ: 0.2 }), {});
  camK('street', [[0, [0.0, 1.6, 9.5], [0, 3.6, 0], 50], [50, [0.0, 2.4, 12.0], [0, 7.4, 0], 50]], L);
});

// 12 STREET: call two friends
shot(628, 670, (L, t) => {
  S.windows.forEach(w => w.userData.open(0));
  ctx.light('day', 'street', 0, 2); S.street.visible = true;
  const phoneOn = t < 21.5;
  const hp = seqPose(t, [[0, POSES.phone], [21.5, POSES.cheer]]);
  ch(C.hero, 'street', 0, 0.16, 2.4, 0, hp, talk(t, [[21.05, 21.45]], { mouth: t > 21.5 ? 'grin' : 'smile', eyes: t > 21.5 ? 'happy' : 'open' }));
  if (phoneOn) { const v = handPt(C.hero, 'r', [0.0, -0.08, 0.02]); putW(P.phone, v, 0, -HP, 0.2); }
  const k = easeOutBack(seg(t, 21.45, 21.75), 1.4);
  const land = seg(t, 21.7, 21.9);
  ch(C.red, 'street', lerp(-3.6, -1.05, k), 0.16, 2.6, 0.25, t < 21.72 ? run(t * 20, 1) : POSES.thumb, { mouth: 'grin', eyes: land > 0.5 ? 'happy' : 'open' });
  ch(C.yellow, 'street', lerp(3.6, 1.05, k), 0.16, 2.6, -0.25, t < 21.72 ? run(t * 20 + 1, 1) : pose({ ...POSES.thumb, rShX: 1.15 }), { mouth: 'grin', eyes: land > 0.5 ? 'happy' : 'open' });
  camK('street', [[0, [0, 1.5, 8.0], [0, 1.15, 2.4], 42], [42, [0, 1.45, 7.4], [0, 1.15, 2.4], 42]], L);
});

// 13 STREET: shared the money
shot(670, 706, (L, t) => {
  ctx.light('day', 'street', 0, 2); S.street.visible = true;
  ch(C.hero, 'street', 0, 0.16, 2.4, 0, pose({ ...POSES.give, rShX: 1.0, rEl: 0.9, rShZ: -0.15 }), t < 22.75 ? { mouth: 'grin', eyes: 'happy' } : { mouth: 'frown', brow: -0.35 });
  const grabT = [22.4, 22.47, 22.54, 22.61, 22.68];
  const gr = Math.max(...grabT.map((g, i) => (t > g ? 1 - clamp((t - g) / 0.12) : 0)));
  ch(C.red, 'street', -0.85, 0.16, 2.1, 0.55, mix(POSES.stand, POSES.reach, 0.6 + gr * 0.4), { mouth: 'grin', eyes: 'happy' });
  ch(C.yellow, 'street', 0.85, 0.16, 2.1, -0.55, mix(POSES.stand, POSES.reach, 0.6 + gr * 0.4), { mouth: 'grin', eyes: 'happy' });
  const hp = handPt(C.hero, 'r', [0, -0.08, 0.04]);
  for (let i = 0; i < 6; i++) {
    const fan = (i - 2.5) * 0.28;
    const base = hp.clone().add(new THREE.Vector3(Math.sin(fan) * 0.06, 0.05 + Math.cos(fan) * 0.04, 0.02 + i * 0.002));
    if (i < 5) {
      const to = handPt(i % 2 ? C.yellow : C.red, 'r', [0, -0.08, 0]);
      const u = clamp((t - grabT[i]) / 0.14);
      const v = base.clone().lerp(to, easeOut(u)); v.y += Math.sin(PI * u) * 0.12;
      putW(P.bills[i], v, -0.1, 0, fan * (1 - u) + u * 2, 0.95);
    } else putW(P.bills[i], base, -0.1, 0, fan, 0.95);
  }
  camK('street', [[0, [0, 1.55, 5.9], [0, 1.38, 2.3], 42], [36, [0, 1.55, 5.6], [0, 1.4, 2.3], 42]], L);
});

// fridge on back
function fridgeOnBack(c, extraSpine = 0) { attach(P.fridge, c.root, 0, 0.92 - extraSpine * 0.2, -0.72 + extraSpine * 0.35, 0.45 + extraSpine * 0.5, 0, 0, 0.8); }
// 14 STREET: carrying fridge
shot(706, 756, (L, t) => {
  ctx.light('day', 'street', 0, 2); S.street.visible = true;
  const d = (t - 23.53) * 0.55, hx = -0.9 + d, ph = walkPh(d, 0.32);
  const wob = Math.sin(t * 23) * 0.04;
  const p = pose({ ...POSES.hunch, lHipX: 0.35 + Math.sin(ph) * 0.2, rHipX: 0.35 - Math.sin(ph) * 0.2, lKnee: 0.45 + wob + Math.max(0, -Math.cos(ph)) * 0.3, rKnee: 0.45 - wob + Math.max(0, Math.cos(ph)) * 0.3, y: -0.08 + Math.abs(Math.sin(ph)) * 0.02 });
  ch(C.hero, 'street', hx, 0.16, 2.5, HP, p, { eyes: 'squint', mouth: 'grit', red: 0.55 });
  C.hero.sweatDrop(F, 700);
  fridgeOnBack(C.hero);
  cam('street', [hx + 0.35, 1.6, 8.2], [hx + 0.25, 1.35, 2.4], 42);
});

// 15 STREET: CRACK
shot(756, 788, (L, t) => {
  ctx.light('day', 'street', 0, 2); S.street.visible = true;
  const hx = -0.9 + (25.2 - 23.53) * 0.55;
  const k = easeOutBack(seg(t, 25.2, 25.32));
  const p = pose({ ...POSES.hunch, spine: 0.95 + k * 0.4, headX: -0.95, y: -0.1 - k * 0.05, lKnee: 0.6, rKnee: 0.6, lHipX: 0.4, rHipX: 0.4, lShZ: 0.6, rShZ: 0.6, lShX: 0.6, rShX: 0.6 });
  ch(C.hero, 'street', hx, 0.16, 2.5, HP, p, { eyes: k > 0.3 ? 'wide' : 'squint', mouth: k > 0.3 ? 'open' : 'grit', open: 1, red: 0.85 });
  fridgeOnBack(C.hero, k * 0.4);
  const zk = easeOut(seg(t, 25.18, 25.4));
  cam('street', [hx + lerp(3.6, 3.0, zk), lerp(1.25, 1.15, zk), lerp(5.6, 5.1, zk)], [hx + 0.25, 1.2, 2.45], 42, shake(t, 25.2, 0.06, 0.35));
});

// 16 STREET: cart with wheels
shot(788, 842, (L, t) => {
  ctx.light('day', 'street', 0, 2); S.street.visible = true;
  const hx0 = -0.9 + (25.2 - 23.53) * 0.55;
  if (t < 26.85) {
    const p = pose({ ...POSES.hunch, spine: 1.2, headX: -0.4, headY: -0.5, lKnee: 0.6, rKnee: 0.6, lHipX: 0.4, rHipX: 0.4 });
    ch(C.hero, 'street', hx0, 0.16, 2.5, HP, p, { eyes: 'wide', mouth: 'open', open: 0.5, red: 0.5 });
    fridgeOnBack(C.hero, 0.3);
    const k = easeOut(seg(t, 26.3, 26.75));
    put(P.dolly, 'street', lerp(hx0 + 3.2, hx0 + 0.95, k), 0.16, 2.6, -HP, -0.12 * (1 - k), Math.sin(t * 20) * 0.05 * (1 - k));
    cam('street', [hx0 + 0.6, 1.5, 7.6], [hx0 + 0.6, 1.2, 2.4], 42);
  } else {
    const d = (t - 26.85) * 1.15, hx = hx0 + d, ph = walkPh(d, 0.55);
    const p = add(walk(ph, 0.8), { lShX: 0.85, rShX: 0.85, lEl: 0.4, rEl: 0.4, spine: 0.05, lShZ: -0.05, rShZ: -0.05 });
    ch(C.hero, 'street', hx, 0.16, 2.55, HP, p, { eyes: 'happy', mouth: 'grin' });
    put(P.dolly, 'street', hx + 1.0, 0.16 + 0.05, 2.55, HP, -0.42);
    attach(P.fridge, P.dolly, 0, 0.07, 0.3, 0, 0, 0);
    cam('street', [hx + 0.75, 1.5, 7.6], [hx + 0.7, 1.2, 2.4], 42);
  }
});

// hill helpers
const hillY = x => (x > 15 ? 0 : x < -25 ? -8.4 : (x - 15) * 0.21);
const HA = Math.atan(0.21);
function resetCans() { S.cans.forEach(c => { c.position.copy(c.userData.home); c.rotation.set(0, 0, 0); c.userData.lid.position.set(0, 0.88, 0); c.userData.lid.rotation.set(0, 0, 0); }); }
function placePiano(x, extra = {}) { const y = hillY(x); put(P.piano, 'hill', x, y + (extra.dy || 0), extra.z || 0, extra.ry || 0, extra.rx || 0, (x > -25 ? HA : 0) + (extra.rz || 0)); }

// 17 HILL: piano slips
shot(842, 894, (L, t) => {
  ctx.light('day', 'hill', 9, 0); S.hill.visible = true; resetCans();
  const u = Math.max(0, t - 29.4);
  const px = 9 - 0.5 * 4.5 * u * u;
  placePiano(px, { rz: u > 0 ? Math.sin(u * 20) * 0.03 : 0 });
  const slip = t > 29.4;
  const hold = pose({ ...POSES.reach, lShX: 1.25, rShX: 1.25, spine: 0.2, lean: 0.1, lHipX: 0.3, rHipX: -0.3, lKnee: 0.3 });
  const lunge = pose({ ...POSES.reach, lShX: 1.6, rShX: 1.6, spine: 0.45, lHipX: 0.7, lKnee: 0.6, rHipX: -0.5 });
  const sl = smooth(seg(t, 29.4, 29.6));
  ch(C.hero, 'hill', 10.5 - sl * 0.2, hillY(10.5) + 0.0, 0.2, -HP, mix(hold, lunge, sl), slip ? { eyes: 'wide', mouth: 'open', open: 1 } : { eyes: 'squint', mouth: 'grit', red: 0.3 });
  ch(C.red, 'hill', 11.3, hillY(11.3), -0.75, -HP + 0.3, slip ? POSES.shock : POSES.hipsHands, slip ? { eyes: 'wide', mouth: 'open' } : { mouth: 'smile' });
  ch(C.yellow, 'hill', 11.4, hillY(11.4), 0.95, -HP - 0.35, slip ? pose({ ...POSES.shock, lShX: 2.2, rShX: 2.2, lEl: 2.0, rEl: 2.0 }) : POSES.thumb, slip ? { eyes: 'wide', mouth: 'open' } : { mouth: 'grin' });
  if (!slip) C.hero.sweatDrop(F, 840);
  camK('hill', [[0, [9.9, -0.45, 6.9], [10.0, -0.75, 0], 42], [52, [9.6, -0.5, 6.4], [9.7, -0.85, 0], 42]], L);
});

// 18 HILL: rolling + crash
const CRASH_T = 31.35, CRASH_X = -27.6;
function pianoX(t) { const tau = clamp(t - 29.8, 0, CRASH_T - 29.8); return 8.6 - 8 * tau - 0.5 * 19.75 * tau * tau; }
shot(894, 956, (L, t) => {
  ctx.light('day', 'hill', -18, 0, { extent: 14, cy: -6 }); S.hill.visible = true; resetCans();
  const tau = t - 29.8;
  let lookP;
  if (t < CRASH_T) {
    const x = Math.max(CRASH_X, pianoX(t));
    const hop = Math.abs(Math.sin(tau * 11)) * 0.22 * clamp(tau * 2);
    placePiano(x, { dy: hop, rz: Math.sin(tau * 13) * 0.07, ry: Math.sin(tau * 7) * 0.18, z: Math.sin(tau * 3) * 0.3 });
    lookP = [x - 2, hillY(x) + 0.9, 0];
  } else {
    const u = t - CRASH_T;
    const tip = bounceOut(clamp(u / 0.4));
    put(P.piano, 'hill', CRASH_X + 0.15 * tip, -8.38 + 0.28 * tip, 0.2, -0.3, tip * 1.45, 0.05);
    P.keys.forEach((k, i) => {
      const vx = -2 - rnd(i, 1) * 4, vy = 3 + rnd(i, 2) * 5, vz = (rnd(i, 3) - 0.3) * 6;
      const g = 16, tt = u; let y = -7.5 + vy * tt - 0.5 * g * tt * tt; const land = y < -8.38;
      put(k, 'hill', CRASH_X + vx * tt * (land ? 0.6 : 1), Math.max(-8.38, y), 0.4 + vz * tt * (land ? 0.6 : 1), tt * 9 * rnd(i, 4), tt * 7, tt * 5);
    });
    S.cans.forEach((c, i) => {
      const vx = -3 - rnd(i, 5) * 3, vy = 4 + rnd(i, 6) * 3, vz = (rnd(i, 7) - 0.5) * 7, tt = u;
      const y = vy * tt - 0.5 * 16 * tt * tt;
      c.position.set(c.userData.home.x + vx * tt, c.userData.home.y + Math.max(0, y), c.userData.home.z + vz * tt);
      c.rotation.set(tt * 6, tt * 2, tt * 8 + (y < 0 ? HP : 0));
      c.userData.lid.position.set(0, 0.88 + Math.max(0, 4 * tt - 8 * tt * tt) * 1.5, 0);
    });
    lookP = [CRASH_X + 0.5, -7.6, 0.2];
  }
  // crew running down far behind
  [['hero', 0, 0.2], ['red', 0.9, -0.8], ['yellow', 1.4, 1.0]].forEach(([n, lag, z]) => {
    const x = 10.4 - Math.max(0, t - 29.95 - lag * 0.1) * 6.5 - lag;
    ch(C[n], 'hill', x, hillY(x), z, -HP, add(run(t * 17 + lag * 2, 1), { lShX: 1.5, rShX: 1.8, lShZ: 0.5, rShZ: 0.5 }), { eyes: 'wide', mouth: 'open', open: 1 });
  });
  const k = smooth(seg(t, 29.8, CRASH_T + 0.1));
  const look = [lerp(4, lookP[0], 0.6 + 0.4 * k), lerp(-1.5, lookP[1], 0.6 + 0.4 * k), lookP[2]];
  cam('hill', [-33.5, -6.6, 4.2], look, lerp(22, 40, smooth(seg(t, 29.9, 31.25))), shake(t, CRASH_T, 0.16, 0.55));
});

// 19 HILL: paid for it
shot(956, 992, (L, t) => {
  ctx.light('day', 'hill', -26, 2, { extent: 8, cy: -8 }); S.hill.visible = true;
  put(P.piano, 'hill', CRASH_X + 0.15, -8.1, 0.2, -0.3, 1.45, 0.05);
  S.cans.forEach((c, i) => { const h = c.userData.home; c.position.set(h.x - 3 - rnd(i, 5) * 3, h.y, h.z + (rnd(i, 7) - 0.5) * 6); c.rotation.set(0, i, HP); c.userData.lid.position.set(0.3, 0.2, 0.5); });
  ch(C.owner, 'hill', -26.7, -8.4, 2.5, HP - 0.15, seqPose(t, [[0, POSES.armsCross], [32.1, pose({ ...POSES.give, rShX: 1.1 })], [32.75, POSES.armsCross]]), talk(t, [[31.9, 32.15], [32.7, 33.0]], { eyes: 'open', mouth: 'frown', brow: 0.42, red: 0.45 }));
  ch(C.hero, 'hill', -25.25, -8.4, 2.5, -HP + 0.15, pose({ ...POSES.give, rShX: 1.05, rEl: 0.6, headX: 0.15 }), { eyes: 'open', mouth: 'frown', brow: -0.35 });
  const wp = handPt(C.hero, 'r', [0, -0.1, 0.02]);
  putW(P.wallet, wp, 0, -HP + 0.3, 0, 1.2); P.wallet.userData.setOpen(2.2);
  const op = handPt(C.owner, 'r', [0, -0.1, 0.02]);
  for (let i = 0; i < 4; i++) {
    const t0 = 32.15 + i * 0.1;
    if (t < t0) { putW(P.bills[i], wp.clone().add(new THREE.Vector3(0, 0.04 + i * 0.01, 0)), 0, -HP, 0.1 * i, 1.1); continue; }
    const u = fly(P.bills[i], wp, op.clone().add(new THREE.Vector3(0, 0.02 * i, 0)), t, t0, t0 + 0.25, 0.25, [0.4, 2, 1], 1.1);
  }
  cam('hill', [-25.95, -7.05, 7.0], [-25.95, -7.45, 2.4], 42);
});

// 20 STUDIO: insurance
shot(992, 1036, (L, t) => {
  ctx.light('studio', 'studio', 0, 0, { extent: 6 }); S.studio.visible = true; S.studioCyc.visible = true; S.rays.visible = false;
  S.cycMat.color.set('#bfe3d8'); S.floorMat.color.set('#bfe3d8');
  ch(C.hero, 'studio', -0.5, 0, 0, 0.25, seqPose(t, [[0, POSES.stand], [33.55, pose({ ...POSES.thumb, rShX: 1.3 })]]), t < 33.5 ? { eyes: 'open', mouth: 'smile' } : { eyes: 'happy', mouth: 'grin' });
  const rise = easeOutBack(seg(t, 33.07, 33.38), 1.6);
  const sk = seg(t, 33.42, 33.5);
  const wob = Math.sin(Math.max(0, t - 33.44) * 30) * 0.04 * Math.exp(-Math.max(0, t - 33.44) * 5) * (t > 33.44 ? 1 : 0);
  put(P.doc, 'studio', 0.55, lerp(-1.2, 1.35, rise), 0.3, -0.15, 0, -0.05 + wob, 1.9);
  const st = P.doc.userData.stamp; st.visible = t > 33.42; st.scale.setScalar(lerp(2.6, 1, easeIn(sk)));
  st.material.opacity = sk; st.material.transparent = true;
  camK('studio', [[0, [0.05, 1.35, 5.0], [0.05, 1.15, 0], 40], [44, [0.05, 1.35, 4.5], [0.05, 1.18, 0], 40]], L);
});

// truck / car helpers
function loadedCar(set, x, y, z, ry, t, sag = 1) {
  put(P.car, set, x, y, z, ry);
  const b = P.car.userData.body;
  b.position.set(0, -0.14 * sag, 0); b.rotation.set(Math.sin(t * 3.3) * 0.025 * sag, 0, Math.sin(t * 2.6) * 0.03 * sag); b.scale.set(1, 1 - 0.06 * sag, 1);
  P.car.userData.wheels.forEach(w => w.scale.set(1, 1 - 0.18 * sag, 1));
  attach(P.couch, b, 0, 1.36, -0.1, 0, HP, 0);
  attach(P.boxes[0], b, 0.15, 1.95, 0.35, 0, 0.3, 0); attach(P.boxes[1], b, -0.1, 1.95, -0.45, 0, -0.2, 0);
  attach(P.lamp, b, 0.3, 2.4, -0.1, 0.4, 0, 0.3, 0.8);
  attach(P.fridge, b, 0, 0.62, -1.15, -1.3, 0, 0);
}
// 21 STREET: car too small
shot(1036, 1080, (L, t) => {
  ctx.light('day', 'street', 0, 8); S.street.visible = true;
  loadedCar('street', 0, 0.04, 8.0, HP, t, 1 + 0.25 * Math.sin(seg(t, 34.6, 35.2) * PI));
  const fall = seg(t, 35.25, 35.75);
  if (t > 35.25) { const b = P.boxes[2]; const u = t - 35.25; const y = Math.max(0.04, 2.3 + 3 * u - 0.5 * 18 * u * u); const bo = y <= 0.04 ? Math.abs(Math.sin((u - 0.62) * 9)) * 0.3 * Math.exp(-(u - 0.62) * 4) : 0; put(b, 'street', -0.8 - u * 1.6, y + bo, 9.1, 0, u * 6, u * 4); if (t > 35.6) pop('BOING!', 35.62, V('street', -1.6, 0.8, 9.1), { size: 110, fill: '#ffd21f', rot: -0.1, dur: 0.5 }); }
  else { attach(P.boxes[2], P.car.userData.body, 0.05, 2.37, 0.0, 0, 0.6, 0.1); }
  ch(C.hero, 'street', 1.75, 0.04, 9.9, -0.4, seqPose(t, [[0, POSES.phone], [35.3, POSES.shrug]]), { eyes: 'open', mouth: t > 35.3 ? 'frown' : 'line', brow: -0.25 });
  C.hero.sweatDrop(F, 1036);
  camK('street', [[0, [0.6, 2.0, 17.0], [0.45, 1.55, 8.0], 44], [44, [0.55, 2.0, 16.2], [0.45, 1.55, 8.0], 44]], L);
});

// 22 STREET: big truck
shot(1080, 1134, (L, t) => {
  ctx.light('day', 'street', 0, 8, { extent: 12 }); S.street.visible = true;
  loadedCar('street', -5.0, 0.04, 6.8, HP, t, 1);
  const k = easeOut(seg(t, 36.0, 36.96));
  const x = lerp(28, 2.6, k);
  const bu = Math.max(0, t - 36.96);
  put(P.truck, 'street', x, 0.04, 6.8, -HP, t > 36.96 ? Math.sin(bu * 13) * 0.035 * Math.exp(-bu * 4) : -0.012);
  P.truck.userData.reveal(0);
  P.truck.userData.wheels.forEach(w => (w.rotation.x = -(28 - x) / 0.5));
  const wow = t > 36.5;
  ch(C.hero, 'street', -1.7, 0.04, 9.3, 0.55, wow ? (t > 37.25 ? POSES.cheer : POSES.shock) : POSES.stand, wow ? { eyes: t > 37.25 ? 'happy' : 'wide', mouth: t > 37.25 ? 'grin' : 'open', open: 1 } : { mouth: 'line' });
  cam('street', [-1.6, 0.55, 14.2], [-0.45, 2.3, 6.8], 50, shake(t, 36.96, 0.05, 0.4));
});

// 23 GAS: paying
shot(1134, 1200, (L, t) => {
  ctx.light('day', 'gas', 0, 0); S.gas.visible = true;
  put(P.truck, 'gas', -3.4, 0, -0.8, 0); P.truck.userData.reveal(0);
  put(P.pump, 'gas', 0.35, 0, 0, 0);
  const amt = 187.4 * easeInOut(seg(t, 37.95, 38.95));
  P.pump.userData.setAmount(amt);
  ch(C.hero, 'gas', 1.15, 0, 1.25, -0.35, seqPose(t, [[0, pose({ ...POSES.give, rShX: 0.9, rEl: 0.9 })], [39.9, POSES.sad]]), t < 39.3 ? { mouth: 'line', eyes: 'open', brow: -0.15 } : { mouth: 'frown', eyes: 'wide', brow: -0.3 });
  const wp = handPt(C.hero, 'r', [0, -0.1, 0.03]);
  putW(P.wallet, wp, 0, -0.35, 0, 1.25); P.wallet.userData.setOpen(2.3);
  const slot = V('gas', 0.35, 1.4, 0.32);
  for (let i = 0; i < 4; i++) { const t0 = 38.55 + i * 0.09; if (t < t0) { putW(P.bills[i], wp.clone().add(new THREE.Vector3(0, 0.05, 0.01 * i)), 0, -0.35, 0.1 * i, 1.1); continue; } if (t < t0 + 0.3) fly(P.bills[i], wp, slot, t, t0, t0 + 0.3, 0.35, [1, 4, 2], 1.1 * (1 - 0.6 * seg(t, t0 + 0.2, t0 + 0.3))); }
  const fk = easeOutBack(seg(t, 39.2, 39.45), 1.5);
  if (t > 39.15) {
    ch(C.red, 'gas', lerp(-2.6, -0.55, fk), 0, 1.55, 0.6, pose({ ...POSES.give, rShX: 1.2, rEl: 0.3 }), { mouth: 'grin', eyes: 'happy' });
    ch(C.yellow, 'gas', lerp(4.2, 2.15, fk), 0, 1.6, -0.7, pose({ ...POSES.give, rShX: 1.2, rEl: 0.3 }), { mouth: 'grin', eyes: 'happy' });
  }
  for (let i = 4; i < 6; i++) {
    const t0 = 39.48 + (i - 4) * 0.1;
    if (t < t0) { putW(P.bills[i], wp.clone().add(new THREE.Vector3(0, 0.06, 0.01 * i)), 0, -0.35, 0.1 * i, 1.1); continue; }
    const to = handPt(i === 4 ? C.red : C.yellow, 'r', [0, -0.1, 0.02]);
    fly(P.bills[i], wp, to, t, t0, t0 + 0.22, 0.3, [0.5, 3, 1], 1.1);
  }
  camK('gas', [[0, [0.55, 1.5, 7.4], [0.5, 1.2, 0.7], 42], [66, [0.55, 1.45, 6.9], [0.5, 1.2, 0.7], 42]], L);
});

// 24 GAS: moth again
shot(1200, 1254, (L, t) => {
  ctx.light('day', 'gas', 0, 0); S.gas.visible = true;
  put(P.pump, 'gas', -0.6, 0, -0.6, 0.3); P.pump.userData.setAmount(187.4);
  put(P.truck, 'gas', -3.4, 0, -0.8, 0); P.truck.userData.reveal(0);
  const p = pose({ rShX: 0.8, rEl: 1.3, rShZ: -0.25, lShX: 0.8, lEl: 1.3, lShZ: -0.25, headX: 0.15 });
  ch(C.hero, 'gas', 0.9, 0, 1.2, 0, p, { eyes: t > 40.9 ? 'open' : 'open', mouth: 'line', brow: -0.12, look: t > 40.9 ? [0, 0] : [-0.4, -0.7] });
  const l = handPt(C.hero, 'l', [0, -0.1, 0.03]), r = handPt(C.hero, 'r', [0, -0.1, 0.03]);
  const mid = l.clone().lerp(r, 0.5);
  putW(P.wallet, mid.clone().add(new THREE.Vector3(0, 0, 0.02)), 0.1, 0, 0, 1.3);
  P.wallet.userData.setOpen(lerp(0.15, 2.6, easeOut(seg(t, 40.15, 40.4))));
  const mv = mothFly(t, 40.42, mid, [0.55, 0.5, 0.22], F);
  camK('gas', [[0, [0.95, 1.5, 3.35], [0.9, 1.38, 1.2], 40], [54, [0.94, 1.5, 3.05], [0.9, 1.4, 1.2], 40]], L);
});

// 25 STREET: raise price
shot(1254, 1302, (L, t) => {
  ctx.light('day', 'street', 0, 2); S.street.visible = true;
  put(P.sign, 'street', 0.55, 0.16, 2.1, -0.3);
  P.sign.userData.uncross();
  const sk = seg(t, 42.22, 42.3);
  const stck = P.sign.userData.sticker; stck.visible = t > 42.22; stck.scale.setScalar(lerp(1.7, 1, easeOut(sk)));
  const slap = pose({ rShX: 1.5, rShZ: -0.2, rEl: 0.1, spine: 0.1, twist: -0.3 });
  ch(C.hero, 'street', -0.5, 0.16, 2.35, 0.4, seqPose(t, [[0, POSES.stand], [42.0, pose({ rShX: 2.5, rShZ: 0.3, rEl: 0.6 })], [42.2, slap], [42.65, POSES.hipsHands]], 0.1), t > 42.3 ? { mouth: 'grin', eyes: 'open', brow: 0.15 } : { mouth: 'smile' });
  camK('street', [[0, [0.0, 1.35, 6.5], [0.0, 1.1, 2.1], 40], [48, [0.0, 1.35, 6.0], [0.0, 1.1, 2.1], 40]], L, shake(t, 42.24, 0.03, 0.25));
});

// 26 STREET: nobody said no
const LINE = [['c1', -1.5, 2.3], ['c2', -0.5, 2.7], ['c3', 0.5, 2.3], ['owner', 1.5, 2.7]];
shot(1302, 1342, (L, t) => {
  ctx.light('day', 'street', 0, 2); S.street.visible = true;
  LINE.forEach(([n, x, z], i) => {
    const t0 = 43.48 + i * 0.15;
    const nod = t > t0 ? Math.abs(Math.sin((t - t0) * 9)) * 0.28 * Math.exp(-(t - t0) * 1.5) : 0;
    ch(C[n], 'street', x, 0.16, z, 0, pose({ ...POSES.thumb, headX: nod }), t > t0 ? { eyes: 'happy', mouth: 'grin' } : { mouth: 'smile' });
    if (t > t0) pop('YES!', t0, headPt(C[n], 0.5), { size: 92, fill: i % 2 ? '#5fe07a' : '#ffd21f', rot: (i % 2 ? 0.1 : -0.1), dur: 1.25, drift: -10, dy: -30 });
  });
  camK('street', [[0, [-0.7, 1.6, 8.9], [-0.4, 1.4, 2.5], 42], [40, [0.7, 1.6, 8.9], [0.4, 1.4, 2.5], 42]], L);
});

// 27 STREET: lady asks
shot(1342, 1398, (L, t) => {
  ctx.light('day', 'street', 0, 2); S.street.visible = true;
  ch(C.lady, 'street', -0.72, 0.16, 2.3, HP - 0.35, seqPose(t, [[0, POSES.stand], [45.35, pose({ ...POSES.give, rShX: 1.1, rEl: 0.3 })]]), talk(t, [[44.98, 46.3]], { mouth: 'smile', browY: 0.01 }));
  ch(C.hero, 'street', 0.72, 0.16, 2.3, -HP + 0.35, pose({ headX: Math.sin(t * 6) * 0.06 }), { mouth: 'smile', eyes: 'open' });
  camK('street', [[0, [0, 1.45, 7.7], [0, 1.2, 2.3], 40], [56, [0, 1.45, 7.3], [0, 1.2, 2.3], 40]], L);
});

// 28 STREET: no card - pockets
shot(1398, 1444, (L, t) => {
  ctx.light('day', 'street', 0, 2); S.street.visible = true;
  ch(C.lady, 'street', -0.72, 0.16, 2.3, HP - 0.35, POSES.armsCross, { mouth: 'line', brow: 0.15, eyes: 'open' });
  const pat = t < 47.05;
  const patP = pose({ lShZ: 0.18, rShZ: 0.18, lEl: 0.4 + Math.abs(Math.sin(t * 16)) * 0.3, rEl: 0.4 + Math.abs(Math.cos(t * 16)) * 0.3, headX: 0.25 });
  ch(C.hero, 'street', 0.72, 0.16, 2.3, seqPose(t, [[0, pose({ y: -HP + 0.35 })], [46.75, pose({ y: -0.25 })]]).y, seqPose(t, [[0, patP], [47.05, POSES.shrug]], 0.12), t > 47.05 ? { eyes: 'open', mouth: 'grit', brow: -0.3, blush: true } : { eyes: 'wide', mouth: 'open', open: 0.4 });
  P.pockets.forEach(p => (p.visible = t > 47.05));
  if (t > 47.05) C.hero.sweatDrop(F, 1412);
  const pk = V('street', 0.72, 0.85, 2.45);
  mothFly(t, 47.15, pk, [-0.2, 0.55, 0.5], F);
  camK('street', [[0, [0.45, 1.35, 6.2], [0.4, 1.15, 2.3], 40], [46, [0.5, 1.4, 5.6], [0.45, 1.2, 2.3], 40]], L);
});

// 29 STUDIO rays: made it real
shot(1444, 1490, (L, t) => {
  ctx.light('studio', 'studio', 0, 0, { extent: 6 }); S.studio.visible = true; S.studioCyc.visible = false; S.rays.visible = true;
  S.rays.rotation.z = t * 0.15;
  const tie = pose({ lShX: 2.7, rShX: 2.7, lEl: 2.3, rEl: 2.3, lShZ: 0.5, rShZ: 0.5, headX: 0.05 });
  const fin = pose({ ...POSES.fist, lShX: 0.9, lEl: 1.9, lShZ: 0.2, rShX: 0.9, rEl: 1.9, rShZ: 0.2, spine: -0.05 });
  ch(C.hero, 'studio', 0, 0, 0, 0, seqPose(t, [[0, POSES.stand], [48.15, tie], [48.55, fin]], 0.12), { eyes: 'open', brow: 0.4, mouth: t > 48.6 ? 'grin' : 'line' });
  C.hero.band.visible = t > 48.3;
  C.hero.bandTails.forEach((b, i) => (b.rotation.x = 0.3 + Math.sin(t * 14 + i) * 0.25));
  camK('studio', [[0, [0, 0.8, 3.9], [0, 1.42, 0], 44], [46, [0, 0.95, 3.2], [0, 1.45, 0], 44]], L);
});

// 30 ROOM: register laptop
shot(1490, 1535, (L, t) => {
  ctx.light('office', 'room', 1.5, -1, { extent: 6 }); S.room.visible = true;
  hideExtras(); C.hero.band.visible = true;
  put(P.laptop, 'room', 2.2, 0.75, -1.75, -0.2); P.laptop.userData.setApproved(t > 50.46);
  const click = t > 50.3 && t < 50.5 ? Math.sin(seg(t, 50.3, 50.5) * PI) * 0.12 : 0;
  ch(C.hero, 'room', 1.4, 0, -1.25, HP - 0.35, pose({ lShX: 1.2 - click, lEl: 0.55, lShZ: -0.25, spine: 0.22, headX: 0.25 }), { eyes: 'open', mouth: t > 50.5 ? 'grin' : 'smile', brow: t > 50.5 ? 0 : 0.2 });
  camK('room', [[0, [2.9, 1.42, -0.35], [2.15, 0.98, -1.8], 40], [45, [2.78, 1.35, -0.6], [2.15, 0.98, -1.8], 40]], L);
});

// 31 STREET: name on the truck
shot(1535, 1576, (L, t) => {
  ctx.light('day', 'street', 0, 6, { extent: 10 }); S.street.visible = true;
  put(P.truck, 'street', 0.5, 0.04, 6.6, HP);
  const k = clamp(seg(t, 51.25, 52.2));
  P.truck.userData.reveal(k);
  const edge = 0.5 - 3.15 + 4.8 * k;
  const ph = walkPh(Math.max(0, edge + 3.5), 0.45);
  const stroke = Math.sin(t * 13);
  ch(C.hero, 'street', edge - 0.15, 0.04, 8.75, PI, add(walk(ph, 0.4), { rShX: 2.2 + stroke * 0.25, rEl: 0.5, lShX: 2.0 + stroke * 0.25, lEl: 0.6, lShZ: 0.1, rShZ: 0.1 }), { mouth: 'grin' });
  C.hero.band.visible = true;
  put(P.roller, 'street', edge + 0.05, 2.15 + stroke * 0.35, 8.0, 0, 0, 0);
  camK('street', [[0, [-0.25, 2.2, 18.6], [-0.2, 2.1, 7.9], 40], [41, [-0.1, 2.2, 18.0], [-0.1, 2.1, 7.9], 40]], L);
});

// 32 ROOM: printing cards
shot(1576, 1621, (L, t) => {
  ctx.light('office', 'room', 1.5, -1, { extent: 6 }); S.room.visible = true;
  put(P.printer, 'room', 2.45, 0.75, -1.65, 0);
  put(P.laptop, 'room', 1.65, 0.75, -1.85, 0.35); P.laptop.userData.setApproved(true);
  ch(C.hero, 'room', 2.1, 0, -2.6, 0, seqPose(t, [[0, POSES.stand], [52.85, pose({ ...POSES.thumb, rShX: 1.35 })]]), { eyes: t > 52.85 ? 'happy' : 'open', mouth: 'grin' });
  C.hero.band.visible = true;
  const out = V('room', 2.45, 0.97, -1.4);
  P.cards.forEach((cd, i) => {
    const t0 = 52.6 + i * 0.085; if (t < t0) return;
    const u = t - t0;
    const v = out.clone().add(new THREE.Vector3((rnd(i, 1) - 0.5) * 2.2 * u, 0.6 * u + (rnd(i, 2) - 0.2) * 1.2 * u - 1.4 * u * u, 3.2 * u));
    putW(cd, v, -0.9 + u * (3 + rnd(i, 3) * 6), u * (rnd(i, 4) - 0.5) * 8, u * 5 * (rnd(i, 5) - 0.5), 1.0);
  });
  camK('room', [[0, [2.3, 1.35, 1.25], [2.3, 1.05, -1.9], 42], [45, [2.3, 1.33, 0.95], [2.3, 1.07, -1.9], 42]], L);
});

// 33 STREET: congrats
shot(1621, 1673, (L, t) => {
  ctx.light('day', 'street', 0, 7, { extent: 10 }); S.street.visible = true;
  put(P.truck, 'street', 0.5, 0.04, 6.6, HP); P.truck.userData.reveal(1);
  const burst = t > 54.6;
  ch(C.hero, 'street', 0.05, 0.04, 9.5, 0, burst ? pose({ ...POSES.cheer, y: Math.abs(Math.sin((t - 54.6) * 7)) * 0.12 }) : pose({ rShX: 1.15, rEl: 1.2, rShZ: -0.18, lShX: 1.15, lEl: 1.2, lShZ: -0.18, headX: 0.15 }), burst ? { eyes: 'happy', mouth: 'grin' } : { eyes: 'wide', mouth: 'smile' });
  C.hero.band.visible = true;
  if (!burst) {
    const l = handPt(C.hero, 'l', [0, -0.1, 0.03]), r = handPt(C.hero, 'r', [0, -0.1, 0.03]); const mid = l.lerp(r, 0.5);
    const swell = 1.3 + 0.35 * seg(t, 54.1, 54.6) + Math.sin(t * 30) * 0.04 * seg(t, 54.3, 54.6);
    putW(P.wallet, mid, 0.1, 0, 0, swell); P.wallet.userData.setOpen(0.3);
  }
  const src = V('street', 0.05, 1.2, 9.85);
  for (let i = 0; i < 16; i++) {
    const t0 = 54.6 + rnd(i, 9) * 0.08; if (t < t0) continue;
    const u = t - t0;
    const v = src.clone().add(new THREE.Vector3((rnd(i, 1) - 0.5) * 4 * u, (3.2 + rnd(i, 2) * 2.5) * u - 3.2 * u * u, (rnd(i, 3) - 0.2) * 2.2 * u));
    if (v.y < 0.1) v.y = 0.1;
    putW(P.bills[i], v, u * 5 * rnd(i, 4), u * 4, u * 6 * (rnd(i, 5) - 0.5), 1.3);
  }
  confetti('street', 0.05, 9.4, t, 54.03, 2.2, 5.5);
  camK('street', [[0, [0.1, 1.8, 18.9], [0.1, 2.0, 8.0], 42], [52, [0.1, 1.8, 18.3], [0.1, 2.0, 8.0], 42]], L);
});

// 34 STREET golden: finale + couch drop
const CREW = [['red', -1.85, POSES.hipsHands], ['hero', -0.62, POSES.armsCross], ['buddy', 0.62, POSES.thumb], ['yellow', 1.85, POSES.wave]];
shot(1673, 1800, (L, t) => {
  ctx.light('golden', 'street', 0, 8, { extent: 11 }); S.street.visible = true;
  put(P.truck, 'street', 0.5, 0.04, 6.4, HP); P.truck.userData.reveal(1);
  const hit = 58.62;
  CREW.forEach(([n, x, p], i) => {
    if (n === 'hero') {
      if (t < hit) { ch(C.hero, 'street', x, 0.04, 11.0, 0.05, p, { eyes: 'open', mouth: 'grin', brow: 0.1 }); C.hero.band.visible = true; }
      else { const u = t - hit; ch(C.hero, 'street', x, 0.04, 11.0, 0.05, pose({ ...SQUASH, lHipX: Math.sin(u * 14) * 0.25 * Math.exp(-u * 1.5), rHipX: -Math.sin(u * 14) * 0.25 * Math.exp(-u * 1.5) }), { eyes: 'x', mouth: 'open', noLife: true }); }
      return;
    }
    let q = { ...p }; if (n === 'yellow') q.rShZ += Math.sin(t * 9) * 0.3;
    const look = t > hit + 0.1;
    if (look) q = pose({ ...POSES.shock, headX: 0.35, headY: (x < -0.62 ? 0.7 : -0.7) * (Math.abs(x + 0.62) < 1.5 ? 1 : 0.6) });
    ch(C[n], 'street', x, 0.04, 11.0 + (i % 2 ? -0.25 : 0), (x + 0.62) * -0.12, q, look ? { eyes: 'wide', mouth: 'open', open: 0.9 } : { eyes: n === 'buddy' ? 'happy' : 'open', mouth: 'grin' });
  });
  if (t > 58.38) {
    const u = clamp((t - 58.38) / (hit - 58.38));
    const y = t < hit ? lerp(8.5, 0.32, u * u) : 0.32 + Math.abs(Math.sin((t - hit) * 16)) * 0.12 * Math.exp(-(t - hit) * 6);
    put(P.couch, 'street', -0.62, y, 10.95, 0.12, 0, t < hit ? 0.1 * (1 - u) : 0);
    if (t > hit) stars(V('street', -0.62, 1.4, 11.0), t, 0.5);
  }
  const sh = shake(t, hit, 0.16, 0.55);
  camK('street', [[0, [0, 1.6, 17.2], [0, 1.95, 8.5], 42], [130, [0, 2.2, 19.4], [0, 2.05, 8.5], 42]], L, sh);
});

export function frame(f, c) {
  F = f; const t = f / 30;
  hideExtras();
  S.windows.forEach(w => w.userData.open(0)); S.nDoor.rotation.y = 0;
  P.truck.userData.wheels.forEach(w => (w.rotation.x = 0)); P.car.userData.body.position.set(0, 0, 0);
  const s = SHOTS.find(s => f >= s.a && f < s.b) || SHOTS[SHOTS.length - 1];
  s.fn(f - s.a, t);
  ctx.camera.updateMatrixWorld(true);
  for (const d of ctx.dyn) if (d.anchor) { const [x, y] = ctx.project(d.anchor); d.x = clamp(x, 170, 910); d.y = clamp(y + (d.dy ?? 0), 180, 1500); }
}
export const SHOT_LIST = SHOTS;
