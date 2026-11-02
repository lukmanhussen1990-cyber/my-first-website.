// Shots 1-11: the street, the shops, the knock, the mansion, the door opens, the rich guy, "Toilet."
import { clamp, lerp, smooth, easeOut, easeInOut, easeOutBack, noise1, v3, move, punch, bump, shake, hit, win, after, YOU, RICH, face, show, pose, light, lookCam, toward,
  STREET, MANSION, PORCH_SPOT, DOORWAY_SPOT, FY } from './shotlib.js';

// world point from a character's local frame (x = its left, z = forward), using p (no matrices)
export const L = (ch, lx, ly, lz) => { const p = ch.p, c = Math.cos(p.rotY), s = Math.sin(p.rotY); return [p.pos[0] + lx * c + lz * s, p.y + ly, p.pos[1] - lx * s + lz * c]; };
const SIT = (ctx) => { const you = YOU(ctx), p = show(you, STREET.sit.pos, STREET.sit.rotY, STREET.sideY); p.sit = 1; p.seatY = STREET.sideY + 0.06; p.legs = 'floor'; p.lean = -0.12; return you; };
// knock: fist at the door, pulled back between knocks
function knock(ctx, you, kts, side = 'R') {
  let d = 9; for (const k of kts) d = Math.min(d, Math.abs(ctx.t - k) * (ctx.t < k ? 1.0 : 0.8));
  const pull = clamp(d / 0.11);
  const hand = [PORCH_SPOT.pos[0] + (side === 'R' ? -0.12 : 0.3), FY + 1.32 + pull * 0.04, 99.96 - 0.2 * smooth(pull)];
  if (side === 'R') { you.p.handR = hand; you.p.handPoseR = 'fist'; } else { you.p.handL = hand; you.p.handPoseL = 'fist'; }
}

