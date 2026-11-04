// Procedural canvas textures for the papercraft look. Everything is drawn
// from seeded randomness so renders are repeatable.
import * as THREE from 'three';
import { rng } from './util.js';

export const mk = (w, h = w) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
let ANISO = 4;
export const setAniso = (a) => (ANISO = a);

export function tex(c, { srgb = true, repeat = true, flipY = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = ANISO;
  t.flipY = flipY;
  return t;
}

const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
export const hex2 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Draw at wrapped offsets so features crossing an edge tile seamlessly.
function wrapDraw(w, h, x, y, r, fn) {
  for (const dx of [-w, 0, w])
    for (const dy of [-h, 0, h]) {
      const X = x + dx, Y = y + dy;
      if (X + r < 0 || X - r > w || Y + r < 0 || Y - r > h) continue;
      fn(X, Y);
    }
}

function speckle(g, w, h, amt, R) {
  const id = g.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (R() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(id, 0, 0);
}

// Near-white paper fibre texture; tinted by material colour.
export function paperCanvas(size = 512, seed = 7, { base = 246, fibers = 1200, blotch = 70, edge = 0, spk = 9 } = {}) {
  const c = mk(size), g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < blotch; i++) {
    const x = R() * size, y = R() * size, r = 14 + R() * 80, a = 0.02 + R() * 0.045, v = R() < 0.5 ? 255 : 186;
    wrapDraw(size, size, x, y, r, (X, Y) => {
      const gr = g.createRadialGradient(X, Y, 0, X, Y, r);
      gr.addColorStop(0, `rgba(${v},${v},${v},${a})`);
      gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr;
      g.fillRect(X - r, Y - r, 2 * r, 2 * r);
    });
  }
  for (let i = 0; i < fibers; i++) {
    const x = R() * size, y = R() * size, l = 4 + R() * 16, a = R() * Math.PI * 2;
    const v = R() < 0.55 ? 255 : 165, al = 0.04 + R() * 0.09, lw = 0.5 + R() * 0.9, cx = (R() - 0.5) * 6, cy = (R() - 0.5) * 6;
    wrapDraw(size, size, x, y, l, (X, Y) => {
      g.strokeStyle = `rgba(${v},${v},${v},${al})`;
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(X, Y);
      g.quadraticCurveTo(X + (Math.cos(a) * l) / 2 + cx, Y + (Math.sin(a) * l) / 2 + cy, X + Math.cos(a) * l, Y + Math.sin(a) * l);
      g.stroke();
    });
  }
  speckle(g, size, size, spk, R);
  if (edge) {
    const e = size * 0.07;
    for (const [x0, y0, x1, y1] of [[0, 0, e, 0], [size, 0, size - e, 0], [0, 0, 0, e], [0, size, 0, size - e]]) {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, `rgba(80,60,50,${edge})`);
      gr.addColorStop(1, 'rgba(80,60,50,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, size, size);
    }
  }
  return c;
}

function multiplyPaper(g, w, h, seed = 3, alpha = 1) {
  const p = paperCanvas(256, seed, { fibers: 500, blotch: 30 });
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = alpha;
  for (let y = 0; y < h; y += 256) for (let x = 0; x < w; x += 256) g.drawImage(p, x, y);
  g.restore();
}

export function gingham(size = 512, n = 8, c1 = [240, 190, 60], c2 = [255, 251, 238]) {
  const c = mk(size), g = c.getContext('2d'), s = size / n;
  g.fillStyle = rgb(c2);
  g.fillRect(0, 0, size, size);
  g.fillStyle = rgb(c1, 0.5);
  for (let i = 0; i < n; i += 2) {
    g.fillRect(i * s, 0, s, size);
    g.fillRect(0, i * s, size, s);
  }
  // woven thread hint
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 1;
  for (let i = 0; i < size; i += 4) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, size); g.stroke();
  }
  multiplyPaper(g, size, size, 21);
  return c;
}

