// Character lineup preview: ?test=cast  (t picks the pose: 0 stand, 1 talk, 2 walk, 3 run, 4 sit, 5 floor-sit, 6 wet, 7 laugh)
export function update(ctx) {
  const c = ctx.W.cast, t = ctx.t;
  const names = ['you', 'youRobe', 'rich', 'cafe', 'chef', 'clerk'];
  const mode = Math.floor(t);
  names.forEach((n, i) => {
    const ch = c[n], p = ch.p;
    p.visible = true; p.pos = [(i - 2.5) * 0.75, 0]; p.rotY = 0.2; p.y = 0;
    if (mode === 1) { p.mouth = 'smile'; c.helpers.talk(ch, t); p.handR = ch.local(-0.25, 1.35, 0.35).toArray(); p.handPoseR = 'point'; }
    if (mode === 2) c.helpers.go(ch, [p.pos[0], -1], [p.pos[0], 1], (t % 1), 'walk');
    if (mode === 3) c.helpers.go(ch, [p.pos[0], -1], [p.pos[0], 1], (t % 1), 'run');
    if (mode === 4) { p.sit = 1; p.seatY = 0.46; }
    if (mode === 5) { p.sit = 1; p.seatY = 0.05; p.legs = 'floor'; p.lean = -0.15; }
    if (mode === 6) { p.wet = 1; p.hatOn = false; p.eyes = 'squint'; p.mouth = 'tight'; }
    if (mode === 7) c.helpers.laugh(ch, t, 1);
  });
  const k = ctx.shot ? 0 : 0;
  ctx.cam.set({ pos: [0.0, 1.2, 9.5], target: [0, 0.95, 0], fov: 38 });
  ctx.W.set.state.center = [0, 1, 0];
}
