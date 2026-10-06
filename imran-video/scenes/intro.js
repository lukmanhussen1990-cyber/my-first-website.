// intro (0.00–0.50): black starfield with an orange dot; a beige cut-paper iris opens (spec §3.1).
(function () {
  const { PAL, ease, remap } = L;

  // 8 seeded star specks, avoiding the badge rect and a 200px radius around the center (shared with outro).
  window.SPECKS = (() => {
    const r = L.rng(808), out = [];
    while (out.length < 8) {
      const x = 80 + r() * 1760, y = 60 + r() * 960;
      if (x > 1500 && y < 170) continue;
      if (Math.hypot(x - 960, y - 540) < 200) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.y - y) < 220)) continue;
      out.push({ x, y, rad: 1.5 + r() * 1.5, op: 0.3 + r() * 0.4, hz: 2 + r() * 3, ph: r() * 6.28 });
    }
    return out;
  })();
  window.drawSpecks = function (ctx, t, alpha = 1) {
    ctx.fillStyle = PAL.chat;
    for (const s of SPECKS) {
      const tw = 0.6 + 0.4 * Math.sin(2 * Math.PI * s.hz * t + s.ph);
      ctx.globalAlpha = alpha * s.op * tw;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.rad, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  SCENE({
    id: 'intro', start: 0, end: 0.5, layer: 'screen', z: -10,
    draw(ctx, lt, t) {
      ctx.fillStyle = PAL.ink; ctx.fillRect(0, 0, L.W, L.H);
      drawSpecks(ctx, t);
      // iris: BG irregular 16-gon r 0 -> 1150
      const k = ease.inOutCubic(remap(t, 0.08, 0.48));
      if (k > 0) {
        const R = 1150 * k;
        const pts = L.blobPoints(960, 540, R, R, { n: 16, seed: 16, jag: 0.03, jit: 2.5, b: L.boil(t) });
        L.fillPoly(ctx, pts, PAL.bg, { round: 6 });
      }
      // orange dot: twinkles, then shrinks out 0.30–0.42 (easeInBack) on top of the beige
      const out = remap(t, 0.30, 0.42);
      const s = (1 + 0.15 * Math.sin(2 * Math.PI * 2 * t)) * (out > 0 ? Math.max(0, 1 - ease.inBack(out, 1.7)) : 1);
      if (s > 0.01) {
        ctx.fillStyle = PAL.orange;
        ctx.beginPath(); ctx.arc(960, 540, 6 * s, 0, Math.PI * 2); ctx.fill();
      }
    },
  });
})();
