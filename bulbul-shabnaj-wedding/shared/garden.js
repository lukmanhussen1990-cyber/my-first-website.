// The rose bush: a stem that grows up from below the frame, a side branch for the bulbul to land on, trifoliate rose
// leaves that unfurl as the stem passes them, green sepals under the flower, dew drops on the petals once it has
// bloomed, and the gold "song" motes the bulbul sings. Drawn on a canvas in world coordinates.
const bezPt = (P, t) => { const m = 1 - t; return [m * m * m * P[0][0] + 3 * m * m * t * P[1][0] + 3 * m * t * t * P[2][0] + t * t * t * P[3][0], m * m * m * P[0][1] + 3 * m * m * t * P[1][1] + 3 * m * t * t * P[2][1] + t * t * t * P[3][1]]; };
const bezTan = (P, t) => { const m = 1 - t; return [3 * m * m * (P[1][0] - P[0][0]) + 6 * m * t * (P[2][0] - P[1][0]) + 3 * t * t * (P[3][0] - P[2][0]), 3 * m * m * (P[1][1] - P[0][1]) + 6 * m * t * (P[2][1] - P[1][1]) + 3 * t * t * (P[3][1] - P[2][1])]; };
function drawLeaf(ctx, x, y, ang, L, k = 1) {          // one serrated leaflet with a midrib and veins; k = unfurl 0..1
  if (k <= 0.01) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(k, k * (0.6 + 0.4 * k));
  const W = L * 0.42, teeth = 9;
  ctx.beginPath(); ctx.moveTo(0, 0);
  for (let i = 1; i <= teeth; i++) { const t = i / teeth, w = W * Math.sin(Math.PI * Math.pow(t, 0.85)) * (1 - 0.15 * t); ctx.lineTo(t * L - L / teeth * 0.5, -w * 0.92); ctx.lineTo(t * L, -w * (i === teeth ? 0 : 1.06)); }
  for (let i = teeth - 1; i >= 0; i--) { const t = i / teeth, w = W * Math.sin(Math.PI * Math.pow(t, 0.85)) * (1 - 0.15 * t); ctx.lineTo(t * L + L / teeth * 0.5, w * 0.92); ctx.lineTo(t * L, w * (i === 0 ? 0 : 1.06)); }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -W, 0, W); g.addColorStop(0, '#2F5A43'); g.addColorStop(0.5, '#1A3D2B'); g.addColorStop(1, '#0E2219');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(160,190,220,0.30)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.strokeStyle = 'rgba(110,150,125,0.45)'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 0.95, 0); ctx.stroke();
  ctx.lineWidth = 0.6;
  for (let i = 1; i < 6; i++) { const t = i / 6; ctx.beginPath(); ctx.moveTo(t * L * 0.9, 0); ctx.lineTo(t * L * 0.9 + L * 0.1, -W * 0.7 * Math.sin(Math.PI * t)); ctx.moveTo(t * L * 0.9, 0); ctx.lineTo(t * L * 0.9 + L * 0.1, W * 0.7 * Math.sin(Math.PI * t)); ctx.stroke(); }
  ctx.restore();
}
function drawTrifoliate(ctx, x, y, ang, L, k) {         // a short stalk with three leaflets
  if (k <= 0.01) return;
  const c = Math.cos(ang), s = Math.sin(ang), st = L * 0.35 * k;
  ctx.strokeStyle = '#21402A'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + c * st, y + s * st); ctx.stroke();
  drawLeaf(ctx, x + c * st * 0.55, y + s * st * 0.55, ang - 0.85, L * 0.72, clamp(k * 1.4 - 0.25));
  drawLeaf(ctx, x + c * st * 0.55, y + s * st * 0.55, ang + 0.85, L * 0.72, clamp(k * 1.4 - 0.35));
  drawLeaf(ctx, x + c * st, y + s * st, ang, L, k);
}
class Garden {
  constructor(o) {
    this.o = o = Object.assign({ rx: 960, ry: 800, S: 100, seed: 5 }, o);
    this.rose = new Rose({ S: o.S, pitch: 38, seed: 3 });
    this.bird = new Bulbul({ S: 168 });
    this.stem = [[972, 1290], [930, 1175], [960, 1040], [o.rx, o.ry + 18]];
    this.branch = [[0, 0], [1010, 1085], [1080, 1068], [1190, 1058]];     // starts on the stem (filled in below)
    const b0 = bezPt(this.stem, 0.42); this.branch[0] = b0;
    this.perch = bezPt(this.branch, 0.35); this.perch2 = bezPt(this.branch, 0.98);
    this.leaves = [[0.2, -2.5, 66], [0.36, -0.55, 58], [0.58, -2.75, 52], [0.74, -0.35, 44]];
    this.branchLeaves = [[0.35, -1.9, 34], [0.82, -1.2, 30], [1.0, -0.15, 28]];
    // dew: petal index (an outer petal near the front), u, v, size
    this.drops = [];
    this.motes = [];
  }
  // stem / branch as tapered strokes up to growth g
  _stroke(ctx, P, g, w0, w1) {
    const N = 40, n = Math.max(1, Math.round(N * g));
    for (let i = 0; i < n; i++) {
      const a = bezPt(P, i / N), b = bezPt(P, (i + 1) / N), w = lerp(w0, w1, i / N);
      ctx.strokeStyle = '#1C3523'; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = 'rgba(96,150,110,0.5)'; ctx.lineWidth = w * 0.28; ctx.beginPath(); ctx.moveTo(a[0] - w * 0.18, a[1]); ctx.lineTo(b[0] - w * 0.18, b[1]); ctx.stroke();
    }
    // thorns
    for (const t of [0.18, 0.31, 0.5, 0.67, 0.83]) if (t < g * 0.98) {
      const p = bezPt(P, t), d = bezTan(P, t), L = Math.hypot(d[0], d[1]), nx = -d[1] / L, ny = d[0] / L, sd = (t * 7 % 2 < 1) ? 1 : -1;
      ctx.fillStyle = '#2B4A30'; ctx.beginPath(); ctx.moveTo(p[0] + sd * nx * 2 - d[0] / L * 3, p[1] + sd * ny * 2 - d[1] / L * 3); ctx.lineTo(p[0] + sd * nx * 9 + d[0] / L * 3, p[1] + sd * ny * 9 + d[1] / L * 3); ctx.lineTo(p[0] + sd * nx * 2 + d[0] / L * 4, p[1] + sd * ny * 2 + d[1] / L * 4); ctx.fill();
    }
  }
  drawBush(ctx, { grow = 1, branchGrow = 1, open = 0, budIn = 1, sway = 0 }) {
    ctx.save();
    // the whole bush sways gently from its root
    ctx.translate(972, 1290); ctx.rotate(sway * Math.PI / 180); ctx.translate(-972, -1290);
    this._stroke(ctx, this.stem, grow, 8, 5);
    if (branchGrow > 0) this._stroke(ctx, this.branch, branchGrow, 5, 3);
    this.leaves.forEach(([t, a, L], i) => { const p = bezPt(this.stem, t); drawTrifoliate(ctx, p[0], p[1], a, L, ease.outBack(clamp((grow - t - 0.04) / 0.22))); });
    this.branchLeaves.forEach(([t, a, L]) => { const p = bezPt(this.branch, t); drawTrifoliate(ctx, p[0], p[1], a, L, ease.outBack(clamp((branchGrow - t + 0.05) / 0.3))); });
    // sepals and the flower at the top of the stem
    if (budIn > 0.001) {
      const top = bezPt(this.stem, 1), k = budIn;
      ctx.save(); ctx.translate(top[0], top[1] - 18); ctx.scale(k, k);
      for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + (i - 2) * 0.55 * (0.7 + 0.5 * open) ; const L = 30 + 18 * open;
        ctx.save(); ctx.rotate(a - Math.PI / 2 + (i - 2) * 0.1); ctx.beginPath(); ctx.moveTo(-5, 0); ctx.quadraticCurveTo(-3, L * 0.6, 0, L); ctx.quadraticCurveTo(3, L * 0.6, 5, 0); ctx.closePath();
        ctx.fillStyle = '#244A2E'; ctx.fill(); ctx.restore(); }
      this.rose.draw(ctx, open);
      ctx.restore();
    }
    ctx.restore();
  }
}
