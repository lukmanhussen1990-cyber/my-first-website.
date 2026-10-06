// Scene: blob (thought page, 9.60–12.42) — spec §3.6 + the dip of §3.7.
// The hero blob calls out twice in the source's "C" pose (with ink action lines), squashes,
// jump-spins into a big cut-paper thumbs-up, lands with the PAYOFF (creases, radial burst,
// confetti, sparkles), pumps, holds and dips. Confetti is registered separately and keeps
// simulating on the thought page until 13.12 (it rides the camera pan out of frame).
// Exports window.BLOB = { pose, thumbPose } so flight.js can pick the thumb up at 12.42.
(function () {
  const { PAL, ease, remap, clamp, lerp } = L;
  const D2R = Math.PI / 180;
  const CX = S.HERO_CENTER[0], CY = S.HERO_CENTER[1];   // 960, 555
  const ID = 77;                                       // boil id shared with S.drawThumb's default
  const T_START = 9.60, T_END = T.T_FLY;               // 12.42 → flight.js

  // ---------------------------------------------------------------- morph pairs (spec §1.5)
  // S.pair always returns the same canonical base `A0`, so all three targets share its indexing.
  const [A0, BC1] = S.pair(S.HERO_BASE, S.C_SHAPE);
  const [, BC2] = S.pair(S.HERO_BASE, S.C2_SHAPE);
  const [, BTH] = S.pair(S.HERO_BASE, S.THUMB);
  const BASE_BOTTOM = Math.max(...S.HERO_BASE.map((p) => p[1]));      // ≈187 (blob bottom, local)
  const THUMB_BOTTOM = Math.max(...S.THUMB.map((p) => p[1]));         // ≈196 → y 756 at center 560

  // ---------------------------------------------------------------- timing helpers
  const seg = (t, a, b) => remap(t, a, b);
  // morph progress of each pose: 0 = base, 1 = target (may overshoot)
  function kC1(t) {
    if (t < T.T_C1) return 0;
    if (t < 9.98) return ease.outBack(seg(t, T.T_C1, 9.98), 1.6);
    if (t < 10.18) return 1;
    return 1 - ease.inOutCubic(seg(t, 10.18, 10.34));
  }
  function kC2(t) {
    if (t < T.T_C2) return 0;
    if (t < 10.62) return ease.outBack(seg(t, T.T_C2, 10.62), 1.6);
    if (t < 10.87) return 1;
    return 1 - ease.inOutCubic(seg(t, 10.87, 11.02));
  }
  const kTH = (t) => ease.inOutCubic(seg(t, 11.36, 11.66));
  const spin = (t) => 2 * Math.PI * ease.inOutCubic(seg(t, T.T_JUMP, 11.72));
  // "shout" vibrato while a C pose holds (tiny, 5 Hz, enveloped)
  function vibrato(t, a, b) {
    if (t <= a || t >= b) return 0;
    const env = Math.sin(Math.PI * seg(t, a, b));
    return 0.012 * env * Math.sin(2 * Math.PI * 5 * (t - a));
  }

  // ---------------------------------------------------------------- the pose at absolute time t
  // Transform chain (local → page):
  //   translate(x,y) · screenStretch(1/sv, sv) · rotate(rotC) · rotate(rotP about pv)
  //   · scale(sx·g, sy·g about anchor) · breath(br about center) · shape points
  function pose(t) {
    const P = { x: CX, y: CY, sv: 1, rotC: 0, rotP: 0, pv: [0, 0], ax: 0, ay: 0, sx: 1, sy: 1, g: 1, br: 1, thumb: false, k: [0, 0, 0], cr: [0, 0, 0] };
    // global impact spring (§3.5) and idle breath (fades out before the jump)
    const [hsx, hsy] = S.heroSpring(t);
    P.sx *= hsx; P.sy *= hsy;
    P.br = 1 + (S.heroBreath(t) - 1) * (1 - seg(t, 11.02, 11.22));

    // ---- C #1 (9.66–10.34)
    const c1 = kC1(t);
    let q1 = 0;
    if (t >= 9.66 && t < T.T_C1) q1 = ease.outQuad(seg(t, 9.66, T.T_C1));
    else if (t >= T.T_C1 && t < 9.98) q1 = 1 - c1;           // release on the morph's own overshoot
    P.sx *= 1 + 0.10 * q1; P.sy *= 1 - 0.10 * q1;
    P.x += -10 * q1;
    P.rotC += -6 * D2R * q1;
    // closing the C widens the blob to 1.06, which continues as WOBBLE(0.06, 4, 0.10)
    let w1 = 1;
    if (t >= 10.18 && t < 10.34) w1 = 1 + 0.06 * ease.inOutCubic(seg(t, 10.18, 10.34));
    else if (t >= 10.34) w1 = L.WOBBLE(t - 10.34, 0.06, 4, 0.10);
    P.sx *= w1; P.sy /= w1;
    const v1 = vibrato(t, 9.98, 10.18);

    // ---- C #2 (10.34–11.02)
    const c2 = kC2(t);
    let q2 = 0;
    if (t >= 10.34 && t < T.T_C2) q2 = ease.outQuad(seg(t, 10.34, T.T_C2));
    else if (t >= T.T_C2 && t < 10.62) q2 = 1 - c2;
    P.sx *= 1 + 0.15 * q2; P.sy *= 1 - 0.15 * q2;
    P.x += -14 * q2;
    P.rotC += -5 * D2R * q2;
    const v2 = vibrato(t, 10.62, 10.87);
    P.g *= 1 + v1 + v2;

    // anchor: center until the C2 closes, then the blob's bottom (for the jump anticipation)
    if (t >= 10.87) { P.ax = 0; P.ay = BASE_BOTTOM; }
    let w2 = 1;
    if (t >= 10.87 && t < 11.02) w2 = 1 + 0.06 * ease.inOutCubic(seg(t, 10.87, 11.02));
    else if (t >= 11.02 && t < 11.70) w2 = L.WOBBLE(t - 11.02, 0.06, 4, 0.10);
    P.sx *= w2; P.sy /= w2;

    // ---- jump anticipation (11.02–11.22): sy 0.68 / sx 1.28, bottom-anchored
    if (t >= 11.02 && t < T.T_JUMP) {
      const q = ease.outQuad(seg(t, 11.02, T.T_JUMP));
      P.sx *= 1 + 0.28 * q; P.sy *= 1 - 0.32 * q;
    }
    // ---- jump-spin-morph (11.22–11.70)
    if (t >= T.T_JUMP && t < T.T_PAYOFF) {
      const up = seg(t, T.T_JUMP, 11.46);
      if (t < 11.46) P.y += -150 * ease.outQuad(up);
      else P.y += -150 + 155 * ease.inQuad(seg(t, 11.46, T.T_PAYOFF));
      const st = 1 - ease.outQuad(up);                           // take-off stretch relaxes by 11.46
      P.sx *= 1 - 0.2 * st; P.sy *= 1 + 0.3 * st;
      P.ay = lerp(BASE_BOTTOM, 0, ease.outQuad(up));             // anchor slides bottom → center
      P.rotC += spin(t);
      // fall stretch (screen-vertical), released by the landing squash
      if (t >= 11.46) P.sv = 1 + 0.16 * ease.inQuad(seg(t, 11.46, T.T_PAYOFF));
    }
    P.k = [c1, c2, kTH(t)];

    // ---- PAYOFF and after (thumb)
    if (t >= T.T_PAYOFF) {
      P.thumb = true;
      P.x = CX; P.y = 560;
      P.rotC = spin(t) - 2 * Math.PI;                            // tiny residual of the spin (ends 11.72)
      P.ax = 0; P.ay = THUMB_BOTTOM; P.pv = [0, THUMB_BOTTOM];   // bottom pivot (960, 756)
      const W = L.WOBBLE(t - T.T_PAYOFF, 0.22, 4, 0.12);         // landing squash: sy = 1/W, sx = W
      P.sx = W; P.sy = 1 / W;
      // pump: lean back (11.72–11.82), then rotation −10°→0° and scale 1.06→1, easeOutBack (11.82–12.12)
      if (t < 11.82) {
        const q = ease.inOutSine(seg(t, 11.72, 11.82));
        P.rotP = -10 * D2R * q; P.g = 1 + 0.06 * q;
      } else if (t < 12.12) {
        const q = ease.outBack(seg(t, 11.82, 12.12), 2.2);
        P.rotP = -10 * D2R * (1 - q); P.g = 1.06 - 0.06 * q;
      }
      // hold: bob ±4 px at 1 Hz, offset 0 at 12.27 and moving down into the dip
      if (t >= 12.12 && t < 12.27) {
        const env = ease.inOutSine(seg(t, 12.12, 12.20));
        P.y += 4 * Math.sin(2 * Math.PI * (t - 12.27)) * env;
      }
      // dip (12.27–12.42): down 16 px, squashed to sy 0.9 (anticipation for the flight)
      if (t >= 12.27) {
        const q = ease.inOutSine(seg(t, 12.27, 12.40));
        P.ax = 0; P.ay = 0;
        P.y += 16 * q; P.sy *= 1 - 0.10 * q; P.sx *= 1 + 0.08 * q;
      }
      P.cr = [ease.outQuad(seg(t, 11.74, 11.79)), ease.outQuad(seg(t, 11.79, 11.84)), ease.outQuad(seg(t, 11.84, 11.89))];
    }
    return P;
  }

  // Local points of the morphing body at pose P (blob-relative, before transforms)
  function bodyPts(P, t) {
    const [c1, c2, kt] = P.k;
    let pts = A0;
    if (c1 || c2 || kt) {
      pts = A0.map((p, i) => [
        p[0] + c1 * (BC1[i][0] - p[0]) + c2 * (BC2[i][0] - p[0]) + kt * (BTH[i][0] - p[0]),
        p[1] + c1 * (BC1[i][1] - p[1]) + c2 * (BC2[i][1] - p[1]) + kt * (BTH[i][1] - p[1]),
      ]);
    }
    let gs = 1;
    if (t < 9.75 && window.HERO_GULP) {
      const g = window.HERO_GULP(t, pts);
      if (g && g.pts) pts = g.pts;
      if (g && g.scale) gs = g.scale;
    }
    return [pts, gs];
  }

  function applyPose(ctx, P) {
    ctx.translate(P.x, P.y);
    if (P.sv !== 1) ctx.scale(1 / P.sv, P.sv);
    if (P.rotC) ctx.rotate(P.rotC);
    if (P.rotP) { ctx.translate(P.pv[0], P.pv[1]); ctx.rotate(P.rotP); ctx.translate(-P.pv[0], -P.pv[1]); }
    ctx.translate(P.ax, P.ay); ctx.scale(P.sx * P.g, P.sy * P.g); ctx.translate(-P.ax, -P.ay);
  }

  // Draw the hero (blob / morph / thumb) at time t. Before 11.6667 (a 12 fps boil boundary, just
  // after the morph completes at 11.66) the body is the morphed point list; from then on S.drawThumb.
  function drawHero(ctx, t, opt = {}) {
    const P = pose(t);
    ctx.save();
    applyPose(ctx, P);
    if (P.thumb || t >= 11.6667) {
      S.drawThumb(ctx, { x: 0, y: 0, s: 1, t, creases: opt.noCreases ? [0, 0, 0] : P.cr, id: ID });
    } else {
      const [pts, gs] = bodyPts(P, t);
      const b = P.br * gs;
      const sc = b !== 1 ? pts.map(([x, y]) => [x * b, y * b]) : pts;
      S.fill(ctx, S.boilPts(sc, ID, t), PAL.orange);
    }
    ctx.restore();
    return P;
  }

  // Thumb pose for flight.js (page coords of the thumb origin; center-anchored sx/sy, no rotation)
  function thumbPose(t) {
    const P = pose(t);
    return { x: P.x, y: P.y, sx: P.sx * P.g, sy: P.sy * P.g, rot: P.rotC + P.rotP };
  }

  // ---------------------------------------------------------------- ink action lines
  // C #1: relative to the blob center; C #2: absolute (line 5 pushed out 36 px along its ray so it
  // clears the C2 silhouette at its easeOutBack overshoot).
  const LINES1 = [[[215, -150], [250, -185]], [[240, -40], [290, -48]], [[235, 80], [285, 88]]]
    .map((l) => l.map(([x, y]) => [x + CX, y + CY]));
  const LINES2 = (() => {
    const raw = [[[1124, 360], [1166, 310]], [[1191, 447], [1250, 420]], [[1215, 555], [1280, 555]], [[1200, 642], [1261, 664]], [[1155, 719], [1205, 761]]];
    const push = [0, 0, 0, 0, 36];
    return raw.map((l, i) => {
      const dx = l[0][0] - CX, dy = l[0][1] - CY, r = Math.hypot(dx, dy);
      const ox = (dx / r) * push[i], oy = (dy / r) * push[i];
      return l.map(([x, y]) => [x + ox, y + oy]);
    });
  })();

  // One action line: write on [tw, tw+dur], hold, flick out 18 px while thinning [tf, tf+fl].
  function actionLine(ctx, t, line, o) {
    const { tw, dur, tf, fl, width, id } = o;
    if (t < tw || t >= tf + fl) return;
    const [p0, p1] = line;
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const wOn = ease.outCubic(seg(t, tw, tw + dur));
    const f = ease.outQuad(seg(t, tf, tf + fl));
    const off = 18 * f;
    const a = [p0[0] + ux * off, p0[1] + uy * off], b = [p1[0] + ux * off, p1[1] + uy * off];
    const pts = S.boilPts([a, L.lerpPt(a, b, 0.5), b], id, t, 1.2);
    const wj = 1 + 0.08 * (L.hash(id * 13 + L.boil(t)) * 2 - 1);   // ±8% width boil
    L.brushStroke(ctx, pts, {
      width: width * wj * (1 - f), to: wOn, from: 0.35 * f, taperIn: 0.3, taperOut: 0.3, wob: 0.06, seed: id,
    });
  }
  function drawActionLines(ctx, t) {
    if (t >= 9.92 && t < 10.20) {
      LINES1.forEach((l, k) => actionLine(ctx, t, l, {
        tw: 9.92 + 0.04 * k, dur: 0.06, tf: 10.06 + 0.02 * k, fl: 0.10 - 0.0 * k, width: 10, id: 500 + k,
      }));
    }
    if (t >= 10.56 && t < 11.0) {
      LINES2.forEach((l, k) => {
        const tw = 10.56 + 0.04 * k;
        actionLine(ctx, t, l, { tw, dur: 0.06, tf: tw + 0.06 + 0.08, fl: 0.10, width: 12, id: 520 + k });
      });
    }
  }

  // ---------------------------------------------------------------- payoff FX
  const BURST_C = [974, 533];
  const BURST = Array.from({ length: 8 }, (_, k) => {
    const a = (22.5 + 45 * k) * D2R, j = L.hash(k * 7.7 + 3);
    return { a, r0: 300, r1: 355 + (j - 0.5) * 10, f0: 350, f1: 400 + (j - 0.5) * 16 };
  });
  function drawBurst(ctx, t) {
    if (t < 11.72 || t >= 11.95) return;
    BURST.forEach((B, k) => {
      const wOn = ease.outCubic(seg(t, 11.72, 11.78));
      const f = ease.outQuad(seg(t, 11.80, 11.95));
      const ra = lerp(B.r0, B.f0, f), rb = lerp(B.r1, B.f1, f);
      const c = Math.cos(B.a), s = Math.sin(B.a);
      const a = [BURST_C[0] + c * ra, BURST_C[1] + s * ra], b = [BURST_C[0] + c * rb, BURST_C[1] + s * rb];
      const pts = S.boilPts([a, L.lerpPt(a, b, 0.5), b], 540 + k, t, 1.2);
      L.brushStroke(ctx, pts, { width: 8 * (1 - f), to: wOn, from: 0.3 * f, taperIn: 0.25, taperOut: 0.3, wob: 0.06, seed: 40 + k });
    });
  }

  const SPARKS = [
    { x: 1015, y: 305, size: 30, t0: 11.77 },
    { x: 1095, y: 365, size: 24, t0: 11.85 },
    { x: 905, y: 270, size: 34, t0: 11.93 },
  ];
  function drawSparkles(ctx, t) {
    SPARKS.forEach((sp, k) => {
      const u = (t - sp.t0) / 0.35;
      if (u <= 0 || u >= 1) return;
      // 0→1 (easeOutBack, first 40%) → 0 (easeInQuad)
      const s = u < 0.4 ? ease.outBack(u / 0.4, 2.0) : 1 - ease.inQuad((u - 0.4) / 0.6);
      if (s <= 0.01) return;
      const r = sp.size * 0.9 * s;
      const rot = (45 * D2R) * u;
      const j = S.boilPts([[sp.x, sp.y]], 560 + k, t, 0.8)[0];
      ctx.save();
      L.sparklePath(ctx, j[0], j[1], r, 0.22, rot);
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = PAL.ink;
      ctx.stroke();
      ctx.fillStyle = PAL.white;
      ctx.fill();
      ctx.restore();
    });
  }

  // ---------------------------------------------------------------- confetti (deterministic sim)
  const CONF = (() => {
    const cols = [].concat(
      Array(8).fill(PAL.orange), Array(6).fill(PAL.badge), Array(4).fill(PAL.lav),
      Array(4).fill(PAL.pink), Array(3).fill(PAL.white), Array(3).fill(PAL.ink));
    const N = cols.length;                         // 28
    const r = L.rng(8128);
    // deterministic shuffle of colors so neighbours in the fan differ
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
    const DT = 1 / 240, STEPS = Math.ceil((13.20 - T.T_PAYOFF) / DT) + 2;
    const out = [];
    for (let i = 0; i < N; i++) {
      const ang = (-150 + 120 * (i + 0.5) / N + (r() - 0.5) * 3.5) * D2R;
      const sp = 700 + 500 * r();
      const size = 12 + 16 * r();
      const sides = r() < 0.5 ? 3 : 4;
      const a0 = r() * Math.PI * 2;
      const shape = [];
      for (let k = 0; k < sides; k++) {
        const a = a0 + (k / sides) * Math.PI * 2 + (r() - 0.5) * 0.5;
        const rr = (size / 2) * (sides === 3 ? 1.15 : 1) * (0.82 + 0.36 * r());
        shape.push([Math.cos(a) * rr, Math.sin(a) * rr * (sides === 4 ? 0.75 : 1)]);
      }
      const spin = (2 + 6 * r()) * (r() < 0.5 ? -1 : 1);
      const flipF = 1.2 + 2.3 * r(), flipPh = r() * Math.PI * 2, swayPh = r() * Math.PI * 2;
      const rot0 = r() * Math.PI * 2;
      const wantFront = r() < 0.55;
      // integrate: gravity 1600, drag 0.8/s while rising; paper "catches air" once falling
      let x = 960, y = 500, vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
      const termK = 3.2 + 1.6 * r();             // falling drag → terminal ≈ 330–500 px/s
      const xs = new Float32Array(STEPS), ys = new Float32Array(STEPS);
      let tSlow = -1, tApex = -1;
      for (let s = 0; s < STEPS; s++) {
        xs[s] = x; ys[s] = y;
        const tau = s * DT;
        if (tApex < 0 && vy > 0) tApex = tau;
        const fall = tApex < 0 ? 0 : clamp((tau - tApex) / 0.35);
        const ky = lerp(0.8, termK, fall), kx = lerp(0.8, 1.8, fall);
        vx += -kx * vx * DT; vy += (1600 - ky * vy) * DT;
        x += vx * DT; y += vy * DT;
        if (tSlow < 0 && Math.hypot(vx, vy) < 250) tSlow = tau;
      }
      // front pieces switch from behind the thumb to in front once clear of it
      let tFront = Infinity;
      if (wantFront) {
        for (let s = Math.round(0.25 / DT); s < STEPS; s++) {
          if (xs[s] < 770 || xs[s] > 1175 || ys[s] < 270 || ys[s] > 800) { tFront = s * DT; break; }
        }
      }
      out.push({ col: cols[i], shape, spin, flipF, flipPh, swayPh, rot0, xs, ys, DT, tSlow, tFront, id: 900 + i });
    }
    return out;
  })();

  function confettiState(c, tau) {
    const f = tau / c.DT, i = Math.min(c.xs.length - 2, Math.floor(f)), u = f - i;
    let x = lerp(c.xs[i], c.xs[i + 1], u), y = lerp(c.ys[i], c.ys[i + 1], u);
    if (c.tSlow >= 0 && tau > c.tSlow) {
      const env = ease.inOutSine(clamp((tau - c.tSlow) / 0.25));
      x += 12 * env * Math.sin(2 * Math.PI * 2 * (tau - c.tSlow) + c.swayPh);
    }
    return [x, y];
  }
  function drawConfetti(ctx, t, front) {
    const tau = t - T.T_PAYOFF;
    if (tau < 0) return;
    for (const c of CONF) {
      const isFront = tau >= c.tFront;
      if (isFront !== front) continue;
      const [x, y] = confettiState(c, tau);
      if (y > 1200 || x < -60 || x > 1980) continue;
      const pop = ease.outBack(clamp(tau / 0.10), 1.8);
      const flip = Math.cos(2 * Math.PI * c.flipF * tau + c.flipPh);
      const fy = Math.sign(flip || 1) * Math.max(0.18, Math.abs(flip));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(c.rot0 + c.spin * tau);
      ctx.scale(pop, pop * fy);
      L.fillPoly(ctx, S.boilPts(c.shape, c.id, t, 1.0), c.col, { round: 2.5 });
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- scenes
  SCENE({
    id: 'blob', start: T_START, end: T_END, layer: 'world', page: 'thought', z: 10,
    draw(ctx, lt, t) {
      // smear echoes during the jump-spin (opacity 0.35/0.20/0.10, behind), enveloped in/out
      if (t >= 11.26 && t < 11.66) {
        const env = ease.inOutSine(seg(t, 11.26, 11.32)) * (1 - ease.inQuad(seg(t, 11.56, 11.66)));
        const op = [0.10, 0.20, 0.35];
        for (let k = 3; k >= 1; k--) {
          ctx.save();
          ctx.globalAlpha *= op[3 - k] * env;
          drawHero(ctx, t - k / 30, { noCreases: true });
          ctx.restore();
        }
      }
      drawHero(ctx, t);
      drawActionLines(ctx, t);
      drawBurst(ctx, t);
      drawSparkles(ctx, t);
    },
  });
  // confetti: behind the thumb (z 5) and in front (z 20); keeps falling until the camera has panned home
  SCENE({ id: 'confetti-back', start: T.T_PAYOFF, end: T.T_LAND_CHIP, layer: 'world', page: 'thought', z: 5,
    draw(ctx, lt, t) { drawConfetti(ctx, t, false); } });
  SCENE({ id: 'confetti', start: T.T_PAYOFF, end: T.T_LAND_CHIP, layer: 'world', page: 'thought', z: 20,
    draw(ctx, lt, t) { drawConfetti(ctx, t, true); } });

  window.BLOB = { pose, thumbPose, drawHero, CONF };
})();
