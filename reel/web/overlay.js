// 2D overlay: captions, comic words, watermark, title card, bolts, rays, sparkles, streaks.
import { W, H, clamp, lerp, seg, smooth, eOut, eIn, backOut, elastic, hash, noise } from './util.js';

const YEL = '#ffd93b', WHITE = '#ffffff', PINK = '#ff3fa4';
// caption chunks: [start, end, [[word, color]...]]  y=yellow, p=pink, w=white
const C = (s, e, txt) => [s, e, txt.split(' ').map(w => { const m = w.match(/^([ypw]):(.*)$/); return m ? [m[2], m[1]] : [w, 'w']; })];
export const CAPTIONS = [
  C(0.00, 0.50, 'YOU KNOW'), C(0.50, 1.10, "YOU SHOULDN'T BE"), C(1.10, 1.58, 'UNDER THE y:DESK'),
  C(1.58, 2.56, 'WITH YOUR y:BOSS'), C(2.56, 3.20, 'BUT IT FEELS'), C(3.20, 3.64, 'SO'), C(3.64, 4.10, 'p:FUCKING'),
  C(4.10, 4.86, 'y:RIGHT.'), C(4.86, 5.28, "BECAUSE YOU'RE"), C(5.28, 5.68, 'BOTH JUST'), C(5.68, 6.00, 'TRYING TO'),
  C(6.00, 6.28, 'PLUG IN'), C(6.28, 6.68, 'THE p:FUCKING'), C(6.68, 7.74, 'y:PHONE y:CHARGER.'), C(7.74, 8.34, 'YOU REACH IN'),
  C(8.34, 8.69, 'AND'), C(8.69, 9.56, 'y:ZAP!'), C(9.56, 10.02, 'YOUR WHOLE'), C(10.02, 10.42, 'p:FUCKING'),
  C(10.42, 10.70, 'y:LIFE'), C(10.70, 11.08, 'FLASHES'), C(11.08, 12.06, 'BEFORE YOUR EYES'), C(12.06, 12.64, 'AND EVERY'),
  C(12.64, 13.32, 'SINGLE PICTURE'), C(13.32, 14.38, 'IS y:HIM.'), C(14.38, 14.80, 'SO YOU GRAB'), C(14.80, 15.18, 'HIS y:TIE'),
  C(15.18, 16.02, 'AND SAY,'), C(16.02, 16.50, 'y:MARRY y:ME,'), C(16.50, 16.88, 'YOU SEXY'), C(16.88, 17.30, 'p:FUCKING'),
  C(17.30, 18.22, 'y:SPREADSHEET.'), C(18.22, 18.64, 'HE LOOKS'), C(18.64, 19.06, 'AT YOU,'), C(19.06, 19.84, 'y:HAIR STANDING UP'),
  C(19.84, 20.64, 'FROM THE y:SHOCK,'), C(20.64, 21.16, 'AND HANDS YOU'), C(21.16, 21.70, 'THE p:FUCKING'),
  C(21.70, 22.28, 'y:CORNER y:OFFICE'), C(22.28, 23.02, 'y:KEYS.'), C(23.96, 24.26, "YOU'VE GOT"),
  C(24.26, 24.60, 'y:THREE'), C(24.60, 24.90, 'p:FUCKING'), C(24.90, 25.66, 'y:KIDS.'), C(25.66, 25.84, 'AND THEIR'),
  C(25.84, 26.62, 'FIRST WORD WAS'), C(27.65, 28.6, 'y:GENIUS.'),
];
const COL = { w: WHITE, y: YEL, p: PINK };

export class Overlay {
  constructor(canvas) { this.cv = canvas; this.x = canvas.getContext('2d'); }
  clear() { this.x.clearRect(0, 0, W, H); }

