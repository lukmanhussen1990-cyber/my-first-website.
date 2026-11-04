// Hand-drawn ink faces painted onto canvas textures. A FaceRig keeps a
// static base layer (skin, stubble, blush, border) and redraws the dynamic
// features (eyes, brows, mouth) only when the expression changes.
import * as THREE from 'three';
import { mk, ink, ellipsePts, scribble, paperCanvas } from './tex.js';
import { rng } from './util.js';

const INK = '#1b1511';
const MOUTH_IN = '#4a1b1e';
const TONGUE = '#d77068';
const GUM = '#e88f97';

function baseSkin(g, W, H, color, seed) {
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
  const p = paperCanvas(256, seed, { fibers: 500, blotch: 30 });
  g.save();
  g.globalCompositeOperation = 'multiply';
  for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) g.drawImage(p, x, y);
  g.restore();
}
function blush(g, x, y, r, a = 0.28) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(236,128,118,${a})`);
  gr.addColorStop(1, 'rgba(236,128,118,0)');
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function stubble(g, W, H, n, seed, region, exclude, col = [50, 38, 32]) {
  const R = rng(seed);
  let placed = 0, tries = 0;
  while (placed < n && tries < n * 20) {
    tries++;
    const u = R(), v = R();
    if (!region(u, v, R)) continue;
    if (exclude && exclude(u, v)) continue;
    const x = u * W, y = v * H, l = 3 + R() * 6, a = Math.PI / 2 + (R() - 0.5) * 1.6;
    g.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.45 + R() * 0.45})`;
    g.lineWidth = 1.8 + R() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
    placed++;
  }
}
function border(g, W, H, w = 5) {
  g.strokeStyle = 'rgba(27,21,17,0.85)';
  g.lineWidth = w;
  g.strokeRect(w / 2, w / 2, W - w, H - w);
}

