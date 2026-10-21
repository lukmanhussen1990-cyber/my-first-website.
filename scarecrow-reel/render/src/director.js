// Director (temporary lineup test)
import * as THREE from 'three';
import { mixPresets } from './lighting.js';
import { buildScarecrow, PZ } from './scarecrow.js';
import { buildKid } from './kid.js';
import { buildCrow, buildBaby } from './crow.js';
import { buildCutaway } from './cutaway.js';
import { U } from './shaders.js';
export class Director {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.S = buildScarecrow(this.scene); this.K = buildKid(this.scene); this.cut = buildCutaway(this.scene);
    this.crows = [0, 1, 2, 3, 4].map((v) => buildCrow(this.scene, v));
    this.babies = [0, 1, 2].map((k) => buildBaby(this.S.nest, k));
    this.ready = Promise.resolve();
  }
  update(t) {
    const qs = new URLSearchParams(location.search);
    this.light.apply(mixPresets([{ p: qs.get('preset') || 'golden', w: 1 }]));
    const cam = qs.get('cam') || 'main';
    if (cam === 'main') { this.camera.position.set(0, 1.42, 5.9); this.camera.lookAt(0, 0.42, 0); this.camera.fov = 50; }
    if (cam === 'close') { this.camera.position.set(0, 1.5, 3.2); this.camera.lookAt(0, 1.3, 0); this.camera.fov = 45; }
    if (cam === 'crow') { this.camera.position.set(-0.6, 0.45, 1.6); this.camera.lookAt(-0.9, 0.25, 0); this.camera.fov = 35; }
    this.camera.updateProjectionMatrix();
    U.uHoleOpen.value = 0; U.uHoleDisturbed.value = 1.3;
    const full = qs.has('full');
    this.S.setPose({ time: t, spin: 0, armL: 0.0, armR: 0.2, motor: 1, battery: 1, wires: 1, chipWire: 1, motorOn: 1, randomBox: full ? 1 : 0, chipGlow: 1, leds: full ? 1 : 0, eyeGlow: full ? 0.6 : 0, sensor: full ? 1 : 0, cone: full ? 0.6 : 0, sensorLed: 1, speaker: full ? 1 : 0, nest: qs.has('nest') ? 1 : 0 });
    this.K.setPose({ x: -0.82, z: 0.02, yaw: 0.6, mouth: 'grin', gaze: [0.3, 0.1], arms: [[0.2, 0.3, 0, 0.5], [-0.4, -0.2, 0, 1.2]] });
    this.cut.update(t);
    const S = this.S; S.root.updateMatrixWorld(true);
    const spots = [[0, 0.55], [0, 0.95], [1, 0.5], [1, 0.92]];
    this.crows.forEach((c, i) => {
      if (i < 4) { const [side, u] = spots[i]; const p = S.armPoint(side, u); c.setPose({ x: p.x, y: p.y, z: p.z, yaw: (i % 2 ? 0.4 : -0.3), headYaw: i === 1 ? 0.5 : -0.2, headRoll: i === 2 ? 0.25 : 0, browL: i === 3 ? 0.8 : 0.3, browR: i === 3 ? -0.2 : 0.3, gaze: [0.2, 0] }); }
      else c.setPose({ x: 0.55, y: 0.05, z: 0.0, yaw: 0.5, spread: 1, flap: 0.6, beakOpen: 0.6, wide: 0.8, lid: 0.0 });
    });
    this.babies.forEach((b, k) => b.setPose({ x: (k - 1) * 0.06, y: 0.09, z: k === 1 ? 0.02 : -0.01, open: k === 1 ? 1 : 0.3, yaw: (k - 1) * 0.3 }));
  }
}
