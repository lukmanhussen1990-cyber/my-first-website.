// s11-s20: footsteps, the officer arrives, looks at it, looks at you, notebook, DUN, the toilet fact.
import { P, C, OFF, offPt, move, punch, shake, win, kf, placeProp, propPoint, lookCam, face, stinkPoop, sweat, sparkles, smooth, invLerp, lerp, clamp, easeInOut, hash1, v3 } from './shotlib.js';
import { SPOTS, TOILET } from './layout.js';

const TX = TOILET.x, TZ = TOILET.z;
// officer foot plants while he walks in (16.55 -> 18.3, stride 0.85)
const walkPos = (t) => { const a = SPOTS.officerStart.pos, b = SPOTS.officer.pos, u = clamp((t - 16.55) / 1.75); return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; };
const PLANTS = [16.55, 17.13, 17.72, 18.3];

export const shots = {
  s11: { update(ctx) { // "Then you hear footsteps."
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [-1.8, 1.74, 1.05], target: [-2.0, 1.66, 0.05], fov: 34 }, { pos: [-1.82, 1.74, 0.95], target: [-2.0, 1.66, 0.05], fov: 31 }, (u) => u);
    W.set.state.focus = [-2, C, 0]; W.set.state.shadowSize = 3;
    face(you, 'wide', 'worried', 'tight'); you.p.shoulderUp = 1;
    const turn = smooth(invLerp(15.25, 15.85, t));
    you.p.lookAt = null; you.p.headYaw = 0.95 * turn; you.p.pupils = [turn, 0];
    sweat(ctx, 14.85, 'R'); sweat(ctx, 15.55, 'L');
    shake(ctx, 15.7, 15.9, 0.004); shake(ctx, 16.25, 16.45, 0.005);
  } },
  s12: { update(ctx) { // "Heavy footsteps."
    const { W, t } = ctx;
    move(ctx, { pos: [-0.6, 0.2, 0.42], target: [-1.15, 0.22, -0.95], fov: 52 }, { pos: [-0.6, 0.2, 0.42], target: [-1.12, 0.22, -0.7], fov: 50 }, (u) => u);
    W.set.state.focus = [-1.1, C, -0.4]; W.set.state.shadowSize = 3;
    for (const [i, tp] of PLANTS.entries()) {
      if (t >= tp && t < tp + 0.7) {
        const p = walkPos(tp), side = i % 2 ? 1 : -1;
        W.fx.impact({ at: [p[0] + OFF.r[0] * side * 0.1, C + 0.01, p[1] + 0.25], t0: tp, t, size: 0.7 });
        shake(ctx, tp, tp + 0.22, 0.007, 26);
      }
    }
  } },
  s13: { update(ctx) { // "An officer."
    const { W, t } = ctx, off = W.cast.officer;
    const u = easeInOut(invLerp(18.12, 19.2, t));
    ctx.cam.set({ pos: offPt(0.55, 0.3, 0.78), target: [lerp(-1.05, -1.06, u), lerp(0.32, 1.84, u), lerp(0.95, 0.94, u)], fov: 54 });
    W.set.state.focus = [-1.05, C, 0.95]; W.set.state.shadowSize = 3;
    lookCam(ctx, off); face(off, 'open', 'angry', 'tight');
    shake(ctx, 18.2, 18.45, 0.006);
    if (t >= 18.3) W.fx.impact({ at: [-1.05, C + 0.01, 0.95], t0: 18.3, t, size: 0.6 });
  } },
  s14: { update(ctx) { // "He looks at it."
    const { W } = ctx, off = W.cast.officer;
    move(ctx, { pos: offPt(0.38, 1.62, 0.82), target: [-1.08, 1.78, 0.93], fov: 34 }, { pos: offPt(0.36, 1.63, 0.76), target: [-1.08, 1.78, 0.93], fov: 31 });
    W.set.state.focus = [-1.05, C, 0.95]; W.set.state.shadowSize = 3;
    off.p.lookAt = [P.poop[0], C + 0.08, P.poop[2]]; face(off, 'open', 'raised', 'tight');
    punch(ctx, 19.46, 1.08);
  } },
  s15: { update(ctx) { // "He looks at you."
    const { W } = ctx, off = W.cast.officer;
    ctx.cam.set({ pos: [-1.72, 1.86, 0.3], target: [-1.1, 1.87, 0.9], fov: 21 }); ctx.cam.handheld(0);
    W.set.state.focus = [-1.05, C, 0.95]; W.set.state.shadowSize = 3;
    lookCam(ctx, off); face(off, 'stare', 'angry', 'tight');
    punch(ctx, 20.55, 1.15);
  } },
  s16: { update(ctx) { // "He pulls out a notebook."
    const { W, t } = ctx, off = W.cast.officer, nb = W.set.props.notebook;
    move(ctx, { pos: offPt(-0.05, 1.46, 0.78), target: offPt(-0.04, 1.4, 0.0), fov: 36 }, { pos: offPt(-0.05, 1.45, 0.7), target: offPt(-0.04, 1.4, 0.0), fov: 34 });
    W.set.state.focus = [-1.05, C, 0.95]; W.set.state.shadowSize = 3;
    face(off, 'open', 'angry', 'tight'); off.p.lookAt = offPt(-0.1, 1.2, 0.4);
    const u = smooth(invLerp(21.9, 22.7, t));
    const pocket = offPt(-0.09, 1.47, 0.13), out = offPt(-0.05, 1.36, 0.34);
    const pos = [lerp(pocket[0], out[0], u), lerp(pocket[1], out[1], u) + Math.sin(u * Math.PI) * 0.06, lerp(pocket[2], out[2], u)];
    placeProp(nb, pos, [0, 1, 0], OFF.f);
    off.p.gripL = { prop: nb, up: OFF.f };
  } },
  s17: { update(ctx) { // DUN. "What you don't know:"
    const { W } = ctx, you = W.cast.you;
    move(ctx, { pos: [-1.88, 1.72, 0.62], target: [-2.0, 1.69, 0.05], fov: 30 }, { pos: [-1.9, 1.72, 0.55], target: [-2.0, 1.69, 0.05], fov: 27 }, (u) => u);
    ctx.cam.handheld(0);
    W.set.state.focus = [-2, C, 0]; W.set.state.shadowSize = 3;
    lookCam(ctx, you); face(you, 'wide', 'worried', 'tight');
    ctx.post.vignette = 0.9; ctx.post.dim = 0.1;
    punch(ctx, 23.32, 1.1, 0.05);
    sweat(ctx, 23.5, 'L');
  } },
  s18: { update(ctx) { // "in Singapore, you can get fined…"
    const { W, t } = ctx, S = W.set.state;
    move(ctx, { pos: [TX + 0.38, 1.6, TZ + 1.3], target: [TX, 0.85, TZ - 0.65], fov: 50, near: 0.03 }, { pos: [TX + 0.33, 1.56, TZ + 1.15], target: [TX, 0.85, TZ - 0.65], fov: 48, near: 0.03 });
    S.location = 'toilet'; S.focus = [TX, 0, TZ]; S.shadowSize = 3; S.alarm = 0.45;
    for (let i = 0; i < 7; i++) { const ph = (t + hash1(i) * 0.8) % 0.8; W.fx.glint({ at: [TX + (hash1(i * 3.1) - 0.5) * 0.5, 0.35 + hash1(i * 5.3) * 0.5, TZ - 0.55 + (hash1(i * 7.7) - 0.5) * 0.4], t0: t - ph, t, size: 1.1 }); }
  } },
  s19: { update(ctx) { // "…just for not flushing a public toilet."
    const { W, t } = ctx, S = W.set.state;
    move(ctx, { pos: [TX + 0.14, 1.3, TZ - 0.2], target: [TX, 1.27, TZ - 1.0], fov: 46, near: 0.02 }, { pos: [TX + 0.12, 1.3, TZ - 0.3], target: [TX, 1.27, TZ - 1.0], fov: 44, near: 0.02 });
    S.location = 'toilet'; S.focus = [TX, 0, TZ]; S.shadowSize = 3; S.alarm = 1;
    for (const b of [26.75, 27.3, 27.85, 28.4]) if (t >= b && t < b + 0.15) ctx.post.flash = 0.18, ctx.post.flashColor = [1, 0.1, 0.1];
    punch(ctx, 27.3, 1.06); punch(ctx, 28.05, 1.06);
  } },
  s20: { update(ctx) { // "Just for not flushing."
    const { W, t } = ctx, S = W.set.state;
    move(ctx, { pos: [TX + 0.5, 1.35, TZ + 1.2], target: [TX, 2.15, TZ - 0.7], fov: 54, near: 0.03 }, { pos: [TX + 0.45, 1.38, TZ + 1.1], target: [TX, 2.15, TZ - 0.7], fov: 52, near: 0.03 });
    S.location = 'toilet'; S.focus = [TX, 0, TZ]; S.shadowSize = 3; S.alarm = 1; S.siren = 1;
    shake(ctx, 28.9, 30.6, 0.003, 14);
  } },
};
