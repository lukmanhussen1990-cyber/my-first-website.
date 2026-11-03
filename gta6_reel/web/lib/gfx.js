// Canvas-drawn textures and smooth icons.
import * as THREE from 'three';

export const FONT = '"Montserrat"';
export const COMIC = '"Bangers"';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
export function toTex(c, rep = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep[0], rep[1]);
  return t;
}
export function css(c) { return '#' + new THREE.Color(c).getHexString(); }

// text with an outline, centred
export function strokeText(g, text, x, y, size, { fill = '#fff', stroke = '#000', lw = 0.18, font = FONT, weight = 900, align = 'center', base = 'middle' } = {}) {
  g.save();
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = base;
  g.lineJoin = 'round';
  if (lw > 0) { g.lineWidth = size * lw; g.strokeStyle = stroke; g.strokeText(text, x, y); }
  g.fillStyle = fill;
  g.fillText(text, x, y);
  g.restore();
}

// a texture with some lines of text on a coloured background
export function textTexture(lines, { w = 512, h = 256, bg = '#ffffff', fg = '#111', size = 64, font = FONT, weight = 900, border = null, stroke = null, lw = 0 } = {}) {
  const [c, g] = makeCanvas(w, h);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  if (border) { g.strokeStyle = border; g.lineWidth = Math.max(4, w / 64); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth); }
  const L = Array.isArray(lines) ? lines : [lines];
  L.forEach((ln, i) => {
    const o = typeof ln === 'string' ? { t: ln } : ln;
    const sz = o.size || size;
    const y = h / 2 + (i - (L.length - 1) / 2) * sz * 1.15 + (o.dy || 0);
    strokeText(g, o.t, w / 2, y, sz, { fill: o.fg || fg, stroke: o.stroke || stroke || '#000', lw: o.lw ?? lw, font: o.font || font, weight: o.weight || weight });
  });
  return toTex(c);
}

// ---------------------------------------------------------------- icons
export const ICONS = {};
export function buildIcons() {
  // heart
  {
    const [c, g] = makeCanvas(128, 128);
    g.translate(64, 70);
    g.beginPath();
    g.moveTo(0, 38);
    g.bezierCurveTo(-60, 0, -48, -52, 0, -22);
    g.bezierCurveTo(48, -52, 60, 0, 0, 38);
    g.fillStyle = '#ff5fa8'; g.fill();
    g.lineWidth = 7; g.strokeStyle = '#7a1043'; g.stroke();
    g.beginPath(); g.ellipse(-22, -20, 9, 6, -0.6, 0, 7); g.fillStyle = '#ffd3e8'; g.fill();
    ICONS.heart = c;
  }
  // sweat / tear drop
  {
    const [c, g] = makeCanvas(96, 128);
    g.translate(48, 70);
    g.beginPath();
    g.moveTo(0, -60);
    g.bezierCurveTo(10, -30, 34, -6, 34, 18);
    g.arc(0, 18, 34, 0, Math.PI);
    g.bezierCurveTo(-34, -6, -10, -30, 0, -60);
    g.fillStyle = '#5ec2ff'; g.fill();
    g.lineWidth = 6; g.strokeStyle = '#0f4b7a'; g.stroke();
    g.beginPath(); g.ellipse(-12, 14, 6, 11, 0.3, 0, 7); g.fillStyle = '#dff4ff'; g.fill();
    ICONS.drop = c;
  }
  // sparkle
  {
    const [c, g] = makeCanvas(128, 128);
    g.translate(64, 64);
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const r = k % 2 ? 14 : 58, a = k * Math.PI / 4 - Math.PI / 2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = '#fff7b0'; g.fill();
    g.lineWidth = 5; g.strokeStyle = '#e0a800'; g.stroke();
    ICONS.sparkle = c;
  }
  // stink lines (animated frames)
  ICONS.stink = [];
  for (let f = 0; f < 8; f++) {
    const [c, g] = makeCanvas(64, 192);
    const path = () => {
      g.beginPath();
      for (let y = 180; y >= 10; y -= 4) {
        const x = 32 + 16 * Math.sin((y / 192) * Math.PI * 2.4 + f * Math.PI / 4);
        if (y === 180) g.moveTo(x, y); else g.lineTo(x, y);
      }
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    path(); g.lineWidth = 17; g.strokeStyle = '#1e5a12'; g.stroke();
    path(); g.lineWidth = 9; g.strokeStyle = '#8fe34a'; g.stroke();
    ICONS.stink.push(c);
  }
  // splash droplet (coffee)
  {
    const [c, g] = makeCanvas(64, 64);
    g.beginPath(); g.arc(32, 32, 24, 0, 7); g.fillStyle = '#7a4a22'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#3b210c'; g.stroke();
    g.beginPath(); g.arc(24, 24, 7, 0, 7); g.fillStyle = '#c08a58'; g.fill();
    ICONS.coffee = c;
  }
  // Z for sleeping
  {
    const [c, g] = makeCanvas(96, 96);
    strokeText(g, 'Z', 48, 50, 80, { fill: '#9fd8ff', stroke: '#123a5a', lw: 0.2, font: COMIC, weight: 400 });
    ICONS.z = c;
  }
  ICONS.tex = {};
  for (const k of ['heart', 'drop', 'sparkle', 'coffee', 'z']) ICONS.tex[k] = toTex(ICONS[k]);
  ICONS.tex.stink = ICONS.stink.map(c => toTex(c));
}
