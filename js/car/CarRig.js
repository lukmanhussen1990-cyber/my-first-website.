// The car: drives along the road, owns the cabin, the driver, lights and the
// passenger's head/camera rig with suspension and inertia-driven shake.

import * as THREE from 'three';
import { CAR, LAYER } from '../config.js';
import { Interior } from './Interior.js';
import { Driver } from './Driver.js';
import { Dashboard } from './Dashboard.js';
import { RearMirror } from './Mirror.js';
import { Wipers } from './Wipers.js';
import { headlightPattern } from '../core/textures.js';
import { Spring, damp, clamp } from '../core/math.js';
import { Noise } from '../core/noise.js';

const GEARS = [0, 380, 220, 150, 115, 92, 78];
const SHIFT = [0, 5, 10, 15, 21, 28, 1e9];

export class CarRig {
  constructor({ scene, road, quality, envMap, camera }) {
    this.road = road;
    this.q = quality;
    this.group = new THREE.Group();
    this.group.name = 'car';
    scene.add(this.group);

    this.interior = new Interior(envMap);
    this.group.add(this.interior.group);
    this.driver = new Driver(this.interior);
    this.dash = new Dashboard();
    this.interior.clusterAnchor.add(this.dash.clusterFace);
    this.interior.screenAnchor.add(this.dash.screenMesh);
    this.interior.rearDisplayAnchor.add(this.dash.rearMesh);
    for (const o of [this.dash.clusterFace, this.dash.screenMesh, this.dash.rearMesh]) {
      o.traverse((c) => c.layers.set(LAYER.INTERIOR));
    }
    this.mirror = new RearMirror(this.interior, { enabled: quality.mirror });
    this.wipers = new Wipers();
    this._buildLights();
    this._buildReflectionSelf();

    // Head/camera rig.
    this.headPivot = new THREE.Object3D();
    this.headPivot.position.set(CAR.eye.x, CAR.eye.y, CAR.eye.z);
    this.group.add(this.headPivot);
    this.camera = camera;
    this.headPivot.add(camera);
    camera.rotation.order = 'YXZ';

    this.s = 40;
    this.v = 0;
    this.d = 1.75;
    this.prevD = 1.75;
    this.accelLong = 0;
    this.accelLat = 0;
    this.cruise = 22;
    this.noise = new Noise(9);
    this.fr = {};
    this.tmp = {};
    this.heave = new Spring(90, 9);
    this.pitch = new Spring(70, 10);
    this.roll = new Spring(60, 9);
    this.headX = new Spring(40, 7);
    this.headZ = new Spring(40, 7);
    this.headY = new Spring(70, 9);
    this.lean = new THREE.Vector2(0, 0);
    this.leanTarget = new THREE.Vector2(0, 0);
    this.nextBump = 60;
    this.onBump = null;
    this.telemetry = { speed: 0, rpm: 800, throttle: 0, gear: 1, steering: 0, kappa: 0 };
    this.time = 0;
    this.lightsFlicker = 1;
    this.dashFlicker = 1;
    this.laneBias = 0;
    this.windowOpen = 0;
    this.windowTarget = 0;
  }

  _buildLights() {
    const q = this.q;
    const tex = headlightPattern();
    this.headlights = CAR.headlights.map((p, i) => {
      const L = new THREE.SpotLight(0xfff0dc, 0, 150, 0.62, 0.3, 2);
      L.position.set(p.x, p.y, p.z);
      L.target.position.set(p.x * 0.5, p.y - 0.45, p.z - 40);
      L.map = tex;
      L.castShadow = i === 0 && q.headShadow > 0;
      if (L.castShadow) {
        L.shadow.mapSize.set(q.headShadow, q.headShadow);
        L.shadow.camera.near = 0.5;
        L.shadow.camera.far = 150;
        L.shadow.bias = -0.0003;
        L.shadow.normalBias = 0.04;
      }
      this.group.add(L, L.target);
      return L;
    });
    this.headlightIntensity = 2600;
    // Instrument glow on the driver, the wheel and the tops of the seats.
    this.dashLight = new THREE.PointLight(0xffb27a, 0.9, 2.2, 2);
    this.dashLight.position.set(-0.24, 0.9, -0.55);
    // Headlight bounce off the road and mist, coming back in through the windshield.
    this.fillLight = new THREE.PointLight(0xc8d2ff, 5, 9, 2);
    this.fillLight.position.set(0, 1.35, -3.2);
    // Faint cold light from the rear window, so the seat backs read as shapes.
    this.cabinFill = new THREE.PointLight(0x8ea4d8, 1.4, 2.8, 2);
    this.cabinFill.position.set(0.1, 1.3, 1.45);
    this.tailLight = new THREE.PointLight(0xff1a0a, 0.5, 9, 2);
    this.tailLight.position.set(0, 0.85, 2.6);
    this.group.add(this.dashLight, this.fillLight, this.cabinFill, this.tailLight);
  }

