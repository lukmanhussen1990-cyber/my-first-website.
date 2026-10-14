// The celebration: paper sky lanterns that rise through the night at three depths (far ones small, slow and soft,
// near ones large and passing by the frame edges), rose petals that tumble down, and fireflies that wander near the
// garden. Everything is a deterministic function of the frame number (seeded positions, closed-form motion).
function drawLantern(g, x, y, h, rot, glowA, flick) {
  g.save(); g.translate(x, y); g.rotate(rot);
  // outer halo (additive)
  g.globalCompositeOperation = 'lighter';
  const halo = g.createRadialGradient(0, h * 0.1, 0, 0, h * 0.1, h * 2.1);
  halo.addColorStop(0, `rgba(255,170,80,${0.30 * glowA})`); halo.addColorStop(0.4, `rgba(255,120,40,${0.10 * glowA})`); halo.addColorStop(1, 'rgba(255,100,30,0)');
  g.fillStyle = halo; g.beginPath(); g.arc(0, h * 0.1, h * 2.1, 0, 6.283); g.fill();
  g.globalCompositeOperation = 'source-over';
  // the paper body: wider at the top, a gently domed crown
  const tw = 0.4 * h, bw = 0.28 * h, top = -0.5 * h, bot = 0.5 * h;
  g.beginPath(); g.moveTo(-bw, bot); g.lineTo(-tw, top + 0.08 * h); g.quadraticCurveTo(-tw, top - 0.04 * h, 0, top - 0.06 * h); g.quadraticCurveTo(tw, top - 0.04 * h, tw, top + 0.08 * h); g.lineTo(bw, bot); g.closePath();
  const body = g.createRadialGradient(0, bot * 0.55, 0, 0, bot * 0.2, h * 0.95);
  body.addColorStop(0, `rgba(255,246,206,${glowA})`); body.addColorStop(0.35, `rgba(255,200,110,${glowA})`); body.addColorStop(0.75, `rgba(236,128,46,${glowA})`); body.addColorStop(1, `rgba(170,70,26,${glowA})`);
  g.fillStyle = body; g.fill();
  // seams
  g.strokeStyle = `rgba(150,60,20,${0.35 * glowA})`; g.lineWidth = Math.max(0.6, h * 0.012);
  for (const k of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(k * bw, bot); g.lineTo(k * tw, top); g.stroke(); }
  // the opening and the flame
  g.beginPath(); g.ellipse(0, bot, bw, 0.06 * h, 0, 0, 6.283); g.fillStyle = `rgba(110,40,14,${0.85 * glowA})`; g.fill();
  g.globalCompositeOperation = 'lighter';
  const fl = g.createRadialGradient(0, bot - 0.02 * h, 0, 0, bot - 0.02 * h, 0.16 * h * flick);
  fl.addColorStop(0, `rgba(255,255,236,${glowA})`); fl.addColorStop(0.4, `rgba(255,220,120,${0.8 * glowA})`); fl.addColorStop(1, 'rgba(255,160,60,0)');
  g.fillStyle = fl; g.beginPath(); g.arc(0, bot - 0.02 * h, 0.16 * h * flick, 0, 6.283); g.fill();
  g.restore(); g.globalCompositeOperation = 'source-over';
}
function drawPetal(g, x, y, s, rot, flip, shade) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, Math.max(0.12, Math.abs(flip)));
  g.beginPath(); g.moveTo(0, s * 0.55); g.bezierCurveTo(-s * 0.75, s * 0.2, -s * 0.55, -s * 0.62, 0, -s * 0.42); g.bezierCurveTo(s * 0.55, -s * 0.62, s * 0.75, s * 0.2, 0, s * 0.55); g.closePath();
  const gr = g.createLinearGradient(0, s * 0.55, 0, -s * 0.6);
  const k = flip > 0 ? 1 : 0.8;
  gr.addColorStop(0, `rgb(${Math.round(90 * shade * k)},8,24)`); gr.addColorStop(0.6, `rgb(${Math.round(190 * shade * k)},${Math.round(28 * shade)},${Math.round(52 * shade)})`); gr.addColorStop(1, `rgb(${Math.round(232 * shade * k)},${Math.round(80 * shade)},${Math.round(100 * shade)})`);
  g.fillStyle = gr; g.fill();
  g.restore();
}
class Celebration {
  constructor() {
    const r = mulberry32(2024);
    // lanterns: depth 0 far .. 2 near; staggered launches from below the frame
    this.lanterns = [];
    const spec = [[0, 26, 18, 0.55], [1, 18, 40, 1.15], [2, 7, 86, 2.0]];
    spec.forEach(([d, n, h, v]) => { for (let i = 0; i < n; i++) {
      let x = r() * 1920;
      if (d === 2) x = r() < 0.5 ? 60 + r() * 330 : 1530 + r() * 330;              // near ones keep to the sides, clear of the names
      else if (d === 1) x = r() < 0.5 ? 40 + r() * 560 : 1320 + r() * 560;          // mid ones too
      this.lanterns.push({ d, h: h * (0.8 + 0.4 * r()), v: v * (0.8 + 0.4 * r()), x, t0: 690 + r() * (d === 0 ? 420 : 380) - (d === 0 ? 40 : 0), y0: 1110 + r() * 160,
        sw: (8 + 16 * r()) * (d + 1) * 0.5, sp: 0.012 + 0.02 * r(), ph: r() * 6.28, fl: r() * 6.28 }); } });
    this.lanterns.sort((a, b) => a.d - b.d);
    this.petals = Array.from({ length: 26 }, () => ({ x: (() => { const u = r(); return u < 0.8 ? (u < 0.4 ? u / 0.4 * 700 : 1220 + (u - 0.4) / 0.4 * 700) : 700 + (u - 0.8) / 0.2 * 520; })(), t0: 715 + r() * 520, v: 1.2 + 1.3 * r(), s: 9 + 14 * r(), sw: 20 + 40 * r(), sp: 0.02 + 0.03 * r(), ph: r() * 6.28, tr: 0.05 + 0.08 * r(), front: r() < 0.35 }));
    this.flies = Array.from({ length: 20 }, () => ({ x: 560 + r() * 800, y: 820 + r() * 240, sd: r() * 100, bp: r() * 6.28, bs: 0.05 + 0.08 * r() }));
  }
  // layer: 'back' (behind the arch: far and mid lanterns, back petals, fireflies) or 'front' (near lanterns, front petals)
  draw(g, f, layer, fade = 1) {
    if (fade <= 0.001) return;
    g.save(); g.globalAlpha = fade;
    this.lanterns.forEach(L => {
      if ((layer === 'front') !== (L.d === 2)) return;
      const t = f - L.t0; if (t < 0) return;
      const y = L.y0 - L.v * t - 0.0006 * t * t * L.v, x = L.x + L.sw * Math.sin(L.sp * t + L.ph);
      if (y < -L.h * 3) return;
      const rot = 0.06 * Math.sin(L.sp * 1.3 * t + L.ph), flick = 0.85 + 0.15 * Math.sin(f * 0.9 + L.fl) * Math.sin(f * 0.37 + L.fl * 2);
      const glowA = clamp(t / 20) * (L.d === 0 ? 0.75 : 1);
      if (L.d === 0) g.filter = 'blur(0.6px)'; else if (L.d === 2) g.filter = 'blur(2.2px)'; else g.filter = 'none';
      drawLantern(g, x, y, L.h, rot, glowA, flick);
    });
    g.filter = 'none';
    this.petals.forEach(P => {
      if (P.front !== (layer === 'front')) return;
      const t = f - P.t0; if (t < 0) return;
      const y = -40 + P.v * t, x = P.x + P.sw * Math.sin(P.sp * t + P.ph); if (y > 1140) return;
      g.filter = P.front ? 'blur(1.4px)' : 'none';
      drawPetal(g, x, y, P.s * (P.front ? 1.5 : 1), P.ph + t * P.tr, Math.cos(t * P.tr * 2.2 + P.ph), P.front ? 0.9 : 0.75);
    });
    g.filter = 'none';
    if (layer === 'back') this.flies.forEach((F, i) => {
      const a = Math.max(0, Math.sin(f * F.bs + F.bp)) ** 3 * smooth(700, 760, f); if (a < 0.02) return;
      const x = F.x + 60 * vnoise(f * 0.012, F.sd), y = F.y + 40 * vnoise(f * 0.015, F.sd + 7);
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(x, y, 0, x, y, 14); gr.addColorStop(0, `rgba(240,255,170,${a})`); gr.addColorStop(0.25, `rgba(200,240,120,${a * 0.5})`); gr.addColorStop(1, 'rgba(180,230,100,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 14, 0, 6.283); g.fill(); g.globalCompositeOperation = 'source-over';
    });
    g.restore();
  }
}
