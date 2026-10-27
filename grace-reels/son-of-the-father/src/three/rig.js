// Paper-cut people, rig v3 — SVG-drawn parts baked into a per-character atlas (colour + shape field),
// cel-shaded against the scene's real key light (U.uSunDir / lamp U.uPointPos), with a constant
// screen-space outline. Three drawn views per character (side / threeQuarter / back) that swap with a
// paper-flip squash. Same public API as v2 (new Person(opts), .root/.bb/.body, setFacing, billboard,
// autoOutline, pose, secondary, Poses.*, expr, basePose, SKIN/HAIR/CLOTH); everything new is additive.
//
// Rig (per view): body > torso > neck > head > {eyeN/F > pupil/lidU/lidL, browN/F, mouth, beard, hairBack}
//                 torso > armB/F.sh > .el > .hand (> prop) ; torso > cradle (held baby)
//                 body  > legB/F.hip > .knee > .foot
// Local space: facing +x, feet at y = 0. All parts are coplanar; stacking comes from a per-vertex layer
// (vertices slide toward the camera along their own view ray, so layers never shift on screen).
import * as THREE from 'three';
import { flat, outlineMaterial, radialTex, charFillMaterial, charOutlineMaterial } from './materials.js';
import { hash01, clamp, lerp, smooth, easeOutBackK, blinkF, noise2, springFollow } from '../lib/util.js';
import { makeDesign, allParts, VIEW_ALIAS } from './characters/design.js';
import { buildAtlas, polyGeometry, stripGeometry, bend, STATS as ATLAS_STATS } from './characters/atlas.js';
import { flatten, bboxOf } from './characters/svg.js';
import { propParts } from './characters/parts_body.js';
import { EYE } from './characters/parts_head.js';

