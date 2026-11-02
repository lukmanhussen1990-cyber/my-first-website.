// Shots s01-s10 (hook -> the bear walks out of the trees). See plan.js for timing/content.
import { move, punch, bump, shake, hit, win, face, stinkYou, lookCam, bearWalk, bearFace, light, toward,
  YX, YZ, BP, clamp, lerp, smooth, smoother, invLerp, easeOut, easeIn, easeInOut, easeOutBack, noise1, v3 } from './shotlib.js';
import { HIDE_TREE, HIDE_BUSH, GIANT_LEAF, BRANCH, BEAR_PATH } from './layout.js';

export const shots = {
  // ---------------------------------------------------------------- s01 "You just pooped in the forest."
  s01: { update(ctx) {
    const you = ctx.W.cast.you, p = you.p, ev = ctx.ev('punch');
    p.pos = [YX - 0.12, YZ - 0.1]; p.leanSide = -0.16; p.lean = 0.04;
    face(ctx, 'happy', 'raised', 'smile'); p.blush = 1;
    p.handR = [HIDE_TREE.pos[0] + 0.40, 1.47, HIDE_TREE.pos[1] + 0.12]; p.handPoseR = 'flat';
    // relieved little sigh: eyes close slowly, shoulders drop
    if (ctx.t < 0.5) p.eyes = 'open';
    p.shoulderUp = 0.6 * (1 - smooth(invLerp(0.3, 1.2, ctx.t)));
    p.headRoll = 0.08 * smooth(invLerp(0.4, 1.4, ctx.t));
    move(ctx, { pos: [-0.62, 1.62, 1.85], target: [-0.02, 1.5, -0.32], fov: 33 },
              { pos: [-0.52, 1.6, 1.5], target: [-0.02, 1.5, -0.32], fov: 31 });
    punch(ctx, ev, 1.12);
    stinkYou(ctx, 0.25 + 0.35 * smooth(invLerp(0.2, 1.6, ctx.t)), { at: [YX + 0.1, 0.85, YZ - 0.12] });
    light(ctx, [0, 1, 0], 6, 0.45);
  } },

  // ---------------------------------------------------------------- s02 "Behind a tree."
  s02: { update(ctx) {
    const you = ctx.W.cast.you, p = you.p;
    p.pos = [YX - 0.12, YZ - 0.1]; p.leanSide = -0.2; face(ctx, 'open', 'raised', 'smile'); p.blush = 1;
    p.handR = [HIDE_TREE.pos[0] + 0.40, 1.47, HIDE_TREE.pos[1] + 0.12]; p.handPoseR = 'flat';
    lookCam(ctx, you);
    move(ctx, { pos: [2.6, 1.6, 4.6], target: [-1.6, 1.5, -3.5], fov: 44 },
              { pos: [2.25, 1.6, 4.45], target: [-1.6, 1.5, -3.5], fov: 43 });
    stinkYou(ctx, 0.45, { at: [YX + 0.1, 0.9, YZ - 0.1], scale: 1.3 });
    ctx.W.set.state.rays = 0.8;
    light(ctx, [-1, 1, -3], 12, 0.3);
  } },

  // ---------------------------------------------------------------- s03 "No toilet paper."
  s03: { update(ctx) {
    const you = ctx.W.cast.you, p = you.p, tube = ctx.W.set.props.tpTube, ev = ctx.ev('punch');
    face(ctx, 'stare', 'neutral', 'frown');
    // the empty tube held up beside his face, tilted toward the camera so we see it is empty
    const lift = easeOut(invLerp(ctx.shot.t0, ctx.shot.t0 + 0.35, ctx.t));
    tube.visible = true;
    tube.scale.setScalar(1.7);                               // cartoon-sized so it reads on a phone
    tube.position.set(YX + 0.17, lerp(1.28, 1.58, lift), YZ + 0.3);
    tube.rotation.set(1.0, 0, -0.35);                         // open end toward the camera: you can see it is empty
    p.gripL = tube; p.poleL = [1.3, -0.7, -0.35];   // left hand (open side of the frame), elbow out and down
    p.lookAt = [YX + 0.17, 1.58, YZ + 0.3];
    if (ctx.t > ev) { p.eyes = 'stare'; p.lookAt = null; p.headPitch = -0.02; lookCam(ctx, you); }
    move(ctx, { pos: [YX + 0.1, 1.6, 1.15], target: [YX + 0.1, 1.55, YZ], fov: 33 },
              { pos: [YX + 0.1, 1.6, 1.05], target: [YX + 0.1, 1.55, YZ], fov: 32 });
    punch(ctx, ev, 1.18);
    if (ctx.t > ev) ctx.W.fx.sweat({ ch: you, side: 'L', t0: ev + 0.02, t: ctx.t, size: 1 });
    light(ctx, [0, 1.4, 0], 4, 0.5);
  } },

  // ---------------------------------------------------------------- s04 "So you grab a leaf."
  s04: { update(ctx) {
    const you = ctx.W.cast.you, p = you.p, leaf = ctx.W.set.props.giantLeaf;
    const grab = ctx.ev('grab'), tear = ctx.ev('tear');
    p.pos = [YX + 0.42, YZ + 0.05]; p.rotY = 0.6; p.lean = 0.3; p.crouch = 0.55;
    // the hand reaches for the leaf edge, closes at `grab`, tears it off at `tear` and pulls it away (up-left)
    const reach = smoother(invLerp(ctx.shot.t0 + 0.12, grab, ctx.t));
    if (ctx.t < tear) {
      const g = leaf.userData.grip; leaf.updateMatrixWorld(true);
      const gp = v3(g.pos).applyMatrix4(leaf.matrixWorld);
      const start = v3(YX + 0.45, 1.05, YZ + 0.1);
      const tgt = start.clone().lerp(gp, reach);
      if (ctx.t >= grab) p.gripL = { prop: leaf, pose: 'grip' };
      else { p.handL = tgt.toArray(); p.handPoseL = 'relaxed'; }
      // leaf bends while being pulled
      const pull = smooth(invLerp(grab, tear, ctx.t));
      leaf.rotation.z += -0.25 * pull; leaf.rotation.x += 0.2 * pull;
    } else {
      ctx.W.set.state.leafTorn = true;
      const k = easeIn(invLerp(tear, tear + 0.35, ctx.t));
      leaf.position.set(lerp(GIANT_LEAF.stem[0], GIANT_LEAF.stem[0] - 0.5, k), lerp(GIANT_LEAF.stem[1], GIANT_LEAF.stem[1] + 0.55, k), lerp(GIANT_LEAF.stem[2], GIANT_LEAF.stem[2] - 0.2, k));
      leaf.rotation.set(0.3, 0.4, -0.5 - k * 0.8);
      p.gripL = { prop: leaf, pose: 'grip' };
      if (ctx.t < tear + 0.12) ctx.W.fx.leaves({ at: GIANT_LEAF.stem, t0: tear, t: ctx.t, count: 6, spread: 0.25, seed: 4 });
    }
    move(ctx, { pos: [GIANT_LEAF.stem[0] + 0.45, 1.12, GIANT_LEAF.stem[2] + 0.95], target: [GIANT_LEAF.stem[0] - 0.02, 0.98, GIANT_LEAF.stem[2]], fov: 34 },
              { pos: [GIANT_LEAF.stem[0] + 0.38, 1.1, GIANT_LEAF.stem[2] + 0.8], target: [GIANT_LEAF.stem[0] - 0.02, 0.99, GIANT_LEAF.stem[2]], fov: 32 });
    bump(ctx, grab, 1.05);
    // after the tear the camera tilts up with the leaf (keeps YOU waist-up only)
    const up = easeOut(invLerp(tear - 0.05, tear + 0.3, ctx.t));
    if (up > 0) { const sp = ctx.cam.spec; ctx.cam.set({ target: [sp.target[0] - 0.12 * up, sp.target[1] + 0.32 * up, sp.target[2]], pos: [sp.pos[0], sp.pos[1] + 0.12 * up, sp.pos[2]] }); ctx.cam.punch(1 + 0.12 * up); }
    ctx.W.set.state.rays = 0.6;
    light(ctx, [GIANT_LEAF.stem[0], 1, GIANT_LEAF.stem[2]], 3, 0.35);
  } },

  // ---------------------------------------------------------------- s05 "It's itchy."
  s05: { update(ctx) {
    const you = ctx.W.cast.you, p = you.p, ev = ctx.ev('itch');
    face(ctx, 'wide', 'worried', 'tight'); p.shoulderUp = 1;
    if (ctx.t > ev) { p.mouth = 'grimace'; const tw = Math.floor((ctx.t - ev) * 9) % 3 === 1; if (tw) p.eyes = 'squint'; }
    p.handL = [YX + 0.24, 1.0, YZ + 0.02]; p.handR = [YX - 0.24, 1.0, YZ + 0.02]; p.handPoseL = p.handPoseR = 'fist';
    lookCam(ctx, you, [0, 0.1, 0]);
    move(ctx, { pos: [YX + 0.28, 1.52, 1.75], target: [YX, 1.4, YZ], fov: 33 }, { pos: [YX + 0.25, 1.52, 1.6], target: [YX, 1.41, YZ], fov: 32 });
    if (ctx.t > ev) {
      ctx.W.fx.itch({ at: [YX, 1.05, YZ - 0.05], t0: ev, t: ctx.t, radius: 0.32, count: 6, seed: 3 });
      shake(ctx, ev, ctx.shot.t1, 0.004, 26);
    }
    stinkYou(ctx, 0.3);
    light(ctx, [0, 1, 0], 5, 0.45);
  } },

  // ---------------------------------------------------------------- s06 "Very itchy." (KEY)
  s06: { update(ctx) {
    const you = ctx.W.cast.you, p = you.p, t = ctx.t;
    const [a, b] = ctx.ev('scratch');
    const on = smooth(invLerp(a - 0.05, a + 0.08, t));
    face(ctx, 'squeeze', 'worried', 'tongue'); p.tongue = on; p.hairBounce = on;
    const ph = t * 19;   // frantic scratching: elbows pump up and down, body wiggles
    p.handL = [YX + 0.15 + Math.sin(ph) * 0.09 * on, 1.02 + Math.sin(ph * 1.31) * 0.16 * on, YZ - 0.17];
    p.handR = [YX - 0.15 + Math.sin(ph + 2.1) * 0.09 * on, 1.02 + Math.cos(ph * 1.17) * 0.16 * on, YZ - 0.17];
    p.leanSide = Math.sin(ph * 0.5) * 0.12 * on; p.crouch = 0.08 * (0.5 + 0.5 * Math.sin(ph * 0.9)) * on;
    p.poleL = [1.0, -0.15, -0.55]; p.poleR = [1.0, -0.15, -0.55]; p.handPoseL = p.handPoseR = 'fist';
    p.headRoll = Math.sin(ph * 0.5) * 0.16 * on; p.headYaw = Math.sin(ph * 0.37) * 0.12 * on; p.torsoYaw = Math.sin(ph * 0.5) * 0.12 * on;
    p.shoulderUp = 0.6;
    ctx.W.set.state.bushShake = on;
    move(ctx, { pos: [YX + 0.45, 1.5, 1.95], target: [YX, 1.32, YZ], fov: 37 }, { pos: [YX + 0.4, 1.5, 1.8], target: [YX, 1.33, YZ], fov: 36 });
    shake(ctx, a, ctx.shot.t1, 0.012, 24);
    for (let k = 0; k < 8; k++) bump(ctx, a + k * 0.17, 1.035, 0.14);
    ctx.W.fx.leaves({ at: [HIDE_BUSH.pos[0], HIDE_BUSH.h * 0.9, HIDE_BUSH.pos[1] - 0.2], t0: a + 0.05, t, count: 10, spread: 0.6, seed: 9 });
    ctx.W.fx.leaves({ at: [HIDE_BUSH.pos[0] - 0.3, HIDE_BUSH.h * 0.85, HIDE_BUSH.pos[1] - 0.3], t0: a + 0.6, t, count: 8, spread: 0.5, seed: 21 });
    stinkYou(ctx, 0.45, { spread: 0.5 });
    light(ctx, [0, 1, 0], 5, 0.45);
  } },

  // ---------------------------------------------------------------- s07 "Then a branch snaps."
  s07: { update(ctx) {
    const bear = ctx.W.animals.bear, p = bear.p, t = ctx.t;
    const paw = ctx.ev('paw'), snap = ctx.ev('snap');
    // bear standing just north of the branch, facing south (toward YOU); its front-left paw comes down on the branch
    p.pos = [BRANCH.pos[0] + 0.25, BRANCH.pos[1] + 1.15]; p.rotY = Math.PI; p.gait = 'idle'; p.phase = 0;
    const down = easeIn(invLerp(paw, snap, t));
    const bx = BRANCH.pos[0] + 0.05, bz = BRANCH.pos[1];
    p.pawL = [bx, lerp(0.42, 0.04, down), bz + lerp(0.25, 0.0, down)];
    p.headPitch = 0.2;
    ctx.W.set.state.branchSnap = smooth(invLerp(snap, snap + 0.06, t));
    if (t >= snap) {
      ctx.W.fx.splinters({ at: [bx, 0.06, bz], t0: snap, t, count: 14, seed: 7 });
      ctx.W.fx.needles({ at: [bx, 0.02, bz], t0: snap, t, count: 16, seed: 8 });
    }
    move(ctx, { pos: [BRANCH.pos[0] + 0.35, 0.2, BRANCH.pos[1] - 0.85], target: [BRANCH.pos[0], 0.12, BRANCH.pos[1] + 0.05], fov: 48 },
              { pos: [BRANCH.pos[0] + 0.32, 0.19, BRANCH.pos[1] - 0.75], target: [BRANCH.pos[0], 0.12, BRANCH.pos[1] + 0.05], fov: 46 });
    ctx.cam.handheld(0.001);
    punch(ctx, snap, 1.16);
    hit(ctx, snap, 0.012, 0.22);
    ctx.W.set.state.skyDark = 0.25;
    light(ctx, [BRANCH.pos[0], 0.5, BRANCH.pos[1]], 4, 0.4);
  } },

  // ---------------------------------------------------------------- s08 "You freeze."
  s08: { update(ctx) {
    const you = ctx.W.cast.you, p = you.p;
    p.crouch = 0.25; face(ctx, 'stare', 'raised', 'tight'); p.shoulderUp = 1;
    lookCam(ctx, you, [0, 0, 0]); p.lookAt = [YX - 0.6, 1.45, 8];   // staring north, frozen
    const z = smooth(ctx.u);
    ctx.cam.set({ pos: [YX + 0.02, 1.5, 0.95], target: [YX, 1.5, YZ], fov: lerp(19, 12.5, z) }).handheld(0.0006);
    ctx.W.fx.sweat({ ch: you, side: 'R', t0: ctx.ev('sweat'), t: ctx.t, size: 1.2 });
    ctx.post.grey = 0.35; ctx.post.vignette = 0.5;
    ctx.W.set.state.skyDark = 0.35;
    light(ctx, [0, 1.3, 0], 4, 0.3);
  } },

  // ---------------------------------------------------------------- s09 "Something big is coming."
  s09: { update(ctx) {
    const t = ctx.t, bear = ctx.W.animals.bear, p = bear.p;
    // dark backlit silhouette far up the trail, walking slowly between trees
    bearWalk(ctx, [BP.start[0] - 1.4, BP.start[1] + 8.5], [BP.start[0] - 0.8, BP.start[1] + 5.5], ctx.u);
    p.headPitch = 0.1;
    for (const [i, tt] of ctx.ev('thuds').entries()) hit(ctx, tt, 0.0035, 0.12, 18 + i);
    ctx.W.animals.birds.flyOff({ t, t0: 12.05, from: [-3.0, 7.5, 17.5], count: 5, dir: [1, 0.6, -0.3], seed: 2 });
    ctx.W.animals.commit(ctx);   // pose first, then read the eye positions (pure function of t)
    ctx.W.fx.glint({ at: bear.eyePos('L').toArray(), t, size: 0.09 });
    ctx.W.fx.glint({ at: bear.eyePos('R').toArray(), t, size: 0.09 });
    ctx.W.set.state.fog = { color: '#3b3346', near: 6, far: 48 };   // dark haze: the bear is only a shape
    move(ctx, { pos: [0.45, 1.35, 1.7], target: [-1.6, 1.8, 22], fov: 36 }, { pos: [0.3, 1.38, 2.6], target: [-1.6, 1.8, 22], fov: 29 });
    ctx.W.set.state.skyDark = 0.55; ctx.W.set.state.rays = 0.3;
    ctx.post.vignette = 0.45;
    light(ctx, [-1, 1, 14], 14, 0.15);
  } },

  // ---------------------------------------------------------------- s10 "It's a bear." (KEY)
  s10: { update(ctx) {
    const t = ctx.t, bear = ctx.W.animals.bear, p = bear.p, sting = ctx.ev('sting');
    bearWalk(ctx, [BP.enter[0] - 0.1, BP.enter[1] + 2.2], [BP.enter[0], BP.enter[1]], ctx.u);
    bearFace(ctx, 'open', 'angry', 'closed'); p.headPitch = -0.12; p.ears = 1;
    if (t > sting) { p.mouth = 'growl'; }
    const cx = BP.enter[0];
    move(ctx, { pos: [cx + 0.35, 0.42, BP.enter[1] - 3.2], target: [cx, 1.35, BP.enter[1] + 0.8], fov: 46 },
              { pos: [cx + 0.3, 0.42, BP.enter[1] - 3.0], target: [cx, 1.4, BP.enter[1] + 0.5], fov: 38 });
    punch(ctx, sting, 1.08, 0.1);
    hit(ctx, sting, 0.006, 0.3);
    // needles kicked up by the heavy front paws
    const stepT = t - ((t - ctx.shot.t0) % 0.5);
    ctx.W.fx.needles({ at: [cx, 0.02, lerp(BP.enter[1] + 2.2, BP.enter[1], ctx.u) - 0.9], t0: stepT, t, count: 8, seed: Math.floor(stepT * 10) });
    ctx.W.set.state.skyDark = 0.3; ctx.W.set.state.rays = 0.9;
    ctx.post.vignette = 0.35;
    light(ctx, [cx, 1, BP.enter[1]], 6, 0.35);
  } },
};
