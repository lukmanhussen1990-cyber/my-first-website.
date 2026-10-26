// Paper-cut people for SEVEN THINGS — flat 2D parts with real pivots, standing in the 3D world.
// Rig: hips → thigh → shin → foot; torso → neck → head (eye, lids, pupil, brows, mouths, hair/wrap, beard);
// torso → upper arm → forearm → hand; separate robe HEM, HEAD-WRAP TAIL and BEARD driven by
// pure-function springs (follow-through). Local space: facing +x, feet at y=0, height 1.75 before scaling.
import * as THREE from 'three';
import { flat, outlineMaterial, radialTex } from './materials.js';
import { hash01, clamp, lerp, smooth, invLerp, easeOutBackK, blinkF, noise2 } from '../lib/util.js';

// ---------- 2D geometry helpers ----------
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
// almond eye: two arcs meeting in points
function almond(w, h, n = 10) {
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) { const u = i / n, x = -w + 2 * w * u, y = Math.sin(Math.PI * u) * h; top.push([x, y * (1.0 - 0.15 * u)]); bot.push([x, -y * 0.8]); }
  return top.concat(bot.reverse().slice(1, -1));
}
export function shadeHex(hex, k) { if (k === 1) return hex; const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }

// ---------- palette (Middle-Eastern skin tones, earthy robes) ----------
export const SKIN = ['#6b4126', '#7d4c2c', '#8f5a33', '#a2693d', '#b47a49', '#c28b58', '#cf9c6a'];
export const HAIR = { black: '#231a14', dark: '#33251b', brown: '#4a3524', grey: '#8f8a83', white: '#e8e3da' };
export const CLOTH = {
  purple: '#5b2a6e', gold: '#c99a3a', sand: '#c9a36a', cream: '#e3d6bb', olive: '#6b6e3f', slate: '#4f6478', rust: '#a9552c',
  brick: '#93402a', teal: '#3c6b66', indigo: '#3b456f', brown: '#6e4a2e', stone: '#8a8172', wine: '#72303a', ochre: '#bf8c31',
  moss: '#53653a', rag: '#7f6a52', charcoal: '#383533', sky: '#5f87a3', rose: '#b06a5e',
};

