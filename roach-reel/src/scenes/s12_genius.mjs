// S12 "Genius." — forced smile, eye twitch, NO VACANCY blinks on.
import { W, H, TAU, E, tw, kf, clamp, lerp, noise1, wobble, shake, rgb, hex } from '../core.mjs';
import { glow } from '../poly.mjs';
import { drawManFront } from '../man.mjs';
import { camera, flash } from '../fx.mjs';
import { manFrontBackdrop } from './manfront.mjs';
import { vo } from '../audioenv.mjs';
import { CUTS, ws } from '../timeline.mjs';

const t0 = CUTS.genius, t1 = CUTS.end;
const tG = ws('genius'), tNV = tG + 0.35;

export const s12 = {
  name: 'genius', t0, t1,
  draw(ctx, t) {
    const cam = { x: 540 + noise1(t * 0.5, 1) * 5, y: 860 + noise1(t * 0.5, 2) * 4, zoom: lerp(1.0, 1.07, tw(t, t0, t1, E.inOutSine)) + wobble(t, t0, 4, 7) * 0.02, rot: 0, x0: 540, y0: 960 };
    manFrontBackdrop(ctx, t, cam, { warm: 0.9 });
    ctx.save(); camera(ctx, cam, 1);
    const v = vo(t);
    const twitch = t > tG + 0.45 ? 1 : 0;
    drawManFront(ctx, {
      x: 540, y: 2150, s: 2.75, t, eyeOpen: 0.95, eyeOpenR: twitch ? -0.15 + Math.abs(Math.sin(t * 38)) * 0.08 : 0, pupil: 0.75, look: [0, 0.05],
      smile: kf(t, [[t0, 0.2], [tG - 0.05, 0.4], [tG + 0.1, 1.15, E.outBack]]), mouthOpen: v * 0.4,
      brow: 0.35, browR: twitch ? 0.12 * Math.sin(t * 40) : 0, twitch: twitch * 0.9, twitchSide: 1,
      headRot: noise1(t * 0.7, 3) * 0.01 + twitch * Math.sin(t * 45) * 0.004, sweat: 0.8,
    });
    ctx.restore();
    // tooth glint on "genius"
    if (t > tG + 0.1 && t < tG + 0.6) {
      const k = (t - tG - 0.1) / 0.5;
      ctx.save(); ctx.translate(620, 1150); ctx.rotate(k * 2); ctx.globalAlpha = Math.sin(k * Math.PI);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, -10); ctx.lineTo(0, -70); ctx.lineTo(-10, -10); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      glow(ctx, 620, 1150, 120, [255, 255, 230], Math.sin(k * Math.PI) * 0.8);
    }
  },
  ui(ctx, t) {
    // NO VACANCY neon sign (top-right corner)
    if (t < tNV - 0.3) return;
    const pre = clamp((t - (tNV - 0.3)) / 0.2);
    const k = t - tNV;
    const on = k < 0 ? 0.05 : k < 0.3 ? ([1, 0.1, 1, 1, 0.1, 1][Math.floor(k * 20) % 6]) : 0.92 + 0.08 * noise1(t * 25, 2);
    ctx.save(); ctx.translate(820, 300); ctx.rotate(0.04); ctx.globalAlpha = pre;
    ctx.fillStyle = 'rgba(10,6,16,0.82)'; ctx.fillRect(-210, -95, 420, 190);
    ctx.strokeStyle = '#2b1b33'; ctx.lineWidth = 10; ctx.strokeRect(-210, -95, 420, 190);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-150, -95); ctx.lineTo(-170, -200); ctx.moveTo(150, -95); ctx.lineTo(170, -200); ctx.stroke();
    ctx.font = '72px "Luckiest Guy"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const [txt, y] of [['NO', -36], ['VACANCY', 38]]) {
      if (on > 0.3) { ctx.shadowColor = '#ff2a3d'; ctx.shadowBlur = 36 * on; }
      ctx.strokeStyle = rgb([255, 42, 61], 0.25 + 0.75 * on); ctx.lineWidth = 9; ctx.strokeText(txt, 0, y);
      ctx.shadowBlur = 0;
      ctx.fillStyle = on > 0.3 ? 'rgba(255,225,225,0.95)' : 'rgba(120,20,30,0.6)'; ctx.fillText(txt, 0, y);
    }
    ctx.restore();
    if (on > 0.3) glow(ctx, 820, 300, 380, [255, 40, 60], 0.35 * on * pre);
  },
};
