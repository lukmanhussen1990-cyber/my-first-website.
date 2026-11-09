// Procedural canvas textures (deterministic: seeded random), so every render worker
// produces identical pixels.
import * as THREE from 'three';
import { mulberry32 } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, { repeat = [1, 1], srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

// Cream striped wallpaper with tiny rose dots (like the reference, but richer).
export function wallpaper() {
  const [c, g] = canvas(512, 512);
  const r = mulberry32(11);
  g.fillStyle = '#f2e3c4'; g.fillRect(0, 0, 512, 512);
  // broad soft stripes
  for (let x = 0; x < 512; x += 64) {
    g.fillStyle = 'rgba(214,190,150,0.28)'; g.fillRect(x, 0, 30, 512);
    g.fillStyle = 'rgba(180,140,95,0.45)'; g.fillRect(x + 31, 0, 2, 512);
    g.fillStyle = 'rgba(255,250,235,0.5)'; g.fillRect(x + 36, 0, 1, 512);
  }
  // little dot motif in the light band
  for (let x = 0; x < 512; x += 64) {
    for (let y = 0; y < 512; y += 42) {
      const yy = y + ((x / 64) % 2) * 21;
      g.fillStyle = 'rgba(205,110,105,0.55)';
      g.beginPath(); g.arc(x + 48, yy, 3.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(120,150,95,0.45)';
      g.beginPath(); g.ellipse(x + 44, yy + 5, 2.6, 1.3, -0.6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x + 52, yy + 5, 2.6, 1.3, 0.6, 0, Math.PI * 2); g.fill();
    }
  }
  // paper grain
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '120,90,50'},${r() * 0.05})`;
    g.fillRect(r() * 512, r() * 512, 1.5, 1.5);
  }
  return tex(c);
}

// Warm wooden floor planks with grain.
export function woodFloor() {
  const [c, g] = canvas(1024, 1024);
  const r = mulberry32(23);
  const plankH = 1024 / 8;
  for (let row = 0; row < 8; row++) {
    let x = -r() * 400;
    while (x < 1024) {
      const len = 300 + r() * 380;
      const hue = 24 + r() * 8, sat = 48 + r() * 14, lig = 38 + r() * 12;
      g.fillStyle = hsl(hue, sat, lig);
      g.fillRect(x, row * plankH, len, plankH);
      // grain lines
      for (let k = 0; k < 26; k++) {
        const y0 = row * plankH + r() * plankH;
        g.strokeStyle = `rgba(70,35,15,${0.06 + r() * 0.12})`;
        g.lineWidth = 0.6 + r() * 1.6;
        g.beginPath(); g.moveTo(x, y0);
        for (let s = 0; s <= 8; s++) g.lineTo(x + (len * s) / 8, y0 + Math.sin(s * 0.9 + k) * (1 + r() * 3));
        g.stroke();
      }
      // a knot now and then
      if (r() < 0.35) {
        const kx = x + r() * len, ky = row * plankH + plankH * (0.3 + r() * 0.4);
        g.fillStyle = 'rgba(80,40,18,0.35)';
        g.beginPath(); g.ellipse(kx, ky, 9 + r() * 8, 4 + r() * 3, 0, 0, Math.PI * 2); g.fill();
      }
      // highlight + seam
      g.fillStyle = 'rgba(255,220,170,0.10)'; g.fillRect(x, row * plankH + 3, len, 6);
      g.fillStyle = 'rgba(40,18,6,0.75)'; g.fillRect(x, row * plankH, 3, plankH);
      x += len;
    }
    g.fillStyle = 'rgba(40,18,6,0.8)'; g.fillRect(0, row * plankH, 1024, 3);
  }
  return tex(c, { repeat: [3, 3] });
}

// Warm wood for door frames / furniture (vertical grain).
export function woodTrim(seed = 5, base = [26, 55, 40]) {
  const [c, g] = canvas(256, 512);
  const r = mulberry32(seed);
  g.fillStyle = hsl(base[0], base[1], base[2]); g.fillRect(0, 0, 256, 512);
  for (let k = 0; k < 60; k++) {
    const x0 = r() * 256;
    g.strokeStyle = `rgba(60,28,10,${0.05 + r() * 0.13})`;
    g.lineWidth = 0.6 + r() * 2;
    g.beginPath(); g.moveTo(x0, 0);
    for (let s = 0; s <= 16; s++) g.lineTo(x0 + Math.sin(s * 0.7 + k) * (2 + r() * 4), (512 * s) / 16);
    g.stroke();
  }
  return tex(c);
}

// Red plaid (dad's shirt + apron).
export function plaid(seed = 3, base = '#b3261e', scale = 1) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  const S = 64 * scale;
  const bands = (horiz) => {
    for (let p = 0; p < 256; p += S) {
      const draw = (off, w, col) => {
        g.fillStyle = col;
        if (horiz) g.fillRect(0, p + off, 256, w); else g.fillRect(p + off, 0, w, 256);
      };
      draw(0, S * 0.34, 'rgba(70,8,8,0.42)');
      draw(S * 0.42, S * 0.06, 'rgba(20,10,10,0.55)');
      draw(S * 0.58, S * 0.04, 'rgba(255,220,180,0.35)');
      draw(S * 0.72, S * 0.12, 'rgba(70,8,8,0.28)');
    }
  };
  bands(true); bands(false);
  const r = mulberry32(seed);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.06})`; g.fillRect(r() * 256, r() * 256, 1, 1); }
  return tex(c, { repeat: [2, 2] });
}

