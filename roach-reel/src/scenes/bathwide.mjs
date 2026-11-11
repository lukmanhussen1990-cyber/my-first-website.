// Shared wide bathroom shot: man from behind at a side-view toilet, stream arcing into the bowl.
import { TAU, E, tw, kf, clamp, lerp, noise1, rgb } from '../core.mjs';
import { glow } from '../poly.mjs';
import { bathroomSet, bathLighting, toiletSide, nightLight, stream, splashDrops, puddle, BC } from '../env_bath.mjs';
import { drawManBack } from '../man.mjs';
import { camera } from '../fx.mjs';
import { dust } from '../layers.mjs';

export const TOILET = [800, 1580, 0.78];
export const LAMP = [935, 930];
export const MAN = [420, 1650, 0.8];
export const BOWL = [700, 1330];

/** stream bezier from hidden origin to target end point */
export function arc(t, end, sway = 0) {
  const o = [MAN[0] + 66 + sway * 700, MAN[1] - 440 * MAN[2]];
  const e = end;
  const mid = [(o[0] + e[0]) / 2, Math.min(o[1], e[1]) - 110 - (e[0] - o[0]) * 0.15];
  return [o, [o[0] + (mid[0] - o[0]) * 0.8, mid[1] - 10], [e[0] - (e[0] - mid[0]) * 0.55, mid[1] + 10], e];
}

/**
 * o: {cam, man:{x,y,s,walk,sway,headRot,headY}, streamOn:0..1, streamEnd:[x,y], onFloor:0..1, extra:(ctx)=>{}, zzz}
 */
export function drawBathWide(ctx, t, o) {
  const cam = o.cam;
  bathLighting(cam, LAMP, { lampR: 900 });
  ctx.save(); camera(ctx, cam, 0.85); bathroomSet(ctx, t); ctx.restore();
  ctx.save(); camera(ctx, cam, 1);
  nightLight(ctx, LAMP[0], LAMP[1], t, 0.85);
  toiletSide(ctx, TOILET[0], TOILET[1], TOILET[2]);
  if (o.puddle) puddle(ctx, o.puddle[0], o.puddle[1], 70 * o.puddle[2], 18 * o.puddle[2], t, 1);
  const m = o.man;
  let arcInfo = null;
  if (o.streamOn > 0) {
    const P = arc(t, o.streamEnd || BOWL, m.sway || 0);
    arcInfo = stream(ctx, P, t, { reveal: o.streamOn, from: o.streamFrom || 0, w0: o.w0 || 17, w1: o.w1 || 13 });
    if (arcInfo && o.streamOn >= 1) {
      const e = arcInfo.end;
      splashDrops(ctx, e[0], e[1] - 4, t, { n: 10, s: 0.5, seed: 4 });
      glow(ctx, e[0], e[1], 70, [255, 220, 90], 0.35);
    }
  }
  if (o.behindMan) o.behindMan(ctx, arcInfo);
  drawManBack(ctx, { x: m.x, y: m.y, s: m.s, t, walk: m.walk, sway: m.sway, headRot: m.headRot, headY: m.headY, hairUp: m.hairUp });
  if (o.extra) o.extra(ctx, arcInfo);
  // sleepy Zzz
  if (o.zzz) {
    for (let i = 0; i < 3; i++) {
      const ph = ((t * 0.55 + i / 3) % 1);
      const zx = m.x + 70 * m.s + ph * 90 + Math.sin(ph * 6 + i) * 14, zy = m.y - 1060 * m.s - ph * 220;
      ctx.save(); ctx.globalAlpha = o.zzz * Math.sin(ph * Math.PI);
      ctx.font = `${44 + ph * 34}px "Luckiest Guy"`; ctx.lineWidth = 8; ctx.strokeStyle = '#13213f'; ctx.fillStyle = '#cfe3ff';
      ctx.strokeText('Z', zx, zy); ctx.fillText('Z', zx, zy); ctx.restore();
    }
  }
  dust(ctx, t, -200, -100, 1500, 2200, 36, 5, [200, 220, 255], 0.35);
  ctx.restore();
  return arcInfo;
}
