// Microscopy and water: a procedural amoeba (Naegleria-like limax form), the round
// microscope field, glowing X-ray amoebas, water drops, a glass slide, splash
// droplets, drips, bubbles and steam.
import { clamp, lerp, ease, prog, rng, hash, noise1, makeCanvas, rgba } from './util.js';
import { FONTS } from './assets.js';
import { Actor, Scene } from './timeline.js';
import { setFont, cached, paperTexture } from './draw.js';

const TAU = Math.PI * 2;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// closed smooth path through points (quadratic curves through the midpoints)
export function smoothPath(pts) {
  const p = new Path2D(), n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const a = pts[i], m = mid(a, pts[(i + 1) % n]);
    p.quadraticCurveTo(a[0], a[1], m[0], m[1]);
  }
  p.closePath();
  return p;
}

// ---------------------------------------------------------------- amoeba
// Outline in body units (half-width = 1), heading +x. Blunt lobopodia erupt at
// the front one after another (quick bulge, then the body flows into them); the
// rear (uroid) stays narrow with a few knobs.
export function amoebaOutline(t, seed = 1, o = {}) {
  const A = o.length ?? 1.55, B = o.width ?? 0.95;
  const period = o.period ?? 2.6, lobes = o.lobes ?? 3, n = o.n ?? 84;
  const L = [];
  for (let k = 0; k < lobes; k++) {
    const tt = t / period + k / lobes + hash(seed * 13.1 + k);
    const cyc = Math.floor(tt), ph = tt - cyc;
    const spread = o.spread ?? 1.9;
    const ang = (hash(seed * 31.7 + k * 7.3 + cyc * 3.7) - 0.5) * spread;
    const grow = ph < 0.28 ? ease.outCubic(ph / 0.28) : 1 - ease.inOutQuad((ph - 0.28) / 0.72);
    L.push({ ang, amp: (o.amp ?? 0.72) * grow * (0.7 + 0.3 * hash(seed + cyc * 1.3 + k)), w: 0.42 + 0.2 * hash(seed * 5.1 + cyc + k) });
  }
  const pts = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU, c = Math.cos(th), s = Math.sin(th);
    let r = (A * B) / Math.sqrt((B * c) ** 2 + (A * s) ** 2);
    const back = Math.exp(-((wrapA(th - Math.PI) / 0.55) ** 2));
    r *= 1 - 0.16 * back;
    for (const l of L) { const d = wrapA(th - l.ang); r += l.amp * Math.exp(-((d / l.w) ** 2)); }
    r += 0.035 * Math.sin(3 * th + t * 1.3 + seed) + 0.025 * Math.sin(5 * th - t * 0.9 + seed * 2) + 0.03 * back * Math.sin(11 * th + t * 2);
    pts.push([c * r, s * r]);
  }
  return pts;
}

function granules(seed, A, B) {
  return cached(`granules:${seed}:${A}:${B}`, () => {
    const r = rng(seed * 977 + 13), out = [];
    while (out.length < 170) {
      const x = (r() * 2 - 1) * A * 0.9, y = (r() * 2 - 1) * B * 0.86;
      if ((x / (A * 0.9)) ** 2 + (y / (B * 0.86)) ** 2 > 1 || x > A * 0.42) continue;
      const kind = r();
      out.push({ x, y, ph: r() * TAU, f: 0.4 + r() * 0.9, kind, s: kind < 0.62 ? 0.03 + r() * 0.035 : 0.018 + r() * 0.02 });
    }
    return out;
  });
}

