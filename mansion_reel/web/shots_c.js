// Shots 23-32: he walks in, you're soaking wet, he stares (music stops), laughs, cries laughing, you feel something,
// in your heart, not your stomach, "straight your whole life" (spirit level), "you think" (the bubble drifts).
import { clamp, lerp, smooth, easeOut, easeInOut, easeOutBack, noise1, hash1, v3, move, punch, bump, shake, hit, win, after, YOU, RICH, face, show, pose, light, blinkAt,
  BATH, THRONE, FY, seatYOU, BATH_ROOM, DISCO_AT } from './shotlib.js';
import { L } from './shots_a.js';
import { water, party, drips, HAT_CEIL } from './shots_b.js';

const PH = THRONE.platform;
const RICH_STAND = [0.2, 186.55];             // where he stops, in front of the platform, facing YOU (+Z)
const BL = (ctx, c, fill = 0.45, o = {}) => light(ctx, c, 3.5, fill, { key: { dir: [0.2, 1, -0.6], color: '#ffe6c2', intensity: 2.1 }, ...o });
const wetYOU = (you) => { const p = you.p; p.wet = 1; p.hatOn = false; p.hatFly = HAT_CEIL; return p; };
const richIn = (ctx) => { const r = RICH(ctx); show(r, RICH_STAND, 0, FY); return r; };

