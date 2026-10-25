import * as THREE from 'three';
import { clamp, lerp, hash, noise1, shade } from './util.js';

// Flat 2D cartoon figures (thick dark outline, dot eyes, expressive brows) drawn
// part by part on a canvas every frame, shown on a camera-facing card in the
// 3D world. Units: figure height ~100, feet at y=0, canonical pose faces +x.

export const OUTLINE = '#2b1d14';
const UW = 96, UH = 132, FOOT = 6; // canvas extent in units, feet margin
const HIP = 46, SH = 28, NECK = 31.5, L1 = 22, L2 = 21.5, UA = 16.5, FA = 15.5;

const P = (x, y) => ({ x, y });
const add = (a, b) => P(a.x + b.x, a.y + b.y);
const sub = (a, b) => P(a.x - b.x, a.y - b.y);
const mul = (a, k) => P(a.x * k, a.y * k);
const rot = (v, a) => P(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a));
const dirv = (a) => P(Math.sin(a), -Math.cos(a)); // angle measured from straight down, + = forward
const len = (v) => Math.hypot(v.x, v.y);

// ---------- pose helpers -------------------------------------------------
export function basePose() {
  return {
    dir: 1, lean: 0, bob: 0, ground: true, y: 0, breathe: 0,
    head: { tilt: 0 }, look: [0, 0],
    armF: { sh: 0.12, el: 0.18 }, armB: { sh: -0.08, el: 0.22 },
    legF: { hip: 0.04, knee: 0.04 }, legB: { hip: -0.04, knee: 0.04 },
    face: { brow: 'neutral', mouth: null, blink: 0 },
    phoneUp: 0, palms: 0,
  };
}

const BROWS = { // [front y, back y, arch] in head radii
  neutral: [0.40, 0.37, 0.02], worried: [0.55, 0.36, 0.0], sad: [0.52, 0.32, -0.02], fear: [0.62, 0.46, 0.0],
  angry: [0.27, 0.42, 0.0], doubt: [0.30, 0.44, 0.03], awe: [0.56, 0.52, 0.07], soft: [0.44, 0.39, 0.05], joy: [0.50, 0.47, 0.08],
};

// blend two poses (numbers lerp; strings switch at 0.5)
export function blendPose(a, b, u) {
  if (u <= 0) return a; if (u >= 1) return b;
  const out = Array.isArray(a) ? [] : {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[k], vb = b[k];
    if (va === undefined) out[k] = vb;
    else if (vb === undefined) out[k] = va;
    else if (typeof va === 'number' && typeof vb === 'number') out[k] = lerp(va, vb, u);
    else if (va && typeof va === 'object' && vb && typeof vb === 'object') out[k] = blendPose(va, vb, u);
    else out[k] = u < 0.5 ? va : vb;
  }
  return out;
}

// two-bone IK: returns {sh, el} so the hand lands on target (relative to shoulder)
export function ik(t, A = UA, B = FA, bend = 1) {
  let d = Math.max(0.01, len(t));
  d = clamp(d, Math.abs(A - B) + 0.01, A + B - 0.01);
  const phi = Math.atan2(t.x, -t.y);
  const alpha = Math.acos(clamp((A * A + d * d - B * B) / (2 * A * d), -1, 1));
  const sh = phi - bend * alpha;
  const elbow = mul(dirv(sh), A);
  const f = sub(t, elbow);
  const fa = Math.atan2(f.x, -f.y);
  return { sh, el: fa - sh };
}

// ---------- drawing -------------------------------------------------------
function rr(ctx, x, y, w, h, r) { // rounded rect in y-up space (x,y = bottom-left)
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
}

class Pen {
  constructor(ctx, ow) { this.ctx = ctx; this.ow = ow; }
  // union shapes: stroke all paths thick in outline colour, then fill all
  shapes(list) {
    const c = this.ctx;
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const s of list) { c.beginPath(); s.path(c); c.lineWidth = this.ow * 2; c.strokeStyle = OUTLINE; c.stroke(); }
    for (const s of list) { c.beginPath(); s.path(c); c.fillStyle = s.fill; c.fill(s.rule || 'nonzero'); }
  }
  // thick polyline limb; segs = [{pts:[...], w, col}] drawn as one outlined sausage
  limb(segs) {
    const c = this.ctx; c.lineJoin = 'round'; c.lineCap = 'round';
    for (const s of segs) { c.beginPath(); s.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.lineWidth = s.w + this.ow * 2; c.strokeStyle = OUTLINE; c.stroke(); }
    for (const s of segs) { c.beginPath(); s.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.lineWidth = s.w; c.strokeStyle = s.col; c.stroke(); }
  }
  line(a, b, w, col) { const c = this.ctx; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineWidth = w; c.strokeStyle = col; c.lineCap = 'round'; c.stroke(); }
}