export function woodPlanks(w = 1024, h = 1024, seed = 11, base = [222, 178, 128], planks = 6) {
  const c = mk(w, h), g = c.getContext('2d'), R = rng(seed), ph = h / planks;
  for (let p = 0; p < planks; p++) {
    const k = 0.9 + R() * 0.16;
    g.fillStyle = rgb(base.map((v) => v * k));
    g.fillRect(0, p * ph, w, ph);
    for (let i = 0; i < 26; i++) {
      const y = p * ph + R() * ph, a = 0.05 + R() * 0.08;
      g.strokeStyle = `rgba(120,80,45,${a})`;
      g.lineWidth = 1 + R() * 2;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 3 * R());
      g.stroke();
    }
    // joints (staggered)
    const off = R() * w;
    g.fillStyle = 'rgba(95,60,35,0.55)';
    for (const jx of [off % w, (off + w / 2) % w]) g.fillRect(jx, p * ph, 3, ph);
    g.fillStyle = 'rgba(95,60,35,0.6)';
    g.fillRect(0, p * ph, w, 3);
    g.fillStyle = 'rgba(255,240,215,0.25)';
    g.fillRect(0, p * ph + 3, w, 2);
  }
  multiplyPaper(g, w, h, 5, 0.8);
  return c;
}

export function wallpaper(size = 512, base = [243, 206, 186], motif = [255, 228, 212], seed = 4) {
  const c = mk(size), g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = rgb(base);
  g.fillRect(0, 0, size, size);
  const n = 4, s = size / n;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = i * s + (j % 2 ? s / 2 : 0) + s / 4, y = j * s + s / 2;
      wrapDraw(size, size, x, y, 20, (X, Y) => {
        g.fillStyle = rgb(motif, 0.9);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          g.beginPath();
          g.ellipse(X + Math.cos(a) * 7, Y + Math.sin(a) * 7, 6, 4, a, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = rgb(base.map((v) => v * 0.93));
        g.beginPath(); g.arc(X, Y, 3, 0, Math.PI * 2); g.fill();
      });
    }
  multiplyPaper(g, size, size, 9);
  speckle(g, size, size, 4, R);
  return c;
}

export function starWallpaper(size = 512, base = [204, 196, 232], star = [255, 236, 170], seed = 8) {
  const c = mk(size), g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = rgb(base);
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    const x = R() * size, y = R() * size, r = 7 + R() * 9, rot = R() * 6;
    wrapDraw(size, size, x, y, r, (X, Y) => starPath(g, X, Y, r, r * 0.45, 5, rot, rgb(star, 0.85)));
  }
  multiplyPaper(g, size, size, 13);
  return c;
}

export function starPath(g, x, y, r1, r2, n, rot, fill) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = rot + (i / (n * 2)) * Math.PI * 2;
    i ? g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

export function panels(size = 512, base = [184, 214, 196], seed = 6) {
  // vertical boards for the lower wall (wainscot)
  const c = mk(size), g = c.getContext('2d');
  g.fillStyle = rgb(base);
  g.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += size / 4) {
    g.fillStyle = 'rgba(70,100,85,0.35)';
    g.fillRect(x, 0, 3, size);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(x + 3, 0, 2, size);
  }
  multiplyPaper(g, size, size, seed);
  return c;
}

export function dots(size = 512, base = [169, 196, 224], dot = [250, 250, 255], n = 10, r = 5, seed = 2) {
  const c = mk(size), g = c.getContext('2d');
  g.fillStyle = rgb(base);
  g.fillRect(0, 0, size, size);
  const s = size / n;
  g.fillStyle = rgb(dot, 0.9);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.arc(i * s + (j % 2 ? s / 2 : 0) + s / 4, j * s + s / 2, r, 0, Math.PI * 2);
      g.fill();
    }
  multiplyPaper(g, size, size, seed);
  return c;
}

export function stripes(size = 512, base = [246, 226, 160], line = [233, 205, 130], n = 8, vertical = true) {
  const c = mk(size), g = c.getContext('2d');
  g.fillStyle = rgb(base);
  g.fillRect(0, 0, size, size);
  g.fillStyle = rgb(line);
  const s = size / n;
  for (let i = 0; i < n; i++) vertical ? g.fillRect(i * s, 0, s * 0.3, size) : g.fillRect(0, i * s, size, s * 0.3);
  multiplyPaper(g, size, size, 17);
  return c;
}

