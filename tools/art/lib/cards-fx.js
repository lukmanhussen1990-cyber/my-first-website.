/*
 * Card dressing for the Border Trials card art: swirling smoke bursts,
 * sparks / embers, inset double frames with wear, corner filigree, metallic
 * worn edges and fine paper/metal texture. Procedural Canvas2D only.
 */
import { rng, noiseField, layer } from './paint.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

/**
 * Smoke burst around (cx, cy): domain-warped fBm, radial streaks, a dark halo
 * right behind the symbol, falling off toward the card edges.
 * palette: array of [stop, [r,g,b]] from thin → dense smoke.
 */
export function smokeBurst(ctx, W, H, o) {
  const step = o.step ?? 2;
  const lw = Math.ceil(W / step), lh = Math.ceil(H / step);
  const { c, ctx: l } = layer(lw, lh);
  const img = l.createImageData(lw, lh);
  const s = W / 900; // frequencies are tuned for a 900px-wide canvas
  const n1 = noiseField(W, H, { seed: o.seed, scale: 0.0042 / s, octaves: 6, gain: 0.55 });
  const n2 = noiseField(W, H, { seed: o.seed + 1, scale: 0.0031 / s, octaves: 4 });
  const n3 = noiseField(W, H, { seed: o.seed + 2, scale: 0.0031 / s, octaves: 4 });
  const streakN = noiseField(W, H, { seed: o.seed + 3, scale: 1, octaves: 4, gain: 0.6 });
  const R = o.radius * W;
  const inner = (o.inner ?? 0.42) * R;
  const pal = o.palette;
  const sample = (v) => {
    v = clamp01(v);
    for (let k = 1; k < pal.length; k++) {
      if (v <= pal[k][0]) {
        const t = (v - pal[k - 1][0]) / (pal[k][0] - pal[k - 1][0]);
        const a = pal[k - 1][1], b = pal[k][1];
        return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
      }
    }
    return pal[pal.length - 1][1];
  };
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const X = x * step, Y = y * step;
      const dx = X - o.cx, dy = (Y - o.cy) * (o.squash ?? 0.82);
      const r = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      // domain warp (swirl)
      const wx = X + (n2(X, Y) - 0.5) * 260 * s + Math.sin(ang * 2 + r * 0.004 / s) * 40 * s;
      const wy = Y + (n3(X, Y) - 0.5) * 260 * s;
      const smokeV = n1(wx, wy);
      // radial streaks — sample noise around the circle so it wraps
      const st = streakN(Math.cos(ang) * 6 + 40, Math.sin(ang) * 6 + r * 0.006 / s + 40);
      const ring = smooth(inner * 0.55, inner * 1.15, r) * (1 - smooth(R * 0.75, R * 1.45, r));
      let dens = ring * (0.25 + 1.15 * Math.max(0, smokeV - 0.32)) * (0.65 + 0.85 * st);
      dens += (1 - smooth(0, R * 1.6, r)) * 0.12 * smokeV; // faint fill everywhere
      dens *= o.intensity ?? 1;
      if (o.mask) dens *= o.mask(X / W, Y / H);
      const col = sample(dens);
      const i = (y * lw + x) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255 * clamp01(dens * 1.6);
    }
  }
  l.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.globalCompositeOperation = o.blend ?? 'source-over';
  ctx.drawImage(c, 0, 0, W, H);
  ctx.restore();
}

