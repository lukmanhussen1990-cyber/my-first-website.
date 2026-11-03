// Low-poly characters in the reference style: faceted polyhedron heads, black pixel eyes,
// simple 3D mouth/brow pieces swapped per expression, blocky hands, pixel-textured clothes.
import * as THREE from 'three';
import { mat, box, cyl, group, canvasTex, aim2 } from './lib.js';

const TW = 0.62, TH = 0.74, TD = 0.36;
const AW = 0.19, AD = 0.21, UA = 0.38, FA = 0.3;
const THIGH = 0.42, SHIN = 0.42;
const HR = 0.34;                      // head radius
export const DIM = { TW, TH, TD, AW, UA, FA, THIGH, SHIN, HIP_Y: THIGH + SHIN, HR };

// ---------- pixel cloth / material patterns (canvas, nearest filtered) ----------
export function pix(draw, rep = 2, size = 32) {
  const t = canvasTex(size, size, draw, { nearest: true });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
  return new THREE.MeshLambertMaterial({ map: t });
}
const P = {
  check: (a, b) => pix((c) => { c.fillStyle = a; c.fillRect(0, 0, 32, 32); c.fillStyle = b; for (let i = 0; i < 32; i += 8) { c.fillRect(i, 0, 2, 32); c.fillRect(0, i, 32, 2); } }),
  noise: (a, b, k = 60) => pix((c) => { c.fillStyle = a; c.fillRect(0, 0, 32, 32); c.fillStyle = b; for (let i = 0; i < k; i++) c.fillRect((i * 37) % 32, (i * 53 + (i >> 2)) % 32, 2, 2); }),
  border: (a, b, gold) => pix((c) => { c.fillStyle = a; c.fillRect(0, 0, 32, 32); c.fillStyle = b; c.fillRect(0, 24, 32, 8); c.fillStyle = gold; for (let x = 0; x < 32; x += 4) c.fillRect(x, 26, 2, 2); c.fillRect(0, 23, 32, 1); for (let i = 0; i < 12; i++) c.fillRect((i * 11) % 30, (i * 7) % 20, 2, 2); }, 1),
  diamonds: (a, b) => pix((c) => { c.fillStyle = a; c.fillRect(0, 0, 32, 32); c.fillStyle = b; for (let y = 0; y < 32; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 32; x += 8) { c.fillRect(x + 3, y + 1, 2, 2); c.fillRect(x + 1, y + 3, 6, 2); c.fillRect(x + 3, y + 5, 2, 2); } }),
  stripes: (a, b) => pix((c) => { c.fillStyle = a; c.fillRect(0, 0, 32, 32); c.fillStyle = b; for (let x = 0; x < 32; x += 6) c.fillRect(x, 0, 2, 32); }),
};
export const PATTERNS = P;
const M = (m) => (typeof m === 'number' ? mat(m) : m);

