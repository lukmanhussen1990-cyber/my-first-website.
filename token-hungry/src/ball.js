// The hungry yellow ball. Drawn procedurally so squash, stretch, cheeks and
// face can all be animated continuously. Face features live on a virtual
// sphere and are projected, so turning the head reads as real 3D.
import { TAU, clamp, lerp, gauss, angDiff, hash, vnoise } from './util.js';
import { C, softEllipse, brush, bez } from './style.js';

export function ballState(over = {}) {
  return Object.assign(
    {
      x: 0,
      y: 0,
      R: 105,
      sx: 1,
      sy: 1,
      pivot: 1, // local y of the squash pivot (1 = bottom contact point)
      rot: 0,
      vAxis: 0, // smear axis (world angle) and amount
      vK: 1,
      reach: 0, // teardrop elongation toward reachDir (world angle)
      reachDir: 0,
      yaw: 0,
      pitch: 0,
      faceDX: 0,
      faceDY: 0,
      eyeOpen: 1,
      lid: 0,
      lidTilt: 0,
      lidL: null,
      lidR: null,
      happy: 0,
      happyL: null,
      happyR: null,
      wide: 0,
      eyeScale: 1,
      cross: 0,
      mouthOpen: 0,
      mouthW: 0.15,
      smile: 0.55,
      smirk: 0,
      chew: 0,
      wavy: 0,
      tongue: 0, // little lick at the mouth corner
      puffL: 0,
      puffR: 0,
      blush: 0.6,
      jaw: 0,
      sweat: 0,
      boil: 0,
      boilAmp: 1,
      ground: null,
      shadowK: 1,
      alpha: 1,
    },
    over,
  );
}

// Project a point on the unit face-sphere. lon/lat in radians; y is down.
function proj(lon, lat, yaw, pitch) {
  const cl = Math.cos(lat);
  const sl = Math.sin(lat);
  let x = Math.sin(lon) * cl;
  let y = sl;
  let z = Math.cos(lon) * cl;
  let ux = Math.cos(lon);
  let uy = 0;
  let uz = -Math.sin(lon);
  let vx = -Math.sin(lon) * sl;
  let vy = cl;
  let vz = -Math.cos(lon) * sl;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  [ux, uz] = [ux * cy + uz * sy, -ux * sy + uz * cy];
  [vx, vz] = [vx * cy + vz * sy, -vx * sy + vz * cy];
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  [y, z] = [y * cp - z * sp, y * sp + z * cp];
  [uy, uz] = [uy * cp - uz * sp, uy * sp + uz * cp];
  [vy, vz] = [vy * cp - vz * sp, vy * sp + vz * cp];
  return { x, y, z, a: ux, b: uy, c: vx, d: vy };
}

// 2x2 deformation: rotate(rot) * axisStretch(vAxis, vK) * diag(sx, sy)
function deform(s) {
  const k = s.vK;
  const ca = Math.cos(s.vAxis - s.rot);
  const sa = Math.sin(s.vAxis - s.rot);
  // axis stretch in body frame
  const m00 = ca * ca * k + (sa * sa) / k;
  const m01 = ca * sa * (k - 1 / k);
  const m11 = sa * sa * k + (ca * ca) / k;
  // times diag(sx, sy)
  const a0 = m00 * s.sx;
  const b0 = m01 * s.sx;
  const c0 = m01 * s.sy;
  const d0 = m11 * s.sy;
  const cr = Math.cos(s.rot);
  const sr = Math.sin(s.rot);
  return {
    a: cr * a0 - sr * b0,
    b: sr * a0 + cr * b0,
    c: cr * c0 - sr * d0,
    d: sr * c0 + cr * d0,
  };
}

