// "How Big Is Allah's Mercy?" — one canvas timeline.  renderFrame(t) draws the frame at time t.
(function () {
  const W = 1080, H = 1920;
  const TL = window.TIMELINE, T = TL.T;
  const { clamp, lerp, inv, win, env, easeInOut, easeInOutSine, easeOut, easeIn, smooth, rng } = L;
  const TAU = Math.PI * 2;
  const GOLD = '#F2C46D', CREAM = '#FFF4DC';

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const GS = 0.25;
  const glow = L.canvas(W * GS, H * GS), gctx = glow.getContext('2d');
  const glowB = L.canvas(W * GS, H * GS), gbctx = glowB.getContext('2d');
  const land = L.canvas(W, H), lctx = land.getContext('2d');
  const landGlow = L.canvas(W * GS, H * GS), lgctx = landGlow.getContext('2d');

  // ------------------------------------------------------------ sprites
  function radialSprite(stops, size = 128) {
    const c = L.canvas(size, size), x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, col] of stops) g.addColorStop(o, col);
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    return c;
  }
  const SPR = {
    core: radialSprite([[0, 'rgba(255,253,244,1)'], [0.22, 'rgba(255,240,200,1)'], [0.45, 'rgba(248,212,140,0.9)'], [0.62, 'rgba(242,196,109,0.35)'], [1, 'rgba(242,196,109,0)']]),
    glow: radialSprite([[0, 'rgba(246,206,128,0.85)'], [0.25, 'rgba(242,196,109,0.45)'], [0.6, 'rgba(242,190,100,0.12)'], [1, 'rgba(242,190,100,0)']]),
    soft: radialSprite([[0, 'rgba(255,236,190,1)'], [0.5, 'rgba(242,196,109,0.35)'], [1, 'rgba(242,196,109,0)']]),
    cream: radialSprite([[0, 'rgba(255,248,230,1)'], [0.4, 'rgba(255,244,220,0.5)'], [1, 'rgba(255,244,220,0)']]),
    teal: radialSprite([[0, 'rgba(160,240,225,1)'], [0.4, 'rgba(95,201,184,0.5)'], [1, 'rgba(95,201,184,0)']]),
    dark: radialSprite([[0, 'rgba(6,10,24,0.85)'], [0.55, 'rgba(6,10,24,0.5)'], [1, 'rgba(6,10,24,0)']]),
  };
  const sprite = (c, s, x, y, r, a = 1) => {
    if (a <= 0.003 || r <= 0.1) return;
    c.globalAlpha = a; c.drawImage(s, x - r, y - r, r * 2, r * 2); c.globalAlpha = 1;
  };

  // ------------------------------------------------------------ geometric pattern
  const PAT_S = 170, PAT = L.canvas(2500, 2500);
  (function () {
    const x = PAT.getContext('2d');
    x.strokeStyle = GOLD; x.lineWidth = 2; x.lineJoin = 'round';
    const R = PAT_S * 0.36, n = Math.ceil(2500 / PAT_S) + 1;
    const sq = (cx, cy, r, rot) => {
      x.beginPath();
      for (let k = 0; k < 4; k++) { const a = rot + k * Math.PI / 2; const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r; k ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.closePath(); x.stroke();
    };
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const cx = i * PAT_S, cy = j * PAT_S;
      sq(cx, cy, R, 0); sq(cx, cy, R, Math.PI / 4);
      x.beginPath(); x.arc(cx, cy, PAT_S * 0.09, 0, TAU); x.stroke();
      x.beginPath(); x.moveTo(cx + R, cy); x.lineTo(cx + PAT_S - R, cy); x.moveTo(cx, cy + R); x.lineTo(cx, cy + PAT_S - R); x.stroke();
      sq(cx + PAT_S / 2, cy + PAT_S / 2, PAT_S * 0.13, Math.PI / 4);
    }
  })();

  // ------------------------------------------------------------ vignette + grain
  const VIG = L.canvas(W, H);
  (function () {
    const x = VIG.getContext('2d');
    x.save(); x.translate(W / 2, H / 2); x.scale(1, H / W * 0.82);
    const g = x.createRadialGradient(0, 0, W * 0.32, 0, 0, W * 0.78);
    g.addColorStop(0, 'rgba(2,4,12,0)'); g.addColorStop(0.6, 'rgba(2,4,12,0.28)'); g.addColorStop(1, 'rgba(2,4,12,0.72)');
    x.fillStyle = g; x.fillRect(-W, -W * 2, W * 2, W * 4); x.restore();
  })();
  const GRAIN = [0, 1, 2].map((k) => {
    const c = L.canvas(540, 960), x = c.getContext('2d'), d = x.createImageData(540, 960), r = rng(7 + k);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() + r() - 1) * 90; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); return c;
  });

  // ------------------------------------------------------------ world
  const GY = 5200;
  const groundY = (x) => GY + 22 * Math.sin(0.0023 * x + 0.9) + 12 * Math.sin(0.0061 * x + 2.4);
  const LANDX = 0;
  const FIG = {
    mother: { x: 60, sil: 'mother', scale: 1.0, t: T.mother },
    bird: { x: 700, sil: 'bird', scale: 1.12, t: T.bird },
    cat: { x: 1340, sil: 'cat', scale: 1.3, t: T.cat },
    horse: { x: 2160, sil: 'horse', scale: 1.05, t: T.horse },
  };
  const HILLS = [
    { p: 0.55, f: (x) => GY - 250 + 80 * Math.sin(x * 0.0012 + 0.5) + 46 * Math.sin(x * 0.0029 + 1.7) + 18 * Math.sin(x * 0.007 + 3), col: [26, 36, 82], rim: 0.45 },
    { p: 0.78, f: (x) => GY - 130 + 54 * Math.sin(x * 0.0018 + 2.1) + 30 * Math.sin(x * 0.0042 + 0.3), col: [17, 27, 62], rim: 0.7 },
    { p: 1.0, f: groundY, col: [10, 17, 40], rim: 1.0 },
  ];

  // ------------------------------------------------------------ vessel
  const VKEY = [[-272, 88], [-244, 134], [-200, 166], [-130, 174], [-40, 166], [50, 146], [140, 116], [214, 90], [262, 76]];
  function vw(y) {
    if (y <= VKEY[0][0]) return VKEY[0][1];
    for (let i = 0; i < VKEY.length - 1; i++) {
      const [y0, w0] = VKEY[i], [y1, w1] = VKEY[i + 1];
      if (y <= y1) {
        const m0 = i > 0 ? (w1 - VKEY[i - 1][1]) / (y1 - VKEY[i - 1][0]) : (w1 - w0) / (y1 - y0);
        const m1 = i < VKEY.length - 2 ? (VKEY[i + 2][1] - w0) / (VKEY[i + 2][0] - y0) : (w1 - w0) / (y1 - y0);
        const h = y1 - y0, s = (y - y0) / h, s2 = s * s, s3 = s2 * s;
        return (2 * s3 - 3 * s2 + 1) * w0 + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * w1 + (s3 - s2) * h * m1;
      }
    }
    return VKEY[VKEY.length - 1][1];
  }
  const GLASS = (() => {
    const p = new Path2D(), pts = [];
    for (let y = -272; y <= 262; y += 6) pts.push([vw(y), y]);
    p.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts) p.lineTo(q[0], q[1]);
    for (let i = pts.length - 1; i >= 0; i--) p.lineTo(-pts[i][0], pts[i][1]);
    p.closePath();
    return p;
  })();
  const facet = (k) => { const p = new Path2D(); for (let y = -272; y <= 262; y += 6) { const x = vw(y) * k; y === -272 ? p.moveTo(x, y) : p.lineTo(x, y); } return p; };
  const FACETS = [facet(-0.52), facet(0.0), facet(0.52)];
  const EDGE_R = facet(1), EDGE_L = facet(-1);
  const HILITE = (() => {
    const p = new Path2D();
    const ys = []; for (let y = -250; y <= 230; y += 8) ys.push(y);
    ys.forEach((y, i) => { const x = -vw(y) * 0.8; i ? p.lineTo(x, y) : p.moveTo(x, y); });
    for (let i = ys.length - 1; i >= 0; i--) p.lineTo(-vw(ys[i]) * 0.62, ys[i]);
    p.closePath(); return p;
  })();
  const DOME = L.smoothPath([[-98, -292, 's'], [-112, -318], [-108, -352], [-88, -384], [-58, -410], [-30, -432], [-12, -448], [0, -460, 's'],
    [12, -448], [30, -432], [58, -410], [88, -384], [108, -352], [112, -318], [98, -292, 's']]);
  const CAP_L = L.smoothPath([[-76, 284, 's'], [-70, 302], [-50, 324], [-24, 342], [0, 352, 's'], [0, 284, 's']]);
  const CAP_R = L.smoothPath([[76, 284, 's'], [70, 302], [50, 324], [24, 342], [0, 352, 's'], [0, 284, 's']]);

  function goldGrad(c, x0, x1, y = 0) {
    const g = c.createLinearGradient(x0, y, x1, y);
    g.addColorStop(0, '#6d4a17'); g.addColorStop(0.22, '#d9a957'); g.addColorStop(0.4, '#ffe9b4');
    g.addColorStop(0.62, '#f2c46d'); g.addColorStop(0.85, '#a7782c'); g.addColorStop(1, '#5e3f12');
    return g;
  }

  // ------------------------------------------------------------ drops: deterministic physics
  const NDROP = 100;
  const sim = { t: 0, x: [], y: [], vx: [], vy: [], r: [], alive: [], K: 0, exit: null };
  function simReset() {
    const R = rng(2024);
    sim.t = 0; sim.exit = null;
    for (let i = 0; i < NDROP; i++) {
      let x, y, ok, tries = 0;
      do {
        y = lerp(-235, 236, Math.pow(R(), 0.8));
        x = (R() * 2 - 1) * (vw(y) - 22);
        ok = true;
        for (let j = 0; j < i; j++) if (Math.hypot(x - sim.x[j], y - sim.y[j]) < 19) { ok = false; break; }
      } while (!ok && ++tries < 200);
      sim.x[i] = x; sim.y[i] = y; sim.vx[i] = 0; sim.vy[i] = 0; sim.r[i] = 6.5 + R() * 2.5; sim.alive[i] = true;
    }
    let best = 0, bd = 1e9;
    for (let i = 0; i < NDROP; i++) { const d = Math.hypot(sim.x[i], (sim.y[i] - 240) * 1.6); if (d < bd) { bd = d; best = i; } }
    sim.K = best;
  }
  function simStep(dt) {
    const t = sim.t, n = NDROP;
    for (let i = 0; i < n; i++) {
      if (!sim.alive[i]) continue;
      const x = sim.x[i], y = sim.y[i];
      let fx = 95 * L.noise2(x * 0.011 + t * 0.23, y * 0.011 + i * 0.37);
      let fy = 95 * L.noise2(y * 0.012 - t * 0.19 + 40, x * 0.012 + i * 0.21) + 9;
      if (i === sim.K && t > T.dropOpen - 1.7) {
        const k = 40 * smooth(inv(T.dropOpen - 1.7, T.dropOpen - 0.4, t));
        fx = (0 - x) * k - sim.vx[i] * 6; fy = (250 - y) * k - sim.vy[i] * 6;
      }
      sim.vx[i] += fx * dt; sim.vy[i] += fy * dt;
      sim.vx[i] *= (1 - 1.4 * dt); sim.vy[i] *= (1 - 1.4 * dt);
    }
    for (let i = 0; i < n; i++) {
      if (!sim.alive[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!sim.alive[j]) continue;
        const dx = sim.x[j] - sim.x[i], dy = sim.y[j] - sim.y[i], rr = sim.r[i] + sim.r[j] + 7;
        if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2), ov = rr - d, nx = dx / d, ny = dy / d;
          const wi = i === sim.K ? 0.15 : 0.5, wj = j === sim.K ? 0.15 : 0.5;
          const soft = 0.35;
          sim.x[i] -= nx * ov * wi * soft; sim.y[i] -= ny * ov * wi * soft; sim.x[j] += nx * ov * wj * soft; sim.y[j] += ny * ov * wj * soft;
          const rv = (sim.vx[j] - sim.vx[i]) * nx + (sim.vy[j] - sim.vy[i]) * ny;
          if (rv < 0) { sim.vx[i] += nx * rv * 0.5; sim.vy[i] += ny * rv * 0.5; sim.vx[j] -= nx * rv * 0.5; sim.vy[j] -= ny * rv * 0.5; }
        }
      }
    }
    for (let i = 0; i < n; i++) {
      if (!sim.alive[i]) continue;
      sim.x[i] += sim.vx[i] * dt; sim.y[i] += sim.vy[i] * dt;
      const r = sim.r[i];
      const bot = i === sim.K ? 254 : 246;
      if (sim.y[i] > bot - r) { sim.y[i] = bot - r; sim.vy[i] *= -0.4; }
      if (sim.y[i] < -258 + r) { sim.y[i] = -258 + r; sim.vy[i] *= -0.4; }
      const hw = vw(sim.y[i]) - 9 - r;
      if (sim.x[i] > hw) { sim.x[i] = hw; sim.vx[i] *= -0.4; }
      if (sim.x[i] < -hw) { sim.x[i] = -hw; sim.vx[i] *= -0.4; }
    }
    sim.t += dt;
    if (!sim.exit && sim.t >= T.dropExit) { sim.alive[sim.K] = false; sim.exit = [sim.x[sim.K], sim.y[sim.K] + sim.r[sim.K]]; }
  }
  function simAdvance(t) {
    t = Math.min(t, T.swirl + 3.5);
    if (t < sim.t - 1e-6) simReset();
    const dt = 1 / 120;
    while (sim.t + dt <= t + 1e-9) simStep(dt);
  }

  // ------------------------------------------------------------ motion functions
  const vesselRise = (t) => lerp(2100, 0, win(t, T.vesselRise, T.vesselSettled + 0.4, easeOut));
  const bob = (t) => 9 * Math.sin(t * 1.15) + 3 * Math.sin(t * 0.47 + 1);
  function vesselPos(t) { return [0, vesselRise(t) + bob(t)]; }

  const SLIP = 0.55;
  const LAND_Y = groundY(LANDX);
  function fallingDrop(t) {
    // world position of the drop that leaves the vessel
    const vp = vesselPos(Math.min(t, T.dropExit + SLIP));
    const ex = sim.exit || [0, 250];
    if (t < T.dropExit + SLIP) {
      const k = Math.pow(inv(T.dropExit, T.dropExit + SLIP, t), 2);
      return [vp[0] + ex[0] * (1 - k), vp[1] + lerp(ex[1], 400, k), 'slip'];
    }
    const y0 = vp[1] + 400;
    const s = inv(T.dropExit + SLIP, T.dropLand, t);
    const f = 0.33 * s + 0.67 * Math.pow(s, 2.2);
    return [Math.sin(s * TAU) * 26 * (1 - s), lerp(y0, LAND_Y, f), s];
  }

  // camera pan keyframes along the land
  const PAN = [[19.2, 0], [T.mother + 1.3, FIG.mother.x + 10], [T.bird + 1.3, FIG.bird.x + 10], [T.cat + 1.35, FIG.cat.x + 80],
    [T.horse + 0.8, FIG.horse.x - 60], [T.horse + 5.0, FIG.horse.x - 120]];
  function panX(t) {
    if (t <= PAN[0][0]) return PAN[0][1];
    if (t >= PAN[PAN.length - 1][0]) return PAN[PAN.length - 1][1];
    let i = 0; while (t > PAN[i + 1][0]) i++;
    const [t0, x0] = PAN[i], [t1, x1] = PAN[i + 1];
    const tan = (k) => (k <= 0 || k >= PAN.length - 1) ? 0 : 0.5 * (PAN[k + 1][1] - PAN[k - 1][1]) / (PAN[k + 1][0] - PAN[k - 1][0]);
    const h = t1 - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * x0 + (s3 - 2 * s2 + s) * h * tan(i) + (-2 * s3 + 3 * s2) * x1 + (s3 - s2) * h * tan(i + 1);
  }
  const VCY = -5;
  const smin = (a, b, k) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));
  const LANDCAM_Y = GY - 460;
  const LANDCAM_YE = -240 * Math.log(Math.exp(-(groundY(0) + 140) / 240) + Math.exp(-LANDCAM_Y / 240));
  const PULL = { x: 1130, y: GY - 230, z: 0.3 };

  function camera(t) {
    if (t < T.dropExit + 0.15) return { x: 0, y: VCY, z: lerp(0.84, 1.0, win(t, 3.9, 9.8, easeInOutSine)) };
    if (t < T.dropLand) {
      const d = fallingDrop(t);
      const w = win(t, T.dropExit + 0.15, T.dropExit + 1.1, easeInOutSine);
      const follow = smin(d[1] + 140, LANDCAM_Y, 240);
      return { x: d[0] * 0.5 * w, y: lerp(VCY, follow, w), z: lerp(1.0, 0.94, w) - 0.0 * (1 - w) + 0.06 * win(t, T.dropLand - 1.2, T.dropLand) };
    }
    if (t < T.pullBack) {
      const z = lerp(1.0, 1.07, win(t, T.dropLand, 20.5)) + 0.36 * win(t, T.horse + 0.4, T.horse + 5.0, easeInOutSine);
      const y = LANDCAM_YE + 150 * win(t, T.horse + 0.4, T.horse + 5.0, easeInOutSine);
      return { x: panX(t), y, z };
    }
    if (t < T.rise) {
      const k = win(t, T.pullBack, T.gather, easeInOut);
      const zk = win(t, T.pullBack, T.gather, (q) => { q = clamp(q); const q0 = 0.3; return q < q0 ? q * q / q0 : 1 - (1 - q) * (1 - q) / (1 - q0); });
      const end = camera(T.pullBack - 1e-4);
      return { x: lerp(end.x, PULL.x, k), y: lerp(end.y, PULL.y, k), z: Math.exp(lerp(Math.log(end.z), Math.log(PULL.z), zk)) };
    }
    if (t < T.vesselBack) {
      const k = win(t, T.rise, T.vesselBack, easeInOut), kx = win(t, T.rise, T.rise + 0.6, easeInOut);
      return { x: lerp(PULL.x, 0, kx), y: lerp(PULL.y, VCY, k), z: Math.exp(lerp(Math.log(PULL.z), 0, win(t, T.rise + 0.3, T.vesselBack, easeInOut))) };
    }
    return { x: 0, y: VCY, z: lerp(1.0, 0.9, win(t, T.swirl - 0.4, T.fill, easeInOutSine)) + 0.25 * win(t, T.fill, T.bright, easeInOut) };
  }
  const toS = (cam, wx, wy) => [(wx - cam.x) * cam.z + W / 2, (wy - cam.y) * cam.z + H / 2];

  // light spreading over the land after the splash
  const lightFront = (t) => { const s = Math.max(0, t - T.splash); return 150 * s + 40 * Math.pow(Math.max(0, s - 4), 2); };
  const litAt = (x, t) => { if (t < T.splash) return 0; const r = lightFront(t); return smooth(inv(r + 160, r - 220, Math.abs(x - LANDX))); };

  // day brightness (0 night .. 1 full warm light)
  const dayB = (t) => win(t, T.fill, T.bright, easeInOutSine) * (1 - win(t, T.settle, T.rahma + 0.4, easeInOutSine));

  // ------------------------------------------------------------ background
  const SKY = { night: [[8, 14, 36], [14, 26, 51], [27, 35, 80]], end: [[30, 26, 46], [74, 54, 30], [32, 26, 44]] };
  function drawBackground(c, t, cam) {
    const fadeIn = win(t, 0, 1.6, easeInOutSine);
    const e = win(t, T.end, T.end + 1.6, easeInOutSine);
    const top = L.mix(SKY.night[0], SKY.end[0], e), mid = L.mix(SKY.night[1], SKY.end[1], e), bot = L.mix(SKY.night[2], SKY.end[2], e);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, L.rgba(L.mix([0, 0, 0], top, fadeIn)));
    g.addColorStop(0.5, L.rgba(L.mix([0, 0, 0], mid, fadeIn)));
    g.addColorStop(1, L.rgba(L.mix([0, 0, 0], bot, fadeIn)));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // pattern: slow rotation, breathing opacity
    const pa = win(t, T.patternIn, 2.6, easeInOutSine) * (0.06 + 0.025 * Math.sin(t * 0.8)) * (1 + 0.9 * e) * (1 - 0.6 * dayB(t));
    if (pa > 0.002) {
      c.save();
      c.globalAlpha = pa;
      c.translate(W / 2, H / 2 - 80);
      c.rotate(t * 0.011);
      const ox = ((-cam.x * 0.03) % PAT_S + PAT_S) % PAT_S, oy = ((-cam.y * 0.03) % PAT_S + PAT_S) % PAT_S;
      c.drawImage(PAT, -1250 + ox - PAT_S, -1250 + oy - PAT_S);
      c.restore();
    }
  }

  // ------------------------------------------------------------ specks
  const SPECKS = (() => {
    const r = rng(11), a = [];
    for (let i = 0; i < 170; i++) {
      const d = 0.25 + 0.75 * r();
      a.push({ x: r() * W, y: r() * H, d, s: 0.8 + 2.4 * d * r() + 0.4, vy: 5 + 22 * d, amp: 5 + 16 * r(), f: 0.2 + 0.5 * r(), ph: r() * TAU,
        tw: 0.5 + 1.5 * r(), kind: r() < 0.06 ? 'teal' : r() < 0.25 ? 'gold' : 'cream' });
    }
    return a;
  })();
  function speckPos(p, t, cam) {
    return [p.x + p.amp * Math.sin(t * p.f + p.ph) - cam.x * cam.z * p.d * 0.55, p.y - p.vy * t - cam.y * cam.z * p.d * 0.55];
  }
  function drawSpecks(c, g, t, cam, camPrev) {
    const vis = win(t, 0.3, 2.2) * (1 - win(t, T.fadeOut, T.duration));
    if (vis <= 0) return;
    const boost = 1 + 1.2 * dayB(t);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (const p of SPECKS) {
      const a = speckPos(p, t, cam), b = speckPos(p, t - 1 / 30, camPrev);
      const ox = Math.floor(a[0] / (W + 40)) * (W + 40), oy = Math.floor(a[1] / (H + 40)) * (H + 40);
      const x = a[0] - ox, y = a[1] - oy, px = b[0] - ox, py = b[1] - oy;
      const al = vis * (0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * p.tw + p.ph))) * p.d;
      const col = p.kind === 'gold' ? '242,196,109' : p.kind === 'teal' ? '95,201,184' : '255,244,220';
      const dx = x - px, dy = y - py, sp = Math.hypot(dx, dy);
      if (sp > 5 && sp < 900) {
        c.strokeStyle = `rgba(${col},${(al * Math.min(1, 6 / Math.sqrt(sp))).toFixed(3)})`;
        c.lineWidth = p.s * 1.4;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - dx * 1.2, y - dy * 1.2); c.stroke();
      } else {
        sprite(c, p.kind === 'teal' ? SPR.teal : SPR.cream, x, y, p.s * 2.2, al);
      }
      if (p.d > 0.7) sprite(g, SPR.glow, x, y, 18 * p.d * boost, al * 0.35);
    }
    c.restore();
  }

  // ------------------------------------------------------------ vessel drawing
  function dropGlowMul(t) { return 1 + 1.3 * win(t, T.brighten, T.swirl, easeInOutSine); }

  // galaxy orbit for drop i (vessel-local coords) and depth (-1 back .. 1 front)
  const ORBIT = (() => {
    const r = rng(5), a = [];
    for (let i = 0; i < NDROP; i++) {
      const u = r(), R = 190 + 340 * Math.sqrt(u), arm = i % 2;
      a.push({ R, a0: arm * Math.PI + R * 0.011 + (r() - 0.5) * 0.5, w: 0.5 * Math.sqrt(240 / R), delay: r() * 1.5, yj: (r() - 0.5) * 30,
        fx: (r() * 2 - 1), fy: (r() * 2 - 1) });
    }
    return a;
  })();
  function orbitPos(i, t) {
    const o = ORBIT[i];
    const ang = o.a0 + o.w * (t - T.swirl) * 1.0 + 0.35 * win(t, T.swirl, T.swirl + 2.5);
    const spread = win(t, T.fill, T.bright + 0.4, easeInOutSine);
    const R = o.R * lerp(1, 2.6, spread);
    let x = Math.cos(ang) * R, y = Math.sin(ang) * R * lerp(0.3, 0.95, spread) + o.yj;
    // tilt
    const tl = -0.14, cx = x * Math.cos(tl) - y * Math.sin(tl), cy = x * Math.sin(tl) + y * Math.cos(tl);
    x = lerp(cx, o.fx * 620, spread * 0.55); y = lerp(cy, o.fy * 1050, spread * 0.55);
    return [x, y, Math.sin(ang)];
  }
  // where drop i is drawn (vessel-local), with depth and "outside" flag
  function dropState(i, t) {
    const sx = sim.x[i], sy = sim.y[i];
    if (t < T.swirl) return [sx, sy, 0, 0];
    const o = ORBIT[i];
    const k = win(t, T.swirl + o.delay, T.swirl + o.delay + 1.5, easeInOut);
    if (k <= 0) return [sx, sy, 0, 0];
    const p = orbitPos(i, t);
    // lift out over the top of the glass on the way
    const arc = Math.sin(k * Math.PI) * 120;
    return [lerp(sx, p[0], k), lerp(sy, p[1], k) - arc, p[2] * k, k];
  }

  function drawDrop(c, g, x, y, r, a, gm) {
    c.globalCompositeOperation = 'lighter';
    sprite(c, SPR.core, x, y, r * 1.6, a * 0.95);
    c.globalCompositeOperation = 'source-over';
    sprite(g, SPR.glow, x, y, r * 3.6 * (1 + 0.25 * (gm - 1)), a * Math.min(0.9, 0.3 * (1 + 0.35 * (gm - 1))));
  }

  function drawVessel(c, g, t, cam, alpha, dropsOn) {
    if (alpha <= 0.003 && !dropsOn) return;
    const vp = vesselPos(t);
    const [sx, sy] = toS(cam, vp[0], vp[1]);
    if (sy < -900 * cam.z || sy > H + 700 * cam.z) return;
    const z = cam.z;
    const gm = dropGlowMul(t);
    const aperture = env(t, T.dropOpen, T.dropExit - 0.05, T.dropExit + SLIP + 0.1, T.dropExit + SLIP + 0.7);
    const filled = 1 - win(t, T.swirl, T.swirl + 2.6);
    const lightIn = alpha * (0.55 + 0.45 * filled) * (0.85 + 0.15 * Math.sin(t * 1.7));

    // aura (glow buffer)
    sprite(g, SPR.glow, sx, sy, 620 * z, 0.38 * lightIn * (0.8 + 0.5 * (gm - 1)));
    g.save(); g.translate(sx, sy); g.scale(z, z);
    g.globalAlpha = 0.16 * lightIn; g.fillStyle = '#f2c46d'; g.fill(GLASS); g.restore();

    c.save();
    c.translate(sx, sy); c.scale(z, z);
    c.globalAlpha = alpha;
    // glass back
    const gb = c.createLinearGradient(-180, 0, 180, 0);
    gb.addColorStop(0, 'rgba(95,201,184,0.10)'); gb.addColorStop(0.5, 'rgba(255,244,220,0.05)'); gb.addColorStop(1, 'rgba(95,201,184,0.08)');
    c.fillStyle = gb; c.fill(GLASS);
    const gi = c.createRadialGradient(0, 60, 10, 0, 20, 280);
    gi.addColorStop(0, `rgba(242,196,109,${0.20 * lightIn})`); gi.addColorStop(1, 'rgba(242,196,109,0)');
    c.fillStyle = gi; c.fill(GLASS);
    c.restore();

    // drops inside (and those leaving, behind the glass when depth < 0)
    const drawSet = (front) => {
      for (let i = 0; i < NDROP; i++) {
        if (i === sim.K && t >= T.dropExit) continue;
        const st = dropState(i, t);
        if (st[3] > 0 && ((st[2] >= 0) !== front)) continue;
        if (st[3] === 0 && front) continue;
        const dx = sx + st[0] * z, dy = sy + st[1] * z;
        const depth = st[2];
        const r = sim.r[i] * z * (1 + 0.1 * (gm - 1)) * (1 + 0.28 * depth) * (1 + 1.4 * win(t, T.fill, T.bright, easeInOutSine));
        const a = (t > T.swirl ? 1 : alpha) * (st[3] > 0 ? (0.75 + 0.25 * depth) : 1) * (0.85 + 0.15 * Math.sin(t * 2.3 + i));
        drawDrop(c, g, dx, dy, r, a * (1 - win(t, T.bright - 0.6, T.settle + 0.6)), gm * (1 + 1.5 * win(t, T.fill, T.bright)));
      }
    };
    drawSet(false);

    c.save();
    c.translate(sx, sy); c.scale(z, z);
    c.globalAlpha = alpha;
    // facets + highlights
    c.lineWidth = 2.2;
    c.strokeStyle = 'rgba(242,196,109,0.38)';
    for (const f of FACETS) c.stroke(f);
    c.fillStyle = 'rgba(255,255,255,0.075)'; c.fill(HILITE);
    c.strokeStyle = 'rgba(255,250,235,0.35)'; c.lineWidth = 1.6;
    c.save(); c.translate(-vw(0) * 0.08, 0); c.stroke(facet(-0.74)); c.restore();
    // gold edges
    c.strokeStyle = goldGrad(c, -180, 180); c.lineWidth = 5; c.lineCap = 'round';
    c.stroke(EDGE_L); c.stroke(EDGE_R);
    // top collar + dome
    c.fillStyle = goldGrad(c, -112, 112);
    c.fill(DOME);
    c.fillStyle = goldGrad(c, -100, 100);
    c.beginPath(); c.roundRect(-100, -300, 200, 30, 8); c.fill();
    c.beginPath(); c.roundRect(-86, -276, 172, 10, 4); c.fill();
    // pierced windows in the dome, lit from inside
    c.fillStyle = `rgba(30,22,10,0.85)`;
    for (const [x, y, s] of [[-58, -350, 1], [0, -360, 1.15], [58, -350, 1], [-30, -405, 0.7], [30, -405, 0.7]]) {
      c.beginPath(); c.moveTo(x - 9 * s, y + 16 * s); c.lineTo(x - 9 * s, y - 2 * s); c.quadraticCurveTo(x, y - 18 * s, x + 9 * s, y - 2 * s); c.lineTo(x + 9 * s, y + 16 * s); c.closePath(); c.fill();
      sprite(c, SPR.soft, x, y + 4 * s, 9 * s, 0.75 * lightIn);
    }
    // finial + ring
    c.fillStyle = goldGrad(c, -14, 14);
    c.beginPath(); c.arc(0, -470, 11, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-4, -478); c.lineTo(0, -500); c.lineTo(4, -478); c.fill();
    c.strokeStyle = goldGrad(c, -20, 20); c.lineWidth = 5;
    c.beginPath(); c.arc(0, -519, 15, 0, TAU); c.stroke();
    // bottom collar
    c.fillStyle = goldGrad(c, -86, 86);
    c.beginPath(); c.roundRect(-84, 258, 168, 28, 8); c.fill();
    // bottom cap, opening as two petals
    const ap = aperture * 0.42;
    c.fillStyle = goldGrad(c, -76, 76);
    c.save(); c.translate(-76, 284); c.rotate(ap); c.translate(76, -284); c.fill(CAP_L);
    c.beginPath(); c.arc(0, 360, 8, Math.PI / 2, Math.PI * 1.5); c.fill(); c.restore();
    c.save(); c.translate(76, 284); c.rotate(-ap); c.translate(-76, -284); c.fill(CAP_R);
    c.beginPath(); c.arc(0, 360, 8, -Math.PI / 2, Math.PI / 2); c.fill(); c.restore();
    c.restore();

    // gold edge glow
    g.save(); g.translate(sx, sy); g.scale(z, z);
    g.globalAlpha = 0.55 * alpha; g.strokeStyle = '#f2c46d'; g.lineWidth = 10;
    g.stroke(EDGE_L); g.stroke(EDGE_R); g.fillStyle = '#f2c46d'; g.fill(DOME);
    g.restore();

    drawSet(true);
  }

  // ------------------------------------------------------------ counter
  const fontCG = (px) => `600 ${px}px CG`;
  function drawCounter(c, t, cam) {
    const a = win(t, 6.6, 7.3) * (1 - win(t, T.swirl + 1.2, T.swirl + 2.2)) * (1 - 0.8 * env(t, T.dropExit + 0.1, T.dropExit + 0.35, T.dropExit + 0.65, T.dropExit + 0.95));
    if (a <= 0) return;
    const vp = vesselPos(t);
    const [sx, sy] = toS(cam, vp[0], vp[1] + 470);
    if (sy < -100 || sy > H + 100) return;
    const z = cam.z;
    const draw = (txt, alpha, dy) => {
      if (alpha <= 0.003) return;
      c.save();
      c.font = fontCG(Math.round(76 * z)); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.globalAlpha = alpha;
      c.shadowColor = 'rgba(242,196,109,0.75)'; c.shadowBlur = 26 * z;
      c.fillStyle = CREAM; c.fillText(txt, sx, sy + dy * z);
      c.restore();
    };
    // count 0 -> 100 fast, then 100 -> 99
    let n = Math.round(100 * easeOut(inv(T.countStart, T.countEnd, t)));
    const k1 = win(t, T.count99, T.count99 + 0.45, easeInOut), k2 = win(t, T.count99 + 0.3, T.count99 + 0.85, easeOut);
    if (k1 <= 0) draw(String(n), a, 0);
    else { draw('100', a * (1 - k1), -40 * k1); draw('99', a * k2, 40 * (1 - k2)); }
    // thin ornament line under the number
    c.save(); c.globalAlpha = a * 0.6; c.strokeStyle = GOLD; c.lineWidth = 1.5 * z;
    c.beginPath(); c.moveTo(sx - 70 * z, sy + 52 * z); c.lineTo(sx + 70 * z, sy + 52 * z); c.stroke(); c.restore();
  }

  // ------------------------------------------------------------ falling drop
  const TEAR = (() => { const p = new Path2D(); p.moveTo(0, -2.7); p.bezierCurveTo(0.35, -1.6, 1, -0.75, 1, 0.05); p.arc(0, 0.05, 1, 0, Math.PI); p.bezierCurveTo(-1, -0.75, -0.35, -1.6, 0, -2.7); p.closePath(); return p; })();
  function drawTear(c, g, x, y, r, ang, a) {
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(r, r);
    const gr = c.createRadialGradient(-0.25, -0.1, 0.05, 0, 0, 1.3);
    gr.addColorStop(0, '#fffdf4'); gr.addColorStop(0.45, '#ffe6ac'); gr.addColorStop(1, '#f2c46d');
    c.globalAlpha = a; c.fillStyle = gr; c.fill(TEAR); c.restore();
    sprite(g, SPR.glow, x, y, r * 7, a);
    c.save(); c.globalCompositeOperation = 'lighter'; sprite(c, SPR.soft, x, y, r * 2.6, a * 0.5); c.restore();
  }
  function drawFalling(c, g, t, cam) {
    if (t < T.dropExit || t > T.dropLand + 0.05) return;
    const [x, y] = fallingDrop(t);
    const [sx, sy] = toS(cam, x, y);
    const r = 13 * cam.z;
    // trail: past positions
    const pts = [];
    for (let k = 0; k <= 26; k++) {
      const tt = t - k * 0.018;
      if (tt < T.dropExit) break;
      const p = fallingDrop(tt);
      pts.push(toS(cam, p[0], p[1]));
    }
    if (pts.length > 2) {
      const len = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
      if (len > 6) {
        const widths = pts.map((_, i) => r * 1.7 * Math.pow(1 - i / (pts.length - 1), 1.3) + 0.5);
        const path = L.smoothPath(L.taperPts(pts, widths, false, false));
        const lg = c.createLinearGradient(pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1]);
        lg.addColorStop(0, 'rgba(255,236,190,0.75)'); lg.addColorStop(0.4, 'rgba(242,196,109,0.35)'); lg.addColorStop(1, 'rgba(242,196,109,0)');
        c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = lg; c.fill(path); c.restore();
        pts.forEach((p, i) => { if (i % 2 === 0) sprite(g, SPR.glow, p[0], p[1], r * 5 * (1 - i / pts.length), 0.5 * (1 - i / pts.length)); });
      }
      // sparkles shed along the path
      const R = rng(77);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 40; k++) {
        const born = T.dropExit + SLIP + R() * (T.dropLand - T.dropExit - SLIP), life = 0.5 + R() * 0.6, ox = (R() - 0.5) * 40, oy = (R() - 0.5) * 30;
        const age = t - born;
        if (age < 0 || age > life) continue;
        const p = fallingDrop(born);
        const [qx, qy] = toS(cam, p[0] + ox * age * 2, p[1] + oy - 30 * age);
        sprite(c, SPR.cream, qx, qy, 3.2 * cam.z, 0.8 * (1 - age / life));
      }
      c.restore();
    }
    const d = pts.length > 1 ? [pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]] : [0, 1];
    const ang = Math.hypot(d[0], d[1]) > 0.5 ? Math.atan2(d[1], d[0]) - Math.PI / 2 : 0;
    drawTear(c, g, sx, sy, r, ang, 1);
  }

  // ------------------------------------------------------------ land
  function drawLand(c, g, t, cam) {
    const [, gs] = toS(cam, 0, GY);
    if (gs > H + 400 * cam.z) return;
    const lit = (x) => litAt(x, t);
    const glowAmt = win(t, T.splash, T.splash + 4, easeOut);
    // horizon haze
    if (glowAmt > 0) {
      g.save();
      const hy = (GY - 200 - cam.y) * cam.z + H / 2;
      const hg = g.createLinearGradient(0, hy - 700 * cam.z, 0, hy + 200 * cam.z);
      hg.addColorStop(0, 'rgba(242,196,109,0)'); hg.addColorStop(0.75, `rgba(242,186,100,${0.32 * glowAmt})`); hg.addColorStop(1, 'rgba(242,196,109,0)');
      g.fillStyle = hg; g.fillRect(0, hy - 700 * cam.z, W, 900 * cam.z);
      g.restore();
    }
    for (const L_ of HILLS) {
      const zl = 1 + (cam.z - 1) * L_.p, cx = cam.x * L_.p;
      const cy = cam.y;
      const pts = [];
      for (let sx = -40; sx <= W + 40; sx += 14) {
        const wx = cx + (sx - W / 2) / zl;
        pts.push([sx, (L_.f(wx) - cy) * zl + H / 2, wx]);
      }
      if (Math.min(...pts.map((p) => p[1])) > H + 20) continue;
      c.beginPath(); c.moveTo(pts[0][0], H + 50);
      for (const p of pts) c.lineTo(p[0], p[1]);
      c.lineTo(pts[pts.length - 1][0], H + 50); c.closePath();
      const top = Math.min(...pts.map((p) => p[1]));
      const fg = c.createLinearGradient(0, top, 0, top + 500 * zl);
      const warm = glowAmt * 0.35 * L_.rim;
      fg.addColorStop(0, L.rgba(L.mix(L_.col, [70, 58, 70], warm * 0.5)));
      fg.addColorStop(1, L.rgba(L.mix(L_.col, [6, 10, 26], 0.4)));
      c.fillStyle = fg; c.fill();
      // gold rim along the ridge where the light has reached
      if (t >= T.splash) {
        c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
        for (let i = 0; i < pts.length - 1; i++) {
          const k = lit(pts[i][2]) * L_.rim;
          if (k < 0.02) continue;
          c.strokeStyle = `rgba(245,207,131,${(0.75 * k).toFixed(3)})`; c.lineWidth = 2.6 * Math.max(0.5, zl);
          c.beginPath(); c.moveTo(pts[i][0], pts[i][1] + 1); c.lineTo(pts[i + 1][0], pts[i + 1][1] + 1); c.stroke();
          if (i % 3 === 0) sprite(g, SPR.glow, pts[i][0], pts[i][1], 90 * zl, 0.32 * k);
        }
        c.restore();
      }
    }
  }

  // light motes rising off the lit land
  const MOTES = (() => { const r = rng(31), a = []; for (let i = 0; i < 90; i++) a.push({ x: -700 + r() * 3500, ph: r() * 6, sp: 22 + r() * 30, life: 4 + r() * 4, s: 1.5 + r() * 2 }); return a; })();
  function drawMotes(c, g, t, cam) {
    if (t < T.splash) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const m of MOTES) {
      const age = ((t + m.ph * m.life) % m.life), k = age / m.life;
      const lx = m.x + Math.sin(t * 0.6 + m.ph) * 20;
      const a = litAt(lx, t) * Math.sin(k * Math.PI) * 0.8;
      if (a < 0.02) continue;
      const [sx, sy] = toS(cam, lx, groundY(lx) - 30 - age * m.sp);
      sprite(c, SPR.cream, sx, sy, m.s * 2.2 * cam.z, a);
      sprite(g, SPR.glow, sx, sy, 20 * cam.z, a * 0.5);
    }
    c.restore();
  }

  function drawSplash(c, g, t, cam) {
    const ts = t - T.splash;
    if (ts < 0 || ts > 12) return;
    const atk = smooth(ts / 0.14);
    const P = [LANDX, LAND_Y];
    const [px, py] = toS(cam, P[0], P[1]);
    const z = cam.z;
    // flash
    sprite(g, SPR.glow, px, py, 900 * z, 1.1 * atk * Math.exp(-ts * 2.2));
    sprite(g, SPR.soft, px, py - 40 * z, 380 * z, 0.6 * atk * Math.exp(-ts * 1.6));
    c.save(); c.globalCompositeOperation = 'lighter';
    sprite(c, SPR.soft, px, py, 240 * z, 0.9 * atk * Math.exp(-ts * 4));
    // pool of light at the impact point
    sprite(g, SPR.glow, px, py, (420 + 120 * Math.min(ts, 6)) * z, 0.55 * win(t, T.splash, T.splash + 0.4) * (1 - 0.7 * win(t, T.splash + 1.5, T.splash + 5.5)));
    // crown droplets
    const R = rng(404);
    for (let i = 0; i < 46; i++) {
      const ang = -Math.PI / 2 + (R() - 0.5) * 2.3, v = 330 + R() * 700, life = 0.9 + R() * 0.9, sz = 3 + R() * 4;
      if (ts > life) continue;
      const x = P[0] + Math.cos(ang) * v * ts, y = P[1] + Math.sin(ang) * v * ts + 0.5 * 1500 * ts * ts;
      if (y > groundY(x) + 10) continue;
      const vx = Math.cos(ang) * v, vy = Math.sin(ang) * v + 1500 * ts;
      const [sx, sy] = toS(cam, x, y);
      const a = 1 - ts / life;
      c.strokeStyle = `rgba(255,232,180,${(0.6 * a).toFixed(3)})`; c.lineWidth = sz * z * 0.9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - vx * 0.025 * z, sy - vy * 0.025 * z); c.stroke();
      sprite(c, SPR.core, sx, sy, sz * 1.8 * z, a);
      sprite(g, SPR.glow, sx, sy, sz * 7 * z, a * 0.6);
    }
    // shockwave + slow ripples across the land (flattened rings on the ground plane)
    const ring = (rx, a, lw) => {
      if (a <= 0.01) return;
      c.strokeStyle = `rgba(250,220,160,${a.toFixed(3)})`; c.lineWidth = lw * z;
      c.beginPath(); c.ellipse(px, py + 8 * z, rx * z, rx * 0.13 * z, 0, 0, TAU); c.stroke();
      g.save(); g.globalAlpha = a * 0.8; g.strokeStyle = '#f2c46d'; g.lineWidth = lw * 5 * z;
      g.beginPath(); g.ellipse(px, py + 8 * z, rx * z, rx * 0.13 * z, 0, 0, TAU); g.stroke(); g.restore();
    };
    ring(1500 * easeOut(clamp(ts / 1.3)), 0.8 * (1 - clamp(ts / 1.3)), 5);
    for (const d of [0.3, 1.1, 2.0, 3.0, 4.1, 5.3]) {
      const age = ts - d;
      if (age < 0) continue;
      ring(60 + 210 * age, 0.55 * Math.pow(1 - clamp(age / 6), 1.5) * clamp(age * 3), 3);
    }
    c.restore();
  }

  function figurePlace(f, t) {
    let x = f.x;
    if (f.sil === 'cat') x += catWalk(f, t);
    return [x, groundY(x)];
  }
  // walks ~6.5 s, then eases to a stop
  function catWalk(f, t) { const s = Math.max(0, t - (f.t - 1.5)); return 20 * (s < 5 ? s : 5 + 1.5 * easeOut((s - 5) / 1.5)); }

  function figureFrame(key, t, cam) {
    const f = FIG[key];
    const ap = win(t, f.t, f.t + 1.2, easeInOutSine);
    if (ap <= 0) return null;
    const [wx, wy] = figurePlace(f, t);
    const [sx, sy] = toS(cam, wx, wy);
    const sc = f.scale * cam.z;
    const [x0, y0, x1] = SIL[f.sil].bbox;
    if (sx + x1 * sc < -50 || sx + x0 * sc > W + 50) return null;
    return { f, ap, sx, sy, sc, cx: sx + (x0 + x1) / 2 * sc, hgt: -y0 * sc,
      flare: 1 + 0.8 * env(t, f.t, f.t + 0.5, f.t + 0.7, f.t + 2.2) };
  }
  // soft light behind each figure, so the dark silhouette reads against it
  function drawFigureAuras(c, g, t, cam) {
    for (const key of ['mother', 'bird', 'cat', 'horse']) {
      const F = figureFrame(key, t, cam);
      if (!F) continue;
      sprite(g, SPR.glow, F.cx, F.sy - F.hgt * 0.5, F.hgt * 1.1, 0.42 * F.ap * F.flare);
      c.save(); c.globalCompositeOperation = 'lighter';
      sprite(c, SPR.glow, F.cx, F.sy - F.hgt * 0.5, F.hgt * 0.9, 0.2 * F.ap);
      c.restore();
      if (key === 'horse') {
        const fg = win(t, T.hoofUp - 0.3, T.hoofHeld + 0.6, easeInOutSine) * (0.85 + 0.15 * Math.sin(t * 2.2));
        const [fx, fy] = SIL.horse.foal;
        sprite(g, SPR.glow, F.sx + fx * F.sc, F.sy + fy * F.sc, 260 * F.sc, 0.75 * fg);
        c.save(); c.globalCompositeOperation = 'lighter'; sprite(c, SPR.soft, F.sx + fx * F.sc, F.sy + fy * F.sc - 20 * F.sc, 170 * F.sc, 0.3 * fg); c.restore();
      }
    }
  }
  function drawFigures(c, g, t, cam) {
    for (const key of ['mother', 'bird', 'cat', 'horse']) {
      const F = figureFrame(key, t, cam);
      if (!F) continue;
      const o = { glow: 0.55 * F.flare };
      if (key === 'cat') o.walk = catWalk(F.f, t);
      if (key === 'horse') o.lift = win(t, T.hoofUp, T.hoofHeld, easeInOutSine);
      o.bodyAlpha = Math.pow(F.ap, 1.8); o.rimA = Math.min(1, F.ap * 1.8);
      SIL.render(c, g, SIL[F.f.sil], t, F.sx, F.sy, F.sc, F.ap, o);
    }
  }

  // ------------------------------------------------------------ the gathering into one drop
  const GATHER = (() => {
    const r = rng(9), a = [];
    for (let i = 0; i < 260; i++) {
      const x = -500 + r() * 3300;
      const fig = r() < 0.4;
      const key = ['mother', 'bird', 'cat', 'horse'][i % 4];
      const fx = fig ? FIG[key].x + (r() - 0.5) * 300 : x;
      const fy = fig ? groundY(fx) - r() * 420 : HILLS[i % 3].f(x) + r() * 40;
      a.push({ x: fx, y: fy, d: r() * 0.35, s: 1.5 + r() * 2.5, sp: (r() - 0.5) * 2 });
    }
    return a;
  })();
  function drawGather(c, g, t, cam) {
    const gk = win(t, T.gather, T.oneDrop - 0.2, easeInOut);
    const C0 = [W / 2, H / 2];
    // particles stream inward on a spiral
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const p of GATHER) {
      const k = clamp((gk - p.d) / (1 - p.d));
      if (gk <= 0 || k >= 1) continue;
      const [sx, sy] = toS(cam, p.x, p.y);
      const e = easeIn(k);
      const ang = Math.atan2(sy - C0[1], sx - C0[0]) + e * (1.4 + p.sp * 0.4);
      const rad = Math.hypot(sx - C0[0], sy - C0[1]) * (1 - e);
      const x = C0[0] + Math.cos(ang) * rad, y = C0[1] + Math.sin(ang) * rad;
      const a = Math.sin(Math.PI * Math.min(1, k * 1.25 + 0.1)) * 0.9;
      sprite(c, SPR.core, x, y, p.s * 2, a);
      sprite(g, SPR.glow, x, y, p.s * 9, a * 0.5);
    }
    c.restore();
  }
  function oneDropScreen(t, cam) {
    // the single drop: screen centre at the end of the gather, then fixed in the world
    const [wx, wy] = [PULL.x, PULL.y];
    const [sx, sy] = toS(cam, wx, wy);
    return [sx, sy];
  }
  function drawOneDrop(c, g, t, cam) {
    const a = win(t, T.gather + 1.2, T.oneDrop, easeInOutSine) * (1 - win(t, T.vesselBack - 0.3, T.vesselBack + 0.2));
    if (a <= 0) return;
    const [sx, sy] = oneDropScreen(t, cam);
    if (sy > H + 200) return;
    const pulse = 1 + 0.06 * Math.sin((t - T.oneDrop) * 3.2) + 0.25 * env(t, T.oneDrop - 0.4, T.oneDrop, T.oneDrop + 0.1, T.oneDrop + 1.0);
    sprite(g, SPR.glow, sx, sy, 200 * pulse, 0.7 * a);
    drawTear(c, g, sx, sy + 8, 15 * pulse, 0, a);
  }

  // ------------------------------------------------------------ warm day light
  function drawDayLight(c, t) {
    const b = dayB(t);
    if (b <= 0.002) return;
    c.save();
    c.globalAlpha = 0.94 * b;
    const rg = c.createRadialGradient(W / 2, H * 0.58, 40, W / 2, H * 0.58, H * 0.7);
    rg.addColorStop(0, '#fff3d6');
    rg.addColorStop(0.3, '#f7d79a');
    rg.addColorStop(0.62, '#dc9f55');
    rg.addColorStop(1, '#7e4f26');
    c.fillStyle = rg; c.fillRect(0, 0, W, H);
    c.restore();
    // a few motes still drifting in the light
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 50; i++) {
      const p = SPECKS[i];
      const x = (p.x + Math.sin(t * p.f + p.ph) * 30) % W, y = ((p.y - t * 40 * p.d) % H + H) % H;
      sprite(c, SPR.cream, x, y, 3 + 4 * p.d, 0.5 * b);
    }
    c.restore();
  }

  // soft gold light behind the calligraphy
  function drawHopeLight(c, g, t) {
    const a = win(t, T.settle, T.rahma + 1.0, easeInOutSine) * (1 - 0.5 * win(t, T.end, T.end + 1.5));
    if (a <= 0) return;
    sprite(g, SPR.glow, W / 2, 840, 820, 0.42 * a);
    c.save(); c.globalCompositeOperation = 'lighter';
    sprite(c, SPR.glow, W / 2, 860, 700, 0.14 * a);
    c.restore();
  }

  // ------------------------------------------------------------ captions
  const isArabic = (s) => /[؀-ۿﭐ-﷿ﹰ-﻿]/.test(s);
  const layoutCache = new Map();
  function layout(c, chunk) {
    if (layoutCache.has(chunk)) return layoutCache.get(chunk);
    const size = chunk.style === 'hook' ? 112 : chunk.style === 'quote' ? 66 : 76;
    const maxW = 900, space = size * 0.27;
    const font = (w) => isArabic(w.text) ? `400 ${Math.round(size * 1.0)}px Amiri` : fontCG(size);
    const items = chunk.words.map((w) => { c.font = font(w); return { w, font: font(w), width: c.measureText(w.text).width }; });
    const lines = [[]];
    let lw = 0;
    items.forEach((it, i) => {
      const forced = (chunk.style === 'hook' && i === 3) || (chunk.style === 'quote' && i === 3);
      if (lines[lines.length - 1].length && (forced || lw + space + it.width > maxW)) { lines.push([]); lw = 0; }
      lines[lines.length - 1].push(it);
      lw += (lw ? space : 0) + it.width;
    });
    const lh = size * 1.2, out = [];
    lines.forEach((ln, li) => {
      const total = ln.reduce((s, it) => s + it.width, 0) + space * (ln.length - 1);
      let x = W / 2 - total / 2;
      const y = chunk.y + (li - (lines.length - 1) / 2) * lh;
      for (const it of ln) { out.push({ ...it, x, y }); x += it.width + space; }
    });
    const res = { items: out, size, h: lines.length * lh, w: Math.max(...lines.map((ln) => ln.reduce((s, it) => s + it.width, 0) + space * (ln.length - 1))) };
    layoutCache.set(chunk, res);
    return res;
  }
  function drawWord(c, it, a, dy) {
    if (a <= 0.003) return;
    c.save();
    c.font = it.font; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.globalAlpha = a;
    c.fillStyle = it.w.gold ? GOLD : CREAM;
    const y = it.y + dy + (isArabic(it.w.text) ? 6 : 0);
    c.shadowColor = 'rgba(3,6,18,0.8)'; c.shadowBlur = 16; c.shadowOffsetY = 4;
    c.fillText(it.w.text, it.x, y);
    c.shadowColor = it.w.gold ? 'rgba(242,196,109,0.75)' : 'rgba(255,240,210,0.5)'; c.shadowBlur = 24; c.shadowOffsetY = 0;
    c.fillText(it.w.text, it.x, y);
    c.restore();
  }
  function drawChunk(c, chunk, t, alphaMul = 1) {
    const lay = layout(c, chunk);
    const out = 1 - smooth(inv(chunk.end - 0.24, chunk.end + 0.06, t));
    const b = Math.max(dayB(t), 0.6 * win(t, T.end, T.end + 1.6));
    if (b > 0.05) {
      const a = b * out * smooth(inv(chunk.start, chunk.start + 0.3, t));
      c.save(); c.translate(W / 2, chunk.y); c.scale(1, 0.45);
      sprite(c, SPR.dark, 0, 0, lay.w * 0.58 + 110, 0.4 * a); c.restore();
    }
    for (const it of lay.items) {
      const p = easeOut(inv(it.w.start - 0.12, it.w.start + 0.3, t));
      drawWord(c, it, p * out * alphaMul, (1 - p) * 22);
    }
  }
  function drawCaptions(c, t, opts) {
    if (opts.cover) {
      const fake = { style: 'hook', y: 300, start: -1, end: 99, words: TL.chunks[0].words.map((w) => ({ ...w, start: -1 })) };
      drawChunk(c, fake, 0);
      return;
    }
    for (const ch of TL.chunks) {
      if (ch.style === 'quote' || t < ch.start - 0.2 || t > ch.end + 0.5) continue;
      drawChunk(c, ch, t);
    }
  }

  // ------------------------------------------------------------ hope + end cards
  const RAHMA = L.canvas(W, 520), rctx = RAHMA.getContext('2d');
  function drawHope(c, g, t) {
    const a = win(t, T.rahma, T.rahma + 1.6, easeInOutSine) * (1 - win(t, T.end - 0.3, T.end + 0.5));
    if (a <= 0) return;
    const sc = lerp(0.93, 1, win(t, T.rahma, T.rahma + 2.4, easeOut));
    rctx.setTransform(1, 0, 0, 1, 0, 0); rctx.globalCompositeOperation = 'source-over'; rctx.clearRect(0, 0, W, 520);
    rctx.font = '700 380px Ruqaa'; rctx.textAlign = 'center'; rctx.textBaseline = 'middle'; rctx.direction = 'rtl';
    const gg = rctx.createLinearGradient(0, 120, 0, 420);
    gg.addColorStop(0, '#fff1cc'); gg.addColorStop(0.45, '#f7d283'); gg.addColorStop(1, '#d9a24b');
    rctx.fillStyle = gg; rctx.fillText('رحمة', W / 2, 250);
    // a slow light sweep across the word
    const sw = inv(T.rahma + 0.6, T.rahma + 2.4, t);
    if (sw > 0 && sw < 1) {
      rctx.globalCompositeOperation = 'source-atop';
      const bx = lerp(W * 0.85, W * 0.15, easeInOutSine(sw));
      const lg = rctx.createLinearGradient(bx - 90, 0, bx + 90, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,252,240,0.85)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      rctx.fillStyle = lg; rctx.fillRect(0, 0, W, 520);
    }
    c.save();
    c.translate(W / 2, 820); c.scale(sc, sc); c.translate(-W / 2, -260);
    c.globalAlpha = a;
    c.shadowColor = 'rgba(10,8,20,0.75)'; c.shadowBlur = 22; c.shadowOffsetY = 6;
    c.drawImage(RAHMA, 0, 0);
    c.shadowColor = 'rgba(242,196,109,0.55)'; c.shadowBlur = 36; c.shadowOffsetY = 0;
    c.drawImage(RAHMA, 0, 0);
    c.shadowColor = 'rgba(0,0,0,0)';
    c.restore();
    g.save(); g.globalAlpha = 0.3 * a; g.drawImage(RAHMA, 0, 820 - 260); g.restore();
    // ornament divider
    const oa = a * win(t, T.rahma + 0.8, T.rahma + 2.0);
    if (oa > 0) {
      c.save(); c.globalAlpha = oa; c.strokeStyle = GOLD; c.lineWidth = 2;
      const y = 1025;
      c.beginPath(); c.moveTo(370, y); c.lineTo(515, y); c.moveTo(565, y); c.lineTo(710, y); c.stroke();
      c.translate(540, y);
      for (const r of [0, Math.PI / 4]) { c.save(); c.rotate(r); c.strokeRect(-11, -11, 22, 22); c.restore(); }
      c.restore();
    }
    // quote (word by word with the voice) + reference
    const quote = TL.chunks.find((ch) => ch.style === 'quote');
    drawChunk(c, quote, t, a > 0 ? (1 - win(t, T.end - 0.3, T.end + 0.5)) : 0);
    const ra = win(t, T.quoteRef, T.quoteRef + 0.8) * (1 - win(t, T.end - 0.3, T.end + 0.5));
    if (ra > 0) {
      c.save(); c.globalAlpha = ra * 0.85; c.font = fontCG(38); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = CREAM; c.shadowColor = 'rgba(3,6,18,0.8)'; c.shadowBlur = 10;
      c.fillText('Quran 39:53', W / 2, 1290); c.restore();
    }
  }
  function drawEndCard(c, t) {
    const a = win(t, T.end + 1.2, T.end + 2.4);
    if (a <= 0) return;
    c.save(); c.globalAlpha = a * 0.8; c.font = fontCG(34); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = CREAM; c.shadowColor = 'rgba(3,6,18,0.8)'; c.shadowBlur = 10;
    c.fillText('Sahih al-Bukhari 6000  ·  Sahih Muslim 2752', W / 2, 1590);
    c.restore();
  }
  function drawWatermark(c) {
    c.save(); c.globalAlpha = 0.6; c.font = fontCG(32); c.textAlign = 'right'; c.textBaseline = 'alphabetic';
    c.fillStyle = CREAM; c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 6;
    c.fillText('@Grace In Motion', W - 40, H - 46); c.restore();
  }

  // ------------------------------------------------------------ frame
  // add the (blurred) glow buffer onto the frame, then clear it
  function flushGlow() {
    gbctx.setTransform(1, 0, 0, 1, 0, 0); gbctx.clearRect(0, 0, glowB.width, glowB.height);
    gbctx.filter = 'blur(3px)'; gbctx.drawImage(glow, 0, 0); gbctx.filter = 'none';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowB, 0, 0, W, H);
    ctx.globalAlpha = 0.5; ctx.drawImage(glow, 0, 0, W, H);
    ctx.restore();
    gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, glow.width, glow.height);
    gctx.setTransform(GS, 0, 0, GS, 0, 0); gctx.globalCompositeOperation = 'lighter';
  }
  function renderFrame(t, opts = {}) {
    simAdvance(t);
    const cam = camera(t), camPrev = camera(t - 1 / 30);
    if (opts.cover) { cam.y -= 90; camPrev.y -= 90; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, glow.width, glow.height);
    gctx.setTransform(GS, 0, 0, GS, 0, 0); gctx.globalCompositeOperation = 'lighter';

    drawBackground(ctx, t, cam);
    drawSpecks(ctx, gctx, t, cam, camPrev);

    // the land (rendered off-screen while it gathers into one drop)
    const gathering = t >= T.gather && t < T.oneDrop + 0.2;
    if (t >= T.dropExit + 1.0 && t < T.oneDrop + 0.2) {
      if (gathering) {
        lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, W, H);
        lgctx.setTransform(1, 0, 0, 1, 0, 0); lgctx.clearRect(0, 0, landGlow.width, landGlow.height);
        lgctx.setTransform(GS, 0, 0, GS, 0, 0); lgctx.globalCompositeOperation = 'lighter';
        drawLand(lctx, lgctx, t, cam); drawSplash(lctx, lgctx, t, cam); drawMotes(lctx, lgctx, t, cam);
        drawFigureAuras(lctx, lgctx, t, cam); drawFigures(lctx, lgctx, t, cam);
        // fade the land toward its centre as it shrinks
        const gk = win(t, T.gather, T.oneDrop - 0.3, easeInOut);
        lctx.globalCompositeOperation = 'destination-in';
        lctx.save(); lctx.translate(W / 2, H / 2 + 60); lctx.scale(1, 0.55);
        const mg = lctx.createRadialGradient(0, 0, 0, 0, 0, lerp(1500, 700, gk));
        mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(0.55, 'rgba(0,0,0,1)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = mg; lctx.fillRect(-W * 2, -H * 2, W * 4, H * 4); lctx.restore();
        lctx.globalCompositeOperation = 'source-over';
        const s = lerp(1, 0.02, easeIn(gk)), rot = 0.5 * easeIn(gk);
        const la = 1 - smooth(inv(0.55, 0.97, gk));
        for (const [src, dst, sz] of [[land, ctx, 1], [landGlow, gctx, 1 / GS]]) {
          dst.save();
          dst.globalAlpha = la;
          if (dst === gctx) dst.globalCompositeOperation = 'lighter';
          dst.translate(W / 2, H / 2); dst.rotate(rot); dst.scale(s, s); dst.translate(-W / 2, -(H / 2 + 60 * (1 - s)));
          dst.drawImage(src, 0, 0, W, H);
          dst.restore();
        }
      } else {
        drawLand(ctx, gctx, t, cam); drawSplash(ctx, gctx, t, cam); drawMotes(ctx, gctx, t, cam);
        drawFigureAuras(ctx, gctx, t, cam);
        flushGlow();
        drawFigures(ctx, gctx, t, cam);
      }
    }
    if (t >= T.gather) drawGather(ctx, gctx, t, cam);
    drawOneDrop(ctx, gctx, t, cam);

    // vessel, its drops and the counter
    const vOn = t < T.dropExit + 3 || t > T.rise;
    const vAlpha = vOn ? (1 - win(t, T.fill, T.bright - 0.8)) : 0;
    drawVessel(ctx, gctx, t, cam, vAlpha, vOn && t < T.settle + 0.6);
    if (vAlpha > 0) drawCounter(ctx, t, cam);
    drawFalling(ctx, gctx, t, cam);

    drawHopeLight(ctx, gctx, t);

    flushGlow();
    drawDayLight(ctx, t);

    ctx.drawImage(VIG, 0, 0);

    gctx.setTransform(GS, 0, 0, GS, 0, 0);
    drawHope(ctx, gctx, t);
    drawCaptions(ctx, opts.cover ? 0 : t, opts);
    drawEndCard(ctx, t);

    // film grain (breaks up banding in the dark gradients)
    ctx.save(); ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(GRAIN[Math.floor(t * 30) % 3], 0, 0, W, H); ctx.restore();

    // fade to black at the end
    const fo = win(t, T.fadeOut, T.duration - 0.15, easeInOutSine);
    if (fo > 0) { ctx.fillStyle = `rgba(0,0,0,${fo})`; ctx.fillRect(0, 0, W, H); }
    ctx.save(); ctx.globalAlpha = 1 - fo; drawWatermark(ctx); ctx.restore();
  }

  window.renderFrame = renderFrame;
  window.READY = Promise.all([
    document.fonts.load(fontCG(76)), document.fonts.load('400 76px Amiri'), document.fonts.load('700 300px Ruqaa'),
  ]).then(() => { simReset(); return true; });
})();
