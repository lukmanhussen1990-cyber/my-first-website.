// A red rose built in 3-D and painted petal by petal on a canvas. Each petal is a curved surface (narrow base, broad
// rounded top, cupped toward the heart of the flower; in the bud the tips lean in to a point, as it opens they lean out
// and the edges roll back) placed on the receptacle by ring and azimuth. The flower is seen from slightly above the
// front, petals are lit by the moon from the upper left plus a warm glow from the front, drawn back to front, and each
// casts a soft shadow on the petals behind it. Openness 0 = a tight bud, 1 = full bloom; outer rings open first.
const ROSE_RINGS = [   // n petals, length, width, angle closed -> open (deg), tip curl closed -> open (deg), roll, phase, delay
  { n: 3, L: 0.50, W: 0.42, a0: -2, a1: 14, c0: -8, c1: 14, roll: 0.00, ph: 0.0, d: 0.40 },
  { n: 4, L: 0.64, W: 0.50, a0: 0, a1: 30, c0: -14, c1: 30, roll: 0.06, ph: 0.6, d: 0.30 },
  { n: 5, L: 0.80, W: 0.60, a0: 2, a1: 46, c0: -20, c1: 48, roll: 0.12, ph: 0.2, d: 0.20 },
  { n: 5, L: 0.94, W: 0.70, a0: 4, a1: 62, c0: -26, c1: 70, roll: 0.18, ph: 0.9, d: 0.10 },
  { n: 5, L: 1.04, W: 0.78, a0: 7, a1: 80, c0: -30, c1: 96, roll: 0.24, ph: 0.45, d: 0.0 },
];
function smoothPath(ctx, P, closed = true) {          // Catmull-Rom through the points, as cubic Beziers
  const n = P.length; ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}
