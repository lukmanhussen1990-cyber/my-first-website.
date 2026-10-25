// Asset loading: fonts, images (with clear placeholders when a file is missing),
// and cached derived canvases (silhouettes, soft shadows).
import { makeCanvas } from './util.js';

export const FONTS = {
  title: 'Anton',
  type: 'Special Elite',
  mono: 'Courier Prime',
  monoBold: 'Courier Prime Bold',
  gothic: 'UnifrakturMaguntia',
  bebas: 'Bebas Neue',
};

export async function loadFonts(base) {
  const list = [
    ['Anton', 'Anton.woff2'],
    ['Special Elite', 'SpecialElite.woff2'],
    ['Courier Prime', 'CourierPrime.woff2'],
    ['Courier Prime Bold', 'CourierPrime-Bold.woff2'],
    ['UnifrakturMaguntia', 'UnifrakturMaguntia.woff2'],
    ['Bebas Neue', 'BebasNeue.woff2'],
  ];
  for (const [name, file] of list) {
    const f = new FontFace(name, `url(${base}/fonts/${file})`);
    await f.load();
    document.fonts.add(f);
  }
  await document.fonts.ready;
}

function loadImage(url) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
}

// A registry of named images. Each entry: {img, w, h, missing, meta}
export class Assets {
  constructor() { this.map = new Map(); this.cache = new Map(); }

  async load(name, urls, fallbackSize = [1200, 800], meta = {}) {
    for (const u of urls) {
      const im = await loadImage(u);
      if (im) { this.map.set(name, { img: im, w: im.naturalWidth, h: im.naturalHeight, missing: false, meta }); return; }
    }
    this.map.set(name, { img: placeholder(name, fallbackSize[0], fallbackSize[1]), w: fallbackSize[0], h: fallbackSize[1], missing: true, meta });
  }

  async loadSeq(name, urlFn, count) {
    const frames = [];
    for (let i = 0; i < count; i++) {
      const im = await loadImage(urlFn(i));
      if (!im) break;
      frames.push(im);
    }
    if (frames.length) this.map.set(name, { frames, img: frames[0], w: frames[0].naturalWidth, h: frames[0].naturalHeight, missing: false });
  }

  get(name) {
    if (!this.map.has(name)) {
      this.map.set(name, { img: placeholder(name, 1200, 800), w: 1200, h: 800, missing: true, meta: {} });
    }
    return this.map.get(name);
  }
  has(name) { return this.map.has(name) && !this.map.get(name).missing; }

  // silhouette of an image in a flat colour
  silhouette(name, color = '#000') {
    const key = `sil:${name}:${color}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const a = this.get(name);
    const c = makeCanvas(a.w, a.h), x = c.getContext('2d');
    x.drawImage(a.img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color; x.fillRect(0, 0, a.w, a.h);
    this.cache.set(key, c);
    return c;
  }

  // soft blurred shadow canvas (padded), drawn centred on the image box
  shadow(name, blur = 18) {
    const key = `shadow:${name}:${blur}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const a = this.get(name);
    const pad = blur * 3;
    const c = makeCanvas(a.w + pad * 2, a.h + pad * 2), x = c.getContext('2d');
    x.filter = `blur(${blur}px)`;
    x.drawImage(this.silhouette(name, '#1a1006'), pad, pad);
    const out = { canvas: c, pad };
    this.cache.set(key, out);
    return out;
  }
}

// Clear, obviously-temporary placeholder: dashed box + file name.
export function placeholder(name, w, h) {
  const c = makeCanvas(w, h), x = c.getContext('2d');
  x.fillStyle = 'rgba(255,250,235,0.35)';
  x.fillRect(0, 0, w, h);
  x.setLineDash([22, 14]);
  x.lineWidth = 6;
  x.strokeStyle = 'rgba(160,40,20,0.85)';
  x.strokeRect(6, 6, w - 12, h - 12);
  x.setLineDash([]);
  x.fillStyle = 'rgba(160,40,20,0.9)';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const fs = Math.max(28, Math.min(64, w / 14));
  x.font = `${fs}px "Special Elite", monospace`;
  x.fillText('PLACEHOLDER', w / 2, h / 2 - fs * 0.8);
  x.fillText(name + '.png', w / 2, h / 2 + fs * 0.5);
  return c;
}
