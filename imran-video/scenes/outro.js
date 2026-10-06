// outro (15.30–16.30): black diagonal wipe like the source, specks, orange dot + sparkle bookend (spec §3.8).
(function () {
  const { PAL, ease, remap } = L;

  // Leading edge: diagonal (top 380px ahead of bottom), 4 irregular kinks, boils ±8px.
  function edgePoints(mid, t) {
    const r = L.rng(515), rb = L.rng(900 + L.boil(t));
    const pts = [];
    const n = 6; // top, 4 kinks, bottom
    for (let i = 0; i < n; i++) {
      const v = i / (n - 1);                 // 0 = top, 1 = bottom
      const y = -40 + v * (L.H + 80);
      const x = mid + 190 - 380 * v;          // top ahead by 380px
      const kink = (i > 0 && i < n - 1) ? (r() - 0.5) * 70 : 0;
      pts.push([x + kink + (rb() - 0.5) * 16, y + (i > 0 && i < n - 1 ? (r() - 0.5) * 60 : 0)]);
    }
    return pts;
  }

  SCENE({
    id: 'outro', start: T.T_WIPE, end: T.T_END + 1, layer: 'overlay', z: 0,
    draw(ctx, lt, t) {
      const mid = -400 + 2720 * ease.inOutCubic(remap(t, 15.30, 15.90));
      const edge = edgePoints(mid, t);
      const poly = [[-3000, -40], ...edge, [-3000, L.H + 40]];
      ctx.save();
      L.polyPath(ctx, poly, true);
      ctx.fillStyle = PAL.ink; ctx.fill();
      ctx.clip();
      // specks fade in 15.60–15.85, inside the wipe panel only
      const sa = remap(t, 15.60, 15.85);
      if (sa > 0) drawSpecks(ctx, t, sa);
      // orange dot pops 15.92–16.12
      const d = remap(t, 15.92, 16.12);
      if (d > 0) {
        const r = 9 * Math.max(0, ease.outBack(d, 2));
        ctx.fillStyle = PAL.orange;
        ctx.beginPath(); ctx.arc(960, 540, r * (1 + 0.08 * Math.sin(2 * Math.PI * 2 * (t - 15.92))), 0, Math.PI * 2); ctx.fill();
      }
      // white sparkle 16.02–16.27: scale 0->1->0 rotating 45°
      const sp = remap(t, 16.02, 16.27);
      if (sp > 0 && sp < 1) {
        const s = Math.sin(Math.PI * sp);
        L.sparkle(ctx, 984, 518, 18 * s, PAL.white, (Math.PI / 4) * sp, 0.18);
      }
      ctx.restore();
    },
  });
})();
