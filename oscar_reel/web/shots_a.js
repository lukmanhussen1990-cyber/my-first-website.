// Shots 1-20 of the awards reel: the golden theatre, the walk up, the mic, LUMP A-D (the lump in the back of his tux
// trousers grows at every squish, the green stage fog gets thicker), the family + grandma watching on TV, "Thank you",
// the voice crack, the front row sniffing, Mom, the co-star pinching her nose, the TV crane, his giant face on the screen.
// Rules: always fully dressed, nothing gross on screen - only the cartoon lump, green stink lines and green fog.
import { THREE, clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, noise1, hash1, v3, move, punch, bump, shake, hit, win, after,
  YOU, CH, PROPS, face, show, pose, lookCam, toward, L, shadowAt, setState, seat, THEATRE, HOME } from './shotlib.js';

export const T = THEATRE, ST = T.stage, PIT = T.pit, RW = T.rows, SY = ST.y, ACT = T.actor.pos;
export const HX = HOME.origin[0];
export const H = (ctx) => ctx.W.cast.helpers;
export const FX = (ctx) => ctx.W.fx;

// ---------------------------------------------------------------- the lump timeline (same for every shot)
// [time of the squish, lump radius, tux-tail lift, stage fog]
export const POOPS = [6.562, 17.622, 20.488, 26.567];
const STEPS = [[6.562, 0.095, 0, 0.22], [17.622, 0.14, 0.08, 0.42], [20.488, 0.19, 0.5, 0.62], [26.567, 0.27, 1.05, 0.9]];
export function lumpAt(t) {
  let r = 0, tl = 0, fog = 0;
  for (const [t0, rr, tt, ff] of STEPS) {
    if (t < t0) break;
    const k = easeOutBack(clamp((t - t0) / 0.3), 2.6), kf = smooth(clamp((t - t0) / 0.9));
    r = lerp(r, rr, k); tl = lerp(tl, tt, k); fog = lerp(fog, ff, kf);
  }
  return { r, tl, fog };
}

