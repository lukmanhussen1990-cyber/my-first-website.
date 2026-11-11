// The sleepy man: front (waist-up) and back (full body) cut-out rigs. Always clothed: white vest + blue boxers.
import { TAU, rgb, hex, mixc, clamp, lerp } from './core.mjs';
import { blob, ellipsePts, ellipseBlob, cached, drawMesh, limb, taper, path, slab, softShadow } from './poly.mjs';

export const MC = {
  skin: hex('#eab48c'), skinDk: hex('#c98a66'), skinLt: hex('#f6cfab'), hair: hex('#6e4022'), hairDk: hex('#3e2311'),
  vest: hex('#eef0f4'), vestDk: hex('#c6cbd6'), boxer: hex('#3467c4'), boxerDk: hex('#21468f'), lip: hex('#b35b54'),
  eyeW: hex('#fbfaf6'), iris: hex('#5b7f3f'), brow: hex('#4a2a14'), stubble: hex('#7b5640'),
};
const mSkin = { c: MC.skin, kd: 0.5, amb: 1.3, spec: 0.1, shin: 12, jit: 0.03 };
const mVest = { c: MC.vest, kd: 0.65, spec: 0.05, shin: 8, jit: 0.035 };
const mHair = { c: MC.hair, kd: 0.85, spec: 0.25, shin: 14, jit: 0.09 };
const mBox = { c: MC.boxer, kd: 0.8, spec: 0.1, shin: 10, jit: 0.05 };

const G = {
  face: () => blob(ellipsePts(86, 110, 18, -Math.PI / 2).map(([x, y]) => [x * (y > 0 ? 1 - 0.32 * (y / 110) ** 2 : 1), y]), { rings: [0.72, 0.38], bulge: 0.3, seed: 21, apex: [-0.12, -0.1] }),
  ear: () => ellipseBlob(27, 42, { n: 10, rings: [0.55], bulge: 0.5, seed: 22 }),
  hairCap: () => blob([[-96, 0], [-100, -40], [-90, -86], [-62, -118], [-20, -132], [26, -130], [66, -114], [92, -82], [100, -40], [96, 2], [80, -40], [56, -62], [20, -70], [-20, -72], [-60, -60], [-84, -34]], { rings: [0.6], bulge: 0.6, seed: 23, apex: [-0.1, -0.4] }),
  torsoSkin: () => blob([[-116, -298], [-70, -332], [-30, -342], [30, -342], [70, -332], [116, -298], [112, -230], [92, -190], [84, -90], [80, 0], [-80, 0], [-84, -90], [-92, -190], [-112, -230]], { rings: [0.6], bulge: 0.35, seed: 24 }),
  vest: () => blob([[-82, 6], [-88, -110], [-96, -196], [-84, -238], [-76, -300], [-74, -326], [-44, -328], [-36, -298], [-20, -272], [0, -264], [20, -272], [36, -298], [44, -328], [74, -326], [76, -300], [84, -238], [96, -196], [88, -110], [82, 6], [0, 10]], { rings: [0.62], bulge: 0.32, seed: 25, center: [0, -120] }),
  neck: () => blob([[-30, -400], [30, -400], [34, -330], [-34, -330]], { rings: [0.5], bulge: 0.4, seed: 26 }),
  // back view
  bHead: () => ellipseBlob(80, 98, { n: 16, rings: [0.7, 0.35], bulge: 0.7, seed: 31, apex: [-0.15, -0.3] }),
  bVest: () => blob([[-92, -480], [-96, -560], [-100, -640], [-84, -690], [-74, -760], [-50, -778], [-36, -736], [-18, -712], [0, -706], [18, -712], [36, -736], [50, -778], [74, -760], [84, -690], [100, -640], [96, -560], [92, -480], [0, -474]], { rings: [0.6], bulge: 0.3, seed: 32, center: [0, -600] }),
  bBox: () => blob([[-96, -486], [96, -486], [102, -420], [110, -330], [62, -318], [8, -334], [0, -360], [-8, -334], [-62, -318], [-110, -330], [-102, -420]], { rings: [0.6], bulge: 0.35, seed: 33, center: [0, -420] }),
  bShoulders: () => blob([[-118, -740], [-80, -786], [-30, -800], [30, -800], [80, -786], [118, -740], [104, -660], [-104, -660]], { rings: [0.5], bulge: 0.3, seed: 34 }),
};
const g = (k) => cached('man:' + k, G[k]);