function legPoint(hip, leg, dist) {
  const k = add(hip, mul(dirv(leg.hip), L1));
  if (dist <= L1) return add(hip, mul(dirv(leg.hip), dist));
  return add(k, mul(dirv(leg.hip - leg.knee), Math.min(dist - L1, L2)));
}

// Solve the skeleton for a pose. Returns joint positions (before ground snap).
function skeleton(spec, pose) {
  const hr = 10.5 * (spec.headScale || 1);
  const hip = P(0, HIP + (pose.bob || 0));
  const up = P(Math.sin(pose.lean), Math.cos(pose.lean));
  const br = 1 + 0.012 * Math.sin(pose.breathe || 0);
  const sh = add(hip, mul(up, SH * br));
  const neck = add(hip, mul(up, NECK * br));
  const headA = -pose.lean + pose.head.tilt;
  const headC = add(neck, rot(P(0.8, hr * 0.9), headA * 0.6));
  const shF = add(sh, rot(P(1.6, -0.5), -pose.lean)), shB = add(sh, rot(P(-1.8, 0), -pose.lean));
  const arm = (base, ang) => {
    const el = add(base, mul(dirv(ang.sh), UA));
    const hand = add(el, mul(dirv(ang.sh + ang.el), FA));
    const wrist = add(el, mul(dirv(ang.sh + ang.el), FA - 3.2));
    return { sh: base, el, hand, wrist, ang: ang.sh + ang.el };
  };
  const leg = (l, side) => {
    const h = add(hip, P(side * 1.2, 0));
    const knee = add(h, mul(dirv(l.hip), L1));
    const sa = l.hip - l.knee;
    const ankle = add(knee, mul(dirv(sa), L2));
    const sd = dirv(sa);
    const perp = P(-sd.y, sd.x);
    const w = clamp(1 - Math.abs(sa) / 1.25);
    let fd = P(lerp(perp.x, 1, w * 0.6), lerp(perp.y, 0, w * 0.6));
    fd = mul(fd, 1 / len(fd));
    return { hip: h, knee, ankle, heel: add(ankle, mul(fd, -1.8)), toe: add(ankle, mul(fd, 7.2)), l };
  };
  return {
    hr, hip, sh, neck, headC, headA, up,
    aF: arm(shF, pose.armF), aB: arm(shB, pose.armB),
    lF: leg(pose.legF, 1), lB: leg(pose.legB, -1),
  };
}

function snapOffset(sk, pose) {
  if (!pose.ground) return pose.y || 0;
  let m = Infinity;
  for (const l of [sk.lF, sk.lB]) m = Math.min(m, l.toe.y - 2.2, l.heel.y - 2.2, l.knee.y - 3.5, l.ankle.y - 3.2);
  return -m + (pose.y || 0);
}

// map a unit-space point of a drawn figure to [0..1] card coords (u right, v up)
export function unitToCard(p) { return P((p.x + UW / 2) / UW, (p.y + FOOT) / UH); }

