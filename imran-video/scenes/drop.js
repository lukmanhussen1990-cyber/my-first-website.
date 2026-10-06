// drop (spec §3.3), screen-layer flyer 3.52–4.20: the "!" dot pops off the chat page, hangs at its apex,
// then falls (stretched along its velocity, speed lines riding above) while core.js pans the camera down.
// Contract: starts exactly on the chat page's (anticipation-squashed) dot; at t→4.20 it is an r34 circle
// at screen (960,555), where thoughts.js picks it up as the seed with its landing squash.
(function () {
  const { PAL, ease, remap, clamp, lerp } = L;
  const T0 = T.T_DOTHOP, T_APEX = 3.75, T1 = T.T_SEED; // 3.52, 4.20
  const END = [960, 555], R0 = 10, R1 = 34;

  // screen-space start: the page dot (bottom-anchored squash sx 1.3 / sy 0.7 → center 3 px lower)
  function startPt() {
    const d = LAYOUT.bang.dot;
    return CAM.pageToScreen(T0, CAM.PAGE.chat, d.x, d.y + d.r * 0.3);
  }
  // Apex: spec says (bangX − 40, 380), but the page is already scrolling up by then (camY 67 at 3.75), so at
  // y 380 the bubble line slides right through the dot and it sits on the "I" of "Imran, I got you!" for ~4 frames.
  // At y 452 the dot hangs in the bubble's lower padding, under the glyphs, and never covers the message.
  const APEX_Y = 452;
  function apexPt() {
    const d = LAYOUT.bang.dot;
    return CAM.pageToScreen(T0, CAM.PAGE.chat, d.x - 40, APEX_Y);
  }

  // Pop-off path: a quadratic Bézier from the dot spot to the apex whose control point sits RIGHT of the stem.
  // The stem is directly above the dot (3 px gap), so a straight path up runs through it: on the first flyer frame
  // the dot overlapped the stem's foot and the "!" read as a "J". This path hops out sideways (20° above
  // horizontal, into the empty space right of the "!"; the left side is the "t" of "it"), clears the stem's foot
  // by ≥ 2 px, swings up past the stem top and hooks left into the apex (same easeOutQuad timing).
  function ctrlPt() {
    const d = LAYOUT.bang.dot;
    return CAM.pageToScreen(T0, CAM.PAGE.chat, d.x + 80, d.y - 26);
  }
  function popPos(t) {
    const p0 = startPt(), pc = ctrlPt(), pa = apexPt();
    const u = ease.outQuad(remap(t, T0, T_APEX)), a = 1 - u;
    return [a * a * p0[0] + 2 * a * u * pc[0] + u * u * pa[0], a * a * p0[1] + 2 * a * u * pc[1] + u * u * pa[1]];
  }
  // direction of travel along the pop-off path (Bézier tangent; defined at the apex too)
  function popDir(t) {
    const p0 = startPt(), pc = ctrlPt(), pa = apexPt();
    const u = ease.outQuad(remap(t, T0, T_APEX));
    return Math.atan2(2 * (1 - u) * (pc[1] - p0[1]) + 2 * u * (pa[1] - pc[1]), 2 * (1 - u) * (pc[0] - p0[0]) + 2 * u * (pa[0] - pc[0]));
  }

  // Dot state at absolute t: {x, y, r, sx, sy, rot} (drawDot scales by sx/sy in a frame rotated by `rot`).
  function state(t) {
    const pa = apexPt();
    if (t < T_APEX) {
      // pop-off: squash (1.3 wide, 0.7 tall; the page dot's pose at 3.52) → stretch 1.2 along the direction of
      // travel / 0.83 across in 0.05 s → (1,1) at the apex. The deformation frame turns from axis-aligned to the
      // travel direction during the snap, so the hand-off pose is exact and the stretch follows the curve.
      const [x, y] = popPos(t);
      let psi = popDir(t) - Math.PI / 2; // frame whose y axis lies along the travel direction
      while (psi > Math.PI / 2) psi -= Math.PI;
      while (psi <= -Math.PI / 2) psi += Math.PI;
      let sx, sy, rot;
      if (t < T0 + 0.05) {
        const k = ease.outQuad(remap(t, T0, T0 + 0.05));
        sx = lerp(1.3, 0.83, k); sy = lerp(0.7, 1.2, k); rot = psi * k;
      } else {
        const k = ease.inOutSine(remap(t, T0 + 0.05, T_APEX));
        sx = lerp(0.83, 1, k); sy = lerp(1.2, 1, k); rot = psi;
      }
      return { x, y, r: R0, sx, sy, rot };
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
      // lengths 60 / 110 / 70, width 5, tapered; they flick on, then write off from the top, all gone by 4.12.
      // A line shorter than 24 px is not drawn at all: with the tapered profile, short stubs read as stray specks
      // (a "..." above the dot at 4.13); so the last remnants simply vanish (≈4.09) instead of shrinking to dots.
      if (t >= 3.85 && t < 4.12) {
        const top = s.y - s.r * Math.max(s.sx, s.sy); // stretched vertical extent (velocity is ~vertical)
        [[-18, 60, 0.03], [0, 110, 0.0], [18, 70, 0.05]].forEach(([dx, len, lag], k) => {
          const on = ease.outCubic(clamp((t - 3.85 - lag * 0.5) / 0.06));
          const off = ease.inQuad(clamp((t - 3.92 - lag) / (4.12 - 3.92 - lag)));
          const vl = len * Math.min(on, 1 - off);
          if (vl < 24) return;
          // grows upward from the dot, then retracts from the top; the visible length keeps its full taper
          const y1 = top - 20, y0 = y1 - vl, x = s.x + dx;
          CHATPG.inkStroke(ctx, [[x, y1], [x + 0.6, (y0 + y1) / 2], [x, y0]], { width: 5, t, id: 140 + k, boil: 0.8, pow: 0.6, minW: 0.8 });
        });
      }

      // smear echoes on the fast pop-off (spec §1.4) as a swept, tapering band (see CHATPG.smearTrail); samples
      // from the first 0.02 s are dropped so no translucent smear is ever laid over the "!" stem
      if (t < T_APEX) CHATPG.smearTrail(ctx, popPos, () => R0, t, T0 + 0.02);
      drawState(ctx, s, t);
    },
  });
  window.DROP = { state, popPos };
})();
