// Pixel textures + icons for the talking dog reel.
import * as THREE from 'three';
import { rng, shade, css, makeCanvas, toTex, noiseRect, pixelText, ICON, ICON_CANVAS } from './pixel.js';

export const DT = {};

function cloth(base, amt, extra, w = 16, h = 16, seed = 1, rep = [1, 1]) {
  const r = rng(seed);
  const [c, g] = makeCanvas(w, h);
  noiseRect(g, 0, 0, w, h, base, amt, r);
  if (extra) extra(g, r);
  return toTex(c, rep);
}
function pat(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const [c, g] = makeCanvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = rows[y][x]; if (ch !== '.' && ch !== ' ') { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }
  return c;
}

// tiny pixel portrait for the family photo frames
function portrait(seed, draw) {
  const [c, g] = makeCanvas(24, 30);
  g.fillStyle = '#e8d6a8'; g.fillRect(0, 0, 24, 30);
  g.fillStyle = '#b98a4a'; g.fillRect(0, 0, 24, 1); g.fillRect(0, 29, 24, 1); g.fillRect(0, 0, 1, 30); g.fillRect(23, 0, 1, 30);
  draw(g, rng(seed));
  return toTex(c);
}
function face(g, x, y, skin, hair, o = {}) {
  g.fillStyle = css(skin); g.fillRect(x, y, 7, 8);
  g.fillStyle = css(hair); g.fillRect(x, y - 1, 7, 2); if (o.long) { g.fillRect(x - 1, y, 1, 8); g.fillRect(x + 7, y, 1, 8); }
  if (o.bun) g.fillRect(x + 2, y - 3, 3, 2);
  g.fillStyle = '#111'; g.fillRect(x + 1, y + 3, 1, 2); g.fillRect(x + 5, y + 3, 1, 2);
  if (o.mustache) { g.fillStyle = '#3a2416'; g.fillRect(x + 1, y + 6, 5, 1); }
  if (o.glasses) { g.fillStyle = '#222'; g.fillRect(x, y + 3, 3, 1); g.fillRect(x + 4, y + 3, 3, 1); }
  g.fillStyle = '#7a2a2a'; g.fillRect(x + 2, y + 7, 3, 1);
}
function dogFace(g, x, y, s = 1) {
  g.fillStyle = '#9a5a2e'; g.fillRect(x, y, 8 * s, 7 * s);
  g.fillStyle = '#6b3d1e'; g.fillRect(x - 2 * s, y, 2 * s, 6 * s); g.fillRect(x + 8 * s, y, 2 * s, 6 * s);
  g.fillStyle = '#f0d6aa'; g.fillRect(x + 2 * s, y + 4 * s, 4 * s, 3 * s);
  g.fillStyle = '#111'; g.fillRect(x + 2 * s, y + 2 * s, s, s); g.fillRect(x + 5 * s, y + 2 * s, s, s); g.fillRect(x + 3 * s, y + 4 * s, 2 * s, s);
}