// ---------------------------------------------------------------- people
// the actor on the stage (statue in his LEFT hand; up 0 = chest, 1 = raised high)
export function actor(ctx, o = {}) {
  const you = YOU(ctx), p = show(you, o.pos || ACT, o.rotY ?? 0, o.y ?? SY);
  const s = lumpAt(ctx.t); p.lump = s.r; p.tailLift = s.tl;
  face(you, 'open', 'raised', 'smile');
  if (o.statue !== false) holdStatue(ctx, you, o.up ?? 0);
  return you;
}
export function holdStatue(ctx, you, up = 0) {
  const P = PROPS(ctx), k = clamp(up);
  const pos = L(you, lerp(0.19, 0.21, k), lerp(1.12, 2.02, k), lerp(0.27, 0.14, k));
  P.statue.p = { ...P.statue.p, visible: true, pos, rot: [0, you.p.rotY, 0] };
  you.p.gripL = { prop: P.statue, pose: 'grip' };
}
export const lumpPos = (you) => { const r = you.p.lump || 0; return L(you, 0, 0.99, -(0.1 + r * 0.9)); };
// green stink lines from the lump + the green stage fog (both grow with every squish)
export function stinkFX(ctx, you, o = {}) {
  const s = lumpAt(ctx.t); if (s.r < 0.01) return;
  FX(ctx).stink({ at: o.at || lumpPos(you), amount: clamp(0.4 + s.fog * 0.7), spread: 0.16 + s.r * 1.3, height: 0.45 + s.r * 2.2, count: 2 + s.fog * 4,
    burst: POOPS, scale: o.scale ?? 1 });
}
export function fogFX(ctx, o = {}) {
  const s = lumpAt(ctx.t), amt = s.fog * (o.k ?? 1); if (amt < 0.02) return;
  const c = o.at || [ACT[0], SY + 0.3, ACT[1]];
  FX(ctx).haze({ at: c, radius: (0.8 + amt * 1.5) * (o.r ?? 1), amount: clamp(amt), count: Math.round(6 + amt * 10), color: '#9ae05a', color2: '#4f9c33',
    opacity: (0.2 + amt * 0.22) * (o.opacity ?? 1), ground: SY });
}
// pinch the nose with a hand (k 0..1 blends from a rest point)
export function pinchNose(ctx, ch, side = 'R', k = 1, rest = null) {
  if (k <= 0) return;
  pose(ctx);
  const n = ch.nosePos(), f = [Math.sin(ch.p.rotY), Math.cos(ch.p.rotY)];
  const sx = side === 'L' ? 1 : -1, c = Math.cos(ch.p.rotY), s = Math.sin(ch.p.rotY);
  const tgt = [n.x + f[0] * 0.02 + sx * 0.06 * c, n.y - 0.035, n.z + f[1] * 0.02 - sx * 0.06 * s];
  const r0 = rest || L(ch, sx * 0.14, ch.p.sit ? 0.62 : 1.0, 0.26);
  const kk = smooth(clamp(k));
  ch.p[`hand${side}`] = [lerp(r0[0], tgt[0], kk), lerp(r0[1], tgt[1], kk), lerp(r0[2], tgt[2], kk)];
  ch.p[`handPose${side}`] = 'grip';
  ch.p[`pole${side}`] = [0.6, -0.4, 0.3];
}
// front row (rig characters in the real seats)
export const FRONT_Z = RW.z0 + 0.06;
export function frontSeat(ctx, name) {
  const ch = CH(ctx, name); seat(ctx, ch, [T.front[name], FRONT_Z], Math.PI, RW.seatY);
  face(ch, 'open', 'neutral', 'smile'); return ch;
}
export function frontRow(ctx, names = ['costar', 'director', 'mom', 'celebW', 'celebM']) { const o = {}; for (const n of names) o[n] = frontSeat(ctx, n); return o; }
export function sniff(ch, t, k = 1) { if (k <= 0) return; ch.p.headPitch += k * (0.2 + 0.07 * Math.sin(t * 15)); face(ch, 'closed', 'raised', 'tight'); }
// the orchestra pit: conductor on his podium (baton R, stopwatch L), violinist, trumpeter, cellist
export function conductor(ctx, o = {}) {
  const cd = CH(ctx, 'conductor'), P = PROPS(ctx), p = show(cd, T.conductor.pos, T.conductor.rotY, PIT.y + 0.25);
  face(cd, 'open', 'neutral', 'neutral');
  // baton: up 0 = low ready, 1 = raised high; swing overrides
  const up = clamp(o.up ?? 0.2), tremble = o.tremble ?? 0, t = ctx.t;
  const bp = L(cd, -0.24, lerp(1.02, 1.92, up) + tremble * 0.012 * Math.sin(t * 61), lerp(0.3, 0.26, up));
  if (o.baton !== false) {
    const pitch = lerp(1.2, 0.35, up) + (o.batonTilt ?? 0) + tremble * 0.05 * Math.sin(t * 47);
    P.baton.p = { ...P.baton.p, visible: true, pos: o.batonPos || bp, rot: [pitch, p.rotY + 0.25, 0] };
    p.gripR = { prop: P.baton, pose: 'grip' };
  }
  if (o.watch) {
    const wp = o.watchPos || L(cd, 0.12, 1.47, 0.3);
    P.stopwatch.p = { ...P.stopwatch.p, visible: true, pos: wp, rot: [-0.35, p.rotY + Math.PI, 0], k: o.watchK ?? 0 };
    p.gripL = { prop: P.stopwatch, pose: 'grip' };
    p.lookAt = [wp[0], wp[1], wp[2]];
  }
  return cd;
}
// speech seconds on the stopwatch (same mapping as make_overlay.py): 0:31 at 33.5 s ... 0:40 / 0:44 / 0:45 with the voice
export function speechSecs(t) {
  if (t < 42.66) return 31 + (t - 33.5) * (9 / 9.16);
  if (t < 44.10) return 40 + (t - 42.66) / 1.44 * 4;
  if (t < 45.44) return 44 + (t - 44.10) / 1.34;
  return 45;
}
export function stopwatchK(t) { return Math.floor(speechSecs(t) + 1e-6) / 60; }
export function musicians(ctx, o = {}) {
  const P = PROPS(ctx), t = ctx.t, play = o.play ?? 0, nose = o.nose ?? 0, out = {};
  for (const [x, z, kind] of T.musicians) {
    if (kind === 'violin') {
      const v = CH(ctx, 'violinist'), p = show(v, [x, z], 0, PIT.y); face(v, 'open', 'neutral', 'neutral'); out.violin = v;
      p.headRoll = 0.25; p.headYaw = 0.2; p.headPitch = -0.12;
      P.violin.p = { ...P.violin.p, visible: true, pos: L(v, 0.07, 1.36, 0.06), rot: [-0.25, 0.55, 0.85] };
      p.gripL = { prop: P.violin, pose: 'grip' }; p.poleL = [0.2, -0.6, 0.6];
      if (nose > 0) pinchNose(ctx, v, 'R', nose);
      else {
        const sl = play * 0.13 * Math.sin(t * 7 + 1);
        P.bow.p = { ...P.bow.p, visible: true, pos: L(v, -0.2 + sl, 1.3, 0.26), rot: [0.1, Math.PI / 2 + 0.2, 0.25] };
        p.gripR = { prop: P.bow, pose: 'grip' };
      }
    } else if (kind === 'trumpet') {
      const tr = CH(ctx, 'trumpeter'), p = show(tr, [x, z], 0, PIT.y); face(tr, 'open', 'neutral', 'tight'); out.trumpet = tr;
      p.cheeks = play * (0.6 + 0.4 * Math.sin(t * 9));
      P.trumpet.p = { ...P.trumpet.p, visible: true, pos: L(tr, 0, 1.6 * tr.s - 0.03, 0.2), rot: [0.12, 0, 0] };
      p.gripR = { prop: P.trumpet, pose: 'grip' };
      if (nose > 0) pinchNose(ctx, tr, 'L', nose); else { p.handL = L(tr, 0.05, 1.52 * tr.s, 0.42); p.handPoseL = 'grip'; }
    } else if (kind === 'cello') {
      const c = CH(ctx, 'cellist'), p = seat(ctx, c, [x, z], 0, 0.45); p.y = PIT.y; face(c, 'open', 'neutral', 'neutral'); out.cello = c;
      p.headPitch = -0.12; p.headYaw = 0.25;
      P.cello.p = { ...P.cello.p, visible: true, pos: L(c, 0.02, 0.1, 0.36), rot: [-0.32, 0, 0] };
      p.gripL = { prop: P.cello, pose: 'grip' };
      const sl = play * 0.14 * Math.sin(t * 6);
      P.bow2.p = { ...P.bow2.p, visible: true, pos: L(c, -0.3 + sl, 0.62, 0.38), rot: [0, Math.PI / 2, 0.15] };
      if (nose > 0) { pinchNose(ctx, c, 'L', nose); p.gripL = null; P.cello.p.rot = [-0.38, 0, 0]; }
      p.gripR = { prop: P.bow2, pose: 'grip' };
    }
  }
  if (play > 0 && o.notes !== false) FX(ctx).notes({ at: [0, PIT.y + 1.5, -0.5], t0: o.notesT0 ?? 0, count: Math.round(8 * play), spread: 1.8, rise: 1.6, size: 0.24 });
  return out;
}
export function crowd(ctx, o) { setState(ctx, { crowd: { cheer: 0, sniff: 0, nose: 0, look: 0, ...o } }); }