// ---------- faceted head with 3D pixel features ----------
const headGeo = new THREE.IcosahedronGeometry(HR, 1);
const black = mat(0x111111), white = mat(0xffffff, { basic: true });
function makeFace(head, skinHex, opts = {}) {
  const F = { eyes: {}, mouths: {}, brows: [], extras: {} };
  const Z = 0.285;
  for (const s of [1, -1]) {
    const g = group(head, s * 0.105, 0.045, Z);
    F.eyes[s] = {
      dot: box(0.055, 0.1, 0.04, black, 0, 0, 0, g, false),
      white: box(0.1, 0.13, 0.03, white, 0, 0, -0.005, g, false),
      pupil: box(0.045, 0.06, 0.04, black, 0, 0, 0.01, g, false),
      shut: box(0.085, 0.022, 0.04, black, 0, -0.01, 0, g, false),
      lid: box(0.075, 0.03, 0.045, mat(opts.lid ?? skinHex), 0, 0.035, 0.005, g, false),
      bag: box(0.07, 0.015, 0.03, mat(0x5a3a2a), 0, -0.07, -0.005, g, false),
      happy: group(g),
      g,
    };
    box(0.05, 0.018, 0.04, black, -0.018, 0, 0, F.eyes[s].happy, false).rotation.z = 0.6;
    box(0.05, 0.018, 0.04, black, 0.018, 0, 0, F.eyes[s].happy, false).rotation.z = -0.6;
    const br = box(0.1, 0.024, 0.035, mat(opts.brow ?? 0x1a120c), s * 0.105, 0.145, Z - 0.01, head, false);
    br.userData.s = s; F.brows.push(br);
    F.extras['blush' + s] = box(0.08, 0.035, 0.02, mat(0xff7a9a), s * 0.17, -0.05, Z - 0.03, head, false);
  }
  const mg = group(head, 0, -0.115, Z - 0.01);
  F.mg = mg;
  F.mouths.flat = box(0.11, 0.022, 0.035, black, 0, 0, 0, mg, false);
  const oval = (r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 10), black); m.rotation.x = Math.PI / 2; m.scale.set(1, 1, 1.35); mg.add(m); return m; };
  F.mouths.o = oval(0.038); F.mouths.bigO = oval(0.06); F.mouths.small = oval(0.022);
  const arc = (dir, w = 0.13) => { const g = group(mg); for (let i = 0; i < 5; i++) { const u = (i - 2) / 2; box(w / 5 + 0.006, 0.02, 0.035, black, u * w / 2, dir * (u * u) * 0.035, 0, g, false); } return g; };
  F.mouths.smile = arc(1); F.mouths.frown = arc(-1); F.mouths.bigSmile = arc(1, 0.18);
  const grin = group(mg); box(0.17, 0.07, 0.03, black, 0, 0, 0, grin, false); box(0.15, 0.045, 0.035, white, 0, 0, 0.005, grin, false);
  for (let i = -2; i <= 2; i++) box(0.004, 0.045, 0.04, mat(0xcccccc), i * 0.03, 0, 0.006, grin, false);
  F.mouths.grin = grin;
  const smirk = group(mg); box(0.09, 0.02, 0.035, black, 0.01, 0, 0, smirk, false).rotation.z = 0.22; box(0.025, 0.02, 0.035, black, 0.06, 0.014, 0, smirk, false);
  F.mouths.smirk = smirk;
  const wavy = group(mg); for (let i = 0; i < 5; i++) box(0.026, 0.018, 0.035, black, (i - 2) * 0.024, (i % 2) * 0.016, 0, wavy, false);
  F.mouths.wavy = wavy;
  const shout = group(mg); const so = oval(0.07); shout.add(so); box(0.08, 0.02, 0.04, mat(0xd04050), 0, -0.035, 0.01, shout, false);
  F.mouths.shout = shout;
  return F;
}
function applyFace(F, e) {
  const eyes = e.eyes || 'dot';
  for (const s of [1, -1]) {
    const E = F.eyes[s];
    for (const k of ['dot', 'white', 'pupil', 'shut', 'lid', 'happy']) E[k].visible = false;
    E.bag.visible = !!e.tired;
    E.g.scale.setScalar(e.eyeScale ?? 1);
    if (eyes === 'dot' || eyes === 'sly') { E.dot.visible = true; E.dot.scale.set(1, eyes === 'sly' ? 0.5 : 1, 1); E.dot.position.y = eyes === 'sly' ? -0.022 : 0; if (eyes === 'sly' || e.tired) E.lid.visible = true; }
    if (eyes === 'wide') { E.white.visible = true; E.pupil.visible = true; const p = e.pupil || [0, 0]; E.pupil.position.set(p[0] * 0.025, p[1] * 0.03, 0.01); }
    if (eyes === 'shut') E.shut.visible = true;
    if (eyes === 'happy') E.happy.visible = true;
    if (e.look && (eyes === 'dot' || eyes === 'sly')) E.dot.position.x = e.look * 0.02;
    else E.dot.position.x = 0;
  }
  for (const k in F.mouths) F.mouths[k].visible = false;
  (F.mouths[e.mouth || 'flat'] || F.mouths.flat).visible = true;
  F.mg.scale.setScalar(e.mouthScale ?? 1);
  const b = e.brows || 'neutral';
  for (const br of F.brows) {
    const s = br.userData.s;
    br.rotation.z = b === 'worried' ? -s * 0.4 : b === 'angry' ? s * 0.4 : b === 'raised' ? 0 : 0;
    br.position.y = b === 'raised' ? 0.175 : b === 'worried' ? 0.155 : 0.145;
  }
  F.extras.blush1.visible = F.extras['blush-1'].visible = !!e.blush;
}