export function drawFigure(ctx, spec, pose, s, opts = {}) {
  if (pose.armF.to || pose.armB.to) pose = solveArms(spec, pose);
  const dir = pose.dir || 1;
  const sk = skeleton(spec, pose);
  const dy = snapOffset(sk, pose);
  const ow = Math.max(1.05, (opts.minOutlinePx || 2.0) / s) * (spec.outline || 1);
  const pen = new Pen(ctx, ow);
  ctx.save();
  ctx.translate(ctx.canvas.width / 2, ctx.canvas.height - FOOT * s);
  ctx.scale(s * dir, -s);
  ctx.translate(0, dy);
  const skin = spec.skin, skinB = shade(skin, 0.86);
  const top = spec.top, tcol = top.color, tcolB = shade(tcol, 0.84);
  const pants = spec.pants || null;
  const shoes = spec.shoes || shade(skin, 0.6);
  const longSleeve = top.sleeves === 'long';
  const noSleeve = top.sleeves === 'none';
  const AW = 5.6 * (spec.limb || 1), LW = 6.6 * (spec.limb || 1);
  const hr = sk.hr;

  const drawArm = (a, back) => {
    const sc = back ? tcolB : tcol, sk2 = back ? skinB : skin;
    if (noSleeve) pen.limb([{ pts: [a.sh, a.el, a.hand], w: AW, col: sk2 }]);
    else if (longSleeve) pen.limb([{ pts: [a.sh, a.el, a.wrist], w: AW + 0.6, col: sc }, { pts: [a.wrist, a.hand], w: AW - 0.2, col: sk2 }]);
    else {
      const mid = add(a.sh, mul(sub(a.el, a.sh), 0.72));
      pen.limb([{ pts: [a.sh, mid], w: AW + 1.2, col: sc }, { pts: [mid, a.el, a.hand], w: AW, col: sk2 }]);
    }
    if (!back && pose.palms > 0 && spec.scars) { // open palm with nail scar
      const c = ctx; c.beginPath(); c.arc(a.hand.x, a.hand.y, 2.7, 0, Math.PI * 2); c.fillStyle = shade(skin, 1.12); c.fill();
      c.beginPath(); c.arc(a.hand.x + 0.2, a.hand.y + 0.1, 1.1, 0, Math.PI * 2); c.fillStyle = `rgba(118,30,26,${pose.palms})`; c.fill();
    }
  };
  const drawLeg = (l, back) => {
    const pc = pants ? (back ? shade(pants, 0.84) : pants) : (back ? skinB : skin);
    const segs = [{ pts: [l.hip, l.knee, l.ankle], w: LW, col: pc }];
    if (pants && spec.shorts) segs.push({ pts: [l.knee, l.ankle], w: LW - 0.6, col: back ? skinB : skin });
    pen.limb(segs);
    pen.limb([{ pts: [l.heel, l.toe], w: 4.6, col: back ? shade(shoes, 0.85) : shoes }]);
  };

  // --- back layer
  const hairBack = () => {
    const H = spec.hair || {};
    if (!['long', 'shoulder', 'ponytail'].includes(H.style)) return;
    ctx.save(); ctx.translate(sk.headC.x, sk.headC.y); ctx.rotate(sk.headA);
    const L = H.style === 'long' ? 2.5 : H.style === 'shoulder' ? 1.75 : 1.9;
    const shapes = [{ fill: H.color, path: (c) => { if (H.style === 'ponytail') { c.moveTo(-0.7 * hr, 0.55 * hr); c.quadraticCurveTo(-1.55 * hr, 0.2 * hr, -1.25 * hr, -L * hr); c.quadraticCurveTo(-0.95 * hr, -0.9 * hr, -0.55 * hr, 0.1 * hr); c.closePath(); } else rr(c, -1.08 * hr, -L * hr, 1.15 * hr, (L + 0.65) * hr, 0.5 * hr); } }];
    pen.shapes(shapes); ctx.restore();
  };
  if (spec.props?.backpack) {
    const bp = spec.props.backpack;
    ctx.save(); ctx.translate(sk.hip.x, sk.hip.y); ctx.rotate(-pose.lean);
    pen.shapes([{ fill: bp, path: (c) => rr(c, -15.5, 8, 9.5, 20, 3.5) }]);
    ctx.restore();
  }
  drawArm(sk.aB, true);
  hairBack();
  drawLeg(sk.lB, true);
  drawLeg(sk.lF, false);

  // --- torso / garment
  const isRobe = ['robe', 'tunic', 'dress', 'coat'].includes(top.type);
  const torsoPath = (c) => {
    const q = (x, y) => add(sk.hip, rot(P(x, y), -pose.lean));
    const bw = spec.build || 1;
    const pts = [q(-7.6 * bw, top.type === 'suit' || top.type === 'hoodie' ? -3 : 1), q(-8.2 * bw, 24), q(-5.5 * bw, SH + 0.6), q(5.2 * bw, SH + 0.6), q(8.6 * bw, 24), q(8.6 * bw, top.type === 'suit' || top.type === 'hoodie' ? -3 : 1)];
    c.moveTo(pts[0].x, pts[0].y);
    c.lineTo(pts[1].x, pts[1].y);
    c.quadraticCurveTo(q(-8.4 * bw, SH + 0.6).x, q(-8.4 * bw, SH + 0.6).y, pts[2].x, pts[2].y);
    c.lineTo(pts[3].x, pts[3].y);
    c.quadraticCurveTo(q(8.8 * bw, SH + 0.6).x, q(8.8 * bw, SH + 0.6).y, pts[4].x, pts[4].y);
    c.lineTo(pts[5].x, pts[5].y);
    c.closePath();
  };
  const shapes = [{ fill: tcol, path: torsoPath }];
  if (isRobe) {
    const hl = top.hem ?? 36;
    const fl = top.flare ?? 3.5;
    const pf = legPoint(sk.lF.hip, pose.legF, hl), pb = legPoint(sk.lB.hip, pose.legB, hl);
    const front = pf.x > pb.x ? pf : pb, back = pf.x > pb.x ? pb : pf;
    const bw = spec.build || 1;
    shapes.push({ fill: tcol, path: (c) => {
      c.moveTo(sk.hip.x - 7.8 * bw, sk.hip.y + 4); c.lineTo(back.x - fl - 3.5 * bw, back.y);
      c.quadraticCurveTo((back.x + front.x) / 2, Math.min(back.y, front.y) - 1.2, front.x + fl + 3.5 * bw, front.y);
      c.lineTo(sk.hip.x + 8.6 * bw, sk.hip.y + 4); c.closePath();
    } });
  }
  if (top.type === 'hoodie') {
    ctx.save(); ctx.translate(sk.neck.x, sk.neck.y); ctx.rotate(-pose.lean);
    pen.shapes([{ fill: shade(tcol, 0.9), path: (c) => c.ellipse(-5.5, 1.5, 6.5, 5.2, 0.3, 0, Math.PI * 2) }]);
    ctx.restore();
  }
  pen.shapes(shapes);
  // garment details
  ctx.save(); ctx.translate(sk.hip.x, sk.hip.y); ctx.rotate(-pose.lean);
  const det = (fn) => { ctx.beginPath(); fn(ctx); };
  ctx.lineCap = 'round';
  if (top.sash) { // waist sash
    det((c) => rr(c, -8.2, 2.2, 16.8, 3.2, 1.2)); ctx.fillStyle = top.sash; ctx.fill();
  }
  if (top.sashDiag) { // shoulder-to-hip sash
    det((c) => { c.moveTo(4.5, SH + 0.2); c.lineTo(8.6, SH - 3); c.lineTo(-4, 1.5); c.lineTo(-7.6, 4.5); c.closePath(); }); ctx.fillStyle = top.sashDiag; ctx.fill();
  }
  if (top.type === 'suit') {
    det((c) => { c.moveTo(2.6, SH + 0.5); c.lineTo(4.4, 13); c.lineTo(6.2, SH + 0.5); c.closePath(); }); ctx.fillStyle = '#efe9df'; ctx.fill();
    det((c) => { c.moveTo(4.1, SH - 0.5); c.lineTo(3.4, 16); c.lineTo(4.4, 13.5); c.lineTo(5.2, 16); c.lineTo(4.6, SH - 0.5); c.closePath(); }); ctx.fillStyle = top.color2 || '#8e2b2b'; ctx.fill();
    pen.line(P(2.2, SH), P(4.4, 11), ow * 0.8, OUTLINE);
    pen.line(P(-1, -3), P(4.4, 11), ow * 0.6, shade(tcol, 0.7));
  }
  if (top.type === 'hoodie') {
    pen.line(P(1.5, 6), P(8.4, 6), ow * 0.7, shade(tcol, 0.72));
    pen.line(P(5.5, SH - 1), P(5.8, SH - 7), ow * 0.6, '#e8e2d6');
  }
  if (top.type === 'shirt' || top.type === 'tee' || top.type === 'sweater') {
    det((c) => { c.moveTo(2.5, SH + 0.4); c.lineTo(5.6, SH - 3.2); c.lineTo(7.2, SH + 0.4); }); ctx.lineWidth = ow * 0.7; ctx.strokeStyle = OUTLINE; ctx.stroke();
  }
  if (top.type === 'coat') pen.line(P(6.6, SH - 1), P(6.2, -24), ow * 0.6, shade(tcol, 0.7));
  ctx.restore();

  // --- head
  ctx.save(); ctx.translate(sk.headC.x, sk.headC.y); ctx.rotate(sk.headA);
  const H = spec.hair || {};
  const r = hr;
  const headShapes = [
    { fill: skin, path: (c) => c.ellipse(0, 0, r, r * 1.02, 0, 0, Math.PI * 2) },
    { fill: skin, path: (c) => c.arc(r * 0.97, -r * 0.1, r * 0.2, 0, Math.PI * 2) }, // nose
    { fill: skin, path: (c) => rr(c, -r * 0.42, -r * 1.25, r * 0.7, r * 0.6, r * 0.2) }, // neck
  ];
  if (H.style === 'scarf' || H.style === 'cover') {
    // fabric behind the face, down to the shoulders
    pen.shapes([{ fill: H.color, path: (c) => {
      c.moveTo(r * 0.55, r * 0.78); c.arc(-r * 0.05, r * 0.05, r * 1.18, 0.9, 3.5);
      c.lineTo(-r * 1.35, -r * 2.05); c.lineTo(r * (H.style === 'cover' ? -0.2 : 0.55), -r * 1.95); c.lineTo(r * 0.55, -r * 0.9); c.closePath();
    } }]);
  }
  pen.shapes(headShapes);
  if (H.style === 'afro' || H.style === 'curly') {
    const R = H.style === 'afro' ? 1.38 : 1.16;
    pen.shapes([{ fill: H.color, rule: 'evenodd', path: (c) => {
      c.arc(-r * 0.22, r * 0.28, r * R, 0, Math.PI * 2);
      c.moveTo(r * 1.1, -r * 0.1); c.ellipse(r * 0.36, -r * 0.2, r * 0.74, r * 0.8, 0, 0, Math.PI * 2);
    } }]);
  } else if (H.style === 'scarf' || H.style === 'cover') {
    pen.shapes([{ fill: H.color, rule: 'evenodd', path: (c) => {
      c.ellipse(-r * 0.05, r * 0.05, r * 1.18, r * 1.2, 0, 0, Math.PI * 2);
      c.moveTo(r * 1.05, -r * 0.1); c.ellipse(r * 0.4, -r * 0.12, r * 0.65, r * 0.8, 0, 0, Math.PI * 2);
    } }]);
    if (H.color2) { ctx.beginPath(); ctx.arc(-r * 0.05, r * 0.05, r * 1.02, 0.55, 2.6); ctx.lineWidth = r * 0.16; ctx.strokeStyle = H.color2; ctx.stroke(); }
  } else if (H.style && H.style !== 'bald' && H.style !== 'none') {
    pen.shapes([{ fill: H.color, path: (c) => {
      if (H.style === 'balding') { c.moveTo(-r * 0.2, -r * 0.05); c.arc(0, 0, r * 1.04, 2.0, 3.75); c.lineTo(-r * 0.5, -r * 0.3); c.closePath(); return; }
      c.moveTo(r * 0.72, r * 0.8);
      c.arc(-r * 0.04, r * 0.06, r * 1.08, 0.82, 3.62);
      c.lineTo(-r * 0.5, -r * 0.22);
      c.quadraticCurveTo(-r * 0.12, r * 0.55, r * 0.74, r * 0.62);
      c.closePath();
    } }]);
    if (H.style === 'bun') pen.shapes([{ fill: H.color, path: (c) => c.arc(-r * 0.88, r * 0.78, r * 0.42, 0, Math.PI * 2) }]);
  }
  // beard
  if (spec.beard) {
    const B = spec.beard;
    const L = B.style === 'long' ? 2.15 : B.style === 'short' ? 1.12 : 1.3;
    if (B.style === 'mustache') {
      pen.shapes([{ fill: B.color, path: (c) => { c.ellipse(r * 0.72, -r * 0.4, r * 0.3, r * 0.12, -0.1, 0, Math.PI * 2); } }]);
    } else {
      pen.shapes([{ fill: B.color, path: (c) => {
        c.moveTo(-r * 0.42, r * 0.12);
        c.quadraticCurveTo(-r * 0.55, -r * L * 0.85, r * (B.style === 'long' ? 0.15 : 0.3), -r * L);
        c.quadraticCurveTo(r * 0.92, -r * (L * 0.8), r * 0.96, -r * 0.3);
        c.lineTo(r * 0.5, -r * 0.36);
        c.quadraticCurveTo(r * 0.12, -r * 0.5, -r * 0.08, -r * 0.02);
        c.closePath();
      } }]);
    }
  }
  // face: eye, brow, mouth
  const f = pose.face || {};
  const ex = r * 0.5, ey = r * 0.1;
  const detail = opts.detail ?? true;
  const blink = clamp(f.blink || 0);
  const look = pose.look || [0, 0];
  ctx.lineCap = 'round';
  if (blink > 0.5) {
    ctx.beginPath(); ctx.moveTo(ex - r * 0.17, ey - r * 0.02); ctx.quadraticCurveTo(ex, ey - r * 0.1, ex + r * 0.17, ey - r * 0.02);
    ctx.lineWidth = Math.max(ow * 0.8, r * 0.07); ctx.strokeStyle = OUTLINE; ctx.stroke();
  } else if (detail) {
    ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.17, r * 0.2 * (1 - blink * 0.8), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f7f1e6'; ctx.fill(); ctx.lineWidth = Math.max(ow * 0.55, r * 0.035); ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.beginPath(); ctx.arc(ex + r * (0.05 + look[0] * 0.06), ey + r * (look[1] * 0.08 - 0.01), r * 0.1, 0, Math.PI * 2); ctx.fillStyle = '#1c120c'; ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(ex + look[0] * r * 0.05, ey + look[1] * r * 0.06, r * 0.12, 0, Math.PI * 2); ctx.fillStyle = '#1c120c'; ctx.fill();
  }
  if (spec.props?.glasses) {
    ctx.beginPath(); ctx.arc(ex, ey, r * 0.27, 0, Math.PI * 2); ctx.moveTo(ex + r * 0.27, ey); ctx.lineTo(r * 0.93, ey + r * 0.02);
    ctx.lineWidth = Math.max(ow * 0.55, r * 0.05); ctx.strokeStyle = '#2b2622'; ctx.stroke();
  }
  const bk = BROWS[f.brow || 'neutral'] || BROWS.neutral;
  const bcol = spec.browCol || (H.color && !['scarf', 'cover'].includes(H.style) ? shade(H.color, 0.8) : '#2a1a10');
  ctx.beginPath(); ctx.moveTo(ex - r * 0.22, ey + r * bk[1]); ctx.quadraticCurveTo(ex, ey + r * ((bk[0] + bk[1]) / 2 + bk[2]), ex + r * 0.22, ey + r * bk[0]);
  ctx.lineWidth = Math.max(ow * 0.95, r * 0.1); ctx.strokeStyle = bcol; ctx.stroke();
  if (f.mouth) {
    const mx = r * 0.68, my = -r * 0.5;
    ctx.beginPath();
    if (f.mouth === 'o') { ctx.ellipse(mx, my, r * 0.08, r * 0.11, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1c14'; ctx.fill(); }
    else if (f.mouth === 'open') { ctx.ellipse(mx, my - r * 0.02, r * 0.12, r * 0.16, 0, 0, Math.PI * 2); ctx.fillStyle = '#3a1c14'; ctx.fill(); }
    else { const k = f.mouth === 'smile' ? 1 : -1; ctx.moveTo(mx - r * 0.16, my + k * r * 0.03); ctx.quadraticCurveTo(mx, my - k * r * 0.09, mx + r * 0.14, my + k * r * 0.05); ctx.lineWidth = Math.max(ow * 0.7, r * 0.06); ctx.strokeStyle = '#3a1c14'; ctx.stroke(); }
  }
  ctx.restore();

  // --- front arm + props
  if (spec.props?.cane) {
    const h = sk.aF.hand; pen.limb([{ pts: [add(h, P(0.3, 1.5)), P(h.x + 2.5, -dy + 0.5)], w: 2.0, col: '#6e4a2c' }]);
  }
  if (spec.props?.staff) {
    const h = sk.aF.hand; const topP = add(h, P(1.2, 30));
    pen.limb([{ pts: [P(h.x + 0.6, -dy + 0.5), topP], w: 2.4, col: '#7a5634' }]);
    ctx.beginPath(); ctx.arc(topP.x - 2.6, topP.y, 2.6, 0, Math.PI); ctx.lineWidth = 2.4 + ow * 2; ctx.strokeStyle = OUTLINE; ctx.stroke(); ctx.lineWidth = 2.4; ctx.strokeStyle = '#7a5634'; ctx.stroke();
  }
  drawArm(sk.aF, false);
  if (spec.props?.phone && pose.phoneUp > 0.02) {
    const h = sk.aF.hand;
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(sk.aF.ang + Math.PI);
    const g = ctx;
    g.beginPath(); rr(g, -1.9, -1.5, 3.8, 7.2, 0.9); g.fillStyle = '#1d2026'; g.fill(); g.lineWidth = ow * 0.8; g.strokeStyle = OUTLINE; g.stroke();
    g.beginPath(); rr(g, -1.3, -0.8, 2.6, 5.9, 0.5); g.fillStyle = `rgba(220,236,255,${0.85 * pose.phoneUp})`; g.shadowColor = 'rgba(200,225,255,0.9)'; g.shadowBlur = 6 * s; g.fill(); g.shadowBlur = 0;
    ctx.restore();
    // re-draw the fingers over the phone
    ctx.beginPath(); ctx.arc(h.x, h.y, 2.4, 0, Math.PI * 2); ctx.fillStyle = skin; ctx.fill();
  }
  ctx.restore();
  return { sk, dy };
}

// ---------- 3D wrapper ----------------------------------------------------
let blobTex = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

export class Character {
  constructor(spec) {
    this.spec = spec;
    this.res = spec.res || 360;
    this.canvas = document.createElement('canvas');
    this.canvas.height = this.res;
    this.canvas.width = Math.round((this.res * UW) / UH);
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, alphaTest: 0.03, depthWrite: true, fog: true, side: THREE.DoubleSide });
    const hw = 1.7 * (spec.h || 1);
    this.worldPerUnit = hw / 100;
    const geo = new THREE.PlaneGeometry((UW / 100) * hw, (UH / 100) * hw);
    geo.translate(0, ((UH / 2 - FOOT) / 100) * hw, 0);
    this.card = new THREE.Mesh(geo, this.mat);
    this.card.renderOrder = 2;
    this.group = new THREE.Group();
    this.group.add(this.card);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: 0.32, depthWrite: false, color: 0x1a120a, fog: true }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.012;
    this.shadow.renderOrder = 1;
    this.group.add(this.shadow);
    this.last = null;
  }
  set visible(v) { this.group.visible = v; }
  get visible() { return this.group.visible; }

  // texture height that gives ~1.15 texels per screen pixel for this camera (deterministic per frame)
  pickRes(camera) {
    const p0 = this.group.position.clone(), p1 = p0.clone(); p1.y += 1.7 * (this.spec.h || 1);
    const a = p0.project(camera), b = p1.project(camera);
    const px = Math.abs(a.y - b.y) * 0.5 * 1920;
    const want = px * (UH / 100) * 1.15;
    const steps = [96, 128, 160, 192, 256, 320, 384, 448, 512, 640, 768, 896, 1050, 1200, 1400];
    let r = steps.find((v) => v >= want) || steps[steps.length - 1];
    return Math.min(r, this.spec.res || 1050);
  }
  setRes(r) {
    if (r === this.res) return;
    this.res = r;
    this.canvas = document.createElement('canvas');
    this.canvas.height = r; this.canvas.width = Math.round((r * UW) / UH);
    this.ctx = this.canvas.getContext('2d');
    this.off = null;
    this.tex.dispose();
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.mat.map = this.tex; this.mat.needsUpdate = true;
  }

  update(pose, camera, opts = {}) {
    this.setRes(this.pickRes(camera));
    const c = this.ctx, s = this.res / UH;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.spec.glow && (opts.glow ?? 1) > 0) {
      // soft rim glow: draw to an offscreen layer, then composite with blur
      if (!this.off) { this.off = document.createElement('canvas'); this.off.width = this.canvas.width; this.off.height = this.canvas.height; }
      const o = this.off.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, this.off.width, this.off.height);
      this.last = drawFigure(o, this.spec, pose, s, { detail: this.res >= 320 });
      c.save(); c.shadowColor = this.spec.glow; c.shadowBlur = 16 * s * (opts.glow ?? 1); c.drawImage(this.off, 0, 0); c.drawImage(this.off, 0, 0); c.restore();
    } else {
      this.last = drawFigure(c, this.spec, pose, s, { detail: this.res >= 320 });
    }
    this.tex.needsUpdate = true;
    this.pose = pose;
    // face the camera
    this.group.updateMatrixWorld();
    const pq = new THREE.Quaternion();
    this.group.getWorldQuaternion(pq);
    this.card.quaternion.copy(pq.invert().multiply(camera.quaternion));
    const kneel = pose.kneelW || 0;
    const sw = this.worldPerUnit * (34 + kneel * 18), sd = this.worldPerUnit * (15 + kneel * 6);
    this.shadow.scale.set(sw, sd, 1);
    this.shadow.material.opacity = (opts.shadow ?? 0.32) * (this.spec.h < 0.8 ? 0.9 : 1);
    if (opts.tint) this.mat.color.setRGB(...opts.tint); else this.mat.color.setRGB(1, 1, 1);
  }

  // world position of a skeleton point ('handF','handB','head')
  worldPoint(name) {
    if (!this.last) return this.group.position.clone();
    const { sk, dy } = this.last;
    const p = name === 'handF' ? sk.aF.hand : name === 'handB' ? sk.aB.hand : name === 'wristF' ? sk.aF.wrist : name === 'wristB' ? sk.aB.wrist : sk.headC;
    const dir = this.pose?.dir || 1;
    const u = (p.x * dir + UW / 2) / UW, v = (p.y + dy + FOOT) / UH;
    const g = this.card.geometry.parameters;
    const local = new THREE.Vector3((u - 0.5) * g.width, v * g.height, 0.001);
    this.card.updateMatrixWorld();
    return local.applyMatrix4(this.card.matrixWorld);
  }
}

