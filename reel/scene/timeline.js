// The director: every object's state as a pure function of story time tau (and real time t).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, smooth, smoother, sstep, easeInOut, easeOut, easeIn, easeOutBack, springPop, win, pulse, keys, keysV, hermiteTrack, Path2, mulberry32, vnoise1, shake1, fract } from './util.js';
import { groundH, makeCone, LOT } from './world.js';
import { makeCart, CART, makeWrench, makeLeafBlower, makeSteeringBar, makeBroom, makePotatoBag, Rope } from './cart.js';
import { makeCharacter, setFace, poseSit, poseStand, setArm } from './characters.js';
import { GlowArrow, FlowChevrons, Streaks, Puffs, Confetti, makeStars, makeComDot, glow } from './fx.js';
import * as TX from './textures.js';

export const FPS = 30;
export const DURATION = 56.0;
export const CART_SCALE = 0.82;

// ---------------------------------------------------------------- slow motion time warp
const SLOW = { a: 45.3, b: 47.7, fade: 0.4, k: 0.7 };
const WARP_DT = 1 / 1200;
const warpTable = (() => {
  const n = Math.ceil((DURATION + 2) / WARP_DT); const tab = new Float64Array(n + 1);
  let tau = 0;
  for (let i = 0; i <= n; i++) {
    tab[i] = tau; const t = i * WARP_DT;
    const w = sstep(SLOW.a, SLOW.a + SLOW.fade, t) * (1 - sstep(SLOW.b - SLOW.fade, SLOW.b, t));
    tau += (1 - SLOW.k * w) * WARP_DT;
  }
  return tab;
})();
export function tauOf(t) { const f = clamp(t, 0, DURATION + 1.9) / WARP_DT; const i = Math.floor(f); return lerp(warpTable[i], warpTable[i + 1], f - i); }
export function tOfTau(tau) { let lo = 0, hi = DURATION + 1.9; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (tauOf(m) < tau) lo = m; else hi = m; } return (lo + hi) / 2; }

// ---------------------------------------------------------------- paths
const P1 = new Path2(-20.0, -7.2, 0).straight(2.0).arc(2.5, 45).straight(1.87).arc(0.05, -45).straight(24.3).arc(2.2, 90).straight(14);
const S_BONK = 2.0 + 2.5 * Math.PI / 4 + 1.87;          // 5.833
const S_FIX = S_BONK + 0.05 * Math.PI / 4;               // just after the in-place pivot (heading straight again)
const S_TURN = S_FIX + 24.3;                              // start of the aisle turn
const P2 = new Path2(26.0, -25.2, Math.PI / 2).straight(30);
const P3 = new Path2(24.6, -3.6, Math.PI).straight(1.4).arc(1.4, 70).arc(1.4, -70).straight(3.0).arc(1.4, -70).arc(1.4, 70).straight(6);
const P4 = new Path2(11.75, -3.6, Math.PI).straight(4.25).arc(4, -30).arc(4, 30).straight(2.0).arc(4, 30).arc(4, -30).straight(12.5).arc(5.09, -75).arc(5.09, 75).straight(6);
const ROW = { x0: -28.85, z: -11.15, n: 8, step: 0.27 * CART_SCALE };
const S4_FINISH = 4.25 + 4.19 + 2.0 + 4.19 + 6.5; // finish line crossing (x=-9)
const S4_NEST = 4.25 + 4.19 + 2.0 + 4.19 + 12.5 + 2 * 5.09 * (75 * Math.PI / 180) + 2.26;

// distance along path keyed by (tau, s, v)
const trackP1 = hermiteTrack([
  [0, 0, 0], [3.75, 0, 0], [4.3, 0.22, 0.55], [5.2, 0.68, 0.42], [5.9, 1.1, 0.7], [7.0, 1.75, 0.55],
  [7.6, 2.15, 0.9], [8.6, 3.55, 1.9], [9.4, S_BONK, 2.6],
]);
const trackP1b = hermiteTrack([
  [12.0, S_FIX, 0], [12.5, S_FIX + 0.2, 0.5], [13.5, S_FIX + 0.6, 0.35], [14.0, S_FIX + 0.75, 0.3],
  [14.9, S_FIX + 1.05, 0.42], [16.2, S_FIX + 1.45, 0.25], [17.3, S_FIX + 1.7, 0.2], [17.6, S_FIX + 1.85, 0.9],
  [18.4, S_FIX + 3.3, 3.0], [19.2, S_FIX + 6.3, 4.3], [20.6, S_FIX + 12.2, 4.1], [21.6, S_FIX + 15.7, 3.0],
  [23.2, S_FIX + 19.9, 2.4], [24.8, S_TURN, 2.3], [26.3, S_TURN + 2.2 * Math.PI / 2, 2.3], [27.6, S_TURN + 3.456 + 3.9, 3.4], [28.6, S_TURN + 3.456 + 7.6, 3.8],
]);
function sP1(tau) { return tau < 9.4 ? trackP1(tau) : tau < 12.0 ? S_FIX : trackP1b(tau); }
const trackP2 = hermiteTrack([[27.0, -3.0, 3.0], [27.8, 0, 3.4], [29.2, 5.6, 4.6], [31.0, 14.0, 5.4], [32.2, 18.95, 2.9], [33.2, 21.05, 1.1], [34.0, 21.6, 0]]);
const trackP3 = hermiteTrack([[34.4, -2.0, 3.2], [35.0, 0, 3.4], [36.4, 4.82, 3.5], [37.6, 7.0, 1.4], [38.6, 7.6, 0.6], [39.2, 8.35, 2.4], [40.3, 11.24, 3.0], [41.2, 13.5, 1.6], [41.9, 14.43, 0]]);
const trackP4 = hermiteTrack([[43.1, 0, 0], [43.6, 1.3, 5.6], [44.2, 5.9, 8.6], [45.0, 13.1, 9.2], [45.8, S4_FINISH, 9.4], [46.6, 28.0, 7.0], [47.8, 34.4, 4.2], [49.2, 39.6, 2.6], [50.2, S4_NEST, 1.4]]);
function sP4(tau) { return tau < 43.1 ? 0 : tau < 50.2 ? trackP4(tau) : S4_NEST; }

const SEG = { // which path John uses when
  path(tau) {
    if (tau < 27.75) return { P: P1, s: sP1(tau), id: 1 };
    if (tau < 34.75) return { P: P2, s: trackP2(tau), id: 2 };
    if (tau < 42.0) return { P: P3, s: tau < 41.9 ? trackP3(tau) : 14.43, id: 3 };
    return { P: P4, s: sP4(tau), id: 4 };
  },
};

// ---------------------------------------------------------------- events (for sound design)
export const EVENTS = [
  ['jump', 1.3], ['land', 1.82], ['goggles', 2.62], ['kick', 3.78], ['kick', 5.45], ['roll_start', 3.8],
  ['wobble_start', 7.3], ['bonk', 9.4], ['wrench_pop', 10.3], ['wrench_turns', 10.6], ['wrench_done', 11.65], ['wrench_out', 11.85], ['roll_smooth', 12.2],
  ['kick', 14.35], ['kick', 15.2], ['kick', 16.0], ['blower_pop', 16.45], ['blower_on', 17.3], ['blast', 17.6], ['blower_off', 21.5],
  ['casters_spin', 21.6], ['rope_pop', 24.35], ['rope_pull', 24.7], ['turn_squeak', 24.85], ['blower_on2', 24.95], ['whip', 27.75],
  ['downhill', 27.8], ['broom_pop', 30.85], ['broom_drag', 31.0], ['stop', 33.9], ['box_wobble', 34.0], ['whip', 34.75],
  ['tip_squeal', 35.55], ['tip_slam', 36.75], ['potato1', 38.15], ['potato2', 38.42], ['corner2', 39.25], ['stop2', 41.8],
  ['flag', 43.0], ['race_start', 43.15], ['finish', 45.8], ['confetti', 45.8],
  ['silence', 49.55], ['clack', 50.2], ['worker_walk', 50.4], ['thumbs', 51.6], ['doors', 52.2], ['push', 52.5],
];

// ================================================================================================
export class Director {
  constructor(ctx) {
    this.scene = ctx.scene; this.cam = ctx.camera; this.world = ctx.world;
    const S = this.scene;
    this.tmp = {};
    // ---------------- John's cart + upgrades
    this.cart = makeCart(); this.cart.scale.setScalar(CART_SCALE); S.add(this.cart);
    const body = this.cart.userData.body;
    this.wrench = makeWrench(); S.add(this.wrench);
    this.blower = makeLeafBlower(); body.add(this.blower); this.blower.position.set(-0.66, 0.55, 0.0);
    this.bar = makeSteeringBar(); body.add(this.bar); this.bar.position.set(CART.frontX, 0.2, 0);
    this.rope = new Rope(); S.add(this.rope.mesh);
    this.broom = makeBroom(); body.add(this.broom); this.broom.position.set(-0.42, 0.22, -0.12);
    this.bags = [makePotatoBag(1), makePotatoBag(2)]; for (const b of this.bags) body.add(b);
    // ---------------- John
    this.john = makeCharacter({ skin: 0xf2c4a0, hoodie: 0xd7322e, pants: 0x2d4a7a, hair: 0x6b3f22, hairStyle: 'messy', goggles: true, iris: 0x5a3a1e, seed: 3 });
    S.add(this.john.root);
    // ---------------- rivals
    this.rivals = [
      this.makeRival({ skin: 0x8d5a3b, hoodie: 0xf2c230, pants: 0x3a3f58, hair: 0x1d1612, hairStyle: 'puffs', iris: 0x2b1a10, seed: 8, shoeAccent: 0x3bceac }, 'streamers'),
      this.makeRival({ skin: 0xf6d2b8, hoodie: 0x7b4fc9, pants: 0x2e2e38, hair: 0xd9a441, hairStyle: 'short', cap: 0x2bb3a3, capBack: true, iris: 0x2d6a8a, seed: 12, shoeAccent: 0xff8c42 }, 'spoiler'),
    ];
    // ---------------- worker
    this.worker = makeCharacter({ skin: 0xc68e62, hoodie: 0xf3f1ea, pants: 0x34404f, hair: 0x2a1d14, hairStyle: 'short', cap: 0x2e9b4f, vest: 0x2fbf57, mustache: true, iris: 0x3b2414, seed: 21, scale: 1.12, shoeAccent: 0x2e9b4f, shoes: 0x3b3b3b });
    S.add(this.worker.root);
    // ---------------- cart row by the entrance
    this.row = [];
    for (let k = 0; k < ROW.n; k++) { const c = makeCart(); c.scale.setScalar(CART_SCALE); S.add(c); this.row.push(c); }
    // ---------------- props: cones, boxes, flag, finish arch
    this.cones = [];
    const conePos = [[13.7, -8.0], [14.1, -8.7], [13.2, -7.4], [22.1, -3.75], [17.0, -4.55], [3.4, -5.32], [24.0, -6.4], [-3.4, -7.3]];
    this.raceCones = [3, 4, 5, 6, 7];
    for (const [x, z] of conePos) { const c = makeCone(); c.position.set(x, groundH(x, z), z); S.add(c); this.cones.push(c); }
    this.boxes = this.makeBoxWall(); S.add(this.boxes.group);
    this.flag = this.makeFlagStand(); S.add(this.flag.group);
    this.finish = this.makeFinishArch(); S.add(this.finish.group);
    // ---------------- fx
    this.airArrow = new GlowArrow(0x5fd4ff, 1, 0.13); S.add(this.airArrow.group);
    this.pushArrow = new GlowArrow(0xffb238, 1, 0.16); S.add(this.pushArrow.group);
    this.fricArrow = new GlowArrow(0xff4b3e, 1, 0.15); S.add(this.fricArrow.group);
    this.gravArrow = new GlowArrow(0xffe066, 1, 0.11); S.add(this.gravArrow.group);
    this.airFlow = new FlowChevrons(0x9ae8ff, 6); S.add(this.airFlow.group);
    this.sparks = new Streaks(260, 0xffb347, { width: 0.012 }); S.add(this.sparks.mesh);
    this.wisps = new Streaks(160, 0xdff6ff, { width: 0.02, tex: TX.makeStreak() }); S.add(this.wisps.mesh);
    this.speedLines = new Streaks(70, 0xffffff, { width: 0.025, tex: TX.makeStreak() }); S.add(this.speedLines.mesh);
    this.dust = new Puffs(40, 0xd8c3a5); S.add(this.dust.group);
    this.flashes = new Puffs(8, 0xfff1c4, true); S.add(this.flashes.group);
    this.confetti = new Confetti(340); S.add(this.confetti.mesh);
    this.stars = makeStars(); S.add(this.stars);
    this.com = makeComDot(); S.add(this.com);
    // objects that move with/against the camera: kept sharp by the motion-blur mask (layer 1)
    this.dynamicRoots = [this.cart, this.john.root, this.wrench, this.rope.mesh, this.worker.root, ...this.rivals.flatMap((r) => [r.cart, r.rig.root]), ...this.row,
      this.airArrow.group, this.pushArrow.group, this.fricArrow.group, this.gravArrow.group, this.airFlow.group, this.sparks.mesh, this.wisps.mesh, this.speedLines.mesh, this.stars, this.com, this.confetti.mesh];
    for (const r of this.dynamicRoots) r.traverse((o) => { if (!o.isSprite) o.layers.enable(1); });
    this.fxGroups = [this.airArrow.group, this.pushArrow.group, this.fricArrow.group, this.gravArrow.group, this.airFlow.group, this.sparks.mesh, this.wisps.mesh, this.speedLines.mesh, this.dust.group, this.flashes.group, this.com];
    this.state = {};
  }

