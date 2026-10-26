// The 3D engine: one scene holding every set (only the active one is visible), one camera driven by
// the director, a sun with soft PCF shadows (2048), hemisphere fill, a fire/lamp point light, a spot,
// a sky dome + mood-driven sky fx (clouds, storm decks, lightning crack), and the post chain
// (SSAO, god rays, height fog, DOF, bloom, tone mapping, grade, SMAA). render(frame) is a pure function of the frame.
import * as THREE from 'three';
import { Post } from './post.js';
import { makeSky } from './fx.js';
import { makeSkyFx } from './sky.js';
import { U } from './materials.js';
import { resolve, merge } from './moods.js';
import { cameraShot, layersAt, SHOT_SET, SETS, blockingOf } from '../lib/director.js';
import { BUILDERS } from './sets/index.js';

const TRANS_COLOR = { dust: '#d9bb8c', flare: '#ffd49a', push: '#ffe2b0', dissolve: '#000000', whip: '#000000' };

export class World {
  constructor(gl, plan, { W = 1080, H = 1920 } = {}) {
    this.gl = gl; this.plan = plan; this.W = W; this.H = H;
    gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFShadowMap; gl.shadowMap.autoUpdate = true;
    gl.setClearColor(0x000000, 1);
    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(24, W / H, 0.1, 1600);
    this.sky = makeSky(); scene.add(this.sky);
    this.skyFx = makeSkyFx(); scene.add(this.skyFx.group);
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
    this.crackE = null;
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
    // clouds / storm decks / lightning crack (its flash lifts the sky, the fill light and the frame)
    const E = this.crackE = this.skyFx.set(U.uTime.value, M, this.camera, c, o);
    if (E.flash > 0.001 || E.glow > 0.001) {
      const C = S.crack || {};
      const f = E.flash * (C.flash ?? 0.35);
      M.post = { ...M.post, flash: (M.post.flash || 0) + f };
      u.top.value.lerp(this._c.set(C.skyColor ?? '#c9d2e0'), Math.min(1, E.flash * 0.6));
      u.horizon.value.lerp(this._c.set(C.skyColor ?? '#c9d2e0'), Math.min(1, E.flash * 0.35));
    }
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
    this.hemi.color.set(M.hemi.sky); this.hemi.groundColor.set(M.hemi.ground); this.hemi.intensity = M.hemi.intensity + (E.flash > 0 ? E.flash * ((S.crack && S.crack.hemiK) ?? 1.6) : 0);
    this.scene.fog.color.set(M.fog.color); this.scene.fog.near = M.fog.near; this.scene.fog.far = M.fog.far;
    U.uCharLight.value.set(M.char); U.uAO.value = M.ao; U.uWind.value = M.wind; U.uGroundY.value = M.groundY ?? 0;
    // key light for the cel-shaded characters (direction TOWARD the sun, world space) + its colour/strength
    U.uSunDir.value.copy(dir); U.uSunColor.value.set(M.sun.color).multiplyScalar(Math.min(1.5, M.sun.intensity / 3));
    if (M.point) {
      const P = M.point;
      this.point.position.set(P.pos[0] + o[0], P.pos[1] + o[1], P.pos[2] + o[2]); this.point.color.set(P.color); this.point.intensity = P.intensity; this.point.distance = P.distance ?? 14;
      this.point.decay = P.decay ?? 1.6;
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
  renderShot(shot, t, target, frame, camOverride = null) {
    const set = this.sets[SHOT_SET[shot.id]];
    for (const s of Object.values(this.sets)) s.group.visible = s === set;
    if (!set) { this.gl.setRenderTarget(target); this.gl.clear(); return; }
    const c0 = camOverride ? { ...cameraShot(this.plan, shot, t), ...camOverride, mblur: 0 } : cameraShot(this.plan, shot, t);
    const n = c0.mblur > 1 ? c0.mblur : 1;
    // the mood decides render-target choices (supersample) and profiling before the scene is drawn
    const M0 = resolve(set.mood(t, shot, c0));
    if (M0.post.bench && !camOverride) this.bench(set, shot, t, c0, M0.post.bench, frame);
    const prof = !!M0.post.profile;
    this.post.profStart(prof);
    const shutter = 0.5 / 30;                       // 180-degree shutter
    const offs = n === 1 ? [0] : Array.from({ length: n - 1 }, (_, i) => (i / (n - 2) - 0.5) * shutter).concat([0]);
    let M = null, c = c0;
    const cam = this.post.scene(this.scene, n, (i) => {
      const tt = t + offs[i];
      c = i === n - 1 || camOverride ? c0 : cameraShot(this.plan, shot, tt);
      this.setCamera(c);
      U.uTime.value = tt;
      M = resolve(set.mood(tt, shot, c));
      this.applyMood(M, c, SETS[set.name]);
      set.update(tt, this.camera, shot, c, M);
      return this.camera;
    }, M0.post.supersample || 1, M0.post.msaa ?? 4);
    const P = { ...M.post, focus: c.focus ?? M.post.focus };
    this.post.compose(P, cam, target, frame, { o: SETS[set.name], M });
    if (prof && this.post.prof) {
      const L = this.post.prof.list, tot = L.reduce((a, b) => a + b[1], 0);
      console.log(`[prof] f${frame} ${shot.id} total ${tot.toFixed(0)}ms ` + L.map(([k, v]) => `${k} ${v}`).join(' | '));
      this.post.prof = null;
    }
  }

  // Timing bench (lab only: mood.post.bench = { reps, scene: [...], post: [...] }). Every config is measured
  // `reps` times inside ONE frame, interleaved, and the minimum is logged, so load from other processes
  // (shared CPUs) mostly cancels out. Scene configs: { name, msaa, ss, noShadow, noSky }; post configs:
  // { name, post: {...overrides}, fog: {...} }.
  bench(set, shot, t, c, B, frame) {
    const post = this.post, o = SETS[set.name];
    const draw = () => { this.setCamera(c); U.uTime.value = t; const M = resolve(set.mood(t, shot, c)); this.applyMood(M, c, o); set.update(t, this.camera, shot, c, M); return M; };
    const res = new Map(); const rec = (k, v) => { if (!res.has(k)) res.set(k, []); res.get(k).push(v); };
    const sceneCfgs = B.scene || [{ name: 'msaa4' }, { name: 'msaa0', msaa: 0 }, { name: 'noShadow', noShadow: 1 }, { name: 'noSky', noSky: 1 }, { name: 'ss1.5', ss: 1.5 }];
    const postCfgs = B.post || [{ name: 'default', post: {} }];
    for (let r = 0; r < (B.reps || 3); r++) {
      for (const S of sceneCfgs) {
        draw(); this.sun.castShadow = !S.noShadow; this.sky.visible = !S.noSky;
        post.profStart(true); post.scene(this.scene, 1, () => this.camera, S.ss || 1, S.msaa ?? 4);
        rec('scene ' + S.name, post.prof.list.find((x) => x[0] === 'scene')[1]);
        this.sun.castShadow = true; this.sky.visible = true;
      }
      const M = draw(); post.profStart(false); post.scene(this.scene, 1, () => this.camera, 1, 4);
      for (const pc of postCfgs) {
        post.profStart(true);
        post.compose({ ...M.post, ...(pc.post || {}) }, this.camera, post.outA, frame, { o, M: pc.fog ? merge(M, { fog: pc.fog }) : M });
        let tot = 0; for (const [k, v] of post.prof.list) { rec(pc.name + ' ' + k, v); tot += v; }
        rec(pc.name + ' TOTAL', tot);
      }
    }
    post.prof = null;
    console.log(`[bench] f${frame} reps ${B.reps || 3} (min ms):\n` + [...res].map(([k, v]) => `  ${k.padEnd(28)} ${Math.min(...v).toFixed(1)}`).join('\n'));
  }

  render(frame, camOverride = null) {
    const t = frame / 30;
    if (camOverride) { this.renderShot(layersAt(this.plan, t).shot, t, null, frame, camOverride); return null; }
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
