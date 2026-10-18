// THE WORLD — buildWorld(stage) builds the whole riverside environment and returns
//   {
//     update(t, { mood = 0 /*0 bright day .. 1 golden hour*/, wind = 0.5 /*0..1*/ }),
//     sun,                       // THREE.DirectionalLight (the only shadow caster light)
//     hemi, rim,                 // HemisphereLight (sky/ground fill), DirectionalLight back/rim light (no shadows)
//     groundHeight(x, z),        // analytic ground height (exactly 0 in the acting area |x|<4, -3<z<1.6)
//     seats: { knight: Vector3, jesus: Vector3 },   // seat-top centres: (-0.55, 0.48, -0.05) / (0.80, 0.44, 0.05)
//     focusShadow(center: Vector3, radius: number), // re-fit the sun shadow frustum for the current shot
//     sunDir: Vector3,           // current unit vector from the scene toward the sun (updated by update())
//     river, castle, root, stats, // extras: river constants, castle world position, world root group, counts
//   }
// Layout follows docs/DESIGN.md. All motion is a pure function of t (no Math.random / wall clock).
import * as THREE from 'three';
import { makeEnvMap } from '../core/stage.js';
import { clamp, lerp, smoothstep } from '../core/util.js';
import { patchHeightFog, WIND } from './wutil.js';
import { buildTerrain, buildWater, buildStones, groundHeight, RIVER, CASTLE_POS } from './terrain.js';
import { buildSeats } from './rocks.js';
import { buildTrees, buildGrass } from './vegetation.js';
import { buildSky } from './sky.js';
import { buildCastle, buildRuins, buildMountains } from './castle.js';
import { buildMotes, buildButterflies, buildShafts } from './particles.js';

const C = (h) => new THREE.Color(h);
// Mood palettes (colours are converted to linear on construction).
const DAY = {
  elev: 0.95, sunCol: C(0xfff3de), sunI: 3.0,
  hemiSky: C(0xd4e8ff), hemiGround: C(0x95b244), hemiI: 1.3,
  rimCol: C(0xe2ecff), rimI: 0.6,
  top: C(0x3a8de8), mid: C(0x94c5f0), horizon: C(0xeef2f5),
  fog: C(0xe9eef2), fogD: 0.026,
  exposure: 1.0, envI: 1.0, water: C(0xffffff), cloud: C(0xffffff), glow: 0.35, disc: 2.0,
  shafts: 0, spark: 2.2,
};
const GOLD = {
  elev: 0.22, sunCol: C(0xffa04a), sunI: 4.2,
  hemiSky: C(0xffd6a6), hemiGround: C(0x8f7d3e), hemiI: 1.0,
  rimCol: C(0xffb35e), rimI: 1.5,
  top: C(0x5b84c8), mid: C(0xf2b88a), horizon: C(0xffd9a4),
  fog: C(0xf7d6a6), fogD: 0.03,
  exposure: 1.1, envI: 0.95, water: C(0xffe2bc), cloud: C(0xffcfae), glow: 1.3, disc: 4.0,
  shafts: 0.22, spark: 3.6,
};
const SUN_X = -0.55, SUN_Z = 0.45;

