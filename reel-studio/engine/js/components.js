// Reusable "field journal" components. Each is an Actor; Scene gets helper
// methods (s.sprite, s.title, ...) that create the actor and register sounds.
import { W, H, clamp, lerp, ease, prog, rng, strSeed, noise1, makeCanvas, COLORS, rgba } from './util.js';
import { FONTS } from './assets.js';
import { Actor, Scene } from './timeline.js';
import {
  inkText, measure, setFont, card, tornStrip, stamp, wobblyPath, strokePartial,
  markerEllipse, checkMark, xMark, arrowHead, paperTexture, cached,
} from './draw.js';

const DEG = Math.PI / 180;
const isX = (s) => s.look === 'xray';

function keyed(keys, t, fallback) {
  if (!keys || !keys.length) return fallback;
  if (t <= keys[0][0]) return keys[0].slice(1);
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last.slice(1);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const fn = (typeof b[b.length - 1] === 'function') ? b[b.length - 1] : ease.inOutQuad;
      const u = fn((t - a[0]) / Math.max(1e-6, b[0] - a[0]));
      const out = [];
      for (let j = 1; j < a.length; j++) {
        if (typeof a[j] === 'number' && typeof b[j] === 'number') out.push(lerp(a[j], b[j], u));
      }
      return out;
    }
  }
  return fallback;
}

// ---------------------------------------------------------------- Sprite
export class Sprite extends Actor {
  constructor(scene, key, o) {
    super(o);
    this.scene = scene; this.key = key;
    const A = scene.reel.assets;
    this.xray = !!o.xray;
    this.asset = A.get(this.xray ? `xray_${key}` : key);
    if (this.xray && this.asset.missing && A.has(key)) {
      this.asset = { img: A.silhouette(key, 'rgba(200,205,200,0.55)'), w: A.get(key).w, h: A.get(key).h, missing: false };
    }
    const a = this.asset;
    const crop = o.crop || [0, 0, 1, 1];
    this.crop = crop;
    const cw = a.w * (crop[2] - crop[0]), ch = a.h * (crop[3] - crop[1]);
    this.w = o.w ?? (o.h ? o.h * cw / ch : cw);
    this.h = o.h ?? this.w * ch / cw;
    this.anchor = o.anchor || [0.5, 0.5];
    this.pulseAsset = o.pulse ? A.map.get(`pulse_${key}`) : null;
    if (o.enter && o.enter.sfx !== null) scene.sfx(this.at + (o.enter.sfxAt ?? 0), o.enter.sfx || 'whoosh', o.enter.gain ?? 0.7);
  }

  state(t) {
    const o = this.o;
    let [x, y] = keyed(o.path, t, [o.x ?? W / 2, o.y ?? H / 2]);
    let rot = (keyed(o.rotKeys, t, [o.rot ?? 0])[0]) * DEG;
    let sc = keyed(o.scaleKeys, t, [o.scale ?? 1])[0];
    let alpha = keyed(o.alphaKeys, t, [o.alpha ?? 1])[0];
    let sx = 1, sy = 1;
    if (o.enter) {
      const e = o.enter, d = e.dur ?? 0.45;
      const p = prog(t, this.at, d, e.ease || ease.outCubic);
      const dist = e.dist ?? 1100;
      const off = (1 - p) * dist;
      if (e.from === 'right') x += off; else if (e.from === 'left') x -= off;
      else if (e.from === 'top') y -= off; else if (e.from === 'bottom') y += off;
      else if (e.from === 'scale') { sc *= lerp(e.s0 ?? 0.6, 1, p); alpha *= p; }
      else if (e.from === 'fade') alpha *= p;
      else if (e.from === 'drop') { y -= (1 - ease.outBack(clamp((t - this.at) / d), 1.2)) * (e.dist ?? 220); alpha *= clamp((t - this.at) / 0.08); }
    }
    if (o.exit && t >= o.exit.at) {
      const e = o.exit, p = prog(t, e.at, e.dur ?? 0.4, e.ease || ease.inCubic);
      const dist = e.dist ?? 1100;
      if (e.to === 'right') x += p * dist; else if (e.to === 'left') x -= p * dist;
      else if (e.to === 'top') y -= p * dist; else if (e.to === 'bottom') y += p * dist;
      else if (e.to === 'fade') alpha *= 1 - p;
    }
    if (o.bob) {
      const b = o.bob, lt = t - this.at;
      y += Math.sin(lt * Math.PI * 2 * (b.freq ?? 1.1)) * (b.amp ?? 4);
      rot += Math.sin(lt * Math.PI * 2 * (b.freq ?? 1.1) + 1.3) * (b.rot ?? 0.6) * DEG;
    }
    if (o.crawl) {
      const c = o.crawl, lt = t - this.at;
      const ph = Math.sin(lt * Math.PI * 2 * (c.freq ?? 0.8));
      sx = 1 + (c.stretch ?? 0.014) * ph; sy = 1 - (c.stretch ?? 0.014) * 0.6 * ph;
    }
    if (o.wobble) { rot += noise1((t - this.at) * 2.2, strSeed(this.key)) * o.wobble * DEG; }
    return { x, y, rot, sc, alpha, sx, sy };
  }

  // bottom-centre of the sprite in world coords at time t (for shadows/attachments)
  point(t, nx, ny) {
    const st = this.state(t);
    const lx = (nx - this.anchor[0]) * this.w * st.sc * st.sx * (this.o.flip ? -1 : 1);
    const ly = (ny - this.anchor[1]) * this.h * st.sc * st.sy;
    const c = Math.cos(st.rot), s = Math.sin(st.rot);
    return [st.x + lx * c - ly * s, st.y + lx * s + ly * c];
  }

  source(t) {
    const a = this.asset;
    let img = a.img;
    if (this.pulseAsset && this.o.pulse && !this.xray) {
      const p = this.o.pulse;
      const start = p.start ?? this.at;
      if (t >= start && (p.until === undefined || t < p.until)) {
        const n = this.pulseAsset.frames.length;
        const phase = (((t - start) * (p.rate ?? 1)) % 1 + 1) % 1;
        img = this.pulseAsset.frames[Math.floor(phase * n) % n];
      }
    }
    return img;
  }

  faded(img) {
    const o = this.o, a = this.asset;
    if (!o.fadeBottom) return null;
    if (this._faded) return this._faded;
    const [c0x, c0y, c1x, c1y] = this.crop;
    const sw = Math.round((c1x - c0x) * a.w), sh = Math.round((c1y - c0y) * a.h);
    const c = makeCanvas(sw, sh), x = c.getContext('2d');
    x.drawImage(img, c0x * a.w, c0y * a.h, sw, sh, 0, 0, sw, sh);
    x.globalCompositeOperation = 'destination-out';
    const g = x.createLinearGradient(0, sh - o.fadeBottom, 0, sh);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = g; x.fillRect(0, sh - o.fadeBottom, sw, o.fadeBottom);
    this._faded = c;
    return c;
  }

