const W = 1080, H = 1920;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOutBack = (t, s = 2.2) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const clean = w => w.replace(/[^A-Za-z0-9'$?!]/g, '').replace(/[!?]/g, '').toUpperCase();

export function buildChunks(words) {
  const chunks = []; let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    const punct = /[,.!?]$/.test(w.w);
    const gap = next ? next.s - w.e : 9;
    if (punct || cur.length >= 3 || gap > 0.28 || !next) { chunks.push(cur); cur = []; }
  });
  chunks.forEach((c, i) => {
    c.start = c[0].s - 0.03;
    const nx = chunks[i + 1];
    c.end = nx ? Math.min(nx[0].s - 0.03, c[c.length - 1].e + 0.45) : c[c.length - 1].e + 0.6;
  });
  return chunks;
}

function strokeFill(ctx, txt, x, y, fill, lw, shadow = true) {
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  if (shadow) { ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.strokeText(txt, x, y + lw * 0.45); }
  ctx.lineWidth = lw; ctx.strokeStyle = '#111114'; ctx.strokeText(txt, x, y);
  ctx.fillStyle = fill; ctx.fillText(txt, x, y);
}

function drawCaption(ctx, t, chunks, cy) {
  const c = chunks.find(c => t >= c.start && t < c.end);
  if (!c) return;
  const age = t - c.start;
  const sc = 0.82 + 0.18 * easeOutBack(clamp(age / 0.16));
  const size = 86;
  ctx.font = `900 ${size}px Mont`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const items = c.map(w => ({ txt: clean(w.w), w })).filter(i => i.txt);
  const space = size * 0.28;
  const widths = items.map(i => ctx.measureText(i.txt).width);
  // split into lines if too wide
  let lines = [items.map((_, k) => k)];
  const total = widths.reduce((a, b) => a + b, 0) + space * (items.length - 1);
  if (total > 900 && items.length > 1) { const k = Math.ceil(items.length / 2); lines = [items.slice(0, k).map((_, i) => i), items.slice(k).map((_, i) => i + k)]; }
  let active = -1; items.forEach((it, k) => { if (t >= it.w.s - 0.02) active = k; });
  ctx.save(); ctx.translate(W / 2, cy); ctx.scale(sc, sc);
  lines.forEach((ln, li) => {
    const lw = ln.reduce((a, k) => a + widths[k], 0) + space * (ln.length - 1);
    let x = -lw / 2; const y = (li - (lines.length - 1) / 2) * size * 1.08;
    ln.forEach(k => {
      const on = k === active;
      const pop = on ? 1 + 0.1 * (1 - clamp((t - items[k].w.s) / 0.18)) : 1;
      ctx.save(); ctx.translate(x + widths[k] / 2, y); ctx.scale(pop, pop);
      ctx.textAlign = 'center';
      strokeFill(ctx, items[k].txt, 0, 0, on ? '#ffd21f' : '#ffffff', 20);
      ctx.restore();
      x += widths[k] + space;
    });
  });
  ctx.restore();
}

function burst(ctx, r, n, color) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2; const rr = i % 2 ? r * 0.62 : r * (0.92 + 0.16 * ((i * 7) % 3) / 2); ctx.lineTo(Math.cos(a) * rr * 1.25, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = '#111114'; ctx.stroke();
}

export function drawComic(ctx, t, c) {
  const u = t - c.t, dur = c.dur ?? 0.8;
  if (u < 0 || u > dur) return;
  const inS = easeOutBack(clamp(u / 0.17), 2.6);
  const outS = 1 - clamp((u - (dur - 0.14)) / 0.14);
  const s = Math.max(0, inS * (outS < 1 ? Math.pow(outS, 1.5) : 1)) * (1 + 0.04 * Math.sin(u * 9));
  if (s <= 0.001) return;
  const size = c.size ?? 150;
  ctx.save();
  ctx.translate(c.x, c.y + (c.drift ?? -40) * u);
  ctx.rotate((c.rot ?? 0) + Math.sin(u * 12) * 0.025 * Math.exp(-u * 3));
  ctx.scale(s, s);
  if (c.burst) burst(ctx, size * (c.burstR ?? 1.6), 11, c.burstColor || '#ffffff');
  ctx.font = `${size}px Lucky`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const depth = Math.max(4, Math.round(size / 16));
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.17; ctx.strokeStyle = '#111114';
  for (let i = depth; i > 0; i--) { ctx.strokeText(c.text, i * 0.9, i * 1.3); }
  ctx.fillStyle = '#111114'; ctx.fillText(c.text, depth * 0.9, depth * 1.3);
  ctx.strokeText(c.text, 0, 0);
  const g = ctx.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
  const base = c.fill || '#ffd21f';
  g.addColorStop(0, c.fill2 || lighten(base)); g.addColorStop(1, base);
  ctx.fillStyle = g; ctx.fillText(c.text, 0, 0);
  ctx.restore();
}
function lighten(hex) {
  const n = parseInt(hex.slice(1), 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const L = x => Math.round(x + (255 - x) * 0.45); return `rgb(${L(r)},${L(g)},${L(b)})`;
}
function impactLines(ctx, t, c) {
  const u = t - c.t; if (u < 0 || u > (c.dur ?? 0.35)) return;
  const a = 1 - u / (c.dur ?? 0.35);
  ctx.save(); ctx.translate(c.x ?? W / 2, c.y ?? H / 2); ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
  for (let i = 0; i < 28; i++) {
    const ang = i / 28 * Math.PI * 2 + (i % 3) * 0.05; const r0 = 520 + (i * 97 % 160) - u * 300, r1 = 1500;
    const wdt = 0.012 + (i % 4) * 0.004;
    ctx.beginPath(); ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0); ctx.lineTo(Math.cos(ang - wdt) * r1, Math.sin(ang - wdt) * r1); ctx.lineTo(Math.cos(ang + wdt) * r1, Math.sin(ang + wdt) * r1); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export function drawOverlay(ctx, f, t, { chunks, comics, dyn, flashes, captionY }) {
  ctx.clearRect(0, 0, W, H);
  // vignette
  const g = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.32, W / 2, H * 0.5, H * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const c of comics) if (c.lines) impactLines(ctx, t, c);
  for (const c of dyn) if (c.lines) impactLines(ctx, t, c);
  for (const c of comics) drawComic(ctx, t, c);
  for (const c of dyn) drawComic(ctx, t, c);
  drawCaption(ctx, t, chunks, captionY);
  for (const fl of flashes) {
    const u = t - fl.t; if (u >= 0 && u < (fl.dur ?? 0.25)) { ctx.fillStyle = `rgba(${fl.color || '255,255,255'},${(1 - u / (fl.dur ?? 0.25)) * (fl.a ?? 0.9)})`; ctx.fillRect(0, 0, W, H); }
  }
}
