// Design sheets for checking the character and props in isolation.
import { ballState, drawBall } from './ball.js';
import { drawToken, tokenLook, drawStrip, drawMeter, drawSpark, drawPage, drawTwinkle } from './props.js';
import { drawPaper, drawFinish } from './backdrop.js';
import { C } from './style.js';
import { F } from './type.js';

export function drawSheet(ctx, n) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawPaper(ctx, { x: 960, y: 540, zoom: 1 });
  if (n === 0) {
    const poses = [
      ['neutral', {}],
      ['curious peek', { yaw: 0.6, rot: 0.18, wide: 0.15 }],
      ['sly smirk', { yaw: 0.15, lid: 0.38, lidTilt: 0.3, smile: 0.85, smirk: 0.7 }],
      ['chomp open', { yaw: 0.45, pitch: 0.15, mouthOpen: 1, mouthW: 0.42, smile: 0.3, wide: 0.3, jaw: 0.6 }],
      ['puffed + happy', { puffL: 1, puffR: 1, happy: 1, blush: 0.95, smile: 0.4, mouthW: 0.1, chew: 0.6 }],
      ['wide eyes "o"', { wide: 1, eyeScale: 1.12, mouthOpen: 0.32, mouthW: 0.08, sy: 1.06, sx: 0.96 }],
      ['frozen mid-chew', { yaw: 0.4, pitch: 0.5, puffL: 1, puffR: 0.75, wide: 0.6, smile: 0.0, mouthW: 0.1, chew: -0.5 }],
      ['looking at viewer', { puffL: 1, puffR: 0.75, wide: 0.4, smile: 0, mouthW: 0.1, sweat: 0.5 }],
      ['sheepish', { yaw: -0.12, lid: 0.22, smile: 0.45, smirk: -0.3, mouthW: 0.13 }],
      ['content', { happy: 1, smile: 0.85, mouthW: 0.15, blush: 0.85 }],
      ['stretch reach', { yaw: 0.55, pitch: 0.2, reach: 0.95, reachDir: 0.18, mouthOpen: 0.18, mouthW: 0.12, wide: 0.2 }],
      ['squash land', { sx: 1.2, sy: 0.8, happy: 0.7, smile: 0.7 }],
      ['wink', { happyL: 1, smile: 0.9, smirk: 0.5, mouthW: 0.16 }],
      ['held lick', { yaw: 0.3, smile: 1, mouthW: 0.22, smirk: 0.4, tongue: 1, lid: 0.25, lidTilt: 0.2 }],
    ];
    const cols = 5;
    poses.forEach(([label, o], i) => {
      const cx = 200 + (i % cols) * 380;
      const cy = 170 + Math.floor(i / cols) * 340;
      const s = ballState(Object.assign({ x: cx, y: cy, R: 105, ground: cy + 105 }, o));
      drawBall(ctx, s);
      ctx.fillStyle = C.ink;
      ctx.font = `22px ${F.sans}`;
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, cy + 150);
    });
  } else if (n === 1) {
    for (let i = 0; i < 18; i++) {
      const lk = tokenLook(i);
      drawToken(ctx, { x: 120 + i * 95, y: 140, size: 64, rot: (i % 5) * 0.08 - 0.15, alpha: 1, lift: 0, ...lk, contact: 1, groundY: 140 + 32 + 6 });
    }
    drawToken(ctx, { x: 200, y: 330, size: 76, rot: 0.3, flip: 0.4, alpha: 1, lift: 120, ...tokenLook(3) });
    drawStrip(ctx, { x: 620, y: 330, w: 330, h: 72, text: 'Explain this.', unfold: 1, rot: -0.04, alpha: 1 });
    drawStrip(ctx, { x: 1040, y: 330, w: 360, h: 72, text: 'Make it better.', unfold: 0.55, rot: 0.03, alpha: 1 });
    drawStrip(ctx, { x: 1420, y: 330, w: 300, h: 72, text: 'Try again.', unfold: 0.2, rot: 0.0, alpha: 1 });
    drawMeter(ctx, { x: 160, y: 560, w: 540, h: 60, level: 0.62, slosh: 0.3, alpha: 1 }, 1.0);
    drawSpark(ctx, { x: 960, y: 620, r: 34, scale: 1, rot: 0.1, alpha: 1 });
    drawPage(ctx, { x: 1250, y: 720, w: 270, h: 350, morph: 0.5, r: 34, alpha: 1, reveal: 0 }, 1.0);
    drawPage(ctx, { x: 1640, y: 720, w: 270, h: 350, morph: 1, alpha: 1, reveal: 1 }, 1.0);
    drawTwinkle(ctx, 960, 820, 22, 0.5);
  }
  drawFinish(ctx, 0);
}