  // -------------------------------------------------------------- builders
  makeRival(opt, deco) {
    const decorate = (body) => {
      if (deco === 'streamers') {
        const cols = [0xff4d8d, 0x3bceac, 0xffd23f, 0x5e60ce];
        const rib = [];
        cols.forEach((c, i) => {
          const g = new THREE.Group(); g.position.set(-0.565, 1.05, -0.24 + i * 0.16); body.add(g);
          const segs = []; let parent = g;
          for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.04), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.5 })); p.geometry.translate(-0.075, 0, 0); const j = new THREE.Group(); j.add(p); j.position.x = k ? -0.15 : 0; parent.add(j); segs.push(j); parent = j; }
          rib.push(segs);
        });
        body.userData.ribbons = rib;
        // cardboard nose cone + number plate
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.32, 24), new THREE.MeshStandardMaterial({ map: TX.makeCardboard(3), roughness: 0.85 }));
        cone.rotation.z = -Math.PI / 2; cone.position.set(0.62, 0.7, 0); cone.castShadow = true; body.add(cone);
        body.add(numberPlate('7', 0xff4d8d, new THREE.Vector3(0.0, 0.72, 0.29)));
      } else {
        const card = new THREE.MeshStandardMaterial({ map: TX.makeCardboard(5), roughness: 0.85 });
        const wing = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.03, 0.72, 2, 0.01), new THREE.MeshStandardMaterial({ color: 0x7b4fc9, roughness: 0.5 })); wing.position.set(-0.7, 1.22, 0); wing.rotation.z = 0.15; wing.castShadow = true; body.add(wing);
        for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), card); st.position.set(-0.66, 1.12, s * 0.25); body.add(st); }
        const flamesTex = makeFlames();
        for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.24), new THREE.MeshStandardMaterial({ map: flamesTex, transparent: true, roughness: 0.6, side: THREE.DoubleSide })); f.position.set(0.0, 0.66, s * 0.285); if (s < 0) f.rotation.y = Math.PI; body.add(f); }
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.3 })); pole.position.set(-0.5, 1.3, 0.25); body.add(pole);
        const pen = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.32, -0.06, 0), new THREE.Vector3(0, -0.14, 0)]), new THREE.MeshStandardMaterial({ color: 0xff8c42, side: THREE.DoubleSide })); pen.geometry.setIndex([0, 1, 2]); pen.geometry.computeVertexNormals(); pen.position.set(-0.5, 1.64, 0.25); body.add(pen); body.userData.pennant = pen;
        body.add(numberPlate('3', 0x2bb3a3, new THREE.Vector3(0.0, 0.72, 0.29)));
      }
    };
    const cart = makeCart({ decorations: decorate }); cart.scale.setScalar(CART_SCALE); this.scene.add(cart);
    const rig = makeCharacter(opt); this.scene.add(rig.root);
    return { cart, rig };
  }
  makeBoxWall() {
    const g = new THREE.Group(); const boxes = [];
    const mats = [1, 2, 4, 6].map((s) => new THREE.MeshStandardMaterial({ map: TX.makeCardboard(s), roughness: 0.88 }));
    const r = mulberry32(31);
    const x0 = 24.6, z0 = -2.95, base = groundH(26, -2.2);
    const layout = [[0, 0, 0.62], [0.64, 0, 0.6], [1.26, 0, 0.64], [1.9, 0, 0.6], [0.3, 1, 0.6], [0.95, 1, 0.58], [1.58, 1, 0.6], [0.62, 2, 0.56], [1.24, 2, 0.6], [0.95, 3, 0.5]];
    let y = [0, 0.6, 1.18, 1.75];
    for (const [dx, lvl, s] of layout) {
      const b = new THREE.Mesh(new RoundedBoxGeometry(s, s * 0.95, s * 1.15, 2, 0.02), mats[Math.floor(r() * mats.length)]);
      b.position.set(x0 + dx + s / 2, base + y[lvl] + s * 0.475, z0 + 0.55 + (r() - 0.5) * 0.08);
      b.rotation.y = (r() - 0.5) * 0.12; b.castShadow = b.receiveShadow = true; g.add(b); boxes.push(b);
    }
    // a second, shallower wall behind
    for (let i = 0; i < 4; i++) { const s = 0.58; const b = new THREE.Mesh(new RoundedBoxGeometry(s, s * 0.95, s, 2, 0.02), mats[i % 4]); b.position.set(x0 + 0.1 + i * 0.62 + s / 2, base + s * 0.475, z0 + 1.35); b.rotation.y = (r() - 0.5) * 0.1; b.castShadow = b.receiveShadow = true; g.add(b); }
    return { group: g, top: boxes[boxes.length - 1], topBase: boxes[boxes.length - 1].position.clone() };
  }
  makeFlagStand() {
    const g = new THREE.Group(); const x = 11.2, z = -9.25; g.position.set(x, groundH(x, z), z);
    const metal = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 0.8, roughness: 0.3 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6 })); base.position.y = 0.06; g.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 2.4, 12), metal); pole.position.y = 1.2; pole.castShadow = true; g.add(pole);
    const pivot = new THREE.Group(); pivot.position.y = 2.35; g.add(pivot);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.25, 8), metal); arm.position.y = 0.62; pivot.add(arm);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.82, 12, 4), new THREE.MeshStandardMaterial({ map: TX.makeChecker(6, 4), side: THREE.DoubleSide, roughness: 0.6 }));
    flag.geometry.translate(0.6, 0, 0); flag.position.set(0.02, 0.85, 0); flag.castShadow = true; pivot.add(flag);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 0.5, roughness: 0.3 })); knob.position.y = 1.27; pivot.add(knob);
    g.rotation.y = -Math.PI / 2;
    return { group: g, pivot, flag, base: flag.geometry.attributes.position.array.slice() };
  }
  makeFinishArch() {
    const g = new THREE.Group(); const x = -9.0;
    const metal = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.5, roughness: 0.35 });
    const posts = [];
    for (const z of [-0.75, -9.25]) {
      const y0 = groundH(x, z);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 3.2, 14), metal); p.position.set(x, y0 + 1.6, z); p.castShadow = true; g.add(p);
      const foot = new THREE.Mesh(new RoundedBoxGeometry(0.35, 0.12, 0.35, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0x2a2d33 })); foot.position.set(x, y0 + 0.06, z); g.add(foot);
      // confetti cannon
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.3, 14), new THREE.MeshStandardMaterial({ color: 0xff4d6d, roughness: 0.4 })); can.position.set(x + 0.15, y0 + 0.3, z); can.rotation.z = -0.35; g.add(can);
      posts.push(new THREE.Vector3(x + 0.2, y0 + 0.45, z));
    }
    const y0 = groundH(x, -5);
    const banner = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.62, 8.6, 2, 0.04), [metal]);
    banner.position.set(x, y0 + 3.05, -5.0); g.add(banner);
    const ck = TX.makeChecker(28, 2);
    for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 0.55), new THREE.MeshStandardMaterial({ map: ck, roughness: 0.6, emissive: 0x111111 })); f.position.set(x + s * 0.065, y0 + 3.05, -5.0); f.rotation.y = s * Math.PI / 2; g.add(f); }
    // little bulbs on the banner
    const bulbM = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffe2a0, emissiveIntensity: 6 });
    for (let z = -9.0; z <= -1.0; z += 0.5) for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), bulbM); b.position.set(x + s * 0.08, y0 + 3.4, z); g.add(b); }
    const yb = groundH(x, -5) + 3.0;
    return { group: g, posts, banner: { x, y: yb, z0: -8.6, z1: -1.2 } };
  }

  // -------------------------------------------------------------- helpers
  // place a cart on the terrain; returns world matrix info
  placeCart(cart, x, z, th, o = {}) {
    const body = cart.userData.body;
    const c = Math.cos(th), s = Math.sin(th);
    const sc = CART_SCALE;
    const fx = 0.36 * sc, rx = -0.37 * sc, hz = 0.23 * sc;
    const hAt = (lx, lz) => groundH(x + c * lx - s * lz, z + s * lx + c * lz);
    // right normal of heading th (cart local +Z) is (-sin th, cos th)
    const hF = (hAt(fx, -hz) + hAt(fx, hz)) / 2, hR = (hAt(rx, -hz) + hAt(rx, hz)) / 2;
    const hLeft = (hAt(fx, -hz) + hAt(rx, -hz)) / 2, hRight = (hAt(fx, hz) + hAt(rx, hz)) / 2;
    const pitch = Math.atan2(hF - hR, fx - rx), roll = -Math.atan2(hRight - hLeft, 2 * hz);
    const y = (hF + hR) / 2 + (o.lift || 0);
    cart.position.set(x, y, z);
    cart.rotation.set(0, 0, 0);
    cart.quaternion.setFromEuler(new THREE.Euler(roll, -th, pitch, 'YZX'));
    // body tilt (tipping on two wheels): rotate about the outer wheel line
    const tip = o.tip || 0; // + tips toward local +Z (pivot on +Z wheels)
    const side = Math.sign(tip) || 1;
    const pz = side * 0.245, py = 0.0;
    body.rotation.set(tip + (o.shakeX || 0), o.shakeY || 0, o.pitch || 0);
    const R = new THREE.Matrix4().makeRotationFromEuler(body.rotation);
    const pv = new THREE.Vector3(0, py, pz);
    const rp = pv.clone().applyMatrix4(R);
    body.position.set(o.dx || 0, (o.bodyY || 0), 0).add(pv.sub(rp));
    // wheels
    const cs = cart.userData.casters;
    const spin = (o.dist || 0) / CART.wheelR;
    for (const k of ['FL', 'FR', 'RL', 'RR']) {
      const cc = cs[k];
      cc.userData.wheel.rotation.z = -spin;
      cc.rotation.y = (o.caster && o.caster[k] !== undefined) ? o.caster[k] : 0;
    }
    return { y, pitch, roll };
  }

  cartWorld(cart, local) { return local.clone().applyMatrix4(cart.userData.body.matrixWorld); }

  // -------------------------------------------------------------- main update
  update(tau, t) {
    const cam = this.cam;
    const st = this.state = { tau, t };
    // ======================= John's cart kinematics
    const seg = SEG.path(tau);
    const p = seg.P.at(seg.s);
    // velocity estimate
    const dt = 1 / 120;
    const sNext = SEG.path(tau + dt).s, sPrev = SEG.path(tau - dt).s;
    let speed = (SEG.path(tau + dt).id === seg.id && SEG.path(tau - dt).id === seg.id) ? (sNext - sPrev) / (2 * dt) : 0;
    st.speed = speed;
    let th = p.th;
    // lateral offsets (bounce off the car, etc.) along the right normal (-sin th, cos th)
    let lat = 0, yawExtra = 0, tip = 0, shakeX = 0, shakeY = 0, lift = 0, bodyPitch = 0;
    const caster = { FL: 0, FR: 0, RL: 0, RR: 0 };
    // trailing casters follow the curvature a little
    const steer = clamp((p.k || 0) * 0.35, -0.6, 0.6);
    caster.FL = caster.FR = -steer;
    if (seg.id === 1) {
      // S2 wobble: FR caster shakes, cart body jitters, skid yaw
      const wob = win(tau, 7.25, 9.45, 0.2, 0.05);
      if (wob > 0) {
        caster.FR = Math.sin(tau * 2 * Math.PI * 8.5) * 1.1 * wob + Math.sin(tau * 31) * 0.3 * wob;
        shakeX = Math.sin(tau * 2 * Math.PI * 11) * 0.02 * wob;
        shakeY = Math.sin(tau * 2 * Math.PI * 7) * 0.025 * wob;
        yawExtra = -0.32 * sstep(7.9, 9.3, tau) * (1 - sstep(9.38, 9.42, tau)); // skid: cart turned towards the car
      }
      // bonk bounce (pushed away from the car along +right)
      if (tau >= 9.4) {
        const a = tau - 9.4;
        yawExtra += -(Math.PI / 4 + 0.32) * (1 - easeOutBack(clamp(a / 0.5), 1.4));
        lat = 0.28 * (1 - Math.exp(-a * 9)) + 0.27 * sstep(12.0, 12.6, tau);
        shakeX += Math.exp(-a * 7) * Math.sin(a * 40) * 0.05;
        yawExtra += Math.exp(-a * 6) * Math.sin(a * 22) * 0.06;
      }
      // after bonk: the bounce rotated it back straight -> heading from path after the pivot
      // S4: front casters spin around freely
      const spinW = win(tau, 21.5, 24.45, 0.3, 0.1);
      if (spinW > 0) {
        caster.FL = (tau - 21.5) * 13.0 * spinW + Math.sin(tau * 9) * 0.6;
        caster.FR = -(tau - 21.5) * 11.0 * spinW + Math.sin(tau * 7 + 1) * 0.6;
        shakeY = Math.sin(tau * 2 * Math.PI * 5) * 0.012 * spinW;
      }
      // steering with the rope
      if (tau > 24.5) {
        const sk = clamp((p.k || 0) * 2.2 * 0.6, -0.9, 0.9);
        caster.FL = caster.FR = -sk * sstep(24.5, 24.8, tau) + (tau < 24.8 ? caster.FL * (1 - sstep(24.45, 24.6, tau)) : 0);
      }
    }
    if (seg.id === 3) {
      // S6: tipping on the first swerve (left turn -> rolls toward right (+Z local))
      tip = 0.42 * win(tau, 35.55, 36.85, 0.45, 0.22) * (1 + 0.08 * Math.sin(tau * 18));
      // slam bounce
      if (tau > 36.85) { const a = tau - 36.85; tip += -Math.exp(-a * 9) * Math.sin(a * 30) * 0.05; }
      // swerve 2: stays flat, tiny lean
      tip += 0.025 * win(tau, 39.3, 40.3, 0.2, 0.2);
    }
    if (seg.id === 4 && tau > 50.2) { // nested: tiny recoil
      const a = tau - 50.2; lat = 0; bodyPitch = 0;
      st.recoil = Math.exp(-a * 8) * Math.sin(a * 30) * 0.03;
    }
    const rx = -Math.sin(th), rz = Math.cos(th);
    let X = p.x + rx * lat, Z = p.z + rz * lat;
    if (seg.id === 4 && tau > 50.2) X += (st.recoil || 0);
    const thBody = th + yawExtra;
    // vibration lift on rough fast rolling
    lift = Math.abs(speed) > 2 ? Math.sin(tau * 61) * 0.003 * Math.min(1, Math.abs(speed) / 6) : 0;
    const cartInfo = this.placeCart(this.cart, X, Z, thBody, { tip, shakeX, shakeY, lift, caster, dist: seg.s + (seg.id * 100), pitch: bodyPitch });
    this.cart.updateMatrixWorld(true);
    st.cartPos = new THREE.Vector3(X, cartInfo.y, Z); st.th = thBody; st.seg = seg.id;
    const fwd = new THREE.Vector3(Math.cos(thBody), 0, Math.sin(thBody));
    st.fwd = fwd;

    // ======================= upgrades
    const body = this.cart.userData.body;
    // blower: appears 16.45 (drops in with spring)
    const bp = tau - 16.45;
    const blowerVis = bp > 0;
    this.blower.visible = blowerVis;
    if (blowerVis) { const k = springPop(bp, 2.6, 6.5); this.blower.scale.setScalar(Math.max(0.001, k)); this.blower.position.set(-0.66, 0.55 + (1 - Math.min(1, bp / 0.25)) * 0.8 * (bp < 0.25 ? 1 : 0), 0); }
    const blowerOn = this.blowerLevel(tau);
    st.blower = blowerOn;
    if (blowerOn > 0) { const v = Math.sin(tau * 2 * Math.PI * 23) * 0.004 * blowerOn; this.blower.position.y += v; }
    // steering bar + rope (24.35)
    const rpop = tau - 24.35;
    this.bar.visible = rpop > 0;
    if (rpop > 0) this.bar.scale.setScalar(Math.max(0.001, springPop(rpop, 3, 6)));
    // broom (30.85) – exists in later scenes
    const bm = tau - 30.85;
    this.broom.visible = bm > 0;
    if (bm > 0) {
      this.broom.scale.setScalar(Math.max(0.001, springPop(bm, 3, 6)));
      const drag = win(tau, 30.95, 33.95, 0.1, 0.2);
      // handle angle: dragging = tilted down so bristles touch the ground behind; otherwise lifted
      const ang = lerp(-0.62, -0.3, 1 - drag) + Math.sin(tau * 47) * 0.01 * drag;
      this.broom.rotation.set(0, 0, ang);
    }
    // potato bags (drop at 38.15 / 38.42)
    const bagT = [38.15, 38.42];
    this.bags.forEach((b, i) => {
      const a = tau - bagT[i] + 0.35; // fall starts 0.35s before landing
      b.visible = a > 0;
      if (a <= 0) return;
      const fall = clamp(a / 0.35);
      const yLand = 0.5 + 0.1, y = yLand + (1 - fall * fall) * 1.6;
      const sq = a > 0.35 ? 1 - Math.exp(-(a - 0.35) * 9) * Math.cos((a - 0.35) * 30) * 0.25 : 1;
      b.position.set(0.18 - i * 0.02, y, i ? 0.12 : -0.12);
      b.scale.set(1 + (1 - sq) * 0.6, sq, 1 + (1 - sq) * 0.6);
      b.rotation.set(0, i * 1.3, (i ? 0.2 : -0.15));
    });
    // rope from bar to John's hands (computed after John's pose)

    // ======================= John
    this.updateJohn(tau, st);
    // ======================= wrench (S2)
    this.updateWrench(tau);
    // ======================= rivals, worker, row, props
    this.updateRivals(tau);
    this.updateRowAndWorker(tau, st);
    // rope
    if (tau > 24.35) {
      const a = clamp((tau - 24.35) / 0.25);
      const A = this.cartWorld(this.cart, new THREE.Vector3(CART.frontX, 0.22, 0));
      this.john.root.updateMatrixWorld(true);
      const hL = new THREE.Vector3(), hR = new THREE.Vector3();
      this.john.arms[0].hand.getWorldPosition(hL); this.john.arms[1].hand.getWorldPosition(hR);
      const H = hL.add(hR).multiplyScalar(0.5);
      const B = A.clone().lerp(H, a);
      const slack = (1 - sstep(24.6, 24.75, tau)) * 0.12 + 0.02;
      const mid = A.clone().lerp(B, 0.5); mid.y -= slack;
      const front = this.cartWorld(this.cart, new THREE.Vector3(0.5, 0.82, 0)); // over the front rim
      const pts = a < 1 ? [A, mid, B] : [A, A.clone().lerp(front, 0.55).add(new THREE.Vector3(0, 0.05, 0)), front, front.clone().lerp(H, 0.5).add(new THREE.Vector3(0, -slack, 0)), H];
      this.rope.update(pts); this.rope.mesh.visible = true;
    } else this.rope.mesh.visible = false;

    const raceProps = tau >= 34.7;
    this.flag.group.visible = raceProps; this.finish.group.visible = raceProps;
    for (const i of this.raceCones) this.cones[i].visible = raceProps;
    this.updateProps(tau);
    // ======================= FX
    this.updateFX(tau, t, st);
    // ======================= camera
    this.updateCamera(tau, t, st);
  }

  blowerLevel(tau) {
    return win(tau, 17.3, 21.6, 0.15, 0.3) + 0.8 * win(tau, 24.95, 27.9, 0.2, 0.05) + 0.4 * win(tau, 27.75, 29.0, 0.05, 0.3) + 0.9 * win(tau, 34.75, 41.4, 0.05, 0.5) * (1 - win(tau, 37.0, 38.9, 0.3, 0.3) * 0.8) + 1.0 * win(tau, 43.1, 48.6, 0.1, 0.6);
  }

  // -------------------------------------------------------------- John animation
  updateJohn(tau, st) {
    const J = this.john; const root = J.root;
    const body = this.cart.userData.body;
    // climbing in (S1): John's root in cart-local coordinates
    const local = new THREE.Vector3(), rotY = Math.PI / 2;
    let sitK = 1, squash = 1, hop = 0;
    const standPos = new THREE.Vector3(-0.98, 0.0, 0.05), seatPos = new THREE.Vector3(-0.14, 0.41 - 0.38 + 0.065, 0);
    poseStand(J);
    if (tau < 1.82) {
      const a = clamp((tau - 1.28) / 0.54);
      sitK = smooth(clamp((tau - 1.35) / 0.4));
      local.lerpVectors(standPos, seatPos, easeInOut(a));
      hop = Math.sin(Math.PI * a) * 0.55;
      local.y += hop;
      // anticipation crouch + stretch
      const crouch = win(tau, 0.9, 1.3, 0.25, 0.05);
      squash = 1 - crouch * 0.12 + (a > 0 && a < 0.6 ? 0.08 * Math.sin(Math.PI * a / 0.6) : 0);
      // scale the root inside cart space (cart is scaled), compensate
    } else {
      local.copy(seatPos);
      const land = tau - 1.82; squash = 1 - Math.exp(-land * 10) * Math.sin(land * 26) * 0.07;
    }
    // compose into world: cart body matrix * local
    const M = new THREE.Matrix4().compose(local, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(1 / CART_SCALE * 0.82, 1 / CART_SCALE * 0.82 * squash, 1 / CART_SCALE * 0.82));
    const W = body.matrixWorld.clone().multiply(M);
    W.decompose(root.position, root.quaternion, root.scale);
    // legs
    if (sitK > 0) poseSit(J, sitK);
    // torso lean with acceleration / turning
    const accLean = clamp(-(st.speed - (this.prevSpeed ?? st.speed)) * 0.0, -0.2, 0.2);
    J.hips.rotation.set(0, 0, 0);
    J.torso.rotation.set(0, 0, 0);
    J.neck.rotation.set(0, 0, 0);
    // ----- arms default: hands resting on the rim
    let armL = [0.35, 0.55, 0.7], armR = [0.35, 0.55, 0.7];
    let face = { smile: 1, open: 0, brow: 0, blink: 0, lookX: 0, lookY: 0, wide: 0 };
    let headTurn = 0, headTilt = 0, torsoLean = 0, torsoSide = 0, torsoTwist = 0;
    // goggles
    let gog = J.goggles.userData.upAngle;
    // ---------- per-beat performance
    if (tau < 1.3) { // standing behind the cart, excited
      armL = [0.4 + 0.2 * Math.sin(tau * 6), 0.25, 0.6]; armR = [0.4 + 0.2 * Math.sin(tau * 6 + 1), 0.25, 0.6];
      face = { smile: 1, open: 0.5, brow: 0.2, wide: 0.5, lookX: 0.3 };
      headTurn = 0.35;
      // crouch arms back
      const c = win(tau, 0.9, 1.3, 0.25, 0.05); armL = [lerp(armL[0], -0.6, c), 0.2, 0.3]; armR = [lerp(armR[0], -0.6, c), 0.2, 0.3];
    } else if (tau < 2.1) {
      armL = [2.4, 0.5, 0.3]; armR = [2.4, 0.5, 0.3]; face = { smile: 1, open: 0.8, wide: 0.6, brow: 0.3 };
      const a = sstep(1.8, 2.1, tau); armL = [lerp(2.4, 0.35, a), 0.55, 0.7]; armR = armL.slice();
    } else if (tau < 3.4) { // pull the goggles down
      const reach = win(tau, 2.15, 2.95, 0.25, 0.25);
      armL = [lerp(0.35, 2.75, reach), lerp(0.55, 0.35, reach), lerp(0.7, 1.7, reach)]; armR = armL.slice();
      gog = lerp(J.goggles.userData.upAngle, 0.0, easeOutBack(clamp((tau - 2.45) / 0.22), 2.4));
      face = { smile: 1, open: tau > 2.7 ? 0.0 : 0.3, brow: tau > 2.7 ? 0.6 : 0.2, wide: 0.2, lookX: 0, lookY: 0.2 };
      headTilt = -0.1 * reach;
      if (tau > 2.7) { headTurn = -0.35 * win(tau, 2.75, 3.4, 0.15, 0.2); } // cool look to camera
    } else {
      gog = 0;
    }
    // kicks with the right foot (S1 + S3)
    const kicks = [3.78, 5.45, 14.35, 15.2, 16.0];
    let kick = 0, kickPhase = 0;
    for (const k of kicks) { const a = (tau - k + 0.25) / 0.6; if (a > 0 && a < 1) { kick = Math.sin(Math.PI * a); kickPhase = a; } }
    if (kick > 0) {
      const R = J.legs[0]; // s=-1 => right leg (cart +Z side)
      R.hip.rotation.set(lerp(-1.45, -0.2, kick) + (kickPhase - 0.5) * 1.2 * kick, 0, R.s * lerp(0.12, 1.15, kick));
      R.knee.rotation.set(lerp(0.25, 0.1, kick), 0, 0);
      const stretch = 1 + 1.25 * kick;
      R.hip.children[0].scale.y = stretch; // thigh capsule group scale
      torsoSide = -0.28 * kick; // lean over the side
      armR = [0.2, 1.0 * kick + 0.5, 0.4];
      face.brow = tau > 14 ? -0.6 : 0.4; face.smile = tau > 14 ? 0.3 : 1;
    } else { J.legs[0].hip.children[0].scale.y = 1; }
    J.legs[1].hip.children[0].scale.y = 1;
    // ---------- S1 rolling slowly: proud look
    if (tau > 3.4 && tau < 7.2) { face = Object.assign(face, { smile: 1, wide: 0.1 }); if (tau > 4.6 && tau < 5.2) headTurn = -0.25; }
    // ---------- S2 wobble -> worried; bonk -> dizzy; wrench -> watching; smooth -> happy
    if (tau >= 7.2 && tau < 9.4) {
      const w = sstep(7.3, 7.8, tau);
      face = { smile: 0.2, open: 0.6 * w, brow: -0.9 * w, wide: 0.6 * w, lookX: 0.4, lookY: -0.6 };
      armL = [0.6, 0.6, 0.4]; armR = [0.6, 0.6, 0.4]; headTilt = 0.2 * w; headTurn = -0.15 * w + Math.sin(tau * 40) * 0.03 * w;
      torsoSide = Math.sin(tau * 2 * Math.PI * 8.5) * 0.03 * w;
    }
    if (tau >= 9.4 && tau < 10.4) {
      const a = tau - 9.4;
      face = { smile: 0.2, open: 0.4, brow: -0.4, blink: a < 0.35 ? 0.85 : 0, wide: a > 0.35 ? 0.3 : 0, lookX: Math.sin(a * 10) * 0.6, lookY: Math.cos(a * 10) * 0.5 };
      headTilt = Math.sin(a * 7) * 0.15 * Math.exp(-a * 1.5); torsoSide = Math.exp(-a * 5) * Math.sin(a * 20) * 0.15;
      armL = [0.8, 0.9, 0.6]; armR = [0.8, 0.9, 0.6];
    }
    if (tau >= 10.4 && tau < 12.0) { face = { smile: 0.6, open: 0.2, brow: 0.1, wide: 0.3, lookX: 0.6, lookY: -0.8 }; headTurn = -0.45; headTilt = 0.35; torsoSide = -0.1; }
    if (tau >= 11.65 && tau < 14.0) { face = { smile: 1, open: tau < 12.3 ? 0.6 : 0, brow: 0.3, wide: 0.3, lookX: 0, lookY: 0 }; headTurn = tau < 12.4 ? -0.3 : 0; if (tau > 12.0 && tau < 12.6) { armR = [0.3, 1.3, 0.2]; } }
    // ---------- S3: bored foot pushing, then blower on, then joy
    if (tau >= 14.0 && tau < 17.2) { face = { smile: 0.1, open: 0, brow: -0.5, blink: 0.35, lookX: 0, lookY: -0.3 }; headTilt = 0.1; }
    if (tau >= 16.4 && tau < 17.3) { face = { smile: 1, open: 0.4, brow: 0.4, wide: 0.6, lookX: -0.5, lookY: 0 }; headTurn = 0.9 * win(tau, 16.4, 17.3, 0.2, 0.1); armR = [-1.2 * win(tau, 16.9, 17.4, 0.15, 0.1), 0.4, 0.6]; }
    if (tau >= 17.3 && tau < 21.4) { const w = sstep(17.4, 17.8, tau); face = { smile: 1, open: 0.9 * w, brow: 0.5, wide: 0.9 * w, lookX: 0, lookY: 0 }; torsoLean = -0.18 * w; armL = [2.6 * w + 0.35 * (1 - w), 0.6, 0.2]; armR = [lerp(0.35, 2.4, w), 0.6, 0.25]; headTilt = -0.15 * w; }
    // ---------- S4: can't turn -> panic -> rope -> confident turn
    if (tau >= 21.4 && tau < 24.4) {
      const w = sstep(21.5, 21.9, tau); const yank = Math.sin(tau * 9) * w;
      face = { smile: 0, open: 0.9 * w, brow: -1, wide: 0.9 * w, lookX: yank * 0.5, lookY: -0.4 };
      armL = [1.2, 0.3 + yank * 0.4, 0.7]; armR = [1.2, 0.3 - yank * 0.4, 0.7]; torsoSide = yank * 0.15; headTurn = yank * 0.2;
    }
    if (tau >= 24.4) { // holding the rope
      const pull = sstep(24.62, 24.8, tau) * (1 - sstep(26.3, 26.8, tau) * 0.5);
      armL = [lerp(1.15, 0.85, pull), 0.15, lerp(0.8, 1.5, pull)]; armR = armL.slice();
      torsoLean = -0.12 * pull;
      if (tau < 27.75) { face = { smile: 1, open: tau < 25.0 ? 0.3 : 0, brow: 0.7, wide: 0.2, lookX: -0.3 * sstep(24.8, 25.2, tau), lookY: 0 }; torsoSide = 0.2 * win(tau, 24.8, 26.3, 0.3, 0.3); headTurn = 0.35 * win(tau, 24.8, 26.3, 0.3, 0.3); }
    }
    // ---------- S5: too fast, broom, relief
    if (tau >= 27.75 && tau < 35.0) {
      const scared = win(tau, 28.3, 33.6, 0.4, 0.4);
      face = { smile: 0.2 + 0.8 * sstep(33.8, 34.2, tau), open: 0.9 * scared, brow: -1 * scared + 0.4 * sstep(33.8, 34.2, tau), wide: scared, blink: tau > 33.95 && tau < 34.15 ? 0.9 : 0, lookX: 0, lookY: 0 };
      torsoLean = 0.2 * scared - 0.25 * win(tau, 31.0, 33.9, 0.3, 0.3);
      headTilt = -0.15 * scared;
      if (tau > 30.7 && tau < 31.1) armR = [-1.0, 0.5, 0.4];
      if (tau > 33.95) { const a = tau - 33.95; torsoLean = 0.35 * Math.exp(-a * 3) * Math.cos(a * 8); }
    }
    // ---------- S6: tipping fear, potatoes, steady
    if (tau >= 34.75 && tau < 42.0) {
      const fear = win(tau, 35.5, 37.1, 0.2, 0.3);
      face = { smile: 0.3 + 0.7 * sstep(38.9, 39.3, tau), open: 0.9 * fear, brow: -1 * fear + 0.8 * sstep(39.0, 39.4, tau), wide: fear + 0.4 * win(tau, 38.1, 38.8, 0.1, 0.2), lookX: 0, lookY: tau > 38.0 && tau < 38.8 ? -1 : 0 };
      torsoSide = -0.35 * fear;
      armL = [1.0, 0.9 * fear + 0.2, 0.4]; armR = [1.0, 0.9 * fear + 0.2, 0.4];
      if (tau > 38.0 && tau < 38.9) { headTilt = 0.4; }
    }
    // ---------- S7: race
    if (tau >= 42.0 && tau < 45.6) {
      face = { smile: 0.4, open: tau > 43.2 ? 0.8 : 0, brow: 0.9, wide: tau > 43.2 ? 0.7 : 0.1, lookX: tau < 42.9 ? 0.6 : 0, lookY: 0 };
      headTurn = tau < 42.9 ? -0.6 * win(tau, 42.1, 42.9, 0.2, 0.2) : 0;
      torsoLean = -0.2 * sstep(43.1, 43.4, tau);
      armL = [1.1, 0.15, 1.3]; armR = [1.1, 0.15, 1.3];
    }
    if (tau >= 45.6 && tau < 49.2) { // victory
      const w = sstep(45.6, 45.9, tau) * (1 - sstep(48.6, 49.2, tau));
      face = { smile: 1, open: 1.0 * w, brow: 0.6, wide: w, lookX: 0, lookY: 0.3 };
      armL = [lerp(1.1, 2.9, w), 0.45, lerp(1.3, 0.2, w)]; armR = armL.slice();
      headTilt = -0.2 * w;
    }
    // ---------- S8: steering into the row, clack, surprise, thumbs-up, shrug
    if (tau >= 49.2) {
      face = { smile: 1, open: 0, brow: 0.5, wide: 0.1 };
      armL = [1.1, 0.15, 1.3]; armR = [1.1, 0.15, 1.3];
      const surprise = win(tau, 50.2, 51.4, 0.05, 0.3);
      if (surprise > 0) { face = { smile: 0, open: 1.0 * surprise, brow: 0.2, wide: surprise, lookX: -0.5, lookY: 0.3 }; headTurn = 0.45 * surprise; armL = [0.9, 0.9, 0.3]; armR = [0.9, 0.9, 0.3]; }
      if (tau > 51.4) { const sh = win(tau, 52.4, 53.4, 0.3, 0.3); face = { smile: 1, open: 0, brow: 0.6 + 0.4 * sh, browUp: sh, wide: 0.3, lookX: -0.8 * (1 - sh) + 0.0, lookY: 0 }; headTurn = (tau < 52.4 ? -0.9 * win(tau, 51.4, 52.4, 0.3, 0.3) : 0.75 * sh); armL = [lerp(0.4, 0.9, sh), lerp(0.4, 1.2, sh), lerp(0.6, 1.8, sh)]; armR = armL.slice(); torsoSide = 0; }
      if (tau > 53.4) { const wv = sstep(53.4, 53.7, tau); headTurn = 1.0; torsoSide = 0; torsoTwist = 0.45 * wv; face = { smile: 1, open: 0.5, brow: 0.5, wide: 0.3, lookX: 0.6 }; armR = [2.6 * wv + 0.4 * (1 - wv), 0.6 + Math.sin(tau * 12) * 0.25 * wv, 0.4]; }
    }
    // periodic blinks
    const blinkT = [0.6, 4.4, 6.6, 13.2, 15.8, 19.5, 23.0, 26.1, 29.5, 37.3, 41.1, 44.2, 48.5, 52.0, 54.0];
    for (const b of blinkT) { const a = Math.abs(tau - b); if (a < 0.08) face.blink = Math.max(face.blink || 0, 1 - a / 0.08); }
    // apply
    setFace(J, face);
    J.goggles.rotation.x = gog;
    J.torso.rotation.set(torsoLean, torsoTwist, torsoSide);
    J.head.rotation.set(headTilt, headTurn, 0);
    setArm(J.arms[0], armL[0], armL[1], armL[2]); // s=-1 -> right arm actually (char right = -X)
    setArm(J.arms[1], armR[0], armR[1], armR[2]);
    // hair bounce
    J.hair.rotation.x = Math.sin(tau * 13) * 0.02 * Math.min(1, Math.abs(st.speed) / 4);
    this.prevSpeed = st.speed;
  }

  // -------------------------------------------------------------- wrench
  updateWrench(tau) {
    const w = this.wrench;
    const a = tau - 10.3, out = tau - 11.85;
    if (a < 0 || out > 0.3) { w.visible = false; return; }
    w.visible = true;
    // FR caster axle in world
    const cs = this.cart.userData.casters.FR;
    const hub = new THREE.Vector3(); cs.userData.wheel.getWorldPosition(hub);
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(this.cart.getWorldQuaternion(new THREE.Quaternion()));
    const pop = out > 0 ? 1 - easeIn(clamp(out / 0.3)) : springPop(a, 2.4, 5.5);
    const turns = sstep(10.6, 11.6, tau) * Math.PI * 4 + Math.sin(tau * 40) * 0.05 * win(tau, 10.6, 11.6, 0.1, 0.1);
    w.position.copy(hub).addScaledVector(axis, 0.07 + (1 - Math.min(1, a / 0.3)) * 0.4);
    w.position.y += (1 - Math.min(1, a / 0.3)) * 0.3;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), turns + 0.6);
    w.quaternion.copy(q).multiply(spin);
    w.scale.setScalar(Math.max(0.001, pop) * 1.7);
  }

  // -------------------------------------------------------------- rivals
  updateRivals(tau) {
    const lanes = [-5.95, -7.75];
    const show = tau >= 34.7;
    this.rivals.forEach((R, i) => {
      R.cart.visible = show; R.rig.root.visible = show;
      // waiting at the start line, then racing (slower, kicking)
      const start = 11.75 + 0.05 * i;
      const go = Math.max(0, tau - 43.25 - i * 0.15);
      const v = 2.6 - i * 0.35;
      const dist = go > 0 ? v * go - v * 0.4 * (1 - Math.exp(-go / 0.4)) : 0;
      const x = start - dist, z = lanes[i];
      this.placeCart(R.cart, x, z, Math.PI, { dist: dist + i * 3, caster: {} });
      R.cart.updateMatrixWorld(true);
      const body = R.cart.userData.body;
      const M = new THREE.Matrix4().compose(new THREE.Vector3(-0.14, 0.41 - 0.38 + 0.065, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(1, 1, 1).multiplyScalar(1 / CART_SCALE * 0.82));
      body.matrixWorld.clone().multiply(M).decompose(R.rig.root.position, R.rig.root.quaternion, R.rig.root.scale);
      poseSit(R.rig, 1);
      // idle bounce / kicking
      const kickPh = go > 0 ? fract(go * 1.4 + i * 0.3) : 0;
      const kick = go > 0 ? Math.max(0, Math.sin(kickPh * Math.PI * 2)) : 0;
      const leg = R.rig.legs[i === 0 ? 1 : 0];
      leg.hip.rotation.set(lerp(-1.45, -0.3, kick), 0, leg.s * lerp(0.12, 1.1, kick)); leg.hip.children[0].scale.y = 1 + 1.2 * kick;
      R.rig.legs[i === 0 ? 0 : 1].hip.children[0].scale.y = 1;
      const watch = win(tau, 41.0, 43.0, 0.3, 0.2);
      const shocked = sstep(43.5, 43.9, tau);
      setFace(R.rig, { smile: 0.6 - 0.6 * shocked, open: shocked * 0.9, brow: 0.6 - shocked * 1.4, wide: shocked, lookX: watch * (i ? 0.7 : 0.5), blink: Math.abs(tau - (39.4 + i)) < 0.08 ? 1 : 0 });
      R.rig.head.rotation.set(0, watch * (i ? 0.8 : 0.55) + shocked * 0.3, 0);
      R.rig.torso.rotation.set(-0.1 * shocked, 0, Math.sin(tau * 3 + i) * 0.04);
      setArm(R.rig.arms[0], 1.1, 0.15 + Math.sin(tau * 2 + i) * 0.05, 1.2);
      setArm(R.rig.arms[1], 1.1 + (i === 1 ? 0.8 * win(tau, 41.2, 42.6, 0.2, 0.2) * (0.5 + 0.5 * Math.sin(tau * 14)) : 0), 0.15, 1.2);
      // decorations flutter
      const rb = body.userData.ribbons;
      if (rb) rb.forEach((segs, k) => segs.forEach((j, n) => { j.rotation.z = (n ? 0.25 : -0.5) + Math.sin(tau * (6 + go * 2) + k + n * 1.2) * (0.15 + Math.min(0.4, go * 0.2)); j.rotation.y = Math.sin(tau * 4 + k) * 0.2; }));
      if (body.userData.pennant) body.userData.pennant.rotation.y = Math.sin(tau * 7) * 0.3;
    });
  }

  // -------------------------------------------------------------- cart row + worker
  updateRowAndWorker(tau, st) {
    // push into the store: row moves -X
    const push = easeInOut(clamp((tau - 52.5) / 2.3)) * 2.45;
    const clack = tau - 50.2;
    for (let k = 0; k < ROW.n; k++) {
      const c = this.row[k];
      let x = ROW.x0 + k * ROW.step - push;
      if (clack > 0) { const d = clack - (ROW.n - 1 - k) * 0.025; if (d > 0) x -= Math.exp(-d * 9) * Math.sin(d * 34) * 0.012; }
      this.placeCart(c, x, ROW.z, Math.PI, { dist: -push });
    }
    // John's cart rides along when pushed
    if (tau > 52.5) {
      const p = this.cart.position; this.placeCart(this.cart, ROW.x0 + ROW.n * ROW.step - push, ROW.z, Math.PI, { dist: S4_NEST - push });
      this.cart.updateMatrixWorld(true);
      this.updateJohnFollow();
    }
    // worker
    const Wk = this.worker; const r = Wk.root;
    poseStand(Wk);
    const tailX = ROW.x0 + ROW.n * ROW.step + 0.55; // behind John's cart handle
    let x, z, face = Math.PI * -0.5, walk = 0;
    if (tau < 50.4) { x = -16.5; z = -11.6; r.visible = tau > 49.9; face = Math.PI; }
    const a = clamp((tau - 49.9) / 1.6);
    if (tau >= 49.9) { x = lerp(-16.5, tailX + 0.15, a); z = lerp(-11.6, ROW.z, a); walk = a < 1 ? 1 : 0; face = Math.atan2(ROW.z - z + 0.0001, (tailX - x) - 0.0001) ; face = -Math.PI / 2 - 0.0; r.visible = true; }
    if (tau > 52.5) x = tailX + 0.15 - push;
    const gy = groundH(x, z);
    r.position.set(x, gy, z);
    // facing: walk toward -X => character faces -X (rotation y = -PI/2); thumbs-up looks to John / camera
    const turnToCam = win(tau, 51.5, 52.4, 0.2, 0.25);
    r.rotation.set(0, -Math.PI / 2 + turnToCam * 0.9, 0);
    const ph = (tau - 49.9) * 2 * Math.PI * 1.7;
    if (walk) {
      for (const L of Wk.legs) L.hip.rotation.set(Math.sin(ph + (L.s > 0 ? 0 : Math.PI)) * 0.5, 0, 0);
      r.position.y += Math.abs(Math.sin(ph)) * 0.03;
    }
    let armA = [Math.sin(ph) * 0.4 * walk + 0.1, 0.12, 0.3], armB = [-Math.sin(ph) * 0.4 * walk + 0.1, 0.12, 0.3];
    // thumbs-up with right arm (arms[0] is char right)
    const tu = win(tau, 51.55, 52.35, 0.2, 0.2);
    armB = [lerp(armB[0], 0.9, tu), lerp(armB[1], 0.55, tu), lerp(armB[2], 2.0, tu)];
    Wk.arms[1].thumb.rotation.x = Math.PI * tu; Wk.arms[1].thumb.position.y = 0.02 * tu;
    // pushing pose
    const pp = sstep(52.3, 52.6, tau);
    if (pp > 0) { armA = [lerp(armA[0], 1.45, pp), 0.1, lerp(armA[2], 0.35, pp)]; armB = [lerp(armB[0], 1.45, pp), 0.1, lerp(armB[2], 0.35, pp)]; Wk.torso.rotation.set(0.25 * pp, 0, 0); for (const L of Wk.legs) L.hip.rotation.set(Math.sin(tau * 8 + (L.s > 0 ? 0 : Math.PI)) * 0.4 * sstep(52.5, 52.8, tau) * (1 - sstep(54.6, 55, tau)), 0, 0); }
    else Wk.torso.rotation.set(0, 0, 0);
    setArm(Wk.arms[0], armA[0], armA[1], armA[2]);
    setArm(Wk.arms[1], armB[0], armB[1], armB[2]);
    setFace(Wk, { smile: 1, open: tu > 0.5 ? 0.4 : 0, brow: 0.3, wide: 0.1, lookX: 0.2, blink: Math.abs(tau - 51.2) < 0.08 ? 1 : 0 });
    Wk.head.rotation.set(0, tu * 0.3, 0);
    // automatic doors
    const open = sstep(52.1, 52.6, tau);
    for (const d of this.world.store.doors) d.obj.position.z = d.base + d.s * open * 0.85;
  }
  updateJohnFollow() { // re-seat John after the cart moved (pushed into the store)
    const J = this.john; const body = this.cart.userData.body;
    const M = new THREE.Matrix4().compose(new THREE.Vector3(-0.14, 0.41 - 0.38 + 0.065, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(1, 1, 1).multiplyScalar(1 / CART_SCALE * 0.82));
    body.matrixWorld.clone().multiply(M).decompose(J.root.position, J.root.quaternion, J.root.scale);
  }

  // -------------------------------------------------------------- props
  updateProps(tau) {
    // top box teeters after the stop
    const b = this.boxes.top; const a = tau - 33.95;
    b.position.copy(this.boxes.topBase);
    b.rotation.z = a > 0 ? Math.exp(-a * 2.2) * Math.sin(a * 11) * 0.16 : 0;
    b.rotation.x = a > 0 ? Math.exp(-a * 2.5) * Math.sin(a * 9 + 1) * 0.06 : 0;
    // flag: raised, then drops at 43.0
    const f = this.flag;
    const ant = win(tau, 42.6, 43.0, 0.3, 0.02) * 0.25;
    const drop = easeOutBack(clamp((tau - 43.0) / 0.35), 1.2);
    f.pivot.rotation.z = -ant + drop * 2.0;
    const arr = f.flag.geometry.attributes.position;
    for (let i = 0; i < arr.count; i++) { const x0 = f.base[i * 3], y0 = f.base[i * 3 + 1]; arr.setZ(i, Math.sin(x0 * 5 - tau * 9) * 0.06 * (x0 / 1.2)); arr.setY(i, y0); }
    arr.needsUpdate = true; f.flag.geometry.computeVertexNormals();
  }

  // -------------------------------------------------------------- FX
  updateFX(tau, t, st) {
    const cam = this.cam;
    const body = this.cart.userData.body;
    const fwd = st.fwd.clone();
    const cp = st.cartPos.clone();
    const up = new THREE.Vector3(0, 1, 0);
    // --- air + push arrows (S3 teaching moment) and later wisps
    const nozzleW = this.blower.visible ? this.blower.localToWorld(this.blower.userData.nozzle.clone()) : cp;
    const teach = win(tau, 17.35, 21.2, 0.25, 0.5);
    const raceTeach = win(tau, 43.15, 44.6, 0.15, 0.4);
    const arrowA = teach;
    if (arrowA > 0) {
      const back = fwd.clone().negate().add(new THREE.Vector3(0, -0.12, 0)).normalize();
      this.airArrow.set(nozzleW.clone().addScaledVector(back, 0.12), back, 1.15 + 0.1 * Math.sin(tau * 20), cam, arrowA, Math.sin(tau * 18) * 0.5 + 0.5);
      const pushStart = cp.clone().add(new THREE.Vector3(0, 0.62, 0)).addScaledVector(fwd, 0.45);
      this.pushArrow.set(pushStart, fwd, 0.5 + 0.35 * clamp(st.speed / 6), cam, arrowA, Math.sin(tau * 14) * 0.5 + 0.5);
      this.airFlow.set(nozzleW.clone().addScaledVector(back, 0.1).add(new THREE.Vector3(0, 0.0, 0)), back, 1.4, cam, tau, arrowA * 0.9, 3.2, 0.9);
    } else if (raceTeach > 0) {
      const back = fwd.clone().negate().add(new THREE.Vector3(0, -0.12, 0)).normalize();
      this.airArrow.set(nozzleW.clone().addScaledVector(back, 0.12), back, 1.0, cam, raceTeach * 0.85, Math.sin(tau * 18) * 0.5 + 0.5);
      this.pushArrow.set(cp, fwd, 0, cam, 0);
      this.airFlow.set(nozzleW.clone().addScaledVector(back, 0.1), back, 1.4, cam, tau, raceTeach * 0.8, 3.2, 0.9);
    } else { this.airArrow.set(cp, fwd, 0, cam, 0); this.pushArrow.set(cp, fwd, 0, cam, 0); this.airFlow.set(cp, fwd, 1, cam, tau, 0); }
    // --- friction arrow (S5)
    const fr = win(tau, 31.0, 33.85, 0.2, 0.3);
    const bristle = this.broom.visible ? this.broom.userData.head.localToWorld(new THREE.Vector3(-0.1, -0.12, 0)) : cp;
    if (fr > 0) {
      const back = fwd.clone().negate();
      this.fricArrow.set(cp.clone().add(new THREE.Vector3(0, 0.3, 0)).addScaledVector(back, 0.5), back, 0.45 + 0.6 * clamp(st.speed / 5.5), cam, fr, Math.sin(tau * 16) * 0.5 + 0.5);
      // motion arrow shrinking as it slows
      this.pushArrow.set(cp.clone().add(new THREE.Vector3(0, 0.3, 0)).addScaledVector(fwd, 0.5), fwd, 0.25 + 0.8 * clamp(st.speed / 5.5), cam, fr * clamp(st.speed / 1.5), 0);
    } else this.fricArrow.set(cp, fwd, 0, cam, 0);
    // --- gravity arrow from CoM (S6)
    const comA = win(tau, 35.45, 40.9, 0.25, 0.5);
    const comY = lerp(0.98, 0.5, easeInOut(clamp((tau - 38.45) / 0.8)));
    if (comA > 0) {
      const local = new THREE.Vector3(-0.05, comY, 0);
      const wp = local.applyMatrix4(body.matrixWorld);
      this.com.visible = true; this.com.position.copy(wp);
      const s = 1 + 0.15 * Math.sin(tau * 10);
      this.com.userData.core.scale.setScalar(comA * s); this.com.userData.halo.scale.setScalar(0.2 * comA * s); this.com.userData.halo.material.opacity = 0.6;
      this.com.userData.ring.lookAt(cam.position); this.com.userData.ring.scale.setScalar(comA * (1 + 0.3 * Math.sin(tau * 6)));
      // line straight down to the ground
      const g = groundH(wp.x, wp.z); const L = Math.max(0.01, wp.y - g);
      this.com.userData.lineG.scale.set(1, L, 1); this.com.userData.lineG.rotation.set(0, 0, 0);
      this.com.userData.line.material.opacity = 0.75 * comA;
      this.gravArrow.set(wp.clone().add(new THREE.Vector3(0, -0.08, 0)), new THREE.Vector3(0, -1, 0), Math.min(0.45, L * 0.6), cam, comA * 0.8, 0);
    } else { this.com.visible = false; this.gravArrow.set(cp, fwd, 0, cam, 0); }

    // --- sparks from the broom (deterministic)
    const sparks = [];
    if (tau > 30.9 && tau < 34.4) {
      const rate = 95, life = 0.45;
      const i0 = Math.floor((tau - life - 30.95) * rate), i1 = Math.floor((tau - 30.95) * rate);
      for (let i = Math.max(0, i0); i <= i1; i++) {
        const tb = 30.95 + i / rate; const age = tau - tb; if (age < 0 || age > life) continue;
        const inten = win(tb, 31.0, 33.85, 0.1, 0.4) * clamp(this.speedAt(tb) / 2.0);
        if (inten <= 0.02) continue;
        const r = mulberry32(i * 7 + 3);
        const o = this.bristleAt(tb);
        const f2 = this.fwdAt(tb);
        const side = new THREE.Vector3(-f2.z, 0, f2.x);
        const v = f2.clone().multiplyScalar(-(1.2 + r() * 2.2)).add(new THREE.Vector3(0, 1.5 + r() * 2.6, 0)).addScaledVector(side, (r() - 0.5) * 2.4);
        v.add(f2.clone().multiplyScalar(this.speedAt(tb) * 0.55));
        const p = o.clone().addScaledVector(side, (r() - 0.5) * 0.25).addScaledVector(v, age).add(new THREE.Vector3(0, -4.9 * age * age, 0));
        if (p.y < groundH(p.x, p.z)) continue;
        const vel = v.clone().add(new THREE.Vector3(0, -9.8 * age, 0));
        const fade = (1 - age / life);
        sparks.push({ p, v: vel.multiplyScalar(0.035), w: 0.014, c: new THREE.Color(1.0, 0.55 + 0.4 * r(), 0.15).multiplyScalar(6 * fade * inten), a: 1 });
      }
    }
    this.sparks.draw(sparks, cam);

    // --- air wisps from the nozzle when blower runs
    const wisps = [];
    const bl = st.blower || 0;
    if (bl > 0.05 && this.blower.visible) {
      const rate = 40, life = 0.5;
      for (let i = Math.floor((tau - life) * rate); i <= Math.floor(tau * rate); i++) {
        const tb = i / rate, age = tau - tb; if (age < 0 || age > life) continue;
        const r = mulberry32(i * 13 + 5);
        const nz = this.nozzleAt(tb); const f2 = this.fwdAt(tb);
        const dir = f2.clone().negate().add(new THREE.Vector3((r() - 0.5) * 0.4, -0.15 + (r() - 0.5) * 0.3, (r() - 0.5) * 0.4)).normalize();
        const sp = 5 + r() * 3;
        const p = nz.clone().addScaledVector(dir, sp * age * (1 - age));
        wisps.push({ p, v: dir.clone().multiplyScalar(0.35 + age * 0.6), w: 0.025 + age * 0.05, c: new THREE.Color(0.85, 0.95, 1.0).multiplyScalar(0.9 * bl * (1 - age / life)), a: 1 });
      }
    }
    this.wisps.draw(wisps, cam);

    // --- speed lines around the cart when fast
    const lines = [];
    const spd = Math.abs(st.speed);
    const sl = clamp((spd - 3.4) / 2.5) * (st.seg === 4 && tau > 45.5 && tau < 47.0 ? 1.2 : 1);
    if (sl > 0.01) {
      for (let i = 0; i < 26; i++) {
        const r = mulberry32(i * 31 + 7);
        const ph = fract(tau * (1.6 + r() * 0.8) + r());
        const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
        const off = side.clone().multiplyScalar((r() - 0.5) * 2.6).add(new THREE.Vector3(0, 0.1 + r() * 1.5, 0));
        const along = 1.6 - ph * 4.2;
        const p = cp.clone().add(off).addScaledVector(fwd, along);
        const L = 0.6 + r() * 0.9;
        lines.push({ p, v: fwd.clone().multiplyScalar(-L), w: 0.018 + r() * 0.012, c: new THREE.Color(1, 1, 1).multiplyScalar(0.55 * sl * Math.sin(ph * Math.PI)), a: 1 });
      }
    }
    this.speedLines.draw(lines, cam);

    // --- dust puffs & flashes (event based)
    const puffs = [], flashes = [];
    const puffAt = (t0, pos, n, size, seed, life = 0.9) => {
      const a = tau - t0; if (a < 0 || a > life) return;
      for (let i = 0; i < n; i++) { const r = mulberry32(seed + i * 17); const k = a / life; const dir = new THREE.Vector3(r() - 0.5, 0.3 + r() * 0.5, r() - 0.5).normalize(); puffs.push({ p: pos.clone().addScaledVector(dir, easeOut(k) * size * 1.2), s: size * (0.4 + k * 1.2) * (0.7 + r() * 0.6), a: 0.45 * (1 - k) * (1 - k) }); }
    };
    const kickFoot = (t0) => this.cartWorldAt(t0, new THREE.Vector3(-0.3, 0.02, 0.5));
    for (const k of [3.78, 5.45, 14.35, 15.2, 16.0]) if (Math.abs(tau - k) < 1) puffAt(k, kickFoot(k), 5, 0.22, Math.floor(k * 100));
    if (Math.abs(tau - 9.4) < 1.2) { puffAt(9.4, this.cartWorldAt(9.4, new THREE.Vector3(0.0, 0.3, -0.35)), 6, 0.3, 940); const a = tau - 9.4; if (a > 0 && a < 0.25) flashes.push({ p: this.cartWorldAt(9.4, new THREE.Vector3(0.1, 0.55, -0.4)), s: 0.5 + a * 4, a: (1 - a / 0.25) }); }
    if (Math.abs(tau - 11.62) < 0.4) { const a = tau - 11.62; if (a > 0 && a < 0.3) { const hub = this.cart.userData.casters.FR.userData.wheel.getWorldPosition(new THREE.Vector3()); flashes.push({ p: hub, s: 0.25 + a * 2, a: (1 - a / 0.3) }); } }
    if (Math.abs(tau - 36.8) < 1) puffAt(36.8, this.cartWorldAt(36.8, new THREE.Vector3(0, 0.02, -0.3)), 6, 0.3, 3680);
    if (Math.abs(tau - 33.95) < 1.2) puffAt(33.6, this.cartWorldAt(33.6, new THREE.Vector3(-0.9, 0.05, 0)), 7, 0.35, 3395, 1.2);
    for (const k of [38.15, 38.42]) if (Math.abs(tau - k) < 0.8) puffAt(k, this.cartWorldAt(k, new THREE.Vector3(0.15, 0.6, 0)), 4, 0.18, Math.floor(k * 100), 0.6);
    if (Math.abs(tau - 50.2) < 1) { puffAt(50.2, this.cartWorldAt(50.2, new THREE.Vector3(0.45, 0.4, 0)), 4, 0.2, 5020, 0.6); const a = tau - 50.2; if (a > 0 && a < 0.2) flashes.push({ p: this.cartWorldAt(50.2, new THREE.Vector3(0.48, 0.6, 0)), s: 0.4 + a * 4, a: 1 - a / 0.2 }); }
    // S8: wheels dust while steering in
    this.dust.draw(puffs); this.flashes.draw(flashes);
    // --- confetti at the finish
    this.confetti.draw(this.finish.banner, tau - 45.8);
    // --- bonk stars
    const sa = tau - 9.45;
    if (sa > 0 && sa < 1.6) {
      this.stars.visible = true;
      const hp = this.john.head.getWorldPosition(new THREE.Vector3());
      this.stars.userData.items.forEach((m, i) => { const ang = sa * 6 + i * 2.094; m.position.set(hp.x + Math.cos(ang) * 0.26, hp.y + 0.28 + Math.sin(ang * 2) * 0.03, hp.z + Math.sin(ang) * 0.26); m.rotation.set(0, ang * 2, 0); m.scale.setScalar(clamp(sa / 0.15) * (1 - sstep(1.3, 1.6, sa))); });
    } else this.stars.visible = false;
  }
  // world-space helpers at other times (used by particles) - recomputed from the paths
  stateAt(tau) {
    const seg = SEG.path(tau); const p = seg.P.at(seg.s);
    return { x: p.x, z: p.z, th: p.th, s: seg.s };
  }
  fwdAt(tau) { const s = this.stateAt(tau); return new THREE.Vector3(Math.cos(s.th), 0, Math.sin(s.th)); }
  speedAt(tau) { const a = SEG.path(tau - 0.01), b = SEG.path(tau + 0.01); return a.id === b.id ? Math.abs(b.s - a.s) / 0.02 : 0; }
  cartWorldAt(tau, local) {
    const s = this.stateAt(tau); const c = Math.cos(s.th), sn = Math.sin(s.th);
    const l = local.clone().multiplyScalar(CART_SCALE);
    // local +X = fwd (c, sn), local +Z = right (-sn, c)
    return new THREE.Vector3(s.x + c * l.x - sn * l.z, groundH(s.x, s.z) + l.y, s.z + sn * l.x + c * l.z);
  }
  bristleAt(tau) { const ang = -0.62; const L = 1.12; return this.cartWorldAt(tau, new THREE.Vector3(-0.42 - Math.cos(ang) * L, 0.0, -0.12)); }
  nozzleAt(tau) { return this.cartWorldAt(tau, new THREE.Vector3(-1.3, 0.38, 0)); }

  // -------------------------------------------------------------- camera
  updateCamera(tau, t, st) {
    const cam = this.cam;
    const shot = cameraShot(tau, st, this);
    cam.position.copy(shot.pos);
    cam.up.set(Math.sin(shot.roll || 0), Math.cos(shot.roll || 0), 0);
    cam.lookAt(shot.target);
    cam.fov = shot.fov; cam.updateProjectionMatrix();
    st.focus = shot.focus || shot.target;
    st.camShot = shot;
    st.whip = (tau >= 27.5 && tau < 28.0) || (tau >= 34.5 && tau < 35.0);
  }
}

// ================================================================================================
// Camera: shots are parameter sets solved by frameShot() so the subject always sits in the
// lower-middle band of the 9:16 frame (below the subtitles, above the Instagram UI zone).
function V3(x, y, z) { return new THREE.Vector3(x, y, z); }
const ASPECT = 1080 / 1920;
// edge level: height of the nearest cut-face top the camera looks over
function edgeLevel(S, az) {
  const a = az * Math.PI / 180;
  if (Math.abs(Math.sin(a)) > 0.8 && Math.sin(a) > 0) return groundH(LOT.x1, S.z); // right face
  return groundH(S.x + Math.tan(a) * (-S.z), 0);
}
export function frameShot(S, o) {
  const h = o.h ?? 1.1, F = (o.fov * Math.PI) / 180, tf = Math.tan(F / 2);
  const yTop = o.yTop ?? 0.5, yBot = o.yBot ?? 0.79;
  const az = (o.az * Math.PI) / 180, sa = Math.sin(az), ca = Math.cos(az);
  const solveD = (camY) => {
    const camH = camY - S.y;
    const solve = (D) => {
      const thB = Math.atan2(-camH, D), phi = thB - Math.atan((0.5 - yBot) * 2 * tf);
      const thT = Math.atan2(h - camH, D);
      return { phi, yT: 0.5 - Math.tan(thT - phi) / (2 * tf) };
    };
    let lo = 0.3, hi = 400;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (solve(m).yT < yTop) lo = m; else hi = m; }
    const D = (lo + hi) / 2; return { D, phi: solve(D).phi };
  };
  // screen y of the cut-face edge seen along the view direction
  const edgeScreenY = (camY, D, phi) => {
    const cx = S.x + sa * D, cz = S.z + ca * D;
    let u; // fraction from camera towards subject where the edge is crossed
    const right = o.edge === 'right';
    if (right) u = (cx - LOT.x1) / (cx - S.x); else u = cz / (cz - S.z);
    if (!(u > 0 && u < 1)) return 2;
    const ex = cx + (S.x - cx) * u, ez = cz + (S.z - cz) * u;
    const ey = groundH(right ? LOT.x1 : ex, right ? ez : 0);
    const dist = D * u;
    const th = Math.atan2(ey - camY, dist);
    return 0.5 - Math.tan(th - phi) / (2 * tf);
  };
  let camY, sol;
  if (o.edgeY !== undefined) {
    const base = edgeLevel(S, o.az);
    let lo = base - 1.5, hi = base + 6;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; const r = solveD(m); if (edgeScreenY(m, r.D, r.phi) < o.edgeY) lo = m; else hi = m; }
    camY = (lo + hi) / 2;
  } else camY = o.camY ?? (edgeLevel(S, o.az) + (o.eh ?? 0.35));
  sol = solveD(camY);
  const { D, phi } = sol;
  const pos = V3(S.x + sa * D, camY, S.z + ca * D);
  let lx = -sa, lz = -ca;
  const d = Math.atan((0.5 - (o.xFrac ?? 0.5)) * 2 * tf * ASPECT);
  const rx = -lz, rz = lx; // camera right
  const nx = lx * Math.cos(d) + rx * Math.sin(d), nz = lz * Math.cos(d) + rz * Math.sin(d);
  const target = pos.clone().add(V3(nx * Math.cos(phi), Math.sin(phi), nz * Math.cos(phi)).multiplyScalar(10));
  return { pos, target, fov: o.fov, roll: o.roll || 0, focus: S.clone(), D };
}
const P = (o) => o; // readability
function mixP(a, b, k) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[key], vb = b[key];
    if (va instanceof THREE.Vector3) out[key] = va.clone().lerp(vb ?? va, k);
    else if (typeof va === 'number' || typeof vb === 'number') out[key] = lerp(va ?? vb, vb ?? va, k);
    else out[key] = k < 0.5 ? va : vb;
  }
  return out;
}
// keyframed parameter track: [[tau, params], ...] smooth blends
function track(tau, kf) {
  if (tau <= kf[0][0]) return kf[0][1];
  for (let i = 0; i < kf.length - 1; i++) if (tau <= kf[i + 1][0]) return mixP(kf[i][1], kf[i + 1][1], smoother((tau - kf[i][0]) / (kf[i + 1][0] - kf[i][0])));
  return kf[kf.length - 1][1];
}
const cartS = (st, dx = 0, dy = 0, dz = 0) => V3(st.cartPos.x + dx, st.cartPos.y + dy, st.cartPos.z + dz);

