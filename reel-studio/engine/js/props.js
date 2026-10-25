// More field-journal props: thermometer, sun, nose clip, tally card, case file,
// manila folder, pictogram figures, drop-in cards, safety card rows.
import { W, H, clamp, lerp, ease, prog, rng, strSeed, noise1, makeCanvas, COLORS, rgba } from './util.js';
import { FONTS } from './assets.js';
import { Actor, Scene } from './timeline.js';
import { inkText, setFont, measure, card, paperTexture, wobblyPath, strokePartial, markerEllipse, checkMark, xMark, cached } from './draw.js';

const DEG = Math.PI / 180, TAU = Math.PI * 2;
const isX = (s) => s.look === 'xray';

// ---------------------------------------------------------------- thermometer on a card
export class Thermometer extends Actor {
  constructor(scene, o) {
    super({ layer: o.layer || 'ui', z: 44, ...o });
    this.h = o.h ?? 560;
    scene.sfx(this.at, 'slide', 0.5);
    const riseAt = o.riseAt ?? this.at + 0.4, dur = o.riseDur ?? 1.4;
    for (let k = 1; k <= 7; k++) scene.sfx(riseAt + (k / 7) * dur * 0.95, 'tick', 0.18);
  }
  value(t) {
    const o = this.o;
    return lerp(o.from ?? 14, o.to ?? 38, prog(t, o.riseAt ?? this.at + 0.4, o.riseDur ?? 1.4, ease.inOutCubic));
  }
  draw(ctx, t) {
    const o = this.o, h = this.h, w = 170;
    const p = prog(t, this.at, 0.35, ease.outCubic);
    ctx.save();
    ctx.translate(o.x + (1 - p) * (o.slide ?? 420), o.y); ctx.rotate((o.rot ?? 3) * DEG);
    ctx.globalAlpha *= clamp((t - this.at) / 0.1);
    const c = card(w, h, { color: '#ece2ca', seed: 31 });
    ctx.drawImage(c.canvas, -c.pad, -c.pad);
    const tx = 62, top = 70, bot = h - 92, min = o.min ?? 0, max = o.max ?? 50;
    const yOf = (v) => lerp(bot - 6, top + 14, (v - min) / (max - min));
    // scale
    ctx.strokeStyle = 'rgba(46,28,12,0.8)'; ctx.fillStyle = 'rgba(46,28,12,0.85)';
    for (let v = min; v <= max; v += 2) {
      const y = yOf(v), big = v % 10 === 0;
      ctx.lineWidth = big ? 2.5 : 1.2;
      ctx.beginPath(); ctx.moveTo(tx + 22, y); ctx.lineTo(tx + 22 + (big ? 24 : 12), y); ctx.stroke();
      if (big) { setFont(ctx, FONTS.type, 22); ctx.fillText(String(v), tx + 52, y + 8); }
    }
    setFont(ctx, FONTS.type, 24); ctx.fillText('°C', tx + 50, top - 18);
    // glass tube + bulb
    const v = this.value(t), ly = yOf(v);
    ctx.fillStyle = 'rgba(252,250,240,0.75)'; ctx.strokeStyle = 'rgba(70,50,28,0.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(tx - 13, top - 10, 26, bot - top + 30, 13); ctx.fill(); ctx.stroke();
    const bg = ctx.createRadialGradient(tx - 9, bot + 32, 3, tx, bot + 40, 32);
    bg.addColorStop(0, '#f08a6a'); bg.addColorStop(0.5, '#cf4a30'); bg.addColorStop(1, '#8e2616');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(tx, bot + 40, 30, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(70,40,20,0.7)'; ctx.stroke();
    // liquid column
    const lg = ctx.createLinearGradient(tx - 6, 0, tx + 6, 0);
    lg.addColorStop(0, '#9b2a18'); lg.addColorStop(0.45, '#e05238'); lg.addColorStop(1, '#a32d1b');
    ctx.fillStyle = lg; ctx.fillRect(tx - 6, ly, 12, bot + 20 - ly);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(tx - 9, top, 3, bot - top);
    ctx.beginPath(); ctx.arc(tx - 11, bot + 30, 6, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- icons
// Engraved sun: circle with hatching and alternating straight / wavy rays.
export function drawSun(ctx, x, y, r, t = 0, color = COLORS.redInk) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.15);
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    ctx.save(); ctx.rotate(a);
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.beginPath();
    if (i % 2 === 0) { ctx.moveTo(r * 0.68, 0); ctx.lineTo(r * 1.05, 0); }
    else { for (let k = 0; k <= 10; k++) { const u = k / 10; const px = r * (0.68 + 0.3 * u), py = Math.sin(u * TAU * 1.5 + t * 3) * r * 0.05; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } }
    ctx.stroke(); ctx.restore();
  }
  ctx.lineWidth = Math.max(2, r * 0.05);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TAU); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r * 0.53, 0, TAU); ctx.clip();
  ctx.lineWidth = Math.max(1, r * 0.022); ctx.globalAlpha *= 0.7;
  for (let k = -r; k < r; k += r * 0.09) { ctx.beginPath(); ctx.moveTo(-r, k + r * 0.2); ctx.lineTo(r, k - r * 0.2); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}

