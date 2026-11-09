// Low-poly faceted characters with a simple joint rig, expressive faces and props.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, clamp, lerp, hash } from './util.js';
import * as TX from './textures.js';

export function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, flatShading: true, ...o });
}

// Merge + jitter vertices for an organic faceted look (drops UVs, so only for untextured parts).
export function facet(geo, amt = 0, seed = 1) {
  let g = geo.clone();
  g.deleteAttribute('normal');
  if (g.attributes.uv) g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  if (amt > 0) {
    const r = mulberry32(seed);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) + (r() - 0.5) * amt, p.getY(i) + (r() - 0.5) * amt, p.getZ(i) + (r() - 0.5) * amt);
    }
  }
  g.computeVertexNormals();
  return g;
}

export function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

function limbGeo(rTop, rBot, len, segs = 6, jitter = 0, seed = 1, keepUV = false) {
  let g = new THREE.CylinderGeometry(rTop, rBot, len, segs, 1);
  g.translate(0, -len / 2, 0);
  if (!keepUV) g = facet(g, jitter, seed);
  return g;
}

const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'handL', 'shR', 'elR', 'handR', 'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR'];

// Blink schedule: deterministic, roughly every 2.6-4.2 s.
function blinkAt(t, seed) {
  let period = 3.2;
  const k = Math.floor(t / period);
  for (let j = k - 1; j <= k; j++) {
    const tb = j * period + hash(j * 7.3 + seed) * 1.6;
    const d = t - tb;
    if (d >= 0 && d < 0.16) return Math.sin((d / 0.16) * Math.PI);
  }
  return 0;
}