// ---------- humanoid ----------
function makeHuman(spec) {
  const tw = spec.tw ?? TW, td = spec.td ?? TD;
  const skinM = mat(spec.skin);
  const root = new THREE.Group(); root.name = spec.name;
  const hips = group(root, 0, THIGH + SHIN, 0);
  const body = group(hips);
  const parts = { shirt: [], pants: [], shoes: [] };
  parts.shirt.push(box(tw, TH, td, M(spec.shirt), 0, TH / 2, 0, body));
  const neck = group(body, 0, TH, 0);
  const head = group(neck);
  const headMat = new THREE.MeshLambertMaterial({ color: spec.skin, flatShading: true });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.scale.set(0.95, 1.06, 0.9); headMesh.position.y = HR + 0.02; headMesh.castShadow = true;
  head.add(headMesh);
  const faceRoot = group(head, 0, HR + 0.02, 0);
  const F = makeFace(faceRoot, spec.skin, spec.faceOpts || {});
  box(0.2, 0.08, 0.18, skinM, 0, 0.0, 0, head);                       // neck
  const arms = {};
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const shoulder = group(body, s * (tw / 2 + AW / 2 + 0.006), TH - 0.08, 0);
    parts.shirt.push(box(AW, UA + 0.04, AD, M(spec.sleeve ?? spec.shirt), 0, -UA / 2 + 0.02, 0, shoulder));
    const elbow = group(shoulder, 0, -UA, 0);
    const fore = box(AW * 0.96, FA, AD * 0.96, M(spec.forearm ?? spec.sleeve ?? spec.shirt), 0, -FA / 2, 0, elbow);
    if ((spec.forearm ?? spec.sleeve ?? spec.shirt) !== spec.skin) parts.shirt.push(fore);
    box(AW * 1.05, 0.17, AD, skinM, 0, -FA - 0.085, 0, elbow);          // blocky hand
    const thumb = box(0.07, 0.1, 0.07, skinM, 0, -FA - 0.06, 0.12, elbow); thumb.visible = false;
    const hand = group(elbow, 0, -FA - 0.1, 0);
    arms[k] = { shoulder, elbow, hand, thumb, s };
  }
  const legs = {};
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const hip = group(hips, s * 0.15, 0, 0);
    const th = box(0.28, THIGH + 0.02, 0.32, M(spec.pants), 0, -THIGH / 2, 0, hip);
    const knee = group(hip, 0, -THIGH, 0);
    const sh = box(0.27, SHIN - 0.1, 0.31, M(spec.shin ?? spec.pants), 0, -(SHIN - 0.1) / 2, 0, knee);
    if (spec.pants !== spec.skin) parts.pants.push(th);
    if ((spec.shin ?? spec.pants) !== spec.skin) parts.pants.push(sh);
    parts.shoes.push(box(0.29, 0.12, 0.4, M(spec.shoes ?? 0x2a2420), 0, -SHIN + 0.06, 0.04, knee));
    legs[k] = { hip, knee, s };
  }
  const ch = { name: spec.name, root, hips, body, neck, head, headMesh, headMat, arms, legs, F, parts, extras: {}, skinM, skin: spec.skin };
  // nude: every clothing piece swaps to skin (used for the censored gag only)
  const orig = new Map();
  for (const list of Object.values(parts)) for (const m of list) orig.set(m, m.material);
  ch.nude = (on) => { for (const [m, mt] of orig) m.material = on ? skinM : mt; if (ch.onNude) ch.onNude(on); };
  ch.setFace = (e) => { applyFace(F, e); headMat.color.set(spec.skin); if (e.tint) headMat.color.lerp(new THREE.Color(e.tint[0]), e.tint[1]); };
  ch.reset = () => {
    root.visible = false; root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1);
    hips.position.set(0, THIGH + SHIN, 0); hips.rotation.set(0, 0, 0);
    body.rotation.set(0, 0, 0); neck.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); head.position.set(0, 0, 0); head.visible = true;
    for (const a of Object.values(arms)) { aim2(a.shoulder, a.elbow, [a.s * 0.1, -1, 0], [a.s * 0.06, -1, 0.06]); a.thumb.visible = false; }
    for (const l of Object.values(legs)) aim2(l.hip, l.knee, [0, -1, 0], [0, -1, 0]);
    ch.nude(false);
    if (ch.onReset) ch.onReset();
    ch.setFace({});
  };
  return ch;
}

