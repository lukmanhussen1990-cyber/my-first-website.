// Scene: flight (screen-space flyer, 12.42–13.12) — first part of spec §3.7.
// The thumbs-up leaves the thought page (picked up exactly where blob.js drew it at 12.42, via
// CAM.pageToScreen) and flies home along a cubic Bézier while core.js pans the camera back up.
// Scale 1 → 0.20, rotation 0 → −15° (at 30% of the path) → 0, squash released into a velocity stretch
// (axis-aligned in the thumb's frame), soft smear echoes; the end point follows the descending chip.
// At 13.12 its bbox center sits at screen (LAYOUT.chip.x, 534) at scale 0.20 / rotation 0, where
// chatpage.js takes it over (BLOB.drawThumbSmooth, id 77).
(function () {
  const { ease, remap, lerp, clamp } = L;
  const D2R = Math.PI / 180;
  const T0 = T.T_FLY, T1 = T.T_LAND_CHIP;           // 12.42, 13.12
  const S_END = 0.20;
  const C1 = [1180, 250], C2 = [1600, 330];          // spec Bézier controls
  // smear echoes: 7 copies 1/180 s apart (spec: 3 at 1/30 s). At peak speed (~60 px/frame) 1/30 s and even
  // 1/60 s spacing showed separate stepped ghost thumbs; ≤12 px steps with falling opacity read as one soft smear.
  const ECHO_N = 7, ECHO_DT = 1 / 180, ECHO_OP = [0.26, 0.21, 0.17, 0.13, 0.09, 0.06, 0.03];
  const ROT_PEAK = -15 * D2R;
  const SMAX = 0.15;                                 // stretch cap (§1.4 s = 1 + min(Smax, |v|/3000))

  let G = null;
  function geom() {
    if (G) return G;
    const st = window.BLOB ? BLOB.thumbPose(T0) : { x: 960, y: 576, sx: 1.08, sy: 0.9, rot: 0 };
    const p0 = CAM.pageToScreen(T0, CAM.PAGE.thought, st.x, st.y);
    const bb = S.thumbBBoxCenter(S_END);
    const cx = window.LAYOUT ? LAYOUT.chip.x : 1463;
    const g = { st, P0: p0, P3: [cx - bb[0], 534 - bb[1]] };
    if (window.LAYOUT) G = g;                        // only cache once the measured layout exists
    return g;
  }
  function bez(u, P0, P3) {
    const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    return [a * P0[0] + b * C1[0] + c * C2[0] + d * P3[0], a * P0[1] + b * C1[1] + c * C2[1] + d * P3[1]];
  }
  // smooth bump, 0 at both ends, peak 1 at u = 0.3 (Beta-shaped: u^1.5 (1−u)^3.5)
  const BUMP_N = Math.pow(0.3, 1.5) * Math.pow(0.7, 3.5);
  const bump = (u) => (u <= 0 || u >= 1 ? 0 : Math.pow(u, 1.5) * Math.pow(1 - u, 3.5) / BUMP_N);

  // Path progress: spec easeInOutCubic, blended 35% with easeOutCubic so the thumb springs out of the
  // dip with some speed (pure in-out made it crawl for the first ~0.15 s) and still settles softly.
  const flyEase = (u) => 0.65 * ease.inOutCubic(u) + 0.35 * ease.outCubic(u);

  // Screen-space pose of the thumb origin at time t (t < T0 → blob.js's dip, which is on screen 1:1)
  function pose(t) {
    const g = geom();
    if (t <= T0) {
      const b = window.BLOB ? BLOB.thumbPose(t) : g.st;
      const p = CAM.pageToScreen(t, CAM.PAGE.thought, b.x, b.y);
      return { x: p[0], y: p[1], s: 1, rot: b.rot, sx: b.sx, sy: b.sy };
    }
    const u = remap(t, T0, T1), e = flyEase(u);
    // Landing: over the last 35% of the path the end point follows the chip's live screen position
    // (chip page y 534 − camY), so the thumb rides down with the descending chat page and settles onto the
    // chip, instead of parking on screen while the bubble slides down under it. camY = 0 at 13.12, so the
    // contract end point is unchanged.
    const w = L.smoothstep((e - 0.65) / 0.35);
    const [x, y] = bez(e, g.P0, [g.P3[0], g.P3[1] - w * CAM.camY(t)]);
    const s = lerp(1, S_END, e);
    const rot = ROT_PEAK * bump(e);
    // release the dip's squash (sx 1.08 / sy 0.9) with a little overshoot
    const q = ease.outBack(remap(t, T0, T0 + 0.18), 2.2);
    const sx = lerp(g.st.sx, 1, q), sy = lerp(g.st.sy, 1, q);
    return { x, y, s, rot, sx, sy };
  }
  function velocity(t) {
    const h = 1 / 120, a = pose(Math.max(T0, t - h)), b = pose(Math.min(T1, t + h));
    const dt = Math.min(T1, t + h) - Math.max(T0, t - h);
    return [(b.x - a.x) / dt, (b.y - a.y) / dt];
  }

  function drawAt(ctx, t, tt) {
    const p = pose(tt);
    ctx.save();
    ctx.translate(p.x, p.y);
    let rot = p.rot;
    // stretch from the velocity, ramped in over the first frames so the dip→launch reads as a quick
    // squash-to-stretch rather than a one-frame snap at the hand-off
    if (tt > T0) {
      const v = velocity(tt), k = ease.inOutSine(remap(tt, T0, T0 + 0.08));
      // Axis-aligned in the thumb's own frame. A stretch along a diagonal velocity shears the rotated thumb
      // into an italic parallelogram and cancels the −15° lean-back, so the log-stretch is split between the
      // local x / y axes by cos 2φ (φ = velocity angle in the thumb frame): volume-preserving, never sheared.
      ctx.rotate(rot); rot = 0;
      const sp = Math.hypot(v[0], v[1]) * k;
      if (sp > 1e-3) {
        const c = Math.cos(-p.rot), sn = Math.sin(-p.rot);
        const lx = v[0] * c - v[1] * sn, ly = v[0] * sn + v[1] * c;
        const lam = Math.log(1 + Math.min(SMAX, sp / 3000)) * ((lx * lx - ly * ly) / (lx * lx + ly * ly));
        ctx.scale(Math.exp(lam), Math.exp(-lam));
      }
    }
    // drawThumbSmooth's default boil shrinks with the scale (≈1 px at s 0.2, same curve as chatpage.js's chip thumb)
    const o = { x: 0, y: 0, s: p.s, rot, sx: p.sx, sy: p.sy, t, id: 77, creaseMin: 2.6 };
    if (window.BLOB) BLOB.drawThumbSmooth(ctx, o); else S.drawThumb(ctx, o);
    ctx.restore();
  }

  SCENE({
    id: 'flight', start: T0, end: T1, layer: 'screen', z: 10,
    draw(ctx, lt, t) {
      // smear echoes behind the thumb (farthest first), faded in after the dip and out on arrival
      const env = ease.outQuad(remap(t, T0, T0 + 0.10)) * (1 - ease.inQuad(remap(t, 12.98, T1)));
      for (let k = ECHO_N; k >= 1 && env > 0.001; k--) {
        ctx.save();
        ctx.globalAlpha *= ECHO_OP[k - 1] * env;
        drawAt(ctx, t, t - k * ECHO_DT);
        ctx.restore();
      }
      drawAt(ctx, t, t);
    },
  });

  window.FLIGHT = { pose, geom };
})();