// Swimmer's nose clip, front view: a springy horseshoe band with two rubber pads
// (drawn like a small catalogue illustration). s = width in px.
export function drawNoseClip(ctx, x, y, s, color = COLORS.ink, accent = COLORS.red) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // soft shadow
  ctx.save(); ctx.globalAlpha *= 0.25; ctx.filter = 'blur(4px)'; ctx.strokeStyle = '#1a1006'; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(-14, 44); ctx.bezierCurveTo(-34, -70, 34, -70, 14, 44); ctx.stroke(); ctx.restore();
  // band: a narrow springy loop, dark outline, red body, light highlight
  ctx.strokeStyle = 'rgba(40,20,8,0.9)'; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.moveTo(-15, 36); ctx.bezierCurveTo(-36, -74, 36, -74, 15, 36); ctx.stroke();
  ctx.strokeStyle = accent; ctx.lineWidth = 7; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,200,0.6)'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(-18, 14); ctx.bezierCurveTo(-28, -50, -4, -58, 6, -52); ctx.stroke();
  // rubber pads, almost touching (they pinch the nose)
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.translate(sx * 13, 46); ctx.rotate(sx * 0.12);
    const g = ctx.createLinearGradient(-10, -16, 10, 16);
    g.addColorStop(0, '#5a5048'); g.addColorStop(1, '#231c16');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(20,12,6,0.9)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-3, -6, 3, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // pinch arrows
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3.5;
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sx * 58, 46); ctx.lineTo(sx * 30, 46); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx * 25, 46); ctx.lineTo(sx * 35, 40); ctx.lineTo(sx * 35, 52); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Three wavy lines (water / swimming).
export function drawWaves(ctx, x, y, w, color = COLORS.redInk, t = 0) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(2.5, w * 0.05); ctx.lineCap = 'round';
  for (let r = 0; r < 3; r++) {
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) { const u = k / 24; const px = x - w / 2 + u * w, py = y + r * w * 0.22 + Math.sin(u * TAU * 1.5 + t * 4 + r) * w * 0.06; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
  }
  ctx.restore();
}