export function makeHuman(cfg) {
  const c = Object.assign({
    skin: '#eab38a', shirt: '#2f6fe0', pants: '#22304d', shoes: '#f4f4f2', sole: '#9a9a9a',
    hair: '#5a3620', hairStyle: 'short', glasses: false, width: 1, legLen: 1, seed: 1,
    shirtMap: null, pantsMap: null, eyeColor: '#151515',
  }, cfg);
  const h = { cfg: c, j: {}, face: {} };
  const skin = mat(c.skin, { roughness: 0.62 });
  const shirtMat = c.shirtMap ? new THREE.MeshStandardMaterial({ map: c.shirtMap, roughness: 0.85, flatShading: true }) : mat(c.shirt, { roughness: 0.8 });
  const pantsMat = c.pantsMap ? new THREE.MeshStandardMaterial({ map: c.pantsMap, roughness: 0.85, flatShading: true }) : mat(c.pants, { roughness: 0.85 });
  const shoeMat = mat(c.shoes, { roughness: 0.55 });
  const soleMat = mat(c.sole, { roughness: 0.7 });
  const hairMat = mat(c.hair, { roughness: 0.7 });
  const dark = mat(c.eyeColor, { roughness: 0.3 });
  const mouthMat = mat('#3a0f0c', { roughness: 0.5 });
  const tongueMat = mat('#d0625a', { roughness: 0.5 });
  h.mats = { skin, shirt: shirtMat, pants: pantsMat, shoe: shoeMat, hair: hairMat };
  const W = c.width, L = c.legLen, sd = c.seed * 100;

  const root = new THREE.Group(); h.root = root;
  const body = new THREE.Group(); root.add(body); h.body = body;
  const thigh = 0.40 * L, shin = 0.39 * L, footH = 0.07;
  const hipY = thigh + shin + footH + 0.03;
  h.hipY = hipY;
  const J = (name, parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); h.j[name] = g; return g; };

  const hips = J('hips', body, 0, hipY, 0);
  const pelvis = mesh(facet(new THREE.CylinderGeometry(0.168 * W, 0.178 * W, 0.17, 8), 0.008, sd + 1), pantsMat);
  pelvis.scale.z = 0.66; pelvis.position.y = 0.0; hips.add(pelvis);
  const spine = J('spine', hips, 0, 0.06, 0);
  let belly = mesh(c.shirtMap ? new THREE.CylinderGeometry(0.19 * W, 0.172 * W, 0.28, 8) : facet(new THREE.CylinderGeometry(0.19 * W, 0.172 * W, 0.28, 8), 0.01, sd + 2), shirtMat);
  belly.scale.z = 0.64; belly.position.y = 0.11; spine.add(belly);
  const chest = J('chest', spine, 0, 0.22, 0);
  let chestM = mesh(c.shirtMap ? new THREE.CylinderGeometry(0.215 * W, 0.19 * W, 0.28, 8) : facet(new THREE.CylinderGeometry(0.215 * W, 0.19 * W, 0.28, 8), 0.01, sd + 3), shirtMat);
  chestM.scale.z = 0.64; chestM.position.y = 0.1; chest.add(chestM);
  // shoulder caps
  for (const s of [-1, 1]) {
    const cap = mesh(facet(new THREE.IcosahedronGeometry(0.075 * W, 0), 0.006, sd + 4 + s), shirtMat);
    cap.scale.set(1, 0.85, 1); cap.position.set(s * 0.19 * W, 0.215, 0); chest.add(cap);
  }
  h.torsoMeshes = [belly, chestM];
  const neck = J('neck', chest, 0, 0.25, 0);
  const neckM = mesh(limbGeo(0.052, 0.058, 0.11, 6, 0.004, sd + 5).translate(0, 0.1, 0), skin);
  neck.add(neckM);
  const head = J('head', neck, 0, 0.06, 0);
  const headC = new THREE.Group(); headC.position.y = 0.155; head.add(headC); h.headC = headC;
  const headM = mesh(facet(new THREE.IcosahedronGeometry(0.155, 1), 0.012, sd + 6), skin);
  headM.scale.set(0.92, 1.1, 0.98); headC.add(headM);
  // ears
  for (const s of [-1, 1]) {
    const ear = mesh(facet(new THREE.IcosahedronGeometry(0.032, 0), 0.004, sd + 7 + s), skin);
    ear.scale.set(0.45, 1, 0.75); ear.position.set(s * 0.14, 0.0, -0.005); headC.add(ear);
  }
  // nose
  const nose = mesh(facet(new THREE.ConeGeometry(0.024, 0.05, 4), 0.003, sd + 9), mat(c.skin, { roughness: 0.6 }));
  nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.025, 0.155); headC.add(nose);

  // ---- face ----
  const surfZ = (x, y) => 0.152 * Math.sqrt(Math.max(0.05, 1 - (x / 0.143) ** 2 - (y / 0.17) ** 2));
  const eyes = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group();
    const ex = s * 0.054, ey = 0.028;
    eg.position.set(ex, ey, surfZ(ex, ey) - 0.004);
    eg.rotation.y = s * 0.28;
    const box = mesh(new THREE.BoxGeometry(0.034, 0.044, 0.02), dark, { cast: false });
    const hl = mesh(new THREE.BoxGeometry(0.009, 0.009, 0.004), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.35 }), { cast: false });
    hl.position.set(0.007, 0.011, 0.011); box.add(hl);
    const arc = mesh(new THREE.TorusGeometry(0.017, 0.0055, 4, 10, Math.PI), dark, { cast: false });
    arc.position.set(0, -0.008, 0.006); arc.visible = false;
    eg.add(box, arc);
    headC.add(eg);
    eyes.push({ g: eg, box, arc, side: s, base: eg.position.clone() });
  }
  h.face.eyes = eyes;
  // mouth variants
  const mouth = new THREE.Group();
  const my = -0.078;
  mouth.position.set(0, my, surfZ(0, my) - 0.006);
  headC.add(mouth);
  const disc = new THREE.CylinderGeometry(0.032, 0.032, 0.02, 12); disc.rotateX(Math.PI / 2);
  const mO = mesh(disc, mouthMat, { cast: false });
  const tongue = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10).rotateX(Math.PI / 2), tongueMat, { cast: false });
  tongue.position.set(0, -0.012, 0.002); tongue.scale.set(1, 0.55, 1); mO.add(tongue);
  const halfDisc = new THREE.CylinderGeometry(0.036, 0.036, 0.02, 12, 1, false, Math.PI / 2, Math.PI); halfDisc.rotateX(Math.PI / 2);
  const mGrin = mesh(halfDisc, mouthMat, { cast: false });
  const teeth = mesh(new THREE.BoxGeometry(0.05, 0.009, 0.02), mat('#fbf7ee', { roughness: 0.4 }), { cast: false });
  teeth.position.set(0, -0.004, 0.002); mGrin.add(teeth);
  const mSmile = mesh(new THREE.TorusGeometry(0.03, 0.0065, 4, 12, Math.PI), mouthMat, { cast: false }); mSmile.rotation.z = Math.PI;
  const mFrown = mesh(new THREE.TorusGeometry(0.026, 0.006, 4, 12, Math.PI), mouthMat, { cast: false }); mFrown.position.y = -0.014;
  const mFlat = mesh(new THREE.BoxGeometry(0.046, 0.008, 0.016), mouthMat, { cast: false });
  const mSmirk = mesh(new THREE.TorusGeometry(0.024, 0.006, 4, 10, Math.PI * 0.8), mouthMat, { cast: false });
  mSmirk.rotation.z = Math.PI * 1.05 + 0.25; mSmirk.position.set(0.01, 0.006, 0);
  for (const m of [mO, mGrin, mSmile, mFrown, mFlat, mSmirk]) { m.visible = false; mouth.add(m); }
  h.face.mouth = { g: mouth, o: mO, grin: mGrin, smile: mSmile, frown: mFrown, flat: mFlat, smirk: mSmirk };

  // ---- hair ----
  if (c.hairStyle === 'short') {
    const cap = mesh(facet(new THREE.SphereGeometry(0.168, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), 0.014, sd + 10), hairMat);
    cap.scale.set(0.97, 0.95, 1.04); cap.position.set(0, 0.03, -0.01); cap.rotation.x = -0.32; headC.add(cap);
    const fringe = mesh(facet(new THREE.BoxGeometry(0.2, 0.05, 0.06, 2, 1, 1), 0.012, sd + 11), hairMat);
    fringe.position.set(0.01, 0.125, 0.105); fringe.rotation.x = 0.5; fringe.rotation.z = -0.08; headC.add(fringe);
    for (const s of [-1, 1]) {
      const side = mesh(facet(new THREE.BoxGeometry(0.03, 0.08, 0.1), 0.01, sd + 12 + s), hairMat);
      side.position.set(s * 0.132, 0.06, -0.01); headC.add(side);
    }
  } else if (c.hairStyle === 'greySides') {
    const band = mesh(facet(new THREE.SphereGeometry(0.163, 10, 4, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, Math.PI * 0.3, Math.PI * 0.3), 0.012, sd + 13), hairMat);
    band.scale.set(0.97, 1.08, 1.03); band.position.y = 0.0; headC.add(band);
    const top = mesh(facet(new THREE.SphereGeometry(0.16, 8, 3, 0, Math.PI * 2, 0, Math.PI * 0.22), 0.01, sd + 14), hairMat);
    top.scale.set(0.92, 0.9, 0.95); top.position.set(0, 0.03, -0.02); headC.add(top);
    for (const s of [-1, 1]) {
      const tuft = mesh(facet(new THREE.IcosahedronGeometry(0.045, 0), 0.01, sd + 15 + s), hairMat);
      tuft.scale.set(0.8, 1.1, 1.2); tuft.position.set(s * 0.135, 0.07, -0.04); headC.add(tuft);
    }
  } else if (c.hairStyle === 'bun') {
    const cap = mesh(facet(new THREE.SphereGeometry(0.172, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), 0.012, sd + 16), hairMat);
    cap.scale.set(0.98, 1.0, 1.05); cap.position.set(0, 0.02, -0.012); cap.rotation.x = -0.28; headC.add(cap);
    const bun = mesh(facet(new THREE.IcosahedronGeometry(0.075, 1), 0.01, sd + 17), hairMat);
    bun.position.set(0, 0.15, -0.1); headC.add(bun);
    for (const s of [-1, 1]) {
      const curl = mesh(facet(new THREE.IcosahedronGeometry(0.05, 0), 0.01, sd + 18 + s), hairMat);
      curl.position.set(s * 0.13, 0.04, 0.02); headC.add(curl);
    }
  }
  // ---- glasses ----
  if (c.glasses) {
    const gl = new THREE.Group(); h.glasses = gl;
    const frame = mat('#121212', { roughness: 0.25, metalness: 0.3, flatShading: false });
    const lensMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0, envMapIntensity: 2.5 });
    h.lensMat = lensMat;
    for (const s of [-1, 1]) {
      const ex = s * 0.054, ey = 0.028, ez = surfZ(ex, ey) + 0.026;
      const ring = mesh(new THREE.TorusGeometry(0.034, 0.0055, 6, 16), frame, { cast: false });
      ring.position.set(ex, ey, ez); ring.rotation.y = s * 0.2; gl.add(ring);
      const lens = mesh(new THREE.CircleGeometry(0.033, 16), lensMat, { cast: false });
      lens.position.set(ex, ey, ez); lens.rotation.y = s * 0.2; gl.add(lens);
      const temple = mesh(new THREE.BoxGeometry(0.006, 0.006, 0.15), frame, { cast: false });
      temple.position.set(s * 0.122, ey + 0.004, 0.065); temple.rotation.y = s * 0.12; gl.add(temple);
    }
    const bridge = mesh(new THREE.BoxGeometry(0.04, 0.006, 0.006), frame, { cast: false });
    bridge.position.set(0, 0.04, surfZ(0, 0.04) + 0.032); gl.add(bridge);
    headC.add(gl);
  }

  // ---- arms ----
  const upper = 0.29, fore = 0.27;
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'L' : 'R';
    const sh = J('sh' + side, chest, s * 0.215 * W, 0.215, 0);
    sh.add(mesh(limbGeo(0.064 * W, 0.056 * W, upper + 0.02, 6, 0.006, sd + 20 + s, !!c.shirtMap), shirtMat));
    const el = J('el' + side, sh, 0, -upper, 0);
    el.add(mesh(facet(new THREE.IcosahedronGeometry(0.057 * W, 0), 0.004, sd + 22 + s), shirtMat));
    el.add(mesh(limbGeo(0.055 * W, 0.047 * W, fore, 6, 0.006, sd + 24 + s, !!c.shirtMap), shirtMat));
    const cuff = mesh(limbGeo(0.05 * W, 0.05 * W, 0.03, 6, 0.0, sd + 26 + s), c.cuff ? mat(c.cuff) : shirtMat);
    cuff.position.y = -fore + 0.03; el.add(cuff);
    const hand = J('hand' + side, el, 0, -fore, 0);
    const palm = mesh(facet(new THREE.IcosahedronGeometry(0.05, 0), 0.006, sd + 28 + s), skin);
    palm.scale.set(0.82, 1.15, 0.6); palm.position.y = -0.045; hand.add(palm);
    const thumb = mesh(limbGeo(0.014, 0.012, 0.045, 5, 0.002, sd + 30 + s), skin);
    thumb.position.set(s * -0.025, -0.02, 0.018); thumb.rotation.z = s * 0.7; thumb.rotation.x = -0.4; hand.add(thumb);
    const finger = mesh(limbGeo(0.0125, 0.011, 0.07, 5, 0.0, sd + 32 + s), skin);
    finger.position.set(s * -0.012, -0.08, 0.0); finger.visible = false; hand.add(finger);
    h['finger' + side] = finger; h['palm' + side] = palm;
  }
  // ---- legs ----
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'L' : 'R';
    const hp = J('hip' + side, hips, s * 0.092 * W, -0.03, 0);
    hp.add(mesh(limbGeo(0.08 * W, 0.066, thigh + 0.02, 6, 0.006, sd + 40 + s, !!c.pantsMap), pantsMat));
    const kn = J('knee' + side, hp, 0, -thigh, 0);
    kn.add(mesh(facet(new THREE.IcosahedronGeometry(0.066, 0), 0.004, sd + 42 + s), pantsMat));
    kn.add(mesh(limbGeo(0.064, 0.056, shin + 0.01, 6, 0.006, sd + 44 + s, !!c.pantsMap), pantsMat));
    const an = J('ankle' + side, kn, 0, -shin, 0);
    const shoe = mesh(facet(new THREE.BoxGeometry(0.115, 0.075, 0.25, 2, 1, 2), 0.01, sd + 46 + s), shoeMat);
    shoe.position.set(0, -0.035, 0.045); an.add(shoe);
    const sole = mesh(new THREE.BoxGeometry(0.12, 0.022, 0.255), soleMat);
    sole.position.set(0, -0.072, 0.045); an.add(sole);
  }
  // collar
  const collar = mesh(new THREE.TorusGeometry(0.075, 0.018, 5, 10), c.collar ? mat(c.collar) : shirtMat);
  collar.rotation.x = Math.PI / 2; collar.position.y = 0.245; collar.scale.set(1, 0.8, 1); chest.add(collar);

  h.lookOffset = new THREE.Vector2();
  h.faceState = {};
  h.blinkSeed = c.seed * 13.7;
  h.reset = () => {
    for (const n of JOINTS) { const g = h.j[n]; g.rotation.set(0, 0, 0); }
    h.j.hips.position.set(0, hipY, 0);
    root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1);
    body.scale.set(1, 1, 1); body.position.set(0, 0, 0);
    root.visible = true;
    h.fingerL.visible = h.fingerR.visible = false;
    // relaxed default pose
    h.j.shL.rotation.z = 0.12; h.j.shR.rotation.z = -0.12;
    h.j.elL.rotation.x = -0.15; h.j.elR.rotation.x = -0.15;
    h.setFace({});
  };
  // Face: eyes 'open'|'wide'|'half'|'closed'|'happy'|'narrow'; mouth 'o'|'grin'|'smile'|'frown'|'flat'|'smirk'
  h.setFace = ({ eyes: em = 'open', mouth: mm = 'flat', open = 0.5, blink = 0, look = [0, 0], t = null } = {}) => {
    let b = blink;
    if (t !== null && em !== 'closed' && em !== 'happy') b = Math.max(b, blinkAt(t, h.blinkSeed));
    for (const e of eyes) {
      e.box.visible = em !== 'happy';
      e.arc.visible = em === 'happy';
      let sy = 1, sx = 1, oy = 0, rz = 0;
      if (em === 'wide') { sy = 1.35; sx = 1.15; }
      if (em === 'half') { sy = 0.4; oy = -0.008; }
      if (em === 'closed') { sy = 0.12; oy = -0.01; }
      if (em === 'narrow') { sy = 0.38; oy = -0.004; rz = -e.side * 0.32; }
      sy *= 1 - 0.9 * b;
      e.box.scale.set(sx, Math.max(0.06, sy), 1);
      e.g.position.set(e.base.x + look[0] * 0.01, e.base.y + oy + look[1] * 0.008, e.base.z);
      e.g.rotation.z = rz;
    }
    const M = h.face.mouth;
    for (const k of ['o', 'grin', 'smile', 'frown', 'flat', 'smirk']) M[k].visible = k === mm;
    const o = clamp(open);
    if (mm === 'o') M.o.scale.set(0.75 + 0.35 * o, 0.18 + 0.95 * o, 1);
    if (mm === 'grin') M.grin.scale.set(1, 0.55 + 0.7 * o, 1);
    if (mm === 'smile') M.smile.scale.set(1, 0.8 + 0.4 * o, 1);
  };
  h.squash = (s) => body.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
  h.reset();
  root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  return h;
}

