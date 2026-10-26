// The 3D engine: one scene holding every set (only the active one is visible), one camera driven by
// the director, a sun with soft PCF shadows (2048), hemisphere fill, a fire point light, a spot,
// a sky dome, and the post chain. render(frame) is a pure function of the frame number.
import * as THREE from 'three';
import { Post } from './post.js';
import { makeSky } from './fx.js';
import { U } from './materials.js';
import { resolve } from './moods.js';
import { cameraShot, layersAt, SHOT_SET, SETS, blockingOf } from '../lib/director.js';
import { buildDesert } from './sets/desert.js';
import { buildScroll } from './sets/scroll.js';
import { buildStreet } from './sets/street.js';
import { buildMarket } from './sets/market.js';
import { buildField } from './sets/field.js';
import { buildBench, buildMind } from './sets/bench.js';
import { buildRoad } from './sets/road.js';
import { buildGate } from './sets/gate.js';
import { buildVillage } from './sets/village.js';
import { buildHill } from './sets/hill.js';

const BUILDERS = { desert: buildDesert, scroll: buildScroll, street: buildStreet, market: buildMarket, field: buildField, bench: buildBench, mind: buildMind, road: buildRoad, gate: buildGate, village: buildVillage, hill: buildHill };
const TRANS_COLOR = { dust: '#d9bb8c', flare: '#ffd49a', push: '#ffe2b0', dissolve: '#000000', whip: '#000000' };

export class World {
  constructor(gl, plan, { W = 1080, H = 1920 } = {}) {
    this.gl = gl; this.plan = plan; this.W = W; this.H = H;
    gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFShadowMap; gl.shadowMap.autoUpdate = true;
    gl.setClearColor(0x000000, 1);
    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(24, W / H, 0.1, 1600);
    this.sky = makeSky(); scene.add(this.sky);
    const sun = this.sun = new THREE.DirectionalLight('#ffffff', 2.5);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 220;
    scene.add(sun, sun.target);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#806040', 1); scene.add(this.hemi);
    this.point = new THREE.PointLight('#ff9a4a', 0, 14, 1.6); scene.add(this.point);
    this.spot = new THREE.SpotLight('#fff0d0', 0, 40, 0.5, 0.6, 2); scene.add(this.spot, this.spot.target);
    this.spot.shadow.mapSize.set(1024, 1024); this.spot.shadow.bias = -0.0005; this.spot.shadow.normalBias = 0.01; this.spot.shadow.radius = 3;
    scene.fog = new THREE.Fog('#e6d6b0', 60, 420);
    this.post = new Post(gl, W, H);
    this.ctx = { plan, B: blockingOf(plan), world: this };
    this.sets = {};
    for (const [name, build] of Object.entries(BUILDERS)) {
      const s = build(this.ctx); s.name = name;
      s.group.position.set(...SETS[name]); s.group.visible = false; scene.add(s.group);
      this.sets[name] = s;
    }
    this._v = new THREE.Vector3(); this._c = new THREE.Color();
  }

