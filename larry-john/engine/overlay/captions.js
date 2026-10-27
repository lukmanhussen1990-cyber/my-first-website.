// Reel text overlay, drawn on a transparent 2D canvas (shared by every Larry & John reel):
//   - one-word subtitles in sync with the voice (Fredoka bold, white or yellow, thick outline, soft shadow, tiny pop)
//   - big chunky "3D" labels in the upper third (extruded, outlined, colour coded, bounce in / pop out)
// Everything is a pure function of time, so any frame can be drawn on its own.
import { clamp, lerp, easeOutBack, easeInBack, popIn, mulberry32 } from '../toon/anim.js';

export const INK = '#1c1226';
// red = problem, yellow = upgrade, green = win, white = neutral
export const LABEL_COLORS = {
  red: { top: '#ff8072', bottom: '#e5322b', side: '#9c1b20' },
  yellow: { top: '#fff38a', bottom: '#ffb51c', side: '#bf6c0a' },
  green: { top: '#adf78a', bottom: '#2fbf55', side: '#187232' },
  white: { top: '#ffffff', bottom: '#dcdaf0', side: '#857f9f' },
};

// subtitles show the script's words; trailing commas, periods, ellipses and quotes are dropped (! ? $ ' stay)
export function cleanWord(text) {
  return text.replace(/^["“”'‘]+/, '').replace(/["“”]+$/, '').replace(/[.,;:…]+$/, '').replace(/^\.+/, '') || text;
}

export class Captions {
  constructor(ctx, W, H, opts = {}) {
    this.ctx = ctx; this.W = W; this.H = H; this.k = W / 1080;
    this.o = {
      subFont: 'Fredoka', subWeight: 700, subSize: 96, subX: 0.47, subY: 0.44, subMaxW: 0.8,
      labelFont: 'Titan One', labelSize: 140, labelX: 0.5, labelY: 0.17, labelMaxW: 0.84,
      ...opts,
    };
    this.words = []; this.labels = [];
  }

  // words: [{text, s, e, key, shout, echo}] in time order
  setWords(words) {
    const ws = words.map((w) => ({ ...w, disp: cleanWord(w.text) }));
    ws.forEach((w, i) => {
      const next = ws[i + 1];
      w.a = w.s - 0.02;
      w.b = Math.min(next ? next.s - 0.02 : Infinity, w.e + (w.shout ? 0.55 : 0.4));
      w.b = Math.max(w.b, w.a + 2.01 / 30);
      w.cut = next && next.s - 0.02 <= w.b + 1e-3;      // replaced by the next word (no fade)
    });
    this.words = ws;
  }

  // labels: [{text, color, at, dur, group, tilt}]
  setLabels(labels) {
    const ls = labels.map((l, i) => ({ ...l, end: l.at + l.dur }));
    const rnd = mulberry32(17);
    ls.forEach((l, i) => {
      l.tilt = l.tilt ?? -(2.5 + rnd() * 2);        // rising to the right, like the reference
      // a label in a group is swapped out the moment the next one of its group pops in
      const next = ls.slice(i + 1).find((m) => l.group && m.group === l.group);
      l.swapAt = next && next.at < l.end + 0.05 ? next.at : null;
    });
    this.labels = ls;
  }

  draw(t) {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    for (const l of this.labels) this.drawLabel(l, t);
    const w = this.words.find((x) => t >= x.a && t < x.b);
    if (w) this.drawWord(w, t);
  }

  // which overlay elements are on screen at time t (for checks and debugging)
  stateAt(t) {
    const w = this.words.find((x) => t >= x.a && t < x.b);
    const ls = this.labels.filter((l) => t >= l.at && t < (l.swapAt ?? l.end));
    return { word: w ? w.disp : null, labels: ls.map((l) => l.text) };
  }

  fitFont(text, family, weight, size, maxW) {
    const c = this.ctx;
    c.font = `${weight} ${size}px "${family}"`;
    const w = c.measureText(text).width;
    if (w > maxW) { size *= maxW / w; c.font = `${weight} ${size}px "${family}"`; }
    return size;
  }

