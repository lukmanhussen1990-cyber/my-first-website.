// ---------- HUD ----------
const COUNT_EVENTS = [];   // {t, v, kind}
let RESET_T = 1e9, DAY2_T = 1e9;
function countState(t) {
  let v = 0, t0 = -99, prev = 0;
  for (const e of COUNT_EVENTS) if (t >= e.t) { prev = v; v = e.v; t0 = e.t; }
  // rolling reset 3 -> 0
  if (t >= RESET_T && t < RESET_T + 0.6) { const k = P(t, RESET_T, 0.6); v = Math.round(lerp(3, 0, E.inOut(k))); }
  return { v, t0, prev };
}

function drawHUD(ctx, t) {
  ctx.save();
  const Y = 136, Hh = 96;
  // ---- DAYS LEFT box
  rr(ctx, 22, Y, 156, Hh, 14); ctx.fillStyle = 'rgba(16,18,28,0.9)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.stroke();
  boldText(ctx, 'DAYS LEFT', 100, Y + 22, 21, '#ffffff', { stroke: 0, shadow: false });
  let days = 10, dk = 1;
  if (t >= DAY2_T) { dk = P(t, DAY2_T, 0.35); days = dk < 0.5 ? 10 : 9; }
  const flipS = t >= DAY2_T ? Math.abs(Math.cos(dk * Math.PI)) : 1;
  ctx.save(); ctx.translate(100, Y + 62); ctx.scale(1, Math.max(0.05, flipS));
  boldText(ctx, String(days), 0, 0, 52, days === 9 ? '#ff5a5a' : '#ffd23f', { stroke: 6 });
  ctx.restore();
  // ---- POOP COUNT box
  const st = countState(t);
  const since = t - st.t0;
  const flash = st.t0 > 0 ? clamp(1 - since / 0.5) : 0;
  const bx = 190, bw = 300;
  rr(ctx, bx, Y, bw, Hh, 14); ctx.fillStyle = 'rgba(16,18,28,0.9)'; ctx.fill();
  ctx.lineWidth = 3 + flash * 4; ctx.strokeStyle = flash > 0 ? `rgba(255,210,63,${0.3 + flash * 0.7})` : 'rgba(255,255,255,0.14)'; ctx.stroke();
  boldText(ctx, 'POOP COUNT', bx + bw / 2, Y + 22, 21, '#ffffff', { stroke: 0, shadow: false });
  // number with pop
  const pop = st.t0 > 0 && since < 0.6 ? 1 + spring(t, st.t0, 0.75, 2.2, 7) * (since < 0.05 ? since / 0.05 : 1) : 1;
  const sq = Math.max(0.3, pop);
  ctx.save(); ctx.translate(bx + 112, Y + 62); ctx.scale(sq, sq); ctx.rotate(spring(t, st.t0, 0.25, 2.5, 8));
  boldText(ctx, String(st.v), 0, 0, 52, '#7cfc5a', { stroke: 6 });
  ctx.restore();
  poopIcon(ctx, bx + 60, Y + 66, 0.62 * (1 + Math.max(0, pop - 1) * 0.5), true);
  // tally pips (up to 5)
  for (let i = 0; i < 5; i++) {
    const on = i < st.v, x = bx + 160 + i * 25, y = Y + 64;
    const k = on && i === st.v - 1 && since < 0.4 ? E.back(P(t, st.t0, 0.3)) : 1;
    circle(ctx, x, y, 9 * (on ? k : 1)); ctx.fillStyle = on ? '#9b5b2e' : 'rgba(255,255,255,0.12)'; ctx.fill();
    if (on) { ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffd23f'; ctx.stroke(); }
  }
  // +1 floater & burst
  if (st.t0 > 0 && since < 0.9 && st.v > st.prev && !(t >= RESET_T && t < RESET_T + 0.6)) {
    const k = since / 0.9;
    ctx.globalAlpha = 1 - k;
    boldText(ctx, '+1', bx + bw + 40, Y + 50 - k * 40, 46, '#7cfc5a', { stroke: 6 });
    ctx.globalAlpha = 1;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + st.t0, r = 30 + E.out(clamp(since / 0.45)) * 110;
      if (since < 0.45) sparkle(ctx, bx + 112 + Math.cos(a) * r, Y + 62 + Math.sin(a) * r * 0.7, 0.5 * (1 - since / 0.45), 1, i % 2 ? '#fff7b0' : '#9cff7a');
    }
  }
  // reset tag under the HUD
  if (t >= RESET_T - 0.05 && t < RESET_T + 2.6) {
    const k = popScale(t, RESET_T, 0.25) * (1 - P(t, RESET_T + 2.3, 0.3));
    ctx.save(); ctx.translate(bx + bw / 2 - 20, Y + Hh + 34); ctx.scale(k, k); ctx.rotate(-0.04);
    rr(ctx, -175, -24, 350, 48, 24); ctx.fillStyle = '#e23b3b'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
    boldText(ctx, "WARM-UPS DON'T COUNT", 0, 1, 28, '#fff', { stroke: 0, shadow: false });
    ctx.restore();
  }
  ctx.restore();
}

