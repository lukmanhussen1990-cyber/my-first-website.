'use strict';
/* ------------------------------------------------------------------
   Overlays: clock HUD, police-file folder, captions, phone,
   evidence cards, violation card, choice buttons.
------------------------------------------------------------------- */

/* ---------- clock HUD ---------- */
// minutes since midnight for each moment (DAY 1 · HOUR 3 stays as the case label)
function clockMinutes(t) {
  // 4:06 -> rewind to 2:04 -> fast-forward to 4:37 -> ticks to 4:43
  if (t < 4.9) return 4 * 60 + 6;
  if (t < 5.85) return lerp(4 * 60 + 6, 2 * 60 + 4, E.ioC(inv(4.9, 5.85, t)));
  if (t < 11.6) return 2 * 60 + 4;
  if (t < 12.45) return lerp(2 * 60 + 4, 4 * 60 + 37, E.ioC(inv(11.6, 12.45, t)));
  const ticks = [[18.1, 38], [26.6, 39], [35.95, 40], [45.4, 41], [53.7, 42], [58.2, 43]];
  let m = 4 * 60 + 37;
  for (const [tt, mm] of ticks) if (t >= tt) m = 4 * 60 + mm;
  return m;
}
function drawClockHUD(ctx, t, a = 1) {
  if (a <= 0.01) return;
  const x = 86, y = 199, w = 235, h = 115;
  const mins = clockMinutes(t);
  const spinning = (t > 4.9 && t < 5.85) || (t > 11.6 && t < 12.45);
  ctx.save(); ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrectPath(ctx, x + 3, y + 5, w, h, 12); ctx.fill();
  rrect(ctx, x, y, w, h, 12, '#0c0f15', '#ebe2c8', 3.2);
  text(ctx, 'DAY 1', x + 16, y + 27, "600 23px 'Barlow Condensed'", '#e8493d');
  text(ctx, 'HOUR 3', x + w - 15, y + 27, "600 21px 'Barlow Condensed'", '#ece5d3', 'right');
  const mi = Math.floor(mins);
  const hh = Math.floor(mi / 60), mm = mi % 60;
  const timeStr = `${hh}:${String(mm).padStart(2, '0')}`;
  ctx.save();
  ctx.beginPath(); ctx.rect(x + 8, y + 30, w - 16, 60); ctx.clip();
  // digit roll when the minute changes
  const frac = mins - mi;
  const tickAge = lastTickAge(t);
  const roll = spinning ? frac : 0;
  const bounce = tickAge < 0.18 ? (1 - tickAge / 0.18) : 0;
  ctx.font = "700 66px 'Barlow Condensed'";
  const tw2 = ctx.measureText(timeStr).width;
  const ty = y + 86 + (spinning ? (roll - 0.5) * 22 : -bounce * 8);
  if (spinning) { ctx.globalAlpha *= 0.75; ctx.filter = 'blur(1.2px)'; }
  text(ctx, timeStr, x + 16, ty, "700 66px 'Barlow Condensed'", spinning ? '#ffffff' : '#f3eee1');
  ctx.filter = 'none';
  ctx.restore();
  text(ctx, 'AM', x + 22 + tw2, y + 85, "600 27px 'Barlow Condensed'", '#ece5d3');
  if (spinning) {
    const fw = t < 6 ? '◀◀' : '▶▶';
    text(ctx, fw, x + w - 15, y + 85, "700 20px 'Inter'", Math.floor(t * 8) % 2 ? '#e8493d' : '#ffb3ab', 'right');
  }
  // progress bar
  const segs = 25, filled = (mm / 60) * segs + 2;
  const bx = x + 16, by = y + 95, bw = w - 32, bh = 8;
  for (let i = 0; i < segs; i++) {
    const sx = bx + (bw / segs) * i;
    ctx.fillStyle = i < filled ? '#e5443a' : '#2d3038';
    ctx.fillRect(sx, by, bw / segs - 1.6, bh);
  }
  ctx.restore();
}
function lastTickAge(t) {
  const ticks = [12.45, 18.1, 26.6, 35.95, 45.4, 53.7, 58.2];
  let age = 99; for (const tt of ticks) if (t >= tt) age = t - tt;
  return age;
}

