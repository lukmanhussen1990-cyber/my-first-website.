// Shots 33-44: New York, the zoo, Roy and Silo, the egg + chick, the towel, the coffee, the key, the years go by,
// your own bathroom, your name on the door, welcome home.
import { THREE, clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, noise1, hash1, v3, move, punch, bump, shake, hit, win, after, YOU, RICH, YROBE, face, show, pose, light, blinkAt,
  MANSION, BATH, THRONE, FY, YOUR_DOOR, MYBATH, MYTHRONE, ZOO, PENGUINS } from './shotlib.js';
import { L } from './shots_a.js';
import { HAT_CEIL } from './shots_b.js';

const PH = THRONE.platform;
const BL = (ctx, c, fill = 0.45, o = {}) => light(ctx, c, 3.5, fill, { key: { dir: [0.2, 1, -0.6], color: '#ffe6c2', intensity: 2.1 }, ...o });
const ZL = (ctx, c, r = 4, fill = 0.35) => light(ctx, c, r, fill);
const YOU_STAND = [0.0, 188.05], RICH_HAND = [0.1, 187.2];
// basis -> Euler 'YXZ' for hand rotations
const euler = (X, Y, Z) => { const e = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(v3(X), v3(Y), v3(Z)), 'YXZ'); return [e.x, e.y, e.z]; };
const wetTowelYOU = (ctx, towel) => { const you = YOU(ctx), p = show(you, YOU_STAND, Math.PI, FY); p.wet = 0.85; p.hatOn = false; p.towel = towel; return you; };
const richGive = (ctx) => { const r = RICH(ctx); show(r, RICH_HAND, 0, FY); return r; };

