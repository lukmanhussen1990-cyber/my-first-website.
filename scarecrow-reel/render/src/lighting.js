// Time-of-day lighting: golden hour, night, day, sunset. Presets blend smoothly.
import * as THREE from 'three';
import { lerp } from './util.js';

export const PRESETS = {
  golden: {
    sun: '#ffc285', sunI: 3.7, sunPos: [6.0, 3.6, 4.4],
    hemiSky: '#a8c0ea', hemiGround: '#7d5a3c', hemiI: 0.62,
    rim: '#ff9f80', rimI: 1.5, rimPos: [-5, 3.2, -6],
    fill: '#ffd9b8', fillI: 0.35, fillPos: [-4, 2, 6],
    zenith: '#3f6cb8', mid: '#93b0de', horizon: '#ffc48c', glow: '#ffae6a', cloud: '#e9b8a8', cloudLit: '#ffe2bf',
    fog: '#e9c39f', fogNear: 12, fogFar: 55, exposure: 1.0, night: 0, windows: 0.25, env: 0.42,
  },
  night: {
    sun: '#93adff', sunI: 1.15, sunPos: [-4.5, 6.5, 5.0],
    hemiSky: '#3a4f8f', hemiGround: '#1a2035', hemiI: 0.7,
    rim: '#7f9cff', rimI: 1.3, rimPos: [5, 3, -6],
    fill: '#6f86d6', fillI: 0.25, fillPos: [4, 2, 6],
    zenith: '#060c26', mid: '#12235a', horizon: '#2c4683', glow: '#3654a6', cloud: '#1b2a5a', cloudLit: '#3c4f8f',
    fog: '#1b2a56', fogNear: 14, fogFar: 60, exposure: 1.35, night: 1, windows: 1.6, env: 0.4,
  },
  day: {
    sun: '#fff0da', sunI: 3.4, sunPos: [4.5, 7.5, 5.5],
    hemiSky: '#b9d5ff', hemiGround: '#85704f', hemiI: 1.05,
    rim: '#fff1e2', rimI: 0.9, rimPos: [-5, 3.5, -6],
    fill: '#e6f0ff', fillI: 0.3, fillPos: [-4, 2, 6],
    zenith: '#2f74d0', mid: '#86bdf0', horizon: '#d9ecf8', glow: '#fff0cf', cloud: '#e7eef6', cloudLit: '#ffffff',
    fog: '#cfe2f0', fogNear: 18, fogFar: 80, exposure: 0.92, night: 0, windows: 0.05, env: 0.6,
  },
  sunset: {
    sun: '#ff9b5e', sunI: 3.0, sunPos: [6.5, 2.7, 3.6],
    hemiSky: '#b99ad8', hemiGround: '#6e4030', hemiI: 0.85,
    rim: '#ff6f66', rimI: 1.8, rimPos: [-5, 2.8, -6],
    fill: '#ffb8a0', fillI: 0.3, fillPos: [-4, 2, 6],
    zenith: '#34489a', mid: '#c58bb8', horizon: '#ff9958', glow: '#ff7a3c', cloud: '#c87a9a', cloudLit: '#ffc08a',
    fog: '#e5a07c', fogNear: 15, fogFar: 65, exposure: 1.02, night: 0, windows: 0.6, env: 0.5,
  },
};

const C = (h) => new THREE.Color(h);

// weights: [{p: presetName, w}] -> weighted blend of all preset values
export function mixPresets(list) {
  const tot = list.reduce((a, x) => a + Math.max(0, x.w), 0) || 1;
  const out = {};
  for (const { p, w } of list) {
    if (w <= 0) continue; const k = w / tot;
    for (const [key, v] of Object.entries(PRESETS[p])) {
      if (typeof v === 'number') out[key] = (out[key] || 0) + v * k;
      else if (Array.isArray(v)) { out[key] = out[key] || v.map(() => 0); v.forEach((x, i) => (out[key][i] += x * k)); }
      else { const c = C(v); out[key] = out[key] || new THREE.Color(0, 0, 0); out[key].r += c.r * k; out[key].g += c.g * k; out[key].b += c.b * k; }
    }
  }
  return out;
}

export class Lighting {
  constructor(scene, renderer, world) {
    this.scene = scene; this.renderer = renderer; this.world = world;
    this.target = new THREE.Object3D(); this.target.position.set(0, 0.5, -0.8); scene.add(this.target);
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.castShadow = true; sun.target = this.target;
    sun.shadow.mapSize.set(3072, 3072);
    const sc = sun.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 6.5; sc.bottom = -4; sc.near = 0.5; sc.far = 40;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.018; sun.shadow.radius = 3;
    scene.add(sun);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x886644, 1); scene.add(this.hemi);
    this.rim = new THREE.DirectionalLight(0xffffff, 1); this.rim.target = this.target; scene.add(this.rim);
    this.fill = new THREE.DirectionalLight(0xffffff, 0.3); this.fill.target = this.target; scene.add(this.fill);
    scene.fog = new THREE.Fog(0xffffff, 16, 70);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), world.mats.sky);
    this.envScene.add(this.envSky);
    this.envGround = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: 0x5a4a30 }));
    this.envGround.rotation.x = -Math.PI / 2; this.envGround.position.y = -0.8; this.envScene.add(this.envGround);
    this.envKey = null; this.envRT = null;
  }

  apply(s) {
    this.state = s;
    const sun = this.sun;
    sun.color.copy(s.sun); sun.intensity = s.sunI;
    sun.position.set(...s.sunPos).add(this.target.position);
    this.hemi.color.copy(s.hemiSky); this.hemi.groundColor.copy(s.hemiGround); this.hemi.intensity = s.hemiI;
    this.rim.color.copy(s.rim); this.rim.intensity = s.rimI; this.rim.position.set(...s.rimPos).add(this.target.position);
    this.fill.color.copy(s.fill); this.fill.intensity = s.fillI; this.fill.position.set(...s.fillPos).add(this.target.position);
    this.scene.fog.color.copy(s.fog); this.scene.fog.near = s.fogNear; this.scene.fog.far = s.fogFar;
    this.renderer.toneMappingExposure = s.exposure;
    const u = this.world.mats.sky.uniforms;
    u.uZenith.value.copy(s.zenith); u.uMid.value.copy(s.mid); u.uHorizon.value.copy(s.horizon); u.uGlow.value.copy(s.glow);
    u.uCloud.value.copy(s.cloud); u.uCloudLit.value.copy(s.cloudLit); u.uNight.value = s.night;
    const g = this.world.house.glassMat; g.emissiveIntensity = s.windows;
    this.scene.environmentIntensity = s.env;
    this.envGround.material.color.copy(s.hemiGround).multiplyScalar(0.8);
    // regenerate the reflection environment only when the sky changed noticeably
    const key = [s.zenith, s.horizon, s.mid].map((c) => c.getHexString()).join('') + Math.round(s.night * 20);
    if (key !== this.envKey) {
      const q = (c) => Math.round(c * 24) / 24;
      const kq = [s.zenith.r, s.zenith.g, s.zenith.b, s.horizon.r, s.horizon.g, s.horizon.b].map(q).join(',') + Math.round(s.night * 10);
      if (kq !== this.envKq) {
        if (this.envRT) this.envRT.dispose();
        this.envRT = this.pmrem.fromScene(this.envScene, 0.02);
        this.scene.environment = this.envRT.texture;
        this.envKq = kq;
      }
      this.envKey = key;
    }
  }
}