  draw(ctx, t, s) {
    const st = this.state(t);
    if (st.alpha <= 0.001) return;
    const o = this.o, a = this.asset;
    let img = this.source(t);
    const [c0x, c0y, c1x, c1y] = this.crop;
    const srcX = c0x * a.w, srcY = c0y * a.h, srcW = (c1x - c0x) * a.w, srcH = (c1y - c0y) * a.h;
    const dw = this.w, dh = this.h;
    const ox = -this.anchor[0] * dw, oy = -this.anchor[1] * dh;
    const sh = o.shadow ?? (isX(s) || this.xray ? null : { ground: 0.32, drop: 0.2 });
    // ground contact shadow (world space, not rotated)
    if (sh && sh.ground && !a.missing && Math.abs(st.rot) < 25 * DEG) {
      const [bx, by] = this.point(t, 0.5, sh.groundAt ?? 0.97);
      const shw = dw * st.sc * (sh.groundW ?? 0.92), shh = Math.max(18, dh * st.sc * 0.09);
      const S = s.reel.assets.shadow(this.key, 14);
      ctx.save(); ctx.globalAlpha = sh.ground * st.alpha;
      ctx.translate(bx, by + (sh.dy ?? 4));
      ctx.drawImage(S.canvas, -shw / 2, -shh / 2, shw, shh);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(st.x, st.y); ctx.rotate(st.rot);
    ctx.scale(st.sc * st.sx * (o.flip ? -1 : 1), st.sc * st.sy);
    ctx.globalAlpha *= st.alpha;
    if (sh && sh.drop && !a.missing) {
      const S = s.reel.assets.shadow(this.key, 16);
      const k = dw / srcW;
      ctx.save(); ctx.globalAlpha *= sh.drop;
      ctx.drawImage(S.canvas, srcX, srcY, srcW + S.pad * 2, srcH + S.pad * 2,
        ox - S.pad * k + (sh.dx ?? 10), oy - S.pad * k + (sh.dy2 ?? 16), dw + S.pad * 2 * k, dh + S.pad * 2 * k);
      ctx.restore();
    }
    if (o.filter) ctx.filter = typeof o.filter === 'function' ? o.filter(t) : o.filter;
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur || 30; }
    const fd = this.faded(img);
    if (fd) ctx.drawImage(fd, 0, 0, fd.width, fd.height, ox, oy, dw, dh);
    else ctx.drawImage(img, srcX, srcY, srcW, srcH, ox, oy, dw, dh);
    ctx.restore();
    if (o.after) o.after(ctx, t, s, this, st);
  }
}

// ---------------------------------------------------------------- Title
export class Title extends Actor {
  constructor(scene, lines, o) {
    const ats = (o.at || [0]).filter((v) => typeof v === 'number');
    super({ layer: 'ui', z: 50, ...o, at: Math.min(...ats, 1e9) });
    this.scene = scene;
    const xr = isX(scene);
    this.x = o.x ?? 99; this.y = o.y ?? (272 + (scene.kickerOffset || 0));
    this.maxW = o.maxW ?? 830;
    this.lines = lines.map((ln, i) => {
      const L = typeof ln === 'string' ? { text: ln } : { ...ln };
      const single = lines.length === 1;
      const role = L.role || (i === 0 ? 'a' : 'b');
      let size = L.size ?? (single ? 200 : role === 'a' ? 128 : 178);
      const probe = makeCanvas(4, 4).getContext('2d');
      while (measure(probe, L.text, FONTS.title, size) > this.maxW && size > 60) size -= 4;
      L.size = size;
      L.color = L.color || (L.red ?? role === 'b' ? (xr ? '#d24b2f' : COLORS.red) : (xr ? COLORS.cream : COLORS.ink));
      L.at = o.at?.[i] ?? (o.at?.[0] ?? 0) + i * 0.45;
      L.ink = inkText(L.text, FONTS.title, size, L.color, { texture: xr ? 0.6 : 1 });
      return L;
    });
    let y = this.y;
    for (const L of this.lines) { L.top = y; y += L.size * 0.86 + (o.gap ?? 22); }
    this.bottom = y;
    for (const L of this.lines) scene.sfx(L.at, o.sfx || 'pop', o.gain ?? 0.55);
    if (o.strike) scene.sfx(o.strike.at, 'pen', 0.6);
  }
  draw(ctx, t, s) {
    const xr = isX(s);
    for (let i = 0; i < this.lines.length; i++) {
      const L = this.lines[i];
      if (t < L.at) continue;
      const p = prog(t, L.at, 0.14, ease.outCubic);
      const sc = lerp(1.09, 1, ease.outBack(prog(t, L.at, 0.24)));
      const capH = L.size * 0.86;
      const k = L.ink;
      ctx.save();
      ctx.globalAlpha *= p;
      let alpha = 1;
      if (this.o.strike && this.o.strike.line === i && t >= this.o.strike.at) alpha = lerp(1, 0.55, prog(t, this.o.strike.at, 0.25));
      ctx.globalAlpha *= alpha;
      const cy = L.top + capH / 2;
      ctx.translate(this.x, cy); ctx.scale(sc, sc); ctx.translate(-this.x, -cy);
      if (xr) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3; }
      else { ctx.shadowColor = 'rgba(60,35,10,0.22)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2; }
      ctx.drawImage(k.canvas, this.x - k.pad, L.top - (k.base - capH));
      ctx.restore();
      if (this.o.strike && this.o.strike.line === i && t >= this.o.strike.at) {
        const y = L.top + capH * 0.55;
        const pts = wobblyPath([[this.x - 14, y + 6], [this.x + k.width + 18, y - 8]], 4, 2, 12);
        strokePartial(ctx, pts, prog(t, this.o.strike.at, 0.22, ease.outQuad), 12, COLORS.red);
      }
    }
  }
}