export function buildWorld(stage) {
  const { scene, renderer } = stage;
  patchHeightFog();

  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);
  scene.background = null;

  // ---- sky
  const sky = buildSky();
  root.add(sky.dome, sky.clouds);

  // ---- ground, river, stones, seats
  const terrain = buildTerrain();
  root.add(terrain.mesh);
  const stones = buildStones();
  root.add(stones.mesh);
  const water = buildWater(terrain.xs, stones.foam);
  root.add(water.mesh);
  const seats = buildSeats();
  root.add(seats.knight, seats.jesus);

  // ---- vegetation
  const trees = buildTrees();
  root.add(trees.trunkMesh, trees.leafMesh);
  const grass = buildGrass();
  root.add(grass.tuftMesh, grass.reedMesh, grass.flowerMesh);

  // ---- distance
  const castle = buildCastle();
  root.add(castle.group);
  root.add(buildRuins());
  root.add(buildMountains());

  // ---- atmosphere
  const motes = buildMotes();
  root.add(motes.points);
  const flies = buildButterflies();
  root.add(flies.group);
  const shafts = buildShafts();
  root.add(shafts.mesh);

  // ---- lights
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.name = 'sun';
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x88aa44, 1.2);
  hemi.name = 'hemi';
  scene.add(hemi);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.name = 'rim';
  rim.position.set(0.9, 2.2, -3.0);
  scene.add(rim, rim.target);

  scene.fog = new THREE.FogExp2(0xe9eef2, 0.026);

  // ---- env map (PMREM) per mood bucket, generated lazily and cached
  const envCache = new Map();
  let envKey = -1;
  const P = {}; // current interpolated palette
  for (const k of Object.keys(DAY)) P[k] = DAY[k] instanceof THREE.Color ? DAY[k].clone() : DAY[k];
  const sunDir = new THREE.Vector3();
  function setEnv(mood) {
    const key = Math.round(clamp(mood, 0, 1) * 6);
    if (key === envKey) return;
    envKey = key;
    if (!envCache.has(key)) {
      const m = key / 6;
      const lp = (a, b) => a.clone().lerp(b, m);
      const e = Math.max(0.12, lerp(DAY.elev, GOLD.elev, m));
      envCache.set(key, makeEnvMap(renderer, {
        top: lp(DAY.top, GOLD.top).getHex(), horizon: lp(DAY.horizon, GOLD.horizon).getHex(), ground: lp(C(0x8fbf3a), C(0x9a8a40)).getHex(),
        sun: { color: lp(DAY.sunCol, GOLD.sunCol).getHex(), intensity: lerp(5, 7, m), dir: [SUN_X, e, SUN_Z] },
      }));
    }
    scene.environment = envCache.get(key);
  }

  // ---- shadow focus
  const focus = { c: new THREE.Vector3(0, 0.6, 0), r: 6 };
  function fitShadow() {
    const r = Math.max(0.5, focus.r);
    const back = r + 30;
    sun.target.position.copy(focus.c);
    sun.position.copy(focus.c).addScaledVector(sunDir, back);
    const cam = sun.shadow.camera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 0.5; cam.far = back + r + 12;
    cam.updateProjectionMatrix();
    sun.target.updateMatrixWorld();
    sun.updateMatrixWorld();
    // keep shadow texel density reasonable for wide shots
    sun.shadow.normalBias = 0.012 + r * 0.004;
  }
  function focusShadow(center, radius) {
    focus.c.copy(center);
    focus.r = radius;
    fitShadow();
  }

  // ---- per-frame update
  let lastT = -1;
  function update(t, state = {}) {
    const mood = clamp(state.mood ?? 0, 0, 1);
    const wind = clamp(state.wind ?? 0.5, 0, 1);
    const m = smoothstep(0, 1, mood) * 0.35 + mood * 0.65; // ease the palette a touch
    for (const k of Object.keys(DAY)) {
      if (DAY[k] instanceof THREE.Color) P[k].copy(DAY[k]).lerp(GOLD[k], m);
      else P[k] = lerp(DAY[k], GOLD[k], m);
    }
    // sun
    sunDir.set(SUN_X, P.elev, SUN_Z).normalize();
    sun.color.copy(P.sunCol);
    sun.intensity = P.sunI;
    fitShadow();
    hemi.color.copy(P.hemiSky);
    hemi.groundColor.copy(P.hemiGround);
    hemi.intensity = P.hemiI;
    rim.color.copy(P.rimCol);
    rim.intensity = P.rimI;
    // sky / fog / exposure / env
    sky.uniforms.uTop.value.copy(P.top);
    sky.uniforms.uMid.value.copy(P.mid);
    sky.uniforms.uHorizon.value.copy(P.horizon);
    sky.uniforms.uSunDir.value.copy(sunDir);
    sky.uniforms.uSunCol.value.copy(P.sunCol);
    sky.uniforms.uGlow.value = P.glow;
    sky.uniforms.uDisc.value = P.disc;
    for (const cm of sky.cloudMats) cm.color.copy(P.cloud);
    sky.clouds.rotation.y = t * 0.0025;
    scene.fog.color.copy(P.fog);
    scene.fog.density = P.fogD;
    renderer.toneMappingExposure = P.exposure;
    scene.environmentIntensity = P.envI;
    setEnv(mood);
    // animated materials
    WIND.uTime.value = t;
    WIND.uWind.value = wind;
    const wu = water.uniforms;
    wu.uTime.value = t;
    wu.uTint.value.copy(P.water);
    wu.uSunCol.value.copy(P.sunCol);
    wu.uSpark.value = P.spark;
    wu.uSunDir.value.copy(sunDir);
    motes.uniforms.uTime.value = t;
    motes.uniforms.uWind.value = wind;
    motes.uniforms.uMood.value = mood;
    flies.update(t);
    shafts.uniforms.uSunDir.value.copy(sunDir);
    shafts.uniforms.uTime.value = t;
    shafts.uniforms.uIntensity.value = P.shafts * smoothstep(0.2, 0.85, mood);
    shafts.uniforms.uColor.value.copy(P.sunCol).lerp(C(0xffffff), 0.15);
    shafts.mesh.visible = shafts.uniforms.uIntensity.value > 0.002;
    if (t !== lastT) castle.flutter(t);
    lastT = t;
  }

  update(0, { mood: 0, wind: 0.5 });

  const stats = {
    terrainTris: terrain.triangles, leafCubes: trees.leafCount, ...grass.counts,
  };
  return {
    root, update, sun, hemi, rim, sunDir, groundHeight, focusShadow,
    seats: seats.seats,
    seatMeshes: { knight: seats.knight, jesus: seats.jesus },
    river: { ...RIVER }, castle: CASTLE_POS.clone(), stats,
  };
}
