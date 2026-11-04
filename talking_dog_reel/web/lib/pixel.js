// Pixel-art texture helpers: everything is drawn on tiny canvases and shown
// with nearest-neighbour filtering so it reads as chunky pixels.
import * as THREE from 'three';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hex(c) {
  return typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c;
}

export function shade(c, f) {
  c = hex(c);
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((c & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

export function css(c) { return shade(c, 1); }

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

export function toTex(canvas, rep = [1, 1]) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep[0], rep[1]);
  t.anisotropy = 4;
  return t;
}

// fill a rect with per-pixel brightness noise
export function noiseRect(g, x, y, w, h, color, amt, r) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      g.fillStyle = shade(color, 1 + (r() - 0.5) * 2 * amt);
      g.fillRect(i, j, 1, 1);
    }
  }
}

// crisp pixel text: draws antialiased text then thresholds alpha
export function pixelText(g, text, x, y, size, color, align = 'left') {
  const w = Math.ceil(text.length * size * 1.05) + 4, h = size + 4;
  const [c, cg] = makeCanvas(w, h);
  cg.font = `${size}px "Press Start 2P"`;
  cg.textBaseline = 'top';
  cg.fillStyle = '#fff';
  cg.fillText(text, 2, 2);
  const img = cg.getImageData(0, 0, w, h);
  const col = new THREE.Color(hex(color));
  const R = Math.round(col.r * 255), G = Math.round(col.g * 255), B = Math.round(col.b * 255);
  for (let i = 0; i < img.data.length; i += 4) {
    const on = img.data[i + 3] > 110;
    img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = on ? 255 : 0;
  }
  cg.putImageData(img, 0, 0);
  const tw = cg.measureText(text).width;
  let ox = x - 2;
  if (align === 'center') ox = Math.round(x - tw / 2) - 2;
  g.drawImage(c, ox, y - 2);
}

// ---------- surface textures ----------
export const TEX = {};

