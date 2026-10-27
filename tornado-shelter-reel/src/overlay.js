// The infographics, drawn on a 2D canvas over the graded picture (so they stay
// crisp and keep their colours): bold yellow number labels that pop in with a
// small bounce and fade, thin white measuring lines with arrowheads at both
// ends, chunky white arrows streaming along paths (wind, air, uplift), a pulsing
// outline for the weak point, and a flash ring where the plank hits.
// Positions come from the 3D scene: world points are projected with the camera.
// Everything stays clear of the subtitle band (rows ~770-900).
import * as THREE from 'three';

export function build(ctx) {
  const { W, H, T, WD, U, camera } = ctx;
  const { clamp, smooth, prog, bump } = U;
  const S = W / 1080; // drawing scale (previews render smaller)
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const texture = new THREE.CanvasTexture(cv);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const FONT = 'InterBlack';
  const ready = (async () => {
    const f = new FontFace(FONT, 'url(/assets/fonts/Inter-Black.otf)');
    await f.load();
    document.fonts.add(f);
  })();

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const _v = new THREE.Vector3();
  const proj = (p) => {
    _v.copy(p).project(camera);
    return { x: ((_v.x + 1) / 2) * W, y: ((1 - _v.y) / 2) * H };
  };
  const YEL = '#ffd21a';

  // ---------------------------------------------------------------- drawing kit
  // a bold yellow label (one or two lines), popping in and fading out
  function label(lines, x, y, t, t0, t1, { size = 110, sub = 0.6, align = 'center' } = {}) {
    if (t < t0 || t > t1 + 0.35) return;
    const pin = prog(t, t0, 0.38);
    const sc = pin < 1 ? 0.35 + 0.65 * U.easeOutBack(pin, 2.6) : 1 + 0.06 * smooth(prog(t, t1, 0.35));
    const a = smooth(prog(t, t0, 0.12)) * (1 - smooth(prog(t, t1, 0.35)));
    if (a <= 0.003) return;
    g.save();
    g.globalAlpha = a;
    g.translate(x, y);
    g.scale(sc, sc);
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    let yy = lines.length > 1 ? -size * 0.36 : 0;
    lines.forEach((txt, i) => {
      const sz = (i === 0 ? size : size * sub) * S;
      g.font = `900 ${sz}px ${FONT}`;
      // soft drop shadow, a dark outline, the yellow face
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = sz * 0.22;
      g.shadowOffsetY = sz * 0.07;
      g.lineWidth = sz * 0.15;
      g.strokeStyle = '#17120a';
      g.strokeText(txt, 0, yy * S);
      g.shadowColor = 'transparent';
      g.fillStyle = YEL;
      g.fillText(txt, 0, yy * S);
      yy += size * 0.5 + (i === 0 ? size * sub * 0.55 : size * sub);
    });
    g.restore();
  }
  // a measuring line between two screen points: drawn out from the middle, arrowheads
  // at both ends, end ticks
  function measure(A, B, k, a) {
    if (k <= 0 || a <= 0) return;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const ax = mx + (A.x - mx) * k, ay = my + (A.y - my) * k, bx = mx + (B.x - mx) * k, by = my + (B.y - my) * k;
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    g.save();
    g.globalAlpha = a;
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 6 * S;
    g.strokeStyle = '#ffffff';
    g.fillStyle = '#ffffff';
    g.lineWidth = 3.5 * S;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(ax + ux * 10 * S, ay + uy * 10 * S);
    g.lineTo(bx - ux * 10 * S, by - uy * 10 * S);
    g.stroke();
    const head = (px, py, sx, sy) => {
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px - sx * 18 * S + nx * 8 * S, py - sy * 18 * S + ny * 8 * S);
      g.lineTo(px - sx * 18 * S - nx * 8 * S, py - sy * 18 * S - ny * 8 * S);
      g.closePath();
      g.fill();
    };
    head(ax, ay, -ux, -uy);
    head(bx, by, ux, uy);
    const tk = smooth(clamp((k - 0.85) / 0.15));
    if (tk > 0) {
      g.lineWidth = 3 * S;
      for (const P of [A, B]) {
        g.beginPath();
        g.moveTo(P.x + nx * 16 * S * tk, P.y + ny * 16 * S * tk);
        g.lineTo(P.x - nx * 16 * S * tk, P.y - ny * 16 * S * tk);
        g.stroke();
      }
    }
    g.restore();
  }
  // chunky white arrows streaming along a screen-space polyline
  function polyLen(pts) {
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return acc;
  }
  function pointAt(pts, acc, s) {
    const L = acc[acc.length - 1];
    s = clamp(s, 0, L);
    let i = 1;
    while (i < acc.length - 1 && acc[i] < s) i++;
    const k = (s - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
    return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
  }
  function arrowAlong(pts, acc, s0, len, w, a) {
    const L = acc[acc.length - 1];
    if (s0 + len < 0 || s0 > L) return;
    const fadeIn = smooth(clamp((s0 + len) / (len * 0.8))), fadeOut = smooth(clamp((L - s0) / (len * 0.8)));
    const al = a * Math.min(fadeIn, fadeOut);
    if (al <= 0.01) return;
    const n = 10;
    const body = [];
    const headL = Math.min(len * 0.42, w * 1.9);
    for (let i = 0; i <= n; i++) body.push(pointAt(pts, acc, s0 + ((len - headL) * i) / n));
    const tip = pointAt(pts, acc, s0 + len);
    const base = body[body.length - 1];
    const dx = tip.x - base.x, dy = tip.y - base.y, dl = Math.hypot(dx, dy) || 1;
    const nx = -dy / dl, ny = dx / dl;
    const draw = (off, col) => {
      g.strokeStyle = col;
      g.fillStyle = col;
      g.lineWidth = w;
      g.lineCap = 'butt';
      g.lineJoin = 'round';
      g.beginPath();
      body.forEach((p, i) => (i ? g.lineTo(p.x, p.y + off) : g.moveTo(p.x, p.y + off)));
      g.stroke();
      g.beginPath();
      g.moveTo(tip.x, tip.y + off);
      g.lineTo(base.x + nx * w * 1.05, base.y + ny * w * 1.05 + off);
      g.lineTo(base.x - nx * w * 1.05, base.y - ny * w * 1.05 + off);
      g.closePath();
      g.fill();
    };
    g.save();
    g.globalAlpha = al;
    g.shadowColor = 'rgba(0,0,0,0.4)';
    g.shadowBlur = 10 * S;
    g.shadowOffsetY = 3 * S;
    draw(w * 0.16, '#b9bec4'); // a grey underside, so the arrow reads as a solid shape
    g.shadowColor = 'transparent';
    draw(0, '#ffffff');
    g.restore();
  }
  // a stream of arrows along a world-space path (sampled, projected)
  function stream(path3, t, t0, t1, { n = 3, len = 120, w = 22, speed = 300, phase = 0 } = {}) {
    if (t < t0 || t > t1) return;
    const a = smooth(prog(t, t0, 0.3)) * (1 - smooth(prog(t, t1 - 0.35, 0.35)));
    const pts = path3.map(proj);
    const acc = polyLen(pts);
    const L = acc[acc.length - 1];
    const gap = (L + len) / n;
    for (let i = 0; i < n; i++) {
      const s = ((((t - t0) * speed * S + i * gap + phase * gap) % (L + len)) + (L + len)) % (L + len) - len;
      arrowAlong(pts, acc, s, len * S, w * S, a);
    }
  }
  const sampleCurve = (f, n = 24) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

  // ---------------------------------------------------------------- the graphics
  function draw(t) {
    g.clearRect(0, 0, W, H);
    const P = WD.pit(t);
    // 1: "10 MIN"
    label(['10 MIN'], 0.64 * W, 0.215 * H, t, T.label10, 5.1, { size: 150 });
    // 2: "UNDERGROUND = SAFEST", wind flowing over the ground, not into the pit
    label(['UNDERGROUND', '= SAFEST'], 0.5 * W, 0.235 * H, t, T.labelUG, 11.6, { size: 96, sub: 0.82 });
    for (const [h, ph] of [[0.22, 0], [0.5, 0.45], [0.82, 0.2]]) {
      const x0 = -3.6, x1 = 6.0, z = -0.45;
      const over = (x) => (x > P.x0 - 0.6 && x < P.x1 + 0.6 ? 0.28 * Math.sin(Math.PI * clamp((x - P.x0 + 0.6) / (P.x1 - P.x0 + 1.2))) : 0);
      stream(sampleCurve((u) => V(x0 + (x1 - x0) * u, h + over(x0 + (x1 - x0) * u), z)), t, T.wind0, T.wind1, { n: 3, len: 150, w: 20, speed: 520, phase: ph });
    }
    // 3: "30 CM CONCRETE" across the wall's section
    {
      const k = smooth(prog(t, T.label30, 0.45)), a = 1 - smooth(prog(t, 20.6, 0.35));
      const A = proj(V(WD.OUT.x0, -1.15, 0.01)), B = proj(V(WD.ROOM.x0, -1.15, 0.01));
      measure(A, B, k, a);
      label(['30 CM', 'CONCRETE'], B.x + 34 * S, B.y + 4 * S, t, T.label30 + 0.12, 20.6, { size: 104, sub: 0.62, align: 'left' });
    }
    // 4: "160 KM/H" follows the plank (above the subtitle band); the hit flashes
    if (ctx.FX.plankCenter && t > T.plank0 && t < T.hit + 0.8) {
      const c = proj(ctx.FX.plankCenter(Math.min(t, T.hit)));
      label(['160 KM/H'], Math.max(290 * S, Math.min(W - 290 * S, c.x + 30 * S)), Math.min(c.y - 120 * S, 690 * S), t, T.label160, T.hit + 0.25, { size: 104 });
    }
    {
      const u = prog(t, T.hit, 0.45);
      if (u > 0 && u < 1 && ctx.FX.plankLead) {
        const c = proj(ctx.FX.plankLead(T.hit));
        g.save();
        g.globalAlpha = (1 - u) * 0.9;
        g.strokeStyle = '#ffffff';
        g.lineWidth = (10 - 7 * u) * S;
        g.beginPath();
        g.arc(c.x, c.y, (20 + 150 * U.easeOutCubic(u)) * S, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
    }
    // 5: "ANCHORED 2 M DEEP" with a measuring line down the first anchor; the uplift test
    {
      const k = smooth(prog(t, T.labelAnchor, 0.5)), a = 1 - smooth(prog(t, 38.1, 0.35));
      const x = WD.ANCHORS[0] - 0.24;
      measure(proj(V(x, WD.FLOOR_B, 0.06)), proj(V(x, WD.FLOOR_B - WD.ANCHOR_D, 0.06)), k, a);
      const L = proj(V(1.2, WD.FLOOR_B - WD.ANCHOR_D - 0.42, 0.06));
      label(['ANCHORED 2 M DEEP'], L.x, L.y, t, T.labelAnchor + 0.15, 38.1, { size: 74 });
      // the wind pulling the shelter up: arrows rising over the roof and up its sides
      for (const [x, ph] of [[-1.3, 0], [-0.3, 0.5], [0.7, 0.2], [1.7, 0.7], [2.7, 0.35], [3.7, 0.85]]) {
        stream([V(x, WD.TOP + 0.15, -0.2), V(x, WD.TOP + 1.25, -0.2)], t, T.uplift0, T.uplift1, { n: 1, len: 120, w: 22, speed: 330, phase: ph });
      }
      for (const [x, ph] of [[WD.OUT.x0 - 0.25, 0], [WD.OUT.x1 + 0.25, 0.5]]) {
        stream([V(x, WD.FLOOR_B - 0.4, 0.05), V(x, -0.1, 0.05)], t, T.uplift0, T.uplift1, { n: 2, len: 110, w: 20, speed: 420, phase: ph });
      }
    }
    // 6: the weak point: the open stairwell pulses
    {
      const a = bump(t, T.weak0, T.weak1, 0.2);
      if (a > 0) {
        const pts = [V(WD.HATCH.x0, WD.TOP, 0), V(WD.HATCH.x1, WD.TOP, 0), V(WD.HATCH.x1, WD.TOP, WD.HATCH.z0), V(WD.HATCH.x0, WD.TOP, WD.HATCH.z0)].map(proj);
        const pulse = 0.55 + 0.45 * Math.sin((t - T.weak0) * 9);
        g.save();
        g.globalAlpha = a * pulse;
        g.strokeStyle = YEL;
        g.shadowColor = 'rgba(255,190,0,0.9)';
        g.shadowBlur = 18 * S;
        g.lineWidth = 6 * S;
        g.setLineDash([22 * S, 12 * S]);
        g.beginPath();
        pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
        g.closePath();
        g.stroke();
        g.restore();
      }
    }
    // 7: fresh air: down each pipe and out into the room
    for (let i = 0; i < 2; i++) {
      const v = WD.VENTS[i];
      const top = WD.TOP + 0.95;
      const path = [V(v.x, top, v.z), V(v.x, WD.CEIL - 0.05, v.z), V(v.x + (i ? 0.25 : -0.25), WD.CEIL - 0.55, v.z + 0.2), V(v.x + (i ? 0.5 : -0.5), WD.CEIL - 0.85, v.z + 0.35)];
      stream(sampleCurve((u) => catmull(path, u), 30), t, T.air0, T.air1, { n: 2, len: 125, w: 20, speed: 330, phase: i * 0.4 });
    }
    // 8: WATER / LIGHT / RADIO next to the supplies (between the worker and the shelf)
    if (ctx.FX.items) {
      for (const it of ctx.FX.items) {
        if (!it.label) continue;
        const p = it.g.getWorldPosition(new THREE.Vector3());
        const q = proj(V(WD.SHELF.x0 - 0.06, p.y + 0.12, p.z));
        label([it.label], q.x - 6 * S, q.y, t, it.t + 0.05, it.t + 1.55, { size: 70, align: 'right' });
      }
    }
    // 9: the wind streaming across the yard (below the label, above the subtitles), "300 KM/H WIND"
    for (const [h, z, ph] of [[2.05, -4, 0], [2.6, -6, 0.5], [3.15, -5, 0.25]]) {
      stream([V(-14, h, z), V(-4, h + 0.15, z), V(6, h - 0.1, z), V(16, h + 0.1, z)], t, T.label300 - 0.6, 71.0, { n: 4, len: 190, w: 24, speed: 1300, phase: ph });
    }
    label(['300 KM/H', 'WIND'], 0.5 * W, 0.18 * H, t, T.label300, 70.9, { size: 132, sub: 0.6 });
    texture.needsUpdate = true;
  }
  function catmull(pts, u) {
    const n = pts.length - 1;
    const f = clamp(u) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const k = f - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
    const k2 = k * k, k3 = k2 * k;
    const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * k + (2 * a - 5 * b + 4 * c2 - d) * k2 + (-a + 3 * b - 3 * c2 + d) * k3);
    return V(c(p0.x, p1.x, p2.x, p3.x), c(p0.y, p1.y, p2.y, p3.y), c(p0.z, p1.z, p2.z, p3.z));
  }

  return { texture, ready, draw };
}