/* ---------- police file folder ---------- */
function drawFolder(ctx, t, x, y, sc, amount, a = 1, stampK = 0) {
  if (a <= 0.01) return;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.translate(x, y); ctx.scale(sc, sc);
  // local: folder spans (0,0)-(221,128); anchor at top-left
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrectPath(ctx, 4, 24, 221, 106, 9); ctx.fill();
  // tab
  rrect(ctx, 5, 0, 152, 26, 5, '#e8cd8f', '#4a3b22', 2.6);
  text(ctx, 'POLICE FILE', 14, 18, "700 13px 'Courier Prime'", '#3b2f1c');
  // papers
  ctx.fillStyle = '#f7f4ec'; ctx.fillRect(153, 10, 60, 16); ctx.fillStyle = '#ece8dd'; ctx.fillRect(158, 6, 56, 16);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(158, 6, 56, 16);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(163, 10 + i * 4, 44, 1.2); }
  // body
  const g = ctx.createLinearGradient(0, 18, 0, 128);
  g.addColorStop(0, '#efd598'); g.addColorStop(1, '#dcbd7a');
  rrect(ctx, 0, 18, 221, 110, 9, g, '#4a3b22', 3);
  text(ctx, 'FINE:', 16, 46, "600 18px 'Barlow Condensed'", '#3b2f1c');
  // amount (with stamp slam)
  ctx.save();
  const ax = 14, ay = 108;
  if (stampK > 0 && stampK < 1) {
    const s2 = lerp(2.2, 1, E.outBackS(stampK));
    ctx.translate(ax, ay); ctx.scale(s2, s2); ctx.translate(-ax, -ay);
    ctx.globalAlpha *= clamp(stampK * 3);
  }
  text(ctx, amount, ax, ay, "700 64px 'Barlow Condensed'", '#b3161b');
  ctx.restore();
  ctx.restore();
}
const FOLDER_POS = [413, 187];

/* ---------- captions ---------- */
let SCRIPT = null;
function captionStyle(who) {
  if (who === 'o' || who === 'd') return '#bfe4ff';
  if (who === 't') return '#d9ffd2';
  return '#ffffff';
}
const KEYC = { y: '#ffd43b', r: '#ff4848', b: '#4aa3ff' };
function activeChunk(t) {
  const caps = SCRIPT.captions;
  for (let i = 0; i < caps.length; i++) {
    const c = caps[i];
    const start = c.w[0][0] - 0.06;
    const nextStart = i + 1 < caps.length ? caps[i + 1].w[0][0] - 0.06 : 999;
    const end = Math.min(nextStart, c.end !== undefined ? c.end : nextStart);
    if (t >= start && t < end) return { c, start, end };
  }
  return null;
}
function drawCaptions(ctx, t, y0 = 885) {
  const ac = activeChunk(t);
  if (!ac) return;
  const { c, start, end } = ac;
  const words = c.w;
  const font = "800 37px 'Montserrat'";
  ctx.font = font;
  const space = 15;
  const maxW = 590;
  // layout into lines
  const widths = words.map(w => ctx.measureText(w[1]).width);
  const lines = [[]]; let lw = 0;
  words.forEach((w, i) => {
    const add = widths[i] + (lines[lines.length - 1].length ? space : 0);
    if (lw + add > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; }
    lines[lines.length - 1].push(i); lw += widths[i] + (lines[lines.length - 1].length > 1 ? space : 0);
  });
  const lh = 46;
  const appear = E.outBack(clamp((t - start) / 0.12));
  const fade = 1 - clamp((t - (end - 0.08)) / 0.08);
  ctx.save();
  ctx.globalAlpha *= fade;
  lines.forEach((ln, li) => {
    const tot = ln.reduce((s, i) => s + widths[i], 0) + space * (ln.length - 1);
    let x = 360 - tot / 2;
    const y = y0 + (li - (lines.length - 1) / 2) * lh;
    ln.forEach(i => {
      const [wt, word, col] = words[i];
      const on = t >= wt;
      const age = t - wt;
      const pop = on ? 1 + 0.085 * Math.max(0, 1 - age / 0.13) : 1;
      const color = on ? (col ? KEYC[col] : captionStyle(c.who)) : 'rgba(150,156,168,0.92)';
      ctx.save();
      ctx.translate(x + widths[i] / 2, y - 13);
      ctx.scale(pop * (0.9 + 0.1 * appear), pop * (0.9 + 0.1 * appear));
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      outlinedText(ctx, word, 0, 13, font, color, '#090b10', 7.5, 'center');
      ctx.shadowColor = 'transparent';
      ctx.restore();
      x += widths[i] + space;
    });
  });
  ctx.restore();
}