// ---------- pose library --------------------------------------------------
// every pose is a pure function of time + per-character seed
export function blinkAt(t, seed) {
  const period = 3 + hash(seed) * 2;
  const ph = (t + hash(seed + 3) * period) % period;
  return ph < 0.13 ? Math.sin((ph / 0.13) * Math.PI) : 0;
}

export function idle(t, seed, o = {}) {
  const p = basePose();
  p.dir = o.dir ?? 1;
  p.breathe = t * (2 * Math.PI / (3.2 + hash(seed) * 1.2)) + seed;
  const sway = (noise1(t * 0.35, seed) - 0.5);
  p.lean = (o.lean ?? 0) + sway * 0.04;
  p.head.tilt = (o.tilt ?? 0) + (noise1(t * 0.25, seed + 9) - 0.5) * 0.08;
  p.armF = { sh: 0.1 + sway * 0.08, el: 0.18 }; p.armB = { sh: -0.1 - sway * 0.06, el: 0.24 };
  p.face = { brow: o.brow || 'neutral', mouth: o.mouth || null, blink: blinkAt(t, seed) };
  p.look = o.look || [0, 0];
  return p;
}

export function lookUp(t, seed, o = {}) {
  const p = idle(t, seed, { ...o, tilt: o.tilt ?? 0.55, look: [0.4, 1] });
  p.lean = -0.06 + (o.lean ?? 0);
  return p;
}