  /** The passenger's own dark silhouette, visible only in the rear-view mirror. */
  _buildReflectionSelf() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.6 });
    const self = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin);
    head.scale.set(0.085, 0.11, 0.1);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), mat);
    hood.scale.set(0.105, 0.13, 0.12);
    hood.position.set(0, 0.01, 0.015);
    hood.rotation.x = 0.4;
    const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.25, 6, 12), mat);
    shoulders.rotation.z = Math.PI / 2;
    shoulders.scale.set(1, 1, 0.6);
    shoulders.position.set(0, -0.26, 0.06);
    self.add(head, hood, shoulders);
    self.traverse((o) => o.layers.set(LAYER.MIRROR_ONLY));
    self.position.set(CAR.eye.x, CAR.eye.y - 0.03, CAR.eye.z + 0.06);
    this.group.add(self);
    this.selfReflection = self;

    // A second figure that only ever appears in the mirror (scripted event).
    const ghost = new THREE.Group();
    const gHead = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat);
    gHead.scale.set(0.09, 0.12, 0.1);
    gHead.position.y = 0.05;
    const gBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.35, 6, 12), mat);
    gBody.scale.set(1.1, 1, 0.6);
    gBody.position.y = -0.3;
    ghost.add(gHead, gBody);
    ghost.traverse((o) => o.layers.set(LAYER.MIRROR_ONLY));
    ghost.position.set(-0.46, 1.12, 1.12);
    ghost.visible = false;
    this.group.add(ghost);
    this.ghost = ghost;
  }

  get position() {
    return this.group.position;
  }

  eyeWorld(out = new THREE.Vector3()) {
    return this.camera.getWorldPosition(out);
  }

  setLook(yaw, pitch) {
    this.camera.rotation.set(pitch, yaw, 0);
  }

  update(dt, { cruise = 22, wetness = 0 } = {}) {
    const road = this.road;
    this.time += dt;
    // Longitudinal: cruise, but slow for the sharpest bend within braking distance.
    let kMax = 0;
    const span = this.v * 4 + 30;
    for (let x = 0; x <= span; x += 6) kMax = Math.max(kMax, Math.abs(road.sample(this.s + x, this.tmp).kappa));
    const vCurve = Math.sqrt(2.3 / Math.max(kMax, 1e-4));
    const vTarget = Math.min(cruise, vCurve);
    const want = clamp((vTarget - this.v) * 0.55, -3.0, 1.3);
    this.accelLong = damp(this.accelLong, want, 2.5, dt);
    this.v = Math.max(0, this.v + this.accelLong * dt);
    this.s += this.v * dt;
    const fr = road.sample(this.s, this.fr);

    // Lateral: right lane, cutting corners a little, with a lazy wander.
    this.prevD = this.d;
    const wander = 0.12 * this.noise.n1(this.s / 90);
    const dTarget = clamp(1.75 - fr.kappa * 24 + wander * (1 - Math.min(1, this.laneBias)), 1.2, 2.3) + this.laneBias;
    this.d = damp(this.d, dTarget, 0.9, dt);
    const ds = Math.max(this.v * dt, 1e-3);
    const slip = Math.atan((this.d - this.prevD) / ds);
    const yaw = fr.theta - (dt > 0 ? slip : 0);

    const aLat = this.v * this.v * fr.kappa;
    this.accelLat = damp(this.accelLat, aLat, 4, dt);

    // Road texture and occasional bumps.
    const rough = (this.noise.n1(this.s * 0.9) * 0.6 + this.noise.n1(this.s * 2.7 + 5) * 0.4) * 0.006 * Math.min(1, this.v / 15);
    if (this.s > this.nextBump) {
      const strength = 0.25 + Math.random() * 0.75;
      this.heave.impulse(-0.25 * strength);
      this.pitch.impulse(0.02 * strength * (Math.random() < 0.5 ? -1 : 1));
      this.roll.impulse(0.03 * strength * (Math.random() < 0.5 ? -1 : 1));
      this.headY.impulse(-0.18 * strength);
      if (this.onBump) this.onBump(strength * Math.min(1, this.v / 18));
      this.nextBump = this.s + 40 + Math.random() * 110;
    }
    const heave = this.heave.update(rough, dt);
    const pitchBody = this.pitch.update(clamp(this.accelLong * 0.007, -0.03, 0.02), dt);
    const rollBody = this.roll.update(clamp(-this.accelLat * 0.008, -0.04, 0.04), dt);

    const i = Math.max(0, Math.min(road.n - 1, Math.round(this.s / road.ds)));
    const x = fr.x + fr.rx * this.d;
    const z = fr.z + fr.rz * this.d;
    const y = road.surfaceY(i, this.d, x, z);
    this.group.position.set(x, y + heave, z);
    const pitchRoad = Math.atan(fr.grade);
    const rollRoad = fr.bank;
    this.group.rotation.set(pitchRoad + pitchBody, yaw, rollRoad + rollBody, 'YXZ');

    // Passenger's head: lags behind accelerations, small engine/road buzz.
    this.lean.x = damp(this.lean.x, this.leanTarget.x, 6, dt);
    this.lean.y = damp(this.lean.y, this.leanTarget.y, 6, dt);
    const hx = this.headX.update(clamp(this.accelLat * 0.0055, -0.04, 0.04), dt);
    const hz = this.headZ.update(clamp(this.accelLong * 0.006, -0.03, 0.03), dt);
    const hy = this.headY.update(heave * 0.4, dt);
    const buzz = Math.min(1, this.v / 20);
    const t = this.time;
    const vib = (Math.sin(t * 71.3) * 0.5 + Math.sin(t * 53.1 + 1.3) * 0.5) * 0.00035 * buzz;
    this.headPivot.position.set(
      CAR.eye.x + this.lean.x + hx,
      CAR.eye.y + hy + vib + Math.sin(t * 0.25 * Math.PI * 2 / 1.1) * 0.0015,
      CAR.eye.z + this.lean.y + hz,
    );
    this.headPivot.rotation.set(
      this.noise.n1(t * 1.7 + 3) * 0.0016 * buzz + hz * 0.25,
      this.noise.n1(t * 1.3 + 9) * 0.0012 * buzz,
      -hx * 0.6 + this.noise.n1(t * 2.1) * 0.0012 * buzz,
    );
    this.selfReflection.position.set(CAR.eye.x + this.lean.x + hx, CAR.eye.y - 0.03 + hy, CAR.eye.z + 0.06 + this.lean.y + hz);

    // Drivetrain telemetry.
    let gear = 1;
    while (gear < 6 && this.v > SHIFT[gear]) gear++;
    const rpm = Math.max(760, this.v * GEARS[gear]) + Math.max(0, this.accelLong) * 260;
    const steering = Math.atan(CAR.wheelbase * (fr.kappa + slip * 0.02)) * 14;
    Object.assign(this.telemetry, {
      speed: this.v, rpm, throttle: clamp(0.25 + this.accelLong * 0.4, 0, 1), gear, steering, kappa: fr.kappa,
    });

    // Cabin animation.
    this.interior.setSteering(steering);
    this.interior.updateFreshener(dt, this.accelLat, this.accelLong, Math.sin(t * 0.7) * 0.4);
    const ahead = road.sample(this.s + 22, this.tmp);
    this.driver.update(dt, { curvatureAhead: ahead.kappa, accelLat: this.accelLat, steering });
    this.wipers.update(dt, t);
    this.interior.setWipers(this.wipers.angles);

    this.windowOpen = damp(this.windowOpen, this.windowTarget, 1.6, dt);

    // Lights.
    const hl = this.headlightIntensity * this.lightsFlicker;
    for (const L of this.headlights) L.intensity = hl;
    this.dashLight.intensity = 0.9 * this.dashFlicker;
    this.dash.brightness = this.dashFlicker;
    this.tailLight.intensity = 0.5 + Math.max(0, -this.accelLong) * 0.8;
    void wetness;
  }

  /** Smoothly set how far the passenger leans (x: -1 left .. 1 right, y: -1 forward .. 1 back). */
  setLean(x, y) {
    const L = CAR.lean;
    this.leanTarget.set(
      x < 0 ? -x * L.xMin : x * L.xMax,
      y < 0 ? -y * L.zMin : y * L.zMax,
    );
  }

  get forward() {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion);
  }
}
