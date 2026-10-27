// Low-poly cat: lofted torso, planar-projected face, 2-bone IK legs with thigh/shoulder volumes, chained tail.
// All motion is a pure function of the pose params passed to update(), so frames render deterministically.
import * as THREE from 'three';
import { loftGeometry, boneGeometry, placeBone, ik2, headGeometry, lowSphere, clamp, lerp } from './rig.js';
import { furCanvas, catFaceCanvas, toTexture, blobShadowCanvas } from './textures.js';

export const PALETTES = {
  orange: { base: '#d98a3c', stripe: '#a5561e', belly: '#f6e7cf', iris: '#8fb04a', irisInner: '#e8d870', nose: '#e0908e' },
  gray: { base: '#8b8d92', stripe: '#4c4e54', belly: '#e9e7e2', iris: '#c9a43a', irisInner: '#f0dc7a', nose: '#c98a8e' },
  cream: { base: '#e7cfa6', stripe: '#c79e66', belly: '#fbf3e6', iris: '#5d9ac8', irisInner: '#bfe0f0', nose: '#e7a0a0', stripeStrength: 0.6 },
  black: { base: '#2a2a2e', stripe: null, belly: '#2e2e33', iris: '#d8b23a', irisInner: '#f3e07a', nose: '#3a3034' },
};

const HIP = new THREE.Vector3(0, 0.205, -0.115);
const UNIT = new THREE.Vector3(0, 1, 0);

export class Cat {
  constructor({ palette = 'orange', kitten = false, seed = 1, faceTextures = null, furTextures = null, socks = true } = {}) {
    this.pal = typeof palette === 'string' ? PALETTES[palette] : palette;
    this.kitten = kitten;
    this.seed = seed;
    this.socks = socks;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.body.position.copy(HIP);
    this.root.add(this.body);
    this.faceCache = {};
    this.faceTextures = faceTextures; // optional {variantKey: THREE.Texture} from image assets
    this._build(furTextures);
    if (kitten) {
      this.root.scale.setScalar(0.5);
      this.head.scale.setScalar(1.42);
    }
  }

  _mat(tex, opts = {}) {
    return new THREE.MeshLambertMaterial({ map: tex, flatShading: true, ...opts });
  }