// Draw one amoeba. size = half-width in px. Microscope (bright-field) colours.
export function drawAmoeba(ctx, x, y, size, t, o = {}) {
  const seed = o.seed ?? 1, A = o.length ?? 1.55, B = o.width ?? 0.95;
  const pts = amoebaOutline(t, seed, o);
  const path = smoothPath(pts);
  const u = 1 / size; // one pixel in body units
  ctx.save();
  ctx.translate(x, y); ctx.rotate(o.heading ?? 0); ctx.scale(size, size);
  ctx.globalAlpha *= o.alpha ?? 1;
  // soft bright halo (phase-contrast look)
  for (const [w, a] of [[0.62, 0.07], [0.36, 0.1], [0.18, 0.16]]) {
    ctx.strokeStyle = `rgba(255,255,242,${a})`; ctx.lineWidth = w; ctx.stroke(path);
  }
  // cytoplasm
  const g = ctx.createRadialGradient(-0.35, 0.05, 0.1, -0.2, 0, A + 0.6);
  g.addColorStop(0, 'rgba(104,112,76,0.58)'); g.addColorStop(0.55, 'rgba(132,140,98,0.44)'); g.addColorStop(1, 'rgba(176,182,136,0.3)');
  ctx.fillStyle = g; ctx.fill(path);
  ctx.save(); ctx.clip(path);
  // clear (hyaline) front where the lobes erupt
  const hg = ctx.createLinearGradient(A * 0.25, 0, A + 0.7, 0);
  hg.addColorStop(0, 'rgba(250,252,236,0)'); hg.addColorStop(1, 'rgba(250,252,236,0.5)');
  ctx.fillStyle = hg; ctx.fillRect(A * 0.25, -3, 3, 6);
  // granular inside, gently streaming
  for (const gr of granules(seed, A, B)) {
    const gx = gr.x + 0.05 * Math.sin(t * gr.f + gr.ph) + 0.04 * ((t * 0.12 * gr.f + gr.ph) % 1);
    const gy = gr.y + 0.04 * Math.cos(t * gr.f * 0.8 + gr.ph);
    if (gr.kind < 0.62) { ctx.fillStyle = 'rgba(66,74,44,0.5)'; }
    else { ctx.fillStyle = 'rgba(255,255,236,0.85)'; }
    ctx.beginPath(); ctx.arc(gx, gy, gr.s, 0, TAU); ctx.fill();
  }
  // food vacuoles
  const r = rng(seed * 41 + 5);
  for (let i = 0; i < 3; i++) {
    const fx = -A * 0.55 + r() * A * 0.8, fy = (r() - 0.5) * B * 1.0, fr = 0.1 + r() * 0.06;
    const ox = 0.03 * Math.sin(t * 0.7 + i);
    ctx.fillStyle = 'rgba(150,140,90,0.35)'; ctx.strokeStyle = 'rgba(70,78,48,0.55)'; ctx.lineWidth = 1.2 * u;
    ctx.beginPath(); ctx.arc(fx + ox, fy, fr, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(60,55,30,0.55)'; ctx.beginPath(); ctx.arc(fx + ox + 0.02, fy + 0.02, fr * 0.4, 0, TAU); ctx.fill();
  }
  // nucleus with a big dark nucleolus (the "dark dot")
  const nx = -0.28 + 0.03 * Math.sin(t * 0.5 + seed), ny = 0.1;
  ctx.fillStyle = 'rgba(232,236,212,0.62)'; ctx.strokeStyle = 'rgba(62,70,42,0.7)'; ctx.lineWidth = 2 * u;
  ctx.beginPath(); ctx.arc(nx, ny, 0.31, 0, TAU); ctx.fill(); ctx.stroke();
  const ng = ctx.createRadialGradient(nx - 0.04, ny - 0.04, 0.01, nx, ny, 0.17);
  ng.addColorStop(0, 'rgba(70,74,46,0.95)'); ng.addColorStop(1, 'rgba(40,44,24,0.95)');
  ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(nx, ny, 0.165, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,240,0.45)'; ctx.beginPath(); ctx.arc(nx - 0.05, ny - 0.06, 0.04, 0, TAU); ctx.fill();
  // contractile vacuole: fills slowly, empties fast
  const cyc = ((t + seed * 0.37) / 3.6) % 1;
  const cr = cyc < 0.9 ? 0.27 * ease.outQuad(cyc / 0.9) : 0.27 * (1 - (cyc - 0.9) / 0.1);
  if (cr > 0.02) {
    ctx.fillStyle = 'rgba(246,249,234,0.6)'; ctx.strokeStyle = 'rgba(84,94,62,0.5)'; ctx.lineWidth = 1.4 * u;
    ctx.beginPath(); ctx.arc(-A * 0.66, -0.3, cr, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  // membrane: thin dark line + inner light line
  ctx.strokeStyle = 'rgba(50,58,32,0.86)'; ctx.lineWidth = 2.8 * u; ctx.stroke(path);
  ctx.save(); ctx.scale(0.962, 0.962); ctx.strokeStyle = 'rgba(255,255,240,0.38)'; ctx.lineWidth = 1.6 * u; ctx.stroke(path); ctx.restore();
  // trailing filaments at the uroid
  ctx.strokeStyle = 'rgba(70,80,50,0.55)'; ctx.lineWidth = 1.4 * u; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const yy = (i - 1.5) * 0.11, x0 = -A * 0.86;
    ctx.beginPath(); ctx.moveTo(x0, yy);
    ctx.quadraticCurveTo(x0 - 0.12, yy + 0.05 * Math.sin(t * 2 + i), x0 - 0.2 - 0.04 * i % 2, yy * 1.4);
    ctx.stroke();
  }
  ctx.restore();
}

// position along a slow, eruptive crawl (bursts forward as each lobe fills)
export function crawl(t, speed, period = 2.6) {
  return speed * (t + 0.1 * period * Math.sin((TAU * t) / period));
}

// ---------------------------------------------------------------- microscope field
function scopeDebris(R, seed) {
  return cached(`scopeDebris:${Math.round(R)}:${seed}`, () => {
    const c = makeCanvas(R * 2, R * 2), x = c.getContext('2d'), r = rng(seed * 7 + 1);
    x.filter = 'blur(6px)';
    for (let i = 0; i < 16; i++) {
      x.fillStyle = r() < 0.6 ? `rgba(90,100,60,${0.05 + r() * 0.08})` : `rgba(255,255,240,${0.12 + r() * 0.1})`;
      x.beginPath(); x.arc(r() * R * 2, r() * R * 2, R * (0.03 + r() * 0.09), 0, TAU); x.fill();
    }
    x.filter = 'blur(1.2px)';
    for (let i = 0; i < 80; i++) {
      x.fillStyle = `rgba(70,76,48,${0.15 + r() * 0.3})`;
      x.beginPath(); x.arc(r() * R * 2, r() * R * 2, 0.8 + r() * 1.8, 0, TAU); x.fill();
    }
    return c;
  });
}

// The round view down a microscope: bright greenish field, drifting bacteria and
// specks, an optional draw() for amoebas, a reticle with a scale bar, vignette, rim.
export function drawScopeField(ctx, cx, cy, R, t, o = {}) {
  const seed = o.seed ?? 7;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
  const g = ctx.createRadialGradient(cx - R * 0.15, cy - R * 0.2, R * 0.05, cx, cy, R);
  g.addColorStop(0, '#f4f2db'); g.addColorStop(0.55, '#e2e4c3'); g.addColorStop(1, '#bfc29b');
  ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  const dx = noise1(t * 0.2, seed) * R * 0.03, dy = noise1(t * 0.17, seed + 5) * R * 0.03;
  ctx.drawImage(scopeDebris(R, seed), cx - R + dx, cy - R + dy);
  const r = rng(seed * 11 + 3), k = R / 300;
  for (let i = 0; i < (o.bacteria ?? 24); i++) {
    const bx = cx + (r() * 2 - 1) * R + noise1(t * 0.6 + i, seed + i) * 14 * k;
    const by = cy + (r() * 2 - 1) * R + noise1(t * 0.5 + i * 2, seed + i * 3) * 14 * k;
    const ang = r() * TAU + t * (r() - 0.5) * 0.6;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(78,88,52,0.55)';
    ctx.beginPath(); ctx.roundRect(-5 * k, -1.6 * k, 10 * k, 3.2 * k, 1.6 * k); ctx.fill();
    ctx.restore();
  }
  if (o.draw) o.draw(ctx, cx, cy, R, t);
  if (o.reticle !== false) {
    ctx.strokeStyle = 'rgba(40,42,26,0.22)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    for (let i = -10; i <= 10; i++) {
      const tx = cx + i * R * 0.07, hh = i % 5 === 0 ? 12 : 6;
      ctx.beginPath(); ctx.moveTo(tx, cy - hh); ctx.lineTo(tx, cy + hh); ctx.stroke();
    }
    // scale bar
    const sb = R * 0.32, sx = cx - sb / 2, sy = cy + R * 0.7;
    ctx.fillStyle = 'rgba(30,30,18,0.7)'; ctx.fillRect(sx, sy, sb, 4 * k + 2);
    setFont(ctx, FONTS.type, Math.max(14, 20 * k)); ctx.textAlign = 'center';
    ctx.fillText(o.scaleLabel || '10 µm', cx, sy - 8);
    ctx.textAlign = 'left';
  }
  const v = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R);
  v.addColorStop(0, 'rgba(28,26,14,0)'); v.addColorStop(0.85, 'rgba(28,26,14,0.28)'); v.addColorStop(1, 'rgba(28,26,14,0.7)');
  ctx.fillStyle = v; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.restore();
  if (o.rim !== false) {
    ctx.save();
    ctx.shadowColor = 'rgba(30,18,6,0.45)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    ctx.strokeStyle = '#1d1912'; ctx.lineWidth = R * 0.075;
    ctx.beginPath(); ctx.arc(cx, cy, R + R * 0.037, 0, TAU); ctx.stroke();
    ctx.shadowColor = 'transparent';
    const rg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    rg.addColorStop(0, '#e9cd88'); rg.addColorStop(0.4, '#a9823a'); rg.addColorStop(1, '#4e3812');
    ctx.strokeStyle = rg; ctx.lineWidth = Math.max(4, R * 0.022);
    ctx.beginPath(); ctx.arc(cx, cy, R + R * 0.085, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  if (o.label) {
    ctx.save(); setFont(ctx, FONTS.type, 22); ctx.letterSpacing = '4px';
    ctx.fillStyle = o.labelColor || 'rgba(48,30,12,0.85)'; ctx.textAlign = 'center';
    ctx.fillText(o.label, cx, cy + R + R * 0.085 + 46);
    ctx.restore();
  }
}

// Actor: microscope field with amoebas crawling across it.
export class Scope extends Actor {
  constructor(scene, o) {
    super({ layer: o.layer || 'world', z: 20, ...o });
    if (o.sfx !== false) scene.sfx(this.at, 'click', 0.6);
  }
  draw(ctx, t, s) {
    const o = this.o, lt = t - this.at;
    const p = prog(t, this.at, o.enterDur ?? 0.4, ease.outBack);
    const [cx, cy] = typeof o.pos === 'function' ? o.pos(t, s) : (o.pos || [540, 1000]);
    const R = (o.r ?? 300) * lerp(0.6, 1, p);
    ctx.save(); ctx.globalAlpha *= clamp(lt / 0.12) * (o.alpha ?? 1);
    // focus pull: slight blur that clears
    const f = o.focusFrom ? 1 - prog(t, this.at, o.focusDur ?? 0.7, ease.outCubic) : 0;
    if (f > 0.01) ctx.filter = `blur(${f * (o.focusFrom ?? 6)}px)`;
    drawScopeField(ctx, cx, cy, R, t, {
      seed: o.seed ?? 7, label: o.label, scaleLabel: o.scaleLabel, reticle: o.reticle,
      draw: (c, X, Y, RR, tt) => {
        for (const am of o.amoebas || [{}]) {
          const sp = am.speed ?? 0.06;
          const d = crawl(tt - this.at, sp * RR, am.period ?? 2.6);
          const h = am.heading ?? -0.35;
          const x0 = X + (am.x ?? -0.3) * RR, y0 = Y + (am.y ?? 0.15) * RR;
          drawAmoeba(c, x0 + Math.cos(h) * d, y0 + Math.sin(h) * d, (am.size ?? 0.17) * RR, tt + (am.seed ?? 1) * 3, { seed: am.seed ?? 1, heading: h + noise1(tt * 0.15, am.seed ?? 1) * 0.12 });
        }
        if (o.drawInside) o.drawInside(c, X, Y, RR, tt);
      },
    });
    ctx.restore();
  }
}

// ---------------------------------------------------------------- X-ray amoebas
export function glowAmoeba(ctx, x, y, r, t, seed = 1, a = 1, heading = 0) {
  const pts = amoebaOutline(t * 1.7, seed, { n: 30, amp: 0.55, length: 1.45, width: 0.95, lobes: 2, period: 1.5 });
  const p = smoothPath(pts);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(heading); ctx.scale(r, r);
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = `rgba(255,90,30,${0.95 * a})`; ctx.shadowBlur = Math.max(10, r * 1.6);
  ctx.fillStyle = `rgba(255,108,44,${0.62 * a})`; ctx.fill(p);
  ctx.shadowBlur = 0;
  ctx.save(); ctx.scale(0.62, 0.62); ctx.fillStyle = `rgba(255,178,110,${0.42 * a})`; ctx.fill(p); ctx.restore();
  ctx.fillStyle = `rgba(255,242,220,${0.95 * a})`;
  ctx.beginPath(); ctx.arc(-0.3, 0.08, 0.34, 0, TAU); ctx.fill();
  ctx.restore();
}

// point and direction at fraction u along a polyline
export function along(pts, u) {
  let L = 0; const seg = [];
  for (let k = 1; k < pts.length; k++) { const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); seg.push(l); L += l; }
  let d = clamp(u) * L, k = 0;
  while (k < seg.length - 1 && d > seg[k]) { d -= seg[k]; k++; }
  const f = seg[k] ? Math.min(1, d / seg[k]) : 0;
  const a = pts[k], b = pts[k + 1] || pts[k];
  return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), ang: Math.atan2(b[1] - a[1], b[0] - a[0]), len: L };
}