export function bricks(size = 512, base = [150, 148, 152], seed = 12) {
  const c = mk(size), g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = 'rgb(105,102,108)';
  g.fillRect(0, 0, size, size);
  const rows = 8, bh = size / rows, bw = size / 4;
  for (let r = 0; r < rows; r++)
    for (let i = -1; i < 5; i++) {
      const x = i * bw + (r % 2 ? bw / 2 : 0), k = 0.82 + R() * 0.3;
      g.fillStyle = rgb(base.map((v) => v * k));
      g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(x + 3, r * bh + 3, bw - 6, 3);
    }
  multiplyPaper(g, size, size, 19);
  speckle(g, size, size, 18, R);
  return c;
}

export function rugCanvas(w = 1024, h = 768, base = [216, 150, 150], border = [246, 220, 196]) {
  const c = mk(w, h), g = c.getContext('2d');
  g.fillStyle = rgb(base);
  g.fillRect(0, 0, w, h);
  g.strokeStyle = rgb(border);
  g.lineWidth = 22;
  g.strokeRect(50, 50, w - 100, h - 100);
  g.lineWidth = 6;
  g.strokeRect(95, 95, w - 190, h - 190);
  g.fillStyle = rgb(border, 0.85);
  for (let i = 0; i < 5; i++) {
    const x = w / 2 + (i - 2) * 120;
    g.save(); g.translate(x, h / 2); g.rotate(Math.PI / 4); g.fillRect(-26, -26, 52, 52); g.restore();
  }
  // fringe
  g.fillStyle = rgb(border);
  for (let x = 10; x < w; x += 18) { g.fillRect(x, 0, 6, 22); g.fillRect(x, h - 22, 6, 22); }
  multiplyPaper(g, w, h, 23);
  return c;
}

