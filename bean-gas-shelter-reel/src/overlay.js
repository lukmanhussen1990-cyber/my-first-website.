// The infographics, drawn on a 2D canvas over the graded picture (so they stay
// crisp and keep their colours): the countdown timer at the top, bold yellow fact
// labels that pop in with a small bounce and fade, thin white measuring lines with
// arrowheads at both ends, chunky white arrows for the clean air and green arrows
// for the gas, streaming along paths.
// Positions come from the 3D scene: world points are projected with the camera.
// Everything stays clear of the subtitle band (rows ~770-900) and the timer (top).
import * as THREE from 'three';
import { countdown } from './timeline.js';

export function build(ctx) {
  const { W, H, T, WD, U, camera } = ctx;
  const { clamp, smooth, prog, bump } = U;
  const S = W / 1080; // drawing scale (previews render smaller)
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  // a CPU canvas read back into a plain data texture every frame: handing a GPU canvas
  // straight to WebGL (software GPU) kept old pixels wherever the new frame is clear
  const g = cv.getContext('2d', { willReadFrequently: true });
  const pixels = new Uint8Array(W * H * 4);
  const texture = new THREE.DataTexture(pixels, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const FONT = 'InterBlack';
  const ready = (async () => {
    const f = new FontFace(FONT, 'url(/assets/fonts/Inter-Black.otf)');
    await f.load();
    document.fonts.add(f);
  })();

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const _v = new THREE.Vector3();
  const proj = (p) => {
    _v.copy(p).project(camera);
    return { x: ((_v.x + 1) / 2) * W, y: ((1 - _v.y) / 2) * H };
  };
  const YEL = '#ffd21a';

  // ---------------------------------------------------------------- drawing kit
  // a bold yellow label (one or two lines), popping in and fading out
  function label(lines, x, y, t, t0, t1, { size = 110, sub = 0.6, align = 'center' } = {}) {
    if (t < t0 || t > t1 + 0.35) return;
    const pin = prog(t, t0, 0.38);
    const sc = pin < 1 ? 0.35 + 0.65 * U.easeOutBack(pin, 2.6) : 1 + 0.06 * smooth(prog(t, t1, 0.35));
    const a = smooth(prog(t, t0, 0.12)) * (1 - smooth(prog(t, t1, 0.35)));
    if (a <= 0.003) return;
    g.save();
    g.globalAlpha = a;
    g.translate(x, y);
    g.scale(sc, sc);
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    let yy = lines.length > 1 ? -size * 0.36 : 0;
    lines.forEach((txt, i) => {
      const sz = (i === 0 ? size : size * sub) * S;
      g.font = `900 ${sz}px ${FONT}`;
      // soft drop shadow, a dark outline, the yellow face
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = sz * 0.22;
      g.shadowOffsetY = sz * 0.07;
      g.lineWidth = sz * 0.15;
      g.strokeStyle = '#17120a';
      g.strokeText(txt, 0, yy * S);
      g.shadowColor = 'transparent';
      g.fillStyle = YEL;
      g.fillText(txt, 0, yy * S);
      yy += size * 0.5 + (i === 0 ? size * sub * 0.55 : size * sub);
    });
    g.restore();
  }
  // a measuring line between two screen points: drawn out from the middle, arrowheads
  // at both ends, end ticks
  function measure(A, B, k, a) {
    if (k <= 0 || a <= 0) return;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const ax = mx + (A.x - mx) * k, ay = my + (A.y - my) * k, bx = mx + (B.x - mx) * k, by = my + (B.y - my) * k;
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    g.save();
    g.globalAlpha = a;
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 6 * S;
    g.strokeStyle = '#ffffff';
    g.fillStyle = '#ffffff';
    g.lineWidth = 3.5 * S;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(ax + ux * 10 * S, ay + uy * 10 * S);
    g.lineTo(bx - ux * 10 * S, by - uy * 10 * S);
    g.stroke();
    const head = (px, py, sx, sy) => {
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px - sx * 18 * S + nx * 8 * S, py - sy * 18 * S + ny * 8 * S);
      g.lineTo(px - sx * 18 * S - nx * 8 * S, py - sy * 18 * S - ny * 8 * S);
      g.closePath();
      g.fill();
    };
    head(ax, ay, -ux, -uy);
    head(bx, by, ux, uy);
    const tk = smooth(clamp((k - 0.85) / 0.15));
    if (tk > 0) {
      g.lineWidth = 3 * S;
      for (const P of [A, B]) {
        g.beginPath();
        g.moveTo(P.x + nx * 16 * S * tk, P.y + ny * 16 * S * tk);
        g.lineTo(P.x - nx * 16 * S * tk, P.y - ny * 16 * S * tk);
        g.stroke();
      }
    }
    g.restore();
  }
  // chunky white arrows streaming along a screen-space polyline
  function polyLen(pts) {
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return acc;
  }
  function pointAt(pts, acc, s) {
    const L = acc[acc.length - 1];
    s = clamp(s, 0, L);
    let i = 1;
    while (i < acc.length - 1 && acc[i] < s) i++;
    const k = (s - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
    return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
  }
  const AIR = ['#ffffff', '#b9bec4'], GAS = ['#9be22a', '#4f7a12'];
  function arrowAlong(pts, acc, s0, len, w, a, colr = AIR) {
    const L = acc[acc.length - 1];
    if (s0 + len < 0 || s0 > L) return;
    const fadeIn = smooth(clamp((s0 + len) / (len * 0.8))), fadeOut = smooth(clamp((L - s0) / (len * 0.8)));
    const al = a * Math.min(fadeIn, fadeOut);
    if (al <= 0.01) return;
    const n = 10;
    const body = [];
    const headL = Math.min(len * 0.42, w * 1.9);
    for (let i = 0; i <= n; i++) body.push(pointAt(pts, acc, s0 + ((len - headL) * i) / n));
    const tip = pointAt(pts, acc, s0 + len);
    const base = body[body.length - 1];
    const dx = tip.x - base.x, dy = tip.y - base.y, dl = Math.hypot(dx, dy) || 1;
    const nx = -dy / dl, ny = dx / dl;
    const draw = (off, col) => {
      g.strokeStyle = col;
      g.fillStyle = col;
      g.lineWidth = w;
      g.lineCap = 'butt';
      g.lineJoin = 'round';
      g.beginPath();
      body.forEach((p, i) => (i ? g.lineTo(p.x, p.y + off) : g.moveTo(p.x, p.y + off)));
      g.stroke();
      g.beginPath();
      g.moveTo(tip.x, tip.y + off);
      g.lineTo(base.x + nx * w * 1.05, base.y + ny * w * 1.05 + off);
      g.lineTo(base.x - nx * w * 1.05, base.y - ny * w * 1.05 + off);
      g.closePath();
      g.fill();
    };
    g.save();
    g.globalAlpha = al;
    g.shadowColor = 'rgba(0,0,0,0.4)';
    g.shadowBlur = 10 * S;
    g.shadowOffsetY = 3 * S;
    draw(w * 0.16, colr[1]); // a darker underside, so the arrow reads as a solid shape
    g.shadowColor = 'transparent';
    draw(0, colr[0]);
    g.restore();
  }
  // a stream of arrows along a world-space path (sampled, projected)
  function stream(path3, t, t0, t1, { n = 3, len = 120, w = 22, speed = 300, phase = 0, colr = AIR, loop = true } = {}) {
    if (t < t0 || t > t1) return;
    const a = smooth(prog(t, t0, 0.3)) * (1 - smooth(prog(t, t1 - 0.35, 0.35)));
    const pts = path3.map(proj);
    const acc = polyLen(pts);
    const L = acc[acc.length - 1];
    const gap = (L + len) / n;
    for (let i = 0; i < n; i++) {
      const raw = (t - t0) * speed * S + i * gap + phase * gap;
      const s = loop ? ((raw % (L + len)) + (L + len)) % (L + len) - len : Math.min(raw - len, L - len * S);
      arrowAlong(pts, acc, s, len * S, w * S, a, colr);
    }
  }
  const sampleCurve = (f, n = 24) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

  // ---------------------------------------------------------------- the graphics
  // labels stay out of the subtitle band and below the timer
  const BAND = [760 * S, 910 * S];
  const offBand = (y, h = 70) => (y + h * S > BAND[0] && y - h * S < BAND[1] ? (y < (BAND[0] + BAND[1]) / 2 ? BAND[0] - h * S : BAND[1] + h * S) : y);
  const clampX = (x, half) => Math.max(half * S + 24 * S, Math.min(W - half * S - 120 * S, x));
  // the countdown: a dark rounded panel with white digits at the top of the frame;
  // red and pulsing in the last ten seconds; flashes at 0:00
  function timer(t) {
    const v = countdown(t);
    if (v === null) return;
    const a = smooth(prog(t, T.timer0, 0.15)) * (1 - smooth(prog(t, T.blast + 1.6, 0.5)));
    if (a <= 0.003) return;
    const pin = prog(t, T.timer0, 0.42);
    let sc = pin < 1 ? 0.3 + 0.7 * U.easeOutBack(pin, 2.4) : 1;
    // a little kick on each new second in the last ten
    const last = t >= T.final0;
    if (last && t < T.zero + 0.2) sc *= 1 + 0.06 * Math.exp(-((t - T.final0) % ((T.zero - T.final0) / 10)) * 14);
    const zero = t >= T.zero;
    if (zero) sc *= 1 + 0.08 * Math.max(0, Math.sin((t - T.zero) * 14));
    const red = last ? 1 : 0;
    const txt = `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
    const cx = W / 2, cy = 178 * S;
    g.save();
    g.globalAlpha = a;
    g.translate(cx, cy);
    g.scale(sc, sc);
    // the panel
    const pw = 390 * S, ph = 156 * S, r = 34 * S;
    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowBlur = 24 * S;
    g.shadowOffsetY = 6 * S;
    g.fillStyle = red ? (zero && Math.sin((t - T.zero) * 14) > 0 ? 'rgba(205,22,22,0.92)' : 'rgba(150,12,12,0.88)') : 'rgba(14,16,18,0.78)';
    g.beginPath();
    g.roundRect(-pw / 2, -ph / 2, pw, ph, r);
    g.fill();
    g.shadowColor = 'transparent';
    g.lineWidth = 4 * S;
    g.strokeStyle = red ? 'rgba(255,170,160,0.9)' : 'rgba(255,210,26,0.95)';
    g.stroke();
    // a stopwatch icon on the left
    g.save();
    g.translate(-pw / 2 + 64 * S, 4 * S);
    g.strokeStyle = red ? '#ffffff' : YEL;
    g.fillStyle = g.strokeStyle;
    g.lineWidth = 7 * S;
    g.beginPath();
    g.arc(0, 0, 30 * S, 0, Math.PI * 2);
    g.stroke();
    g.fillRect(-8 * S, -46 * S, 16 * S, 10 * S);
    const hand = -Math.PI / 2 + ((300 - v) / 300) * Math.PI * 2;
    g.lineWidth = 6 * S;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(hand) * 20 * S, Math.sin(hand) * 20 * S);
    g.stroke();
    g.restore();
    // the digits, each in a fixed cell so they do not jitter
    g.font = `900 ${118 * S}px ${FONT}`;
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    const cells = [...txt];
    const cw = 70 * S, colon = 34 * S;
    let x = -pw / 2 + 128 * S + 8 * S;
    for (const ch of cells) {
      const w = ch === ':' ? colon : cw;
      g.fillText(ch, x + w / 2, 6 * S + (ch === ':' ? -6 * S : 0));
      x += w;
    }
    g.restore();
  }
  // a small white number next to a measuring line
  function smallText(txt, x, y, a, align = 'left') {
    if (a <= 0.01) return;
    g.save();
    g.globalAlpha = a;
    g.font = `900 ${52 * S}px ${FONT}`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 9 * S;
    g.strokeStyle = 'rgba(15,12,8,0.85)';
    g.strokeText(txt, x, y);
    g.fillStyle = '#ffffff';
    g.fillText(txt, x, y);
    g.restore();
  }

  function draw(t) {
    g.clearRect(0, 0, W, H);
    // 1: "3 CANS" over the little brother (above the subtitles; he stands below them)
    label(['3 CANS'], 0.5 * W, 640 * S, t, T.label3, 4.45, { size: 140 });
    // 2: the depth of the pit while it is dug; "HEAVIER THAN AIR" and the gas sinking in
    {
      const P = WD.pit(t);
      const a = smooth(prog(t, T.dig0 + 0.4, 0.3)) * (1 - smooth(prog(t, T.shell0 + 0.3, 0.3)));
      if (a > 0 && P.d > 0.25) {
        const x = P.x0 - 0.3;
        const A = proj(V(x, 0, 0.02)), B = proj(V(x, -P.d, 0.02));
        measure(A, B, 1, a);
        smallText(`${P.d.toFixed(1)} M`, A.x - 20 * S, (A.y + B.y) / 2, a, 'right');
      }
      label(['HEAVIER', 'THAN AIR'], 0.5 * W, 0.255 * H, t, T.labelHeavy, 14.45, { size: 118, sub: 0.82 });
      // green arrows: the gas drifting over the lawn, then sinking into the open stairwell
      const gp = [V(-3.8, 0.95, -0.8), V(-1.4, 0.85, -0.75), V(1.2, 0.75, -0.65), V(2.15, 0.25, -0.62), V(2.25, -1.2, -0.62)];
      stream(sampleCurve((u) => catmull(gp, u), 30), t, T.labelHeavy - 0.4, T.sink1 + 0.15, { n: 2, len: 150, w: 24, speed: 520, colr: GAS });
    }
    // 3: "AIRTIGHT" (below the subtitles, over the empty stairwell); green arrows press
    //    down on the door and stop at the seals
    {
      label(['AIRTIGHT'], 0.5 * W, 1090 * S, t, T.labelAir, 19.25, { size: 140 });
      // the rubber seals all round the door light up: a glowing outline traced round its edge
      const sa = U.bump(t, T.seals - 0.05, T.press1 - 0.4, 0.2);
      if (sa > 0) {
        const y = WD.TOP + 0.03, x0 = WD.HATCH.x0 - 0.05, x1 = WD.HATCH.x1 + 0.05, z0 = WD.HATCH.z0 - 0.07, z1 = -0.01;
        const pts = [V(x0, y, z1), V(x1, y, z1), V(x1, y, z0), V(x0, y, z0)].map(proj);
        const trace = smooth(prog(t, T.seals - 0.05, 0.5));
        const pulse = 0.7 + 0.3 * Math.sin((t - T.seals) * 10);
        g.save();
        g.globalAlpha = sa * pulse;
        g.strokeStyle = YEL;
        g.shadowColor = 'rgba(255,200,0,0.95)';
        g.shadowBlur = 22 * S;
        g.lineWidth = 7 * S;
        g.lineJoin = 'round';
        g.lineCap = 'round';
        // drawn round from the front left corner as the seals light up
        const acc = polyLen([...pts, pts[0]]);
        const Ltot = acc[acc.length - 1] * trace;
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i <= 4; i++) {
          const q = pts[i % 4];
          if (acc[i] <= Ltot) g.lineTo(q.x, q.y);
          else {
            const p0 = pts[i - 1], k = (Ltot - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
            g.lineTo(p0.x + (q.x - p0.x) * k, p0.y + (q.y - p0.y) * k);
            break;
          }
        }
        g.stroke();
        g.restore();
      }
      for (const [x, ph] of [[1.75, 0], [2.5, 0.5], [3.25, 0.25]]) {
        stream([V(x, 1.15, -0.62), V(x, WD.TOP + 0.12, -0.62)], t, T.press0 + 0.2, T.press1 - 0.25, { n: 1, len: 120, w: 22, speed: 260, phase: ph, colr: GAS });
      }
    }
    // 4: the pipe: "CLEAN AIR: 4 M UP" with a measuring line beside it; the gas stays low
    //    (green arrows along the ground), clean air comes down the pipe (white)
    {
      const k = smooth(prog(t, T.label4m - 0.2, 0.5)), a = 1 - smooth(prog(t, T.air1 - 0.25, 0.35));
      const x = WD.PIPE.x - 0.42, z = WD.PIPE.z;
      const A = proj(V(x, 0.02, z)), B = proj(V(x, WD.PIPE.top, z));
      measure(A, B, k, a);
      const L = proj(V(WD.PIPE.x, WD.PIPE.top - 0.5, z));
      label(['CLEAN AIR:', '4 M UP'], Math.max(L.x + 400 * S, 0.62 * W), offBand(L.y + 40 * S, 110), t, T.label4m, T.air1 - 0.25, { size: 86, sub: 1.0, align: 'center' });
      for (const [h, z2, ph] of [[0.18, -0.4, 0], [0.42, -1.4, 0.5], [0.3, -3.0, 0.25]]) {
        stream([V(-4.5, h, z2), V(0, h + 0.03, z2), V(5.5, h, z2)], t, T.lowGas, T.air1, { n: 3, len: 150, w: 22, speed: 420, phase: ph, colr: GAS });
      }
      const top = WD.PIPE.top;
      const pp = [V(WD.PIPE.x + 0.28, top + 0.9, z), V(WD.PIPE.x + 0.28, top - 0.05, z), V(WD.PIPE.x + 0.14, top + 0.14, z), V(WD.PIPE.x, top - 0.05, z), V(WD.PIPE.x, 1.5, z), V(WD.PIPE.x, WD.CEIL - 0.1, z), V(WD.PIPE.x + 0.3, WD.CEIL - 0.5, z + 0.4)];
      stream(pp, t, T.air0, T.air1, { n: 3, len: 130, w: 22, speed: 520 });
    }
    // 5: "CARBON FILTER"; inside the cutaway, white air passes through the bed
    {
      const fb = ctx.FX.filterBox;
      label(['CARBON', 'FILTER'], 0.5 * W, 560 * S, t, T.labelCarbon, T.clean1 - 0.2, { size: 124, sub: 1.0 });
      if (fb) {
        for (const [f, ph] of [[0.25, 0], [0.5, 0.45], [0.75, 0.2]]) {
          const x = fb.x0 + (fb.x1 - fb.x0) * f;
          stream([V(x, fb.y1 + 0.06, fb.z1 + 0.02), V(x, fb.y0 - 0.12, fb.z1 + 0.02)], t, T.clean0, T.clean1, { n: 1, len: 120, w: 20, speed: 230, phase: ph });
        }
        // the gas coming down the pipe into the bed: short green arrows that stop in it
        for (const [f, ph] of [[0.3, 0], [0.62, 0.5]]) {
          const x = fb.x0 + (fb.x1 - fb.x0) * f;
          stream([V(x, fb.y1 + 0.16, fb.z1 + 0.02), V(x, (fb.y0 + fb.y1) / 2, fb.z1 + 0.02)], t, T.dots0, T.clean0 + 0.3, { n: 1, len: 90, w: 18, speed: 160, phase: ph, colr: GAS });
        }
      }
    }
    // 6: the fan pushes clean air in; "+ PRESSURE"; air pushes out through every gap and
    //    the gas outside is turned back
    {
      const F = WD.FAN;
      // from the fan, forwards and down into the room (left of where he stands)
      for (const [dx, dy, ph] of [[-0.12, 0.08, 0], [0.05, -0.1, 0.5], [0.2, 0.05, 0.25]]) {
        stream([V(F.x + dx, F.y + dy, F.z + 0.12), V(F.x + 0.12 + dx, F.y - 0.2 + dy, F.z + 0.75), V(F.x + 0.3 + dx * 1.5, F.y - 0.55 + dy, F.z + 1.4)], t, T.push0, T.push1 + 0.6, { n: 1, len: 130, w: 24, speed: 330, phase: ph });
      }
      label(['+ PRESSURE'], 0.5 * W, 0.27 * H, t, T.labelPress, T.leak1, { size: 132 });
      // out through every gap: the door's seals, the wall and roof seams, the floor edge
      const z = -0.25, x0 = WD.OUT.x0, x1 = WD.OUT.x1, top = WD.TOP, bot = WD.FLOOR_B;
      const gaps = [
        ...[1.7, 2.5, 3.3].map((x) => [V(x, top - 0.1, -0.62), V(x, top + 0.55, -0.62)]),
        ...[-1.0, 0.1].map((x) => [V(x, WD.SHEET.roof - 0.1, z), V(x, 0.05, z)]),
        ...[-0.75, -1.5, -2.2].map((y) => [V(x0 + 0.25, y, z), V(x0 - 0.5, y, z)]),
        ...[-0.6, -1.4, -2.2].map((y) => [V(x1 - 0.25, y, z), V(x1 + 0.5, y, z)]),
        ...[-0.6, 0.9, 2.6].map((x) => [V(x, bot + 0.25, z), V(x, bot - 0.45, z)]),
      ];
      gaps.forEach(([a, b], i) => stream([a, b], t, T.leak0 + (i % 5) * 0.1, T.leak1, { n: 1, len: 115, w: 26, speed: 210, phase: (i * 0.37) % 1 }));
      // the gas outside pushed back: green arrows turning away from the door
      for (const [x, ph] of [[1.9, 0.2], [3.1, 0.7]]) {
        stream([V(x, 1.1, -0.62), V(x, 0.62, -0.62), V(x + (x < 2.5 ? -0.35 : 0.35), 0.95, -0.62)], t, T.leak0 + 0.4, T.leak1, { n: 1, len: 110, w: 20, speed: 240, phase: ph, colr: GAS });
      }
    }
    // 7: the timer hits 0:00; the cloud rolls out (green arrows radiating over the yard);
    //    "SMELL RADIUS: 50 M" with a measuring line out to the edge of the frame
    {
      for (const [ang, ph] of [[-0.45, 0], [0.0, 0.4], [0.45, 0.2], [2.8, 0.6], [3.3, 0.1]]) {
        const s0 = WD.CLOUD_SRC;
        const pts = sampleCurve((u) => V(s0.x + Math.sin(ang) * 18 * u, 2.6 + 0.5 * Math.sin(u * 3), s0.z + Math.cos(ang) * 9 * u), 16);
        stream(pts, t, T.blast + 0.25, T.labelRadius + 0.4, { n: 2, len: 170, w: 26, speed: 760, phase: ph, colr: GAS });
      }
      const k = smooth(prog(t, T.labelRadius - 0.15, 0.6)), a = 1 - smooth(prog(t, T.safe0 + 0.3, 0.35));
      const A = proj(V(WD.KID.x, 3.3, WD.KID.z));
      measure(A, { x: 20 * S, y: A.y }, k, a);
      label(['SMELL RADIUS:', '50 M'], 0.5 * W, offBand(A.y - 170 * S, 120), t, T.labelRadius, T.safe0 + 0.3, { size: 96, sub: 1.35 });
    }
    timer(t);
    pixels.set(g.getImageData(0, 0, W, H).data);
    texture.needsUpdate = true;
  }
  function catmull(pts, u) {
    const n = pts.length - 1;
    const f = clamp(u) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const k = f - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
    const k2 = k * k, k3 = k2 * k;
    const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * k + (2 * a - 5 * b + 4 * c2 - d) * k2 + (-a + 3 * b - 3 * c2 + d) * k3);
    return V(c(p0.x, p1.x, p2.x, p3.x), c(p0.y, p1.y, p2.y, p3.y), c(p0.z, p1.z, p2.z, p3.z));
  }

  return { texture, ready, draw };
}