// ---------- the person ----------
export class Person {
  constructor(o = {}) {
    this.o = o = Object.assign({
      seed: 1, height: 1.75, skin: SKIN[3], hair: 'short', hairColor: HAIR.black, beard: 'none', beardColor: HAIR.black,
      outfit: 'tunic', cloth: CLOTH.rust, trim: null, belt: '#d7b484', sleeve: null, legs: null, shoes: '#3a2a1e',
      wrap: null, wrapTail: false, prop: null, build: 1, kid: false,
    }, o);
    this.seed = o.seed;
    this.root = new THREE.Group(); this.bb = new THREE.Group(); this.body = new THREE.Group();
    this.root.add(this.bb); this.bb.add(this.body); this.bb.rotation.order = 'YXZ';
    this.lineMat = outlineMaterial(0.01);
    this.facing = 1; this.flip = 1;
    this.scale = o.height / 1.75;
    this._build();
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex(), color: '#1a120a', transparent: true, opacity: 0.4, depthWrite: false, fog: true }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.scale.set(0.6 * this.scale * o.build, 0.28 * this.scale, 1); blob.renderOrder = -1;
    this.blob = blob; this.root.add(blob);
    this.pose(basePose());
  }

  _part(parent, pts, color, z, opts = {}) {
    const g = partGeo(pts);
    const fill = new THREE.Mesh(g, opts.mat || flat(color)); fill.position.z = z; parent.add(fill);
    fill.castShadow = !!opts.shadow;
    let line = null;
    if (opts.outline !== false) { line = new THREE.Mesh(g, this.lineMat); line.position.z = z - 0.004; parent.add(line); }
    return { fill, line };
  }
  _pivot(parent, x, y, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

  _build() {
    const o = this.o, b = o.build, k = o.kid;
    const hipY = 0.86, shY = 1.37, skin = o.skin, legCol = o.legs || skin;
    const mkLeg = (x, z, shade) => {
      const hip = this._pivot(this.body, x, hipY);
      this._part(hip, capsule(0.42, 0.066 * b, 0.058 * b), shadeHex(legCol, shade), z, { shadow: true });
      const knee = this._pivot(hip, 0, -0.42);
      this._part(knee, capsule(0.36, 0.058 * b, 0.052 * b), shadeHex(legCol, shade), z + 0.001, { shadow: true });
      const foot = this._pivot(knee, 0, -0.36);
      this._part(foot, [[-0.06, 0.035], [0.05, 0.04], [0.16, 0.0], [0.165, -0.045], [-0.07, -0.05]], shadeHex(o.shoes, shade), z + 0.002, { shadow: true });
      return { hip, knee, foot };
    };
    this.legB = mkLeg(-0.045, 0.012, 0.8);
    this.legF = mkLeg(0.035, 0.024, 1.0);
    this.torso = this._pivot(this.body, 0, hipY);
    const T = this.torso, sy = shY - hipY;
    let hem = o.outfit === 'robe' ? 0.14 : o.outfit === 'tunic' ? 0.48 : 0.8;
    if (o.hem != null) hem = o.hem;
    const hy = hem - hipY;
    const flare = o.outfit === 'robe' ? 0.29 : 0.25;
    const cut = hy + 0.13; // robe body ends here; the hem flap continues below
    const xAt = (y, s) => { const u = clamp((0.05 - y) / (0.05 - hy)); return s > 0 ? lerp(0.17, flare - 0.03, u) * b : -lerp(0.18, flare + 0.02, u) * b; };
    const robePts = [[-0.175 * b, sy + 0.01], [-0.11 * b, sy + 0.075], [0.1 * b, sy + 0.075], [0.165 * b, sy], [0.17 * b, 0.05], [xAt(cut, 1), cut], [xAt(cut, -1), cut], [-0.18 * b, 0.05]];
    this._part(T, robePts, o.cloth, 0.036, { shadow: true });
    // hem flap (follow-through), pivot at its top centre
    this.hem = this._pivot(T, 0, cut + 0.03);
    const hp = [[xAt(cut + 0.03, -1), 0], [xAt(cut + 0.03, 1), 0], [xAt(hy, 1), hy - cut - 0.03], [xAt(hy, -1), hy - cut - 0.03]];
    this._part(this.hem, hp, o.cloth, 0.0355, { shadow: true });
    if (o.trim) this._part(this.hem, [[xAt(hy + 0.04, -1), hy - cut - 0.03 + 0.045], [xAt(hy + 0.04, 1), hy - cut - 0.03 + 0.045], [xAt(hy, 1), hy - cut - 0.03], [xAt(hy, -1), hy - cut - 0.03]], o.trim, 0.0357, { outline: false });
    if (o.belt) { const by = 0.9 - hipY; this._part(T, [[-0.175 * b, by - 0.026], [0.165 * b, by - 0.026], [0.168 * b, by + 0.026], [-0.172 * b, by + 0.026]], o.belt, 0.044, { outline: false }); }
    if (o.sash) this._part(T, [[0.12 * b, sy + 0.06], [0.16 * b, sy - 0.02], [-0.12 * b, 0.0], [-0.17 * b, 0.07]], o.sash, 0.045, { outline: false });
    if (o.trim) this._part(T, [[-0.035, sy + 0.075], [0.035, sy + 0.075], [0.025, sy - 0.25], [-0.025, sy - 0.25]], o.trim, 0.046, { outline: false });
    // neck + head
    const hs = k ? 1.28 : 1.08;
    this.neck = this._pivot(T, 0.005, sy + 0.04);
    this._part(this.neck, [[-0.05, -0.06], [0.05, -0.06], [0.045, 0.06], [-0.045, 0.06]], shadeHex(skin, 0.85), 0.05, { outline: false });
    this.head = this._pivot(this.neck, 0, 0.02); this.head.scale.setScalar(hs);
    const H = this.head;
    const headPts = smoothClosed([[-0.055, -0.05], [-0.13, 0.05], [-0.165, 0.17], [-0.12, 0.29], [-0.02, 0.335], [0.09, 0.305], [0.135, 0.235], [0.148, 0.19], [0.205, 0.142], [0.152, 0.118], [0.158, 0.085], [0.13, 0.042], [0.065, 0.012], [0.06, -0.05]], 56);
    this._part(H, headPts, skin, 0.052, { shadow: true });
    // almond eye with lids
    this.eye = this._pivot(H, 0.09, 0.19, 0.06);
    this._part(this.eye, almond(0.036, 0.021), '#f4e8d4', 0, { outline: false });
    this.pupil = this._part(this.eye, ellipse(0.0, 0.0, 0.0125, 0.014, 12), '#1a110b', 0.002, { outline: false }).fill;
    this.lid = this._pivot(this.eye, 0, 0.024, 0.004);
    this._part(this.lid, [[-0.04, 0], [0.04, 0], [0.04, 0.012], [-0.04, 0.012]], shadeHex(skin, 0.92), 0, { outline: false });
    this.lidMesh = this.lid.children[0];
    this._part(this.eye, almond(0.039, 0.024), shadeHex(skin, 0.5), -0.001, { outline: false });
    this.brow = this._pivot(H, 0.09, 0.238, 0.064);
    this._part(this.brow, rrect(-0.038, -0.008, 0.038, 0.008, 0.007), o.age === 'old' ? '#d8d2c8' : shadeHex(o.hairColor, 0.8), 0, { outline: false });
    // mouths
    this.mouth = this._pivot(H, 0.142, 0.073, 0.068);
    const M = (pts, c = '#3a120c') => { const m = this._part(this.mouth, pts, c, 0, { outline: false }).fill; return m; };
    this.mSmile = M([[-0.035, 0.012], [-0.012, -0.006], [0.012, -0.004], [0.014, 0.004], [-0.01, 0.002]], '#4a1e14');
    this.mFrown = M([[-0.035, -0.006], [-0.012, 0.01], [0.012, 0.008], [0.014, 0.0], [-0.01, 0.003]], '#4a1e14');
    this.mO = M(ellipse(-0.004, -0.01, 0.013, 0.016, 12));
    this.mOpen = this._pivot(this.mouth, 0, 0, 0);
    this._part(this.mOpen, ellipse(-0.006, -0.012, 0.034, 0.03, 18, Math.PI, Math.PI * 2).concat([[0.028, -0.004], [-0.04, -0.004]]), '#3a120c', 0, { outline: false });
    this._part(this.mOpen, [[-0.03, -0.006], [0.022, -0.006], [0.018, -0.014], [-0.026, -0.014]], '#f2e6d8', 0.001, { outline: false });
    this.mTalk = this._pivot(this.mouth, 0, 0, 0);
    this._part(this.mTalk, ellipse(-0.006, -0.008, 0.02, 0.016, 14), '#3a120c', 0, { outline: false });
    // hair / head wrap
    const hc = o.hairColor;
    const styles = {
      short: [[0.122, 0.27], [0.06, 0.345], [-0.07, 0.345], [-0.172, 0.245], [-0.18, 0.11], [-0.125, 0.03], [-0.075, 0.075], [-0.06, 0.17], [0.0, 0.25], [0.1, 0.24]],
      curly: [[0.13, 0.27], [0.1, 0.33], [0.03, 0.37], [-0.06, 0.37], [-0.15, 0.33], [-0.2, 0.24], [-0.2, 0.12], [-0.15, 0.04], [-0.08, 0.08], [-0.06, 0.17], [0.0, 0.26], [0.1, 0.25]],
      long: [[0.122, 0.27], [0.06, 0.345], [-0.07, 0.35], [-0.18, 0.25], [-0.2, 0.05], [-0.215, -0.22], [-0.13, -0.27], [-0.08, -0.05], [-0.06, 0.17], [0.0, 0.25], [0.1, 0.24]],
      bald: [[-0.03, 0.222], [-0.1, 0.25], [-0.162, 0.2], [-0.175, 0.1], [-0.125, 0.025], [-0.092, 0.06], [-0.12, 0.12], [-0.105, 0.18], [-0.05, 0.198]],
      wrap: [[0.14, 0.24], [0.13, 0.33], [0.04, 0.39], [-0.1, 0.38], [-0.19, 0.3], [-0.2, 0.17], [-0.15, 0.12], [-0.06, 0.2], [0.06, 0.25]],
      turban: [[0.15, 0.23], [0.15, 0.33], [0.06, 0.41], [-0.08, 0.42], [-0.2, 0.34], [-0.21, 0.19], [-0.15, 0.13], [-0.05, 0.2], [0.07, 0.24]],
      veil: [[0.13, 0.26], [0.1, 0.35], [-0.02, 0.385], [-0.15, 0.34], [-0.215, 0.2], [-0.24, -0.06], [-0.26, -0.33], [-0.1, -0.33], [-0.07, 0.0], [-0.04, 0.17], [0.04, 0.245]],
    };
    if (styles[o.hair]) {
      const cloth = ['wrap', 'turban', 'veil'].includes(o.hair);
      const col = cloth ? (o.wrap || CLOTH.cream) : hc;
      if (cloth) this._part(H, smoothClosed([[0.12, 0.25], [0.04, 0.3], [-0.06, 0.29], [-0.06, 0.2], [0.02, 0.22]], 18), hc, 0.0625, { outline: false });
      this.hairPart = this._part(H, smoothClosed(styles[o.hair], 44), col, 0.064, { shadow: true });
      if (o.hair === 'turban' || o.hair === 'wrap') this._part(H, [[0.16, 0.25], [0.13, 0.29], [-0.19, 0.25], [-0.18, 0.21]], shadeHex(col, 0.78), 0.066, { outline: false });
      if (o.wrapTail || o.hair === 'veil') {
        // the tail hangs from the back of the head on its own pivot (follow-through)
        this.tail = this._pivot(H, -0.17, 0.24, 0);
        const L = o.hair === 'veil' ? 0.5 : 0.36;
        this._part(this.tail, [[-0.02, 0.02], [0.05, 0.0], [0.02, -L], [-0.07, -L + 0.04]], shadeHex(col, 0.92), 0.0638, { shadow: true });
      }
    }
    if (o.beard !== 'none') {
      this.beardPiv = this._pivot(H, 0.06, 0.12, 0);
      const long = o.beard === 'long';
      const pts = (long
        ? [[0.02, 0.19], [0.07, 0.13], [0.12, 0.11], [0.16, 0.1], [0.178, 0.05], [0.17, -0.06], [0.135, -0.2], [0.085, -0.33], [0.045, -0.24], [-0.015, -0.08], [-0.05, 0.07], [-0.04, 0.17]]
        : [[0.0, 0.2], [0.06, 0.125], [0.115, 0.105], [0.158, 0.098], [0.165, 0.04], [0.13, -0.035], [0.06, -0.05], [-0.03, 0.03], [-0.055, 0.14]]).map(([x, y]) => [x - 0.06, y - 0.12]);
      this.beardPart = this._part(this.beardPiv, smoothClosed(pts, 40), o.beardColor, 0.0655, { shadow: true });
      this._part(H, smoothClosed([[0.11, 0.11], [0.165, 0.117], [0.19, 0.098], [0.15, 0.09], [0.1, 0.095]], 16), o.beardColor, 0.067, { outline: false });
      this.mouth.position.z = 0.069;
    }
    // arms
    const mkArm = (x, z, shade) => {
      const sh = this._pivot(T, x, sy - 0.02);
      const sleeve = o.sleeve || o.cloth;
      this._part(sh, capsule(0.29, 0.06 * b, 0.054 * b), shadeHex(sleeve, shade), z, { shadow: true });
      const el = this._pivot(sh, 0, -0.29);
      this._part(el, capsule(0.26, 0.052 * b, 0.046 * b), shadeHex(o.bareArms ? skin : (o.cuff ? sleeve : skin), shade), z + 0.001, { shadow: true });
      const hand = this._pivot(el, 0, -0.27);
      this._part(hand, ellipse(0.005, -0.005, 0.05, 0.05, 14), shadeHex(skin, shade), z + 0.002);
      return { sh, el, hand };
    };
    this.armB = mkArm(-0.03, 0.0, 0.8);
    this.armF = mkArm(0.02, 0.078, 1.0);
    this.prop = null; this.propCache = {};
    if (o.prop) this.setProp(o.prop);
    this.body.scale.setScalar(this.scale);
  }

  setProp(kind) {
    if ((this.propKind || null) === (kind || null)) return this.prop;
    if (this.prop) { this.armF.hand.remove(this.prop); this.prop = null; }
    this.propKind = kind || null;
    if (!kind) return null;
    if (this.propCache[kind]) { this.prop = this.propCache[kind]; this.armF.hand.add(this.prop); return this.prop; }
    const g = new THREE.Group(); const z = 0.004;
    const P = (pts, c, zz = z, ol = true) => this._part(g, pts, c, zz, { outline: ol });
    if (kind === 'bowl') { P([[-0.09, 0.0], [0.09, 0.0], [0.06, -0.06], [-0.06, -0.06]], '#8a6a46'); g.position.set(0.02, 0.03, 0); }
    else if (kind === 'staff') P(rrect(-0.018, -0.95, 0.018, 0.75, 0.012), '#6a4528', -0.09);
    else if (kind === 'fruitGood') { P(ellipse(0, 0.0, 0.055, 0.055, 12), '#e0742c'); P([[-0.01, 0.05], [0.01, 0.05], [0.02, 0.08], [0.0, 0.08]], '#4f6a2a', z + 0.002, false); }
    else if (kind === 'fruitBad') { P(ellipse(0, 0.0, 0.055, 0.05, 12), '#6b5a2e'); P(ellipse(0.02, 0.01, 0.018, 0.014, 8), '#3d3220', z + 0.002, false); }
    else if (kind === 'cup') { P([[-0.04, 0.0], [0.045, 0.0], [0.055, 0.11], [-0.05, 0.11]], '#c99a3a'); }
    this.armF.hand.add(g); this.prop = g; this.propCache[kind] = g;
    return g;
  }

  // facing: +1 right / -1 left; flip (0..1) = paper-turn progress (squashes through 0)
  setFacing(f, turn = null) {
    this.facing = f >= 0 ? 1 : -1;
    let sx = this.facing;
    if (turn !== null) sx = Math.cos(Math.PI * clamp(turn)) * -this.facing; // turning from -f to f
    this.body.scale.x = (Math.abs(sx) < 0.04 ? 0.04 * Math.sign(sx || 1) : sx) * this.scale;
  }

  billboard(camera, lean = 0.3) {
    const p = this.root.getWorldPosition(_v1), c = camera.position;
    const dx = c.x - p.x, dz = c.z - p.z;
    this.bb.rotation.y = Math.atan2(dx, dz);
    this.bb.rotation.x = -clamp(Math.atan2(c.y - p.y - 1, Math.hypot(dx, dz)), -0.4, 1.2) * lean;
  }

  // thin outline: ~1/180 of on-screen height, never under 1.2 px
  autoOutline(camera, viewH = 1920) {
    const p = this.root.getWorldPosition(_v1);
    const a = _v2.copy(p).project(camera), b2 = _v3.copy(p).setY(p.y + this.o.height).project(camera);
    const px = Math.abs(b2.y - a.y) * 0.5 * viewH;
    const outPx = clamp(px / 180, 1.2, 4.2);
    this.lineMat.userData.uOutline.value = px > 1 ? outPx / px * 1.75 : 0.02;
    return px;
  }

  pose(P) {
    this.P = P; const s = this;
    s.body.position.y = P.bob || 0; s.body.position.x = P.dx || 0;
    s.torso.rotation.z = -(P.lean || 0);
    s.neck.rotation.z = P.headTilt || 0;
    s.armF.sh.rotation.z = P.aF[0]; s.armF.el.rotation.z = P.aF[1]; s.armF.hand.rotation.z = P.aF[2] || 0;
    s.armB.sh.rotation.z = P.aB[0]; s.armB.el.rotation.z = P.aB[1]; s.armB.hand.rotation.z = P.aB[2] || 0;
    s.legF.hip.rotation.z = P.lF[0]; s.legF.knee.rotation.z = P.lF[1]; s.legF.foot.rotation.z = P.lF[2] || 0;
    s.legB.hip.rotation.z = P.lB[0]; s.legB.knee.rotation.z = P.lB[1]; s.legB.foot.rotation.z = P.lB[2] || 0;
    // eye: lids close for blinks / pride; pupil look
    const open = clamp(P.eye ?? 1, 0.06, 1.25);
    s.eye.scale.set(1, Math.max(1, open), 1);
    s.lid.scale.set(1, clamp(1 + (1 - Math.min(1, open)) * 3.4, 1, 4.4), 1);
    s.lid.position.y = 0.024 - (1 - Math.min(1, open)) * 0.036;
    s.pupil.position.x = (P.look || 0) * 0.013; s.pupil.position.y = (P.lookY || 0) * 0.008;
    s.brow.rotation.z = -(P.brow || 0); s.brow.position.y = 0.238 + (P.browY || 0) * 0.022;
    const m = P.mouth || 'none';
    s.mSmile.visible = m === 'smile'; s.mFrown.visible = m === 'frown'; s.mO.visible = m === 'o';
    s.mOpen.visible = m === 'open'; s.mOpen.scale.set(1, 0.35 + 0.75 * (P.mo ?? 1), 1);
    s.mTalk.visible = m === 'talk'; s.mTalk.scale.set(1, 0.25 + 0.95 * (P.mo ?? 0.5), 1);
    // secondary (follow-through) angles, computed by the caller from motion history
    s.hem.rotation.z = clamp(P.hemRot || 0, -0.35, 0.35);
    s.hem.scale.x = 1 + Math.abs(P.hemRot || 0) * 0.25;
    if (s.tail) s.tail.rotation.z = clamp((P.tailRot || 0) - 0.08, -0.9, 0.6);
    if (s.beardPiv) s.beardPiv.rotation.z = clamp(P.beardRot || 0, -0.25, 0.25);
    if (s.prop && P.propRot != null) s.prop.rotation.z = P.propRot;
  }

  // apply secondary motion from a velocity (m/s, + = facing direction) and acceleration
  secondary(P, { vx = 0, ax = 0, ay = 0, t = 0, wind = 0.4 }) {
    // local +x = facing direction; a negative z-rotation swings a hanging part backwards
    const flutter = noise2(t * 2.3, this.seed * 0.7, this.seed) * wind;
    P.hemRot = -0.05 * clamp(vx, -5, 5) - 0.03 * ax + 0.015 * ay + flutter * 0.06;
    P.tailRot = -0.17 * clamp(vx, -5, 5) - 0.05 * ax + 0.02 * ay + flutter * 0.22;
    P.beardRot = -0.02 * clamp(vx, -5, 5) - 0.02 * ax + 0.012 * ay + flutter * 0.04;
    return P;
  }
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

// ---------- expressions ----------
export function expr(P, kind, k = 1) {
  const E = {
    neutral: { brow: 0, browY: 0 },
    proud: { brow: -0.12, browY: 0.35, eye: 0.62, headTilt: 0.16, mouth: 'smile' },
    angry: { brow: 0.48, browY: -0.3, mouth: 'open', mo: 0.55 },
    sad: { brow: -0.4, browY: 0.22, headTilt: -0.1, mouth: 'frown', lookY: -0.6 },
    surprised: { brow: -0.15, browY: 0.62, eye: 1.2, mouth: 'o' },
    happy: { brow: -0.1, browY: 0.18, mouth: 'smile' },
    sly: { brow: 0.22, browY: -0.05, eye: 0.75, mouth: 'smile', look: 0.6 },
    hurt: { brow: -0.45, browY: 0.3, eye: 0.9, mouth: 'frown', headTilt: -0.05 },
  }[kind] || {};
  for (const [key, v] of Object.entries(E)) {
    if (typeof v === 'number') P[key] = lerp(P[key] ?? (key === 'eye' ? 1 : 0), v, k);
    else if (k > 0.5) P[key] = v;
  }
  return P;
}

// ---------- poses (t in seconds; s = seed) ----------
export function basePose() {
  return { bob: 0, lean: 0, headTilt: 0, aF: [0.06, 0.08], aB: [-0.05, 0.06], lF: [0.03, 0], lB: [-0.03, 0], eye: 1, brow: 0, browY: 0, mouth: 'none', mo: 0 };
}
const TAU = Math.PI * 2;
const withBlink = (P, t, s) => { P.eye = Math.min(P.eye ?? 1, blinkF(Math.round(t * 30), s)); return P; };

export const Poses = {
  idle(t, s = 1) { // breathing + weight shift
    const P = basePose(); const ph = hash01(s, 1) * TAU;
    P.bob = 0.006 * Math.sin(TAU * t / 3.6 + ph);
    P.dx = 0.012 * Math.sin(TAU * t / 7.3 + ph);
    P.lean = 0.012 * Math.sin(TAU * t / 7.3 + ph + 1);
    P.aF[0] = 0.06 + 0.025 * Math.sin(TAU * t / 3.6 + ph + 1);
    P.aB[0] = -0.05 + 0.025 * Math.sin(TAU * t / 3.6 + ph + 2);
    P.headTilt = 0.025 * Math.sin(TAU * t / 5.1 + ph);
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
    P.bob = 0.026 * stride * Math.cos(2 * (f - 0.35)) - 0.008;   // low just after contact, high at passing
    P.lean = 0.045;
    P.headTilt = 0.02 * Math.cos(2 * f);
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
  sit(t, s = 1, seat = 0.45) { // on a bench / stone seat (hips at seat height)
    const P = Poses.idle(t, s);
    P.lF = [1.5, -1.5, 0.05]; P.lB = [1.42, -1.46, 0.05];
    P.bob = seat - 0.86 + 0.06 + P.bob; P.dx = 0;
    P.aF = [0.55, 0.85]; P.aB = [0.35, 0.9]; P.lean = 0.02;
    return P;
  },
  sitGround(t, s = 1) {
    const P = Poses.idle(t, s);
    P.lF = [1.55, -2.35, 0.3]; P.lB = [1.45, -2.25, 0.3];
    P.bob = -0.66 + P.bob * 0.5; P.dx = 0;
    P.aF = [0.7, 0.9]; P.aB = [0.45, 1.0]; P.lean = 0.05;
    return P;
  },
  beg(t, s = 1) { // sitting on the ground, bowl held up
    const P = Poses.sitGround(t, s);
    P.aF = [1.2 + 0.05 * Math.sin(t * 1.3), 0.5]; P.aB = [0.4, 1.3]; P.lean = 0.12;
    return expr(P, 'sad', 1);
  },
  proudWalk(t, s = 1, speed = 0.9) {
    const P = Poses.walk(t, s, speed, 0.85);
    P.aF = [0.15 - 0.12 * Math.sin(TAU * t * (30 / 36) * speed), 0.9]; P.aB = [-0.2, 1.4]; // hand on chest / behind back
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
  whisper(t, s = 1, k = 1) { // lean into someone's ear, hand cupped at the mouth
    const P = Poses.idle(t, s);
    P.lean = 0.28 * k; P.headTilt = -0.1 * k + 0.02 * Math.sin(t * 9);
    P.aF = [lerp(0.06, 1.75, k), lerp(0.08, 2.45, k)];
    expr(P, 'sly', k);
    P.mouth = k > 0.5 ? 'talk' : P.mouth; P.mo = 0.15 + 0.15 * Math.abs(Math.sin(t * 14));
    return P;
  },
  // point at someone: anticipation (pull back) → snap with overshoot → hold
  point(t, s = 1, t0 = 0) {
    const P = Poses.idle(t, s);
    const u = t - t0;
    if (u < -0.3) return expr(P, 'angry', 0.6);
    if (u < 0) { const k = smooth((u + 0.3) / 0.3); P.aF = [lerp(0.06, -0.35, k), lerp(0.1, 1.2, k)]; P.lean = -0.06 * k; return expr(P, 'angry', 1); }
    const k = easeOutBackK(u / 0.2, 2.2);
    P.aF = [lerp(-0.35, 1.52, k), lerp(1.2, 0.04, clamp(k))]; P.lean = lerp(-0.06, 0.1, clamp(k));
    expr(P, 'angry', 1); P.mouth = 'open'; P.mo = 0.35 + 0.35 * Math.abs(Math.sin(t * 9));
    return P;
  },
  shout(t, s = 1) { // agitated crowd member
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
  sell(t, s = 1) { // friendly seller, open hand gesture
    const P = Poses.talk(t, s, 1.2);
    P.aB = [0.5, 1.4]; expr(P, 'happy', 0.8); P.mouth = 'talk';
    return P;
  },
};
