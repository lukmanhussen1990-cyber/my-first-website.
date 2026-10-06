// Reusable drawn parts shared by several scenes. Loaded after lib.js.
(function () {
  const { PAL } = L;

  // Rounded rectangle as a point list (clockwise), corners sampled as arcs.
  function roundRectPoints(x, y, w, h, r, per = 10) {
    r = Math.min(r, w / 2, h / 2);
    const pts = [];
    const corner = (cx, cy, a0) => {
      for (let i = 0; i <= per; i++) {
        const a = a0 + (i / per) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    corner(x + w - r, y + r, -Math.PI / 2);
    corner(x + w - r, y + h - r, 0);
    corner(x + r, y + h - r, Math.PI / 2);
    corner(x + r, y + r, Math.PI);
    return pts;
  }

  // Wobble a closed outline along its normals with low-frequency noise (hand-cut paper edge).
  // amp px, freq = wobbles per 1000px of perimeter, b = boil index for per-frame jitter.
  function handCut(pts, { amp = 3, freq = 6, seed = 1, b = 0, jit = 0.8 } = {}) {
    const dense = L.resampleBySpacing(pts.concat([pts[0]]), 6, false).slice(0, -1);
    const n = dense.length, per = L.polyLength(dense, true);
    const r = L.rng(seed * 977 + b * 31337);
    return dense.map((p, i) => {
      const q = dense[(i + 1) % n], o = dense[(i - 1 + n) % n];
      let nx = q[1] - o[1], ny = -(q[0] - o[0]); const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
      const s = (i / n) * per / 1000 * freq;
      const k = amp * L.noise1(s, seed) + (r() - 0.5) * 2 * jit;
      return [p[0] + nx * k, p[1] + ny * k];
    });
  }

  // Chat bubble (cut-paper rounded rectangle).
  function chatBubble(ctx, x, y, w, h, { r = 52, seed = 2, b = 0, color = PAL.chat } = {}) {
    const pts = handCut(roundRectPoints(x, y, w, h, r), { amp: 2.2, freq: 5, seed, b, jit: 0.6 });
    L.fillPoly(ctx, pts, color);
  }

  // Avatar: lavender disc with a pink person silhouette. (cx,cy) center, rad = disc radius.
  function avatar(ctx, cx, cy, rad, { b = 0, seed = 4 } = {}) {
    const disc = L.blobPoints(cx, cy, rad, rad, { n: 22, seed, jag: 0.015, jit: 0.7, b });
    L.fillPoly(ctx, disc, PAL.lav, { smooth: true });
    ctx.save();
    L.smoothPath(ctx, disc, true); ctx.clip();
    ctx.fillStyle = PAL.pink;
    // head
    ctx.beginPath(); ctx.ellipse(cx, cy - rad * 0.12, rad * 0.32, rad * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    // shoulders
    ctx.beginPath(); ctx.ellipse(cx, cy + rad * 0.78, rad * 0.62, rad * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Thought bubble: irregular cut-paper body plus two trailing puffs.
  // tailDir: angle (rad) the tail points toward (default bottom-left).
  function thoughtBubble(ctx, cx, cy, rx, ry, { seed = 1, b = 0, color = PAL.white, tailDir = 2.45, tail = 1, jit = 1.6 } = {}) {
    const body = L.blobPoints(cx, cy, rx, ry, { n: 12, seed, jag: 0.06, jit, b });
    L.fillPoly(ctx, body, color, { round: Math.min(rx, ry) * 0.22 });
    if (tail > 0) {
      const ux = Math.cos(tailDir), uy = Math.sin(tailDir);
      const p1 = [cx + ux * rx * 1.08, cy + uy * ry * 1.08];
      const p2 = [cx + ux * rx * 1.42, cy + uy * ry * 1.42];
      const s1 = rx * 0.2 * L.clamp(tail * 2), s2 = rx * 0.12 * L.clamp(tail * 2 - 1);
      if (s1 > 0.5) L.fillPoly(ctx, L.blobPoints(p1[0], p1[1], s1 * 1.25, s1, { n: 7, seed: seed + 50, jag: 0.08, jit: jit * 0.5, b }), color, { round: s1 * 0.3 });
      if (s2 > 0.5) L.fillPoly(ctx, L.blobPoints(p2[0], p2[1], s2 * 1.15, s2, { n: 6, seed: seed + 90, jag: 0.08, jit: jit * 0.4, b }), color, { round: s2 * 0.3 });
    }
    return body;
  }

  window.P = { roundRectPoints, handCut, chatBubble, avatar, thoughtBubble };
})();