/* ---------- phone with notification ---------- */
// p: {k: slide 0..1, notif: 0..1, buzz: 0..1, time:'2:04', title, body, x,y}
function drawPhone(ctx, t, p) {
  if (p.k <= 0.01) return;
  const cx = p.x || 360, cy0 = p.y || 545;
  const cy = lerp(cy0 + 900, cy0, E.outBack(clamp(p.k)));
  const shake = p.buzz > 0 ? Math.sin(t * 95) * 5 * p.buzz : 0;
  const w = 296, h = 380;
  ctx.save(); ctx.translate(cx + shake, cy); ctx.rotate(p.rot || 0);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; rrectPath(ctx, -w / 2 + 8, -h / 2 + 12, w, h, 34); ctx.fill();
  rrect(ctx, -w / 2, -h / 2, w, h, 34, '#0b0d13');
  const sg = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  sg.addColorStop(0, '#2a3247'); sg.addColorStop(1, '#151a28');
  rrect(ctx, -w / 2 + 11, -h / 2 + 11, w - 22, h - 22, 25, sg);
  // notch
  rrect(ctx, -34, -h / 2 + 18, 68, 14, 7, '#0b0d13');
  text(ctx, p.time, 0, -h / 2 + 82, "500 46px 'Inter'", '#ffffff', 'center');
  text(ctx, p.date || 'Saturday', 0, -h / 2 + 106, "500 14px 'Inter'", 'rgba(255,255,255,0.7)', 'center');
  // notification
  const nk = clamp(p.notif);
  if (nk > 0.01) {
    const ny = lerp(-h / 2 - 20, -h / 2 + 124, E.outBack(nk));
    ctx.save(); ctx.globalAlpha *= clamp(nk * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; rrectPath(ctx, -w / 2 + 22, ny + 4, w - 44, 112, 16); ctx.fill();
    rrect(ctx, -w / 2 + 20, ny, w - 40, 112, 16, '#eef0f4');
    rrect(ctx, -w / 2 + 34, ny + 14, 26, 26, 7, '#34c759');
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(-w / 2 + 47, ny + 26, 8, 6.5, 0, 0, TAU); ctx.fill();
    fillPoly(ctx, [[-w / 2 + 42, ny + 30], [-w / 2 + 40, ny + 36], [-w / 2 + 47, ny + 31]], '#ffffff');
    text(ctx, 'Messages · now', -w / 2 + 70, ny + 32, "500 14px 'Inter'", '#6b7280');
    ctx.font = "700 19px 'Inter', 'Noto Color Emoji'"; ctx.fillStyle = '#111318'; ctx.textAlign = 'left';
    ctx.fillText(p.title, -w / 2 + 34, ny + 66);
    ctx.font = "400 18px 'Inter', 'Noto Color Emoji'"; ctx.fillStyle = '#20232b';
    ctx.fillText(p.body, -w / 2 + 34, ny + 94);
    ctx.restore();
  }
  // buzz lines
  if (p.buzz > 0.05) {
    ctx.strokeStyle = `rgba(255,255,255,${0.85 * p.buzz})`; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const xx = s * (w / 2 + 14 + k * 9);
      ctx.beginPath(); ctx.moveTo(xx, -40 + k * 6); ctx.lineTo(xx, 40 - k * 6); ctx.stroke();
    }
  }
  ctx.restore();
}

/* ---------- evidence card (frame + tag), content drawn by callback ---------- */
function drawEvidenceCard(ctx, t, k, out, tagText, drawContent) {
  if (k <= 0.01 || out >= 0.99) return;
  const x0 = 75, y0 = 386, w = 570, h = 374;
  const slideIn = E.outBack(clamp(k));
  const slideOut = E.inC(clamp(out));
  const dx = (1 - slideIn) * 760 - slideOut * 800;
  const rot = -0.018 + (1 - slideIn) * 0.12 - slideOut * 0.1;
  ctx.save();
  ctx.translate(360 + dx, y0 + h / 2); ctx.rotate(rot); ctx.translate(-360, -(y0 + h / 2));
  // tag
  ctx.font = "700 18px 'Courier Prime'";
  const tw2 = ctx.measureText(tagText).width + 30;
  rrect(ctx, 360 - tw2 / 2, y0 - 54, tw2, 34, 6, '#141820', 'rgba(255,255,255,0.15)', 1);
  text(ctx, tagText, 360, y0 - 31, "700 18px 'Courier Prime'", '#f0eee6', 'center');
  // frame
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x0 + 8, y0 + 10, w, h);
  ctx.fillStyle = '#f1eee6'; ctx.fillRect(x0, y0, w, h);
  const ix = x0 + 10, iy = y0 + 10, iw = w - 20, ih = h - 20;
  ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip(); ctx.translate(ix, iy);
  drawContent(ctx, iw, ih);
  ctx.restore();
  ctx.restore();
}