/** Glowing sparks / embers flying out of the centre. */
export function sparks(ctx, W, H, o) {
  const r = rng(o.seed);
  const s = W / 900;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < o.count; i++) {
    const ang = r() * Math.PI * 2;
    const rad = (o.r0 + Math.pow(r(), 0.7) * (o.r1 - o.r0)) * W;
    const x = o.cx + Math.cos(ang) * rad;
    const y = o.cy + Math.sin(ang) * rad * 1.1;
    if (o.mask && o.mask(x / W, y / H) < r()) continue;
    const size = (0.8 + Math.pow(r(), 3) * 3.2) * s * 1.5;
    const col = o.colors[Math.floor(r() * o.colors.length)];
    const a = 0.35 + r() * 0.65;
    // glow
    const g = ctx.createRadialGradient(x, y, 0, x, y, size * 5);
    g.addColorStop(0, `rgba(${col},${a * 0.5})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - size * 5, y - size * 5, size * 10, size * 10);
    // streak (motion trail, radial)
    if (r() < (o.streaks ?? 0.35)) {
      const len = (6 + r() * 26) * s * 1.5;
      ctx.strokeStyle = `rgba(${col},${a * 0.7})`;
      ctx.lineWidth = size * 0.7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len * 1.1);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,${o.hot ?? 235},${o.hot ?? 225},${a})`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Small dark shards with a lit edge, scattered around the symbol (shatter accent). */
export function shards(ctx, W, H, o) {
  const r = rng(o.seed);
  const s = W / 900;
  ctx.save();
  for (let i = 0; i < o.count; i++) {
    const ang = r() * Math.PI * 2;
    const rad = (o.r0 + r() * (o.r1 - o.r0)) * W;
    const x = o.cx + Math.cos(ang) * rad;
    const y = o.cy + Math.sin(ang) * rad * 1.1;
    if (o.mask && o.mask(x / W, y / H) < r()) continue;
    const sz = (3 + Math.pow(r(), 2) * 12) * s * 1.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r() * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, -sz);
    ctx.lineTo(sz * (0.4 + r() * 0.5), sz * (0.2 + r() * 0.5));
    ctx.lineTo(-sz * (0.3 + r() * 0.5), sz * (0.4 + r() * 0.4));
    ctx.closePath();
    ctx.fillStyle = `rgba(6,6,8,${0.6 + r() * 0.35})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${o.edge},${0.25 + r() * 0.5})`;
    ctx.lineWidth = 0.8 * s * 1.5;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Multiply a layer's alpha by a worn-noise mask (chips + scuffs). */
function wearLayer(lctx, W, H, seed, amount = 0.6, scale = 0.02) {
  const n = noiseField(W, H, { seed, scale, octaves: 4 });
  const img = lctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] === 0) continue;
      const v = n(x, y);
      const k = smooth(0.18, 0.5, v) * (1 - amount) + amount * smooth(0.3, 0.45, v);
      d[i + 3] *= clamp01(0.25 + k);
    }
  }
  lctx.putImageData(img, 0, 0);
}

/**
 * Inset double frame. inset/gap are in px at full canvas resolution.
 * color = 'r,g,b'. Drawn on a layer, worn, then glow-composited.
 */
