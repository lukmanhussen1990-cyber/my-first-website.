// close-ups: ?test=faces  t = 0 YOU beanie | 1 YOU puppy | 2 YOU wet | 3 YOU dizzy | 4 rich smug | 5 rich laugh | 6 youRobe smile | 7 YOU floor sit
export function update(ctx) {
  const c = ctx.W.cast, t = ctx.t, m = Math.floor(t);
  const you = c.you, rich = c.rich, yr = c.youRobe;
  let ch = you;
  if (m === 4 || m === 5) ch = rich;
  if (m === 6) ch = yr;
  const p = ch.p; p.visible = true; p.pos = [0, 0]; p.rotY = 0.25; p.y = 0;
  if (m === 0) { p.brows = 'worried'; p.mouth = 'frown'; }
  if (m === 1) { p.eyes = 'puppy'; p.brows = 'sad'; p.mouth = 'pressed'; p.handL = ch.local(0.02, 1.25, 0.28).toArray(); p.handR = ch.local(-0.02, 1.25, 0.28).toArray(); p.handPoseL = p.handPoseR = 'flat'; }
  if (m === 2) { p.wet = 1; p.hatOn = false; p.eyes = 'squint'; p.mouth = 'tight'; p.brows = 'neutral'; }
  if (m === 3) { p.eyes = 'dizzy'; p.mouth = 'open'; p.hatOn = false; p.wet = 1; }
  if (m === 4) { p.mouth = 'smile'; p.brows = 'raised'; p.eyes = 'squint'; }
  if (m === 5) c.helpers.laugh(ch, t, 1);
  if (m === 6) { p.mouth = 'smile'; p.blush = 1; }
  if (m === 7) { p.sit = 1; p.seatY = 0.06; p.legs = 'floor'; p.lean = -0.18; p.brows = 'sad'; p.mouth = 'frown'; }
  ctx.W.cast.commit(ctx);
  const hp = ch.headPos();
  const far = m === 7 ? 2.6 : 0.95;
  ctx.cam.set({ pos: [hp.x + 0.25 * far, hp.y + (m === 7 ? 0.3 : 0.0), hp.z + far], target: [hp.x, hp.y - (m === 7 ? 0.45 : 0.12), hp.z], fov: 35 });
  ctx.W.set.state.center = [0, 1, 0];
}