// ---------------------------------------------------------------- cameras
export const LUMP_CAM = { pos: [1.95, 2.6, -6.05], target: [0.02, 2.32, -3.3], fov: 44 };
export const LUMP_CAM2 = { pos: [1.85, 2.58, -5.9], target: [0.02, 2.32, -3.3], fov: 44 };
const FACE_CAM = (dx = 0, dz = 0, fov = 30) => ({ pos: [0.48 + dx, 2.99, -2.02 + dz], target: [0, 2.86, -3.25], fov });

// one of the LUMP shots: same angle every time (behind + to his left), punch-in + shake + sweat at the squish
export function lumpShot(ctx, ev, o = {}) {
  const t = ctx.t, tH = ctx.ev(ev), you = actor(ctx, { up: o.up ?? 0.35 }), p = you.p;
  move(ctx, LUMP_CAM, LUMP_CAM2);
  const after1 = tH != null && t >= tH;
  if (o.squish !== false && after1) {
    const k = o.k ?? 1;
    punch(ctx, tH, 1.42 + 0.06 * k, 0.09); hit(ctx, tH, 0.022 + 0.012 * k, 0.32);
    p.headYaw = 0.85 * smooth(clamp((t - tH - 0.15) / 0.3)); p.headPitch = -0.12;
    face(you, 'wide', 'raised', k > 1.5 ? 'scream' : 'tight'); p.red = clamp((t - tH) * 0.6) * 0.4;
    p.shoulderUp = Math.exp(-(t - tH) / 0.25);
    FX(ctx).sweatBurst({ ch: you, t0: tH + 0.05, count: 6 });
    if (o.buttons) FX(ctx).splinters({ at: L(you, 0, 0.98, -0.12 - (p.lump || 0)), t0: tH + 0.02, count: 10, size: 0.7, ground: SY, color: ['#141418', '#f2d060'] });
  } else { face(you, 'happy', 'raised', 'smile'); p.headYaw = 0.12; }
  stinkFX(ctx, you); fogFX(ctx);
  crowd(ctx, o.crowd || { cheer: after1 ? 0.15 : 0.6 });
  shadowAt(ctx, [0, 2, -3.3], 4);
  ctx.post.vignette = 0.35; ctx.post.tint = lumpAt(t).fog * 0.12;
  return you;
}