// ---- reusable feature painters -------------------------------------------
function dotEye(g, x, y, r, look = [0, 0], hi = true) {
  const px = x + look[0] * r * 0.9, py = y + look[1] * r * 0.7;
  g.fillStyle = INK;
  g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
  if (hi) {
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(px + r * 0.32, py - r * 0.35, r * 0.3, 0, Math.PI * 2); g.fill();
  }
}
function wideEye(g, x, y, r, look, seed, pupil = 0.33) {
  g.fillStyle = '#fffdf8';
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  ink(g, ellipsePts(x, y, r, r, 22), r * 0.12, seed, { close: true });
  dotEye(g, x + look[0] * r * 0.35, y + look[1] * r * 0.35, r * pupil, [0, 0]);
}
function arcEye(g, x, y, r, up, seed, w) {
  // up=true -> "^" happy arch, false -> "u" closed/sleepy
  const pts = up ? ellipsePts(x, y + r * 0.35, r, r * 0.75, 12, Math.PI, Math.PI * 2) : ellipsePts(x, y - r * 0.3, r, r * 0.6, 12, 0, Math.PI);
  ink(g, pts, w, seed);
}
function lidEye(g, x, y, rx, ry, look, lid, skin, seed, w, { lashes = 0, side = 1, bag = 0 } = {}) {
  // almond eye with heavy upper lid covering `lid` (0..1) of the eye
  g.save();
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#fffdf8'; g.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  dotEye(g, x + look[0] * rx * 0.45, y + ry * 0.15 + look[1] * ry * 0.3, ry * 0.62, [0, 0], false);
  const ly = y - ry + lid * ry * 2;
  g.fillStyle = skin; g.fillRect(x - rx - 2, y - ry - 2, rx * 2 + 4, ly - (y - ry) + 2);
  g.restore();
  ink(g, ellipsePts(x, y, rx, ry, 20, 0.15, Math.PI - 0.15), w * 0.7, seed + 1);
  ink(g, [[x - rx * 1.08, ly + ry * 0.2], [x, ly - ry * 0.08], [x + rx * 1.08, ly + ry * 0.2]], w * 1.25, seed + 2);
  for (let i = 0; i < lashes; i++) {
    const a = 0.25 + i * 0.28, bx = x + side * rx * (0.55 + i * 0.22), by = ly + ry * 0.1 * i;
    ink(g, [[bx, by], [bx + side * rx * 0.25 * Math.cos(a), by - ry * 0.55]], w * 0.6, seed + 5 + i);
  }
  for (let i = 0; i < bag; i++) ink(g, ellipsePts(x, y + ry * (0.95 + i * 0.55), rx * (0.8 - i * 0.12), ry * 0.5, 10, 0.4, Math.PI - 0.4), w * 0.45, seed + 9 + i, { color: 'rgba(60,40,40,0.55)' });
}
function coinEye(g, x, y, r) {
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
  gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.6, '#f2c043'); gr.addColorStop(1, '#b8811c');
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#8a5a10'; g.lineWidth = r * 0.12;
  g.beginPath(); g.arc(x, y, r * 0.94, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(x, y, r * 0.62, 0, Math.PI * 2); g.lineWidth = r * 0.06; g.stroke();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.18, 0, Math.PI * 2); g.fill();
}
function brow(g, x, y, len, dyIn, dyOut, arch, side, w, seed) {
  // side = -1 for the brow on the image's left (inner end at +x)
  const xi = x - side * len * 0.45, xo = x + side * len * 0.55;
  ink(g, [[xo, y + dyOut], [x + side * len * 0.1, y + arch], [xi, y + dyIn]], w, seed);
}
function mouthPath(g, cx, cy, w, top, bot) {
  g.beginPath();
  g.moveTo(cx - w / 2, cy);
  g.quadraticCurveTo(cx, cy + top, cx + w / 2, cy);
  g.quadraticCurveTo(cx, cy + bot, cx - w / 2, cy);
  g.closePath();
}
function openMouth(g, cx, cy, w, top, bot, lw, seed, { teeth = 'gap', lower = false, tongue = true, gums = false } = {}) {
  g.save();
  mouthPath(g, cx, cy, w, top, bot);
  g.fillStyle = MOUTH_IN; g.fill();
  g.clip();
  const h = bot - top;
  if (tongue) {
    g.fillStyle = TONGUE;
    g.beginPath(); g.ellipse(cx, cy + bot * 0.62, w * 0.3, Math.max(4, h * 0.28), 0, 0, Math.PI * 2); g.fill();
  }
  const ty = cy + top * 0.55;
  if (gums || teeth === 'none') {
    g.fillStyle = GUM;
    g.fillRect(cx - w / 2, ty - 40, w, Math.max(10, h * 0.2) + 40);
    if (lower) g.fillRect(cx - w / 2, cy + bot * 0.5 + Math.min(14, h * 0.2), w, 60);
  } else {
    const th = Math.max(8, Math.min(h * 0.32, w * 0.16));
    g.fillStyle = '#fbf8f0';
    g.fillRect(cx - w / 2, ty - 40, w, th + 40);
    const n = 6, tw = w / n;
    for (let i = 0; i < n; i++) {
      const x = cx - w / 2 + i * tw;
      const missing = (teeth === 'gap' && i === 2) || (teeth === 'few' && (i === 1 || i === 2 || i === 4));
      if (missing) {
        g.fillStyle = MOUTH_IN; g.fillRect(x + 1, ty - 2, tw - 2, th + 4);
        g.fillStyle = GUM; g.fillRect(x, ty - 40, tw, 40 + th * 0.22);
      }
      g.strokeStyle = 'rgba(120,100,90,0.6)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, ty - 4); g.lineTo(x, ty + th); g.stroke();
    }
    if (lower) {
      g.fillStyle = '#fbf8f0';
      g.fillRect(cx - w * 0.35, cy + bot * 0.5 - th * 0.2, w * 0.7, 60);
    }
  }
  g.restore();
  mouthPath(g, cx, cy, w, top, bot);
  g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
}

// ---- rig --------------------------------------------------------------------
export class FaceRig {
  constructor(kind, W, H, opts = {}) {
    this.kind = kind; this.W = W; this.H = H; this.opts = opts;
    this.canvas = mk(W, H);
    this.g = this.canvas.getContext('2d');
    this.base = mk(W, H);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    this.key = '';
    this.paintBase();
    this.set({});
  }
  set(s) {
    const st = { ...DEFAULTS[this.kind], ...s };
    if (st.open !== undefined) st.open = Math.round(st.open * 20) / 20;
    const key = JSON.stringify(st);
    if (key === this.key) return;
    this.key = key;
    this.g.drawImage(this.base, 0, 0);
    PAINT[this.kind](this.g, this.W, this.H, st, this.opts);
    this.tex.needsUpdate = true;
  }
  paintBase() {
    const g = this.base.getContext('2d'), W = this.W, H = this.H;
    BASE[this.kind](g, W, H, this.opts);
  }
}

