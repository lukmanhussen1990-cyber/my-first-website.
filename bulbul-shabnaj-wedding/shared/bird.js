// The bulbul: a red-whiskered bulbul (pointed black crest, white cheek, red whisker spot, buff breast, olive-brown wings,
// long dark tail with pale tips, red under the tail), painted on a canvas with gradients and a moonlit rim along its
// back. Facing left; origin at its feet on the perch; unit = body length (about 160 px at scale 1).
// State: fly 0..1 (perched -> in flight posture), flap phase (radians), beak 0..1 (open), tilt (head, deg), bob.
function featherPath(ctx, x, y, len, wid, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c;
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + c * len * 0.3 + px * wid, y + s * len * 0.3 + py * wid, x + c * len * 0.85 + px * wid * 0.7, y + s * len * 0.85 + py * wid * 0.7, x + c * len, y + s * len);
  ctx.bezierCurveTo(x + c * len * 0.85 - px * wid * 0.5, y + s * len * 0.85 - py * wid * 0.5, x + c * len * 0.3 - px * wid * 0.6, y + s * len * 0.3 - py * wid * 0.6, x, y);
}
class Bulbul {
  constructor(o) { this.o = Object.assign({ S: 160 }, o); }
  draw(ctx, st = {}) {
    const { fly = 0, flap = 0, beak = 0, tilt = 0, bob = 0, throat = 0, blink = 0 } = st;
    const S = this.o.S;
    ctx.save(); ctx.scale(S, S); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const lw = 1 / S;
    // in flight the body tips forward and the legs tuck in
    const bodyRot = lerp(-0.08, -0.62, fly), legs = 1 - fly;
    // ---------------------------------------------------------- legs and toes gripping the perch
    if (legs > 0.02) {
      ctx.globalAlpha = legs; ctx.strokeStyle = '#2A2422'; ctx.lineWidth = 0.022;
      ctx.beginPath(); ctx.moveTo(0.02, -0.16); ctx.lineTo(-0.01, -0.02); ctx.lineTo(-0.07, 0.0); ctx.moveTo(-0.01, -0.02); ctx.lineTo(0.05, 0.004); ctx.moveTo(0.06, -0.15); ctx.lineTo(0.05, -0.02); ctx.lineTo(0.0, 0.006); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.save(); ctx.translate(0.02, -0.2 + bob); ctx.rotate(bodyRot); ctx.translate(-0.02, 0.2);
    // ---------------------------------------------------------- tail: long, dark, pale-tipped; fans a little in flight
    const tailA = lerp(0.95, 0.35, fly);
    for (let i = 0; i < 4; i++) {
      const a = tailA + (i - 1.5) * lerp(0.035, 0.12, fly), L = 0.56 - Math.abs(i - 1.5) * 0.02;
      ctx.beginPath(); featherPath(ctx, 0.2, -0.17, L, 0.07, a);
      const g = ctx.createLinearGradient(0.2, -0.17, 0.2 + Math.cos(a) * L, -0.17 + Math.sin(a) * L);
      g.addColorStop(0, '#2B241C'); g.addColorStop(0.8, '#3A3128'); g.addColorStop(0.9, '#8A7E6A'); g.addColorStop(1, '#D8CCB2');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(10,8,6,0.5)'; ctx.lineWidth = lw * 0.8; ctx.stroke();
    }
    // red under the tail
    ctx.beginPath(); ctx.ellipse(0.17, -0.12, 0.07, 0.045, 0.7, 0, 6.283);
    const rv = ctx.createRadialGradient(0.17, -0.12, 0, 0.17, -0.12, 0.08); rv.addColorStop(0, '#E0263A'); rv.addColorStop(1, '#8E0E1C');
    ctx.fillStyle = rv; ctx.fill();
    // ---------------------------------------------------------- far wing (in flight, behind the body)
    if (fly > 0.02) this._wing(ctx, flap + 0.25, fly, true);
    // ---------------------------------------------------------- body: buff breast, olive-brown back
    ctx.beginPath();
    ctx.moveTo(-0.2, -0.55);
    ctx.bezierCurveTo(-0.3, -0.42, -0.24, -0.2, -0.08, -0.13);
    ctx.bezierCurveTo(0.05, -0.08, 0.2, -0.1, 0.27, -0.2);
    ctx.bezierCurveTo(0.22, -0.36, 0.08, -0.52, -0.06, -0.6);
    ctx.closePath();
    const bg = ctx.createLinearGradient(-0.25, -0.5, 0.2, -0.15);
    bg.addColorStop(0, '#E9DFCB'); bg.addColorStop(0.45, '#CDBFA2'); bg.addColorStop(1, '#7E705A');
    ctx.fillStyle = bg; ctx.fill();
    // back / mantle
    ctx.beginPath();
    ctx.moveTo(-0.08, -0.64); ctx.bezierCurveTo(0.08, -0.56, 0.22, -0.42, 0.29, -0.21);
    ctx.bezierCurveTo(0.18, -0.26, 0.04, -0.38, -0.12, -0.5); ctx.closePath();
    const mg = ctx.createLinearGradient(0, -0.6, 0.25, -0.25); mg.addColorStop(0, '#4A4032'); mg.addColorStop(1, '#2C261E');
    ctx.fillStyle = mg; ctx.fill();
    // ---------------------------------------------------------- near wing: folded on the side, or beating in flight
    if (fly < 0.98) { ctx.save(); ctx.globalAlpha = 1 - fly;
      ctx.beginPath();
      ctx.moveTo(-0.08, -0.5); ctx.bezierCurveTo(0.08, -0.52, 0.28, -0.36, 0.4, -0.16);
      ctx.bezierCurveTo(0.26, -0.18, 0.08, -0.24, -0.06, -0.32); ctx.closePath();
      const wg = ctx.createLinearGradient(-0.05, -0.48, 0.38, -0.18); wg.addColorStop(0, '#5C4E3A'); wg.addColorStop(0.6, '#43382A'); wg.addColorStop(1, '#2A231B');
      ctx.fillStyle = wg; ctx.fill();
      ctx.strokeStyle = 'rgba(160,140,108,0.55)'; ctx.lineWidth = lw * 1.1;
      for (let i = 0; i < 5; i++) { const t = i / 5; ctx.beginPath(); ctx.moveTo(lerp(0.02, 0.2, t), lerp(-0.42, -0.3, t)); ctx.quadraticCurveTo(lerp(0.16, 0.3, t), lerp(-0.36, -0.24, t), lerp(0.3, 0.4, t), lerp(-0.22, -0.16, t)); ctx.stroke(); }
      ctx.restore(); }
    if (fly > 0.02) this._wing(ctx, flap, fly, false);
    // ---------------------------------------------------------- head (tilts when singing)
    ctx.save(); ctx.translate(-0.16, -0.58); ctx.rotate(tilt * Math.PI / 180); ctx.translate(0.16, 0.58);
    // throat puffs as it sings
    { const tr = 0.062 + 0.016 * throat, tg = ctx.createRadialGradient(-0.2, -0.49, 0, -0.2, -0.49, tr); tg.addColorStop(0, '#F3EEE2'); tg.addColorStop(0.55, 'rgba(238,231,216,0.7)'); tg.addColorStop(1, 'rgba(233,223,203,0)');
      ctx.beginPath(); ctx.ellipse(-0.2, -0.49, tr, tr * 0.8, -0.4, 0, 6.283); ctx.fillStyle = tg; ctx.fill(); }
    // crest + crown
    ctx.beginPath();
    ctx.moveTo(-0.33, -0.62); ctx.bezierCurveTo(-0.33, -0.72, -0.27, -0.78, -0.2, -0.79);
    ctx.bezierCurveTo(-0.2, -0.85, -0.2, -0.9, -0.17, -0.95);              // crest tip, leaning forward a touch
    ctx.bezierCurveTo(-0.13, -0.88, -0.09, -0.8, -0.06, -0.72);
    ctx.bezierCurveTo(-0.04, -0.66, -0.07, -0.58, -0.12, -0.55);
    ctx.bezierCurveTo(-0.2, -0.52, -0.3, -0.54, -0.33, -0.62); ctx.closePath();
    const hg = ctx.createLinearGradient(-0.3, -0.95, -0.1, -0.55); hg.addColorStop(0, '#2E3448'); hg.addColorStop(0.5, '#151925'); hg.addColorStop(1, '#0E1018');
    ctx.fillStyle = hg; ctx.fill();
    // white cheek and the red whisker spot
    ctx.beginPath(); ctx.ellipse(-0.235, -0.585, 0.052, 0.036, -0.25, 0, 6.283); ctx.fillStyle = '#F6F3EC'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(-0.19, -0.612, 0.022, 0.014, -0.5, 0, 6.283);
    const rw = ctx.createRadialGradient(-0.19, -0.612, 0, -0.19, -0.612, 0.026); rw.addColorStop(0, '#FF3A46'); rw.addColorStop(1, '#A3101E'); ctx.fillStyle = rw; ctx.fill();
    // a thin dark line under the cheek
    ctx.beginPath(); ctx.moveTo(-0.29, -0.56); ctx.quadraticCurveTo(-0.24, -0.535, -0.18, -0.55); ctx.strokeStyle = '#141720'; ctx.lineWidth = 0.012; ctx.stroke();
    // beak: the lower mandible opens as it sings
    ctx.fillStyle = '#1C1C22';
    ctx.beginPath(); ctx.moveTo(-0.315, -0.648); ctx.quadraticCurveTo(-0.38, -0.655, -0.43, -0.636); ctx.lineTo(-0.315, -0.622); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(-0.315, -0.624); ctx.rotate(-0.42 * beak);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-0.105, -0.008); ctx.quadraticCurveTo(-0.06, 0.016, 0, 0.014); ctx.closePath(); ctx.fill(); ctx.restore();
    // eye with a catch-light (blinks now and then)
    const eyH = 0.026 * (1 - 0.9 * blink);
    ctx.beginPath(); ctx.ellipse(-0.258, -0.66, 0.026, eyH, 0, 0, 6.283); ctx.fillStyle = '#050508'; ctx.fill();
    ctx.lineWidth = lw * 1.2; ctx.strokeStyle = 'rgba(200,170,120,0.6)'; ctx.stroke();
    if (blink < 0.6) { ctx.beginPath(); ctx.arc(-0.266, -0.668, 0.008, 0, 6.283); ctx.fillStyle = '#FFFFFF'; ctx.fill(); }
    // moonlit rim along the top of the head and crest
    ctx.beginPath(); ctx.moveTo(-0.32, -0.66); ctx.bezierCurveTo(-0.31, -0.73, -0.26, -0.78, -0.2, -0.79); ctx.bezierCurveTo(-0.2, -0.85, -0.2, -0.9, -0.17, -0.95);
    ctx.strokeStyle = 'rgba(190,206,255,0.55)'; ctx.lineWidth = lw * 1.6; ctx.stroke();
    ctx.restore();
    // moonlit rim along the back
    ctx.beginPath(); ctx.moveTo(-0.06, -0.62); ctx.bezierCurveTo(0.08, -0.56, 0.22, -0.42, 0.29, -0.21);
    ctx.strokeStyle = 'rgba(190,206,255,0.42)'; ctx.lineWidth = lw * 1.6; ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  // a beating wing seen from the side: a fan of primaries and secondaries hinged at the shoulder
  _wing(ctx, flap, fly, far) {
    const up = Math.sin(flap), open = fly;
    const base = [-0.02, -0.5];
    const span = lerp(0.2, 0.62, open), lift = up * 1.15;            // radians above / below the body line
    ctx.save(); ctx.globalAlpha = (far ? 0.75 : 1) * clamp(fly * 1.4);
    for (let i = 8; i >= 0; i--) {
      const t = i / 8, a = -Math.PI / 2 - lift * (0.6 + 0.4 * t) + lerp(1.5, 0.2, t) * (far ? -0.9 : 1) * 0.55 + 0.9;
      const L = span * lerp(1.0, 0.62, t);
      ctx.beginPath(); featherPath(ctx, base[0] + 0.05 * t, base[1] + 0.03 * t, L, 0.06, a);
      const g = ctx.createLinearGradient(base[0], base[1], base[0] + Math.cos(a) * L, base[1] + Math.sin(a) * L);
      g.addColorStop(0, far ? '#3A3226' : '#5A4C38'); g.addColorStop(1, far ? '#241E17' : '#352C21');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(170,150,118,0.4)'; ctx.lineWidth = 0.9 / this.o.S; ctx.stroke();
    }
    ctx.restore();
  }
}