  caption(t) {
    const x = this.x;
    const ch = CAPTIONS.find(c => t >= c[0] && t < c[1]);
    if (!ch) return;
    const d = t - ch[0];
    const sc = d < 0.07 ? lerp(0.8, 1.12, eOut(d / 0.07, 2)) : d < 0.15 ? lerp(1.12, 1.0, smooth((d - 0.07) / 0.08)) : 1;
    const fs = 92;
    x.save();
    x.font = `${fs}px LG`; x.textBaseline = 'alphabetic'; x.lineJoin = 'round'; x.miterLimit = 2;
    const words = ch[2];
    const sp = fs * 0.24;
    const ws = words.map(([w]) => x.measureText(w).width);
    // line breaking (max 2 lines)
    let lines = [[0]], lw = [ws[0]];
    for (let i = 1; i < words.length; i++) {
      const L = lines.length - 1;
      if (lw[L] + sp + ws[i] > 860) { lines.push([i]); lw.push(ws[i]); } else { lines[L].push(i); lw[L] += sp + ws[i]; }
    }
    const lh = fs * 1.02, cy = 1245;
    const y0 = cy - (lines.length - 1) * lh / 2;
    x.translate(W / 2, cy); x.scale(sc, sc); x.translate(-W / 2, -cy);
    lines.forEach((ln, li) => {
      let xx = W / 2 - lw[li] / 2; const yy = y0 + li * lh + fs * 0.36;
      ln.forEach(i => {
        const [w, c] = words[i];
        x.fillStyle = 'rgba(0,0,0,0.55)'; x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 20;
        x.strokeText(w, xx + 3, yy + 9); x.fillText(w, xx + 3, yy + 9);
        x.strokeStyle = '#000'; x.lineWidth = 17; x.strokeText(w, xx, yy);
        x.fillStyle = COL[c]; x.fillText(w, xx, yy);
        xx += ws[i] + sp;
      });
    });
    x.restore();
  }

  watermark() {
    const x = this.x;
    x.save(); x.font = '600 34px FR'; x.textAlign = 'center';
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillText('@Grace In Motion', W / 2 + 2, 1372);
    x.fillStyle = 'rgba(255,255,255,0.62)'; x.fillText('@Grace In Motion', W / 2, 1370);
    x.restore();
  }

  // comic word with pop + wobble
  comic(t, t0, t1, text, cx, cy, size, rot = -0.08, o = {}) {
    if (t < t0 || t > t1) return;
    const x = this.x, d = t - t0;
    const sc = elastic(clamp(d / 0.45), 0.4) * (1 - 0.15 * smooth(seg(t, t1 - 0.12, t1)));
    const a = 1 - smooth(seg(t, t1 - 0.1, t1));
    const jx = (o.shake ?? 0) * noise(t * 40, 3), jy = (o.shake ?? 0) * noise(t * 43, 4);
    x.save(); x.globalAlpha = a;
    x.translate(cx + jx, cy + jy); x.rotate(rot + 0.04 * Math.sin(d * 9)); x.scale(sc, sc);
    x.font = `${size}px LG`; x.textAlign = 'center'; x.lineJoin = 'round';
    if (o.burst) {
      const r = size * (o.burstR ?? 2.0), n = 16;
      x.beginPath();
      for (let i = 0; i < n * 2; i++) { const ang = Math.PI * i / n + d * 0.6; const rr = (i % 2 ? r * 0.62 : r) * (1 + 0.12 * (hash(i, 5) - 0.5)); x.lineTo(Math.cos(ang) * rr * 1.25, Math.sin(ang) * rr * 0.8 - size * 0.32); }
      x.closePath(); x.fillStyle = o.burstCol ?? '#ff3f6c'; x.fill(); x.lineWidth = 12; x.strokeStyle = '#000'; x.stroke();
      // halftone dots
      x.save(); x.clip(); x.fillStyle = 'rgba(255,255,255,0.18)';
      for (let gy = -r; gy < r; gy += 22) for (let gx = -r * 1.3; gx < r * 1.3; gx += 22) { const rr = 6 * (1 - Math.hypot(gx, gy) / (r * 1.4)); if (rr > 0.3) { x.beginPath(); x.arc(gx, gy, rr, 0, 7); x.fill(); } }
      x.restore();
    }
    x.lineWidth = size * 0.28; x.strokeStyle = '#000'; x.strokeText(text, 0, 0);
    x.lineWidth = size * 0.13; x.strokeStyle = o.inner ?? '#e8322e'; x.strokeText(text, 0, 0);
    const g = x.createLinearGradient(0, -size * 0.8, 0, size * 0.1); g.addColorStop(0, o.top ?? '#fff27a'); g.addColorStop(1, o.fill ?? '#ffc21a');
    x.fillStyle = g; x.fillText(text, 0, 0);
    x.restore();
  }