/* ---------- FALSE STATEMENT violation card ---------- */
function drawViolationCard(ctx, t, k, out, stampK) {
  if (k <= 0.01 || out >= 0.99) return;
  const slideIn = E.outBack(clamp(k)), slideOut = E.inC(clamp(out));
  const cx = 360, cy = 560 + (1 - slideIn) * 820 + slideOut * 900;
  const w = 440, h = 330;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.035 + (1 - slideIn) * 0.2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(-w / 2 + 8, -h / 2 + 10, w, h);
  ctx.fillStyle = '#f4f0e4'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = '#29241f'; ctx.fillRect(-w / 2, -h / 2, w, 34);
  text(ctx, 'VIOLATION', -w / 2 + 14, -h / 2 + 23, "700 15px 'Courier Prime'", '#f4f0e4');
  text(ctx, 'IF YOU LIE', w / 2 - 14, -h / 2 + 23, "700 15px 'Courier Prime'", '#f2c94c', 'right');
  text(ctx, 'FALSE STATEMENT', 0, -h / 2 + 78, "700 33px 'Courier Prime'", '#1f1b17', 'center');
  text(ctx, 'TO A POLICE OFFICER', 0, -h / 2 + 102, "700 13px 'Courier Prime'", '#6a6158', 'center');
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + 30, -h / 2 + 122 + i * 26); ctx.lineTo(w / 2 - 30, -h / 2 + 122 + i * 26); ctx.stroke(); }
  text(ctx, '"He just dropped his phone."', 0, -h / 2 + 142, "italic 700 17px 'Courier Prime'", '#2b2622', 'center');
  text(ctx, 'FINE: UP TO $1,000', 0, -h / 2 + 192, "700 30px 'Barlow Condensed'", '#9e1b1b', 'center');
  text(ctx, 'APPLIES TO: YOU', w / 2 - 16, -h / 2 + 222, "700 12px 'Courier Prime'", '#6a6158', 'right');
  // stamp
  if (stampK > 0) {
    const s2 = lerp(2.4, 1, E.outBackS(clamp(stampK)));
    ctx.save(); ctx.translate(-6, 112); ctx.rotate(-0.12); ctx.scale(s2 * 0.78, s2 * 0.78); ctx.globalAlpha *= clamp(stampK * 3);
    ctx.strokeStyle = '#d42a26'; ctx.lineWidth = 5; rrectPath(ctx, -150, -42, 300, 84, 10); ctx.stroke();
    text(ctx, '+$1,000', -8, 22, "800 58px 'Barlow Condensed'", '#d42a26', 'center');
    ctx.save(); ctx.translate(112, -20); ctx.rotate(0.2);
    ctx.lineWidth = 3; rrectPath(ctx, -44, -16, 88, 32, 5); ctx.stroke();
    text(ctx, 'FILED', 0, 9, "800 22px 'Barlow Condensed'", '#d42a26', 'center');
    ctx.restore();
    ctx.restore();
  }
  ctx.restore();
}

/* ---------- choice buttons ---------- */
function drawButton(ctx, t, cx, cy, label, color, k, pulse) {
  if (k <= 0.01) return;
  const sc = E.outBackS(clamp(k)) * (1 + (pulse || 0) * 0.03);
  const w = 272, h = 66;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
  if (pulse) glow(ctx, 0, 0, 170, color, 0.35 * pulse, 'screen');
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; rrectPath(ctx, -w / 2 + 3, -h / 2 + 6, w, h, h / 2); ctx.fill();
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, tint(color, 0.12)); g.addColorStop(1, shade(color, 0.08));
  rrect(ctx, -w / 2, -h / 2, w, h, h / 2, g, '#ffffff', 4.5);
  text(ctx, label, 0, 9, "700 25px 'Inter'", '#ffffff', 'center');
  ctx.restore();
}

/* ---------- final call-to-action caption with emoji ---------- */
function drawCTA(ctx, t, k) {
  if (k <= 0.01) return;
  const sc = E.outBack(clamp(k));
  ctx.save(); ctx.translate(360, 872); ctx.scale(sc, sc);
  const font = "800 40px 'Montserrat'";
  ctx.font = font;
  const parts = [['COMMENT', 'w'], ['g', 'g'], ['🔵', 'e'], ['g', 'g'], ['OR', 'w'], ['g', 'g'], ['🔴', 'e']];
  const ef = "40px 'Noto Color Emoji'";
  const widths = parts.map(([s, k2]) => { if (k2 === 'g') return 14; ctx.font = k2 === 'e' ? ef : font; return ctx.measureText(s).width; });
  const tot = widths.reduce((a, b) => a + b, 0);
  let x = -tot / 2;
  parts.forEach(([s, k2], i) => {
    if (k2 === 'g') { /* gap */ } else if (k2 === 'e') { ctx.font = ef; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText(s, x, 14); }
    else { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; outlinedText(ctx, s, x + widths[i] / 2, 14, font, '#ffffff', '#090b10', 8, 'center'); ctx.shadowColor = 'transparent'; }
    x += widths[i];
  });
  ctx.restore();
}