// Chunky knit (grandma cardigan).
export function knit(color = '#4f8a4a') {
  const [c, g] = canvas(128, 128);
  g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 8) {
    for (let x = 0; x < 128; x += 8) {
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.beginPath(); g.ellipse(x + 2, y + 4, 2, 4, 0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.14)';
      g.beginPath(); g.ellipse(x + 6, y + 4, 2, 4, -0.5, 0, Math.PI * 2); g.fill();
    }
  }
  return tex(c, { repeat: [4, 4] });
}

// Fuzzy grey hook-and-loop (Velcro) fabric; returns {map, bump}.
export function velcro() {
  const [c, g] = canvas(256, 256);
  const r = mulberry32(77);
  g.fillStyle = '#8e9095'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i++) {
    const x = r() * 256, y = r() * 256, l = 50 + r() * 30;
    g.strokeStyle = `hsl(220,4%,${l}%)`;
    g.lineWidth = 0.8 + r();
    g.beginPath(); g.arc(x, y, 1.5 + r() * 2.5, r() * 6, r() * 6 + 3); g.stroke();
  }
  const map = tex(c, { repeat: [3, 3] });
  const [c2, g2] = canvas(256, 256);
  const r2 = mulberry32(78);
  g2.fillStyle = '#808080'; g2.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) {
    g2.fillStyle = r2() < 0.5 ? '#ffffff' : '#202020';
    g2.globalAlpha = 0.35; g2.fillRect(r2() * 256, r2() * 256, 2, 2);
  }
  const bump = tex(c2, { repeat: [3, 3], srgb: false });
  return { map, bump };
}