// Pictogram person (isotype style), centred at x, y, height s.
export function drawPerson(ctx, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, -s * 0.36, s * 0.12, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.roundRect(-s * 0.19, -s * 0.21, s * 0.38, s * 0.33, s * 0.08); ctx.fill();
  ctx.beginPath(); ctx.roundRect(-s * 0.15, s * 0.08, s * 0.12, s * 0.42, s * 0.05); ctx.fill();
  ctx.beginPath(); ctx.roundRect(s * 0.03, s * 0.08, s * 0.12, s * 0.42, s * 0.05); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- tally card
export class TallyCard extends Actor {
  constructor(scene, o) {
    super({ layer: 'ui', z: 42, ...o });
    const total = o.total ?? 167, per = o.groupsPerRow ?? 9, gw = o.groupW ?? 78, rowH = o.rowH ?? 96, mh = o.markH ?? 62;
    const drawAt = o.drawAt ?? this.at + 0.3, drawDur = o.drawDur ?? 2.0;
    this.marks = [];
    for (let i = 0; i < total; i++) {
      const g = Math.floor(i / 5), k = i % 5, row = Math.floor(g / per), col = g % per;
      const gx = 44 + col * gw, gy = 104 + row * rowH;
      const pts = k < 4
        ? wobblyPath([[gx + 6 + k * 13, gy + 2], [gx + 8 + k * 13, gy + mh]], 100 + i, 1.3, 9)
        : wobblyPath([[gx - 4, gy + mh * 0.78], [gx + 60, gy + mh * 0.18]], 100 + i, 1.3, 9);
      this.marks.push({ pts, at: drawAt + (i / total) * drawDur, cx: k < 4 ? gx + 7 + k * 13 : gx + 28, cy: gy + mh / 2, k });
    }
    this.cw = o.w ?? 44 * 2 + per * gw - 10;
    this.ch = o.h ?? 104 + Math.ceil(Math.ceil(total / 5) / per) * rowH + 30;
    scene.sfx(this.at, 'slide', 0.6);
    for (let tt = drawAt; tt < drawAt + drawDur; tt += 0.32) scene.sfx(tt, 'scribble', 0.5, { v: Math.round(tt * 10) % 3 });
    for (const c of o.circles || []) scene.sfx(c.at, 'pen', 0.55);
  }
  draw(ctx, t) {
    const o = this.o;
    const p = prog(t, this.at, 0.35, ease.outCubic);
    ctx.save();
    ctx.translate(o.x, o.y + (1 - p) * 500); ctx.rotate((o.rot ?? -1.2) * DEG);
    const c = card(Math.round(this.cw), Math.round(this.ch), { seed: 27, color: '#ebe0c8' });
    ctx.drawImage(c.canvas, -c.pad, -c.pad);
    setFont(ctx, FONTS.type, 22); ctx.letterSpacing = '4px'; ctx.fillStyle = 'rgba(55,36,16,0.8)';
    ctx.fillText(o.header || 'CASES', 44, 60);
    ctx.letterSpacing = '0px';
    for (const m of this.marks) {
      if (t < m.at) continue;
      strokePartial(ctx, m.pts, prog(t, m.at, 0.06), m.k < 4 ? 4.2 : 3.6, 'rgba(38,24,10,0.9)');
    }
    for (const [ci, cobj] of (o.circles || []).entries()) {
      if (t < cobj.at) continue;
      const m = this.marks[cobj.index];
      markerEllipse(ctx, m.cx, m.cy, 20, 44, prog(t, cobj.at, 0.3, ease.inOutQuad), { width: 5, seed: 40 + ci });
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- case file (folder + typed sheet)
export class CaseFile extends Actor {
  constructor(scene, o) {
    super({ layer: 'ui', z: 41, ...o });
    this.cw = o.w ?? 800; this.ch = o.h ?? 560;
    this.cps = o.cps ?? 26;
    scene.sfx(this.at, 'slide', 0.65);
    for (const ln of o.lines || []) {
      const txt = (ln.label ? ln.label + ' ' : '') + ln.value;
      for (let i = 0; i < txt.length; i += 2) if (txt[i] !== ' ') scene.sfx(ln.at + i / this.cps, 'type', 0.32, { v: i % 6 });
    }
  }
  draw(ctx, t) {
    const o = this.o, w = this.cw, h = this.ch;
    const p = prog(t, this.at, 0.4, ease.outCubic);
    ctx.save();
    ctx.translate(o.x - (1 - p) * 900, o.y); ctx.rotate(((o.rot ?? -2) + (1 - p) * -6) * DEG);
    // manila folder behind, with a tab
    ctx.save(); ctx.shadowColor = 'rgba(40,25,10,0.42)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#c9a866';
    ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(220, -18); ctx.lineTo(250, -62); ctx.lineTo(500, -62); ctx.lineTo(530, -18);
    ctx.lineTo(w + 14, -18); ctx.lineTo(w + 14, h + 18); ctx.lineTo(-14, h + 18); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.drawImage(paperTexture(w + 28, h + 36, '#cfae6d', 52, false), -14, -18);
    setFont(ctx, FONTS.type, 22); ctx.letterSpacing = '4px'; ctx.fillStyle = 'rgba(60,38,14,0.85)';
    ctx.fillText(o.tab || 'CASE FILE', 270, -30);
    // typed sheet
    const c = card(w - 40, h - 40, { color: '#f0e8d4', seed: 53, shadow: 0.6 });
    ctx.drawImage(c.canvas, 20 - c.pad, 20 - c.pad);
    // paperclip
    ctx.save(); ctx.strokeStyle = '#8d8d86'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const px = w - 130;
    ctx.beginPath(); ctx.moveTo(px, 70); ctx.lineTo(px, -10); ctx.arc(px + 15, -10, 15, Math.PI, 0); ctx.lineTo(px + 30, 80); ctx.arc(px + 10, 80, 20, 0, Math.PI); ctx.lineTo(px - 10, 0); ctx.stroke();
    ctx.restore();
    let y = 110;
    for (const ln of o.lines || []) {
      const lsz = ln.size ?? 40;
      if (t >= ln.at) {
        const full = (ln.label ? ln.label + ' ' : '') + ln.value;
        const n = Math.min(full.length, Math.floor((t - ln.at) * this.cps + 1));
        const lab = ln.label ? full.slice(0, Math.min(n, ln.label.length)) : '';
        const val = n > (ln.label ? ln.label.length + 1 : 0) ? full.slice(ln.label ? ln.label.length + 1 : 0, n) : '';
        setFont(ctx, FONTS.type, 22); ctx.letterSpacing = '4px'; ctx.fillStyle = 'rgba(70,46,20,0.75)';
        if (lab) ctx.fillText(lab, 60, y);
        ctx.letterSpacing = '1px';
        setFont(ctx, FONTS.monoBold, lsz); ctx.fillStyle = ln.red ? COLORS.redInk : '#24180b';
        if (val) ctx.fillText(val, 60, y + lsz + 6);
      }
      y += (ln.label ? 36 : 0) + lsz + (ln.gap ?? 34);
    }
    ctx.letterSpacing = '0px';
    if (o.after) o.after(ctx, t, w, h);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- closed manila folder
export class Folder extends Actor {
  constructor(scene, o) { super({ layer: 'ui', z: 40, ...o }); scene.sfx(this.at, 'slide', 0.7); }
  draw(ctx, t) {
    const o = this.o, w = o.w ?? 720, h = o.h ?? 520;
    const p = prog(t, this.at, 0.45, ease.outCubic);
    ctx.save();
    ctx.translate(o.x + (1 - p) * 900, o.y); ctx.rotate(((o.rot ?? 4) + (1 - p) * 8) * DEG);
    ctx.save(); ctx.shadowColor = 'rgba(40,25,10,0.45)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 14;
    ctx.fillStyle = '#c9a866';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.55, 0); ctx.lineTo(w * 0.6, -50); ctx.lineTo(w - 10, -50); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.drawImage(paperTexture(w, h, '#d3b475', 61, false), 0, 0);
    ctx.fillStyle = 'rgba(90,60,20,0.25)'; ctx.fillRect(0, 0, w, 6);
    // label card
    const lw = w * 0.72, lh = 150;
    const c = card(Math.round(lw), lh, { color: '#f1e9d6', seed: 63, shadow: 0.4 });
    ctx.drawImage(c.canvas, (w - lw) / 2 - c.pad, h * 0.32 - c.pad);
    setFont(ctx, FONTS.type, 22); ctx.letterSpacing = '5px'; ctx.fillStyle = 'rgba(60,38,14,0.8)';
    ctx.fillText(o.kicker || 'CASE STUDY', (w - lw) / 2 + 30, h * 0.32 + 44);
    ctx.letterSpacing = '1px';
    const ink = inkText(o.title || 'KARACHI', FONTS.title, 72, COLORS.ink);
    ctx.drawImage(ink.canvas, (w - lw) / 2 + 30 - ink.pad, h * 0.32 + 60 + 72 * 0.86 - ink.base);
    // red string tie
    ctx.strokeStyle = COLORS.redInk; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(w - 70, h * 0.55, 18, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w - 70, h * 0.55 + 18); ctx.bezierCurveTo(w - 40, h * 0.72, w - 120, h * 0.78, w - 90, h * 0.92); ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- pictogram figures
export class Figures extends Actor {
  constructor(scene, o) {
    super({ layer: 'ui', z: 43, ...o });
    this.n = o.n ?? 13;
    scene.sfx(this.at, 'pop', 0.4);
    for (let i = 1; i < this.n; i += 3) scene.sfx(this.at + i * (o.stagger ?? 0.06), 'pop', 0.25, { v: i % 3 });
    if (o.mark) { scene.sfx(o.mark.at, 'pen', 0.7); scene.sfx(o.mark.at + 0.25, 'slide', 0.4); }
    if (o.others) scene.sfx(o.others.at, 'pop', 0.35);
  }
  pos(i) {
    const o = this.o, per = o.perRow ?? 7, sp = o.spacing ?? 116;
    const row = Math.floor(i / per), col = i % per;
    const inRow = Math.min(per, this.n - row * per);
    return [o.x + (col - (inRow - 1) / 2) * sp, o.y + row * (o.rowGap ?? 190)];
  }
  draw(ctx, t) {
    const o = this.o, s = o.size ?? 120;
    for (let i = 0; i < this.n; i++) {
      const at = this.at + i * (o.stagger ?? 0.06);
      if (t < at) continue;
      const p = prog(t, at, 0.25, ease.outBack);
      const [x, y] = this.pos(i);
      const marked = o.mark && o.mark.index === i && t >= o.mark.at;
      const dim = o.others && !(o.mark && o.mark.index === i) ? prog(t, o.others.at, 0.3) : 0;
      ctx.save(); ctx.globalAlpha *= clamp((t - at) / 0.08);
      ctx.translate(x, y); ctx.scale(p, p);
      const col = marked ? COLORS.red : `rgba(${lerp(46, 120, dim)},${lerp(28, 100, dim)},${lerp(12, 80, dim)},0.9)`;
      drawPerson(ctx, 0, 0, s, col);
      ctx.restore();
      if (dim > 0 && o.others.text) {
        ctx.save(); ctx.globalAlpha *= dim;
        const q = inkText(o.others.text, FONTS.title, 46, 'rgba(90,70,50,0.85)', { texture: 0.4 });
        ctx.drawImage(q.canvas, x - q.width / 2 - q.pad, y - s * 0.62 - q.base);
        ctx.restore();
      }
      if (marked) {
        markerEllipse(ctx, x, y, s * 0.42, s * 0.64, prog(t, o.mark.at, 0.4, ease.inOutQuad), { width: 6, seed: 9 });
        if (t >= o.mark.at + 0.25) {
          const a = prog(t, o.mark.at + 0.25, 0.2);
          ctx.save(); ctx.globalAlpha *= a;
          const lab = inkText(o.mark.label || 'SWAM', FONTS.title, 44, COLORS.red);
          ctx.drawImage(lab.canvas, x - lab.width / 2 - lab.pad, y + s * 0.62 + 52 - lab.base);
          drawWaves(ctx, x, y + s * 0.62 + 74, 70, COLORS.redInk, t);
          ctx.restore();
        }
      }
    }
  }
}

// ---------------------------------------------------------------- cards that drop in
export class DropCards extends Actor {
  constructor(scene, o) {
    super({ layer: 'ui', z: 44, ...o });
    for (const it of o.items) { scene.sfx(it.at, 'whoosh', 0.3); scene.sfx(it.at + 0.22, 'thud', 0.5); }
  }
  draw(ctx, t) {
    for (const it of this.o.items) {
      if (t < it.at) continue;
      const p = prog(t, it.at, 0.32, ease.outBack);
      const w = it.w ?? 520, h = it.h ?? 190;
      ctx.save();
      ctx.translate(it.x, it.y - (1 - p) * 360);
      ctx.rotate(((it.rot ?? 0) + (1 - p) * 12) * DEG);
      ctx.globalAlpha *= clamp((t - it.at) / 0.08);
      const c = card(w, h, { color: it.color || '#eee4cc', seed: strSeed(it.text) % 40 });
      ctx.drawImage(c.canvas, -w / 2 - c.pad, -h / 2 - c.pad);
      if (it.sub) {
        setFont(ctx, FONTS.type, 22); ctx.letterSpacing = '4px'; ctx.fillStyle = 'rgba(70,46,20,0.75)'; ctx.textAlign = 'center';
        ctx.fillText(it.sub, 0, -h / 2 + 46); ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
      }
      const size = it.size ?? 92;
      const ink = inkText(it.text, FONTS.title, size, it.red ? COLORS.red : COLORS.ink);
      ctx.drawImage(ink.canvas, -ink.width / 2 - ink.pad, (it.sub ? 26 : 0) + size * 0.43 - ink.base);
      ctx.restore();
    }
  }
}

Object.assign(Scene.prototype, {
  thermometer(o = {}) { return this.add(new Thermometer(this, o)); },
  tally(o = {}) { return this.add(new TallyCard(this, o)); },
  caseFile(o = {}) { return this.add(new CaseFile(this, o)); },
  folder(o = {}) { return this.add(new Folder(this, o)); },
  figures(o = {}) { return this.add(new Figures(this, o)); },
  dropCards(o = {}) { return this.add(new DropCards(this, o)); },
});