function eyeShape(ctx, s, side) {
  const lidV = side < 0 ? (s.lidL ?? s.lid) : (s.lidR ?? s.lid);
  const hap = side < 0 ? (s.happyL ?? s.happy) : (s.happyR ?? s.happy);
  const rx = 0.104 * s.eyeScale * (1 + 0.2 * s.wide);
  const ry = 0.168 * s.eyeScale * (1 + 0.26 * s.wide);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink;
  ctx.fillStyle = C.ink;

  if (hap >= 0.5) {
    // Content, closed "^" eyes.
    const k = clamp((hap - 0.5) * 2);
    ctx.lineWidth = 0.042;
    ctx.beginPath();
    ctx.moveTo(-rx * 1.3, ry * 0.18);
    ctx.quadraticCurveTo(0, ry * (0.18 - 0.95 * k), rx * 1.3, ry * 0.18);
    ctx.stroke();
    return;
  }
  const open = clamp(s.eyeOpen * (1 - hap * 2));
  if (open < 0.16) {
    ctx.lineWidth = 0.038;
    ctx.beginPath();
    ctx.moveTo(-rx * 1.25, ry * 0.12);
    ctx.quadraticCurveTo(0, ry * 0.42, rx * 1.25, ry * 0.12);
    ctx.stroke();
    return;
  }
  const ry2 = ry * open;
  const cy = (ry - ry2) * 0.45;
  ctx.save();
  if (lidV > 0.001) {
    const tilt = s.lidTilt * side;
    const y0 = cy - ry2 + 2 * ry2 * lidV * 0.92;
    const yl = (x) => y0 - tilt * x * 1.6;
    ctx.beginPath();
    ctx.moveTo(-rx * 1.25, yl(-rx * 1.25));
    ctx.quadraticCurveTo(0, y0 - ry2 * 0.12, rx * 1.25, yl(rx * 1.25));
    ctx.lineTo(rx * 1.25, ry * 3);
    ctx.lineTo(-rx * 1.25, ry * 3);
    ctx.closePath();
    ctx.clip();
  }
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry2, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry2, 0, 0, TAU);
  ctx.clip();
  ctx.fillStyle = C.goldHi;
  const look = s.cross * side;
  ctx.beginPath();
  ctx.ellipse(-rx * 0.3 - look * rx * 0.25, cy - ry2 * 0.42, rx * 0.36, rx * 0.4, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rx * 0.32 - look * rx * 0.2, cy + ry2 * 0.4, rx * 0.15, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.restore();
  if (lidV > 0.04) {
    const tilt = s.lidTilt * side;
    const y0 = cy - ry2 + 2 * ry2 * lidV * 0.92;
    ctx.save();
    ctx.globalAlpha *= clamp((lidV - 0.04) * 8);
    ctx.beginPath();
    ctx.ellipse(0, cy, rx * 1.28, ry2 * 1.35 + 0.02, 0, 0, TAU);
    ctx.clip();
    ctx.lineWidth = 0.034;
    ctx.beginPath();
    ctx.moveTo(-rx * 1.25, y0 + tilt * rx * 1.25 * 1.6);
    ctx.quadraticCurveTo(0, y0 - ry2 * 0.12, rx * 1.25, y0 - tilt * rx * 1.25 * 1.6);
    ctx.stroke();
    ctx.restore();
  }
}

