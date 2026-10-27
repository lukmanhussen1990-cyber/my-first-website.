// Low-poly man: lofted torso, planar-projected face, 3D two-bone IK for arms and legs.
import * as THREE from 'three';
import { loftGeometry, boneGeometry, placeBone, headGeometry, lowSphere, clamp, lerp } from './rig.js';
import * as T from './textures.js';

// 3D two-bone IK: returns joint + end positions; joint bends toward `pole`.
export function ik3(A, target, L1, L2, pole) {
  const d = new THREE.Vector3().subVectors(target, A);
  const dist = clamp(d.length(), Math.abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4);
  const dir = d.normalize();
  const toPole = new THREE.Vector3().subVectors(pole, A);
  const n = new THREE.Vector3().crossVectors(dir, toPole).normalize();
  const bend = new THREE.Vector3().crossVectors(n, dir).normalize();
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const J = A.clone().addScaledVector(dir, a).addScaledVector(bend, h);
  const E = A.clone().addScaledVector(dir, dist);
  return { J, E };
}

function faceCanvas({ skin = '#e0b48f', hair = '#3a2a1e', size = 128, eyes = 'open', mouth = 'smile' } = {}) {
  const c = T.canvas(size, size);
  const ctx = c.getContext('2d');
  const S = size;
  ctx.drawImage(T.solidCanvas(skin, 7, 14), 0, 0, S, S);
  // hairline
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.02, S * 0.52, S * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  // brows
  ctx.strokeStyle = hair; ctx.lineWidth = S * 0.035; ctx.lineCap = 'round';
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(S * (0.5 + sd * 0.07), S * 0.36); ctx.quadraticCurveTo(S * (0.5 + sd * 0.15), S * 0.33, S * (0.5 + sd * 0.23), S * 0.37); ctx.stroke();
  }
  // eyes
  for (const sd of [-1, 1]) {
    const cx = S * (0.5 + sd * 0.15), cy = S * 0.45;
    ctx.fillStyle = 'rgba(120,70,50,0.35)';
    ctx.beginPath(); ctx.ellipse(cx, cy + S * 0.01, S * 0.085, S * 0.045, 0, 0, Math.PI * 2); ctx.fill();
    if (eyes === 'closed') {
      ctx.strokeStyle = '#3a2418'; ctx.lineWidth = S * 0.018;
      ctx.beginPath(); ctx.arc(cx, cy - S * 0.01, S * 0.05, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#f4efe8';
    ctx.beginPath(); ctx.ellipse(cx, cy, S * 0.062, S * 0.032, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a3020';
    ctx.beginPath(); ctx.arc(cx, cy, S * 0.027, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(cx, cy, S * 0.013, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a2418'; ctx.lineWidth = S * 0.012;
    ctx.beginPath(); ctx.ellipse(cx, cy, S * 0.062, S * 0.032, 0, Math.PI, Math.PI * 2); ctx.stroke();
  }
  // nose
  ctx.fillStyle = 'rgba(150,90,60,0.45)';
  ctx.beginPath(); ctx.moveTo(S * 0.5, S * 0.47); ctx.lineTo(S * 0.455, S * 0.62); ctx.lineTo(S * 0.545, S * 0.62); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(90,50,35,0.6)';
  ctx.fillRect(S * 0.46, S * 0.615, S * 0.025, S * 0.015); ctx.fillRect(S * 0.515, S * 0.615, S * 0.025, S * 0.015);
  // stubble
  ctx.fillStyle = 'rgba(70,50,40,0.18)';
  ctx.beginPath(); ctx.ellipse(S * 0.5, S * 0.8, S * 0.3, S * 0.17, 0, 0, Math.PI * 2); ctx.fill();
  // mouth
  ctx.strokeStyle = '#8a4a3e'; ctx.lineWidth = S * 0.025;
  ctx.beginPath();
  if (mouth === 'smile') ctx.arc(S * 0.5, S * 0.66, S * 0.09, Math.PI * 0.2, Math.PI * 0.8);
  else if (mouth === 'o') { ctx.fillStyle = '#5a2a24'; ctx.ellipse(S * 0.5, S * 0.74, S * 0.04, S * 0.05, 0, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.moveTo(S * 0.42, S * 0.74); ctx.lineTo(S * 0.58, S * 0.74); }
  ctx.stroke();
  return c;
}

export class Human {
  constructor({ skin = '#e0b48f', hair = '#3a2a1e', shirt = '#3e7d6e', pants = '#3a5684', shoes = '#f2f2f0', faceTextures = null } = {}) {
    this.root = new THREE.Group();
    this.skin = skin; this.hair = hair;
    this.faceTextures = faceTextures;
    this.faceCache = {};
    const mat = (tex, o = {}) => new THREE.MeshLambertMaterial({ map: tex, flatShading: true, ...o });
    const tShirt = T.toTexture(T.clothCanvas({ base: shirt, kind: 'knit', seed: 3 }), { repeat: [2, 2] });
    const tPants = T.toTexture(T.clothCanvas({ base: pants, kind: 'denim', seed: 4 }), { repeat: [1, 2] });
    const tSkin = T.toTexture(T.solidCanvas(skin, 5, 12));
    const tHair = T.toTexture(T.solidCanvas(hair, 6, 30));
    this.mats = { shirt: mat(tShirt), pants: mat(tPants), skin: mat(tSkin), hair: mat(tHair), shoe: mat(T.toTexture(T.solidCanvas(shoes, 8, 14))) };

    // torso group pivots at the pelvis
    this.pelvis = new THREE.Group();
    this.root.add(this.pelvis);
    const hip = new THREE.Mesh(loftGeometry([
      { z: -0.11, w: 0.15, h: 0.08, y: 0 }, { z: 0, w: 0.17, h: 0.1, y: 0 }, { z: 0.1, w: 0.15, h: 0.08, y: 0 },
    ], 8), this.mats.pants);
    hip.rotation.y = Math.PI / 2; // loft runs along +Z; turn it sideways (left-right)
    this.pelvis.add(hip);
    this.chest = new THREE.Group();
    this.chest.position.y = 0.05;
    this.pelvis.add(this.chest);
    // torso loft along +Y: build along Z then rotate
    const torsoG = loftGeometry([
      { z: 0.0, w: 0.165, h: 0.105, y: 0 }, { z: 0.16, w: 0.16, h: 0.11, y: 0.0 }, { z: 0.32, w: 0.19, h: 0.12, y: 0.005 },
      { z: 0.44, w: 0.2, h: 0.11, y: 0.0 }, { z: 0.5, w: 0.13, h: 0.07, y: 0 },
    ], 8);
    torsoG.rotateX(-Math.PI / 2); // +Z -> +Y
    this.torso = new THREE.Mesh(torsoG, this.mats.shirt);
    this.chest.add(this.torso);
    this.neck = new THREE.Mesh(boneGeometry(0.055, 0.05, 7), this.mats.skin);
    this.neck.position.y = 0.48; this.neck.scale.y = 0.1;
    this.chest.add(this.neck);
    this.head = new THREE.Group();
    this.head.position.y = 0.62;
    this.chest.add(this.head);
    const hg = headGeometry({ rx: 0.095, ry: 0.122, rz: 0.11, segW: 10, segH: 8, flatFront: 0.8, cheeks: -0.25,
      muzzle: { x: 0, y: -0.01, z: 0.085, rx: 0.025, ry: 0.035, rz: 0.03 }, faceW: 0.2, faceH: 0.26, faceY: -0.005, frontCut: 0.35 });
    this.faceMat = mat(this.faceMap('open', 'smile'));
    this.headMesh = new THREE.Mesh(hg, [this.mats.skin, this.faceMat]);
    this.head.add(this.headMesh);
    const hairG = lowSphere(0.103, 0.075, 0.118, 10, 5);
    this.hairMesh = new THREE.Mesh(hairG, this.mats.hair);
    this.hairMesh.position.set(0, 0.06, -0.012);
    this.head.add(this.hairMesh);
    for (const sd of [-1, 1]) {
      const ear = new THREE.Mesh(lowSphere(0.014, 0.03, 0.02, 5, 4), this.mats.skin);
      ear.position.set(sd * 0.095, 0.0, -0.01);
      this.head.add(ear);
    }
    // limbs
    this.arms = [-1, 1].map((sd) => ({
      side: sd,
      upper: new THREE.Mesh(boneGeometry(0.052, 0.042, 7), this.mats.shirt),
      lower: new THREE.Mesh(boneGeometry(0.04, 0.032, 7), this.mats.skin),
      hand: new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.095, 0.03), this.mats.skin),
      L: [0.29, 0.27],
    }));
    this.legs = [-1, 1].map((sd) => ({
      side: sd,
      upper: new THREE.Mesh(boneGeometry(0.085, 0.06, 7), this.mats.pants),
      lower: new THREE.Mesh(boneGeometry(0.058, 0.046, 7), this.mats.pants),
      shoe: new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.085, 0.27), this.mats.shoe),
      L: [0.465, 0.455],
    }));
    for (const a of this.arms) this.root.add(a.upper, a.lower, a.hand);
    for (const l of this.legs) this.root.add(l.upper, l.lower, l.shoe);
    for (const l of this.legs) { l.shoe.geometry.translate(0, 0, 0.05); }
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: T.toTexture(T.blobShadowCanvas(), { nearest: false }), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.004; sh.scale.set(0.7, 0.55, 1); sh.renderOrder = -1;
    this.root.add(sh);
  }

  faceMap(eyes, mouth) {
    const key = `${eyes}_${mouth}`;
    if (this.faceTextures && this.faceTextures[key]) return this.faceTextures[key];
    if (!this.faceCache[key]) this.faceCache[key] = T.toTexture(faceCanvas({ skin: this.skin, hair: this.hair, eyes, mouth }));
    return this.faceCache[key];
  }

  // p: { t, walking, walkPhase, stride, crouch (0..1), lean (rad forward), headYaw, headPitch, eyes, mouth,
  //      handL / handR: local Vector3 targets (root space) or null, look }
  update(p = {}) {
    const t = p.t || 0;
    const walking = p.walking ? 1 : 0;
    const ph = p.walkPhase || 0;
    const crouch = clamp(p.crouch || 0, 0, 1);
    const hipY = 0.97 - crouch * 0.42 + (walking ? Math.abs(Math.sin(ph * Math.PI * 2)) * 0.025 - 0.02 : 0);
    this.pelvis.position.set(0, hipY, 0);
    this.pelvis.rotation.set(0, walking ? Math.sin(ph * Math.PI * 2) * 0.08 : 0, 0);
    this.chest.rotation.set((p.lean || 0) + crouch * 0.35, walking ? -Math.sin(ph * Math.PI * 2) * 0.12 : 0, 0);
    this.head.rotation.set(-(p.headPitch || 0) - crouch * 0.2, p.headYaw || 0, p.headRoll || 0);
    this.faceMat.map = this.faceMap(p.eyes || 'open', p.mouth || 'smile');
    this.root.updateMatrixWorld(true);
    // legs
    for (const l of this.legs) {
      const hipLocal = new THREE.Vector3(l.side * 0.1, -0.02, 0);
      const A = this.pelvis.localToWorld(hipLocal.clone());
      this.root.worldToLocal(A);
      let fz = crouch * 0.08, fy = 0.075, pitch = 0;
      if (walking) {
        const q = (ph + (l.side > 0 ? 0.5 : 0)) % 1;
        const stride = p.stride || 0.62, duty = 0.6;
        if (q < duty) fz += stride * (0.5 - q / duty);
        else { const s = (q - duty) / (1 - duty); fz += stride * (-0.5 + (1 - Math.cos(s * Math.PI)) / 2); fy += Math.sin(s * Math.PI) * 0.12; pitch = Math.sin(s * Math.PI) * 0.3; }
      }
      const target = new THREE.Vector3(l.side * 0.1, fy, fz);
      const pole = new THREE.Vector3(l.side * 0.12, A.y - 0.3, A.z + 1);
      const { J, E } = ik3(A, target, l.L[0], l.L[1], pole);
      placeBone(l.upper, A, J); placeBone(l.lower, J, E);
      l.shoe.position.set(E.x, Math.max(0.045, E.y - 0.045), E.z);
      l.shoe.rotation.set(pitch, 0, 0);
    }
    // arms
    for (const a of this.arms) {
      const sLocal = new THREE.Vector3(a.side * 0.21, 0.43, 0);
      const A = this.chest.localToWorld(sLocal.clone());
      this.root.worldToLocal(A);
      let target = a.side < 0 ? p.handL : p.handR;
      if (!target) {
        const swing = walking ? Math.sin(ph * Math.PI * 2 + (a.side > 0 ? 0 : Math.PI)) * 0.2 : 0;
        target = new THREE.Vector3(a.side * 0.25, A.y - 0.52, A.z + swing + 0.03);
      }
      const pole = new THREE.Vector3(A.x + a.side * 0.3, A.y - 0.3, A.z - 0.8);
      const { J, E } = ik3(A, target, a.L[0], a.L[1], pole);
      placeBone(a.upper, A, J); placeBone(a.lower, J, E);
      a.hand.position.copy(E).add(new THREE.Vector3().subVectors(E, J).normalize().multiplyScalar(0.045));
      a.hand.quaternion.copy(a.lower.quaternion);
    }
  }
}
