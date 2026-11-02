import * as THREE from 'three';

const P = new URLSearchParams(location.search);
const W = +(P.get('w') || 1080), H = +(P.get('h') || 1920);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);
const ASPECT = W / H;

// ---------- helpers ----------
let seed = 1234567;
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
function Rr(a, b) { return a + (b - a) * rnd(); }
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOut = t => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
const easeIn = t => { t = clamp(t); return t * t * t; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, t) => a.clone().lerp(b, t);
function spring(t, k = 14, d = 5) { if (t <= 0) return 0; return 1 - Math.exp(-d * t) * Math.cos(k * t); }

const texCache = {};
function pixTex(hex, vari = 0.09, n = 16, kind = 'noise') {
  const key = [hex, vari, n, kind].join('|'); if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
  const base = new THREE.Color(hex); const sv = seed; seed = 777 + n + Math.floor(vari * 1000) + (hex % 9973);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let v = 1 + (rnd() * 2 - 1) * vari;
    if (kind === 'plank') { if (y % 4 === 0) v *= 0.7; if ((x + Math.floor(y / 4) * 7) % n === 0) v *= 0.75; }
    if (kind === 'jeans') { if ((x + y) % 4 === 0) v *= 0.88; }
    if (kind === 'carpet') { v = 1 + (rnd() * 2 - 1) * vari * 1.4; }
    if (kind === 'wall') { if (y % 8 === 0) v *= 0.93; }
    const col = base.clone().multiplyScalar(v);
    g.fillStyle = '#' + col.getHexString(); g.fillRect(x, y, 1, 1);
  }
  seed = sv;
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache[key] = t; return t;
}
function M(hex, o = {}) {
  const p = { color: 0xffffff, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, flatShading: true };
  if (o.tex === false) p.color = new THREE.Color(hex);
  else { let t = pixTex(hex, o.vari ?? 0.09, o.n ?? 16, o.kind ?? 'noise'); if (o.rep) { t = t.clone(); t.repeat.set(o.rep[0], o.rep[1]); t.needsUpdate = true; } p.map = t; }
  if (o.emissive !== undefined) { p.emissive = new THREE.Color(o.emissive); p.emissiveIntensity = o.ei ?? 1; }
  if (o.transparent) { p.transparent = true; p.opacity = o.opacity ?? 1; }
  return new THREE.MeshStandardMaterial(p);
}
const BASIC = (hex, o = {}) => new THREE.MeshBasicMaterial({ color: hex, transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: o.toneMapped ?? true });
function box(w, h, d, mat, x = 0, y = 0, z = 0, parent = null, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = shadow; if (parent) parent.add(m); return m;
}
function cyl(rt, rb, h, seg, mat, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; if (parent) parent.add(m); return m;
}
function canvasTex(w, h, draw, nearest = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  t.userData = { canvas: c, g }; return t;
}
function wpos(obj, off = [0, 0, 0]) { obj.updateWorldMatrix(true, false); return obj.localToWorld(V(...off)); }

// ---------- kid character ----------
function makeKid(o = {}) {
  const C = Object.assign({ skin: 0x8a5636, hoodie: 0xc8262b, pants: 0x27477f, hair: 0x17110e, shoe: 0xeeeeee, headset: true, scale: 0.78, hood: true, beanie: null }, o);
  const mSkin = M(C.skin, { vari: 0.05 }), mHood = M(C.hoodie, { vari: 0.08 });
  const mHoodD = M(new THREE.Color(C.hoodie).multiplyScalar(0.7).getHex(), { vari: 0.08 });
  const mPants = M(C.pants, { kind: 'jeans', vari: 0.1 }), mHair = M(C.hair, { vari: 0.18 }), mShoe = M(C.shoe, { vari: 0.04 });
  const mDark = BASIC(0x0d0d0f), mWhite = BASIC(0xffffff);
  const k = { C }; const root = new THREE.Group(); root.scale.setScalar(C.scale); k.root = root;
  box(0.48, 0.24, 0.3, mPants, 0, 0, 0, root);
  // lump
  const lump = new THREE.Group(); root.add(lump); lump.position.set(0, 0.0, -0.13); k.lump = lump;
  const lm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 1), mPants); lm.castShadow = true; lm.receiveShadow = true;
  lm.position.set(0, 0, -0.09); lump.add(lm); k.lumpMesh = lm;
  const stain = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), M(0x5b3511, { vari: 0.2 }));
  stain.scale.set(1.3, 0.8, 0.9); stain.position.set(0.05, -0.1, -0.19); lump.add(stain); k.stain = stain;
  const stain2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), stain.material); stain2.scale.set(0.6, 1, 1.2); stain2.position.set(-0.16, -0.07, -0.12); stain.add(stain2.clone()); lump.add(stain2); k.stain2 = stain2;
  // spine / torso
  const spine = new THREE.Group(); spine.position.y = 0.1; root.add(spine); k.spine = spine;
  box(0.5, 0.56, 0.3, mHood, 0, 0.28, 0, spine);
  if (C.hood) {
    box(0.3, 0.13, 0.02, mHoodD, 0, 0.12, 0.155, spine);
    box(0.025, 0.14, 0.02, M(0xeeeeee), 0.06, 0.43, 0.162, spine); box(0.025, 0.12, 0.02, M(0xeeeeee), -0.06, 0.41, 0.162, spine);
    box(0.4, 0.15, 0.13, mHoodD, 0, 0.55, -0.12, spine);
  }
  const neck = new THREE.Group(); neck.position.y = 0.56; spine.add(neck); k.neck = neck;
  const head = new THREE.Group(); neck.add(head); k.head = head;
  box(0.42, 0.40, 0.38, mSkin, 0, 0.21, 0, head);
  // hair (messy)
  const hair = new THREE.Group(); head.add(hair);
  box(0.46, 0.12, 0.42, mHair, 0, 0.44, -0.01, hair); box(0.46, 0.28, 0.08, mHair, 0, 0.31, -0.18, hair);
  box(0.06, 0.16, 0.3, mHair, 0.215, 0.37, -0.04, hair); box(0.06, 0.16, 0.3, mHair, -0.215, 0.37, -0.04, hair);
  const sv = seed; seed = 99 + Math.floor(C.hair % 1000);
  [[-0.13, 0.37, 0.185, 0.16, 0.09], [0.03, 0.385, 0.19, 0.16, 0.07], [0.15, 0.37, 0.18, 0.13, 0.09]].forEach(([x, y, z, w, h]) => { const b = box(w, h, 0.06, mHair, x, y, z, hair); b.rotation.z = Rr(-0.25, 0.25); });
  for (let i = 0; i < 9; i++) { const b = box(Rr(0.1, 0.16), Rr(0.08, 0.13), Rr(0.1, 0.15), mHair, Rr(-0.17, 0.17), 0.5 + Rr(0, 0.04), Rr(-0.17, 0.14), hair); b.rotation.set(Rr(-0.5, 0.5), Rr(-0.6, 0.6), Rr(-0.6, 0.6)); }
  seed = sv; k.hair = hair;
  if (C.beanie) { const mb = M(C.beanie, { vari: 0.1 }); box(0.47, 0.16, 0.43, mb, 0, 0.47, -0.01, head); box(0.49, 0.06, 0.45, M(new THREE.Color(C.beanie).multiplyScalar(0.75).getHex()), 0, 0.4, -0.01, head); hair.visible = false; }
  if (C.headset) {
    const mH = M(0x1d1d22, { vari: 0.06, rough: 0.5 });
    box(0.52, 0.05, 0.08, mH, 0, 0.535, 0, head); box(0.05, 0.22, 0.08, mH, 0.262, 0.43, 0, head); box(0.05, 0.22, 0.08, mH, -0.262, 0.43, 0, head);
    for (const sx of [1, -1]) {
      const cup = cyl(0.115, 0.115, 0.09, 8, mH, sx * 0.255, 0.22, 0, head); cup.rotation.z = Math.PI / 2;
      const ring = cyl(0.118, 0.118, 0.02, 8, BASIC(0x3fb0ff), sx * 0.305, 0.22, 0, head); ring.rotation.z = Math.PI / 2; ring.castShadow = false;
      const cap = cyl(0.08, 0.08, 0.022, 8, mH, sx * 0.31, 0.22, 0, head); cap.rotation.z = Math.PI / 2;
    }
    const boom = box(0.022, 0.022, 0.22, mH, 0.245, 0.13, 0.13, head); boom.rotation.y = -0.25;
    box(0.045, 0.045, 0.05, mH, 0.215, 0.12, 0.245, head);
  }
  // face
  const face = new THREE.Group(); face.position.z = 0.191; head.add(face); k.face = {};
  const F = k.face;
  const fb = (w, h, mat, x, y, z = 0, rz = 0) => { const b = box(w, h, 0.01, mat, x, y, z, face, false); b.rotation.z = rz; return b; };
  F.dot = new THREE.Group(); face.add(F.dot); [1, -1].forEach(s => { const b = fb(0.055, 0.075, mDark, s * 0.095, 0.235); face.remove(b); F.dot.add(b); });
  F.wide = new THREE.Group(); face.add(F.wide); [1, -1].forEach(s => { const a = fb(0.13, 0.14, mWhite, s * 0.1, 0.24); const b = fb(0.055, 0.065, mDark, s * 0.1, 0.235, 0.004); face.remove(a); face.remove(b); F.wide.add(a, b); });
  F.squint = new THREE.Group(); face.add(F.squint); [1, -1].forEach(s => { const b = fb(0.11, 0.028, mDark, s * 0.095, 0.235, 0, s * 0.3); face.remove(b); F.squint.add(b); });
  F.happy = new THREE.Group(); face.add(F.happy); [1, -1].forEach(s => { const a = fb(0.065, 0.024, mDark, s * 0.095 - 0.022, 0.235, 0, 0.6); const b = fb(0.065, 0.024, mDark, s * 0.095 + 0.022, 0.235, 0, -0.6); face.remove(a); face.remove(b); F.happy.add(a, b); });
  F.browL = fb(0.1, 0.026, mDark, 0.1, 0.33); F.browR = fb(0.1, 0.026, mDark, -0.1, 0.33);
  F.mFlat = fb(0.11, 0.026, mDark, 0, 0.095);
  F.mSmile = new THREE.Group(); face.add(F.mSmile); { const a = fb(0.11, 0.026, mDark, 0, 0.09), b = fb(0.026, 0.05, mDark, 0.068, 0.105), c = fb(0.026, 0.05, mDark, -0.068, 0.105);[a, b, c].forEach(x => { face.remove(x); F.mSmile.add(x); }); }
  F.mO = fb(0.06, 0.07, mDark, 0, 0.085);
  F.mOpen = new THREE.Group(); face.add(F.mOpen); { const a = fb(0.17, 0.13, BASIC(0x2a0a0a), 0, 0.085), b = fb(0.11, 0.045, BASIC(0xd2454b), 0, 0.045, 0.004), c = fb(0.15, 0.025, mWhite, 0, 0.135, 0.004);[a, b, c].forEach(x => { face.remove(x); F.mOpen.add(x); }); }
  F.mGrit = new THREE.Group(); face.add(F.mGrit); { const a = fb(0.17, 0.065, mDark, 0, 0.09), b = fb(0.15, 0.04, mWhite, 0, 0.09, 0.004), c = fb(0.006, 0.04, mDark, 0.03, 0.09, 0.006), d = fb(0.006, 0.04, mDark, -0.03, 0.09, 0.006);[a, b, c, d].forEach(x => { face.remove(x); F.mGrit.add(x); }); }
  F.mWobble = new THREE.Group(); face.add(F.mWobble); for (let i = 0; i < 5; i++) { const b = fb(0.032, 0.022, mDark, -0.06 + i * 0.03, 0.09 + (i % 2 ? 0.012 : -0.004)); face.remove(b); F.mWobble.add(b); }
  F.blush = new THREE.Group(); face.add(F.blush); [1, -1].forEach(s => { const b = fb(0.075, 0.035, BASIC(0xe0707a, { transparent: true, opacity: 0.6 }), s * 0.14, 0.16, 0.002); face.remove(b); F.blush.add(b); });
  // tears
  const mTear = new THREE.MeshStandardMaterial({ color: 0x7fd3ff, emissive: 0x2a8fd8, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
  F.tears = new THREE.Group(); face.add(F.tears); F.streams = []; F.pools = []; F.drops = [];
  [1, -1].forEach(s => {
    const st = box(0.036, 1, 0.014, mTear, s * 0.1, 0.15, 0.006, null, false); F.tears.add(st); F.streams.push(st);
    const pl = box(0.13, 0.04, 0.012, mTear, s * 0.1, 0.19, 0.008, null, false); F.tears.add(pl); F.pools.push(pl);
    for (let i = 0; i < 3; i++) { const d = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 0), mTear); F.tears.add(d); F.drops.push({ m: d, s, i }); }
  });
  F.shine = new THREE.Group(); face.add(F.shine); [1, -1].forEach(s => { const b = fb(0.03, 0.03, mWhite, s * 0.1 + 0.02, 0.255, 0.009); face.remove(b); F.shine.add(b); });
  // sweat drops (head space)
  const mSweat = new THREE.MeshStandardMaterial({ color: 0x9fe0ff, emissive: 0x3a9ee0, emissiveIntensity: 0.5, roughness: 0.1, transparent: true, opacity: 0.95 });
  k.sweat = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 1), mSweat); const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 6), mSweat); c.position.y = 0.04; g.add(b, c); head.add(g); k.sweat.push(g);
  }
  // arms
  function arm(sx) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.32, 0.47, 0); spine.add(sh);
    box(0.16, 0.3, 0.17, mHood, 0, -0.13, 0, sh);
    const el = new THREE.Group(); el.position.y = -0.28; sh.add(el);
    box(0.15, 0.24, 0.16, mHood, 0, -0.11, 0, el); box(0.155, 0.05, 0.165, mHoodD, 0, -0.22, 0, el);
    const hand = box(0.13, 0.12, 0.14, mSkin, 0, -0.3, 0, el);
    const thumb = box(0.045, 0.09, 0.045, mSkin, -sx * 0.02, -0.21, 0.08, el); thumb.visible = false;
    return { sh, el, hand, thumb };
  }
  k.armL = arm(1); k.armR = arm(-1);
  function leg(sx) {
    const hp = new THREE.Group(); hp.position.set(sx * 0.12, -0.06, 0); root.add(hp);
    box(0.21, 0.4, 0.23, mPants, 0, -0.2, 0, hp);
    const kn = new THREE.Group(); kn.position.y = -0.4; hp.add(kn);
    box(0.2, 0.38, 0.21, mPants, 0, -0.19, 0, kn); box(0.22, 0.1, 0.32, mShoe, 0, -0.41, 0.05, kn);
    return { hp, kn };
  }
  k.legL = leg(1); k.legR = leg(-1);
  // rumble arcs (stomach)
  k.rumble = new THREE.Group(); spine.add(k.rumble); k.rumbleArcs = [];
  for (let i = 0; i < 6; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(0.1 + (i % 3) * 0.06, 0.012, 4, 10, Math.PI * 0.55), BASIC(0xfff3a0)); k.rumble.add(a); k.rumbleArcs.push(a); }
  k.rumble.position.set(0, 0.16, 0.17);
  return k;
}
function kidReset(k) {
  k.root.visible = true; k.root.rotation.set(0, 0, 0);
  k.spine.rotation.set(0, 0, 0); k.neck.rotation.set(0, 0, 0); k.head.rotation.set(0, 0, 0);
  for (const a of [k.armL, k.armR]) { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); a.thumb.visible = false; a.hand.scale.set(1, 1, 1); }
  for (const l of [k.legL, k.legR]) { l.hp.rotation.set(0, 0, 0); l.kn.rotation.set(0, 0, 0); }
  setLump(k, 0); face(k, {}); sweat(k, 0, 0); k.rumble.visible = false;
}
function setLump(k, s, wob = 0) {
  k.lump.visible = s > 0.01; const w = 1 + wob; if (k.stain2) k.stain2.visible = s > 0.3;
  k.lump.scale.set(s * w, s / w, s * (1 + wob * 0.5)); k.stain.visible = s > 0.3;
}
function face(k, o) {
  const F = k.face; const eyes = o.eyes || 'dot', mouth = o.mouth || 'flat', brows = o.brows || 'none';
  F.dot.visible = eyes === 'dot'; F.wide.visible = eyes === 'wide'; F.squint.visible = eyes === 'squint'; F.happy.visible = eyes === 'happy';
  F.mFlat.visible = mouth === 'flat'; F.mSmile.visible = mouth === 'smile'; F.mO.visible = mouth === 'o'; F.mOpen.visible = mouth === 'open'; F.mGrit.visible = mouth === 'grit'; F.mWobble.visible = mouth === 'wobble';
  F.browL.visible = F.browR.visible = brows !== 'none';
  const br = { worried: [-0.35, 0.35, 0.34], angry: [0.35, -0.35, 0.31], up: [0, 0, 0.36], none: [0, 0, 0.33] }[brows] || [0, 0, 0.33];
  F.browL.rotation.z = br[0]; F.browR.rotation.z = br[1]; F.browL.position.y = F.browR.position.y = br[2];
  F.blush.visible = !!o.blush; F.shine.visible = !!o.shine;
  const tears = o.tears || 0, t = o.t || 0; F.tears.visible = tears > 0;
  F.streams.forEach((st, i) => { const L = 0.02 + 0.2 * clamp((tears - 0.35) / 0.65); st.scale.y = L; st.position.y = 0.19 - L / 2; st.visible = tears > 0.35; });
  F.pools.forEach(p => { p.scale.set(1, 0.3 + clamp(tears * 2) * 1.0, 1); p.position.y = 0.195 - 0.01 * clamp(tears * 2); });
  F.drops.forEach(d => { const ph = ((t * 1.3 + d.i / 3 + (d.s > 0 ? 0.17 : 0)) % 1); d.m.visible = tears > 0.6; d.m.position.set(d.s * 0.1, -0.02 - ph * 0.5, 0.02 + ph * 0.08); d.m.scale.setScalar(1 - ph * 0.4); });
}
function sweat(k, n, t) {
  k.sweat.forEach((g, i) => {
    g.visible = i < n; if (i >= n) return;
    const side = [0.17, -0.19, 0.06, -0.08, 0.2, -0.2, 0.12][i]; const ph = ((t * 0.55 + i * 0.37) % 1);
    const x = side * 1.1, y0 = 0.36 - (i % 3) * 0.05;
    g.position.set(x + Math.sign(side) * ph * 0.06, y0 - ph * 0.45, 0.2 - Math.abs(x) * 0.15);
    g.scale.setScalar(0.8 + 0.4 * Math.sin(i));
  });
}
// poses
function poseSit(k, arms = 'keys', t = 0) {
  k.legL.hp.rotation.x = k.legR.hp.rotation.x = -Math.PI / 2;
  k.legL.kn.rotation.x = k.legR.kn.rotation.x = Math.PI / 2 - 0.05;
  k.legL.hp.rotation.y = 0.08; k.legR.hp.rotation.y = -0.08;
  armPose(k, arms, t);
}
function armPose(k, arms, t = 0) {
  const L = k.armL, Rt = k.armR;
  const set = (a, sx, sz, ex) => { a.sh.rotation.x = sx; a.sh.rotation.z = sz; a.el.rotation.x = ex; };
  if (arms === 'keys') { k.spine.rotation.x = 0.12; set(L, -0.75, 0.12, -0.75); set(Rt, -0.75, -0.06, -0.8); }
  if (arms === 'stiff') { k.spine.rotation.x = 0.0; set(L, -0.62, 0.1, -0.95); set(Rt, -0.62, -0.1, -0.95); }
  if (arms === 'fists') { k.spine.rotation.x = -0.12; set(L, -2.85, 0.35, -0.35); set(Rt, -2.85, -0.35, -0.35); }
  if (arms === 'up') { set(L, -2.95, 0.5, -0.15); set(Rt, -2.95, -0.5, -0.15); }
  if (arms === 'halfup') { set(L, -2.0, 0.65, -1.0); set(Rt, -2.0, -0.65, -1.0); }
  if (arms === 'belly') { k.spine.rotation.x = 0.18; set(L, -0.75, 0.12, -0.75); set(Rt, -0.35, 0.35, -1.45); }
  if (arms === 'thumbs') { k.spine.rotation.x = 0.05; set(L, -0.75, 0.12, -0.75); set(Rt, -1.15, 0.25, -1.55); Rt.thumb.visible = true; }
  if (arms === 'down') { set(L, 0, 0.08, -0.1); set(Rt, 0, -0.08, -0.1); }
  if (arms === 'trophy') { set(L, -2.9, 0.25, -0.5); set(Rt, -2.9, -0.25, -0.5); }
}
function poseStand(k, arms = 'down', t = 0) { armPose(k, arms, t); }