// ====================================================================== v2 geometry helpers (kept for compatibility)
function signedArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return a / 2; }
export function partGeo(pts) {
  const p = [];
  for (const q of pts) { const l = p[p.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-5) p.push(q); }
  if (Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 1e-5) p.pop();
  const ccw = signedArea(p) > 0, n = p.length;
  const pos = new Float32Array(n * 3), mit = new Float32Array(n * 2), en = [];
  for (let i = 0; i < n; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % n];
    let nx = y2 - y1, ny = -(x2 - x1); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if (!ccw) { nx = -nx; ny = -ny; }
    en.push([nx, ny]);
  }
  for (let i = 0; i < n; i++) {
    const a = en[(i - 1 + n) % n], b = en[i];
    let mx = a[0] + b[0], my = a[1] + b[1]; const l = Math.hypot(mx, my) || 1; mx /= l; my /= l;
    const d = Math.max(0.35, mx * b[0] + my * b[1]);
    pos[i * 3] = p[i][0]; pos[i * 3 + 1] = p[i][1];
    mit[i * 2] = mx / d; mit[i * 2 + 1] = my / d;
  }
  const tris = THREE.ShapeUtils.triangulateShape(p.map(([x, y]) => new THREE.Vector2(x, y)), []);
  const idx = []; for (const t of tris) idx.push(t[0], t[1], t[2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('miter', new THREE.BufferAttribute(mit, 2));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}
export const ellipse = (cx, cy, rx, ry, n = 22, a0 = 0, a1 = Math.PI * 2) => {
  const out = []; const full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6; const N = full ? n : n + 1;
  for (let i = 0; i < N; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return out;
};
export function capsule(len, r0, r1 = r0, n = 7) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = Math.PI - Math.PI * i / n; out.push([Math.cos(a) * r0, Math.sin(a) * r0]); }
  for (let i = 0; i <= n; i++) { const a = -Math.PI * i / n; out.push([Math.cos(a) * r1, -len + Math.sin(a) * r1]); }
  return out;
}
export function rrect(x0, y0, x1, y1, r, n = 4) {
  const out = []; r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  const c = [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI], [x1 - r, y0 + r, Math.PI * 1.5]];
  for (const [cx, cy, a0] of c) for (let i = 0; i <= n; i++) { const a = a0 + Math.PI / 2 * i / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
export function smoothClosed(ctrl, samples = 48) {
  const c = new THREE.CatmullRomCurve3(ctrl.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  return c.getPoints(samples).map((v) => [v.x, v.y]);
}
export function shadeHex(hex, k) { if (k === 1) return hex; const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }

// ====================================================================== palette
export const SKIN = ['#6b4126', '#7d4c2c', '#8f5a33', '#a2693d', '#b47a49', '#c28b58', '#cf9c6a'];
export const HAIR = { black: '#231a14', dark: '#33251b', brown: '#4a3524', grey: '#8f8a83', white: '#e8e3da' };
export const CLOTH = {
  purple: '#5b2a6e', gold: '#c99a3a', sand: '#c9a36a', cream: '#e3d6bb', olive: '#6b6e3f', slate: '#4f6478', rust: '#a9552c',
  brick: '#93402a', teal: '#3c6b66', indigo: '#3b456f', brown: '#6e4a2e', stone: '#8a8172', wine: '#72303a', ochre: '#bf8c31',
  moss: '#53653a', rag: '#7f6a52', charcoal: '#383533', sky: '#5f87a3', rose: '#b06a5e',
};

// ====================================================================== shared caches
const DESIGNS = new Map();
function designOf(o) {
  const d = makeDesign(o);
  if (DESIGNS.has(d.key)) return DESIGNS.get(d.key);
  DESIGNS.set(d.key, d); return d;
}
const PROP_KINDS = ['cane', 'staff', 'hammer', 'adze', 'lamp', 'bowl', 'cup', 'fruitGood', 'fruitBad'];
const PROP_D = { seed: 3, caneLen: 0.84, wood: '#7a5232', clay: '#a8683e' };
let _propAtlas = null, _propParts = null;
function propAtlas() {
  if (_propAtlas) return _propAtlas;
  _propParts = {};
  const all = [];
  for (const k of PROP_KINDS) {
    _propParts[k] = propParts(k, PROP_D).map((p) => ({ ...p, id: `${k}/${p.id}`, baseId: p.id, density: 400 * 1.5, outline: true }));
    all.push(..._propParts[k]);
  }
  _propAtlas = buildAtlas('props-v3', all, { W: 2048, H: 1024 });
  return _propAtlas;
}
export const RIG_STATS = { persons: 0, buildMs: 0, atlas: ATLAS_STATS };

// stub atlas for silhouette puppets (geometry only, no textures)
const STUB_ATLAS = { PAD: 0, W: 1, H: 1 };
function stubRegion(part) {
  const polys = flatten(part.shape, 0.0005);
  return { ...part, _region: { polys, bb: bboxOf(polys), ox: 0, oy: 0, rho: 1 } };
}

const BEND_KEYS = { beard: 'beard', hair: 'hair', robe: 'robe', shawl: 'shawl', tail: 'tail' };
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3();

// ====================================================================== the person
export class Person {
  constructor(o = {}) {
    const t0 = performance.now();
    this.o = o = { ...o };
    this.design = designOf(o);
    const D = this.D = this.design.D;
    this.kind = this.design.baby ? 'baby' : 'person';
    this.seed = o.seed ?? 1;
    this.height = o.height ?? (this.kind === 'baby' ? 0.3 : 1.75);
    this.scale = this.height / D.natural;
    this.root = new THREE.Group(); this.bb = new THREE.Group(); this.body = new THREE.Group();
    this.root.add(this.bb); this.bb.add(this.body); this.bb.rotation.order = 'YXZ';
    this.root.name = o.name || 'person';
    this.uni = { uLayerStep: { value: 0.0015 }, uLayerBase: { value: o.layerBase ?? 0 }, uLayerScale: { value: 1 }, uOutline: { value: 0.006 }, uGlow: { value: 0 } };
    this.sil = o.silhouette || null;
    if (!this.sil) {
      this.atlas = buildAtlas(this.design.key, allParts(this.design), this.design.quality);
      this.fillMat = charFillMaterial(this.atlas, this.uni);
      this.lineMat = charOutlineMaterial(this.uni);
    } else {
      this.atlas = STUB_ATLAS;
      this.lineMat = outlineMaterial(0.01); // unused (no outlines on puppets), kept for API compatibility
    }
    this.lineMat.userData.uOutline = this.uni.uOutline; // v2 compatibility
    this.outlinePx = o.outlinePx ?? null;
    this.facing = 1; this.flip = 1; this._turnK = 1; this._viewK = 1;
    this.rigs = {}; this.view = null; this.R = null;
    this._attached = []; this.held = null; this.holder = null;
    this.propKind = null; this.prop = null; this._props = {};
    this.P = null;
    this.setView(o.view || 'side');
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex(), color: '#1a120a', transparent: true, opacity: o.blobOpacity ?? 0.42, depthWrite: false, fog: true }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012;
    const bw = this.kind === 'baby' ? 0.4 : 0.62 * (D.build || 1);
    blob.scale.set(bw * this.height / 1.75, 0.3 * this.height / 1.75, 1); blob.renderOrder = -1;
    this.blob = blob; if (!o.silhouette && !o.noBlob) this.root.add(blob);
    if (o.prop) this.setProp(o.prop);
    this.pose(this.kind === 'baby' ? Poses.baby(0, this.seed) : basePose());
    this.buildMs = performance.now() - t0;
    RIG_STATS.persons++; RIG_STATS.buildMs += this.buildMs;
  }

  // ------------------------------------------------------------------ view rigs
  _buildView(v) {
    const d = this.design, P = d.pivots[v], D = this.D;
    const g = new THREE.Group(); g.name = 'view:' + v; g.visible = false; this.body.add(g);
    const J = {};
    const mk = (name, parent, pos = [0, 0]) => { const p = new THREE.Group(); p.name = name; p.position.set(pos[0], pos[1], 0); parent.add(p); J[name] = p; p.userData.rest = [pos[0], pos[1]]; return p; };
    const R = { v, g, J, toggles: {}, strips: [], parts: {}, eyes: [], brows: [] };
    if (this.kind === 'baby') {
      mk('body', g); mk('babyHead', J.body, P.babyHead || [0, 0]);
    } else {
      mk('torso', g, P.torso); mk('neck', J.torso, P.neck); mk('head', J.neck, P.head);
      const hs = D.hs;
      for (const tag of ['N', 'F']) {
        if (!P['eye' + tag]) continue;
        const e = tag === 'N' ? (v === 'side' ? EYE.side : EYE.near) : EYE.far;
        mk('eye' + tag, J.head, P['eye' + tag]);
        for (const s of ['pupil', 'lidU', 'lidL']) mk(s + tag, J['eye' + tag]);
        R.eyes.push({ tag, hw: e.hw * hs, ht: e.ht * hs, hb: e.hb * hs });
      }
      for (const tag of ['N', 'F']) if (P['brow' + tag]) { mk('brow' + tag, J.head, P['brow' + tag]); R.brows.push(tag); }
      mk('mouth', J.head, P.mouth); mk('beard', J.head, P.beard); mk('hairBack', J.head, P.hairBack);
      for (const s of ['B', 'F']) {
        const sh = mk(`arm${s}.sh`, J.torso, P[`arm${s}.sh`]); const el = mk(`arm${s}.el`, sh, [0, -D.upperL]); mk(`arm${s}.hand`, el, [0, -D.foreL]);
        const hip = mk(`leg${s}.hip`, g, P[`leg${s}.hip`]); const kn = mk(`leg${s}.knee`, hip, [0, -D.thighL]); mk(`leg${s}.foot`, kn, [0, -D.shinL]);
      }
      mk('cradle', J.torso, P.cradle || [0.2, 0.27]);
    }
    for (const part of d.views[v]) this._addPart(R, part);
    this.rigs[v] = R;
    return R;
  }

  _addPart(R, part0) {
    const parent = R.J[part0.pivot];
    if (!parent) return;
    const sil = this.sil;
    const part = sil ? stubRegion(part0) : part0;
    const atlas = this.atlas;
    const opts = { layer: part.layer, olayer: part.olayer, tint: part.tint };
    let geo;
    if (part.strip) {
      geo = stripGeometry(atlas, part, { ...opts, cols: part.strip.cols || 5 });
      const w0 = part.strip.w0 ?? 0; const W = geo.userData.w;
      for (let i = 0; i < W.length; i++) W[i] = clamp((W[i] - w0) / Math.max(1e-3, 1 - w0));
      R.strips.push({ geo, bend: BEND_KEYS[part.strip.bend] || part.strip.bend, id: part.baseId });
    } else geo = polyGeometry(atlas, part, opts);
    const fill = new THREE.Mesh(geo, sil || this.fillMat);
    fill.castShadow = !sil && !this.o.noShadow && !!part.shadow;
    fill.name = part.baseId;
    if (sil) fill.renderOrder = 2;
    parent.add(fill);
    let line = null;
    if (part.outline && !sil) { line = new THREE.Mesh(geo, this.lineMat); line.name = part.baseId + ':line'; parent.add(line); }
    if (part.toggle) {
      const [grp, val] = part.toggle.split(':');
      const t = (R.toggles[grp] ||= {}); (t[val] ||= []).push(fill); if (line) t[val].push(line);
    }
    R.parts[part.baseId] = { fill, line, geo, part: part0 };
  }

  _showView(v) {
    const R = this.rigs[v] || this._buildView(v);
    if (this.R) this.R.g.visible = false;
    R.g.visible = true; this.R = R; this.view = v;
    for (const a of this._attached) { const j = R.J[a.joint] || R.J.torso || R.J.body; if (a.obj.parent !== j) j.add(a.obj); }
    if (this.prop) this._mountProp();
    if (this.P) this.pose(this.P);
  }

  // view: 'side' | 'threeQuarter' | 'back' (aliases: profile, 3q, three).
  // flip 0..1 = progress of a paper flip from `from` (default: the view shown now) into `view`:
  // the old view squashes to an edge, the new one opens out. flip = 1 (default) = settled.
  setView(view, flip = 1, from = null) {
    view = VIEW_ALIAS[view] || 'side';
    if (this.kind === 'baby') view = 'side';
    const u = clamp(flip);
    const src = from ? (VIEW_ALIAS[from] || 'side') : (this.view || view);
    const show = u < 0.5 ? src : view;
    this._viewK = u >= 1 ? 1 : Math.max(0.06, Math.abs(Math.cos(Math.PI * u)));
    if (show !== this.view) this._showView(show);
    this.targetView = view;
    this._applyScale();
    return this;
  }

  // pure helper: track = [[t0, view, facing?], [t1, view, facing?], ...] (sorted by time).
  // Shows the right view/facing at time t with a `frames`-long paper flip after every change.
  viewAt(t, track, frames = 3) {
    let i = -1;
    for (let k = 0; k < track.length; k++) if (track[k][0] <= t + 1e-9) i = k;
    if (i < 0) i = 0;
    const cur = track[i], prev = track[i - 1];
    const f = cur[2] ?? (prev ? prev[2] : null) ?? this.facing;
    const dur = frames / 30, u = prev ? clamp((t - cur[0]) / dur) : 1;
    const pf = prev ? (prev[2] ?? f) : f;
    if (u < 1 && prev && (prev[1] !== cur[1] || pf !== f)) {
      this.facing = u < 0.5 ? (pf >= 0 ? 1 : -1) : (f >= 0 ? 1 : -1); this._turnK = 1;
      this.setView(cur[1], u, prev[1]);
    } else { this.facing = f >= 0 ? 1 : -1; this._turnK = 1; this.setView(cur[1], 1); }
    return this;
  }

  // facing: +1 right / -1 left; turn (0..1) = paper-turn progress from -f to f (squashes through 0)
  setFacing(f, turn = null) {
    this.facing = f >= 0 ? 1 : -1;
    if (turn === null || turn >= 1) this._turnK = 1;
    else this._turnK = Math.cos(Math.PI * clamp(turn)) * -1; // -1 (old facing) .. 0 .. +1
    this._applyScale();
    return this;
  }
  _applyScale() {
    let kx = this._turnK * this._viewK;
    if (Math.abs(kx) < 0.04) kx = 0.04 * Math.sign(kx || 1);
    const squash = 1 - Math.abs(kx);
    this.body.scale.set(this.facing * kx * this.scale, this.scale * (1 + 0.035 * squash), this.scale);
  }

  // ------------------------------------------------------------------ joints (current view; v2 compatible names)
  get J() { return this.R.J; }
  _limb(a, b, c) { const J = this.R.J; return a === 'arm' ? { sh: J[`arm${b}.sh`], el: J[`arm${b}.el`], hand: J[`arm${b}.hand`] } : { hip: J[`leg${b}.hip`], knee: J[`leg${b}.knee`], foot: J[`leg${b}.foot`] }; }
  get armF() { return this._limb('arm', 'F'); }
  get armB() { return this._limb('arm', 'B'); }
  get legF() { return this._limb('leg', 'F'); }
  get legB() { return this._limb('leg', 'B'); }
  get torso() { return this.R.J.torso; }
  get neck() { return this.R.J.neck; }
  get head() { return this.R.J.head || this.R.J.babyHead; }
  get eye() { return this.R.J.eyeN; }
  get pupil() { return this.R.J.pupilN; }
  get lid() { return this.R.J.lidUN; }
  get brow() { return this.R.J.browN; }
  get mouth() { return this.R.J.mouth; }
  get beardPiv() { return this.R.J.beard; }
  get cradle() { return this.R.J.cradle; }

  // keep an object glued to a joint of whatever view is shown (e.g. a torch in the hand)
  attach(obj, joint = 'armF.hand') {
    this._attached = this._attached.filter((a) => a.obj !== obj);
    this._attached.push({ obj, joint });
    const j = this.R.J[joint] || this.R.J.torso; j.add(obj);
    return obj;
  }
  detach(obj) { this._attached = this._attached.filter((a) => a.obj !== obj); if (obj.parent) obj.parent.remove(obj); }

  // hold another Person (BABY) in the arms: parented to the cradle joint, layered between body and front arm
  hold(other, joint = 'cradle') {
    if (this.held && this.held !== other) this.release();
    if (!other) return null;
    this.held = other; other.holder = this;
    other.root.position.set(0, 0, 0); other.root.scale.setScalar(1 / this.scale);
    other.bb.rotation.set(0, 0, 0);
    other.uni.uLayerBase.value = (this.kind === 'baby' ? 0 : 23);
    if (other.blob) other.blob.visible = false;
    this.attach(other.root, joint);
    return other;
  }
  release() {
    const b = this.held; if (!b) return;
    this.detach(b.root); b.holder = null; b.root.scale.setScalar(1); b.uni.uLayerBase.value = 0; if (b.blob) b.blob.visible = true; this.held = null;
  }

  // ------------------------------------------------------------------ props (shared prop atlas)
  setProp(kind) {
    if ((this.propKind || null) === (kind || null)) return this.prop;
    if (this.prop && this.prop.parent) this.prop.parent.remove(this.prop);
    this.prop = null; this.propKind = kind || null;
    if (!kind) return null;
    if (!PROP_KINDS.includes(kind)) { console.warn('[rig] unknown prop', kind); this.propKind = null; return null; }
    if (!this._props[kind]) {
      const atlas = this.sil ? STUB_ATLAS : propAtlas();
      if (!this.sil && !this._propMat) this._propMat = charFillMaterial(atlas, this.uni);
      if (!this.sil && !_propParts) propAtlas();
      const parts = this.sil ? propParts(kind, PROP_D).map((p) => stubRegion({ ...p, id: p.id, baseId: p.id, outline: false })) : _propParts[kind];
      const g = new THREE.Group(); g.name = 'prop:' + kind;
      const inner = new THREE.Group(); g.add(inner);
      const meta = {};
      for (const p of parts) {
        const lay = 39.75 + (p.layer || 0) * 0.5;
        const geo = polyGeometry(atlas, p, { layer: lay, olayer: 39.45, tint: 1 });
        const m = new THREE.Mesh(geo, this.sil || this._propMat); m.castShadow = !this.sil && !this.o.noShadow; if (this.sil) m.renderOrder = 2; inner.add(m);
        if (!this.sil) inner.add(new THREE.Mesh(geo, this.lineMat));
        for (const k of ['tip', 'top', 'flame', 'offset']) if (p[k]) meta[k] = p[k];
      }
      g.userData.meta = meta; g.userData.inner = inner;
      if (meta.offset) inner.position.set(meta.offset[0], meta.offset[1], 0);
      this._props[kind] = g;
    }
    this.prop = this._props[kind];
    this._mountProp();
    return this.prop;
  }
  _mountProp() {
    const side = this.P && this.P.propHand === 'B' ? 'B' : 'F';
    const j = this.R.J[`arm${side}.hand`]; if (!j) return;
    if (this.prop.parent !== j) j.add(this.prop);
    const k = Math.sqrt(this.D.build || 1);
    this.prop.position.set(0.006 * k, -0.046 * k, 0);
  }
  // world position of a prop anchor ('flame' of the lamp, 'tip' / 'top' of cane & staff) — e.g. for the lamp light
  propPoint(name = 'flame', target = new THREE.Vector3()) {
    if (!this.prop) return null;
    const m = this.prop.userData.meta[name]; if (!m) return null;
    this.root.updateMatrixWorld(true);
    return this.prop.userData.inner.localToWorld(target.set(m[0], m[1], 0));
  }
  // world position of a joint of the shown view ('head', 'armF.hand', 'eyeN', ...)
  jointWorld(name, target = new THREE.Vector3()) {
    const j = this.R.J[name]; if (!j) return null;
    this.root.updateMatrixWorld(true);
    return j.localToWorld(target.set(0, 0, 0));
  }

  // ------------------------------------------------------------------ camera-facing + outline
  billboard(camera, lean = 0.3) {
    const p = this.root.getWorldPosition(_v1), c = camera.position;
    const dx = c.x - p.x, dz = c.z - p.z;
    this.bb.rotation.y = Math.atan2(dx, dz);
    this.bb.rotation.x = -clamp(Math.atan2(c.y - p.y - 1, Math.hypot(dx, dz)), -0.4, 1.2) * lean;
  }

  // constant on-screen outline (default 5 px at 1920 px frame height, scaled with viewH) + depth layer
  // step from the camera distance. Returns the figure's on-screen height in px (v2 behaviour).
  autoOutline(camera, viewH = 1920, px = null) {
    const p = this.root.getWorldPosition(_v1);
    const a = _v2.copy(p).project(camera), b2 = _v3.copy(p).setY(p.y + this.height).project(camera);
    const hpx = Math.abs(b2.y - a.y) * 0.5 * viewH;
    let mpp, d;
    if (camera.isPerspectiveCamera) {
      d = Math.max(0.05, -_v4.copy(p).setY(p.y + this.height * 0.6).applyMatrix4(camera.matrixWorldInverse).z);
      mpp = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / (camera.zoom || 1) / viewH;
    } else { d = 10; mpp = (camera.top - camera.bottom) / (camera.zoom || 1) / viewH; }
    const target = px ?? this.outlinePx ?? 5 * viewH / 1920;
    const ws = Math.abs(this.root.getWorldScale(_v5).y) || 1;
    const outM = target * mpp;
    this.uni.uOutline.value = outM / (this.scale * ws);
    this.uni.uLayerStep.value = camera.isPerspectiveCamera ? Math.max(1.5e-4, d * 5e-5) : 1e-3;
    this.mpp = mpp; this.screenH = hpx;
    if (this.held) {
      const h = this.held; h.uni.uLayerStep.value = this.uni.uLayerStep.value; h.uni.uOutline.value = outM / (h.scale * ws); h.mpp = mpp;
    }
    return hpx;
  }

  // ------------------------------------------------------------------ pose
  pose(P) {
    this.P = P;
    const R = this.R, J = R.J;
    if (this.kind === 'baby') {
      this.body.position.set(P.dx || 0, P.bob || 0, 0);
      J.body.rotation.z = P.lean || 0;
      J.babyHead.rotation.z = P.headTilt || 0;
      this._toggle(R, 'babyEye', P.babyEye || ((P.eye ?? 1) < 0.5 ? 'closed' : 'open'));
      return;
    }
    const v = R.v, D = this.D;
    const seatY = P.seat != null ? (P.seat - (D.hipY - 0.07) * this.scale) : 0;
    this.body.position.set(P.dx || 0, (P.bob || 0) + seatY, 0);
    const br = P.breath || 0;
    const ht = P.headTilt || 0;
    if (v === 'back') { // forward lean / nod happen toward the camera: foreshorten instead of rotating
      J.torso.rotation.z = 0;
      J.torso.scale.set(1 - 0.004 * br, (1 + 0.011 * br) * (0.72 + 0.28 * Math.cos(clamp(P.lean || 0, -1, 1.2))), 1);
      J.neck.rotation.z = 0; J.head.rotation.z = (P.headRot || 0) * 0.5;
    } else {
      J.torso.rotation.z = -(P.lean || 0);
      J.torso.scale.set(1 - 0.004 * br, 1 + 0.011 * br, 1);
      J.neck.rotation.z = ht * 0.45 + (P.neckRot || 0);
      J.head.rotation.z = ht * 0.55 + (P.headRot || 0);
    }
    // limbs: picture-plane rotations in side view, damped in 3/4, foreshortened in back view
    const aF = P.aF || [0, 0], aB = P.aB || [0, 0], lF = P.lF || [0, 0], lB = P.lB || [0, 0];
    if (v === 'back') {
      const arm = (s, A, out) => { J[`arm${s}.sh`].rotation.z = out * (0.06 + 0.18 * Math.abs(A[0]) * 0.4) + A[0] * 0.08; J[`arm${s}.el`].rotation.z = out * 0.12 * Math.min(1, Math.abs(A[1])); J[`arm${s}.hand`].rotation.z = 0;
        J[`arm${s}.el`].position.y = -D.upperL * (0.62 + 0.38 * Math.abs(Math.cos(A[0]))); J[`arm${s}.hand`].position.y = -D.foreL * (0.6 + 0.4 * Math.abs(Math.cos(A[0] + A[1]))); };
      arm('F', aF, -1); arm('B', aB, 1);
      const leg = (s, Lg, out) => { J[`leg${s}.hip`].rotation.z = out * 0.03 + Lg[0] * 0.05; J[`leg${s}.knee`].rotation.z = 0; J[`leg${s}.foot`].rotation.z = 0;
        J[`leg${s}.knee`].position.y = -D.thighL * (0.6 + 0.4 * Math.cos(Lg[0])); J[`leg${s}.foot`].position.y = -D.shinL * (0.6 + 0.4 * Math.cos(Lg[1])); };
      leg('F', lF, -1); leg('B', lB, 1);
    } else {
      const k = v === 'threeQuarter' ? 0.85 : 1;
      const set = (n, A) => { J[`${n}.sh`] ? (J[`${n}.sh`].rotation.z = A[0] * k, J[`${n}.el`].rotation.z = A[1] * k, J[`${n}.hand`].rotation.z = A[2] || 0)
        : (J[`${n}.hip`].rotation.z = A[0] * k, J[`${n}.knee`].rotation.z = A[1] * k, J[`${n}.foot`].rotation.z = A[2] || 0); };
      set('armF', aF); set('armB', aB); set('legF', lF); set('legB', lB);
    }
    // eyes: lids slide over the almond hole; pupils look
    const open = clamp(P.eye ?? 1, 0, 1.3), lk = clamp(P.look || 0, -1.2, 1.2), lkY = clamp(P.lookY || 0, -1.2, 1.2);
    for (const e of R.eyes) {
      const lu = J['lidU' + e.tag], ll = J['lidL' + e.tag], pu = J['pupil' + e.tag];
      lu.position.y = open < 1 ? -(1 - open) * (e.ht + e.hb * 0.92) : (open - 1) * e.ht * 0.8;
      ll.position.y = open < 1 ? (1 - open) * e.hb * 0.22 : -(open - 1) * e.hb * 0.6;
      const lx = v === 'threeQuarter' ? lk * 0.85 + 0.15 : lk;
      pu.position.set(lx * e.hw * 0.42, lkY * e.ht * 0.42 - (open < 0.75 ? (0.75 - open) * e.ht * 0.5 : 0), 0);
    }
    for (const tag of R.brows) {
      const b = J['brow' + tag], rest = b.userData.rest, hs = D.hs;
      const sgn = v === 'threeQuarter' && tag === 'F' ? 1 : -1;
      b.rotation.z = sgn * (P.brow || 0);
      b.position.set(rest[0], rest[1] + (P.browY || 0) * 0.02 * hs - (open < 0.6 ? (0.6 - open) * 0.01 * hs : 0), 0);
    }
    // mouth / hands
    const m = P.mouth || 'none';
    this._toggle(R, 'mouth', m);
    if (J.mouth) J.mouth.scale.set(1, m === 'talk' ? 0.3 + 0.9 * (P.mo ?? 0.5) : m === 'open' || m === 'laugh' ? 0.5 + 0.6 * (P.mo ?? 1) : 1, 1);
    const grip = this.propKind && !['bowl', 'fruitGood', 'fruitBad', 'cup'].includes(this.propKind) ? 'grip' : 'open';
    this._toggle(R, 'handF', P.handF || (P.propHand === 'B' ? 'open' : grip));
    this._toggle(R, 'handB', P.handB || (P.propHand === 'B' ? grip : 'open'));
    J.cradle.rotation.z = P.cradleRot || 0;
    // hanging parts: gravity compensation (they hang from a leaning torso / tilted head) + follow-through
    const vk = v === 'back' ? 0 : v === 'threeQuarter' ? 0.85 : 1;
    const tilt = (-(P.lean || 0) + ht + (P.headRot || 0) + (P.neckRot || 0)) * vk;
    const wind = P.wind ?? 0.4, ph = P.swayPh ?? 0;
    for (const s of R.strips) {
      if (s.bend === 'beard') {
        J.beard.rotation.z = clamp(-tilt * 0.6 + (P.beardRot || 0) * 0.55, -0.9, 0.9);
        bend(s.geo, clamp(-tilt * 0.4 + (P.beardRot || 0) * 0.6, -1, 1), (P.beardRot2 || 0), (P.beardWave ?? 0.02 * wind), ph * 1.3, P.beardFlare || 0, 0, 4.5);
      } else if (s.bend === 'hair') {
        J.hairBack.rotation.z = clamp(-tilt * 0.55 + (P.hairRot || 0) * 0.5, -0.9, 0.9);
        bend(s.geo, clamp(-tilt * 0.35 + (P.hairRot || 0) * 0.6, -1, 1), 0, 0.015 * wind, ph * 1.1 + 1.3, 0, 0, 4);
      } else if (s.bend === 'robe') {
        const hr = clamp(P.hemRot || 0, -0.4, 0.4);
        bend(s.geo, clamp((P.lean || 0) * 0.55 * vk + hr * 0.7, -0.6, 0.6), 0, 0.006 * wind, ph + 2.1, Math.abs(hr) * 0.35 + (P.hemFlare || 0), 0, 5);
      } else if (s.bend === 'shawl') {
        bend(s.geo, clamp((P.lean || 0) * 0.4 * vk + (P.hemRot || 0) * 0.5 + (P.shawlRot || 0), -0.6, 0.6), 0, 0.01 * wind, ph + 0.7, 0, 0, 5);
      } else if (s.bend === 'tail') {
        J.hairBack.rotation.z = clamp(-tilt * 0.5 + clamp((P.tailRot || 0) - 0.08, -0.9, 0.6), -1.2, 1.2);
        bend(s.geo, clamp((P.tailRot || 0) * 0.6, -1, 1), 0, 0.04 * wind, ph * 1.6, 0, 0, 5);
      }
    }
    // prop
    if (this.prop) {
      if ((P.propHand === 'B') !== (this.prop.parent === J['armB.hand'])) this._mountProp();
      const A = P.propHand === 'B' ? aB : aF;
      const k = v === 'back' ? 0 : v === 'threeQuarter' ? 0.85 : 1;
      const upright = this.propKind === 'cane' || this.propKind === 'staff';
      const up = P.propUp ?? (upright && P.propRot == null ? 0.05 + 0.12 * A[0] : null);
      if (up != null) this.prop.rotation.z = up - (-(P.lean || 0) + (A[0] + A[1]) * k + (A[2] || 0));
      else this.prop.rotation.z = P.propRot ?? 0;
      const inner = this.prop.userData.inner;
      inner.scale.y = 1;
      const plant = P.plant ?? (upright ? 'clamp' : false);
      if (plant && this.prop.userData.meta.tip) {
        this.root.updateMatrixWorld(true);
        const tipL = this.prop.userData.meta.tip;
        const top = inner.localToWorld(_v1.set(0, 0, 0)), tip = inner.localToWorld(_v2.set(tipL[0], tipL[1], 0));
        const gy = this.root.getWorldPosition(_v3).y;
        const len = top.y - tip.y;
        if (len > 1e-3) inner.scale.y = plant === 'clamp' ? clamp((top.y - gy) / len, 0.3, 1) : clamp((top.y - gy) / len, 0.6, 1.5);
      }
    }
    if (this.held) { this.held.root.visible = v !== 'back'; this.held.pose(P.baby || Poses.baby(P.t ?? 0, this.held.seed, P.babyAwake)); }
  }
  _toggle(R, grp, val) {
    const t = R.toggles[grp]; if (!t) return;
    for (const [k, list] of Object.entries(t)) for (const m of list) m.visible = k === val;
  }

  // apply secondary motion from a velocity (m/s, + = facing direction), acceleration and wind.
  // Optional poseAt(t) / posAt(t) (pure functions) drive a seeded damped spring so beards, long hair,
  // head-wrap tails and robe hems LAG behind the body and settle (pure function of t).
  secondary(P, { vx = 0, ax = 0, ay = 0, t = 0, wind = 0.4, poseAt = null, posAt = null, heavy = null } = {}) {
    const s = this.seed;
    const flutter = noise2(t * 2.3, s * 0.7, s) * wind, slow = noise2(t * 0.6, s * 1.3, s + 7) * wind;
    P.hemRot = (P.hemRot || 0) - 0.05 * clamp(vx, -5, 5) - 0.03 * ax + 0.015 * ay + flutter * 0.06;
    P.tailRot = (P.tailRot || 0) - 0.17 * clamp(vx, -5, 5) - 0.05 * ax + 0.02 * ay + flutter * 0.22;
    P.beardRot = (P.beardRot || 0) - 0.02 * clamp(vx, -5, 5) - 0.02 * ax + 0.012 * ay + flutter * 0.05 + slow * 0.05;
    P.hairRot = (P.hairRot || 0) - 0.04 * clamp(vx, -5, 5) - 0.02 * ax + flutter * 0.06;
    P.wind = wind; P.swayPh = t * (1.9 + hash01(s, 22) * 0.6) + hash01(s, 23) * 6.28;
    P.beardWave = (0.012 + 0.03 * wind) * (1 + 0.4 * slow);
    if (poseAt) {
      const hv = heavy ?? (this.D.age > 0.6 ? 1 : 0.7);
      const sig = (tt) => { const Q = poseAt(tt); return (posAt ? posAt(tt) : 0) + (Q.dx || 0) + 0.9 * Math.sin(Q.lean || 0) + 0.35 * (Q.headTilt || 0) + 0.25 * (Q.bob || 0); };
      const y = springFollow(sig, t, { freq: 1.05 + hash01(s, 21) * 0.25, damp: 0.2 + 0.06 * (1 - hv), window: 1.5, step: 1 / 30 });
      const yh = springFollow(sig, t, { freq: 1.6 + hash01(s, 24) * 0.3, damp: 0.28, window: 1.0, step: 1 / 30 });
      const Lb = Math.max(0.25, (this.D.beardLen || 0.6) * 0.9);
      P.beardRot += clamp(y / Lb, -0.6, 0.6) * this.scale;
      P.beardRot2 = clamp(y / Lb, -0.6, 0.6) * 0.5;
      P.hairRot += clamp(yh * 2.2, -0.5, 0.5);
      P.tailRot += clamp(yh * 3.0, -0.6, 0.6);
      P.hemRot += clamp(yh * 0.9, -0.3, 0.3);
    }
    P.t = t;
    return P;
  }

  // convenience: P = poseFn(t), secondary with springs from the same pose function, apply
  act(poseFn, t, { posAt = null, wind = 0.4, vx = null } = {}) {
    const P = poseFn(t);
    const v = vx ?? (posAt ? (posAt(t + 1 / 60) - posAt(t - 1 / 60)) * 30 : 0);
    this.secondary(P, { vx: v, t, wind, poseAt: poseFn, posAt });
    this.pose(P);
    return P;
  }
}

// ====================================================================== expressions
const EXPR = {
  neutral: { brow: 0, browY: 0 },
  proud: { brow: -0.12, browY: 0.35, eye: 0.62, headTilt: 0.16, mouth: 'smile' },
  angry: { brow: 0.48, browY: -0.3, mouth: 'open', mo: 0.55 },
  sad: { brow: -0.4, browY: 0.22, headTilt: -0.1, mouth: 'frown', lookY: -0.6 },
  surprised: { brow: -0.15, browY: 0.62, eye: 1.2, mouth: 'o' },
  happy: { brow: -0.1, browY: 0.18, mouth: 'smile' },
  sly: { brow: 0.22, browY: -0.05, eye: 0.75, mouth: 'smile', look: 0.6 },
  hurt: { brow: -0.45, browY: 0.3, eye: 0.9, mouth: 'frown', headTilt: -0.05 },
  // v3
  wonder: { brow: -0.2, browY: 0.6, eye: 1.15, mouth: 'o', mo: 0.5, lookY: 0.45, headTilt: 0.08 },
  sadness: { brow: -0.45, browY: 0.18, eye: 0.7, headTilt: -0.12, mouth: 'frown', lookY: -0.7 },
  peace: { brow: -0.1, browY: 0.1, eye: 0.58, mouth: 'smile', headTilt: 0.03 },
  worry: { brow: -0.52, browY: 0.32, eye: 1.05, mouth: 'frown', look: 0.25 },
  kind: { brow: -0.12, browY: 0.12, eye: 0.82, mouth: 'smile' },
  tired: { brow: -0.2, browY: -0.05, eye: 0.62, lookY: -0.3 },
  laugh: { brow: -0.15, browY: 0.25, eye: 0.5, mouth: 'laugh', mo: 0.9, headTilt: 0.12 },
  focus: { brow: 0.2, browY: -0.12, eye: 0.85, lookY: -0.2 },
};
export const EXPRESSIONS = Object.keys(EXPR);
export function expr(P, kind, k = 1) {
  const E = EXPR[kind] || {};
  for (const [key, v] of Object.entries(E)) {
    if (typeof v === 'number') P[key] = lerp(P[key] ?? (key === 'eye' ? 1 : 0), v, k);
    else if (k > 0.5) P[key] = v;
  }
  return P;
}

// ====================================================================== poses (pure functions of t in seconds; s = seed)
export function basePose() {
  return { bob: 0, lean: 0, headTilt: 0, aF: [0.06, 0.08], aB: [-0.05, 0.06], lF: [0.03, 0], lB: [-0.03, 0], eye: 1, brow: 0, browY: 0, mouth: 'none', mo: 0, breath: 0 };
}
const TAU = Math.PI * 2;
const withBlink = (P, t, s) => { P.eye = Math.min(P.eye ?? 1, blinkF(Math.round(t * 30), s)); return P; };
const frac = (x) => x - Math.floor(x);
const tremor = (t, s, f = 7) => noise2(t * f, s * 1.7, s + 31);

export const Poses = {
  idle(t, s = 1) { // breathing (0.25 Hz, ±1 % torso) + weight shift + blinks
    const P = basePose(); const ph = hash01(s, 1) * TAU;
    P.breath = Math.sin(TAU * t / 4 + ph);
    P.bob = 0.004 * P.breath;
    P.dx = 0.012 * Math.sin(TAU * t / 7.3 + ph);
    P.lean = 0.012 * Math.sin(TAU * t / 7.3 + ph + 1);
    P.aF[0] = 0.06 + 0.025 * Math.sin(TAU * t / 4 + ph + 1);
    P.aB[0] = -0.05 + 0.025 * Math.sin(TAU * t / 4 + ph + 2);
    P.lF[0] = 0.03 + 0.02 * Math.sin(TAU * t / 7.3 + ph); P.lB[0] = -0.03 + 0.02 * Math.sin(TAU * t / 7.3 + ph);
    P.headTilt = 0.025 * Math.sin(TAU * t / 5.1 + ph);
    P.look = 0.25 * noise2(t * 0.35, s, s + 3);
    return withBlink(P, t, s);
  },
  // contact → down → passing → up; 18 frames per step at speed 1
  walk(t, s = 1, speed = 1, stride = 1) {
    const P = basePose(); const ph = hash01(s, 2) * TAU;
    const f = TAU * t * (30 / 36) * speed + ph;
    const sw = Math.sin(f);
    P.lF = [0.42 * sw * stride, -(0.62 * Math.max(0, Math.cos(f)) ** 1.5) * stride - 0.04, 0.12 * sw];
    P.lB = [-0.42 * sw * stride, -(0.62 * Math.max(0, -Math.cos(f)) ** 1.5) * stride - 0.04, -0.12 * sw];
    P.aF = [-0.34 * sw * stride, 0.22 + 0.16 * Math.max(0, sw)];
    P.aB = [0.34 * sw * stride, 0.22 + 0.16 * Math.max(0, -sw)];
    P.bob = 0.026 * stride * Math.cos(2 * (f - 0.35)) - 0.008;
    P.lean = 0.045;
    P.headTilt = 0.02 * Math.cos(2 * f);
    P.breath = Math.sin(TAU * t / 3.2 + ph);
    P.hemFlare = 0.06 * Math.abs(sw) * stride;
    return withBlink(P, t, s);
  },
  // old man with a cane: 26 frames per step (speed 1), bent back, short shuffling steps, the cane
  // swings forward and plants, a slight tremor, slow head turns (look + tilt), heavy breathing.
  oldWalk(t, s = 1, speed = 1) {
    const P = basePose(); const ph = hash01(s, 4) * TAU;
    const f = TAU * t * (30 / 52) * speed + ph;
    const sw = Math.sin(f), cs = Math.cos(f);
    P.lF = [0.24 * sw - 0.06, -(0.42 * Math.max(0, cs) ** 1.4) - 0.2, 0.1 * sw + 0.08];
    P.lB = [-0.24 * sw - 0.06, -(0.42 * Math.max(0, -cs) ** 1.4) - 0.2, -0.1 * sw + 0.08];
    P.bob = 0.012 * Math.cos(2 * (f - 0.5)) - 0.03;
    P.lean = 0.42 + 0.02 * Math.cos(2 * f);
    // cane arm: forward and down, reaches ahead before the back foot passes, then plants
    const reach = 0.5 + 0.5 * Math.sin(f + 0.9);
    P.aF = [0.78 + 0.16 * reach + 0.015 * tremor(t, s), -0.12 - 0.06 * reach, -0.1];
    P.aB = [0.25 - 0.08 * sw, 0.35];
    P.propUp = -0.05 + 0.14 * (reach - 0.5) + 0.02 * tremor(t, s, 6.3);
    P.plant = true;
    const turn = Math.sin(TAU * t / 7.5 + ph);
    P.headTilt = 0.34 + 0.05 * turn + 0.015 * Math.cos(2 * f);
    P.look = 0.55 * Math.sin(TAU * t / 7.5 + ph - 0.6);
    P.lookY = 0.1;
    P.breath = Math.sin(TAU * t / 3.0 + ph) * 1.3;
    expr(P, 'tired', 0.6);
    P.hemFlare = 0.03 * Math.abs(sw);
    return withBlink(P, t, s);
  },
  // old man standing bent over his cane: heavy slow breathing, small sway, slow head turns, tremor
  oldStand(t, s = 1, lookK = 0) {
    const P = basePose(); const ph = hash01(s, 7) * TAU;
    P.breath = Math.sin(TAU * t / 4.4 + ph) * 1.3;
    P.bob = 0.004 * P.breath - 0.025;
    P.lean = 0.36 + 0.015 * Math.sin(TAU * t / 6.5 + ph);
    P.dx = 0.008 * Math.sin(TAU * t / 6.5 + ph);
    P.lF = [0.12, -0.2, 0.08]; P.lB = [-0.06, -0.16, 0.08];
    P.aF = [0.78 + 0.012 * tremor(t, s), -0.15, -0.12]; P.aB = [0.2, 0.3];
    P.propUp = -0.04 + 0.015 * tremor(t, s, 5.7); P.plant = true;
    P.headTilt = 0.3 + 0.04 * Math.sin(TAU * t / 8.5 + ph) + 0.25 * lookK;
    P.look = 0.5 * Math.sin(TAU * t / 9.5 + ph); P.lookY = 0.1 + 0.6 * lookK;
    expr(P, 'tired', 0.5);
    return withBlink(P, t, s);
  },
  // 9 frames per step, forward lean, big arm pump, flight phase
  run(t, s = 1, speed = 1) {
    const P = basePose(); const ph = hash01(s, 3) * TAU;
    const f = TAU * t * (30 / 18) * speed + ph;
    const sw = Math.sin(f);
    P.lF = [0.85 * sw + 0.15, -1.25 * Math.max(0, Math.cos(f)) - 0.25, 0.25 * sw];
    P.lB = [-0.85 * sw + 0.15, -1.25 * Math.max(0, -Math.cos(f)) - 0.25, -0.25 * sw];
    P.aF = [-0.95 * sw + 0.25, 1.75];
    P.aB = [0.95 * sw + 0.25, 1.75];
    P.bob = 0.06 * Math.abs(Math.cos(f)) - 0.02;
    P.lean = 0.26;
    P.headTilt = -0.06;
    expr(P, 'angry', 0.5); P.mouth = 'open'; P.mo = 0.4;
    return withBlink(P, t, s);
  },
  sit(t, s = 1, seat = 0.45) { // on a bench / stone seat (P.seat = seat height in metres)
    const P = Poses.idle(t, s);
    P.lF = [1.5, -1.5, 0.05]; P.lB = [1.42, -1.46, 0.05];
    P.seat = seat; P.bob = 0.003 * P.breath; P.dx = 0;
    P.aF = [0.55, 0.85]; P.aB = [0.35, 0.9]; P.lean = 0.02;
    return P;
  },
  sitGround(t, s = 1) {
    const P = Poses.idle(t, s);
    P.lF = [1.55, -2.35, 0.3]; P.lB = [1.45, -2.25, 0.3];
    P.seat = 0.1; P.bob = 0.002 * P.breath; P.dx = 0;
    P.aF = [0.7, 0.9]; P.aB = [0.45, 1.0]; P.lean = 0.05;
    return P;
  },
  // old man sitting on a rock by a lamp, both hands stacked on the cane; slow breathing, slow nods,
  // heavy-lidded kind eyes; looks toward the lamp (k = 0..1 how much he gazes down at it).
  sitOld(t, s = 1, seat = 0.42, gaze = 0.4) {
    const P = basePose(); const ph = hash01(s, 5) * TAU;
    P.breath = Math.sin(TAU * t / 4.6 + ph) * 1.2;
    P.seat = seat; P.bob = 0.004 * P.breath;
    P.lF = [1.38, -1.55, 0.12]; P.lB = [1.3, -1.5, 0.12];
    P.lean = 0.3 + 0.012 * P.breath;
    P.aF = [0.95 + 0.01 * tremor(t, s), 0.42, -0.25]; P.aB = [0.85, 0.55, -0.2];
    P.propUp = 0.06 + 0.012 * tremor(t, s, 5.1); P.plant = true;
    const nod = Math.sin(TAU * t / 9 + ph);
    P.headTilt = 0.22 - 0.06 * gaze + 0.04 * nod;
    P.lookY = -0.5 * gaze + 0.1 * nod; P.look = 0.2 * Math.sin(TAU * t / 11 + ph);
    expr(P, 'kind', 0.8); P.eye = Math.min(P.eye, 0.78);
    return withBlink(P, t, s);
  },
  beg(t, s = 1) { // sitting on the ground, bowl held up
    const P = Poses.sitGround(t, s);
    P.aF = [1.2 + 0.05 * Math.sin(t * 1.3), 0.5]; P.aB = [0.4, 1.3]; P.lean = 0.12;
    return expr(P, 'sad', 1);
  },
  proudWalk(t, s = 1, speed = 0.9) {
    const P = Poses.walk(t, s, speed, 0.85);
    P.aF = [0.15 - 0.12 * Math.sin(TAU * t * (30 / 36) * speed), 0.9]; P.aB = [-0.2, 1.4];
    P.lean = -0.06; expr(P, 'proud', 1);
    return P;
  },
  talk(t, s = 1, energy = 1) {
    const P = Poses.idle(t, s);
    P.aF = [0.75 + 0.25 * Math.sin(TAU * t * 0.9) * energy, 1.1 + 0.3 * Math.sin(TAU * t * 1.3)];
    P.mouth = 'talk'; P.mo = clamp(0.3 + 0.7 * Math.abs(Math.sin(TAU * t * 3.2)) * (0.6 + 0.4 * Math.sin(TAU * t)), 0, 1);
    P.headTilt += 0.04 * Math.sin(TAU * t * 1.1);
    return P;
  },
  whisper(t, s = 1, k = 1) {
    const P = Poses.idle(t, s);
    P.lean = 0.28 * k; P.headTilt = -0.1 * k + 0.02 * Math.sin(t * 9);
    P.aF = [lerp(0.06, 1.75, k), lerp(0.08, 2.45, k)];
    expr(P, 'sly', k);
    P.mouth = k > 0.5 ? 'talk' : P.mouth; P.mo = 0.15 + 0.15 * Math.abs(Math.sin(t * 14));
    return P;
  },
  point(t, s = 1, t0 = 0) {
    const P = Poses.idle(t, s);
    const u = t - t0;
    P.handF = 'point';
    if (u < -0.3) { P.handF = 'open'; return expr(P, 'angry', 0.6); }
    if (u < 0) { const k = smooth((u + 0.3) / 0.3); P.aF = [lerp(0.06, -0.35, k), lerp(0.1, 1.2, k)]; P.lean = -0.06 * k; return expr(P, 'angry', 1); }
    const k = easeOutBackK(u / 0.2, 2.2);
    P.aF = [lerp(-0.35, 1.52, k), lerp(1.2, 0.04, clamp(k))]; P.lean = lerp(-0.06, 0.1, clamp(k));
    expr(P, 'angry', 1); P.mouth = 'open'; P.mo = 0.35 + 0.35 * Math.abs(Math.sin(t * 9));
    return P;
  },
  shout(t, s = 1) {
    const P = Poses.idle(t, s); const ph = hash01(s, 11) * TAU;
    const b = Math.sin(TAU * t * 2.1 + ph);
    P.aF = [2.2 + 0.4 * b, 0.4 + 0.3 * Math.sin(TAU * t * 3 + ph)]; P.aB = [0.4 - 0.3 * b, 1.2];
    P.bob = 0.03 * Math.abs(b); P.lean = 0.12 + 0.06 * b;
    expr(P, 'angry', 1); P.mo = 0.5 + 0.5 * Math.abs(b);
    return P;
  },
  shove(t, s = 1) {
    const P = Poses.idle(t, s); const ph = hash01(s, 12) * TAU;
    const b = Math.max(0, Math.sin(TAU * t * 1.4 + ph));
    P.aF = [1.45, 0.15 + 0.4 * (1 - b)]; P.aB = [1.3, 0.4 + 0.4 * (1 - b)]; P.lean = 0.18 + 0.12 * b;
    P.lF = [0.35, -0.2]; P.lB = [-0.3, -0.05];
    return expr(P, 'angry', 1);
  },
  turnAway(t, s = 1) { const P = Poses.idle(t, s); P.headTilt = -0.05; return expr(P, 'hurt', 0.7); },
  hold(t, s = 1) { const P = Poses.idle(t, s); P.aF = [0.45, 1.1]; P.aB = [0.35, 1.2]; return expr(P, 'happy', 1); },
  sell(t, s = 1) {
    const P = Poses.talk(t, s, 1.2);
    P.aB = [0.5, 1.4]; expr(P, 'happy', 0.8); P.mouth = 'talk';
    return P;
  },
  // cradling a baby (use person.hold(baby)): gentle rocking, head bowed toward the child, soft smile
  holdBaby(t, s = 1, rockK = 1) {
    const P = Poses.idle(t, s); const ph = hash01(s, 6) * TAU;
    const rock = Math.sin(TAU * t * 0.42 + ph) * rockK;
    P.aF = [0.5 + 0.04 * rock, 1.25 - 0.03 * rock, 0.25]; P.aB = [0.42 + 0.03 * rock, 1.45, 0.2];
    P.handF = 'open'; P.handB = 'open';
    P.lean = 0.05 + 0.025 * rock; P.dx = 0.01 * rock;
    P.cradleRot = 0.16 + 0.07 * rock;
    P.headTilt = -0.2 + 0.03 * rock; P.lookY = -0.75; P.look = 0.2;
    expr(P, 'peace', 0.85);
    P.baby = Poses.baby(t, s + 100, false);
    return P;
  },
  // builder's hammer (or adze): anticipation (raise), fast strike, impact recoil, follow-through settle.
  // P.hit = 0..1 impact pulse (for dust / sound). period in seconds per blow.
  hammer(t, s = 1, period = 1.0) {
    const P = Poses.idle(t, s);
    const u = frac(t / period + hash01(s, 13) * 0.3);
    let arm, el, lean, hand;
    if (u < 0.5) { const k = smooth(u / 0.5); arm = lerp(0.85, 2.55, k); el = lerp(0.75, 1.35, k); lean = lerp(0.12, -0.05, k); hand = lerp(0.1, 0.6, k); }
    else if (u < 0.6) { const k = (u - 0.5) / 0.1; const e = k * k; arm = lerp(2.55, 0.6, e); el = lerp(1.35, 0.15, e); lean = lerp(-0.05, 0.2, e); hand = lerp(0.6, -0.35, e); }
    else if (u < 0.68) { const k = (u - 0.6) / 0.08; arm = 0.6 + 0.12 * Math.sin(Math.PI * k); el = 0.15 + 0.1 * Math.sin(Math.PI * k); lean = 0.2; hand = -0.35 + 0.15 * Math.sin(Math.PI * k); }
    else { const k = smooth((u - 0.68) / 0.32); arm = lerp(0.6, 0.85, k); el = lerp(0.15, 0.75, k); lean = lerp(0.2, 0.12, k); hand = lerp(-0.35, 0.1, k); }
    P.aF = [arm, el, hand]; P.aB = [0.5, 1.15, 0.0]; P.handB = 'grip';
    P.lean = lean; P.bob = u > 0.58 && u < 0.7 ? -0.012 * Math.sin(Math.PI * (u - 0.58) / 0.12) : 0;
    P.lF = [0.25, -0.12]; P.lB = [-0.22, -0.04];
    P.headTilt = -0.12; P.lookY = -0.6;
    P.hit = u >= 0.58 && u < 0.7 ? Math.sin(Math.PI * (u - 0.58) / 0.12) : 0;
    P.propRot = 0.25;
    return expr(P, 'focus', 1);
  },
  // mocking crowd member: one arm points, the other holds the belly, laughing head bob
  pointLaugh(t, s = 1) {
    const P = Poses.idle(t, s); const ph = hash01(s, 14) * TAU;
    const f = 4.2 + hash01(s, 15) * 1.2, b = Math.abs(Math.sin(TAU * t * f / 2 + ph));
    P.handF = 'point';
    P.aF = [1.42 + 0.06 * Math.sin(TAU * t * 1.3 + ph), 0.05, 0.0];
    P.aB = [0.55, 1.65, 0.2];
    P.lean = -0.08 + 0.05 * b; P.bob = 0.014 * b;
    P.headTilt = 0.14 + 0.08 * b;
    expr(P, 'laugh', 1); P.mo = 0.55 + 0.45 * b;
    return P;
  },
  // looking up at the sky / the light (k = 0..1)
  lookUp(t, s = 1, k = 1) {
    const P = Poses.idle(t, s);
    P.headTilt = lerp(P.headTilt, 0.42, k); P.lookY = 0.9 * k;
    P.aF = [lerp(P.aF[0], 0.35, k), lerp(P.aF[1], 0.5, k)]; P.aB = [lerp(P.aB[0], 0.2, k), lerp(P.aB[1], 0.4, k)];
    P.lean = lerp(P.lean, -0.05, k);
    expr(P, 'wonder', k);
    return P;
  },
  // swaddled baby (Person with kind 'baby'): sleeps, small wiggles, rare stretch
  baby(t, s = 1, awake = false) {
    const ph = hash01(s, 16) * TAU;
    const P = { bob: 0.004 * Math.sin(TAU * t / 2.4 + ph), lean: 0.03 * Math.sin(TAU * t / 3.1 + ph), headTilt: 0.05 * Math.sin(TAU * t / 4.3 + ph), dx: 0 };
    P.babyEye = awake ? (blinkF(Math.round(t * 30), s) < 0.5 ? 'closed' : 'open') : 'closed';
    return P;
  },
};