// Joint rotations from a compact pose object: {shL:[x,y,z], elL:x, ...}
export function pose(h, p) {
  for (const k in p) {
    const v = p[k], g = h.j[k];
    if (!g) continue;
    if (typeof v === 'number') g.rotation.x = v; else g.rotation.set(v[0] || 0, v[1] || 0, v[2] || 0);
  }
}
export function mixPose(a, b, t) {
  const out = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const va = a[k] ?? 0, vb = b[k] ?? 0;
    const A = typeof va === 'number' ? [va, 0, 0] : va, B = typeof vb === 'number' ? [vb, 0, 0] : vb;
    out[k] = [lerp(A[0] || 0, B[0] || 0, t), lerp(A[1] || 0, B[1] || 0, t), lerp(A[2] || 0, B[2] || 0, t)];
  }
  return out;
}

// ---------- the cast ----------
export function makeYou() {
  return makeHuman({ skin: '#eab38a', shirt: '#2d6be0', pants: '#1f2b47', shoes: '#f7f7f5', hair: '#5b3720', hairStyle: 'short', seed: 1 });
}

export function makeDad() {
  const h = makeHuman({
    skin: '#efc3a2', shirtMap: TX.plaid(3, '#b3261e', 1), pants: '#7f8288', shoes: '#6b4226', sole: '#3a2414',
    hair: '#c4c4c4', hairStyle: 'greySides', glasses: true, width: 0.82, legLen: 1.04, seed: 2, collar: '#8e1c16',
  });
  // apron: bib on chest + skirt on hips (plaid, slightly darker)
  const apronMat = new THREE.MeshStandardMaterial({ map: TX.plaid(9, '#a31d18', 0.7), roughness: 0.85, flatShading: true });
  const bib = mesh(new THREE.BoxGeometry(0.25, 0.24, 0.02), apronMat);
  bib.position.set(0, 0.11, 0.128); h.j.chest.add(bib);
  const skirtPivot = new THREE.Group(); skirtPivot.position.set(0, 0.02, 0.118); h.j.hips.add(skirtPivot);
  const skirtGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.5, 4, 1, true, -Math.PI / 4, Math.PI / 2);
  const skirt = mesh(new THREE.BoxGeometry(0.36, 0.5, 0.02), apronMat);
  skirt.position.y = -0.22; skirtPivot.add(skirt);
  h.apronSkirt = skirtPivot;
  const strap = mesh(new THREE.TorusGeometry(0.09, 0.01, 4, 12, Math.PI), apronMat);
  strap.position.set(0, 0.23, 0.07); strap.rotation.x = -0.5; h.j.chest.add(strap);
  const tie = mesh(new THREE.BoxGeometry(0.36, 0.025, 0.24), apronMat); tie.position.set(0, 0.02, 0); tie.scale.z = 1.05; h.j.hips.add(tie);
  // a fine grey moustache for character
  const mo = mesh(facet(new THREE.BoxGeometry(0.075, 0.018, 0.02, 2, 1, 1), 0.004, 211), h.mats.hair);
  mo.position.set(0, -0.052, 0.142); h.headC.add(mo);
  // plate of pancakes, always in the left hand
  const plate = makePancakePlate();
  h.j.handL.add(plate.group);
  plate.group.position.set(0, -0.08, 0.1);
  h.plate = plate;
  h.baseReset = h.reset;
  h.reset = () => {
    h.baseReset();
    skirtPivot.rotation.set(0, 0, 0);
    plate.group.visible = true;
    plate.pancakes.forEach((p) => { p.visible = true; });
  };
  h.reset();
  return h;
}