const DEFAULTS = {
  man: { eyes: 'open', look: [0, 0], brows: 'neutral', mouth: 'smile', open: 0, teeth: 'gap', blush: 0, sweat: 0 },
  officer: { eyes: 'bored', look: [0, 0], brows: 'flat', mouth: 'flat', open: 0, lid: 0.55 },
  fairy: { eyes: 'tired', look: [0, 0], brows: 'grumpy', mouth: 'grumpy', open: 0, lid: 0.5 },
  kid: { eyes: 'sleep', mouth: 'o' },
};

export const MAN_SKIN = '#f1cdab';
export const OFF_SKIN = '#e6c09d';
export const FAIRY_SKIN = '#f7d8c5';

const BASE = {
  man(g, W, H) {
    baseSkin(g, W, H, MAN_SKIN, 61);
    blush(g, W * 0.12, H * 0.65, W * 0.15, 0.3);
    blush(g, W * 0.88, H * 0.65, W * 0.15, 0.3);
    stubble(g, W, H, 1300, 62,
      (u, v, R) => v > 0.62 && (v > 0.84 || Math.abs(u - 0.5) > 0.34 * (1 - (v - 0.62) * 2.2) || (v > 0.665 && v < 0.715 && Math.abs(u - 0.5) < 0.2)) && R() < 0.5 + (v - 0.6),
      (u, v) => ((u - 0.5) / 0.19) ** 2 + ((v - 0.762) / 0.06) ** 2 < 1);
    // wrinkle lines on forehead (light)
    ink(g, [[W * 0.36, H * 0.12], [W * 0.5, H * 0.105], [W * 0.64, H * 0.12]], 3, 63, { color: 'rgba(120,80,60,0.35)' });
    border(g, W, H, 6);
  },
  officer(g, W, H) {
    baseSkin(g, W, H, OFF_SKIN, 71);
    blush(g, W * 0.15, H * 0.6, W * 0.13, 0.16);
    blush(g, W * 0.85, H * 0.6, W * 0.13, 0.16);
    stubble(g, W, H, 900, 72, (u, v) => v > 0.73 && (v > 0.86 || Math.abs(u - 0.5) > 0.3), (u, v) => ((u - 0.5) / 0.16) ** 2 + ((v - 0.79) / 0.05) ** 2 < 1);
    scribble(g, 0, 0, W * 0.09, H * 0.36, 60, 73, 'rgba(40,30,26,0.95)', 4, 10);
    scribble(g, W * 0.91, 0, W, H * 0.36, 60, 74, 'rgba(40,30,26,0.95)', 4, 10);
    border(g, W, H, 6);
  },
  fairy(g, W, H) {
    baseSkin(g, W, H, FAIRY_SKIN, 81);
    blush(g, W * 0.17, H * 0.68, W * 0.13, 0.32);
    blush(g, W * 0.83, H * 0.68, W * 0.13, 0.32);
    // tired under-eye shadows
    for (const x of [0.3, 0.7]) {
      const gr = g.createRadialGradient(W * x, H * 0.59, 0, W * x, H * 0.59, W * 0.12);
      gr.addColorStop(0, 'rgba(120,85,140,0.32)'); gr.addColorStop(1, 'rgba(120,85,140,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    // jagged auburn bangs
    const R = rng(82);
    g.fillStyle = '#8c3b2c';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, H * 0.3);
    for (let x = W; x >= 0; x -= W / 9) g.lineTo(x, H * (0.17 + R() * 0.1)), g.lineTo(x - W / 18, H * (0.24 + R() * 0.1));
    g.lineTo(0, H * 0.3); g.closePath(); g.fill();
    scribble(g, 0, 0, W, H * 0.2, 40, 83, 'rgba(70,24,18,0.7)', 4, 14);
    border(g, W, H, 7);
  },
  kid(g, W, H, o) {
    baseSkin(g, W, H, o.skin || '#f5d3bb', o.seed || 91);
    blush(g, W * 0.2, H * 0.66, W * 0.14, 0.38);
    blush(g, W * 0.8, H * 0.66, W * 0.14, 0.38);
    g.fillStyle = o.hair || '#6b4a2b';
    const R = rng(o.seed || 92);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, H * 0.25);
    for (let x = W; x >= 0; x -= W / 7) g.lineTo(x, H * (0.18 + R() * 0.1)), g.lineTo(x - W / 14, H * (0.27 + R() * 0.06));
    g.closePath(); g.fill();
    border(g, W, H, 7);
  },
};

