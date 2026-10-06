// drop (spec §3.3), screen-layer flyer 3.52–4.20: the "!" dot pops off the chat page, hangs at its apex,
// then falls (stretched along its velocity, speed lines riding above) while core.js pans the camera down.
// Contract: starts exactly on the chat page's (anticipation-squashed) dot; at t→4.20 it is an r34 circle
// at screen (960,555), where thoughts.js picks it up as the seed with its landing squash.
(function () {
  const { PAL, ease, remap, clamp, lerp } = L;
  const T0 = 3.52, T_APEX = 3.75, T1 = 4.20;
  const END = [960, 555], R0 = 10, R1 = 34;

  // screen-space start: the page dot (bottom-anchored squash sx 1.3 / sy 0.7 → center 3 px lower)
  function startPt() {
    const d = LAYOUT.bang.dot;
    return CAM.pageToScreen(T0, CAM.PAGE.chat, d.x, d.y + d.r * 0.3);
  }
  function apexPt() {
    const d = LAYOUT.bang.dot;
    return CAM.pageToScreen(T0, CAM.PAGE.chat, d.x - 40, 380);
  }

  // Dot state at absolute t: {x, y, r, sx, sy, rot} (sx along `rot`, sy across it).
  function state(t) {
    const p0 = startPt(), pa = apexPt();
    if (t < T_APEX) {
      // pop-off: easeOutQuad to the apex; squash (1.3,0.7) → stretch (0.83,1.2) in 0.05 s → (1,1) at the apex
      const u = ease.outQuad(remap(t, T0, T_APEX));
      const x = lerp(p0[0], pa[0], u), y = lerp(p0[1], pa[1], u);
      let sx, sy;
      if (t < T0 + 0.05) { const k = ease.outQuad(remap(t, T0, T0 + 0.05)); sx = lerp(1.3, 0.83, k); sy = lerp(0.7, 1.2, k); }
      else { const k = ease.inOutSine(remap(t, T0 + 0.05, T_APEX)); sx = lerp(0.83, 1, k); sy = lerp(1.2, 1, k); }
      return { x, y, r: R0, sx, sy, rot: 0 };
    }
    // fall: x easeInOutSine, y easeInQuad, r 10→34 easeInQuad, stretched along its (world-relative) velocity
    const pos = (tt) => {
      const u = remap(tt, T_APEX, T1);
      return [lerp(pa[0], END[0], ease.inOutSine(u)), lerp(pa[1], END[1], ease.inQuad(u))];
    };
    const u = remap(t, T_APEX, T1);
    const [x, y] = pos(t);
    const h = 1 / 240;
    const a = pos(Math.max(T_APEX, t - h)), b = pos(Math.min(T1, t + h));
    const dt = Math.min(T1, t + h) - Math.max(T_APEX, t - h);
    // the world (pages) moves up at camY'(t): the dot's speed relative to the paper is screen speed + camera speed
    const camV = (CAM.camY(Math.min(T1, t + h)) - CAM.camY(Math.max(T_APEX, t - h))) / dt;
    const vx = (b[0] - a[0]) / dt, vy = (b[1] - a[1]) / dt + camV;
    const sp = Math.hypot(vx, vy);
    const ramp = ease.inOutSine(clamp((t - T_APEX) / 0.08)); // ease into the stretch out of the apex
    const st = 1 + Math.min(0.35, sp / 3000) * ramp;
    return { x, y, r: lerp(R0, R1, ease.inQuad(u)), sx: st, sy: 1 / st, rot: Math.atan2(vy, vx) };
  }

  function drawState(ctx, s, t) {
    // sx is along the velocity direction; drawDot applies (sx, sy) in the rotated frame
    CHATPG.drawDot(ctx, s.x, s.y, s.r, t, { sx: s.sx, sy: s.sy, rot: s.rot, id: 681 });
  }

  SCENE({
    id: 'drop', start: T0, end: T1, layer: 'screen', z: 0,
    draw(ctx, lt, t) {
      if (!LAYOUT || !window.CHATPG) return;
      const s = state(t);

      // speed lines 3.85–4.15: three INK strokes riding above the dot (x −18 / 0 / +18), 20 px above its top,
      // lengths 60 / 110 / 70, width 5, tapered; they flick on and then write off from the top, gone by 4.15
      if (t >= 3.85 && t < 4.15) {
        const top = s.y - s.r * Math.max(s.sx, s.sy); // stretched vertical extent (velocity is ~vertical)
        [[-18, 60, 0.03], [0, 110, 0.0], [18, 70, 0.05]].forEach(([dx, len, lag], k) => {
          const on = ease.outCubic(clamp((t - 3.85 - lag * 0.5) / 0.06));
          const off = ease.inQuad(clamp((t - 3.92 - lag) / (4.15 - 3.92 - lag)));
          const vis = Math.min(on, 1 - off);
          if (vis <= 0.01) return;
          const y1 = top - 20, y0 = y1 - len, x = s.x + dx;
          // drawn bottom→top: write-on grows upward from the dot, write-off eats down from the top
          const pts = [[x, y1], [x + 0.6, (y0 + y1) / 2], [x, y0]];
          CHATPG.inkStroke(ctx, pts, { width: 5, from: 0, to: vis, t, id: 140 + k, boil: 0.8, pow: 0.6, minW: 1 });
        });
      }

      // smear echoes on the fast pop-off (spec §1.4), only from frames that already belong to the flyer
      if (t < T_APEX + 0.05) {
        [[3, 0.10], [2, 0.20], [1, 0.35]].forEach(([k, op]) => {
          const tt = t - k / 30;
          if (tt < T0) return;
          ctx.save(); ctx.globalAlpha *= op; drawState(ctx, state(tt), t); ctx.restore();
        });
      }
      drawState(ctx, s, t);
    },
  });
  window.DROP = { state };
})();
