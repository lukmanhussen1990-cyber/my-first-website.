// penguins preview: ?test=zoo  t: 0 side by side | 1 heart eyes + flap | 2 egg cracking | 3 chick out
import { PENGUINS } from '../layout.js';
export function update(ctx) {
  const A = ctx.W.animals, t = ctx.t, m = Math.floor(t);
  const s = ctx.W.set.state; s.loc = 'zoo'; s.interior = false; s.shadow = { center: [599.2, 0.3, 0.5], radius: 4 };
  A.roy.p.visible = A.silo.p.visible = true;
  if (m === 1) { A.roy.p.eyes = A.silo.p.eyes = 'heart'; A.roy.p.flapR = 0.8; A.silo.p.flapL = 0.8; A.roy.p.rotY = Math.PI - 1.2; A.silo.p.rotY = Math.PI + 1.2; }
  if (m >= 2) { A.hatch.p.visible = true; A.hatch.p.crack = 1; A.hatch.p.wobble = m === 2 ? 1 : 0; if (m === 3) { A.hatch.p.open = 1; A.hatch.p.chick = 1; A.roy.p.headPitch = -0.5; A.silo.p.headPitch = -0.5; A.roy.p.eyes = A.silo.p.eyes = 'happy'; } }
  const n = PENGUINS.nest;
  ctx.cam.set({ pos: [n[0] + 0.3, 0.95, n[1] - 3.2], target: [n[0], 0.6, n[1]], fov: 38 });
}