function hand(ctx, kind, s = 1, flip = 1) {
  ctx.save();
  ctx.scale(s * flip, s);
  const lt = rgb(MC.skinLt), dk = rgb(MC.skinDk), mid = rgb(MC.skin);
  if (kind === 'palm') {
    // open palm facing up (seen from front, slightly above)
    drawMesh(ctx, cached('hand:palm', () => blob([[-40, -6], [-30, -22], [0, -26], [34, -20], [46, -4], [36, 14], [0, 18], [-34, 12]], { rings: [0.5], bulge: 0.25, seed: 61 })), mSkin);
    ctx.fillStyle = mid;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(20 + i * 0 - 4, -20 + i * 9 - 2, 22, 7, -0.15, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = dk; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(4, -14 + i * 9); ctx.lineTo(38, -16 + i * 9); ctx.stroke(); }
    ctx.fillStyle = lt; ctx.beginPath(); ctx.ellipse(-30, -18, 9, 16, 0.9, 0, TAU); ctx.fill();
  } else if (kind === 'wave') {
    // open hand, fingers up
    drawMesh(ctx, cached('hand:wave', () => blob([[-26, 20], [-30, -10], [-26, -40], [-12, -52], [6, -52], [22, -44], [30, -16], [26, 20], [0, 26]], { rings: [0.5], bulge: 0.3, seed: 62 })), mSkin);
    for (let i = 0; i < 4; i++) limb(ctx, [[-18 + i * 12, -44], [-22 + i * 13, -78 + Math.abs(i - 1.5) * 6]], [11, 10], lt, dk, { cap: true });
    limb(ctx, [[-24, -6], [-46, -30]], [12, 10], lt, dk, { cap: true });
  } else { // relaxed fist
    drawMesh(ctx, cached('hand:fist', () => ellipseBlob(26, 22, { n: 10, rings: [0.5], bulge: 0.5, seed: 63 })), mSkin);
    ctx.strokeStyle = dk; ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 10, -14); ctx.lineTo(i * 10, 4); ctx.stroke(); }
  }
  ctx.restore();
}

