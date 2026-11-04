// Pixel textures + icons for the wedding reel.
import * as THREE from 'three';
import { rng, shade, makeCanvas, toTex, noiseRect, pixelText, ICON, ICON_CANVAS } from './pixel.js';

export const WT = {};

function cloth(base, amt, extra, w = 16, h = 16, seed = 1) {
  const r = rng(seed);
  const [c, g] = makeCanvas(w, h);
  noiseRect(g, 0, 0, w, h, base, amt, r);
  if (extra) extra(g, r);
  return toTex(c);
}

export function buildWeddingTextures() {
  const r = rng(11);
  // tuxedo
  WT.tux = cloth(0x17171c, 0.12, null, 16, 16, 2);
  WT.tuxFront = cloth(0x17171c, 0.1, g => {
    g.fillStyle = '#f4f4f0'; g.beginPath(); g.moveTo(4, 0); g.lineTo(12, 0); g.lineTo(8, 11); g.closePath(); g.fill();
    g.fillStyle = '#0b0b0d'; g.fillRect(8, 3, 1, 1); g.fillRect(8, 6, 1, 1);
    g.fillStyle = '#2a2a33'; g.fillRect(3, 0, 1, 12); g.fillRect(12, 0, 1, 12);
  }, 16, 16, 3);
  WT.tuxPants = cloth(0x141418, 0.1, null, 16, 16, 4);
  // bride dress: white with tiny lace dots
  WT.dress = cloth(0xf7f5f0, 0.03, (g, rr) => {
    g.fillStyle = 'rgba(200,190,175,0.6)';
    for (let k = 0; k < 18; k++) g.fillRect(Math.floor(rr() * 16), Math.floor(rr() * 16), 1, 1);
  }, 16, 16, 5);
  WT.dressFront = cloth(0xf7f5f0, 0.03, g => {
    g.fillStyle = 'rgba(210,195,170,0.7)'; for (let x = 0; x < 16; x += 2) g.fillRect(x, 0, 1, 2);
    g.fillStyle = '#efe6d2'; g.fillRect(0, 12, 16, 2);
    g.fillStyle = '#e8c8d0'; g.fillRect(7, 12, 2, 2);
  }, 16, 16, 6);
  // priest robe with a gold stole
  WT.robe = cloth(0xf3efe4, 0.04, null, 16, 16, 7);
  WT.robeFront = cloth(0xf3efe4, 0.04, g => { g.fillStyle = '#d8b24a'; g.fillRect(4, 0, 2, 16); g.fillRect(10, 0, 2, 16); g.fillStyle = '#b0302a'; g.fillRect(4, 6, 2, 2); g.fillRect(10, 6, 2, 2); }, 16, 16, 8);
  // suits
  const suitFront = (base, tie) => cloth(base, 0.08, g => {
    g.fillStyle = '#f2f2ee'; g.beginPath(); g.moveTo(5, 0); g.lineTo(11, 0); g.lineTo(8, 9); g.closePath(); g.fill();
    g.fillStyle = tie; g.fillRect(7, 1, 2, 8);
    g.fillStyle = shade(base, 0.7); g.fillRect(3, 0, 1, 14); g.fillRect(12, 0, 1, 14);
  }, 16, 16, 9);
  WT.greySuit = cloth(0x8a8f99, 0.08, null, 16, 16, 10); WT.greySuitFront = suitFront(0x8a8f99, '#7a1d22');
  WT.brownSuit = cloth(0x6b4a2e, 0.1, g => { g.fillStyle = 'rgba(0,0,0,0.18)'; for (let x = 0; x < 16; x += 4) g.fillRect(x, 0, 1, 16); }, 16, 16, 11);
  WT.brownSuitFront = suitFront(0x6b4a2e, '#2e4a2a');
  WT.momDress = cloth(0x3f8fa3, 0.06, g => { g.fillStyle = '#e9f5f7'; for (let y = 1; y < 16; y += 4) for (let x = (y % 8 ? 1 : 3); x < 16; x += 4) g.fillRect(x, y, 1, 1); }, 16, 16, 12);
  WT.pinkDress = cloth(0xf5a9c4, 0.06, g => { g.fillStyle = '#ffffff'; g.fillRect(0, 13, 16, 2); }, 16, 16, 13);
  WT.family = [0xb39ddb, 0x80cbc4, 0xffd54f, 0xff8a65, 0x5c6bc0, 0x8e2c45, 0x9ccc65, 0xf48fb1].map((c, i) =>
    cloth(c, 0.08, (g, rr) => { if (i % 2) { g.fillStyle = shade(c, 1.25); for (let k = 0; k < 10; k++) g.fillRect(Math.floor(rr() * 16), Math.floor(rr() * 16), 1, 1); } else { g.fillStyle = shade(c, 0.8); for (let y = 0; y < 16; y += 5) g.fillRect(0, y, 16, 1); } }, 16, 16, 20 + i));
  WT.organist = cloth(0x4a3a6a, 0.08, null, 16, 16, 30);
  // church
  {
    const [c, g] = makeCanvas(16, 32);
    noiseRect(g, 0, 0, 16, 32, 0xb3262e, 0.07, r);
    g.fillStyle = '#d9b24a'; g.fillRect(0, 0, 1, 32); g.fillRect(15, 0, 1, 32);
    g.fillStyle = '#7a141b'; g.fillRect(1, 0, 1, 32); g.fillRect(14, 0, 1, 32);
    g.fillStyle = 'rgba(255,220,120,0.35)'; for (let y = 2; y < 32; y += 8) { g.fillRect(7, y, 2, 2); g.fillRect(6, y + 1, 4, 0.0001); }
    WT.carpet = toTex(c, [1, 10]);
  }
  {
    const [c, g] = makeCanvas(32, 16);
    for (let p = 0; p < 2; p++) noiseRect(g, 0, p * 8, 32, 8, p ? 0x8a5a33 : 0x7a4e2c, 0.08, r);
    g.fillStyle = 'rgba(30,15,5,0.45)'; g.fillRect(0, 0, 32, 1); g.fillRect(0, 8, 32, 1);
    WT.wood = toTex(c);
  }
  {
    const [c, g] = makeCanvas(32, 32);
    noiseRect(g, 0, 0, 32, 32, 0xead9bd, 0.05, r);
    g.fillStyle = 'rgba(120,95,60,0.25)';
    for (let y = 0; y < 32; y += 8) { g.fillRect(0, y, 32, 1); for (let x = (y / 8) % 2 ? 0 : 8; x < 32; x += 16) g.fillRect(x, y, 1, 8); }
    WT.stone = toTex(c, [6, 3]);
  }
  {
    const [c, g] = makeCanvas(32, 32);
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) noiseRect(g, tx * 16, ty * 16, 16, 16, (tx + ty) % 2 ? 0xd8c7a6 : 0xbfa985, 0.05, r);
    WT.floor = toTex(c, [8, 16]);
  }
  WT.stained = [0, 1, 2].map(k => {
    const [c, g] = makeCanvas(16, 32);
    const cols = [['#e8473d', '#3d6be8', '#f2c230', '#3fae5a', '#9b51e0'], ['#3d6be8', '#f2c230', '#e8473d', '#9b51e0', '#3fae5a'], ['#9b51e0', '#3fae5a', '#f2c230', '#3d6be8', '#e8473d']][k];
    const rr = rng(40 + k);
    for (let y = 0; y < 32; y += 4) for (let x = 0; x < 16; x += 4) { g.fillStyle = cols[Math.floor(rr() * 5)]; g.fillRect(x, y, 4, 4); }
    g.fillStyle = '#1a1410'; for (let y = 0; y <= 32; y += 4) g.fillRect(0, y, 16, 1); for (let x = 0; x <= 16; x += 4) g.fillRect(x, 0, 1, 32);
    g.fillStyle = '#fff3c4'; g.fillRect(6, 6, 4, 10); g.fillRect(4, 9, 8, 3); // a cross
    return toTex(c);
  });
  // bathroom
  {
    const [c, g] = makeCanvas(16, 16);
    noiseRect(g, 0, 0, 16, 16, 0xf2f4f5, 0.03, r);
    g.fillStyle = '#c9d1d6'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 8, 16, 1); g.fillRect(0, 0, 1, 16); g.fillRect(8, 0, 1, 16);
    WT.tile = toTex(c, [6, 3]);
  }
  WT.stall = cloth(0x8fb3c9, 0.05, g => { g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 0, 16, 1); }, 16, 16, 50);
  // parking lot
  {
    const [c, g] = makeCanvas(32, 32);
    noiseRect(g, 0, 0, 32, 32, 0x55585e, 0.14, r);
    g.fillStyle = '#f2f2ea'; g.fillRect(0, 0, 2, 32);
    WT.asphalt = toTex(c, [10, 10]);
  }
  {
    const [c, g] = makeCanvas(32, 32);
    noiseRect(g, 0, 0, 32, 32, 0xa85a3c, 0.1, r);
    g.fillStyle = 'rgba(240,220,200,0.6)';
    for (let y = 0; y < 32; y += 4) { g.fillRect(0, y, 32, 1); for (let x = (y / 4) % 2 ? 0 : 4; x < 32; x += 8) g.fillRect(x, y, 1, 4); }
    WT.brick = toTex(c, [8, 4]);
  }
  // reserved sign
  {
    const [c, g] = makeCanvas(64, 32);
    g.fillStyle = '#5a3a20'; g.fillRect(0, 0, 64, 32);
    g.fillStyle = '#fbf6e8'; g.fillRect(2, 2, 60, 28);
    pixelText(g, 'RESERVED', 32, 6, 8, 0x7a141b, 'center');
    pixelText(g, 'MOM', 32, 18, 8, 0x111111, 'center');
    WT.reserved = toTex(c);
    WT.reserved.magFilter = THREE.NearestFilter; WT.reserved.minFilter = THREE.NearestFilter; WT.reserved.generateMipmaps = false;
  }
  // phone screen: MOM <3
  {
    const [c, g] = makeCanvas(32, 64);
    g.fillStyle = '#1b2a3a'; g.fillRect(0, 0, 32, 64);
    g.fillStyle = '#3fae5a'; g.fillRect(4, 50, 10, 8);
    g.fillStyle = '#e8473d'; g.fillRect(18, 50, 10, 8);
    pixelText(g, 'MOM', 16, 16, 8, 0xffffff, 'center');
    const H = ['.kk.kk.', 'krrkrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
    H.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = ch === 'k' ? '#5a0f1f' : '#ff4d7a'; g.fillRect(12 + x, 28 + y, 1, 1); } }));
    pixelText(g, '...', 16, 38, 4, 0x9fd8ff, 'center');
    WT.phone = toTex(c);
    WT.phone.magFilter = THREE.NearestFilter; WT.phone.minFilter = THREE.NearestFilter; WT.phone.generateMipmaps = false;
  }
  // organ pipes
  WT.pipe = cloth(0xd9b24a, 0.08, g => { g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(3, 0, 2, 16); }, 16, 16, 60);
}