function shotS1(tau, st) {
  const john0 = V3(-20.45, groundH(-20.45, -7.2), -7.2);
  const S = john0.clone().lerp(cartS(st, 0.1), sstep(3.6, 6.0, tau));
  const p = track(tau, [
    [0.0, P({ az: -16, edgeY: 0.86, fov: 33, yTop: 0.72, yBot: 0.84, xFrac: 0.88 })],
    [1.25, P({ az: 21, edgeY: 0.81, fov: 13.5, yTop: 0.52, yBot: 0.79, xFrac: 0.5 })],
    [3.3, P({ az: 24, edgeY: 0.81, fov: 11.5, yTop: 0.49, yBot: 0.79, xFrac: 0.5 })],
    [5.5, P({ az: 27, edgeY: 0.81, fov: 12.5, yTop: 0.5, yBot: 0.79, xFrac: 0.45 })],
  ]);
  return frameShot(S, p);
}
function shotS2(tau, st) {
  const S = cartS(st, 0.1).lerp(V3(-14.75, groundH(-14.75, -9.0), -8.95), win(tau, 9.2, 12.3, 0.4, 0.5) * 0.85);
  const p = track(tau, [
    [7.0, P({ az: 27, edgeY: 0.81, fov: 12.5, yTop: 0.5, yBot: 0.79, xFrac: 0.45 })],
    [8.8, P({ az: 22, edgeY: 0.81, fov: 12.5, yTop: 0.5, yBot: 0.79, xFrac: 0.48 })],
    [9.5, P({ az: 20, edgeY: 0.81, fov: 9.0, yTop: 0.47, yBot: 0.79, xFrac: 0.5 })],
    [10.2, P({ az: 30, edgeY: 0.81, fov: 8.0, yTop: 0.46, yBot: 0.79, xFrac: 0.5 })],
    [11.9, P({ az: 30, edgeY: 0.81, fov: 8.0, yTop: 0.46, yBot: 0.79, xFrac: 0.5 })],
    [13.2, P({ az: 18, edgeY: 0.81, fov: 12, yTop: 0.5, yBot: 0.79, xFrac: 0.45 })],
  ]);
  return frameShot(S, p);
}
function shotS3(tau, st) {
  const S = cartS(st, 0.0);
  const p = track(tau, [
    [13.6, P({ az: 18, edgeY: 0.81, fov: 12, yTop: 0.5, yBot: 0.79, xFrac: 0.45 })],
    [16.2, P({ az: 14, edgeY: 0.81, fov: 11, yTop: 0.49, yBot: 0.79, xFrac: 0.48 })],
    [17.3, P({ az: 22, edgeY: 0.81, fov: 11, yTop: 0.49, yBot: 0.79, xFrac: 0.48 })],
    [18.4, P({ az: 8, edgeY: 0.81, fov: 16, yTop: 0.53, yBot: 0.79, xFrac: 0.47 })],
    [21.0, P({ az: 6, edgeY: 0.81, fov: 16, yTop: 0.53, yBot: 0.79, xFrac: 0.45 })],
  ]);
  return frameShot(S, p);
}
function shotS4(tau, st) {
  const hold = sstep(23.6, 25.0, tau);
  const S = cartS(st, 0.3 * (1 - hold));
  const p = track(tau, [
    [20.8, P({ az: 6, edgeY: 0.81, fov: 15, yTop: 0.52, yBot: 0.79, xFrac: 0.42 })],
    [22.4, P({ az: 12, edgeY: 0.81, fov: 12, yTop: 0.49, yBot: 0.79, xFrac: 0.45 })],
    [24.2, P({ az: 18, edgeY: 0.81, fov: 10, yTop: 0.47, yBot: 0.79, xFrac: 0.5 })],
    [25.0, P({ az: 14, edgeY: 0.81, fov: 9.5, yTop: 0.47, yBot: 0.79, xFrac: 0.5 })],
    [26.4, P({ az: -10, edgeY: 0.81, fov: 11, yTop: 0.5, yBot: 0.79, xFrac: 0.5 })],
    [27.8, P({ az: -14, edgeY: 0.81, fov: 10, yTop: 0.52, yBot: 0.78, xFrac: 0.5 })],
  ]);
  return frameShot(S, p);
}
function shotS5(tau, st) {
  // from the front-right, over the right cut face: the cart races down the aisle toward the boxes
  const E = { edge: 'right' };
  const stopK = sstep(32.6, 34.0, tau);
  const boxes = V3(26.0, groundH(26, -2.4), -2.4);
  const S = cartS(st).lerp(boxes, stopK * 0.35);
  const p = track(tau, [
    [27.7, P({ az: 64, edgeY: 0.81, fov: 12, yTop: 0.5, yBot: 0.79, xFrac: 0.42 })],
    [30.6, P({ az: 70, edgeY: 0.81, fov: 12, yTop: 0.5, yBot: 0.79, xFrac: 0.45 })],
    [32.6, P({ az: 76, edgeY: 0.81, fov: 13, yTop: 0.5, yBot: 0.79, xFrac: 0.5 })],
    [34.2, P({ az: 74, edgeY: 0.81, fov: 13, yTop: 0.47, yBot: 0.79, xFrac: 0.5, h: 1.6 })],
  ]);
  return frameShot(S, Object.assign(p, E));
}
function shotS6(tau, st) {
  const S = cartS(st, 0);
  const p = track(tau, [
    [34.75, P({ az: -26, edgeY: 0.81, fov: 12, yTop: 0.49, yBot: 0.79, xFrac: 0.5 })],
    [36.0, P({ az: -34, edgeY: 0.81, fov: 11, yTop: 0.48, yBot: 0.79, xFrac: 0.5 })],
    [37.3, P({ az: -24, edgeY: 0.81, fov: 9.5, yTop: 0.47, yBot: 0.79, xFrac: 0.5 })],
    [39.0, P({ az: -24, edgeY: 0.81, fov: 9.5, yTop: 0.47, yBot: 0.79, xFrac: 0.5 })],
    [40.2, P({ az: -30, edgeY: 0.81, fov: 11, yTop: 0.49, yBot: 0.79, xFrac: 0.5 })],
    [41.8, P({ az: -30, edgeY: 0.81, fov: 15, yTop: 0.52, yBot: 0.79, xFrac: 0.5 })],
  ]);
  return frameShot(S, p);
}
function shotS7(tau, st) {
  const lineupS = V3(11.5, groundH(11.5, -6.0), -6.0);
  const runS = cartS(st, 0);
  const finS = V3(-9.0, groundH(-9, -3.6), -3.6);
  let S = lineupS.clone().lerp(runS, sstep(43.05, 43.8, tau));
  S = S.lerp(runS.clone().lerp(finS, 0.5), win(tau, 45.2, 46.6, 0.4, 0.5));
  const p = track(tau, [
    [42.0, P({ az: -30, edgeY: 0.81, fov: 17, yTop: 0.6, yBot: 0.8, xFrac: 0.5, h: 1.2 })],
    [42.9, P({ az: -34, edgeY: 0.81, fov: 17, yTop: 0.6, yBot: 0.8, xFrac: 0.5, h: 1.2 })],
    [43.9, P({ az: -28, edgeY: 0.81, fov: 17, yTop: 0.52, yBot: 0.79, xFrac: 0.56 })],
    [44.9, P({ az: -32, edgeY: 0.81, fov: 16, yTop: 0.51, yBot: 0.79, xFrac: 0.56 })],
    [45.5, P({ az: -42, edgeY: 0.82, fov: 18, yTop: 0.6, yBot: 0.8, xFrac: 0.5 })],
    [46.3, P({ az: -30, edgeY: 0.82, fov: 18, yTop: 0.6, yBot: 0.8, xFrac: 0.5 })],
  ]);
  return frameShot(S, p);
}
function shotS8(tau, st) {
  const nest = V3(ROW.x0 + ROW.n * ROW.step, groundH(-27.1, ROW.z), ROW.z);
  const S = cartS(st, 0);
  const both = sstep(50.4, 51.4, tau); S.x += both * 0.6;   // include the worker
  const push = sstep(52.6, 54.6, tau);
  S.x -= push * 1.6;
  const p = track(tau, [
    [46.4, P({ az: -30, edgeY: 0.82, fov: 18, yTop: 0.6, yBot: 0.8, xFrac: 0.5 })],
    [47.8, P({ az: -26, edgeY: 0.81, fov: 14, yTop: 0.52, yBot: 0.79, xFrac: 0.5 })],
    [49.9, P({ az: -24, edgeY: 0.8, fov: 9.5, yTop: 0.45, yBot: 0.77, xFrac: 0.5 })],
    [51.0, P({ az: -26, edgeY: 0.79, fov: 8, yTop: 0.4, yBot: 0.75, xFrac: 0.5 })],
    [52.2, P({ az: -16, edgeY: 0.79, fov: 9.5, yTop: 0.44, yBot: 0.75, xFrac: 0.5, h: 1.3 })],
    [53.4, P({ az: 18, edgeY: 0.8, fov: 11, yTop: 0.48, yBot: 0.77, xFrac: 0.5, h: 1.3 })],
    [54.6, P({ az: 16, edgeY: 0.84, fov: 12.5, yTop: 0.5, yBot: 0.78, xFrac: 0.56, h: 1.3 })],
  ]);
  return frameShot(S, p);
}
function blendShot(a, b, k) {
  return { pos: a.pos.clone().lerp(b.pos, k), target: a.target.clone().lerp(b.target, k), fov: lerp(a.fov, b.fov, k), roll: lerp(a.roll || 0, b.roll || 0, k), focus: (a.focus || a.target).clone().lerp(b.focus || b.target, k) };
}
// whip pan between two shots: rotate quickly away from A, switch at peak blur, rotate into B
function whip(tau, t0, A, B, dir = 1, ang = 1.2, dur = 0.42) {
  const u = clamp((tau - (t0 - dur / 2)) / dur);
  const useB = u >= 0.5;
  const base = useB ? B : A;
  const k = useB ? (1 - easeOut((u - 0.5) * 2)) : easeIn(u * 2);
  const yaw = dir * ang * k * (useB ? -1 : 1);
  const v = base.target.clone().sub(base.pos);
  v.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  return { pos: base.pos.clone(), target: base.pos.clone().add(v), fov: base.fov, roll: dir * 0.04 * k, focus: base.focus };
}