// ---------- stink lines ----------
const stinkPool = []; const stinkMat = [];
function makeStinkMesh(scene) { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x8cf05a, transparent: true, opacity: 0.85, depthWrite: false })); m.frustumCulled = false; scene.add(m); return m; }
let stinkUsed = 0;
function stinkBegin() { stinkUsed = 0; stinkPool.forEach(p => p.visible = false); }
function stink(scene, pos, t, o = {}) {
  const n = o.n ?? 3, h = o.h ?? 0.6, amp = o.amp ?? 0.05, rad = o.r ?? 0.012, spread = o.spread ?? 0.12, alpha = o.alpha ?? 0.85;
  for (let i = 0; i < n; i++) {
    if (stinkUsed >= stinkPool.length) stinkPool.push(makeStinkMesh(scene));
    const m = stinkPool[stinkUsed++]; if (m.parent !== scene) scene.add(m);
    const ph = (t * (o.speed ?? 0.35) + i / n) % 1; const off = (i - (n - 1) / 2) * spread;
    const pts = [];
    for (let j = 0; j <= 18; j++) { const s = j / 18; const y = s * h; pts.push(V(pos.x + off + amp * Math.sin(s * Math.PI * 3.2 - t * 5 + i * 2.1), pos.y + y + ph * h * 0.5, pos.z + (o.dz ?? 0) * s + amp * 0.4 * Math.cos(s * 5 + t * 3 + i))); }
    const curve = new THREE.CatmullRomCurve3(pts); m.geometry.dispose(); m.geometry = new THREE.TubeGeometry(curve, 24, rad, 5, false);
    m.material.opacity = alpha * Math.sin(Math.PI * ph) * 1.2; m.visible = true;
  }
}

