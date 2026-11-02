// VOID: the "fun fact" stage. Deep blue gradient backdrop with soft light + faint twinkles; a cute pink cartoon
// brain (dot eyes, tiny smile, stubby arms) holding a golden stopwatch, OR the big golden stopwatch alone.
// state: voidShow 'brain' | 'watch' | 'none', brainBob (m, added to y), brainBlink 0..1, brainIdle 0..1 (float/sway),
//        watchHand (rad, 0 = 12 o'clock, clockwise as seen by the camera), watchPress 0..1 (crown pushed in).
import * as THREE from 'three';
import { mat, tex, clamp, lerp, smooth, noise1, boneGeometry, placeBone } from './lib.js';
import { VOID } from './layout.js';
import { goldCanvas, glowDiscCanvas } from './set_tex2.js';
import { starCanvas } from './set_rest_tex.js';
import { mergeGeos } from './set_util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function msh(geo, material, name, { cast = true, receive = true } = {}) { const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; m.name = `set.void.${name}`; return m; }

// ---------------------------------------------------------------- 3D value noise (deterministic)
function h3(x, y, z, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1440662683) + Math.imul((seed | 0) + 1013, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vn3(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const c = (a, b, d) => h3(ix + a, iy + b, iz + d, seed), L = (a, b, t) => a + (b - a) * t;
  return L(L(L(c(0, 0, 0), c(1, 0, 0), sx), L(c(0, 1, 0), c(1, 1, 0), sx), sy), L(L(c(0, 0, 1), c(1, 0, 1), sx), L(c(0, 1, 1), c(1, 1, 1), sx), sy), sz);
}
const fbm3 = (x, y, z, seed) => (vn3(x, y, z, seed) * 0.68 + vn3(x * 2.1 + 9.1, y * 2.1 + 3.3, z * 2.1 + 7.7, seed + 17) * 0.32);

// ---------------------------------------------------------------- the brain surface: direction -> point (+ groove)
// Ellipsoid (flatter below) + lower side bulges + the deep middle groove over the top + "gyri": rounded sausages
// between the contour lines of a smooth 3D noise (that is what makes the squiggly brain folds).
const BR = { A: 0.29, B: 0.232, C: 0.25 };
const FACE = V(0, 0.02, -1).normalize();
export function brainPoint(d) {
  let x = d.x * BR.A, y = d.y * BR.B, z = d.z * BR.C;
  if (y < 0) y *= 0.8;
  const side = Math.exp(-(((d.y + 0.28) / 0.32) ** 2)) * Math.abs(d.x);
  x *= 1 + 0.07 * side; z *= 1 + 0.04 * side;
  // middle groove: over the top + back, fading out on the forehead (the face lives there) and underneath
  const fis = Math.exp(-((d.x / 0.075) ** 2)) * sstep(-0.25, 0.25, d.y) * (1 - sstep(-0.62, -0.88, d.z) * 0.85);
  // folds
  const n = fbm3(d.x * 1.8 + 4.3, d.y * 2.15 + 1.7, d.z * 1.8 + 2.9, 11);
  const c = n * 4.8, f = c - Math.floor(c);
  const xx = 1 - 2 * Math.min(f, 1 - f), bump = Math.sqrt(Math.max(0, 1 - xx * xx));     // round sausage cross-section
  const faceK = sstep(0.9, 0.985, d.dot(FACE));
  const depth = 0.105 * (1 - bump) * (1 - 0.9 * faceK);
  const s = 1 - depth - 0.15 * fis;
  return { p: V(x * s, y * s, z * s), g: Math.max(1 - bump, fis * 1.4) };
}

function brainGeometry(detail = 30) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const crest = new THREE.Color('#ffaac4'), groove = new THREE.Color('#b0335f'), c = new THREE.Color();
  const d = V();
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const { p: q, g: gr } = brainPoint(d);
    p.setXYZ(i, q.x, q.y, q.z);
    c.copy(crest).lerp(groove, clamp(gr * 1.1) ** 1.6);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- the stopwatch (faces -Z, dial centre at origin)
// No numbers: white dial, tick marks, a sub-dial, red/black hand, gold case + bezel, crown + bow on top.
export function makeStopwatch(env, s = 1, name = 'watch') {
  const g = new THREE.Group(); g.name = `set.void.${name}`;
  const gold = mat(tex(goldCanvas({ base: '#f2c040', seed: 13, amount: 22 })), { rough: 0.2, metal: 1.0 }); gold.envMap = env; gold.envMapIntensity = 1.7;
  const goldD = mat(tex(goldCanvas({ base: '#c8902a', seed: 15, amount: 20 })), { rough: 0.3, metal: 1.0 }); goldD.envMap = env; goldD.envMapIntensity = 1.4;
  const dialM = mat('#f7f3ea', { rough: 0.5 });
  const inkM = mat('#1c1c22', { rough: 0.6 });
  const redM = mat('#e01c1c', { rough: 0.35, emissive: '#7a0606', emissiveIntensity: 0.4 });
  const R = 0.225 * s, CR = 0.262 * s, D = 0.075 * s;
  const caseG = new THREE.CylinderGeometry(CR, CR * 0.97, D, 44, 1); caseG.rotateX(Math.PI / 2);
  g.add(msh(caseG, gold, `${name}Case`));
  const back = new THREE.CylinderGeometry(CR * 0.9, CR * 0.86, 0.02 * s, 36, 1); back.rotateX(Math.PI / 2); back.translate(0, 0, D / 2 + 0.01 * s);
  g.add(msh(back, goldD, `${name}Back`));
  const bez = msh(new THREE.TorusGeometry(CR - 0.016 * s, 0.024 * s, 8, 56), gold, `${name}Bezel`); bez.position.z = -D / 2; g.add(bez);
  // dial + ticks + inner ring + sub-dial (all facing -Z)
  const dial = new THREE.CircleGeometry(R, 56); dial.rotateY(Math.PI); dial.translate(0, 0, -D / 2 - 0.002 * s);
  g.add(msh(dial, dialM, `${name}Dial`, { cast: false }));
  const zt = -D / 2 - 0.0042 * s;
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, major = i % 5 === 0;
    const len = (major ? 0.042 : 0.02) * s, w = (major ? 0.011 : 0.0055) * s, r = R - 0.012 * s - len / 2;
    const b = new THREE.BoxGeometry(w, len, 0.002 * s); b.rotateZ(a); b.translate(-Math.sin(a) * r, Math.cos(a) * r, zt);
    ticks.push(b);
  }
  for (let i = 0; i < 10; i++) {                          // sub-dial ticks
    const a = (i / 10) * Math.PI * 2, r = 0.042 * s, sy = -0.088 * s;
    const b = new THREE.BoxGeometry(0.004 * s, 0.01 * s, 0.002 * s); b.rotateZ(a); b.translate(-Math.sin(a) * r, sy + Math.cos(a) * r, zt - 0.0008 * s);
    ticks.push(b);
  }
  const ring = new THREE.RingGeometry(0.163 * s, 0.167 * s, 64); ring.rotateY(Math.PI); ring.translate(0, 0, zt);
  ticks.push(ring);
  const sub = new THREE.RingGeometry(0.052 * s, 0.056 * s, 32); sub.rotateY(Math.PI); sub.translate(0, -0.088 * s, zt);
  ticks.push(sub);
  g.add(msh(mergeGeos(ticks), inkM, `${name}Ticks`, { cast: false }));
  const subFace = new THREE.CircleGeometry(0.052 * s, 28); subFace.rotateY(Math.PI); subFace.translate(0, -0.088 * s, zt + 0.0003 * s);
  g.add(msh(subFace, mat('#e6e0d4', { rough: 0.5 }), `${name}SubDial`, { cast: false }));
  const subHand = new THREE.BoxGeometry(0.004 * s, 0.036 * s, 0.002 * s); subHand.translate(0, -0.088 * s + 0.016 * s, zt - 0.0015 * s);
  g.add(msh(subHand, inkM, `${name}SubHand`, { cast: false }));
  // the hand: pivot rotates about +Z (rotation.z = angle -> clockwise as seen from -Z)
  const hand = new THREE.Group(); hand.name = `set.void.${name}HandPivot`; hand.position.z = -D / 2 - 0.011 * s; g.add(hand);
  const hs = new THREE.Shape();
  hs.moveTo(-0.0065 * s, 0); hs.lineTo(0.0065 * s, 0); hs.lineTo(0.0022 * s, R - 0.02 * s); hs.lineTo(0, R - 0.008 * s); hs.lineTo(-0.0022 * s, R - 0.02 * s); hs.closePath();
  const hg = new THREE.ShapeGeometry(hs); hg.rotateY(Math.PI);
  const hm = msh(hg, redM, `${name}Hand`, { cast: true }); hm.material.side = THREE.DoubleSide; hand.add(hm);
  const tail = new THREE.BoxGeometry(0.009 * s, 0.06 * s, 0.003 * s); tail.translate(0, -0.03 * s, 0.001 * s);
  const cw = new THREE.CylinderGeometry(0.017 * s, 0.017 * s, 0.004 * s, 14); cw.rotateX(Math.PI / 2); cw.translate(0, -0.055 * s, 0.001 * s);
  const cap = new THREE.CylinderGeometry(0.015 * s, 0.015 * s, 0.01 * s, 14); cap.rotateX(Math.PI / 2); cap.translate(0, 0, -0.003 * s);
  hand.add(msh(mergeGeos([tail, cw, cap]), inkM, `${name}HandTail`));
  // glass dome
  const glassM = mat('#ffffff', { rough: 0.05, metal: 0.0, transparent: true, opacity: 0.13, flat: false }); glassM.envMap = env; glassM.envMapIntensity = 2.2;
  const dome = new THREE.SphereGeometry(R + 0.006 * s, 40, 6, 0, Math.PI * 2, 0, 0.62); dome.rotateX(-Math.PI / 2); dome.scale(1, 1, 0.3);
  dome.translate(0, 0, -D / 2 - 0.004 * s + (R + 0.006 * s) * Math.cos(0.62) * 0.3);
  const glass = msh(dome, glassM, `${name}Glass`, { cast: false, receive: false }); glass.renderOrder = 2; glass.userData.noAudit = true; g.add(glass);
  // crown assembly on top: pendant (fixed) + bow ring (fixed) + push crown (moves with watchPress)
  const top = CR;
  const pend = new THREE.CylinderGeometry(0.03 * s, 0.036 * s, 0.03 * s, 12); pend.translate(0, top + 0.012 * s, 0);
  g.add(msh(pend, goldD, `${name}Pendant`));
  const bow = msh(new THREE.TorusGeometry(0.072 * s, 0.014 * s, 8, 22), gold, `${name}Bow`); bow.position.set(0, top + 0.055 * s, 0); g.add(bow);
  const crown = new THREE.Group(); crown.name = `set.void.${name}Crown`; g.add(crown);
  const stem = new THREE.CylinderGeometry(0.016 * s, 0.016 * s, 0.05 * s, 10); stem.translate(0, top + 0.03 * s, 0);
  const knob = new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 0.04 * s, 14); knob.translate(0, top + 0.07 * s, 0);
  const btn = new THREE.CylinderGeometry(0.026 * s, 0.03 * s, 0.022 * s, 14); btn.translate(0, top + 0.1 * s, 0);
  crown.add(msh(mergeGeos([stem, knob]), gold, `${name}CrownKnob`), msh(btn, goldD, `${name}CrownButton`));
  // side pushers at +-40 deg
  for (const sd of [-1, 1]) {
    const a = sd * 0.72, pg = new THREE.CylinderGeometry(0.017 * s, 0.02 * s, 0.04 * s, 10);
    pg.translate(0, CR + 0.016 * s, 0); pg.rotateZ(a);
    g.add(msh(pg, gold, `${name}Pusher`));
  }
  g.userData = { hand, crown, s };
  return g;
}