// Mouth in feature space. Returns the interior path for clipping.
function mouthShape(ctx, s, inside) {
  const w = s.mouthW;
  const open = clamp(s.mouthOpen, 0, 1.2);
  const sm = s.smile;
  const sk = s.smirk;
  const yL = 0.02 * sk;
  const yR = -0.085 * sk;
  const cx = s.chew * 0.03 + 0.06 * sk * w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink;
  let path = null;
  if (open < 0.035) {
    ctx.lineWidth = 0.038;
    ctx.beginPath();
    if (s.wavy > 0.01) {
      // nervous squiggle
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        const x = lerp(-w, w, u);
        const y = lerp(yL, yR, u) + 4 * u * (1 - u) * 0.13 * sm + s.wavy * 0.026 * Math.sin(u * Math.PI * 3);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      ctx.moveTo(-w, yL);
      ctx.quadraticCurveTo(cx, (yL + yR) / 2 + 0.13 * sm + Math.abs(s.chew) * 0.02, w, yR);
    }
    ctx.stroke();
    if (sm > 0.35) {
      // tiny dimples give the smile a cheeky lift
      const k = clamp((sm - 0.35) * 1.6) * 0.045;
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(-w - k * 0.5, yL - k * 0.9);
      ctx.quadraticCurveTo(-w - k * 0.2, yL + k * 0.1, -w + k * 0.4, yL + k * 0.55);
      ctx.moveTo(w + k * 0.5, yR - k * 0.9);
      ctx.quadraticCurveTo(w + k * 0.2, yR + k * 0.1, w - k * 0.4, yR + k * 0.55);
      ctx.stroke();
    }
    if (s.tongue > 0.01) {
      const tk = s.tongue;
      ctx.fillStyle = C.tongue;
      ctx.beginPath();
      ctx.ellipse(w * 0.55, yR + 0.035 + tk * 0.03, 0.055 * tk, 0.06 * tk, 0.3, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 0.026;
      ctx.stroke();
      ctx.lineWidth = 0.038;
      ctx.beginPath();
      ctx.moveTo(-w, yL);
      ctx.quadraticCurveTo(cx, (yL + yR) / 2 + 0.13 * sm, w, yR);
      ctx.stroke();
    }
    return null;
  }
  const h = open * 0.56;
  const topC = (yL + yR) / 2 + 0.05 * sm - 0.015;
  path = new Path2D();
  path.moveTo(-w, yL);
  path.quadraticCurveTo(cx, topC, w, yR);
  path.bezierCurveTo(w * 1.02, yR + h * 1.05, -w * 1.02, yL + h * 1.05, -w, yL);
  path.closePath();
  ctx.fillStyle = C.mouth;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = C.tongue;
  ctx.beginPath();
  ctx.ellipse(0, (yL + yR) / 2 + h * 0.86, w * 0.62, h * 0.4, 0, 0, TAU);
  ctx.fill();
  if (inside) inside(ctx);
  ctx.restore();
  ctx.lineWidth = 0.038;
  ctx.stroke(path);
  return path;
}

// Draw the ball. opts.inside(ctx) is called clipped to the mouth interior
// (in feature space) so tokens can disappear *into* the mouth.
// opts.held(ctx) draws something held in the lips (feature space, unclipped).
export function drawBall(ctx, s, opts = {}) {
  const R = s.R;
  if (s.alpha <= 0) return;
  const N = 120;
  const M = deform(s);
  const piv = s.pivot;
  const reachLocal = s.reachDir - s.rot;
  const boilSeed = s.boil | 0;
  const bph = [hash(1, boilSeed) * TAU, hash(2, boilSeed) * TAU, hash(3, boilSeed) * TAU, hash(4, boilSeed) * TAU];
  // cheek bulge directions (body-local), shift with yaw
  const yaw = s.yaw;
  const cheekR = 0.38 - 0.0;
  const cheekL = Math.PI - 0.38;
  const wR = clamp(0.55 + Math.sin(0.62 + yaw) * 0.6, 0.25, 1.15);
  const wL = clamp(0.55 + Math.sin(0.62 - yaw) * 0.6, 0.25, 1.15);

  const pts = [];
  const wid = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    let r = 1;
    r += s.boilAmp * 0.0065 * (Math.sin(2 * a + bph[0]) + 0.7 * Math.sin(3 * a + bph[1]) + 0.5 * Math.sin(5 * a + bph[2]));
    const c = Math.cos(angDiff(a, reachLocal));
    if (c > 0 && s.reach !== 0) r += s.reach * Math.pow(c, 2.4);
    r += 0.14 * s.puffR * wR * gauss(angDiff(a, cheekR), 0.42);
    r += 0.14 * s.puffL * wL * gauss(angDiff(a, cheekL), 0.42);
    r += s.jaw * 0.1 * Math.pow(Math.max(0, Math.sin(a)), 2);
    let x = r * Math.cos(a);
    let y = r * Math.sin(a);
    // squashed balls flatten where they meet the ground
    const flat = clamp((s.sx - s.sy) * 1.6, 0, 0.9);
    if (flat > 0 && y > 0) {
      const n = 2 + flat * 1.8;
      const sy2 = Math.pow(Math.abs(Math.sin(a)), 2 / n) * r;
      const sx2 = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 2 / n) * r;
      x = lerp(x, sx2, 0.85);
      y = lerp(y, sy2, 0.85);
    }
    const dx = x;
    const dy = y - piv;
    const X = M.a * dx + M.c * dy;
    const Y = M.b * dx + M.d * dy + piv;
    pts.push([s.x + X * R, s.y + Y * R]);
    const w = R * 0.074 * (0.78 + 0.44 * (0.5 + 0.5 * Math.cos(a - Math.PI / 4))) * (1 + 0.07 * Math.sin(4 * a + bph[3]));
    wid.push(w);
  }
  const body = new Path2D();
  body.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < N; i++) body.lineTo(pts[i][0], pts[i][1]);
  body.closePath();

  ctx.save();
  ctx.globalAlpha *= s.alpha;

  // Contact shadow on the ground.
  if (s.ground != null) {
    const bottom = s.y + R * (piv + (1 - piv) * s.sy);
    const h = Math.max(0, s.ground - bottom);
    const k = 1 / (1 + h / 160);
    softEllipse(ctx, s.x + R * 0.1, s.ground + 2, R * 0.9 * (0.55 + 0.45 * k) * s.sx, R * 0.13 * (0.5 + 0.5 * k), `rgba(80,52,24,${0.3 * k * s.shadowK})`, 14);
    if (h < 30) {
      const k2 = 1 - h / 30;
      softEllipse(ctx, s.x + R * 0.05, s.ground + 1, R * 0.55 * s.sx, R * 0.06, `rgba(60,38,18,${0.32 * k2 * s.shadowK})`, 6);
    }
  }

  // Body with a soft cut-paper drop shadow.
  ctx.save();
  ctx.shadowColor = `rgba(92,62,32,${0.16 * s.shadowK})`;
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = C.goldShade;
  ctx.fill(body);
  ctx.restore();

  ctx.save();
  ctx.clip(body);
  // Main golden face of the paper, offset toward the light (top-left),
  // leaving a warm crescent of shade at bottom-right.
  ctx.save();
  ctx.translate(-R * 0.075, -R * 0.095);
  ctx.translate(s.x, s.y);
  ctx.scale(0.985, 0.985);
  ctx.translate(-s.x, -s.y);
  ctx.fillStyle = C.gold;
  ctx.fill(body);
  ctx.restore();

  // Local frame for face & highlight.
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(R, R);
  ctx.translate(0, piv);
  ctx.transform(M.a, M.b, M.c, M.d, 0, 0);
  ctx.translate(0, -piv);
  // Highlight sweep (paper cut) stays on the body, not the face.
  ctx.save();
  ctx.globalAlpha *= 0.9;
  const hp = [];
  for (let i = 0; i <= 14; i++) {
    const a = lerp(3.62, 4.42, i / 14);
    hp.push([Math.cos(a) * 0.74, Math.sin(a) * 0.74]);
  }
  brush(ctx, hp, 0.085, C.goldHi, { taper: 0.4, minW: 0.25, seed: 3, widthJitter: 0 });
  ctx.beginPath();
  ctx.arc(Math.cos(4.62) * 0.74, Math.sin(4.62) * 0.74, 0.03, 0, TAU);
  ctx.fill();
  ctx.restore();

  const rd = s.reach * 0.42;
  ctx.translate(Math.cos(reachLocal) * rd + s.faceDX, Math.sin(reachLocal) * rd + s.faceDY);

  const feat = (lon, lat, draw) => {
    const p = proj(lon, lat, s.yaw, s.pitch);
    if (p.z < 0.08) return;
    ctx.save();
    ctx.transform(p.a, p.b, p.c, p.d, p.x, p.y);
    draw(p.z);
    ctx.restore();
  };

  // Cheeks / blush
  const blushA = clamp(s.blush);
  for (const side of [-1, 1]) {
    const puff = side < 0 ? s.puffL : s.puffR;
    feat(side * 0.6, 0.16, () => {
      ctx.fillStyle = C.terra;
      ctx.globalAlpha *= blushA * (0.5 + 0.3 * clamp(puff));
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.12 * (1 + 0.35 * puff), 0.072 * (1 + 0.55 * puff), 0, 0, TAU);
      ctx.fill();
    });
  }
  // Eyes
  const eyeLon = 0.34 * (1 - s.cross * 0.18);
  for (const side of [-1, 1]) {
    feat(side * eyeLon, -0.13, () => eyeShape(ctx, s, side));
  }
  // Mouth (and anything going into it)
  let mouthWorld = null;
  const mouthLat = 0.25 + s.mouthOpen * 0.02;
  feat(0, mouthLat, () => {
    const path = mouthShape(ctx, s, opts.inside);
    if (path) {
      mouthWorld = { path, m: ctx.getTransform() };
    }
    if (opts.held) opts.held(ctx);
  });
  ctx.restore(); // local frame
  ctx.restore(); // clip

  // Ink outline as a variable-width ring.
  const outer = [];
  const inner = [];
  for (let i = 0; i < N; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % N];
    const o = pts[(i - 1 + N) % N];
    let tx = q[0] - o[0];
    let ty = q[1] - o[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const nx = ty;
    const ny = -tx;
    const w = wid[i] / 2;
    outer.push([p[0] + nx * w, p[1] + ny * w]);
    inner.push([p[0] - nx * w, p[1] - ny * w]);
  }
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(outer[0][0], outer[0][1]);
  for (let i = 1; i < N; i++) ctx.lineTo(outer[i][0], outer[i][1]);
  ctx.closePath();
  ctx.moveTo(inner[0][0], inner[0][1]);
  for (let i = 1; i < N; i++) ctx.lineTo(inner[i][0], inner[i][1]);
  ctx.closePath();
  ctx.fill('evenodd');

  // Sweat drop sliding down the left side of the head.
  if (s.sweat > 0.01) {
    const u = s.sweat;
    const lx = -0.8 - 0.06 * u;
    const ly = -0.62 + 0.42 * u;
    const X = s.x + (M.a * lx + M.c * (ly - piv)) * R;
    const Y = s.y + (M.b * lx + M.d * (ly - piv) + piv) * R;
    const sc = R * 0.15 * clamp(u * 4) * (1 - clamp((u - 0.85) * 6.6));
    if (sc > 0.5) {
      ctx.save();
      ctx.translate(X, Y);
      ctx.rotate(-0.25);
      ctx.beginPath();
      ctx.moveTo(0, -sc * 1.1);
      ctx.bezierCurveTo(sc * 0.55, -sc * 0.2, sc * 0.62, sc * 0.55, 0, sc * 0.62);
      ctx.bezierCurveTo(-sc * 0.62, sc * 0.55, -sc * 0.55, -sc * 0.2, 0, -sc * 1.1);
      ctx.closePath();
      ctx.fillStyle = '#FFFDF6';
      ctx.fill();
      ctx.lineWidth = R * 0.03;
      ctx.strokeStyle = C.ink;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
  return { mouth: mouthWorld, pts };
}

// World position of the mouth centre (for aiming tokens into it).
export function mouthPoint(s) {
  const M = deform(s);
  const piv = s.pivot;
  const reachLocal = s.reachDir - s.rot;
  const rd = s.reach * 0.42;
  const p = proj(0, 0.25 + s.mouthOpen * 0.02, s.yaw, s.pitch);
  const lx = p.x + Math.cos(reachLocal) * rd + s.faceDX;
  const ly = p.y + p.d * s.mouthOpen * 0.22 + Math.sin(reachLocal) * rd + s.faceDY;
  return [s.x + (M.a * lx + M.c * (ly - piv)) * s.R, s.y + (M.b * lx + M.d * (ly - piv) + piv) * s.R];
}

// World position of an eye (side -1 = left, +1 = right).
export function eyePoint(s, side) {
  const M = deform(s);
  const piv = s.pivot;
  const reachLocal = s.reachDir - s.rot;
  const rd = s.reach * 0.42;
  const p = proj(side * 0.34 * (1 - s.cross * 0.18), -0.13, s.yaw, s.pitch);
  const lx = p.x + Math.cos(reachLocal) * rd + s.faceDX;
  const ly = p.y + Math.sin(reachLocal) * rd + s.faceDY;
  return [s.x + (M.a * lx + M.c * (ly - piv)) * s.R, s.y + (M.b * lx + M.d * (ly - piv) + piv) * s.R];
}

// World position of a point above the head (for sparks, sweat etc.).
export function headTop(s) {
  const M = deform(s);
  const piv = s.pivot;
  return [s.x + M.c * (-1 - piv) * s.R, s.y + (M.d * (-1 - piv) + piv) * s.R];
}