export const shots = {
  // 1. "You're homeless."  YOU sits on cardboard against a brick wall, pigeons. Slow push-in.
  s01: { update(ctx) {
    const you = SIT(ctx), p = you.p;
    face(you, 'open', 'sad', 'frown'); p.headPitch = -0.16; p.shoulderUp = -0.4;
    p.handL = L(you, 0.13, 0.5, 0.36); p.handR = L(you, -0.13, 0.5, 0.36);
    if (ctx.t > 0.9) p.headPitch = -0.05;
    move(ctx, { pos: [-1.95, 1.05, -3.05], target: [-2.2, 0.66, -0.45], fov: 42 }, { pos: [-2.0, 1.0, -2.55], target: [-2.2, 0.7, -0.45], fov: 40 });
    light(ctx, [-2.2, 0.6, -0.8], 4, 0.45);
  } },
  // 2. "You really need to poop."  close-up: eyes go wide, both hands grab the belly, rumble lines, sweat, punch-in.
  s02: { update(ctx) {
    const you = SIT(ctx), p = you.p, cl = ctx.ev('clutch'), rb = ctx.ev('rumble');
    face(you, 'open', 'sad', 'frown'); p.headPitch = -0.05; p.shoulderUp = -0.3;
    const k = after(ctx.t, cl - 0.05, 0.18);
    if (ctx.t > cl - 0.05) { face(you, 'wide', 'worried', 'grimace'); p.shoulderUp = 0.6; p.lean = -0.04; }
    if (ctx.t > rb + 0.25) { face(you, 'squeeze', 'worried', 'grimace'); p.red = 0.35; }
    const hl = L(you, 0.13, 0.5, 0.36), hr = L(you, -0.13, 0.5, 0.36);
    const bl = L(you, 0.07, 0.5, 0.17), br = L(you, -0.07, 0.48, 0.17);
    p.handL = hl.map((v, i) => lerp(v, bl[i], k)); p.handR = hr.map((v, i) => lerp(v, br[i], k));
    p.handPoseL = p.handPoseR = k > 0.5 ? 'flat' : 'relaxed';
    if (ctx.t > rb) { p.headYaw = Math.sin(ctx.t * 38) * 0.03; }
    move(ctx, { pos: [-2.15, 0.95, -1.85], target: [-2.2, 0.76, -0.6], fov: 40 }, { pos: [-2.15, 0.94, -1.7], target: [-2.2, 0.76, -0.6], fov: 40 });
    punch(ctx, rb, 1.16, 0.08); hit(ctx, rb, 0.012, 0.3);
    pose(ctx);
    ctx.W.fx.rumble({ at: you.bellyPos().toArray(), t0: rb, count: 6, radius: 0.13, size: 0.08, color: '#6a4a24', dur: 1.0 });
    ctx.W.fx.sweat({ ch: you, t0: rb + 0.05, size: 1.1 });
    light(ctx, [-2.2, 0.7, -0.6], 3, 0.5);
  } },
  // 3. "Every shop says"  the cafe owner in his doorway points at the CUSTOMERS ONLY sign; YOU in front of him.
  s03: { update(ctx) {
    const cafe = ctx.W.cast.cafe, you = YOU(ctx), sh = STREET.shops[0];
    show(cafe, [sh.x + 0.7, -0.42], Math.PI - 0.25, STREET.sideY);
    const yp = show(you, [sh.x - 0.25, -1.25], 0.85, STREET.sideY);
    face(you, 'open', 'worried', 'tight'); yp.handL = L(you, 0.07, 1.02, 0.17); yp.handPoseL = 'flat'; yp.shoulderUp = 0.4;
    yp.lookAt = [sh.x + 0.7, 1.7, -0.42];
    const pt = ctx.ev('point'), k = after(ctx.t, pt - 0.2, 0.22);
    face(cafe, 'open', 'angry', 'frown');
    const sign = [sh.x + 1.85, 1.62, -0.06];
    cafe.p.handR = [lerp(sh.x + 0.85, sign[0] - 0.18, k), lerp(1.05, sign[1], k), lerp(-0.62, sign[2] - 0.05, k)]; cafe.p.handPoseR = k > 0.3 ? 'point' : 'relaxed';
    cafe.p.handL = L(cafe, 0.2, 1.0, 0.05); cafe.p.handPoseL = 'fist';     // fist on the hip
    cafe.p.lookAt = [yp.pos[0], 1.6, yp.pos[1]];
    if (ctx.t > pt + 0.1) cafe.p.headYaw = 0.15;
    move(ctx, { pos: [3.55, 1.66, -3.05], target: [5.85, 1.44, -0.2], fov: 46 }, { pos: [3.7, 1.64, -2.85], target: [5.9, 1.44, -0.2], fov: 44 });
    bump(ctx, pt, 1.05);
    light(ctx, [5, 1, -0.8], 4, 0.4);
    ctx.W.fx.glint({ at: [sign[0], sign[1] + 0.18, sign[2] - 0.03], t0: pt + 0.1, size: 0.12 });
  } },
  // 4. "customers only."  along the shop row: the pizza chef and the store clerk point at the same sign.
  s04: { update(ctx) {
    const chef = ctx.W.cast.chef, clerk = ctx.W.cast.clerk, s1 = STREET.shops[1], s2 = STREET.shops[2];
    show(chef, [s1.x + 0.7, -0.42], Math.PI + 0.35, STREET.sideY); show(clerk, [s2.x + 0.7, -0.42], Math.PI + 0.45, STREET.sideY);
    const n1 = ctx.ev('no1'), n2 = ctx.ev('no2');
    for (const [ch, sh, t0] of [[chef, s1, n1], [clerk, s2, n2]]) {
      const k = after(ctx.t, t0 - 0.16, 0.16), sign = [sh.x + 1.85, 1.62, -0.06];
      face(ch, 'open', ctx.t > t0 - 0.1 ? 'angry' : 'neutral', ctx.t > t0 - 0.1 ? 'frown' : 'neutral');
      ch.p.handR = [lerp(sh.x + 0.85, sign[0] - 0.2, k), lerp(1.0, sign[1] + 0.02, k), lerp(-0.62, sign[2] - 0.05, k)]; ch.p.handPoseR = k > 0.3 ? 'point' : 'relaxed';
      ch.p.lookAt = ctx.cam.spec.pos;
      if (ctx.t > t0) ch.p.headRoll = -0.08;
    }
    // on the chef for "customers", fast pan to the clerk for "only"
    const pan = smooth(clamp((ctx.t - (n2 - 0.23)) / 0.2));
    ctx.cam.set({ pos: [lerp(10.6, 15.6, pan), 1.66, lerp(-3.0, -3.2, pan)], target: [lerp(s1.x + 0.75, s2.x + 1.0, pan), 1.38, -0.3], fov: lerp(46, 44, pan) });
    for (const ch of [chef, clerk]) ch.p.lookAt = ctx.cam.spec.pos;
    bump(ctx, n1, 1.05); bump(ctx, n2, 1.06);
    light(ctx, [14, 1, -0.8], 8, 0.4);
  } },
  // 5. "So you knock"  close-up of YOU's fist knocking twice on the giant golden door.
  s05: { update(ctx) {
    const you = YOU(ctx), p = show(you, PORCH_SPOT.pos, PORCH_SPOT.rotY, FY);
    face(you, 'open', 'worried', 'tight'); p.handL = L(you, 0.08, 1.02, 0.16); p.handPoseL = 'flat';
    const kts = ctx.ev('knocks'); knock(ctx, you, kts);
    p.headPitch = 0.06;
    move(ctx, { pos: [-1.1, FY + 1.62, 99.3], target: [0.0, FY + 1.38, 99.92], fov: 42 }, { pos: [-1.0, FY + 1.6, 99.42], target: [0.0, FY + 1.38, 99.92], fov: 40 });
    for (const k of kts) hit(ctx, k, 0.008, 0.12);
    light(ctx, [0, FY + 1, 99.5], 3, 0.35);
  } },
  // 6. "on the only door left."  low from behind: YOU tiny in front of the giant door, knocks once more.
  s06: { update(ctx) {
    const you = YOU(ctx), p = show(you, PORCH_SPOT.pos, PORCH_SPOT.rotY, FY);
    face(you, 'open', 'worried', 'tight'); p.headPitch = 0.3;
    knock(ctx, you, [ctx.ev('knock')]);
    p.handL = L(you, 0.08, 1.02, 0.16); p.handPoseL = 'flat';
    move(ctx, { pos: [-1.2, FY + 0.7, 96.3], target: [0.15, FY + 3.5, 100], fov: 54 }, { pos: [-1.0, FY + 0.75, 96.8], target: [0.15, FY + 3.6, 100], fov: 52 });
    hit(ctx, ctx.ev('knock'), 0.006, 0.14);
    light(ctx, [0, FY + 2, 99], 6, 0.3);
  } },
  // 7. "A mansion."  crane up and back: the whole mansion at sunset, YOU tiny at the door.
  s07: { update(ctx) {
    const you = YOU(ctx); show(you, PORCH_SPOT.pos, PORCH_SPOT.rotY, FY); you.p.headPitch = 0.4;
    move(ctx, { pos: [0.6, 2.6, 91.5], target: [0, 6.2, 100], fov: 52 }, { pos: [1.5, 15.5, 66], target: [0, 7.4, 100], fov: 48 }, easeOut);
    ctx.W.fx.glint({ at: [0, FY + 14.8, 97.4], t0: ctx.ev('reveal'), size: 0.9 });
    ctx.W.fx.glint({ at: [-2.0, FY + 3.4, 99.8], t0: ctx.ev('reveal') + 0.25, size: 0.5 });
    light(ctx, [0, 4, 95], 22, 0.25);
  } },
  // 8. "The door opens."  over YOU's shoulder: the giant doors swing open, golden light floods out.
  s08: { update(ctx) {
    const you = YOU(ctx), p = show(you, PORCH_SPOT.pos, PORCH_SPOT.rotY, FY);
    const op = ctx.ev('open');
    ctx.W.set.state.frontDoor = clamp((ctx.t - op) / 0.75);
    face(you, 'wide', 'raised', 'o'); p.lean = -0.05 * after(ctx.t, op, 0.3); p.headPitch = 0.2;
    p.handL = L(you, 0.18, 1.0, 0.1); p.handR = L(you, -0.18, 1.0, 0.1);
    move(ctx, { pos: [-0.6, FY + 1.82, 98.05], target: [0.1, FY + 1.85, 101.0], fov: 52 }, { pos: [-0.55, FY + 1.8, 98.3], target: [0.1, FY + 1.85, 101.0], fov: 50 });
    const k = after(ctx.t, op, 0.5);
    ctx.W.fx.glow({ at: [0, FY + 2.4, 101.2], size: 3.2 * k, amount: k, opacity: 0.3, color: '#ffd890' });
    ctx.post.flash = 0.18 * Math.max(0, 1 - Math.abs(ctx.t - op - 0.25) / 0.2); ctx.post.flashColor = [1, 0.9, 0.6];
    for (let i = 0; i < 4; i++) ctx.W.fx.glint({ at: [-1.2 + i * 0.8, FY + 1.2 + (i % 2) * 1.3, 100.3], t0: op + 0.25 + i * 0.07, size: 0.22 });
    light(ctx, [0, FY + 1, 99], 4, 0.25, { fillDir: [0, 0.2, 1], fillColor: '#ffd890' });
    ctx.W.set.state.fill.intensity = 0.25 + 0.5 * k;
  } },
  // 9. "A rich guy."  low angle from YOU's eye level: the rich guy in the doorway, gold light behind him, espresso.
  s09: { update(ctx) {
    const rich = RICH(ctx), p = show(rich, DOORWAY_SPOT.pos, DOORWAY_SPOT.rotY, FY);
    face(rich, 'open', 'raised', 'smile'); p.headPitch = -0.12;
    const esp = ctx.W.set.props.espresso; esp.visible = true; esp.position.set(0.24, FY + 1.06, 100.68); esp.rotation.set(0, Math.PI, 0);
    p.gripR = { prop: esp, pose: 'grip' };
    p.handL = L(rich, 0.2, 1.0, 0.06); p.handPoseL = 'relaxed';
    move(ctx, { pos: [0.35, FY + 1.4, 98.7], target: [0.0, FY + 1.6, 101], fov: 46 }, { pos: [0.32, FY + 1.42, 99.0], target: [0.0, FY + 1.64, 101], fov: 44 });
    pose(ctx);
    ctx.W.fx.glint({ at: rich.mouthPos().add(v3(0.03, 0.01, -0.05)).toArray(), t0: ctx.ev('glint'), size: 0.09 });
    ctx.W.fx.glow({ at: [0, FY + 2.0, 103.5], size: 2.2, opacity: 0.25, color: '#ffd080' });
    light(ctx, [0, FY + 1, 100.5], 3, 0.4, { fillColor: '#ffe2c0' });
  } },
  // 10. "In a gold bathrobe."  tilt up from the fluffy gold slippers to his smug face, sparkles on the robe.
  s10: { update(ctx) {
    const rich = RICH(ctx), p = show(rich, DOORWAY_SPOT.pos, DOORWAY_SPOT.rotY, FY);
    face(rich, ctx.t > 14.4 ? 'squint' : 'open', 'raised', 'smile'); p.headPitch = -0.1;
    const esp = ctx.W.set.props.espresso; esp.visible = true; esp.position.set(0.24, FY + 1.06, 100.68); esp.rotation.set(0, Math.PI, 0);
    p.gripR = { prop: esp, pose: 'grip' }; p.handL = L(rich, 0.2, 1.0, 0.06);
    const u = easeInOut(ctx.u);
    ctx.cam.set({ pos: [0.18, FY + lerp(0.55, 1.5, u), 99.25], target: [0, FY + lerp(0.12, 1.6, u), 101], fov: 40 });
    const g = ctx.ev('gold');
    const spots = [[0.12, 0.5, 100.82], [-0.14, 0.85, 100.84], [0.08, 1.15, 100.86], [-0.2, 0.25, 100.85], [0.16, 0.05, 100.9]];
    spots.forEach((s2, i) => ctx.W.fx.glint({ at: [s2[0], FY + s2[1], s2[2]], t0: g + i * 0.08, size: 0.08 }));
    ctx.W.fx.glow({ at: [0, FY + 2.0, 103.5], size: 2.2, opacity: 0.22, color: '#ffd080' });
    light(ctx, [0, FY + 1, 100.5], 3, 0.4, { fillColor: '#ffe2c0' });
  } },
  // 11. "You say: 'Toilet.'"  close-up of YOU from the doorway, the sunset garden behind him; he says it.
  s11: { update(ctx) {
    const you = YOU(ctx), p = show(you, PORCH_SPOT.pos, PORCH_SPOT.rotY, FY);
    face(you, 'open', 'worried', 'tight'); p.shoulderUp = 0.3; p.headPitch = 0.12;
    const say = ctx.ev('say');
    if (ctx.t > say - 0.03 && ctx.t < say + 0.5) { ctx.W.cast.helpers.talk(you, ctx.t, 1); p.mouth = 'tight'; }
    p.handL = L(you, 0.03, 1.12, 0.26); p.handR = L(you, -0.03, 1.12, 0.26); p.handPoseL = p.handPoseR = 'flat';
    move(ctx, { pos: [0.06, FY + 1.6, 100.7], target: [0.15, FY + 1.48, 99.42], fov: 42 }, { pos: [0.08, FY + 1.6, 100.55], target: [0.15, FY + 1.5, 99.42], fov: 40 });
    bump(ctx, say, 1.05);
    ctx.W.fx.sweat({ ch: you, t0: ctx.shot.t0 + 0.2, size: 1.0 });
    light(ctx, [0.15, FY + 1, 99.4], 3, 0.55, { fillColor: '#ffd8a8', fillDir: [0, 0.3, 1] });
  } },
};