export function sky(kind, w = 1024, h = 1024) {
  const c = mk(w, h), g = c.getContext('2d'), R = rng(kind.length * 7);
  const gr = g.createLinearGradient(0, 0, 0, h);
  if (kind === 'night') {
    gr.addColorStop(0, '#1a2350'); gr.addColorStop(0.6, '#33407a'); gr.addColorStop(1, '#5a5f95');
  } else if (kind === 'dusk') {
    gr.addColorStop(0, '#2c3470'); gr.addColorStop(0.55, '#7d6aa8'); gr.addColorStop(1, '#f3a98c');
  } else {
    gr.addColorStop(0, '#9fd0f0'); gr.addColorStop(0.55, '#d9ecf3'); gr.addColorStop(1, '#fff1cf');
  }
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  if (kind !== 'day') {
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255,250,230,${0.4 + R() * 0.6})`;
      const r = R() * 2 + 0.6;
      g.beginPath(); g.arc(R() * w, R() * h * 0.7, r, 0, Math.PI * 2); g.fill();
    }
    // moon with glow
    const mx = w * 0.62, my = h * 0.28;
    const glow = g.createRadialGradient(mx, my, 10, mx, my, 220);
    glow.addColorStop(0, 'rgba(255,250,220,0.55)');
    glow.addColorStop(1, 'rgba(255,250,220,0)');
    g.fillStyle = glow; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff6d8';
    g.beginPath(); g.arc(mx, my, 70, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(220,210,180,0.6)';
    for (const [dx, dy, r] of [[-20, -15, 14], [18, 10, 10], [-5, 25, 8]]) { g.beginPath(); g.arc(mx + dx, my + dy, r, 0, Math.PI * 2); g.fill(); }
  } else {
    const sx = w * 0.3, sy = h * 0.62;
    const glow = g.createRadialGradient(sx, sy, 20, sx, sy, 420);
    glow.addColorStop(0, 'rgba(255,248,220,1)');
    glow.addColorStop(0.3, 'rgba(255,236,190,0.7)');
    glow.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = glow; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [x, y, s] of [[0.7, 0.25, 1], [0.2, 0.18, 0.7]]) {
      for (const [dx, dy, r] of [[0, 0, 50], [45, 10, 40], [-45, 12, 36], [20, -25, 38]]) {
        g.beginPath(); g.arc(x * w + dx * s, y * h + dy * s, r * s, 0, Math.PI * 2); g.fill();
      }
    }
  }
  // papercraft rooftops & trees silhouettes
  const layer = (yb, col, seed) => {
    const r = rng(seed);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, h);
    let x = 0;
    while (x < w) {
      const bw = 90 + r() * 140, bh = 80 + r() * 160, roof = r() < 0.6;
      g.lineTo(x, yb - bh);
      if (roof) g.lineTo(x + bw / 2, yb - bh - 60);
      g.lineTo(x + bw, yb - bh);
      x += bw;
    }
    g.lineTo(w, h);
    g.fill();
  };
  if (kind === 'day') {
    layer(h * 0.98, 'rgba(178,205,190,1)', 3);
    layer(h * 1.04, 'rgba(150,186,168,1)', 5);
  } else {
    layer(h * 0.98, 'rgba(38,44,88,1)', 3);
    layer(h * 1.04, 'rgba(28,32,66,1)', 5);
    // a few lit windows
    g.fillStyle = 'rgba(255,214,140,0.9)';
    for (let i = 0; i < 6; i++) g.fillRect(R() * w, h * (0.86 + R() * 0.08), 14, 18);
  }
  multiplyPaper(g, w, h, 29, 0.5);
  return c;
}

export function coinFace(size = 256) {
  const c = mk(size), g = c.getContext('2d');
  const cx = size / 2;
  const gr = g.createRadialGradient(cx * 0.8, cx * 0.7, 10, cx, cx, cx);
  gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.6, '#f2c24e'); gr.addColorStop(1, '#c58f22');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  g.strokeStyle = '#a8761a'; g.lineWidth = 10;
  g.beginPath(); g.arc(cx, cx, cx - 16, 0, Math.PI * 2); g.stroke();
  // tooth emblem
  g.fillStyle = '#d9a43a'; g.strokeStyle = '#9c6b14'; g.lineWidth = 5;
  g.beginPath();
  g.moveTo(cx - 42, cx - 30);
  g.quadraticCurveTo(cx - 44, cx - 58, cx - 18, cx - 52);
  g.quadraticCurveTo(cx, cx - 44, cx + 18, cx - 52);
  g.quadraticCurveTo(cx + 44, cx - 58, cx + 42, cx - 30);
  g.quadraticCurveTo(cx + 38, cx + 10, cx + 26, cx + 46);
  g.quadraticCurveTo(cx + 14, cx + 54, cx + 8, cx + 20);
  g.quadraticCurveTo(cx, cx + 6, cx - 8, cx + 20);
  g.quadraticCurveTo(cx - 14, cx + 54, cx - 26, cx + 46);
  g.quadraticCurveTo(cx - 38, cx + 10, cx - 42, cx - 30);
  g.fill(); g.stroke();
  // rim ticks
  g.strokeStyle = 'rgba(150,100,20,0.6)'; g.lineWidth = 3;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * (cx - 6), cx + Math.sin(a) * (cx - 6)); g.lineTo(cx + Math.cos(a) * (cx - 1), cx + Math.sin(a) * (cx - 1)); g.stroke();
  }
  return c;
}

// Ink line helpers (hand-drawn wobble, deterministic per seed)
export function ink(g, pts, w, seed, { close = false, color = '#1b1511', fill = null } = {}) {
  const R = rng(seed);
  const p = pts.map(([x, y]) => [x + (R() - 0.5) * w * 0.5, y + (R() - 0.5) * w * 0.5]);
  g.beginPath();
  g.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
    g.quadraticCurveTo(p[i][0], p[i][1], mx, my);
  }
  g.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
  if (close) g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (w > 0) {
    g.lineWidth = w; g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
  }
}

export function ellipsePts(cx, cy, rx, ry, n = 24, a0 = 0, a1 = Math.PI * 2) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

// Messy scribble hair patch drawn with looping ink strokes.
export function scribble(g, x0, y0, x1, y1, n, seed, color = 'rgba(48,34,26,0.9)', lw = 3, loop = 7) {
  const R = rng(seed);
  g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0), s = loop * (0.6 + R() * 0.8);
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) g.bezierCurveTo(x + (R() - 0.5) * s * 2, y - s, x + s, y + (R() - 0.5) * s * 2, x + (R() - 0.5) * s, y + (R() - 0.5) * s);
    g.stroke();
  }
}

export function notepadSketch(w = 512, h = 680) {
  const c = mk(w, h), g = c.getContext('2d');
  g.fillStyle = '#fbf8ef'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120,160,210,0.45)'; g.lineWidth = 2;
  for (let y = 90; y < h; y += 38) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.strokeStyle = 'rgba(230,120,120,0.5)';
  g.beginPath(); g.moveTo(60, 0); g.lineTo(60, h); g.stroke();
  // sketch of the fairy (ballpoint blue-black)
  const C = '#1d2340';
  const cx = w / 2 + 10, cy = h / 2 + 30;
  // wings
  for (const s of [-1, 1]) {
    ink(g, ellipsePts(cx + s * 95, cy - 70, 80, 55, 20).map(([x, y]) => [x, y]), 4, 3 + s, { color: C, close: true });
    ink(g, ellipsePts(cx + s * 75, cy + 20, 55, 38, 18), 4, 5 + s, { color: C, close: true });
  }
  // head
  ink(g, [[cx - 48, cy - 150], [cx + 48, cy - 150], [cx + 48, cy - 60], [cx - 48, cy - 60], [cx - 48, cy - 150]], 4.5, 9, { color: C, fill: '#fbf8ef' });
  ink(g, ellipsePts(cx, cy - 168, 22, 18, 14), 4, 10, { color: C, close: true });
  // grumpy face
  ink(g, [[cx - 26, cy - 112], [cx - 10, cy - 108]], 4, 11, { color: C });
  ink(g, [[cx + 10, cy - 108], [cx + 26, cy - 112]], 4, 12, { color: C });
  g.fillStyle = C;
  g.beginPath(); g.arc(cx - 18, cy - 100, 4, 0, 7); g.fill();
  g.beginPath(); g.arc(cx + 18, cy - 100, 4, 0, 7); g.fill();
  ink(g, [[cx - 14, cy - 74], [cx, cy - 80], [cx + 14, cy - 74]], 4, 13, { color: C });
  // body + tutu
  ink(g, [[cx - 30, cy - 58], [cx + 30, cy - 58], [cx + 30, cy + 10], [cx - 30, cy + 10], [cx - 30, cy - 58]], 4.5, 14, { color: C, fill: '#fbf8ef' });
  ink(g, [[cx - 30, cy + 5], [cx - 80, cy + 45], [cx - 50, cy + 38], [cx - 25, cy + 50], [cx, cy + 40], [cx + 25, cy + 50], [cx + 50, cy + 38], [cx + 80, cy + 45], [cx + 30, cy + 5]], 4.5, 15, { color: C });
  // legs
  ink(g, [[cx - 14, cy + 45], [cx - 16, cy + 120]], 4.5, 16, { color: C });
  ink(g, [[cx + 14, cy + 45], [cx + 16, cy + 120]], 4.5, 17, { color: C });
  // arm + wand with star
  ink(g, [[cx + 30, cy - 45], [cx + 85, cy - 95]], 4.5, 18, { color: C });
  ink(g, [[cx + 85, cy - 95], [cx + 110, cy - 150]], 4, 19, { color: C });
  const sp = [];
  for (let i = 0; i <= 10; i++) { const r = i % 2 ? 9 : 22, a = -Math.PI / 2 + (i / 10) * Math.PI * 2; sp.push([cx + 114 + Math.cos(a) * r, cy - 166 + Math.sin(a) * r]); }
  ink(g, sp, 4, 20, { color: C });
  // coin bag
  ink(g, [[cx - 30, cy - 45], [cx - 78, cy - 10]], 4.5, 21, { color: C });
  ink(g, ellipsePts(cx - 88, cy + 10, 22, 26, 14), 4, 22, { color: C, close: true });
  ink(g, [[cx - 96, cy + 4], [cx - 88, cy + 14], [cx - 80, cy + 4]], 3.5, 23, { color: C });
  // motion sparkles
  for (const [x, y] of [[cx - 150, cy - 160], [cx + 160, cy + 40], [cx - 140, cy + 110]]) {
    ink(g, [[x - 12, y], [x + 12, y]], 3.5, x | 0, { color: C });
    ink(g, [[x, y - 12], [x, y + 12]], 3.5, (y | 0) + 1, { color: C });
  }
  multiplyPaper(g, w, h, 41, 0.6);
  return c;
}

export function wingCanvas(size = 512, tint = [255, 214, 236]) {
  const c = mk(size), g = c.getContext('2d');
  const gr = g.createRadialGradient(size * 0.2, size * 0.8, 10, size * 0.4, size * 0.5, size * 0.75);
  gr.addColorStop(0, rgb(tint, 0.95));
  gr.addColorStop(1, 'rgba(235,245,255,0.75)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(150,110,160,0.55)';
  g.lineWidth = 4;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(size * 0.05, size * 0.95);
    g.quadraticCurveTo(size * (0.25 + i * 0.12), size * (0.55 - i * 0.05), size * (0.45 + i * 0.12), size * (0.08 + i * 0.12));
    g.stroke();
  }
  // glitter
  const R = rng(5);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(255,255,255,${0.4 + R() * 0.6})`;
    g.fillRect(R() * size, R() * size, 2 + R() * 3, 2 + R() * 3);
  }
  return c;
}