export function buildTextures() {
  const r = rng(7);

  // checker linoleum floor (one texel block = 2 tiles)
  {
    const [c, g] = makeCanvas(32, 32);
    const A = 0xb9a27a, B = 0x7d6a52;
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      noiseRect(g, tx * 16, ty * 16, 16, 16, (tx + ty) % 2 ? A : B, 0.06, r);
    }
    g.fillStyle = 'rgba(40,28,20,0.35)';
    for (let k = 0; k < 32; k += 16) { g.fillRect(k, 0, 1, 32); g.fillRect(0, k, 32, 1); }
    TEX.floor = toTex(c, [10, 8]);
  }
  // wall: cream plaster above, teal wainscot below, wooden rail between
  {
    const [c, g] = makeCanvas(32, 64);
    noiseRect(g, 0, 0, 32, 40, 0xe4d2a8, 0.04, r);
    noiseRect(g, 0, 40, 32, 3, 0x6b4a2e, 0.08, r);
    noiseRect(g, 0, 43, 32, 21, 0x3f6b60, 0.05, r);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let k = 0; k < 32; k += 8) g.fillRect(k, 43, 1, 21);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    for (let k = 1; k < 32; k += 8) g.fillRect(k, 43, 1, 21);
    noiseRect(g, 0, 62, 32, 2, 0x2b2018, 0.1, r);
    TEX.wall = toTex(c, [1, 1]);
  }
  // ceiling tiles
  {
    const [c, g] = makeCanvas(16, 16);
    noiseRect(g, 0, 0, 16, 16, 0xcfc4ac, 0.05, r);
    g.fillStyle = 'rgba(60,50,40,0.4)';
    g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16);
    TEX.ceiling = toTex(c, [12, 10]);
  }
  // wood planks
  {
    const [c, g] = makeCanvas(32, 32);
    for (let p = 0; p < 4; p++) noiseRect(g, 0, p * 8, 32, 8, p % 2 ? 0x8a5a33 : 0x7a4e2c, 0.07, r);
    g.fillStyle = 'rgba(30,15,5,0.5)';
    for (let p = 0; p < 4; p++) { g.fillRect(0, p * 8, 32, 1); g.fillRect((p * 13) % 32, p * 8, 1, 8); }
    TEX.wood = toTex(c, [1, 1]);
  }
  // darker wood for doors
  {
    const [c, g] = makeCanvas(16, 32);
    noiseRect(g, 0, 0, 16, 32, 0x6b4426, 0.07, r);
    g.fillStyle = 'rgba(25,12,4,0.55)';
    g.fillRect(2, 3, 12, 1); g.fillRect(2, 3, 1, 11); g.fillRect(2, 14, 12, 1); g.fillRect(13, 3, 1, 12);
    g.fillRect(2, 17, 12, 1); g.fillRect(2, 17, 1, 12); g.fillRect(2, 29, 12, 1); g.fillRect(13, 17, 1, 13);
    g.fillStyle = 'rgba(255,220,170,0.15)';
    g.fillRect(3, 4, 10, 1); g.fillRect(3, 18, 10, 1);
    TEX.door = toTex(c);
  }
  // cork board
  {
    const [c, g] = makeCanvas(32, 32);
    noiseRect(g, 0, 0, 32, 32, 0xa77b4c, 0.14, r);
    TEX.cork = toTex(c, [2, 1]);
  }
  // metal (bars / cabinet)
  {
    const [c, g] = makeCanvas(8, 8);
    noiseRect(g, 0, 0, 8, 8, 0x55595e, 0.08, r);
    TEX.metal = toTex(c);
  }
  // clothes ------------------------------------------------------------
  const cloth = (base, amt, extra) => {
    const [c, g] = makeCanvas(16, 16);
    noiseRect(g, 0, 0, 16, 16, base, amt, r);
    if (extra) extra(g);
    return toTex(c);
  };
  TEX.purple = cloth(0x7b3fa8, 0.08, g => {
    g.fillStyle = shade(0x7b3fa8, 0.72);
    for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 1);
  });
  TEX.purpleFront = cloth(0x7b3fa8, 0.08, g => {
    g.fillStyle = shade(0x7b3fa8, 0.72);
    for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 1);
    g.fillStyle = shade(0x7b3fa8, 0.55); g.fillRect(7, 0, 2, 16);
    g.fillStyle = '#e8dcf0'; for (let y = 2; y < 16; y += 4) g.fillRect(7, y, 2, 1);
    g.fillStyle = shade(0x7b3fa8, 0.5); g.fillRect(4, 0, 3, 2); g.fillRect(9, 0, 3, 2);
  });
  TEX.jeans = cloth(0x2c3d5c, 0.1);
  TEX.navy = cloth(0x2c4a8c, 0.08);
  TEX.navyPants = cloth(0x1c2740, 0.08);
  TEX.navyFront = cloth(0x2c4a8c, 0.07, g => {
    g.fillStyle = shade(0x2c4a8c, 0.65);
    g.fillRect(2, 4, 4, 4); g.fillRect(10, 4, 4, 4); g.fillRect(7, 0, 2, 16);
    g.fillStyle = '#e8c547'; g.fillRect(3, 3, 2, 2); // badge
    g.fillStyle = '#f2e9c9'; g.fillRect(3, 3, 1, 1);
    g.fillStyle = '#c9c9c9'; for (let y = 3; y < 16; y += 4) g.fillRect(7, y, 1, 1);
    g.fillStyle = '#121212'; g.fillRect(0, 14, 16, 2); // belt
    g.fillStyle = '#d6b23a'; g.fillRect(7, 14, 2, 2);
  });
  TEX.vest = cloth(0xf2efe6, 0.04, g => {
    g.fillStyle = 'rgba(150,140,120,0.35)';
    for (let x = 0; x < 16; x += 2) g.fillRect(x, 0, 1, 16);
  });
  TEX.sweat = cloth(0x6d7078, 0.07);
  TEX.stripes = cloth(0xeeeeea, 0.04, g => {
    for (let y = 0; y < 16; y += 4) noiseRect(g, 0, y, 16, 2, 0x1b1b1f, 0.15, r);
  });
  TEX.fur = cloth(0xc0843f, 0.12);
  TEX.furBack = cloth(0x2a2119, 0.15);
  TEX.mattress = cloth(0x8c9aa6, 0.06, g => {
    g.fillStyle = 'rgba(40,50,70,0.35)';
    for (let x = 0; x < 16; x += 4) g.fillRect(x, 0, 1, 16);
  });
}