export function makeGrandma() {
  const h = makeHuman({
    skin: '#f1c6aa', shirtMap: TX.knit('#4f8a4a'), pants: '#6f4a8e', shoes: '#a8786a', sole: '#5a3a30',
    hair: '#f3f0ea', hairStyle: 'bun', glasses: true, width: 0.95, legLen: 0.92, seed: 3, collar: '#f4efe6', cuff: '#3f7a3c',
  });
  // cardigan buttons
  for (let i = 0; i < 4; i++) {
    const b = mesh(new THREE.SphereGeometry(0.012, 6, 4), mat('#e9dcc0', { roughness: 0.4 }));
    b.position.set(0, 0.02 + i * 0.075, 0.125 - i * 0.004);
    (i < 2 ? h.j.spine : h.j.chest).add(b);
    if (i >= 2) b.position.y = (i - 2) * 0.075 + 0.04; else b.position.y = 0.08 + i * 0.075;
  }
  const blush = mat('#f19a8e', { roughness: 0.7, transparent: true, opacity: 0.55 });
  for (const s of [-1, 1]) {
    const c = mesh(new THREE.CircleGeometry(0.018, 8), blush, { cast: false });
    c.position.set(s * 0.085, -0.035, 0.128); c.rotation.y = s * 0.55; h.headC.add(c);
  }
  return h;
}