  setCamera(c) {
    const cam = this.camera;
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look);
    if (c.roll) cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = c.near ?? 0.1; cam.far = c.far ?? 1600; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }

  applyMood(M, c, o = [0, 0, 0]) {
    const S = M.sky, u = this.sky.material.uniforms;
    u.top.value.set(S.top); u.horizon.value.set(S.horizon); u.bottom.value.set(S.bottom); u.band.value.set(S.band);
    u.sunGlow.value.set(S.sunGlow); u.sunDisk.value.set(S.sunDisk); u.stars.value = S.stars; u.moon.value = S.moon;
    u.moonDir.value.set(...S.moonDir).normalize(); u.sunDir.value.set(...M.sunDir).normalize(); u.time.value = U.uTime.value;
    this.sky.position.copy(this.camera.position);
    // sun + shadow box centred on what the camera looks at
    const look = this._v.set(...c.look); look.y = M.shadow.y ?? 0;
    const dir = new THREE.Vector3(...M.sunDir).normalize();
    this.sun.color.set(M.sun.color); this.sun.intensity = M.sun.intensity;
    this.sun.target.position.copy(look); this.sun.position.copy(look).addScaledVector(dir, 90);
    const dist = Math.hypot(c.pos[0] - c.look[0], c.pos[1] - c.look[1], c.pos[2] - c.look[2]);
    const half = M.shadow.size ?? Math.min(45, Math.max(7, dist * 0.55));
    const sc = this.sun.shadow.camera;
    if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); }
    this.sun.target.updateMatrixWorld(); this.sun.updateMatrixWorld();
    this.hemi.color.set(M.hemi.sky); this.hemi.groundColor.set(M.hemi.ground); this.hemi.intensity = M.hemi.intensity;
    this.scene.fog.color.set(M.fog.color); this.scene.fog.near = M.fog.near; this.scene.fog.far = M.fog.far;
    U.uCharLight.value.set(M.char); U.uAO.value = M.ao; U.uWind.value = M.wind; U.uGroundY.value = M.groundY ?? 0;
    if (M.point) {
      const P = M.point;
      this.point.position.set(P.pos[0] + o[0], P.pos[1] + o[1], P.pos[2] + o[2]); this.point.color.set(P.color); this.point.intensity = P.intensity; this.point.distance = P.distance ?? 14;
      U.uPointPos.value.copy(this.point.position); U.uPointColor.value.set(P.charColor ?? P.color).multiplyScalar(P.charK ?? 0.5); U.uPointRange.value = P.charRange ?? 5;
    } else { this.point.intensity = 0; U.uPointColor.value.setRGB(0, 0, 0); U.uPointPos.value.set(0, -9999, 0); }
    if (M.spot) {
      const P = M.spot;
      this.spot.position.set(P.pos[0] + o[0], P.pos[1] + o[1], P.pos[2] + o[2]); this.spot.target.position.set(P.target[0] + o[0], P.target[1] + o[1], P.target[2] + o[2]); this.spot.color.set(P.color);
      this.spot.intensity = P.intensity; this.spot.angle = P.angle ?? 0.5; this.spot.penumbra = P.penumbra ?? 0.6; this.spot.distance = P.distance ?? 40;
      this.spot.decay = P.decay ?? 2; this.spot.castShadow = !!P.shadow;
      this.spot.target.updateMatrixWorld();
    } else { this.spot.intensity = 0; this.spot.castShadow = false; }
  }

  // render one shot (with optional sub-frame motion blur) through the post chain into `target`
  renderShot(shot, t, target, frame) {
    const set = this.sets[SHOT_SET[shot.id]];
    for (const s of Object.values(this.sets)) s.group.visible = s === set;
    if (!set) { this.gl.setRenderTarget(target); this.gl.clear(); return; }
    const c0 = cameraShot(this.plan, shot, t);
    const n = c0.mblur > 1 ? c0.mblur : 1;
    const shutter = 0.5 / 30;                       // 180-degree shutter
    const offs = n === 1 ? [0] : Array.from({ length: n - 1 }, (_, i) => (i / (n - 2) - 0.5) * shutter).concat([0]);
    let M = null, c = c0;
    const cam = this.post.scene(this.scene, n, (i) => {
      const tt = t + offs[i];
      c = i === n - 1 ? c0 : cameraShot(this.plan, shot, tt);
      this.setCamera(c);
      U.uTime.value = tt;
      M = resolve(set.mood(tt, shot, c));
      this.applyMood(M, c, SETS[set.name]);
      set.update(tt, this.camera, shot, c, M);
      return this.camera;
    });
    const P = { ...M.post, focus: c.focus ?? M.post.focus };
    this.post.compose(P, cam, target, frame);
  }

  render(frame) {
    const t = frame / 30;
    const L = layersAt(this.plan, t);
    const gl = this.gl;
    const A = L.a3d ? L.A : null, B = L.B && L.b3d ? L.B : null;
    if (!A && !B) { gl.setRenderTarget(null); gl.setClearColor(0x000000, 1); gl.clear(); return L; }
    if (!A || !B) { this.renderShot(A || B, t, null, frame); return L; }
    this.renderShot(A, t, this.post.outA, frame);
    this.renderShot(B, t, this.post.outB, frame);
    this.post.mix(this.post.outA, this.post.outB, L.mode, L.k, TRANS_COLOR[L.mode] || '#000000', (frame % 7) * 1.3);
    return L;
  }
}