export function walk(t, seed, o = {}) {
  const p = idle(t, seed, o);
  const f = o.freq ?? 1.6, ph = t * f * Math.PI * 2 + (o.phase ?? hash(seed) * 6.28);
  const a = o.stride ?? 0.42;
  p.legF = { hip: Math.sin(ph) * a, knee: Math.max(0, -Math.cos(ph)) * 0.55 + 0.05 };
  p.legB = { hip: -Math.sin(ph) * a, knee: Math.max(0, Math.cos(ph)) * 0.55 + 0.05 };
  p.armF = { sh: -Math.sin(ph) * a * 0.8, el: 0.3 }; p.armB = { sh: Math.sin(ph) * a * 0.8, el: 0.3 };
  p.bob = Math.abs(Math.cos(ph)) * 1.1 - 0.6;
  p.lean = (o.lean ?? 0.06);
  return p;
}

export function kneel(t, seed, o = {}) {
  const p = idle(t, seed, o);
  p.legF = { hip: 0.18, knee: 1.75 };
  p.legB = { hip: -0.05, knee: 1.6 };
  p.lean = o.lean ?? 0.08;
  p.kneelW = 1;
  return p;
}

export function sit(t, seed, o = {}) { // seated: feet planted, hips at ~26 units (0.44 m)
  const p = idle(t, seed, o);
  p.legF = { hip: 1.45, knee: 1.5 }; p.legB = { hip: 1.38, knee: 1.42 };
  return p;
}