function ik(root, target, side) {
  const l1 = 135, l2 = 125;
  const dx = target[0] - root[0], dy = target[1] - root[1];
  const d = Math.min(l1 + l2 - 1, Math.max(20, Math.hypot(dx, dy)));
  const th = Math.atan2(dx, dy);
  const phi = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const a1 = th + side * phi;
  const p1 = [root[0] + Math.sin(a1) * l1, root[1] + Math.cos(a1) * l1];
  return [a1, Math.atan2(target[0] - p1[0], target[1] - p1[1])];
}
function arm(ctx, root, a1, a2, handKind, side, s = 1) {
  const l1 = 135, l2 = 125;
  const p1 = [root[0] + Math.sin(a1) * l1, root[1] + Math.cos(a1) * l1];
  const p2 = [p1[0] + Math.sin(a2) * l2, p1[1] + Math.cos(a2) * l2];
  limb(ctx, [root, p1], [50, 40], rgb(MC.skinLt), rgb(MC.skinDk), { ridge: -0.15 });
  limb(ctx, [p1, p2], [40, 34], rgb(MC.skinLt), rgb(MC.skinDk), { ridge: -0.15 });
  ctx.fillStyle = rgb(MC.skin); ctx.beginPath(); ctx.arc(p1[0], p1[1], 19.5, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(p2[0], p2[1]);
  const ang = handKind === 'wave' ? 0 : a2;
  if (handKind === 'wave') ctx.rotate(-Math.sin(a2) * 0.2); else ctx.rotate(-ang);
  if (handKind === 'palm') ctx.rotate(ang);
  hand(ctx, handKind, 1, side);
  ctx.restore();
  return { p1, p2 };
}

function eye(ctx, x, y, p, side) {
  ctx.save(); ctx.translate(x, y);
  const tw = side === p.twitchSide ? p.twitch || 0 : 0;
  const open = clamp((p.eyeOpen ?? 0.35) + (side < 0 ? p.eyeOpenL || 0 : p.eyeOpenR || 0), 0, 1.25);
  const rx = 26 + (open > 1 ? (open - 1) * 12 : 0), ry = 18 + (open > 1 ? (open - 1) * 26 : 0);
  // bags
  ctx.strokeStyle = 'rgba(140,80,110,0.16)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, 10, rx * 0.9, ry * 0.9, 0, 0.25, Math.PI - 0.25); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 20, rx * 0.7, ry * 0.6, 0, 0.5, Math.PI - 0.5); ctx.stroke();
  // sclera
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fillStyle = rgb(MC.eyeW); ctx.fill();
  ctx.clip();
  const ps = (p.pupil ?? 1);
  const lx = (p.look?.[0] || 0) * 10 + (tw ? Math.sin((p.t || 0) * 90) * 1.2 * tw : 0), ly = (p.look?.[1] || 0) * 6;
  ctx.fillStyle = rgb(MC.iris); ctx.beginPath(); ctx.arc(lx, ly + 1, 13 * Math.min(1, 0.55 + ps * 0.45), 0, TAU); ctx.fill();
  ctx.fillStyle = '#120a06'; ctx.beginPath(); ctx.arc(lx, ly + 1, 6.8 * ps, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(lx - 4, ly - 4, 3.6, 0, TAU); ctx.fill();
  // eyelids (skin) – sleepy heavy lid
  const lid = -ry + (1 - Math.min(1, open)) * ry * 2;
  ctx.fillStyle = rgb(mixc(MC.skin, MC.skinDk, 0.25));
  ctx.beginPath(); ctx.moveTo(-40, -40); ctx.lineTo(40, -40); ctx.lineTo(40, lid + (p.lidTilt || 0) * side * 6); ctx.quadraticCurveTo(0, lid + 4, -40, lid - (p.lidTilt || 0) * side * 6); ctx.closePath(); ctx.fill();
  const low = tw ? 0.25 + 0.2 * Math.abs(Math.sin((p.t || 0) * 47)) * tw : p.lowerLid || 0;
  if (low > 0) { const by = ry - low * ry * 2; ctx.beginPath(); ctx.moveTo(-40, 40); ctx.lineTo(40, 40); ctx.lineTo(40, by); ctx.quadraticCurveTo(0, by - 5, -40, by); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  // lash line
  ctx.strokeStyle = '#2b170c'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  if (open < 0.06) { ctx.beginPath(); ctx.moveTo(-rx, 0); ctx.quadraticCurveTo(0, 7, rx, 0); ctx.stroke(); }
  else { ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, Math.PI, TAU); ctx.lineWidth = 2; ctx.stroke(); const ly2 = Math.max(-ry, lid); ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(-rx - 2, ly2 * 0.6); ctx.quadraticCurveTo(0, ly2 + 3, rx + 2, ly2 * 0.6); ctx.stroke(); }
  if (tw) { // twitch lines
    ctx.strokeStyle = `rgba(30,20,10,${0.7 * tw})`; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const a = -0.6 + i * 0.6 + side * 0.0; const r0 = rx + 12, r1 = rx + 24 + Math.sin((p.t || 0) * 60 + i) * 4; ctx.beginPath(); ctx.moveTo(side * Math.cos(a) * r0, Math.sin(a) * r0 - 4); ctx.lineTo(side * Math.cos(a) * r1, Math.sin(a) * r1 - 4); ctx.stroke(); }
  }
  ctx.restore();
}

/** Front view, origin = waist centre. */
export function drawManFront(ctx, p) {
  const t = p.t || 0;
  ctx.save();
  ctx.translate(p.x || 0, p.y || 0);
  ctx.scale(p.s || 1, p.s || 1);
  ctx.rotate(p.bodyRot || 0);
  const br = Math.sin(t * 1.9) * 0.012 * (p.breath ?? 1);
  ctx.scale(1 + br * 0.5, 1 + br);
  const armL = { ...(p.armL || { a1: -0.1, a2: 0.1, hand: 'fist' }) };
  const armR = { ...(p.armR || { a1: 0.1, a2: -0.1, hand: 'fist' }) };
  if (armL.ik) [armL.a1, armL.a2] = ik([-104, -300], armL.ik, 1);
  if (armR.ik) [armR.a1, armR.a2] = ik([104, -300], armR.ik, -1);
  // arms behind torso when hanging
  const behind = (a) => a.a1 * (a === armL ? -1 : 1) < 0.5 && Math.abs(a.a2) < 0.7;
  if (behind(armL)) arm(ctx, [-104, -300], armL.a1, armL.a2, armL.hand, -1);
  if (behind(armR)) arm(ctx, [104, -300], armR.a1, armR.a2, armR.hand, 1);
  // boxers waistband (only shows at waist)
  drawMesh(ctx, cached('man:fwaist', () => slab(-86, -6, 172, 70, { bevel: 8, seed: 27, cols: 3, rows: 1 })), mBox);
  ctx.fillStyle = rgb(MC.boxerDk); ctx.fillRect(-86, -6, 172, 14);
  drawMesh(ctx, g('torsoSkin'), mSkin);
  drawMesh(ctx, g('vest'), mVest);
  // rib texture + tiny stain
  ctx.strokeStyle = 'rgba(150,160,180,0.25)'; ctx.lineWidth = 2;
  for (let x = -70; x <= 70; x += 14) { ctx.beginPath(); ctx.moveTo(x, -250 + Math.abs(x) * 0.4); ctx.lineTo(x * 1.05, 0); ctx.stroke(); }
  ctx.fillStyle = 'rgba(176,132,60,0.35)'; ctx.beginPath(); ctx.ellipse(34, -120, 13, 9, 0.4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(48, -108, 4, 0, TAU); ctx.fill();
  drawMesh(ctx, g('neck'), { ...mSkin, c: mixc(MC.skin, MC.skinDk, 0.35) });
  // head
  ctx.save();
  ctx.translate(0, -400);
  ctx.rotate(p.headRot || 0);
  ctx.translate(p.headX || 0, -70 + (p.headY || 0));
  ctx.scale(1.08, 1.08);
  // ears
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.translate(sd * 90, 4); ctx.rotate(sd * 0.18 + (p.earWig || 0) * sd);
    drawMesh(ctx, g('ear'), mSkin);
    ctx.fillStyle = rgb(MC.skinDk); ctx.beginPath(); ctx.ellipse(sd * 4, 2, 13, 26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(mixc(MC.skinDk, MC.lip, 0.3)); ctx.beginPath(); ctx.ellipse(sd * 6, 4, 6, 14, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  drawMesh(ctx, g('face'), mSkin);
  // stubble
  ctx.fillStyle = 'rgba(110,80,60,0.18)';
  ctx.beginPath(); ctx.moveTo(-74, 30); ctx.quadraticCurveTo(-60, 100, 0, 112); ctx.quadraticCurveTo(60, 100, 74, 30); ctx.quadraticCurveTo(40, 70, 0, 74); ctx.quadraticCurveTo(-40, 70, -74, 30); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 44, 30, 9, 0, 0, TAU); ctx.fill();
  // eyes
  eye(ctx, -36, -10, p, -1);
  eye(ctx, 36, -10, p, 1);
  // brows
  ctx.fillStyle = rgb(MC.brow);
  for (const sd of [-1, 1]) {
    const raise = (p.brow || 0) + (sd < 0 ? p.browL || 0 : p.browR || 0);
    const tilt = (p.browTilt || 0) + (sd < 0 ? p.browTiltL || 0 : p.browTiltR || 0);
    ctx.save(); ctx.translate(sd * 38, -46 - raise * 16); ctx.rotate(sd * -tilt * 0.35 + sd * 0.06);
    ctx.beginPath(); ctx.moveTo(-26, 4); ctx.quadraticCurveTo(0, -8, 26, 2); ctx.lineTo(24, 10); ctx.quadraticCurveTo(0, 2, -24, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // nose
  ctx.fillStyle = rgb(MC.skinLt); path(ctx, [[-4, -14], [6, -14], [14, 30], [0, 34]]); ctx.fill();
  ctx.fillStyle = rgb(MC.skinDk); path(ctx, [[-4, -14], [0, 34], [-16, 30]]); ctx.fill();
  ctx.fillStyle = rgb(mixc(MC.skinDk, [80, 40, 30], 0.3)); ctx.beginPath(); ctx.ellipse(-8, 33, 5, 3, 0.3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(9, 33, 5, 3, -0.3, 0, TAU); ctx.fill();
  // mouth
  drawMouth(ctx, p);
  // sweat
  if (p.sweat) {
    ctx.save(); ctx.globalAlpha *= clamp(p.sweat);
    for (const [sx, sy, sc] of [[78, -40, 1], [-84, -10, 0.8]]) {
      const dy = ((t * 60) % 40) * 0.0;
      ctx.fillStyle = 'rgba(190,230,255,0.9)';
      ctx.beginPath(); ctx.moveTo(sx, sy - 18 * sc + dy); ctx.quadraticCurveTo(sx + 12 * sc, sy + 4 * sc + dy, sx, sy + 8 * sc + dy); ctx.quadraticCurveTo(sx - 12 * sc, sy + 4 * sc + dy, sx, sy - 18 * sc + dy); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(sx - 3 * sc, sy + dy, 3 * sc, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // hair
  const hu = p.hairUp || 0;
  ctx.save(); ctx.translate(0, -16);
  drawHairTufts(ctx, hu, t, true);
  drawMesh(ctx, g('hairCap'), mHair);
  drawFringe(ctx, hu);
  ctx.restore();
  ctx.restore();
  // arms in front
  if (!behind(armL)) arm(ctx, [-104, -300], armL.a1, armL.a2, armL.hand, -1);
  if (!behind(armR)) arm(ctx, [104, -300], armR.a1, armR.a2, armR.hand, 1);
  if (p.hold) p.hold(ctx);
  ctx.restore();
}

function drawHairTufts(ctx, up, t, front) {
  const tufts = [[-70, -100, -0.9], [-40, -124, -0.45], [-8, -134, -0.1], [26, -130, 0.25], [58, -112, 0.6], [84, -80, 1.0], [-88, -70, -1.2]];
  tufts.forEach(([x, y, a], i) => {
    const len = 46 + (i % 3) * 12 + up * 40;
    const aa = a * (1 - up * 0.5) + Math.sin(t * 2 + i) * 0.04;
    const tip = [x + Math.sin(aa) * len, y - Math.cos(aa) * len];
    ctx.fillStyle = rgb(i % 2 ? MC.hair : MC.hairDk);
    path(ctx, [[x - 18, y + 10], tip, [x + 18, y + 8]]); ctx.fill();
    ctx.fillStyle = rgb(mixc(MC.hair, [255, 230, 200], 0.18));
    path(ctx, [[x - 4, y + 6], tip, [x + 10, y + 6]]); ctx.fill();
  });
}
function drawFringe(ctx, up) {
  const pts = [[-84, -40], [-60, -64], [-36, -48], [-14, -70], [8, -52], [32, -72], [56, -54], [80, -36]];
  ctx.fillStyle = rgb(MC.hair);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const tip = [(a[0] + b[0]) / 2 + (i % 2 ? 6 : -6), Math.max(a[1], b[1]) + 22 - up * 26];
    ctx.fillStyle = rgb(i % 2 ? MC.hair : mixc(MC.hair, MC.hairDk, 0.5));
    path(ctx, [[a[0], a[1] - 10], [b[0], b[1] - 10], tip]); ctx.fill();
  }
}

function drawMouth(ctx, p) {
  const o = clamp(p.mouthOpen || 0, 0, 1.2), sm = p.smile || 0; // smile -1 (frown) .. 1 (forced grin)
  ctx.save(); ctx.translate(0, 62 + (p.mouthY || 0));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (sm > 0.5) {
    // forced grin with teeth, slightly crooked
    const w = 46 + sm * 12, cy = -6 * sm;
    ctx.beginPath(); ctx.moveTo(-w, cy - 8); ctx.quadraticCurveTo(0, 30 + o * 10, w, cy - 14);
    ctx.quadraticCurveTo(0, 6, -w, cy - 8); ctx.closePath();
    ctx.fillStyle = '#5a1f1c'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(-w, -30, w * 2, 36);
    ctx.strokeStyle = 'rgba(160,150,140,0.8)'; ctx.lineWidth = 2;
    for (let x = -w + 12; x < w; x += 13) { ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x, 22); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-w, 9); ctx.quadraticCurveTo(0, 14, w, 6); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = rgb(MC.lip); ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(-w, cy - 8); ctx.quadraticCurveTo(0, 30 + o * 10, w, cy - 14); ctx.quadraticCurveTo(0, 6, -w, cy - 8); ctx.stroke();
    ctx.strokeStyle = rgb(MC.skinDk); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-w - 8, cy - 16); ctx.quadraticCurveTo(-w - 2, cy - 6, -w - 6, cy + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w + 8, cy - 22); ctx.quadraticCurveTo(w + 2, cy - 12, w + 6, cy - 4); ctx.stroke();
  } else if (o > 0.08) {
    const w = 18 + o * 10 + Math.max(0, sm) * 10, h = 6 + o * 30;
    ctx.beginPath(); ctx.ellipse(0, h * 0.35, w, h, 0, 0, TAU); ctx.fillStyle = '#4a1716'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#c95a63'; ctx.beginPath(); ctx.ellipse(0, h * 1.15, w * 0.8, h * 0.55, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(-w, h * 0.35 - h, w * 2, Math.min(10, h * 0.35));
    ctx.restore();
    ctx.strokeStyle = rgb(MC.lip); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, h * 0.35, w, h, 0, 0, TAU); ctx.stroke();
  } else {
    const w = 26;
    ctx.strokeStyle = rgb(mixc(MC.lip, [60, 20, 20], 0.3)); ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-w, 2 + sm * 6); ctx.quadraticCurveTo(0, 2 - sm * 10, w, 2 + sm * 6 + (p.mouthSkew || 0) * 8); ctx.stroke();
  }
  ctx.restore();
}

/** Back view, origin = between the feet on the floor. */
export function drawManBack(ctx, p) {
  const t = p.t || 0;
  ctx.save();
  ctx.translate(p.x || 0, p.y || 0);
  ctx.scale(p.s || 1, p.s || 1);
  if (p.shadow !== false) softShadow(ctx, 0, 0, 150, 26, 0.45);
  const sway = p.sway ?? Math.sin(t * 1.25) * 0.022;
  ctx.rotate(sway);
  const walk = p.walk; // phase or undefined
  // legs + feet
  for (const sd of [-1, 1]) {
    const ph = walk != null ? Math.sin(walk * TAU + (sd > 0 ? Math.PI : 0)) : 0;
    const lift = walk != null ? Math.max(0, ph) * 26 : 0;
    const fx = sd * 44, fy = -lift;
    limb(ctx, [[sd * 46, -340], [sd * 47, -250], [sd * 46, -170], [fx, fy - 26]], [42, 40, 44, 26], rgb(MC.skinLt), rgb(MC.skinDk), { ridge: 0.1 });
    // heel
    ctx.fillStyle = rgb(MC.skinDk); ctx.beginPath(); ctx.ellipse(fx, fy - 12, 21, 16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(MC.skin); ctx.beginPath(); ctx.ellipse(fx - sd * 3, fy - 16, 15, 11, 0, 0, TAU); ctx.fill();
  }
  // forearms going forward (behind torso)
  const armSw = Math.sin(t * 1.25 + 0.4) * 0.03;
  for (const sd of [-1, 1]) {
    limb(ctx, [[sd * 134, -614], [sd * 110, -566]], [36, 32], rgb(MC.skinLt), rgb(MC.skinDk));
  }
  drawMesh(ctx, g('bBox'), mBox);
  // polka dots + waistband
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 14; i++) { const x = -80 + ((i * 37) % 160), y = -460 + ((i * 53) % 120); ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); }
  ctx.fillStyle = rgb(MC.boxerDk); path(ctx, [[-96, -490], [96, -490], [97, -470], [-97, -470]]); ctx.fill();
  ctx.strokeStyle = 'rgba(20,40,90,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -470); ctx.lineTo(0, -360); ctx.stroke();
  // shoulders/arms skin
  drawMesh(ctx, g('bShoulders'), mSkin);
  for (const sd of [-1, 1]) {
    limb(ctx, [[sd * 106, -742], [sd * 122, -680], [sd * (136 + armSw * 100 * sd), -610]], [54, 46, 38], rgb(MC.skinLt), rgb(MC.skinDk), { ridge: -0.1 });
    ctx.fillStyle = rgb(MC.skin); ctx.beginPath(); ctx.ellipse(sd * 104, -742, 30, 26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = rgb(MC.skinDk); ctx.beginPath(); ctx.ellipse(sd * (136 + armSw * 100 * sd), -610, 19, 16, 0, 0, TAU); ctx.fill();
  }
  drawMesh(ctx, g('bVest'), mVest);
  ctx.strokeStyle = 'rgba(150,160,180,0.25)'; ctx.lineWidth = 2;
  for (let x = -80; x <= 80; x += 14) { ctx.beginPath(); ctx.moveTo(x, -700 + Math.abs(x) * 0.3); ctx.lineTo(x * 1.04, -480); ctx.stroke(); }
  // neck
  drawMesh(ctx, cached('man:bneck', () => blob([[-32, -800], [32, -800], [30, -760], [-30, -760]], { rings: [0.5], bulge: 0.3, seed: 35 })), { ...mSkin, c: mixc(MC.skin, MC.skinDk, 0.2) });
  // head
  ctx.save();
  ctx.translate(0, -800);
  ctx.rotate((p.headRot || 0) + Math.sin(t * 1.25 - 0.6) * 0.03);
  ctx.translate(0, -84 + (p.headY || 0));
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.translate(sd * 80, 6); ctx.rotate(sd * 0.25);
    drawMesh(ctx, g('ear'), mSkin);
    ctx.fillStyle = rgb(MC.skinDk); ctx.beginPath(); ctx.ellipse(-sd * 6, 4, 9, 24, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  drawMesh(ctx, g('bHead'), { ...mSkin, c: mixc(MC.skin, MC.skinDk, 0.15) });
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 81, 99, 0, 0, TAU); ctx.clip();
  drawMesh(ctx, cached('man:bhair', () => blob([[-90, 40], [-96, -20], [-80, -80], [-40, -110], [0, -116], [40, -110], [80, -80], [96, -20], [90, 40], [60, 62], [30, 50], [0, 66], [-30, 50], [-60, 62]], { rings: [0.6, 0.3], bulge: 0.6, seed: 36, apex: [0.05, -0.2] })), mHair);
  ctx.restore();
  // messy tufts
  const tufts = [[-60, -80, -0.8], [-30, -100, -0.3], [4, -106, 0.1], [36, -98, 0.45], [64, -76, 0.9], [-80, -30, -1.4], [82, -26, 1.4], [-70, 30, -2.0], [72, 34, 2.0]];
  tufts.forEach(([x, y, a], i) => {
    const len = 30 + (i % 3) * 12 + (p.hairUp || 0) * 30;
    const tip = [x + Math.sin(a) * len, y - Math.cos(a) * len];
    ctx.fillStyle = rgb(i % 2 ? MC.hair : MC.hairDk);
    path(ctx, [[x - 16, y + 6], tip, [x + 16, y + 6]]); ctx.fill();
  });
  // crown swirl
  ctx.strokeStyle = rgb(MC.hairDk); ctx.lineWidth = 4;
  ctx.beginPath(); for (let i = 0; i < 30; i++) { const a = i * 0.35, r = i * 0.9; const x = 6 + Math.cos(a) * r, y = -50 + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  ctx.restore();
  ctx.restore();
}