export const pose = {
  arm(ch, side, dU, dL) { const a = ch.arms[side]; aim2(a.shoulder, a.elbow, dU, dL || dU); },
  proud(ch) { for (const a of Object.values(ch.arms)) aim2(a.shoulder, a.elbow, [a.s * 0.75, -0.62, -0.12], [-a.s * 0.75, -0.55, 0.15]); ch.body.rotation.x = -0.08; },
  clap(ch, t) { const k = Math.abs(Math.sin(t * 9)) * 0.12; for (const a of Object.values(ch.arms)) aim2(a.shoulder, a.elbow, [a.s * 0.1, -0.6, 0.8], [-a.s * (0.55 - k), 0.25, 0.75]); },
  sit(ch, seatY = 0.5) { ch.hips.position.y = seatY + 0.15; for (const l of Object.values(ch.legs)) aim2(l.hip, l.knee, [l.s * 0.05, -0.05, 1], [0, -1, 0.05]); },
  walk(ch, phase, amp = 1) {
    const s = Math.sin(phase) * 0.45 * amp;
    aim2(ch.legs.L.hip, ch.legs.L.knee, [0, -1, s], [0, -1, s - Math.max(0, -Math.cos(phase)) * 0.45 * amp]);
    aim2(ch.legs.R.hip, ch.legs.R.knee, [0, -1, -s], [0, -1, -s - Math.max(0, Math.cos(phase)) * 0.45 * amp]);
    ch.hips.position.y = THIGH + SHIN - Math.abs(Math.cos(phase)) * 0.03 * amp;
    for (const a of Object.values(ch.arms)) aim2(a.shoulder, a.elbow, [a.s * 0.12, -1, -s * a.s * 0.8], [a.s * 0.06, -1, -s * a.s * 0.8 + 0.15]);
  },
};

// ---------- the cast ----------
const HAIR = 0x1b130e;
function hairCap(parent, color, opts = {}) {
  const g = new THREE.SphereGeometry(HR * (opts.r ?? 1.06), 8, 4, 0, Math.PI * 2, 0, Math.PI * (opts.cover ?? 0.42));
  const m = new THREE.Mesh(g, mat(color)); m.scale.set(0.98, 1.1, 0.95); m.position.y = HR + 0.03 + (opts.dy ?? 0); m.rotation.x = opts.tilt ?? -0.25; m.castShadow = true;
  parent.add(m); return m;
}

export function makeYou() {
  const skin = 0xa8714a;
  const shirt = P.check('#1f5fa8', '#3f86d4');
  const ch = makeHuman({ name: 'you', skin, tw: 0.74, td: 0.44, shirt, sleeve: shirt, forearm: shirt, pants: P.noise('#b9a27a', '#a48c64'), shoes: 0x5a3418, faceOpts: { lid: skin } });
  const H = ch.head, B = ch.body;
  hairCap(H, HAIR, { cover: 0.36, tilt: -0.35 });
  // blocky beard + mustache
  const bm = mat(0x24170f);
  const beard = group(H, 0, HR + 0.02, 0);
  box(0.3, 0.1, 0.12, bm, 0, -0.27, 0.19, beard); box(0.1, 0.22, 0.14, bm, 0.24, -0.15, 0.15, beard); box(0.1, 0.22, 0.14, bm, -0.24, -0.15, 0.15, beard);
  box(0.2, 0.08, 0.1, bm, 0, -0.2, 0.26, beard); box(0.16, 0.04, 0.05, bm, 0, -0.07, 0.3, beard);
  // belly, collar, buttons, belt
  const belly = box(0.6, 0.38, 0.12, shirt, 0, 0.25, 0.22, B); ch.parts.shirt.push(belly);
  const collar = [box(0.2, 0.07, 0.06, mat(0xffffff), -0.1, TH - 0.03, 0.23, B, false), box(0.2, 0.07, 0.06, mat(0xffffff), 0.1, TH - 0.03, 0.23, B, false)];
  collar[0].rotation.z = -0.35; collar[1].rotation.z = 0.35;
  const buttons = []; for (let i = 0; i < 4; i++) buttons.push(box(0.03, 0.03, 0.02, mat(0xffffff), 0, 0.17 + i * 0.13, 0.285, B, false));
  const belt = box(0.76, 0.06, 0.46, mat(0x3a2414), 0, 0.03, 0, B, false);
  ch.onNude = (on) => { for (const m of collar.concat(buttons, [belt])) m.visible = !on; };
  ch.onReset = () => { for (const m of collar.concat(buttons, [belt])) m.visible = true; };
  return ch;
}

