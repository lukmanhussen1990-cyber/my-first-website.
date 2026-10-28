// Shared helpers: SVG creation, easing, deterministic noise, 2D matrices.
const NS = 'http://www.w3.org/2000/svg';

const PAL = {
  indigo: '#1E2A4A', amber: '#E8A85C', cream: '#F3E6C8', sand: '#C9A876',
  emerald: '#2F6B4F', maroon: '#7A2E2E', gold: '#D4AF37', ink: '#3B2414',
  teal: '#7FD8C9', wood: '#9C6B3A', woodDark: '#5A3A22', dot: '#FFF7E6',
};

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

// Outlined flat shape in the folk-art style.
function shape(parent, d, fill, extra) {
  return el('path', Object.assign({ d, fill, class: 'o' }, extra || {}), parent);
}

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeInOut = t => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
const easeIn = t => Math.pow(clamp(t), 3);
const easeOutBack = (t, s = 1.4) => { t = clamp(t) - 1; return 1 + t * t * ((s + 1) * t + s); };
// Lowered-on-a-string landing: fast fall, small damped bounce.
const dropEase = t => {
  if (t <= 0) return 0;
  if (t >= 1.6) return 1;
  if (t < 0.55) { const u = t / 0.55; return u * u; }
  const u = t - 0.55;
  return 1 - 0.06 * Math.exp(-5 * u) * Math.sin(u * 14);
};
const mixColor = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const A = ch(pa), B = ch(pb);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join('');
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1D value noise in [-1, 1].
function noise1(x, seed = 0) {
  const h = n => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}

class M2 {
  constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) { Object.assign(this, { a, b, c, d, e, f }); }
  mul(m) {
    return new M2(
      this.a * m.a + this.c * m.b, this.b * m.a + this.d * m.b,
      this.a * m.c + this.c * m.d, this.b * m.c + this.d * m.d,
      this.a * m.e + this.c * m.f + this.e, this.b * m.e + this.d * m.f + this.f);
  }
  static T(x, y) { return new M2(1, 0, 0, 1, x, y); }
  static R(deg) { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return new M2(c, s, -s, c, 0, 0); }
  static S(x, y) { return new M2(x, 0, 0, y === undefined ? x : y, 0, 0); }
  ap(x, y) { return [this.a * x + this.c * y + this.e, this.b * x + this.d * y + this.f]; }
  str() { return `matrix(${this.a.toFixed(5)},${this.b.toFixed(5)},${this.c.toFixed(5)},${this.d.toFixed(5)},${this.e.toFixed(2)},${this.f.toFixed(2)})`; }
}

// Many small dots as one path (cheap to render).
function dotPath(points, r) {
  let d = '';
  for (const [x, y] of points) d += `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  return d;
}

let _measure;
function samplePath(d, spacing, inset = 0) {
  if (!_measure) {
    const s = el('svg', { width: 0, height: 0, style: 'position:absolute;visibility:hidden' });
    document.body.appendChild(s);
    _measure = el('path', {}, s);
  }
  _measure.setAttribute('d', d);
  const L = _measure.getTotalLength();
  const n = Math.max(1, Math.floor((L - 2 * inset) / spacing));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const p = _measure.getPointAtLength(inset + (L - 2 * inset) * i / n);
    pts.push([p.x, p.y]);
  }
  return pts;
}

function dotsOn(parent, d, spacing, r, fill = PAL.dot, inset = 0) {
  return el('path', { d: dotPath(samplePath(d, spacing, inset), r), fill }, parent);
}

// Polyline through points as a path string.
const poly = (pts, close) => 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + (close ? 'Z' : '');

// 8-point star (Rub el Hizb style) path centred at 0,0.
function star8(r, ri) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2, rr = i % 2 ? ri : r;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return poly(pts, true);
}

function setT(node, str) { node.setAttribute('transform', str); }
function show(node, on) { node.style.display = on ? '' : 'none'; }
