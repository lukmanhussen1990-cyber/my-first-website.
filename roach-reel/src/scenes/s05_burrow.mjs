// S5+S6 "Now it lives in there. It's got a sofa. A TV. A tiny fucking fridge." + S7a rent under the door.
import { W, H, TAU, E, tw, kf, clamp, lerp, noise1, wobble, shake, pop, rgb, hex, rng } from '../core.mjs';
import { glow, softShadow, drawMesh, cached, slab, blob, path } from '../poly.mjs';
import { burrowRoom, burrowLighting, lamp, sofa, tv, fridge, smallDoor, RC, ROOM } from '../env_burrow.mjs';
import { drawRoach, blink, suitcase } from '../roach.mjs';
import { camera, camPoint, callout, flash } from '../fx.mjs';
import { envelope, crumb } from '../icons.mjs';
import { dust } from '../layers.mjs';
import { drawFace } from './s04_face.mjs';
import { CUTS, ws } from '../timeline.mjs';

const t0 = CUTS.burrow, t1 = CUTS.rent, t2 = CUTS.bed;
const tLives = ws('lives'), tSofa = ws('sofa'), tTV = ws('tv'), tFridge = ws('fridge'), tPays = ws('pays'), tRent = ws('rent');
const IRIS = 0.42;
const SUIT = [300, 1528], ROACH0 = [540, 1505], SOFA = [560, 1488], TVP = [880, 1492], FRIDGE = [150, 1482];
const tHop = tFridge + 0.12, tSit = tHop + 0.36;

function popDrop(t, ta, h = 900) {
  // falls in from above with squash bounce
  if (t < ta - 0.22) return null;
  const k = tw(t, ta - 0.22, ta, E.inQuad);
  const y = -h * (1 - k);
  const land = t - ta;
  const sq = land > 0 ? 1 - wobble(t, ta, 4, 7) * 0.25 : 1 + (1 - k) * 0.15;
  return { y, sq };
}