  _build(furTextures) {
    const P = this.pal, s = this.seed;
    const sock = this.socks ? 0.2 : 0;
    const tex = furTextures || {
      body: toTexture(furCanvas(P, { w: 192, h: 96, stripes: 7, bib: true, seed: s })),
      leg: toTexture(furCanvas(P, { w: 64, h: 32, stripes: 5, belly: false, sock, seed: s + 1 })),
      tail: toTexture(furCanvas(P, { w: 96, h: 32, stripes: 7, belly: false, tipDark: 0.1, seed: s + 2 })),
      head: toTexture(furCanvas(P, { w: 64, h: 64, stripes: 5, belly: false, seed: s + 3 })),
    };
    this.tex = tex;
    // torso (rest pose in root space, shifted so the body group pivots at the hip)
    const rings = [
      { z: -0.172, w: 0.028, h: 0.03, y: 0.228 },
      { z: -0.155, w: 0.056, h: 0.06, y: 0.23 },
      { z: -0.112, w: 0.068, h: 0.07, y: 0.228 },
      { z: -0.05, w: 0.06, h: 0.06, y: 0.232 },
      { z: 0.012, w: 0.062, h: 0.066, y: 0.228 },
      { z: 0.07, w: 0.066, h: 0.076, y: 0.226 },
      { z: 0.118, w: 0.06, h: 0.076, y: 0.236 },
      { z: 0.152, w: 0.046, h: 0.062, y: 0.254 },
      { z: 0.172, w: 0.024, h: 0.036, y: 0.266 },
    ];
    const tg = loftGeometry(rings, 10);
    tg.translate(-HIP.x, -HIP.y, -HIP.z);
    this.torso = new THREE.Mesh(tg, this._mat(tex.body, { flatShading: false }));
    this.body.add(this.torso);

    // neck (thick ruff) + head
    this.neckBase = new THREE.Vector3(0, 0.258, 0.118).sub(HIP);
    this.headPos = new THREE.Vector3(0, 0.318, 0.19).sub(HIP);
    this.neck = new THREE.Mesh(boneGeometry(0.05, 0.042, 8), this._mat(tex.head, { flatShading: false }));
    this.body.add(this.neck);
    this.head = new THREE.Group();
    this.head.position.copy(this.headPos);
    this.body.add(this.head);
    const hg = headGeometry({
      rx: 0.06, ry: 0.052, rz: 0.054, segW: 12, segH: 9, flatFront: 0.55, cheeks: 0.18,
      muzzle: { x: 0, y: -0.02, z: 0.039, rx: 0.031, ry: 0.021, rz: 0.02 },
      faceW: 0.127, faceH: 0.115, faceY: 0.0, frontCut: 0.28,
    });
    this.faceMat = this._mat(this.faceMap('open', 'closed'));
    this.headMesh = new THREE.Mesh(hg, [this._mat(tex.head), this.faceMat]);
    this.head.add(this.headMesh);
    // ears: triangular pyramids, flat side forward
    this.ears = [];
    for (const sd of [-1, 1]) {
      const eg = new THREE.Group();
      eg.position.set(sd * 0.036, 0.036, -0.009);
      const outer = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 3), this._mat(tex.head));
      outer.rotation.y = Math.PI;
      outer.scale.set(0.025, 0.046, 0.012);
      outer.position.y = 0.019;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 3), new THREE.MeshLambertMaterial({ color: '#e2a3a0', flatShading: true }));
      inner.rotation.y = Math.PI;
      inner.scale.set(0.016, 0.034, 0.004);
      inner.position.set(0, 0.016, 0.006);
      eg.add(outer, inner);
      eg.userData.side = sd;
      this.head.add(eg);
      this.ears.push(eg);
    }
    // legs (children of root; positioned by IK each frame). Upper bones use the top half of the leg texture,
    // lower bones the bottom half (where the white sock is painted).
    const geo = {
      front: [boneGeometry(0.027, 0.02, 7, [0, 0.5]), boneGeometry(0.019, 0.015, 7, [0.5, 1])],
      hind: [boneGeometry(0.04, 0.02, 7, [0, 0.5]), boneGeometry(0.018, 0.014, 7, [0.5, 1])],
    };
    const pawGeo = lowSphere(0.017, 0.011, 0.021, 7, 4);
    const pawMat = this.socks ? new THREE.MeshLambertMaterial({ color: P.belly, flatShading: true }) : this._mat(tex.leg);
    const volGeo = { front: lowSphere(0.027, 0.05, 0.036, 7, 5), hind: lowSphere(0.032, 0.062, 0.05, 8, 6) };
    this.legs = [];
    const defs = [
      { name: 'LF', front: true, side: -1, anchor: new THREE.Vector3(-0.04, 0.215, 0.108), L: [0.095, 0.112] },
      { name: 'RF', front: true, side: 1, anchor: new THREE.Vector3(0.04, 0.215, 0.108), L: [0.095, 0.112] },
      { name: 'LH', front: false, side: -1, anchor: new THREE.Vector3(-0.046, 0.205, -0.115), L: [0.12, 0.095] },
      { name: 'RH', front: false, side: 1, anchor: new THREE.Vector3(0.046, 0.205, -0.115), L: [0.12, 0.095] },
    ];
    for (const d of defs) {
      const g = d.front ? geo.front : geo.hind;
      const upper = new THREE.Mesh(g[0], this._mat(tex.leg));
      const lower = new THREE.Mesh(g[1], this._mat(tex.leg));
      const paw = new THREE.Mesh(pawGeo, pawMat);
      const vol = new THREE.Mesh(d.front ? volGeo.front : volGeo.hind, this._mat(tex.head));
      this.root.add(upper, lower, paw, vol);
      this.legs.push({ ...d, upper, lower, paw, vol });
    }
    // tail chain
    this.tail = [];
    const segN = 9, segL = 0.031;
    let parent = this.body;
    const tailBase = new THREE.Vector3(0, 0.25, -0.162).sub(HIP);
    for (let i = 0; i < segN; i++) {
      const r0 = lerp(0.017, 0.008, i / segN), r1 = lerp(0.017, 0.008, (i + 1) / segN);
      const grp = new THREE.Group();
      if (i === 0) grp.position.copy(tailBase); else grp.position.set(0, segL, 0);
      const mesh = new THREE.Mesh(boneGeometry(r0, r1, 6, [i / segN, (i + 1) / segN]), this._mat(tex.tail));
      mesh.scale.y = segL * 1.1;
      grp.add(mesh);
      parent.add(grp);
      parent = grp;
      this.tail.push(grp);
    }
    // blob shadow
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: toTexture(blobShadowCanvas(), { nearest: false }), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(0, 0.003, 0);
    sh.renderOrder = -1;
    this.shadow = sh;
    this.root.add(sh);
  }

  faceMap(eyes, mouth, extra = '') {
    const key = `${eyes}_${mouth}${extra}`;
    if (this.faceTextures && this.faceTextures[key]) return this.faceTextures[key];
    if (!this.faceCache[key]) {
      this.faceCache[key] = toTexture(catFaceCanvas(this.pal, { eyes, mouth, kitten: this.kitten, seed: this.seed + 3, tears: extra === '_tears' }));
    }
    return this.faceCache[key];
  }

  // p: { t, sit, crouch, walkPhase, walking, stride, headYaw, headPitch, headRoll, lookTarget(world Vector3),
  //      tailLift, tailCurl, tailSway, tailSpeed, tailHook, eyes, mouth, tears, earsBack, hiss, breathe }
  update(p = {}) {
    const t = p.t || 0;
    const sit = clamp(p.sit || 0, 0, 1);
    const crouch = clamp(p.crouch || 0, 0, 1);
    const hiss = clamp(p.hiss || 0, 0, 1);
    const walking = p.walking ? 1 : 0;
    const phase = p.walkPhase || 0;

    // body: pitch around the hip, lower when sitting / crouching
    const hipY = lerp(0.205, 0.075, sit) - crouch * 0.065 - hiss * 0.015;
    const bob = walking ? Math.sin(phase * Math.PI * 4) * 0.004 : 0;
    const breathe = Math.sin(t * 2.4) * 0.005 * (p.breathe ?? 1);
    this.body.position.set(0, hipY + bob, HIP.z);
    this.body.rotation.set(lerp(0, -0.8, sit) + hiss * 0.1 + crouch * 0.04, 0, walking ? Math.sin(phase * Math.PI * 2) * 0.025 : 0);
    this.torso.scale.set(1 + breathe, 1 + breathe + hiss * 0.08, 1);
    this.body.updateMatrix();

    // neck & head
    const hp = this.headPos.clone();
    hp.y += -hiss * 0.025 - crouch * 0.012;
    hp.z += hiss * 0.012;
    placeBone(this.neck, this.neckBase, hp);
    this.head.position.copy(hp);
    let yaw = p.headYaw || 0, pitch = p.headPitch || 0;
    if (p.lookTarget) {
      this.root.updateMatrixWorld(true);
      const local = this.body.worldToLocal(p.lookTarget.clone()).sub(hp);
      yaw += clamp(Math.atan2(local.x, local.z), -1.3, 1.3);
      pitch += clamp(Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.7, 0.7);
    }
    const bodyPitch = this.body.rotation.x;
    this.head.rotation.set(0, 0, 0);
    this.head.rotateY(yaw);
    this.head.rotateX(-pitch - bodyPitch * 0.9 + hiss * 0.12);
    this.head.rotateZ(p.headRoll || 0);
    const eb = clamp((p.earsBack || 0) + hiss, 0, 1);
    for (const e of this.ears) {
      const sd = e.userData.side;
      e.rotation.set(-0.12 - eb * 0.9, sd * eb * 0.5, -sd * (0.24 + eb * 0.5) + Math.sin(t * 1.3 + sd) * 0.02);
    }
    const mouth = hiss > 0.5 ? 'wide' : (p.mouth || 'closed');
    this.faceMat.map = this.faceMap(hiss > 0.5 ? 'angry' : (p.eyes || 'open'), mouth, p.tears ? '_tears' : '');

    // legs
    const bm = this.body.matrix;
    for (const L of this.legs) {
      const anchor = L.front
        ? L.anchor.clone().sub(HIP).applyMatrix4(bm)
        : new THREE.Vector3(L.anchor.x, hipY + bob, L.anchor.z);
      let fx = L.anchor.x * (L.front ? 0.92 : 1.0), fy = 0.011, fz;
      if (L.front) fz = lerp(L.anchor.z + 0.008, anchor.z + 0.012, sit) - crouch * 0.01;
      else fz = lerp(L.anchor.z + 0.004, L.anchor.z + 0.11, sit) + crouch * 0.03;
      if (sit > 0) fx = lerp(fx, L.anchor.x * (L.front ? 0.75 : 1.25), sit);
      if (walking) {
        const offs = { LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 }[L.name];
        const ph = (phase + offs) % 1;
        const duty = 0.62, ex = duty * (p.stride || 0.2);
        if (ph < duty) fz += ex * (0.5 - ph / duty);
        else {
          const q = (ph - duty) / (1 - duty);
          fz += ex * (-0.5 + (1 - Math.cos(q * Math.PI)) / 2);
          fy += Math.sin(q * Math.PI) * 0.032;
        }
      }
      const r = ik2(anchor.z, anchor.y, fz, fy, L.L[0], L.L[1], -1);
      const A = anchor;
      const J = new THREE.Vector3(lerp(anchor.x, fx, 0.5), r.jv, r.jh);
      const E = new THREE.Vector3(fx, r.ev, r.eh);
      placeBone(L.upper, A, J);
      placeBone(L.lower, J, E);
      L.paw.position.set(fx, Math.max(0.011, E.y), E.z + 0.007);
      // thigh / shoulder volume follows the upper bone
      L.vol.position.copy(A).lerp(J, L.front ? 0.22 : 0.26);
      L.vol.quaternion.copy(L.upper.quaternion);
      L.vol.position.x += Math.sign(L.anchor.x) * (L.front ? 0.002 : 0.005);
      if (!L.front) L.vol.position.z += 0.012;
    }

    // tail
    const lift = p.tailLift ?? 0.9; // 0 = straight back, ~1.5 = straight up
    const curl = p.tailCurl ?? 0.12;
    const sway = p.tailSway ?? 0.18;
    const spd = p.tailSpeed ?? 0.8;
    const puff = 1 + hiss * 0.8;
    for (let i = 0; i < this.tail.length; i++) {
      const seg = this.tail[i];
      const k = i / this.tail.length;
      if (i === 0) seg.rotation.set(-Math.PI / 2 + lift - sit * 1.0, 0, 0);
      else seg.rotation.set(-curl * (0.4 + k) - (p.tailHook || 0) * Math.max(0, k - 0.55) * 2.2,
        0, Math.sin(t * spd * Math.PI * 2 - i * 0.55) * sway * (0.25 + k));
      seg.children[0].scale.x = seg.children[0].scale.z = puff;
    }
    if (sit > 0.5) { // lay the tail on the ground beside the body
      const k = (sit - 0.5) * 2;
      this.tail[0].rotation.x = lerp(this.tail[0].rotation.x, -Math.PI / 2 - 0.55, k);
      for (let i = 1; i < this.tail.length; i++) this.tail[i].rotation.z += k * 0.24;
    }
    this.shadow.scale.set(0.22, lerp(0.46, 0.34, sit), 1);
    this.shadow.position.z = lerp(0, -0.04, sit);
  }

  headWorld(offset = new THREE.Vector3(0, 0.06, 0)) {
    this.root.updateMatrixWorld(true);
    return this.head.localToWorld(offset.clone());
  }
}