export function glitter(size = 256, base = [244, 150, 196], seed = 31) {
  const c = mk(size), g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = rgb(base); g.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const v = R();
    g.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.95)' : v < 0.8 ? 'rgba(255,225,140,0.95)' : 'rgba(255,190,225,1)';
    const s = 1.5 + R() * 3;
    g.fillRect(R() * size, R() * size, s, s);
  }
  multiplyPaper(g, size, size, 33, 0.6);
  return c;
}

export function netCanvas(size = 512, cells = 10) {
  const c = mk(size), g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  g.strokeStyle = 'rgba(214,180,130,1)';
  g.lineWidth = 9;
  const s = size / cells;
  for (let i = 0; i <= cells; i++) {
    g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, size); g.stroke();
    g.beginPath(); g.moveTo(0, i * s); g.lineTo(size, i * s); g.stroke();
  }
  g.fillStyle = 'rgba(176,138,90,1)';
  for (let i = 0; i <= cells; i++) for (let j = 0; j <= cells; j++) { g.beginPath(); g.arc(i * s, j * s, 8, 0, 7); g.fill(); }
  return c;
}

export function glowSprite(size = 128, soft = 1) {
  const c = mk(size), g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25 * soft, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return c;
}

export function sparkleSprite(size = 256) {
  const c = mk(size), g = c.getContext('2d'), h = size / 2;
  const gr = g.createRadialGradient(h, h, 0, h, h, h * 0.5);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  g.fillStyle = 'rgba(255,255,255,1)';
  for (const rot of [0, Math.PI / 2]) {
    g.save(); g.translate(h, h); g.rotate(rot);
    g.beginPath(); g.moveTo(-h, 0); g.quadraticCurveTo(0, -size * 0.035, h, 0); g.quadraticCurveTo(0, size * 0.035, -h, 0); g.fill();
    g.restore();
  }
  return c;
}