function items(ctx, t) {
  if (t < tLives) return;
  const R = rng(9);
  const list = [['sock', -120, -330], ['brush', 90, -360], ['duck', 210, -300], ['pic', -40, -420]];
  list.forEach(([kind, dx, hgt], i) => {
    const d = 0.55 + R() * 0.15;
    const k = clamp((t - tLives - i * 0.05) / d);
    if (k <= 0) return;
    const x = SUIT[0] + dx * E.outQuad(k), y = SUIT[1] - 40 + hgt * 4 * k * (1 - k) * (k < 1 ? 1 : 0) + (k >= 1 ? 0 : 0);
    const rot = (1 - k) * 6 * (i % 2 ? 1 : -1) + (k >= 1 ? [0.3, -0.2, 0, 0.15][i] : 0);
    ctx.save(); ctx.translate(x, Math.min(y, SUIT[1] + 20 - i * 3)); ctx.rotate(rot);
    if (kind === 'sock') { ctx.fillStyle = '#e94f64'; path(ctx, [[-14, -40], [14, -40], [14, 0], [36, 4], [36, 18], [-14, 18]]); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-14, -40, 28, 10); }
    if (kind === 'brush') { ctx.fillStyle = '#4fc3f7'; ctx.fillRect(-40, -6, 70, 12); ctx.fillStyle = '#fff'; ctx.fillRect(30, -14, 22, 10); }
    if (kind === 'duck') { ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(0, -14, 28, 20, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(18, -38, 15, 0, TAU); ctx.fill(); ctx.fillStyle = '#ff8c1a'; path(ctx, [[30, -40], [46, -36], [30, -32]]); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(22, -42, 3, 0, TAU); ctx.fill(); }
    if (kind === 'pic') { ctx.fillStyle = '#7b4a2a'; ctx.fillRect(-30, -50, 60, 50); ctx.fillStyle = '#9fe0ff'; ctx.fillRect(-22, -42, 44, 34); ctx.fillStyle = '#6b3a1c'; ctx.beginPath(); ctx.ellipse(0, -22, 10, 12, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  });
}

function burrowCam(t) {
  const back = tw(t, tLives + 0.2, tTV + 0.2, E.inOutCubic);
  const kick = (ta) => wobble(t, ta, 3, 6) * 0.025;
  return {
    x: lerp(420, 540, back) + noise1(t * 0.4, 1) * 10 + lerp(0, 40, tw(t, tFridge, t1)),
    y: lerp(1410, 1250, back) + noise1(t * 0.4, 2) * 8,
    zoom: lerp(1.42, 1.0, back) + kick(tSofa + 0.02) + kick(tTV) + kick(tFridge) + lerp(0, 0.08, tw(t, tFridge, t1, E.inOutSine)),
    rot: noise1(t * 0.3, 3) * 0.01, x0: 540, y0: 960,
  };
}

function drawBurrow(ctx, t, camOverride) {
  const cam = camOverride || burrowCam(t);
  const tvOn = t > tTV ? clamp((t - tTV - 0.05) / 0.35) : 0;
  burrowLighting(cam, { tv: t > tTV ? [TVP[0] - 18, TVP[1] - 230] : null, tvK: 0.7 * tvOn });
  ctx.save(); camera(ctx, cam, 0.92); burrowRoom(ctx, t, { frameSwing: wobble(t, tSofa + 0.05, 2.5, 3) * 0.12 }); ctx.restore();
  ctx.save(); camera(ctx, cam, 1);
  lamp(ctx, 540, 700, t);
  // furniture drops
  const fr = popDrop(t, tFridge, 800);
  if (fr) { ctx.save(); ctx.translate(FRIDGE[0], FRIDGE[1] + fr.y); ctx.scale(1 / fr.sq, fr.sq); fridge(ctx, 0, 0, 0.82, t, tw(t, tFridge + 0.15, tFridge + 0.35) - tw(t, tFridge + 0.55, tFridge + 0.75), t > tFridge ? 1 : 0); ctx.restore(); }
  const sf = popDrop(t, tSofa, 900);
  if (sf) { ctx.save(); ctx.translate(SOFA[0], SOFA[1] + sf.y); ctx.scale(1 / sf.sq, sf.sq); sofa(ctx, 0, 0, 0.85); ctx.restore(); }
  if (t > tTV - 0.08) { const s = pop(t, tTV - 0.08, 0.3); ctx.save(); ctx.translate(TVP[0], TVP[1]); ctx.scale(s, s); tv(ctx, 0, 0, 0.82, t, tvOn); ctx.restore(); }
  // suitcase (opens on "lives")
  ctx.save(); ctx.translate(SUIT[0], SUIT[1]);
  const lid = tw(t, tLives - 0.02, tLives + 0.18, E.outBack);
  softShadow(ctx, 0, 0, 90, 12, 0.4);
  ctx.translate(0, -62); suitcase(ctx, 120, 64, '#8a4b2a', true);
  if (lid > 0) { ctx.save(); ctx.translate(-60, 6); ctx.rotate(-lid * 1.9); ctx.fillStyle = '#6f3a1f'; ctx.fillRect(0, -10, 120, 14); ctx.restore(); }
  ctx.restore();
  items(ctx, t);
  // dust puffs on landings
  for (const [ta, x, y] of [[tSofa, SOFA[0], SOFA[1]], [tFridge, FRIDGE[0], FRIDGE[1]]]) {
    if (t > ta && t < ta + 0.6) { const k = (t - ta) / 0.6; for (let i = 0; i < 8; i++) { const a = Math.PI + (i / 7) * Math.PI; ctx.fillStyle = `rgba(240,200,150,${0.55 * (1 - k)})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * (120 + k * 160), y + Math.sin(a) * 30 * k - 10, 26 + k * 30, 0, TAU); ctx.fill(); } }
  }
  // roach
  const hop = tw(t, tHop, tSit, E.inOutQuad);
  const seated = t >= tSit;
  let rx = lerp(ROACH0[0], SOFA[0] + 10, hop), ry = lerp(ROACH0[1], SOFA[1] - 138, hop) - Math.sin(hop * Math.PI) * 170;
  const land = seated ? wobble(t, tSit, 4, 6) : 0;
  const present = tw(t, tLives + 0.45, tLives + 0.75, E.outBack) * (1 - tw(t, tHop - 0.1, tHop));
  const startle = wobble(t, tSofa, 6, 5);
  drawRoach(ctx, {
    x: rx, y: ry + land * 10, s: 0.82, t: t + 11, turn: t < tLives + 0.4 ? -0.6 : seated ? 0.45 : 0.1, flip: false,
    squash: seated ? 1 - land * 0.15 : hop > 0 && hop < 1 ? 1.12 : 1 - startle * 0.1,
    eyeOpen: blink(t, 4, 2.4) * (startle > 0.2 ? 1.2 : 1), look: seated ? [0.8, 0] : t < tLives + 0.4 ? [-0.8, 0.4] : [0, 0],
    brow: startle > 0.3 ? 1 : 0.4, mouth: seated ? 'grin' : t > tLives ? 'grin' : 'smile', grin: 0.8, mouthOpen: present > 0.5 ? 0.3 : 0,
    arms: seated ? [[-1.0, 0.6], [1.9, 1.5]] : present > 0.01 ? [[-0.75 - present * 1.4, 0.35 - present * 1.6], [0.75 + present * 1.4, -0.35 + present * 1.6]] : t < tLives ? [[-1.4, -0.4], [0.75, -0.35]] : null,
    legs: seated ? [[-1.4, -1.5], [1.4, 1.5]] : null, shadow: !seated && hop === 0,
    holdR: seated ? (g) => { g.fillStyle = '#222'; g.save(); g.rotate(-0.6); g.fillRect(-8, -40, 16, 48); g.fillStyle = '#e74c3c'; g.beginPath(); g.arc(0, -30, 4, 0, TAU); g.fill(); g.restore(); } : null,
  });
  dust(ctx, t, -100, 300, 1300, 1500, 30, 21, [255, 220, 170], 0.35);
  ctx.restore();
}

function drawRent(ctx, t) {
  // close shot at the burrow's little round door
  const cam = { x: 430 + noise1(t * 0.5, 1) * 8 + lerp(-20, 30, tw(t, t1, t2)), y: 1400 + noise1(t * 0.5, 2) * 6, zoom: lerp(1.75, 1.88, tw(t, t1, t2, E.inOutSine)), rot: noise1(t * 0.3, 4) * 0.01, x0: 540, y0: 960 };
  burrowLighting(cam, {});
  ctx.save(); camera(ctx, cam, 0.92); burrowRoom(ctx, t, { window: false, frame: false }); ctx.restore();
  ctx.save(); camera(ctx, cam, 1);
  lamp(ctx, 540, 700, t);
  smallDoor(ctx, 260, 1500, 1.1);
  const bend = tw(t, tPays - 0.15, tPays + 0.1, E.inOutSine);
  const slide = tw(t, tPays + 0.05, tRent + 0.25, E.inOutCubic);
  // envelope slides under the door (clipped by the door)
  const ex = lerp(500, 120, slide);
  ctx.save();
  ctx.beginPath(); ctx.rect(185, 1300, 2000, 400); ctx.clip();
  if (t >= tPays + 0.04) { ctx.save(); ctx.translate(ex, 1490); ctx.scale(1, 0.5); envelope(ctx, 0, 0, 0.8, 0, 0, 'RENT'); ctx.restore(); }
  ctx.restore();
  const walk = tw(t, t1, tPays - 0.2, E.outCubic);
  drawRoach(ctx, {
    x: lerp(760, 600, walk), y: 1505, s: 0.78, t: t + 13, turn: -0.65, walk: t < tPays - 0.2 ? walk * 2.5 : null,
    lean: -0.35 * bend, squash: 1 - bend * 0.08, eyeOpen: blink(t, 7, 2.1), look: [-0.9, 0.5], brow: 0.3, mouth: 'smile', grin: 0.9,
    arms: [[-0.75 - bend * 0.6, 0.35 - bend * 0.9], [0.75, -0.35]],
    holdL: t < tPays + 0.04 ? (g) => { g.save(); g.rotate(0.3); envelope(g, -30, 10, 0.42, -0.1); g.restore(); } : null,
  });
  ctx.restore();
}

export const s05 = {
  name: 'burrow', t0, t1,
  draw(ctx, t) {
    if (t < t0 + IRIS) {
      // iris: tunnel ring grows over the man's face and reveals the burrow
      drawFace(ctx, t);
      const k = tw(t, t0 - 0.02, t0 + IRIS, E.inOutCubic);
      const r = lerp(30, 1900, k);
      const cx = 540, cy = 1640;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
      ctx.fillStyle = '#2a130b'; ctx.fillRect(0, 0, W, H);
      const bc = burrowCam(t); bc.zoom *= lerp(2.2, 1, k);
      drawBurrow(ctx, t, bc);
      ctx.restore();
      // ring rim (wooden pipe mouth)
      ctx.save();
      ctx.strokeStyle = '#1c0d06'; ctx.lineWidth = 60 + r * 0.06; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#8a5230'; ctx.lineWidth = 26 + r * 0.03; ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#d9a464'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, r + 14 + r * 0.02, -2.6, -0.6); ctx.stroke();
      ctx.restore();
      return;
    }
    drawBurrow(ctx, t);
  },
  ui(ctx, t) {
    callout(ctx, t, tSofa + 0.05, 'BOING!', 330, 760, { dur: 0.6, scale: 0.6, rot: -0.15, edge: '#ff5fa2' });
    callout(ctx, t, tFridge + 0.1, 'HMMMM', 220, 700, { dur: 0.7, scale: 0.55, rot: -0.1, edge: '#4ecdc4', burst: false });
  },
};

export const s07a = {
  name: 'rent', t0: t1, t1: t2,
  draw(ctx, t) { drawRent(ctx, t); },
};
