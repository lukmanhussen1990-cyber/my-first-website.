// The kid: about 10, toy-like (~0.95 m, big round head, big eyes), messy hair, a
// red-and-cream striped T-shirt, denim shorts, sneakers, a nervous face; their
// shovel; and all their acting, as a pure function of time.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, sph, cap, onSph, std, objPatch, skinMat, cottonMat, hairMat, faceMats, mesh, limb, makeEye, setEye, makeMouths, showMouth, faceBits, sweatDrop, blinkAt, swing } from './toy.js';

function buildKid(ctx, F) {
  const M = {
    skin: skinMat('#f0b78f', 'kskin'),
    shirt: cottonMat('#ffffff', 'kshirt', `{ float st = smoothstep(0.42, 0.58, abs(fract(p.y * 13.0) - 0.5) * 2.0);
        st = mix(0.5, st, oaa(13.0));
        c *= mix(vec3(0.97, 0.92, 0.8), vec3(0.86, 0.2, 0.17), st); }`),
    shirtTrim: cottonMat('#d0352c', 'kshirt2'),
    denim: cottonMat('#4a6a9c', 'kdenim', '{ c *= 0.9 + 0.14 * chn(vec3(p.x * 60.0 + p.y * 60.0, p.z * 60.0, 0.0)) * oaa(60.0); }', 0.9),
    sock: cottonMat('#f4f1ea', 'ksock'),
    shoe: std('#3f7fd0', 0.5),
    shoeTrim: std('#f6f3ec', 0.55),
    sole: std('#e9e3d8', 0.7),
    hair: hairMat('#4a2c1a', 'khair'),
    iris: std('#6b4128', 0.25),
    brow: std('#3a2216', 0.7),
    wood: objPatch(std('#b07a44', 0.6), { colorFn: 'woodC', key: 'kwood', extra: 'vec3 woodC(vec3 p){ return vec3(0.82 + 0.3 * chn(vec3(p.x * 40.0, p.y * 2.0, p.z * 40.0)) * oaa(40.0)); }' }),
    metal: std('#aab2ba', 0.3, 0.9, { envMap: ctx.envMap, envMapIntensity: 1.0 }),
    grip: std('#d33a2f', 0.55),
  };
  ctx.envMats.push(M.metal);
  const root = new THREE.Group();
  const body = new THREE.Group(); // squash and stretch
  root.add(body);
  const hips = new THREE.Group();
  hips.position.y = 0.3;
  body.add(hips);
  // legs pivot at the hips: shorts, shins, socks, sneakers
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.07, 0, 0);
    leg.add(limb(V(0, 0.01, 0), V(0, -0.085, 0), 0.068, M.denim));
    leg.add(limb(V(0, -0.08, 0), V(0, -0.2, 0), 0.04, M.skin));
    leg.add(limb(V(0, -0.19, 0), V(0, -0.228, 0), 0.044, M.sock));
    const foot = mesh(new RoundedBoxGeometry(0.105, 0.075, 0.16, 3, 0.035), M.shoe);
    foot.position.set(0, -0.255, 0.028);
    const toe = mesh(new RoundedBoxGeometry(0.09, 0.04, 0.05, 2, 0.018), M.shoeTrim, false);
    toe.position.set(0, -0.27, 0.095);
    const sole = mesh(new RoundedBoxGeometry(0.11, 0.022, 0.165, 2, 0.01), M.sole, false);
    sole.position.set(0, -0.286, 0.028);
    leg.add(foot, toe, sole);
    hips.add(leg);
    legs.push(leg);
  }
  // torso: a striped T-shirt over a round tummy
  const torso = new THREE.Group();
  hips.add(torso);
  const trunk = mesh(sph(0.165, 30, 22), M.shirt);
  trunk.scale.set(1.0, 1.08, 0.84);
  trunk.position.y = 0.13;
  const hem = mesh(new THREE.TorusGeometry(0.15, 0.016, 8, 32), M.shirt, false);
  hem.rotation.x = Math.PI / 2;
  hem.scale.set(1, 0.84, 1);
  const collar = mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 24), M.shirtTrim, false);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.29;
  torso.add(trunk, collar);
  const chest = new THREE.Object3D();
  chest.position.set(0, 0.18, 0.17);
  torso.add(chest);
  // arms pivot at the shoulders, hanging along -y (front = +z). [0] right (-x), [1] left
  const arms = [], hands = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.155, 0.225, 0);
    sh.add(limb(V(0, 0.01, 0), V(0, -0.075, 0), 0.054, M.shirt));
    sh.add(limb(V(0, -0.06, 0), V(0, -0.2, 0), 0.04, M.skin));
    const hand = new THREE.Group();
    hand.position.y = -0.245;
    const palm = mesh(sph(0.05, 18, 14), M.skin);
    palm.scale.set(1, 1.05, 0.85);
    hand.add(palm);
    const thumb = mesh(cap(0.017, 0.03, 4, 8), M.skin);
    thumb.position.set(-s * 0.035, 0.005, 0.03);
    thumb.rotation.set(0.6, 0, s * 0.5);
    hand.add(thumb);
    sh.add(hand);
    torso.add(sh);
    arms.push(sh);
    hands.push(hand);
  }
  // head on a neck pivot, a throat bump for the gulp
  const neck = new THREE.Group();
  neck.position.y = 0.3;
  torso.add(neck);
  neck.add(limb(V(0, -0.02, 0), V(0, 0.06, 0), 0.045, M.skin));
  const throat = mesh(sph(0.022, 12, 8), M.skin, false);
  throat.position.set(0, 0.03, 0.04);
  neck.add(throat);
  const head = new THREE.Group();
  head.position.y = 0.17;
  neck.add(head);
  const R = 0.19;
  head.add(mesh(sph(R, 40, 30), M.skin));
  // messy hair: a cap over the top and back, and tufts sticking out every which way
  const hairCap = sph(R * 1.06, 40, 18, 0, Math.PI * 2, 0, Math.PI * 0.47);
  hairCap.rotateX(-0.4);
  head.add(mesh(hairCap, M.hair));
  const rnd = ctx.U.mulberry32(31);
  const tufts = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const yaw = (rnd() - 0.5) * 3.6, pitch = 0.35 + rnd() * 1.1;
    if (Math.abs(yaw) < 0.55 && pitch < 0.62) continue; // keep the face clear
    // soft rounded tufts (a squashed blob drawn out along its own axis)
    const len = 0.04 + 0.035 * rnd(), rr = 0.024 + 0.012 * rnd();
    const g = new THREE.SphereGeometry(rr, 12, 8);
    g.scale(1, len / rr * 0.75, 1);
    g.translate(0, len * 0.45, 0);
    const m = mesh(g, M.hair);
    const p = onSph(R * 1.0, yaw, pitch);
    m.position.copy(p);
    const dir = p.clone().normalize().add(V((rnd() - 0.5) * 0.9, 0.25 + rnd() * 0.3, (rnd() - 0.5) * 0.6 - 0.15)).normalize();
    m.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
    tufts.add(m);
  }
  // a messy fringe over the forehead
  for (const [yaw, r, dy] of [[-0.45, 0.058, 0.0], [-0.16, 0.064, 0.03], [0.14, 0.06, 0.02], [0.42, 0.054, -0.01]]) {
    const f = mesh(sph(r, 16, 12), M.hair);
    f.position.copy(onSph(R * 0.985, yaw, 0.6 + dy));
    f.scale.set(1.25, 0.66, 0.9);
    f.rotation.z = yaw * 0.6;
    tufts.add(f);
  }
  head.add(tufts);
  faceBits(head, R, F, M.skin);
  // eyes and brows
  const eyes = [], brows = [];
  for (const s of [-1, 1]) {
    const e = makeEye(0.06, M.iris, M.skin, F);
    e.g.position.copy(onSph(R - 0.03, s * 0.33, 0.06));
    e.g.lookAt(e.g.position.clone().multiplyScalar(2).add(V(0, 0, 0.05)));
    head.add(e.g);
    eyes.push(e);
    const b = new THREE.Group();
    b.position.copy(onSph(R + 0.004, s * 0.33, 0.4));
    b.lookAt(b.position.clone().multiplyScalar(2));
    const bm = mesh(cap(0.013, 0.058, 4, 8), M.brow, false);
    bm.rotation.z = Math.PI / 2;
    b.add(bm);
    head.add(b);
    b.userData.y0 = b.position.y;
    brows.push(b);
  }
  const mouths = makeMouths(head, R, F);
  const sweat = sweatDrop(F);
  head.add(sweat);
  // the shovel (in the right hand, along the arm)
  const shovel = new THREE.Group();
  {
    shovel.add(limb(V(0, 0.1, 0), V(0, -0.34, 0), 0.013, M.wood));
    const tgrip = mesh(cap(0.017, 0.07, 4, 8), M.grip);
    tgrip.rotation.z = Math.PI / 2;
    tgrip.position.y = 0.12;
    const neckS = mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.05, 10), M.metal);
    neckS.position.y = -0.35;
    const blade = mesh(sph(0.085, 20, 12, 0, Math.PI, 0, Math.PI), M.metal);
    blade.scale.set(0.95, 1.2, 0.3);
    blade.rotation.set(0, Math.PI / 2, 0);
    blade.position.y = -0.43;
    shovel.add(tgrip, neckS, blade);
    hands[0].add(shovel);
  }
  return { root, body, hips, legs, torso, chest, arms, hands, neck, throat, head, tufts, eyes, brows, mouths, sweat, shovel, R };
}