export function frame(ctx, W, H, o) {
  const { c, ctx: l } = layer(W, H);
  const s = W / 900;
  l.lineJoin = 'round';
  const lines = [
    [o.inset, o.radius, 2.2 * s, 0.95],
    [o.inset + o.gap, Math.max(2, o.radius - o.gap), 1.1 * s, 0.7],
  ];
  for (const [ins, rad, lw, a] of lines) {
    l.strokeStyle = `rgba(${o.color},${a})`;
    l.lineWidth = lw * 1.5;
    roundRect(l, ins, ins, W - ins * 2, H - ins * 2, rad);
    l.stroke();
  }
  // small corner notches / ticks on the inner line (precision detail)
  l.fillStyle = `rgba(${o.color},0.9)`;
  const tick = 5 * s * 1.5;
  for (const [x, y] of [
    [W / 2, o.inset],
    [W / 2, H - o.inset],
    [o.inset, H / 2],
    [W - o.inset, H / 2],
  ]) {
    l.save();
    l.translate(x, y);
    l.rotate(Math.PI / 4);
    l.fillRect(-tick / 2, -tick / 2, tick, tick);
    l.restore();
  }
  if (o.extra) o.extra(l);
  wearLayer(l, W, H, o.seed, o.wear ?? 0.55, 0.018 / s);
  ctx.save();
  if (o.glow) {
    ctx.filter = `blur(${o.glow * s}px)`;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = o.glowAlpha ?? 0.8;
    ctx.drawImage(c, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}

/**
 * Corner filigree (Victorian-style scroll, original). Drawn into the corner at
 * (x, y) growing toward +x/+y in local space; use rot to place it.
 */
export function filigree(ctx, x, y, size, rot, color, lw = 1.4) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(size / 100, size / 100);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = (lw * 100) / size;
  ctx.lineCap = 'round';
  const curl = (x0, y0, cx1, cy1, cx2, cy2, x1, y1, rr) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x1, y1);
    ctx.stroke();
    if (rr) {
      ctx.beginPath();
      ctx.arc(x1 + rr, y1, rr, Math.PI, Math.PI * 2.6);
      ctx.stroke();
    }
  };
  // main L-bracket with scroll ends
  ctx.beginPath();
  ctx.moveTo(4, 70);
  ctx.lineTo(4, 14);
  ctx.quadraticCurveTo(4, 4, 14, 4);
  ctx.lineTo(70, 4);
  ctx.stroke();
  curl(14, 14, 30, 14, 40, 30, 52, 26, 6);
  curl(14, 14, 14, 30, 30, 40, 26, 52, 0);
  ctx.beginPath();
  ctx.arc(26 - 6, 52, 6, 0, Math.PI * 1.6);
  ctx.stroke();
  curl(70, 4, 78, 4, 82, 10, 80, 16, 0);
  curl(4, 70, 4, 78, 10, 82, 16, 80, 0);
  // leaves
  const leaf = (lx, ly, a, len) => {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0);
    ctx.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0);
    ctx.fill();
    ctx.restore();
  };
  leaf(34, 20, -0.5, 14);
  leaf(20, 34, 2.07, 14);
  leaf(46, 8, 0.25, 11);
  leaf(8, 46, 1.32, 11);
  // diamond pip at the corner
  ctx.beginPath();
  ctx.moveTo(14, 7);
  ctx.lineTo(21, 14);
  ctx.lineTo(14, 21);
  ctx.lineTo(7, 14);
  ctx.closePath();
  ctx.fill();
  // dots
  for (const [dx, dy, rr] of [
    [60, 12, 1.8],
    [12, 60, 1.8],
    [40, 40, 2.2],
  ]) {
    ctx.beginPath();
    ctx.arc(dx, dy, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Dark worn metallic card edge (outer band). */
export function wornEdge(ctx, W, H, o) {
  const s = W / 900;
  const { c, ctx: l } = layer(W, H);
  // dark outer band
  const band = 16 * s;
  l.lineWidth = band * 2;
  l.strokeStyle = 'rgba(0,0,0,0.75)';
  l.strokeRect(0, 0, W, H);
  // thin metallic edge highlight
  const g = l.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, `rgba(${o.metal},0.75)`);
  g.addColorStop(0.35, `rgba(${o.metal},0.18)`);
  g.addColorStop(0.55, `rgba(${o.metal},0.55)`);
  g.addColorStop(1, `rgba(${o.metal},0.12)`);
  l.strokeStyle = g;
  l.lineWidth = 2.2 * s;
  l.strokeRect(6 * s, 6 * s, W - 12 * s, H - 12 * s);
  wearLayer(l, W, H, o.seed, 0.7, 0.03 / s);
  ctx.drawImage(c, 0, 0);
}

/** Fine surface texture: fibres, micro-scratches and a soft diagonal sheen. */
export function surface(ctx, W, H, o) {
  const r = rng(o.seed);
  const s = W / 900;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < (o.scratches ?? 140); i++) {
    const x = r() * W, y = r() * H;
    const len = (10 + r() * 70) * s;
    const a = -0.6 + r() * 0.3 + (r() < 0.3 ? 1.4 : 0);
    ctx.strokeStyle = `rgba(${o.color},${0.02 + r() * 0.06})`;
    ctx.lineWidth = (0.5 + r() * 0.8) * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  // dust specks
  for (let i = 0; i < (o.dust ?? 220); i++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + r() * 0.12})`;
    ctx.beginPath();
    ctx.arc(r() * W, r() * H, (0.4 + r() * 1.2) * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // sheen
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.38, 'rgba(255,255,255,0)');
  g.addColorStop(0.46, `rgba(255,255,255,${o.sheen ?? 0.035})`);
  g.addColorStop(0.52, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.globalCompositeOperation = 'screen';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Bloom: blurred additive copy of a source canvas (positioned at x, y). */
export function bloom(ctx, src, x, y, blurPx, alpha, op = 'lighter') {
  ctx.save();
  ctx.filter = `blur(${blurPx}px)`;
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = op;
  ctx.drawImage(src, x, y);
  ctx.restore();
}

/** Soft dark drop shadow from an alpha canvas. */
export function dropShadow(ctx, src, x, y, blurPx, alpha) {
  const { c, ctx: l } = layer(src.width, src.height);
  l.drawImage(src, 0, 0);
  l.globalCompositeOperation = 'source-in';
  l.fillStyle = '#000';
  l.fillRect(0, 0, src.width, src.height);
  ctx.save();
  ctx.filter = `blur(${blurPx}px)`;
  ctx.globalAlpha = alpha;
  ctx.drawImage(c, x, y);
  ctx.restore();
}

/** Four-point star glint (specular flare). */
export function starGlint(ctx, x, y, size, color = '255,255,255', alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, size * 0.35);
  g.addColorStop(0, `rgba(${color},${0.9 * alpha})`);
  g.addColorStop(0.25, `rgba(${color},${0.35 * alpha})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - size, y - size, size * 2, size * 2);
  for (const [len, th, rot] of [
    [size, size * 0.035, 0],
    [size * 0.62, size * 0.03, Math.PI / 2],
    [size * 0.3, size * 0.02, Math.PI / 4],
    [size * 0.3, size * 0.02, -Math.PI / 4],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const lg = ctx.createLinearGradient(-len, 0, len, 0);
    lg.addColorStop(0, `rgba(${color},0)`);
    lg.addColorStop(0.5, `rgba(${color},${0.85 * alpha})`);
    lg.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.quadraticCurveTo(0, -th, len, 0);
    ctx.quadraticCurveTo(0, th, -len, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export { roundRect };