// ---------------------------------------------------------------- extra icons
function pat(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const [c, g] = makeCanvas(w, h);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  return c;
}
export function buildWeddingIcons() {
  ICON_CANVAS.z = pat([
    'kkkkkkk',
    'kbbbbbk',
    'kkkkbbk',
    '...kbk.',
    '..kbk..',
    '.kbkkkk',
    'kbbbbbk',
    'kkkkkkk',
  ], { k: '#0b2a4f', b: '#9fd8ff' });
  ICON_CANVAS.swirl = pat([
    '..kkkkk..',
    '.kyyyyyk.',
    'kyykkkyyk',
    'kyk.kkyyk',
    'kyk.kyk..',
    'kyykkyk..',
    '.kyyyyk..',
    '..kkkk...',
  ], { k: '#3a1a5a', y: '#c79bff' });
  ICON_CANVAS.petal = pat([
    '.kkk.',
    'kpppk',
    'kpwpk',
    'kpppk',
    '.kpk.',
    '..k..',
  ], { k: '#9a2a52', p: '#ff8fb8', w: '#ffd6e6' });
  ICON_CANVAS.petal2 = pat([
    '.kk.',
    'kwwk',
    'kwwk',
    '.kk.',
  ], { k: '#b0a090', w: '#fffaf0' });
  ICON_CANVAS.note = pat([
    '...kkkk',
    '...kbbk',
    '...k..k',
    '...k..k',
    'kkkk.kk',
    'kbbk.kk',
    'kkkk...',
  ], { k: '#101030', b: '#6aa0ff' });
  for (const k of ['z', 'swirl', 'petal', 'petal2', 'note']) {
    const t = toTex(ICON_CANVAS[k]);
    t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    ICON[k] = t;
  }
}