// Actor: a stream of glowing amoebas travelling along a path (world coords).
export class Swarm extends Actor {
  constructor(scene, o) {
    super({ layer: o.layer || 'world', z: 34, ...o });
    const r = rng(o.seed ?? 9);
    this.items = Array.from({ length: o.count ?? 7 }, (_, i) => ({ delay: i * (o.gap ?? 0.22) + r() * 0.08, off: (r() - 0.5) * (o.spread ?? 14), seed: 1 + i * 3.1, size: (o.size ?? 11) * (0.75 + r() * 0.5) }));
    if (o.sfx !== false) scene.sfx(this.at, 'hum', o.gain ?? 0.35);
  }
  draw(ctx, t, s) {
    const o = this.o;
    const pts = typeof o.path === 'function' ? o.path(t, s) : o.path;
    for (const it of this.items) {
      const u = prog(t, this.at + it.delay, o.dur ?? 2.0, o.ease || ease.inOutQuad);
      if (t < this.at + it.delay) continue;
      const q = along(pts, u);
      const nx = -Math.sin(q.ang), ny = Math.cos(q.ang);
      const a = (o.hold === false && u >= 1) ? 1 - prog(t, this.at + it.delay + (o.dur ?? 2), 0.4) : clamp((t - this.at - it.delay) / 0.2);
      if (a <= 0) continue;
      glowAmoeba(ctx, q.x + nx * it.off, q.y + ny * it.off, it.size, t, it.seed, a, q.ang);
    }
  }
}