// ---------- labelled textures (need the pixel font loaded) ----------
export function signTexture(text, { w = 64, h = 16, bg = 0xf3efe2, fg = 0x111111, size = 8, border = 0x333333 } = {}) {
  const [c, g] = makeCanvas(w, h);
  g.fillStyle = css(border); g.fillRect(0, 0, w, h);
  g.fillStyle = css(bg); g.fillRect(1, 1, w - 2, h - 2);
  pixelText(g, text, w / 2, Math.round((h - size) / 2), size, fg, 'center');
  return toTex(c);
}

export function wantedPoster(seed, opts = {}) {
  const r = rng(seed);
  const [c, g] = makeCanvas(24, 32);
  noiseRect(g, 0, 0, 24, 32, 0xe9dcb5, 0.05, r);
  g.fillStyle = '#7a1d14';
  // tiny "WANTED" header as blocky marks (font too big for 24px)
  pixelText(g, 'WANTED', 12, 2, 4, 0x7a1d14, 'center');
  // face
  const skin = [0xe0ac7e, 0xc68a5c, 0xa86f48, 0xf0c49a][Math.floor(r() * 4)];
  g.fillStyle = '#5c5146'; g.fillRect(5, 8, 14, 15);
  g.fillStyle = css(skin); g.fillRect(7, 10, 10, 11);
  g.fillStyle = css([0x2b1d14, 0x6b4a2e, 0x111111][Math.floor(r() * 3)]); g.fillRect(7, 9, 10, 3);
  g.fillStyle = '#111'; g.fillRect(9, 14, 2, 2); g.fillRect(13, 14, 2, 2);
  if (opts.mustache || r() > 0.5) { g.fillStyle = '#2a1a10'; g.fillRect(9, 18, 6, 1); }
  g.fillStyle = '#111'; g.fillRect(10, 19, 4, 1);
  // reward lines
  g.fillStyle = '#3a2a1a'; g.fillRect(4, 25, 16, 1); g.fillRect(6, 28, 12, 1);
  return toTex(c);
}

export function photoTexture() {
  // the husband's portrait: bald, giant mustache, white vest, pink heart
  const [c, g] = makeCanvas(24, 30);
  g.fillStyle = '#f7f1e6'; g.fillRect(0, 0, 24, 30);
  g.fillStyle = '#9fc4d8'; g.fillRect(2, 2, 20, 26);
  g.fillStyle = '#d99b72'; g.fillRect(7, 6, 10, 11); // head
  g.fillStyle = '#e8b48c'; g.fillRect(8, 6, 3, 2);   // shine
  g.fillStyle = '#111'; g.fillRect(9, 10, 1, 2); g.fillRect(14, 10, 1, 2);
  g.fillStyle = '#2a1a10'; g.fillRect(7, 13, 10, 2); g.fillRect(6, 14, 2, 2); g.fillRect(16, 14, 2, 2);
  g.fillStyle = '#c98b63'; g.fillRect(10, 17, 4, 2); // neck
  g.fillStyle = '#f2efe6'; g.fillRect(5, 19, 14, 9); // vest
  g.fillStyle = '#d99b72'; g.fillRect(4, 19, 2, 9); g.fillRect(18, 19, 2, 9);
  g.fillStyle = '#ff5fa2'; g.fillRect(17, 3, 2, 1); g.fillRect(20, 3, 1, 1); g.fillRect(17, 4, 4, 1); g.fillRect(18, 5, 2, 1);
  g.fillStyle = '#ff5fa2'; g.fillRect(16, 3, 1, 1);
  return toTex(c);
}

