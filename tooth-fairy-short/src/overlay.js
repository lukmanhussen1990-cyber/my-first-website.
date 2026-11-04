// Captions (bold white, dark outline, one coral keyword) and the navy label
// cards that drop in from the top with a small bounce.
import * as THREE from 'three';
import { CAPTIONS, CARDS, CUTS, FPS } from './timeline.js';
import { mk, paperCanvas } from './tex.js';
import { dropBounce, clamp, eOut } from './util.js';

const CORAL = '#ff8f6b';
const WHITE = '#ffffff';
const NAVY = '#1c2638';
const CAP_FONT = 'InterX';
const CARD_FONT = 'MontX';

function parse(text) {
  return text.split(' ').map((w) => {
    const hl = w.startsWith('*') && w.endsWith('*');
    return { w: hl ? w.slice(1, -1) : w, hl };
  });
}

export class Overlay {
  constructor(W, H) {
    this.W = W; this.H = H; this.s = W / 1080;
    this.c = mk(W, H);
    this.g = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c);
    this.tex.colorSpace = THREE.NoColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.key = '';
    this.paper = paperCanvas(256, 99, { base: 255, fibers: 600, blotch: 20, spk: 16 });
    this.lines = CAPTIONS.map((c) => this.layout(parse(c)));
  }
  layout(words) {
    const g = this.g, s = this.s;
    g.font = `800 ${66 * s}px ${CAP_FONT}`;
    const space = g.measureText(' ').width;
    const widths = words.map((w) => g.measureText(w.w).width);
    const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
    const maxW = 700 * s;
    if (total <= maxW || words.length < 3) return [{ words, widths, width: total }];
    // balanced split into two lines
    let best = null;
    for (let k = 1; k < words.length; k++) {
      const w1 = widths.slice(0, k).reduce((a, b) => a + b, 0) + space * (k - 1);
      const w2 = widths.slice(k).reduce((a, b) => a + b, 0) + space * (words.length - k - 1);
      const score = Math.max(w1, w2) + (w1 < w2 ? 0 : 0.5);
      if (!best || score < best.score) best = { k, w1, w2, score };
    }
    return [
      { words: words.slice(0, best.k), widths: widths.slice(0, best.k), width: best.w1 },
      { words: words.slice(best.k), widths: widths.slice(best.k), width: best.w2 },
    ];
  }
  draw(frame, scene, black) {
    const t = frame / FPS;
    const capT = (frame - CUTS[scene]) / FPS;
    const card = CARDS.find((c) => c.scene === scene);
    const cardT = card ? t - (card.land - 0.16) : -1;
    const pop = Math.round(clamp(capT / 0.1) * 10);
    const cardKey = card && cardT > 0 ? Math.round(Math.min(cardT, 1.2) * 60) : -1;
    const key = black ? 'black' : `${scene}|${pop}|${cardKey}`;
    if (key === this.key) return;
    this.key = key;
    const g = this.g;
    g.clearRect(0, 0, this.W, this.H);
    if (black) { this.tex.needsUpdate = true; return; }
    if (card && cardT > 0) this.drawCard(card.text, cardT);
    this.drawCaption(scene, pop / 10);
    this.tex.needsUpdate = true;
  }
  drawCaption(i, pop) {
    const g = this.g, s = this.s;
    const lines = this.lines[i];
    const fs = 66 * s, lh = fs * 1.17;
    const cy = 1395 * s;
    const sc = 0.9 + 0.1 * eOut(pop);
    g.save();
    g.translate(this.W / 2, cy);
    g.scale(sc, sc);
    g.font = `800 ${fs}px ${CAP_FONT}`;
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.miterLimit = 2;
    const space = g.measureText(' ').width;
    const y0 = -((lines.length - 1) * lh) / 2;
    // pass 1: soft shadow + outline, pass 2: fill
    for (const pass of [0, 1]) {
      lines.forEach((ln, li) => {
        let x = -ln.width / 2;
        const y = y0 + li * lh;
        ln.words.forEach((w, wi) => {
          if (pass === 0) {
            g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 16 * s; g.shadowOffsetY = 5 * s;
            g.strokeStyle = 'rgba(24,18,16,0.95)'; g.lineWidth = 11 * s;
            g.strokeText(w.w, x, y);
            g.shadowColor = 'transparent';
          } else {
            g.fillStyle = w.hl ? CORAL : WHITE;
            g.fillText(w.w, x, y);
          }
          x += ln.widths[wi] + space;
        });
      });
    }
    g.restore();
  }
  drawCard(text, ct) {
    const g = this.g, s = this.s;
    const p = dropBounce(ct, 0.16, 0.075, 3.0, 7.5);
    const rest = 300 * s, start = -170 * s;
    const y = start + (rest - start) * p;
    const land = ct - 0.16;
    const rot = land > 0 ? 0.03 * Math.exp(-5 * land) * Math.sin(2 * Math.PI * 2.2 * land) : -0.02 * (ct / 0.16);
    g.save();
    g.translate(this.W / 2, y);
    g.rotate(rot);
    g.font = `700 ${116 * s}px ${CARD_FONT}`;
    g.letterSpacing = `${5 * s}px`;
    const tw = g.measureText(text).width;
    const cw = Math.max(tw + 150 * s, 600 * s), ch = 196 * s;
    // shadow + slab thickness
    g.shadowColor = 'rgba(0,0,0,0.42)'; g.shadowBlur = 34 * s; g.shadowOffsetY = 20 * s;
    g.fillStyle = '#0f1522';
    g.fillRect(-cw / 2, -ch / 2 + 9 * s, cw, ch);
    g.shadowColor = 'transparent';
    const gr = g.createLinearGradient(0, -ch / 2, 0, ch / 2);
    gr.addColorStop(0, '#26324a'); gr.addColorStop(1, NAVY);
    g.fillStyle = gr;
    g.fillRect(-cw / 2, -ch / 2, cw, ch);
    // paper fibre on the card
    g.save();
    g.beginPath(); g.rect(-cw / 2, -ch / 2, cw, ch); g.clip();
    g.globalAlpha = 0.07; g.globalCompositeOperation = 'multiply';
    for (let yy = -ch / 2; yy < ch / 2; yy += 256 * s) for (let xx = -cw / 2; xx < cw / 2; xx += 256 * s) g.drawImage(this.paper, xx, yy, 256 * s, 256 * s);
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(-cw / 2, -ch / 2, cw, 4 * s);
    g.fillStyle = '#f8f5ee';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 0, 8 * s);
    g.restore();
  }
}