export const shots = {
  // 1. "You just won the Oscar."  The huge golden theatre, crowd cheering; he raises the golden statue by the stage stairs.
  s01: { update(ctx) {
    const t = ctx.t, tw = ctx.ev('won');
    move(ctx, { pos: [-1.2, 5.0, 12.5], target: [4.9, 1.8, 0.4], fov: 50 }, { pos: [-0.3, 4.4, 10.0], target: [5.1, 1.8, 0.6], fov: 48 }, easeOut);
    const you = actor(ctx, { pos: [6.85, 1.55], rotY: Math.PI, y: 0, up: 0.25 + 0.75 * easeOutBack(clamp((t - tw) / 0.3), 2) });
    face(you, 'happy', 'raised', 'laugh');
    crowd(ctx, { cheer: 1 });
    setState(ctx, { spot: { x: 6.85, z: -1.3 } });
    for (let i = 0; i < 8; i++) FX(ctx).glint({ at: [-6 + i * 1.7, 3.2 + (i % 3) * 1.3, -1.6], size: 0.25, seed: i * 3, color: '#ffd040', glow: '#fff0a0' });
    if (t >= tw) ctx.post.flash = 0.35 * Math.exp(-(t - tw) / 0.12);
    ctx.post.vignette = 0.3;
  } },
  // 2. close: his hand raises the shiny golden statue - sparkles, a huge proud smile.
  s02: { update(ctx) {
    const t = ctx.t, te = ctx.ev('oscar');
    const k = easeOutBack(clamp((t - te + 0.1) / 0.4), 1.8);
    const you = actor(ctx, { pos: [6.85, 1.55], rotY: Math.PI, y: 0, up: lerp(0.15, 1, k) });
    face(you, 'happy', 'raised', 'laugh'); you.p.headPitch = 0.12 * k;
    move(ctx, { pos: [6.5, 1.72, 0.0], target: [6.82, 1.82, 1.55], fov: 41 }, { pos: [6.52, 1.78, 0.1], target: [6.82, 1.88, 1.55], fov: 39 });
    pose(ctx);
    const sp = PROPS(ctx).statue.getWorldPosition(new THREE.Vector3());
    for (let i = 0; i < 4; i++) FX(ctx).glint({ at: [sp.x + (i - 1.5) * 0.05, sp.y + 0.1 + (i % 2) * 0.12, sp.z - 0.05], t0: te + 0.05 + i * 0.13, size: 0.09, seed: i, color: '#ffe060', glow: '#fff6c0' });
    FX(ctx).glint({ at: [sp.x, sp.y + 0.2, sp.z - 0.06], size: 0.06, seed: 9, color: '#ffe060', glow: '#fff6c0' });
    crowd(ctx, { cheer: 1 });
    shadowAt(ctx, [6.8, 1.2, 1.5], 3);
    ctx.post.vignette = 0.3;
  } },
  // 3. low angle: he struts up the stage stairs with the statue, chest out.
  s03: { update(ctx) {
    const u = ctx.u, z = lerp(0.95, -0.55, u);
    const stairY = (zz) => ST.y * clamp((T.stairs.z1 - zz + 0.15) / (T.stairs.z1 - T.stairs.z0));
    const you = actor(ctx, { pos: [6.85, z], rotY: Math.PI, y: stairY(z), up: 1 });
    H(ctx).go(you, [6.85, 0.95], [6.85, -0.55], u, 'walk', 0.5);
    you.p.y = stairY(you.p.pos[1]); you.p.lean = -0.06;
    face(you, 'happy', 'raised', 'smile');
    const y = you.p.y;
    ctx.cam.set({ pos: [5.95, 1.5, -1.62], target: [6.85, y + 1.45, z + 0.1], fov: 52 });
    crowd(ctx, { cheer: 0.9 });
    setState(ctx, { spot: { x: 6.85, z: -1.4 } });
    shadowAt(ctx, [6.8, 1.2, 0], 3);
    ctx.post.vignette = 0.3;
  } },
  // 4. LUMP A: at the mic, from behind + to his left: statue held high, proud. Normal trousers.
  s04: { update(ctx) {
    const t = ctx.t, you = lumpShot(ctx, 'mic', { squish: false, up: 1, crowd: { cheer: 1 } });
    you.p.headYaw = 0.25; you.p.headPitch = 0.05;
    face(you, 'happy', 'raised', 'laugh');
    move(ctx, { pos: [2.3, 2.75, -6.5], target: [0.02, 2.4, -3.3], fov: 46 }, LUMP_CAM, easeOut);
    for (let i = 0; i < 3; i++) FX(ctx).glint({ at: L(you, 0.21, 2.25 + i * 0.06, 0.1), t0: ctx.ev('mic') + 0.1 + i * 0.25, size: 0.07, seed: i });
    void t;
  } },
  // 5. close-up: his proud smile ... freezes.
  s05: { update(ctx) {
    const t = ctx.t, tj = ctx.ev('just'), you = actor(ctx, { up: 0.55 }), p = you.p;
    move(ctx, FACE_CAM(0.06, 0.06, 31), FACE_CAM(0, -0.04, 29));
    if (t < tj) { face(you, 'happy', 'raised', 'smile'); H(ctx).talk(you, t, 0.5); p.headRoll = 0.05 * Math.sin(t * 2); }
    else { face(you, 'wide', 'raised', 'smile'); p.headPitch = -0.04; bump(ctx, tj, 1.05, 0.25); }
    crowd(ctx, { cheer: 0.5 });
    shadowAt(ctx, [0, 2.5, -3.2], 2);
    ctx.post.vignette = 0.3;
  } },
  // 6. LUMP B: "pooped" - the same angle: a small round lump in the back of his trousers, green stink lines, eyes wide.
  s06: { update(ctx) { lumpShot(ctx, 'pooped', { k: 1 }); } },
  // 7. "A billion people are watching."  A family on the sofa, watching him LIVE on the TV.
  s07: { update(ctx) {
    const t = ctx.t, you = actor(ctx, { up: 0.5 }); face(you, 'wide', 'raised', 'smile');
    const sx = (i) => [HX - 1.32, HX - 0.6, HX + 0.12][i];
    const dad = CH(ctx, 'dad'), kid = CH(ctx, 'kid'), gm = CH(ctx, 'grandma');
    seat(ctx, dad, [sx(0), 3.32], Math.PI, 0.46); seat(ctx, kid, [sx(1), 3.32], Math.PI, 0.46); seat(ctx, gm, [sx(2), 3.32], Math.PI, 0.46);
    const cut = ctx.ev('billion') + 0.12;          // first the TV (him LIVE), then a cut to the family's faces
    for (const c of [dad, kid, gm]) { c.p.lean = 0.12 + 0.06 * after(t, cut, 0.4); face(c, 'wide', 'raised', 'o'); }
    dad.p.handL = L(dad, 0.1, 0.62, 0.32); kid.p.handR = L(kid, -0.06, 0.72, 0.2); kid.p.handL = L(kid, 0.06, 0.72, 0.2);
    popcorn(ctx, gm);
    if (t < cut) ctx.cam.set(lerpCamS({ pos: [HX - 0.6, 1.0, 2.0], target: [HX - 0.6, 0.98, 0.7], fov: 42 }, { pos: [HX - 0.6, 1.0, 1.85], target: [HX - 0.6, 0.98, 0.7], fov: 42 }, (t - ctx.shot.t0) / (cut - ctx.shot.t0)));
    else ctx.cam.set(lerpCamS({ pos: [HX - 0.6, 1.58, 0.5], target: [HX - 0.6, 0.86, 3.32], fov: 62 }, { pos: [HX - 0.6, 1.55, 0.62], target: [HX - 0.6, 0.86, 3.32], fov: 60 }, (t - cut) / (ctx.shot.t1 - cut)));
    setState(ctx, { liveCam: { pos: [0.35, 2.85, 0.6], target: [0, 2.55, -3.25], fov: 22 } });
    shadowAt(ctx, [HX - 0.6, 1, 2.5], 3.5);
    ctx.post.vignette = 0.45;
  } },
  // 8. Grandma with her popcorn bowl, frozen mid-bite, staring at the TV.
  s08: { update(ctx) {
    const t = ctx.t, you = actor(ctx, { up: 0.5 }); face(you, 'wide', 'raised', 'smile');
    const gm = CH(ctx, 'grandma'), p = seat(ctx, gm, [HX + 0.12, 3.32], Math.PI, 0.46);
    face(gm, 'wide', 'raised', 'o'); p.lean = 0.1; p.headPitch = -0.05;
    popcorn(ctx, gm, after(t, ctx.ev('watching'), 0.15));
    move(ctx, { pos: [HX + 0.02, 1.13, 2.36], target: [HX + 0.12, 0.95, 3.3], fov: 42 }, { pos: [HX + 0.04, 1.12, 2.44], target: [HX + 0.12, 0.96, 3.3], fov: 40 });
    setState(ctx, { liveCam: { pos: [0.35, 2.85, 0.6], target: [0, 2.55, -3.25], fov: 22 } });
    shadowAt(ctx, [HX, 1, 3], 2.5);
    ctx.post.vignette = 0.4;
  } },
  // 9. He leans into the mic: "Thank you." - mic feedback squeal.
  s09: { update(ctx) {
    const t = ctx.t, tt = ctx.ev('thank'), you = actor(ctx, { up: 0.3 }), p = you.p;
    p.lean = 0.12 * smooth(clamp((t - ctx.shot.t0) / 0.6));
    move(ctx, { pos: [-0.78, 2.92, -1.72], target: [0, 2.82, -3.2], fov: 31 }, { pos: [-0.7, 2.92, -1.85], target: [0, 2.84, -3.2], fov: 29 });
    face(you, 'open', 'raised', 'smile');
    if (t >= tt && t < tt + 0.85) H(ctx).talk(you, t, 0.8);
    if (t >= tt && t < tt + 0.45) { face(you, 'squeeze', 'worried', 'tight'); p.shoulderUp = 0.8; }
    hit(ctx, tt, 0.012, 0.25, 40);
    stinkFX(ctx, you); fogFX(ctx, { opacity: 0.6 });
    shadowAt(ctx, [0, 2.5, -3.2], 2);
    ctx.post.vignette = 0.3;
  } },
  // 10. extreme close-up: his face, sweat drops, his voice cracks.
  s10: { update(ctx) {
    const t = ctx.t, tc = ctx.ev('cracks'), you = actor(ctx, { up: 0.3 }), p = you.p;
    move(ctx, { pos: [0.17, 3.0, -2.6], target: [0, 2.96, -3.22], fov: 29 }, { pos: [0.15, 3.0, -2.66], target: [0, 2.96, -3.22], fov: 28 });
    face(you, 'open', 'worried', 'smile'); p.red = 0.25;
    if (t >= tc) { face(you, 'wide', 'worried', 'o'); hit(ctx, tc, 0.01, 0.2, 50); p.headPitch = 0.06 * Math.exp(-(t - tc) / 0.3) * Math.sin((t - tc) * 50); }
    else H(ctx).talk(you, t, 0.6);
    FX(ctx).sweat({ ch: you, t0: ctx.shot.t0 + 0.1, count: 2 });
    shadowAt(ctx, [0, 2.8, -3.2], 1.5);
    ctx.post.vignette = 0.35;
  } },
  // 11. wide: the whole front row sniffs at the same time.
  s11: { update(ctx) {
    const t = ctx.t;
    move(ctx, { pos: [0, 2.2, -1.1], target: [0, 0.85, 3.6], fov: 56 }, { pos: [0, 2.1, -0.95], target: [0, 0.85, 3.6], fov: 53 });
    const fr = frontRow(ctx), k = smooth(clamp((t - ctx.shot.t0 - 0.1) / 0.2));
    for (const c of Object.values(fr)) sniff(c, t, k);
    crowd(ctx, { sniff: k });
    actor(ctx);
    shadowAt(ctx, [0, 0.8, 3], 6);
    ctx.post.vignette = 0.3; ctx.post.tint = 0.04;
  } },
  // 12. two stars in the front row slowly turn and look at each other.
  s12: { update(ctx) {
    const t = ctx.t, fr = frontRow(ctx), a = fr.celebW, b = fr.celebM, k = smooth(clamp((t - ctx.shot.t0 - 0.25) / 0.35));
    move(ctx, { pos: [1.79, 1.3, -0.75], target: [1.79, 0.98, 2.06], fov: 40 }, { pos: [1.79, 1.28, -0.6], target: [1.79, 0.98, 2.06], fov: 39 });
    for (const c of [a, b]) { sniff(c, t, 1 - k); }
    if (k > 0) {
      pose(ctx);
      const ha = a.headPos(), hb = b.headPos();
      a.p.lookAt = [lerp(ha.x, hb.x, 1), hb.y, lerp(ha.z - 1, hb.z, k)]; b.p.lookAt = [ha.x, ha.y, lerp(hb.z - 1, ha.z, k)];
      face(a, 'squint', 'raised', 'tight'); face(b, 'wide', 'raised', 'tight');
    }
    crowd(ctx, { sniff: 0.6 });
    shadowAt(ctx, [1.8, 0.8, 2.2], 3);
    ctx.post.vignette = 0.3;
  } },
  // 13. "You get nervous."  his eyes dart left and right, sweat.
  s13: { update(ctx) {
    const t = ctx.t, you = actor(ctx, { up: 0.3 }), p = you.p;
    move(ctx, FACE_CAM(-0.75, -0.05, 30), FACE_CAM(-0.72, -0.12, 28));
    face(you, 'wide', 'worried', 'tight'); p.red = 0.2;
    const ph = Math.floor((t - ctx.shot.t0) / 0.22); p.pupils = [ph % 2 ? 0.9 : -0.9, 0];
    p.headYaw = (ph % 2 ? 0.08 : -0.08);
    FX(ctx).sweat({ ch: you, t0: ctx.shot.t0, count: 3 });
    stinkFX(ctx, you); fogFX(ctx, { opacity: 0.5 });
    shadowAt(ctx, [0, 2.6, -3.2], 2);
    ctx.post.vignette = 0.35;
  } },
  // 14. LUMP C: "So you poop again." - the lump is now a round balloon. SQUISH.
  s14: { update(ctx) { lumpShot(ctx, 'again', { k: 1.3 }); } },
  // 15. "I want to thank my mom..."  he points into the audience, smiling too hard.
  s15: { update(ctx) {
    const t = ctx.t, you = actor(ctx, { up: 0.2 }), p = you.p, k = easeOutBack(clamp((t - ctx.ev('want') + 0.1) / 0.3), 1.6);
    move(ctx, { pos: [-1.6, 2.78, -2.05], target: [0.05, 2.66, -3.0], fov: 45 }, { pos: [-1.5, 2.78, -2.15], target: [0.05, 2.68, -3.0], fov: 43 });
    p.handR = L(you, lerp(-0.2, 0.02, k), lerp(0.95, 1.56, k), lerp(0.15, 0.62, k)); p.handPoseR = 'point';
    face(you, 'open', 'worried', 'smile'); H(ctx).talk(you, t, 0.7); p.red = 0.2;
    stinkFX(ctx, you); fogFX(ctx);
    crowd(ctx, { sniff: 0.3 });
    shadowAt(ctx, [0, 2.4, -3], 2.5);
    ctx.post.vignette = 0.3;
  } },
  // 16. Mom in the front row: proud tears ... she sniffs ... her smile freezes.
  s16: { update(ctx) {
    const t = ctx.t, fr = frontRow(ctx, ['mom', 'celebW', 'costar']), m = fr.mom, p = m.p, P = PROPS(ctx);
    const tS = ctx.ev('mom') + 0.32, s = t >= tS, fz = t >= tS + 0.3;
    move(ctx, { pos: [0.8, 1.13, 0.98], target: [0.86, 0.93, 2.08], fov: 37 }, { pos: [0.81, 1.12, 1.08], target: [0.86, 0.94, 2.08], fov: 35 });
    P.tissue.p = { ...P.tissue.p, visible: true, pos: L(m, -0.06, s ? 0.66 : 1.02, 0.24), rot: [0.3, p.rotY, 0] };
    p.gripR = { prop: P.tissue, pose: 'grip' };
    if (!s) { face(m, 'happy', 'raised', 'smile'); FX(ctx).cryTears({ ch: m, amount: 0.5 }); p.headRoll = 0.08; }
    else if (!fz) { sniff(m, t, 1); }
    else { face(m, 'wide', 'raised', 'smile'); p.headPitch = 0.04; bump(ctx, tS + 0.3, 1.05, 0.25); }
    crowd(ctx, { sniff: 0.4 });
    shadowAt(ctx, [0.9, 0.8, 2.2], 2.5);
    ctx.post.vignette = 0.3;
  } },
  // 17. LUMP D: "And again." - even bigger, the tuxedo tails lift up.
  s17: { update(ctx) { lumpShot(ctx, 'again', { k: 1.6 }); } },
  // 18. the co-star (sparkly silver gown) smiles for the cameras ... and pinches her nose.
  s18: { update(ctx) {
    const t = ctx.t, fr = frontRow(ctx, ['costar', 'director', 'mom']), c = fr.costar, p = c.p, tn = ctx.ev('nose');
    move(ctx, { pos: [-0.93, 1.18, 0.95], target: [-1.0, 1.0, 2.06], fov: 37 }, { pos: [-0.95, 1.17, 1.05], target: [-1.0, 1.01, 2.06], fov: 35 });
    face(c, 'happy', 'raised', 'grin'); p.headRoll = -0.06; p.hairSway = 0.3;
    pinchNose(ctx, c, 'R', (t - tn + 0.25) / 0.3);
    if (t >= tn) face(c, 'squeeze', 'raised', 'grin');
    pose(ctx);
    const neck = c.chestPos();
    for (let i = 0; i < 5; i++) FX(ctx).glint({ at: [neck.x + (i - 2) * 0.03, neck.y + 0.04 - Math.abs(i - 2) * 0.02, neck.z - 0.03], size: 0.035, seed: i * 2, color: '#e8f4ff', glow: '#ffffff' });
    for (const ft of [ctx.shot.t0 + 0.25, ctx.shot.t0 + 0.9, tn + 0.2, tn + 0.75]) if (t >= ft) ctx.post.flash = Math.max(ctx.post.flash, 0.4 * Math.exp(-(t - ft) / 0.06));
    crowd(ctx, { nose: 0.3, sniff: 0.3 });
    shadowAt(ctx, [-1, 0.8, 2.2], 2.5);
    ctx.post.vignette = 0.3;
  } },
  // 19. "The camera zooms in on your face."  the big TV camera on its crane swings toward him, red LIVE light.
  s19: { update(ctx) {
    const t = ctx.t, tc = ctx.ev('camera'), tz = ctx.ev('zooms');
    const k = smooth(clamp((t - tc + 0.1) / 0.55));
    const yaw = lerp(0.25, 0.93, k), pitch = lerp(0.02, 0.24, k);
    setState(ctx, { craneYaw: yaw, cranePitch: pitch });
    move(ctx, { pos: [8.95, 2.75, 7.6], target: [1.2, 2.45, -3.0], fov: 48 }, { pos: [8.85, 2.7, 7.0], target: [1.0, 2.5, -3.0], fov: 46 });
    const you = actor(ctx, { up: 0.3 }); face(you, 'wide', 'worried', 'tight');
    if (t >= tz) setState(ctx, { liveCam: { pos: craneCamPos(yaw, pitch), target: [0, 2.9, -3.25], fov: lerp(26, 9, smooth(clamp((t - tz) / 0.5))) } });
    stinkFX(ctx, you); fogFX(ctx);
    crowd(ctx, { sniff: 0.4, nose: 0.2 });
    shadowAt(ctx, [3, 1.5, 0], 9);
    ctx.post.vignette = 0.3;
  } },
  // 20. his giant face on the theatre screen, one eye twitching.
  s20: { update(ctx) {
    const t = ctx.t, you = actor(ctx, { up: 0.3 }), p = you.p;
    move(ctx, { pos: [0, 3.5, 4.4], target: [0, 4.75, -8.8], fov: 52 }, { pos: [0, 3.6, 3.6], target: [0, 4.85, -8.8], fov: 48 });
    face(you, 'wide', 'worried', 'tight'); p.red = 0.3; p.wet = 0.6;
    const tw = (t - ctx.ev('face')) % 0.36; if (t > ctx.ev('face') && tw < 0.07) p.eyes = 'squint';
    p.headRoll = 0.02 * Math.sin(t * 40) * (t > ctx.ev('face') ? 1 : 0);
    setState(ctx, { craneYaw: 0.93, cranePitch: 0.24, liveCam: { pos: [0.11, 2.99, -2.45], target: [0, 2.95, -3.25], fov: 24 } });
    crowd(ctx, { look: 0, sniff: 0.3 });
    stinkFX(ctx, you); fogFX(ctx);
    ctx.post.vignette = 0.3;
  } },
};

