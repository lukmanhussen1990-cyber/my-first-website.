// Flat 2D cut-out people living in the 3D world (billboards), built from separate parts so
// they can act: head / hair / beard / brows / eye / mouth, torso+robe, 2-segment arms & legs, props.
// Local space: facing +x, feet at y=0, height 1.75 before scaling.
import * as THREE from 'three';
import { flat, outlineMaterial, radialTex, OUTLINE } from './materials.js';
import { hash01, clamp, lerp, smooth, invLerp } from './util.js';

// ---------- 2D geometry helpers ----------
function signedArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return a / 2; }

export function partGeo(pts) {
  // dedupe consecutive points
  const p = [];
  for (const q of pts) { const l = p[p.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-5) p.push(q); }
  if (Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 1e-5) p.pop();
  const ccw = signedArea(p) > 0;
  const n = p.length;
  const pos = new Float32Array(n * 3), mit = new Float32Array(n * 2);
  const en = [];
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
    pos[i * 3] = p[i][0]; pos[i * 3 + 1] = p[i][1]; pos[i * 3 + 2] = 0;
    mit[i * 2] = mx / d; mit[i * 2 + 1] = my / d;
  }
  const tris = THREE.ShapeUtils.triangulateShape(p.map(([x, y]) => new THREE.Vector2(x, y)), []);
  const idx = []; for (const t of tris) idx.push(t[0], t[1], t[2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('miter', new THREE.BufferAttribute(mit, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export const ellipse = (cx, cy, rx, ry, n = 22, a0 = 0, a1 = Math.PI * 2) => {
  const out = []; const full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6; const N = full ? n : n + 1;
  for (let i = 0; i < N; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return out;
};
// capsule hanging down from pivot (0,0) to (0,-len); radii r0 (top) r1 (bottom)
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

// ---------- palette ----------
export const SKIN = ['#5e3a22', '#7a4a2a', '#8a552f', '#a86a3c', '#c08350', '#d29e6e', '#e2b88e'];
export const HAIR = { black: '#2a201a', brown: '#4a3524', auburn: '#7a3a1e', blonde: '#c9a052', grey: '#9a948c', white: '#ece8e0' };
export const CLOTH = {
  brick: '#9b3d1f', sand: '#c9a36a', olive: '#6f7340', slate: '#4f6478', plum: '#7a4a62', cream: '#e7dcc4',
  rust: '#b5602e', teal: '#3f6e6a', ochre: '#c4922f', wine: '#7d2f34', brown: '#7a5232', indigo: '#3e4a78',
  rose: '#b8706a', moss: '#56693a', stone: '#8f8678', gold: '#c99a3a', denim: '#3d5778', charcoal: '#3a3a40',
};

// ---------- the person ----------
export class Person {
  constructor(o = {}) {
    this.o = o = Object.assign({
      seed: 1, height: 1.75, skin: SKIN[3], hair: 'short', hairColor: HAIR.black, beard: 'none', beardColor: HAIR.black,
      outfit: 'tunic', cloth: CLOTH.brick, belt: '#d7b484', sleeve: null, legs: null, shoes: '#3a2a1e',
      prop: null, kid: false, female: false, wrap: null, build: 1,
    }, o);
    this.seed = o.seed;
    this.root = new THREE.Group();            // world position (feet)
    this.bb = new THREE.Group();              // billboard rotation
    this.body = new THREE.Group();            // facing flip + scale
    this.root.add(this.bb); this.bb.add(this.body);
    this.bb.rotation.order = 'YXZ';
    this.lineMat = outlineMaterial(0.014);
    this.facing = 1;
    this.scale = o.height / 1.75;
    this.parts = [];
    this._build();
    // soft contact shadow (world aligned)
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: radialTex(), color: '#1a120a', transparent: true, opacity: 0.38, depthWrite: false, fog: true }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.scale.set(0.62 * this.scale * o.build, 0.3 * this.scale, 1);
    blob.renderOrder = -1;
    this.blob = blob; this.root.add(blob);
    this.P = basePose();
    this.pose(this.P);
  }

  _part(parent, pts, color, z, opts = {}) {
    const g = partGeo(pts);
    const fill = new THREE.Mesh(g, flat(color));
    fill.position.z = z;
    parent.add(fill);
    let line = null;
    if (opts.outline !== false) {
      line = new THREE.Mesh(g, this.lineMat);
      line.position.z = z - 0.004;
      line.castShadow = !!opts.shadow;
      parent.add(line);
    }
    this.parts.push(fill);
    return { fill, line };
  }

  _pivot(parent, x, y, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

  _build() {
    const o = this.o, k = o.kid;
    const b = o.build;
    const hipY = 0.86, shY = 1.37;
    const skin = o.skin;
    const legCol = o.legs || skin;
    // --- legs (thigh + shin + foot) ---
    const mkLeg = (x, z, shade) => {
      const hip = this._pivot(this.body, x, hipY, 0);
      this._part(hip, capsule(0.42, 0.07 * b, 0.062 * b), shadeHex(legCol, shade), z, { shadow: true });
      const knee = this._pivot(hip, 0, -0.42, 0);
      this._part(knee, capsule(0.36, 0.062 * b, 0.056 * b), shadeHex(legCol, shade), z + 0.001, { shadow: true });
      const foot = this._pivot(knee, 0, -0.36, 0);
      this._part(foot, [[-0.06, 0.035], [0.05, 0.04], [0.16, 0.0], [0.165, -0.045], [-0.07, -0.05]], shadeHex(o.shoes, shade), z + 0.002, { shadow: true });
      return { hip, knee, foot };
    };
    this.legB = mkLeg(-0.045, 0.012, 0.78);
    this.legF = mkLeg(0.035, 0.024, 1.0);

    // --- torso pivot at hip ---
    this.torso = this._pivot(this.body, 0, hipY, 0);
    const T = this.torso; const sy = shY - hipY;
    let hem = o.outfit === 'robe' ? 0.14 : o.outfit === 'tunic' ? 0.5 : 0.82;
    if (o.hem != null) hem = o.hem;
    const hy = hem - hipY;
    const flare = o.outfit === 'robe' ? 0.29 : o.outfit === 'tunic' ? 0.25 : 0.19;
    const robePts = [[-0.175 * b, sy + 0.01], [-0.11 * b, sy + 0.075], [0.1 * b, sy + 0.075], [0.165 * b, sy + 0.0],
      [0.17 * b, 0.05], [(flare - 0.03) * b, hy], [-(flare + 0.02) * b, hy], [-0.18 * b, 0.05]];
    this._part(T, robePts, o.cloth, 0.036, { shadow: true });
    if (o.outfit === 'modern' && o.jacketLine) {
      this._part(T, [[0.03, sy + 0.07], [0.06, sy + 0.07], [0.07, hy + 0.01], [0.04, hy + 0.01]], shadeHex(o.cloth, 0.75), 0.040, { outline: false });
    }
    if (o.belt) {
      const by = 0.9 - hipY;
      this._part(T, [[-0.175 * b, by - 0.028], [0.165 * b, by - 0.028], [0.168 * b, by + 0.028], [-0.172 * b, by + 0.028]], o.belt, 0.044, { outline: false });
    }
    if (o.sash) { // diagonal sash / stole for richer townspeople
      this._part(T, [[0.12 * b, sy + 0.06], [0.16 * b, sy - 0.02], [-0.12 * b, 0.0], [-0.17 * b, 0.07]], o.sash, 0.045, { outline: false });
    }
    // --- head ---
    const hs = k ? 1.3 : 1.1;
    this.neck = this._pivot(T, 0.005, sy + 0.04, 0);
    this.head = this._pivot(this.neck, 0, 0, 0);
    this.head.scale.setScalar(hs);
    const H = this.head;
    const headPts = smoothClosed([[-0.055, -0.05], [-0.13, 0.05], [-0.165, 0.17], [-0.12, 0.29], [-0.02, 0.335], [0.09, 0.305],
      [0.135, 0.235], [0.148, 0.19], [0.205, 0.142], [0.152, 0.118], [0.158, 0.085], [0.13, 0.042], [0.065, 0.012], [0.06, -0.05]], 56);
    this._part(H, headPts, skin, 0.052, { shadow: true });
    // eye
    this.eye = this._pivot(H, 0.088, 0.193, 0.06);
    this._part(this.eye, ellipse(0, 0, 0.034, 0.019, 16), '#f6ead6', 0, { outline: false });
    this.pupil = this._part(this.eye, ellipse(0.009, -0.001, 0.0125, 0.0135, 12), '#1c120c', 0.002, { outline: false }).fill;
    this._part(this.eye, ellipse(0, 0, 0.0365, 0.021, 16).map(([x, y]) => [x, y]), shadeHex(skin, 0.55), -0.001, { outline: false });
    // brow
    this.brow = this._pivot(H, 0.088, 0.238, 0.064);
    this._part(this.brow, rrect(-0.036, -0.008, 0.036, 0.008, 0.007), o.age === 'old' ? '#d8d2c8' : shadeHex(o.hairColor === HAIR.white ? '#8a8378' : o.hairColor, 0.8), 0, { outline: false });
    // mouths (only one visible at a time)
    this.mouth = this._pivot(H, 0.142, 0.073, 0.068);
    this.mSmile = this._part(this.mouth, [[-0.035, 0.012], [-0.012, -0.006], [0.012, -0.004], [0.014, 0.004], [-0.01, 0.002]], '#4a1e14', 0, { outline: false }).fill;
    this.mOpen = this._pivot(this.mouth, 0, 0, 0);
    this._part(this.mOpen, ellipse(-0.006, -0.012, 0.034, 0.03, 18, Math.PI, Math.PI * 2).concat([[0.028, -0.004], [-0.04, -0.004]]), '#3a120c', 0, { outline: false });
    this._part(this.mOpen, [[-0.03, -0.006], [0.022, -0.006], [0.018, -0.014], [-0.026, -0.014]], '#f2e6d8', 0.001, { outline: false });
    this.mTalk = this._pivot(this.mouth, 0, 0, 0);
    this._part(this.mTalk, ellipse(-0.006, -0.008, 0.02, 0.016, 14), '#3a120c', 0, { outline: false });
    // hair / headwear
    const hc = o.hairColor;
    const hairStyles = {
      short: [[0.122, 0.27], [0.06, 0.345], [-0.07, 0.345], [-0.172, 0.245], [-0.18, 0.11], [-0.125, 0.03], [-0.075, 0.075], [-0.06, 0.17], [0.0, 0.25], [0.1, 0.24]],
      long: [[0.122, 0.27], [0.06, 0.345], [-0.07, 0.35], [-0.18, 0.25], [-0.2, 0.05], [-0.215, -0.22], [-0.13, -0.27], [-0.08, -0.05], [-0.06, 0.17], [0.0, 0.25], [0.1, 0.24]],
      curly: [[0.13, 0.27], [0.1, 0.33], [0.03, 0.37], [-0.06, 0.37], [-0.15, 0.33], [-0.2, 0.24], [-0.2, 0.12], [-0.15, 0.04], [-0.08, 0.08], [-0.06, 0.17], [0.0, 0.26], [0.1, 0.25]],
      bald: [[-0.03, 0.222], [-0.1, 0.25], [-0.162, 0.2], [-0.175, 0.1], [-0.125, 0.025], [-0.092, 0.06], [-0.12, 0.12], [-0.105, 0.18], [-0.05, 0.198]],
      bun: [[0.122, 0.27], [0.06, 0.345], [-0.07, 0.345], [-0.172, 0.245], [-0.18, 0.11], [-0.125, 0.03], [-0.075, 0.075], [-0.06, 0.17], [0.0, 0.25], [0.1, 0.24]],
      wrap: [[0.14, 0.24], [0.13, 0.33], [0.04, 0.39], [-0.1, 0.38], [-0.19, 0.3], [-0.2, 0.17], [-0.15, 0.12], [-0.06, 0.2], [0.06, 0.25]],
      veil: [[0.13, 0.26], [0.1, 0.35], [-0.02, 0.385], [-0.15, 0.34], [-0.215, 0.2], [-0.24, -0.06], [-0.26, -0.33], [-0.1, -0.33], [-0.07, 0.0], [-0.04, 0.17], [0.04, 0.245]],
      cap: [[0.18, 0.25], [0.13, 0.32], [0.0, 0.36], [-0.12, 0.34], [-0.18, 0.25], [-0.17, 0.2], [-0.05, 0.23], [0.1, 0.235]],
    };
    if (o.hair !== 'none' && hairStyles[o.hair]) {
      const col = (o.hair === 'wrap' || o.hair === 'veil' || o.hair === 'cap') ? (o.wrap || CLOTH.cream) : hc;
      if (o.hair === 'veil' || o.hair === 'wrap') {
        // a little hair fringe peeks out under cloth
        this._part(H, smoothClosed([[0.12, 0.25], [0.04, 0.3], [-0.06, 0.29], [-0.06, 0.2], [0.02, 0.22]], 18), hc, 0.0625, { outline: false });
      }
      this.hairPart = this._part(H, smoothClosed(hairStyles[o.hair], 44), col, 0.064, { shadow: true });
      if (o.hair === 'bun') this._part(H, ellipse(-0.17, 0.3, 0.065, 0.06, 16), hc, 0.0635);
      if (o.hair === 'wrap') this._part(H, [[0.15, 0.255], [0.12, 0.29], [-0.18, 0.25], [-0.17, 0.215]], shadeHex(col, 0.75), 0.066, { outline: false });
    }
    // beard
    if (o.beard !== 'none') {
      const long = o.beard === 'long';
      const pts = long
        ? [[0.02, 0.19], [0.07, 0.13], [0.12, 0.11], [0.16, 0.1], [0.178, 0.05], [0.17, -0.06], [0.135, -0.2], [0.085, -0.33], [0.045, -0.24], [-0.015, -0.08], [-0.05, 0.07], [-0.04, 0.17]]
        : [[0.0, 0.2], [0.06, 0.125], [0.115, 0.105], [0.158, 0.098], [0.165, 0.04], [0.13, -0.035], [0.06, -0.05], [-0.03, 0.03], [-0.055, 0.14]];
      this.beardPart = this._part(H, smoothClosed(pts, 40), o.beardColor, 0.0655, { shadow: true });
      // moustache
      this.mustache = this._part(H, smoothClosed([[0.11, 0.11], [0.165, 0.117], [0.19, 0.098], [0.15, 0.09], [0.1, 0.095]], 16), o.beardColor, 0.067, { outline: false });
      this.mouth.position.z = 0.069; // mouth reads over beard
    }
    // --- arms ---
    const mkArm = (x, z, shade) => {
      const sh = this._pivot(T, x, sy - 0.02, 0);
      const sleeve = o.sleeve || (o.outfit === 'modern' ? o.cloth : null);
      this._part(sh, capsule(0.29, 0.062 * b, 0.056 * b), shadeHex(sleeve || skin, shade), z, { shadow: true });
      const el = this._pivot(sh, 0, -0.29, 0);
      this._part(el, capsule(0.26, 0.056 * b, 0.05 * b), shadeHex(o.cuff ? sleeve || skin : skin, shade), z + 0.001, { shadow: true });
      const hand = this._pivot(el, 0, -0.27, 0);
      this._part(hand, ellipse(0.005, -0.005, 0.055, 0.055, 14), shadeHex(skin, shade), z + 0.002);
      return { sh, el, hand };
    };
    this.armB = mkArm(-0.03, 0.0, 0.8);
    this.armF = mkArm(0.02, 0.078, 1.0);
    // --- props in the front hand ---
    this.prop = null;
    if (o.prop) this.setProp(o.prop);
    this.body.scale.set(this.scale, this.scale, this.scale);
  }

  setProp(kind) {
    if ((this.propKind || null) === (kind || null)) return this.prop;
    if (this.prop) { this.armF.hand.remove(this.prop); this.prop = null; }
    this.propKind = kind || null;
    if (!kind) return null;
    this.propCache = this.propCache || {};
    if (this.propCache[kind]) { this.prop = this.propCache[kind]; this.armF.hand.add(this.prop); return this.prop; }
    const g = new THREE.Group(); const z = 0.004;
    const P = (pts, c, zz = z, ol = true) => this._part(g, pts, c, zz, { outline: ol });
    if (kind === 'hammer') {
      P(rrect(-0.018, -0.05, 0.018, 0.30, 0.01), '#7a5232');
      P(rrect(-0.075, 0.25, 0.085, 0.33, 0.012), '#55524e', z + 0.002);
      g.rotation.z = -1.35;
    } else if (kind === 'cup') {
      P([[-0.04, 0.0], [0.045, 0.0], [0.055, 0.11], [-0.05, 0.11]], '#c99a3a');
      g.position.set(0.0, 0.02, 0);
    } else if (kind === 'staff') {
      P(rrect(-0.018, -0.95, 0.018, 0.75, 0.012), '#6a4528', -0.09);
    } else if (kind === 'phone') {
      P(rrect(-0.032, -0.06, 0.032, 0.06, 0.012), '#1d1f24');
      const scr = new THREE.Mesh(partGeo(rrect(-0.025, -0.05, 0.025, 0.05, 0.008)), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.8, 2.2), fog: false, side: THREE.DoubleSide }));
      scr.position.z = z + 0.003; g.add(scr); this.phoneScreen = scr;
      g.rotation.z = 0.5;
    } else if (kind === 'plank') {
      P(rrect(-0.9, -0.04, 0.9, 0.04, 0.01), '#9a6838');
      g.position.set(0, 0.0, 0);
    } else if (kind === 'brush') {
      P(rrect(-0.016, -0.05, 0.016, 0.28, 0.01), '#7a5232');
      P(rrect(-0.04, 0.26, 0.04, 0.36, 0.015), '#1b1410', z + 0.002);
      g.rotation.z = -1.2;
    } else if (kind === 'basket') {
      P([[-0.11, -0.02], [0.11, -0.02], [0.09, -0.16], [-0.09, -0.16]], '#a07a3e');
      P(ellipse(-0.04, -0.01, 0.04, 0.035, 10), '#b84a2a', z + 0.002, false);
      P(ellipse(0.04, -0.005, 0.04, 0.035, 10), '#d4a03a', z + 0.002, false);
    } else if (kind === 'bag') {
      P(rrect(-0.09, -0.24, 0.1, -0.02, 0.03), '#3a3a40');
      P([[-0.01, -0.02], [0.01, -0.02], [0.012, 0.06], [-0.012, 0.06]], '#2a2a2e', z + 0.001, false);
    }
    this.armF.hand.add(g);
    this.prop = g; this.propCache[kind] = g;
    return g;
  }

  setFacing(f) { this.facing = f >= 0 ? 1 : -1; this.body.scale.x = this.facing * this.scale; }

  place(x, y, z) { this.root.position.set(x, y, z); return this; }

  // Face the camera (cylindrical billboard + partial lean so high angles still read)
  billboard(camera, lean = 0.35) {
    const p = this.root.getWorldPosition(_v1);
    const c = camera.position;
    const dx = c.x - p.x, dz = c.z - p.z;
    this.bb.rotation.y = Math.atan2(dx, dz) - (this.root.parent ? worldYaw(this.root.parent) : 0);
    const pitch = Math.atan2(c.y - p.y - 1, Math.hypot(dx, dz));
    this.bb.rotation.x = -clamp(pitch, -0.4, 1.2) * lean;
  }

  // keep outlines ~1/130 of on-screen height, never thinner than ~1.7 px
  autoOutline(camera, viewH = 1920) {
    const p = this.root.getWorldPosition(_v1);
    const top = _v2.copy(p); top.y += this.o.height;
    const a = p.clone().project(camera), b2 = top.project(camera);
    const px = Math.abs(b2.y - a.y) * 0.5 * viewH;
    const outPx = clamp(px / 125, 1.7, 7.5);
    this.lineMat.userData.uOutline.value = px > 1 ? outPx / px * 1.75 : 0.02;
    return px;
  }

  pose(P) {
    this.P = P;
    const s = this;
    s.body.position.y = P.bob || 0;
    s.body.position.x = P.dx || 0;
    s.torso.rotation.z = -(P.lean || 0);
    s.neck.rotation.z = (P.headTilt || 0);
    s.armF.sh.rotation.z = P.aF[0]; s.armF.el.rotation.z = P.aF[1]; s.armF.hand.rotation.z = P.aF[2] || 0;
    s.armB.sh.rotation.z = P.aB[0]; s.armB.el.rotation.z = P.aB[1]; s.armB.hand.rotation.z = P.aB[2] || 0;
    s.legF.hip.rotation.z = P.lF[0]; s.legF.knee.rotation.z = P.lF[1]; s.legF.foot.rotation.z = P.lF[2] || 0;
    s.legB.hip.rotation.z = P.lB[0]; s.legB.knee.rotation.z = P.lB[1]; s.legB.foot.rotation.z = P.lB[2] || 0;
    s.eye.scale.y = clamp(P.eye ?? 1, 0.08, 1.2);
    s.pupil.position.x = 0.009 + (P.look || 0) * 0.012;
    s.pupil.position.y = -0.001 + (P.lookY || 0) * 0.008;
    s.brow.rotation.z = -(P.brow || 0);
    s.brow.position.y = 0.238 + (P.browY || 0) * 0.02;
    const m = P.mouth || 'none';
    s.mSmile.visible = m === 'smile';
    s.mOpen.visible = m === 'open'; s.mOpen.scale.set(1, 0.35 + 0.75 * (P.mo ?? 1), 1);
    s.mTalk.visible = m === 'talk'; s.mTalk.scale.set(1, 0.25 + 0.95 * (P.mo ?? 0.5), 1);
    if (s.prop && P.propRot != null) s.prop.rotation.z = P.propRot;
  }

  setBeardColor(hex) {
    if (this.beardPart) this.beardPart.fill.material = flat(hex);
    if (this.mustache) this.mustache.fill.material = flat(hex);
    if (this.hairPart && (this.o.hair === 'bald' || this.o.hair === 'short' || this.o.hair === 'long')) this.hairPart.fill.material = flat(hex);
  }
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
function worldYaw(obj) { const q = new THREE.Quaternion(); obj.getWorldQuaternion(q); const e = new THREE.Euler().setFromQuaternion(q, 'YXZ'); return e.y; }

export function shadeHex(hex, k) {
  if (k === 1) return hex;
  const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString();
}

// ---------- poses ----------
export function basePose() {
  return { bob: 0, lean: 0, headTilt: 0, aF: [0.06, 0.08], aB: [-0.05, 0.06], lF: [0.03, 0], lB: [-0.03, 0], eye: 1, brow: 0, browY: 0, mouth: 'none', mo: 0 };
}
const TAU = Math.PI * 2;

export function blink(t, seed) {
  const period = 3 + 2 * hash01(seed, 7);
  const ph = hash01(seed, 9) * period;
  const u = ((t + ph) % period);
  return u < 0.13 ? 1 - 0.92 * Math.sin(Math.PI * u / 0.13) : 1;
}

export const Poses = {
  idle(t, s = 1) {
    const P = basePose(); const ph = hash01(s, 1) * TAU;
    P.bob = 0.006 * Math.sin(TAU * t / 3.4 + ph);
    P.aF[0] = 0.06 + 0.025 * Math.sin(TAU * t / 3.4 + ph + 1);
    P.aB[0] = -0.05 + 0.025 * Math.sin(TAU * t / 3.4 + ph + 2);
    P.headTilt = 0.02 * Math.sin(TAU * t / 5.1 + ph);
    P.eye = blink(t, s);
    return P;
  },
  walk(t, s = 1, speed = 1, stride = 1) {
    const P = basePose(); const ph = hash01(s, 2) * TAU;
    const f = TAU * t * 1.7 * speed + ph;
    const sw = Math.sin(f);
    P.lF = [0.4 * sw * stride, -0.55 * Math.max(0, -Math.cos(f)) * stride - 0.05, 0.1 * sw];
    P.lB = [-0.4 * sw * stride, -0.55 * Math.max(0, Math.cos(f)) * stride - 0.05, -0.1 * sw];
    P.aF = [-0.32 * sw * stride, 0.2 + 0.15 * Math.max(0, -sw)];
    P.aB = [0.32 * sw * stride, 0.2 + 0.15 * Math.max(0, sw)];
    P.bob = 0.022 * Math.abs(Math.cos(f)) * stride - 0.01;
    P.lean = 0.04;
    P.eye = blink(t, s);
    return P;
  },
  hammer(t, s, period = 0.62, offset = 0) {
    const P = Poses.idle(t, s);
    const u = (((t - offset) / period) % 1 + 1) % 1;
    let sh, el;
    if (u < 0.68) { const k = smooth(u / 0.68); sh = lerp(0.95, 2.55, k); el = lerp(0.35, 1.75, k); }
    else if (u < 0.8) { const k = (u - 0.68) / 0.12; sh = lerp(2.55, 0.95, k * k); el = lerp(1.75, 0.35, k * k); }
    else { sh = 0.95; el = 0.35; }
    P.aF = [sh, el];
    P.propRot = -1.35 - 0.25 * (u > 0.68 && u < 0.85 ? 1 : 0);
    P.aB = [1.15, 0.55];
    P.lean = 0.08;
    P.brow = 0.25; P.browY = -0.2;
    P.mouth = 'none';
    return P;
  },
  laughPoint(t, s, intensity = 1) {
    const P = basePose(); const ph = hash01(s, 3) * 3;
    const b = Math.abs(Math.sin(TAU * (t + ph) * 2.6));
    P.bob = 0.022 * b * intensity;
    P.lean = -0.1 - 0.05 * b * intensity;
    P.headTilt = 0.16 + 0.07 * b * intensity;
    P.aF = [1.45 + 0.06 * Math.sin(TAU * t * 1.3 + ph), 0.12];
    P.aB = [0.55, 1.75];
    P.mouth = 'open'; P.mo = 0.45 + 0.55 * b;
    P.brow = -0.35; P.browY = 0.45;
    P.eye = 0.55 + 0.2 * (1 - b);
    return P;
  },
  laughCup(t, s, intensity = 1) {
    const P = basePose(); const ph = hash01(s, 4) * 3;
    const b = Math.abs(Math.sin(TAU * (t + ph) * 2.3));
    P.bob = 0.02 * b * intensity; P.lean = -0.06 - 0.05 * b;
    P.headTilt = 0.12 + 0.06 * b;
    P.aF = [0.75, 1.55]; P.aB = [0.35, 1.65];
    P.mouth = 'open'; P.mo = 0.4 + 0.6 * b; P.brow = -0.3; P.browY = 0.4; P.eye = 0.6;
    return P;
  },
  laughBend(t, s) { // doubled over, hand on knee
    const P = basePose(); const ph = hash01(s, 5) * 3;
    const b = Math.abs(Math.sin(TAU * (t + ph) * 2.8));
    P.bob = -0.04 + 0.015 * b; P.lean = 0.32 + 0.05 * b; P.headTilt = 0.35;
    P.aF = [0.45, 0.1]; P.aB = [0.25, 0.7];
    P.lF = [0.12, -0.18]; P.lB = [-0.08, -0.12];
    P.mouth = 'open'; P.mo = 0.5 + 0.5 * b; P.brow = -0.3; P.browY = 0.3; P.eye = 0.35;
    return P;
  },
  smirk(t, s) {
    const P = Poses.idle(t, s);
    P.aF = [0.25, 1.7]; P.aB = [-0.1, 0.9]; // arms crossed-ish
    P.mouth = 'smile'; P.brow = -0.15; P.browY = 0.25; P.headTilt = 0.06;
    return P;
  },
  preach(t, s, energy = 1) {
    const P = basePose(); const ph = hash01(s, 6) * TAU;
    const w = Math.sin(TAU * t * 0.7 + ph);
    P.aF = [2.05 + 0.18 * w * energy, 0.35 + 0.15 * Math.sin(TAU * t * 1.4)];
    P.aB = [-1.85 - 0.15 * w * energy, -0.3];
    P.lean = 0.05; P.headTilt = 0.1 + 0.04 * w;
    P.mouth = 'talk'; P.mo = clamp(0.25 + 0.75 * Math.abs(Math.sin(TAU * t * 3.1)) * (0.6 + 0.4 * Math.sin(TAU * t * 0.9)), 0, 1);
    P.brow = -0.25; P.browY = 0.35; P.eye = blink(t, s);
    P.bob = 0.008 * Math.sin(TAU * t * 1.4);
    return P;
  },
  wipeSweat(t, s, u) { // u: 0..1 progress through the gesture
    const P = Poses.idle(t, s);
    const up = smooth(invLerp(0.0, 0.25, u)) * (1 - smooth(invLerp(0.6, 0.85, u)));
    const drag = smooth(invLerp(0.25, 0.55, u));
    P.aF = [lerp(0.6, 2.35 - 0.25 * drag, up), lerp(0.4, 2.05, up)];
    P.aB = [0.15, 0.25];
    const look = smooth(invLerp(0.45, 0.8, u));
    P.headTilt = lerp(0.0, 0.42, look);
    P.lean = lerp(0.05, -0.08, look);
    P.brow = lerp(0.2, -0.25, look); P.browY = lerp(-0.1, 0.3, look);
    P.lookY = look; P.mouth = 'none';
    P.bob = 0.004 * Math.sin(TAU * t / 2.4);
    return P;
  },
  carryOverhead(t, s, step = 0) {
    const P = step ? Poses.walk(t, s, 0.7, 0.6) : Poses.idle(t, s);
    P.aF = [2.85, 0.15]; P.aB = [2.75, 0.25];
    P.lean = 0.02; P.brow = 0.25; P.browY = -0.1; P.mouth = 'none';
    return P;
  },
  liftBeam(t, s, u) { // u 0..1 lifting from waist to overhead
    const P = Poses.idle(t, s);
    const k = smooth(u);
    P.aF = [lerp(0.9, 2.8, k), lerp(1.3, 0.2, k)]; P.aB = [lerp(0.85, 2.7, k), lerp(1.3, 0.25, k)];
    P.lF = [lerp(0.35, 0.05, k), lerp(-0.6, -0.05, k)]; P.lB = [lerp(-0.25, -0.05, k), lerp(-0.5, -0.05, k)];
    P.bob = lerp(-0.07, 0, k); P.lean = lerp(0.18, 0.0, k);
    P.brow = 0.35; P.browY = -0.2; P.mouth = u > 0.2 && u < 0.8 ? 'talk' : 'none'; P.mo = 0.3;
    return P;
  },
  paint(t, s) { // brushing pitch
    const P = Poses.idle(t, s);
    const w = Math.sin(TAU * t * 0.9);
    P.aF = [1.25 + 0.35 * w, 0.4 + 0.2 * w]; P.aB = [0.7, 1.2]; P.lean = 0.12; P.brow = 0.2;
    P.propRot = -1.2;
    return P;
  },
  climb(t, s) { // on a ladder, hammering above
    const P = Poses.hammer(t, s);
    P.lF = [0.75, -1.05, 0.3]; P.lB = [0.12, -0.28, 0.1];
    P.lean = 0.12;
    return P;
  },
  phoneWalk(t, s, speed = 0.85) {
    const P = Poses.walk(t, s, speed, 0.8);
    P.aF = [0.55, 1.95, 0.0];
    P.headTilt = -0.32; P.lookY = -1; P.lean = 0.06;
    P.eye = 0.8 * blink(t, s);
    return P;
  },
  lookUp(t, s, k = 1) {
    const P = Poses.idle(t, s);
    P.headTilt = 0.38 * k; P.lookY = k; P.lean = -0.05 * k; P.brow = -0.2 * k; P.browY = 0.3 * k;
    return P;
  },
  wonder(t, s, k = 1) { // stopped, struck by the light
    const P = Poses.idle(t, s);
    P.headTilt = 0.1 * k; P.brow = -0.3 * k; P.browY = 0.45 * k; P.eye = lerp(1, 1.15, k);
    P.aF = [lerp(0.55, 0.35, k), lerp(1.95, 1.2, k)]; // phone lowers
    P.mouth = k > 0.5 ? 'talk' : 'none'; P.mo = 0.15;
    return P;
  },
  dismiss(t, s) { // waving a hand: "go away"
    const P = Poses.walk(t, s, 0.8, 0.9);
    P.aF = [1.0 + 0.35 * Math.sin(TAU * t * 2.2), 1.4];
    P.headTilt = 0.08; P.brow = 0.3; P.browY = 0.1; P.mouth = 'smile';
    return P;
  },
  sit(t, s) {
    const P = Poses.idle(t, s);
    P.lF = [1.45, -1.5, 0.1]; P.lB = [1.35, -1.4, 0.1]; P.bob = -0.36; P.lean = -0.02;
    P.aF = [0.5, 0.9]; P.aB = [0.3, 0.8];
    return P;
  },
  hold(t, s) { // calm, hands folded, gentle smile
    const P = Poses.idle(t, s);
    P.aF = [0.45, 1.1]; P.aB = [0.35, 1.2]; P.mouth = 'smile'; P.brow = -0.1; P.browY = 0.15;
    return P;
  },
};