// ---------- confetti ----------
function makeConfetti(scene, n, box3) {
  const geo = new THREE.PlaneGeometry(1, 0.55); const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
  const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; scene.add(im);
  const cols = [0xffd23f, 0xffc107, 0x40c4ff, 0xffffff, 0xff4fa3, 0x7c4dff, 0x69f0ae];
  const c = new THREE.Color(); for (let i = 0; i < n; i++) { c.setHex(cols[i % cols.length]); im.setColorAt(i, c); }
  const data = []; for (let i = 0; i < n; i++) data.push([hash(i), hash(i + 100), hash(i + 200), hash(i + 300), hash(i + 400)]);
  const dummy = new THREE.Object3D();
  return {
    im, update(t, amount = 1, size = 0.05) {
      im.visible = amount > 0;
      const [x0, y0, z0, x1, y1, z1] = box3;
      for (let i = 0; i < n; i++) {
        const d = data[i]; const on = d[4] < amount;
        const fall = ((t * (0.25 + d[3] * 0.25) + d[1]) % 1);
        dummy.position.set(lerp(x0, x1, d[0]) + 0.1 * Math.sin(t * 2 + i), lerp(y1, y0, fall), lerp(z0, z1, d[2]));
        dummy.rotation.set(t * 3 + i, t * 2 + d[1] * 6, i);
        dummy.scale.setScalar(on ? size * (0.7 + d[3] * 0.6) : 0.0001); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  };
}

// ======================= GAME WORLD =======================
const game = new THREE.Scene();
game.background = canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a9bff'); gr.addColorStop(0.6, '#8fd0ff'); gr.addColorStop(1, '#d6f1ff'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
game.fog = new THREE.Fog(0xc9ecff, 40, 170);
game.add(new THREE.HemisphereLight(0xdff2ff, 0x4a7a2a, 1.3));
const sun = new THREE.DirectionalLight(0xfff4dd, 2.6); sun.position.set(25, 40, 18); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 }); game.add(sun);
{ // terrain
  const g = new THREE.PlaneGeometry(170, 170, 70, 70); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position; const cols = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); const d = Math.hypot(x, z);
    let h = (1 - ease((d - 42) / 22)) * 2.4 - 1.2 + Math.sin(x * 0.13) * Math.cos(z * 0.11) * 0.9 * (1 - ease((d - 20) / 30)) + (hash(i) - 0.5) * 0.35;
    if (d < 14) h = lerp(0.6, h, ease(d / 14) * 0.6);
    pos.setY(i, h);
    const c = new THREE.Color(h < 0.15 ? 0xe9d58c : (hash(i * 3) < 0.5 ? 0x5ccb3d : 0x4cb533)); if (h > 1.6) c.setHex(0x6fd64a); cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const gg = g.toNonIndexed(); gg.computeVertexNormals();
  const m = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })); m.receiveShadow = true; game.add(m);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x2aa6e6, roughness: 0.25, metalness: 0.1, emissive: 0x0a3a66, emissiveIntensity: 0.4 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.05; game.add(water);
}
const mTrunk = M(0x7a4a24, { vari: 0.12 }), mLeaf = M(0x2f9e3a, { vari: 0.12 }), mLeaf2 = M(0x3cb94a, { vari: 0.12 }), mRock = M(0x8c8f99, { vari: 0.1 });
{
  const sv = seed; seed = 4242;
  for (let i = 0; i < 46; i++) {
    const a = Rr(0, Math.PI * 2), d = Rr(9, 46); const x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.abs(x) < 5 && z > -12 && z < 14) continue;
    const s = Rr(0.8, 1.4); const t = new THREE.Group(); t.position.set(x, 0.3, z); t.scale.setScalar(s); game.add(t);
    cyl(0.25, 0.32, 1.6, 6, mTrunk, 0, 0.8, 0, t); const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.4, 7), mLeaf); c1.position.y = 2.3; c1.castShadow = true; t.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 7), mLeaf2); c2.position.y = 3.3; c2.castShadow = true; t.add(c2);
  }
  for (let i = 0; i < 20; i++) { const r = new THREE.Mesh(new THREE.IcosahedronGeometry(Rr(0.4, 1.0), 0), mRock); r.position.set(Rr(-40, 40), 0.4, Rr(-40, 40)); r.castShadow = true; game.add(r); }
  // little houses
  for (const [x, z, ry] of [[-14, -18, 0.4], [16, -12, -0.6], [-18, 10, 1.2], [20, 16, 0.2]]) {
    const hgrp = new THREE.Group(); hgrp.position.set(x, 0.5, z); hgrp.rotation.y = ry; game.add(hgrp);
    box(4, 3, 4, M(0xf2e1c4, { vari: 0.06 }), 0, 1.5, 0, hgrp); const roof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 1.8, 4), M(0xc0392b, { vari: 0.08 })); roof.position.y = 3.9; roof.rotation.y = Math.PI / 4; roof.castShadow = true; hgrp.add(roof);
  }
  seed = sv;
}
// storm
const stormTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5a1aa8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 140; i++) { const x = hash(i) * w, y = hash(i + 50) * h, r = 10 + hash(i + 99) * 34; const gr = g.createRadialGradient(x, y, 0, x, y, r); const c = hash(i + 7) < 0.5 ? '190,90,255' : (hash(i + 8) < 0.5 ? '120,40,220' : '235,160,255'); gr.addColorStop(0, `rgba(${c},0.55)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.save(); g.translate(dx, dy); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore(); } } g.strokeStyle = 'rgba(255,230,255,0.8)'; g.lineWidth = 2; for (let j = 0; j < 3; j++) { g.beginPath(); let x = 40 + j * 80, y = 0; g.moveTo(x, y); while (y < h) { x += (hash(x + y) - 0.5) * 30; y += 14; g.lineTo(x, y); } g.stroke(); } });
stormTex.wrapS = stormTex.wrapT = THREE.RepeatWrapping; stormTex.repeat.set(10, 3);
const storm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 70, 64, 1, true), new THREE.MeshBasicMaterial({ map: stormTex, color: 0xe0a0ff, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false, fog: false }));
storm.position.y = 20; game.add(storm);
const stormFloor = new THREE.Mesh(new THREE.RingGeometry(1, 120, 64), new THREE.MeshBasicMaterial({ color: 0x8a2be2, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); stormFloor.rotation.x = -Math.PI / 2; stormFloor.position.y = 0.9; game.add(stormFloor);
function setStorm(R, t, cx = 0, cz = 0) { storm.scale.set(R, 1, R); storm.position.set(cx, 20, cz); stormTex.offset.set(t * 0.05, t * 0.15); stormFloor.scale.set(R, R, 1); stormFloor.position.set(cx, 0.9, cz); }
// wood pieces
const mWood = M(0xc08a4e, { kind: 'plank', vari: 0.1, n: 16 }); const mWoodEdge = M(0x8a5a2c, { vari: 0.1 });
function woodWall(parent) { const g = new THREE.Group(); box(3, 3, 0.22, mWood, 0, 1.5, 0, g); box(3.05, 0.18, 0.26, mWoodEdge, 0, 0.09, 0, g); box(3.05, 0.18, 0.26, mWoodEdge, 0, 2.91, 0, g); box(0.18, 3, 0.26, mWoodEdge, -1.45, 1.5, 0, g); box(0.18, 3, 0.26, mWoodEdge, 1.45, 1.5, 0, g); parent.add(g); return g; }
function woodRamp(parent) { const g = new THREE.Group(); const r = box(3, 0.22, 4.24, mWood, 0, 1.5, 0, g); r.rotation.x = Math.PI / 4; parent.add(g); return g; }
function popScale(g, t0, t) { const lt = t - t0; const s = lt <= 0 ? 0.0001 : Math.max(0.0001, spring(lt * 1.6, 16, 7)); g.scale.set(1, s, 1); g.visible = lt > 0; }
function gun(parent) { const g = new THREE.Group(); const mg = M(0x3a3d44, { vari: 0.08 }); box(0.1, 0.16, 0.55, mg, 0, 0, 0.12, g); box(0.07, 0.07, 0.3, mg, 0, 0.03, 0.5, g); box(0.08, 0.2, 0.1, mg, 0, -0.14, -0.02, g); box(0.11, 0.06, 0.12, M(0xff8c1a), 0, 0.1, 0.1, g); parent.add(g); return g; }
// game characters
const enemy = makeKid({ hoodie: 0x2e9e4f, pants: 0x2b2b2b, skin: 0xe2b48d, hair: 0xf2c94c, headset: false, beanie: 0xff7a1a, scale: 1.05 }); game.add(enemy.root);
const enemyGun = gun(enemy.armR.el); enemyGun.position.set(0, -0.32, 0.18); enemyGun.rotation.x = Math.PI / 2;
const avatar = makeKid({ hoodie: 0x6a3fd6, pants: 0x1f1f2a, skin: 0x8a5636, hair: 0x17110e, headset: false, scale: 1.05 }); game.add(avatar.root);
const avatarGun = gun(avatar.armR.el); avatarGun.position.set(0, -0.32, 0.18); avatarGun.rotation.x = Math.PI / 2;
const gameWalls = []; for (let i = 0; i < 8; i++) gameWalls.push(woodWall(game));
const gameRamps = []; for (let i = 0; i < 4; i++) gameRamps.push(woodRamp(game));
const gameCam = new THREE.PerspectiveCamera(50, ASPECT, 0.1, 400);
const fpGun = new THREE.Group(); { const g = gun(fpGun); g.rotation.y = Math.PI; box(0.14, 0.14, 0.2, M(0x8a5636), 0, -0.12, 0.1, fpGun); box(0.17, 0.17, 0.4, M(0x6a3fd6), 0, -0.13, 0.38, fpGun); } gameCam.add(fpGun); game.add(gameCam);
fpGun.position.set(0.32, -0.32, -0.75); fpGun.rotation.set(0.05, 0.12, 0);
const crosshair = new THREE.Group(); { const m = BASIC(0xffffff, { depthWrite: false, toneMapped: false }); [[0, 0.012], [0, -0.012], [0.012, 0], [-0.012, 0]].forEach(([x, y]) => { const b = new THREE.Mesh(new THREE.PlaneGeometry(x ? 0.012 : 0.0025, y ? 0.012 : 0.0025), m); b.position.set(x * 1.3, y * 1.3, 0); crosshair.add(b); }); const ring = new THREE.Mesh(new THREE.RingGeometry(0.0055, 0.0068, 20), m); crosshair.add(ring); } crosshair.position.z = -0.5; gameCam.add(crosshair);
const muzzle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), BASIC(0xffe066, { transparent: true, opacity: 0.95, toneMapped: false })); fpGun.add(muzzle); muzzle.position.set(0, 0.03, -0.72);
const hitPuffs = []; for (let i = 0; i < 14; i++) { const b = box(0.25, 0.25, 0.25, M([0xc08a4e, 0xffffff, 0x2e9e4f, 0xff7a1a][i % 4]), 0, 0, 0, game); hitPuffs.push(b); }
const gameConf = makeConfetti(game, 400, [-6, 0, -10, 6, 9, 2]);
function gameReset() {
  enemy.root.visible = false; avatar.root.visible = false; gameWalls.forEach(w => { w.visible = false; w.scale.set(1, 1, 1); w.rotation.set(0, 0, 0); });
  gameRamps.forEach(w => { w.visible = false; w.scale.set(1, 1, 1); w.rotation.set(0, 0, 0); }); fpGun.visible = false; crosshair.visible = false; muzzle.visible = false;
  hitPuffs.forEach(b => b.visible = false); gameConf.update(0, 0); kidReset(enemy); kidReset(avatar); setStorm(30, 0);
  gameCam.fov = 50; gameCam.aspect = ASPECT; gameCam.updateProjectionMatrix();
}
function standKid(k, x, z, ry, y = 0.55) { const s = k.C.scale; k.root.position.set(x, y + (0.06 + 0.8 + 0.06) * s, z); k.root.rotation.y = ry; poseStand(k, 'down'); }
// generic game view (for monitor) - over shoulder 1v1
function gameGeneric(t, look = 'ots') {
  gameReset(); setStorm(15 - t * 0.15, t);
  avatar.root.visible = true; standKid(avatar, 0, 8, Math.PI); armPose(avatar, 'keys'); avatar.spine.rotation.x = 0.1;
  avatar.root.position.y += Math.abs(Math.sin(t * 7)) * 0.05;
  enemy.root.visible = true; standKid(enemy, 1.0 + Math.sin(t * 1.3) * 1.2, -6, 0); armPose(enemy, 'keys');
  gameWalls[0].visible = true; gameWalls[0].position.set(-1.2, 0.4, -4.2);
  gameCam.position.set(1.1, 2.6, 11.5); gameCam.lookAt(0, 1.6, -6);
}

// ======================= ROOM =======================
const room = new THREE.Scene(); room.background = new THREE.Color(0x07060c);
const hemi = new THREE.HemisphereLight(0x6f62c9, 0x120f1c, 0.75); room.add(hemi);
const key = new THREE.DirectionalLight(0x9aa6ff, 0.55); key.position.set(1.5, 3.5, 2.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 12 }); key.shadow.bias = -0.0005; room.add(key);
const monLight = new THREE.SpotLight(0xbcd6ff, 5, 4.5, 0.9, 0.6, 1.2); monLight.position.set(0, 1.15, -1.05); monLight.target.position.set(0, 1.0, 0.3); monLight.castShadow = true; monLight.shadow.mapSize.set(1024, 1024); room.add(monLight, monLight.target);
const pPurple = new THREE.PointLight(0xa040ff, 6, 6, 1.4); pPurple.position.set(-1.9, 2.2, -1.0); room.add(pPurple);
const pBlue = new THREE.PointLight(0x2f7bff, 6, 6, 1.4); pBlue.position.set(1.9, 2.2, -1.0); room.add(pBlue);
const pBack1 = new THREE.PointLight(0xc040ff, 5, 6, 1.4); pBack1.position.set(-1.8, 2.0, 2.6); room.add(pBack1);
const pBack2 = new THREE.PointLight(0x3a6bff, 5, 6, 1.4); pBack2.position.set(1.8, 2.0, 2.6); room.add(pBack2);
const goldLight = new THREE.PointLight(0xffc840, 0, 7, 1.2); goldLight.position.set(0, 1.2, -1.0); room.add(goldLight);
const sideFill = new THREE.PointLight(0x8a94ff, 3.5, 5, 1.2); sideFill.position.set(1.7, 1.5, -0.2); room.add(sideFill);
const mWall = M(0x1d1a33, { kind: 'wall', vari: 0.06, rep: [6, 3] }), mFloor = M(0x2a2433, { kind: 'carpet', vari: 0.08, rep: [10, 10] });
const ROOM = { x0: -2.6, x1: 2.6, z0: -1.45, z1: 3.0, h: 2.8 };
{
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.45), mFloor); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, 0.775); fl.receiveShadow = true; room.add(fl);
  const ce = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.45), M(0x14121f)); ce.rotation.x = Math.PI / 2; ce.position.set(0, 2.8, 0.775); room.add(ce);
  box(5.2, 2.8, 0.1, mWall, 0, 1.4, -1.5, room); // back wall
  box(5.2, 2.8, 0.1, mWall, 0, 1.4, 3.05, room); // front wall
  box(0.1, 2.8, 4.55, mWall, -2.65, 1.4, 0.775, room); // left wall
  // right wall with door opening at z 0.3..1.2
  box(0.1, 2.8, 1.75, mWall, 2.65, 1.4, -0.575, room); box(0.1, 2.8, 1.85, mWall, 2.65, 1.4, 2.125, room); box(0.1, 0.8, 0.9, mWall, 2.65, 2.4, 0.75, room);
  box(0.06, 2.0, 0.06, M(0x3a2a1a), 2.62, 1.0, 0.3, room); box(0.06, 2.0, 0.06, M(0x3a2a1a), 2.62, 1.0, 1.2, room); box(0.06, 0.06, 0.96, M(0x3a2a1a), 2.62, 2.0, 0.75, room);
  // door (open, flat against the hallway wall)
  box(0.86, 1.98, 0.05, M(0x5a3b22, { kind: 'plank', vari: 0.06 }), 3.15, 1.0, 1.24, room);
  // hallway to bathroom
  const mHall = M(0x24202e, { kind: 'wall', vari: 0.05, rep: [4, 2] });
  box(6, 0.05, 1.0, M(0x2e2834, { kind: 'carpet', rep: [8, 2] }), 5.6, 0, 0.75, room); box(6, 2.4, 0.1, mHall, 5.6, 1.2, 0.2, room); box(6, 2.4, 0.1, mHall, 5.6, 1.2, 1.3, room); box(6, 0.1, 1.2, mHall, 5.6, 2.42, 0.75, room);
  // bathroom at end
  const bath = new THREE.Group(); bath.position.set(8.7, 0, 0.75); room.add(bath);
  box(0.1, 2.4, 1.2, M(0xf2f2ee, { vari: 0.05 }), 0.6, 1.2, 0, bath);
  const mPor = M(0xffffff, { vari: 0.03, rough: 0.3 });
  const toilet = new THREE.Group(); toilet.position.set(0.25, 0, 0); toilet.rotation.y = -Math.PI / 2; bath.add(toilet);
  cyl(0.2, 0.16, 0.4, 8, mPor, 0, 0.2, 0.05, toilet); cyl(0.23, 0.23, 0.05, 8, mPor, 0, 0.43, 0.05, toilet); box(0.42, 0.42, 0.16, mPor, 0, 0.62, -0.2, toilet); box(0.46, 0.05, 0.2, mPor, 0, 0.85, -0.2, toilet);
  const glowTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,248,210,1)'); gr.addColorStop(0.4, 'rgba(255,236,160,0.45)'); gr.addColorStop(1, 'rgba(255,230,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); glow.scale.set(2.4, 2.4, 1); glow.position.set(0.1, 0.9, 0); bath.add(glow);
  const bl = new THREE.PointLight(0xfff0c0, 10, 5, 1.2); bl.position.set(-0.3, 1.8, 0); bath.add(bl);
  ROOM.bathGlow = glow; ROOM.bathLight = bl;
  for (let i = 0; i < 5; i++) { const ray = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.6), BASIC(0xfff3b0, { transparent: true, opacity: 0.18, add: true, depthWrite: false, side: THREE.DoubleSide })); ray.position.set(0, 1.4, -0.4 + i * 0.2); ray.rotation.z = -0.2 + i * 0.1; ray.rotation.y = Math.PI / 2; bath.add(ray); }
  // LED strips
  const led = (w, h, d, col, x, y, z) => { const m = box(w, h, d, BASIC(col, { toneMapped: false }), x, y, z, room, false); ROOM.leds.push({ m, col: new THREE.Color(col) }); return m; };
  ROOM.leds = [];
  led(5.1, 0.04, 0.04, 0xb44dff, 0, 2.72, -1.43); led(5.1, 0.04, 0.04, 0x3f8cff, 0, 2.72, 3.0); led(0.04, 0.04, 4.4, 0xb44dff, -2.58, 2.72, 0.8); led(0.04, 0.04, 2.6, 0x3f8cff, 2.58, 2.72, -0.2);
  led(1.9, 0.03, 0.03, 0x3f8cff, 0.25, 0.73, -0.66); // under desk front
  led(1.6, 0.05, 0.03, 0xc04dff, 0.2, 1.75, -1.44); // behind monitors
  led(5.1, 0.03, 0.04, 0x8a3dff, 0, 0.05, 3.0); led(0.04, 0.03, 4.4, 0x3f8cff, -2.58, 0.05, 0.8);
  // desk
  const mDesk = M(0x16151a, { vari: 0.06, rough: 0.5 });
  box(1.95, 0.05, 0.72, mDesk, 0.25, 0.75, -1.0, room); for (const [x, z] of [[-0.68, -0.68], [1.18, -0.68], [-0.68, -1.32], [1.18, -1.32]]) box(0.05, 0.75, 0.05, mDesk, x, 0.375, z, room);
  box(0.9, 0.006, 0.36, M(0x2a1a44, { vari: 0.04 }), 0.05, 0.778, -0.82, room); // mousepad
  // keyboard
  const kbTex = canvasTex(64, 24, (g, w, h) => { g.fillStyle = '#111'; g.fillRect(0, 0, w, h); for (let y = 0; y < 5; y++) for (let x = 0; x < 15; x++) { const hue = (x * 18 + y * 12 + 200) % 360; g.fillStyle = `hsl(${hue},100%,62%)`; g.fillRect(1 + x * 4.2, 1 + y * 4.6, 3.2, 3.6); } }, true);
  const kb = box(0.5, 0.03, 0.17, M(0x111111, { tex: false }), -0.05, 0.795, -0.8, room);
  const kbTop = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.16), new THREE.MeshBasicMaterial({ map: kbTex, toneMapped: false })); kbTop.rotation.x = -Math.PI / 2; kbTop.position.set(-0.05, 0.8115, -0.8); room.add(kbTop); ROOM.kb = kb; ROOM.kbTop = kbTop;
  const mouse = box(0.07, 0.035, 0.11, M(0x1b1b1f, { tex: false, rough: 0.4 }), 0.3, 0.795, -0.8, room); box(0.012, 0.004, 0.08, BASIC(0x40c4ff, { toneMapped: false }), 0.0, 0.019, 0, mouse, false); ROOM.mouse = mouse;
  // cans
  const canTex = (c1, c2) => canvasTex(32, 32, (g) => { g.fillStyle = c1; g.fillRect(0, 0, 32, 32); g.fillStyle = c2; g.fillRect(0, 10, 32, 6); g.fillRect(6, 0, 3, 32); }, true);
  [[0.5, -0.95, '#111', '#39ff14'], [0.62, -0.88, '#1a1a8a', '#3fd0ff'], [-0.55, -0.9, '#e91e8c', '#ffeb3b'], [1.05, -0.8, '#111', '#39ff14'], [0.75, -1.15, '#1a1a8a', '#3fd0ff']].forEach(([x, z, a, b], i) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.125, 10), new THREE.MeshStandardMaterial({ map: canTex(a, b), roughness: 0.35, metalness: 0.4 })); c.position.set(x, 0.84, z); c.castShadow = true; room.add(c);
    const top = cyl(0.03, 0.033, 0.01, 10, M(0xcfcfcf, { tex: false, metal: 0.8, rough: 0.3 }), x, 0.907, z, room);
    if (i === 3) { c.rotation.z = Math.PI / 2; c.position.y = 0.81; top.visible = false; }
  });
  // monitors
  const mMon = M(0x0e0e12, { tex: false, rough: 0.4 });
  const mon1 = new THREE.Group(); mon1.position.set(0, 1.17, -1.17); room.add(mon1);
  box(0.9, 0.53, 0.04, mMon, 0, 0, -0.01, mon1); box(0.06, 0.32, 0.05, mMon, 0, -0.32, -0.05, mon1); box(0.3, 0.02, 0.2, mMon, 0, -0.41, -0.02, mon1);
  ROOM.screen1Mat = new THREE.MeshBasicMaterial({ color: 0xffffff }); const scr1 = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.49), ROOM.screen1Mat); scr1.position.z = 0.0105; mon1.add(scr1); ROOM.mon1 = mon1; ROOM.scr1 = scr1;
  const mon2 = new THREE.Group(); mon2.position.set(0.95, 1.15, -1.06); mon2.rotation.y = -0.6; room.add(mon2);
  box(0.82, 0.48, 0.04, mMon, 0, 0, -0.01, mon2); box(0.06, 0.3, 0.05, mMon, 0, -0.3, -0.05, mon2); box(0.28, 0.02, 0.2, mMon, 0, -0.38, -0.02, mon2);
  ROOM.ui2 = canvasTex(512, 288, (g, w, h) => drawStreamUI(g, w, h, 0, 'normal'));
  const scr2 = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.44), new THREE.MeshBasicMaterial({ map: ROOM.ui2 })); scr2.position.z = 0.0105; mon2.add(scr2);
  ROOM.vid2Mat = new THREE.MeshBasicMaterial({ color: 0xffffff }); const vid2 = new THREE.Mesh(new THREE.PlaneGeometry(0.78 * 0.66, 0.78 * 0.66 * 9 / 16), ROOM.vid2Mat); vid2.position.set(-0.78 * 0.15, 0.03, 0.012); mon2.add(vid2); ROOM.vid2 = vid2; ROOM.mon2 = mon2;
  // webcam
  box(0.12, 0.055, 0.05, M(0x18181c, { tex: false, rough: 0.4 }), 0, 1.465, -1.16, room); cyl(0.018, 0.018, 0.01, 12, BASIC(0x050508), 0, 1.465, -1.133, room).rotation.x = Math.PI / 2;
  ROOM.camLed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), BASIC(0xff2020, { toneMapped: false })); ROOM.camLed.position.set(0.04, 1.465, -1.134); room.add(ROOM.camLed);
  const ledGlowTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,60,60,1)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const lg = new THREE.Sprite(new THREE.SpriteMaterial({ map: ledGlowTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); lg.scale.set(0.05, 0.05, 1); lg.position.copy(ROOM.camLed.position); room.add(lg);
  // bed
  box(1.0, 0.3, 2.0, M(0x3b2a20, { vari: 0.08 }), -2.05, 0.15, 1.95, room); box(0.96, 0.16, 1.95, M(0xd9d6e8, { vari: 0.05 }), -2.05, 0.38, 1.95, room); box(0.98, 0.1, 1.3, M(0x3247a8, { vari: 0.1 }), -2.05, 0.48, 2.25, room); box(0.6, 0.12, 0.35, M(0xeeeeee, { vari: 0.04 }), -2.05, 0.52, 1.15, room);
  // posters
  const poster = (draw, x, y, z, ry, w, h) => { const t = canvasTex(64, 96, draw, true); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })); p.position.set(x, y, z); p.rotation.y = ry; room.add(p); };
  poster((g) => { g.fillStyle = '#1b0f3a'; g.fillRect(0, 0, 64, 96); g.fillStyle = '#ff4fa3'; g.beginPath(); g.arc(32, 40, 20, 0, 7); g.fill(); g.fillStyle = '#ffd23f'; g.fillRect(10, 70, 44, 8); g.fillStyle = '#40c4ff'; g.fillRect(16, 82, 32, 5); }, -0.9, 1.75, 3.0, Math.PI, 0.55, 0.8);
  poster((g) => { g.fillStyle = '#0d2b3a'; g.fillRect(0, 0, 64, 96); g.fillStyle = '#69f0ae'; g.fillRect(14, 20, 36, 22); g.fillRect(8, 30, 8, 8); g.fillRect(48, 30, 8, 8); g.fillStyle = '#111'; g.fillRect(20, 26, 6, 6); g.fillRect(38, 26, 6, 6); g.fillStyle = '#ff7a1a'; g.fillRect(10, 64, 44, 18); }, 0.6, 1.8, 3.0, Math.PI, 0.55, 0.8);
  poster((g) => { g.fillStyle = '#2a0d3a'; g.fillRect(0, 0, 64, 96); g.fillStyle = '#ffd23f'; for (let i = 0; i < 5; i++) g.fillRect(8 + i * 10, 80 - i * 12, 8, 12 + i * 12); }, -2.59, 1.8, 0.2, Math.PI / 2, 0.5, 0.75);
  poster((g) => { g.fillStyle = '#101a3a'; g.fillRect(0, 0, 64, 96); g.fillStyle = '#7c4dff'; g.beginPath(); g.moveTo(32, 10); g.lineTo(56, 80); g.lineTo(8, 80); g.fill(); g.fillStyle = '#40c4ff'; g.fillRect(24, 50, 16, 30); }, -1.1, 1.85, -1.44, 0, 0.5, 0.72);
  // shelf + figures
  box(0.9, 0.04, 0.22, M(0x2a2030), 1.6, 1.6, -1.38, room);
  [[1.3, 0xff4fa3], [1.5, 0x40c4ff], [1.7, 0xffd23f], [1.9, 0x69f0ae]].forEach(([x, c]) => { box(0.08, 0.14, 0.08, M(c), x, 1.69, -1.38, room); box(0.07, 0.07, 0.07, M(0xf0c8a0), x, 1.795, -1.38, room); });
  // window on left wall
  box(0.04, 0.9, 1.2, BASIC(0x0c1640), -2.6, 1.6, -0.2, room, false); box(0.05, 0.05, 1.24, M(0x222), -2.59, 1.6, -0.2, room); box(0.05, 0.94, 0.05, M(0x222), -2.59, 1.6, -0.2, room);
  for (let i = 0; i < 9; i++) box(0.03, 0.025, 1.22, M(0x30304a, { tex: false }), -2.57, 1.2 + i * 0.1, -0.2, room);
  // trash bin with cans
  cyl(0.15, 0.12, 0.35, 10, M(0x222233), -0.95, 0.175, -0.9, room);
}
function drawStreamUI(g, w, h, t, mode) {
  g.fillStyle = '#0e0e12'; g.fillRect(0, 0, w, h); g.fillStyle = '#18181b'; g.fillRect(0, 0, w, 22);
  g.fillStyle = '#9146ff'; g.fillRect(6, 6, 18, 10); g.fillStyle = '#e91916'; g.beginPath(); g.arc(40, 11, 5, 0, 7); g.fill(); g.fillStyle = '#555'; g.fillRect(52, 8, 60, 6);
  const cx = w * 0.69; g.fillStyle = '#18181b'; g.fillRect(cx, 22, w - cx, h - 22);
  const cols = ['#ff4f4f', '#4fc3ff', '#69f0ae', '#ffd23f', '#ff7ae0', '#b388ff', '#ff9e40'];
  const speed = mode === 'normal' ? 6 : 22; const off = (t * speed) % 1;
  for (let i = 0; i < 18; i++) {
    const y = 30 + (i - off) * 15 + 0; if (y < 26 || y > h - 8) continue; const k = Math.floor(t * speed) + i;
    g.fillStyle = cols[k % cols.length]; g.fillRect(cx + 8, y, 18 + hash(k) * 16, 6);
    if (mode === 'hearts' && hash(k + 7) < 0.7) { g.fillStyle = '#ff2d55'; heart(g, cx + 50, y + 3, 4); heart(g, cx + 62, y + 3, 4); if (hash(k + 9) < 0.5) heart(g, cx + 74, y + 3, 4); }
    else { g.fillStyle = '#9a9aa5'; g.fillRect(cx + 40 + hash(k) * 4, y, 30 + hash(k + 3) * 70, 6); }
  }
  g.fillStyle = '#222'; g.fillRect(8, h - 30, cx - 16, 22); g.fillStyle = '#e91916'; g.fillRect(14, h - 24, 22, 10); g.fillStyle = '#444'; g.fillRect(44, h - 22, 50, 6);
}
function heart(g, x, y, s) { g.beginPath(); g.moveTo(x, y + s); g.bezierCurveTo(x - s * 2, y - s * 0.5, x - s * 0.6, y - s * 1.8, x, y - s * 0.6); g.bezierCurveTo(x + s * 0.6, y - s * 1.8, x + s * 2, y - s * 0.5, x, y + s); g.fill(); }

// chair
function makeChair() {
  const g = new THREE.Group(); const mB = M(0x1a1a1f, { vari: 0.1 }), mP = M(0x7d2fd8, { vari: 0.1 }), mMetal = M(0x2c2c32, { tex: false, rough: 0.4, metal: 0.6 });
  const seatTop = 0.47; const c = { g, seatTop };
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; const l = box(0.05, 0.05, 0.34, mMetal, Math.sin(a) * 0.17, 0.08, Math.cos(a) * 0.17, g); l.rotation.y = a; const w = cyl(0.035, 0.035, 0.04, 8, mB, Math.sin(a) * 0.33, 0.035, Math.cos(a) * 0.33, g); w.rotation.z = Math.PI / 2; }
  cyl(0.035, 0.035, 0.28, 8, mMetal, 0, 0.24, 0, g);
  box(0.58, 0.1, 0.54, mB, 0, seatTop - 0.05, 0, g); box(0.08, 0.07, 0.54, mP, 0.27, seatTop + 0.0, 0, g); box(0.08, 0.07, 0.54, mP, -0.27, seatTop + 0.0, 0, g);
  const back = new THREE.Group(); back.position.set(0, seatTop + 0.12, -0.28); back.rotation.x = -0.14; g.add(back); c.back = back;
  box(0.56, 0.84, 0.12, mB, 0, 0.42, 0, back); box(0.07, 0.8, 0.125, mP, 0.17, 0.42, 0.003, back); box(0.07, 0.8, 0.125, mP, -0.17, 0.42, 0.003, back);
  box(0.1, 0.4, 0.15, mP, 0.29, 0.5, 0.02, back); box(0.1, 0.4, 0.15, mP, -0.29, 0.5, 0.02, back);
  box(0.62, 0.22, 0.13, mB, 0, 0.84, 0, back); box(0.3, 0.13, 0.08, mP, 0, 0.74, 0.09, back);
  // stitched emblem (no text): small purple diamond
  const em = box(0.08, 0.08, 0.01, BASIC(0xb46bff), 0, 0.86, 0.068, back, false); em.rotation.z = Math.PI / 4;
  c.arms = new THREE.Group(); g.add(c.arms); for (const sx of [1, -1]) { box(0.05, 0.2, 0.05, mMetal, sx * 0.32, seatTop + 0.06, -0.05, c.arms); box(0.09, 0.04, 0.3, mB, sx * 0.32, seatTop + 0.18, -0.02, c.arms); }
  // stain on seat
  const st = new THREE.Group(); g.add(st); st.position.set(0, seatTop + 0.003, -0.05); c.stain = st;
  const mSt = M(0x5b3511, { vari: 0.2 });
  const blob = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.012, 9), mSt); blob.scale.set(1.2, 1, 0.95); st.add(blob);
  [[0.13, 0.06, 0.06], [-0.12, -0.05, 0.05], [0.02, 0.15, 0.05], [-0.06, 0.13, 0.04], [0.16, -0.08, 0.04]].forEach(([x, z, r]) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.012, 7), mSt); b.position.set(x, 0, z); st.add(b); });
  const smear = box(0.32, 0.12, 0.012, mSt, 0, 0.1, 0.066, back, false); c.smear = smear;
  return c;
}
const chair = makeChair(); room.add(chair.g); chair.g.rotation.y = Math.PI;
const kid = makeKid(); room.add(kid.root);
const roomConf = makeConfetti(room, 600, [-1.4, 0.1, -1.4, 1.6, 2.6, 1.6]);
const heartTex = canvasTex(32, 32, (g) => { g.fillStyle = '#ff2d6f'; heart(g, 16, 16, 7); }, true);
const hearts = []; for (let i = 0; i < 12; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, toneMapped: false })); room.add(s); hearts.push(s); }
const webcamRT = new THREE.WebGLRenderTarget(512, 288); const gameRT = new THREE.WebGLRenderTarget(768, 432);
const webcamCam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 30); webcamCam.position.set(0, 1.44, -1.1); webcamCam.lookAt(0, 1.12, -0.2);
ROOM.vid2Mat.map = webcamRT.texture; ROOM.screen1Mat.map = gameRT.texture;
const victoryTex = canvasTex(768, 432, (g, w, h) => { });
function drawVictory(t) {
  const g = victoryTex.userData.g, w = 768, h = 432;
  const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6); gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.35, '#ffcc33'); gr.addColorStop(1, '#b86b00'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.save(); g.translate(w / 2, h / 2); for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.fillStyle = `rgba(255,255,255,${0.12 + 0.08 * Math.sin(t * 8 + i)})`; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, -40); g.lineTo(w, 40); g.fill(); } g.restore();
  g.font = '700 104px Pixelify'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 14; g.strokeStyle = '#5a2d00'; g.strokeText('VICTORY', w / 2, h / 2); g.fillStyle = '#fffbe6'; g.fillText('VICTORY', w / 2, h / 2);
  victoryTex.needsUpdate = true;
}
const CZ = -0.3; function placeKidSeated(k, lean = 0) { const s = k.C.scale; k.root.position.set(0, chair.seatTop + 0.17 * s, CZ - 0.08); k.root.rotation.y = Math.PI; }
function roomReset(t) {
  kidReset(kid); kid.root.visible = true; placeKidSeated(kid); poseSit(kid, 'keys', t);
  chair.stain.visible = false; chair.smear.visible = false; chair.g.position.set(0, 0, CZ); chair.g.rotation.set(0, Math.PI, 0);
  ROOM.leds.forEach(l => { l.m.material.color.copy(l.col); }); pPurple.intensity = 6; pBlue.intensity = 6; pBack1.intensity = 5; pBack2.intensity = 5; goldLight.intensity = 0; hemi.intensity = 0.95; key.intensity = 0.55; sideFill.intensity = 3.5; monLight.intensity = 5; monLight.color.setHex(0xbcd6ff); chair.arms.visible = true;
  room.fog = null; roomConf.update(0, 0); hearts.forEach(h => h.visible = false); ROOM.screen1Mat.map = gameRT.texture; ROOM.screen1Mat.color.setHex(0xffffff);
  ROOM.bathGlow.material.opacity = 1;
}
function flickerLeds(t, amt) { ROOM.leds.forEach((l, i) => { const f = hash(Math.floor(t * 14) + i * 13) < amt ? 0.15 : 1; l.m.material.color.copy(l.col).multiplyScalar(f); }); const f = 0.5 + 0.5 * hash(Math.floor(t * 14)); pPurple.intensity = 6 * (amt > 0 ? f : 1); pBlue.intensity = 6 * (amt > 0 ? (1.5 - f) : 1); }

// ======================= ARENA =======================
const arena = new THREE.Scene(); arena.background = new THREE.Color(0x05040d); arena.fog = new THREE.Fog(0x05040d, 18, 45);
arena.add(new THREE.HemisphereLight(0x7a8cff, 0x110820, 0.9));
const aKey = new THREE.SpotLight(0xfff0c0, 260, 30, 0.38, 0.5, 1.3); aKey.position.set(0, 12, 4); aKey.target.position.set(0, 2, -1); aKey.castShadow = true; aKey.shadow.mapSize.set(1024, 1024); arena.add(aKey, aKey.target);
const aBlue1 = new THREE.SpotLight(0x3d7bff, 160, 30, 0.5, 0.6, 1.3); aBlue1.position.set(-8, 10, 2); aBlue1.target.position.set(0, 1, -2); arena.add(aBlue1, aBlue1.target);
const aPink = new THREE.SpotLight(0xc040ff, 160, 30, 0.5, 0.6, 1.3); aPink.position.set(8, 10, 2); aPink.target.position.set(0, 1, -2); arena.add(aPink, aPink.target);
const trophyGrp = new THREE.Group();
{
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x0c0c1c, roughness: 0.35, metalness: 0.3 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; arena.add(fl);
  box(16, 0.8, 9, M(0x15142a, { vari: 0.05, rep: [8, 4] }), 0, 0.4, -2.5, arena);
  box(16, 0.06, 0.06, BASIC(0x3fb0ff, { toneMapped: false }), 0, 0.8, 2.0, arena, false); box(16, 0.06, 0.06, BASIC(0xc04dff, { toneMapped: false }), 0, 0.05, 2.03, arena, false);
  const scrTex = canvasTex(256, 144, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1b2cff'); gr.addColorStop(0.5, '#9b3cff'); gr.addColorStop(1, '#ff4fa3'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.save(); g.translate(w / 2, h / 2); for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.fillStyle = 'rgba(255,220,120,0.25)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, -12); g.lineTo(w, 12); g.fill(); } g.restore(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(w / 2, h / 2, 26, 0, 7); g.fill(); });
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(12, 6.75), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false, color: 0xbbbbbb })); sc.position.set(0, 5.6, -7); arena.add(sc);
  for (const sx of [-1, 1]) { const s2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 3), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false, color: 0x999999 })); s2.position.set(sx * 9.5, 5.2, -5.5); s2.rotation.y = -sx * 0.5; arena.add(s2); }
  // truss + light cones
  box(18, 0.25, 0.25, M(0x333340, { tex: false, metal: 0.7, rough: 0.4 }), 0, 9.5, 0, arena);
  ARENA_CONES = [];
  for (let i = 0; i < 6; i++) { const x = -7.5 + i * 3; const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 16, 1, true), BASIC([0xfff2c0, 0x6fa8ff, 0xd38bff][i % 3], { transparent: true, opacity: 0.07, add: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); cone.position.set(x, 5, 0); cone.rotation.z = (i < 3 ? -1 : 1) * 0.25; arena.add(cone); ARENA_CONES.push(cone); }
  // pedestal + trophy
  cyl(0.9, 1.0, 1.1, 10, M(0x111118, { tex: false, rough: 0.3 }), 0, 1.35, -1, arena); cyl(0.95, 0.95, 0.08, 10, BASIC(0xffc83d, { toneMapped: false }), 0, 1.88, -1, arena);
  const mGold = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 1, roughness: 0.22, emissive: 0x6a4200, emissiveIntensity: 0.6, flatShading: true });
  const prof = [[0, 0], [0.42, 0], [0.42, 0.12], [0.2, 0.18], [0.14, 0.5], [0.1, 0.7], [0.2, 0.82], [0.45, 1.0], [0.55, 1.35], [0.58, 1.6], [0.52, 1.62], [0.0, 1.62]].map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(prof, 10), mGold); cup.castShadow = true; trophyGrp.add(cup);
  for (const sx of [1, -1]) { const hd = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 5, 10, Math.PI), mGold); hd.position.set(sx * 0.55, 1.3, 0); hd.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2; trophyGrp.add(hd); }
  box(0.7, 0.25, 0.7, M(0x1a1a22, { tex: false, rough: 0.3 }), 0, -0.12, 0, trophyGrp);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mGold); star.position.y = 1.85; trophyGrp.add(star);
  arena.add(trophyGrp);
  const sparkTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.3, 'rgba(255,220,120,0.5)'); gr.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  ARENA_GLOW = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.8 })); ARENA_GLOW.scale.set(4, 4, 1); arena.add(ARENA_GLOW);
}
var ARENA_CONES, ARENA_GLOW;
// crowd
const crowdN = 900; const crowdBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), new THREE.MeshStandardMaterial({ roughness: 0.9 }), crowdN); const crowdHead = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.32, 0.3), new THREE.MeshStandardMaterial({ roughness: 0.9 }), crowdN);
const crowdArm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), new THREE.MeshStandardMaterial({ roughness: 0.9 }), crowdN * 2);
const phoneL = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: 0xeef6ff, toneMapped: false }), crowdN);
arena.add(crowdBody, crowdHead, crowdArm, phoneL); const crowdData = [];
{
  const c = new THREE.Color(); const skins = [0x8a5636, 0xe2b48d, 0xc68642, 0x5c3a21, 0xf1c27d]; const shirts = [0x1e63d6, 0xc8262b, 0x2e9e4f, 0x6a3fd6, 0x222222, 0xffffff, 0xff7a1a, 0x17a2b8];
  let n = 0; for (let row = 0; row < 18 && n < crowdN; row++) for (let i = 0; i < 50 && n < crowdN; i++) {
    const x = -15 + i * 0.62 + (row % 2) * 0.3 + (hash(n) - 0.5) * 0.15; const z = 3.6 + row * 0.85; const y = row * 0.32;
    crowdData.push([x, y, z, hash(n * 7), hash(n * 3)]); c.setHex(shirts[n % shirts.length]).multiplyScalar(0.6); crowdBody.setColorAt(n, c); c.setHex(skins[n % skins.length]).multiplyScalar(0.7); crowdHead.setColorAt(n, c); crowdArm.setColorAt(n * 2, c); crowdArm.setColorAt(n * 2 + 1, c); n++;
  }
}
const dmy = new THREE.Object3D();
function updateCrowd(t, hype = 1) {
  crowdData.forEach(([x, y, z, a, b], i) => {
    const jump = Math.max(0, Math.sin(t * (6 + a * 4) + a * 20)) * 0.18 * hype;
    dmy.position.set(x, y + 0.35 + jump, z); dmy.rotation.set(0, Math.PI, 0); dmy.scale.setScalar(1); dmy.updateMatrix(); crowdBody.setMatrixAt(i, dmy.matrix);
    dmy.position.set(x, y + 0.88 + jump, z); dmy.updateMatrix(); crowdHead.setMatrixAt(i, dmy.matrix);
    const up = b < 0.6 * hype;
    for (const s of [-1, 1]) { dmy.position.set(x + s * 0.31, y + (up ? 0.95 : 0.4) + jump, z); dmy.rotation.set(0, 0, up ? s * -0.3 + Math.sin(t * 8 + i) * 0.2 : 0); dmy.updateMatrix(); crowdArm.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), dmy.matrix); }
    dmy.rotation.set(0, 0, 0); dmy.position.set(x + 0.3, y + (b < 0.35 ? 1.25 : -5) + jump, z - 0.08); dmy.updateMatrix(); phoneL.setMatrixAt(i, dmy.matrix);
  });
  crowdBody.instanceMatrix.needsUpdate = crowdHead.instanceMatrix.needsUpdate = crowdArm.instanceMatrix.needsUpdate = phoneL.instanceMatrix.needsUpdate = true;
}
const winner = makeKid({ hoodie: 0x1e63d6, pants: 0x222831, skin: 0xd9a074, hair: 0x5a3a1a, headset: false, hood: false, scale: 1.25 }); arena.add(winner.root);
const arenaConf = makeConfetti(arena, 900, [-7, 0.5, -4, 7, 10, 4]);

// ======================= SHOTS =======================
const cam = new THREE.PerspectiveCamera(50, ASPECT, 0.03, 400);
function setCam(p, l, fov = 50) { cam.position.copy(p); cam.lookAt(l); cam.fov = fov; cam.updateProjectionMatrix(); }
function headW(k, off = [0, 0.21, 0]) { return wpos(k.head, off); }
let SCENE = room; let useGameRT = true, useWebRT = false, gameFn = gameGeneric;

const SHOTS = {
  s01(lt, d) { // webcam front, live
    face(kid, { eyes: 'dot', mouth: 'flat', brows: 'angry' }); kid.neck.rotation.x = -0.05;
    const h = headW(kid, [0, 0.12, 0]); setCam(V(0.02, 1.43, -1.06), V(0, h.y - 0.2, h.z), lerp(82, 70, ease(lt / d)));
  },
  s02(lt, d) {
    face(kid, { eyes: 'dot', mouth: 'flat', brows: 'angry' });
    setCam(V(lerp(1.7, 1.3, ease(lt / d)), 1.7, 1.45), V(0.05, 1.0, -0.85), 52);
  },
  s04a(lt, d) {
    face(kid, { eyes: 'dot', mouth: 'flat', brows: 'angry' }); kid.root.position.y += Math.sin(lt * 20) * 0.002;
    chair.arms.visible = false; setCam(V(1.75, 1.0, lerp(-0.1, -0.15, lt / d)), V(0, 0.86, -0.3), lerp(52, 50, lt / d));
  },
  s04b(lt, d) {
    face(kid, { eyes: 'wide', mouth: 'o', brows: 'up' }); poseSit(kid, 'stiff');
    const inflate = spring(lt * 1.4, 18, 6); setLump(kid, Math.max(0.01, inflate * 1.05), Math.sin(lt * 30) * 0.1 * Math.exp(-lt * 4));
    const lumpW = wpos(kid.lump, [0, 0, -0.09]);
    stink(room, V(lumpW.x, lumpW.y + 0.05, lumpW.z + 0.12), lt + 1, { n: 3, h: 0.45, amp: 0.035, r: 0.01, spread: 0.07, alpha: clamp(lt * 3) });
    const pin = easeOut(lt / 0.18);
    chair.arms.visible = false; const p0 = V(1.75, 1.0, -0.15), l0 = V(0, 0.86, -0.3); const p1 = V(1.25, 0.98, -0.04), l1 = V(lumpW.x, lumpW.y - 0.2, lumpW.z + 0.0);
    setCam(lerpV(p0, p1, pin), lerpV(l0, l1, pin), lerp(50, 46, pin));
  },
  s05(lt, d) {
    face(kid, { eyes: 'wide', mouth: 'flat', brows: 'up' }); poseSit(kid, 'stiff'); setLump(kid, 1.05); sweat(kid, 1, 0.3 + lt * 0.3);
    const h = headW(kid, [0, 0.2, 0]); const z = lerp(0.62, 0.5, ease(lt / d)); setCam(V(h.x, h.y + 0.02, h.z - z), h, 48);
  },
  s08(lt, d) {
    face(kid, { eyes: 'wide', mouth: 'flat' }); poseSit(kid, 'stiff'); setLump(kid, 1.05); kid.neck.rotation.y = -0.5;
    const z = easeOut(lt / 0.45); setCam(V(-0.6, 1.5, 0.3), V(8.7, 0.95, 0.75), lerp(50, 20, z));
    ROOM.bathGlow.material.opacity = 0.8 + 0.2 * Math.sin(lt * 10);
  },
  s09(lt, d) {
    face(kid, { eyes: 'wide' }); poseSit(kid, 'keys'); setLump(kid, 1.05);
    for (const a of [kid.armL, kid.armR]) a.el.rotation.x += Math.sin(lt * 40 + (a === kid.armL ? 1 : 0)) * 0.02;
    sweat(kid, 0, 0);
    const pin = easeOut(lt / 0.25); setCam(V(-0.32, lerp(1.32, 1.2, pin), -1.05), V(-0.24, 0.8, -0.74), lerp(56, 50, pin));
    dropsOnDesk(lt);
  },
  s10(lt, d) {
    face(kid, { eyes: 'wide', mouth: 'grit', brows: 'worried' }); poseSit(kid, 'stiff'); setLump(kid, 1.05); sweat(kid, 5, lt);
    kid.root.position.x += Math.sin(lt * 50) * 0.002;
    const lumpW = wpos(kid.lump, [0, 0, -0.09]); stink(room, V(lumpW.x, lumpW.y + 0.05, lumpW.z + 0.15), lt, { n: 3, h: 0.5, amp: 0.035, r: 0.01, spread: 0.08 });
    chair.arms.visible = false; const k2 = ease(lt / d); setCam(V(lerp(1.5, 1.3, k2), 1.0, lerp(0.18, 0.1, k2)), V(0, 0.86, -0.3), 46);
  },
  s11(lt, d) {
    drawStreamUI(ROOM.ui2.userData.g, 512, 288, lt + 3, 'fast'); ROOM.ui2.needsUpdate = true; useWebRT = true;
    face(kid, { eyes: 'wide', mouth: 'grit', brows: 'worried' }); poseSit(kid, 'stiff'); setLump(kid, 1.05); sweat(kid, 4, lt);
    const m = ROOM.mon2; const c = wpos(m, [0, 0, 0]); const n = wpos(m, [0, 0, 1]).sub(c); const k2 = ease(lt / d);
    setCam(c.clone().add(n.clone().multiplyScalar(lerp(0.95, 0.8, k2))).add(V(-0.1, 0.05, 0)), c.clone().add(V(0, 0.0, 0)), 46);
  },
  s12(lt, d) {
    face(kid, { eyes: 'wide', mouth: 'grit', brows: 'worried' }); sweat(kid, 7, lt * 1.6); poseSit(kid, 'stiff'); setLump(kid, 1.05);
    const h = headW(kid, [0, 0.2, 0]); const z = lerp(0.66, 0.56, ease(lt / d)); setCam(V(h.x + 0.02, h.y + 0.08, h.z - z), V(h.x, h.y - 0.04, h.z), 50);
  },
  s13(lt, d) {
    face(kid, { eyes: 'wide', mouth: 'grit' }); poseSit(kid, 'keys'); setLump(kid, 1.05); sweat(kid, 4, lt);
    for (const a of [kid.armL, kid.armR]) { a.sh.rotation.x += Math.sin(lt * 70) * 0.03; a.el.rotation.x += Math.cos(lt * 63) * 0.04; a.sh.rotation.z += Math.sin(lt * 55) * 0.02; }
    ROOM.mouse.position.x = 0.3 + Math.sin(lt * 60) * 0.006;
    setCam(V(0.34, 1.22, -1.1), V(0.27, 0.82, -0.76), 54);
    dropsOnDesk(lt);
  },
  s16(lt, d, big = false) {
    chair.g.position.z = 0; kid.root.position.z = -0.08; face(kid, { eyes: 'wide', mouth: 'wobble', brows: 'worried' }); poseSit(kid, 'belly'); setLump(kid, 1.05); kid.rumble.visible = true;
    const amp = big ? 1.5 : 1; kid.spine.position.x = Math.sin(lt * 45) * 0.008 * amp;
    kid.rumbleArcs.forEach((a, i) => { const ang = i * 1.05 + Math.sin(lt * 20 + i) * 0.2; const r = (0.25 + (i % 2) * 0.06) * (1 + 0.1 * Math.sin(lt * 30 + i)); a.position.set(Math.cos(ang) * r, Math.sin(ang) * r * 0.8, 0.02); a.rotation.z = ang - Math.PI * 0.27; a.scale.setScalar(amp * (0.9 + 0.2 * hash(Math.floor(lt * 12) + i))); });
    room.updateMatrixWorld(true); const b = wpos(kid.spine, [0, 0.2, 0.2]); setCam(V(b.x + 0.22, b.y + 0.12, b.z - lerp(0.75, 0.62, lt / d) * (big ? 0.85 : 1)), V(b.x, b.y + 0.02, b.z), 50);
  },
  s17(lt, d) {
    face(kid, { eyes: 'wide' }); poseSit(kid, 'keys'); setLump(kid, 1.05); sweat(kid, 3, lt);
    const lumpW = wpos(kid.lump, [0, 0, -0.09]); const hd = headW(kid, [0, 0.1, 0]);
    stink(room, V(lumpW.x, lumpW.y, lumpW.z + 0.18), lt, { n: 4, h: lerp(0.4, 0.95, ease(lt / d)), amp: 0.05, r: 0.013, spread: 0.08, speed: 0.4 });
    chair.arms.visible = false; const k2 = ease(lt / d); setCam(V(1.25, lerp(0.72, 1.0, k2), 0.15), V(0, lerp(0.72, 1.18, k2), -0.25), 50);
  },
  s18(lt, d) {
    face(kid, { eyes: 'squint', mouth: 'wobble', brows: 'angry' }); poseSit(kid, 'keys'); setLump(kid, 1.05); kid.neck.rotation.x = 0.12; kid.head.rotation.y = 0.15;
    const nose = headW(kid, [0, 0.16, 0.2]);
    stink(room, V(nose.x + 0.12, nose.y - 0.5, nose.z + 0.05), lt, { n: 3, h: 0.5, amp: 0.04, r: 0.012, spread: 0.04, dz: -0.08, speed: 0.6 });
    const pin = easeOut(lt / 0.3); setCam(V(nose.x + lerp(0.42, 0.32, pin), nose.y + 0.02, nose.z - lerp(0.42, 0.34, pin)), V(nose.x, nose.y - 0.03, nose.z + 0.04), 42);
  },
  s19(lt, d) {
    face(kid, { eyes: 'wide', mouth: 'wobble', brows: 'worried', tears: lerp(0.15, 0.55, lt / d), shine: true, t: lt }); poseSit(kid, 'keys'); setLump(kid, 1.05);
    const e = headW(kid, [0, 0.23, 0.19]); const z = lerp(0.42, 0.33, ease(lt / d)); setCam(V(e.x, e.y + 0.01, e.z - z), e, 40);
    room.fog = new THREE.FogExp2(0x2a5a20, 0.25);
  },
  s20(lt, d) {
    face(kid, { eyes: 'dot', mouth: 'wobble', brows: 'worried', tears: 1, shine: true, t: lt }); poseSit(kid, 'keys'); setLump(kid, 1.05);
    kid.face.mWobble.position.y = Math.sin(lt * 18) * 0.004;
    const h = headW(kid, [0, 0.12, 0]); setCam(V(0.02, 1.43, -1.06), V(0, h.y - 0.05, h.z), 48);
  },
  s21(lt, d) {
    drawStreamUI(ROOM.ui2.userData.g, 512, 288, lt + 10, 'hearts'); ROOM.ui2.needsUpdate = true; useWebRT = true;
    face(kid, { eyes: 'dot', mouth: 'wobble', brows: 'worried', tears: 1, t: lt }); poseSit(kid, 'keys'); setLump(kid, 1.05);
    const m = ROOM.mon2; const c = wpos(m, [0, 0, 0]); const n = wpos(m, [0, 0, 1]).sub(c);
    hearts.forEach((s, i) => { const ph = (lt * 0.45 + i / hearts.length) % 1; const p = wpos(m, [(hash(i) - 0.5) * 0.7, -0.2 + ph * 0.55, 0.08 + hash(i + 3) * 0.15]); s.position.copy(p); s.scale.setScalar(0.06 + 0.03 * hash(i + 5)); s.material.opacity = Math.sin(Math.PI * ph); s.visible = true; });
    setCam(c.clone().add(n.clone().multiplyScalar(lerp(0.85, 0.72, ease(lt / d)))).add(V(-0.05, 0.03, 0)), c, 46);
  },
  s22(lt, d) {
    face(kid, { eyes: 'dot', mouth: 'smile', brows: 'worried', tears: 1, blush: true, t: lt }); poseSit(kid, 'thumbs'); setLump(kid, 1.05);
    kid.armR.sh.rotation.x += Math.sin(lt * 25) * 0.03;
    const h = headW(kid, [0, 0.12, 0]); setCam(V(0.0, 1.4, -1.06), V(h.x + 0.04, h.y - 0.14, h.z), lerp(60, 54, ease(lt / d)));
  },
  s23(lt, d) {
    face(kid, { eyes: 'dot', brows: 'worried' }); poseSit(kid, 'keys'); setLump(kid, 1.05);
    hemi.intensity = 0.35; pBack1.intensity = 2; pBack2.intensity = 2; key.intensity = 0.25;
    const lumpW = wpos(kid.lump, [0, 0, -0.09]); stink(room, V(lumpW.x, lumpW.y, lumpW.z + 0.15), lt, { n: 3, h: 0.55, amp: 0.04, r: 0.011, spread: 0.08, alpha: 0.55 });
    chair.arms.visible = false; const k2 = ease(lt / d); setCam(V(lerp(2.1, 1.7, k2), 1.45, lerp(1.4, 1.0, k2)), V(0, 0.9, -0.45), 50);
  },
  s26(lt, d) {
    face(kid, { eyes: 'dot', mouth: 'flat', brows: 'worried' }); poseSit(kid, 'stiff'); setLump(kid, 1.1); sweat(kid, 6, lt);
    const lumpW = wpos(kid.lump, [0, 0, -0.09]); stink(room, V(lumpW.x, lumpW.y + 0.02, lumpW.z + 0.15), lt, { n: 3, h: 0.55, amp: 0.04, r: 0.011, spread: 0.08 });
    chair.arms.visible = false; const k2 = ease(lt / d); setCam(lerpV(V(1.65, 1.05, -0.05), V(1.1, 0.85, -0.12), k2), lerpV(V(0, 0.95, -0.3), V(lumpW.x, lumpW.y + 0.1, lumpW.z - 0.06), k2), 44);
  },
  s28(lt, d) {
    ROOM.screen1Mat.map = victoryTex; drawVictory(lt); useGameRT = false;
    face(kid, { eyes: 'happy', mouth: 'open' }); poseSit(kid, lt > 0.55 ? 'fists' : 'keys'); setLump(kid, 1.05);
    goldLight.intensity = 7 + 3 * Math.sin(lt * 20); monLight.color.setHex(0xffd36b); monLight.intensity = 7; hemi.intensity = 1.0;
    roomConf.update(lt + 2, clamp(lt * 3), 0.035); flickerLeds(lt, 0.4);
    chair.arms.visible = false; const pin = easeOut(lt / 0.18); setCam(V(0.0, 1.16, lerp(-0.5, -0.6, pin)), V(0, 1.0, -1.17), lerp(100, 84, pin) + Math.sin(lt * 9) * 1.5);
  },
  s29(lt, d) {
    face(kid, { eyes: 'happy', mouth: 'open', tears: 0.7, t: lt }); poseSit(kid, 'fists'); setLump(kid, 1.05); sweat(kid, 5, lt * 2);
    kid.armL.sh.rotation.x += Math.sin(lt * 18) * 0.12; kid.armR.sh.rotation.x += Math.cos(lt * 18) * 0.12; kid.root.position.y += Math.abs(Math.sin(lt * 12)) * 0.015;
    goldLight.intensity = 1.0; monLight.color.setHex(0xfff0d8); monLight.intensity = 2.6; roomConf.update(lt + 4, 1, 0.035); flickerLeds(lt, 0.3);
    const h = headW(kid, [0, 0.12, 0]); setCam(V(0.02, 1.4, -1.0), V(0, h.y - 0.05, h.z), lerp(56, 50, ease(lt / d)));
  },
  s30(lt, d) {
    face(kid, { eyes: 'happy', mouth: 'open' });
    const up = easeOut(lt / 0.35); const s = kid.C.scale;
    // from seated to standing
    const standY = (0.06 + 0.8 + 0.06) * s + Math.max(0, Math.sin(clamp((lt - 0.3) / 0.5) * Math.PI)) * 0.12;
    chair.arms.visible = false; kid.root.position.set(0, lerp(chair.seatTop + 0.17 * s, standY, up), lerp(CZ - 0.08, CZ - 0.24, up)); kid.root.rotation.y = Math.PI;
    kid.legL.hp.rotation.x = kid.legR.hp.rotation.x = lerp(-Math.PI / 2, 0, up); kid.legL.kn.rotation.x = kid.legR.kn.rotation.x = lerp(Math.PI / 2, 0.05, up);
    armPose(kid, 'up'); kid.armL.sh.rotation.x += Math.sin(lt * 14) * 0.15; kid.armR.sh.rotation.x += Math.cos(lt * 14) * 0.15;
    setLump(kid, lerp(1.05, 1.6, up), Math.sin(lt * 22) * 0.12 * Math.exp(-lt * 1.5));
    goldLight.intensity = 5; monLight.color.setHex(0xffd36b); roomConf.update(lt + 6, 1, 0.035); flickerLeds(lt, 0.25);
    const lumpW = wpos(kid.lump, [0, 0, -0.09]); stink(room, V(lumpW.x, lumpW.y + 0.05, lumpW.z + 0.25), lt, { n: 4, h: 0.6, amp: 0.05, r: 0.013, spread: 0.1 });
    const k2 = easeOut(lt / d); setCam(V(lerp(1.5, 2.1, k2), lerp(1.05, 1.2, k2), lerp(0.05, 0.25, k2)), V(0, lerp(0.95, 1.1, k2), -0.45), 50);
  },
  s31(lt, d) {
    // kid stands to the side, chair empty with stain; webcam view push-in
    face(kid, { eyes: 'happy', mouth: 'open' }); const s = kid.C.scale;
    kid.root.position.set(-0.8, (0.06 + 0.8 + 0.06) * s, -0.55); kid.root.rotation.y = Math.PI * 0.85; armPose(kid, 'up'); setLump(kid, 1.6);
    chair.stain.visible = true; chair.smear.visible = true; chair.g.rotation.y = Math.PI + 0.15;
    const sp = wpos(chair.stain, [0, 0, 0]); stink(room, V(sp.x, sp.y, sp.z), lt, { n: 4, h: 0.7, amp: 0.05, r: 0.014, spread: 0.1 });
    flickerLeds(lt, lt > 0.5 ? 0.15 : 0);
    const k2 = ease(lt / d); setCam(lerpV(V(0.02, 1.43, -1.06), V(0.0, 1.1, -0.82), k2), lerpV(V(0, 0.75, -0.2), V(sp.x, sp.y + 0.03, sp.z), k2), lerp(60, 48, k2));
  },
  s32(lt, d) {
    face(kid, { eyes: 'wide', mouth: 'o' }); const s = kid.C.scale;
    kid.root.position.set(-0.85, (0.06 + 0.8 + 0.06) * s, -0.15); kid.root.rotation.y = Math.PI * 1.1; armPose(kid, 'halfup'); setLump(kid, 1.6);
    chair.stain.visible = true; chair.smear.visible = true; chair.g.rotation.y = Math.PI + 0.15;
    const sp = wpos(chair.stain, [0, 0, 0]); stink(room, V(sp.x, sp.y, sp.z), lt, { n: 4, h: 1.1, amp: 0.07, r: 0.016, spread: 0.12 });
    const lumpW = wpos(kid.lump, [0, 0, -0.09]); stink(room, V(lumpW.x, lumpW.y + 0.05, lumpW.z + 0.25), lt + 0.5, { n: 3, h: 1.0, amp: 0.06, r: 0.015, spread: 0.1 });
    for (let i = 0; i < 6; i++) stink(room, V(-2 + i * 0.8, 0.3, -0.8 + (i % 3) * 1.2), lt + i, { n: 2, h: 1.6, amp: 0.08, r: 0.016, spread: 0.2, alpha: 0.6 });
    flickerLeds(lt, 0.35); room.fog = new THREE.FogExp2(0x3c7a2a, lerp(0.02, 0.18, ease(lt / d)));
    const k2 = ease(lt / d); setCam(V(lerp(1.5, 2.0, k2), 1.7, lerp(2.0, 2.6, k2)), V(-0.3, 0.9, -0.45), lerp(54, 58, k2));
  },
};
const deskDrops = []; { const mS = new THREE.MeshStandardMaterial({ color: 0x9fe0ff, emissive: 0x3a9ee0, emissiveIntensity: 0.5, roughness: 0.1 }); for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.012, 1), mS); room.add(m); deskDrops.push(m); } }
function dropsOnDesk(lt) { deskDrops.forEach((m, i) => { const ph = (lt * 0.9 + hash(i)) % 1; m.visible = true; m.position.set(-0.2 + hash(i + 1) * 0.6, lerp(1.1, 0.8, ph), -0.7 - hash(i + 2) * 0.15); m.scale.set(1, 1.4, 1); }); }
SHOTS.s16b = (lt, d) => SHOTS.s16(lt, d, true);

// game shots
const GSHOTS = {
  s03(lt, d) { // aerial final circle
    gameReset(); setStorm(lerp(26, 13, ease(lt / d)), lt + 2);
    gameWalls[0].visible = true; gameWalls[0].position.set(-2, 0.5, 2); gameWalls[1].visible = true; gameWalls[1].position.set(3, 0.5, -3); gameWalls[1].rotation.y = 1.2;
    avatar.root.visible = true; standKid(avatar, -1, 4, Math.PI); enemy.root.visible = true; standKid(enemy, 2, -5, 0);
    const k2 = ease(lt / d); gameCam.position.set(0, lerp(62, 40, k2), lerp(9, 5, k2)); gameCam.lookAt(0, 0, 0); gameCam.fov = 50; gameCam.updateProjectionMatrix();
  },
  s06(lt, d) {
    gameReset(); setStorm(15, lt + 5);
    avatar.root.visible = true; standKid(avatar, 0, 8, Math.PI); armPose(avatar, 'keys'); avatar.spine.rotation.x = 0.1;
    enemy.root.visible = true; standKid(enemy, 0.6, -6, 0); armPose(enemy, 'keys'); enemy.spine.rotation.x = 0.1;
    gameWalls[0].visible = true; gameWalls[0].position.set(-1.6, 0.4, -4.4); gameWalls[1].visible = true; gameWalls[1].position.set(2.6, 0.4, -4.6); gameWalls[1].rotation.y = -0.3;
    const k2 = ease(lt / d); gameCam.position.set(lerp(1.3, 1.0, k2), 2.5, lerp(11.8, 10.6, k2)); gameCam.lookAt(0.3, 1.8, -6); gameCam.fov = lerp(52, 44, k2); gameCam.updateProjectionMatrix();
  },
  s07(lt, d) {
    gameReset(); const R = lerp(17, 9.5, ease(lt / d)); setStorm(R, lt * 2, 0, 0);
    for (let i = 0; i < 3; i++) { gameWalls[i].visible = true; gameWalls[i].position.set(-4 + i * 4, 0.5, -3 - i * 1.5); gameWalls[i].rotation.y = 0.3 * i; }
    gameCam.position.set(0, 1.6, 6); gameCam.lookAt(0, 3.5, -20); gameCam.fov = 62; gameCam.updateProjectionMatrix();
  },
  s14(lt, d) {
    gameReset(); setStorm(18, lt + 8);
    enemy.root.visible = true; const ep = [0, 0.4, -5]; standKid(enemy, ep[0], ep[2], 0); armPose(enemy, 'keys'); enemy.armR.sh.rotation.x = -1.6 + Math.sin(lt * 20) * 0.4;
    const seq = [[0, 0, 1.4, 0], [1, 0, 1.4, 1], [0, 3, 1.4, 2], [1, 3, 1.4, 3], [0, 6, 1.4, 4], [1, 6, 1.4, 5]];
    // walls stacking up into a tower in front of enemy
    for (let i = 0; i < 6; i++) { const w = gameWalls[i]; const x = (i % 2 ? 1.5 : -1.5); w.position.set(x, 0.4 + Math.floor(i / 2) * 3, -3.4); popScale(w, 0.08 + i * 0.17, lt); }
    for (let i = 0; i < 3; i++) { const r = gameRamps[i]; r.position.set(0, 0.4 + i * 3, -5.6); popScale(r, 0.16 + i * 0.34, lt); }
    enemy.root.position.y += easeOut((lt - 0.4) / 0.8) * 6;
    const k2 = ease(lt / d); gameCam.position.set(3.2, lerp(2.0, 3.5, k2), 9); gameCam.lookAt(0, lerp(2.0, 6.5, k2), -4); gameCam.fov = 55; gameCam.updateProjectionMatrix();
  },
  s15(lt, d) {
    gameReset(); setStorm(16, lt + 9); fpGun.visible = true;
    const order = [[0, -2.5, 0], [-3, -2.5, 0], [3, -2.5, 0], [0, -2.5, 3]];
    order.forEach(([x, z, y], i) => { const w = gameWalls[i]; w.position.set(x, 0.6 + y, z); popScale(w, 0.05 + i * 0.25, lt); });
    const r = gameRamps[0]; r.position.set(0, 0.6, -5); r.rotation.y = 0; popScale(r, 0.62, lt); r.visible = r.visible;
    let punch = 0; for (let i = 0; i < 4; i++) { const x = lt - (0.05 + i * 0.25); if (x > 0) punch += Math.exp(-x * 18) * 0.15; }
    gameCam.position.set(0, 1.9, 2.5 - punch); gameCam.lookAt(0, 2.1, -6); gameCam.fov = 64 - punch * 30; gameCam.updateProjectionMatrix();
    fpGun.position.y = -0.32 - punch * 0.3;
  },
  s15b(lt, d) { GSHOTS.s15(lt + 0.62, d); },
  s27(lt, d) {
    gameReset(); setStorm(17, lt + 12); fpGun.visible = true; crosshair.visible = true;
    gameWalls[0].visible = true; gameWalls[0].position.set(0.2, 0.4, -12.5);
    const shootT = 0.92; const after = lt - shootT;
    enemy.root.visible = true; standKid(enemy, after < 0 ? 0.2 + Math.sin(clamp(lt / 0.8) * Math.PI * 0.5) * 1.75 : 1.95, -13.2, 0); armPose(enemy, 'keys');
    if (after > 0) { enemy.root.rotation.x = -easeOut(after / 0.3) * 1.4; enemy.root.position.z -= easeOut(after / 0.3) * 1.2; enemy.root.position.y -= easeOut(after / 0.4) * 0.7; face(enemy, { eyes: 'wide', mouth: 'o' }); }
    if (after > 0) hitPuffs.forEach((b, i) => { b.visible = after < 0.55; const a = hash(i) * 6.28, e = hash(i + 9) * 2; const r = easeOut(after / 0.5) * (1 + hash(i + 3) * 1.6); b.position.set(1.95 + Math.cos(a) * r, 2.0 + Math.sin(a) * r * 0.8 + e * after, -13 + Math.sin(a * 3) * 0.5); b.scale.setScalar(1 - after * 1.4); b.rotation.set(after * 5 + i, after * 4, 0); });
    const zoom = ease(lt / 0.8); const aimX = lerp(0.2, 1.95, ease(lt / 0.75));
    const recoil = after > 0 ? Math.exp(-after * 14) * 0.08 : 0;
    gameCam.position.set(0, 1.9, 0); gameCam.lookAt(aimX, 1.95 + recoil * 4, -13.2); gameCam.fov = lerp(50, 22, zoom); gameCam.updateProjectionMatrix();
    muzzle.visible = after > 0 && after < 0.08; fpGun.position.z = -0.75 + recoil * 2;
  },
};

// arena shots
const ASHOTS = {
  s24(lt, d) {
    updateCrowd(lt, 1); arenaConf.update(lt, clamp(lt * 2), 0.12); winner.root.visible = false;
    trophyGrp.position.set(0, 2.05, -1); trophyGrp.rotation.y = lt * 0.6; trophyGrp.scale.setScalar(1.3); ARENA_GLOW.position.set(0, 3.1, -0.8); ARENA_GLOW.material.opacity = 0.6 + 0.3 * Math.sin(lt * 6);
    ARENA_CONES.forEach((c, i) => c.rotation.z = (i < 3 ? -1 : 1) * (0.25 + 0.12 * Math.sin(lt * 1.5 + i)));
    const pin = lt > 1.5 ? easeOut((lt - 1.5) / 0.2) : 0; const k2 = ease(lt / 1.5);
    const p = lerpV(V(0, 5.4, 10.5), V(0, 3.6, 6.8), k2); const p2 = lerpV(p, V(0, 3.1, 5.0), pin);
    setCam(p2, V(0, lerp(3.0, 3.0, k2), -1), lerp(52, 44, pin));
  },
  s25(lt, d) {
    updateCrowd(lt + 3, 1.2); arenaConf.update(lt + 3, 1, 0.12);
    winner.root.visible = true; kidReset(winner); const s = winner.C.scale; winner.root.position.set(0, 0.8 + (0.06 + 0.8 + 0.06) * s + Math.abs(Math.sin(lt * 5)) * 0.06, -0.5); winner.root.rotation.y = 0; armPose(winner, 'trophy'); face(winner, { eyes: 'happy', mouth: 'open' });
    const hp = wpos(winner.armL.el, [-0.32, -0.42, 0]); trophyGrp.position.copy(hp); trophyGrp.rotation.y = Math.sin(lt * 2) * 0.3; trophyGrp.scale.setScalar(0.85);
    ARENA_GLOW.position.copy(hp).add(V(0, 0.9, 0.3));
    ARENA_CONES.forEach((c, i) => c.rotation.z = (i < 3 ? -1 : 1) * (0.25 + 0.15 * Math.sin(lt * 2 + i)));
    const k2 = ease(lt / d); setCam(V(0, lerp(3.0, 3.9, k2), lerp(5.5, 8.5, k2)), V(0, lerp(3.2, 3.0, k2), -0.5), 50);
  },
};

// ---------- main render ----------
const sceneOf = id => GSHOTS[id] ? 'game' : ASHOTS[id] ? 'arena' : 'room';
window.renderFrame = function (id, lt, d, gt, fmt = 'jpeg') {
  stinkBegin(); deskDrops.forEach(m => m.visible = false); ROOM.mouse.position.x = 0.3;
  const which = sceneOf(id);
  if (which === 'game') {
    GSHOTS[id](lt, d); renderer.setRenderTarget(null); renderer.render(game, gameCam);
  } else if (which === 'arena') {
    ASHOTS[id](lt, d); renderer.render(arena, cam);
  } else {
    roomReset(gt); useGameRT = true; useWebRT = false; kid.spine.position.x = 0;
    drawStreamUI(ROOM.ui2.userData.g, 512, 288, gt, 'normal'); ROOM.ui2.needsUpdate = true;
    SHOTS[id](lt, d);
    room.updateMatrixWorld(true);
    if (useGameRT) { gameGeneric(gt); sun.castShadow = false; renderer.setRenderTarget(gameRT); renderer.render(game, gameCam); renderer.setRenderTarget(null); sun.castShadow = true; }
    if (useWebRT) { ROOM.vid2.visible = false; renderer.setRenderTarget(webcamRT); renderer.render(room, webcamCam); renderer.setRenderTarget(null); ROOM.vid2.visible = true; }
    renderer.render(room, cam);
  }
  return renderer.domElement.toDataURL(fmt === 'png' ? 'image/png' : 'image/jpeg', 0.93);
};
(async () => { try { const f = new FontFace('Pixelify', 'url(./PixelifySans.ttf)', { weight: '400 700' }); await f.load(); document.fonts.add(f); } catch (e) { console.log('font fail ' + e); } window.ready = true; })();
window.debugPos = function(arms){ roomReset(0); poseSit(kid, arms||'keys'); room.updateMatrixWorld(true); const f=v=>v.toArray().map(x=>+x.toFixed(3));
 return {handL:f(wpos(kid.armL.hand)),handR:f(wpos(kid.armR.hand)),head:f(headW(kid)),lump:f(wpos(kid.lump,[0,0,-0.09])),pelvis:f(wpos(kid.root)),shL:f(wpos(kid.armL.sh)),belly:f(wpos(kid.spine,[0,0.16,0.17])),nose:f(headW(kid,[0,0.16,0.2]))}; };
