// Scene: blob (thought page, 9.60–12.42) — spec §3.6 + the dip of §3.7.
// The hero blob calls out twice in the source's "C" pose (with ink action lines), squashes,
// jump-spins into a big cut-paper thumbs-up, lands with the PAYOFF (creases, radial burst,
// confetti, sparkles), pumps, holds and dips. Confetti is registered separately and keeps
// simulating on the thought page until 13.12 (it rides the camera pan out of frame).
// Exports window.BLOB = { pose, thumbPose, drawThumbSmooth, … } so flight.js picks the thumb up at 12.42
// pixel-identically.
(function () {
  const { PAL, ease, remap, clamp, lerp } = L;
  const D2R = Math.PI / 180;
  const CX = S.HERO_CENTER[0], CY = S.HERO_CENTER[1];   // 960, 555
  const ID = 77;                                       // boil id shared with S.drawThumb's default
  const T_START = 9.60, T_END = T.T_FLY;               // 12.42 → flight.js

  // ---------------------------------------------------------------- morph pairs (spec §1.5)
  // S.pair always returns the same canonical base `A0`, so all three targets share its indexing.
  const [A0, BC1] = S.pair(S.HERO_BASE, S.C_SHAPE);
  // C2 (spec §3.6): head lifted 14 px, jaw dropped 14 px, scaled (1.08, 1.12), rotated −8°. Shared
  // S.C2_SHAPE applies the ±14 px as hard steps at y −60 / +40, which cuts 14 px stair-step notches
  // into the outline (neck and lower jaw). Same displacement here, but ramped smoothly over 40 px.
  const C2_LOCAL = (() => {
    const ramp = (y) => -14 * L.smoothstep((-40 - y) / 40) + 14 * L.smoothstep((y - 20) / 40);
    const a = -8 * D2R, co = Math.cos(a), si = Math.sin(a);
    return S.canon(S.C_SHAPE.map(([x, y]) => {
      y += ramp(y); x *= 1.08; y *= 1.12;
      return [x * co - y * si, x * si + y * co];
    }));
  })();
  const [, BC2] = S.pair(S.HERO_BASE, C2_LOCAL);
  const [, BTH] = S.pair(S.HERO_BASE, S.THUMB);
  const BASE_BOTTOM = Math.max(...S.HERO_BASE.map((p) => p[1]));      // ≈187 (blob bottom, local)
  const THUMB_BOTTOM = Math.max(...S.THUMB.map((p) => p[1]));         // ≈196 → y 756 at center 560

  // ---------------------------------------------------------------- smooth boil
  // Spec §1.3 boils every cut-paper *vertex* ±2.5 px. Our hero contours are resampled to 96 points,
  // and independent per-point jitter on them reads as a serrated (pinking-shears) edge. Instead the
  // ±amp offsets live on K control vertices spaced evenly along the contour and are blended between
  // them, so edges stay straight-ish and the outline still re-draws at 12 fps (3-drawing cycle).
  function boilSmooth(pts, id, t, amp = 2.5, K = 16) {
    const r = L.rng(id * 7919 + L.boil(t));
    const ox = new Array(K), oy = new Array(K);
    for (let k = 0; k < K; k++) { ox[k] = (r() - 0.5) * 2 * amp; oy[k] = (r() - 0.5) * 2 * amp; }
    const n = pts.length;
    return pts.map((p, i) => {
      const f = (i / n) * K, k0 = Math.floor(f) % K, k1 = (k0 + 1) % K, u = f - Math.floor(f);
      const w = u * u * (3 - 2 * u);
      return [p[0] + ox[k0] + (ox[k1] - ox[k0]) * w, p[1] + oy[k0] + (oy[k1] - oy[k0]) * w];
    });
  }
  // S.drawThumb, but with the smooth boil (amplitude follows the scale so small thumbs stay crisp).
  function drawThumbSmooth(ctx, o) {
    const s = o.s ?? 1, t = o.t ?? 0;
    ctx.save();
    ctx.translate(o.x ?? 0, o.y ?? 0);
    if (o.rot) ctx.rotate(o.rot);
    if (o.sx || o.sy) ctx.scale(o.sx ?? 1, o.sy ?? 1);
    const pts = (o.shape || S.THUMB).map(([x, y]) => [x * s, y * s]);
    // boil ≈1 px at the chip size (s 0.2) → full ±2.5 px from s 0.8; one curve shared by blob.js, flight.js and
    // chatpage.js (which calls this with defaults), so the 13.12 hand-off has no boil-amplitude jump
    const amp = o.amp ?? lerp(1.0, 2.5, clamp((s - 0.2) / 0.6));
    S.fill(ctx, boilSmooth(pts, o.id ?? ID, t, amp), o.color ?? PAL.orange, 6 * Math.min(1, s * 2));
    const cr = o.creases ?? [1, 1, 1];
    S.THUMB_CREASES.forEach((sg, k) => {
      if (cr[k] <= 0) return;
      const p = sg.map(([x, y]) => [x * s, y * s]);
      L.brushStroke(ctx, S.boilPts([p[0], L.lerpPt(p[0], p[1], 0.5), p[1]], 300 + k, t, 1.2 * Math.min(1, s * 2)),
        { width: Math.max(o.creaseMin ?? 2.6, 7 * s), to: cr[k], taperIn: 0.25, taperOut: 0.3, wob: 0.08, seed: k + 1 });
    });
    ctx.restore();
  }

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
  // morph starts 0.04 s before the spec's 11.36 so the thumb is recognisable through the last third of the spin
  const kTH = (t) => ease.inOutCubic(seg(t, 11.32, 11.62));
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
      drawThumbSmooth(ctx, { x: 0, y: 0, s: 1, t, creases: opt.noCreases ? [0, 0, 0] : P.cr, id: ID });
    } else {
      const [pts, gs] = bodyPts(P, t);
      const b = P.br * gs;
      const sc = b !== 1 ? pts.map(([x, y]) => [x * b, y * b]) : pts;
      S.fill(ctx, boilSmooth(sc, ID, t), PAL.orange);
    }
    ctx.restore();
    return P;
  }

  // Thumb pose for flight.js (page coords of the thumb origin; center-anchored sx/sy, no rotation)
  function thumbPose(t) {
    const P = pose(t);
    return { x: P.x, y: P.y, sx: P.sx * P.g, sy: P.sy * P.g, rot: P.rotC + P.rotP };
  }

  // ---------------------------------------------------------------- straight ink stroke (spec §1.3)
  // Width profile w·sin(πs)^pow along normalized length s, round ends; draws arc range [from, to]
  // (write-on: to < 1, write-off from the tail: from > 0). Endpoints boil ±1.2 px, width ±8% at 12 fps.
  function inkLine(ctx, p0, p1, o) {
    const from = clamp(o.from ?? 0), to = clamp(o.to ?? 1);
    if (to - from < 1e-3 || o.width <= 0.05) return;
    const t = o.t, id = o.id;
    const [a, b] = S.boilPts([p0, p1], id, t, 1.2);
    const wj = o.width * (1 + 0.08 * (L.hash(id * 13.7 + L.boil(t)) * 2 - 1));
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, pow = o.pow ?? 0.45, minW = o.minW ?? 0.8;
    const n = 18, Lp = [], Rp = [];
    let w0 = 0, w1 = 0;
    for (let i = 0; i <= n; i++) {
      const u = from + (to - from) * (i / n);
      const w = Math.max(minW, wj * Math.pow(Math.sin(Math.PI * u), pow));
      const x = a[0] + dx * u, y = a[1] + dy * u;
      Lp.push([x + nx * w / 2, y + ny * w / 2]); Rp.push([x - nx * w / 2, y - ny * w / 2]);
      if (i === 0) w0 = w; if (i === n) w1 = w;
    }
    ctx.fillStyle = o.color ?? PAL.ink;
    ctx.beginPath();
    ctx.moveTo(Lp[0][0], Lp[0][1]);
    for (let i = 1; i <= n; i++) ctx.lineTo(Lp[i][0], Lp[i][1]);
    // round cap at the head, then back along the other side, round cap at the tail
    const hx = a[0] + dx * to, hy = a[1] + dy * to, ang = Math.atan2(ny, nx);
    ctx.arc(hx, hy, w1 / 2, ang, ang - Math.PI, true);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(Rp[i][0], Rp[i][1]);
    const tx = a[0] + dx * from, ty = a[1] + dy * from;
    ctx.arc(tx, ty, w0 / 2, ang + Math.PI, ang, true);
    ctx.closePath();
    ctx.fill();
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
    // flat brush-dash profile with blunt round ends (the source's 3 dashes), thinning to 0 as it flicks out
    const w = width * (1 - f);
    inkLine(ctx, a, b, { width: w, to: wOn, from: 0.35 * f, t, id, pow: 0.2, minW: 0.35 * w });
  }
  function drawActionLines(ctx, t) {
    if (t >= 9.92 && t < 10.20) {
      LINES1.forEach((l, k) => actionLine(ctx, t, l, {
        tw: 9.92 + 0.04 * k, dur: 0.06, tf: 10.06 + 0.02 * k, fl: 0.10, width: 12, id: 500 + k,
      }));
    }
    if (t >= 10.56 && t < 11.0) {
      LINES2.forEach((l, k) => {
        const tw = 10.56 + 0.04 * k;
        actionLine(ctx, t, l, { tw, dur: 0.06, tf: tw + 0.06 + 0.08, fl: 0.10, width: 14, id: 520 + k });
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
      inkLine(ctx, a, b, { width: 8 * (1 - f), to: wOn, from: 0.3 * f, t, id: 540 + k, pow: 0.3, minW: 0.3 * 8 * (1 - f) });
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
      const r = sp.size * 1.0 * s;
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
  // Launch point: spec (960,500) is deep behind the palm, so the fan only showed through the notch above the
  // fingers as a clump for the first ~4 frames. Launched from just under the thumb's top instead, the
  // pieces clear the silhouette at once and read as a crown burst over the thumb.
  const CONF_Y0 = 430;
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
      // spec: 700–1200 px/s with drag 0.8/s. That reads as a slow lob from behind the thumb, so the paper
      // gets a faster pop (1300–2100 px/s) with heavier paper drag (3/s): same apex heights, real "burst".
      const sp = 1300 + 800 * r();
      const size = 20 + 16 * r();                 // spec 12–28 px; enlarged so the paper reads at 1080p
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
      // integrate: gravity 1600; drag 3/s while bursting out, paper "catches air" once falling
      let x = 960 + (r() - 0.5) * 50, y = CONF_Y0 + (r() - 0.5) * 30;
      let vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
      const termK = 3.4 + 1.6 * r();             // falling drag → terminal ≈ 320–470 px/s
      const xs = new Float32Array(STEPS), ys = new Float32Array(STEPS);
      let tSlow = -1, tApex = -1;
      for (let s = 0; s < STEPS; s++) {
        xs[s] = x; ys[s] = y;
        const tau = s * DT;
        if (tApex < 0 && vy > 0) tApex = tau;
        const fall = tApex < 0 ? 0 : clamp((tau - tApex) / 0.3);
        const ky = lerp(3.0, termK, fall), kx = lerp(3.0, 2.2, fall);
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
  // The burst is shown from the frame after the landing (11.7333) with the sim already 0.07 s in, so the
  // first drawn frame is a spread fan around the thumb top, not a 28-piece clump at the launch point.
  const CONF_LEAD = 0.04;
  function drawConfetti(ctx, t, front) {
    if (t - T.T_PAYOFF < 0.01) return;
    const tau = t - T.T_PAYOFF + CONF_LEAD;
    for (const c of CONF) {
      const isFront = tau >= c.tFront;
      if (isFront !== front) continue;
      const [x, y] = confettiState(c, tau);
      if (y > 1200 || x < -60 || x > 1980) continue;
      const pop = 0.55 + 0.45 * ease.outQuad(clamp(tau / 0.14));
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
        // dimmed to 60% while the shape unfolds (11.46–11.54) so the fast spin doesn't leave a ghost cloud
        const env = ease.inOutSine(seg(t, 11.26, 11.32)) * (1 - 0.4 * ease.inOutSine(seg(t, 11.46, 11.54)))
          * (1 - ease.inQuad(seg(t, 11.56, 11.66)));
        const op = [0.10, 0.20, 0.35];
        for (let k = 3; k >= 1; k--) {
          const tt = t - k / 30;
          if (tt < T.T_JUMP) continue;               // only trail the airborne body, not the squash
          ctx.save();
          ctx.globalAlpha *= op[3 - k] * env;
          drawHero(ctx, tt, { noCreases: true });
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

  window.BLOB = { pose, thumbPose, drawHero, drawThumbSmooth, boilSmooth, CONF };
})();