export function makeMom() {
  const skin = 0x9a6440;
  const tee = P.noise('#f4f1ea', '#e4dfd4', 30);
  const jeans = P.noise('#3a5a8c', '#2f4c78', 70);
  const ch = makeHuman({ name: 'mom', skin, shirt: tee, sleeve: mat(0xe0a63a), forearm: mat(0xe0a63a), pants: jeans, shoes: skin, faceOpts: { lid: skin, brow: 0x241a14 } });
  const H = ch.head, B = ch.body;
  // modern look: open mustard cardigan over a white tee, slim jeans, slide sandals
  const cardi = P.check('#e0a63a', '#c98f28');
  for (const s of [1, -1]) box(0.2, TH - 0.02, TD + 0.04, cardi, s * (TW / 2 - 0.08), TH / 2, 0, B, false);
  box(TW + 0.04, TH - 0.02, 0.05, cardi, 0, TH / 2, -TD / 2 - 0.02, B, false);
  box(0.06, 0.32, 0.02, mat(0xc98f28), 0.13, TH - 0.2, TD / 2 + 0.03, B, false); box(0.06, 0.32, 0.02, mat(0xc98f28), -0.13, TH - 0.2, TD / 2 + 0.03, B, false);
  box(0.03, 0.03, 0.02, mat(0xffffff), 0.13, 0.25, TD / 2 + 0.04, B, false);
  for (const l of Object.values(ch.legs)) {       // slide sandals: sole + wide strap over the bare foot
    box(0.3, 0.04, 0.42, mat(0xf2f2f2), 0, -SHIN + 0.02, 0.05, l.knee);
    box(0.31, 0.06, 0.14, mat(0x2b2b33), 0, -SHIN + 0.08, 0.1, l.knee, false);
  }
  hairCap(H, 0x221812, { cover: 0.45, tilt: -0.2 });
  const bun = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), mat(0x221812)); bun.position.set(0, HR + 0.12, -0.3); H.add(bun);
  box(0.12, 0.012, 0.02, mat(0xbdb6ae), 0.1, HR * 2 + 0.03, 0.12, H, false);
  return ch;
}

export function makeCousin() {
  const skin = 0xc9906a;
  const top = P.diamonds('#f1e6d2', '#c9a55a');
  const ch = makeHuman({ name: 'cousin', skin, shirt: top, sleeve: mat(0xf6efe2), forearm: skin, pants: mat(0x1d1d22), shin: skin, shoes: 0xc9a227, faceOpts: { lid: skin, brow: 0x2a1a10 } });
  const H = ch.head;
  const hairM = mat(0x2b1a12);
  hairCap(H, 0x2b1a12, { cover: 0.44, tilt: -0.38 });
  box(0.66, 0.95, 0.12, hairM, 0, HR - 0.3, -0.28, H);
  box(0.12, 0.7, 0.14, hairM, 0.33, HR - 0.15, -0.05, H); box(0.12, 0.7, 0.14, hairM, -0.33, HR - 0.15, -0.05, H);
  // sunglasses resting on her head (can slide down onto her eyes)
  const shades = group(H, 0, HR * 2 + 0.02, 0.18); shades.rotation.x = -0.5;
  const sm = mat(0x111111, { std: true, roughness: 0.15, metalness: 0.3 });
  box(0.14, 0.08, 0.03, sm, 0.1, 0, 0, shades); box(0.14, 0.08, 0.03, sm, -0.1, 0, 0, shades); box(0.08, 0.02, 0.03, mat(0xc9a227), 0, 0.02, 0, shades);
  box(0.02, 0.02, 0.28, mat(0xc9a227), 0.18, 0.02, -0.14, shades); box(0.02, 0.02, 0.28, mat(0xc9a227), -0.18, 0.02, -0.14, shades);
  ch.extras.shades = shades;
  const gold = mat(0xe8b931, { std: true, metalness: 0.9, roughness: 0.2 });
  for (const s of [1, -1]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.013, 6, 12), gold); hoop.position.set(s * 0.32, HR - 0.08, 0.02); hoop.rotation.y = Math.PI / 2; H.add(hoop); }
  box(0.66, 0.06, 0.4, gold, 0, 0.06, 0, ch.body, false);              // gold belt
  // designer handbag (generic pixel monogram, gold clasp)
  const bag = group(null);
  box(0.36, 0.26, 0.14, pix((c) => { c.fillStyle = '#8a4b2a'; c.fillRect(0, 0, 32, 32); c.fillStyle = '#e8c27a'; for (let y = 2; y < 32; y += 8) for (let x = (y % 16 ? 6 : 2); x < 32; x += 8) { c.fillRect(x, y, 3, 3); c.fillRect(x + 1, y - 1, 1, 5); } }, 1), 0, 0, 0, bag);
  box(0.1, 0.05, 0.02, gold, 0, 0.06, 0.08, bag, false);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 6, 12, Math.PI), mat(0x6b3a1f)); handle.position.y = 0.13; bag.add(handle);
  ch.extras.bag = bag;
  ch.onReset = () => { shades.position.set(0, HR * 2 + 0.02, 0.18); shades.rotation.x = -0.5; };
  return ch;
}