  titleCard(t, t0, t1, text, sub) {
    if (t < t0 - 0.01 || t > t1 + 0.3) return;
    const x = this.x;
    const inU = backOut(seg(t, t0, t0 + 0.32), 1.6);
    const outU = eIn(seg(t, t1, t1 + 0.25), 2);
    const off = (1 - inU) * -W * 1.3 + outU * W * 1.3;
    x.save();
    x.translate(off, 0);
    // slanted band
    x.beginPath(); x.moveTo(-200, 560); x.lineTo(W + 200, 380); x.lineTo(W + 200, 1180); x.lineTo(-200, 1360); x.closePath();
    const g = x.createLinearGradient(0, 400, 0, 1360); g.addColorStop(0, '#2a2f6e'); g.addColorStop(1, '#151a3f'); x.fillStyle = g; x.fill();
    x.lineWidth = 16; x.strokeStyle = '#ffd93b'; x.stroke();
    // shards
    for (let i = 0; i < 14; i++) {
      const sx = hash(i, 1) * W, sy = 560 + hash(i, 2) * 700 - sx * 0.17;
      x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + 60 + 80 * hash(i, 3), sy - 30); x.lineTo(sx + 30, sy + 50 + 40 * hash(i, 4)); x.closePath();
      x.fillStyle = `rgba(255,255,255,${0.04 + 0.06 * hash(i, 5)})`; x.fill();
    }
    x.translate(W / 2, 880); x.rotate(-0.165);
    const ps = 1 + 0.03 * Math.sin((t - t0) * 12) * Math.exp(-(t - t0) * 3);
    x.scale(ps, ps);
    x.font = '132px LG'; x.textAlign = 'center'; x.lineJoin = 'round';
    x.lineWidth = 34; x.strokeStyle = '#000'; x.strokeText(text, 0, 30);
    x.fillStyle = '#ffd93b'; x.fillText(text, 0, 30);
    x.font = '54px LG'; x.lineWidth = 14; x.strokeText(sub, 0, 130); x.fillStyle = '#ffffff'; x.fillText(sub, 0, 130);
    x.restore();
  }

  bolts(t, cx, cy, n, R, seed, a = 1, col = '#fff36a') {
    const x = this.x;
    x.save(); x.globalCompositeOperation = 'lighter'; x.lineJoin = 'miter'; x.lineCap = 'round';
    const fr = Math.floor(t * 30);
    for (let i = 0; i < n; i++) {
      const ang = hash(seed, i, fr) * Math.PI * 2, len = R * (0.5 + 0.7 * hash(seed, i, fr + 1));
      const pts = [[cx, cy]];
      const segs = 7;
      for (let k = 1; k <= segs; k++) {
        const u = k / segs, off = (hash(seed, i, k, fr) - 0.5) * len * 0.35;
        pts.push([cx + Math.cos(ang) * len * u - Math.sin(ang) * off, cy + Math.sin(ang) * len * u + Math.cos(ang) * off]);
      }
      for (const [w, c, al] of [[34, col, 0.18], [16, col, 0.55], [6, '#ffffff', 1]]) {
        x.beginPath(); pts.forEach(([px, py], k) => k ? x.lineTo(px, py) : x.moveTo(px, py));
        x.strokeStyle = c; x.globalAlpha = al * a; x.lineWidth = w; x.stroke();
      }
    }
    x.restore();
  }

  rays(cx, cy, R, n, rot, col, a, width = 0.5) {
    if (a <= 0) return;
    const x = this.x;
    x.save(); x.globalCompositeOperation = 'screen';
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, col.replace('A', a)); g.addColorStop(0.5, col.replace('A', a * 0.45)); g.addColorStop(1, col.replace('A', 0));
    x.fillStyle = g; x.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = rot + Math.PI * 2 * i / n, a1 = a0 + Math.PI * 2 / n * width;
      x.moveTo(cx, cy); x.lineTo(cx + R * Math.cos(a0), cy + R * Math.sin(a0)); x.lineTo(cx + R * Math.cos(a1), cy + R * Math.sin(a1)); x.closePath();
    }
    x.fill(); x.restore();
  }

  glow(cx, cy, r, col, a) {
    if (a <= 0) return;
    const x = this.x; x.save(); x.globalCompositeOperation = 'screen';
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
    x.fillStyle = g; x.fillRect(cx - r, cy - r, 2 * r, 2 * r); x.restore();
  }

  star(cx, cy, r, col, a, rot = 0) {
    const x = this.x; x.save(); x.globalAlpha = a; x.translate(cx, cy); x.rotate(rot);
    x.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.26 : r; const an = i * Math.PI / 4; x.lineTo(Math.sin(an) * rr, -Math.cos(an) * rr); }
    x.closePath(); x.fillStyle = col; x.shadowColor = col; x.shadowBlur = r * 0.8; x.fill(); x.restore();
  }
  sparkles(t, cx, cy, rx, ry, n, seed, size, col = '#ffffff', a = 1) {
    for (let i = 0; i < n; i++) {
      const per = 0.8 + hash(seed, i, 3) * 0.8, u = ((t + hash(seed, i, 4) * per) % per) / per;
      const k = Math.pow(Math.sin(u * Math.PI), 2);
      this.star(cx + (hash(seed, i, 1) * 2 - 1) * rx, cy + (hash(seed, i, 2) * 2 - 1) * ry, size * (0.5 + hash(seed, i, 3)) * k, col, a * k, u);
    }
  }
  streaks(a, seed, col = 'rgba(255,255,255,A)', vertical = false) {
    if (a <= 0) return;
    const x = this.x; x.save();
    for (let i = 0; i < 30; i++) {
      const p = hash(seed, i, 1), L = 300 + 900 * hash(seed, i, 2), th = 4 + 26 * hash(seed, i, 3);
      x.fillStyle = col.replace('A', a * (0.2 + 0.5 * hash(seed, i, 4)));
      if (!vertical) x.fillRect(hash(seed, i, 5) * (W + L) - L, p * H, L, th); else x.fillRect(p * W, hash(seed, i, 5) * (H + L) - L, th, L);
    }
    x.restore();
  }
  speedLines(cx, cy, a, seed, t) {
    if (a <= 0) return;
    const x = this.x; x.save();
    for (let i = 0; i < 46; i++) {
      const ang = hash(seed, i) * Math.PI * 2, r0 = 380 + 260 * hash(seed, i, Math.floor(t * 30)), r1 = 1400, w = 3 + 10 * hash(seed, i, 2);
      x.beginPath(); x.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      x.lineTo(cx + Math.cos(ang) * r1 - Math.sin(ang) * w, cy + Math.sin(ang) * r1 + Math.cos(ang) * w);
      x.lineTo(cx + Math.cos(ang) * r1 + Math.sin(ang) * w, cy + Math.sin(ang) * r1 - Math.cos(ang) * w);
      x.closePath(); x.fillStyle = `rgba(255,255,255,${a * (0.35 + 0.5 * hash(seed, i, 3))})`; x.fill();
    }
    x.restore();
  }
  hearts(t, cx, cy, n, seed, size, a = 1, spread = 160, rise = 260) {
    const x = this.x;
    for (let i = 0; i < n; i++) {
      const per = 1.4 + hash(seed, i, 1), u = ((t + hash(seed, i, 2) * per) % per) / per;
      const px = cx + (hash(seed, i, 3) - 0.5) * spread + Math.sin(u * 6 + i) * 14, py = cy - u * rise;
      const s = size * (0.6 + 0.6 * hash(seed, i, 4)) * (0.6 + 0.5 * u), al = a * Math.sin(u * Math.PI);
      x.save(); x.globalAlpha = al; x.translate(px, py); x.rotate((hash(seed, i, 5) - 0.5) * 0.6); x.scale(s / 32, s / 32);
      x.beginPath(); for (let k = 0; k < 20; k++) { const an = 2 * Math.PI * k / 20; x.lineTo(16 * Math.pow(Math.sin(an), 3), -(13 * Math.cos(an) - 5 * Math.cos(2 * an) - 2 * Math.cos(3 * an) - Math.cos(4 * an))); }
      x.closePath(); x.fillStyle = '#ff4f8b'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#a3164a'; x.stroke();
      x.restore();
    }
  }
}