// Round red rug with border rings.
export function rug() {
  const [c, g] = canvas(512, 512);
  const r = mulberry32(31);
  g.fillStyle = '#a3222a'; g.beginPath(); g.arc(256, 256, 256, 0, Math.PI * 2); g.fill();
  const ring = (rad, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(256, 256, rad, 0, Math.PI * 2); g.stroke(); };
  ring(236, 14, '#6e1218'); ring(214, 6, '#e0a24a'); ring(196, 3, '#6e1218'); ring(120, 5, '#e0a24a');
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    g.fillStyle = '#d6863a';
    g.beginPath(); g.ellipse(256 + Math.cos(a) * 160, 256 + Math.sin(a) * 160, 16, 7, a, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#7b141c'; g.beginPath(); g.arc(256, 256, 60, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 20000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(r() * 512, r() * 512, 1, 1); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

// Little paintings for the picture frames.
export function painting(kind) {
  const [c, g] = canvas(256, 320);
  const r = mulberry32(kind.length * 17 + 3);
  if (kind === 'hills') {
    const sky = g.createLinearGradient(0, 0, 0, 200); sky.addColorStop(0, '#8fc4ef'); sky.addColorStop(1, '#f6e2b8');
    g.fillStyle = sky; g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(190, 80, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6aa85a'; g.beginPath(); g.moveTo(0, 230); g.quadraticCurveTo(90, 150, 256, 220); g.lineTo(256, 320); g.lineTo(0, 320); g.fill();
    g.fillStyle = '#4c8a47'; g.beginPath(); g.moveTo(0, 270); g.quadraticCurveTo(140, 200, 256, 280); g.lineTo(256, 320); g.lineTo(0, 320); g.fill();
  } else if (kind === 'boat') {
    g.fillStyle = '#bfe0f0'; g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#3f7fb5'; g.fillRect(0, 210, 256, 110);
    g.fillStyle = '#7a4a2a'; g.beginPath(); g.moveTo(60, 210); g.lineTo(200, 210); g.lineTo(180, 240); g.lineTo(80, 240); g.fill();
    g.fillStyle = '#fff8ea'; g.beginPath(); g.moveTo(128, 80); g.lineTo(128, 205); g.lineTo(70, 205); g.fill();
    g.fillStyle = '#e35b4a'; g.beginPath(); g.moveTo(134, 95); g.lineTo(134, 205); g.lineTo(185, 205); g.fill();
  } else if (kind === 'pancake') {
    // a proud portrait of a pancake stack (running joke)
    g.fillStyle = '#2e4a6b'; g.fillRect(0, 0, 256, 320);
    const grd = g.createRadialGradient(128, 160, 10, 128, 160, 170); grd.addColorStop(0, 'rgba(255,220,150,0.5)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(128, 240, 92, 22, 0, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 4; k++) {
      g.fillStyle = '#c98a3e'; g.beginPath(); g.ellipse(128, 225 - k * 24, 70, 16, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e6aa5a'; g.beginPath(); g.ellipse(128, 219 - k * 24, 70, 14, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#ffe680'; g.fillRect(114, 132, 28, 16);
    g.fillStyle = 'rgba(120,55,15,0.85)'; g.beginPath(); g.ellipse(128, 147, 46, 10, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(84, 147, 8, 30); g.fillRect(160, 147, 8, 22);
  } else {
    // flowers in a vase
    g.fillStyle = '#efe0c6'; g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#5b8fb0'; g.beginPath(); g.moveTo(100, 300); g.lineTo(156, 300); g.lineTo(170, 210); g.lineTo(86, 210); g.fill();
    for (let k = 0; k < 7; k++) {
      const x = 70 + r() * 116, y = 70 + r() * 110;
      g.strokeStyle = '#4f7d3c'; g.lineWidth = 4; g.beginPath(); g.moveTo(128, 212); g.lineTo(x, y); g.stroke();
      g.fillStyle = ['#e2574c', '#f2b84b', '#e88bb0', '#ffffff'][k % 4];
      for (let p = 0; p < 6; p++) { const a = (p / 6) * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 10, y + Math.sin(a) * 10, 8, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#7a4a1a'; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
    }
  }
  // canvas texture strokes
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.07})`; g.fillRect(r() * 256, r() * 320, 2, 1); }
  return tex(c);
}

// Clay roof shingles.
export function shingles() {
  const [c, g] = canvas(512, 512);
  const r = mulberry32(41);
  g.fillStyle = '#4a2a24'; g.fillRect(0, 0, 512, 512);
  const rowH = 32;
  for (let row = 0; row < 16; row++) {
    const off = (row % 2) * 24;
    for (let x = -48; x < 512; x += 48) {
      const l = 22 + r() * 10;
      g.fillStyle = hsl(8 + r() * 10, 38, l);
      g.beginPath();
      g.moveTo(x + off + 2, row * rowH);
      g.lineTo(x + off + 46, row * rowH);
      g.lineTo(x + off + 46, row * rowH + rowH - 4);
      g.quadraticCurveTo(x + off + 24, row * rowH + rowH + 4, x + off + 2, row * rowH + rowH - 4);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x + off + 2, row * rowH + rowH - 6, 44, 5);
      g.fillStyle = 'rgba(255,220,200,0.12)'; g.fillRect(x + off + 2, row * rowH, 44, 3);
    }
  }
  return tex(c, { repeat: [5, 3.5] });
}

// Clapboard siding for the house exterior.
export function siding(color = '#f1e4c8') {
  const [c, g] = canvas(256, 256);
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 21) {
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(0, y + 18, 256, 3);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, y, 256, 2);
  }
  return tex(c, { repeat: [4, 2] });
}

// Grass with soft variation.
export function grass() {
  const [c, g] = canvas(512, 512);
  const r = mulberry32(91);
  g.fillStyle = '#6fae4f'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '60,120,40' : '150,200,90'},${0.08 + r() * 0.12})`;
    g.beginPath(); g.arc(r() * 512, r() * 512, 10 + r() * 40, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 14000; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '40,90,30' : '170,215,110'},${r() * 0.25})`;
    g.fillRect(r() * 512, r() * 512, 1, 3);
  }
  return tex(c, { repeat: [10, 10] });
}

// Window backdrop: a sunny garden seen through the window (unlit, so it glows).
export function windowView() {
  const [c, g] = canvas(512, 512);
  const sky = g.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, '#7fb8ec'); sky.addColorStop(0.65, '#d4ecff'); sky.addColorStop(1, '#eef7ff');
  g.fillStyle = sky; g.fillRect(0, 0, 512, 512);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  [[120, 110, 50], [170, 100, 40], [380, 150, 46], [420, 140, 34]].forEach(([x, y, s]) => { g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); });
  g.fillStyle = '#7fbf62'; g.beginPath(); g.moveTo(0, 380); g.quadraticCurveTo(250, 330, 512, 370); g.lineTo(512, 512); g.lineTo(0, 512); g.fill();
  const tree = (x, y, s, col) => { g.fillStyle = '#6b4a2b'; g.fillRect(x - s * 0.08, y, s * 0.16, s * 0.6); g.fillStyle = col; g.beginPath(); g.arc(x, y, s * 0.45, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x - s * 0.25, y + s * 0.1, s * 0.32, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x + s * 0.27, y + s * 0.12, s * 0.3, 0, Math.PI * 2); g.fill(); };
  tree(90, 300, 150, '#4e9a45'); tree(420, 310, 170, '#3f8a3b'); tree(260, 330, 110, '#5aa64d');
  g.fillStyle = '#e9e1cf'; for (let x = 0; x < 512; x += 26) g.fillRect(x, 420, 14, 60);
  g.fillRect(0, 438, 512, 8);
  return tex(c);
}

// Soft round sprite for dust/glow; star sprite for sparkles; heart sprite.
export function softDot() {
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return tex(c);
}
export function starSprite() {
  const [c, g] = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 40);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, rad = i % 2 === 0 ? 62 : 9;
    g.lineTo(64 + Math.cos(a) * rad, 64 + Math.sin(a) * rad);
  }
  g.fill();
  return tex(c);
}
export function fanLabel() {
  const [c, g] = canvas(128, 64);
  g.fillStyle = '#f7f4ee'; g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#333'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('FAN', 64, 42);
  return tex(c);
}

// Dark-ink tattoo: inverted pentagram in a circle (transparent background).
export function pentagramTattoo() {
  const [c, g] = canvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(28,22,32,0.92)'; g.lineJoin = 'round'; g.lineCap = 'round';
  g.lineWidth = 11;
  g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 10;
  g.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = Math.PI / 2 + (i * 4 * Math.PI) / 5;   // starts pointing down (canvas y is down)
    const x = 128 + Math.cos(a) * 98, y = 128 + Math.sin(a) * 98;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