// ---------------------------------------------------------------- Typewriter text
export class TypeText extends Actor {
  constructor(scene, text, o) {
    super({ layer: 'ui', z: 40, ...o });
    this.text = text;
    this.cps = o.cps ?? 20;
    this.size = o.size ?? 26;
    this.color = o.color || (isX(scene) ? 'rgba(225,220,205,0.85)' : 'rgba(48,30,12,0.88)');
    this.font = o.font || FONTS.type;
    if (o.sound !== false) {
      const n = text.replace(/\s/g, '').length;
      let k = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === ' ') continue;
        if (k++ % (o.soundEvery ?? 1) === 0) scene.sfx(this.at + i / this.cps, 'type', (o.gain ?? 0.5) * (0.8 + 0.4 * ((i * 37) % 7) / 7), { v: i % 6 });
      }
    }
  }
  draw(ctx, t) {
    const n = Math.min(this.text.length, Math.floor((t - this.at) * this.cps + 1));
    if (n <= 0) return;
    const o = this.o;
    ctx.save();
    if (o.rot) { ctx.translate(o.x, o.y); ctx.rotate(o.rot * DEG); ctx.translate(-o.x, -o.y); }
    setFont(ctx, this.font, this.size);
    ctx.letterSpacing = `${o.spacing ?? 2}px`;
    ctx.fillStyle = this.color;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'alphabetic';
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    const str = this.text.slice(0, n);
    ctx.fillText(str, o.x, o.y);
    if (o.cursor && (n < this.text.length || Math.floor(t * 2.5) % 2 === 0)) {
      const wpx = ctx.measureText(str).width;
      ctx.fillText('_', o.x + wpx + 2, o.y);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Torn paper label
export class TornLabel extends Actor {
  constructor(scene, lines, o) {
    super({ layer: 'ui', z: 45, ...o });
    this.lines = (Array.isArray(lines) ? lines : [lines]).map((l) => (typeof l === 'string' ? { text: l } : l));
    this.size = o.size ?? 64;
    const probe = makeCanvas(4, 4).getContext('2d');
    const tw = Math.max(...this.lines.map((l) => measure(probe, l.text, FONTS.title, l.size ?? this.size)));
    this.bw = Math.ceil(tw + 52);
    this.bh = Math.ceil(this.lines.reduce((a, l) => a + (l.size ?? this.size) * 0.98, 0) + 34);
    this.strip = tornStrip(this.bw, this.bh, o.seed ?? strSeed(this.lines[0].text));
    scene.sfx(this.at, o.sfx || 'slide', o.gain ?? 0.55);
  }
  draw(ctx, t) {
    const o = this.o;
    const p = prog(t, this.at, 0.22, ease.outCubic);
    ctx.save();
    ctx.globalAlpha *= clamp((t - this.at) / 0.08);
    ctx.translate(o.x, o.y);
    ctx.rotate((o.rot ?? -1.5) * DEG);
    const sc = lerp(1.12, 1, ease.outBack(p));
    ctx.scale(sc, sc);
    ctx.drawImage(this.strip.canvas, -this.strip.pad, -this.strip.pad);
    let y = 17;
    for (const l of this.lines) {
      const size = l.size ?? this.size;
      const ink = inkText(l.text, FONTS.title, size, l.color || (l.red ? COLORS.red : COLORS.ink));
      ctx.drawImage(ink.canvas, 26 - ink.pad, y - (ink.base - size * 0.86));
      y += size * 0.98;
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Red name tag + latin
export class NameTag extends Actor {
  constructor(scene, text, latin, o) {
    super({ layer: 'ui', z: 44, ...o });
    this.text = text; this.latin = latin;
    this.size = o.size ?? 54;
    const probe = makeCanvas(4, 4).getContext('2d');
    this.tw = measure(probe, text, FONTS.title, this.size, 1);
    this.bw = this.tw + 44; this.bh = this.size * 1.18;
    scene.sfx(this.at, 'slide', 0.55);
    if (latin) this.latinText = scene.add(new TypeText(scene, latin, { at: this.at + 0.32, x: o.x + 4, y: o.y + this.bh + 34, size: o.latinSize ?? 24, cps: 26, spacing: 3, gain: 0.35, soundEvery: 2, color: isX(scene) ? 'rgba(225,220,205,0.8)' : 'rgba(45,28,12,0.85)' }));
  }
  draw(ctx, t) {
    const o = this.o;
    const p = prog(t, this.at, 0.22, ease.outCubic);
    const w = this.bw * p;
    ctx.save();
    const tex = paperTexture(Math.ceil(this.bw), Math.ceil(this.bh), COLORS.red, 9, false);
    ctx.shadowColor = 'rgba(40,15,5,0.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.drawImage(tex, 0, 0, w, this.bh, o.x, o.y, w, this.bh);
    ctx.shadowColor = 'transparent';
    if (t > this.at + 0.12) {
      ctx.globalAlpha = prog(t, this.at + 0.12, 0.12);
      const ink = inkText(this.text, FONTS.title, this.size, '#f4e9d4', { spacing: 1, texture: 0.5 });
      ctx.save(); ctx.beginPath(); ctx.rect(o.x, o.y, w, this.bh); ctx.clip();
      ctx.drawImage(ink.canvas, o.x + 22 - ink.pad, o.y + this.bh / 2 + this.size * 0.43 - ink.base);
      ctx.restore();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Hanging tag on a string
export class HangTag extends Actor {
  constructor(scene, text, o) {
    super({ layer: 'world', z: 30, ...o });
    this.text = text;
    this.size = o.size ?? 58;
    const probe = makeCanvas(4, 4).getContext('2d');
    this.tw = measure(probe, text, FONTS.title, this.size);
    this.bw = Math.max(170, this.tw + 70); this.bh = this.size * 1.55;
    scene.sfx(this.at, 'slide', 0.5);
  }
  draw(ctx, t, s) {
    const o = this.o;
    let [ax, ay] = typeof o.anchor === 'function' ? o.anchor(t, s) : o.anchor;
    const lt = t - this.at;
    const th0 = o.swing ?? 0.85;
    const theta = th0 * Math.exp(-lt / 1.5) * Math.cos(lt * Math.PI * 2 * 0.85) + 0.035 * Math.sin(lt * 2.1);
    const len = o.len ?? 120;
    const enter = prog(t, this.at, 0.3, ease.outCubic);
    ctx.save();
    ctx.globalAlpha *= clamp(lt / 0.1);
    ctx.translate(ax, ay);
    ctx.rotate(theta + (1 - enter) * 0.9);
    // string
    ctx.strokeStyle = 'rgba(70,50,30,0.85)'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, len * 0.5, 0, len); ctx.stroke();
    ctx.translate(0, len);
    ctx.rotate((o.tilt ?? -6) * DEG);
    const c = card(Math.round(this.bw), Math.round(this.bh), { color: '#ede2c9', seed: 4, shadow: 0.8 });
    ctx.drawImage(c.canvas, -this.bw / 2 - c.pad, -10 - c.pad);
    // eyelet
    ctx.fillStyle = 'rgba(120,90,50,0.6)'; ctx.beginPath(); ctx.arc(0, 8, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3b2a18'; ctx.beginPath(); ctx.arc(0, 8, 4.5, 0, Math.PI * 2); ctx.fill();
    const ink = inkText(this.text, FONTS.title, this.size, o.color || COLORS.red);
    ctx.drawImage(ink.canvas, -this.tw / 2 - ink.pad, 26 + this.size * 0.86 - ink.base + 4);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Ruler (tape) with red span
export class Ruler extends Actor {
  constructor(scene, o) {
    super({ layer: o.layer || 'world', z: 25, ...o });
    this.len = o.len ?? 820; this.th = o.th ?? 120;
    scene.sfx(this.at, 'slide', 0.6);
    if (o.span) scene.sfx(o.spanAt ?? this.at + 0.5, 'pen', 0.45);
  }
  tex() {
    return cached(`ruler:${this.len}:${this.th}:${this.o.unitPx}:${this.o.units}`, () => {
      const o = this.o, L = this.len, T = this.th;
      const c = makeCanvas(L, T), x = c.getContext('2d');
      x.drawImage(paperTexture(L, T, '#dccaa2', 17, false), 0, 0);
      // woven cloth texture
      x.globalAlpha = 0.09; x.strokeStyle = '#5a4020'; x.lineWidth = 1;
      for (let i = 0; i < L; i += 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, T); x.stroke(); }
      for (let j = 0; j < T; j += 4) { x.beginPath(); x.moveTo(0, j); x.lineTo(L, j); x.stroke(); }
      x.globalAlpha = 1;
      const unit = o.unitPx ?? 100, sub = o.sub ?? 10;
      x.fillStyle = '#2f2010';
      for (let k = 0, i = 0; k <= L - 20; k += unit / sub, i++) {
        const big = i % sub === 0, mid = i % (sub / 2) === 0;
        const hgt = big ? T * 0.42 : mid ? T * 0.28 : T * 0.17;
        x.fillRect(16 + k, 0, big ? 3 : 1.6, hgt);
        if (big) {
          setFont(x, FONTS.type, 22); x.fillText(String(i / sub * (o.step ?? 1)).replace('.0', ''), 16 + k + 6, T * 0.42 + 22);
        }
      }
      setFont(x, FONTS.type, 18); x.fillStyle = 'rgba(47,32,16,0.75)';
      x.fillText(o.units || 'CM', L - 60, T - 14);
      return c;
    });
  }
  draw(ctx, t) {
    const o = this.o;
    const p = prog(t, this.at, 0.4, ease.outCubic);
    const y = o.y + (1 - p) * (o.slide ?? 420);
    ctx.save();
    ctx.translate(o.x, y); ctx.rotate((o.rot ?? 0) * DEG);
    ctx.shadowColor = 'rgba(40,25,10,0.4)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
    ctx.drawImage(this.tex(), 0, 0);
    ctx.shadowColor = 'transparent';
    if (o.span) {
      const sp = prog(t, o.spanAt ?? this.at + 0.5, 0.35, ease.outCubic);
      const unit = o.unitPx ?? 100;
      const a = 16 + o.span[0] * unit, b = 16 + o.span[1] * unit;
      ctx.fillStyle = rgba(COLORS.red, 0.85);
      ctx.fillRect(a, -2, (b - a) * sp, 12);
      ctx.fillRect(a, -12, 4, 22); if (sp > 0.98) ctx.fillRect(b - 2, -12, 4, 22);
      if (sp > 0.6 && o.spanLabel && o.labelInside) {
        ctx.globalAlpha = prog(t, (o.spanAt ?? this.at + 0.5) + 0.2, 0.2);
        const ls = o.labelSize ?? 34;
        const ink = inkText(o.spanLabel, FONTS.title, ls, COLORS.red);
        const lx = Math.min(Math.max(20, (a + b) / 2 - ink.width / 2), this.len - ink.width - 20);
        ctx.drawImage(ink.canvas, lx - ink.pad, this.th - 12 - ls * 0.86 - (ink.base - ls * 0.86));
      } else if (sp > 0.6 && o.spanLabel) {
        ctx.globalAlpha = prog(t, (o.spanAt ?? this.at + 0.5) + 0.2, 0.2);
        const ink = inkText(o.spanLabel, FONTS.title, o.labelSize ?? 46, COLORS.red);
        ctx.drawImage(ink.canvas, (a + b) / 2 - ink.width / 2 - ink.pad, -24 - (o.labelSize ?? 46) * 0.86 - (ink.base - (o.labelSize ?? 46) * 0.86));
      }
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Dimension bracket
export class Bracket extends Actor {
  constructor(scene, o) { super({ layer: 'world', z: 26, ...o }); scene.sfx(this.at, 'pen', 0.4); }
  draw(ctx, t) {
    const o = this.o, p = prog(t, this.at, 0.35, ease.outCubic);
    const [x1, y1] = o.a, [x2, y2] = o.b;
    const col = o.color || COLORS.red;
    ctx.save();
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3;
    const ang = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(ang) * 14, ny = Math.cos(ang) * 14;
    ctx.beginPath(); ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(x1 - nx, y1 - ny); ctx.stroke();
    const xe = lerp(x1, x2, p), ye = lerp(y1, y2, p);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(xe, ye); ctx.stroke();
    if (p > 0.97) { ctx.beginPath(); ctx.moveTo(x2 + nx, y2 + ny); ctx.lineTo(x2 - nx, y2 - ny); ctx.stroke(); }
    if (o.label && p > 0.5) {
      ctx.globalAlpha = prog(t, this.at + 0.2, 0.2);
      setFont(ctx, FONTS.type, o.size ?? 30); ctx.letterSpacing = '2px';
      ctx.textAlign = 'center';
      ctx.fillText(o.label, (x1 + x2) / 2 + (o.lx ?? 0), (y1 + y2) / 2 + (o.ly ?? 44));
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Checklist / status card
export class Checklist extends Actor {
  constructor(scene, o) {
    super({ layer: 'ui', z: 42, ...o });
    this.items = o.items;
    this.cw = o.w ?? 720; this.ch = o.h ?? (130 + this.items.length * 96);
    scene.sfx(this.at, 'slide', 0.6);
    for (const it of this.items) {
      scene.sfx(it.at, 'pop', 0.35);
      if (it.markAt !== undefined) scene.sfx(it.markAt, 'pen', 0.55);
      if (it.circleAt !== undefined) scene.sfx(it.circleAt, 'pen', 0.7);
      if (it.strikeAt !== undefined) scene.sfx(it.strikeAt, 'pen', 0.5);
    }
  }
  draw(ctx, t) {
    const o = this.o;
    const p = prog(t, this.at, 0.35, ease.outCubic);
    ctx.save();
    ctx.translate(o.x, o.y + (1 - p) * 500);
    ctx.rotate((o.rot ?? -1.2) * DEG);
    const c = card(this.cw, this.ch, { seed: 6 });
    ctx.drawImage(c.canvas, -c.pad, -c.pad);
    setFont(ctx, FONTS.type, 20); ctx.letterSpacing = '4px'; ctx.fillStyle = 'rgba(60,40,18,0.7)';
    ctx.fillText(o.header || 'OPTIONS', 40, 52);
    ctx.letterSpacing = '0px';
    const size = o.size ?? 54;
    this.items.forEach((it, i) => {
      if (t < it.at) return;
      const y = 110 + i * 96;
      const a = prog(t, it.at, 0.15);
      ctx.save(); ctx.globalAlpha *= a;
      // box
      ctx.strokeStyle = 'rgba(40,26,10,0.85)'; ctx.lineWidth = 4;
      ctx.strokeRect(40, y, 44, 44);
      let textAlpha = 1;
      if (it.markAt !== undefined && t >= it.markAt) {
        const mp = prog(t, it.markAt, 0.24);
        if (it.mark === 'check') checkMark(ctx, 62, y + 22, 50, mp, COLORS.ink, 7);
        else xMark(ctx, 62, y + 22, 40, mp, COLORS.redInk, 6);
      }
      if (it.strikeAt !== undefined && t >= it.strikeAt) textAlpha = lerp(1, 0.5, prog(t, it.strikeAt, 0.2));
      const ink = inkText(it.text, FONTS.title, size, it.color || COLORS.ink);
      ctx.globalAlpha *= textAlpha;
      ctx.drawImage(ink.canvas, 110 - ink.pad, y + 22 + size * 0.43 - ink.base);
      ctx.globalAlpha /= textAlpha || 1;
      if (it.strikeAt !== undefined && t >= it.strikeAt) {
        const pts = wobblyPath([[104, y + 26], [116 + ink.width, y + 18]], 11 + i, 1.6, 10);
        strokePartial(ctx, pts, prog(t, it.strikeAt, 0.22), it.bigStrike ? 9 : 6, COLORS.red);
        if (it.bigStrike) {
          const pts2 = wobblyPath([[96, y + 52], [this.cw - 40, y - 8]], 21 + i, 2, 12);
          strokePartial(ctx, pts2, prog(t, it.strikeAt + 0.15, 0.25), 7, COLORS.red);
        }
      }
      if (it.circleAt !== undefined && t >= it.circleAt) {
        markerEllipse(ctx, 110 + ink.width / 2, y + 22, ink.width / 2 + 46, 50, prog(t, it.circleAt, 0.45, ease.inOutQuad), { width: 6, seed: 3 + i });
      }
      ctx.restore();
    });
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Terminal box with progress
export class Terminal extends Actor {
  constructor(scene, text, o) {
    super({ layer: 'ui', z: 46, ...o });
    this.text = text; this.cps = o.cps ?? 16;
    this.barAt = o.barAt ?? this.at + text.length / this.cps + 0.15;
    this.barDur = o.barDur ?? 1.0;
    this.bw = o.w ?? 600; this.bh = o.h ?? 168;
    scene.sfx(this.at - 0.02, 'slide', 0.45);
    for (let i = 0; i < text.length; i++) if (text[i] !== ' ') scene.sfx(this.at + i / this.cps, 'type', 0.42, { v: i % 6 });
    for (let k = 1; k <= 8; k++) scene.sfx(this.barAt + (k / 8) * this.barDur * 0.98, 'tick', 0.25);
    scene.sfx(this.barAt + this.barDur, 'beep', 0.55);
  }
  done(t) { return t >= this.barAt + this.barDur; }
  draw(ctx, t, s) {
    const o = this.o;
    const p = prog(t, this.at - 0.15, 0.25, ease.outCubic);
    ctx.save();
    ctx.translate(o.x, o.y - (1 - p) * 40); ctx.globalAlpha *= p;
    ctx.rotate((o.rot ?? -1) * DEG);
    const c = card(this.bw, this.bh, { color: '#e6dcc4', seed: 12 });
    ctx.drawImage(c.canvas, -c.pad, -c.pad);
    const n = Math.max(0, Math.min(this.text.length, Math.floor((t - this.at) * this.cps + 1)));
    setFont(ctx, FONTS.monoBold, 38); ctx.fillStyle = '#21170c';
    const str = '> ' + this.text.slice(0, n);
    ctx.fillText(str, 34, 66);
    if (Math.floor(t * 2.6) % 2 === 0 || n < this.text.length) ctx.fillText('_', 34 + ctx.measureText(str).width + 2, 66);
    // bar
    const bp = prog(t, this.barAt, this.barDur, ease.inOutQuad);
    const full = bp >= 1;
    const bx = 34, by = 100, bw = this.bw - 160, bh = 34;
    ctx.strokeStyle = '#21170c'; ctx.lineWidth = 3; ctx.strokeRect(bx, by, bw, bh);
    const segs = 22, segW = (bw - 8) / segs;
    const filled = Math.floor(bp * segs + 1e-6);
    ctx.fillStyle = full ? COLORS.red : '#2a1d10';
    for (let i = 0; i < filled; i++) ctx.fillRect(bx + 4 + i * segW + 1.5, by + 5, segW - 3, bh - 10);
    setFont(ctx, FONTS.monoBold, 32); ctx.fillStyle = full ? COLORS.red : '#21170c';
    ctx.fillText(`${Math.round(bp * 100)}%`, bx + bw + 16, by + 28);
    ctx.restore();
    // wires to targets
    if (o.wires && t >= this.at + 0.2) {
      for (const [k, w] of o.wires.entries()) {
        let pts = typeof w === 'function' ? w(t, s) : w;
        if (o.worldEnd !== false) { const e = s.toScreen(pts[pts.length - 1]); pts = [...pts.slice(0, -2), [e[0], pts[pts.length - 2][1]], e]; }
        const wp = prog(t, this.at + 0.25 + k * 0.08, 0.6, ease.outQuad);
        strokePartial(ctx, pts, wp, 3, full ? COLORS.red : (isX(s) ? 'rgba(225,220,205,0.75)' : 'rgba(33,23,12,0.8)'));
        if (wp >= 1) {
          const [ex, ey] = pts[pts.length - 1];
          ctx.fillStyle = full ? COLORS.red : (isX(s) ? 'rgba(225,220,205,0.85)' : '#21170c');
          ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }
}

// ---------------------------------------------------------------- Rubber stamp (slams in)
export class Stamp extends Actor {
  constructor(scene, text, o) {
    super({ layer: 'ui', z: 70, ...o });
    this.st = stamp(text, { size: o.size ?? 110, color: o.color });
    scene.sfx(this.at + 0.1, 'stamp', o.gain ?? 1);
    scene.shake(this.at + 0.1, 0.2, o.shake ?? 10);
  }
  draw(ctx, t) {
    const o = this.o, lt = t - this.at;
    const fall = clamp(lt / 0.1);
    const sc = lt < 0.1 ? lerp(1.9, 1, ease.inQuad(fall)) : 1 + 0.03 * Math.exp(-(lt - 0.1) * 18) * Math.sin((lt - 0.1) * 60);
    ctx.save();
    ctx.globalAlpha *= clamp(lt / 0.06) * (o.alpha ?? 0.92);
    ctx.translate(o.x, o.y); ctx.rotate((o.rot ?? -8) * DEG); ctx.scale(sc, sc);
    if (lt < 0.1) ctx.filter = `blur(${(1 - fall) * 6}px)`;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.st.canvas, -this.st.w / 2, -this.st.h / 2);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Magnifier
export class Magnifier extends Actor {
  constructor(scene, o) {
    super({ layer: 'ui', z: 60, ...o });
    this.r = o.r ?? 170; this.zoom = o.zoom ?? 2.2;
    scene.sfx(this.at, 'slide', 0.6);
    if (o.label) this.labelAt = o.labelAt ?? this.at + 0.55;
  }
  center(t) {
    const o = this.o;
    const p = prog(t, this.at, o.dur ?? 0.55, ease.outCubic);
    const [x0, y0] = o.from || [W + 260, o.to[1] + 260];
    return [lerp(x0, o.to[0], p), lerp(y0, o.to[1], p)];
  }
  draw(ctx, t, s) {
    const o = this.o, R = this.r;
    const [cx, cy] = this.center(t);
    const ang = (o.handleAngle ?? 45) * DEG;
    ctx.save();
    // shadow
    ctx.save(); ctx.filter = 'blur(14px)'; ctx.fillStyle = 'rgba(30,18,6,0.35)';
    ctx.beginPath(); ctx.arc(cx + 18, cy + 26, R + 16, 0, Math.PI * 2); ctx.fill();
    ctx.translate(cx + 18, cy + 26); ctx.rotate(ang); ctx.fillRect(R + 6, -20, 250, 40); ctx.restore();
    // handle
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    const hg = ctx.createLinearGradient(0, -19, 0, 19);
    hg.addColorStop(0, '#6b4024'); hg.addColorStop(0.45, '#4a2814'); hg.addColorStop(1, '#2a160a');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(R + 40, -19, 230, 38, 16); ctx.fill();
    const fg = ctx.createLinearGradient(0, -16, 0, 16);
    fg.addColorStop(0, '#d8b46a'); fg.addColorStop(0.5, '#8c6a2e'); fg.addColorStop(1, '#5a4218');
    ctx.fillStyle = fg; ctx.fillRect(R + 6, -15, 40, 30);
    ctx.restore();
    // lens content
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    if (o.image) {
      const a = s.reel.assets.get(o.image);
      const reg = o.region || [0, 0, 1, 1];
      ctx.fillStyle = isX(s) ? '#20201b' : '#d9c7a2'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      const sw = (reg[2] - reg[0]) * a.w, sh = (reg[3] - reg[1]) * a.h;
      const k = Math.max((R * 2) / sw, (R * 2) / sh);
      ctx.drawImage(a.img, reg[0] * a.w, reg[1] * a.h, sw, sh, cx - (sw * k) / 2, cy - (sh * k) / 2, sw * k, sh * k);
    } else {
      // magnify the already-rendered world layer around a focus point
      const [fx, fy] = o.focus ? s.toScreen(typeof o.focus === 'function' ? o.focus(t, s) : o.focus) : [cx, cy];
      const src = R / this.zoom;
      ctx.drawImage(s.reel.world, fx - src, fy - src, src * 2, src * 2, cx - R, cy - R, R * 2, R * 2);
    }
    if (o.drawInside) o.drawInside(ctx, t, s, cx, cy, R);
    // glass tint + highlight
    const gg = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    gg.addColorStop(0, 'rgba(255,255,255,0.18)'); gg.addColorStop(0.6, 'rgba(255,255,255,0.02)'); gg.addColorStop(1, 'rgba(60,40,20,0.22)');
    ctx.fillStyle = gg; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.82, -2.6, -1.9); ctx.stroke();
    // brass rim
    const rg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    rg.addColorStop(0, '#f0d38c'); rg.addColorStop(0.35, '#b28a3e'); rg.addColorStop(0.7, '#7a5a22'); rg.addColorStop(1, '#4e3812');
    ctx.strokeStyle = rg; ctx.lineWidth = 20; ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,25,8,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R - 1, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (o.label && t >= this.labelAt) {
      const lp = prog(t, this.labelAt, 0.2);
      ctx.save(); ctx.globalAlpha *= lp;
      const [lx, ly] = o.labelPos || [cx - R - 150, cy - R + 10];
      const ink = inkText(o.label, FONTS.title, 52, COLORS.red);
      ctx.drawImage(ink.canvas, lx - ink.pad, ly - ink.base + 45);
      ctx.strokeStyle = COLORS.red; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(lx + ink.width + 10, ly + 24); ctx.lineTo(cx - R * 0.72, cy - R * 0.55); ctx.stroke();
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- Flip day counter
export class DayCounter extends Actor {
  constructor(scene, o) {
    super({ layer: 'ui', z: 48, ...o });
    this.from = o.from ?? 1; this.to = o.to ?? 13;
    this.countAt = o.countAt ?? this.at + 0.4; this.countDur = o.countDur ?? 1.6;
    scene.sfx(this.at, 'slide', 0.5);
    const steps = this.to - this.from;
    for (let i = 1; i <= steps; i++) scene.sfx(this.countAt + (i / steps) * this.countDur - 0.06, 'flip', 0.5);
  }
  value(t) {
    const steps = this.to - this.from;
    const p = clamp((t - this.countAt) / this.countDur);
    return { v: this.from + Math.floor(p * steps + 1e-6), frac: (p * steps) % 1, done: p >= 1 };
  }
  draw(ctx, t) {
    const o = this.o;
    const p = prog(t, this.at, 0.25, ease.outBack);
    const strip = tornStrip(250, 190, 77, '#e4d6b6');
    ctx.save();
    ctx.translate(o.x, o.y); ctx.rotate((o.rot ?? 2) * DEG);
    ctx.scale(lerp(0.7, 1, p), lerp(0.7, 1, p)); ctx.globalAlpha *= clamp((t - this.at) / 0.1);
    ctx.drawImage(strip.canvas, -125 - strip.pad, -95 - strip.pad);
    setFont(ctx, FONTS.type, 24); ctx.letterSpacing = '6px'; ctx.fillStyle = 'rgba(45,30,14,0.85)';
    ctx.textAlign = 'center'; ctx.fillText('DAY', 0, -54);
    ctx.letterSpacing = '0px';
    const { v, frac } = this.value(t);
    const prevV = Math.max(this.from, v - 1);
    const digits = String(v).padStart(2, '0'), pd = String(prevV).padStart(2, '0');
    const flipP = (t >= this.countAt && v > this.from && frac < 0.0001) ? 1 : clamp(((t - this.countAt) % (this.countDur / Math.max(1, this.to - this.from))) / 0.12);
    for (let i = 0; i < 2; i++) {
      const x = -92 + i * 96;
      this.tile(ctx, x, -32, digits[i], pd[i], digits[i] !== pd[i] && t < this.countAt + this.countDur + 0.2 ? flipP : 1);
    }
    ctx.restore();
  }
  tile(ctx, x, y, d, pd, p) {
    const w = 88, h = 116;
    ctx.save();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#f1e7d0'); g.addColorStop(1, '#d8c9a8');
    ctx.fillStyle = g; ctx.strokeStyle = '#3a2814'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.stroke();
    setFont(ctx, FONTS.title, 92); ctx.fillStyle = '#21170c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // bottom half shows new digit, top half old until flap passes
    ctx.save(); ctx.beginPath(); ctx.rect(x, y + h / 2, w, h / 2); ctx.clip(); ctx.fillText(p < 0.5 ? pd : d, x + w / 2, y + h / 2 + 4); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h / 2); ctx.clip(); ctx.fillText(d, x + w / 2, y + h / 2 + 4); ctx.restore();
    if (p < 1) {
      // falling flap
      const k = Math.cos(p * Math.PI);
      ctx.save(); ctx.translate(0, y + h / 2); ctx.scale(1, k); ctx.translate(0, -(y + h / 2));
      ctx.fillStyle = '#ece0c6'; ctx.fillRect(x + 2, p < 0.5 ? y + 2 : y + h / 2, w - 4, h / 2 - 2);
      ctx.beginPath(); ctx.rect(x, p < 0.5 ? y : y + h / 2, w, h / 2); ctx.clip();
      ctx.fillStyle = '#21170c'; ctx.fillText(p < 0.5 ? pd : d, x + w / 2, y + h / 2 + 4);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(40,25,10,0.55)'; ctx.fillRect(x + 3, y + h / 2 - 1.5, w - 6, 3);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Heart monitor
export class Monitor extends Actor {
  constructor(scene, o) {
    super({ layer: 'ui', z: 47, ...o });
    this.bw = o.w ?? 460; this.bh = o.h ?? 250;
    scene.sfx(this.at, 'slide', 0.5);
  }
  draw(ctx, t, s) {
    const o = this.o;
    const p = prog(t, this.at, 0.3, ease.outCubic);
    const off = o.offAt !== undefined && t >= o.offAt;
    ctx.save();
    ctx.translate(o.x + (1 - p) * 520, o.y); ctx.rotate((o.rot ?? 1.5) * DEG);
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#1c1c17'; ctx.beginPath(); ctx.roundRect(0, 0, this.bw, this.bh, 18); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#4a4436'; ctx.lineWidth = 5; ctx.stroke();
    // screen grid
    ctx.save(); ctx.beginPath(); ctx.roundRect(14, 14, this.bw - 28, this.bh - 28, 10); ctx.clip();
    ctx.fillStyle = '#121310'; ctx.fillRect(0, 0, this.bw, this.bh);
    ctx.strokeStyle = 'rgba(120,160,120,0.12)'; ctx.lineWidth = 1;
    for (let x = 14; x < this.bw; x += 26) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.bh); ctx.stroke(); }
    for (let y = 14; y < this.bh; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.bw, y); ctx.stroke(); }
    // trace
    const rate = o.rate ?? 1.0, base = this.bh * 0.62, amp = this.bh * 0.3;
    const wave = (u) => {
      // ECG-like beat shape for phase u in [0,1)
      const k = u % 1;
      if (k < 0.08) return Math.sin(k / 0.08 * Math.PI) * 0.12;
      if (k < 0.12) return -0.15;
      if (k < 0.16) return 1.0;
      if (k < 0.2) return -0.35;
      if (k < 0.34) return Math.sin((k - 0.2) / 0.14 * Math.PI) * 0.18;
      return 0;
    };
    ctx.beginPath();
    const span = 2.2; // seconds visible
    for (let x = 14; x <= this.bw - 14; x += 3) {
      const tt = t - span + ((x - 14) / (this.bw - 28)) * span;
      const flat = off && tt >= o.offAt;
      const v = flat || tt < this.at ? 0 : wave((tt - (o.phase ?? 0)) * rate);
      const y = base - v * amp;
      x === 14 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = off ? 'rgba(210,75,47,0.95)' : '#ff6b3d'; ctx.lineWidth = 4;
    ctx.shadowColor = '#ff6b3d'; ctx.shadowBlur = 14; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    setFont(ctx, FONTS.type, 22); ctx.letterSpacing = '4px'; ctx.fillStyle = 'rgba(225,220,205,0.75)';
    ctx.fillText(off ? 'PULSE: OFF' : (o.label || 'PULSE'), 34, 52);
    ctx.letterSpacing = '0px';
    const big = off ? (o.offText || '0 / MIN') : (o.text || '40–80 / MIN');
    setFont(ctx, FONTS.title, 58); ctx.fillStyle = off ? '#d24b2f' : '#efe6d2';
    ctx.textAlign = 'right'; ctx.fillText(big, this.bw - 30, 60);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Bar chart card
export class BarChart extends Actor {
  constructor(scene, o) {
    super({ layer: 'ui', z: 42, ...o });
    this.cw = o.w ?? 800; this.ch = o.h ?? 640;
    scene.sfx(this.at, 'slide', 0.6);
    o.bars.forEach((b, i) => { for (let k = 1; k <= 6; k++) scene.sfx((b.at ?? this.at + 0.4 + i * 0.5) + k * 0.1, 'tick', 0.22); });
    if (o.note) this.noteText = scene.add(new TypeText(scene, o.note, { at: o.noteAt ?? this.at + 1.2, x: o.x + 44, y: o.y + this.ch - 44, size: 24, cps: 30, gain: 0.3, soundEvery: 2, z: 43, rot: o.rot ?? -1 }));
  }
  draw(ctx, t) {
    const o = this.o;
    const p = prog(t, this.at, 0.35, ease.outCubic);
    ctx.save();
    ctx.translate(o.x, o.y + (1 - p) * 600); ctx.rotate((o.rot ?? -1) * DEG);
    const c = card(this.cw, this.ch, { seed: 14 });
    ctx.drawImage(c.canvas, -c.pad, -c.pad);
    const ink = inkText(o.title || 'FULLY IN THE OPEN', FONTS.title, 52, COLORS.ink);
    ctx.drawImage(ink.canvas, 44 - ink.pad, 40 + 52 * 0.86 - ink.base);
    const baseY = this.ch - 120, maxH = this.ch - 300;
    ctx.fillStyle = 'rgba(40,26,10,0.7)'; ctx.fillRect(40, baseY, this.cw - 80, 4);
    o.bars.forEach((b, i) => {
      const at = b.at ?? this.at + 0.4 + i * 0.5;
      const bp = prog(t, at, 0.8, ease.outCubic);
      const bw = 210, bx = 90 + i * 330;
      const h = maxH * (b.value / 100) * bp;
      if (t >= at) {
        const tex = paperTexture(bw, Math.max(1, Math.ceil(maxH)), b.color || COLORS.red, 20 + i, false);
        ctx.drawImage(tex, 0, 0, bw, Math.max(1, h), bx, baseY - h, bw, Math.max(1, h));
        setFont(ctx, FONTS.title, 72); ctx.fillStyle = b.color || COLORS.red; ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(b.value * bp)}%`, bx + bw / 2, baseY - h - 18);
        setFont(ctx, FONTS.title, 40); ctx.fillStyle = COLORS.ink;
        ctx.fillText(b.label, bx + bw / 2, baseY + 50);
        ctx.textAlign = 'left';
      }
    });
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Colour swatches
export class Swatches extends Actor {
  constructor(scene, o) {
    super({ layer: 'ui', z: 41, ...o });
    o.items.forEach((it) => scene.sfx(it.at, 'slide', 0.4));
  }
  draw(ctx, t) {
    for (const it of this.o.items) {
      if (t < it.at) continue;
      const p = prog(t, it.at, 0.28, ease.outBack);
      const s = it.size ?? 170;
      ctx.save();
      ctx.translate(it.x, it.y - (1 - p) * 60);
      ctx.rotate(((it.rot ?? 0) + (1 - p) * 14) * DEG);
      ctx.globalAlpha *= clamp((t - it.at) / 0.08);
      const c = card(s + 28, s + 70, { color: '#f1e8d6', seed: strSeed(it.label) % 50 });
      ctx.drawImage(c.canvas, -c.pad - (s + 28) / 2, -c.pad - (s + 70) / 2);
      ctx.drawImage(paperTexture(s, s, it.color, strSeed(it.color) % 40, false), -s / 2, -(s + 70) / 2 + 14);
      setFont(ctx, FONTS.type, 22); ctx.letterSpacing = '3px'; ctx.fillStyle = 'rgba(45,30,14,0.85)';
      ctx.textAlign = 'center'; ctx.fillText(it.label, 0, (s + 70) / 2 - 18);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- Film ticket (tears in two)
export class Ticket extends Actor {
  constructor(scene, o) {
    super({ layer: 'ui', z: 40, ...o });
    this.tw = 760; this.th = 360;
    scene.sfx(this.at, 'slide', 0.6);
    if (o.tearAt) scene.sfx(o.tearAt, 'rip', 0.9);
  }
  tex() {
    return cached('ticket:' + (this.o.title || ''), () => {
      const c = makeCanvas(this.tw, this.th), x = c.getContext('2d');
      x.drawImage(paperTexture(this.tw, this.th, '#e9dfc7', 33), 0, 0);
      x.strokeStyle = 'rgba(70,45,20,0.6)'; x.lineWidth = 2; x.setLineDash([8, 7]);
      x.beginPath(); x.moveTo(560, 20); x.lineTo(560, this.th - 20); x.stroke(); x.setLineDash([]);
      setFont(x, FONTS.type, 22); x.letterSpacing = '4px'; x.fillStyle = 'rgba(50,32,14,0.8)';
      x.fillText(this.o.kicker || 'ADMIT ONE', 40, 64);
      const ink = inkText(this.o.title || 'HORROR', FONTS.title, 120, COLORS.ink);
      x.drawImage(ink.canvas, 36 - ink.pad, 100 + 120 * 0.86 - ink.base);
      x.letterSpacing = '6px'; setFont(x, FONTS.type, 26);
      x.fillText(this.o.sub || 'NIGHT SHOW', 42, 280);
      setFont(x, FONTS.type, 20); x.letterSpacing = '2px';
      x.fillText('ROW F · SEAT 13', 42, 320);
      x.save(); x.translate(660, this.th / 2); x.rotate(-Math.PI / 2); x.textAlign = 'center';
      setFont(x, FONTS.type, 24); x.fillText('No. 000666', 0, 8); x.restore();
      // scalloped edges
      x.globalCompositeOperation = 'destination-out';
      for (let y = 18; y < this.th; y += 36) { x.beginPath(); x.arc(0, y, 9, 0, Math.PI * 2); x.arc(this.tw, y, 9, 0, Math.PI * 2); x.fill(); }
      return c;
    });
  }
  draw(ctx, t) {
    const o = this.o;
    const p = prog(t, this.at, 0.35, ease.outCubic);
    const tex = this.tex();
    ctx.save();
    ctx.translate(o.x, o.y); ctx.rotate(((o.rot ?? -4) + (1 - p) * -18) * DEG);
    ctx.translate(-(1 - p) * 700, 0);
    const tearP = o.tearAt ? prog(t, o.tearAt, 0.3, ease.outCubic) : 0;
    const cut = 470;
    ctx.shadowColor = 'rgba(40,25,10,0.4)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10;
    // left piece
    ctx.save(); ctx.translate(-tearP * 30, tearP * 10); ctx.rotate(-tearP * 3 * DEG);
    ctx.beginPath(); ctx.moveTo(-this.tw / 2, -this.th / 2);
    const r = rng(9); const jag = []; for (let y = -this.th / 2; y <= this.th / 2; y += 14) jag.push([cut - this.tw / 2 + (r() - 0.5) * 22, y]);
    ctx.lineTo(jag[0][0], -this.th / 2); for (const [jx, jy] of jag) ctx.lineTo(jx, jy);
    ctx.lineTo(-this.tw / 2, this.th / 2); ctx.closePath(); ctx.clip();
    ctx.drawImage(tex, -this.tw / 2, -this.th / 2); ctx.restore();
    // right piece
    ctx.save(); ctx.translate(tearP * 120, tearP * 40); ctx.rotate(tearP * 14 * DEG);
    ctx.beginPath(); ctx.moveTo(this.tw / 2, -this.th / 2); ctx.lineTo(jag[0][0], -this.th / 2);
    for (const [jx, jy] of jag) ctx.lineTo(jx, jy);
    ctx.lineTo(this.tw / 2, this.th / 2); ctx.closePath(); ctx.clip();
    ctx.drawImage(tex, -this.tw / 2, -this.th / 2); ctx.restore();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Glowing tube network (X-ray)
export class Glow extends Actor {
  constructor(scene, o) {
    super({ layer: 'world', z: 20, ...o });
    // o.paths: [{pts, at, dur, width}]
    if (o.sfx !== false) scene.sfx(this.at, 'hum', o.gain ?? 0.5);
  }
  draw(ctx, t, s) {
    const o = this.o;
    const flick = 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of o.paths) {
      const pts = typeof p.pts === 'function' ? p.pts(t, s) : p.pts;
      const pr = prog(t, p.at ?? this.at, p.dur ?? 1.2, p.ease || ease.inOutQuad);
      if (pr <= 0) continue;
      const wdt = p.width ?? 14;
      strokePartial(ctx, pts, pr, wdt * 2.6, `rgba(255,90,30,${0.16 * flick})`, { shadow: 'rgba(255,90,30,0.9)', shadowBlur: 34 });
      strokePartial(ctx, pts, pr, wdt, `rgba(255,140,60,${0.55 * flick})`);
      strokePartial(ctx, pts, pr, wdt * 0.38, `rgba(255,230,190,${0.9 * flick})`);
    }
    ctx.restore();
  }
}

// glowing blob/egg
export function glowDot(ctx, x, y, r, a = 1, color = [255, 120, 50]) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, `rgba(255,236,200,${a})`);
  g.addColorStop(0.25, `rgba(${color[0]},${color[1]},${color[2]},${0.75 * a})`);
  g.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------- Red target rings
export class Target extends Actor {
  constructor(scene, o) { super({ layer: 'world', z: 35, ...o }); if (o.sfx !== false) scene.sfx(this.at, o.sfx || 'beep', o.gain ?? 0.35); }
  draw(ctx, t, s) {
    const o = this.o;
    const [x, y] = typeof o.pos === 'function' ? o.pos(t, s) : o.pos;
    const p = prog(t, this.at, 0.35, ease.outCubic);
    const r = o.r ?? 60;
    const pulse = 1 + 0.06 * Math.sin((t - this.at) * 6);
    ctx.save();
    ctx.strokeStyle = o.color || '#e0482c'; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(230,70,40,0.6)'; ctx.shadowBlur = isX(s) ? 12 : 0;
    ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, r * pulse, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * 1.38 * pulse, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
    if (o.cross !== false && p > 0.6) {
      ctx.globalAlpha *= prog(t, this.at + 0.2, 0.2);
      ctx.lineWidth = 3;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.beginPath(); ctx.moveTo(x + dx * r * 0.55, y + dy * r * 0.55); ctx.lineTo(x + dx * r * 1.7, y + dy * r * 1.7); ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Big faded number behind
export class BigNumber extends Actor {
  constructor(scene, text, o) { super({ layer: 'bg', z: 1, ...o }); this.text = text; scene.sfx(this.at, 'whoosh', 0.35); }
  draw(ctx, t, s) {
    const o = this.o;
    const p = prog(t, this.at, 0.5, ease.outCubic);
    const size = o.size ?? 760;
    ctx.save();
    ctx.globalAlpha *= p * (o.alpha ?? (isX(s) ? 0.2 : 0.3));
    const ink = inkText(this.text, FONTS.title, size, o.color || (isX(s) ? '#d24b2f' : '#d98a6c'), { texture: 0.4 });
    const sc = lerp(1.15, 1, p);
    ctx.translate(o.x, o.y); ctx.scale(sc, sc);
    ctx.drawImage(ink.canvas, -ink.width / 2 - ink.pad, -size * 0.43 - (ink.base - size * 0.86));
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Red cracks (impact)
export class Cracks extends Actor {
  constructor(scene, o) {
    super({ layer: 'world', z: 65, ...o });
    const r = rng(o.seed ?? 4);
    this.lines = [];
    for (let i = 0; i < (o.count ?? 7); i++) {
      const a = (i / (o.count ?? 7)) * Math.PI * 2 + r() * 0.5;
      const pts = [[0, 0]]; let x = 0, y = 0, ang = a;
      const len = (o.len ?? 220) * (0.6 + r() * 0.6);
      for (let k = 0; k < 6; k++) { ang += (r() - 0.5) * 0.7; x += Math.cos(ang) * len / 6; y += Math.sin(ang) * len / 6; pts.push([x, y]); }
      this.lines.push(pts);
    }
    scene.sfx(this.at, 'crack', o.gain ?? 0.9);
  }
  draw(ctx, t) {
    const o = this.o, p = prog(t, this.at, 0.14, ease.outQuad);
    ctx.save(); ctx.translate(o.x, o.y);
    for (const l of this.lines) strokePartial(ctx, l, p, o.width ?? 6, COLORS.red);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Dashed arrow
export class Arrow extends Actor {
  constructor(scene, o) { super({ layer: 'ui', z: 38, ...o }); if (o.sfx !== false) scene.sfx(this.at, 'pen', o.gain ?? 0.35); }
  draw(ctx, t) {
    const o = this.o;
    const pts = o.pts;
    const p = prog(t, this.at, o.dur ?? 0.4, ease.inOutQuad);
    strokePartial(ctx, pts, p, o.width ?? 5, o.color || COLORS.red, { dash: o.dash === false ? undefined : [16, 12] });
    if (p >= 0.98) {
      const [x1, y1] = pts[pts.length - 2], [x2, y2] = pts[pts.length - 1];
      arrowHead(ctx, x2, y2, Math.atan2(y2 - y1, x2 - x1), o.head ?? 26, o.color || COLORS.red);
    }
  }
}

// ---------------------------------------------------------------- full-frame overlay
export class Overlay extends Actor {
  constructor(scene, o) { super({ layer: 'fx', z: 90, ...o }); }
  draw(ctx, t) {
    const o = this.o;
    const a = typeof o.alpha === 'function' ? o.alpha(t) : o.alpha;
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    if (o.radial) {
      const g = ctx.createRadialGradient(o.radial[0], o.radial[1], o.radial[2], o.radial[0], o.radial[1], o.radial[3]);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, o.color || '#000');
      ctx.fillStyle = g;
    } else ctx.fillStyle = o.color || '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Scene helper methods
Object.assign(Scene.prototype, {
  sprite(key, o = {}) { return this.add(new Sprite(this, key, o)); },
  title(lines, o = {}) { return this.add(new Title(this, lines, o)); },
  type(text, o = {}) { return this.add(new TypeText(this, text, o)); },
  kicker(text, o = {}) { this.kickerOffset = 44; return this.add(new TypeText(this, text, { x: 99, y: 302 + (o.dy ?? 0), size: 26, spacing: 5, cps: 22, gain: 0.35, ...o })); },
  torn(lines, o = {}) { return this.add(new TornLabel(this, lines, o)); },
  nameTag(text, latin, o = {}) { return this.add(new NameTag(this, text, latin, o)); },
  hangTag(text, o = {}) { return this.add(new HangTag(this, text, o)); },
  ruler(o = {}) { return this.add(new Ruler(this, o)); },
  bracket(o = {}) { return this.add(new Bracket(this, o)); },
  checklist(o = {}) { return this.add(new Checklist(this, o)); },
  terminal(text, o = {}) { return this.add(new Terminal(this, text, o)); },
  stamp(text, o = {}) { return this.add(new Stamp(this, text, o)); },
  magnifier(o = {}) { return this.add(new Magnifier(this, o)); },
  dayCounter(o = {}) { return this.add(new DayCounter(this, o)); },
  monitor(o = {}) { return this.add(new Monitor(this, o)); },
  barChart(o = {}) { return this.add(new BarChart(this, o)); },
  swatches(o = {}) { return this.add(new Swatches(this, o)); },
  ticket(o = {}) { return this.add(new Ticket(this, o)); },
  glow(o = {}) { return this.add(new Glow(this, o)); },
  target(o = {}) { return this.add(new Target(this, o)); },
  bigNumber(text, o = {}) { return this.add(new BigNumber(this, text, o)); },
  cracks(o = {}) { return this.add(new Cracks(this, o)); },
  arrow(o = {}) { return this.add(new Arrow(this, o)); },
  overlay(o = {}) { return this.add(new Overlay(this, o)); },
});