export const shots = {
  // 33. "What you don't know:"  calm high view of the New York skyline at sunset over the park.
  s33: { update(ctx) {
    move(ctx, { pos: [598, 105, -205], target: [606, 92, 150], fov: 50, far: 950 }, { pos: [598.5, 102, -192], target: [606, 91, 150], fov: 49, far: 950 });
    ctx.cam.handheld(0.001);
    ctx.W.set.state.fog = { color: '#efb994', near: 260, far: 980 };
    ZL(ctx, [600, 0, 0], 30, 0.2);
  } },
  // 34. "in a New York zoo,"  the penguin enclosure: rocks, a blue pool, skyscrapers behind the park trees.
  s34: { update(ctx) {
    const A = ctx.W.animals;
    A.roy.p.pos = [599.5, 0.4]; A.silo.p.pos = [598.85, 0.35];
    A.roy.p.rotY = Math.PI + 0.3; A.silo.p.rotY = Math.PI - 0.3;
    move(ctx, { pos: [599.3, 1.75, -7.6], target: [599.7, 1.45, 2.0], fov: 46 }, { pos: [599.3, 1.7, -7.0], target: [599.7, 1.42, 2.0], fov: 45 });
    ZL(ctx, [599.5, 0.3, 1.5], 7, 0.3);
  } },
  // 35. "two male penguins named Roy and Silo"  close two-shot; each turns to the camera on his name.
  s35: { update(ctx) {
    const A = ctx.W.animals, roy = A.roy, silo = A.silo;
    roy.p.pos = [599.5, 0.4]; silo.p.pos = [598.85, 0.35];
    const ry = ctx.ev('roy'), sl = ctx.ev('silo');
    roy.p.rotY = Math.PI + 0.45; silo.p.rotY = Math.PI - 0.45;
    roy.p.headYaw = 0.5 * Math.sin(ctx.t * 1.3); silo.p.headYaw = -0.5 * Math.sin(ctx.t * 1.1 + 1);
    const cam = [599.2, 0.92, -2.25];
    if (ctx.t > ry - 0.1) { roy.p.lookAt = cam; roy.p.headYaw = 0; roy.p.flapR = 0.9 * Math.abs(Math.sin((ctx.t - ry) * 9)) * (1 - after(ctx.t, ry + 0.6, 0.2)); roy.p.squash = 0.5 * Math.exp(-(ctx.t - ry) * 6); }
    if (ctx.t > sl - 0.1) { silo.p.lookAt = cam; silo.p.headYaw = 0; silo.p.flapL = 0.9 * Math.abs(Math.sin((ctx.t - sl) * 9)) * (1 - after(ctx.t, sl + 0.6, 0.2)); silo.p.squash = 0.5 * Math.exp(-(ctx.t - sl) * 6); }
    move(ctx, { pos: [599.2, 0.95, -2.45], target: [599.17, 0.62, 0.38], fov: 38 }, { pos: [599.2, 0.93, -2.2], target: [599.17, 0.62, 0.38], fov: 37 });
    ctx.W.fx.badge({ text: 'ROY', at: [599.52, 1.18, 0.35], t0: ry, size: 0.32, roll: 0.06 });
    ctx.W.fx.badge({ text: 'SILO', at: [598.85, 1.15, 0.3], t0: sl, size: 0.32, roll: -0.06 });
    ZL(ctx, [599.2, 0.3, 0.4], 2.5, 0.4);
  } },
  // 36. "fell in love"  they turn to each other, heart eyes, a big pink heart pops between them, flippers touch.
  s36: { update(ctx) {
    const A = ctx.W.animals, roy = A.roy, silo = A.silo, lv = ctx.ev('love');
    roy.p.pos = [599.42, 0.42]; silo.p.pos = [598.92, 0.38];
    const k = after(ctx.t, ctx.shot.t0, 0.35);
    roy.p.rotY = lerp(Math.PI + 0.45, 3 * Math.PI / 2 - 0.25, k); silo.p.rotY = lerp(Math.PI - 0.45, Math.PI / 2 + 0.25, k);
    if (ctx.t > lv - 0.08) { roy.p.eyes = silo.p.eyes = 'heart'; roy.p.flapL = silo.p.flapR = 0.55; roy.p.leanSide = 0.08; silo.p.leanSide = -0.08; }
    move(ctx, { pos: [599.17, 0.85, -1.75], target: [599.17, 0.66, 0.4], fov: 40 }, { pos: [599.17, 0.84, -1.55], target: [599.17, 0.68, 0.4], fov: 38 });
    ctx.W.fx.hearts({ at: [599.17, 0.98, 0.35], t0: lv, count: 1, size: 0.3, rise: 0.25, life: 1.4, spread: 0.01 });
    ctx.W.fx.hearts({ at: [599.17, 0.9, 0.35], t0: lv + 0.1, count: 6, size: 0.08, rise: 0.4, life: 1.2, spread: 0.25, seed: 7 });
    bump(ctx, lv, 1.05);
    ZL(ctx, [599.2, 0.3, 0.4], 2.5, 0.45);
  } },
  // 37. "and raised a baby penguin together."  the egg on the stone nest wobbles, cracks, the chick pops out.
  s37: { update(ctx) {
    const A = ctx.W.animals, roy = A.roy, silo = A.silo, egg = A.hatch;
    const cr = ctx.ev('crack'), ha = ctx.ev('hatch'), tg = ctx.ev('together');
    roy.p.pos = [599.5, 0.66]; silo.p.pos = [598.82, 0.62];
    roy.p.rotY = -Math.PI / 2 - 0.55; silo.p.rotY = Math.PI / 2 + 0.55;
    roy.p.headPitch = silo.p.headPitch = -0.55;
    egg.p.visible = true; egg.p.wobble = ctx.t > 57.6 && ctx.t < ha ? 1 : 0; egg.p.crack = ctx.t > cr ? 1 : 0;
    egg.p.open = clamp((ctx.t - ha) / 0.25); egg.p.chick = clamp((ctx.t - ha) / 0.3);
    egg.p.chickYaw = Math.sin(ctx.t * 2.5) * 0.5; egg.p.chickPitch = 0.2;
    if (ctx.t > ha + 0.2) { roy.p.eyes = silo.p.eyes = 'happy'; roy.p.squash = silo.p.squash = 0.25 * Math.max(0, Math.sin((ctx.t - ha) * 10)) * Math.exp(-(ctx.t - ha) * 2); }
    move(ctx, { pos: [599.16, 0.62, -0.75], target: [599.16, 0.42, 0.62], fov: 46 }, { pos: [599.16, 0.6, -0.6], target: [599.16, 0.42, 0.62], fov: 44 });
    hit(ctx, cr, 0.004, 0.15); bump(ctx, ha, 1.06);
    ctx.W.fx.hearts({ at: [599.16, 0.62, 0.6], t0: tg, count: 7, size: 0.06, rise: 0.35, spread: 0.35, life: 1.0, seed: 11 });
    for (let i = 0; i < 3; i++) ctx.W.fx.glint({ at: [599.12 + (i - 1) * 0.06, 0.42 + i * 0.03, 0.5], t0: ha + i * 0.05, size: 0.05 });
    ZL(ctx, [599.2, 0.3, 0.6], 2, 0.5);
  } },
  // 38. "He hands you a towel."  he hands soaked YOU a fluffy white towel; it lands around his neck.
  s38: { update(ctx) {
    const you = wetTowelYOU(ctx, false), rich = richGive(ctx), tw = ctx.ev('towel');
    face(you, 'open', 'raised', 'smile'); you.p.blush = 1; you.p.lookAt = [RICH_HAND[0], FY + 1.65, RICH_HAND[1]];
    face(rich, 'happy', 'raised', 'smile'); rich.p.lookAt = [YOU_STAND[0], FY + 1.6, YOU_STAND[1]];
    const towel = ctx.W.set.props.towel;
    const k = smooth(clamp((ctx.t - ctx.shot.t0) / (tw - ctx.shot.t0)));
    if (ctx.t < tw) {
      towel.visible = true; towel.position.set(lerp(0.12, 0.05, k), FY + lerp(1.05, 1.25, k), lerp(187.55, 187.85, k)); towel.rotation.set(0, 0, 0);
      rich.p.gripL = { prop: towel, which: 'L', pose: 'grip' }; rich.p.gripR = { prop: towel, which: 'R', pose: 'grip' };
    } else { you.p.towel = true; rich.p.handL = L(rich, 0.2, 1.0, 0.1); rich.p.handR = L(rich, -0.2, 1.0, 0.1); }
    move(ctx, { pos: [0.62, FY + 1.78, 186.15], target: [-0.02, FY + 1.42, 188.05], fov: 42 }, { pos: [0.6, FY + 1.77, 186.3], target: [-0.02, FY + 1.43, 188.05], fov: 41 });
    pose(ctx);
    if (ctx.t > tw) for (let i = 0; i < 4; i++) ctx.W.fx.glint({ at: you.chestPos().add(v3((i - 1.5) * 0.08, 0.12 + (i % 2) * 0.06, -0.06)).toArray(), t0: tw + i * 0.05, size: 0.06 });
    BL(ctx, [0, FY + 1, 187.6], 0.45);
  } },
  // 39. "Then a coffee."  a steaming mug goes into YOU's hands.
  s39: { update(ctx) {
    const you = wetTowelYOU(ctx, true), rich = richGive(ctx), cf = ctx.ev('coffee');
    face(you, 'open', 'raised', 'smile'); you.p.blush = 1; you.p.lookAt = [RICH_HAND[0], FY + 1.65, RICH_HAND[1]];
    face(rich, 'happy', 'raised', 'smile'); rich.p.lookAt = [YOU_STAND[0], FY + 1.6, YOU_STAND[1]];
    const mug = ctx.W.set.props.mug; mug.visible = true;
    const k = smooth(clamp((ctx.t - ctx.shot.t0) / (cf - ctx.shot.t0 + 0.05)));
    mug.position.set(lerp(0.15, 0.02, k), FY + lerp(1.15, 1.2, k), lerp(187.5, 187.82, k)); mug.rotation.set(0, Math.PI / 2, 0);
    if (ctx.t < cf) { rich.p.gripR = { prop: mug, pose: 'grip' }; rich.p.handL = L(rich, 0.2, 1.0, 0.1); you.p.handL = L(you, 0.2, 0.95, 0.12); you.p.handR = L(you, -0.2, 0.95, 0.12); }
    else { you.p.gripL = { prop: mug, which: 'L', pose: 'grip' }; you.p.gripR = { prop: mug, which: 'R', pose: 'grip' }; rich.p.handR = L(rich, -0.2, 1.0, 0.1); rich.p.handL = L(rich, 0.2, 1.0, 0.1); }
    move(ctx, { pos: [-0.5, FY + 1.75, 186.25], target: [0.02, FY + 1.36, 188.0], fov: 42 }, { pos: [-0.48, FY + 1.74, 186.4], target: [0.02, FY + 1.37, 188.0], fov: 41 });
    ctx.W.fx.steam({ at: [mug.position.x, mug.position.y + 0.06, mug.position.z], amount: 1, size: 0.05, rise: 0.28 });
    BL(ctx, [0, FY + 1, 187.6], 0.45);
  } },
  // 40. "Then a key."  close-up: a golden key drops into YOU's open palm, sparkle.
  s40: { update(ctx) {
    const you = wetTowelYOU(ctx, true), ky = ctx.ev('key');
    face(you, 'wide', 'raised', 'o');
    const palm = L(you, -0.06, 1.12, 0.3);
    you.p.handR = palm; you.p.handPoseR = 'open';
    you.p.handRotR = euler([-1, 0, 0], [0, 0, -1], [0, -1, 0]);
    pose(ctx);
    const pp = you.palmPos('R');
    const key = ctx.W.set.props.key; key.visible = true;
    const fall = clamp((ctx.t - (ky - 0.28)) / 0.28);
    key.position.set(pp.x + 0.0, pp.y + 0.015 + (1 - easeIn(fall)) * 0.55, pp.z - 0.01); key.rotation.set(Math.PI / 2, 0, 0.6 + (1 - fall) * 2);
    if (ctx.t > ky) key.position.y += 0.012 * Math.exp(-(ctx.t - ky) * 12) * Math.sin((ctx.t - ky) * 40);
    move(ctx, { pos: [-0.05, FY + 1.62, 187.35], target: [pp.x, pp.y, pp.z], fov: 34 }, { pos: [-0.05, FY + 1.58, 187.45], target: [pp.x, pp.y, pp.z], fov: 32 });
    ctx.W.fx.glint({ at: [pp.x + 0.03, pp.y + 0.04, pp.z - 0.02], t0: ky + 0.02, size: 0.09 });
    ctx.W.fx.glint({ at: [pp.x - 0.04, pp.y + 0.07, pp.z], t0: ky + 0.12, size: 0.06 });
    bump(ctx, ky, 1.05);
    BL(ctx, [0, FY + 1.1, 187.6], 0.5);
  } },
  // 41. "You never leave."  time-lapse of the mansion: days and nights fly by, windows flick on and off.
  s41: { update(ctx) {
    const s = ctx.W.set.state, u = ctx.u;
    s.day = 0.15 + u * 1.6;
    s.windowsLit = 0.6 + 0.4 * Math.sin(ctx.t * 37);
    move(ctx, { pos: [-2, 5, 58], target: [0, 9, 100], fov: 50 }, { pos: [-1.5, 5.4, 61], target: [0, 9, 100], fov: 49 });
    ctx.cam.handheld(0);
    light(ctx, [0, 4, 95], 26, 0.2);
  } },
  // 42. "He gives you your own bathroom."  in the hallway he presents a door with a big sweep; YOU in a gold robe.
  s42: { update(ctx) {
    const yr = YROBE(ctx), rich = RICH(ctx), pr = ctx.ev('present');
    show(yr, [1.55, 110.85], 1.15, FY); show(rich, [1.85, 113.35], -2.45, FY);
    face(yr, 'open', 'raised', 'smile'); yr.p.lookAt = [YOUR_DOOR.x, FY + 1.9, YOUR_DOOR.z];
    face(rich, 'happy', 'raised', 'smile'); rich.p.lookAt = [1.55, FY + 1.6, 110.85];
    const k = after(ctx.t, pr - 0.3, 0.35);
    rich.p.handR = [lerp(1.95, 2.35, k), FY + lerp(1.0, 1.5, k), lerp(113.0, 112.35, k)]; rich.p.handPoseR = k > 0.5 ? 'open' : 'relaxed';
    if (ctx.t > pr) { face(yr, 'wide', 'raised', 'o'); yr.p.handL = L(yr, 0.08, 1.38, 0.2); yr.p.handR = L(yr, -0.08, 1.38, 0.2); yr.p.handPoseL = yr.p.handPoseR = 'flat'; }
    move(ctx, { pos: [-1.6, FY + 1.6, 109.6], target: [2.1, FY + 1.45, 112.1], fov: 46 }, { pos: [-1.45, FY + 1.6, 109.85], target: [2.1, FY + 1.45, 112.1], fov: 45 });
    ctx.W.fx.glint({ at: [YOUR_DOOR.x - 0.08, FY + 1.78, YOUR_DOOR.z], t0: pr + 0.05, size: 0.18 });
    light(ctx, [1.6, FY + 1, 112], 4, 0.4, { key: { dir: [-0.3, 1, -0.4], color: '#ffe0b4', intensity: 2.0 } });
  } },
  // 43. "With your name on the door."  close-up of the gold plaque: YOU. Sparkles.
  s43: { update(ctx) {
    const nm = ctx.ev('name');
    move(ctx, { pos: [1.65, FY + 1.82, 111.98], target: [YOUR_DOOR.x, FY + 1.78, 112.0], fov: 34 }, { pos: [1.85, FY + 1.81, 112.0], target: [YOUR_DOOR.x, FY + 1.78, 112.0], fov: 30 });
    for (let i = 0; i < 4; i++) ctx.W.fx.glint({ at: [YOUR_DOOR.x - 0.09, FY + 1.78 + (i % 2 ? 0.07 : -0.06), YOUR_DOOR.z + (i - 1.5) * 0.11], t0: nm + i * 0.08, size: 0.07 });
    ctx.W.fx.glint({ at: [YOUR_DOOR.x - 0.09, FY + 1.78, YOUR_DOOR.z - 0.2], size: 0.05 });
    light(ctx, [2.4, FY + 1.6, 112], 2, 0.55, { key: { dir: [-0.6, 1, -0.2], color: '#ffe8c0', intensity: 2.0 } });
  } },
  // 44. "Welcome home."  behind the two of them (matching gold robes): the door swings open on YOUR bathroom,
  //     the golden toilet with ONE big red button glows in the middle. He puts his arm around YOU.
  s44: { update(ctx) {
    const s = ctx.W.set.state, wl = ctx.ev('welcome');
    s.yourDoor = clamp((ctx.t - (ctx.shot.t0 + 0.15)) / 0.65);
    const yr = YROBE(ctx), rich = RICH(ctx);
    show(yr, [1.72, 111.66], Math.PI / 2, FY); show(rich, [1.62, 112.48], Math.PI / 2, FY);
    face(yr, 'wide', 'raised', 'o'); face(rich, 'happy', 'raised', 'smile');
    yr.p.lookAt = [MYTHRONE.pos[0], FY + 0.9, MYTHRONE.pos[1]];
    rich.p.lookAt = [MYTHRONE.pos[0], FY + 0.9, MYTHRONE.pos[1]];
    if (ctx.t > wl - 0.25) { yr.p.lookAt = [1.62, FY + 1.7, 112.48]; face(yr, 'happy', 'raised', 'grin'); yr.p.blush = 1; rich.p.lookAt = [1.72, FY + 1.62, 111.66]; }
    move(ctx, { pos: [-0.85, FY + 1.72, 112.06], target: [7.4, FY + 0.92, 111.98], fov: 40 }, { pos: [-0.5, FY + 1.68, 112.06], target: [7.4, FY + 0.95, 111.98], fov: 37 }, easeInOut);
    const g = after(ctx.t, ctx.shot.t0 + 0.4, 0.6);
    ctx.W.fx.glow({ at: [MYTHRONE.pos[0] - 0.1, FY + 0.83, MYTHRONE.pos[1] - 0.55], size: 0.55 * g, amount: g, opacity: 0.6, color: '#ff4a3a' });
    ctx.W.fx.glow({ at: [MYTHRONE.pos[0] - 0.3, FY + 1.3, MYTHRONE.pos[1]], size: 2.2 * g, amount: g, opacity: 0.3, color: '#ffe0a0' });
    ctx.W.fx.glint({ at: [MYTHRONE.pos[0] - 0.12, FY + 0.95, MYTHRONE.pos[1] - 0.55], t0: ctx.shot.t0 + 0.75, size: 0.12 });
    ctx.W.fx.hearts({ at: [1.68, FY + 2.0, 112.07], t0: wl + 0.05, count: 7, size: 0.09, rise: 0.45, spread: 0.3, life: 1.8, seed: 21 });
    s.bulb = 2.2 * g; s.bulbPos = [6.2, FY + 2.6, 112];
    light(ctx, [3.5, FY + 1, 112], 5, 0.4, { key: { dir: [0.5, 1, 0.2], color: '#ffe0b8', intensity: 1.9 }, fillColor: '#ffd8c8' });
  } },
};