export function clockFace(size = 256) {
  const c = mk(size), g = c.getContext('2d'), h = size / 2;
  g.fillStyle = '#fffaf0'; g.fillRect(0, 0, size, size);
  g.strokeStyle = '#2a2420';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.lineWidth = i % 3 ? 5 : 10;
    const r0 = i % 3 ? h * 0.74 : h * 0.66;
    g.beginPath(); g.moveTo(h + Math.cos(a) * r0, h + Math.sin(a) * r0); g.lineTo(h + Math.cos(a) * h * 0.86, h + Math.sin(a) * h * 0.86); g.stroke();
  }
  multiplyPaper(g, size, size, 43, 0.5);
  return c;
}

export function picture(kind, w = 512, h = 640) {
  const c = mk(w, h), g = c.getContext('2d');
  if (kind === 'boat') {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#bfe0ef'); gr.addColorStop(0.6, '#f6e2c8'); gr.addColorStop(0.61, '#7fb5c9'); gr.addColorStop(1, '#5d97b0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f9f3e6';
    g.beginPath(); g.moveTo(w * 0.5, h * 0.2); g.lineTo(w * 0.5, h * 0.55); g.lineTo(w * 0.75, h * 0.55); g.fill();
    g.fillStyle = '#e98f7d';
    g.beginPath(); g.moveTo(w * 0.3, h * 0.58); g.lineTo(w * 0.8, h * 0.58); g.lineTo(w * 0.7, h * 0.66); g.lineTo(w * 0.38, h * 0.66); g.fill();
    g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(w * 0.22, h * 0.25, 40, 0, 7); g.fill();
  } else if (kind === 'hills') {
    g.fillStyle = '#f7e3c7'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9cc9a6'; g.beginPath(); g.ellipse(w * 0.3, h * 0.95, w * 0.6, h * 0.35, 0, 0, 7); g.fill();
    g.fillStyle = '#7fb293'; g.beginPath(); g.ellipse(w * 0.85, h, w * 0.55, h * 0.3, 0, 0, 7); g.fill();
    g.fillStyle = '#f2a97c'; g.beginPath(); g.arc(w * 0.7, h * 0.3, 55, 0, 7); g.fill();
  } else if (kind === 'tooth') {
    const gr = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, h * 0.7);
    gr.addColorStop(0, '#7a2b3a'); gr.addColorStop(1, '#3f1420');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    g.fillStyle = '#fbf6ea'; g.strokeStyle = '#2b1d14'; g.lineWidth = 8;
    g.beginPath();
    g.moveTo(cx - 120, cy - 80);
    g.quadraticCurveTo(cx - 125, cy - 170, cx - 50, cy - 150);
    g.quadraticCurveTo(cx, cy - 125, cx + 50, cy - 150);
    g.quadraticCurveTo(cx + 125, cy - 170, cx + 120, cy - 80);
    g.quadraticCurveTo(cx + 110, cy + 40, cx + 75, cy + 150);
    g.quadraticCurveTo(cx + 40, cy + 170, cx + 25, cy + 60);
    g.quadraticCurveTo(cx, cy + 20, cx - 25, cy + 60);
    g.quadraticCurveTo(cx - 40, cy + 170, cx - 75, cy + 150);
    g.quadraticCurveTo(cx - 110, cy + 40, cx - 120, cy - 80);
    g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.ellipse(cx - 60, cy - 100, 16, 30, -0.5, 0, 7); g.fill();
  }
  multiplyPaper(g, w, h, 47, 0.7);
  return c;
}

