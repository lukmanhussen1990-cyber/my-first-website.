// Shared building blocks: math, pixel-noise materials, faceted blocky characters, faces, IK, icons.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { mergeGeometries };

// ------------------------------------------------------------------ math
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeOutBack = (x) => { const c1 = 1.9, c3 = c1 + 1; x = clamp(x); return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
export function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const noise1 = (t, s = 0) => Math.sin(t * 1.7 + s) * 0.5 + Math.sin(t * 3.1 + s * 2.3) * 0.3 + Math.sin(t * 5.3 + s * 0.7) * 0.2;

// ------------------------------------------------------------------ textures & materials
export function canvasTex(w, h, draw, { nearest = true, repeat = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) t.magFilter = THREE.NearestFilter;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.userData.canvas = c;
  return t;
}
const hexToRgb = (hex) => { const h = new THREE.Color(hex).getHexString(); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
// Minecraft-like pixel grain for a flat colour
export function noiseTex(color, amt = 0.07, size = 16, seed = 1, repeat = null) {
  const [r, g, b] = hexToRgb(color);
  const rand = rng(seed + Math.floor(r * 7 + g * 13 + b * 17));
  return canvasTex(size, size, (ctx) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const k = 1 + (rand() - 0.5) * 2 * amt;
      ctx.fillStyle = `rgb(${clamp(r * k, 0, 255) | 0},${clamp(g * k, 0, 255) | 0},${clamp(b * k, 0, 255) | 0})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }, { repeat });
}
const matCache = new Map();
export function M(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const { plain = false, amt = 0.07, phong = false, ...rest } = opts;
  let m;
  if (plain) m = new THREE.MeshLambertMaterial({ color, ...rest });
  else if (phong) m = new THREE.MeshPhongMaterial({ map: noiseTex(color, amt), shininess: 80, specular: '#ffffff', ...rest });
  else m = new THREE.MeshLambertMaterial({ map: noiseTex(color, amt), ...rest });
  matCache.set(key, m);
  return m;
}
export const unitBox = new THREE.BoxGeometry(1, 1, 1);
export function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(unitBox, mat);
  m.scale.set(w, h, d); m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = true;
  parent.add(m); return m;
}
export function pixelSpriteTex(rows, palette, scale = 8) {
  const h = rows.length, w = rows[0].length;
  return canvasTex(w * scale, h * scale, (g) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = rows[y][x]; if (palette[ch]) { g.fillStyle = palette[ch]; g.fillRect(x * scale, y * scale, scale, scale); } }
  });
}
export function sprite(scene, tex, opts = {}) {
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, ...opts });
  const s = new THREE.Sprite(m); s.visible = false; scene.add(s); return s;
}

// ------------------------------------------------------------------ faces (32x32 pixel grid)
const CELL = 8;
const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x) * CELL, Math.round(y) * CELL, w * CELL, h * CELL); };
export const FACE_DEF = { look: [0, 0], open: 1, eyes: 'normal', size: 1, pupil: 3, brow: 'none', mouth: 'flat', blush: 0, red: 0, lids: 0, tears: 0, soot: 0, dust: 0, glint: 0, t: 0 };
function drawFace(g, s, o) {
  const skin = s.soot > 0.5 ? '#2a2522' : o.skin;
  g.fillStyle = skin; g.fillRect(0, 0, 256, 256);
  if (s.red > 0) { g.fillStyle = `rgba(230,40,30,${0.55 * s.red})`; g.fillRect(0, 0, 256, 256); }
  const ink = '#120c0a';
  const ey = o.eyeY || 15;
  const ew0 = o.eyeW || 6;
  for (const [cx, side] of [[10, -1], [22, 1]]) {
    if (s.eyes === 'closed' || s.open < 0.2) { px(g, cx - 3, ey + 1, 6, 1, s.soot > 0.5 ? '#ddd' : ink); continue; }
    if (s.eyes === 'squint') { // > <
      const d = side < 0 ? 1 : -1;
      px(g, cx - 2 * d, ey - 1, 1, 1, ink); px(g, cx - d, ey, 1, 1, ink); px(g, cx, ey + 1, 1, 1, ink); px(g, cx - d, ey + 2, 1, 1, ink); px(g, cx - 2 * d, ey + 3, 1, 1, ink);
      continue;
    }
    if (s.eyes === 'happy') { px(g, cx - 3, ey + 2, 1, 1, ink); px(g, cx - 2, ey + 1, 1, 1, ink); px(g, cx - 1, ey, 3, 1, ink); px(g, cx + 2, ey + 1, 1, 1, ink); px(g, cx + 3, ey + 2, 1, 1, ink); continue; }
    let ew = Math.round(ew0 * s.size), eh = ew;
    if (s.eyes === 'pop') { ew = 9; eh = 9; }
    const x0 = cx - Math.floor(ew / 2), y0 = ey + 1 - Math.floor(eh / 2);
    px(g, x0, y0, ew, eh, '#ffffff');
    const pw = s.eyes === 'pop' ? 2 : s.pupil;
    const pxo = Math.round(s.look[0] * (ew - pw) / 2), pyo = -Math.round(s.look[1] * (eh - pw) / 2);
    px(g, cx - Math.floor(pw / 2) + pxo, ey + 1 - Math.floor(pw / 2) + pyo, pw, pw, ink);
    if (s.glint) px(g, cx - Math.floor(pw / 2) + pxo, ey + 1 - Math.floor(pw / 2) + pyo, 1, 1, '#ffffff');
    if (s.lids > 0) { const lh = Math.round(eh * s.lids); px(g, x0, y0, ew, lh, skin); px(g, x0, y0 + lh, ew, 1, ink); }
    // brows
    const by = y0 - 2;
    const inner = cx < 16;
    const bc = o.browColor || '#1d1410';
    const bt = o.thickBrows ? 2 : 1;
    for (let i = 0; i < ew; i++) {
      const isIn = inner ? i >= ew / 2 : i < ew / 2;
      if (s.brow === 'none') break;
      let dy = 0;
      if (s.brow === 'angry') dy = isIn ? 1 : -1;
      if (s.brow === 'worried') dy = isIn ? -1 : 0;
      if (s.brow === 'up') dy = -1;
      px(g, x0 + i, by + dy - bt + 1, 1, bt, bc);
    }
  }
  if (s.tears > 0) { // cartoon tear streams
    g.fillStyle = 'rgba(110,200,255,0.95)';
    for (const cx of [9, 23]) { const len = Math.round(4 + s.tears * 12); g.fillRect((cx) * CELL, (ey + 4) * CELL, 2 * CELL, len * CELL); }
    g.fillStyle = 'rgba(220,245,255,0.95)';
    for (const cx of [9, 23]) { const k = (Math.floor(s.t * 8) % 6); g.fillRect(cx * CELL, (ey + 5 + k * 2) * CELL, CELL, CELL); }
  }
  if (s.blush > 0.01) { g.globalAlpha = clamp(s.blush) * 0.9; px(g, 3, 21, 5, 2, '#ff5f6e'); px(g, 24, 21, 5, 2, '#ff5f6e'); g.globalAlpha = 1; }
  const mc = s.soot > 0.5 ? '#0b0806' : '#5a2620';
  const my = o.mouthY || 24;
  switch (s.mouth) {
    case 'smile': px(g, 10, my - 1, 1, 1, mc); px(g, 11, my, 10, 1, mc); px(g, 21, my - 1, 1, 1, mc); break;
    case 'grin': px(g, 10, my - 2, 12, 4, mc); px(g, 11, my - 2, 10, 2, '#ffffff'); break;
    case 'open': px(g, 12, my - 2, 8, 5, mc); px(g, 13, my + 1, 6, 1, '#d4545c'); break;
    case 'yell': px(g, 10, my - 3, 12, 7, mc); px(g, 11, my - 3, 10, 1, '#ffffff'); px(g, 12, my + 2, 8, 2, '#d4545c'); break;
    case 'o': px(g, 14, my - 1, 4, 4, mc); break;
    case 'chew': if (Math.floor(s.t * 8) % 2) px(g, 12, my - 1, 8, 3, mc); else px(g, 12, my, 8, 1, mc); break;
    case 'frown': px(g, 11, my + 1, 1, 1, mc); px(g, 12, my, 8, 1, mc); px(g, 20, my + 1, 1, 1, mc); break;
    case 'wobble': for (let i = 0; i < 10; i++) px(g, 11 + i, my + (i % 2), 1, 1, mc); break;
    case 'smirk': px(g, 13, my, 6, 1, mc); px(g, 19, my - 1, 2, 1, mc); break;
    case 'sip': px(g, 14, my, 4, 2, mc); break;
    case 'none': break;
    default: px(g, 12, my, 8, 1, mc);
  }
  if (s.dust > 0) {
    const r = rng(o.seed || 3);
    g.fillStyle = `rgba(150,140,128,${0.75 * s.dust})`;
    for (let i = 0; i < 40; i++) px(g, Math.floor(r() * 32), Math.floor(r() * 32), 1 + Math.floor(r() * 2), 1, g.fillStyle);
  }
  if (s.soot > 0.5) {
    const r = rng(9);
    g.fillStyle = 'rgba(80,72,66,0.9)';
    for (let i = 0; i < 30; i++) px(g, Math.floor(r() * 32), Math.floor(r() * 32), 1, 1, g.fillStyle);
  }
}
export class Face {
  constructor(o) {
    this.o = o;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = 256;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.magFilter = THREE.NearestFilter;
    this.material = new THREE.MeshLambertMaterial({ map: this.tex });
    this.key = ''; this.state = { ...FACE_DEF };
  }
  set(st) { this.state = { ...FACE_DEF, ...st }; }
  update() {
    const s = this.state;
    const animated = s.tears > 0 || s.mouth === 'chew';
    const key = JSON.stringify(s, (k, v) => (k === 't' && !animated) ? 0 : typeof v === 'number' ? Math.round(v * 20) / 20 : v);
    if (key === this.key) return;
    this.key = key; drawFace(this.g, s, this.o); this.tex.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ characters
const headGeo = new RoundedBoxGeometry(0.52, 0.52, 0.52, 1, 0.07);
export function makeChar(scene, o) {
  const root = new THREE.Group();
  const pelvis = new THREE.Group(); pelvis.position.y = 0.95; root.add(pelvis);
  const W = o.wide || 1;
  const pantsMeshes = [box(pelvis, 0.56 * W, 0.2, 0.32 * W, M(o.pants), 0, 0.02, 0)];
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group(); hip.position.set(s * 0.135 * W, 0, 0); pelvis.add(hip);
    pantsMeshes.push(box(hip, 0.25, 0.46, 0.27, M(o.pants), 0, -0.21, 0));
    const knee = new THREE.Group(); knee.position.set(0, -0.44, 0); hip.add(knee);
    pantsMeshes.push(box(knee, 0.24, 0.42, 0.25, M(o.pants), 0, -0.2, 0));
    const shoe = box(knee, 0.26, 0.11, 0.36, o.shoeMat || M(o.shoes), 0, -0.44, 0.05);
    return { hip, knee, shoe };
  });
  const spine = new THREE.Group(); spine.position.y = 0.08; spine.rotation.order = 'YXZ'; pelvis.add(spine);
  const torso = box(spine, 0.58 * W, 0.62, 0.32 * W, M(o.shirt), 0, 0.31, 0);
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group(); sh.position.set(s * (0.29 * W + 0.095), 0.56, 0); spine.add(sh);
    box(sh, 0.19, 0.34, 0.22, M(o.sleeve || o.shirt), 0, -0.13, 0);
    const el = new THREE.Group(); el.position.set(0, -0.3, 0); sh.add(el);
    box(el, 0.18, 0.26, 0.21, M(o.forearm || o.sleeve || o.shirt), 0, -0.12, 0);
    const hand = new THREE.Group(); hand.position.set(0, -0.29, 0); el.add(hand);
    box(hand, 0.17, 0.13, 0.2, M(o.skin), 0, -0.01, 0);
    return { sh, el, hand, side: s };
  });
  const neck = new THREE.Group(); neck.position.y = 0.62; spine.add(neck);
  const head = new THREE.Group(); head.position.y = 0.28; head.rotation.order = 'YXZ'; neck.add(head);
  const face = new Face(o);
  const sk = M(o.skin);
  const headMesh = new THREE.Mesh(headGeo, [sk, sk, sk, sk, face.material, sk]);
  headMesh.castShadow = true; headMesh.receiveShadow = true; head.add(headMesh);
  const c = { root, pelvis, legs, spine, torso, arms, neck, head, headMesh, face, o, W, pantsMeshes };
  if (o.build) o.build(c);
  if (o.scale) root.scale.setScalar(o.scale);
  scene.add(root);
  return c;
}
const _v = V();
export function reach(c, a, T) {
  const arm = c.arms[a];
  c.root.updateMatrixWorld(true);
  const s = c.root.scale.x;
  const tl = c.spine.worldToLocal(_v.copy(T)).sub(arm.sh.position);
  const A = 0.3, B = 0.31;
  const d = clamp(tl.length(), 0.08, A + B - 0.002);
  const dir = tl.normalize();
  const thz = Math.asin(clamp(dir.x, -0.999, 0.999)), cz = Math.cos(thz);
  const thx = Math.atan2(-dir.z / cz, -dir.y / cz);
  const alpha = Math.acos(clamp((A * A + d * d - B * B) / (2 * A * d), -1, 1));
  const beta = Math.PI - Math.acos(clamp((A * A + B * B - d * d) / (2 * A * B), -1, 1));
  arm.sh.rotation.set(thx + alpha, 0, thz);
  arm.el.rotation.set(-beta, 0, 0);
}
export const rootPt = (c, x, y, z) => { c.root.updateMatrixWorld(true); return c.root.localToWorld(V(x, y, z)); };
export const spinePt = (c, x, y, z) => { c.root.updateMatrixWorld(true); return c.spine.localToWorld(V(x, y, z)); };
export const headPt = (c, x, y, z) => { c.root.updateMatrixWorld(true); return c.head.localToWorld(V(x, y, z)); };
export function headPos(c) { c.root.updateMatrixWorld(true); return c.head.getWorldPosition(V()); }
export function resetPose(c) {
  c.pelvis.position.set(0, 0.95, 0); c.pelvis.rotation.set(0, 0, 0);
  for (const L of c.legs) { L.hip.rotation.set(0, 0, 0); L.knee.rotation.set(0, 0, 0); }
  c.spine.rotation.set(0, 0, 0); c.neck.rotation.set(0, 0, 0); c.head.rotation.set(0, 0, 0);
  c.head.scale.set(1, 1, 1);
  for (const a of c.arms) { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); a.hand.rotation.set(0, 0, 0); }
}
// walk/run cycle: phase in radians, amp 0..1
export function walkPose(c, phase, amp = 1, run = false) {
  const sw = Math.sin(phase) * (run ? 0.85 : 0.5) * amp;
  c.legs[0].hip.rotation.x = sw; c.legs[1].hip.rotation.x = -sw;
  c.legs[0].knee.rotation.x = Math.max(0, -Math.sin(phase)) * (run ? 1.2 : 0.6) * amp;
  c.legs[1].knee.rotation.x = Math.max(0, Math.sin(phase)) * (run ? 1.2 : 0.6) * amp;
  c.pelvis.position.y = 0.95 + Math.abs(Math.cos(phase)) * (run ? 0.07 : 0.035) * amp;
  c.arms[0].sh.rotation.x = -sw * (run ? 1.1 : 0.7); c.arms[1].sh.rotation.x = sw * (run ? 1.1 : 0.7);
  if (run) { c.arms[0].el.rotation.x = -1.3; c.arms[1].el.rotation.x = -1.3; c.spine.rotation.x = 0.18; }
}
export function seatPose(c) {
  c.pelvis.position.y = 0.52;
  c.legs[0].hip.rotation.set(-Math.PI / 2 + 0.04, 0.05, 0); c.legs[1].hip.rotation.set(-Math.PI / 2 + 0.04, -0.05, 0);
  for (const L of c.legs) L.knee.rotation.set(Math.PI / 2 - 0.04, 0, 0);
}
export function blink(t, seed) { const p = (t + seed * 1.37) % 3.4; return p < 0.09 ? 0 : 1; }