function cameraShot(tau, st, d) {
  let s;
  if (tau < 7.6) s = shotS1(tau, st);
  if (tau >= 6.6 && tau < 14.4) { const b = shotS2(tau, st); s = tau < 7.6 ? blendShot(s, b, smoother((tau - 6.6) / 1.0)) : b; }
  if (tau >= 13.6 && tau < 21.6) { const b = shotS3(tau, st); s = tau < 14.4 ? blendShot(s, b, smoother((tau - 13.6) / 0.8)) : b; }
  if (tau >= 20.8 && tau < 27.96) { const b = shotS4(tau, st); s = tau < 21.6 ? blendShot(s, b, smoother((tau - 20.8) / 0.8)) : b; }
  if (tau >= 27.54 && tau < 27.96) s = whip(tau, 27.75, shotS4(Math.min(tau, 27.75), st), shotS5(Math.max(tau, 27.75), st), 1, 0.5);
  else if (tau >= 27.96 && tau < 34.96) s = shotS5(tau, st);
  if (tau >= 34.54 && tau < 34.96) s = whip(tau, 34.75, shotS5(Math.min(tau, 34.75), st), shotS6(Math.max(tau, 34.75), st), -1, 0.5);
  else if (tau >= 34.96 && tau < 42.8) s = shotS6(tau, st);
  if (tau >= 41.6 && tau < 47.6) { const b = shotS7(tau, st); s = tau < 42.8 ? blendShot(s, b, smoother((tau - 41.6) / 1.2)) : b; }
  if (tau >= 46.4) { const b = shotS8(tau, st); s = tau < 47.6 ? blendShot(s, b, smoother((tau - 46.4) / 1.2)) : b; }
  // subtle handheld drift + shake on impacts (scaled with lens length)
  const k = 12 / s.fov;
  const sh = (0.004 * shake1(tau * 0.25, 1) + 0.03 * pulse(tau, 9.42, 0.08) * shake1(tau * 6, 2) + 0.02 * pulse(tau, 36.8, 0.08) * shake1(tau * 6, 3) + 0.02 * pulse(tau, 50.22, 0.06) * shake1(tau * 7, 4)) / k;
  s.target = s.target.clone().add(new THREE.Vector3(sh, shake1(tau * 0.3, 5) * 0.004 / k + sh * 0.5, 0));
  return s;
}

// ---------------------------------------------------------------- misc textures for rivals
function numberPlate(txt, color, pos) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#f4ead8'; x.beginPath(); x.arc(64, 64, 60, 0, 6.28); x.fill();
  x.lineWidth = 8; x.strokeStyle = '#' + new THREE.Color(color).getHexString(); x.stroke();
  x.fillStyle = '#222'; x.font = 'bold 84px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.11, 28), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, side: THREE.DoubleSide }));
  m.position.copy(pos); return m;
}
function makeFlames() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d');
  const grad = x.createLinearGradient(0, 0, 256, 0); grad.addColorStop(0, '#ffd23f'); grad.addColorStop(0.5, '#ff8c42'); grad.addColorStop(1, '#e8574d');
  x.fillStyle = grad; x.beginPath(); x.moveTo(0, 60);
  for (let i = 0; i < 6; i++) { const bx = 30 + i * 38; x.quadraticCurveTo(bx - 10, 10 + (i % 2) * 14, bx + 14, 30 + (i % 3) * 6); x.quadraticCurveTo(bx + 8, 50, bx + 24, 58); }
  x.lineTo(256, 88); x.lineTo(0, 88); x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