export function chapatiCanvas(size = 512, seed = 51) {
  const c = mk(size), g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = '#e9c48c'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    const x = R() * size, y = R() * size, r = 6 + R() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${120 + R() * 30},${70 + R() * 20},30,${0.5 + R() * 0.4})`);
    gr.addColorStop(1, 'rgba(150,90,40,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  multiplyPaper(g, size, size, 53, 0.7);
  return c;
}

export function grainy(size = 256, base = [250, 248, 240], spot = [220, 210, 190], n = 400, seed = 55) {
  const c = mk(size), g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = rgb(base); g.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    g.fillStyle = rgb(spot, 0.6 + R() * 0.4);
    g.save(); g.translate(R() * size, R() * size); g.rotate(R() * 3); g.fillRect(-6, -2, 12, 4); g.restore();
  }
  return c;
}

export function idCard(w = 256, h = 340) {
  const c = mk(w, h), g = c.getContext('2d');
  g.fillStyle = '#fbfbf7'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#7fb6e6'; g.fillRect(0, 0, w, 60);
  g.fillStyle = '#e7d4f0'; g.fillRect(40, 85, 110, 130);
  g.fillStyle = '#8b3a2e'; g.fillRect(55, 95, 80, 40);
  g.fillStyle = '#f6d6c2'; g.fillRect(65, 120, 60, 60);
  g.fillStyle = '#1b1511'; g.fillRect(78, 145, 8, 5); g.fillRect(104, 145, 8, 5); g.fillRect(85, 165, 22, 4);
  g.fillStyle = 'rgba(40,40,60,0.55)';
  for (let i = 0; i < 4; i++) g.fillRect(40, 240 + i * 22, 120 + ((i * 37) % 60), 9);
  return c;
}

export function sprinkleDonut(size = 256) {
  const c = mk(size), g = c.getContext('2d'), R = rng(61);
  g.fillStyle = '#f4a6c6'; g.fillRect(0, 0, size, size);
  const cols = ['#ffffff', '#ffd75e', '#7cc4f2', '#9be3a1', '#ff8a7a'];
  for (let i = 0; i < 160; i++) {
    g.fillStyle = cols[i % cols.length];
    g.save(); g.translate(R() * size, R() * size); g.rotate(R() * 3); g.fillRect(-7, -2, 14, 4); g.restore();
  }
  return c;
}
