// The silent driver: a dark silhouette with gloved hands on the wheel,
// subtle breathing, glances at the mirrors, and a head that looks into bends.

import * as THREE from 'three';
import { LAYER } from '../config.js';
import { damp, clamp } from '../core/math.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Driver {
  constructor(interior) {
    this.interior = interior;
    const m = interior.m;
    this.group = new THREE.Group();
    this.group.name = 'driver';
    this.group.position.set(-0.38, 0.47, 0.04); // hip point
    interior.group.add(this.group);

    const coat = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.82, normalMap: m.jacket.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), envMap: m.leather.envMap, envMapIntensity: 0.15 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x6a4a3c, roughness: 0.55, envMap: m.leather.envMap, envMapIntensity: 0.3 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 0.6, envMap: m.leather.envMap, envMapIntensity: 0.4 });
    const glove = new THREE.MeshStandardMaterial({ color: 0x0d0c0c, roughness: 0.38, envMap: m.leather.envMap, envMapIntensity: 0.8 });
    const eye = new THREE.MeshStandardMaterial({ color: 0x0a0807, roughness: 0.04, envMap: m.leather.envMap, envMapIntensity: 1.5 });
    this.materials = { coat, skin, hair, glove, eye };

    // Torso (lathe profile, flattened front-to-back), leaning back into the seat.
    this.torso = new THREE.Group();
    this.torso.rotation.x = 0.12;
    this.group.add(this.torso);
    const prof = [
      [0.001, 0.0], [0.15, 0.0], [0.165, 0.08], [0.175, 0.2], [0.195, 0.33], [0.215, 0.43],
      [0.205, 0.5], [0.16, 0.555], [0.09, 0.575], [0.06, 0.585], [0.001, 0.59],
    ].map(([r, y]) => new THREE.Vector2(r, y * 0.92));
    const torsoGeo = new THREE.LatheGeometry(prof, 28);
    const body = new THREE.Mesh(torsoGeo, coat);
    body.scale.set(1.08, 1, 0.62);
    body.position.set(0, 0.05, 0.02);
    body.castShadow = true;
    this.torso.add(body);
    this.chest = body;
    // Coat collar.
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.07, 20, 1, true), coat);
    collar.position.set(0, 0.59, 0.02);
    collar.material = coat;
    this.torso.add(collar);

    // Neck and head.
    this.neck = new THREE.Group();
    this.neck.position.set(0, 0.56, 0.02);
    this.torso.add(this.neck);
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.054, 0.16, 14), skin);
    neckMesh.position.y = 0.07;
    this.neck.add(neckMesh);
    this.head = new THREE.Group();
    this.head.position.set(0, 0.135, -0.035);
    this.neck.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), skin);
    skull.scale.set(0.083, 0.108, 0.098);
    skull.position.set(0, 0.075, 0);
    skull.castShadow = true;
    this.head.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin);
    jaw.scale.set(0.068, 0.06, 0.075);
    jaw.position.set(0, 0.012, -0.03);
    this.head.add(jaw);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.035, 8), skin);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0.06, -0.105);
    this.head.add(nose);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), skin);
      ear.scale.set(0.012, 0.03, 0.02);
      ear.position.set(s * 0.083, 0.068, 0.0);
      this.head.add(ear);
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 12, 8), eye);
      e.position.set(s * 0.032, 0.085, -0.088);
      this.head.add(e);
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.03, 4, 8), hair);
      brow.rotation.z = Math.PI / 2;
      brow.position.set(s * 0.033, 0.104, -0.09);
      this.head.add(brow);
    }
    // Short hair: a slightly larger cap over the top and back of the head.
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.58), hair);
    cap.scale.set(0.09, 0.115, 0.104);
    cap.position.set(0, 0.083, 0.008);
    cap.rotation.x = 0.35;
    cap.castShadow = true;
    this.head.add(cap);

    // Arms: simple two-bone IK to the steering wheel rim.
    this.arms = [-1, 1].map((s) => {
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.047, 0.24, 6, 12), coat);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.24, 6, 12), coat);
      const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.045, 6, 10), glove);
      for (const p of [upper, fore, hand]) {
        p.castShadow = true;
        interior.group.add(p);
      }
      return { s, upper, fore, hand, grip: s < 0 ? Math.PI * 0.5 + 1.0 : Math.PI * 0.5 - 1.0 };
    });

    for (const o of [this.group, ...this.arms.flatMap((a) => [a.upper, a.fore, a.hand])]) {
      o.traverse((c) => {
        if (c.isMesh) {
          c.layers.set(LAYER.INTERIOR);
          c.receiveShadow = true;
        }
      });
    }

    this.lookYaw = 0;
    this.lookPitch = 0;
    this.glance = null;
    this.glanceTimer = 6;
    this.stare = 0; // 0..1 scripted stare into the rear-view mirror
    this.time = 0;
    this._tmp = { s: V(0, 0, 0), h: V(0, 0, 0), e: V(0, 0, 0) };
  }

  /** Start a scripted look: 'mirror', 'side', 'passenger', or 'road'. */
  look(kind, duration = 1.4) {
    this.glance = { kind, t: 0, duration };
  }

  update(dt, { curvatureAhead = 0, accelLat = 0, steering = 0 }) {
    this.time += dt;
    // Breathing.
    const breath = Math.sin(this.time * (Math.PI * 2 / 4.6));
    this.chest.scale.y = 1 + breath * 0.008;
    this.torso.rotation.z = damp(this.torso.rotation.z, clamp(-accelLat * 0.012, -0.06, 0.06), 4, dt);

    // Occasional glances.
    this.glanceTimer -= dt;
    if (!this.glance && this.glanceTimer < 0) {
      const r = Math.random();
      this.look(r < 0.45 ? 'mirror' : r < 0.75 ? 'side' : 'passenger', 0.9 + Math.random() * 1.0);
      this.glanceTimer = 7 + Math.random() * 12;
    }
    let ty = clamp(curvatureAhead * 70, -0.35, 0.35);
    let tp = -0.04;
    if (this.glance) {
      this.glance.t += dt;
      const g = this.glance;
      const k = Math.sin(Math.min(1, g.t / g.duration) * Math.PI);
      const targets = { mirror: [-0.38, 0.13], side: [0.55, -0.05], passenger: [-0.45, -0.08], road: [0, -0.04] };
      const [gy, gp] = targets[g.kind] || [0, 0];
      ty = ty * (1 - k) + gy * k;
      tp = tp * (1 - k) + gp * k;
      if (g.t >= g.duration) this.glance = null;
    }
    if (this.stare > 0) {
      ty = ty * (1 - this.stare) + -0.42 * this.stare;
      tp = tp * (1 - this.stare) + 0.16 * this.stare;
    }
    this.lookYaw = damp(this.lookYaw, ty, 5, dt);
    this.lookPitch = damp(this.lookPitch, tp, 5, dt);
    // Positive yaw turns the head to the driver's right (toward -Y rotation).
    this.head.rotation.set(this.lookPitch, -this.lookYaw, 0);
    this.neck.rotation.y = -this.lookYaw * 0.3;

    this._solveArms(steering);
  }

  _solveArms(steering) {
    const interior = this.interior;
    interior.group.updateMatrixWorld(true);
    const wheelGroup = interior.wheelGroup;
    const toCar = new THREE.Matrix4().copy(interior.group.matrixWorld).invert();
    for (const arm of this.arms) {
      // Hand on the rim, rotating with the wheel.
      const a = arm.grip + steering;
      const rimLocal = V(Math.cos(a) * 0.185, Math.sin(a) * 0.185, 0.012);
      const hand = rimLocal.applyMatrix4(wheelGroup.matrixWorld).applyMatrix4(toCar);
      const torsoW = new THREE.Vector3(arm.s * 0.19, 0.45, 0.03);
      const shoulder = torsoW.applyMatrix4(this.torso.matrixWorld).applyMatrix4(toCar);
      const L1 = 0.32;
      const L2 = 0.32;
      const d = shoulder.distanceTo(hand);
      const dc = clamp(d, 0.05, L1 + L2 - 0.001);
      const dir = hand.clone().sub(shoulder).normalize();
      const aCos = (L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc);
      const along = L1 * aCos;
      const perpLen = Math.sqrt(Math.max(0, L1 * L1 - along * along));
      // Elbows bend down and outward.
      const pole = V(arm.s * 0.6, -1, 0.3).normalize();
      const perp = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
      const elbow = shoulder.clone().addScaledVector(dir, along).addScaledVector(perp, perpLen);
      place(arm.upper, shoulder, elbow);
      place(arm.fore, elbow, hand);
      arm.hand.position.copy(hand);
      arm.hand.quaternion.setFromUnitVectors(V(0, 1, 0), hand.clone().sub(elbow).normalize());
    }
  }
}

function place(mesh, a, b) {
  mesh.position.copy(a).lerp(b, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
}