// ---------- captions ----------
const CAP_COLORS = { Y: '#ffd23f', P: '#ff6fb5', G: '#7cfc5a', B: '#4fc3ff', R: '#ff4d4d', W: '#ffffff' };
let CHUNKS = [];   // [{a, b, col:{idx:colorKey}}]
function wordText(i) {
  let s = WORDS[i].w.toUpperCase().replace(/[.,!]/g, '');
  return s;
}
function captionAt(t) {
  for (let c = 0; c < CHUNKS.length; c++) {
    const ch = CHUNKS[c], next = CHUNKS[c + 1];
    const start = ws(ch.a) - 0.06;
    const end = next ? Math.min(ws(next.a) - 0.06, we(ch.b) + 0.75) : we(ch.b) + 1.0;
    if (t >= start && t < end) return ch;
  }
  return null;
}
function drawCaption(ctx, t, y) {
  const ch = captionAt(t); if (!ch) return;
  const size = ch.size || 78;
  ctx.save();
  ctx.font = `${size}px "Anton"`;
  const words = []; let total = 0; const gap = size * 0.24;
  for (let i = ch.a; i <= ch.b; i++) { const s = wordText(i); const w = ctx.measureText(s).width; words.push({ i, s, w }); total += w; }
  total += gap * (words.length - 1);
  const maxW = 650, sc = total > maxW ? maxW / total : 1;
  let x = 360 - (total * sc) / 2;
  for (const wd of words) {
    const t0 = ws(wd.i) - 0.06;
    if (t >= t0) {
      const k = P(t, t0, 0.2);
      const s = sc * lerp(0.45, 1, E.back(k));
      const col = CAP_COLORS[(ch.col && ch.col[wd.i]) || 'W'];
      ctx.save(); ctx.translate(x + (wd.w * sc) / 2, y - (1 - E.out(k)) * 18); ctx.scale(s / sc * sc, s / sc * sc);
      ctx.globalAlpha = clamp(k * 4);
      boldText(ctx, wd.s, 0, 0, size, col, { stroke: size * 0.17 });
      ctx.restore();
    }
    x += (wd.w + gap) * sc;
  }
  ctx.restore();
}