export function makeGrandma() {
  const skin = 0x9c6a48;
  const cardi = P.check('#b9a4d8', '#a58fc8');
  const ch = makeHuman({ name: 'grandma', skin, shirt: cardi, sleeve: cardi, forearm: cardi, pants: mat(0x6f7378), shoes: 0x3a3a44, faceOpts: { lid: skin, brow: 0xdddddd } });
  box(0.2, 0.3, 0.02, mat(0xffffff), 0, TH - 0.17, TD / 2 + 0.01, ch.body, false);
  const H = ch.head;
  hairCap(H, 0xf2f2f2, { cover: 0.45, tilt: -0.1 });
  const bun = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat(0xf2f2f2)); bun.position.set(0, HR + 0.1, -0.3); H.add(bun);
  const gm = mat(0x3a2a1a);
  const gl = group(H, 0, HR + 0.065, 0.31);
  for (const s of [1, -1]) { box(0.13, 0.02, 0.02, gm, s * 0.105, 0.06, 0, gl, false); box(0.13, 0.02, 0.02, gm, s * 0.105, -0.05, 0, gl, false); box(0.02, 0.11, 0.02, gm, s * 0.105 + 0.065, 0.005, 0, gl, false); box(0.02, 0.11, 0.02, gm, s * 0.105 - 0.065, 0.005, 0, gl, false); }
  // old candybar phone
  const phone = group(null);
  box(0.11, 0.24, 0.04, mat(0x3b4048), 0, 0, 0, phone); box(0.08, 0.07, 0.01, mat(0x9fd18f, { basic: true }), 0, 0.06, 0.022, phone, false);
  for (let i = 0; i < 9; i++) box(0.018, 0.012, 0.01, mat(0xdddddd), -0.025 + (i % 3) * 0.025, -0.02 - Math.floor(i / 3) * 0.025, 0.022, phone, false);
  ch.extras.phone = phone;
  return ch;
}

export function makeGuest(kind) {
  const looks = {
    a: { skin: 0xb07850, shirt: 0x1f2a4a, pants: 0x1f2a4a, tie: 0xb3122e, hair: 0x1b130e },
    b: { skin: 0xe0b08a, shirt: 0xb3122e, pants: 0xb3122e, hair: 0x5a2f18, gown: true },
    c: { skin: 0x8d5a3b, shirt: 0x55595f, pants: 0x55595f, tie: 0x2f8f7a, hair: 0x1b130e },
    d: { skin: 0xd3a17a, shirt: 0xd9b24a, pants: 0xd9b24a, hair: 0x1b130e, gown: true },
  }[kind];
  const ch = makeHuman({ name: 'guest' + kind, skin: looks.skin, shirt: looks.shirt, pants: looks.pants, shoes: 0x111111 });
  const H = ch.head;
  hairCap(H, looks.hair, { cover: looks.gown ? 0.5 : 0.36 });
  if (looks.gown) { const g = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.55, 0.86, 6), mat(looks.shirt)); g.position.y = -0.42; ch.hips.add(g); box(0.6, 0.8, 0.12, mat(looks.hair), 0, HR - 0.25, -0.27, H); }
  if (looks.tie) { box(0.07, 0.4, 0.02, mat(looks.tie), 0, TH - 0.25, TD / 2 + 0.01, ch.body, false); box(0.18, 0.3, 0.02, mat(0xffffff), 0, TH - 0.15, TD / 2 + 0.005, ch.body, false); }
  const glass = group(null);
  cyl(0.05, 0.03, 0.14, 8, mat(0xdff4ff, { transparent: true, opacity: 0.45 }), 0, 0.1, 0, glass);
  cyl(0.04, 0.03, 0.07, 8, mat(kind === 'b' || kind === 'd' ? 0xf2d36b : 0x8a1f2e), 0, 0.07, 0, glass);
  cyl(0.008, 0.008, 0.1, 5, mat(0xdff4ff), 0, -0.02, 0, glass); cyl(0.04, 0.04, 0.01, 8, mat(0xdff4ff), 0, -0.07, 0, glass);
  ch.extras.glass = glass;
  return ch;
}
