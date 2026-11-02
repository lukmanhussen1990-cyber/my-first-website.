// Line-up of the cast (TEST=lineup): t in s23 (38.6-41.0) -> group A full body, t in s24 (41.0-42.9) -> group B,
// t in s25/s26 -> face close-ups (CLOSE env picks who via the time).
const A = ['you', 'youSuit', 'youGroom', 'youOld', 'lady', 'bride', 'ladyOld'];
const B = ['guard', 'waiter', 'pianist', 'guestM1', 'guestW1', 'guestM2', 'guestW2'];
const FACES = ['you', 'youSuit', 'youOld', 'lady', 'bride', 'ladyOld', 'guard', 'waiter'];
export function update(ctx) {
  const C = ctx.W.cast, t = ctx.t;
  const row = (names, z = 0) => names.forEach((n, i) => {
    const p = C[n].p; p.visible = true; p.pos = [300 + (i - (names.length - 1) / 2) * 0.95, z]; p.rotY = Math.PI; p.y = 0;
  });
  if (t < 41) { row(A); ctx.cam.set({ pos: [300, 1.0, -7.2], target: [300, 0.95, 0], fov: 60 }); }
  else if (t < 42.93) { row(B); ctx.cam.set({ pos: [300, 1.0, -7.2], target: [300, 0.95, 0], fov: 60 }); }
  else {
    const i = Math.min(FACES.length - 1, Math.floor((t - 42.93) / 0.25));
    const n = FACES[i], ch = C[n], p = ch.p; p.visible = true; p.pos = [300, 0]; p.rotY = Math.PI + 0.35; p.y = 0;
    if (n === 'lady' && i === 3) p.glasses = 'on';
    if (n === 'bride') p.glassesLow = 0.8;
    if (n === 'ladyOld') p.glasses = 'up';
    const hy = ch.spec.H * 0.93;
    ctx.cam.set({ pos: [300 - 0.25, hy, -0.85], target: [300, hy - 0.02, 0], fov: 36 });
  }
}
