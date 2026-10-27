// The people, faceless like ghost mannequins: the worker (fluorescent orange
// puffer with silver tape, jeans, work boots, leather gloves, a white hard hat
// floating where the head would be), the woman (teal knit sweater, charcoal
// trousers, white trainers), the kid (red hoodie with the hood up, jeans,
// trainers), and the dog (golden, no face). Every pose is a pure function of time.
import * as THREE from 'three';
import * as R from './rig.js';

const { V } = R;
const UPV = new THREE.Vector3(0, 1, 0);

export function build(ctx) {
  const { scene, T, WD, G, U, envMap, envMats } = ctx;
  const { clamp, lerp, smooth, prog, easeOutCubic, bump } = U;
  const smooth01 = (t, t0, d) => smooth(prog(t, t0, d));
  const updaters = [];
  const mesh = (g, m, cast = true) => {
    const o = new THREE.Mesh(g, m);
    o.castShadow = cast;
    o.receiveShadow = true;
    return o;
  };

  // ground under a foot: the room floor, the stair treads, the walls' tops, the lawn
  const { STAIR, FLOOR, TOP } = WD;
  function groundAt(x, z, inside) {
    // in the shelter (only within its footprint): the floor, the steps
    if (inside && z > WD.OUT.zb && z < 0.05 && x > WD.OUT.x0 && x < WD.OUT.x1) {
      if (x < STAIR.x0 - 0.02) return FLOOR;
      if (x <= STAIR.x1 && z > STAIR.zb - 0.05) return WD.stairY(x);
      if (x <= STAIR.x1) return 0;
      return TOP;
    }
    // outside: the tops of the walls and the roof slab, else the lawn
    if (x >= STAIR.x1 && x <= WD.OUT.x1 && z > STAIR.zb - WD.WALL && z < 0) return TOP;
    if (x >= WD.OUT.x0 && x < WD.HATCH.x0 && z > WD.OUT.zb && z < 0) return TOP;
    return 0;
  }

  // -------------------------------------------------------------------------
  // a person: garments as rigid parts on a skeleton
  // -------------------------------------------------------------------------
  class Person {
    constructor(spec) {
      this.s = spec.scale;
      const s = spec.scale;
      this.L = { thigh: 0.45 * s, shin: 0.44 * s, ankle: 0.085 * s, upper: 0.3 * s, fore: 0.27 * s, hipW: 0.095 * s, shW: 0.19 * s, waist: 0.12 * s, shY: 0.43 * s, neck: 0.6 * s };
      this.root = new THREE.Group();
      scene.add(this.root);
      const add = (o) => (this.root.add(o), o);
      const S = (g) => (g.scale(s, s, s), g);
      const m = spec.mats;
      // torso: a lower part on the pelvis, an upper part on the chest (they overlap at the waist)
      this.torsoLo = add(mesh(S(R.loft(spec.torsoLo)), m.top));
      this.torsoHi = add(mesh(S(R.loft(spec.torsoHi)), m.top));
      this.shCap = [0, 1].map(() => add(mesh(S(new THREE.SphereGeometry(spec.shoulderR, 18, 14)), m.top)));
      this.upper = [0, 1].map(() => add(mesh(S(R.tube(0.3, spec.upperR, 20)), m.sleeve || m.top)));
      this.fore = [0, 1].map(() => add(mesh(S(R.tube(0.27, spec.foreR, 20)), m.sleeve || m.top)));
      this.elbow = [0, 1].map(() => add(mesh(S(new THREE.SphereGeometry(spec.foreR[0] * 1.02, 14, 10)), m.sleeve || m.top)));
      this.hips = add(mesh(S(R.loft(spec.hips)), m.legs));
      this.thigh = [0, 1].map(() => add(mesh(S(R.tube(0.45, spec.thighR, 18)), m.legs)));
      this.shin = [0, 1].map(() => add(mesh(S(R.tube(0.44, spec.shinR, 18)), m.legs)));
      this.knee = [0, 1].map(() => add(mesh(S(new THREE.SphereGeometry(spec.shinR[0] * 1.04, 14, 10)), m.legs)));
      // feet: boots or trainers, built round the ankle (+z forward)
      this.foot = [0, 1].map(() => add(mesh(S(makeShoe(spec.shoe)), m.shoe)));
      // hands: open and fist
      this.handO = [0, 1].map((i) => add(mesh(S(makeHand(i, false)), m.hand)));
      this.handF = [0, 1].map((i) => add(mesh(S(makeHand(i, true)), m.hand)));
      // head gear: the hard hat, or the hood
      if (spec.hat) this.hat = add(mesh(S(makeHat()), m.hat));
      if (spec.hood) this.hood = add(mesh(S(makeHood()), m.top));
      this.vis = true;
    }
    setVisible(v) {
      this.root.visible = v;
      this.vis = v;
    }
    // P: pelvis (V3), yaw, lean, roll, spine {pitch, yaw, roll}, head {pitch, yaw},
    //    feet [{x,y,z,yaw,pitch}], hands [V3|null], fist [bool], swing (-1..1), elbowOut
    setPose(P) {
      const L = this.L;
      const qP = new THREE.Quaternion().setFromEuler(new THREE.Euler(P.lean || 0, P.yaw || 0, P.roll || 0, 'YXZ'));
      const sp = P.spine || {};
      const qC = qP.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(sp.pitch || 0, sp.yaw || 0, sp.roll || 0, 'YXZ')));
      const hd = P.head || {};
      const qH = qC.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(hd.pitch || 0, hd.yaw || 0, hd.roll || 0, 'YXZ')));
      const ax = (q, x, y, z) => V(x, y, z).applyQuaternion(q);
      const pel = P.pelvis.clone();
      const chest = pel.clone().add(ax(qP, 0, L.waist, 0));
      this.torsoLo.position.copy(pel);
      this.torsoLo.quaternion.copy(qP);
      this.torsoHi.position.copy(chest);
      this.torsoHi.quaternion.copy(qC);
      this.hips.position.copy(pel);
      this.hips.quaternion.copy(qP);
      const head = chest.clone().add(ax(qC, 0, L.neck, 0.015 * this.s));
      if (this.hat) { this.hat.position.copy(head); this.hat.quaternion.copy(qH); }
      if (this.hood) { this.hood.position.copy(head); this.hood.quaternion.copy(qH); }
      this.headPos = head;
      const fwdC = ax(qC, 0, 0, 1);
      // legs
      for (let i = 0; i < 2; i++) {
        const sd = i === 0 ? 1 : -1; // 0 = left (+x in the body frame)
        const hip = pel.clone().add(ax(qP, sd * L.hipW, -0.065 * this.s, 0));
        const f = P.feet[i];
        const ankle = V(f.x, f.y + L.ankle, f.z);
        const fdir = V(Math.sin(f.yaw), 0, Math.cos(f.yaw));
        const knee = new THREE.Vector3();
        const pole = fdir.clone().add(ax(qP, sd * 0.15, 0, 0));
        const end = R.ik2(hip, ankle, L.thigh, L.shin, pole, knee);
        R.placeSeg(this.thigh[i], hip, knee, fdir, L.thigh);
        R.placeSeg(this.shin[i], knee, end, fdir, L.shin);
        this.knee[i].position.copy(knee);
        this.foot[i].position.copy(end);
        this.foot[i].quaternion.setFromEuler(new THREE.Euler(f.pitch || 0, f.yaw, 0, 'YXZ'));
      }
      // arms
      this.hand = [];
      for (let i = 0; i < 2; i++) {
        const sd = i === 0 ? 1 : -1;
        const sh = chest.clone().add(ax(qC, sd * L.shW, L.shY, -0.01 * this.s));
        this.shCap[i].position.copy(sh);
        this.shCap[i].quaternion.copy(qC);
        let target = P.hands?.[i];
        if (!target) {
          const sw = (P.swing || 0) * (i === 0 ? 1 : -1);
          target = sh.clone().add(ax(qC, sd * 0.07 * this.s, -0.54 * this.s, sw * 0.24 * this.s + 0.04 * this.s));
        }
        const elbow = new THREE.Vector3();
        const pole = ax(qC, sd * (P.elbowOut ?? 0.45), -0.25, -1.0);
        const wrist = R.ik2(sh, target, L.upper, L.fore, pole, elbow);
        R.placeSeg(this.upper[i], sh, elbow, fwdC, L.upper);
        R.placeSeg(this.fore[i], elbow, wrist, fwdC, L.fore);
        this.elbow[i].position.copy(elbow);
        // the hand continues the forearm; its palm faces the body's middle
        const dir = wrist.clone().sub(elbow).normalize();
        const inward = ax(qC, -sd, 0, 0);
        const fist = P.fist?.[i];
        const hh = fist ? this.handF[i] : this.handO[i];
        (fist ? this.handO[i] : this.handF[i]).visible = false;
        hh.visible = true;
        R.placeSeg(hh, wrist, wrist.clone().add(dir), inward, 1);
        hh.scale.set(1, 1, 1);
        this.hand.push({ wrist, dir, elbow, sh });
      }
    }
  }

  // garment pieces --------------------------------------------------------------
  function makeShoe(kind) {
    // around the ankle joint: a shaft, the instep, a rounded toe, the sole
    const gs = [];
    const boot = kind === 'boot';
    const h = boot ? 0.12 : 0.05;
    gs.push(R.loft([[-0.075, 0.058, 0.07, -0.005], [-0.03, 0.06, 0.072], [0.0, 0.056, 0.064], [h, 0.054, 0.058]], 18));
    const toe = new THREE.SphereGeometry(0.058, 18, 12);
    toe.scale(0.95, 0.62, 1.55);
    toe.translate(0, -0.05, 0.085);
    gs.push(toe);
    const heel = new THREE.SphereGeometry(0.052, 16, 10);
    heel.scale(1.0, 0.75, 1.0);
    heel.translate(0, -0.055, -0.04);
    gs.push(heel);
    const sole = new THREE.BoxGeometry(0.105, 0.028, 0.285);
    sole.translate(0, -0.083, 0.035);
    gs.push(sole);
    return G.mergeAll(gs);
  }
  function makeHand(i, fist) {
    // along +y from the wrist; palm facing +z
    const gs = [];
    const palm = new THREE.BoxGeometry(0.082, 0.095, 0.032, 2, 2, 2);
    palm.translate(0, 0.05, 0);
    gs.push(palm);
    if (!fist) {
      const fing = new THREE.CapsuleGeometry(0.016, 0.06, 4, 8);
      for (let k = 0; k < 4; k++) {
        const f = fing.clone();
        f.rotateX(0.25);
        f.translate((k - 1.5) * 0.02, 0.135 - Math.abs(k - 1.5) * 0.008, 0.008);
        gs.push(f);
      }
    } else {
      const fg = new THREE.CapsuleGeometry(0.022, 0.06, 4, 8);
      fg.rotateZ(Math.PI / 2);
      fg.translate(0, 0.098, 0.022);
      gs.push(fg);
    }
    const th = new THREE.CapsuleGeometry(0.015, 0.045, 4, 8);
    th.rotateZ((i === 0 ? -1 : 1) * 0.7);
    th.translate((i === 0 ? 1 : -1) * 0.045, 0.06, 0.018);
    gs.push(th);
    return G.mergeAll(gs);
  }
  function makeHat() {
    // a hard hat: a dome with a raised ridge, a short brim all round, longer at the front
    const gs = [];
    const dome = new THREE.SphereGeometry(0.13, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1.0, 1.0, 1.15);
    dome.translate(0, 0.035, 0.0);
    gs.push(dome);
    const ridge = new THREE.TorusGeometry(0.13, 0.012, 8, 24, Math.PI);
    ridge.rotateY(Math.PI / 2);
    ridge.scale(1, 1.0, 1.15);
    ridge.translate(0, 0.04, 0);
    gs.push(ridge);
    const brim = R.loft([[0.035, 0.132, 0.152], [0.03, 0.15, 0.2, 0.025], [0.022, 0.155, 0.215, 0.03]], 32);
    gs.push(brim);
    return G.mergeAll(gs);
  }
  function makeHood() {
    // a hood standing round an invisible head, open at the front
    const g = new THREE.SphereGeometry(0.125, 24, 16, Math.PI * 0.18, Math.PI * 1.64, 0, Math.PI * 0.72);
    g.rotateY(Math.PI);
    g.scale(1.0, 1.12, 1.08);
    g.translate(0, -0.01, -0.01);
    return g;
  }

  // materials ---------------------------------------------------------------------
  const M = {
    worker: {
      top: R.pufferMat('jacket', '#ff5a0a', [[0.29, 0.335], [-0.02, 0.025]]),
      sleeve: R.pufferMat('sleeve', '#ff5a0a', [[0.15, 0.19]], 0.07),
      legs: R.denimMat('jeans'),
      shoe: R.leatherMat('boots', '#4a3221', 0.6),
      hand: R.leatherMat('gloves', '#b88a5a', 0.7),
      hat: R.hatMat(),
    },
    woman: {
      top: R.knitMat('sweater', '#2c7d84'),
      legs: R.cottonMat('trousers', '#2e3033', 0.8),
      shoe: R.leatherMat('trainersW', '#ecebe6', 0.5),
      hand: R.skinMat('skinW', '#c9906c'),
    },
    kid: {
      top: R.cottonMat('hoodie', '#c42b2b', 0.9),
      legs: R.denimMat('jeansK', '#3a5684'),
      shoe: R.leatherMat('trainersK', '#2d5aa8', 0.5),
      hand: R.skinMat('skinK', '#d29d78'),
    },
  };
  envMats.push(M.worker.hat);
  M.worker.hat.envMap = envMap;

  // body shapes (rings: y, half width, half depth, z offset) ------------------------
  const puffTorsoLo = [[-0.15, 0.205, 0.148], [-0.1, 0.21, 0.152], [0.0, 0.206, 0.146], [0.1, 0.198, 0.139], [0.17, 0.198, 0.139]];
  const puffTorsoHi = [[-0.07, 0.202, 0.142], [0.05, 0.207, 0.147], [0.18, 0.216, 0.154], [0.3, 0.226, 0.157], [0.38, 0.226, 0.152], [0.44, 0.212, 0.137],
    [0.48, 0.172, 0.117], [0.505, 0.115, 0.093, 0.004], [0.52, 0.078, 0.078, 0.006], [0.6, 0.074, 0.074, 0.008], [0.625, 0.072, 0.072, 0.008]];
  const jeansHips = [[-0.17, 0.12, 0.1], [-0.12, 0.165, 0.118], [-0.04, 0.178, 0.124], [0.06, 0.176, 0.12], [0.14, 0.17, 0.116]];
  const worker = new Person({
    scale: 1.0, mats: M.worker, hat: true,
    torsoLo: puffTorsoLo, torsoHi: puffTorsoHi, shoulderR: 0.083,
    upperR: [0.078, 0.076, 0.07, 0.066], foreR: [0.066, 0.062, 0.056, 0.052],
    hips: jeansHips, thighR: [0.09, 0.084, 0.073, 0.063], shinR: [0.063, 0.057, 0.05, 0.055], shoe: 'boot',
  });
  const knitLo = [[-0.13, 0.18, 0.128], [-0.08, 0.184, 0.13], [0.0, 0.176, 0.124], [0.1, 0.166, 0.118], [0.17, 0.166, 0.118]];
  const knitHi = [[-0.07, 0.168, 0.12], [0.05, 0.17, 0.122], [0.18, 0.186, 0.132], [0.3, 0.196, 0.138], [0.38, 0.196, 0.134], [0.44, 0.184, 0.12],
    [0.48, 0.15, 0.1], [0.505, 0.1, 0.08, 0.004], [0.52, 0.068, 0.064, 0.006], [0.545, 0.064, 0.06, 0.006]];
  const woman = new Person({
    scale: 0.93, mats: M.woman,
    torsoLo: knitLo, torsoHi: knitHi, shoulderR: 0.066,
    upperR: [0.06, 0.056, 0.05, 0.046], foreR: [0.046, 0.044, 0.04, 0.042],
    hips: [[-0.17, 0.115, 0.1], [-0.12, 0.17, 0.122], [-0.04, 0.18, 0.126], [0.06, 0.172, 0.118], [0.14, 0.166, 0.115]],
    thighR: [0.084, 0.076, 0.064, 0.054], shinR: [0.054, 0.05, 0.044, 0.046], shoe: 'trainer',
  });
  const hoodLo = [[-0.14, 0.19, 0.136], [-0.09, 0.194, 0.138], [0.0, 0.188, 0.132], [0.1, 0.18, 0.126], [0.17, 0.18, 0.126]];
  const hoodHi = [[-0.07, 0.182, 0.128], [0.05, 0.186, 0.13], [0.18, 0.196, 0.138], [0.3, 0.205, 0.142], [0.38, 0.205, 0.138], [0.44, 0.194, 0.126],
    [0.48, 0.156, 0.108], [0.505, 0.106, 0.088, 0.004], [0.52, 0.08, 0.078, 0.004], [0.56, 0.086, 0.084, 0.0]];
  const kid = new Person({
    scale: 0.7, mats: M.kid, hood: true,
    torsoLo: hoodLo, torsoHi: hoodHi, shoulderR: 0.078,
    upperR: [0.07, 0.066, 0.06, 0.056], foreR: [0.056, 0.052, 0.048, 0.05],
    hips: jeansHips, thighR: [0.09, 0.084, 0.073, 0.063], shinR: [0.063, 0.057, 0.05, 0.055], shoe: 'trainer',
  });

  // -------------------------------------------------------------------------
  // the dog: golden, faceless; a body, a neck and a head with floppy ears, four
  // two-part legs (IK to the paws), a tail
  // -------------------------------------------------------------------------
  class Dog {
    constructor() {
      this.root = new THREE.Group();
      scene.add(this.root);
      const fur = R.furMat('fur', '#c8944e');
      const furD = R.furMat('furD', '#a8783c');
      const add = (o) => (this.root.add(o), o);
      // the trunk: a loft along y, turned to run along z (rump at -z, chest at +z)
      const bg = R.loft([[-0.36, 0.02, 0.02], [-0.34, 0.1, 0.11], [-0.28, 0.14, 0.15], [-0.15, 0.135, 0.15], [0.0, 0.13, 0.155], [0.14, 0.145, 0.17], [0.24, 0.142, 0.165], [0.31, 0.1, 0.12], [0.34, 0.02, 0.02]], 24);
      bg.rotateX(Math.PI / 2);
      this.body = add(mesh(bg, fur));
      this.neck = add(mesh(R.tube(0.2, [0.085, 0.075, 0.065], 16), fur));
      const head = new THREE.Group();
      const skull = mesh(new THREE.SphereGeometry(0.095, 20, 14), fur);
      skull.scale.set(1.0, 0.92, 1.05);
      const muzzle = mesh(R.tube(0.13, [0.055, 0.05, 0.042], 14, true), furD);
      muzzle.rotation.x = Math.PI / 2 + 0.12;
      muzzle.position.set(0, -0.035, 0.05);
      head.add(skull, muzzle);
      for (const s of [-1, 1]) {
        const ear = mesh(new THREE.SphereGeometry(0.06, 12, 8), furD);
        ear.scale.set(0.35, 1.0, 0.75);
        ear.position.set(s * 0.085, -0.03, -0.01);
        ear.rotation.z = s * 0.25;
        head.add(ear);
      }
      this.head = add(head);
      this.legU = [0, 1, 2, 3].map(() => add(mesh(R.tube(0.2, [0.05, 0.042, 0.034], 12), fur)));
      this.legL = [0, 1, 2, 3].map(() => add(mesh(R.tube(0.2, [0.032, 0.028, 0.026], 12), fur)));
      this.paw = [0, 1, 2, 3].map(() => add(mesh(new THREE.SphereGeometry(0.032, 10, 8).scale(1, 0.6, 1.35), furD)));
      this.tail = add(mesh(R.tube(0.3, [0.03, 0.026, 0.018, 0.008], 10, true), fur));
      this.collar = add(mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 20), new THREE.MeshStandardMaterial({ color: new THREE.Color('#b0221c'), roughness: 0.5 })));
    }
    // P: x, y, z (centre of the trunk), yaw, pitch (nose down +), roll,
    //    paws [4] {x, y, z} (0 FL, 1 FR, 2 HL, 3 HR), headPitch, headYaw, wag
    setPose(P) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(P.pitch || 0, P.yaw, P.roll || 0, 'YXZ'));
      const ax = (x, y, z) => V(x, y, z).applyQuaternion(q);
      const c = V(P.x, P.y, P.z);
      this.body.position.copy(c);
      this.body.quaternion.copy(q);
      const fwd = ax(0, 0, 1);
      const nb = c.clone().add(ax(0, 0.06, 0.24));
      const hp = nb.clone().add(ax(0, 0.15, 0.1));
      R.placeSeg(this.neck, nb, hp, fwd, 0.2);
      this.head.position.copy(hp).add(ax(0, 0.03, 0.05));
      this.head.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(P.headPitch || 0, P.headYaw || 0, 0, 'YXZ')));
      this.collar.position.copy(nb.clone().lerp(hp, 0.55));
      this.collar.quaternion.copy(this.neck.quaternion);
      this.collar.rotateX(Math.PI / 2);
      const roots = [[0.075, -0.05, 0.2], [-0.075, -0.05, 0.2], [0.08, -0.03, -0.25], [-0.08, -0.03, -0.25]];
      for (let i = 0; i < 4; i++) {
        const r = c.clone().add(ax(...roots[i]));
        const pw = P.paws[i];
        const tgt = V(pw.x, pw.y + 0.025, pw.z);
        const j = new THREE.Vector3();
        const pole = i < 2 ? fwd.clone().multiplyScalar(-1) : fwd.clone();
        const end = R.ik2(r, tgt, 0.2, 0.2, pole, j);
        R.placeSeg(this.legU[i], r, j, fwd, 0.2);
        R.placeSeg(this.legL[i], j, end, fwd, 0.2);
        this.paw[i].position.copy(end).add(V(0, -0.012, 0)).addScaledVector(fwd, 0.02);
        this.paw[i].quaternion.copy(q);
      }
      const tb = c.clone().add(ax(0, 0.08, -0.33));
      const tdir = ax(Math.sin(P.wag || 0) * 0.5, 0.55, -0.75).normalize();
      R.placeSeg(this.tail, tb, tb.clone().addScaledVector(tdir, 0.3), UPV, 0.3);
    }
  }
  const dog = new Dog();

  // -------------------------------------------------------------------------
  // props in hands: the shovel, the anchor driver, the flashlight
  // -------------------------------------------------------------------------
  const steel = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a8f93'), roughness: 0.35, metalness: 0.9, envMap });
  envMats.push(steel);
  const shovel = new THREE.Group(); // built along +y: blade tip at 0, handle top at 1.12
  {
    const wood = ctx.MAT.woodMaterial('shovelH', '#a77c4f', 'vec2(p.y * 3.0, p.x + p.z)', 0.5, 0.6);
    const shaft = mesh(G.placed(new THREE.CylinderGeometry(0.017, 0.019, 0.82, 10), 0, 0.68, 0), wood);
    const grip = mesh(G.mergeAll([G.placed(new THREE.TorusGeometry(0.05, 0.012, 8, 16), 0, 1.1, 0), G.box(0.012, 0.06, 0.012, 0, 1.06, 0)]), new THREE.MeshStandardMaterial({ color: new THREE.Color('#222'), roughness: 0.5 }));
    const blade = new THREE.Shape();
    blade.moveTo(-0.11, 0.3);
    blade.lineTo(0.11, 0.3);
    blade.lineTo(0.12, 0.08);
    blade.quadraticCurveTo(0, -0.03, -0.12, 0.08);
    blade.closePath();
    const bg = new THREE.ExtrudeGeometry(blade, { depth: 0.006, bevelEnabled: false });
    bg.translate(0, 0, -0.003);
    const sock = mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.12, 10).translate(0, 0.32, 0), steel);
    shovel.add(shaft, grip, mesh(bg, steel), sock);
    scene.add(shovel);
  }
  const placeShovel = (tip, top, face) => R.placeSeg(shovel, tip, top, face, 1.12);
  const drill = new THREE.Group();
  {
    const yel = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f2b705'), roughness: 0.45 });
    const blk = new THREE.MeshStandardMaterial({ color: new THREE.Color('#202020'), roughness: 0.55 });
    drill.add(mesh(new THREE.BoxGeometry(0.11, 0.3, 0.13).translate(0, 0.25, 0), yel));
    drill.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 14).translate(0, 0.08, 0), blk));
    drill.add(mesh(G.box(0.26, 0.03, 0.03, 0, 0.36, 0), blk));
    const bit = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8).translate(0, -0.22, 0), steel);
    drill.add(bit);
    drill.userData.bit = bit;
    scene.add(drill);
  }
  const torchProp = new THREE.Group();
  {
    torchProp.add(mesh(new THREE.BoxGeometry(0.16, 0.12, 0.11), new THREE.MeshStandardMaterial({ color: new THREE.Color('#f2b705'), roughness: 0.45 })));
    torchProp.add(mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.06, 16).rotateZ(Math.PI / 2).translate(0.1, 0.01, 0), new THREE.MeshStandardMaterial({ color: new THREE.Color('#202020'), roughness: 0.5 })));
    const lens = mesh(new THREE.CircleGeometry(0.05, 18).rotateY(Math.PI / 2).translate(0.131, 0.01, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color('#fff2d0'), emissiveIntensity: 0, roughness: 0.1 }), false);
    torchProp.add(lens);
    torchProp.userData.lens = lens;
    scene.add(torchProp);
  }

  // -------------------------------------------------------------------------
  // locomotion helpers
  // -------------------------------------------------------------------------
  const STAND_W = 0.11;
  // a standing stance at (x, z) facing yaw
  function stance(x, z, yaw, inside, w = STAND_W, s = 1) {
    const sx = Math.cos(yaw), sz = -Math.sin(yaw);
    const f = (sd) => {
      const fx = x + sx * sd * w * s, fz = z + sz * sd * w * s;
      return { x: fx, z: fz, y: groundAt(fx, fz, inside), yaw, pitch: 0 };
    };
    return [f(1), f(-1)];
  }
  function easeTravel(u, a) {
    // constant speed in the middle, eased at both ends
    const v = 1 / (1 - a);
    if (u < a) return (v * u * u) / (2 * a);
    if (u > 1 - a) return 1 - (v * (1 - u) * (1 - u)) / (2 * a);
    return (v * a) / 2 + v * (u - a);
  }
  // move along a path between t0 and t1, feet stepping; body position, direction,
  // the feet and the stride phase
  function travel(t, t0, t1, pts, { stride = 1.3, inside = false, width = STAND_W, s = 1, ease = 0.18, lift = 0.11 } = {}) {
    const path = R.pathOf(pts);
    const u = clamp((t - t0) / (t1 - t0));
    const e = ease > 0 ? easeTravel(u, ease) : u;
    const d = e * path.L;
    const p = path.at(d);
    const yaw = Math.atan2(p.dx, p.dz);
    const gr = (x, z) => groundAt(x, z, inside);
    const feet = [0, 1].map((sd) => {
      const f = R.footAt(path, d, stride * s, sd, width * s, gr, lift * s);
      return { x: f.x, y: f.y, z: f.z, yaw: Math.atan2(f.dx, f.dz), pitch: -0.25 * f.swing, swing: f.swing };
    });
    const phase = (d / (stride * s)) * Math.PI * 2;
    return { x: p.x, z: p.z, yaw, feet, phase, u };
  }
  const angLerp = (a, b, k) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * k;
  };
  const pelvisY = (feet, legLen, bob = 0) => (feet[0].y + feet[1].y) * 0.5 + legLen - bob;

  // anchors for other modules (dirt throws, the drill, the flashlight beam)
  ctx.anchors.shovelBlade = new THREE.Vector3();
  ctx.anchors.drillBit = new THREE.Vector3();
  ctx.anchors.torch = { pos: new THREE.Vector3(), dir: new THREE.Vector3(0, -0.4, 1) };
  ctx.anchors.dogShake = new THREE.Vector3();

  // -------------------------------------------------------------------------
  // the worker
  // -------------------------------------------------------------------------
  const LEG = 0.96;
  const TORN_YAW = -3.02; // facing the far tornado (away from us, a little left)
  const SHOVEL0 = { tip: V(3.98, -0.18, -0.42), top: V(4.06, 0.94, -0.5) };
  const SHOVEL_LAWN = { tip: V(5.55, 0.03, -1.85), top: V(4.45, 0.05, -1.55) }; // lies on the lawn after the dig
  const DIG_X = (t) => lerp(3.05, -0.75, smooth(prog(t, 7.7, 4.6)));
  const ROOM_SPOT = { x: 0.5, z: -1.25 }; // right of the middle: the labels on the left wall stay clear
  const SEAT = { w: -0.1, wo: -0.62, k: -1.12 }; // bench seats (x): the worker, the woman, the kid
  const seatZ = WD.BENCH.z0 + 0.24;
  const STEP6 = WD.stepX(6) + 0.12; // standing on the seventh step: just under the closed door
  const qYaw = (yaw) => new THREE.Quaternion().setFromAxisAngle(UPV, yaw);
  function sitPose(P, x, s) {
    // on the bench: pelvis over the seat, thighs forward, feet on the floor
    P.pelvis = V(x, WD.BENCH.seat + 0.09 * s, seatZ);
    P.yaw = 0;
    P.lean = -0.08;
    const fy = Math.max(FLOOR, WD.BENCH.seat - 0.47 * s - 0.04);
    P.feet = [{ x: x + 0.12 * s, y: fy, z: seatZ + 0.42 * s, yaw: 0.1 }, { x: x - 0.12 * s, y: fy, z: seatZ + 0.42 * s, yaw: -0.1 }];
    return P;
  }
  const blank = () => ({ pelvis: V(0, 0, 0), yaw: 0, lean: 0, spine: { pitch: 0.03, yaw: 0, roll: 0 }, head: { pitch: 0, yaw: 0 }, feet: null, hands: [null, null], fist: [false, false], swing: 0 });
  const walkTo = (P, tr, leg, bob = 0.025) => {
    P.feet = tr.feet;
    P.yaw = tr.yaw;
    P.pelvis = V(tr.x, pelvisY(tr.feet, leg, bob * Math.abs(Math.sin(tr.phase))), tr.z);
    P.swing = Math.sin(tr.phase);
    return P;
  };
  const onStep = (P, x, z, yaw, leg) => {
    P.feet = stance(x, z, yaw, true, 0.1);
    P.feet[0].x += 0.1;
    P.feet.forEach((f) => (f.y = WD.stairY(f.x)));
    P.pelvis = V(x + 0.03, pelvisY(P.feet, leg) - 0.08, z);
    P.yaw = yaw;
    return P;
  };

  function workerPose(t) {
    const P = blank();
    let shovelState = { mode: 'free', ...SHOVEL_LAWN };
    let drillOn = false, torchOn = false;
    const breathe = 0.008 * Math.sin(t * 1.9);
    if (t < 7.45) {
      // scene 1: on the lawn; turns to the tornado, looks up; turns, takes the shovel
      shovelState = { mode: 'ground' };
      const x = 3.3, z = -0.85;
      const turn1 = smooth01(t, 0.95, 0.8), turn2 = smooth01(t, 4.05, 0.45), turn3 = smooth01(t, 6.3, 0.9);
      let yaw = angLerp(0.42, TORN_YAW, turn1);
      yaw = angLerp(yaw, 1.15, turn2);
      yaw = angLerp(yaw, -1.2, turn3);
      const step = smooth01(t, 4.15, 0.4) * (1 - smooth01(t, 6.35, 0.6));
      const px = x + 0.32 * step, pz = z + 0.2 * step;
      P.feet = stance(px, pz, yaw, false);
      const sh = Math.max(bump(t, 0.95, 1.75, 0.2), bump(t, 4.05, 4.5, 0.12), bump(t, 6.3, 7.2, 0.2));
      P.feet[0].y += 0.05 * sh * Math.max(0, Math.sin(t * 14));
      P.feet[1].y += 0.05 * sh * Math.max(0, Math.sin(t * 14 + 3));
      P.pelvis = V(px, LEG + breathe, pz);
      P.yaw = yaw;
      P.head.pitch = -0.28 * smooth01(t, 1.5, 0.7) * (1 - turn2);
      P.spine.pitch = 0.03 - 0.06 * smooth01(t, 1.5, 0.7) * (1 - turn2);
      // grabs the shovel (right hand), pulls it out, holds it across the body
      const grab = smooth01(t, 4.35, 0.25), pull = smooth01(t, 4.6, 0.4), ready = smooth01(t, 5.0, 0.45);
      if (t > 4.3) {
        const tip = SHOVEL0.tip.clone().lerp(V(px + 0.35, 0.05, pz + 0.25), pull);
        const top = SHOVEL0.top.clone().lerp(V(px + 0.55, 1.15, pz + 0.1), pull);
        const q = qYaw(yaw);
        tip.lerp(V(px, 0, pz).add(V(-0.12, 0.35, 0.5).applyQuaternion(q)), ready);
        top.lerp(V(px, 0, pz).add(V(0.1, 1.05, 0.3).applyQuaternion(q)), ready);
        shovelState = { mode: 'held', tip, top };
        const handTop = top.clone().lerp(tip, 0.06);
        const rest = V(px - 0.2, 0.85, pz);
        P.hands[1] = rest.lerp(handTop, grab);
        if (ready > 0) P.hands[0] = top.clone().lerp(tip, 0.45);
        P.fist = [ready > 0.5, grab > 0.5];
      }
    } else if (t < 12.75) {
      // scene 2: digging fast, down in the pit, moving left as it opens
      const pit = WD.pit(t);
      const x = DIG_X(t), z = -1.3;
      const fy = -pit.d;
      const yaw = -1.2 + 0.25 * Math.sin(t * 0.9);
      let i = WD.DIG_T.findIndex((s) => s > t);
      if (i < 0) i = WD.DIG_T.length;
      const prevT = i > 0 ? WD.DIG_T[i - 1] : T.dig0 - 0.3;
      const nextT = i < WD.DIG_T.length ? WD.DIG_T[i] : prevT + 0.32;
      const ph = clamp((t - prevT) / Math.max(0.05, nextT - prevT)); // 0 just thrown ... 1 next lift
      const q = qYaw(yaw);
      const loc = (a, b, c) => V(x, fy, z).add(V(a, b, c).applyQuaternion(q));
      // blade: high over the right shoulder (0) -> down into the soil in front -> lever up (1)
      const down = smooth(clamp((ph - 0.1) / 0.45)), lift = smooth(clamp((ph - 0.82) / 0.18));
      let tip = loc(-0.55, 1.35, -0.25).lerp(loc(0.05, 0.02, 0.62), down).lerp(loc(0.0, 0.3, 0.5), lift);
      let top = loc(0.15, 1.1, 0.35).lerp(loc(-0.05, 0.95, 0.05), down).lerp(loc(-0.05, 0.75, -0.05), lift);
      if (t < WD.DIG_T[0] - 0.3) {
        tip = loc(0.05, 0.0, 0.6);
        top = loc(-0.05, 1.0, 0.05);
      }
      shovelState = { mode: 'held', tip, top };
      P.hands = [top.clone().lerp(tip, 0.42), top.clone().lerp(tip, 0.05)];
      P.fist = [true, true];
      P.feet = stance(x, z, yaw, false, 0.17);
      P.feet.forEach((f) => (f.y = fy));
      P.feet[0].x += 0.08 * Math.sin(yaw);
      P.feet[0].z += 0.08 * Math.cos(yaw);
      const bend = 0.55 * down * (1 - lift) + 0.15;
      P.lean = bend * 0.6;
      P.spine.pitch = bend * 0.5;
      P.spine.yaw = -0.35 * (1 - down) + 0.1;
      P.pelvis = V(x, fy + LEG - 0.1 * bend, z).add(V(0, 0, -0.12 * bend).applyQuaternion(q));
      P.yaw = yaw;
      P.head.pitch = 0.25 * bend;
      ctx.anchors.shovelBlade.copy(tip);
    } else if (t < T.rebar0) {
      // the pit is done: he tosses the shovel up onto the lawn, looks round
      const x = DIG_X(t), z = -1.3, fy = -WD.pit(t).d;
      const yaw = angLerp(-1.2, 0.3, smooth01(t, 12.8, 0.6));
      P.feet = stance(x, z, yaw, false);
      P.feet.forEach((f) => (f.y = fy));
      P.pelvis = V(x, fy + LEG + breathe, z);
      P.yaw = yaw;
      const toss = smooth01(t, 13.3, 0.35);
      const fly = prog(t, 13.65, 0.9);
      if (fly <= 0) {
        const q = qYaw(yaw);
        const tip = V(x, fy, z).add(V(-0.2, 0.05 + toss * 1.4, 0.45).applyQuaternion(q));
        const top = V(x, fy, z).add(V(0.1, 1.05 + toss * 1.4, 0.2).applyQuaternion(q));
        shovelState = { mode: 'held', tip, top };
        P.hands = [top.clone().lerp(tip, 0.4), top.clone().lerp(tip, 0.05)];
        P.fist = [true, true];
      } else {
        // a high arc out of the pit onto the lawn on the right
        const e = easeOutCubic(fly);
        const arc = Math.sin(fly * Math.PI) * 2.2;
        const tip = V(x - 0.2, fy + 1.5, z + 0.4).lerp(SHOVEL_LAWN.tip, e).add(V(0, arc, 0));
        const top = V(x + 0.1, fy + 2.5, z + 0.2).lerp(SHOVEL_LAWN.top, e).add(V(0, arc, 0));
        shovelState = { mode: 'held', tip, top };
        P.spine.pitch = -0.1 * (1 - fly);
      }
      P.head.pitch = -0.35 * smooth01(t, 13.6, 0.4) * (1 - smooth01(t, 14.6, 0.5));
    } else if (t < 38.4) {
      // scenes 3 - 5: in the room (the walls come up round him); looks round at the
      // cages, up at the plank's hit; the anchor driver
      const x = ROOM_SPOT.x, z = ROOM_SPOT.z;
      const fy = lerp(-2.6, FLOOR, smooth01(t, T.pour0 - 0.15, 0.4));
      let yaw = 0.3 + 0.35 * Math.sin(t * 0.5) * (1 - smooth01(t, 20, 1));
      const look = Math.sin((t - T.rebar0) * 2.4) * bump(t, T.rebar0, T.slab + 0.5, 0.3);
      const drillK = smooth01(t, T.drill0 - 0.9, 0.5) * (1 - smooth01(t, T.uplift0 - 0.2, 0.5));
      yaw = angLerp(yaw, -0.25, drillK);
      P.feet = stance(x, z, yaw, true, 0.12 + 0.05 * drillK);
      P.feet.forEach((f) => (f.y = fy));
      const flinch = bump(t, T.hit - 0.02, T.hit + 0.55, 0.06);
      P.pelvis = V(x, fy + LEG + breathe - 0.05 * flinch - 0.12 * drillK, z);
      P.yaw = yaw;
      P.head.yaw = 0.4 * look;
      P.head.pitch = -0.5 * bump(t, T.plank0 + 0.6, T.hit + 0.9, 0.4) - 0.2 * bump(t, T.slab - 0.2, T.slab + 1.2, 0.3) + 0.35 * drillK;
      P.spine.pitch = 0.03 - 0.12 * flinch + 0.42 * drillK;
      P.lean = 0.25 * drillK;
      const q = qYaw(yaw);
      if (flinch > 0.01) {
        // arms come up a little at the bang
        P.hands = [V(x, fy, z).add(V(0.25, 1.35, 0.25).applyQuaternion(q)).lerp(V(x + 0.2, fy + 0.85, z), 1 - flinch), V(x, fy, z).add(V(-0.25, 1.35, 0.25).applyQuaternion(q)).lerp(V(x - 0.2, fy + 0.85, z), 1 - flinch)];
      }
      if (drillK > 0.01) {
        const base = V(x, fy, z).add(V(0.0, 0.0, 0.55).applyQuaternion(q));
        drillOn = true;
        const dtop = base.clone().add(V(0, 0.62, 0));
        P.hands = [dtop.clone().add(V(0.13, 0.02, 0).applyQuaternion(q)), dtop.clone().add(V(-0.13, 0.02, 0).applyQuaternion(q))];
        P.fist = [true, true];
        drill.position.copy(base.clone().add(V(0, 0.3, 0)));
        drill.rotation.set(0, yaw, 0);
        drill.userData.bit.rotation.y = t > T.drill0 && t < T.drill1 + 1 ? t * 40 : 0;
        ctx.anchors.drillBit.copy(base);
      }
    } else if (t < T.workerUp) {
      // scenes 6 - 8: to the stairs (the door, the bolts), back down, the vents, the bench
      if (t < 40.8) {
        const tr = travel(t, 38.4, 40.8, [[ROOM_SPOT.x, ROOM_SPOT.z], [1.0, -0.62], [1.75, -0.6], [STEP6, -0.6]], { stride: 1.2, inside: true });
        walkTo(P, tr, LEG);
        P.swing *= 1 - smooth01(t, 40.5, 0.3);
        P.spine.pitch = 0.12 * smooth01(t, 39.6, 0.5);
      } else if (t < 44.55) {
        onStep(P, STEP6, -0.6, Math.PI / 2, LEG);
        P.lean = 0.12;
        P.spine.pitch = 0.1;
        P.head.pitch = -0.75 * smooth01(t, 40.8, 0.5);
        // reaches up to each bolt as it shoots home
        const reach = bump(t, T.bolts[0] - 0.35, T.bolts[2] + 0.45, 0.2);
        if (reach > 0) {
          let k = T.bolts.findIndex((b) => t < b + 0.15);
          if (k < 0) k = 2;
          const bx = (WD.HATCH.x0 + WD.HATCH.x1) / 2 + [-0.55, 0, 0.55][k];
          const rest = V(STEP6 - 0.1, P.pelvis.y + 0.1, -0.45);
          P.hands[1] = rest.lerp(V(bx, 0.08, -0.08), reach);
          P.fist[1] = true;
        }
      } else if (t < 46.0) {
        walkTo(P, travel(t, 44.55, 46.0, [[STEP6, -0.6], [1.75, -0.62], [1.0, -0.9], [0.25, -1.2]], { stride: 1.2, inside: true }), LEG);
      } else if (t < T.bench + 0.3) {
        // stuffy: wipes his brow, fans himself; looks up at the vents; breathes the fresh air
        const yaw = angLerp(-0.6, 0.2, smooth01(t, 46.0, 0.6));
        P.feet = stance(0.25, -1.2, yaw, true);
        P.pelvis = V(0.25, FLOOR + LEG + 0.012 * Math.sin(t * 2.4), -1.2);
        P.yaw = yaw;
        const wipe = bump(t, 46.15, 47.25, 0.2), fan = bump(t, 47.1, 47.9, 0.15);
        const q = qYaw(yaw);
        if (wipe > 0) P.hands[1] = V(0.25, FLOOR, -1.2).add(V(-0.12 + 0.12 * Math.sin(t * 9), 1.62, 0.18).applyQuaternion(q)).lerp(V(0.13, FLOOR + 0.85, -1.15), 1 - wipe);
        if (fan > 0) P.hands[0] = V(0.25, FLOOR, -1.2).add(V(0.2, 1.42 + 0.06 * Math.sin(t * 22), 0.28).applyQuaternion(q)).lerp(V(0.37, FLOOR + 0.85, -1.15), 1 - fan);
        P.head.pitch = -0.55 * bump(t, 47.9, 50.0, 0.35);
        P.head.yaw = -0.5 * bump(t, 47.9, 49.0, 0.3) + 0.4 * bump(t, 48.9, 50.0, 0.3);
        P.spine.pitch = -0.08 * bump(t, 50.4, 51.8, 0.4); // a deep breath of the fresh air
      } else if (t < T.bench + 1.0) {
        walkTo(P, travel(t, T.bench + 0.3, T.bench + 1.0, [[0.25, -1.2], [SEAT.k, seatZ + 0.35]], { stride: 1.0, inside: true }), LEG);
      } else {
        sitPose(P, SEAT.k, 1);
        const down = 1 - smooth01(t, T.bench + 1.0, 0.4);
        P.pelvis.y += 0.3 * down;
        P.pelvis.z += 0.25 * down;
        // turns to watch the supplies land on the shelf
        P.head.yaw = 0.7 * smooth01(t, 53.6, 0.5);
        P.spine.yaw = 0.25 * smooth01(t, 53.6, 0.5);
        P.hands = [V(SEAT.k + 0.15, WD.BENCH.seat + 0.22, seatZ + 0.32), V(SEAT.k - 0.15, WD.BENCH.seat + 0.22, seatZ + 0.32)];
        const up = smooth01(t, T.workerUp - 0.5, 0.45);
        P.pelvis.y += 0.3 * up;
        P.pelvis.z += 0.25 * up;
      }
    } else if (t < 64.6) {
      // scene 9: up the stairs, opens the hatch, out; waves them in; down last, the door
      const OUTSIDE = [4.55, -0.82];
      if (t < T.hatchOpen) {
        walkTo(P, travel(t, T.workerUp, T.hatchOpen, [[SEAT.k, seatZ + 0.35], [1.0, -0.62], [1.75, -0.6], [STEP6, -0.6]], { stride: 1.5, inside: true, ease: 0.1 }), LEG, 0.03);
        P.lean = 0.1;
      } else if (t < T.hatchOpen + 0.35) {
        onStep(P, STEP6, -0.6, Math.PI / 2, LEG);
        const push = smooth01(t, T.hatchOpen - 0.15, 0.4);
        P.hands = [V(2.75, 0.1 + 0.4 * push, -0.45), V(3.0, 0.1 + 0.4 * push, -0.75)];
        P.head.pitch = -0.6;
        P.lean = 0.2;
      } else if (t < 60.55) {
        walkTo(P, travel(t, T.hatchOpen + 0.35, 60.55, [[STEP6, -0.6], [3.55, -0.6], OUTSIDE], { stride: 1.0, inside: true, lift: 0.3, ease: 0.15 }), LEG);
        P.lean = 0.2;
      } else if (t < 62.7) {
        // beside the hatch, waving them in (towards the gate, behind him)
        const yaw = angLerp(-0.6, 2.4, smooth01(t, 60.55, 0.4));
        P.feet = stance(OUTSIDE[0], OUTSIDE[1], yaw, false);
        P.pelvis = V(OUTSIDE[0], LEG + breathe, OUTSIDE[1]);
        P.yaw = yaw;
        const wave = bump(t, 60.7, 62.4, 0.25);
        const q = qYaw(yaw);
        const arm = V(OUTSIDE[0], 0, OUTSIDE[1]).add(V(-0.35, 1.3 + 0.25 * Math.sin(t * 8), 0.25 + 0.15 * Math.sin(t * 8)).applyQuaternion(q));
        if (wave > 0) P.hands[1] = arm.lerp(V(OUTSIDE[0] - 0.2, 0.85, OUTSIDE[1]), 1 - wave);
        P.head.yaw = -0.3;
      } else {
        // goes down last, pulls the door shut over his head, shoots the bolts, down
        const tr = travel(t, 62.7, 64.6, [OUTSIDE, [3.95, -0.6], [STEP6, -0.6], [1.75, -0.62], [1.0, -0.9]], { stride: 1.0, inside: true, ease: 0.1, lift: 0.18 });
        walkTo(P, tr, LEG, 0.02);
        const pull = bump(t, T.doorClose - 0.5, T.lockAll + 0.3, 0.15);
        if (pull > 0) {
          P.hands[1] = V(tr.x + 0.15, lerp(P.pelvis.y + 0.2, 0.05, pull), -0.25);
          P.hands[0] = V(tr.x + 0.35, lerp(P.pelvis.y + 0.2, 0.05, pull * smooth01(t, T.lockAll - 0.2, 0.2)), -0.15);
          P.head.pitch = -0.6 * pull;
          P.swing = 0;
        }
      }
    } else if (t < T.unbolt - 0.9) {
      // in the room: to the bench, sits, the flashlight on
      shovelState = { mode: 'gone' };
      if (t < 65.0) {
        walkTo(P, travel(t, 64.6, 65.0, [[1.0, -0.9], [SEAT.w, seatZ + 0.35]], { stride: 1.0, inside: true, ease: 0.3 }), LEG);
      } else {
        sitPose(P, SEAT.w, 1);
        const sitDown = 1 - smooth01(t, 65.0, 0.35);
        const stand = smooth01(t, T.unbolt - 1.3, 0.4);
        P.pelvis.y += 0.3 * (sitDown + stand);
        P.pelvis.z += 0.25 * (sitDown + stand);
        // the flashlight in his right hand, resting on his knee, lighting the floor ahead
        torchOn = t > T.torch;
        P.hands[1] = V(SEAT.w - 0.12, WD.BENCH.seat + 0.2, seatZ + 0.5);
        P.hands[0] = V(SEAT.w + 0.12, WD.BENCH.seat + 0.15, seatZ + 0.42);
        P.fist = [false, true];
        P.head.pitch = 0.1;
        P.head.yaw = -0.2 * Math.sin(t * 0.4);
      }
    } else {
      // scene 10: up the stairs, the bolts back, the door open, out onto the lawn
      shovelState = { mode: 'gone' };
      const LAWN = [1.3, -3.15];
      if (t < T.unbolt) {
        walkTo(P, travel(t, T.unbolt - 0.9, T.unbolt, [[SEAT.w, seatZ + 0.35], [1.0, -0.62], [1.75, -0.6], [STEP6, -0.6]], { stride: 1.3, inside: true, ease: 0.15 }), LEG);
      } else if (t < T.out[0]) {
        onStep(P, STEP6, -0.6, Math.PI / 2, LEG);
        P.hands[1] = V(2.6, 0.05, -0.1);
        P.hands[0] = V(2.9, 0.05 + 0.6 * smooth01(t, T.doorOpen - 0.2, 0.5), -0.6);
        P.head.pitch = -0.6;
      } else {
        const tr = travel(t, T.out[0], T.out[0] + 2.6, [[STEP6, -0.6], [3.6, -0.6], [4.4, -0.65], [4.55, -1.9], [3.4, -2.6], LAWN], { stride: 1.05, inside: true, lift: 0.25, ease: 0.15 });
        walkTo(P, tr, LEG, 0.02);
        P.yaw = tr.u < 1 ? tr.yaw : angLerp(tr.yaw, 0.4, smooth01(t, T.out[0] + 2.6, 0.6));
        P.swing *= 1 - tr.u * tr.u;
        // looks round at the yard; hands on the hips
        P.head.yaw = 0.6 * Math.sin((t - 77) * 0.7) * smooth01(t, 77.2, 0.6);
        const hips = smooth01(t, 78.6, 0.5);
        if (hips > 0) {
          const q = qYaw(P.yaw);
          P.hands = [P.pelvis.clone().add(V(0.24, 0.12, 0.0).applyQuaternion(q)), P.pelvis.clone().add(V(-0.24, 0.12, 0.0).applyQuaternion(q))];
          P.elbowOut = 1.2;
        }
      }
    }
    return { P, shovelState, drillOn, torchOn };
  }

  // -------------------------------------------------------------------------
  // the family: through the gate, across the lawn, down the stairs, the bench;
  // afterwards up and out onto the lawn behind the shelter
  // -------------------------------------------------------------------------
  const GATE_P = [WD.GATE.x - 0.1, WD.FENCE_Z + 0.4];
  const famPath = (lane, end) => [[GATE_P[0] + lane, GATE_P[1] - 0.6], [GATE_P[0] + lane, GATE_P[1] + 0.4], [5.3 + lane * 0.5, -3.6], [4.55, -1.1], end];
  function personTrip(t, who, s, leg) {
    const P = blank();
    let vis = true;
    if (t < who.run0) {
      vis = false;
      P.feet = stance(0, 0, 0, false);
    } else if (t < who.run1) {
      // hurrying (a quick run), leaning into it
      const tr = travel(t, who.run0, who.run1, famPath(who.lane, [4.35, -0.62]), { stride: 1.75, s, ease: 0.12, lift: 0.16 });
      walkTo(P, tr, leg * 0.97, 0.04 * s);
      P.lean = 0.18;
      P.spine.pitch = 0.1;
      P.swing = 1.4 * Math.sin(tr.phase);
      P.elbowOut = 0.3;
      P.head.pitch = 0.1;
    } else if (t < who.down1) {
      // down the stairs and into the room to the bench
      const tr = travel(t, who.run1, who.down1, [[4.35, -0.62], [3.95, -0.6], [WD.stepX(3), -0.6], [1.8, -0.62], [1.0, -0.9], [who.seatX, seatZ + 0.35]], { stride: 0.95, s, inside: true, ease: 0.08, lift: 0.18 });
      walkTo(P, tr, leg, 0.02);
      P.lean = 0.12;
      P.swing *= 0.6;
      // a hand on the rail on the way down
      if (tr.x > 1.8 && tr.x < 3.9) P.hands[0] = V(tr.x - 0.15, WD.stairY(tr.x - 0.15) + 0.9 * s, -1.1);
    } else if (t < who.out0) {
      sitPose(P, who.seatX, s);
      const sitDown = 1 - smooth01(t, who.down1, 0.4), stand = smooth01(t, who.out0 - 0.4, 0.4);
      P.pelvis.y += 0.28 * s * (sitDown + stand);
      P.pelvis.z += 0.22 * s * (sitDown + stand);
      P.hands = [V(who.seatX + 0.14 * s, WD.BENCH.seat + 0.16 * s, seatZ + 0.3 * s), V(who.seatX - 0.14 * s, WD.BENCH.seat + 0.16 * s, seatZ + 0.3 * s)];
      P.head.pitch = 0.15 + 0.1 * Math.sin(t * 0.7 + s * 5);
      P.head.yaw = 0.25 * Math.sin(t * 0.5 + s * 3);
    } else {
      const tr = travel(t, who.out0, who.out1, [[who.seatX, seatZ + 0.35], [1.0, -0.62], [1.8, -0.6], [3.6, -0.6], [4.4, -0.66], [4.55, -1.95], [3.4, -2.65], who.lawn], { stride: 1.0, s, inside: true, ease: 0.12, lift: 0.22 });
      walkTo(P, tr, leg, 0.02);
      P.yaw = tr.u < 1 ? tr.yaw : angLerp(tr.yaw, who.endYaw ?? 0.3, smooth01(t, who.out1, 0.6));
      P.swing *= 0.8 * (1 - tr.u * tr.u);
      if (tr.x > 1.8 && tr.x < 3.9 && tr.u < 0.7) P.hands[0] = V(tr.x + 0.1, WD.stairY(tr.x + 0.1) + 0.9 * s, -1.1);
      P.head.yaw = 0.5 * Math.sin((t - who.out1) * 0.8) * smooth01(t, who.out1, 0.6);
    }
    return { P, vis };
  }
  const WOMAN = { run0: T.run0 + 0.05, run1: 62.25, down1: 64.5, seatX: SEAT.wo, out0: T.out[1], out1: T.out[1] + 3.0, lane: -0.25, lawn: [0.45, -3.55], endYaw: 0.5 };
  const KID = { run0: T.run0, run1: 61.9, down1: 63.9, seatX: SEAT.k, out0: T.out[2], out1: T.out[2] + 2.9, lane: 0.25, lawn: [1.85, -2.95], endYaw: -0.2 };
  const WOMAN_LEG = 0.96 * 0.93, KID_LEG = 0.96 * 0.7;

  // the dog: runs in ahead, bounds down the stairs, lies at the kid's feet; out
  // last, shakes off the dust
  function dogPose(t) {
    const P = { x: 0, y: 0.38, z: 0, yaw: 0, pitch: 0, roll: 0, paws: [], headPitch: -0.15, headYaw: 0, wag: Math.sin(t * 9) * 0.5 };
    let vis = true;
    const Hh = 0.36; // trunk height when standing
    const legs = (x, z, yaw, inside, gaitPhase, stride, run) => {
      const sx = Math.cos(yaw), sz = -Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
      const offs = [[0.075, 0.21], [-0.075, 0.21], [0.08, -0.24], [-0.08, -0.24]];
      const phases = run ? [0, 0.1, 0.5, 0.6] : [0, 0.5, 0.5, 0];
      return offs.map(([a, b], i) => {
        const ph = gaitPhase / (Math.PI * 2) + phases[i];
        const f = ph - Math.floor(ph);
        const sw = f > 0.5 ? Math.sin(((f - 0.5) / 0.5) * Math.PI) : 0;
        const slide = f <= 0.5 ? 0.5 - f * 2 : -0.5 + ((f - 0.5) / 0.5) * 1.0;
        const px = x + sx * a + fx * (b + slide * stride * 0.5);
        const pz = z + sz * a + fz * (b + slide * stride * 0.5);
        return { x: px, y: groundAt(px, pz, inside) + 0.07 * sw, z: pz };
      });
    };
    const standPaws = (x, z, yaw, inside) => legs(x, z, yaw, inside, 0, 0, false);
    const D_RUN0 = T.run0 + 0.1, D_RUN1 = 61.55, D_DOWN1 = 63.0;
    const SPOT = [-0.85, -1.62];
    if (t < D_RUN0) {
      vis = false;
      P.paws = standPaws(0, 0, 0, false);
    } else if (t < D_RUN1) {
      const tr = travel(t, D_RUN0, D_RUN1, famPath(0.45, [4.3, -0.55]), { stride: 1.0, ease: 0.1 });
      P.x = tr.x; P.z = tr.z; P.yaw = tr.yaw;
      P.y = Hh - 0.02 + 0.04 * Math.abs(Math.sin(tr.phase));
      P.paws = legs(tr.x, tr.z, tr.yaw, false, tr.phase * 2.0, 0.55, true);
      P.pitch = 0.05 * Math.sin(tr.phase * 2);
      P.wag = 0.3 * Math.sin(t * 7);
    } else if (t < D_DOWN1) {
      // bounds down the steps (nose down), trots to its spot
      const tr = travel(t, D_RUN1, D_DOWN1, [[4.3, -0.55], [3.95, -0.55], [WD.stepX(4), -0.55], [1.8, -0.6], [0.8, -1.2], SPOT], { stride: 0.9, inside: true, ease: 0.08 });
      P.x = tr.x; P.z = tr.z; P.yaw = tr.yaw;
      const onStairs = tr.x > 1.75 && tr.x < 3.95;
      P.y = groundAt(tr.x, tr.z, true) + Hh + 0.05 * Math.abs(Math.sin(tr.phase * 2));
      P.pitch = onStairs ? 0.62 : 0;
      P.paws = legs(tr.x, tr.z, tr.yaw, true, tr.phase * 2.0, 0.45, true);
      if (onStairs) P.paws.forEach((p) => { p.y = WD.stairY(p.x); });
    } else if (t < 76.6) {
      // lies down, head up; looks round at the noise
      const lie = smooth01(t, D_DOWN1, 0.5);
      P.x = SPOT[0]; P.z = SPOT[1]; P.yaw = 0.2;
      P.y = FLOOR + lerp(Hh, 0.17, lie);
      P.paws = standPaws(SPOT[0], SPOT[1], 0.2, true).map((p, i) => ({ x: p.x + Math.sin(0.2) * (i < 2 ? 0.2 : -0.1) * lie, y: FLOOR, z: p.z + Math.cos(0.2) * (i < 2 ? 0.2 : -0.1) * lie }));
      P.headPitch = -0.2 + 0.12 * Math.sin(t * 0.6);
      P.headYaw = 0.6 * Math.sin(t * 0.45) * smooth01(t, 64.6, 1);
      P.wag = 0.15 * Math.sin(t * 3);
      P.y = lerp(P.y, FLOOR + Hh, smooth01(t, 76.2, 0.4));
    } else {
      // out: bounds up the stairs and out, trots to the lawn, shakes
      const tr = travel(t, 76.6, 77.75, [SPOT, [0.8, -1.0], [1.8, -0.6], [3.7, -0.55], [4.4, -0.62], [4.5, -1.9], [3.2, -2.55], [-0.3, -2.95]], { stride: 0.9, inside: true, ease: 0.1 });
      P.x = tr.x; P.z = tr.z;
      P.yaw = tr.u < 1 ? tr.yaw : angLerp(tr.yaw, 0.9, smooth01(t, 77.75, 0.4));
      const inside = tr.x < 4.3 && tr.z > -1.25;
      const onStairs = tr.x > 1.75 && tr.x < 3.95 && tr.u < 0.6;
      P.y = groundAt(tr.x, tr.z, inside) + Hh + (tr.u < 1 ? 0.05 * Math.abs(Math.sin(tr.phase * 2)) : 0);
      P.pitch = onStairs ? -0.6 : 0;
      P.paws = tr.u < 1 ? legs(tr.x, tr.z, P.yaw, inside, tr.phase * 2.0, 0.45, true) : standPaws(tr.x, tr.z, P.yaw, false);
      if (onStairs) P.paws.forEach((p) => { p.y = WD.stairY(p.x); });
      // the shake: fast rolls along the body, decaying
      const sk = prog(t, T.shake, 0.85);
      if (sk > 0 && sk < 1) {
        P.roll = 0.55 * Math.sin(sk * Math.PI * 2 * 6) * (1 - sk);
        P.headYaw = 0.5 * Math.sin(sk * Math.PI * 2 * 6 + 0.6) * (1 - sk);
      }
      P.wag = Math.sin(t * 12) * 0.7;
      ctx.anchors.dogShake.set(P.x, P.y, P.z);
    }
    return { P, vis };
  }

  // the flashlight's beam (the spot light from main.js)
  const torchL = ctx.torch;
  updaters.push((t) => {
    const w = workerPose(t);
    worker.setPose(w.P);
    const ss = w.shovelState;
    shovel.visible = ss.mode !== 'gone';
    if (ss.mode === 'ground') placeShovel(SHOVEL0.tip, SHOVEL0.top, V(0, 0, 1));
    else if (ss.mode !== 'gone') {
      // in the tornado the shovel on the lawn is blown away
      let tip = ss.tip, top = ss.top;
      const blow = prog(t, T.hitT + 2.2, 2.0);
      if (blow > 0) {
        const off = V(blow * blow * 18 + blow * 4, blow * 5, blow * 3);
        tip = tip.clone().add(off);
        top = top.clone().add(off).add(V(Math.sin(blow * 9) * 0.6, Math.cos(blow * 7) * 0.5, 0));
        shovel.visible = blow < 0.95;
      }
      placeShovel(tip, top, V(0, 0, 1));
    }
    drill.visible = w.drillOn;
    // the flashlight: in the worker's right hand while they sit out the storm
    const hold = t > T.torch - 0.6 && t < T.unbolt - 0.9;
    torchProp.visible = hold;
    if (hold && worker.hand?.[1]) {
      const h = worker.hand[1];
      torchProp.position.copy(h.wrist).addScaledVector(h.dir, 0.06);
      torchProp.rotation.set(0, -Math.PI / 2 + 0.35, -0.55);
      torchProp.updateMatrixWorld();
      torchProp.userData.lens.material.emissiveIntensity = w.torchOn ? 8 : 0;
      const lensP = torchProp.userData.lens.localToWorld(new THREE.Vector3(0.131, 0.01, 0));
      torchL.position.copy(lensP);
      const d = V(1, 0, 0).applyEuler(torchProp.rotation);
      torchL.target.position.copy(lensP).addScaledVector(d, 3);
      torchL.target.updateMatrixWorld();
      torchL.intensity = w.torchOn ? 9 * (1 - 0.15 * Math.max(0, Math.sin(t * 31)) * WD.engulf(t)) : 0;
      ctx.anchors.torch.pos.copy(lensP);
      ctx.anchors.torch.dir.copy(d);
    } else torchL.intensity = 0;
    // the family
    const wo = personTrip(t, WOMAN, 0.93, WOMAN_LEG);
    woman.setVisible(wo.vis);
    if (wo.vis) woman.setPose(wo.P);
    const ki = personTrip(t, KID, 0.7, KID_LEG);
    kid.setVisible(ki.vis);
    if (ki.vis) kid.setPose(ki.P);
    const dg = dogPose(t);
    dog.root.visible = dg.vis;
    if (dg.vis) dog.setPose(dg.P);
  });

  ctx.FX.people = { worker, woman, kid, dog };
  return {
    update(t) {
      for (const u of updaters) u(t);
    },
  };
}