export function build(ctx) {
  const { T, WD, U } = ctx;
  const { clamp, lerp, prog, smooth, popIn, easeOutBack, easeOutCubic, easeInOutCubic, bump } = U;
  const F = faceMats();
  const k = buildKid(ctx, F);
  ctx.add(k.root);
  ctx.anchors.kidHandR = k.hands[0];
  ctx.anchors.kidHandL = k.hands[1];
  ctx.anchors.kidHead = k.head;
  ctx.anchors.kidChest = k.chest;
  // little dust puffs (shovel pops, claps), placed in world space
  const puffs = ctx.instanced(ctx.FX.puffGeo, ctx.FX.puffMat, 10, false);
  const ramp = (t, a, d) => smooth(prog(t, a, d));
  const win = (t, a, b, f = 0.2) => bump(t, a, b, f);
  const { KID_SPOT: KS, LANE, HOLE } = WD;
  const FACE_HOLE = -1.05; // facing the hole (left), three-quarters to the camera
  // even-speed walk along a polyline [[x, z], ...] over [t0, t1]
  function walkPath(pts, t, t0, t1) {
    const L = [];
    let tot = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(l); tot += l; }
    const u = smooth(prog(t, t0, t1 - t0));
    let d = u * tot;
    for (let i = 0; i < L.length; i++) {
      if (d <= L[i] || i === L.length - 1) {
        const f = clamp(d / L[i]);
        return { x: lerp(pts[i][0], pts[i + 1][0], f), z: lerp(pts[i][1], pts[i + 1][1], f), dir: Math.atan2(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]), dist: u * tot, moving: u > 0 && u < 1 };
      }
      d -= L[i];
    }
    const e = pts[pts.length - 1];
    return { x: e[0], z: e[1], dir: 0, dist: tot, moving: false };
  }
  // smooth angle blend (shortest way round)
  const angLerp = (a, b, f) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * f;

  function poseKid(t) {
    const P = {
      x: KS.x, y: 0, z: KS.z, ry: FACE_HOLE,
      crouch: 0, lean: 0, roll: 0, squash: 0, walk: 0, walkPh: 0,
      aR: [0.15, 0.08], aL: [0.15, 0.08], // [forward (0 down, pi/2 ahead, pi up), out to the side]
      hYaw: 0, hPitch: 0, hRoll: 0, gx: 0, gy: 0, open: 1, wide: 0, browL: 0, browR: 0, worry: 0.5,
      mouth: 'nervous', sweat: -1, gulp: 0, shTilt: 0, twist: 0,
    };
    P.roll = Math.sin(t * 1.7) * 0.02;
    // ---------------- scene 1 ----------------
    if (t < T.shovelIn + 0.25) {
      // holding the card up in both hands, looking down at it, then the gulp
      P.ry = lerp(-0.42, FACE_HOLE, ramp(t, T.shovelIn - 0.1, 0.4));
      P.aR = [1.05, -0.32];
      P.aL = [1.05, -0.32];
      P.hPitch = -0.38 + 0.18 * win(t, T.gulp - 0.05, T.gulp + 0.4, 0.1);
      P.gy = -0.3;
      P.worry = 1;
      P.gulp = win(t, T.gulp - 0.05, T.gulp + 0.45, 0.12);
      P.wide = 0.6 * win(t, T.gulp - 0.1, T.gulp + 0.7, 0.15);
      P.squash = -0.04 * P.gulp;
      P.mouth = P.gulp > 0.3 ? 'flat' : 'nervous';
    }
    if (t >= T.shovelIn - 0.05 && t < T.snatch) {
      // shovel in the right hand, the card low in the left
      const inK = ramp(t, T.shovelIn - 0.05, 0.3);
      P.aL = [lerp(1.05, 0.25, inK), lerp(-0.32, 0.12, inK)];
      P.aR = [lerp(1.05, 0.7, inK), lerp(-0.32, 0.05, inK)];
      P.shTilt = 0.5;
      P.hPitch = lerp(P.hPitch, -0.2, inK);
      // three scoops: blade into the hole, toss over the right shoulder
      const sw = swing(U, t, T.dig1, 0.42);
      if (sw.on) {
        P.aR = [lerp(0.75, 2.5, sw.lift) - 0.3 * sw.chop, 0.05];
        P.shTilt = lerp(0.7, -0.2, sw.lift);
        P.lean = 0.3 - 0.35 * sw.lift + 0.15 * sw.chop;
        P.twist = 0.45 * sw.lift;
        P.hPitch = -0.35 + 0.3 * sw.lift;
        P.mouth = 'flat';
      }
      // the flick: the left hand flings the card into the hole
      const fl = win(t, T.cardDrop - 0.2, T.cardDrop + 0.35, 0.12);
      P.aL = [lerp(P.aL[0], 1.45, fl), lerp(P.aL[1], -0.1, fl)];
      P.hPitch = lerp(P.hPitch, -0.45, win(t, T.cardDrop, T.cardLand + 0.3, 0.15));
      // two scoops back from the pile: turn to it, scoop, turn back, dump
      for (const s of T.fill1) {
        const w = win(t, s - 0.4, s + 0.05, 0.18);
        P.ry = angLerp(P.ry, 0.55, w);
        P.lean += 0.2 * w;
        P.aR = [lerp(P.aR[0], 0.6, w), P.aR[1]];
        const d = win(t, s + 0.02, s + 0.35, 0.1);
        P.aR = [lerp(P.aR[0], 1.25, d), P.aR[1]];
        P.shTilt = lerp(P.shTilt, 0.9, d);
      }
      // pats with the back of the shovel
      const pt = swing(U, t, T.pat, 0.3);
      if (pt.on) {
        P.aR = [lerp(0.8, 1.5, pt.lift) - 0.2 * pt.chop, 0.0];
        P.shTilt = 0.9;
        P.lean = 0.28;
      }
      // satisfied: leans on the shovel, smug
      const pr = ramp(t, T.proud1, 0.3) * (1 - ramp(t, T.dogGo + 0.3, 0.3));
      if (pr > 0) {
        P.aR = [lerp(P.aR[0], 0.35, pr), lerp(P.aR[1], 0.0, pr)];
        P.shTilt = lerp(P.shTilt, 0.0, pr);
        P.lean = lerp(P.lean, -0.06, pr);
        P.roll = lerp(P.roll, 0.08, pr);
        P.hPitch = lerp(P.hPitch, 0.18, pr);
        P.ry = angLerp(P.ry, -0.55, pr);
        P.worry = lerp(P.worry, 0, pr);
        P.open = lerp(1, 0.55, pr);
        if (pr > 0.5) P.mouth = 'smirk';
      }
      // "Sort of.": a worried glance left at the doghouse
      const gl = ramp(t, T.dogPeek + 0.05, 0.25);
      if (gl > 0) {
        P.hYaw = lerp(P.hYaw, -0.6, gl);
        P.gx = -0.25 * gl;
        P.open = lerp(P.open, 1, gl);
        P.wide = 0.5 * gl;
        P.worry = lerp(P.worry, 1, gl);
        if (gl > 0.5) P.mouth = 'nervous';
      }
      // scene 2: watching the dog dig it up
      const dg = ramp(t, T.dogDig0, 0.3);
      if (dg > 0) {
        P.aL = [lerp(P.aL[0], 2.3, dg), lerp(P.aL[1], -0.25, dg)]; // hand to the cheek
        P.hYaw = lerp(P.hYaw, -0.25, dg);
        P.hPitch = lerp(P.hPitch, -0.25, dg);
        P.mouth = t > T.dogGrab ? 'frown' : 'o';
        P.wide = 0.7;
      }
    }
    // the snatch: lunge left, grab the card from the dog's mouth
    if (t >= T.snatch - 0.25 && t < T.deep0) {
      const l = win(t, T.snatch - 0.25, T.deep0 - 0.02, 0.15);
      P.x = lerp(KS.x, 0.42, l);
      P.ry = FACE_HOLE + 0.2;
      P.aL = [lerp(1.0, 1.55, l), 0.0];
      P.aR = [0.5, 0.05];
      P.lean = 0.25 * l;
      P.mouth = 'frown';
      P.worry = 0.2;
      P.browL = -0.5; P.browR = -0.5;
    }
    // ---------------- the deep dig, inside the hole ----------------
    if (t >= T.deep0 && t < T.climb0) {
      const hop = prog(t, T.deep0, 0.28);
      const floor = -WD.fillTop(t);
      if (hop < 1) {
        P.x = lerp(0.42, HOLE.x + 0.02, smooth(hop));
        P.y = lerp(0, floor, smooth(hop)) + 0.32 * Math.sin(Math.PI * hop);
      } else {
        P.x = HOLE.x + 0.02;
        P.y = floor;
      }
      P.ry = lerp(FACE_HOLE, -0.3, ramp(t, T.deep0, 0.3));
      const sw = swing(U, t, WD.DEEP_T, 0.32);
      P.aR = [lerp(0.5, 2.7, sw.lift) - 0.25 * sw.chop, 0.0];
      P.shTilt = lerp(0.9, -0.3, sw.lift);
      P.aL = [0.35, 0.15]; // card held low in the left hand
      P.lean = 0.35 - 0.4 * sw.lift;
      P.crouch = 0.25;
      P.hPitch = -0.3 + 0.55 * sw.lift;
      P.mouth = 'grin';
      P.worry = 0;
      P.browL = -0.4; P.browR = -0.4;
      // lays the card down at the bottom
      const lay = win(t, T.cardDown - 0.25, T.cardDown + 0.2, 0.12);
      P.crouch = lerp(P.crouch, 0.85, lay);
      P.lean = lerp(P.lean, 0.5, lay);
      P.aL = [lerp(P.aL[0], 0.75, lay), P.aL[1]];
      P.aR = [lerp(P.aR[0], 0.3, lay), P.aR[1]];
    }
    // climbing the ladder, hopping out
    if (t >= T.climb0 && t < T.refill0 + 0.1) {
      const u = prog(t, T.climb0, T.climb1 - T.climb0);
      const L = WD.LADDER;
      P.x = L.x;
      P.z = L.z + 0.2;
      P.y = lerp(-HOLE.DEEP + 0.03, 0.05, easeInOutCubic(u));
      P.ry = Math.PI;
      const c = Math.sin(u * Math.PI * 7);
      P.aR = [2.6 + 0.35 * c, 0.1];
      P.aL = [2.6 - 0.35 * c, 0.1];
      P.walk = 0.7;
      P.walkPh = u * Math.PI * 7;
      P.mouth = 'grin';
      P.hPitch = 0.3;
      const out = prog(t, T.climb1, T.refill0 + 0.1 - T.climb1);
      if (out > 0) {
        P.x = lerp(L.x, KS.x + 0.6, smooth(out));
        P.z = lerp(L.z + 0.2, LANE, smooth(out));
        P.y = 0.05 + 0.25 * Math.sin(Math.PI * Math.min(1, out * 1.6));
        P.ry = angLerp(Math.PI, -Math.PI / 2, smooth(out));
        P.aR = [lerp(2.6, 1.0, out), 0.05];
        P.aL = [lerp(2.6, 1.0, out), 0.05];
        P.walk = 0;
      }
    }
    // pushing the whole pile back in with the shovel
    if (t >= T.refill0 + 0.1 && t < T.refill1 + 0.45) {
      const u = prog(t, T.refill0 + 0.1, T.refill1 - T.refill0);
      P.x = lerp(KS.x + 0.6, KS.x + 0.12, smooth(u));
      P.ry = -Math.PI / 2 + 0.2;
      P.lean = 0.4;
      P.aR = [1.0 + 0.12 * Math.sin(u * 18), -0.05];
      P.aL = [1.0 + 0.12 * Math.sin(u * 18 + 1), -0.25];
      P.shTilt = 1.1;
      P.walk = 0.5 * (1 - u);
      P.walkPh = u * 10;
      P.mouth = 'grin';
      P.worry = 0;
      const back = prog(t, T.refill1, 0.45);
      P.x = lerp(P.x, KS.x, smooth(back));
      P.ry = angLerp(P.ry, FACE_HOLE, smooth(back));
      P.lean = lerp(P.lean, 0, smooth(back));
    }
    // ---------------- scene 3: the storm ----------------
    if (t >= T.refill1 + 0.45 && t < T.fish - 0.3) {
      P.ry = FACE_HOLE + 0.25;
      const up = ramp(t, T.storm0 + 0.2, 0.4) * (1 - ramp(t, T.mud0, 0.3));
      P.hPitch = 0.55 * up;
      P.gy = 0.25 * up;
      P.wide = 0.4 * up;
      // rain: hunched, hands over the head, a shiver
      const rn = ramp(t, T.rain0 + 0.1, 0.3);
      P.aR = [lerp(0.15, 2.75, rn), lerp(0.08, -0.5, rn)];
      P.aL = [lerp(0.15, 2.75, rn), lerp(0.08, -0.5, rn)];
      P.crouch = 0.18 * rn;
      P.lean = 0.12 * rn;
      P.roll = 0.03 * Math.sin(t * 40) * rn;
      P.mouth = 'nervous';
      P.worry = 1;
      // the hole turns to mud, the card floats up: aghast
      const ag = ramp(t, T.mud0 + 0.1, 0.3);
      P.hPitch = lerp(P.hPitch, -0.45, ag);
      P.gy = lerp(P.gy, -0.3, ag);
      P.wide = lerp(P.wide, 0.9, ag);
      if (ag > 0.4) P.mouth = 'o';
      const fl = ramp(t, T.float0, T.float1 - T.float0);
      P.hPitch -= 0.25 * (1 - fl) * ag;
      P.gy += 0.25 * fl * ag;
      P.aR = [lerp(P.aR[0], 2.2, ag), lerp(P.aR[1], -0.15, ag)]; // hands to the cheeks
      P.aL = [lerp(P.aL[0], 2.2, ag), lerp(P.aL[1], -0.15, ag)];
    }
    // fishes the card out of the mud and shakes it, then the box
    if (t >= T.fish - 0.3 && t < T.storm2) {
      const reach = win(t, T.fish - 0.3, T.fish + 0.35, 0.18);
      P.x = lerp(KS.x, 0.4, ramp(t, T.fish - 0.3, 0.25));
      P.ry = FACE_HOLE + 0.3;
      P.crouch = 0.7 * reach;
      P.lean = 0.5 * reach;
      P.aR = [lerp(0.6, 0.95, reach), 0.0];
      P.aL = [0.25, 0.2];
      P.hPitch = -0.5 * reach;
      P.mouth = 'flat';
      P.wide = 0.3;
      P.worry = 0.6;
      // shake it off
      const sh = win(t, T.fish + 0.35, T.box0 - 0.05, 0.08);
      P.aR = [lerp(P.aR[0], 1.35 + 0.18 * Math.sin(t * 38), sh), lerp(P.aR[1], -0.1, sh)];
      // the box snaps together in the air in front of them: excited
      const bx = ramp(t, T.box0, 0.25);
      P.wide = lerp(P.wide, 0.8, bx);
      P.hPitch = lerp(P.hPitch, 0.05, bx);
      P.hYaw = lerp(P.hYaw, -0.15, bx);
      if (bx > 0.5) P.mouth = 'grin';
      P.worry = lerp(P.worry, 0, bx);
      // the card goes in
      const put = win(t, T.cardIn - 0.3, T.cardIn + 0.15, 0.12);
      P.aR = [lerp(P.aR[0], 1.85, put), lerp(P.aR[1], -0.05, put)];
      P.lean = lerp(P.lean, 0.15, put);
      // click: a little fist pump; then lean over and watch it sink
      const pump = win(t, T.click, T.click + 0.4, 0.1);
      P.aL = [lerp(P.aL[0], 2.3, pump), P.aL[1]];
      P.squash = -0.05 * pump;
      const sk = ramp(t, T.sink0, 0.3);
      P.lean = lerp(P.lean, 0.42, sk);
      P.hPitch = lerp(P.hPitch, -0.6, sk);
      P.gy = -0.35 * sk;
      P.aR = [lerp(P.aR[0], 0.25, sk), P.aR[1]];
      P.aL = [lerp(P.aL[0], 0.25, sk), P.aL[1]];
      if (sk > 0.5) P.mouth = 'smile';
    }
    // the sun comes back: relieved wipe of the forehead
    if (t >= T.storm2 && t < T.lump0) {
      P.x = lerp(0.4, KS.x, ramp(t, T.storm2, 0.5));
      const wipe = win(t, T.storm2 + 0.3, T.storm2 + 1.2, 0.2);
      P.aR = [lerp(0.15, 2.55, wipe) + 0.1 * Math.sin(t * 12) * wipe, lerp(0.08, -0.45, wipe)];
      P.mouth = 'smile';
      P.worry = 0.3;
      P.open = 1 - 0.4 * wipe;
      // "suspicious": scratches their head at the patch
      const sc = win(t, T.sus - 0.35, T.sus + 1.0, 0.2);
      P.aR = [lerp(P.aR[0], 2.85, sc), lerp(P.aR[1], -0.35, sc) + 0.06 * Math.sin(t * 22) * sc];
      P.hPitch = lerp(P.hPitch, -0.35, sc);
      P.hRoll = 0.15 * sc;
      P.worry = lerp(P.worry, 1, sc);
      if (sc > 0.4) P.mouth = 'flat';
      P.gy = -0.3 * sc;
      // plants the flowers: crouches and pats the ground as they pop
      const pl = win(t, WD.flowerT(0) - 0.35, WD.flowerT(7) + 0.3, 0.22);
      P.crouch = lerp(P.crouch, 0.75, pl);
      P.lean = lerp(P.lean, 0.45, pl);
      P.x = lerp(P.x, 0.58, pl);
      const pat = Math.abs(Math.sin(((t - WD.flowerT(0)) * Math.PI) / T.flowerGap));
      P.aR = [lerp(P.aR[0], 0.95 - 0.2 * pat, pl), lerp(P.aR[1], 0.0, pl)];
      P.aL = [lerp(P.aL[0], 0.9 - 0.2 * (1 - pat), pl), lerp(P.aL[1], 0.0, pl)];
      P.hPitch = lerp(P.hPitch, -0.4, pl);
      if (pl > 0.3) P.mouth = 'grin';
      // proud of the flowers
      const pr = ramp(t, WD.flowerT(7) + 0.3, 0.4);
      if (pr > 0) {
        P.mouth = 'smile';
        P.worry = 0;
        P.lean = lerp(P.lean, -0.05, pr);
        P.hPitch = lerp(P.hPitch, 0.1, pr);
        P.aR = [lerp(P.aR[0], 0.2, pr), P.aR[1]];
        P.aL = [lerp(P.aL[0], 0.2, pr), P.aL[1]];
      }
    }
    // ---------------- scene 5: the lump, the roller ----------------
    if (t >= T.lump0 && t < T.roll1 + 0.6) {
      const hop = clamp(prog(t, T.lump0 + 0.15, 0.4));
      P.y = 0.14 * Math.sin(Math.PI * hop) * (hop < 1 ? 1 : 0);
      P.wide = 0.9 * (1 - ramp(t, T.lump1 + 0.6, 0.5));
      P.mouth = t < T.lump1 + 0.6 ? 'o' : 'flat';
      P.aR = [0.6 * Math.sin(Math.PI * hop), 0.55 * Math.sin(Math.PI * hop)];
      P.aL = [0.6 * Math.sin(Math.PI * hop), 0.55 * Math.sin(Math.PI * hop)];
      P.worry = 1;
      // walks over to where the roller pops in
      if (t > T.lump1 + 0.35) {
        const w = walkPath([[KS.x, LANE], [WD.rollerX(T.rollIn) + WD.KID_ROLL, LANE]], t, T.lump1 + 0.35, T.rollIn - 0.05);
        P.x = w.x;
        P.ry = w.moving ? Math.PI / 2 : angLerp(Math.PI / 2, -Math.PI / 2 + 0.3, ramp(t, T.rollIn - 0.25, 0.25));
        P.walk = w.moving ? 1 : 0;
        P.walkPh = w.dist * 9;
      }
      // pushes it: hands on the grip, walking behind it
      if (t >= T.rollIn - 0.05) {
        P.x = WD.rollerX(t) + WD.KID_ROLL;
        P.ry = -Math.PI / 2 + 0.3;
        P.aR = [1.32, -0.12];
        P.aL = [1.32, -0.12];
        P.lean = 0.3;
        const v = Math.abs(WD.rollerX(t + 0.02) - WD.rollerX(t - 0.02));
        P.walk = clamp(v * 40);
        P.walkPh = (1.45 - WD.rollerX(t)) * 9;
        P.mouth = 'grin';
        P.worry = 0;
        P.browL = -0.4; P.browR = -0.4;
      }
    }
    // admires the perfectly flat lawn, walks back, dusts off the hands, proud
    if (t >= T.roll1 + 0.6 && t < T.kidWalk0) {
      P.x = lerp(WD.rollerX(T.roll1) + WD.KID_ROLL, KS.x - 0.06, ramp(t, T.rollOut + 0.1, 0.6));
      P.ry = FACE_HOLE + 0.5;
      P.mouth = 'smile';
      P.worry = 0;
      P.wide = 0.4 * win(t, T.sparkle - 0.1, T.sparkle + 0.6, 0.15);
      let cl = 0;
      for (const c of [T.dust0, T.dust0 + 0.25, T.dust0 + 0.5]) cl = Math.max(cl, win(t, c - 0.12, c + 0.08, 0.06));
      const clap = win(t, T.dust0 - 0.25, T.dust0 + 0.75, 0.15);
      P.aR = [lerp(0.15, 1.15, clap), lerp(0.08, -0.3 - 0.12 * cl, clap)];
      P.aL = [lerp(0.15, 1.15, clap), lerp(0.08, -0.3 - 0.12 * cl, clap)];
      P.ry = angLerp(P.ry, -0.35, clap);
      // hands on hips, chest out, big grin
      const pr = ramp(t, T.proud2, 0.3);
      if (pr > 0) {
        P.aR = [lerp(P.aR[0], -0.35, pr), lerp(P.aR[1], 0.75, pr)];
        P.aL = [lerp(P.aL[0], -0.35, pr), lerp(P.aL[1], 0.75, pr)];
        P.lean = -0.12 * pr;
        P.hPitch = 0.2 * pr;
        P.ry = angLerp(P.ry, -0.2, pr);
        P.mouth = 'grin';
        P.open = 1 - 0.35 * pr;
      }
    }
    // strolls round the flower bed to the dog, then waits there happily
    if (t >= T.kidWalk0) {
      const w = walkPath(WD.KID_STROLL, t, T.kidWalk0, T.kidWalk1);
      P.x = w.x;
      P.z = w.z;
      P.ry = w.moving ? w.dir : angLerp(-Math.PI / 2, 0.5, ramp(t, T.kidWalk1, 0.5));
      P.walk = w.moving ? 1 : 0;
      P.walkPh = w.dist * 9;
      P.mouth = 'smile';
      P.worry = 0;
      P.aR = [0.1 + 0.3 * Math.sin(P.walkPh) * P.walk, 0.1];
      P.aL = [0.1 - 0.3 * Math.sin(P.walkPh) * P.walk, 0.1];
      // pats the dog
      const pat = win(t, T.kidWalk1 + 0.1, T.kidWalk1 + 1.2, 0.2);
      P.aL = [lerp(P.aL[0], 0.75 + 0.12 * Math.sin(t * 14), pat), lerp(P.aL[1], 0.3, pat)];
      P.lean = 0.15 * pat;
      P.hPitch = -0.25 * pat;
      P.hYaw = 0.35 * pat;
      // scene 7: watching Dad; the smile fades with the beeps, panic at the dig
      const look = ramp(t, T.dadOut + 0.4, 0.6);
      P.hYaw = lerp(P.hYaw, 0.55, look);
      P.gx = 0.25 * look;
      const bp = ramp(t, T.beep0, T.beep1 - T.beep0);
      P.wide = 0.8 * bp;
      P.worry = bp;
      if (bp > 0.15) P.mouth = 'flat';
      if (bp > 0.6) P.mouth = 'nervous';
      const pn = ramp(t, T.dadDig0, 0.25);
      if (pn > 0) {
        P.aR = [lerp(P.aR[0], 2.2, pn), lerp(P.aR[1], -0.2, pn)];
        P.aL = [lerp(P.aL[0], 2.2, pn), lerp(P.aL[1], -0.2, pn)];
        P.mouth = 'o';
        P.wide = 1;
        P.roll = 0.02 * Math.sin(t * 36);
      }
      // freezes when Dad reads the card; shrinks at the eyebrow
      const fr = ramp(t, T.cardOut, 0.2);
      if (fr > 0) {
        P.aR = [lerp(P.aR[0], 0.05, fr), lerp(P.aR[1], 0.0, fr)];
        P.aL = [lerp(P.aL[0], 0.05, fr), lerp(P.aL[1], 0.0, fr)];
        P.roll = 0;
        P.mouth = 'nervous';
        P.sweat = prog(t, T.cardOut + 0.2, 1.6);
      }
      const sh = ramp(t, T.brow, 0.3);
      P.crouch = 0.12 * sh;
      P.squash = 0.04 * sh;
      // the final gulp, looking at the camera
      const g2 = ramp(t, T.gulp2 - 0.5, 0.4);
      P.hYaw = lerp(P.hYaw, -0.35, g2);
      P.gx = lerp(P.gx, -0.1, g2);
      P.gulp = win(t, T.gulp2 - 0.05, T.gulp2 + 0.5, 0.12);
      if (t > T.gulp2 - 0.6) P.sweat = prog(t, T.gulp2 - 0.4, 1.4);
      if (P.gulp > 0.3) P.mouth = 'flat';
    }
    return P;
  }

  const _w = new THREE.Vector3();
  function apply(t) {
    const P = poseKid(t);
    k.root.position.set(P.x, P.y + WD.groundY(P.x, P.z, t), P.z);
    k.root.rotation.set(0, P.ry + P.twist * 0.4, P.roll * 0.4);
    const sq = P.squash;
    k.body.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    // legs: the crouch lowers the hips and keeps the feet down; walking swings them
    const crouch = clamp(P.crouch);
    const bob = P.walk * 0.018 * Math.abs(Math.sin(P.walkPh));
    k.hips.position.y = 0.3 - 0.11 * crouch + bob + 0.004 * Math.sin(t * 2.2);
    const legA = Math.acos(clamp(1 - (0.11 * crouch) / 0.27, -1, 1));
    k.legs.forEach((leg, i) => {
      const s = i === 0 ? -1 : 1;
      leg.rotation.set(-legA + P.walk * 0.45 * Math.sin(P.walkPh + (i ? Math.PI : 0)), 0, s * 0.02);
    });
    k.torso.rotation.set(P.lean + 0.25 * crouch, -P.twist * 0.6, P.roll * 0.6);
    // arms
    k.arms[0].rotation.set(-P.aR[0], 0, -P.aR[1]);
    k.arms[1].rotation.set(-P.aL[0], 0, P.aL[1]);
    k.shovel.rotation.set(P.shTilt, 0, 0);
    // head, the gulp (head dips, throat bobs)
    const g = P.gulp;
    k.neck.rotation.set(-P.hPitch * 0.4 + 0.12 * g, P.hYaw * 0.4, P.hRoll * 0.3);
    k.head.rotation.set(-P.hPitch * 0.6, P.hYaw * 0.6, P.hRoll * 0.7);
    k.throat.position.y = 0.04 - 0.05 * Math.sin(Math.PI * g);
    k.throat.scale.setScalar(1 + 0.6 * Math.sin(Math.PI * g));
    // hair bounces a little with the motion
    k.tufts.rotation.x = 0.05 * Math.sin(t * 9) * (P.walk + 0.3 * Math.abs(P.aR[0] - 0.2));
    // face
    const open = Math.min(P.open, 1 - blinkAt(U, t, 2.9, 0.13));
    k.eyes.forEach((e) => setEye(e, open, P.gx, P.gy, P.wide));
    k.brows.forEach((b, i) => {
      const s = i === 0 ? -1 : 1;
      const raise = i === 0 ? P.browR : P.browL;
      b.position.y = b.userData.y0 + 0.016 * raise + 0.008 * P.wide;
      b.rotation.z = s * 0.38 * P.worry - s * 0.15 * Math.min(0, raise);
    });
    showMouth(k.mouths, P.mouth);
    if (P.mouth === 'o') k.mouths.o.scale.set(0.9, 1 + 0.3 * P.wide, 0.35);
    // the sweat drop slides down the side of the head
    k.sweat.visible = P.sweat >= 0 && P.sweat < 1;
    if (k.sweat.visible) {
      const u = P.sweat;
      k.sweat.position.copy(onSph(k.R + 0.012, 0.95, 0.45 - 0.75 * easeInOutCubic(u)));
      k.sweat.scale.setScalar(Math.max(0.001, easeOutBack(clamp(u * 5), 2.2) * (1 - smooth(clamp((u - 0.8) / 0.2)))));
    }
    // the shovel pops in on "dig" and poofs away after the refill
    const ss = popIn(t, T.shovelIn, 0.35, 2.6) * (1 - smooth(prog(t, T.refill1 + 0.3, 0.18)));
    k.shovel.visible = ss > 0.01;
    k.shovel.scale.setScalar(Math.max(0.001, ss));
    // puffs: where the shovel appears and vanishes, and three claps
    k.root.updateMatrixWorld(true);
    ctx.beginInst(puffs);
    const puffAt = (anchor, t0, size) => {
      const u = prog(t, t0, 0.45);
      if (u <= 0 || u >= 1) return;
      anchor.getWorldPosition(_w);
      const s = size * (0.3 + 0.7 * easeOutCubic(u)) * (1 - smooth(clamp((u - 0.5) / 0.5)));
      ctx.setInst(puffs, _w.x, _w.y + 0.05 * u, _w.z + 0.04, s, s, s);
    };
    puffAt(k.hands[0], T.shovelIn - 0.02, 0.1);
    puffAt(k.hands[0], T.refill1 + 0.3, 0.12);
    for (const c of [T.dust0, T.dust0 + 0.25, T.dust0 + 0.5]) puffAt(k.hands[0], c, 0.07);
    ctx.endInst(puffs);
  }

  return { update: apply, kid: k };
}
