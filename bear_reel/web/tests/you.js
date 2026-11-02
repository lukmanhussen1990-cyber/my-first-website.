// Preview poses of YOU (TEST=you). t selects the pose (integer part).
import { YOU_SPOT } from '../layout.js';
export function update(ctx) {
  const you = ctx.W.cast.you, p = you.p, k = Math.floor(ctx.t + 1e-6), t = ctx.t;
  const X = YOU_SPOT.pos[0], Z = YOU_SPOT.pos[1];
  const face = (eyes, brows, mouth) => { p.eyes = eyes; p.brows = brows; p.mouth = mouth; };
  const cam = (pos, target, fov = 30) => ctx.cam.set({ pos, target, fov }).handheld(0);
  ctx.W.set.state.fill = { dir: [0.2, 0.4, 1], intensity: 0.6, color: '#ffe8d8' };
  if (k === 0) { face('happy', 'raised', 'smile'); p.blush = 1; p.handR = [X - 0.32, 1.42, Z + 0.12]; p.handPoseR = 'flat'; p.leanSide = 0.12; cam([X + 0.1, 1.5, Z + 1.6], [X - 0.05, 1.4, Z]); }
  if (k === 1) { const tube = ctx.W.set.props.tpTube; tube.visible = true; tube.position.set(X + 0.02, 1.5, Z + 0.32); tube.rotation.set(0, 0, 0);
    p.gripR = tube; face('stare', 'neutral', 'frown'); cam([X, 1.52, Z + 1.3], [X, 1.48, Z]); }
  if (k === 2) { const ph = t * 14; face('squeeze', 'worried', 'tongue'); p.tongue = 1; p.hairBounce = 1;
    const b = you.backPos ? null : null; // scratch targets behind the lower back
    p.handL = [X + 0.12 + Math.sin(ph) * 0.05, 0.98 + Math.sin(ph * 1.3) * 0.06, Z - 0.16]; p.handR = [X - 0.12 + Math.sin(ph + 2) * 0.05, 0.98 + Math.cos(ph * 1.1) * 0.06, Z - 0.16];
    p.poleL = [1.0, -0.2, -0.6]; p.poleR = [1.0, -0.2, -0.6]; p.handPoseL = p.handPoseR = 'fist'; p.headRoll = Math.sin(ph * 0.7) * 0.15;
    cam([X + 0.6, 1.4, Z + 2.2], [X, 1.2, Z]); }
  if (k === 3) { face('squeeze', 'worried', 'pressed'); p.cheeks = 1; p.red = 0.9; cam([X, 1.55, Z + 0.75], [X, 1.52, Z]); }
  if (k === 4) { face('wide', 'raised', 'scream'); p.crouch = 0.5; p.headYaw = 0.5; cam([X, 1.25, Z + 1.6], [X, 1.15, Z]); }
  if (k === 5) { face('squint', 'neutral', 'neutral'); p.blush = 1; cam([X, 1.55, Z + 0.9], [X, 1.5, Z]); }
}
