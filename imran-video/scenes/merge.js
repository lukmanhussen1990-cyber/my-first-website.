// merge (8.21–9.60), spec §3.5: wind-up, puff suck, clockwise spiral whip-in with smear echoes, the words unravel
// into looping ink comets, IMPACT at 8.90 (2-frame ink flash, double shockwave, paper shards; the camera punch and
// shake come from core.js), and the comets are gulped into the hero blob one by one.
// Exports window.HERO_GULP(t, pts) -> { pts, scale } for blob.js (gulp bulges, last one decays by ~9.71).
(function () {
  const { PAL, ease, remap, clamp, lerp } = L;
  const TH = window.THOUGHTS, { MX, DEFS } = TH;
  const DEG = Math.PI / 180;
  const C = S.HERO_CENTER;              // (960, 555): seed / spiral / blob center
  const T_WIND = 8.21, T_SPIRAL = 8.45, T_UNRAVEL = 8.62, T_IMPACT = 8.90, T_END = 9.60;
  const SPIRAL_DUR = T_IMPACT - T_SPIRAL;
  const TA = { BR: 9.35, BL: 9.42, TL: 9.49, TR: 9.56 };   // comet absorb times
  const HERO_ID = 77;                   // boil seed of the hero blob outline (same as blob.js)

  // ---------------- bubble group motion ----------------
  const windK = (t) => ease.outQuad(remap(t, T_WIND, T_SPIRAL));            // wind-up progress
  const bobFade = (t) => 1 - ease.inOutSine(remap(t, T_WIND, T_SPIRAL));     // idle bob hands off smoothly
  const relaxK = (t) => ease.inOutSine(remap(t, T_SPIRAL, 8.60));            // wind-up squash/rotation release

  // Center before the spiral: base center + fading bob + 24 px radially outward from (960,555).
  function preCenter(i, t) {
    const d = DEFS[i], [bdy] = TH.bob(i, t), w = windK(t);
    return [d.c[0] + Math.cos(d.out) * 24 * w, d.c[1] + bdy * bobFade(t) + Math.sin(d.out) * 24 * w];
  }
  const POLAR0 = DEFS.map((d, i) => {
    const p = preCenter(i, T_SPIRAL);
    return { r: Math.hypot(p[0] - C[0], p[1] - C[1]), a: Math.atan2(p[1] - C[1], p[0] - C[0]) };
  });
  // Spiral: r = r0·(1 − easeInCubic(u)), θ = θ0 + 110°·easeInQuad(u), clockwise (increasing angle, y-down).
  function center(i, t) {
    if (t < T_SPIRAL) return preCenter(i, t);
    const u = clamp((t - T_SPIRAL) / SPIRAL_DUR), P = POLAR0[i];
    const r = P.r * (1 - ease.inCubic(u)), a = P.a + 110 * DEG * ease.inQuad(u);
    return [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)];
  }
  const orbitAngle = (i, t) => (t < T_SPIRAL ? 0 : 110 * DEG * ease.inQuad(clamp((t - T_SPIRAL) / SPIRAL_DUR)));

  // Full group matrix: stretch along velocity (Smax 0.4) · radial wind-up squash · rotation · scale.
  function groupMatrix(i, t) {
    const p = center(i, t);
    // velocity of the spiral only (it starts from rest at 8.45); the wind-up's easeOutQuad start must not stretch
    const dt = 1 / 240, ta = Math.max(t - dt, T_SPIRAL), tb = Math.min(t + dt, T_IMPACT);
    const p1 = center(i, tb), p0 = center(i, ta);
    const v = t < T_SPIRAL || tb <= ta ? [0, 0] : [(p1[0] - p0[0]) / (tb - ta), (p1[1] - p0[1]) / (tb - ta)];
    const sp = Math.hypot(v[0], v[1]);
    const st = 1 + Math.min(0.4, sp / 3000), va = Math.atan2(v[1], v[0]);
    const w = windK(t) * (1 - relaxK(t));
    const ra = Math.atan2(p[1] - C[1], p[0] - C[0]);
    const [, brot] = TH.bob(i, t);
    const rot = brot * bobFade(t) - 4 * DEG * w + orbitAngle(i, t);
    const sc = t < T_SPIRAL ? 1 : lerp(1, 0.6, ease.inQuad(clamp((t - T_SPIRAL) / SPIRAL_DUR)));
    let m = MX.tr(p[0], p[1]);
    if (sp > 1) m = MX.mul(m, MX.axis(va, st, 1 / st));
    m = MX.chain(m, MX.axis(ra, lerp(1, 0.94, w), lerp(1, 1.06, w)), MX.rot(rot), MX.sc(sc));
    return m;
  }

  // ---------------- puffs ----------------
  const SUCK = { small: [8.38, 8.52], big: [8.46, 8.64] };
  function puffState(d, which, t) {
    const [bdy, brot] = TH.puffBob(d.i, t), f = bobFade(t), w = windK(t);
    const base = [d[which][0] + Math.cos(d.out) * 24 * w, d[which][1] + bdy * f + Math.sin(d.out) * 24 * w];
    const [a, b] = SUCK[which];
    if (t >= b) return null;
    const k = remap(t, a, b);
    const pos = L.lerpPt(base, C, ease.inQuad(k));
    return { pos, s: lerp(1, 0.4, k), rot: brot * f - 4 * DEG * w };
  }

  // ---------------- seed ----------------
  function seedRadius(t) {
    let r;
    if (t < T_SPIRAL) {
      const breath = 1 + 0.04 * Math.sin((2 * Math.PI * (t - 4.55)) / 1.2) * bobFade(t);
      r = 34 * lerp(1, 0.8, windK(t)) * breath;
    } else r = lerp(34 * 0.8, 70, ease.inCubic(clamp((t - T_SPIRAL) / SPIRAL_DUR)));
    for (const tb of [8.52, 8.64]) { const k = (t - tb) / 0.08; if (k > 0 && k < 1) r *= 1 + 0.06 * Math.sin(Math.PI * k); }
    return r;
  }

  // ---------------- comets (spec §3.5, 8.62) ----------------
  let COMETS = null;
  function comets() {
    if (COMETS) return COMETS;
    const ready = DEFS.every((d) => d.wordImg);
    const out = DEFS.map((d, i) => {
      const m = groupMatrix(i, T_UNRAVEL);
      const wc = d.wordImg ? MX.ap(m, TH.wordLocalCenter(d)) : MX.ap(m, [0, 0]);
      const rho0 = Math.hypot(wc[0] - C[0], wc[1] - C[1]), th0 = Math.atan2(wc[1] - C[1], wc[0] - C[0]);
      const Ta = TA[d.key];
      const entry = th0 + 7.0 * (Ta - T_UNRAVEL);
      // the dive crosses the rim ~0.035 s after it starts: that is where the tail slides in and the blob bulges
      return { i, m, wc, rho0, th0, Ta, entry: entry - 7.0 * 0.035, rhoE: rimRadius(entry - 7.0 * DIVE) + 12, seed: 500 + i };
    });
    if (ready) COMETS = out; // fonts/words are measured in SCENE_INIT; don't cache a pre-init guess
    return out;
  }
  const headTheta = (c, t) => c.th0 + 7.0 * (t - T_UNRAVEL);
  // Head radius: spec ρ0 → 205 (easeInOutSine) by Ta. To make the gulp read as a slurp, the head arrives just outside
  // the rim at its entry angle (rim + 12) at Ta − DIVE and then dives into the blob (comets are drawn *behind* the
  // blob after the impact), so the tail visibly slides in through one point and the blob bulges there at Ta.
  const DIVE = 0.07;
  const headRho = (c, t) => {
    t = Math.max(t, T_UNRAVEL);
    const tE = c.Ta - DIVE;
    if (t <= tE) return c.rho0 + (c.rhoE - c.rho0) * ease.inOutSine(clamp((t - T_UNRAVEL) / (tE - T_UNRAVEL)));
    const k = t - tE;
    return c.rhoE - 0.5 * 30000 * k * k;
  };
  function tailLen(c, t) {
    let Lc = 1.6 * ease.outQuad(remap(t, T_UNRAVEL, 8.85));
    if (t > c.Ta - 0.25) Lc *= clamp((c.Ta - t) / 0.25);
    return Math.min(Lc, 7.0 * (t - T_UNRAVEL)); // the tail never reaches back past the word it unspooled from
  }
  // Tail = the head's angular history Δθ ∈ [0, Lc], with the spec's loopy wobble 10·sin(9Δθ)·Δθ/Lc. On top of that the
  // older half of the tail carries small prolate-cycloid loops (constant ~70 px period in arc length) so it reads as the
  // word's cursive literally unspooling ("lulu" trailing behind a clean ink head) rather than a plain arc.
  const LOOP = { period: 60, b: 19, c: 16, slant: 0.4, from: 0.5, ramp: 0.3 };
  function drawComet(ctx, c, t) {
    if (t < T_UNRAVEL || t >= c.Ta) return;
    const Lm = tailLen(c, t), th = headTheta(c, t);
    const N = Math.max(2, Math.ceil(Lm * 160));
    const Lc = Math.max(1e-3, Lm);
    const base = [];
    for (let k = 0; k <= N; k++) {
      const dth = (k / N) * Lm;
      const rho = headRho(c, t - dth / 7.0) + 10 * Math.sin(9 * dth) * (dth / Lc);
      base.push([C[0] + rho * Math.cos(th - dth), C[1] + rho * Math.sin(th - dth)]);
    }
    const head = base[0];
    if (Lm > 0.002) {
      const cum = [0];
      for (let k = 1; k < base.length; k++) cum.push(cum[k - 1] + L.dist(base[k - 1], base[k]));
      const len = cum[cum.length - 1] || 1;
      const om = (2 * Math.PI) / LOOP.period;
      const pts = base.map((p, k) => {
        const env = L.smoothstep((cum[k] / len - LOOP.from) / LOOP.ramp) * L.smoothstep(len / 160);
        if (env <= 0) return p;
        const pa = base[Math.max(0, k - 1)], pb = base[Math.min(base.length - 1, k + 1)];
        let tx = pb[0] - pa[0], ty = pb[1] - pa[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let nx = -ty, ny = tx; if (nx * (p[0] - C[0]) + ny * (p[1] - C[1]) < 0) { nx = -nx; ny = -ny; }
        const ph = om * cum[k];
        // ascender loops on the outside, leaning forward (toward the head), like the scribbles they came from
        const dn = LOOP.c * (1 + Math.cos(ph + Math.PI)) * env, dt = -LOOP.b * Math.sin(ph + Math.PI) * env - LOOP.slant * dn;
        return [p[0] + tx * dt + nx * dn, p[1] + ty * dt + ny * dn];
      });
      const u = cum.map((x) => x / len);
      const w = u.map((s) => lerp(12, 3.5, Math.pow(s, 0.8)));
      TH.ribbon(ctx, { pts, u, w, len, seed: c.seed }, 0, 1, t);
    }
    // head: INK disc r 6, swallowed over the last 0.08 s
    const hr = 6 * clamp((c.Ta - t) / 0.08);
    if (hr > 0.3) { ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(head[0], head[1], hr, 0, Math.PI * 2); ctx.fill(); }
  }

  // ---------------- gulps → exported for blob.js ----------------
  const gulpEnv = (tau) => (tau < 0 || tau >= 0.15 ? 0 : tau < 0.035 ? ease.outQuad(tau / 0.035) : 1 - ease.inOutSine((tau - 0.035) / 0.115));
  window.HERO_GULP = function (t, pts) {
    const cs = comets();
    const act = cs.filter((c) => t >= c.Ta && t < c.Ta + 0.15);
    if (!act.length) return { pts, scale: 1 };
    let scale = 1;
    const sig = 25 * DEG;
    for (const c of act) scale += 0.04 * gulpEnv(t - c.Ta);
    const out = pts.map(([x, y]) => {
      const a = Math.atan2(y, x), r = Math.hypot(x, y) || 1;
      let bulge = 0;
      for (const c of act) {
        let da = a - c.entry; da = Math.atan2(Math.sin(da), Math.cos(da));
        bulge += 16 * gulpEnv(t - c.Ta) * Math.exp(-(da * da) / (2 * sig * sig));
      }
      return [x + (x / r) * bulge, y + (y / r) * bulge];
    });
    return { pts: out, scale };
  };

  // ---------------- impact FX ----------------
  const RING1 = (() => { const r = L.rng(7001), o = []; for (let k = 0; k < 24; k++) o.push(1 + (r() - 0.5) * 0.08); return o; })();
  const RING2 = (() => { const r = L.rng(7002), o = []; for (let k = 0; k < 24; k++) o.push(1 + (r() - 0.5) * 0.08); return o; })();
  // Shockwave ring: an irregular 24-gon band whose thickness varies ±35 % per vertex (a brushy, hand-cut ring rather
  // than a uniform vector stroke), boiling with the rest of the paper.
  const RINGW = (() => { const r = L.rng(7003), o = []; for (let k = 0; k < 24; k++) o.push(0.65 + r() * 0.7); return o; })();
  function ring(ctx, t, R, jag, width, color, alpha, id) {
    if (width <= 0.05 || alpha <= 0.005) return;
    const b = L.boil(t), rr = L.rng(id * 7919 + b);
    const outer = [], inner = [];
    jag.forEach((j, k) => {
      const a = (k / 24) * Math.PI * 2, w = (width * RINGW[(k + id) % 24]) / 2;
      const jx = (rr() - 0.5) * 5, jy = (rr() - 0.5) * 5;
      outer.push([C[0] + Math.cos(a) * (R * j + w) + jx, C[1] + Math.sin(a) * (R * j + w) + jy]);
      inner.push([C[0] + Math.cos(a) * (R * j - w) + jx, C[1] + Math.sin(a) * (R * j - w) + jy]);
    });
    ctx.save();
    ctx.globalAlpha *= alpha; ctx.fillStyle = color;
    ctx.beginPath();
    outer.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    inner.slice().reverse().forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    ctx.fill('evenodd');
    ctx.restore();
  }
  // 12 shards: 5/6-gons 10–26 px, 8 ORANGE + 4 BADGE, from the rim at even angles ±12°, 600–900 px/s, g 1500, spin ±720°/s
  const SHARDS = (() => {
    const r = L.rng(8080), out = [];
    const [sx, sy] = [L.WOBBLE(0, 0.32, 3, 0.25), 1 / L.WOBBLE(0, 0.32, 3, 0.25)];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + (r() - 0.5) * 2 * 12 * DEG + 7 * DEG;
      const n = r() < 0.5 ? 5 : 6, size = 16 + r() * 18; // spec 10–26 px read as crumbs next to a 400 px blob: 16–34
      const shape = [];
      for (let j = 0; j < n; j++) { const b = (j / n) * Math.PI * 2 + (r() - 0.5) * 0.6; const q = 0.75 + r() * 0.25; shape.push([Math.cos(b) * q * size * 0.62, Math.sin(b) * q * size * 0.62 * 0.75]); }
      const R = rimRadius(a);
      out.push({
        p0: [C[0] + Math.cos(a) * R * sx, C[1] + Math.sin(a) * R * sy],
        v: (600 + r() * 300), a, spin: (r() - 0.5) * 2 * 720 * DEG, rot0: r() * Math.PI * 2,
        life: 0.5 + r() * 0.2, shape, color: k % 3 === 1 ? PAL.badge : PAL.orange, id: 600 + k,
      });
    }
    return out;
  })();
  function rimRadius(a) {
    // distance from the blob center to the HERO_BASE outline along angle a
    const P = S.HERO_BASE, dx = Math.cos(a), dy = Math.sin(a);
    let best = 200;
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length], ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const s = (p[0] * ey - p[1] * ex) / den, u = (p[0] * dy - p[1] * dx) / den;
      if (s > 0 && u >= 0 && u <= 1) best = s;
    }
    return best;
  }
  function drawShards(ctx, t) {
    const tau = t - T_IMPACT;
    if (tau < 0) return;
    for (const s of SHARDS) {
      if (tau >= s.life) continue;
      const k = 1 - ease.inQuad(tau / s.life);
      const x = s.p0[0] + Math.cos(s.a) * s.v * tau, y = s.p0[1] + Math.sin(s.a) * s.v * tau + 0.5 * 1500 * tau * tau;
      const rot = s.rot0 + s.spin * tau, c = Math.cos(rot), si = Math.sin(rot);
      const pts = s.shape.map(([px, py]) => [x + (px * c - py * si) * k, y + (px * si + py * c) * k]);
      TH.fillShape(ctx, S.boilPts(pts, s.id, t), s.color);
    }
  }

  // Hero blob (spec §3.5 base shape), built exactly the way blob.js builds it from 9.60 so the hand-off is
  // pixel-identical: canonical base A0 → gulp bulges → × breath·gulp scale → smooth boil (id 77, K 16 control
  // vertices, in blob-local space) → × heroSpring (sx, sy) about the center → 6 px rounded fill.
  const A0 = S.pair(S.HERO_BASE, S.C_SHAPE)[0];
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
  function heroPoints(t) {
    const g = window.HERO_GULP(t, A0);
    const [sx, sy] = S.heroSpring(t), br = S.heroBreath(t) * g.scale;
    return boilSmooth(g.pts.map(([x, y]) => [x * br, y * br]), HERO_ID, t).map(([x, y]) => [C[0] + x * sx, C[1] + y * sy]);
  }

  // ---------------- the scene ----------------
  function drawBubble(ctx, d, m, t, alpha = 1) {
    const pts = TH.bubbleWorld(d, m, t);
    if (alpha < 1) { ctx.save(); ctx.globalAlpha *= alpha; TH.fillShape(ctx, pts, PAL.orange); ctx.restore(); }
    else TH.fillShape(ctx, pts, PAL.orange);
  }

  function drawMerge(ctx, t) {
    if (t < T_IMPACT) {
      // smear echoes (behind everything): t − 3/30, 2/30, 1/30 at 0.10 / 0.20 / 0.35
      [[3, 0.10], [2, 0.20], [1, 0.35]].forEach(([k, a]) => {
        const te = t - k / 30;
        if (te < T_SPIRAL) return;
        for (const d of DEFS) drawBubble(ctx, d, groupMatrix(d.i, te), te, a);
      });
      // puffs being sucked into the seed
      for (const d of DEFS) for (const which of ['small', 'big']) {
        const ps = puffState(d, which, t);
        if (ps) TH.drawPuff(ctx, d, which, ps.pos, ps.s, PAL.orange, t, ps.rot);
      }
      // bubbles
      const mats = DEFS.map((d) => groupMatrix(d.i, t));
      DEFS.forEach((d) => drawBubble(ctx, d, mats[d.i], t));
      // seed
      TH.drawSeed(ctx, t, { r: seedRadius(t) });
      // words: children of their bubble until 8.62, then they stay put, fade, shrink to 0.85 and wobble apart
      for (const d of DEFS) {
        if (t < T_UNRAVEL) {
          ctx.save(); ctx.transform(...mats[d.i]); TH.drawWord(ctx, d, t); ctx.restore();
        } else {
          // spec: alpha 1→0 and scale →0.85 over 0.12 s. Half-transparent INK over orange reads as muddy brown, so the
          // word instead stays solid, wobbles apart (displacement 3→22) and is sucked into the comet's spawn point.
          const k = (t - T_UNRAVEL) / 0.12;
          if (k >= 1) continue;
          const c = comets()[d.i];
          ctx.save(); ctx.transform(...c.m);
          TH.drawWord(ctx, d, t, { alpha: 1 - ease.inQuad(clamp((k - 0.6) / 0.4)), scale: (1 - 0.15 * ease.outQuad(k)) * (1 - ease.inCubic(k)), disp: lerp(3, 22, ease.outQuad(k)) });
          ctx.restore();
        }
      }
    } else {
      // IMPACT: shockwaves (behind the blob)
      const u1 = ease.outCubic(remap(t, T_IMPACT, 9.30));
      if (t < 9.30) ring(ctx, t, lerp(210, 460, u1), RING1, lerp(7, 1, u1), PAL.ink, 1 - u1, 701);
      if (t >= 8.96 && t < 9.32) { const u2 = ease.outCubic(remap(t, 8.96, 9.32)); ring(ctx, t, lerp(190, 400, u2), RING2, lerp(12, 0, u2), PAL.badge, 1, 702); }
      // comets ride behind the blob from the impact on, so they are swallowed through their entry point
      for (const c of comets()) drawComet(ctx, c, t);
      // the hero blob: INK on frames 267–268, ORANGE from frame 269
      const frame = Math.floor(t * 30 + 1e-6);
      S.fill(ctx, heroPoints(t), frame <= 268 ? PAL.ink : PAL.orange);
      drawShards(ctx, t);
    }
    // before the impact the comets are drawn above everything in the world
    if (t < T_IMPACT) for (const c of comets()) drawComet(ctx, c, t);
  }

  SCENE({ id: 'merge', start: T_WIND, end: T_END, layer: 'world', page: 'thought', z: 0,
    draw(ctx, lt, t) { drawMerge(ctx, t); } });

  window.MERGE = { LOOP, groupMatrix, center, comets, heroPoints, HERO_ID };
})();