// ---------- props ----------
export function makePancakePlate() {
  const group = new THREE.Group();
  const plateMat = new THREE.MeshStandardMaterial({ color: '#f6f3ec', roughness: 0.25, metalness: 0 });
  const plate = mesh(new THREE.CylinderGeometry(0.155, 0.11, 0.022, 20), plateMat);
  group.add(plate);
  const rim = mesh(new THREE.TorusGeometry(0.15, 0.006, 4, 24), mat('#3f6fb0', { roughness: 0.3 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.011; group.add(rim);
  const side = mat('#c4843a', { roughness: 0.7 }), top = mat('#e3a85a', { roughness: 0.65 }), bot = mat('#a9662a', { roughness: 0.8 });
  const pancakes = [];
  const r = mulberry32(55);
  for (let i = 0; i < 4; i++) {
    const p = mesh(new THREE.CylinderGeometry(0.104 + r() * 0.006, 0.106, 0.026, 14), [side, top, bot]);
    p.position.set((r() - 0.5) * 0.012, 0.024 + i * 0.026, (r() - 0.5) * 0.012);
    p.rotation.y = r() * 3;
    group.add(p); pancakes.push(p);
  }
  const butter = mesh(new THREE.BoxGeometry(0.04, 0.025, 0.04), mat('#ffe27a', { roughness: 0.35, emissive: '#3a2a00', emissiveIntensity: 0.3 }));
  butter.position.set(0.01, 0.14, 0); butter.rotation.y = 0.4; group.add(butter);
  const syrupMat = new THREE.MeshPhysicalMaterial({ color: '#6e3510', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, flatShading: true });
  const syrup = mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.006, 12), syrupMat);
  syrup.position.y = 0.127; group.add(syrup);
  for (let k = 0; k < 4; k++) {
    const a = k * 1.7 + 0.4;
    const drip = mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.03 + k * 0.012, 5), syrupMat);
    drip.position.set(Math.cos(a) * 0.1, 0.11 - k * 0.006, Math.sin(a) * 0.1); group.add(drip);
  }
  // the topmost pancake (+butter+syrup) is the one dad hands over
  const handOff = new THREE.Group();
  return { group, pancakes, butter, syrup, handOff };
}