// ---------------------------------------------------------------- water
// A drop sitting on glass, seen slightly from above. rx, ry = footprint radii.
export function drawDrop(ctx, x, y, rx, ry, o = {}) {
  ctx.save();
  // contact shadow + caustic on the glass
  ctx.save(); ctx.filter = 'blur(8px)'; ctx.fillStyle = 'rgba(30,40,25,0.22)';
  ctx.beginPath(); ctx.ellipse(x + rx * 0.16, y + ry * 0.3, rx * 1.02, ry * 0.95, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = 'blur(6px)';
  ctx.fillStyle = 'rgba(255,250,215,0.55)';
  ctx.beginPath(); ctx.ellipse(x + rx * 0.35, y + ry * 0.5, rx * 0.45, ry * 0.3, 0, 0, TAU); ctx.fill(); ctx.restore();
  // body: clear water, darker at the refracting rim, a pond-green tint
  const g = ctx.createRadialGradient(x - rx * 0.15, y - ry * 0.2, rx * 0.1, x, y, rx * 1.02);
  g.addColorStop(0, o.tint0 || 'rgba(214,232,205,0.30)');
  g.addColorStop(0.7, o.tint1 || 'rgba(150,182,140,0.36)');
  g.addColorStop(1, o.tint2 || 'rgba(70,98,72,0.62)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  if (o.inside) { ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, rx * 0.94, ry * 0.94, 0, 0, TAU); ctx.clip(); o.inside(ctx, x, y, rx, ry); ctx.restore(); }
  // inner bright crescent (light focused through the drop)
  ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.clip();
  const cg = ctx.createRadialGradient(x + rx * 0.3, y + ry * 0.42, 2, x + rx * 0.3, y + ry * 0.42, rx * 0.7);
  cg.addColorStop(0, 'rgba(255,255,236,0.55)'); cg.addColorStop(1, 'rgba(255,255,236,0)');
  ctx.fillStyle = cg; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(52,72,52,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.stroke();
  // highlights
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.ellipse(x - rx * 0.45, y - ry * 0.42, rx * 0.16, ry * 0.11, -0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(x - rx * 0.2, y - ry * 0.55, rx * 0.34, ry * 0.12, -0.2, 0, TAU); ctx.fill();
  ctx.restore();
}

// A falling / hanging drop (teardrop). stretch > 1 elongates it upward.
export function drawFallingDrop(ctx, x, y, r, stretch = 1.3, a = 1) {
  ctx.save(); ctx.globalAlpha *= a;
  ctx.translate(x, y);
  const p = new Path2D();
  p.moveTo(0, -r * stretch * 1.6);
  p.bezierCurveTo(r * 0.35, -r * stretch * 0.9, r, -r * 0.3, r, r * 0.15);
  p.arc(0, r * 0.15, r, 0, Math.PI);
  p.bezierCurveTo(-r, -r * 0.3, -r * 0.35, -r * stretch * 0.9, 0, -r * stretch * 1.6);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.2, r * 0.1, 0, 0, r * 1.4);
  g.addColorStop(0, 'rgba(235,245,236,0.55)'); g.addColorStop(0.7, 'rgba(150,185,175,0.55)'); g.addColorStop(1, 'rgba(70,100,92,0.8)');
  ctx.fillStyle = g; ctx.fill(p);
  ctx.strokeStyle = 'rgba(48,70,62,0.6)'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.stroke(p);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.1, r * 0.18, r * 0.28, 0.3, 0, TAU); ctx.fill();
  ctx.restore();
}

// Microscope slide on the paper, with a paper label at the right end.
export function drawSlide(ctx, x, y, w, h, o = {}) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(((o.rot ?? -3) * Math.PI) / 180);
  ctx.save(); ctx.filter = 'blur(14px)'; ctx.fillStyle = 'rgba(30,20,8,0.32)'; ctx.fillRect(-w / 2 + 12, -h / 2 + 18, w, h); ctx.restore();
  ctx.fillStyle = 'rgba(214,234,226,0.30)'; ctx.fillRect(-w / 2, -h / 2, w, h);
  // diagonal sheen
  const sg = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  sg.addColorStop(0.2, 'rgba(255,255,255,0)'); sg.addColorStop(0.32, 'rgba(255,255,255,0.22)'); sg.addColorStop(0.42, 'rgba(255,255,255,0)');
  sg.addColorStop(0.62, 'rgba(255,255,255,0)'); sg.addColorStop(0.67, 'rgba(255,255,255,0.12)'); sg.addColorStop(0.72, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg; ctx.fillRect(-w / 2, -h / 2, w, h);
  // glass edges
  ctx.fillStyle = 'rgba(110,150,135,0.5)'; ctx.fillRect(-w / 2, h / 2 - 6, w, 6); ctx.fillRect(w / 2 - 5, -h / 2, 5, h);
  ctx.strokeStyle = 'rgba(70,100,90,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, 2);
  // paper label
  const lw = w * 0.24;
  ctx.drawImage(paperTexture(Math.round(lw), Math.round(h - 16), '#efe5cc', 71, true), w / 2 - lw - 8, -h / 2 + 8);
  setFont(ctx, FONTS.type, o.labelSize ?? 22); ctx.fillStyle = 'rgba(40,26,10,0.88)'; ctx.letterSpacing = '2px';
  const lines = (o.label || 'POND WATER\nNo. 02').split('\n');
  lines.forEach((ln, i) => ctx.fillText(ln, w / 2 - lw + 6, -h / 2 + 48 + i * ((o.labelSize ?? 22) + 12)));
  ctx.letterSpacing = '0px';
  ctx.restore();
}

// ---------------------------------------------------------------- particles
// Splash droplets thrown from a point (world coords), falling under gravity.
export class Droplets extends Actor {
  constructor(scene, o) {
    super({ layer: o.layer || 'world', z: 55, ...o });
    const r = rng(o.seed ?? 5), [a0, a1] = o.angle || [-Math.PI * 0.95, -Math.PI * 0.05], [v0, v1] = o.speed || [500, 1300];
    this.p = Array.from({ length: o.count ?? 40 }, () => {
      const a = lerp(a0, a1, r()), v = lerp(v0, v1, r());
      return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: lerp(...(o.size || [4, 13]), r() ** 1.6), d: r() * (o.spreadT ?? 0.08), ox: (r() - 0.5) * (o.width ?? 120) };
    });
    if (o.sfx) scene.sfx(this.at, o.sfx, o.gain ?? 0.9);
  }
  draw(ctx, t, s) {
    const o = this.o, g = o.gravity ?? 2600, life = o.life ?? 1.1;
    const [x0, y0] = typeof o.origin === 'function' ? o.origin(t, s) : o.origin;
    for (const p of this.p) {
      const dt = t - this.at - p.d;
      if (dt < 0 || dt > life) continue;
      const x = x0 + p.ox + p.vx * dt, y = y0 + p.vy * dt + 0.5 * g * dt * dt;
      if (o.floor !== undefined && y > o.floor) continue;
      const a = 1 - clamp((dt - life * 0.6) / (life * 0.4));
      const vy = p.vy + g * dt, ang = Math.atan2(vy, p.vx);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2);
      drawFallingDrop(ctx, 0, 0, p.r, 1 + clamp(Math.hypot(p.vx, vy) / 1800) * 0.8, a * (o.alpha ?? 1));
      ctx.restore();
    }
  }
}