export const HEAD_IN_HANDS = (p) => {
  p.lean = 0.62; p.head.tilt = -0.42;
  p.armF = { to: 'face', off: [0.5, 0.5], bend: 1 }; p.armB = { to: 'face', off: [-1.5, 1.6], bend: 1 };
  p.face.brow = 'sad'; p.face.blink = 1;
  return p;
};

export function solveArms(spec, pose) { // resolve named IK targets to angles (for blending)
  const sk = skeleton(spec, { ...pose, armF: { sh: 0, el: 0 }, armB: { sh: 0, el: 0 } });
  const res = (a, base) => {
    if (!a.to) return a;
    const hr = sk.hr;
    let tgt;
    const face = add(sk.headC, rot(P(hr * 0.75, -hr * 0.25), sk.headA));
    if (a.to === 'face') tgt = face;
    else if (a.to === 'chest') tgt = add(sk.sh, rot(P(7.5, -7), -pose.lean));
    else if (a.to === 'belly') tgt = add(sk.hip, rot(P(8, 6), -pose.lean));
    else if (a.to === 'head') tgt = add(sk.headC, P(0, hr * 1.2));
    else tgt = P(a.x, a.y);
    tgt = add(tgt, P(a.off ? a.off[0] : 0, a.off ? a.off[1] : 0));
    return ik(sub(tgt, base), UA, FA, a.bend ?? 1);
  };
  const shF = add(sk.sh, rot(P(1.6, -0.5), -pose.lean)), shB = add(sk.sh, rot(P(-1.8, 0), -pose.lean));
  return { ...pose, armF: res(pose.armF, shF), armB: res(pose.armB, shB) };
}

export { UW, UH, FOOT, HIP };