export function crtTexture(lines = 6, cursorOn = true) {
  const [c, g] = makeCanvas(32, 24);
  g.fillStyle = '#0b1a0e'; g.fillRect(0, 0, 32, 24);
  const r = rng(lines * 31 + (cursorOn ? 1 : 0));
  g.fillStyle = '#5dff7a';
  let y = 2;
  for (let l = 0; l < Math.min(lines, 6); l++) {
    let x = 2;
    const n = 4 + Math.floor(r() * 20);
    for (let k = 0; k < n && x < 30; k++) {
      if (r() > 0.2) g.fillRect(x, y, 1, 2);
      x += 1;
    }
    y += 3;
  }
  if (cursorOn) g.fillRect(2 + (lines * 5) % 24, y, 2, 2);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let k = 0; k < 24; k += 2) g.fillRect(0, k, 32, 1);
  return toTex(c);
}

export function keyboardTexture() {
  const [c, g] = makeCanvas(32, 12);
  g.fillStyle = '#b8ad94'; g.fillRect(0, 0, 32, 12);
  g.fillStyle = '#e3dac4';
  for (let row = 0; row < 4; row++) for (let k = 0; k < 14; k++) {
    if (row === 3 && (k < 4 || k > 10)) continue;
    g.fillRect(1 + k * 2 + (row % 2), 1 + row * 3, 1, 2);
  }
  g.fillRect(9, 10, 12, 1);
  return toTex(c);
}

// ---------- sprite icons (pixel art with outlines) ----------
function spriteFromPattern(pattern, palette, scale = 1) {
  const h = pattern.length, w = pattern[0].length;
  const [c, g] = makeCanvas(w * scale, h * scale);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = pattern[y][x];
    if (ch === '.' || ch === ' ') continue;
    g.fillStyle = palette[ch];
    g.fillRect(x * scale, y * scale, scale, scale);
  }
  return c;
}

export const ICON_CANVAS = {};
export const ICON = {};

export function buildIcons() {
  ICON_CANVAS.heart = spriteFromPattern([
    '..kkk...kkk..',
    '.kpppk.kpppk.',
    'kpwwppkpppppk',
    'kpwppppppppPk',
    'kppppppppppPk',
    '.kppppppppPk.',
    '..kppppppPk..',
    '...kppppPk...',
    '....kppPk....',
    '.....kPk.....',
    '......k......',
  ], { k: '#4a0f2b', p: '#ff6fb1', P: '#e0438f', w: '#ffd6ea' });
  ICON_CANVAS.drop = spriteFromPattern([
    '...k...',
    '..kbk..',
    '..kbk..',
    '.kbbbk.',
    '.kwbbk.',
    'kwbbbBk',
    'kwbbbBk',
    'kbbbBBk',
    '.kBBBk.',
    '..kkk..',
  ], { k: '#0d2a4f', b: '#4fb3ff', B: '#2a7fd6', w: '#d8f1ff' });
  ICON_CANVAS.sparkle = spriteFromPattern([
    '...k...',
    '...y...',
    '..kyk..',
    'kyywyyk',
    '..kyk..',
    '...y...',
    '...k...',
  ], { k: '#a07800', y: '#ffe35a', w: '#ffffff' });
  // green stink line frames (wavy vertical squiggle, animated phase)
  ICON_CANVAS.stink = [];
  for (let f = 0; f < 8; f++) {
    const [c, g] = makeCanvas(9, 26);
    for (let y = 0; y < 26; y++) {
      const x = Math.round(4 + 2.6 * Math.sin((y / 26) * Math.PI * 2.2 + f * Math.PI / 4));
      g.fillStyle = '#1d4a12'; g.fillRect(x - 1, y, 3, 1);
      g.fillStyle = y % 3 === 0 ? '#c8ff6a' : '#7ddc3c'; g.fillRect(x, y, 1, 1);
    }
    ICON_CANVAS.stink.push(c);
  }
  ICON.heart = toTex(ICON_CANVAS.heart);
  ICON.drop = toTex(ICON_CANVAS.drop);
  ICON.sparkle = toTex(ICON_CANVAS.sparkle);
  ICON.stink = ICON_CANVAS.stink.map(c => toTex(c));
  for (const k of ['heart', 'drop', 'sparkle']) { ICON[k].minFilter = THREE.NearestFilter; ICON[k].generateMipmaps = false; }
  ICON.stink.forEach(t => { t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; });
}