  drawWord(w, t) {
    const c = this.ctx, k = this.k, o = this.o;
    const age = t - w.a;
    let size = o.subSize * k * (w.shout ? 1.5 : 1);
    size = this.fitFont(w.disp, o.subFont, o.subWeight, size, o.subMaxW * this.W);
    const pop = easeOutBack(clamp(age / 0.13), 2.6);
    const scale = 0.6 + 0.4 * pop;
    let alpha = clamp(age / 0.04);
    if (!w.cut) alpha *= clamp((w.b - t) / 0.08);
    let x = o.subX * this.W, y = o.subY * this.H - (1 - clamp(age / 0.13)) * 10 * k;
    if (w.shout) {
      const sh = Math.exp(-age * 3.5);
      x += Math.sin(age * 95) * 9 * k * sh; y += Math.cos(age * 77) * 7 * k * sh;
    }
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.miterLimit = 2;
    // echoes ripple out behind a shouted word (the "JOHN!" down the pit)
    if (w.echo) {
      for (let j = 3; j >= 1; j--) {
        const e = clamp((age - j * 0.09) / 0.5);
        if (e <= 0 || e >= 1) continue;
        c.save(); c.translate(x, y); c.scale(scale * (1 + 0.22 * j * e), scale * (1 + 0.22 * j * e));
        c.globalAlpha = alpha * (1 - e) * 0.45;
        c.lineWidth = 14 * k; c.strokeStyle = INK; c.strokeText(w.disp, 0, 0);
        c.fillStyle = '#ffd84a'; c.fillText(w.disp, 0, 0);
        c.restore();
      }
    }
    c.translate(x, y); c.scale(scale, scale);
    c.globalAlpha = alpha;
    // soft shadow under a thick dark outline, then the letters
    c.shadowColor = 'rgba(10,4,22,0.55)'; c.shadowBlur = 16 * k; c.shadowOffsetY = 7 * k;
    c.lineWidth = 18 * k * (w.shout ? 1.3 : 1); c.strokeStyle = INK; c.strokeText(w.disp, 0, 0);
    c.shadowColor = 'rgba(0,0,0,0)';
    const g = c.createLinearGradient(0, -size * 0.42, 0, size * 0.42);
    if (w.key || w.shout) { g.addColorStop(0, '#fff27a'); g.addColorStop(1, '#ffbe1a'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e9e7f4'); }
    c.fillStyle = g; c.fillText(w.disp, 0, 0);
    c.restore();
  }

  drawLabel(l, t) {
    const c = this.ctx, k = this.k, o = this.o;
    const age = t - l.at, stop = l.swapAt ?? l.end;
    if (age < 0 || t >= stop) return;
    const left = stop - t;
    const pal = LABEL_COLORS[l.color] || LABEL_COLORS.white;
    let size = this.fitFont(l.text, o.labelFont, 400, o.labelSize * k, o.labelMaxW * this.W - 60 * k);
    // bounce in (squash & stretch), settle, gentle bob; pop out at the end (unless swapped)
    let s = popIn(age, 0.34);
    const stretch = 1 + 0.12 * Math.sin(clamp(age / 0.3) * Math.PI) * Math.exp(-age * 4);
    if (!l.swapAt) s *= 1 - easeInBack(clamp((0.14 - left) / 0.14), 2.2);
    if (s <= 0.002) return;
    const rot = ((l.tilt + (1 - clamp(age / 0.28)) * -9) * Math.PI) / 180;
    const bob = Math.sin(age * 5.0) * 3 * k;
    const depth = 11 * k * (size / (o.labelSize * k)), ow = 15 * k * (size / (o.labelSize * k));
    c.save();
    c.translate(o.labelX * this.W, o.labelY * this.H + bob);
    c.rotate(rot); c.scale(s / Math.sqrt(stretch), s * stretch);
    c.font = `400 ${size}px "${o.labelFont}"`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.miterLimit = 2;
    // soft drop shadow + thick dark outline around the whole extruded block
    c.shadowColor = 'rgba(8,2,20,0.5)'; c.shadowBlur = 24 * k; c.shadowOffsetY = 18 * k;
    c.lineWidth = ow * 2; c.strokeStyle = INK; c.strokeText(l.text, 0, depth);
    c.shadowColor = 'rgba(0,0,0,0)';
    for (let d = depth; d >= 0; d -= 1.5 * k) c.strokeText(l.text, 0, d);
    // the extruded sides
    c.fillStyle = pal.side;
    for (let d = depth; d > 0; d -= 1 * k) c.fillText(l.text, 0, d);
    // the face: a vertical gradient, a thin edge line, and a soft glossy highlight on top
    c.lineWidth = 3 * k; c.strokeStyle = 'rgba(28,18,38,0.6)'; c.strokeText(l.text, 0, 0);
    const g = c.createLinearGradient(0, -size * 0.4, 0, size * 0.4);
    g.addColorStop(0, pal.top); g.addColorStop(1, pal.bottom);
    c.fillStyle = g; c.fillText(l.text, 0, 0);
    c.save();
    c.beginPath(); c.rect(-this.W, -size, this.W * 2, size * 0.86); c.clip();
    c.globalAlpha = 0.22; c.fillStyle = '#ffffff'; c.fillText(l.text, 0, -size * 0.03);
    c.restore();
    c.restore();
  }
}