// grandma's popcorn bowl in her lap (right hand), left hand frozen half way to her mouth (k 0..1 = how high)
export function popcorn(ctx, gm, k = 0.6) {
  const P = PROPS(ctx), p = gm.p;
  P.popcorn.p = { ...P.popcorn.p, visible: true, pos: L(gm, -0.02, 0.62, 0.3), rot: [0, p.rotY + Math.PI / 2, 0] };
  p.gripR = { prop: P.popcorn, pose: 'grip' };
  p.handL = L(gm, 0.08, lerp(0.7, 1.0, k), lerp(0.3, 0.18, k)); p.handPoseL = 'grip';
}
const lerpCamS = (a, b, u) => { const k = smooth(clamp(u)); return { pos: a.pos.map((v, i) => lerp(v, b.pos[i], k)), target: a.target.map((v, i) => lerp(v, b.target[i], k)), fov: lerp(a.fov, b.fov, k) }; };
export function craneCamPos(yaw, pitch) {
  const [bx, bz] = T.crane.base, R = T.crane.armLen - 1.0;
  return [bx - R * Math.cos(pitch) * Math.sin(yaw) - 0.62 * Math.sin(yaw), 2.1 + R * Math.sin(pitch) - 0.2, bz - R * Math.cos(pitch) * Math.cos(yaw) - 0.62 * Math.cos(yaw)];
}
