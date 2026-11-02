// Shots s11-s20 (the bear stands up -> the bloodhound comparison). See plan.js for timing/content.
import { move, punch, bump, shake, hit, win, face, stinkYou, lookCam, bearWalk, bearFace, light, toward,
  YX, YZ, BP, clamp, lerp, smooth, smoother, invLerp, easeOut, easeIn, easeInOut, easeOutBack, noise1, v3 } from './shotlib.js';
import { COMPARE, SUN } from './layout.js';

// solve the animals now (pure function of p), so the shot can aim the camera at their real head/nose positions
const solve = (ctx) => ctx.W.animals.commit(ctx);
const sniffPulse = (t, t0, dur = 0.32) => (t >= t0 && t < t0 + dur ? Math.sin(Math.PI * (t - t0) / dur) : 0);

export const shots = {
  // ---------------------------------------------------------------- s11 "A really big bear."
  s11: { update(ctx) {
    const t = ctx.t, bear = ctx.W.animals.bear, p = bear.p;
    p.pos = BP.enter.slice(); p.rotY = Math.PI; p.gait = 'idle';
    p.stance = easeInOut(invLerp(ctx.ev('rise'), ctx.ev('rise') + 0.7, t));
    bearFace(ctx, 'open', 'angry', t > ctx.ev('growl') - 0.15 ? 'growl' : 'closed'); p.ears = 1;
    const k = smoother(ctx.u);
    ctx.cam.set({ pos: [BP.enter[0] + 0.55, 0.14, BP.enter[1] - 1.75], target: [BP.enter[0], lerp(0.7, 3.1, k), BP.enter[1] - 0.2], fov: 56 }).handheld(0.0015);
    hit(ctx, ctx.ev('growl'), 0.005, 0.5, 14);
    ctx.W.set.state.skyDark = 0.25; ctx.W.set.state.rays = 0.7;
    ctx.post.vignette = 0.3;
    light(ctx, [BP.enter[0], 1.5, BP.enter[1]], 6, 0.4);
  } },

  // ---------------------------------------------------------------- s12 "It stops."
  s12: { update(ctx) {
    const t = ctx.t, bear = ctx.W.animals.bear, p = bear.p, stop = ctx.ev('stop');
    // last step, then frozen mid-step with the front-right paw up
    const walking = t < stop;
    bearWalk(ctx, [BP.stop[0] - 0.05, BP.stop[1] + 0.9], BP.stop, walking ? invLerp(ctx.shot.t0, stop, t) : 1, { stride: 1.5 });
    if (!walking) { p.gait = 'idle'; p.pawLift = { leg: 'FR', amount: easeOutBack(invLerp(stop - 0.05, stop + 0.12, t)) }; }
    bearFace(ctx, 'wide', 'raised', 'closed'); p.ears = 1;
    p.headPitch = lerp(-0.05, 0.22, smooth(invLerp(stop - 0.1, stop + 0.2, t)));
    p.headYaw = 0.12 * smooth(invLerp(stop + 0.2, stop + 0.6, t));
    move(ctx, { pos: [2.9, 1.15, BP.stop[1] - 2.6], target: [BP.stop[0], 1.15, BP.stop[1]], fov: 36 },
              { pos: [2.8, 1.15, BP.stop[1] - 2.5], target: [BP.stop[0], 1.18, BP.stop[1]], fov: 35 });
    punch(ctx, stop, 1.12);
    ctx.W.set.state.skyDark = 0.2;
    light(ctx, [BP.stop[0], 1, BP.stop[1]], 5, 0.45);
  } },

  // ---------------------------------------------------------------- s13 "It sniffs the air." (KEY)
  s13: { update(ctx) {
    const t = ctx.t, bear = ctx.W.animals.bear, p = bear.p;
    const s1 = ctx.ev('sniffs')[0], s2 = s1 + 0.45;   // the 2 sniffs inside the chosen sniff sound (make_sfx.py)
    p.pos = BP.stop.slice(); p.rotY = Math.PI; p.gait = 'idle';
    bearFace(ctx, 'open', 'neutral', 'closed'); p.ears = 1; p.headPitch = 0.32;
    const sn = Math.max(sniffPulse(t, s1 - 0.02, 0.36), sniffPulse(t, s2 - 0.02, 0.36));
    p.sniff = sn;
    solve(ctx);
    const nose = bear.nosePos(), head = bear.headPos();
    const fwd = nose.clone().sub(head).normalize();
    const cam = nose.clone().addScaledVector(fwd, 0.62).add(v3(0.03, -0.02, 0));
    ctx.cam.set({ pos: cam.toArray(), target: nose.clone().add(v3(0, 0.005, 0)).toArray(), fov: lerp(30, 27, ctx.u) }).handheld(0.0012);
    bump(ctx, s1, 1.06, 0.25); bump(ctx, s2, 1.06, 0.25);
    ctx.W.fx.swirl({ to: nose.toArray(), t, amount: 0.4 + 0.6 * sn, radius: 0.22, seed: 3 });
    ctx.W.fx.glint({ at: nose.clone().add(v3(0.02, 0.04, 0)).addScaledVector(fwd, 0.02).toArray(), t, size: 0.025 });
    light(ctx, head.toArray(), 3, 0.55);
  } },

  // ---------------------------------------------------------------- s14 "Then it walks straight toward you."
  s14: { update(ctx) {
    const t = ctx.t, bear = ctx.W.animals.bear, p = bear.p, you = ctx.W.cast.you, yp = you.p;
    bearWalk(ctx, [BP.stop[0], BP.stop[1] - 0.4], [BP.near[0] - 0.2, BP.near[1] + 2.0], ctx.u, { stride: 1.5 });
    bearFace(ctx, 'open', 'angry', 'closed'); p.ears = 1; p.headPitch = -0.08;
    p.lookAt = [YX, 1.4, YZ];
    yp.crouch = 0.22; face(ctx, 'stare', 'raised', 'tight'); yp.lookAt = bear.headPos ? [BP.near[0], 1.3, BP.near[1] + 3] : null;
    for (const s of ctx.ev('steps')) hit(ctx, s, 0.003, 0.15, 17);
    move(ctx, { pos: [YX - 0.32, 1.58, YZ - 0.75], target: [BP.stop[0] - 0.3, 1.05, BP.stop[1] - 1.5], fov: 34 },
              { pos: [YX - 0.3, 1.57, YZ - 0.62], target: [BP.near[0] - 0.2, 1.05, BP.near[1] + 2.5], fov: 31 });
    ctx.W.set.state.skyDark = 0.2;
    light(ctx, [0, 1, 4], 8, 0.35);
  } },

  // ---------------------------------------------------------------- s15 "You can't run."
  s15: { update(ctx) {
    const t = ctx.t, you = ctx.W.cast.you, p = you.p;
    p.crouch = 0.42; face(ctx, 'wide', 'raised', 'scream'); p.shoulderUp = 1; p.hairBounce = 0.4;
    // looks left, right, left fast
    p.headYaw = 0.55 * Math.sin((t - ctx.shot.t0) * 11);
    p.pupils = [Math.sign(Math.sin((t - ctx.shot.t0) * 11)) * 0.8, 0];
    ctx.W.fx.sweatBurst({ ch: you, t0: ctx.shot.t0 + 0.12, t, count: 7 });
    move(ctx, { pos: [YX + 0.14, 1.42, 1.45], target: [YX, 1.36, YZ], fov: 29 }, { pos: [YX + 0.12, 1.42, 1.33], target: [YX, 1.36, YZ], fov: 28 });
    shake(ctx, ctx.shot.t0, ctx.shot.t1, 0.004, 24);
    stinkYou(ctx, 0.35);
    light(ctx, [0, 1.2, 0], 4, 0.45);
  } },

  // ---------------------------------------------------------------- s16 "You're not done yet."
  s16: { update(ctx) {
    const you = ctx.W.cast.you, p = you.p, ev = ctx.ev('punch');
    p.crouch = 0.35; face(ctx, 'squint', 'neutral', 'neutral'); p.blush = 1;
    lookCam(ctx, you);
    ctx.W.fx.sweat({ ch: you, side: 'L', t0: ctx.shot.t0 + 0.2, t: ctx.t, size: 0.9 });
    ctx.cam.set({ pos: [YX + 0.05, 1.47, 1.35], target: [YX, 1.45, YZ], fov: 21 }).handheld(0.0008);
    punch(ctx, ev, 1.22, 0.05);
    light(ctx, [0, 1.3, 0], 4, 0.5);
  } },

  // ---------------------------------------------------------------- s17 "You hold your breath."
  s17: { update(ctx) {
    const t = ctx.t, you = ctx.W.cast.you, p = you.p, puff = ctx.ev('puff');
    p.crouch = 0.35; face(ctx, 'squeeze', 'worried', 'pressed');
    const beats = [22.95, 23.3, ...ctx.ev('beats')];
    let wob = 0; for (const b of beats) wob = Math.max(wob, t >= b && t < b + 0.18 ? Math.sin(Math.PI * (t - b) / 0.18) : 0);
    p.cheeks = easeOutBack(invLerp(puff - 0.15, puff + 0.12, t)) * (1 + 0.12 * wob);
    p.red = smooth(invLerp(puff, ctx.shot.t1 - 0.1, t));
    if (t < puff - 0.15) { p.eyes = 'wide'; p.mouth = 'tight'; }
    ctx.W.fx.sweat({ ch: you, side: 'L', t0: puff + 0.2, t, size: 0.9 });
    ctx.W.fx.sweat({ ch: you, side: 'R', t0: puff + 0.55, t, size: 0.8 });
    ctx.cam.set({ pos: [YX + 0.04, 1.47, 1.0], target: [YX, 1.45, YZ], fov: lerp(18, 13.5, smooth(ctx.u)) }).handheld(0.0006);
    for (const b of beats) bump(ctx, b, 1.03, 0.16);
    ctx.post.vignette = 0.35 * smooth(invLerp(puff, ctx.shot.t1, t));
    light(ctx, [0, 1.3, 0], 4, 0.5);
  } },

  // ---------------------------------------------------------------- s18 "What you don't know:"
  s18: { update(ctx) {
    ctx.W.cast.you.p.visible = false;
    ctx.W.animals.bear.p.visible = false;
    move(ctx, { pos: [-9, 27, -12], target: [12, 9, 30], fov: 46 }, { pos: [-7.5, 26.5, -9], target: [12, 9, 30], fov: 45 }, (u) => u);
    ctx.cam.handheld(0.0008);
    const s = ctx.W.set.state; s.rays = 1.0; s.fog = { ...s.fog, near: 40, far: 220 };
    light(ctx, [0, 8, 14], 30, 0.15);
  } },

  // ---------------------------------------------------------------- s19 "bears can smell about seven times"
  s19: { update(ctx) {
    const t = ctx.t, A = ctx.W.animals, bear = A.bear, dog = A.dog, x7 = ctx.ev('x7');
    ctx.W.cast.you.p.visible = false;
    const cx = COMPARE.pos[0], cz = COMPARE.pos[1];
    bear.p.pos = [cx - 1.05, cz - 0.35]; bear.p.rotY = 0.12; bear.p.sit = 1; bear.p.gait = 'idle';
    bearFace(ctx, t > x7 ? 'happy' : 'open', 'raised', 'closed'); bear.p.headPitch = 0.12;
    bear.p.sniff = Math.max(sniffPulse(t, 25.75, 0.3), sniffPulse(t, 26.05, 0.3)) * 0.8;
    dog.p.visible = true; dog.p.pos = [cx + 0.95, cz + 0.05]; dog.p.rotY = -0.12; dog.p.sit = 1;
    dog.p.eyes = 'open'; dog.p.brows = 'neutral'; dog.p.headYaw = 0; dog.p.headPitch = 0.05;
    solve(ctx);
    const nose = bear.nosePos();
    move(ctx, { pos: [cx - 0.05, 1.45, cz + 6.6], target: [cx - 0.05, 1.25, cz], fov: 38 }, { pos: [cx - 0.05, 1.42, cz + 6.2], target: [cx - 0.05, 1.27, cz], fov: 37 });
    bump(ctx, x7, 1.06, 0.3);
    if (t >= x7 - 0.02) ctx.W.fx.badge({ text: 'x7', at: [nose.x + 0.62, nose.y + 0.42, nose.z + 0.15], t0: x7 - 0.02, t, size: 0.9 });
    ctx.W.set.state.rays = 0.6;
    light(ctx, [cx, 1, cz], 6, 0.45, [0.1, 0.6, 1]);
  } },

  // ---------------------------------------------------------------- s20 "better than a bloodhound."
  s20: { update(ctx) {
    const t = ctx.t, A = ctx.W.animals, bear = A.bear, dog = A.dog;
    ctx.W.cast.you.p.visible = false;
    const cx = COMPARE.pos[0], cz = COMPARE.pos[1];
    bear.p.pos = [cx - 1.05, cz - 0.35]; bear.p.rotY = 0.12; bear.p.sit = 1; bear.p.gait = 'idle';
    bearFace(ctx, 'happy', 'raised', 'closed'); bear.p.headPitch = 0.12;
    dog.p.visible = true; dog.p.pos = [cx + 0.95, cz + 0.05]; dog.p.rotY = -0.12; dog.p.sit = 1;
    dog.p.eyes = 'sad'; dog.p.brows = 'sad'; dog.p.mouth = 'closed';
    solve(ctx);
    dog.p.lookAt = bear.headPos().toArray();
    solve(ctx);
    const dh = dog.headPos();
    move(ctx, { pos: [dh.x + 0.55, dh.y - 0.05, dh.z + 1.25], target: [dh.x - 0.05, dh.y + 0.08, dh.z], fov: 34 },
              { pos: [dh.x + 0.5, dh.y - 0.04, dh.z + 1.1], target: [dh.x - 0.05, dh.y + 0.08, dh.z], fov: 33 });
    ctx.W.fx.sweat({ ch: dog, side: 'L', t0: ctx.ev('dog') - 0.2, t, size: 1.1 });
    light(ctx, [cx, 1, cz], 6, 0.5, [0.3, 0.5, 1]);
  } },
};