// ---------- phone chat UI ----------
// msgs: [{t, from:'her'|'me', text, kind, note}]
function drawPhone(ctx, t, o) {
  const pw = 450, ph = 800, px = 360 - pw / 2, py = 262;
  ctx.save();
  const sh = o.shake || 0;
  ctx.translate(Math.sin(t * 70) * sh * 8, Math.cos(t * 55) * sh * 4);
  // shadow + body
  rr(ctx, px - 6, py + 16, pw + 12, ph, 62); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  rr(ctx, px - 14, py - 14, pw + 28, ph + 28, 66); ctx.fillStyle = '#16151c'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#3a3846'; ctx.stroke();
  rr(ctx, px, py, pw, ph, 52); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.save(); rr(ctx, px, py, pw, ph, 52); ctx.clip();
  // header
  ctx.fillStyle = '#f3f3f7'; ctx.fillRect(px, py, pw, 132);
  ctx.fillStyle = '#d9d9e3'; ctx.fillRect(px, py + 132, pw, 2);
  rr(ctx, 360 - 62, py + 14, 124, 30, 15); ctx.fillStyle = '#16151c'; ctx.fill();
  // avatar: bride
  circle(ctx, px + 58, py + 88, 28); ctx.fillStyle = '#ff6fb5'; ctx.fill();
  ctx.save(); circle(ctx, px + 58, py + 88, 28); ctx.clip();
  ctx.beginPath(); ctx.moveTo(px + 40, py + 70); ctx.quadraticCurveTo(px + 26, py + 110, px + 34, py + 130); ctx.lineTo(px + 82, py + 130); ctx.quadraticCurveTo(px + 90, py + 110, px + 76, py + 70); ctx.fillStyle = '#fff'; ctx.fill();
  circle(ctx, px + 58, py + 86, 12); ctx.fillStyle = '#f2c6a0'; ctx.fill();
  ctx.restore();
  plainText(ctx, 'Sis', px + 100, py + 84, 26, '#111', { weight: 800 });
  plainText(ctx, 'Bride-to-be · 10 days', px + 100, py + 110, 17, '#ff3f97', { weight: 600 });
  plainText(ctx, 'Today 9:41 AM', 360, py + 166, 15, '#8e8e98', { align: 'center', weight: 500 });
  // messages
  const msgs = o.msgs.filter(m => t >= m.t);
  const lines = []; // compute layout
  ctx.font = '600 26px Inter, "Noto Color Emoji"';
  let y = py + 196;
  const layout = msgs.map(m => {
    const maxw = 310;
    let rows = [];
    if (m.kind === 'emoji') rows = [m.text];
    else {
      const words = m.text.split(' '); let cur = '';
      for (const w of words) { const test = cur ? cur + ' ' + w : w; if (ctx.measureText(test).width > maxw && cur) { rows.push(cur); cur = w; } else cur = test; }
      if (cur) rows.push(cur);
    }
    const lh = m.kind === 'emoji' ? 74 : 34;
    const head = m.kind === 'warning' ? 40 : 0;
    const bw = m.kind === 'emoji' ? 110 : Math.min(maxw, Math.max(...rows.map(r => ctx.measureText(r).width))) + 36 + (m.kind === 'warning' ? 30 : 0);
    const bh = rows.length * lh + 22 + head;
    const item = { m, rows, bw: Math.max(bw, m.kind === 'warning' ? 300 : 0), bh, y, lh, head };
    y += bh + 14 + (m.note ? 26 : 0);
    return item;
  });
  // scroll so the last message stays above input bar
  const bottom = py + ph - 110;
  const scroll = Math.max(0, y - bottom);
  ctx.save(); ctx.translate(0, -scroll);
  for (const it of layout) {
    const { m } = it;
    const mine = m.from === 'me';
    const k = popScale(t, m.t, 0.26);
    const bx = mine ? px + pw - 22 - it.bw : px + 22;
    ctx.save();
    const ox = mine ? bx + it.bw : bx, oy = it.y + it.bh;
    ctx.translate(ox, oy); ctx.scale(k, k); ctx.translate(-ox, -oy);
    rr(ctx, bx, it.y, it.bw, it.bh, 22);
    ctx.fillStyle = mine ? '#2f8bff' : (m.kind === 'warning' ? '#fff1f1' : '#e9e9ef'); ctx.fill();
    if (m.kind === 'warning') { ctx.lineWidth = 4; ctx.strokeStyle = '#e23b3b'; ctx.stroke(); }
    if (m.kind === 'warning') {
      rr(ctx, bx, it.y, it.bw, 40, 22); ctx.fillStyle = '#e23b3b'; ctx.fill(); ctx.fillRect(bx, it.y + 20, it.bw, 20);
      plainText(ctx, '⚠️ OFFICIAL WARNING', bx + 16, it.y + 28, 19, '#fff', { weight: 800 });
    }
    it.rows.forEach((r, i) => {
      if (m.kind === 'emoji') plainText(ctx, r, bx + it.bw / 2, it.y + 76, 64, '#000', { align: 'center' });
      else plainText(ctx, r, bx + 18, it.y + it.head + 40 + i * it.lh, 26, mine ? '#fff' : (m.kind === 'warning' ? '#b01d1d' : '#111'), { weight: m.kind === 'warning' ? 800 : 600 });
    });
    ctx.restore();
    if (m.note && t >= m.t + 0.35) {
      ctx.globalAlpha = clamp((t - m.t - 0.35) * 4);
      plainText(ctx, m.note, mine ? px + pw - 26 : px + 26, it.y + it.bh + 22, 16, '#8e8e98', { align: mine ? 'right' : 'left', weight: 600 });
      ctx.globalAlpha = 1;
    }
  }
  // typing indicator
  if (o.typing && t >= o.typing[0] && t < o.typing[1]) {
    const ty = layout.length ? layout[layout.length - 1].y + layout[layout.length - 1].bh + 14 + (layout[layout.length - 1].m.note ? 26 : 0) : py + 196;
    rr(ctx, px + 22, ty, 96, 52, 26); ctx.fillStyle = '#e9e9ef'; ctx.fill();
    for (let i = 0; i < 3; i++) { circle(ctx, px + 48 + i * 22, ty + 26 - Math.max(0, Math.sin(t * 9 - i * 0.8)) * 7, 7); ctx.fillStyle = '#9a9aa6'; ctx.fill(); }
  }
  ctx.restore();
  // input bar
  const inp = o.input || '';
  ctx.font = '500 21px Inter';
  let rows = [];
  if (inp) { const words = inp.split(' '); let cur = ''; for (const w of words) { const test = cur ? cur + ' ' + w : w; if (ctx.measureText(test).width > 320 && cur) { rows.push(cur); cur = w; } else cur = test; } rows.push(cur); }
  const ih = Math.max(50, rows.length * 28 + 22);
  const iy = py + ph - 34 - ih;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(px, iy - 14, pw, ph);
  rr(ctx, px + 20, iy, pw - 40, ih, 25); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#d0d0da'; ctx.stroke();
  if (!inp) plainText(ctx, 'Message', px + 44, iy + 33, 21, '#b0b0ba', { weight: 500 });
  rows.forEach((r, i) => plainText(ctx, r, px + 40, iy + 34 + i * 28, 21, '#111', { weight: 500 }));
  if (o.cursor && Math.sin(t * 12) > 0) {
    const lr = rows.length ? rows[rows.length - 1] : '';
    ctx.font = '500 21px Inter'; const cx = px + 40 + (lr ? ctx.measureText(lr).width + 3 : 4);
    ctx.fillStyle = '#2f8bff'; ctx.fillRect(cx, iy + 14 + Math.max(0, rows.length - 1) * 28, 3, 26);
  }
  circle(ctx, px + pw - 46, iy + ih - 25, 16); ctx.fillStyle = inp ? '#2f8bff' : '#c9c9d3'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(px + pw - 46, iy + ih - 33); ctx.lineTo(px + pw - 46, iy + ih - 17); ctx.moveTo(px + pw - 53, iy + ih - 26); ctx.lineTo(px + pw - 46, iy + ih - 33); ctx.lineTo(px + pw - 39, iy + ih - 26); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ---------- transitions ----------
function whip(ctx, k, dir = 1) {
  // k: 0 -> 1 over the transition; draws streaks + flash
  if (k >= 1) return;
  ctx.save();
  ctx.globalAlpha = (1 - k) * 0.85;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 22; i++) {
    const y = hash(i * 1.7) * H, len = 200 + hash(i) * 500, x = ((hash(i + 3) * W + dir * k * 1600) % (W + len)) - len / 2;
    ctx.fillRect(x, y, len, 4 + hash(i + 9) * 10);
  }
  ctx.globalAlpha = Math.pow(1 - k, 3) * 0.7; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