export const shots = {
  // 23. "He walks in."  from behind the throne: the bathroom door opens, the rich guy walks in. Party still on.
  s23: { update(ctx) {
    const you = YOU(ctx), p = seatYOU(ctx); wetYOU(you);
    const d = ctx.ev('door');
    ctx.W.set.state.bathDoor = clamp((ctx.t - d) / 0.4);
    const rich = RICH(ctx), H = ctx.W.cast.helpers;
    show(rich, [0.1, 181.2], 0, FY);
    const u = clamp((ctx.t - d - 0.15) / 1.0);
    H.go(rich, [0.0, 181.3], [0.12, 183.2], easeOut(u), 'walk');
    if (u >= 1) rich.p.gait = null;
    face(rich, 'open', 'raised', 'o');
    party(ctx, 1, 1);
    water(ctx, 0.35, 1, 0.45);
    move(ctx, { pos: [0.85, FY + PH + 1.35, 191.7], target: [0.05, FY + 1.45, 182.8], fov: 36 }, { pos: [0.8, FY + PH + 1.33, 191.5], target: [0.05, FY + 1.45, 182.8], fov: 35 });
    BL(ctx, [0, FY + 1, 186], 0.35, { exposure: 0.98 });
    ctx.W.set.state.shadow.radius = 7;
  } },
  // 24. "You're soaking wet."  YOU dripping, flat wet hair, deadpan, the last drops falling.
  s24: { update(ctx) {
    const you = YOU(ctx), p = seatYOU(ctx); wetYOU(you);
    face(you, 'squint', 'neutral', 'tight'); p.shoulderUp = -0.2;
    p.lookAt = [RICH_STAND[0], FY + 1.65, RICH_STAND[1]];
    blinkAt(you, ctx.t, [36.7]);
    party(ctx, 1, 0.7);
    ctx.W.fx.rain({ center: [THRONE.pos[0], FY + PH, THRONE.pos[1]], radius: 1.6, height: BATH.ceilY - FY - PH, amount: 0.3, count: 60, speed: 7, thick: 2, len: 1.2 });
    drips(ctx, you);
    move(ctx, { pos: [0.1, FY + PH + 1.12, 189.32], target: [0, FY + PH + 1.12, 190.36], fov: 40 }, { pos: [0.1, FY + PH + 1.13, 189.45], target: [0, FY + PH + 1.13, 190.36], fov: 40 });
    BL(ctx, [0, FY + PH + 1, THRONE.pos[1]], 0.5, { exposure: 0.98 });
  } },
  // 25. "He stares at you."  his blank stare; record scratch: the music and the lights stop.
  s25: { update(ctx) {
    const rich = richIn(ctx), p = rich.p;
    const sc = ctx.ev('scratch');
    face(rich, 'stare', 'neutral', 'neutral');
    blinkAt(rich, ctx.t, [38.35]);
    p.lookAt = [THRONE.pos[0], FY + PH + 1.15, THRONE.pos[1]];
    if (ctx.t < sc) party(ctx, 1, 0.8); else { ctx.W.set.state.disco = 1; ctx.W.set.state.party = 0; }
    move(ctx, { pos: [0.08, FY + 1.82, 188.25], target: [0.2, FY + 1.62, 186.55], fov: 30 }, { pos: [0.08, FY + 1.8, 188.0], target: [0.2, FY + 1.62, 186.55], fov: 28 });
    punch(ctx, sc, 1.08, 0.05);
    BL(ctx, [0.2, FY + 1, 186.6], 0.45);
  } },
  // 26. "Then he laughs."  he bursts out laughing, head back, belly shaking.
  s26: { update(ctx) {
    const rich = richIn(ctx), p = rich.p, la = ctx.ev('laugh');
    ctx.W.set.state.disco = 1; ctx.W.set.state.party = 0;
    face(rich, 'stare', 'neutral', 'neutral');
    p.lookAt = [THRONE.pos[0], FY + PH + 1.15, THRONE.pos[1]];
    if (ctx.t > la - 0.05) { p.lookAt = null; ctx.W.cast.helpers.laugh(rich, ctx.t, 1); p.headPitch = 0.35; p.lean = -0.08; p.handL = L(rich, 0.12, 0.95, 0.22); p.handR = L(rich, -0.12, 0.95, 0.22); p.handPoseL = p.handPoseR = 'flat'; }
    move(ctx, { pos: [0.1, FY + 1.6, 188.7], target: [0.2, FY + 1.35, 186.55], fov: 40 }, { pos: [0.1, FY + 1.6, 188.5], target: [0.2, FY + 1.38, 186.55], fov: 40 });
    hit(ctx, la, 0.01, 0.4);
    BL(ctx, [0.2, FY + 1, 186.6], 0.45);
  } },
  // 27. "So hard he cries."  bent over laughing, slapping his knee, tears flying from his eyes.
  s27: { update(ctx) {
    const rich = richIn(ctx), p = rich.p, cr = ctx.ev('cry');
    ctx.W.set.state.disco = 1; ctx.W.set.state.party = 0;
    ctx.W.cast.helpers.laugh(rich, ctx.t, 1); p.eyes = 'squeeze'; p.lean = 0.4; p.headPitch = 0.15; p.red = 0.35;
    const slap = Math.abs(Math.sin(ctx.t * 7.5));
    p.handR = L(rich, -0.13, 0.62 + slap * 0.22, 0.32); p.handPoseR = 'flat';
    p.handL = L(rich, 0.12, 0.98, 0.24); p.handPoseL = 'flat';
    move(ctx, { pos: [0.6, FY + 1.5, 188.4], target: [0.2, FY + 1.2, 186.55], fov: 44 }, { pos: [0.55, FY + 1.5, 188.25], target: [0.2, FY + 1.22, 186.55], fov: 44 });
    if (ctx.t > cr - 0.3) ctx.W.fx.cryTears({ ch: rich, amount: after(ctx.t, cr - 0.3, 0.3), size: 1.3, dir: [0, 0.2, -1] });
    shake(ctx, ctx.shot.t0, ctx.shot.t1, 0.004, 12);
    BL(ctx, [0.2, FY + 1, 186.6], 0.45);
  } },
  // 28. "And you feel something."  YOU looks at him, the face softens, blush, warm glow.
  s28: { update(ctx) {
    const you = YOU(ctx), p = seatYOU(ctx); wetYOU(you);
    const bl = ctx.ev('blush');
    p.lookAt = [RICH_STAND[0], FY + 1.6, RICH_STAND[1]];
    face(you, 'squint', 'neutral', 'tight');
    if (ctx.t > bl - 0.35) face(you, 'open', 'raised', 'neutral');
    if (ctx.t > bl) { face(you, 'open', 'raised', 'smile'); p.blush = 1; p.headRoll = 0.08 * after(ctx.t, bl, 0.4); }
    drips(ctx, you, 0.5);
    ctx.W.set.state.disco = 1;
    move(ctx, { pos: [0.12, FY + PH + 1.13, 189.3], target: [0, FY + PH + 1.12, 190.36], fov: 38 }, { pos: [0.12, FY + PH + 1.14, 189.5], target: [0, FY + PH + 1.13, 190.36], fov: 36 });
    const k = after(ctx.t, bl, 0.4);
    BL(ctx, [0, FY + PH + 1, THRONE.pos[1]], 0.45 + 0.35 * k, { fillColor: '#ffc8d8' });
    ctx.W.fx.glow({ at: [0, FY + PH + 1.3, 190.75], size: 1.6 * k, amount: k, opacity: 0.25, color: '#ff9ab8' });
  } },
  // 29. "In your heart."  his hand on his heart, a glowing pixel heart beats in his chest.
  s29: { update(ctx) {
    const you = YOU(ctx), p = seatYOU(ctx); wetYOU(you);
    const bt = ctx.ev('beat');
    face(you, 'open', 'raised', 'smile'); p.blush = 1; p.headPitch = -0.12;
    p.lookAt = [RICH_STAND[0], FY + 1.6, RICH_STAND[1]];
    ctx.W.set.state.disco = 1;
    pose(ctx);
    const hp = you.heartPos();
    p.handL = [hp.x, hp.y, hp.z - 0.05]; p.handPoseL = 'flat';
    const beat = Math.max(Math.exp(-Math.max(0, ctx.t - bt) * 9) * (ctx.t > bt ? 1 : 0), Math.exp(-Math.max(0, ctx.t - bt - 0.42) * 9) * (ctx.t > bt + 0.42 ? 1 : 0));
    move(ctx, { pos: [0.15, FY + PH + 0.95, 189.15], target: [0, FY + PH + 0.95, 190.36], fov: 44 }, { pos: [0.15, FY + PH + 0.96, 189.3], target: [0, FY + PH + 0.96, 190.36], fov: 42 });
    pose(ctx);
    ctx.W.fx.heartGlow({ at: you.heartPos().toArray(), amount: after(ctx.t, bt - 0.15, 0.2), beat, size: 0.13, overlay: true });
    bump(ctx, bt, 1.04, 0.18); bump(ctx, bt + 0.42, 1.03, 0.18);
    BL(ctx, [0, FY + PH + 1, THRONE.pos[1]], 0.6, { fillColor: '#ffc8d8' });
  } },
  // 30. "Not your stomach this time."  he glances down at his belly (hand there), then back up: the heart again.
  s30: { update(ctx) {
    const you = YOU(ctx), p = seatYOU(ctx); wetYOU(you);
    const st = ctx.ev('stomach'), tm = ctx.ev('time');
    face(you, 'open', 'raised', 'smile'); p.blush = 1;
    ctx.W.set.state.disco = 1;
    const down = after(ctx.t, st - 0.25, 0.25) * (1 - after(ctx.t, tm - 0.1, 0.25));
    p.headPitch = -0.55 * down; p.pupils = [0, -0.8 * down];
    if (down > 0.5) face(you, 'open', 'worried', 'tight');
    pose(ctx);
    const hp = you.heartPos(), bp = you.bellyPos();
    const onHeart = 1 - down;
    p.handL = [lerp(bp.x, hp.x, onHeart), lerp(bp.y, hp.y, onHeart), lerp(bp.z, hp.z, onHeart) - 0.05]; p.handPoseL = 'flat';
    move(ctx, { pos: [0.18, FY + PH + 0.95, 189.1], target: [0, FY + PH + 0.88, 190.36], fov: 46 }, { pos: [0.18, FY + PH + 0.96, 189.25], target: [0, FY + PH + 0.9, 190.36], fov: 44 });
    pose(ctx);
    ctx.W.fx.rumble({ at: you.bellyPos().toArray(), t0: st + 0.05, count: 5, radius: 0.1, size: 0.06, color: '#6a4a24', dur: 0.6 });
    const beat = ctx.t > tm ? Math.exp(-(ctx.t - tm) * 8) : 0;
    ctx.W.fx.heartGlow({ at: you.heartPos().toArray(), amount: onHeart, beat, size: 0.12, overlay: true });
    BL(ctx, [0, FY + PH + 1, THRONE.pos[1]], 0.6, { fillColor: '#ffc8d8' });
  } },
  // 31. "You've been straight your whole life."  YOU stands up stiff as a board, a spirit level on his head, bubble centred.
  s31: { update(ctx) {
    const you = YOU(ctx); wetYOU(you);
    const p = show(you, [THRONE.pos[0], 189.55], THRONE.rotY, FY + PH);
    const lv = ctx.ev('level');
    face(you, 'open', 'neutral', 'tight'); p.headPitch = 0.05;
    p.level = ctx.t > lv; p.bubble = 0;
    p.handL = L(you, 0.2, 0.86, 0.02); p.handR = L(you, -0.2, 0.86, 0.02); p.handPoseL = p.handPoseR = 'flat';
    ctx.W.set.state.disco = 1;
    move(ctx, { pos: [0.05, FY + PH + 1.5, 188.15], target: [0, FY + PH + 1.42, 189.55], fov: 46 }, { pos: [0.05, FY + PH + 1.5, 188.3], target: [0, FY + PH + 1.44, 189.55], fov: 44 });
    bump(ctx, lv, 1.05);
    pose(ctx);
    ctx.W.fx.glint({ at: you.headPos().add(v3(0.25, 0.14, -0.05)).toArray(), t0: lv + 0.05, size: 0.12 });
    BL(ctx, [0, FY + PH + 1, 189.6], 0.5);
  } },
  // 32. "You think."  close-up: the bubble slowly drifts off-centre, his eyes slide after it. Hold in the pause.
  s32: { update(ctx) {
    const you = YOU(ctx); wetYOU(you);
    const p = show(you, [THRONE.pos[0], 189.55], THRONE.rotY, FY + PH);
    const dr = ctx.ev('drift');
    const b = smooth(clamp((ctx.t - dr) / 1.1)) * 0.95;
    face(you, 'open', 'neutral', 'tight'); p.level = true; p.bubble = b;
    p.pupils = [b * 0.9, 0.5]; p.headRoll = -0.04 * b;
    if (ctx.t > dr + 0.9) face(you, 'open', 'raised', 'tight');
    p.handL = L(you, 0.2, 0.86, 0.02); p.handR = L(you, -0.2, 0.86, 0.02); p.handPoseL = p.handPoseR = 'flat';
    ctx.W.set.state.disco = 1;
    move(ctx, { pos: [0.02, FY + PH + 1.78, 188.85], target: [0, FY + PH + 1.7, 189.55], fov: 40 }, { pos: [0.02, FY + PH + 1.78, 188.98], target: [0, FY + PH + 1.71, 189.55], fov: 38 });
    ctx.W.fx.sweat({ ch: you, t0: dr + 0.6, size: 0.9 });
    BL(ctx, [0, FY + PH + 1.4, 189.6], 0.55);
  } },
};