export function makeSinglePancake() {
  const g = new THREE.Group();
  const p = mesh(new THREE.CylinderGeometry(0.105, 0.106, 0.026, 14), [mat('#c4843a'), mat('#e3a85a'), mat('#a9662a')]);
  g.add(p);
  const syrupMat = new THREE.MeshPhysicalMaterial({ color: '#6e3510', roughness: 0.12, clearcoat: 1, flatShading: true });
  const s = mesh(new THREE.CylinderGeometry(0.06, 0.066, 0.006, 12), syrupMat); s.position.y = 0.016; g.add(s);
  return g;
}

export function makeVelcroMaterial() {
  const { map, bump } = TX.velcro();
  return new THREE.MeshStandardMaterial({ color: '#c9cbd0', map, bumpMap: bump, bumpScale: 2.5, roughness: 0.95, flatShading: true });
}

// fuzzy hairs scattered over a set of meshes' bounding cylinders
export function makeFuzz(count, radius, height, seed = 1, color = '#9fa1a6') {
  const geo = new THREE.ConeGeometry(0.0038, 0.017, 3);
  geo.translate(0, 0.008, 0);
  const m = new THREE.InstancedMesh(geo, mat(color, { roughness: 1 }), count);
  const r = mulberry32(seed);
  const d = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, y = r() * height;
    d.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius * 0.66);
    d.lookAt(Math.cos(a) * radius * 3, y + (r() - 0.5) * 0.3, Math.sin(a) * radius * 2);
    d.rotateX(Math.PI / 2);
    d.scale.setScalar(0.6 + r() * 0.7);
    d.updateMatrix(); m.setMatrixAt(i, d.matrix);
  }
  m.castShadow = false;
  return m;
}

