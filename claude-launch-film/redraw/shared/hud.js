// Futuristic "decode" titles and HUD pieces (used by the "right one" moments in S03 and S10).
//   DecodeTitle - every letter first flickers through random machine glyphs, then locks into place with
//                 a flash and a small pop; a red/cyan RGB split shrinks to nothing as it locks; a light
//                 beam sweeps the word in step with the lock front.
//   Brackets    - four HUD corner brackets that fly in, converge on a box and lock with a flash.
// Everything is a pure function of the frame number (no state carried between frames).

const HUD_GLYPHS = 'ABCDEFGHKMNPRSTUVXYZ0123456789#%&@$/<>=+*';
function hudRand(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const hudBackOut = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

class DecodeTitle {
  // o: text, font, weight, size, x (left of the word) | cx, base, spacing (px letter-spacing), scaleX,
  //    on(k) / lock(k) / off(k) frames, fill(k, f, u) -> {css, size, pos} (u: 0..1 settle after lock),
  //    scr: {font, color, weight}, chroma: {amp, alpha, blend, cols}, beam: {t0, t1, color, glow},
  //    glow: css filter for the settled word, pop: lock scale pop
  constructor(parent, o) {
    this.o = o;
    const root = this.root = document.createElement('div');
    root.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;';
    parent.appendChild(root);
    // measure kerned letter positions with a hidden copy
    const m = document.createElement('span');
    m.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;white-space:pre;line-height:1;font-family:${o.font};` +
      `font-weight:${o.weight};font-size:${o.size}px;letter-spacing:${o.spacing || 0}px`;
    m.textContent = o.text; root.appendChild(m);
    const node = m.firstChild, r0 = m.getBoundingClientRect(), rg = document.createRange();
    const box = k => { rg.setStart(node, k); rg.setEnd(node, k + 1); return rg.getBoundingClientRect(); };
    const probe = document.createElement('span'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    m.appendChild(probe); this.bOff = probe.getBoundingClientRect().top - r0.top; m.removeChild(probe);
    this.width = r0.width;
    this.chars = Array.from(o.text).map((c, k) => { const b = box(k); return { c, x: b.left - r0.left, w: b.width }; })
                       .filter(ch => ch.c !== ' ');
    root.removeChild(m);
    this.x0 = o.x !== undefined ? o.x : o.cx - this.width * (o.scaleX || 1) / 2;
    // layers: chroma copies (behind), main letters, beam
    const layer = (z) => { const d = document.createElement('div'); d.style.cssText = `position:absolute;left:0;top:0;z-index:${z}`; root.appendChild(d); return d; };
    this.Lc = [layer(1), layer(1)]; this.Lm = layer(2);
    const mk = (L) => this.chars.map(ch => {
      const s = document.createElement('span');
      s.style.cssText = `position:absolute;white-space:pre;line-height:1;padding:${0.12 * o.size}px 0 ${0.3 * o.size}px;` +
        `transform-origin:50% 70%;will-change:transform,opacity,filter`;
      L.appendChild(s); return s;
    });
    this.S = mk(this.Lm); this.C = [mk(this.Lc[0]), mk(this.Lc[1])];
    if (o.chroma) this.Lc.forEach(L => { L.style.mixBlendMode = o.chroma.blend || 'screen'; });
    if (o.glow) this.Lm.style.filter = o.glow;
    if (o.beam) {
      const b = this.beam = document.createElement('div');
      b.style.cssText = `position:absolute;z-index:3;width:3px;border-radius:3px;pointer-events:none;` +
        `background:linear-gradient(180deg, rgba(255,255,255,0), ${o.beam.color} 22%, #fff 50%, ${o.beam.color} 78%, rgba(255,255,255,0));` +
        `box-shadow:0 0 18px 4px ${o.beam.glow}, 0 0 46px 10px ${o.beam.glow}`;
      root.appendChild(b);
      const w = this.wash = document.createElement('div');
      w.style.cssText = 'position:absolute;z-index:0;pointer-events:none;mix-blend-mode:screen';
      root.appendChild(w);
    }
  }
  render(f, opts = {}) {
    const o = this.o, sx = o.scaleX || 1, top = o.base - this.bOff - 0.12 * o.size;
    const S = opts.scale || 1;
    this.root.style.transformOrigin = `${(o.cx !== undefined ? o.cx : this.x0).toFixed(2)}px ${o.base}px`;
    this.root.style.transform = `scale(${(S * sx).toFixed(5)}, ${S.toFixed(5)})`;
    // with scaleX on the root, letters are laid out in unscaled units around the origin
    const ox = o.cx !== undefined ? o.cx - this.width / 2 : this.x0;
    this.chars.forEach((ch, k) => {
      const tOn = o.on(k), tL = o.lock(k), tOff = o.off ? o.off(k) : 1e9;
      const vis = f >= tOn && f < tOff + 0.01;
      const scrambling = (f < tL) || (f >= tOff - 1.6);
      const u = clamp((f - tL) / 5), uo = clamp((f - (tOff - 1.6)) / 1.6);
      const glyph = scrambling ? HUD_GLYPHS[Math.floor(hudRand(k + 7, Math.floor(f * 1.0) + 13) * HUD_GLYPHS.length)] : ch.c;
      const cxk = ox + ch.x + ch.w / 2;
      const all = [this.S[k], this.C[0][k], this.C[1][k]];
      all.forEach(s => {
        s.style.display = vis ? 'block' : 'none';
        s.textContent = glyph;
        s.style.left = cxk.toFixed(2) + 'px'; s.style.top = top.toFixed(2) + 'px';
        if (scrambling) { s.style.fontFamily = o.scr.font; s.style.fontWeight = o.scr.weight || 600; s.style.fontSize = (o.size * (o.scr.scale || 0.82)) + 'px'; }
        else { s.style.fontFamily = o.font; s.style.fontWeight = o.weight; s.style.fontSize = o.size + 'px'; }
      });
      if (!vis) return;
      const s = this.S[k];
      // flicker while scrambling, flash + pop on lock
      const flick = scrambling ? 0.55 + 0.45 * hudRand(k + 31, Math.floor(f) + 5) : 1;
      const pop = (o.pop || 0.08) * Math.exp(-Math.pow((f - tL - 0.8) / 1.2, 2)) * (f >= tL ? 1 : 0);
      const ty = scrambling && f < tL ? (hudRand(k + 3, Math.floor(f)) - 0.5) * 0.06 * o.size : 0;
      s.style.transform = `translateX(-50%) translateY(${ty.toFixed(2)}px) scale(${(1 + pop).toFixed(4)})`;
      s.style.opacity = (flick * (1 - (f >= tOff - 1.6 ? uo : 0))).toFixed(3);
      if (scrambling) {
        s.style.background = 'none'; s.style.webkitBackgroundClip = s.style.backgroundClip = 'border-box';
        s.style.color = o.scr.color; s.style.filter = o.scr.filter || 'none';
      } else {
        const fl = o.fill(k, f, u);
        s.style.color = 'transparent'; s.style.backgroundImage = fl.css;
        s.style.backgroundSize = fl.size || '100% 100%'; s.style.backgroundPosition = fl.pos || '0 0'; s.style.backgroundRepeat = 'no-repeat';
        s.style.webkitBackgroundClip = s.style.backgroundClip = 'text';
        const flash = Math.exp(-Math.pow((f - tL) / 1.6, 2)) * (f >= tL ? 1 : 0);
        s.style.filter = flash > 0.02 ? `brightness(${(1 + (o.flash || 0.9) * flash).toFixed(3)})` : 'none';
      }
      // RGB split: wide while scrambling, closing as the letter locks
      if (o.chroma) {
        const amp = o.chroma.amp * (scrambling ? 1 : (1 - ease.outCubic(u))) * (0.6 + 0.4 * hudRand(k + 11, Math.floor(f)));
        [-1, 1].forEach((sgn, j) => {
          const c = this.C[j][k];
          c.style.color = o.chroma.cols[j]; c.style.background = 'none';
          c.style.opacity = (amp > 0.2 ? (o.chroma.alpha * flick * (1 - (f >= tOff - 1.6 ? uo : 0))) : 0).toFixed(3);
          c.style.transform = `translateX(calc(-50% + ${(sgn * amp).toFixed(2)}px)) scale(${(1 + pop).toFixed(4)})`;
        });
      } else this.C.forEach(L => { L[k].style.display = 'none'; });
    });
    // light beam riding the lock front, with a soft wash behind it
    if (this.beam) {
      const b = o.beam, p = clamp((f - b.t0) / (b.t1 - b.t0));
      const on = f >= b.t0 - 0.5 && f <= b.t1 + 1.5;
      const bx = ox - 0.04 * this.width + p * this.width * 1.08;
      const fade = Math.min(clamp((f - b.t0 + 0.5) / 1.5), 1 - clamp((f - b.t1) / 1.5));
      this.beam.style.display = on ? 'block' : 'none';
      this.beam.style.left = (bx - 1.5).toFixed(2) + 'px';
      this.beam.style.top = (o.base - 1.02 * o.size).toFixed(2) + 'px'; this.beam.style.height = (1.35 * o.size).toFixed(1) + 'px';
      this.beam.style.opacity = fade.toFixed(3);
      const ww = 0.45 * this.width;
      this.wash.style.display = (on && o.beam.wash) ? 'block' : 'none';
      this.wash.style.left = (bx - ww).toFixed(2) + 'px'; this.wash.style.width = ww.toFixed(1) + 'px';
      this.wash.style.top = (o.base - 1.0 * o.size).toFixed(2) + 'px'; this.wash.style.height = (1.3 * o.size).toFixed(1) + 'px';
      this.wash.style.background = `linear-gradient(90deg, rgba(255,255,255,0), ${b.wash || 'rgba(160,180,255,0.16)'})`;
      this.wash.style.opacity = fade.toFixed(3);
    }
  }
  box(pad = 0) {   // word box in the parent's (unscaled) coordinates
    const o = this.o, ox = o.cx !== undefined ? o.cx - this.width / 2 : this.x0;
    return { x0: ox - pad, y0: o.base - 0.78 * o.size - pad, x1: ox + this.width + pad, y1: o.base + 0.24 * o.size + pad };
  }
}

class Brackets {
  // corner brackets drawn as four L shapes; color/glow css strings, arm length and stroke in px
  constructor(parent, { color = '#fff', glow = 'rgba(160,140,255,0.8)', arm = 26, stroke = 3, z = 4 } = {}) {
    this.arm = arm; this.stroke = stroke; this.glow = glow; this.color = color;
    this.els = [0, 1, 2, 3].map(i => {
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;z-index:${z};width:${arm}px;height:${arm}px;pointer-events:none;box-sizing:border-box;` +
        `border-color:${color};border-style:solid;border-width:${i < 2 ? stroke : 0}px ${i % 2 ? stroke : 0}px ${i >= 2 ? stroke : 0}px ${i % 2 ? 0 : stroke}px;` +
        `border-radius:${['5px 0 0 0', '0 5px 0 0', '0 0 0 5px', '0 0 5px 0'][i]};filter:drop-shadow(0 0 6px ${glow})`;
      parent.appendChild(d); return d;
    });
  }
  // box {x0,y0,x1,y1}; t = converge progress 0..1 (from `spread` px outside), op opacity, flash 0..1
  render(box, { t = 1, spread = 60, op = 1, flash = 0, color = null }) {
    const e = hudBackOut(clamp(t), 2.2), d = spread * (1 - e);
    const pts = [[box.x0 - d, box.y0 - d], [box.x1 + d - this.arm, box.y0 - d], [box.x0 - d, box.y1 + d - this.arm], [box.x1 + d - this.arm, box.y1 + d - this.arm]];
    this.els.forEach((el, i) => {
      el.style.display = op > 0.01 ? 'block' : 'none';
      el.style.left = pts[i][0].toFixed(2) + 'px'; el.style.top = pts[i][1].toFixed(2) + 'px';
      el.style.opacity = op.toFixed(3);
      el.style.borderColor = color || this.color;
      el.style.filter = `drop-shadow(0 0 ${(6 + 14 * flash).toFixed(1)}px ${this.glow})` + (flash > 0.02 ? ` brightness(${(1 + 0.8 * flash).toFixed(2)})` : '');
    });
  }
}
