// The people, faceless like ghost mannequins: the worker (fluorescent orange hi-vis
// jacket with silver tape, jeans, work boots, leather gloves, a white hard hat where
// the head would be), the little brother (a blue and white striped T-shirt, khaki
// shorts, trainers, a red cap; an empty can of beans in his hand) and the fluffy
// golden dog. Every pose is a pure function of time.
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

  // ground under a foot: the room floor, the stair treads, the hatch frame, the lawn
  const { STAIR, FLOOR, TOP } = WD;
  function groundAt(x, z, inside) {
    if (inside && z > WD.OUT.zb && z < 0.05 && x > WD.OUT.x0 && x < WD.OUT.x1) {
      if (x < STAIR.x0 - 0.02) return FLOOR;
      if (x <= STAIR.x1 && z > STAIR.zb - 0.05) return WD.stairY(x);
      if (x <= STAIR.x1) return 0;
      return TOP;
    }
    if (x >= STAIR.x1 && x <= WD.OUT.x1 && z > STAIR.zb - 0.1 && z < 0) return TOP;
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
      const armM = spec.shortSleeve ? m.skin : m.sleeve || m.top;
      // torso: a lower part on the pelvis, an upper part on the chest (they overlap at the waist)
      this.torsoLo = add(mesh(S(R.loft(spec.torsoLo)), m.top));
      this.torsoHi = add(mesh(S(R.loft(spec.torsoHi)), m.top));
      this.shCap = [0, 1].map(() => add(mesh(S(new THREE.SphereGeometry(spec.shoulderR, 18, 14)), m.top)));
      this.upper = [0, 1].map(() => add(mesh(S(R.tube(0.3, spec.upperR, 20)), armM)));
      this.fore = [0, 1].map(() => add(mesh(S(R.tube(0.27, spec.foreR, 20)), armM)));
      this.elbow = [0, 1].map(() => add(mesh(S(new THREE.SphereGeometry(spec.foreR[0] * 1.02, 14, 10)), armM)));
      // short sleeves over the upper arms
      if (spec.shortSleeve) this.sleeve = [0, 1].map(() => add(mesh(S(R.loft([[0, spec.upperR[0] * 1.32, spec.upperR[0] * 1.3], [0.07, spec.upperR[1] * 1.42, spec.upperR[1] * 1.36], [0.13, spec.upperR[1] * 1.5, spec.upperR[1] * 1.4]], 20)), m.top)));
      this.hips = add(mesh(S(R.loft(spec.hips)), m.legs));
      this.thigh = [0, 1].map(() => add(mesh(S(R.tube(0.45, spec.thighR, 18)), m.legs)));
      this.shin = [0, 1].map(() => add(mesh(S(R.tube(0.44, spec.shinR, 18)), m.shin || m.legs)));
      this.knee = [0, 1].map(() => add(mesh(S(new THREE.SphereGeometry(spec.shinR[0] * 1.04, 14, 10)), m.shin || m.legs)));
      // shorts: wider legs over the thighs
      if (spec.shorts) this.shortLeg = [0, 1].map(() => add(mesh(S(R.loft([[0, spec.thighR[0] * 1.3, spec.thighR[0] * 1.25], [0.16, spec.thighR[1] * 1.42, spec.thighR[1] * 1.36], [0.3, spec.thighR[2] * 1.55, spec.thighR[2] * 1.45]], 20)), m.legs)));
      // feet: boots or trainers, built round the ankle (+z forward)
      this.foot = [0, 1].map(() => add(mesh(S(makeShoe(spec.shoe)), m.shoe)));
      if (spec.socks) this.sock = [0, 1].map(() => add(mesh(S(R.tube(0.07, [spec.shinR[3] * 1.12, spec.shinR[3] * 1.1], 14)), m.sock)));
      // hands: open, fist and thumbs-up
      this.handO = [0, 1].map((i) => add(mesh(S(makeHand(i, 'open')), m.hand)));
      this.handF = [0, 1].map((i) => add(mesh(S(makeHand(i, 'fist')), m.hand)));
      this.handT = [0, 1].map((i) => add(mesh(S(makeHand(i, 'thumb')), m.hand)));
      // head gear: the hard hat, or the cap
      if (spec.hat) this.hat = add(mesh(S(makeHat()), m.hat));
      if (spec.cap) this.cap = add(mesh(S(makeCap()), m.cap));
      this.headPos = new THREE.Vector3();
      this.qH = new THREE.Quaternion();
    }
    setVisible(v) {
      this.root.visible = v;
    }
    // P: pelvis (V3), yaw, lean, roll, spine {pitch, yaw, roll}, head {pitch, yaw, roll},
    //    feet [{x,y,z,yaw,pitch}], hands [V3|null], fist [false|true|'thumb'], swing (-1..1),
    //    elbowOut, belly (a swell of the tummy, 0 = flat)
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
      const b = P.belly || 0;
      this.torsoLo.scale.set(1 + 0.04 * b, 1, 1 + 0.12 * b);
      this.torsoHi.position.copy(chest);
      this.torsoHi.quaternion.copy(qC);
      this.hips.position.copy(pel);
      this.hips.quaternion.copy(qP);
      const head = chest.clone().add(ax(qC, 0, L.neck, 0.015 * this.s));
      for (const o of [this.hat, this.cap]) if (o) { o.position.copy(head); o.quaternion.copy(qH); }
      this.headPos.copy(head);
      this.qH.copy(qH);
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
        if (this.shortLeg) R.placeSeg(this.shortLeg[i], hip.clone().addScaledVector(knee.clone().sub(hip).normalize(), -0.02 * this.s), knee, fdir, L.thigh * 0.67);
        if (this.sock) R.placeSeg(this.sock[i], end.clone().addScaledVector(knee.clone().sub(end).normalize(), -0.01), end.clone().addScaledVector(knee.clone().sub(end).normalize(), 0.07 * this.s), fdir, 0.07 * this.s);
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
        const eo = Array.isArray(P.elbowOut) ? P.elbowOut[i] : P.elbowOut ?? 0.45;
        const pole = ax(qC, sd * eo, -0.25, -1.0);
        const wrist = R.ik2(sh, target, L.upper, L.fore, pole, elbow);
        R.placeSeg(this.upper[i], sh, elbow, fwdC, L.upper);
        R.placeSeg(this.fore[i], elbow, wrist, fwdC, L.fore);
        if (this.sleeve) R.placeSeg(this.sleeve[i], sh.clone().addScaledVector(elbow.clone().sub(sh).normalize(), -0.03 * this.s), sh.clone().addScaledVector(elbow.clone().sub(sh).normalize(), 0.12 * this.s), fwdC, 0.15 * this.s);
        this.elbow[i].position.copy(elbow);
        // the hand continues the forearm; its palm faces the body's middle (or the
        // hand's own `palm` direction)
        const dir = wrist.clone().sub(elbow).normalize();
        const inward = P.palm?.[i] ? P.palm[i].clone() : ax(qC, -sd, 0, 0);
        const kind = P.fist?.[i] === 'thumb' ? 2 : P.fist?.[i] ? 1 : 0;
        const hs = [this.handO[i], this.handF[i], this.handT[i]];
        hs.forEach((h, k) => (h.visible = k === kind));
        const hh = hs[kind];
        R.placeSeg(hh, wrist, wrist.clone().add(dir), inward, 1);
        hh.scale.set(1, 1, 1);
        this.hand.push({ wrist, dir, elbow, sh, inward });
      }
    }
  }

  // garment pieces --------------------------------------------------------------
  function makeShoe(kind) {
    // around the ankle joint: a shaft, the instep, a rounded toe, the sole
    const gs = [];
    const boot = kind === 'boot';
    const h = boot ? 0.12 : 0.04;
    gs.push(R.loft([[-0.075, 0.058, 0.07, -0.005], [-0.03, 0.06, 0.072], [0.0, 0.056, 0.064], [h, 0.054, 0.058]], 18));
    const toe = new THREE.SphereGeometry(0.058, 18, 12);
    toe.scale(0.95, 0.62, 1.55);
    toe.translate(0, -0.05, 0.085);
    gs.push(toe);
    const heel = new THREE.SphereGeometry(0.052, 16, 10);
    heel.scale(1.0, 0.75, 1.0);
    heel.translate(0, -0.055, -0.04);
    gs.push(heel);
    const sole = new THREE.BoxGeometry(0.105, boot ? 0.028 : 0.032, 0.285);
    sole.translate(0, -0.083, 0.035);
    gs.push(sole);
    return G.mergeAll(gs);
  }
  // a hand along +y from the wrist, palm facing +z; the thumb on the side that ends up
  // forward when the arm hangs (hand 0 is the left hand)
  function makeHand(i, kind) {
    const gs = [];
    const ts = i === 0 ? -1 : 1; // the thumb's side (local x)
    const palm = new THREE.BoxGeometry(0.082, 0.095, 0.032, 2, 2, 2);
    palm.translate(0, 0.05, 0);
    gs.push(palm);
    if (kind === 'open') {
      const fing = new THREE.CapsuleGeometry(0.016, 0.06, 4, 8);
      for (let k = 0; k < 4; k++) {
        const f = fing.clone();
        f.rotateX(0.25);
        f.translate((k - 1.5) * 0.02 * -ts, 0.135 - Math.abs(k - 1.5) * 0.008, 0.008);
        gs.push(f);
      }
    } else {
      // the fingers curled into the palm
      const fg = new THREE.CapsuleGeometry(0.022, 0.06, 4, 8);
      fg.rotateZ(Math.PI / 2);
      fg.translate(0, 0.098, 0.022);
      gs.push(fg);
    }
    const th = new THREE.CapsuleGeometry(0.015, 0.045, 4, 8);
    if (kind === 'thumb') {
      // straight out sideways: up, when the fist is held forward
      th.rotateZ(Math.PI / 2);
      th.translate(ts * 0.072, 0.085, 0.012);
    } else {
      th.rotateZ(ts * 0.7);
      th.translate(ts * 0.045, 0.06, 0.018);
    }
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
  function makeCap() {
    // a baseball cap: six-panel crown with a button, a curved peak in front
    const gs = [];
    const crown = new THREE.SphereGeometry(0.106, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    crown.scale(1.0, 0.86, 1.1);
    crown.translate(0, 0.012, -0.004);
    gs.push(crown);
    gs.push(G.placed(new THREE.SphereGeometry(0.011, 8, 6), 0, 0.012 + 0.106 * 0.86, -0.004));
    gs.push(G.placed(new THREE.TorusGeometry(0.106, 0.006, 6, 30), 0, 0.014, -0.004, Math.PI / 2, 0, 0, 1, 1.1, 1));
    const peak = new THREE.CylinderGeometry(0.104, 0.104, 0.007, 26, 1, false, -Math.PI * 0.5, Math.PI);
    peak.scale(0.98, 1, 1.72);
    peak.rotateX(0.14);
    peak.translate(0, 0.008, 0.0);
    gs.push(peak);
    return G.mergeAll(gs);
  }

  // materials ---------------------------------------------------------------------
  function stripeMat(key, period) {
    // cotton jersey in blue and white stripes (object space, period = one blue + one white)
    return R.cloth(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), {
      key, colorFn: key + 'C', bumpFn: key + 'B',
      extra: `vec3 ${key}C(vec3 p){
          float q = p.y / ${period.toFixed(4)};
          float tri = abs(fract(q) - 0.5) * 2.0;
          float w = max(fwidth(q) * 2.0, 0.02);
          float st = mix(0.5, smoothstep(0.5 - w, 0.5 + w, tri), oaa(${(2 / period).toFixed(1)}));
          vec3 c = mix(vec3(0.84, 0.83, 0.8), vec3(0.025, 0.075, 0.36), st);
          return c * (0.92 + 0.1 * chn(p * 14.0) + 0.04 * chn(vec3(p.x * 9.0, p.y * 40.0, p.z * 9.0))); }
        float ${key}B(vec3 p){ return 0.0008 * chn(p * 180.0) * oaa(180.0) + 0.0022 * chn(vec3(p.x * 12.0, p.y * 30.0, p.z * 12.0)); }`,
    });
  }
  const KS = 0.7; // the little brother's scale
  const M = {
    worker: {
      top: R.pufferMat('jacket', '#ff5a0a', [[0.29, 0.335], [-0.02, 0.025]]),
      sleeve: R.pufferMat('sleeve', '#ff5a0a', [[0.15, 0.19]], 0.07),
      legs: R.denimMat('jeans'),
      shoe: R.leatherMat('boots', '#4a3221', 0.6),
      hand: R.leatherMat('gloves', '#b88a5a', 0.7),
      hat: R.hatMat(),
    },
    kid: {
      top: stripeMat('tee', 0.12 * KS * 0.5),
      skin: R.skinMat('skinK', '#d29d78'),
      legs: R.cottonMat('shorts', '#b39a6b', 0.88),
      shin: R.skinMat('skinK2', '#d29d78'),
      sock: R.cottonMat('sockK', '#f1efe8', 0.9),
      shoe: R.leatherMat('trainersK', '#e9e7e1', 0.5),
      hand: R.skinMat('skinK3', '#d29d78'),
      cap: R.cottonMat('capK', '#c42b2b', 0.75),
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
  // the little brother: a round tummy full of beans under the T-shirt
  const teeLo = [[-0.15, 0.188, 0.14], [-0.1, 0.196, 0.152, 0.012], [-0.02, 0.2, 0.168, 0.026], [0.06, 0.196, 0.162, 0.022], [0.13, 0.186, 0.144, 0.01], [0.18, 0.18, 0.13]];
  const teeHi = [[-0.07, 0.184, 0.136, 0.01], [0.05, 0.184, 0.132], [0.18, 0.192, 0.134], [0.3, 0.2, 0.138], [0.38, 0.2, 0.134], [0.44, 0.19, 0.122],
    [0.48, 0.152, 0.104], [0.505, 0.098, 0.082, 0.004], [0.52, 0.066, 0.064, 0.006], [0.535, 0.062, 0.06, 0.006]];
  const kid = new Person({
    scale: KS, mats: M.kid, cap: true, shortSleeve: true, shorts: true, socks: true,
    torsoLo: teeLo, torsoHi: teeHi, shoulderR: 0.074,
    upperR: [0.054, 0.05, 0.046, 0.043], foreR: [0.042, 0.04, 0.036, 0.034],
    hips: [[-0.17, 0.12, 0.1], [-0.12, 0.17, 0.122], [-0.04, 0.182, 0.13], [0.06, 0.18, 0.126], [0.14, 0.176, 0.122]],
    thighR: [0.078, 0.07, 0.06, 0.052], shinR: [0.05, 0.046, 0.04, 0.036], shoe: 'trainer',
  });

  // -------------------------------------------------------------------------
  // the dog: a fluffy golden retriever, faceless; a deep chest with a ruff, a neck
  // and a head with floppy ears, four two-part legs (IK to the paws), a plumed tail
  // -------------------------------------------------------------------------
  class Dog {
    constructor() {
      this.root = new THREE.Group();
      scene.add(this.root);
      const fur = R.furMat('fur', '#d6a258');
      const furD = R.furMat('furD', '#b98140');
      const furL = R.furMat('furL', '#e6bd78');
      const add = (o) => (this.root.add(o), o);
      // the trunk: a loft along y, turned to run along z (rump at -z, chest at +z)
      const bg = R.loft([[-0.38, 0.02, 0.02], [-0.36, 0.1, 0.11], [-0.3, 0.15, 0.16], [-0.16, 0.145, 0.16], [0.0, 0.14, 0.165], [0.14, 0.155, 0.18], [0.25, 0.152, 0.175], [0.32, 0.11, 0.13], [0.35, 0.02, 0.02]], 26,
        (a, y) => 0.035 * Math.sin(a * 9 + y * 30) * Math.max(0, -Math.cos(a)) + 0.02 * Math.sin(a * 13 + y * 47));
      bg.rotateX(Math.PI / 2);
      this.body = add(mesh(bg, fur));
      // the chest ruff and the feathering under the belly
      const ruff = mesh(G.lumpyBlob(0.12, 2, 0.12, 21), furL);
      ruff.scale.set(1.05, 1.15, 0.85);
      this.ruff = add(ruff);
      this.neck = add(mesh(R.tube(0.2, [0.095, 0.085, 0.072], 16), fur));
      const head = new THREE.Group();
      const skull = mesh(new THREE.SphereGeometry(0.1, 20, 14), fur);
      skull.scale.set(1.0, 0.92, 1.05);
      const muzzle = mesh(R.tube(0.13, [0.058, 0.052, 0.044], 14, true), furL);
      muzzle.rotation.x = Math.PI / 2 + 0.12;
      muzzle.position.set(0, -0.035, 0.05);
      head.add(skull, muzzle);
      this.ears = [-1, 1].map((s) => {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.075, 0.03, -0.01);
        const ear = mesh(new THREE.SphereGeometry(0.065, 12, 8), furD);
        ear.scale.set(0.32, 1.05, 0.78);
        ear.position.set(s * 0.012, -0.06, 0);
        pivot.add(ear);
        head.add(pivot);
        return { pivot, s };
      });
      this.head = add(head);
      this.legU = [0, 1, 2, 3].map((i) => add(mesh(R.tube(0.2, i < 2 ? [0.055, 0.046, 0.036] : [0.065, 0.052, 0.036], 12), fur)));
      this.legL = [0, 1, 2, 3].map(() => add(mesh(R.tube(0.2, [0.034, 0.03, 0.028], 12), fur)));
      this.paw = [0, 1, 2, 3].map(() => add(mesh(new THREE.SphereGeometry(0.034, 10, 8).scale(1, 0.6, 1.35), furL)));
      // the plume: a thick feathered tail
      this.tail = add(mesh(R.loft([[0, 0.034, 0.034], [0.08, 0.05, 0.04], [0.18, 0.06, 0.042], [0.28, 0.052, 0.036], [0.36, 0.03, 0.022], [0.4, 0.004, 0.004]], 14,
        (a, y) => 0.12 * Math.sin(a * 7 + y * 40)), furL));
      this.collar = add(mesh(new THREE.TorusGeometry(0.085, 0.012, 8, 20), new THREE.MeshStandardMaterial({ color: new THREE.Color('#b0221c'), roughness: 0.5 })));
    }
    // P: x, y, z (centre of the trunk), yaw, pitch (nose down +), roll,
    //    paws [4] {x, y, z} (0 FL, 1 FR, 2 HL, 3 HR), headPitch, headYaw, headRoll, wag,
    //    tail (0 down/tucked .. 1 up), ears (0 floppy .. 1 flat back), breath
    setPose(P) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(P.pitch || 0, P.yaw, P.roll || 0, 'YXZ'));
      const ax = (x, y, z) => V(x, y, z).applyQuaternion(q);
      const c = V(P.x, P.y, P.z);
      this.body.position.copy(c);
      this.body.quaternion.copy(q);
      const br = 1 + 0.025 * (P.breath || 0);
      this.body.scale.set(br, br, 1);
      this.ruff.position.copy(c).add(ax(0, -0.01, 0.25));
      this.ruff.quaternion.copy(q);
      const fwd = ax(0, 0, 1);
      const nb = c.clone().add(ax(0, 0.06, 0.25));
      const hp = nb.clone().add(ax(0, 0.15, 0.1));
      R.placeSeg(this.neck, nb, hp, fwd, 0.2);
      this.head.position.copy(hp).add(ax(0, 0.03, 0.05));
      this.head.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(P.headPitch || 0, P.headYaw || 0, P.headRoll || 0, 'YXZ')));
      const ea = P.ears || 0;
      for (const e of this.ears) e.pivot.rotation.set(-0.55 * ea + (P.earFlap || 0) * Math.sin(e.s * 2 + (P.earPh || 0)), 0, e.s * (0.22 + 0.5 * ea));
      this.collar.position.copy(nb.clone().lerp(hp, 0.5));
      this.collar.quaternion.copy(this.neck.quaternion);
      this.collar.rotateX(Math.PI / 2);
      const roots = [[0.075, -0.05, 0.2], [-0.075, -0.05, 0.2], [0.085, -0.03, -0.26], [-0.085, -0.03, -0.26]];
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
      const tb = c.clone().add(ax(0, 0.07, -0.34));
      const up = P.tail ?? 0.7;
      let tdir = ax(Math.sin(P.wag || 0) * 0.55, lerp(-0.85, 0.65, up), lerp(-0.25, -0.7, up)).normalize();
      if (P.tailWorld) tdir = P.tailWorld.clone().add(V(Math.sin(P.wag || 0) * 0.35, 0, 0)).normalize();
      R.placeSeg(this.tail, tb, tb.clone().addScaledVector(tdir, 0.4), UPV, 0.4);
    }
  }
  const dog = new Dog();

  // -------------------------------------------------------------------------
  // props: the shovel, the kid's can, the gas mask
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
  const kidCan = ctx.makeBeanCan();
  scene.add(kidCan);
  kidCan.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // the gas mask: a black rubber face piece, two round eye lenses in steel rims, a
  // screw-on filter canister at the front, a strap harness; built facing +z, its origin
  // where the face would be
  const mask = new THREE.Group();
  {
    const rubber = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1c1e1d'), roughness: 0.6 });
    const rim = new THREE.MeshStandardMaterial({ color: new THREE.Color('#9aa0a3'), roughness: 0.3, metalness: 0.9, envMap });
    const glass = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#2a3a3c'), roughness: 0.05, metalness: 0.1, clearcoat: 1, envMap });
    const can = new THREE.MeshStandardMaterial({ color: new THREE.Color('#5b6142'), roughness: 0.55, metalness: 0.35 });
    envMats.push(rim, glass);
    const face = new THREE.SphereGeometry(0.1, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.56);
    face.rotateX(Math.PI / 2);
    face.scale(0.86, 1.08, 0.78);
    mask.add(mesh(face, new THREE.MeshStandardMaterial({ color: new THREE.Color('#1c1e1d'), roughness: 0.6, side: THREE.DoubleSide })));
    for (const s of [-1, 1]) {
      mask.add(mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 22).translate(s * 0.042, 0.028, 0.074), rim));
      mask.add(mesh(new THREE.CircleGeometry(0.03, 22).translate(s * 0.042, 0.028, 0.076), glass));
    }
    // the canister and its threaded collar, pointing forward and down
    const cg = new THREE.Group();
    cg.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 18), rubber));
    cg.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 22).translate(0, 0.04, 0), can));
    for (const y of [0.018, 0.03, 0.042, 0.054, 0.066]) cg.add(mesh(new THREE.TorusGeometry(0.045, 0.0025, 4, 22).rotateX(Math.PI / 2).translate(0, y, 0), can));
    cg.rotation.x = Math.PI / 2 + 0.45;
    cg.position.set(0, -0.045, 0.07);
    mask.add(cg);
    // the harness: straps round the back of the head
    const strap = new THREE.TorusGeometry(0.105, 0.007, 6, 30, Math.PI * 1.15);
    strap.rotateY(Math.PI / 2 + Math.PI * 0.075);
    strap.rotateZ(Math.PI / 2);
    strap.scale(1, 1, 1.1);
    for (const [y, rx] of [[0.03, 0.15], [-0.03, -0.35]]) {
      const g = strap.clone();
      g.rotateX(rx);
      g.translate(0, y, -0.03);
      mask.add(mesh(g, rubber));
    }
    scene.add(mask);
  }

  // -------------------------------------------------------------------------
  // locomotion helpers
  // -------------------------------------------------------------------------
  const STAND_W = 0.11;
  function stance(x, z, yaw, inside, w = STAND_W, s = 1) {
    const sx = Math.cos(yaw), sz = -Math.sin(yaw);
    const f = (sd) => {
      const fx = x + sx * sd * w * s, fz = z + sz * sd * w * s;
      return { x: fx, z: fz, y: groundAt(fx, fz, inside), yaw, pitch: 0 };
    };
    return [f(1), f(-1)];
  }
  function easeTravel(u, a) {
    const v = 1 / (1 - a);
    if (u < a) return (v * u * u) / (2 * a);
    if (u > 1 - a) return 1 - (v * (1 - u) * (1 - u)) / (2 * a);
    return (v * a) / 2 + v * (u - a);
  }
  function travel(t, t0, t1, pts, { stride = 1.3, inside = false, width = STAND_W, s = 1, ease = 0.18, easeIn = true, easeOut = true, lift = 0.11 } = {}) {
    const path = R.pathOf(pts);
    const u = clamp((t - t0) / (t1 - t0));
    let e = u;
    if (ease > 0) {
      if (easeIn && easeOut) e = easeTravel(u, ease);
      else if (easeIn) e = u < ease ? (u * u) / (2 * ease) / (1 - ease / 2) : (u - ease / 2) / (1 - ease / 2);
      else if (easeOut) e = u > 1 - ease ? 1 - ((1 - u) * (1 - u)) / (2 * ease) / (1 - ease / 2) : u / (1 - ease / 2);
    }
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
  const qYaw = (yaw) => new THREE.Quaternion().setFromAxisAngle(UPV, yaw);
  const blank = () => ({ pelvis: V(0, 0, 0), yaw: 0, lean: 0, spine: { pitch: 0.03, yaw: 0, roll: 0 }, head: { pitch: 0, yaw: 0, roll: 0 }, feet: null, hands: [null, null], fist: [false, false], swing: 0 });
  const walkTo = (P, tr, leg, bob = 0.025) => {
    P.feet = tr.feet;
    P.yaw = tr.yaw;
    P.pelvis = V(tr.x, pelvisY(tr.feet, leg, bob * Math.abs(Math.sin(tr.phase))), tr.z);
    P.swing = Math.sin(tr.phase);
    return P;
  };
  // a point in a body frame (x left, y up, z forward) at `o` turned by yaw
  const local = (o, yaw, x, y, z) => o.clone().add(V(x, y, z).applyQuaternion(qYaw(yaw)));

  ctx.anchors.shovelBlade = new THREE.Vector3();

  // -------------------------------------------------------------------------
  // the worker
  // -------------------------------------------------------------------------
  const LEG = 0.96;
  const W0 = { x: 3.3, z: -1.0 };
  const YAW_PORCH = Math.atan2(WD.KID.x - W0.x, WD.KID.z - W0.z);
  const SHOVEL0 = { tip: V(3.92, -0.2, -0.72), top: V(3.99, 0.92, -0.8) }; // stuck in the lawn
  const SHOVEL_LAWN = { tip: V(-2.25, 0.035, -3.35), top: V(-1.15, 0.05, -3.05) }; // tossed out of the pit
  const XC = -0.95; // where he climbs out, up the back wall of the pit
  const BEHIND = { x: XC, z: -2.95 }; // and stands, watching the shelter go in
  const R0 = { x: 0.45, z: -1.2 }; // his spot in the room
  const SW = { x: WD.SWITCH.x + 0.12, z: -1.66 }; // in front of the fan switch
  const SEAT = WD.SEAT_W;
  const seatZ = WD.BENCH.z0 + 0.24;
  function sitPose(P, x, s, leg = LEG) {
    // on the bench: pelvis over the seat, thighs forward, feet on the floor
    P.pelvis = V(x, WD.BENCH.seat + 0.09 * s, seatZ);
    P.yaw = 0;
    P.lean = -0.08;
    const fy = Math.max(FLOOR, WD.BENCH.seat - 0.47 * s - 0.04);
    P.feet = [{ x: x + 0.13 * s, y: fy, z: seatZ + 0.44 * s, yaw: 0.12 }, { x: x - 0.13 * s, y: fy, z: seatZ + 0.44 * s, yaw: -0.12 }];
    return P;
  }
  // the gas mask's place: on its hook, carried, on the face
  const maskOnFace = () => worker.headPos.clone().add(V(0, -0.075, 0.105).applyQuaternion(worker.qH));
  const HOOKP = V(WD.HOOK.x, WD.HOOK.y - 0.11, WD.HOOK.z + 0.085);
  const END = ctx.DURATION;

  function workerPose(t) {
    const P = blank();
    let shovelState = { mode: 'lawn' };
    let maskState = { mode: 'hook' };
    const breathe = 0.008 * Math.sin(t * 1.9);
    if (t < T.dig0) {
      // scene 1: on the lawn; turns to the porch at the rumble; jumps back in fear;
      // spins round, grabs the shovel, takes it to the dig
      shovelState = { mode: 'ground' };
      let yaw = angLerp(0.55, YAW_PORCH, smooth01(t, 1.15, 0.6));
      yaw = angLerp(yaw, 1.6, smooth01(t, T.fear + 0.62, 0.35));
      yaw = angLerp(yaw, -1.2, smooth01(t, T.grab + 0.75, 0.6));
      const jump = smooth01(t, T.fear, 0.16);
      const toShovel = smooth01(t, T.fear + 0.7, 0.45), toDig = smooth01(t, T.grab + 0.65, 0.75);
      let px = W0.x, pz = W0.z + 0.42 * jump;
      px = lerp(px, 3.5, toShovel);
      pz = lerp(pz, -0.66, toShovel);
      px = lerp(px, WD.digX(T.dig0), toDig);
      pz = lerp(pz, -1.3, toDig);
      P.feet = stance(px, pz, yaw, false);
      // little steps while turning and moving
      const sh = Math.max(bump(t, 1.15, 1.75, 0.15), bump(t, T.fear, T.fear + 0.25, 0.06), bump(t, T.fear + 0.62, T.fear + 1.15, 0.12), bump(t, T.grab + 0.65, T.grab + 1.45, 0.15));
      P.feet[0].y += 0.06 * sh * Math.max(0, Math.sin(t * 16));
      P.feet[1].y += 0.06 * sh * Math.max(0, Math.sin(t * 16 + 3));
      const hop = Math.sin(Math.PI * prog(t, T.fear, 0.16)) * 0.08;
      const crouch = bump(t, T.fear + 0.1, T.fear + 0.75, 0.08);
      P.pelvis = V(px, LEG + breathe + hop - 0.07 * crouch, pz);
      P.yaw = yaw;
      // hands on the hips at first; up in fright; then for the shovel
      const hips = 1 - smooth01(t, 1.2, 0.3);
      if (hips > 0.01) {
        P.hands = [local(P.pelvis, yaw, 0.24, 0.1, 0.02), local(P.pelvis, yaw, -0.24, 0.1, 0.02)].map((h, i) => h.lerp(local(P.pelvis, yaw, i ? -0.2 : 0.2, -0.12, 0.04), 1 - hips));
        P.elbowOut = 1.2 * hips + 0.45;
      }
      // looks up the yard at the porch: leans in, peering
      const peer = smooth01(t, 1.6, 0.6) * (1 - jump);
      P.spine.pitch = 0.03 + 0.08 * peer;
      P.head.pitch = -0.08 * peer;
      // fright: arms up, palms out, leaning back
      const fright = bump(t, T.fear, T.fear + 0.95, 0.08);
      if (fright > 0.01) {
        const shk = 0.015 * Math.sin(t * 47);
        P.hands = [local(P.pelvis, yaw, 0.3, 0.68 + shk, 0.3), local(P.pelvis, yaw, -0.3, 0.7 - shk, 0.3)].map((h, i) => local(P.pelvis, yaw, i ? -0.2 : 0.2, -0.12, 0.04).lerp(h, fright));
        P.palm = [V(0, 0, 1).applyQuaternion(qYaw(yaw)), V(0, 0, 1).applyQuaternion(qYaw(yaw))];
        P.lean = -0.16 * fright;
        P.head.pitch = -0.15 * fright;
        P.elbowOut = 0.9;
      }
      // grabs the shovel (right hand), pulls it out, carries it across the body
      const grab = smooth01(t, T.grab - 0.15, 0.18), pull = smooth01(t, T.grab + 0.05, 0.3), ready = smooth01(t, T.grab + 0.35, 0.35);
      if (t > T.grab - 0.25) {
        const tip = SHOVEL0.tip.clone().lerp(V(px + 0.3, 0.1, pz + 0.25), pull);
        const top = SHOVEL0.top.clone().lerp(V(px + 0.45, 1.2, pz + 0.1), pull);
        tip.lerp(local(V(px, 0, pz), yaw, -0.12, 0.35, 0.55), ready);
        top.lerp(local(V(px, 0, pz), yaw, 0.12, 1.08, 0.3), ready);
        shovelState = { mode: 'held', tip, top };
        const handTop = top.clone().lerp(tip, 0.06);
        P.hands[1] = local(P.pelvis, yaw, -0.2, -0.12, 0.04).lerp(handTop, grab);
        if (ready > 0) P.hands[0] = local(P.pelvis, yaw, 0.2, -0.12, 0.04).lerp(top.clone().lerp(tip, 0.45), ready);
        P.fist = [ready > 0.5, grab > 0.5];
        P.palm = null;
        P.elbowOut = 0.45;
      }
    } else if (t < T.climbOut) {
      // scene 2: digging super fast, down in the pit, moving left with the face
      const pit = WD.pit(t);
      const x = WD.digX(t), z = -1.3;
      const fy = -pit.d;
      const yaw = -1.2 + 0.2 * Math.sin(t * 2.3);
      let i = WD.DIG_T.findIndex((s) => s > t);
      if (i < 0) i = WD.DIG_T.length;
      const prevT = i > 0 ? WD.DIG_T[i - 1] : T.dig0 - 0.15;
      const nextT = i < WD.DIG_T.length ? WD.DIG_T[i] : prevT + 0.2;
      const ph = clamp((t - prevT) / Math.max(0.05, nextT - prevT)); // 0 just thrown ... 1 next lift
      const q = qYaw(yaw);
      const loc = (a, b, c) => V(x, fy, z).add(V(a, b, c).applyQuaternion(q));
      // blade: high over the right shoulder (0) -> down into the soil in front -> lever up (1)
      const down = smooth(clamp((ph - 0.08) / 0.45)), lift = smooth(clamp((ph - 0.78) / 0.22));
      let tip = loc(-0.55, 1.35, -0.25).lerp(loc(0.05, 0.02, 0.62), down).lerp(loc(0.0, 0.3, 0.5), lift);
      let top = loc(0.15, 1.1, 0.35).lerp(loc(-0.05, 0.95, 0.05), down).lerp(loc(-0.05, 0.75, -0.05), lift);
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
    } else if (t < T.walkIn0) {
      // tosses the shovel out, leaps for the back edge of the pit, pulls himself up and
      // out onto the lawn behind it; watches the shelter go in; the test puff drifts by
      const PF = WD.FLOOR_B; // the floor of the pit
      const x0 = WD.digX(T.climbOut);
      const toss = prog(t, T.climbOut, 0.5);
      const e = easeOutCubic(toss), arc = Math.sin(toss * Math.PI) * 1.6;
      shovelState = { mode: 'held', tip: V(x0 + 0.3, PF + 1.05, -1.2).lerp(SHOVEL_LAWN.tip, e).add(V(0, arc, 0)), top: V(x0 + 0.4, PF + 2.15, -1.4).lerp(SHOVEL_LAWN.top, e).add(V(0, arc, 0)) };
      if (toss >= 1) shovelState = { mode: 'lawn' };
      const turn = smooth01(t, T.climbOut, 0.12);
      const leap = prog(t, T.climbOut + 0.1, 0.2), pull = prog(t, T.climbOut + 0.3, 0.24), stand = prog(t, T.climbOut + 0.54, 0.24);
      const xs = lerp(x0, XC, smooth(prog(t, T.climbOut, 0.3)));
      if (stand <= 0) {
        // down in the pit -> hanging on the edge -> up over it
        const yawW = angLerp(-1.2, Math.PI, turn);
        const pA = V(xs, PF + LEG, -1.75);
        const pB = V(xs, -0.88, -2.08);
        const pC = V(xs, 0.3, -2.62);
        const el = easeOutCubic(leap), pl = smooth(pull);
        const pel = pA.clone().lerp(pB, el).lerp(pC, pl);
        P.pelvis = pel;
        P.yaw = yawW;
        P.lean = 0.15 + 0.45 * pl;
        const hy = 0.03;
        P.hands = [V(xs - 0.24, lerp(pel.y + 0.95, hy, smooth(prog(t, T.climbOut + 0.06, 0.18))), -2.43), V(xs + 0.24, lerp(pel.y + 0.95, hy, smooth(prog(t, T.climbOut + 0.06, 0.18))), -2.43)];
        if (pl > 0.4) P.hands = [V(xs - 0.25, 0.02, -2.6), V(xs + 0.25, 0.02, -2.6)];
        P.fist = [false, false];
        P.elbowOut = 1.0;
        // legs: dangling, then one knee up onto the lawn
        const dang = el * (1 - pl);
        P.feet = [
          { x: xs - 0.12, y: lerp(lerp(PF, pel.y - 0.95, dang), 0.0, pl), z: lerp(-1.75, -2.55, pl), yaw: yawW, pitch: 0.6 * dang },
          { x: xs + 0.12, y: lerp(lerp(PF, pel.y - 0.9, dang), 0.15 * pl, pl), z: lerp(-1.75, -2.2, pl), yaw: yawW, pitch: 0.8 * dang },
        ];
        P.feet.forEach((f) => (f.y = Math.max(f.y, PF)));
        P.head.pitch = -0.4 * (1 - pl);
      } else {
        // up on the lawn behind the pit; turns round to watch
        const yaw = angLerp(Math.PI, 0.12, smooth01(t, T.climbOut + 0.72, 0.4));
        const pz = lerp(-2.62, BEHIND.z, smooth(stand));
        P.feet = stance(XC, pz, yaw, false);
        P.pelvis = V(XC, lerp(0.3 + 0.55, LEG, smooth(stand)) + breathe, pz);
        P.yaw = yaw;
        P.lean = 0.3 * (1 - smooth(stand));
        const sh = bump(t, T.climbOut + 0.72, T.climbOut + 1.2, 0.1);
        P.feet[0].y += 0.05 * sh * Math.max(0, Math.sin(t * 16));
        P.feet[1].y += 0.05 * sh * Math.max(0, Math.sin(t * 16 + 3));
        // brushes off his hands
        const brush = bump(t, T.climbOut + 1.3, T.climbOut + 2.0, 0.12);
        if (brush > 0.01) {
          const c = local(P.pelvis, yaw, 0, 0.22, 0.32);
          P.hands = [c.clone().add(V(0.05 + 0.04 * Math.sin(t * 30), 0, 0)), c.clone().add(V(-0.05 - 0.04 * Math.sin(t * 30), 0.02, 0))].map((h, i) => local(P.pelvis, yaw, i ? -0.2 : 0.2, -0.12, 0.04).lerp(h, brush));
        }
        // the gas drifts past in front of him: he leans away, pinches his nose, waves it off
        const pu = bump(t, T.labelHeavy - 0.25, T.sink0 + 0.55, 0.22);
        if (pu > 0.01) {
          P.lean = -0.14 * pu;
          P.spine.yaw = 0.25 * pu;
          P.head.yaw = 0.5 * pu;
          P.hands[0] = local(P.pelvis, yaw, 0.2, -0.12, 0.04).lerp(local(V(XC, 0, pz), yaw, 0.02, 1.56, 0.13), pu);
          P.hands[1] = local(P.pelvis, yaw, -0.2, -0.12, 0.04).lerp(local(V(XC, 0, pz), yaw, -0.35 + 0.12 * Math.sin(t * 19), 1.25 + 0.08 * Math.sin(t * 19 + 1), 0.35), pu);
          P.fist = [pu > 0.5, false];
          P.elbowOut = [0.9, 0.6];
        }
        P.head.pitch = 0.12 * bump(t, T.climbOut + 0.8, T.labelHeavy - 0.3, 0.3);
      }
    } else if (t < T.walkIn0 + 1.25) {
      // runs to the stairwell
      const tr = travel(t, T.walkIn0, T.walkIn0 + 1.25, [[BEHIND.x, BEHIND.z], [2.85, -1.75], [3.98, -0.95], [3.56, -0.62]], { stride: 1.65, ease: 0.18, easeOut: false, lift: 0.17 });
      walkTo(P, tr, LEG * 0.97, 0.05);
      P.lean = 0.2;
      P.spine.pitch = 0.08;
      P.swing = 1.5 * Math.sin(tr.phase);
      P.elbowOut = 0.3;
    } else if (t < T.walkIn0 + 2.2) {
      // down the stairs two at a time
      const tr = travel(t, T.walkIn0 + 1.25, T.walkIn0 + 2.2, [[3.56, -0.62], [1.62, -0.62]], { stride: 1.0, inside: true, ease: 0.1, easeIn: false, easeOut: false, lift: 0.16 });
      walkTo(P, tr, LEG, 0.03);
      P.lean = 0.1;
      P.swing *= 0.9;
      // a hand on the shared wall going down
      if (tr.x < 3.2) P.hands[1] = V(tr.x - 0.15, P.pelvis.y + 0.1, -1.18);
    } else if (t < T.walkIn0 + 2.95) {
      const tr = travel(t, T.walkIn0 + 2.2, T.walkIn0 + 2.95, [[1.62, -0.62], [1.05, -0.88], [R0.x, R0.z]], { stride: 1.2, inside: true, ease: 0.3, easeIn: false });
      walkTo(P, tr, LEG);
    } else if (t < 33.25) {
      // scenes 3 - 5 in the room: catches his breath; watches the door; stuffy (wipes his
      // brow, fans himself, tugs his collar); looks up at the pipe; a deep breath of the
      // clean air; the filter; hands on his hips
      const t0 = T.walkIn0 + 2.95;
      let yaw = angLerp(Math.atan2(R0.x - 1.05, R0.z + 0.88), 0.05, smooth01(t, t0, 0.35));
      P.feet = stance(R0.x, R0.z, yaw, true);
      P.pelvis = V(R0.x, FLOOR + LEG + breathe, R0.z);
      P.yaw = yaw;
      const p0 = V(R0.x, FLOOR, R0.z);
      const restL = local(P.pelvis, yaw, 0.2, -0.12, 0.04), restR = local(P.pelvis, yaw, -0.2, -0.12, 0.04);
      // hands on his knees, panting
      const knees = bump(t, t0 + 0.1, t0 + 1.25, 0.25);
      if (knees > 0.01) {
        P.lean = 0.35 * knees;
        P.spine.pitch = 0.03 + 0.3 * knees + 0.03 * Math.sin(t * 9) * knees;
        P.pelvis.y -= 0.12 * knees;
        P.pelvis.z -= 0.08 * knees;
        P.hands = [restL.clone().lerp(local(p0, yaw, 0.15, 0.55, 0.22), knees), restR.clone().lerp(local(p0, yaw, -0.15, 0.55, 0.22), knees)];
      }
      // turns his head to the stairs while the gas presses on the door
      const door = bump(t, T.press0 - 0.1, T.press1 - 0.1, 0.4);
      P.head.yaw = 0.55 * door;
      P.head.pitch = -0.3 * door;
      // stuffy
      const wipe = bump(t, T.stuffy0 + 0.15, T.stuffy0 + 1.15, 0.18), fan = bump(t, T.stuffy0 + 1.0, T.stuffy0 + 1.95, 0.15), tug = bump(t, T.stuffy0 + 1.85, T.stuffy0 + 2.5, 0.12);
      if (wipe > 0.01) P.hands[1] = restR.clone().lerp(local(p0, yaw, -0.06 + 0.12 * Math.sin(t * 8), 1.74, 0.13), wipe);
      if (fan > 0.01) P.hands[0] = restL.clone().lerp(local(p0, yaw, 0.12 + 0.03 * Math.sin(t * 24), 1.55 + 0.05 * Math.sin(t * 24 + 1), 0.3), fan);
      if (tug > 0.01) {
        P.hands = [restL.clone().lerp(local(p0, yaw, 0.06, 1.48, 0.15 + 0.03 * Math.sin(t * 14)), tug), restR.clone().lerp(local(p0, yaw, -0.06, 1.48, 0.15 + 0.03 * Math.sin(t * 14)), tug)];
        P.fist = [true, true];
      }
      P.spine.pitch += 0.06 * bump(t, T.stuffy0, T.pipe0, 0.4) * (0.6 + 0.4 * Math.sin(t * 3.1));
      // looks up at the pipe coming through the roof (on his right)
      const look = bump(t, T.pipe0 - 0.05, T.air0 - 0.1, 0.35);
      P.head.yaw += -0.55 * look;
      P.head.pitch += -0.5 * look;
      // the clean air: a big deep breath, arms opening
      const air = bump(t, T.air0 + 0.2, T.air1 - 0.2, 0.45);
      if (air > 0.01) {
        P.spine.pitch -= 0.14 * air;
        P.head.pitch -= 0.22 * air;
        P.hands = [restL.clone().lerp(local(P.pelvis, yaw, 0.42, 0.05, 0.12), air), restR.clone().lerp(local(P.pelvis, yaw, -0.42, 0.05, 0.12), air)];
        P.pelvis.y += 0.015 * air;
      }
      // the filter: looks up at it, nods
      const fl = bump(t, T.filter - 0.1, T.cutOpen + 0.4, 0.3);
      P.head.yaw += -0.5 * fl;
      P.head.pitch += -0.35 * fl + 0.12 * bump(t, T.labelCarbon + 0.2, T.labelCarbon + 0.55, 0.12);
      // hands on his hips
      const hips = smooth01(t, T.cutOpen + 0.3, 0.4);
      if (hips > 0.01 && air < 0.01) {
        P.hands = [restL.clone().lerp(local(P.pelvis, yaw, 0.24, 0.1, 0.02), hips), restR.clone().lerp(local(P.pelvis, yaw, -0.24, 0.1, 0.02), hips)];
        P.elbowOut = 0.45 + 0.75 * hips;
      }
    } else if (t < T.fanOn + 0.35) {
      // to the switch, flips the fan on
      if (t < 33.95) {
        walkTo(P, travel(t, 33.25, 33.95, [[R0.x, R0.z], [SW.x, SW.z]], { stride: 1.0, inside: true, ease: 0.3 }), LEG);
        P.yaw = angLerp(P.yaw, Math.PI, smooth01(t, 33.65, 0.3));
      } else {
        const yaw = Math.PI;
        P.feet = stance(SW.x, SW.z, yaw, true);
        P.pelvis = V(SW.x, FLOOR + LEG + breathe, SW.z);
        P.yaw = yaw;
        P.lean = 0.12;
        const reach = bump(t, 33.9, T.fanOn + 0.3, 0.15);
        const flick = smooth01(t, T.fanOn - 0.05, 0.1);
        const S = WD.SWITCH;
        P.hands[0] = local(P.pelvis, yaw, 0.2, -0.12, 0.04).lerp(V(S.x, S.y + 0.05 - 0.07 * flick, S.z + 0.075), reach);
        P.fist[0] = true;
        P.head.pitch = 0.1;
      }
    } else if (t < T.toBench) {
      // steps back, turns to the room, hands on his hips: listens to the fan; looks round
      // at the gaps the air is blowing out through
      const P1 = { x: 0.12, z: -1.32 };
      if (t < T.fanOn + 1.0) {
        walkTo(P, travel(t, T.fanOn + 0.35, T.fanOn + 1.0, [[SW.x, SW.z], [P1.x, P1.z]], { stride: 0.9, inside: true, ease: 0.35 }), LEG);
        P.yaw = angLerp(Math.PI, 0.1, smooth01(t, T.fanOn + 0.35, 0.65));
      } else {
        const yaw = 0.1;
        P.feet = stance(P1.x, P1.z, yaw, true);
        P.pelvis = V(P1.x, FLOOR + LEG + breathe, P1.z);
        P.yaw = yaw;
        const hips = smooth01(t, T.fanOn + 1.0, 0.35);
        P.hands = [local(P.pelvis, yaw, 0.2, -0.12, 0.04).lerp(local(P.pelvis, yaw, 0.24, 0.1, 0.02), hips), local(P.pelvis, yaw, -0.2, -0.12, 0.04).lerp(local(P.pelvis, yaw, -0.24, 0.1, 0.02), hips)];
        P.elbowOut = 0.45 + 0.75 * hips;
        // looks round the walls (the gaps), up at the ceiling
        const lk = bump(t, T.leak0, T.leak1, 0.4);
        P.head.yaw = lk * 0.7 * Math.sin((t - T.leak0) * 1.3);
        P.head.pitch = -lk * 0.25 * (0.5 + 0.5 * Math.cos((t - T.leak0) * 1.1));
        P.head.yaw += -0.4 * bump(t, T.fanOn + 1.0, T.push1, 0.3);
      }
    } else if (t < T.toBench + 0.75) {
      walkTo(P, travel(t, T.toBench, T.toBench + 0.75, [[0.12, -1.32], [SEAT + 0.05, seatZ + 0.38]], { stride: 0.9, inside: true, ease: 0.3 }), LEG);
      P.yaw = angLerp(P.yaw, 0, smooth01(t, T.toBench + 0.45, 0.3));
    } else {
      // on the bench next to the dog: sits down; calm; leans back with his hands behind
      // his head; a thumbs-up to the camera; freezes at the pfft; turns to the dog;
      // reaches for the gas mask and slowly pulls it on
      sitPose(P, SEAT, 1);
      const sitDown = 1 - smooth01(t, T.toBench + 0.75, 0.45);
      P.pelvis.y += 0.3 * sitDown;
      P.pelvis.z += 0.28 * sitDown;
      const frozen = t > T.freeze;
      const tb = frozen ? T.freeze : t; // the idle motion stops dead
      P.pelvis.y += 0.006 * Math.sin(tb * 1.7);
      const knees = [V(SEAT + 0.15, WD.BENCH.seat + 0.13, seatZ + 0.36), V(SEAT - 0.15, WD.BENCH.seat + 0.13, seatZ + 0.36)];
      P.hands = knees.map((k) => k.clone());
      // relaxed: leans back on the wall, hands behind his head
      const relax = smooth01(t, T.safe0 - 0.2, 0.6) * (1 - smooth01(t, T.mask0 + 1.6, 0.6));
      P.lean = -0.08 - 0.13 * relax;
      P.spine.pitch = 0.03 - 0.06 * relax;
      P.head.pitch = -0.1 * relax + 0.03 * Math.sin(tb * 0.8) * relax;
      P.head.roll = 0.08 * relax;
      // the hands behind the head
      const hb = relax * (1 - smooth01(t, T.thumb - 0.15, 0.3));
      const behind = (sd) => worker.headPos.clone().add(V(sd * 0.11, 0.0, -0.11).applyQuaternion(worker.qH));
      if (hb > 0.01) {
        P.hands = [knees[0].clone().lerp(behind(1), hb), knees[1].clone().lerp(behind(-1), hb)];
        P.elbowOut = 0.45 + 1.6 * hb;
        P.palm = [V(0, 0, -1), V(0, 0, -1)];
      }
      // right hand comes back down to the knee as the left goes up for the thumbs-up
      const thumb = smooth01(t, T.thumb - 0.15, 0.32) * (1 - smooth01(t, T.mask0, 0.45));
      if (thumb > 0.01) {
        const tu = V(SEAT + 0.3, WD.BENCH.seat + 0.86, seatZ + 0.4);
        const bob = frozen ? 0 : 0.025 * Math.sin((t - T.thumb) * 9) * Math.exp(-(t - T.thumb) * 2);
        P.hands[0] = (hb > 0.01 ? behind(1) : knees[0]).lerp(tu.add(V(0, bob, 0)), thumb);
        P.hands[1] = knees[1].clone().lerp(behind(-1), Math.max(0, hb));
        P.fist = ['thumb', false];
        P.elbowOut = [0.6, 0.45 + 1.6 * hb];
        P.palm = [V(-1, 0, 0), hb > 0.01 ? V(0, 0, -1) : null];
      }
      // freezes; slowly turns to the dog
      const turn = smooth01(t, T.freeze + 0.45, 1.1) * (1 - smooth01(t, T.mask0 + 0.55, 0.8));
      P.head.yaw = -0.85 * turn;
      P.spine.yaw = -0.12 * turn;
      // the gas mask: the left hand off the hook, up to the face, both hands pull the
      // straps back over his head
      const reach = smooth01(t, T.mask0, 0.5), bring = smooth01(t, T.mask0 + 0.5, 0.8), press = smooth01(t, T.mask0 + 1.3, 0.35), straps = bump(t, T.mask0 + 1.4, T.mask1 + 0.05, 0.25);
      if (t > T.mask0) {
        const front = worker.headPos.clone().add(V(0, -0.09, 0.36).applyQuaternion(worker.qH));
        const face = maskOnFace();
        let mp = HOOKP.clone();
        if (reach >= 1) mp = HOOKP.clone().lerp(front, bring).lerp(face, press);
        maskState = press >= 1 ? { mode: 'face' } : { mode: 'held', pos: mp };
        const thumbUp = V(SEAT + 0.3, WD.BENCH.seat + 0.86, seatZ + 0.4);
        const lh = thumbUp.clone().lerp(HOOKP.clone().add(V(0.02, 0.02, 0.02)), reach);
        P.hands[0] = reach < 1 ? lh : mp.clone().add(V(0.07, -0.02, -0.02));
        P.fist[0] = false;
        P.palm = [null, null];
        P.elbowOut = [0.7, 0.6];
        if (bring > 0.3) {
          const k = smooth(clamp((bring - 0.3) / 0.7));
          P.hands[1] = knees[1].clone().lerp(mp.clone().add(V(-0.07, -0.02, -0.02)), k);
        }
        if (straps > 0.01) {
          const top = worker.headPos.clone().add(V(0, 0.16, -0.08).applyQuaternion(worker.qH));
          P.hands = [P.hands[0].clone().lerp(top.clone().add(V(0.09, 0, 0)), straps), P.hands[1].clone().lerp(top.clone().add(V(-0.09, 0, 0)), straps)];
          P.elbowOut = 1.4;
        }
        const down = smooth01(t, T.mask1 + 0.05, 0.6);
        if (down > 0) P.hands = [P.hands[0].clone().lerp(knees[0], down), P.hands[1].clone().lerp(knees[1], down)];
        // and once it is on: one slow look at the dog
        P.head.yaw += -0.6 * bump(t, T.mask1 + 0.6, END + 1, 0.7);
      }
    }
    return { P, shovelState, maskState };
  }

  // -------------------------------------------------------------------------
  // the little brother on the porch: an empty can in one hand, patting his tummy with
  // the other; it rumbles; he holds up the can; idles; braces... the blast
  // -------------------------------------------------------------------------
  const KID_LEG = 0.96 * KS;
  function kidPose(t) {
    const P = blank();
    const x = WD.KID.x, z = WD.KID.z, fy = WD.PORCH.y;
    const yaw = 0.06 * Math.sin(t * 0.45) + 0.04;
    P.feet = stance(x, z, yaw, false, 0.085, 1);
    P.feet.forEach((f) => (f.y = fy));
    const brace = bump(t, T.brace, T.blast + 0.05, 0.12);
    const jolt = bump(t, T.blast - 0.02, T.blast + 0.7, 0.05) * (1 - prog(t, T.blast, 0.7));
    const relief = smooth01(t, T.blast + 0.6, 0.5);
    const sway = 0.012 * Math.sin(t * 1.3);
    P.pelvis = V(x + sway, fy + KID_LEG + 0.006 * Math.sin(t * 2.2) - 0.07 * brace + 0.03 * jolt, z + 0.06 * jolt - 0.02 * brace);
    P.yaw = yaw;
    P.lean = 0.2 * brace - 0.12 * jolt;
    P.spine.pitch = 0.03 + 0.12 * brace - 0.1 * jolt + 0.06 * relief * bump(t, T.blast + 0.6, T.blast + 2.0, 0.4);
    P.head.pitch = 0.1 + 0.05 * Math.sin(t * 0.7);
    // the tummy: full; rumbles (wobbles) now and then
    const rumble = (t0) => U.wobble(t, t0, 7, 3.5) * bump(t, t0, t0 + 1.2, 0.05);
    P.belly = 1 + 0.5 * (rumble(T.rumble) + rumble(25.2) + rumble(37.6) + rumble(T.brace - 0.3)) + 0.25 * brace;
    P.head.pitch += 0.35 * bump(t, T.rumble, T.rumble + 0.9, 0.15); // looks down at it
    const s = KS;
    const pel = P.pelvis;
    const restL = local(pel, yaw, 0.15 * s, -0.12 * s, 0.05 * s), restR = local(pel, yaw, -0.2 * s, -0.08 * s, 0.1 * s);
    // the left hand pats the tummy (from the start), the right holds the can at his side
    const patOn = smooth01(t, T.pat0, 0.25) * (1 - smooth01(t, 6.6, 0.4)) + bump(t, 24.9, 27.0, 0.3) + bump(t, 37.3, 39.4, 0.3);
    const pat = Math.max(0, Math.sin((t - T.pat0) * 2 * Math.PI * 2.2));
    const tummy = local(pel, yaw, 0.04 * s, 0.1 * s, (0.2 + 0.035 * pat) * s);
    P.hands[0] = restL.clone().lerp(tummy, clamp(patOn));
    P.hands[1] = restR.clone();
    // holds the empty can up to show it ("three cans")
    const show = bump(t, T.label3 - 0.3, T.label3 + 1.25, 0.25);
    if (show > 0.01) P.hands[1] = restR.clone().lerp(local(pel, yaw, -0.42 * s, 0.62 * s + 0.02 * Math.sin(t * 7), 0.3 * s), show);
    P.fist = [false, true];
    // brace: both hands on the tummy; the jolt flings his arms out; then he rubs it, relieved
    if (brace > 0.01 || jolt > 0.01) {
      const k = Math.max(brace, 0);
      P.hands[0] = P.hands[0].clone().lerp(local(pel, yaw, 0.06 * s, 0.08 * s, 0.22 * s), k);
      P.hands[1] = P.hands[1].clone().lerp(local(pel, yaw, -0.08 * s, 0.1 * s, 0.24 * s), k);
      if (jolt > 0.01) {
        P.hands[0] = P.hands[0].clone().lerp(local(pel, yaw, 0.45 * s, 0.55 * s, 0.1 * s), jolt);
        P.hands[1] = P.hands[1].clone().lerp(local(pel, yaw, -0.45 * s, 0.6 * s, 0.1 * s), jolt);
        P.elbowOut = 1.0;
      }
    }
    if (relief > 0.01) {
      const rub = local(pel, yaw, (0.03 + 0.04 * Math.sin(t * 5)) * s, (0.12 + 0.03 * Math.cos(t * 5)) * s, 0.22 * s);
      P.hands[0] = P.hands[0].clone().lerp(rub, relief * (1 - jolt));
      P.head.pitch += -0.12 * relief;
    }
    return P;
  }

  // -------------------------------------------------------------------------
  // the dog: naps under the tree; races ahead of the worker down into the shelter; lies
  // by the bench; hops up next to him; looks guilty; the pfft
  // -------------------------------------------------------------------------
  const DOG_SPOT = { x: -0.2, z: -1.45, yaw: 0.3 };
  const DS = WD.DOG_SEAT;
  function dogPose(t) {
    const P = { x: 0, y: 0.38, z: 0, yaw: 0, pitch: 0, roll: 0, paws: [], headPitch: -0.15, headYaw: 0, wag: Math.sin(t * 9) * 0.5, tail: 0.7, ears: 0, breath: Math.sin(t * 2.2) };
    const Hh = 0.38; // trunk height when standing
    const legs = (x, z, yaw, inside, gaitPhase, stride, run, gy = null) => {
      const sx = Math.cos(yaw), sz = -Math.sin(yaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
      const offs = [[0.075, 0.21], [-0.075, 0.21], [0.085, -0.25], [-0.085, -0.25]];
      const phases = run ? [0, 0.1, 0.5, 0.6] : [0, 0.5, 0.5, 0];
      return offs.map(([a, b], i) => {
        const ph = gaitPhase / (Math.PI * 2) + phases[i];
        const f = ph - Math.floor(ph);
        const sw = f > 0.5 ? Math.sin(((f - 0.5) / 0.5) * Math.PI) : 0;
        const slide = f <= 0.5 ? 0.5 - f * 2 : -0.5 + ((f - 0.5) / 0.5) * 1.0;
        const px = x + sx * a + fx * (b + slide * stride * 0.5);
        const pz = z + sz * a + fz * (b + slide * stride * 0.5);
        return { x: px, y: (gy ?? groundAt(px, pz, inside)) + 0.07 * sw, z: pz };
      });
    };
    const lying = (x, z, yaw, gy) => {
      // front legs stretched forward, hind legs folded under
      const q = qYaw(yaw);
      const at = (a, b) => V(x, gy, z).add(V(a, 0, b).applyQuaternion(q));
      return [at(0.08, 0.44), at(-0.08, 0.44), at(0.16, -0.12), at(-0.16, -0.12)].map((v) => ({ x: v.x, y: gy, z: v.z }));
    };
    const RUN0 = T.walkIn0 + 0.05, RUN1 = T.walkIn0 + 0.95, DOWN1 = T.walkIn0 + 1.6, IN1 = T.walkIn0 + 2.25;
    if (t < RUN0) {
      // napping in the tree's shade; lifts its head at the digging
      const H0 = WD.DOG_HOME;
      P.x = H0.x; P.z = H0.z; P.yaw = H0.yaw;
      P.y = 0.17;
      P.paws = lying(H0.x, H0.z, H0.yaw, 0);
      const up = smooth01(t, T.dig0 + 0.3, 0.5);
      P.headPitch = 0.45 * (1 - up) - 0.1 * up;
      P.headYaw = 0.35 * up * Math.sin(t * 0.8);
      P.wag = 0.15 * Math.sin(t * 2.5) * up;
      P.tail = 0.25;
      P.y += 0.08 * smooth01(t, RUN0 - 0.3, 0.3);
    } else if (t < RUN1) {
      const H0 = WD.DOG_HOME;
      const tr = travel(t, RUN0, RUN1, [[H0.x, H0.z], [4.75, -2.1], [4.02, -0.8], [3.56, -0.6]], { stride: 1.0, ease: 0.2, easeOut: false });
      P.x = tr.x; P.z = tr.z; P.yaw = tr.yaw;
      const g = smooth01(t, RUN0, 0.2);
      P.y = lerp(0.25, Hh - 0.02 + 0.045 * Math.abs(Math.sin(tr.phase)), g);
      P.paws = legs(tr.x, tr.z, tr.yaw, false, tr.phase * 2.0, 0.6, true);
      P.pitch = 0.06 * Math.sin(tr.phase * 2);
      P.wag = 0.3 * Math.sin(t * 7);
      P.ears = 0.5;
    } else if (t < DOWN1) {
      // bounds down the steps, nose down
      const tr = travel(t, RUN1, DOWN1, [[3.56, -0.6], [1.62, -0.6]], { stride: 0.9, inside: true, ease: 0.1, easeIn: false, easeOut: false });
      P.x = tr.x; P.z = tr.z; P.yaw = tr.yaw;
      const onStairs = tr.x > 1.62 && tr.x < 3.62;
      P.y = groundAt(tr.x + 0.1, tr.z, true) + Hh + 0.05 * Math.abs(Math.sin(tr.phase * 2)) + 0.12;
      P.pitch = onStairs ? 0.62 : 0;
      P.paws = legs(tr.x, tr.z, tr.yaw, true, tr.phase * 2.0, 0.45, true).map((p) => ({ ...p, y: WD.stairY(p.x) }));
      P.ears = 0.4;
    } else if (t < IN1) {
      const tr = travel(t, DOWN1, IN1, [[1.62, -0.6], [0.8, -1.0], [DOG_SPOT.x, DOG_SPOT.z]], { stride: 0.8, inside: true, ease: 0.3, easeIn: false });
      P.x = tr.x; P.z = tr.z; P.yaw = tr.yaw;
      P.y = FLOOR + Hh + 0.03 * Math.abs(Math.sin(tr.phase * 2));
      P.paws = legs(tr.x, tr.z, tr.yaw, true, tr.phase * 2.0, 0.4, false);
    } else if (t < T.toBench + 0.15) {
      // lies down by the bench, head up; pants in the stuffy air; ears flutter in the fan's draught
      const yaw = angLerp(Math.atan2(DOG_SPOT.x - 0.8, DOG_SPOT.z + 1.0), DOG_SPOT.yaw, smooth01(t, IN1, 0.3));
      const lie = smooth01(t, IN1 + 0.1, 0.45);
      P.x = DOG_SPOT.x; P.z = DOG_SPOT.z; P.yaw = yaw;
      P.y = FLOOR + lerp(Hh, 0.17, lie);
      const stand = legs(DOG_SPOT.x, DOG_SPOT.z, yaw, true, 0, 0, false);
      const lay = lying(DOG_SPOT.x, DOG_SPOT.z, yaw, FLOOR);
      P.paws = stand.map((p, i) => ({ x: lerp(p.x, lay[i].x, lie), y: FLOOR, z: lerp(p.z, lay[i].z, lie) }));
      const pant = bump(t, T.stuffy0, T.air0 + 1.0, 0.5);
      P.breath = Math.sin(t * (2.2 + 9 * pant)) * (1 + 1.5 * pant);
      P.headPitch = -0.2 + 0.1 * Math.sin(t * 0.6) + 0.04 * pant * Math.sin(t * 11);
      P.headYaw = 0.5 * Math.sin(t * 0.45) * (1 - pant) + 0.5 * bump(t, T.press0, T.press1, 0.4);
      P.wag = 0.18 * Math.sin(t * 3);
      P.tail = 0.3;
      P.earFlap = 0.25 * bump(t, T.fanOn + 0.3, T.push1 + 1.0, 0.3);
      P.earPh = t * 31;
      P.ears = 0.2 * P.earFlap;
    } else {
      // hops up onto the bench beside him and sits
      const t0 = T.toBench + 0.15;
      const SIT_Y = WD.BENCH.seat;
      const up = smooth01(t, t0, 0.3); // stands
      const hop = prog(t, t0 + 0.55, 0.42); // the jump
      const sit = smooth01(t, t0 + 0.95, 0.35);
      const yawJ = Math.atan2(DS.x - DOG_SPOT.x, DS.z + 0.08 - DOG_SPOT.z);
      if (hop <= 0) {
        const yaw = angLerp(DOG_SPOT.yaw, yawJ, smooth01(t, t0 + 0.2, 0.35));
        P.x = DOG_SPOT.x; P.z = DOG_SPOT.z; P.yaw = yaw;
        P.y = FLOOR + lerp(0.17, Hh, up) - 0.08 * smooth01(t, t0 + 0.4, 0.15);
        P.paws = legs(DOG_SPOT.x, DOG_SPOT.z, yaw, true, 0, 0, false);
        P.pitch = -0.1 * smooth01(t, t0 + 0.4, 0.15);
      } else if (hop < 1) {
        const e = smooth(hop);
        P.x = lerp(DOG_SPOT.x, DS.x, e); P.z = lerp(DOG_SPOT.z, DS.z + 0.05, e);
        P.yaw = angLerp(yawJ, 0, smooth(clamp((hop - 0.5) / 0.5)));
        P.y = lerp(FLOOR + Hh, SIT_Y + Hh, e) + Math.sin(hop * Math.PI) * 0.32;
        P.pitch = -0.35 * Math.sin(hop * Math.PI);
        const q = qYaw(P.yaw);
        P.paws = [[0.08, 0.3], [-0.08, 0.3], [0.08, -0.32], [-0.08, -0.32]].map(([a, b], i) => {
          const v = V(P.x, P.y - 0.36 + (i < 2 ? 0.08 : 0.0), P.z).add(V(a, 0, b * (i < 2 ? 1.1 : 0.9)).applyQuaternion(q));
          return { x: v.x, y: v.y, z: v.z };
        });
      } else {
        // sitting on the bench, facing the camera
        const yaw = 0;
        P.yaw = yaw;
        P.x = DS.x; P.z = lerp(DS.z + 0.05, DS.z, sit);
        P.pitch = lerp(0, -0.78, sit);
        P.y = SIT_Y + lerp(Hh, 0.32, sit);
        const stand = legs(DS.x, DS.z + 0.05, 0, true, 0, 0, false, SIT_Y);
        const sitP = [V(0.075, SIT_Y, DS.z + 0.15), V(-0.075, SIT_Y, DS.z + 0.15), V(0.15, SIT_Y, DS.z - 0.05), V(-0.15, SIT_Y, DS.z - 0.05)];
        P.paws = stand.map((p, i) => ({ x: lerp(p.x, DS.x + sitP[i].x, sit), y: SIT_Y, z: lerp(p.z, sitP[i].z, sit) }));
        P.headPitch = 0.55 * sit - 0.05; // the trunk is pitched up; the head levels out
        // pleased at the thumbs-up; then guilty: head down and away, ears back, tail tucked
        const happy = bump(t, T.thumb, T.guilty + 0.1, 0.2);
        P.wag = Math.sin(t * 10) * (0.2 + 0.6 * happy);
        P.tail = 0.25 + 0.2 * happy;
        P.headYaw = 0.15 * Math.sin(t * 0.5) + 0.25 * happy;
        const g = smooth01(t, T.guilty, 0.5);
        P.headPitch += 0.38 * g;
        P.headYaw = lerp(P.headYaw, -0.62, g);
        P.headRoll = 0.15 * g;
        P.ears = g;
        P.tail = lerp(P.tail, 0.0, g);
        P.wag *= 1 - g;
        // a sideways glance at the worker, then away again
        P.headYaw += 0.45 * bump(t, T.freeze + 0.6, T.freeze + 1.9, 0.35);
        // the pfft: a tiny lift of the rump, the tail flicks
        const pf = bump(t, T.pfft - 0.05, T.pfft + 0.35, 0.08);
        P.y += 0.025 * pf;
        P.pitch += 0.05 * pf;
        P.tail += 0.35 * pf;
        P.breath = Math.sin(t * 2.4) * (t > T.freeze ? 0.5 : 1);
        // sitting, the tail lies along the bench beside it (lifting a little with the mood)
        if (sit > 0.5) P.tailWorld = V(-0.55, -0.15 + 0.6 * P.tail, 0.7);
      }
    }
    return P;
  }

  updaters.push((t) => {
    const w = workerPose(t);
    worker.setPose(w.P);
    const ss = w.shovelState;
    if (ss.mode === 'ground') placeShovel(SHOVEL0.tip, SHOVEL0.top, V(0, 0, 1));
    else if (ss.mode === 'lawn') placeShovel(SHOVEL_LAWN.tip, SHOVEL_LAWN.top, V(0, 1, 0));
    else placeShovel(ss.tip, ss.top, V(0, 0, 1));
    // the gas mask (it comes with the shelter)
    mask.visible = t > T.shell0 + 1.7;
    const ms = w.maskState;
    if (ms.mode === 'hook') {
      mask.position.copy(HOOKP);
      mask.quaternion.setFromEuler(new THREE.Euler(0.28, 0, 0));
    } else if (ms.mode === 'held') {
      mask.position.copy(ms.pos);
      const k = smooth01(t, T.mask0 + 0.5, 0.8);
      mask.quaternion.setFromEuler(new THREE.Euler(0.28, 0, 0)).slerp(worker.qH, k);
    } else {
      mask.position.copy(maskOnFace());
      mask.quaternion.copy(worker.qH);
    }
    // the little brother and his can
    kid.setPose(kidPose(t));
    const h = kid.hand[1];
    kidCan.position.copy(h.wrist).addScaledVector(h.dir, 0.05).addScaledVector(h.inward, 0.035).add(V(0, -0.05, 0));
    kidCan.rotation.set(0.1, 0.4, 0);
    const dp = dogPose(t);
    dog.setPose(dp);
    ctx.anchors.dogRear = dog.body.position.clone().add(V(0, 0.05, -0.38).applyQuaternion(dog.body.quaternion));
  });

  ctx.FX.people = { worker, kid, dog };
  return {
    update(t) {
      for (const u of updaters) u(t);
    },
  };
}