export function buildDogTextures() {
  const r = rng(21);
  // ---------------------------------------------------------------- dog fur
  DT.fur = cloth(0x9a5a2e, 0.1, (g, rr) => { g.fillStyle = shade(0x9a5a2e, 0.82); for (let k = 0; k < 22; k++) g.fillRect(Math.floor(rr() * 16), Math.floor(rr() * 16), 1, 2); }, 16, 16, 3);
  DT.furDark = cloth(0x6b3d1e, 0.1, null, 16, 16, 4);
  DT.cream = cloth(0xf0d6aa, 0.06, null, 16, 16, 5);

  // ---------------------------------------------------------------- clothes
  const HB = 0x3b6fd1;
  DT.hoodie = cloth(HB, 0.08, g => { g.fillStyle = shade(HB, 0.8); g.fillRect(0, 14, 16, 2); }, 16, 16, 6);
  DT.hoodieFront = cloth(HB, 0.08, g => {
    g.fillStyle = shade(HB, 0.72); g.fillRect(3, 9, 10, 5); g.fillStyle = shade(HB, 0.6); g.fillRect(3, 9, 10, 1); g.fillRect(3, 9, 1, 5); g.fillRect(12, 9, 1, 5);
    g.fillStyle = '#f4f4f4'; g.fillRect(6, 0, 1, 6); g.fillRect(9, 0, 1, 5); g.fillStyle = '#c8c8c8'; g.fillRect(6, 6, 1, 1); g.fillRect(9, 5, 1, 1);
    g.fillStyle = shade(HB, 0.8); g.fillRect(0, 14, 16, 2);
  }, 16, 16, 7);
  DT.jeans = cloth(0x34508a, 0.09, (g, rr) => { g.fillStyle = shade(0x34508a, 1.18); for (let k = 0; k < 16; k += 3) g.fillRect(k, (k * 5) % 16, 1, 1); g.fillStyle = shade(0x34508a, 0.8); g.fillRect(7, 0, 1, 16); }, 16, 16, 8);
  const MD = 0xb79ad6;
  DT.momDress = cloth(MD, 0.06, g => { g.fillStyle = '#f6efff'; for (let y = 1; y < 16; y += 4) for (let x = (y % 8 ? 1 : 3); x < 16; x += 4) g.fillRect(x, y, 1, 1); }, 16, 16, 9);
  DT.momFront = cloth(MD, 0.06, g => {
    g.fillStyle = '#f6efff'; for (let y = 1; y < 16; y += 4) for (let x = (y % 8 ? 1 : 3); x < 16; x += 4) g.fillRect(x, y, 1, 1);
    g.fillStyle = '#fff6ea'; g.fillRect(4, 4, 8, 12); g.fillStyle = '#ff8fb0'; g.fillRect(4, 4, 8, 1); g.fillRect(4, 4, 1, 12); g.fillRect(11, 4, 1, 12);
    g.fillStyle = '#fff6ea'; g.fillRect(4, 0, 1, 4); g.fillRect(11, 0, 1, 4);
    g.fillStyle = '#ff6f9a'; g.fillRect(7, 8, 2, 1); g.fillRect(6, 7, 1, 1); g.fillRect(9, 7, 1, 1);
  }, 16, 16, 10);
  {
    const [c, g] = makeCanvas(16, 24);
    noiseRect(g, 0, 0, 16, 24, 0xfff6ea, 0.03, r);
    g.fillStyle = '#ff8fb0'; for (let x = 0; x < 16; x += 2) { g.fillRect(x, 22, 1, 2); g.fillRect(x + 1, 23, 1, 1); }
    g.fillRect(0, 0, 16, 1);
    g.fillStyle = '#ffd1df'; g.fillRect(4, 8, 8, 6); g.fillStyle = '#ff6f9a'; g.fillRect(4, 8, 8, 1);
    g.fillStyle = '#ff6f9a'; g.fillRect(7, 10, 2, 2); g.fillRect(6, 10, 1, 1); g.fillRect(9, 10, 1, 1);
    DT.apron = toTex(c);
  }
  const DS = 0x8e3b46;
  DT.dadSweater = cloth(DS, 0.08, g => { g.fillStyle = shade(DS, 0.78); for (let x = 1; x < 16; x += 4) g.fillRect(x, 0, 1, 16); }, 16, 16, 11);
  DT.dadFront = cloth(DS, 0.08, g => {
    g.fillStyle = shade(DS, 0.78); for (let x = 1; x < 16; x += 4) g.fillRect(x, 0, 1, 16);
    g.fillStyle = '#f2f2ee'; g.beginPath(); g.moveTo(5, 0); g.lineTo(11, 0); g.lineTo(8, 5); g.closePath(); g.fill();
    g.fillStyle = shade(DS, 0.55); g.fillRect(8, 5, 1, 11);
    g.fillStyle = '#e8d9b0'; for (let y = 7; y < 16; y += 3) g.fillRect(9, y, 1, 1);
  }, 16, 16, 12);
  DT.dadPants = cloth(0x9a8a6a, 0.07, null, 16, 16, 13);
  const SP = 0xff6fa8;
  DT.sisTop = cloth(SP, 0.07, null, 16, 16, 14);
  DT.sisFront = cloth(SP, 0.07, g => {
    g.fillStyle = '#ffe35a';
    for (const [x, y] of [[7, 5], [8, 5], [6, 6], [7, 6], [8, 6], [9, 6], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [6, 8], [7, 8], [8, 8], [9, 8], [6, 9], [9, 9]]) g.fillRect(x, y, 1, 1);
    g.fillStyle = shade(SP, 0.75); g.fillRect(5, 0, 6, 1);
  }, 16, 16, 15);
  DT.leggings = cloth(0x2c2c3a, 0.07, null, 16, 16, 16);
  DT.walkers = [0x5fa36a, 0xe0a040, 0x4a8ad0, 0xd06a5a, 0x9a7ad0, 0x3aa0a0].map((c, i) => cloth(c, 0.08, (g, rr) => { g.fillStyle = shade(c, 0.8); for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 1); }, 16, 16, 40 + i));

  // ---------------------------------------------------------------- home
  DT.wallpaper = cloth(0xf3cfa2, 0.03, (g, rr) => {
    g.fillStyle = shade(0xf3cfa2, 1.06); for (let x = 0; x < 16; x += 8) g.fillRect(x, 0, 3, 16);
    g.fillStyle = '#e59a7a'; g.fillRect(5, 3, 1, 1); g.fillRect(13, 11, 1, 1);
    g.fillStyle = '#9fbf7a'; g.fillRect(5, 4, 1, 1); g.fillRect(13, 12, 1, 1);
  }, 16, 16, 17);
  DT.wainscot = cloth(0x8a5a33, 0.07, g => { g.fillStyle = 'rgba(30,15,5,0.45)'; for (let x = 0; x < 16; x += 8) g.fillRect(x, 0, 1, 16); g.fillStyle = 'rgba(255,220,170,0.18)'; for (let x = 1; x < 16; x += 8) g.fillRect(x, 0, 1, 16); g.fillStyle = 'rgba(30,15,5,0.4)'; g.fillRect(0, 0, 16, 1); }, 16, 16, 18);
  {
    const [c, g] = makeCanvas(32, 32);
    for (let p = 0; p < 4; p++) noiseRect(g, 0, p * 8, 32, 8, [0xb07a46, 0xa06c3c, 0xb88250, 0x9c6638][p], 0.06, r);
    g.fillStyle = 'rgba(40,20,8,0.5)';
    for (let p = 0; p < 4; p++) { g.fillRect(0, p * 8, 32, 1); g.fillRect((p * 11 + 5) % 32, p * 8, 1, 8); g.fillRect((p * 11 + 21) % 32, p * 8, 1, 8); }
    DT.floor = toTex(c);
  }
  {
    const [c, g] = makeCanvas(32, 24);
    noiseRect(g, 0, 0, 32, 24, 0xb8463a, 0.05, r);
    g.fillStyle = '#e8c27a'; g.fillRect(1, 1, 30, 1); g.fillRect(1, 22, 30, 1); g.fillRect(1, 1, 1, 22); g.fillRect(30, 1, 1, 22);
    g.fillStyle = '#7a2a24'; g.fillRect(3, 3, 26, 1); g.fillRect(3, 20, 26, 1); g.fillRect(3, 3, 1, 18); g.fillRect(28, 3, 1, 18);
    g.fillStyle = '#e8c27a'; for (let k = 0; k < 5; k++) { const x = 7 + k * 4.5; g.fillRect(Math.round(x), 11, 2, 2); g.fillRect(Math.round(x) - 1, 12, 4, 0.0001); }
    g.fillStyle = '#f0a050'; for (let k = 0; k < 4; k++) { g.fillRect(9 + k * 5, 7, 1, 1); g.fillRect(9 + k * 5, 16, 1, 1); }
    DT.rug = toTex(c);
  }
  DT.tableWood = cloth(0x7a4a26, 0.07, g => { g.fillStyle = 'rgba(30,12,4,0.35)'; for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 1); }, 16, 16, 19);
  DT.runner = cloth(0xf6ead2, 0.04, g => { g.fillStyle = '#c8463a'; g.fillRect(0, 2, 16, 1); g.fillRect(0, 13, 16, 1); g.fillStyle = '#e8b04a'; g.fillRect(0, 4, 16, 1); g.fillRect(0, 11, 16, 1); }, 16, 16, 20);
  DT.photos = [
    portrait(1, (g) => { g.fillStyle = '#9fc4d8'; g.fillRect(2, 2, 20, 26); face(g, 4, 9, 0xe8b38a, 0x5a3a22, { mustache: true, glasses: true }); face(g, 13, 9, 0xeab894, 0x7a5a3a, { bun: true }); g.fillStyle = '#ffffff'; g.fillRect(13, 18, 8, 8); g.fillStyle = '#222'; g.fillRect(3, 18, 9, 8); g.fillStyle = '#ff6f9a'; g.fillRect(11, 4, 2, 2); }),
    portrait(2, (g) => { g.fillStyle = '#ffd98a'; g.fillRect(2, 2, 20, 26); dogFace(g, 6, 10, 1.4); g.fillStyle = '#e83a4a'; g.fillRect(8, 22, 8, 2); g.fillStyle = '#ff7a8a'; g.fillRect(11, 21, 2, 4); }),
    portrait(3, (g) => { g.fillStyle = '#a8e09a'; g.fillRect(2, 2, 20, 26); face(g, 4, 11, 0xe8b38a, 0x3a2416); face(g, 13, 12, 0xe8b38a, 0x5a3418, { long: true }); g.fillStyle = '#3b6fd1'; g.fillRect(3, 20, 9, 8); g.fillStyle = '#ff6fa8'; g.fillRect(12, 21, 9, 7); }),
    portrait(4, (g) => { g.fillStyle = '#8fc8ff'; g.fillRect(2, 2, 20, 26); g.fillStyle = '#f2d27a'; g.fillRect(2, 20, 20, 8); dogFace(g, 7, 11, 1.2); g.fillStyle = '#111'; g.fillRect(5, 7, 14, 2); g.fillRect(8, 5, 8, 2); g.fillStyle = '#ffd23d'; g.fillRect(18, 8, 1, 4); }),
  ];
  {
    const [c, g] = makeCanvas(24, 24);
    for (let y = 0; y < 24; y++) { g.fillStyle = shade(0x1a2a5a, 0.7 + y / 40); g.fillRect(0, y, 24, 1); }
    g.fillStyle = '#ffffff'; for (const [x, y] of [[3, 3], [17, 2], [9, 6], [20, 9], [5, 12], [14, 4]]) g.fillRect(x, y, 1, 1);
    g.fillStyle = '#fff4c8'; g.fillRect(16, 5, 3, 3); g.fillStyle = '#1e2e60'; g.fillRect(17, 5, 2, 1);
    g.fillStyle = '#0e1a30'; g.fillRect(0, 18, 24, 6); g.fillStyle = '#ffd36a'; g.fillRect(3, 19, 1, 1); g.fillRect(8, 20, 1, 1); g.fillRect(19, 19, 1, 1);
    DT.nightWindow = toTex(c);
  }
  DT.curtain = cloth(0xc0503a, 0.06, g => { g.fillStyle = shade(0xc0503a, 0.78); for (let x = 0; x < 16; x += 3) g.fillRect(x, 0, 1, 16); }, 16, 16, 22);
  DT.lampShade = cloth(0xf7e0b0, 0.04, null, 8, 8, 23);

  // collar box: "TALK COLLAR 3000"
  {
    const [c, g] = makeCanvas(64, 48);
    for (let y = 0; y < 48; y++) { g.fillStyle = shade(0x2ec4b6, 1.12 - y / 90); g.fillRect(0, y, 64, 1); }
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 2); g.fillRect(0, 46, 64, 2);
    g.fillStyle = '#ffd23d'; g.beginPath(); g.moveTo(50, 4); g.lineTo(44, 16); g.lineTo(49, 16); g.lineTo(45, 26); g.lineTo(56, 12); g.lineTo(51, 12); g.lineTo(55, 4); g.closePath(); g.fill();
    pixelText(g, 'TALK', 4, 6, 8, 0xffffff);
    pixelText(g, 'COLLAR', 4, 17, 8, 0xffffff);
    pixelText(g, '3000', 4, 30, 8, 0xffd23d);
    dogFace(g, 46, 32, 1);
    DT.boxSide = toTex(c);
  }
  DT.boxTop = cloth(0x2ec4b6, 0.05, g => { g.fillStyle = '#ffffff'; g.fillRect(7, 0, 2, 16); g.fillRect(0, 7, 16, 2); }, 16, 16, 24);

  // sister's phone (camera app): recording on / off frame
  const phone = (on) => {
    const [c, g] = makeCanvas(18, 32);
    g.fillStyle = '#3a2a22'; g.fillRect(0, 0, 18, 32);
    g.fillStyle = '#f3cfa2'; g.fillRect(0, 0, 18, 18); g.fillStyle = '#8a5a33'; g.fillRect(0, 18, 18, 14);
    dogFace(g, 5, 12, 1);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, 18, 4);
    if (on) { g.fillStyle = '#ff2a2a'; g.fillRect(1, 1, 2, 2); }
    g.fillStyle = '#ffffff'; g.fillRect(4, 1, 1, 2); g.fillRect(5, 1, 1, 1); g.fillRect(6, 2, 1, 1); g.fillRect(8, 1, 2, 2); g.fillRect(11, 1, 2, 2);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 28, 18, 4);
    g.fillStyle = '#ffffff'; g.fillRect(7, 28, 4, 4); g.fillStyle = on ? '#ff2a2a' : '#ffffff'; g.fillRect(8, 29, 2, 2);
    return toTex(c);
  };
  DT.phoneRec = phone(true); DT.phoneIdle = phone(false);

  // ---------------------------------------------------------------- park
  DT.grass = cloth(0x5aa83a, 0.1, (g, rr) => { g.fillStyle = shade(0x5aa83a, 0.78); for (let k = 0; k < 26; k++) g.fillRect(Math.floor(rr() * 16), Math.floor(rr() * 16), 1, 2); g.fillStyle = shade(0x5aa83a, 1.2); for (let k = 0; k < 10; k++) g.fillRect(Math.floor(rr() * 16), Math.floor(rr() * 16), 1, 1); }, 16, 16, 25);
  DT.path = cloth(0xd8c49a, 0.08, (g, rr) => { g.fillStyle = shade(0xd8c49a, 0.8); for (let k = 0; k < 14; k++) g.fillRect(Math.floor(rr() * 16), Math.floor(rr() * 16), 1, 1); }, 16, 16, 26);
  DT.bark = cloth(0x6b4a2e, 0.1, g => { g.fillStyle = shade(0x6b4a2e, 0.7); for (let x = 1; x < 8; x += 3) g.fillRect(x, 0, 1, 16); }, 8, 16, 27);
  DT.benchWood = cloth(0xb0703a, 0.07, g => { g.fillStyle = 'rgba(40,20,5,0.35)'; g.fillRect(0, 0, 16, 1); }, 16, 8, 28);

  // ---------------------------------------------------------------- yard + bedroom (night, rain)
  DT.siding = cloth(0x9fb0c0, 0.04, g => { g.fillStyle = shade(0x9fb0c0, 0.72); for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 1); g.fillStyle = shade(0x9fb0c0, 1.1); for (let y = 1; y < 16; y += 4) g.fillRect(0, y, 16, 1); }, 16, 16, 29);
  DT.kennel = cloth(0xb8402e, 0.07, g => { g.fillStyle = shade(0xb8402e, 0.7); for (let x = 0; x < 16; x += 4) g.fillRect(x, 0, 1, 16); }, 16, 16, 30);
  DT.shingles = cloth(0x3a3a46, 0.08, g => { g.fillStyle = shade(0x3a3a46, 0.7); for (let y = 0; y < 16; y += 4) { g.fillRect(0, y, 16, 1); for (let x = (y % 8 ? 2 : 0); x < 16; x += 4) g.fillRect(x, y, 1, 4); } }, 16, 16, 31);
  DT.fence = cloth(0x8a6a4a, 0.08, g => { g.fillStyle = 'rgba(20,10,4,0.5)'; for (let x = 0; x < 16; x += 4) g.fillRect(x, 0, 1, 16); }, 16, 16, 32);
  DT.mudGrass = cloth(0x2f4a2a, 0.12, (g, rr) => { g.fillStyle = shade(0x2f4a2a, 0.7); for (let k = 0; k < 20; k++) g.fillRect(Math.floor(rr() * 16), Math.floor(rr() * 16), 2, 1); }, 16, 16, 33);
  DT.bedWall = cloth(0x3a4a7a, 0.04, g => { g.fillStyle = '#e8e0a0'; for (const [x, y] of [[3, 3], [11, 6], [6, 11], [14, 13]]) g.fillRect(x, y, 1, 1); }, 16, 16, 34);
  DT.carpet = cloth(0x8a7a6a, 0.08, null, 16, 16, 35);
  DT.blanket = cloth(0x3a7ad0, 0.04, g => { g.fillStyle = '#d0463a'; for (let k = 0; k < 16; k += 8) { g.fillRect(k + 2, 0, 2, 16); g.fillRect(0, k + 2, 16, 2); } g.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 16; k += 8) { g.fillRect(k + 6, 0, 1, 16); g.fillRect(0, k + 6, 16, 1); } }, 16, 16, 36);
  {
    const [c, g] = makeCanvas(24, 32);
    g.fillStyle = '#1a1a2e'; g.fillRect(0, 0, 24, 32);
    g.fillStyle = '#ff5a7a'; g.fillRect(3, 3, 18, 3);
    pixelText(g, 'LVL', 12, 8, 8, 0xffe35a, 'center');
    pixelText(g, 'UP', 12, 18, 8, 0x5ad8ff, 'center');
    g.fillStyle = '#7ee05a'; g.fillRect(4, 28, 16, 2);
    DT.poster = toTex(c);
  }
}

