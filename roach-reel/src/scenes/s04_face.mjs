// S4 "Straight in. No ticket. No fucking permission." — eyes snap open, door slams.
import { W, H, E, tw, kf, clamp, lerp, noise1, wobble, shake, pop } from '../core.mjs';
import { drawManFront } from '../man.mjs';
import { camera, callout, flash, speedLines } from '../fx.mjs';
import { doorIcon, ticketIcon, slipIcon, stamp, redX } from '../icons.mjs';
import { manFrontBackdrop } from './manfront.mjs';
import { vo } from '../audioenv.mjs';
import { CUTS, ws } from '../timeline.mjs';

const t0 = CUTS.face, t1 = CUTS.burrow;
const tIn = ws('in', 1), tTicket = ws('ticket'), tNo2 = ws('no', 2), tPerm = ws('permission');

export function faceCam(t) {
  const punch = tw(t, tIn - 0.02, tIn + 0.12, E.outExpo) * 0.16 - tw(t, tIn + 0.12, tIn + 0.6, E.inOutSine) * 0.1;
  const [sx, sy, sr] = shake(t, tIn, 30, 6, 22, 4);
  const [sx2, sy2] = shake(t, tPerm + 0.2, 16, 7, 22, 6);
  return { x: 540 + noise1(t * 0.5, 1) * 10, y: 960 + noise1(t * 0.5, 2) * 8 - punch * 200, zoom: lerp(1.0, 1.1, tw(t, tIn, t1, E.inOutSine)) + punch, rot: noise1(t * 0.3, 3) * 0.012, sx: sx + sx2, sy: sy + sy2, sr, x0: 540, y0: 960 };
}

export function drawFace(ctx, t) {
  const cam = faceCam(t);
  manFrontBackdrop(ctx, t, cam);
  ctx.save(); camera(ctx, cam, 1);
  const awake = t >= tIn;
  const nod = awake ? 0 : Math.sin((t - t0) * 3.2) * 0.04 + 0.03;
  const tremble = awake ? noise1(t * 40, 5) * 0.01 * (1 + tw(t, tPerm, t1)) : 0;
  const v = vo(t);
  drawManFront(ctx, {
    x: 540, y: 1960, s: 2.2, t,
    bodyRot: (awake ? 0 : Math.sin((t - t0) * 1.6) * 0.02) + tremble,
    headRot: nod + wobble(t, tIn, 5, 6) * 0.08 + tremble * 2,
    eyeOpen: awake ? kf(t, [[tIn, 0.2], [tIn + 0.08, 1.28, E.outBack], [tIn + 0.5, 1.15]]) : 0.08 + Math.max(0, Math.sin((t - t0) * 2)) * 0.12,
    pupil: awake ? 0.38 + noise1(t * 30, 2) * 0.05 : 1, look: [noise1(t * 20, 7) * 0.08, 0.1],
    hairUp: awake ? kf(t, [[tIn, 0], [tIn + 0.1, 1.3, E.outBack], [tIn + 0.6, 1]]) : 0,
    brow: awake ? 1.1 : -0.1, browTilt: awake ? 0.5 * tw(t, tIn + 0.4, tTicket) : 0,
    mouthOpen: awake ? 0.75 + Math.sin(t * 9) * 0.08 + v * 0.25 : 0.12, smile: awake ? 0 : -0.2,
    sweat: tw(t, tTicket - 0.3, tTicket), twitch: tw(t, tPerm, tPerm + 0.2), twitchSide: 1,
    earWig: wobble(t, tIn, 7, 5) * 0.2,
  });
  ctx.restore();
  speedLines(ctx, W / 2, 860, (1 - tw(t, tIn, tIn + 0.4)) * (awake ? 1 : 0), t, 46);
  flash(ctx, '#fff', awake ? clamp(1 - (t - tIn) / 0.1) * 0.6 : 0);
}

export const s04 = {
  name: 'face', t0, t1,
  draw(ctx, t) { drawFace(ctx, t); },
  ui(ctx, t) {
    // "wheee" from below as the roach goes in
    callout(ctx, t, t0 + 0.02, 'WHEEE!', 560, 1760, { dur: 0.6, rot: -0.08, scale: 0.75, edge: '#4cd964', rise: 900 });
    // door badge slams
    const ds = pop(t, tIn - 0.28, 0.25) * (1 - tw(t, tTicket - 0.05, tTicket + 0.15));
    if (ds > 0.01) doorIcon(ctx, 800, 470, ds * 0.95, tw(t, tIn - 0.04, tIn + 0.03, E.inQuad), clamp(1 - (t - tIn) / 0.35) * (t > tIn ? 1 : 0));
    callout(ctx, t, tIn + 0.02, 'THUD!', 760, 700, { dur: 0.75, rot: 0.14, scale: 0.8, edge: '#ff9f1c' });
    // ticket + X
    const ts = pop(t, tTicket - 0.42, 0.28) * (1 - tw(t, t1 - 0.25, t1 - 0.05));
    if (ts > 0.01) { ticketIcon(ctx, 280, 520, ts * 0.95); redX(ctx, 280, 520, ts * 0.62, t, tTicket + 0.1); }
    // permission slip + DENIED
    const ps = pop(t, tNo2 - 0.05, 0.28) * (1 - tw(t, t1 - 0.25, t1 - 0.05));
    if (ps > 0.01) { slipIcon(ctx, 810, 600, ps * 0.85); stamp(ctx, 'DENIED', 800, 650, ps * 0.62, -0.22, t, tPerm + 0.18); }
  },
};