// Drops forming at a tap mouth and falling into a pot. Registers a 'drip' per landing.
export class Drip extends Actor {
  constructor(scene, o) {
    super({ layer: o.layer || 'world', z: 45, ...o });
    this.period = o.period ?? 1.1;
    this.fall = o.fallDur ?? 0.32;
    const end = Math.min(scene.dur + 2, o.until ?? scene.dur + 2);
    if (o.sfx !== false) for (let k = 0, t0 = this.at; t0 + this.period < end; k++, t0 += this.period) scene.sfx(t0 + this.period * 0.72 + this.fall, 'drip', o.gain ?? 0.6, { v: k % 4 });
  }
  draw(ctx, t, s) {
    const o = this.o, lt = t - this.at;
    if (lt < 0) return;
    const [mx, my] = typeof o.from === 'function' ? o.from(t, s) : o.from;
    const ty = typeof o.to === 'function' ? o.to(t, s) : o.to;
    const ph = (lt % this.period) / this.period, k = Math.floor(lt / this.period);
    const r = o.r ?? 13;
    const grow = clamp(ph / 0.72);
    // hanging drop swelling at the mouth
    if (ph < 0.72 || o.keep) drawFallingDrop(ctx, mx, my + r * 0.6 * grow, r * (0.35 + 0.65 * ease.outQuad(grow)), 0.6 + 0.6 * grow);
    // falling drop from this cycle, and the landing ripple
    const tf = (ph - 0.72) * this.period;
    if (ph >= 0.72 && tf < this.fall) {
      const u = ease.inQuad(tf / this.fall);
      drawFallingDrop(ctx, mx, lerp(my + r, ty, u), r, 1.5);
    }
    const tl = (ph - 0.72) * this.period - this.fall;
    if (tl >= 0 && tl < 0.45) {
      const q = tl / 0.45;
      ctx.save(); ctx.strokeStyle = `rgba(230,240,235,${0.7 * (1 - q)})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(mx, ty, 10 + 40 * q, 3 + 9 * q, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (o.onDrop) o.onDrop(ctx, t, k, ph);
  }
}

// Bubbles rising (e.g. under water).
export class Bubbles extends Actor {
  constructor(scene, o) {
    super({ layer: o.layer || 'world', z: 52, ...o });
    const r = rng(o.seed ?? 3);
    this.b = Array.from({ length: o.count ?? 18 }, () => ({ x: (r() - 0.5) * (o.width ?? 200), d: r() * (o.spreadT ?? 1.2), r: 3 + r() ** 2 * (o.maxR ?? 14), v: 160 + r() * 220, ph: r() * 6 }));
    if (o.sfx !== false) scene.sfx(this.at, 'bubbles', o.gain ?? 0.6);
  }
  draw(ctx, t, s) {
    const o = this.o, [x0, y0] = typeof o.origin === 'function' ? o.origin(t, s) : o.origin;
    for (const b of this.b) {
      const dt = t - this.at - b.d;
      if (dt < 0 || dt > (o.life ?? 1.6)) continue;
      const y = y0 - b.v * dt, x = x0 + b.x + Math.sin(dt * 7 + b.ph) * 6;
      if (o.top !== undefined && y < o.top) continue;
      const a = clamp(dt / 0.15) * (1 - clamp((dt - (o.life ?? 1.6) + 0.3) / 0.3));
      ctx.save(); ctx.globalAlpha *= a;
      ctx.strokeStyle = 'rgba(240,248,245,0.8)'; ctx.lineWidth = 1.6; ctx.fillStyle = 'rgba(220,240,235,0.18)';
      ctx.beginPath(); ctx.arc(x, y, b.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x - b.r * 0.35, y - b.r * 0.35, b.r * 0.25, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
}

// Soft steam wisps rising from one or more points.
function puff() {
  return cached('steamPuff', () => {
    const c = makeCanvas(128, 128), x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,253,246,0.55)'); g.addColorStop(0.5, 'rgba(255,253,246,0.22)'); g.addColorStop(1, 'rgba(255,253,246,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return c;
  });
}
export class Steam extends Actor {
  constructor(scene, o) {
    super({ layer: o.layer || 'world', z: 48, ...o });
    if (o.sfx !== false) scene.sfx(this.at, 'steam', o.gain ?? 0.4);
  }
  draw(ctx, t, s) {
    const o = this.o, lt = t - this.at, P = puff();
    const pts = typeof o.from === 'function' ? o.from(t, s) : o.from;
    const list = Array.isArray(pts[0]) ? pts : [pts];
    const rise = o.rise ?? 260, size = o.size ?? 40, n = o.count ?? 14, life = o.life ?? 2.2;
    ctx.save(); ctx.globalAlpha *= clamp(lt / 0.5) * (o.alpha ?? 0.9);
    list.forEach(([x0, y0], w) => {
      for (let i = 0; i < n; i++) {
        const age = ((lt + (i / n) * life + w * 0.37) % life) / life;
        const y = y0 - age * rise, x = x0 + Math.sin(age * 5 + i * 1.7 + w) * 18 * age + (o.drift ?? 20) * age;
        const sz = size * (0.5 + age * 1.6);
        ctx.globalAlpha = clamp(lt / 0.5) * (o.alpha ?? 0.9) * Math.sin(age * Math.PI) * 0.8;
        ctx.drawImage(P, x - sz / 2, y - sz / 2, sz, sz);
      }
    });
    ctx.restore();
  }
}

Object.assign(Scene.prototype, {
  scope(o = {}) { return this.add(new Scope(this, o)); },
  swarm(o = {}) { return this.add(new Swarm(this, o)); },
  droplets(o = {}) { return this.add(new Droplets(this, o)); },
  drip(o = {}) { return this.add(new Drip(this, o)); },
  bubbles(o = {}) { return this.add(new Bubbles(this, o)); },
  steam(o = {}) { return this.add(new Steam(this, o)); },
});