export function buildDogIcons() {
  ICON_CANVAS.z = pat([
    'kkkkkkk',
    'kbbbbbk',
    'kkkkbbk',
    '...kbk.',
    '..kbk..',
    '.kbkkkk',
    'kbbbbbk',
    'kkkkkkk',
  ], { k: '#0b2a4f', b: '#cfe9ff' });
  ICON_CANVAS.excl = pat([
    'kkkk',
    'kyyk',
    'kyyk',
    'kyyk',
    'kyyk',
    'kkkk',
    '.kk.',
    'kyyk',
    'kkkk',
  ], { k: '#3a1a00', y: '#ffe35a' });
  ICON_CANVAS.rec = pat([
    '.kkk.',
    'krrrk',
    'krwrk',
    'krrrk',
    '.kkk.',
  ], { k: '#5a0000', r: '#ff2a2a', w: '#ff9a9a' });
  // soft round glow (not pixel art: it is light)
  {
    const [c, g] = makeCanvas(64, 64);
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    ICON_CANVAS.glow = c;
  }
  ICON.z = toTex(ICON_CANVAS.z);
  ICON.excl = toTex(ICON_CANVAS.excl);
  ICON.rec = toTex(ICON_CANVAS.rec);
  ICON.glow = toTex(ICON_CANVAS.glow);
  for (const k of ['z', 'excl', 'rec']) { ICON[k].minFilter = THREE.NearestFilter; ICON[k].generateMipmaps = false; }
  ICON.glow.magFilter = THREE.LinearFilter;
}