// ---------------------------------------------------------------- place
export function buildVoid(env) {
  const group = new THREE.Group(); group.name = 'set.void';
  const [ox, oz] = VOID.origin, cy = VOID.brain[1];

  // backdrop: big sphere, vertex-colour gradient (glow behind the subject, darker toward the edges/below)
  const sg = new THREE.SphereGeometry(22, 48, 24);
  {
    const p = sg.attributes.position, col = new Float32Array(p.count * 3);
    const glow = new THREE.Color('#3450c8'), mid = new THREE.Color('#14216e'), edge = new THREE.Color('#070b2c'), below = new THREE.Color('#04061a'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const d = V(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const k = Math.max(0, d.z * 0.85 + d.y * 0.18);
      c.copy(edge).lerp(mid, sstep(0.0, 0.75, k)).lerp(glow, sstep(0.82, 1.0, k) * 0.85);
      if (d.y < 0) c.lerp(below, sstep(0, 0.6, -d.y));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const sky = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.name = 'set.void.backdrop'; sky.renderOrder = -10; sky.userData.noAudit = true; sky.position.set(ox, cy, oz); group.add(sky);
  const glowT = tex(glowDiscCanvas(64), { nearest: false });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: '#4a6ae0', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.set(4.2, 4.2, 1); halo.position.set(ox, cy + 0.1, oz + 3.5); halo.name = 'set.void.halo'; halo.userData.noAudit = true; halo.renderOrder = -9; group.add(halo);
  // faint twinkles (deterministic positions, twinkle with t)
  const starT = tex(starCanvas(32), { nearest: false });
  const stars = [];
  for (let i = 0; i < 34; i++) {
    const a = noise1(i * 3.17, 4) * 0.5 + 0.5, b = noise1(i * 5.31 + 7, 5) * 0.5 + 0.5;
    const x = ox + (((i * 0.618) % 1) - 0.5) * 3.6 + (a - 0.5) * 0.4;
    const y = cy - 1.1 + (((i * 0.4142 + 0.13) % 1)) * 2.4 + (b - 0.5) * 0.3;
    const z = oz + 1.2 + ((i * 0.7321) % 1) * 3.2;
    if (Math.abs(x - ox) < 0.45 && Math.abs(y - cy) < 0.35 && z < oz + 2) continue;   // not right behind the brain
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starT, color: i % 4 === 0 ? '#ffe2a8' : '#c8d8ff', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.position.set(x, y, z); sp.userData = { base: 0.035 + ((i * 0.37) % 1) * 0.06, ph: i * 1.7, f: 1.2 + ((i * 0.53) % 1) * 2.2, noAudit: true };
    sp.name = 'set.void.twinkle'; group.add(sp); stars.push(sp);
  }

  // ---------------- the brain
  const brain = new THREE.Group(); brain.name = 'set.void.brain'; group.add(brain);
  const body = new THREE.Group(); brain.add(body);            // body sways inside brain (brain = position)
  const brainM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0, flatShading: true, emissive: new THREE.Color('#5a1028'), emissiveIntensity: 0.25 });
  brainM.envMap = env; brainM.envMapIntensity = 0.35;
  const bm = msh(brainGeometry(40), brainM, 'brainBody'); body.add(bm);
  // face: eyes + highlights + smile + blush
  const onSurf = (dx, dy, out = 0) => { const d = V(dx, dy, -1).normalize(); const { p } = brainPoint(d); return { p: p.add(d.clone().multiplyScalar(out)), d }; };
  const eyeM = mat('#0e0e14', { rough: 0.15, flat: false }); eyeM.envMap = env; eyeM.envMapIntensity = 0.8;
  const hiM = mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6, flat: false });
  const eyes = [];
  for (const sd of [-1, 1]) {
    const { p, d } = onSurf(sd * 0.26, 0.17, 0.004);
    const eg = new THREE.Group(); eg.position.copy(p); eg.lookAt(p.clone().add(d)); body.add(eg);
    const e = msh(new THREE.SphereGeometry(1, 12, 10), eyeM, 'brainEye'); e.scale.set(0.026, 0.034, 0.014); eg.add(e);
    const h = msh(new THREE.SphereGeometry(1, 8, 6), hiM, 'brainEyeHi', { cast: false }); h.scale.setScalar(0.0075); h.position.set(0.008, 0.012, 0.012); eg.add(h);
    eyes.push(eg);
  }
  {
    const { p, d } = onSurf(0, 0.02, 0.006);
    const arc = 0.85 * Math.PI;
    const sm = msh(new THREE.TorusGeometry(0.036, 0.0062, 6, 14, arc), mat('#4a0e22', { rough: 0.6 }), 'brainSmile', { cast: false });
    const sg2 = new THREE.Group(); sg2.position.copy(p); sg2.lookAt(p.clone().add(d)); body.add(sg2);
    sm.rotation.z = -Math.PI / 2 - arc / 2; sm.position.y = 0.022; sg2.add(sm);
  }
  const blushM = mat('#ff5c86', { rough: 0.8, transparent: true, opacity: 0.55 });
  for (const sd of [-1, 1]) {
    const { p, d } = onSurf(sd * 0.44, 0.05, 0.004);
    const b = msh(new THREE.CircleGeometry(0.03, 12), blushM, 'brainBlush', { cast: false }); b.scale.set(1.25, 0.8, 1);
    const bg = new THREE.Group(); bg.position.copy(p); bg.lookAt(p.clone().add(d)); bg.add(b); body.add(bg);
  }
  // stubby arms (two segments each) + mitten hands
  const armM = mat('#f48cae', { rough: 0.5 });
  const bone = boneGeometry(0.026, 0.023, 7);
  const arms = {};
  for (const side of ['R', 'L']) {
    const up = msh(bone, armM, `brainArm${side}1`), lo = msh(bone, armM, `brainArm${side}2`);
    const el = msh(new THREE.SphereGeometry(0.025, 8, 6), armM, `brainElbow${side}`);
    const hd = msh(new THREE.SphereGeometry(0.036, 9, 7), armM, `brainHand${side}`);
    const th = msh(new THREE.SphereGeometry(0.017, 7, 5), armM, `brainThumb${side}`);
    body.add(up, lo, el, hd, th);
    arms[side] = { up, lo, el, hd, th };
  }
  const finger = msh(new THREE.CapsuleGeometry(0.011, 0.03, 3, 6), armM, 'brainFinger'); body.add(finger);
  // the small stopwatch in the right hand (brain's right = +X = screen left)
  const small = makeStopwatch(env, 0.4, 'brainWatch');
  small.position.set(0.09, -0.165, -0.33); small.rotation.set(0.12, 0.16, -0.22); body.add(small);

  // ---------------- the big stopwatch alone
  const watch = makeStopwatch(env, 1.0, 'bigWatch');
  watch.position.set(...VOID.watch); group.add(watch);

  // ---------------- lights: warm key (soft shadow) from the upper left (as seen by the camera), two coloured rims
  const key = new THREE.DirectionalLight('#fff2e2', 2.6); key.name = 'set.void.key';
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.012; key.shadow.radius = 4;
  key.userData.dir = V(0.42, 0.72, -0.56).normalize();
  group.add(key, key.target);
  const rimA = new THREE.DirectionalLight('#5a9cff', 3.2); rimA.position.set(ox - 3, cy + 2.2, oz + 4); rimA.target.position.set(ox, cy, oz); rimA.name = 'set.void.rimA';
  const rimB = new THREE.DirectionalLight('#ff7ec4', 2.2); rimB.position.set(ox + 3.4, cy + 0.6, oz + 3.2); rimB.target.position.set(ox, cy, oz); rimB.name = 'set.void.rimB';
  const hemi = new THREE.HemisphereLight('#9ab0ff', '#1c1238', 1.0); hemi.name = 'set.void.hemi';
  const front = new THREE.PointLight('#ffe8d8', 1.6, 0, 2); front.position.set(ox - 0.2, cy + 0.35, oz - 1.4); front.name = 'set.void.front';
  group.add(rimA, rimA.target, rimB, rimB.target, hemi, front);

  // pose the arms (brain-local), with an idle wiggle of the raised hand
  const poseArms = (t, idle) => {
    const w = Math.sin(t * 5.2) * 0.012 * idle;
    const set = (A, sh, el, hd, th) => {
      placeBone(A.up, sh, el); placeBone(A.lo, el, hd); A.el.position.copy(el); A.hd.position.copy(hd); A.th.position.copy(th);
    };
    set(arms.R, V(0.215, -0.095, -0.14), V(0.248, -0.15, -0.255), V(0.205, -0.19, -0.335), V(0.182, -0.178, -0.37));
    const hL = V(-0.215 + w * 0.3, 0.0 + w, -0.31);
    set(arms.L, V(-0.215, -0.09, -0.14), V(-0.252, -0.11, -0.262), hL, hL.clone().add(V(0.026, -0.008, -0.012)));
    finger.position.copy(hL).add(V(-0.004, 0.044, -0.004)); finger.rotation.set(0, 0, 0.12 + w * 2);
  };
  poseArms(0, 0);

  const props = { brain, brainBody: body, watch, brainWatch: small, eyes };
  const look = { background: '#0b1440', fog: null, exposure: 1.0, shadowCenter: [ox, cy, oz], shadowRadius: 0.9 };
  return {
    name: 'void', group, props, look, key,
    defaults: () => ({ voidShow: 'watch', brainBob: 0, brainBlink: 0, brainIdle: 1, watchHand: 0, watchPress: 0 }),
    update(t, s) {
      const show = s.voidShow;
      brain.visible = show === 'brain';
      watch.visible = show === 'watch';
      const idle = clamp(s.brainIdle ?? 1);
      brain.position.set(VOID.brain[0], VOID.brain[1] + (s.brainBob || 0) + Math.sin(t * 2.1) * 0.012 * idle, VOID.brain[2]);
      body.rotation.set(Math.sin(t * 1.3 + 1) * 0.02 * idle, Math.sin(t * 0.9) * 0.05 * idle, Math.sin(t * 1.6) * 0.035 * idle);
      const bl = clamp(s.brainBlink || 0);
      for (const e of eyes) e.scale.set(1, lerp(1, 0.14, bl), 1);
      poseArms(t, idle);
      for (const w of [watch, small]) {
        w.userData.hand.rotation.z = s.watchHand || 0;
        w.userData.crown.position.y = -clamp(s.watchPress || 0) * 0.026 * w.userData.s;
      }
      for (const sp of stars) {
        const u = sp.userData, k = 0.55 + 0.45 * Math.sin(t * u.f + u.ph);
        sp.scale.setScalar(u.base * (0.6 + 0.8 * k)); sp.material.opacity = 0.25 + 0.6 * k;
      }
    },
  };
}