const PAINT = {
  man(g, W, H, s) {
    const lw = W * 0.0075;
    const ey = H * 0.43, ex = [W * 0.272, W * 0.728], r = W * 0.031;
    if (s.blush) { blush(g, W * 0.15, H * 0.62, W * 0.16, 0.3 * s.blush); blush(g, W * 0.85, H * 0.62, W * 0.16, 0.3 * s.blush); }
    ex.forEach((x, i) => {
      const sd = 100 + i * 10;
      switch (s.eyes) {
        case 'wide': wideEye(g, x, ey, r * 2.2, s.look, sd); break;
        case 'happy': arcEye(g, x, ey, r * 1.5, true, sd, lw * 1.1); break;
        case 'closed': arcEye(g, x, ey, r * 1.4, false, sd, lw * 1.1); break;
        case 'squeeze': ink(g, i ? [[x + r * 1.5, ey - r * 1.2], [x - r * 1.3, ey], [x + r * 1.5, ey + r * 1.2]] : [[x - r * 1.5, ey - r * 1.2], [x + r * 1.3, ey], [x - r * 1.5, ey + r * 1.2]], lw * 1.2, sd); break;
        case 'coin': coinEye(g, x, ey, r * 2.3); break;
        case 'squint': {
          dotEye(g, x, ey + r * 0.2, r, s.look);
          g.fillStyle = MAN_SKIN; g.fillRect(x - r * 2, ey - r * 2.5, r * 4, r * 2.35);
          ink(g, [[x - r * 1.8, ey - r * 0.1 + (i ? -r * 0.3 : r * 0.3)], [x + r * 1.8, ey - r * 0.1 + (i ? r * 0.3 : -r * 0.3)]], lw * 1.2, sd);
          break;
        }
        case 'sad': {
          dotEye(g, x, ey + r * 0.3, r, s.look);
          g.fillStyle = MAN_SKIN; g.fillRect(x - r * 2, ey - r * 2.6, r * 4, r * 2.3);
          ink(g, [[x - r * 1.7, ey - r * 0.2 + (i ? r * 0.6 : -r * 0.3)], [x + r * 1.7, ey - r * 0.2 + (i ? -r * 0.3 : r * 0.6)]], lw * 1.1, sd);
          break;
        }
        default: dotEye(g, x, ey, r, s.look);
      }
    });
    // brows: [dyIn, dyOut, arch]
    const B = {
      neutral: [0, 0.004, -0.012], raised: [-0.045, -0.035, -0.06], worried: [-0.035, 0.012, -0.02], sad: [-0.045, 0.02, -0.02],
      angry: [0.03, -0.022, -0.004], think: null, gasp: [-0.06, -0.04, -0.075],
    }[s.brows];
    const by = H * 0.215;
    ex.forEach((x, i) => {
      const side = i ? 1 : -1;
      let b = B;
      if (!b) b = i ? [-0.05, -0.035, -0.06] : [0.025, -0.01, -0.01];
      brow(g, x, by, W * 0.2, b[0] * H, b[1] * H, b[2] * H, side, lw * 1.3, 120 + i);
    });
    // mouth
    const cx = W * 0.5, cy = H * 0.755, mw = W * 0.3;
    switch (s.mouth) {
      case 'smile':
        ink(g, [[cx - mw * 0.42, cy - H * 0.012], [cx - mw * 0.2, cy + H * 0.02], [cx, cy + H * 0.028], [cx + mw * 0.2, cy + H * 0.02], [cx + mw * 0.42, cy - H * 0.012]], lw * 1.2, 130);
        break;
      case 'grin':
        openMouth(g, cx, cy - H * 0.012, mw * 1.05, H * 0.012, H * 0.14 + s.open * H * 0.03, lw * 1.2, 131, { teeth: s.teeth });
        break;
      case 'gums':
        openMouth(g, cx, cy - H * 0.02, mw * 1.4, H * 0.016, H * 0.2, lw * 1.25, 132, { teeth: 'none', gums: true, lower: true });
        break;
      case 'gasp':
        g.fillStyle = MOUTH_IN;
        ink(g, ellipsePts(cx, cy + H * 0.01, mw * 0.2, H * 0.06 + s.open * H * 0.02, 20), lw * 1.2, 133, { close: true, fill: MOUTH_IN });
        break;
      case 'flat':
        ink(g, [[cx - mw * 0.32, cy + H * 0.004], [cx, cy], [cx + mw * 0.32, cy + H * 0.006]], lw * 1.2, 134);
        break;
      case 'frown':
        ink(g, [[cx - mw * 0.36, cy + H * 0.028], [cx - mw * 0.15, cy + H * 0.002], [cx, cy - H * 0.004], [cx + mw * 0.15, cy + H * 0.002], [cx + mw * 0.36, cy + H * 0.028]], lw * 1.2, 135);
        break;
      case 'talk': {
        const o = s.open;
        if (o < 0.08) ink(g, [[cx - mw * 0.3, cy], [cx, cy + H * 0.006], [cx + mw * 0.3, cy]], lw * 1.2, 136);
        else openMouth(g, cx, cy - H * 0.005, mw * (0.62 + o * 0.25), -H * 0.012 * o, H * (0.03 + o * 0.11), lw * 1.15, 136, { teeth: s.teeth });
        break;
      }
      case 'gumsTalk': {
        const o = s.open;
        if (o < 0.08) ink(g, [[cx - mw * 0.3, cy + H * 0.012], [cx, cy], [cx + mw * 0.3, cy + H * 0.012]], lw * 1.2, 137);
        else openMouth(g, cx, cy - H * 0.01, mw * (0.75 + o * 0.3), -H * 0.014 * o, H * (0.04 + o * 0.12), lw * 1.15, 137, { teeth: 'none', gums: true, lower: true });
        break;
      }
      case 'wide':
        openMouth(g, cx, cy - H * 0.03, mw * 1.15, -H * 0.03, H * 0.19, lw * 1.2, 138, { teeth: s.teeth, lower: true });
        break;
      case 'pursed':
        ink(g, ellipsePts(cx + W * 0.06, cy, W * 0.03, H * 0.022, 14), lw * 1.1, 139, { close: true, fill: MOUTH_IN });
        break;
      case 'sadGums':
        openMouth(g, cx, cy, mw * 0.7, H * 0.028, H * 0.07, lw * 1.2, 140, { teeth: 'none', gums: true, tongue: true });
        break;
    }
    if (s.sweat) {
      const x = W * 0.86, y = H * 0.24;
      g.fillStyle = 'rgba(170,215,245,0.95)';
      g.beginPath(); g.moveTo(x, y - H * 0.05); g.quadraticCurveTo(x + W * 0.04, y + H * 0.01, x, y + H * 0.02); g.quadraticCurveTo(x - W * 0.04, y + H * 0.01, x, y - H * 0.05); g.fill();
      g.strokeStyle = INK; g.lineWidth = lw * 0.7; g.stroke();
    }
  },

  officer(g, W, H, s) {
    const lw = W * 0.009;
    const ey = H * 0.4, ex = [W * 0.29, W * 0.71];
    ex.forEach((x, i) => {
      const sd = 200 + i * 10;
      if (s.eyes === 'wide') wideEye(g, x, ey, W * 0.085, s.look, sd, 0.2);
      else if (s.eyes === 'closed') ink(g, [[x - W * 0.07, ey], [x, ey + H * 0.008], [x + W * 0.07, ey]], lw * 1.2, sd);
      else lidEye(g, x, ey, W * 0.072, H * 0.03, s.look, s.lid, OFF_SKIN, sd, lw, { bag: 2 });
    });
    const by = H * 0.31;
    const B = { flat: [0.008, 0.004, 0.0], raised: [-0.045, -0.03, -0.05], skeptic: null, annoyed: [0.022, -0.01, 0.004] }[s.brows];
    ex.forEach((x, i) => {
      const side = i ? 1 : -1;
      let b = B || (i ? [-0.04, -0.03, -0.045] : [0.016, 0.004, 0.004]);
      brow(g, x, by, W * 0.24, b[0] * H, b[1] * H, b[2] * H, side, lw * 2.0, 220 + i);
    });
    const cx = W * 0.5, cy = H * 0.785, mw = W * 0.28;
    switch (s.mouth) {
      case 'flat':
        ink(g, [[cx - mw * 0.38, cy + H * 0.004], [cx, cy - H * 0.002], [cx + mw * 0.38, cy + H * 0.006]], lw * 1.3, 230);
        break;
      case 'frown':
        ink(g, [[cx - mw * 0.4, cy + H * 0.02], [cx, cy - H * 0.006], [cx + mw * 0.4, cy + H * 0.02]], lw * 1.3, 231);
        break;
      case 'o':
        ink(g, ellipsePts(cx, cy + H * 0.01, mw * 0.18, H * 0.035, 16), lw * 1.2, 232, { close: true, fill: MOUTH_IN });
        break;
      case 'talk': {
        const o = s.open;
        if (o < 0.08) ink(g, [[cx - mw * 0.36, cy], [cx, cy + H * 0.003], [cx + mw * 0.36, cy]], lw * 1.3, 233);
        else openMouth(g, cx, cy - H * 0.004, mw * (0.7 + o * 0.25), -H * 0.008 * o, H * (0.025 + o * 0.075), lw * 1.2, 233, { teeth: 'full' });
        break;
      }
    }
  },

  fairy(g, W, H, s) {
    const lw = W * 0.011;
    const ey = H * 0.5, ex = [W * 0.3, W * 0.7];
    ex.forEach((x, i) => {
      const sd = 300 + i * 10, side = i ? 1 : -1;
      if (s.eyes === 'wide') wideEye(g, x, ey, W * 0.09, s.look, sd, 0.3);
      else if (s.eyes === 'closed') {
        ink(g, [[x - W * 0.08, ey - H * 0.01], [x, ey + H * 0.02], [x + W * 0.08, ey - H * 0.01]], lw * 1.2, sd);
        ink(g, [[x + side * W * 0.075, ey - H * 0.005], [x + side * W * 0.11, ey - H * 0.03]], lw * 0.8, sd + 3);
      } else lidEye(g, x, ey, W * 0.085, H * 0.05, s.look, s.lid, FAIRY_SKIN, sd, lw, { lashes: 3, side, bag: 1 });
    });
    const by = H * 0.355;
    const B = { grumpy: [0.04, -0.02, 0.008], sad: [-0.045, 0.02, -0.01], shock: [-0.06, -0.05, -0.07], flat: [0.012, 0.006, 0] }[s.brows];
    ex.forEach((x, i) => brow(g, x, by, W * 0.2, B[0] * H, B[1] * H, B[2] * H, i ? 1 : -1, lw * 1.25, 320 + i));
    const cx = W * 0.5, cy = H * 0.79, mw = W * 0.2;
    switch (s.mouth) {
      case 'grumpy':
        ink(g, [[cx - mw * 0.45, cy + H * 0.025], [cx - mw * 0.15, cy - H * 0.004], [cx + mw * 0.15, cy - H * 0.004], [cx + mw * 0.45, cy + H * 0.025]], lw * 1.1, 330);
        break;
      case 'sad':
        ink(g, [[cx - mw * 0.45, cy + H * 0.03], [cx - mw * 0.2, cy + H * 0.002], [cx, cy + H * 0.008], [cx + mw * 0.2, cy - H * 0.002], [cx + mw * 0.45, cy + H * 0.03]], lw * 1.1, 331);
        break;
      case 'yawn':
        ink(g, ellipsePts(cx, cy, mw * 0.32, H * (0.03 + 0.05 * s.open), 18), lw * 1.1, 332, { close: true, fill: MOUTH_IN });
        break;
      case 'shock':
        ink(g, ellipsePts(cx, cy, mw * 0.3, H * 0.065, 18), lw * 1.1, 333, { close: true, fill: MOUTH_IN });
        break;
      case 'flat':
        ink(g, [[cx - mw * 0.4, cy + H * 0.006], [cx + mw * 0.4, cy + H * 0.004]], lw * 1.1, 334);
        break;
    }
  },

  kid(g, W, H, s) {
    const lw = W * 0.012;
    for (const [i, x] of [[0, W * 0.32], [1, W * 0.68]]) arcEye(g, x, H * 0.5, W * 0.07, false, 400 + i, lw);
    ink(g, ellipsePts(W * 0.5, H * 0.74, W * 0.035, H * 0.03, 14), lw, 410, { close: true, fill: MOUTH_IN });
  },
};