// Grandma's finished Velcro sweater (held up to show off)
export function makeSweaterProp(velcroMat) {
  const g = new THREE.Group();
  const bodyM = mesh(new THREE.BoxGeometry(0.44, 0.46, 0.08, 3, 3, 1), velcroMat);
  g.add(bodyM);
  for (const s of [-1, 1]) {
    const sl = mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.42, 6), velcroMat);
    sl.position.set(s * 0.3, 0.06, 0); sl.rotation.z = s * 0.75; g.add(sl);
    const cuff = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 6), mat('#7d7f84'));
    cuff.position.set(s * 0.455, -0.1, 0); cuff.rotation.z = s * 0.75; g.add(cuff);
  }
  const collar = mesh(new THREE.TorusGeometry(0.08, 0.025, 5, 10), mat('#7d7f84'));
  collar.position.y = 0.22; collar.rotation.x = Math.PI / 2; collar.scale.set(1, 0.7, 1); g.add(collar);
  const hem = mesh(new THREE.BoxGeometry(0.45, 0.05, 0.085), mat('#7d7f84'));
  hem.position.y = -0.235; g.add(hem);
  const fz = makeFuzz(260, 0.2, 0.44, 9);
  fz.position.y = -0.22; fz.scale.set(1.1, 1, 0.5); g.add(fz);
  return g;
}

export function makeKnitting() {
  const g = new THREE.Group();
  const needleMat = new THREE.MeshStandardMaterial({ color: '#d9dde2', roughness: 0.2, metalness: 0.9 });
  const n1 = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.32, 6), needleMat);
  const n2 = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.32, 6), needleMat);
  const k1 = mesh(new THREE.SphereGeometry(0.012, 6, 4), mat('#d1453b')); k1.position.y = 0.16; n1.add(k1);
  const k2 = mesh(new THREE.SphereGeometry(0.012, 6, 4), mat('#d1453b')); k2.position.y = 0.16; n2.add(k2);
  return { n1, n2 };
}

export function makeYarnBall() {
  const g = new THREE.Group();
  const ball = mesh(facet(new THREE.IcosahedronGeometry(0.075, 1), 0.006, 301), mat('#9a9ca2', { roughness: 1 }));
  g.add(ball);
  for (let i = 0; i < 6; i++) {
    const ring = mesh(new THREE.TorusGeometry(0.074, 0.005, 3, 14), mat('#85878d', { roughness: 1 }));
    ring.rotation.set(i * 0.9, i * 1.7, i * 0.4); g.add(ring);
  }
  return g;
}
