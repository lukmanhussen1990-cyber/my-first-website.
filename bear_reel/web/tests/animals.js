// Test previews for animals.js: t = case index (render with `node render.mjs times <dir> 1 2 3 ...`).
// Every case poses the animals and sets the camera.
const P = [0, 0];   // test spot (stub set: clear of trees around (0, 6))
const AT = [0, 6];
function hideSetClutter(ctx) {
  const s = ctx.W.set;
  if (!s || !s.group) return;
  s.group.children.forEach((c) => { if (c.isMesh && c.geometry && c.geometry.type === 'PlaneGeometry' && c.geometry.parameters.width > 100) return; if (c.isLight || c.isObject3D && c.type === 'Object3D') return; if (c !== s.props.sun && c !== s.props.hemi && c !== s.props.fill) c.visible = false; });
}
const cam = (ctx, pos, target, fov = 40) => { ctx.cam.set({ pos, target, fov }); ctx.cam.handheld(0); };
const rel = (b, x, y, z) => [AT[0] + x, y, AT[1] + z];

const CASES = {
  // 1-4: side view walk at several phases
  1: (ctx, b) => { b.p.gait = 'walk'; b.p.phase = 0.0; b.p.rotY = Math.PI / 2; cam(ctx, rel(b, 0, 1.3, 7.5), rel(b, 0, 1.0, 0), 40); },
  2: (ctx, b) => { b.p.gait = 'walk'; b.p.phase = 0.25; b.p.rotY = Math.PI / 2; cam(ctx, rel(b, 0, 1.3, 7.5), rel(b, 0, 1.0, 0), 40); },
  3: (ctx, b) => { b.p.gait = 'walk'; b.p.phase = 0.5; b.p.rotY = Math.PI / 2; cam(ctx, rel(b, 0, 1.3, 7.5), rel(b, 0, 1.0, 0), 40); },
  4: (ctx, b) => { b.p.gait = 'walk'; b.p.phase = 0.75; b.p.rotY = Math.PI / 2; cam(ctx, rel(b, 0, 1.3, 7.5), rel(b, 0, 1.0, 0), 40); },
  // 5: front 3/4
  5: (ctx, b) => { b.p.gait = 'idle'; b.p.rotY = Math.PI; cam(ctx, rel(b, 2.6, 1.4, -4.2), rel(b, 0, 1.0, 0), 42); },
  // 6/7: nose extreme close-up sniff 0/1
  6: (ctx, b) => { b.p.rotY = Math.PI; b.p.headPitch = 0.1; b.p.blink = false; ctx.W.animals.bear.solve(ctx.t); const n = b.nosePos(); cam(ctx, [n.x + 0.02, n.y + 0.03, n.z - 0.42], [n.x, n.y, n.z], 40); },
  7: (ctx, b) => { b.p.rotY = Math.PI; b.p.headPitch = 0.1; b.p.sniff = 1; b.p.blink = false; ctx.W.animals.bear.solve(ctx.t); const n = b.nosePos(); cam(ctx, [n.x + 0.02, n.y + 0.03, n.z - 0.42], [n.x, n.y, n.z], 40); },
  // 8+: face close-ups
  8: (ctx, b) => face(ctx, b, { eyes: 'open' }),
  9: (ctx, b) => face(ctx, b, { eyes: 'wide', brows: 'raised', ears: 1 }),
  10: (ctx, b) => face(ctx, b, { eyes: 'squeeze', tears: 1, green: 1, brows: 'angry', cheeksPuff: 1, mouth: 'pressed' }),
  11: (ctx, b) => face(ctx, b, { eyes: 'squeeze', mouth: 'wail', tears: 0.8, brows: 'sad' }),
  12: (ctx, b) => face(ctx, b, { eyes: 'open', brows: 'sad', tears: 0.7, mouth: 'tremble', green: 0.4 }),
  13: (ctx, b) => face(ctx, b, { eyes: 'happy', brows: 'neutral' }),
  14: (ctx, b) => face(ctx, b, { eyes: 'closed', brows: 'worried', mouth: 'growl' }),
  15: (ctx, b) => face(ctx, b, { eyes: 'open', brows: 'angry', mouth: 'growl', ears: 0 }),
  // standing low angle
  16: (ctx, b) => { b.p.stance = 1; b.p.mouth = 'growl'; b.p.brows = 'angry'; cam(ctx, rel(b, 1.2, 0.3, -4.6), rel(b, 0, 2.1, 0), 50); },
  // sitting + pinch front + 3/4
  17: (ctx, b) => { b.p.sit = 1; b.p.pinch = 1; b.p.eyes = 'squeeze'; b.p.cheeksPuff = 1; b.p.green = 0.8; b.p.tears = 0.8; cam(ctx, rel(b, 0, 1.6, -4.2), rel(b, 0, 1.4, 0), 40); },
  18: (ctx, b) => { b.p.sit = 1; b.p.pinch = 1; b.p.eyes = 'squeeze'; b.p.cheeksPuff = 1; b.p.green = 0.8; cam(ctx, rel(b, -2.4, 1.8, -2.6), rel(b, 0, 1.5, 0), 42); },
  // biped run + flail side
  19: (ctx, b) => { b.p.gait = 'biped_run'; b.p.phase = 0.15; b.p.flail = 1; b.p.mouth = 'wail'; b.p.eyes = 'squeeze'; b.p.rotY = Math.PI / 2; b.p.headYaw = -0.9; cam(ctx, rel(b, 0, 1.8, 8), rel(b, 0, 1.8, 0), 42); },
  20: (ctx, b) => { b.p.gait = 'biped_run'; b.p.phase = 0.6; b.p.flail = 1; b.p.mouth = 'wail'; b.p.eyes = 'squeeze'; b.p.rotY = Math.PI / 2; b.p.headYaw = -0.9; cam(ctx, rel(b, 0, 1.8, 8), rel(b, 0, 1.8, 0), 42); },
  // neck lean down toward a camera at 1.0 m
  21: (ctx, b) => { b.p.neck = 1; b.p.rotY = Math.PI; b.p.lookAt = rel(b, 0, 1.0, -2.6); cam(ctx, rel(b, 0.1, 1.0, -2.6), rel(b, 0, 1.6, 0), 55); },
  // full side idle, standing side, sitting side
  22: (ctx, b) => { b.p.rotY = Math.PI / 2; cam(ctx, rel(b, 0, 1.3, 7.5), rel(b, 0, 1.0, 0), 40); },
  23: (ctx, b) => { b.p.stance = 1; b.p.rotY = Math.PI / 2; cam(ctx, rel(b, 0, 1.8, 9), rel(b, 0, 1.8, 0), 40); },
  24: (ctx, b) => { b.p.sit = 1; b.p.rotY = Math.PI / 2; cam(ctx, rel(b, 0, 1.3, 7.5), rel(b, 0, 1.0, 0), 40); },
  25: (ctx, b) => { b.p.gait = 'walk'; b.p.phase = 0.4; b.p.rotY = Math.PI; cam(ctx, rel(b, 0.6, 0.45, -4.5), rel(b, 0, 1.2, 0), 45); },
  26: (ctx, b) => { b.p.gait = 'idle'; b.p.pawLift = { leg: 'FR', amount: 1 }; b.p.ears = 1; b.p.headPitch = 0.25; b.p.rotY = Math.PI * 0.75; cam(ctx, rel(b, 2.0, 1.4, -4.6), rel(b, 0, 1.0, 0), 42); },
  27: (ctx, b) => { b.p.rotY = Math.PI; b.p.headPitch = 0.1; b.p.blink = false; ctx.W.animals.bear.solve(ctx.t); const n = b.nosePos(); cam(ctx, [n.x - 0.5, n.y + 0.08, n.z - 0.15], [n.x, n.y, n.z + 0.2], 40); },
};
function face(ctx, b, o) {
  Object.assign(b.p, { rotY: Math.PI, blink: false }, o);
  ctx.W.animals.bear.solve(ctx.t);
  const h = b.headPos();
  cam(ctx, [h.x + 0.05, h.y + 0.02, h.z - 1.7], [h.x, h.y - 0.04, h.z], 40);
}

export function update(ctx) {
  hideSetClutter(ctx);
  const A = ctx.W.animals, b = A.bear;
  const k = Math.round(ctx.t);
  b.p.pos = [AT[0], AT[1]];
  b.p.rotY = Math.PI;
  const s = ctx.W.set && ctx.W.set.state;
  if (s) { s.shadow = { center: [AT[0], 1, AT[1]], radius: 6 }; }
  (CASES[k] || CASES[22])(ctx, b);
}