class Rose {
  constructor(o) {
    this.o = o = Object.assign({ x: 960, y: 860, S: 95, pitch: 36, seed: 3 }, o);
    const rnd = mulberry32(o.seed);
    this.petals = [];
    ROSE_RINGS.forEach((R, ri) => {
      for (let k = 0; k < R.n; k++) {
        const phi = (k / R.n + R.ph / R.n + 0.07 * (rnd() - 0.5)) * Math.PI * 2 + ri * 0.4;
        this.petals.push({ ri, R, phi, jit: 0.93 + 0.14 * rnd(), skew: 0.1 * (rnd() - 0.5), wav: rnd() * 6.28 });
      }
    });
  }
  _pt(p, u, v, open) {
    const R = p.R, o = clamp((open - R.d) / (1 - R.d * 0.6)), oe = ease.inOutSine(o);
    const a0 = lerp(R.a0, R.a1, oe) * Math.PI / 180, curl = lerp(R.c0, R.c1, oe) * Math.PI / 180;
    const L = R.L * p.jit * (0.9 + 0.1 * oe), Wd = R.W * p.jit * (0.6 + 0.4 * oe);
    const N = 16; let rho = 0.05 + 0.025 * p.ri, h = 0, alpha = a0;
    const vs = v * N, steps = Math.floor(vs);
    for (let i = 1; i <= steps; i++) { const vv = i / N; alpha = a0 + curl * vv * vv; rho += (L / N) * Math.sin(alpha); h += (L / N) * Math.cos(alpha); }
    const fr = vs - steps; if (fr > 0) { const vv = (steps + fr) / N; alpha = a0 + curl * vv * vv; rho += fr * (L / N) * Math.sin(alpha); h += fr * (L / N) * Math.cos(alpha); }
    const w = v < 0.6 ? Wd * (0.2 + 0.8 * Math.pow(v / 0.6, 0.65)) : Wd * Math.sqrt(Math.max(0, 1 - Math.pow((v - 0.6) / 0.42, 2)));
    const x = u * w * (1 + 0.035 * Math.sin(p.wav + 5 * u) * v);
    const cup = (0.6 - 0.32 * oe) * x * x / Math.max(0.2, Wd);
    const roll = R.roll * oe * Math.max(0, Math.abs(u) - 0.5) * Math.max(0, v - 0.5) * 5;
    const nIn = [-Math.cos(alpha), Math.sin(alpha)];
    const radial = rho + (cup - roll) * nIn[0], up = h + (cup - roll) * nIn[1];
    const phi = p.phi + p.skew * v;
    return [radial * Math.cos(phi) - x * Math.sin(phi), up, radial * Math.sin(phi) + x * Math.cos(phi)];
  }
  _proj(P) {
    const th = this.o.pitch * Math.PI / 180, S = this.o.S;
    return [P[0] * S, -(P[1] * Math.cos(th) - P[2] * Math.sin(th)) * S, P[1] * Math.sin(th) + P[2] * Math.cos(th)];
  }
  // draws the flower with its receptacle at (0,0) of the current canvas transform
  draw(ctx, open, { glow = 0 } = {}) {
    const grow = 0.72 + 0.28 * ease.inOutSine(clamp(open)); ctx.save(); ctx.scale(grow, grow);
    const th = this.o.pitch * Math.PI / 180, view = [0, Math.sin(th), Math.cos(th)];
    const nrm = a => { const l = Math.hypot(...a) || 1; return a.map(c => c / l); };
    const Lm = nrm([-0.5, 0.78, 0.38]), Lw = nrm([0.3, 0.15, 0.94]);
    const items = this.petals.map(p => {
      const pts = [];
      for (let i = 0; i <= 14; i++) pts.push(this._pt(p, -1, i / 14, open));
      for (let i = 1; i < 16; i++) { const t = Math.PI * i / 16; pts.push(this._pt(p, -Math.cos(t), 0.99, open)); }
      for (let i = 14; i >= 0; i--) pts.push(this._pt(p, 1, i / 14, open));
      const P2 = pts.map(q => this._proj(q));
      const a = this._pt(p, -0.3, 0.6, open), b = this._pt(p, 0.3, 0.6, open), c = this._pt(p, 0, 0.8, open), d0 = this._pt(p, 0, 0.4, open);
      const du = a.map((v, i) => b[i] - v), dv = d0.map((v, i) => c[i] - v);
      let n = nrm([du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]]);
      const facing = n[0] * view[0] + n[1] * view[1] + n[2] * view[2];
      if (facing < 0) n = n.map(v => -v);
      const k = 0.36 + 0.52 * Math.max(0, n[0] * Lm[0] + n[1] * Lm[1] + n[2] * Lm[2]) + 0.3 * Math.max(0, n[0] * Lw[0] + n[1] * Lw[1] + n[2] * Lw[2]);
      const depth = P2.reduce((s, q) => s + q[2], 0) / P2.length;
      return { p, P2, k: k * (0.82 + 0.06 * p.ri), inner: facing >= 0, depth, base: this._proj(this._pt(p, 0, 0, open)), tip: this._proj(this._pt(p, 0, 0.97, open)) };
    }).sort((A, B) => A.depth - B.depth);
    const S = this.o.S;
    items.forEach(it => {
      const { P2, k, inner, base, tip } = it;
      const col = c => `rgb(${c.map(v => Math.round(clamp(v * k, 0, 255))).join(',')})`;
      const C = inner ? [[52, 3, 14], [150, 12, 38], [214, 44, 70]] : [[80, 8, 22], [176, 30, 52], [222, 86, 104]];
      ctx.save();
      ctx.beginPath(); smoothPath(ctx, P2);
      // soft shadow on what lies behind
      ctx.shadowColor = 'rgba(18,0,6,0.55)'; ctx.shadowBlur = 0.11 * S; ctx.shadowOffsetY = 0.025 * S;
      const g = ctx.createLinearGradient(base[0], base[1], tip[0], tip[1]);
      g.addColorStop(0, col(C[0])); g.addColorStop(0.55, col(C[1])); g.addColorStop(1, col(C[2]));
      ctx.fillStyle = g; ctx.fill();
      ctx.shadowColor = 'transparent';
      // velvet: darker toward the base, a soft sheen across the middle
      ctx.clip();
      const rg = ctx.createRadialGradient(base[0], base[1], 0, base[0], base[1], Math.hypot(tip[0] - base[0], tip[1] - base[1]) * 0.9);
      rg.addColorStop(0, 'rgba(20,0,6,0.55)'); rg.addColorStop(0.6, 'rgba(20,0,6,0.08)'); rg.addColorStop(1, 'rgba(20,0,6,0)');
      ctx.fillStyle = rg; ctx.fill();
      ctx.restore();
      // a fine dark seam, and a rim of light along the top edge
      ctx.beginPath(); smoothPath(ctx, P2); ctx.lineWidth = 0.012 * S; ctx.strokeStyle = 'rgba(40,0,10,0.75)'; ctx.stroke();
      if (inner) { const top = P2.slice(16, 30);
        ctx.beginPath(); smoothPath(ctx, top, false); ctx.lineWidth = 0.012 * S; ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(255,${Math.round(96 + 60 * k)},${Math.round(112 + 50 * k)},${(0.10 + 0.32 * k * k).toFixed(3)})`; ctx.stroke(); }
    });
    this.items = items;
    if (this.dew && this.dew.k > 0) this._dew(ctx, open);
    ctx.restore();
  }
  // dew drops (the film's "shabnam"): set this.dew = { k: 0..1, glint: f } before drawing; drops sit on front petals
  _dew(ctx, open) {
    if (!this.dewSpots) {
      const front = this.items.slice(-9).filter(it => it.inner || it.p.ri >= 3);
      const spots = [[-0.3, 0.72, 5.2], [0.28, 0.58, 3.6], [0.05, 0.84, 4.4], [-0.1, 0.46, 3.0], [0.4, 0.78, 3.4], [-0.45, 0.6, 2.8], [0.2, 0.9, 3.0]];
      this.dewSpots = spots.map((sp, i) => ({ pi: this.petals.indexOf(front[front.length - 1 - (i % front.length)].p), u: sp[0], v: sp[1], r: sp[2], d: i / spots.length }));
    }
    const S = this.o.S;
    this.dewSpots.forEach((D, i) => {
      const k = clamp((this.dew.k - D.d * 0.7) * 3); if (k <= 0) return;
      const q = this._proj(this._pt(this.petals[D.pi], D.u, D.v, open)), r = D.r * (S / 74) * ease.outBack(k);
      ctx.save(); ctx.translate(q[0], q[1]);
      const body = ctx.createRadialGradient(r * 0.25, r * 0.3, 0, 0, 0, r);
      body.addColorStop(0, 'rgba(255,190,200,0.55)'); body.addColorStop(0.7, 'rgba(120,10,30,0.25)'); body.addColorStop(1, 'rgba(40,0,10,0.75)');
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.92, 0, 0, 6.283); ctx.fillStyle = body; ctx.fill();
      ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.34, r * 0.3, r * 0.2, -0.6, 0, 6.283); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.3, r * 0.42, r * 0.34, r * 0.13, 0.4, 0, 6.283); ctx.fillStyle = 'rgba(255,214,220,0.35)'; ctx.fill();
      // a glint that travels over the drops now and then
      const gl = Math.max(0, Math.sin((this.dew.glint - i * 9) / 7)); if (gl > 0.86) {
        const L = r * 3.2 * (gl - 0.86) / 0.14; ctx.strokeStyle = 'rgba(255,250,240,0.85)'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-r * 0.32 - L, -r * 0.34); ctx.lineTo(-r * 0.32 + L, -r * 0.34); ctx.moveTo(-r * 0.32, -r * 0.34 - L); ctx.lineTo(-r * 0.32, -r * 0.34 + L); ctx.stroke(); }
      ctx.restore();
    });
  }
  // screen position of a petal point (for dew drops, the bird's perch, sparkles), relative to the receptacle
  at(petalIndex, u, v, open) { return this._proj(this._pt(this.petals[petalIndex], u, v, open)); }
}
