// Assembles the scene and drives every animated element as a pure function of time.
import * as THREE from 'three';
import { makeSkyDome, makeClouds, SUN_DIR, SUN_COLOR } from './sky.js';
import { buildCity } from './city.js';
import { buildRoadster, CAR } from './roadster.js';
import { buildJohn } from './john.js';
import { buildTraffic } from './traffic.js';
import { buildCarWash } from './carwash.js';
import { buildFX } from './fx.js';
import { Director } from './anim.js';
import { setAniso } from './tex.js';
import { LAYOUT as L } from './layout.js';

export class World {
  constructor(renderer, W, H, timeline) {
    this.renderer = renderer; this.W = W; this.H = H; this.tl = timeline;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, W / H, 0.2, 4200);
    this.scene.add(this.camera);
    this.camOverride = null;
    this.ctx = { renderer, world: this };
  }

  async build() {
    const { scene, renderer } = this;
    setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
    scene.fog = new THREE.Fog(new THREE.Color(1, 1, 1), 0.0011, 0.0075); // (density, height falloff) - see sky.js
    this.dome = makeSkyDome(); scene.add(this.dome);
    this.clouds = makeClouds(); scene.add(this.clouds);

    // lights
    this.sun = new THREE.DirectionalLight(SUN_COLOR, 4.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(new THREE.Color(0.42, 0.50, 0.95), new THREE.Color(0.62, 0.42, 0.30), 0.6);
    scene.add(this.hemi);

    // environment map from the sky (reflections + image based light)
    const envScene = new THREE.Scene();
    envScene.add(makeSkyDome());
    envScene.add(makeClouds());
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = pmrem.fromScene(envScene, 0.0, 1, 5000);
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = 0.75;

    this.city = buildCity(this.ctx); scene.add(this.city.group);
    this.traffic = buildTraffic(this.ctx); scene.add(this.traffic.group);
    this.carwash = buildCarWash(this.ctx); scene.add(this.carwash.group);
    this.car = buildRoadster(this.ctx); scene.add(this.car.root);
    this.john = buildJohn(); this.car.body.add(this.john.group);
    this.fx = buildFX(this.ctx); scene.add(this.fx.group);
    try {
      const r = await fetch('../voices/john_mouth.json', { cache: 'no-store' });
      if (r.ok) this.mouthEnv = await r.json();
    } catch (e) { /* optional */ }
    this.director = new Director(this);
    return this;
  }

  samplesAt(t) { return this.director.samplesAt(t); }
  shutterAt(t) { return 0.5; }
  applyGrade(t, g) { /* per-shot grading tweaks (kept neutral) */ }

  setShadowFocus(center, size) {
    const s = this.sun.shadow.camera;
    s.left = -size; s.right = size; s.top = size; s.bottom = -size; s.near = 1; s.far = 1600;
    s.updateProjectionMatrix();
    this.sun.target.position.copy(center);
    this.sun.position.copy(center).addScaledVector(SUN_DIR, 700);
    this.sun.target.updateMatrixWorld();
  }

  setStudio(on) {
    if (!this.studio) {
      const g = new THREE.Group();
      const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.55 }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.002, L.laneA); floor.receiveShadow = true; g.add(floor);
      const back = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0b0b0d, side: THREE.BackSide }));
      back.position.set(0, 0, L.laneA); g.add(back);
      const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(6, 9, -8); g.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.7); fill.position.set(-5, 4, 8); g.add(fill);
      this.studio = g; this.scene.add(g);
    }
    this.studio.visible = on;
    for (const o of [this.city.group, this.traffic.group, this.carwash.group, this.dome, this.clouds]) o.visible = !on;
    this.sun.visible = !on; this.hemi.intensity = on ? 0.35 : 0.6;
  }

  update(t) {
    const o = this.camOverride;
    if (o && o.studio !== undefined) this.setStudio(!!o.studio); else if (this.studio) this.setStudio(false);
    this.director.update(t);
    if (o && o.pos) {
      // debug camera / lookdev: optionally park the car at the origin
      if (o.park) { this.car.root.position.set(0, CAR.com, L.laneA); this.car.root.quaternion.identity(); this.car.root.updateMatrixWorld(true); }
      if (o.john) { Object.assign(this.john.state, o.john); this.john.update(t); }
      const cam = this.camera;
      cam.position.set(...o.pos); cam.fov = o.fov || 40; cam.up.set(0, 1, 0);
      cam.lookAt(new THREE.Vector3(...o.target));
      cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      this.setShadowFocus(new THREE.Vector3(...(o.shadow || o.target)), o.shadowSize || 60);
    }
    this.scene.overrideMaterial = o && o.debug === 'normals' ? (this._nm = this._nm || new THREE.MeshNormalMaterial()) : null;
    this.dome.position.copy(this.camera.position);
    this.clouds.position.copy(this.camera.position);
  }
}
